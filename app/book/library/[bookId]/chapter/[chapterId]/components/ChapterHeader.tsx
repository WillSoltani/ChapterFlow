"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Focus, NotebookPen } from "lucide-react";
import { FontSizeControls } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/FontSizeControls";
import type { FontScale } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import type { LearningMode, ContentTone } from "@/app/book/settings/types/settings";

const MODE_LABELS: Record<LearningMode, { icon: string; label: string }> = {
  guided: { icon: "\uD83C\uDF31", label: "Guided" },
  standard: { icon: "\uD83D\uDCDA", label: "Standard" },
  challenge: { icon: "\uD83C\uDFC6", label: "Challenge" },
};

const TONE_LABELS: Record<ContentTone, { icon: string; label: string }> = {
  gentle: { icon: "\u2615", label: "Gentle" },
  direct: { icon: "\u26A1", label: "Direct" },
  competitive: { icon: "\uD83D\uDD25", label: "Competitive" },
};

type ChapterHeaderProps = {
  bookId: string;
  bookTitle: string;
  chapterLabel: string;
  chapterTitle: string;
  author: string;
  minutes: number;
  chapterOrder: number;
  totalChapters: number;
  focusMode: boolean;
  onToggleFocus: () => void;
  onOpenNotes: () => void;
  fontScale: FontScale;
  onChangeFontScale: (value: FontScale) => void;
  trackedMinutesToday?: number;
  learningMode?: LearningMode;
  onChangeLearningMode?: (mode: LearningMode) => void;
  contentTone?: ContentTone;
  onChangeContentTone?: (tone: ContentTone) => void;
  showProgressBar?: boolean;
  showEstimatedReadingTime?: boolean;
  showReadingSessionTimer?: boolean;
};

