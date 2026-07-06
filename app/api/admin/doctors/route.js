import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { serializeUser } from '@/app/lib/serialize';

/**
 * GET /api/admin/doctors
 * Admin: list every doctor account (approved and pending).
 */
export async function GET(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const doctors = await prisma.user.findMany({
      where: { role: 'doctor' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(doctors.map(serializeUser));
  } catch (error) {
    console.error('Admin GET doctors error:', error);
    return NextResponse.json({ message: 'Failed to fetch doctors.' }, { status: 500 });
  }
}
