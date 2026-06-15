"use client";

import { useEffect, useState } from "react";
import { useThemePreference } from "@/app/hooks/useThemePreference";
import styles from "./AnimatedBackground.module.css";

export function AnimatedBackground() {
  const { resolvedTheme } = useThemePreference();
  const isLight = resolvedTheme === "light";

  // Pause the drift animation while the tab is backgrounded: nothing is visible,
  // so there is no reason to keep the GPU compositing the orbs.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const syncVisibility = () => {
      setPaused(document.visibilityState === "hidden");
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  return (
    <div
      className={`${styles.container}${paused ? ` ${styles.paused}` : ""}`}
      aria-hidden="true"
    >
      <div
        className={`${styles.orb} ${styles.violet}`}
        data-theme={isLight ? "light" : "dark"}
      />
      <div
        className={`${styles.orb} ${styles.cyan}`}
        data-theme={isLight ? "light" : "dark"}
      />
      <div
        className={`${styles.orb} ${styles.emerald}`}
        data-theme={isLight ? "light" : "dark"}
      />
    </div>
  );
}
