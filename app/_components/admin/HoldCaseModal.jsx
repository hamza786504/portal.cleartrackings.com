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
import Spinner from '@/app/_components/shared/Spinner';

/**
 * Admin-only modal: before a case can be put on hold the admin must supply a
 * reason. The reason is stored on the case (holdReason) and is later shown to
 * the doctor/designer on their case page so they understand why it's held.
 */
export default function HoldCaseModal({ caseId, open, onOpenChange, onHeld }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (next) => {
    if (!next) {
      // Reset when closing without submitting.
      setReason('');
      setError('');
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Please enter a reason for putting this case on hold.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'hold', holdReason: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to put case on hold');
      }
      setReason('');
      onOpenChange(false);
      if (typeof onHeld === 'function') onHeld(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Put case on hold</DialogTitle>
          <DialogDescription>
            Tell the doctor and designer why this case is being held. The reason will be
            shown on their case pages.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="mb-2">
            <Label htmlFor="holdReason" className="text-sm font-semibold text-muted-foreground">
              Reason for hold
            </Label>
            <Textarea
              id="holdReason"
              rows={4}
              className="mt-1.5"
              placeholder="e.g. Awaiting revised scan from the clinic…"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              disabled={saving}
              autoFocus
            />
          </div>
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={saving} className="gap-2">
              {saving && <Spinner className="size-4 border-white" />}
              Put on hold
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
