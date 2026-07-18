/**
 * Stage-1 SCREENING core (protocol docs/v25/implementation/V25_CHAPTER_EXPERIMENT_PROTOCOL.md
 * §5 Stage-1 row; plan docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md §5,
 * hierarchy §3: E-audit PRIMARY, D7-lite SECONDARY signs-only).
 *
 * One INVOCATION = one (block, replicate) cell of the registered Stage-1 grid:
 * 3 blocks (nudge-ch03 / made-to-stick-ch04 / the-happiness-hypothesis-ch06) ×
 * 2 replicates (r1 / r2) = 6 invocations. Per invocation this module:
 *
 *   1. AUTHORING — drives the corpus compare-only `runBakeoff` for the block
 *      with `manifest.readabilityMeasureOnly = true` (floor-failed drafts are
 *      PRESERVED — measure-only lane, protocol §5.4 frozen control). Candidates
 *      are the registered xhigh trio (SCREENING_PLAN conductor invocation),
 *      slot-isolated, blind label map sealed in the run manifest.
 *      PHASE CONTROL (design choice, recorded): the conductor's phase ladder is
 *      driven intake→research→freeze→candidates→validate with the legacy
 *      review/D7/select machinery NEUTRALIZED via the injected `stages` seam —
 *      `stages.review` is a recording no-op (Stage-1 budgets ZERO advisory-judge
 *      sessions) and `stages.d7Judge` returns a PENDING judgment (no dispatch),
 *      so the select phase mints a PROVISIONAL selection and the conductor
 *      halts itself ("selection is PROVISIONAL") leaving `select` incomplete.
 *      A LATER resume pass (step 4) re-derives the selection from the
 *      by-then-written evaluator diagnostics — the existing terminal-gated path,
 *      byte-untouched.
 *   2. E-AUDITS (PRIMARY) — per candidate slot draft (floor-failed included), a
 *      blind 1-chapter package + `runChapterDiagnostic` (2 blind raters + fresh
 *      adjudicator, real Sol-ultra sessions in production). The adjudicated
 *      `CandidateEvalDiagnosticV1` is written to the EXACT location the
 *      conductor's select phase reads (`reviews/<label>/eval-diagnostic.json`,
 *      runBakeoff.ts `evalDiagnosticPath`) so `selectWinner` enters its
 *      evaluator-primary mode (WP-E32).
 *   3. D7-LITE (SECONDARY, replicate r1 ONLY) — one single-rater Sol-ultra
 *      primary-role rubric-audit session per candidate over the candidate's own
 *      audit package (buildRubricAuditBatch WITH the candidate chapter), plus
 *      ONE per-block drift unit via the hidden-calibration branch
 *      (d7liteCore.calibrationOnlyManifest). Derived diagnostics only
 *      (deriveRecordAggregates — atomic ratings are ground truth). Values live
 *      in driver-owned sidecars under `<runRoot>/d7lite/`; the per-label
 *      `reviews/<label>/d7.json` terminal record carries a NULL composite with
 *      an explicit reason (the 3-role D7 instrument is not run in this lane) so
 *      terminal-gated FINAL selection can mint without fabricating a 3-role
 *      composite from a single-rater read.
 *   4. SELECTION — once BOTH replicates of the block carry terminal audits, the
 *      driver resumes each replicate's runBakeoff (model-free pass) to mint the
 *      FINAL selections via the existing terminal-gated path.
 *   5. SCOREBOARD — `buildStage1Scoreboard` aggregates every completed cell BY
 *      BLIND LABEL (never a model name; fail-closed leak scan before write) into
 *      `state/model-bakeoffs/_campaign/stage1/scoreboard-<runHash>.json`.
 *
 * BUDGET (protocol §5.1/§5.2, D-3 amended ceiling 170 TRUE sessions): before
 * EVERY spawn the gate recounts `countTrueSessions` across ALL WP-503 ledger
 * slices (state/run-ledger/**) plus this process's own reservations and
 * hard-halts BEFORE the offending spawn — never a warning, never post-hoc.
 * Stage-1's own registered cap (119, EXPERIMENT_STAGE_BUDGETS stage "1") is
 * enforced the same way; `STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE` and the
 * pre-Stage-2 gate (`checkBudgetBeforeStage2`) are cited in every summary.
 *
 * MODEL-FREE at import/typecheck time. Every live surface is an injected seam
 * (runBakeoffFn / runDiagnosticFn / d7Dispatch / probeGate) — tests inject
 * doubles; the orchestrator runs the defaults live.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import { writeFileAtomic } from "../../src/lib/atomicWrite.js";
import { PIPELINE_DIR, bakeoffRoots, modelSlug, type BakeoffRoots } from "../../src/bakeoff/paths.js";
import {
  readManifest,
  runBakeoff,
  writeManifest,
  type BakeoffDeps,
  type BakeoffOutcome,
  type BakeoffStages,
  type RunBakeoffOptions,
} from "../../src/bakeoff/runBakeoff.js";
import { resolveDeps } from "../../src/orchestrator/autopilot.js";
import {
  BAKEOFF_MANIFEST_SCHEMA,
  type BakeoffManifestV1,
  type BlindLabel,
  type CandidateD7JudgmentV1,
  type CandidateEvalDiagnosticV1,
  type CandidateReviewV1,
  type CandidateSpec,
  type ReasoningEffort,
} from "../../src/bakeoff/types.js";
import {
  EXPERIMENT_BUDGET_PLAN,
  EXPERIMENT_STAGE_BUDGETS,
  SCREENING_PLAN,
  STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE,
  dropProbeFailedConfigs,
  type ReasoningEffortLevel,
  type ScreeningRun,
} from "../../src/bakeoff/screeningPlan.js";
import {
  assignBlindLabels,
  assertNoIdentityLeak,
  combinedContentHash,
  forbiddenReviewTokens,
} from "../../src/bakeoff/review.js";
import { loadSlotChapters } from "../../src/bakeoff/candidates.js";
import { normalizeD7WorkerReturn, type D7WorkerDispatch } from "../../src/bakeoff/d7Judge.js";
import { createD7CodexWorkerDispatch, d7CodexSessionBaseDir } from "../../src/bakeoff/d7WorkerDispatch.js";
import { AuditPackageAssemblyError, assembleAuditPackageFromChapters } from "../../src/bakeoff/auditPackageAssembler.js";
import {
  RUBRIC_CALIBRATION_REFERENCES,
  deriveRecordAggregates,
  materializeRubricAuditBatch,
  rubricAuditDirRelPath,
  type RubricAuditBatchManifestV1,
} from "../../src/bakeoff/migration/rubricAuditInstrument.js";
import { ingestRaterRecord, renderRaterTaskDocument } from "../../src/bakeoff/migration/rubricAuditHarness.js";
import { loadRecord } from "../../src/bakeoff/migration/rubricAuditReceipts.js";
import {
  assertNoModelIdentityLeak,
  runChapterDiagnostic,
  type ChapterDiagnosticRunInput,
  type ChapterDiagnosticRunResult,
  type UltraSessionRunner,
} from "../../src/evaluation/chapterDiagnosticRun.js";
import type { ChapterDiagnosticBookMetadataInput } from "../../src/evaluation/chapterDiagnosticPackage.js";
import { runUltraSession } from "../../src/exec/ultraSession.js";
import {
  appendCallLedgerEntry,
  countTrueSessions,
  readCallLedgerEntries,
  type RunCallLedgerEntryV1,
} from "../../src/telemetry/runCallLedger.js";
import { classifySessionLabel } from "../../src/orchestrator/sessionLedger.js";
import type { ProviderOutcomeV1 } from "../../src/contracts/routeContracts.js";
import type { ChapterV21 } from "../../src/types.js";
import {
  D7LITE_TOLERANCE,
  calibrationOnlyManifest,
  defaultProbeGate,
  toIngestMeta,
  type D7LiteProbeGateResult,
} from "./d7liteCore.mjs";

// ── Registered constants (sources cited; never retyped where a code constant exists) ──

/** Repo git root (four levels up from the pipeline dir) — same derivation every
 *  sibling driver uses. */
export const STAGE1_REPO_ROOT = resolve(PIPELINE_DIR, "../../../..");

/** All stage-1 experiment ledger slices share this runId prefix (stage-cap
 *  attribution across processes/run-hashes). */
export const STAGE1_RUN_ID_PREFIX = "s1x";

/** D-3 amended campaign ceiling — 170 TRUE sessions (EXPERIMENT_BUDGET_PLAN,
 *  screeningPlan.ts; V25_OWNER_DECISIONS.md D-3 amendment). Never retyped. */
export const STAGE1_SESSION_CEILING = EXPERIMENT_BUDGET_PLAN.ceilingCodexOnlyReading;

/** Stage-1's own registered hard cap (planned 84 → cap 119; EXPERIMENT_STAGE_BUDGETS
 *  stage "1" — protocol §5 table). */
export const STAGE1_STAGE_CAP = EXPERIMENT_STAGE_BUDGETS.find((s) => s.stage === "1")!.cap;

/** ABSOLUTE-BAND floors (protocol §4.4 OWNER RULING 2026-07-18): the anchor-keyed
 *  floor FORMULAS are retired (book-score anchoring does not transfer to the
 *  chapter construct — Stage-0b sanity stop); the owner ruled absolute floors.
 *  Anchors remain noise/drift sentinels only. */
export const STAGE1_ADVANCE_FLOOR = 75.0;
export const STAGE1_BLOCK_FLOOR = 65.0;
export const STAGE1_FLOORS_SOURCE =
  "V25_CHAPTER_EXPERIMENT_PROTOCOL.md §4.4 OWNER RULING (2026-07-18): ABSOLUTE-BAND floors — advance 75.0, block 65.0; " +
  "anchor-keyed formulas retired; anchors are drift sentinels only";

/** Equivalence band W (protocol §4.3 + §4.4 OWNER RULING): frozen at 2.0
 *  (measured 2×SD_retest 0.678, clamped to the 2.0 floor). */
export const STAGE1_BAND_W = 2.0;

/** D7-lite's own legacy tolerance (±3.0) — per-instrument noise unit for the
 *  §10.1 interaction analysis (δ_D7 = Δ_D7 / 3.0). */
