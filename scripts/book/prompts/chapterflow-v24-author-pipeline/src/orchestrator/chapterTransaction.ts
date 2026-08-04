/**
 * chapterTransaction — conductor-owned candidate → compare-and-swap canonical
 * commit for whole-chapter content work (IMP-01; F-001 P0, F-020 P0; master
 * plan §8.8; consumes the frozen `candidate-transaction` v1 contract).
 *
 * The pre-IMP-01 flow asked author/repair agents to write the CANONICAL
 * chapter path directly (workspace-write at the pipeline root), then validated
 * whatever landed and byte-restored on failure. That exposed three windows the
 * `range` campaign hit live: concurrent readers parsing a half-saved file
 * (conductor crash + six orphaned writers), failed drafts standing in for
 * reviewed bytes until restore, and restore itself failing (F6).
 *
 * New protocol (the plan's qualified isolated-writable fallback):
 *
 *   1. mint an immutable ATTEMPT: identity + expected canonical base hash +
 *      an attempt-scoped workspace (the agent's cwd — the ONLY writable dir);
 *   2. the agent writes exactly ONE file there: the candidate chapter JSON
 *      (repair attempts get the workspace pre-seeded with the original bytes);
 *   3. the conductor imports the candidate (size cap, JSON parse, identity),
 *      rejects unexpected workspace writes, and validates ENTIRELY in memory /
 *      against candidate bytes — gate composite with COMMITTED siblings as
 *      context, rubric metrics with the candidate substituted into the book,
 *      write-contract checks — never exposing the candidate as canonical;
 *   4. commit is compare-and-swap: the canonical bytes must still hash to the
 *      attempt's expected base (both-absent counts as a match), then the
 *      replacement is one atomic rename. A mismatch is `stale_base` — never a
 *      rebase, never a last-writer-wins overwrite, never an auto-retry;
 *   5. a pending commit manifest brackets the swap so a crash between rename
 *      and bookkeeping recovers deterministically (finish or mark aborted);
 *   6. failed / malformed / stale attempts leave canonical bytes untouched —
 *      the old restore lane is structurally unnecessary (nothing to restore).
 *
 * Canonical reads/writes go through the caller-supplied IO seam (the same
 * `AuthorIo` functions tests already inject), so fixture-rooted tests and the
 * bakeoff's slot-rooted candidates keep working unchanged.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";

import type { ChapterV21 } from "../types.js";
import { REPO_ROOT, chapterFileName } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import type { AttemptIdentityV1, AttemptKindV1, CandidateOutcomeV1, CommitManifestV1 } from "../contracts/candidateTransaction.js";
import { runChapterGateComposite, type ChapterGateCompositeOptions } from "../critics/chapterGateComposite.js";
import type { RubricThresholds } from "../metrics/rubricThresholds.js";
import { recordAttemptMint, recordAttemptState, recordAttemptObject, recordAttemptFinal, resolveEvidenceRoot } from "../evidence/attemptRecorder.js";
import type { CandidateInputFile, CandidateSelector, CandidateSnapshot } from "../books/candidateTypes.js";
import type { PlannedArtifact } from "../contracts/v4Core.js";
import type { LegacyAuthorStateAdapter, LegacyAuthorShadowStep } from "../contracts/legacyAuthorStateAdapter.js";
import type { RunDefinition } from "../run-state/runTypes.js";

/** Attempt evidence root — pipeline-local, gitignored, EXCLUDED from chapter
 *  enumeration by construction (nothing under state/). */
export const ATTEMPTS_ROOT = resolve(REPO_ROOT, ".attempts");

/** Candidate byte ceiling. Real ChapterV21 files run ~40–90 KB; 2 MB flags a
 *  runaway/duplicated output as `truncated_output`-class garbage, not content. */
export const CANDIDATE_MAX_BYTES = 2 * 1024 * 1024;

export type AuthorV4OperationKind =
  | "ORCHESTRATE"
  | "REVIEW"
  | "REPAIR"
  | "POLISH"
  | "GENERATE"
  | "SECTION_VALIDATE"
  | "ASSEMBLE";

/** App-owned identity and ports for one disposable legacy-first shadow step. */
export interface AuthorV4ShadowContext {
  readonly adapter: LegacyAuthorStateAdapter;
  readonly definition: RunDefinition;
  readonly bookId: string;
  readonly runId: string;
  readonly stageId: string;
  readonly attemptId: string;
  readonly operationId: string;
  readonly operationKind: AuthorV4OperationKind;
  readonly candidateId: string;
  readonly selector: CandidateSelector;
  readonly admittedAt: string;
  readonly staleAt: string;
  readonly completedAt: string;
  readonly observedAt: string;
  readonly expectedInventory: readonly PlannedArtifact[];
  readonly parentCandidateId?: string;
}

export interface AuthorV4ShadowBinding<TLegacy> {
  readonly context: AuthorV4ShadowContext;
  readonly files: (legacy: TLegacy) => readonly CandidateInputFile[];
  readonly normalizeLegacy: (legacy: TLegacy) => unknown;
  readonly normalizeCandidate: (candidate: CandidateSnapshot) => unknown;
  readonly report?: (report: AuthorV4ShadowReport) => void;
}

export interface AuthorV4ShadowReport {
  readonly authority: "LEGACY";
  readonly operationId: string;
  readonly operationKind: AuthorV4OperationKind;
  readonly ok: boolean;
  readonly reused: boolean;
  readonly steps: readonly LegacyAuthorShadowStep[];
  readonly candidate?: CandidateSnapshot;
  readonly mismatch?: Readonly<{
    operationId: string;
    operationKind: AuthorV4OperationKind;
    fields: readonly string[];
    legacy: unknown;
    shadow: unknown;
  }>;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mismatchFields(left: unknown, right: unknown): string[] {
  if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(left) && !Array.isArray(right)) {
    const l = left as Record<string, unknown>;
    const r = right as Record<string, unknown>;
    return [...new Set([...Object.keys(l), ...Object.keys(r)])].filter((key) => !sameJson(l[key], r[key])).sort();
  }
  return ["$"];
}

