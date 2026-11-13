"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { DUR, EASE } from "@/lib/motion";
import { Sheet } from "@/components/ui/Dialog";
import type { ChapterTab } from "@/lib/reader-state-types";

/** A neighbouring chapter, ready to link to (href built with
 *  buildNextChapterRoute, the same helper the completion modal uses). */
export type ChapterNavLink = {
  order: number;
  title: string;
  href: string;
  locked: boolean;
};

export type ChapterNeighbours = {
  prev: ChapterNavLink | null;
  next: ChapterNavLink | null;
};

export const READER_STEPS: ReadonlyArray<{ id: ChapterTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "examples", label: "Examples" },
  { id: "quiz", label: "Quiz" },
];

export function stepLabel(tab: ChapterTab): string {
  return READER_STEPS.find((step) => step.id === tab)?.label ?? "Quiz";
}

const NEXT_LOCKED_REASON = "Opens once you pass this chapter's quiz";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]";

/** True while a modal dialog (notes, shortcuts, Ask, a sheet) is open and
 *  `panel` is not inside it: that dialog owns Escape, so one press closes
 *  only the top-most layer. */
export function modalOpenAbove(panel: Element | null): boolean {
  return Array.from(document.querySelectorAll('[aria-modal="true"]')).some(
    (modal) => !panel || !modal.contains(panel),
  );
}

// Matches Tailwind's `sm` breakpoint, like ReaderSettingsMenu: below it the
// chapter menu is a bottom sheet, above it a small popover.
const PHONE_QUERY = "(max-width: 639.98px)";

function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(PHONE_QUERY);
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  return isPhone;
}

type StepMenuProps = {
  open: boolean;
  onClose: () => void;
  /** The trigger: clicks on it are not "outside" clicks. */
  triggerRef: RefObject<HTMLElement | null>;
  chapterOrder: number;
  totalChapters: number;
  chapterTitle: string;
  currentPhase: ChapterTab;
  completedPhases: ReadonlySet<ChapterTab>;
  isPhaseAccessible: (phase: ChapterTab) => boolean;
  getLockMessage: (phase: ChapterTab) => string | null;
  onSelectPhase: (phase: ChapterTab) => void;
  neighbours: ChapterNeighbours;
  onOpenShortcuts?: (() => void) | undefined;
};

/** Where-am-I menu opened from the top bar's middle control: the three steps
 *  (locked ones dimmed, with the reason) and the neighbouring chapters. */
export function ReaderStepMenu(props: StepMenuProps) {
  const isPhone = useIsPhone();
  if (isPhone) {
    return (
      <Sheet open={props.open} onClose={props.onClose} ariaLabel="Chapter steps">
        <div className="flex justify-center pt-3" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-(--cr-glass-border)" />
        </div>
        <StepMenuBody {...props} />
      </Sheet>
    );
  }
  return <StepPopover {...props} />;
}

