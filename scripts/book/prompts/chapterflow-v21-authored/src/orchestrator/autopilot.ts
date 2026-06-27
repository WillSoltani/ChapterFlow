/**
 * Book Autopilot — the deterministic conductor that runs a v21 book end-to-end.
 *
 * One command ("autopilot <bookId>") drives all four phases the operator used to
 * paste by hand — research → write → gate → QC(+repair) → ready-to-publish —
 * looping over the existing `bookStatus` phase machine. DECISIONS live here in
 * deterministic code (phase sequencing, the bounded repair loop, gate reading,
 * publish gating). WORK is delegated to fresh `codex exec` agentic sub-sessions
 * (research, per-chapter authoring, QC review, repair) — never an API call, so it
 * runs entirely on the Codex subscription.
 *
 * Invariants (see also the plan):
 *  - No API metering: agentic work goes through spawnCodexAgent (codex exec); the
 *    conductor never calls a billed provider.
 *  - Session independence: every spawn gets a DISTINCT CHAPTERFLOW_SESSION_ID, so
 *    writer ≠ each reviewer ≠ confirm and finalize's collision-rejection holds.
 *  - Decisions are deterministic: the agent never decides repair-vs-publish; the
 *    conductor reads gate exit codes / bookStatus and decides.
 *  - Publish: the conductor AUTO-PUBLISHES on QC convergence by default — it runs the
 *    full deterministic promote gate, then commits + pushes the package to main (NOT a
 *    live deploy; that stays manual and reversible via git). --no-publish HALTS at
 *    "ready to publish" for human review instead. The gate still blocks either way.
 *  - Bounded + stuck-aware: ≤ maxRepairRounds, and it HALTS early if a repair
 *    makes no progress or surfaces a major needing human disposition.
 *
 * All side-effecting collaborators (codex spawns, CLI verb runs, status reads) are
 * injectable so the state machine is unit-testable WITHOUT a real `codex` binary.
 */

import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, unlinkSync, appendFileSync, renameSync, copyFileSync, rmSync } from "fs";
import { hostname, tmpdir } from "os";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { computeBookStatus, type BookStatus } from "../lifecycle/bookStatus.js";
import { STRICT_PIPELINE_ENV } from "../lib/strictEnv.js";
import { REPO_ROOT, normSlug } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { recordAuthorProvenance } from "../qc/sessionProvenance.js";
import { loadBookChapters, keyPackDir, quarantineCorruptChapterFiles } from "../qc/manualKeyJudge.js";
import { normalizeChapterProvenance } from "../qc/normalizeProvenance.js";
import { unresolvedMajors, formatMajorStatus, type MajorFindingSnapshot } from "../qc/majorDisposition.js";
import { pruneBookStatePlan, applyPruneBookState } from "../qc/pruneBookState.js";
import { carryableChapter } from "../qc/orchestrator/index.js";
import { driveQcRoundCore, type ReviewerWave, type ReviewerWaveResult } from "../qc/auto/driver.js";
import {
  reviewPacketPath,
  buildSweepSkeleton,
  buildKeySkeleton,
  buildBarSkeleton,
  buildConfirmSkeleton,
  buildMajorSkeleton,
} from "../qc/orchestrator/reviewPacket.js";
import { submissionJsonSchemaForRole } from "../qc/orchestrator/submissionSchemas.js";
import { runShipGate } from "../critics/finalGate.js";
import { runBookGate } from "../critics/bookGate.js";
import { sweepPackPath, sweepTwoRoundConfirmed } from "../qc/sweep.js";
import { barPackPath } from "../qc/barReview.js";
import { barArtifactPath, confirmArtifactPath, evidenceMatrixPath, submissionsDir, type BarReadVariant } from "../qc/orchestrator/artifacts.js";
import type { FinalizeQcRoundResult } from "../qc/orchestrator/finalize.js";
import { spawnCodexAgent, type CodexAgentResult, type CodexSandbox } from "./codexAgent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const AGENT_PROMPTS_DIR = resolve(PIPELINE_DIR, "agent-prompts");
const STATE_CHAPTERS = resolve(PIPELINE_DIR, "state", "chapters");
// Workspace-write WORK sessions run with cwd=PIPELINE_DIR, so codex's sandbox covers
// PIPELINE_DIR/state/** + /tmp. But the research phase WRITES source artifacts to repo-root
// `.chapterflow/runs/**` (ABOVE the workdir) — grant that as an extra writable root so the
// research session can actually persist its output (else the round makes no progress).
const WORK_WRITABLE_ROOTS = [resolve(REPO_ROOT, ".chapterflow")];

// ── Phase model ──────────────────────────────────────────────────────────────

export type AutopilotPhase = "research" | "write" | "gate" | "qc" | "ready" | "shipped";

/** Map a BookStatus to the conductor's discrete phase, using the SAME structured
 *  conditions computeBookStatus uses (kept in sync by deriving from its fields). */
export function decidePhase(s: BookStatus, sweepConfirmed = true, regen = false): AutopilotPhase {
  // `regen` = the operator asked to REGENERATE an already-published book. Ignore the "shipped" skip
  // so the conductor re-runs research→write→gate→qc→publish over the existing package (which promote
  // overwrites). This lets a regen keep the package file in place — so the web registry's static
  // import never dangles — instead of the move-aside hack that deadlocks a concurrent regen.
  if (s.packaged && !regen) return "shipped";
  const allWritten = s.expectedChapters != null && s.writtenChapters >= s.expectedChapters && s.writtenChapters > 0;
  // Gate gate→qc on the FULL deterministic battery (deterministicClean), not just ship-gate +
  // book-gate. Otherwise a chapter that is ship/book-clean but source-v2 / author-check /
  // intra-book / plan-enforcement DIRTY skips the gate phase, and the QC round's preflight then
  // hard-halts 'infra' (source/book-gate) or wastes a whole reviewer wave (intra/plan) on a defect
  // the cheap gate-repair loop is built to converge. deterministicClean is fail-safe → true, so it
  // never blocks progression on an unreadable book.
  const allGated = allWritten && s.gatedChapters === s.writtenChapters && s.bookGatePass === true && s.deterministicClean !== false;
  const allQcd = allWritten && s.qcdChapters === s.writtenChapters;
  // Item B: a fully-QC'd book is only "ready" once the sweep is two-read-confirmed. If it converged
  // on a single (possibly lucky) sweep — e.g. a resumed run that reached PASS in a prior process —
  // route it back to "qc" so doQcWithRepair runs the independent confirming round before publish,
  // instead of going straight to handleReady (the resume auto-publish bypass). Defaults true so
  // non-conductor callers (and the unit tests of the phase ladder) are unaffected.
  if (allGated && allQcd) return sweepConfirmed ? "ready" : "qc";
  if (!allWritten) {
    const researchPending = s.writtenChapters === 0 && (s.stage.startsWith("research") || s.expectedChapters == null);
    return researchPending ? "research" : "write";
  }
  if (!allGated) return "gate";
  return "qc";
}

// ── Injectable collaborators (real impls below; tests pass stubs) ──────────────

export type VerbResult = { code: number; stdout: string; stderr: string };
export type RunVerb = (args: string[], env?: Record<string, string>) => Promise<VerbResult>;
export type SpawnAgent = typeof spawnCodexAgent;

export type AutopilotDeps = {
  statusOf: (bookId: string) => BookStatus;
  runVerb: RunVerb;
  spawn: SpawnAgent;
  /** List task-card files (absolute paths) under a round's task-cards tree. */
  listTaskCards: (bookId: string, roundId: string, subdir?: string) => string[];
  /** List the write dispatch-card files (absolute paths) dealt by fanout --write-dir. */
  listWriteCards: (bookId: string) => string[];
  /** The most recent QC round id on disk (the one that just passed, in practice). */
  latestRoundId: (bookId: string) => string | null;
  /** Chapter numbers expected for the book (from the index), for write fan-out. */
  expectedChapterNumbers: (bookId: string) => number[];
  /** Read a prompt/card file's full text (the agent's verbatim instruction). */
  readTask: (path: string) => string;
  /** Distinct id per spawn — label keeps it readable; uniqueness enforces independence. */
  mkSessionId: (label: string) => string;
  /** Snapshot chapter content hashes (chapterNumber→hash). The QC reviewer fence
   *  compares this before/after a wave: any change means a reviewer mutated a
   *  chapter (the read-only contract was broken) → integrity halt. */
  chapterHashes: (bookId: string) => Record<string, string>;
  /** True iff ANY chapter holds a fresh PUBLISHABLE attestation at its current bytes —
   *  a prior pass an incremental round can CARRY instead of re-rolling with a fresh
   *  stochastic bar/confirm read. Drives FIRST-round incremental so passes ACCUMULATE
   *  across rounds (the convergence fix) instead of oscillating. Fail-safe → false
   *  (a full round is always correct), so a read error never forces an incremental carry. */
  anyCarryable: (bookId: string) => boolean;
  /** Item B — true iff the book has TWO independent clear sweep reads over its CURRENT bytes
   *  (sweepTwoRoundConfirmed). The conductor won't declare QC convergence on a single lucky
   *  stochastic sweep read; it requires this cross-round corroboration first. Fail-safe → false
   *  (an unconfirmed book just runs one more confirming round; a read error never force-ships). */
  sweepConfirmed: (bookId: string) => boolean;
  /** The stable keys of every MAJOR-tier deterministic finding over the whole book
   *  (ship-gate majors + book-gate majors: A13 commas, C23 dup protagonist, BP28/29/31
   *  templating, …). These are INVISIBLE to qc-converge (it gates on blockers only), so a
   *  repair can clear qc-converge yet introduce one of these — a new finding the next round's
   *  sweep/bar would flag. The post-repair scan diffs this pre vs post to catch that regression.
   *  Fail-safe → empty set (no false regression signal on an unreadable book). */
  majorFindingKeys: (bookId: string) => Set<string>;
  /** The unresolved BLOCKING majors for the whole book (ADVISORY majors excluded —
   *  see critics/majorPolicy.ts). The gate phase converges these to empty BEFORE QC,
   *  so no deterministic major reaches finalize as an unresolved finding (which would
   *  force the `major-disposition` governance halt). Fail-safe → empty set so an
   *  unreadable book never reports a false major-block. */
  blockingMajors: (bookId: string) => MajorFindingSnapshot[];
  /** True iff the reviewer card already produced a submission on disk — used to
   *  re-spawn ONLY the missing reviewers on an INCOMPLETE round, not the whole wave. */
  submissionPresent: (bookId: string, roundId: string, card: string) => boolean;
  /** Persist one agent session's outcome (durable per-agent log) for walk-away forensics. */
  logSession: (bookId: string, label: string, r: CodexAgentResult) => void;
  /** Persist one BROKERED reviewer's structured outcome (agent/extract/submit success) to a
   *  durable sibling log, so a codex-exit-0-but-qc-submit-rejected reviewer is diagnosable
   *  (the session log alone would look healthy). Best-effort: must not throw. */
  logBroker: (bookId: string, r: BrokerResult) => void;
  /** The prefilled submission SKELETON for a reviewer card (role-specific, judgment fields
   *  as sentinels), injected into the broker prompt so the reviewer doesn't hunt the packet.
   *  null when it can't be built (e.g. a chapter isn't on disk) — the schema alone suffices. */
  reviewerSkeleton: (bookId: string, roundId: string, card: string) => string | null;
  /** Build a per-reviewer BLIND working directory holding ONLY that role's authorized inputs,
   *  used as the reviewer's cwd (constructive isolation — read-only ≠ blind, and codex
   *  read-only can't OS-jail reads, so this narrows what's IN REACH, not what's readable).
   *  `inputs` names the copied files for the prompt; cleanup removes the dir. */
  reviewerWorkspace: (bookId: string, roundId: string, card: string, sessionId: string) => { cwd: string; inputs: string[]; cleanup: () => void };
  /** Read the round's REVIEW-PACKET.md text (holds the plaintext per-role tokens the
   *  broker needs to record a read-only reviewer's submission). "" if absent. */
  readReviewPacket: (bookId: string, roundId: string) => string;
  /** Write a brokered submission JSON to a temp file (OUTSIDE the book state) and
   *  return its path, for `qc-submit --file`. */
  writeTempSubmission: (bookId: string, roundId: string, label: string, json: string) => string;
  /** Acquire a same-book run lock so two autopilots can't race the same book.
   *  release() is idempotent; refresh() is the optional heartbeat; heldBy is set
   *  when acquisition FAILS. */
  acquireLock: (bookId: string) => BookLock;
  log: (m: string) => void;
};

export type AutopilotOptions = {
  bookId: string;
  maxRepairRounds?: number; // default 4
  maxParallel?: number; // default 6
  autoPublish?: boolean; // library default false (→ HALT at ready). The CLI (book-run / book-autopilot) defaults this ON; when true, handleReady runs publish-after-qc --commit --push.
  plan?: boolean; // dry-run: print the spawn plan, take no action
  regen?: boolean; // regenerate an already-PACKAGED book: ignore the "shipped" skip (decidePhase) so the conductor re-runs end-to-end WITHOUT moving the package aside — the package stays, so the web registry import never dangles (fixes the concurrent-regen deadlock).
  deps?: Partial<AutopilotDeps>;
};

/** Why the conductor stopped, so a "walk away" operator (or a harness) can route the
 *  halt instead of eyeballing prose:
 *   - infra      — a tool/agent/process failure (timeout, nonzero create, internal
 *                  error); inspect/retry, NOT a content problem (never edit chapters).
 *   - content    — chapters genuinely need authoring/repair work.
 *   - governance — a human decision is required (e.g. waive vs fix a major).
 *   - progress   — the phase stopped advancing (no-progress / loop cap).
 *   - integrity  — an invariant was violated (e.g. a reviewer mutated a chapter). */
export type HaltCategory = "infra" | "content" | "governance" | "progress" | "integrity";

export type AutopilotOutcome =
  | { status: "shipped"; bookId: string }
  | { status: "ready"; bookId: string; roundId?: string; message: string }
  | { status: "published"; bookId: string; roundId: string; message?: string }
  | { status: "halt"; bookId: string; phase: AutopilotPhase; reason: string; category: HaltCategory };

function mkHalt(bookId: string, phase: AutopilotPhase, category: HaltCategory, reason: string): AutopilotOutcome {
  return { status: "halt", bookId, phase, reason, category };
}

// ── Small utilities ────────────────────────────────────────────────────────────

/** The roundId format is r<YYYYMMDDHHMMSS>-<6 hex>; pull the last one printed. */
export function parseRoundId(stdout: string): string | null {
  const m = stdout.match(/r\d{14}-[0-9a-f]{6}/g);
  return m && m.length ? m[m.length - 1] : null;
}

/** chNN from a card filename / path (e.g. "bar/ch03.md" → 3). Uses the LAST
 *  ch-number in the path so a parent dir like "chapterflow-v21" can't mislead it. */
/** Chapters a round did NOT pass (finalVerdict !== PUBLISHABLE) — the set a repair may edit;
 *  the complement (PUBLISHABLE) is what the collateral-edit guard protects. */
export function flaggedChapterNumbers(bookId: string, roundId: string): Set<number> {
  const out = new Set<number>();
  try {
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(bookId, roundId), "utf8"));
    for (const d of matrix?.chapters ?? []) {
      if (d?.finalVerdict && d.finalVerdict !== "PUBLISHABLE" && d.chapterNumber != null) out.add(Number(d.chapterNumber));
    }
  } catch { /* no matrix yet → empty (caller falls back to the prompt's own chapter list) */ }
  return out;
}

/** Chapters the surgical repair fan-out should spawn an EDIT session for: REVISE / CORRUPTION only.
 *  A NEEDS_MORE_QC chapter failed on missing/stale EVIDENCE, not a content defect — it carries zero
 *  actionable findings (the repair prompt buckets it "[re-QC only … no edits]"), so an edit session
 *  there is a wasted codex call that risks a needless edit invalidating its still-valid review.
 *  (The collateral-edit guard keeps using the full `flaggedChapterNumbers` set, not this one.) */
