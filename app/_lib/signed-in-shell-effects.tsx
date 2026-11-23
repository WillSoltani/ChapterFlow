"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { fetchBookJsonCached } from "@/lib/client/book-api-cache";
import { SETTINGS_KEY } from "@/lib/client/book-read-keys";
import { isAnalyticsBeaconPath, useAnalyticsBeacon } from "./analytics-beacon";
import {
  BOOK_THEME_STORAGE_KEY,
  applyStoredDocumentTheme,
  persistDocumentThemeSettings,
} from "./document-theme";
import {
  isPreferencesSyncPath,
  serverDocumentThemeSettings,
  shouldApplyServerPreferences,
} from "./preferences-sync-core";

// Same key useBookPreferences writes; read here, never written.
const LAST_SYNCED_KEY = "book-accelerator:preferences:last-synced-at:v2";

type SettingsPayload = { settings: Record<string, unknown> | null; updatedAt: string | null };

let syncedThisLoad = false;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function syncServerPreferences() {
  fetchBookJsonCached<SettingsPayload>(SETTINGS_KEY)
    .then((payload) => {
      const apply = shouldApplyServerPreferences({
        hasServerSettings: Boolean(payload?.settings),
        localPayload: readStorage(BOOK_THEME_STORAGE_KEY),
        lastSyncedAt: readStorage(LAST_SYNCED_KEY),
        serverUpdatedAt: payload?.updatedAt ?? null,
      });
      if (!apply) return;
      persistDocumentThemeSettings(serverDocumentThemeSettings(payload.settings));
      applyStoredDocumentTheme();
      // The header theme switch and MotionProvider re-read on this event.
      window.dispatchEvent(new Event("book-theme-change"));
    })
    .catch(() => {});
}

/**
 * Root-layout effects for the signed-in app, mounted on every route and gated
 * by path: the server-preferences sync (once per page load) and the opt-in
 * analytics beacon. Renders nothing.
 */
export function SignedInShellEffects() {
  const pathname = usePathname();
  const syncHere = isPreferencesSyncPath(pathname);

  useEffect(() => {
    if (!syncHere || syncedThisLoad) return;
    syncedThisLoad = true;
    syncServerPreferences();
  }, [syncHere]);

  useAnalyticsBeacon(isAnalyticsBeaconPath(pathname));
  return null;
}
