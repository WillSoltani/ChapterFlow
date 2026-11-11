#!/usr/bin/env node
/**
 * tier-parity.mjs — proof that the band-only portrait tiers (<film>-b900,
 * <film>-b1080) put every picture pixel where the legacy full 1080×1920
 * portrait frames (<film>-p) put it.
 *
 * For a phone (390 × 844, DPR 2 → b900) and a tablet (820 × 1180, DPR 2 →
 * b1080) it scrolls to fixed positions in all seven films (prefers-reduced-
 * motion: no breath, progress quantised to the film's 5 steps, so every
 * position is one exact frame), waits until the canvas shows that exact frame
 * of the expected tier, reads the canvas pixels, and builds a reference IN
 * THE PAGE from the LEGACY <film>-p file of the same frame with the legacy
 * math: fill with --cf-recall-bg, then draw the 1080×1920 image at
 * framePlacement (cover-fit, breath zoom 0 around 0.5 / 0.45, stage shift).
 * Positions avoid the dissolve (frame 0 of films 1–6) and cover the hero
 * before, inside and after its portrait ramp (frames 150–200).
 *
 * Per position: film, frame, mean absolute difference per channel (0–255) and
 * the band's top and bottom edge row (backing px) in both images (the
 * half-height point of the first step in from the canvas edge; on the hero's
 * early frames that is the picture's edge inside the band, whose ramp bars
 * are part of the band). An edge whose step is fainter than EDGE_MIN_STEP in
 * either image is printed with a * and not gated: the legacy WebP smears a
 * faint edge over several rows. Exit 1 if an
 * edge differs by more than 1 px, or the mean is above MEAN_MAX for the
 * viewport, or a variant other than the expected tier was drawn or cached.
 * Exit 0 with a message when the legacy -p directories are absent.
 *
 *   npm run film:parity                 (dev server or `next start` on :3000)
 *   ONLY=phone npm run film:parity
 *
 * LOCAL ONLY by default, like scrub-quality.mjs: BASE must be localhost /
 * 127.0.0.1 unless both ALLOW_REMOTE=1 and MAX_REQUESTS=<n> are set.
 */
import { chromium } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE);
const MAX_REQUESTS = Number(process.env.MAX_REQUESTS ?? 0);
if (!isLocal && !(process.env.ALLOW_REMOTE === "1" && MAX_REQUESTS > 0)) {
  console.error(
    `tier-parity: refusing non-local BASE ${BASE}.\n` +
      "  The live site rate-limits per IP.\n" +
      "  Measure locally, or set BOTH ALLOW_REMOTE=1 and MAX_REQUESTS=<cap>.",
  );
  process.exit(2);
}

const timeline = JSON.parse(await fs.readFile(path.resolve("components/film/book.timeline.json"), "utf8")).films;
const FILMS = Object.keys(timeline);

// The legacy frames are the reference; without them there is nothing to prove.
for (const film of FILMS) {
  const r = await fetch(`${BASE}/films/${film}-p/manifest.json`).catch(() => null);
  if (!r || !r.ok) {
    console.log(`tier-parity: legacy ${film}-p frames are absent (${r ? r.status : "no response"}); nothing to compare against. Skipping.`);
    process.exit(0);
  }
}

/**
 * Mean bound per viewport (0–255 per channel). Edges stay strict (≤ 1 px).
 * The bound is what the brief set unless a measured run showed it is wrong
 * purely through resampling softness (see docs/FILM_REEL.md).
 */
const VIEWPORTS = [
  { name: "phone", viewport: { width: 390, height: 844 }, dpr: 2, tier: "b900", meanMax: 4 },
  { name: "tablet", viewport: { width: 820, height: 1180 }, dpr: 2, tier: "b1080", meanMax: 2 },
];
const STEPS = 5; // FilmSegment reducedSteps default
/** Smallest edge step (row-profile units, 0–255) whose row is gated to ±1 px. */
const EDGE_MIN_STEP = 10;
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;

/** Positions: [film index, quantised step k]. The hero: all six steps (0, 48, 96, 144 before the ramp, 192 inside, 240 after); later films skip k = 0 (the dissolve). */
const POSITIONS = [];
for (let i = 0; i < FILMS.length; i++) for (let k = i === 0 ? 0 : 1; k <= STEPS; k++) POSITIONS.push([i, k]);

const browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
let failed = false;
for (const vp of VIEWPORTS) {
  if (only && !only.includes(vp.name)) continue;
  const ctx = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: vp.dpr, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  if (!isLocal) {
    let requests = 0;
    await page.route("**/*", (route) => (++requests > MAX_REQUESTS ? route.abort() : route.continue()));
  }
  await page.goto(BASE + "/?hud=1", { waitUntil: "load", timeout: 180_000 });
  await page.waitForFunction(() => !!window.__filmCaches && document.querySelectorAll("[data-film-segment]").length > 0, null, { timeout: 60_000 });
  await page.waitForTimeout(1000);

  console.log(`\n[${vp.name}] ${vp.viewport.width}×${vp.viewport.height} DPR ${vp.dpr} → ${vp.tier} · mean bound ${vp.meanMax}`);
  console.log("  film       frame  tier            mean   top live/ref  bottom live/ref");
  const rows = [];
  let gated = 0;
  let edgesSeen = 0;
  for (const [i, k] of POSITIONS) {
    const film = FILMS[i];
    const count = timeline[film].count;
    const p = k === STEPS ? 0.97 : k / STEPS; // quantises to k/STEPS; 0.97 stays inside the segment
    const frame = Math.round((Math.round(p * STEPS) / STEPS) * (count - 1));
    const res = await page.evaluate(
      async ({ i, p, film, frame, tier }) => {
        const segs = [...document.querySelectorAll("[data-film-segment]")];
        const seg = segs[i];
        const stage = segs[0].querySelector("[data-film-stage]").getBoundingClientRect().height;
        const r = seg.getBoundingClientRect();
        const top = r.top + window.scrollY;
        // pickActive inverted: segment 0 scrubs over height − stage, later
        // segments from top − stage over their whole height.
        const y = i === 0 ? top + p * (r.height - stage) : top - stage + p * r.height;
        window.scrollTo(0, Math.round(y));
        const raf = () => new Promise((res) => requestAnimationFrame(res));
        const want = `${tier}`;
        const t0 = performance.now();
        let cache = null;
        for (;;) {
          await raf();
          cache = [...window.__filmCaches.entries()].find(([key]) => key.startsWith(`${film}-${want}@`))?.[1] ?? null;
          const hud = document.querySelector(".film-hud")?.textContent ?? "";
          const m = /(palace-\d\d) · f(\d{4})/.exec(hud);
          if (cache && m && m[1] === film && Number(m[2]) === frame + 1 && cache.has(frame) && cache.lastServed === frame) break;
          if (performance.now() - t0 > 20_000) return { error: `timed out: hud "${hud}", cache ${cache ? cache.variant.name : "none"}` };
        }
        await raf();
        await raf();
        const canvas = document.querySelector(".film-canvas canvas");
        const cw = canvas.width;
        const ch = canvas.height;
        const live = canvas.getContext("2d").getImageData(0, 0, cw, ch).data;
        const others = [...window.__filmCaches.keys()].filter((key) => !key.includes(`-${want}@`));

        // Reference: the legacy full frame with the legacy math.
        const bg = getComputedStyle(canvas).getPropertyValue("--cf-recall-bg").trim() || "#06070A";
        const blob = await (await fetch(`/films/${film}-p/f_${String(frame + 1).padStart(4, "0")}.webp`)).blob();
        const img = await createImageBitmap(blob);
        const ref = document.createElement("canvas");
        ref.width = cw;
        ref.height = ch;
        const rctx = ref.getContext("2d", { alpha: false });
        rctx.fillStyle = bg;
        rctx.fillRect(0, 0, cw, ch);
        const boxH = canvas.parentElement.getBoundingClientRect().height;
        const shiftY = boxH > 0 ? ((stage - boxH) / 2) * (ch / boxH) : 0; // stageShift
        const zoom = 0; // reduced motion: no breath
        // framePlacement(cw, ch, 1080, 1920, zoom, shiftY)
        const scale = Math.max(cw / img.width, ch / img.height);
        const w0 = img.width * scale;
        const h0 = img.height * scale;
        const x0 = (cw - w0) * 0.5;
        const y0 = (ch - h0) * 0.5;
        const w = w0 * (1 + zoom);
        const h = h0 * (1 + zoom);
        rctx.drawImage(img, x0 - (w - w0) * 0.5, shiftY + y0 - (h - h0) * 0.45, w, h);
        const refPx = rctx.getImageData(0, 0, cw, ch).data;

        // Mean |Δ| per channel (RGB), and the band edges. Row profile = mean
        // over the row of the largest channel deviation from the clear colour.
        // An edge is the half-height point of the first step in from the
        // canvas edge: bar level = median of the outer 5 % of rows (always
        // outside the band on a portrait canvas); the step starts at the first
        // row more than 3 above it; its plateau is the median of the 8 rows
        // from 3 rows past that; the edge is the first row at or above half
        // way from bar level to plateau. (A fixed threshold measured the
        // legacy frames' WebP ringing in the bars, 2–6 rows past the band; a
        // threshold relative to the whole picture measured soft contours
        // inside it instead of the band edge.) Where the picture is dark at
        // the band edge, or on the hero's early frames (ramp bars inside the
        // band), the first step is the picture's own edge, in both images.
        const bgRgb = (() => {
          const c = document.createElement("canvas").getContext("2d");
          c.fillStyle = bg;
          c.fillRect(0, 0, 1, 1);
          return c.getImageData(0, 0, 1, 1).data;
        })();
        let sum = 0;
        for (let o = 0; o < live.length; o += 4) sum += Math.abs(live[o] - refPx[o]) + Math.abs(live[o + 1] - refPx[o + 1]) + Math.abs(live[o + 2] - refPx[o + 2]);
        const mean = sum / ((live.length / 4) * 3);
        const edges = (px) => {
          const prof = new Float64Array(ch);
          for (let yy = 0; yy < ch; yy++) {
            let dev = 0;
            for (let xx = 0; xx < cw; xx++) {
              const o = (yy * cw + xx) * 4;
              dev += Math.max(Math.abs(px[o] - bgRgb[0]), Math.abs(px[o + 1] - bgRgb[1]), Math.abs(px[o + 2] - bgRgb[2]));
            }
            prof[yy] = dev / cw;
          }
          const median = (a) => {
            const v = Array.from(a).sort((u, w) => u - w);
            return v[Math.floor(v.length / 2)] ?? 0;
          };
          const outer = Math.max(4, Math.floor(ch * 0.05));
          /** Half-height row of the first step met walking from `from` in direction `dir`. */
          const step = (from, dir) => {
            const bar = median(dir > 0 ? prof.subarray(0, outer) : prof.subarray(ch - outer));
            let y0 = from;
            while (y0 >= 0 && y0 < ch && prof[y0] <= bar + 3) y0 += dir;
            if (y0 < 0 || y0 >= ch) return { row: -1, height: 0 };
            const plateau = [];
            for (let k = 3; k < 11; k++) {
              const yy = y0 + dir * k;
              if (yy >= 0 && yy < ch) plateau.push(prof[yy]);
            }
            const height = Math.max(prof[y0], median(plateau)) - bar;
            const half = bar + 0.5 * height;
            for (let yy = y0 - dir * 3; yy >= 0 && yy < ch; yy += dir) if (prof[yy] >= half) return { row: yy, height };
            return { row: y0, height };
          };
          const t = step(0, 1);
          const b = step(ch - 1, -1);
          return { top: t.row, bottom: b.row, topStep: t.height, bottomStep: b.height };
        };
        return { mean, live: edges(live), ref: edges(refPx), variant: cache.variant.name, cw, ch, others };
      },
      { i, p, film, frame, tier: vp.tier },
    );
    if (res.error) {
      failed = true;
      console.log(`  ${film}  f${String(frame + 1).padStart(4, "0")}  ERROR ${res.error}`);
      continue;
    }
    const dTop = Math.abs(res.live.top - res.ref.top);
    const dBottom = Math.abs(res.live.bottom - res.ref.bottom);
    // An edge whose step is below EDGE_MIN_STEP in either image is printed but
    // not gated: the legacy q78 WebP smears such a faint edge over 3–5 rows
    // (a dark picture at the band edge, or the hero's soft picture bottom), so
    // its row there is not a position. Every bright band edge is gated.
    const gateTop = Math.min(res.live.topStep, res.ref.topStep) >= EDGE_MIN_STEP;
    const gateBottom = Math.min(res.live.bottomStep, res.ref.bottomStep) >= EDGE_MIN_STEP;
    gated += (gateTop ? 1 : 0) + (gateBottom ? 1 : 0);
    edgesSeen += 2;
    const bad = (gateTop && dTop > 1) || (gateBottom && dBottom > 1) || res.mean > vp.meanMax || res.variant !== `${film}-${vp.tier}`;
    if (bad) failed = true;
    rows.push(res.mean);
    console.log(
      `  ${film}  f${String(frame + 1).padStart(4, "0")}  ${res.variant.padEnd(15)} ${res.mean.toFixed(2).padStart(5)}   ${String(res.live.top).padStart(4)}/${String(res.ref.top).padEnd(4)}${gateTop ? " " : "*"}    ${String(res.live.bottom).padStart(4)}/${String(res.ref.bottom).padEnd(4)}${gateBottom ? " " : "*"}${bad ? "   << FAIL" : ""}`,
    );
  }
  const caches = await page.evaluate(() => [...window.__filmCaches.keys()]);
  const strays = caches.filter((key) => !key.includes(`-${vp.tier}@`));
  if (strays.length) {
    failed = true;
    console.log(`  caches of another variant were created: ${strays.join(", ")}   << FAIL`);
  }
  console.log(`  * = edge step below ${EDGE_MIN_STEP} in one image: printed, not gated (${edgesSeen - gated} of ${edgesSeen} edges)`);
  if (rows.length) console.log(`  ${rows.length} positions · mean of means ${(rows.reduce((a, b) => a + b, 0) / rows.length).toFixed(2)} · worst ${Math.max(...rows).toFixed(2)}`);
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