export function repairTargetChapterNumbers(bookId: string, roundId: string): Set<number> {
  const out = new Set<number>();
  try {
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(bookId, roundId), "utf8"));
    for (const d of matrix?.chapters ?? []) {
      if ((d?.finalVerdict === "REVISE" || d?.finalVerdict === "CORRUPTION") && d.chapterNumber != null) out.add(Number(d.chapterNumber));
    }
  } catch { /* no matrix yet → empty → whole-prompt single-session fallback */ }
  return out;
}

/** Evidence-derived halt summary: per non-PUBLISHABLE chapter in a round's matrix, name the
 *  ACTUAL failed checks (sweep / confirmRead / barRead / sourceV2 / …) instead of a hardcoded
 *  guess. Lets the QC halt point the operator at the real driver (e.g. cross-chapter sweep
 *  templating vs a confirm factual finding) rather than blaming "source/research". "" when the
 *  matrix is unreadable or every chapter passed. */
export function summarizeRoundDrivers(bookId: string, roundId: string): string {
  try {
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(bookId, roundId), "utf8"));
    // Non-failing check values: PASS/GREEN/PUBLISHABLE plus the clean repair-ledger state and the
    // not-applicable evidence state (else a REVISE chapter's clean ledger / N/A majors get falsely
    // named as drivers — see finalize.ts repairLedger / EvidenceStatus values).
    const ok = new Set(["PASS", "GREEN", "PUBLISHABLE", "NO_OPEN_BLOCKERS", "NOT_APPLICABLE"]);
    const parts: string[] = [];
    for (const d of matrix?.chapters ?? []) {
      if (!d?.finalVerdict || d.finalVerdict === "PUBLISHABLE") continue;
      const failed = Object.entries(d.checks ?? {})
        .filter(([, v]) => !(ok.has(String(v)) || v === true))
        .map(([k]) => k);
      const ch = `ch${String(d.chapterNumber ?? "?").padStart(2, "0")}`;
      parts.push(failed.length ? `${ch}:${failed.join("+")}` : `${ch}:${d.finalVerdict}`);
    }
    return parts.join(", ");
  } catch {
    return "";
  }
}

export function chapterNumberFromCard(path: string): number | null {
  const matches = [...path.matchAll(/ch0*(\d+)/gi)];
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
}

/** A role label for a card path, used to build a readable distinct session id. */
function roleLabelFromCard(path: string): string {
  const base = path.replace(/\\/g, "/").split("/").slice(-2).join("-").replace(/\.md$/i, "");
  return base.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

/** Bounded-parallel map with a drain-then-throw failure model. Exported for tests. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let firstError: unknown;
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      // Early-stop: once ANY item has failed, stop CLAIMING new work. Already-started
      // siblings still finish their in-flight await (so drain-then-throw and the
      // no-orphaned-workspace-write-child invariant below are preserved) — we just
      // don't kick off MORE codex sessions for a phase that's already destined to halt.
      if (firstError !== undefined) return;
      // Catch INSIDE the worker so one item's failure never abandons the in-flight
      // siblings: a spawn rejection (codex timeout/ENOENT) would otherwise reject the
      // enclosing Promise.all immediately and let runAutopilot's `finally` release the
      // run lock while other workspace-write children are still writing the book. We
      // drain every item, THEN surface the first error.
      try { out[i] = await fn(items[i], i); }
      catch (err) { if (firstError === undefined) firstError = err; }
    }
  }
  // This never hangs FOREVER on a stuck child: every real spawn goes through
  // spawnCodexAgent, whose runner rejects UNCONDITIONALLY at timeoutMs (default 30m) —
  // the timeout callback calls rejectPromise right after kill, independent of whether
  // SIGKILL lands or the child emits 'close' — so each worker settles within that bound.
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
  if (firstError !== undefined) throw firstError; // → runAutopilot try/catch → infra halt, AFTER all settle
  return out;
}

/** The single spawn choke point: run one agent and persist its outcome (durable log).
 *  A spawn rejection (timeout/ENOENT) propagates to runAutopilot's try/catch → infra halt
 *  — but is RECORDED first: without this, a rejection threw before logSession, so a
 *  timed-out/ENOENT session left no trace in the durable walk-away log. */
async function spawnAndLog(bookId: string, opts: Parameters<SpawnAgent>[0], deps: AutopilotDeps): Promise<CodexAgentResult> {
  let r: CodexAgentResult;
  try {
    r = await deps.spawn(opts);
  } catch (err) {
    const failed: CodexAgentResult = {
      ok: false, exitCode: -1, finalMessage: "", stdout: "",
      stderr: (err as Error)?.message ?? String(err), durationMs: 0, sessionId: opts.sessionId,
    };
    try { deps.logSession(bookId, opts.sessionId, failed); } catch { /* best-effort: never convert a spawn error into a log error */ }
    throw err; // preserve drain-then-throw + infra-halt behavior
  }
  deps.logSession(bookId, opts.sessionId, r);
  return r;
}

/** Finding signatures from a qc-diagnose / evidence dump, for stuck-detection.
 *  We don't need to parse perfectly — any stable per-finding token works; the
 *  loop only needs "did the set shrink between attempts?". */
export function findingSignatures(diagnoseStdout: string): Set<string> {
  const sigs = new Set<string>();
  for (const line of diagnoseStdout.split(/\r?\n/)) {
    const m = line.match(/\b(ch0*\d+)\b.*?:\s*(.+)$/);
    if (m) sigs.add(`${m[1]}:${m[2].trim()}`.slice(0, 200));
  }
  return sigs;
}

/** True when `after` resolved NOTHING from `before` (every prior finding persists)
 *  — i.e., the repair made no progress, so more rounds won't help. */
export function noProgress(before: Set<string>, after: Set<string>): boolean {
  if (before.size === 0) return false;
  for (const s of before) if (!after.has(s)) return false; // at least one resolved → progress
  return true;
}

// ── Default real collaborators ──────────────────────────────────────────────────

/** The env every conductor CLI subprocess runs under. Fail-closed: the strict
 *  invariants are spread LAST so they can be clobbered by neither the operator's
 *  shell nor a per-call `extra` env — this is what makes finalize's author≠reviewer
 *  collision check and the source-verify gate ACTUALLY enforce under autopilot
 *  (they're absence-safe = silently OFF without these vars). A per-call `extra` may
 *  still set CHAPTERFLOW_SESSION_ID (not a strict var) — the PR2 submission broker
 *  needs it. Exported so the invariant is unit-testable without spawning. */
export function conductorVerbEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  return { ...process.env, ...(extra ?? {}), ...STRICT_PIPELINE_ENV };
}

function defaultRunVerb(): RunVerb {
  return (args, env) =>
    new Promise((resolvePromise, rejectPromise) => {
      const child = spawn("npx", ["tsx", "src/cli.ts", ...args], {
        cwd: PIPELINE_DIR,
        env: conductorVerbEnv(env),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", rejectPromise);
      child.on("close", (code) => resolvePromise({ code: code ?? -1, stdout, stderr }));
    });
}

function defaultListTaskCards(bookId: string, roundId: string, subdir?: string): string[] {
  // Lazy import to avoid a hard dep when stubbed in tests.
  const base = resolve(PIPELINE_DIR, "state", "qc-orchestrator", bookId, roundId, "task-cards");
  const root = subdir ? resolve(base, subdir) : base;
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      // First wave excludes the DYNAMICALLY-generated subtrees (confirm/ + bar-tiebreak/,
      // emitted later by confirm-candidates); callers ask for those explicitly via subdir.
      if (e.isDirectory()) {
        if (!subdir && (e.name === "confirm" || e.name === "bar-tiebreak")) continue;
        walk(p);
      } else if (e.name.endsWith(".md")) out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

function defaultExpectedChapterNumbers(bookId: string): number[] {
  const idxPath = resolve(PIPELINE_DIR, "state", "indexes", `${bookId}.json`);
  if (!existsSync(idxPath)) return [];
  try {
    const idx = JSON.parse(readFileSync(idxPath, "utf8"));
    if (Array.isArray(idx)) return idx.map((c: any, i: number) => Number(c?.number ?? i + 1)).filter((n) => Number.isInteger(n));
  } catch { /* fall through */ }
  return [];
}

let sessionCounter = 0;
function defaultMkSessionId(label: string): string {
  sessionCounter += 1;
  return `auto-${label}-${Date.now().toString(36)}-${sessionCounter}`;
}

function defaultListWriteCards(bookId: string): string[] {
  const dir = resolve(PIPELINE_DIR, "state", "authoring-cards", bookId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => resolve(dir, f)).sort();
}

function defaultLatestRoundId(bookId: string): string | null {
  const dir = resolve(PIPELINE_DIR, "state", "qc-orchestrator", bookId);
  if (!existsSync(dir)) return null;
  const rounds = readdirSync(dir).filter((d) => /^r\d{14}-[0-9a-f]{6}$/.test(d)).sort();
  return rounds.length ? rounds[rounds.length - 1] : null;
}

function defaultChapterHashes(bookId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ch of loadBookChapters(bookId)) out[String(ch.number)] = chapterContentHash(ch);
  return out;
}

/** Content hash of a single on-disk chapter, for binding author provenance to the
 *  content a writer/repair session actually produced. Returns undefined on any read
 *  failure so the best-effort provenance stamp degrades safely (never sinks a phase). */
function chapterContentHashByNumber(bookId: string, n: number): string | undefined {
  try {
    const ch = loadBookChapters(bookId).find((c) => c.number === n);
    return ch ? chapterContentHash(ch) : undefined;
  } catch {
    return undefined;
  }
}

/** Fail-safe: any read error (no chapters dir, half-written chapter) → false, i.e. a
 *  full (non-incremental) round. We never force a carry on uncertain state. */
function defaultAnyCarryable(bookId: string): boolean {
  try {
    return loadBookChapters(bookId).some((ch) => carryableChapter(bookId, ch));
  } catch {
    return false;
  }
}

function defaultSweepConfirmed(bookId: string): boolean {
  try {
    return sweepTwoRoundConfirmed(bookId, loadBookChapters(bookId)).ok;
  } catch {
    return false;
  }
}

/** All MAJOR-tier deterministic finding keys for the book — ship-gate majors (per-chapter,
 *  e.g. A13/C23) keyed by chapter+catalogId+unit, plus book-gate majors (e.g. BP28/29/31)
 *  keyed by catalogId+named-chapters. Fail-safe → empty set. The keys must be STABLE across
 *  calls so a pre/post diff reflects only what the repair changed. */
function defaultMajorFindingKeys(bookId: string): Set<string> {
  const keys = new Set<string>();
  try {
    const chapters = loadBookChapters(bookId);
    for (const ch of chapters) {
      for (const f of runShipGate(ch).majors) keys.add(`ship:ch${ch.number}:${f.catalogId}:${f.unit}`);
    }
    for (const f of runBookGate(bookId, chapters).findings) {
      if (f.severity !== "major") continue;
      const named = f.chapters ?? [];
      keys.add(`book:${f.catalogId}:${named.length ? [...named].sort((a, b) => a - b).join(",") : "book"}`);
    }
  } catch {
    /* unreadable book → empty set; no false regression signal */
  }
  return keys;
}

/** The unresolved BLOCKING majors for the whole book (advisory majors excluded by
 *  majorPolicy via evaluateMajorCleanliness). Fail-safe → empty so an unreadable book
 *  never reports a false major-block (a full gate-converge round is always correct). */
function defaultBlockingMajors(bookId: string): MajorFindingSnapshot[] {
  try { return unresolvedMajors(bookId); } catch { return []; }
}

/** Map a task-card path → its QC role + chapter + (for tiebreak cards) the bar-read
 *  variant. MUST recognize bar-tiebreak/chNN-t2.md (path is "/bar-tiebreak/", NOT "/bar/")
 *  so its presence check is variant-aware — else the dynamic-wave loop never converges.
 *  Exported for tests. */
export function roleFromCard(card: string): { role: string; chapter: number | null; variant?: BarReadVariant } {
  const p = card.replace(/\\/g, "/").toLowerCase();
  const vm = p.match(/-(t[23])\.md$/);
  if (vm) return { role: "bar", chapter: chapterNumberFromCard(card), variant: vm[1] as BarReadVariant };
  if (p.includes("/bar-tiebreak/") || p.includes("/bar/")) return { role: "bar", chapter: chapterNumberFromCard(card) };
  if (p.includes("/confirm/")) return { role: "confirm", chapter: chapterNumberFromCard(card) };
  if (p.includes("keya")) return { role: "keyA", chapter: null };
  if (p.includes("keyb")) return { role: "keyB", chapter: null };
  if (p.includes("sweep")) return { role: "sweep", chapter: null };
  if (p.includes("major")) return { role: "major", chapter: null };
  return { role: "unknown", chapter: chapterNumberFromCard(card) };
}

function submissionPresentOnDisk(bookId: string, roundId: string, card: string): boolean {
  const { role, chapter, variant } = roleFromCard(card);
  // bar (incl. t2/t3 tiebreak variants) + confirm derive a VARIANT-SPECIFIC artifact at a
  // deterministic path — the reliable presence signal. The old "any json containing chNN
  // under submissions/bar/" reported a t2 card present the moment the PRIMARY bar read
  // landed (both match chNN), so the tiebreak wave never ran. submitQcArtifact writes the
  // derived artifact at submit time, so this flips true as soon as the broker records it.
  if (role === "bar" && chapter != null) return existsSync(barArtifactPath(bookId, roundId, chapter, variant));
  if (role === "confirm" && chapter != null) return existsSync(confirmArtifactPath(bookId, roundId, chapter));
  // Book-level roles (sweep/keyA/keyB/major): any submission JSON in the role dir.
  const dir = submissionsDir(bookId, roundId, role);
  return existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(".json"));
}

function logSessionToDisk(bookId: string, label: string, r: CodexAgentResult): void {
  // Durable per-agent log for walk-away forensics. Best-effort: never break a run
  // on a log-write failure.
  try {
    const dir = resolve(PIPELINE_DIR, "state", "autopilot-logs", bookId);
    mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      at: new Date().toISOString(), label, sessionId: r.sessionId, ok: r.ok,
      exitCode: r.exitCode, durationMs: r.durationMs,
      finalMessage: (r.finalMessage ?? "").slice(0, 500), stderr: (r.stderr ?? "").slice(0, 1000),
    });
    appendFileSync(resolve(dir, "sessions.jsonl"), line + "\n", "utf8");
  } catch { /* best-effort */ }
}

function logBrokerToDisk(bookId: string, r: BrokerResult): void {
  // Durable per-broker log, sibling to sessions.jsonl: records the STRUCTURED submit outcome
  // the session log can't show (a codex exit-0 reviewer whose qc-submit was REJECTED looks
  // healthy in sessions.jsonl). Best-effort: never break a run on a log-write failure.
  try {
    const dir = resolve(PIPELINE_DIR, "state", "autopilot-logs", bookId);
    mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      schemaVersion: "autopilot-broker-v1", at: new Date().toISOString(),
      card: r.card, role: r.role, sessionId: r.sessionId,
      agentOk: r.agentOk, extractionOk: r.extractionOk, submissionOk: r.submissionOk,
      error: r.error ?? null,
    });
    appendFileSync(resolve(dir, "broker.jsonl"), line + "\n", "utf8");
  } catch { /* best-effort */ }
}

/** Default: the prefilled skeleton for a card's role, built from the SAME functions the
 *  REVIEW-PACKET renders (so the brokered prompt and the packet can't drift). Returns null
 *  when it can't be built (book/chapter not on disk) — the injected schema alone still
 *  guides the reviewer's output shape. */
