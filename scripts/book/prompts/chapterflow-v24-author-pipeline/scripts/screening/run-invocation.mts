/**
 * WP-703 — Stage-1 SCREENING EXECUTION DRIVER (registered-invocation runner).
 *
 * The orchestrator runs this driver ONCE per registered conductor invocation:
 *
 *     npx tsx scripts/screening/run-invocation.mts <invocationId>
 *
 * where <invocationId> is one of the SIX conductor `runId`s registered in
 * `SCREENING_PLAN` (src/bakeoff/screeningPlan.ts) and its byte-bound companion
 * `docs/v25/implementation/V25_BAKEOFF_STAGE1_SCREENING.plan.json`:
 *
 *     stage1-nudge-ch03-xhigh-trio                     stage1-nudge-ch03-sol-high
 *     stage1-made-to-stick-ch04-xhigh-trio             stage1-made-to-stick-ch04-sol-high
 *     stage1-the-happiness-hypothesis-ch06-xhigh-trio  stage1-the-happiness-hypothesis-ch06-sol-high
 *
 * This driver COMPOSES existing pipeline modules — it adds NO product code and
 * changes NO product source. It is the execution lane the WP-703 BUILD half
 * (plan + decision functions + no-draft corpus intake + D7 dispatch seam)
 * deliberately left orchestrator-owned. Everything it needs — book, chapter,
 * models, effort, calibration unit, advisory judge — is resolved from the
 * REGISTERED plan only; there is NO CLI override for the bar, caps, models,
 * calibration, or judge (rt703 OBS-B: the execution lane passes registered
 * defaults, never a hand-tuned config).
 *
 * What it does, in order:
 *   1. Refuse unless OPENAI_API_KEY is absent (the orchestrator launches this
 *      with `env -u OPENAI_API_KEY` so no codex-exec child can inherit it).
 *   2. Load SCREENING_PLAN + the on-disk companion and REFUSE ON DRIFT (the
 *      companion must be byte-identical to screeningPlanJson()).
 *   3. Resolve the invocation's {run, models, effort, calibrationUnit,
 *      advisoryJudge} from the registered values only.
 *   4. Read the WP-503 unified ledger (state/run-ledger/**) and enforce the
 *      session budget BEFORE spawning: the ≤18 authoring / ≤40 total caps via
 *      the registered ScreeningSessionBudget, and the 150 campaign ceiling
 *      directly — a would-be overshoot HALTS before the run (never a warning).
 *   5. Consult the ultra-acceptance probe ONCE per campaign BEFORE the first
 *      rating spawn (WP-E22): a prior accepted sidecar is reused; otherwise the
 *      probe runs and, on accepted:false / absent, the invocation HALTS — the D7
 *      raters are Sol-ultra codex sessions and an unaccepted ultra token would
 *      spawn every rating at the wrong effort.
 *   6. Wire deps.d7Worker = createD7CodexWorkerDispatch(…) — each D7 rating is an
 *      envelope-proven GPT-5.6 Sol @ ultra codex session (the D7 rater is codex-only
 *      per execution plan §4 / V25-NEW-01), ledgered family codex-exec with
 *      the real model/effort — and wire deps.logSession to mirror every codex
 *      authoring/repair spawn into the WP-503 ledger (family codex-exec) so the
 *      ledger is the true cross-invocation session-count source of truth.
 *   7. Invoke the corpus-mode runBakeoff exactly as the tests do (compare-only,
 *      resume-safe) with the registered advisory judge, then print progress and
 *      a final JSON summary.
 *
 * MODEL-FREE at BUILD time: importing/typechecking this module spawns nothing.
 * A live call happens only when the orchestrator runs it with a valid
 * invocation id.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCREENING_PLAN,
  screeningPlanJson,
  ScreeningSessionBudget,
  ScreeningCapError,
  type ScreeningRun,
  type ConductorInvocation,
} from "../../src/bakeoff/screeningPlan.js";
import { runBakeoff, resolveBakeoffDeps, type BakeoffOutcome, type BakeoffDeps } from "../../src/bakeoff/runBakeoff.js";
import { createD7CodexWorkerDispatch, assertUltraProbeAccepted, D7_DISPATCH_LEDGER_STAGE } from "../../src/bakeoff/d7WorkerDispatch.js";
import { D7JudgeError } from "../../src/bakeoff/d7Judge.js";
import { runUltraAcceptanceProbe, type UltraAcceptanceProbeV1 } from "../../src/exec/ultraSession.js";
import { resolveD7RaterRoute } from "../../src/orchestrator/modelPolicy.js";
import type { ReasoningEffort, CandidateScorecardV1 } from "../../src/bakeoff/types.js";
import { PIPELINE_DIR } from "../../src/bakeoff/paths.js";
import { appendCallLedgerEntry, readCallLedgerEntries, type RunCallLedgerEntryV1 } from "../../src/telemetry/runCallLedger.js";
import { classifySessionLabel } from "../../src/orchestrator/sessionLedger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** The git repository root (four levels up from the pipeline dir), where the
 *  registered plan companion lives. Same derivation the screening test uses. */
