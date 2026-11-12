#!/usr/bin/env node
/**
 * framing-sheet.mjs — the framing amount on tall phones, for the owner to
 * pick (plan Phase 7; components/film/scrub.ts bandFitScale, ?frame=).
 *
 * 0 fits the band to the screen width (the whole picture shows, smaller);
 * 100 is today's cover fit (bigger picture, the band's sides cut). Against
 * the local dev server, on 390 × 844 and 430 × 932 (touch, mobile, DPR 3),
 * for each amount (?frame=0, 25, 50, 75, 100) it captures three moments (the
 * hero opening, a Hall frame, a city frame) once the canvas draws that exact
 * frame, and joins them into ONE labelled contact sheet: a row per viewport
 * and moment, the five amounts side by side.
 *
 *   node scripts/film/framing-sheet.mjs            (dev server on :3000)
 *   OUT=/path/framing.png node scripts/film/framing-sheet.mjs
 *
 * Default OUT: ~/cf-wt/p7-sheets/framing.png (outside the repo). LOCAL ONLY.
 */
import { chromium } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { contactSheet, goToFrame, HIDE_HUD, localBase, localOnly } from "./sheet-lib.mjs";

const BASE = localBase("framing-sheet");
const OUT = process.env.OUT ?? path.join(os.homedir(), "cf-wt/p7-sheets/framing.png");

const timeline = JSON.parse(await fs.readFile(new URL("../../components/film/book.timeline.json", import.meta.url), "utf8")).films;
const key = (film, k) => timeline[film].keys[k];

const AMOUNTS = [0, 25, 50, 75, 100];
const VIEWPORTS = [
  [390, 844],
  [430, 932],
];
const MOMENTS = [
  ["hero", "palace-00", 0, "Hero opening"],
  ["how-it-works", "palace-01", key("palace-01", "lines_lit") + 44, "Hall of Summary"],
  ["library", "palace-05", key("palace-05", "orbit") + 40, "The city"],
];

const browser = await chromium.launch();
const rows = [];
try {
  for (const [w, h] of VIEWPORTS) {
    // shots[moment][amount]
    const shots = MOMENTS.map(() => []);
    for (const amount of AMOUNTS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      await localOnly(ctx);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/?hud=1&frame=${amount}`);
      await page.waitForFunction(() => document.querySelector("[data-film-reel][data-film-armed]"), null, { timeout: 60_000 });
      for (let i = 0; i < MOMENTS.length; i++) {
        const [id, film, frame] = MOMENTS[i];
        await goToFrame(page, id, frame, timeline[film].count);
        await page.addStyleTag({ content: HIDE_HUD });
        const band = await page.evaluate(() => {
          const caches = window.__filmCaches;
          const drawn = caches ? [...caches.values()].filter((c) => c.lastServed >= 0).map((c) => c.variant.name) : [];
          return drawn.join(",");
        });
        const png = await page.screenshot({ scale: "css" });
        await page.evaluate(() => document.querySelectorAll("style")[document.querySelectorAll("style").length - 1]?.remove());
        shots[i].push({ png, label: `?frame=${amount}${amount === 100 ? " (today)" : amount === 0 ? " (full width)" : ""}` });
        if (!band) console.warn(`framing-sheet: no drawn cache at ${w}x${h} ${id} frame=${amount}`);
      }
      await ctx.close();
    }
    MOMENTS.forEach(([, film, frame, label], i) =>
      rows.push({ title: `${w} × ${h} (touch, DPR 3) · ${label} · ${film} f${frame + 1}`, tiles: shots[i] }),
    );
  }
  const size = await contactSheet(OUT, "Framing on tall phones: 0 = band fitted to the width … 100 = today's cover fit (owner pick, ?frame=)", rows, { perRow: 5 });
  console.log(`framing-sheet: ${OUT} (${size.width} × ${size.height})`);
} finally {
  await browser.close();
}
