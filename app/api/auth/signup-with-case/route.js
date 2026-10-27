import { NextResponse, after } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/app/lib/prisma';
import { serializeCase } from '@/app/lib/serialize';
import driveService from '@/app/lib/googleDrive';
import { sendSignupEmail } from '@/app/lib/mailer';
import { notifyAdminsOfNewSignup } from '@/app/lib/adminNotify';
import {
  cleanSignupDetails,
  googleUserData,
  resolveSignupName,
  verifyGoogleCredential,
} from '@/app/lib/googleSignIn';

const ARRAY_FIELDS = [
  'impressionsTaken',
  'additionalRecords',
  'doNotMoveTeeth',
  'avoidAttachmentsTeeth',
  'teethForExtraction',
  'leaveSpacesOpen',
];

export async function POST(req) {
  console.log('📝 Signup-with-case started');

  // Tracked outside the try so a failure part-way through can be rolled back
  let newUser = null;
  let newCase = null;

  try {
    const formData = await req.formData();
    console.log('FormData received, entries:', Array.from(formData.keys()).length);

    const fields = {};
    const scanFilesRaw = [];
    const patientImagesRaw = [];

    for (const [key, value] of formData.entries()) {
      if (key === 'scanFiles' && value instanceof File && value.size > 0) {
        scanFilesRaw.push(value);
        console.log(`📎 Scan file: ${value.name} (${value.size} bytes)`);
      } else if (key === 'patientImages' && value instanceof File && value.size > 0) {
        patientImagesRaw.push(value);
        console.log(`📎 Patient image: ${value.name} (${value.size} bytes)`);
      } else if (value instanceof File) {
        console.log(`📎 Other file: ${key} = ${value.name}`);
        fields[key] = value;
      } else {
        if (ARRAY_FIELDS.includes(key)) {
          if (!fields[key]) fields[key] = [];
          fields[key].push(value);
        } else {
          fields[key] = value;
        }
      }
    }

    console.log('Parsed fields:', Object.keys(fields).filter((k) => k !== 'password' && k !== 'googleCredential'));
    console.log('Scan files:', scanFilesRaw.length);
    console.log('Patient images:', patientImagesRaw.length);

    const { email, password, firstName, lastName, businessName, businessAddress, contactNumber, specialInstructions } = fields;

    if (fields.googleCredential) {
      // ---------- GOOGLE SIGNUP ----------
      const google = await verifyGoogleCredential(fields.googleCredential);
      if (!google) {
        return NextResponse.json(
          { message: 'Google sign-in failed or expired. Please click "Sign up with Google" again.' },
          { status: 401 }
        );
      }

      const existing = await prisma.user.findFirst({
        where: { OR: [{ googleId: google.googleId }, { email: google.email }] },
      });
      if (existing) {
        return NextResponse.json(
          {
            message:
              existing.authProvider === 'google'
                ? 'You have already signed up with this Google account. Please log in with Google.'
                : 'This email is registered with a password. Please log in with your email and password instead.',
          },
          { status: 409 }
        );
      }

      const { details, error: detailsError } = cleanSignupDetails('doctor', {
        businessName,
        businessAddress,
        contactNumber,
        specialInstructions,
      });
      if (detailsError) {
        return NextResponse.json({ message: detailsError }, { status: 400 });
      }

      const name = resolveSignupName([firstName, lastName].filter(Boolean).join(' '), google);
      newUser = await prisma.user.create({
        data: await googleUserData({ google, role: 'doctor', ...name, details }),
      });
    } else {
      // ---------- EMAIL + PASSWORD SIGNUP ----------
      if (!email || !password || !firstName) {
        console.error('Missing required fields:', { email: !!email, password: !!password, firstName: !!firstName });
        return NextResponse.json(
          { message: 'Name, email, and password are required' },
          { status: 400 }
        );
      }
      if (password.length < 6) {
        return NextResponse.json(
          { message: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }

      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      });

      if (existing) {
        console.log('User already exists:', email);
        return NextResponse.json(
          {
            message:
              existing.authProvider === 'google'
                ? 'An account with this email already exists and uses Google sign-in. Please log in with Google.'
                : 'An account with this email already exists',
          },
          { status: 400 }
        );
      }

      console.log('Creating user...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: 'doctor',
          firstName: firstName.trim(),
          lastName: lastName ? lastName.trim() : '',
          isApproved: false,
          doctorDetails: {
            businessName:        businessName        || '',
            businessAddress:     businessAddress     || '',
            contactNumber:       contactNumber       || '',
            specialInstructions: specialInstructions || '',
          },
        },
      });
    }
    console.log('✅ User created:', newUser.id, newUser.email);

    // ---------- DRIVE FOLDER SETUP ----------
    // Create case folder: [date] - [patientName] and its child “chat”
    const start = new Date();
    const ymd = start.toISOString().slice(0, 10);
    const folderName = `${ymd} - ${fields.patientName?.trim() || 'Unnamed Patient'}`;
    const folderInfo = await driveService.ensureCaseFolders(folderName);
    const caseFolderId = folderInfo.caseFolderId || null;
    const chatFolderId = folderInfo.chatFolderId || null;

    if (!caseFolderId) {
      throw new Error('Failed to create case folder on Drive');
    }
    // -----------------------------------------

    const toBufferObj = async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      return {
        originalname: file.name,
        mimetype: file.type || 'application/octet-stream',
        buffer: Buffer.from(arrayBuffer),
      };
    };

    const [scanFileBuffers, patientImageBuffers] = await Promise.all([
      Promise.all(scanFilesRaw.map(toBufferObj)),
      Promise.all(patientImagesRaw.map(toBufferObj)),
    ]);

    console.log(`Files converted: ${scanFileBuffers.length} scans, ${patientImageBuffers.length} images`);

    // ---------- UPLOAD FILES TO DRIVE ----------
    let scanFiles = [];
    let patientImages = [];

    try {
      // Upload scan files to the *case* folder
      if (scanFileBuffers.length > 0) {
        const uploadedScans = await driveService.uploadMultipleFiles(scanFileBuffers, caseFolderId);
        scanFiles = uploadedScans;
      }

      // Upload patient images to the *chat* sub‑folder
      if (patientImageBuffers.length > 0) {
        const uploadedImages = await driveService.uploadMultipleFiles(patientImageBuffers, chatFolderId);
        patientImages = uploadedImages;
      }
    } catch (uploadErr) {
      const driveReason =
        uploadErr?.errors?.[0]?.reason ||
        uploadErr?.response?.data?.error?.errors?.[0]?.reason ||
        uploadErr?.response?.data?.error?.status ||
        null;
      console.error('File upload failed (case will still be created):', uploadErr?.message || uploadErr);
      if (driveReason) console.error('   ↳ Drive/auth reason:', driveReason);
      if (uploadErr?.response?.data) {
        console.error('   ↳ Drive API payload:', JSON.stringify(uploadErr.response.data));
      }
      // Continue with empty file arrays so the case row is still saved.
    }

    // ---------- CREATE THE CASE RECORD ----------
    console.log('Creating case...');

    const caseData = {
      doctorId:           newUser.id,
      patientName:        fields.patientName        || '',
      practiceName:       fields.practiceName       || '',
      chiefComplaint:     fields.chiefComplaint     || '',
      dob:                fields.dob                || '',
      toothSystem:        fields.toothSystem        || 'FDI (recommended)',
      impressionMethod:   fields.impressionMethod   || '',
      impressionsTaken:   fields.impressionsTaken   || [],
      additionalRecords:  fields.additionalRecords  || [],
      treatArches:        fields.treatArches        || 'Both',
      velocity:           fields.velocity           || '0.2',
      otherVelocity:      fields.otherVelocity      || '',
      caseType:           fields.caseType           || '',
      wearSchedule:       fields.wearSchedule       || '',
      retainer:           fields.retainer           || '',
      doNotMoveTeeth:     fields.doNotMoveTeeth     || [],
      avoidAttachmentsTeeth: fields.avoidAttachmentsTeeth || [],
      teethForExtraction: fields.teethForExtraction || [],
      leaveSpacesOpen:    fields.leaveSpacesOpen    || [],
      upperMidlineValue:  fields.upperMidlineValue  || '',
      upperMidlineGoal:   fields.upperMidlineGoal   || '',
      lowerMidlineValue:  fields.lowerMidlineValue  || '',
      lowerMidlineGoal:   fields.lowerMidlineGoal   || '',
      overjetValue:       fields.overjetValue       || '',
      overjetGoal:        fields.overjetGoal        || '',
      overbiteValue:      fields.overbiteValue      || '',
      overbiteGoal:       fields.overbiteGoal       || '',
      canineRelation:     fields.canineRelation     || '',
      molarRelation:      fields.molarRelation      || '',
      anteriorCrossbite:  fields.anteriorCrossbite  || '',
      posteriorCrossbite: fields.posteriorCrossbite || '',
      deciduousTeeth:     fields.deciduousTeeth     || '',
      ipr:                fields.ipr                || '',
      engagers:           fields.engagers           || [],
      spaceManagement:    fields.spaceManagement    || '',
      additionalInfo:     fields.additionalInfo     || '',
      treatmentPlan:      fields.treatmentPlan      || '',
      scanFiles:          scanFiles,
      patientImages:      patientImages,
      googleDriveFolderId: folderInfo.caseFolderId,
      caseFolderName:     folderInfo.caseFolderName || null,
      chatFolderId:       chatFolderId,
      status:             'pending',
    };

    console.log('Case data prepared:', Object.keys(caseData));

    newCase = await prisma.case.create({
      data: caseData,
    });

    console.log('✅ Case created:', newCase.id);

    // Ensure the uploaded file IDs are persisted back to the case
    if (scanFiles.length > 0 || patientImages.length > 0) {
      await prisma.case.update({
        where: { id: newCase.id },
        data: {
          scanFiles: caseData.scanFiles,
          patientImages: caseData.patientImages,
        },
      });
    }

    // Welcome email — sent after the response so it doesn't slow down signup.
    // Scheduled only on success so a failed signup doesn't send a welcome email.
    const createdUser = newUser;
    const createdCase = newCase;
    after(() => sendSignupEmail(createdUser));
    // One combined "new signup + case" email and bell notification for the admins
    after(() => notifyAdminsOfNewSignup({ user: createdUser, caseDoc: createdCase }));

    return NextResponse.json(
      {
        message: 'Registration and case submission successful! Your account is pending admin approval.',
        case: serializeCase(newCase),
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('❌ Signup-with-case error:', error);
    console.error('Error stack:', error.stack);

    // Roll back a half-finished signup so the doctor can simply try again,
    // instead of being stuck with "An account with this email already exists".
    if (newUser) {
      try {
        if (newCase) await prisma.case.delete({ where: { id: newCase.id } });
        await prisma.user.delete({ where: { id: newUser.id } });
        console.log('↩️  Rolled back partially created signup for', newUser.email);
      } catch (rollbackError) {
        console.error('Rollback after failed signup also failed:', rollbackError);
      }
    }

    if (error?.message === 'invalid_grant' || error?.response?.data?.error === 'invalid_grant') {
      console.error(
        '   ↳ GOOGLE_REFRESH_TOKEN is expired or revoked. Generate a new one by visiting /api/auth/google.'
      );
    }

    return NextResponse.json(
      {
        message: 'Server error. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}