function invalidShadowContext(context: AuthorV4ShadowContext): string | null {
  if (context.definition.bookId !== context.bookId || context.definition.runId !== context.runId) {
    return "definition identity does not match explicit book/run context";
  }
  if (!context.definition.requiredStages.includes(context.stageId)) return "stageId is not declared by run definition";
  if (!sameJson(context.definition.requiredInventory, context.expectedInventory)) return "inventory differs from frozen run definition";
  if (context.selector.kind !== "CANDIDATE" || context.selector.candidateId !== context.candidateId) {
    return "shadow selector must explicitly name candidateId; CURRENT/ambient fallback is forbidden";
  }
  // Operation kind is an explicit app field. Opaque operationId is never parsed.
  if (context.operationKind === "REPAIR" && (!context.parentCandidateId || context.parentCandidateId === context.candidateId)) {
    return "repair shadow must target a successor candidate with an immutable predecessor";
  }
  if (context.operationKind !== "REPAIR" && context.parentCandidateId) {
    return "parentCandidateId is reserved for explicit REPAIR operations";
  }
  return null;
}

/** Project completed legacy result into disposable V4 state. Never executes model/process work. */
export async function projectAuthorV4Shadow<TLegacy>(
  legacy: TLegacy,
  binding: AuthorV4ShadowBinding<TLegacy>,
): Promise<AuthorV4ShadowReport> {
  const { context } = binding;
  const steps: LegacyAuthorShadowStep[] = [];
  const base = { authority: "LEGACY" as const, operationId: context.operationId, operationKind: context.operationKind };
  const fail = (name: string, code: string, message: string): AuthorV4ShadowReport => ({
    ...base,
    ok: false,
    reused: false,
    steps: [...steps, { name, ok: false, code, message }],
  });
  const invalid = invalidShadowContext(context);
  if (invalid) return fail("context.validate", "INVALID_CONTEXT", invalid);
  steps.push({ name: "context.validate", ok: true });

  const created = await context.adapter.createShadowRun(context.definition);
  if (!created.ok) return fail("run.create", created.error.code, created.error.message);
  steps.push({ name: "run.create", ok: true });
  const resume = await context.adapter.planShadowResume(context.definition);
  if (!resume.ok) return fail("stage.resume", resume.error.code, resume.error.message);
  steps.push({ name: "stage.resume", ok: true });
  if (resume.value.cancelled) return fail("stage.resume", "CANCELLED", "shadow run is durably cancelled");

  const observed = await context.adapter.readShadowRun(context.bookId, context.runId, context.observedAt);
  if (!observed.ok) return fail("run.observe", observed.error.code, observed.error.message);
  steps.push({ name: "run.observe", ok: true });
  const prior = observed.value.attempts.find((attempt) => attempt.admission.attemptId === context.attemptId);

  if (resume.value.completedStages.includes(context.stageId)) {
    const opened = await context.adapter.openShadowCandidate({ bookId: context.bookId, selector: context.selector });
    if (!opened.ok) return fail("candidate.open", opened.error.code, opened.error.message);
    steps.push({ name: "stage.reuse", ok: true }, { name: "candidate.open", ok: true });
    const legacyProjection = binding.normalizeLegacy(legacy);
    const shadowProjection = binding.normalizeCandidate(opened.value);
    const mismatch = sameJson(legacyProjection, shadowProjection) ? undefined : {
      operationId: context.operationId,
      operationKind: context.operationKind,
      fields: mismatchFields(legacyProjection, shadowProjection),
      legacy: legacyProjection,
      shadow: shadowProjection,
    };
    return { ...base, ok: !mismatch, reused: true, steps, candidate: opened.value, ...(mismatch ? { mismatch } : {}) };
  }
  if (!resume.value.pendingStages.includes(context.stageId)) {
    return fail("stage.resume", "STAGE_NOT_PENDING", `stage ${context.stageId} is not pending`);
  }
  if (prior) return fail("attempt.reuse", "ATTEMPT_CONSUMED", `attempt ${context.attemptId} is already ${prior.status}; no automatic replay`);

  const admitted = await context.adapter.startShadowAttempt({
    bookId: context.bookId,
    runId: context.runId,
    attemptId: context.attemptId,
    stageId: context.stageId,
    operationId: context.operationId,
    admittedAt: context.admittedAt,
    staleAt: context.staleAt,
  });
  if (!admitted.ok) return fail("attempt.admit", admitted.error.code, admitted.error.message);
  if (admitted.value.status !== "ACTIVE") return fail("attempt.admit", "ATTEMPT_CONSUMED", `attempt is ${admitted.value.status}; no automatic replay`);
  steps.push({ name: "attempt.admit", ok: true });

  const cancellationBoundary = async (name: string): Promise<AuthorV4ShadowReport | null> => {
    const next = await context.adapter.planShadowResume(context.definition);
    if (!next.ok) return fail(name, next.error.code, next.error.message);
    steps.push({ name, ok: true });
    if (!next.value.cancelled) return null;
    await context.adapter.finishShadowAttempt({
      bookId: context.bookId,
      runId: context.runId,
      attemptId: context.attemptId,
      outcome: "CANCELLED",
      finishedAt: context.completedAt,
      detail: `cancel observed at ${name}`,
    });
    return fail(name, "CANCELLED", "shadow run was cancelled before later boundary");
  };

  const beforePrepare = await cancellationBoundary("cancel.before-prepare");
  if (beforePrepare) return beforePrepare;
  let files: readonly CandidateInputFile[];
  try {
    files = binding.files(legacy);
  } catch (error) {
    await context.adapter.finishShadowAttempt({ bookId: context.bookId, runId: context.runId, attemptId: context.attemptId, outcome: "FAILED", finishedAt: context.completedAt, detail: (error as Error).message });
    return fail("candidate.prepare", "CANDIDATE_PREPARE_FAILED", (error as Error).message);
  }
  const beforeStage = await cancellationBoundary("cancel.before-stage");
  if (beforeStage) return beforeStage;
  const staged = await context.adapter.stageCompleteCandidate({
    bookId: context.bookId,
    candidateId: context.candidateId,
    ...(context.parentCandidateId ? { parentCandidateId: context.parentCandidateId } : {}),
    createdByRunId: context.runId,
    expectedInventory: context.expectedInventory,
    files,
    createdAt: context.completedAt,
  });
  if (!staged.ok) {
    await context.adapter.finishShadowAttempt({ bookId: context.bookId, runId: context.runId, attemptId: context.attemptId, outcome: "FAILED", finishedAt: context.completedAt, detail: staged.error.message });
    return fail("candidate.stage", staged.error.code, staged.error.message);
  }
  steps.push({ name: "candidate.stage", ok: true });
  const beforeOpen = await cancellationBoundary("cancel.before-open");
  if (beforeOpen) return beforeOpen;
  const opened = await context.adapter.openShadowCandidate({ bookId: context.bookId, selector: context.selector });
  if (!opened.ok) {
    await context.adapter.finishShadowAttempt({ bookId: context.bookId, runId: context.runId, attemptId: context.attemptId, outcome: "FAILED", finishedAt: context.completedAt, detail: opened.error.message });
    return fail("candidate.open", opened.error.code, opened.error.message);
  }
  steps.push({ name: "candidate.open", ok: true });
  const beforeFinish = await cancellationBoundary("cancel.before-finish");
  if (beforeFinish) return beforeFinish;
  const finished = await context.adapter.finishShadowAttempt({ bookId: context.bookId, runId: context.runId, attemptId: context.attemptId, outcome: "SUCCEEDED", finishedAt: context.completedAt });
  if (!finished.ok) return fail("attempt.finish", finished.error.code, finished.error.message);
  steps.push({ name: "attempt.finish", ok: true });
  const checkpointed = await context.adapter.checkpointShadowStage({
    schemaVersion: "1",
    bookId: context.bookId,
    runId: context.runId,
    stageId: context.stageId,
    status: "COMPLETED",
    attemptIds: [context.attemptId],
    candidate: { candidateId: staged.value.candidateId, manifestDigest: staged.value.manifestDigest },
    completedAt: context.completedAt,
  });
  if (!checkpointed.ok) return fail("stage.checkpoint", checkpointed.error.code, checkpointed.error.message);
  steps.push({ name: "stage.checkpoint", ok: true });

  const legacyProjection = binding.normalizeLegacy(legacy);
  const shadowProjection = binding.normalizeCandidate(opened.value);
  const mismatch = sameJson(legacyProjection, shadowProjection) ? undefined : {
    operationId: context.operationId,
    operationKind: context.operationKind,
    fields: mismatchFields(legacyProjection, shadowProjection),
    legacy: legacyProjection,
    shadow: shadowProjection,
  };
  return { ...base, ok: !mismatch, reused: false, steps, candidate: opened.value, ...(mismatch ? { mismatch } : {}) };
}

