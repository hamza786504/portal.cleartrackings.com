import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { serializeCase, omit } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * GET /api/cases/[id]
 * Doctor: returns a single case by ID, only if the requesting doctor owns it.
 * Designer: any authenticated designer can view any case (mirrors the "All
 *   Cases" browse behavior), but doctor-identifying fields (doctorId,
 *   practiceName) are never included in the response.
 */
export async function GET(req, { params }) {
  try {
    const { decoded, user, error } = await requireUser(req, ['doctor', 'designer']);
    if (error) return error;

    const { id } = await params;
    const caseId = Number(id);

    if (decoded.role === 'doctor') {
      const caseDoc = await prisma.case.findUnique({
        where: { id: caseId },
        include: { pickedBy: { select: REF_SELECT }, doctor: { select: REF_SELECT } },
      });

      if (!caseDoc) {
        return NextResponse.json({ message: 'Case not found' }, { status: 404 });
      }

      // Ensure the requesting doctor owns this case
      if (String(caseDoc.doctorId) !== decoded.userId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json(serializeCase(caseDoc));
    }

    // decoded.role === 'designer'
    // Fetch all needed fields in ONE query instead of two separate queries.
    const caseDoc = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        pickedBy: { select: REF_SELECT },
        doctor: { select: { isSuspended: true } },
      },
    });
    if (!caseDoc) {
      return NextResponse.json({ message: 'Case not found' }, { status: 404 });
    }

    // Allowed if this designer already picked it, or the admin has granted
    // them access to this case's (non-suspended) doctor.
    const alreadyPicked = caseDoc.pickedById != null && String(caseDoc.pickedById) === decoded.userId;
    if (!alreadyPicked) {
      const isAllowed =
        !caseDoc.doctor.isSuspended &&
        (user.allowedDoctors || []).some((docId) => String(docId) === String(caseDoc.doctorId));
      if (!isAllowed) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json(omit(serializeCase(caseDoc), ['doctorId', 'practiceName']));
  } catch (error) {
    console.error('GET case error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch case.' },
      { status: 500 }
    );
  }
}
