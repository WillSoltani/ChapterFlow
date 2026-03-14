"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

export type ProfileVisibility = "private" | "friends" | "public";

export type BookProfileState = {
  displayName: string;
  username: string;
  tagline: string;
  bio: string;
  timezone: string;
  country: string;
  pronouns: string;
  avatarDataUrl: string | null;
  avatarAccent: "sky" | "emerald" | "amber" | "rose";
  createdAt: string;
  profileVisibility: ProfileVisibility;
  showReadingStatsPublic: boolean;
  showBadgesPublic: boolean;
  showReadingHistoryPublic: boolean;
};

type BookProfileSeed = {
  displayName: string;
  pronouns: string;
  createdAt: string | null;
};

const STORAGE_KEY = "book-accelerator:profile:v1";
const ACCENTS = ["sky", "emerald", "amber", "rose"] as const;

function sanitizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function defaultUsername(name: string) {
  const base = sanitizeUsername(name.replace(/\s+/g, "_"));
  return base || "reader";
}

function createDefaultState(seed: BookProfileSeed): BookProfileState {
  return {
    displayName: seed.displayName || "Reader",
    username: defaultUsername(seed.displayName || "reader"),
    tagline: "Building a calmer, sharper reading practice.",
    bio: "Using ChapterFlow to turn reading into retained insight, sharper decisions, and better follow through.",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Halifax",
    country: "",
    pronouns: seed.pronouns,
    avatarDataUrl: null,
    avatarAccent: "sky",
    createdAt: seed.createdAt || new Date().toISOString(),
    profileVisibility: "private",
    showReadingStatsPublic: false,
    showBadgesPublic: false,
    showReadingHistoryPublic: false,
  };
}

function parseStored(raw: string | null, seed: BookProfileSeed): BookProfileState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BookProfileState>;
    const defaults = createDefaultState(seed);
    return {
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName.trim()
          ? parsed.displayName
          : defaults.displayName,
      username:
        typeof parsed.username === "string" && sanitizeUsername(parsed.username)
          ? sanitizeUsername(parsed.username)
          : defaults.username,
      tagline:
        typeof parsed.tagline === "string" && parsed.tagline.trim()
          ? parsed.tagline
          : defaults.tagline,
      bio: typeof parsed.bio === "string" ? parsed.bio : defaults.bio,
      timezone:
        typeof parsed.timezone === "string" && parsed.timezone.trim()
          ? parsed.timezone
          : defaults.timezone,
      country: typeof parsed.country === "string" ? parsed.country : defaults.country,
      pronouns:
        typeof parsed.pronouns === "string" ? parsed.pronouns : defaults.pronouns,
      avatarDataUrl:
        typeof parsed.avatarDataUrl === "string" || parsed.avatarDataUrl === null
          ? parsed.avatarDataUrl
          : defaults.avatarDataUrl,
      avatarAccent:
        typeof parsed.avatarAccent === "string" && ACCENTS.includes(parsed.avatarAccent as (typeof ACCENTS)[number])
          ? (parsed.avatarAccent as BookProfileState["avatarAccent"])
          : defaults.avatarAccent,
      createdAt:
        typeof parsed.createdAt === "string" && parsed.createdAt.trim()
          ? parsed.createdAt
          : defaults.createdAt,
      profileVisibility:
        parsed.profileVisibility === "friends" ||
        parsed.profileVisibility === "public" ||
        parsed.profileVisibility === "private"
          ? parsed.profileVisibility
          : defaults.profileVisibility,
      showReadingStatsPublic:
        typeof parsed.showReadingStatsPublic === "boolean"
          ? parsed.showReadingStatsPublic
          : defaults.showReadingStatsPublic,
      showBadgesPublic:
        typeof parsed.showBadgesPublic === "boolean"
          ? parsed.showBadgesPublic
          : defaults.showBadgesPublic,
      showReadingHistoryPublic:
        typeof parsed.showReadingHistoryPublic === "boolean"
          ? parsed.showReadingHistoryPublic
          : defaults.showReadingHistoryPublic,
    };
  } catch {
    return null;
  }
}

export function useBookProfile(seed: BookProfileSeed) {
  const stableSeed = useMemo(
    () => ({
      displayName: seed.displayName,
      pronouns: seed.pronouns,
      createdAt: seed.createdAt,
    }),
    [seed.createdAt, seed.displayName, seed.pronouns]
  );
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<BookProfileState>(createDefaultState(stableSeed));
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY), stableSeed);
    setState(stored ?? createDefaultState(stableSeed));
    setHydrated(true);
  }, [stableSeed]);

  useEffect(() => {
    let mounted = true;
    fetchBookJson<{ profile: Partial<BookProfileState> | null }>("/app/api/book/me/profile")
      .then((payload) => {
        if (!mounted || !payload.profile) return;
        setState((prev) => ({
          ...prev,
          ...payload.profile,
        }));
        setServerReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setServerReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || !serverReady) return;
    const timeout = window.setTimeout(() => {
      fetchBookJson("/app/api/book/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ profile: state }),
      }).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [hydrated, serverReady, state]);

  const patch = useCallback((values: Partial<BookProfileState>) => {
    setState((prev) => ({ ...prev, ...values }));
  }, []);

  const resetAvatar = useCallback(() => {
    setState((prev) => ({ ...prev, avatarDataUrl: null }));
  }, []);

  return {
    hydrated,
    state,
    patch,
    resetAvatar,
  };
}
