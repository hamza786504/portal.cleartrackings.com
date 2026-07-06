import { cn } from '@/app/lib/utils';

export default function Spinner({ className, label = 'Loading...' }) {
  return (
    <span
      role="status"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em]',
        className
      )}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