/** Containment wrapper. Binding/report failures never alter established legacy result. */
export function observeAuthorV4Shadow<TLegacy>(
  legacy: TLegacy,
  binding: AuthorV4ShadowBinding<TLegacy> | undefined,
  log: (message: string) => void,
): TLegacy {
  if (!binding) return legacy;
  const safeLog = (message: string): void => { try { log(message); } catch { /* shadow diagnostics never escape */ } };
  void projectAuthorV4Shadow(legacy, binding).then((report) => {
    try {
      binding.report?.(report);
      if (!report.ok) {
        const detail = report.mismatch
          ? `${report.mismatch.operationKind}:${report.mismatch.operationId} fields=${report.mismatch.fields.join(",")}`
          : report.steps.filter((step) => !step.ok).map((step) => `${step.name}:${step.code ?? "FAILED"}`).join(",");
        safeLog(`V4 shadow mismatch/block (${detail}); legacy result remains authoritative`);
      }
    } catch (error) {
      safeLog(`V4 shadow report exception (${(error as Error).message}); legacy result remains authoritative`);
    }
  }, (error: unknown) => {
    safeLog(`V4 shadow exception (${(error as Error).message}); legacy result remains authoritative`);
  }).catch(() => {});
  return legacy;
}

/** The minimal canonical-IO seam the transaction needs (structurally a subset
 *  of AuthorIo, so callers pass their existing io object straight through). */
export type ChapterCanonicalIo = {
  readChapterFile: (bookId: string, chapterNumber: number) => string | null;
  writeChapterFile: (bookId: string, chapterNumber: number, bytes: string) => void;
};

/** Canonical IO needed to undo a just-landed commit when a required companion
 * record (author provenance / lead override) cannot be made durable.  Removal
 * is explicit because a first-write rollback must restore "absent", not an
 * empty or sentinel chapter. */
export type ChapterReconciliationIo = ChapterCanonicalIo & {
  removeChapterFile: (bookId: string, chapterNumber: number) => void;
};

export type ChapterAttempt = {
  identity: AttemptIdentityV1;
  attemptDir: string;
  /** The agent's cwd — its ONLY writable directory (codex workspace-write). */
  workspaceDir: string;
  candidateFileName: string;
  candidatePath: string;
  /** IMP-10: durable-evidence root for this attempt, or null when evidence
   *  recording is off (the default — unit tests never enable it). */
  evidenceRoot: string | null;
};

export type MintAttemptOptions = {
  bookId: string;
  chapterNumber: number;
  chapterId: string;
  attemptKind: AttemptKindV1;
  attemptSequence: number;
  designLineage?: string;
  executionProfileHash?: string;
  promptSha256: string;
  inputHashes?: Record<string, string>;
  /** IMP-03: canonical hash of the source-use plan this attempt authors under
   *  (omitted for legacy/pre-plan books — the contract field is optional). */
  sourcePlanHash?: string;
  io: ChapterCanonicalIo;
  /** Pre-seed the workspace candidate with these bytes (surgical repair edits
   *  a COPY of the original — never the canonical file). */
  seedBytes?: string;
  /** Override the attempts root (tests use tmp roots). */
  attemptsRoot?: string;
  /** IMP-10: durable-evidence root. When set (or CHAPTERFLOW_EVIDENCE_ROOT is),
   *  the attempt records an immutable content-addressed evidence manifest;
   *  omitted → evidence recording is OFF (unit-test default, no extra writes). */
  evidenceRoot?: string | null;
  /** IMP-10: the frozen task class for this attempt's evidence (default derived
   *  from attemptKind). */
  taskClass?: string;
  /** IMP-10: path of the IMP-00 effective-context manifest for the spawn that
   *  produced this attempt (links execution provenance into the evidence). */
  executionContextManifestPath?: string;
  routeResultPath?: string;
};

