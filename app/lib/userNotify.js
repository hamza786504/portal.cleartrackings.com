import prisma from '@/app/lib/prisma';
import {
  sendCaseDeliveredEmail,
  sendRevisionAvailableEmail,
  sendRevisionDeliveredEmail,
  sendWorkStartedEmail,
  sendNewCaseAvailableEmail,
  sendWorkApprovedEmail,
  sendDoctorAccessGrantedEmail,
  sendCaseFilesUpdatedEmail,
} from '@/app/lib/mailer';
import { describeFileChanges } from '@/app/lib/adminNotify';

function absoluteUrl(path) {
  const appUrl = process.env.APP_URL?.replace(/\/+$/, '');
  return appUrl ? `${appUrl}${path}` : null;
}

/**
 * Every designer who may pick up work for this doctor: has a permission row
 * for the doctor, is approved and isn't suspended. Mirrors the rule in
 * PATCH /api/revisions/[id]/pick.
 */
async function getEligibleDesigners(doctorId) {
  const permissions = await prisma.designerPermission.findMany({
    where: {
      doctorId,
      designer: { role: 'designer', isApproved: true, isSuspended: false },
    },
    select: {
      designer: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
    },
  });
  return permissions.map((p) => p.designer);
}

/**
 * A doctor requested a revision → bell notification + email to every eligible
 * designer. Never throws; call it from `after()` once the revision is saved.
 */
export async function notifyDesignersOfNewRevision({ revision, patientName }) {
  try {
    const designers = await getEligibleDesigners(revision.doctorId);
    if (!designers.length) {
      console.warn(`No eligible designers to notify for revision #${revision.id}.`);
      return;
    }

    const link = `/designer/revisions/${revision.id}`;
    const patient = patientName || 'Unnamed patient';

    await prisma.userNotification.createMany({
      data: designers.map((d) => ({
        userId: d.id,
        type: 'revision_available',
        title: 'New revision available',
        message: `A revision was requested for ${patient} (Case #${revision.caseId}).`,
        link,
      })),
    });

    await Promise.allSettled(
      designers.map((d) =>
        sendRevisionAvailableEmail(d, {
          caseId: revision.caseId,
          revisionId: revision.id,
          patientName,
          specialNote: revision.specialNote,
          url: absoluteUrl(link),
        })
      )
    );
  } catch (error) {
    console.error('Failed to notify designers of new revision:', error);
  }
}

/**
 * A designer delivered a revision → bell notification + email to the doctor
 * who requested it. Never throws; call it from `after()`.
 */
export async function notifyDoctorOfRevisionDelivered(revisionId) {
  try {
    const revision = await prisma.revision.findUnique({
      where: { id: revisionId },
      select: {
        id: true,
        caseId: true,
        case: { select: { patientName: true } },
        doctor: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
    if (!revision?.doctor) return;

    const link = `/doctor/cases/${revision.caseId}`;
    const patient = revision.case?.patientName || 'your patient';

    await prisma.userNotification.create({
      data: {
        userId: revision.doctor.id,
        type: 'revision_delivered',
        title: 'Revision delivered',
        message: `Your revision for ${patient} (Case #${revision.caseId}) is ready for review.`,
        link,
      },
    });

    await sendRevisionDeliveredEmail(revision.doctor, {
      caseId: revision.caseId,
      revisionId: revision.id,
      patientName: revision.case?.patientName,
      url: absoluteUrl(link),
    });
  } catch (error) {
    console.error('Failed to notify doctor of delivered revision:', error);
  }
}

/**
 * A designer delivered the original case design → bell notification + email
 * to the case's doctor. Never throws; call it from `after()`.
 */
export async function notifyDoctorOfCaseDelivered(caseId) {
  try {
    const caseDoc = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        patientName: true,
        doctor: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
    if (!caseDoc?.doctor) return;

    const link = `/doctor/cases/${caseDoc.id}`;
    const patient = caseDoc.patientName || 'your patient';

    await prisma.userNotification.create({
      data: {
        userId: caseDoc.doctor.id,
        type: 'case_delivered',
        title: 'Case delivered',
        message: `The design for ${patient} (Case #${caseDoc.id}) is ready for review.`,
        link,
      },
    });

    await sendCaseDeliveredEmail(caseDoc.doctor, {
      caseId: caseDoc.id,
      patientName: caseDoc.patientName,
      url: absoluteUrl(link),
    });
  } catch (error) {
    console.error('Failed to notify doctor of delivered case:', error);
  }
}

const USER_SELECT = { id: true, email: true, firstName: true, lastName: true, role: true };

/**
 * A designer picked a case or revision → bell notification + email to the
 * doctor that work has started. Never throws; call it from `after()`.
 */
export async function notifyDoctorOfWorkStarted({ caseId, revisionId = null }) {
  try {
    const caseDoc = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, patientName: true, doctor: { select: USER_SELECT } },
    });
    if (!caseDoc?.doctor) return;

    const isRevision = Boolean(revisionId);
    const link = `/doctor/cases/${caseDoc.id}`;
    const patient = caseDoc.patientName || 'your patient';

    await prisma.userNotification.create({
      data: {
        userId: caseDoc.doctor.id,
        type: 'work_started',
        title: isRevision ? 'Revision in progress' : 'Case in progress',
        message: `A designer started working on the ${isRevision ? 'revision' : 'case'} for ${patient} (Case #${caseDoc.id}).`,
        link,
      },
    });

    await sendWorkStartedEmail(caseDoc.doctor, {
      caseId: caseDoc.id,
      patientName: caseDoc.patientName,
      isRevision,
      url: absoluteUrl(link),
    });
  } catch (error) {
    console.error('Failed to notify doctor that work started:', error);
  }
}

