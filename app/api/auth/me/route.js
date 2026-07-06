import { NextResponse } from 'next/server';
import { requireUser } from '@/app/lib/auth';

/**
 * GET /api/auth/me
 * Lightweight session check for doctor/designer dashboards. A JWT alone
 * can't reflect an admin suspending the account after the token was issued —
 * requireUser() re-checks the DB, so this is what forces a suspended
 * session out on its next page load.
 */
export async function GET(req) {
  const { decoded, error } = await requireUser(req, ['doctor', 'designer']);
  if (error) return error;

  return NextResponse.json({
    id: decoded.userId,
    role: decoded.role,
    email: decoded.email,
  });
}
