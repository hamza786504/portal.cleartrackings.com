import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { serializeCase, omit } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * PATCH /api/cases/[id]/pick
 * Atomically claims a case for the logged-in designer.
 * The { pickedById: null } filter guarantees only one concurrent request can
 * win the race — updateMany's affected-row count tells the loser it lost.
 */
export async function PATCH(req, { params }) {
  try {
    const { decoded, user, error } = await requireUser(req, ['designer']);
    if (error) return error;

    const { id } = await params;
    const caseId = Number(id);

    const allowedIds = user.allowedDoctors || [];
    const activeDoctors = await prisma.user.findMany({
      where: { id: { in: allowedIds }, isSuspended: { not: true } },
      select: { id: true },
    });
    const allowedDoctorIds = activeDoctors.map((d) => d.id);

    const result = await prisma.case.updateMany({
      where: { id: caseId, pickedById: null, doctorId: { in: allowedDoctorIds } },
      data: { pickedById: Number(decoded.userId), status: 'in-progress' },
    });

    if (result.count === 0) {
      const exists = await prisma.case.findUnique({
        where: { id: caseId },
        select: { doctorId: true, pickedById: true },
      });
      if (!exists) {
        return NextResponse.json({ message: 'Case not found' }, { status: 404 });
      }
      const isAllowed = allowedDoctorIds.some((docId) => docId === exists.doctorId);
      if (!isAllowed) {
        return NextResponse.json(
          { message: "You don't have permission to pick cases from this doctor." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { message: 'Case is no longer available — someone else already picked it.' },
        { status: 409 }
      );
    }

    const updated = await prisma.case.findUnique({
      where: { id: caseId },
      include: { pickedBy: { select: REF_SELECT } },
    });

    return NextResponse.json(omit(serializeCase(updated), ['doctorId', 'practiceName']));
  } catch (error) {
    console.error('Pick case error:', error);
    return NextResponse.json(
      { message: 'Failed to pick case.' },
      { status: 500 }
    );
  }
}
