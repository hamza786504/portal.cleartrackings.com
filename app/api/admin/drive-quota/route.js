import { NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import driveService from '@/app/lib/googleDrive';

const LOW_SPACE_THRESHOLD_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

/**
 * GET /api/admin/drive-quota
 * Admin: current Google Drive storage usage for the account behind
 * GOOGLE_REFRESH_TOKEN, plus a flag for when free space drops below 5GB.
 */
export async function GET(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { limit, usage } = await driveService.getStorageQuota();
    const free = limit !== null ? limit - usage : null;

    return NextResponse.json({
      limit,
      usage,
      free,
      usagePercent: limit ? Math.round((usage / limit) * 1000) / 10 : null,
      isLow: free !== null && free < LOW_SPACE_THRESHOLD_BYTES,
      thresholdBytes: LOW_SPACE_THRESHOLD_BYTES,
    });
  } catch (error) {
    console.error('Drive quota error:', error);
    return NextResponse.json({ message: 'Failed to fetch Google Drive storage quota.' }, { status: 500 });
  }
}
