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
 *
 * WP-E22 (execution plan §4, V25-NEW-01): the D7 operational reviewer is NO LONGER
 * a Claude session — no Claude-family model may rate a book or chapter. The
 * production driver wires `createD7CodexWorkerDispatch` (below), which drives an
 * envelope-proven GPT-5.6 Sol @ ultra codex session per rating (`ultraSession.ts`)
 * and ledgers family `codex-exec` with the REAL model/effort read back from the
 * spawn's manifest — never a `null`, never a Claude string. Each dispatch lands in
 * an attempt-numbered dir (`attempt-001`, `attempt-002`, …); a failed reply is
 * NEVER deleted, so every attempt stays inspectable, and a resume RE-INGESTS the
 * completed attempt's persisted bytes (ledger `sessionKind:"reingest"`) rather than
 * re-spawning (a fresh ultra session returns different bytes the immutable-evidence
 * store rejects). The legacy Claude adapter above is KEPT as the seam's fixed
 * `D7WorkerDispatch` shape (d7Judge.ts is untouched) but is no longer wired by any
 * production driver — WP-E26 quarantines the remaining Claude rating surface.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { appendCallLedgerEntry } from "../telemetry/runCallLedger.js";
import type { ProviderOutcomeV1 } from "../contracts/routeContracts.js";
import { hashCanonical } from "../contracts/contractUtil.js";
import type { D7WorkerDispatch, D7WorkerRequest, D7WorkerReturn } from "./d7Judge.js";
import { D7JudgeError } from "./d7Judge.js";
import { PIPELINE_DIR } from "./paths.js";
import { resolveD7RaterRoute } from "../orchestrator/modelPolicy.js";
import {
  runUltraSession,
  ULTRA_EFFORT,
  type UltraAcceptanceProbeV1,
  type UltraSessionDepsV1,
  type UltraSessionRequestV1,
  type UltraSessionResultV1,
} from "../exec/ultraSession.js";

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

// ── WP-E22: the Sol-ultra codex D7 dispatch (replaces the Claude path) ──────────

/** D7 rater/adjudicator ultra session timeout — generous (a deep-reasoning ultra
 *  rating over a full chapter package). */
export const D7_CODEX_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

/** The completion marker a successful attempt persists beside its extracted
 *  record. Its presence (with `ok:true`) is what makes a resume RE-INGEST the
 *  attempt's bytes instead of spawning a fresh — and wrong-byte — session. Written
 *  LAST (after `record.json`) so a torn write is never mistaken for a completion. */
type D7CodexAttemptResultV1 = {
  schemaVersion: "d7-codex-attempt-result-v1";
  ok: true;
  /** The RESOLVED model/effort from the spawn's effective-context manifest. */
  model: string;
  effort: string;
  sessionId: string;
  manifestPath: string;
  manifestSha256: string;
  at: string;
};

/** The single-session runner this factory drives. Default `runUltraSession`; a
 *  test injects a double so no real codex process launches. */
type RunUltraSessionFn = (req: UltraSessionRequestV1, deps?: UltraSessionDepsV1) => Promise<UltraSessionResultV1>;

export type CreateD7CodexWorkerDispatchArgs = {
  /** The ultra-session runner (default `runUltraSession`). Tests inject a double. */
  runUltra?: RunUltraSessionFn;
  /** Extra deps forwarded to every `runUltraSession` (the per-attempt manifest sink
   *  is set by this factory and always wins). Tests never need this. */
  ultraDeps?: UltraSessionDepsV1;
  /** Pipeline dir the attempt dirs + WP-503 ledger write under (default PIPELINE_DIR). */
  pipelineDir?: string;
  /** Per-session timeout (default D7_CODEX_SESSION_TIMEOUT_MS). */
  timeoutMs?: number;
  log?: (m: string) => void;
  /** Ledger-append seam (default `appendCallLedgerEntry`). This dispatch ALWAYS
   *  supplies `sessionKind` + `attemptIndex`; WP-E41 owns persisting them, and a
   *  test double captures them here directly (independent of that merge). */
  appendLedger?: typeof appendCallLedgerEntry;
  /** Clock for the attempt-result sidecar timestamp (tests). */
  clock?: () => Date;
};

