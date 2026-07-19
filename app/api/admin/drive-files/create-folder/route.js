import { NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import driveService from '@/app/lib/googleDrive';
import { getCaseFolderIds } from '@/app/lib/driveDelete';

/**
 * POST /api/admin/drive-files/create-folder  (JSON)
 * Admin: create a new (empty) folder inside a destination Drive folder.
 * Body: { parentId: string|null, name: string }
 * Returns { ok, folder: { id, name } }.
 */
export async function POST(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parentId = body.parentId || null;
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ message: 'Folder name is required.' }, { status: 400 });
    }

    // Case folders are reserved for case content — don't nest new (non-case)
    // folders inside them.
    const caseFolderIds = await getCaseFolderIds();
    if (parentId && caseFolderIds.has(parentId)) {
      return NextResponse.json(
        { message: 'Cannot create a folder inside a case folder. Choose a different destination.' },
        { status: 403 }
      );
    }

    const folder = await driveService.createFolder(name, parentId);
    return NextResponse.json({ ok: true, folder: { id: folder.id, name: folder.name } });
  } catch (error) {
    console.error('Drive create folder error:', error);
    return NextResponse.json({ message: 'Failed to create folder.' }, { status: 500 });
  }
}