let attemptCounter = 0;

/** Mint one immutable attempt: identity + expected canonical base + workspace. */
export function mintChapterAttempt(opts: MintAttemptOptions): ChapterAttempt {
  const nn = String(opts.chapterNumber).padStart(2, "0");
  const root = opts.attemptsRoot ?? ATTEMPTS_ROOT;
  const currentBytes = opts.io.readChapterFile(opts.bookId, opts.chapterNumber);
  const expectedBaseSha256 = currentBytes === null ? null : sha256Hex(currentBytes);
  const chapterRoot = join(root, opts.bookId, `ch${nn}`);
  recoverIncompleteCommits(chapterRoot, opts.io, opts.bookId, opts.chapterNumber);
  const attemptId = `${opts.bookId}-ch${nn}-${opts.attemptKind}-${opts.attemptSequence}-${Date.now().toString(36)}-${(attemptCounter++).toString(36)}-${process.pid.toString(36)}`;
  const attemptDir = join(chapterRoot, attemptId);
  const workspaceDir = join(attemptDir, "workspace");
  mkdirSync(workspaceDir, { recursive: true, mode: 0o700 });
  const candidateFileName = chapterFileName(opts.chapterId);
  const identity: AttemptIdentityV1 = {
    schema: "attempt-identity-v1",
    attemptId,
    bookId: opts.bookId,
    chapterNumber: opts.chapterNumber,
    designLineage: opts.designLineage ?? "",
    attemptKind: opts.attemptKind,
    attemptSequence: opts.attemptSequence,
    executionProfileHash: opts.executionProfileHash ?? "",
    ...(opts.sourcePlanHash ? { sourcePlanHash: opts.sourcePlanHash } : {}),
    promptSha256: opts.promptSha256,
    inputHashes: opts.inputHashes ?? {},
    outputSchemaVersion: "chapterflow-v21-authored",
    expectedBaseSha256,
    expectedBaseGeneration: countCommits(chapterRoot),
  };
  writeFileSync(join(attemptDir, "attempt.json"), JSON.stringify(identity, null, 2) + "\n");
  const candidatePath = join(workspaceDir, candidateFileName);
  if (opts.seedBytes !== undefined) writeFileSync(candidatePath, opts.seedBytes);
  // IMP-10: open durable evidence when a root is configured (OFF by default —
  // unit tests that pass neither param nor env write no evidence at all).
  const evidenceRoot = resolveEvidenceRoot(opts.evidenceRoot);
  if (evidenceRoot) {
    const atIso = new Date().toISOString();
    recordAttemptMint({
      evidenceRoot,
      identity,
      taskClass: opts.taskClass ?? attemptKindTaskClass(opts.attemptKind),
      // Non-empty at open (the contract requires it): the immutable attempt
      // identity IS the execution anchor at mint time (it carries the execution-
      // profile hash, prompt hash, and input hashes). linkExecutionContext()
      // upgrades it to the IMP-00 spawn manifest once the spawn has run.
      executionContextManifestPath: opts.executionContextManifestPath ?? join(attemptDir, "attempt.json"),
      routeResultPath: opts.routeResultPath,
      atIso,
    });
    // The immutable attempt identity is itself the first evidence object.
    recordAttemptObject(evidenceRoot, attemptId, "attempt-identity", JSON.stringify(identity, null, 2) + "\n");
    if (opts.seedBytes !== undefined) recordAttemptObject(evidenceRoot, attemptId, "seed-bytes", opts.seedBytes);
  }
  return { identity, attemptDir, workspaceDir, candidateFileName, candidatePath, evidenceRoot };
}

/** Default frozen task class per attempt kind (a caller may override). */
function attemptKindTaskClass(kind: AttemptKindV1): string {
  switch (kind) {
    case "author-initial": return "author-first-write";
    case "author-regeneration": return "author-regeneration";
    case "surgical-repair": return "surgical-repair";
    case "section-repair": return "section-repair";
    default: return "author-first-write";
  }
}

export type CandidateImport =
  | { ok: true; bytes: string; chapter: ChapterV21; sha256: string }
  | { ok: false; outcome: CandidateOutcomeV1; reason: string };

/** Read + structurally admit the candidate the agent left in its workspace. */
export function importCandidate(attempt: ChapterAttempt): CandidateImport {
  if (!existsSync(attempt.candidatePath)) {
    return { ok: false, outcome: "validation_failed", reason: `no candidate file written (${attempt.candidateFileName})` };
  }
  let size = 0;
  try { size = statSync(attempt.candidatePath).size; } catch { /* handled by read below */ }
  if (size > CANDIDATE_MAX_BYTES) {
    return { ok: false, outcome: "malformed_output", reason: `candidate is ${size} bytes (> ${CANDIDATE_MAX_BYTES} cap) — runaway output rejected` };
  }
  let bytes: string;
  try {
    bytes = readFileSync(attempt.candidatePath, "utf8");
  } catch (err) {
    return { ok: false, outcome: "infrastructure_failure", reason: `candidate unreadable: ${(err as Error).message}` };
  }
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(bytes) as ChapterV21;
  } catch (err) {
    return { ok: false, outcome: "malformed_output", reason: `candidate is not valid JSON (${(err as Error).message.split("\n")[0]})` };
  }
  const expectedId = attempt.candidateFileName.replace(/\.v21-native\.chapter\.json$/i, "");
  if ((chapter.chapterId ?? "") !== expectedId) {
    return { ok: false, outcome: "validation_failed", reason: `candidate chapterId "${chapter.chapterId}" != expected "${expectedId}" (wrong-identity output rejected)` };
  }
  return { ok: true, bytes, chapter, sha256: sha256Hex(bytes) };
}

