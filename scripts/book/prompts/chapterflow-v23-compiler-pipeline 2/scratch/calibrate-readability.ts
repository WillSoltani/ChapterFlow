/**
 * P02 calibration harness (throwaway).
 *
 * Goal: derive per-tier FK ceilings + a whole-breakdown Flesch-ease floor for
 * src/critics/readingLevel.ts, justified by measurements on the real published
 * catalog (book-packages/*.v21.json) rather than taste.
 *
 * Measurement functions are the score.py-parity ones in
 * src/metrics/rubricMetrics.ts, so the pipeline measures against the SAME ruler
 * that scores books after publish (.claude/skills/book-score/score.py).
 *
 * It reports three things:
 *   1. score.py-IDENTICAL sampled numbers (md5-seeded 4 chapters, per-chapter
 *      mean of breakdown_prose flesch/fk) for a focus set incl. atomic-habits &
 *      the-power-of-moments — the numbers the post-publish rubric actually sees.
 *   2. Catalog-wide per-chapter extremes (max FK per tier, min whole-breakdown
 *      ease) across EVERY tracked package — the zero-false-positive envelope any
 *      blocking gate must sit outside of.
 *   3. Candidate band evaluation.
 *
 * Run:  npx tsx scratch/calibrate-readability.ts
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fkGrade, fleschReadingEase } from "../src/metrics/rubricMetrics.js";
import { fleschKincaid, READING_LEVEL_TARGETS } from "../src/critics/readingLevel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
function findBookPackages(): string {
  // Walk up to the REPO-ROOT catalog (136 tracked packages). The pipeline dir
  // has its own small book-packages/ (local v23 run outputs, untracked, empty
  // in a fresh worktree) — a dir only counts if it actually holds packages.
  let d = __dirname;
  for (let i = 0; i < 8; i++) {
    const cand = resolve(d, "book-packages");
    if (existsSync(cand) && readdirSync(cand).some((f) => f.endsWith(".v21.json"))) return cand;
    d = resolve(d, "..");
  }
  throw new Error("book-packages/ with *.v21.json not found");
}
const PKG_DIR = findBookPackages();
const CANON = "/Users/radinsoltani/ChapterFlow-books";
const baseline: Array<{ id: string; comp: number }> = JSON.parse(
  readFileSync(resolve(CANON, ".claude/skills/book-score/baseline.json"), "utf8"),
);
const compById = new Map<string, number>();
for (const b of baseline) if (typeof b.comp === "number") compById.set(b.id, b.comp);

type Tier = "fastRead" | "deepRead" | "fullRead";
const TIERS: Tier[] = ["fastRead", "deepRead", "fullRead"];
const mean = (xs: number[]) => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : " NA");

function breakdownProse(ch: any): string {
  return TIERS.map((t) => ch.breakdown?.[t] ?? "").filter((p: string) => p).join("\n\n");
}
// score.py select_idxs (md5-seeded) — replicated exactly (BigInt for the 128-bit md5).
import { createHash } from "node:crypto";
function selectIdxs(bookId: string, N: number, n = 4): number[] {
  const hex = createHash("md5").update(bookId).digest("hex");
  let seed = BigInt("0x" + hex);
  const MOD = BigInt(N);
  const K = 2654435761n;
  const idxs = new Set<number>();
  let i = 0n;
  while (idxs.size < Math.min(n, N)) { idxs.add(Number(((seed + i * K) % MOD + MOD) % MOD)); i += 1n; }
  return [...idxs].sort((a, b) => a - b);
}

const FOCUS = [
  "atomic-habits", "crucial-conversations", "games-people-play", "thinking-in-bets",
  "made-to-stick", "meditations", "tiny-habits", "eat-that-frog", "built-to-last",
  "the-power-of-moments",
];

console.log("\n=== (1) score.py-IDENTICAL sampled numbers (md5 4-chapter, per-chapter mean of breakdown flesch/fk) ===");
console.log("id                         comp | sampFlesch sampFK | fastFK deepFK fullFK (sampled, per-tier mean)");
for (const id of FOCUS) {
  const p = resolve(PKG_DIR, `${id}.v21.json`);
  if (!existsSync(p)) { console.log(`  skip ${id}`); continue; }
  const pkg = JSON.parse(readFileSync(p, "utf8"));
  const ch = pkg.chapters ?? [];
  const idxs = selectIdxs(id, ch.length);
  const flesch: number[] = [], perTier: Record<Tier, number[]> = { fastRead: [], deepRead: [], fullRead: [] };
  for (const i of idxs) {
    flesch.push(fleschReadingEase(breakdownProse(ch[i])));
    for (const t of TIERS) perTier[t].push(fkGrade(ch[i].breakdown?.[t] ?? ""));
  }
  console.log(
    `${id.padEnd(26)} ${f1(compById.get(id) ?? NaN).padStart(4)} | ${f1(mean(flesch)).padStart(9)} ${f1(mean(idxs.map((i) => fkGrade(breakdownProse(ch[i]))))).padStart(6)} | ` +
    `${f1(mean(perTier.fastRead)).padStart(6)} ${f1(mean(perTier.deepRead)).padStart(6)} ${f1(mean(perTier.fullRead)).padStart(6)}  [idxs ${idxs.join(",")}]`,
  );
}

console.log("\n=== (2) CATALOG-WIDE per-chapter extremes (zero-false-positive envelope over ALL tracked packages) ===");
const files = readdirSync(PKG_DIR).filter((f) => f.endsWith(".v21.json"));
let maxFast = { v: -Infinity, where: "" }, maxDeep = { v: -Infinity, where: "" }, maxFull = { v: -Infinity, where: "" };
let minEase = { v: Infinity, where: "" };
// distribution buckets for per-chapter breakdown ease
const easeBelow = { b55: 0, b60: 0, b65: 0, b70: 0, total: 0 };
const fullFKAbove = { a9: 0, a10: 0, a11: 0, total: 0 };
for (const f of files) {
  const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, f), "utf8"));
  const id = f.replace(".v21.json", "");
  for (const [ci, ch] of (pkg.chapters ?? []).entries()) {
    const fast = fkGrade(ch.breakdown?.fastRead ?? ""), deep = fkGrade(ch.breakdown?.deepRead ?? ""), full = fkGrade(ch.breakdown?.fullRead ?? "");
    const ease = fleschReadingEase(breakdownProse(ch));
    if (fast > maxFast.v) maxFast = { v: fast, where: `${id}#${ci}` };
    if (deep > maxDeep.v) maxDeep = { v: deep, where: `${id}#${ci}` };
    if (full > maxFull.v) maxFull = { v: full, where: `${id}#${ci}` };
    if (Number.isFinite(ease) && ease < minEase.v) minEase = { v: ease, where: `${id}#${ci}` };
    if (Number.isFinite(ease)) { easeBelow.total++; if (ease < 55) easeBelow.b55++; if (ease < 60) easeBelow.b60++; if (ease < 65) easeBelow.b65++; if (ease < 70) easeBelow.b70++; }
    if (Number.isFinite(full)) { fullFKAbove.total++; if (full > 9) fullFKAbove.a9++; if (full > 10) fullFKAbove.a10++; if (full > 11) fullFKAbove.a11++; }
  }
}
console.log(`packages scanned: ${files.length}`);
console.log(`per-chapter MAX fastFK = ${f1(maxFast.v)}  (${maxFast.where})`);
console.log(`per-chapter MAX deepFK = ${f1(maxDeep.v)}  (${maxDeep.where})`);
console.log(`per-chapter MAX fullFK = ${f1(maxFull.v)}  (${maxFull.where})`);
console.log(`per-chapter MIN breakdown ease = ${f1(minEase.v)}  (${minEase.where})`);
console.log(`fullFK>9: ${fullFKAbove.a9}/${fullFKAbove.total}  >10: ${fullFKAbove.a10}  >11: ${fullFKAbove.a11}`);
console.log(`breakdown ease <55: ${easeBelow.b55}/${easeBelow.total}  <60: ${easeBelow.b60}  <65: ${easeBelow.b65}  <70: ${easeBelow.b70}`);
console.log("current legacy TIER_TARGETS:", JSON.stringify(READING_LEVEL_TARGETS));

console.log("\n=== (3) ZERO-FP ENVELOPE within HIGH-QUALITY (>=84 composite) published books ===");
const good = baseline.filter((b) => typeof b.comp === "number" && b.comp >= 84).map((b) => b.id);
console.log(`>=84 books: ${good.length}`);
let gFast = -Infinity, gDeep = -Infinity, gFull = -Infinity, gEaseMin = Infinity;
let gFastW = "", gDeepW = "", gFullW = "", gEaseW = "";
for (const id of good) {
  const p = resolve(PKG_DIR, `${id}.v21.json`); if (!existsSync(p)) continue;
  const pkg = JSON.parse(readFileSync(p, "utf8"));
  for (const [ci, ch] of (pkg.chapters ?? []).entries()) {
    const fast = fkGrade(ch.breakdown?.fastRead ?? ""), deep = fkGrade(ch.breakdown?.deepRead ?? ""), full = fkGrade(ch.breakdown?.fullRead ?? "");
    const ease = fleschReadingEase(breakdownProse(ch));
    if (fast > gFast) { gFast = fast; gFastW = `${id}#${ci}`; }
    if (deep > gDeep) { gDeep = deep; gDeepW = `${id}#${ci}`; }
    if (full > gFull) { gFull = full; gFullW = `${id}#${ci}`; }
    if (Number.isFinite(ease) && ease < gEaseMin) { gEaseMin = ease; gEaseW = `${id}#${ci}`; }
  }
}
console.log(`GOOD per-ch MAX fastFK=${f1(gFast)} (${gFastW})  deepFK=${f1(gDeep)} (${gDeepW})  fullFK=${f1(gFull)} (${gFullW})`);
console.log(`GOOD per-ch MIN breakdown ease=${f1(gEaseMin)} (${gEaseW})`);

console.log("\n=== (4) POM per-chapter worst values (all 12 chapters) ===");
{
  const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, "the-power-of-moments.v21.json"), "utf8"));
  let wf = -Infinity, wd = -Infinity, wfu = -Infinity, we = Infinity;
  for (const ch of pkg.chapters) {
    wf = Math.max(wf, fkGrade(ch.breakdown?.fastRead ?? ""));
    wd = Math.max(wd, fkGrade(ch.breakdown?.deepRead ?? ""));
    wfu = Math.max(wfu, fkGrade(ch.breakdown?.fullRead ?? ""));
    we = Math.min(we, fleschReadingEase(breakdownProse(ch)));
  }
  console.log(`POM worst-chapter: fastFK=${f1(wf)} deepFK=${f1(wd)} fullFK=${f1(wfu)} minEase=${f1(we)}`);
}
