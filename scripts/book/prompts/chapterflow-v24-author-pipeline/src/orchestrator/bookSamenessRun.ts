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
import type { ChapterReviewV1 } from "../artifacts/artifactTypes.js";
import type { AutopilotDeps, AutopilotOutcome } from "./autopilot.js";
import { CANONICAL_STATE, CHAPTERS_DIR, chapterFileName } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { restoreAuthorProvenance } from "../qc/sessionProvenance.js";
import { checkArchitectureMonoculture } from "../critics/architectureMonoculture.js";
import { planBookSamenessRepair } from "../critics/bookSamenessRepair.js";
import { planContentDeviceRepair } from "../critics/contentDeviceRepair.js";
import { reportContentMachinery } from "../critics/contentMachinery.js";
import {
  type ContentDeviceId,
  detectChapterDevices,
  detectChapterDeviceMatches,
  diffChapterDeviceUse,
} from "../compiler/contentDeviceDeal.js";
import {
  authorChapterId,
  authorWriteOneChapter,
  resolveAuthorIo,
  type AuthorIo,
  type AuthorWriteOneOpts,
  type AuthorWriteOneResult,
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
  contentRepairConsumedFor,
  recordContentRepairConsumed,
  resetContentRepairConsumed,
} from "./authorRegenLedger.js";

/** The already-distinct chapters that must be preserved (from the 2026-07-05
 *  diagnosis: research/concept/first-person shapes that are NOT the mold). The
 *  book-specific default; override per book via opts.preserveChapters. */
const DEFAULT_PRESERVE = [1, 4, 7, 10];

export type SamenessChapterOutcome = {
  chapterNumber: number;
  assignedFamily: string;
  /** `devices-persisted` (Prompt 2): the draft cleared review but still USED a banned
   *  device, so it was reverted — an honest compliance-failure, never reported as success. */
  status: "diversified" | "reverted" | "devices-persisted" | "skipped-cap" | "write-failed";
  priorComposite?: number;
  newComposite?: number;
  /** Devices detected on the prior (pre-repair) bytes — for the before/after diff. */
  devicesBefore?: ContentDeviceId[];
  /** Devices detected on the fresh (repaired) draft, before any revert. */
  devicesAfter?: ContentDeviceId[];
  /** Banned devices STILL present on the fresh draft → drove a devices-persisted revert. */
  persistedDevices?: ContentDeviceId[];
  /** Newly-present, NON-banned devices vs the prior bytes (balloon-effect telemetry;
   *  never a revert on its own — Requirement 4). */
  substitutedDevices?: ContentDeviceId[];
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
  // ── Injection hooks (default to the real writer / reviewer / paths / ledger) ──
  // Production never sets these; they let the drivers run against a tmp fixture
  // root in tests without touching the repo's canonical state/.
  writeChapter?: WriteChapterFn;
  reviewChapter?: ReviewChapterFn;
  chapterPathFor?: (bookId: string, chapterNumber: number) => string;
  ledgerRoot?: string;
};

/** The whole-chapter re-author (default `authorWriteOneChapter`). */
export type WriteChapterFn = (
  bookId: string,
  chapterNumber: number,
  deps: AutopilotDeps,
  opts: AuthorWriteOneOpts,
) => Promise<AuthorWriteOneResult>;

