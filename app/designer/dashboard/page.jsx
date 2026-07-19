'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BsGridFill,
  BsFiles,
  BsUnlock,
  BsPersonWorkspace,
  BsCheckCircleFill,
  BsTable,
  BsArrowRight,
} from 'react-icons/bs';
import CaseTable from '@/app/_components/designer/CaseTable';
import DashboardShell from '@/app/_components/designer/DashboardShell';
import StatCard from '@/app/_components/shared/StatCard';
import { Button } from '@/app/_components/ui/button';
import Spinner from '@/app/_components/shared/Spinner';

const RECENT_LIMIT = 10;

export default function Dashboard() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    mine: 0,
    completed: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const [casesRes, revsRes] = await Promise.all([
        fetch('/api/cases?scope=all', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/revisions?scope=all', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const casesData = await casesRes.json();
      const cases = Array.isArray(casesData) ? casesData : [];
      const revsData = await revsRes.json();
      const revisions = Array.isArray(revsData) ? revsData : [];

      // Cases + revisions merged into one unified, date-sorted list so the
      // "Recent Cases" table surfaces pickable revisions interleaved with cases.
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

      // Compute stats over the unified list (cases + revisions are both pickable).
      const total = combined.length;
      const available = combined.filter((c) => !c.pickedBy).length;
      const mine = combined.filter((c) => c.pickedBy?._id === storedUser.id).length;
      const completed = combined.filter(
        (c) => c.pickedBy?._id === storedUser.id && c.status === 'completed'
      ).length;
      setStats({ total, available, mine, completed });
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Attach per-row view/pick behavior and slice to the recent-items limit.
  const pageRows = useMemo(() => {
    return allRows.slice(0, RECENT_LIMIT).map((r) => ({
      ...r,
      viewHref: r.kind === 'revision' ? `/designer/revisions/${r._id}` : `/designer/cases/${r._id}`,
      canPick: !r.pickedBy,
      pick: r.kind === 'revision' ? () => handlePickRevision(r._id) : () => handlePickCase(r._id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows]);

  const statCards = [
    {
      label: 'Total Cases',
      value: stats.total,
      icon: BsFiles,
      iconClassName: 'text-primary',
      iconBgClassName: 'bg-primary/10',
      link: '/designer/cases?scope=all',
    },
    {
      label: 'Available to Pick',
      value: stats.available,
      icon: BsUnlock,
      iconClassName: 'text-success',
      iconBgClassName: 'bg-success/15',
      link: '/designer/cases?scope=all',
    },
    {
      label: 'My Cases',
      value: stats.mine,
      icon: BsPersonWorkspace,
      iconClassName: 'text-info',
      iconBgClassName: 'bg-info/15',
      link: '/designer/cases?scope=mine',
    },
    {
      label: 'Completed Cases',
      value: stats.completed,
      icon: BsCheckCircleFill,
      iconClassName: 'text-success',
      iconBgClassName: 'bg-success/15',
      link: '/designer/cases?scope=completed',
    },
  ];

  return (
    <DashboardShell>
      {/* Page Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <BsGridFill className="text-primary" />
            Designer Dashboard
          </h4>
          <p className="mb-0 text-sm text-muted-foreground">Overview of all orthodontic cases</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/designer/cases?scope=all">
            <BsFiles /> Browse All Cases
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </div>

      {/* Recent Cases */}
      <div className="mb-3 flex items-center justify-between">
        <h5 className="mb-0 flex items-center gap-2 font-bold">
          <BsTable className="text-muted-foreground" /> Recent Cases
        </h5>
        <Button asChild variant="outline" size="sm">
          <Link href="/designer/cases?scope=all" className="gap-1">
            View All <BsArrowRight />
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <div className="text-center">
            <Spinner className="size-6" />
            <p className="mt-3 text-muted-foreground">Fetching cases...</p>
          </div>
        </div>
      ) : (
        <CaseTable rows={pageRows} scope="all" />
      )}
    </DashboardShell>
  );
}