function defaultReviewerSkeleton(bookId: string, roundId: string, card: string): string | null {
  try {
    const { role } = brokerCardTarget(card);
    if (role === "sweep") return JSON.stringify(buildSweepSkeleton(bookId, roundId), null, 2);
    if (role === "major") return JSON.stringify(buildMajorSkeleton(bookId, roundId), null, 2);
    const chapters = loadBookChapters(bookId);
    if (role === "keyA" || role === "keyB") return JSON.stringify(buildKeySkeleton(bookId, roundId, role, chapters), null, 2);
    const n = chapterNumberFromCard(card);
    const ch = n == null ? undefined : chapters.find((c) => c.number === n);
    if (!ch) return null;
    if (role === "bar") return JSON.stringify(buildBarSkeleton(bookId, roundId, ch), null, 2);
    if (role === "confirm") return JSON.stringify(buildConfirmSkeleton(bookId, roundId, ch), null, 2);
    return null;
  } catch { return null; }
}

/** Slice a bar pack down to a single reviewed chapter. The full pack embeds EVERY chapter's
 *  content, so a single-chapter bar/confirm reviewer must get only its own — else the blind
 *  workspace would leak siblings. Pure (text→text) so it's directly unit-tested. */
export function sliceBarPackToChapter(packText: string, chapterNumber: number): string {
  const pack = JSON.parse(packText) as { chapters?: Array<{ chapterNumber?: number }> };
  if (Array.isArray(pack.chapters)) pack.chapters = pack.chapters.filter((c) => Number(c?.chapterNumber) === chapterNumber);
  return JSON.stringify(pack, null, 2);
}

/** Default: a per-reviewer BLIND cwd holding ONLY the role's authorized inputs. This is
 *  CONSTRUCTIVE isolation — codex `read-only` permits filesystem reads, so it narrows what
 *  the reviewer is HANDED (and what a relative read resolves), NOT what is reachable by an
 *  absolute path; the chapter-hash fence remains the mutation backstop. Fails OPEN to
 *  PIPELINE_DIR (today's behavior) on any build error so a reviewer is never starved of its
 *  inputs. qc-submit runs later in the conductor's PIPELINE_DIR, so the workspace only needs
 *  the reviewer's READ inputs. */
function defaultReviewerWorkspace(bookId: string, roundId: string, card: string, sessionId: string): { cwd: string; inputs: string[]; cleanup: () => void } {
  const open = { cwd: PIPELINE_DIR, inputs: [] as string[], cleanup: () => {} };
  try {
    const { role } = brokerCardTarget(card);
    const dir = resolve(tmpdir(), "cf-blind", bookId, roundId, sessionId.replace(/[^a-zA-Z0-9_-]/g, "-"));
    mkdirSync(dir, { recursive: true });
    const inputs: string[] = [];
    const copyInto = (src: string, asName: string): void => { if (existsSync(src)) { copyFileSync(src, resolve(dir, asName)); inputs.push(asName); } };
    if (role === "sweep") {
      copyInto(sweepPackPath(bookId, roundId), "sweep-pack.json");
    } else if (role === "keyA" || role === "keyB") {
      const kdir = keyPackDir(bookId, roundId);
      if (existsSync(kdir)) for (const f of readdirSync(kdir)) if (f.endsWith(".key-pack.json")) copyInto(resolve(kdir, f), f);
    } else if (role === "bar" || role === "confirm") {
      const n = chapterNumberFromCard(card);
      const bp = barPackPath(bookId, roundId);
      if (n != null && existsSync(bp)) {
        // SLICE the bar pack to the reviewed chapter (see sliceBarPackToChapter).
        writeFileSync(resolve(dir, "bar-pack.json"), sliceBarPackToChapter(readFileSync(bp, "utf8"), n), "utf8");
        inputs.push("bar-pack.json");
      }
    }
    // Nothing assembled (e.g. major triage, or the packs aren't on disk) → fall OPEN rather
    // than starve the reviewer; isolation is best-effort, correctness is never sacrificed.
    if (inputs.length === 0) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } return open; }
    return { cwd: dir, inputs, cleanup: () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ } } };
  } catch { return open; }
}

/** Single-shape (not a discriminated union) for simplicity: heldBy and refresh are just
 *  optional fields, always safe to read regardless of `ok`. `refresh()` is the heartbeat
 *  the conductor calls each loop iteration to keep a live lock fresh (and to detect a
 *  steal / a heartbeat it couldn't persist → it returns false and the conductor halts). */
export type BookLock = { ok: boolean; release: () => void; refresh?: () => boolean; heldBy?: string };

function defaultReadReviewPacket(bookId: string, roundId: string): string {
  try { const p = reviewPacketPath(bookId, roundId); return existsSync(p) ? readFileSync(p, "utf8") : ""; } catch { return ""; }
}

function defaultWriteTempSubmission(bookId: string, roundId: string, label: string, json: string): string {
  // OUTSIDE the book state (os tmp) so a brokered submission can never be mistaken for
  // tracked content; qc-submit --file reads it from there.
  const dir = resolve(tmpdir(), "cf-broker", bookId, roundId);
  mkdirSync(dir, { recursive: true });
  const p = resolve(dir, `${label}.json`);
  writeFileSync(p, json, "utf8");
  return p;
}

type LockRecord = { pid: number; host: string; at: string; owner: string };

/** Cross-host / heartbeat-silent fallback: a lock whose `at` is older than this is
 *  assumed dead. The conductor refreshes `at` every loop iteration, so this only
 *  fires when the owner crashed or hung past the window (NOT a fixed run-length cap). */
const LOCK_FALLBACK_STALE_MS = 2 * 60 * 60 * 1000;

function readLockRecord(path: string): LockRecord | null {
  try { return JSON.parse(readFileSync(path, "utf8")) as LockRecord; } catch { return null; }
}

/** Is a SAME-HOST lock's owner process definitely gone? process.kill(pid,0) throws
 *  ESRCH when the pid is dead, EPERM when it's alive under another user (→ alive).
 *  A cross-host lock can't be probed, so it relies on the time fallback instead. */
function ownerProcessDead(rec: LockRecord): boolean {
  if (rec.host !== hostname() || typeof rec.pid !== "number") return false;
  try { process.kill(rec.pid, 0); return false; } catch (err) { return (err as NodeJS.ErrnoException)?.code === "ESRCH"; }
}

function lockIsStale(rec: LockRecord | null, staleMs: number): boolean {
  if (!rec || !rec.owner) return true; // malformed / torn / pre-owner-token → stealable
  if (rec.host === hostname()) {
    // SAME host: PID-liveness is authoritative — a LIVE owner is never stale, even when
    // it's blocked for hours inside a long codex phase (its heartbeat merely paused). This
    // is what makes the steal safe: a sibling cannot time-steal a lock whose owner is still
    // running, so the only same-host steal is of a genuinely dead owner (which can't race
    // us back). Eliminates the refresh-overwrite double-ownership window same-host.
    return ownerProcessDead(rec);
  }
  // CROSS host: can't probe liveness → time fallback (heartbeat silent past the window).
  const ageMs = rec.at ? Date.now() - Date.parse(rec.at) : NaN;
  return Number.isFinite(ageMs) && ageMs >= staleMs;
}

/** Acquire an advisory per-book run lock under `lockDir` so two AUTOPILOT runs can't
 *  race the same book's state. NOTE: only runAutopilot acquires this — a manual
 *  fanout/author/qc verb does NOT honor it, so this is an autopilot-vs-autopilot lock,
 *  not a whole book-state lock (a full book-state mutex is a separate, larger change).
 *
 *  TOCTOU-safe: atomic `wx` create (no check-then-act); a stale lock is stolen
 *  ATOMICALLY by renaming it aside (exactly one racer wins the rename — losers get
 *  ENOENT and back off), never unlink-then-recreate (which let two racers both steal).
 *  The lock carries a random owner token: release()/refresh() only touch the file if
 *  WE still own it, so a process that lost a steal can never delete the winner's lock.
 *  Synchronous and NON-BLOCKING by design (it runs before runAutopilot's try/catch and
 *  must never throw or wait): a held-fresh lock fails fast with heldBy.
 *  Exported (and dir-parameterized) so it's unit-testable against a temp dir. */
export function acquireBookLock(lockDir: string, bookId: string, staleMs = LOCK_FALLBACK_STALE_MS): BookLock {
  const path = resolve(lockDir, `${bookId}.lock`);
  const owner = `${process.pid}-${hostname()}-${randomBytes(6).toString("hex")}`;
  const mkRecord = (): string => JSON.stringify({ pid: process.pid, host: hostname(), at: new Date().toISOString(), owner } satisfies LockRecord);
  const ownsCurrent = (): boolean => readLockRecord(path)?.owner === owner;
  // Atomic create-exclusive: true on success, false on EEXIST, rethrow other fs errors.
  const tryCreate = (): boolean => {
    try { writeFileSync(path, mkRecord(), { flag: "wx" }); return true; }
    catch (err) { if ((err as NodeJS.ErrnoException)?.code === "EEXIST") return false; throw err; }
  };

  // Never throw: a write failure (disk full / permission) or a lost steal returns
  // ok:false so the conductor halts cleanly via its `if (!lock.ok)` guard — the acquire
  // runs BEFORE runAutopilot's try/catch, so an escaping exception would crash the
  // walk-away run instead of producing a structured infra halt.
  try {
    mkdirSync(lockDir, { recursive: true });
    if (!tryCreate()) {
      const held = readLockRecord(path);
      if (!lockIsStale(held, staleMs)) {
        return { ok: false, release: () => {}, heldBy: held ? `pid ${held.pid}@${held.host} (owner ${held.owner}) since ${held.at}` : "an unreadable lock" };
      }
      // Stale → steal atomically: only the racer whose rename succeeds proceeds.
      const aside = `${path}.steal-${owner}`;
      try { renameSync(path, aside); } catch (err) {
        return { ok: false, release: () => {}, heldBy: `lost the steal race for a stale lock (${(err as NodeJS.ErrnoException)?.code ?? "?"})` };
      }
      try { unlinkSync(aside); } catch { /* best-effort: drop the stolen lock */ }
      if (!tryCreate()) {
        const now = readLockRecord(path);
        return { ok: false, release: () => {}, heldBy: now ? `raced after a steal — pid ${now.pid}@${now.host}` : "raced after a steal" };
      }
    }
  } catch (err) {
    return { ok: false, release: () => {}, heldBy: `lock-file write failed (${(err as Error)?.message ?? String(err)})` };
  }

  let released = false;
  return {
    ok: true,
    // Heartbeat: rewrite `at` (SAME owner) via write-temp-then-rename so a racing reader
    // never sees a torn/empty file. Returns false (and stops touching the lock) the moment
    // we DON'T own it — a successor stole it — so we never clobber or delete the winner's
    // lock. The conductor halts on a false, bounding any double-run to one loop iteration.
    refresh: (): boolean => {
      if (released) return false;
      if (!ownsCurrent()) { released = true; return false; }
      // Fail-closed: if we cannot PERSIST the heartbeat we cannot prove the lease is
      // still ours, so report unhealthy and let the conductor halt. Do NOT set
      // `released` here — a transient FS blip is not loss of ownership, and leaving it
      // false keeps release()'s token-checked cleanup running in the `finally`.
      // Per-CALL unique temp suffix (not just per-owner): concurrent heartbeat() calls during a
      // parallel write phase share one owner string and would otherwise race the SAME temp path
      // (the loser hits ENOENT after the winner renames it away). Harmless today (doWrite ignores
      // the return), but a unique suffix removes the latent spurious-false.
      try { const tmp = `${path}.hb-${owner}-${randomBytes(4).toString("hex")}`; writeFileSync(tmp, mkRecord(), "utf8"); renameSync(tmp, path); } catch { return false; }
      return true;
    },
    // Token-checked release: only unlink if WE still own it (never delete a successor's).
    release: () => {
      if (released) return; released = true;
      try { if (ownsCurrent()) unlinkSync(path); } catch { /* best-effort */ }
    },
  };
}

export function resolveDeps(d?: Partial<AutopilotDeps>): AutopilotDeps {
  return {
    statusOf: d?.statusOf ?? computeBookStatus,
    runVerb: d?.runVerb ?? defaultRunVerb(),
    spawn: d?.spawn ?? spawnCodexAgent,
    listTaskCards: d?.listTaskCards ?? defaultListTaskCards,
    listWriteCards: d?.listWriteCards ?? defaultListWriteCards,
    latestRoundId: d?.latestRoundId ?? defaultLatestRoundId,
    expectedChapterNumbers: d?.expectedChapterNumbers ?? defaultExpectedChapterNumbers,
    readTask: d?.readTask ?? ((p) => readFileSync(p, "utf8")),
    mkSessionId: d?.mkSessionId ?? defaultMkSessionId,
    chapterHashes: d?.chapterHashes ?? defaultChapterHashes,
    anyCarryable: d?.anyCarryable ?? defaultAnyCarryable,
    sweepConfirmed: d?.sweepConfirmed ?? defaultSweepConfirmed,
    majorFindingKeys: d?.majorFindingKeys ?? defaultMajorFindingKeys,
    blockingMajors: d?.blockingMajors ?? defaultBlockingMajors,
    submissionPresent: d?.submissionPresent ?? submissionPresentOnDisk,
    logSession: d?.logSession ?? logSessionToDisk,
    logBroker: d?.logBroker ?? logBrokerToDisk,
    reviewerSkeleton: d?.reviewerSkeleton ?? defaultReviewerSkeleton,
    reviewerWorkspace: d?.reviewerWorkspace ?? defaultReviewerWorkspace,
    readReviewPacket: d?.readReviewPacket ?? defaultReadReviewPacket,
    writeTempSubmission: d?.writeTempSubmission ?? defaultWriteTempSubmission,
    acquireLock: d?.acquireLock ?? ((bookId) => acquireBookLock(resolve(PIPELINE_DIR, "state", "autopilot-locks"), bookId)),
    log: d?.log ?? ((m) => console.log(m)),
  };
}

// ── The conductor ────────────────────────────────────────────────────────────

const MAX_LOOP_ITERS = 40; // safety backstop; real phases advance well under this
// R3 — how many times, per repair attempt, to re-dispatch a TARGETED fix for a major the repair
// itself introduced (qc-converge can't see majors). Small + separate from the outer maxRepair
// round budget; the outer loop + noProgress halt are the global anti-spin backstop.
const REGRESSION_REDISPATCH_CAP = 2;

