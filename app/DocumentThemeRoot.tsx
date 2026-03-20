"use client";

import { useEffect } from "react";
import { applyStoredDocumentTheme } from "@/app/_lib/document-theme";

export function DocumentThemeRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const syncTheme = () => applyStoredDocumentTheme();
    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const handleMediaChange = () => syncTheme();

    syncTheme();
    window.addEventListener("storage", syncTheme);
    window.addEventListener("book-theme-change", syncTheme);
    mediaQuery?.addEventListener("change", handleMediaChange);

    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("book-theme-change", syncTheme);
      mediaQuery?.removeEventListener("change", handleMediaChange);
    };
  }, []);

  return <>{children}</>;
}
