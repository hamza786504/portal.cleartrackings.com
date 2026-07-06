'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Spinner from '@/app/_components/shared/Spinner';

/**
 * /doctor — sends an already-logged-in doctor straight to their dashboard,
 * everyone else to the login page. Mirrors DashboardShell's local
 * (no-network) token check; DashboardShell still re-verifies against the
 * DB once they land on /doctor/dashboard.
 */
export default function DoctorIndex() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      router.replace('/doctor/login');
      return;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Bad token');
      const payload = JSON.parse(atob(parts[1]));
      const expired = payload.exp && payload.exp * 1000 < Date.now();
      if (expired) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/doctor/login');
        return;
      }
      router.replace('/doctor/dashboard');
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.replace('/doctor/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8f9ff_0%,#e8ecff_100%)]">
      <Spinner className="size-8" />
    </div>
  );
}
