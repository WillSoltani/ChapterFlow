/**
 * bookSamenessRun — the LIVE book-sameness repair driver (2026-07-06).
 *
 * Executes the surgical book-level architecture diversification the planner
 * (critics/bookSamenessRepair.ts) selects: it re-authors ONLY the targeted
 * chapters with their `book-sameness-repair` directive injected as a writer
 * complaint (so the directive reaches the writer even for a MANUAL-BRIEF book,
 * which bypasses the v5 compiled-brief deal), then self-checks each result and
 * ROLLS BACK any chapter the diversification made worse — the 14/14 base is never
 * destroyed by a failed re-author.
 *
 * Guarantees (match the owner's constraints):
 *   - Only planner targets are touched; preserved chapters are never written and
 *     are asserted byte-stable before/after.
 *   - Each target consumes ONE bounded `samenessRepairConsumed` ledger grant (cap
 *     1/lineage) — no unlimited retries, and the regen `consumed` evidence is never
 *     reset or erased.
 *   - A target whose re-author fails the deterministic gate, or whose fresh review
 *     does not clear the bar cleanly, is RESTORED to its previous passing bytes.
 *   - Review + book acceptance run AFTER this via the normal conductor
 *     (doAuthorReview) — this driver only does the bounded re-authoring.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import type { ChapterV21 } from "../types.js";
import type { AutopilotDeps, AutopilotOutcome } from "./autopilot.js";
import { CHAPTERS_DIR, chapterFileName } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { checkArchitectureMonoculture } from "../critics/architectureMonoculture.js";
import { planBookSamenessRepair } from "../critics/bookSamenessRepair.js";
import { planContentDeviceRepair } from "../critics/contentDeviceRepair.js";
import { reportContentMachinery } from "../critics/contentMachinery.js";
import {
  authorChapterId,
  authorWriteOneChapter,
  resolveAuthorIo,
  type AuthorIo,
} from "./authorRun.js";
import {
  complaintNamesReservedHarm,
  reviewOneChapter,
  resolveAuthorReviewIo,
  resolveChapterBar,
  resolveChapterNoiseBand,
} from "./authorReview.js";
import {
  computeRegenLineage,
  loadAuthorRegenLedger,
  samenessRepairConsumedFor,
  recordSamenessRepairConsumed,
  resetSamenessRepairConsumed,
} from "./authorRegenLedger.js";

/** The already-distinct chapters that must be preserved (from the 2026-07-05
 *  diagnosis: research/concept/first-person shapes that are NOT the mold). The
 *  book-specific default; override per book via opts.preserveChapters. */
const DEFAULT_PRESERVE = [1, 4, 7, 10];

export type SamenessChapterOutcome = {
  chapterNumber: number;
  assignedFamily: string;
  status: "diversified" | "reverted" | "skipped-cap" | "write-failed";
  priorComposite?: number;
  newComposite?: number;
  detail: string;
};

export type BookSamenessResult = {
  fired: boolean;
  targets: number[];
  preserved: number[];
  outcomes: SamenessChapterOutcome[];
  /** Preserved chapters whose bytes changed — MUST be empty (a bug if not). */
  preservedViolations: number[];
};

function chapterPath(bookId: string, n: number): string {
  return resolve(CHAPTERS_DIR, chapterFileName(authorChapterId(bookId, n)));
}

export type BookSamenessOptions = {
  maxParallel?: number;
  heartbeat?: () => boolean;
  preserveChapters?: number[];
  targetCap?: number;
  io?: Partial<AuthorIo>;
  /** Operator retry: force EXACTLY these chapters (fires even if the aggregate
   *  cleared), and RESET each one's bounded sameness-repair grant first so the
   *  controlled retry gets one fresh attempt. */
  onlyChapters?: number[];
  /** Content-deal repair only: override the ubiquity cap the planner targets. A
   *  value BELOW the critic's default (0.6) makes the planner flip MORE chapters so
   *  the dominant devices land comfortably below cap (margin against a reverted
   *  chapter) instead of exactly at it. */
  deviceCapFrac?: number;
};

/**
 * Run the bounded book-sameness repair. Returns a structured result; the caller
 * (CLI / conductor) then runs review + acceptance. Never throws on a single
 * chapter's failure — it restores and records.
 */
