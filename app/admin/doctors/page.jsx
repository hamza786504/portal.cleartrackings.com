'use client';

import { useEffect, useState, Fragment } from 'react';
import { BsPersonBadge, BsCopy, BsPlusCircle, BsPersonCheck, BsPersonX, BsKey, BsCaretDown, BsCaretUp } from 'react-icons/bs';
import DashboardShell from '@/app/_components/admin/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import Spinner from '@/app/_components/shared/Spinner';
import CasesAccordion from '@/app/_components/admin/CasesAccordion';

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [suspendingId, setSuspendingId] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expandedDoctorId, setExpandedDoctorId] = useState(null);

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

  const handleResetPassword = async (doctor) => {
    if (
      !confirm(
        `Generate a new password for ${doctor.firstName} ${doctor.lastName}? Their current password will stop working immediately and the new one will be shown only once.`
      )
    ) {
      return;
    }
    setResetResult({ ...doctor, loading: true, error: '' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/users/${doctor._id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');
      setResetResult({ ...doctor, loading: false, password: data.password, name: data.name, email: data.email });
      await fetchDoctors();
    } catch (err) {
      setResetResult({ ...doctor, loading: false, error: err.message });
      alert(err.message);
    }
  };

  const copyPassword = async () => {
    if (!resetResult?.password) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const toggleExpand = (doctorId) => {
    setExpandedDoctorId((prev) => (prev === doctorId ? null : doctorId));
  };

  return (
    <DashboardShell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="mb-0 flex items-center gap-2 text-xl font-bold">
            <BsPersonBadge /> Doctors
          </h4>
          <p className="mt-1 mb-0 text-sm text-muted-foreground">
            {doctors.length} doctor{doctors.length !== 1 ? 's' : ''} registered
          </p>
        </div>
    
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
                  <TableHead className="w-10 py-3 px-3"></TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Name</TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Email</TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Business</TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Status</TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((doctor) => (
                  <Fragment key={doctor._id}>
                    <TableRow className="hover:bg-muted/40">
                      <TableCell className="px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(doctor._id)}
                          aria-expanded={expandedDoctorId === doctor._id}
                          aria-controls={`cases-${doctor._id}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {expandedDoctorId === doctor._id ? (
                            <BsCaretUp className="size-4" />
                          ) : (
                            <BsCaretDown className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="px-3 font-semibold">
                        <button
                          type="button"
                          className="hover:underline text-left bg-transparent border-0 p-0 cursor-pointer"
                          onClick={() => toggleExpand(doctor._id)}
                        >
                          {doctor.firstName} {doctor.lastName}
                        </button>
                      </TableCell>
                      <TableCell className="px-3">{doctor.email}</TableCell>
                      <TableCell className="px-3 text-muted-foreground">
                        {doctor.doctorDetails?.businessName || '—'}
                      </TableCell>
                      <TableCell className="px-3">
                        <div className="flex flex-wrap gap-1">
                          {doctor.isApproved ? (
                            <Badge className="bg-success text-success-foreground">Approved</Badge>
                          ) : (
                            <Badge className="bg-warning text-warning-foreground">Pending</Badge>
                          )}
                          {doctor.isSuspended && <Badge variant="destructive">Suspended</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="px-3">
                        <div className="flex flex-wrap gap-2">
                          {!doctor.isApproved && (
                            <Button
                              size="sm"
                              className="bg-foreground text-background hover:bg-foreground/90"
                              disabled={approvingId === doctor._id}
                              onClick={() => handleApprove(doctor._id)}
                            >
                              {approvingId === doctor._id ? (
                                <Spinner className="border-current" />
                              ) : (
                                <>
                                  <BsPersonCheck /> Approve
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className={
                              doctor.isSuspended
                                ? 'border-success text-success'
                                : 'border-destructive text-destructive'
                            }
                            disabled={suspendingId === doctor._id}
                            onClick={() => handleSuspendToggle(doctor)}
                          >
                            {suspendingId === doctor._id ? (
                              <Spinner className="border-current" />
                            ) : doctor.isSuspended ? (
                              <>
                                <BsPersonCheck /> Unsuspend
                              </>
                            ) : (
                              <>
                                <BsPersonX /> Suspend
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={resetResult?.loading}
                            onClick={() => handleResetPassword(doctor)}
                          >
                            <BsKey /> Reset
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {expandedDoctorId === doctor._id && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0" id={`cases-${doctor._id}`}>
                          <CasesAccordion
                            doctor={doctor}
                            isOpen={true}
                            onToggle={() => toggleExpand(doctor._id)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}

                {doctors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-4 text-center text-muted-foreground">
                      No doctors registered yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reset Password — one-time display */}
      {resetResult && resetResult.password && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>New password — shown only once</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Share this with {resetResult.email}. It is never stored on the server, so once you
                close this dialog it cannot be recovered — generate a fresh one if needed.
              </p>
              <div className="break-all rounded-md border bg-muted px-3 py-3 font-mono text-sm select-all">
                {resetResult.password}
              </div>
              <Button variant="outline" className="mt-3 gap-1" onClick={copyPassword}>
                <BsCopy />
                {copied ? 'Copied!' : 'Copy password'}
              </Button>
            </CardContent>
            <CardContent className="pt-0">
              <Button
                className="w-full bg-foreground text-background hover:bg-foreground/90"
                onClick={() => setResetResult(null)}
              >
                Done — I have saved it
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {resetResult && !resetResult.password && resetResult.error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-4">
              <p className="mb-4 text-destructive">Error: {resetResult.error}</p>
              <Button className="w-full" onClick={() => setResetResult(null)}>
                OK
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}