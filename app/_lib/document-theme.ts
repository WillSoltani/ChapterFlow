export type ThemePreference = "dark" | "light" | "system";
export type AccentColor = "sky" | "emerald" | "amber" | "rose";
export type InterfaceDensity = "compact" | "comfortable" | "spacious";
export type FocusRingStrength = "standard" | "strong" | "maximum";
export type ColorBlindMode = "off" | "protanopia" | "deuteranopia" | "tritanopia";
export type ResolvedThemeMode = "dark" | "light";

export type DocumentThemeSettings = {
  theme?: ThemePreference;
  reducedMotion?: boolean;
  highContrastMode?: boolean;
  colorBlindMode?: ColorBlindMode;
  // Scheduled "night mode": when scheduledDarkMode is on and the base theme is
  // not permanent-dark, the document goes dark inside the [darkModeFrom,
  // darkModeTo) window. These are persisted by useBookPreferences under
  // `extended`; document-theme reads (never writes) them so the schedule applies
  // app-wide — on every route's first paint via the bootstrap, not just the
  // Reader/Settings surfaces that mount useBookPreferences. See SET-8 / D3.
  scheduledDarkMode?: boolean;
  darkModeFrom?: string;
  darkModeTo?: string;
  // accentColor / interfaceDensity / focusRingStrength are accepted (callers such
  // as useBookPreferences still pass them) but intentionally ignored: nothing in
  // globals.css consumes [data-accent], [data-density], or [data-focus-ring], and
  // there is no Settings UI control that sets them. They are kept on the input
  // type only so existing call sites type-check; they no longer drive any DOM
  // attribute. Remove them from callers + this type once that path is wired or
  // confirmed dead. See M45.
  accentColor?: AccentColor;
  interfaceDensity?: InterfaceDensity;
  focusRingStrength?: FocusRingStrength;
};

type StoredThemePayload = {
  appearance?: Partial<{
    theme: ThemePreference;
    reducedMotion: boolean;
  }>;
  accessibility?: Partial<{
    highContrastMode: boolean;
  }>;
  // colorBlindMode + the night-mode schedule are persisted by useBookPreferences
  // under `extended`.
  extended?: Partial<{
    colorBlindMode: ColorBlindMode;
    scheduledDarkMode: boolean;
    darkModeFrom: string;
    darkModeTo: string;
  }>;
};

export const BOOK_THEME_STORAGE_KEY = "book-accelerator:preferences:v2";

// The settings that actually drive document attributes. accentColor /
// interfaceDensity / focusRingStrength are deliberately excluded: nothing reads
// the attributes they used to write (see DocumentThemeSettings note + M45).
type ActiveThemeSettings = {
  theme: ThemePreference;
  reducedMotion: boolean;
  highContrastMode: boolean;
  colorBlindMode: ColorBlindMode;
  scheduledDarkMode: boolean;
  darkModeFrom: string;
  darkModeTo: string;
};

const DEFAULT_THEME_SETTINGS: ActiveThemeSettings = {
  theme: "light",
  reducedMotion: false,
  highContrastMode: false,
  colorBlindMode: "off",
  // Mirror app/book/settings/constants/defaults.ts so a payload missing the
  // schedule fields resolves identically here and in the reader.
  scheduledDarkMode: false,
  darkModeFrom: "20:00",
  darkModeTo: "07:00",
};

function parseStoredThemePayload(raw: string | null | undefined): StoredThemePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as StoredThemePayload;
  } catch {
    return null;
  }
}

function pickThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "system" || value === "dark"
    ? value
    : DEFAULT_THEME_SETTINGS.theme;
}

function pickColorBlindMode(value: unknown): ColorBlindMode {
  return value === "protanopia" || value === "deuteranopia" || value === "tritanopia" || value === "off"
    ? value
    : DEFAULT_THEME_SETTINGS.colorBlindMode;
}

function pickBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

// Mirrors the reader loader's tolerance (useBookPreferences: `typeof x ===
// "string" ? x : default`): any string is accepted here; a malformed value is
// caught downstream by isWithinDarkWindow's NaN guard (→ no override) rather
// than rejected up front, keeping the two paths in agreement.
function pickTimeString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * True when `now` falls inside the night-mode window [from, to). This is the
 * SINGLE source of the app-wide window math and mirrors the reader effect in
 * app/book/hooks/useBookPreferences.ts EXACTLY — including the `start > end`
 * wrap-around across midnight (e.g. 20:00 → 07:00). Malformed "HH:MM" inputs
 * yield NaN minutes and resolve to `false` (no override), matching the reader,
 * where NaN comparisons are likewise all false. `now` is injectable for tests.
 */
