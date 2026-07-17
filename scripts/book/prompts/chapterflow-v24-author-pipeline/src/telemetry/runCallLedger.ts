/**
 * WP-503 — unified per-run model-call ledger (codex-exec + Claude-side), durable,
 * per-book rollup.
 *
 * WHY THIS EXISTS (V25-15 / the S-tier audit gap). Before this module, cost
 * accounting for a v24 run was split across two INCOMPLETE views:
 *
 *   - `src/cost-tracker.ts` meters the `callModel`/`claudeClient` route (tokens,
 *     $ estimate) but explicitly declares `NOT_METERED_MESSAGE` for the default
 *     author-first path — every real codex-exec spawn — because that route is
 *     billed against the Codex subscription, not the API (cost-tracker.ts:70).
 *   - The codex-exec route's own per-spawn evidence (`RouteResultV1` sidecars,
 *     `codexAgent.ts`) carries model/effort/outcome but is written under the
 *     GITIGNORED `logs/exec/` (see this pipeline's `.gitignore:16`) — durable
 *     for one process, invisible to `git status`, never rolled up.
 *   - The Claude-side D7 rater/adjudicator calls (`rubricAuditHarness.ts`) are
 *     genuinely model-free CODE (`modelCalls: 0`, `apiCalls: 0` on every ingest
 *     result) — the actual model turn happens in an external Claude session the
 *     harness only RENDERS a task for and INGESTS a record from. That external
 *     call was unledgered anywhere.
 *
 * Since the codex-exec route is structurally unmeterable in dollars (a
 * subscription, not per-token billing) and the D7 rater/adjudicator calls carry
 * no observable token count at all, this ledger's CURRENCY is deliberately
 * CALL COUNT + LATENCY, never a dollar figure. Every entry carries an explicit
 * `cost: "NOT_METERED"` marker rather than a fabricated `$0.00` — see
 * `docs/v25/implementation/V25_S_TIER_IMPLEMENTATION_MASTER_PLAN.md` WP-503
 * ("Do NOT introduce dollar metering for the codex route... never a fabricated
 * dollar cost").
 *
 * DURABILITY. Ledger + rollups live under `state/run-ledger/<bookId>/` inside
 * the pipeline dir — NOT under `logs/exec/` or any other gitignored path (see
 * `run-call-ledger.test.ts`'s `git check-ignore` proof). CLAUDE.md warns
 * against bloating tracked `state/`; the per-run ledger is size-capped
 * (bounded lines/bytes, oldest-first eviction — see `DEFAULT_MAX_LEDGER_LINES`/
 * `DEFAULT_MAX_LEDGER_BYTES`) so a runaway/looping call site can never grow one
 * run's file without bound. The per-book rollup-of-rollups
 * (`book-rollup.json`) stays O(1) in size regardless of how many runs a book
 * accumulates — it carries only aggregate counts/percentiles, never raw
 * entries.
 *
 * HONESTY OVER COMPLETENESS. Every entry carries the same six required fields
 * `{ role, model, effort, latencyMs, outcome, stage }`. Where a field is
 * genuinely unobservable at its call site (e.g. the model identity of an
 * external Claude-side D7 rater session, which this process never sees), the
 * field is recorded as an EXPLICIT `null` — never guessed, never a placeholder
 * `0`/`"unknown-model"` dressed up as data. `outcome` reuses the SAME frozen
 * `ProviderOutcomeV1` taxonomy `modelPolicy.ts` already defines for codex spawns
 * (`content_completed` / `content_invalid` / ...) — one disjoint vocabulary for
 * every call family, not a parallel one.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import type { ProviderOutcomeV1 } from "../contracts/routeContracts.js";

export const RUN_CALL_LEDGER_ENTRY_SCHEMA = "run-call-ledger-entry-v1" as const;
export const RUN_CALL_LEDGER_ROLLUP_SCHEMA = "run-call-ledger-rollup-v1" as const;

/** This ledger tracks exactly two call families: a real `codex exec` spawn
 *  (the default author-first ship path), or a Claude-side call — today that is
 *  either the legacy `callModel`/`claudeClient` route (cost-tracker.ts) or an
 *  external D7 rater/adjudicator turn ingested through `rubricAuditHarness.ts`.
 *  Both are "Claude-side" in the sense the audit used the term: not billed
 *  against the Codex subscription. */
export type LedgerCallFamily = "codex-exec" | "claude-side";

/** The marker EVERY entry's cost field carries. This ledger's currency is call
 *  count + latency only (WP-503, out of scope: dollar/token metering) — never a
 *  fabricated `$0.00` or a guessed token count. */
export const LEDGER_COST_MARKER = "NOT_METERED" as const;

