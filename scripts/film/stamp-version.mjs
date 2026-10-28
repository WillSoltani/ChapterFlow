#!/usr/bin/env node
/**
 * stamp-version.mjs — write a fresh content version `v` into every
 * public/films/<name>/manifest.json, then sync it into book.timeline.json.
 * Use after any manual change to frames; encode.mjs does this automatically.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FILMS = path.join(ROOT, "public/films");
const v = Date.now().toString(36);
let n = 0;
for (const d of await fs.readdir(FILMS)) {
  const p = path.join(FILMS, d, "manifest.json");
  try {
    const m = JSON.parse(await fs.readFile(p, "utf8"));
    m.v = v;
    await fs.writeFile(p, JSON.stringify(m, null, 2) + "\n");
    n++;
  } catch {
    /* not a film dir */
  }
}
console.log(`stamped ${n} manifests with v=${v}`);
spawnSync("node", [path.join(ROOT, "scripts/film/encode.mjs"), "--sync-timeline"], { stdio: "inherit" });