export function isWithinDarkWindow(from: string, to: string, now: Date = new Date()): boolean {
  const [startH, startM] = from.split(":").map(Number);
  const [endH, endM] = to.split(":").map(Number);
  const start = (startH ?? NaN) * 60 + (startM ?? NaN);
  const end = (endH ?? NaN) * 60 + (endM ?? NaN);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return start > end ? mins >= start || mins < end : mins >= start && mins < end;
}

export function readStoredDocumentThemeSettings(raw?: string | null): ActiveThemeSettings {
  const parsed = parseStoredThemePayload(raw ?? null);
  const appearance = parsed?.appearance ?? {};
  const accessibility = parsed?.accessibility ?? {};
  const extended = parsed?.extended ?? {};

  return {
    theme: pickThemePreference(appearance.theme),
    reducedMotion: pickBoolean(appearance.reducedMotion, DEFAULT_THEME_SETTINGS.reducedMotion),
    highContrastMode: pickBoolean(
      accessibility.highContrastMode,
      DEFAULT_THEME_SETTINGS.highContrastMode
    ),
    colorBlindMode: pickColorBlindMode(extended.colorBlindMode),
    scheduledDarkMode: pickBoolean(
      extended.scheduledDarkMode,
      DEFAULT_THEME_SETTINGS.scheduledDarkMode
    ),
    darkModeFrom: pickTimeString(extended.darkModeFrom, DEFAULT_THEME_SETTINGS.darkModeFrom),
    darkModeTo: pickTimeString(extended.darkModeTo, DEFAULT_THEME_SETTINGS.darkModeTo),
  };
}

function systemPrefersDark() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function resolveDocumentThemeMode(theme: ThemePreference) {
  if (theme === "light") return false;
  if (theme === "system") return systemPrefersDark();
  return true;
}

export function resolveDocumentThemeLabel(theme: ThemePreference): ResolvedThemeMode {
  return resolveDocumentThemeMode(theme) ? "dark" : "light";
}

export function applyDocumentTheme(settings: DocumentThemeSettings, animate = false) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const next: ActiveThemeSettings = {
    theme: settings.theme ?? DEFAULT_THEME_SETTINGS.theme,
    reducedMotion: settings.reducedMotion ?? DEFAULT_THEME_SETTINGS.reducedMotion,
    highContrastMode: settings.highContrastMode ?? DEFAULT_THEME_SETTINGS.highContrastMode,
    colorBlindMode: settings.colorBlindMode ?? DEFAULT_THEME_SETTINGS.colorBlindMode,
    scheduledDarkMode: settings.scheduledDarkMode ?? DEFAULT_THEME_SETTINGS.scheduledDarkMode,
    darkModeFrom: settings.darkModeFrom ?? DEFAULT_THEME_SETTINGS.darkModeFrom,
    darkModeTo: settings.darkModeTo ?? DEFAULT_THEME_SETTINGS.darkModeTo,
  };
  // Base theme first; an active night-mode schedule then overrides `.dark`.
  // The override only applies when the user is NOT on a permanent-dark theme
  // (theme !== "dark"); on "light"/"system" the window fully controls `.dark`,
  // matching the reader's scheduled-dark effect (useBookPreferences).
  const scheduleActive = next.scheduledDarkMode && next.theme !== "dark";
  const dark = scheduleActive
    ? isWithinDarkWindow(next.darkModeFrom, next.darkModeTo)
    : resolveDocumentThemeMode(next.theme);

  if (animate) {
    root.classList.add("transitioning");
  }

  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.dataset.motion = next.reducedMotion ? "reduced" : "normal";
  root.dataset.contrast = next.highContrastMode ? "high" : "standard";
  root.dataset.colorBlindMode = next.colorBlindMode;

  if (animate) {
    setTimeout(() => root.classList.remove("transitioning"), 350);
  }
}

export function applyStoredDocumentTheme() {
  if (typeof window === "undefined") return;
  applyDocumentTheme(
    readStoredDocumentThemeSettings(window.localStorage.getItem(BOOK_THEME_STORAGE_KEY))
  );
}

