import Link from 'next/link';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Skeleton } from '@/app/_components/ui/skeleton';
import { cn } from '@/app/lib/utils';

/**
 * Icon-in-colored-circle stat tile, used across the doctor/admin/designer
 * dashboards and the admin analytics page.
 */
export default function StatCard({ icon: Icon, label, value, loading, iconClassName, iconBgClassName, valueClassName, href }) {
  const content = (
    <Card className={cn('h-full border-0 py-0 shadow-sm', href && 'cursor-pointer transition-shadow hover:shadow-md')}>
      <CardContent className="flex items-center gap-3 px-4 py-4">
        <div
          className={cn('flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg', iconBgClassName)}
        >
          <Icon className={cn('h-5 w-5', iconClassName)} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-muted-foreground">{label}</div>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-10" />
          ) : (
            <div className={cn('text-2xl font-bold', valueClassName)}>{value}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="no-underline">
      {content}
    </Link>
  ) : (
    content
  );
}
