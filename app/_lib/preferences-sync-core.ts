// Pure rules for the signed-in shell's preferences sync (SHELL-09).
//
// Pages that never mount useBookPreferences (Home, Library, Progress, ...) used
// to keep whatever theme this browser last stored, so dark mode, high contrast,
// reduced motion and colour-blind settings chosen on another device did not
// apply until the reader opened Settings or a chapter. The shell now reads the
// server settings once per page load and applies their appearance subset to
// this browser's stored theme. It never writes to the server or the
// last-synced marker: useBookPreferences stays the only owner of both.

import type { ColorBlindMode, DocumentThemeSettings, ThemePreference } from "./document-theme";

/**
 * Pages where the shell syncs preferences. Settings, the chapter reader and
 * onboarding mount useBookPreferences themselves, so the shell stays out of
 * their way.
 */
export function isPreferencesSyncPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (
    pathname === "/book/settings" ||
    pathname.startsWith("/book/settings/") ||
    pathname === "/book/onboarding" ||
    pathname.startsWith("/book/onboarding/") ||
    /^\/book\/library\/[^/]+\/chapter(\/|$)/.test(pathname)
  ) {
    return false;
  }
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/rewards" ||
    pathname.startsWith("/rewards/") ||
    pathname === "/book" ||
    pathname.startsWith("/book/")
  );
}

export type ServerPreferencesSnapshot = {
  /** The server returned a saved settings object (not null). */
  hasServerSettings: boolean;
  /** Raw `book-accelerator:preferences:v2` value in this browser, if any. */
  localPayload: string | null;
  /** `book-accelerator:preferences:last-synced-at:v2` in this browser, if any. */
  lastSyncedAt: string | null;
  /** The server settings `updatedAt`. */
  serverUpdatedAt: string | null;
};

/**
 * Same rule useBookPreferences uses on load: apply the server copy when this
 * browser has nothing saved, or when the server copy is newer than the last
 * one this browser reconciled with.
 */
export function shouldApplyServerPreferences(snapshot: ServerPreferencesSnapshot): boolean {
  if (!snapshot.hasServerSettings) return false;
  if (snapshot.localPayload === null) return true;
  const serverUpdatedAt = snapshot.serverUpdatedAt;
  if (typeof serverUpdatedAt !== "string") return false;
  return snapshot.lastSyncedAt === null || serverUpdatedAt > snapshot.lastSyncedAt;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const THEMES: readonly ThemePreference[] = ["dark", "light", "system"];
const COLOR_BLIND_MODES: readonly ColorBlindMode[] = [
  "off",
  "protanopia",
  "deuteranopia",
  "tritanopia",
];
const TIME_RE = /^\d{1,2}:\d{2}$/;

/** The document-theme subset of a server settings object; invalid values are left out. */
export function serverDocumentThemeSettings(settings: unknown): DocumentThemeSettings {
  const root = record(settings);
  const appearance = record(root.appearance);
  const accessibility = record(root.accessibility);
  const extended = record(root.extended);
  const out: DocumentThemeSettings = {};

  if (THEMES.includes(appearance.theme as ThemePreference)) {
    out.theme = appearance.theme as ThemePreference;
  }
  if (typeof appearance.reducedMotion === "boolean") out.reducedMotion = appearance.reducedMotion;
  if (typeof accessibility.highContrastMode === "boolean") {
    out.highContrastMode = accessibility.highContrastMode;
  }
  if (COLOR_BLIND_MODES.includes(extended.colorBlindMode as ColorBlindMode)) {
    out.colorBlindMode = extended.colorBlindMode as ColorBlindMode;
  }
  if (typeof extended.scheduledDarkMode === "boolean") {
    out.scheduledDarkMode = extended.scheduledDarkMode;
  }
  if (typeof extended.darkModeFrom === "string" && TIME_RE.test(extended.darkModeFrom)) {
    out.darkModeFrom = extended.darkModeFrom;
  }
  if (typeof extended.darkModeTo === "string" && TIME_RE.test(extended.darkModeTo)) {
    out.darkModeTo = extended.darkModeTo;
  }
  return out;
}
