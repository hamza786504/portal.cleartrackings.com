import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import driveService from '@/app/lib/googleDrive';

// Drive ids are URL-safe base64-ish strings; reject anything else up front.
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

/**
 * GET /api/files/[id]/preview
 * Streams an image file from Google Drive through our server so previews
 * don't depend on Drive's public thumbnail endpoint, which Google
 * intermittently answers with 503 in the browser.
 *
 * No auth header here because <img> tags can't send one. That exposes
 * nothing new: every uploaded file is already shared "anyone with the link",
 * and only image files are served.
 */
export async function GET(req, { params }) {
  const { id } = await params;
  if (!DRIVE_ID_RE.test(id)) {
    return NextResponse.json({ message: 'Invalid file id' }, { status: 400 });
  }

  try {
    const file = await driveService.getFileStream(id);
    // SVG is excluded: served from our origin it could run script.
    const mimeType = file?.meta.mimeType || '';
    if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml') {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const headers = {
      'Content-Type': file.meta.mimeType,
      // A Drive file id always points to the same bytes, so cache hard.
      'Cache-Control': 'public, max-age=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
    };
    if (file.meta.size) headers['Content-Length'] = String(file.meta.size);

    return new Response(Readable.toWeb(file.stream), { headers });
  } catch (error) {
    console.error(`File preview failed for ${id}:`, error?.message || error);
    return NextResponse.json({ message: 'Failed to load file' }, { status: 502 });
  }
}
