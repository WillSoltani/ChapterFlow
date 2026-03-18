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

    syncTheme();
    window.addEventListener("storage", syncTheme);
    window.addEventListener("book-theme-change", syncTheme);

    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("book-theme-change", syncTheme);
    };
  }, []);

  return <>{children}</>;
}
