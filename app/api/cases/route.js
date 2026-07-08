import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { serializeCase, omit } from '@/app/lib/serialize';
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

const PICKED_BY_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * POST /api/cases
 * Create a new case. Expects multipart/form-data.
 * Files (scanFiles, patientImages) are uploaded to Google Drive.
 * All other fields are saved to MySQL.
 */
export async function POST(req) {
  try {
    const { decoded, error } = await requireUser(req, ['doctor']);
    if (error) return error;

    // Use the Web API formData() — correct for Next.js App Router
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
        // Handle array fields — multiple entries with same key
        if (ARRAY_FIELDS.includes(key)) {
          if (!fields[key]) fields[key] = [];
          fields[key].push(value);
        } else {
          fields[key] = value;
        }
      }
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

    // Build the case row
    const caseData = {
      doctorId: Number(decoded.userId),
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
      { message: 'Case created successfully', case: serializeCase(newCase) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create case error:', error);
    return NextResponse.json(
      { message: 'Failed to create case. Please try again.' },
      { status: 500 }
    );
  }
}

const MAX_PAGE_SIZE = 50;

/**
 * GET /api/cases
 * Doctor: returns cases owned by the logged-in doctor.
 *   Optional ?status=pending|in-progress|completed filter.
 * Designer: returns cases across all doctors, doctor-identifying fields
 *   (doctorId, practiceName) stripped. ?scope=mine|all|completed (default 'all')
 *     mine      -> every case ever picked by the logged-in designer, any
 *                  status — including ones they completed in the past
 *     all       -> every case in the system, any doctor/status/picked-state
 *     completed -> cases picked by the logged-in designer that are fully
 *                  approved by the doctor
 *
 * Pagination: pass ?page=N (1-based) to page results (fixed page size —
 * capped at 50 regardless of any ?limit sent). When ?page is present the
 * response shape changes to { cases, total, page, pageSize, totalPages }.
 * Without ?page, the full matching list is returned as a plain array,
 * unchanged — dashboards rely on this to compute their own stat counts.
 */
export async function GET(req) {
  try {
    const { decoded, user, error } = await requireUser(req, ['doctor', 'designer']);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const pageParam = searchParams.get('page');
    const paginate = pageParam !== null;
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, parseInt(searchParams.get('limit'), 10) || MAX_PAGE_SIZE);

    let where;
    let redact = false;

    if (decoded.role === 'doctor') {
      const status = searchParams.get('status');

      where = { doctorId: Number(decoded.userId) };
      if (status && status !== '' && status !== 'all') {
        where.status = status;
      }
    } else {
      // decoded.role === 'designer'
      const scope = searchParams.get('scope') || 'all';
      redact = true;

      if (scope === 'mine') {
        where = { pickedById: Number(decoded.userId) };
      } else if (scope === 'completed') {
        where = { pickedById: Number(decoded.userId), status: 'completed' };
      } else {
        // 'all' — browsing/picking is restricted to doctors the admin has
        // granted this designer permission to see, and excludes doctors the
        // admin has suspended (their cases become invisible to new pickup
        // while suspended, without touching the case rows themselves).
        const allowedIds = user.allowedDoctors || [];
        const activeDoctors = await prisma.user.findMany({
          where: { id: { in: allowedIds }, isSuspended: { not: true } },
          select: { id: true },
        });
        where = { doctorId: { in: activeDoctors.map((d) => d.id) } };
      }
    }

    const finalize = (c) => {
      const obj = serializeCase(c);
      return redact ? omit(obj, ['doctorId', 'practiceName']) : obj;
    };

    if (!paginate) {
      // Safety cap: without pagination, limit to 500 rows to prevent a single
      // request from fetching the entire table as the dataset grows over time.
      const cases = await prisma.case.findMany({
        where,
        include: { pickedBy: { select: PICKED_BY_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      return NextResponse.json(cases.map(finalize));
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        include: { pickedBy: { select: PICKED_BY_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.case.count({ where }),
    ]);

    return NextResponse.json({
      cases: cases.map(finalize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error('GET cases error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch cases.' },
      { status: 500 }
    );
  }
}
