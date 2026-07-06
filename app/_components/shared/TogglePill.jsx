'use client';

import { cn } from '@/app/lib/utils';

/**
 * Presentational selectable pill button used throughout the case-add form
 * (tooth-numbering system, impression method, occlusion/goal pickers, tooth
 * grids, etc). Selection state/logic stays owned by the parent form — this
 * is purely the visual toggle, matching the original rounded-pill look.
 */
export default function TogglePill({ selected, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
