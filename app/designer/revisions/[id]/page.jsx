'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  BsExclamationTriangleFill,
  BsArrowLeft,
  BsFileEarmarkMedical,
  BsPersonCheckFill,
  BsHourglassSplit,
  BsHandIndexThumb,
  BsLink45Deg,
  BsBoxArrowUpRight,
  BsCheckCircleFill,
  BsSend,
  BsChatDots,
  BsEye,
  BsCardImage,
  BsArrowRepeat,
  BsJournalText,
} from 'react-icons/bs';
import DashboardShell from '@/app/_components/designer/DashboardShell';
import CaseChat from '@/app/_components/CaseChat';
import FileGrid from '@/app/_components/FileGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Button } from '@/app/_components/ui/button';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Textarea } from '@/app/_components/ui/textarea';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import StatusBadge from '@/app/_components/shared/StatusBadge';
import Spinner from '@/app/_components/shared/Spinner';

const STATUS_CONFIG = {
  pending: { label: 'Pending' },
  'in-progress': { label: 'In Progress' },
  delivered: { label: 'Delivered — Awaiting Approval' },
  completed: { label: 'Completed' },
  hold: { label: 'On Hold' },
};

const cnIcon = (iconBgClassName) => `flex size-10 items-center justify-center rounded-full text-white ${iconBgClassName}`;

const FileBox = ({ title, Icon, iconBgClassName, files, emptyLabel }) => (
  <div className="flex h-full flex-col rounded-2xl bg-muted p-4">
    <div className="mb-3 flex items-center gap-2">
      <div className={cnIcon(iconBgClassName)}>
        <Icon className="text-lg" />
      </div>
      <span className="text-lg font-semibold">{title}</span>
    </div>
    <div className="flex-grow rounded-lg bg-white p-3">
      <FileGrid files={files} emptyLabel={emptyLabel} />
    </div>
  </div>
);

