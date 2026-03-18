"use client";

import { Trash2, Play, Check, Eye } from "lucide-react";
import type { LocalReadyFile, OutputFormat } from "../_lib/ui-types";
import { VALID_OUTPUT_FORMATS, IMAGE_OUTPUT_FORMATS } from "../_lib/ui-types";
import { Thumb } from "./Thumb";
import { FilePreviewModal } from "./FilePreviewModal";
import { useFilePreview } from "../hooks/useFilePreview";
import { canPreview, logPreviewHiddenReasonOnce } from "../_lib/preview";
import {
  recommendedOutputsForSourceLabels,
} from "@/app/app/_lib/conversion-support";

type Props = {
  projectId: string;
  files: LocalReadyFile[];
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onRemoveSelected: () => void;
  onConvert: () => void;
  onSetItemFormat: (fileId: string, format: OutputFormat) => void;
  onFillPdf?: (item: { name: string; source: "uploaded"; fileId: string }) => void;
  convertBusy: boolean;
  quotaExhausted?: boolean;
};

export function ReadyQueue({
  projectId,
  files,
  onToggleAll,
  onToggleOne,
  onRemoveSelected,
  onConvert,
  onSetItemFormat,
  onFillPdf,
  convertBusy,
  quotaExhausted = false,
}: Props) {
  const preview = useFilePreview(projectId);

  const total = files.length;
  const selected = files.reduce((acc, f) => acc + (f.selected ? 1 : 0), 0);
  const allSelected = total > 0 && selected === total;
  const removeDisabled = selected === 0;
  const convertDisabled = selected === 0 || convertBusy || quotaExhausted;

  return (
    <>
      <div className="cf-panel overflow-hidden rounded-[26px] sm:rounded-[32px]">
        <div className="flex flex-col gap-3 border-b border-[var(--cf-divider)] bg-[var(--cf-surface-muted)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleAll}
              className={[
                "grid h-6 w-6 place-items-center rounded-md border transition",
                allSelected
                  ? "border-[var(--cf-accent-border)] bg-[var(--cf-accent-soft)] text-[var(--cf-accent)]"
                  : "border-[var(--cf-border)] bg-[var(--cf-surface)] text-transparent hover:border-[var(--cf-border-strong)] hover:bg-[var(--cf-input-bg-hover)]",
              ].join(" ")}
              aria-label="Select all"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <div className="text-sm font-semibold text-[var(--cf-text-1)] sm:text-base">
              Ready to Convert{" "}
              <span className="ml-2 text-sm font-normal text-[var(--cf-text-3)]">({total} files)</span>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onRemoveSelected}
              disabled={removeDisabled}
              className={[
                "cf-btn min-h-10 flex-1 rounded-2xl px-3 py-2 text-sm sm:flex-none",
                removeDisabled
                  ? "text-[var(--cf-text-3)]"
                  : "text-[var(--cf-danger-text)] hover:bg-[var(--cf-danger-soft)]",
              ].join(" ")}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
            <button
              type="button"
              onClick={onConvert}
              disabled={convertDisabled}
              className="cf-btn cf-btn-primary min-h-10 flex-1 rounded-2xl px-4 py-2.5 text-sm sm:flex-none"
            >
              <Play className="h-4 w-4" />
              {convertBusy ? "Converting…" : quotaExhausted ? "Limit reached" : `Convert (${selected})`}
            </button>
          </div>
        </div>

        {total === 0 ? (
          <div className="cf-empty-state rounded-2xl px-4 py-8 text-sm sm:px-5">
            No files uploaded yet. Click <span className="text-[var(--cf-text-1)]">Browse Files</span>.
          </div>
        ) : (
          <div className="divide-y divide-[var(--cf-divider)]">
            {files.map((f) => {
              const name = f.file?.name || f.id;
              const upperSource = f.fromLabel.toUpperCase();
              const isPdf = upperSource === "PDF";
              const previewEligibility = canPreview({
                fileId: f.id,
                filename: name,
                contentType: f.contentType,
                formatLabel: f.fromLabel,
                status: f.status,
                previewUrl: f.previewUrl,
                hasLocalSource: f.previewUrl.startsWith("blob:"),
              });
              if (!previewEligibility.canPreview) {
                logPreviewHiddenReasonOnce({
                  section: "ready",
                  fileId: f.id,
                  reason: previewEligibility.reason,
                  filename: name,
                  formatLabel: f.fromLabel,
                  status: f.status,
                });
              }
              // Only show formats valid for this file's source type (never render disabled chips)
              const validFormats: OutputFormat[] =
                VALID_OUTPUT_FORMATS[f.fromLabel] ?? IMAGE_OUTPUT_FORMATS;
              const recommendedFormats = recommendedOutputsForSourceLabels(
                [f.fromLabel],
                validFormats,
                3
              );

              return (
                <div key={f.id} className="flex flex-wrap items-start gap-3 px-4 py-4 transition-colors hover:bg-[var(--cf-surface-muted)] sm:flex-nowrap sm:items-center sm:px-5">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => onToggleOne(f.id)}
                    className={[
                      "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition",
                      f.selected
                        ? "border-[var(--cf-accent-border)] bg-[var(--cf-accent-soft)] text-[var(--cf-accent)]"
                        : "border-[var(--cf-border)] bg-[var(--cf-surface-muted)] text-transparent hover:border-[var(--cf-border-strong)] hover:bg-[var(--cf-input-bg-hover)]",
                    ].join(" ")}
                    aria-label={`Select ${name}`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>

                  {/* Thumbnail */}
                  <Thumb src={f.previewUrl} alt={name} fallbackLabel={f.fromLabel} />

                  {/* File info */}
                  <div className="min-w-0 flex-1 basis-[calc(100%-72px)] sm:basis-auto">
                    <div className="truncate text-sm font-semibold text-[var(--cf-text-1)]">{name || "Untitled"}</div>
                    <div className="text-xs text-[var(--cf-text-3)]">{f.sizeLabel}</div>
                  </div>

                  {/* Per-item format selector — only valid formats for this input type */}
                  <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
                    {f.selected ? (
                      <div className="w-full sm:w-[29rem]">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge>{f.fromLabel}</Badge>
                          <span className="text-xs text-[var(--cf-text-soft)]">→</span>
                          <Badge tone="active">{f.toFormat}</Badge>
                        </div>

                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cf-text-3)]">
                          Recommended
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {recommendedFormats.map((fmt: OutputFormat) => (
                            <button
                              key={`rec-${fmt}`}
                              type="button"
                            onClick={() => onSetItemFormat(f.id, fmt)}
                            className={[
                                "rounded-full border px-2 py-0.5 text-xs font-semibold transition",
                                f.toFormat === fmt
                                  ? "border-[var(--cf-accent-border)] bg-[var(--cf-accent-soft)] text-[var(--cf-accent)]"
                                  : "border-[var(--cf-border)] bg-[var(--cf-surface-muted)] text-[var(--cf-text-2)] hover:border-[var(--cf-border-strong)] hover:bg-[var(--cf-input-bg-hover)] hover:text-[var(--cf-text-1)]",
                              ].join(" ")}
                            >
                              {fmt}
                            </button>
                          ))}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--cf-text-soft)]">
                          Choose any other target format from Conversion Settings on the right.
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge>{f.fromLabel}</Badge>
                        <span className="text-xs text-[var(--cf-text-soft)]">select to configure</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {previewEligibility.canPreview ? (
                        <button
                          type="button"
                          onClick={() =>
                            void preview.openPreview({
                              section: "ready",
                              fileId: f.id,
                              filename: name,
                              contentType: f.contentType,
                              formatLabel: f.fromLabel,
                              status: f.status,
                              previewUrl: f.previewUrl,
                              hasLocalSource: f.previewUrl.startsWith("blob:"),
                            })
                          }
                          className="cf-btn cf-btn-secondary min-h-9 rounded-xl px-2.5 py-1 text-xs"
                          aria-label={`Preview ${name}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                      ) : null}

                      {isPdf && onFillPdf ? (
                        <button
                          type="button"
                          onClick={() => onFillPdf({ name, source: "uploaded", fileId: f.id })}
                          className="cf-btn min-h-9 rounded-xl border-[var(--cf-warning-border)] bg-[var(--cf-warning-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--cf-warning-text)]"
                          aria-label={`Fill PDF for ${name}`}
                        >
                          Fill & Sign
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FilePreviewModal
        preview={preview.preview}
        onClose={preview.closePreview}
        onZoomIn={preview.zoomIn}
        onZoomOut={preview.zoomOut}
        onRetry={() => void preview.retryPreview()}
        onImageError={preview.onImageError}
      />
    </>
  );
}

function Badge(props: { children: React.ReactNode; tone?: "active" }) {
  const { tone } = props;
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "active" ? "cf-pill cf-pill-info" : "cf-pill",
      ].join(" ")}
    >
      {props.children}
    </span>
  );
}
