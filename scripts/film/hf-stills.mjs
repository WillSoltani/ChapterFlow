#!/usr/bin/env node
/**
 * hf-stills.mjs — generate N candidates for a palace still, download, score,
 * pick the best, register it as media. Prints the chosen media_id.
 *
 *   node scripts/film/hf-stills.mjs <STILL_KEY> [--n 2] [--out /tmp/out]
 *
 * Score (higher = more "photographed miniature", less "render"):
 *   + high-frequency detail (paper fibre / grain)   = mean local std-dev
 *   + true-black fraction 0.25–0.6 (velvet falloff)  = closeness to 0.4
 *   + periwinkle presence 3–20%                      = closeness to 0.1
 *   - clipped highlights (>250)                      = fraction
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { STILLS } from "./palace-prompts.mjs";

const args = process.argv.slice(2);
const key = args[0];
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const N = Number(opt("n", 2));
const OUT = path.resolve(opt("out", "/tmp/out"));
if (!STILLS[key]) { console.error(`unknown still ${key}: ${Object.keys(STILLS).join(",")}`); process.exit(1); }
await fs.mkdir(OUT, { recursive: true });

const HF = path.resolve(path.dirname(new URL(import.meta.url).pathname), "hf.mjs");
const FETCH = path.resolve(path.dirname(new URL(import.meta.url).pathname), "hf-fetch.mjs");
const run = (file, a) => new Promise((res, rej) => {
  const p = spawn("node", [file, ...a], { stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("close", (c) => (c === 0 ? res(out) : rej(new Error(out.slice(0, 400)))));
});

// 1. submit N
const reqs = Array.from({ length: N }, (_, i) => ({ index: i, params: { model: "nano_banana_pro", prompt: STILLS[key], aspect_ratio: "16:9", resolution: "2k" } }));
const sub = await run(HF, ["generate_image_batch", JSON.stringify({ requests: reqs })]);
const ids = [...sub.matchAll(/index (\d+): ([0-9a-f-]{36})/g)].map((m) => m[2]);
if (ids.length === 0) { console.error(sub.slice(0, 600)); process.exit(1); }
console.log(`${key}: submitted ${ids.length}`);

// 2. fetch
const names = ids.map((id, i) => `${key.toLowerCase()}_${i}=${id}`);
await run(FETCH, [OUT, ...names]);

// 3. score
async function score(file) {
  const img = sharp(file);
  const { data, info } = await img.resize(512, 288, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let black = 0, peri = 0, clip = 0;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const l = r * 0.299 + g * 0.587 + b * 0.114;
    lum[i] = l;
    if (l < 18) black++;
    if (b > r + 30 && b > 120) peri++;
    if (r > 250 && g > 250 && b > 250) clip++;
  }
  // local std-dev over 8x8 blocks (texture)
  let tex = 0, blocks = 0;
  for (let by = 0; by < info.height; by += 8) for (let bx = 0; bx < info.width; bx += 8) {
    let s = 0, s2 = 0, c = 0;
    for (let y = by; y < Math.min(by + 8, info.height); y++) for (let x = bx; x < Math.min(bx + 8, info.width); x++) { const v = lum[y * info.width + x]; s += v; s2 += v * v; c++; }
    const m = s / c; const sd = Math.sqrt(Math.max(0, s2 / c - m * m));
    if (m > 25 && m < 230) { tex += sd; blocks++; }
  }
  const texture = blocks ? tex / blocks : 0;
  const near = (v, t, w) => Math.max(0, 1 - Math.abs(v - t) / w);
  const sc = texture * 0.5 + near(black / n, 0.4, 0.35) * 10 + near(peri / n, 0.1, 0.12) * 6 - (clip / n) * 40;
  return { score: +sc.toFixed(2), texture: +texture.toFixed(1), black: +(black / n).toFixed(2), peri: +(peri / n).toFixed(2), clip: +(clip / n).toFixed(3) };
}
const results = [];
for (let i = 0; i < ids.length; i++) {
  const f = path.join(OUT, `${key.toLowerCase()}_${i}.png`);
  try { results.push({ i, id: ids[i], file: f, ...(await score(f)) }); } catch { /* failed job */ }
}
results.sort((a, b) => b.score - a.score);
for (const r of results) console.log(`  #${r.i} score=${r.score} tex=${r.texture} black=${r.black} peri=${r.peri} clip=${r.clip}`);
const best = results[0];
if (!best) { console.error("no candidates"); process.exit(1); }

// 4. register
const j = JSON.parse(await fs.readFile(path.join(OUT, `${key.toLowerCase()}_${best.i}.json`), "utf8"));
const url = (j.generation || j).results?.rawUrl || (j.generation || j).results?.url;
const reg = await run(HF, ["media_import_url", JSON.stringify({ url, type: "image" })]);
const mid = /media_id[" :]+([0-9a-f-]{36})/.exec(reg)?.[1];
await fs.writeFile(path.join(OUT, `${key.toLowerCase()}.pick.json`), JSON.stringify({ key, pick: best, media_id: mid, url, all: results }, null, 1));
console.log(`${key}: picked #${best.i} → media ${mid}`);
