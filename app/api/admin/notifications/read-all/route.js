import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';

/**
 * POST /api/admin/notifications/read-all
 * Admin: mark every notification as read.
 */
export async function POST(req) {
  try {
    const { error } = await requireUser(req, ['admin']);
    if (error) return error;

    await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return NextResponse.json({ message: 'Server error. Please try again.' }, { status: 500 });
  }
}
