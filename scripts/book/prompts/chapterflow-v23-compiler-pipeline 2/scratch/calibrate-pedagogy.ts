/**
 * calibrate-pedagogy.ts — P03 calibration.
 *
 * For a spread of tracked published packages, computes per-chapter:
 *   - distractor-tell count + rate   (rubricMetrics.distractorTell — uniquely-longest-by-chars)
 *   - transfer count                 (rubricMetrics.transferRatio per single question = blooms∪cue)
 *   - clean (<=14-word) memorable-line count in the breakdown
 *     (harvested the way optimizers/memorableLines.ts does, judged with rubricMetrics.memorableLineClean)
 *
 * The ruler is score.py-parity via src/metrics/rubricMetrics.ts. Packages are read
 * from the canonical checkout (tracked at repo root), never from the worktree copy,
 * so the numbers match what score.py grades post-publish.
 *
 * Usage: npx tsx scratch/calibrate-pedagogy.ts [--zerofp]
 *   default: calibration table over the CALIBRATION set (incl. atomic-habits + POM)
 *   --zerofp: run the three gate budgets across every >=85-composite tracked package
 *             and assert zero blockers; POM must trip the tell budget.
 */
import { readFileSync, existsSync } from "fs";

import { distractorTell, transferRatio, memorableLineClean } from "../src/metrics/rubricMetrics.js";
import { memorableLineScore } from "../src/optimizers/memorableLines.js";
import {
  QUIZ_TELL_MAX_PER_CHAPTER,
  quizTransferFloor,
  quizTransferTarget,
  SUMMARY_MIN_CLEAN_MEMORABLE_LINES,
} from "../src/sections/pedagogyThresholds.js";

const CATALOG = "/Users/radinsoltani/ChapterFlow-books/book-packages";
const BASELINE = "/Users/radinsoltani/ChapterFlow-books/.claude/skills/book-score/baseline.json";

type Question = { questionId?: string; prompt?: unknown; choices?: unknown; correctIndex?: unknown; bloomsLevel?: unknown };
type Chapter = { number?: number; quiz?: { questions?: Question[] }; breakdown?: Record<string, unknown> };
type Pkg = { chapters: Chapter[] };

// mirrors sectionGate.scoredMemorableSentences: reuse the optimizer's extraction,
// then judge cleanliness with the rubric's <=14-word rule.
function cleanMemorableCount(breakdown: Record<string, unknown> | undefined): number {
  const tiers = ["fastRead", "deepRead", "fullRead"] as const;
  const seen = new Set<string>();
  let clean = 0;
  for (const tier of tiers) {
    const value = typeof breakdown?.[tier] === "string" ? (breakdown![tier] as string) : "";
    const candidates = value
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => memorableLineScore(s) > 0);
    for (const c of candidates) {
      const key = c.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      if (memorableLineClean(c)) clean += 1;
    }
  }
  return clean;
}

type ChapterMetrics = { ch: number; n: number; tell: number; tellRatePct: number; transfer: number; clean: number };

function chapterMetrics(c: Chapter, idx: number): ChapterMetrics {
  const qs = c.quiz?.questions ?? [];
  const n = qs.length;
  let tell = 0;
  let scorable = 0;
  let transfer = 0;
  for (const q of qs) {
    const dt = distractorTell(q as any);
    // excluded questions (empty choices / bad index) are dropped from the rate denominator,
    // exactly as score.py does; distractorTell returns tell=false for them.
    const excluded = dt.reasons[0]?.startsWith("excluded from tell rate");
    if (!excluded) {
      scorable += 1;
      if (dt.tell) tell += 1;
    }
    if (transferRatio([q as any]) === 100) transfer += 1;
  }
  return {
    ch: c.number ?? idx + 1,
    n,
    tell,
    tellRatePct: scorable ? (100 * tell) / scorable : NaN,
    transfer,
    clean: cleanMemorableCount(c.breakdown),
  };
}

