import { BsCloudFill, BsExclamationTriangleFill } from 'react-icons/bs';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/app/_components/ui/alert';
import { Skeleton } from '@/app/_components/ui/skeleton';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return 'Unlimited';
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Google Drive storage usage tile for the admin dashboard, with a
 * low-space warning banner when free space drops below the 5GB threshold.
 */
export default function DriveStorageCard({ quota, loading }) {
  if (loading) {
    return (
      <Card className="mb-4 border-0 py-0 shadow-sm">
        <CardContent className="px-4 py-4">
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!quota) return null;

  const { limit, usage, free, usagePercent, isLow } = quota;

  return (
    <>
      {isLow && (
        <Alert variant="destructive" className="mb-4">
          <BsExclamationTriangleFill />
          <AlertTitle>Google Drive storage running low</AlertTitle>
          <AlertDescription>
            Only {formatBytes(free)} of free space left. Free up space or upgrade the Google Drive plan.
          </AlertDescription>
        </Alert>
      )}
      <Card className="mb-4 border-0 py-0 shadow-sm">
        <CardContent className="px-4 py-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <BsCloudFill /> Google Drive Storage
            </div>
            <div className="text-sm text-muted-foreground">
              {formatBytes(usage)} of {formatBytes(limit)} used
              {free !== null && ` · ${formatBytes(free)} free`}
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${isLow ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${Math.min(usagePercent ?? 0, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
