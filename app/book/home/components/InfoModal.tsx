"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

type InfoModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function InfoModal({ open, title, onClose, children }: InfoModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--cf-overlay) px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg rounded-3xl border border-(--cf-border) bg-(--cf-surface-strong) p-5 shadow-shadow-elevated">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-(--cf-text-1)">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) transition hover:bg-(--cf-accent-muted)"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-(--cf-text-2)">{children}</div>
      </div>
    </div>
  );
}
