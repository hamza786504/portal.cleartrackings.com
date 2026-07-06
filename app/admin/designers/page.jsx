'use client';

import { useEffect, useState } from 'react';
import { BsPalette, BsChevronUp, BsSliders, BsCheckLg, BsSave } from 'react-icons/bs';
import DashboardShell from '@/app/_components/admin/DashboardShell';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
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
    </DashboardShell>
  );
}
