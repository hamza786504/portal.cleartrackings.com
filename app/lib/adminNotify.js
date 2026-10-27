import prisma from '@/app/lib/prisma';
import { sendAdminNewCaseEmail, sendAdminNewSignupEmail, sendAdminEventEmail } from '@/app/lib/mailer';

/**
 * Admin email recipients: every active admin account, plus any extra
 * addresses in ADMIN_NOTIFY_EMAILS (comma-separated), de-duplicated.
 */
async function getAdminEmails() {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', isSuspended: false },
    select: { email: true },
  });
  const extra = (process.env.ADMIN_NOTIFY_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...admins.map((a) => a.email.toLowerCase()), ...extra])];
}

function absoluteUrl(path) {
  const appUrl = process.env.APP_URL?.replace(/\/+$/, '');
  return appUrl ? `${appUrl}${path}` : null;
}

async function createAdminNotification(data) {
  try {
    await prisma.adminNotification.create({ data });
  } catch (error) {
    console.error('Failed to create admin notification:', error);
  }
}

async function emailAdmins(send) {
  try {
    const recipients = await getAdminEmails();
    if (!recipients.length) {
      console.warn('No admin email recipients found; skipping admin email.');
      return;
    }
    await send(recipients);
  } catch (error) {
    console.error('Failed to email admins:', error);
  }
}

/**
 * An existing doctor submitted a case from their dashboard → bell notification
 * and email for the admins. Never throws; call it from `after()`.
 */
export async function notifyAdminsOfNewCase({ caseDoc, doctor }) {
  const doctorName = `Dr. ${[doctor.firstName, doctor.lastName].filter(Boolean).join(' ')}`;
  const patient = caseDoc.patientName || 'Unnamed patient';

  await createAdminNotification({
    type: 'new_case',
    title: 'New case submitted',
    message: `${doctorName} submitted a case for ${patient}.`,
    caseId: caseDoc.id,
  });

  await emailAdmins((recipients) =>
    sendAdminNewCaseEmail(recipients, {
      caseDoc,
      doctor,
      caseUrl: absoluteUrl(`/admin/cases/${caseDoc.id}`),
    })
  );
}

/**
 * A doctor or designer signed up (email/password or Google), optionally with a
 * first case → one bell notification and one combined email for the admins.
 * Never throws; call it from `after()`.
 */
export async function notifyAdminsOfNewSignup({ user, caseDoc = null }) {
  const isDoctor = user.role === 'doctor';
  const name = isDoctor
    ? `Dr. ${[user.firstName, user.lastName].filter(Boolean).join(' ')}`
    : [user.firstName, user.lastName].filter(Boolean).join(' ');
  const accountPath = isDoctor ? '/admin/doctors' : '/admin/designers';

  await createAdminNotification(
    caseDoc
      ? {
          type: 'new_case',
          title: 'New doctor signup with case',
          message: `${name} signed up and submitted a case for ${caseDoc.patientName || 'Unnamed patient'}. Approval pending.`,
          caseId: caseDoc.id,
        }
      : {
          type: isDoctor ? 'new_doctor_signup' : 'new_designer_signup',
          title: isDoctor ? 'New doctor signup' : 'New designer signup',
          message: `${name} signed up and is waiting for approval.`,
        }
  );

  await emailAdmins((recipients) =>
    sendAdminNewSignupEmail(recipients, {
      user,
      caseDoc,
      accountUrl: absoluteUrl(accountPath),
      caseUrl: caseDoc ? absoluteUrl(`/admin/cases/${caseDoc.id}`) : null,
    })
  );
}

const CASE_EVENTS = {
  case_delivered: {
    title: 'Case delivered',
    message: (c) => `The design for ${c.patient} (Case #${c.caseId}) was delivered to ${c.doctorName}.`,
  },
  case_approved: {
    title: 'Case approved',
    message: (c) => `${c.doctorName} approved the design for ${c.patient} (Case #${c.caseId}). The case is completed.`,
  },
  revision_requested: {
    title: 'Revision requested',
    message: (c) => `${c.doctorName} requested a revision for ${c.patient} (Case #${c.caseId}).`,
  },
  revision_delivered: {
    title: 'Revision delivered',
    message: (c) => `A revision for ${c.patient} (Case #${c.caseId}) was delivered to ${c.doctorName}.`,
  },
  revision_approved: {
    title: 'Revision approved',
    message: (c) => `${c.doctorName} approved the revision for ${c.patient} (Case #${c.caseId}).`,
  },
};