export const STAGE1_D7LITE_TOLERANCE = D7LITE_TOLERANCE;

/** The incumbent (production default) whose paired Δs the analysis keys on
 *  (protocol §11: per-block paired Δ vs. Sol). The scoreboard NEVER writes this
 *  string — it writes only the incumbent's blind label. */
export const STAGE1_INCUMBENT_MODEL = "gpt-5.6-sol";

export const NOT_A_BOOK_SCORE_NOTE =
  "CHAPTER DIAGNOSTIC — NOT A BOOK SCORE. Blind-by-label Stage-1 screening artifact; the label→model map stays sealed in the per-run manifests.";

const RUN_HASH_RE = /^[a-z0-9][a-z0-9-]*$/;
const EVAL_RATER_LEDGER_STAGE = "eval-rater-dispatch" as const;
const SESSION_TIMEOUT_MS = 45 * 60 * 1000;

export class Stage1DriverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Stage1DriverError";
  }
}

export class Stage1BudgetHalt extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Stage1BudgetHalt";
  }
}

// ── The registered grid ─────────────────────────────────────────────────────────

export type Stage1Replicate = "r1" | "r2";
export const STAGE1_REPLICATES: readonly Stage1Replicate[] = ["r1", "r2"];

export type Stage1Block = {
  unit: string;
  bookId: string;
  chapter: number;
  /** Disjoint sealed calibration reference (rt702-R1) — the block's D7-lite
   *  DRIFT unit, from the registered plan. */
  calibrationUnit: string;
  /** Advisory judge recorded in the manifest for provenance — NEVER spawned in
   *  this lane (the review stage is neutralized; Stage-1 budgets no advisory
   *  sessions). */
  advisoryJudge: { model: string; effort: ReasoningEffortLevel };
  /** The registered xhigh trio (SCREENING_PLAN conductor invocation 0). */
  models: string[];
  effort: ReasoningEffortLevel;
};

/** The 3 registered blocks, resolved from SCREENING_PLAN (never retyped). The
 *  sol@high arm is NOT included — Stage 1b is DROPPED by default (protocol §5). */
export function stage1Blocks(): Stage1Block[] {
  return SCREENING_PLAN.runs.map((run: ScreeningRun) => {
    const trio = run.conductorInvocations.find((i) => i.effort === "xhigh" && i.models.length === 3);
    if (!trio) throw new Stage1DriverError(`registered run ${run.id} has no xhigh trio invocation`);
    return {
      unit: run.unit,
      bookId: run.bookId,
      chapter: run.chapters[0]!,
      calibrationUnit: run.calibrationUnit,
      advisoryJudge: { ...run.advisoryJudge },
      models: [...trio.models],
      effort: trio.effort,
    };
  });
}

export function stage1RunId(runHash: string, unit: string, replicate: Stage1Replicate): string {
  return `${STAGE1_RUN_ID_PREFIX}-${runHash}-${unit}-${replicate}`;
}

/** Planned/worst-case session estimate per invocation (protocol §5 Stage-1 row:
 *  3 author (≤1 in-lane retry) + 3 E-audit cells × 3 roles (≤2 attempts each) +
 *  r1-only D7-lite 3 candidate cells + 1 drift unit, no retry). */
export function invocationSessionEstimate(replicate: Stage1Replicate): { planned: number; worstCase: number } {
  const authoring = { planned: 3, worst: 6 };
  const eAudit = { planned: 9, worst: 18 };
  const d7lite = replicate === "r1" ? { planned: 4, worst: 4 } : { planned: 0, worst: 0 };
  return {
    planned: authoring.planned + eAudit.planned + d7lite.planned,
    worstCase: authoring.worst + eAudit.worst + d7lite.worst,
  };
}

// ── Seeded rng (stable blind-label map across ALL stage-1 runs of a runHash) ───

/** Deterministic rng from a string seed (sfc32 over sha256 words). Used ONLY for
 *  the blind-label shuffle so every stage-1 run of one campaign runHash seals the
 *  SAME label→model map — cross-run aggregation BY LABEL stays meaningful. */
export function seededRng(seed: string): () => number {
  const digest = createHash("sha256").update(seed, "utf8").digest();
  let a = digest.readUInt32LE(0);
  let b = digest.readUInt32LE(4);
  let c = digest.readUInt32LE(8);
  let d = digest.readUInt32LE(12);
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

// ── WP-503 ledger read + the spawn gate ─────────────────────────────────────────

/** Read EVERY WP-503 ledger slice under state/run-ledger/<bookId>/<runId>.jsonl —
 *  the running total is READ, never hardcoded (same idiom as run-invocation.mts). */
export function readAllLedgerEntries(pipelineDir: string): RunCallLedgerEntryV1[] {
  const root = resolve(pipelineDir, "state", "run-ledger");
  const out: RunCallLedgerEntryV1[] = [];
  let bookDirs: string[];
  try {
    bookDirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return out; // no ledger yet ⇒ zero prior spend
  }
  for (const bookId of bookDirs) {
    let files: string[];
    try {
      files = readdirSync(resolve(root, bookId)).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        out.push(...readCallLedgerEntries(pipelineDir, bookId, f.slice(0, -".jsonl".length)));
      } catch {
        /* a corrupt slice never bricks the budget read — skip it */
      }
    }
  }
  return out;
}

function stage1TrueSessions(entries: readonly RunCallLedgerEntryV1[]): number {
  return entries.filter((e) => e.sessionKind === "session" && e.runId.startsWith(`${STAGE1_RUN_ID_PREFIX}-`)).length;
}

export type Stage1BudgetSnapshot = {
  ceiling: number;
  stageCap: number;
  campaignTrueSessions: number;
  stage1TrueSessions: number;
  remainingCeiling: number;
  remainingStageCap: number;
};

export type Stage1GateOpts = {
  ceiling?: number;
  stageCap?: number;
  /** Ledger-read seam (tests inject a fixture). Default: the real WP-503 scan. */
  readEntries?: () => RunCallLedgerEntryV1[];
};

/**
 * The pre-spawn budget gate. `reserve()` runs before EVERY spawn and throws
 * `Stage1BudgetHalt` BEFORE the offending session when the next spawn would
 * breach the 170 campaign ceiling (TRUE sessions only — countTrueSessions;
 * reingests never count) or Stage-1's registered 119 cap. Conservative double
 * accounting: spend = max(fresh ledger recount, process-start count + in-process
 * reservations) — a spawn whose ledger entry has not landed yet can never slip
 * under the ceiling, and a concurrent writer's entries are seen on the recount.
 */
export class Stage1SpawnGate {
  private reserved = 0;
  private startCampaign: number;
  private startStage1: number;
  /** True once any reservation was refused — later steps consult it. */
  breached = false;

  constructor(private readonly pipelineDir: string, private readonly opts: Stage1GateOpts = {}) {
    const entries = this.entries();
    this.startCampaign = countTrueSessions(entries);
    this.startStage1 = stage1TrueSessions(entries);
  }

  private entries(): RunCallLedgerEntryV1[] {
    return this.opts.readEntries ? this.opts.readEntries() : readAllLedgerEntries(this.pipelineDir);
  }

  get ceiling(): number { return this.opts.ceiling ?? STAGE1_SESSION_CEILING; }
  get stageCap(): number { return this.opts.stageCap ?? STAGE1_STAGE_CAP; }
  get reservedThisProcess(): number { return this.reserved; }

  snapshot(): Stage1BudgetSnapshot {
    const entries = this.entries();
    const campaign = Math.max(countTrueSessions(entries), this.startCampaign + this.reserved);
    const stage1 = Math.max(stage1TrueSessions(entries), this.startStage1 + this.reserved);
    return {
      ceiling: this.ceiling,
      stageCap: this.stageCap,
      campaignTrueSessions: campaign,
      stage1TrueSessions: stage1,
      remainingCeiling: this.ceiling - campaign,
      remainingStageCap: this.stageCap - stage1,
    };
  }

  /** Throws BEFORE the offending spawn when `sessions` more would not fit. */
  assertHeadroom(sessions: number, label: string): void {
    const s = this.snapshot();
    if (s.remainingCeiling < sessions) {
      this.breached = true;
      throw new Stage1BudgetHalt(
        `campaign-ceiling HALT before "${label}": ${s.campaignTrueSessions}/${s.ceiling} TRUE sessions already spent ` +
        `(ledger recount + in-process reservations); the next ${sessions} spawn(s) would breach the D-3 ceiling. ` +
        `Halting BEFORE the offending spawn — the ceiling is never raised. ${STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE}`,
      );
    }
    if (s.remainingStageCap < sessions) {
      this.breached = true;
      throw new Stage1BudgetHalt(
        `stage-1 cap HALT before "${label}": ${s.stage1TrueSessions}/${s.stageCap} Stage-1 TRUE sessions already spent; ` +
        `the next ${sessions} spawn(s) would breach the registered Stage-1 cap (EXPERIMENT_STAGE_BUDGETS stage "1"). ` +
        `${STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE}`,
      );
    }
  }

  reserve(label: string): void {
    this.assertHeadroom(1, label);
    this.reserved += 1;
  }
}

// ── Driver-owned sidecars (hash-verified resume; never respawn completed work) ──

export type Stage1EvalCellSidecarV1 = {
  schema: "v25-stage1-eval-cell-v1";
  label: BlindLabel;
  slot: string;
  block: string;
  replicate: Stage1Replicate;
  /** combinedContentHash of the audited slot chapters (resume identity). */
  contentSha256: string;
  evalRunId: string;
  terminalState: string;
  chapterDiagnostic: number | null;
  confidence: string | null;
  gatesPass: boolean | null;
  at: string;
};

export type Stage1D7LiteCellSidecarV1 = {
  schema: "v25-stage1-d7lite-cell-v1";
  kind: "candidate" | "drift";
  label: BlindLabel | null;
  block: string;
  replicate: "r1";
  unit: string;
  auditId: string;
  contentSha256: string | null;
  /** DERIVED single-rater chapter diagnostic (deriveRecordAggregates). */
  value: number | null;
  anchorValue: number | null;
  delta: number | null;
  pass: boolean | null;
  raterModel: string | null;
  sessionKind: string | null;
  error: string | null;
  at: string;
};

