#!/usr/bin/env node
/**
 * hf-upload.mjs — upload a local image (e.g. a real frame pulled with ffmpeg)
 * to Higgsfield and print its media_id, for use as a start/end image so a new
 * clip joins existing footage exactly.
 *
 *   node scripts/film/hf-upload.mjs <file.png>
 *
 * Flow: media_upload → PUT bytes to the presigned URL → media_confirm.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const file = process.argv[2];
if (!file) {
  console.error("usage: hf-upload.mjs <file.png|jpg>");
  process.exit(1);
}
const HF = path.resolve(path.dirname(new URL(import.meta.url).pathname), "hf.mjs");
const call = (tool, a) => new Promise((res, rej) => {
  const p = spawn("node", [HF, tool, JSON.stringify(a)], { stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("close", (c) => (c === 0 ? res(out) : rej(new Error(out.slice(0, 400)))));
});

const ext = path.extname(file).slice(1).toLowerCase();
const contentType = ext === "png" ? "image/png" : "image/jpeg";
const up = await call("media_upload", { filename: path.basename(file), content_type: contentType });
const json = JSON.parse(up.slice(up.lastIndexOf("\n{\n") + 1));
const { upload_url: url, media_id: id } = json.uploads[0];

const res = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: await fs.readFile(file) });
if (!res.ok) {
  console.error(`PUT failed: HTTP ${res.status}`);
  process.exit(1);
}
await call("media_confirm", { type: "image", media_id: id });
console.log(id);