const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const COMPANION_PATH = resolve(REPOSITORY_ROOT, "docs/v25/implementation/V25_BAKEOFF_STAGE1_SCREENING.plan.json");

/** The three books the screening screens — used to scope the ≤18/≤40 caps to the
 *  screening's own ledger slices (the 150 ceiling is campaign-wide). */
const SCREENING_BOOK_IDS = new Set(SCREENING_PLAN.runs.map((r) => r.bookId));

/** The D7 rubric-audit harness dispatches EXACTLY one rating session per
 *  (unit, role): each candidate audits its chapter subset PLUS one hidden
 *  calibration unit, over the three roles primary/verification/adjudicator
 *  (d7Judge.ts roleOrder). This is the worst-case D7 dispatch count per candidate
 *  used ONLY for the 150-ceiling projection. */
const D7_ROLES_PER_UNIT = 3;

/** Campaign-shared dir for the once-per-campaign ultra-acceptance probe sidecar
 *  (WP-E22): the same accepted proof is reused across all six invocations. */
const ULTRA_ACCEPTANCE_DIR = resolve(PIPELINE_DIR, "state", "model-bakeoffs", "_campaign", "ultra-acceptance");

// ── Small helpers ───────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

class DriverRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriverRefusal";
  }
}

/** The six registered conductor invocation ids (for the usage message). */
function registeredInvocationIds(): string[] {
  return SCREENING_PLAN.runs.flatMap((r) => r.conductorInvocations.map((i) => i.runId));
}

/** Locate the {run, invocation} pair for an id — from the registered plan ONLY. */
function resolveInvocation(invocationId: string): { run: ScreeningRun; invocation: ConductorInvocation } {
  for (const run of SCREENING_PLAN.runs) {
    for (const invocation of run.conductorInvocations) {
      if (invocation.runId === invocationId) return { run, invocation };
    }
  }
  throw new DriverRefusal(
    `unknown invocation id "${invocationId}". The driver runs ONLY the six registered conductor invocations:\n  - ${registeredInvocationIds().join("\n  - ")}`,
  );
}

// ── Deliverable 2: the WP-503 ledger read + session-budget enforcement ──────────

type LedgerCounts = {
  /** Campaign-wide: every codex-exec authoring/repair/advisory-judge spawn. */
  codexExecSessions: number;
  /** Campaign-wide: every D7 rater/adjudicator DISPATCH (WP-E22: family codex-exec). */
  d7RaterDispatches: number;
  /** Campaign-wide ceiling currency = codex-exec + d7-rater-dispatch. */
  campaignSessions: number;
  /** Screening-scoped: codex-exec WRITER spawns (the ≤18 authoring-cap currency). */
  screeningAuthoring: number;
  /** Screening-scoped: ALL codex-exec spawns (the ≤40 total-cap currency; see NOTE). */
  screeningCodexSessions: number;
  /** Screening-scoped: D7 rater dispatches (accounted against the 150 ceiling). */
  screeningD7Dispatches: number;
};

/** Read EVERY WP-503 ledger slice under state/run-ledger/<bookId>/<runId>.jsonl.
 *  The running total is READ here — it is never hardcoded (plan §7). */
function readAllLedgerEntries(pipelineDir: string): RunCallLedgerEntryV1[] {
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
      const runId = f.slice(0, -".jsonl".length);
      try {
        out.push(...readCallLedgerEntries(pipelineDir, bookId, runId));
      } catch {
        /* a corrupt slice never bricks the budget read — skip it */
      }
    }
  }
  return out;
}

