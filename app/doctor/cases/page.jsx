'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BsFiles, BsPlusLg } from 'react-icons/bs';
import CaseTable from '@/app/_components/doctor/CaseTable';
import DashboardShell from '@/app/_components/doctor/DashboardShell';
import { Button } from '@/app/_components/ui/button';
import Spinner from '@/app/_components/shared/Spinner';
import Pagination from '@/app/_components/shared/Pagination';

const STATUS_LABELS = {
  all: 'All Cases',
  pending: 'Pending Cases',
  'in-progress': 'In Progress Cases',
  delivered: 'Awaiting Your Approval',
  completed: 'Completed Cases',
};

function CasesContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status') || 'all';
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter changed — start back at page 1.
  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({ page: String(page) });
        if (status !== 'all') params.set('status', status);
        const res = await fetch(`/api/cases?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setCases(Array.isArray(data.cases) ? data.cases : []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        console.error('Error fetching cases:', err);
        setCases([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [status, page]);

  const label = STATUS_LABELS[status] || 'Cases';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mb-0 flex items-center gap-2 text-xl font-bold">
            <BsFiles className="text-primary" />
            {label}
          </h4>
          {!loading && (
            <p className="mt-1 mb-0 text-sm text-muted-foreground">{total} case{total !== 1 ? 's' : ''} found</p>
          )}
        </div>
        <Button asChild className="gap-2">
          <Link href="/doctor/cases/add">
            <BsPlusLg /> New Case
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <div className="text-center">
            <Spinner className="size-6" />
            <p className="mt-3 text-muted-foreground">Loading cases...</p>
          </div>
        </div>
      ) : (
        <>
          <CaseTable cases={cases} status={status} />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function CasesPage() {
  return (
    <DashboardShell>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-5">
            <Spinner className="size-6" />
          </div>
        }
      >
        <CasesContent />
      </Suspense>
    </DashboardShell>
  );
}
