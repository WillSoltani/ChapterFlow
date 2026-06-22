"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { DUR } from "@/lib/motion";
import { useBodyScrollLock } from "@/components/ui/use-body-scroll-lock";

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"]),iframe,object,embed,[contenteditable="true"],audio[controls],video[controls]';

// Base z-index for the first overlay; each nested overlay renders 10 above the
// previous one so a child overlay always paints over its parent.
const OVERLAY_BASE_Z = 100;

/**
 * Module-level stack of currently-open overlay ids. Because every OverlayShell
 * attaches its Escape / focus-trap handlers to `document`, two open overlays
 * would otherwise both react to a single keypress (Escape closing both, focus
 * traps fighting). The stack lets each handler cheaply check whether it is the
 * topmost overlay and no-op otherwise. Insertion order = visual stacking order.
 */
const overlayStack: string[] = [];
let overlaySeq = 0;

interface BaseOverlayProps {
  open: boolean;
  onClose: () => void;
  /** id of the element labelling the dialog (e.g. its <h2 id>). */
  labelledBy?: string;
  /** Accessible label when there is no visible title to point at. */
  ariaLabel?: string;
  /** Element to focus when the overlay opens. Falls back to the first focusable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Clicking the backdrop closes (default true). */
  closeOnBackdrop?: boolean;
  /** Escape closes (default true). */
  closeOnEscape?: boolean;
  className?: string;
  children: ReactNode;
}

interface OverlayShellProps extends BaseOverlayProps {
  layout: "center" | "bottom";
  panelClassName: string;
  /** Edge-to-edge: drop the centered/padded container so the panel fills the viewport. */
  fullBleed?: boolean;
}

/**
 * Internal overlay engine shared by Dialog and Sheet. Implements the full
 * overlay standard: portal to <body>, role=dialog + aria-modal, focus trap,
 * initial focus + focus restore on close, Escape, backdrop-click close, body
 * scroll lock, and CONDITIONAL render (the panel only exists in the DOM while
 * open / exiting — never an always-mounted aria-modal hidden by transform).
 * Reduced motion is honored via framer's useReducedMotion(), which
 * MotionProvider wires to the OS setting AND the in-app reduce-motion toggle.
 */
