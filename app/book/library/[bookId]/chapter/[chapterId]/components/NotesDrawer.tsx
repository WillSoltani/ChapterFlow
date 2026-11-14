"use client";

import { useId, useRef } from "react";
import { Download, Pin, Plus, X } from "lucide-react";
import { Sheet } from "@/components/ui/Dialog";
import { CHAPTER_NOTES_MAX_CHARS } from "@/app/app/api/book/_lib/http-guards-core";

type NotesDrawerProps = {
  open: boolean;
  onClose: () => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onAddNote: () => void;
  onExport: () => void;
  onPinTakeaway: () => void;
  /** The account copy could not be reached; edits are kept on this device. */
  syncFailed?: boolean;
};

export function NotesDrawer({
  open,
  onClose,
  notes,
  onNotesChange,
  onAddNote,
  onExport,
  onPinTakeaway,
  syncFailed = false,
}: NotesDrawerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const counterId = useId();
  const overLimit = notes.length > CHAPTER_NOTES_MAX_CHARS;

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Chapter notes" initialFocusRef={textareaRef}>
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-(--cr-glass-border) pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cr-text-disabled)">
              Notes
            </p>
            <p className="text-sm text-(--cr-text-secondary)">
              Capture your insights for this chapter.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) text-(--cr-text-secondary) transition hover:text-(--cr-text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
            aria-label="Close notes"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddNote}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-3.5 text-sm font-medium text-(--cr-accent) transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Add note
          </button>
          <button
            type="button"
            onClick={onPinTakeaway}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-(--cr-warning)/30 bg-(--cr-warning)/10 px-3.5 text-sm font-medium text-(--cr-warning) transition hover:brightness-110"
          >
            <Pin className="h-4 w-4" />
            Pin takeaway
          </button>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3.5 text-sm font-medium text-(--cr-text-secondary) transition hover:text-(--cr-text-heading)"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          maxLength={CHAPTER_NOTES_MAX_CHARS}
          aria-describedby={counterId}
          placeholder="Write your notes here..."
          className="h-[48vh] max-h-[60dvh] w-full resize-none rounded-2xl border border-(--cr-glass-border) bg-(--cr-bg-surface-1) p-4 text-sm text-(--cr-text-primary) placeholder:text-(--cr-text-disabled) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_45%,transparent)]"
        />
        <div className="mt-2 flex items-start justify-between gap-3 text-cf-caption">
          {syncFailed ? (
            <p className="text-(--cr-warning)" role="status">
              Changes saved on this device only.
            </p>
          ) : (
            <span />
          )}
          <p
            id={counterId}
            className={`shrink-0 tabular-nums ${overLimit ? "text-(--cr-warning)" : "text-(--cr-text-disabled)"}`}
          >
            {notes.length.toLocaleString()} / {CHAPTER_NOTES_MAX_CHARS.toLocaleString()}
          </p>
        </div>
      </div>
    </Sheet>
  );
}
