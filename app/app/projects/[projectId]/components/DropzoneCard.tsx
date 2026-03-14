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
    <div className="rounded-[26px] border border-white/10 bg-white/3 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:rounded-[32px] sm:p-6">
      <div
        className={[
          "rounded-[22px] border border-dashed p-6 transition sm:rounded-[28px] sm:p-10",
          isDragActive
            ? "border-sky-300/70 bg-sky-500/10 ring-2 ring-sky-300/35"
            : "border-white/15 bg-white/2",
        ].join(" ")}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <Upload className="h-7 w-7 text-sky-200" />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-slate-100 sm:mt-6 sm:text-xl">
            Drop files to convert
          </h2>
          <p className="mt-2 text-sm text-slate-400">
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-100 hover:bg-white/10"
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg border border-white/10 bg-white/5">
                <Upload className="h-4 w-4 text-slate-200" />
              </span>
              Browse Files
            </button>

            <button
              type="button"
              onClick={onUploadClick}
              disabled={uploadDisabled}
              className={[
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition",
                uploadDisabled
                  ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500"
                  : "bg-sky-600/90 text-white shadow-[0_10px_30px_rgba(2,132,199,0.25)] hover:bg-sky-500",
              ].join(" ")}
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Upload{pendingCount ? ` (${pendingCount})` : ""}
            </button>
          </div>

          {stagedItems.length > 0 ? (
            <div className="mt-5 w-full text-left">
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-slate-200">
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
                      className={[
                        "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100" title={it.name}>
                          {it.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {it.sizeLabel}
                          <span className="text-slate-600"> • </span>
                          {it.detectedType}
                          <span className="text-slate-600"> • </span>
                          .{it.extension.toLowerCase()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {isPdf && onFillPdf ? (
                          <button
                            type="button"
                            onClick={() => onFillPdf({ name: it.name, source: "staged" })}
                            className="inline-flex min-h-9 items-center rounded-xl border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-400/20"
                            aria-label={`Fill PDF for ${it.name}`}
                            title="Fill PDF"
                          >
                            Fill PDF
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => onRemoveStagedItem(it.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-rose-500/15 hover:text-rose-200"
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
            <p className="mt-3 text-xs text-rose-300">{pickError}</p>
          ) : null}

          <p className="mt-4 text-xs text-slate-500">
            Browse adds files to staging. Upload sends all staged files.
          </p>
        </div>
      </div>
    </div>
  );
}
