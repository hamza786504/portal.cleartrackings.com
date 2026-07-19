'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { BsFiles } from 'react-icons/bs';
import CaseTable from '@/app/_components/designer/CaseTable';
import DashboardShell from '@/app/_components/designer/DashboardShell';
import Spinner from '@/app/_components/shared/Spinner';
import Pagination from '@/app/_components/shared/Pagination';

const SCOPE_LABELS = {
  all: 'All Cases',
  mine: 'My Cases',
  completed: 'Completed Cases',
};

const PAGE_SIZE = 10;

function CasesContent() {
  const searchParams = useSearchParams();
  const scope = searchParams.get('scope') || 'all';
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [casesRes, revsRes] = await Promise.all([
        fetch(`/api/cases?scope=${scope}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/revisions?scope=${scope}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const casesData = await casesRes.json();
      const cases = Array.isArray(casesData) ? casesData : casesData.cases || [];
      const revsData = await revsRes.json();
      const revisions = Array.isArray(revsData) ? revsData : [];

      // Cases and revisions merged into one unified, date-sorted list so a
      // designer sees revisions (to pick) interleaved with the cases.
      const caseRows = cases.map((c) => ({
        kind: 'case',
        _id: c._id,
        patientName: c.patientName,
        description: c.chiefComplaint || '—',
        caseType: c.caseType || '—',
        status: c.revisionStatus ?? c.status,
        pickedBy: c.pickedBy || null,
        createdAt: c.createdAt,
      }));
      const revRows = revisions.map((r) => ({
        kind: 'revision',
        _id: r._id,
        patientName: r.case?.patientName || '—',
        description: r.specialNote ? `Revision: ${r.specialNote}` : 'Revision',
        caseType: 'Revision',
        status: r.status,
        pickedBy: r.pickedBy || null,
        createdAt: r.createdAt,
      }));

      const combined = [...caseRows, ...revRows].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setAllRows(combined);
      setTotal(combined.length);
      setTotalPages(Math.max(1, Math.ceil(combined.length / PAGE_SIZE)));
    } catch (err) {
      console.error('Error fetching cases:', err);
      setAllRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // Filter changed — start back at page 1.
  useEffect(() => {
    setPage(1);
  }, [scope]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const handlePickCase = async (id) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/cases/${id}/pick`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Failed to pick case.');
      return;
    }
    await fetchData();
  };

  const handlePickRevision = async (id) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/revisions/${id}/pick`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Failed to pick revision.');
      return;
    }
    await fetchData();
  };

  // Attach per-row view/pick behavior (closures need the live handlers) and
  // slice to the current client page.
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allRows.slice(start, start + PAGE_SIZE).map((r) => ({
      ...r,
      viewHref: r.kind === 'revision' ? `/designer/revisions/${r._id}` : `/designer/cases/${r._id}`,
      canPick: !r.pickedBy,
      pick: r.kind === 'revision' ? () => handlePickRevision(r._id) : () => handlePickCase(r._id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, page]);

  const label = SCOPE_LABELS[scope] || 'Cases';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mb-0 flex items-center gap-2 text-xl font-bold">
            <BsFiles className="text-primary" />
            {label}
          </h4>
          {!loading && (
            <p className="mt-1 mb-0 text-sm text-muted-foreground">{total} item{total !== 1 ? 's' : ''} found</p>
          )}
        </div>
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
          <CaseTable rows={pageRows} scope={scope} />
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
