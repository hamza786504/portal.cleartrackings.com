import { NextResponse, after } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { notifyAdminsOfNewCase } from '@/app/lib/adminNotify';
import { notifyDesignersOfNewCase } from '@/app/lib/userNotify';
import { serializeCase, omit, computeRevisionStatus } from '@/app/lib/serialize';
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

    // Create a dedicated Drive folder for this case named
    // "[YYYY-MM-DD] - [patient name]" and upload files into it. If the folder
    // can't be created (Drive hiccup) we fall back to the root folder and
    // still create the case so submission never fails.
    let folderInfo = { caseFolderId: null, caseFolderName: null, chatFolderId: null };
    try {
      const start = new Date();
      const ymd = start.toISOString().slice(0, 10);
      const folderName = `${ymd} - ${fields.patientName?.trim() || 'Unnamed Patient'}`;
      folderInfo = await driveService.ensureCaseFolders(folderName);
    } catch (driveErr) {
      console.error('Case Drive folder creation failed (continuing with root):', driveErr);
    }

    const caseFolderId = folderInfo.caseFolderId || null;

    // Upload scan files and patient images to Google Drive in parallel.
    // A Drive failure (auth/quota/etc.) must NOT block the case from being
    // created — mirror the resilient behavior of signup-with-case.
    let scanFiles = [];
    let patientImages = [];
    try {
      [scanFiles, patientImages] = await Promise.all([
        scanFileBuffers.length > 0 ? driveService.uploadMultipleFiles(scanFileBuffers, caseFolderId) : Promise.resolve([]),
        patientImageBuffers.length > 0 ? driveService.uploadMultipleFiles(patientImageBuffers, caseFolderId) : Promise.resolve([]),
      ]);
    } catch (uploadErr) {
      const driveReason =
        uploadErr?.errors?.[0]?.reason ||
        uploadErr?.response?.data?.error?.errors?.[0]?.reason ||
        uploadErr?.response?.data?.error?.status ||
        uploadErr?.cause?.message ||
        null;
      console.error('Case file upload failed (case will still be created):', uploadErr?.message || uploadErr);
      if (driveReason) console.error('   ↳ Drive/auth reason:', driveReason);
      // Continue with empty file arrays so the case row is still saved.
    }

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
      retainer: fields.retainer || '',
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
      googleDriveFolderId: folderInfo.caseFolderId,
      caseFolderName: folderInfo.caseFolderName,
      chatFolderId: folderInfo.chatFolderId,
      status: 'pending',
    };

    const newCase = await prisma.case.create({ data: caseData });

    // Bell notification + email for the admins, after the response is sent
    after(async () => {
      const doctor = await prisma.user.findUnique({
        where: { id: newCase.doctorId },
        select: { firstName: true, lastName: true, email: true, doctorDetails: true },
      });
      if (doctor) await notifyAdminsOfNewCase({ caseDoc: newCase, doctor });
    });
    // ...and the designers who can pick it up
    after(() => notifyDesignersOfNewCase(newCase));

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
      where = { doctorId: Number(decoded.userId) };
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

    // For designers, a reopened case (one with revisions) should display the
    // latest revision's status instead of the parent case's "completed" status.
    // Build a caseId -> effective status map once, then attach it to each row.
    const buildRevisionStatusMap = async (caseIds) => {
      const map = new Map();
      if (caseIds.length === 0) return map;
      const revs = await prisma.revision.findMany({
        where: { caseId: { in: caseIds } },
        select: { caseId: true, status: true, createdAt: true },
      });
      const grouped = new Map();
      for (const r of revs) {
        if (!grouped.has(r.caseId)) grouped.set(r.caseId, []);
        grouped.get(r.caseId).push(r);
      }
      for (const [caseId, list] of grouped) {
        const status = computeRevisionStatus(list);
        if (status) map.set(caseId, status);
      }
      return map;
    };

    const finalize = (c, revMap) => {
      const obj = serializeCase(c);
      const out = redact ? omit(obj, ['doctorId', 'practiceName']) : obj;
      if (revMap && revMap.has(c.id)) out.revisionStatus = revMap.get(c.id);
      return out;
    };

    // Doctors filter by the EFFECTIVE status — the case's own status, or the
    // latest revision's status when the case has been reopened. Resolve it in
    // memory so the status tabs stay consistent with the badge the table shows.
    if (decoded.role === 'doctor') {
      const allCases = await prisma.case.findMany({
        where,
        include: { pickedBy: { select: PICKED_BY_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      const revMap = await buildRevisionStatusMap(allCases.map((c) => c.id));
      let finalized = allCases.map((c) => finalize(c, revMap));

      const status = searchParams.get('status');
      if (status && status !== '' && status !== 'all') {
        finalized = finalized.filter((c) => (c.revisionStatus ?? c.status) === status);
      }

      if (!paginate) {
        return NextResponse.json(finalized);
      }
      const filteredTotal = finalized.length;
      const filteredPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
      const start = (page - 1) * pageSize;
      return NextResponse.json({
        cases: finalized.slice(start, start + pageSize),
        total: filteredTotal,
        page,
        pageSize,
        totalPages: filteredPages,
      });
    }

    if (!paginate) {
      // Safety cap: without pagination, limit to 500 rows to prevent a single
      // request from fetching the entire table as the dataset grows over time.
      const cases = await prisma.case.findMany({
        where,
        include: { pickedBy: { select: PICKED_BY_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      const revMap = await buildRevisionStatusMap(cases.map((c) => c.id));

      return NextResponse.json(cases.map((c) => finalize(c, revMap)));
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
    const revMap = await buildRevisionStatusMap(cases.map((c) => c.id));

    return NextResponse.json({
      cases: cases.map((c) => finalize(c, revMap)),
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
