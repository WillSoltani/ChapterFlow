/**
 * Model bake-off — candidate generation + deterministic validation.
 *
 * Each candidate model authors the COMPLETE book through the EXISTING
 * whole-chapter writer (`authorWriteOneChapter`) — same card, same retry
 * budget, same gates — with exactly three orchestration differences:
 *
 *   1. the model/effort pin (per-candidate, via the existing opts seam);
 *   2. the output path (an opaque work/<slot>/chapters/ tree — the slot token
 *      is w1/w2/w3, never derived from the model name, so no author prompt
 *      ever names a model);
 *   3. slot-local side state (provenance, F-1 lead overrides) so candidates
 *      can never contaminate each other or the canonical trees.
 *
 * Validation REUSES the existing deterministic libraries (ship gate, book
 * gate, reader budgets, rubric metrics) — never re-implements them. Candidate
 * validation opens no QC round; formal QC belongs only to the promoted winner.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";

import type { AutopilotDeps } from "../orchestrator/autopilot.js";
import type { ChapterV21 } from "../types.js";
import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { chapterFileName } from "../lib/chapterPaths.js";
import { DEFAULT_LENGTH_BUDGET_CHARS, LENGTH_BUDGET_TOLERANCE } from "../compiler/chapterBrief.js";
import { checkReaderBudgets } from "../critics/readerBudgets.js";
import { runBookGate } from "../critics/bookGate.js";
import { runShipGate } from "../critics/finalGate.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import {
  authorChapterId,
  authorWriteOneChapter,
  resolveAuthorIo,
  type AuthorIo,
} from "../orchestrator/authorRun.js";
import type { AuthorProvenance } from "../qc/sessionProvenance.js";
import type {
  CandidateChapterAttemptV1,
  CandidateChapterResultV1,
  CandidateSpec,
  CandidateStateV1,
  CandidateValidationV1,
} from "./types.js";
import { pipelineRel, slotChaptersDir, slotDir, type BakeoffRoots } from "./paths.js";

// ── Slot-local chapter IO ─────────────────────────────────────────────────────

export function slotChapterAbsPath(roots: BakeoffRoots, slot: string, bookId: string, chapterNumber: number): string {
  return resolve(slotChaptersDir(roots, slot), chapterFileName(authorChapterId(bookId, chapterNumber)));
}

export function slotChapterRelPath(roots: BakeoffRoots, slot: string, bookId: string, chapterNumber: number): string {
  return pipelineRel(slotChapterAbsPath(roots, slot, bookId, chapterNumber));
}

export function loadSlotChapters(roots: BakeoffRoots, slot: string): ChapterV21[] {
  const dir = slotChaptersDir(roots, slot);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".chapter.json"))
    .sort()
    .map((f) => {
      try {
        return JSON.parse(readFileSync(resolve(dir, f), "utf8")) as ChapterV21;
      } catch (err) {
        throw new Error(`failed to parse candidate chapter ${resolve(dir, f)}: ${(err as Error).message}`);
      }
    })
    .sort((a, b) => a.number - b.number);
}

/** Slot-isolated AuthorIo: chapter files, provenance, and F-1 lead overrides all
 *  live under work/<slot>/. Shared READ inputs (briefs, packets, voice, name
 *  bank) keep their canonical defaults — they are the frozen shared inputs. */
