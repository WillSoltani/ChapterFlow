#!/usr/bin/env node
/**
 * smoothness.mjs — find the frames where an encoded film "jumps" when scrubbed.
 *
 *   node scripts/film/smoothness.mjs [palace-00 …] [--json out.json]
 *
 * For each film: mean abs pixel delta between consecutive frames (96×54 luma+rgb).
 * A frame is a SPIKE when its delta is > 2.5× the local median (±12 frames)
 * AND > 6 absolute — i.e. motion suddenly accelerates relative to its
 * neighbourhood. A scrub maps scroll linearly to frames, so these are exactly
 * the places the reel feels jerky. Also reports the seam into the next film.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const ROOT = path.resolve("public/films");
const films = args.filter((a) => a.startsWith("palace-"));
if (films.length === 0) {
  for (const d of (await fs.readdir(ROOT)).sort()) if (/^palace-\d\d$/.test(d)) films.push(d);
}

const small = async (file) => sharp(file).resize(96, 54, { fit: "fill" }).removeAlpha().raw().toBuffer();
const delta = (a, b) => { let t = 0; for (let i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]); return t / a.length; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

const report = {};
let prevLast = null;
for (const film of films) {
  const dir = path.join(ROOT, film);
  const files = (await fs.readdir(dir)).filter((f) => /^f_\d+\.webp$/.test(f)).sort();
  const bufs = [];
  for (const f of files) bufs.push(await small(path.join(dir, f)));
  const d = [0];
  for (let i = 1; i < bufs.length; i++) d.push(delta(bufs[i - 1], bufs[i]));
  const spikes = [];
  for (let i = 1; i < d.length; i++) {
    const win = d.slice(Math.max(1, i - 12), Math.min(d.length, i + 13)).filter((_, k, arr) => arr.length);
    const m = median(win);
    if (d[i] > 6 && d[i] > 2.5 * Math.max(m, 1)) spikes.push({ frame: i, delta: +d[i].toFixed(1), localMedian: +m.toFixed(1) });
  }
  const seamIn = prevLast ? +delta(prevLast, bufs[0]).toFixed(1) : null;
  prevLast = bufs[bufs.length - 1];
  const sorted = [...d.slice(1)].sort((a, b) => a - b);
  report[film] = {
    frames: bufs.length,
    p50: +sorted[Math.floor(sorted.length * 0.5)].toFixed(1),
    p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
    max: +sorted[sorted.length - 1].toFixed(1),
    seamIn,
    spikes,
    deltas: d.map((x) => +x.toFixed(2)),
  };
  console.log(`${film}: ${bufs.length}f  p50 ${report[film].p50}  p95 ${report[film].p95}  max ${report[film].max}  seamIn ${seamIn ?? "-"}  spikes ${spikes.length ? spikes.map((s) => `f${s.frame}(${s.delta}/${s.localMedian})`).join(" ") : "none"}`);
}
if (jsonOut) await fs.writeFile(jsonOut, JSON.stringify(report, null, 1));
