#!/usr/bin/env node
/**
 * layout-sheets.mjs — Phase 7 owner sheets: every chapter's main moments on
 * phones held sideways and on small phones, to read the compact stage and
 * the small-phone layout at a glance.
 *
 * Against the local dev server (touch, mobile viewport, DPR 3), for each
 * viewport it scrolls every chapter to its main moments (named frames, the
 * copy fully in), waits until the canvas draws that exact frame, and writes
 * two labelled contact sheets:
 *
 *   landscape-phone.png  844 × 390 and 667 × 375
 *   small-phone.png      360 × 740 and 320 × 568
 *
 *   node scripts/film/layout-sheets.mjs            (dev server on :3000)
 *   OUT_DIR=/path node scripts/film/layout-sheets.mjs
 *
 * Default OUT_DIR: ~/cf-wt/p7-sheets (outside the repo). LOCAL ONLY.
 */
import { chromium } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { contactSheet, goToFrame, HIDE_HUD, localBase, localOnly } from "./sheet-lib.mjs";

const BASE = localBase("layout-sheets");
const OUT_DIR = process.env.OUT_DIR ?? path.join(os.homedir(), "cf-wt/p7-sheets");

const timeline = JSON.parse(await fs.readFile(new URL("../../components/film/book.timeline.json", import.meta.url), "utf8")).films;
const key = (film, k) => timeline[film].keys[k];

/** Chapter id, film, frame, caption: each chapter's copy at its fullest. */
const MOMENTS = [
  ["hero", "palace-00", key("palace-00", "doorway") - 16, "Hero: headline, lede, buttons"],
  ["hero", "palace-00", key("palace-00", "through") - 15, "Hero: through the doorway"],
  ["how-it-works", "palace-01", key("palace-01", "lines_lit") + 44, "01 Summary"],
  ["examples", "palace-02", key("palace-02", "room_c") + 25, "02 Examples: third room"],
  ["examples", "palace-02", key("palace-02", "door_ahead") - 12, "02 Examples: the door"],
  ["quiz", "palace-03", key("palace-03", "pulse") + 38, "03 Quiz: locked"],
  ["quiz", "palace-03", key("palace-03", "book_closed") - 8, "03 Quiz: one book kept"],
  ["why-it-works", "palace-04", key("palace-04", "light_36") + 15, "04 Spaced review: day 36"],
  ["library", "palace-05", key("palace-05", "orbit") + 40, "Library"],
  ["home", "palace-06", key("palace-06", "hold") - 2, "Home"],
];

const SHEETS = [
  { file: "landscape-phone.png", title: "Phones held sideways: the compact stage (landscape frames)", viewports: [[844, 390], [667, 375]], perRow: 5 },
  { file: "small-phone.png", title: "Small phones", viewports: [[360, 740], [320, 568]], perRow: 5 },
];

const browser = await chromium.launch();
try {
  for (const sheet of SHEETS) {
    const rows = [];
    for (const [w, h] of sheet.viewports) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      await localOnly(ctx);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/?hud=1`);
      await page.waitForFunction(() => document.querySelector("[data-film-reel][data-film-armed]"), null, { timeout: 60_000 });
      const tiles = [];
      for (const [id, film, frame, label] of MOMENTS) {
        await goToFrame(page, id, frame, timeline[film].count);
        await page.addStyleTag({ content: HIDE_HUD });
        const png = await page.screenshot({ scale: "css" });
        tiles.push({ png, label: `${label} · f${frame + 1}` });
        await page.evaluate(() => document.querySelectorAll("style")[document.querySelectorAll("style").length - 1]?.remove());
      }
      rows.push({ title: `${w} × ${h} (touch, DPR 3)`, tiles });
      await ctx.close();
    }
    const out = path.join(OUT_DIR, sheet.file);
    const size = await contactSheet(out, sheet.title, rows, { perRow: sheet.perRow });
    console.log(`layout-sheets: ${out} (${size.width} × ${size.height})`);
  }
} finally {
  await browser.close();
}
