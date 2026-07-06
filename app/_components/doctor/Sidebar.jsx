'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  BsGridFill,
  BsFiles,
  BsClockHistory,
  BsArrowRepeat,
  BsCheckCircle,
  BsPlusCircle,
  BsBoxArrowRight,
} from 'react-icons/bs';
import { cn } from '@/app/lib/utils';

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status');

  const isActive = (path) => pathname === path;

  // Active check for cases tabs — considers path + search param
  const isCasesActive = (status) => {
    if (!pathname.startsWith('/doctor/cases') || pathname.startsWith('/doctor/cases/add')) return false;
    if (status === 'all') return !currentStatus || currentStatus === 'all';
    return currentStatus === status;
  };

  const navBase = 'flex items-center gap-2 rounded-md py-2 px-3 mb-1 text-sm no-underline';
  const activeClass = 'bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end))] text-white font-semibold';
  const inactiveClass = 'text-muted-foreground';

  return (
    <div className="flex min-h-screen w-60 min-w-60 flex-col bg-white p-3 shadow-sm">
      <p className="mt-1 mb-2 px-1 text-[0.68rem] font-bold tracking-widest text-muted-foreground uppercase">
        Navigation
      </p>

      <ul className="flex flex-col">
        {/* Dashboard */}
        <li>
          <Link
            href="/doctor/dashboard"
            className={cn(navBase, isActive('/doctor/dashboard') ? activeClass : inactiveClass)}
          >
            <BsGridFill /> Dashboard
          </Link>
        </li>

        {/* All Cases */}
        <li>
          <Link
            href="/doctor/cases"
            className={cn(navBase, isCasesActive('all') ? activeClass : inactiveClass)}
          >
            <BsFiles /> All Cases
          </Link>
        </li>

        {/* Pending */}
        <li>
          <Link
            href="/doctor/cases?status=pending"
            className={cn(navBase, isCasesActive('pending') ? activeClass : inactiveClass)}
          >
            <BsClockHistory /> Pending Cases
          </Link>
        </li>

        {/* In Progress */}
        <li>
          <Link
            href="/doctor/cases?status=in-progress"
            className={cn(navBase, isCasesActive('in-progress') ? activeClass : inactiveClass)}
          >
            <BsArrowRepeat /> In Progress
          </Link>
        </li>

        {/* Completed */}
        <li>
          <Link
            href="/doctor/cases?status=completed"
            className={cn(navBase, isCasesActive('completed') ? activeClass : inactiveClass)}
          >
            <BsCheckCircle /> Completed Cases
          </Link>
        </li>

        <li>
          <hr className="my-2" />
        </li>

        {/* Create New Case */}
        <li>
          <Link
            href="/doctor/cases/add"
            className={cn(
              navBase,
              isActive('/doctor/cases/add') ? activeClass : 'font-semibold text-primary'
            )}
          >
            <BsPlusCircle /> Create New Case
          </Link>
        </li>
      </ul>

      {/* Logout pinned to bottom */}
      <div className="mt-auto">
        <hr />
        <button
          className={cn(navBase, 'w-full border-0 bg-transparent text-left text-destructive')}
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/doctor/login';
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