function evalSidecarPath(roots: BakeoffRoots, label: string): string {
  return resolve(roots.runRoot, "eval-audits", `${label}.json`);
}
function d7liteSidecarPath(roots: BakeoffRoots, name: string): string {
  return resolve(roots.runRoot, "d7lite", `${name}.json`);
}
/** WP-E32's exact read location (runBakeoff.ts `evalDiagnosticPath`): the
 *  select phase reads reviews/<label>/eval-diagnostic.json — write EXACTLY there. */
function evalDiagnosticPath(roots: BakeoffRoots, label: string): string {
  return resolve(roots.reviewsDir, label, "eval-diagnostic.json");
}
function d7JudgePath(roots: BakeoffRoots, label: string): string {
  return resolve(roots.reviewsDir, label, "d7.json");
}

function readJsonIf<T>(p: string): T | null {
  try {
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function stage1CampaignDir(stateRoot: string): string {
  return resolve(stateRoot, "model-bakeoffs", "_campaign", "stage1");
}

// ── Deps ────────────────────────────────────────────────────────────────────────

export type Stage1Deps = {
  pipelineDir?: string;
  repositoryRoot?: string;
  /** Bakeoff/diagnostic state root (default `<pipelineDir>/state`). */
  stateRoot?: string;
  log?: (m: string) => void;
  clock?: () => Date;
  /** The authoring/selection conductor (default: the real runBakeoff). */
  runBakeoffFn?: (opts: RunBakeoffOptions) => Promise<BakeoffOutcome>;
  /** The dual-blind E-audit runner (default: the real runChapterDiagnostic). */
  runDiagnosticFn?: (input: ChapterDiagnosticRunInput) => Promise<ChapterDiagnosticRunResult>;
  /** The D7-lite single-rater dispatch (default: the Sol-ultra codex dispatch). */
  d7Dispatch?: D7WorkerDispatch;
  /** Ultra probe gate (default: validated sidecar reuse + live probe fallback). */
  probeGate?: (probeDir: string, log: (m: string) => void, tag?: string) => Promise<D7LiteProbeGateResult>;
  /** The pre-spawn budget gate (tests inject one with a fixture ledger). */
  gate?: Stage1SpawnGate;
  /** Corpus manifest override (tests point at a fixture). */
  corpusManifestPath?: string;
  /** Reader-facing book metadata (Gate 4 whitelist: title/categories/tags).
   *  Default reads book-packages/<bookId>.v21.json at the repo root. */
  bookMetadata?: (bookId: string) => ChapterDiagnosticBookMetadataInput;
};

type ResolvedStage1Deps = {
  pipelineDir: string;
  repositoryRoot: string;
  stateRoot: string;
  log: (m: string) => void;
  clock: () => Date;
  runBakeoffFn: (opts: RunBakeoffOptions) => Promise<BakeoffOutcome>;
  runDiagnosticFn: (input: ChapterDiagnosticRunInput) => Promise<ChapterDiagnosticRunResult>;
  d7Dispatch: D7WorkerDispatch;
  probeGate: (probeDir: string, log: (m: string) => void, tag?: string) => Promise<D7LiteProbeGateResult>;
  gate: Stage1SpawnGate;
  corpusManifestPath?: string;
  bookMetadata: (bookId: string) => ChapterDiagnosticBookMetadataInput;
};

function resolveStage1Deps(d: Stage1Deps): ResolvedStage1Deps {
  const pipelineDir = resolve(d.pipelineDir ?? PIPELINE_DIR);
  const repositoryRoot = resolve(d.repositoryRoot ?? STAGE1_REPO_ROOT);
  const stateRoot = resolve(d.stateRoot ?? resolve(pipelineDir, "state"));
  return {
    pipelineDir,
    repositoryRoot,
    stateRoot,
    log: d.log ?? ((m: string) => process.stdout.write(`${m}\n`)),
    clock: d.clock ?? (() => new Date()),
    runBakeoffFn: d.runBakeoffFn ?? runBakeoff,
    runDiagnosticFn: d.runDiagnosticFn ?? ((input) => runChapterDiagnostic(input)),
    d7Dispatch: d.d7Dispatch ?? createD7CodexWorkerDispatch({ pipelineDir, log: d.log }),
    probeGate: d.probeGate ?? defaultProbeGate,
    gate: d.gate ?? new Stage1SpawnGate(pipelineDir),
    corpusManifestPath: d.corpusManifestPath,
    bookMetadata: d.bookMetadata ?? ((bookId) => defaultBookMetadata(repositoryRoot, bookId)),
  };
}

/** Reader-facing whitelist metadata from the published package at the repo root
 *  (title/categories/tags ONLY — same extraction the Stage-0b anchor driver uses). */
export function defaultBookMetadata(repositoryRoot: string, bookId: string): ChapterDiagnosticBookMetadataInput {
  const path = resolve(repositoryRoot, "book-packages", `${bookId}.v21.json`);
  const pkg = JSON.parse(readFileSync(path, "utf8")) as {
    book?: { title?: string; categories?: string[]; tags?: string[] };
    title?: string;
    categories?: string[];
  };
  const title = pkg.book?.title ?? pkg.title;
  if (!title) throw new Stage1DriverError(`no reader-facing title for ${bookId} in ${path}`);
  return { title, categories: pkg.book?.categories ?? pkg.categories ?? [], tags: pkg.book?.tags ?? [] };
}

// ── Manifest pre-seed (measure-only flag + preflight-by-registered-verdict) ─────

/**
 * Create (or verify) the run manifest BEFORE the conductor runs. This is where
 * two registered controls land that the conductor itself has no CLI/opts seam for:
 *
 *   - `readabilityMeasureOnly: true` — the measure-only lane flag (WP-E31); the
 *     conductor refuses it on any non-compare-only run (MeasureOnlyNotCompareOnlyError),
 *     and a corpus run is compare-only by construction;
 *   - `completedPhases: ["preflight"]` + a preflight record citing the REGISTERED
 *     WP-502 capability-probe verdicts (SCREENING_PLAN.configs probeSupported,
 *     L-39) — Stage-1's registered budget (protocol §5: 84 planned sessions)
 *     contains ZERO per-invocation probe sessions, so the per-run probe phase is
 *     satisfied by the registered verdicts (asserted fail-closed below via
 *     dropProbeFailedConfigs); a wrong model id still fails closed at the first
 *     authoring spawn;
 *   - the sealed blind-label map, assigned ONCE with the campaign-seeded rng so
 *     every stage-1 run of this runHash seals the SAME label→model map.
 */
export function ensureStage1Manifest(
  roots: BakeoffRoots,
  block: Stage1Block,
  runId: string,
  runHash: string,
  clock: () => Date,
): BakeoffManifestV1 {
  const existing = readManifest(roots);
  if (existing) {
    if (existing.readabilityMeasureOnly !== true) {
      throw new Stage1DriverError(
        `run ${runId} has an existing manifest WITHOUT readabilityMeasureOnly — refusing to resume a non-measure-only run under the Stage-1 lane`,
      );
    }
    return existing;
  }

  // Fail-closed registered-probe check: every candidate config must carry a
  // supported WP-502 verdict; a dropped config is never substituted.
  const configIds = block.models.map((m) => `${m}@${block.effort}`);
  const verdicts = SCREENING_PLAN.configs.map((c) => ({ configId: c.id, supported: c.probeSupported }));
  const probeResult = dropProbeFailedConfigs(
    SCREENING_PLAN.configs.filter((c) => configIds.includes(c.id)),
    verdicts,
  );
  if (probeResult.dropped.length > 0) {
    throw new Stage1DriverError(
      `registered capability-probe verdict missing/failed for: ${probeResult.dropped.map((x) => `${x.configId} (${x.reason})`).join("; ")} — no model is substituted; refusing before any spawn`,
    );
  }

  const iso = clock().toISOString();
  const candidates: CandidateSpec[] = block.models.map((model, i) => ({
    model,
    slug: modelSlug(model),
    slot: `w${i + 1}`,
    effort: block.effort as ReasoningEffort,
  }));
  const manifest: BakeoffManifestV1 = {
    schemaVersion: BAKEOFF_MANIFEST_SCHEMA,
    runId,
    bookId: block.bookId,
    createdAt: iso,
    updatedAt: iso,
    candidates,
    judge: { model: block.advisoryJudge.model, effort: block.advisoryJudge.effort as ReasoningEffort },
    readabilityMeasureOnly: true,
    maxParallel: 3,
    publish: false,
    blindMap: assignBlindLabels(candidates, seededRng(`stage1-blind-${runHash}`)),
    completedPhases: ["preflight"],
    preflight: {
      checkedAt: iso,
      codexVersion: null,
      models: block.models.map((model) => ({
        model,
        ok: true,
        detail:
          "registered WP-502 capability-probe verdict (SCREENING_PLAN.configs probeSupported:true, L-39) — " +
          "Stage-1's registered budget contains no per-invocation probe sessions; a wrong id fails closed at the first authoring spawn",
      })),
    },
  };
  writeManifest(roots, manifest);
  return manifest;
}

function labelOf(manifest: BakeoffManifestV1, model: string): BlindLabel {
  const found = Object.entries(manifest.blindMap).find(([, m]) => m === model);
  if (!found) throw new Stage1DriverError(`no blind label sealed for a candidate in run ${manifest.runId}`);
  return found[0] as BlindLabel;
}

// ── Neutralized conductor stages (phase control; see module doc) ────────────────

/** A PENDING D7 judgment: never dispatches, keeps `select` PROVISIONAL so the
 *  conductor halts after validate and a later resume re-derives the selection. */
function pendingD7Judgment(label: BlindLabel, chapters: ChapterV21[], clock: () => Date): CandidateD7JudgmentV1 {
  let contentSha256 = "";
  try { contentSha256 = combinedContentHash(chapters); } catch { /* keep "" */ }
  return {
    schemaVersion: "model-bakeoff-candidate-d7-v1",
    label,
    contentSha256,
    auditId: "stage1-pending",
    d7Composite: null,
    d7CoreDomainMins: [],
    d7GatesPass: false,
    d7LayerIndependencePass: false,
    allCoreDomainsPass: false,
    min: null,
    meanPass: false,
    minPass: false,
    calibrationPass: false,
    verdict: null,
    terminalState: "pending",
    chapters: [],
    judgedAt: clock().toISOString(),
  };
}

function stage1Stages(log: (m: string) => void, clock: () => Date): Partial<BakeoffStages> {
  return {
    // Stage-1 budgets ZERO advisory-judge sessions (protocol §5) — the codex
    // whole-book advisory read is skipped, recorded, and nothing is persisted.
    review: async (_bookId, label) => {
      log(`[stage1]   advisory review label ${label}: SKIPPED (registered Stage-1 design — no advisory-judge sessions in the experiment budget)`);
      return {
        schemaVersion: "model-bakeoff-candidate-review-v1",
        label,
        contentSha256: "",
        chapterReviews: [],
        bookReads: [],
        bookComposite: null,
        bookGate: null,
        bookChurn: "?",
        meanChapterComposite: null,
        minChapterComposite: null,
        chapterPassRate: null,
        sampledChapterNumbers: [],
        reviewedAt: clock().toISOString(),
      } as CandidateReviewV1;
    },
    d7Judge: async (_bookId, label, chapters) => pendingD7Judgment(label, chapters, clock),
  };
}

// ── Ledgered/gated conductor deps ───────────────────────────────────────────────

/** Mirror every codex authoring spawn into the WP-503 ledger AS A TRUE SESSION
 *  (`sessionKind: "session"` — countTrueSessions is the ceiling currency; the
 *  run-invocation mirror predates WP-E41 and omits it, which under-counts). */
function buildLedgeredLogSession(
  pipelineDir: string,
  runId: string,
  base: BakeoffDeps["logSession"],
): BakeoffDeps["logSession"] {
  return (bookId, label, r) => {
    try {
      appendCallLedgerEntry({
        pipelineDir,
        bookId,
        runId,
        family: "codex-exec",
        stage: classifySessionLabel(label),
        role: r.role ?? null,
        model: r.model ?? null,
        effort: r.effort ?? null,
        latencyMs: Number.isFinite(r.durationMs) ? r.durationMs : null,
        outcome: r.outcome ?? (r.ok ? "content_completed" : "infrastructure_failure"),
        sessionId: r.sessionId,
        sessionKind: "session",
      });
    } catch {
      /* telemetry never halts a run */
    }
    base(bookId, label, r);
  };
}

/** Gate EVERY conductor spawn (authoring + any unexpected aux) through the
 *  budget gate, plus the registered ≤1 in-lane retry per candidate (protocol §5
 *  Stage-1 row: "18 author cells (≤1 in-lane retry)"). */
function buildGatedSpawn(
  gate: Stage1SpawnGate,
  candidateModels: string[],
  runId: string,
  base: BakeoffDeps["spawn"],
): BakeoffDeps["spawn"] {
  const authorSpawns = new Map<string, number>();
  return async (opts) => {
    const model = (opts as { model?: string }).model;
    if (model && candidateModels.includes(model)) {
      const slotIndex = candidateModels.indexOf(model) + 1;
      const n = (authorSpawns.get(model) ?? 0) + 1;
      if (n > 2) {
        throw new Stage1BudgetHalt(
          `in-lane retry cap: candidate slot w${slotIndex} of ${runId} already spawned 2 authoring sessions this process ` +
          `(registered ≤1 in-lane retry) — refusing spawn #${n} BEFORE it starts`,
        );
      }
      authorSpawns.set(model, n);
    }
    gate.reserve(`${runId} codex spawn (${(opts as { sessionId?: string }).sessionId ?? "?"})`);
    return base(opts);
  };
}

// ── Step 1: the authoring pass ─────────────────────────────────────────────────

export type Stage1AuthoringOutcome = {
  status: BakeoffOutcome["status"];
  reason: string | null;
  classified: "authoring-complete" | "already-selected" | "no-eligible-candidate" | "failed";
};

async function runAuthoringPass(
  block: Stage1Block,
  runId: string,
  deps: ResolvedStage1Deps,
  runHash: string,
): Promise<Stage1AuthoringOutcome> {
  const base = resolveDeps();
  const bakeoffDeps: Partial<BakeoffDeps> = {
    rng: seededRng(`stage1-blind-${runHash}`),
    spawn: buildGatedSpawn(deps.gate, block.models, runId, base.spawn),
    logSession: buildLedgeredLogSession(deps.pipelineDir, runId, base.logSession),
  };
  const outcome = await deps.runBakeoffFn({
    runId,
    corpus: {
      bookId: block.bookId,
      chapters: [block.chapter],
      ...(deps.corpusManifestPath ? { manifestPath: deps.corpusManifestPath } : {}),
    },
    models: [...block.models],
    effort: block.effort as ReasoningEffort,
    judgeModel: block.advisoryJudge.model,
    judgeEffort: block.advisoryJudge.effort as ReasoningEffort,
    calibrationUnit: block.calibrationUnit,
    maxParallel: 3,
    chapterParallel: 1,
    deps: bakeoffDeps,
    stages: stage1Stages(deps.log, deps.clock),
    stateRoot: deps.stateRoot,
  });
  const reason = outcome.reason ?? null;
  let classified: Stage1AuthoringOutcome["classified"];
  if (outcome.status === "compared") classified = "already-selected";
  else if (outcome.status === "halt" && (reason ?? "").includes("selection is PROVISIONAL")) classified = "authoring-complete";
  else if (outcome.status === "halt" && (reason ?? "").includes("no eligible candidate")) classified = "no-eligible-candidate";
  else classified = "failed";
  return { status: outcome.status, reason, classified };
}

// ── Step 2: E-audits (PRIMARY) ─────────────────────────────────────────────────

export type Stage1EvalCellResult = {
  label: BlindLabel;
  slot: string;
  reused: boolean;
  terminalState: string;
  chapterDiagnostic: number | null;
  confidence: string | null;
  gatesPass: boolean | null;
  ineligibleReason: string | null;
  raterModels: string[];
};

function ineligibleEvalDiagnostic(
  label: BlindLabel,
  evalRunId: string,
  reason: string,
  clock: () => Date,
): CandidateEvalDiagnosticV1 {
  return {
    schemaVersion: "model-bakeoff-candidate-eval-diagnostic-v1",
    label,
    contentSha256: "",
    evalRunId,
    chapterDiagnostic: null,
    confidence: null,
    gatesPass: null,
    raterModels: { primary: null, verification: null, adjudicator: null },
    terminalState: "judged",
    receipts: { primaryDispatch: "", verificationDispatch: "", pairSeal: "", adjudicated: "" },
    ineligibleReason: reason,
    judgedAt: clock().toISOString(),
  };
}

async function runEvalCell(args: {
  block: Stage1Block;
  replicate: Stage1Replicate;
  runId: string;
  runHash: string;
  roots: BakeoffRoots;
  spec: CandidateSpec;
  label: BlindLabel;
  deps: ResolvedStage1Deps;
}): Promise<Stage1EvalCellResult> {
  const { block, replicate, runId, runHash, roots, spec, label, deps } = args;
  const evalRunId = `${runId}-${spec.slot}`;
  const chapters = loadSlotChapters(roots, spec.slot).filter((c) => c.number === block.chapter);
  const sidecarPath = evalSidecarPath(roots, label);
  const diagPath = evalDiagnosticPath(roots, label);

  if (chapters.length === 0) {
    // Nothing was authored into this slot — the candidate cannot be audited.
    // (Floor-FAILED drafts are different: measure-only preserves them and they
    // ARE audited below.) Terminal, recorded, never a fabricated score.
    const reason = "no authored draft to audit — the candidate slot has no chapter for this block (generation incomplete/failed); failures stay in the denominator";
    const diag = ineligibleEvalDiagnostic(label, evalRunId, reason, deps.clock);
    writeJson(diagPath, diag);
    writeJson(sidecarPath, {
      schema: "v25-stage1-eval-cell-v1",
      label, slot: spec.slot, block: block.unit, replicate,
      contentSha256: "", evalRunId, terminalState: diag.terminalState,
      chapterDiagnostic: null, confidence: null, gatesPass: null,
      at: deps.clock().toISOString(),
    } satisfies Stage1EvalCellSidecarV1);
    return { label, slot: spec.slot, reused: false, terminalState: diag.terminalState, chapterDiagnostic: null, confidence: null, gatesPass: null, ineligibleReason: reason, raterModels: [] };
  }

  const contentSha256 = combinedContentHash(chapters);
  const prior = readJsonIf<Stage1EvalCellSidecarV1>(sidecarPath);
  const priorDiag = readJsonIf<CandidateEvalDiagnosticV1>(diagPath);
  if (
    prior !== null && priorDiag !== null &&
    prior.contentSha256 === contentSha256 &&
    (priorDiag.terminalState === "judged" || priorDiag.terminalState === "instrument-fail")
  ) {
    deps.log(`[stage1]   E-audit ${label}: REUSING terminal audit at these bytes (hash-verified resume — never respawned)`);
    return {
      label, slot: spec.slot, reused: true,
      terminalState: priorDiag.terminalState,
      chapterDiagnostic: priorDiag.chapterDiagnostic,
      confidence: priorDiag.confidence,
      gatesPass: priorDiag.gatesPass,
      ineligibleReason: priorDiag.ineligibleReason ?? null,
      raterModels: Object.values(priorDiag.raterModels).filter((m): m is string => m !== null),
    };
  }

  // 3 roles × ≤2 attempts; the fine-grained per-spawn reserve happens inside
  // the gated session runner — this coarse check halts BEFORE the cell when a
  // minimal 3-role audit no longer fits.
  deps.gate.assertHeadroom(3, `E-audit cell ${runId} label ${label}`);

  const gatedRunner: UltraSessionRunner = async (req) => {
    deps.gate.reserve(`E-audit ${req.sessionTag} (${runId} label ${label})`);
    const res = await runUltraSession(req);
    try {
      appendCallLedgerEntry({
        pipelineDir: deps.pipelineDir,
        bookId: block.bookId,
        runId,
        family: "codex-exec",
        stage: EVAL_RATER_LEDGER_STAGE,
        role: req.role,
        model: res.model ?? null,
        effort: res.effort ?? null,
        latencyMs: Number.isFinite(res.latencyMs) ? res.latencyMs : null,
        outcome: res.outcome as ProviderOutcomeV1,
        sessionId: res.sessionId ?? null,
        sessionKind: "session",
      });
    } catch {
      /* telemetry never halts a run */
    }
    return res;
  };

  deps.log(`[stage1]   E-audit ${label} (slot ${spec.slot}): blind package + dual-blind chapter diagnostic (runId ${evalRunId})`);
  const result = await deps.runDiagnosticFn({
    label,
    runHash: `${runHash}-${replicate}`,
    blockCode: block.unit,
    slot: spec.slot,
    runId: evalRunId,
    chapter: chapters[0]!,
    book: deps.bookMetadata(block.bookId),
    stateRoot: deps.stateRoot,
    sessionRunner: gatedRunner,
    timeoutMs: SESSION_TIMEOUT_MS,
    repoRoot: deps.repositoryRoot,
  });

  writeJson(diagPath, result.diagnostic);
  writeJson(sidecarPath, {
    schema: "v25-stage1-eval-cell-v1",
    label, slot: spec.slot, block: block.unit, replicate,
    contentSha256, evalRunId,
    terminalState: result.diagnostic.terminalState,
    chapterDiagnostic: result.diagnostic.chapterDiagnostic,
    confidence: result.diagnostic.confidence,
    gatesPass: result.diagnostic.gatesPass,
    at: deps.clock().toISOString(),
  } satisfies Stage1EvalCellSidecarV1);
  deps.log(result.summaryLine);

  const raterModels = [result.roles.primary.raterModel, result.roles.verification.raterModel, result.roles.adjudicator?.raterModel ?? null]
    .filter((m): m is string => m !== null);
  return {
    label, slot: spec.slot, reused: false,
    terminalState: result.diagnostic.terminalState,
    chapterDiagnostic: result.diagnostic.chapterDiagnostic,
    confidence: result.diagnostic.confidence,
    gatesPass: result.diagnostic.gatesPass,
    ineligibleReason: result.diagnostic.ineligibleReason ?? null,
    raterModels,
  };
}

// ── Step 3: D7-lite (SECONDARY, r1 only) ───────────────────────────────────────

async function runD7LiteCandidateCell(args: {
  block: Stage1Block;
  runId: string;
  roots: BakeoffRoots;
  spec: CandidateSpec;
  label: BlindLabel;
  forbidden: string[];
  deps: ResolvedStage1Deps;
}): Promise<Stage1D7LiteCellSidecarV1> {
  const { block, runId, roots, spec, label, forbidden, deps } = args;
  const auditId = `${runId}-d7l-${label.toLowerCase()}`;
  const sidecarPath = d7liteSidecarPath(roots, label);
  const at = deps.clock().toISOString();
  const blank: Stage1D7LiteCellSidecarV1 = {
    schema: "v25-stage1-d7lite-cell-v1",
    kind: "candidate", label, block: block.unit, replicate: "r1", unit: block.unit,
    auditId, contentSha256: null, value: null, anchorValue: null, delta: null, pass: null,
    raterModel: null, sessionKind: null, error: null, at,
  };

  const chapters = loadSlotChapters(roots, spec.slot).filter((c) => c.number === block.chapter);
  if (chapters.length === 0) {
    const cell = { ...blank, error: "no authored draft — D7-lite cell not audit-able (recorded, stays in the denominator)" };
    writeJson(sidecarPath, cell);
    return cell;
  }
  const contentSha256 = combinedContentHash(chapters);
  const prior = readJsonIf<Stage1D7LiteCellSidecarV1>(sidecarPath);
  if (prior !== null && prior.contentSha256 === contentSha256 && prior.value !== null) {
    deps.log(`[stage1]   d7lite ${label}: REUSING derived diagnostic at these bytes (resume — never respawned)`);
    return prior;
  }

  try {
    // Candidate audit package (fail-closed on missing quiz key/explanation —
    // the same assembler the 3-role judge uses) + the frozen batch (candidate
    // chapter + the block's DISJOINT sealed calibration reference, rt702-R1).
    const pkg = assembleAuditPackageFromChapters({ bookId: block.bookId, chapters });
    const packageRelPath = `${rubricAuditDirRelPath(auditId)}/candidate-package.json`;
    const packageAbs = resolve(deps.repositoryRoot, packageRelPath);
    mkdirSync(dirname(packageAbs), { recursive: true });
    writeFileAtomic(packageAbs, JSON.stringify(pkg, null, 2) + "\n");
    const materialization = materializeRubricAuditBatch({
      repositoryRoot: deps.repositoryRoot,
      auditId,
      purpose: `Stage-1 D7-lite secondary read — single-rater primary session over the blinded candidate chapter (protocol §3.2)`,
      packagePath: packageRelPath,
      chapterNumbers: [block.chapter],
      calibrationUnit: block.calibrationUnit,
      write: true,
    });
    const manifest = JSON.parse(readFileSync(materialization.manifestPath, "utf8")) as RubricAuditBatchManifestV1;

    const task = renderRaterTaskDocument({ repositoryRoot: deps.repositoryRoot, manifest, unit: block.unit, role: "primary" });
    assertNoIdentityLeak(task, forbidden, `Stage-1 D7-lite primary task (label ${label}, unit ${block.unit})`);

    // A completed persisted attempt makes the dispatch a REINGEST (no live
    // spend) — only a fresh spawn reserves budget.
    const hasCompleted = hasCompletedD7Attempt(deps.pipelineDir, { bookId: block.bookId, auditId, unit: block.unit, role: "primary" });
    if (!hasCompleted) deps.gate.reserve(`d7lite candidate cell ${auditId}`);

    const ret = await deps.d7Dispatch({
      auditId, bookId: block.bookId, label, unit: block.unit, role: "primary", kind: "candidate", task, attempt: 1,
    });
    const { record, dispatchMeta } = normalizeD7WorkerReturn(ret);
    ingestRaterRecord({
      repositoryRoot: deps.repositoryRoot, manifest, unit: block.unit, role: "primary",
      recordText: record, dispatchMeta: toIngestMeta(dispatchMeta),
    });
    const derived = deriveRecordAggregates(loadRecord(record).value);
    if (derived === null) throw new Stage1DriverError("ingested record yielded no derivable aggregates (atomic ratings missing)");
    const cell: Stage1D7LiteCellSidecarV1 = {
      ...blank,
      contentSha256,
      value: derived.chapterDiagnostic,
      raterModel: dispatchMeta?.model ?? null,
      sessionKind: dispatchMeta?.sessionKind ?? "session",
      at: deps.clock().toISOString(),
    };
    writeJson(sidecarPath, cell);
    deps.log(`[stage1]   d7lite ${label}: derived=${derived.chapterDiagnostic} (${cell.sessionKind}; single-rater SECONDARY read)`);
    return cell;
  } catch (err) {
    if (err instanceof Stage1BudgetHalt) throw err;
    const message = err instanceof AuditPackageAssemblyError ? `audit package assembly refused: ${err.message}` : (err as Error).message;
    const cell = { ...blank, contentSha256, error: message, at: deps.clock().toISOString() };
    writeJson(sidecarPath, cell);
    deps.log(`[stage1]   d7lite ${label}: FAILED fail-closed — ${message.split("\n")[0]}`);
    return cell;
  }
}

async function runD7LiteDriftUnit(args: {
  block: Stage1Block;
  runId: string;
  roots: BakeoffRoots;
  deps: ResolvedStage1Deps;
}): Promise<Stage1D7LiteCellSidecarV1> {
  const { block, runId, roots, deps } = args;
  const auditId = `${runId}-d7l-drift`;
  const sidecarPath = d7liteSidecarPath(roots, "drift");
  const ref = RUBRIC_CALIBRATION_REFERENCES.find((r) => r.unit === block.calibrationUnit);
  if (!ref) throw new Stage1DriverError(`block ${block.unit} calibration unit ${block.calibrationUnit} is not a sealed reference`);
  const at = deps.clock().toISOString();
  const blank: Stage1D7LiteCellSidecarV1 = {
    schema: "v25-stage1-d7lite-cell-v1",
    kind: "drift", label: null, block: block.unit, replicate: "r1", unit: block.calibrationUnit,
    auditId, contentSha256: null, value: null, anchorValue: ref.expectedChapterDiagnostic,
    delta: null, pass: null, raterModel: null, sessionKind: null, error: null, at,
  };
  const prior = readJsonIf<Stage1D7LiteCellSidecarV1>(sidecarPath);
  if (prior !== null && prior.value !== null) {
    deps.log(`[stage1]   d7lite drift: REUSING prior drift reading (resume)`);
    return prior;
  }

  try {
    const manifest = calibrationOnlyManifest(
      auditId,
      block.calibrationUnit,
      `Stage-1 D7-lite per-block drift unit — single-rater primary session over the sealed reference (protocol §5 Stage-1 row; §10.1-P3 drift check)`,
    );
    const task = renderRaterTaskDocument({ repositoryRoot: deps.repositoryRoot, manifest, unit: block.calibrationUnit, role: "primary" });
    const hasCompleted = hasCompletedD7Attempt(deps.pipelineDir, { bookId: block.bookId, auditId, unit: block.calibrationUnit, role: "primary" });
    if (!hasCompleted) deps.gate.reserve(`d7lite drift unit ${auditId}`);
    const ret = await deps.d7Dispatch({
      auditId, bookId: block.bookId, label: "A", unit: block.calibrationUnit, role: "primary", kind: "calibration", task, attempt: 1,
    });
    const { record, dispatchMeta } = normalizeD7WorkerReturn(ret);
    ingestRaterRecord({
      repositoryRoot: deps.repositoryRoot, manifest, unit: block.calibrationUnit, role: "primary",
      recordText: record, dispatchMeta: toIngestMeta(dispatchMeta),
    });
    const derived = deriveRecordAggregates(loadRecord(record).value);
    if (derived === null) throw new Stage1DriverError("ingested drift record yielded no derivable aggregates");
    const delta = Math.abs(derived.chapterDiagnostic - ref.expectedChapterDiagnostic);
    const cell: Stage1D7LiteCellSidecarV1 = {
      ...blank,
      value: derived.chapterDiagnostic,
      delta,
      pass: delta <= STAGE1_D7LITE_TOLERANCE,
      raterModel: dispatchMeta?.model ?? null,
      sessionKind: dispatchMeta?.sessionKind ?? "session",
      at: deps.clock().toISOString(),
    };
    writeJson(sidecarPath, cell);
    deps.log(`[stage1]   d7lite drift ${block.calibrationUnit}: derived=${derived.chapterDiagnostic} anchor=${ref.expectedChapterDiagnostic} |Δ|=${delta} → ${cell.pass ? "PASS" : "MISS"} (±${STAGE1_D7LITE_TOLERANCE})`);
    return cell;
  } catch (err) {
    if (err instanceof Stage1BudgetHalt) throw err;
    const cell = { ...blank, error: (err as Error).message, at: deps.clock().toISOString() };
    writeJson(sidecarPath, cell);
    deps.log(`[stage1]   d7lite drift: FAILED fail-closed — ${(err as Error).message.split("\n")[0]}`);
    return cell;
  }
}

function hasCompletedD7Attempt(
  pipelineDir: string,
  req: { bookId: string; auditId: string; unit: string; role: string },
): boolean {
  const baseDir = d7CodexSessionBaseDir(pipelineDir, req as never);
  let names: string[];
  try {
    names = readdirSync(baseDir);
  } catch {
    return false;
  }
  return names.some((n) => /^attempt-\d{3,}$/.test(n) && existsSync(resolve(baseDir, n, "record.json")) && existsSync(resolve(baseDir, n, "dispatch-result.json")));
}

// ── Step 3b: terminal reviews/<label>/d7.json (selection gating; SECONDARY-only lane) ──

/**
 * The terminal per-label D7 record this lane writes. The 3-role D7 composite is
 * NOT RUN here (registered Stage-1 design: single-rater D7-lite secondary only),
 * so the record is a conclusive terminal WITHOUT a 3-role read — d7Composite
 * null + an explicit reason, exactly the `ineligible-but-judged` semantics the
 * conductor's own terminal-gating documents (runBakeoff.resolveD7Terminal).
 * Under evaluator-primary selection this can only surface as recorded review
 * flags — never eligibility, never ranking (selection.ts §5.7).
 */
function terminalD7SecondaryRecord(
  label: BlindLabel,
  chapters: ChapterV21[],
  replicate: Stage1Replicate,
  runId: string,
  clock: () => Date,
): CandidateD7JudgmentV1 {
  let contentSha256 = "";
  try { contentSha256 = combinedContentHash(chapters); } catch { /* keep "" */ }
  const reason = replicate === "r1"
    ? `3-role D7 composite NOT RUN in the Stage-1 lane (registered design: single-rater D7-lite SECONDARY read only — values in <runRoot>/d7lite/${label}.json; protocol §3.2/§5)`
    : "3-role D7 composite NOT RUN in the Stage-1 lane; D7-lite runs on replicate-1 cells only (registered design, protocol §5 Stage-1 row)";
  return {
    schemaVersion: "model-bakeoff-candidate-d7-v1",
    label,
    contentSha256,
    auditId: `${runId}-d7l-${label.toLowerCase()}`,
    d7Composite: null,
    d7CoreDomainMins: [],
    d7GatesPass: false,
    d7LayerIndependencePass: false,
    allCoreDomainsPass: false,
    min: null,
    meanPass: false,
    minPass: false,
    calibrationPass: false,
    verdict: null,
    terminalState: "judged",
    chapters: [],
    ineligibleReason: reason,
    judgedAt: clock().toISOString(),
  };
}

// ── Step 4: selection minting (existing terminal-gated path) ────────────────────

export function invocationAuditsComplete(roots: BakeoffRoots, manifest: BakeoffManifestV1): boolean {
  for (const spec of manifest.candidates) {
    const label = labelOf(manifest, spec.model);
    const diag = readJsonIf<CandidateEvalDiagnosticV1>(evalDiagnosticPath(roots, label));
    if (diag === null) return false;
    if (diag.terminalState !== "judged" && diag.terminalState !== "instrument-fail") return false;
  }
  return true;
}

async function mintInvocationSelection(
  block: Stage1Block,
  runId: string,
  deps: ResolvedStage1Deps,
  runHash: string,
): Promise<{ minted: boolean; detail: string; winnerLabel: string | null }> {
  const roots = bakeoffRoots(block.bookId, runId, deps.stateRoot);
  const manifest = readManifest(roots);
  if (!manifest) return { minted: false, detail: "no run manifest yet", winnerLabel: null };
  const existing = manifest.selection;
  if (existing && existing.provisional === false) {
    const winnerLabel = existing.winner ? labelOf(manifest, existing.winner) : null;
    return { minted: true, detail: "FINAL selection already minted (resume)", winnerLabel };
  }
  const outcome = await runAuthoringPass(block, runId, deps, runHash);
  const after = readManifest(roots);
  const sel = after?.selection;
  if (sel && sel.provisional === false) {
    const winnerLabel = sel.winner && after ? labelOf(after, sel.winner) : null;
    return {
      minted: true,
      detail: `FINAL selection minted via the terminal-gated path (conductor status ${outcome.status}${sel.winner ? "" : "; no eligible winner"})`,
      winnerLabel,
    };
  }
  return { minted: false, detail: `selection still not final (conductor status ${outcome.status}: ${outcome.reason ?? "?"})`, winnerLabel: null };
}

// ── The invocation orchestrator ────────────────────────────────────────────────

export type Stage1InvocationSummaryV1 = {
  schema: "v25-stage1-invocation-summary-v1";
  at: string;
  runHash: string;
  unit: string;
  replicate: Stage1Replicate;
  runId: string;
  bookId: string;
  probe: { ok: boolean; reused: boolean | null; sidecarSha256: string | null; detail: string | null };
  authoring: Stage1AuthoringOutcome | null;
  evalCells: Stage1EvalCellResult[];
  d7lite: {
    ran: boolean;
    skippedReason: string | null;
    cells: Array<Pick<Stage1D7LiteCellSidecarV1, "label" | "value" | "sessionKind" | "error">>;
    drift: Pick<Stage1D7LiteCellSidecarV1, "unit" | "value" | "anchorValue" | "delta" | "pass" | "error"> | null;
  };
  uniformity: { raterModels: string[]; uniform: boolean; halted: boolean };
  selection: { minted: boolean; detail: string; winnerLabel: string | null };
  budget: {
    before: Stage1BudgetSnapshot;
    after: Stage1BudgetSnapshot;
    reservedThisProcess: number;
    haltDetail: string | null;
  };
  citations: {
    ceilingSource: string;
    stage1CapSource: string;
    stage1AtCapRule: string;
    preStage2Gate: string;
    floors: { advance: number; block: number; source: string };
    bandW: number;
    d7LiteTolerance: number;
  };
  note: string;
  exitCode: number;
};

const CITATIONS: Stage1InvocationSummaryV1["citations"] = {
  ceilingSource: `EXPERIMENT_BUDGET_PLAN.ceilingCodexOnlyReading = ${STAGE1_SESSION_CEILING} (src/bakeoff/screeningPlan.ts; D-3 amendment, TRUE sessions only)`,
  stage1CapSource: `EXPERIMENT_STAGE_BUDGETS stage "1" cap = ${STAGE1_STAGE_CAP} (planned 84; protocol §5 table)`,
  stage1AtCapRule: STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE,
  preStage2Gate: "checkBudgetBeforeStage2() (src/bakeoff/screeningPlan.ts) gates Stage-2 entry — Stage 1 at cap without a CONFIRMED advancement decision = STOP",
  floors: { advance: STAGE1_ADVANCE_FLOOR, block: STAGE1_BLOCK_FLOOR, source: STAGE1_FLOORS_SOURCE },
  bandW: STAGE1_BAND_W,
  d7LiteTolerance: STAGE1_D7LITE_TOLERANCE,
};

export type Stage1InvocationRunResult = { summary: Stage1InvocationSummaryV1; summaryPath: string | null; exitCode: number };

/** Exit codes: 0 ok; 2 probe gate failed; 3 budget halt (BEFORE the offending
 *  spawn); 4 rater-uniformity halt; 5 E-audit/D7-lite cell failure; 7 authoring
 *  failed. */
export async function executeStage1Invocation(args: {
  unit: string;
  replicate: Stage1Replicate;
  runHash: string;
  deps?: Stage1Deps;
}): Promise<Stage1InvocationRunResult> {
  const { unit, replicate, runHash } = args;
  if (!RUN_HASH_RE.test(runHash)) throw new Stage1DriverError(`runHash '${runHash}' must be kebab-case [a-z0-9-]`);
  const block = stage1Blocks().find((b) => b.unit === unit);
  if (!block) {
    throw new Stage1DriverError(
      `unknown block '${unit}' — registered blocks: ${stage1Blocks().map((b) => b.unit).join(", ")} (the sol@high arm is DROPPED, protocol §5 Stage 1b)`,
    );
  }
  const deps = resolveStage1Deps(args.deps ?? {});
  const { log, clock, gate } = deps;
  const runId = stage1RunId(runHash, unit, replicate);
  const roots = bakeoffRoots(block.bookId, runId, deps.stateRoot);
  const budgetBefore = gate.snapshot();

  const summary: Stage1InvocationSummaryV1 = {
    schema: "v25-stage1-invocation-summary-v1",
    at: clock().toISOString(),
    runHash, unit, replicate, runId,
    bookId: block.bookId,
    probe: { ok: false, reused: null, sidecarSha256: null, detail: null },
    authoring: null,
    evalCells: [],
    d7lite: { ran: false, skippedReason: null, cells: [], drift: null },
    uniformity: { raterModels: [], uniform: true, halted: false },
    selection: { minted: false, detail: "not attempted", winnerLabel: null },
    budget: { before: budgetBefore, after: budgetBefore, reservedThisProcess: 0, haltDetail: null },
    citations: CITATIONS,
    note: NOT_A_BOOK_SCORE_NOTE,
    exitCode: 0,
  };
  const finish = (exitCode: number): Stage1InvocationRunResult => {
    summary.exitCode = exitCode;
    summary.budget.after = gate.snapshot();
    summary.budget.reservedThisProcess = gate.reservedThisProcess;
    const dir = stage1CampaignDir(deps.stateRoot);
    const summaryPath = resolve(dir, `invocation-${runHash}-${unit}-${replicate}.json`);
    writeJson(summaryPath, summary);
    log(`STAGE1_INVOCATION_SUMMARY ${JSON.stringify(summary)}`);
    return { summary, summaryPath, exitCode };
  };

  log(`[stage1] invocation ${unit}:${replicate} (runId ${runId}) — block book ${block.bookId} ch${block.chapter}; models sealed behind blind labels`);
  log(`[stage1]   budget: campaign ${budgetBefore.campaignTrueSessions}/${budgetBefore.ceiling} TRUE sessions; stage-1 ${budgetBefore.stage1TrueSessions}/${budgetBefore.stageCap}; estimate this invocation planned ${invocationSessionEstimate(replicate).planned} / worst ${invocationSessionEstimate(replicate).worstCase}`);

  try {
    // ── Ultra probe gate BEFORE the first spawn of this process run. ──
    const probeDir = resolve(deps.stateRoot, "model-bakeoffs", "_campaign", "ultra-acceptance");
    const probe = await deps.probeGate(probeDir, log, "[stage1]");
    summary.probe = probe.ok
      ? { ok: true, reused: probe.reused, sidecarSha256: probe.sidecarSha256, detail: null }
      : { ok: false, reused: null, sidecarSha256: null, detail: probe.detail };
    if (!probe.ok) {
      log(`[stage1] ULTRA PROBE GATE FAILED — no session spawned. ${probe.detail}`);
      return finish(2);
    }

    // ── Step 1: authoring (compare-only corpus bakeoff, measure-only lane). ──
    const manifest = ensureStage1Manifest(roots, block, runId, runHash, clock);
    gate.assertHeadroom(1, `authoring pass ${runId}`);
    summary.authoring = await runAuthoringPass(block, runId, deps, runHash);
    log(`[stage1]   authoring: status=${summary.authoring.status} → ${summary.authoring.classified}`);
    if (summary.authoring.classified === "failed") {
      log(`[stage1] authoring FAILED: ${summary.authoring.reason ?? "?"}`);
      return finish(7);
    }
    if (gate.breached) return finish(3);

    // ── Step 2: E-audits (PRIMARY) — floor-failed drafts INCLUDED. ──
    const raterModels = new Set<string>();
    let cellFailure = false;
    for (const spec of manifest.candidates) {
      if (summary.uniformity.halted) break;
      const label = labelOf(manifest, spec.model);
      const cell = await runEvalCell({ block, replicate, runId, runHash, roots, spec, label, deps });
      summary.evalCells.push(cell);
      if (cell.terminalState === "instrument-fail") cellFailure = true;
      for (const m of cell.raterModels) raterModels.add(m);
      if (raterModels.size > 1) {
        summary.uniformity.halted = true;
        log("[stage1] UNIFORMITY HALT: more than one resolved rater model — stratify + owner decision (protocol §10.2b); no further cell is spawned.");
      }
    }
    summary.uniformity.raterModels = [...raterModels];
    summary.uniformity.uniform = raterModels.size <= 1;
    if (summary.uniformity.halted) return finish(4);

    // ── Step 3: D7-lite (SECONDARY) — replicate r1 ONLY. ──
    const forbidden = forbiddenReviewTokens(manifest.candidates);
    if (replicate === "r1") {
      summary.d7lite.ran = true;
      for (const spec of manifest.candidates) {
        const label = labelOf(manifest, spec.model);
        const cell = await runD7LiteCandidateCell({ block, runId, roots, spec, label, forbidden, deps });
        summary.d7lite.cells.push({ label: cell.label, value: cell.value, sessionKind: cell.sessionKind, error: cell.error });
        if (cell.raterModel !== null) raterModels.add(cell.raterModel);
        if (raterModels.size > 1) {
          summary.uniformity.halted = true;
          summary.uniformity.raterModels = [...raterModels];
          summary.uniformity.uniform = false;
          log("[stage1] UNIFORMITY HALT during D7-lite — no further session is spawned.");
          return finish(4);
        }
      }
      const drift = await runD7LiteDriftUnit({ block, runId, roots, deps });
      summary.d7lite.drift = { unit: drift.unit, value: drift.value, anchorValue: drift.anchorValue, delta: drift.delta, pass: drift.pass, error: drift.error };
      summary.uniformity.raterModels = [...raterModels];
    } else {
      summary.d7lite.skippedReason = "replicate r2 — D7-lite runs on replicate-1 cells only (registered design, protocol §5 Stage-1 row: 9 cells + 3 drift)";
      log(`[stage1]   d7lite: SKIPPED — ${summary.d7lite.skippedReason}`);
    }

    // ── Step 3b: terminal d7.json per label (selection gating; secondary-only lane). ──
    for (const spec of manifest.candidates) {
      const label = labelOf(manifest, spec.model);
      const path = d7JudgePath(roots, label);
      const prior = readJsonIf<CandidateD7JudgmentV1>(path);
      if (prior !== null && (prior.terminalState === "judged" || prior.terminalState === "instrument-fail")) continue;
      const chapters = loadSlotChapters(roots, spec.slot).filter((c) => c.number === block.chapter);
      writeJson(path, terminalD7SecondaryRecord(label, chapters, replicate, runId, clock));
    }

    // ── Step 4: mint the block's selections once BOTH replicates are terminal. ──
    const siblingRep: Stage1Replicate = replicate === "r1" ? "r2" : "r1";
    const siblingRunId = stage1RunId(runHash, unit, siblingRep);
    const siblingRoots = bakeoffRoots(block.bookId, siblingRunId, deps.stateRoot);
    const siblingManifest = readManifest(siblingRoots);
    const thisComplete = invocationAuditsComplete(roots, manifest);
    const siblingComplete = siblingManifest !== null && invocationAuditsComplete(siblingRoots, siblingManifest);
    if (thisComplete && siblingComplete) {
      const mine = await mintInvocationSelection(block, runId, deps, runHash);
      const sibling = await mintInvocationSelection(block, siblingRunId, deps, runHash);
      summary.selection = {
        minted: mine.minted && sibling.minted,
        detail: `${replicate}: ${mine.detail} | ${siblingRep}: ${sibling.detail}`,
        winnerLabel: mine.winnerLabel,
      };
    } else {
      summary.selection = {
        minted: false,
        detail: thisComplete
          ? `deferred — sibling replicate ${siblingRep} has no terminal audits yet (block selection mints once BOTH replicates exist)`
          : "deferred — this invocation's audits are not all terminal",
        winnerLabel: null,
      };
    }
    log(`[stage1]   selection: ${summary.selection.detail}`);

    return finish(cellFailure ? 5 : 0);
  } catch (err) {
    if (err instanceof Stage1BudgetHalt) {
      summary.budget.haltDetail = err.message;
      log(`[stage1] ${err.message}`);
      return finish(3);
    }
    throw err;
  }
}

// ── The blind scoreboard ───────────────────────────────────────────────────────

export type Stage1ScoreboardCellV1 = {
  block: string;
  replicate: Stage1Replicate;
  label: BlindLabel;
  slot: string | null;
  diagnostic: number | null;
  confidence: string | null;
  terminalState: string | null;
  gatesPass: boolean | null;
  ineligibleReason: string | null;
};

export type Stage1ScoreboardV1 = {
  schema: "v25-stage1-scoreboard-v1";
  at: string;
  runHash: string;
  note: string;
  registered: {
    advanceFloor: number;
    blockFloor: number;
    floorsSource: string;
    bandW: number;
    d7LiteTolerance: number;
    ceiling: number;
    stage1Cap: number;
    stage1AtCapRule: string;
    preStage2Gate: string;
  };
  /** The incumbent's BLIND label (protocol §11 pairs Δs against the incumbent).
   *  Never a model name — the map stays sealed in the per-run manifests. */
  incumbentLabel: BlindLabel;
  cells: Stage1ScoreboardCellV1[];
  perLabel: Array<{
    label: BlindLabel;
    isIncumbent: boolean;
    completedCells: number;
    gateFailCells: number;
    perBlockMeans: Array<{ block: string; mean: number | null }>;
    meanDiagnostic: number | null;
    worstCell: { block: string; replicate: Stage1Replicate; value: number } | null;
    advanceFloorPass: boolean | null;
    blocksBelowBlockFloor: string[];
    blockFloorPass: boolean | null;
  }>;
  pairedDeltasVsIncumbent: Array<{
    label: BlindLabel;
    perBlock: Array<{ block: string; delta: number | null; replicatesPaired: number }>;
    meanDelta: number | null;
    signConsistent: boolean | null;
    exceedsW: boolean | null;
  }>;
  d7lite: {
    cells: Array<{ block: string; label: BlindLabel; value: number | null }>;
    drift: Array<{ block: string; unit: string; value: number | null; anchorValue: number | null; delta: number | null; pass: boolean | null }>;
    perChallenger: Array<{
      label: BlindLabel;
      perBlock: Array<{ block: string; deltaE: number | null; deltaD7: number | null; deltaEOverW: number | null; deltaD7OverTolerance: number | null }>;
      p1SignFlipBlocks: number;
      p2MeanNoiseUnitGap: number | null;
    }>;
  };
  uniformity: { checked: boolean };
  completeness: { expectedCells: number; foundCells: number; missing: string[] };
};

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildStage1Scoreboard(args: {
  runHash: string;
  pipelineDir?: string;
  stateRoot?: string;
  clock?: () => Date;
}): { cellsFound: number; scoreboard: Stage1ScoreboardV1 | null } {
  const pipelineDir = resolve(args.pipelineDir ?? PIPELINE_DIR);
  const stateRoot = resolve(args.stateRoot ?? resolve(pipelineDir, "state"));
  const clock = args.clock ?? (() => new Date());
  const blocks = stage1Blocks();

  // Sealed maps: model→label must be IDENTICAL across every run of this
  // runHash (the seeded shuffle guarantees it; verified here fail-closed —
  // aggregation by label over mixed maps would be silently meaningless).
  let canonicalMap: Map<string, BlindLabel> | null = null;
  const cells: Stage1ScoreboardCellV1[] = [];
  const d7Cells: Array<{ block: string; label: BlindLabel; value: number | null }> = [];
  const drift: Stage1ScoreboardV1["d7lite"]["drift"] = [];
  const missing: string[] = [];
  const labels = new Set<BlindLabel>();
  let incumbentLabel: BlindLabel | null = null;

  for (const block of blocks) {
    for (const replicate of STAGE1_REPLICATES) {
      const runId = stage1RunId(args.runHash, block.unit, replicate);
      const roots = bakeoffRoots(block.bookId, runId, stateRoot);
      const manifest = readManifest(roots);
      if (!manifest) {
        missing.push(`${block.unit}:${replicate} (no run)`);
        continue;
      }
      const runMap = new Map<string, BlindLabel>(
        Object.entries(manifest.blindMap).map(([label, model]) => [model, label as BlindLabel]),
      );
      if (canonicalMap === null) {
        canonicalMap = runMap;
      } else if (
        canonicalMap.size !== runMap.size ||
        [...canonicalMap].some(([model, label]) => runMap.get(model) !== label)
      ) {
        throw new Stage1DriverError(
          `blind-label maps differ across stage-1 runs (run ${runId}) — cross-run aggregation BY LABEL would be invalid; refusing to build the scoreboard`,
        );
      }
      const incumbent = runMap.get(STAGE1_INCUMBENT_MODEL);
      if (incumbent !== undefined) incumbentLabel = incumbent;

      for (const spec of manifest.candidates) {
        const label = runMap.get(spec.model);
        if (label === undefined) continue;
        labels.add(label);
        const diag = readJsonIf<CandidateEvalDiagnosticV1>(evalDiagnosticPath(roots, label));
        if (diag === null) {
          missing.push(`${block.unit}:${replicate}:${label}`);
          continue;
        }
        cells.push({
          block: block.unit,
          replicate,
          label,
          slot: spec.slot,
          diagnostic: diag.chapterDiagnostic,
          confidence: diag.confidence,
          terminalState: diag.terminalState,
          gatesPass: diag.gatesPass,
          ineligibleReason: diag.ineligibleReason ?? null,
        });
        if (replicate === "r1") {
          const d7 = readJsonIf<Stage1D7LiteCellSidecarV1>(d7liteSidecarPath(roots, label));
          if (d7 !== null) d7Cells.push({ block: block.unit, label, value: d7.value });
        }
      }
      if (replicate === "r1") {
        const d = readJsonIf<Stage1D7LiteCellSidecarV1>(d7liteSidecarPath(roots, "drift"));
        if (d !== null) drift.push({ block: block.unit, unit: d.unit, value: d.value, anchorValue: d.anchorValue, delta: d.delta, pass: d.pass });
      }
    }
  }

  if (cells.length === 0) return { cellsFound: 0, scoreboard: null };
  if (incumbentLabel === null) {
    throw new Stage1DriverError("the incumbent has no sealed blind label in any run manifest — cannot key paired Δs");
  }

  const labelList = [...labels].sort();
  const cellOf = (label: BlindLabel, block: string, replicate: Stage1Replicate): Stage1ScoreboardCellV1 | undefined =>
    cells.find((c) => c.label === label && c.block === block && c.replicate === replicate);

  const perLabel: Stage1ScoreboardV1["perLabel"] = labelList.map((label) => {
    const mine = cells.filter((c) => c.label === label);
    const scored = mine.filter((c) => c.diagnostic !== null);
    const perBlockMeans = blocks.map((b) => ({
      block: b.unit,
      mean: mean(scored.filter((c) => c.block === b.unit).map((c) => c.diagnostic!)),
    }));
    const blockMeansWithData = perBlockMeans.filter((b) => b.mean !== null);
    const meanDiagnostic = mean(blockMeansWithData.map((b) => b.mean!));
    const worst = scored.length === 0 ? null : scored.reduce((w, c) => (w === null || c.diagnostic! < w.diagnostic! ? c : w), null as Stage1ScoreboardCellV1 | null);
    const blocksBelow = blockMeansWithData.filter((b) => b.mean! < STAGE1_BLOCK_FLOOR).map((b) => b.block);
    return {
      label,
      isIncumbent: label === incumbentLabel,
      completedCells: scored.length,
      gateFailCells: mine.filter((c) => c.gatesPass === false).length,
      perBlockMeans,
      meanDiagnostic,
      worstCell: worst === null ? null : { block: worst.block, replicate: worst.replicate, value: worst.diagnostic! },
      advanceFloorPass: meanDiagnostic === null ? null : meanDiagnostic >= STAGE1_ADVANCE_FLOOR,
      blocksBelowBlockFloor: blocksBelow,
      blockFloorPass: blockMeansWithData.length === 0 ? null : blocksBelow.length === 0,
    };
  });

  const pairedDeltasVsIncumbent: Stage1ScoreboardV1["pairedDeltasVsIncumbent"] = labelList
    .filter((label) => label !== incumbentLabel)
    .map((label) => {
      const perBlock = blocks.map((b) => {
        const deltas: number[] = [];
        for (const replicate of STAGE1_REPLICATES) {
          const chal = cellOf(label, b.unit, replicate);
          const inc = cellOf(incumbentLabel!, b.unit, replicate);
          if (chal?.diagnostic != null && inc?.diagnostic != null) deltas.push(chal.diagnostic - inc.diagnostic);
        }
        return { block: b.unit, delta: mean(deltas), replicatesPaired: deltas.length };
      });
      const withData = perBlock.filter((b) => b.delta !== null);
      const meanDelta = mean(withData.map((b) => b.delta!));
      const signs = withData.map((b) => Math.sign(b.delta!)).filter((s) => s !== 0);
      const signConsistent = withData.length === 0 ? null : signs.length === withData.length && new Set(signs).size === 1;
      return {
        label,
        perBlock,
        meanDelta,
        signConsistent,
        exceedsW: meanDelta === null ? null : Math.abs(meanDelta) > STAGE1_BAND_W,
      };
    });

  const d7Of = (label: BlindLabel, block: string): number | null =>
    d7Cells.find((c) => c.label === label && c.block === block)?.value ?? null;
  const perChallenger: Stage1ScoreboardV1["d7lite"]["perChallenger"] = labelList
    .filter((label) => label !== incumbentLabel)
    .map((label) => {
      const perBlock = blocks.map((b) => {
        const eDelta = pairedDeltasVsIncumbent.find((p) => p.label === label)?.perBlock.find((x) => x.block === b.unit)?.delta ?? null;
        const chalD7 = d7Of(label, b.unit);
        const incD7 = d7Of(incumbentLabel!, b.unit);
        const d7Delta = chalD7 !== null && incD7 !== null ? chalD7 - incD7 : null;
        return {
          block: b.unit,
          deltaE: eDelta,
          deltaD7: d7Delta,
          deltaEOverW: eDelta === null ? null : eDelta / STAGE1_BAND_W,
          deltaD7OverTolerance: d7Delta === null ? null : d7Delta / STAGE1_D7LITE_TOLERANCE,
        };
      });
      const flips = perBlock.filter(
        (b) => b.deltaE !== null && b.deltaD7 !== null && Math.sign(b.deltaE) !== 0 && Math.sign(b.deltaD7) !== 0 && Math.sign(b.deltaE) !== Math.sign(b.deltaD7),
      ).length;
      const gaps = perBlock
        .filter((b) => b.deltaEOverW !== null && b.deltaD7OverTolerance !== null)
        .map((b) => b.deltaEOverW! - b.deltaD7OverTolerance!);
      return { label, perBlock, p1SignFlipBlocks: flips, p2MeanNoiseUnitGap: mean(gaps) };
    });

  const scoreboard: Stage1ScoreboardV1 = {
    schema: "v25-stage1-scoreboard-v1",
    at: clock().toISOString(),
    runHash: args.runHash,
    note: NOT_A_BOOK_SCORE_NOTE,
    registered: {
      advanceFloor: STAGE1_ADVANCE_FLOOR,
      blockFloor: STAGE1_BLOCK_FLOOR,
      floorsSource: STAGE1_FLOORS_SOURCE,
      bandW: STAGE1_BAND_W,
      d7LiteTolerance: STAGE1_D7LITE_TOLERANCE,
      ceiling: STAGE1_SESSION_CEILING,
      stage1Cap: STAGE1_STAGE_CAP,
      stage1AtCapRule: STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE,
      preStage2Gate: CITATIONS.preStage2Gate,
    },
    incumbentLabel,
    cells,
    perLabel,
    pairedDeltasVsIncumbent,
    d7lite: { cells: d7Cells, drift, perChallenger },
    uniformity: { checked: true },
    completeness: {
      expectedCells: blocks.length * STAGE1_REPLICATES.length * 3,
      foundCells: cells.length,
      missing,
    },
  };

  // Fail-closed blindness: the artifact must never carry a model-identity token
  // (the same scan the diagnostic package builder enforces). A hit throws — the
  // scoreboard is never written half-poisoned.
  assertNoModelIdentityLeak(scoreboard, "the stage-1 blind scoreboard");
  return { cellsFound: cells.length, scoreboard };
}

export function writeStage1Scoreboard(args: {
  runHash: string;
  pipelineDir?: string;
  stateRoot?: string;
  clock?: () => Date;
}): { cellsFound: number; outPath: string | null } {
  const pipelineDir = resolve(args.pipelineDir ?? PIPELINE_DIR);
  const stateRoot = resolve(args.stateRoot ?? resolve(pipelineDir, "state"));
  const { cellsFound, scoreboard } = buildStage1Scoreboard(args);
  if (scoreboard === null) return { cellsFound: 0, outPath: null };
  const outPath = resolve(stage1CampaignDir(stateRoot), `scoreboard-${args.runHash}.json`);
  writeJson(outPath, scoreboard);
  return { cellsFound, outPath };
}
