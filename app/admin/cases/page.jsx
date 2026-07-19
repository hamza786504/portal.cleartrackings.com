'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BsFiles } from 'react-icons/bs';
import CaseTable from '@/app/_components/admin/CaseTable';
import DashboardShell from '@/app/_components/admin/DashboardShell';
import { Button } from '@/app/_components/ui/button';
import Spinner from '@/app/_components/shared/Spinner';
import { cn } from '@/app/lib/utils';

const STATUS_LABELS = {
  all: 'All Cases',
  pending: 'Pending Cases',
  'in-progress': 'In Progress Cases',
  delivered: 'Awaiting Approval',
  completed: 'Completed Cases',
};

function CasesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get('status') || 'all';
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const query = status !== 'all' ? `?status=${status}` : '';
      const res = await fetch(`/api/admin/cases${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching cases:', err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  // Merge an updated case into the list in place so the row refreshes
  // immediately after a designer assignment — no page reload needed.
  const handleCaseUpdated = (updatedCase) => {
    setCases((prev) =>
      prev.map((c) => (c._id === updatedCase._id ? updatedCase : c))
    );
  };

  // Remove deleted case(s) from the list after an admin delete.
  const handleCasesDeleted = (ids) => {
    const set = new Set(ids);
    setCases((prev) => prev.filter((c) => !set.has(c._id)));
  };

  useEffect(() => {
    fetchData();
  }, [status]);

  const label = STATUS_LABELS[status] || 'Cases';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mb-0 flex items-center gap-2 text-xl font-bold">
            <BsFiles /> {label}
          </h4>
          {!loading && (
            <p className="mt-1 mb-0 text-sm text-muted-foreground">{cases.length} case{cases.length !== 1 ? 's' : ''} found</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {['all', 'pending', 'in-progress', 'delivered', 'completed'].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? 'default' : 'outline'}
              className={cn(status === s && 'bg-foreground text-background hover:bg-foreground/90')}
              onClick={() => router.push(`/admin/cases?status=${s}`)}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))}
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
        <CaseTable cases={cases} onCasesChange={handleCaseUpdated} onCasesDeleted={handleCasesDeleted} />
      )}
    </div>
  );
}

export default function AdminCasesPage() {
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
