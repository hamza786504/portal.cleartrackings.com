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
 *
 * Optimization: for designer role, the user lookup and the permissions
 * lookup are run in parallel with Promise.all() instead of sequentially,
 * saving one round-trip to the database.
 *
 * Returns { decoded, user } on success, or { error: NextResponse } on failure.
 */
export async function requireUser(req, allowedRoles) {
  const decoded = verifyToken(req);
  if (!decoded || (allowedRoles && !allowedRoles.includes(decoded.role))) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  if (decoded.role === 'designer') {
    // Run user lookup and permissions lookup in parallel — saves one DB round-trip
    const [user, permissions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: Number(decoded.userId) },
        select: { id: true, role: true, isSuspended: true },
      }),
      prisma.designerPermission.findMany({
        where: { designerId: Number(decoded.userId) },
        select: { doctorId: true },
      }),
    ]);

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

    user.allowedDoctors = permissions.map((p) => p.doctorId);
    return { decoded, user };
  }

  // For doctor / admin roles — single lookup, only fetch what is needed
  const user = await prisma.user.findUnique({
    where: { id: Number(decoded.userId) },
    select: { id: true, role: true, isSuspended: true },
  });

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

/**
 * Generate a strong, random temporary password (14 chars) that mixes
 * uppercase, lowercase, digits, and symbols. Used by the admin "reset
 * password" flow — the plaintext is returned to the admin exactly once and
 * is NEVER persisted (only its bcrypt hash is stored), so it can't be
 * retrieved a second time.
 */
export function generateTemporaryPassword(length = 14) {
  const crypto = require('crypto');
  const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const LOWER = 'abcdefghijkmnopqrstuvwxyz';
  const DIGIT = '23456789';
  const SYMBOL = '!@#$%&*?';
  const ALL = UPPER + LOWER + DIGIT + SYMBOL;

  const pick = (set) => set[crypto.randomInt(0, set.length)];

  // Guarantee at least one of each character class.
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  const rest = [];
  for (let i = required.length; i < length; i++) {
    rest.push(pick(ALL));
  }

  // Shuffle so the required chars aren't always at the front.
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}