export type RunCallLedgerEntryV1 = {
  schema: typeof RUN_CALL_LEDGER_ENTRY_SCHEMA;
  /** Real wall-clock ISO timestamp at append time (never a synthetic/derived clock). */
  at: string;
  runId: string;
  bookId: string;
  family: LedgerCallFamily;
  /** Pipeline stage / session-type label (e.g. "writer", "qc-review",
   *  "d7-rubric-audit") — reused from the existing session classification for
   *  codex-exec entries (`classifySessionLabel`), never reinvented per family. */
  stage: string;
  /** The agent role (codex `AgentRole`) or the D7 harness role
   *  (primary/verification/adjudicator). `null` only when genuinely unknown at
   *  the call site (e.g. a role-less legacy injected-runner test double). */
  role: string | null;
  /** Resolved/observed model id. `null` only when genuinely unobservable (an
   *  external Claude-side D7 call this process never sees a model id for). */
  model: string | null;
  /** Reasoning effort. `null` when the call family has no effort concept
   *  (e.g. the Anthropic/OpenAI API route) or it is genuinely unobservable. */
  effort: string | null;
  /** Real elapsed milliseconds for this call. `null` only when genuinely
   *  unobservable (never a placeholder `0` standing in for "unknown"). */
  latencyMs: number | null;
  /** Reuses modelPolicy.ts's frozen ProviderOutcomeV1 taxonomy for every family. */
  outcome: ProviderOutcomeV1;
  /** Cross-reference to the codex CHAPTERFLOW_SESSION_ID or an equivalent
   *  D7 dispatch identity, when one exists. */
  sessionId: string | null;
  /** WP-E00 freeze (V25-AUD-08): distinguishes a REAL model session (`session`)
   *  from a resume-time re-ingest of already-persisted bytes (`reingest`).
   *  Only `session` entries count toward live-spend ceilings and economics.
   *  Absent on legacy entries ⇒ unknown kind; rollups must count legacy entries
   *  separately, never silently as sessions. */
  sessionKind?: "session" | "reingest";
  /** WP-E00 freeze (V25-AUD-02): 1-based attempt index for the (unit, role)
   *  this call served, when the call site tracks attempts. */
  attemptIndex?: number | null;
  cost: typeof LEDGER_COST_MARKER;
};

export type RunCallLedgerEntryInput = {
  family: LedgerCallFamily;
  stage: string;
  role: string | null;
  model: string | null;
  effort: string | null;
  latencyMs: number | null;
  outcome: ProviderOutcomeV1;
  sessionId?: string | null;
  sessionKind?: "session" | "reingest";
  attemptIndex?: number | null;
};

/** Bounded retention: a single run's ledger never grows past this many lines
 *  (oldest-first eviction) — the mitigation CLAUDE.md's "don't bloat tracked
 *  state/" rule requires for an otherwise-unbounded per-call append log. */
export const DEFAULT_MAX_LEDGER_LINES = 4000;
/** Bounded retention: a single run's ledger never grows past this many bytes. */
export const DEFAULT_MAX_LEDGER_BYTES = 4 * 1024 * 1024;

export function callLedgerDir(pipelineDir: string, bookId: string): string {
  return resolve(pipelineDir, "state", "run-ledger", bookId);
}

export function callLedgerPaths(pipelineDir: string, bookId: string, runId: string): {
  dir: string;
  jsonl: string;
  summary: string;
  bookRollup: string;
} {
  const dir = callLedgerDir(pipelineDir, bookId);
  return {
    dir,
    jsonl: resolve(dir, `${runId}.jsonl`),
    summary: resolve(dir, `${runId}.summary.json`),
    bookRollup: resolve(dir, "book-rollup.json"),
  };
}

function readLines(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter((l) => l.length > 0);
}

/** Evict oldest lines until both the line count and byte budget are satisfied.
 *  Always leaves at least the most recent line (a single oversized entry is
 *  never itself dropped — the cap bounds growth, it never hides the newest
 *  call). */
function trimToCaps(lines: string[], maxLines: number, maxBytes: number): string[] {
  let out = lines.length > maxLines ? lines.slice(lines.length - maxLines) : lines.slice();
  let totalBytes = out.reduce((sum, l) => sum + Buffer.byteLength(l, "utf8") + 1, 0);
  while (totalBytes > maxBytes && out.length > 1) {
    const removed = out.shift();
    if (removed === undefined) break;
    totalBytes -= Buffer.byteLength(removed, "utf8") + 1;
  }
  return out;
}

/** Append exactly one entry to the run's durable ledger, applying the
 *  size-capped retention policy. Best-effort is the CALLER's responsibility
 *  (mirrors the existing `deps.logSession`/`writeCostReport` convention —
 *  telemetry writers here throw on genuine I/O failure so tests can catch a
 *  real bug; every production call site wraps this in a try/catch, exactly
 *  like the pre-existing session ledger choke points). */
