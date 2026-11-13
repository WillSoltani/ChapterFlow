"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  Focus,
  Headphones,
  NotebookPen,
  Settings,
  Sparkles,
} from "lucide-react";
import type { ChapterTab } from "@/lib/reader-state-types";
import { ReaderStepMenu, stepLabel, type ChapterNeighbours } from "./ReaderChapterNav";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]";
const iconButton = [
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-(--cr-text-secondary) transition-colors",
  "hover:bg-(--cr-bg-surface-3) hover:text-(--cr-text-primary)",
  "aria-pressed:text-(--cr-accent) aria-expanded:text-(--cr-text-primary)",
  focusRing,
].join(" ");

/** Context-aware Back: returns to the dashboard when the reader came from it
 *  (`?from=dashboard` or an in-app dashboard referrer), else to the book. The
 *  origin map is a closed allowlist, so `?from=` can never redirect off-site. */
function useBackLink(bookId: string) {
  const library = `/book/library/${encodeURIComponent(bookId)}`;
  const [back, setBack] = useState({ href: library, label: "Back to book" });
  useEffect(() => {
    const libraryHref = `/book/library/${encodeURIComponent(bookId)}`;
    const dashboard = { href: "/dashboard", label: "Back to dashboard" };
    if (new URLSearchParams(window.location.search).get("from") === "dashboard") {
      setBack(dashboard);
      return;
    }
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === window.location.origin && ref.pathname.startsWith("/dashboard")) {
        setBack(dashboard);
        return;
      }
    } catch {
      /* malformed referrer: keep the book default */
    }
    setBack({ href: libraryHref, label: "Back to book" });
  }, [bookId]);
  return back;
}

/** 0..1 through the current step: page scroll for reading steps, or an
 *  explicit value (the quiz passes answered / total). */
function useStepProgress(
  contentRef: RefObject<HTMLDivElement | null>,
  stepKey: string,
  override: number | null,
) {
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1);
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (contentRef.current && ro) ro.observe(contentRef.current);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
    };
  }, [contentRef, stepKey]);
  return override ?? scrollProgress;
}

type Props = {
  bookId: string;
  chapterOrder: number;
  totalChapters: number;
  chapterTitle: string;
  contentRef: RefObject<HTMLDivElement | null>;
  currentPhase: ChapterTab;
  completedPhases: ReadonlySet<ChapterTab>;
  isPhaseAccessible: (phase: ChapterTab) => boolean;
  getLockMessage: (phase: ChapterTab) => string | null;
  onSelectPhase: (phase: ChapterTab) => void;
  neighbours: ChapterNeighbours;
  /** Explicit step progress 0..1 (quiz); null = follow the page scroll. */
  progressOverride: number | null;
  /** The reader's "show progress bar" setting: hides the hairline when off. */
  showProgress: boolean;
  focusMode: boolean;
  onToggleFocus: () => void;
  audioOpen: boolean;
  onToggleAudio: () => void;
  /** The audio player row, shown under the bar while listening. */
  audioSlot: ReactNode;
  /** A free reader: Listen carries a Pro marker (the row offers Pro). */
  audioProOnly?: boolean | undefined;
  askOpen: boolean;
  onOpenAsk: () => void;
  onOpenNotes: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  /** The reading settings menu, anchored under the settings button. */
  settingsMenu: ReactNode;
  onOpenShortcuts: () => void;
  /** Width of the reading column, so the audio row lines up with the text. */
  columnMaxWidth: string;
};

/** The reader's only chrome: one quiet sticky bar. Back, where you are (opens
 *  the step menu), Listen, Ask, Notes, Reading settings, and a 2px hairline
 *  along its bottom edge that fills as you move through the current step. */
