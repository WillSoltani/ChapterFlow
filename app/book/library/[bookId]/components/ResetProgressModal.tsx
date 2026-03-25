"use client";

import { useState } from "react";
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
  const [confirmText, setConfirmText] = useState("");
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
    <InfoModal open={open} title="Reset progress?" onClose={handleClose}>
      <p className="text-sm">
        This will reset chapter completion and quiz scores for this book.
        This action cannot be undone.
      </p>
      <div className="mt-4">
        <label className="block text-xs font-medium text-(--cf-text-3)">
          Type <span className="font-bold text-(--cf-danger-text)">RESET</span> to confirm
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
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
    </InfoModal>
  );
}
