'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BsFolder2,
  BsFolderFill,
  BsChevronDown,
  BsChevronRight,
  BsTrash3,
  BsEye,
  BsSearch,
  BsCheckSquare,
  BsSquare,
  BsHouse,
  BsFileEarmark,
  BsArrowClockwise,
  BsLockFill,
  BsArrowDownUp,
  BsSortDown,
  BsUpload,
  BsCaretDownFill,
  BsFolderPlus,
  BsFolder,
  BsChevronLeft,
} from 'react-icons/bs';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import DashboardShell from '@/app/_components/admin/DashboardShell';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Button } from '@/app/_components/ui/button';
import { Input } from '@/app/_components/ui/input';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/_components/ui/dialog';
import Spinner from '@/app/_components/shared/Spinner';
import { cn } from '@/app/lib/utils';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function isFolder(item) {
  return item.mimeType === FOLDER_MIME;
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Build a tree from the flat orphaned-file list.
 *  - idSet: every returned Drive id (so we never link to a filtered-out parent).
 *  - childrenMap: parentId -> [child items] (only parents that exist in idSet).
 *  - roots: items whose parents are empty or not in the returned set.
 *  - nameById / parentById: quick lookups for breadcrumbs.
 */
function buildTree(files) {
  const idSet = new Set(files.map((f) => f.id));
  const childrenMap = new Map();
  const nameById = new Map();
  const parentById = new Map();

  for (const f of files) {
    nameById.set(f.id, f.name || '(unnamed)');
  }

  for (const f of files) {
    const inSetParents = (f.parents || []).filter((p) => idSet.has(p));
    if (inSetParents.length > 0) {
      parentById.set(f.id, inSetParents[0]);
      for (const p of inSetParents) {
        if (!childrenMap.has(p)) childrenMap.set(p, []);
        childrenMap.get(p).push(f);
      }
    }
  }

  const roots = files.filter((f) => {
    const inSetParents = (f.parents || []).filter((p) => idSet.has(p));
    return inSetParents.length === 0;
  });

  return { childrenMap, roots, nameById, parentById, idSet };
}

export default function AdminDriveFilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [query, setQuery] = useState('');
  // Read-only summary of the Doctor Portal root (shown disabled) + the
  // case-related byte total used by the space-usage pie chart.
  const [doctorPortal, setDoctorPortal] = useState(null);
  const [caseRelatedSize, setCaseRelatedSize] = useState(0);
  // Sort controls for the current-folder listing.
  const [sortKey, setSortKey] = useState('name'); // 'name' | 'size' | 'date'
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteOpen] = useState(false);
  const [lastBulkResult, setLastBulkResult] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('folder') || null
      : null
  );
  // Upload dropdown + active dialog state.
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(null); // null | 'file' | 'folder' | 'create'

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/drive-files', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load Drive files');
      const fileList = Array.isArray(json.files) ? json.files : [];
      setFiles(fileList);
      setDoctorPortal(json.doctorPortal || null);
      setCaseRelatedSize(Number(json.caseRelatedSize) || 0);
      setSelectedFileIds(new Set());
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load. `loading` already starts true, so the spinner shows before
  // this runs; fetchFiles only calls setState asynchronously (in callbacks).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiles();
  }, []);

  const { childrenMap, roots, nameById, parentById, idSet } = useMemo(
    () => buildTree(files),
    [files]
  );

  // All descendant ids of a folder (for select-all-in-folder feedback).
  const descendantIds = (folderId) => {
    const out = [];
    const walk = (id) => {
      const kids = childrenMap.get(id) || [];
      for (const k of kids) {
        out.push(k.id);
        if (isFolder(k)) walk(k.id);
      }
    };
    walk(folderId);
    return out;
  };

  // Breadcrumb path from a folder id up to its root.
  const breadcrumb = useMemo(() => {
    const trail = [];
    let cursor = currentFolderId;
    const guard = new Set();
    while (cursor && nameById.has(cursor) && !guard.has(cursor)) {
      guard.add(cursor);
      trail.unshift({ id: cursor, name: nameById.get(cursor) });
      cursor = parentById.get(cursor) || null;
    }
    return trail;
  }, [currentFolderId, nameById, parentById]);

  const navigateTo = (id) => {
    setCurrentFolderId(id);
    const path = window.location.pathname;
    const url = id ? `${path}?folder=${encodeURIComponent(id)}` : path;
    window.history.replaceState(null, '', url);
  };

  const visibleRootItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = currentFolderId ? childrenMap.get(currentFolderId) || [] : roots;
    const filtered = q
      ? list.filter((f) => (f.name || '').toLowerCase().includes(q))
      : list;

    const dir = sortDir === 'asc' ? 1 : -1;
    const nameCmp = (a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    const sizeCmp = (a, b) => (a.size || 0) - (b.size || 0);
    const dateCmp = (a, b) =>
      new Date(a.modifiedTime || 0).getTime() - new Date(b.modifiedTime || 0).getTime();

    // Folders are always grouped above files (file-explorer convention). Within
    // each group, sort by the chosen key. Name → alphabetical; Size/Date →
    // numeric/chronological (folders within the group still fall back to name).
    return [...filtered].sort((a, b) => {
      const af = isFolder(a) ? 0 : 1;
      const bf = isFolder(b) ? 0 : 1;
      if (af !== bf) return af - bf;
      let cmp;
      if (sortKey === 'size') cmp = sizeCmp(a, b);
      else if (sortKey === 'date') cmp = dateCmp(a, b);
      else cmp = nameCmp(a, b);
      if (cmp === 0) cmp = nameCmp(a, b);
      return cmp * dir;
    });
  }, [currentFolderId, childrenMap, roots, query, sortKey, sortDir]);

  const isSelected = (id) => selectedFileIds.has(id);

  const toggleSelection = (id, item) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Also drop descendants so the count stays honest.
        if (item && isFolder(item)) descendantIds(id).forEach((d) => next.delete(d));
      } else {
        next.add(id);
        if (item && isFolder(item)) descendantIds(id).forEach((d) => next.add(d));
      }
      return next;
    });
  };

  const handleDelete = async (item) => {
    const label = item.name || 'this item';
    const kind = isFolder(item) ? 'folder' : 'file';
    if (
      !confirm(
        `Delete "${label}"?${isFolder(item) ? ' Its entire non-case contents will be removed too.' : ''} This permanently removes it from Google Drive and cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(item.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/drive-files/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to delete ${kind}`);
      if (data.missing) {
        // Already gone — just refresh.
      }
      await fetchFiles();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const selectedCount = selectedFileIds.size;

  const executeBulkDelete = async () => {
    const ids = [...selectedFileIds];
    if (ids.length === 0) return;

    setBulkDeleting(true);
    setBulkDeleteOpen(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/drive-files/bulk', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bulk delete failed');

      setLastBulkResult({
        success: data.success?.length || 0,
        failed: data.failed?.length || 0,
        blocked: data.blocked?.length || 0,
      });
      await fetchFiles();
      setSelectedFileIds(new Set());
    } catch (err) {
      alert(`Bulk delete failed: ${err.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + (f.size || 0), 0),
    [files]
  );

  // Recursive folder accordion.
  const renderItem = (item, depth) => {
    if (isFolder(item)) {
      return (
        <FolderNode
          key={item.id}
          folder={item}
          depth={depth}
          childrenMap={childrenMap}
          nameById={nameById}
          parentById={parentById}
          selectedFileIds={selectedFileIds}
          toggleSelection={toggleSelection}
          onNavigate={navigateTo}
          onDelete={handleDelete}
          deletingId={deletingId}
          bulkDeleting={bulkDeleting}
          renderItem={renderItem}
        />
      );
    }
    return (
      <FileRow
        key={item.id}
        file={item}
        depth={depth}
        selected={isSelected(item.id)}
        onToggle={() => toggleSelection(item.id, item)}
        onDelete={() => handleDelete(item)}
        deleting={deletingId === item.id}
        bulkDeleting={bulkDeleting}
      />
    );
  };

  return (
    <DashboardShell>
      <div className="mb-4">
        <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <BsFolder2 /> Drive Manager
        </h4>
        <p className="mb-0 text-sm text-muted-foreground">
          Browse orphaned Google Drive files and folders (those not attached to any case). Open a
          folder to explore its contents, select items, and permanently delete them. Deleting a
          folder removes its inner contents too.
        </p>
      </div>

      {/* Summary: Doctor Portal (disabled, size only) + space-usage pie chart */}
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        {doctorPortal && (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
                <BsLockFill className="size-6 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {doctorPortal.name}
                </p>
                <p className="text-xs text-muted-foreground">Doctor Portal — locked</p>
                <p className="mt-1 text-lg font-semibold">{formatBytes(doctorPortal.size)}</p>
                <p className="text-xs text-muted-foreground">
                  Total size (folder + all files inside)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="mb-1 text-sm font-medium text-foreground">Drive space usage</p>
            <SpacePieChart caseRelatedSize={caseRelatedSize} orphanSize={totalSize} />
          </CardContent>
        </Card>
      </div>

      {/* Breadcrumb / address bar — reflects ?folder=<id> deep-link */}
      <div className="mb-3 flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <button
          type="button"
          onClick={() => navigateTo(null)}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5',
            !currentFolderId
              ? 'font-semibold text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <BsHouse /> Drive
        </button>
        {breadcrumb.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <BsChevronRight className="size-3 text-muted-foreground" />
            <button
              type="button"
              onClick={() => navigateTo(c.id)}
              className={cn(
                'rounded px-1.5 py-0.5',
                c.id === currentFolderId
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      {/* Bulk action toolbar */}
      {selectedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedFileIds(new Set())}
              disabled={bulkDeleting}
            >
              Clear selection
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1"
              disabled={bulkDeleting}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <BsTrash3 />
              {bulkDeleting ? 'Deleting…' : `Delete ${selectedCount}`}
            </Button>
          </div>
        </div>
      )}

      {/* Search + sort + refresh */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {/* Upload dropdown: file / folder / create-folder */}
        <div className="relative">
          <label className="mb-1 block text-sm text-muted-foreground">
            Add to Drive
          </label>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1"
            onClick={() => setUploadMenuOpen((o) => !o)}
          >
            <BsUpload />
            Upload
            <BsCaretDownFill className="size-3" />
          </Button>
          {uploadMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUploadMenuOpen(false)}
              />
              <div className="absolute left-0 z-50 mt-1 w-52 overflow-hidden rounded-md border bg-background shadow-lg">
                {[
                  { mode: 'file', label: 'Upload files', icon: BsUpload },
                  { mode: 'folder', label: 'Upload folder', icon: BsFolder },
                  { mode: 'create', label: 'Create folder', icon: BsFolderPlus },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setUploadMenuOpen(false);
                        setUploadDialog(opt.mode);
                      }}
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="min-w-[220px] flex-grow">
          <label className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
            <BsSearch /> Search in current folder
          </label>
          <Input
            className="h-8"
            placeholder="Filter by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
              <BsSortDown /> Sort by
            </label>
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="date">Date</option>
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            <BsArrowDownUp />
            {sortDir === 'asc' ? 'Asc' : 'Desc'}
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => {
            setLoading(true);
            fetchFiles();
          }}
          disabled={loading}
        >
          <BsArrowClockwise className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {errorMsg ? (
        <Alert variant="destructive" className="mb-0">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="size-8" />
        </div>
      ) : files.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">
            No orphaned files — every Drive file belongs to a case.
          </CardContent>
        </Card>
      ) : visibleRootItems.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">
            {currentFolderId
              ? 'This folder is empty (or no items match your search).'
              : 'No files to show here.'}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5 text-sm text-muted-foreground">
              <span>
                {visibleRootItems.length} item{visibleRootItems.length !== 1 ? 's' : ''} in this
                folder
              </span>
              <span>Total orphaned: {formatBytes(totalSize)}</span>
            </div>
            <div className="divide-y">
              {visibleRootItems.map((item) => renderItem(item, 0))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedCount} item{selectedCount !== 1 ? 's' : ''}?
            </DialogTitle>
            <DialogDescription>
              You are about to permanently delete {selectedCount} selected item
              {selectedCount !== 1 ? 's' : ''} from Google Drive. Folders will have their inner
              non-case contents removed too. This cannot be undone. Case‑related files are protected
              and will be skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result toast */}
      {lastBulkResult && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md border bg-background p-4 shadow-lg">
          <div className="space-y-1 text-sm">
            <p className="font-medium text-green-600">
              ✓ Deleted {lastBulkResult.success} item{lastBulkResult.success !== 1 ? 's' : ''}
            </p>
            {lastBulkResult.failed > 0 && (
              <p className="font-medium text-destructive">
                ✗ Failed {lastBulkResult.failed} item{lastBulkResult.failed !== 1 ? 's' : ''}
              </p>
            )}
            {lastBulkResult.blocked > 0 && (
              <p className="font-medium text-amber-600">
                ⚠ Skipped {lastBulkResult.blocked} case‑protected item
                {lastBulkResult.blocked !== 1 ? 's' : ''}
              </p>
            )}
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setLastBulkResult(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Upload / create-folder destination picker (remounts per open) */}
      {uploadDialog && (
        <DriveUploadDialog
          key={uploadDialog}
          mode={uploadDialog}
          roots={roots}
          childrenMap={childrenMap}
          nameById={nameById}
          parentById={parentById}
          initialFolderId={currentFolderId}
          onClose={() => setUploadDialog(null)}
          onComplete={() => {
            setUploadDialog(null);
            fetchFiles();
          }}
        />
      )}
    </DashboardShell>
  );
}

function FolderNode({
  folder,
  depth,
  childrenMap,
  nameById,
  parentById,
  selectedFileIds,
  toggleSelection,
  onNavigate,
  onDelete,
  deletingId,
  bulkDeleting,
  renderItem,
}) {
  const [open, setOpen] = useState(false);
  const children = useMemo(() => childrenMap.get(folder.id) || [], [childrenMap, folder.id]);
  const selected = selectedFileIds.has(folder.id);

  const sortedChildren = useMemo(() => {
    return [...children].sort((a, b) => {
      const af = isFolder(a) ? 0 : 1;
      const bf = isFolder(b) ? 0 : 1;
      if (af !== bf) return af - bf;
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [children]);

  return (
    <div className={cn('border-l-2 border-transparent', selected && 'border-primary/40')}>
      <div
        className={cn(
          'group flex items-center gap-2 px-3 py-2.5',
          selected && 'bg-primary/5'
        )}
        style={{ paddingLeft: `${12 + depth * 18}px` }}
      >
        {/* Expand / collapse */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          title={open ? 'Collapse' : 'Expand'}
        >
          {open ? <BsChevronDown className="size-3.5" /> : <BsChevronRight className="size-3.5" />}
        </button>

        {/* Selection checkbox */}
        <button
          type="button"
          onClick={() => toggleSelection(folder.id, folder)}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
          title={selected ? 'Deselect folder' : 'Select folder (and its contents)'}
        >
          {selected ? (
            <BsCheckSquare className="size-4 text-primary" />
          ) : (
            <BsSquare className="size-4 text-muted-foreground" />
          )}
        </button>

        {/* Icon */}
        <BsFolderFill className="size-5 shrink-0 text-amber-500" />

        {/* Name — navigates into the folder */}
        <button
          type="button"
          onClick={() => onNavigate(folder.id)}
          className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
          title="Open folder"
        >
          {folder.name}
        </button>

        {/* Meta */}
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {children.length} item{children.length !== 1 ? 's' : ''}
        </span>
        <span className="hidden w-40 shrink-0 text-right text-xs text-muted-foreground md:inline">
          {formatDate(folder.modifiedTime)}
        </span>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(folder)}
          disabled={deletingId === folder.id || bulkDeleting}
          className="flex size-7 shrink-0 items-center justify-center rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
          title="Delete folder and its contents"
        >
          {deletingId === folder.id ? (
            <Spinner className="size-3.5 border-current" />
          ) : (
            <BsTrash3 className="size-3.5" />
          )}
        </button>
      </div>

      {/* Accordion content: nested folders / files */}
      {open && (
        <div className="bg-muted/20 py-1">
          {sortedChildren.length === 0 ? (
            <div
              className="py-2 text-xs text-muted-foreground"
              style={{ paddingLeft: `${12 + (depth + 1) * 18 + 28}px` }}
            >
              (empty)
            </div>
          ) : (
            sortedChildren.map((child) => renderItem(child, depth + 1))
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({ file, depth, selected, onToggle, onDelete, deleting, bulkDeleting }) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2.5',
        selected && 'bg-primary/5'
      )}
      style={{ paddingLeft: `${12 + depth * 18 + 28}px` }}
    >
      {/* Spacer where the chevron would be (files can't expand) */}
      <span className="size-5 shrink-0" />

      {/* Selection checkbox */}
      <button
        type="button"
        onClick={onToggle}
        className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
        title={selected ? 'Deselect file' : 'Select file'}
      >
        {selected ? (
          <BsCheckSquare className="size-4 text-primary" />
        ) : (
          <BsSquare className="size-4 text-muted-foreground" />
        )}
      </button>

      {/* Icon */}
      {file.iconLink ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.iconLink} alt="" className="size-5 shrink-0 rounded-sm" />
      ) : (
        <BsFileEarmark className="size-5 shrink-0 text-muted-foreground" />
      )}

      {/* Name */}
      <div className="min-w-0 flex-1 truncate font-medium">
        {file.webViewLink ? (
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline hover:underline"
          >
            {file.name}
          </a>
        ) : (
          file.name
        )}
      </div>

      <span className="hidden w-24 shrink-0 text-right text-sm text-muted-foreground sm:inline">
        {formatBytes(file.size)}
      </span>
      <span className="hidden w-40 shrink-0 text-right text-xs text-muted-foreground md:inline">
        {formatDate(file.modifiedTime)}
      </span>

      {file.webViewLink && (
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex size-7 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"
          title="View in Drive"
        >
          <BsEye className="size-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting || bulkDeleting}
        className="flex size-7 shrink-0 items-center justify-center rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
        title="Delete file"
      >
        {deleting ? <Spinner className="size-3.5 border-current" /> : <BsTrash3 className="size-3.5" />}
      </button>
    </div>
  );
}

const PIE_CASE = '#1baf7a'; // case-related content (protected)
const PIE_ORPHAN = '#e0a106'; // orphaned / irrelevant
const PIE_INK = '#52514e';

function PieTooltip({ active, payload, total }) {
  if (!active || !payload || payload.length === 0) return null;
  const { name, value, color } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
        <span className="font-medium text-foreground">{name}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        {formatBytes(value)} <span className="text-xs">({pct}%)</span>
      </div>
    </div>
  );
}

function SpacePieChart({ caseRelatedSize, orphanSize }) {
  const total = caseRelatedSize + orphanSize;
  if (total <= 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No Drive data to chart.
      </div>
    );
  }
  const data = [
    { name: 'Case-related files', value: caseRelatedSize, color: PIE_CASE },
    { name: 'Orphaned / irrelevant', value: orphanSize, color: PIE_ORPHAN },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={82}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <RechartsTooltip content={<PieTooltip total={total} />} />
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: PIE_INK }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

const UPLOAD_MODES = {
  file: { title: 'Upload files', verb: 'Upload files', Icon: BsUpload },
  folder: { title: 'Upload folder', verb: 'Upload folder', Icon: BsFolder },
  create: { title: 'Create folder', verb: 'Create folder', Icon: BsFolderPlus },
};

/**
 * Modal that lets the admin pick a Drive destination and then upload files,
 * upload a whole folder (preserving structure), or create an empty folder.
 *
 * The root is now "My Drive" (actual Google Drive root), and "Doctor Portal Cases"
 * is completely hidden from this interface. Admins can freely create/upload to
 * any location in My Drive, while case-related files remain protected in the
 * "Doctor Portal Cases" folder (managed separately via case submission).
 */
function DriveUploadDialog({
  mode,
  roots,
  childrenMap,
  nameById,
  parentById,
  initialFolderId,
  onClose,
  onComplete,
}) {
  // Mounted fresh each time it opens (parent keyed mount), so initial state
  // comes straight from props — no reset effect needed.
  const [pickerFolderId, setPickerFolderId] = useState(initialFolderId || null);
  const [name, setName] = useState('');
  const [fileList, setFileList] = useState([]); // [{ file, relativePath }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = true;
  const meta = mode ? UPLOAD_MODES[mode] : null;
  const rootLabel = 'My Drive';

  const isRoot = !pickerFolderId;

  // Only folders, alphabetical — mirrors the accordion's folder listing.
  const folderChildren = useMemo(() => {
    const currentChildren = isRoot ? roots || [] : childrenMap.get(pickerFolderId) || [];
    return [...currentChildren]
      .filter((f) => isFolder(f))
      .sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
  }, [isRoot, roots, childrenMap, pickerFolderId]);

  // Breadcrumb: My Drive -> ... -> current folder.
  const breadcrumb = useMemo(() => {
    const trail = [];
    let cursor = pickerFolderId;
    const guard = new Set();
    while (cursor && nameById.has(cursor) && !guard.has(cursor)) {
      guard.add(cursor);
      trail.unshift({ id: cursor, name: nameById.get(cursor) });
      cursor = parentById.get(cursor) || null;
    }
    return trail;
  }, [pickerFolderId, nameById, parentById]);

  const currentName = isRoot ? rootLabel : nameById.get(pickerFolderId) || 'Folder';
  const canGoUp = !isRoot;

  const goUp = () => {
    if (isRoot) return;
    setPickerFolderId(parentById.get(pickerFolderId) || null);
  };

  // The real destination folder id. At root level, use 'root' for Google Drive root.
  const destinationId = pickerFolderId || 'root';
  const canSubmit =
    !busy &&
    !!destinationId &&
    (mode === 'create' ? name.trim().length > 0 : fileList.length > 0);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const mapped = files.map((f) => ({
      file: f,
      relativePath: f.webkitRelativePath || f.name,
    }));
    setFileList(mapped);
    setError('');
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (mode === 'create') {
        const res = await fetch('/api/admin/drive-files/create-folder', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ parentId: destinationId, name: name.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create folder');
      } else {
        const fd = new FormData();
        fd.append('parentId', destinationId);
        fd.append('paths', JSON.stringify(fileList.map((x) => x.relativePath)));
        for (const x of fileList) fd.append('files', x.file);
        const res = await fetch('/api/admin/drive-files/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');
      }
      onComplete();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {meta && <meta.Icon className="size-5" />}
            {meta ? meta.title : ''}
          </DialogTitle>
          <DialogDescription>
            Choose a destination in your Drive, then{' '}
            {mode === 'create'
              ? 'name the new folder'
              : mode === 'folder'
                ? 'pick a folder to upload'
                : 'pick files to upload'}
            .
          </DialogDescription>
        </DialogHeader>

        {/* Destination path navigator */}
        <div className="rounded-md border">
          {/* Address bar / breadcrumb */}
          <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-3 py-2 text-sm">
            <BsHouse className="size-3.5 text-muted-foreground" />
            <button
              type="button"
              onClick={() => setPickerFolderId(null)}
              className={cn(
                'rounded px-1 py-0.5',
                isRoot
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {rootLabel}
            </button>
            {breadcrumb.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <BsChevronRight className="size-3 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setPickerFolderId(c.id)}
                  className={cn(
                    'rounded px-1 py-0.5',
                    c.id === pickerFolderId
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {c.name}
                </button>
              </span>
            ))}
          </div>

          {/* Folder listing — "../" to go up, then the subfolders */}
          <div className="max-h-64 overflow-y-auto p-1">
            {canGoUp && (
              <button
                type="button"
                onClick={goUp}
                className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                <BsChevronLeft className="size-4 shrink-0" />
                <span className="flex-1 truncate font-medium">../</span>
              </button>
            )}
            {folderChildren.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                No subfolders here.
              </div>
            ) : (
              folderChildren.map((f) => {
                const childCount = (childrenMap.get(f.id) || []).length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPickerFolderId(f.id)}
                    className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-sm hover:bg-muted"
                  >
                    <BsFolderFill className="size-5 shrink-0 text-amber-500" />
                    <span className="flex-1 truncate font-medium">{f.name}</span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {childCount} item{childCount !== 1 ? 's' : ''}
                    </span>
                    <BsChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Destination:{' '}
          <span className="font-medium text-foreground">
            {isRoot ? rootLabel : currentName}
          </span>
        </p>

        {/* Mode-specific input */}
        {mode === 'create' ? (
          <Input
            autoFocus
            placeholder="New folder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        ) : mode === 'folder' ? (
          <div>
            <input
              type="file"
              multiple
              webkitdirectory=""
              directory=""
              mozdirectory=""
              onChange={handleFiles}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-primary file:hover:bg-primary/20"
            />
            {fileList.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {fileList.length} file{fileList.length !== 1 ? 's' : ''} selected from{' '}
                <span className="font-medium">
                  {fileList[0].relativePath.split('/')[0]}
                </span>
                .
              </p>
            )}
          </div>
        ) : mode === 'file' ? (
          <div>
            <input
              type="file"
              multiple
              onChange={handleFiles}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-primary file:hover:bg-primary/20"
            />
            {fileList.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p>
                  {fileList.length} file{fileList.length !== 1 ? 's' : ''} selected
                </p>
                <div className="mt-1 max-h-24 overflow-y-auto">
                  {fileList.map((f, i) => (
                    <p key={i} className="truncate">
                      {f.file.name}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy ? (
              <Spinner className="size-3.5 border-current" />
            ) : (
              meta && <meta.Icon className="size-4" />
            )}
            {meta ? meta.verb : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}