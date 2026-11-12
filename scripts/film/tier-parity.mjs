#!/usr/bin/env node
/**
 * tier-parity.mjs — proof that the band-only portrait tiers (<film>-b900,
 * <film>-b1080) put every picture pixel where the legacy full 1080×1920
 * portrait frames (<film>-p) put it.
 *
 * For a phone (390 × 844, DPR 2 → b900) and a tablet (820 × 1180, DPR 2 →
 * b1080) it scrolls to fixed positions in all seven films (prefers-reduced-
 * motion: no breath, only the chapter's stops are drawn (Phase 8,
 * data-film-stops), so every position is one exact frame), waits until the
 * canvas shows that exact frame
 * of the expected tier, reads the canvas pixels, and builds a reference IN
 * THE PAGE from the LEGACY <film>-p file of the same frame with the legacy
 * math: fill with --cf-recall-bg, then draw the 1080×1920 image at
 * framePlacement (cover-fit, breath zoom 0 around 0.5 / 0.45, stage shift).
 * Positions avoid the dissolve (frame 0 of films 1–6) and cover the hero
 * before, inside and after its portrait ramp (frames 150–200).
 *
 * Per position: film, frame, mean absolute difference per channel (0–255),
 * the band's top and bottom edge row (backing px) in both images, and the
 * content shift of the top and bottom half of the band.
 *   - Reference edges: the rows the band (rows 474–1445 of the legacy frame)
 *     covers under the legacy placement (a row is covered when its centre is
 *     inside, as Chrome's drawImage does). The legacy file's bars are baked
 *     WebP, so its band is located by the reference math, not by pixels.
 *   - Live edges: measured in the canvas pixels. Outside the band the live
 *     canvas is the exact clear colour, so the band is the span of rows that
 *     hold any pixel off it; that is the drawn rectangle whatever the picture
 *     shows at its edge (dark films, the hero's ramp bars inside the band).
 *     A band edge row that decoded to the exact clear colour across the whole
 *     row would read inward and fail the position: the check fails closed.
 *   - Shift: the vertical offset (−3…3 rows) that best matches live to the
 *     reference in each half of the band, so the right rectangle holding the
 *     wrong picture rows also fails. "contrast" (how much worse ±3 rows
 *     match) is printed; a low value means a dark, textureless half.
 * Every edge and shift is gated, none is exempt. Exit 1 if an edge differs by
 * more than 1 px, a shift is more than 1 row, the mean is above the bound for
 * the viewport, or a variant other than the expected tier was drawn or cached.
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
/** The band's rows in the legacy 1080×1920 -p frame (zoom 1.6): rows 474–1445. */
const LEGACY_BAND = { y: 474, h: 972 };
/** Largest |live − clear colour| (0–255, any channel) still counted as the clear colour outside the band. */
const OFF_TOL = 0;
/** Content alignment searches shifts −SHIFT…SHIFT rows. */
const SHIFT = 3;
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;

/**
 * Positions: [film index, stop j], from each chapter's reduced-motion stops
 * (read from the page). The hero: every stop (0, 28, 136 before the ramp
 * 150-200, 156 inside, 204 and 240 after); later films skip stops inside the dissolve
 * (frames below 14).
 */
