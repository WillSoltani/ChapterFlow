"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

export type StarterPrescription = {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  chapterNumber: number;
  reason: string;
  reasonDetail: string;
  generatedAt: string;
};

type SettingsResponse = {
  settings: {
    onboarding?: {
      starterPrescription?: StarterPrescription;
    };
  } | null;
};

const DISMISSED_KEY = "book-accelerator:prescription-dismissed";

export function useStarterPrescription(enabled: boolean) {
  const [prescription, setPrescription] = useState<StarterPrescription | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;
    fetchBookJson<SettingsResponse>("/app/api/book/me/settings")
      .then((data) => {
        if (!mounted) return;
        const p = data.settings?.onboarding?.starterPrescription ?? null;
        setPrescription(p);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [enabled]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    window.localStorage.setItem(DISMISSED_KEY, "true");
  }, []);

  return {
    prescription: dismissed ? null : prescription,
    loading,
    dismissed,
    dismiss,
  };
}
