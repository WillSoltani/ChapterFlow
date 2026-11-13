"use client";

// Canonical shared book-viewer hook (WS3-001).

import { useEffect, useMemo, useState } from "react";
import { peekBookCache, useBookQuery } from "@/lib/client/book-api-cache";

export type BookViewerIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  authDisplayName: string | null;
  profileDisplayName: string | null;
  givenName: string | null;
  familyName: string | null;
  preferredUsername: string | null;
  avatarDataUrl: string | null;
  source: "profile" | "cognito" | "email" | "fallback";
};

export type BookViewerLocation = {
  source: "cloudfront" | "vercel" | "proxy";
  precision: "country" | "region" | "city";
  countryCode: string | null;
  countryName: string | null;
  regionCode: string | null;
  regionName: string | null;
  city: string | null;
};

type ViewerPayload = {
  identity?: Partial<BookViewerIdentity> | null;
  profile?: { avatarDataUrl?: string | null } | null;
  inferredLocation?: BookViewerLocation | null;
};

type StoredViewer = {
  identity: BookViewerIdentity;
  inferredLocation: BookViewerLocation | null;
};

const STORAGE_KEY = "book-accelerator:viewer:v1";
const VIEWER_KEY = "/app/api/book/me/profile";

const defaultIdentity: BookViewerIdentity = {
  sub: "unknown",
  email: null,
  emailVerified: false,
  displayName: "Reader",
  authDisplayName: null,
  profileDisplayName: null,
  givenName: null,
  familyName: null,
  preferredUsername: null,
  avatarDataUrl: null,
  source: "fallback",
};

function parseStored(raw: string | null): StoredViewer | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredViewer>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      identity: {
        ...defaultIdentity,
        ...(parsed.identity ?? {}),
        displayName:
          typeof parsed.identity?.displayName === "string" && parsed.identity.displayName.trim()
            ? parsed.identity.displayName
            : defaultIdentity.displayName,
      },
      inferredLocation:
        parsed.inferredLocation && typeof parsed.inferredLocation === "object"
          ? (parsed.inferredLocation as BookViewerLocation)
          : null,
    };
  } catch {
    return null;
  }
}

export function formatViewerLocation(location: BookViewerLocation | null | undefined): string | null {
  if (!location) return null;
  if (location.city && location.regionName) {
    return `${location.city}, ${location.regionName}`;
  }
  if (location.city && location.countryName) {
    return `${location.city}, ${location.countryName}`;
  }
  if (location.regionName && location.countryName) {
    return `${location.regionName}, ${location.countryName}`;
  }
  return location.countryName || location.countryCode || null;
}

function identityFromPayload(
  payload: ViewerPayload,
  prev: BookViewerIdentity
): BookViewerIdentity {
  const avatarFromProfile =
    typeof payload.profile?.avatarDataUrl === "string"
      ? payload.profile.avatarDataUrl
      : null;
  if (!payload.identity) return { ...prev, avatarDataUrl: avatarFromProfile };
  return {
    ...defaultIdentity,
    ...payload.identity,
    avatarDataUrl: avatarFromProfile,
    displayName:
      typeof payload.identity.displayName === "string" && payload.identity.displayName.trim()
        ? payload.identity.displayName
        : defaultIdentity.displayName,
  };
}

export function useBookViewer() {
  const [hydrated, setHydrated] = useState(false);
  // Seed from the shared request cache so a page reached by client navigation
  // shows the viewer on its first render instead of the "Reader" fallback.
  const [identity, setIdentity] = useState<BookViewerIdentity>(() => {
    const cached = peekBookCache<ViewerPayload>(VIEWER_KEY);
    return cached ? identityFromPayload(cached, defaultIdentity) : defaultIdentity;
  });
  const [inferredLocation, setInferredLocation] = useState<BookViewerLocation | null>(
    () => peekBookCache<ViewerPayload>(VIEWER_KEY)?.inferredLocation ?? null
  );

  useEffect(() => {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      // Never replace an identity already seeded from the cache with an older copy.
      setIdentity((prev) => (prev.source === "fallback" ? stored.identity : prev));
      setInferredLocation((prev) => prev ?? stored.inferredLocation);
    }
    setHydrated(true);
  }, []);

  // Cached GET — dedups with useBookProfile's /me/profile read when co-mounted.
  const viewerQuery = useBookQuery<ViewerPayload>(VIEWER_KEY);
  const loading = viewerQuery.loading;

  useEffect(() => {
    const payload = viewerQuery.data;
    if (!payload) return;
    setIdentity((prev) => identityFromPayload(payload, prev));
    setInferredLocation(payload.inferredLocation ?? null);
  }, [viewerQuery.data]);

  useEffect(() => {
    if (!hydrated) return;
    const payload: StoredViewer = { identity, inferredLocation };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, identity, inferredLocation]);

  const locationLabel = useMemo(
    () => formatViewerLocation(inferredLocation),
    [inferredLocation]
  );

  return {
    hydrated,
    loading,
    identity,
    inferredLocation,
    locationLabel,
  };
}
