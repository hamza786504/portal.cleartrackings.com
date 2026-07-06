import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * Verify a JWT from the Authorization: Bearer <token> header.
 * Returns the decoded payload or null if invalid/missing.
 */
export function verifyToken(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Verify the token AND re-check the user against the database — catches
 * accounts suspended by an admin after the token was issued (a JWT alone
 * can't know about that; this is what forces suspended sessions out).
 * Returns { decoded, user } on success, or { error: NextResponse } on failure.
 */
export async function requireUser(req, allowedRoles) {
  const decoded = verifyToken(req);
  if (!decoded || (allowedRoles && !allowedRoles.includes(decoded.role))) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({ where: { id: Number(decoded.userId) } });
  if (!user) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }
  if (user.isSuspended) {
    return {
      error: NextResponse.json(
        { message: 'Your account has been suspended by the admin.', suspended: true },
        { status: 403 }
      ),
    };
  }

  // Mirrors Mongoose's User.allowedDoctors — only meaningful for designers,
  // consumed by routes that gate case browse/pick access.
  if (user.role === 'designer') {
    const permissions = await prisma.designerPermission.findMany({
      where: { designerId: user.id },
      select: { doctorId: true },
    });
    user.allowedDoctors = permissions.map((p) => p.doctorId);
  }

  return { decoded, user };
}

/**
 * Middleware wrapper that protects a Route Handler.
 * Attaches decoded payload to req.user and calls handler.
 */
export function protect(handler) {
  return async (req, context) => {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    req.user = decoded;
    return handler(req, context);
  };
}

/**
 * Decode a JWT token string without verifying (for client-side display).
 * Returns the payload or null.
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}