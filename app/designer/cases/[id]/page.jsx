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
  BsInfoCircle,
  BsEye,
  BsCardImage,
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
import TogglePill from '@/app/_components/shared/TogglePill';
import StatusBadge from '@/app/_components/shared/StatusBadge';
import Spinner from '@/app/_components/shared/Spinner';
import { cn } from '@/app/lib/utils';

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

const STATUS_CONFIG = {
  pending: { label: 'Pending' },
  'in-progress': { label: 'In Progress' },
  delivered: { label: 'Delivered — Awaiting Approval' },
  completed: { label: 'Completed' },
};

const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'];
const UPPER_LEFT = ['21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'];
const LOWER_LEFT = ['31', '32', '33', '34', '35', '36', '37', '38'];

function getPriceDetails(plan) {
  if (!plan) return { show: false };
  if (plan === 'Setup Review + 3D Printer Ready Files - $40.00') {
    return { show: true, name: 'Setup Review + 3D Printer Ready Files', price: '$40.00' };
  }
  if (plan === 'Setup Review Only - $30.00') {
    return { show: true, name: 'Setup Review Only', price: '$30.00' };
  }
  return { show: false };
}

// Read-only pill row — same visual language as the doctor's "Create Case"
// form (TogglePill), just non-interactive: no onClick, always disabled.
const PillRow = ({ options, value }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <TogglePill key={opt} selected={value === opt} disabled>
        {opt}
      </TogglePill>
    ))}
  </div>
);

const ToothGrid = ({ title, subtitle, selectedArray }) => {
  const selected = selectedArray || [];
  const row = (nums, justify) => (
    <div className={cn('flex flex-grow flex-wrap gap-1', justify)}>
      {nums.map((num) => (
        <TogglePill key={num} selected={selected.includes(num)} disabled className="min-w-8 rounded-full px-2 py-1 text-xs font-bold">
          {num}
        </TogglePill>
      ))}
    </div>
  );

  return (
    <div className="mb-10">
      <h5 className="mb-2 font-bold text-foreground">{title}</h5>
      <p className="mb-3 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mb-3 rounded-lg bg-muted p-3">
        <div className="mb-2 flex items-center">
          <span className="mr-2 font-bold text-destructive">R</span>
          {row(UPPER_RIGHT, 'justify-end')}
          <div className="mx-2 min-h-8 w-0.5 self-stretch bg-destructive" />
          {row(UPPER_LEFT, 'justify-start')}
          <span className="ml-2 font-bold text-destructive">L</span>
        </div>
        <div className="mt-3 flex items-center border-t pt-3">
          <span className="mr-2 font-bold text-destructive">R</span>
          {row(LOWER_RIGHT, 'justify-end')}
          <div className="mx-2 min-h-8 w-0.5 self-stretch bg-destructive" />
          {row(LOWER_LEFT, 'justify-start')}
          <span className="ml-2 font-bold text-destructive">L</span>
        </div>
      </div>
    </div>
  );
};

