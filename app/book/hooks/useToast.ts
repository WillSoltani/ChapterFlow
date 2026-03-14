"use client";

import { useCallback, useEffect, useState } from "react";
import type { ToastTone } from "@/app/book/components/ui/Toast";

type ToastState = {
  open: boolean;
  message: string;
  tone: ToastTone;
};

const defaultState: ToastState = {
  open: false,
  message: "",
  tone: "info",
};

export function useToast(timeoutMs = 1800) {
  const [toast, setToast] = useState<ToastState>(defaultState);

  useEffect(() => {
    if (!toast.open) return;
    const timeout = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, timeoutMs);

    return () => window.clearTimeout(timeout);
  }, [timeoutMs, toast.open]);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ open: true, message, tone });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    toast,
    showToast,
    closeToast,
  };
}
