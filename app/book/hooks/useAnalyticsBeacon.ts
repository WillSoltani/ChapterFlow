"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Client-side analytics beacon hook.
 *
 * When the user has opted in to "Share Usage Analytics", this hook collects
 * lightweight, non-invasive telemetry:
 * - Session context (screen size, timezone, language, color scheme, connection type)
 * - Performance metrics (page load time, DOM content loaded, first contentful paint)
 * - Navigation events (route changes with time-on-page)
 *
 * When opted out, this hook does nothing.
 */

const BEACON_ENDPOINT = "/app/api/book/me/analytics/beacon";

// ─── Helpers ────────────────────────────────────────────────────────────────

function sendBeacon(type: string, payload: Record<string, unknown>) {
  fetch(BEACON_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, ...payload }),
    keepalive: true,
  }).catch(() => {});
}

function getColorScheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function getConnectionType(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
  };
  return nav.connection?.effectiveType ?? undefined;
}

// ─── Session context (fires once per page load) ──────────────────────────────

function sendSessionContext() {
  sendBeacon("session_context", {
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    colorScheme: getColorScheme(),
    connectionType: getConnectionType(),
    online: navigator.onLine,
  });
}

// ─── Performance metrics (fires once after page load) ───────────────────────

function sendPerformanceMetrics() {
  // Wait for the page to be fully loaded
  const report = () => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return;

    const payload: Record<string, unknown> = {
      pageLoadMs: Math.round(nav.loadEventEnd - nav.startTime),
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      ttfbMs: Math.round(nav.responseStart - nav.startTime),
      transferSizeBytes: nav.transferSize,
    };

    // First Contentful Paint via PerformanceObserver
    const paintEntries = performance.getEntriesByType("paint");
    const fcp = paintEntries.find((e) => e.name === "first-contentful-paint");
    if (fcp) {
      payload.firstContentfulPaintMs = Math.round(fcp.startTime);
    }

    sendBeacon("performance", payload);
  };

  // Ensure load event has fully fired
  if (document.readyState === "complete") {
    setTimeout(report, 100);
  } else {
    window.addEventListener("load", () => setTimeout(report, 100), { once: true });
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Mount this hook once in a top-level layout component.
 * It reads the analytics consent preference from localStorage directly
 * (same key as useBookPreferences) to avoid coupling to the preferences hook.
 */
export function useAnalyticsBeacon() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const prevTimeRef = useRef<number>(0);
  const sentSessionRef = useRef(false);

  useEffect(() => {
    prevTimeRef.current = Date.now();

    // Read consent directly from localStorage — fast synchronous check
    const isOptedIn = readAnalyticsConsent();
    if (!isOptedIn) return;

    // Send session context and performance metrics once per page load
    if (!sentSessionRef.current) {
      sentSessionRef.current = true;
      sendSessionContext();
      sendPerformanceMetrics();
    }
  }, []);

  // Track navigation (route changes)
  useEffect(() => {
    const isOptedIn = readAnalyticsConsent();
    if (!isOptedIn) return;

    const now = Date.now();
    const prev = prevPathRef.current;

    if (prev !== null && prev !== pathname) {
      sendBeacon("navigation", {
        path: pathname,
        referrerPath: prev,
        timeOnPreviousPageMs: now - prevTimeRef.current,
      });
    }

    prevPathRef.current = pathname;
    prevTimeRef.current = now;
  }, [pathname]);
}

// ─── Consent check ──────────────────────────────────────────────────────────

const STORAGE_KEY = "book-accelerator:preferences:v2";

/** Read analytics consent from localStorage. Returns true if opted in (default). */
function readAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return true; // Default is opted in
    const parsed = JSON.parse(raw);
    const value = parsed?.privacy?.analyticsParticipation;
    return value !== false; // Only false means opted out
  } catch {
    return true; // Default is opted in
  }
}
