'use client';

import { useEffect, useState, useCallback } from 'react';
import { BsFolder2, BsCaretUp, BsCaretDown, BsEye } from 'react-icons/bs';
import Spinner from '@/app/_components/shared/Spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
import { cn } from '@/app/lib/utils';

const MAX_PAGE_SIZE = 10;

const STATUS_STYLES = {
  pending: 'bg-warning text-warning-foreground',
  'in-progress': 'bg-info text-info-foreground',
  delivered: 'bg-success text-success-foreground',
  completed: 'bg-primary text-primary-foreground',
  hold: 'bg-destructive text-destructive-foreground',
};

const formatStatus = (status) =>
  status === 'in-progress'
    ? 'In Progress'
    : status === 'delivered'
      ? 'Delivered'
      : (status || '').charAt(0).toUpperCase() + (status || '').slice(1);

const formatDate = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

export default function CasesAccordion({ doctor, isOpen, onToggle }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loaded, setLoaded] = useState(false);

  const fetchCases = useCallback(
    async (currentPage) => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const query = new URLSearchParams({ page: String(currentPage), limit: String(MAX_PAGE_SIZE) });
        const res = await fetch(`/api/admin/doctors/${doctor._id}/cases?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to fetch cases');
        }
        const data = await res.json();
        setCases(data.cases || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setPage(currentPage);
        setLoaded(true);
      } catch (err) {
        setError(err.message);
        setCases([]);
      } finally {
        setLoading(false);
      }
    },
    [doctor._id]
  );

  // Lazy load: only fetch the first time the accordion is opened.
  useEffect(() => {
    if (isOpen && !loaded && !loading) {
      fetchCases(1);
    }
  }, [isOpen, loaded, loading, fetchCases]);

  const goToPage = (p) => {
    if (p >= 1 && p <= totalPages) fetchCases(p);
  };

  const caseCount = total || (loaded && cases.length) || 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={isOpen}
      >
        <BsFolder2 className="text-muted-foreground shrink-0" />
        <span className="font-medium text-foreground">{doctor.firstName} {doctor.lastName}</span>
        <Badge variant="outline" className="hidden sm:inline-flex">{doctor.email}</Badge>
        {doctor.isSuspended && <Badge variant="destructive">Suspended</Badge>}
        <span className="ml-auto flex items-center gap-2">
          <Badge className="bg-primary text-primary-foreground">
            {caseCount} {caseCount === 1 ? 'Case' : 'Cases'}
          </Badge>
          {isOpen ? (
            <BsCaretUp className="text-muted-foreground" />
          ) : (
            <BsCaretDown className="text-muted-foreground" />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border bg-background">
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner className="size-6" />
            </div>
          )}

          {error && !loading && (
            <div className="p-4 flex flex-col items-start gap-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => fetchCases(page)}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && cases.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No cases found for this doctor.</p>
          )}

          {!loading && !error && cases.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="py-2 px-3 text-muted-foreground"># ID</TableHead>
                      <TableHead className="py-2 px-3 text-muted-foreground">Patient</TableHead>
                      <TableHead className="py-2 px-3 text-muted-foreground">Case Type</TableHead>
                      <TableHead className="py-2 px-3 text-muted-foreground">Status</TableHead>
                      <TableHead className="py-2 px-3 text-muted-foreground">Date</TableHead>
                      <TableHead className="py-2 px-3 text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.map((c) => (
                      <TableRow key={c._id} className="hover:bg-muted/40">
                        <TableCell className="py-2 px-3 font-mono text-xs text-muted-foreground">{c._id}</TableCell>
                        <TableCell className="py-2 px-3 font-medium">{c.patientName}</TableCell>
                        <TableCell className="py-2 px-3">
                          <Badge variant="outline" className="text-xs">{c.caseType || '—'}</Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <Badge className={cn('text-xs', STATUS_STYLES[c.status] || '')}>
                            {formatStatus(c.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                        <TableCell className="py-2 px-3">
                          <a href={`/admin/cases/${c._id}`}>
                            <Button size="sm" variant="outline" className="gap-1">
                              <BsEye /> View
                            </Button>
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-border bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    Showing {Math.max(1, (page - 1) * MAX_PAGE_SIZE + 1)}–{Math.min(page * MAX_PAGE_SIZE, total)} of {total} cases
                  </span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" disabled={page === 1} onClick={() => goToPage(page - 1)}>
                      Previous
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = Math.max(1, page - 2) + i;
                      if (p > totalPages) return null;
                      return (
                        <Button
                          key={p}
                          size="sm"
                          variant={p === page ? 'default' : 'outline'}
                          onClick={() => goToPage(p)}
                        >
                          {p}
                        </Button>
                      );
                    })}
                    <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => goToPage(page + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}