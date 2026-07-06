'use client';

import { useEffect, useState } from 'react';
import { BsFileEarmark, BsBoxArrowUpRight, BsXLg } from 'react-icons/bs';
import { Button } from '@/app/_components/ui/button';

const isImage = (mimeType) => typeof mimeType === 'string' && mimeType.startsWith('image/');

// Files are uploaded with "anyone with the link can view" sharing, so
// Drive's public thumbnail endpoint can render them directly as <img>.
const thumbUrl = (id, size) => `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;

/**
 * Renders a list of Google Drive file records as a preview grid: image
 * files show as clickable thumbnails that open a full-size lightbox,
 * everything else (PDFs, STL scans, etc.) falls back to a link row.
 */
export default function FileGrid({ files, emptyLabel }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  if (!files || files.length === 0) {
    return <p className="mb-0 text-sm italic text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {files.map((f) =>
          isImage(f.mimeType) ? (
            <button
              key={f.id}
              type="button"
              className="h-24 w-24 cursor-zoom-in overflow-hidden rounded-md border bg-muted p-0"
              onClick={() => setPreview(f)}
              title={f.name}
            >
              <img src={thumbUrl(f.id, 300)} alt={f.name} loading="lazy" className="block h-full w-full object-cover" />
            </button>
          ) : (
            <a
              key={f.id}
              href={f.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-[200px] items-center gap-2 rounded-md border bg-muted p-2 text-foreground no-underline"
            >
              <BsFileEarmark className="text-primary" />
              <span className="flex-1 truncate text-sm">{f.name}</span>
              <BsBoxArrowUpRight className="text-sm text-muted-foreground" />
            </a>
          )
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85"
          onClick={() => setPreview(null)}
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute top-5 right-5 gap-1"
            onClick={() => setPreview(null)}
          >
            <BsXLg /> Close
          </Button>
          <img
            src={thumbUrl(preview.id, 1600)}
            alt={preview.name}
            className="max-h-[80vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-3 flex items-center gap-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <span>{preview.name}</span>
            <a href={preview.webViewLink} target="_blank" rel="noopener noreferrer" className="text-white underline">
              Open original <BsBoxArrowUpRight className="inline" />
            </a>
          </div>
        </div>
      )}
    </>
  );
}