function computeLedgerCounts(pipelineDir: string): LedgerCounts {
  const entries = readAllLedgerEntries(pipelineDir);
  // A D7 rater/adjudicator dispatch is identified by its UNIQUE stage label,
  // independent of family: WP-E22 flipped it to family codex-exec (the Sol-ultra
  // codex session), but a legacy dispatch under the retired rater family from a
  // prior run must still count. Excluding D7 from the codex-authoring tallies keeps
  // the ≤40 total-cap semantics (authoring + repairs + advisory, NOT D7) and the
  // campaign total (codex + D7, never double-counted) intact across the family flip.
  const isD7Dispatch = (e: RunCallLedgerEntryV1): boolean => e.stage === D7_DISPATCH_LEDGER_STAGE;
  const isCodexNonD7 = (e: RunCallLedgerEntryV1): boolean => e.family === "codex-exec" && !isD7Dispatch(e);
  // A resume-time re-ingest re-reads already-persisted bytes — it is NOT a live
  // spend and must never inflate a ceiling (execution plan §"D7 → Sol-Ultra":
  // only `session` entries count). `undefined` (legacy, pre-WP-E41 persistence) is
  // counted conservatively — the ceiling check never under-counts real spend.
  const isLiveSpend = (e: RunCallLedgerEntryV1): boolean => e.sessionKind !== "reingest";
  const inScreening = (e: RunCallLedgerEntryV1): boolean => SCREENING_BOOK_IDS.has(e.bookId);

  const codexExecSessions = entries.filter((e) => isCodexNonD7(e) && isLiveSpend(e)).length;
  const d7RaterDispatches = entries.filter((e) => isD7Dispatch(e) && isLiveSpend(e)).length;
  const screeningAuthoring = entries.filter((e) => isCodexNonD7(e) && isLiveSpend(e) && inScreening(e) && classifySessionLabel(e.stage) === "writer").length;
  const screeningCodexSessions = entries.filter((e) => isCodexNonD7(e) && isLiveSpend(e) && inScreening(e)).length;
  const screeningD7Dispatches = entries.filter((e) => isD7Dispatch(e) && isLiveSpend(e) && inScreening(e)).length;

  return {
    codexExecSessions,
    d7RaterDispatches,
    campaignSessions: codexExecSessions + d7RaterDispatches,
    screeningAuthoring,
    screeningCodexSessions,
    screeningD7Dispatches,
  };
}

/**
 * Enforce the registered session budget BEFORE spawning (deliverable 2). Halts
 * (throws) if this invocation's WORST CASE would breach the ≤18 authoring, ≤40
 * total, or 150-ceiling caps. Never lowers or raises a cap to fit.
 *
 * Accounting model (documented; see the README "Budget accounting" section):
 *   - authoring worst case  = models × chapters codex WRITER spawns (the known
 *     minimum; retries/repairs are ledgered live and seen by the NEXT invocation).
 *   - the ≤18 / ≤40 caps are the registered ScreeningSessionBudget's currencies:
 *     18 = codex WRITER spawns, 40 = ALL codex spawns (authoring + repairs +
 *     advisory-judge). D7 dispatches (their own d7-rater-dispatch stage; WP-E22
 *     flipped them to family codex-exec) are accounted against the 150 ceiling,
 *     NOT the 40 codex-session cap (see the GAP note in the README).
 *   - the 150 ceiling worst case = campaign ledger total + this invocation's
 *     authoring + its bounded D7-dispatch worst case.
 */
