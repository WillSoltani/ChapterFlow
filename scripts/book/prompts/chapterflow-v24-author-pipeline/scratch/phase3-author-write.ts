/** Phase-3 decisive experiment (v24): author-write POM ch01 + ch09 through the
 *  whole-chapter writer, then hand the bytes to the blinded panel vs shipped.
 *  Steps: archive the parked v23 ch01/ch09 (so a lazy writer can't "pass" on
 *  stale bytes) → compile-chapter-briefs + gate → authorWriteOneChapter ×2
 *  (parallel) → reader-budget spot info → rubric-metrics line for the two. */
import { copyFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { resolve } from "path";
import { resolveDeps } from "../src/orchestrator/autopilot.js";
import { authorWriteOneChapter } from "../src/orchestrator/authorRun.js";

const BOOK = "the-power-of-moments";
const CHAPTERS = [1, 9];
const CHAPTERS_DIR = resolve(process.cwd(), "state/chapters");
const BACKUP = resolve(process.cwd(), ".tmp/phase3-parked-chapters");
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);
const pad = (n: number) => String(n).padStart(2, "0");

async function main() {
  const deps = resolveDeps({ log });

  // 1. Archive the parked v23 chapters (move-aside, restorable).
  mkdirSync(BACKUP, { recursive: true });
  for (const n of CHAPTERS) {
    for (const suffix of [".v21-native.chapter.json", ".v21-native.chapter.session.json"]) {
      const f = `${BOOK}-ch${pad(n)}${suffix}`;
      const src = resolve(CHAPTERS_DIR, f);
      if (existsSync(src)) {
        copyFileSync(src, resolve(BACKUP, f));
        renameSync(src, resolve(BACKUP, `${f}.moved`));
        log(`archived ${f}`);
      }
    }
  }

  // 2. Briefs (whole-book compile; deterministic; siblings on disk feed avoid-lists).
  for (const verb of [["compile-chapter-briefs", BOOK], ["chapter-brief-gate", BOOK]]) {
    const r = await deps.runVerb(verb, {});
    log(`${verb[0]} exit ${r.code}`);
    if (r.code !== 0) {
      console.log([r.stdout, r.stderr].join("\n").split("\n").slice(-12).join("\n"));
      throw new Error(`${verb[0]} failed`);
    }
  }

  // 3. Author-write both chapters (parallel; each = 1 writer + gate-chapter + retry ×1).
  const results = await Promise.all(CHAPTERS.map((n) => authorWriteOneChapter(BOOK, n, deps)));
  let failed = false;
  results.forEach((r, i) => {
    if (r.ok) log(`ch${pad(CHAPTERS[i])}: AUTHORED (session ${r.sessionId})`);
    else { failed = true; log(`ch${pad(CHAPTERS[i])}: FAILED — ${(r as { reason: string }).reason.slice(0, 400)}`); }
  });
  if (failed) throw new Error("author write did not converge");

  // 4. Deterministic context lines (info): budgets + rubric metrics.
  const rb = await deps.runVerb(["reader-budget-check", BOOK], {});
  log(`reader-budget-check exit ${rb.code}`);
  console.log([rb.stdout, rb.stderr].join("\n").split("\n").filter((l) => /ch0?(1|9)\b|CHB|blocker|clean/i.test(l)).slice(0, 12).join("\n"));
  const m = await deps.runVerb(["rubric-metrics", BOOK], {});
  console.log([m.stdout, m.stderr].join("\n").split("\n").filter((l) => l.includes("ch01") || l.includes("ch09")).join("\n"));
  log("PHASE3 WRITE COMPLETE — proceed to the blinded panel");
}
main().catch((e) => { console.error("DRIVER ERROR:", e); process.exit(1); });
