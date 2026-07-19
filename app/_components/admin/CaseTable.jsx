'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BsFolder2Open, BsEye, BsTrash } from 'react-icons/bs';
import { Card, CardContent, CardFooter } from '@/app/_components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
import DesignerAssignDropdown from '@/app/_components/admin/DesignerAssignDropdown';
import StatusChangeDropdown from '@/app/_components/admin/StatusChangeDropdown';

export default function CaseTable({ cases, onCasesChange, onCasesDeleted }) {
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const selectAllRef = useRef(null);

  // Only rows currently on screen count toward "all selected".
  const allSelected = cases.length > 0 && cases.every((c) => selected.has(c._id));
  const someSelected = selected.size > 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  if (!cases || cases.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-5 text-center">
          <BsFolder2Open className="mx-auto text-5xl text-muted-foreground" />
          <p className="mt-3 mb-0 text-lg text-muted-foreground">No cases found</p>
        </CardContent>
      </Card>
    );
  }

  const token = () => localStorage.getItem('token');

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(cases.map((c) => c._id)));
  };

  const deleteOne = async (caseId) => {
    if (
      !confirm(
        'Delete this case permanently? This also deletes the entire chat thread and every image shared on this case. This cannot be undone.'
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete case');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(caseId);
        return next;
      });
      onCasesDeleted?.(String(caseId));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    if (
      !confirm(
        `Delete ${ids.length} selected case(s) permanently? This also deletes their chat threads and all images shared on them. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/cases', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete cases');
      setSelected(new Set());
      onCasesDeleted?.(ids.map(String));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Admin toggles whether the doctor has paid for a case. The updated case is
  // handed back via onCasesChange so the row refreshes in place.
  const togglePaid = async (caseId, nextPaid) => {
    try {
      const res = await fetch(`/api/admin/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ paid: nextPaid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update payment status');
      onCasesChange?.(data);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Card className="border-0 py-0 shadow-sm">
      <CardContent className="px-0">
        {someSelected && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-destructive/5 px-3 py-2">
            <span className="text-sm font-medium text-destructive">{selected.size} selected</span>
            <Button variant="destructive" size="sm" className="gap-1" disabled={deleting} onClick={deleteSelected}>
              <BsTrash /> Delete selected
            </Button>
            <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        <Table>
          <TableHeader className="bg-[linear-gradient(to_right,#f8f9ff,#f0f4ff)]">
            <TableRow>
              <TableHead className="w-10 py-3 px-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all cases"
                  className="size-4 cursor-pointer accent-destructive"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">#</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Patient</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Doctor</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Case Type</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Status</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Paid</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Date</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Actions</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Assign Designer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((c, index) => {
              const doctorName = c.doctorId ? `${c.doctorId.firstName} ${c.doctorId.lastName}`.trim() : '—';
              const createdDate = c.createdAt
                ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
              const isChecked = selected.has(c._id);

              return (
                <TableRow key={c._id} className={isChecked ? 'bg-destructive/5' : ''}>
                  <TableCell className="px-3">
                    <input
                      type="checkbox"
                      aria-label={`Select case ${c.patientName}`}
                      className="size-4 cursor-pointer accent-destructive"
                      checked={isChecked}
                      onChange={() => toggleRow(c._id)}
                    />
                  </TableCell>
                  <TableCell className="px-3 text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="px-3 font-semibold">{c.patientName}</TableCell>
                  <TableCell className="px-3">{doctorName}</TableCell>
                  <TableCell className="px-3">
                    <Badge variant="outline" className="bg-muted">{c.caseType || '—'}</Badge>
                  </TableCell>
                  <TableCell className="px-3">
                    <StatusChangeDropdown
                      caseId={c._id}
                      currentStatus={c.revisionStatus ?? c.status}
                      onStatusChange={onCasesChange}
                    />
                  </TableCell>
                  <TableCell className="px-3">
                    <input
                      type="checkbox"
                      aria-label={`Mark case ${c.patientName} as paid`}
                      className="size-4 cursor-pointer accent-success"
                      checked={!!c.paid}
                      onChange={() => togglePaid(c._id, !c.paid)}
                    />
                  </TableCell>
                  <TableCell className="px-3 text-muted-foreground">{createdDate}</TableCell>
                  <TableCell className="px-3">
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm" className="w-fit gap-1 whitespace-nowrap">
                        <Link href={`/admin/cases/${c._id}`}>
                          <BsEye /> View
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="gap-1 border-destructive text-destructive"
                        disabled={deleting}
                        onClick={() => deleteOne(c._id)}
                        aria-label="Delete case"
                        title="Delete case"
                      >
                        <BsTrash />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="px-3">
                    <DesignerAssignDropdown
                      caseId={c._id}
                      currentDesignerId={c.pickedBy?._id || ''}
                      currentDesignerName={
                        c.pickedBy
                          ? `${c.pickedBy.firstName || ''} ${c.pickedBy.lastName || ''}`.trim()
                          : ''
                      }
                      onAssign={onCasesChange}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="border-t bg-muted/30 py-2 px-3 text-sm text-muted-foreground">
        {cases.length} case{cases.length !== 1 ? 's' : ''} found
        {someSelected ? ` · ${selected.size} selected` : ''}
      </CardFooter>
    </Card>
  );
}
