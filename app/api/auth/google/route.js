import { NextResponse } from 'next/server';
import driveService from '@/app/lib/googleDrive';

/**
 * GET /api/auth/google
 * One-time setup step: visit this URL in a browser, sign in with the
 * Google account whose Drive should receive case uploads, and approve
 * access. Google then redirects to /api/auth/google/callback with a
 * refresh token to paste into .env.local.
 */
export async function GET() {
  return NextResponse.redirect(driveService.getAuthUrl());
}
