'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  BsExclamationTriangleFill,
  BsArrowLeft,
  BsFileEarmarkMedical,
  BsPersonCheckFill,
  BsHourglassSplit,
  BsCheckCircleFill,
  BsBoxArrowUpRight,
  BsCheckLg,
  BsPersonCircle,
  BsClipboardPulse,
  BsSliders,
  BsGrid,
  BsBullseye,
  BsJournalText,
  BsCloudUpload,
  BsEye,
  BsCardImage,
  BsPlusLg,
  BsArrowRepeat,
  BsPencilSquare,
} from 'react-icons/bs';
import DashboardShell from '@/app/_components/doctor/DashboardShell';
import CaseChat from '@/app/_components/CaseChat';
import FileGrid from '@/app/_components/FileGrid';
import RevisionFormModal from '@/app/_components/doctor/RevisionFormModal';
import EditCaseFilesModal from '@/app/_components/doctor/EditCaseFilesModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Button } from '@/app/_components/ui/button';
import { Badge } from '@/app/_components/ui/badge';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import StatusBadge from '@/app/_components/shared/StatusBadge';
import Spinner from '@/app/_components/shared/Spinner';

const Section = ({ title, icon: Icon, action, children }) => (
  <Card className="mb-4 border-0 shadow-sm">
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b py-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <Icon className="text-primary" />
        {title}
      </CardTitle>
      {action}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const Field = ({ label, value }) => (
  <div className="mb-3">
    <div className="mb-1 text-sm font-semibold text-muted-foreground">{label}</div>
    <div>{value || <span className="italic text-muted-foreground">—</span>}</div>
  </div>
);

const TagList = ({ items }) =>
  items && items.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="outline" className="bg-muted px-2 py-1">
          {item}
        </Badge>
      ))}
    </div>
  ) : (
    <span className="text-sm italic text-muted-foreground">None selected</span>
  );

