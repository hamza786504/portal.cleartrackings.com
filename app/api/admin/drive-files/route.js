import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import driveService from '@/app/lib/googleDrive';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * Recursively sum the byte size of every file living under `rootId`, walking
 * the parent->child adjacency built from the flat `all` list. Folders carry a
 * null size in Drive, so only actual files contribute; folders are pushed onto
 * the stack so their descendants are still counted.
 */
function computeFolderSize(rootId, all) {
  if (!rootId) return 0;
  const childrenMap = new Map();
  for (const f of all) {
    for (const p of f.parents || []) {
      if (!childrenMap.has(p)) childrenMap.set(p, []);
      childrenMap.get(p).push(f);
    }
  }

  let total = 0;
  const stack = [rootId];
  const guard = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (guard.has(id)) continue;
    guard.add(id);
    for (const child of childrenMap.get(id) || []) {
      if (child.size) total += child.size;
      if (child.mimeType === FOLDER_MIME) stack.push(child.id);
    }
  }
  return total;
}

/**
 * GET /api/admin/drive-files
 * Admin: list the "orphaned" Drive files — files the app created that are
 * NOT attached to any case. Case-related files (and their folders) are
 * computed from the DB and filtered out so they can never appear here.
 *
 * Also returns:
 *  - caseRelatedSize: total bytes consumed by case-attached content (for the
 *    space-usage pie chart), and
 *  - doctorPortal: a read-only summary of the Doctor Portal root folder
 *    (GOOGLE_DRIVE_FOLDER_ID) — its id, name, and the recursive size of all
 *    files beneath it. This folder is intentionally excluded from `files` so
 *    it can never be browsed, selected, or deleted here.
 */
export async function GET(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 1) Build the set of Drive ids that ARE tied to cases.
    //    Mirrors the collection logic in app/lib/caseDelete.js.
    const caseRelatedIds = new Set();

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
      if (c.googleDriveFolderId) caseRelatedIds.add(c.googleDriveFolderId);
      if (c.chatFolderId) caseRelatedIds.add(c.chatFolderId);
      if (c.revisionsFolderId) caseRelatedIds.add(c.revisionsFolderId);
      for (const f of c.scanFiles || []) if (f?.id) caseRelatedIds.add(f.id);
      for (const f of c.patientImages || []) if (f?.id) caseRelatedIds.add(f.id);
    }

    // Revision files live inside each case's "revisions" subfolder and are
    // referenced from the revisions table — exclude them from the orphan list.
    const revisions = await prisma.revision.findMany({
      select: { scanFiles: true, patientImages: true },
    });
    for (const r of revisions) {
      for (const f of r.scanFiles || []) if (f?.id) caseRelatedIds.add(f.id);
      for (const f of r.patientImages || []) if (f?.id) caseRelatedIds.add(f.id);
    }

    const messages = await prisma.message.findMany({ select: { attachments: true } });
    for (const m of messages) {
      for (const a of m.attachments || []) if (a?.id) caseRelatedIds.add(a.id);
    }

    // 2) Pull every app-visible file from Drive.
    const all = await driveService.listAllFiles();

    // The Doctor Portal root folder is shown as a disabled summary node only.
    const doctorPortalId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    let doctorPortalName = 'Doctor Portal';
    if (doctorPortalId) {
      const rootMeta = await driveService.getFile(doctorPortalId);
      if (rootMeta?.name) doctorPortalName = rootMeta.name;
    }

    const isCaseRelated = (f) =>
      caseRelatedIds.has(f.id) || f.parents.some((p) => caseRelatedIds.has(p));

    // 3) Keep only orphans: not the Doctor Portal root itself, not a case file,
    //    and not inside a case folder. Folders ARE included (the file-explorer
    //    UI browses them) — only case-attached ones and the root are excluded.
    const files = all.filter((f) => {
      if (doctorPortalId && f.id === doctorPortalId) return false;
      if (isCaseRelated(f)) return false;
      return true;
    });

    const orphanSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const caseRelatedSize = all
      .filter((f) => f.id !== doctorPortalId && isCaseRelated(f))
      .reduce((sum, f) => sum + (f.size || 0), 0);
    const doctorPortalSize = computeFolderSize(doctorPortalId, all);

    return NextResponse.json({
      files,
      count: files.length,
      totalSize: orphanSize,
      caseRelatedSize,
      doctorPortal: doctorPortalId
        ? { id: doctorPortalId, name: doctorPortalName, size: doctorPortalSize }
        : null,
    });
  } catch (error) {
    console.error('Drive files list error:', error);
    return NextResponse.json({ message: 'Failed to fetch Drive files.' }, { status: 500 });
  }
}
