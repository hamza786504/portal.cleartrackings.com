import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requireUser } from '@/app/lib/auth';

const MAX_LIMIT = 50;

/**
 * GET /api/notifications?limit=20
 * Doctor/designer: the logged-in user's latest notifications + unread count.
 */
export async function GET(req) {
  try {
    const { decoded, error } = await requireUser(req, ['doctor', 'designer']);
    if (error) return error;

    const userId = Number(decoded.userId);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), MAX_LIMIT);

    const [notifications, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, type: true, title: true, message: true, link: true, isRead: true, createdAt: true },
      }),
      prisma.userNotification.count({ where: { userId, isRead: false } }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('List notifications error:', error);
    return NextResponse.json({ message: 'Server error. Please try again.' }, { status: 500 });
  }
}
