#!/usr/bin/env node
/**
 * seam-geometry — step the scroll across two chapter boundaries (hero→hall,
 * tower→city) and print the HUD frame every 15 px. A seam freeze shows as the
 * same frame for hundreds of px; a cut shows as a frame jump. Needs the dev
 * server (BASE, default http://localhost:3000).
 */
import { chromium } from "playwright";
const base = process.env.BASE || "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base + "/?hud=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const secs = await page.evaluate(() => [...document.querySelectorAll("[data-film-segment]")].map(s => { const r = s.getBoundingClientRect(); return { id: s.id, film: s.dataset.film, top: r.top + scrollY, h: r.height }; }));
console.log(secs.map(s => `${s.id} ${s.film} top=${s.top.toFixed(0)} h=${s.h.toFixed(0)}`).join("\n"));
const vh = 900;
for (const [a, b] of [[0, 1], [4, 5]]) {
  const A = secs[a], B = secs[b];
  const from = A.top + A.h - 1.6 * vh, to = B.top + 0.5 * vh;
  console.log(`\n== seam ${A.id}→${B.id}  (A ends scrollY=${(A.top + A.h).toFixed(0)}, B starts ${B.top.toFixed(0)})`);
  let last = "";
  for (let y = from; y <= to; y += 15) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(90);
    const hud = await page.evaluate(() => document.querySelector(".film-hud")?.textContent ?? "");
    const k = hud.split(" · ").slice(0, 2).join(" ");
    if (k !== last) { console.log(`y=${y.toFixed(0)} (A.end${(y - (A.top + A.h)).toFixed(0)}px) ${k}`); last = k; }
  }
}
await browser.close();
