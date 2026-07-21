/**
 * chapterGateComposite — the COMPLETE gate-chapter verdict as one in-process
 * function (IMP-01, F-001/F-020).
 *
 * Extracted verbatim from cli.ts's runGateChapter so the conductor can gate a
 * CANDIDATE chapter (attempt-workspace bytes, master plan §8.8) without ever
 * exposing it at the canonical path just to reuse a CLI command. The CLI verb
 * delegates here — one composition, two entry points, no drift.
 *
 * Composition (order preserved from the CLI):
 *   1. chapter-only ship gate (crash-guarded — a malformed chapter is a BLOCK
 *      report, not a stack trace);
 *   2. intra-book similarity (AS5+ against sibling chapters — the sibling
 *      CONTEXT path decides which directory supplies siblings, so a candidate
 *      validates against the COMMITTED siblings of its canonical home);
 *   3. IDN identity guard (chapterId vs filename stem, shadow-major);
 *   4. authoring-contract advisory + quiz answer-key judge advisory;
 *   5. the authoritative combined "Gate verdict:" line;
 *   6. gate-attempt tracking + the STUCK / FORM-SHIFTING circuit breakers
 *      (exit 3) — keyed by the caller-supplied attempt key so the history the
 *      May-2026 Covey incident added stays continuous across the CLI and the
 *      conductor's candidate validation.
 */

import { resolve } from "path";

import type { ChapterV21 } from "../types.js";
import type { BookContentReader } from "../books/candidateTypes.js";
import { checkChapterIdentity } from "../lib/chapterPaths.js";
import { runShipGate, formatGateReport, type ShipGateOptions } from "./finalGate.js";
import { runIntraBookChecks } from "./intraBook.js";
import { openCriticCandidateEntries } from "./schema.js";

export type ChapterGateCompositeResult = {
  /** 0 = PASS, 1 = BLOCK (or ship-gate crash on malformed chapter), 3 = circuit breaker. */
  exitCode: 0 | 1 | 3;
  /** The full human-readable report (byte-equivalent to what the CLI printed). */
  report: string;
  /** true when the ship gate CRASHED on a malformed chapter (CLI prints to stderr). */
  crashed: boolean;
  combinedBlockers: number;
};

/** Optional isolation controls for callers that gate an experiment-local
 * candidate.  Normal CLI/pipeline callers omit this object and retain the
 * canonical advisory/history behaviour. */
export type ChapterGateCompositeOptions = {
  /** Persist circuit-breaker history here instead of canonical
   * state/gate-attempts.json. */
  gateAttemptStatePath?: string;
  /** Frozen sibling chapters from same explicit candidate snapshot. */
  siblings?: ChapterV21[];
  siblingWarning?: string;
  /** Frozen source sidecar supplied by an isolated caller.  When present the
   * authoring-contract advisory never searches ambient .chapterflow runs. */
  sourceSidecar?: unknown;
  /** The key-judge record is canonical QC state and is not an input to a fresh
   * forward experiment.  Isolated callers disable this advisory; their
   * separately ledgered quiz lane remains authoritative. */
  disableCanonicalKeyJudgeAdvisory?: boolean;
  keyJudgeFindings?: Array<{ checkId: string; severity: string; message: string }>;
  gateAttemptState?: Record<string, GateAttemptEntry>;
  persistGateAttemptState?: (state: Record<string, GateAttemptEntry>) => void;
  shipGate?: ShipGateOptions;
};

