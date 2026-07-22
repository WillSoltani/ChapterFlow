"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/motion";
import {
  ArrowLeft,
  Focus,
  HelpCircle,
  NotebookPen,
  Settings,
} from "lucide-react";
import type { LearningMode, FontFamily } from "@/app/book/settings/types/settings";
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import { useInsightPoints } from "@/app/book/hooks/useInsightPoints";
import { ReaderSettingsMenu, type LineSpacingPref } from "./ReaderSettingsMenu";

const MODE_LABELS: Record<LearningMode, { icon: string; label: string }> = {
  guided: { icon: "\uD83C\uDF31", label: "Guided" },
  standard: { icon: "\uD83D\uDCDA", label: "Standard" },
  challenge: { icon: "\uD83C\uDFC6", label: "Challenge" },
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
  trackedMinutesToday?: number;
  learningMode?: LearningMode;
  onChangeLearningMode?: (mode: LearningMode) => void;
  showProgressBar?: boolean;
  showEstimatedReadingTime?: boolean;
  showReadingSessionTimer?: boolean;
  readingDepth?: ReadingDepth;
  onChangeReadingDepth?: (value: ReadingDepth) => void;
  showDepthSelector?: boolean;
  onOpenShortcuts?: () => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  fontSize: number;
  onChangeFontSize: (px: number) => void;
  lineSpacing: LineSpacingPref;
  onChangeLineSpacing: (value: LineSpacingPref) => void;
  contentWidth: number;
  onChangeContentWidth: (px: number) => void;
  // NS-2 typeface, threaded straight through to ReaderSettingsMenu. Optional so
  // the single prefs instance can be wired in by the parent (ChapterReaderClient,
  // batch-05 handoff) without this file taking a second useBookPreferences
  // instance (which would full-state-clobber other reading prefs).
  fontFamily?: FontFamily;
  onChangeFontFamily?: (value: FontFamily) => void;
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
  trackedMinutesToday: _trackedMinutesToday = 0,
  learningMode = "standard",
  onChangeLearningMode,
  showProgressBar: _showProgressBar = true,
  showEstimatedReadingTime = true,
  showReadingSessionTimer: _showReadingSessionTimer = true,
  readingDepth,
  onChangeReadingDepth,
  showDepthSelector = false,
  onOpenShortcuts,
  settingsOpen,
  onSettingsOpenChange,
  fontSize,
  onChangeFontSize,
  lineSpacing,
  onChangeLineSpacing,
  contentWidth,
  onChangeContentWidth,
  fontFamily,
  onChangeFontFamily,
}: ChapterHeaderProps) {
  void _trackedMinutesToday;
  void _showProgressBar;
  void _showReadingSessionTimer;
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const ipState = useInsightPoints(isDesktop);
  const ipBalance = ipState.payload?.summary.balance ?? null;
  const reduced = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const settingsAnchorRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Context-aware Back (finding #23). A back affordance must return to where the
  // reader came from, not always book-detail. We read the entry origin client-
  // side (no useSearchParams -> no Suspense boundary / dynamic-render cost) from
  // a `?from=` param (producer: HeroSessionCard, batch-07 handoff) and fall back
  // to the in-app referrer. The origin map is a CLOSED allowlist, so an attacker
  // putting `?from=https://evil` can never redirect Back off-site.
  const libraryHref = `/book/library/${encodeURIComponent(bookId)}`;
  const [backHref, setBackHref] = useState(libraryHref);
  const [backLabel, setBackLabel] = useState<"Back to library" | "Back to dashboard">(
    "Back to library",
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const library = `/book/library/${encodeURIComponent(bookId)}`;
    const ORIGINS: Record<string, { href: string; label: "Back to dashboard" }> = {
      dashboard: { href: "/dashboard", label: "Back to dashboard" },
    };
    const from = new URLSearchParams(window.location.search).get("from");
    if (from && ORIGINS[from]) {
      setBackHref(ORIGINS[from].href);
      setBackLabel(ORIGINS[from].label);
      return;
    }
    // No explicit origin: honor an in-app dashboard referrer, else library.
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === window.location.origin && ref.pathname.startsWith("/dashboard")) {
        setBackHref("/dashboard");
        setBackLabel("Back to dashboard");
        return;
      }
    } catch {
      /* malformed referrer — fall through to the library default */
    }
    setBackHref(library);
    setBackLabel("Back to library");
  }, [bookId]);

  // Publish header height as a CSS var so child sticky rows can offset themselves.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const update = () => {
      const stickyChild = el.querySelector<HTMLElement>(":scope > div");
      const h = stickyChild?.offsetHeight ?? el.offsetHeight;
      root.style.setProperty("--cr-header-h", `${h}px`);
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => {
      ro.disconnect();
      root.style.removeProperty("--cr-header-h");
    };
  }, [focusMode]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      const el = document.documentElement;
      const sc = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setReadProgress(total > 0 ? Math.min(100, (sc / total) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const stickyStyle: React.CSSProperties = {
    background:
      "color-mix(in srgb, var(--cr-bg-root) 88%, transparent)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderBottom: scrolled
      ? "1px solid var(--cr-glass-border)"
      : "1px solid transparent",
    transition: "border-color 0.2s",
  };

  const ipPill = ipBalance != null && (
    <Link
      href="/rewards"
      className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-cf-label-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]"
      style={{
        background: "color-mix(in srgb, var(--cr-accent) 10%, transparent)",
        color: "var(--cr-accent)",
        border: "1px solid color-mix(in srgb, var(--cr-accent) 25%, transparent)",
      }}
      aria-label={`${ipBalance} insight points — view rewards`}
    >
      <span>{"\u2728"}</span>
      {reduced ? (
        <span>{ipBalance.toLocaleString()} IP</span>
      ) : (
        <motion.span
          key={ipBalance}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          transition={{ duration: DUR.slow }}
        >
          {ipBalance.toLocaleString()} IP
        </motion.span>
      )}
    </Link>
  );

  // ── Focus mode header (minimal chrome) ──
  if (focusMode) {
    return (
      <header
        ref={headerRef}
        className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6"
        style={stickyStyle}
      >
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref}
              className="min-h-11 min-w-11 inline-flex items-center justify-center gap-1 rounded-lg p-1.5 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-3) hover:text-(--cr-text-primary)"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="truncate text-sm font-semibold text-(--cr-text-heading) font-(family-name:--font-display)">
              {chapterLabel}: {chapterTitle}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            {ipPill}
            <button
              type="button"
              onClick={onToggleFocus}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition"
              style={{
                borderColor: "var(--cr-accent)",
                background: "var(--cr-accent-muted)",
                color: "var(--cr-accent)",
              }}
              title="Exit focus mode (F)"
              aria-label="Exit focus mode"
            >
              <Focus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Focus</span>
            </button>
          </div>
        </div>
        <ScrollProgressBar value={readProgress} />
      </header>
    );
  }

  // ── Default header: minimal sticky chrome ──
  return (
    <header
      className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6"
      style={stickyStyle}
    >
      <div className="flex items-center justify-between gap-3 py-3">
        {/* Left: back + chapter label */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={backHref}
            className="min-h-11 min-w-11 inline-flex items-center justify-center gap-1.5 rounded-lg p-1.5 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-3) hover:text-(--cr-text-primary)"
            aria-label={backLabel}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-sm font-medium">Back</span>
          </Link>
          <span className="hidden sm:inline-block h-4 w-px bg-(--cr-glass-border)" aria-hidden="true" />
          <h2 className="hidden sm:block min-w-0 truncate text-sm font-semibold text-(--cr-text-primary)">
            {chapterLabel}
          </h2>
          <span
            className="hidden sm:inline text-cf-caption tabular-nums text-(--cr-text-disabled)"
          >
            {chapterOrder} / {totalChapters}
          </span>
        </div>

        {/* Right: minimal action cluster */}
        <div className="flex items-center gap-1.5">
          {ipPill}
          <div ref={settingsAnchorRef} className="relative">
            <button
              type="button"
              onClick={() => onSettingsOpenChange(!settingsOpen)}
              className="min-h-11 min-w-11 inline-flex items-center justify-center gap-1.5 rounded-lg p-2 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-3) hover:text-(--cr-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_50%,transparent)]"
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
              aria-label="Reading settings"
              title="Reading settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <ReaderSettingsMenu
              open={settingsOpen}
              onClose={() => onSettingsOpenChange(false)}
              learningMode={learningMode}
              onChangeLearningMode={(m) => {
                onChangeLearningMode?.(m);
              }}
              showDepthSelector={showDepthSelector}
              readingDepth={readingDepth}
              onChangeReadingDepth={onChangeReadingDepth}
              focusMode={focusMode}
              onToggleFocus={onToggleFocus}
              fontSize={fontSize}
              onChangeFontSize={onChangeFontSize}
              lineSpacing={lineSpacing}
              onChangeLineSpacing={onChangeLineSpacing}
              contentWidth={contentWidth}
              onChangeContentWidth={onChangeContentWidth}
              fontFamily={fontFamily}
              onChangeFontFamily={onChangeFontFamily}
            />
          </div>
          <button
            type="button"
            onClick={onOpenNotes}
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg p-2 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-3) hover:text-(--cr-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_50%,transparent)]"
            aria-label="Open notes"
            title="Notes (N)"
          >
            <NotebookPen className="h-4 w-4" />
          </button>
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="hidden md:inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-3) hover:text-(--cr-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_50%,transparent)]"
              aria-label="Show keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <ScrollProgressBar value={readProgress} />

      {/* Title block — lives outside the sticky chrome row, scrolls with content */}
      <TitleBlock
        bookTitle={bookTitle}
        author={author}
        chapterLabel={chapterLabel}
        chapterTitle={chapterTitle}
        chapterOrder={chapterOrder}
        totalChapters={totalChapters}
        minutes={minutes}
        learningMode={learningMode}
        showEstimatedReadingTime={showEstimatedReadingTime}
      />
    </header>
  );
}

