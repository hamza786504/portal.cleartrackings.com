import { NextResponse, after } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { notifyDoctorOfRevisionDelivered } from '@/app/lib/userNotify';
import { notifyAdminsOfCaseEvent } from '@/app/lib/adminNotify';
import { serializeRevision, omit } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * PATCH /api/revisions/[id]/deliver
 * Designer submits the finished design link for a revision they picked.
 * Mirrors /api/cases/[id]/deliver. Status moves to 'delivered' — the revision
 * only becomes 'completed' once the doctor approves it.
 */
export async function PATCH(req, { params }) {
  try {
    const { decoded, error } = await requireUser(req, ['designer']);
    if (error) return error;

    const { designLink } = await req.json();
    if (!designLink || !designLink.trim()) {
      return NextResponse.json({ message: 'A design link is required.' }, { status: 400 });
    }

    const { id } = await params;
    const revisionId = Number(id);

    const result = await prisma.revision.updateMany({
      where: { id: revisionId, pickedById: Number(decoded.userId) },
      data: { designLink: designLink.trim(), status: 'delivered', deliveredAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { message: 'Revision not found or not picked by you.' },
        { status: 403 }
      );
    }

    // Bell notification + email to the doctor who requested the revision
    after(() => notifyDoctorOfRevisionDelivered(revisionId));
    after(() => notifyAdminsOfCaseEvent('revision_delivered', { revisionId }));

    const updated = await prisma.revision.findUnique({
      where: { id: revisionId },
      include: { pickedBy: { select: REF_SELECT } },
    });

    return NextResponse.json(omit(serializeRevision(updated), ['doctorId']));
  } catch (error) {
    console.error('Deliver revision error:', error);
    return NextResponse.json({ message: 'Failed to submit design link.' }, { status: 500 });
  }
}