/**
 * A doctor submitted a new case → bell notification + email to every
 * designer who may pick it. Never throws; call it from `after()`.
 */
export async function notifyDesignersOfNewCase(caseDoc) {
  try {
    const designers = await getEligibleDesigners(caseDoc.doctorId);
    if (!designers.length) return;

    const link = `/designer/cases/${caseDoc.id}`;
    const patient = caseDoc.patientName || 'Unnamed patient';

    await prisma.userNotification.createMany({
      data: designers.map((d) => ({
        userId: d.id,
        type: 'case_available',
        title: 'New case available',
        message: `A new case for ${patient} (Case #${caseDoc.id}) is ready to be picked.`,
        link,
      })),
    });

    await Promise.allSettled(
      designers.map((d) =>
        sendNewCaseAvailableEmail(d, {
          caseId: caseDoc.id,
          patientName: caseDoc.patientName,
          caseType: caseDoc.caseType,
          url: absoluteUrl(link),
        })
      )
    );
  } catch (error) {
    console.error('Failed to notify designers of new case:', error);
  }
}

/**
 * The doctor approved a delivered case or revision → bell notification +
 * email to the designer who did the work. Never throws; call it from `after()`.
 */
export async function notifyDesignerOfApproval({ caseId, revisionId = null }) {
  try {
    const isRevision = Boolean(revisionId);
    const record = isRevision
      ? await prisma.revision.findUnique({
          where: { id: revisionId },
          select: { caseId: true, case: { select: { patientName: true } }, pickedBy: { select: USER_SELECT } },
        })
      : await prisma.case.findUnique({
          where: { id: caseId },
          select: { id: true, patientName: true, pickedBy: { select: USER_SELECT } },
        });
    if (!record?.pickedBy) return;

    const patientName = isRevision ? record.case?.patientName : record.patientName;
    const link = isRevision ? `/designer/revisions/${revisionId}` : `/designer/cases/${caseId}`;

    await prisma.userNotification.create({
      data: {
        userId: record.pickedBy.id,
        type: 'work_approved',
        title: isRevision ? 'Revision approved' : 'Design approved',
        message: `The doctor approved your ${isRevision ? 'revision' : 'design'} for ${patientName || 'Unnamed patient'} (Case #${caseId}).`,
        link,
      },
    });

    await sendWorkApprovedEmail(record.pickedBy, { caseId, patientName, isRevision, url: absoluteUrl(link) });
  } catch (error) {
    console.error('Failed to notify designer of approval:', error);
  }
}

/**
 * The admin gave a designer access to more doctors → bell notification + email.
 * Never throws; call it from `after()`.
 */
export async function notifyDesignerOfNewAccess(designer, count) {
  try {
    if (!count || !designer.isApproved || designer.isSuspended) return;
    const link = '/designer/cases';

    await prisma.userNotification.create({
      data: {
        userId: designer.id,
        type: 'access_granted',
        title: 'New cases available to you',
        message:
          count === 1
            ? 'You now have access to cases from 1 more doctor.'
            : `You now have access to cases from ${count} more doctors.`,
        link,
      },
    });

    await sendDoctorAccessGrantedEmail(designer, { count, url: absoluteUrl(link) });
  } catch (error) {
    console.error('Failed to notify designer of new access:', error);
  }
}

/**
 * The doctor edited a case's scan files / patient images → bell notification
 * + email to the designer working on it, or to every eligible designer while
 * the case is still unpicked. The doctor is not notified. Never throws; call
 * it from `after()`.
 */
export async function notifyDesignersOfCaseFilesUpdated({ caseId, changes }) {
  try {
    const caseDoc = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, doctorId: true, patientName: true, pickedBy: { select: USER_SELECT } },
    });
    if (!caseDoc) return;

    const designers = caseDoc.pickedBy ? [caseDoc.pickedBy] : await getEligibleDesigners(caseDoc.doctorId);
    if (!designers.length) return;

    const link = `/designer/cases/${caseDoc.id}`;
    const patient = caseDoc.patientName || 'Unnamed patient';
    const summary = describeFileChanges(changes);

    await prisma.userNotification.createMany({
      data: designers.map((d) => ({
        userId: d.id,
        type: 'case_files_updated',
        title: 'Scans & pictures updated',
        message: `The doctor updated the scans & pictures for ${patient} (Case #${caseDoc.id}): ${summary}.`,
        link,
      })),
    });

    await Promise.allSettled(
      designers.map((d) =>
        sendCaseFilesUpdatedEmail(d, {
          caseId: caseDoc.id,
          patientName: caseDoc.patientName,
          summary,
          url: absoluteUrl(link),
        })
      )
    );
  } catch (error) {
    console.error('Failed to notify designers of case file update:', error);
  }
}
