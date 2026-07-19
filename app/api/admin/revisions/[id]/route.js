import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { serializeRevision } from '@/app/lib/serialize';
import driveService from '@/app/lib/googleDrive';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };
const VALID_STATUSES = ['pending', 'in-progress', 'delivered', 'completed', 'hold'];

/**
 * PATCH /api/admin/revisions/[id]
 * Admin: change a revision's status, put it on hold (requires a reason),
 * unassign its designer (back to 'pending'), or assign a designer. Mirrors
 * /api/admin/cases/[id].
 */
export async function PATCH(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const revisionId = Number(id);
    const body = await req.json();

    // Assign (or re-assign) a designer — mirrors the admin case flow.
    if (body.designerId !== undefined) {
      const designerId = Number(body.designerId);

      const revisionDoc = await prisma.revision.findUnique({
        where: { id: revisionId },
        select: { id: true, status: true },
      });
      if (!revisionDoc) {
        return NextResponse.json({ message: 'Revision not found' }, { status: 404 });
      }

      if (designerId) {
        const designer = await prisma.user.findUnique({
          where: { id: designerId },
          select: { id: true, role: true },
        });
        if (!designer || designer.role !== 'designer') {
          return NextResponse.json({ message: 'Selected user is not a designer' }, { status: 400 });
        }
      }

      const data = { pickedById: designerId || null };
      if (designerId && revisionDoc.status === 'pending') {
        data.status = 'in-progress';
      }

      const updated = await prisma.revision.update({
        where: { id: revisionId },
        data,
        include: { doctor: { select: REF_SELECT }, pickedBy: { select: REF_SELECT } },
      });
      return NextResponse.json(serializeRevision(updated));
    }

    const data = {};
    if (body.unassign) {
      data.pickedById = null;
      data.status = 'pending';
    } else if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
      }
      data.status = body.status;
      if (body.status === 'hold') {
        if (!body.holdReason || !String(body.holdReason).trim()) {
          return NextResponse.json({ message: 'A reason is required to put a revision on hold' }, { status: 400 });
        }
        data.holdReason = String(body.holdReason).trim();
      } else {
        data.holdReason = null;
      }
    }

    // Payment flag — the admin marks whether the doctor has paid for this revision.
    if (typeof body.paid === 'boolean') {
      data.paid = body.paid;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }

    let updated;
    try {
      updated = await prisma.revision.update({
        where: { id: revisionId },
        data,
        include: { doctor: { select: REF_SELECT }, pickedBy: { select: REF_SELECT } },
      });
    } catch (e) {
      if (e.code === 'P2025') {
        return NextResponse.json({ message: 'Revision not found' }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(serializeRevision(updated));
  } catch (error) {
    console.error('Admin PATCH revision error:', error);
    return NextResponse.json({ message: 'Failed to update revision.' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/revisions/[id]
 * Admin: permanently delete a revision. Its Google Drive files are removed
 * (best-effort — a Drive hiccup never blocks the DB row from being deleted),
 * but the shared per-case "revisions" folder is left intact for other
 * revisions. Deleting a picked revision implicitly un-picks that designer, and
 * the case-chat auth then re-blocks them.
 */
export async function DELETE(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const revisionId = Number(id);

    const revision = await prisma.revision.findUnique({
      where: { id: revisionId },
      select: { id: true, scanFiles: true, patientImages: true },
    });
    if (!revision) {
      return NextResponse.json({ message: 'Revision not found' }, { status: 404 });
    }

    // Best-effort: clean up the revision's Drive files. Don't delete the shared
    // revisions/ folder — other revisions of the same case may still use it.
    const fileIds = [];
    for (const f of revision.scanFiles || []) if (f?.id) fileIds.push(f.id);
    for (const f of revision.patientImages || []) if (f?.id) fileIds.push(f.id);
    await Promise.all(fileIds.map((fid) => driveService.deleteFile(fid)));

    await prisma.revision.delete({ where: { id: revisionId } });

    return NextResponse.json({ ok: true, deletedFiles: fileIds.length });
  } catch (error) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ message: 'Revision not found' }, { status: 404 });
    }
    console.error('Admin DELETE revision error:', error);
    return NextResponse.json({ message: 'Failed to delete revision.' }, { status: 500 });
  }
}
