"use client";

import { useEffect } from "react";

// Ref-counted body scroll lock. Multiple overlays (Dialog/Sheet via OverlayShell,
// the hand-rolled AskBookDrawer) can be open at once in the same screen; a naive
// per-overlay save-prev/restore-prev corrupts document.body.style when they stack
// and close out of order (last writer wins → body left permanently locked, or
// unlocked while a modal is still open). This shared counter captures the real
// previous values exactly once (first lock) and restores them exactly once (last
// unlock), so locks compose regardless of open/close order.
let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

function acquire() {
  if (lockCount === 0) {
    const body = document.body;
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    // scrollbar-gutter compensation to avoid layout shift
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
  }
  lockCount += 1;
}

function release() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const body = document.body;
    body.style.overflow = savedOverflow;
    body.style.paddingRight = savedPaddingRight;
  }
}

/** Lock body scroll while `active` is true; composes safely across stacked overlays. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    acquire();
    return release;
  }, [active]);
}
