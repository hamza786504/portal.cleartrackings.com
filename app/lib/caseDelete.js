import prisma from '@/app/lib/prisma';
import driveService from '@/app/lib/googleDrive';

/**
 * Delete a single case AND everything tied to it:
 *   - every chat message on the case (doctor/designer/admin conversation)
 *   - every Google Drive file referenced by those messages' attachments
 *   - the case's scan files & patient images, and the case's Drive folder
 *     (so Drive storage stays clean rather than accumulating orphans).
 *
 * The Drive deletions are best-effort — a Drive hiccup never blocks the DB
 * deletion of the case and its messages.
 *
 * Returns { found, deletedAttachments } so callers can report results.
 */
export async function cascadeDeleteCase(caseId) {
  const id = Number(caseId);
  if (!Number.isInteger(id)) return { found: false, deletedAttachments: 0 };

  const caseDoc = await prisma.case.findUnique({
    where: { id },
    select: {
      id: true,
      googleDriveFolderId: true,
      revisionsFolderId: true,
      scanFiles: true,
      patientImages: true,
    },
  });
  if (!caseDoc) return { found: false, deletedAttachments: 0 };

  // Collect every Drive file id related to this case.
  const fileIds = new Set();
  for (const f of caseDoc.scanFiles || []) if (f?.id) fileIds.add(f.id);
  for (const f of caseDoc.patientImages || []) if (f?.id) fileIds.add(f.id);
  const msgs = await prisma.message.findMany({ where: { caseId: id }, select: { attachments: true } });
  for (const m of msgs) {
    for (const a of m.attachments || []) if (a?.id) fileIds.add(a.id);
  }
  // Revision files live in the per-case "revisions" subfolder.
  const revs = await prisma.revision.findMany({
    where: { caseId: id },
    select: { scanFiles: true, patientImages: true },
  });
  for (const r of revs) {
    for (const f of r.scanFiles || []) if (f?.id) fileIds.add(f.id);
    for (const f of r.patientImages || []) if (f?.id) fileIds.add(f.id);
  }

  // Remove the Drive files first (best-effort), then the case + revisions folders.
  await Promise.all([...fileIds].map((fid) => driveService.deleteFile(fid)));
  if (caseDoc.googleDriveFolderId) {
    await driveService.deleteFile(caseDoc.googleDriveFolderId);
  }
  if (caseDoc.revisionsFolderId) {
    await driveService.deleteFile(caseDoc.revisionsFolderId);
  }

  // Messages reference the case via a RESTRICT FK, so drop them explicitly
  // before the case row.
  await prisma.message.deleteMany({ where: { caseId: id } });
  await prisma.case.delete({ where: { id } });

  return { found: true, deletedAttachments: fileIds.size };
}