const FileBox = ({ title, Icon, iconBgClassName, files, emptyLabel }) => (
  <div className="flex h-full flex-col rounded-2xl bg-muted p-4">
    <div className="mb-3 flex items-center gap-2">
      <div className={cn('flex size-10 items-center justify-center rounded-full text-white', iconBgClassName)}>
        <Icon className="text-lg" />
      </div>
      <span className="text-lg font-semibold">{title}</span>
    </div>
    <div className="flex-grow rounded-lg bg-white p-3">
      <FileGrid files={files} emptyLabel={emptyLabel} />
    </div>
  </div>
);

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  const [pickLoading, setPickLoading] = useState(false);
  const [pickError, setPickError] = useState('');

  const [designLinkInput, setDesignLinkInput] = useState('');
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [deliverError, setDeliverError] = useState('');

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
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUserId(storedUser.id || null);
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePick = async () => {
    setPickLoading(true);
    setPickError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/cases/${id}/pick`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to pick case.');
      }
      setCaseData(data);
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
      const res = await fetch(`/api/cases/${id}/deliver`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ designLink: designLinkInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit design link.');
      }
      setCaseData(data);
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
  const isMine = caseData.pickedBy?._id === currentUserId;
  const priceDetails = getPriceDetails(caseData.treatmentPlan);

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
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <StatusBadge status={caseData.status} label={STATUS_CONFIG[caseData.status]?.label} className="px-3 py-2 text-sm" />
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
              This case has been picked up by <strong>{isMine ? 'you' : pickedBy}</strong>.
            </span>
          ) : (
            <span>This case is <strong>open and available</strong> — no one has picked it up yet.</span>
          )}
        </div>
        {!pickedBy && (
          <Button size="sm" className="gap-1" onClick={handlePick} disabled={pickLoading}>
            {pickLoading ? (
              <Spinner className="border-white" />
            ) : (
              <>
                <BsHandIndexThumb /> Pick This Case
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
      <Section title="Design Delivery" icon={BsLink45Deg}>
        {caseData.designLink ? (
          <div>
            <div className="mb-1 text-sm font-semibold text-muted-foreground">Delivered Design Link</div>
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
            {caseData.status === 'delivered' ? (
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
                {deliverLoading ? (
                  <Spinner className="border-white" />
                ) : (
                  <>
                    <BsSend /> Submit
                  </>
                )}
              </Button>
            </div>
            {deliverError && <div className="mt-2 text-sm text-destructive">{deliverError}</div>}
          </form>
        ) : (
          <p className="mb-0 text-sm italic text-muted-foreground">
            No design has been delivered yet for this case.
          </p>
        )}
      </Section>

      {/* Case Chat */}
      {isMine ? (
        <CaseChat caseId={id} canSend={true} />
      ) : (
        !pickedBy && (
          <Alert className="mb-4 border text-sm text-muted-foreground">
            <BsChatDots />
            <AlertDescription>Pick this case to start chatting with the doctor.</AlertDescription>
          </Alert>
        )
      )}

      {/* Case Record — mirrors the doctor's "Create Case" form layout, read-only */}
      <Card className="overflow-hidden rounded-2xl border-0 py-0 shadow-lg">
        <div className="flex items-center gap-3 bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end-light))] p-4 text-white">
          <div className="flex size-20 items-center justify-center rounded-full bg-white/25 p-3">
            <BsEye className="text-3xl font-bold text-white" />
          </div>
          <div>
            <h2 className="mb-1 font-semibold">Case Record</h2>
            <p className="mb-0 text-white/70">Read-only view of the submitted case data</p>
          </div>
        </div>

        <CardContent className="p-4 md:p-8">
          <h4 className="mb-4 font-bold">Records & Numbering</h4>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="mb-1 font-semibold text-muted-foreground">Patient Information</div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Patient Name</Label>
                <Input className="bg-muted" value={caseData.patientName || ''} disabled />
              </div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Chief Complaint</Label>
                <Textarea className="bg-muted" rows="3" value={caseData.chiefComplaint || ''} disabled />
              </div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Date of Birth</Label>
                <Input className="bg-muted" value={caseData.dob || ''} disabled />
              </div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Tooth numbering system</Label>
                <PillRow options={['FDI (recommended)', 'Universal', 'Palmer notation']} value={caseData.toothSystem} />
              </div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Impression Method</Label>
                <PillRow options={['Digital Scan', 'PVS (both)']} value={caseData.impressionMethod} />
              </div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Impressions Taken</Label>
                <div className="flex flex-wrap gap-2">
                  {['Upper', 'Lower', 'Both'].map((opt) => (
                    <TogglePill key={opt} selected={caseData.impressionsTaken?.includes(opt)} disabled>
                      {opt}
                    </TogglePill>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Additional records</Label>
                <div className="flex flex-wrap gap-2">
                  {['Photos', 'Radiograph', 'Bite Reg'].map((opt) => (
                    <TogglePill key={opt} selected={caseData.additionalRecords?.includes(opt)} disabled>
                      {opt}
                    </TogglePill>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="mb-1 font-semibold text-muted-foreground">Treatment parameters</div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Treat Arches</Label>
                <PillRow options={['Both', 'Upper', 'Lower']} value={caseData.treatArches} />
              </div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Velocity per stage</Label>
                <div className="flex flex-wrap gap-2">
                  <TogglePill selected={caseData.velocity === '0.2'} disabled>0.2 mm, 2°</TogglePill>
                  <TogglePill selected={caseData.velocity === '0.3'} disabled>0.3 mm, 3°</TogglePill>
                  <TogglePill selected={caseData.velocity === 'Other'} disabled>Other</TogglePill>
                </div>
                {caseData.velocity === 'Other' && (
                  <div className="mt-2">
                    <Label className="mb-1 text-sm text-muted-foreground">Specify</Label>
                    <Input className="bg-muted" value={caseData.otherVelocity || ''} disabled />
                  </div>
                )}
              </div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Case type</Label>
                <PillRow options={['3 3', '4 4', '5 5', '6 6']} value={caseData.caseType} />
              </div>
              <h6 className="mt-3 mb-2 font-semibold text-muted-foreground">Manufacturing</h6>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Wear Schedule</Label>
                <PillRow options={['1 Week', '2 Weeks', '10 days']} value={caseData.wearSchedule} />
              </div>
              <div>
                <Label className="mb-1 text-sm font-semibold text-muted-foreground">Retainer</Label>
                <PillRow options={['YES', 'NO']} value={caseData.retainer} />
              </div>
            </div>
          </div>

          <hr className="mt-10 mb-4" />
          <ToothGrid
            title="Do Not Move These Teeth (bridges, ankylosed, etc.)"
            subtitle="Teeth marked to remain stationary"
            selectedArray={caseData.doNotMoveTeeth}
          />
          <ToothGrid
            title="Avoid Engagers / Attachments on These Teeth"
            subtitle="Teeth marked where attachments should be avoided."
            selectedArray={caseData.avoidAttachmentsTeeth}
          />
          <ToothGrid
            title="Teeth Planned for Extraction (before treatment)"
            subtitle="Teeth marked for extraction before treatment begins."
            selectedArray={caseData.teethForExtraction}
          />
          <ToothGrid
            title="Leave These Spaces Open (tick teeth positions)"
            subtitle="Teeth positions marked where spaces should remain open."
            selectedArray={caseData.leaveSpacesOpen}
          />

          <hr className="mb-4" />
          <h5 className="mb-4 font-bold">Occlusion & Goals</h5>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Upper Midline (mm)</Label>
              <Input className="mb-2 bg-muted" value={caseData.upperMidlineValue || ''} disabled />
              <PillRow options={['Maintain', 'Improve → Right', 'Improve → Left', 'Center']} value={caseData.upperMidlineGoal} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Lower Midline (mm)</Label>
              <Input className="mb-2 bg-muted" value={caseData.lowerMidlineValue || ''} disabled />
              <PillRow options={['Maintain', 'Improve → Right', 'Improve → Left', 'Center']} value={caseData.lowerMidlineGoal} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Overjet (mm)</Label>
              <Input className="mb-2 bg-muted" value={caseData.overjetValue || ''} disabled />
              <PillRow options={['Maintain', 'Improve']} value={caseData.overjetGoal} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Overbite (%)</Label>
              <Input className="mb-2 bg-muted" value={caseData.overbiteValue || ''} disabled />
              <PillRow options={['Maintain', 'Improve']} value={caseData.overbiteGoal} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Canine Relation</Label>
              <PillRow options={['Maintain', 'Improve', 'Ideal']} value={caseData.canineRelation} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Molar Relation</Label>
              <PillRow options={['Maintain', 'Improve', 'Ideal']} value={caseData.molarRelation} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Anterior Crossbite</Label>
              <PillRow options={['Maintain', 'Correct']} value={caseData.anteriorCrossbite} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Posterior Crossbite</Label>
              <PillRow options={['Maintain', 'Correct']} value={caseData.posteriorCrossbite} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Deciduous Teeth</Label>
              <PillRow options={['Maintain', 'Move', 'Extract']} value={caseData.deciduousTeeth} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">IPR</Label>
              <PillRow options={['YES', 'NO']} value={caseData.ipr} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Engagers</Label>
              <PillRow options={['YES', 'NO']} value={caseData.engagers} />
            </div>
            <div>
              <Label className="mb-1 text-sm font-semibold text-muted-foreground">Space Management</Label>
              <PillRow options={['Anterior Retraction', 'Posterior Mesialization']} value={caseData.spaceManagement} />
            </div>
          </div>

          <hr className="mt-10 mb-4" />
          <div className="mb-4">
            <Label className="mb-1 font-semibold text-muted-foreground">Additional Information</Label>
            <Textarea className="bg-muted" rows="4" value={caseData.additionalInfo || ''} disabled />
          </div>
          <div className="mb-4">
            <Label className="mb-1 font-semibold text-muted-foreground">Treatment Plan</Label>
            <div className="flex w-full items-center justify-between rounded-md border bg-muted px-3 py-2">
              <span>{caseData.treatmentPlan || '—'}</span>
            </div>
            {priceDetails.show && (
              <Alert className="mt-2 flex items-center justify-between border-0 bg-info/15">
                <div className="flex items-center gap-2">
                  <BsInfoCircle className="text-lg text-info" />
                  <span className="font-medium">{priceDetails.name}</span>
                </div>
                <span className="text-lg font-bold">{priceDetails.price}</span>
              </Alert>
            )}
          </div>
          <div className="mb-4">
            <Label className="mb-2 text-lg font-semibold text-muted-foreground">Patient Data Files</Label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FileBox
                title="Scan Files"
                Icon={BsEye}
                iconBgClassName="bg-primary"
                files={caseData.scanFiles}
                emptyLabel="No scan files uploaded."
              />
              <FileBox
                title="Patient Images & Xray"
                Icon={BsCardImage}
                iconBgClassName="bg-success"
                files={caseData.patientImages}
                emptyLabel="No patient images uploaded."
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
