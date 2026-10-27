import { NextResponse, after } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { notifyAdminsOfCaseFilesUpdated } from '@/app/lib/adminNotify';
import { notifyDesignersOfCaseFilesUpdated } from '@/app/lib/userNotify';
import { serializeCase } from '@/app/lib/serialize';
import driveService from '@/app/lib/googleDrive';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

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
 * PATCH /api/cases/[id]/files
 * Doctor edits a case's scan files and patient images. Expects multipart:
 *   scanFiles / patientImages          -> new files to add (uploaded to Drive)
 *   removeScanFiles / removePatientImages -> Drive file ids to remove
 * Only the owning doctor may edit, and only until the case is completed
 * (after that, changes go through a revision). The admins and the designer
 * working on the case (or every eligible designer while it's unpicked) are
 * notified; the doctor is not.
 */
export async function PATCH(req, { params }) {
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
        scanFiles: true,
        patientImages: true,
        googleDriveFolderId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Case not found' }, { status: 404 });
    }
    if (String(existing.doctorId) !== decoded.userId) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    if (existing.status === 'completed') {
      return NextResponse.json(
        { message: 'This case is completed. Create a revision to send new scans or pictures.' },
        { status: 409 }
      );
    }

    const formData = await req.formData();
    const scanFilesRaw = [];
    const patientImagesRaw = [];
    const removeScanIds = new Set();
    const removeImageIds = new Set();

    for (const [key, value] of formData.entries()) {
      if (key === 'scanFiles' && value instanceof File) scanFilesRaw.push(value);
      else if (key === 'patientImages' && value instanceof File) patientImagesRaw.push(value);
      else if (key === 'removeScanFiles') removeScanIds.add(String(value));
      else if (key === 'removePatientImages') removeImageIds.add(String(value));
    }

    const currentScans = Array.isArray(existing.scanFiles) ? existing.scanFiles : [];
    const currentImages = Array.isArray(existing.patientImages) ? existing.patientImages : [];
    const removedScans = currentScans.filter((f) => removeScanIds.has(String(f.id)));
    const removedImages = currentImages.filter((f) => removeImageIds.has(String(f.id)));

    if (
      scanFilesRaw.length === 0 &&
      patientImagesRaw.length === 0 &&
      removedScans.length === 0 &&
      removedImages.length === 0
    ) {
      return NextResponse.json({ message: 'No changes to save.' }, { status: 400 });
    }

    const [scanFileBuffers, patientImageBuffers] = await Promise.all([
      Promise.all(scanFilesRaw.map(toBufferObj)),
      Promise.all(patientImagesRaw.map(toBufferObj)),
    ]);

    // Unlike case creation, a Drive failure here fails the request: the
    // doctor explicitly asked to add these files, so silently dropping them
    // would be worse than asking them to retry.
    const folderId = existing.googleDriveFolderId || null;
    let addedScans = [];
    let addedImages = [];
    try {
      [addedScans, addedImages] = await Promise.all([
        scanFileBuffers.length > 0 ? driveService.uploadMultipleFiles(scanFileBuffers, folderId) : Promise.resolve([]),
        patientImageBuffers.length > 0 ? driveService.uploadMultipleFiles(patientImageBuffers, folderId) : Promise.resolve([]),
      ]);
    } catch (uploadErr) {
      console.error('Case file edit upload failed:', uploadErr?.message || uploadErr);
      return NextResponse.json(
        { message: 'Failed to upload files. Please try again.' },
        { status: 502 }
      );
    }

    const updated = await prisma.case.update({
      where: { id: caseId },
      data: {
        scanFiles: [...currentScans.filter((f) => !removeScanIds.has(String(f.id))), ...addedScans],
        patientImages: [...currentImages.filter((f) => !removeImageIds.has(String(f.id))), ...addedImages],
      },
      include: { pickedBy: { select: REF_SELECT }, doctor: { select: REF_SELECT } },
    });

    // Removed files are no longer referenced; clean them out of Drive.
    after(() => Promise.all([...removedScans, ...removedImages].map((f) => driveService.deleteFile(f.id))));

    const changes = {
      addedScans: addedScans.length,
      removedScans: removedScans.length,
      addedImages: addedImages.length,
      removedImages: removedImages.length,
    };
    after(() => notifyAdminsOfCaseFilesUpdated({ caseId, changes }));
    after(() => notifyDesignersOfCaseFilesUpdated({ caseId, changes }));

    return NextResponse.json({ message: 'Files updated', case: serializeCase(updated) });
  } catch (error) {
    console.error('Update case files error:', error);
    return NextResponse.json(
      { message: 'Failed to update files. Please try again.' },
      { status: 500 }
    );
  }
}
