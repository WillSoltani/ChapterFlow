"use client";

import { Wifi, BatteryFull, ChevronLeft, MoreHorizontal } from "lucide-react";
import { DEMO_BOOK_TITLE, DEMO_CHAPTER_NUMBER } from "./demoChapter";

/**
 * Phone-style chrome for the landing reader demo on small screens (< md).
 *
 * Replaces the desktop AppWindowChrome (traffic-light browser window) so the
 * reader reads as a NATIVE phone screen on mobile, not a shrunken desktop UI.
 * A minimal iOS-ish status bar (time · signal/battery) + a slim app top bar
 * (back chevron · centered book/chapter · overflow) — no browser chrome.
 *
 * Token-only color via the reader's --cr-* tokens (intentionally light, so the
 * product reads as a bright screen glowing on the dark page), Lucide icons, no
 * emoji. Purely decorative (aria-hidden) — the real reader UI lives below it.
 */
export function MobileAppChrome() {
  return (
    <div aria-hidden style={{ background: "var(--cr-bg-surface-2)" }}>
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-5 pt-2.5 pb-1 text-[12px] font-semibold"
        style={{ color: "var(--cr-text-primary)" }}
      >
        <span style={{ fontFamily: "var(--font-display)" }}>9:41</span>
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
          <BatteryFull className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>

      {/* App top bar */}
      <div
        className="flex items-center gap-3 px-3 py-2.5"
        style={{ borderBottom: "1px solid var(--cr-glass-border)" }}
      >
        <ChevronLeft
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
          style={{ color: "var(--cr-text-secondary)" }}
        />
        <div className="flex min-w-0 flex-1 flex-col items-center text-center leading-tight">
          <span
            className="truncate text-[13px] font-semibold"
            style={{
              color: "var(--cr-text-primary)",
              fontFamily: "var(--font-display)",
            }}
          >
            {DEMO_BOOK_TITLE}
          </span>
          <span
            className="text-[10.5px] uppercase tracking-wider"
            style={{ color: "var(--cr-accent)", fontFamily: "var(--font-mono)" }}
          >
            Chapter {DEMO_CHAPTER_NUMBER}
          </span>
        </div>
        <MoreHorizontal
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
          style={{ color: "var(--cr-text-secondary)" }}
        />
      </div>
    </div>
  );
}
