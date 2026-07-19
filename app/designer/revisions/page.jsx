'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BsArrowRepeat, BsFolder2Open, BsEye } from 'react-icons/bs';
import DashboardShell from '@/app/_components/designer/DashboardShell';
import { Card, CardContent, CardFooter } from '@/app/_components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Button } from '@/app/_components/ui/button';
import StatusBadge from '@/app/_components/shared/StatusBadge';
import Spinner from '@/app/_components/shared/Spinner';
import Pagination from '@/app/_components/shared/Pagination';

const SCOPE_LABELS = {
  all: 'All Revisions',
  mine: 'My Revisions',
  completed: 'Completed Revisions',
};

const MAX_PAGE_SIZE = 50;

function RevisionsContent() {
  const searchParams = useSearchParams();
  const scope = searchParams.get('scope') || 'all';
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ scope, page: String(page) });
      const res = await fetch(`/api/revisions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setRevisions(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setRevisions(Array.isArray(data.revisions) ? data.revisions : []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching revisions:', err);
      setRevisions([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [scope]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, page]);

  const label = SCOPE_LABELS[scope] || 'Revisions';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mb-0 flex items-center gap-2 text-xl font-bold">
            <BsArrowRepeat className="text-primary" />
            {label}
          </h4>
          {!loading && (
            <p className="mt-1 mb-0 text-sm text-muted-foreground">{total} revision{total !== 1 ? 's' : ''} found</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <div className="text-center">
            <Spinner className="size-6" />
            <p className="mt-3 text-muted-foreground">Loading revisions...</p>
          </div>
        </div>
      ) : revisions.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-5 text-center">
            <BsFolder2Open className="mx-auto text-5xl text-muted-foreground" />
            <p className="mt-3 mb-2 text-lg text-muted-foreground">No revisions found</p>
            <p className="mb-0 text-sm text-muted-foreground">
              Revisions appear here when a doctor re-opens a completed case.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-0 py-0 shadow-sm">
            <CardContent className="px-0">
              <Table>
                <TableHeader className="bg-[linear-gradient(to_right,#f8f9ff,#f0f4ff)]">
                  <TableRow>
                    <TableHead className="py-3 px-3 text-muted-foreground">#</TableHead>
                    <TableHead className="py-3 px-3 text-muted-foreground">Case (Patient)</TableHead>
                    <TableHead className="py-3 px-3 text-muted-foreground">Practice</TableHead>
                    <TableHead className="py-3 px-3 text-muted-foreground">Status</TableHead>
                    <TableHead className="py-3 px-3 text-muted-foreground">Picked By</TableHead>
                    <TableHead className="py-3 px-3 text-muted-foreground">Created</TableHead>
                    <TableHead className="py-3 px-3 text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revisions.map((r, index) => {
                    const pickedBy = r.pickedBy ? `${r.pickedBy.firstName} ${r.pickedBy.lastName}` : null;
                    const patient = r.case?.patientName || '—';
                    const practice = r.case?.practiceName || '—';
                    const createdDate = r.createdAt
                      ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—';
                    return (
                      <TableRow key={r._id}>
                        <TableCell className="px-3 text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="px-3 font-semibold">{patient}</TableCell>
                        <TableCell className="px-3 text-muted-foreground">{practice}</TableCell>
                        <TableCell className="px-3">
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="px-3">
                          {pickedBy ? (
                            <span>{pickedBy}</span>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 text-muted-foreground">{createdDate}</TableCell>
                        <TableCell className="px-3">
                          <Button asChild variant="outline" size="sm" className="w-fit gap-1 whitespace-nowrap">
                            <Link href={`/designer/revisions/${r._id}`}>
                              <BsEye /> View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="border-t bg-muted/30 py-2 px-3 text-sm text-muted-foreground">
              {revisions.length} revision{revisions.length !== 1 ? 's' : ''} found
            </CardFooter>
          </Card>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function RevisionsPage() {
  return (
    <DashboardShell>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-5">
            <Spinner className="size-6" />
          </div>
        }
      >
        <RevisionsContent />
      </Suspense>
    </DashboardShell>
  );
}
