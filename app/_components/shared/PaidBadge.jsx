import { BsCheckCircleFill, BsClockHistory } from 'react-icons/bs';
import { Badge } from '@/app/_components/ui/badge';
import { cn } from '@/app/lib/utils';

/**
 * Read-only payment indicator for the doctor portal. Only the admin can mark
 * a case or revision as paid, so the doctor sees a badge instead of a
 * (disabled, greyed-out) checkbox.
 */
export default function PaidBadge({ paid, className }) {
  return paid ? (
    <Badge
      className={cn('gap-1 border-success/30 bg-success/10 text-success', className)}
      title="The admin has received your payment"
    >
      <BsCheckCircleFill /> Paid
    </Badge>
  ) : (
    <Badge
      className={cn('gap-1 border-warning/50 bg-warning/15 text-foreground', className)}
      title="The admin has not marked this payment as received yet"
    >
      <BsClockHistory className="text-warning" /> Unpaid
    </Badge>
  );
}
