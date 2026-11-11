#!/usr/bin/env node
/**
 * scrub-quality.mjs — frame LOADING quality of the reel: one steady,
 * time-based scroll down the whole reel per device profile, with three stops,
 * then the page's own counters (window.__filmStats, see
 * components/film/frame-cache.ts) next to what the network saw.
 *
 * Per profile it prints: every film request (packs, frames, posters; the
 * film worker's pack requests included) and their bytes, the counters, the
 * exact-draw share, the mean fallback distance, the time until the exact
 * frame is on the canvas after each stop, rAF fps and the longest frame, and
 * the mean decode time and where decodes ran (worker or page).
 *
 *   npm run film:quality                      (`next start` on :3000, or the dev server)
 *   ONLY=desktop-chromium,phone-webkit npm run film:quality
 *   SPEED=400 …                              px/s for every profile (default 600 phones, 900 desktop)
 *   STRICT=1 …                               soft targets fail the run too
 *   OUT=/path/result.json …                  also write the numbers as JSON
 *
 * Profiles (each in pack mode; the desktop one also with ?pack=0):
 *   phone-webkit             iPhone 14 descriptor (WebKit)
 *   phone-chromium-slow      Pixel 7 descriptor, CPU 4× slower, Fast 4G, no
 *                            navigator.deviceMemory (the small phone budget)
 *   desktop-chromium         1440 × 900
 *   desktop-chromium-frames  1440 × 900, ?pack=0 (the per-frame path)
 *
 * Stops: at 30 %, 55 % and 80 % of the pass the scroll halts for 1.5 s; the
 * probe records how long after the halt the canvas shows the exact frame of
 * that position (drawWant = drawAt, no longer changing), or "miss".
 *
 * Hard failures (exit 1). Pack mode: any per-frame request; more than 30
 * film requests for the pass; packBytesRepeated above 0; refetches above 0;
 * exact-draw share below 97 % on phone-webkit and desktop-chromium. Frames
 * mode: refetches above 0, more than 4 fetches in flight. The slow profile:
 * pack throughput above 1.5× Fast 4G (the throttle did not reach the
 * worker; the numbers would be meaningless).
 * Soft targets (TARGET MET / TARGET MISSED; exit 1 only with STRICT=1):
 * phone-chromium-slow mean fallback distance over all draws ≤ 4 frames and
 * ≤ 1,000 ms to the exact frame after each stop; phone-webkit longest frame
 * ≤ 100 ms.
 *
 * Throttling: Chromium applies CDP network emulation per target, and a
 * dedicated worker is its own target. Measured 2026-11-11 (the Chromium of
 * Playwright 1.62): the page target's Fast 4G emulation DOES reach the film
 * worker's requests (pack bytes arrived at 1.01 MB/s). The script re-checks
 * it on every run from the worker's own byte counter (peak throughput over
 * any 2 s) and fails the run when it is above 1.5× Fast 4G.
 * Requests: Playwright reports the worker's requests on the page in Chromium
 * and WebKit (checked 2026-11-11); where the network count of pack requests
 * is below __filmStats.packRequests the script uses the counter and says so.
 *
 * LOCAL ONLY by default. The production site rate-limits per IP; BASE must be
 * localhost / 127.0.0.1 unless both ALLOW_REMOTE=1 and MAX_REQUESTS=<n> are
 * set (every request past n is aborted).
 */
import { chromium, webkit, devices } from "@playwright/test";
import { promises as fs } from "node:fs";

const BASE = (process.env.BASE ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE);
const MAX_REQUESTS = Number(process.env.MAX_REQUESTS ?? 0);
if (!isLocal && !(process.env.ALLOW_REMOTE === "1" && MAX_REQUESTS > 0)) {
  console.error(
    `scrub-quality: refusing non-local BASE ${BASE}.\n` +
      "  The live site rate-limits per IP.\n" +
      "  Measure locally, or set BOTH ALLOW_REMOTE=1 and MAX_REQUESTS=<cap>.",
  );
  process.exit(2);
}

