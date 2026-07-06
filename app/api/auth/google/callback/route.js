import { NextResponse } from 'next/server';
import driveService from '@/app/lib/googleDrive';

/**
 * GET /api/auth/google/callback
 * Receives the OAuth redirect from Google, exchanges the code for tokens,
 * and displays the refresh token so it can be copied into
 * GOOGLE_REFRESH_TOKEN in .env.local. This is a one-time manual step —
 * the refresh token does not expire (unless revoked) and is reused for
 * every future case upload.
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ message: `Google denied access: ${error}` }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ message: 'Missing authorization code' }, { status: 400 });
  }

  try {
    const tokens = await driveService.getAccessToken(code);

    if (!tokens.refresh_token) {
      return new NextResponse(
        `<p>No refresh token was returned — Google only issues one the first time you consent for a given app+account, or when the request forces prompt=consent.</p>
         <p>Revoke this app's access at <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a> and try again at <a href="/api/auth/google">/api/auth/google</a>.</p>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new NextResponse(
      `<h2>Google Drive connected</h2>
       <p>Copy this value into <code>.env.local</code> as <code>GOOGLE_REFRESH_TOKEN</code>, then restart the server:</p>
       <pre style="background:#f4f4f4;padding:12px;border-radius:6px;user-select:all;">${tokens.refresh_token}</pre>
       <p>You can close this tab afterwards.</p>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.json({ message: 'Failed to exchange code for tokens.' }, { status: 500 });
  }
}