export function candidateAuthorIo(roots: BakeoffRoots, slot: string): Partial<AuthorIo> {
  const provenanceDir = resolve(slotDir(roots, slot), "provenance");
  const leadDir = resolve(slotDir(roots, slot), "lead-overrides");
  const chapterAbs = (bookId: string, n: number): string => slotChapterAbsPath(roots, slot, bookId, n);
  const provenanceAbs = (chapterId: string): string => resolve(provenanceDir, `${chapterId}.json`);
  const readProvenance = (chapterId: string): AuthorProvenance | null => {
    const p = provenanceAbs(chapterId);
    if (!existsSync(p)) return null;
    try {
      const rec = JSON.parse(readFileSync(p, "utf8")) as Partial<AuthorProvenance>;
      return rec.schemaVersion === "author-provenance-v2"
        && rec.chapterId === chapterId
        && typeof rec.authorSessionId === "string"
        && rec.authorSessionId.length > 0
        && typeof rec.stampedAt === "string"
        && rec.stampedAt.length > 0
        && typeof rec.contentHash === "string"
        && rec.contentHash.length > 0
        ? rec as AuthorProvenance
        : null;
    } catch {
      return null;
    }
  };
  return {
    chapterExists: (bookId, n) => existsSync(chapterAbs(bookId, n)),
    readChapterFile: (bookId, n) => {
      const p = chapterAbs(bookId, n);
      try { return existsSync(p) ? readFileSync(p, "utf8") : null; } catch { return null; }
    },
    writeChapterFile: (bookId, n, bytes) => {
      const p = chapterAbs(bookId, n);
      mkdirSync(dirname(p), { recursive: true });
      writeFileAtomic(p, bytes);
    },
    removeChapterFile: (bookId, n) => rmSync(chapterAbs(bookId, n), { force: true }),
    loadChapters: () => loadSlotChapters(roots, slot),
    authorSessionOf: (chapterId) => readProvenance(chapterId)?.authorSessionId,
    recordProvenance: (chapterId, sessionId, contentHash) => {
      if (!contentHash) throw new Error(`candidate ${slot}: cannot stamp author provenance for ${chapterId} without a content hash`);
      mkdirSync(provenanceDir, { recursive: true });
      const record: AuthorProvenance = {
        schemaVersion: "author-provenance-v2",
        chapterId,
        authorSessionId: sessionId,
        contentHash,
        stampedAt: new Date().toISOString(),
        producer: "whole-chapter-writer",
      };
      writeFileAtomic(
        provenanceAbs(chapterId),
        JSON.stringify(record, null, 2) + "\n",
      );
    },
    readProvenance,
    restoreProvenance: (chapterId, previous) => {
      const p = provenanceAbs(chapterId);
      if (previous === null) rmSync(p, { force: true });
      else {
        mkdirSync(provenanceDir, { recursive: true });
        writeFileAtomic(p, JSON.stringify(previous, null, 2) + "\n");
      }
    },
    readLeadOverride: (bookId, n) => {
      const p = resolve(leadDir, `ch${String(n).padStart(2, "0")}.lead-override.json`);
      try {
        if (!existsSync(p)) return null;
        const rec = JSON.parse(readFileSync(p, "utf8"));
        return rec?.schemaVersion === "lead-thread-override-v1" ? rec : null;
      } catch { return null; }
    },
    writeLeadOverride: (bookId, n, override) => {
      mkdirSync(leadDir, { recursive: true });
      writeFileAtomic(resolve(leadDir, `ch${String(n).padStart(2, "0")}.lead-override.json`), JSON.stringify(override, null, 2) + "\n");
    },
    // IMP-01: attempt workspaces/evidence stay slot-local too — a bakeoff run
    // never writes the production .attempts tree.
    attemptsRoot: () => resolve(slotDir(roots, slot), "attempts"),
  };
}

// ── Candidate deps wrapper ────────────────────────────────────────────────────

export type SpawnObservation = { sessionId: string; durationMs: number; ok: boolean };

/**
 * Wrap the conductor deps for one candidate:
 *  - sessionId labels get a slot prefix (independence + forensics);
 *  - every spawn is observed (attempt telemetry — retries, latency);
 *  - `rubric-metrics <bookId>` verb calls are answered IN-PROCESS from the
 *    candidate's OWN chapters (the CLI verb reads canonical state, which a
 *    candidate must never depend on), byte-compatible with the verb's output
 *    format since both use formatRubricMetrics.
 */
export type RubricVerb = (bookId: string, chapters: ChapterV21[]) => Promise<{ code: number; stdout: string; stderr: string }>;

/** Default rubric interception: the REAL deterministic rubric metrics computed
 *  over the candidate's own chapters, formatted byte-compatibly with the verb. */
export const realRubricVerb: RubricVerb = async (bookId, chapters) => {
  try {
    const { computeBookRubricMetrics, formatRubricMetrics } = await import("../metrics/bookRubricMetrics.js");
    const report = computeBookRubricMetrics(bookId, { chapters });
    return { code: 0, stdout: formatRubricMetrics(report), stderr: "" };
  } catch (err) {
    return { code: 1, stdout: "", stderr: `bakeoff rubric-metrics: ${(err as Error).message}` };
  }
};

