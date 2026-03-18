import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Upload, ArrowUpFromLine, Trash2 } from "lucide-react";
import {
  SUPPORTED_UPLOAD_FORMATS_TEXT,
  UPLOAD_FILE_INPUT_ACCEPT,
} from "@/app/app/_lib/conversion-support";

type StagedItem = {
  id: string;
  name: string;
  sizeLabel: string;
  detectedType: string;
  extension: string;
};

export function DropzoneCard(props: {
  pendingCount: number;
  onPickFiles: (files: FileList) => { unsupportedFileNames: string[] };
  onUploadClick: () => void;
  uploadDisabled?: boolean;
  stagedItems: StagedItem[];
  onRemoveStagedItem: (id: string) => void;
  onFillPdf?: (item: { name: string; source: "staged" }) => void;
}) {
  const { pendingCount, onPickFiles, onUploadClick, uploadDisabled, stagedItems, onRemoveStagedItem, onFillPdf } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const stageFiles = useCallback(
    (files: FileList) => {
      const res = onPickFiles(files);
      if (res.unsupportedFileNames.length === 0) {
        setPickError(null);
        return;
      }
      const shown = res.unsupportedFileNames.slice(0, 3).join(", ");
      const moreCount = Math.max(0, res.unsupportedFileNames.length - 3);
      const suffix = moreCount > 0 ? ` +${moreCount} more` : "";
      setPickError(`Unsupported file type: ${shown}${suffix}. Supported: ${SUPPORTED_UPLOAD_FORMATS_TEXT}.`);
    },
    [onPickFiles]
  );

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    stageFiles(files);
  }, [stageFiles]);

  return (
    <div className="cf-panel rounded-[26px] p-4 sm:rounded-[32px] sm:p-6">
      <div
        className={[
          "rounded-[22px] border-2 border-dashed p-6 transition sm:rounded-[28px] sm:p-10",
          isDragActive
            ? "border-[var(--cf-accent)] bg-[var(--cf-accent-muted)] ring-2 ring-[var(--cf-accent-soft)]"
            : "border-[var(--cf-border-strong)] bg-[var(--cf-surface-muted)]",
        ].join(" ")}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="cf-icon-wrap grid h-16 w-16 place-items-center rounded-2xl">
            <Upload className="h-7 w-7 text-[var(--cf-accent)]" />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-[var(--cf-text-1)] sm:mt-6 sm:text-xl">
            Drop files to convert
          </h2>
          <p className="mt-2 text-sm text-[var(--cf-text-3)]">
            {isDragActive
              ? "Drop files to add"
              : SUPPORTED_UPLOAD_FORMATS_TEXT}
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_FILE_INPUT_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.currentTarget.files;
              if (files && files.length) stageFiles(files);
              e.currentTarget.value = "";
            }}
          />

          <div className="mt-6 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="cf-btn cf-btn-secondary w-full px-5 py-3 text-sm sm:w-auto"
            >
              <span className="cf-icon-wrap grid h-6 w-6 place-items-center rounded-lg">
                <Upload className="h-4 w-4" />
              </span>
              Browse Files
            </button>

            <button
              type="button"
              onClick={onUploadClick}
              disabled={uploadDisabled}
              className="cf-btn cf-btn-primary w-full px-5 py-3 text-sm sm:w-auto"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Upload{pendingCount ? ` (${pendingCount})` : ""}
            </button>
          </div>

          {stagedItems.length > 0 ? (
            <div className="mt-5 w-full text-left">
              <div className="text-xs text-[var(--cf-text-3)]">
                <span className="font-semibold text-[var(--cf-text-1)]">
                  {stagedItems.length}
                </span>{" "}
                staged for upload
              </div>

              <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
                {stagedItems.map((it) => {
                  const isPdf = it.detectedType.toUpperCase() === "PDF" || it.extension.toUpperCase() === "PDF";
                  return (
                    <div
                      key={it.id}
                      className="cf-panel-muted flex items-center justify-between gap-3 rounded-2xl px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--cf-text-1)]" title={it.name}>
                          {it.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--cf-text-3)]">
                          {it.sizeLabel}
                          <span className="text-[var(--cf-text-soft)]"> • </span>
                          {it.detectedType}
                          <span className="text-[var(--cf-text-soft)]"> • </span>
                          .{it.extension.toLowerCase()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {isPdf && onFillPdf ? (
                          <button
                            type="button"
                            onClick={() => onFillPdf({ name: it.name, source: "staged" })}
                            className="cf-btn min-h-9 rounded-xl border-[var(--cf-warning-border)] bg-[var(--cf-warning-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--cf-warning-text)]"
                            aria-label={`Fill PDF for ${it.name}`}
                            title="Fill PDF"
                          >
                            Fill PDF
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => onRemoveStagedItem(it.id)}
                          className="cf-btn cf-btn-ghost h-9 w-9 rounded-xl px-0 text-[var(--cf-text-2)] hover:bg-[var(--cf-danger-soft)] hover:text-[var(--cf-danger-text)]"
                          aria-label={`Remove ${it.name} from upload staging`}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {pickError ? (
            <p className="mt-3 text-xs text-[var(--cf-danger-text)]">{pickError}</p>
          ) : null}

          <p className="mt-4 text-xs text-[var(--cf-text-soft)]">
            Browse adds files to staging. Upload sends all staged files.
          </p>
        </div>
      </div>
    </div>
  );
}
