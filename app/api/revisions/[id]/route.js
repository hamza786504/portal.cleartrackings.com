import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { serializeRevision, omit } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * GET /api/revisions/[id]
 * Single revision detail. Doctor: only the owning doctor. Designer: allowed
 * for this revision's case doctor (active) or if they picked it. Admin: any.
 * doctorId is redacted for designer/admin; the parent case (patient/practice
 * name) is included so the UI can show which case the revision belongs to.
 */
export async function GET(req, { params }) {
  try {
    const { decoded, user, error } = await requireUser(req, ['doctor', 'designer', 'admin']);
    if (error) return error;

    const { id } = await params;
    const revisionId = Number(id);

    const revision = await prisma.revision.findUnique({
      where: { id: revisionId },
      include: {
        pickedBy: { select: REF_SELECT },
        case: { select: { id: true, patientName: true, practiceName: true, doctorId: true, doctor: { select: { isSuspended: true } } } },
      },
    });
    if (!revision) {
      return NextResponse.json({ message: 'Revision not found' }, { status: 404 });
    }

    if (decoded.role === 'doctor') {
      if (String(revision.doctorId) !== decoded.userId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    } else if (decoded.role === 'designer') {
      const isPicked = revision.pickedById != null && String(revision.pickedById) === decoded.userId;
      const isAllowed =
        revision.case &&
        !revision.case.doctor?.isSuspended &&
        (user.allowedDoctors || []).some((docId) => String(docId) === String(revision.case.doctorId));
      if (!isPicked && !isAllowed) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    }

    const obj = omit(serializeRevision(revision), ['doctorId']);
    obj.case = revision.case
      ? { _id: String(revision.case.id), patientName: revision.case.patientName, practiceName: revision.case.practiceName }
      : null;

    return NextResponse.json(obj);
  } catch (error) {
    console.error('GET revision error:', error);
    return NextResponse.json({ message: 'Failed to fetch revision.' }, { status: 500 });
  }
}
