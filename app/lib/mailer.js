import nodemailer from 'nodemailer';

const APP_NAME = 'ClearTrackings';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  const port = Number(SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
  return transporter;
}

// Network-level failures that are worth retrying. Anything else (bad
// credentials, rejected recipient, …) fails straight away.
const RETRYABLE_CODES = new Set(['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNRESET', 'ECONNREFUSED', 'EDNS']);
const RETRY_DELAYS_MS = [2000, 6000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title, bodyHtml) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;font-size:20px;font-weight:bold;">${APP_NAME}</td></tr>
      <tr><td style="padding:24px 28px;font-size:15px;line-height:1.6;">
        <h2 style="margin:0 0 16px;font-size:18px;">${escapeHtml(title)}</h2>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
        ${
          process.env.MAIL_REPLY_TO
            ? `This is an automated message from ${APP_NAME}. Reply to this email if you need help.`
            : `This is an automated message from ${APP_NAME}. Please do not reply to this email.`
        }
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Sends an email. Never throws — a mail failure must not break signup/login,
 * so errors are logged and `false` is returned instead.
 */
export async function sendMail({ to, subject, html, text }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS); skipping email to', to);
    return false;
  }

  const message = {
    from: process.env.MAIL_FROM || `"${APP_NAME}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
    ...(process.env.MAIL_REPLY_TO ? { replyTo: process.env.MAIL_REPLY_TO } : {}),
  };

  // The SMTP server occasionally times out on connect; retry those a couple
  // of times. Mail is sent from after(), so retries never delay a response.
  for (let attempt = 0; ; attempt++) {
    try {
      await transport.sendMail(message);
      if (attempt > 0) console.log(`Sent "${subject}" email to ${to} after ${attempt} retr${attempt === 1 ? 'y' : 'ies'}.`);
      return true;
    } catch (error) {
      const retryable = RETRYABLE_CODES.has(error?.code);
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        console.warn(`Sending "${subject}" to ${to} failed (${error.code}); retrying...`);
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      console.error(`Failed to send "${subject}" email to ${to}:`, error?.code || '', error?.message || error);
      return false;
    }
  }
}

function displayName(user) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return user.role === 'doctor' ? `Dr. ${fullName}` : fullName;
}

export function sendSignupEmail(user) {
  const name = displayName(user);
  return sendMail({
    to: user.email,
    subject: `Welcome to ${APP_NAME} – registration received`,
    text:
      `Hello ${name},\n\n` +
      `Thank you for registering with ${APP_NAME}. Your account has been created and is now pending admin approval.\n` +
      `You will be able to log in once an administrator approves your account.\n\n` +
      `If you did not sign up, please ignore this email.\n\n— The ${APP_NAME} Team`,
    html: layout(
      'Registration received',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>Thank you for registering with ${APP_NAME}. Your account has been created and is now <strong>pending admin approval</strong>.</p>
       <p>You will be able to log in once an administrator approves your account.</p>
       <p style="color:#6b7280;">If you did not sign up, please ignore this email.</p>
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

export function sendLoginEmail(user, { ip, userAgent } = {}) {
  const name = displayName(user);
  const time = new Date().toUTCString();
  const device = userAgent || 'Unknown device';
  const ipAddress = ip || 'Unknown';

  return sendMail({
    to: user.email,
    subject: `New login to your ${APP_NAME} account`,
    text:
      `Hello ${name},\n\n` +
      `Your ${APP_NAME} account was just logged in to.\n\n` +
      `Time: ${time}\nIP address: ${ipAddress}\nDevice: ${device}\n\n` +
      `If this was you, no action is needed. If you don't recognise this login, ` +
      `please use "Forgot password" on the login page right away and contact the admin.\n\n— The ${APP_NAME} Team`,
    html: layout(
      'New login to your account',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>Your ${APP_NAME} account was just logged in to.</p>
       <table role="presentation" cellspacing="0" cellpadding="6" style="font-size:14px;background:#f9fafb;border-radius:6px;">
         <tr><td style="color:#6b7280;">Time</td><td>${escapeHtml(time)}</td></tr>
         <tr><td style="color:#6b7280;">IP address</td><td>${escapeHtml(ipAddress)}</td></tr>
         <tr><td style="color:#6b7280;">Device</td><td>${escapeHtml(device)}</td></tr>
       </table>
       <p>If this was you, no action is needed.</p>
       <p><strong>If you don't recognise this login</strong>, please use "Forgot password" on the login page right away and contact the admin.</p>
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

export function sendPasswordResetOtpEmail(user, otp, expiresInMinutes) {
  const name = displayName(user);
  return sendMail({
    to: user.email,
    subject: `Your ${APP_NAME} password reset code: ${otp}`,
    text:
      `Hello ${name},\n\n` +
      `Use this code to reset your ${APP_NAME} password:\n\n${otp}\n\n` +
      `The code expires in ${expiresInMinutes} minutes. Never share it with anyone — ` +
      `${APP_NAME} staff will never ask for it.\n\n` +
      `If you didn't request a password reset, you can ignore this email; your password will not change.\n\n— The ${APP_NAME} Team`,
    html: layout(
      'Password reset code',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>Use this code to reset your ${APP_NAME} password:</p>
       <p style="margin:20px 0;text-align:center;">
         <span style="display:inline-block;padding:12px 20px;font-size:28px;font-weight:bold;letter-spacing:8px;background:#f3f4f6;border-radius:8px;font-family:'Courier New',monospace;">${escapeHtml(otp)}</span>
       </p>
       <p>The code expires in <strong>${expiresInMinutes} minutes</strong>. Never share it with anyone — ${APP_NAME} staff will never ask for it.</p>
       <p style="color:#6b7280;">If you didn't request a password reset, you can ignore this email; your password will not change.</p>
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

export function sendPasswordChangedEmail(user) {
  const name = displayName(user);
  const time = new Date().toUTCString();
  return sendMail({
    to: user.email,
    subject: `Your ${APP_NAME} password was changed`,
    text:
      `Hello ${name},\n\n` +
      `The password for your ${APP_NAME} account was changed on ${time}.\n\n` +
      `If you did this, no action is needed. If you didn't, contact the admin immediately.\n\n— The ${APP_NAME} Team`,
    html: layout(
      'Your password was changed',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>The password for your ${APP_NAME} account was changed on <strong>${escapeHtml(time)}</strong>.</p>
       <p>If you did this, no action is needed.</p>
       <p><strong>If you didn't</strong>, contact the admin immediately.</p>
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

export function sendGoogleAccountResetNotice(user, loginUrl) {
  const name = displayName(user);
  return sendMail({
    to: user.email,
    subject: `About your ${APP_NAME} password reset request`,
    text:
      `Hello ${name},\n\n` +
      `Someone asked to reset the password for your ${APP_NAME} account. Your account uses Google sign-in, ` +
      `so it doesn't have a password to reset.\n\n` +
      `To log in, open the login page and click "Sign in with Google"${loginUrl ? `: ${loginUrl}` : ''}.\n\n` +
      `If you didn't request this, you can ignore this email.\n\n— The ${APP_NAME} Team`,
    html: layout(
      'Your account uses Google sign-in',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>Someone asked to reset the password for your ${APP_NAME} account. Your account uses <strong>Google sign-in</strong>, so it doesn't have a password to reset.</p>
       <p>To log in, open the login page and click <strong>"Sign in with Google"</strong>.${
         loginUrl ? ` <a href="${escapeHtml(loginUrl)}">Go to login</a>` : ''
       }</p>
       <p style="color:#6b7280;">If you didn't request this, you can ignore this email.</p>
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

export function sendAdminNewCaseEmail(adminEmails, { caseDoc, doctor, caseUrl }) {
  const doctorName = displayName({ ...doctor, role: 'doctor' });
  const patient = caseDoc.patientName || 'Unnamed patient';
  const submitted = new Date(caseDoc.createdAt || Date.now()).toUTCString();
  const rows = [
    ['Case #', String(caseDoc.id)],
    ['Patient', patient],
    ['Doctor', `${doctorName} (${doctor.email})`],
    ['Practice', caseDoc.practiceName || doctor.doctorDetails?.businessName || '—'],
    ['Case type', caseDoc.caseType || '—'],
    ['Submitted', submitted],
  ];

  return sendMail({
    to: adminEmails.join(', '),
    subject: `New case submitted: ${patient} (Case #${caseDoc.id})`,
    text:
      `A new case has been submitted.\n\n` +
      rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
      (caseUrl ? `\n\nView the case: ${caseUrl}` : '') +
      `\n\n— ${APP_NAME}`,
    html: layout(
      'New case submitted',
      `<p>A new case has been submitted.</p>
       <table role="presentation" cellspacing="0" cellpadding="6" style="font-size:14px;background:#f9fafb;border-radius:6px;">
         ${rows
           .map(
             ([k, v]) =>
               `<tr><td style="color:#6b7280;white-space:nowrap;">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`
           )
           .join('')}
       </table>
       ${
         caseUrl
           ? `<p style="margin-top:20px;"><a href="${escapeHtml(caseUrl)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">View case</a></p>`
           : ''
       }`
    ),
  });
}

function actionButton(url, label) {
  return url
    ? `<p style="margin-top:20px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">${escapeHtml(label)}</a></p>`
    : '';
}

// Designers never see which doctor/practice a case belongs to, so this email
// only mentions the case number and patient — matching what the dashboard shows.
export function sendRevisionAvailableEmail(designer, { caseId, revisionId, patientName, specialNote, url }) {
  const name = displayName(designer);
  const patient = patientName || 'Unnamed patient';
  const note = specialNote ? specialNote.slice(0, 500) : '';
  return sendMail({
    to: designer.email,
    subject: `New revision available: ${patient} (Case #${caseId})`,
    text:
      `Hello ${name},\n\n` +
      `A new revision has been requested and is available to pick up.\n\n` +
      `Case #: ${caseId}\nRevision #: ${revisionId}\nPatient: ${patient}\n` +
      (note ? `Note: ${note}\n` : '') +
      (url ? `\nOpen it in your dashboard: ${url}\n` : '') +
      `\n— The ${APP_NAME} Team`,
    html: layout(
      'New revision available',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>A new revision has been requested and is available to pick up.</p>
       <table role="presentation" cellspacing="0" cellpadding="6" style="font-size:14px;background:#f9fafb;border-radius:6px;">
         <tr><td style="color:#6b7280;">Case #</td><td>${escapeHtml(caseId)}</td></tr>
         <tr><td style="color:#6b7280;">Revision #</td><td>${escapeHtml(revisionId)}</td></tr>
         <tr><td style="color:#6b7280;">Patient</td><td>${escapeHtml(patient)}</td></tr>
         ${note ? `<tr><td style="color:#6b7280;vertical-align:top;">Note</td><td>${escapeHtml(note)}</td></tr>` : ''}
       </table>
       ${actionButton(url, 'View revision')}
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

export function sendRevisionDeliveredEmail(doctor, { caseId, revisionId, patientName, url }) {
  const name = displayName(doctor);
  const patient = patientName || 'your patient';
  return sendMail({
    to: doctor.email,
    subject: `Your revision is ready: ${patient} (Case #${caseId})`,
    text:
      `Hello ${name},\n\n` +
      `The revision you requested for ${patient} (Case #${caseId}, Revision #${revisionId}) has been delivered.\n` +
      `Please review the design and approve it in your dashboard.\n` +
      (url ? `\nView it here: ${url}\n` : '') +
      `\n— The ${APP_NAME} Team`,
    html: layout(
      'Your revision has been delivered',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>The revision you requested for <strong>${escapeHtml(patient)}</strong> (Case #${escapeHtml(caseId)}, Revision #${escapeHtml(revisionId)}) has been delivered.</p>
       <p>Please review the design and approve it in your dashboard.</p>
       ${actionButton(url, 'Review revision')}
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

export function sendCaseDeliveredEmail(doctor, { caseId, patientName, url }) {
  const name = displayName(doctor);
  const patient = patientName || 'your patient';
  return sendMail({
    to: doctor.email,
    subject: `Your case design is ready: ${patient} (Case #${caseId})`,
    text:
      `Hello ${name},\n\n` +
      `The design for ${patient} (Case #${caseId}) has been delivered.\n` +
      `Please review it and approve it in your dashboard.\n` +
      (url ? `\nView it here: ${url}\n` : '') +
      `\n— The ${APP_NAME} Team`,
    html: layout(
      'Your case design has been delivered',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>The design for <strong>${escapeHtml(patient)}</strong> (Case #${escapeHtml(caseId)}) has been delivered.</p>
       <p>Please review it and approve it in your dashboard.</p>
       ${actionButton(url, 'Review case')}
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

function loginHint(user) {
  return user.authProvider === 'google'
    ? 'Log in with the "Sign in with Google" button using this email address.'
    : 'Log in with your email address and password.';
}

export function sendAccountApprovedEmail(user, { loginUrl } = {}) {
  const name = displayName(user);
  return sendMail({
    to: user.email,
    subject: `Your ${APP_NAME} account has been approved`,
    text:
      `Hello ${name},\n\n` +
      `Good news — an administrator has approved your ${APP_NAME} account. You can now log in.\n` +
      `${loginHint(user)}\n` +
      (loginUrl ? `\nLog in here: ${loginUrl}\n` : '') +
      `\n— The ${APP_NAME} Team`,
    html: layout(
      'Your account has been approved',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>Good news — an administrator has <strong>approved</strong> your ${APP_NAME} account. You can now log in.</p>
       <p>${escapeHtml(loginHint(user))}</p>
       ${actionButton(loginUrl, 'Log in')}
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

export function sendAccountSuspendedEmail(user) {
  const name = displayName(user);
  const support = process.env.SMTP_USER;
  const contact = support ? ` please contact us at ${support}` : ' please contact our support team';
  return sendMail({
    to: user.email,
    subject: `Your ${APP_NAME} account has been suspended`,
    text:
      `Hello ${name},\n\n` +
      `Your ${APP_NAME} account has been suspended by an administrator. You will not be able to log in while it is suspended.\n` +
      `If you think this is a mistake or would like more information,${contact}.\n\n` +
      `— The ${APP_NAME} Team`,
    html: layout(
      'Your account has been suspended',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>Your ${APP_NAME} account has been <strong>suspended</strong> by an administrator. You will not be able to log in while it is suspended.</p>
       <p>If you think this is a mistake or would like more information,${escapeHtml(contact)}.</p>
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

export function sendAccountReactivatedEmail(user, { loginUrl } = {}) {
  const name = displayName(user);
  return sendMail({
    to: user.email,
    subject: `Your ${APP_NAME} account has been reactivated`,
    text:
      `Hello ${name},\n\n` +
      `Your ${APP_NAME} account is active again — the suspension has been lifted and you can log in.\n` +
      `${loginHint(user)}\n` +
      (loginUrl ? `\nLog in here: ${loginUrl}\n` : '') +
      `\n— The ${APP_NAME} Team`,
    html: layout(
      'Your account has been reactivated',
      `<p>Hello ${escapeHtml(name)},</p>
       <p>Your ${APP_NAME} account is <strong>active again</strong> — the suspension has been lifted and you can log in.</p>
       <p>${escapeHtml(loginHint(user))}</p>
       ${actionButton(loginUrl, 'Log in')}
       <p>— The ${APP_NAME} Team</p>`
    ),
  });
}

function detailsTable(rows) {
  return `<table role="presentation" cellspacing="0" cellpadding="6" style="font-size:14px;background:#f9fafb;border-radius:6px;width:100%;">
         ${rows
           .map(
             ([k, v]) =>
               `<tr><td style="color:#6b7280;white-space:nowrap;vertical-align:top;width:130px;">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`
           )
           .join('')}
       </table>`;
}

/**
 * New doctor/designer signup → admin email. When the doctor submitted a case
 * with the signup, the same email also carries the case details, so the admin
 * gets one combined message instead of two.
 */
export function sendAdminNewSignupEmail(adminEmails, { user, caseDoc, accountUrl, caseUrl }) {
  const isDoctor = user.role === 'doctor';
  const roleLabel = isDoctor ? 'doctor' : 'designer';
  const name = displayName(user);
  const details = (isDoctor ? user.doctorDetails : user.designerDetails) || {};

  const accountRows = [
    ['Name', name],
    ['Email', user.email],
    ['Signed up with', user.authProvider === 'google' ? 'Google' : 'Email & password'],
    ['Business', details.businessName || '—'],
    ['Contact #', details.contactNumber || '—'],
    ...(isDoctor ? [['Address', details.businessAddress || '—']] : []),
    ...(details.specialInstructions ? [['Instructions', details.specialInstructions]] : []),
  ];
  const caseRows = caseDoc
    ? [
        ['Case #', String(caseDoc.id)],
        ['Patient', caseDoc.patientName || 'Unnamed patient'],
        ['Practice', caseDoc.practiceName || '—'],
        ['Case type', caseDoc.caseType || '—'],
        ['Treatment plan', caseDoc.treatmentPlan || '—'],
      ]
    : [];

  const subject = caseDoc
    ? `New doctor signup + case submitted: ${name} (Case #${caseDoc.id})`
    : `New ${roleLabel} signup: ${name}`;
  const intro = caseDoc
    ? `${name} just signed up as a doctor and submitted their first case. Their account is waiting for your approval.`
    : `${name} just signed up as a ${roleLabel}. Their account is waiting for your approval.`;
  const toText = (rows) => rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const button = (url, label, primary) =>
    url
      ? `<a href="${escapeHtml(url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 18px;border-radius:6px;font-weight:bold;text-decoration:none;${
          primary ? 'background:#4f46e5;color:#ffffff;' : 'background:#ffffff;color:#4f46e5;border:1px solid #4f46e5;'
        }">${escapeHtml(label)}</a>`
      : '';

  return sendMail({
    to: adminEmails.join(', '),
    subject,
    text:
      `${intro}\n\nAccount\n${toText(accountRows)}` +
      (caseDoc ? `\n\nCase\n${toText(caseRows)}` : '') +
      (accountUrl ? `\n\nReview the account: ${accountUrl}` : '') +
      (caseUrl ? `\nView the case: ${caseUrl}` : '') +
      `\n\n— ${APP_NAME}`,
    html: layout(
      caseDoc ? 'New doctor signup with case submission' : `New ${roleLabel} signup`,
      `<p>${escapeHtml(intro)}</p>
       <h3 style="margin:20px 0 8px;font-size:15px;">Account</h3>
       ${detailsTable(accountRows)}
       ${caseDoc ? `<h3 style="margin:20px 0 8px;font-size:15px;">Submitted case</h3>${detailsTable(caseRows)}` : ''}
       <p style="margin-top:20px;">
         ${button(accountUrl, `Review ${roleLabel}`, true)}
         ${button(caseUrl, 'View case', false)}
       </p>`
    ),
  });
}

/**
 * Plain notice email: greeting, a few paragraphs, optional details table and
 * button. `to` is a user (greeted by name) or a list of admin addresses.
 */
function sendNoticeEmail(to, { subject, title, paragraphs, rows = [], url, buttonLabel }) {
  const isUser = typeof to === 'object' && !Array.isArray(to);
  const greeting = isUser ? `Hello ${displayName(to)},` : null;
  return sendMail({
    to: isUser ? to.email : to.join(', '),
    subject,
    text:
      (greeting ? `${greeting}\n\n` : '') +
      paragraphs.join('\n') +
      (rows.length ? '\n\n' + rows.map(([k, v]) => `${k}: ${v}`).join('\n') : '') +
      (url ? `\n\n${buttonLabel}: ${url}` : '') +
      `\n\n— The ${APP_NAME} Team`,
    html: layout(
      title,
      (greeting ? `<p>${escapeHtml(greeting)}</p>` : '') +
        paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('') +
        (rows.length ? detailsTable(rows) : '') +
        actionButton(url, buttonLabel) +
        `<p>— The ${APP_NAME} Team</p>`
    ),
  });
}

// ── Doctor ────────────────────────────────────────────────────────────────

export function sendWorkStartedEmail(doctor, { caseId, patientName, isRevision, url }) {
  const patient = patientName || 'your patient';
  const what = isRevision ? 'revision' : 'case';
  return sendNoticeEmail(doctor, {
    subject: `Work has started on your ${what}: ${patient} (Case #${caseId})`,
    title: `A designer is working on your ${what}`,
    paragraphs: [
      `A designer has picked up the ${what} for ${patient} (Case #${caseId}) and started working on it.`,
      "We'll email you again as soon as the design is delivered.",
    ],
    url,
    buttonLabel: 'View case',
  });
}

// ── Designer ──────────────────────────────────────────────────────────────
// Designers never see which doctor/practice a case belongs to, so these
// emails only mention case numbers and patients.

export function sendNewCaseAvailableEmail(designer, { caseId, patientName, caseType, url }) {
  const patient = patientName || 'Unnamed patient';
  return sendNoticeEmail(designer, {
    subject: `New case available: ${patient} (Case #${caseId})`,
    title: 'A new case is available',
    paragraphs: [`A new case is ready to be picked up. The first designer to pick it gets to work on it.`],
    rows: [
      ['Case #', String(caseId)],
      ['Patient', patient],
      ['Case type', caseType || '—'],
    ],
    url,
    buttonLabel: 'View case',
  });
}

export function sendDoctorAccessGrantedEmail(designer, { count, url }) {
  return sendNoticeEmail(designer, {
    subject: `You have access to new cases on ${APP_NAME}`,
    title: 'You have access to new cases',
    paragraphs: [
      count === 1
        ? 'An administrator has given you access to cases from 1 more doctor.'
        : `An administrator has given you access to cases from ${count} more doctors.`,
      'Their cases and revisions will now appear in your dashboard.',
    ],
    url,
    buttonLabel: 'Browse cases',
  });
}

export function sendWorkApprovedEmail(designer, { caseId, patientName, isRevision, url }) {
  const patient = patientName || 'Unnamed patient';
  const what = isRevision ? 'revision' : 'design';
  return sendNoticeEmail(designer, {
    subject: `Your ${what} was approved: ${patient} (Case #${caseId})`,
    title: `Your ${what} was approved`,
    paragraphs: [`Great work — the doctor approved your ${what} for ${patient} (Case #${caseId}). The ${isRevision ? 'revision' : 'case'} is now completed.`],
    url,
    buttonLabel: 'View',
  });
}

export function sendCaseFilesUpdatedEmail(designer, { caseId, patientName, summary, url }) {
  const patient = patientName || 'Unnamed patient';
  return sendNoticeEmail(designer, {
    subject: `Scans & pictures updated: ${patient} (Case #${caseId})`,
    title: 'Scans & pictures were updated',
    paragraphs: [
      `The doctor updated the scans & pictures for ${patient} (Case #${caseId}): ${summary}.`,
      'Please review the latest files before continuing with the design.',
    ],
    rows: [
      ['Case #', String(caseId)],
      ['Patient', patient],
    ],
    url,
    buttonLabel: 'View case',
  });
}

// ── Doctor & designer ─────────────────────────────────────────────────────

export function sendAdminPasswordResetEmail(user) {
  return sendNoticeEmail(user, {
    subject: `Your ${APP_NAME} password was reset`,
    title: 'Your password was reset by an administrator',
    paragraphs: [
      'An administrator has reset the password for your account. Your old password no longer works.',
      'The administrator will share your new password with you. You can also set your own at any time with "Forgot password" on the login page.',
      "If you didn't ask for this, please contact us.",
    ],
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────

export function sendAdminEventEmail(adminEmails, { subject, title, paragraphs, rows, url, buttonLabel = 'View case' }) {
  return sendNoticeEmail(adminEmails, { subject, title, paragraphs, rows, url, buttonLabel });
}
