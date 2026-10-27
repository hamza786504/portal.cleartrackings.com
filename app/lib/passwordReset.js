import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
const RESET_TOKEN_EXPIRY = '15m';

export const RESET_ROLES = ['doctor', 'designer'];

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.toLowerCase().trim() : '';
}

/** Cryptographically secure numeric OTP, e.g. "048213". */
export function generateOtp() {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

/**
 * OTPs are never stored in plain text. The hash is keyed with the server
 * secret and bound to the user id, so a leaked DB row can't be brute-forced
 * offline or replayed against another account.
 */
export function hashOtp(userId, otp) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${userId}:${otp}`)
    .digest('hex');
}

export function otpMatches(userId, otp, storedHash) {
  if (!storedHash || typeof otp !== 'string') return false;
  const a = Buffer.from(hashOtp(userId, otp), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Ties a reset token to the password it was issued for: once the password
// changes, every outstanding reset token for that account stops working.
function passwordFingerprint(passwordHash) {
  return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

/** Short-lived token proving the OTP was verified; exchanged for a new password. */
export function signResetToken(user) {
  return jwt.sign(
    { sub: String(user.id), purpose: 'password-reset', pwd: passwordFingerprint(user.password) },
    process.env.JWT_SECRET,
    { expiresIn: RESET_TOKEN_EXPIRY }
  );
}

/**
 * Returns the token payload if the signature, expiry and purpose are valid, else null.
 * Callers must also check resetTokenMatchesPassword() against the user's current password.
 */
export function verifyResetToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose !== 'password-reset' || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export function resetTokenMatchesPassword(payload, passwordHash) {
  return payload?.pwd === passwordFingerprint(passwordHash);
}