/**
 * Something happened on a case (delivered, approved, revision requested…) →
 * bell notification + email for the admins. Never throws; call it from `after()`.
 */
export async function notifyAdminsOfCaseEvent(type, { caseId = null, revisionId = null }) {
  try {
    if (!caseId && revisionId) {
      caseId = (await prisma.revision.findUnique({ where: { id: revisionId }, select: { caseId: true } }))?.caseId;
    }
    if (!caseId) return;
    const event = CASE_EVENTS[type];
    const caseDoc = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        patientName: true,
        doctor: { select: { firstName: true, lastName: true } },
        pickedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!event || !caseDoc) return;

    // For revision events, the designer is whoever picked the revision
    const picker = revisionId
      ? (
          await prisma.revision.findUnique({
            where: { id: revisionId },
            select: { pickedBy: { select: { firstName: true, lastName: true } } },
          })
        )?.pickedBy
      : caseDoc.pickedBy;

    const info = {
      caseId: caseDoc.id,
      patient: caseDoc.patientName || 'Unnamed patient',
      doctorName: `Dr. ${[caseDoc.doctor?.firstName, caseDoc.doctor?.lastName].filter(Boolean).join(' ')}`,
    };
    const message = event.message(info);

    await createAdminNotification({ type, title: event.title, message, caseId: caseDoc.id });

    const designer = [picker?.firstName, picker?.lastName].filter(Boolean).join(' ');
    await emailAdmins((recipients) =>
      sendAdminEventEmail(recipients, {
        subject: `${event.title}: ${info.patient} (Case #${info.caseId})`,
        title: event.title,
        paragraphs: [message],
        rows: [
          ['Case #', String(info.caseId)],
          ['Patient', info.patient],
          ...(revisionId ? [['Revision #', String(revisionId)]] : []),
          ['Doctor', info.doctorName],
          ['Designer', designer || '—'],
        ],
        url: absoluteUrl(`/admin/cases/${info.caseId}`),
      })
    );
  } catch (error) {
    console.error(`Failed to notify admins of ${type}:`, error);
  }
}

/**
 * Human-readable summary of a doctor's scan/picture edit, e.g.
 * "added 2 scan files, removed 1 patient image".
 */
export function describeFileChanges({ addedScans = 0, removedScans = 0, addedImages = 0, removedImages = 0 }) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [
    addedScans && `added ${plural(addedScans, 'scan file')}`,
    removedScans && `removed ${plural(removedScans, 'scan file')}`,
    addedImages && `added ${plural(addedImages, 'patient image')}`,
    removedImages && `removed ${plural(removedImages, 'patient image')}`,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * The doctor edited a case's scan files / patient images → bell notification
 * + email for the admins. Never throws; call it from `after()`.
 */
export async function notifyAdminsOfCaseFilesUpdated({ caseId, changes }) {
  try {
    const caseDoc = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        patientName: true,
        status: true,
        doctor: { select: { firstName: true, lastName: true } },
        pickedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!caseDoc) return;

    const patient = caseDoc.patientName || 'Unnamed patient';
    const doctorName = `Dr. ${[caseDoc.doctor?.firstName, caseDoc.doctor?.lastName].filter(Boolean).join(' ')}`;
    const summary = describeFileChanges(changes);
    const title = 'Scans & pictures updated';
    const message = `${doctorName} updated the scans & pictures for ${patient} (Case #${caseDoc.id}): ${summary}.`;

    await createAdminNotification({ type: 'case_files_updated', title, message, caseId: caseDoc.id });

    const designer = [caseDoc.pickedBy?.firstName, caseDoc.pickedBy?.lastName].filter(Boolean).join(' ');
    await emailAdmins((recipients) =>
      sendAdminEventEmail(recipients, {
        subject: `${title}: ${patient} (Case #${caseDoc.id})`,
        title,
        paragraphs: [message],
        rows: [
          ['Case #', String(caseDoc.id)],
          ['Patient', patient],
          ['Status', caseDoc.status],
          ['Doctor', doctorName],
          ['Designer', designer || '—'],
        ],
        url: absoluteUrl(`/admin/cases/${caseDoc.id}`),
      })
    );
  } catch (error) {
    console.error('Failed to notify admins of case file update:', error);
  }
}
