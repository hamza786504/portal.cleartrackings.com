'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/app/_components/doctor/Navbar';
import Sidebar from '@/app/_components/doctor/Sidebar';
import Spinner from '@/app/_components/shared/Spinner';

/**
 * DashboardShell — wraps every protected doctor page.
 * Checks auth, shows spinner while verifying, redirects to login if needed.
 * Login and Signup pages do NOT use this component.
 */
export default function DashboardShell({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      router.replace('/doctor/login');
      return;
    }

    // Decode JWT and check expiry without a network call
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
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.replace('/doctor/login');
      return;
    }

    // Re-check against the DB — catches an admin suspending this account
    // after the token was issued (a JWT alone can't know about that).
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.replace(`/doctor/login${data.suspended ? '?suspended=1' : ''}`);
          return;
        }
        setReady(true);
      })
      .catch(() => setReady(true)); // network hiccup — don't lock the user out
  }, [router]);

  // Verifying spinner — only shown for protected pages, never on login/signup
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8f9ff_0%,#e8ecff_100%)]">
        <div className="text-center">
          <div className="mb-3 inline-flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-start),var(--color-brand-end))]">
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
