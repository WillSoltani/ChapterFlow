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

/*
 * One shared subscription for the whole page: a single matchMedia listener and
 * a single MutationObserver on <html>, however many components use the hook
 * (the landing mounts ~48). Set up with the first subscriber, torn down with
 * the last (reference counted, so React strict mode's mount → unmount →
 * mount just tears down and sets up again).
 */
const subscribers = new Set<() => void>();
let mql: MediaQueryList | null = null;
let observer: MutationObserver | null = null;

const query = (): MediaQueryList => (mql ??= window.matchMedia(QUERY));

function notify(): void {
  for (const fn of [...subscribers]) fn();
}

export function subscribeReducedMotion(onChange: () => void): () => void {
  subscribers.add(onChange);
  if (subscribers.size === 1) {
    query().addEventListener("change", notify);
    observer = new MutationObserver(notify);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
  }
  return () => {
    if (!subscribers.delete(onChange) || subscribers.size > 0) return;
    query().removeEventListener("change", notify);
    observer?.disconnect();
    observer = null;
  };
}

function getSnapshot(): boolean {
  return (
    query().matches ||
    document.documentElement.dataset.motion === "reduced"
  );
}

/** The motion gate read now, outside React (an event handler); false on the server. */
export function readReducedMotion(): boolean {
  return typeof window !== "undefined" && getSnapshot();
}

function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getSnapshot, getServerSnapshot);
}
