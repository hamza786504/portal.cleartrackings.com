'use client';

import { BsChevronLeft, BsChevronRight } from 'react-icons/bs';
import { Button } from '@/app/_components/ui/button';

/**
 * Simple Prev/Next pager for server-paginated tables (see /api/cases'
 * ?page= contract). Renders nothing when there's only one page.
 */
export default function Pagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className="mt-3 flex items-center justify-between">
      <p className="mb-0 text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <BsChevronLeft /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <BsChevronRight />
        </Button>
      </div>
    </div>
  );
}
