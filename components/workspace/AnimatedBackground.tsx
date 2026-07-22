"use client";

import { useThemePreference } from "@/app/hooks/useThemePreference";
import styles from "./AnimatedBackground.module.css";

export function AnimatedBackground() {
  const { resolvedTheme } = useThemePreference();
  const isLight = resolvedTheme === "light";

  return (
    <div
      className={styles.container}
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
