import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';

const MAX_LIMIT = 50;

/**
 * GET /api/admin/notifications?limit=20
 * Admin: latest notifications for the navbar bell, plus the unread count.
 */
export async function GET(req) {
  try {
    const { error } = await requireUser(req, ['admin']);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), MAX_LIMIT);

    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.adminNotification.count({ where: { isRead: false } }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('List admin notifications error:', error);
    return NextResponse.json({ message: 'Server error. Please try again.' }, { status: 500 });
  }
}