function assertBudgetOrHalt(run: ScreeningRun, invocation: ConductorInvocation, counts: LedgerCounts): {
  authoringWorstCase: number;
  d7WorstCase: number;
} {
  const authoringWorstCase = invocation.models.length * run.chapters.length;
  // Each candidate audits its chapter subset + 1 hidden calibration unit, over 3 roles.
  const d7WorstCase = invocation.models.length * (run.chapters.length + 1) * D7_ROLES_PER_UNIT;

  // ≤18 authoring / ≤40 total — via the REGISTERED ScreeningSessionBudget. Seed it
  // with the screening's prior ledgered spend, then reserve THIS invocation's
  // authoring; ScreeningSessionBudget throws BEFORE the offending session.
  const budget = new ScreeningSessionBudget(); // registered caps (18/40)
  try {
    for (let i = 0; i < counts.screeningAuthoring; i++) budget.reserveAuthoring("prior-authoring (ledger)");
    for (let i = 0; i < counts.screeningCodexSessions - counts.screeningAuthoring; i++) budget.reserveRepair("prior-non-authoring codex (ledger)");
    for (let i = 0; i < authoringWorstCase; i++) budget.reserveAuthoring(`${invocation.runId} candidate authoring`);
  } catch (err) {
    if (err instanceof ScreeningCapError) {
      throw new DriverRefusal(
        `session-budget HALT (≤18 authoring / ≤40 total) before starting "${invocation.runId}": ${err.message}`,
      );
    }
    throw err;
  }

  // 150 campaign ceiling — codex-exec + D7 dispatches across the whole Phase-6.
  const ceiling = SCREENING_PLAN.ledgerAccounting.campaignSessionCeiling;
  const projectedCampaign = counts.campaignSessions + authoringWorstCase + d7WorstCase;
  if (projectedCampaign > ceiling) {
    throw new DriverRefusal(
      `campaign-ceiling HALT before starting "${invocation.runId}": the ledger already records ${counts.campaignSessions} Phase-6 sessions ` +
        `(${counts.codexExecSessions} codex-exec + ${counts.d7RaterDispatches} d7-rater-dispatch); this invocation's worst case adds ` +
        `${authoringWorstCase} authoring + ${d7WorstCase} D7 dispatches → ${projectedCampaign} > ${ceiling}. Halting BEFORE the offending session (the ceiling is never raised).`,
    );
  }

  return { authoringWorstCase, d7WorstCase };
}

// ── Deliverable 3 (WP-E22): the once-per-campaign ultra-acceptance gate ──────────

/** Read the campaign's ultra-acceptance probe sidecar if it exists, else null. The
 *  filename matches `runUltraAcceptanceProbe`'s writer (`ultra-acceptance-probe.json`). */
function readUltraProbeSidecar(probeDir: string): UltraAcceptanceProbeV1 | null {
  try {
    return JSON.parse(readFileSync(resolve(probeDir, "ultra-acceptance-probe.json"), "utf8")) as UltraAcceptanceProbeV1;
  } catch {
    return null;
  }
}

/**
 * Consult the ultra-acceptance probe BEFORE the first rating spawn (execution plan
 * §4). The probe proves the installed codex CLI accepts `model_reasoning_effort=
 * ultra` at runtime — static `.codex/agents/*.toml` evidence is NOT proof. It runs
 * ONCE per campaign: a prior accepted sidecar is reused (all six invocations share
 * it); otherwise the probe runs live now. `assertUltraProbeAccepted` HALTS on a
 * missing/`accepted:false` result — the D7 raters are Sol-ultra codex sessions and
 * an unaccepted ultra token would spawn every rating at the wrong effort.
 */
async function ensureUltraAcceptedOrHalt(): Promise<void> {
  let probe = readUltraProbeSidecar(ULTRA_ACCEPTANCE_DIR);
  if (probe !== null && probe.accepted) {
    log(`[screening]   ultra-acceptance: reusing accepted probe (${probe.probedAt}) at ${ULTRA_ACCEPTANCE_DIR}`);
  } else {
    log(`[screening]   ultra-acceptance: running the probe once (installed CLI must accept model_reasoning_effort=ultra)…`);
    probe = await runUltraAcceptanceProbe({ route: resolveD7RaterRoute(), probeDir: ULTRA_ACCEPTANCE_DIR });
    log(`[screening]   ultra-acceptance: accepted=${probe.accepted} — ${probe.detail}`);
  }
  assertUltraProbeAccepted(probe); // throws D7JudgeError on a non-accepted probe
}

// ── Deliverable 5: the ledgered codex logSession sink ───────────────────────────

/**
 * Mirror every codex authoring/repair spawn into the WP-503 run-ledger (family
 * codex-exec). runBakeoff's default deps (resolveBakeoffDeps → resolveDeps →
 * logSessionToDisk) write ONLY the forensic autopilot-logs sink and do NOT emit
 * a run-ledger entry (buildLedgeredDeps is applied inside runAutopilot, NOT in
 * runBakeoff). The execution lane wires this so the ledger is the true
 * cross-invocation session-count source of truth. Mirrors buildLedgeredDeps'
 * body; telemetry is best-effort and never bricks the run. See the README GAP note.
 */
function buildLedgeredLogSession(runId: string, base: BakeoffDeps["logSession"]): BakeoffDeps["logSession"] {
  return (bookId, label, r) => {
    try {
      appendCallLedgerEntry({
        pipelineDir: PIPELINE_DIR,
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
      });
    } catch {
      /* telemetry never halts a run */
    }
    base(bookId, label, r);
  };
}

