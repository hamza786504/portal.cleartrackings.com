/**
 * Links in emails are built from APP_URL, never from request headers
 * (the Host header can be forged). Returns null when APP_URL is not set.
 */
export function absoluteUrl(path) {
  const appUrl = process.env.APP_URL?.replace(/\/+$/, '');
  return appUrl ? `${appUrl}${path}` : null;
}

export function loginUrlFor(role) {
  return absoluteUrl(role === 'designer' ? '/designer/login' : '/doctor/login');
}
