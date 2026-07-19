import { NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import driveService from '@/app/lib/googleDrive';
import { getCaseFolderIds } from '@/app/lib/driveDelete';

/**
 * POST /api/admin/drive-files/upload  (multipart/form-data)
 * Admin: upload one or more files into a Drive folder.
 *
 * Fields:
 *   parentId - destination folder id (null/empty = Drive root).
 *   paths    - JSON array, parallel to `files`, giving each file's relative
 *              path. For a single-file upload this is just the file name
 *              (e.g. "scan.pdf"); for a folder upload the browser supplies
 *              "ChosenFolder/sub/deep/file.png" via webkitdirectory, so the
 *              folder structure is recreated under parentId.
 *   files    - the File objects.
 *
 * Folders named in `paths` are created on demand (cached per upload so a
 * folder isn't recreated for each of its files) and each file lands in the
 * matching Drive folder.
 */
export async function POST(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const form = await req.formData();
    const parentId = form.get('parentId') || null;
    const pathsRaw = form.get('paths');
    const relativePaths = pathsRaw ? JSON.parse(pathsRaw) : [];
    const files = form.getAll('files');

    if (!files.length) {
      return NextResponse.json({ message: 'No files provided.' }, { status: 400 });
    }

    // Case folders are reserved for case content — never write non-case files
    // into them (that would misclassify them as case-related and protect them
    // from cleanup). The "Doctor Portal Cases" root itself is allowed.
    const caseFolderIds = await getCaseFolderIds();
    if (parentId && caseFolderIds.has(parentId)) {
      return NextResponse.json(
        { message: 'Cannot upload into a case folder. Choose a different destination.' },
        { status: 403 }
      );
    }

    // Cache created folder ids by their joined relative directory so we don't
    // recreate "ChosenFolder" for every file inside it.
    const dirCache = new Map();
    const getDirId = async (parts) => {
      if (parts.length === 0) return parentId;
      const key = parts.join('/');
      if (dirCache.has(key)) return dirCache.get(key);
      const parent = await getDirId(parts.slice(0, -1));
      const created = await driveService.createFolder(parts[parts.length - 1], parent);
      dirCache.set(key, created.id);
      return created.id;
    };

    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rel = relativePaths[i] || file.name || `file-${i}`;
      const segs = String(rel).split('/').filter(Boolean);
      const dirParts = segs.slice(0, -1); // drop the file name
      const targetDir = await getDirId(dirParts);

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await driveService.uploadFile(
        {
          originalname: segs[segs.length - 1],
          mimetype: file.type || 'application/octet-stream',
          buffer,
        },
        targetDir
      );
      uploaded.push(result);
    }

    return NextResponse.json({ ok: true, count: uploaded.length, files: uploaded });
  } catch (error) {
    console.error('Drive upload error:', error);
    return NextResponse.json({ message: 'Upload failed.' }, { status: 500 });
  }
}
