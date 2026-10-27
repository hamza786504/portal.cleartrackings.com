import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

/**
 * Verifies a Google Identity Services ID token (the `credential` returned by
 * the "Sign in with Google" button). Checks Google's signature, expiry,
 * issuer and that the token was issued for OUR client id, so a token minted
 * for some other website can't be replayed here.
 *
 * Returns { googleId, email, firstName, lastName } or null if invalid.
 */
export async function verifyGoogleCredential(credential) {
  const audience = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!audience) {
    console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set; Google sign-in is disabled.');
    return null;
  }
  if (typeof credential !== 'string' || !credential) return null;

  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) return null;

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase().trim(),
      firstName: payload.given_name || payload.name || '',
      lastName: payload.family_name || '',
    };
  } catch (error) {
    console.error('Google ID token verification failed:', error?.message || error);
    return null;
  }
}

const ROLE_DETAIL_FIELDS = {
  doctor: ['businessName', 'businessAddress', 'contactNumber', 'specialInstructions'],
  designer: ['businessName', 'contactNumber', 'specialInstructions'],
};
const REQUIRED_DETAIL_FIELDS = {
  doctor: ['businessName', 'businessAddress', 'contactNumber'],
  designer: ['businessName', 'contactNumber'],
};
const FIELD_LABELS = {
  businessName: 'Business name',
  businessAddress: 'Business address',
  contactNumber: 'Contact number',
};

/**
 * Validates the profile details a Google signup still has to type in
 * (Google only provides the name and email). Returns { details } or { error }.
 */
export function cleanSignupDetails(role, raw = {}) {
  const details = {};
  for (const field of ROLE_DETAIL_FIELDS[role]) {
    details[field] = typeof raw[field] === 'string' ? raw[field].trim() : '';
  }
  const missing = REQUIRED_DETAIL_FIELDS[role].filter((f) => !details[f]);
  if (missing.length) {
    return { error: `${missing.map((f) => FIELD_LABELS[f]).join(', ')} ${missing.length > 1 ? 'are' : 'is'} required` };
  }
  if (!/^[0-9+\-\s()]+$/.test(details.contactNumber)) {
    return { error: 'Please enter a valid contact number' };
  }
  return { details };
}

/** Name typed on the form wins; otherwise fall back to the Google profile name. */
export function resolveSignupName(typedName, google) {
  const parts = typeof typedName === 'string' && typedName.trim() ? typedName.trim().split(/\s+/) : [];
  return {
    firstName: parts[0] || google.firstName,
    lastName: (parts.length ? parts.slice(1).join(' ') : google.lastName) || '',
  };
}

/**
 * Prisma `data` for a new Google account. Google accounts never log in with a
 * password; the column is required, so it holds the hash of a random secret
 * nobody knows — it can never match.
 */
export async function googleUserData({ google, role, firstName, lastName, details }) {
  return {
    email: google.email,
    password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
    authProvider: 'google',
    googleId: google.googleId,
    role,
    firstName,
    lastName,
    isApproved: false,
    ...(role === 'doctor' ? { doctorDetails: details } : { designerDetails: details }),
  };
}