export async function runChapterGateComposite(
  chapter: ChapterV21,
  /** Path used for sibling discovery + identity check — the chapter's CANONICAL
   *  home (pass the canonical path even when gating candidate bytes, so the
   *  candidate is compared against committed siblings and excluded from itself). */
  siblingContextPath: string,
  /** Key for the persisted gate-attempt history. The CLI passes its RAW path
   *  argument (usually the relative "state/chapters/…" spelling) — keep passing
   *  the same spelling from the conductor so per-chapter history stays one row. */
  attemptKey: string,
  options: ChapterGateCompositeOptions = {},
): Promise<ChapterGateCompositeResult> {
  if (options.gateAttemptState === undefined || options.persistGateAttemptState === undefined) {
    return {
      exitCode: 1,
      crashed: false,
      combinedBlockers: 1,
      report: "GATE_ATTEMPT_STATE_UNBOUND: explicit gateAttemptState and persistGateAttemptState are required; path/default fallback is forbidden.",
    };
  }
  const lines: string[] = [];

  // ── 1. Chapter-only ship gate (crash-guarded) ─────────────────────────────
  let report;
  try {
    report = runShipGate(chapter, options.shipGate);
  } catch (err) {
    return {
      exitCode: 1,
      crashed: true,
      combinedBlockers: 1,
      report:
        `gate-chapter: ship gate CRASHED on a malformed chapter (${(err as Error)?.message ?? String(err)}). ` +
        `Fix the malformed field (likely a quiz question: missing/null choices, out-of-range correctIndex, or non-string bloomsLevel) and re-run.`,
    };
  }
  lines.push(formatGateReport(report));

  // ── 2. Intra-book quiz similarity (AS5/AS6 early detection) ───────────────
  const siblingLoad = { siblings: options.siblings ?? [], warning: options.siblingWarning };
  if (siblingLoad.warning) lines.push(`  WARN: ${siblingLoad.warning}`);
  const intraFindings = runIntraBookChecks(chapter, siblingLoad.siblings);
  let extraBlockers = 0;
  let extraMajors = 0;
  if (intraFindings.length > 0) {
    lines.push("");
    lines.push("Intra-book quiz similarity findings (compared against prior chapters of same book):");
    for (const f of intraFindings) {
      lines.push(`  [${f.checkId} ${f.severity}] ${f.message}`);
      if (f.severity === "blocker") extraBlockers++;
    }
  }

  // ── 3. Identity guard (IDN) ───────────────────────────────────────────────
  const identityFindings = checkChapterIdentity(chapter, siblingContextPath);
  if (identityFindings.length > 0) {
    lines.push("");
    lines.push("Identity findings (chapterId vs filename):");
    for (const f of identityFindings) {
      lines.push(`  [${f.checkId} ${f.severity}] ${f.message}`);
      if (f.severity === "blocker") extraBlockers++;
      else if (f.severity === "major") extraMajors++;
    }
  }

  // ── 4a. Authoring-contract findings (advisory/shadow) ────────────────────
  try {
    const { checkAuthoringContract } = await import("./authoringContract.js");
    const sidecar = options.sourceSidecar;
    const acFindings = checkAuthoringContract(chapter, { sidecar, filePath: resolve(siblingContextPath) });
    if (acFindings.length > 0) {
      lines.push("");
      lines.push(`Authoring-contract findings (advisory/shadow — ${acFindings.length}; run \`author-check\` for the full JOB report):`);
      for (const f of acFindings) lines.push(`  [${f.checkId}] ${f.unit}: ${f.message.slice(0, 140)}`);
    }
  } catch {
    /* non-fatal — advisory layer */
  }

  // ── 4b. Quiz answer-key judge (advisory — blocks at promote) ─────────────
  if (!options.disableCanonicalKeyJudgeAdvisory) {
    try {
      const kjFindings = options.keyJudgeFindings ?? [];
      if (kjFindings.length > 0) {
        lines.push("");
        lines.push("Quiz answer-key judge findings (advisory — blocks at promote):");
        for (const f of kjFindings) lines.push(`  [${f.checkId} ${f.severity}] ${f.message}`);
      }
    } catch {
      /* non-fatal — advisory layer */
    }
  }

  // ── 5. Authoritative combined verdict ─────────────────────────────────────
  const combinedBlockers = report.blockers.length + extraBlockers;
  lines.push("");
  if (combinedBlockers > 0) {
    lines.push(
      `Gate verdict: BLOCK — ${report.blockers.length} chapter blocker(s) + ${extraBlockers} intra-book blocker(s) = ${combinedBlockers} total. (exit 1)`,
    );
  } else {
    lines.push(
      `Gate verdict: PASS — 0 blockers (${report.majors.length + extraMajors} major(s), ${report.minors.length} minor(s) above are non-blocking). (exit 0)`,
    );
  }

  // ── 6. Gate-attempt tracking + circuit breakers ───────────────────────────
  const intraBlockerSig = intraFindings.filter((f) => f.severity === "blocker").map((f) => ({ catalogId: f.checkId }));
  const combinedReport = {
    blockers: [...report.blockers, ...intraBlockerSig],
    passed: report.blockers.length === 0 && extraBlockers === 0,
  };
  let attempts;
  try {
    attempts = recordGateAttempt(attemptKey, combinedReport, options.gateAttemptState, options.persistGateAttemptState);
  } catch (cause) {
    return {
      exitCode: 1,
      crashed: false,
      combinedBlockers: Math.max(1, combinedBlockers),
      report: `${lines.join("\n")}\nGATE_ATTEMPT_STATE_PERSIST_FAILED: ${(cause as Error).message}`,
    };
  }
  let breakerTripped = false;
  if (attempts.sameBlockerStreak >= 3) {
    breakerTripped = true;
    lines.push("");
    lines.push("⚠️  STUCK-BLOCKER — CIRCUIT BREAKER TRIPPED ⚠️");
    lines.push(`This chapter has been gate-checked ${attempts.total} times; the SAME blocker signature fired ${attempts.sameBlockerStreak} times in a row:`);
    lines.push(`  ${attempts.lastSignature}`);
    lines.push("");
    lines.push("STOP. A blocker that survives 3+ attempts is structural, not a surface edit.");
    lines.push("Re-author the field from the source notes, or surface a one-paragraph status to");
    lines.push("the user (the source notes may not differentiate this chapter — a Step-1 issue).");
  } else if (attempts.distinctSigStreak >= 3 && attempts.nonPassTotal >= 3) {
    breakerTripped = true;
    lines.push("");
    lines.push("⚠️  FORM-SHIFTING REPAIR — CIRCUIT BREAKER TRIPPED ⚠️");
    lines.push(`This chapter has failed ${attempts.nonPassTotal} times and the blocker MOVED each attempt:`);
    lines.push(`  ${attempts.recentSigs.join("  →  ")}`);
    lines.push("");
    lines.push("A defect that relocates instead of resolving means you are editing SURFACE FORM");
    lines.push("to evade the critic, not fixing the field — the underlying template just hides in");
    lines.push("whichever field isn't yet covered. STOP patching surfaces. Re-author the failing");
    lines.push("field from the source notes (the Bind Block), or escalate to the user / a different");
    lines.push("author. Do NOT run gate-chapter again on another surface edit — it will just relocate.");
  }
  if (breakerTripped) lines.push("\n(gate-chapter exit code 3 — halt the repair loop.)");

  return {
    exitCode: breakerTripped ? 3 : combinedReport.passed ? 0 : 1,
    crashed: false,
    combinedBlockers,
    report: lines.join("\n"),
  };
}

