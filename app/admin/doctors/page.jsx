'use client';

import { useEffect, useState } from 'react';
import { BsPersonBadge } from 'react-icons/bs';
import DashboardShell from '@/app/_components/admin/DashboardShell';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
import Spinner from '@/app/_components/shared/Spinner';

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [suspendingId, setSuspendingId] = useState(null);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/doctors', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDoctors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleApprove = async (id) => {
    setApprovingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/approve-doctor/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to approve doctor');
      await fetchDoctors();
    } catch (err) {
      alert(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const handleSuspendToggle = async (doctor) => {
    const nextSuspended = !doctor.isSuspended;
    const verb = nextSuspended ? 'suspend' : 'unsuspend';
    if (!confirm(`Are you sure you want to ${verb} ${doctor.firstName} ${doctor.lastName}?`)) return;

    setSuspendingId(doctor._id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/users/${doctor._id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ suspended: nextSuspended }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to ${verb} doctor`);
      await fetchDoctors();
    } catch (err) {
      alert(err.message);
    } finally {
      setSuspendingId(null);
    }
  };

  return (
    <DashboardShell>
      <div className="mb-4">
        <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <BsPersonBadge /> Doctors
        </h4>
        <p className="mb-0 text-sm text-muted-foreground">{doctors.length} doctor{doctors.length !== 1 ? 's' : ''} registered</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <Spinner className="size-6" />
        </div>
      ) : (
        <Card className="border-0 py-0 shadow-sm">
          <CardContent className="px-0">
            <Table>
              <TableHeader className="bg-[linear-gradient(to_right,#f8f9ff,#f0f4ff)]">
                <TableRow>
                  <TableHead className="py-3 px-3 text-muted-foreground">Name</TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Email</TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Business</TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Status</TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((d) => (
                  <TableRow key={d._id}>
                    <TableCell className="px-3 font-semibold">{d.firstName} {d.lastName}</TableCell>
                    <TableCell className="px-3">{d.email}</TableCell>
                    <TableCell className="px-3 text-muted-foreground">{d.doctorDetails?.businessName || '—'}</TableCell>
                    <TableCell className="px-3">
                      <div className="flex flex-wrap gap-1">
                        {d.isApproved ? (
                          <Badge className="bg-success text-success-foreground">Approved</Badge>
                        ) : (
                          <Badge className="bg-warning text-warning-foreground">Pending</Badge>
                        )}
                        {d.isSuspended && <Badge variant="destructive">Suspended</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex flex-wrap gap-2">
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {doctors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">
                      No doctors registered yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}