const STATUS_CONFIG = {
  pending: { label: 'Pending' },
  'in-progress': { label: 'In Progress' },
  delivered: { label: 'Awaiting Your Approval' },
  completed: { label: 'Completed' },
  hold: { label: 'On Hold' },
};

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { id } = params;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState('');

  const [revisions, setRevisions] = useState([]);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [approveRevisionLoading, setApproveRevisionLoading] = useState(false);
  const [approveRevisionError, setApproveRevisionError] = useState('');
  const [editFilesModalOpen, setEditFilesModalOpen] = useState(false);

  const fetchCase = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/cases/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to load case');
      }
      const data = await res.json();
      setCaseData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevisions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/cases/${id}/revisions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRevisions(Array.isArray(data) ? data : []);
      }
    } catch {
      // Non-fatal — the case still renders without the revisions list.
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchCase();
    fetchRevisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Deep-link support: /doctor/cases/[id]?newRevision=1 auto-opens the modal
  // (used by the "New Revision" button on the completed-case rows in the list).
  useEffect(() => {
    if (searchParams.get('newRevision') === '1' && caseData?.status === 'completed') {
      setRevisionModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData, searchParams]);

  const handleApprove = async () => {
    setApproveLoading(true);
    setApproveError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/cases/${id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to approve case.');
      }
      setCaseData(data);
    } catch (err) {
      setApproveError(err.message);
    } finally {
      setApproveLoading(false);
    }
  };

  const handleApproveRevision = async (revisionId) => {
    setApproveRevisionLoading(true);
    setApproveRevisionError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/revisions/${revisionId}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to approve revision.');
      }
      setRevisions((prev) => prev.map((r) => (r._id === revisionId ? data : r)));
    } catch (err) {
      setApproveRevisionError(err.message);
    } finally {
      setApproveRevisionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-5">
          <div className="text-center">
            <Spinner className="size-6" />
            <p className="mt-3 text-muted-foreground">Loading case details...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell>
        <div className="py-4">
          <Alert variant="destructive" className="mb-3">
            <BsExclamationTriangleFill />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" className="gap-2" onClick={() => router.back()}>
            <BsArrowLeft /> Go Back
          </Button>
        </div>
      </DashboardShell>
    );
  }

  if (!caseData) return null;

  const pickedBy = caseData.pickedBy
    ? `${caseData.pickedBy.firstName} ${caseData.pickedBy.lastName}`
    : null;

  // Effective status: a reopened case (one with revisions) shows the latest
  // revision's status instead of the parent case's "completed" status.
  const displayStatus = caseData.revisionStatus ?? caseData.status;

  const isOnHold = caseData.status === 'hold';

  // Items the doctor still has to pay the admin for (admin hasn't marked paid).
  // Surfaced as a sticky banner below so it's always visible while scrolling.
  const unpaidItems = [];
  if (!caseData.paid) unpaidItems.push('this case');
  revisions.forEach((r, idx) => {
    if (!r.paid) unpaidItems.push(`Revision #${revisions.length - idx}`);
  });

  return (
    <DashboardShell>
      {isOnHold && (
        <Alert variant="destructive" className="mb-4 gap-2 border-0 bg-destructive/10">
          <BsExclamationTriangleFill />
          <AlertDescription>
            <span>This case is on hold by the admin, so you can&apos;t edit it right now.</span>
            {caseData.holdReason ? (
              <span className="mt-1 block">
                <strong>Reason:</strong> {caseData.holdReason}
              </span>
            ) : null}
            <span className="mt-1 block">It will be available again once the admin changes its status.</span>
          </AlertDescription>
        </Alert>
      )}

      {unpaidItems.length > 0 && (
        <div className="sticky top-0 z-50 mb-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground shadow-sm">
          <BsExclamationTriangleFill className="mt-0.5 text-base text-warning" />
          <div>
            <strong>Payment not done.</strong> The admin has not marked payment as received for:
            <ul className="mt-1 list-inside list-disc">
              {unpaidItems.map((label, i) => (
                <li key={i}>{label}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className={isOnHold ? 'pointer-events-none opacity-50 select-none' : ''}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="link" className="mb-2 gap-1 px-0 text-muted-foreground" onClick={() => router.back()}>
            <BsArrowLeft /> Back to Cases
          </Button>
          <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <BsFileEarmarkMedical className="text-primary" />
            Case: {caseData.patientName}
          </h4>
          <p className="mb-0 text-sm text-muted-foreground">
            Submitted on{' '}
            {new Date(caseData.createdAt).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <StatusBadge status={displayStatus} label={STATUS_CONFIG[displayStatus]?.label} className="px-3 py-2 text-sm" />
          {caseData.status === 'completed' && (
            <Button className="gap-2" onClick={() => setRevisionModalOpen(true)}>
              <BsPlusLg /> New Revision
            </Button>
          )}
      </div>

      {/* Designer Pickup Status */}
      <Alert className={`mb-4 gap-2 border-0 ${pickedBy ? 'bg-info/15' : 'bg-warning/15'}`}>
        {pickedBy ? <BsPersonCheckFill className="text-lg" /> : <BsHourglassSplit className="text-lg" />}
        <AlertDescription className="text-foreground">
          {pickedBy ? (
            <span>This case has been picked up by designer <strong>{pickedBy}</strong>.</span>
          ) : (
            <span>This case is <strong>open and available</strong> — no designer has picked it up yet.</span>
          )}
        </AlertDescription>
      </Alert>

      {/* Design Delivery — hidden while a revision is actively open, since the
          revision's own delivery/approval lives in the Revisions section below. */}
      {caseData.designLink && !(caseData.revisionStatus && caseData.revisionStatus !== 'completed') && (
        <Alert className={`mb-4 flex flex-col gap-3 border-0 ${caseData.status === 'delivered' ? 'bg-info/15' : 'bg-success/10'}`}>
          <div className="mb-1 flex fle-x items-center gap-2">
            {caseData.status === 'delivered' ? (
              <BsHourglassSplit className="text-lg" />
            ) : (
              <BsCheckCircleFill className="text-lg text-success" />
            )}
            <strong>{caseData.status === 'delivered' ? 'Design Delivered — Awaiting Your Approval' : 'Design Approved'}</strong>
          </div>
          <AlertDescription>
            <a href={caseData.designLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
              {caseData.designLink} <BsBoxArrowUpRight className="text-sm" />
            </a>
            {caseData.deliveredAt && (
              <p className="mt-2 mb-0 text-sm text-muted-foreground">
                Delivered on{' '}
                {new Date(caseData.deliveredAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
            {caseData.status === 'delivered' && (
              <div className="mt-3">
                <p className="mb-2 text-sm text-muted-foreground">
                  Review the design above. The case won&apos;t be marked completed until you approve it.
                </p>
                <Button size="sm" className="gap-2" onClick={handleApprove} disabled={approveLoading}>
                  {approveLoading ? (
                    <Spinner className="border-white" />
                  ) : (
                    <>
                      <BsCheckLg /> Approve Design
                    </>
                  )}
                </Button>
                {approveError && <div className="mt-2 text-sm text-destructive">{approveError}</div>}
              </div>
            )}
            {caseData.approvedAt && caseData.status === 'completed' && (
              <p className="mt-2 mb-0 text-sm text-muted-foreground">
                Approved on{' '}
                {new Date(caseData.approvedAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Case Chat */}
      <CaseChat caseId={id} canSend={true} />

      {/* Patient & Practice */}
      <Section title="Patient & Practice Information" icon={BsPersonCircle}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Patient Name" value={caseData.patientName} />
          <Field label="Practice Name" value={caseData.practiceName} />
          <Field label="Date of Birth" value={caseData.dob} />
          <Field label="Chief Complaint" value={caseData.chiefComplaint} />
          <Field label="Tooth System" value={caseData.toothSystem} />
        </div>
      </Section>

      {/* Records & Impressions */}
      <Section title="Records & Impressions" icon={BsClipboardPulse}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Impression Method" value={caseData.impressionMethod} />
          <div className="mb-3">
            <div className="mb-1 text-sm font-semibold text-muted-foreground">Impressions Taken</div>
            <TagList items={caseData.impressionsTaken} />
          </div>
          <div className="mb-3">
            <div className="mb-1 text-sm font-semibold text-muted-foreground">Additional Records</div>
            <TagList items={caseData.additionalRecords} />
          </div>
        </div>
      </Section>

      {/* Treatment Parameters */}
      <Section title="Treatment Parameters" icon={BsSliders}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Treat Arches" value={caseData.treatArches} />
          <Field label="Velocity" value={caseData.velocity === 'Other' ? caseData.otherVelocity : caseData.velocity} />
          <Field label="Case Type" value={caseData.caseType} />
          <Field label="Wear Schedule" value={caseData.wearSchedule} />
          <Field label="Retainer" value={caseData.retainer} />
        </div>
      </Section>

      {/* Tooth Selections */}
      <Section title="Tooth Selections" icon={BsGrid}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="mb-3">
            <div className="mb-1 text-sm font-semibold text-muted-foreground">Do Not Move</div>
            <TagList items={caseData.doNotMoveTeeth} />
          </div>
          <div className="mb-3">
            <div className="mb-1 text-sm font-semibold text-muted-foreground">Avoid Attachments</div>
            <TagList items={caseData.avoidAttachmentsTeeth} />
          </div>
          <div className="mb-3">
            <div className="mb-1 text-sm font-semibold text-muted-foreground">Teeth for Extraction</div>
            <TagList items={caseData.teethForExtraction} />
          </div>
          <div className="mb-3">
            <div className="mb-1 text-sm font-semibold text-muted-foreground">Leave Spaces Open</div>
            <TagList items={caseData.leaveSpacesOpen} />
          </div>
        </div>
      </Section>

      {/* Occlusion & Goals */}
      <Section title="Occlusion & Goals" icon={BsBullseye}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Upper Midline" value={`${caseData.upperMidlineValue || '—'} — ${caseData.upperMidlineGoal || '—'}`} />
          <Field label="Lower Midline" value={`${caseData.lowerMidlineValue || '—'} — ${caseData.lowerMidlineGoal || '—'}`} />
          <Field label="Overjet" value={`${caseData.overjetValue || '—'} — ${caseData.overjetGoal || '—'}`} />
          <Field label="Overbite" value={`${caseData.overbiteValue || '—'} — ${caseData.overbiteGoal || '—'}`} />
          <Field label="Canine Relation" value={caseData.canineRelation} />
          <Field label="Molar Relation" value={caseData.molarRelation} />
          <Field label="Anterior Crossbite" value={caseData.anteriorCrossbite} />
          <Field label="Posterior Crossbite" value={caseData.posteriorCrossbite} />
          <Field label="Deciduous Teeth" value={caseData.deciduousTeeth} />
          <Field label="IPR" value={caseData.ipr} />
          <Field label="Engagers" value={caseData.engagers} />
          <Field label="Space Management" value={caseData.spaceManagement} />
        </div>
      </Section>

      {/* Treatment Plan & Notes */}
      <Section title="Treatment Plan & Notes" icon={BsJournalText}>
        <div className="mb-3">
          <div className="mb-1 text-sm font-semibold text-muted-foreground">Treatment Plan</div>
          <div className="font-semibold">{caseData.treatmentPlan || '—'}</div>
        </div>
        {caseData.additionalInfo && (
          <div>
            <div className="mb-1 text-sm font-semibold text-muted-foreground">Additional Information</div>
            <div className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{caseData.additionalInfo}</div>
          </div>
        )}
      </Section>

      {/* Files */}
      <Section
        title="Uploaded Files"
        icon={BsCloudUpload}
        action={
          caseData.status !== 'completed' && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setEditFilesModalOpen(true)}>
              <BsPencilSquare /> Edit Pictures & Scans
            </Button>
          )
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Scan Files */}
          <div>
            <h6 className="mb-2 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <BsEye className="text-primary" /> Scan Files ({caseData.scanFiles?.length || 0})
            </h6>
            <FileGrid files={caseData.scanFiles} emptyLabel="No scan files uploaded." />
          </div>

          {/* Patient Images */}
          <div>
            <h6 className="mb-2 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <BsCardImage className="text-success" /> Patient Images ({caseData.patientImages?.length || 0})
            </h6>
            <FileGrid files={caseData.patientImages} emptyLabel="No patient images uploaded." />
          </div>
        </div>
      </Section>

      {/* Revisions — only meaningful once a case is completed; reuse the case
          with only 3 things (scan files, patient images/xray, special note). */}
      {revisions.length > 0 && (
        <Section title={`Revisions (${revisions.length})`} icon={BsArrowRepeat}>
          <div className="flex flex-col gap-4">
            {revisions.map((r, index) => {
              const revNumber = revisions.length - index;
              const pickedBy = r.pickedBy ? `${r.pickedBy.firstName} ${r.pickedBy.lastName}` : null;
              return (
                <Card key={r._id} className="border shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <strong className="text-base">Revision #{revNumber}</strong>
                        <StatusBadge status={r.status} />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Created {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    {r.specialNote && (
                      <div className="mb-3">
                        <div className="mb-1 text-sm font-semibold text-muted-foreground">Special Note</div>
                        <div className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{r.specialNote}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <h6 className="mb-2 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                          <BsEye className="text-primary" /> Scan Files ({r.scanFiles?.length || 0})
                        </h6>
                        <FileGrid files={r.scanFiles} emptyLabel="No scan files uploaded." />
                      </div>
                      <div>
                        <h6 className="mb-2 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                          <BsCardImage className="text-success" /> Patient Images ({r.patientImages?.length || 0})
                        </h6>
                        <FileGrid files={r.patientImages} emptyLabel="No patient images uploaded." />
                      </div>
                    </div>

                    {r.designLink && (
                      <div className="mt-3">
                        <div className="mb-1 text-sm font-semibold text-muted-foreground">Delivered Design Link</div>
                        <a href={r.designLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                          {r.designLink} <BsBoxArrowUpRight className="text-sm" />
                        </a>
                        {r.deliveredAt && (
                          <p className="mt-1 mb-0 text-sm text-muted-foreground">
                            Delivered on {new Date(r.deliveredAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                        {r.status === 'delivered' ? (
                          <div className="mt-3">
                            <Button size="sm" className="gap-2" onClick={() => handleApproveRevision(r._id)} disabled={approveRevisionLoading}>
                              {approveRevisionLoading ? <Spinner className="border-white" /> : <BsCheckLg />} Approve Design
                            </Button>
                          </div>
                        ) : r.status === 'completed' && r.approvedAt ? (
                          <p className="mt-2 mb-0 text-sm text-muted-foreground">
                            Approved on {new Date(r.approvedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        ) : null}
                      </div>
                    )}

                    {pickedBy && (
                      <p className="mt-3 mb-0 text-sm text-muted-foreground">
                        Picked by <strong>{pickedBy}</strong>
                      </p>
                    )}
                    {r.status === 'hold' && r.holdReason && (
                      <Alert variant="destructive" className="mt-3 border-0 bg-destructive/10">
                        <BsExclamationTriangleFill />
                        <AlertDescription>
                          <span className="font-semibold">On hold:</span> {r.holdReason}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {approveRevisionError && <div className="mt-2 text-sm text-destructive">{approveRevisionError}</div>}
        </Section>
      )}

      </div>

      <RevisionFormModal
        caseId={id}
        open={revisionModalOpen}
        onOpenChange={setRevisionModalOpen}
        onCreated={(revision) => setRevisions((prev) => [revision, ...prev])}
      />

      <EditCaseFilesModal
        caseData={caseData}
        open={editFilesModalOpen}
        onOpenChange={setEditFilesModalOpen}
        onSaved={(updated) => setCaseData((prev) => ({ ...prev, ...updated }))}
      />
    </DashboardShell>
  );
}
