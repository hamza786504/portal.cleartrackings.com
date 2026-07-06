import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { serializeCase } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };
const VALID_STATUSES = ['pending', 'in-progress', 'delivered', 'completed'];

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

    return NextResponse.json(serializeCase(caseDoc));
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

    const data = {};
    if (body.unassign) {
      data.pickedById = null;
      data.status = 'pending';
    } else if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
      }
      data.status = body.status;
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
