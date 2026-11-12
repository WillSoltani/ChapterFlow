#!/usr/bin/env node
/**
 * scrub-quality.mjs — frame LOADING quality of the reel: one steady,
 * time-based scroll down the whole reel per device profile, then the page's
 * own counters (window.__filmStats, see components/film/frame-cache.ts) next
 * to what the network actually saw.
 *
 * Per profile it prints: frame requests on the network, distinct frames,
 * duplicates, frame requests per variant directory (palace-03, palace-03-b900,
 * …: which tier the profile drew), the counters, the exact-draw share and the mean fallback
 * distance. Exits non-zero if any profile refetched a frame or ran more than
 * 4 frame fetches at once.
 *
 *   npm run film:quality                      (dev server or `next start` on :3000)
 *   ONLY=desktop-chromium,phone-webkit npm run film:quality
 *   SPEED=400 …                              px/s for every profile (default 600 phones, 900 desktop)
 *
 * Profiles:
 *   phone-webkit         iPhone 14 descriptor (WebKit)
 *   phone-chromium-slow  Pixel 7 descriptor, CPU 4× slower, Fast 4G, no
 *                        navigator.deviceMemory (so the small phone budget applies)
 *   desktop-chromium     1440 × 900
 *
 * LOCAL ONLY by default. The production site rate-limits per IP, and a pass is
 * ~1,700 frame requests; BASE must be localhost / 127.0.0.1 unless both
 * ALLOW_REMOTE=1 and MAX_REQUESTS=<n> are set (every request past n is aborted).
 */
import { chromium, webkit, devices } from "@playwright/test";

const BASE = (process.env.BASE ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE);
const MAX_REQUESTS = Number(process.env.MAX_REQUESTS ?? 0);
if (!isLocal && !(process.env.ALLOW_REMOTE === "1" && MAX_REQUESTS > 0)) {
  console.error(
    `scrub-quality: refusing non-local BASE ${BASE}.\n` +
      "  The live site rate-limits per IP and one pass is ~1,700 frame requests.\n" +
      "  Measure locally, or set BOTH ALLOW_REMOTE=1 and MAX_REQUESTS=<cap>.",
  );
  process.exit(2);
}

// Chrome DevTools' "Fast 4G" preset (throughput in bytes/s, latency in ms).
const FAST_4G = { offline: false, downloadThroughput: (9e6 / 8) * 0.9, uploadThroughput: (1.5e6 / 8) * 0.9, latency: 60 * 2.75 };

const PROFILES = [
  { name: "phone-webkit", browser: "webkit", context: { ...devices["iPhone 14"] }, speed: 600 },
  {
    name: "phone-chromium-slow",
    browser: "chromium",
    context: { ...devices["Pixel 7"] },
    speed: 600,
    slow: true,
  },
  { name: "desktop-chromium", browser: "chromium", context: { viewport: { width: 1440, height: 900 } }, speed: 900 },
];