export function ReaderTopBar({
  bookId,
  chapterOrder,
  totalChapters,
  chapterTitle,
  contentRef,
  currentPhase,
  completedPhases,
  isPhaseAccessible,
  getLockMessage,
  onSelectPhase,
  neighbours,
  progressOverride,
  showProgress,
  focusMode,
  onToggleFocus,
  audioOpen,
  onToggleAudio,
  audioSlot,
  audioProOnly = false,
  askOpen,
  onOpenAsk,
  onOpenNotes,
  settingsOpen,
  onToggleSettings,
  settingsMenu,
  onOpenShortcuts,
  columnMaxWidth,
}: Props) {
  const back = useBackLink(bookId);
  const reduced = useReducedMotion();
  const barRef = useRef<HTMLElement>(null);
  const stepTriggerRef = useRef<HTMLButtonElement>(null);
  const [stepMenuOpen, setStepMenuOpen] = useState(false);
  const progress = useStepProgress(contentRef, currentPhase, progressOverride);
  const step = stepLabel(currentPhase);

  // Publish the bar's height: sticky rows and scroll offsets read it.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--cr-header-h", `${el.offsetHeight}px`);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty("--cr-header-h");
    };
  }, []);

  return (
    <header
      ref={barRef}
      className="sticky top-0 z-40 w-full border-b border-(--cr-glass-border) bg-(--cr-bg-root)"
    >
      <div className="flex h-12 items-center gap-0.5 px-1 sm:h-[52px] sm:px-4 md:grid md:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center">
          <Link href={back.href} aria-label={back.label} className={`${iconButton} sm:w-auto sm:gap-1.5 sm:px-3`}>
            <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="hidden text-sm sm:inline">Back</span>
          </Link>
        </div>

        <div className="relative flex min-w-0 flex-1 justify-center">
          <button
            ref={stepTriggerRef}
            type="button"
            onClick={(event) => {
              // Focus the trigger so every menu layer returns focus here.
              event.currentTarget.focus();
              if (!stepMenuOpen && settingsOpen) onToggleSettings();
              setStepMenuOpen((value) => !value);
            }}
            aria-haspopup="dialog"
            aria-expanded={stepMenuOpen}
            aria-label={`Chapter ${chapterOrder}, ${step}. Steps and chapters`}
            className={`inline-flex h-11 min-w-0 max-w-full items-center gap-1 rounded-lg px-2 text-sm text-(--cr-text-primary) transition-colors hover:bg-(--cr-bg-surface-3) ${focusRing}`}
          >
            <span className="truncate">
              {/* 360px: the step alone (the number is in the menu and the
               *  page); phones: "Ch. 4"; wider: "Chapter 4". */}
              <span className="hidden text-(--cr-text-secondary) min-[380px]:inline">
                <span className="sm:hidden">Ch. {chapterOrder}</span>
                <span className="hidden sm:inline">Chapter {chapterOrder}</span>
                <span aria-hidden="true"> · </span>
              </span>
              <span className="font-medium">{step}</span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-(--cr-text-secondary) transition-transform duration-200 motion-reduce:transition-none ${stepMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          <ReaderStepMenu
            open={stepMenuOpen}
            onClose={() => setStepMenuOpen(false)}
            triggerRef={stepTriggerRef}
            chapterOrder={chapterOrder}
            totalChapters={totalChapters}
            chapterTitle={chapterTitle}
            currentPhase={currentPhase}
            completedPhases={completedPhases}
            isPhaseAccessible={isPhaseAccessible}
            getLockMessage={getLockMessage}
            onSelectPhase={onSelectPhase}
            neighbours={neighbours}
            onOpenShortcuts={onOpenShortcuts}
          />
        </div>

        <div className="flex items-center justify-end">
          {focusMode ? (
            <button
              type="button"
              onClick={onToggleFocus}
              aria-pressed="true"
              aria-label="Exit focus mode"
              title="Exit focus mode (F)"
              className={iconButton}
            >
              <Focus className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  onToggleAudio();
                }}
                aria-pressed={audioOpen}
                aria-label={audioProOnly ? "Listen to this chapter (Pro)" : "Listen to this chapter"}
                title={audioProOnly ? "Listen (Pro)" : "Listen"}
                className={`relative ${iconButton}`}
              >
                <Headphones className="h-[18px] w-[18px]" aria-hidden="true" />
                {audioProOnly ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0.5 right-0.5 text-cf-caption font-semibold leading-none text-(--cr-accent)"
                  >
                    Pro
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  onOpenAsk();
                }}
                aria-expanded={askOpen}
                aria-haspopup="dialog"
                aria-label="Ask Raymond about this chapter"
                title="Ask Raymond"
                className={iconButton}
              >
                <Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  onOpenNotes();
                }}
                aria-haspopup="dialog"
                aria-label="Open notes"
                title="Notes (N)"
                className={iconButton}
              >
                <NotebookPen className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  // The settings menu closes on outside mousedown; keep this
                  // button's own mousedown from counting as "outside".
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.currentTarget.focus();
                    setStepMenuOpen(false);
                    onToggleSettings();
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={settingsOpen}
                  aria-label="Reading settings"
                  title="Reading settings"
                  className={iconButton}
                >
                  <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
                {settingsMenu}
              </div>
            </>
          )}
        </div>
      </div>

      {/* One stable slot (the player keeps its state); it renders nothing
       *  until Listen opens it. */}
      <div className="mx-auto px-5 sm:px-8" style={{ maxWidth: columnMaxWidth }}>
        {audioSlot}
      </div>

      {showProgress ? (
        <div
          className="absolute inset-x-0 -bottom-px h-[2px]"
          role="progressbar"
          aria-label={`Progress through ${step}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full origin-left bg-(--cr-accent)"
            style={{
              transform: `scaleX(${progress})`,
              transition: reduced ? "none" : "transform 150ms ease-out",
            }}
          />
        </div>
      ) : null}
    </header>
  );
}
