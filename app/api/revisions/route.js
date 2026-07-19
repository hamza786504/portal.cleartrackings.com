import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { serializeRevision, omit } from '@/app/lib/serialize';

const PICKED_BY_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * GET /api/revisions
 * Designer: lists revisions available to work on, scoped like the case list:
 *   scope=mine      -> every revision this designer has picked
 *   scope=all       -> every revision whose case belongs to a doctor the admin
 *                       granted this designer access to (active doctors only)
 *   scope=completed -> revisions this designer picked that are approved
 * doctorId/practiceName are redacted — designers see only what they need.
 */
export async function GET(req) {
  try {
    const { decoded, user, error } = await requireUser(req, ['designer']);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'all';

    // Resolve the set of case ids this designer may see (active doctors only).
    const allowedIds = user.allowedDoctors || [];
    const activeDoctors = await prisma.user.findMany({
      where: { id: { in: allowedIds }, isSuspended: { not: true } },
      select: { id: true },
    });
    const allowedCaseIds = (
      await prisma.case.findMany({
        where: { doctorId: { in: activeDoctors.map((d) => d.id) } },
        select: { id: true },
      })
    ).map((c) => c.id);

    let where;
    if (scope === 'mine') {
      where = { pickedById: Number(decoded.userId) };
    } else if (scope === 'completed') {
      where = { pickedById: Number(decoded.userId), status: 'completed' };
    } else {
      where = { caseId: { in: allowedCaseIds } };
    }

    const revisions = await prisma.revision.findMany({
      where,
      include: {
        pickedBy: { select: PICKED_BY_SELECT },
        case: { select: { id: true, patientName: true, practiceName: true, doctorId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const finalize = (r) => {
      const obj = omit(serializeRevision(r), ['doctorId']);
      // Surface the parent case so the designer UI can show which case it belongs to.
      obj.case = r.case
        ? { _id: String(r.case.id), patientName: r.case.patientName, practiceName: r.case.practiceName }
        : null;
      return obj;
    };

    return NextResponse.json(revisions.map(finalize));
  } catch (error) {
    console.error('GET revisions error:', error);
    return NextResponse.json({ message: 'Failed to fetch revisions.' }, { status: 500 });
  }
}
