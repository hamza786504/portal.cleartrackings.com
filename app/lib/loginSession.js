import { NextResponse, after } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/app/lib/prisma';
import { sendLoginEmail } from '@/app/lib/mailer';

/**
 * Builds the response for a successful doctor/designer login (email+password
 * or Google): signs the JWT, sends the login alert email, and decides whether
 * to show the one-time welcome banner.
 *
 * The welcome banner shows on the very first login only. The flag is flipped
 * here, so a second login never shows it, whether or not it was closed.
 */
export async function buildLoginResponse(user, req) {
  let showWelcome = false;
  if (!user.hasSeenWelcome) {
    // Only one concurrent first login can flip the flag
    const flipped = await prisma.user.updateMany({
      where: { id: user.id, hasSeenWelcome: false },
      data: { hasSeenWelcome: true },
    });
    showWelcome = flipped.count === 1;
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

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip');
  const userAgent = req.headers.get('user-agent');
  after(() => sendLoginEmail(user, { ip, userAgent }));

  return NextResponse.json({
    token,
    user: {
      id: String(user.id),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      isApproved: user.isApproved,
      authProvider: user.authProvider,
      doctorDetails: user.doctorDetails,
      designerDetails: user.designerDetails,
      showWelcome,
    },
  });
}
