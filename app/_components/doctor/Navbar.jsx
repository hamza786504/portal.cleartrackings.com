'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BsColumnsGap, BsBoxArrowRight } from 'react-icons/bs';
import { Button } from '@/app/_components/ui/button';
import { Avatar, AvatarFallback } from '@/app/_components/ui/avatar';
import NotificationBell from '@/app/_components/shared/NotificationBell';

function Navbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/doctor/login';
  };

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'D'
    : 'D';

  const fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Doctor';

  return (
    <nav className="bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end))] px-3 py-2.5 md:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/doctor/dashboard" className="flex items-center gap-2 font-bold text-white no-underline">
          <span className="text-xl">ClearTrackings</span>
        </Link>

        <div className="hidden items-center gap-2 text-white/70 sm:flex">
          <Link href="/doctor/dashboard" className="flex items-center gap-1 text-white/70 no-underline hover:text-white">
            <BsColumnsGap /> Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-3 text-white">
          <NotificationBell apiBase="/api/notifications" />
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarFallback className="bg-white font-bold text-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <div className="text-sm leading-tight font-bold">{fullName}</div>
              <div className="text-xs leading-tight text-white/70">Doctor</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={handleLogout}
            title="Logout"
          >
            <BsBoxArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
