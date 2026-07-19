import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/auth/forgot-password
 * Doctor/designer: request a password reset. We flag the account so the admin
 * sees it in the management list and can generate a new password. We never
 * reveal whether the email matches an account (avoids user enumeration).
 */
export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (user && (user.role === 'doctor' || user.role === 'designer')) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetRequested: true },
      });
    }

    // Always the same generic message regardless of whether an account exists.
    return NextResponse.json({
      message:
        'If an account exists for this email, the admin has been notified to reset your password.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
