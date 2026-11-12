import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { BookReelLanding } from "./BookReelLanding";
import { FilmBackdrop } from "./FilmBackdrop";
import type { BandTier, FilmManifest, FilmVariant } from "./types";
import { FAILSAFE_MS, READABLE_RULES, failsafeCss, noscriptCss } from "./readable-layout";

/**
 * The readable page (no script, and the scripts-failed failsafe) checked
 * against the landing's real server HTML: every rule targets distinct
 * elements (one `animation` each), and no stage grid keeps its children in
 * one shared cell (the pile the review found: five Day labels, the hero's
 * caption over its buttons, "Locked." over "One book. Kept.").
 */

const html = renderToStaticMarkup(<BookReelLanding />);
const doc = new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
const reel = doc.querySelector("[data-film-reel]")!;

const matchesRule = (el: Element, r: (typeof READABLE_RULES)[number]) =>
  r.outside ? el.matches(r.sel) : el.matches(`[data-film-reel] ${r.sel}`);
const decl = (r: (typeof READABLE_RULES)[number]) => new Map(r.decl);

test("the server HTML has the reel, its stage grids and later pins", () => {
  assert.ok(reel);
  assert.ok(doc.querySelectorAll("[data-film-segment]").length === 7);
  assert.ok(doc.querySelectorAll(".film-stage-grid").length >= 10);
  assert.ok(doc.querySelectorAll("[data-frame-later]").length > 10);
});

test("each element is targeted by at most one readable-page rule (one animation each)", () => {
  for (const el of doc.querySelectorAll("*")) {
    const hits = READABLE_RULES.filter((r) => matchesRule(el, r)).map((r) => r.name);
    assert.ok(hits.length <= 1, `${el.tagName}.${el.className} matched ${hits.join(", ")}`);
  }
});

test("every stage grid becomes a flow its children stack in, except the hero's two-row grid", () => {
  for (const grid of doc.querySelectorAll(".film-stage-grid")) {
    const rules = READABLE_RULES.filter((r) => matchesRule(grid, r));
    assert.equal(rules.length, 1, `grid ${grid.outerHTML.slice(0, 80)} has one rule`);
    const d = decl(rules[0]!);
    assert.equal(d.get("position"), "relative");
    if (grid.matches("[data-stack=hero]")) {
      // Rows 1 and 3 (first and last child): two children never share a cell.
      assert.equal(grid.children.length, 2, "the hero grid has a top block and a bottom block");
    } else {
      assert.equal(d.get("display"), "flex", `grid with ${grid.children.length} children is a flex column`);
      assert.equal(d.get("flex-direction"), "column");
    }
  }
  // The grids the review found piled are among them.
  const bottoms = [...doc.querySelectorAll(".film-stage-grid[data-anchor=bottom]")];
  assert.ok(bottoms.some((g) => g.children.length >= 5), "the Day labels grid");
});

test("every later pin is shown by the readable page; the Hall wall prose is not", () => {
  const later = READABLE_RULES.find((r) => r.name === "film-ro-later")!;
  for (const el of doc.querySelectorAll("[data-frame-later]")) {
    if (el.classList.contains("hall-text")) assert.equal(matchesRule(el, later), false);
    else assert.equal(matchesRule(el, later), true, (el.textContent ?? "").slice(0, 40));
  }
  assert.equal(decl(later).get("visibility"), "visible");
});