// ── Deliverable 4 + 6: the final per-candidate + ledger summary ─────────────────

type CandidateSummary = {
  model: string;
  effort: string | null;
  d7Composite: number | null;
  d7GatesPass: boolean | null;
  floorEligible: boolean;
};

function summarizePerCandidate(reportJson: unknown, invocation: ConductorInvocation): CandidateSummary[] {
  const report = reportJson as {
    runConfiguration?: { candidates?: Array<{ model?: string; effort?: string }> };
    selection?: { scorecards?: CandidateScorecardV1[] };
  };
  const scorecards = report.selection?.scorecards ?? [];
  const effortByModel = new Map<string, string>();
  for (const c of report.runConfiguration?.candidates ?? []) {
    if (c.model) effortByModel.set(c.model, c.effort ?? String(invocation.effort));
  }
  return scorecards.map((sc) => ({
    model: sc.model,
    effort: effortByModel.get(sc.model) ?? String(invocation.effort),
    d7Composite: sc.d7Composite,
    d7GatesPass: sc.d7GatesPass,
    // "floor eligible" = passed the deterministic floor AND the D7 gate (the
    // composite eligibility ScoreCard.eligible encodes).
    floorEligible: sc.eligible,
  }));
}

// ── main ────────────────────────────────────────────────────────────────────────

