import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/app/lib/prisma';

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName, role, doctorDetails, designerDetails } = body;

    // Validate required fields
    if (!email || !password || !firstName) {
      return NextResponse.json(
        { message: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (role !== 'doctor' && role !== 'designer') {
      return NextResponse.json(
        { message: 'A valid role (doctor or designer) is required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json(
        { message: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        firstName: firstName.trim(),
        lastName: lastName ? lastName.trim() : '',
        isApproved: false, // Admin must approve before login is allowed
        ...(role === 'doctor'
          ? {
              doctorDetails: {
                businessName: doctorDetails?.businessName || '',
                businessAddress: doctorDetails?.businessAddress || '',
                contactNumber: doctorDetails?.contactNumber || '',
                specialInstructions: doctorDetails?.specialInstructions || '',
              },
            }
          : {
              designerDetails: {
                businessName: designerDetails?.businessName || '',
                contactNumber: designerDetails?.contactNumber || '',
                specialInstructions: designerDetails?.specialInstructions || '',
              },
            }),
      },
    });

    return NextResponse.json(
      {
        message:
          'Registration successful! Your account is pending admin approval. You will be able to log in once approved.',
        doctorId: newUser.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
