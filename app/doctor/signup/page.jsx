'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BsPersonPlus,
  BsCheckCircleFill,
  BsExclamationTriangleFill,
  BsPlusLg,
  BsChevronDown,
  BsChevronUp,
  BsInfoCircle,
  BsCloudUpload,
  BsEye,
  BsCardImage,
  BsFiles,
  BsX,
} from 'react-icons/bs';
import { Card } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Textarea } from '@/app/_components/ui/textarea';
import { Button } from '@/app/_components/ui/button';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/app/_components/ui/dropdown-menu';
import TogglePill from '@/app/_components/shared/TogglePill';
import Spinner from '@/app/_components/shared/Spinner';
import PasswordInput from '@/app/_components/shared/PasswordInput';
import { cn } from '@/app/lib/utils';

// ─── Tooth constants ─────────────────────────────────────────────────────────
const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'];
const UPPER_LEFT  = ['21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'];
const LOWER_LEFT  = ['31', '32', '33', '34', '35', '36', '37', '38'];

export default function DoctorSignup() {
  // ── Doctor account fields ──────────────────────────────────────────────────
  const [account, setAccount] = useState({
    doctorName:          '',
    businessName:        '',
    businessAddress:     '',
    contactNumber:       '',
    contactEmail:        '',
    password:            '',
    confirmPassword:     '',
    specialInstructions: '',
  });

  // ── Case fields ────────────────────────────────────────────────────────────
  const [caseData, setCaseData] = useState({
    patientName:        '',
    practiceName:       '',
    chiefComplaint:     '',
    dob:                '2001-09-26',
    toothSystem:        'FDI (recommended)',
    impressionMethod:   'Digital Scan',
    impressionsTaken:   [],
    additionalRecords:  [],
    treatArches:        'Both',
    velocity:           '0.2',
    otherVelocity:      '',
    caseType:           '3 3',
    wearSchedule:       '2 Weeks',
    trimlineHeight:     '1 mm',
    retainer:           'YES',
    planDuration:       '6 months',
    doNotMoveTeeth:     [],
    avoidAttachmentsTeeth: [],
    teethForExtraction: [],
    leaveSpacesOpen:    [],
    upperMidlineValue:  '',
    upperMidlineGoal:   'Maintain',
    lowerMidlineValue:  '',
    lowerMidlineGoal:   'Maintain',
    overjetValue:       '',
    overjetGoal:        'Maintain',
    overbiteValue:      '',
    overbiteGoal:       'Maintain',
    canineRelation:     'Maintain',
    molarRelation:      'Maintain',
    anteriorCrossbite:  'Maintain',
    posteriorCrossbite: 'Maintain',
    deciduousTeeth:     'Maintain',
    ipr:                'NO',
    engagers:           'NO',
    spaceManagement:    'Anterior Retraction',
    additionalInfo:     '',
    treatmentPlan:      '',
    scanFiles:          [],
    patientImages:      [],
  });

  const [errors, setErrors]               = useState({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading]             = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ── Account handlers ───────────────────────────────────────────────────────
  const handleAccountChange = (e) => {
    const { name, value } = e.target;
    setAccount((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  // ── Case handlers ──────────────────────────────────────────────────────────
  const handleCaseInput = (e) => {
    const { name, value } = e.target;
    setCaseData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSelection = (field, value) => {
    setCaseData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'velocity' && value !== 'Other' && errors.otherVelocity)
      setErrors((prev) => ({ ...prev, otherVelocity: '' }));
    if (field === 'treatmentPlan') setIsDropdownOpen(false);
  };

  const handleMultiSelection = (field, value) => {
    setCaseData((prev) => {
      const current = prev[field] || [];
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter((i) => i !== value)
          : [...current, value],
      };
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleTeethToggle = (field, toothNum) => {
    setCaseData((prev) => {
      const current = prev[field] || [];
      return {
        ...prev,
        [field]: current.includes(toothNum)
          ? current.filter((i) => i !== toothNum)
          : [...current, toothNum],
      };
    });
  };

  const handleFileChange = (e, field) => {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) {
      setCaseData((prev) => ({ ...prev, [field]: [...prev[field], ...newFiles] }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
      e.target.value = null;
    }
  };

  const handleRemoveFile = (field, fileName) => {
    setCaseData((prev) => ({
      ...prev,
      [field]: prev[field].filter((f) => f.name !== fileName),
    }));
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRe = /^[0-9+\-\s()]+$/;

    // Account
    if (!account.doctorName.trim())      errs.doctorName      = 'Doctor Name is required';
    if (!account.businessName.trim())    errs.businessName    = 'Business Name is required';
    if (!account.businessAddress.trim()) errs.businessAddress = 'Business Address is required';
    if (!account.contactNumber.trim())   errs.contactNumber   = 'Contact Number is required';
    else if (!phoneRe.test(account.contactNumber.trim())) errs.contactNumber = 'Please enter a valid contact number';
    if (!account.contactEmail.trim())    errs.contactEmail    = 'Contact Email is required';
    else if (!emailRe.test(account.contactEmail.trim())) errs.contactEmail = 'Please enter a valid email address';
    if (!account.password)               errs.password        = 'Password is required';
    else if (account.password.length < 6) errs.password       = 'Password must be at least 6 characters';
    if (!account.confirmPassword)        errs.confirmPassword = 'Please confirm your password';
    else if (account.password !== account.confirmPassword) errs.confirmPassword = 'Passwords do not match';

    // Case
    if (!caseData.patientName.trim())    errs.patientName    = 'Patient Name is required';
    if (!caseData.practiceName.trim())   errs.practiceName   = 'Practice Name is required';
    if (!caseData.chiefComplaint.trim()) errs.chiefComplaint = 'Chief Complaint is required';
    if (!caseData.dob)                   errs.dob            = 'Date of Birth is required';
    if (!caseData.impressionMethod)      errs.impressionMethod = 'Impression Method is required';
    if (!caseData.impressionsTaken.length) errs.impressionsTaken = 'Please select at least one impression';
    if (!caseData.caseType)              errs.caseType       = 'Case type is required';
    if (!caseData.wearSchedule)          errs.wearSchedule   = 'Wear Schedule is required';
    if (!caseData.trimlineHeight)        errs.trimlineHeight = 'Trimline Height is required';
    if (!caseData.retainer)              errs.retainer       = 'Retainer is required';
    if (caseData.velocity === 'Other' && !caseData.otherVelocity.trim())
      errs.otherVelocity = 'Please specify the velocity';
    if (!caseData.treatmentPlan)         errs.treatmentPlan  = 'Treatment Plan is required';
    if (!caseData.scanFiles.length)      errs.scanFiles      = 'Scan Files are required';
    if (!caseData.patientImages.length)  errs.patientImages  = 'Patient Images are required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      // Scroll to first error
      setTimeout(() => {
        document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    setLoading(true);

    const fd = new FormData();

    // Account fields
    const nameParts = account.doctorName.trim().split(' ');
    fd.append('firstName',          nameParts[0]);
    fd.append('lastName',           nameParts.slice(1).join(' ') || '');
    fd.append('email',              account.contactEmail);
    fd.append('password',           account.password);
    fd.append('businessName',       account.businessName);
    fd.append('businessAddress',    account.businessAddress);
    fd.append('contactNumber',      account.contactNumber);
    fd.append('specialInstructions', account.specialInstructions);

    // Case fields
    Object.keys(caseData).forEach((key) => {
      if (key === 'scanFiles' || key === 'patientImages') {
        caseData[key].forEach((file) => fd.append(key, file));
      } else if (Array.isArray(caseData[key])) {
        caseData[key].forEach((item) => fd.append(key, item));
      } else {
        fd.append(key, caseData[key]);
      }
    });

    try {
      const res  = await fetch('/api/auth/signup-with-case', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');
      setSuccessMessage(data.message);
    } catch (err) {
      setErrors({ submit: err.message || 'Submission failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderToothGrid = (title, subtitle, fieldName, selectedArray) => {
    const row = (nums, justify) => (
      <div className={cn('flex flex-grow flex-wrap gap-1', justify)}>
        {nums.map((num) => (
          <TogglePill
            key={num}
            selected={selectedArray.includes(num)}
            onClick={() => handleTeethToggle(fieldName, num)}
            className="min-w-8 rounded-full px-2 py-1 text-xs font-bold"
          >
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

  const renderFileDropzone = (field, title, Icon, iconBgClassName, helperText) => {
    const files = caseData[field] || [];
    return (
      <div>
        <div className="flex h-full flex-col rounded-2xl bg-muted p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className={cn('flex size-10 items-center justify-center rounded-full text-white', iconBgClassName)}>
              <Icon className="text-lg" />
            </div>
            <span className="text-lg font-semibold">{title}</span>
          </div>
          <div className="flex min-h-[150px] flex-grow flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-white p-4 text-center">
            <input
              type="file"
              id={`${field}Input`}
              multiple
              className="hidden"
              onChange={(e) => handleFileChange(e, field)}
              disabled={loading}
            />
            <BsCloudUpload className="text-4xl text-muted-foreground" />
            <h6 className="mt-2 mb-1 font-bold">Drag &amp; Drop Files Here</h6>
            <p className="mb-3 text-sm text-muted-foreground">Multiple files supported • or click to browse</p>
            <Button
              type="button"
              variant="outline"
              className={cn('rounded-full px-4', field === 'scanFiles' ? 'border-primary text-primary' : 'border-success text-success')}
              onClick={() => document.getElementById(`${field}Input`).click()}
              disabled={loading}
            >
              Choose Files
            </Button>
          </div>
          {files.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <BsFiles />
                <span className="text-sm font-semibold">{files.length} files selected</span>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg bg-white p-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border-b py-2 last:border-b-0">
                    <div className="mr-2 max-w-[120px] truncate text-sm font-medium">{file.name}</div>
                    <div className="mr-2 text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                    <Button type="button" variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive" onClick={() => handleRemoveFile(field, file.name)} disabled={loading}>
                      <BsX />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 text-sm text-muted-foreground">{helperText}</div>
          {errors[field] && <div data-error="true" className="mt-1 text-sm text-destructive">{errors[field]}</div>}
        </div>
      </div>
    );
  };

  const getPriceDetails = (plan) => {
    if (plan === 'Setup Review + 3D Printer Ready Files - $40.00')
      return { show: true, name: 'Setup Review + 3D Printer Ready Files', price: '$40.00' };
    if (plan === 'Setup Review Only - $30.00')
      return { show: true, name: 'Setup Review Only', price: '$30.00' };
    return { show: false };
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (successMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <Card className="w-full max-w-[500px] border-0 p-8 shadow-sm text-center">
          <div className="mb-4 inline-flex size-20 items-center justify-center rounded-full bg-success/10">
            <BsCheckCircleFill className="text-4xl text-success" />
          </div>
          <h3 className="mb-3 font-bold text-foreground">Registration &amp; Case Submitted!</h3>
          <p className="mb-4 text-muted-foreground">{successMessage}</p>
          <p className="mb-6 text-sm font-medium text-success">✓ Your case is now pending review by our team.</p>
          <Button asChild className="w-full">
            <Link href="/doctor/login">Go to Login</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-start justify-center bg-white px-4 py-8">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 backdrop-blur-[2px]">
          <div className="flex min-w-[300px] flex-col items-center rounded-2xl bg-white p-6 text-center shadow-lg">
            <Spinner className="size-12 border-primary" />
            <h5 className="mt-3 font-bold">Uploading files &amp; registering...</h5>
            <p className="mb-0 text-sm text-muted-foreground">Please keep this tab open.</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-[900px]">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-start),var(--color-brand-end))]">
            <BsPersonPlus className="text-2xl text-white" />
          </div>
          <h2 className="font-bold text-primary">Doctor Signup</h2>
          <p className="text-sm text-muted-foreground">Create your account and submit your first case in one step</p>
        </div>

        {errors.submit && (
          <Alert variant="destructive" className="mb-4">
            <BsExclamationTriangleFill />
            <AlertDescription>{errors.submit}</AlertDescription>
          </Alert>
        )}

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* ════════════════════════════════════════════════════
              SECTION 1 — Doctor Account
          ════════════════════════════════════════════════════ */}
          <Card className="border-0 p-4 shadow-sm md:p-6">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end-light))] p-4 text-white">
              <div className="flex size-10 items-center justify-center rounded-full bg-white/25">
                <BsPersonPlus className="text-lg" />
              </div>
              <div>
                <h4 className="mb-0 font-semibold">Doctor Account Details</h4>
                <p className="mb-0 text-sm text-white/75">Your login credentials and practice information</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Doctor Name */}
              <div className="grid gap-1.5">
                <Label className="text-muted-foreground">Doctor Full Name <span className="text-destructive">*</span></Label>
                <Input
                  type="text"
                  className={cn('bg-muted', errors.doctorName && 'border-destructive')}
                  name="doctorName"
                  placeholder="e.g. John Smith"
                  value={account.doctorName}
                  onChange={handleAccountChange}
                  disabled={loading}
                  data-error={!!errors.doctorName}
                />
                {errors.doctorName && <div className="text-sm text-destructive">{errors.doctorName}</div>}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Business Name */}
                <div className="grid gap-1.5">
                  <Label className="text-muted-foreground">Business Name <span className="text-destructive">*</span></Label>
                  <Input
                    type="text"
                    className={cn('bg-muted', errors.businessName && 'border-destructive')}
                    name="businessName"
                    value={account.businessName}
                    onChange={handleAccountChange}
                    disabled={loading}
                  />
                  {errors.businessName && <div className="text-sm text-destructive">{errors.businessName}</div>}
                </div>

                {/* Contact Number */}
                <div className="grid gap-1.5">
                  <Label className="text-muted-foreground">Contact # <span className="text-destructive">*</span></Label>
                  <Input
                    type="tel"
                    className={cn('bg-muted', errors.contactNumber && 'border-destructive')}
                    name="contactNumber"
                    value={account.contactNumber}
                    onChange={handleAccountChange}
                    disabled={loading}
                  />
                  {errors.contactNumber && <div className="text-sm text-destructive">{errors.contactNumber}</div>}
                </div>
              </div>

              {/* Business Address */}
              <div className="grid gap-1.5">
                <Label className="text-muted-foreground">Business Address <span className="text-destructive">*</span></Label>
                <Textarea
                  className={cn('bg-muted', errors.businessAddress && 'border-destructive')}
                  name="businessAddress"
                  rows="2"
                  value={account.businessAddress}
                  onChange={handleAccountChange}
                  disabled={loading}
                />
                {errors.businessAddress && <div className="text-sm text-destructive">{errors.businessAddress}</div>}
              </div>

              {/* Contact Email */}
              <div className="grid gap-1.5">
                <Label className="text-muted-foreground">Contact Email Address <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  className={cn('bg-muted', errors.contactEmail && 'border-destructive')}
                  name="contactEmail"
                  value={account.contactEmail}
                  onChange={handleAccountChange}
                  disabled={loading}
                />
                {errors.contactEmail && <div className="text-sm text-destructive">{errors.contactEmail}</div>}
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-muted-foreground">Password <span className="text-destructive">*</span></Label>
                  <PasswordInput
                    className={cn('bg-muted', errors.password && 'border-destructive')}
                    name="password"
                    placeholder="Minimum 6 characters"
                    value={account.password}
                    onChange={handleAccountChange}
                    disabled={loading}
                  />
                  {errors.password && <div className="text-sm text-destructive">{errors.password}</div>}
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-muted-foreground">Confirm Password <span className="text-destructive">*</span></Label>
                  <PasswordInput
                    className={cn('bg-muted', errors.confirmPassword && 'border-destructive')}
                    name="confirmPassword"
                    placeholder="Repeat your password"
                    value={account.confirmPassword}
                    onChange={handleAccountChange}
                    disabled={loading}
                  />
                  {errors.confirmPassword && <div className="text-sm text-destructive">{errors.confirmPassword}</div>}
                </div>
              </div>

              {/* Special Instructions */}
              <div className="grid gap-1.5">
                <Label className="text-muted-foreground">Any Special Instructions</Label>
                <Textarea
                  className="bg-muted"
                  name="specialInstructions"
                  rows="2"
                  value={account.specialInstructions}
                  onChange={handleAccountChange}
                  disabled={loading}
                />
              </div>
            </div>
          </Card>

          {/* ════════════════════════════════════════════════════
              SECTION 2 — Case Details
          ════════════════════════════════════════════════════ */}
          <Card className="overflow-hidden border-0 py-0 shadow-sm">
            <div className="flex items-center gap-3 bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end-light))] p-4 text-white">
              <div className="flex size-10 items-center justify-center rounded-full bg-white/25">
                <BsPlusLg className="text-lg" />
              </div>
              <div>
                <h4 className="mb-0 font-semibold">First Case Details</h4>
                <p className="mb-0 text-sm text-white/75">Add your first patient case — no approval needed</p>
              </div>
            </div>

            <div className="p-4 md:p-6">
              {/* Records & Numbering */}
              <h5 className="mb-4 font-bold">Records &amp; Numbering</h5>
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Left — Patient Info */}
                <div className="flex flex-col gap-3">
                  <div className="mb-1 font-semibold text-muted-foreground">Patient Information</div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Patient Name <span className="text-destructive">*</span></Label>
                    <Input type="text" className={cn('bg-muted', errors.patientName && 'border-destructive')} name="patientName" value={caseData.patientName} onChange={handleCaseInput} disabled={loading} />
                    {errors.patientName && <div data-error="true" className="mt-1 text-sm text-destructive">{errors.patientName}</div>}
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Practice Name <span className="text-destructive">*</span></Label>
                    <Input type="text" className={cn('bg-muted', errors.practiceName && 'border-destructive')} name="practiceName" value={caseData.practiceName} onChange={handleCaseInput} disabled={loading} />
                    {errors.practiceName && <div className="mt-1 text-sm text-destructive">{errors.practiceName}</div>}
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Chief Complaint <span className="text-destructive">*</span></Label>
                    <Textarea className={cn('bg-muted', errors.chiefComplaint && 'border-destructive')} name="chiefComplaint" rows="3" value={caseData.chiefComplaint} onChange={handleCaseInput} disabled={loading} />
                    {errors.chiefComplaint && <div className="mt-1 text-sm text-destructive">{errors.chiefComplaint}</div>}
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Date of Birth <span className="text-destructive">*</span></Label>
                    <Input type="date" className={cn('bg-muted', errors.dob && 'border-destructive')} name="dob" value={caseData.dob} onChange={handleCaseInput} disabled={loading} />
                    {errors.dob && <div className="mt-1 text-sm text-destructive">{errors.dob}</div>}
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Tooth numbering system</Label>
                    <div className="flex flex-wrap gap-2">
                      {['FDI (recommended)', 'Universal', 'Palmer notation'].map((opt) => (
                        <TogglePill key={opt} selected={caseData.toothSystem === opt} onClick={() => handleSelection('toothSystem', opt)} disabled={loading}>{opt}</TogglePill>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Impression Method <span className="text-destructive">*</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {['Digital Scan', 'PVS (both)'].map((opt) => (
                        <TogglePill key={opt} selected={caseData.impressionMethod === opt} onClick={() => handleSelection('impressionMethod', opt)} disabled={loading}>{opt}</TogglePill>
                      ))}
                    </div>
                    {errors.impressionMethod && <div className="mt-1 text-sm text-destructive">{errors.impressionMethod}</div>}
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Impressions Taken <span className="text-destructive">*</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {['Upper', 'Lower', 'Both'].map((opt) => (
                        <TogglePill key={opt} selected={caseData.impressionsTaken.includes(opt)} onClick={() => handleMultiSelection('impressionsTaken', opt)} disabled={loading}>{opt}</TogglePill>
                      ))}
                    </div>
                    {errors.impressionsTaken && <div className="mt-1 text-sm text-destructive">{errors.impressionsTaken}</div>}
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Additional records</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Photos', 'Radiograph', 'Bite Reg'].map((opt) => (
                        <TogglePill key={opt} selected={caseData.additionalRecords.includes(opt)} onClick={() => handleMultiSelection('additionalRecords', opt)} disabled={loading}>{opt}</TogglePill>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right — Treatment Parameters */}
                <div className="flex flex-col gap-3">
                  <div className="mb-1 font-semibold text-muted-foreground">Treatment parameters</div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Treat Arches</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Both', 'Upper', 'Lower'].map((opt) => (
                        <TogglePill key={opt} selected={caseData.treatArches === opt} onClick={() => handleSelection('treatArches', opt)} disabled={loading}>{opt}</TogglePill>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Velocity per stage <span className="text-destructive">*</span></Label>
                    <div className="flex flex-wrap gap-2">
                      <TogglePill selected={caseData.velocity === '0.2'} onClick={() => handleSelection('velocity', '0.2')} disabled={loading}>0.2 mm, 2°</TogglePill>
                      <TogglePill selected={caseData.velocity === '0.3'} onClick={() => handleSelection('velocity', '0.3')} disabled={loading}>0.3 mm, 3°</TogglePill>
                      <TogglePill selected={caseData.velocity === 'Other'} onClick={() => handleSelection('velocity', 'Other')} disabled={loading}>Other</TogglePill>
                    </div>
                    <div className="mt-2">
                      <Label className="mb-1 text-sm text-muted-foreground">Specify (e.g., 0.25 mm, 2.5°)</Label>
                      <Input type="text" className={cn('bg-muted', errors.otherVelocity && 'border-destructive')} name="otherVelocity" value={caseData.otherVelocity} onChange={handleCaseInput} disabled={loading} />
                      {errors.otherVelocity && <div className="mt-1 text-sm text-destructive">{errors.otherVelocity}</div>}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Case type <span className="text-destructive">*</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {['3 3', '4 4', '5 5', '6 6'].map((opt) => (
                        <TogglePill key={opt} selected={caseData.caseType === opt} onClick={() => handleSelection('caseType', opt)} disabled={loading}>{opt}</TogglePill>
                      ))}
                    </div>
                    {errors.caseType && <div className="mt-1 text-sm text-destructive">{errors.caseType}</div>}
                  </div>

                  <h6 className="mt-3 mb-2 font-semibold text-muted-foreground">Manufacturing</h6>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Wear Schedule <span className="text-destructive">*</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {['1 Week', '2 Weeks', '3 Weeks'].map((opt) => (
                        <TogglePill key={opt} selected={caseData.wearSchedule === opt} onClick={() => handleSelection('wearSchedule', opt)} disabled={loading}>{opt}</TogglePill>
                      ))}
                    </div>
                    {errors.wearSchedule && <div className="mt-1 text-sm text-destructive">{errors.wearSchedule}</div>}
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Trimline Height <span className="text-destructive">*</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {['1 mm', '2 mm'].map((opt) => (
                        <TogglePill key={opt} selected={caseData.trimlineHeight === opt} onClick={() => handleSelection('trimlineHeight', opt)} disabled={loading}>{opt}</TogglePill>
                      ))}
                    </div>
                    {errors.trimlineHeight && <div className="mt-1 text-sm text-destructive">{errors.trimlineHeight}</div>}
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Retainer <span className="text-destructive">*</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {['YES', 'NO'].map((opt) => (
                        <TogglePill key={opt} selected={caseData.retainer === opt} onClick={() => handleSelection('retainer', opt)} disabled={loading}>{opt}</TogglePill>
                      ))}
                    </div>
                    {errors.retainer && <div className="mt-1 text-sm text-destructive">{errors.retainer}</div>}
                  </div>

                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Plan Duration</Label>
                    <Input type="text" className="bg-muted" name="planDuration" value={caseData.planDuration} onChange={handleCaseInput} disabled={loading} />
                  </div>
                </div>
              </div>

              {/* Tooth grids */}
              <hr className="mt-10 mb-4" />
              {renderToothGrid('Do Not Move These Teeth (bridges, ankylosed, etc.)', 'Tick the teeth to remain stationary', 'doNotMoveTeeth', caseData.doNotMoveTeeth)}
              {renderToothGrid('Avoid Engagers / Attachments on These Teeth', 'Mark teeth where attachments should be avoided.', 'avoidAttachmentsTeeth', caseData.avoidAttachmentsTeeth)}
              {renderToothGrid('Teeth Planned for Extraction (before treatment)', 'Mark teeth planned for extraction before treatment begins.', 'teethForExtraction', caseData.teethForExtraction)}
              {renderToothGrid('Leave These Spaces Open (tick teeth positions)', 'Mark the teeth positions where spaces should remain open.', 'leaveSpacesOpen', caseData.leaveSpacesOpen)}

              {/* Occlusion & Goals */}
              <hr className="mb-4" />
              <h5 className="mb-4 font-bold">Occlusion &amp; Goals</h5>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Upper Midline (mm)</Label>
                  <Input type="text" className="mb-2 bg-muted" placeholder="e.g., 1.0" name="upperMidlineValue" value={caseData.upperMidlineValue} onChange={handleCaseInput} disabled={loading} />
                  <div className="flex flex-wrap gap-1">
                    {['Maintain', 'Improve → Right', 'Improve → Left', 'Center'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.upperMidlineGoal === opt} onClick={() => handleSelection('upperMidlineGoal', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Lower Midline (mm)</Label>
                  <Input type="text" className="mb-2 bg-muted" placeholder="e.g., 0.5" name="lowerMidlineValue" value={caseData.lowerMidlineValue} onChange={handleCaseInput} disabled={loading} />
                  <div className="flex flex-wrap gap-1">
                    {['Maintain', 'Improve → Right', 'Improve → Left', 'Center'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.lowerMidlineGoal === opt} onClick={() => handleSelection('lowerMidlineGoal', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Overjet (mm)</Label>
                  <Input type="text" className="mb-2 bg-muted" placeholder="e.g., 2.5" name="overjetValue" value={caseData.overjetValue} onChange={handleCaseInput} disabled={loading} />
                  <div className="flex flex-wrap gap-1">
                    {['Maintain', 'Improve'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.overjetGoal === opt} onClick={() => handleSelection('overjetGoal', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Overbite (%)</Label>
                  <Input type="text" className="mb-2 bg-muted" placeholder="e.g., 20%" name="overbiteValue" value={caseData.overbiteValue} onChange={handleCaseInput} disabled={loading} />
                  <div className="flex flex-wrap gap-1">
                    {['Maintain', 'Improve'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.overbiteGoal === opt} onClick={() => handleSelection('overbiteGoal', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Canine Relation</Label>
                  <div className="flex flex-wrap gap-1">
                    {['Maintain', 'Improve', 'Ideal'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.canineRelation === opt} onClick={() => handleSelection('canineRelation', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Molar Relation</Label>
                  <div className="flex flex-wrap gap-1">
                    {['Maintain', 'Improve', 'Ideal'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.molarRelation === opt} onClick={() => handleSelection('molarRelation', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Anterior Crossbite</Label>
                  <div className="flex flex-wrap gap-1">
                    {['Maintain', 'Correct'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.anteriorCrossbite === opt} onClick={() => handleSelection('anteriorCrossbite', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Posterior Crossbite</Label>
                  <div className="flex flex-wrap gap-1">
                    {['Maintain', 'Correct'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.posteriorCrossbite === opt} onClick={() => handleSelection('posteriorCrossbite', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Deciduous Teeth</Label>
                  <div className="flex flex-wrap gap-1">
                    {['Maintain', 'Move', 'Extract'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.deciduousTeeth === opt} onClick={() => handleSelection('deciduousTeeth', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">IPR</Label>
                  <div className="flex flex-wrap gap-1">
                    {['YES', 'NO'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.ipr === opt} onClick={() => handleSelection('ipr', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Engagers</Label>
                  <div className="flex flex-wrap gap-1">
                    {['YES', 'NO'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.engagers === opt} onClick={() => handleSelection('engagers', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1 text-sm font-semibold text-muted-foreground">Space Management</Label>
                  <div className="flex flex-wrap gap-1">
                    {['Anterior Retraction', 'Posterior Mesialization'].map((opt) => (
                      <TogglePill key={opt} selected={caseData.spaceManagement === opt} onClick={() => handleSelection('spaceManagement', opt)} disabled={loading}>{opt}</TogglePill>
                    ))}
                  </div>
                </div>
              </div>

              {/* Additional Info & Treatment Plan */}
              <hr className="mt-10 mb-4" />
              <div className="mb-4">
                <Label className="mb-1 font-semibold text-muted-foreground">Additional Information</Label>
                <Textarea className="bg-muted" name="additionalInfo" rows="4" placeholder="Notes, step-by-step instructions, special considerations" value={caseData.additionalInfo} onChange={handleCaseInput} disabled={loading} />
              </div>

              <div className="mb-4">
                <Label className="mb-1 font-semibold text-muted-foreground">Treatment Plan <span className="text-destructive">*</span></Label>
                <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left"
                      disabled={loading}
                    >
                      <span className={caseData.treatmentPlan ? 'text-foreground' : 'text-muted-foreground'}>
                        {caseData.treatmentPlan || '-- Select Treatment Plan --'}
                      </span>
                      {isDropdownOpen ? <BsChevronUp /> : <BsChevronDown />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                    <DropdownMenuLabel>Orthodontics</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleSelection('treatmentPlan', 'Setup Review + 3D Printer Ready Files - $40.00')}>
                      Setup Review + 3D Printer Ready Files - $40.00
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSelection('treatmentPlan', 'Setup Review Only - $30.00')}>
                      Setup Review Only - $30.00
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {getPriceDetails(caseData.treatmentPlan).show && (
                  <Alert className="mt-2 flex items-center justify-between border-0 bg-info/15">
                    <div className="flex items-center gap-2">
                      <BsInfoCircle className="text-lg text-info" />
                      <span className="font-medium">{getPriceDetails(caseData.treatmentPlan).name}</span>
                    </div>
                    <span className="text-lg font-bold">{getPriceDetails(caseData.treatmentPlan).price}</span>
                  </Alert>
                )}
                <div className="mt-1 text-sm text-muted-foreground">Choose the appropriate treatment plan for this case.</div>
                {errors.treatmentPlan && <div className="mt-1 text-sm text-destructive">{errors.treatmentPlan}</div>}
              </div>

              {/* File Uploads */}
              <div className="mb-4">
                <Label className="mb-2 text-lg font-semibold text-muted-foreground">Patient Data Files <span className="text-destructive">*</span></Label>
                <Alert className="mt-1 mb-3 items-start border-0 bg-info/15">
                  <BsInfoCircle className="text-lg text-info" />
                  <AlertDescription className="text-sm">
                    <strong>Note:</strong> Compressed files (.zip, .rar, .7z) should contain STL model files. Maximum file size: <strong>300MB per file</strong>.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {renderFileDropzone('scanFiles',     'Scan Files',     BsEye,       'bg-primary', 'Upload 3D model files (.stl, .obj) or compressed files (.zip, .rar, .7z)')}
                  {renderFileDropzone('patientImages', 'Patient Images', BsCardImage, 'bg-success', 'Upload patient photos and scans')}
                </div>
              </div>
            </div>
          </Card>

          {/* ── Submit ── */}
          <div className="flex flex-col gap-3">
            <Button type="submit" size="lg" className="w-full gap-2 py-3 text-base font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Spinner className="border-white" />
                  Registering &amp; Submitting Case...
                </>
              ) : (
                <>
                  <BsPlusLg /> Register &amp; Submit Case
                </>
              )}
            </Button>
            <div className="text-center text-sm">
              <Link href="/doctor/login" className="text-primary no-underline">
                Already have an account? Login
              </Link>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
