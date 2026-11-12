#!/usr/bin/env node
/**
 * pack.mjs — build (or verify) the film packs: ONE pack.bin per variant
 * directory, made from the existing frame files byte for byte (no re-encode),
 * skeleton layer first. Format: scripts/film/pack-lib.mjs. The runtime reads
 * it in a worker (components/film/film-worker.ts, docs/FILM_REEL.md).
 *
 *   npm run film:pack                         # every landscape + band-tier directory of the timeline
 *   npm run film:pack -- palace-03 palace-03-b900   # named directories only
 *   npm run film:pack -- --verify             # re-read every pack: each slice equals its file
 *   --out public/films                        # film root
 *
 * Writing a pack also records it in the directory's manifest.json (`pack`:
 * bytes, header, skeletonEnd, v) and then syncs book.timeline.json through
 * encode.mjs --sync-timeline. It never modifies, renames or deletes a frame
 * or a poster. The legacy <film>-p directories get no pack.
 * --verify exits 1 on any problem and writes nothing.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { verifyPack, writePack } from "./pack-lib.mjs";
import { BAND_TIER_WIDTHS } from "./band-sync.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = path.resolve(ROOT, outIdx >= 0 ? args[outIdx + 1] : "public/films");
const verify = args.includes("--verify");
const named = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");

const timeline = JSON.parse(await fs.readFile(path.resolve(ROOT, "components/film/book.timeline.json"), "utf8"));
const all = Object.keys(timeline.films).flatMap((f) => [f, ...BAND_TIER_WIDTHS.map((w) => `${f}-b${w}`)]);
const dirs = named.length ? named : all;

let problems = 0;
let total = 0;
for (const name of dirs) {
  const dir = path.join(OUT, name);
  if (!(await fs.stat(dir).then((s) => s.isDirectory(), () => false))) {
    console.log(`${name}: no directory, skipped`);
    continue;
  }
  if (verify) {
    let p;
    try {
      p = await verifyPack(dir);
    } catch (e) {
      // Never stop at one directory: report it and verify the others.
      p = [`${name}: ${e instanceof Error ? e.message : String(e)}`];
    }
    problems += p.length;
    for (const line of p) console.log(`  ${line}`);
    const size = (await fs.stat(path.join(dir, "pack.bin")).catch(() => ({ size: 0 }))).size;
    total += size;
    console.log(`${name}: ${p.length ? "FAILED" : "verified"} (${(size / 1e6).toFixed(1)} MB)`);
  } else {
    const p = await writePack(dir);
    total += p.bytes;
    console.log(`${name}: pack.bin ${(p.bytes / 1e6).toFixed(2)} MB, header ${p.header} B, skeleton ends at ${p.skeletonEnd} (${((100 * p.skeletonEnd) / p.bytes).toFixed(0)} %), v ${p.v}`);
  }
}
console.log(`${dirs.length} directories, ${(total / 1e6).toFixed(1)} MB of packs`);
if (verify) {
  process.exit(problems ? 1 : 0);
}
const sync = spawnSync("node", [path.join(ROOT, "scripts/film/encode.mjs"), "--sync-timeline", "--out", path.relative(ROOT, OUT)], { stdio: "inherit" });
process.exit(sync.status ?? 1);
