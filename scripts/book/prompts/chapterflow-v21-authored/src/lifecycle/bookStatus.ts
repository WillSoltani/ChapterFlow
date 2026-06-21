/**
 * book-status — the one place an operator looks to answer "where is this book,
 * and what is the single next command?" across the WHOLE lifecycle.
 *
 * next-task drives generation but stops at "finalize" and is file-existence only
 * (it runs no gate). This layers the QUALITY state on top — per chapter: written?
 * ship-gate clean? a fresh PUBLISHABLE QC attestation? — plus book-gate, the
 * shipped package, and a cross-book variety read (advisory). It then resolves the
 * exact next command, including the gate → qc-auto → publish tail next-task omits.
 *
 * Read-only. Degrades gracefully when research/index/chapters are absent.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runShipGate } from "../critics/finalGate.js";
import { runBookGate } from "../critics/bookGate.js";
import { evaluateDeterministic } from "../qc/orchestrator/deterministicGate.js";
import { isAttestationFresh, loadAttestation, type QcVerdict } from "../critics/qcAttestation.js";
import { auditBook } from "../critics/catalogAudit.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { computeNextTask } from "../next-task.js";
import type { ChapterV21 } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../../..");
const STATE_DIR = resolve(__dirname, "../../state");

export type ChapterStatus = {
  number: number;
  chapterId: string;
  written: boolean;
  shipGatePass: boolean;
  shipBlockers: number;
  qcVerdict: QcVerdict | "NONE";
  qcFresh: boolean;
};

export type VarietyRead = {
  dominantHookShare: number;
  ticsPerChapter: number;
  nominalizationsPer100Words: number;
  avgSentenceWords: number;
  notes: string[];
};

export type BookStatus = {
  bookId: string;
  /** raw next-task ladder position (file-existence based). */
  stage: string;
  /** honest lifecycle phase derived from quality state (preferred for display). */
  phase: string;
  expectedChapters: number | null;
  writtenChapters: number;
  gatedChapters: number;
  qcdChapters: number;
  bookGatePass: boolean | null;
  bookGateBlockers: number;
  /** True iff the FULL deterministic battery (source-v2 + ship-gate + author-check +
   *  intra-book + book-gate + plan-enforcement — the same evaluator qc-converge + finalize
   *  use) is clean. The conductor gates gate→qc on THIS, not just ship-gate+book-gate, so a
   *  source/intra/plan-dirty chapter is converged in the cheap gate phase instead of skipping
   *  to QC (where the round preflight would hard-halt 'infra' on a fixable content defect).
   *  Fail-safe → true on any evaluator error (never block progression on an unreadable book). */
  deterministicClean: boolean;
  packaged: boolean;
  publishable: boolean;
  /** whether the pre-authoring collision-prevention sheet exists. */
  guardrails: boolean;
  variety: VarietyRead | null;
  nextCommand: string;
  nextLabel: string;
  chapters: ChapterStatus[];
};

function safeNextTaskKind(bookId: string): string {
  try {
    return computeNextTask(bookId).kind;
  } catch {
    return "research-bibliography";
  }
}

/** Run a function with console output muted — the book/pattern gates emit
 *  advisory BP-warnings (e.g. "BP26: no source sidecar") to the console, which
 *  would bury the status summary. We only want their structured findings. */
function quiet<T>(fn: () => T): T {
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try {
    return fn();
  } finally {
    console.log = orig.log; console.warn = orig.warn; console.error = orig.error;
  }
}

function expectedChapterCount(bookId: string, written: ChapterV21[]): number | null {
  const indexPath = resolve(STATE_DIR, "indexes", `${bookId}.json`);
  if (existsSync(indexPath)) {
    try {
      const idx = JSON.parse(readFileSync(indexPath, "utf8"));
      if (Array.isArray(idx) && idx.length) return idx.length;
    } catch { /* fall through */ }
  }
  return written.length > 0 ? written.length : null;
}