async function main(argv: string[]): Promise<number> {
  const invocationId = argv[0];
  if (!invocationId || invocationId === "--help" || invocationId === "-h") {
    log(`usage: npx tsx scripts/screening/run-invocation.mts <invocationId>\n\nRegistered invocation ids:\n  - ${registeredInvocationIds().join("\n  - ")}`);
    return invocationId ? 0 : 2;
  }

  // 1. OPENAI_API_KEY must be absent (deliverable 5). The orchestrator launches
  //    this with `env -u OPENAI_API_KEY` so no codex child can inherit it.
  if (process.env.OPENAI_API_KEY !== undefined) {
    log(`[screening] REFUSED: OPENAI_API_KEY is set in the environment. Launch the driver with:\n  env -u OPENAI_API_KEY npx tsx scripts/screening/run-invocation.mts ${invocationId}`);
    return 3;
  }

  // 2. Load SCREENING_PLAN + the on-disk companion; REFUSE ON DRIFT.
  let companion: string;
  try {
    companion = readFileSync(COMPANION_PATH, "utf8");
  } catch (err) {
    log(`[screening] REFUSED: cannot read the registered plan companion at ${COMPANION_PATH}: ${(err as Error).message}`);
    return 4;
  }
  if (companion !== screeningPlanJson()) {
    log(`[screening] REFUSED: the on-disk plan companion has DRIFTED from SCREENING_PLAN (screeningPlanJson()). The registered numbers must be byte-identical; refusing rather than run a drifted plan.\n  companion: ${COMPANION_PATH}`);
    return 4;
  }

  // 3. Resolve the invocation from REGISTERED values only (no CLI overrides).
  let run: ScreeningRun;
  let invocation: ConductorInvocation;
  try {
    ({ run, invocation } = resolveInvocation(invocationId));
  } catch (err) {
    log(`[screening] REFUSED: ${(err as Error).message}`);
    return 5;
  }

  log(`[screening] invocation ${invocation.runId}`);
  log(`[screening]   book=${run.bookId} chapters=${run.chapters.join(",")} unit=${run.unit}`);
  log(`[screening]   models=[${invocation.models.join(", ")}] effort=${invocation.effort}`);
  log(`[screening]   calibrationUnit=${run.calibrationUnit} advisoryJudge=${run.advisoryJudge.model}@${run.advisoryJudge.effort}`);

  // 4. Read the ledger and enforce the session budget BEFORE spawning.
  const preCounts = computeLedgerCounts(PIPELINE_DIR);
  log(`[screening]   ledger (pre): campaign=${preCounts.campaignSessions} (codex=${preCounts.codexExecSessions}, d7=${preCounts.d7RaterDispatches}); screening authoring=${preCounts.screeningAuthoring}/${SCREENING_PLAN.caps.maxAuthoringRuns} codex=${preCounts.screeningCodexSessions}/${SCREENING_PLAN.caps.maxTotalSessions}`);
  let worst: { authoringWorstCase: number; d7WorstCase: number };
  try {
    worst = assertBudgetOrHalt(run, invocation, preCounts);
  } catch (err) {
    if (err instanceof DriverRefusal) {
      log(`[screening] ${err.message}`);
      return 6;
    }
    throw err;
  }
  log(`[screening]   budget OK: worst case +${worst.authoringWorstCase} authoring, +${worst.d7WorstCase} D7 dispatches (ceiling ${SCREENING_PLAN.ledgerAccounting.campaignSessionCeiling})`);

  // 5. Consult the ultra-acceptance probe BEFORE the first rating spawn; HALT if
  //    the installed CLI has not proven it accepts model_reasoning_effort=ultra.
  try {
    await ensureUltraAcceptedOrHalt();
  } catch (err) {
    if (err instanceof D7JudgeError) {
      log(`[screening] ultra-acceptance HALT before starting "${invocation.runId}": ${err.message}`);
      return 9;
    }
    throw err;
  }

  // 6. Wire the D7 dispatch (Sol-ultra codex session per rating, WP-E22) + the
  //    ledgered codex logSession. The D7 rater is codex-only (V25-NEW-01).
  const forensicBase = resolveBakeoffDeps();
  const deps: Partial<BakeoffDeps> = {
    d7Worker: createD7CodexWorkerDispatch({ pipelineDir: PIPELINE_DIR, log }),
    logSession: buildLedgeredLogSession(invocation.runId, forensicBase.logSession),
  };

  // 7. Invoke the corpus-mode runBakeoff (compare-only, resume-safe) with the
  //    registered advisory judge. runId = the invocation id ⇒ the run tree lands
  //    at state/model-bakeoffs/<bookId>/<invocationId>/ (plan §10).
  log(`[screening] starting corpus-mode runBakeoff (compare-only, resume-safe)…`);
  let outcome: BakeoffOutcome;
  try {
    outcome = await runBakeoff({
      runId: invocation.runId,
      corpus: { bookId: run.bookId, chapters: run.chapters },
      models: invocation.models,
      effort: invocation.effort as ReasoningEffort,
      judgeModel: run.advisoryJudge.model,
      judgeEffort: run.advisoryJudge.effort as ReasoningEffort,
      calibrationUnit: run.calibrationUnit,
      deps,
    });
  } catch (err) {
    log(`[screening] runBakeoff FAILED for ${invocation.runId}: ${(err as Error).message}`);
    return 7;
  }

  log(`[screening] runBakeoff status=${outcome.status}${outcome.reason ? ` reason=${outcome.reason}` : ""}`);

  // Build the final summary from the run's report + a fresh ledger read.
  const postCounts = computeLedgerCounts(PIPELINE_DIR);
  let perCandidate: CandidateSummary[] = [];
  const reportPath = outcome.reportJsonPath ? resolve(PIPELINE_DIR, outcome.reportJsonPath) : null;
  if (reportPath) {
    try {
      perCandidate = summarizePerCandidate(JSON.parse(readFileSync(reportPath, "utf8")), invocation);
    } catch (err) {
      log(`[screening] WARNING: could not read the run report at ${reportPath}: ${(err as Error).message}`);
    }
  }

  const summary = {
    invocationId: invocation.runId,
    bookId: run.bookId,
    chapters: run.chapters,
    status: outcome.status,
    perCandidate,
    ledgerCounts: {
      campaignSessions: postCounts.campaignSessions,
      codexExecSessions: postCounts.codexExecSessions,
      d7RaterDispatches: postCounts.d7RaterDispatches,
      campaignSessionCeiling: SCREENING_PLAN.ledgerAccounting.campaignSessionCeiling,
      screeningAuthoring: postCounts.screeningAuthoring,
      screeningCodexSessions: postCounts.screeningCodexSessions,
      screeningD7Dispatches: postCounts.screeningD7Dispatches,
    },
  };
  log(`SCREENING_INVOCATION_SUMMARY ${JSON.stringify(summary)}`);
  // A compare-only corpus run's terminal status is "compared"; anything else
  // (halt/…) is a non-clean exit the orchestrator should inspect.
  return outcome.status === "compared" || outcome.status === "complete" ? 0 : 8;
}

// Execute ONLY when run as a script (never on import/typecheck).
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`[screening] UNEXPECTED: ${(err as Error).stack ?? String(err)}\n`);
      process.exit(1);
    });
}

export { main };
