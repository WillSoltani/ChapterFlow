import { readFileSync } from "node:fs";

/**
 * The one signal for "the frames in public/films are placeholders"
 * (scripts/film/placeholder.mjs writes `placeholder: true` into every
 * manifest it makes; real encodes never do). CI runs the film specs on
 * placeholder frames (.github/workflows/ci.yml, job "film").
 *
 * Tests that judge the REAL footage (the WCAG contrast of the copy and of the
 * nav's focus indicators over the picture, the film audit's luminance behind
 * the copy) skip themselves on placeholders with PLACEHOLDER_SKIP, never by a
 * loosened threshold. Everything else (loading, layout, structure, keyboard,
 * reduced motion, first paint, the request and draw budgets, and the pixel
 * truth, which compares the canvas with whatever frame files are there) runs
 * on them unchanged.
 */
export const PLACEHOLDER_FRAMES: boolean = (() => {
  try {
    return JSON.parse(readFileSync("public/films/palace-00/manifest.json", "utf8")).placeholder === true;
  } catch {
    return false;
  }
})();

export const PLACEHOLDER_SKIP = "placeholder frames in public/films (scripts/film/placeholder.mjs): this check judges the real footage";
