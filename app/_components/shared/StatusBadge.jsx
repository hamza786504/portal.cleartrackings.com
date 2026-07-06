import { Badge } from '@/app/_components/ui/badge';
import { cn } from '@/app/lib/utils';
import { getStatusVariant } from './statusVariants';

export default function StatusBadge({ status, label, className }) {
  const variant = getStatusVariant(status);
  return (
    <Badge className={cn(variant.className, className)}>
      {label || variant.label}
    </Badge>
  );
}