function StepPopover(props: StepMenuProps) {
  const { open, onClose, triggerRef } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !modalOpenAbove(panelRef.current)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, triggerRef]);

  // Non-modal: focus moves in on open and back to the trigger on close (the
  // trigger itself, since a tap does not focus a button in every browser),
  // unless focus has already moved on to another control.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("[aria-current='step'], button:not([disabled]), a[href]")
        ?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      const active = document.activeElement;
      const focusStayed =
        !active || active === document.body || Boolean(panelRef.current?.contains(active));
      if (focusStayed) triggerRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, triggerRef]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label="Chapter steps"
          className="absolute left-1/2 top-full z-50 mt-2 w-[24rem] -translate-x-1/2 rounded-2xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) shadow-shadow-elevated"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduced ? 0 : DUR.fast, ease: EASE.standard }}
        >
          <StepMenuBody {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StepMenuBody({
  onClose,
  chapterOrder,
  totalChapters,
  chapterTitle,
  currentPhase,
  completedPhases,
  isPhaseAccessible,
  getLockMessage,
  onSelectPhase,
  neighbours,
  onOpenShortcuts,
}: StepMenuProps) {
  return (
    <div className="px-2 pb-3 pt-3 text-(--cr-text-primary)">
      <div className="px-3 pb-3">
        <p className="text-cf-caption text-(--cr-text-secondary)">
          Chapter {chapterOrder} of {totalChapters}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-(--cr-text-heading)">{chapterTitle}</p>
      </div>

      <ol className="space-y-0.5" aria-label="Steps in this chapter">
        {READER_STEPS.map((step, index) => {
          const current = step.id === currentPhase;
          const done = completedPhases.has(step.id) && !current;
          const accessible = current || isPhaseAccessible(step.id);
          const reason = accessible ? null : getLockMessage(step.id);
          const status = current ? "You are here" : done ? "Done" : reason ?? "Ready";
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                aria-disabled={!accessible}
                aria-label={`${step.label}. ${status}`}
                onClick={() => {
                  if (!accessible) return;
                  onClose();
                  if (!current) onSelectPhase(step.id);
                }}
                className={[
                  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                  focusRing,
                  accessible ? "hover:bg-(--cr-bg-surface-3)" : "cursor-default",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-cf-caption font-semibold tabular-nums",
                    current
                      ? "bg-(--cr-accent) text-(--cr-text-inverse)"
                      : done
                        ? "text-(--cr-accent)"
                        : "border border-(--cr-glass-border) text-(--cr-text-secondary)",
                  ].join(" ")}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : !accessible ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      "block text-sm",
                      current
                        ? "font-semibold text-(--cr-text-heading)"
                        : accessible
                          ? "text-(--cr-text-primary)"
                          : "text-(--cr-text-secondary)",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                  <span className="block text-cf-caption text-(--cr-text-secondary)">{status}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mx-3 my-2 border-t border-(--cr-glass-border)" />

      <div className="space-y-0.5">
        <NeighbourRow direction="prev" link={neighbours.prev} onNavigate={onClose} />
        <NeighbourRow direction="next" link={neighbours.next} onNavigate={onClose} />
      </div>

      {onOpenShortcuts ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenShortcuts();
          }}
          className={`mx-1 mt-1 hidden min-h-11 items-center gap-2 rounded-xl px-3 text-cf-caption text-(--cr-text-secondary) hover:text-(--cr-text-primary) sm:flex ${focusRing}`}
        >
          Keyboard shortcuts
          <kbd className="rounded border border-(--cr-glass-border) px-1.5 font-mono text-cf-caption">?</kbd>
        </button>
      ) : null}
    </div>
  );
}

function NeighbourRow({
  direction,
  link,
  onNavigate,
}: {
  direction: "prev" | "next";
  link: ChapterNavLink | null;
  onNavigate: () => void;
}) {
  const label = direction === "prev" ? "Previous chapter" : "Next chapter";
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const icon = (
    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center text-(--cr-text-secondary)">
      {link?.locked ? <Lock className="h-3.5 w-3.5" /> : <Icon className="h-4 w-4" />}
    </span>
  );
  const text = (detail: string, muted: boolean, note?: string) => (
    <span className="min-w-0 flex-1">
      <span className={`block text-sm ${muted ? "text-(--cr-text-secondary)" : "text-(--cr-text-primary)"}`}>
        {label}
      </span>
      <span className="block truncate text-cf-caption text-(--cr-text-secondary)">{detail}</span>
      {note ? <span className="block text-cf-caption text-(--cr-text-secondary)">{note}</span> : null}
    </span>
  );
  const rowClass = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left";

  if (!link) {
    return (
      <div className={rowClass} aria-disabled="true">
        {icon}
        {text(direction === "prev" ? "This is the first chapter" : "This is the last chapter", true)}
      </div>
    );
  }
  if (link.locked) {
    return (
      <div className={rowClass} aria-disabled="true">
        {icon}
        {text(`${link.order}. ${link.title}`, true, NEXT_LOCKED_REASON)}
      </div>
    );
  }
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={`${rowClass} transition-colors hover:bg-(--cr-bg-surface-3) ${focusRing}`}
    >
      {icon}
      {text(`${link.order}. ${link.title}`, false)}
    </Link>
  );
}

/** The quiet row under the end-of-step button: Previous / Next chapter. */
export function ChapterPager({ neighbours }: { neighbours: ChapterNeighbours }) {
  const { prev, next } = neighbours;
  if (!prev && !next) return null;
  const linkClass = `inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-cf-label-sm text-(--cr-text-secondary) transition-colors hover:text-(--cr-text-primary) ${focusRing}`;
  return (
    <nav aria-label="Chapters" className="mt-6 flex items-start justify-between gap-4">
      {prev ? (
        <Link href={prev.href} className={`${linkClass} -ml-2`}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>Chapter {prev.order}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        next.locked ? (
          <span className="flex flex-col items-end gap-0.5 py-3 text-right text-cf-label-sm text-(--cr-text-secondary)">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Chapter {next.order}
            </span>
            <span className="text-cf-caption">{NEXT_LOCKED_REASON}</span>
          </span>
        ) : (
          <Link href={next.href} className={`${linkClass} -mr-2`}>
            <span>Chapter {next.order}</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )
      ) : null}
    </nav>
  );
}