export function ChapterHeader({
  bookId,
  bookTitle,
  chapterLabel,
  chapterTitle,
  author,
  minutes,
  chapterOrder,
  totalChapters,
  focusMode,
  onToggleFocus,
  onOpenNotes,
  fontScale,
  onChangeFontScale,
  trackedMinutesToday = 0,
  learningMode = "standard",
  onChangeLearningMode,
  contentTone = "gentle",
  onChangeContentTone,
  showProgressBar = true,
  showEstimatedReadingTime = true,
  showReadingSessionTimer = true,
}: ChapterHeaderProps) {
  const modeInfo = MODE_LABELS[learningMode];
  const toneInfo = TONE_LABELS[contentTone];
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const [toneDropdownOpen, setToneDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toneDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modeDropdownOpen]);

  useEffect(() => {
    if (!toneDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (toneDropdownRef.current && !toneDropdownRef.current.contains(e.target as Node)) {
        setToneDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [toneDropdownOpen]);
  return (
    <header className="space-y-4">
      {/* Breadcrumb row */}
      <div className="flex flex-col gap-3 border-b border-(--cr-glass-border) pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Link
            href={`/book/library/${encodeURIComponent(bookId)}`}
            className="inline-flex items-center gap-1 rounded-lg border border-(--cr-glass-border) bg-(--cr-glass-nav) px-2.5 py-1 text-(--cr-text-secondary) transition hover:bg-(--cr-accent-muted) hover:text-(--cr-text-primary)"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <span className="text-(--cr-text-disabled)">/</span>
          <span className="hidden truncate text-(--cr-text-secondary) sm:inline">
            {bookTitle}
          </span>
          <span className="hidden text-(--cr-text-disabled) sm:inline">/</span>
          <span className="truncate text-(--cr-text-primary)">
            {chapterLabel}
          </span>

          {/* Chapter position dots */}
          {showProgressBar && (
            <div className="ml-2 hidden items-center gap-1 sm:flex">
              {Array.from({ length: Math.min(totalChapters, 20) }, (_, i) => (
                <div
                  key={i}
                  className={[
                    "h-1.5 w-1.5 rounded-full transition-colors",
                    i + 1 === chapterOrder
                      ? "bg-(--cr-accent)"
                      : i + 1 < chapterOrder
                        ? "bg-(--cr-accent)/40"
                        : "bg-(--cr-fill-muted)",
                  ].join(" ")}
                />
              ))}
              <span className="ml-1 text-xs text-(--cr-text-disabled)">
                {chapterOrder}/{totalChapters}
              </span>
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* Learning mode indicator + dropdown */}
          {!focusMode && (
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setModeDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full border border-(--cr-glass-border) bg-(--cr-glass-nav) px-3 py-1 text-xs text-(--cr-text-secondary) transition hover:border-(--cr-accent)/30 hover:text-(--cr-text-primary)"
                aria-expanded={modeDropdownOpen}
                aria-haspopup="true"
              >
                <span>{modeInfo.icon}</span>
                <span className="hidden sm:inline">{modeInfo.label}</span>
                <ChevronDown className={["h-3 w-3 opacity-50 transition-transform", modeDropdownOpen ? "rotate-180" : ""].join(" ")} />
              </button>

              {modeDropdownOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-(--cr-text-disabled)">
                    Learning Mode
                  </p>
                  {(["guided", "standard", "challenge"] as const).map((mode) => {
                    const info = MODE_LABELS[mode];
                    const active = mode === learningMode;
                    const descriptions: Record<LearningMode, string> = {
                      guided: "Relaxed, hints on quiz",
                      standard: "Balanced, 1 retry",
                      challenge: "Timed, no retries, 90% pass",
                    };
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          onChangeLearningMode?.(mode);
                          setModeDropdownOpen(false);
                        }}
                        className={[
                          "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition",
                          active
                            ? "bg-(--cr-accent-muted) text-(--cr-accent)"
                            : "text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-3)",
                        ].join(" ")}
                      >
                        <span className="mt-0.5 text-sm">{info.icon}</span>
                        <div>
                          <p className={["text-xs font-semibold", active ? "text-(--cr-accent)" : "text-(--cr-text-primary)"].join(" ")}>
                            {info.label}
                            {mode === "standard" && (
                              <span className="ml-1.5 rounded-full bg-(--cr-accent-muted) px-1.5 py-0.5 text-[9px] font-bold text-(--cr-accent)">
                                REC
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-(--cr-text-disabled)">{descriptions[mode]}</p>
                        </div>
                      </button>
                    );
                  })}
                  <p className="mt-2 border-t border-(--cr-glass-border) pt-2 text-[10px] text-(--cr-text-disabled)">
                    Mode affects quiz rules. <Link href="/book/settings" className="text-(--cr-accent) hover:underline">Full details</Link>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Content tone dropdown */}
          {!focusMode && (
            <div ref={toneDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setToneDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full border border-(--cr-glass-border) bg-(--cr-glass-nav) px-3 py-1 text-xs text-(--cr-text-secondary) transition hover:border-(--cr-accent)/30 hover:text-(--cr-text-primary)"
                aria-expanded={toneDropdownOpen}
                aria-haspopup="true"
              >
                <span>{toneInfo.icon}</span>
                <span className="hidden sm:inline">{toneInfo.label}</span>
                <ChevronDown className={["h-3 w-3 opacity-50 transition-transform", toneDropdownOpen ? "rotate-180" : ""].join(" ")} />
              </button>

              {toneDropdownOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-(--cr-text-disabled)">
                    Content Tone
                  </p>
                  {(["gentle", "direct", "competitive"] as const).map((tone) => {
                    const info = TONE_LABELS[tone];
                    const active = tone === contentTone;
                    const descriptions: Record<string, string> = {
                      gentle: "Warm, curious, invitational",
                      direct: "Clean, efficient, with a slight edge",
                      competitive: "Energizing, challenge-driven",
                    };
                    return (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => {
                          onChangeContentTone?.(tone);
                          setToneDropdownOpen(false);
                        }}
                        className={[
                          "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition",
                          active
                            ? "bg-(--cr-accent-muted) text-(--cr-accent)"
                            : "text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-3)",
                        ].join(" ")}
                      >
                        <span className="mt-0.5 text-sm">{info.icon}</span>
                        <div>
                          <p className={["text-xs font-semibold", active ? "text-(--cr-accent)" : "text-(--cr-text-primary)"].join(" ")}>
                            {info.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-(--cr-text-disabled)">{descriptions[tone]}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleFocus}
            className={[
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition",
              focusMode
                ? "border-(--cr-accent) bg-(--cr-accent-muted) text-(--cr-accent)"
                : "border-(--cr-glass-border) bg-(--cr-glass-nav) text-(--cr-text-secondary) hover:text-(--cr-text-primary)",
            ].join(" ")}
          >
            <Focus className="h-3.5 w-3.5" />
            Focus
          </button>
          <button
            type="button"
            onClick={onOpenNotes}
            className="inline-flex items-center gap-1.5 rounded-xl border border-(--cr-warning)/30 bg-(--cr-warning)/10 px-3 py-1.5 text-xs font-medium text-(--cr-warning) transition hover:bg-(--cr-warning)/15"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Notes
          </button>
          <FontSizeControls value={fontScale} onChange={onChangeFontScale} />
        </div>
      </div>

      {/* Title block */}
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-(--cr-accent)">
          {bookTitle} &middot; {author}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-(--cr-text-heading) sm:text-4xl">
          {chapterLabel}: {chapterTitle}
        </h1>
        {(showEstimatedReadingTime || showReadingSessionTimer) && (
          <p className="mt-1.5 text-sm text-(--cr-text-secondary)">
            {showEstimatedReadingTime && <>Est. {minutes} min read</>}
            {showReadingSessionTimer && trackedMinutesToday > 0 && (
              <>{showEstimatedReadingTime ? " \u00b7 " : ""}{trackedMinutesToday} min tracked today</>
            )}
          </p>
        )}
      </div>
    </header>
  );
}