export function candidateDeps(
  deps: AutopilotDeps,
  roots: BakeoffRoots,
  spec: CandidateSpec,
  observe: (o: SpawnObservation) => void,
  rubricVerb: RubricVerb = realRubricVerb,
): AutopilotDeps {
  return {
    ...deps,
    mkSessionId: (label) => deps.mkSessionId(`bakeoff-${spec.slot}-${label}`),
    spawn: async (opts) => {
      const r = await deps.spawn(opts);
      observe({ sessionId: r.sessionId, durationMs: r.durationMs, ok: r.ok });
      return r;
    },
    runVerb: async (args, env) => {
      if (args[0] === "rubric-metrics") {
        return rubricVerb(args[1] ?? "", loadSlotChapters(roots, spec.slot));
      }
      return deps.runVerb(args, env);
    },
  };
}

// ── Generation ────────────────────────────────────────────────────────────────

export type GenerateCandidateOptions = {
  chapterNumbers: number[];
  /** Bounded pool of concurrent chapter writers WITHIN this candidate. */
  chapterParallel: number;
  /** Regenerate even verified-complete chapters. */
  force?: boolean;
  /** Prior state (resume) — verified chapters are reused, never regenerated. */
  prior?: CandidateStateV1 | null;
  heartbeat?: () => boolean;
  log: (m: string) => void;
  /** Extra AuthorIo overrides merged OVER the slot io (tests inject fixture
   *  briefs/packets; live runs never set this). */
  ioOverrides?: Partial<AuthorIo>;
  /** Rubric-verb override (tests). Default: real rubric metrics. */
  rubricVerb?: RubricVerb;
};

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** True iff a prior chapter result can be REUSED: it succeeded, the file exists,
 *  and the bytes still hash to what the record says (verified completed artifact). */
export function chapterReusable(
  roots: BakeoffRoots,
  spec: CandidateSpec,
  bookId: string,
  prior: CandidateChapterResultV1 | undefined,
): boolean {
  if (!prior?.ok || !prior.contentSha256) return false;
  const abs = slotChapterAbsPath(roots, spec.slot, bookId, prior.chapterNumber);
  if (!existsSync(abs)) return false;
  try {
    const ch = JSON.parse(readFileSync(abs, "utf8")) as ChapterV21;
    return chapterContentHash(ch) === prior.contentSha256;
  } catch {
    return false;
  }
}

/** Generate (or resume) ONE candidate's complete book. Never touches canonical
 *  state; never opens QC. Persist-per-chapter via `persist` so an interrupt
 *  resumes at the first unverified chapter. */
