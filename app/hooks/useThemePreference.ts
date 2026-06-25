"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ResolvedThemeMode,
  type ThemePreference,
  BOOK_THEME_STORAGE_KEY,
  applyAndPersistDocumentTheme,
  createSystemThemeChangeHandler,
  readStoredDocumentThemeSettings,
  resolveDocumentThemeLabel,
} from "@/app/_lib/document-theme";

type UseThemePreferenceOptions = {
  persistToServer?: boolean;
};

function readThemeState(): {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedThemeMode;
} {
  if (typeof window === "undefined") {
    return {
      themePreference: "light",
      resolvedTheme: "light",
    };
  }

  const settings = readStoredDocumentThemeSettings(
    window.localStorage.getItem(BOOK_THEME_STORAGE_KEY)
  );
  return {
    themePreference: settings.theme,
    resolvedTheme: resolveDocumentThemeLabel(settings.theme),
  };
}

export function useThemePreference(options?: UseThemePreferenceOptions) {
  const persistToServer = options?.persistToServer ?? true;
  const [hydrated, setHydrated] = useState(false);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("light");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedThemeMode>("light");

  const syncTheme = useCallback(() => {
    const next = readThemeState();
    setThemePreferenceState(next.themePreference);
    setResolvedTheme(next.resolvedTheme);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncTheme();
      setHydrated(true);
    });

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    // H8: When the OS light/dark setting flips while a "system"-preference user
    // has the app open, syncTheme alone only updates React state — the DOM
    // (<html>.dark, colorScheme, token set) would stay stale. The handler
    // re-applies the stored theme to the document first (resolving system→dark
    // via matchMedia), then syncs React state.
    const handleMediaChange = createSystemThemeChangeHandler(syncTheme);
    window.addEventListener("storage", syncTheme);
    window.addEventListener("book-theme-change", syncTheme);
    mediaQuery?.addEventListener("change", handleMediaChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("book-theme-change", syncTheme);
      mediaQuery?.removeEventListener("change", handleMediaChange);
    };
  }, [syncTheme]);

  const setThemePreference = useCallback(
    async (nextTheme: ThemePreference) => {
      const next = applyAndPersistDocumentTheme({ theme: nextTheme });
      setThemePreferenceState(next.theme);
      setResolvedTheme(resolveDocumentThemeLabel(next.theme));

      if (!persistToServer) return;

      try {
        await fetch("/app/api/book/me/settings", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            settings: {
              appearance: {
                theme: nextTheme,
              },
            },
          }),
        });
      } catch {
        // Keep the client preference even if the signed-in sync is unavailable.
      }
    },
    [persistToServer]
  );

  const toggleTheme = useCallback(() => {
    void setThemePreference(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setThemePreference]);

  return useMemo(
    () => ({
      hydrated,
      themePreference,
      resolvedTheme,
      setThemePreference,
      toggleTheme,
    }),
    [hydrated, resolvedTheme, setThemePreference, themePreference, toggleTheme]
  );
}