/** Any workspace entry besides the candidate file is an unexpected write —
 *  first-class attempt failure, never silently tolerated (F-020). */
export function unexpectedAttemptWrites(attempt: ChapterAttempt, extraAllowed: readonly string[] = []): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    let entries;
    try { entries = readdirSync(join(attempt.workspaceDir, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const relPath = rel === "" ? e.name : join(rel, e.name);
      if (e.isDirectory()) walk(relPath);
      // IMP-07: a patch-returning attempt legitimately writes exactly one extra
      // file (patch.json) — the caller names it explicitly; nothing is implicit.
      else if (relPath !== attempt.candidateFileName && !extraAllowed.includes(relPath)) out.push(relPath);
    }
  };
  walk("");
  return out.sort();
}

/** Gate the candidate with COMMITTED siblings as context. The sibling-context
 *  path is the chapter's canonical home (so the candidate is compared against
 *  the committed book and its own committed bytes are excluded); the attempt
 *  key keeps the CLI-era per-chapter gate history continuous. */
export async function gateCandidate(
  candidate: ChapterV21,
  canonicalAbsPath: string,
  attemptKey: string,
  options: ChapterGateCompositeOptions = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const r = await runChapterGateComposite(candidate, canonicalAbsPath, attemptKey, options);
  return r.crashed ? { code: 1, stdout: "", stderr: r.report } : { code: r.exitCode, stdout: r.report, stderr: "" };
}

/** Rubric metrics with the candidate SUBSTITUTED into the committed book —
 *  byte-compatible stdout with the `rubric-metrics` verb (same formatter), so
 *  callers keep their existing chNN-verdict-line parsing. */
export async function rubricMetricsWithCandidate(
  bookId: string,
  chapterNumber: number,
  candidate: ChapterV21,
  loadChapters: (bookId: string) => ChapterV21[],
  thresholds?: RubricThresholds,
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { computeBookRubricMetrics, formatRubricMetrics } = await import("../metrics/bookRubricMetrics.js");
    let siblings: ChapterV21[] = [];
    try { siblings = loadChapters(bookId).filter((c) => c.number !== chapterNumber); } catch { siblings = []; }
    const report = computeBookRubricMetrics(bookId, { chapters: [...siblings, candidate], ...(thresholds ? { thresholds } : {}) });
    return { code: 0, stdout: formatRubricMetrics(report), stderr: "" };
  } catch (err) {
    return { code: 1, stdout: "", stderr: `rubric-metrics (candidate): ${(err as Error).message}` };
  }
}

export type CommitResult =
  | {
      ok: true;
      committedSha256: string;
      previousBytes: string | null;
      commitManifestPath: string;
      requiredEvidencePending: boolean;
    }
  | { ok: false; outcome: "stale_base"; reason: string }
  | {
      ok: false;
      outcome: "infrastructure_failure";
      reason: string;
      canonicalLanded: boolean;
      committedSha256: string;
      previousBytes: string | null;
      commitManifestPath: string;
    };

export type RequiredCommitEvidenceV1 = {
  authorProvenanceBindingSha256: string;
  leadOverrideSha256: string | null;
  /** ACTIVE forward path: hash of the complete conductor COMMITTED/PASS result
   * persisted and read back inside this same required-evidence bracket. */
  forwardReviewResultSha256?: string;
};

/** Compare-and-swap commit: canonical must still hash to the attempt's expected
 *  base; the replacement is one atomic write through the caller's IO seam. A
 *  pending manifest brackets the swap for deterministic crash recovery. */
