import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';

/**
 * PATCH /api/admin/users/[id]/suspend
 * Admin: suspend or unsuspend a doctor or designer account.
 * Body: { suspended: boolean }
 *
 * Suspending a doctor blocks their login and hides their cases from
 * designers' browse/pick list (enforced live via isSuspended, no case
 * rows are touched — reversible by unsuspending).
 *
 * Suspending a designer additionally frees up any case they currently have
 * in progress (pickedBy cleared, status reset to 'pending') so another
 * designer can pick it up — they can't keep working on cases while suspended.
 * Cases already 'delivered' (awaiting doctor approval) or 'completed' are
 * left untouched — the design work is done, so there's nothing to reassign.
 */
export async function PATCH(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { suspended } = await req.json();

    if (typeof suspended !== 'boolean') {
      return NextResponse.json({ message: 'suspended must be a boolean' }, { status: 400 });
    }

    const userId = Number(id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    if (user.role !== 'doctor' && user.role !== 'designer') {
      return NextResponse.json({ message: 'Only doctors and designers can be suspended' }, { status: 400 });
    }

    const updated = await prisma.user.update({ where: { id: userId }, data: { isSuspended: suspended } });

    if (suspended && user.role === 'designer') {
      await prisma.case.updateMany({
        where: { pickedById: userId, status: { notIn: ['delivered', 'completed'] } },
        data: { pickedById: null, status: 'pending' },
      });
    }

    return NextResponse.json({
      message: suspended ? 'User suspended' : 'User unsuspended',
      user: { id: String(updated.id), isSuspended: updated.isSuspended },
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    return NextResponse.json({ message: 'Failed to update suspension status.' }, { status: 500 });
  }
}
