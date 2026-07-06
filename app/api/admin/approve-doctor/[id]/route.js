import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';

/**
 * PUT /api/admin/approve-doctor/[id]
 * Approves a doctor account. Only accessible by admin.
 */
export async function PUT(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'doctor') {
      return NextResponse.json({ message: 'User is not a doctor' }, { status: 400 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { isApproved: true } });

    return NextResponse.json({ message: 'Doctor approved successfully' });
  } catch (error) {
    console.error('Approve doctor error:', error);
    return NextResponse.json(
      { message: 'Server error.' },
      { status: 500 }
    );
  }
}
