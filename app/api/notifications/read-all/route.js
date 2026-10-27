import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';

/**
 * POST /api/notifications/read-all
 * Doctor/designer: mark all of their own notifications as read.
 */
export async function POST(req) {
  try {
    const { decoded, error } = await requireUser(req, ['doctor', 'designer']);
    if (error) return error;

    await prisma.userNotification.updateMany({
      where: { userId: Number(decoded.userId), isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return NextResponse.json({ message: 'Server error. Please try again.' }, { status: 500 });
  }
}
