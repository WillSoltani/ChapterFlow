import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const css = source("app/globals.css");
const dissolve = source("components/landing/recall/DissolveWord.tsx");
const readerShowcase = source("components/landing/recall/RecallReaderShowcase.tsx");

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

test("Recall decorative motion is one-shot, pointer-driven, or static", () => {
  assert.doesNotMatch(css, /@keyframes\s+(?:rl-dot|rl-float|rl-blink|rl-aurora)\b/);
  assert.doesNotMatch(css, /animation\s*:\s*rl-(?:float|blink|aurora)\b/);
});

test("the disintegration signature completes once and leaves readable final text", () => {
  assert.doesNotMatch(dissolve, /%\s*period/);
  assert.doesNotMatch(dissolve, /loops forever/i);
  assert.match(dissolve, /completedRef/);
  assert.match(dissolve, /cancelAnimationFrame/);
});

test("the reader showcase cannot stay hidden under either reduced-motion signal", () => {
  assert.match(readerShowcase, /initial=\{reduced \? false :/);
  // exactOptionalPropertyTypes (WS7-010 flag 4) forbids `whileInView={reduced ? undefined : …}`
  // on framer's strict HTMLMotionProps, so the reduced-motion guard is expressed as a
  // conditional prop spread — runtime-identical: when reduced, `whileInView` is absent, so
  // the scroll-triggered reveal never animates and the demo cannot stay hidden.
  assert.match(readerShowcase, /\{\.\.\.\(reduced \? \{\} : \{ whileInView:/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.recall-reader-demo \{[\s\S]*?opacity:\s*1 !important;[\s\S]*?transform:\s*translateZ\(0\) !important;/,
  );
  assert.match(
    css,
    /html\[data-motion="reduced"\] \.recall-reader-demo \{[\s\S]*?opacity:\s*1 !important;[\s\S]*?transform:\s*translateZ\(0\) !important;/,
  );
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
  assert.deepEqual(normalize(os[1]!), normalize(inApp[1]!));
});
