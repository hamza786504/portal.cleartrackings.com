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
import Spinner from '@/app/_components/shared/Spinner';
import { cn } from '@/app/lib/utils';
import { BsCloudUpload, BsEye, BsCardImage, BsX, BsTrash, BsArrowCounterclockwise, BsCheckLg } from 'react-icons/bs';

/**
 * Doctor-only modal to edit a case's scan files and patient images: remove
 * existing files and add new ones. The admins and the designer are notified
 * of the change server-side.
 */
export default function EditCaseFilesModal({ caseData, open, onOpenChange, onSaved }) {
  const [newFiles, setNewFiles] = useState({ scanFiles: [], patientImages: [] });
  const [removed, setRemoved] = useState({ scanFiles: new Set(), patientImages: new Set() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setNewFiles({ scanFiles: [], patientImages: [] });
    setRemoved({ scanFiles: new Set(), patientImages: new Set() });
    setError('');
  };

  const handleOpenChange = (next) => {
    if (saving) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFileChange = (e, field) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length > 0) setNewFiles((prev) => ({ ...prev, [field]: [...prev[field], ...picked] }));
    e.target.value = null;
  };

  const removeNewFile = (field, index) =>
    setNewFiles((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));

  const toggleRemoved = (field, fileId) =>
    setRemoved((prev) => {
      const next = new Set(prev[field]);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return { ...prev, [field]: next };
    });

  const hasChanges =
    newFiles.scanFiles.length > 0 ||
    newFiles.patientImages.length > 0 ||
    removed.scanFiles.size > 0 ||
    removed.patientImages.size > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasChanges) return;
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      newFiles.scanFiles.forEach((f) => form.append('scanFiles', f));
      newFiles.patientImages.forEach((f) => form.append('patientImages', f));
      removed.scanFiles.forEach((fileId) => form.append('removeScanFiles', fileId));
      removed.patientImages.forEach((fileId) => form.append('removePatientImages', fileId));

      const res = await fetch(`/api/cases/${caseData._id}/files`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update files');

      reset();
      onOpenChange(false);
      if (typeof onSaved === 'function') onSaved(data.case);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (field, title, Icon, iconBgClassName) => {
    const existing = caseData?.[field] || [];
    const added = newFiles[field];
    return (
      <div className="flex h-full flex-col rounded-2xl bg-muted p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={cn('flex size-10 items-center justify-center rounded-full text-white', iconBgClassName)}>
            <Icon className="text-lg" />
          </div>
          <span className="text-lg font-semibold">{title}</span>
        </div>

        {/* Current files */}
        <div className="mb-3 max-h-48 overflow-y-auto rounded-lg bg-white p-2">
          {existing.length === 0 && added.length === 0 && (
            <p className="py-2 text-center text-sm italic text-muted-foreground">No files yet.</p>
          )}
          {existing.map((file) => {
            const isRemoved = removed[field].has(file.id);
            return (
              <div key={file.id} className="flex items-center justify-between gap-2 border-b py-2 last:border-b-0">
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'mr-2 max-w-[200px] truncate text-sm font-medium hover:underline',
                    isRemoved && 'text-muted-foreground line-through'
                  )}
                >
                  {file.name}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className={isRemoved ? 'text-muted-foreground' : 'text-destructive hover:text-destructive'}
                  onClick={() => toggleRemoved(field, file.id)}
                  disabled={saving}
                  title={isRemoved ? 'Keep this file' : 'Remove this file'}
                >
                  {isRemoved ? <BsArrowCounterclockwise /> : <BsTrash />}
                </Button>
              </div>
            );
          })}
          {added.map((file, index) => (
            <div key={`new-${index}`} className="flex items-center justify-between gap-2 border-b py-2 last:border-b-0">
              <div className="mr-2 max-w-[160px] truncate text-sm font-medium">{file.name}</div>
              <span className="text-xs font-semibold text-success">New</span>
              <div className="text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-destructive hover:text-destructive"
                onClick={() => removeNewFile(field, index)}
                disabled={saving}
              >
                <BsX />
              </Button>
            </div>
          ))}
        </div>

        <input
          type="file"
          id={`edit-${field}Input`}
          multiple
          className="hidden"
          onChange={(e) => handleFileChange(e, field)}
          disabled={saving}
        />
        <Button
          type="button"
          variant="outline"
          className={cn('mt-auto gap-2 rounded-full', field === 'scanFiles' ? 'border-primary text-primary' : 'border-success text-success')}
          onClick={() => document.getElementById(`edit-${field}Input`).click()}
          disabled={saving}
        >
          <BsCloudUpload /> Add Files
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Pictures & Scans</DialogTitle>
          <DialogDescription>
            Add new files or remove existing ones. The admin and the designer will be notified by email of the changes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderSection('scanFiles', 'Scan Files', BsEye, 'bg-primary')}
            {renderSection('patientImages', 'Patient Images & Xray', BsCardImage, 'bg-success')}
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={saving || !hasChanges}>
              {saving ? <Spinner className="size-4 border-white" /> : <BsCheckLg />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
