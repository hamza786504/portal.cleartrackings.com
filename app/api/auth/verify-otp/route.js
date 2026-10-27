import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  RESET_ROLES,
  normalizeEmail,
  otpMatches,
  signResetToken,
} from '@/app/lib/passwordReset';

const INVALID_MESSAGE = 'This code is invalid or has expired. Please request a new one.';

async function clearOtp(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { resetOtpHash: null, resetOtpExpiresAt: null, resetOtpAttempts: 0 },
  });
}

/**
 * POST /api/auth/verify-otp
 * Step 2 of the reset flow: checks the emailed OTP. On success the OTP is
 * consumed and a short-lived reset token is returned for step 3.
 */
export async function POST(req) {
  try {
    const { email, role, otp } = await req.json();
    const code = typeof otp === 'string' ? otp.trim() : '';

    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
      return NextResponse.json(
        { message: `Please enter the ${OTP_LENGTH}-digit code from your email.` },
        { status: 400 }
      );
    }
    if (!RESET_ROLES.includes(role)) {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });

    if (
      !user ||
      user.role !== role ||
      !user.resetOtpHash ||
      !user.resetOtpExpiresAt ||
      new Date(user.resetOtpExpiresAt).getTime() < Date.now()
    ) {
      return NextResponse.json({ message: INVALID_MESSAGE }, { status: 400 });
    }

    // Count the attempt atomically before checking the code, so parallel
    // requests can't get more than OTP_MAX_ATTEMPTS guesses.
    const counted = await prisma.user.updateMany({
      where: {
        id: user.id,
        resetOtpHash: user.resetOtpHash,
        resetOtpAttempts: { lt: OTP_MAX_ATTEMPTS },
      },
      data: { resetOtpAttempts: { increment: 1 } },
    });
    if (counted.count === 0) {
      await clearOtp(user.id);
      return NextResponse.json(
        { message: 'Too many incorrect attempts. Please request a new code.' },
        { status: 429 }
      );
    }

    if (!otpMatches(user.id, code, user.resetOtpHash)) {
      const attemptsLeft = OTP_MAX_ATTEMPTS - (user.resetOtpAttempts + 1);
      if (attemptsLeft <= 0) {
        await clearOtp(user.id);
        return NextResponse.json(
          { message: 'Too many incorrect attempts. Please request a new code.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          message: `Incorrect code. You have ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`,
        },
        { status: 400 }
      );
    }

    // Consume the OTP — only one request can succeed with a given code
    const consumed = await prisma.user.updateMany({
      where: { id: user.id, resetOtpHash: user.resetOtpHash },
      data: { resetOtpHash: null, resetOtpExpiresAt: null, resetOtpAttempts: 0 },
    });
    if (consumed.count === 0) {
      return NextResponse.json({ message: INVALID_MESSAGE }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Code verified. You can now set a new password.',
      resetToken: signResetToken(user),
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
