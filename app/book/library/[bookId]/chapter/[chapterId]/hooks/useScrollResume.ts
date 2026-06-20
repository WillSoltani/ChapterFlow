"use client";

import { useEffect, useRef } from "react";
import {
  SCROLL_RESUME_STORAGE_KEY,
  scrollResumeKey,
  parseScrollResumeMap,
  serializeScrollResumeMap,
  upsertScrollResume,
  getScrollResumeOffset,
  decideRestoreTarget,
  type ScrollResumeMap,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/scroll-resume";

function readMap(): ScrollResumeMap {
  try {
    return parseScrollResumeMap(window.localStorage.getItem(SCROLL_RESUME_STORAGE_KEY));
  } catch {
    return {};
  }
}

function writeMap(map: ScrollResumeMap): void {
  try {
    window.localStorage.setItem(SCROLL_RESUME_STORAGE_KEY, serializeScrollResumeMap(map));
  } catch {
    /* quota / disabled storage — saving a scroll offset is best-effort */
  }
}

/**
 * Reader "pick up where you left off" (Settings → Reading → resumeWhereLeftOff).
 *
 * The toggle defaults ON and promises the reader returns to their last reading
 * position; before SET-6 nothing honored it (the reader only scrolled chapters
 * to the top). This hook:
 *  - SAVES the window scroll offset for the current chapter (passive, rAF-
 *    throttled) while the feature is on and the content is on screen, and
 *  - RESTORES it ONCE per chapter entry, after the content has laid out so the
 *    document is tall enough for the saved offset to be reachable.
 *
 * It deliberately does NOT touch the in-chapter scroll-to-top on tab/phase
 * transitions: restore is one-shot, keyed by chapter, so a Summary→Examples
 * switch still snaps to the top. (A scroll-to-top there also persists ~0, which
 * clears the stale deep offset — so "where you left off" tracks the last tab.)
 *
 * Storage is client-only (its own localStorage key) — no server route/schema.
 */
export function useScrollResume(params: {
  bookId: string;
  chapterId: string;
  /** Settings → Reading → resumeWhereLeftOff. When false: never save, never restore. */
  enabled: boolean;
  /** True once the chapter content is mounted & laid out (safe to read/restore). */
  ready: boolean;
}): void {
  const { bookId, chapterId, enabled, ready } = params;

  // Persist the scroll offset for this chapter. Active only while the feature is
  // on and the content is up, so we never record the skeleton's 0 (which would
  // wipe a real saved position on every cold open).
  useEffect(() => {
    if (!enabled || !ready || typeof window === "undefined") return;
    const key = scrollResumeKey(bookId, chapterId);
    let frame = 0;
    const persist = () => {
      frame = 0;
      writeMap(upsertScrollResume(readMap(), key, window.scrollY, Date.now()));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(persist);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [bookId, chapterId, enabled, ready]);

  // Restore: exactly once per chapter entry. The ref is consumed the first time a
  // chapter becomes `ready` REGARDLESS of `enabled`, so toggling the setting on
  // mid-read never yanks the reader to a stale position — restore only ever
  // happens at the entry moment.
  const restoredKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const key = scrollResumeKey(bookId, chapterId);
    if (restoredKeyRef.current === key) return;
    restoredKeyRef.current = key; // consume the entry moment for this chapter
    if (!enabled) return; // feature off → leave the chapter at the top

    const savedOffset = getScrollResumeOffset(readMap(), key);
    if (savedOffset == null) return;

    // Two animation frames: let the freshly-rendered content paint and settle
    // its height before we measure the scrollable range, otherwise a tall saved
    // offset clamps against a not-yet-grown document and lands short.
    let f1 = 0;
    let f2 = 0;
    f1 = window.requestAnimationFrame(() => {
      f2 = window.requestAnimationFrame(() => {
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        const target = decideRestoreTarget({ savedOffset, maxScroll });
        if (target !== null) {
          window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
        }
      });
    });
    return () => {
      if (f1) window.cancelAnimationFrame(f1);
      if (f2) window.cancelAnimationFrame(f2);
    };
  }, [bookId, chapterId, enabled, ready]);
}
