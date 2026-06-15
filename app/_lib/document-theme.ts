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
  // colorBlindMode is persisted by useBookPreferences under `extended`.
  extended?: Partial<{
    colorBlindMode: ColorBlindMode;
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
};

const DEFAULT_THEME_SETTINGS: ActiveThemeSettings = {
  theme: "light",
  reducedMotion: false,
  highContrastMode: false,
  colorBlindMode: "off",
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
  };
  const dark = resolveDocumentThemeMode(next.theme);

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
  return `(function(){try{var root=document.documentElement;var raw=localStorage.getItem('${BOOK_THEME_STORAGE_KEY}')||'{}';var parsed=JSON.parse(raw);var appearance=(parsed&&parsed.appearance)||{};var accessibility=(parsed&&parsed.accessibility)||{};var extended=(parsed&&parsed.extended)||{};var theme=appearance.theme==='light'||appearance.theme==='system'||appearance.theme==='dark'?appearance.theme:'light';var reducedMotion=appearance.reducedMotion===true;var highContrast=accessibility.highContrastMode===true;var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches===true;var dark=theme==='light'?false:theme==='system'?prefersDark:true;root.classList.toggle('dark',dark);root.style.colorScheme=dark?'dark':'light';root.dataset.motion=reducedMotion?'reduced':'normal';root.dataset.contrast=highContrast?'high':'standard';root.dataset.colorBlindMode=(extended.colorBlindMode==='protanopia'||extended.colorBlindMode==='deuteranopia'||extended.colorBlindMode==='tritanopia')?extended.colorBlindMode:'off';}catch(e){var root=document.documentElement;root.classList.remove('dark');root.style.colorScheme='light';root.dataset.motion='normal';root.dataset.contrast='standard';root.dataset.colorBlindMode='off';}})();`;
}
