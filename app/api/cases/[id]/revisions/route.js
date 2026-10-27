import { NextResponse, after } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { notifyDesignersOfNewRevision } from '@/app/lib/userNotify';
import { notifyAdminsOfCaseEvent } from '@/app/lib/adminNotify';
import { serializeRevision, omit } from '@/app/lib/serialize';
import driveService from '@/app/lib/googleDrive';

const PICKED_BY_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * Convert a Web API File into the buffer object the Drive uploader expects.
 */
async function toBufferObj(file) {
  const arrayBuffer = await file.arrayBuffer();
  return {
    originalname: file.name,
    mimetype: file.type || 'application/octet-stream',
    buffer: Buffer.from(arrayBuffer),
  };
}

/**
 * POST /api/cases/[id]/revisions
 * Doctor creates a revision on a COMPLETED case. Captures only 3 things:
 * scan files, patient images/xray, and a special note. Files upload into the
 * parent case's existing Drive folder (root fallback), mirroring case creation.
 */
export async function POST(req, { params }) {
  try {
    const { decoded, error } = await requireUser(req, ['doctor']);
    if (error) return error;

    const { id } = await params;
    const caseId = Number(id);

    const existing = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        doctorId: true,
        status: true,
        patientName: true,
        caseFolderName: true,
        googleDriveFolderId: true,
        chatFolderId: true,
        revisionsFolderId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Case not found' }, { status: 404 });
    }
    if (String(existing.doctorId) !== decoded.userId) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    if (existing.status !== 'completed') {
      return NextResponse.json(
        { message: 'Revisions can only be created on completed cases.' },
        { status: 409 }
      );
    }

    // Parse multipart form: scanFiles, patientImages (files) + specialNote (text)
    const formData = await req.formData();
    const scanFilesRaw = [];
    const patientImagesRaw = [];
    let specialNote = '';

    for (const [key, value] of formData.entries()) {
      if (key === 'scanFiles' && value instanceof File) {
        scanFilesRaw.push(value);
      } else if (key === 'patientImages' && value instanceof File) {
        patientImagesRaw.push(value);
      } else if (key === 'specialNote') {
        specialNote = value.toString();
      }
    }

    if (scanFilesRaw.length === 0 && patientImagesRaw.length === 0 && !specialNote.trim()) {
      return NextResponse.json(
        { message: 'Add at least one scan file, patient image, or a special note.' },
        { status: 400 }
      );
    }

    const [scanFileBuffers, patientImageBuffers] = await Promise.all([
      Promise.all(scanFilesRaw.map(toBufferObj)),
      Promise.all(patientImagesRaw.map(toBufferObj)),
    ]);

    // Resolve the Drive folder for revision files: a per-case "revisions"
    // subfolder (sibling of "chat"). Create it lazily on first use; for old
    // cases that predate case-folder creation, build the whole layout and
    // persist it. A Drive failure must NOT block the revision from being
    // created — mirror the resilient behavior of case creation.
    let revisionsFolderId = existing.revisionsFolderId || null;
    if (!revisionsFolderId) {
      try {
        if (existing.googleDriveFolderId) {
          revisionsFolderId = await driveService.ensureRevisionsSubfolder(existing.googleDriveFolderId);
        } else {
          const folderName =
            existing.caseFolderName ||
            `${new Date().toISOString().slice(0, 10)} - ${existing.patientName}`;
          const info = await driveService.ensureCaseFolders(folderName);
          revisionsFolderId = info.revisionsFolderId;
          await prisma.case.update({
            where: { id: caseId },
            data: {
              googleDriveFolderId: info.caseFolderId,
              caseFolderName: info.caseFolderName,
              chatFolderId: info.chatFolderId,
              revisionsFolderId: info.revisionsFolderId,
            },
          });
        }
        // Persist the lazily-created revisions folder so it's reused next time.
        await prisma.case.update({
          where: { id: caseId },
          data: { revisionsFolderId },
        });
      } catch (folderErr) {
        // Drive may be unavailable (e.g. expired token). Don't block the
        // revision — it's still created; files simply won't have a folder yet
        // and will land in the revisions/ folder on the next revision once
        // Drive recovers (the folder is created lazily on first success).
        console.error(
          'Revision Drive folder setup failed (revision will still be created):',
          folderErr?.message || folderErr
        );
        revisionsFolderId = null;
      }
    }
    let scanFiles = [];
    let patientImages = [];
    try {
      [scanFiles, patientImages] = await Promise.all([
        scanFileBuffers.length > 0 ? driveService.uploadMultipleFiles(scanFileBuffers, revisionsFolderId) : Promise.resolve([]),
        patientImageBuffers.length > 0 ? driveService.uploadMultipleFiles(patientImageBuffers, revisionsFolderId) : Promise.resolve([]),
      ]);
    } catch (uploadErr) {
      const driveReason =
        uploadErr?.errors?.[0]?.reason ||
        uploadErr?.response?.data?.error?.errors?.[0]?.reason ||
        uploadErr?.response?.data?.error?.status ||
        uploadErr?.cause?.message ||
        null;
      console.error('Revision file upload failed (revision will still be created):', uploadErr?.message || uploadErr);
      if (driveReason) console.error('   ↳ Drive/auth reason:', driveReason);
    }

    const revision = await prisma.revision.create({
      data: {
        caseId,
        doctorId: Number(decoded.userId),
        scanFiles,
        patientImages,
        specialNote: specialNote.trim() || null,
        status: 'pending',
      },
      include: { pickedBy: { select: PICKED_BY_SELECT }, doctor: { select: PICKED_BY_SELECT } },
    });

    // Bell notification + email to the designers who can pick it up
    after(() => notifyDesignersOfNewRevision({ revision, patientName: existing.patientName }));
    after(() => notifyAdminsOfCaseEvent('revision_requested', { caseId: revision.caseId, revisionId: revision.id }));

    return NextResponse.json(
      { message: 'Revision created successfully', revision: serializeRevision(revision) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create revision error:', error);
    return NextResponse.json(
      { message: 'Failed to create revision. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cases/[id]/revisions
 * Lists a case's revisions. Doctor: only the owning doctor. Designer: allowed
 * for this case's (non-suspended) doctor, or if they picked a revision here.
 * Admin: any case. doctorId/practiceName are redacted for designer & admin.
 */
export async function GET(req, { params }) {
  try {
    const { decoded, user, error } = await requireUser(req, ['doctor', 'designer', 'admin']);
    if (error) return error;

    const { id } = await params;
    const caseId = Number(id);

    const caseDoc = await prisma.case.findUnique({
      where: { id: caseId },
      select: { doctorId: true, doctor: { select: { isSuspended: true } } },
    });
    if (!caseDoc) {
      return NextResponse.json({ message: 'Case not found' }, { status: 404 });
    }

    if (decoded.role === 'doctor') {
      if (String(caseDoc.doctorId) !== decoded.userId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    } else if (decoded.role === 'designer') {
      const alreadyPicked = await prisma.revision.findFirst({
        where: { caseId, pickedById: Number(decoded.userId) },
        select: { id: true },
      });
      const isAllowed =
        !caseDoc.doctor?.isSuspended &&
        (user.allowedDoctors || []).some((docId) => String(docId) === String(caseDoc.doctorId));
      if (!alreadyPicked && !isAllowed) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    }
    // admin: no extra check

    const revisions = await prisma.revision.findMany({
      where: { caseId },
      include: { pickedBy: { select: PICKED_BY_SELECT } },
      orderBy: { createdAt: 'desc' },
    });

    const redact = decoded.role !== 'doctor';
    const finalize = (r) => (redact ? omit(serializeRevision(r), ['doctorId']) : serializeRevision(r));

    return NextResponse.json(revisions.map(finalize));
  } catch (error) {
    console.error('GET revisions error:', error);
    return NextResponse.json({ message: 'Failed to fetch revisions.' }, { status: 500 });
  }
}
