"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";

type ResetProgressModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ResetProgressModal({
  open,
  onClose,
  onConfirm,
}: ResetProgressModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isConfirmed = confirmText.trim().toUpperCase() === "RESET";

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  const handleConfirm = () => {
    if (!isConfirmed) return;
    setConfirmText("");
    onConfirm();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      size="md"
      labelledBy="reset-progress-title"
      initialFocusRef={inputRef}
    >
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3
            id="reset-progress-title"
            className="text-xl font-semibold text-(--cf-text-1)"
          >
            Reset progress?
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent)"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-(--cf-text-2)">
          This will reset chapter completion and quiz scores for this book. This
          action cannot be undone.
        </p>

        <div className="mt-4">
          <label
            htmlFor="reset-progress-confirm"
            className="block text-xs font-medium text-(--cf-text-3)"
          >
            Type <span className="font-bold text-(--cf-danger-text)">RESET</span>{" "}
            to confirm
          </label>
          <input
            id="reset-progress-confirm"
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isConfirmed) handleConfirm();
            }}
            placeholder="RESET"
            className="cf-input mt-1.5 w-full rounded-xl px-3 py-2 text-sm"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="cf-btn cf-btn-secondary rounded-xl px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmed}
            className="cf-btn cf-btn-danger rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Reset progress
          </button>
        </div>
      </div>
    </Dialog>
  );
}
