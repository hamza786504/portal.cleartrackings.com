import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { serializeDesigner } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * GET /api/admin/designers
 * Admin: list every designer account (approved and pending), with the
 * doctors they're currently allowed to see populated.
 */
export async function GET(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const designers = await prisma.user.findMany({
      where: { role: 'designer' },
      include: { permissionsAsDesigner: { include: { doctor: { select: REF_SELECT } } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(designers.map(serializeDesigner));
  } catch (error) {
    console.error('Admin GET designers error:', error);
    return NextResponse.json({ message: 'Failed to fetch designers.' }, { status: 500 });
  }
}
