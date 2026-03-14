"use client";

import { InfoModal } from "@/app/book/home/components/InfoModal";

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
  return (
    <InfoModal open={open} title="Reset progress?" onClose={onClose}>
      <p>
        This will reset chapter completion and quiz scores for this book.
        You can’t undo this action.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/20 bg-white/8 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/12"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/22"
        >
          Reset progress
        </button>
      </div>
    </InfoModal>
  );
}

