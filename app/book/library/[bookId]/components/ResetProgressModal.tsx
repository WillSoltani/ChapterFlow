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
        You can&apos;t undo this action.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="cf-btn cf-btn-secondary rounded-xl px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="cf-btn cf-btn-danger rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Reset progress
        </button>
      </div>
    </InfoModal>
  );
}
