'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/_components/ui/dialog';
import { Button } from '@/app/_components/ui/button';
import { Label } from '@/app/_components/ui/label';
import { Textarea } from '@/app/_components/ui/textarea';
import { Input } from '@/app/_components/ui/input';
import { Badge } from '@/app/_components/ui/badge';
import Spinner from '@/app/_components/shared/Spinner';
import { cn } from '@/app/lib/utils';
import { BsCloudUpload, BsEye, BsCardImage, BsFiles, BsX, BsPlusLg } from 'react-icons/bs';

/**
 * Doctor-only modal to create a revision on a COMPLETED case. Captures only
 * the 3 things a revision deals with: scan files, patient images/xray, and a
 * special note. The form reuses the same dropzone UX as the "Create Case" page.
 */
export default function RevisionFormModal({ caseId, open, onOpenChange, onCreated }) {
  const [scanFiles, setScanFiles] = useState([]);
  const [patientImages, setPatientImages] = useState([]);
  const [specialNote, setSpecialNote] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setScanFiles([]);
    setPatientImages([]);
    setSpecialNote('');
    setErrors({});
    setError('');
  };

  const handleOpenChange = (next) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFileChange = (e, field) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length > 0) {
      if (field === 'scanFiles') setScanFiles((prev) => [...prev, ...newFiles]);
      else setPatientImages((prev) => [...prev, ...newFiles]);
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    e.target.value = null;
  };

  const handleRemoveFile = (field, fileName) => {
    if (field === 'scanFiles') setScanFiles((prev) => prev.filter((f) => f.name !== fileName));
    else setPatientImages((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (scanFiles.length === 0 && patientImages.length === 0 && !specialNote.trim()) {
      nextErrors.general = 'Add at least one scan file, patient image, or a special note.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      scanFiles.forEach((f) => form.append('scanFiles', f));
      patientImages.forEach((f) => form.append('patientImages', f));
      if (specialNote.trim()) form.append('specialNote', specialNote.trim());

      const res = await fetch(`/api/cases/${caseId}/revisions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create revision');

      reset();
      onOpenChange(false);
      if (typeof onCreated === 'function') onCreated(data.revision);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderFileDropzone = (field, title, Icon, iconBgClassName) => {
    const files = field === 'scanFiles' ? scanFiles : patientImages;
    return (
      <div>
        <div className="flex h-full flex-col rounded-2xl bg-muted p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className={cn('flex size-10 items-center justify-center rounded-full text-white', iconBgClassName)}>
              <Icon className="text-lg" />
            </div>
            <span className="text-lg font-semibold">{title}</span>
          </div>
          <div className="flex min-h-[120px] flex-grow flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-white p-4 text-center">
            <input
              type="file"
              id={`${field}Input`}
              multiple
              className="hidden"
              onChange={(e) => handleFileChange(e, field)}
              disabled={saving}
            />
            <BsCloudUpload className="text-4xl text-muted-foreground" />
            <h6 className="mt-2 mb-1 font-bold">Drag & Drop Files Here</h6>
            <p className="mb-3 text-sm text-muted-foreground">Multiple files supported • or click to browse</p>
            <Button
              type="button"
              variant="outline"
              className={cn('rounded-full px-4', field === 'scanFiles' ? 'border-primary text-primary' : 'border-success text-success')}
              onClick={() => document.getElementById(`${field}Input`).click()}
              disabled={saving}
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
                    <div className="mr-2 max-w-[200px] truncate text-sm font-medium">{file.name}</div>
                    <div className="mr-2 text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveFile(field, file.name)}
                      disabled={saving}
                    >
                      <BsX />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Revision</DialogTitle>
          <DialogDescription>
            Re-open this completed case with new work. Add scan files, patient images/xray, and a special note — the
            revision will go through the usual designer approval flow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderFileDropzone('scanFiles', 'Scan Files', BsEye, 'bg-primary')}
            {renderFileDropzone('patientImages', 'Patient Images & Xray', BsCardImage, 'bg-success')}
          </div>

          <div className="mt-4">
            <Label htmlFor="specialNote" className="text-sm font-semibold text-muted-foreground">
              Special Note
            </Label>
            <Textarea
              id="specialNote"
              rows={4}
              className="mt-1.5 bg-muted"
              placeholder="Reason for the revision, special instructions, etc."
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
              disabled={saving}
            />
          </div>

          {(errors.general || error) && (
            <p className="mt-3 text-sm text-destructive">{errors.general || error}</p>
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={saving}>
              {saving ? <Spinner className="size-4 border-white" /> : <BsPlusLg />}
              Create Revision
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
