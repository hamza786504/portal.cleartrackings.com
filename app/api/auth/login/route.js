import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/app/lib/prisma';
import { verifyRecaptcha } from '@/app/lib/recaptcha';
import { buildLoginResponse } from '@/app/lib/loginSession';

export async function POST(req) {
  try {
    const { email, password, recaptchaToken } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    const captchaValid = await verifyRecaptcha(recaptchaToken);
    if (!captchaValid) {
      return NextResponse.json(
        { message: 'reCAPTCHA verification failed. Please try again.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Accounts created with Google have no usable password
    if (user.authProvider === 'google') {
      return NextResponse.json(
        {
          message: 'This account was created with Google. Please use "Sign in with Google" to log in.',
          authProvider: 'google',
        },
        { status: 400 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Only doctors and designers are allowed to log in here
    if (user.role !== 'doctor' && user.role !== 'designer') {
      return NextResponse.json(
        { message: 'Access denied. This portal is for doctors and designers only.' },
        { status: 403 }
      );
    }

    // Must be approved by admin before logging in
    if (!user.isApproved) {
      return NextResponse.json(
        { message: 'Your account is pending admin approval. You will be notified once approved.' },
        { status: 403 }
      );
    }

    if (user.isSuspended) {
      return NextResponse.json(
        { message: 'Your account has been suspended by the admin.' },
        { status: 403 }
      );
    }

    return await buildLoginResponse(user, req);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
