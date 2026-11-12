#!/usr/bin/env node
/**
 * a11y-sheets.mjs — Phase 8 owner sheets: the reduced-motion reel stop by
 * stop, and every element whose styling changed for contrast, before and
 * after.
 *
 * Against the local dev server it writes two labelled contact sheets:
 *
 *   reduced-motion.png    every stop of every chapter under reduced motion
 *                         (the OS setting), on 390 × 844 and 1440 × 900,
 *                         each tile labelled with its stop frame
 *   contrast-changes.png  a crop of each element restyled for contrast
 *                         (the City's "Browse all books" ghost button and
 *                         Home's headline: the dense halo), before (the
 *                         plain halo, put back by an injected rule) and
 *                         after, at the frame where it measured worst, with
 *                         the WCAG ratio of each (text colour against the
 *                         real pixels behind it, worst 10 %: the same method
 *                         as e2e/film-a11y.spec.ts)
 *
 *   node scripts/film/a11y-sheets.mjs            (dev server on :3000)
 *   OUT_DIR=/path node scripts/film/a11y-sheets.mjs
 *
 * Default OUT_DIR: ~/cf-wt/p8-sheets (outside the repo). LOCAL ONLY.
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { contactSheet, goToFrame, HIDE_HUD, localBase, localOnly } from "./sheet-lib.mjs";

const BASE = localBase("a11y-sheets");
const OUT_DIR = process.env.OUT_DIR ?? path.join(os.homedir(), "cf-wt/p8-sheets");
const timeline = JSON.parse(await fs.readFile(new URL("../../components/film/book.timeline.json", import.meta.url), "utf8")).films;

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, scale: 0.5 },
  { name: "desktop", width: 1440, height: 900, scale: 0.25 },
];

/** The halo before Phase 8 on the chapters that now use the dense one (globals.css .film-halo::before). */
const PLAIN_HALO =
  '.film-stage-grid[data-halo="dense"] .film-halo::before{background:radial-gradient(ellipse at center,' +
  "color-mix(in srgb, var(--cf-recall-bg) 82%, transparent) 0%," +
  "color-mix(in srgb, var(--cf-recall-bg) 55%, transparent) 45%,transparent 72%)!important}";

/** Elements restyled for contrast: chapter, film, frame (worst before the change), the element, the WCAG minimum. */
const CHANGES = [
  { vp: "desktop", id: "library", film: "palace-05", frame: 110, sel: "#library a.film-btn-ghost", label: "City: “Browse all books” (ghost button)", need: 4.5 },
  { vp: "phone", id: "library", film: "palace-05", frame: 120, sel: "#library a.film-btn-ghost", label: "City: “Browse all books” (ghost button)", need: 4.5 },
  { vp: "desktop", id: "home", film: "palace-06", frame: 111, sel: "#home h2", label: "Home: headline (large text)", need: 3 },
  { vp: "phone", id: "home", film: "palace-06", frame: 111, sel: "#home h2", label: "Home: headline (large text)", need: 3 },
];

const HIDE_INK =
  "[data-frame-pin],[data-frame-pin] *{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important}" +
  "[data-frame-pin] svg{visibility:hidden!important}.film-hud{display:none!important}";

const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

/** WCAG ratio of `sel`'s own text against the real pixels behind it (worst 10 %), and its box. */
async function contrast(page, sel) {
  const item = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const cs = getComputedStyle(el);
    const c = /rgba?\(([^)]+)\)/.exec(cs.color)[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    let alpha = c[3] ?? 1;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) alpha *= Number(getComputedStyle(e).opacity);
    const rects = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== Node.TEXT_NODE || !n.textContent.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const b of r.getClientRects()) rects.push({ x: b.left, y: b.top, w: b.width, h: b.height });
    }
    const box = el.getBoundingClientRect();
    return { color: c.slice(0, 3), alpha, rects, box: { x: box.left, y: box.top, w: box.width, h: box.height } };
  }, sel);
  const tag = await page.addStyleTag({ content: HIDE_INK });
  await frames(page);
  const png = await page.screenshot({ scale: "css" });
  await tag.evaluate((el) => el.remove());
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = [];
  for (const r of item.rects)
    for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(info.height, Math.ceil(r.y + r.h)); y++)
      for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(info.width, Math.ceil(r.x + r.w)); x++) {
        const i = (y * info.width + x) * 3;
        const px = [data[i], data[i + 1], data[i + 2]];
        const t = item.color.map((v, k) => v * item.alpha + px[k] * (1 - item.alpha));
        out.push(ratio(lum(...t), lum(...px)));
      }
  out.sort((a, b) => a - b);
  return { ratio: out[Math.floor(out.length * 0.1)] ?? 0, box: item.box };
}

