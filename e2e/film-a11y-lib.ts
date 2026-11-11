import type { Browser, BrowserContext, Page } from "@playwright/test";
import sharp from "sharp";
import timeline from "../components/film/book.timeline.json";

/**
 * Helpers for e2e/film-a11y.spec.ts (Phase 8): reduced-motion contexts, the
 * reel's chapters and stops, waiting for an exact frame, and the WCAG
 * contrast of the reel's copy against the real pixels behind it.
 */

export type Vp = { name: string; width: number; height: number };
export const A11Y_VIEWPORTS: Vp[] = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

/** How reduced motion is asked for: the OS setting, the in-app toggle (html[data-motion]), or not at all. */
export type Motion = "os" | "app" | "normal";

export async function motionContext(browser: Browser, vp: Vp, motion: Motion): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: motion === "os" ? "reduce" : "no-preference",
  });
  // Never let a request leave this machine (the live site rate-limits it).
  await ctx.route((url) => !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url.toString()), (route) => route.abort());
  if (motion === "app") {
    // The stored preference the head script turns into html[data-motion="reduced"] before the first paint.
    await ctx.addInitScript(() => {
      window.localStorage.setItem("book-accelerator:preferences:v2", JSON.stringify({ appearance: { theme: "dark", reducedMotion: true } }));
    });
  }
  return ctx;
}

export type Seg = { id: string; film: string; top: number; h: number; stops: number[]; count: number };

const COUNTS = Object.fromEntries(Object.entries(timeline.films).map(([k, f]) => [k, f.count])) as Record<string, number>;

export async function segments(page: Page): Promise<Seg[]> {
  const raw = await page.$$eval("[data-film-segment]", (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      const el = e as HTMLElement;
      return { id: el.id, film: el.dataset.film ?? "", top: r.top + window.scrollY, h: r.height, stops: (el.dataset.filmStops ?? "").split(",").map(Number) };
    }),
  );
  return raw.map((s) => ({ ...s, count: COUNTS[s.film] ?? 0 }));
}

export const stageHeight = (page: Page) =>
  page.evaluate(() => document.querySelector<HTMLElement>("[data-film-stage]")?.getBoundingClientRect().height ?? window.innerHeight);

export async function scrollToY(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), y);
  await page.waitForFunction((y) => Math.abs(window.scrollY - Math.min(y, document.documentElement.scrollHeight - window.innerHeight)) < 2, y, { timeout: 5000 });
}

/** The frame the canvas drew (HUD, ?hud=1): film name and 0-based frame. */
export async function drawn(page: Page): Promise<{ film: string; frame: number } | null> {
  const t = (await page.locator(".film-hud").textContent()) ?? "";
  const m = /(palace-\d\d) · f(\d{4})/.exec(t);
  return m ? { film: m[1]!, frame: Number(m[2]) - 1 } : null;
}

/**
 * Wait until the canvas shows `frame` of `film` from the frame itself (the
 * dev cache's lastServed), not a nearby one; gives up after `ms` (returns false).
 */
export async function waitExact(page: Page, film: string, frame: number, ms = 8000): Promise<boolean> {
  try {
    await page.waitForFunction(
      ({ film, frame }) => {
        const m = /(palace-\d\d) · f(\d{4})/.exec(document.querySelector(".film-hud")?.textContent ?? "");
        if (!m || m[1] !== film || Number(m[2]) - 1 !== frame) return false;
        const caches = (window as unknown as { __filmCaches?: Map<string, { lastServed: number }> }).__filmCaches;
        if (!caches) return true;
        const c = [...caches.entries()].filter(([k]) => k.startsWith(`${film}@`) || k.startsWith(`${film}-`)).map(([, v]) => v);
        return c.some((x) => x.lastServed === frame);
      },
      { film, frame },
      { timeout: ms, polling: 50 },
    );
    // Two more frames: the pins follow the drawn frame on the same tick.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return true;
  } catch {
    return false;
  }
}

/** A run of copy inside a pin: one element with its own text. */
export type TextItem = {
  key: string;
  seg: string;
  text: string;
  /** Opacity of the pins and scrims around it (1 = fully on). */
  pinOn: number;
  /** Effective opacity of its text (every ancestor's opacity, its colour's alpha). */
  alpha: number;
  color: [number, number, number];
  /** A solid button: its own background (CTA, judged by its own colours). */
  solidBg: [number, number, number] | null;
  fontPx: number;
  weight: number;
  kind: "cta" | "ghost" | "label" | "text";
  rects: Array<{ x: number; y: number; w: number; h: number }>;
};