test("every pin and scrim is shown in full by the readable page, over the inline styles the film code may have written", () => {
  const later = READABLE_RULES.find((r) => r.name === "film-ro-later")!;
  const first = READABLE_RULES.find((r) => r.name === "film-ro-pin")!;
  const pins = doc.querySelectorAll("[data-frame-pin], [data-frame-scrim]");
  assert.ok(pins.length > 40);
  for (const el of pins) {
    const r = el.hasAttribute("data-frame-later") ? later : first;
    assert.equal(matchesRule(el, r), true, (el.textContent ?? "").slice(0, 40));
  }
  for (const r of [later, first]) {
    const d = decl(r);
    assert.equal(d.get("visibility"), "visible");
    assert.equal(d.get("opacity"), "1");
    assert.equal(d.get("transform"), "none");
  }
  // The pre-hydration hold (the backwards fill) hides only later pins.
  const css = failsafeCss();
  assert.match(css, /@keyframes film-ro-later\{from\{visibility:hidden\}/);
  assert.doesNotMatch(css, /@keyframes film-ro-pin\{from/);
});

test("segments and stages lose their scroll length; the canvas layer scrolls away", () => {
  for (const seg of doc.querySelectorAll("[data-film-segment]")) {
    const r = READABLE_RULES.filter((x) => matchesRule(seg, x));
    assert.equal(r.length, 1);
    assert.equal(decl(r[0]!).get("height"), "auto");
    const stage = seg.querySelector("[data-film-stage]")!;
    const s = READABLE_RULES.filter((x) => matchesRule(stage, x));
    assert.equal(s.length, 1);
    assert.equal(decl(s[0]!).get("position"), "relative");
  }
  const canvas = doc.querySelector(".film-canvas")!;
  const c = READABLE_RULES.filter((x) => matchesRule(canvas, x));
  assert.equal(c.length, 1);
  assert.equal(decl(c[0]!).get("position"), "absolute");
});

test("failsafe sheet: one zero-length animation per rule after FAILSAFE_MS, later pins hidden until then", () => {
  const css = failsafeCss();
  for (const r of READABLE_RULES) {
    assert.ok(css.includes(`animation:${r.name} 0s linear ${FAILSAFE_MS}ms both`), r.name);
    assert.ok(css.includes(`@keyframes ${r.name}{`), r.name);
  }
  assert.ok(css.includes("@keyframes film-ro-later{from{visibility:hidden}to{visibility:visible;opacity:1;transform:none;pointer-events:auto}}"));
  // Scoped to an unarmed reel; the canvas layer through :has() on its sibling.
  assert.ok(css.includes("[data-film-reel]:not([data-film-armed]) [data-frame-later]:not(.hall-text){"));
  assert.ok(css.includes(".film-canvas:has(~ [data-film-reel]:not([data-film-armed])){"));
  assert.ok(css.includes("[data-film-reel]:not([data-film-armed]) .hall-text{visibility:hidden}"));
  assert.ok(!css.includes("!important"), "animations do not take !important");
});

test("noscript sheet: the same rules at once, with !important, plus no canvas and no wall prose", () => {
  const css = noscriptCss();
  for (const r of READABLE_RULES) {
    const sel = r.outside ? r.sel : `[data-film-reel] ${r.sel}`;
    assert.ok(css.includes(`${sel}{`), r.name);
    for (const [p, v] of r.decl) assert.ok(css.includes(`${p}:${v}!important`), `${r.name} ${p}`);
  }
  assert.ok(css.includes("[data-film-reel] .hall-text{display:none!important}"));
  assert.ok(css.includes(".film-canvas canvas{display:none!important}"));
});

test("the server HTML carries the failsafe sheet before the reel and the noscript sheet", () => {
  assert.ok(html.indexOf(failsafeCss()) >= 0, "failsafe sheet rendered");
  assert.ok(html.indexOf(failsafeCss()) < html.indexOf("data-film-reel"), "before any pin");
  assert.ok(html.includes("<noscript>"), "noscript sheet rendered");
});

test("the hero poster is marked as a band poster only when the first film has tiers", () => {
  const poster = doc.querySelector("[data-film-poster]")!;
  assert.ok(poster);
  assert.ok(poster.hasAttribute("data-film-band"), "palace-00 has band tiers");
  // A first film without tiers: no band marker, so the portrait CSS does not
  // squeeze its landscape poster into a 9:16 box (the canvas cover-fits it).
  const v = (name: string): FilmVariant => ({ name, count: 2, pad: 4, ext: "webp", width: 1920, height: 1080, poster: `/f/${name}/poster.webp`, base: `/f/${name}` });
  const film: FilmManifest = { name: "x", landscape: v("x"), bands: [] as BandTier[] };
  const plain = renderToStaticMarkup(<FilmBackdrop reel={[film]}>{null}</FilmBackdrop>);
  const p2 = new JSDOM(`<!doctype html><body>${plain}</body>`).window.document.querySelector("[data-film-poster]")!;
  assert.ok(p2);
  assert.equal(p2.hasAttribute("data-film-band"), false);
});

test("no start-button zone is server-rendered as off: the readable page shows every pin, so the nav must count them", () => {
  // Phase 7 review: the Home chapter's start pin was server-rendered with
  // data-cta-off. When the film code never runs, the failsafe shows that
  // button while the nav still read it as off and showed its own: two
  // primary start buttons. Only the mounted FramePin may mark a zone off.
  const zones = [...doc.querySelectorAll("[data-public-sticky-cta-suppress]")];
  assert.ok(zones.length >= 2, "the hero's and the Home chapter's start pins are zones");
  assert.ok(zones.some((z) => z.hasAttribute("data-frame-later")), "a later zone the failsafe reveals");
  for (const z of zones) assert.equal(z.hasAttribute("data-cta-off"), false, z.outerHTML.slice(0, 120));
});
