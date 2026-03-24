"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if either the OS prefers-reduced-motion or
 * the in-app reduced motion toggle is enabled.
 */
export function useReducedMotion(inAppReducedMotion: boolean): boolean {
  const [osPreference, setOsPreference] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setOsPreference(mq.matches);
    const handler = (e: MediaQueryListEvent) => setOsPreference(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return osPreference || inAppReducedMotion;
}
