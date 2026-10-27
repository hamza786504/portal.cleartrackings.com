import { NextResponse, after } from 'next/server';
import prisma from '@/app/lib/prisma';
import {
  cleanSignupDetails,
  googleUserData,
  resolveSignupName,
  verifyGoogleCredential,
} from '@/app/lib/googleSignIn';
import { sendSignupEmail } from '@/app/lib/mailer';
import { notifyAdminsOfNewSignup } from '@/app/lib/adminNotify';
import { buildLoginResponse } from '@/app/lib/loginSession';

const ROLES = ['doctor', 'designer'];
const PASSWORD_ACCOUNT_MESSAGE =
  'This email is registered with a password. Please log in with your email and password instead.';

function findAccount(google) {
  return prisma.user.findFirst({
    where: { OR: [{ googleId: google.googleId }, { email: google.email }] },
  });
}

async function handleSignup(google, role, body) {
  const existing = await findAccount(google);
  if (existing) {
    return NextResponse.json(
      {
        message:
          existing.authProvider === 'google'
            ? 'You have already signed up with this Google account. Please log in with Google.'
            : PASSWORD_ACCOUNT_MESSAGE,
      },
      { status: 409 }
    );
  }

  const { details, error } = cleanSignupDetails(role, body.details);
  if (error) return NextResponse.json({ message: error }, { status: 400 });

  const { firstName, lastName } = resolveSignupName(body.fullName, google);
  const newUser = await prisma.user.create({
    data: await googleUserData({ google, role, firstName, lastName, details }),
  });

  after(() => sendSignupEmail(newUser));
  after(() => notifyAdminsOfNewSignup({ user: newUser }));

  return NextResponse.json(
    {
      message:
        'Registration successful! Your account is pending admin approval. You will be able to log in with Google once approved.',
    },
    { status: 201 }
  );
}

async function handleLogin(google, role, req) {
  const user = await findAccount(google);

  if (!user) {
    return NextResponse.json(
      { message: `No ${role} account is linked to this Google account. Please sign up first.` },
      { status: 404 }
    );
  }
  if (user.authProvider !== 'google') {
    return NextResponse.json({ message: PASSWORD_ACCOUNT_MESSAGE }, { status: 409 });
  }
  // Email matched but a different Google account — never let it in
  if (user.googleId && user.googleId !== google.googleId) {
    return NextResponse.json({ message: 'Invalid Google account for this user.' }, { status: 401 });
  }
  if (user.role !== role) {
    return NextResponse.json(
      {
        message: ROLES.includes(user.role)
          ? `This Google account is registered as a ${user.role}. Please use the ${user.role} login page.`
          : 'Access denied.',
      },
      { status: 403 }
    );
  }
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

  return buildLoginResponse(user, req);
}

/**
 * POST /api/auth/google-account
 * "Sign up / Sign in with Google" for doctors and designers.
 * Body: { credential, role: 'doctor'|'designer', mode: 'signup'|'login', fullName?, details? }
 * (A doctor signing up with Google AND a first case goes through
 * /api/auth/signup-with-case with a googleCredential field instead.)
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { credential, mode, role } = body;

    if ((mode !== 'signup' && mode !== 'login') || !ROLES.includes(role)) {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }

    const google = await verifyGoogleCredential(credential);
    if (!google) {
      return NextResponse.json(
        { message: 'Google sign-in failed or expired. Please try again.' },
        { status: 401 }
      );
    }

    return mode === 'signup'
      ? await handleSignup(google, role, body)
      : await handleLogin(google, role, req);
  } catch (error) {
    // Two signups for the same email/Google account racing each other
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { message: 'An account with this email already exists. Please log in instead.' },
        { status: 409 }
      );
    }
    console.error('Google account auth error:', error);
    return NextResponse.json({ message: 'Server error. Please try again.' }, { status: 500 });
  }
}