const browser = await chromium.launch();
try {
  // 1. The reduced-motion reel, stop by stop.
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
    await localOnly(ctx);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?hud=1`);
    await page.waitForFunction(() => document.querySelector("[data-film-reel][data-film-armed]"), null, { timeout: 60_000 });
    await page.waitForTimeout(800);
    const segs = await page.$$eval("[data-film-segment]", (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { id: e.id, film: e.dataset.film, top: r.top + window.scrollY, h: r.height, stops: e.dataset.filmStops.split(",").map(Number) };
      }),
    );
    const stage = await page.evaluate(() => document.querySelector("[data-film-stage]").getBoundingClientRect().height);
    let screens = 0;
    for (const s of segs) {
      screens += s.h / vp.height;
      const tiles = [];
      for (let j = 0; j < s.stops.length; j++) {
        const f = s.stops[j];
        const y = s.top + (s.stops.length > 1 ? (j * (s.h - stage)) / (s.stops.length - 1) : 0);
        const yy = Math.min(s.top + s.h - stage - 2, Math.max(Math.ceil(s.top) + 2, y));
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), yy);
        await page.waitForFunction(
          ([film, f]) => {
            const m = /(palace-\d\d) · f(\d{4})/.exec(document.querySelector(".film-hud")?.textContent ?? "");
            const caches = window.__filmCaches;
            const c = caches ? [...caches.entries()].filter(([k]) => k.startsWith(`${film}@`) || k.startsWith(`${film}-`)).map(([, v]) => v) : [];
            return m && m[1] === film && Number(m[2]) - 1 === f && (!caches || c.some((x) => x.lastServed === f));
          },
          [s.film, f],
          { timeout: 20_000 },
        );
        const tag = await page.addStyleTag({ content: HIDE_HUD });
        await frames(page);
        const shot = await page.screenshot({ scale: "css" });
        await tag.evaluate((el) => el.remove());
        const png = await sharp(shot).resize(Math.round(vp.width * vp.scale)).png().toBuffer();
        tiles.push({ png, label: `stop ${j + 1}/${s.stops.length} · f${f + 1}` });
      }
      rows.push({ title: `${vp.width} × ${vp.height} · ${s.id} (${s.film}) · stops ${s.stops.map((f) => f + 1).join(", ")}`, tiles });
    }
    console.log(`a11y-sheets: ${vp.name} reduced reel ${screens.toFixed(2)} screens, ${segs.reduce((n, s) => n + s.stops.length, 0)} stops`);
    await ctx.close();
  }
  const out1 = path.join(OUT_DIR, "reduced-motion.png");
  const size1 = await contactSheet(out1, "Reduced motion: every stop of every chapter (frame numbers 1-based)", rows, { perRow: 7 });
  console.log(`a11y-sheets: ${out1} (${size1.width} × ${size1.height})`);

  // 2. Contrast changes, before and after.
  const crow = [];
  for (const c of CHANGES) {
    const vp = VIEWPORTS.find((v) => v.name === c.vp);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await localOnly(ctx);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?hud=1`);
    await page.waitForFunction(() => document.querySelector("[data-film-reel][data-film-armed]"), null, { timeout: 60_000 });
    await goToFrame(page, c.id, c.frame, timeline[c.film].count);
    const tiles = [];
    for (const when of ["before", "after"]) {
      const tag = when === "before" ? await page.addStyleTag({ content: PLAIN_HALO }) : null;
      await frames(page);
      const m = await contrast(page, c.sel);
      const hud = await page.addStyleTag({ content: HIDE_HUD });
      await frames(page);
      const pad = 48;
      const clip = {
        x: Math.max(0, m.box.x - pad),
        y: Math.max(0, m.box.y - pad),
        width: Math.min(vp.width, m.box.x + m.box.w + pad) - Math.max(0, m.box.x - pad),
        height: Math.min(vp.height, m.box.y + m.box.h + pad) - Math.max(0, m.box.y - pad),
      };
      const png = await page.screenshot({ clip, scale: "css" });
      await hud.evaluate((el) => el.remove());
      if (tag) await tag.evaluate((el) => el.remove());
      tiles.push({ png, label: `${when}: ${m.ratio.toFixed(2)}:1 (needs ${c.need}:1)` });
      console.log(`a11y-sheets: ${c.label} ${vp.width}×${vp.height} f${c.frame + 1} ${when} ${m.ratio.toFixed(2)}:1`);
    }
    crow.push({ title: `${c.label} · ${vp.width} × ${vp.height} · f${c.frame + 1} (dense halo)`, tiles });
    await ctx.close();
  }
  const out2 = path.join(OUT_DIR, "contrast-changes.png");
  const size2 = await contactSheet(out2, "Contrast: elements restyled in Phase 8, before and after (WCAG, worst 10 % of the real background)", crow, { perRow: 2 });
  console.log(`a11y-sheets: ${out2} (${size2.width} × ${size2.height})`);
} finally {
  await browser.close();
}
