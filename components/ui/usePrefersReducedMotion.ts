"use client";

import { useSyncExternalStore } from "react";

/**
 * usePrefersReducedMotion — the landing-page motion gate.
 *
 * Returns true when EITHER signal asks for less motion:
 *   1. the OS setting `(prefers-reduced-motion: reduce)`, OR
 *   2. the in-app toggle `html[data-motion="reduced"]` (set by applyDocumentTheme
 *      from a stored user preference — present on the landing for returning users).
 *
 * framer-motion's `useReducedMotion()` only reads (1); every scroll-linked,
 * parallax, scrubbed, or spring animation on this route must honor BOTH (brief
 * constraint 8), so use this instead.
 *
 * Implemented with useSyncExternalStore so it's hydration-safe: the server
 * snapshot is always `false`, so SSR and the first client render agree (motion
 * components render their normal element with no transform at rest); the real
 * preference is read after mount. Pair with the "always render the same element,
 * gate the BEHAVIOR" pattern (never an early element-type swap) to avoid mismatch.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-motion"],
  });
  return () => {
    mql.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function getSnapshot(): boolean {
  return (
    window.matchMedia(QUERY).matches ||
    document.documentElement.dataset.motion === "reduced"
  );
}

function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
