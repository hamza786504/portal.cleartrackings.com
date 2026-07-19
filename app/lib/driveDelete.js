import prisma from '@/app/lib/prisma';
import driveService from '@/app/lib/googleDrive';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * The set of Drive ids tied to cases — same logic as the GET list. Shared so
 * delete safety checks can't drift from what the list shows.
 */
export async function getCaseRelatedIds() {
  const ids = new Set();

  const cases = await prisma.case.findMany({
    select: {
      scanFiles: true,
      patientImages: true,
      googleDriveFolderId: true,
      chatFolderId: true,
      revisionsFolderId: true,
    },
  });
  for (const c of cases) {
    if (c.googleDriveFolderId) ids.add(c.googleDriveFolderId);
    if (c.chatFolderId) ids.add(c.chatFolderId);
    if (c.revisionsFolderId) ids.add(c.revisionsFolderId);
    for (const f of c.scanFiles || []) if (f?.id) ids.add(f.id);
    for (const f of c.patientImages || []) if (f?.id) ids.add(f.id);
  }

  // Revision files live inside each case's "revisions" subfolder and are
  // referenced from the revisions table — treat them as case-related so the
  // Drive Manager never lists them as orphans or lets them be deleted.
  const revisions = await prisma.revision.findMany({
    select: { scanFiles: true, patientImages: true },
  });
  for (const r of revisions) {
    for (const f of r.scanFiles || []) if (f?.id) ids.add(f.id);
    for (const f of r.patientImages || []) if (f?.id) ids.add(f.id);
  }

  const messages = await prisma.message.findMany({ select: { attachments: true } });
  for (const m of messages) {
    for (const a of m.attachments || []) if (a?.id) ids.add(a.id);
  }

  return ids;
}

function isCaseRelated(file, caseRelatedIds) {
  if (caseRelatedIds.has(file.id)) return true;
  if (file.parents && file.parents.some((p) => caseRelatedIds.has(p))) return true;
  return false;
}

/**
 * The set of Drive folder ids that belong to cases (each case's own folder plus
 * its `chat` subfolder). Used to keep these folders reserved for case content
 * and to stop the admin file manager from writing non-case files into them.
 */
export async function getCaseFolderIds() {
  const ids = new Set();
  const cases = await prisma.case.findMany({
    select: { googleDriveFolderId: true, chatFolderId: true, revisionsFolderId: true },
  });
  for (const c of cases) {
    if (c.googleDriveFolderId) ids.add(c.googleDriveFolderId);
    if (c.chatFolderId) ids.add(c.chatFolderId);
    if (c.revisionsFolderId) ids.add(c.revisionsFolderId);
  }
  return ids;
}

/**
 * Recursively gather every deletable descendant id of a folder, skipping any
 * branch that belongs to a case. Returns { ids, blocked } where `blocked`
 * indicates a case-related item was encountered and deliberately left alone.
 */
async function collectDescendants(folderId, caseRelatedIds, seen) {
  const collected = [];
  let blocked = false;
  const children = await driveService.listFilesInFolder(folderId);

  for (const child of children) {
    if (seen.has(child.id)) continue;
    seen.add(child.id);

    // Never descend into or delete case content.
    if (isCaseRelated(child, caseRelatedIds)) {
      blocked = true;
      continue;
    }

    collected.push(child.id);
    if (child.mimeType === FOLDER_MIME) {
      const sub = await collectDescendants(child.id, caseRelatedIds, seen);
      collected.push(...sub.ids);
      if (sub.blocked) blocked = true;
    }
  }

  return { ids: collected, blocked };
}

/**
 * Delete a single Drive item. If it's a folder, all of its (non-case)
 * contents are deleted first — recursively, deepest-first — then the folder
 * itself, exactly like a file explorer's delete. Case content is never
 * touched, even if it lives inside the folder being deleted.
 *
 * Returns { ok, missing?, blocked?, error? }.
 */
export async function deleteDriveItemRecursive(id, caseRelatedIds) {
  const file = await driveService.getFile(id);
  // Missing from Drive → nothing to do; report success rather than error.
  if (!file) return { ok: true, missing: true };

  // Refuse to delete anything attached to a case.
  if (isCaseRelated(file, caseRelatedIds)) {
    return { ok: false, blocked: true, error: 'Belongs to a case' };
  }

  if (file.mimeType === FOLDER_MIME) {
    const { ids, blocked } = await collectDescendants(id, caseRelatedIds, new Set());

    // Delete children first (deepest-first isn't required by Drive, but keeps
    // the folder non-empty only momentarily).
    for (const childId of ids) {
      await driveService.deleteFile(childId);
    }

    const deleted = await driveService.deleteFile(id);
    return {
      ok: deleted,
      blocked: blocked || !deleted,
      error: deleted ? null : 'Delete failed',
    };
  }

  const deleted = await driveService.deleteFile(id);
  return { ok: deleted, error: deleted ? null : 'Delete failed' };
}

/**
 * Bulk delete a list of Drive item ids with the same recursive, case-safe
 * semantics as deleteDriveItemRecursive. Returns { success, failed, blocked }.
 */
export async function bulkDeleteDriveItems(ids, caseRelatedIds) {
  const success = [];
  const failed = [];
  const blocked = [];

  for (const id of ids) {
    const res = await deleteDriveItemRecursive(id, caseRelatedIds);
    if (res.ok) success.push(id);
    else if (res.blocked) blocked.push(id);
    else failed.push({ id, error: res.error });
  }

  return { success, failed, blocked };
}