export async function generateCandidate(
  bookId: string,
  spec: CandidateSpec,
  deps: AutopilotDeps,
  roots: BakeoffRoots,
  opts: GenerateCandidateOptions,
  persist: (state: CandidateStateV1) => void,
): Promise<CandidateStateV1> {
  // IMP-01: the rubric interception moves from the runVerb layer to the io
  // candidate-validation seam — the candidate is substituted into THIS SLOT's
  // committed chapters (never the canonical corpus). Gate stays the REAL
  // composite by default (sibling context = the slot dir via outputRelPath).
  const rubricVerb = opts.rubricVerb ?? realRubricVerb;
  const io = {
    ...candidateAuthorIo(roots, spec.slot),
    rubricWithCandidate: async (b: string, n: number, candidate: ChapterV21) =>
      rubricVerb(b, [...loadSlotChapters(roots, spec.slot).filter((c) => c.number !== n), candidate]),
    ...(opts.ioOverrides ?? {}),
  };
  const byNumber = new Map<number, CandidateChapterResultV1>();
  for (const c of opts.prior?.chapters ?? []) byNumber.set(c.chapterNumber, c);

  const state: CandidateStateV1 = {
    schemaVersion: "model-bakeoff-candidate-v1",
    spec,
    status: "generating",
    chapters: [],
    totalDurationMs: 0,
    totalRetries: 0,
    firstAttemptPasses: 0,
    startedAt: opts.prior?.startedAt ?? new Date().toISOString(),
  };

  const snapshot = (): void => {
    state.chapters = opts.chapterNumbers.map((n) => byNumber.get(n)).filter((c): c is CandidateChapterResultV1 => Boolean(c));
    state.totalDurationMs = state.chapters.reduce((s, c) => s + c.totalDurationMs, 0);
    state.totalRetries = state.chapters.reduce((s, c) => s + Math.max(0, c.attempts.length - 1), 0);
    state.firstAttemptPasses = state.chapters.filter((c) => c.firstAttemptPass).length;
    persist(state);
  };

  const todo = opts.chapterNumbers.filter((n) => {
    if (opts.force) return true;
    if (chapterReusable(roots, spec, bookId, byNumber.get(n))) {
      opts.log(`[bakeoff] ${spec.model} ch${String(n).padStart(2, "0")}: reusing verified chapter (resume)`);
      return false;
    }
    byNumber.delete(n);
    return true;
  });
  snapshot();

  await mapPool(todo, opts.chapterParallel, async (n) => {
    if (opts.heartbeat && !opts.heartbeat()) {
      byNumber.set(n, {
        chapterNumber: n, ok: false, firstAttemptPass: false, attempts: [], totalDurationMs: 0,
        contentSha256: null, reason: "run lock lost before this chapter started",
      });
      snapshot();
      return;
    }
    const attempts: CandidateChapterAttemptV1[] = [];
    const observed: SpawnObservation[] = [];
    const cdeps = candidateDeps(deps, roots, spec, (o) => observed.push(o), opts.rubricVerb);
    const r = await authorWriteOneChapter(bookId, n, cdeps, {
      io,
      totalChapters: opts.chapterNumbers.length,
      outputRelPath: slotChapterRelPath(roots, spec.slot, bookId, n),
      model: spec.model,
      effort: spec.effort,
    });
    observed.forEach((o, i) => attempts.push({
      attempt: i + 1,
      sessionId: o.sessionId,
      ok: r.ok && i === observed.length - 1,
      durationMs: o.durationMs,
      failure: r.ok || i < observed.length - 1 ? (i < observed.length - 1 ? "retried" : "") : r.reason,
    }));
    let contentSha256: string | null = null;
    if (r.ok) {
      try {
        const abs = slotChapterAbsPath(roots, spec.slot, bookId, n);
        contentSha256 = chapterContentHash(JSON.parse(readFileSync(abs, "utf8")) as ChapterV21);
      } catch { contentSha256 = null; }
    }
    byNumber.set(n, {
      chapterNumber: n,
      ok: r.ok,
      firstAttemptPass: r.ok && observed.length === 1,
      attempts,
      totalDurationMs: observed.reduce((s, o) => s + o.durationMs, 0),
      contentSha256,
      reason: r.ok ? undefined : r.reason,
    });
    snapshot();
  });

  const complete = opts.chapterNumbers.every((n) => byNumber.get(n)?.ok);
  state.status = complete ? "complete" : "failed";
  state.completedAt = new Date().toISOString();
  snapshot();
  return state;
}

// ── Deterministic validation (existing libraries only) ───────────────────────

export type ValidateCandidateInputs = {
  chapterNumbers: number[];
  /** Immutable V4 snapshot content reopened through BookContentReader. */
  chapters: readonly ChapterV21[];
  readPacket: (bookId: string, n: number) => SourcePacketV1 | null;
  readBrief: (bookId: string, n: number) => { lengthBudget?: { renderedChars: number; tolerance: number } } | null;
};

export function defaultValidateInputs(chapters: readonly ChapterV21[]): ValidateCandidateInputs {
  const io = resolveAuthorIo();
  return {
    chapterNumbers: [],
    chapters,
    readPacket: io.readPacket,
    readBrief: (bookId, n) => io.readBrief(bookId, n),
  };
}