export async function runAutopilot(opts: AutopilotOptions): Promise<AutopilotOutcome> {
  const deps = resolveDeps(opts.deps);
  const bookId = opts.bookId;
  // Validate the bookId BEFORE it touches any path (lock / state / blind-workspace / broker-temp
  // dirs) or a spawned CLI argv. It arrives as a raw CLI positional and flows into resolve()-based
  // path construction, which collapses '../' — so an unvalidated id is a path-traversal +
  // same-book-mutex-bypass vector. Same lowercase-slug rule the rest of the pipeline uses
  // (researcher-bibliography / normSlug). A '--'-prefixed id (swallowed as a flag upstream) also
  // fails this. Refuse up front with a structured halt rather than acting on it.
  // Validate against the CANONICAL slug form, not just a loose regex. The lock is taken on the RAW
  // bookId while all chapter/state ops normalize via normSlug — so a non-canonical id (e.g.
  // "my-book-", "my--book") would get a DIFFERENT lock than its normalized state, bypassing the
  // same-book mutex (#6). Requiring bookId === normSlug(bookId) makes lock and state agree, rejects
  // traversal / '--'-prefixed / non-canonical ids, and accepts every real slug (#13).
  if (typeof bookId !== "string" || bookId.length === 0 || normSlug(bookId) !== bookId) {
    return mkHalt(String(bookId), "research", "governance", `invalid bookId "${bookId}" — must be a canonical lowercase slug (got normSlug="${typeof bookId === "string" ? normSlug(bookId) : "?"}"). Refusing to run: a non-canonical id takes a different run lock than its normalized state (mutex bypass) and can traverse lock/state/temp paths.`);
  }
  const maxRepair = opts.maxRepairRounds ?? 4; // 4 (was 3): one extra round of headroom so a single noisy QC round doesn't doom convergence; the absolute loop cap (MAX_LOOP_ITERS) still backstops a treadmill.
  const maxParallel = opts.maxParallel ?? 6;
  const autoPublish = opts.autoPublish ?? false;
  const regen = opts.regen ?? false;

  // plan is a read-only dry-run (takes no action, acquires no lock). Guard the status read so a
  // corrupt chapter surfaces as a clean infra halt instead of an uncaught crash (this path runs
  // BEFORE the try/catch below). It deliberately does NOT quarantine — a dry-run must not mutate.
  if (opts.plan) {
    try { return planOnly(bookId, deps, regen); }
    catch (err) { return mkHalt(bookId, "research", "infra", `--plan could not read book status (likely a corrupt chapter file): ${(err as Error)?.message ?? String(err)}`); }
  }

  // Same-book lock: refuse to start if another run holds it (prevents two conductors
  // racing the same book's state). Released in `finally` on every exit path.
  const lock = deps.acquireLock(bookId);
  if (!lock.ok) {
    return mkHalt(bookId, safePhase(bookId, deps, regen), "infra", `could not acquire the run lock for ${bookId} (${lock.heldBy ?? "unknown"}). If a previous run died, remove state/autopilot-locks/${bookId}.lock and retry.`);
  }
  deps.log(`[autopilot] strict invariants ENFORCED (no-API · source-verify-required · session-independence); lock acquired for ${bookId}`);

  // Self-heal a torn chapter file — AFTER acquiring the lock so a REJECTED second conductor never
  // mutates this book's state (#17). A half-written chapter (crash mid-save) makes
  // loadBookChapters→computeBookStatus throw on every read, which would wedge the conductor
  // permanently ("re-run to resume" re-throws). Quarantine moves it aside so the chapter is treated
  // as MISSING and re-authored. (Atomic writes now PREVENT new tears; this recovers a pre-existing
  // /external one.) Self-guarded so it can't throw out and strand the just-acquired lock.
  try {
    const quarantined = quarantineCorruptChapterFiles(bookId);
    if (quarantined.length) deps.log(`[autopilot] quarantined ${quarantined.length} corrupt chapter file(s) → state/chapters/_corrupt/ (will be re-authored): ${quarantined.join(", ")}`);
  } catch { /* best-effort: a quarantine failure must never block the run */ }

  // Heartbeat the run lock from INSIDE the long phases too, not just once per outer iteration.
  // A single QC iteration (an initial round + up to maxRepair repair rounds, each spawning many
  // 30-min codex sessions) — or a large write phase — can run for HOURS, longer than the
  // cross-host stale window (LOCK_FALLBACK_STALE_MS), so without an in-phase refresh a cross-host
  // sibling could time-steal a lock whose owner is alive but mid-phase. refresh() keeps `at` fresh
  // (and returns false the moment we no longer own it). Same-host liveness already protects us;
  // this closes the cross-host window. No-op when the lock impl has no refresh (test stubs).
  const heartbeat = (): boolean => (lock.refresh ? lock.refresh() : true);

  try {
    let lastSignature = "";
    for (let iter = 0; iter < MAX_LOOP_ITERS; iter++) {
      // Heartbeat: keep our lock fresh AND detect a steal. If refresh() reports we no
      // longer own it (a successor took over after our heartbeat went stale), HALT rather
      // than keep conducting — never two conductors driving the same book.
      if (lock.refresh && !lock.refresh()) {
        return mkHalt(bookId, safePhase(bookId, deps, regen), "infra", `lost the run lock for ${bookId} mid-run (ownership taken over OR heartbeat write failed) — halting to avoid two conductors on the same book.`);
      }
      const status = deps.statusOf(bookId);
      const sweepConfirmed = deps.sweepConfirmed(bookId);
      const phase = decidePhase(status, sweepConfirmed, regen);
      // sweepConfirmed is in the signature so a confirming round (which leaves the chapter counts
      // unchanged but flips confirmation) counts as PROGRESS, not a no-progress halt.
      const sig = `${phase}:${status.writtenChapters}/${status.expectedChapters ?? "?"}:${status.gatedChapters}:${status.qcdChapters}:${sweepConfirmed ? "c" : "u"}`;
      deps.log(`[autopilot] phase=${phase} written=${status.writtenChapters}/${status.expectedChapters ?? "?"} gated=${status.gatedChapters} qcd=${status.qcdChapters}`);

      if (phase === "shipped") return { status: "shipped", bookId };
      if (phase === "ready") return handleReady(bookId, status, autoPublish, deps);

      // No-progress guard: if the same (phase, counts) recur after we acted, the
      // phase isn't advancing — escalate instead of looping forever.
      if (sig === lastSignature) {
        return mkHalt(bookId, phase, "progress", `no progress in phase "${phase}" (state unchanged after an action: ${sig}) — inspect: npx tsx src/cli.ts book-status ${bookId}`);
      }
      lastSignature = sig;

      if (phase === "research") {
        const ok = await doResearch(bookId, deps);
        if (!ok) return mkHalt(bookId, phase, "infra", `research agent did not complete; inspect research artifacts + state/autopilot-logs/${bookId}`);
        continue;
      }
      if (phase === "write") {
        await doWrite(bookId, status, maxParallel, deps, heartbeat);
        continue;
      }
      if (phase === "gate") {
        const halt = await doGate(bookId, maxRepair, deps, heartbeat);
        if (halt) return halt;
        continue;
      }
      if (phase === "qc") {
        const result = await doQcWithRepair(bookId, maxRepair, maxParallel, deps, heartbeat);
        if (result) return result; // halt or ready handled inside; null = re-loop
        continue;
      }
    }
    return mkHalt(bookId, safePhase(bookId, deps, regen), "progress", `loop iteration cap (${MAX_LOOP_ITERS}) hit — likely a stuck phase`);
  } catch (err) {
    // A codex spawn rejection (timeout / ENOENT) or any unexpected throw becomes a
    // structured infra halt with a resume hint — never an unhandled rejection that
    // crashes the walk-away run with a bare stack trace.
    return mkHalt(bookId, safePhase(bookId, deps, regen), "infra", `unexpected failure: ${(err as Error)?.message ?? String(err)} — re-run \`book-autopilot ${bookId}\` to resume from the current phase (logs: state/autopilot-logs/${bookId}).`);
  } finally {
    lock.release();
  }
}

/** decidePhase guarded against a statusOf that itself throws (used only in halt/error paths). */
function safePhase(bookId: string, deps: AutopilotDeps, regen = false): AutopilotPhase {
  try { return decidePhase(deps.statusOf(bookId), deps.sweepConfirmed(bookId), regen); } catch { return "research"; }
}

// ── Phase: research ──────────────────────────────────────────────────────────

// Research is one codex session doing live web research + building the full source
// sidecar, so it is the slowest phase — the 30-min default session cap cut it close on
// real books (the-willpower-instinct landed at ~26 min). Give research ALONE a 45-min
// cap; write / gate-repair / QC keep the 30-min spawnCodexAgent default.
const RESEARCH_TIMEOUT_MS = 45 * 60 * 1000;

async function doResearch(bookId: string, deps: AutopilotDeps): Promise<boolean> {
  const promptPath = resolve(AGENT_PROMPTS_DIR, "RESEARCH-CODEX-SESSION.md");
  const task = `${deps.readTask(promptPath)}\n\n---\nRun the research phase for bookId: ${bookId}. Follow the playbook above until book-status reports the write phase.`;
  deps.log(`[autopilot] research: spawning 1 codex session for ${bookId}`);
  const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId("research"), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS, timeoutMs: RESEARCH_TIMEOUT_MS }, deps);
  if (!r.ok) deps.log(`[autopilot] research session exited ${r.exitCode}: ${r.stderr.slice(0, 300)}`);
  return r.ok;
}

// ── Phase: write (fan out one agent per MISSING chapter) ──────────────────────

// The autopilot writer's pre-submit SELF-VERIFY — the write-time half of QC. WT-F
// wired these levers into the MANUAL path (STEP-2-WRITE-CHAPTERS.md) but NOT the
// autopilot writer task, so on a live autopilot run the writers only ran the
// DETERMINISTIC gate (author-check/gate-chapter) and submitted — semantic defects
// (a wrong quiz key whose explanation contradicted it, performative rituals, abstract
// scenes) sailed through to QC and forced a repair round. This closes that gap:
// every autopilot writer now runs the hidden-key + bar self-score before declaring
// done, mirroring STEP-2. Exported so a test pins it (the gap had no test).
export const WRITER_SELF_VERIFY = `SELF-VERIFY before declaring the chapter done — run ALL FOUR. This is the write-time half of QC: a defect caught here costs zero QC rounds; one you skip costs a full round.

1. DETERMINISTIC — run \`author-check\` and \`gate-chapter\` on the chapter file you just authored, and fix until both report 0 blockers.

2. HIDDEN-KEY (quiz soundness — the leading cause of a CORRUPTION verdict). Derive every quiz answer BLIND, then diff it against the key you stored:
   - \`npx tsx src/cli.ts quiz-blind state/chapters/<chapterId>.v21-native.chapter.json\` (prints the quiz with the stored key hidden)
   - answer each question yourself from the prompt + choices ALONE, then
   - \`npx tsx src/cli.ts quiz-verify state/chapters/<chapterId>.v21-native.chapter.json --answers "0:<i>,1:<i>,..."\`
   Any mismatch means the stored key is wrong, or the question has two defensible answers, or the explanation argues for a DIFFERENT choice than the key — re-key it or rewrite the question so exactly one choice is correct AND its explanation proves that choice.

3. EVIDENCE TRACE (factual_accuracy — the dominant CORRUPTION after quiz keys). Every named person who carries a finding must trace to your research brief. Run:
   - \`npx tsx src/cli.ts evidence-audit state/chapters/<chapterId>.v21-native.chapter.json\`
   For each flagged item, confirm the named actor is a REAL source from your brief. The "Piper move" is the trap: an INVENTED character cast as a study participant/subject ("participant Lawrence") or staged inside a real researcher's lab / study / class to voice or act out the result. The documented study IS the evidence — an invented witness inside it is fabrication. FIX: report the real finding (cite the researcher by name), then move your invented actor into a plain EVERYDAY setting where they APPLY the lesson; never cast them as a research subject. The second trap is the "Hardy move" (MISATTRIBUTION): crediting a real, named authority with a claim your brief does NOT credit them with. A name your brief only MENTIONS or COMPARES ("like Darren Hardy's Compound Effect") is not a license to attribute a finding to them ("Hardy found…", "Hardy's phrase"). For each ATTRIBUTION? item, confirm the brief credits THAT person with THAT claim — otherwise credit the real owner the brief names. Also resolve any EI1/EI2 testimonial (a first-name/initial-only account worn as proof).

4. BAR SELF-SCORE — read the 9-axis publishable bar (\`npx tsx src/cli.ts publishable-rubric\`) and score your draft honestly. Fix any corruption-axis hit and any axis you'd score below ~0.85 before submitting. Step 1's gate now PROVES the STRUCTURAL corruption tells are clean — an invented-witness cast (EW1), a stuttered word or verbatim triple-repeat (SEAM), a named-set miscount (NE1), an ungrounded number (GN1) — so do NOT re-derive those. Spend your judgment ONLY on the modes the deterministic gate cannot see:
   - behavioral_naturalness: NO contrived/performative micro-actions ("say aloud X", move a prop, tally on cue) — prescribe only the real functional action. The implementation plan's if-thens apply ONE move to different triggers in freshly-written actions, never the same action sentence pasted under each; and every reader action (tryThisNow, the 24-hour challenge, each if-then) is a real doable thing the reader could prove they did, not a say-aloud mantra.
   - example_coherence: every scenario carries a concrete time / place / role; never an abstract "the system does X" scene.
   - persona_coherence: every NAMED person is ONE consistent individual with ONE role for the whole chapter. Never reuse a first name for unrelated people/roles ("James helps at GE, then James makes hospital discharge calls, then James runs a training folder" reads as three different people sharing a name, and QC REVISEs it as persona_drift). Need a second person? Give them a distinct name. A named person who recurs keeps the same identity and role.
   - factual_accuracy: no invented precision; NO invented witness (a fictional "participant" acting out a real study — see step 3); never state a contested finding (ego depletion, marshmallow-as-destiny) as settled fact. A spine number (a doubling, a compounding rate, a multiplier) is walked through in the deep tiers and stated at its true magnitude, never dropped as a bare conclusion or rounded down to a lazy comparison (a ~37x result is not 'more than triple').
   - prose_coherence: tiers layer NEW ground, not reworded restatement; cadence varies.

Do not declare the chapter done until all four pass.`;

