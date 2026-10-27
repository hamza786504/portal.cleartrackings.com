import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';

/**
 * PATCH /api/admin/notifications/[id]
 * Admin: mark a single notification as read.
 */
export async function PATCH(req, { params }) {
  try {
    const { error } = await requireUser(req, ['admin']);
    if (error) return error;

    const { id } = await params;
    const notificationId = Number(id);
    if (!Number.isInteger(notificationId)) {
      return NextResponse.json({ message: 'Invalid notification id' }, { status: 400 });
    }

    const result = await prisma.adminNotification.updateMany({
      where: { id: notificationId },
      data: { isRead: true },
    });
    if (result.count === 0) {
      return NextResponse.json({ message: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return NextResponse.json({ message: 'Server error. Please try again.' }, { status: 500 });
  }
}
