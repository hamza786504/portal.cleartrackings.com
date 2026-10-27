'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BsPlusLg,
  BsArrowLeft,
  BsChevronDown,
  BsChevronUp,
  BsInfoCircle,
  BsCloudUpload,
  BsEye,
  BsCardImage,
  BsFiles,
  BsX,
} from 'react-icons/bs';
import DashboardShell from '@/app/_components/doctor/DashboardShell';
import { Card, CardContent } from '@/app/_components/ui/card';
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
import { cn } from '@/app/lib/utils';

export default function CreateCase() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    patientName: '',
    practiceName: '',
    chiefComplaint: '',
    dob: '2001-09-26',
    toothSystem: 'FDI (recommended)',
    impressionMethod: 'Digital Scan',
    impressionsTaken: [],
    additionalRecords: [],
    treatArches: 'Both',
    velocity: '0.2',
    otherVelocity: '',
    caseType: '',
    wearSchedule: '2 Weeks',
    retainer: 'YES',
    doNotMoveTeeth: [],
    avoidAttachmentsTeeth: [],
    teethForExtraction: [],
    leaveSpacesOpen: [],
    upperMidlineValue: '',
    upperMidlineGoal: 'Maintain',
    lowerMidlineValue: '',
    lowerMidlineGoal: 'Maintain',
    overjetValue: '',
    overjetGoal: 'Maintain',
    overbiteValue: '',
    overbiteGoal: 'Maintain',
    canineRelation: 'Maintain',
    molarRelation: 'Maintain',
    anteriorCrossbite: 'Maintain',
    posteriorCrossbite: 'Maintain',
    deciduousTeeth: 'Maintain',
    ipr: 'NO',
    engagers: 'NO',
    spaceManagement: 'Anterior Retraction',
    additionalInfo: '',
    treatmentPlan: '',
    scanFiles: [],
    patientImages: []
  });

  const [errors, setErrors] = useState({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCaseTypeDropdownOpen, setIsCaseTypeDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // New Loading State

  const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'];
  const UPPER_LEFT = ['21', '22', '23', '24', '25', '26', '27', '28'];
  const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'];
  const LOWER_LEFT = ['31', '32', '33', '34', '35', '36', '37', '38'];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e, field) => {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) {
      setFormData((prev) => ({
        ...prev,
        [field]: [...prev[field], ...newFiles]
      }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
      e.target.value = null;
    }
  };

  const handleRemoveFile = (field, fileName) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((file) => file.name !== fileName)
    }));
  };

  const handleSelection = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'velocity' && value !== 'Other' && errors.otherVelocity) {
      setErrors((prev) => ({ ...prev, otherVelocity: '' }));
    }
    if (field === 'treatmentPlan') setIsDropdownOpen(false);
    if (field === 'caseType') setIsCaseTypeDropdownOpen(false);
  };

  const handleMultiSelection = (field, value) => {
    setFormData((prev) => {
      const current = prev[field] || [];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter((item) => item !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleTeethToggle = (field, toothNum) => {
    setFormData((prev) => {
      const current = prev[field] || [];
      if (current.includes(toothNum)) {
        return { ...prev, [field]: current.filter((item) => item !== toothNum) };
      } else {
        return { ...prev, [field]: [...current, toothNum] };
      }
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    let newErrors = {};
    if (!formData.patientName.trim()) newErrors.patientName = 'Patient Name is required';
    if (!formData.practiceName.trim()) newErrors.practiceName = 'Practice Name is required';
    if (!formData.chiefComplaint.trim()) newErrors.chiefComplaint = 'Chief Complaint is required';
    if (!formData.dob) newErrors.dob = 'Date of Birth is required';
    if (!formData.impressionMethod) newErrors.impressionMethod = 'Impression Method is required';
    if (!formData.impressionsTaken || formData.impressionsTaken.length === 0) {
      newErrors.impressionsTaken = 'Please select at least one impression';
    }
    if (!formData.caseType) newErrors.caseType = 'Case type is required';
    if (!formData.wearSchedule) newErrors.wearSchedule = 'Wear Schedule is required';
    if (!formData.retainer) newErrors.retainer = 'Retainer is required';
    if (formData.velocity === 'Other' && !formData.otherVelocity.trim()) {
      newErrors.otherVelocity = 'Please specify the velocity';
    }
    if (!formData.treatmentPlan) newErrors.treatmentPlan = 'Treatment Plan is required';
    if (!formData.scanFiles || formData.scanFiles.length === 0) {
      newErrors.scanFiles = 'Scan Files are required';
    }
    if (!formData.patientImages || formData.patientImages.length === 0) {
      newErrors.patientImages = 'Patient Images are required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Updated handleSubmit to handle Async/Loading state
  // Inside handleSubmit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      const formDataObj = new FormData();
      // Append all fields
      Object.keys(formData).forEach(key => {
        if (key === 'scanFiles' || key === 'patientImages') {
          formData[key].forEach(file => formDataObj.append(key, file));
        } else if (Array.isArray(formData[key])) {
          formData[key].forEach(item => formDataObj.append(key, item));
        } else {
          formDataObj.append(key, formData[key]);
        }
      });

      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/cases', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formDataObj,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create case');
        alert('Case created successfully!');
        router.push('/doctor/cases');
      } catch (error) {
        console.error(error);
        alert(error.message || 'Failed to create case. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

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
    const files = formData[field] || [];
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
              disabled={isLoading}
            />
            <BsCloudUpload className="text-4xl text-muted-foreground" />
            <h6 className="mt-2 mb-1 font-bold">Drag & Drop Files Here</h6>
            <p className="mb-3 text-sm text-muted-foreground">Multiple files supported • or click to browse</p>
            <Button
              type="button"
              variant="outline"
              className={cn(
                'rounded-full px-4',
                field === 'scanFiles' ? 'border-primary text-primary' : 'border-success text-success'
              )}
              onClick={() => document.getElementById(`${field}Input`).click()}
              disabled={isLoading}
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
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 border-b py-2 last:border-b-0">
                    <div className="mr-2 max-w-[120px] truncate text-sm font-medium">{file.name}</div>
                    <div className="mr-2 text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveFile(field, file.name)}
                      disabled={isLoading}
                    >
                      <BsX />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 text-sm text-muted-foreground">{helperText}</div>
          {errors[field] && <div className="mt-1 text-sm text-destructive">{errors[field]}</div>}
        </div>
      </div>
    );
  };

  const getPriceDetails = (plan) => {
    if (!plan) return { show: false };
    if (plan === 'Setup Review Only - $30.00') {
      return { show: true, name: 'Setup Review Only', price: '$30.00' };
    }
    return { show: false };
  };

  return (
    <DashboardShell>
      <div className="min-h-screen bg-white py-4">
        <div className="mx-auto max-w-[1000px]">
          <Card className="overflow-hidden rounded-2xl border-0 py-0 shadow-lg">
            <div className="flex items-center gap-3 bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end-light))] p-4 text-white">
              <div className="flex size-20 items-center justify-center rounded-full bg-white/25 p-3">
                <BsPlusLg className="text-3xl font-bold text-white" />
              </div>
              <div>
                <h2 className="mb-1 font-semibold">Create New Case</h2>
                <p className="mb-0 text-white/70">Add a new patient case with all necessary data</p>
              </div>
            </div>

            <CardContent className="relative p-4 md:p-8">
              {/* ========================================== */}
              {/* LOADING OVERLAY (Appears when isLoading is true) */}
              {/* ========================================== */}
              {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center rounded-2xl bg-white/85 backdrop-blur-[2px]">
                  <div className="flex min-w-[300px] flex-col items-center rounded-2xl bg-white p-4 text-center shadow-lg">
                    <Spinner className="size-12 border-primary" />
                    <h5 className="mt-3 font-bold">Uploading files & creating case...</h5>
                    <p className="mb-0 text-sm text-muted-foreground">Please keep this tab open.</p>
                  </div>
                </div>
              )}

              <h4 className="mb-4 font-bold">Records & Numbering</h4>
              <form noValidate onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <div className="mb-1 font-semibold text-muted-foreground">Patient Information</div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Patient Name <span className="text-destructive">*</span></Label>
                      <Input
                        type="text"
                        className={cn('bg-muted', errors.patientName && 'border-destructive')}
                        name="patientName"
                        value={formData.patientName}
                        onChange={handleInputChange}
                        disabled={isLoading}
                      />
                      {errors.patientName && <div className="mt-1 text-sm text-destructive">{errors.patientName}</div>}
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Practice Name <span className="text-destructive">*</span></Label>
                      <Input
                        type="text"
                        className={cn('bg-muted', errors.practiceName && 'border-destructive')}
                        name="practiceName"
                        value={formData.practiceName}
                        onChange={handleInputChange}
                        disabled={isLoading}
                      />
                      {errors.practiceName && <div className="mt-1 text-sm text-destructive">{errors.practiceName}</div>}
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Chief Complaint <span className="text-destructive">*</span></Label>
                      <Textarea
                        className={cn('bg-muted', errors.chiefComplaint && 'border-destructive')}
                        name="chiefComplaint"
                        rows="3"
                        value={formData.chiefComplaint}
                        onChange={handleInputChange}
                        disabled={isLoading}
                      />
                      {errors.chiefComplaint && <div className="mt-1 text-sm text-destructive">{errors.chiefComplaint}</div>}
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Date of Birth <span className="text-destructive">*</span></Label>
                      <Input
                        type="date"
                        className={cn('bg-muted', errors.dob && 'border-destructive')}
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                        disabled={isLoading}
                      />
                      {errors.dob && <div className="mt-1 text-sm text-destructive">{errors.dob}</div>}
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Tooth numbering system</Label>
                      <div className="flex flex-wrap gap-2">
                        {['FDI (recommended)', 'Universal', 'Palmer notation'].map((opt) => (
                          <TogglePill key={opt} selected={formData.toothSystem === opt} onClick={() => handleSelection('toothSystem', opt)} disabled={isLoading}>
                            {opt}
                          </TogglePill>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Impression Method (choose one) <span className="text-destructive">*</span></Label>
                      <div className="flex flex-wrap gap-2">
                        {['Digital Scan', 'PVS (both)'].map((opt) => (
                          <TogglePill key={opt} selected={formData.impressionMethod === opt} onClick={() => handleSelection('impressionMethod', opt)} disabled={isLoading}>
                            {opt}
                          </TogglePill>
                        ))}
                      </div>
                      {errors.impressionMethod && <div className="mt-1 text-sm text-destructive">{errors.impressionMethod}</div>}
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Impressions Taken <span className="text-destructive">*</span></Label>
                      <div className="flex flex-wrap gap-2">
                        {['Upper', 'Lower', 'Both'].map((opt) => (
                          <TogglePill key={opt} selected={formData.impressionsTaken.includes(opt)} onClick={() => handleMultiSelection('impressionsTaken', opt)} disabled={isLoading}>
                            {opt}
                          </TogglePill>
                        ))}
                      </div>
                      {errors.impressionsTaken && <div className="mt-1 text-sm text-destructive">{errors.impressionsTaken}</div>}
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Additional records</Label>
                      <div className="flex flex-wrap gap-2">
                        {['Photos', 'Radiograph', 'Bite Reg'].map((opt) => (
                          <TogglePill key={opt} selected={formData.additionalRecords.includes(opt)} onClick={() => handleMultiSelection('additionalRecords', opt)} disabled={isLoading}>
                            {opt}
                          </TogglePill>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="mb-1 font-semibold text-muted-foreground">Treatment parameters</div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Treat Arches <span className="text-destructive">*</span></Label>
                      <div className="flex flex-wrap gap-2">
                        {['Both', 'Upper', 'Lower'].map((opt) => (
                          <TogglePill key={opt} selected={formData.treatArches === opt} onClick={() => handleSelection('treatArches', opt)} disabled={isLoading}>
                            {opt}
                          </TogglePill>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Velocity per stage <span className="text-destructive">*</span></Label>
                      <div className="flex flex-wrap gap-2">
                        <TogglePill selected={formData.velocity === '0.2'} onClick={() => handleSelection('velocity', '0.2')} disabled={isLoading}>0.2 mm, 2°</TogglePill>
                        <TogglePill selected={formData.velocity === '0.3'} onClick={() => handleSelection('velocity', '0.3')} disabled={isLoading}>0.3 mm, 3°</TogglePill>
                        <TogglePill selected={formData.velocity === 'Other'} onClick={() => handleSelection('velocity', 'Other')} disabled={isLoading}>Other</TogglePill>
                      </div>
                      <div className="mt-2">
                        <Label className="mb-1 text-sm text-muted-foreground">Specify (e.g., 0.25 mm, 2.5°)</Label>
                        <Input
                          type="text"
                          className={cn('bg-muted', errors.otherVelocity && 'border-destructive')}
                          name="otherVelocity"
                          value={formData.otherVelocity}
                          onChange={handleInputChange}
                          disabled={isLoading}
                        />
                        {errors.otherVelocity && <div className="mt-1 text-sm text-destructive">{errors.otherVelocity}</div>}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Case type <span className="text-destructive">*</span></Label>
                      <DropdownMenu open={isCaseTypeDropdownOpen} onOpenChange={setIsCaseTypeDropdownOpen}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left"
                            disabled={isLoading}
                          >
                            <span className={formData.caseType ? 'text-foreground' : 'text-muted-foreground'}>
                              {formData.caseType || 'Select a case type'}
                            </span>
                            {isCaseTypeDropdownOpen ? <BsChevronUp /> : <BsChevronDown />}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                          {['Clear Aligners', 'Crown', 'Bridge', 'Implant Restoration', 'Veneer', 'Denture', 'Night Guard', 'Retainer', 'Other'].map((opt) => (
                            <DropdownMenuItem key={opt} onClick={() => handleSelection('caseType', opt)}>
                              {opt}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {errors.caseType && <div className="mt-1 text-sm text-destructive">{errors.caseType}</div>}
                    </div>
                    <h6 className="mt-3 mb-2 font-semibold text-muted-foreground">Manufacturing</h6>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Wear Schedule <span className="text-destructive">*</span></Label>
                      <div className="flex flex-wrap gap-2">
                        {['1 Week', '2 Weeks', '10 days'].map((opt) => (
                          <TogglePill key={opt} selected={formData.wearSchedule === opt} onClick={() => handleSelection('wearSchedule', opt)} disabled={isLoading}>
                            {opt}
                          </TogglePill>
                        ))}
                      </div>
                      {errors.wearSchedule && <div className="mt-1 text-sm text-destructive">{errors.wearSchedule}</div>}
                    </div>
                    <div>
                      <Label className="mb-1 text-sm font-semibold text-muted-foreground">Retainer <span className="text-destructive">*</span></Label>
                      <div className="flex flex-wrap gap-2">
                        {['YES', 'NO'].map((opt) => (
                          <TogglePill key={opt} selected={formData.retainer === opt} onClick={() => handleSelection('retainer', opt)} disabled={isLoading}>
                            {opt}
                          </TogglePill>
                        ))}
                      </div>
                      {errors.retainer && <div className="mt-1 text-sm text-destructive">{errors.retainer}</div>}
                    </div>
                  </div>
                </div>

                <hr className="mt-10 mb-4" />
                {renderToothGrid('Do Not Move These Teeth (bridges, ankylosed, etc.)', 'Tick the teeth to remain stationary', 'doNotMoveTeeth', formData.doNotMoveTeeth)}
                {renderToothGrid('Avoid Engagers / Attachments on These Teeth', 'Mark teeth where attachments should be avoided.', 'avoidAttachmentsTeeth', formData.avoidAttachmentsTeeth)}
                {renderToothGrid('Teeth Planned for Extraction (before treatment)', 'Mark teeth planned for extraction before treatment begins.', 'teethForExtraction', formData.teethForExtraction)}
                {renderToothGrid('Leave These Spaces Open (tick teeth positions)', 'Mark the teeth positions where spaces should remain open.', 'leaveSpacesOpen', formData.leaveSpacesOpen)}

                <hr className="mb-4" />
                <h5 className="mb-4 font-bold">Occlusion & Goals</h5>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Upper Midline (mm)</Label>
                    <Input
                      type="text"
                      className="mb-2 bg-muted"
                      placeholder="e.g., 1.0"
                      name="upperMidlineValue"
                      value={formData.upperMidlineValue}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                    <div className="flex flex-wrap gap-1">
                      {['Maintain', 'Improve → Right', 'Improve → Left', 'Center'].map((opt) => (
                        <TogglePill key={opt} selected={formData.upperMidlineGoal === opt} onClick={() => handleSelection('upperMidlineGoal', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Lower Midline (mm)</Label>
                    <Input
                      type="text"
                      className="mb-2 bg-muted"
                      placeholder="e.g., 0.5"
                      name="lowerMidlineValue"
                      value={formData.lowerMidlineValue}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                    <div className="flex flex-wrap gap-1">
                      {['Maintain', 'Improve → Right', 'Improve → Left', 'Center'].map((opt) => (
                        <TogglePill key={opt} selected={formData.lowerMidlineGoal === opt} onClick={() => handleSelection('lowerMidlineGoal', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Overjet (mm)</Label>
                    <Input
                      type="text"
                      className="mb-2 bg-muted"
                      placeholder="e.g., 2.5"
                      name="overjetValue"
                      value={formData.overjetValue}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                    <div className="flex flex-wrap gap-1">
                      {['Maintain', 'Improve'].map((opt) => (
                        <TogglePill key={opt} selected={formData.overjetGoal === opt} onClick={() => handleSelection('overjetGoal', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Overbite (%)</Label>
                    <Input
                      type="text"
                      className="mb-2 bg-muted"
                      placeholder="e.g., 20%"
                      name="overbiteValue"
                      value={formData.overbiteValue}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                    <div className="flex flex-wrap gap-1">
                      {['Maintain', 'Improve'].map((opt) => (
                        <TogglePill key={opt} selected={formData.overbiteGoal === opt} onClick={() => handleSelection('overbiteGoal', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Canine Relation</Label>
                    <div className="flex flex-wrap gap-1">
                      {['Maintain', 'Improve', 'Ideal'].map((opt) => (
                        <TogglePill key={opt} selected={formData.canineRelation === opt} onClick={() => handleSelection('canineRelation', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Molar Relation</Label>
                    <div className="flex flex-wrap gap-1">
                      {['Maintain', 'Improve', 'Ideal'].map((opt) => (
                        <TogglePill key={opt} selected={formData.molarRelation === opt} onClick={() => handleSelection('molarRelation', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Anterior Crossbite</Label>
                    <div className="flex flex-wrap gap-1">
                      {['Maintain', 'Correct'].map((opt) => (
                        <TogglePill key={opt} selected={formData.anteriorCrossbite === opt} onClick={() => handleSelection('anteriorCrossbite', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Posterior Crossbite</Label>
                    <div className="flex flex-wrap gap-1">
                      {['Maintain', 'Correct'].map((opt) => (
                        <TogglePill key={opt} selected={formData.posteriorCrossbite === opt} onClick={() => handleSelection('posteriorCrossbite', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Deciduous Teeth</Label>
                    <div className="flex flex-wrap gap-1">
                      {['Maintain', 'Move', 'Extract'].map((opt) => (
                        <TogglePill key={opt} selected={formData.deciduousTeeth === opt} onClick={() => handleSelection('deciduousTeeth', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">IPR</Label>
                    <div className="flex flex-wrap gap-1">
                      {['YES', 'NO'].map((opt) => (
                        <TogglePill key={opt} selected={formData.ipr === opt} onClick={() => handleSelection('ipr', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Engagers</Label>
                    <div className="flex flex-wrap gap-1">
                      {['YES', 'NO'].map((opt) => (
                        <TogglePill key={opt} selected={formData.engagers === opt} onClick={() => handleSelection('engagers', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 text-sm font-semibold text-muted-foreground">Space Management</Label>
                    <div className="flex flex-wrap gap-1">
                      {['Anterior Retraction', 'Posterior Mesialization'].map((opt) => (
                        <TogglePill key={opt} selected={formData.spaceManagement === opt} onClick={() => handleSelection('spaceManagement', opt)} disabled={isLoading}>
                          {opt}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                </div>

                <hr className="mt-10 mb-4" />
                <div className="mb-4">
                  <Label className="mb-1 font-semibold text-muted-foreground">Additional Information</Label>
                  <Textarea
                    className="bg-muted"
                    name="additionalInfo"
                    rows="4"
                    placeholder="Notes, step-by-step instructions, special considerations"
                    value={formData.additionalInfo}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="mb-4">
                  <Label className="mb-1 font-semibold text-muted-foreground">Treatment Plan <span className="text-destructive">*</span></Label>
                  <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left"
                        disabled={isLoading}
                      >
                        <span className={formData.treatmentPlan ? 'text-foreground' : 'text-muted-foreground'}>
                          {formData.treatmentPlan || '-- Select Treatment Plan --'}
                        </span>
                        {isDropdownOpen ? <BsChevronUp /> : <BsChevronDown />}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                      <DropdownMenuLabel>Orthodontics</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleSelection('treatmentPlan', 'Setup Review Only - $30.00')}>
                        Setup Review Only - $30.00
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {getPriceDetails(formData.treatmentPlan).show && (
                    <Alert className="mt-2 flex items-center justify-between border-0 bg-info/15">
                      <div className="flex items-center gap-2">
                        <BsInfoCircle className="text-lg text-info" />
                        <span className="font-medium">{getPriceDetails(formData.treatmentPlan).name}</span>
                      </div>
                      <span className="text-lg font-bold">{getPriceDetails(formData.treatmentPlan).price}</span>
                    </Alert>
                  )}
                  <div className="mt-1 text-sm text-muted-foreground">Choose the appropriate treatment plan for this case.</div>
                  {errors.treatmentPlan && <div className="mt-1 text-sm text-destructive">{errors.treatmentPlan}</div>}
                </div>
                <div className="mb-4">
                  <Label className="mb-2 text-lg font-semibold text-muted-foreground">Patient Data Files <span className="text-destructive">*</span></Label>
                  <Alert className="mt-1 mb-3 items-start border-0 bg-info/15">
                    <BsInfoCircle className="text-lg text-info" />
                    <AlertDescription className="text-sm">
                      <strong>Note:</strong> Compressed files (.zip, .rar, .7z) should contain STL model files. The system will automatically categorize them as STL files. Maximum file size: <strong>300MB per file</strong>.
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {renderFileDropzone('scanFiles', 'Scan Files', BsEye, 'bg-primary', 'Upload 3D model files (.stl, .obj) or compressed files (.zip, .rar, .7z)')}
                    {renderFileDropzone('patientImages', 'Patient Images', BsCardImage, 'bg-success', 'Upload patient photos and scans')}
                  </div>
                </div>

                {/* Footer Actions - Disabled when loading */}
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <Button type="button" variant="outline" className="gap-2 px-4" disabled={isLoading} onClick={() => router.push('/doctor/dashboard')}>
                    <BsArrowLeft /> Back to Dashboard
                  </Button>
                  <Button type="submit" className="gap-2 px-4" disabled={isLoading}>
                    <BsPlusLg /> Create Case
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