/** Every run of copy in the reel's pins (or only in `segId`), with what the contrast check needs. */
export function textItems(page: Page, segId?: string): Promise<TextItem[]> {
  return page.evaluate((segId) => {
    const rgb = (s: string): [number, number, number, number] => {
      const m = /rgba?\(([^)]+)\)/.exec(s);
      if (!m) return [0, 0, 0, 0];
      const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
    };
    const out: TextItem[] = [];
    const root = segId ? document.getElementById(segId) : document.querySelector("[data-film-reel]");
    if (!root) return out;
    for (const el of root.querySelectorAll<HTMLElement>("[data-frame-pin], [data-frame-pin] *")) {
      if (el.closest(".hall-text")) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim());
      if (!own.length) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility !== "visible") continue;
      let pinOn = 1;
      let alpha = 1;
      for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
        const o = Number(getComputedStyle(e).opacity);
        alpha *= o;
        if (e.hasAttribute("data-frame-pin") || e.hasAttribute("data-frame-scrim")) pinOn *= o;
      }
      const c = rgb(cs.color);
      alpha *= c[3];
      const rects: TextItem["rects"] = [];
      for (const n of own) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push({ x: r.left, y: r.top, w: r.width, h: r.height });
      }
      if (!rects.length) continue;
      const primary = el.closest(".film-btn-primary");
      const ghost = el.closest(".film-btn-ghost");
      const bg = primary ? rgb(getComputedStyle(primary).backgroundColor) : null;
      const seg = el.closest("[data-film-segment]")?.id ?? "?";
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 48);
      out.push({
        key: `${seg}:${text}`,
        seg,
        text,
        pinOn,
        alpha,
        color: [c[0], c[1], c[2]],
        solidBg: bg ? [bg[0], bg[1], bg[2]] : null,
        fontPx: parseFloat(cs.fontSize),
        weight: Number(cs.fontWeight) || 400,
        kind: primary ? "cta" : ghost ? "ghost" : el.closest(".film-label") ? "label" : "text",
        rects,
      });
    }
    return out;
  }, segId);
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** WCAG large text: 24 px, or 18.66 px bold. */
export const isLarge = (t: Pick<TextItem, "fontPx" | "weight">) => t.fontPx >= 24 || (t.fontPx >= 18.66 && t.weight >= 700);
export const required = (t: Pick<TextItem, "fontPx" | "weight">) => (isLarge(t) ? 3 : 4.5);

/** Hide the copy's ink (text, icons, shadows), keep every scrim, box backing and pill: what the glyphs sit on. */
export const HIDE_INK =
  "[data-frame-pin],[data-frame-pin] *{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important;text-decoration-color:transparent!important}" +
  "[data-frame-pin] svg{visibility:hidden!important}.film-hud{display:none!important}";

/**
 * Screenshot of the page with the copy's ink hidden, as raw RGB in CSS px
 * (the frame and scrims as they are).
 */
export async function backgroundShot(page: Page): Promise<{ data: Buffer; width: number; height: number }> {
  const handle = await page.addStyleTag({ content: HIDE_INK });
  // Two animation frames: the hidden ink must be in the frame captured.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const png = await page.screenshot({ type: "png", scale: "css" });
  await handle.evaluate((el) => (el as Element).remove());
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Contrast of a run of copy against the real background: per background
 * pixel inside its text boxes, the ratio between the text colour composited
 * over that pixel (its effective opacity) and the pixel; the result is the
 * worst 10 % (10th percentile). A solid button: its text colour against its
 * own background.
 */
export function contrastOf(item: TextItem, bg: { data: Buffer; width: number; height: number }): number {
  if (item.solidBg) {
    const t = mix(item.color, item.solidBg, item.alpha);
    return ratio(luminance(...t), luminance(...item.solidBg));
  }
  const ratios: number[] = [];
  for (const r of item.rects) {
    const x0 = Math.max(0, Math.floor(r.x));
    const y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(bg.width, Math.ceil(r.x + r.w));
    const y1 = Math.min(bg.height, Math.ceil(r.y + r.h));
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * bg.width + x) * 3;
        const px: [number, number, number] = [bg.data[i] ?? 0, bg.data[i + 1] ?? 0, bg.data[i + 2] ?? 0];
        const t = mix(item.color, px, item.alpha);
        ratios.push(ratio(luminance(...t), luminance(...px)));
      }
  }
  if (!ratios.length) return Infinity;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length * 0.1)] ?? ratios[0]!;
}

function mix(fg: [number, number, number], bg: [number, number, number], a: number): [number, number, number] {
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
}

/** Text boxes inside the viewport (a box cut by the edge is judged on what shows). */
export function inViewport(item: TextItem, vp: { width: number; height: number }): boolean {
  return item.rects.some((r) => r.x + r.w > 0 && r.y + r.h > 0 && r.x < vp.width && r.y < vp.height);
}
