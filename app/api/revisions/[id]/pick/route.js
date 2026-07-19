import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { serializeRevision, omit } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * PATCH /api/revisions/[id]/pick
 * Designer claims a revision atomically. Mirrors /api/cases/[id]/pick: the
 * { pickedById: null } filter guarantees only one concurrent request wins.
 */
export async function PATCH(req, { params }) {
  try {
    const { decoded, user, error } = await requireUser(req, ['designer']);
    if (error) return error;

    const { id } = await params;
    const revisionId = Number(id);

    const allowedIds = user.allowedDoctors || [];
    const activeDoctors = await prisma.user.findMany({
      where: { id: { in: allowedIds }, isSuspended: { not: true } },
      select: { id: true },
    });
    const allowedDoctorIds = activeDoctors.map((d) => d.id);

    const result = await prisma.revision.updateMany({
      where: { id: revisionId, pickedById: null, doctorId: { in: allowedDoctorIds } },
      data: { pickedById: Number(decoded.userId), status: 'in-progress' },
    });

    if (result.count === 0) {
      const exists = await prisma.revision.findUnique({
        where: { id: revisionId },
        select: { doctorId: true, pickedById: true },
      });
      if (!exists) {
        return NextResponse.json({ message: 'Revision not found' }, { status: 404 });
      }
      const isAllowed = allowedDoctorIds.some((docId) => docId === exists.doctorId);
      if (!isAllowed) {
        return NextResponse.json(
          { message: "You don't have permission to pick revisions from this doctor." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { message: 'Revision is no longer available — someone else already picked it.' },
        { status: 409 }
      );
    }

    const updated = await prisma.revision.findUnique({
      where: { id: revisionId },
      include: { pickedBy: { select: REF_SELECT } },
    });

    return NextResponse.json(omit(serializeRevision(updated), ['doctorId']));
  } catch (error) {
    console.error('Pick revision error:', error);
    return NextResponse.json({ message: 'Failed to pick revision.' }, { status: 500 });
  }
}