function readVariety(bookId: string, chapters: ChapterV21[]): VarietyRead | null {
  if (chapters.length === 0) return null;
  const audit = quiet(() => auditBook(bookId, chapters));
  const hookTotal = Object.values(audit.hookShapes).reduce((a, b) => a + b, 0) || 1;
  const dominantHook = Math.max(0, ...Object.values(audit.hookShapes));
  const ticTotal = Object.values(audit.ticCounts).reduce((a, b) => a + b, 0);
  const notes: string[] = [];
  const dominantHookShare = dominantHook / hookTotal;
  const ticsPerChapter = ticTotal / chapters.length;
  // Note: cross-book NAME reuse is intentionally NOT flagged — names may repeat
  // across books by policy; only within-book duplicates matter (and the gates +
  // namePlan's disjoint allocation already prevent those).
  if (dominantHookShare > 0.6) notes.push(`hooks are ${Math.round(dominantHookShare * 100)}% one shape — vary the openings`);
  if (ticsPerChapter > 1.5) notes.push(`house tics ~${ticsPerChapter.toFixed(1)}/chapter — trim stock phrases`);
  if (audit.nominalizationsPer100Words > 12) notes.push(`abstract-noun density ${audit.nominalizationsPer100Words.toFixed(1)}/100w — get concrete sooner`);
  return {
    dominantHookShare,
    ticsPerChapter,
    nominalizationsPer100Words: audit.nominalizationsPer100Words,
    avgSentenceWords: audit.avgSentenceWords,
    notes,
  };
}

export function computeBookStatus(bookId: string): BookStatus {
  const written = loadBookChapters(bookId);
  const byNumber = new Map(written.map((ch) => [ch.number, ch]));
  const expected = expectedChapterCount(bookId, written);
  const stage = safeNextTaskKind(bookId);

  const chapters: ChapterStatus[] = written.map((ch) => {
    // Fail-safe: a malformed-but-PARSEABLE chapter (valid JSON, bad shape) must not crash
    // computeBookStatus — the conductor calls it every loop, so a throw here wedges the walk-away
    // run the same way a torn file does (quarantine only catches UNPARSEABLE files). A gate crash →
    // treat the chapter as BLOCKED so it routes to the gate-repair loop, never a conductor crash.
    let shipGatePass = false, shipBlockers = 1;
    try { const gate = quiet(() => runShipGate(ch)); shipGatePass = gate.blockers.length === 0; shipBlockers = gate.blockers.length; }
    catch { /* leave BLOCKED — a crash means the chapter needs repair, not a halt */ }
    const att = loadAttestation(bookId, ch.number);
    const fresh = att ? isAttestationFresh(att, ch) : false;
    return {
      number: ch.number,
      chapterId: ch.chapterId,
      written: true,
      shipGatePass,
      shipBlockers,
      qcVerdict: att?.verdict ?? "NONE",
      qcFresh: fresh,
    };
  });

  const writtenChapters = written.length;
  const gatedChapters = chapters.filter((c) => c.shipGatePass).length;
  const qcdChapters = chapters.filter((c) => c.qcVerdict === "PUBLISHABLE" && c.qcFresh).length;

  let bookGatePass: boolean | null = null;
  let bookGateBlockers = 0;
  if (written.length > 0) {
    // Fail-safe (same rationale as the per-chapter gate above): a crash → not clean → routes to gate.
    try { const bg = quiet(() => runBookGate(bookId, written)); bookGatePass = bg.passed; bookGateBlockers = bg.findings.filter((f) => f.severity === "blocker").length; }
    catch { bookGatePass = false; }
  }

  const packaged = existsSync(resolve(REPO_ROOT, "book-packages", `${bookId}.v21.json`));
  const guardrails = existsSync(resolve(STATE_DIR, "guardrails", `${bookId}.guardrails.md`));
  const allWritten = expected != null && writtenChapters >= expected && writtenChapters > 0;

  // Full deterministic battery (source-v2 + ship + author + intra + book + plan) — the SAME
  // evaluator qc-converge/finalize use. The conductor gates gate→qc on this so a deterministically
  // dirty chapter is converged cheaply in the gate phase instead of skipping to a QC round whose
  // preflight would hard-halt. Only matters once ALL chapters are written (decidePhase's allGated
  // requires allWritten), so SKIP the expensive O(n²) battery on partially-written books. Fail-safe
  // → true on any read error (never block on an unreadable book).
  let deterministicClean = true;
  if (allWritten) {
    deterministicClean = quiet(() => {
      try { return evaluateDeterministic(bookId, written, written).clean; } catch { return true; }
    });
  }

  const allGated = allWritten && gatedChapters === writtenChapters && bookGatePass === true;
  const allQcd = allWritten && qcdChapters === writtenChapters;
  // Include deterministicClean so `publishable` can't be true while the phase ladder says "gating"
  // for a deterministically-dirty book (the contradictory-status bug).
  const publishable = allGated && allQcd && deterministicClean;

  const variety = readVariety(bookId, written);

  // Honest phase: when chapters exist, the quality state is more truthful than
  // the file-existence ladder (which says "research-bibliography" for a manually
  // authored book that never used the research-run flow).
  let phase: string;
  if (writtenChapters === 0) phase = stage;
  else if (!allWritten) phase = `generating (${writtenChapters}/${expected ?? "?"} written)`;
  else if (!allGated) phase = "gating";
  else if (!deterministicClean) phase = "gating";
  else if (!allQcd) phase = "qc";
  else if (!packaged) phase = "ready to publish";
  else phase = "shipped";

  // Resolve the single next command from the QUALITY state, not the file-existence
  // ladder (which says "research-bibliography" for a manually authored book). Only
  // route to next-task while chapters are still being produced.
  let nextCommand: string;
  let nextLabel: string;
  if (!allWritten) {
    nextLabel = writtenChapters === 0 ? stage : "write remaining chapters";
    nextCommand = `npx tsx src/cli.ts next-task ${bookId}`;
  } else if (!allGated) {
    nextLabel = "fix ship/book gate blockers";
    const firstBad = chapters.find((c) => !c.shipGatePass);
    nextCommand = firstBad
      ? `npx tsx src/cli.ts gate-chapter state/chapters/${firstBad.chapterId}.v21-native.chapter.json`
      : `npx tsx src/cli.ts book-gate ${bookId}`;
  } else if (!deterministicClean) {
    // Ship/book gates pass but the FULL deterministic battery (source-v2 / author-check /
    // intra-book / plan-enforcement) is dirty — converge it before QC, exactly as the conductor
    // does, so the operator isn't sent to qc-auto on a round whose preflight would block.
    nextLabel = "converge deterministic gates";
    nextCommand = `npx tsx src/cli.ts qc-converge ${bookId}`;
  } else if (!allQcd) {
    nextLabel = "run no-API QC";
    nextCommand = `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "${bookId}" --pass`;
  } else if (!packaged) {
    nextLabel = "publish";
    // Env-prefixed so the printed command runs the full no-API gate stack (sweep + source-verify
    // + manual key-judge + majors). promote/publish now also force this internally, but the
    // displayed command must be honest about the operating mode.
    nextCommand = `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts publish "${bookId}"`;
  } else {
    nextLabel = "all done";
    nextCommand = `# ${bookId} is QC'd and shipped to book-packages/`;
  }

  return {
    bookId, stage, phase, expectedChapters: expected, writtenChapters, gatedChapters, qcdChapters,
    bookGatePass, bookGateBlockers, deterministicClean, packaged, publishable, guardrails, variety, nextCommand, nextLabel, chapters,
  };
}

