"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileRow } from "../../_lib/types";
import { deleteFile as apiDeleteFile, listFiles } from "../_lib/api-client";
import { normalizeStatus } from "../_lib/format";

const MAX_CONVERT_BATCH = 25;
const POLL_MIN_DELAY_MS = 2000;
const POLL_MAX_DELAY_MS = 10000;

type FileKind = "raw" | "output";

function readKind(f: FileRow): FileKind {
  return f.kind === "output" ? "output" : "raw";
}

function pruneSelection(prev: Record<string, boolean>, validIds: Set<string>) {
  let changed = false;
  const next: Record<string, boolean> = {};

  for (const [k, v] of Object.entries(prev)) {
    if (validIds.has(k)) next[k] = v;
    else changed = true;
  }

  return changed ? next : prev;
}

type ApplyUpdater = FileRow[] | ((prev: FileRow[]) => FileRow[]);

function dedupeByFileId(items: FileRow[]): { files: FileRow[]; duplicateIds: string[] } {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const deduped: FileRow[] = [];

  for (const item of items) {
    const id = item.fileId;
    if (!id) continue;
    if (seen.has(id)) {
      duplicateIds.push(id);
      continue;
    }
    seen.add(id);
    deduped.push(item);
  }

  return { files: deduped, duplicateIds };
}

