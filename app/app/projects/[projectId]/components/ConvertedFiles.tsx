"use client";

import {
  Download, List, Grid2X2, Loader2, Trash2, RefreshCw,
  Search, X, Eye,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import type { ItemSettings, LocalConvertedFile } from "../_lib/ui-types";
import { Thumb } from "./Thumb";
import { FilePreviewModal } from "./FilePreviewModal";
import { useFilePreview } from "../hooks/useFilePreview";
import { canPreview, logPreviewHiddenReasonOnce } from "../_lib/preview";
import { Badge, Checkbox, MultiOutputBadge, StatusBadge } from "./converted/file-badges";
import { ReconvertPanel } from "./converted/reconvert-panel";
import { formatTime, SortButton, type SortBy } from "./converted/sort-controls";

type Props = {
  files: LocalConvertedFile[];
  projectId: string;
  onDeleteFile?: (fileId: string) => Promise<void> | void;
  onReconvert?: (sourceFileId: string, settings: ItemSettings) => void;
  globalSettings: ItemSettings;
  title?: string;
  emptyMessage?: string;
};

async function triggerDownload(projectId: string, fileId: string) {
  const res = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/download`
  );
  if (!res.ok) return;
  const data = (await res.json()) as { downloadUrl?: string };
  if (!data.downloadUrl) return;
  const a = document.createElement("a");
  a.href = data.downloadUrl;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ConvertedFiles({
  files,
  projectId,
  onDeleteFile,
  onReconvert,
  globalSettings,
  title = "Converted Files",
  emptyMessage = "No converted files yet.",
}: Props) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [expandedReconvert, setExpandedReconvert] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>({ field: "date", dir: "desc" });
  const preview = useFilePreview(projectId);

  const doneFiles = useMemo(() => files.filter((f) => f.status === "done"), [files]);

  const displayFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? files.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.fromLabel.toLowerCase().includes(q) ||
            f.toLabel.toLowerCase().includes(q)
        )
      : files;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy.field === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortBy.field === "size") {
        cmp = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
      } else {
        cmp = (a.whenLabel ?? "").localeCompare(b.whenLabel ?? "");
      }
      return sortBy.dir === "asc" ? cmp : -cmp;
    });
  }, [files, query, sortBy]);

  const previewEligibilityById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof canPreview>>();
    for (const f of displayFiles) {
      const eligibility = canPreview({
        fileId: f.id,
        filename: f.name,
        contentType: f.contentType,
        formatLabel: f.toLabel,
        status: f.status,
        previewUrl: f.previewUrl,
        hasLocalSource: false,
      });
      map.set(f.id, eligibility);
      if (!eligibility.canPreview) {
        logPreviewHiddenReasonOnce({
          section: "converted",
          fileId: f.id,
          reason: eligibility.reason,
          filename: f.name,
          formatLabel: f.toLabel,
          status: f.status,
        });
      }
    }
    return map;
  }, [displayFiles]);

  const allDisplaySelected =
    displayFiles.length > 0 && displayFiles.every((f) => selectedIds.has(f.id));
  const someSelected = selectedIds.size > 0;
  const selectedDoneIds = useMemo(
    () =>
      [...selectedIds].filter((id) => files.find((f) => f.id === id)?.status === "done"),
    [selectedIds, files]
  );

  useEffect(() => {
    const validIds = new Set(files.map((f) => f.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
    setExpandedReconvert((prev) => (prev && !validIds.has(prev) ? null : prev));
  }, [files]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllDisplay = useCallback(() => {
    setSelectedIds((prev) => {
      if (allDisplaySelected) {
        const next = new Set(prev);
        displayFiles.forEach((f) => next.delete(f.id));
        return next;
      }
      const next = new Set(prev);
      displayFiles.forEach((f) => next.add(f.id));
      return next;
    });
  }, [allDisplaySelected, displayFiles]);

  async function handleDownloadOne(fileId: string) {
    if (downloadingId === fileId) return;
    setDownloadingId(fileId);
    try {
      await triggerDownload(projectId, fileId);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadAll() {
    if (downloadingAll || doneFiles.length === 0) return;
    setDownloadingAll(true);
    try {
      for (const f of doneFiles) {
        await triggerDownload(projectId, f.id);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleBulkDownload() {
    if (bulkDownloading || selectedDoneIds.length === 0) return;
    setBulkDownloading(true);
    try {
      for (const id of selectedDoneIds) {
        await triggerDownload(projectId, id);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setBulkDownloading(false);
    }
  }

  async function handleBulkDelete() {
    if (!onDeleteFile || bulkDeleting || selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    try {
      for (const id of ids) {
        await onDeleteFile(id);
      }
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-semibold text-[var(--cf-text-1)] sm:text-xl">
          {title}
          {files.length > 0 && (
            <span className="ml-2 text-sm font-normal text-[var(--cf-text-3)]">({files.length})</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {someSelected && (
            <>
              <button
                type="button"
                onClick={() => void handleBulkDownload()}
                disabled={bulkDownloading || selectedDoneIds.length === 0}
                className="cf-btn cf-btn-secondary min-h-10 rounded-2xl px-3 py-2 text-xs"
              >
                {bulkDownloading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                Download ({selectedDoneIds.length})
              </button>
              {onDeleteFile && (
                <button
                  type="button"
                  onClick={() => void handleBulkDelete()}
                  disabled={bulkDeleting}
                  className="cf-btn cf-btn-danger min-h-10 rounded-2xl px-3 py-2 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />Delete ({selectedIds.size})
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => void handleDownloadAll()}
            disabled={downloadingAll || doneFiles.length === 0}
            className="cf-btn cf-btn-secondary min-h-10 rounded-2xl px-3 py-2 text-sm"
          >
            <Download className="h-4 w-4" />
            {downloadingAll ? "Downloading…" : "All"}
          </button>

          <div className="flex overflow-hidden rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-surface-muted)]">
            <button
              type="button"
              onClick={() => setView("list")}
              className={[
                "px-3 py-2 text-[var(--cf-text-2)] transition hover:bg-[var(--cf-input-bg-hover)] hover:text-[var(--cf-text-1)]",
                view === "list" ? "bg-[var(--cf-accent-muted)] text-[var(--cf-text-1)]" : "",
              ].join(" ")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={[
                "px-3 py-2 text-[var(--cf-text-2)] transition hover:bg-[var(--cf-input-bg-hover)] hover:text-[var(--cf-text-1)]",
                view === "grid" ? "bg-[var(--cf-accent-muted)] text-[var(--cf-text-1)]" : "",
              ].join(" ")}
              aria-label="Grid view"
            >
              <Grid2X2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search + Sort */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cf-text-3)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files…"
              className="cf-input w-full rounded-2xl py-2 pl-8 pr-8 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cf-text-3)] hover:text-[var(--cf-text-1)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[var(--cf-text-3)]">Sort:</span>
            <SortButton field="name" label="Name" current={sortBy} onChange={setSortBy} />
            <SortButton field="size" label="Size" current={sortBy} onChange={setSortBy} />
            <SortButton field="date" label="Date" current={sortBy} onChange={setSortBy} />
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <div className="cf-empty-state rounded-[28px] px-5 py-8 text-sm">
          {emptyMessage}
        </div>
      ) : displayFiles.length === 0 ? (
        <div className="cf-empty-state rounded-[28px] px-5 py-6 text-sm">
          No files match &ldquo;{query}&rdquo;.
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-1 py-1">
            <Checkbox checked={allDisplaySelected} onClick={toggleAllDisplay} label="Select all" />
            <span className="text-xs text-[var(--cf-text-3)]">
              {someSelected ? `${selectedIds.size} selected` : "Select files"}
            </span>
          </div>

          {displayFiles.map((f) => {
            const previewEligibility = previewEligibilityById.get(f.id) ?? { canPreview: false as const, reason: "missing_url" as const };
            return (
              <div
                key={f.id}
                className="cf-panel overflow-hidden rounded-[24px]"
              >
              <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
                <Checkbox
                  checked={selectedIds.has(f.id)}
                  onClick={() => toggleOne(f.id)}
                  label={`Select ${f.name}`}
                />
                <Thumb src={f.previewUrl} alt={f.name} fallbackLabel={f.toLabel} />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--cf-text-1)]">{f.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--cf-text-3)]">
                    {f.sizeLabel && <span>{f.sizeLabel}</span>}
                    {f.whenLabel && (
                      <>
                        <span className="text-[var(--cf-text-soft)]">•</span>
                        <span>{formatTime(f.whenLabel)}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 md:hidden">
                    <Badge>{f.fromLabel}</Badge>
                    <span className="text-[var(--cf-text-soft)]">→</span>
                    <Badge tone="active">{f.toLabel}</Badge>
                    <MultiOutputBadge file={f} />
                    <StatusBadge status={f.status} />
                  </div>
                </div>

                <div className="hidden items-center gap-2 md:flex">
                  <Badge>{f.fromLabel}</Badge>
                  <span className="text-[var(--cf-text-soft)]">→</span>
                  <Badge tone="active">{f.toLabel}</Badge>
                  <MultiOutputBadge file={f} />
                  <StatusBadge status={f.status} />
                </div>

                <div className="flex items-center gap-1">
                  {previewEligibility.canPreview && (
                    <button
                      type="button"
                      onClick={() =>
                        void preview.openPreview({
                          section: "converted",
                          fileId: f.id,
                          filename: f.name,
                          contentType: f.contentType,
                          formatLabel: f.toLabel,
                          status: f.status,
                          previewUrl: f.previewUrl,
                          hasLocalSource: false,
                        })
                      }
                      title="Preview"
                      className="cf-btn cf-btn-ghost h-9 w-9 rounded-xl px-0 text-[var(--cf-text-3)] hover:text-[var(--cf-text-1)]"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  {f.status === "done" && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadOne(f.id)}
                      disabled={downloadingId === f.id}
                      title="Download"
                      className="cf-btn cf-btn-ghost h-9 w-9 rounded-xl px-0 text-[var(--cf-text-3)] hover:text-[var(--cf-text-1)]"
                    >
                      {downloadingId === f.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />}
                    </button>
                  )}
                  {onReconvert && f.sourceFileId && (
                    <button
                      type="button"
                      onClick={() => setExpandedReconvert(expandedReconvert === f.id ? null : f.id)}
                      title="Reconvert"
                      className={[
                        "cf-btn h-9 w-9 rounded-xl px-0 transition",
                        expandedReconvert === f.id
                          ? "border-[var(--cf-accent-border)] bg-[var(--cf-accent-soft)] text-[var(--cf-accent)]"
                          : "text-[var(--cf-text-3)] hover:bg-[var(--cf-input-bg-hover)] hover:text-[var(--cf-text-1)]",
                      ].join(" ")}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  {onDeleteFile && (
                    <button
                      type="button"
                      onClick={() => void onDeleteFile(f.id)}
                      title="Remove"
                      className="cf-btn cf-btn-ghost h-9 w-9 rounded-xl px-0 text-[var(--cf-text-3)] hover:bg-[var(--cf-danger-soft)] hover:text-[var(--cf-danger-text)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {expandedReconvert === f.id && onReconvert && f.sourceFileId && (
                <ReconvertPanel
                  file={f}
                  globalSettings={globalSettings}
                  onReconvert={onReconvert}
                  onClose={() => setExpandedReconvert(null)}
                />
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-1 py-1">
            <Checkbox checked={allDisplaySelected} onClick={toggleAllDisplay} label="Select all" />
            <span className="text-xs text-[var(--cf-text-3)]">
              {someSelected ? `${selectedIds.size} selected` : "Select files"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayFiles.map((f) => {
              const previewEligibility = previewEligibilityById.get(f.id) ?? { canPreview: false as const, reason: "missing_url" as const };
              return (
                <div
                  key={f.id}
                  className={[
                    "cf-panel flex flex-col overflow-hidden rounded-[20px]",
                    selectedIds.has(f.id) ? "border-[var(--cf-accent-border)]" : "",
                  ].join(" ")}
                >
                <div className="relative aspect-square w-full bg-[var(--cf-surface-muted)]">
                  {/* Always-visible fallback text behind the image */}
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="text-lg font-bold tracking-wide text-[var(--cf-text-3)]/60">
                      {f.toLabel.toUpperCase()}
                    </span>
                  </div>
                  {f.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- signed preview URLs are generated at runtime.
                    <img
                      key={f.previewUrl}
                      src={f.previewUrl}
                      alt={f.name}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                  <div className="absolute bottom-2 right-2">
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="absolute left-2 top-2">
                    <Checkbox
                      checked={selectedIds.has(f.id)}
                      onClick={() => toggleOne(f.id)}
                      label={`Select ${f.name}`}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 px-3 py-2">
                  <div className="truncate text-xs font-semibold text-[var(--cf-text-1)]">{f.name}</div>
                  <div className="flex items-center gap-1.5">
                    <Badge>{f.fromLabel}</Badge>
                    <span className="text-xs text-[var(--cf-text-soft)]">→</span>
                    <Badge tone="active">{f.toLabel}</Badge>
                    <MultiOutputBadge file={f} />
                  </div>
                </div>

                <div className="flex border-t border-[var(--cf-divider)]">
                  {previewEligibility.canPreview && (
                    <button
                      type="button"
                      onClick={() =>
                        void preview.openPreview({
                          section: "converted",
                          fileId: f.id,
                          filename: f.name,
                          contentType: f.contentType,
                          formatLabel: f.toLabel,
                          status: f.status,
                          previewUrl: f.previewUrl,
                          hasLocalSource: false,
                        })
                      }
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-[var(--cf-text-2)] transition hover:bg-[var(--cf-input-bg-hover)] hover:text-[var(--cf-text-1)]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                  )}
                  {f.status === "done" && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadOne(f.id)}
                      disabled={downloadingId === f.id}
                      className={[
                        "flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--cf-text-2)] transition hover:bg-[var(--cf-input-bg-hover)] hover:text-[var(--cf-text-1)] disabled:opacity-40",
                        previewEligibility.canPreview ? "flex-1 border-l border-[var(--cf-divider)]" : "flex-1",
                      ].join(" ")}
                    >
                      {downloadingId === f.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                      Download
                    </button>
                  )}
                  {onReconvert && f.sourceFileId && (
                    <button
                      type="button"
                      onClick={() => setExpandedReconvert(expandedReconvert === f.id ? null : f.id)}
                      className="flex items-center justify-center gap-1.5 border-l border-[var(--cf-divider)] px-3 py-2 text-xs text-[var(--cf-text-3)] transition hover:bg-[var(--cf-accent-muted)] hover:text-[var(--cf-accent)]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onDeleteFile && (
                    <button
                      type="button"
                      onClick={() => void onDeleteFile(f.id)}
                      className="flex items-center justify-center gap-1.5 border-l border-[var(--cf-divider)] px-3 py-2 text-xs text-[var(--cf-text-3)] transition hover:bg-[var(--cf-danger-soft)] hover:text-[var(--cf-danger-text)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {expandedReconvert === f.id && onReconvert && f.sourceFileId && (
                  <ReconvertPanel
                    file={f}
                    globalSettings={globalSettings}
                    onReconvert={onReconvert}
                    onClose={() => setExpandedReconvert(null)}
                  />
                )}
              </div>
              );
            })}
          </div>
        </>
      )}

      <FilePreviewModal
        preview={preview.preview}
        onClose={preview.closePreview}
        onZoomIn={preview.zoomIn}
        onZoomOut={preview.zoomOut}
        onRetry={() => void preview.retryPreview()}
        onImageError={preview.onImageError}
      />
    </div>
  );
}