export async function doBookSamenessRepair(
  bookId: string,
  deps: AutopilotDeps,
  opts: BookSamenessOptions = {},
): Promise<BookSamenessResult> {
  const io = resolveAuthorIo(opts.io);
  const reviewIo = resolveAuthorReviewIo(opts.io);
  const bar = resolveChapterBar();
  const heartbeat = opts.heartbeat ?? (() => true);
  const preserve = opts.preserveChapters ?? DEFAULT_PRESERVE;

  const chapters = io.loadChapters(bookId);
  const findings = checkArchitectureMonoculture(chapters);
  const plan = planBookSamenessRepair(findings, chapters.length, {
    preserveChapters: preserve,
    targetCap: opts.targetCap,
    forceChapters: opts.onlyChapters,
  });
  // Controlled retry: reset the bounded sameness grant for each forced chapter so
  // the deliberate retry gets ONE fresh attempt (logged). Only ever touches the
  // sameness lane, never the regen evidence.
  if (opts.onlyChapters && opts.onlyChapters.length > 0) {
    for (const n of opts.onlyChapters) {
      let lineage: string | null = null;
      try { lineage = computeRegenLineage(bookId, n); } catch { lineage = null; }
      if (lineage) {
        resetSamenessRepairConsumed(bookId, n, lineage);
        deps.log(`[sameness] ch${String(n).padStart(2, "0")}: reset book-sameness-repair grant for a controlled retry.`);
      }
    }
  }
  if (!plan.fired) {
    deps.log(`[sameness] ${bookId}: architecture-monoculture critic did not fire — nothing to diversify.`);
    return { fired: false, targets: [], preserved: plan.preserved, outcomes: [], preservedViolations: [] };
  }

  // Snapshot the bytes of every PRESERVED chapter up front, to prove byte-stability.
  const preservedBefore = new Map<number, string>();
  for (const n of plan.preserved) {
    const p = chapterPath(bookId, n);
    if (existsSync(p)) preservedBefore.set(n, readFileSync(p, "utf8"));
  }

  deps.log(
    `[sameness] ${bookId}: diversifying ${plan.targets.length} chapter(s) ` +
    `(${plan.targets.map((t) => `ch${String(t.chapterNumber).padStart(2, "0")}→${t.assignedFamily}`).join(", ")}); ` +
    `preserving ${plan.preserved.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}.`,
  );

  const outcomes: SamenessChapterOutcome[] = [];
  for (const target of plan.targets) {
    heartbeat();
    outcomes.push(await diversifyOne(bookId, { chapterNumber: target.chapterNumber, directive: target.directive, label: target.assignedFamily }, deps, io, reviewIo, bar));
  }

  // Verify preserved chapters are byte-identical.
  const preservedViolations: number[] = [];
  for (const [n, before] of preservedBefore) {
    const p = chapterPath(bookId, n);
    const after = existsSync(p) ? readFileSync(p, "utf8") : "";
    if (after !== before) preservedViolations.push(n);
  }
  if (preservedViolations.length > 0) {
    deps.log(`[sameness] ${bookId}: PRESERVED-CHAPTER VIOLATION — bytes changed on ${preservedViolations.map((n) => `ch${n}`).join(", ")} (bug).`);
  }

  return { fired: true, targets: plan.targets.map((t) => t.chapterNumber), preserved: plan.preserved, outcomes, preservedViolations };
}

/** A generic diversification target: the chapter, the writer directive to inject, and
 *  a short label for logs/outcomes (an architecture family or "content-deal"). */
type DiversifyTarget = { chapterNumber: number; directive: string; label: string };