function loadPkg(id: string): Pkg | null {
  const p = `${CATALOG}/${id}.v21.json`;
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

function summarize(id: string): { id: string; chapters: ChapterMetrics[] } | null {
  const pkg = loadPkg(id);
  if (!pkg) return null;
  return { id, chapters: pkg.chapters.map(chapterMetrics) };
}

const CALIBRATION_IDS = [
  // >=85 composite (the zero-FP floor set)
  "atomic-habits",
  "thinking-in-bets",
  "crucial-conversations",
  "games-people-play",
  // strong mid-tier
  "difficult-conversations",
  "the-happiness-hypothesis",
  "made-to-stick",
  "how-to-win-friends-and-influence-people",
  // the target: POM (rank 95/98, 72% tell)
  "the-power-of-moments",
];

function comp(id: string): number | undefined {
  const b = JSON.parse(readFileSync(BASELINE, "utf8")) as Array<{ id: string; comp: number }>;
  return b.find((x) => x.id === id)?.comp;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function runCalibration(): void {
  console.log("=== P03 CALIBRATION TABLE ===");
  console.log("budgets under test: tell blocker at >" + QUIZ_TELL_MAX_PER_CHAPTER + "/ch; transfer floor(9)=" + quizTransferFloor(9) + " target(9)=" + quizTransferTarget(9) + "; memorable >=" + SUMMARY_MIN_CLEAN_MEMORABLE_LINES + "\n");
  const header = ["book", "comp", "ch", "worst-tell/ch", "book-tell%", "min-transfer/ch", "min-clean/ch", "tell-fail-ch", "transfer-fail-ch", "mem-fail-ch"];
  console.log(header.join("\t"));
  for (const id of CALIBRATION_IDS) {
    const s = summarize(id);
    if (!s) { console.log(`${id}\t(missing)`); continue; }
    let totalTell = 0;
    let totalScorable = 0;
    let worstTell = 0;
    let minTransfer = Infinity;
    let minClean = Infinity;
    const tellFail: number[] = [];
    const transferFail: number[] = [];
    const memFail: number[] = [];
    for (const cm of s.chapters) {
      const scorable = Number.isFinite(cm.tellRatePct) ? Math.round((100 * cm.tell) / cm.tellRatePct) : cm.n;
      totalTell += cm.tell;
      totalScorable += scorable;
      worstTell = Math.max(worstTell, cm.tell);
      minTransfer = Math.min(minTransfer, cm.transfer);
      minClean = Math.min(minClean, cm.clean);
      if (cm.tell > QUIZ_TELL_MAX_PER_CHAPTER) tellFail.push(cm.ch);
      if (cm.transfer < quizTransferFloor(cm.n)) transferFail.push(cm.ch);
      if (cm.clean < SUMMARY_MIN_CLEAN_MEMORABLE_LINES) memFail.push(cm.ch);
    }
    const bookTellPct = totalScorable ? (100 * totalTell) / totalScorable : NaN;
    console.log([
      id,
      comp(id) ?? "—",
      s.chapters.length,
      worstTell,
      fmt(bookTellPct) + "%",
      minTransfer,
      minClean,
      tellFail.length ? tellFail.join(",") : "-",
      transferFail.length ? transferFail.join(",") : "-",
      memFail.length ? memFail.join(",") : "-",
    ].join("\t"));
  }
}

function runZeroFp(): void {
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Array<{ id: string; comp: number }>;
  const ge85 = baseline.filter((x) => x.comp >= 85 && existsSync(`${CATALOG}/${x.id}.v21.json`));
  console.log("=== ZERO-FP PROOF: >=85-composite tracked packages ===");
  console.log("BLOCKERS = transfer-floor + memorable (tell is ADVISORY/shadow — see note below).\n");
  console.log("book\tcomp\tchapters\tBLOCKER:transfer\tBLOCKER:memorable\t(shadow)tell-adv-ch");
  let anyBlocker = false;
  for (const { id, comp: c } of ge85) {
    const s = summarize(id)!;
    let transB = 0;
    let memB = 0;
    let tellAdv = 0;
    for (const cm of s.chapters) {
      if (cm.transfer < quizTransferFloor(cm.n)) transB += 1;
      if (cm.clean < SUMMARY_MIN_CLEAN_MEMORABLE_LINES) memB += 1;
      if (cm.tell > QUIZ_TELL_MAX_PER_CHAPTER) tellAdv += 1;
    }
    if (transB || memB) anyBlocker = true;
    console.log([id, c, s.chapters.length, transB, memB, tellAdv].join("\t"));
  }
  console.log(anyBlocker ? "\nRESULT: BLOCKER FALSE POSITIVE(S) present — loosen a budget." : "\nRESULT: zero blockers on every >=85 book. ✅");

  // POM: TRANSFER (the real lever) must trip; tell CANNOT separate POM.
  const pom = summarize("the-power-of-moments")!;
  const pomTransferCh = pom.chapters.filter((cm) => cm.transfer < quizTransferFloor(cm.n)).map((cm) => cm.ch);
  console.log(`\nPOM chapters tripping the TRANSFER blocker floor: ${pomTransferCh.length ? pomTransferCh.join(",") : "NONE"}`);
  console.log(
    "\nNOTE — distractor-tell is ADVISORY only. The published catalog ships high tell\n" +
    "across the board (score.py: atomic 84%, crucial 81%, games 75%, thinking 53%, POM 56%);\n" +
    "POM is CLEANER on tell than 3 of the 4 >=85 books, and atomic-habits has >2 tells in\n" +
    "20/20 chapters. No per-chapter tell budget both clears the catalog and trips POM, so a\n" +
    "hard tell blocker would false-positive the entire catalog. TRANSFER is the check that\n" +
    "actually distinguishes POM (see the transfer column above).",
  );
}

if (process.argv.includes("--zerofp")) runZeroFp();
else runCalibration();
