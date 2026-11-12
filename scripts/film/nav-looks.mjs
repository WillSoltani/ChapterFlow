#!/usr/bin/env node
/**
 * nav-looks.mjs — the five touch-nav looks over the film (globals.css,
 * data-nav-look; ?nav=1…5), side by side for the owner to pick from.
 *
 * Against the local dev server, in a touch-emulated 390 × 844 Chromium page
 * (DPR 2, hasTouch, isMobile: (hover: none) and (pointer: coarse) matches),
 * for every look it captures the top 140 px over three frames (the brightest
 * of five hero frames, the darkest of four Hall frames, a city frame) and joins them
 * into one labelled contact sheet. It also measures each look's legibility:
 * with the canvas and the stage copy hidden and the page painted white (then
 * black), the nav's own fill is all that sits under its text; the brightest
 * (over white) and darkest (over black) fill pixel under the brand text and
 * the menu button give the worst-case contrast of the nav ink
 * (--cf-recall-ink) and of the link ink (--cf-recall-ink-soft, shown on touch
 * screens 1024 px and wider). Every look must keep 4.5:1.
 *
 *   node scripts/film/nav-looks.mjs                (dev server on :3000)
 *   OUT=/path/sheet.png node scripts/film/nav-looks.mjs
 *
 * Default OUT: ~/cf-wt/p5-nav-looks/nav-looks.png (outside the repo). LOCAL
 * ONLY: BASE must be localhost / 127.0.0.1.
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.BASE ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE)) {
  console.error(`nav-looks: BASE must be local (got ${BASE})`);
  process.exit(2);
}
const OUT = process.env.OUT ?? path.join(os.homedir(), "cf-wt/p5-nav-looks/nav-looks.png");

const LOOKS = [
  { n: 1, name: "1 · Tinted pill", note: "panel 86 %, hairline, shadow (recommended)" },
  { n: 2, name: "2 · Solid pill", note: "page colour 96 %, no hairline, no shadow" },
  { n: 3, name: "3 · Top scrim only", note: "no pill; darker scrim behind the nav" },
  { n: 4, name: "4 · Light pill on scrim", note: "panel 72 %, no hairline, full scrim" },
  { n: 5, name: "5 · Lifted pill", note: "lighter grey 90 %, hairline, no shadow" },
];
const W = 390;
const H = 844;
const BAND = 140;
const DPR = 2;
const INK = "#ECEFF6";
const INK_SOFT = "#A2A9BC";

const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: true, isMobile: true });

async function openLook(n) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?hud=1&nav=${n}`);
  await page.waitForFunction(() => document.documentElement.dataset.reelChrome === "film", null, { timeout: 30_000 });
  const coarse = await page.evaluate(() => window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  if (!coarse) throw new Error("(hover: none) and (pointer: coarse) does not match in this profile");
  return page;
}

/** Scroll to progress p of segment `id` (pickActive: a later segment plays over its height). */
async function goTo(page, id, p) {
  const y = await page.evaluate(
    ([id, p]) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      return id === "hero" ? Math.round(p * (r.height - window.innerHeight)) : Math.round(top - window.innerHeight + p * r.height);
    },
    [id, p],
  );
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  // Settled: the drawn frame is the wanted one and the pack has it.
  await page.waitForFunction(
    () => {
      const t = document.querySelector(".film-hud")?.textContent ?? "";
      const drawn = /· f(\d{4})/.exec(t)?.[1];
      const want = /want f(\d{4})/.exec(t)?.[1];
      return drawn && drawn === want;
    },
    null,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(900);
}

const band = (page) => page.screenshot({ clip: { x: 0, y: 0, width: W, height: BAND } });
const meanLum = async (png) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let s = 0;
  for (let i = 0; i < data.length; i += info.channels) s += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return s / (data.length / info.channels);
};

// Pick the frames once (with look 1), by the mean luminance of the top band:
// the brightest of five hero frames, the darkest of four Hall frames, and the
// city skyline.
const probe = await openLook(1);
let brightest = null;
for (const p of [0, 0.2, 0.4, 0.6, 0.8]) {
  await goTo(probe, "hero", p);
  const l = await meanLum(await band(probe));
  if (!brightest || l > brightest.l) brightest = { p, l };
}
const frames = [{ label: "Hero (bright)", id: "hero", p: brightest.p }];
let darkest = null;
for (const p of [0.25, 0.45, 0.65, 0.85]) {
  await goTo(probe, "how-it-works", p);
  const l = await meanLum(await band(probe));
  if (!darkest || l < darkest.l) darkest = { p, l };
}
frames.push({ label: "Hall (dark)", id: "how-it-works", p: darkest.p });
frames.push({ label: "City", id: "library", p: 0.6 });
await probe.close();

