#!/usr/bin/env node
/**
 * blend-tail.mjs — hide a mid-clip "snap" (hard cut) where the video model jumps to the
 * end image instead of animating into it. Extracts the clip to PNG and
 * cross-fades frames [from, to) toward frame `to` with a smoothstep ramp,
 * then you encode the folder with encode.mjs (no --from-video).
 *
 *   node scripts/film/blend-tail.mjs <video.mp4|frameDir> <outDir> --from 200 --to 220
 *   node scripts/film/blend-tail.mjs <video.mp4|frameDir> <outDir> --from 1 --to 15 --head
 *     (--head: hold frame `from`, dissolve INTO the frames after the cut; use
 *      when the frames before the cut are a seam anchor that must not move)
 *   node scripts/film/encode.mjs <outDir> palace-03 --portrait --quality 78 </dev/null
 *
 * Frame indices are 0-based (same as book.timeline.json keys).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? undefined : Number(args[i + 1]); };
const [video, outDir] = args;
const from = opt("from");
const to = opt("to");
if (!video || !outDir || !(from >= 0) || !(to > from)) {
  console.error("usage: blend-tail.mjs <video> <outDir> --from <f> --to <f>");
  process.exit(1);
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
if ((await fs.stat(video)).isDirectory()) {
  // Already-extracted PNG sequence (e.g. deletterbox.mjs output): copy, renumbered.
  const pngs = (await fs.readdir(video)).filter((f) => /\.png$/i.test(f)).sort();
  await Promise.all(pngs.map((f, i) => fs.copyFile(path.join(video, f), path.join(outDir, `f_${String(i + 1).padStart(5, "0")}.png`))));
} else {
  const ff = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", video, "-pix_fmt", "rgb24", path.join(outDir, "f_%05d.png")], { stdio: ["ignore", "inherit", "inherit"] });
  if (ff.status !== 0) process.exit(1);
}

const file = (i) => path.join(outDir, `f_${String(i + 1).padStart(5, "0")}.png`);
const smooth = (t) => t * t * (3 - 2 * t);
const head = args.includes("--head");

if (head) {
  // --head: the cut sits between `from` and `from+1`, and the frames BEFORE
  // it must stay untouched (e.g. a seam anchor shared with the previous
  // film). Hold frame `from` and dissolve it into the moving footage over
  // (from, to]: out_i = mix(frame_from, frame_i, smoothstep).
  const plate = await sharp(file(from)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = from + 1; i <= to; i++) {
    const a = smooth((i - from) / (to - from));
    const src = await sharp(file(i)).removeAlpha().raw().toBuffer();
    const out = Buffer.alloc(src.length);
    for (let p = 0; p < src.length; p++) out[p] = Math.round(plate.data[p] * (1 - a) + src[p] * a);
    await sharp(out, { raw: plate.info }).png().toFile(file(i));
  }
  console.log(`blended frames ${from + 1}..${to} from held frame ${from} in ${outDir}`);
} else {
  const target = await sharp(file(to)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = from; i < to; i++) {
    const a = smooth((i - from + 1) / (to - from + 1));
    const src = await sharp(file(i)).removeAlpha().raw().toBuffer();
    const out = Buffer.alloc(src.length);
    for (let p = 0; p < src.length; p++) out[p] = Math.round(src[p] * (1 - a) + target.data[p] * a);
    await sharp(out, { raw: target.info }).png().toFile(file(i));
  }
  console.log(`blended frames ${from}..${to - 1} toward ${to} in ${outDir}`);
}
