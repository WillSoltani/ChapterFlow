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
    <div className="space-y-4 border-t border-[var(--cf-divider)] bg-[var(--cf-surface-muted)] px-5 py-4">
      <div className="cf-kicker">Reconvert settings</div>

      <div>
        <div className="mb-2 text-xs text-[var(--cf-text-3)]">Output format</div>
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
                    ? "border-[var(--cf-accent-border)] bg-[var(--cf-accent-soft)] text-[var(--cf-accent)]"
                    : !disabled && isOutput
                      ? "border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text-2)] hover:border-[var(--cf-border-strong)] hover:text-[var(--cf-text-1)]"
                      : "cursor-not-allowed border-[var(--cf-border)] bg-[var(--cf-surface-muted)] text-[var(--cf-text-3)]",
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
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--cf-text-3)]">
              <span>Quality</span>
              <span className="text-[var(--cf-text-1)]">{quality}%</span>
            </div>
            <input
              type="range" min={1} max={100} value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: "var(--cf-accent)" }}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--cf-text-3)]">
              <span>Resize</span>
              <span className="text-[var(--cf-text-1)]">{resizePct === 100 ? "No resize" : `${resizePct}%`}</span>
            </div>
            <input
              type="range" min={10} max={100} step={5} value={resizePct}
              onChange={(e) => setResizePct(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: "var(--cf-accent)" }}
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
          className="cf-btn cf-btn-primary min-h-10 rounded-2xl px-4 py-2 text-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />Reconvert
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cf-btn cf-btn-secondary min-h-10 rounded-2xl px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
