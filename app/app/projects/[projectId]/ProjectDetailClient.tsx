"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

import { DropzoneCard } from "./components/DropzoneCard";
import { ReadyQueue } from "./components/ReadyQueue";
import { ConvertedFiles } from "./components/ConvertedFiles";
import { ConversionSettings } from "./components/ConversionSettings";

import type { FileRow } from "../_lib/types";
import type { ItemSettings, LocalConvertedFile, LocalReadyFile, OutputFormat, PresetId } from "./_lib/ui-types";
import { ALL_OUTPUT_FORMATS, VALID_OUTPUT_FORMATS } from "./_lib/ui-types";
import {
  FORMAT_CAPABILITIES,
  INPUT_ONLY_FORMAT_LABELS,
  invalidTargetReasonForSourceLabel,
  recommendedOutputsForSourceLabels,
  sortOutputsByRecommendation,
} from "@/app/app/_lib/conversion-support";

import {
  completeUpload,
  convertFiles,
  createUpload,
  getConversionQuota,
  type QuotaStatus,
} from "./_lib/api-client";
import { fmtBytes, formatFromFilenameOrContentType, safeFilenameFromRow } from "./_lib/format";

import { useSignedUrls } from "./hooks/useSignedUrls";
import { useStagedFiles } from "./hooks/useStagedFiles";
import { useServerFiles } from "./hooks/useServerFiles";
import { useSetFileCount } from "./FileCountContext";

type Props = {
  projectId: string;
  projectName: string;
  initialFiles: FileRow[];
  guestMode?: boolean;
};

type FillPdfTarget = {
  name: string;
  source: "staged" | "uploaded";
  fileId?: string;
};

const DEFAULT_SETTINGS: ItemSettings = {
  format: "JPG",
  quality: 100,
  preset: "web",
  resizePct: 100,
};

function buildFakeFile(filename: string, contentType: string) {
  return new File([], filename, { type: contentType || "application/octet-stream" });
}

function summarizeConvert(results: Array<{ ok: boolean; error?: string }>) {
  const okCount = results.reduce((acc, r) => acc + (r.ok ? 1 : 0), 0);
  const failCount = results.length - okCount;
  const firstError = results.find((r) => !r.ok && r.error)?.error;
  return { okCount, failCount, firstError };
}

