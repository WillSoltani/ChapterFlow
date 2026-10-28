#!/usr/bin/env node
/**
 * hf-video.mjs — submit one palace video, auto-declining any preset nudge.
 *
 *   node scripts/film/hf-video.mjs <VIDEO_KEY> <start_media_id> <end_media_id> [--duration 10] [--res 2k]
 *                                  [--ref <media_id>]... [--cost]
 *
 * --ref   repeatable; passed as role "image_references" (flux_3_video supports it)
 * --cost  preflight only: prints the credit cost, submits nothing
 *
 * Prints the job id on success.
 */

import path from "node:path";
import { spawn } from "node:child_process";
import { VIDEOS } from "./palace-prompts.mjs";

const args = process.argv.slice(2);
const [key, start, end] = args;
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
if (!VIDEOS[key] || !start || !end) {
  console.error(`usage: hf-video.mjs <${Object.keys(VIDEOS).join("|")}> <start_media_id> <end_media_id> [--duration 10] [--res 2k]`);
  process.exit(1);
}
const HF = path.resolve(path.dirname(new URL(import.meta.url).pathname), "hf.mjs");
const call = (tool, a) => new Promise((res) => {
  const p = spawn("node", [HF, tool, JSON.stringify(a)], { stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("close", () => res(out));
});

const params = {
  model: "flux_3_video",
  prompt: VIDEOS[key],
  aspect_ratio: "16:9",
  duration: Number(opt("duration", 10)),
  resolution: opt("res", "2k"),
  generate_audio: false,
  medias: [
    { value: start, role: "start_image" },
    { value: end, role: "end_image" },
    ...args.flatMap((a, i) => (a === "--ref" && args[i + 1] ? [{ value: args[i + 1], role: "image_references" }] : [])),
  ],
};
if (args.includes("--cost")) {
  const ask = (p) => call("generate_video", { params: { ...p, get_cost: true }, context: `Memory Palace ${key} (cost)` });
  let c = await ask(params);
  const pre = /declined_preset_id: "([0-9a-f-]{36})"/.exec(c)?.[1];
  if (pre) c = await ask({ ...params, declined_preset_id: pre });
  console.log(c.trim().slice(0, 600));
  process.exit(0);
}
let out = await call("generate_video", { params, context: `Memory Palace ${key}` });
const preset = /declined_preset_id: "([0-9a-f-]{36})"/.exec(out)?.[1];
if (preset) {
  out = await call("generate_video", { params: { ...params, declined_preset_id: preset }, context: `Memory Palace ${key}` });
}
const job = /^- ([0-9a-f-]{36})/m.exec(out)?.[1];
if (!job) { console.error(out.slice(0, 600)); process.exit(1); }
console.log(job);
