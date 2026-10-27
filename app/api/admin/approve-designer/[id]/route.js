import { NextResponse, after } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { sendAccountApprovedEmail } from '@/app/lib/mailer';
import { loginUrlFor } from '@/app/lib/appUrl';

/**
 * PUT /api/admin/approve-designer/[id]
 * Approves a designer account. Only accessible by admin.
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

    if (user.role !== 'designer') {
      return NextResponse.json({ message: 'User is not a designer' }, { status: 400 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { isApproved: true } });

    // Only email on the actual change, so a repeated click doesn't send it twice
    if (!user.isApproved) {
      after(() => sendAccountApprovedEmail(user, { loginUrl: loginUrlFor(user.role) }));
    }

    return NextResponse.json({ message: 'Designer approved successfully' });
  } catch (error) {
    console.error('Approve designer error:', error);
    return NextResponse.json(
      { message: 'Server error.' },
      { status: 500 }
    );
  }
}