export function appendCallLedgerEntry(args: {
  pipelineDir: string;
  bookId: string;
  runId: string;
  maxLines?: number;
  maxBytes?: number;
} & RunCallLedgerEntryInput): RunCallLedgerEntryV1 {
  const paths = callLedgerPaths(args.pipelineDir, args.bookId, args.runId);
  mkdirSync(paths.dir, { recursive: true });
  const entry: RunCallLedgerEntryV1 = {
    schema: RUN_CALL_LEDGER_ENTRY_SCHEMA,
    at: new Date().toISOString(),
    runId: args.runId,
    bookId: args.bookId,
    family: args.family,
    stage: args.stage,
    role: args.role,
    model: args.model,
    effort: args.effort,
    latencyMs: args.latencyMs,
    outcome: args.outcome,
    sessionId: args.sessionId ?? null,
    cost: LEDGER_COST_MARKER,
  };
  // Only set when the caller actually supplied a value: these are optional
  // (`?`) fields, and a legacy/omitting caller must produce a byte-identical
  // entry to before WP-E41 — an explicit `undefined` own-property would
  // survive in memory (breaking round-trip equality against the
  // JSON.stringify-dropped disk copy, where the key is simply absent) even
  // though it serializes the same as never having set the key.
  if (args.sessionKind !== undefined) entry.sessionKind = args.sessionKind;
  if (args.attemptIndex !== undefined) entry.attemptIndex = args.attemptIndex;
  const lines = readLines(paths.jsonl);
  lines.push(JSON.stringify(entry));
  const capped = trimToCaps(lines, args.maxLines ?? DEFAULT_MAX_LEDGER_LINES, args.maxBytes ?? DEFAULT_MAX_LEDGER_BYTES);
  writeFileAtomic(paths.jsonl, `${capped.join("\n")}\n`);
  return entry;
}

export function readCallLedgerEntries(pipelineDir: string, bookId: string, runId: string): RunCallLedgerEntryV1[] {
  const paths = callLedgerPaths(pipelineDir, bookId, runId);
  return readLines(paths.jsonl).map((l) => JSON.parse(l) as RunCallLedgerEntryV1);
}

export type RunCallLedgerRollupV1 = {
  schema: typeof RUN_CALL_LEDGER_ROLLUP_SCHEMA;
  bookId: string;
  runId: string;
  at: string;
  totalCalls: number;
  byFamily: Record<string, number>;
  byStage: Record<string, number>;
  byRole: Record<string, number>;
  byModel: Record<string, number>;
  byOutcome: Record<string, number>;
  latency: {
    p50Ms: number | null;
    p95Ms: number | null;
    /** How many entries actually contributed a latency sample. */
    sampledCalls: number;
    /** How many entries had a genuinely unobservable latency (recorded null,
     *  never folded into the percentile as a fabricated zero). */
    unknownLatencyCalls: number;
  };
  /** WP-E00 freeze (V25-AUD-08), implemented by WP-E41: entry counts by
   *  sessionKind (`session` / `reingest` / `unknown` for legacy). */
  bySessionKind?: Record<string, number>;
  /** Count of entries with sessionKind === "session" — the ONLY number that may
   *  be compared against a live-spend ceiling. */
  trueSessionCalls?: number;
  /** WP-E00 freeze (NEW-06), implemented by WP-E42: the versioned price table a
   *  cost estimate was computed against; null/absent ⇒ PRICE NOT VERIFIED and
   *  no dollar figure anywhere in the rollup. */
  priceVersion?: string | null;
  cost: typeof LEDGER_COST_MARKER;
};

/** Nearest-rank percentile over an ASCENDING-sorted array. `null` on an empty
 *  input rather than a fabricated 0 — an empty latency sample means "no call
 *  in this rollup reported a real duration", not "every call took 0ms". */
export function percentile(sortedAscending: readonly number[], p: number): number | null {
  if (sortedAscending.length === 0) return null;
  const idx = Math.min(sortedAscending.length - 1, Math.max(0, Math.ceil(p * sortedAscending.length) - 1));
  return sortedAscending[idx];
}

