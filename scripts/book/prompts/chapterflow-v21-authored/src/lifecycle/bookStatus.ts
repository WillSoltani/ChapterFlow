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
import { isAttestationFresh, loadAttestation, type QcVerdict } from "../critics/qcAttestation.js";
import { auditBook, type BookAudit } from "../critics/catalogAudit.js";
import { loadLibraryState } from "../librarian/libraryState.js";
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
  /** names in THIS book that also appear in other books (the churn tell). */
  crossBookNames: Array<{ name: string; otherBooks: number }>;
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

function crossBookNameReuse(bookId: string, audit: BookAudit): Array<{ name: string; otherBooks: number }> {
  const usage = loadLibraryState().globalNameUsage ?? {};
  const out: Array<{ name: string; otherBooks: number }> = [];
  for (const name of audit.bankNames) {
    const rec = usage[name];
    const others = rec ? rec.books.filter((b) => b !== bookId).length : 0;
    if (others > 0) out.push({ name, otherBooks: others });
  }
  return out.sort((a, b) => b.otherBooks - a.otherBooks).slice(0, 12);
}

function readVariety(bookId: string, chapters: ChapterV21[]): VarietyRead | null {
  if (chapters.length === 0) return null;
  const audit = quiet(() => auditBook(bookId, chapters));
  const hookTotal = Object.values(audit.hookShapes).reduce((a, b) => a + b, 0) || 1;
  const dominantHook = Math.max(0, ...Object.values(audit.hookShapes));
  const ticTotal = Object.values(audit.ticCounts).reduce((a, b) => a + b, 0);
  const crossBookNames = crossBookNameReuse(bookId, audit);
  const notes: string[] = [];
  const dominantHookShare = dominantHook / hookTotal;
  const ticsPerChapter = ticTotal / chapters.length;
  if (dominantHookShare > 0.6) notes.push(`hooks are ${Math.round(dominantHookShare * 100)}% one shape — vary the openings`);
  if (ticsPerChapter > 1.5) notes.push(`house tics ~${ticsPerChapter.toFixed(1)}/chapter — trim stock phrases`);
  if (crossBookNames.length > 0) notes.push(`${crossBookNames.length} character name(s) reused from other books (e.g. ${crossBookNames.slice(0, 3).map((n) => n.name).join(", ")})`);
  if (audit.nominalizationsPer100Words > 12) notes.push(`abstract-noun density ${audit.nominalizationsPer100Words.toFixed(1)}/100w — get concrete sooner`);
  return {
    dominantHookShare,
    ticsPerChapter,
    nominalizationsPer100Words: audit.nominalizationsPer100Words,
    avgSentenceWords: audit.avgSentenceWords,
    crossBookNames,
    notes,
  };
}

export function computeBookStatus(bookId: string): BookStatus {
  const written = loadBookChapters(bookId);
  const byNumber = new Map(written.map((ch) => [ch.number, ch]));
  const expected = expectedChapterCount(bookId, written);
  const stage = safeNextTaskKind(bookId);

  const chapters: ChapterStatus[] = written.map((ch) => {
    const gate = quiet(() => runShipGate(ch));
    const att = loadAttestation(bookId, ch.number);
    const fresh = att ? isAttestationFresh(att, ch) : false;
    return {
      number: ch.number,
      chapterId: ch.chapterId,
      written: true,
      shipGatePass: gate.blockers.length === 0,
      shipBlockers: gate.blockers.length,
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
    const bg = quiet(() => runBookGate(bookId, written));
    bookGatePass = bg.passed;
    bookGateBlockers = bg.findings.filter((f) => f.severity === "blocker").length;
  }

  const packaged = existsSync(resolve(REPO_ROOT, "book-packages", `${bookId}.v21.json`));
  const guardrails = existsSync(resolve(STATE_DIR, "guardrails", `${bookId}.guardrails.md`));
  const allWritten = expected != null && writtenChapters >= expected && writtenChapters > 0;
  const allGated = allWritten && gatedChapters === writtenChapters && bookGatePass === true;
  const allQcd = allWritten && qcdChapters === writtenChapters;
  const publishable = allGated && allQcd;

  const variety = readVariety(bookId, written);

  // Honest phase: when chapters exist, the quality state is more truthful than
  // the file-existence ladder (which says "research-bibliography" for a manually
  // authored book that never used the research-run flow).
  let phase: string;
  if (writtenChapters === 0) phase = stage;
  else if (!allWritten) phase = `generating (${writtenChapters}/${expected ?? "?"} written)`;
  else if (!allGated) phase = "gating";
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
  } else if (!allQcd) {
    nextLabel = "run no-API QC";
    nextCommand = `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "${bookId}" --pass`;
  } else if (!packaged) {
    nextLabel = "publish";
    nextCommand = `npx tsx src/cli.ts publish "${bookId}"`;
  } else {
    nextLabel = "all done";
    nextCommand = `# ${bookId} is QC'd and shipped to book-packages/`;
  }

  return {
    bookId, stage, phase, expectedChapters: expected, writtenChapters, gatedChapters, qcdChapters,
    bookGatePass, bookGateBlockers, packaged, publishable, guardrails, variety, nextCommand, nextLabel, chapters,
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
    L.push(`variety (advisory): hooks ${Math.round(s.variety.dominantHookShare * 100)}% dominant · tics ${s.variety.ticsPerChapter.toFixed(1)}/ch · abstraction ${s.variety.nominalizationsPer100Words.toFixed(1)}/100w · cross-book names ${s.variety.crossBookNames.length}`);
    for (const n of s.variety.notes) L.push(`  ⚠ ${n}`);
  }
  L.push("next:");
  L.push(`  ${s.nextLabel}`);
  L.push(`  ${s.nextCommand}`);
  return L.join("\n");
}