export function commitChapterCandidate(args: {
  attempt: ChapterAttempt;
  bytes: string;
  io: ChapterCanonicalIo;
  /** Evidence identifiers this commit invalidates (reviews/acceptance) — recorded
   *  in the manifest; actual invalidation stays with the existing callers. */
  invalidated?: string[];
  /** When present, canonical bytes remain in a recoverable pending-evidence
   * phase until the caller persists/read-backs these companion records and
   * explicitly closes the bracket with finalizeChapterCommitEvidence(). */
  requiredEvidence?: RequiredCommitEvidenceV1;
}): CommitResult {
  const { attempt, bytes, io } = args;
  const { bookId, chapterNumber, expectedBaseSha256 } = attempt.identity;
  const currentBytes = io.readChapterFile(bookId, chapterNumber);
  const currentSha = currentBytes === null ? null : sha256Hex(currentBytes);
  if (currentSha !== expectedBaseSha256) {
    const manifest = buildCommitManifest(attempt, currentSha, sha256Hex(bytes), args.invalidated ?? [], "aborted_stale_base");
    try { writeFileSync(join(attempt.attemptDir, "commit-manifest.json"), JSON.stringify(manifest, null, 2) + "\n"); } catch { /* evidence best-effort */ }
    return {
      ok: false,
      outcome: "stale_base",
      reason:
        `canonical ${bookId} ch${String(chapterNumber).padStart(2, "0")} changed under this attempt ` +
        `(expected base ${expectedBaseSha256?.slice(0, 12) ?? "<absent>"}, found ${currentSha?.slice(0, 12) ?? "<absent>"}) — ` +
        `stale attempt loses; no overwrite, no auto-retry (bounded policy owns any retry)`,
    };
  }
  const committedSha256 = sha256Hex(bytes);
  const manifest: PhasedCommitManifest = {
    ...buildCommitManifest(attempt, currentSha, committedSha256, args.invalidated ?? [], "pending"),
    ...(args.requiredEvidence ? { requiredEvidence: args.requiredEvidence } : {}),
  };
  const manifestPath = join(attempt.attemptDir, "commit-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  // IMP-10: the candidate bytes + commit manifest are content-addressed evidence,
  // recorded around the swap so a crash between rename and bookkeeping leaves a
  // manifest that recovery reconciles (never a claim of success without proof).
  if (attempt.evidenceRoot) {
    const atIso = new Date().toISOString();
    recordAttemptObject(attempt.evidenceRoot, attempt.identity.attemptId, "candidate-bytes", bytes);
    recordAttemptObject(attempt.evidenceRoot, attempt.identity.attemptId, "commit-manifest", JSON.stringify(manifest, null, 2) + "\n");
    recordAttemptState(attempt.evidenceRoot, attempt.identity.attemptId, "commit-pending", atIso);
  }
  try {
    io.writeChapterFile(bookId, chapterNumber, bytes);
  } catch (error) {
    const observed = io.readChapterFile(bookId, chapterNumber);
    const observedSha256 = observed === null ? null : sha256Hex(observed);
    const landed = observedSha256 === committedSha256;
    const phase: PhasedCommitManifest["phase"] = landed ? "reconciliation_required" : "aborted_write_failure";
    const reconciliation: CommitReconciliationV1 = {
      cause: `canonical write threw: ${(error as Error).message}`,
      attemptedAtIso: new Date().toISOString(),
      outcome: "reconciliation_required",
      observedCanonicalSha256: observedSha256,
      restoredSha256: currentSha,
      detail: landed
        ? "canonical candidate bytes landed but the write threw before the commit bracket could be closed"
        : "canonical candidate bytes did not read back after the write failure",
    };
    try { writeFileSync(manifestPath, JSON.stringify({ ...manifest, phase, reconciliation }, null, 2) + "\n"); } catch { /* original pending bracket remains recovery evidence */ }
    return {
      ok: false,
      outcome: "infrastructure_failure",
      reason: `${reconciliation.cause}; ${reconciliation.detail}`,
      canonicalLanded: landed, committedSha256, previousBytes: currentBytes, commitManifestPath: manifestPath,
    };
  }
  const landedBytes = io.readChapterFile(bookId, chapterNumber);
  const landedSha256 = landedBytes === null ? null : sha256Hex(landedBytes);
  if (landedSha256 !== committedSha256) {
    const reconciliation: CommitReconciliationV1 = {
      cause: "canonical write returned without persisting the candidate bytes",
      attemptedAtIso: new Date().toISOString(),
      outcome: "reconciliation_required",
      observedCanonicalSha256: landedSha256,
      restoredSha256: currentSha,
      detail: `canonical commit read-back mismatch (expected ${committedSha256.slice(0, 12)}, found ${landedSha256?.slice(0, 12) ?? "<absent>"})`,
    };
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, phase: "reconciliation_required", reconciliation }, null, 2) + "\n");
    return {
      ok: false, outcome: "infrastructure_failure", reason: reconciliation.detail,
      canonicalLanded: false, committedSha256, previousBytes: currentBytes, commitManifestPath: manifestPath,
    };
  }
  const closingPhase: PhasedCommitManifest["phase"] = args.requiredEvidence ? "pending_required_evidence" : "committed";
  try {
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, phase: closingPhase }, null, 2) + "\n");
  } catch (error) {
    // Canonical landed but the durable bracket did not close. Return enough
    // state for commitPreparedAuthorCandidate to CAS-rollback; never surface a
    // successful commit whose required evidence transition is only in memory.
    return {
      ok: false,
      outcome: "infrastructure_failure",
      reason: `canonical bytes landed but the ${closingPhase} manifest could not be persisted: ${(error as Error).message}`,
      canonicalLanded: true,
      committedSha256,
      previousBytes: currentBytes,
      commitManifestPath: manifestPath,
    };
  }
  return {
    ok: true,
    committedSha256,
    previousBytes: currentBytes,
    commitManifestPath: manifestPath,
    requiredEvidencePending: args.requiredEvidence !== undefined,
  };
}

type CommitReconciliationV1 = {
  cause: string;
  attemptedAtIso: string;
  outcome: "rolled_back" | "reconciliation_required";
  observedCanonicalSha256: string | null;
  restoredSha256: string | null;
  detail: string;
};

type PhasedCommitManifest = CommitManifestV1 & {
  phase:
    | "pending"
    | "pending_required_evidence"
    | "committed"
    | "aborted_stale_base"
    | "aborted_write_failure"
    | "aborted_recovered"
    | "rolled_back_required_evidence_failure"
    | "reconciliation_required";
  reconciliation?: CommitReconciliationV1;
  requiredEvidence?: RequiredCommitEvidenceV1;
};

export type CommitReconciliationResult =
  | { ok: true; outcome: "rolled_back"; restoredSha256: string | null; detail: string }
  | { ok: false; outcome: "reconciliation_required"; observedCanonicalSha256: string | null; detail: string };

/**
 * Fail-closed companion-record reconciliation.
 *
 * A chapter commit and its required provenance cannot be one filesystem
 * transaction through the legacy IO seam.  If companion persistence fails, we
 * therefore perform a second CAS: rollback is allowed only while canonical
 * bytes still equal THIS attempt's committed hash.  Any intervening write wins
 * and is never clobbered; the commit manifest remains durable and is marked for
 * operator reconciliation instead of claiming PASS.
 */
