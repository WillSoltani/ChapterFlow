/**
 * Model bake-off — the deterministic conductor.
 *
 * Phase ladder (each phase completes durably in manifest.json; a rerun with the
 * same run id re-enters at the first incomplete phase and reuses verified work):
 *
 *   intake     — draft → immutable hashed artifact + identity resolution
 *   research   — ONE draft-grounded research session (existing contract:
 *                state/indexes/<id>.json + fresh source-v2 sidecars)
 *   freeze     — compile chain (existing verbs) + hash every shared input
 *   preflight  — codex version + ALL candidate models + the judge model answer
 *                a trivial pinned-model probe; any failure halts BEFORE any
 *                expensive generation
 *   candidates — N isolated complete books (existing whole-chapter writer)
 *   validate   — existing deterministic batteries per candidate (no QC rounds)
 *   review     — blinded, fixed-judge comparison under opaque labels
 *   select     — pure quality-first hierarchy (cost only inside the tie band)
 *   promote    — winner → canonical state (byte-verified) + provenance sidecar,
 *                then the full deterministic preflight re-runs (qc-converge)
 *   qc         — delegated VERBATIM to `book-autopilot <id> --author`, which
 *                owns formal QC rounds, the qc-diagnose repair governance, and
 *                the verified publish path; PUBLISH=false keeps --no-publish
 *   report     — permanent JSON + Markdown comparison report
 *
 * Candidate work NEVER touches canonical chapters/packages/registries/git; the
 * only canonical writes are promotion (above) and whatever the existing
 * autopilot/publish path does after it.
 */

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { spawn as spawnChild } from "child_process";

import {
  acquireBookLock,
  buildSourcePrewriteRepairTask,
  resolveDeps,
  type AutopilotDeps,
  type BookLock,
  type VerbResult,
} from "../orchestrator/autopilot.js";
import { findCodexBinary } from "../orchestrator/codexAgent.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { normSlug } from "../lib/chapterPaths.js";
import type {
  BakeoffManifestV1,
  BakeoffPhase,
  BlindLabel,
  CandidateD7JudgmentV1,
  CandidateEvalDiagnosticV1,
  CandidateReviewV1,
  CandidateSpec,
  CandidateStateV1,
  CandidateValidationV1,
  D7TerminalState,
  ReasoningEffort,
} from "./types.js";
import { readCallLedgerEntries } from "../telemetry/runCallLedger.js";
import type { ChapterV21 } from "../types.js";
import { BAKEOFF_MANIFEST_SCHEMA } from "./types.js";
import { PIPELINE_DIR, bakeoffRoots, candidateDir, modelSlug, pipelineRel, sha256File, type BakeoffRoots } from "./paths.js";
import { intakeDraft, resolveBookIdForDraft, type ExtractorDeps, type IntakeOverrides } from "./intake.js";
import { intakeCorpus, type CorpusIntakeDeps } from "./corpusIntake.js";
import { resolveRoute, SUPPORTED_MODEL_IDS, UnsupportedModelConfigError } from "../orchestrator/modelPolicy.js";
import { freezeSharedInputs, verifySharedInputs } from "./freeze.js";
import {
  defaultValidateInputs,
  generateCandidate,
  loadSlotChapters,
  persistCandidateChapters,
  validateCandidate,
} from "./candidates.js";
import { assignBlindLabels, combinedContentHash, forbiddenReviewTokens, reviewCandidate } from "./review.js";
import { judgeCandidateD7, unwiredD7Worker, type D7WorkerDispatch } from "./d7Judge.js";
import { selectWinner, type SelectionInputs } from "./selection.js";
import { promoteWinner } from "./promotion.js";
import { writeReports, type ReportInputs } from "./report.js";

/** The repo git root (resolves the retained D7 audit dir + the calibration
 *  reference doc + the WP-503 call ledger). */
const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");

/** Default hidden calibration reference for the D7 judge. The caller (WP-703
 *  execution) MUST pick a calibration unit from a book DISJOINT from the one
 *  under test so its audit unit cannot collide with a candidate chapter. */
export const DEFAULT_D7_CALIBRATION_UNIT = "made-to-stick-ch04";

export const DEFAULT_BAKEOFF_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
export const DEFAULT_BAKEOFF_EFFORT: ReasoningEffort = "xhigh";
// WP-501: the bakeoff judge model has NO default. directive-1 removed the
// prior 5.5 default, and a judge must never SILENTLY inherit BASELINE_MODEL (the
// writer/candidate model) — that is self-review, not independent judgement. The
// judge model is REQUIRED and explicit (`judgeModel` below / `--judge-model`).
// The target judge is the Claude-side D7 rubric-audit instrument; WP-702 rewires
// the harness to it. Only the effort keeps a default.
export const DEFAULT_JUDGE_EFFORT: ReasoningEffort = "high";
const RESEARCH_TIMEOUT_MS = 45 * 60 * 1000;
const PREFLIGHT_TIMEOUT_MS = 5 * 60 * 1000;
const SOURCE_REPAIR_MAX_PASSES = 3;

/**
 * rt702-R3 (WP-703): refuse a non-5.6 advisory judge id BEFORE any spawn.
 *
 * The advisory judge model is used in the preflight probe and the (non-blocking)
 * codex review via `deps.spawn({ model: judgeModel })`. `spawnCodexAgent` resolves
 * that model through `resolveRoute` with `requireSupportedModel: false`
 * (codexAgent.ts:497) — it MUST, so the legacy multi-provider router can honestly
 * record a foreign-provider id — so nothing downstream rejects a legacy-family
 * `--judge-model` before a live probe reaches the provider. directive-1 forbids
 * the legacy baseline family as a judge/benchmark, so enforce membership in the
 * 5.6 candidate set HERE, at the conductor boundary, before any spawn. Raises the
 * SAME typed `UnsupportedModelConfigError` (via `resolveRoute`) every other route
 * refusal uses; re-wrapped with the judge context.
 */
export function assertBakeoffJudgeSupported(judgeModel: string): void {
  try {
    resolveRoute({ role: "bakeoff-judge", requestedModel: judgeModel, requireSupportedModel: true });
  } catch (err) {
    if (err instanceof UnsupportedModelConfigError) {
      throw new UnsupportedModelConfigError({
        reason: err.reason,
        failingModel: judgeModel,
        failingCheck: "advisory --judge-model is one of the supported 5.6 candidates",
        detail: `the advisory judge must be a supported candidate (${[...SUPPORTED_MODEL_IDS].join(", ")}); the retired legacy baseline family is void as a judge/benchmark (directive-1) — refusing before any spawn`,
      });
    }
    throw err;
  }
}

export type DelegateVerb = (args: string[], env: Record<string, string>, onLine: (line: string) => void) => Promise<VerbResult>;

