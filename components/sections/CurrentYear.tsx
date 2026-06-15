"use client";

import { useSyncExternalStore } from "react";

/**
 * Renders the current calendar year for the footer copyright line.
 *
 * This is a client component on purpose: the footer is embedded in
 * statically / ISR-rendered pages (e.g. /books has `revalidate = 3600`,
 * the home page is largely static), so a server-computed year would be
 * frozen at build/render time and could show last year's copyright for a
 * window after Jan 1 until the next revalidation.
 *
 * We use `useSyncExternalStore` so SSR (and the initial hydration render)
 * emit a stable build-time placeholder year — keeping server and client
 * markup identical — while the client snapshot reads the live year. After
 * hydration the client always shows the correct year, including right
 * across a New Year boundary on a cached page.
 */
const BUILD_YEAR = new Date().getFullYear();

// `useSyncExternalStore` requires a stable subscribe reference; the value
// only changes across renders/remounts, so we never need to notify.
function subscribe() {
  return () => {};
}

function getClientYear() {
  return new Date().getFullYear();
}

function getServerYear() {
  return BUILD_YEAR;
}

export function CurrentYear() {
  const year = useSyncExternalStore(subscribe, getClientYear, getServerYear);
  return <>{year}</>;
}
