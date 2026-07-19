import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { serializeCase, computeRevisionStatus } from '@/app/lib/serialize';
import { cascadeDeleteCase } from '@/app/lib/caseDelete';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };
const VALID_STATUSES = ['pending', 'in-progress', 'delivered', 'completed', 'hold'];

/**
 * GET /api/admin/cases/[id]
 * Admin: full case detail, unredacted.
 */
export async function GET(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const caseDoc = await prisma.case.findUnique({
      where: { id: Number(id) },
      include: { doctor: { select: REF_SELECT }, pickedBy: { select: REF_SELECT } },
    });

    if (!caseDoc) {
      return NextResponse.json({ message: 'Case not found' }, { status: 404 });
    }

    // A reopened case (with revisions) should surface the latest revision's
    // status to the admin instead of the parent case's "completed" status.
    const revisions = await prisma.revision.findMany({
      where: { caseId: Number(id) },
      select: { status: true, createdAt: true },
    });
    const obj = serializeCase(caseDoc);
    const revisionStatus = computeRevisionStatus(revisions);
    if (revisionStatus) obj.revisionStatus = revisionStatus;

    return NextResponse.json(obj);
  } catch (error) {
    console.error('Admin GET case error:', error);
    return NextResponse.json({ message: 'Failed to fetch case.' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/cases/[id]
 * Admin: change a case's status, and/or unassign its designer (send it
 * back to 'pending' so another designer can pick it up).
 * Body: { status?: 'pending'|'in-progress'|'delivered'|'completed', unassign?: true }
 */
export async function PATCH(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Assign (or re-assign) the case to a designer. When assigning to a
    // pending case we mirror the designer "pick" flow and move it to
    // 'in-progress' so the status machine stays consistent.
    if (body.designerId !== undefined) {
      const designerId = Number(body.designerId);

      const caseDoc = await prisma.case.findUnique({
        where: { id: Number(id) },
        select: { id: true, status: true },
      });
      if (!caseDoc) {
        return NextResponse.json({ message: 'Case not found' }, { status: 404 });
      }

      if (designerId) {
        // Verify the chosen user is actually a designer.
        const designer = await prisma.user.findUnique({
          where: { id: designerId },
          select: { id: true, role: true },
        });
        if (!designer || designer.role !== 'designer') {
          return NextResponse.json(
            { message: 'Selected user is not a designer' },
            { status: 400 }
          );
        }
      }

      const data = { pickedById: designerId || null };
      if (designerId && caseDoc.status === 'pending') {
        data.status = 'in-progress';
      }

      const updated = await prisma.case.update({
        where: { id: Number(id) },
        data,
        include: { doctor: { select: REF_SELECT }, pickedBy: { select: REF_SELECT } },
      });

      return NextResponse.json(serializeCase(updated));
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
      // Putting a case on hold requires a reason from the admin; clearing the
      // hold (any other status) drops any previous reason.
      if (body.status === 'hold') {
        if (!body.holdReason || !String(body.holdReason).trim()) {
          return NextResponse.json(
            { message: 'A reason is required to put a case on hold' },
            { status: 400 }
          );
        }
        data.holdReason = String(body.holdReason).trim();
      } else {
        data.holdReason = null;
      }
    }

    // Payment flag — the admin marks whether the doctor has paid for this case.
    if (typeof body.paid === 'boolean') {
      data.paid = body.paid;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }

    let updated;
    try {
      updated = await prisma.case.update({
        where: { id: Number(id) },
        data,
        include: { doctor: { select: REF_SELECT }, pickedBy: { select: REF_SELECT } },
      });
    } catch (e) {
      if (e.code === 'P2025') {
        return NextResponse.json({ message: 'Case not found' }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(serializeCase(updated));
  } catch (error) {
    console.error('Admin PATCH case error:', error);
    return NextResponse.json({ message: 'Failed to update case.' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/cases/[id]
 * Admin only. Removes the case AND everything tied to it (chat messages,
 * chat/scan/patient Drive files, the case Drive folder). See
 * cascadeDeleteCase for the full cascade.
 */
export async function DELETE(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await cascadeDeleteCase(id);
    if (!result.found) {
      return NextResponse.json({ message: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Case deleted', deletedAttachments: result.deletedAttachments });
  } catch (error) {
    console.error('Admin DELETE case error:', error);
    return NextResponse.json({ message: 'Failed to delete case.' }, { status: 500 });
  }
}