/** The blinded chapter review (default `reviewOneChapter`). */
export type ReviewChapterFn = (
  bookId: string,
  chapter: ChapterV21,
  deps: AutopilotDeps,
  io: ReturnType<typeof resolveAuthorReviewIo>,
  bar: number,
  labelSuffix?: string,
  persist?: boolean,
) => Promise<ChapterReviewV1>;

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
  const ledgerRoot = opts.ledgerRoot ?? CANONICAL_STATE;
  const pathFor = opts.chapterPathFor ?? chapterPath;
  // Architecture lane: pass NO bannedDevices (its bans are skeleton families, not
  // content devices — Requirement 5); the driver still surfaces the before/after
  // device diff on each outcome for visibility.
  const ctx: DiversifyCtx = {
    io, reviewIo, bar, lane: "sameness", ledgerRoot,
    chapterPathFor: pathFor,
    writeChapter: opts.writeChapter ?? authorWriteOneChapter,
    reviewChapter: opts.reviewChapter ?? reviewOneChapter,
  };

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
      try { lineage = computeRegenLineage(bookId, n, ledgerRoot); } catch { lineage = null; }
      if (lineage) {
        resetSamenessRepairConsumed(bookId, n, lineage, ledgerRoot);
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
    const p = pathFor(bookId, n);
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
    outcomes.push(await diversifyOne(bookId, { chapterNumber: target.chapterNumber, directive: target.directive, label: target.assignedFamily }, deps, ctx));
  }

  // Verify preserved chapters are byte-identical.
  const preservedViolations: number[] = [];
  for (const [n, before] of preservedBefore) {
    const p = pathFor(bookId, n);
    const after = existsSync(p) ? readFileSync(p, "utf8") : "";
    if (after !== before) preservedViolations.push(n);
  }
  if (preservedViolations.length > 0) {
    deps.log(`[sameness] ${bookId}: PRESERVED-CHAPTER VIOLATION — bytes changed on ${preservedViolations.map((n) => `ch${n}`).join(", ")} (bug).`);
  }

  return { fired: true, targets: plan.targets.map((t) => t.chapterNumber), preserved: plan.preserved, outcomes, preservedViolations };
}

/** A generic diversification target: the chapter, the writer directive to inject, a
 *  short label for logs/outcomes (an architecture family or "content-deal"), and the
 *  content devices this chapter must SHED. `bannedDevices` is verified on the fresh
 *  bytes after re-author (Prompt 2); the architecture lane passes none. */
type DiversifyTarget = {
  chapterNumber: number;
  directive: string;
  label: string;
  bannedDevices?: ContentDeviceId[];
};

/** Which bounded ledger lane a diversification round consumes — architecture and
 *  content-deal repair are SEPARATE lanes (a chapter can spend one of each). */
type RepairLane = "sameness" | "content";

/** Resolved per-round context handed to diversifyOne (real IO in production, injected
 *  writer/reviewer/paths/ledger in tests). */
export type DiversifyCtx = {
  io: AuthorIo;
  reviewIo: ReturnType<typeof resolveAuthorReviewIo>;
  bar: number;
  lane: RepairLane;
  ledgerRoot: string;
  chapterPathFor: (bookId: string, chapterNumber: number) => string;
  writeChapter: WriteChapterFn;
  reviewChapter: ReviewChapterFn;
};