export function reconcileCommittedChapterCandidate(args: {
  attempt: ChapterAttempt;
  committedSha256: string;
  previousBytes: string | null;
  io: ChapterReconciliationIo;
  cause: string;
  /** A required companion surface could not itself be restored. Canonical CAS
   * rollback is still attempted, but the overall manifest must remain in an
   * operator-reconciliation state rather than claiming a clean rollback. */
  companionStateUnreconciled?: boolean;
}): CommitReconciliationResult {
  const { attempt, committedSha256, previousBytes, io, cause } = args;
  const { bookId, chapterNumber } = attempt.identity;
  const manifestPath = join(attempt.attemptDir, "commit-manifest.json");
  const expectedRestoreSha256 = previousBytes === null ? null : sha256Hex(previousBytes);
  const attemptedAtIso = new Date().toISOString();

  const persist = (phase: PhasedCommitManifest["phase"], reconciliation: CommitReconciliationV1): void => {
    let current: PhasedCommitManifest;
    try {
      current = JSON.parse(readFileSync(manifestPath, "utf8")) as PhasedCommitManifest;
    } catch {
      current = buildCommitManifest(attempt, expectedRestoreSha256, committedSha256, [], phase);
    }
    writeFileSync(manifestPath, JSON.stringify({ ...current, phase, reconciliation }, null, 2) + "\n");
    if (attempt.evidenceRoot) {
      recordAttemptObject(
        attempt.evidenceRoot,
        attempt.identity.attemptId,
        "commit-reconciliation",
        JSON.stringify({ schema: "commit-reconciliation-v1", ...reconciliation }, null, 2) + "\n",
      );
    }
  };

  const beforeBytes = io.readChapterFile(bookId, chapterNumber);
  const beforeSha256 = beforeBytes === null ? null : sha256Hex(beforeBytes);
  if (beforeSha256 !== committedSha256) {
    const detail =
      `required evidence failed after commit, but canonical changed before rollback ` +
      `(expected this commit ${committedSha256.slice(0, 12)}, found ${beforeSha256?.slice(0, 12) ?? "<absent>"}); ` +
      `intervening bytes preserved`;
    const reconciliation: CommitReconciliationV1 = {
      cause, attemptedAtIso, outcome: "reconciliation_required", observedCanonicalSha256: beforeSha256,
      restoredSha256: expectedRestoreSha256, detail,
    };
    persist("reconciliation_required", reconciliation);
    return { ok: false, outcome: "reconciliation_required", observedCanonicalSha256: beforeSha256, detail };
  }

  try {
    if (previousBytes === null) io.removeChapterFile(bookId, chapterNumber);
    else io.writeChapterFile(bookId, chapterNumber, previousBytes);
  } catch (error) {
    const observed = io.readChapterFile(bookId, chapterNumber);
    const observedSha256 = observed === null ? null : sha256Hex(observed);
    const detail = `CAS rollback write failed: ${(error as Error).message}`;
    const reconciliation: CommitReconciliationV1 = {
      cause, attemptedAtIso, outcome: "reconciliation_required", observedCanonicalSha256: observedSha256,
      restoredSha256: expectedRestoreSha256, detail,
    };
    persist("reconciliation_required", reconciliation);
    return { ok: false, outcome: "reconciliation_required", observedCanonicalSha256: observedSha256, detail };
  }

  const restored = io.readChapterFile(bookId, chapterNumber);
  const restoredSha256 = restored === null ? null : sha256Hex(restored);
  if (restoredSha256 !== expectedRestoreSha256) {
    const detail =
      `CAS rollback did not read back the prior bytes ` +
      `(expected ${expectedRestoreSha256?.slice(0, 12) ?? "<absent>"}, found ${restoredSha256?.slice(0, 12) ?? "<absent>"})`;
    const reconciliation: CommitReconciliationV1 = {
      cause, attemptedAtIso, outcome: "reconciliation_required", observedCanonicalSha256: restoredSha256,
      restoredSha256: expectedRestoreSha256, detail,
    };
    persist("reconciliation_required", reconciliation);
    return { ok: false, outcome: "reconciliation_required", observedCanonicalSha256: restoredSha256, detail };
  }

  const canonicalRollbackDetail = `required evidence failed; canonical CAS rollback restored ${expectedRestoreSha256?.slice(0, 12) ?? "<absent>"}`;
  if (args.companionStateUnreconciled) {
    const detail = `${canonicalRollbackDetail}, but a required companion record could not be restored`;
    const reconciliation: CommitReconciliationV1 = {
      cause, attemptedAtIso, outcome: "reconciliation_required", observedCanonicalSha256: restoredSha256,
      restoredSha256: expectedRestoreSha256, detail,
    };
    persist("reconciliation_required", reconciliation);
    return { ok: false, outcome: "reconciliation_required", observedCanonicalSha256: restoredSha256, detail };
  }
  const detail = canonicalRollbackDetail;
  const reconciliation: CommitReconciliationV1 = {
    cause, attemptedAtIso, outcome: "rolled_back", observedCanonicalSha256: committedSha256,
    restoredSha256: expectedRestoreSha256, detail,
  };
  persist("rolled_back_required_evidence_failure", reconciliation);
  return { ok: true, outcome: "rolled_back", restoredSha256: expectedRestoreSha256, detail };
}

/** Close a pending-required-evidence bracket only after the caller has
 * durably persisted and read-back-verified every companion record. The
 * canonical hash and frozen evidence expectation are rechecked here so a stale
 * caller cannot close somebody else's commit. */
export function finalizeChapterCommitEvidence(args: {
  attempt: ChapterAttempt;
  committedSha256: string;
  requiredEvidence: RequiredCommitEvidenceV1;
  io: ChapterCanonicalIo;
}): { ok: true } | { ok: false; reason: string } {
  const { attempt, committedSha256, requiredEvidence, io } = args;
  const { bookId, chapterNumber } = attempt.identity;
  const current = io.readChapterFile(bookId, chapterNumber);
  const currentSha256 = current === null ? null : sha256Hex(current);
  if (currentSha256 !== committedSha256) {
    return { ok: false, reason: `canonical changed before required-evidence finalization (expected ${committedSha256.slice(0, 12)}, found ${currentSha256?.slice(0, 12) ?? "<absent>"})` };
  }
  const manifestPath = join(attempt.attemptDir, "commit-manifest.json");
  let manifest: PhasedCommitManifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PhasedCommitManifest; }
  catch (error) { return { ok: false, reason: `required-evidence manifest is unreadable: ${(error as Error).message}` }; }
  if (manifest.phase !== "pending_required_evidence") {
    return { ok: false, reason: `required-evidence manifest is ${manifest.phase}, not pending_required_evidence` };
  }
  if (!manifest.requiredEvidence || hashCanonical(manifest.requiredEvidence) !== hashCanonical(requiredEvidence)) {
    return { ok: false, reason: "required-evidence expectation differs from the pending commit manifest" };
  }
  try {
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, phase: "committed" }, null, 2) + "\n");
    const readBack = JSON.parse(readFileSync(manifestPath, "utf8")) as PhasedCommitManifest;
    if (readBack.phase !== "committed" || readBack.committedSha256 !== committedSha256) {
      return { ok: false, reason: "committed required-evidence manifest did not read back" };
    }
  } catch (error) {
    return { ok: false, reason: `required-evidence manifest could not be finalized: ${(error as Error).message}` };
  }
  return { ok: true };
}

