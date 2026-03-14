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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg rounded-3xl border border-white/12 bg-[#0b1120] p-5 shadow-[0_25px_60px_rgba(2,6,23,0.62)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/6 text-slate-200 transition hover:bg-white/10"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-slate-300">{children}</div>
      </div>
    </div>
  );
}