export default function ProjectDetailClient({ projectId, initialFiles, guestMode = false }: Props) {
  const router = useRouter();
  const [globalFormat, setGlobalFormat] = useState<OutputFormat>("JPG");
  const [globalQuality, setGlobalQuality] = useState(100);
  const [globalPreset, setGlobalPreset] = useState<PresetId>("web");
  const [globalResizePct, setGlobalResizePct] = useState(100);

  const [itemSettings, setItemSettings] = useState<Record<string, ItemSettings>>({});

  const [uploadBusy, setUploadBusy] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);

  const setFileCount = useSetFileCount();
  const staged = useStagedFiles();
  const server = useServerFiles({ projectId, initialFiles, onError: setError });
  const signed = useSignedUrls(projectId, server.files);

  const refreshQuota = useCallback(async () => {
    try {
      const next = await getConversionQuota(projectId);
      setQuota(next);
    } catch {
      // Non-fatal: quota banner just stays hidden.
    }
  }, [projectId]);

  useEffect(() => {
    setFileCount(server.files.length);
  }, [server.files, setFileCount]);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  useEffect(() => {
    server.setDropSignedUrl(signed.dropSignedUrl);
  }, [server, signed.dropSignedUrl]);

  const getSettings = useCallback(
    (fileId: string): ItemSettings =>
      itemSettings[fileId] ?? { ...DEFAULT_SETTINGS },
    [itemSettings]
  );

  const setItemFormat = useCallback(
    (fileId: string, fmt: OutputFormat) => {
      setItemSettings((prev) => {
        const existing = prev[fileId] ?? { ...DEFAULT_SETTINGS };
        return { ...prev, [fileId]: { ...existing, format: fmt } };
      });
    },
    []
  );

  const handleGlobalFormat = useCallback(
    (f: OutputFormat) => {
      setGlobalFormat(f);
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of server.selectedReadyIds) {
          next[id] = { ...(prev[id] ?? { ...DEFAULT_SETTINGS }), format: f };
        }
        return next;
      });
    },
    [server.selectedReadyIds]
  );

  const handleGlobalQuality = useCallback(
    (q: number) => {
      setGlobalQuality(q);
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of server.selectedReadyIds) {
          next[id] = { ...(prev[id] ?? { ...DEFAULT_SETTINGS }), quality: q };
        }
        return next;
      });
    },
    [server.selectedReadyIds]
  );

  const handleGlobalPreset = useCallback(
    (p: PresetId) => {
      const presetDefaults: Record<PresetId, { format: OutputFormat; quality: number }> = {
        web: { format: "WebP", quality: 80 },
        hq: { format: "PNG", quality: 95 },
        email: { format: "JPG", quality: 70 },
      };
      const { format, quality } = presetDefaults[p];
      setGlobalPreset(p);
      setGlobalFormat(format);
      setGlobalQuality(quality);
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of server.selectedReadyIds) {
          next[id] = { ...(prev[id] ?? { ...DEFAULT_SETTINGS }), preset: p, format, quality };
        }
        return next;
      });
    },
    [server.selectedReadyIds]
  );

  const handleGlobalResizePct = useCallback(
    (r: number) => {
      setGlobalResizePct(r);
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of server.selectedReadyIds) {
          next[id] = { ...(prev[id] ?? { ...DEFAULT_SETTINGS }), resizePct: r };
        }
        return next;
      });
    },
    [server.selectedReadyIds]
  );

  const prevFileIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentRawIds = new Set(server.rawReadyFiles.map((f) => f.fileId));
    const removed = [...prevFileIdsRef.current].filter((id) => !currentRawIds.has(id));
    const added = [...currentRawIds].filter((id) => !prevFileIdsRef.current.has(id));

    if (removed.length > 0 || added.length > 0) {
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of removed) delete next[id];
        for (const id of added) {
          if (!next[id]) {
            next[id] = {
              format: globalFormat,
              quality: globalQuality,
              preset: globalPreset,
              resizePct: globalResizePct,
            };
          }
        }
        return next;
      });
    }

    prevFileIdsRef.current = currentRawIds;
  }, [server.rawReadyFiles, globalFormat, globalQuality, globalPreset, globalResizePct]);

  const onUploadClick = useCallback(async () => {
    if (uploadBusy || staged.uploadDisabled) return;
    setError(null);
    setNotice(null);
    setUploadBusy(true);
    try {
      for (const item of staged.selectedFiles) {
        const file = item.file;
        const upload = await createUpload(projectId, file);
        let putRes: Response;
        try {
          putRes = await fetch(upload.putUrl, { method: "PUT", headers: upload.headers, body: file });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.toLowerCase().includes("failed to fetch")) {
            throw new Error(
              "Upload failed before reaching S3. Check bucket CORS allowed origins for this app domain."
            );
          }
          throw error;
        }
        if (!putRes.ok) throw new Error(`S3 PUT failed: ${putRes.status}`);
        await completeUpload(projectId, {
          uploadId: upload.uploadId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          bucket: upload.bucket,
          key: upload.key,
        });
      }
      staged.consumeSelected();
      await server.refreshFiles({ validate: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      await server.refreshFiles({ validate: true });
    } finally {
      setUploadBusy(false);
    }
  }, [uploadBusy, staged, projectId, server]);

  const readyView: LocalReadyFile[] = useMemo(() => {
    return server.rawReadyFiles.map((f) => {
      const filename = safeFilenameFromRow(f);
      const from = formatFromFilenameOrContentType(filename, f.contentType);
      const s = getSettings(f.fileId);
      return {
        id: f.fileId,
        file: buildFakeFile(filename, f.contentType),
        previewUrl: signed.signedUrls[f.fileId] || "",
        contentType: f.contentType,
        status: f.status,
        fromLabel: String(from),
        toFormat: s.format,
        quality: s.quality,
        preset: s.preset,
        resizePct: s.resizePct,
        sizeLabel: fmtBytes(f.sizeBytes),
        selected: Boolean(server.selectedReady[f.fileId]),
      };
    });
  }, [server.rawReadyFiles, server.selectedReady, signed.signedUrls, getSettings]);

  const filesById = useMemo(() => {
    const map = new Map<string, FileRow>();
    for (const file of server.files) {
      map.set(file.fileId, file);
    }
    return map;
  }, [server.files]);

  const convertedView: LocalConvertedFile[] = useMemo(() => {
    return server.outputFiles.map((f) => {
      const filename = safeFilenameFromRow(f);
      const sourceFile = f.sourceFileId
        ? filesById.get(f.sourceFileId)
        : undefined;
      const from = sourceFile
        ? formatFromFilenameOrContentType(safeFilenameFromRow(sourceFile), sourceFile.contentType)
        : f.sourceContentType
          ? formatFromFilenameOrContentType(filename, f.sourceContentType)
          : formatFromFilenameOrContentType(filename, f.contentType);
      const st = String(f.status || "").toLowerCase();
      const status: "done" | "processing" | "failed" =
        st === "done" ? "done" : st === "failed" ? "failed" : "processing";

      const toLabel =
        f.outputFormat ?? (filename.includes(".") ? filename.split(".").pop()!.toUpperCase() : "?");

      return {
        id: f.fileId,
        filename,
        name: filename,
        previewUrl: signed.signedUrls[f.fileId] || "",
        contentType: f.contentType,
        fromLabel: String(from),
        toLabel,
        sourceFileId: f.sourceFileId,
        sizeBytes: f.sizeBytes ?? undefined,
        sizeLabel: fmtBytes(f.sizeBytes),
        whenLabel: f.updatedAt || f.createdAt || "",
        status,
        packaging: f.packaging,
        pageCount: f.pageCount,
        outputCount: f.outputCount,
      };
    });
  }, [server.outputFiles, filesById, signed.signedUrls]);

  const filledPdfView: LocalConvertedFile[] = useMemo(() => {
    return server.filledPdfFiles.map((f) => {
      const filename = safeFilenameFromRow(f);
      const sourceFile = f.sourceFileId
        ? filesById.get(f.sourceFileId)
        : undefined;
      const from = sourceFile
        ? formatFromFilenameOrContentType(safeFilenameFromRow(sourceFile), sourceFile.contentType)
        : "PDF";
      const st = String(f.status || "").toLowerCase();
      const status: "done" | "processing" | "failed" =
        st === "done" ? "done" : st === "failed" ? "failed" : "processing";

      return {
        id: f.fileId,
        filename,
        name: filename,
        previewUrl: signed.signedUrls[f.fileId] || "",
        contentType: f.contentType,
        fromLabel: String(from),
        toLabel: "PDF",
        sourceFileId: f.sourceFileId,
        sizeBytes: f.sizeBytes ?? undefined,
        sizeLabel: fmtBytes(f.sizeBytes),
        whenLabel: f.updatedAt || f.createdAt || "",
        status,
        packaging: f.packaging,
        pageCount: f.pageCount,
        outputCount: f.outputCount,
      };
    });
  }, [server.filledPdfFiles, filesById, signed.signedUrls]);

  const selectedReadyView = useMemo(
    () => readyView.filter((f) => f.selected),
    [readyView]
  );

  const selectedReadySourceLabels = useMemo(
    () => selectedReadyView.map((f) => f.fromLabel),
    [selectedReadyView]
  );

  const allSidebarFormats = useMemo<OutputFormat[]>(
    () => sortOutputsByRecommendation(FORMAT_CAPABILITIES.supportedOutputs, selectedReadySourceLabels),
    [selectedReadySourceLabels]
  );

  const enabledSidebarFormats = useMemo<OutputFormat[]>(() => {
    if (selectedReadyView.length === 0) return [];
    const allowedSets = selectedReadyView.map((f) => VALID_OUTPUT_FORMATS[f.fromLabel] ?? []);
    const intersection = ALL_OUTPUT_FORMATS.filter((fmt) =>
      allowedSets.every((list) => list.includes(fmt))
    );
    return intersection.filter((fmt) =>
      selectedReadyView.every((f) => !invalidTargetReasonForSourceLabel(f.fromLabel, fmt))
    );
  }, [selectedReadyView]);

  const recommendedSidebarFormats = useMemo<OutputFormat[]>(() => {
    if (selectedReadyView.length === 0) return [];
    return recommendedOutputsForSourceLabels(
      selectedReadySourceLabels,
      enabledSidebarFormats,
      3
    );
  }, [selectedReadyView.length, selectedReadySourceLabels, enabledSidebarFormats]);

  const inputOnlySidebarFormats = useMemo<string[]>(
    () => [...INPUT_ONLY_FORMAT_LABELS],
    []
  );

  const quotaExhausted = Boolean(quota?.exhausted);
  const quotaRemaining = quota?.remaining ?? null;
  const selectedExceedsQuota =
    quotaRemaining != null && server.selectedReadyIds.length > quotaRemaining;

  useEffect(() => {
    if (allSidebarFormats.includes(globalFormat)) return;
    setGlobalFormat(allSidebarFormats[0] ?? "JPG");
  }, [allSidebarFormats, globalFormat]);

  useEffect(() => {
    if (!mobileSettingsOpen) return;
    const onResize = () => {
      if (window.innerWidth >= 1280) {
        setMobileSettingsOpen(false);
      }
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [mobileSettingsOpen]);

  const onConvert = useCallback(async () => {
    if (convertBusy || !server.anyReadySelected) return;
    if (quotaExhausted) {
      setError("You've reached your conversion limit.");
      return;
    }
    if (quotaRemaining != null && server.selectedReadyIds.length > quotaRemaining) {
      setError(
        `You can convert ${quotaRemaining} more file${quotaRemaining === 1 ? "" : "s"} before reaching your limit.`
      );
      return;
    }
    setConvertBusy(true);
    setError(null);
    setNotice(null);
    try {
      const conversions = server.selectedReadyIds.map((fileId) => {
        const s = getSettings(fileId);
        return {
          fileId,
          outputFormat: s.format,
          quality: s.quality,
          preset: s.preset,
          resizePct: s.resizePct < 100 ? s.resizePct : null,
        };
      });

      const res = await convertFiles(projectId, { conversions });
      if (res.quota) setQuota(res.quota);
      const summary = summarizeConvert(
        res.results.map((r) => (r.ok ? { ok: true } : { ok: false, error: (r as { error: string }).error }))
      );

      if (summary.failCount === 0) {
        setNotice(`Queued ${summary.okCount} conversion${summary.okCount !== 1 ? "s" : ""}.`);
      } else {
        setNotice(
          `${summary.okCount} queued, ${summary.failCount} failed${summary.firstError ? ` (${summary.firstError})` : ""}.`
        );
      }

      await server.refreshFiles({ validate: false });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Convert failed");
      await refreshQuota();
    } finally {
      setConvertBusy(false);
    }
  }, [
    convertBusy,
    getSettings,
    projectId,
    quotaExhausted,
    quotaRemaining,
    refreshQuota,
    server,
  ]);

  const onReconvert = useCallback(
    async (sourceFileId: string, settings: ItemSettings) => {
      if (quotaExhausted) {
        setError("You've reached your conversion limit.");
        return;
      }
      if (quotaRemaining != null && quotaRemaining < 1) {
        setError("You've reached your conversion limit.");
        return;
      }
      setError(null);
      try {
        const res = await convertFiles(projectId, {
          conversions: [{
            fileId: sourceFileId,
            outputFormat: settings.format,
            quality: settings.quality,
            preset: settings.preset,
            resizePct: settings.resizePct < 100 ? settings.resizePct : null,
          }],
        });
        if (res.quota) setQuota(res.quota);
        const r = res.results[0];
        if (r && !r.ok) {
          setError(`Reconvert failed: ${(r as { error: string }).error}`);
        } else {
          setNotice("Reconversion queued.");
          await server.refreshFiles({ validate: false });
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Reconvert failed");
        await refreshQuota();
      }
    },
    [projectId, quotaExhausted, quotaRemaining, refreshQuota, server]
  );

  const openFillPdf = useCallback(
    (target: FillPdfTarget) => {
      if (guestMode) {
        setNotice("PDF fill is available in signed-in projects.");
        return;
      }
      if (target.source !== "uploaded" || !target.fileId) {
        setNotice(`Upload "${target.name}" first to open Fill PDF.`);
        return;
      }
      setError(null);
      setNotice(null);
      router.push(
        `/app/projects/${encodeURIComponent(projectId)}/fill/${encodeURIComponent(target.fileId)}`
      );
    },
    [guestMode, projectId, router]
  );

  return (
    <>
      <div className="mx-auto grid max-w-[1900px] grid-cols-1 gap-4 px-3 pb-24 pt-3 sm:gap-6 sm:px-5 sm:pb-12 sm:pt-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:px-6 xl:pb-8">
        <div className="space-y-6">
          {error ? (
            <div className="cf-banner cf-banner-danger rounded-2xl px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="cf-banner cf-banner-info rounded-2xl px-4 py-3 text-sm">
              {notice}
            </div>
          ) : null}
          {quota ? (
            <div
              className={[
                "cf-banner rounded-2xl px-4 py-3 text-sm",
                quota.exhausted
                  ? "cf-banner-warning"
                  : "",
              ].join(" ")}
            >
              <p className="font-medium">
                {quota.remaining} of {quota.limit} conversions remaining
              </p>
              {quota.exhausted ? (
                <p className="mt-1 text-xs opacity-90">
                  You&apos;ve reached your conversion limit.{" "}
                  {quota.scope === "guest"
                    ? "Sign in to get 10 conversions."
                    : "Contact an admin to request a higher limit."}
                </p>
              ) : null}
              {!quota.exhausted && selectedExceedsQuota ? (
                <p className="mt-1 text-xs text-[var(--cf-warning-text)]">
                  Reduce your selection to {quota.remaining} file
                  {quota.remaining === 1 ? "" : "s"} or fewer.
                </p>
              ) : null}
            </div>
          ) : null}

          <DropzoneCard
            pendingCount={staged.staged.length}
            onPickFiles={staged.onPickFiles}
            onUploadClick={onUploadClick}
            uploadDisabled={uploadBusy || staged.uploadDisabled}
            stagedItems={staged.stagedItems}
            onRemoveStagedItem={staged.removeStaged}
            onFillPdf={guestMode ? undefined : openFillPdf}
          />

          <ReadyQueue
            projectId={projectId}
            files={readyView}
            onToggleAll={server.onToggleAllReady}
            onToggleOne={server.onToggleOneReady}
            onRemoveSelected={server.onRemoveSelectedReady}
            onConvert={onConvert}
            onSetItemFormat={setItemFormat}
            onFillPdf={guestMode ? undefined : openFillPdf}
            convertBusy={convertBusy}
            quotaExhausted={quotaExhausted || selectedExceedsQuota}
          />

          <ConvertedFiles
            files={convertedView}
            projectId={projectId}
            onDeleteFile={server.deleteOne}
            onReconvert={onReconvert}
            globalSettings={{ format: globalFormat, quality: globalQuality, preset: globalPreset, resizePct: globalResizePct }}
          />

          {filledPdfView.length > 0 ? (
            <ConvertedFiles
              files={filledPdfView}
              projectId={projectId}
              onDeleteFile={server.deleteOne}
              title="Filled PDFs"
              emptyMessage="No filled PDFs yet."
              globalSettings={{ format: globalFormat, quality: globalQuality, preset: globalPreset, resizePct: globalResizePct }}
            />
          ) : null}
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <ConversionSettings
              format={globalFormat}
              allFormats={allSidebarFormats}
              enabledFormats={enabledSidebarFormats}
              inputOnlyFormats={inputOnlySidebarFormats}
              recommendedFormats={recommendedSidebarFormats}
              onFormat={handleGlobalFormat}
              quality={globalQuality}
              onQuality={handleGlobalQuality}
              preset={globalPreset}
              onPreset={handleGlobalPreset}
              resizePct={globalResizePct}
              onResizePct={handleGlobalResizePct}
              selectedCount={server.selectedReadyIds.length}
            />
          </div>
        </aside>
      </div>

      <button
        type="button"
        onClick={() => setMobileSettingsOpen(true)}
        className="cf-btn cf-btn-primary fixed bottom-4 right-4 z-40 rounded-full px-4 py-2.5 text-sm xl:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Settings
      </button>

      {mobileSettingsOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close settings"
            className="cf-overlay absolute inset-0"
            onClick={() => setMobileSettingsOpen(false)}
          />

          <div className="cf-panel-strong absolute inset-x-0 bottom-0 top-24 overflow-auto rounded-t-[28px] p-3 pb-5">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <p className="cf-kicker">Conversion</p>
                <p className="text-base font-semibold text-[var(--cf-text-1)]">Settings</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileSettingsOpen(false)}
                className="cf-btn cf-btn-secondary h-10 w-10 rounded-xl px-0"
                aria-label="Close settings panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ConversionSettings
              format={globalFormat}
              allFormats={allSidebarFormats}
              enabledFormats={enabledSidebarFormats}
              inputOnlyFormats={inputOnlySidebarFormats}
              recommendedFormats={recommendedSidebarFormats}
              onFormat={handleGlobalFormat}
              quality={globalQuality}
              onQuality={handleGlobalQuality}
              preset={globalPreset}
              onPreset={handleGlobalPreset}
              resizePct={globalResizePct}
              onResizePct={handleGlobalResizePct}
              selectedCount={server.selectedReadyIds.length}
            />
          </div>
        </div>
      ) : null}

    </>
  );
}
