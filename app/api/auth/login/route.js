import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '@/app/lib/prisma';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
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

    const token = jwt.sign(
      {
        userId: String(user.id),
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({
      token,
      user: {
        id: String(user.id),
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isApproved: user.isApproved,
        doctorDetails: user.doctorDetails,
        designerDetails: user.designerDetails,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