export async function runChapterGateCompositeFromCandidate(
  reader: BookContentReader,
  input: Readonly<{
    bookId: string;
    candidateId: string;
    manifestDigest: string;
    chapterLogicalPath: string;
    siblingLogicalPaths: readonly string[];
    sourceSidecarLogicalPath: string;
    siblingContextPath: string;
    attemptKey: string;
    gateAttemptState: Record<string, GateAttemptEntry>;
    persistGateAttemptState: (state: Record<string, GateAttemptEntry>) => void;
  }>,
): Promise<ChapterGateCompositeResult> {
  const opened = await openCriticCandidateEntries(reader, {
    ...input,
    logicalPaths: [input.chapterLogicalPath, ...input.siblingLogicalPaths, input.sourceSidecarLogicalPath],
  });
  const siblingEnd = 1 + input.siblingLogicalPaths.length;
  return runChapterGateComposite(
    opened.values[0] as ChapterV21,
    input.siblingContextPath,
    input.attemptKey,
    {
      siblings: opened.values.slice(1, siblingEnd) as ChapterV21[],
      sourceSidecar: opened.values[siblingEnd],
      gateAttemptState: input.gateAttemptState,
      persistGateAttemptState: input.persistGateAttemptState,
      disableCanonicalKeyJudgeAdvisory: true,
    },
  );
}

/** Persists gate-attempt history per chapter key to track stuck-blocker
 *  patterns (May 2026 Covey incident). Moved verbatim from cli.ts so the CLI
 *  verb and the conductor's candidate validation share ONE history. */
type GateAttemptEntry = {
  total: number;
  lastSignature: string;
  sameBlockerStreak: number;
  distinctSigStreak: number;
  nonPassTotal: number;
  recentSigs: string[];
};

export function recordGateAttempt(
  chapterFile: string,
  report: { blockers: Array<{ catalogId: string }>; passed: boolean },
  suppliedState: Record<string, GateAttemptEntry> = {},
  persist?: (state: Record<string, GateAttemptEntry>) => void,
): { total: number; sameBlockerStreak: number; lastSignature: string; distinctSigStreak: number; nonPassTotal: number; recentSigs: string[] } {
  const state = { ...suppliedState };
  const sig = report.passed
    ? "PASS"
    : [...new Set(report.blockers.map((b) => b.catalogId))].sort().join(",");
  const prev: GateAttemptEntry = state[chapterFile] ?? { total: 0, lastSignature: "", sameBlockerStreak: 0, distinctSigStreak: 0, nonPassTotal: 0, recentSigs: [] };
  const isPass = sig === "PASS";
  const sameBlockerStreak = !isPass && sig === prev.lastSignature ? prev.sameBlockerStreak + 1 : isPass ? 0 : 1;
  const shifted = !isPass && prev.lastSignature && prev.lastSignature !== "PASS" && sig !== prev.lastSignature;
  const distinctSigStreak = isPass ? 0 : shifted ? prev.distinctSigStreak + 1 : prev.distinctSigStreak;
  const nonPassTotal = isPass ? 0 : prev.nonPassTotal + 1;
  const recentSigs = isPass ? [] : [...(prev.recentSigs ?? []), sig].slice(-4);
  state[chapterFile] = { total: prev.total + 1, lastSignature: sig, sameBlockerStreak, distinctSigStreak, nonPassTotal, recentSigs };
  persist?.(state);
  return { total: state[chapterFile].total, sameBlockerStreak, lastSignature: sig, distinctSigStreak, nonPassTotal, recentSigs };
}
