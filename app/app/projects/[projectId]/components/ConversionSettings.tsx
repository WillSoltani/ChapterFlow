"use client";

import { useMemo } from "react";
import { SlidersHorizontal, Bolt, Sparkles, Mail } from "lucide-react";
import type { OutputFormat, PresetId } from "../_lib/ui-types";

export function ConversionSettings(props: {
  format: OutputFormat;
  allFormats: OutputFormat[];
  enabledFormats: OutputFormat[];
  inputOnlyFormats?: string[];
  recommendedFormats: OutputFormat[];
  onFormat: (f: OutputFormat) => void;
  quality: number;
  onQuality: (q: number) => void;
  preset: PresetId;
  onPreset: (p: PresetId) => void;
  resizePct: number;
  onResizePct: (r: number) => void;
  selectedCount: number;
}) {
  const presets = useMemo(
    () => [
      { id: "web" as const, icon: <Bolt className="h-4 w-4 text-sky-200" />, title: "Web Optimized", sub: "WebP • 80%" },
      { id: "hq" as const, icon: <Sparkles className="h-4 w-4 text-sky-200" />, title: "High Quality", sub: "PNG • 100%" },
      { id: "email" as const, icon: <Mail className="h-4 w-4 text-sky-200" />, title: "Email Friendly", sub: "JPG • 70%" },
    ],
    []
  );

  const displayFormats = useMemo(() => {
    const inputOnly = (props.inputOnlyFormats ?? []).filter(
      (label) => !props.allFormats.includes(label as OutputFormat)
    );
    return [...props.allFormats, ...inputOnly];
  }, [props.allFormats, props.inputOnlyFormats]);
  const canSelectTargets = props.selectedCount > 0;

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/3 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:rounded-[32px] sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <SlidersHorizontal className="h-5 w-5 text-sky-200" />
        </div>
        <div className="text-base font-semibold text-slate-100 sm:text-lg">Conversion Settings</div>
      </div>

      {/* Format picker — uses shared conversion matrix from backend allowlist */}
      <div className="mt-6">
        <div className="text-sm font-semibold text-slate-200">Supported Formats</div>
        {canSelectTargets && props.recommendedFormats.length > 0 ? (
          <div className="mt-2 text-xs text-slate-400">
            Recommended: {props.recommendedFormats.join(", ")}
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3">
          {displayFormats.map((opt) => {
            const outputTarget = props.allFormats.includes(opt as OutputFormat);
            const enabledForSelection =
              outputTarget && props.enabledFormats.includes(opt as OutputFormat);
            const selectable = canSelectTargets && enabledForSelection;
            const active = selectable && opt === props.format;
            const tooltip = !canSelectTargets
              ? "Select a file to choose a target format"
              : !outputTarget
                ? `${opt} is supported as an input format only`
                : !enabledForSelection
                  ? "Not available for this source type"
                  : `Convert to ${opt}`;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => selectable && props.onFormat(opt as OutputFormat)}
                disabled={!selectable}
                title={tooltip}
                className={[
                  "min-h-10 rounded-2xl px-2.5 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm",
                  active
                    ? "bg-sky-600/90 text-white shadow-[0_12px_30px_rgba(2,132,199,0.22)]"
                    : selectable
                      ? "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      : "cursor-not-allowed border border-white/10 bg-white/4 text-slate-500",
                ].join(" ")}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {!canSelectTargets ? (
          <div className="mt-2 text-[11px] text-slate-500">
            Select a file to choose a target format.
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-slate-500">
            Disabled formats are not available for the selected source type.
          </div>
        )}
        {(props.inputOnlyFormats ?? []).length > 0 ? (
          <div className="mt-2 text-[11px] text-slate-500">
            Input-only formats are shown for visibility but cannot be selected as targets.
          </div>
        ) : null}
      </div>

      {/* Quality, Resize, and Presets do not apply to PDF document conversion */}
      {props.format !== "PDF" && (
        <>
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-200">Quality</div>
              <div className="text-sm font-semibold text-slate-100">{props.quality}%</div>
            </div>
            <div className="mt-4">
              <input
                type="range"
                min={1}
                max={100}
                value={props.quality}
                onChange={(e) => props.onQuality(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Smaller file</span>
                <span>Better quality</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-200">Resize</div>
              <div className="text-sm font-semibold text-slate-100">
                {props.resizePct === 100 ? "No resize" : `${props.resizePct}%`}
              </div>
            </div>
            <div className="mt-4">
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={props.resizePct}
                onChange={(e) => props.onResizePct(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Smaller</span>
                <span>Original size</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-200">Quick Presets</div>
            <div className="mt-3 space-y-3">
              {presets.map((p) => {
                const active = props.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => props.onPreset(p.id)}
                    className={[
                      "group w-full rounded-3xl border px-4 py-4 text-left transition",
                      "hover:shadow-[0_18px_55px_rgba(56,189,248,0.14)] hover:bg-white/6",
                      active
                        ? "border-sky-400/25 bg-white/6 ring-1 ring-sky-400/25"
                        : "border-white/10 bg-white/3",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "grid h-10 w-10 place-items-center rounded-2xl border bg-white/5 transition",
                          active ? "border-sky-400/25" : "border-white/10",
                          "group-hover:scale-[1.03]",
                        ].join(" ")}
                      >
                        {p.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100">{p.title}</div>
                        <div className="text-xs text-slate-400">{p.sub}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      <div
        className="
          mt-4
          rounded-xl
          border border-sky-400/20
          bg-sky-400/5
          px-4 py-3
          text-sm
          text-sky-200/90
          backdrop-blur-sm
          shadow-[0_0_0_1px_rgba(56,189,248,0.06)]
        "
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-sky-300">ⓘ</div>
          <div className="leading-relaxed">
            {props.selectedCount > 0
              ? `Settings apply to ${props.selectedCount} selected file${props.selectedCount !== 1 ? "s" : ""}. Per-file format overrides are preserved.`
              : "Select files in the queue to apply these settings."}
          </div>
        </div>
      </div>

    </div>
  );
}
