'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BsGridFill, BsPersonWorkspace, BsFiles, BsCheckCircle, BsBoxArrowRight, BsArrowRepeat } from 'react-icons/bs';
import { cn } from '@/app/lib/utils';

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentScope = searchParams.get('scope');

  const isActive = (path) => pathname === path;

  // Active check for cases tabs — considers path + search param
  const isCasesActive = (scope) => {
    if (!pathname.startsWith('/designer/cases')) return false;
    if (scope === 'all') return !currentScope || currentScope === 'all';
    return currentScope === scope;
  };

  const linkClass = (active) =>
    cn(
      'mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground no-underline',
      active &&
        'bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end))] font-semibold text-white'
    );

  return (
    <div className="flex min-h-screen w-60 min-w-60 flex-col bg-white p-3 shadow-sm">
      <p className="mt-1 mb-2 px-1 text-[0.68rem] font-bold tracking-widest text-muted-foreground uppercase">
        Navigation
      </p>

      <ul className="flex flex-col">
        <li>
          <Link href="/designer/dashboard" className={linkClass(isActive('/designer/dashboard'))}>
            <BsGridFill /> Dashboard
          </Link>
        </li>

        <li>
          <Link href="/designer/cases?scope=mine" className={linkClass(isCasesActive('mine'))}>
            <BsPersonWorkspace /> My Cases
          </Link>
        </li>

        <li>
          <Link href="/designer/cases?scope=all" className={linkClass(isCasesActive('all'))}>
            <BsFiles /> All Cases
          </Link>
        </li>

        <li>
          <Link href="/designer/cases?scope=completed" className={linkClass(isCasesActive('completed'))}>
            <BsCheckCircle /> Completed Cases
          </Link>
        </li>

        <li>
          <Link href="/designer/revisions?scope=all" className={linkClass(isActive('/designer/revisions'))}>
            <BsArrowRepeat /> Revisions
          </Link>
        </li>
      </ul>

      <div className="mt-auto">
        <hr className="my-2" />
        <button
          className="flex w-full items-center gap-2 rounded-md bg-transparent px-3 py-2 text-left text-sm text-destructive"
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/designer/login';
          }}
        >
          <BsBoxArrowRight /> Logout
        </button>
      </div>
    </div>
  );
}

// Suspense wrapper — required because useSearchParams needs it in App Router
export default function Sidebar() {
  return (
    <Suspense fallback={<div className="min-h-screen w-60 min-w-60 bg-white p-3 shadow-sm" />}>
      <SidebarContent />
    </Suspense>
  );
}