function bar(done: number, total: number | null): string {
  if (total == null || total === 0) return `${done}/?`;
  return `${done}/${total}`;
}

export function formatBookStatus(s: BookStatus): string {
  const L: string[] = [];
  L.push(`BOOK STATUS — ${s.bookId}`);
  L.push(`phase: ${s.phase}`);
  L.push(`chapters: written ${bar(s.writtenChapters, s.expectedChapters)} · gate-clean ${bar(s.gatedChapters, s.writtenChapters || s.expectedChapters)} · QC'd ${bar(s.qcdChapters, s.writtenChapters || s.expectedChapters)}`);
  L.push(`book-gate: ${s.bookGatePass == null ? "n/a" : s.bookGatePass ? "PASS" : `BLOCK (${s.bookGateBlockers})`}`);
  L.push(`packaged: ${s.packaged ? "yes" : "no"} · publishable: ${s.publishable ? "YES" : "no"} · guardrails: ${s.guardrails ? "yes" : "no"}`);
  if (s.chapters.length > 0) {
    const notReady = s.chapters.filter((c) => !c.shipGatePass || !(c.qcVerdict === "PUBLISHABLE" && c.qcFresh));
    if (notReady.length > 0) {
      L.push("chapters needing work:");
      for (const c of notReady.slice(0, 15)) {
        const bits: string[] = [];
        if (!c.shipGatePass) bits.push(`ship-gate ${c.shipBlockers} blocker(s)`);
        const qc = c.qcVerdict === "NONE" ? "no QC attestation" : !c.qcFresh ? `QC ${c.qcVerdict} (stale)` : `QC ${c.qcVerdict}`;
        if (!(c.qcVerdict === "PUBLISHABLE" && c.qcFresh)) bits.push(qc);
        L.push(`  ch${String(c.number).padStart(2, "0")}: ${bits.join("; ")}`);
      }
    }
  }
  if (s.variety) {
    L.push(`variety (advisory): hooks ${Math.round(s.variety.dominantHookShare * 100)}% dominant · tics ${s.variety.ticsPerChapter.toFixed(1)}/ch · abstraction ${s.variety.nominalizationsPer100Words.toFixed(1)}/100w`);
    for (const n of s.variety.notes) L.push(`  ⚠ ${n}`);
  }
  L.push("next:");
  L.push(`  ${s.nextLabel}`);
  L.push(`  ${s.nextCommand}`);
  return L.join("\n");
}