function tally(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function buildCallLedgerRollup(
  bookId: string,
  runId: string,
  entries: readonly RunCallLedgerEntryV1[],
  opts?: { priceVersion?: string | null },
): RunCallLedgerRollupV1 {
  const byFamily: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  const bySessionKind: Record<string, number> = {};
  const latencies: number[] = [];
  let unknownLatencyCalls = 0;
  let trueSessionCalls = 0;
  for (const e of entries) {
    tally(byFamily, e.family);
    tally(byStage, e.stage);
    tally(byRole, e.role ?? "unknown");
    tally(byModel, e.model ?? "unknown");
    tally(byOutcome, e.outcome);
    // WP-E41 (V25-AUD-08 behavior): an entry missing `sessionKind` is a
    // legacy entry, tallied under "unknown" — NEVER folded into "session".
    // A live-spend ceiling reads `trueSessionCalls` alone, so silently
    // counting an unknown-provenance legacy call as a session would let a
    // resume-time reingest (or a pre-WP-E41 entry) inflate the ceiling.
    const kind = e.sessionKind ?? "unknown";
    tally(bySessionKind, kind);
    if (e.sessionKind === "session") trueSessionCalls += 1;
    if (e.latencyMs === null || e.latencyMs === undefined || !Number.isFinite(e.latencyMs)) {
      unknownLatencyCalls += 1;
    } else {
      latencies.push(e.latencyMs);
    }
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    schema: RUN_CALL_LEDGER_ROLLUP_SCHEMA,
    bookId,
    runId,
    at: new Date().toISOString(),
    totalCalls: entries.length,
    byFamily,
    byStage,
    byRole,
    byModel,
    byOutcome,
    latency: {
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      sampledCalls: sorted.length,
      unknownLatencyCalls,
    },
    bySessionKind,
    trueSessionCalls,
    // WP-E42 wires the priced table lookup; this rollup only carries the
    // version the caller says it priced against (absent/null ⇒ PRICE NOT
    // VERIFIED, per NEW-06 — no pricing arithmetic lives in this module).
    priceVersion: opts?.priceVersion ?? null,
    cost: LEDGER_COST_MARKER,
  };
}

/** Count entries that represent a REAL, billable model session — never a
 *  resume-time reingest of already-persisted bytes, and never a legacy entry
 *  with no recorded `sessionKind` at all (honesty rule, V25-AUD-08: absence
 *  of provenance is not evidence of a session). The screening-budget
 *  ceiling consumer (WP-E33) calls this rather than reading
 *  `entries.length` or `byFamily` directly, so a ceiling check can never be
 *  inflated by reingests or unlabeled legacy calls.
 *  `opts.family`, when supplied, restricts the count to one call family
 *  (e.g. isolating `codex-exec` spend from `claude-side`). */
export function countTrueSessions(
  entries: readonly RunCallLedgerEntryV1[],
  opts?: { family?: LedgerCallFamily },
): number {
  let count = 0;
  for (const e of entries) {
    if (e.sessionKind !== "session") continue;
    if (opts?.family !== undefined && e.family !== opts.family) continue;
    count += 1;
  }
  return count;
}

export function writeCallLedgerRollup(pipelineDir: string, rollup: RunCallLedgerRollupV1): string {
  const paths = callLedgerPaths(pipelineDir, rollup.bookId, rollup.runId);
  mkdirSync(paths.dir, { recursive: true });
  writeFileAtomic(paths.summary, `${JSON.stringify(rollup, null, 2)}\n`);
  return paths.summary;
}

/** Convenience: read a run's own ledger back, roll it up, and persist the
 *  per-run summary in one call — the exact sequence the autopilot/D7 flush
 *  points use at run end. */
export function finalizeRunCallLedgerRollup(pipelineDir: string, bookId: string, runId: string): { rollup: RunCallLedgerRollupV1; path: string } {
  const entries = readCallLedgerEntries(pipelineDir, bookId, runId);
  const rollup = buildCallLedgerRollup(bookId, runId, entries);
  const path = writeCallLedgerRollup(pipelineDir, rollup);
  return { rollup, path };
}

/** The per-BOOK rollup: aggregated across every run this book has EVER
 *  accumulated a ledger for (every `<runId>.jsonl` under its directory), not
 *  just the run that just finished. Stays O(1) in size regardless of history
 *  length — it carries only aggregate counts/percentiles, never raw entries,
 *  so it never becomes the thing CLAUDE.md warns `state/` against. */
export function buildBookRollup(pipelineDir: string, bookId: string): RunCallLedgerRollupV1 {
  const dir = callLedgerDir(pipelineDir, bookId);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    files = [];
  }
  const entries: RunCallLedgerEntryV1[] = [];
  for (const f of files) {
    const runId = f.slice(0, -".jsonl".length);
    entries.push(...readCallLedgerEntries(pipelineDir, bookId, runId));
  }
  return { ...buildCallLedgerRollup(bookId, "ALL_RUNS", entries), runId: "ALL_RUNS" };
}

export function writeBookRollup(pipelineDir: string, bookId: string): string {
  const rollup = buildBookRollup(pipelineDir, bookId);
  const paths = callLedgerPaths(pipelineDir, bookId, "unused");
  mkdirSync(paths.dir, { recursive: true });
  writeFileAtomic(paths.bookRollup, `${JSON.stringify(rollup, null, 2)}\n`);
  return paths.bookRollup;
}
