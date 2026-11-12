import type { CSSProperties } from "react";

/**
 * The public site's skip links: off screen until focused, then a solid
 * accent pill at the top left. Shared by RecallNav ("Skip to main content")
 * and the landing's "Skip the film" (components/film/SkipFilmLink.tsx).
 */
export const SKIP_LINK_CLASS =
  "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:px-4 focus:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const SKIP_LINK_STYLE = {
  background: "var(--cf-recall-accent)",
  color: "var(--cf-recall-bg)",
  "--tw-ring-color": "var(--cf-recall-accent)",
} as CSSProperties;
