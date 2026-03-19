"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

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
  inferredLocation?: BookViewerLocation | null;
};

type StoredViewer = {
  identity: BookViewerIdentity;
  inferredLocation: BookViewerLocation | null;
};

const STORAGE_KEY = "book-accelerator:viewer:v1";

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

export function useBookViewer() {
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<BookViewerIdentity>(defaultIdentity);
  const [inferredLocation, setInferredLocation] = useState<BookViewerLocation | null>(null);

  useEffect(() => {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      setIdentity(stored.identity);
      setInferredLocation(stored.inferredLocation);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchBookJson<ViewerPayload>("/app/api/book/me/profile")
      .then((payload) => {
        if (!mounted) return;
        if (payload.identity) {
          setIdentity({
            ...defaultIdentity,
            ...payload.identity,
            displayName:
              typeof payload.identity.displayName === "string" && payload.identity.displayName.trim()
                ? payload.identity.displayName
                : defaultIdentity.displayName,
          });
        }
        setInferredLocation(payload.inferredLocation ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