function OverlayShell({
  open,
  onClose,
  labelledBy,
  ariaLabel,
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = "",
  layout,
  panelClassName,
  fullBleed = false,
  children,
}: OverlayShellProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  // Stable per-instance id used to track this overlay's place in the stack.
  const overlayIdRef = useRef<string | null>(null);
  if (overlayIdRef.current == null) overlayIdRef.current = `overlay-${++overlaySeq}`;
  // Depth (and thus z-index) of this overlay among the currently-open ones; -1
  // until it has registered in the shared stack.
  const [stackIndex, setStackIndex] = useState(-1);

  useEffect(() => setMounted(true), []);

  // Register this overlay in the shared stack while open, and remove it on close
  // /unmount. Only the topmost overlay handles Escape and runs the Tab focus
  // trap; the keyboard handlers read the live stack at event time (see
  // isTopmost), so they never re-subscribe when the top changes — they just
  // no-op while another overlay is above them. The depth is surfaced into render
  // state so a nested overlay's z-index paints it above its parent.
  useEffect(() => {
    // The ref is always initialized by the time effects run (set during render).
    const id = overlayIdRef.current;
    if (!open || id == null) return;
    overlayStack.push(id);
    setStackIndex(overlayStack.length - 1);
    return () => {
      const i = overlayStack.lastIndexOf(id);
      if (i !== -1) overlayStack.splice(i, 1);
    };
  }, [open]);

  // True when this overlay is the topmost open one (and thus owns keyboard
  // behavior). Read at event time so a child opening/closing flips ownership
  // without re-binding any document listeners.
  const isTopmost = () => overlayStack[overlayStack.length - 1] === overlayIdRef.current;

  // Body scroll lock (with scrollbar-gutter compensation to avoid layout shift).
  // Shared ref-counted lock so stacked overlays (e.g. NotesDrawer's Sheet +
  // AskBookDrawer) compose without corrupting body.style on out-of-order close.
  useBodyScrollLock(open);

  // Escape to close. Only the topmost overlay reacts: e.stopPropagation() does
  // NOT stop sibling document-level listeners, so without the stack check every
  // open overlay would close on a single Escape.
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopmost()) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  // Initial focus + focus trap + focus restore on close. Keyed on [open] ONLY:
  // the opener is captured per open-cycle as a local (not a persisted ref), so
  // a changing initialFocusRef identity can't trigger a premature restore +
  // re-capture. initialFocusRef is a ref, intentionally read inside (not a dep).
  useEffect(() => {
    if (!open) return;
    const opener = (document.activeElement as HTMLElement) ?? null;

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      const target =
        initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target?.focus();
    }, 0);

    // Visible-element test that also keeps position:fixed focusables (whose
    // offsetParent is null) inside the trap.
    const isVisible = (el: HTMLElement) =>
      el.getClientRects().length > 0 || el === document.activeElement;

    const onKeyDown = (e: KeyboardEvent) => {
      // Only the topmost overlay traps focus; otherwise two traps fight over
      // which panel keeps focus.
      if (e.key !== "Tab" || !isTopmost()) return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.(); // restore focus to whatever had it before opening
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  const backdropTransition = prefersReduced ? { duration: 0 } : { duration: DUR.fast };
  const panelTransition = prefersReduced
    ? { duration: 0 }
    : layout === "bottom"
      ? { type: "spring" as const, damping: 30, stiffness: 320 }
      : { duration: DUR.fast, ease: [0.25, 0.1, 0.25, 1] as const };
  const panelMotion =
    layout === "bottom"
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
      : {
          initial: { opacity: 0, scale: 0.96, y: 8 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: 8 },
        };

  const containerAlign = fullBleed
    ? ""
    : layout === "bottom"
      ? "items-end justify-center"
      : "items-center justify-center p-4";

  // Derive z-index from stack depth so a nested overlay paints above its parent.
  // Falls back to the base before this instance has registered (stackIndex < 0).
  const zIndex = OVERLAY_BASE_Z + Math.max(stackIndex, 0) * 10;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 flex ${containerAlign}`}
          style={{ zIndex }}
          onClick={(e) => {
            if (closeOnBackdrop && e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-(--cf-overlay) backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : ariaLabel}
            tabIndex={-1}
            className={`relative border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-1) outline-none ${panelClassName} ${className}`}
            style={{ boxShadow: "var(--shadow-modal)" }}
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={panelTransition}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const DIALOG_SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  fullscreen: "h-[100dvh] max-w-none rounded-none",
} as const;

export type DialogSize = keyof typeof DIALOG_SIZES;

export interface DialogProps extends BaseOverlayProps {
  /** Width preset (centered modal). "fullscreen" fills the viewport. */
  size?: DialogSize;
}

/**
 * Centered modal dialog. Usage:
 *   <Dialog open={open} onClose={close} labelledBy="dlg-title" initialFocusRef={ref}>
 *     <h2 id="dlg-title">…</h2> …
 *   </Dialog>
 */
export function Dialog({ size = "md", className, ...base }: DialogProps) {
  const isFullscreen = size === "fullscreen";
  const rounded = isFullscreen ? "" : "rounded-2xl";
  // Fullscreen is a true edge-to-edge surface (no 90dvh cap, no padded centering
  // container — see fullBleed); every other size stays a centered, capped card.
  const panelClassName = isFullscreen
    ? `w-full ${DIALOG_SIZES.fullscreen} overflow-y-auto`
    : `w-full ${DIALOG_SIZES[size]} ${rounded} max-h-[90dvh] overflow-y-auto`;
  return (
    <OverlayShell
      {...base}
      layout="center"
      className={className}
      panelClassName={panelClassName}
      fullBleed={isFullscreen}
    />
  );
}

export type SheetProps = BaseOverlayProps;

/**
 * Bottom sheet — mobile-first overlay that slides up from the bottom edge.
 * dvh-safe height, scrollable body, and pb-safe so content clears the iOS home
 * indicator / keyboard. Same a11y + behavior contract as Dialog.
 */
export function Sheet({ className, ...base }: SheetProps) {
  return (
    <OverlayShell
      {...base}
      layout="bottom"
      className={className}
      panelClassName="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-safe"
    />
  );
}

export default Dialog;
