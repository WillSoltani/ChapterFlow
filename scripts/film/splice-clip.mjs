#!/usr/bin/env node
/**
 * splice-clip.mjs — replace a stretch of a film with an insert clip whose first
 * and last frames were generated from that film's own frames (hf-upload.mjs),
 * so both cut points match. Writes a PNG folder ready for encode.mjs.
 *
 *   node scripts/film/splice-clip.mjs <base.mp4|frameDir> <insert.mp4> <outDir> --from A --to B [--blend 4]
 *
 * Output = base[0..A) + insert (all frames) + base(B..end].
 * Base frames A and B are dropped: the insert's first and last frames stand in
 * for them. --blend N cross-fades N frames on each side to hide model drift.
 * Frame indices are 0-based.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : Number(args[i + 1]); };
const [baseArg, insertArg, outDir] = args;
const from = opt("from");
const to = opt("to");
const blend = opt("blend", 4);
if (!baseArg || !insertArg || !outDir || !(from >= 0) || !(to > from)) {
  console.error("usage: splice-clip.mjs <base> <insert.mp4> <outDir> --from A --to B [--blend 4]");
  process.exit(1);
}

async function frames(src) {
  if ((await fs.stat(src)).isDirectory()) {
    return (await fs.readdir(src)).filter((f) => /\.png$/i.test(f)).sort().map((f) => path.join(src, f));
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-splice-"));
  const ff = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", src, "-pix_fmt", "rgb24", path.join(dir, "f_%05d.png")], { stdio: ["ignore", "inherit", "inherit"] });
  if (ff.status !== 0) process.exit(1);
  return (await fs.readdir(dir)).sort().map((f) => path.join(dir, f));
}

const base = await frames(baseArg);
const ins = await frames(insertArg);
const meta = await sharp(base[0]).metadata();
const seq = [...base.slice(0, from), ...ins, ...base.slice(to + 1)];
const seamA = from;                    // index of the insert's first frame in seq
const seamB = from + ins.length - 1;   // index of the insert's last frame in seq

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const raw = async (f) => sharp(f).resize(meta.width, meta.height, { fit: "fill" }).removeAlpha().raw().toBuffer();
const mix = (a, b, t) => { const o = Buffer.alloc(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.round(a[i] * (1 - t) + b[i] * t); return o; };
const info = { width: meta.width, height: meta.height, channels: 3 };

for (let i = 0; i < seq.length; i++) {
  const out = path.join(outDir, `f_${String(i + 1).padStart(5, "0")}.png`);
  // Ease insert drift in/out against the base frames it replaced.
  const dA = i - seamA, dB = seamB - i;
  if (blend > 0 && dA >= 0 && dA < blend && from - 1 >= 0) {
    const t = (dA + 1) / (blend + 1);
    await sharp(mix(await raw(base[Math.min(from + dA, base.length - 1)]), await raw(seq[i]), t), { raw: info }).png().toFile(out);
  } else if (blend > 0 && dB >= 0 && dB < blend && to + 1 < base.length + 1) {
    const t = (dB + 1) / (blend + 1);
    await sharp(mix(await raw(base[Math.max(to - dB, 0)]), await raw(seq[i]), t), { raw: info }).png().toFile(out);
  } else {
    await sharp(seq[i]).resize(meta.width, meta.height, { fit: "fill" }).png().toFile(out);
  }
}
console.log(`spliced: base ${base.length}f, insert ${ins.length}f at [${from}..${to}] → ${seq.length}f in ${outDir}`);
console.log(`insert occupies frames ${seamA}..${seamB} (0-based) of the new film`);
