#!/usr/bin/env node
/**
 * hf-fetch.mjs — poll Higgsfield jobs until done, download results, write thumbs.
 *
 *   node scripts/film/hf-fetch.mjs <outDir> <name>=<jobId> [<name>=<jobId> ...]
 *
 * Writes <outDir>/<name>.json, <outDir>/<name>.(png|mp4) and, for images,
 * <outDir>/<name>_v.jpg (960px preview). Polls job_status (non-sync) every
 * few seconds. Exit 0 when every job completed, 2 if any failed.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const [outDir, ...pairs] = process.argv.slice(2);
if (!outDir || pairs.length === 0) {
  console.error("usage: hf-fetch.mjs <outDir> name=jobId ...");
  process.exit(1);
}
await fs.mkdir(outDir, { recursive: true });

const HF = path.resolve(path.dirname(new URL(import.meta.url).pathname), "hf.mjs");

function call(tool, args) {
  return new Promise((resolve, reject) => {
    const p = spawn("node", [HF, tool, JSON.stringify(args)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", () => {
      // hf.mjs prints text blocks first, then the pretty-printed structuredContent
      // (starts with "{\n"). Take the last such block.
      const i = out.lastIndexOf("\n{\n");
      try {
        resolve(JSON.parse(out.slice(i + 1)));
      } catch (e) {
        reject(new Error(`bad output for ${tool}: ${out.slice(0, 300)}`));
      }
    });
  });
}

const TERMINAL = new Set(["completed", "failed", "canceled", "cancelled", "error", "nsfw"]);
let bad = 0;

async function one(name, jobId) {
  for (;;) {
    const sc = await call("job_status", { jobId });
    const g = sc.generation || sc;
    const st = g.status;
    if (TERMINAL.has(st)) {
      await fs.writeFile(path.join(outDir, `${name}.json`), JSON.stringify(sc, null, 1));
      if (st !== "completed") {
        console.log(`${name}: ${st}`);
        bad++;
        return;
      }
      const url = g.results?.rawUrl || g.results?.url || g.results?.video?.url;
      if (!url) {
        console.log(`${name}: completed but no url — see ${name}.json`);
        bad++;
        return;
      }
      const ext = /\.(mp4|mov|webm)(\?|$)/i.test(url) ? url.match(/\.(mp4|mov|webm)/i)[1] : "png";
      const file = path.join(outDir, `${name}.${ext}`);
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      await fs.writeFile(file, buf);
      if (ext === "png") {
        await sharp(buf).resize(960).jpeg({ quality: 70 }).toFile(path.join(outDir, `${name}_v.jpg`));
      }
      console.log(`${name}: ${file} (${buf.length} bytes) ${url}`);
      return;
    }
    await new Promise((r) => setTimeout(r, ((sc.poll_after_seconds ?? 5) + 1) * 1000));
  }
}

await Promise.all(
  pairs.map((p) => {
    const [name, jobId] = p.split("=");
    return one(name, jobId);
  }),
);
process.exit(bad ? 2 : 0);