// Chrome DevTools' "Fast 4G" preset (throughput in bytes/s, latency in ms).
const FAST_4G = { offline: false, downloadThroughput: (9e6 / 8) * 0.9, uploadThroughput: (1.5e6 / 8) * 0.9, latency: 60 * 2.75 };

const PROFILES = [
  { name: "phone-webkit", browser: "webkit", context: { ...devices["iPhone 14"] }, speed: 600, exactMin: 97, longestTarget: 100 },
  { name: "phone-chromium-slow", browser: "chromium", context: { ...devices["Pixel 7"] }, speed: 600, slow: true, distTarget: 4, stopTarget: 1000 },
  { name: "desktop-chromium", browser: "chromium", context: { viewport: { width: 1440, height: 900 } }, speed: 900, exactMin: 97 },
  { name: "desktop-chromium-frames", browser: "chromium", context: { viewport: { width: 1440, height: 900 } }, speed: 900, frames: true },
];
const FILM_REQUESTS_MAX = 30;
const STOPS = [0.3, 0.55, 0.8];
const STOP_MS = 1500;

const kindOf = (url) => (/\/pack\.bin/.test(url) ? "pack" : /\/f_\d+\.\w+/.test(url) ? "frame" : /\/poster\.\w+/.test(url) ? "poster" : "other");
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const speedOverride = process.env.SPEED ? Number(process.env.SPEED) : null;
const strict = process.env.STRICT === "1";

const launched = {};
async function browserFor(kind) {
  launched[kind] ??= await (kind === "webkit" ? webkit : chromium).launch({ headless: process.env.HEADED !== "1" });
  return launched[kind];
}

