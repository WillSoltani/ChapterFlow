#!/usr/bin/env node
/**
 * placeholder.mjs — synthesise stand-in frames so the scrub engine can be
 * developed and demoed before the Blender/Higgsfield renders exist.
 *
 *   node scripts/film/placeholder.mjs            # all films in book.timeline.json
 *   node scripts/film/placeholder.mjs book-00    # one film
 *   --out public/films
 *   --force                                      # overwrite real frames (never in a checkout whose public/films is the real set)
 *
 * Frame counts come from book.timeline.json (the runtime source of truth), so
 * the placeholder always matches what FilmBackdrop will request.
 *
 * Each frame is an SVG → WebP: a dark page, a "book" rectangle whose cover
 * angle, page fan and glow move with the frame index, plus a big frame
 * counter so you can SEE the scrub tracking. Landscape variant + the band-only
 * portrait tiers (<name>-b1080, <name>-b900; the timeline's films.<name>.bands
 * entries describe them).
 * Frame files left over from an earlier, longer run (or another padding) are
 * removed from the directories it writes, so the directory holds exactly the
 * timeline's count and the pack can be built.
 * Every variant also gets its pack (pack.bin + the manifest's `pack` field,
 * scripts/film/pack-lib.mjs). Run `node scripts/film/encode.mjs
 * --sync-timeline` afterwards if the runtime should read these packs: until
 * the timeline records them, a pack whose size disagrees with the timeline is
 * unusable and the reel loads the placeholder frame by frame.
 * Every manifest it writes carries `placeholder: true`: the film specs read
 * that (e2e/film-frames.ts) and skip the checks that judge the real footage
 * (contrast, the luminance behind the copy). CI runs the film specs on these
 * frames (.github/workflows/ci.yml, job "film").
 * Output is gitignored (public/films/); real renders replace it 1:1.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { staleFrameFiles, writePack } from "./pack-lib.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};
const OUT = path.resolve(ROOT, opt("out", "public/films"));
const timeline = JSON.parse(await fs.readFile(path.resolve(ROOT, "components/film/book.timeline.json"), "utf8"));
const names = args.filter((a) => !a.startsWith("--") && timeline.films[a]);
const films = names.length ? names : Object.keys(timeline.films);

const ACCENT = "#8AA2FF";
/**
 * Band tiers: each film's tiers come from its timeline entry
 * (films.<name>.bands.<tier>: width, height, the virtual frame and the band
 * rect inside it), so a re-encoded band geometry is mirrored here. These are
 * the fallbacks for a timeline without band entries (encode.mjs --bands at
 * zoom 1.6).
 */
const VFRAME = { w: 1080, h: 1920 };
const BAND = { x: 0, y: 474, w: 1080, h: 972 };
const TIER_WIDTHS = [1080, 900];
/** The tiers to write for one film: its timeline's band entries, or the fallbacks. */
function bandTiers(name) {
  const bands = timeline.films[name].bands;
  if (bands && Object.keys(bands).length)
    return Object.entries(bands).map(([tier, b]) => ({ w: b.width, h: b.height, frame: { ...b.frame }, band: { ...b.band }, name: `${name}-${tier}` }));
  return TIER_WIDTHS.map((w) => ({ w, h: Math.round((BAND.h * w) / BAND.w), frame: { ...VFRAME }, band: { ...BAND }, name: `${name}-b${w}` }));
}

// Never overwrite real frames. A directory whose manifest is not a
// placeholder's holds an encode (in a checkout where public/films links to
// the real frames, writing here would replace them): stop unless --force.
if (!args.includes("--force")) {
  const real = [];
  for (const name of films)
    for (const dir of [name, ...bandTiers(name).map((t) => t.name)]) {
      try {
        const m = JSON.parse(await fs.readFile(path.join(OUT, dir, "manifest.json"), "utf8"));
        if (m.placeholder !== true) real.push(dir);
      } catch {
        // no manifest: nothing to protect
      }
    }
  if (real.length) {
    console.error(`placeholder.mjs: ${OUT} holds real frames (${real.join(", ")}); refusing to overwrite them. Pass --out <dir> for another directory, or --force.`);
    process.exit(1);
  }
}
const BG = "#0B0E14";
/** Fastest WebP settings: placeholders are throwaway, and CI generates them on every film run. */
const WEBP = { quality: 70, effort: 0 };

