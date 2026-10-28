#!/usr/bin/env node
/**
 * scrub-smoothness.mjs — runtime smoothness of the reel in headless Chromium.
 *
 * Wheel-scrolls the live landing at three speeds (read / brisk / flick) on a
 * desktop and a phone viewport and reports, per run: rAF fps, rAF stalls
 * (> 50 ms), long tasks, and per film the frame COVERAGE (distinct frames
 * drawn ÷ count), the biggest jump between two consecutive draws, and HOLDS
 * (> 250 ms between draws while the page was still moving — a frame that
 * had not loaded in time, so the engine held the nearest one).
 *
 *   BASE=http://127.0.0.1:3000 node scripts/film/scrub-smoothness.mjs
 *   HEADED=1 …      real window → GPU raster (headless Chromium rasterises in
 *                   software, so its stalls are pessimistic for a full-viewport canvas)
 *   ONLY=desktop/read,phone/brisk …   restrict runs
 */
import { chromium } from "@playwright/test";
import { promises as fs } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const VIEWPORTS = [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }];
const PROFILES = [{ name: "read", step: 60 }, { name: "brisk", step: 180 }, { name: "flick", step: 600 }];
const timeline = JSON.parse(await fs.readFile(new URL("../../components/film/book.timeline.json", import.meta.url), "utf8"));
const counts = Object.fromEntries(Object.entries(timeline.films).map(([k, v]) => [k, v.count]));

const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
for (const vp of VIEWPORTS) {
  for (const prof of PROFILES) {
    if (only && !only.includes(`${vp.name}/${prof.name}`)) continue;
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(BASE + "/?hud=1");
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const w = window;
      w.__draws = []; w.__raf = []; w.__long = [];
      const hud = document.querySelector(".film-hud");
      new MutationObserver(() => w.__draws.push([performance.now(), hud.textContent, window.scrollY])).observe(hud, { childList: true, characterData: true, subtree: true });
      let last = performance.now();
      w.__stalls = [];
      const tick = (t) => {
        const gap = t - last;
        w.__raf.push(gap);
        if (gap > 50) w.__stalls.push({ ms: Math.round(gap), hud: hud.textContent, chrome: document.documentElement.dataset.reelChrome });
        last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__long.push(Math.round(e.duration)); }).observe({ entryTypes: ["longtask"] }); } catch { /* unsupported */ }
    });
    const total = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
    let y = 0;
    const t0 = Date.now();
    while (y < total) { await page.mouse.wheel(0, prof.step); y += prof.step; await page.waitForTimeout(16); }
    await page.waitForTimeout(800);
    const secs = (Date.now() - t0) / 1000;
    const r = await page.evaluate(() => ({ draws: window.__draws, raf: window.__raf, long: window.__long, stalls: window.__stalls }));
    const gaps = r.raf.slice(5);
    const fps = 1000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length);
    const stalls = gaps.filter((g) => g > 50).length;
    const worst = Math.max(...gaps).toFixed(0);
    const parsed = r.draws.map(([t, s, sy]) => { const m = /(palace-\d\d) · f(\d{4})/.exec(s); return m ? { t, film: m[1], f: +m[2], sy } : null; }).filter(Boolean);
    const films = {};
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const F = (films[p.film] ??= { frames: new Set(), maxJump: 0, maxJumpAt: 0, holds: 0 });
      F.frames.add(p.f);
      if (i > 0 && parsed[i - 1].film === p.film) {
        const j = Math.abs(p.f - parsed[i - 1].f);
        if (j > F.maxJump) { F.maxJump = j; F.maxJumpAt = parsed[i - 1].f; }
        if (p.t - parsed[i - 1].t > 250 && p.sy !== parsed[i - 1].sy) F.holds++;
      }
    }
    const perFilm = Object.entries(films).map(([k, v]) => `${k.slice(-2)}:cov${Math.round((100 * v.frames.size) / counts[k])}% jump${v.maxJump}@f${v.maxJumpAt} hold${v.holds}`).join("  ");
    console.log(`[${vp.name}/${prof.name}] ${secs.toFixed(1)}s  rAF ${fps.toFixed(0)}fps  stalls>50ms:${stalls} worst:${worst}ms  longtasks:${r.long.length}(max ${Math.max(0, ...r.long)}ms)  draws:${parsed.length}`);
    console.log("   " + perFilm);
    const top = [...r.stalls].sort((a, b) => b.ms - a.ms).slice(0, 3);
    if (top.length) console.log("   stalls: " + top.map((s) => `${s.ms}ms@${s.hud.replace(/ · (landscape|portrait)/, "")}[${s.chrome}]`).join("  "));
    await ctx.close();
  }
}
await browser.close();