export async function validateCandidate(
  bookId: string,
  spec: CandidateSpec,
  roots: BakeoffRoots,
  inputs: ValidateCandidateInputs,
): Promise<CandidateValidationV1> {
  const chapters = [...inputs.chapters];
  const have = new Set(chapters.map((c) => c.number));
  const hardFailures: string[] = [];
  const advisories: string[] = [];

  const missing = inputs.chapterNumbers.filter((n) => !have.has(n));
  const complete = missing.length === 0 && chapters.length === inputs.chapterNumbers.length;
  if (!complete) hardFailures.push(`incomplete book: missing ch ${missing.join(", ") || "(chapter count mismatch)"}`);

  // Per-chapter ship gate (same engine gate-chapter runs).
  let shipGateBlockers = 0;
  for (const ch of chapters) {
    try {
      const rep = runShipGate(ch);
      shipGateBlockers += rep.blockers.length;
      for (const b of rep.blockers.slice(0, 5)) hardFailures.push(`ch${String(ch.number).padStart(2, "0")} ship-gate: [${b.catalogId}] ${b.message.slice(0, 160)}`);
    } catch (err) {
      shipGateBlockers += 1;
      hardFailures.push(`ch${String(ch.number).padStart(2, "0")} ship-gate CRASHED (malformed chapter): ${(err as Error).message.slice(0, 160)}`);
    }
  }

  // Book gate (cross-chapter: AS*, BP*, position balance, …). BP7's per-chapter
  // plan artifacts are RECONSTRUCTION stubs that derive-artifacts builds FROM the
  // written canonical chapters after authoring — pre-promotion candidates have no
  // canonical chapters and share chapterIds, so requiring them here would fail
  // every candidate on a missing environment artifact (and per-candidate stubs
  // would collide in state/plans). The winner still faces the FULL audit (BP7
  // included) at the post-promotion deterministic preflight, exactly like every
  // normally-authored book. All content checks below run unchanged.
  let bookGatePassed = false;
  try {
    const rep = runBookGate(bookId, chapters, { requirePlanArtifacts: false });
    bookGatePassed = rep.passed;
    if (!rep.passed) {
      for (const f of rep.findings.filter((x) => x.severity === "blocker").slice(0, 10)) {
        hardFailures.push(`book-gate: [${f.catalogId}] ${f.message.slice(0, 160)}`);
      }
    }
  } catch (err) {
    hardFailures.push(`book-gate crashed: ${(err as Error).message.slice(0, 160)}`);
  }

  // Reader budgets (blockers gate, advisories recorded).
  let readerBudgetBlockers = 0;
  try {
    const packets = new Map<number, SourcePacketV1>();
    for (const n of inputs.chapterNumbers) {
      const p = inputs.readPacket(bookId, n);
      if (p) packets.set(n, p);
    }
    const firstBrief = inputs.chapterNumbers.map((n) => inputs.readBrief(bookId, n)).find((b) => b?.lengthBudget?.renderedChars);
    const lengthBudget = firstBrief?.lengthBudget ?? { renderedChars: DEFAULT_LENGTH_BUDGET_CHARS, tolerance: LENGTH_BUDGET_TOLERANCE };
    for (const f of checkReaderBudgets(chapters, { packets, lengthBudget })) {
      if (f.severity === "blocker") {
        readerBudgetBlockers += 1;
        hardFailures.push(`reader-budget: [${f.checkId}] ch${f.chapterNumber}: ${f.message.slice(0, 160)}`);
      } else {
        advisories.push(`reader-budget: [${f.checkId}] ch${f.chapterNumber}: ${f.message.slice(0, 160)}`);
      }
    }
  } catch (err) {
    hardFailures.push(`reader-budgets crashed: ${(err as Error).message.slice(0, 160)}`);
  }

  // Deterministic rubric metrics (ease band / tell / transfer / practice floor).
  let rubricVerdict: CandidateValidationV1["rubricVerdict"] = "fail";
  try {
    const { computeBookRubricMetrics } = await import("../metrics/bookRubricMetrics.js");
    const rep = computeBookRubricMetrics(bookId, { chapters });
    rubricVerdict = rep.verdict;
    if (rubricVerdict === "fail") {
      for (const c of rep.chapters.filter((x) => x.verdict === "fail").slice(0, 6)) {
        hardFailures.push(`rubric-metrics: ch${String(c.chapterNumber).padStart(2, "0")} FAIL`);
      }
    }
  } catch (err) {
    hardFailures.push(`rubric-metrics crashed: ${(err as Error).message.slice(0, 160)}`);
  }

  return {
    schemaVersion: "model-bakeoff-candidate-validation-v1",
    model: spec.model,
    validatedAt: new Date().toISOString(),
    complete,
    hardFailures,
    advisories,
    bookGatePassed,
    rubricVerdict,
    readerBudgetBlockers,
    shipGateBlockers,
  };
}