export async function diversifyOne(
  bookId: string,
  target: DiversifyTarget,
  deps: AutopilotDeps,
  ctx: DiversifyCtx,
): Promise<SamenessChapterOutcome> {
  const { io, reviewIo, bar, lane, ledgerRoot, chapterPathFor, writeChapter, reviewChapter } = ctx;
  const n = target.chapterNumber;
  const nn = String(n).padStart(2, "0");
  const base = { chapterNumber: n, assignedFamily: target.label };
  const path = chapterPathFor(bookId, n);
  const priorBytes = existsSync(path) ? readFileSync(path, "utf8") : null;
  const bannedDevices = target.bannedDevices ?? [];
  // Devices the chapter used BEFORE the re-author — the baseline for the before/after
  // diff (surfaced on every outcome for visibility) and the substitution telemetry.
  const priorChapter = io.loadChapters(bookId).find((c) => c.number === n) ?? null;
  const devicesBefore = priorChapter ? detectChapterDevices(priorChapter) : new Set<ContentDeviceId>();
  const beforeField = [...devicesBefore];
  // Put the prior passing bytes back AND roll author provenance back to them: the
  // re-author stamped the DISCARDED draft's session/hash, so a bare byte-restore
  // would leave provenance attributing content A to the throwaway draft's author.
  const revertPriorBytes = (): void => {
    if (priorBytes === null) return;
    writeFileSync(path, priorBytes);
    if (priorChapter) {
      try { restoreAuthorProvenance(authorChapterId(bookId, n), chapterContentHash(priorChapter), deps.log); }
      catch { /* provenance rollback is best-effort; never fail a revert on it */ }
    }
  };
  const consumedFor = lane === "content" ? contentRepairConsumedFor : samenessRepairConsumedFor;
  const recordConsumed = lane === "content" ? recordContentRepairConsumed : recordSamenessRepairConsumed;
  const laneLabel = lane === "content" ? "content-deal-repair" : "book-sameness-repair";

  // Bounded: one repair grant per lineage in this lane. A lineage we cannot compute
  // (pre-brief fixture) runs uncounted rather than converting a safety net into a halt.
  let lineage: string | null = null;
  try { lineage = computeRegenLineage(bookId, n, ledgerRoot); } catch { lineage = null; }
  if (lineage) {
    let consumed = 1;
    try { consumed = consumedFor(loadAuthorRegenLedger(bookId, ledgerRoot), n, lineage); } catch { consumed = 1; }
    if (consumed >= 1) {
      deps.log(`[sameness] ch${nn}: already consumed its ${laneLabel} grant for this lineage — skipping (bounded).`);
      return { ...base, status: "skipped-cap", devicesBefore: beforeField, detail: `${laneLabel} cap (1/lineage) already consumed` };
    }
    recordConsumed(bookId, n, lineage, ledgerRoot); // counts before the spawn — a
    // devices-persisted revert does NOT refund it (Requirement 3: bounded preserved).
  }

  // Re-author with the diversification directive injected as a writer complaint.
  const r = await writeChapter(bookId, n, deps, { complaints: [target.directive], io });
  if (!r.ok) {
    revertPriorBytes();
    deps.log(`[sameness] ch${nn}: re-author FAILED (${r.reason.slice(0, 160)}) — restored prior passing bytes.`);
    return { ...base, status: "write-failed", devicesBefore: beforeField, detail: `re-author failed; restored prior bytes: ${r.reason.slice(0, 200)}` };
  }

  // Self-check: does the diversified chapter still PASS review at the bar? Use a
  // non-persisting read (the conductor runs the authoritative persisted review
  // afterward). A FAIL/invalid → roll back to the prior passing bytes.
  const fresh = io.loadChapters(bookId).find((c) => c.number === n);
  if (!fresh) {
    revertPriorBytes();
    return { ...base, status: "write-failed", devicesBefore: beforeField, detail: "re-authored chapter did not load; restored prior bytes" };
  }
  // Device diff on the fresh bytes — surfaced on EVERY fresh-loaded outcome for
  // visibility (Requirement 5); gates the banned-device revert (Requirement 2) and
  // reports substitution honestly (Requirement 4).
  const devicesAfter = detectChapterDevices(fresh);
  const diff = diffChapterDeviceUse(devicesBefore, devicesAfter, bannedDevices);
  const deviceFields = {
    devicesBefore: beforeField,
    devicesAfter: [...devicesAfter],
    persistedDevices: diff.persisted,
    substitutedDevices: diff.substituted,
  };

  const review = await reviewChapter(bookId, fresh, deps, reviewIo, bar, "-sameness-check", /* persist */ false);
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
    revertPriorBytes();
    deps.log(`[sameness] ch${nn}: diversified draft did not clear the near-bar band (composite ${review.composite}, ship=${review.ship84}, keys ${review.keyCheck.matches}/${review.keyCheck.of}, valid=${review.valid}) — restored prior passing bytes.`);
    return { ...base, status: "reverted", newComposite: review.composite, ...deviceFields, detail: `diversified draft below bar-band / invalid / key-defect / true-blocker; restored prior passing version` };
  }

  // VERIFY the ban (Requirement 2): quality cleared, but a banned device STILL present
  // means the re-author did not comply. Revert to the prior passing bytes and report a
  // DISTINCT, loud status — never a fake "diversified" success. The grant stays spent.
  if (diff.persisted.length > 0) {
    revertPriorBytes();
    const evidence = detectChapterDeviceMatches(fresh)
      .filter((m) => diff.persisted.includes(m.id))
      .map((m) => `${m.id}: "${m.snippet}"`)
      .join(" | ");
    deps.log(`[sameness] ch${nn}: repaired draft cleared review (composite ${review.composite}) but STILL uses banned device(s) ${diff.persisted.join(", ")} — reverted (devices-persisted). Evidence: ${evidence}`);
    return { ...base, status: "devices-persisted", newComposite: review.composite, ...deviceFields, detail: `banned device(s) persisted after re-author: ${diff.persisted.join(", ")}; restored prior passing version` };
  }

  const near = review.pass ? "" : " (near-bar; conductor tiebreak will formalize)";
  const subNote = diff.substituted.length > 0 ? ` [substituted (non-banned): ${diff.substituted.join(", ")}]` : "";
  deps.log(`[sameness] ch${nn}: diversified to "${target.label}" — composite ${review.composite}, ship=${review.ship84}, keys ${review.keyCheck.matches}/${review.keyCheck.of}${near}${subNote}.`);
  return { ...base, status: "diversified", newComposite: review.composite, ...deviceFields, detail: `diversified to ${target.label}; composite ${review.composite}${near}${subNote}` };
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
  const ledgerRoot = opts.ledgerRoot ?? CANONICAL_STATE;
  const pathFor = opts.chapterPathFor ?? chapterPath;
  const ctx: DiversifyCtx = {
    io, reviewIo, bar, lane: "content", ledgerRoot,
    chapterPathFor: pathFor,
    writeChapter: opts.writeChapter ?? authorWriteOneChapter,
    reviewChapter: opts.reviewChapter ?? reviewOneChapter,
  };

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
      try { lineage = computeRegenLineage(bookId, n, ledgerRoot); } catch { lineage = null; }
      if (lineage) {
        resetContentRepairConsumed(bookId, n, lineage, ledgerRoot);
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
    const p = pathFor(bookId, n);
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
    // Thread the planner's per-target bannedDevices so the driver can VERIFY removal
    // (Requirement 1/2) — this was previously dropped at the call site.
    outcomes.push(await diversifyOne(bookId, { chapterNumber: target.chapterNumber, directive: target.directive, label: "content-deal", bannedDevices: target.bannedDevices }, deps, ctx));
  }

  const preservedViolations: number[] = [];
  for (const [n, prevBytes] of preservedBefore) {
    const p = pathFor(bookId, n);
    const after = existsSync(p) ? readFileSync(p, "utf8") : "";
    if (after !== prevBytes) preservedViolations.push(n);
  }
  if (preservedViolations.length > 0) {
    deps.log(`[content-deal] ${bookId}: PRESERVED-CHAPTER VIOLATION — bytes changed on ${preservedViolations.map((n) => `ch${n}`).join(", ")} (bug).`);
  }

  // Repair summary (Requirement 7): clearly separate the outcome classes so a
  // devices-persisted compliance-failure is never buried under "diversified".
  const tally = (s: SamenessChapterOutcome["status"]) => outcomes.filter((o) => o.status === s).length;
  deps.log(
    `[content-deal] ${bookId}: repair summary — kept-and-clean ${tally("diversified")}, ` +
    `devices-persisted ${tally("devices-persisted")}, reverted-quality ${tally("reverted")}, ` +
    `write-failed ${tally("write-failed")}, skipped-cap ${tally("skipped-cap")}.`,
  );
  const persisted = outcomes.filter((o) => o.status === "devices-persisted");
  if (persisted.length > 0) {
    deps.log(
      `[content-deal] ${bookId}: DEVICES PERSISTED on ${persisted.map((o) => `ch${String(o.chapterNumber).padStart(2, "0")}[${(o.persistedDevices ?? []).join("+")}]`).join(", ")} ` +
      `— the writer did not shed the banned device(s); grants spent, prior bytes restored.`,
    );
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
