export type ThemePreference = "dark" | "light" | "system";
export type AccentColor = "sky" | "emerald" | "amber" | "rose";
export type InterfaceDensity = "compact" | "comfortable" | "spacious";
export type FocusRingStrength = "standard" | "strong" | "maximum";
export type ResolvedThemeMode = "dark" | "light";

export type DocumentThemeSettings = {
  theme?: ThemePreference;
  accentColor?: AccentColor;
  interfaceDensity?: InterfaceDensity;
  reducedMotion?: boolean;
  highContrastMode?: boolean;
  focusRingStrength?: FocusRingStrength;
};

type StoredThemePayload = {
  appearance?: Partial<{
    theme: ThemePreference;
    accentColor: AccentColor;
    interfaceDensity: InterfaceDensity;
    reducedMotion: boolean;
  }>;
  accessibility?: Partial<{
    highContrastMode: boolean;
    focusRingStrength: FocusRingStrength;
  }>;
};

export const BOOK_THEME_STORAGE_KEY = "book-accelerator:preferences:v2";

const DEFAULT_THEME_SETTINGS: Required<DocumentThemeSettings> = {
  theme: "light",
  accentColor: "sky",
  interfaceDensity: "comfortable",
  reducedMotion: false,
  highContrastMode: false,
  focusRingStrength: "strong",
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

function pickAccentColor(value: unknown): AccentColor {
  return value === "emerald" || value === "amber" || value === "rose" || value === "sky"
    ? value
    : DEFAULT_THEME_SETTINGS.accentColor;
}

function pickDensity(value: unknown): InterfaceDensity {
  return value === "compact" || value === "spacious" || value === "comfortable"
    ? value
    : DEFAULT_THEME_SETTINGS.interfaceDensity;
}

function pickFocusRingStrength(value: unknown): FocusRingStrength {
  return value === "standard" || value === "maximum" || value === "strong"
    ? value
    : DEFAULT_THEME_SETTINGS.focusRingStrength;
}

function pickBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function readStoredDocumentThemeSettings(raw?: string | null): Required<DocumentThemeSettings> {
  const parsed = parseStoredThemePayload(raw ?? null);
  const appearance = parsed?.appearance ?? {};
  const accessibility = parsed?.accessibility ?? {};

  return {
    theme: pickThemePreference(appearance.theme),
    accentColor: pickAccentColor(appearance.accentColor),
    interfaceDensity: pickDensity(appearance.interfaceDensity),
    reducedMotion: pickBoolean(appearance.reducedMotion, DEFAULT_THEME_SETTINGS.reducedMotion),
    highContrastMode: pickBoolean(
      accessibility.highContrastMode,
      DEFAULT_THEME_SETTINGS.highContrastMode
    ),
    focusRingStrength: pickFocusRingStrength(accessibility.focusRingStrength),
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

export function applyDocumentTheme(settings: DocumentThemeSettings) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const next = {
    ...DEFAULT_THEME_SETTINGS,
    ...settings,
  };
  const dark = resolveDocumentThemeMode(next.theme);

  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.dataset.accent = next.accentColor;
  root.dataset.density = next.interfaceDensity;
  root.dataset.motion = next.reducedMotion ? "reduced" : "normal";
  root.dataset.contrast = next.highContrastMode ? "high" : "standard";
  root.dataset.focusRing = next.focusRingStrength;
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

  if (settings.theme !== undefined) nextAppearance.theme = settings.theme;
  if (settings.accentColor !== undefined) nextAppearance.accentColor = settings.accentColor;
  if (settings.interfaceDensity !== undefined) {
    nextAppearance.interfaceDensity = settings.interfaceDensity;
  }
  if (settings.reducedMotion !== undefined) nextAppearance.reducedMotion = settings.reducedMotion;
  if (settings.highContrastMode !== undefined) {
    nextAccessibility.highContrastMode = settings.highContrastMode;
  }
  if (settings.focusRingStrength !== undefined) {
    nextAccessibility.focusRingStrength = settings.focusRingStrength;
  }

  return {
    ...current,
    appearance: nextAppearance,
    accessibility: nextAccessibility,
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
  applyDocumentTheme(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("book-theme-change"));
  }
  return next;
}

export function buildDocumentThemeBootstrapScript() {
  return `(function(){try{var root=document.documentElement;var raw=localStorage.getItem('${BOOK_THEME_STORAGE_KEY}')||'{}';var parsed=JSON.parse(raw);var appearance=(parsed&&parsed.appearance)||{};var accessibility=(parsed&&parsed.accessibility)||{};var theme=appearance.theme==='light'||appearance.theme==='system'||appearance.theme==='dark'?appearance.theme:'light';var accent=appearance.accentColor==='emerald'||appearance.accentColor==='amber'||appearance.accentColor==='rose'||appearance.accentColor==='sky'?appearance.accentColor:'sky';var density=appearance.interfaceDensity==='compact'||appearance.interfaceDensity==='spacious'||appearance.interfaceDensity==='comfortable'?appearance.interfaceDensity:'comfortable';var reducedMotion=appearance.reducedMotion===true;var highContrast=accessibility.highContrastMode===true;var focusRing=accessibility.focusRingStrength==='standard'||accessibility.focusRingStrength==='maximum'||accessibility.focusRingStrength==='strong'?accessibility.focusRingStrength:'strong';var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches===true;var dark=theme==='light'?false:theme==='system'?prefersDark:true;root.classList.toggle('dark',dark);root.style.colorScheme=dark?'dark':'light';root.dataset.accent=accent;root.dataset.density=density;root.dataset.motion=reducedMotion?'reduced':'normal';root.dataset.contrast=highContrast?'high':'standard';root.dataset.focusRing=focusRing;}catch(e){var root=document.documentElement;root.classList.remove('dark');root.style.colorScheme='light';root.dataset.accent='sky';root.dataset.density='comfortable';root.dataset.motion='normal';root.dataset.contrast='standard';root.dataset.focusRing='strong';}})();`;
}