function ScrollProgressBar({ value }: { value: number }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-0.5"
      style={{ background: "var(--cr-glass-border)" }}
      aria-hidden="true"
    >
      <div
        className="h-full"
        style={{
          width: `${value}%`,
          background: "var(--cr-accent)",
        }}
      />
    </div>
  );
}

function TitleBlock({
  bookTitle,
  author,
  chapterLabel,
  chapterTitle,
  chapterOrder,
  totalChapters,
  minutes,
  learningMode,
  showEstimatedReadingTime,
}: {
  bookTitle: string;
  author: string;
  chapterLabel: string;
  chapterTitle: string;
  chapterOrder: number;
  totalChapters: number;
  minutes: number;
  learningMode: LearningMode;
  showEstimatedReadingTime: boolean;
}) {
  const modeLabel = MODE_LABELS[learningMode]?.label ?? "Standard";
  return (
    <div className="pt-6 pb-2 sm:pt-8">
      <p className="text-cf-caption font-bold uppercase tracking-[0.16em] text-(--cr-accent)">
        {bookTitle} &middot; {author}
      </p>
      <h1
        className="mt-2 text-[28px] sm:text-4xl font-bold tracking-tight text-(--cr-text-heading) leading-[1.15] font-(family-name:--font-display)"
      >
        {chapterLabel}: {chapterTitle}
      </h1>
      {/* Compact metadata line. "Chapter X of Y" lived here historically but
       * the nav row above already shows "Chapter 2 / 8", so the second copy
       * was redundant. Mode label only renders in non-standard modes since
       * Standard is the default and saying so adds no information. */}
      <p className="mt-2 text-cf-caption text-(--cr-text-disabled) flex flex-wrap items-center gap-x-2 gap-y-1">
        {showEstimatedReadingTime && <span>{minutes} min read</span>}
        {showEstimatedReadingTime && learningMode !== "standard" && (
          <span aria-hidden="true">&middot;</span>
        )}
        {learningMode !== "standard" && <span>{modeLabel} mode</span>}
      </p>
      <div
        className="mt-3 sm:hidden h-0.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--cr-glass-border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.round((chapterOrder / totalChapters) * 100)}%`,
            background: "var(--cr-accent)",
          }}
        />
      </div>
    </div>
  );
}
