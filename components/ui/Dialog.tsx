"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"]),iframe,object,embed,[contenteditable="true"],audio[controls],video[controls]';

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
  children,
}: OverlayShellProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => setMounted(true), []);

  // Body scroll lock (with scrollbar-gutter compensation to avoid layout shift).
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  // Initial focus + focus trap + focus restore on close.
  useEffect(() => {
    if (!open) return;
    previousFocus.current = (document.activeElement as HTMLElement) ?? null;

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      const target =
        initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
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
      // Restore focus to whatever had it before the overlay opened.
      previousFocus.current?.focus?.();
    };
  }, [open, initialFocusRef]);

  if (!mounted) return null;

  const backdropTransition = prefersReduced ? { duration: 0 } : { duration: 0.2 };
  const panelTransition = prefersReduced
    ? { duration: 0 }
    : layout === "bottom"
      ? { type: "spring" as const, damping: 30, stiffness: 320 }
      : { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const };
  const panelMotion =
    layout === "bottom"
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
      : {
          initial: { opacity: 0, scale: 0.96, y: 8 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: 8 },
        };

  const containerAlign =
    layout === "bottom" ? "items-end justify-center" : "items-center justify-center p-4";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 z-[100] flex ${containerAlign}`}
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
  const rounded = size === "fullscreen" ? "" : "rounded-2xl";
  return (
    <OverlayShell
      {...base}
      layout="center"
      className={className}
      panelClassName={`w-full ${DIALOG_SIZES[size]} ${rounded} max-h-[90dvh] overflow-y-auto`}
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