const D7_CODEX_SESSION_SEGMENT = "codex-sessions" as const;
const ATTEMPT_DIR_RE = /^attempt-(\d{3,})$/;

/** The per-(book, audit, unit, role) base dir under which the attempt-NNN dirs
 *  accumulate. Exported so the driver + tests address the exact same location. */
export function d7CodexSessionBaseDir(pipelineDir: string, req: Pick<D7WorkerRequest, "bookId" | "auditId" | "unit" | "role">): string {
  return resolve(pipelineDir, "state", "model-bakeoffs", req.bookId, D7_CODEX_SESSION_SEGMENT, req.auditId, `${req.unit}-${req.role}`);
}

function attemptDirPath(baseDir: string, index: number): string {
  return resolve(baseDir, `attempt-${String(index).padStart(3, "0")}`);
}

/** Existing attempt dirs, ascending by index (empty if the base dir is absent). */
function listAttemptDirs(baseDir: string): Array<{ dir: string; index: number }> {
  let names: string[];
  try {
    names = readdirSync(baseDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
  const out: Array<{ dir: string; index: number }> = [];
  for (const name of names) {
    const m = ATTEMPT_DIR_RE.exec(name);
    if (m) out.push({ dir: resolve(baseDir, name), index: Number(m[1]) });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** The HIGHEST-indexed attempt that already persisted returnable bytes (a
 *  completion marker + a record). `null` when no attempt completed — the caller
 *  then opens the NEXT attempt and spawns. */
function readCompletedAttempt(baseDir: string): { result: D7CodexAttemptResultV1; record: string; index: number } | null {
  const attempts = listAttemptDirs(baseDir);
  for (let i = attempts.length - 1; i >= 0; i--) {
    const { dir, index } = attempts[i]!;
    const resultPath = resolve(dir, "dispatch-result.json");
    const recordPath = resolve(dir, "record.json");
    if (!existsSync(resultPath) || !existsSync(recordPath)) continue;
    try {
      const result = JSON.parse(readFileSync(resultPath, "utf8")) as D7CodexAttemptResultV1;
      if (result.ok !== true) continue;
      return { result, record: readFileSync(recordPath, "utf8"), index };
    } catch {
      continue; // a torn/garbage marker is never a completion — fall through to a new attempt
    }
  }
  return null;
}

/** Transport-level trim ONLY (first `{` … last `}`) — never edits or fabricates a
 *  field. `null` when the reply carries no JSON object (the caller fails closed). */
function extractRecord(replyPath: string): string | null {
  let raw: string;
  try {
    raw = readFileSync(replyPath, "utf8");
  } catch {
    return null;
  }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  return raw.slice(first, last + 1);
}

/** Persist the returned bytes + a completion marker so a resume re-ingests them.
 *  `record.json` is written FIRST, the marker LAST — a crash between the two
 *  leaves an unmarked (non-completing) attempt. Best-effort: a telemetry write
 *  failure never voids a valid rating already returned. */
function persistCompletedAttempt(attemptDir: string, marker: D7CodexAttemptResultV1, record: string): void {
  try {
    writeFileSync(resolve(attemptDir, "record.json"), record);
    writeFileSync(resolve(attemptDir, "dispatch-result.json"), `${JSON.stringify(marker, null, 2)}\n`);
  } catch {
    /* telemetry write must never brick a valid D7 rating dispatch */
  }
}

/**
 * The WP-E22 production D7 dispatch: an envelope-proven GPT-5.6 Sol @ ultra codex
 * session per (unit, role) rating, adapted to the frozen `D7WorkerDispatch` seam
 * (d7Judge.ts unchanged). Per dispatch it:
 *
 *   - RE-INGESTS a prior COMPLETED attempt if one exists (resume): returns those
 *     exact bytes and ledgers `sessionKind:"reingest"` (NOT a live spend), model/
 *     effort read from the persisted marker. No new session is spawned — a fresh
 *     ultra session returns different bytes the immutable-evidence store rejects;
 *   - otherwise opens the NEXT `attempt-NNN` dir (a prior FAILED attempt is never
 *     deleted — attempt dirs accumulate), drives `runUltraSession`, and ledgers
 *     `sessionKind:"session"`, family `codex-exec`, with the REAL model/effort/
 *     sessionId from the spawn result (never a guessed value, never `null`);
 *   - fails closed on any non-usable result — throws so the D7 judge marks the
 *     candidate INELIGIBLE (never a fabricated score, never a codex read of the
 *     draft), with the reply preserved for inspection.
 *
 * Telemetry (ledger) is best-effort; a ledger bug never bricks a valid rating.
 */
export function createD7CodexWorkerDispatch(args: CreateD7CodexWorkerDispatchArgs = {}): D7WorkerDispatch {
  const runUltra = args.runUltra ?? runUltraSession;
  const pipelineDir = resolve(args.pipelineDir ?? PIPELINE_DIR);
  const timeoutMs = args.timeoutMs ?? D7_CODEX_SESSION_TIMEOUT_MS;
  const log = args.log ?? (() => {});
  const appendLedger = args.appendLedger ?? appendCallLedgerEntry;
  const clock = args.clock ?? (() => new Date());

  return async (req: D7WorkerRequest): Promise<D7WorkerReturn> => {
    const baseDir = d7CodexSessionBaseDir(pipelineDir, req);

    const ledger = (fields: {
      model: string | null;
      effort: string | null;
      latencyMs: number | null;
      outcome: ProviderOutcomeV1;
      sessionId: string | null;
      sessionKind: "session" | "reingest";
      attemptIndex: number;
    }): void => {
      try {
        appendLedger({
          pipelineDir,
          bookId: req.bookId,
          runId: req.auditId,
          family: "codex-exec",
          stage: D7_DISPATCH_LEDGER_STAGE,
          role: req.role,
          model: fields.model,
          effort: fields.effort,
          latencyMs: fields.latencyMs,
          outcome: fields.outcome,
          sessionId: fields.sessionId,
          sessionKind: fields.sessionKind,
          attemptIndex: fields.attemptIndex,
        });
      } catch {
        /* telemetry must never brick a valid D7 rating dispatch */
      }
    };

    // ── Resume: a prior attempt already produced returnable bytes → re-ingest them.
    const completed = readCompletedAttempt(baseDir);
    if (completed !== null) {
      ledger({
        model: completed.result.model ?? null,
        effort: completed.result.effort ?? null,
        latencyMs: null,
        outcome: "content_completed",
        sessionId: completed.result.sessionId ?? null,
        sessionKind: "reingest",
        attemptIndex: completed.index,
      });
      log(`[bakeoff] d7-codex-dispatch ${req.unit} ${req.role}: REINGEST attempt-${String(completed.index).padStart(3, "0")} (already-persisted bytes; no new session)`);
      // WP-E23 route proof (rt FINDING A leg 1): hand the OBSERVED metadata back so
      // the judge threads it into ingest — the re-ingested record carries the same
      // real model/effort and the adjudicator's envelope-manifest sha the original
      // session recorded (sessionKind "reingest", never a live re-spend).
      return {
        record: completed.record,
        dispatchMeta: {
          model: completed.result.model ?? null,
          effort: completed.result.effort ?? null,
          sessionId: completed.result.sessionId ?? null,
          manifestSha256: completed.result.manifestSha256,
          manifestPath: completed.result.manifestPath,
          sessionKind: "reingest",
          attemptIndex: completed.index,
        },
      };
    }

    // ── New session: the next attempt dir (a prior failed attempt is preserved).
    const attemptIndex = (listAttemptDirs(baseDir).at(-1)?.index ?? 0) + 1;
    const attemptDir = attemptDirPath(baseDir, attemptIndex);
    const sessionCwd = resolve(attemptDir, "cwd");
    mkdirSync(sessionCwd, { recursive: true });
    const promptPath = resolve(attemptDir, "task.md");
    writeFileSync(promptPath, req.task);

    let result: UltraSessionResultV1;
    try {
      result = await runUltra(
        {
          role: req.role,
          promptPath,
          cwd: sessionCwd,
          timeoutMs,
          sessionTag: `${req.unit}-${req.role}`,
          bookId: req.bookId,
          runId: req.auditId,
        },
        { ...(args.ultraDeps ?? {}), manifestSink: resolve(attemptDir, "session") },
      );
    } catch (error) {
      // `runUltraSession` catches its own runner throws (→ ok:false); a throw HERE is
      // a preflight refusal (auth/schema) before any process. Ledger the failed
      // attempt and re-throw — the D7 judge turns it into an INELIGIBLE candidate.
      ledger({
        model: null,
        effort: null,
        latencyMs: null,
        outcome: classifyDispatchFailure(error),
        sessionId: null,
        sessionKind: "session",
        attemptIndex,
      });
      log(`[bakeoff] d7-codex-dispatch ${req.unit} ${req.role}: attempt-${String(attemptIndex).padStart(3, "0")} REFUSED before spawn — ${(error as Error).message.split("\n")[0]}`);
      throw error;
    }

    const record = result.ok && result.replyPath !== null ? extractRecord(result.replyPath) : null;

    ledger({
      model: result.model,
      effort: result.effort,
      latencyMs: result.latencyMs,
      // The frozen result types `outcome` as `string` but documents it as a
      // ProviderOutcomeV1 value (the classifier that produced it uses the union).
      outcome: result.outcome as ProviderOutcomeV1,
      sessionId: result.sessionId,
      sessionKind: "session",
      attemptIndex,
    });

    if (!result.ok || record === null) {
      log(`[bakeoff] d7-codex-dispatch ${req.unit} ${req.role}: attempt-${String(attemptIndex).padStart(3, "0")} FAILED (${result.outcome}) — reply preserved, refusing to fabricate a rating`);
      throw new D7JudgeError(
        `D7 ultra dispatch produced no usable rater record (unit ${req.unit} ${req.role}, attempt ${attemptIndex}, outcome ${result.outcome}` +
          `${result.failure ? `: ${result.failure}` : record === null ? ": reply carried no JSON object" : ""}). The reply is preserved for inspection.`,
      );
    }

    // Persist the completed attempt so a resume re-ingests these EXACT bytes.
    persistCompletedAttempt(attemptDir, {
      schemaVersion: "d7-codex-attempt-result-v1",
      ok: true,
      model: result.model,
      effort: result.effort,
      sessionId: result.sessionId,
      manifestPath: result.manifestPath,
      manifestSha256: result.manifestSha256,
      at: clock().toISOString(),
    }, record);

    log(`[bakeoff] d7-codex-dispatch ${req.unit} ${req.role}: attempt-${String(attemptIndex).padStart(3, "0")} OK (${result.model}@${result.effort})`);
    // WP-E23 route proof (rt FINDING A leg 1): return the record WITH the REAL
    // observed dispatch metadata (family codex-exec model/effort, the ultra
    // session id, and the effective-context manifest sha) so the judge threads it
    // into ingest — the ledger records the real route and the adjudicator's
    // envelope-manifest custody sidecar is actually written, never left null.
    return {
      record,
      dispatchMeta: {
        model: result.model,
        effort: result.effort,
        sessionId: result.sessionId,
        manifestSha256: result.manifestSha256,
        manifestPath: result.manifestPath,
        sessionKind: "session",
        attemptIndex,
      },
    };
  };
}

/** Recompute the canonical semantic fingerprint the ultra-session writer stamped
 *  (`writeUltraProbeSidecar`: `hashCanonical` over the semantic fields, EXCLUDING
 *  the self-referential `sidecarPath`/`sidecarSha256`). MUST stay byte-identical
 *  to that writer — a divergence here silently disables the tamper check. */
function recomputeUltraProbeSha256(probe: UltraAcceptanceProbeV1): string {
  return hashCanonical({
    schemaVersion: probe.schemaVersion,
    probedAt: probe.probedAt,
    model: probe.model,
    effort: probe.effort,
    accepted: probe.accepted,
    detail: probe.detail,
    manifestPath: probe.manifestPath,
  });
}

/**
 * Whether a probe sidecar is a STRUCTURALLY VALID acceptance proof for THIS D7
 * ultra route (rt FINDING B: "probe gate not validated"). A sidecar is honored
 * only when ALL hold:
 *   - `schemaVersion === "ultra-acceptance-probe-v1"`,
 *   - `effort === ULTRA_EFFORT`,
 *   - `model === resolveD7RaterRoute().model` (a stale-model sidecar from a prior
 *     winner is NOT this campaign's proof), AND
 *   - the recomputed canonical semantic hash equals the recorded `sidecarSha256`
 *     (a hand-planted `{"accepted":true}` sidecar, or one whose fields were edited
 *     after signing, fails this self-hash check).
 * `accepted` itself is checked by the caller — a valid-but-`accepted:false` probe
 * is a distinct, honest halt.
 */
export function isValidUltraProbe(probe: UltraAcceptanceProbeV1 | null): boolean {
  if (probe === null) return false;
  if (probe.schemaVersion !== "ultra-acceptance-probe-v1") return false;
  if (probe.effort !== ULTRA_EFFORT) return false;
  if (probe.model !== resolveD7RaterRoute().model) return false;
  if (typeof probe.sidecarSha256 !== "string" || recomputeUltraProbeSha256(probe) !== probe.sidecarSha256) return false;
  return true;
}

/**
 * Consult the campaign's ultra-acceptance probe BEFORE the first rating spawn.
 * A missing, STRUCTURALLY-INVALID, or `accepted:false` probe HALTS (throws
 * `D7JudgeError`): the D7 raters are Sol-ultra codex sessions, and an unaccepted
 * `model_reasoning_effort=ultra` token means every rating would spawn at the wrong
 * effort. Fail closed — the campaign is not runnable until the installed CLI proves
 * it accepts ultra AND the proof is one this route can trust (rt FINDING B: a
 * hand-planted `{"accepted":true}` or a stale-model sidecar is NOT acceptance).
 */
export function assertUltraProbeAccepted(probe: UltraAcceptanceProbeV1 | null): void {
  if (probe === null) {
    throw new D7JudgeError(
      "ultra-acceptance probe missing — refusing to spawn any D7 rating session before the campaign proves the installed codex CLI accepts model_reasoning_effort=ultra (fail closed).",
    );
  }
  if (!isValidUltraProbe(probe)) {
    throw new D7JudgeError(
      "ultra-acceptance probe is not a trustworthy proof for the D7 ultra route — its schemaVersion/effort/model must match resolveD7RaterRoute() @ ultra AND its self-hash must recompute over the recorded fields. " +
        `Observed schemaVersion=${String((probe as { schemaVersion?: unknown }).schemaVersion)} model=${String(probe.model)} effort=${String(probe.effort)}. ` +
        "Treating it as absent (re-run the probe); refusing to spawn any D7 rating session (fail closed).",
    );
  }
  if (!probe.accepted) {
    throw new D7JudgeError(
      `ultra-acceptance probe reported accepted:false — the installed codex CLI did not accept the ultra reasoning-effort token (${probe.detail}). Halting before any D7 rating spawn.`,
    );
  }
}
