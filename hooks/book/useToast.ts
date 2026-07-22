"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ToastPresentation,
  ToastTone,
} from "@/components/ui/Toast";

type ShowToastOptions = {
  autoDismissMs?: number;
  detail?: string | undefined;
  presentation?: ToastPresentation;
};

type ToastState = {
  open: boolean;
  message: string;
  tone: ToastTone;
  detail?: string | undefined;
  presentation: ToastPresentation;
  autoDismissMs: number;
  sequence: number;
};

const defaultState: ToastState = {
  open: false,
  message: "",
  tone: "info",
  presentation: "default",
  autoDismissMs: 1800,
  sequence: 0,
};

export function useToast(timeoutMs = 1800) {
  const [toast, setToast] = useState<ToastState>(() => ({
    ...defaultState,
    autoDismissMs: timeoutMs,
  }));

  useEffect(() => {
    if (!toast.open) return;
    const timeout = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, toast.autoDismissMs);

    return () => window.clearTimeout(timeout);
  }, [toast.autoDismissMs, toast.open, toast.sequence]);

  const showToast = useCallback(
    (
      message: string,
      tone: ToastTone = "info",
      options: ShowToastOptions = {},
    ) => {
      setToast((current) => ({
        open: true,
        message,
        tone,
        detail: options.detail,
        presentation: options.presentation ?? "default",
        autoDismissMs: options.autoDismissMs ?? timeoutMs,
        sequence: current.sequence + 1,
      }));
    },
    [timeoutMs],
  );

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    toast,
    showToast,
    closeToast,
  };
}