const tiles = [];
const legibility = [];
for (const look of LOOKS) {
  const page = await openLook(look.n);
  const row = [];
  for (const f of frames) {
    await goTo(page, f.id, f.p);
    const backdrop = await page.locator("header.rl-nav").evaluate((el) => getComputedStyle(el).backdropFilter || "none");
    if (backdrop !== "none") throw new Error(`look ${look.n}: backdrop-filter is ${backdrop} over the film`);
    const png = await band(page);
    row.push({ png, lum: await meanLum(png) });
  }
  tiles.push(row);

  // Legibility: the nav fill alone over white, then over black.
  await goTo(page, "hero", 0);
  const boxes = await page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    };
    const brand = document.querySelector("header.rl-nav .rl-nav-brand > span:last-child");
    const menu = document.querySelector('header.rl-nav button[aria-label="Open navigation menu"]');
    return [brand, menu].filter(Boolean).map(r);
  });
  const result = { look: look.n };
  for (const [bg, worst] of [["#ffffff", "max"], ["#000000", "min"]]) {
    await page.addStyleTag({
      content:
        `.film-canvas,[data-film-stage],.film-hud{visibility:hidden!important}` +
        `html,body,html[data-reel-chrome],html[data-reel-chrome] body,main,[data-film-body]{background:${bg}!important}` +
        `.rl-nav *{color:transparent!important;-webkit-text-fill-color:transparent!important}.rl-nav svg{visibility:hidden!important}`,
    });
    await page.waitForTimeout(150);
    const { data, info } = await sharp(await page.screenshot({ clip: { x: 0, y: 0, width: W, height: BAND } }))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let pick = null;
    for (const b of boxes) {
      for (let y = Math.ceil((b.y + 2) * DPR); y < Math.floor((b.y + b.h - 2) * DPR); y++)
        for (let x = Math.ceil((b.x + 2) * DPR); x < Math.floor((b.x + b.w - 2) * DPR); x++) {
          const i = (y * info.width + x) * info.channels;
          const px = [data[i], data[i + 1], data[i + 2]];
          const l = lum(px);
          if (!pick || (worst === "max" ? l > pick.l : l < pick.l)) pick = { px, l };
        }
    }
    await page.evaluate(() => document.querySelectorAll("style")[document.querySelectorAll("style").length - 1]?.remove());
    const key = bg === "#ffffff" ? "white" : "black";
    result[key] = { fill: pick.px, ink: contrast(hex(INK), pick.px), inkSoft: contrast(hex(INK_SOFT), pick.px) };
  }
  legibility.push(result);
  await page.close();
}
await browser.close();

// Contact sheet: a header row of frame names, one row per look.
const tw = W * DPR;
const th = BAND * DPR;
const gap = 16;
const labelW = 420;
const headH = 70;
const sheetW = labelW + frames.length * (tw + gap) + gap;
const sheetH = headH + LOOKS.length * (th + gap) + gap;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (w, h, lines) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      lines
        .map(
          (l, i) =>
            `<text x="12" y="${34 + i * 30}" font-family="Helvetica, Arial, sans-serif" font-size="${l.size ?? 24}" fill="${l.fill ?? "#ECEFF6"}">${esc(l.t)}</text>`,
        )
        .join("") +
      `</svg>`,
  );
const comps = [];
frames.forEach((f, c) => {
  comps.push({ input: text(tw, headH, [{ t: f.label, size: 26 }]), left: labelW + gap + c * (tw + gap), top: 8 });
});
LOOKS.forEach((look, r) => {
  const top = headH + r * (th + gap);
  const lg = legibility[r];
  const minC = Math.min(lg.white.ink, lg.white.inkSoft, lg.black.ink, lg.black.inkSoft);
  comps.push({
    input: text(labelW, th, [
      { t: look.name, size: 28 },
      { t: look.note, size: 18, fill: "#A2A9BC" },
      { t: `contrast over white: ink ${lg.white.ink.toFixed(1)}, links ${lg.white.inkSoft.toFixed(1)}`, size: 18, fill: "#A2A9BC" },
      { t: `over black: ink ${lg.black.ink.toFixed(1)}, links ${lg.black.inkSoft.toFixed(1)}`, size: 18, fill: "#A2A9BC" },
      { t: minC >= 4.5 ? "legible (all ≥ 4.5:1)" : "BELOW 4.5:1", size: 18, fill: minC >= 4.5 ? "#8AA2FF" : "#FF7A7A" },
    ]),
    left: 0,
    top,
  });
  tiles[r].forEach((t, c) => comps.push({ input: t.png, left: labelW + gap + c * (tw + gap), top }));
});
await fs.mkdir(path.dirname(OUT), { recursive: true });
await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#1A1C22" } }).composite(comps).png().toFile(OUT);

console.log(`frames: ${frames.map((f, i) => `${f.label} = ${f.id}@${f.p} (top band mean luminance ${tiles[0][i].lum.toFixed(0)})`).join(" · ")}`);
console.log("look  fill/white      ink/white  links/white  fill/black   ink/black  links/black");
let failed = false;
for (const l of legibility) {
  const row = [l.white.ink, l.white.inkSoft, l.black.ink, l.black.inkSoft];
  if (Math.min(...row) < 4.5) failed = true;
  console.log(
    `${l.look}     ${String(l.white.fill).padEnd(14)} ${row[0].toFixed(2).padStart(6)}  ${row[1].toFixed(2).padStart(10)}  ${String(l.black.fill).padEnd(12)} ${row[2].toFixed(2).padStart(6)}  ${row[3].toFixed(2).padStart(10)}`,
  );
}
console.log(`sheet: ${OUT}`);
if (failed) {
  console.error("nav-looks: a look is below 4.5:1");
  process.exit(1);
}
