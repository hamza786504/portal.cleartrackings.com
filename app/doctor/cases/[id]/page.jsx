'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
} from 'react-icons/bs';
import DashboardShell from '@/app/_components/doctor/DashboardShell';
import CaseChat from '@/app/_components/CaseChat';
import FileGrid from '@/app/_components/FileGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Button } from '@/app/_components/ui/button';
import { Badge } from '@/app/_components/ui/badge';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import StatusBadge from '@/app/_components/shared/StatusBadge';
import Spinner from '@/app/_components/shared/Spinner';

const Section = ({ title, icon: Icon, children }) => (
  <Card className="mb-4 border-0 shadow-sm">
    <CardHeader className="border-b py-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <Icon className="text-primary" />
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
  delivered: { label: 'Awaiting Your Approval' },
  completed: { label: 'Completed' },
};

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState('');

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

  useEffect(() => {
    if (!id) return;
    fetchCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  return (
    <DashboardShell>
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
        <StatusBadge status={caseData.status} label={STATUS_CONFIG[caseData.status]?.label} className="px-3 py-2 text-sm" />
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

      {/* Design Delivery */}
      {caseData.designLink && (
        <Alert className={`mb-4 border-0 ${caseData.status === 'delivered' ? 'bg-info/15' : 'bg-success/10'}`}>
          <div className="mb-1 flex items-center gap-2">
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
          <Field label="Trimline Height" value={caseData.trimlineHeight} />
          <Field label="Retainer" value={caseData.retainer} />
          <Field label="Plan Duration" value={caseData.planDuration} />
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
      <Section title="Uploaded Files" icon={BsCloudUpload}>
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
    </DashboardShell>
  );
}
