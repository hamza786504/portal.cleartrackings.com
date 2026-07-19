'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BsGridFill,
  BsFiles,
  BsPersonBadge,
  BsPalette,
  BsBarChartLine,
  BsFolder2,
  BsBoxArrowRight,
} from 'react-icons/bs';
import { cn } from '@/app/lib/utils';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: BsGridFill },
  { href: '/admin/cases', label: 'All Cases', icon: BsFiles },
  { href: '/admin/doctors', label: 'Doctors', icon: BsPersonBadge },
  { href: '/admin/designers', label: 'Designers', icon: BsPalette },
  { href: '/admin/analytics', label: 'Analytics', icon: BsBarChartLine },
  { href: '/admin/drive-files', label: 'Drive Manager', icon: BsFolder2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (path) => pathname === path || pathname.startsWith(path + '/');

  return (
    <div className="flex min-h-screen w-60 min-w-60 flex-col bg-white p-3 shadow-sm">
      <p className="mt-1 mb-2 px-1 text-[0.68rem] font-bold tracking-widest text-muted-foreground uppercase">
        Navigation
      </p>

      <ul className="flex flex-col">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                'mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground no-underline',
                isActive(href) &&
                  'bg-[linear-gradient(to_right,var(--color-admin-start),var(--color-admin-end))] font-semibold text-white'
              )}
            >
              <Icon /> {label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <hr className="my-2" />
        <button
          className="flex w-full items-center gap-2 rounded-md bg-transparent px-3 py-2 text-left text-sm text-destructive"
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/admin/login';
          }}
        >
          <BsBoxArrowRight /> Logout
        </button>
      </div>
    </div>
  );
}
