import { NextResponse, after } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/app/lib/prisma';
import { verifyToken, generateTemporaryPassword } from '@/app/lib/auth';
import { sendAdminPasswordResetEmail } from '@/app/lib/mailer';

/**
 * POST /api/admin/users/[id]/reset-password
 * Admin: generate a brand-new password for a doctor or designer.
 *
 * SECURITY: the plaintext password is generated here, returned to the caller
 * exactly ONCE, and is NEVER written to the database — only its bcrypt hash is
 * stored. That makes it physically impossible for the admin (or anyone) to
 * retrieve the password a second time. The admin UI shows it in a one-time
 * modal; once closed, it is gone for good. Re-clicking "Reset Password" would
 * only ever produce a different new password, never the old one.
 */
export async function POST(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = Number(id);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    if (user.role !== 'doctor' && user.role !== 'designer') {
      return NextResponse.json(
        { message: 'Only doctors and designers can have their password reset here.' },
        { status: 400 }
      );
    }

    if (user.authProvider === 'google') {
      return NextResponse.json(
        { message: 'This user signs in with Google, so there is no password to reset.' },
        { status: 400 }
      );
    }

    const plainPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordResetRequested: false },
    });

    // Tell the user their password changed; the new password itself is never emailed
    after(() => sendAdminPasswordResetEmail(user));

    return NextResponse.json({
      message: 'Password reset. Share this with the user now — it will never be shown again.',
      password: plainPassword,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { message: 'Failed to reset password.' },
      { status: 500 }
    );
  }
}