// Crude stand-ins for each Memory Palace shot so copy can be timed before the
// real renders land. Object placement matches the shot list's copy/object side.
function scene(w, h, i, n, filmIdx) {
  const t = n > 1 ? i / (n - 1) : 0;
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const P = "#ECEFF6";
  const paper = (x, y, pw, ph, o = 0.9, fill = P) =>
    `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${fill}" opacity="${o}"/>`;
  switch (filmIdx) {
    case 0: { // The Fold: sheet (right) folds to doorway, then push-in darkens
      const cx = w * 0.72, cy = h * 0.52;
      const k = ease(Math.min(1, t / 0.6));
      const sw = w * 0.22 * (1 - 0.55 * k), sh = h * 0.42 * (1 + 0.5 * k);
      const dark = Math.max(0, (t - 0.75) / 0.25);
      return paper(cx - sw / 2, cy - sh / 2, sw, sh, 0.9 - 0.9 * dark) +
        `<rect x="${cx - sw * 0.3}" y="${cy - sh * 0.45}" width="${sw * 0.6}" height="${sh * 0.9}" fill="${BG}" opacity="${k * (1 - dark)}"/>`;
    }
    case 1: { // Hall: corridor lines (left) thin out
      const lines = [];
      for (let r = 0; r < 14; r++) {
        const keep = r % 4 === 1;
        const o = keep ? 0.9 : Math.max(0, 0.5 - 0.5 * ease(Math.min(1, t / 0.6)));
        lines.push(`<rect x="${w * 0.08}" y="${h * 0.2 + r * h * 0.045}" width="${w * 0.34}" height="${h * 0.012}" fill="${keep ? ACCENT : P}" opacity="${o}"/>`);
      }
      return lines.join("");
    }
    case 2: { // Rooms: three lantern boxes (right) light in sequence
      return [0, 1, 2].map((k) => {
        const on = Math.max(0, Math.min(1, (t - 0.15 - k * 0.3) / 0.12));
        const x = w * 0.58 + k * w * 0.13, y = h * 0.4;
        return paper(x, y, w * 0.1, h * 0.22, 0.25) + paper(x, y, w * 0.1, h * 0.22, 0.75 * on, ACCENT);
      }).join("");
    }
    case 3: { // Vault: door (right) + line slides in, pulse, collapse to book
      const dx = w * 0.72, dy = h * 0.2, dw = w * 0.16, dh = h * 0.6;
      const lineX = w * 0.3 + (dx - w * 0.3) * ease(Math.min(1, t / 0.46));
      const pulse = Math.exp(-Math.pow((t - 0.58) / 0.04, 2));
      const fold = ease(Math.max(0, (t - 0.75) / 0.25));
      const bw = dw * (1 - 0.5 * fold), bh = dh * (1 - 0.8 * fold);
      return paper(dx + (dw - bw) / 2, dy + (dh - bh), bw, bh, 0.85) +
        `<rect x="${lineX}" y="${h * 0.5}" width="${w * 0.1}" height="${h * 0.01}" fill="${ACCENT}" opacity="${1 - fold}"/>` +
        `<rect x="${dx - 40}" y="${dy - 40}" width="${dw + 80}" height="${dh + 80}" fill="${ACCENT}" opacity="${0.5 * pulse}"/>`;
    }
    case 4: { // Lights: tower (centre-low), cells light 1/4/12/36
      const cells = [];
      const cols = 6, rows = 12, cw = w * 0.05, ch = h * 0.05, x0 = w * 0.5 - cols * cw / 2, y0 = h * 0.3;
      const beats = [0.28, 0.46, 0.68, 0.9];
      let idx = 0;
      for (let r = rows - 1; r >= 0; r--) for (let c = 0; c < cols; c++) {
        const group = idx < 1 ? 0 : idx < 5 ? 1 : idx < 17 ? 2 : idx < 53 ? 3 : 4;
        const on = group < 4 ? Math.max(0, Math.min(1, (t - beats[group]) / 0.06)) : 0;
        cells.push(paper(x0 + c * cw + 2, y0 + r * ch + 2, cw - 4, ch - 4, 0.15 + 0.75 * on, on ? ACCENT : P));
        idx++;
      }
      return cells.join("");
    }
    case 5: { // City: towers rise, slow orbit = parallax shift
      const tw = [];
      for (let k = 0; k < 24; k++) {
        const th = h * (0.15 + ((k * 7919) % 100) / 100 * 0.45) * ease(Math.min(1, (t * 1.4) - k * 0.01));
        const x = w * 0.05 + k * w * 0.038 + t * w * 0.04;
        tw.push(paper(x, h * 0.95 - th, w * 0.025, th, 0.5 + 0.4 * ((k * 31) % 2)));
      }
      return tw.join("");
    }
    default: { // Home: book under a warming lamp (centre)
      const warm = ease(Math.max(0, (t - 0.5) / 0.5));
      return `<circle cx="${w / 2}" cy="${h * 0.3}" r="${h * 0.35}" fill="${ACCENT}" opacity="${0.08 + 0.3 * warm}"/>` +
        paper(w / 2 - w * 0.06, h * 0.55, w * 0.12, h * 0.17, 0.5 + 0.45 * warm);
    }
  }
}

