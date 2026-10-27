const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MAX_TOKEN_LENGTH = 4096;

/**
 * Verifies a reCAPTCHA token with Google.
 *
 * - Skipped only in local development (NODE_ENV !== 'production'). This is
 *   decided by the server environment, never by request headers, so a client
 *   can't bypass it by spoofing Host or similar headers.
 * - In production it fails closed: a missing secret, missing/invalid token,
 *   network error or timeout all reject the login.
 * - If RECAPTCHA_ALLOWED_HOSTNAMES is set (comma-separated), the hostname
 *   Google reports for the solved challenge must match one of them, so tokens
 *   solved on another site using the same key are rejected.
 */
export async function verifyRecaptcha(token) {
  if (process.env.NODE_ENV !== 'production') return true;

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.error('RECAPTCHA_SECRET_KEY is not set; rejecting login.');
    return false;
  }

  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) {
    return false;
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return false;

    const data = await res.json();
    if (data.success !== true) return false;

    const allowedHosts = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (allowedHosts.length && !allowedHosts.includes(String(data.hostname).toLowerCase())) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}
