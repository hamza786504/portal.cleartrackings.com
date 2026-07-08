import { NextResponse } from 'next/server';
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
 * POST /api/cases/guest
 * Create a case on behalf of a newly registered (unapproved) doctor.
 * Does NOT require a JWT — instead the caller must supply a valid `doctorId`
 * that was returned from POST /api/auth/signup moments earlier.
 * Expects multipart/form-data with all the standard case fields plus `doctorId`.
 */
export async function POST(req) {
  try {
    const formData = await req.formData();

    // Parse fields
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

    // Validate doctorId
    const doctorId = Number(fields.doctorId);
    if (!doctorId || isNaN(doctorId)) {
      return NextResponse.json({ message: 'doctorId is required' }, { status: 400 });
    }

    // Confirm the doctor record actually exists (prevents arbitrary case injection)
    const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
    if (!doctor || doctor.role !== 'doctor') {
      return NextResponse.json({ message: 'Doctor not found' }, { status: 404 });
    }

    // Convert Web API File objects to buffer objects for Google Drive
    const toBufferObj = async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      return {
        originalname: file.name,
        mimetype: file.type || 'application/octet-stream',
        buffer: Buffer.from(arrayBuffer),
      };
    };

    const scanFileBuffers = await Promise.all(scanFilesRaw.map(toBufferObj));
    const patientImageBuffers = await Promise.all(patientImagesRaw.map(toBufferObj));

    // Upload files to Google Drive
    let scanFiles = [];
    let patientImages = [];

    if (scanFileBuffers.length > 0) {
      scanFiles = await driveService.uploadMultipleFiles(scanFileBuffers);
    }
    if (patientImageBuffers.length > 0) {
      patientImages = await driveService.uploadMultipleFiles(patientImageBuffers);
    }

    // Build the case row
    const caseData = {
      doctorId,
      patientName: fields.patientName || '',
      practiceName: fields.practiceName || '',
      chiefComplaint: fields.chiefComplaint || '',
      dob: fields.dob || '',
      toothSystem: fields.toothSystem || 'FDI (recommended)',
      impressionMethod: fields.impressionMethod || '',
      impressionsTaken: fields.impressionsTaken || [],
      additionalRecords: fields.additionalRecords || [],
      treatArches: fields.treatArches || 'Both',
      velocity: fields.velocity || '0.2',
      otherVelocity: fields.otherVelocity || '',
      caseType: fields.caseType || '',
      wearSchedule: fields.wearSchedule || '',
      trimlineHeight: fields.trimlineHeight || '',
      retainer: fields.retainer || '',
      planDuration: fields.planDuration || '',
      doNotMoveTeeth: fields.doNotMoveTeeth || [],
      avoidAttachmentsTeeth: fields.avoidAttachmentsTeeth || [],
      teethForExtraction: fields.teethForExtraction || [],
      leaveSpacesOpen: fields.leaveSpacesOpen || [],
      upperMidlineValue: fields.upperMidlineValue || '',
      upperMidlineGoal: fields.upperMidlineGoal || '',
      lowerMidlineValue: fields.lowerMidlineValue || '',
      lowerMidlineGoal: fields.lowerMidlineGoal || '',
      overjetValue: fields.overjetValue || '',
      overjetGoal: fields.overjetGoal || '',
      overbiteValue: fields.overbiteValue || '',
      overbiteGoal: fields.overbiteGoal || '',
      canineRelation: fields.canineRelation || '',
      molarRelation: fields.molarRelation || '',
      anteriorCrossbite: fields.anteriorCrossbite || '',
      posteriorCrossbite: fields.posteriorCrossbite || '',
      deciduousTeeth: fields.deciduousTeeth || '',
      ipr: fields.ipr || '',
      engagers: fields.engagers || '',
      spaceManagement: fields.spaceManagement || '',
      additionalInfo: fields.additionalInfo || '',
      treatmentPlan: fields.treatmentPlan || '',
      scanFiles,
      patientImages,
      status: 'pending',
    };

    const newCase = await prisma.case.create({ data: caseData });

    return NextResponse.json(
      { message: 'Case submitted successfully', case: serializeCase(newCase) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Guest case creation error:', error);
    return NextResponse.json(
      { message: 'Failed to submit case. Please try again.' },
      { status: 500 }
    );
  }
}