async function diversifyOne(
  bookId: string,
  target: DiversifyTarget,
  deps: AutopilotDeps,
  io: AuthorIo,
  reviewIo: ReturnType<typeof resolveAuthorReviewIo>,
  bar: number,
): Promise<SamenessChapterOutcome> {
  const n = target.chapterNumber;
  const nn = String(n).padStart(2, "0");
  const base = { chapterNumber: n, assignedFamily: target.label };
  const path = chapterPath(bookId, n);
  const priorBytes = existsSync(path) ? readFileSync(path, "utf8") : null;

  // Bounded: one sameness-repair grant per lineage. A lineage we cannot compute
  // (pre-brief fixture) runs uncounted rather than converting a safety net into a halt.
  let lineage: string | null = null;
  try { lineage = computeRegenLineage(bookId, n); } catch { lineage = null; }
  if (lineage) {
    let consumed = 1;
    try { consumed = samenessRepairConsumedFor(loadAuthorRegenLedger(bookId), n, lineage); } catch { consumed = 1; }
    if (consumed >= 1) {
      deps.log(`[sameness] ch${nn}: already consumed its book-sameness-repair grant for this lineage — skipping (bounded).`);
      return { ...base, status: "skipped-cap", detail: "sameness-repair cap (1/lineage) already consumed" };
    }
    recordSamenessRepairConsumed(bookId, n, lineage); // logged reason: book-sameness-repair; counts before the spawn
  }

  // Re-author with the diversification directive injected as a writer complaint.
  const r = await authorWriteOneChapter(bookId, n, deps, { complaints: [target.directive], io });
  if (!r.ok) {
    if (priorBytes !== null) writeFileSync(path, priorBytes);
    deps.log(`[sameness] ch${nn}: re-author FAILED (${r.reason.slice(0, 160)}) — restored prior passing bytes.`);
    return { ...base, status: "write-failed", detail: `re-author failed; restored prior bytes: ${r.reason.slice(0, 200)}` };
  }

  // Self-check: does the diversified chapter still PASS review at the bar? Use a
  // non-persisting read (the conductor runs the authoritative persisted review
  // afterward). A FAIL/invalid → roll back to the prior passing bytes.
  const fresh = io.loadChapters(bookId).find((c) => c.number === n);
  if (!fresh) {
    if (priorBytes !== null) writeFileSync(path, priorBytes);
    return { ...base, status: "write-failed", detail: "re-authored chapter did not load; restored prior bytes" };
  }
  const review = await reviewOneChapter(bookId, fresh, deps, reviewIo, bar, "-sameness-check", /* persist */ false);
  // KEEP the diversified draft if it PASSES outright, OR if it is a NEAR-BAR,
  // clean-keyed, valid draft with NO true blocker — the conductor's median-of-3
  // no-mustFix tiebreak will formalize that PASS (a single blinded read's ship84
  // gestalt has ~50% variance, so a lone ship=false above the bar is noise, not a
  // regression). REVERT only a genuinely-worse draft: invalid quotes, a key defect,
  // a reserved-harm mustFix, or a composite below the near-bar band.
  const band = resolveChapterNoiseBand();
  const keysClean = review.keyCheck.matches === review.keyCheck.of;
  const noReservedHarm = !review.complaints.some((c) => c.mustFix && complaintNamesReservedHarm(c));
  const keep = review.valid && keysClean && noReservedHarm && review.composite >= bar - band;
  if (!keep) {
    if (priorBytes !== null) writeFileSync(path, priorBytes);
    deps.log(`[sameness] ch${nn}: diversified draft did not clear the near-bar band (composite ${review.composite}, ship=${review.ship84}, keys ${review.keyCheck.matches}/${review.keyCheck.of}, valid=${review.valid}) — restored prior passing bytes.`);
    return { ...base, status: "reverted", newComposite: review.composite, detail: `diversified draft below bar-band / invalid / key-defect / true-blocker; restored prior passing version` };
  }
  const near = review.pass ? "" : " (near-bar; conductor tiebreak will formalize)";
  deps.log(`[sameness] ch${nn}: diversified to "${target.label}" — composite ${review.composite}, ship=${review.ship84}, keys ${review.keyCheck.matches}/${review.keyCheck.of}${near}.`);
  return { ...base, status: "diversified", newComposite: review.composite, detail: `diversified to ${target.label}; composite ${review.composite}${near}` };
}

// ── Content-deal repair (2026-07-06) ──────────────────────────────────────────
// The DEEPER lane: re-authors the chapters whose BODY machinery (return-proof,
// proxy-cast, second-setting, …) saturates the book, using the content-deal-sameness
// directive. Reuses the SAME bounded ledger, self-check, restore-on-regress, and
// preserved-byte-stable guarantees as doBookSamenessRepair.

export type ContentRepairResult = BookSamenessResult & {
  /** Devices over cap before the round (the churn drivers). */
  overCapDevices: string[];
  /** Devices still over cap after the plan's targets (projected) — empty = fully relieved. */
  residualOverCap: string[];
};