/**
 * One frame as SVG: the scene on a w × h canvas. `out` renders only the
 * rectangle `out.crop` of it, at out.w × out.h (a band tier straight from the
 * portrait scene, no full-size raster in between), with the frame counter
 * inside that rectangle: every frame of every variant differs from the
 * others, so the pixel-truth specs can tell a frame from its decoys.
 */
function frameSvg(w, h, i, n, filmIdx, label, out) {
  const size = out ? `width="${out.w}" height="${out.h}" viewBox="${out.crop.x} ${out.crop.y} ${out.crop.w} ${out.crop.h}" preserveAspectRatio="none"` : `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size}>
  <rect width="100%" height="100%" fill="${BG}"/>
  ${scene(w, h, i, n, filmIdx)}
  <text x="${w * 0.04}" y="${h * 0.08}" font-family="ui-monospace, Menlo, monospace" font-size="${h * 0.028}" fill="${ACCENT}" opacity="0.9">${label}</text>
  <text x="${w * 0.04}" y="${out ? out.crop.y + out.crop.h * 0.92 : h * 0.95}" font-family="ui-monospace, Menlo, monospace" font-size="${out ? out.crop.h * 0.11 : h * 0.06}" fill="#F4F8FB" opacity="0.85">${String(i + 1).padStart(4, "0")} / ${n}</text>
</svg>`;
}

const ORDER = Object.keys(timeline.films);
for (const name of films) {
  const fi = ORDER.indexOf(name); // scene index = position in the timeline, not CLI order
  const n = timeline.films[name].count;
  const pad = Math.max(4, String(n).length);
  const frameFile = (i) => `f_${String(i + 1).padStart(pad, "0")}.webp`;
  const finish = async (dir, variant, w, h, extra = {}) => {
    for (const f of staleFrameFiles(await fs.readdir(dir), n, pad, "webp")) await fs.rm(path.join(dir, f));
    await fs.copyFile(path.join(dir, frameFile(0)), path.join(dir, "poster.webp"));
    // `placeholder: true` is the signal the film specs read (e2e/film-frames.ts):
    // tests that judge the real footage skip themselves on these frames.
    await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify({ name: variant, count: n, pad, ext: "webp", width: w, height: h, placeholder: true, ...extra }, null, 2) + "\n");
    const pack = await writePack(dir);
    console.log(`${variant}: ${n} frames, pack ${pack.bytes} bytes`);
  };
  const each = async (fn) => {
    const jobs = Array.from({ length: n }, (_, i) => i);
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (jobs.length) await fn(jobs.shift());
    }));
  };

  // Landscape.
  const landDir = path.join(OUT, name);
  await fs.mkdir(landDir, { recursive: true });
  await each(async (i) => {
    const svg = Buffer.from(frameSvg(1920, 1080, i, n, fi, `${name}  placeholder`));
    await sharp(svg).webp(WEBP).toFile(path.join(landDir, frameFile(i)));
  });
  await finish(landDir, name, 1920, 1080);

  // Band tiers (what portrait screens draw, see encode.mjs --bands): a
  // 1080×1920 portrait scene cut to the band, scaled per tier.
  const tiers = bandTiers(name);
  for (const t of tiers) await fs.mkdir(path.join(OUT, t.name), { recursive: true });
  await each(async (i) => {
    for (const t of tiers) {
      const svg = Buffer.from(frameSvg(t.frame.w, t.frame.h, i, n, fi, `${name} band  placeholder`, { w: t.w, h: t.h, crop: t.band }));
      await sharp(svg).flatten().webp(WEBP).toFile(path.join(OUT, t.name, frameFile(i)));
    }
  });
  for (const t of tiers) await finish(path.join(OUT, t.name), t.name, t.w, t.h, { frame: t.frame, band: t.band });
}
