"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ItemSettings, LocalConvertedFile, OutputFormat, PresetId } from "../../_lib/ui-types";
import { ALL_OUTPUT_FORMATS } from "../../_lib/ui-types";
import { INPUT_ONLY_FORMAT_LABELS, invalidTargetReasonForSourceLabel } from "@/app/app/_lib/conversion-support";

export function ReconvertPanel({
  file,
  globalSettings,
  onReconvert,
  onClose,
}: {
  file: LocalConvertedFile;
  globalSettings: ItemSettings;
  onReconvert: (sourceFileId: string, settings: ItemSettings) => void;
  onClose: () => void;
}) {
  const enabledOutputFormats = useMemo(
    () =>
      ALL_OUTPUT_FORMATS.filter((target) => !invalidTargetReasonForSourceLabel(file.fromLabel, target)),
    [file.fromLabel]
  );
  const initialFormat = useMemo(() => {
    const outputLabel = file.toLabel as OutputFormat;
    const fromFile = ALL_OUTPUT_FORMATS.includes(outputLabel) ? outputLabel : globalSettings.format;
    if (enabledOutputFormats.includes(fromFile)) return fromFile;
    return enabledOutputFormats[0] ?? globalSettings.format;
  }, [enabledOutputFormats, file.toLabel, globalSettings.format]);

  const [fmt, setFmt] = useState<OutputFormat>(initialFormat);
  const [quality, setQuality] = useState(globalSettings.quality);
  const preset: PresetId = globalSettings.preset;
  const [resizePct, setResizePct] = useState(globalSettings.resizePct);

  const displayFormats = useMemo(() => {
    const inputOnly = INPUT_ONLY_FORMAT_LABELS.filter(
      (label) => !ALL_OUTPUT_FORMATS.includes(label as OutputFormat)
    );
    return [...ALL_OUTPUT_FORMATS, ...inputOnly];
  }, []);

  if (!file.sourceFileId) return null;

  return (
    <div className="border-t border-white/10 bg-white/2 px-5 py-4 space-y-4">
      <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Reconvert settings</div>

      <div>
        <div className="mb-2 text-xs text-slate-400">Output format</div>
        <div className="flex flex-wrap gap-1.5">
          {displayFormats.map((target) => {
            const isOutput = ALL_OUTPUT_FORMATS.includes(target as OutputFormat);
            const reason = !isOutput
              ? `${target} is supported as an input format only`
              : invalidTargetReasonForSourceLabel(file.fromLabel, target);
            const disabled = Boolean(reason);
            const active = !disabled && fmt === target;

            return (
              <button
                key={target}
                type="button"
                onClick={() => {
                  if (disabled || !isOutput) return;
                  setFmt(target as OutputFormat);
                }}
                disabled={disabled || !isOutput}
                title={reason ?? `Convert to ${target}`}
                className={[
                  "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                  active
                    ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                    : !disabled && isOutput
                      ? "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
                      : "cursor-not-allowed border-white/10 bg-white/3 text-slate-600",
                ].join(" ")}
              >
                {target}
              </button>
            );
          })}
        </div>
      </div>

      {fmt !== "PDF" && (
        <>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Quality</span>
              <span className="text-slate-200">{quality}%</span>
            </div>
            <input
              type="range" min={1} max={100} value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-sky-400"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Resize</span>
              <span className="text-slate-200">{resizePct === 100 ? "No resize" : `${resizePct}%`}</span>
            </div>
            <input
              type="range" min={10} max={100} step={5} value={resizePct}
              onChange={(e) => setResizePct(Number(e.target.value))}
              className="w-full accent-sky-400"
            />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!enabledOutputFormats.includes(fmt)) return;
            onReconvert(file.sourceFileId!, { format: fmt, quality, preset, resizePct });
            onClose();
          }}
          disabled={!enabledOutputFormats.includes(fmt)}
          className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-sky-600/90 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          <RefreshCw className="h-3.5 w-3.5" />Reconvert
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
