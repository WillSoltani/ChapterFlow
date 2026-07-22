"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookQuery } from "@/lib/client/book-api-cache";
import { SETTINGS_KEY } from "./book-read-keys";

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
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");
    }
  }, []);

  const settingsQuery = useBookQuery<SettingsResponse>(enabled ? SETTINGS_KEY : null);
  const prescription =
    settingsQuery.data?.settings?.onboarding?.starterPrescription ?? null;
  const loading = enabled && settingsQuery.loading;

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