function buildCommitManifest(
  attempt: ChapterAttempt,
  previousSha256: string | null,
  committedSha256: string,
  invalidated: string[],
  phase: PhasedCommitManifest["phase"],
): PhasedCommitManifest {
  return {
    schema: "commit-manifest-v1",
    attemptId: attempt.identity.attemptId,
    bookId: attempt.identity.bookId,
    chapterNumber: attempt.identity.chapterNumber,
    previousSha256,
    committedSha256,
    committedGeneration: attempt.identity.expectedBaseGeneration + 1,
    invalidated,
    committedAtIso: new Date().toISOString(),
    phase,
  };
}

/** Deterministic idempotent recovery: a `pending` manifest means a crash landed
 *  between the swap bracket writes. If canonical already holds the committed
 *  bytes, finish the bracket; otherwise the swap never happened — mark aborted.
 *  Called on every mint for the same chapter, and exported for direct use. */
export function recoverIncompleteCommits(
  chapterRoot: string,
  io: ChapterCanonicalIo,
  bookId: string,
  chapterNumber: number,
): Array<{ attemptId: string; resolution: "committed" | "aborted_recovered" | "reconciliation_required" }> {
  const resolutions: Array<{ attemptId: string; resolution: "committed" | "aborted_recovered" | "reconciliation_required" }> = [];
  let entries: string[] = [];
  try { entries = readdirSync(chapterRoot); } catch { return resolutions; }
  for (const attemptId of entries) {
    const manifestPath = join(chapterRoot, attemptId, "commit-manifest.json");
    let manifest: PhasedCommitManifest;
    try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PhasedCommitManifest; } catch { continue; }
    if (manifest.phase !== "pending" && manifest.phase !== "pending_required_evidence") continue;
    const currentBytes = io.readChapterFile(bookId, chapterNumber);
    const currentSha = currentBytes === null ? null : sha256Hex(currentBytes);
    const resolution = currentSha !== manifest.committedSha256
      ? "aborted_recovered"
      : manifest.phase === "pending_required_evidence"
        ? "reconciliation_required"
        : "committed";
    try { writeFileSync(manifestPath, JSON.stringify({ ...manifest, phase: resolution }, null, 2) + "\n"); } catch { continue; }
    resolutions.push({ attemptId: manifest.attemptId, resolution });
  }
  return resolutions;
}

function countCommits(chapterRoot: string): number {
  let n = 0;
  let entries: string[] = [];
  try { entries = readdirSync(chapterRoot); } catch { return 0; }
  for (const attemptId of entries) {
    try {
      const m = JSON.parse(readFileSync(join(chapterRoot, attemptId, "commit-manifest.json"), "utf8")) as PhasedCommitManifest;
      if (m.phase === "committed") n++;
    } catch { /* not a commit */ }
  }
  return n;
}

/** Record the attempt's terminal disposition; on success the workspace is
 *  removed (the candidate equals the canonical bytes), on failure the candidate
 *  is KEPT for forensics (IMP-10 owns durable evidence; this is the interim). */
export function finalizeAttempt(attempt: ChapterAttempt, outcome: CandidateOutcomeV1, detail?: string): void {
  const atIso = new Date().toISOString();
  try {
    writeFileSync(
      join(attempt.attemptDir, "outcome.json"),
      JSON.stringify({ schema: "attempt-outcome-v1", attemptId: attempt.identity.attemptId, outcome, detail: detail ?? "", atIso }, null, 2) + "\n",
    );
  } catch { /* evidence best-effort */ }
  // IMP-10: the durable terminal state (frozen 17-state union). Recorded BEFORE
  // the workspace is removed so a committed attempt's evidence is complete even
  // though its transient workspace is swept.
  if (attempt.evidenceRoot) recordAttemptFinal(attempt.evidenceRoot, attempt.identity, outcome, atIso);
  if (outcome === "committed") {
    try { rmSync(attempt.workspaceDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

/** Bounded crash-net sweep for attempt debris. Refuses to remove attempts whose
 *  commit bracket is still `pending` (recovery owns those). Default 7 days. */
export function sweepStaleAttempts(opts: { attemptsRoot?: string; olderThanMs?: number; now?: number } = {}): string[] {
  const root = opts.attemptsRoot ?? ATTEMPTS_ROOT;
  const threshold = opts.olderThanMs ?? 7 * 24 * 60 * 60 * 1000;
  const now = opts.now ?? Date.now();
  const removed: string[] = [];
  let books: string[] = [];
  try { books = readdirSync(root); } catch { return removed; }
  for (const book of books) {
    let chapters: string[] = [];
    try { chapters = readdirSync(join(root, book)); } catch { continue; }
    for (const ch of chapters) {
      let attempts: string[] = [];
      try { attempts = readdirSync(join(root, book, ch)); } catch { continue; }
      for (const attemptId of attempts) {
        const dir = join(root, book, ch, attemptId);
        try {
          if (now - statSync(dir).mtimeMs < threshold) continue;
          try {
            const m = JSON.parse(readFileSync(join(dir, "commit-manifest.json"), "utf8")) as PhasedCommitManifest;
            if (m.phase === "pending" || m.phase === "pending_required_evidence") continue; // recovery owns pending brackets
          } catch { /* no manifest — plain debris */ }
          rmSync(dir, { recursive: true, force: true });
          removed.push(dir);
        } catch { /* contended/gone */ }
      }
    }
  }
  return removed;
}

/** Atomic default for the canonical write seam (IMP-01 also upgrades the
 *  direct-write default in resolveAuthorIo to this — a plain writeFileSync at
 *  the canonical path was the torn-read wedge the plan's F-001 documents). */
export function atomicCanonicalWrite(absPath: string, bytes: string): void {
  writeFileAtomic(absPath, bytes);
}