const DISSOLVE = 14;

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

  const stops = await page.$$eval("[data-film-segment]", (els) => els.map((e) => (e.dataset.filmStops ?? "").split(",").map(Number)));
  const POSITIONS = [];
  for (let i = 0; i < FILMS.length; i++) (stops[i] ?? []).forEach((f, j) => (i === 0 || f >= DISSOLVE) && POSITIONS.push([i, j]));
  console.log(`\n[${vp.name}] ${vp.viewport.width}×${vp.viewport.height} DPR ${vp.dpr} → ${vp.tier} · mean bound ${vp.meanMax}`);
  console.log("  film       frame  tier            mean   top live/ref  bottom live/ref  shift t/b  contrast t/b");
  const rows = [];
  for (const [i, j] of POSITIONS) {
    const film = FILMS[i];
    const st = stops[i];
    const frame = st[j];
    // Share of the pinned travel at which stop j is centred (pins.ts reducedStopScroll).
    const p = st.length > 1 ? j / (st.length - 1) : 0;
    const res = await page.evaluate(
      async ({ i, p, film, frame, tier, legacyBand, offTol, SHIFT }) => {
        const segs = [...document.querySelectorAll("[data-film-segment]")];
        const seg = segs[i];
        const stage = segs[0].querySelector("[data-film-stage]").getBoundingClientRect().height;
        const r = seg.getBoundingClientRect();
        const top = r.top + window.scrollY;
        // Reduced motion: stop j of n is centred at j / (n − 1) of the pinned
        // travel (height − stage), kept 2 px inside it.
        const travel = r.height - stage;
        const y = Math.min(top + travel - 2, Math.max(Math.ceil(top) + 2, top + p * travel));
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
        const dx = x0 - (w - w0) * 0.5;
        const dy = shiftY + y0 - (h - h0) * 0.45;
        rctx.drawImage(img, dx, dy, w, h);
        const refPx = rctx.getImageData(0, 0, cw, ch).data;

        const bgRgb = (() => {
          const c = document.createElement("canvas").getContext("2d");
          c.fillStyle = bg;
          c.fillRect(0, 0, 1, 1);
          return c.getImageData(0, 0, 1, 1).data;
        })();
        let sum = 0;
        for (let o = 0; o < live.length; o += 4) sum += Math.abs(live[o] - refPx[o]) + Math.abs(live[o + 1] - refPx[o + 1]) + Math.abs(live[o + 2] - refPx[o + 2]);
        const mean = sum / ((live.length / 4) * 3);

        // REFERENCE band edges: where the legacy placement puts the band's
        // rows (LEGACY_BAND of the 1080×1920 -p frame), in backing px. The
        // legacy file's own bars are baked WebP (ringing, not the clear
        // colour), so its band rectangle is located by the legacy math, which
        // is the reference, not by the code under test.
        const sy = h / img.height;
        const refTopY = dy + legacyBand.y * sy;
        const refBottomY = dy + (legacyBand.y + legacyBand.h) * sy;
        // LIVE band edges, measured in the canvas pixels: outside the band the
        // live canvas is the exact clear colour (fillRect), so the band
        // rectangle is the span of rows holding any pixel off the clear
        // colour. That is the drawn rectangle, whatever the picture shows at
        // its edge (the tier's own WebP noise and bars are never bit-exact
        // clear colour).
        const rowOff = new Uint8Array(ch);
        for (let yy = 0; yy < ch; yy++) {
          let m = 0;
          for (let xx = 0; xx < cw && m <= offTol; xx++) {
            const o = (yy * cw + xx) * 4;
            m = Math.max(m, Math.abs(live[o] - bgRgb[0]), Math.abs(live[o + 1] - bgRgb[1]), Math.abs(live[o + 2] - bgRgb[2]));
          }
          rowOff[yy] = m > offTol ? 1 : 0;
        }
        const liveTop = rowOff.indexOf(1);
        const liveBottom = rowOff.lastIndexOf(1);
        // Content alignment: the vertical shift (−SHIFT…SHIFT rows) that best
        // matches live to reference, separately in the top and bottom half of
        // the band, so a band drawn at the right rectangle with the wrong
        // picture rows in it also fails. `contrast` = how much worse the
        // next-best shift two rows away matches (0 = textureless window).
        const align = (y0r, y1r) => {
          const a = Math.max(SHIFT, Math.ceil(y0r));
          const b = Math.min(ch - SHIFT, Math.floor(y1r));
          const sad = [];
          for (let s = -SHIFT; s <= SHIFT; s++) {
            let t = 0;
            let n = 0;
            for (let yy = a; yy < b; yy += 2) {
              for (let xx = 0; xx < cw; xx += 2) {
                const o = (yy * cw + xx) * 4;
                const r = ((yy + s) * cw + xx) * 4;
                t += Math.abs(live[o] - refPx[r]) + Math.abs(live[o + 1] - refPx[r + 1]) + Math.abs(live[o + 2] - refPx[r + 2]);
                n += 3;
              }
            }
            sad.push(n ? t / n : 0);
          }
          let best = 0;
          for (let k = 1; k < sad.length; k++) if (sad[k] < sad[best]) best = k;
          const atZero = sad[SHIFT];
          const far = Math.min(sad[0], sad[sad.length - 1]);
          return { shift: best - SHIFT, contrast: far - atZero, sad: sad.map((v) => +v.toFixed(2)) };
        };
        const mid = (refTopY + refBottomY) / 2;
        const alignTop = align(refTopY + 2, mid);
        const alignBottom = align(mid, refBottomY - 2);
        return {
          mean,
          refTop: refTopY,
          refBottom: refBottomY,
          liveTop,
          liveBottom,
          alignTop,
          alignBottom,
          variant: cache.variant.name,
          cw,
          ch,
          others,
        };
      },
      { i, p, film, frame, tier: vp.tier, legacyBand: LEGACY_BAND, offTol: OFF_TOL, SHIFT },
    );
    if (res.error) {
      failed = true;
      console.log(`  ${film}  f${String(frame + 1).padStart(4, "0")}  ERROR ${res.error}`);
      continue;
    }
    // Reference rows: the first and last row whose CENTRE lies inside the
    // legacy band (Chrome's drawImage covers a row when its centre is inside
    // the destination rect; it does not antialias the rect's edges).
    const refTop = Math.ceil(res.refTop - 0.5);
    const refBottom = Math.ceil(res.refBottom - 0.5) - 1;
    const dTop = res.liveTop < 0 ? Infinity : Math.abs(res.liveTop - refTop);
    const dBottom = res.liveBottom < 0 ? Infinity : Math.abs(res.liveBottom - refBottom);
    // Every edge and every shift is gated; nothing is exempt.
    const reasons = [];
    if (dTop > 1) reasons.push("top edge");
    if (dBottom > 1) reasons.push("bottom edge");
    if (Math.abs(res.alignTop.shift) > 1) reasons.push("top shift");
    if (Math.abs(res.alignBottom.shift) > 1) reasons.push("bottom shift");
    if (res.mean > vp.meanMax) reasons.push("mean");
    if (res.variant !== `${film}-${vp.tier}`) reasons.push("variant");
    if (reasons.length) failed = true;
    rows.push(res.mean);
    const sh = (a) => `${a.shift >= 0 ? "+" : ""}${a.shift}`.padStart(3);
    console.log(
      `  ${film}  f${String(frame + 1).padStart(4, "0")}  ${res.variant.padEnd(15)} ${res.mean.toFixed(2).padStart(5)}   ${String(res.liveTop).padStart(4)}/${String(refTop).padEnd(4)}    ${String(res.liveBottom).padStart(4)}/${String(refBottom).padEnd(4)}    ${sh(res.alignTop)} ${sh(res.alignBottom)}  ${res.alignTop.contrast.toFixed(1).padStart(5)} ${res.alignBottom.contrast.toFixed(1).padStart(5)}${reasons.length ? `   << FAIL (${reasons.join(", ")})` : ""}`,
    );
    if (process.env.DEBUG) console.log(`      ref ${res.refTop.toFixed(2)}..${res.refBottom.toFixed(2)} sad top ${res.alignTop.sad.join(" ")} | bottom ${res.alignBottom.sad.join(" ")}`);
  }
  const caches = await page.evaluate(() => [...window.__filmCaches.keys()]);
  const strays = caches.filter((key) => !key.includes(`-${vp.tier}@`));
  if (strays.length) {
    failed = true;
    console.log(`  caches of another variant were created: ${strays.join(", ")}   << FAIL`);
  }
  if (rows.length) console.log(`  ${rows.length} positions · mean of means ${(rows.reduce((a, b) => a + b, 0) / rows.length).toFixed(2)} · worst ${Math.max(...rows).toFixed(2)}`);
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