let failed = false;
const results = [];
for (const prof of PROFILES) {
  if (only && !only.includes(prof.name)) continue;
  const browser = await browserFor(prof.browser);
  const ctx = await browser.newContext(prof.context);
  if (prof.slow) {
    await ctx.addInitScript(() => {
      // Safari never exposes deviceMemory; neither do many Android builds.
      try {
        delete Navigator.prototype.deviceMemory;
      } catch {
        /* non-configurable */
      }
      if ("deviceMemory" in navigator) Object.defineProperty(navigator, "deviceMemory", { get: () => undefined });
    });
  }
  const page = await ctx.newPage();

  let requests = 0;
  let capped = false;
  if (!isLocal) {
    await ctx.route("**/*", (route) => {
      requests++;
      if (requests > MAX_REQUESTS) {
        capped = true;
        return route.abort();
      }
      return route.continue();
    });
  }
  // Every film request the browser reports (the worker's included), with the
  // body size of frames and posters (packs: the worker's own byte counter).
  const film = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!/\/films\//.test(url)) return;
    const kind = kindOf(url);
    film.push({
      url,
      kind,
      bytes:
        kind === "pack"
          ? Promise.resolve(0)
          : req
              .response()
              .then(async (r) => (r ? (await r.body().catch(() => Buffer.alloc(0))).length : 0))
              .catch(() => 0),
    });
  });

  if (prof.slow) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", FAST_4G);
  }

  await page.goto(BASE + "/?hud=1" + (prof.frames ? "&pack=0" : ""), { waitUntil: "load", timeout: 240_000 });
  await page.waitForFunction(() => !!window.__filmStats, null, { timeout: 60_000 });
  await page.waitForTimeout(2000);

  const speed = speedOverride ?? prof.speed;
  const run = await page.evaluate(
    ({ pxPerSec, stops, stopMs }) =>
      new Promise((resolve) => {
        const segs = [...document.querySelectorAll("[data-film-segment]")];
        const last = segs[segs.length - 1];
        const end = last
          ? Math.min(last.getBoundingClientRect().bottom + window.scrollY - window.innerHeight, document.documentElement.scrollHeight - window.innerHeight)
          : document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, 0);
        const stopsAt = stops.map((f) => Math.round(f * end));
        const stopResults = [];
        // Pack bytes over time (the worker's counter), for the throttle check.
        const bytes = [];
        let t0 = 0;
        let prev = 0;
        let worst = 0;
        let ticks = 0;
        let y = 0;
        let stopIdx = 0;
        let stopStart = -1;
        let samples = [];
        const step = (t) => {
          if (!t0) t0 = prev = t;
          const dt = t - prev;
          worst = Math.max(worst, dt);
          prev = t;
          ticks++;
          const s = window.__filmStats;
          if (!bytes.length || t - bytes[bytes.length - 1][0] >= 250) bytes.push([t, s.packBytes ?? 0]);
          if (stopStart >= 0) {
            samples.push([t - stopStart, s.drawWant, s.drawAt]);
            if (t - stopStart >= stopMs) {
              // Exact = from the first sample after which drawWant = drawAt =
              // the final wanted frame, through the end of the stop.
              const final = samples[samples.length - 1][1];
              let at = null;
              for (let i = samples.length - 1; i >= 0; i--) {
                const [ms, want, drawn] = samples[i];
                if (want === final && drawn === final) at = ms;
                else break;
              }
              // A build without the draw gauges (before Phase 4) cannot be probed.
              if (final === undefined) stopResults.push({ y: Math.round(y), frame: -1, exactMs: null, na: true });
              else stopResults.push({ y: Math.round(y), frame: final, exactMs: at === null ? null : Math.round(at) });
              stopStart = -1;
              samples = [];
              stopIdx++;
            }
            requestAnimationFrame(step);
            return;
          }
          y = Math.min(end, y + (dt / 1000) * pxPerSec);
          if (stopIdx < stopsAt.length && y >= stopsAt[stopIdx]) {
            y = stopsAt[stopIdx];
            stopStart = t;
          }
          window.scrollTo(0, y);
          if (y >= end && stopStart < 0) resolve({ end, secs: (t - t0) / 1000, worst, ticks, stops: stopResults, bytes });
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    { pxPerSec: speed, stops: STOPS, stopMs: STOP_MS },
  );
  await page.waitForTimeout(1500);
  // Counters a build before Phase 4 does not have read as 0.
  const PACK_FIELDS = ["packRequests", "packBytes", "packBytesRepeated", "packBytesHeld", "packReaims", "packFallbacks", "workerDecodes", "workerDecodeMeanMs", "workerDecodeMaxMs", "mainThreadDecodes", "mainThreadDecodeMeanMs", "mainThreadDecodeMaxMs"];
  const stats = await page.evaluate((fields) => {
    const s = { ...window.__filmStats };
    for (const f of fields) s[f] ??= 0;
    s.mode ??= "frames (no mode counter: build before Phase 4)";
    return s;
  }, PACK_FIELDS);
  // The scrub loop at rest (the visitor stopped at the end of the reel).
  await page.waitForTimeout(2000);
  const rest = await page.evaluate(() => ({ ...window.__filmStats }));
  await ctx.close();

  // Film requests and bytes.
  const by = { pack: [], frame: [], poster: [], other: [] };
  for (const r of film) by[r.kind].push(r);
  const sum = async (list) => (await Promise.all(list.map((r) => r.bytes))).reduce((a, b) => a + b, 0);
  const frameBytes = await sum(by.frame);
  const posterBytes = await sum(by.poster);
  const packNet = by.pack.length;
  const packCount = Math.max(packNet, stats.packRequests);
  const packSource = packNet >= stats.packRequests ? "network" : "__filmStats: the driver did not report every worker request";
  const filmRequests = packCount + by.frame.length + by.poster.length + by.other.length;
  const filmBytes = stats.packBytes + frameBytes + posterBytes;
  const distinctFrames = new Set(by.frame.map((r) => r.url)).size;

  const draws = stats.exactDraws + stats.fallbackDraws;
  const exactShare = draws ? (100 * stats.exactDraws) / draws : 0;
  const meanAll = draws ? stats.fallbackDistanceSum / draws : 0;
  const fps = run.ticks / run.secs;

  // Peak pack throughput over any 2 s window (the worker's counter).
  let peak = 0;
  for (let i = 0; i < run.bytes.length; i++) {
    for (let j = i + 1; j < run.bytes.length; j++) {
      const dt = (run.bytes[j][0] - run.bytes[i][0]) / 1000;
      if (dt >= 2) {
        peak = Math.max(peak, (run.bytes[j][1] - run.bytes[i][1]) / dt);
        break;
      }
    }
  }

  const hard = [];
  const soft = [];
  if (prof.frames) {
    if (stats.refetches > 0) hard.push(`refetches ${stats.refetches}`);
    if (stats.maxFetchInFlight > 4) hard.push(`maxFetchInFlight ${stats.maxFetchInFlight}`);
  } else {
    if (by.frame.length) hard.push(`${by.frame.length} per-frame requests in pack mode`);
    if (filmRequests > FILM_REQUESTS_MAX) hard.push(`${filmRequests} film requests > ${FILM_REQUESTS_MAX}`);
    if (stats.packBytesRepeated > 0) hard.push(`packBytesRepeated ${stats.packBytesRepeated}`);
    if (stats.refetches > 0) hard.push(`refetches ${stats.refetches}`);
    if (prof.exactMin && exactShare < prof.exactMin) hard.push(`exact draws ${exactShare.toFixed(1)}% < ${prof.exactMin}%`);
    if (stats.mode !== "pack") hard.push(`mode ${stats.mode} (fell back: packFallbacks ${stats.packFallbacks})`);
  }
  if (prof.slow && peak > 1.5 * FAST_4G.downloadThroughput) hard.push(`pack throughput ${(peak / 1e6).toFixed(2)} MB/s: the Fast 4G throttle did not reach the worker`);
  if (prof.distTarget !== undefined) soft.push([`mean fallback distance over all draws ${meanAll.toFixed(2)} ≤ ${prof.distTarget}`, meanAll <= prof.distTarget]);
  if (prof.stopTarget !== undefined) {
    for (const s of run.stops) soft.push([`stop at y=${s.y} (f${s.frame + 1}): exact frame after ${s.exactMs ?? "never (> 1500)"} ms ≤ ${prof.stopTarget}`, s.exactMs !== null && s.exactMs <= prof.stopTarget]);
  }
  if (prof.longestTarget !== undefined) soft.push([`longest frame ${Math.round(run.worst)} ms ≤ ${prof.longestTarget}`, run.worst <= prof.longestTarget]);
  if (hard.length) failed = true;
  if (strict && soft.some(([, ok]) => !ok)) failed = true;

  const decodeWhere = [
    stats.workerDecodes ? `worker ${stats.workerDecodes} (mean ${stats.workerDecodeMeanMs.toFixed(1)} ms, max ${Math.round(stats.workerDecodeMaxMs)} ms)` : "",
    stats.mainThreadDecodes ? `page ${stats.mainThreadDecodes} (mean ${stats.mainThreadDecodeMeanMs.toFixed(1)} ms, max ${Math.round(stats.mainThreadDecodeMaxMs)} ms)` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  console.log(
    `\n[${prof.name}] ${prof.frames ? "?pack=0" : "pack mode"} · ${speed}px/s · ${Math.round(run.end)}px in ${run.secs.toFixed(1)}s (3 stops of 1.5 s) · rAF ${fps.toFixed(0)}fps, longest frame ${Math.round(run.worst)}ms${capped ? " · CAPPED by MAX_REQUESTS" : ""}`,
  );
  console.log(
    `   requests: ${filmRequests} film requests · ${packCount} pack (${packSource}) · ${by.frame.length} frame (${distinctFrames} distinct) · ${by.poster.length} poster${by.other.length ? ` · ${by.other.length} other` : ""}`,
  );
  console.log(
    `   bytes:    ${(filmBytes / 1e6).toFixed(1)} MB · packs ${(stats.packBytes / 1e6).toFixed(1)} MB (held ${(stats.packBytesHeld / 1e6).toFixed(1)}, repeated ${stats.packBytesRepeated}) · frames ${(frameBytes / 1e6).toFixed(1)} MB · posters ${(posterBytes / 1e6).toFixed(2)} MB`,
  );
  const perDir = new Map();
  for (const r of film) {
    const dir = /\/films\/([^/?#]+)\//.exec(r.url)?.[1] ?? "?";
    perDir.set(dir, (perDir.get(dir) ?? 0) + 1);
  }
  console.log(`   by variant: ${[...perDir].sort(([a], [b]) => a.localeCompare(b)).map(([d, n]) => `${d} ${n}`).join(" · ") || "none"}`);
  console.log(
    `   stats:    mode ${stats.mode} · packRequests ${stats.packRequests} · reaims ${stats.packReaims} · fallbacks ${stats.packFallbacks} · fetches ${stats.fetches} · refetches ${stats.refetches} · decodes ${stats.decodes} · redecodes ${stats.redecodes} · evictions ${stats.evictions} · maxFetchInFlight ${stats.maxFetchInFlight}/${stats.fetchLimit} · maxDecodeInFlight ${stats.maxDecodeInFlight}/${stats.decodeLimit}`,
  );
  console.log(`   decodes:  ${decodeWhere || "none"}`);
  console.log(`   draws:    ${draws} · exact ${exactShare.toFixed(1)}% · mean fallback distance ${meanAll.toFixed(2)} frames over all draws`);
  console.log(`   stops:    ${run.stops.map((s) => (s.na ? "n/a (no draw gauges in this build)" : `f${s.frame + 1} ${s.exactMs === null ? "miss" : `${s.exactMs} ms`}`)).join(" · ")}`);
  if (prof.slow) console.log(`   network:  peak pack throughput ${(peak / 1e6).toFixed(2)} MB/s over 2 s (Fast 4G ${(FAST_4G.downloadThroughput / 1e6).toFixed(2)} MB/s)`);
  console.log(
    `   loop:     canvasResizes ${stats.canvasResizes} · geometryMeasures ${stats.geometryMeasures} · ticksWorked ${stats.ticksWorked} · ticksSkipped ${stats.ticksSkipped} · ` +
      `next 2 s at rest: worked +${rest.ticksWorked - stats.ticksWorked}, skipped +${rest.ticksSkipped - stats.ticksSkipped}`,
  );
  for (const h of hard) console.log(`   << FAIL: ${h}`);
  for (const [label, ok] of soft) console.log(`   ${ok ? "TARGET MET" : "TARGET MISSED"}: ${label}`);
  results.push({
    profile: prof.name,
    mode: prof.frames ? "frames" : "pack",
    speed,
    secs: +run.secs.toFixed(1),
    fps: +fps.toFixed(1),
    longestMs: Math.round(run.worst),
    filmRequests,
    packRequests: packCount,
    frameRequests: by.frame.length,
    posterRequests: by.poster.length,
    filmBytes,
    packBytes: stats.packBytes,
    packBytesRepeated: stats.packBytesRepeated,
    refetches: stats.refetches,
    exactShare: +exactShare.toFixed(2),
    meanDistanceAll: +meanAll.toFixed(3),
    stops: run.stops,
    workerDecodes: stats.workerDecodes,
    workerDecodeMeanMs: +stats.workerDecodeMeanMs.toFixed(2),
    mainThreadDecodes: stats.mainThreadDecodes,
    mainThreadDecodeMeanMs: +stats.mainThreadDecodeMeanMs.toFixed(2),
    peakPackMBps: +(peak / 1e6).toFixed(3),
    reaims: stats.packReaims,
    hard,
    soft: soft.map(([label, ok]) => ({ label, ok })),
  });
}
for (const b of Object.values(launched)) await b.close();
if (process.env.OUT) await fs.writeFile(process.env.OUT, JSON.stringify(results, null, 2) + "\n");
process.exit(failed ? 1 : 0);
