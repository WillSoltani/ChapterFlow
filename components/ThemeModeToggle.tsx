"use client";

import { Moon, Sun } from "lucide-react";
import { useThemePreference } from "@/app/hooks/useThemePreference";

type ThemeModeToggleProps = {
  variant?: "product" | "site";
  className?: string;
};

export function ThemeModeToggle({
  variant = "product",
  className = "",
}: ThemeModeToggleProps) {
  const { hydrated, resolvedTheme, themePreference, toggleTheme } = useThemePreference();
  const isDark = resolvedTheme === "dark";
  const preferenceLabel =
    themePreference === "system"
      ? `System (${resolvedTheme})`
      : resolvedTheme === "dark"
        ? "Dark"
        : "Light";
  const nextLabel = isDark ? "light" : "dark";

  const shellClassName =
    variant === "site"
      ? "border-white/12 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] focus-visible:ring-cyan-300/45"
      : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3) hover:bg-(--cf-surface-strong) focus-visible:ring-(--cf-accent-border)";
  const thumbClassName =
    variant === "site"
      ? "bg-white text-slate-900 shadow-lg shadow-black/10"
      : "bg-(--cf-surface) text-(--cf-text-1) shadow-sm";
  const activeIconClassName =
    variant === "site" ? "text-slate-900" : "text-(--cf-text-1)";
  const inactiveIconClassName =
    variant === "site" ? "text-slate-500" : "text-(--cf-text-3)";

  return (
    <button
      type="button"
      disabled={!hydrated}
      onClick={toggleTheme}
      aria-label={`Theme: ${preferenceLabel}. Switch to ${nextLabel} mode.`}
      aria-pressed={isDark}
      title={`Theme: ${preferenceLabel}`}
      className={[
        "group inline-flex items-center rounded-full border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none",
        hydrated ? "opacity-100" : "pointer-events-none opacity-0",
        shellClassName,
        className,
      ].join(" ")}
    >
      <span className="sr-only">
        {hydrated ? `Current theme ${preferenceLabel}.` : "Theme toggle."}
      </span>
      <span className="relative flex h-8 w-[4.5rem] items-center">
        <span
          aria-hidden="true"
          className={[
            "absolute left-0.5 top-0.5 h-7 w-7 rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none",
            thumbClassName,
            isDark ? "translate-x-9" : "translate-x-0",
          ].join(" ")}
        />
        <span className="relative z-10 flex w-full items-center justify-between px-2">
          <Sun
            className={[
              "h-3.5 w-3.5 transition-colors duration-200 motion-reduce:transition-none",
              !isDark ? activeIconClassName : inactiveIconClassName,
            ].join(" ")}
          />
          <Moon
            className={[
              "h-3.5 w-3.5 transition-colors duration-200 motion-reduce:transition-none",
              isDark ? activeIconClassName : inactiveIconClassName,
            ].join(" ")}
          />
        </span>
      </span>
    </button>
  );
}
