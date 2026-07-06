'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/app/_components/admin/Navbar';
import Sidebar from '@/app/_components/admin/Sidebar';
import Spinner from '@/app/_components/shared/Spinner';

/**
 * DashboardShell — wraps every protected admin page.
 * Checks auth (must be role 'admin'), shows spinner while verifying,
 * redirects to login if needed. Login page does NOT use this component.
 */
export default function DashboardShell({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      router.replace('/admin/login');
      return;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Bad token');
      const payload = JSON.parse(atob(parts[1]));
      const expired = payload.exp && payload.exp * 1000 < Date.now();
      if (expired || payload.role !== 'admin') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/admin/login');
        return;
      }
      setReady(true);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.replace('/admin/login');
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8f9ff_0%,#e8ecff_100%)]">
        <div className="text-center">
          <div className="mb-3 inline-flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-admin-start),var(--color-admin-end))]">
            <Spinner className="size-6 border-white" />
          </div>
          <p className="mb-0 text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Navbar />
      <div className="flex flex-grow">
        <Sidebar />
        <main className="flex-grow overflow-x-auto p-4">{children}</main>
      </div>
    </div>
  );
}
