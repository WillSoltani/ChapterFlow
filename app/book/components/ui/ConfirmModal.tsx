"use client";

import type { ReactNode } from "react";
import { Button } from "@/app/book/components/ui/Button";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="cf-overlay fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="cf-panel-strong w-full max-w-md rounded-3xl p-5">
        <h3 className="text-xl font-semibold text-(--cf-text-1)">{title}</h3>
        <div className="mt-2 text-sm text-(--cf-text-2)">{description}</div>
        <div className="mt-5 flex gap-2.5">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
