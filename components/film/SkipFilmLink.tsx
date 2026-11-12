"use client";

/**
 * "Skip the film" (Phase 8): past the reel to the first content after it
 * (the body wrapper, #after-film in BookReelLanding). The click moves focus
 * there and scrolls to it at once (the reel's chapters are many screens
 * long); without script the plain anchor does the scroll.
 *
 * Two uses: an early tab stop, off screen until focused, styled like the
 * nav's "Skip to main content" (passed to the nav by app/page.tsx), and,
 * under reduced motion only, a visible ghost button among the hero's buttons
 * (globals.css .film-skip-reduced).
 */

import type { CSSProperties, MouseEvent } from "react";

export const AFTER_FILM_ID = "after-film";

export function SkipFilmLink({ className, style }: { className?: string; style?: CSSProperties }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(AFTER_FILM_ID);
    if (!target) return;
    e.preventDefault();
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: "instant" as ScrollBehavior });
    target.focus({ preventScroll: true });
  };
  return (
    <a href={`#${AFTER_FILM_ID}`} onClick={onClick} className={className} style={style}>
      Skip the film
    </a>
  );
}
