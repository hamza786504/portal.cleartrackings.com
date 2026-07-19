'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BsChevronDown, BsCheckLg } from 'react-icons/bs';
import { cn } from '@/app/lib/utils';
import { STATUS_VARIANTS } from '@/app/_components/shared/statusVariants';
import StatusBadge from '@/app/_components/shared/StatusBadge';
import Spinner from '@/app/_components/shared/Spinner';
import HoldCaseModal from '@/app/_components/admin/HoldCaseModal';

// The order the statuses appear in the dropdown. 'hold' is admin-only by
// design (set via this dropdown), but it is listed alongside the others so
// the admin can move a case in and out of hold freely.
const STATUS_ORDER = ['in-progress', 'delivered', 'completed', 'hold'];

/**
 * Status picker for the admin cases table.
 *
 * - The trigger is the current status rendered as a Badge with a chevron, so
 *   it fits inline in the Status column without growing the row.
 * - Clicking it opens a narrow, padded, labeled menu that is PORTALED to
 *   <body> (position: fixed) so it never disturbs the table layout or forces
 *   the table to overflow.
 * - The admin picks a status; we PATCH /api/admin/cases/[id] and hand the
 *   updated case back via onStatusChange for a real-time row refresh.
 * - Only admins use this component, so 'hold' is reachable here.
 */
export default function StatusChangeDropdown({ caseId, currentStatus, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [saving, setSaving] = useState(null); // status currently being applied
  const [holdModalOpen, setHoldModalOpen] = useState(false);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 184) });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, updatePosition]);

  // Clamp inside the viewport once the panel mounts.
  useEffect(() => {
    if (!open || !pos || !panelRef.current || !triggerRef.current) return;
    const pr = panelRef.current.getBoundingClientRect();
    const tr = triggerRef.current.getBoundingClientRect();
    let { top, left } = pos;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (left + pr.width > vw - 8) left = Math.max(8, vw - pr.width - 8);
    if (top + pr.height > vh - 8) {
      top = tr.top - pr.height - 4;
      if (top < 8) top = 8;
    }
    if (top !== pos.top || left !== pos.left) {
      setPos((p) => (p ? { ...p, top, left } : p));
    }
  }, [open, pos]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        panelRef.current &&
        !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = async (status) => {
    if (status === currentStatus || saving) return;
    setSaving(status);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        const updatedCase = await response.json();
        if (typeof onStatusChange === 'function') onStatusChange(updatedCase);
        setOpen(false);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update status');
      }
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
        title="Change status"
      >
        <StatusBadge status={currentStatus} />
        <BsChevronDown className="text-muted-foreground" />
      </button>

      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
            className="z-[100] rounded-md border bg-popover p-1 shadow-lg"
          >
            {STATUS_ORDER.map((s) => {
              const active = s === currentStatus;
              const isSaving = saving === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (s === 'hold') {
                      // Holding requires a reason from the admin first.
                      setOpen(false);
                      setHoldModalOpen(true);
                    } else {
                      handleSelect(s);
                    }
                  }}
                  disabled={isSaving}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm',
                    active ? 'bg-muted font-medium' : 'hover:bg-muted'
                  )}
                >
                  <StatusBadge status={s} />
                  {isSaving ? (
                    <Spinner className="size-3.5" />
                  ) : active ? (
                    <BsCheckLg className="text-foreground" />
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body
        )}

      <HoldCaseModal
        caseId={caseId}
        open={holdModalOpen}
        onOpenChange={setHoldModalOpen}
        onHeld={onStatusChange}
      />
    </>
  );
}
