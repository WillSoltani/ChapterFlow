/**
 * sheet-lib.mjs — shared helpers for the owner sheets (layout-sheets.mjs,
 * a11y-sheets.mjs): a local-only base URL, scrolling a
 * chapter to an exact frame of its film and waiting until the canvas shows
 * it, and joining labelled tiles into one PNG contact sheet.
 *
 * LOCAL ONLY: BASE must be localhost / 127.0.0.1 / [::1] (the live site's
 * rate limiter blocks scripted passes).
 */
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

export function localBase(name) {
  const base = (process.env.BASE ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(base)) {
    console.error(`${name}: BASE must be local (got ${base})`);
    process.exit(2);
  }
  return base;
}

/** Every request that is not to the local server is aborted (never the live site). */
export async function localOnly(ctx) {
  await ctx.route((url) => !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//.test(url.toString()), (r) => r.abort());
}

/**
 * Scroll so chapter `id` shows frame `frame` of its film (pickActive: the
 * first chapter plays over its sticky travel, every later one over its
 * height from the moment its box enters the bottom of the stage), then wait
 * until the HUD (?hud=1) draws the wanted frame and the canvas has it.
 */
export async function goToFrame(page, id, frame, count) {
  const p = Math.min(0.999, frame / (count - 1));
  const y = await page.evaluate(
    ([id, p]) => {
      const el = document.getElementById(id);
      const segs = [...document.querySelectorAll("[data-film-segment]")];
      const stage = el.querySelector("[data-film-stage]").getBoundingClientRect().height;
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      return segs[0] === el ? top + p * (r.height - stage) : top - stage + p * r.height;
    },
    [id, p],
  );
  await page.evaluate((y) => window.scrollTo({ top: Math.round(y), behavior: "instant" }), y);
  await page.waitForFunction(
    () => {
      const t = document.querySelector(".film-hud")?.textContent ?? "";
      const drawn = /· f(\d{4})/.exec(t)?.[1];
      const want = /want f(\d{4})/.exec(t)?.[1];
      return drawn && drawn === want;
    },
    null,
    { timeout: 20_000 },
  );
  // Pins settle (FramePin eases over a few frames) and the exact frame lands.
  await page.waitForTimeout(700);
}

/** Hide the HUD for a screenshot (it is only there to read the frame). */
export const HIDE_HUD = ".film-hud{display:none!important}";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** A label strip: white text lines on the page colour. */
export function labelSvg(w, h, lines, size = 22) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect width="100%" height="100%" fill="#06070A"/>` +
      lines
        .map((l, i) => `<text x="8" y="${size + 4 + i * (size + 8)}" font-family="Helvetica, Arial, sans-serif" font-size="${i === 0 ? size : size - 4}" fill="${i === 0 ? "#ECEFF6" : "#A2A9BC"}">${esc(l)}</text>`)
        .join("") +
      `</svg>`,
  );
}

/**
 * Join rows of tiles into one sheet. rows: [{ title, tiles: [{ png, label }] }].
 * Each tile is drawn at its own size with a caption above it; rows wrap at
 * `perRow` tiles.
 */
export async function contactSheet(out, title, rows, { perRow = 4, gap = 18, caption = 34, rowTitle = 44 } = {}) {
  // Layout first (sizes), then the labels at the sheet's width.
  const placed = [];
  const titles = [];
  let y = 70;
  let sheetW = 900;
  for (const row of rows) {
    titles.push({ text: row.title, top: y });
    y += rowTitle;
    const metas = await Promise.all(row.tiles.map((t) => sharp(t.png).metadata()));
    for (let i = 0; i < row.tiles.length; i += perRow) {
      let x = gap;
      let lineH = 0;
      for (let j = i; j < Math.min(i + perRow, row.tiles.length); j++) {
        const m = metas[j];
        placed.push({ tile: row.tiles[j], w: m.width, left: x, top: y });
        x += m.width + gap;
        lineH = Math.max(lineH, m.height + caption);
      }
      sheetW = Math.max(sheetW, x);
      y += lineH + gap;
    }
    y += gap;
  }
  const items = [{ input: labelSvg(sheetW, 60, [title], 30), left: 0, top: 0 }];
  for (const t of titles) items.push({ input: labelSvg(sheetW - 2 * gap, rowTitle, [t.text], 26), left: gap, top: t.top });
  for (const p of placed) {
    items.push({ input: labelSvg(p.w, caption, [p.tile.label], 20), left: p.left, top: p.top });
    items.push({ input: p.tile.png, left: p.left, top: p.top + caption });
  }
  await fs.mkdir(path.dirname(out), { recursive: true });
  await sharp({ create: { width: sheetW, height: y, channels: 3, background: "#06070A" } })
    .composite(items)
    .png()
    .toFile(out);
  return { width: sheetW, height: y };
}
