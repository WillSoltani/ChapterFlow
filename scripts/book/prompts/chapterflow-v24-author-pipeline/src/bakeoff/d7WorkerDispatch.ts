/**
 * Model bake-off — production D7 worker dispatch SEAM (WP-703, FINDING-2 / L-41).
 *
 * The bake-off PRIMARY judge is the Claude-side D7 rubric-audit instrument
 * (d7Judge.ts). It drives the harness through an injected `D7WorkerDispatch`
 * (`deps.d7Worker`), whose default is the fail-closed `unwiredD7Worker` — an
 * automated run MUST inject a real isolated-Claude-session dispatch or the judge
 * refuses rather than fabricate a score.
 *
 * HOW THE WP-401 D7 SHIP GATE DISPATCHES ITS RATERS (scoped, cited):
 *   `src/critics/d7ShipGate.ts` is MODEL-FREE by construction — its header states
 *   "The rating itself stays EXTERNAL — isolated Claude worker agents rate the
 *   app-faithful audit documents (zero codex/API); this module never invokes a
 *   model." The ship gate only MINTS a receipt from an ALREADY-adjudicated audit
 *   and EVALUATES it (`mintD7ShipGateReceiptFromAudit` / `evaluateD7ShipGate`).
 *   `src/orchestrator/generateBookCommand.ts` likewise only READS the receipt
 *   sidecar (`requireD7ShipGate`, `d7ShipGateHaltPath`) — it never spawns a rater.
 *   The rating (the Claude turn) is performed by EXTERNAL isolated Claude sessions
 *   the operator/orchestrator supplies; `rubricAuditHarness.ts` RENDERS the rater
 *   task and INGESTS the returned record, and that ingest is the ONLY point the
 *   session's outcome becomes visible to this codebase (where WP-503 already
 *   ledgers it).
 *
 * THEREFORE, per the WP-703 STOP condition, there is NO in-repo live dispatcher to
 * "reuse": the ship gate's dispatch mechanism IS an operator-supplied external
 * session. This module BUILDS the seam ADAPTER the execution lane wires: it takes
 * the SAME operator-supplied isolated-Claude-session runner and adapts it to the
 * `D7WorkerDispatch` the bake-off judge expects, adding (a) a WP-503 ledger entry
 * per dispatch (family `claude-side`) and (b) latency measurement the pure-ingest
 * choke point cannot observe. It NEVER fabricates a rater record — the default
 * runner is fail-closed. The orchestrator runbook (V25_BAKEOFF_STAGE1_SCREENING.md)
 * documents how the execution lane supplies real Claude sessions.
 */

import { resolve } from "node:path";

import { appendCallLedgerEntry } from "../telemetry/runCallLedger.js";
import type { ProviderOutcomeV1 } from "../contracts/routeContracts.js";
import type { D7WorkerDispatch, D7WorkerRequest } from "./d7Judge.js";
import { D7JudgeError } from "./d7Judge.js";
import { PIPELINE_DIR } from "./paths.js";

/** The ledger stage label for a D7 rater/adjudicator DISPATCH — DISTINCT from the
 *  harness ingest's `d7-rubric-audit` stage. One dispatch entry is appended per
 *  REAL external Claude call (resume skips dispatch, so this count never
 *  over-reports); the ingest entry records the validated OUTCOME. Ceiling
 *  accounting sums the dispatch entries. */
export const D7_DISPATCH_LEDGER_STAGE = "d7-rater-dispatch" as const;

/**
 * The operator/orchestrator-supplied isolated-Claude-session runner. Given a
 * self-contained, ALREADY-leak-checked rater task (the D7 judge runs
 * `assertNoIdentityLeak` before calling the dispatch), it runs ONE isolated
 * Claude session and returns that worker's record JSON text VERBATIM. This is the
 * SAME external-session mechanism the ship gate's raters use — supplied by the
 * execution lane, never implemented in-repo (there is no live dispatcher here to
 * fabricate). Tests inject a double.
 */
