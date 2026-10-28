import type { Page } from "@playwright/test";
import sharp from "sharp";

/** Helpers for e2e/film-audit.spec.ts — numeric stand-ins for eyeballing. */

export type Pin = { text: string; x: number; y: number; w: number; h: number; seg: string; interactive: boolean };
export type Snap = { pins: Pin[]; hud: string; navBottom: number; scrollY: number; active: string };

export const LUM_MEAN_MAX = 110;
export const LUM_P90_MAX = 150;

/** Pins (opacity ≥ .6) inside the sticky stage currently pinned to the viewport top. */
export function activePins(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    // Active segment = the one whose box spans the viewport top (same rule as
    // scrub.ts pickActive). Its stage is the one being judged.
    let active: Element | null = null;
    for (const seg of document.querySelectorAll("[data-film-segment]")) {
      const r = seg.getBoundingClientRect();
      if (r.top <= 0 && r.bottom > 0) active = seg.querySelector("[data-film-stage]");
    }
    const nav = document.querySelector(".rl-nav")?.getBoundingClientRect();
    const pins: Pin[] = [];
    if (active) {
      for (const el of active.querySelectorAll<HTMLElement>("[data-frame-pin]")) {
        if (Number(getComputedStyle(el).opacity) < 0.6) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        pins.push({
          text: (el.textContent ?? "").trim().slice(0, 40),
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
          seg: el.closest("[data-film-segment]")?.id ?? "?",
          interactive: el.classList.contains("pointer-events-auto"),
        });
      }
    }
    return {
      pins,
      hud: document.querySelector(".film-hud")?.textContent ?? "",
      navBottom: nav?.bottom ?? 0,
      scrollY: window.scrollY,
      active: active?.closest("[data-film-segment]")?.id ?? "-",
    };
  });
}

/** Screenshot with pin text hidden → luminance stats of the composited bg under each pin. */
export async function backgroundLum(page: Page, pins: Pin[], vp: { width: number; height: number }) {
  if (pins.length === 0) return [];
  // Hide the INK only (text + icons), keep each pin's own scrim/background —
  // that's what the glyphs actually sit on.
  await page.addStyleTag({
    content:
      "[data-frame-pin],[data-frame-pin] *{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important}" +
      "[data-frame-pin] svg{visibility:hidden!important}" +
      ".film-hud{display:none!important}",
  });
  const shot = await page.screenshot({ type: "png" });
  await page.evaluate(() => {
    const tags = document.querySelectorAll("style");
    tags[tags.length - 1]?.remove();
  });
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  const sx = info.width / vp.width;
  const sy = info.height / vp.height;
  return pins.map((p) => {
    // Inset 3px: glyphs never touch the box edge, and pill edges antialias.
    const x0 = Math.max(0, Math.floor((p.x + 3) * sx));
    const y0 = Math.max(0, Math.floor((p.y + 3) * sy));
    const x1 = Math.min(info.width, Math.ceil((p.x + p.w - 3) * sx));
    const y1 = Math.min(info.height, Math.ceil((p.y + p.h - 3) * sy));
    const lums: number[] = [];
    for (let y = y0; y < y1; y += 3)
      for (let x = x0; x < x1; x += 3) {
        const i = (y * info.width + x) * info.channels;
        lums.push((data[i] ?? 0) * 0.299 + (data[i + 1] ?? 0) * 0.587 + (data[i + 2] ?? 0) * 0.114);
      }
    if (!lums.length) return { mean: 0, p90: 0 };
    lums.sort((a, b) => a - b);
    return { mean: lums.reduce((a, b) => a + b, 0) / lums.length, p90: lums[Math.floor(lums.length * 0.9)] ?? 0 };
  });
}

export const overlap = (a: Pin, b: Pin) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
