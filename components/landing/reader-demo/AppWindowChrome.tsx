"use client";

import { m } from "framer-motion";
import { Search, User } from "lucide-react";
import {
  DEMO_BOOK_TITLE,
  DEMO_CHAPTER_NUMBER,
} from "./demoChapter";

/**
 * App window chrome for the desktop landing demo. Designed to read as
 * "this is the actual ChapterFlow product" rather than a generic
 * browser preview. Visually anchored in the reader's color tokens.
 */
export function AppWindowChrome() {
  return (
    <div
      className="hidden h-11 items-center gap-3 px-4 md:flex"
      style={{
        background: "var(--cr-bg-surface-2)",
        borderBottom: "1px solid var(--cr-glass-border)",
      }}
    >
      {/* Traffic-light dots */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "var(--cf-window-control-close)" }}
        />
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "var(--cf-window-control-minimize)" }}
        />
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "var(--cf-window-control-maximize)" }}
        />
      </div>

      {/* Center: brand + chapter title */}
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        <span
          className="text-cf-label-sm font-bold uppercase tracking-wider"
          style={{
            color: "var(--cr-accent)",
            fontFamily: "var(--font-display)",
          }}
        >
          ChapterFlow
        </span>
        <span style={{ color: "var(--cr-text-disabled)" }}>·</span>
        {/* No layoutId: V5 mounts two reader consoles (hero + signature) at once,
            and a shared layoutId across both collides (framer warp/warnings). The
            title doesn't transition position, so it needs no shared-layout id. */}
        <m.span
          className="text-cf-label-sm truncate"
          style={{
            color: "var(--cr-text-secondary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {DEMO_BOOK_TITLE} · Ch {DEMO_CHAPTER_NUMBER}
        </m.span>
      </div>

      {/* Right side icons (decorative — no behavior) */}
      <div
        className="flex items-center gap-3"
        style={{ color: "var(--cr-text-disabled)" }}
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <User className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
    </div>
  );
}
