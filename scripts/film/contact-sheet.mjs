#!/usr/bin/env node
/**
 * contact-sheet.mjs — tile images (or every Nth frame of an encoded film) into
 * one JPEG for eyeballing continuity / pseudo-text without opening 241 files.
 *
 *   node scripts/film/contact-sheet.mjs out.jpg a.png b.png …        # explicit files
 *   node scripts/film/contact-sheet.mjs out.jpg --film palace-01 --every 20
 *
 * Options: --cols 4  --w 480 (tile width; height = w × 9/16)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const out = args[0];
const cols = Number(opt("cols", 4));
const w = Number(opt("w", 480));
const h = Math.round((w * 9) / 16);

// positional args after `out`, skipping every --flag and its value
let files = args.slice(1).filter((a, i, all) => !a.startsWith("--") && !(i > 0 && all[i - 1].startsWith("--")));
const film = opt("film", null);
if (film) {
  const dir = path.resolve("public/films", film);
  const all = (await fs.readdir(dir)).filter((f) => /^f_\d+\.webp$/.test(f)).sort();
  const every = Number(opt("every", 20));
  files = all.filter((_, i) => i % every === 0 || i === all.length - 1).map((f) => path.join(dir, f));
}
if (!out || files.length === 0) {
  console.error("usage: contact-sheet.mjs out.jpg <files…> | --film <name> [--every 20]");
  process.exit(1);
}

const tiles = await Promise.all(files.map((f) => sharp(f).resize(w, h, { fit: "fill" }).jpeg().toBuffer()));
const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: w * cols, height: h * rows, channels: 3, background: "#000" } })
  .composite(tiles.map((input, k) => ({ input, left: (k % cols) * w, top: Math.floor(k / cols) * h })))
  .jpeg({ quality: 72 })
  .toFile(out);
console.log(`${out}: ${files.length} tiles (${files.map((f) => path.basename(f)).join(" ")})`);
