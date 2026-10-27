import { NextResponse, after } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { serializeCase } from '@/app/lib/serialize';
import { notifyDesignerOfApproval } from '@/app/lib/userNotify';
import { notifyAdminsOfCaseEvent } from '@/app/lib/adminNotify';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * PATCH /api/cases/[id]/approve
 * Doctor approves a delivered design, moving the case to 'completed'.
 * Only the owning doctor may approve, and only once the designer has
 * actually delivered — enforced atomically via the update filter.
 */
export async function PATCH(req, { params }) {
  try {
    const { decoded, error } = await requireUser(req, ['doctor']);
    if (error) return error;

    const { id } = await params;
    const caseId = Number(id);

    const result = await prisma.case.updateMany({
      where: { id: caseId, doctorId: Number(decoded.userId), status: 'delivered' },
      data: { status: 'completed', approvedAt: new Date() },
    });

    if (result.count === 0) {
      const exists = await prisma.case.findUnique({
        where: { id: caseId },
        select: { doctorId: true, status: true },
      });
      if (!exists || String(exists.doctorId) !== decoded.userId) {
        return NextResponse.json({ message: 'Case not found' }, { status: 404 });
      }
      return NextResponse.json(
        { message: 'This case has no pending delivery to approve.' },
        { status: 409 }
      );
    }

    // Let the designer and the admins know
    after(() => notifyDesignerOfApproval({ caseId }));
    after(() => notifyAdminsOfCaseEvent('case_approved', { caseId }));

    const updated = await prisma.case.findUnique({
      where: { id: caseId },
      include: { pickedBy: { select: REF_SELECT }, doctor: { select: REF_SELECT } },
    });

    return NextResponse.json(serializeCase(updated));
  } catch (error) {
    console.error('Approve case error:', error);
    return NextResponse.json(
      { message: 'Failed to approve case.' },
      { status: 500 }
    );
  }
}
