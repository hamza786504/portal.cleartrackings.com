import { NextResponse, after } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/app/lib/prisma';
import { sendPasswordChangedEmail } from '@/app/lib/mailer';
import {
  RESET_ROLES,
  resetTokenMatchesPassword,
  verifyResetToken,
} from '@/app/lib/passwordReset';

const EXPIRED_MESSAGE = 'Your reset session has expired. Please start again.';

/**
 * POST /api/auth/reset-password
 * Step 3 of the reset flow: exchanges the reset token from /verify-otp for a
 * new password. The token works once — it's tied to the old password hash.
 */
export async function POST(req) {
  try {
    const { resetToken, password } = await req.json();

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const payload = verifyResetToken(resetToken);
    if (!payload) {
      return NextResponse.json({ message: EXPIRED_MESSAGE }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (
      !user ||
      user.authProvider === 'google' ||
      !RESET_ROLES.includes(user.role) ||
      !resetTokenMatchesPassword(payload, user.password)
    ) {
      return NextResponse.json({ message: EXPIRED_MESSAGE }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Matching on the old hash makes the token single-use even under concurrent requests
    const updated = await prisma.user.updateMany({
      where: { id: user.id, password: user.password },
      data: {
        password: hashedPassword,
        passwordResetRequested: false,
        resetOtpHash: null,
        resetOtpExpiresAt: null,
        resetOtpAttempts: 0,
      },
    });
    if (updated.count === 0) {
      return NextResponse.json({ message: EXPIRED_MESSAGE }, { status: 400 });
    }

    after(() => sendPasswordChangedEmail(user));

    return NextResponse.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
