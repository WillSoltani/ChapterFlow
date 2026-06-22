"use client";

/**
 * RecallBookRequestDialog — the request form in a RECALL-skinned modal.
 *
 * Reuses the app's accessible Dialog (focus trap, Escape, scroll-lock, portal,
 * focus restore) and skins its panel to the RECALL surface via the `rl-modal-panel`
 * class (globals.css uses !important to beat the panel's baked generic tokens).
 * Opened from the library "Request a book" button and the browse empty-state
 * (prefilled with the unmatched search term). Renders nested above the library
 * browser overlay via the Dialog stack.
 */

import { useId } from "react";
import { X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { RecallBookRequestForm } from "./RecallBookRequestForm";

type RecallBookRequestDialogProps = {
  open: boolean;
  onClose: () => void;
  initialTitle?: string;
};

export function RecallBookRequestDialog({
  open,
  onClose,
  initialTitle,
}: RecallBookRequestDialogProps) {
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      size="md"
      // landing-dark re-scopes the recall design tokens on the portaled panel
      // (Dialog renders into <body>, outside the page's .landing-dark wrapper).
      className="rl-modal-panel landing-dark"
    >
      <div className="p-7 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="font-(family-name:--font-mono) text-[11px] uppercase tracking-[0.3em]"
              style={{ color: "var(--cf-recall-ink-faint)" }}
            >
              Request a book
            </p>
            <h2
              id={titleId}
              className="mt-2 font-(family-name:--font-display) text-[1.5rem] font-bold leading-tight tracking-[-0.02em]"
              style={{ color: "var(--cf-recall-ink)" }}
            >
              Tell us what to add next
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              color: "var(--cf-recall-ink-soft)",
              // @ts-expect-error -- CSS custom property for the focus ring color
              "--tw-ring-color": "var(--cf-recall-accent-line)",
            }}
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <p
          className="mt-3 text-[0.9375rem] leading-relaxed"
          style={{ color: "var(--cf-recall-ink-soft)" }}
        >
          Name the book and we’ll email you if it joins the library. Every request
          is read.
        </p>

        <div className="mt-7">
          <RecallBookRequestForm initialTitle={initialTitle} />
        </div>
      </div>
    </Dialog>
  );
}