export function useServerFiles(args: {
  projectId: string;
  initialFiles: FileRow[];
  onError: (msg: string | null) => void;
}) {
  const { projectId, initialFiles, onError } = args;

  const [files, setFiles] = useState<FileRow[]>(initialFiles);
  const [selectedReady, setSelectedReady] = useState<Record<string, boolean>>({});
  const pollDelayRef = useRef<number>(POLL_MIN_DELAY_MS);

  // dropSignedUrl is injected later (after useSignedUrls exists)
  const dropSignedUrlRef = useRef<(fileId: string) => void>(() => {});
  const setDropSignedUrl = useCallback((fn: (fileId: string) => void) => {
    dropSignedUrlRef.current = fn;
  }, []);

  const applyFiles = useCallback((updater: ApplyUpdater) => {
    setFiles((prev) => {
      const nextRaw = typeof updater === "function" ? updater(prev) : updater;
      const { files: next, duplicateIds } = dedupeByFileId(nextRaw);
      if (duplicateIds.length > 0) {
        console.error("duplicate_file_ids_detected", {
          duplicateCount: duplicateIds.length,
          duplicateIds: duplicateIds.slice(0, 20),
        });
        onError("Detected duplicate file IDs from server response. Showing a safe deduplicated list.");
      }
      const valid = new Set(next.map((f) => f.fileId));
      setSelectedReady((selPrev) => pruneSelection(selPrev, valid));
      return next;
    });
  }, [onError]);

  /**
   * Default validate=true so we reconcile missing S3 objects automatically.
   */
  const refreshFiles = useCallback(
    async (opts?: { validate?: boolean }) => {
      const validate = opts?.validate ?? true;
      const next = await listFiles(projectId, { validate });
      applyFiles(next);
    },
    [projectId, applyFiles]
  );

  // Ready = kind=raw and not done
  const rawReadyFiles = useMemo(
    () => files.filter((f) => readKind(f) === "raw" && normalizeStatus(f.status) !== "done"),
    [files]
  );

  // Converted section = kind=output (any status)
  const outputFiles = useMemo(
    () => files.filter((f) => readKind(f) === "output" && f.artifactType !== "filled_pdf"),
    [files]
  );

  const filledPdfFiles = useMemo(
    () => files.filter((f) => readKind(f) === "output" && f.artifactType === "filled_pdf"),
    [files]
  );

  // Auto-poll while outputs are processing. Delay backs off to reduce API churn.
  const hasProcessing = useMemo(
    () =>
      files.some(
        (f) => readKind(f) === "output" && (f.status || "").toLowerCase() === "processing"
      ),
    [files]
  );

  useEffect(() => {
    if (!hasProcessing) {
      pollDelayRef.current = POLL_MIN_DELAY_MS;
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      timer = setTimeout(() => {
        void pollOnce();
      }, delayMs);
    };

    const pollOnce = async () => {
      try {
        await refreshFiles({ validate: false });
      } catch {
        // On transient polling errors, keep going with max delay.
      }

      if (cancelled) return;

      const nextDelay = Math.min(pollDelayRef.current * 2, POLL_MAX_DELAY_MS);
      pollDelayRef.current = nextDelay;
      schedule(nextDelay);
    };

    schedule(pollDelayRef.current);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hasProcessing, refreshFiles]);

  const selectedReadyIds = useMemo(() => {
    // Only raw-ready can be selected (even if selectedReady has other keys)
    const out: string[] = [];
    for (const f of rawReadyFiles) {
      if (selectedReady[f.fileId]) out.push(f.fileId);
    }
    return out;
  }, [rawReadyFiles, selectedReady]);

  const anyReadySelected = useMemo(() => selectedReadyIds.length > 0, [selectedReadyIds]);

  const onToggleAllReady = useCallback(() => {
    const currentlySelectedCount = selectedReadyIds.length;
    const allSelected = rawReadyFiles.length > 0 && currentlySelectedCount === rawReadyFiles.length;

    // If all selected already -> clear all (for raw-ready only)
    if (allSelected) {
      setSelectedReady((prev) => {
        const copy: Record<string, boolean> = { ...prev };
        for (const f of rawReadyFiles) delete copy[f.fileId];
        return copy;
      });
      return;
    }

    // Otherwise select up to MAX_CONVERT_BATCH
    const toSelect = rawReadyFiles.slice(0, MAX_CONVERT_BATCH);
    if (rawReadyFiles.length > MAX_CONVERT_BATCH) {
      onError(`You can convert up to ${MAX_CONVERT_BATCH} files at a time. Select fewer files.`);
    }

    setSelectedReady((prev) => {
      const copy: Record<string, boolean> = { ...prev };
      for (const f of toSelect) copy[f.fileId] = true;
      // ensure the rest of raw-ready are unselected to avoid confusion
      for (const f of rawReadyFiles.slice(MAX_CONVERT_BATCH)) delete copy[f.fileId];
      return copy;
    });
  }, [rawReadyFiles, selectedReadyIds, onError]);

  const onToggleOneReady = useCallback(
    (fileId: string) => {
      // Only allow toggling raw-ready items
      const isRawReady = rawReadyFiles.some((f) => f.fileId === fileId);
      if (!isRawReady) return;

      const isCurrentlySelected = Boolean(selectedReady[fileId]);

      // If selecting (from false -> true), enforce cap
      if (!isCurrentlySelected) {
        const count = selectedReadyIds.length;
        if (count >= MAX_CONVERT_BATCH) {
          onError(`You can convert up to ${MAX_CONVERT_BATCH} files at a time. Deselect one first.`);
          return;
        }
      }

      setSelectedReady((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
    },
    [rawReadyFiles, selectedReady, selectedReadyIds.length, onError]
  );

  const deleteOne = useCallback(
    async (fileId: string, opts?: { skipRefresh?: boolean }) => {
      const exists = files.some((f) => f.fileId === fileId);
      if (!exists) return;

      // optimistic remove
      applyFiles((prev) => prev.filter((f) => f.fileId !== fileId));

      // drop cached signed url (if injected)
      dropSignedUrlRef.current(fileId);

      // also clear selection for that file
      setSelectedReady((prev) => {
        if (!prev[fileId]) return prev;
        const next = { ...prev };
        delete next[fileId];
        return next;
      });

      try {
        await apiDeleteFile(projectId, fileId);
      } catch (e: unknown) {
        await refreshFiles({ validate: false });
        const msg = e instanceof Error ? e.message : "Delete failed";
        onError(msg);
        return;
      }

      if (!opts?.skipRefresh) {
        await refreshFiles({ validate: false });
      }
    },
    [applyFiles, files, projectId, refreshFiles, onError]
  );

  const onRemoveSelectedReady = useCallback(async () => {
    // deterministic order for predictable UX
    for (const id of selectedReadyIds) {
      await deleteOne(id, { skipRefresh: true });
    }
    await refreshFiles({ validate: false });
  }, [selectedReadyIds, deleteOne, refreshFiles]);

  return {
    files,
    refreshFiles,

    rawReadyFiles,
    outputFiles,
    filledPdfFiles,

    selectedReady,
    selectedReadyIds,
    anyReadySelected,

    onToggleAllReady,
    onToggleOneReady,
    onRemoveSelectedReady,

    deleteOne,

    // inject dropSignedUrl once useSignedUrls is ready
    setDropSignedUrl,
  };
}
