import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';

/**
 * PATCH /api/notifications/[id]
 * Doctor/designer: mark one of their own notifications as read.
 */
export async function PATCH(req, { params }) {
  try {
    const { decoded, error } = await requireUser(req, ['doctor', 'designer']);
    if (error) return error;

    const { id } = await params;
    const notificationId = Number(id);
    if (!Number.isInteger(notificationId)) {
      return NextResponse.json({ message: 'Invalid notification id' }, { status: 400 });
    }

    // Scoped to the caller, so nobody can touch another user's notifications
    const result = await prisma.userNotification.updateMany({
      where: { id: notificationId, userId: Number(decoded.userId) },
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
