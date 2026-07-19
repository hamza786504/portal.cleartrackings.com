import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { serializeCase } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };
const MAX_PAGE_SIZE = 50;

/**
 * GET /api/admin/doctors/[id]/cases
 * Admin: get cases for a specific doctor with pagination.
 * Query params: ?page=N&limit=N (default page=1, limit=20)
 * Returns { cases, total, page, pageSize, totalPages }
 */
export async function GET(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const doctorId = Number(id);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(MAX_PAGE_SIZE, parseInt(searchParams.get('limit') || '20', 10));

    // Verify doctor exists
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
      select: { id: true, role: true },
    });
    if (!doctor || doctor.role !== 'doctor') {
      return NextResponse.json({ message: 'Doctor not found' }, { status: 404 });
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where: { doctorId },
        include: { pickedBy: { select: REF_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.case.count({ where: { doctorId } }),
    ]);

    return NextResponse.json({
      cases: cases.map(serializeCase),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error('Admin GET doctor cases error:', error);
    return NextResponse.json({ message: 'Failed to fetch cases.' }, { status: 500 });
  }
}