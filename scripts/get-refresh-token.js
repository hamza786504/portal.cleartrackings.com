/**
 * One-time helper to mint GOOGLE_REFRESH_TOKEN for the Drive OAuth flow.
 *
 * Why this instead of the OAuth Playground?
 *   The Playground forces the redirect URI https://developers.google.com/oauthplayground,
 *   which keeps triggering redirect_uri_mismatch. This script uses a LOCAL loopback
 *   redirect that we register ourselves, so the URI matches exactly.
 *
 * SETUP (once):
 *   1. Google Cloud Console -> APIs & Services -> Credentials
 *   2. Create Credentials -> OAuth client ID -> Application type: "Web application"
 *   3. Under "Authorized redirect URIs" add EXACTLY:
 *          http://localhost:5555/oauth2callback
 *   4. Save. Copy the Client ID and Client secret into .env.local:
 *          GOOGLE_CLIENT_ID=...
 *          GOOGLE_CLIENT_SECRET=...
 *
 * RUN:
 *   node scripts/get-refresh-token.js
 *   -> it prints a URL. Open it, sign in with the 200GB Gmail, click Allow.
 *   -> the script captures the code, exchanges it, and prints your refresh token.
 *   -> paste that into .env.local as GOOGLE_REFRESH_TOKEN and restart the app.
 */
require('dotenv').config({ path: '.env.local' });
const http = require('http');
const { google } = require('googleapis');

// Redirect URI must EXACTLY match one registered on the OAuth client.
// Override via GOOGLE_OAUTH_REDIRECT_URI in .env.local to reuse a URI you
// already have registered (must be an http://localhost[:port][/path] URI).
const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5555/oauth2callback';
const REDIRECT_URL = new URL(REDIRECT_URI);
const PORT = Number(REDIRECT_URL.port) || 80;
const CALLBACK_PATH = REDIRECT_URL.pathname || '/';
const SCOPE = 'https://www.googleapis.com/auth/drive';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('\n❌ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing in .env.local.\n');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // always return a refresh_token
  scope: [SCOPE],
});

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith(CALLBACK_PATH)) {
    res.writeHead(404).end('Not found');
    return;
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');

  if (err) {
    res.writeHead(400).end('Auth error: ' + err);
    console.error('\n❌ Authorization failed:', err, '\n');
    server.close();
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>✅ Success. You can close this tab and return to the terminal.</h2>');
    console.log('\n============================================================');
    if (tokens.refresh_token) {
      console.log('✅ REFRESH TOKEN (add to .env.local as GOOGLE_REFRESH_TOKEN):\n');
      console.log(tokens.refresh_token);
    } else {
      console.log('⚠️ No refresh_token returned. Revoke access at');
      console.log('   https://myaccount.google.com/permissions and run this again.');
    }
    console.log('============================================================\n');
  } catch (e) {
    res.writeHead(500).end('Token exchange failed: ' + e.message);
    console.error('\n❌ Token exchange failed:', e.message, '\n');
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('\nRedirect URI registered must be EXACTLY:');
  console.log('  ' + REDIRECT_URI);
  console.log('\n👉 Open this URL in your browser and sign in with the 200GB Gmail:\n');
  console.log(authUrl + '\n');
});
