import { NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import { getCaseRelatedIds, deleteDriveItemRecursive } from '@/app/lib/driveDelete';

/**
 * DELETE /api/admin/drive-files/[id]
 * Admin: permanently delete a single orphaned Drive file OR folder. When the
 * target is a folder, all of its (non-case) contents are deleted first —
 * recursively — just like a file explorer's delete. Case content is never
 * touched, even if it lives inside the folder being deleted.
 */
export async function DELETE(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'File id required' }, { status: 400 });
    }

    const caseRelatedIds = await getCaseRelatedIds();
    const result = await deleteDriveItemRecursive(id, caseRelatedIds);

    if (result.blocked) {
      return NextResponse.json(
        { message: 'This item (or something inside it) belongs to a case and cannot be deleted here.' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { message: result.error || 'Failed to delete item from Drive.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, missing: result.missing || false });
  } catch (error) {
    console.error('Drive file delete error:', error);
    return NextResponse.json({ message: 'Failed to delete file.' }, { status: 500 });
  }
}