const FRAME_RE = /\/films\/[^/?#]+\/f_\d+\.\w+/;
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const speedOverride = process.env.SPEED ? Number(process.env.SPEED) : null;

const launched = {};
async function browserFor(kind) {
  launched[kind] ??= await (kind === "webkit" ? webkit : chromium).launch({ headless: process.env.HEADED !== "1" });
  return launched[kind];
}

let failed = false;
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
    await page.route("**/*", (route) => {
      requests++;
      if (requests > MAX_REQUESTS) {
        capped = true;
        return route.abort();
      }
      return route.continue();
    });
  }
  const frameRequests = [];
  page.on("request", (req) => {
    if (FRAME_RE.test(req.url())) frameRequests.push(req.url());
  });

  if (prof.slow) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", FAST_4G);
  }

  await page.goto(BASE + "/?hud=1", { waitUntil: "load", timeout: 180_000 });
  await page.waitForFunction(() => !!window.__filmStats, null, { timeout: 60_000 });
  await page.waitForTimeout(2000);

  const speed = speedOverride ?? prof.speed;
  const run = await page.evaluate(
    (pxPerSec) =>
      new Promise((resolve) => {
        const segs = [...document.querySelectorAll("[data-film-segment]")];
        const last = segs[segs.length - 1];
        const end = last
          ? Math.min(last.getBoundingClientRect().bottom + window.scrollY - window.innerHeight, document.documentElement.scrollHeight - window.innerHeight)
          : document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, 0);
        let t0 = 0;
        let prev = 0;
        let worst = 0;
        let ticks = 0;
        const step = (t) => {
          if (!t0) t0 = prev = t;
          worst = Math.max(worst, t - prev);
          prev = t;
          ticks++;
          const y = Math.min(end, ((t - t0) / 1000) * pxPerSec);
          window.scrollTo(0, y);
          if (y >= end) resolve({ end, secs: (t - t0) / 1000, worst, ticks });
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    speed,
  );
  await page.waitForTimeout(1500);
  const stats = await page.evaluate(() => ({ ...window.__filmStats }));
  // The scrub loop at rest (the visitor stopped at the end of the reel).
  await page.waitForTimeout(2000);
  const rest = await page.evaluate(() => ({ ...window.__filmStats }));
  await ctx.close();

  const distinct = new Set(frameRequests).size;
  const draws = stats.exactDraws + stats.fallbackDraws;
  const exactShare = draws ? (100 * stats.exactDraws) / draws : 0;
  const meanFallback = stats.fallbackDraws ? stats.fallbackDistanceSum / stats.fallbackDraws : 0;
  const meanAll = draws ? stats.fallbackDistanceSum / draws : 0;
  const bad = stats.refetches > 0 || stats.maxFetchInFlight > 4;
  if (bad) failed = true;

  console.log(
    `[${prof.name}] ${speed}px/s · ${Math.round(run.end)}px in ${run.secs.toFixed(1)}s · rAF ${(run.ticks / run.secs).toFixed(0)}fps, longest frame ${Math.round(run.worst)}ms${capped ? " · CAPPED by MAX_REQUESTS" : ""}`,
  );
  console.log(`   network: ${frameRequests.length} frame requests for ${distinct} distinct frames (${frameRequests.length - distinct} duplicates)`);
  const perDir = new Map();
  for (const u of frameRequests) {
    const dir = /\/films\/([^/?#]+)\//.exec(u)?.[1] ?? "?";
    perDir.set(dir, (perDir.get(dir) ?? 0) + 1);
  }
  console.log(`   by variant: ${[...perDir].sort(([a], [b]) => a.localeCompare(b)).map(([d, n]) => `${d} ${n}`).join(" · ") || "none"}`);
  console.log(
    `   stats:   fetches ${stats.fetches} · refetches ${stats.refetches} · decodes ${stats.decodes} · redecodes ${stats.redecodes} · evictions ${stats.evictions} · maxFetchInFlight ${stats.maxFetchInFlight}/${stats.fetchLimit} · maxDecodeInFlight ${stats.maxDecodeInFlight}/${stats.decodeLimit}`,
  );
  console.log(
    `   draws:   ${draws} · exact ${exactShare.toFixed(1)}% · mean fallback distance ${meanFallback.toFixed(2)} frames (${meanAll.toFixed(2)} over all draws)${bad ? "   << FAIL" : ""}`,
  );
  console.log(
    `   loop:    canvasResizes ${stats.canvasResizes} · geometryMeasures ${stats.geometryMeasures} · ticksWorked ${stats.ticksWorked} · ticksSkipped ${stats.ticksSkipped} · ` +
      `next 2 s at rest: worked +${rest.ticksWorked - stats.ticksWorked}, skipped +${rest.ticksSkipped - stats.ticksSkipped}`,
  );
}
for (const b of Object.values(launched)) await b.close();
process.exit(failed ? 1 : 0);
