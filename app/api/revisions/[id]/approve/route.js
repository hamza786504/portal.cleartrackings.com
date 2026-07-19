import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { serializeRevision } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * PATCH /api/revisions/[id]/approve
 * Doctor approves a delivered revision, moving it to 'completed'. Only the
 * owning doctor may approve, and only once a designer has delivered — enforced
 * atomically via the update filter. Mirrors /api/cases/[id]/approve.
 */
export async function PATCH(req, { params }) {
  try {
    const { decoded, error } = await requireUser(req, ['doctor']);
    if (error) return error;

    const { id } = await params;
    const revisionId = Number(id);

    const result = await prisma.revision.updateMany({
      where: { id: revisionId, doctorId: Number(decoded.userId), status: 'delivered' },
      data: { status: 'completed', approvedAt: new Date() },
    });

    if (result.count === 0) {
      const exists = await prisma.revision.findUnique({
        where: { id: revisionId },
        select: { doctorId: true, status: true },
      });
      if (!exists || String(exists.doctorId) !== decoded.userId) {
        return NextResponse.json({ message: 'Revision not found' }, { status: 404 });
      }
      return NextResponse.json(
        { message: 'This revision has no pending delivery to approve.' },
        { status: 409 }
      );
    }

    const updated = await prisma.revision.findUnique({
      where: { id: revisionId },
      include: { pickedBy: { select: REF_SELECT }, doctor: { select: REF_SELECT } },
    });

    return NextResponse.json(serializeRevision(updated));
  } catch (error) {
    console.error('Approve revision error:', error);
    return NextResponse.json({ message: 'Failed to approve revision.' }, { status: 500 });
  }
}
