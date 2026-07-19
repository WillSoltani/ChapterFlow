import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const css = source("app/globals.css");
const hero = source("components/landing/recall/RecallHeroSplit.tsx");
const dissolve = source("components/landing/recall/DissolveWord.tsx");

function selectorForOffset(stylesheet: string, offset: number): string {
  const before = stylesheet.slice(0, offset);
  const open = before.lastIndexOf("{");
  const previousClose = before.lastIndexOf("}", open);
  return before.slice(previousClose + 1, open).trim();
}

function infiniteSelectors(stylesheet: string): string[] {
  return [...stylesheet.matchAll(/animation\s*:[^;{}]*\binfinite\b[^;{}]*;/g)].map(
    (match) => selectorForOffset(stylesheet, match.index ?? 0),
  );
}

test("only genuine loading and current-step CSS motion remains continuous", () => {
  assert.deepEqual(infiniteSelectors(css).sort(), [".animate-shimmer", ".bd-dot-pulse"]);
});

test("the retention entrance is finite and settles in its meaningful final state", () => {
  assert.match(hero, /className="cf-curve-shimmer"/);

  for (const selector of [".cf-curve-shimmer", ".cf-curve-pulse"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(rule, `${selector} must have a live rule`);
    assert.doesNotMatch(rule[1], /\binfinite\b/);
    const animation = rule[1].match(/animation\s*:\s*([^;]+);/);
    assert.ok(animation, `${selector} must declare its finite entrance`);
    const cycles = animation[1].match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:both|forwards|backwards|none)?\s*$/);
    assert.ok(cycles, `${selector} must declare an explicit iteration count`);
    assert.ok(Number(cycles[1]) <= 2, `${selector} may run at most two cycles`);
  }
});

test("Recall decorative motion is one-shot, pointer-driven, or static", () => {
  assert.doesNotMatch(css, /@keyframes\s+(?:rl-dot|rl-float|rl-blink|rl-aurora)\b/);
  assert.doesNotMatch(css, /animation\s*:\s*rl-(?:float|blink|aurora)\b/);

  const sheen = css.match(/\.rl-hero-sheen\s*\{([\s\S]*?)\}/);
  assert.ok(sheen);
  assert.match(sheen[1], /animation\s*:\s*rl-sheen\b/);
  assert.doesNotMatch(sheen[1], /\binfinite\b/);

  assert.match(hero, /FSRS(?:&#8209;|-)5 model/);
  assert.doesNotMatch(hero, /FSRS(?:&#8209;|-)5 live/);
  assert.match(hero, /onPointerMove/);
  assert.match(hero, /onPointerLeave/);
});

test("the hero playhead sweeps once, settles, and still supports pointer scrub", () => {
  assert.doesNotMatch(hero, /%\s*\(dur\s*\+\s*hold\)/);
  assert.match(hero, /if \(frac < 1\)[\s\S]*requestAnimationFrame\(tick\)/);
  assert.match(hero, /else \{[\s\S]*raf = 0;[\s\S]*draw\(T_MAX\)/);
  assert.match(hero, /draw\(T_MAX\)/);
  assert.match(hero, /onPointerMove=\{onMove\}/);
  assert.match(hero, /onPointerLeave=\{onLeave\}/);
});

test("the disintegration signature completes once and leaves readable final text", () => {
  assert.doesNotMatch(dissolve, /%\s*period/);
  assert.doesNotMatch(dissolve, /loops forever/i);
  assert.match(dissolve, /completedRef/);
  assert.match(dissolve, /cancelAnimationFrame/);
});

test("removed dead motion blocks cannot drift back into the global stylesheet", () => {
  for (const name of [
    "cf-marquee-drift",
    "cta-shimmer-sweep",
    "achievement-pulse-edge",
    "bd-pulse-highlight",
    "cr-ring-fill",
    "cr-float",
    "cr-float-alt",
  ]) {
    assert.doesNotMatch(css, new RegExp(`@keyframes\\s+${name}\\b`));
  }
});

test("OS and in-app reduced-motion kill lists stay semantically identical", () => {
  const os = css.match(
    /@media \(prefers-reduced-motion: reduce\) \{\s*:where\(([\s\S]*?)\) \{\s*animation: none !important;/,
  );
  const inApp = css.match(
    /html\[data-motion="reduced"\] :where\(([\s\S]*?)\) \{\s*animation: none !important;/,
  );
  assert.ok(os, "missing consolidated OS reduced-motion kill list");
  assert.ok(inApp, "missing consolidated in-app reduced-motion kill list");
  const normalize = (selectors: string) =>
    selectors
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean)
      .sort();
  assert.deepEqual(normalize(os[1]), normalize(inApp[1]));
});