export type BakeoffDeps = AutopilotDeps & {
  /** Injected randomness (blind-label shuffle). Tests pin it. */
  rng: () => number;
  /** `codex --version` (recorded in the report); null when unavailable. */
  codexVersion: () => string | null;
  /** Long-running CLI delegation with live line streaming (book-autopilot). */
  delegate: DelegateVerb;
  /** WP-702 — the PRIMARY judge's Claude-side worker dispatch. Drives one isolated
   *  Claude session per D7 rater/adjudicator task. Fail-closed by default (never a
   *  codex read, never a stubbed score); the execution lane (WP-703) wires the real
   *  isolated-session dispatch. Tests inject a double. */
  d7Worker: D7WorkerDispatch;
};

function defaultCodexVersion(): string | null {
  try {
    return execFileSync(findCodexBinary(), ["--version"], { encoding: "utf8", timeout: 20_000 }).trim() || null;
  } catch {
    return null;
  }
}

function defaultDelegate(): DelegateVerb {
  return (args, env, onLine) =>
    new Promise((resolvePromise, rejectPromise) => {
      const child = spawnChild("npx", ["tsx", "src/cli.ts", ...args], {
        cwd: PIPELINE_DIR,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let buf = "";
      child.stdout.on("data", (d) => {
        const s = d.toString();
        stdout += s;
        buf += s;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) onLine(line);
      });
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", rejectPromise);
      child.on("close", (code) => resolvePromise({ code: code ?? -1, stdout, stderr }));
    });
}

export function resolveBakeoffDeps(d?: Partial<BakeoffDeps>): BakeoffDeps {
  const base = resolveDeps(d);
  return {
    ...base,
    rng: d?.rng ?? Math.random,
    codexVersion: d?.codexVersion ?? defaultCodexVersion,
    delegate: d?.delegate ?? defaultDelegate(),
    d7Worker: d?.d7Worker ?? unwiredD7Worker,
  };
}

/** The PRIMARY (D7) judge stage — driven per blinded candidate. Injectable so
 *  conductor tests exercise the phase logic (resume, blinding, floor gating) with
 *  a synthetic judgment; the default drives the real Claude-side harness. */
export type D7JudgeStageOptions = {
  runId: string;
  forbidden: string[];
  calibrationUnit: string;
  repositoryRoot: string;
  log: (m: string) => void;
  heartbeat?: () => boolean;
};

export type D7JudgeStage = (
  bookId: string,
  label: BlindLabel,
  chapters: ChapterV21[],
  deps: BakeoffDeps,
  roots: BakeoffRoots,
  opts: D7JudgeStageOptions,
) => Promise<CandidateD7JudgmentV1>;

/** Kebab audit id, unique per (run, blinded label). Stable so a resumed run
 *  re-enters the same retained audit idempotently. */
export function d7AuditId(runId: string, label: BlindLabel): string {
  return `bakeoff-${runId.toLowerCase()}-${label.toLowerCase()}`;
}

export const defaultD7Judge: D7JudgeStage = (bookId, label, chapters, deps, _roots, opts) =>
  judgeCandidateD7({
    bookId,
    label,
    chapters,
    repositoryRoot: opts.repositoryRoot,
    auditId: d7AuditId(opts.runId, label),
    calibrationUnit: opts.calibrationUnit,
    worker: deps.d7Worker,
    forbidden: opts.forbidden,
    log: opts.log,
    heartbeat: opts.heartbeat,
  });

/** The phase implementations, injectable so conductor tests drive the REAL
 *  phase logic (ordering, resume, blinding, halts, mutation boundaries) with
 *  synthetic stage outputs; each default is the real implementation and has its
 *  own focused unit tests. */
export type BakeoffStages = {
  freezeInputs: typeof freezeSharedInputs;
  verifyInputs: typeof verifySharedInputs;
  generate: typeof generateCandidate;
  validate: typeof validateCandidate;
  /** ADVISORY (non-blocking, WP-702): the codex whole-book panel read. */
  review: typeof reviewCandidate;
  /** PRIMARY (WP-702): the Claude-side D7 rubric-audit judge. */
  d7Judge: D7JudgeStage;
  promote: typeof promoteWinner;
};

function resolveStages(over?: Partial<BakeoffStages>): BakeoffStages {
  return {
    freezeInputs: over?.freezeInputs ?? freezeSharedInputs,
    verifyInputs: over?.verifyInputs ?? verifySharedInputs,
    generate: over?.generate ?? generateCandidate,
    validate: over?.validate ?? validateCandidate,
    review: over?.review ?? reviewCandidate,
    d7Judge: over?.d7Judge ?? defaultD7Judge,
    promote: over?.promote ?? promoteWinner,
  };
}

/** WP-703 — a no-draft CORPUS run spec. Instead of an operator manuscript, the
 *  run reads a book whose research/compile shared inputs are already frozen on
 *  disk (the sealed bakeoff corpus). Mutually exclusive with `draftPath`. */
export type CorpusRunSpec = {
  /** The corpus book under test. */
  bookId: string;
  /** The chapter subset (compare-only; a strict subset of the book's index). */
  chapters: number[];
  /** Override the corpus manifest location (tests point at a fixture). */
  manifestPath?: string;
  /** Injected corpus-intake deps (tests supply a manifest reader + shared-input
   *  collector so the ready path is provable without on-disk compile outputs). */
  intakeDeps?: CorpusIntakeDeps;
};

export type RunBakeoffOptions = {
  /** The operator manuscript. Required UNLESS `corpus` is set (a no-draft run). */
  draftPath?: string;
  /** WP-703 no-draft corpus run. Mutually exclusive with `draftPath`. */
  corpus?: CorpusRunSpec;
  bookId?: string;
  runId?: string;
  models?: string[];
  effort?: ReasoningEffort;
  /** REQUIRED and explicit (WP-501): the fixed judging-instrument model. It has
   *  NO default — it must never silently inherit BASELINE_MODEL (the writer),
   *  and the prior 5.5 baseline is void per directive-1. Callers pass an explicit
   *  judge id (the CLI requires `--judge-model`). */
  judgeModel: string;
  judgeEffort?: ReasoningEffort;
  /** The hidden D7 calibration reference unit (must be from a book DISJOINT from
   *  the one under test). Defaults to DEFAULT_D7_CALIBRATION_UNIT. */
  calibrationUnit?: string;
  maxParallel?: number;
  /** Concurrent chapter writers WITHIN one candidate. */
  chapterParallel?: number;
  /** Compare over this chapter SUBSET instead of the whole index. A subset run
   *  is automatically COMPARE-ONLY: candidates, validation, blinded review,
   *  selection, and the report run normally, but a partial book is never
   *  promoted into canonical state, never QC'd, never published. */
  chapters?: number[];
  publish?: boolean;
  plan?: boolean;
  force?: boolean;
  overrides?: IntakeOverrides;
  deps?: Partial<BakeoffDeps>;
  extractor?: ExtractorDeps;
  /** Lock factory override (tests). Default: the autopilot book lock. */
  acquireLock?: (bookId: string) => BookLock;
  /** Alternate state root for the run tree (tests use a tmp dir). */
  stateRoot?: string;
  /** Stage implementations override (tests). */
  stages?: Partial<BakeoffStages>;
};

export type BakeoffOutcome = {
  status: "complete" | "ready" | "published" | "halt" | "plan" | "compared";
  bookId: string;
  runId: string;
  winner: string | null;
  reason?: string;
  reportJsonPath?: string;
  reportMdPath?: string;
  /** Set when publication identity is ambiguous — the ONE question to answer. */
  publicationQuestion?: string;
};

// ── Manifest IO ───────────────────────────────────────────────────────────────

export function readManifest(roots: BakeoffRoots): BakeoffManifestV1 | null {
  if (!existsSync(roots.manifestPath)) return null;
  try {
    const m = JSON.parse(readFileSync(roots.manifestPath, "utf8")) as BakeoffManifestV1;
    return m.schemaVersion === BAKEOFF_MANIFEST_SCHEMA ? m : null;
  } catch {
    return null;
  }
}

export function writeManifest(roots: BakeoffRoots, manifest: BakeoffManifestV1): void {
  manifest.updatedAt = new Date().toISOString();
  mkdirSync(roots.runRoot, { recursive: true });
  writeFileAtomic(roots.manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

function phaseDone(m: BakeoffManifestV1, phase: BakeoffPhase): boolean {
  return m.completedPhases.includes(phase);
}

function markDone(roots: BakeoffRoots, m: BakeoffManifestV1, phase: BakeoffPhase): void {
  if (!m.completedPhases.includes(phase)) m.completedPhases.push(phase);
  writeManifest(roots, m);
}

// ── Candidate artifact IO (durable per-candidate records) ─────────────────────

function generationPath(roots: BakeoffRoots, slug: string): string {
  return resolve(candidateDir(roots, slug), "generation.json");
}
function validationPath(roots: BakeoffRoots, slug: string): string {
  return resolve(candidateDir(roots, slug), "validation.json");
}
function reviewPath(roots: BakeoffRoots, label: string): string {
  return resolve(roots.reviewsDir, label, "review.json");
}
/** The PRIMARY (D7) judgment sidecar, alongside the advisory review. */
function d7JudgePath(roots: BakeoffRoots, label: string): string {
  return resolve(roots.reviewsDir, label, "d7.json");
}
/** WP-E32: the canonical-evaluator chapter-diagnostic sidecar, mirroring
 *  d7JudgePath's convention. NOTHING in this worktree writes this file yet (the
 *  evaluator lane, WP-E13, owns that) — reading a missing file returns null,
 *  which keeps selectWinner in its legacy D7-primary mode (see selection.ts).
 *  Flagged for integration reconciliation against WP-E13's actual write path. */
function evalDiagnosticPath(roots: BakeoffRoots, label: string): string {
  return resolve(roots.reviewsDir, label, "eval-diagnostic.json");
}

function readJsonIf<T>(p: string): T | null {
  try {
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
  } catch {
    return null;
  }
}

/**
 * WP-E00 freeze (V25-AUD-03) — the D7 lifecycle state for one candidate, used to
 * gate FINAL-selection minting. A legacy record (no explicit `terminalState`)
 * infers per the frozen type's own comment: "judged" iff verdict is non-null,
 * else "pending" — with one necessary refinement: a completed-but-INELIGIBLE
 * judgment (audit package assembly refused / undriveable — see d7Judge.ts
 * `ineligible()`) stamps `judgedAt` and `ineligibleReason` but leaves `verdict`
 * PERMANENTLY null, and is never re-driven on resume once its content hash
 * matches. Reading that as "pending" would wedge every future resume into a
 * provisional selection forever; it is a conclusive terminal outcome, so read
 * `ineligibleReason` as the judged signal too.
 */
function resolveD7Terminal(d7: CandidateD7JudgmentV1 | null): D7TerminalState {
  if (!d7) return "pending";
  if (d7.terminalState) return d7.terminalState;
  if (d7.verdict !== null) return "judged";
  return d7.ineligibleReason ? "judged" : "pending";
}

function isD7Terminal(d7: CandidateD7JudgmentV1 | null): boolean {
  const state = resolveD7Terminal(d7);
  return state === "judged" || state === "instrument-fail";
}

/** A candidate the review phase already skipped (deterministic floor failed
 *  before any D7 spend — mirrors the exact skip condition in the review phase
 *  below) is conclusively decided WITHOUT a D7 read; it is exempt from
 *  terminal-gating rather than pinning every future selection to provisional. */
function floorEligible(generation: CandidateStateV1 | null, validation: CandidateValidationV1 | null): boolean {
  return generation?.status === "complete" && !!validation && validation.hardFailures.length === 0;
}

/**
 * WP-E32 (finding register PM-7 disposition): mark a run's evidence INVALID
 * without touching anything the run already wrote. Writes ONE new
 * `INVALID-<slug>.json` marker file directly inside `runDir` (beside
 * manifest.json) — it never opens, rewrites, or deletes the manifest or any
 * candidate/review/selection record, and it never overwrites a prior marker
 * (a colliding slug gets a numeric suffix instead). This is an OPERATOR action
 * — nothing in this conductor calls it; apply it by hand to a specific stale
 * run directory (e.g. an instrument-shakedown run) when the owner has decided
 * its evidence is void.
 */
export function annotateInvalidRun(runDir: string, reason: string): string {
  mkdirSync(runDir, { recursive: true });
  const slugBase = reason.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "invalid";
  let markerPath = resolve(runDir, `INVALID-${slugBase}.json`);
  for (let n = 2; existsSync(markerPath); n += 1) {
    markerPath = resolve(runDir, `INVALID-${slugBase}-${n}.json`);
  }
  const marker = {
    schemaVersion: "model-bakeoff-invalid-marker-v1" as const,
    reason,
    annotatedAt: new Date().toISOString(),
  };
  writeFileAtomic(markerPath, JSON.stringify(marker, null, 2) + "\n");
  return markerPath;
}

// ── The conductor ─────────────────────────────────────────────────────────────

export async function runBakeoff(opts: RunBakeoffOptions): Promise<BakeoffOutcome> {
  const deps = resolveBakeoffDeps(opts.deps);
  const stages = resolveStages(opts.stages);
  const log = deps.log;
  const models = (opts.models?.length ? opts.models : DEFAULT_BAKEOFF_MODELS).map((m) => m.trim()).filter(Boolean);
  if (new Set(models).size !== models.length) throw new Error("duplicate model ids in --models");
  const effort = opts.effort ?? DEFAULT_BAKEOFF_EFFORT;
  const judgeModel = opts.judgeModel?.trim();
  if (!judgeModel) {
    throw new Error(
      "model-bakeoff: an explicit judge model is required (no default). The judge must not " +
        "silently inherit the writer/baseline model (evaluator independence), and the prior 5.5 baseline " +
        "is void per directive-1. Pass --judge-model; the target judge is the D7 rubric-audit instrument (WP-702).",
    );
  }
  // rt702-R3 (WP-703): the advisory judge must be a supported 5.6 candidate —
  // refuse a retired-baseline-family id BEFORE any spawn (intake/preflight/…).
  assertBakeoffJudgeSupported(judgeModel);
  const judge = { model: judgeModel, effort: opts.judgeEffort ?? DEFAULT_JUDGE_EFFORT };
  const overrides = opts.overrides ?? {};

  // WP-703: a run is EITHER a draft-intake run OR a no-draft corpus run.
  const corpusMode = opts.corpus !== undefined;
  if (corpusMode && opts.draftPath) {
    throw new Error("model-bakeoff: pass EITHER --draft OR a corpus run spec, never both.");
  }
  if (!corpusMode && !opts.draftPath) {
    throw new Error("model-bakeoff: a draft (--draft) or a corpus run spec is required.");
  }
  // The chapter subset under test: from the corpus spec (no-draft) or --chapters.
  const requestedChapters = corpusMode
    ? [...new Set(opts.corpus!.chapters)].sort((a, b) => a - b)
    : opts.chapters;
  if (corpusMode && (requestedChapters === undefined || requestedChapters.length === 0)) {
    throw new Error("model-bakeoff: a corpus run requires a non-empty chapter subset (compare-only).");
  }

  // Identity + run root. A draft run derives its default run id from the draft
  // hash (a re-paste resumes the same run); a corpus run derives a stable id from
  // the book + frozen chapter subset (the sealed corpus is the run's identity).
  const bookId = normSlug(
    corpusMode ? opts.corpus!.bookId : (opts.bookId ?? resolveBookIdForDraft(opts.draftPath!, overrides, opts.extractor)),
  );
  let runId: string;
  if (opts.runId) {
    runId = opts.runId;
  } else if (corpusMode) {
    runId = `bo-corpus-${bookId}-ch${requestedChapters!.map((n) => String(n).padStart(2, "0")).join("-")}`;
  } else {
    runId = `bo-${sha256File(resolve(opts.draftPath!)).slice(0, 10)}`;
  }
  const roots = bakeoffRoots(bookId, runId, opts.stateRoot);

  let manifest = readManifest(roots);
  if (!manifest) {
    manifest = {
      schemaVersion: BAKEOFF_MANIFEST_SCHEMA,
      runId,
      bookId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      candidates: models.map((model, i) => ({ model, slug: modelSlug(model), slot: `w${i + 1}`, effort })),
      judge,
      maxParallel: Math.max(1, opts.maxParallel ?? 3),
      publish: opts.publish === true,
      blindMap: {},
      completedPhases: [],
    };
  } else {
    // A resumed run keeps its recorded candidate set; a DIFFERENT --models list
    // under the same run id is an operator error, not a silent re-mix.
    const recorded = manifest.candidates.map((c) => c.model);
    if (opts.models?.length && JSON.stringify([...models].sort()) !== JSON.stringify([...recorded].sort())) {
      throw new Error(`run ${runId} already compares [${recorded.join(", ")}] — pass a new --run-id to compare a different model set`);
    }
    manifest.publish = opts.publish === true;
  }
  // --force re-opens everything downstream of the frozen shared inputs: the
  // candidates regenerate, and every derived decision (validation, blinded
  // reviews, selection, promotion, QC, report) recomputes from the fresh bytes.
  // Intake/research/freeze stay — the comparison inputs are still the run's
  // identity. Canonical safety is unchanged: a re-promotion of different bytes
  // over an existing canonical book still fails closed in promoteWinner.
  if (opts.force) {
    manifest.completedPhases = manifest.completedPhases.filter((p) => ["intake", "research", "freeze", "preflight"].includes(p));
    manifest.selection = undefined;
    manifest.promotion = undefined;
    manifest.qc = undefined;
  }
  const specs = manifest.candidates;

  if (opts.plan) {
    const sourceLine = corpusMode
      ? `  corpus: ${bookId} chapters ${requestedChapters!.join(", ")} (manifest ${opts.corpus!.manifestPath ?? "docs/v25/bakeoff-corpus-v1/corpus-manifest.json"}) — no draft`
      : `  draft: ${opts.draftPath} (sha256 ${sha256File(resolve(opts.draftPath!)).slice(0, 16)})`;
    const planLines = [
      `[bakeoff] PLAN for ${bookId} (run ${runId})`,
      sourceLine,
      `  candidates: ${specs.map((s) => `${s.model} @ ${s.effort} → work/${s.slot}`).join("; ")}`,
      `  judge (fixed): ${judge.model} @ ${judge.effort}`,
      `  publish: ${manifest.publish ? "true (verified publish path after formal QC)" : "false (halt at ready-to-publish)"}`,
      `  run root: ${pipelineRel(roots.runRoot)}`,
      `  phases: intake → research → freeze → preflight → candidates → validate → review → select → promote → qc → report`,
      `  completed so far: ${manifest.completedPhases.join(", ") || "(none)"}`,
    ];
    for (const l of planLines) log(l);
    return { status: "plan", bookId, runId, winner: manifest.selection?.winner ?? null };
  }

  const lockFactory = opts.acquireLock ?? ((id: string) => acquireBookLock(resolve(PIPELINE_DIR, "state", "autopilot-locks"), id));
  const lock = lockFactory(bookId);
  if (!lock.ok) {
    return { status: "halt", bookId, runId, winner: null, reason: `another run holds the ${bookId} lock (${lock.heldBy ?? "unknown owner"}) — remove state/autopilot-locks/${bookId}.lock only if you are sure it is stale.` };
  }
  const heartbeat = (): boolean => (lock.refresh ? lock.refresh() : true);
  const halt = (reason: string): BakeoffOutcome => {
    manifest!.haltReason = reason;
    writeManifest(roots, manifest!);
    log(`[bakeoff] HALT: ${reason}`);
    return { status: "halt", bookId, runId, winner: manifest!.selection?.winner ?? null, reason };
  };

  try {
    writeManifest(roots, manifest);

    // ── Phase: intake ─────────────────────────────────────────────────────────
    if (!phaseDone(manifest, "intake")) {
      if (corpusMode) {
        // No-draft corpus intake: verify the sealed packet is bakeoff-ready, the
        // target unit's authoringSource is resolved, and the shared inputs exist.
        // Fail CLOSED (halt) with a truthful message when not-ready.
        log(`[bakeoff] corpus-intake: ${bookId} chapters ${requestedChapters!.join(", ")}`);
        try {
          manifest.corpusIntake = intakeCorpus({
            bookId,
            chapters: requestedChapters!,
            manifestPath: opts.corpus!.manifestPath,
            deps: opts.corpus!.intakeDeps,
          });
        } catch (err) {
          return halt(`corpus intake refused: ${(err as Error).message}`);
        }
        log(`[bakeoff] corpus-intake: ${manifest.corpusIntake.units.length} unit(s) ready from corpus ${manifest.corpusIntake.corpusId} (${manifest.corpusIntake.sharedInputCount} shared inputs on disk)`);
      } else {
        log(`[bakeoff] intake: ${opts.draftPath}`);
        manifest.intake = intakeDraft(opts.draftPath!, roots, overrides, opts.extractor);
        log(`[bakeoff] intake: "${manifest.intake.title ?? "(title unresolved)"}"${manifest.intake.author ? ` by ${manifest.intake.author}` : ""} → bookId ${manifest.intake.bookId} (identity ${manifest.intake.identityConfident ? "confident" : "PROVISIONAL"})`);
      }
      markDone(roots, manifest, "intake");
    }
    // Undefined on a corpus run (its no-draft record is manifest.corpusIntake);
    // the draft-only fields below are guarded by !corpusMode / `intake &&`.
    const intake = manifest.intake;

    // ── Phase: research (ONCE, draft-grounded, existing handoff contract) ────
    // A corpus run has NO draft to ground research in — its research + compile
    // outputs are already frozen on disk, so the draft-research phase is skipped
    // idempotently (never a spawn).
    if (!phaseDone(manifest, "research")) {
      if (corpusMode || deps.expectedChapterNumbers(bookId).length > 0) {
        log(`[bakeoff] research: ${corpusMode ? "corpus run — research is frozen on disk" : "chapter index already exists"} — reusing existing research (shared across all candidates)`);
      } else if (!intake) {
        return halt("draft-intake record is missing — cannot run draft-grounded research");
      } else {
        const outcome = await doDraftResearch(bookId, intake.storedTextRelPath, intake.title, intake.author, deps, log);
        if (outcome) return halt(outcome);
      }
      markDone(roots, manifest, "research");
    }

    // ── Phase: freeze (compile chain once + hash everything) ─────────────────
    // A corpus run's research/compile outputs are ALREADY frozen on disk, so the
    // compile chain (and its bounded source-repair spawns) is skipped — the phase
    // only re-hashes the existing shared inputs. This keeps the corpus run
    // strictly model-free and never regenerates canonical compile state.
    if (!phaseDone(manifest, "freeze")) {
      if (corpusMode) {
        log(`[bakeoff] freeze: corpus run — research/compile already frozen on disk; hashing the existing shared inputs (no compile chain, no source-repair)`);
      } else {
        const src = await ensureSourceReady(bookId, deps, log, heartbeat);
        if (src) return halt(src);
        for (const verb of [
          ["compile-source-packets"], ["source-packet-gate"],
          ["compile-book-design"], ["book-design-gate"],
          ["compile-chapter-briefs"], ["chapter-brief-gate"],
        ]) {
          const r = await deps.runVerb([...verb, bookId]);
          if (r.code !== 0) return halt(`compile step '${verb[0]}' failed:\n${(r.stdout || r.stderr).slice(0, 1600)}`);
          log(`[bakeoff] freeze: ${verb[0]} ok`);
        }
      }
      const indexChapters = deps.expectedChapterNumbers(bookId);
      let chapterNumbers = indexChapters;
      if (requestedChapters?.length) {
        const bad = requestedChapters.filter((n) => !indexChapters.includes(n));
        if (bad.length > 0) {
          return halt(`${corpusMode ? "corpus" : "--chapters"} names chapters not in the index: ${bad.join(", ")} (the index has ${indexChapters.join(", ")})`);
        }
        chapterNumbers = [...new Set(requestedChapters)].sort((a, b) => a - b);
      }
      manifest.freeze = stages.freezeInputs(bookId, chapterNumbers);
      log(`[bakeoff] freeze: ${manifest.freeze.files.length} shared inputs frozen (combined ${manifest.freeze.combinedSha256.slice(0, 16)}); ${chapterNumbers.length} chapters; card templates hashed`);
      markDone(roots, manifest, "freeze");
    }
    const freeze = manifest.freeze!;
    // A resumed run keeps its FROZEN chapter set; a different chapter subset
    // under the same run id is an operator error, never a silent re-mix.
    if (requestedChapters?.length) {
      const wanted = [...new Set(requestedChapters)].sort((a, b) => a - b);
      if (JSON.stringify(wanted) !== JSON.stringify(freeze.chapterNumbers)) {
        throw new Error(`run ${runId} froze chapters [${freeze.chapterNumbers.join(", ")}] — pass a new --run-id to compare a different chapter subset`);
      }
    }
    // COMPARE-ONLY: a chapter subset can answer "which model writes better" but
    // must never become a partial canonical book — promotion/QC/publish are
    // skipped after selection, by construction rather than by flag. A corpus run
    // is ALWAYS compare-only (a sealed-corpus band-reachability probe is never
    // promoted/published), independent of how many chapters it froze.
    const fullIndexCount = deps.expectedChapterNumbers(bookId).length;
    const compareOnly = corpusMode || (fullIndexCount > 0 && freeze.chapterNumbers.length < fullIndexCount);

    // ── Phase: preflight (models must exist BEFORE expensive generation) ─────
    if (!phaseDone(manifest, "preflight")) {
      const probes = [...specs.map((s) => s.model), judge.model];
      const results: Array<{ model: string; ok: boolean; detail: string }> = [];
      for (const model of probes) {
        const r = await preflightModel(model, deps);
        results.push(r);
        log(`[bakeoff] preflight: ${model} → ${r.ok ? "ok" : `FAILED (${r.detail})`}`);
      }
      manifest.preflight = { checkedAt: new Date().toISOString(), codexVersion: deps.codexVersion(), models: results };
      writeManifest(roots, manifest);
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        return halt(
          `model preflight failed — refusing to start generation. ` +
          failed.map((f) => `${f.model}: ${f.detail}`).join(" | ") +
          `. Check the Codex workspace entitlement for the failed model id(s); no model is silently substituted.`,
        );
      }
      markDone(roots, manifest, "preflight");
    }

    // ── Phase: candidates (isolated complete books) ──────────────────────────
    if (!phaseDone(manifest, "candidates")) {
      const drift = stages.verifyInputs(freeze);
      if (drift.length > 0) return halt(`shared inputs drifted BEFORE generation:\n- ${drift.join("\n- ")}`);
      await mapPool(specs, manifest.maxParallel, async (spec) => {
        const prior = readJsonIf<CandidateStateV1>(generationPath(roots, spec.slug));
        if (!opts.force && prior?.status === "complete") {
          log(`[bakeoff] ${spec.model}: generation already complete — reusing (resume)`);
          return;
        }
        log(`[bakeoff] ${spec.model}: generating ${freeze.chapterNumbers.length} chapters into work/${spec.slot} (@ ${spec.effort})`);
        await stages.generate(bookId, spec, deps, roots, {
          chapterNumbers: freeze.chapterNumbers,
          chapterParallel: Math.max(1, opts.chapterParallel ?? 2),
          force: opts.force,
          prior,
          heartbeat,
          log,
        }, (state) => {
          mkdirSync(candidateDir(roots, spec.slug), { recursive: true });
          writeFileAtomic(generationPath(roots, spec.slug), JSON.stringify(state, null, 2) + "\n");
        });
      });
      const postDrift = stages.verifyInputs(freeze);
      if (postDrift.length > 0) return halt(`shared inputs drifted DURING generation (comparison invalidated):\n- ${postDrift.join("\n- ")}`);
      markDone(roots, manifest, "candidates");
    }

    // ── Phase: validate (existing deterministic batteries; no QC rounds) ─────
    if (!phaseDone(manifest, "validate")) {
      for (const spec of specs) {
        persistCandidateChapters(roots, spec, bookId, freeze.chapterNumbers);
        const inputs = { ...defaultValidateInputs(), chapterNumbers: freeze.chapterNumbers };
        const validation = await stages.validate(bookId, spec, roots, inputs);
        writeFileAtomic(validationPath(roots, spec.slug), JSON.stringify(validation, null, 2) + "\n");
        log(`[bakeoff] validate ${spec.model}: ${validation.hardFailures.length === 0 ? "clean" : `${validation.hardFailures.length} hard failure(s)`} (book-gate ${validation.bookGatePassed ? "PASS" : "FAIL"}, rubric ${validation.rubricVerdict})`);
      }
      markDone(roots, manifest, "validate");
    }

    // ── Phase: review — PRIMARY D7 judge + NON-BLOCKING codex advisory ───────
    // The primary selection metric is the Claude-side D7 rubric-audit composite
    // (stages.d7Judge). The codex whole-book panel (stages.review) is retained as
    // a recorded, non-blocking advisory (WP-702) — its failure never fails the run.
    if (Object.keys(manifest.blindMap).length === 0) {
      manifest.blindMap = assignBlindLabels(specs, deps.rng);
      writeManifest(roots, manifest);
    }
    const labelOf = (model: string): string => {
      const found = Object.entries(manifest!.blindMap).find(([, m]) => m === model);
      if (!found) throw new Error(`no blind label for ${model}`);
      return found[0];
    };
    const calibrationUnit = opts.calibrationUnit ?? DEFAULT_D7_CALIBRATION_UNIT;
    // rt702 R1: the hidden calibration reference MUST be disjoint from the book
    // under test. On a collision the candidate's raw records shadow the
    // calibration pass (same unit id), its adjudication is never written, and
    // EVERY candidate dies with an opaque "audit incomplete" — a config error
    // masquerading as model failure. Refuse loudly before any D7 spend.
    if (calibrationUnit.startsWith(`${bookId}-ch`)) {
      return halt(
        `D7 calibration unit "${calibrationUnit}" belongs to the book under test (${bookId}) — the hidden ` +
          `calibration reference must come from a DIFFERENT book. Pass calibrationUnit with a disjoint sealed reference.`,
      );
    }
    if (!phaseDone(manifest, "review")) {
      const forbidden = forbiddenReviewTokens(specs);
      for (const spec of specs) {
        const label = labelOf(spec.model) as BlindLabel;
        const generation = readJsonIf<CandidateStateV1>(generationPath(roots, spec.slug));
        const validation = readJsonIf<CandidateValidationV1>(validationPath(roots, spec.slug));
        if (generation?.status !== "complete" || !validation || validation.hardFailures.length > 0) {
          log(`[bakeoff] review: skipping ${spec.model} (label ${label}) — ineligible on the deterministic floor before the D7 judge (${generation?.status !== "complete" ? "incomplete book" : "deterministic hard failures"})`);
          continue;
        }
        const chapters = loadSlotChapters(roots, spec.slot);
        const contentSha = combinedContentHash(chapters);
        if (!heartbeat()) return halt("lost the run lock during review");

        // PRIMARY: the D7 rubric-audit judge (Claude-side, blinded, leak-checked).
        const priorD7 = readJsonIf<CandidateD7JudgmentV1>(d7JudgePath(roots, label));
        if (opts.force || !priorD7 || priorD7.contentSha256 !== contentSha) {
          log(`[bakeoff] d7-judge: label ${label} — driving the Claude-side D7 rubric-audit over ${chapters.length} blinded chapter(s)`);
          const d7 = await stages.d7Judge(bookId, label, chapters, deps, roots, {
            runId, forbidden, calibrationUnit, repositoryRoot: REPOSITORY_ROOT, log, heartbeat,
          });
          mkdirSync(resolve(roots.reviewsDir, label), { recursive: true });
          writeFileAtomic(d7JudgePath(roots, label), JSON.stringify(d7, null, 2) + "\n");
        } else {
          log(`[bakeoff] d7-judge: label ${label} already judged at these bytes — reusing (resume)`);
        }

        // ADVISORY (non-blocking): the codex whole-book panel read. A failure here
        // is recorded but NEVER fails the run or changes selection.
        const prior = readJsonIf<CandidateReviewV1>(reviewPath(roots, label));
        if (!opts.force && prior && prior.contentSha256 === contentSha) {
          log(`[bakeoff] advisory review: label ${label} already read at these bytes — reusing (resume)`);
        } else {
          log(`[bakeoff] advisory review: label ${label} — ${chapters.length} blinded chapter reads + 2 whole-book reads (advisory judge ${judge.model} @ ${judge.effort}; non-blocking)`);
          try {
            await stages.review(bookId, label, chapters, deps, roots, {
              runId,
              judge,
              forbidden,
              heartbeat,
              log,
              chapterParallel: Math.max(1, opts.chapterParallel ?? 2),
            });
          } catch (error) {
            log(`[bakeoff] advisory review: label ${label} FAILED (non-blocking, recorded): ${(error as Error).message}`);
          }
        }
      }
      markDone(roots, manifest, "review");
    }

    // ── Phase: select (PRIMARY = D7 composite; codex read is advisory only) ──
    const selectionInputs: SelectionInputs = specs.map((spec) => ({
      spec,
      label: labelOf(spec.model),
      generation: readJsonIf<CandidateStateV1>(generationPath(roots, spec.slug)),
      validation: readJsonIf<CandidateValidationV1>(validationPath(roots, spec.slug)),
      review: readJsonIf<CandidateReviewV1>(reviewPath(roots, labelOf(spec.model))),
      d7: readJsonIf<CandidateD7JudgmentV1>(d7JudgePath(roots, labelOf(spec.model))),
      // WP-E32: null on every run today (no evaluator writer wired yet) ⇒
      // selectWinner stays in its legacy D7-primary mode (byte-stable).
      evalDiagnostic: readJsonIf<CandidateEvalDiagnosticV1>(evalDiagnosticPath(roots, labelOf(spec.model))),
    }));
    if (!phaseDone(manifest, "select")) {
      // WP-E00 freeze / V25-AUD-03: a FINAL selection requires every candidate
      // still in the running (floor-eligible) to be D7-terminal (judged or
      // instrument-fail). Anything else mints a PROVISIONAL selection — NOT
      // evidence, per SelectionV1's own comment — and leaves "select" incomplete
      // so the NEXT resume re-derives it from whatever D7 records exist by then;
      // it never re-marks done on a stale provisional read.
      const allTerminal = selectionInputs.every(
        (i) => !floorEligible(i.generation, i.validation) || isD7Terminal(i.d7),
      );
      const sel = selectWinner(selectionInputs);
      if (!allTerminal) {
        const entries = readCallLedgerEntries(PIPELINE_DIR, bookId, runId);
        sel.provisional = true;
        sel.ledgerHighWaterAt = entries.reduce<string | null>((newest, e) => (newest === null || e.at > newest ? e.at : newest), null);
      }
      manifest.selection = sel;
      mkdirSync(roots.selectionDir, { recursive: true });
      writeFileAtomic(resolve(roots.selectionDir, "selection.json"), JSON.stringify(manifest.selection, null, 2) + "\n");
      for (const r of manifest.selection.reasons) log(`[bakeoff] select: ${r}`);
      if (!allTerminal) {
        const pending = selectionInputs.filter((i) => floorEligible(i.generation, i.validation) && !isD7Terminal(i.d7)).map((i) => i.spec.model);
        log(`[bakeoff] select: PROVISIONAL — not every candidate is D7-terminal yet (still pending: ${pending.join(", ") || "none named"}); nothing promoted or published; the next resume re-derives this selection.`);
        return halt(`selection is PROVISIONAL (not evidence) — still D7-pending: ${pending.join(", ") || "none named"}. Re-run once every candidate reaches judged/instrument-fail to mint a final selection.`);
      }
      markDone(roots, manifest, "select");
    }
    const selection = manifest.selection!;
    if (!selection.winner) {
      finishReport(roots, manifest, selectionInputs, "not started (no eligible winner)", "not published", deps);
      return halt("no eligible candidate — nothing was promoted or published. See the report for per-candidate disqualifications.");
    }
    const winnerSpec = specs.find((s) => s.model === selection.winner)!;

    // ── Compare-only exit (chapter subset): selection + report, no promotion ──
    if (compareOnly) {
      log(`[bakeoff] compare-only: the frozen chapter set (${freeze.chapterNumbers.join(", ")}) is a subset of the book's ${fullIndexCount}-chapter index — a partial book is never promoted, QC'd, or published. Winner: ${selection.winner}.`);
      const { jsonPath, mdPath } = finishReport(
        roots, manifest, selectionInputs,
        "not run (compare-only chapter-subset run)",
        "not applicable (compare-only chapter-subset run)",
        deps,
      );
      markDone(roots, manifest, "report");
      return { status: "compared", bookId, runId, winner: selection.winner, reportJsonPath: jsonPath, reportMdPath: mdPath };
    }

    // ── Phase: promote (the ONLY canonical crossing) ─────────────────────────
    if (!phaseDone(manifest, "promote")) {
      const winnerState = readJsonIf<CandidateStateV1>(generationPath(roots, winnerSpec.slug));
      if (!winnerState) return halt("winner generation record missing — cannot promote");
      const candidateChapterHashes: Record<string, Record<string, string | null>> = {};
      for (const spec of specs) {
        const st = readJsonIf<CandidateStateV1>(generationPath(roots, spec.slug));
        candidateChapterHashes[spec.model] = Object.fromEntries(
          (st?.chapters ?? []).map((c) => [`ch${String(c.chapterNumber).padStart(2, "0")}`, c.contentSha256]),
        );
      }
      manifest.promotion = stages.promote({
        bookId,
        manifest,
        winner: winnerSpec,
        winnerState,
        roots,
        candidateChapterHashes,
        log,
      });
      writeManifest(roots, manifest);
      // The complete deterministic preflight, re-run on the CANONICAL bytes.
      const converge = await deps.runVerb(["qc-converge", bookId]);
      if (converge.code !== 0) {
        return halt(`post-promotion deterministic preflight (qc-converge) is not clean:\n${(converge.stdout || converge.stderr).slice(0, 1800)}`);
      }
      log(`[bakeoff] promote: qc-converge clean on canonical bytes`);
      markDone(roots, manifest, "promote");
    }

    // ── Publication identity gate (one concise question, never a guess) ──────
    let publishAuthorized = manifest.publish;
    let publicationQuestion: string | undefined;
    // Only a draft run reaches here (a corpus run is compare-only and returned
    // above); `intake` is therefore set, but guard the type explicitly.
    if (manifest.publish && intake && !intake.identityConfident) {
      publishAuthorized = false;
      publicationQuestion =
        `Publication identity is unconfirmed: is the book "${intake.title ?? "(unknown title)"}" by ` +
        `${intake.author ?? "(unknown author)"} (bookId ${bookId})? Re-run with --title/--author (or confirm and re-run with --publish) to publish.`;
      log(`[bakeoff] publish gate: ${publicationQuestion}`);
    }

    // ── Phase: qc (delegated to the existing conductor + verified publisher) ──
    if (!phaseDone(manifest, "qc")) {
      // Release OUR lock — book-autopilot takes its own on the same book.
      lock.release();
      // WP-301: the CHAPTERFLOW_AUTHOR_MODEL/EFFORT env surface was deleted — the
      // production author (write + repair) now resolves from the central model
      // policy (resolveRoute, tier="normal-profile"), so a cross-process env pin
      // can no longer steer the delegated subprocess. Formal QC repairs therefore
      // run the policy-resolved production author; the winner is still measured on
      // its first-write candidate (candidates.ts pins opts.model per candidate).
      log(`[bakeoff] formal QC: delegating to book-autopilot ${bookId} --author${publishAuthorized ? "" : " --no-publish"} (repairs authored by the central model policy; winner ${winnerSpec.model} measured on its first write; reviewers stay independent)`);
      const args = ["book-autopilot", bookId, "--author", ...(publishAuthorized ? [] : ["--no-publish"])];
      const r = await deps.delegate(args, {}, (line) => log(line));
      const tail = (r.stdout || r.stderr).trim().split("\n").slice(-12).join("\n");
      manifest.qc = {
        startedAt: new Date().toISOString(),
        outcome: r.code === 0 ? (publishAuthorized ? "published-or-ready (autopilot exit 0)" : "ready (autopilot exit 0, publish withheld)") : `halt (autopilot exit ${r.code})`,
        publishAuthorized,
        detail: tail,
      };
      writeManifest(roots, manifest);
      if (r.code !== 0) {
        finishReport(roots, manifest, selectionInputs, manifest.qc.outcome, "not published (QC did not converge)", deps);
        return halt(`formal QC did not converge honestly — the bake-off artifacts are preserved. Autopilot tail:\n${tail}`);
      }
      markDone(roots, manifest, "qc");
    }

    // ── Phase: report ─────────────────────────────────────────────────────────
    const publishOutcome = manifest.qc?.publishAuthorized
      ? "published via the existing verified publish path (see autopilot output)"
      : publicationQuestion
        ? "withheld: publication identity unconfirmed"
        : manifest.publish
          ? "withheld"
          : "not requested (PUBLISH=false) — book is verified ready-to-publish";
    const { jsonPath, mdPath } = finishReport(roots, manifest, selectionInputs, manifest.qc?.outcome ?? "unknown", publishOutcome, deps);
    markDone(roots, manifest, "report");

    return {
      status: manifest.qc?.publishAuthorized ? "published" : "ready",
      bookId,
      runId,
      winner: selection.winner,
      reportJsonPath: jsonPath,
      reportMdPath: mdPath,
      publicationQuestion,
    };
  } finally {
    lock.release();
  }
}

function finishReport(
  roots: BakeoffRoots,
  manifest: BakeoffManifestV1,
  selectionInputs: SelectionInputs,
  qcOutcome: string,
  publishOutcome: string,
  deps: BakeoffDeps,
): { jsonPath: string; mdPath: string } {
  const inputs: ReportInputs = {
    manifest,
    roots,
    candidates: selectionInputs.map((s) => ({
      model: s.spec.model,
      label: s.label,
      generation: s.generation,
      validation: s.validation,
      review: s.review,
      d7: s.d7,
    })),
    selection: manifest.selection ?? null,
    qcOutcome,
    publishOutcome,
    codexVersion: manifest.preflight?.codexVersion ?? deps.codexVersion(),
  };
  return writeReports(inputs);
}

// ── Draft-grounded research (the existing research contract, seeded) ─────────

const RESEARCH_MAX_PASSES = 2;

export function buildDraftResearchTask(
  bookId: string,
  draftTextRelPath: string,
  title: string | null,
  author: string | null,
  basePrompt: string,
  pass: number,
  previousNote = "",
): string {
  return `${basePrompt}

---
AUTOPILOT RESEARCH TASK (MODEL-BAKEOFF DRAFT INTAKE)
bookId: ${bookId}
pass: ${pass}/${RESEARCH_MAX_PASSES}

You are already running from the ChapterFlow pipeline root. Do NOT cd into an old v21/v22 folder. Do NOT write chapters, QC, or publish.

DRAFT SOURCE (primary)
The operator supplied the book's manuscript draft. Its extracted text is at:
  ${draftTextRelPath}
Treat the DRAFT as the PRIMARY source text: derive the chapter index (table of contents) and every source-v2 sidecar's concepts, testable facts, named examples, and frameworks from the draft itself. Read it fully before writing any sidecar. Use live web research ONLY to verify real-world entities the draft names (people, studies, institutions) — never to replace draft material with outside material. Do not modify the draft file.
${title ? `Known title: ${title}` : "Title: infer from the draft, verify before writing the index."}${author ? `\nKnown author: ${author}` : "\nAuthor: infer from the draft if stated; leave provisional otherwise."}
${previousNote}
MANDATORY HANDOFF CONTRACT
Continue running the research/next-task loop until BOTH are true:
1. state/indexes/${bookId}.json exists and contains the full chapter list.
2. book-status reports phase write-chapter OR generating.
Stop immediately after the handoff contract is satisfied.`;
}

async function doDraftResearch(
  bookId: string,
  draftTextRelPath: string,
  title: string | null,
  author: string | null,
  deps: BakeoffDeps,
  log: (m: string) => void,
): Promise<string | null> {
  const promptPath = resolve(PIPELINE_DIR, "agent-prompts", "RESEARCH-CODEX-SESSION.md");
  const basePrompt = deps.readTask(promptPath);
  let previousNote = "";
  for (let pass = 1; pass <= RESEARCH_MAX_PASSES; pass++) {
    const task = buildDraftResearchTask(bookId, draftTextRelPath, title, author, basePrompt, pass, previousNote);
    log(`[bakeoff] research: draft-grounded research session ${pass}/${RESEARCH_MAX_PASSES}`);
    const passStartMs = Date.now();
    const r = await deps.spawn({
      task,
      role: "bakeoff-aux",
      sessionId: deps.mkSessionId(pass === 1 ? "bakeoff-research" : `bakeoff-research-retry-${pass}`),
      cwd: PIPELINE_DIR,
      sandbox: "workspace-write",
      writableRoots: [resolve(PIPELINE_DIR, ".chapterflow")],
      timeoutMs: RESEARCH_TIMEOUT_MS,
      reasoningEffort: "high",
    });
    try { deps.logSession(bookId, "bakeoff-research", r); } catch { /* best-effort */ }
    if (!r.ok) return `research session exited ${r.exitCode} before creating the chapter index:\n${(r.stderr || r.stdout).slice(0, 1600)}`;
    if (deps.expectedChapterNumbers(bookId).length > 0) {
      const violation = deps.researchFreshness(bookId, passStartMs);
      if (!violation) return null;
      previousNote = `\nPREVIOUS RESEARCH SESSION FAILED THE FRESHNESS CHECK: ${violation}\nProduce the chapter index and source-v2 sidecars FRESH from the DRAFT in THIS session — restoring archived runs is a task failure.\n`;
      log(`[bakeoff] research: pass ${pass} failed the freshness check: ${violation}`);
      continue;
    }
    previousNote = `\nPREVIOUS RESEARCH SESSION EXITED 0 WITHOUT SATISFYING THE HANDOFF CONTRACT (no chapter index).\n`;
    log(`[bakeoff] research: pass ${pass} did not create state/indexes/${bookId}.json`);
  }
  return `research did not produce the chapter index after ${RESEARCH_MAX_PASSES} draft-grounded sessions — inspect the draft extraction (${draftTextRelPath}) and re-run.`;
}

/** Bounded source-readiness loop before compile (mirrors the autopilot's
 *  prewrite gate + repair sessions, reusing its exported repair task). */
async function ensureSourceReady(bookId: string, deps: BakeoffDeps, log: (m: string) => void, heartbeat: () => boolean): Promise<string | null> {
  for (let attempt = 0; attempt <= SOURCE_REPAIR_MAX_PASSES; attempt++) {
    if (!heartbeat()) return "lost the run lock during source readiness";
    const gate = await deps.runVerb(["source-v2-gate", bookId, "--prewrite"]);
    if (gate.code === 0) return null;
    const report = (gate.stdout || gate.stderr).trim();
    if (attempt === SOURCE_REPAIR_MAX_PASSES) {
      return `source-v2 sidecars are not authoring-ready after ${SOURCE_REPAIR_MAX_PASSES} repair passes:\n${report.slice(0, 1800)}`;
    }
    log(`[bakeoff] source gate not ready (attempt ${attempt + 1}) — spawning one bounded source-repair session`);
    const r = await deps.spawn({
      task: buildSourcePrewriteRepairTask(bookId, report.slice(0, 6000), attempt + 1, SOURCE_REPAIR_MAX_PASSES),
      role: "bakeoff-aux",
      sessionId: deps.mkSessionId(`bakeoff-source-repair-${attempt + 1}`),
      cwd: PIPELINE_DIR,
      sandbox: "workspace-write",
      writableRoots: [resolve(PIPELINE_DIR, ".chapterflow")],
      timeoutMs: RESEARCH_TIMEOUT_MS,
      reasoningEffort: "high",
    });
    try { deps.logSession(bookId, "bakeoff-source-repair", r); } catch { /* best-effort */ }
  }
  return null;
}

// ── Model preflight ───────────────────────────────────────────────────────────

export async function preflightModel(model: string, deps: Pick<BakeoffDeps, "spawn" | "mkSessionId">): Promise<{ model: string; ok: boolean; detail: string }> {
  try {
    const r = await deps.spawn({
      task: "Reply with exactly: MODEL-OK",
      role: "bakeoff-aux",
      sessionId: deps.mkSessionId(`bakeoff-preflight-${modelSlug(model)}`),
      cwd: PIPELINE_DIR,
      sandbox: "read-only",
      skipGitRepoCheck: true,
      model,
      timeoutMs: PREFLIGHT_TIMEOUT_MS,
    });
    if (r.ok && /MODEL-OK/.test(r.finalMessage + r.stdout)) return { model, ok: true, detail: "responded" };
    return { model, ok: false, detail: `exit ${r.exitCode}: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" / ").slice(0, 300) || "no MODEL-OK response"}` };
  } catch (err) {
    return { model, ok: false, detail: (err as Error).message.slice(0, 300) };
  }
}

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
