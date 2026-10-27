'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BsArrowRepeat,
  BsBell,
  BsBellFill,
  BsCheck2Circle,
  BsFolderPlus,
  BsHammer,
  BsHandThumbsUp,
  BsImages,
  BsPersonPlus,
  BsUnlock,
} from 'react-icons/bs';
import { Button } from '@/app/_components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/_components/ui/dropdown-menu';
import { cn } from '@/app/lib/utils';

const POLL_INTERVAL_MS = 30000;

const TYPE_ICONS = {
  new_case: BsFolderPlus,
  revision_available: BsArrowRepeat,
  revision_delivered: BsCheck2Circle,
  case_delivered: BsCheck2Circle,
  new_doctor_signup: BsPersonPlus,
  new_designer_signup: BsPersonPlus,
  case_available: BsFolderPlus,
  work_started: BsHammer,
  work_approved: BsHandThumbsUp,
  case_approved: BsHandThumbsUp,
  revision_approved: BsHandThumbsUp,
  revision_requested: BsArrowRepeat,
  access_granted: BsUnlock,
  case_files_updated: BsImages,
};

const TYPE_LINKS = {
  new_doctor_signup: '/admin/doctors',
  new_designer_signup: '/admin/designers',
};

// Admin notifications store a caseId; doctor/designer ones store a ready-made link
function hrefFor(n) {
  if (n.link) return n.link;
  if (n.caseId) return `/admin/cases/${n.caseId}`;
  if (TYPE_LINKS[n.type]) return TYPE_LINKS[n.type];
  return null;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchNotifications(apiBase) {
  try {
    const res = await fetch(`${apiBase}?limit=20`, { headers: authHeaders() });
    return res.ok ? await res.json() : null;
  } catch {
    return null; // Network hiccup — the next poll will retry
  }
}

/**
 * Navbar bell for every portal. `apiBase` is /api/admin/notifications for the
 * admin and /api/notifications for doctors and designers.
 */
export default function NotificationBell({ apiBase = '/api/notifications' }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(() => {
    fetchNotifications(apiBase).then((data) => {
      if (!data) return;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    });
  }, [apiBase]);

  // Poll so new notifications show up without a page refresh; refresh on tab focus too
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      setNotifications((list) =>
        list.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch(`${apiBase}/${notification.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
      }).catch(() => {});
    }
    const href = hrefFor(notification);
    if (href) router.push(href);
  };

  const markAllRead = async (e) => {
    e.preventDefault();
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch(`${apiBase}/read-all`, {
      method: 'POST',
      headers: authHeaders(),
    }).catch(() => {});
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && load()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative text-white/80 hover:bg-white/10 hover:text-white"
          title="Notifications"
          aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
        >
          {unreadCount ? <BsBellFill className="size-5" /> : <BsBell className="size-5" />}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-[18px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-medium text-primary hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications yet</p>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] || BsBell;
              return (
              <DropdownMenuItem
                key={n.id}
                onSelect={() => openNotification(n)}
                className={cn(
                  'cursor-pointer items-start gap-3 rounded-none border-b px-3 py-2.5 last:border-b-0',
                  !n.isRead && 'bg-primary/5'
                )}
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', !n.isRead && 'font-semibold')}>{n.title}</span>
                  <span className="block text-xs whitespace-normal text-muted-foreground">{n.message}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
