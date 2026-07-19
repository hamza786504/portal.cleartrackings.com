import { NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import { getCaseRelatedIds, bulkDeleteDriveItems } from '@/app/lib/driveDelete';

/**
 * DELETE /api/admin/drive-files/bulk
 * Admin: permanently delete many orphaned Drive files/folders at once.
 * Body: { ids: string[] }
 * Folders are deleted recursively (inner non-case content removed first),
 * and anything tied to a case is skipped entirely. Returns the breakdown so
 * the client can report what succeeded vs. was blocked or failed.
 */
export async function DELETE(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json({ message: 'No file ids provided' }, { status: 400 });
    }

    const caseRelatedIds = await getCaseRelatedIds();
    const result = await bulkDeleteDriveItems(ids, caseRelatedIds);

    return NextResponse.json({
      success: result.success,
      failed: result.failed,
      blocked: result.blocked,
    });
  } catch (error) {
    console.error('Bulk Drive delete error:', error);
    return NextResponse.json({ message: 'Failed to bulk delete files.' }, { status: 500 });
  }
}
