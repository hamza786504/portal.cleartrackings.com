import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { serializeCase } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * GET /api/admin/cases
 * Admin: returns every case in the system, unfiltered and unredacted.
 * Optional ?status=pending|in-progress|completed and ?doctorId=<id> filters.
 */
export async function GET(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const doctorId = searchParams.get('doctorId');

    const where = {};
    if (status && status !== 'all') where.status = status;
    if (doctorId) where.doctorId = Number(doctorId);

    const cases = await prisma.case.findMany({
      where,
      include: { doctor: { select: REF_SELECT }, pickedBy: { select: REF_SELECT } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(cases.map(serializeCase));
  } catch (error) {
    console.error('Admin GET cases error:', error);
    return NextResponse.json({ message: 'Failed to fetch cases.' }, { status: 500 });
  }
}
