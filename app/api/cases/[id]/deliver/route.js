import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';
import { serializeCase, omit } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * PATCH /api/cases/[id]/deliver
 * Submits the finished design link for a case. Only the designer who
 * picked the case may submit — enforced atomically via the update filter.
 * The link is then visible to admin, doctor, and designer alike.
 * Status moves to 'delivered' (not 'completed') — the case only becomes
 * 'completed' once the doctor approves it via /api/cases/[id]/approve.
 */
export async function PATCH(req, { params }) {
  try {
    const { decoded, error } = await requireUser(req, ['designer']);
    if (error) return error;

    const { designLink } = await req.json();
    if (!designLink || !designLink.trim()) {
      return NextResponse.json(
        { message: 'A design link is required.' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const caseId = Number(id);

    const result = await prisma.case.updateMany({
      where: { id: caseId, pickedById: Number(decoded.userId) },
      data: { designLink: designLink.trim(), status: 'delivered', deliveredAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { message: 'Case not found or not picked by you.' },
        { status: 403 }
      );
    }

    const updated = await prisma.case.findUnique({
      where: { id: caseId },
      include: { pickedBy: { select: REF_SELECT } },
    });

    return NextResponse.json(omit(serializeCase(updated), ['doctorId', 'practiceName']));
  } catch (error) {
    console.error('Deliver case error:', error);
    return NextResponse.json(
      { message: 'Failed to submit design link.' },
      { status: 500 }
    );
  }
}
