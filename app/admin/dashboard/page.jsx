'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BsGridFill,
  BsFiles,
  BsClockHistory,
  BsArrowRepeat,
  BsHourglassSplit,
  BsCheckCircle,
  BsPersonBadge,
  BsPalette,
  BsTable,
  BsArrowRight,
} from 'react-icons/bs';
import DashboardShell from '@/app/_components/admin/DashboardShell';
import CaseTable from '@/app/_components/admin/CaseTable';
import StatCard from '@/app/_components/shared/StatCard';
import DriveStorageCard from '@/app/_components/admin/DriveStorageCard';
import { Button } from '@/app/_components/ui/button';
import Spinner from '@/app/_components/shared/Spinner';

export default function AdminDashboard() {
  const [cases, setCases] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driveQuota, setDriveQuota] = useState(null);
  const [driveLoading, setDriveLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const [casesRes, doctorsRes, designersRes] = await Promise.all([
          fetch('/api/admin/cases', { headers }),
          fetch('/api/admin/doctors', { headers }),
          fetch('/api/admin/designers', { headers }),
        ]);
        const [casesData, doctorsData, designersData] = await Promise.all([
          casesRes.json(),
          doctorsRes.json(),
          designersRes.json(),
        ]);
        setCases(Array.isArray(casesData) ? casesData : []);
        setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
        setDesigners(Array.isArray(designersData) ? designersData : []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();

    const fetchDriveQuota = async () => {
      setDriveLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/admin/drive-quota', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setDriveQuota(res.ok ? data : null);
      } catch (err) {
        console.error('Failed to load Google Drive storage quota:', err);
      } finally {
        setDriveLoading(false);
      }
    };
    fetchDriveQuota();
  }, []);

  const pendingDoctors = doctors.filter((d) => !d.isApproved).length;
  const pendingDesigners = designers.filter((d) => !d.isApproved).length;
  const pending = cases.filter((c) => c.status === 'pending').length;
  const inProgress = cases.filter((c) => c.status === 'in-progress').length;
  const delivered = cases.filter((c) => c.status === 'delivered').length;
  const completed = cases.filter((c) => c.status === 'completed').length;

  const statCards = [
    { label: 'Total Cases', value: cases.length, icon: BsFiles, iconClassName: 'text-foreground', iconBgClassName: 'bg-muted', link: '/admin/cases' },
    { label: 'Pending', value: pending, icon: BsClockHistory, iconClassName: 'text-warning', iconBgClassName: 'bg-warning/15', link: '/admin/cases?status=pending' },
    { label: 'In Progress', value: inProgress, icon: BsArrowRepeat, iconClassName: 'text-primary', iconBgClassName: 'bg-primary/10', link: '/admin/cases?status=in-progress' },
    { label: 'Awaiting Approval', value: delivered, icon: BsHourglassSplit, iconClassName: 'text-info', iconBgClassName: 'bg-info/15', link: '/admin/cases?status=delivered' },
    { label: 'Completed', value: completed, icon: BsCheckCircle, iconClassName: 'text-success', iconBgClassName: 'bg-success/15', link: '/admin/cases?status=completed' },
    { label: 'Doctors Pending Approval', value: pendingDoctors, icon: BsPersonBadge, iconClassName: 'text-destructive', iconBgClassName: 'bg-destructive/10', link: '/admin/doctors' },
    { label: 'Designers Pending Approval', value: pendingDesigners, icon: BsPalette, iconClassName: 'text-destructive', iconBgClassName: 'bg-destructive/10', link: '/admin/designers' },
  ];

  return (
    <DashboardShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <BsGridFill /> Admin Dashboard
          </h4>
          <p className="mb-0 text-sm text-muted-foreground">System-wide overview</p>
        </div>
        <Button asChild variant="default" className="gap-2 bg-foreground text-background hover:bg-foreground/90">
          <Link href="/admin/cases">
            <BsFiles /> View All Cases
          </Link>
        </Button>
      </div>

      <DriveStorageCard quota={driveQuota} loading={driveLoading} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h5 className="mb-0 flex items-center gap-2 font-bold">
          <BsTable className="text-muted-foreground" /> Recent Cases
        </h5>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/cases" className="gap-1">
            View All <BsArrowRight />
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <div className="text-center">
            <Spinner className="size-6" />
            <p className="mt-3 text-sm text-muted-foreground">Fetching cases...</p>
          </div>
        </div>
      ) : (
        <CaseTable cases={cases.slice(0, 10)} />
      )}
    </DashboardShell>
  );
}
