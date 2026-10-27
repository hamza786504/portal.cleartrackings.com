import { NextResponse, after } from 'next/server';
import prisma from '@/app/lib/prisma';
import { sendGoogleAccountResetNotice, sendPasswordResetOtpEmail } from '@/app/lib/mailer';
import {
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  RESET_ROLES,
  generateOtp,
  hashOtp,
  normalizeEmail,
} from '@/app/lib/passwordReset';

/**
 * POST /api/auth/forgot-password
 * Step 1 of the reset flow (doctor/designer): emails a 6-digit OTP.
 * The response is identical whether or not the email belongs to an account,
 * so this endpoint can't be used to discover which emails are registered.
 */
export async function POST(req) {
  try {
    const { email, role } = await req.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }
    if (!RESET_ROLES.includes(role)) {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user && user.role === role) {
      const now = Date.now();
      const sentRecently =
        user.resetOtpSentAt &&
        now - new Date(user.resetOtpSentAt).getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000;

      // Cooldown stops the endpoint being used to flood someone's inbox
      if (!sentRecently && user.authProvider === 'google') {
        // No password to reset — tell them to use Google instead of sending a code
        await prisma.user.update({
          where: { id: user.id },
          data: { resetOtpSentAt: new Date(now) },
        });
        // Link comes from config, never from request headers (Host can be spoofed)
        const appUrl = process.env.APP_URL?.replace(/\/+$/, '');
        const loginUrl = appUrl ? `${appUrl}/${role}/login` : null;
        after(() => sendGoogleAccountResetNotice(user, loginUrl));
      } else if (!sentRecently) {
        const otp = generateOtp();
        await prisma.user.update({
          where: { id: user.id },
          data: {
            resetOtpHash: hashOtp(user.id, otp),
            resetOtpExpiresAt: new Date(now + OTP_EXPIRY_MINUTES * 60 * 1000),
            resetOtpSentAt: new Date(now),
            resetOtpAttempts: 0,
          },
        });
        // Sent after the response so response time doesn't reveal whether the account exists
        after(() => sendPasswordResetOtpEmail(user, otp, OTP_EXPIRY_MINUTES));
      }
    }

    return NextResponse.json({
      message: 'If an account exists for this email, a verification code has been sent to it.',
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
