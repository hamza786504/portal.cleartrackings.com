'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  BsExclamationTriangleFill,
  BsArrowLeft,
  BsFileEarmarkMedical,
  BsPersonDash,
  BsTrash,
  BsCheckCircleFill,
  BsBoxArrowUpRight,
  BsPeople,
  BsPersonCircle,
  BsClipboardPulse,
  BsSliders,
  BsGrid,
  BsBullseye,
  BsJournalText,
  BsCloudUpload,
  BsEye,
  BsCardImage,
  BsArrowRepeat,
} from 'react-icons/bs';
import DashboardShell from '@/app/_components/admin/DashboardShell';
import HoldCaseModal from '@/app/_components/admin/HoldCaseModal';
import CaseChat from '@/app/_components/CaseChat';
import FileGrid from '@/app/_components/FileGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Button } from '@/app/_components/ui/button';
import { Badge } from '@/app/_components/ui/badge';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import StatusBadge from '@/app/_components/shared/StatusBadge';
import Spinner from '@/app/_components/shared/Spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/_components/ui/dialog';
import { Textarea } from '@/app/_components/ui/textarea';

const Section = ({ title, icon: Icon, children }) => (
  <Card className="mb-4 border-0 shadow-sm">
    <CardHeader className="border-b py-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <Icon />
        {title}
      </CardTitle>
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
  delivered: { label: 'Delivered — Awaiting Approval' },
  completed: { label: 'Completed' },
  hold: { label: 'On Hold' },
};

