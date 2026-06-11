"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Client-side analytics beacon hook.
 *
 * Collects lightweight, non-invasive usage telemetry (part of the service; see
 * the privacy policy):
 * - Session context (screen size, timezone, language, color scheme, connection type)
 * - Performance metrics (page load time, DOM content loaded, first contentful paint)
 * - Navigation events (route changes with time-on-page)
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
      path: window.location.pathname,
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

  // Capture Core Web Vitals (LCP, INP, CLS) via the web-vitals library.
  // Each fires once when the metric stabilizes; we send each one as a
  // separate beacon so they're correctly attributed.
  reportWebVitals();
}

function reportWebVitals() {
  // Lazy-import web-vitals so it only loads in the browser.
  import("web-vitals")
    .then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const send = (key: string) => (metric: { value: number; id: string; navigationType?: string }) => {
        sendBeacon("performance", {
          [key]: key === "clsScore" ? Number(metric.value.toFixed(4)) : Math.round(metric.value),
          path: window.location.pathname,
          metricId: metric.id,
          navigationType: metric.navigationType,
        });
      };
      onLCP(send("lcpMs"));
      onINP(send("inpMs"));
      onCLS(send("clsScore"));
      onFCP(send("firstContentfulPaintMs"));
      onTTFB(send("ttfbMs"));
    })
    .catch(() => {
      // web-vitals may fail to load on some browsers — silently ignore
    });
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Mount this hook once in a top-level layout component. Beacons are sent
 * unconditionally — usage analytics is part of the service (see the privacy
 * policy), with no per-user opt-out.
 */
export function useAnalyticsBeacon() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const prevTimeRef = useRef<number>(0);
  const sentSessionRef = useRef(false);

  useEffect(() => {
    prevTimeRef.current = Date.now();

    // Send session context and performance metrics once per page load
    if (!sentSessionRef.current) {
      sentSessionRef.current = true;
      sendSessionContext();
      sendPerformanceMetrics();
    }
  }, []);

  // Track navigation (route changes)
  useEffect(() => {
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

