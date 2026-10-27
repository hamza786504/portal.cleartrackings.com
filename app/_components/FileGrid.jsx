'use client';

import { useEffect, useMemo, useState } from 'react';
import { BsFileEarmark, BsBoxArrowUpRight, BsXLg, BsChevronLeft, BsChevronRight } from 'react-icons/bs';
import { Button } from '@/app/_components/ui/button';

const isImage = (mimeType) => typeof mimeType === 'string' && mimeType.startsWith('image/');

// Images are streamed through our own server (/api/files/[id]/preview)
// rather than Drive's public thumbnail endpoint, which Google intermittently
// answers with 503 in the browser. A failed load is retried a couple of times
// before falling back to a placeholder.
const previewUrl = (id) => `/api/files/${encodeURIComponent(id)}/preview`;
const RETRY_DELAYS_MS = [2000, 5000];

function DriveThumb({ file, className, onClick }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (attempt >= RETRY_DELAYS_MS.length) {
      setFailed(true);
      return;
    }
    setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAYS_MS[attempt]);
  };

  if (failed) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center text-xs text-muted-foreground">
        <BsFileEarmark className="text-lg text-primary" />
        Preview unavailable
      </span>
    );
  }

  const src = attempt === 0 ? previewUrl(file.id) : `${previewUrl(file.id)}?r=${attempt}`;
  return <img src={src} alt={file.name} loading="lazy" className={className} onError={handleError} onClick={onClick} />;
}

/**
 * Renders a list of Google Drive file records as a preview grid: image
 * files show as clickable thumbnails that open a full-size lightbox with
 * prev/next navigation (on-screen arrows + Left/Right keyboard keys),
 * everything else (PDFs, STL scans, etc.) falls back to a link row.
 */
export default function FileGrid({ files, emptyLabel }) {
  // Only images are previewable, so navigation moves between image files.
  const imageFiles = useMemo(
    () => (files || []).filter((f) => isImage(f.mimeType)),
    [files]
  );

  // Index into `imageFiles`; -1 means the lightbox is closed.
  const [previewIndex, setPreviewIndex] = useState(-1);

  const preview = previewIndex >= 0 && previewIndex < imageFiles.length ? imageFiles[previewIndex] : null;
  const imageCount = imageFiles.length;
  const hasMultiple = imageCount > 1;

  const openPreview = (fileId) => {
    const idx = imageFiles.findIndex((f) => f.id === fileId);
    if (idx >= 0) setPreviewIndex(idx);
  };
  const closePreview = () => setPreviewIndex(-1);
  const showPrev = () => setPreviewIndex((i) => (i <= 0 ? imageCount - 1 : i - 1));
  const showNext = () => setPreviewIndex((i) => (i >= imageCount - 1 ? 0 : i + 1));

  useEffect(() => {
    if (previewIndex < 0) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closePreview();
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // `imageCount` is captured so the wrapper math stays correct; index
    // changes are handled via functional updates inside the handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewIndex < 0, imageCount]);

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
              onClick={() => openPreview(f.id)}
              title={f.name}
            >
              <DriveThumb file={f} className="block h-full w-full object-cover" />
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
          onClick={closePreview}
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute top-5 right-5 gap-1"
            onClick={closePreview}
          >
            <BsXLg /> Close
          </Button>

          {hasMultiple && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2"
              onClick={(e) => {
                e.stopPropagation();
                showPrev();
              }}
              aria-label="Previous image (Left arrow)"
            >
              <BsChevronLeft />
            </Button>
          )}

          {hasMultiple && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2"
              onClick={(e) => {
                e.stopPropagation();
                showNext();
              }}
              aria-label="Next image (Right arrow)"
            >
              <BsChevronRight />
            </Button>
          )}

          <DriveThumb
            key={preview.id}
            file={preview}
            className="max-h-[80vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div
            className="mt-3 flex items-center gap-3 text-sm text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{preview.name}</span>
            {hasMultiple && (
              <span className="text-white/60">
                {previewIndex + 1} / {imageCount}
              </span>
            )}
            <a href={preview.webViewLink} target="_blank" rel="noopener noreferrer" className="text-white underline">
              Open original <BsBoxArrowUpRight className="inline" />
            </a>
          </div>
        </div>
      )}
    </>
  );
}