export type IsolatedClaudeSessionRunner = (req: D7WorkerRequest) => Promise<string>;

/** The fail-closed default runner: without an operator-supplied isolated-session
 *  runner the seam refuses rather than invent a rating. */
export const unwiredIsolatedClaudeSession: IsolatedClaudeSessionRunner = async (req) => {
  throw new D7JudgeError(
    `no isolated-Claude-session runner supplied for the D7 dispatch (unit ${req.unit} ${req.role}). The bake-off D7 ` +
      "judge's rating is an EXTERNAL isolated Claude session (the same mechanism the D7 ship gate's raters use), which " +
      "the execution lane supplies — it is never fabricated in-repo. Provide createD7WorkerDispatch({ sessionRunner }).",
  );
};

export type CreateD7WorkerDispatchArgs = {
  /** The real isolated-Claude-session runner (execution lane). Omitted ⇒
   *  fail-closed default; the seam never fabricates a record. */
  sessionRunner?: IsolatedClaudeSessionRunner;
  /** Pipeline dir the WP-503 ledger writes under (default PIPELINE_DIR). */
  pipelineDir?: string;
  /** Wall clock (injectable for deterministic tests). */
  now?: () => number;
  log?: (m: string) => void;
};

/** Classify a dispatch failure into the frozen provider-outcome taxonomy without
 *  guessing: only a genuine timeout signal maps to `timeout`; everything else is
 *  an infrastructure failure (the ingest path classifies content validity). */
function classifyDispatchFailure(error: unknown): ProviderOutcomeV1 {
  const message = error instanceof Error ? error.message : String(error);
  if (/timed out|timeout/i.test(message)) return "timeout";
  return "infrastructure_failure";
}

/**
 * Adapt an operator-supplied isolated-Claude-session runner into the
 * `D7WorkerDispatch` the bake-off judge consumes, ledgering every dispatch
 * (WP-503, family `claude-side`) with a measured latency. One ledger entry per
 * REAL external Claude call. A runner failure is ledgered and RE-THROWN (the D7
 * judge turns a worker throw into an INELIGIBLE candidate — never a fabricated
 * score). Telemetry is best-effort: a ledger write bug never bricks a valid
 * rating.
 */
export function createD7WorkerDispatch(args: CreateD7WorkerDispatchArgs = {}): D7WorkerDispatch {
  const sessionRunner = args.sessionRunner ?? unwiredIsolatedClaudeSession;
  const pipelineDir = args.pipelineDir ?? PIPELINE_DIR;
  const now = args.now ?? Date.now;
  const log = args.log ?? (() => {});

  return async (req: D7WorkerRequest): Promise<string> => {
    const startMs = now();
    const ledger = (outcome: ProviderOutcomeV1, latencyMs: number | null): void => {
      try {
        appendCallLedgerEntry({
          pipelineDir: resolve(pipelineDir),
          bookId: req.bookId,
          runId: req.auditId,
          family: "claude-side",
          stage: D7_DISPATCH_LEDGER_STAGE,
          role: req.role,
          // The external Claude session's model/effort are genuinely unobservable
          // to this process — recorded null, never a guessed value.
          model: null,
          effort: null,
          latencyMs,
          outcome,
          sessionId: `${req.auditId}/${req.unit}/${req.role}`,
        });
      } catch {
        /* telemetry must never brick a valid D7 rating dispatch */
      }
    };

    try {
      const recordText = await sessionRunner(req);
      ledger("content_completed", Math.max(0, now() - startMs));
      return recordText;
    } catch (error) {
      const outcome = classifyDispatchFailure(error);
      ledger(outcome, Math.max(0, now() - startMs));
      log(`[bakeoff] d7-dispatch ${req.unit} ${req.role}: FAILED (${outcome}) — ${(error as Error).message.split("\n")[0]}`);
      throw error;
    }
  };
}