async function doWrite(bookId: string, status: BookStatus, maxParallel: number, deps: AutopilotDeps, heartbeat: () => boolean = () => true): Promise<void> {
  const writeDir = `state/authoring-cards/${bookId}`;
  // Deal the dispatch cards (idempotent; also writes the pre-authoring plans).
  const fanout = await deps.runVerb(["fanout", bookId, "--write-dir", writeDir]);
  if (fanout.code !== 0) {
    deps.log(`[autopilot] fanout exited ${fanout.code}: ${(fanout.stderr || fanout.stdout).slice(0, 300)}`);
    return; // no-progress guard will halt on the next loop if nothing advances
  }
  const written = new Set(status.chapters.filter((c) => c.written).map((c) => c.number));
  const cards = deps.listWriteCards(bookId);
  const missing = cards.filter((card) => {
    const n = chapterNumberFromCard(card);
    return n != null && !written.has(n);
  });
  deps.log(`[autopilot] write: ${missing.length} chapter(s) to author (parallel ≤${maxParallel})`);
  await mapWithConcurrency(missing, maxParallel, async (card) => {
    heartbeat(); // keep the run lock fresh across a long (multi-hour) write phase
    const n = chapterNumberFromCard(card);
    const writerSessionId = deps.mkSessionId(`write-ch${n}`);
    deps.log(`[autopilot] write ch${n}: writer working`); // per-chapter START (one writer agent per chapter)
    const task = `${deps.readTask(card)}\n\n---\nYou are a fresh Writer subagent for bookId ${bookId}, chapter ${n}. Author the chapter per the dispatch card above.\n\n${WRITER_SELF_VERIFY}`;
    const r = await spawnAndLog(bookId, { task, sessionId: writerSessionId, cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
    if (!r.ok) deps.log(`[autopilot] write ch${n} session exited ${r.exitCode}`);
    else deps.log(`[autopilot] write ch${n}: done`); // per-chapter SUCCESS
    // Record the authoring session so finalize's author≠reviewer invariant has a real AUTHOR
    // side under autopilot (previously only qc-stamp-author wrote provenance, which the conductor
    // never runs → the headline independence check silently no-op'd). Best-effort; a sidecar
    // write failure must never sink the write phase. (Reviewers get DISTINCT session ids by
    // construction, so this never false-collides.)
    // Bind to the authored content hash: provenance is create-once per content, so a
    // no-op writer that reproduced identical content can never overwrite a prior author
    // (the conflict throws and is swallowed here, preserving the real author).
    if (n != null) {
      try { recordAuthorProvenance(`${bookId}-ch${String(n).padStart(2, "0")}`, writerSessionId, chapterContentHashByNumber(bookId, n)); }
      catch (e) { deps.log(`[autopilot] write ch${n}: author provenance unchanged (${(e as Error).message.split(".")[0]})`); }
    }
    return r;
  });
}

// ── Phase: gate (repair ship/book-gate blockers, bounded) ─────────────────────

async function doGate(bookId: string, maxRepair: number, deps: AutopilotDeps, heartbeat: () => boolean = () => true): Promise<AutopilotOutcome | null> {
  // BP7 (book-pattern audit) fails closed without durable brief + per-chapter plan artifacts under
  // state/briefs|plans/, which the codex authoring path does NOT persist. `derive-artifacts` is a
  // deterministic, side-effect-free pass over on-disk state, so derive them up front: this resolves
  // BP7 deterministically instead of leaving it to the content-repair agent's initiative. The repair
  // task below says "edit chapter CONTENT only", so a compliant agent would never create those files
  // and the loop would burn every attempt then HALT "deterministic gates still DIRTY". Best-effort —
  // a derive failure just falls back to the prior agent-driven behavior, no worse than before.
  const derived = await deps.runVerb(["derive-artifacts", bookId]);
  if (derived.code !== 0) deps.log(`[autopilot] derive-artifacts exited ${derived.code} before gate convergence (BP7 may persist) — ${(derived.stderr || derived.stdout).slice(0, 200)}`);
  let varietyPasses = 0; // pre-QC cross-chapter variety scout passes (bounded; independent of maxRepair)
  for (let attempt = 1; attempt <= maxRepair; attempt++) {
    // Keep the run lock fresh across this multi-hour repair phase (each attempt spawns a 30-min
    // codex session); halt if a successor took the lock — same as doQcWithRepair.
    if (!heartbeat()) {
      return mkHalt(bookId, "gate", "infra", `lost the run lock for ${bookId} mid-gate-repair — halting to avoid two conductors on the same book.`);
    }
    const converge = await deps.runVerb(["qc-converge", bookId]);
    // exit 1 = dirty content (repair); exit ≥2 = qc-converge itself errored (no chapters,
    // bad args, internal) — that's infra, NOT a reason to tell an agent to edit content.
    if (converge.code >= 2) return mkHalt(bookId, "gate", "infra", `qc-converge errored (exit ${converge.code}) — not a content problem; inspect: ${(converge.stderr || converge.stdout).slice(0, 300)}`);
    if (converge.code !== 0) {
      // DETERMINISTIC-DIRTY (blockers) → converge the cheap deterministic battery first.
      deps.log(`[autopilot] gate repair attempt ${attempt}/${maxRepair} — converging deterministic gates`);
      const task = `Fix the DETERMINISTIC gate findings below for bookId ${bookId} by editing chapter CONTENT only (state/chapters/), then run \`npx tsx src/cli.ts qc-converge ${bookId}\` until it reports DETERMINISTIC-CLEAN. Fix EVERY finding in one pass. Do NOT edit pipeline code/config.\n\n${converge.stdout}`;
      const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId(`gate-repair-${attempt}`), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
      if (!r.ok) deps.log(`[autopilot] gate repair session exited ${r.exitCode}`);
      continue;
    }
    // Blockers are CLEAN. Now converge the BLOCKING majors BEFORE handing off to QC.
    // Majors are invisible to qc-converge (it gates on blockers only), but finalize
    // REVISEs on any unresolved major and the QC phase would governance-halt on it —
    // so fixing them HERE, in the cheap deterministic gate loop, is the "majors fixed
    // before write→QC handoff" the owner wants. ADVISORY majors are excluded
    // (critics/majorPolicy.ts) so this never chases a reference-corpus false positive.
    const majors = deps.blockingMajors(bookId);
    if (majors.length === 0) {
      // Blockers + blocking-majors are CLEAN. The LAST thing QC checks that the blind parallel
      // writers could NOT self-check is cross-chapter VARIETY (the templating sweep). Converge it
      // HERE — bounded + best-effort — so the first QC round starts de-templated (the first-pass-QC
      // lever). A pass that finds nothing is one cheap full-book read; a pass that finds templating
      // surgically differentiates the flagged chapters then re-loops (the next iteration re-converges
      // any blocker a detemplate edit introduced, then re-scouts or advances).
      if (varietyPasses < PREQC_MAX_VARIETY_PASSES) {
        varietyPasses++;
        const rewrites = await scoutCrossChapterVariety(bookId, deps);
        if (rewrites.length) {
          deps.log(`[autopilot] pre-QC variety pass ${varietyPasses}/${PREQC_MAX_VARIETY_PASSES}: differentiating ${rewrites.length} chapter(s) before QC — ${rewrites.map((rw) => `ch${rw.chapter}`).join(", ")}`);
          await surgicalDetemplate(bookId, rewrites, deps, varietyPasses);
          continue;
        }
        deps.log(`[autopilot] pre-QC variety pass ${varietyPasses}: book reads varied (no cross-chapter templating) → advancing to QC`);
      }
      return null; // blockers + blocking-majors + cross-chapter variety all clean → advance to qc
    }
    deps.log(`[autopilot] gate repair attempt ${attempt}/${maxRepair} — converging ${majors.length} blocking major(s) before QC: ${majors.map((m) => m.checkId).join(", ")}`);
    const task = buildGateMajorRepairTask(bookId, majors, deps);
    const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId(`gate-major-repair-${attempt}`), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
    if (!r.ok) deps.log(`[autopilot] gate major-repair session exited ${r.exitCode}`);
    // A major fix is a content edit that can re-introduce a blocker — loop re-runs
    // qc-converge first, so the next pass cleans any new blocker before re-checking majors.
  }
  const final = await deps.runVerb(["qc-converge", bookId]);
  if (final.code >= 2) return mkHalt(bookId, "gate", "infra", `qc-converge errored (exit ${final.code}) after ${maxRepair} repair rounds — inspect: ${(final.stderr || final.stdout).slice(0, 300)}`);
  if (final.code !== 0) return mkHalt(bookId, "gate", "content", `deterministic gates still DIRTY after ${maxRepair} repair rounds — escalate. Run: npx tsx src/cli.ts qc-converge ${bookId}`);
  const residualMajors = deps.blockingMajors(bookId);
  if (residualMajors.length === 0) return null;
  return mkHalt(bookId, "gate", "content", `${residualMajors.length} blocking major(s) still unresolved after ${maxRepair} gate rounds — escalate (these are real, fixable defects, not advisory). Run: npx tsx src/cli.ts major-status ${bookId}\n${residualMajors.map((m) => `  [${m.checkId}] ${m.scope}: ${m.message.slice(0, 140)}`).join("\n")}`);
}

/** Build the gate-phase MAJOR-repair task: the blocking majors to fix (advisory ones
 *  already excluded), the dealt authoring cards for any named chapter so a
 *  structural-sameness major (BP33 opener reuse, BP27 venue, F3 answer drift) is
 *  RE-STAGED onto its distinct dealt slots rather than surgically patched onto a
 *  shared frame, and the same isolation guardrails the QC repair uses. */
function buildGateMajorRepairTask(bookId: string, majors: MajorFindingSnapshot[], deps: AutopilotDeps): string {
  const chapters = new Set<number>();
  for (const m of majors) {
    const scoped = m.scope.match(/^chapter:(\d+):/);
    if (scoped) chapters.add(Number(scoped[1]));
    for (const mm of `${m.message} ${m.evidence ?? ""}`.matchAll(/\bch(?:apter)?s?\.?\s*(\d+)/gi)) chapters.add(Number(mm[1]));
  }
  const writeCards = deps.listWriteCards(bookId);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dealtCards = [...chapters].sort((a, b) => a - b).map((n) => {
    const c = writeCards.find((c) => chapterNumberFromCard(c) === n);
    return c ? `\n\n--- DEALT AUTHORING CARD ch${pad(n)} (re-stage onto THESE dealt shape/venue/opener slots — do NOT collapse onto a shared frame) ---\n${deps.readTask(c)}` : "";
  }).join("");
  const findingList = majors.map((m) => `- [${m.checkId}] ${m.scope}: ${m.message}${m.evidence ? ` — "${m.evidence.slice(0, 140)}"` : ""}`).join("\n");
  return `Fix the BLOCKING MAJOR findings below for bookId ${bookId} by editing chapter CONTENT only (state/chapters/). These are real, fixable defects (advisory majors are already excluded). Edit each named chapter IN ISOLATION — do NOT copy one chapter's scenes, names, openers, or phrasing into another (that re-creates the cross-chapter templating the sweep flags). Preserve every number, proper noun, and source anchor. Do NOT edit pipeline code/config.

After editing, VERIFY:
  npx tsx src/cli.ts qc-converge ${bookId}        # must stay DETERMINISTIC-CLEAN (no new blocker)
  npx tsx src/cli.ts major-status ${bookId}       # the listed majors must clear (ADVISORY lines are fine — leave them)
Fix EVERY blocking major below in one pass; loop until major-status shows 0 unresolved (non-advisory).

BLOCKING majors:
${findingList}${dealtCards}`;
}

// ── Pre-QC cross-chapter VARIETY convergence (the first-pass-QC lever) ─────────
// The dominant first-pass-QC REVISE driver is NOT a per-chapter quality miss — the
// writers self-score the 9-axis bar and it lands GREEN. It is cross-chapter TEMPLATING
// the blind parallel writers structurally cannot self-detect: the QC sweep's four
// families (scene_skeleton / repeated_unit / location_stamping / persona_drift) plus
// the QC rule "any chapter touched by a sweep finding caps at REVISE regardless of its
// per-chapter quality." A blind writer following a DISTINCT dealt move can still realize
// a SHARED scene FRAME, and nothing between write and QC has full-book visibility to see
// it — so it first surfaces at QC and burns repair rounds.
//
// Converge that variety HERE, at the gate, so the FIRST QC round starts de-templated.
// A single full-book SCOUT (the same sweep rubric, read-only) emits a COORDINATED
// differentiation brief — for each templated cluster it names ONE chapter to KEEP the
// frame and the OTHERS to move — and SURGICAL per-chapter repairs (one session each,
// editing ONLY its chapter) execute it. The coordinated brief is exactly the
// cross-chapter signal the blind R4 QC-repair loop lacks (which is WHY templating takes
// several blind rounds to clear). Bounded by PREQC_MAX_VARIETY_PASSES (independent of the
// deterministic repair budget), best-effort (a scout/parse failure just advances — QC
// stays the safety net), and a no-op on an already-varied book (gold reads CLEAN → one
// cheap read, zero edits → no FP-on-gold regression risk: it reuses the sweep rubric +
// FP-guards, and the formal sweep already passes gold).

const PREQC_MAX_VARIETY_PASSES = 2;     // full-book scout passes per gate, independent of maxRepair
const PREQC_MAX_REWRITES_PER_PASS = 4;  // cap surgical sessions per pass (bounds cost on a systemically-templated book)

type VarietyRewrite = { chapter: number; family?: string; shared?: string; instruction: string };

/** The read-only full-book scout prompt: the QC sweep's own rubric (families + FP-guards),
 *  asking for a per-chapter differentiation brief as a single ```json fenced block. */
function buildVarietyScoutTask(bookId: string): string {
  return `You are a READ-ONLY cross-chapter VARIETY scout for bookId ${bookId}. Read EVERY chapter file \`state/chapters/${bookId}-ch*.v21-native.chapter.json\` in ONE pass and look ONLY for cross-chapter TEMPLATING — the defect class per-chapter reads structurally miss, and the exact thing the QC "templating sweep" REVISEs the book on. Do NOT edit any file; this is analysis only.

Compare these fields ACROSS chapters: title, hook, counterintuition, keyTakeaway, tryThisNow, breakdown.{fastRead,deepRead,fullRead}, examples[].{title,scenario,whatToDo,whyItMatters}, quiz[].prompt, reviewCards[].{front,back}, implementationPlan.{twentyFourHourChallenge,weeklyPractice,ifThenPlans[]}, memorableLines.

Flag a cluster ONLY for these families:
1. scene_skeleton — example scenes sharing one FRAME across chapters: one functional MOVE / device reused with only the nouns swapped (the dramatic transaction is identical while names / props / setting change). E.g. a "decision made alone under deadline" beat reused chapter after chapter.
2. persona_drift — one NAME worn by different people: ACROSS chapters (a source figure's first name reused on a fictional protagonist), OR WITHIN one chapter (the same first name attached to unrelated roles — "James helps at GE, then James makes hospital discharge calls, then James runs a training folder" reads as three different people sharing a name).
3. repeated_unit — near-identical cards / plans / quiz stems / hooks / tactics / marquee exemplars across chapters, or one example UNIT reused as the same functional move.
4. location_stamping — one venue / company / setting stamped across many chapters.

FP-GUARDS — do NOT flag: shared CONCEPT terms (the book's own vocabulary), an ordinary recurring GESTURE ("nods", "takes a breath"), or a consistent pedagogical opener with DIFFERING content. Only flag a reused structural DEVICE. Be conservative: a borderline echo is NOT templating.

For each cluster, choose ONE chapter to KEEP the frame and list the OTHERS as rewrites (NEVER list every chapter in a cluster — one always keeps). Give each rewrite a concrete, chapter-specific differentiation instruction (move onto a distinct scene frame / venue / exemplar / name). A within-chapter persona_drift is a single rewrite for that chapter.

Output ONLY your brief as your FINAL message — a single \`\`\`json fenced block, nothing else:
\`\`\`json
{ "templated": false, "rewrites": [] }
\`\`\`
or, when templated:
\`\`\`json
{ "templated": true, "rewrites": [ { "chapter": 7, "family": "repeated_unit", "shared": "ch6 & ch7 both pivot on 'a decision without an owner'", "instruction": "Re-cast ch7's marquee diagnostic onto its dealt move + a distinct venue; leave ch6's version." } ] }
\`\`\`
If the book reads varied, return {"templated": false, "rewrites": []}.`;
}

/** Spawn the read-only full-book variety scout and parse its differentiation brief.
 *  Best-effort: any failure (agent exit, no parseable brief, bad JSON) returns [] → the
 *  gate advances to QC unchanged (QC stays the safety net). Validates + dedups to one
 *  rewrite per chapter and caps the count so a single pass is bounded. */
async function scoutCrossChapterVariety(bookId: string, deps: AutopilotDeps): Promise<VarietyRewrite[]> {
  let r: CodexAgentResult;
  try {
    r = await spawnAndLog(bookId, { task: buildVarietyScoutTask(bookId), sessionId: deps.mkSessionId("pre-qc-variety-scout"), cwd: PIPELINE_DIR, sandbox: "read-only" as CodexSandbox, skipGitRepoCheck: true, reasoningEffort: "high" }, deps);
  } catch (e) {
    deps.log(`[autopilot] pre-QC variety scout spawn error: ${(e as Error)?.message ?? String(e)} — advancing to QC`);
    return [];
  }
  if (!r.ok) { deps.log(`[autopilot] pre-QC variety scout exited ${r.exitCode} — advancing to QC`); return []; }
  const json = extractSubmissionJson(r.stdout) ?? extractSubmissionJson(r.finalMessage);
  if (!json) { deps.log(`[autopilot] pre-QC variety scout: no parseable brief in output — advancing to QC`); return []; }
  let brief: { templated?: boolean; rewrites?: unknown };
  try { brief = JSON.parse(json); } catch { deps.log(`[autopilot] pre-QC variety scout: brief JSON did not parse — advancing to QC`); return []; }
  if (!brief || brief.templated === false || !Array.isArray(brief.rewrites)) return [];
  const seen = new Set<number>();
  const out: VarietyRewrite[] = [];
  for (const raw of brief.rewrites as Array<Record<string, unknown>>) {
    const chapter = Number(raw?.chapter);
    const instruction = typeof raw?.instruction === "string" ? raw.instruction.trim() : "";
    if (!Number.isInteger(chapter) || chapter < 1 || !instruction || seen.has(chapter)) continue;
    seen.add(chapter);
    out.push({ chapter, family: typeof raw?.family === "string" ? raw.family : undefined, shared: typeof raw?.shared === "string" ? raw.shared : undefined, instruction });
    if (out.length >= PREQC_MAX_REWRITES_PER_PASS) break;
  }
  return out;
}

/** Execute the scout's brief: ONE surgical session per flagged chapter, each scoped to
 *  edit ONLY its chapter and re-stage onto that chapter's dealt card. Never a multi-chapter
 *  rewrite — a single session re-authoring siblings collapses them onto a shared frame, the
 *  very homogenization this is fixing (see the R4 note in doQcWithRepair). */
async function surgicalDetemplate(bookId: string, rewrites: VarietyRewrite[], deps: AutopilotDeps, pass: number): Promise<void> {
  const writeCards = deps.listWriteCards(bookId);
  const pad = (n: number) => String(n).padStart(2, "0");
  for (const rw of rewrites) {
    const n = rw.chapter;
    const card = writeCards.find((c) => chapterNumberFromCard(c) === n);
    const dealt = card ? `\n\n--- DEALT AUTHORING CARD ch${pad(n)} (restage onto THESE dealt shape/venue/opener slots — do NOT collapse onto a shared frame) ---\n${deps.readTask(card)}` : "";
    const task = `PRE-QC VARIETY REPAIR — edit ONLY ch${pad(n)} of ${bookId}. The cross-chapter templating scout (the SAME family the QC sweep REVISEs on) found this chapter shares a structural frame with a sibling; differentiate it NOW so the first QC round is clean.

Edit ONLY state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json. Do NOT edit any other chapter, and do NOT copy another chapter's scenes / names / phrasing into this one (that re-creates the templating). Preserve every number, proper noun, and source anchor, and keep the chapter's teaching + quiz keys intact.

DIFFERENTIATE (${rw.family ?? "templating"}): ${rw.shared ?? "shares a structural frame with a sibling chapter"}
HOW: ${rw.instruction}

After editing, run \`npx tsx src/cli.ts qc-converge ${bookId}\` (must stay DETERMINISTIC-CLEAN) and \`npx tsx src/cli.ts gate-chapter state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json\` (0 blockers).${dealt}`;
    const sid = deps.mkSessionId(`pre-qc-variety-${pass}-ch${n}`);
    const r = await spawnAndLog(bookId, { task, sessionId: sid, cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
    if (!r.ok) deps.log(`[autopilot] pre-QC variety repair ch${n} exited ${r.exitCode}`);
    // A real edit re-authors the chapter → author provenance moves to this session; a no-op
    // repair leaves content identical so the create-once guard throws and the prior author stands.
    try { recordAuthorProvenance(`${bookId}-ch${pad(n)}`, sid, chapterContentHashByNumber(bookId, n)); }
    catch { /* provenance unchanged (no-op repair) — best-effort */ }
  }
}

// ── Phase: qc (headless round + bounded repair loop) ──────────────────────────

/** Returns an outcome to STOP on (halt), or null to RE-LOOP (round passed → status
 *  advances to ready). The repair loop honors qc-diagnose governance + stuck-detect. */
async function doQcWithRepair(bookId: string, maxRepair: number, maxParallel: number, deps: AutopilotDeps, heartbeat: () => boolean = () => true): Promise<AutopilotOutcome | null> {
  let prevSignatures = new Set<string>();
  // Item B — two-round sweep confirmation. The cross-chapter sweep is stochastic, so a single
  // PASS can be a lucky read that auto-publishes a book a re-read would block. On a PASS we require
  // a SECOND independent (fresh) sweep over the now-frozen book to ALSO be clear before declaring
  // convergence. A confirming round is NOT a repair, so it does not spend the repair budget; it is
  // separately capped so a sweep that refuses to corroborate escalates instead of looping.
  let confirmRounds = 0;
  // Resume case: a book whose chapters all already carry a fresh PUBLISHABLE pass but is NOT yet
  // sweep-confirmed (e.g. it reached PASS on a single sweep in a prior process) must run an
  // INDEPENDENT confirming sweep before publish. Forcing a fresh sweep on the first round both
  // opens the round (an all-carry incremental round otherwise re-QCs nothing) and produces that
  // second read. Harmless for a fresh run (round 0 has no prior sweep to carry anyway).
  let forceFreshSweep = deps.anyCarryable(bookId) && !deps.sweepConfirmed(bookId);
  const MAX_CONFIRM_ROUNDS = 2;
  for (let attempt = 0; attempt <= maxRepair; attempt++) {
    // Refresh the run lock at each round boundary: a full QC iteration (initial round + repair
    // rounds, each many 30-min codex sessions) can run for HOURS, past the cross-host stale
    // window. If refresh reports we no longer own the lock (a successor took over), HALT rather
    // than keep two conductors driving the same book.
    if (!heartbeat()) {
      return mkHalt(bookId, "qc", "infra", `lost the run lock for ${bookId} mid-QC (ownership taken over OR heartbeat write failed) — halting to avoid two conductors on the same book.`);
    }
    // Incremental carry drives convergence. A non-incremental round re-rolls EVERY
    // chapter with a FRESH, stochastic bar/confirm read — so a chapter that passed last
    // round gets a new lucky-or-unlucky read this round and the publishable set oscillates,
    // never landing all-green at once. Incremental CARRIES any chapter holding a fresh
    // PUBLISHABLE attestation at its exact bytes (no fresh re-roll), so passes ACCUMULATE.
    // We turn it on whenever a carryable pass EXISTS — not just on repair rounds
    // (attempt>0) — so a resumed run banks its prior passes from round 0. The book-wide
    // sweep + every cross-chapter gate still run over the WHOLE book (createQcOrchestrationRound),
    // so a sibling's repair that newly implicates a carried chapter still demotes it.
    // Tiebreak is ON for EVERY round: it only costs extra reads for BORDERLINE chapters,
    // and the driver's dynamic-wave loop now actually reviews the t2/t3 cards — so a
    // borderline INITIAL round smooths the variance instead of forcing a needless repair.
    const round = await driveQcRound(bookId, maxParallel, deps, { incremental: attempt > 0 || forceFreshSweep || deps.anyCarryable(bookId), tiebreak: true, forceFreshSweep });
    forceFreshSweep = false; // consumed by this round
    if (round.verdict === "ERROR" || !round.roundId) {
      return mkHalt(bookId, "qc", "infra", `could not open/finalize a QC round (${round.note})`);
    }
    if (round.verdict === "INTEGRITY") {
      return mkHalt(bookId, "qc", "integrity", `${round.note} Inspect state/autopilot-logs/${bookId} to find the offending reviewer session, then re-run.`);
    }
    if (round.verdict === "PASS") {
      deps.log(`[autopilot] QC PASS on round ${round.roundId}`);
      // Item B: a single PASS is not enough to auto-publish — require a SECOND independent clear
      // sweep over the identical (now-frozen) book. If not yet confirmed, run one more round whose
      // sweep is forced FRESH (no carry) so it is a genuine corroboration, not a copy.
      if (deps.sweepConfirmed(bookId)) return null; // confirmed → ready
      if (confirmRounds >= MAX_CONFIRM_ROUNDS) {
        return mkHalt(bookId, "qc", "content", `QC reads PASS but an independent confirming sweep would not corroborate after ${MAX_CONFIRM_ROUNDS} attempts — the stochastic cross-chapter sweep keeps disagreeing on frozen content. Escalate / inspect: npx tsx src/cli.ts qc-diagnose ${bookId} --round ${round.roundId}`);
      }
      confirmRounds++;
      forceFreshSweep = true; // next round: independent fresh sweep over the frozen book
      attempt--; // a confirming round is not a repair — do not consume the repair budget
      deps.log(`[autopilot] QC PASS on ${round.roundId}; running an independent confirming sweep (item B ${confirmRounds}/${MAX_CONFIRM_ROUNDS})`);
      continue;
    }
    if (round.verdict === "INCOMPLETE") {
      return mkHalt(bookId, "qc", "infra", `QC round ${round.roundId} INCOMPLETE (reviewer submissions still missing after a narrow retry) — a reviewer agent likely failed. Inspect: npx tsx src/cli.ts qc-diagnose ${bookId} --round ${round.roundId}`);
    }
    // REVISE → repair, but never past the bound and never without diagnose.
    if (attempt === maxRepair) {
      const drivers = summarizeRoundDrivers(bookId, round.roundId);
      return mkHalt(bookId, "qc", "content", `QC still REVISE after ${maxRepair} repair rounds — escalate. Last round ${round.roundId} unresolved: ${drivers || "see qc-diagnose"}. (If these are sweep/templating findings it is likely cross-chapter VARIETY, not a source limit; if confirmRead/factual, check source grounding.)`);
    }
    // A repair is about to change content, which resets sweepTwoRoundConfirmed's notion of "the
    // current bytes" — so the item-B confirm budget restarts too. Without this, a confirming round
    // that legitimately CAUGHT a flip (→ repair) would burn the cap and a later genuinely-converged
    // version could be denied its full 2-read confirmation (a premature, false HALT).
    confirmRounds = 0;
    const diagnose = await deps.runVerb(["qc-diagnose", bookId, "--round", round.roundId]);
    deps.log(`[autopilot] qc-diagnose (round ${round.roundId}):\n${diagnose.stdout.slice(0, 600)}`);
    // Defensive: the governance (major-disposition) and no-progress decisions below read ONLY
    // diagnose.stdout. If qc-diagnose itself FAILED (threw → exit≠0, error on stderr, empty
    // stdout), that empty output would silently read as "no majors / progress made" and let the
    // loop spawn a repair on an undiagnosable round. Treat a failed diagnose as infra, not a
    // green light. (In the normal flow the round was just finalized in-process, so this is a
    // backstop, not the common path.)
    if (diagnose.code !== 0) {
      return mkHalt(bookId, "qc", "infra", `qc-diagnose errored (exit ${diagnose.code}) for round ${round.roundId} — cannot make a governance/progress decision on its output: ${(diagnose.stderr || diagnose.stdout).slice(0, 300)}`);
    }
    // A blocking major surfaced at QC. The gate-phase major convergence normally
    // prevents this (doGate fixes every blocking major before QC); a sweep-repair can
    // still re-introduce one. The autopilot is FULLY AUTONOMOUS — it FIXES the major
    // (re-author), it never halts for a human waive/fix decision. The blocking majors
    // are appended to the repair prompt below so this round's fan-out fixes them, and
    // the no-progress halt backstops a genuinely un-fixable (stuck) major. ADVISORY
    // majors never reach here (critics/majorPolicy.ts excludes them from the set).
    if (/major-disposition/.test(diagnose.stdout)) {
      deps.log(`[autopilot] QC surfaced a blocking major; auto-repairing in this round's fan-out (no governance halt).`);
    }
    const sigs = findingSignatures(diagnose.stdout);
    if (attempt > 0 && noProgress(prevSignatures, sigs)) {
      return mkHalt(bookId, "qc", "progress", `repair made NO progress (same findings survived a content edit) — escalate. Round: ${round.roundId}`);
    }
    prevSignatures = sigs;

    // Spawn ONE repair writer with the generated repair prompt, then converge
    // deterministically before the next (fresh) round — the treadmill-killer.
    const repairPromptPath = resolve(PIPELINE_DIR, "state", "qc-orchestrator", bookId, round.roundId, "repair-prompt.md");
    // The DEALT authoring card gives the per-slot HOW — the distinct shape/venue/opener slots the
    // deal computed; re-attaching it per chapter lets the writer restage onto the variety already
    // designed in, instead of collapsing onto a new shared frame.
    const flagged = flaggedChapterNumbers(bookId, round.roundId);
    // Append any blocking majors so this round's repair fan-out fixes them alongside
    // the sweep findings (the governance halt that used to stop here is gone — see above).
    const blockingMajors = deps.blockingMajors(bookId);
    const majorAddendum = blockingMajors.length
      ? `\n\n--- BLOCKING MAJORS — fix these too (advisory majors excluded; verify with \`major-status ${bookId}\` → 0 unresolved non-advisory) ---\n${blockingMajors.map((m) => `- [${m.checkId}] ${m.scope}: ${m.message}${m.evidence ? ` — "${m.evidence.slice(0, 140)}"` : ""}`).join("\n")}`
      : "";
    const wholePrompt = (existsSync(repairPromptPath)
      ? deps.readTask(repairPromptPath)
      : `Repair the QC findings for bookId ${bookId} round ${round.roundId} in chapter content, then run qc-converge ${bookId} until CLEAN.`) + majorAddendum;
    const writeCards = deps.listWriteCards(bookId);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dealtCardFor = (n: number): string => {
      const c = writeCards.find((c) => chapterNumberFromCard(c) === n);
      return c ? `\n\n--- DEALT AUTHORING CARD ch${pad(n)} (restage onto THESE dealt shape/venue/opener slots — do NOT collapse the scenes onto a new shared frame) ---\n${deps.readTask(c)}` : "";
    };
    // R4 — SURGICAL per-chapter repair. A SINGLE batch session re-authoring several chapters in one
    // context collapses their scenes onto a shared frame (the documented homogenization that FEEDS
    // the templating the sweep then flags). Run ONE session PER flagged chapter, each scoped to edit
    // ONLY its chapter — so no session ever re-authors siblings together. Cross-chapter residue (an
    // F1 collision, a BP* templating echo) is caught reactively by the qc-converge loop (blockers)
    // and the R3 major scan below. Sequential = no two sessions race a shared cross-chapter signal.
    // Fan out an EDIT session only for chapters with actionable content findings (REVISE/CORRUPTION).
    // NEEDS_MORE_QC chapters are "[re-QC only]" — flagged for the collateral guard but not edited.
    // No matrix / no editable chapter → ONE session over the whole prompt (unchanged fallback).
    const editable = repairTargetChapterNumbers(bookId, round.roundId);
    const repairTargets: Array<number | null> = editable.size ? [...editable].sort((a, b) => a - b) : [null];
    deps.log(`[autopilot] QC repair attempt ${attempt + 1}/${maxRepair} on round ${round.roundId}${editable.size ? ` — ${editable.size} surgical chapter session(s)` : ""}`);
    // Collateral-edit guard: snapshot the GREEN (non-flagged) chapters' hashes around the WHOLE
    // fan-out. A repair that edits a chapter carrying a passing review invalidates its attestation.
    const preHashes = deps.chapterHashes(bookId);
    // R3 — snapshot the FULL major set BEFORE the repair, so the post-repair scan can tell a
    // repair-INTRODUCED major (A13/C23/BP28-31 — all invisible to qc-converge) from a pre-existing one.
    const preMajors = deps.majorFindingKeys(bookId);
    for (const n of repairTargets) {
      const task = n == null
        ? wholePrompt
        : `REPAIR SCOPE: this session repairs ONLY ch${pad(n)}. Edit ONLY state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json — do NOT edit any other chapter (a sibling session handles those) and do NOT copy another chapter's scenes, names, or phrasing (that re-creates the templating the sweep flags). Fix every finding scoped to ch${pad(n)} below; ignore findings scoped to other chapters.\n\n${wholePrompt}${dealtCardFor(n)}`;
      const sid = n == null ? `qc-repair-${attempt + 1}` : `qc-repair-${attempt + 1}-ch${n}`;
      const repairSessionId = deps.mkSessionId(sid);
      const rr = await spawnAndLog(bookId, { task, sessionId: repairSessionId, cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
      if (!rr.ok) deps.log(`[autopilot] repair session ${sid} exited ${rr.exitCode}`);
      // A repair that actually CHANGES the chapter re-authors it → author provenance moves
      // to this session (content-bound transition). A no-op repair leaves content identical,
      // so the create-once guard throws and the prior author is preserved (best-effort).
      if (n != null) {
        try { recordAuthorProvenance(`${bookId}-ch${String(n).padStart(2, "0")}`, repairSessionId, chapterContentHashByNumber(bookId, n)); }
        catch (e) { deps.log(`[autopilot] repair ch${n}: author provenance unchanged (${(e as Error).message.split(".")[0]})`); }
      }
    }
    const postHashes = deps.chapterHashes(bookId);
    const collateral = Object.keys(postHashes).filter((n) => !flagged.has(Number(n)) && preHashes[n] !== undefined && preHashes[n] !== postHashes[n]);
    // Only warn when we actually know the flagged set (a found matrix); an empty `flagged`
    // means the matrix wasn't readable, and we can't distinguish collateral from intended.
    if (flagged.size && collateral.length) deps.log(`[autopilot] WARNING: repair collaterally edited non-flagged chapter(s) ${collateral.map((n) => `ch${n}`).join(", ")} — they carried a passing review and will be re-reviewed next round (possible regression). Each repair session is scoped to a single flagged chapter.`);
    // Converge deterministic gates so the NEXT formal round won't bounce on a nit.
    for (let c = 0; c < maxRepair; c++) {
      const cv = await deps.runVerb(["qc-converge", bookId]);
      if (cv.code === 0) break;
      if (cv.code >= 2) return mkHalt(bookId, "qc", "infra", `qc-converge errored (exit ${cv.code}) during repair convergence — not a content problem; inspect: ${(cv.stderr || cv.stdout).slice(0, 300)}`);
      const cr = await spawnAndLog(bookId, { task: `Fix the remaining deterministic findings for ${bookId}, then qc-converge until CLEAN.\n\n${cv.stdout}`, sessionId: deps.mkSessionId(`qc-converge-fix-${attempt + 1}-${c}`), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
      if (!cr.ok) break;
    }
    // R3 — post-repair regression scan. qc-converge gates on BLOCKERS only, so a repair can be
    // DETERMINISTIC-CLEAN yet have introduced a MAJOR (A13 commas / C23 dup protagonist / BP28-31
    // templating) the next round's sweep/bar would flag → another round. Diff the full major set
    // post-repair vs pre-repair and fix any NEW major in place, bounded, before spending a fresh
    // round. The outer maxRepair loop + noProgress halt remain the global anti-spin backstop.
    for (let rc = 0; rc < REGRESSION_REDISPATCH_CAP; rc++) {
      const newMajors = [...deps.majorFindingKeys(bookId)].filter((k) => !preMajors.has(k));
      if (!newMajors.length) break;
      deps.log(`[autopilot] WARNING: the repair introduced ${newMajors.length} NEW major(s) invisible to qc-converge: ${newMajors.join("; ")} — re-dispatching a targeted fix (${rc + 1}/${REGRESSION_REDISPATCH_CAP}).`);
      const fixTask = `Your previous repair of ${bookId} introduced NEW major findings that \`qc-converge\` does NOT catch (they are major-tier, not blockers — templating, commas, or a duplicate protagonist). Fix EACH below by editing ONLY chapter CONTENT under state/chapters/, preserving every number / proper noun / source anchor, then re-run \`gate-chapter\` and \`book-gate\`. Do NOT introduce any further templating / banned-name / comma defect. Edit each named chapter IN ISOLATION — do NOT copy one chapter's scenes, names, or phrasing into another; that re-creates the cross-chapter templating the sweep flags.\n\nNEW majors (key = scope:chapter:catalogId:location):\n${newMajors.map((k) => `- ${k}`).join("\n")}`;
      const rr = await spawnAndLog(bookId, { task: fixTask, sessionId: deps.mkSessionId(`qc-regression-fix-${attempt + 1}-${rc}`), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
      if (!rr.ok) { deps.log(`[autopilot] regression-fix session exited ${rr.exitCode}`); break; }
      // A regression fix is a content edit → re-converge the deterministic gates before re-scanning.
      const cv = await deps.runVerb(["qc-converge", bookId]);
      if (cv.code >= 2) return mkHalt(bookId, "qc", "infra", `qc-converge errored (exit ${cv.code}) during regression-fix convergence — inspect: ${(cv.stderr || cv.stdout).slice(0, 300)}`);
    }
    // Provenance hygiene: a CORRUPTION-tier repair can damage a chapter's authoring.sourceAnchors
    // — mislabel its schemaVersion (willpower ch5) or GUT the wrapper fields while effectiveAnchors
    // survives (tiny-habits ch3) → PPKG.authoring_provenance_missing at publish. normalizeChapterProvenance
    // re-stamps / re-derives from the chapter's own retained real data, so artifacts stay publish-clean
    // between here and promote (publish-after-qc self-heals too, as a backstop). Content is untouched
    // (authoring is excluded from the content hash), so this never stales an attestation.
    const provNorm = normalizeChapterProvenance(bookId);
    if (provNorm.length) deps.log(`[autopilot] normalized source-anchor provenance (repair drift) on ${provNorm.map((p) => p.kind === "reconstruct" ? `ch${p.chapterNumber} (reconstructed from effectiveAnchors)` : `ch${p.chapterNumber} (${p.from}→canonical)`).join(", ")}`);
    // loop → drive a FRESH round (a repair invalidates the prior one)
  }
  return null;
}

type QcRoundResult = { roundId: string | null; verdict: "PASS" | "REVISE" | "INCOMPLETE" | "INTEGRITY" | "ERROR"; note: string };

/** Drive ONE headless QC round via the SHARED qc round-driver (same sequence qc-auto
 *  runs), injecting runVerb (CLI subprocess) step adapters so the strict-env
 *  invariants stay FORCE-SET on every gate subprocess (the PR1 fail-closed fix), plus
 *  a fenced codex reviewer spawner. Maps the driver's structured outcome → QcRoundResult.
 *  `incremental` (repair rounds) re-reviews only changed chapters; `tiebreak` gathers
 *  extra bar reads for borderline chapters. */
async function driveQcRound(bookId: string, maxParallel: number, deps: AutopilotDeps, opts: { incremental: boolean; tiebreak: boolean; forceFreshSweep?: boolean }): Promise<QcRoundResult> {
  // Open the round + write first-wave task cards (also runs the deterministic preflight).
  const createArgs = ["qc-orchestrate", bookId, "--create"];
  if (opts.incremental) createArgs.push("--incremental");
  if (opts.tiebreak) createArgs.push("--tiebreak");
  // Item B confirming round: force a FRESH sweep (no carry-forward) so the second clear read is
  // a genuinely independent corroboration, not a copy of the prior PASS.
  if (opts.forceFreshSweep) createArgs.push("--no-sweep-carry");
  const create = await deps.runVerb(createArgs);
  const roundId = parseRoundId(create.stdout) ?? parseRoundId(create.stderr);
  if (!roundId) return { roundId: null, verdict: "ERROR", note: `--create produced no round id (preflight may have blocked): ${(create.stderr || create.stdout).slice(0, 300)}` };
  // A nonzero --create that still printed a round id means "created-with-errors" —
  // require exit 0 before spending reviewer sessions on a malformed round.
  if (create.code !== 0) return { roundId, verdict: "ERROR", note: `--create exited ${create.code} (created-with-errors): ${(create.stderr || create.stdout).slice(0, 300)}` };
  deps.log(`[autopilot] QC round ${roundId} opened${opts.incremental ? " (incremental)" : ""}${opts.tiebreak ? " (tiebreak)" : ""}`);

  // A reviewer wave = fence chapter hashes around a parallel codex spawn (the
  // read-only contract is enforced by detection; the PR2 broker in spawnReviewers
  // makes it prevention). Any chapter change across the wave voids the round.
  const spawnFenced = async (cards: string[], _wave: ReviewerWave): Promise<ReviewerWaveResult> => {
    if (!cards.length) return {};
    // Token preflight: the broker records each reviewer via `qc-submit --token <t>`,
    // parsing per-role tokens from REVIEW-PACKET.md. If a card's role has no token there,
    // the reviewer can't be recorded — fail FAST as infra (don't spend codex sessions on a
    // round we couldn't finalize anyway).
    const tokens = parseRoundTokens(deps.readReviewPacket(bookId, roundId));
    const missingTok = [...new Set(cards.map((c) => brokerCardTarget(c).role))].filter((role) => !tokens[role]);
    if (missingTok.length) return { infraError: `REVIEW-PACKET (round ${roundId}) has no plaintext token for role(s): ${missingTok.join(", ")} — can't broker these reviewers.` };
    const before = deps.chapterHashes(bookId);
    await spawnReviewers(bookId, roundId, cards, maxParallel, deps);
    const after = deps.chapterHashes(bookId);
    const changed = Object.keys(before).filter((k) => after[k] !== before[k]);
    const appeared = Object.keys(after).filter((k) => !(k in before));
    if (changed.length || appeared.length) {
      const which = [...changed, ...appeared.map((a) => `+${a}`)].join(", ");
      return { integrityViolation: `reviewer(s) MUTATED chapter content during round ${roundId} (chapters: ${which}) — reviewers are read-only; this round is void.` };
    }
    return {};
  };

  const result = await driveQcRoundCore({
    spawnReviewers: spawnFenced,
    firstWaveCards: () => deps.listTaskCards(bookId, roundId),
    // The review work GENERATED mid-round: confirm cards + bar-tiebreak t2/t3 cards.
    pendingReviewCards: () => [...deps.listTaskCards(bookId, roundId, "confirm"), ...deps.listTaskCards(bookId, roundId, "bar-tiebreak")],
    countSubmissions: () => deps.listTaskCards(bookId, roundId).filter((c) => deps.submissionPresent(bookId, roundId, c)).length,
    submissionPresent: (card) => deps.submissionPresent(bookId, roundId, card),
    collect: async () => { const r = await deps.runVerb(["qc-orchestrate", bookId, "--collect", "--round", roundId]); return { ok: r.code === 0, errors: r.code === 0 ? [] : [(r.stderr || r.stdout).slice(0, 200)] }; },
    generateConfirmCandidates: async () => { const r = await deps.runVerb(["qc-orchestrate", bookId, "--confirm-candidates", "--round", roundId]); return { ok: r.code === 0, errors: r.code === 0 ? [] : [(r.stderr || r.stdout).slice(0, 200)] }; },
    // finalize STAMPS each attestation's reviewerSessionId from CHAPTERFLOW_SESSION_ID, and the
    // provenance hardening makes a missing id THROW → the write is skipped (attestationsWritten:0)
    // → the book can never satisfy promote's fresh-PUBLISHABLE-attestation gate → no convergence.
    // The conductor runs finalize in-process with no session id, so give it a DISTINCT finalizer id
    // (≠ every author/reviewer id by construction) so author≠reviewer still holds AND the write lands.
    finalize: async () => { const r = await deps.runVerb(["qc-orchestrate", bookId, "--finalize", "--round", roundId], { CHAPTERFLOW_SESSION_ID: deps.mkSessionId("finalize") }); return parseFinalizeResult(r.stdout, r.code); },
    ledgerOpenCount: () => 0,
    recordMetrics: () => { /* autopilot run-telemetry deferred to the eval layer; qc-auto records metrics */ },
    verifyFullBook: async () => (await deps.runVerb(["qc-status", bookId])).code === 0,
    log: deps.log,
  }, { isSubset: false, narrowRetryOnIncomplete: true });

  switch (result.outcome) {
    case "PASS":
    case "PASS_SUBSET":
      return { roundId, verdict: "PASS", note: "" };
    case "INTEGRITY":
      return { roundId, verdict: "INTEGRITY", note: result.reason ?? "a reviewer mutated chapter content" };
    case "QC_STATUS_FAIL":
      return { roundId, verdict: "INCOMPLETE", note: "qc-status did not confirm all chapters fresh + PUBLISHABLE after finalize" };
    case "INCOMPLETE":
      return { roundId, verdict: "INCOMPLETE", note: result.reason ?? "missing/stale evidence" };
    case "INFRA":
      return { roundId, verdict: "ERROR", note: result.reason ?? "infra error during the QC round" };
    case "REPAIR":
      return { roundId, verdict: "REVISE", note: "" };
  }
  return { roundId, verdict: "INCOMPLETE", note: `unrecognized driver outcome: ${result.outcome}` };
}

/** Parse `qc-orchestrate --finalize` JSON stdout into a FinalizeQcRoundResult, falling back to
 *  exit-code inference (0 PASS / 1 REPAIR / 3 INCOMPLETE) when stdout isn't the full JSON.
 *
 *  H2 hazard: exit 1 is OVERLOADED — finalize exits 1 for a legitimate "repair required" AND an
 *  uncaught throw (a crash: corrupt round.json, fs failure) also exits 1. A crash must NOT be
 *  misclassified as REPAIR (which would dispatch a content-repair writer at an infra fault). The
 *  distinguisher: a real verdict prints to STDOUT (a result line / JSON); a crash prints its error
 *  to STDERR and leaves stdout EMPTY. So exit-1-with-empty-stdout = crash → infra; exit-1-with
 *  -output = repair. Exit 0 = PASS, exit 3 = INCOMPLETE (collect-incomplete / STALE_ROUND) are
 *  unambiguous and inferred directly. A complete or incomplete-flagged JSON payload is honored
 *  by the try branch regardless of code. */
function parseFinalizeResult(stdout: string, code: number): FinalizeQcRoundResult {
  try {
    const j = JSON.parse(stdout) as Partial<FinalizeQcRoundResult>;
    if (j && typeof j.allPublishable === "boolean" && Array.isArray(j.chapters)) return j as FinalizeQcRoundResult;
    // collect-incomplete prints a partial `{ ok:false, incomplete:true }` (no allPublishable/chapters).
    if (j && j.incomplete === true) {
      return { ok: false, allPublishable: false, repairRequired: false, incomplete: true,
        evidenceMatrixPath: "", repairBriefPath: "", repairPromptPath: "", attestationsWritten: 0, chapters: [], errors: [] } as unknown as FinalizeQcRoundResult;
    }
  } catch { /* not JSON — fall through to exit-code inference */ }
  const hasOutput = stdout.trim().length > 0;
  // exit 1 + EMPTY stdout = a crash (threw before printing) → infra (repairRequired:false). exit 1
  // WITH output = a real repair verdict. exit 0 = PASS. exit 3 = INCOMPLETE. Any other code = infra.
  return {
    ok: code === 0,
    allPublishable: code === 0,
    repairRequired: code === 1 && hasOutput,
    incomplete: code === 3,
    evidenceMatrixPath: "", repairBriefPath: "", repairPromptPath: "",
    attestationsWritten: 0, chapters: [],
    errors: (code === 1 && !hasOutput) ? [`finalize exited 1 with no stdout — treated as an infra crash, not a repair verdict`] : [],
  } as unknown as FinalizeQcRoundResult;
}

// ── Submission broker (PR2 C2): reviewers run READ-ONLY and can neither edit a
//    chapter nor write a submission. Each emits its submission JSON on stdout; the
//    conductor records it via `qc-submit --file` under THAT reviewer's distinct
//    session id, so finalize's author≠reviewer check still holds and submitQcArtifact
//    re-validates the brokered payload (schema + cross-field). Prevention on top of
//    the hash-fence's detection. ──────────────────────────────────────────────────

function isParseableObject(s: string): boolean {
  try { const v = JSON.parse(s); return !!v && typeof v === "object"; } catch { return false; }
}

function lastBalancedObject(text: string): string | null {
  let depth = 0, start = -1, last: string | null = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") { depth--; if (depth === 0 && start >= 0) { last = text.slice(start, i + 1); start = -1; } }
  }
  return last;
}

/** Extract the submission JSON a read-only reviewer printed: the LAST ```json fenced
 *  block (the prompt asks for exactly one), else the last balanced {...}. null if none parses. */
export function extractSubmissionJson(text: string): string | null {
  if (!text) return null;
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (let i = fences.length - 1; i >= 0; i--) {
    const body = fences[i][1].trim();
    if (isParseableObject(body)) return body;
  }
  const obj = lastBalancedObject(text);
  return obj && isParseableObject(obj) ? obj : null;
}

/** Parse role→plaintext-token from a REVIEW-PACKET.md (its submit commands embed the
 *  live round tokens: `… --role <role> [--variant <v>] --token <token> --file …`). */
export function parseRoundTokens(reviewPacket: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const m of reviewPacket.matchAll(/--role\s+(\S+)\s+(?:--variant\s+\S+\s+)?--token\s+(\S+)/g)) {
    if (!tokens[m[1]]) tokens[m[1]] = m[2];
  }
  return tokens;
}

/** A brokered card's QC role (+ bar self-consistency variant t2/t3 for tiebreak cards). */
export function brokerCardTarget(card: string): { role: string; variant?: "t2" | "t3" } {
  const p = card.replace(/\\/g, "/").toLowerCase();
  const vm = p.match(/-(t[23])\.md$/);
  if (vm) return { role: "bar", variant: vm[1] as "t2" | "t3" };
  if (p.includes("bar-tiebreak") || p.includes("/bar/")) return { role: "bar" };
  if (p.includes("/confirm/")) return { role: "confirm" };
  if (p.includes("keya")) return { role: "keyA" };
  if (p.includes("keyb")) return { role: "keyB" };
  if (p.includes("major")) return { role: "major" };
  if (p.includes("sweep")) return { role: "sweep" };
  return { role: roleFromCard(card).role };
}

/** The structured outcome of brokering ONE reviewer — NOT the bare agent result. Every
 *  failure mode is distinguishable (agent crash / no parseable JSON / missing token /
 *  qc-submit rejection) so a brokered-submit failure is diagnosable from the logs instead
 *  of surfacing only later as an opaque INCOMPLETE round. */
export type BrokerResult = {
  card: string;
  role: string;
  sessionId: string;
  agentOk: boolean;       // the read-only codex session exited 0
  extractionOk: boolean;  // a submission JSON was parsed out of its stdout
  submissionOk: boolean;  // qc-submit recorded it under the reviewer's session id
  error?: string;         // why it didn't submit (missing-token errors are infra, not content)
};

/** Assemble the SELF-CONTAINED reviewer prompt: the task card + the role's authoritative
 *  JSON Schema + a prefilled submission skeleton + the blind-workspace input list, so the
 *  live reviewer needs no REVIEW-PACKET archaeology and fills only its judgment fields. */
function buildReviewerTask(cardText: string, roundId: string, role: string, skeleton: string | null, inputs: string[]): string {
  const schema = submissionJsonSchemaForRole(role);
  const parts = [cardText, "\n---", `You are a fresh QC reviewer subagent (round ${roundId}) in a READ-ONLY sandbox.`];
  if (inputs.length) parts.push(`Your authorized inputs are the files in your CURRENT WORKING DIRECTORY: ${inputs.join(", ")}. Read ONLY these — do not open any other path.`);
  if (schema) parts.push(`Your submission MUST validate against this JSON Schema (schemaVersion ${schema.schemaVersion}):\n\`\`\`json\n${JSON.stringify(schema.schema)}\n\`\`\``);
  if (skeleton) parts.push(`Fill ONLY the judgment fields of this prefilled skeleton; keep every prefilled structural field (ids, hashes, counts) UNCHANGED:\n\`\`\`json\n${skeleton}\n\`\`\``);
  parts.push("Do ONLY this card's review. Output ONLY the completed submission JSON for this card as your FINAL message — a single ```json fenced block, nothing else. Do NOT run qc-submit. Do NOT edit any file.");
  return parts.join("\n");
}

/** Spawn ONE read-only reviewer and broker its submission. Exported for tests. */
export async function brokerReviewer(bookId: string, roundId: string, card: string, tokens: Record<string, string>, deps: AutopilotDeps): Promise<BrokerResult> {
  const label = roleLabelFromCard(card);
  const { role, variant } = brokerCardTarget(card);
  // Distinct per-spawn id — qc-submit runs under THIS id so reviewer≠author holds.
  const sessionId = deps.mkSessionId(`qc-${label}`);
  const base: BrokerResult = { card, role, sessionId, agentOk: false, extractionOk: false, submissionOk: false };
  const token = tokens[role];
  if (!token) { deps.log(`[autopilot] reviewer ${label}: no plaintext ${role} token in REVIEW-PACKET — skipping submit`); return { ...base, error: `no ${role} token in REVIEW-PACKET` }; }
  // Per-reviewer BLIND workspace (constructive isolation) + a self-contained prompt.
  const ws = deps.reviewerWorkspace(bookId, roundId, card, sessionId);
  const baseTask = buildReviewerTask(deps.readTask(card), roundId, role, deps.reviewerSkeleton(bookId, roundId, card), ws.inputs);

  /** One reviewer attempt: spawn (read-only, blind cwd) → extract JSON → qc-submit under
   *  THIS session id (so reviewer≠author holds). Returns the extracted json (for a
   *  corrective retry) + a rejection reason when it didn't record. */
  // The cross-chapter sweep is the noisiest, most stochastic reviewer (its one book-wide read
  // gates the whole book). Give it a higher-effort, more stable read so a single over-eager
  // pass can't emit a flickering blocking finding. Other roles keep the codex default.
  const reasoningEffort: "high" | undefined = role === "sweep" ? "high" : undefined;
  const attempt = async (taskText: string, sid: string, fileLabel: string): Promise<{ agentOk: boolean; json: string | null; submitOk: boolean; rejection?: string }> => {
    const r = await spawnAndLog(bookId, { task: taskText, sessionId: sid, cwd: ws.cwd, sandbox: "read-only" as CodexSandbox, skipGitRepoCheck: true, reasoningEffort }, deps);
    if (!r.ok) { deps.log(`[autopilot] reviewer ${label} exited ${r.exitCode}`); return { agentOk: false, json: null, submitOk: false, rejection: `agent exited ${r.exitCode}` }; }
    // Extract from the FULL stdout first: spawnCodexAgent's finalMessage is only the LAST
    // non-empty line (the closing ``` of a fenced block), so `finalMessage || stdout` would
    // feed extraction just that fragment and silently drop EVERY multiline submission.
    const json = extractSubmissionJson(r.stdout) ?? extractSubmissionJson(r.finalMessage);
    if (!json) { deps.log(`[autopilot] reviewer ${label}: no parseable submission JSON in output`); return { agentOk: true, json: null, submitOk: false, rejection: "no parseable submission JSON in agent output" }; }
    let file: string;
    try { file = deps.writeTempSubmission(bookId, roundId, fileLabel, json); }
    catch (err) { return { agentOk: true, json, submitOk: false, rejection: `temp write failed: ${(err as Error)?.message ?? String(err)}` }; }
    const submitArgs = ["qc-submit", bookId, "--round", roundId, "--role", role, "--token", token, "--file", file];
    if (variant) submitArgs.push("--variant", variant);
    const submit = await deps.runVerb(submitArgs, { CHAPTERFLOW_SESSION_ID: sid });
    if (submit.code !== 0) { const reason = (submit.stderr || submit.stdout).slice(0, 300); deps.log(`[autopilot] qc-submit (${label}) failed: ${reason}`); return { agentOk: true, json, submitOk: false, rejection: `qc-submit exited ${submit.code}: ${reason}` }; }
    return { agentOk: true, json, submitOk: true };
  };

  try {
    const a1 = await attempt(baseTask, sessionId, label);
    if (a1.submitOk) return { ...base, agentOk: true, extractionOk: true, submissionOk: true };
    // Corrective retry — ONLY when the agent produced JSON but qc-submit REJECTED it (a
    // fixable validation error, e.g. a sweep finding missing `chapters`). Feeding the exact
    // rejection + the rejected JSON back lets the reviewer self-correct instead of the
    // narrow-retry re-running the identical prompt and reproducing the same error. One
    // bounded attempt; a fresh session id preserves reviewer independence.
    if (a1.json) {
      const sid2 = deps.mkSessionId(`qc-${label}-fix`);
      const fixTask = `${baseTask}\n\n--- YOUR PREVIOUS SUBMISSION WAS REJECTED ---\nqc-submit rejected it:\n${a1.rejection}\nYour previous submission was:\n\`\`\`json\n${a1.json}\n\`\`\`\nFix EXACTLY the rejected problem(s) and re-emit the COMPLETE corrected submission JSON as your FINAL message — a single \`\`\`json block. Change nothing else.`;
      deps.log(`[autopilot] reviewer ${label}: qc-submit rejected — one corrective retry with the validation error fed back`);
      const a2 = await attempt(fixTask, sid2, `${label}-fix`);
      if (a2.submitOk) return { ...base, sessionId: sid2, agentOk: true, extractionOk: true, submissionOk: true };
      return { ...base, agentOk: true, extractionOk: true, error: a2.rejection ?? a1.rejection };
    }
    // Agent crashed or produced no JSON — not correctable by feeding an error back.
    return { ...base, agentOk: a1.agentOk, extractionOk: false, error: a1.rejection };
  } finally {
    ws.cleanup(); // always tear down the blind workspace, on every return/throw path
  }
}

/** Broker a whole wave of read-only reviewers. Returns the structured per-card outcomes
 *  (the driver inspects them for a fatal MISSING-TOKEN, which is infra, not content).
 *  Exported for tests. */
export async function spawnReviewers(bookId: string, roundId: string, cards: string[], maxParallel: number, deps: AutopilotDeps): Promise<BrokerResult[]> {
  deps.log(`[autopilot] QC: dispatching ${cards.length} read-only reviewer session(s), brokered (parallel ≤${maxParallel})`);
  const tokens = parseRoundTokens(deps.readReviewPacket(bookId, roundId));
  const results = await mapWithConcurrency(cards, maxParallel, (card) => brokerReviewer(bookId, roundId, card, tokens, deps));
  // Durably record each broker outcome (a spawn rejection that THREW never reaches here —
  // spawnAndLog already logged it at the session level before rethrowing). Best-effort: a
  // logging failure must never sink a completed wave.
  for (const b of results) { try { deps.logBroker(bookId, b); } catch { /* best-effort */ } }
  const failed = results.filter((b) => !b.submissionOk);
  if (failed.length) deps.log(`[autopilot] QC: ${failed.length}/${results.length} reviewer(s) did not record a submission — ${failed.map((b) => `${roleLabelFromCard(b.card)}:${b.error ?? "?"}`).join("; ")}`);
  return results;
}

// ── Phase: ready-to-publish (gated) ──────────────────────────────────────────

async function handleReady(bookId: string, status: BookStatus, autoPublish: boolean, deps: AutopilotDeps): Promise<AutopilotOutcome> {
  // Find the round that produced the PUBLISHABLE attestations (most recent matrix).
  const roundId = deps.latestRoundId(bookId) ?? undefined;
  if (!autoPublish) {
    const cmd = roundId
      ? `npx tsx src/cli.ts publish-after-qc "${bookId}" --round ${roundId} --commit --push`
      : `npx tsx src/cli.ts publish "${bookId}"`;
    return {
      status: "ready",
      bookId,
      roundId,
      message: `READY TO PUBLISH — all ${status.writtenChapters} chapters gated + QC PUBLISHABLE. Review, then ship:\n  ${cmd}`,
    };
  }
  if (!roundId) return mkHalt(bookId, "ready", "infra", "auto-publish requested but no passed round id found; publish manually");
  // Auto-publish = the FULL deterministic promote gate (all 11 checks inside
  // publish-after-qc) + commit + push to main. The gate still BLOCKS: any failing check
  // makes publish-after-qc exit nonzero and we HALT below — auto-publish removes the human
  // go-ahead, never a gate. This commits the package to main; it does NOT deploy to live
  // users (that stays a separate manual step), so a bad publish is reversible via git
  // before the next deploy.
  // publish-after-qc re-finalizes the round in-process with attest=true. Like the conductor's own
  // qc-orchestrate --finalize, that write needs a CHAPTERFLOW_SESSION_ID or it skips the attestation
  // and surfaces an error → ok:false → this HALT (the I1 wedge, single-round-converge variant). Pass a
  // DISTINCT finalizer id so the re-attest lands and author≠reviewer still holds. (publish-after-qc
  // also self-supplies one if none is inherited — this makes the conductor's intent explicit.)
  const pub = await deps.runVerb(
    ["publish-after-qc", bookId, "--round", roundId, "--commit", "--push"],
    { CHAPTERFLOW_SESSION_ID: deps.mkSessionId("publish-finalize") },
  );
  if (pub.code !== 0) return mkHalt(bookId, "ready", "infra", `publish-after-qc failed (exit ${pub.code}): ${(pub.stderr || pub.stdout).slice(0, 300)}`);

  // End-to-end hygiene: the book is now PUBLISHED (package committed + pushed). The web app serves
  // ONLY the committed package, so sweep ALL of this book's untracked working state — chapters, QC
  // attestations, plans, provenance, the sidecar cache, and any stale _blocked report (package-only,
  // the owner's chosen post-publish policy). A walk-away run then leaves just the committed package.
  // prune-book-state is safe-by-construction (untracked-only, only on a COMMITTED package, book-scoped).
  // Best-effort: a prune failure must NEVER undo a successful publish — the book is already on main.
  try {
    const plan = pruneBookStatePlan(bookId, "all");
    if (plan.status === "ok" && plan.remove.length) {
      const r = applyPruneBookState(plan);
      deps.log(`[autopilot] post-publish prune (package-only): removed ${r.removed} untracked file(s), freed ~${(r.bytes / (1024 * 1024)).toFixed(1)} MB — only the committed package remains`);
    } else if (plan.status === "git-error") {
      deps.log(`[autopilot] post-publish prune skipped: ${plan.message}`);
    }
  } catch (e) {
    deps.log(`[autopilot] post-publish prune skipped (${(e as Error).message.split("\n")[0]})`);
  }

  return {
    status: "published",
    bookId,
    roundId,
    message: `PUBLISHED — promote gate passed; package committed + pushed to main (round ${roundId}). NOT live until the separate manual deploy.`,
  };
}

// ── --plan dry-run (cost preview; takes NO action) ────────────────────────────

function planOnly(bookId: string, deps: AutopilotDeps, regen = false): AutopilotOutcome {
  const status = deps.statusOf(bookId);
  const phase = decidePhase(status, deps.sweepConfirmed(bookId), regen);
  const expected = deps.expectedChapterNumbers(bookId);
  const written = new Set(status.chapters.filter((c) => c.written).map((c) => c.number));
  const toWrite = expected.filter((n) => !written.has(n)).length || Math.max(0, (status.expectedChapters ?? 0) - status.writtenChapters);
  // Real first wave = sweep + keyA + keyB + major-triage + one bar per reviewed
  // chapter (N+4). THEN the round can dynamically add, per chapter: up to 2 bar-tiebreak
  // reads if its bar lands BORDERLINE (≤2N — tiebreak is on for EVERY round now), and up
  // to one confirm read if it becomes a publishable candidate (≤N). So the per-round
  // WORST case is N+4 + 2N + N = 4N+4; the EXPECTED case is far lower (most chapters are
  // neither borderline nor regenerated). The old estimate counted only N+4 + ≤N confirm
  // and silently omitted the tiebreak reads T3 enabled.
  const N = status.expectedChapters ?? status.writtenChapters ?? 0;
  const firstWave = N + 4;
  const perRoundMax = firstWave + 2 * N + N; // base + tiebreak + confirm
  const lines = [
    `AUTOPILOT PLAN — ${bookId}`,
    `  current phase: ${phase}`,
    `  codex sessions that WOULD spawn from here (estimate):`,
    `    research: ${phase === "research" ? 1 : 0}`,
    `    write:    ${phase === "research" || phase === "write" ? toWrite : 0} (one per remaining chapter)`,
    `    qc round: base ~${firstWave} (sweep + keyA + keyB + major-triage + ${N}×bar)`,
    `              + up to 2 tiebreak reads per BORDERLINE chapter (≤${2 * N})`,
    `              + up to 1 confirm read per publishable candidate (≤${N})`,
    `              = ≤${perRoundMax} sessions/round worst case (typical: far lower)`,
    `              ×(1 initial + up to 3 repair rounds)`,
    `  publish: AUTO on convergence (full promote gate, then commit+push to main; --no-publish halts for review)`,
    `  no API metering — every session runs via codex exec on the subscription.`,
  ];
  deps.log(lines.join("\n"));
  return { status: "ready", bookId, message: "(plan only — no action taken)" };
}

export function formatOutcome(o: AutopilotOutcome): string {
  switch (o.status) {
    case "shipped": return `AUTOPILOT — ${o.bookId}: already shipped (packaged).`;
    case "published": return `AUTOPILOT — ${o.bookId}: ${o.message ?? `PUBLISHED from round ${o.roundId}.`}`;
    case "ready": return `AUTOPILOT — ${o.bookId}: ${o.message}`;
    case "halt": return `AUTOPILOT HALT — ${o.bookId} [phase ${o.phase} · ${o.category}]: ${o.reason}`;
  }
}
