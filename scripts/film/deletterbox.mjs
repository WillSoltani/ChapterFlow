#!/usr/bin/env node
/**
 * deletterbox.mjs — remove black letterbox bars that a video model bakes into
 * frames generated from a letterboxed start/end still (P04's frame 0 shipped
 * with 127 px bars top and bottom; every clip seeded from it inherits them).
 *
 * For each frame: detect contiguous near-black rows at the top and bottom,
 * crop the inner picture to the frame's aspect (centred), and scale it back
 * to the full frame. Frames without bars pass through untouched.
 *
 *   node scripts/film/deletterbox.mjs <video.mp4|frameDir> <outDir> [--ramp N] [--thresh 6]
 *
 * --ramp N   after the LAST barred frame, ease the zoom back to 1.0 over N
 *            frames instead of snapping (use when the model hard-cuts from the
 *            letterboxed picture to a differently framed full picture).
 * --thresh   a row counts as "bar" when its brightest sampled pixel is below this (default 6).
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : Number(args[i + 1]); };
const [input, outDir] = args;
const ramp = opt("ramp", 0);
const thresh = opt("thresh", 6);
if (!input || !outDir) {
  console.error("usage: deletterbox.mjs <video.mp4|frameDir> <outDir> [--ramp N] [--thresh 6]");
  process.exit(1);
}

async function frames(src) {
  if ((await fs.stat(src)).isDirectory()) {
    return (await fs.readdir(src)).filter((f) => /\.png$/i.test(f)).sort().map((f) => path.join(src, f));
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-dlb-"));
  const ff = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", src, "-pix_fmt", "rgb24", path.join(dir, "f_%05d.png")], { stdio: ["ignore", "inherit", "inherit"] });
  if (ff.status !== 0) process.exit(1);
  return (await fs.readdir(dir)).sort().map((f) => path.join(dir, f));
}

/**
 * Contiguous letterbox rows from the top and bottom edges.
 *
 * A bar row is one where the BRIGHTEST sampled pixel is still near black —
 * a mean test misfires on genuinely dark footage (the void above a paper
 * tower has grain and haze in the 5–30 range, a baked bar is flat 0–2).
 * Letterboxing is also symmetric by construction, so a bar on one edge only
 * (a dark ceiling, a shadowed floor) is treated as picture, not bar.
 */
const MIN_BAR = 8;
async function bars(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const rowMax = (y) => {
    let mx = 0;
    for (let x = 0; x < W; x += 2) {
      const p = (y * W + x) * C;
      const v = data[p] + data[p + 1] + data[p + 2];
      if (v > mx) mx = v;
    }
    return mx / 3;
  };
  let top = 0;
  while (top < H / 2 && rowMax(top) < thresh) top++;
  let bot = 0;
  while (bot < H / 2 && rowMax(H - 1 - bot) < thresh) bot++;
  if (top < MIN_BAR || bot < MIN_BAR) return { top: 0, bot: 0, W, H };
  return { top, bot, W, H };
}

const src = await frames(input);
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

// Pass 1: measure. Zoom needed per frame = H / innerH.
const meas = [];
for (const f of src) meas.push(await bars(f));
const zoomOf = (m) => (m.top + m.bot > 0 ? m.H / (m.H - m.top - m.bot) : 1);
const zooms = meas.map(zoomOf);
let lastBarred = -1;
zooms.forEach((z, i) => { if (z > 1) lastBarred = i; });

// Optional ease-out after the last barred frame so a hard model cut reads as
// a short pull-back instead of a pop.
if (ramp > 0 && lastBarred >= 0 && lastBarred + 1 < zooms.length) {
  const z0 = zooms[lastBarred];
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let i = lastBarred + 1; i < Math.min(zooms.length, lastBarred + 1 + ramp); i++) {
    const t = (i - lastBarred) / ramp;
    zooms[i] = Math.max(zooms[i], 1 + (z0 - 1) * (1 - smooth(t)));
  }
}

// Pass 2: write. Crop the centred inner window of size (W/z × H/z), biased to
// the real picture rows when bars are present, then scale to full frame.
let touched = 0;
for (let i = 0; i < src.length; i++) {
  const out = path.join(outDir, `f_${String(i + 1).padStart(5, "0")}.png`);
  const m = meas[i];
  const z = zooms[i];
  if (z <= 1.0005) {
    await fs.copyFile(src[i], out);
    continue;
  }
  const cw = Math.round(m.W / z);
  const ch = Math.round(m.H / z);
  // Centre of the real picture (between the bars), clamped so the crop never
  // includes bar rows.
  const picTop = m.top;
  const picH = m.H - m.top - m.bot;
  let top = Math.round(picTop + (picH - ch) / 2);
  top = Math.max(picTop, Math.min(top, picTop + picH - ch));
  const left = Math.round((m.W - cw) / 2);
  await sharp(src[i]).extract({ left, top, width: cw, height: ch }).resize(m.W, m.H, { kernel: "lanczos3" }).png().toFile(out);
  touched++;
}
console.log(`deletterbox: ${src.length} frames, ${touched} rescaled (last barred frame ${lastBarred}, ramp ${ramp}) → ${outDir}`);