export default function AdminCaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [holdModalOpen, setHoldModalOpen] = useState(false);

  const [revisions, setRevisions] = useState([]);
  const [revisionActionLoading, setRevisionActionLoading] = useState(false);
  const [revisionHoldOpen, setRevisionHoldOpen] = useState(false);
  const [revisionHoldId, setRevisionHoldId] = useState(null);
  const [revisionHoldReason, setRevisionHoldReason] = useState('');
  const [revisionError, setRevisionError] = useState('');

  const fetchCase = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/cases/${id}`, {
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

  const patchCase = async (body) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update case');
      setCaseData(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteCase = async () => {
    if (
      !confirm(
        'Delete this case permanently? This also deletes the entire chat thread and every image shared on this case (including their Google Drive files). This cannot be undone.'
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/cases/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete case');
      router.push('/admin/cases');
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const patchRevision = async (revisionId, body) => {
    setRevisionActionLoading(true);
    setRevisionError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/revisions/${revisionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update revision');
      setRevisions((prev) => prev.map((r) => (r._id === revisionId ? data : r)));
    } catch (err) {
      setRevisionError(err.message);
    } finally {
      setRevisionActionLoading(false);
    }
  };

  const handleRevisionUnassign = (revisionId) => {
    if (confirm('Unassign the designer from this revision and set it back to Pending?')) {
      patchRevision(revisionId, { unassign: true });
    }
  };

  const openRevisionHold = (revisionId) => {
    setRevisionHoldId(revisionId);
    setRevisionHoldReason('');
    setRevisionHoldOpen(true);
  };

  const handleRevisionHoldSubmit = () => {
    const trimmed = revisionHoldReason.trim();
    if (!trimmed) {
      setRevisionError('A reason is required to put a revision on hold.');
      return;
    }
    patchRevision(revisionHoldId, { status: 'hold', holdReason: trimmed });
    setRevisionHoldOpen(false);
  };

  const deleteRevision = async (revisionId) => {
    if (
      !confirm(
        'Delete this revision permanently? This also deletes its files from Google Drive and cannot be undone.'
      )
    ) {
      return;
    }
    setRevisionActionLoading(true);
    setRevisionError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/revisions/${revisionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete revision');
      setRevisions((prev) => prev.filter((r) => r._id !== revisionId));
    } catch (err) {
      setRevisionError(err.message);
    } finally {
      setRevisionActionLoading(false);
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
            <BsArrowLeft />Go Back
          </Button>
        </div>
      </DashboardShell>
    );
  }

  if (!caseData) return null;

  const doctor = caseData.doctorId;
  const designer = caseData.pickedBy;

  // Effective status: a reopened case (one with revisions) shows the latest
  // revision's status instead of the parent case's "completed" status.
  const displayStatus = caseData.revisionStatus ?? caseData.status;

  return (
    <DashboardShell>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="link" className="mb-2 gap-1 px-0 text-muted-foreground" onClick={() => router.back()}>
            <BsArrowLeft /> Back to Cases
          </Button>
          <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <BsFileEarmarkMedical />
            Case: {caseData.patientName}
          </h4>
          <p className="mb-0 text-sm text-muted-foreground">
            Submitted on{' '}
            {new Date(caseData.createdAt).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <StatusBadge status={displayStatus} label={STATUS_CONFIG[displayStatus]?.label} className="px-3 py-2 text-sm" />
      </div>

      {/* Admin Controls */}
      <Card className="mb-4 border-0 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3">
          <strong className="text-sm">Admin controls:</strong>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {['pending', 'in-progress', 'delivered', 'completed', 'hold'].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={displayStatus === s ? 'default' : 'outline'}
                className={displayStatus === s ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                disabled={actionLoading || displayStatus === s}
                onClick={() => {
                  if (s === 'hold') {
                    setHoldModalOpen(true);
                  } else {
                    patchCase({ status: s });
                  }
                }}
              >
                {STATUS_CONFIG[s].label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Paid:</span>
            <input
              type="checkbox"
              aria-label="Mark case as paid"
              className="size-4 cursor-pointer accent-success"
              checked={!!caseData.paid}
              disabled={actionLoading}
              onChange={(e) => patchCase({ paid: e.target.checked })}
            />
          </div>

          {designer && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto gap-1 border-destructive text-destructive"
              disabled={actionLoading}
              onClick={() => {
                if (confirm(`Unassign ${designer.firstName} ${designer.lastName} from this case and set it back to Pending?`)) {
                  patchCase({ unassign: true });
                }
              }}
            >
              <BsPersonDash /> Unassign Designer
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-destructive text-destructive"
            disabled={actionLoading}
            onClick={deleteCase}
          >
            <BsTrash /> Delete Case
          </Button>
        </CardContent>
      </Card>

      {/* Doctor / Designer info */}
      <Section title="Doctor & Designer" icon={BsPeople}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Doctor" value={doctor ? `${doctor.firstName} ${doctor.lastName} (${doctor.email})` : '—'} />
          <Field label="Practice Name" value={caseData.practiceName} />
          <Field label="Designer" value={designer ? `${designer.firstName} ${designer.lastName} (${designer.email})` : 'Unassigned'} />
        </div>
      </Section>

      {caseData.designLink && (
        <Alert className="mb-4 border-0 bg-success/10">
          <div className="mb-1 flex items-center gap-2">
            <BsCheckCircleFill className="text-lg text-success" />
            <strong>Design Delivered</strong>
          </div>
          <AlertDescription>
            <a href={caseData.designLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
              {caseData.designLink} <BsBoxArrowUpRight className="text-sm" />
            </a>
            {caseData.deliveredAt && (
              <p className="mt-2 mb-0 text-sm text-muted-foreground">
                Delivered on{' '}
                {new Date(caseData.deliveredAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Case Chat — admin can post too, to share files/instructions with doctor & designer */}
      <CaseChat caseId={id} canSend={true} />

      <Section title="Patient Information" icon={BsPersonCircle}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Patient Name" value={caseData.patientName} />
          <Field label="Date of Birth" value={caseData.dob} />
          <Field label="Chief Complaint" value={caseData.chiefComplaint} />
          <Field label="Tooth System" value={caseData.toothSystem} />
        </div>
      </Section>

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

      <Section title="Treatment Parameters" icon={BsSliders}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Treat Arches" value={caseData.treatArches} />
          <Field label="Velocity" value={caseData.velocity === 'Other' ? caseData.otherVelocity : caseData.velocity} />
          <Field label="Case Type" value={caseData.caseType} />
          <Field label="Wear Schedule" value={caseData.wearSchedule} />
          <Field label="Retainer" value={caseData.retainer} />
        </div>
      </Section>

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

      <Section title="Uploaded Files" icon={BsCloudUpload}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h6 className="mb-2 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <BsEye className="text-primary" /> Scan Files ({caseData.scanFiles?.length || 0})
            </h6>
            <FileGrid files={caseData.scanFiles} emptyLabel="No scan files uploaded." />
          </div>

          <div>
            <h6 className="mb-2 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <BsCardImage className="text-success" /> Patient Images ({caseData.patientImages?.length || 0})
            </h6>
            <FileGrid files={caseData.patientImages} emptyLabel="No patient images uploaded." />
          </div>
        </div>
      </Section>

      {/* Revisions — re-opened work on this completed case */}
      <Section title="Revisions" icon={BsArrowRepeat}>
        {revisions.length === 0 ? (
          <p className="mb-0 text-sm italic text-muted-foreground">
            No revisions have been created for this case yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {revisionError && (
              <Alert variant="destructive" className="mb-2">
                <BsExclamationTriangleFill />
                <AlertDescription>{revisionError}</AlertDescription>
              </Alert>
            )}
            {revisions.map((r) => {
              const pickedBy = r.pickedBy ? `${r.pickedBy.firstName} ${r.pickedBy.lastName}` : null;
              const created = r.createdAt
                ? new Date(r.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '—';
              return (
                <Card key={r._id} className="border-0 shadow-sm">
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          status={r.status}
                          label={STATUS_CONFIG[r.status]?.label}
                          className="px-2 py-1 text-xs"
                        />
                        <span className="text-sm text-muted-foreground">Created {created}</span>
                      </div>
                      {r.holdReason && (
                        <span className="text-xs text-destructive">On hold: {r.holdReason}</span>
                      )}
                    </div>

                    {r.specialNote && (
                      <div>
                        <div className="mb-1 text-sm font-semibold text-muted-foreground">Special Note</div>
                        <div className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{r.specialNote}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <h6 className="mb-2 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                          <BsEye className="text-primary" /> Scan Files ({r.scanFiles?.length || 0})
                        </h6>
                        <FileGrid files={r.scanFiles} emptyLabel="No scan files." />
                      </div>
                      <div>
                        <h6 className="mb-2 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                          <BsCardImage className="text-success" /> Patient Images ({r.patientImages?.length || 0})
                        </h6>
                        <FileGrid files={r.patientImages} emptyLabel="No patient images." />
                      </div>
                    </div>

                    {r.designLink && (
                      <div>
                        <div className="mb-1 text-sm font-semibold text-muted-foreground">Design Link</div>
                        <a
                          href={r.designLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2"
                        >
                          {r.designLink} <BsBoxArrowUpRight className="text-sm" />
                        </a>
                        {r.deliveredAt && (
                          <p className="mt-1 mb-0 text-sm text-muted-foreground">
                            Delivered{' '}
                            {new Date(r.deliveredAt).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                        {r.approvedAt && (
                          <p className="mt-1 mb-0 text-sm text-muted-foreground">
                            Approved{' '}
                            {new Date(r.approvedAt).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                    )}

                    {pickedBy && (
                      <div className="text-sm text-muted-foreground">
                        Picked by <strong>{pickedBy}</strong>
                      </div>
                    )}

                    {/* Admin controls — mirror the case-level controls */}
                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      {['pending', 'in-progress', 'delivered', 'completed', 'hold'].map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={r.status === s ? 'default' : 'outline'}
                          className={r.status === s ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                          disabled={revisionActionLoading || r.status === s}
                          onClick={() => {
                            if (s === 'hold') openRevisionHold(r._id);
                            else patchRevision(r._id, { status: s });
                          }}
                        >
                          {STATUS_CONFIG[s].label}
                        </Button>
                      ))}

                      <span className="text-sm text-muted-foreground">Paid:</span>
                      <input
                        type="checkbox"
                        aria-label={`Mark revision ${r._id} as paid`}
                        className="size-4 cursor-pointer accent-success"
                        checked={!!r.paid}
                        disabled={revisionActionLoading}
                        onChange={(e) => patchRevision(r._id, { paid: e.target.checked })}
                      />

                      {pickedBy && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto gap-1 border-destructive text-destructive"
                          disabled={revisionActionLoading}
                          onClick={() => {
                            if (confirm(`Unassign ${pickedBy} from this revision and set it back to Pending?`)) {
                              patchRevision(r._id, { unassign: true });
                            }
                          }}
                        >
                          <BsPersonDash /> Unassign
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-destructive text-destructive"
                        disabled={revisionActionLoading}
                        onClick={() => deleteRevision(r._id)}
                      >
                        <BsTrash /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      {/* Revision hold dialog */}
      <Dialog open={revisionHoldOpen} onOpenChange={setRevisionHoldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put revision on hold</DialogTitle>
            <DialogDescription>
              The revision&apos;s designer won&apos;t be able to edit it until you change its status again. A
              reason is required.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for putting this revision on hold"
            value={revisionHoldReason}
            onChange={(e) => setRevisionHoldReason(e.target.value)}
            rows={3}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevisionHoldOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRevisionHoldSubmit} disabled={revisionActionLoading}>
              Put on Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
