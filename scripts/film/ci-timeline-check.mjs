#!/usr/bin/env node
/**
 * ci-timeline-check.mjs — CI only (.github/workflows/ci.yml, job "film"),
 * after scripts/film/placeholder.mjs and encode.mjs --sync-timeline: proves
 * the placeholder run changed nothing the page requests except the packs.
 *
 * - The only tracked file changed is components/film/book.timeline.json.
 * - In it, every film keeps its count, keys, version and band tiers (sizes,
 *   virtual frame, band rect, version) exactly as committed; only the `pack`
 *   fields (films.<name>.pack, films.<name>.bands.<tier>.pack) differ, and
 *   every variant that had one still has one (the page reads packs).
 * - Every generated manifest says `placeholder: true` (the specs' signal,
 *   e2e/film-frames.ts) and holds the timeline's count.
 *
 * Exit 1 with the differences otherwise. Writes nothing.
 */
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { BAND_TIER_WIDTHS } from "./band-sync.mjs";

const ROOT = process.cwd();
const TIMELINE = "components/film/book.timeline.json";
const problems = [];

const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8" }).split("\n").filter(Boolean);
for (const f of changed) if (f !== TIMELINE) problems.push(`tracked file changed: ${f}`);

const committed = JSON.parse(execFileSync("git", ["show", `HEAD:${TIMELINE}`], { encoding: "utf8" }));
const now = JSON.parse(await fs.readFile(path.join(ROOT, TIMELINE), "utf8"));

/** A copy with every pack field removed, and the list of where packs were. */
function withoutPacks(tl) {
  const where = [];
  const copy = JSON.parse(JSON.stringify(tl));
  for (const [name, film] of Object.entries(copy.films)) {
    if (film.pack) where.push(name);
    delete film.pack;
    for (const [tier, b] of Object.entries(film.bands ?? {})) {
      if (b.pack) where.push(`${name}-${tier}`);
      delete b.pack;
    }
  }
  return { copy, where };
}
const a = withoutPacks(committed);
const b = withoutPacks(now);
if (JSON.stringify(a.copy) !== JSON.stringify(b.copy)) problems.push("the timeline changed outside its pack fields (counts, keys, versions or band tiers)");
for (const v of a.where) if (!b.where.includes(v)) problems.push(`${v}: the committed timeline records a pack, the synced one does not (the page would load frame by frame)`);

for (const [name, film] of Object.entries(now.films)) {
  for (const dir of [name, ...BAND_TIER_WIDTHS.map((w) => `${name}-b${w}`)]) {
    try {
      const m = JSON.parse(await fs.readFile(path.join(ROOT, "public/films", dir, "manifest.json"), "utf8"));
      if (m.placeholder !== true) problems.push(`${dir}: manifest is not a placeholder's`);
      if (m.count !== film.count) problems.push(`${dir}: ${m.count} frames, the timeline says ${film.count}`);
    } catch {
      problems.push(`${dir}: no manifest`);
    }
  }
}

if (problems.length) {
  console.error(`ci-timeline-check: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`ci-timeline-check: only pack fields differ (${b.where.length} packs); every manifest is a placeholder with the timeline's count`);
