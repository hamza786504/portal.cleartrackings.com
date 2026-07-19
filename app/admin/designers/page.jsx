'use client';

import { useEffect, useState } from 'react';
import { BsPalette, BsChevronUp, BsSliders, BsCheckLg, BsSave, BsArrowClockwise, BsCopy } from 'react-icons/bs';
import DashboardShell from '@/app/_components/admin/DashboardShell';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/_components/ui/dialog';
import Spinner from '@/app/_components/shared/Spinner';
import { cn } from '@/app/lib/utils';

export default function AdminDesignersPage() {
  const [designers, setDesigners] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [suspendingId, setSuspendingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [designersRes, doctorsRes] = await Promise.all([
        fetch('/api/admin/designers', { headers }),
        fetch('/api/admin/doctors', { headers }),
      ]);
      const [designersData, doctorsData] = await Promise.all([designersRes.json(), doctorsRes.json()]);
      setDesigners(Array.isArray(designersData) ? designersData : []);
      setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
    } catch (err) {
      console.error('Failed to load designers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id) => {
    setApprovingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/approve-designer/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to approve designer');
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const handleSuspendToggle = async (designer) => {
    const nextSuspended = !designer.isSuspended;
    const verb = nextSuspended ? 'suspend' : 'unsuspend';
    const cascadeNote = nextSuspended
      ? ' Any case currently assigned to them will be freed back to pending.'
      : '';
    if (!confirm(`Are you sure you want to ${verb} ${designer.firstName} ${designer.lastName}?${cascadeNote}`)) return;

    setSuspendingId(designer._id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/users/${designer._id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ suspended: nextSuspended }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to ${verb} designer`);
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSuspendingId(null);
    }
  };

  const toggleExpand = (designer) => {
    if (expandedId === designer._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(designer._id);
    setSelectedDoctors((designer.allowedDoctors || []).map((d) => d._id));
  };

  const toggleDoctor = (doctorId) => {
    setSelectedDoctors((prev) =>
      prev.includes(doctorId) ? prev.filter((id) => id !== doctorId) : [...prev, doctorId]
    );
  };

  const savePermissions = async (designerId) => {
    setSavingId(designerId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/designers/${designerId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ doctorIds: selectedDoctors }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save permissions');
      setExpandedId(null);
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleResetPassword = async (designer) => {
    if (
      !confirm(
        `Generate a new password for ${designer.firstName} ${designer.lastName}? Their current password will stop working immediately and the new one will be shown only once.`
      )
    ) {
      return;
    }
    setResettingId(designer._id);
    setCopied(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/users/${designer._id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');
      // This is the ONLY time the plaintext is available — never stored again.
      setResetResult(data);
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setResettingId(null);
    }
  };

  const copyPassword = async () => {
    if (!resetResult?.password) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      setCopied(true);
    } catch {
      // Clipboard may be unavailable (e.g. non-secure context) — user can still select the text.
    }
  };

  return (
    <DashboardShell>
      <div className="mb-4">
        <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <BsPalette /> Designers
        </h4>
        <p className="mb-0 text-sm text-muted-foreground">
          {designers.length} designer{designers.length !== 1 ? 's' : ''} registered — grant each one access to specific doctors&apos; cases
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <Spinner className="size-6" />
        </div>
      ) : designers.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-5 text-center text-muted-foreground">No designers registered yet.</CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {designers.map((d) => (
            <Card className="border-0 shadow-sm" key={d._id}>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{d.firstName} {d.lastName}</div>
                    <div className="text-sm text-muted-foreground">{d.email}</div>
                    <div className="text-sm text-muted-foreground">
                      Allowed doctors:{' '}
                      {d.allowedDoctors && d.allowedDoctors.length > 0
                        ? d.allowedDoctors.map((doc) => `${doc.firstName} ${doc.lastName}`).join(', ')
                        : <span className="italic">none yet</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.isApproved ? (
                      <Badge className="bg-success text-success-foreground">Approved</Badge>
                    ) : (
                      <Badge className="bg-warning text-warning-foreground">Pending</Badge>
                    )}
                    {d.isSuspended && <Badge variant="destructive">Suspended</Badge>}
                    {d.passwordResetRequested && (
                      <Badge className="bg-info text-info-foreground">Reset requested</Badge>
                    )}
                    {!d.isApproved && (
                      <Button
                        size="sm"
                        className="bg-foreground text-background hover:bg-foreground/90"
                        disabled={approvingId === d._id}
                        onClick={() => handleApprove(d._id)}
                      >
                        {approvingId === d._id ? <Spinner className="border-current" /> : 'Approve'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className={d.isSuspended ? 'border-success text-success' : 'border-destructive text-destructive'}
                      disabled={suspendingId === d._id}
                      onClick={() => handleSuspendToggle(d)}
                    >
                      {suspendingId === d._id ? <Spinner className="border-current" /> : d.isSuspended ? 'Unsuspend' : 'Suspend'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-foreground/40 text-foreground hover:bg-foreground/10"
                      disabled={resettingId === d._id}
                      onClick={() => handleResetPassword(d)}
                    >
                      {resettingId === d._id ? <Spinner className="border-current" /> : <BsArrowClockwise />}
                      {resettingId === d._id ? 'Resetting...' : 'Reset Password'}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => toggleExpand(d)}>
                      {expandedId === d._id ? <BsChevronUp /> : <BsSliders />}
                      {expandedId === d._id ? 'Close' : 'Manage Access'}
                    </Button>
                  </div>
                </div>

                {expandedId === d._id && (
                  <div className="mt-3 border-t pt-3">
                    <div className="mb-2 text-sm font-semibold text-muted-foreground">
                      Select which doctors&apos; cases this designer can see and pick:
                    </div>
                    {doctors.length === 0 ? (
                      <p className="text-sm italic text-muted-foreground">No doctors registered yet.</p>
                    ) : (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {doctors.map((doc) => (
                          <button
                            key={doc._id}
                            type="button"
                            className={cn(
                              'flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                              selectedDoctors.includes(doc._id)
                                ? 'border-foreground bg-foreground text-background'
                                : 'border-input bg-transparent text-muted-foreground hover:bg-muted'
                            )}
                            onClick={() => toggleDoctor(doc._id)}
                          >
                            {selectedDoctors.includes(doc._id) && <BsCheckLg />}
                            {doc.firstName} {doc.lastName}
                          </button>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="gap-1 bg-foreground text-background hover:bg-foreground/90"
                      disabled={savingId === d._id}
                      onClick={() => savePermissions(d._id)}
                    >
                      {savingId === d._id ? <Spinner className="border-current" /> : <BsSave />}
                      Save Permissions
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!resetResult}
        onOpenChange={(open) => {
          if (!open) setResetResult(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New password — shown only once</DialogTitle>
            <DialogDescription>
              Share this with {resetResult?.name || resetResult?.email}. It is never stored on the
              server, so once you close this dialog it cannot be recovered — generate a fresh one if
              needed.
            </DialogDescription>
          </DialogHeader>

          {resetResult && (
            <>
              <div className="rounded-md border bg-muted px-3 py-3 font-mono text-sm break-all select-all">
                {resetResult.password}
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-1"
                onClick={copyPassword}
              >
                <BsCopy />
                {copied ? 'Copied!' : 'Copy password'}
              </Button>
            </>
          )}

          <DialogFooter>
            <Button type="button" className="bg-foreground text-background hover:bg-foreground/90" onClick={() => setResetResult(null)}>
              Done — I&apos;ve saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
