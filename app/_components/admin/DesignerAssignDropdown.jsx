'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BsSearch, BsCheckLg, BsChevronDown } from 'react-icons/bs';
import { Button } from '@/app/_components/ui/button';

/**
 * Custom (non-native) searchable designer picker for the admin cases table.
 *
 * - The trigger is a single line that never grows the table row.
 * - Clicking it opens a panel that is PORTALED to <body> and positioned with
 *   `position: fixed`, so it lives completely outside the <table> element. It
 *   therefore cannot disturb the table layout or force the table to overflow
 *   horizontally or vertically.
 * - The panel contains BOTH the search field and the clickable designer list.
 * - The admin picks a designer from the list, then confirms with the icon
 *   "Assign" button.
 * - On success we hand the updated case back to the parent (onAssign) so the
 *   row refreshes in real time with no page reload.
 * - Available on every case, so the admin can update the designer any time.
 */
export default function DesignerAssignDropdown({
  caseId,
  currentDesignerId,
  currentDesignerName,
  onAssign,
}) {
  const [designers, setDesigners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(currentDesignerId ? String(currentDesignerId) : '');
  const [saveLoading, setSaveLoading] = useState(false);
  const [pos, setPos] = useState(null);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const fetchDesigners = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await fetch('/api/admin/designers', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setDesigners(Array.isArray(data) ? data : []);
          }
        }
      } catch (err) {
        console.error('Failed to load designers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDesigners();
  }, []);

  // Position the portaled panel against the trigger, and keep it glued to the
  // trigger while the user scrolls or resizes (it is fixed-position, so we
  // recompute from the live trigger rect).
  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 256) });
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

  // After the panel mounts, clamp it inside the viewport (flip above the
  // trigger if there isn't room below).
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

  // Close on outside click / Escape. The panel lives in <body>, so we must
  // check both the trigger and the (portaled) panel.
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

  const query = search.trim().toLowerCase();
  const filtered = designers.filter((d) => {
    if (!query) return true;
    const name = `${d.firstName} ${d.lastName}`.toLowerCase();
    const email = (d.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  // "Unassigned" is a deliberate choice (clear the designer), not a no-op —
  // so the only thing that disables Assign is selecting the current value.
  const unchanged = String(selectedId) === String(currentDesignerId || '');

  const handleAssign = async () => {
    if (unchanged || saveLoading) return;

    setSaveLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        // Empty selection => unassign (clears the designer, returns the case
        // to 'pending'); otherwise assign/reassign the chosen designer.
        body: JSON.stringify(selectedId ? { designerId: Number(selectedId) } : { unassign: true }),
      });

      if (response.ok) {
        const updatedCase = await response.json();
        if (typeof onAssign === 'function') onAssign(updatedCase);
        setOpen(false);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to assign designer');
      }
    } catch (err) {
      alert('Failed to assign designer');
    } finally {
      setSaveLoading(false);
    }
  };

const currentName = (() => {
  // Pending or not assigned
  if (!currentDesignerId) {
    return 'Unassigned';
  }

  // If parent already sent the designer name, use it
  if (currentDesignerName?.trim()) {
    return currentDesignerName;
  }

  // Otherwise look it up from the designers list
  const d = designers.find(
    (x) =>
      String(x._id) === String(currentDesignerId) ||
      String(x.id) === String(currentDesignerId)
  );

  if (d) {
    return `${d.firstName} ${d.lastName}`;
  }

  return 'Unassigned';
})();

  if (loading) {
    return <span className="text-muted-foreground text-sm">Loading...</span>;
  }

  if (designers.length === 0) {
    return <span className="text-muted-foreground text-sm">No designers</span>;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const next = !open;
          if (next) {
            // Reset selection + search to the current assignment when opening.
            setSelectedId(currentDesignerId ? String(currentDesignerId) : '');
            setSearch('');
          }
          setOpen(next);
        }}
        className="flex w-full min-w-[160px] items-center justify-between gap-1 truncate rounded border border-input bg-transparent px-2 py-1 text-sm hover:bg-muted"
      >
        <span className="truncate">{currentName}</span>
        <BsChevronDown className="shrink-0 text-muted-foreground" />
      </button>

      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
            className="z-[100] rounded-md border bg-popover shadow-lg"
          >
            <div className="p-2">
              <div className="relative">
                <BsSearch className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email"
                  className="w-full rounded border border-input bg-transparent py-1 pl-7 pr-2 text-sm outline-none focus:border-foreground/40"
                />
              </div>

              <ul className="mt-2 max-h-48 overflow-auto">
                <li
                  onClick={() => setSelectedId('')}
                  className={`cursor-pointer rounded px-2 py-1.5 text-sm ${
                    selectedId === '' ? 'bg-muted font-medium text-destructive' : 'hover:bg-muted'
                  }`}
                >
                  Unassign designer
                </li>
                {filtered.map((d) => (
                  <li
                    key={d._id}
                    onClick={() => setSelectedId(d._id)}
                    className={`cursor-pointer rounded px-2 py-1.5 text-sm ${
                      String(selectedId) === String(d._id) ? 'bg-muted font-medium' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="truncate">
                      {d.firstName} {d.lastName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{d.email}</div>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-2 py-1.5 text-sm text-muted-foreground">No matching designers</li>
                )}
              </ul>
            </div>

            <div className="flex justify-end border-t p-2">
              <Button
                type="button"
                size="icon"
                onClick={handleAssign}
                disabled={saveLoading || unchanged}
                title="Assign designer"
              >
                {saveLoading ? <Spinner /> : <BsCheckLg />}
              </Button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function Spinner() {
  return (
    <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