export default function RevisionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [revision, setRevision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  const [pickLoading, setPickLoading] = useState(false);
  const [pickError, setPickError] = useState('');

  const [designLinkInput, setDesignLinkInput] = useState('');
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [deliverError, setDeliverError] = useState('');

  const fetchRevision = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/revisions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to load revision');
      }
      const data = await res.json();
      setRevision(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUserId(storedUser.id || null);
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchRevision();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePick = async () => {
    setPickLoading(true);
    setPickError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/revisions/${id}/pick`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to pick revision.');
      }
      setRevision(data);
    } catch (err) {
      setPickError(err.message);
    } finally {
      setPickLoading(false);
    }
  };

  const handleDeliver = async (e) => {
    e.preventDefault();
    setDeliverLoading(true);
    setDeliverError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/revisions/${id}/deliver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ designLink: designLinkInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit design link.');
      }
      setRevision(data);
    } catch (err) {
      setDeliverError(err.message);
    } finally {
      setDeliverLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-5">
          <div className="text-center">
            <Spinner className="size-6" />
            <p className="mt-3 text-muted-foreground">Loading revision details...</p>
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

  if (!revision) return null;

  const pickedBy = revision.pickedBy ? `${revision.pickedBy.firstName} ${revision.pickedBy.lastName}` : null;
  const isMine = revision.pickedBy?._id === currentUserId;
  const isOnHold = revision.status === 'hold';
  const patientName = revision.case?.patientName || 'Unknown Case';
  const caseId = revision.case?._id;

  return (
    <DashboardShell>
      {isOnHold && (
        <Alert variant="destructive" className="mb-4 gap-2 border-0 bg-destructive/10">
          <BsExclamationTriangleFill />
          <AlertDescription>
            <span>This revision is on hold by the admin, so you can&apos;t edit it right now.</span>
            {revision.holdReason ? (
              <span className="mt-1 block">
                <strong>Reason:</strong> {revision.holdReason}
              </span>
            ) : null}
            <span className="mt-1 block">It will be available again once the admin changes its status.</span>
          </AlertDescription>
        </Alert>
      )}
      <div className={isOnHold ? 'pointer-events-none opacity-50 select-none' : ''}>
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button variant="link" className="mb-2 gap-1 px-0 text-muted-foreground" onClick={() => router.back()}>
              <BsArrowLeft /> Back to Revisions
            </Button>
            <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
              <BsArrowRepeat className="text-primary" />
              Revision — {patientName}
            </h4>
            {revision.case && (
              <p className="mb-0 text-sm text-muted-foreground">
                Part of case: {revision.case.patientName}
                {revision.case.practiceName ? ` · ${revision.case.practiceName}` : ''}
              </p>
            )}
            <p className="mb-0 text-sm text-muted-foreground">
              Created on{' '}
              {new Date(revision.createdAt).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
          <StatusBadge status={revision.status} label={STATUS_CONFIG[revision.status]?.label} className="px-3 py-2 text-sm" />
        </div>

        {/* Pickup Status */}
        <Alert className={`mb-4 flex flex-wrap items-center justify-between gap-2 border-0 ${pickedBy ? 'bg-info/15' : 'bg-warning/15'}`}>
          <div className="flex items-center gap-2">
            {pickedBy ? (
              <BsPersonCheckFill className="text-lg text-info" />
            ) : (
              <BsHourglassSplit className="text-lg text-warning" />
            )}
            {pickedBy ? (
              <span>
                This revision has been picked up by <strong>{isMine ? 'you' : pickedBy}</strong>.
              </span>
            ) : (
              <span>This revision is <strong>open and available</strong> — no one has picked it up yet.</span>
            )}
          </div>
          {!pickedBy && (
            <Button size="sm" className="gap-1" onClick={handlePick} disabled={pickLoading}>
              {pickLoading ? (
                <Spinner className="border-white" />
              ) : (
                <>
                  <BsHandIndexThumb /> Pick This Revision
                </>
              )}
            </Button>
          )}
        </Alert>
        {pickError && (
          <Alert variant="destructive" className="mb-4">
            <BsExclamationTriangleFill />
            <AlertDescription>{pickError}</AlertDescription>
          </Alert>
        )}

        {/* Design Delivery */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardHeader className="border-b py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BsLink45Deg /> Design Delivery
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revision.designLink ? (
              <div>
                <div className="mb-1 text-sm font-semibold text-muted-foreground">Delivered Design Link</div>
                <a href={revision.designLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                  {revision.designLink} <BsBoxArrowUpRight className="text-sm" />
                </a>
                {revision.deliveredAt && (
                  <p className="mt-2 mb-0 text-sm text-muted-foreground">
                    Delivered on{' '}
                    {new Date(revision.deliveredAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                {revision.status === 'delivered' ? (
                  <Alert className="mt-3 mb-0 gap-2 border-0 bg-warning/15 py-2 px-3 text-sm">
                    <BsHourglassSplit className="text-warning" />
                    <AlertDescription>Awaiting the doctor&apos;s approval.</AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="mt-3 mb-0 gap-2 border-0 bg-success/15 py-2 px-3 text-sm">
                    <BsCheckCircleFill className="text-success" />
                    <AlertDescription>Approved by the doctor.</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : isMine ? (
              <form onSubmit={handleDeliver}>
                <Label className="text-sm font-semibold text-muted-foreground">Link to finished design</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Input
                    type="url"
                    className="max-w-[420px]"
                    placeholder="https://..."
                    value={designLinkInput}
                    onChange={(e) => setDesignLinkInput(e.target.value)}
                    required
                    disabled={deliverLoading}
                  />
                  <Button type="submit" className="gap-2" disabled={deliverLoading}>
                    {deliverLoading ? <Spinner className="border-white" /> : <BsSend />} Submit
                  </Button>
                </div>
                {deliverError && <div className="mt-2 text-sm text-destructive">{deliverError}</div>}
              </form>
            ) : (
              <p className="mb-0 text-sm italic text-muted-foreground">
                No design has been delivered yet for this revision.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Case Chat — revisions reuse the parent case's chat thread */}
        {isMine && caseId ? (
          <CaseChat caseId={caseId} canSend={true} />
        ) : (
          !pickedBy && caseId && (
            <Alert className="mb-4 border text-sm text-muted-foreground">
              <BsChatDots />
              <AlertDescription>Pick this revision to start chatting with the doctor.</AlertDescription>
            </Alert>
          )
        )}

        {/* The 3 things a revision captures */}
        <Card className="mt-4 overflow-hidden rounded-2xl border-0 py-0 shadow-lg">
          <div className="flex items-center gap-3 bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end-light))] p-4 text-white">
            <div className="flex size-20 items-center justify-center rounded-full bg-white/25 p-3">
              <BsEye className="text-3xl font-bold text-white" />
            </div>
            <div>
              <h2 className="mb-1 font-semibold">Revision Record</h2>
              <p className="mb-0 text-white/70">The 3 things captured for this revision</p>
            </div>
          </div>

          <CardContent className="p-4 md:p-8">
            {revision.specialNote && (
              <div className="mb-4">
                <Label className="mb-1 flex items-center gap-1 font-semibold text-muted-foreground">
                  <BsJournalText /> Special Note
                </Label>
                <Textarea className="bg-muted" rows="4" value={revision.specialNote} disabled />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FileBox
                title="Scan Files"
                Icon={BsEye}
                iconBgClassName="bg-primary"
                files={revision.scanFiles}
                emptyLabel="No scan files uploaded."
              />
              <FileBox
                title="Patient Images & Xray"
                Icon={BsCardImage}
                iconBgClassName="bg-success"
                files={revision.patientImages}
                emptyLabel="No patient images uploaded."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
