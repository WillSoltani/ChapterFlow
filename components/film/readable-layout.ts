/**
 * The reel as a plain readable page (Phase 6): one rule set, used twice.
 *
 *   • <noscript> (scripting off): applied at once, as !important rules.
 *   • The failsafe (scripting on, but the film code never arms the reel:
 *     chunks blocked, failed or broken): applied after FAILSAFE_MS by
 *     zero-length CSS animations with fill `both`, with no JavaScript. Before
 *     the delay the backwards fill holds later pins hidden (the clean
 *     pre-hydration state); once the reel arms (data-film-armed) the
 *     selectors stop matching and the film layout is back.
 *
 * The layout: every chapter is as tall as its copy (no multi-screen empty
 * stages), every pin shows in reading order, the hero keeps one screen over
 * its poster (the poster layer scrolls away with it instead of staying
 * fixed over the page and its footer), and the decorative Hall wall prose
 * stays out. A stage grid places all its children in ONE cell (grid-row 2),
 * so a grid with several pins (the hero's caption, the Day labels, "Locked."
 * and "One book. Kept.") would pile them up: those grids become flex columns.
 *
 * One animation per element: `animation` is a single property, so two rules
 * matching the same element would cancel each other. The selectors below are
 * disjoint (a test checks the DOM roles they target never overlap), and a
 * rule never targets a pin's container AND the pin.
 *
 * Pure: no DOM, no React. FilmBackdrop renders both style sheets.
 */

/**
 * No JavaScript arms the reel within this time: show the readable page. 8 s:
 * a healthy slow phone (Fast 4G, 4× CPU) arms in well under that
 * (docs/FILM_REEL.md, First paint), so it never sees the switch; the hidden
 * lines belong to later frames, so a failed page loses nothing important on
 * its first screen by waiting.
 */
export const FAILSAFE_MS = 8000;

export type ReadableRule = {
  /** Keyframes name (failsafe). */
  name: string;
  /** Selector, relative to the reel container unless `outside`. */
  sel: string;
  decl: ReadonlyArray<readonly [string, string]>;
  /** A sibling of the reel container (the fixed canvas layer). */
  outside?: boolean;
};

const GRID_FLOW: ReadonlyArray<readonly [string, string]> = [
  ["position", "relative"],
  ["inset", "auto"],
  ["display", "flex"],
  ["flex-direction", "column"],
  ["padding-top", "3rem"],
  ["padding-bottom", "3rem"],
];

export const READABLE_RULES: readonly ReadableRule[] = [
  // Copy of later frames. The Hall wall prose is decoration laid over the
  // stage (aria-hidden): it stays hidden.
  { name: "film-ro-later", sel: "[data-frame-later]:not(.hall-text)", decl: [["visibility", "visible"]] },
  { name: "film-ro-segment", sel: "[data-film-segment]", decl: [["height", "auto"]] },
  {
    name: "film-ro-stage",
    sel: "[data-film-stage]",
    decl: [
      ["position", "relative"],
      ["top", "auto"],
      ["height", "auto"],
      ["overflow", "visible"],
    ],
  },
  // A column or centre stage: its children stack in reading order.
  { name: "film-ro-grid", sel: ".film-stage-grid:not([data-stack=hero]):not([data-anchor=bottom])", decl: GRID_FLOW },
  // One-line beats (captions, Day labels): stacked, centred pills.
  { name: "film-ro-beats", sel: ".film-stage-grid[data-anchor=bottom]", decl: [...GRID_FLOW, ["align-items", "center"]] },
  // The hero keeps its grid (headline top, lede and buttons bottom: two
  // children, rows 1 and 3) and one screen over the poster.
  {
    name: "film-ro-hero",
    sel: ".film-stage-grid[data-stack=hero]",
    decl: [
      ["position", "relative"],
      ["inset", "auto"],
      ["min-height", "100svh"],
      ["padding-top", "clamp(6rem, 12svh, 8rem)"],
      ["padding-bottom", "3rem"],
    ],
  },
  // The canvas layer (poster included) scrolls away with the hero.
  { name: "film-ro-canvas", sel: ".film-canvas", decl: [["position", "absolute"]], outside: true },
];

const REEL = "[data-film-reel]";
const UNARMED = "[data-film-reel]:not([data-film-armed])";

const body = (decl: ReadableRule["decl"], important: boolean) =>
  decl.map(([p, v]) => `${p}:${v}${important ? "!important" : ""}`).join(";");

/** Scripting off: the readable page at once. */
export function noscriptCss(): string {
  const rules = READABLE_RULES.map((r) => `${r.outside ? r.sel : `${REEL} ${r.sel}`}{${body(r.decl, true)}}`);
  return [
    ...rules,
    // No script: no canvas paint, no decoration, the poster layer shown.
    `${REEL} .hall-text{display:none!important}`,
    ".film-canvas{visibility:visible!important}",
    ".film-canvas canvas{display:none!important}",
  ].join("");
}

/**
 * Scripting on: hidden later pins until the reel arms, and the readable page
 * after `delayMs` if it never does. The fixed canvas layer is a sibling
 * BEFORE the reel container, matched with :has().
 */
export function failsafeCss(delayMs: number = FAILSAFE_MS): string {
  const anim = (name: string) => `animation:${name} 0s linear ${delayMs}ms both`;
  const out: string[] = [];
  for (const r of READABLE_RULES) {
    const sel = r.outside ? `${r.sel}:has(~ ${UNARMED})` : `${UNARMED} ${r.sel}`;
    out.push(`${sel}{${anim(r.name)}}`);
    // The later pins: hidden by the backwards fill until the delay.
    const from = r.name === "film-ro-later" ? "from{visibility:hidden}" : "";
    out.push(`@keyframes ${r.name}{${from}to{${body(r.decl, false)}}}`);
  }
  // Decoration over the stage: hidden until the film code drives it.
  out.push(`${UNARMED} .hall-text{visibility:hidden}`);
  return out.join("");
}