/**
 * H8: Build the `(prefers-color-scheme: dark)` change handler for the theme
 * hook. When the OS light/dark setting flips while a "system"-preference user
 * has the app open, the DOM (<html>.dark, colorScheme, token set) must be
 * re-applied — React-state-only sync leaves the document stale. This factory
 * keeps that "re-apply to the DOM, THEN sync state" ordering in one tested
 * place; `syncTheme` updates the React state mirror afterward.
 */
export function createSystemThemeChangeHandler(syncTheme: () => void): () => void {
  return () => {
    applyStoredDocumentTheme();
    syncTheme();
  };
}

function mergeStoredThemePayload(
  current: StoredThemePayload | null,
  settings: DocumentThemeSettings
): StoredThemePayload {
  const nextAppearance = {
    ...(current?.appearance ?? {}),
  };
  const nextAccessibility = {
    ...(current?.accessibility ?? {}),
  };
  const nextExtended = {
    ...(current?.extended ?? {}),
  };

  if (settings.theme !== undefined) nextAppearance.theme = settings.theme;
  if (settings.reducedMotion !== undefined) nextAppearance.reducedMotion = settings.reducedMotion;
  if (settings.highContrastMode !== undefined) {
    nextAccessibility.highContrastMode = settings.highContrastMode;
  }
  if (settings.colorBlindMode !== undefined) {
    nextExtended.colorBlindMode = settings.colorBlindMode;
  }

  return {
    ...current,
    appearance: nextAppearance,
    accessibility: nextAccessibility,
    extended: nextExtended,
  };
}

export function persistDocumentThemeSettings(settings: DocumentThemeSettings) {
  if (typeof window === "undefined") return;
  const current = parseStoredThemePayload(window.localStorage.getItem(BOOK_THEME_STORAGE_KEY));
  const nextPayload = mergeStoredThemePayload(current, settings);
  window.localStorage.setItem(BOOK_THEME_STORAGE_KEY, JSON.stringify(nextPayload));
}

export function applyAndPersistDocumentTheme(settings: DocumentThemeSettings) {
  persistDocumentThemeSettings(settings);
  const next = readStoredDocumentThemeSettings(
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(BOOK_THEME_STORAGE_KEY)
  );
  applyDocumentTheme(next, true);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("book-theme-change"));
  }
  return next;
}

export function buildDocumentThemeBootstrapScript() {
  return `(function(){try{var root=document.documentElement;var raw=localStorage.getItem('${BOOK_THEME_STORAGE_KEY}')||'{}';var parsed=JSON.parse(raw);var appearance=(parsed&&parsed.appearance)||{};var accessibility=(parsed&&parsed.accessibility)||{};var extended=(parsed&&parsed.extended)||{};var theme=appearance.theme==='light'||appearance.theme==='system'||appearance.theme==='dark'?appearance.theme:'light';var reducedMotion=appearance.reducedMotion===true;var highContrast=accessibility.highContrastMode===true;var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches===true;var dark=theme==='light'?false:theme==='system'?prefersDark:true;var scheduledDark=extended.scheduledDarkMode===true;if(scheduledDark&&theme!=='dark'&&typeof extended.darkModeFrom==='string'&&typeof extended.darkModeTo==='string'){var fromParts=extended.darkModeFrom.split(':');var toParts=extended.darkModeTo.split(':');var startMins=Number(fromParts[0])*60+Number(fromParts[1]);var endMins=Number(toParts[0])*60+Number(toParts[1]);if(!isNaN(startMins)&&!isNaN(endMins)){var nowDate=new Date();var nowMins=nowDate.getHours()*60+nowDate.getMinutes();dark=startMins>endMins?(nowMins>=startMins||nowMins<endMins):(nowMins>=startMins&&nowMins<endMins);}}root.classList.toggle('dark',dark);root.style.colorScheme=dark?'dark':'light';root.dataset.motion=reducedMotion?'reduced':'normal';root.dataset.contrast=highContrast?'high':'standard';root.dataset.colorBlindMode=(extended.colorBlindMode==='protanopia'||extended.colorBlindMode==='deuteranopia'||extended.colorBlindMode==='tritanopia')?extended.colorBlindMode:'off';}catch(e){var root=document.documentElement;root.classList.remove('dark');root.style.colorScheme='light';root.dataset.motion='normal';root.dataset.contrast='standard';root.dataset.colorBlindMode='off';}})();`;
}