export async function doContentDeviceRepair(
  bookId: string,
  deps: AutopilotDeps,
  opts: BookSamenessOptions = {},
): Promise<ContentRepairResult> {
  const io = resolveAuthorIo(opts.io);
  const reviewIo = resolveAuthorReviewIo(opts.io);
  const bar = resolveChapterBar();
  const heartbeat = opts.heartbeat ?? (() => true);

  const chapters = io.loadChapters(bookId);
  const before = reportContentMachinery(chapters);
  deps.log(
    `[content-deal] ${bookId}: device ubiquity — ` +
    before.usage.map((u) => `${u.id} ${Math.round(u.frac * 100)}%${u.overCap ? "⚠" : ""}`).join(", "),
  );

  // Controlled retry: reset the bounded sameness grant for each forced chapter.
  if (opts.onlyChapters && opts.onlyChapters.length > 0) {
    for (const n of opts.onlyChapters) {
      let lineage: string | null = null;
      try { lineage = computeRegenLineage(bookId, n); } catch { lineage = null; }
      if (lineage) {
        resetSamenessRepairConsumed(bookId, n, lineage);
        deps.log(`[content-deal] ch${String(n).padStart(2, "0")}: reset content-deal-repair grant for a controlled retry.`);
      }
    }
  }

  const plan = planContentDeviceRepair(chapters, {
    targetCap: opts.targetCap,
    forceChapters: opts.onlyChapters,
    preserveChapters: opts.preserveChapters,
    thresholds: opts.deviceCapFrac != null
      ? { deviceUbiquityFrac: opts.deviceCapFrac, axesWarn: 2, axesBlock: 4 }
      : undefined,
  });
  if (!plan.fired) {
    deps.log(`[content-deal] ${bookId}: no device over the ubiquity cap — nothing to repair.`);
    return { fired: false, targets: [], preserved: plan.preserved, outcomes: [], preservedViolations: [], overCapDevices: [], residualOverCap: [] };
  }
  if (plan.residualOverCap.length > 0) {
    deps.log(`[content-deal] ${bookId}: NOTE — targetCap (${opts.targetCap ?? 8}) cannot bring ${plan.residualOverCap.join(", ")} under cap this round; re-run after review to finish.`);
  }

  // Snapshot preserved bytes to prove byte-stability.
  const preservedBefore = new Map<number, string>();
  for (const n of plan.preserved) {
    const p = chapterPath(bookId, n);
    if (existsSync(p)) preservedBefore.set(n, readFileSync(p, "utf8"));
  }

  deps.log(
    `[content-deal] ${bookId}: repairing ${plan.targets.length} chapter(s) ` +
    `(${plan.targets.map((t) => `ch${String(t.chapterNumber).padStart(2, "0")}[drop ${t.usedOverCap.join("+") || "mold"}]`).join(", ")}); ` +
    `preserving ${plan.preserved.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}.`,
  );

  const outcomes: SamenessChapterOutcome[] = [];
  for (const target of plan.targets) {
    heartbeat();
    outcomes.push(await diversifyOne(bookId, { chapterNumber: target.chapterNumber, directive: target.directive, label: "content-deal" }, deps, io, reviewIo, bar));
  }

  const preservedViolations: number[] = [];
  for (const [n, prevBytes] of preservedBefore) {
    const p = chapterPath(bookId, n);
    const after = existsSync(p) ? readFileSync(p, "utf8") : "";
    if (after !== prevBytes) preservedViolations.push(n);
  }
  if (preservedViolations.length > 0) {
    deps.log(`[content-deal] ${bookId}: PRESERVED-CHAPTER VIOLATION — bytes changed on ${preservedViolations.map((n) => `ch${n}`).join(", ")} (bug).`);
  }

  // Report post-repair device ubiquity for the same-session before/after.
  const after = reportContentMachinery(io.loadChapters(bookId));
  deps.log(
    `[content-deal] ${bookId}: AFTER — ` +
    after.usage.map((u) => `${u.id} ${Math.round(u.frac * 100)}%${u.overCap ? "⚠" : ""}`).join(", "),
  );

  return {
    fired: true,
    targets: plan.targets.map((t) => t.chapterNumber),
    preserved: plan.preserved,
    outcomes,
    preservedViolations,
    overCapDevices: plan.overCapDevices,
    residualOverCap: after.overCapDevices,
  };
}
