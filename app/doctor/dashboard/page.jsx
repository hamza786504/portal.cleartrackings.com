'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BsGridFill,
  BsFiles,
  BsClockHistory,
  BsArrowRepeat,
  BsHourglassSplit,
  BsCheckCircle,
  BsPlusLg,
  BsTable,
  BsArrowRight,
} from 'react-icons/bs';
import CaseTable from '@/app/_components/doctor/CaseTable';
import DashboardShell from '@/app/_components/doctor/DashboardShell';
import StatCard from '@/app/_components/shared/StatCard';
import { Button } from '@/app/_components/ui/button';
import Spinner from '@/app/_components/shared/Spinner';

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    delivered: 0,
    completed: 0,
  });

  useEffect(() => {
    const fetchCases = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/cases', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setCases(list);

        // Compute stats
        const total = list.length;
        const pending = list.filter((c) => c.status === 'pending').length;
        const completed = list.filter((c) => c.status === 'completed').length;
        const inProgress = list.filter((c) => c.status === 'in-progress').length;
        const delivered = list.filter((c) => c.status === 'delivered').length;
        setStats({ total, pending, inProgress, delivered, completed });
      } catch (err) {
        console.error('Failed to load cases:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  const statCards = [
    {
      label: 'Total Cases',
      value: stats.total,
      icon: BsFiles,
      iconClassName: 'text-primary',
      iconBgClassName: 'bg-primary/10',
      link: '/doctor/cases',
    },
    {
      label: 'Pending',
      value: stats.pending,
      icon: BsClockHistory,
      iconClassName: 'text-warning',
      iconBgClassName: 'bg-warning/15',
      link: '/doctor/cases?status=pending',
    },
    {
      label: 'In Progress',
      value: stats.inProgress,
      icon: BsArrowRepeat,
      iconClassName: 'text-info',
      iconBgClassName: 'bg-info/15',
      link: '/doctor/cases?status=in-progress',
    },
    {
      label: 'Awaiting Your Approval',
      value: stats.delivered,
      icon: BsHourglassSplit,
      iconClassName: 'text-info',
      iconBgClassName: 'bg-info/15',
      link: '/doctor/cases?status=delivered',
    },
    {
      label: 'Completed',
      value: stats.completed,
      icon: BsCheckCircle,
      iconClassName: 'text-success',
      iconBgClassName: 'bg-success/15',
      link: '/doctor/cases?status=completed',
    },
  ];

  return (
    <DashboardShell>
      {/* Page Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <BsGridFill className="text-primary" />
            Doctor Dashboard
          </h4>
          <p className="mb-0 text-sm text-muted-foreground">Overview of all your orthodontic cases</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/doctor/cases/add">
            <BsPlusLg /> New Case
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} href={card.link} loading={loading} />
        ))}
      </div>

      {/* Recent Cases */}
      <div className="mb-3 flex items-center justify-between">
        <h5 className="mb-0 flex items-center gap-2 font-bold">
          <BsTable className="text-muted-foreground" />
          Recent Cases
        </h5>
        <Button asChild variant="outline" size="sm">
          <Link href="/doctor/cases" className="gap-1">
            View All <BsArrowRight />
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <div className="text-center">
            <Spinner className="size-6" />
            <p className="mt-3 text-sm text-muted-foreground">Fetching your cases...</p>
          </div>
        </div>
      ) : (
        <CaseTable cases={cases} status="all" />
      )}
    </DashboardShell>
  );
}
