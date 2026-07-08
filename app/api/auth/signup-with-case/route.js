import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/app/lib/prisma';
import { serializeCase } from '@/app/lib/serialize';
import driveService from '@/app/lib/googleDrive';

// Array field names that should be parsed as arrays
const ARRAY_FIELDS = [
  'impressionsTaken',
  'additionalRecords',
  'doNotMoveTeeth',
  'avoidAttachmentsTeeth',
  'teethForExtraction',
  'leaveSpacesOpen',
];

/**
 * POST /api/auth/signup-with-case
 * Creates a doctor account AND a first case in a single multipart/form-data request.
 * The doctor account is created with isApproved: false.
 * The case is created immediately regardless of approval status.
 */
export async function POST(req) {
  try {
    const formData = await req.formData();

    // ── Parse all fields ────────────────────────────────────────────────────
    const fields = {};
    const scanFilesRaw = [];
    const patientImagesRaw = [];

    for (const [key, value] of formData.entries()) {
      if (key === 'scanFiles' && value instanceof File) {
        scanFilesRaw.push(value);
      } else if (key === 'patientImages' && value instanceof File) {
        patientImagesRaw.push(value);
      } else {
        if (ARRAY_FIELDS.includes(key)) {
          if (!fields[key]) fields[key] = [];
          fields[key].push(value);
        } else {
          fields[key] = value;
        }
      }
    }

    // ── Validate account fields ─────────────────────────────────────────────
    const { email, password, firstName, lastName, businessName, businessAddress, contactNumber, specialInstructions } = fields;

    if (!email || !password || !firstName) {
      return NextResponse.json(
        { message: 'Name, email, and password are required' },
        { status: 400 }
      );
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json(
        { message: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // ── Create doctor account ───────────────────────────────────────────────
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
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

    // ── Upload files to Google Drive ────────────────────────────────────────
    const toBufferObj = async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      return {
        originalname: file.name,
        mimetype: file.type || 'application/octet-stream',
        buffer: Buffer.from(arrayBuffer),
      };
    };

    // Convert all files to buffer objects in parallel
    const [scanFileBuffers, patientImageBuffers] = await Promise.all([
      Promise.all(scanFilesRaw.map(toBufferObj)),
      Promise.all(patientImagesRaw.map(toBufferObj)),
    ]);

    // Upload scan files and patient images to Google Drive in parallel
    const [scanFiles, patientImages] = await Promise.all([
      scanFileBuffers.length > 0 ? driveService.uploadMultipleFiles(scanFileBuffers) : Promise.resolve([]),
      patientImageBuffers.length > 0 ? driveService.uploadMultipleFiles(patientImageBuffers) : Promise.resolve([]),
    ]);

    // ── Create the case ─────────────────────────────────────────────────────
    const newCase = await prisma.case.create({
      data: {
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
        trimlineHeight:     fields.trimlineHeight      || '',
        retainer:           fields.retainer           || '',
        planDuration:       fields.planDuration       || '',
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
        engagers:           fields.engagers           || '',
        spaceManagement:    fields.spaceManagement    || '',
        additionalInfo:     fields.additionalInfo     || '',
        treatmentPlan:      fields.treatmentPlan      || '',
        scanFiles,
        patientImages,
        status: 'pending',
      },
    });

    return NextResponse.json(
      {
        message: 'Registration and case submission successful! Your account is pending admin approval. You will be notified once approved.',
        case: serializeCase(newCase),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup-with-case error:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
