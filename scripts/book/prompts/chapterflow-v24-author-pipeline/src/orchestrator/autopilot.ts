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
import { createHash, randomBytes } from "crypto";
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, unlinkSync, appendFileSync, renameSync, copyFileSync, rmSync } from "fs";
import { hostname, tmpdir } from "os";
import { dirname, resolve, relative } from "path";
import { fileURLToPath } from "url";

import { computeBookStatus, type BookStatus } from "../lifecycle/bookStatus.js";
import { STRICT_PIPELINE_ENV } from "../lib/strictEnv.js";
import { REPO_ROOT, normSlug, CANONICAL_STATE } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { recordAuthorProvenance } from "../qc/sessionProvenance.js";
import { loadBookChapters, keyPackDir, quarantineCorruptChapterFiles } from "../qc/manualKeyJudge.js";
import { normalizeChapterProvenance } from "../qc/normalizeProvenance.js";
import { unresolvedMajors, formatMajorStatus, type MajorFindingSnapshot } from "../qc/majorDisposition.js";
import { pruneBookStatePlan, applyPruneBookState } from "../qc/pruneBookState.js";
import { carryableChapter, ledgerStatus } from "../qc/orchestrator/index.js";
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
import { sweepPackPath, sweepTwoRoundConfirmed, sweepFindingBlocks, type SweepRecord } from "../qc/sweep.js";
import { renderSweepFamilyRubric, SWEEP_SUBMISSION_SCHEMA_ID, SWEEP_FAMILIES, sweepDefectFingerprintV2, type SweepFamily } from "../qc/sweepSpec.js";
import { validateSubmission, type ValidatedSweepSubmission } from "../qc/orchestrator/schemas.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { barPackPath } from "../qc/barReview.js";
import { barArtifactPath, confirmArtifactPath, evidenceMatrixPath, submissionsDir, type BarReadVariant } from "../qc/orchestrator/artifacts.js";
import type { FinalizeQcRoundResult } from "../qc/orchestrator/finalize.js";
import { spawnCodexAgent, type CodexAgentResult, type CodexSandbox } from "./codexAgent.js";
import { researchFreshnessViolation } from "./researchFreshness.js";
import { doCompilerWrite } from "./compilerRun.js";
import { doAuthorWrite } from "./authorRun.js";
import { doAuthorReview, AUTHOR_BOOK_READERS, type AuthorReviewIo } from "./authorReview.js";
import { deriveDurableAcceptance, loadNewestAcceptanceRecord } from "./authorAcceptanceState.js";
import { SessionLedger, newRunManifest, writeCostReport, formatCostReport, writeRunManifest, type RunManifest } from "./sessionLedger.js";
import { runRoutedRedeals, runArtifactSync } from "./repairRouting.js";
import { bookRiskPath } from "../artifacts/artifactStore.js";
import { RISK_SCORE_SCHEMA_VERSION, type BookRiskScoreV1, type ChapterRiskScoreV1 } from "../artifacts/artifactTypes.js";
import { NOT_METERED_MESSAGE } from "../cost-tracker.js";

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
  /** E1 — v24 author arch DURABLE acceptance. True iff book acceptance still holds
   *  at the book's CURRENT on-disk bytes: EVERY chapter carries a FRESH PUBLISHABLE
   *  attestation with dimensions.bookAcceptance===true AND the newest persisted
   *  acceptance record is accepted at valid-reader quorum (deriveDurableAcceptance).
   *  This replaces the memory-only `authorBookAccepted` flag that reset on every
   *  conductor re-entry (routing a fully-accepted book back to "qc"). Fail-safe →
   *  false (a re-run of the acceptance phase is always correct; any doubt re-runs). */
  authorAccepted: (bookId: string) => boolean;
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
  /** The book's risk-score report (state/books/<id>/artifacts/risk/book-risk.json), written
   *  by the compiler write phase's `risk-score` step (doCompilerWrite). READ-ONLY — this never
   *  computes or writes the report itself, only reads what the write phase already persisted.
   *  Fail-safe → an empty "low" report when the file is missing/unreadable (legacy architecture
   *  never writes one, and a stale/absent report must never block or spin the gate). Drives the
   *  bounded narrow QC-shadow review in doGate: high-lane chapters get one extra read-only pass
   *  before formal QC, which still runs unconditionally afterward. */
  bookRisk: (bookId: string) => BookRiskScoreV1;
  /** True iff the reviewer card already produced a submission on disk — used to
   *  re-spawn ONLY the missing reviewers on an INCOMPLETE round, not the whole wave. */
  submissionPresent: (bookId: string, roundId: string, card: string) => boolean;
  /** Persist one agent session's outcome (durable per-agent log) for walk-away forensics. */
  logSession: (bookId: string, label: string, r: CodexAgentResult) => void;
  /** C5 (S-tier): per-chapter REVIEW-carry telemetry — the cost report's `carry` tally
   *  tracks only the once-per-run acceptance-carry decision, which read "0 hit / 1 miss"
   *  on an entry that carried 7/9 reviews. Optional (tests/manual drivers omit it);
   *  wired to the run ledger by runAutopilot. Must never throw. */
  noteReviewCarry?: (hit: boolean) => void;
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
  /** A2 — research FRESHNESS check, run only after a research pass satisfies
   *  researchProgressMade(). The handoff contract (index exists + book-status=write)
   *  was gamed by a session that RESTORED an archived run byte-identical from
   *  state/_regen-backups/ instead of researching. This returns a one-line violation
   *  reason when the newest run's sidecars were not freshly produced during the task
   *  (no run / nothing written since taskStartedAtMs / byte-identical to a backup),
   *  or null when fresh. Default: researchFreshnessViolation (pure fs logic). */
  researchFreshness: (bookId: string, taskStartedAtMs: number) => string | null;
  log: (m: string) => void;
};

export type AutopilotOptions = {
  bookId: string;
  maxRepairRounds?: number; // default 4
  maxParallel?: number; // default 6
  autoPublish?: boolean; // library default false (→ HALT at ready). The CLI (book-run / book-autopilot) defaults this ON; when true, handleReady runs publish-after-qc --commit --push.
  plan?: boolean; // dry-run: print the spawn plan, take no action
  regen?: boolean; // regenerate an already-PACKAGED book: ignore the "shipped" skip (decidePhase) so the conductor re-runs end-to-end WITHOUT moving the package aside — the package stays, so the web registry import never dangles (fixes the concurrent-regen deadlock).
  // REQUIRED, not defaulted: book-autopilot (cli.ts) and book-run (liveRun.ts) both default
  // their own CLI flag to "compiler", and a silent library-level `?? "legacy"` here previously
  // let any other caller (tests, future scripts) fall back to the v21 whole-chapter writer
  // without anyone choosing that. Forcing every caller to state it keeps the route a conscious
  // choice instead of an implicit one.
  architecture: "compiler" | "legacy" | "author"; // v23 compiler path writes typed section artifacts then assembles ChapterV21; legacy keeps whole-chapter writer fanout; author (v24) = one whole-chapter author per chapter + blinded reader review/regeneration (authorRun.ts / authorReview.ts).
  /** v24 author arch only: injectable IO for doAuthorWrite/doAuthorReview so tests
   *  drive the author phases against fixtures/tmp roots. Ignored by compiler/legacy. */
  authorIo?: Partial<AuthorReviewIo>;
  deps?: Partial<AutopilotDeps>;
};

/** Map CLI flags → the conductor architecture. Shared by book-autopilot (cli.ts) and
 *  book-run (liveRun.ts) so the two entrypoints can never drift: --legacy (or the long
 *  form) keeps meaning legacy, --author selects the v24 author arch, default stays
 *  compiler. Exported for tests (pins compiler/legacy defaults unchanged). */
export function architectureFromFlags(flags: Record<string, string | boolean>): "compiler" | "legacy" | "author" {
  if ("legacy-whole-chapter-writer" in flags || "legacy" in flags) return "legacy";
  if ("author" in flags) return "author";
  return "compiler";
}

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

/** Cross-phase flip tracker: one instance per runAutopilot() call, threaded through every
 *  doGate()/doQcWithRepair() invocation. Each phase records the finding signature it is about
 *  to act on (a gate's deterministic-blocker signature, or a QC round's REVISE signature). The
 *  outer MAX_LOOP_ITERS backstop only catches a flip generically (after the WHOLE loop budget is
 *  spent, with a "likely a stuck phase" message); this lets us halt the instant the SAME
 *  signature recurs in the same phase with the other phase visited in between — a gate→qc→gate
 *  (or qc→gate→qc) re-entry that re-creates a finding the prior visit already "fixed". */
export type GateQcFlipTracker = { history: Array<{ phase: "gate" | "qc"; sig: string }> };

export function newGateQcFlipTracker(): GateQcFlipTracker {
  return { history: [] };
}

/** Records `sig` for `phase` and returns the recurring signature when this entry completes a
 *  phase(sig) → otherPhase(anything) → phase(SAME sig) pattern — i.e. a real gate↔QC flip, not
 *  just a repeated attempt within the SAME phase (which already has its own no-progress checks).
 *  A blank signature (nothing to act on) is never recorded — an empty `before` is never "stuck". */
export function recordGateQcSignature(tracker: GateQcFlipTracker, phase: "gate" | "qc", sig: string): string | null {
  if (!sig) return null;
  const h = tracker.history;
  if (h.length >= 2) {
    const prev1 = h[h.length - 1];
    const prev2 = h[h.length - 2];
    if (prev1.phase !== phase && prev2.phase === phase && prev2.sig === sig) {
      h.push({ phase, sig });
      return sig;
    }
  }
  h.push({ phase, sig });
  return null;
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

/** E1 — durable author-arch acceptance (deriveDurableAcceptance). Fail-safe →
 *  false: any read error / doubt re-runs the acceptance phase (never force-ships). */
function defaultAuthorAccepted(bookId: string): boolean {
  try {
    return deriveDurableAcceptance(bookId).accepted;
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

/** Read-only: the risk-score report the compiler write phase already persisted. Never
 *  computes it (that would re-introduce a write side-effect into the read-only gate loop) —
 *  a missing/unreadable report (legacy architecture, or a book that hasn't reached risk-score
 *  yet) fails safe to an empty "low" report so it never blocks or spins the gate. */
function defaultBookRisk(bookId: string): BookRiskScoreV1 {
  const normalized = normSlug(bookId);
  try {
    return JSON.parse(readFileSync(bookRiskPath(normalized), "utf8")) as BookRiskScoreV1;
  } catch {
    return { schemaVersion: RISK_SCORE_SCHEMA_VERSION, bookId: normalized, generatedAt: "", lane: "low", chapters: [], bookWideRisks: [] };
  }
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

/** Q6/T3 — the meaningful head to record in sessions.jsonl. The old field was
 *  `r.finalMessage.slice(0,500)`, but finalMessage = lastNonEmptyLine(stdout)
 *  (codexAgent.ts): for a reader whose output ends with a fenced JSON block the
 *  last non-empty line is the closing "```", so the jsonl captured literally
 *  "```" and forensics had to fall back to ~/.codex rollouts. This returns the
 *  reader's actual final json block when present (the verdict forensics need),
 *  else the finalMessage, capped at 2000 chars. The COMPLETE output is written
 *  to a per-session sidecar (see below). */
export function sessionFinalHead(r: CodexAgentResult, cap = 2000): string {
  const stdout = r.stdout ?? "";
  const blocks = [...stdout.matchAll(/```(?:json)?\s*[\s\S]*?```/g)].map((m) => m[0]);
  const head = blocks.length > 0 ? blocks[blocks.length - 1] : (r.finalMessage ?? "");
  return head.slice(0, cap);
}

function logSessionToDisk(bookId: string, label: string, r: CodexAgentResult): void {
  // Durable per-agent log for walk-away forensics. Best-effort: never break a run
  // on a log-write failure.
  try {
    const dir = resolve(PIPELINE_DIR, "state", "autopilot-logs", bookId);
    mkdirSync(dir, { recursive: true });
    // Q6/T3: persist the COMPLETE final output to a per-session sidecar so
    // forensics no longer depend on ~/.codex rollouts the repo can't control.
    const fullMessage = ((r.stdout ?? "").length > (r.finalMessage ?? "").length) ? (r.stdout ?? "") : (r.finalMessage ?? "");
    let finalPath: string | null = null;
    try {
      const finalDir = resolve(dir, "final");
      mkdirSync(finalDir, { recursive: true });
      const safeId = String(r.sessionId ?? "session").replace(/[^A-Za-z0-9._-]/g, "_");
      finalPath = resolve(finalDir, `${safeId}.txt`);
      writeFileSync(finalPath, fullMessage, "utf8");
    } catch { /* best-effort: the jsonl head below still carries the verdict */ }
    const line = JSON.stringify({
      at: new Date().toISOString(), label, sessionId: r.sessionId, ok: r.ok,
      exitCode: r.exitCode, durationMs: r.durationMs,
      // A MEANINGFUL head (the reader's final json block, not the closing fence),
      // plus a pointer to the complete-output sidecar.
      finalMessage: sessionFinalHead(r), finalMessagePath: finalPath ? relative(PIPELINE_DIR, finalPath) : null,
      stderr: (r.stderr ?? "").slice(0, 1000),
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
    authorAccepted: d?.authorAccepted ?? defaultAuthorAccepted,
    majorFindingKeys: d?.majorFindingKeys ?? defaultMajorFindingKeys,
    blockingMajors: d?.blockingMajors ?? defaultBlockingMajors,
    bookRisk: d?.bookRisk ?? defaultBookRisk,
    submissionPresent: d?.submissionPresent ?? submissionPresentOnDisk,
    logSession: d?.logSession ?? logSessionToDisk,
    logBroker: d?.logBroker ?? logBrokerToDisk,
    reviewerSkeleton: d?.reviewerSkeleton ?? defaultReviewerSkeleton,
    reviewerWorkspace: d?.reviewerWorkspace ?? defaultReviewerWorkspace,
    readReviewPacket: d?.readReviewPacket ?? defaultReadReviewPacket,
    writeTempSubmission: d?.writeTempSubmission ?? defaultWriteTempSubmission,
    acquireLock: d?.acquireLock ?? ((bookId) => acquireBookLock(resolve(PIPELINE_DIR, "state", "autopilot-locks"), bookId)),
    researchFreshness: d?.researchFreshness ?? researchFreshnessViolation,
    log: d?.log ?? ((m) => console.log(m)),
  };
}

// ── The conductor ────────────────────────────────────────────────────────────

const MAX_LOOP_ITERS = 40; // safety backstop; real phases advance well under this
// R3 — how many times, per repair attempt, to re-dispatch a TARGETED fix for a major the repair
// itself introduced (qc-converge can't see majors). Small + separate from the outer maxRepair
// round budget; the outer loop + noProgress halt are the global anti-spin backstop.
const REGRESSION_REDISPATCH_CAP = 2;

/** WS6 T1/T2 — map a terminal AutopilotOutcome to a short terminal tag for the cost report
 *  + run manifest. */
function terminalTag(o: AutopilotOutcome): string {
  return o.status === "halt" ? `halt:${o.category}` : o.status;
}

export async function runAutopilot(opts: AutopilotOptions): Promise<AutopilotOutcome> {
  // WS6 — one per-run session ledger + run manifest. The ledger observes EVERY minted
  // session id (mkSessionId) and every spawned session's outcome (logSession) by wrapping
  // those two deps choke points, so both are captured no matter which module spawned. At
  // every terminal we write cost-report.json + finalize run-manifest.json and print a
  // compact table. Telemetry is best-effort: it never converts into a halt.
  const ledger = new SessionLedger(opts.bookId);
  const runManifest = newRunManifest({
    bookId: opts.bookId,
    arch: opts.architecture,
    flags: {
      autoPublish: opts.autoPublish ?? false,
      regen: opts.regen ?? false,
      plan: opts.plan ?? false,
      maxRepairRounds: opts.maxRepairRounds ?? 4,
      maxParallel: opts.maxParallel ?? 6,
    },
    readerCount: opts.architecture === "author" ? AUTHOR_BOOK_READERS : null,
  });
  const base = resolveDeps(opts.deps);
  // Wrap the two telemetry choke points without changing their behavior. mkSessionId still
  // returns the base id (unchanged), we just observe it; logSession still runs the base
  // sink, we just also record the outcome. Both wrappers are self-guarded so a ledger bug
  // can never brick a run.
  const deps: AutopilotDeps = {
    ...base,
    mkSessionId: (label: string) => {
      const id = base.mkSessionId(label);
      try { ledger.mint(label, id); } catch { /* telemetry never halts a run */ }
      return id;
    },
    logSession: (bookId: string, label: string, r: CodexAgentResult) => {
      try { ledger.record(r); } catch { /* telemetry never halts a run */ }
      base.logSession(bookId, label, r);
    },
    noteReviewCarry: (hit: boolean) => {
      try { if (hit) ledger.reviewCarryHit(); else ledger.reviewCarryMiss(); } catch { /* telemetry never halts a run */ }
    },
  };
  let outcome: AutopilotOutcome;
  try {
    outcome = await runAutopilotCore(opts, deps, ledger);
  } catch (err) {
    // runAutopilotCore already converts in-run throws to structured halts; this is a
    // last-resort guard so a telemetry-wrapper or setup throw still yields a structured
    // outcome (and still finalizes telemetry below).
    outcome = mkHalt(opts.bookId, "research", "infra", `unexpected failure before/around the conductor loop: ${(err as Error)?.message ?? String(err)}`);
  }
  // WS6 — finalize telemetry at the single terminal, for EVERY outcome (ready / published /
  // shipped / halt / error). Best-effort throughout.
  try {
    const terminal = terminalTag(outcome);
    const report = ledger.build(terminal);
    writeCostReport(PIPELINE_DIR, opts.bookId, report);
    base.log(formatCostReport(report));
    if (!report.invariantOk) {
      // A loud ERROR line into the durable log too (never a halt — telemetry must not brick
      // a run). This is the backstop that would have surfaced the first run's 2 hidden
      // deterministic gate-repair spawns at READY instead of via counter archaeology.
      base.log(`[autopilot] ERROR cost-report honest-accounting invariant TRIPPED for ${opts.bookId}: ${report.unloggedSpawnIds.length} spawn id(s) minted but never logged (${report.unloggedSpawnIds.slice(0, 8).join(", ")}) — a spawn site is not routing through logSession.`);
    }
    runManifest.finishedAt = new Date().toISOString();
    runManifest.terminal = terminal;
    finalizeManifestBeatShipped(opts.bookId, opts.architecture, runManifest);
    finalizeManifestPackage(opts.bookId, outcome, runManifest);
    writeRunManifest(PIPELINE_DIR, runManifest);
  } catch { /* telemetry is best-effort: never let it change the outcome */ }
  return outcome;
}

/** Best-effort: read the newest durable acceptance record's bar + beat-shipped composite
 *  into the manifest (author arch only). The control-read git pin is not persisted on the
 *  acceptance record (only its composite floor is), so `pin` stays null. Never throws. */
function finalizeManifestBeatShipped(bookId: string, arch: string, m: RunManifest): void {
  if (arch !== "author") return;
  try {
    const record = loadNewestAcceptanceRecord(bookId);
    if (record) {
      m.bar = record.bar ?? m.bar;
      m.beatShipped = { pin: null, composite: record.beatShipped ?? null };
    }
  } catch { /* best-effort */ }
}

/** Best-effort: when the outcome is a real ship, stamp the promoted package's sha + size. */
function finalizeManifestPackage(bookId: string, outcome: AutopilotOutcome, m: RunManifest): void {
  if (outcome.status !== "published" && outcome.status !== "shipped") return;
  try {
    const pkgPath = resolve(REPO_ROOT, "book-packages", `${bookId}.v21.json`);
    if (!existsSync(pkgPath)) return;
    const bytes = readFileSync(pkgPath);
    m.packageSize = bytes.length;
    m.packageSha = createHash("sha256").update(bytes).digest("hex");
  } catch { /* best-effort */ }
}

async function runAutopilotCore(opts: AutopilotOptions, deps: AutopilotDeps, ledger: SessionLedger): Promise<AutopilotOutcome> {
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
  const architecture = opts.architecture; // required — no silent default (see AutopilotOptions)

  // plan is a read-only dry-run (takes no action, acquires no lock). Guard the status read so a
  // corrupt chapter surfaces as a clean infra halt instead of an uncaught crash (this path runs
  // BEFORE the try/catch below). It deliberately does NOT quarantine — a dry-run must not mutate.
  if (opts.plan) {
    try { return planOnly(bookId, deps, { regen, architecture, autoPublish }); }
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
    // Shared across every gate/qc phase re-entry for THIS run — detects a gate→qc→gate (or
    // qc→gate→qc) re-entry that recreates the SAME finding signature a prior visit already acted
    // on, well before the generic MAX_LOOP_ITERS backstop would fire.
    const gateQcFlipTracker = newGateQcFlipTracker();
    // True once doGate has converged the pre-QC readiness scouts (variety + alignment) this run.
    // When gate is SKIPPED (allGated fresh book → "qc") or a resume enters QC directly, this stays
    // false and doQcWithRepair runs the scouts itself before the first round.
    let preQcScoutsConverged = false;
    // v24 author arch: the confirming function is doAuthorReview's independent book-level
    // readers (AUTHOR_BOOK_READERS=3, Q5), not the sweep — so the author branch substitutes this
    // flag for deps.sweepConfirmed at the decidePhase CALL SITE below (compiler/legacy call sites
    // untouched). It flips true ONLY after the book acceptance (at valid-reader quorum) has passed.
    let authorBookAccepted = false;
    // WS6 carry telemetry: record the durable-acceptance carry decision ONCE per run, at the
    // first author-arch iteration — a HIT means the book entered ALREADY durably-accepted (a
    // whole re-review/acceptance cycle avoided), a MISS means it did not and this run runs the
    // acceptance phase. (Per-iteration recording would falsely count a normal first-pass run's
    // pre-acceptance iterations as carry misses.)
    let carryRecorded = false;
    for (let iter = 0; iter < MAX_LOOP_ITERS; iter++) {
      // Heartbeat: keep our lock fresh AND detect a steal. If refresh() reports we no
      // longer own it (a successor took over after our heartbeat went stale), HALT rather
      // than keep conducting — never two conductors driving the same book.
      if (lock.refresh && !lock.refresh()) {
        return mkHalt(bookId, safePhase(bookId, deps, regen), "infra", `lost the run lock for ${bookId} mid-run (ownership taken over OR heartbeat write failed) — halting to avoid two conductors on the same book.`);
      }
      const status = deps.statusOf(bookId);
      // E1 — durable acceptance: the author branch treats the book as accepted when
      // EITHER this run just accepted it (in-memory flag) OR the durable evidence
      // still holds at the current bytes (deps.authorAccepted: fresh PUBLISHABLE
      // bookAcceptance attestations on every chapter + a quorum-met acceptance
      // record). A fully-accepted book RE-ENTERING the conductor over unchanged
      // content now routes straight to READY (0 sessions) instead of back to "qc".
      // The author arch's biggest efficiency lever is durable acceptance carry — a
      // fully-accepted book re-entering the conductor over unchanged bytes routes straight to
      // READY (0 re-review sessions). Preserve the original lazy short-circuit: authorAccepted
      // is consulted only when this run hasn't already accepted in-memory.
      let authorDurable = false;
      if (architecture === "author" && !authorBookAccepted) {
        authorDurable = deps.authorAccepted(bookId);
        // WS6: record the carry decision ONCE per run (first author iteration).
        if (!carryRecorded) {
          carryRecorded = true;
          try { if (authorDurable) ledger.carryHit(); else ledger.carryMiss(); } catch { /* telemetry never halts */ }
        }
      }
      const sweepConfirmed = architecture === "author"
        ? (authorBookAccepted || authorDurable)
        : deps.sweepConfirmed(bookId);
      const phase = decidePhase(status, sweepConfirmed, regen);
      try { ledger.setPhase(phase); } catch { /* telemetry never halts a run */ }
      // sweepConfirmed is in the signature so a confirming round (which leaves the chapter counts
      // unchanged but flips confirmation) counts as PROGRESS, not a no-progress halt.
      const sig = `${phase}:${status.writtenChapters}/${status.expectedChapters ?? "?"}:${status.gatedChapters}:${status.qcdChapters}:${sweepConfirmed ? "c" : "u"}`;
      deps.log(`[autopilot] phase=${phase} written=${status.writtenChapters}/${status.expectedChapters ?? "?"} gated=${status.gatedChapters} qcd=${status.qcdChapters}`);

      if (phase === "shipped") return { status: "shipped", bookId };
      if (phase === "ready") return handleReady(bookId, status, autoPublish, deps, architecture);

      // No-progress guard: if the same (phase, counts) recur after we acted, the
      // phase isn't advancing — escalate instead of looping forever.
      if (sig === lastSignature) {
        return mkHalt(bookId, phase, "progress", `no progress in phase "${phase}" (state unchanged after an action: ${sig}) — inspect: npx tsx src/cli.ts book-status ${bookId}`);
      }
      lastSignature = sig;

      if (phase === "research") {
        const halt = await doResearch(bookId, deps);
        if (halt) return halt;
        continue;
      }
      if (phase === "write") {
        const halt = architecture === "author"
          ? await doAuthorWrite(bookId, deps, { maxParallel, heartbeat, io: opts.authorIo })
          : architecture === "compiler"
            ? await doCompilerWrite(bookId, deps, { maxParallel, heartbeat })
            : await doWrite(bookId, status, maxParallel, deps, heartbeat);
        if (halt) return halt;
        continue;
      }
      if (phase === "gate") {
        // Pre-QC readiness scouts (cross-chapter VARIETY + semantic ALIGNMENT + narrow QC-shadow)
        // run for EVERY architecture, including the compiler. The compiler route originally skipped
        // them on the bet that the section gate's cross-chapter checks (SEC80/SEC83/AS5/AS10) covered
        // variety — but those are LEXICAL (n-gram / shape) and miss SEMANTIC house-voice sameness:
        // a book-score panel gate-scored the-power-of-moments HIGH cross-chapter churn ("every example
        // is the same swap/resize beat with a rotating cast") that every per-chapter gate passed. The
        // variety scout's scene_skeleton family is exactly that defect, and it is the proven lever
        // (it drove POM to 11/12 first-QC-round on the v21/v22 path). The scouts are read-only +
        // bounded (PREQC_MAX_* / combinedScoutPasses oscillation cap) and only ever emit surgical
        // per-chapter edits — they never weaken QC, which still runs after.
        // v24 author arch: the EXISTING doGate with preQcScouts:false (that option already
        // skips the variety/alignment scouts — the author review phase's blinded readers +
        // book acceptance are the semantic check there). Compiler/legacy call shape unchanged.
        const halt = architecture === "author"
          ? await doGate(bookId, maxRepair, maxParallel, deps, heartbeat, { preQcScouts: false }, gateQcFlipTracker)
          : await doGate(bookId, maxRepair, maxParallel, deps, heartbeat, { preQcScouts: true }, gateQcFlipTracker);
        if (halt) return halt;
        if (architecture !== "author") preQcScoutsConverged = true; // doGate ran the variety+alignment scouts; QC needn't repeat them
        continue;
      }
      if (phase === "qc") {
        if (architecture === "author") {
          // v24 author arch: blinded per-chapter reader review + regeneration + the
          // two-reader book acceptance, INSTEAD of doQcWithRepair. Same outcome shapes:
          // an AutopilotOutcome halts; null = phase complete → re-loop (the acceptance
          // flag below is what lets decidePhase reach "ready").
          const result = await doAuthorReview(bookId, deps, { maxParallel, heartbeat, io: opts.authorIo });
          if (result) return result;
          authorBookAccepted = true; // two independent book readers accepted — the author arch's confirming function
          continue;
        }
        const result = await doQcWithRepair(bookId, maxRepair, maxParallel, deps, heartbeat, gateQcFlipTracker, preQcScoutsConverged);
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
const RESEARCH_MAX_PASSES = 2;
const SOURCE_REPAIR_MAX_PASSES = 3;

function researchProgressMade(bookId: string, deps: AutopilotDeps): boolean {
  try {
    // The research handoff contract is: state/indexes/<bookId>.json exists and contains
    // chapter numbers. Source sidecar completeness is intentionally checked next by
    // source-v2-gate --prewrite in the compiler write phase. This postcondition is cheap
    // and avoids the old "agent exited 0 but wrote nothing" no-progress treadmill.
    if (deps.expectedChapterNumbers(bookId).length > 0) return true;
  } catch {
    /* fall through */
  }
  return false;
}

async function researchProbe(bookId: string, deps: AutopilotDeps): Promise<string> {
  const chunks: string[] = [];
  for (const args of [["book-status", bookId], ["next-task", bookId]] as string[][]) {
    try {
      const r = await deps.runVerb(args);
      const body = (r.stdout || r.stderr || "").trim();
      chunks.push(`$ npx tsx src/cli.ts ${args.join(" ")}\nexit=${r.code}\n${body}`.trim());
    } catch (e) {
      chunks.push(`$ npx tsx src/cli.ts ${args.join(" ")}\nERROR: ${(e as Error)?.message ?? String(e)}`);
    }
  }
  return chunks.join("\n\n");
}

async function buildResearchTask(bookId: string, deps: AutopilotDeps, pass: number, previous?: CodexAgentResult, probe?: string, freshnessViolation?: string): Promise<string> {
  const promptPath = resolve(AGENT_PROMPTS_DIR, "RESEARCH-CODEX-SESSION.md");
  const previousNote = previous
    ? `\nPREVIOUS RESEARCH SESSION EXITED WITHOUT SATISFYING THE HANDOFF CONTRACT.\nexitCode=${previous.exitCode}\nlastStdout=${previous.stdout.slice(-1200)}\nlastStderr=${previous.stderr.slice(-1200)}\n`
    : "";
  // A2: a prior pass that satisfied the handoff contract by RESTORING an archived run
  // (instead of researching) is a FAILED pass — tell the retry session exactly why.
  const freshnessNote = freshnessViolation
    ? `\nPREVIOUS RESEARCH SESSION FAILED THE FRESHNESS CHECK: ${freshnessViolation}\nRestoring or copying ANY archived/backup research run (state/_regen-backups or elsewhere) is a task FAILURE, even if the handoff contract appears satisfied. Produce the chapter index and source-v2 sidecars FRESH from live source research in THIS session.\n`
    : "";
  const probeText = probe ?? await researchProbe(bookId, deps);
  return `${deps.readTask(promptPath)}\n\n---\nAUTOPILOT RESEARCH TASK\nbookId: ${bookId}\npass: ${pass}/${RESEARCH_MAX_PASSES}\n\nYou are already running from the ChapterFlow pipeline root. Do NOT cd into an old v21/v22 folder. Do NOT write chapters, QC, or publish.\n\nCurrent deterministic task probe:\n${probeText}\n\n${previousNote}${freshnessNote}\nMANDATORY HANDOFF CONTRACT\nContinue running the research/next-task loop until BOTH are true:\n1. state/indexes/${bookId}.json exists and contains the full chapter list.\n2. book-status reports phase write-chapter OR generating.\n\nIf the book id is a slug, infer the public title from it for research purposes (for example, your-money-or-your-life → Your Money or Your Life), verify title/author/edition from sources, then write the canonical index and source-v2 sidecars. Stop immediately after the handoff contract is satisfied.`;
}

async function doResearch(bookId: string, deps: AutopilotDeps): Promise<AutopilotOutcome | null> {
  let previous: CodexAgentResult | undefined;
  let lastProbe = await researchProbe(bookId, deps);
  // A2: the last freshness violation, when a pass satisfied the handoff contract by
  // restoring/reusing archived research instead of doing live research this session.
  let lastFreshnessViolation: string | null = null;
  for (let pass = 1; pass <= RESEARCH_MAX_PASSES; pass++) {
    const task = await buildResearchTask(bookId, deps, pass, previous, lastProbe, lastFreshnessViolation ?? undefined);
    deps.log(`[autopilot] research: spawning research session ${pass}/${RESEARCH_MAX_PASSES} for ${bookId}`);
    const passStartMs = Date.now();
    const r = await spawnAndLog(bookId, {
      task,
      sessionId: deps.mkSessionId(pass === 1 ? "research" : `research-retry-${pass}`),
      cwd: PIPELINE_DIR,
      sandbox: "workspace-write",
      writableRoots: WORK_WRITABLE_ROOTS,
      timeoutMs: RESEARCH_TIMEOUT_MS,
      reasoningEffort: "high",
    }, deps);
    if (!r.ok) {
      deps.log(`[autopilot] research session exited ${r.exitCode}: ${(r.stderr || r.stdout).slice(0, 500)}`);
      return mkHalt(bookId, "research", "infra", `research Codex session exited ${r.exitCode} before creating the chapter index. Last output:\n${(r.stderr || r.stdout).slice(0, 1800)}`);
    }
    if (researchProgressMade(bookId, deps)) {
      // A2: the handoff contract alone is gameable (a session can RESTORE an archived
      // run from state/_regen-backups/ byte-identical and the postcondition holds).
      // Verify the newest run's sidecars were freshly produced during THIS pass.
      const violation = deps.researchFreshness(bookId, passStartMs);
      if (!violation) return null;
      lastFreshnessViolation = violation;
      previous = r;
      lastProbe = await researchProbe(bookId, deps);
      deps.log(`[autopilot] research session ${pass}/${RESEARCH_MAX_PASSES} satisfied the handoff contract but FAILED the freshness check: ${violation}`);
      continue;
    }
    previous = r;
    lastProbe = await researchProbe(bookId, deps);
    deps.log(`[autopilot] research session ${pass}/${RESEARCH_MAX_PASSES} exited 0 but did not create state/indexes/${bookId}.json; retrying with a stricter handoff contract`);
  }
  if (lastFreshnessViolation) {
    return mkHalt(bookId, "research", "content", `research restored an archived run instead of researching — remove backups from reach or re-dispatch research. Every research pass (${RESEARCH_MAX_PASSES}) satisfied the handoff contract without producing fresh source research. Last freshness violation: ${lastFreshnessViolation}\n\nLatest task probe:\n${lastProbe.slice(0, 2200)}`);
  }
  return mkHalt(bookId, "research", "progress", `research did not create the canonical chapter index after ${RESEARCH_MAX_PASSES} session(s). This is a research bootstrap failure, not a write/QC issue.\n\nLatest task probe:\n${lastProbe.slice(0, 2200)}\n\nRecommended fix: run the repair prompt or a research agent focused only on completing the next-task research-bibliography/chapter-index loop until state/indexes/${bookId}.json exists, then rerun book-run.`);
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

function sourcePrewriteGateOutput(r: VerbResult): string {
  return (r.stdout || r.stderr || "").trim();
}

export function buildSourcePrewriteRepairTask(bookId: string, sourceGateReport: string, attempt: number, maxAttempts: number): string {
  return `You are a SOURCE REPAIR subagent for ChapterFlow bookId ${bookId}.

The autonomous conductor is blocking BEFORE writer fanout because the source-v2 sidecars are not authoring-ready. This is good: thin research makes writers invent details, then QC fails. Your job is to repair RESEARCH ARTIFACTS ONLY so the first formal QC round receives chapters grounded in concrete, checkable material.

SCOPE — edit only research/source artifacts:
- .chapterflow/runs/${bookId}/**/sidecars/source/ch*.source.json
- .chapterflow/source-verify-${bookId}.md or source-verify records ONLY if your sidecar edits change verification coverage
- state/indexes/${bookId}.json ONLY if the TOC/index is genuinely malformed
Do NOT write or edit state/chapters/*.chapter.json. Do NOT weaken gates, schemas, QC policy, or pipeline code.

WHY THIS FAILED
The source readiness gate found sidecars that are structurally present but too thin for safe authoring. The common failure is SV2.realness_unsupported_entity: a namedExample claims to be a real-world entity, but its hardSpecifics are generic or are not supported by the example summary/paraphrase notes. The writer then has to guess, which later appears as factual_accuracy, invented-witness, source-as-prop, or cross-unit-bleed QC defects.

SOURCE GATE REPORT (attempt ${attempt}/${maxAttempts})
${sourceGateReport}

REPAIR STRATEGY
1. For every reported chapter and namedExamples[i], open the exact chNN.source.json sidecar.
2. If the item is a concrete real-world case, keep realWorld:true and give it 2-4 verified hardSpecifics: dates, named institutions, product/law/study names, counts, durations, named roles, or quoted framework members. Then make sure at least two of those specifics also appear naturally in the example summary or paraphraseNotes so the gate can see the detail is supported, not pasted decoration.
3. If the item is a broad concept, law, regulation, scoring model, government agency, or framework rather than a usable scene/case, either:
   - move its teachable proposition into testableFacts[] or frameworks[], and replace the namedExample with a concrete verified case from the chapter; OR
   - mark realWorld:false only when it is an author's conceptual device rather than a verifiable real-world case. Do not use realWorld:false to hide a thin real-world claim.
4. For every testableFacts[] problem, rewrite the fact as one checkable proposition, make becauseMechanism causal, make commonError a real wrong belief, and make errorIsWhy explain why the wrong belief fails.
5. Preserve stable ids and chNN prefixes unless an id is invalid. Keep derivedFrom references pointing to known anchors.
6. Do not invent hard specifics. If you cannot verify a detail, remove/soften it or replace the example with a verified one.
7. If source verification is required and your edits add/change items, update the source-verify record so every named case/fact still has a real sourceRef and note.

VALIDATION — run these before declaring done:
- npx tsx src/cli.ts source-v2-gate ${bookId} --prewrite
- npx tsx src/cli.ts source-v2-gate ${bookId}
- npx tsx src/cli.ts source-verify-check ${bookId}   # if a source-verify record exists or verification is required
- npx tsx src/cli.ts book-status ${bookId}

DONE CRITERIA
The first command must PASS. When it passes, stop. Do not start writing chapters.`;
}

async function ensureSourceReadyBeforeWrite(bookId: string, deps: AutopilotDeps, heartbeat: () => boolean = () => true): Promise<AutopilotOutcome | null> {
  let lastReport = "";
  for (let attempt = 0; attempt <= SOURCE_REPAIR_MAX_PASSES; attempt++) {
    if (!heartbeat()) {
      return mkHalt(bookId, "write", "infra", `lost the run lock for ${bookId} while checking source readiness — halting to avoid two conductors on the same book.`);
    }
    const gate = await deps.runVerb(["source-v2-gate", bookId, "--prewrite"]);
    lastReport = sourcePrewriteGateOutput(gate);
    if (gate.code === 0) {
      if (attempt > 0) deps.log(`[autopilot] source readiness PASS after ${attempt} repair attempt(s)`);
      return null;
    }
    if (gate.code >= 2) {
      return mkHalt(bookId, "write", "infra", `source-v2-gate --prewrite errored (exit ${gate.code}) before writer fanout — inspect research/index state:\n${lastReport.slice(0, 1200)}`);
    }
    if (attempt >= SOURCE_REPAIR_MAX_PASSES) {
      return mkHalt(bookId, "write", "content", `source-v2-gate --prewrite still BLOCKS after ${SOURCE_REPAIR_MAX_PASSES} source repair attempt(s). Fix research sidecars before authoring.\n${lastReport.slice(0, 2000)}`);
    }
    deps.log(`[autopilot] source repair attempt ${attempt + 1}/${SOURCE_REPAIR_MAX_PASSES}: source-v2-gate --prewrite blocked before writer fanout — repairing research sidecars`);
    const task = buildSourcePrewriteRepairTask(bookId, lastReport, attempt + 1, SOURCE_REPAIR_MAX_PASSES);
    const r = await spawnAndLog(bookId, {
      task,
      sessionId: deps.mkSessionId(`source-repair-${attempt + 1}`),
      cwd: PIPELINE_DIR,
      sandbox: "workspace-write",
      writableRoots: WORK_WRITABLE_ROOTS,
      timeoutMs: RESEARCH_TIMEOUT_MS,
    }, deps);
    if (!r.ok) deps.log(`[autopilot] source repair session exited ${r.exitCode}: ${r.stderr.slice(0, 300)}`);
  }
  return mkHalt(bookId, "write", "content", `source-v2-gate --prewrite still BLOCKS before writer fanout. Fix source sidecars manually.\n${lastReport.slice(0, 2000)}`);
}

async function doWrite(bookId: string, status: BookStatus, maxParallel: number, deps: AutopilotDeps, heartbeat: () => boolean = () => true): Promise<AutopilotOutcome | null> {
  const sourceHalt = await ensureSourceReadyBeforeWrite(bookId, deps, heartbeat);
  if (sourceHalt) return sourceHalt;

  const writeDir = `state/authoring-cards/${bookId}`;
  // Deal the dispatch cards (idempotent; also writes the pre-authoring plans).
  const fanout = await deps.runVerb(["fanout", bookId, "--write-dir", writeDir]);
  if (fanout.code !== 0) {
    const msg = (fanout.stderr || fanout.stdout).slice(0, 1200);
    deps.log(`[autopilot] fanout exited ${fanout.code}: ${msg.slice(0, 300)}`);
    const category: HaltCategory = /source-v2-gate|source readiness|source-v2/i.test(msg) ? "content" : "infra";
    return mkHalt(bookId, "write", category, `fanout could not deal authoring cards (exit ${fanout.code}). ${category === "content" ? "Repair research/source sidecars before authoring." : "Inspect fanout/index/plan state."}\n${msg}`);
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
  return null;
}

// ── Phase: gate (repair ship/book-gate blockers, bounded) ─────────────────────

async function doGate(bookId: string, maxRepair: number, maxParallel: number, deps: AutopilotDeps, heartbeat: () => boolean = () => true, options: { preQcScouts?: boolean } = {}, flipTracker: GateQcFlipTracker = newGateQcFlipTracker()): Promise<AutopilotOutcome | null> {
  // BP7 (book-pattern audit) fails closed without durable brief + per-chapter plan artifacts under
  // state/briefs|plans/, which the codex authoring path does NOT persist. `derive-artifacts` is a
  // deterministic, side-effect-free pass over on-disk state, so derive them up front: this resolves
  // BP7 deterministically instead of leaving it to the content-repair agent's initiative. The repair
  // task below says "edit chapter CONTENT only", so a compliant agent would never create those files
  // and the loop would burn every attempt then HALT "deterministic gates still DIRTY". Best-effort —
  // a derive failure just falls back to the prior agent-driven behavior, no worse than before.
  const derived = await deps.runVerb(["derive-artifacts", bookId]);
  if (derived.code !== 0) deps.log(`[autopilot] derive-artifacts exited ${derived.code} before gate convergence (BP7 may persist) — ${(derived.stderr || derived.stdout).slice(0, 200)}`);
  let gateContentAttempts = 0; // deterministic blocker/major repairs consume maxRepair; pre-QC scouts do not
  let varietyPasses = 0; // pre-QC cross-chapter variety DETEMPLATE passes (bounded; independent of maxRepair)
  let varietyConverged = false; // set once the sweep-unified scout reads clean (or advisory-proceeds)
  let alignmentPasses = 0; // pre-QC semantic/factual readiness passes (bounded; independent of maxRepair)
  // Dedicated A→B→A oscillation budget: a variety edit can reliably re-trigger an alignment
  // finding (and vice versa), and EACH scout resets its SIBLING's counter back to 0 on every edit
  // (see below) — so varietyPasses/alignmentPasses alone never reach their own cap when the two
  // scouts are flip-flopping. This counter is NOT reset by either scout, so the oscillation is
  // bounded independently of the per-scout caps. scoutEditSignatures keeps the last few edit
  // signatures so a halt can name exactly what is flipping.
  let combinedScoutPasses = 0;
  const scoutEditSignatures: string[] = [];
  let shadowQcDone = false; // narrow risk-lane QC-shadow review: at most once per gate-phase entry
  const maxGateIterations = maxRepair + PREQC_MAX_VARIETY_PASSES + PREQC_MAX_ALIGNMENT_PASSES + 4;
  for (let attempt = 1; attempt <= maxGateIterations; attempt++) {
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
      // Gate↔QC flip check: if THIS SAME blocker signature already surfaced in a previous gate
      // visit with a QC visit in between (this run already repaired it once, advanced to QC, and
      // QC's repair re-introduced the IDENTICAL blocker), halt with a specific diagnosis instead
      // of burning the rest of maxGateIterations re-dispatching a repair that demonstrably doesn't
      // stick.
      const blockerSig = [...findingSignatures(converge.stdout)].sort().join("|");
      const flip = recordGateQcSignature(flipTracker, "gate", blockerSig);
      if (flip) {
        return mkHalt(bookId, "gate", "progress", `gate/QC flip on ${flip.slice(0, 300)}: this deterministic blocker was already repaired once this run, then re-introduced by a QC repair — gate and QC are fighting over the same finding. Escalate / inspect: npx tsx src/cli.ts qc-converge ${bookId}`);
      }
      deps.log(`[autopilot] gate deterministic repair attempt ${attempt}/${maxRepair} — converging deterministic gates`);
      const task = `Fix the DETERMINISTIC gate findings below for bookId ${bookId} by editing chapter CONTENT only (state/chapters/), then run \`npx tsx src/cli.ts qc-converge ${bookId}\` until it reports DETERMINISTIC-CLEAN. Fix EVERY finding in one pass. Do NOT edit pipeline code/config.

TARGETED REPAIR PLAYBOOK
- AS5.chapter_quiz_prompt_matches_prior: rewrite the reported quiz prompt from this chapter's source facts with a different scenario, opening grammar, decision pressure, and evidence source. Do not swap nouns inside the old skeleton.
- AS6.chapter_quiz_distractor_matches_prior: rewrite the reported correct answer or distractor so it names this chapter's specific mechanism/case/action. Avoid abstract book slogans and reusable proof tails; keep all choices the same kind of answer.
- AS8.chapter_plan_matches_prior: rewrite the reported implementation plan around this chapter's trigger, action mechanism, source fact, and concrete behavior. Change the action, artifact, cadence, and decision ritual; do not keep a checkpoint/blank/pending shell.
- AS10.chapter_field_ngram_matches_prior / SEC83.summary_cross_chapter_ngram: rewrite the reported breakdown/example field with chapter-specific source material. Remove shared five-word runs, framework-list sentences, and connective scaffolds such as "targets are transitions, milestones, and", "at least 3 named cases", or repeated list slogans. SEC83 can report fastRead, deepRead, or fullRead; repair the exact tier/path named in the finding.
- BP19.quiz_banned_tail_phrase and other quiz tail blockers: remove the banned tail and replace it with a scenario-specific misconception or decision.
- A12 lowercase sentence boundary / AS2 jammed proper noun: make the smallest prose correction, then check the chapter did not pick up new AS5-AS10 blockers.
- SEC103.source_numbering_leak: remove reader-facing labels like "Fact 2" or "Source 3" and state the evidence directly.
- SEC104.reader_jammed_proper_noun: separate jammed source labels or replace them with a natural descriptive phrase unless the exact CamelCase brand is allowlisted.
- SEC105.source_label_leak: the reported field pastes an internal source-anchor label in the "Entity / descriptor" bookkeeping form (e.g. "Disney parks / evening spectacular"); rewrite it as natural prose that names the case ("Disney's nightly fireworks finale") and never carries the label's " / " seam. Also replace periphrastic anonymizations like "a Moline-based equipment company" with the plain case name or a chapter-specific description.

Run gate-chapter on every changed chapter and then qc-converge once at the end. If the same AS5/AS6/AS8/AS10 family remains after a real rewrite, stop surface edits and re-author that whole field from the source packet instead of nudging words.

${converge.stdout}`;
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
      // Blockers + blocking-majors are CLEAN. Before anything else, give the risk-score
      // report (written by the compiler write phase's `risk-score` step) one chance to route
      // a narrow QC-shadow review: high-lane chapters get ONE bounded, read-only scrutiny pass
      // here, before formal QC opens (the V23 report's "narrow QC shadow review before formal
      // QC" promise). This NEVER edits a chapter and NEVER gates progression — a failed/skipped/
      // clean shadow read still advances to formal QC unconditionally right after, which stays
      // the sole authority that can pass or block the book.
      if (!shadowQcDone) {
        shadowQcDone = true;
        const highRisk = deps.bookRisk(bookId).chapters.filter((c) => c.lane === "high");
        if (highRisk.length > 0) {
          deps.log(`[autopilot] risk-score flagged ${highRisk.length} high-risk chapter(s) — running narrow QC shadow review before formal QC`);
          await runQcShadowReview(bookId, highRisk, deps);
        }
      }
      // The LAST thing QC checks that the blind parallel
      // writers could NOT self-check is cross-chapter VARIETY (the templating sweep). Converge it
      // HERE — bounded + best-effort — so the first QC round starts de-templated (the first-pass-QC
      // lever). A pass that finds nothing is one cheap full-book read; a pass that finds templating
      // surgically differentiates the flagged chapters then re-loops (the next iteration re-converges
      // any blocker a detemplate edit introduced, then re-scouts or advances).
      if (options.preQcScouts === false) {
        deps.log(`[autopilot] compiler gate: deterministic blockers + blocking majors clean; skipping legacy broad pre-QC scouts → advancing to formal QC`);
        return null;
      }
      if (!varietyConverged) {
        // The scout speaks the sweep's language (same families/defs/validator/gate predicate). A
        // clean read converges; blocking findings drive a surgical detemplate up to the pass budget;
        // if blocking templating SURVIVES the budget we FAIL CLOSED (halt content) rather than burn a
        // QC round the sweep would fail — unless CHAPTERFLOW_PREQC_SCOUT=advisory restores proceed-to-QC.
        const scout = await scoutCrossChapterVariety(bookId, deps);
        persistPreflightScoutRead(bookId, scout, deps);
        if (!scout.blockingFindings.length) {
          varietyConverged = true;
          deps.log(`[autopilot] pre-QC variety: book reads varied (no cross-chapter templating) → continuing to QC-readiness audit`);
        } else if (varietyPasses >= PREQC_MAX_VARIETY_PASSES) {
          if (preQcScoutEnforced()) return mkHalt(bookId, "gate", "content", scoutHaltReason(bookId, scout));
          deps.log(`[autopilot] pre-QC variety: ${scout.blockingFindings.length} blocking finding(s) remain after ${varietyPasses} detemplate pass(es); CHAPTERFLOW_PREQC_SCOUT=advisory → proceeding to QC (safety net)`);
          varietyConverged = true;
        } else {
          combinedScoutPasses++;
          scoutEditSignatures.push(`variety:${scout.rewrites.map((rw) => `ch${rw.chapter}`).sort().join(",")}`);
          if (combinedScoutPasses > PREQC_MAX_COMBINED_SCOUT_PASSES) {
            return mkHalt(bookId, "gate", "progress", `pre-QC variety/alignment oscillation: chapter(s) flip between variety and alignment findings after ${combinedScoutPasses} combined scout passes (budget ${PREQC_MAX_COMBINED_SCOUT_PASSES}) — ${scoutEditSignatures.slice(-4).join(" → ")}. A variety edit is reliably re-triggering an alignment finding (or vice-versa); escalate / inspect: npx tsx src/cli.ts qc-converge ${bookId}`);
          }
          varietyPasses++;
          deps.log(`[autopilot] pre-QC variety pass ${varietyPasses}/${PREQC_MAX_VARIETY_PASSES}: differentiating ${scout.rewrites.length} chapter(s) before QC — ${scout.rewrites.map((rw) => `ch${rw.chapter}`).join(", ")}`);
          await surgicalDetemplate(bookId, scout.rewrites, deps, varietyPasses, maxParallel);
          alignmentPasses = 0; // content changed; re-run semantic readiness after variety settles
          continue;
        }
      }
      if (alignmentPasses < PREQC_MAX_ALIGNMENT_PASSES) {
        alignmentPasses++;
        const repairs = await scoutPreQcAlignment(bookId, deps);
        if (repairs.length) {
          combinedScoutPasses++;
          scoutEditSignatures.push(`alignment:${repairs.map((rw) => `ch${rw.chapter}`).sort().join(",")}`);
          if (combinedScoutPasses > PREQC_MAX_COMBINED_SCOUT_PASSES) {
            return mkHalt(bookId, "gate", "progress", `pre-QC variety/alignment oscillation: chapter(s) flip between variety and alignment findings after ${combinedScoutPasses} combined scout passes (budget ${PREQC_MAX_COMBINED_SCOUT_PASSES}) — ${scoutEditSignatures.slice(-4).join(" → ")}. An alignment edit is reliably re-triggering a variety finding (or vice-versa); escalate / inspect: npx tsx src/cli.ts qc-converge ${bookId}`);
          }
          deps.log(`[autopilot] pre-QC readiness pass ${alignmentPasses}/${PREQC_MAX_ALIGNMENT_PASSES}: repairing ${repairs.length} QC-alignment issue(s) before formal QC — ${repairs.map((rw) => `ch${rw.chapter}`).join(", ")}`);
          await surgicalPreQcAlignmentRepair(bookId, repairs, deps, alignmentPasses, maxParallel);
          varietyPasses = 0; varietyConverged = false; // semantic repair can introduce new cross-chapter echoes; re-scout once
          continue;
        }
        deps.log(`[autopilot] pre-QC readiness pass ${alignmentPasses}: semantic/factual alignment clean → advancing to QC`);
      }
      return null; // blockers + blocking-majors + cross-chapter variety + QC-readiness all clean → advance to qc
    }
    gateContentAttempts++;
    if (gateContentAttempts > maxRepair) return mkHalt(bookId, "gate", "content", `${majors.length} blocking major(s) still unresolved after ${maxRepair} content repair round(s) — escalate. Run: npx tsx src/cli.ts major-status ${bookId}`);
    const shards = buildGateMajorRepairShards(majors);
    deps.log(`[autopilot] gate major repair attempt ${gateContentAttempts}/${maxRepair} — converging ${majors.length} blocking major(s) in ${shards.length} shard(s) before QC: ${majors.map((m) => m.checkId).join(", ")}`);
    await mapWithConcurrency(shards, Math.max(1, maxParallel), async (shard) => {
      heartbeat();
      deps.log(`[autopilot] gate major repair ${shard.label}: working (${shard.majors.length} major(s))`);
      const task = buildGateMajorRepairTask(bookId, shard.majors, deps);
      const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId(`gate-major-repair-${gateContentAttempts}-${shard.label}`), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
      deps.log(`[autopilot] gate major repair ${shard.label}: exited ${r.exitCode}`);
      return r;
    });
    // A major fix is a content edit that can re-introduce a blocker — loop re-runs
    // qc-converge first, so the next pass cleans any new blocker before re-checking majors.
  }
  const final = await deps.runVerb(["qc-converge", bookId]);
  if (final.code >= 2) return mkHalt(bookId, "gate", "infra", `qc-converge errored (exit ${final.code}) after gate/pre-QC convergence — inspect: ${(final.stderr || final.stdout).slice(0, 300)}`);
  if (final.code !== 0) return mkHalt(bookId, "gate", "content", `deterministic gates still DIRTY after gate/pre-QC convergence — escalate. Run: npx tsx src/cli.ts qc-converge ${bookId}`);
  const residualMajors = deps.blockingMajors(bookId);
  if (residualMajors.length === 0) return null;
  return mkHalt(bookId, "gate", "content", `${residualMajors.length} blocking major(s) still unresolved after gate/pre-QC convergence — escalate (these are real, fixable defects, not advisory). Run: npx tsx src/cli.ts major-status ${bookId}\n${residualMajors.map((m) => `  [${m.checkId}] ${m.scope}: ${m.message.slice(0, 140)}`).join("\n")}`);
}

// ── Narrow QC-shadow review (risk-lane routing) ─────────────────────────────────
// computeBookRisk (run as the compiler write phase's `risk-score` step) scores each
// chapter's source-grounding thinness and flags "high" when a chapter's source packet is
// thin, its named cases lack hard specifics, or its evidence map surfaces unsupported
// anchors/numbers. The V23 report promises those chapters "receive narrow QC shadow review
// before formal QC" (V23-COMPILER-PIPELINE-REPORT.md) — this is that wire, kept
// deliberately narrow: ONE bounded, READ-ONLY session scoped to just the flagged chapters
// and the SPECIFIC reasons risk-score gave for each. It never edits a chapter (read-only
// sandbox) and never gates progression — doGate advances to formal QC unconditionally right
// after this returns, whether the session succeeds, fails, or finds nothing. Formal QC
// remains the sole authority that can pass or block the book; this only gives the operator
// earlier visibility into the chapters most likely to need a repair round.
async function runQcShadowReview(bookId: string, highRisk: ChapterRiskScoreV1[], deps: AutopilotDeps): Promise<void> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const chapterList = highRisk
    .map((c) => `- ch${pad(c.chapterNumber)} (risk score ${c.score}): ${c.reasons.join("; ") || "no specific reasons recorded"}`)
    .join("\n");
  const task = `You are a READ-ONLY narrow QC-shadow reviewer for bookId ${bookId}. Do NOT edit any file — this is a bounded pre-QC scrutiny pass, not a repair. Formal QC still runs on this book right after you regardless of what you find, so focus on giving the operator early visibility into the chapters below, which the deterministic risk scorer flagged HIGH risk for thin/weak source grounding:

${chapterList}

For each chapter listed, read state/chapters/${bookId}-ch<NN>.v21-native.chapter.json and its source-v2 sidecar under .chapterflow/runs/${bookId}/**/sidecars/source/ch<NN>.source.json. Report ONLY concrete claims, numbers, or named cases in the chapter that are NOT visible in that chapter's source sidecar. Output a concise plain-text summary; no file edits, no required JSON shape.`;
  const sessionId = deps.mkSessionId("qc-shadow-review");
  try {
    const r = await spawnAndLog(bookId, { task, sessionId, cwd: PIPELINE_DIR, sandbox: "read-only" as CodexSandbox, skipGitRepoCheck: true, reasoningEffort: "medium" }, deps);
    deps.log(`[autopilot] qc-shadow review (${highRisk.length} high-risk chapter(s)) ${r.ok ? "completed" : `exited ${r.exitCode}`} — advancing to formal QC regardless (shadow review never gates)`);
  } catch (e) {
    deps.log(`[autopilot] qc-shadow review spawn error: ${(e as Error)?.message ?? String(e)} — advancing to formal QC (shadow review is best-effort and never blocks)`);
  }
}

type GateMajorRepairShard = { label: string; majors: MajorFindingSnapshot[] };

function gateMajorScopedChapter(m: MajorFindingSnapshot): number | null {
  const scoped = m.scope.match(/^chapter:0*(\d+)(?::|$)/i);
  return scoped ? Number(scoped[1]) : null;
}

function gateMajorReferencedChapters(m: MajorFindingSnapshot): Set<number> {
  const chapters = new Set<number>();
  const scoped = gateMajorScopedChapter(m);
  if (scoped != null) chapters.add(scoped);
  for (const mm of `${m.message} ${m.evidence ?? ""}`.matchAll(/\bch(?:apter)?s?\.?\s*0*(\d+)/gi)) chapters.add(Number(mm[1]));
  return chapters;
}

function buildGateMajorRepairShards(majors: MajorFindingSnapshot[]): GateMajorRepairShard[] {
  const byChapter = new Map<number, MajorFindingSnapshot[]>();
  const bookMajors: MajorFindingSnapshot[] = [];
  for (const m of majors) {
    const ch = gateMajorScopedChapter(m);
    if (ch == null) {
      bookMajors.push(m);
      continue;
    }
    const arr = byChapter.get(ch) ?? [];
    arr.push(m);
    byChapter.set(ch, arr);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const shards = [...byChapter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ch, chapterMajors]) => ({ label: `ch${pad(ch)}`, majors: chapterMajors }));
  if (bookMajors.length) shards.push({ label: "book", majors: bookMajors });
  return shards;
}

/** Build the gate-phase MAJOR-repair task: the blocking majors to fix (advisory ones
 *  already excluded), the dealt authoring cards for any named chapter so a
 *  structural-sameness major (BP33 opener reuse, BP27 venue, F3 answer drift) is
 *  RE-STAGED onto its distinct dealt slots rather than surgically patched onto a
 *  shared frame, and the same isolation guardrails the QC repair uses. */
function buildGateMajorRepairTask(bookId: string, majors: MajorFindingSnapshot[], deps: AutopilotDeps): string {
  const chapters = new Set<number>();
  for (const m of majors) {
    for (const chapter of gateMajorReferencedChapters(m)) chapters.add(chapter);
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
const PREQC_MAX_ALIGNMENT_PASSES = 2;   // semantic/factual readiness scouts before formal QC
const PREQC_MAX_ALIGNMENT_REPAIRS_PER_PASS = 6; // bounded surgical fixes; cheaper than repeated QC rounds
// Dedicated combined budget for variety+alignment scout EDITS, independent of either scout's own
// per-type cap (PREQC_MAX_VARIETY_PASSES / PREQC_MAX_ALIGNMENT_PASSES). Each scout resets its
// sibling's counter to 0 whenever it makes an edit (the content may have unsettled the OTHER
// scout's prior clean read) — so in a genuinely convergent book this combined total never exceeds
// the sum of the two per-type caps (each scout still stops once ITS OWN cap is hit). A count that
// exceeds this budget can only mean the two scouts keep re-triggering each other indefinitely.
const PREQC_MAX_COMBINED_SCOUT_PASSES = PREQC_MAX_VARIETY_PASSES + PREQC_MAX_ALIGNMENT_PASSES;

type VarietyRewrite = { chapter: number; family?: string; shared?: string; instruction: string };

// ── Pre-QC variety scout = formal QC sweep, unified (P08 / F1) ─────────────────
// The scout speaks the SAME language as the QC sweep: it renders its read instructions from
// sweepSpec (same four families, same definitions, same FP-guards) and emits a
// `qc-sweep-submission-v1` submission parsed by the SAME validator the sweep uses. Its extra
// per-finding `moveChapter`/`instruction`/`shared` fields ride ON TOP of the sweep schema
// (unknown fields the validator ignores) and drive the surgical detemplate step. A blocking
// finding is decided by the SAME predicate the sweep gates on (`sweepFindingBlocks`), so a
// scout-clean book is predictively sweep-clean.
export type ScoutSweepFinding = {
  family: SweepFamily;
  chapters: number[];
  severity: "blocker" | "advisory";
  unitId: string;
  quote: string;
  problem: string;
  expectedFix: string;
  moveChapter?: number;
  instruction?: string;
  shared?: string;
};
export type VarietyScoutResult = {
  /** Blocking findings that carry an actionable per-chapter differentiation instruction. */
  rewrites: VarietyRewrite[];
  /** Every finding the sweep predicate would GATE on (blocker severity + distinctive quote). */
  blockingFindings: ScoutSweepFinding[];
  /** The validated sweep submission (envelope normalized to a preflight round), for persistence. */
  submission: ValidatedSweepSubmission | null;
  /** Per-chapter sweep-defect-v2 fingerprints for the blocking findings (for the halt reason). */
  fingerprints: Array<{ chapter: number; fingerprint: string }>;
};

/** `enforce` (default): a blocking-severity scout finding that survives the detemplate budget HALTS
 *  the book (content) — it does NOT waste a formal QC round the sweep would fail anyway.
 *  `CHAPTERFLOW_PREQC_SCOUT=advisory` restores the old proceed-to-QC behavior. */
function preQcScoutEnforced(): boolean {
  return process.env.CHAPTERFLOW_PREQC_SCOUT !== "advisory";
}

/** A compact, operator-readable table of the blocking sweep findings + per-chapter fingerprints,
 *  embedded in the halt reason so the operator (and P10) can compare scout vs sweep findings. */
function scoutHaltReason(bookId: string, res: VarietyScoutResult): string {
  const rows = res.blockingFindings.map((f) =>
    `  [${f.family}] ch${f.chapters.join(",")} ${f.unitId}: "${f.quote.slice(0, 80)}" — ${f.problem.slice(0, 120)}`).join("\n");
  const fps = res.fingerprints.length
    ? `\nper-chapter fingerprints:\n${res.fingerprints.map((e) => `  ch${e.chapter}: ${e.fingerprint}`).join("\n")}`
    : "";
  return `pre-QC variety scout (the QC sweep's own families) still finds ${res.blockingFindings.length} BLOCKING cross-chapter templating finding(s) after exhausting the detemplate budget for ${bookId}. Formal QC would sweep-FAIL this book — halting instead of burning a QC round. Re-differentiate the flagged chapters (or re-research if the source is templated), then re-run. To proceed to QC anyway set CHAPTERFLOW_PREQC_SCOUT=advisory.\n${rows}${fps}`;
}

/** Persist a scout read as `state/qc-preflight/<bookId>/<ts>.scout-read.json` in the sweep
 *  submission FORMAT but with role "preqc-scout" so it can NEVER be ingested as QC evidence
 *  (the sweep validator requires role "sweep"; this file fails that check by construction) and
 *  lives OUTSIDE every QC evidence dir (qc/, qc-orchestrator/, qc-packs/). Best-effort — a write
 *  failure never blocks convergence. Exists only so the operator and P10 can diff scout vs sweep. */
export function persistPreflightScoutRead(bookId: string, res: VarietyScoutResult, deps: AutopilotDeps): void {
  if (!res.submission) return;
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const path = resolve(CANONICAL_STATE, "qc-preflight", normSlug(bookId), `${ts}.scout-read.json`);
    const payload = {
      // role "preqc-scout" (NOT "sweep") — a deliberate marker that makes this file invalid as a
      // qc-sweep-submission-v1 so no QC0/QC3/finalize/attestation path can ever count it as evidence.
      role: "preqc-scout" as const,
      note: "PRE-QC variety scout read — NOT QC evidence. Advisory/operator comparison only.",
      schemaVersion: SWEEP_SUBMISSION_SCHEMA_ID,
      bookId,
      generatedAt: new Date().toISOString(),
      verdict: res.submission.verdict,
      checkedFamilies: res.submission.checkedFamilies,
      findings: res.submission.findings,
      blockingFindings: res.blockingFindings,
      fingerprints: res.fingerprints,
    };
    writeFileAtomic(path, JSON.stringify(payload, null, 2));
  } catch (e) {
    deps.log(`[autopilot] pre-QC scout read persist skipped: ${(e as Error)?.message ?? String(e)}`);
  }
}

type PreQcAlignmentRepair = {
  chapter: number;
  family?: string;
  unit?: string;
  quote?: string;
  problem: string;
  instruction: string;
};

/** The read-only full-book scout prompt. Its family definitions + FP-guards + scope/severity
 *  rubric are rendered FROM sweepSpec (`renderSweepFamilyRubric`), so the scout quotes the SAME
 *  family definitions the formal QC sweep card quotes. It emits a `qc-sweep-submission-v1`
 *  submission (parsed by the SAME validator the sweep uses) with two scout-only extras per
 *  finding — `moveChapter` + `instruction` (+ optional `shared`) — that drive the surgical
 *  differentiation and are ignored by the sweep validator. */
export function buildVarietyScoutTask(bookId: string): string {
  return `You are a READ-ONLY cross-chapter TEMPLATING scout for bookId ${bookId}. You run the EXACT judgment of the formal QC "templating sweep" — the first blocking cross-chapter check — but BEFORE the QC round, so a book you clear is predictively sweep-clean and a book you flag never wastes a QC round. Read EVERY chapter file \`state/chapters/${bookId}-ch*.v21-native.chapter.json\` in ONE pass. Do NOT edit any file; this is analysis only.

Compare these fields ACROSS chapters: title, hook, counterintuition, keyTakeaway, tryThisNow, breakdown.{fastRead,deepRead,fullRead}, examples[].{title,scenario,whatToDo,whyItMatters}, quiz[].prompt, reviewCards[].{front,back}, implementationPlan.{twentyFourHourChallenge,weeklyPractice,ifThenPlans[]}, memorableLines.

Check exactly these four families (this is the sweep's own rubric — quote it verbatim in your reasoning):
${renderSweepFamilyRubric()}

Output ONLY your submission as your FINAL message — a single \`\`\`json fenced block, nothing else. It is a ${SWEEP_SUBMISSION_SCHEMA_ID} (the SAME schema the QC sweep submits), PLUS two extra fields on each finding: "moveChapter" (the ONE chapter to differentiate — never list every chapter in a cluster; one always KEEPS the frame) and "instruction" (a concrete, chapter-specific differentiation: move onto a distinct scene frame / venue / exemplar / name). Set verdict PASS with findings:[] when the book reads varied; REVISE (or CORRUPTION) with one quote-backed finding per templated cluster otherwise. Each finding needs family, chapters (every chapter the shell spans), unitId, quote (a DISTINCTIVE multi-word span of the reused device), problem, expectedFix, severity ("blocker" for real templating; "advisory" for a borderline echo you are surfacing but not gating on), plus moveChapter + instruction.
\`\`\`json
{ "schemaVersion": "${SWEEP_SUBMISSION_SCHEMA_ID}", "verdict": "PASS", "checkedFamilies": [${SWEEP_FAMILIES.map((f) => `"${f}"`).join(", ")}], "findings": [] }
\`\`\`
or, when templated:
\`\`\`json
{ "schemaVersion": "${SWEEP_SUBMISSION_SCHEMA_ID}", "verdict": "REVISE", "checkedFamilies": [${SWEEP_FAMILIES.map((f) => `"${f}"`).join(", ")}], "findings": [ { "family": "repeated_unit", "chapters": [6, 7], "unitId": "implementationPlan.challenge", "quote": "a decision without an owner", "problem": "ch6 & ch7 both pivot on the same functional move.", "expectedFix": "Re-cast ch7's marquee diagnostic onto its dealt move + a distinct venue; leave ch6's version.", "severity": "blocker", "moveChapter": 7, "instruction": "Re-cast ch7's marquee diagnostic onto its dealt move + a distinct venue; leave ch6's version.", "shared": "ch6 & ch7 both pivot on 'a decision without an owner'" } ] }
\`\`\``;
}

/** Spawn the read-only full-book variety scout and parse its sweep submission with the SAME
 *  validator the formal sweep uses. Best-effort: any failure (agent exit, no parseable JSON,
 *  validation failure) returns an EMPTY result → the gate advances to QC unchanged (QC stays the
 *  safety net; a parse failure is never a halt). A validated submission's BLOCKING findings are
 *  decided by the SAME predicate the sweep gates on (`sweepFindingBlocks`). */
export async function scoutCrossChapterVariety(bookId: string, deps: AutopilotDeps): Promise<VarietyScoutResult> {
  const empty: VarietyScoutResult = { rewrites: [], blockingFindings: [], submission: null, fingerprints: [] };
  let r: CodexAgentResult;
  try {
    r = await spawnAndLog(bookId, { task: buildVarietyScoutTask(bookId), sessionId: deps.mkSessionId("pre-qc-variety-scout"), cwd: PIPELINE_DIR, sandbox: "read-only" as CodexSandbox, skipGitRepoCheck: true, reasoningEffort: "high" }, deps);
  } catch (e) {
    deps.log(`[autopilot] pre-QC variety scout spawn error: ${(e as Error)?.message ?? String(e)} — advancing to QC`);
    return empty;
  }
  if (!r.ok) { deps.log(`[autopilot] pre-QC variety scout exited ${r.exitCode} — advancing to QC`); return empty; }
  const json = extractSubmissionJson(r.stdout) ?? extractSubmissionJson(r.finalMessage);
  if (!json) { deps.log(`[autopilot] pre-QC variety scout: no parseable submission in output — advancing to QC`); return empty; }
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(json); } catch { deps.log(`[autopilot] pre-QC variety scout: submission JSON did not parse — advancing to QC`); return empty; }
  const rawFindings = Array.isArray((raw as any)?.findings) ? (raw as any).findings as Array<Record<string, unknown>> : [];
  // The scout owns the JUDGMENT (families/findings/verdict); we own the envelope. Normalize the
  // envelope to a synthetic preflight round so the SAME validator the sweep uses can vet the
  // finding-level rules (family required, chapters required, quote/problem/expectedFix required,
  // PASS-vs-severity rules). A validation failure is best-effort → advance to QC.
  const roundId = `preqc-${Date.now().toString(36)}`;
  const envelope = { ...raw, schemaVersion: SWEEP_SUBMISSION_SCHEMA_ID, bookId, roundId, role: "sweep", reviewer: "preqc-scout" };
  const parsed = validateSubmission(bookId, roundId, "sweep", envelope, {});
  if (!parsed.ok) { deps.log(`[autopilot] pre-QC variety scout: submission failed sweep validation (${parsed.errors.slice(0, 3).join("; ")}) — advancing to QC`); return empty; }
  const submission = parsed.submission as ValidatedSweepSubmission;

  // Current per-chapter content hashes (for the sweep-defect-v2 fingerprints in a halt reason).
  // Best-effort: on a book with no chapters on disk (unit tests) this is simply empty.
  const contentHashes: Record<string, string> = {};
  try { for (const ch of loadBookChapters(bookId)) contentHashes[String(ch.number)] = chapterContentHash(ch); }
  catch { /* no chapters readable — fingerprints stay empty, findings table still renders */ }

  const blockingFindings: ScoutSweepFinding[] = [];
  const rewrites: VarietyRewrite[] = [];
  const fingerprints: Array<{ chapter: number; fingerprint: string }> = [];
  const seenRewrite = new Set<number>();
  submission.findings.forEach((f, i) => {
    // repairClass carries the scout's family label (normalizeFinding maps `family`→`repairClass`);
    // the validator already asserted raw.findings[i].family is one of the four sweep families.
    const family = (rawFindings[i]?.family ?? f.repairClass) as SweepFamily;
    const chapters = (f.chapters ?? (f.chapterNumber !== undefined ? [f.chapterNumber] : [])).filter((n) => Number.isInteger(n) && n > 0);
    // The SAME gating predicate the sweep uses: blocker/major severity AND (for the repetition
    // families) a distinctive quote. An advisory/minor or non-distinctive echo never gates.
    const blocks = sweepFindingBlocks({ family, severity: f.severity === "blocker" || f.severity === "major" ? "blocker" : "advisory", chapters, unitId: f.unitId, quote: f.quote, problem: f.problem, expectedFix: f.expectedFix } as SweepRecord["findings"][number]);
    if (!blocks) return;
    const sf: ScoutSweepFinding = {
      family, chapters,
      severity: "blocker",
      unitId: f.unitId, quote: f.quote, problem: f.problem, expectedFix: f.expectedFix,
      moveChapter: Number.isInteger(Number(rawFindings[i]?.moveChapter)) ? Number(rawFindings[i]?.moveChapter) : undefined,
      instruction: typeof rawFindings[i]?.instruction === "string" ? String(rawFindings[i]?.instruction).trim() : undefined,
      shared: typeof rawFindings[i]?.shared === "string" ? String(rawFindings[i]?.shared).trim() : undefined,
    };
    blockingFindings.push(sf);
    for (const n of chapters) {
      const fp = sweepDefectFingerprintV2({ bookId, contentHashes }, { family, unitId: f.unitId, quote: f.quote }, n);
      if (fp) fingerprints.push({ chapter: n, fingerprint: fp });
    }
    // Derive a surgical rewrite: differentiate the moveChapter (or the last chapter in the cluster,
    // never the first — the first keeps the frame). One rewrite per chapter, bounded.
    const target = sf.moveChapter && chapters.includes(sf.moveChapter) ? sf.moveChapter : chapters[chapters.length - 1];
    if (sf.instruction && Number.isInteger(target) && target! >= 1 && !seenRewrite.has(target!) && rewrites.length < PREQC_MAX_REWRITES_PER_PASS) {
      seenRewrite.add(target!);
      rewrites.push({ chapter: target!, family, shared: sf.shared, instruction: sf.instruction });
    }
  });
  return { rewrites, blockingFindings, submission, fingerprints };
}

/** Execute the scout's brief: ONE surgical session per flagged chapter, each scoped to
 *  edit ONLY its chapter and re-stage onto that chapter's dealt card. Never a multi-chapter
 *  rewrite — a single session re-authoring siblings collapses them onto a shared frame, the
 *  very homogenization this is fixing (see the R4 note in doQcWithRepair). Sessions run in
 *  PARALLEL (≤ maxParallel): each edits a DISTINCT chapter file toward the DISTINCT target the
 *  scout's COORDINATED brief already assigned (keep-one / move-the-others), so — unlike the
 *  blind R4 QC-repair loop, which sequences to avoid racing a SHARED cross-chapter signal — these
 *  cannot collide or re-collapse: the divergence is decided in the brief, not enforced by ordering.
 *  (≤ PREQC_MAX_REWRITES_PER_PASS targets per pass, so the fan-out stays small.) */
async function surgicalDetemplate(bookId: string, rewrites: VarietyRewrite[], deps: AutopilotDeps, pass: number, maxParallel: number): Promise<void> {
  const writeCards = deps.listWriteCards(bookId);
  const pad = (n: number) => String(n).padStart(2, "0");
  await mapWithConcurrency(rewrites, Math.max(1, maxParallel), async (rw) => {
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
  });
}

// ── Pre-QC semantic/factual readiness convergence ─────────────────────────────
// The first formal QC round should not be the first actor to check the semantic
// expectations that only a reviewer sees: factual_accuracy, behavioral naturalness,
// source-local coherence, quiz/key derivability, and cross-unit bleed. The write
// phase already self-scores, but each writer is blind to the final QC pack and to
// sibling-side domain bleed. This read-only scout uses the SAME evidence shape QC
// receives (chapters + source-v2 sidecars + source-verify record) and emits surgical
// chapter repairs before the expensive independent QC round opens. It never marks a
// chapter publishable and never weakens QC; it aligns draft content to the bar.

function buildPreQcAlignmentScoutTask(bookId: string): string {
  return `You are a READ-ONLY pre-QC readiness auditor for bookId ${bookId}. Your job is to make the FIRST FORMAL QC round boring: no factual_accuracy, behavioral_naturalness, source-local coherence, cross-unit bleed, or obvious quiz/card defects should remain. Do NOT edit files. Do NOT certify publishability. This is not QC; it is write-phase calibration to QC expectations.

Read:
- every chapter file: state/chapters/${bookId}-ch*.v21-native.chapter.json
- every source-v2 sidecar for this book under .chapterflow/runs/${bookId}/**/sidecars/source/ch*.source.json
- .chapterflow/source-verify-${bookId}.md when present
- state/authoring-cards/${bookId}/ch*.authoring-card.md only as context for dealt constraints

Audit for defects that a formal QC reviewer would REVISE or CORRUPTION on:
1. factual_accuracy: every load-bearing fact, date, count, duration, number-word (four, six), named-framework member, source attribution, quote, and institutional scale claim must be present in the source sidecar AND, for numbers/specifics, visible in either sourceFacts/testableFacts/hardSpecifics or the source-verify record. If the draft uses a precise claim not exposed to QC, instruct the repair to remove/soften it or move to a source-supported wording; do NOT invent new source.
2. behavioral_naturalness: tryThisNow, 24-hour challenge, weekly practice, and whatToDo must be a plausible low-friction action a real reader could do in the named situation. Flag symbolic theater (walking a loop, placing plans on counters, rehearsing a peak without doing the useful thing).
3. source-local coherence: every sentence in an example must belong to that example's domain. Flag cross-unit bleed where a clinic suddenly mentions ride/rent, a classroom mentions overdraft, an office scene imports a sibling's venue, or a stakes-menu item is forced into the wrong scene.
4. repeated source stamping: a real source case may be introduced with location/date/scale once, but repeated Moline/San Diego/1837/1955/headcount/hospital-count stamps across examples or chapters should be reduced unless the detail does new explanatory work.
5. quiz/card/implementation basics: keyed answer must be derivable from source facts, choices must be same kind of answer, card back must answer its front, and implementation actions must be concrete rather than inspirational.
6. prose coherence: flag only real incoherence, contradiction, missing referent, or sentence-level word salad. Do not flag style preferences.

Be surgical. For each issue, name the single chapter to edit, the unit/path when obvious, a short quote, and a fix instruction. Prefer fewer high-confidence repairs over broad advice. If a detail is truly source-supported but merely missing from sourceFacts, say so explicitly; the pipeline now exposes namedExample hardSpecifics to QC, so do not ask the repair agent to delete verified hard specifics just because they are not testableFacts.

Output ONLY a single JSON object as your final message, fenced as \`\`\`json. Shape:
{
  "clean": true,
  "repairs": []
}
or:
{
  "clean": false,
  "repairs": [
    {
      "chapter": 5,
      "family": "source_local_coherence",
      "unit": "examples[3].whyItMatters",
      "quote": "Peak and ending ratings would show where the ride leaves and rent money may hit overdraft fees.",
      "problem": "Clinic discharge example imports ride/rent imagery from another unit, so the sentence is incoherent.",
      "instruction": "Replace the sentence with clinic-specific consequences such as discharge confusion, missed-dose risk, checkout complaints, and follow-up calls. Preserve the source anchor and do not change quiz keys."
    }
  ]
}
No markdown outside that JSON fence.`;
}

async function scoutPreQcAlignment(bookId: string, deps: AutopilotDeps): Promise<PreQcAlignmentRepair[]> {
  let r: CodexAgentResult;
  try {
    r = await spawnAndLog(bookId, { task: buildPreQcAlignmentScoutTask(bookId), sessionId: deps.mkSessionId("pre-qc-readiness-scout"), cwd: PIPELINE_DIR, sandbox: "read-only" as CodexSandbox, skipGitRepoCheck: true, reasoningEffort: "high" }, deps);
  } catch (e) {
    deps.log(`[autopilot] pre-QC readiness scout spawn error: ${(e as Error)?.message ?? String(e)} — advancing to QC`);
    return [];
  }
  if (!r.ok) { deps.log(`[autopilot] pre-QC readiness scout exited ${r.exitCode} — advancing to QC`); return []; }
  const json = extractSubmissionJson(r.stdout) ?? extractSubmissionJson(r.finalMessage);
  if (!json) { deps.log("[autopilot] pre-QC readiness scout: no parseable brief in output — advancing to QC"); return []; }
  let brief: { clean?: boolean; repairs?: unknown };
  try { brief = JSON.parse(json); } catch { deps.log("[autopilot] pre-QC readiness scout: brief JSON did not parse — advancing to QC"); return []; }
  if (!brief || brief.clean === true || !Array.isArray(brief.repairs)) return [];

  const byChapter = new Map<number, PreQcAlignmentRepair>();
  for (const raw of brief.repairs as Array<Record<string, unknown>>) {
    const chapter = Number(raw?.chapter);
    const problem = typeof raw?.problem === "string" ? raw.problem.trim() : "";
    const instruction = typeof raw?.instruction === "string" ? raw.instruction.trim() : "";
    if (!Number.isInteger(chapter) || chapter < 1 || !problem || !instruction) continue;
    const repair: PreQcAlignmentRepair = {
      chapter,
      family: typeof raw?.family === "string" ? raw.family.trim() : undefined,
      unit: typeof raw?.unit === "string" ? raw.unit.trim() : undefined,
      quote: typeof raw?.quote === "string" ? raw.quote.trim() : undefined,
      problem,
      instruction,
    };
    const prior = byChapter.get(chapter);
    if (!prior) byChapter.set(chapter, repair);
    else {
      byChapter.set(chapter, {
        chapter,
        family: [prior.family, repair.family].filter(Boolean).join(" + ") || undefined,
        unit: [prior.unit, repair.unit].filter(Boolean).join("; ") || undefined,
        quote: [prior.quote, repair.quote].filter(Boolean).join(" | ") || undefined,
        problem: `${prior.problem}\n- ${repair.problem}`,
        instruction: `${prior.instruction}\n- ${repair.instruction}`,
      });
    }
    if (byChapter.size >= PREQC_MAX_ALIGNMENT_REPAIRS_PER_PASS) break;
  }
  return [...byChapter.values()];
}

async function surgicalPreQcAlignmentRepair(bookId: string, repairs: PreQcAlignmentRepair[], deps: AutopilotDeps, pass: number, maxParallel: number): Promise<void> {
  const writeCards = deps.listWriteCards(bookId);
  const pad = (n: number) => String(n).padStart(2, "0");
  await mapWithConcurrency(repairs, Math.max(1, maxParallel), async (rw) => {
    const n = rw.chapter;
    const card = writeCards.find((c) => chapterNumberFromCard(c) === n);
    const dealt = card ? `\n\n--- DEALT AUTHORING CARD ch${pad(n)} (preserve these constraints while repairing) ---\n${deps.readTask(card)}` : "";
    const task = `PRE-QC READINESS REPAIR — edit ONLY ch${pad(n)} of ${bookId}. This is a calibration repair BEFORE the formal QC round, so the first QC pass does not discover a preventable factual/coherence/naturalness defect.

Edit ONLY state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json. Do NOT edit other chapters, QC artifacts, attestations, pipeline code, source-verify records, source sidecars, prompts, or gates. Do not mark anything publishable. Preserve quiz keys unless the defect explicitly says a key is wrong and the source facts support changing it. Preserve source anchors where possible; if a claim is not source-supported, remove/soften the claim rather than inventing source.

FAMILY: ${rw.family ?? "pre_qc_alignment"}
UNIT/PATH: ${rw.unit ?? "inspect the quoted unit and nearby reader-facing fields"}
QUOTE: ${rw.quote ?? "(no quote supplied — inspect the described unit)"}
PROBLEM: ${rw.problem}
RECOMMENDED FIX: ${rw.instruction}

Repair principles:
- factual_accuracy: every precise number/date/duration/count/proper-noun scale claim must be in the source sidecar/source-verify evidence or be removed/softened.
- behavioral_naturalness: replace symbolic rituals with one plausible action the reader would actually take in context.
- source-local coherence: every sentence must belong to this scene's domain; remove stakes-menu or sibling-scene bleed.
- source stamping: keep location/scale where it anchors the case, delete repeated metadata where it does no new work.

After editing, run:
  npx tsx src/cli.ts gate-chapter state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json
  npx tsx src/cli.ts qc-converge ${bookId}
Both must stay clean before you report done.${dealt}`;
    const sid = deps.mkSessionId(`pre-qc-readiness-${pass}-ch${n}`);
    const r = await spawnAndLog(bookId, { task, sessionId: sid, cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
    if (!r.ok) deps.log(`[autopilot] pre-QC readiness repair ch${n} exited ${r.exitCode}`);
    try { recordAuthorProvenance(`${bookId}-ch${pad(n)}`, sid, chapterContentHashByNumber(bookId, n)); }
    catch { /* provenance unchanged (no-op repair) — best-effort */ }
  });
}

// ── Phase: qc (headless round + bounded repair loop) ──────────────────────────

/** Returns an outcome to STOP on (halt), or null to RE-LOOP (round passed → status
 *  advances to ready). The repair loop honors qc-diagnose governance + stuck-detect. */
// ── Pre-QC readiness convergence (cross-chapter VARIETY + semantic ALIGNMENT) ────────
// These two scouts de-templatize a book BEFORE the first QC round (the "first-pass-QC" lever).
// doGate runs them inline — but decidePhase SKIPS the gate phase for a book that gates
// deterministically-clean straight out of the compiler write phase (allGated → "qc"), so on a
// clean-gating book the VARIETY scout never ran and the book reached QC still carrying
// cross-chapter house-voice sameness (the exact "every example is the same beat with a rotating
// cast" churn a book-score panel gate-flagged on the-power-of-moments, which every per-chapter
// gate passed because those checks are lexical, not semantic). This helper runs that same
// bounded, read-only + surgical convergence from the QC phase so it fires for EVERY architecture
// whether or not doGate was visited. It NEVER weakens QC (which still runs after and stays the
// sole pass/block authority) and only emits surgical per-chapter edits, re-running qc-converge
// after each so a detemplate/alignment edit that introduces a deterministic blocker halts here
// instead of silently reaching QC. Mirrors doGate's variety↔alignment oscillation bounds
// (PREQC_MAX_*/combinedScoutPasses). Returns { halt, edited }: halt !== null → stop the run;
// edited=true → chapters were rewritten, so the caller forces a fresh QC sweep (no stale carry).
async function convergePreQcReadiness(
  bookId: string,
  maxParallel: number,
  deps: AutopilotDeps,
  heartbeat: () => boolean,
): Promise<{ halt: AutopilotOutcome | null; edited: boolean }> {
  let varietyPasses = 0;
  let varietyConverged = false;
  let alignmentPasses = 0;
  let combinedScoutPasses = 0;
  let edited = false;
  const scoutEditSignatures: string[] = [];
  const maxIterations = PREQC_MAX_VARIETY_PASSES + PREQC_MAX_ALIGNMENT_PASSES + PREQC_MAX_COMBINED_SCOUT_PASSES + 4;
  for (let i = 0; i < maxIterations; i++) {
    if (!heartbeat()) {
      return { halt: mkHalt(bookId, "qc", "infra", `lost the run lock for ${bookId} during pre-QC readiness convergence — halting to avoid two conductors on the same book.`), edited };
    }
    if (!varietyConverged) {
      // Sweep-unified scout: clean → converge; blocking → detemplate up to the budget; blocking that
      // SURVIVES the budget → FAIL CLOSED (halt content), never proceed to a QC round the sweep would
      // fail — unless CHAPTERFLOW_PREQC_SCOUT=advisory restores the old proceed-to-QC behavior.
      const scout = await scoutCrossChapterVariety(bookId, deps);
      persistPreflightScoutRead(bookId, scout, deps);
      if (!scout.blockingFindings.length) {
        varietyConverged = true;
        deps.log(`[autopilot] pre-QC variety: book reads varied (no cross-chapter templating) → continuing to QC-readiness audit`);
      } else if (varietyPasses >= PREQC_MAX_VARIETY_PASSES) {
        if (preQcScoutEnforced()) return { halt: mkHalt(bookId, "qc", "content", scoutHaltReason(bookId, scout)), edited };
        deps.log(`[autopilot] pre-QC variety: ${scout.blockingFindings.length} blocking finding(s) remain after ${varietyPasses} detemplate pass(es); CHAPTERFLOW_PREQC_SCOUT=advisory → proceeding to QC (safety net)`);
        varietyConverged = true;
      } else {
        combinedScoutPasses++;
        scoutEditSignatures.push(`variety:${scout.rewrites.map((rw) => `ch${rw.chapter}`).sort().join(",")}`);
        if (combinedScoutPasses > PREQC_MAX_COMBINED_SCOUT_PASSES) {
          return { halt: mkHalt(bookId, "qc", "progress", `pre-QC variety/alignment oscillation: chapter(s) flip between variety and alignment findings after ${combinedScoutPasses} combined scout passes (budget ${PREQC_MAX_COMBINED_SCOUT_PASSES}) — ${scoutEditSignatures.slice(-4).join(" → ")}. A variety edit is reliably re-triggering an alignment finding (or vice-versa); escalate / inspect: npx tsx src/cli.ts qc-converge ${bookId}`), edited };
        }
        varietyPasses++;
        deps.log(`[autopilot] pre-QC variety pass ${varietyPasses}/${PREQC_MAX_VARIETY_PASSES}: differentiating ${scout.rewrites.length} chapter(s) before QC — ${scout.rewrites.map((rw) => `ch${rw.chapter}`).join(", ")}`);
        await surgicalDetemplate(bookId, scout.rewrites, deps, varietyPasses, maxParallel);
        edited = true;
        const c = await deps.runVerb(["qc-converge", bookId]);
        if (c.code >= 2) return { halt: mkHalt(bookId, "qc", "infra", `qc-converge errored (exit ${c.code}) after pre-QC variety detemplate — inspect: ${(c.stderr || c.stdout).slice(0, 300)}`), edited };
        if (c.code !== 0) return { halt: mkHalt(bookId, "qc", "content", `pre-QC variety detemplate introduced deterministic findings — run: npx tsx src/cli.ts qc-converge ${bookId}`), edited };
        alignmentPasses = 0; // content changed; re-run semantic readiness after variety settles
        continue;
      }
    }
    if (alignmentPasses < PREQC_MAX_ALIGNMENT_PASSES) {
      alignmentPasses++;
      const repairs = await scoutPreQcAlignment(bookId, deps);
      if (repairs.length) {
        combinedScoutPasses++;
        scoutEditSignatures.push(`alignment:${repairs.map((rw) => `ch${rw.chapter}`).sort().join(",")}`);
        if (combinedScoutPasses > PREQC_MAX_COMBINED_SCOUT_PASSES) {
          return { halt: mkHalt(bookId, "qc", "progress", `pre-QC variety/alignment oscillation: chapter(s) flip between variety and alignment findings after ${combinedScoutPasses} combined scout passes (budget ${PREQC_MAX_COMBINED_SCOUT_PASSES}) — ${scoutEditSignatures.slice(-4).join(" → ")}. An alignment edit is reliably re-triggering a variety finding (or vice-versa); escalate / inspect: npx tsx src/cli.ts qc-converge ${bookId}`), edited };
        }
        deps.log(`[autopilot] pre-QC readiness pass ${alignmentPasses}/${PREQC_MAX_ALIGNMENT_PASSES}: repairing ${repairs.length} QC-alignment issue(s) before formal QC — ${repairs.map((rw) => `ch${rw.chapter}`).join(", ")}`);
        await surgicalPreQcAlignmentRepair(bookId, repairs, deps, alignmentPasses, maxParallel);
        edited = true;
        const c = await deps.runVerb(["qc-converge", bookId]);
        if (c.code >= 2) return { halt: mkHalt(bookId, "qc", "infra", `qc-converge errored (exit ${c.code}) after pre-QC readiness repair — inspect: ${(c.stderr || c.stdout).slice(0, 300)}`), edited };
        if (c.code !== 0) return { halt: mkHalt(bookId, "qc", "content", `pre-QC readiness repair introduced deterministic findings — run: npx tsx src/cli.ts qc-converge ${bookId}`), edited };
        varietyPasses = 0; varietyConverged = false; // semantic repair can introduce new cross-chapter echoes; re-scout once
        continue;
      }
      deps.log(`[autopilot] pre-QC readiness pass ${alignmentPasses}: semantic/factual alignment clean → advancing to QC`);
    }
    return { halt: null, edited };
  }
  return { halt: null, edited }; // budget exhausted → advance best-effort (QC remains the authority)
}

async function doQcWithRepair(bookId: string, maxRepair: number, maxParallel: number, deps: AutopilotDeps, heartbeat: () => boolean = () => true, flipTracker: GateQcFlipTracker = newGateQcFlipTracker(), preQcScoutsConverged = false): Promise<AutopilotOutcome | null> {
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
  // Run the pre-QC readiness scouts (cross-chapter VARIETY + semantic ALIGNMENT) ONCE before the
  // first QC round when doGate did NOT already converge them this session (preQcScoutsConverged).
  // decidePhase skips the gate phase for a book that gates clean straight out of write (allGated →
  // "qc"), and a resumed run can enter QC directly from a prior process — in both cases doGate's
  // inline scouts never ran, so the book would otherwise hit QC still carrying cross-chapter
  // house-voice sameness (the variety scout is the churn lever a book-score panel flags). This is
  // the same bounded, read-only + surgical convergence; qc-converge is re-run inside after each edit.
  let preQcReadinessChecked = false;
  const MAX_CONFIRM_ROUNDS = 2;
  for (let attempt = 0; attempt <= maxRepair; attempt++) {
    // Refresh the run lock at each round boundary: a full QC iteration (initial round + repair
    // rounds, each many 30-min codex sessions) can run for HOURS, past the cross-host stale
    // window. If refresh reports we no longer own the lock (a successor took over), HALT rather
    // than keep two conductors driving the same book.
    if (!heartbeat()) {
      return mkHalt(bookId, "qc", "infra", `lost the run lock for ${bookId} mid-QC (ownership taken over OR heartbeat write failed) — halting to avoid two conductors on the same book.`);
    }
    if (!preQcReadinessChecked && !preQcScoutsConverged) {
      preQcReadinessChecked = true;
      const res = await convergePreQcReadiness(bookId, maxParallel, deps, heartbeat);
      if (res.halt) return res.halt;
      if (res.edited) {
        forceFreshSweep = true; // re-read the rewritten chapters instead of carrying stale passes
        attempt--; // pre-QC readiness is not a QC repair round; do not consume repair budget
        continue;
      }
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
      const drivers = round.roundId ? summarizeRoundDrivers(bookId, round.roundId) : "";
      if (round.note === "needs-more-qc") {
        return mkHalt(bookId, "qc", "content", `QC round ${round.roundId} NEEDS_MORE_QC after reviewer retry — no reviewer process is missing, but one or more chapters still lack certifiable publishable evidence. Drivers: ${drivers || "see qc-diagnose"}. Inspect: npx tsx src/cli.ts qc-diagnose ${bookId} --round ${round.roundId}`);
      }
      return mkHalt(bookId, "qc", "infra", `QC round ${round.roundId} INCOMPLETE (${round.note}) after a narrow retry — a reviewer artifact may be missing/stale. Drivers: ${drivers || "see qc-diagnose"}. Inspect: npx tsx src/cli.ts qc-diagnose ${bookId} --round ${round.roundId}`);
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
    // Gate↔QC flip check: this round's REVISE signature already surfaced in a previous QC visit
    // THIS run, with a gate visit in between (gate "fixed" a deterministic blocker, advanced here,
    // and this QC round re-surfaced the identical finding) — gate and QC are fighting over the
    // same finding rather than converging. Catch it the instant it recurs, not after the outer
    // 40-iteration backstop.
    const qcSig = [...sigs].sort().join("|");
    const flip = recordGateQcSignature(flipTracker, "qc", qcSig);
    if (flip) {
      return mkHalt(bookId, "qc", "progress", `gate/QC flip on ${flip.slice(0, 300)}: this QC finding already surfaced in an earlier round this run, was sent back through the gate phase, and has now recurred identically — escalate. Round: ${round.roundId}`);
    }

    // P10 — CLASS-ROUTED REPAIR (runs BEFORE the surgical fan-out): a templating finding whose
    // cause is a dealt slot (scene frame / venue / name / quiz-card shape) is re-dealt at its
    // blueprint source and its section artifact regenerated, so a re-assembly can't resurrect the
    // defect; a templated-SOURCE finding escalates (halt → re-research). The remaining prose-local
    // findings drop through to the existing surgical fan-out below. Env-gated + fail-safe (a book
    // with no ledger/artifacts on disk is a no-op), so this never destabilizes the surgical path.
    const routedHalt = await runRoutedRedeals(bookId, round.roundId, deps, { heartbeat });
    if (routedHalt) return routedHalt;

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
    // P10 — ARTIFACT SYNC: a surgical edit changed the ChapterV21 on disk, but its section artifacts
    // still hold the pre-edit text. Write the edited FIELDS back into their owning artifacts and
    // prove the round trip (re-assembly reproduces the edited chapter's content hash); HALT on a
    // genuine mismatch rather than ship drifted artifacts a later re-assembly would resurrect.
    // Only the chapters this fan-out actually changed; enforce-only + no-op for a non-compiler book.
    const editedChapters = Object.keys(postHashes).filter((n) => preHashes[n] !== undefined && preHashes[n] !== postHashes[n]).map(Number);
    if (editedChapters.length) {
      const syncHalt = runArtifactSync(bookId, editedChapters, deps);
      if (syncHalt) return syncHalt;
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
    ledgerOpenCount: () => ledgerStatus(bookId, roundId).summary.open ?? 0,
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

/** The exact manual ship command printed at a --no-publish READY halt. v24 author arch
 *  ships via the ONE-VERB publish-final (bridge → commit → push → origin-sync 0/0 → debris
 *  cleanup — it commits the OUTER-root live package, NOT the sandbox-nested paths
 *  publish-after-qc commits, the repo-pollution source). compiler/legacy keep
 *  publish-after-qc. Exported for the wiring test. */
export function readyPublishCommand(bookId: string, roundId: string | undefined, architecture: "compiler" | "legacy" | "author"): string {
  if (architecture === "author") return `npx tsx src/cli.ts publish-final "${bookId}"`;
  return roundId
    ? `npx tsx src/cli.ts publish-after-qc "${bookId}" --round ${roundId} --commit --push`
    : `npx tsx src/cli.ts publish "${bookId}"`;
}

async function handleReady(bookId: string, status: BookStatus, autoPublish: boolean, deps: AutopilotDeps, architecture: "compiler" | "legacy" | "author"): Promise<AutopilotOutcome> {
  // Find the round that produced the PUBLISHABLE attestations (most recent matrix).
  const roundId = deps.latestRoundId(bookId) ?? undefined;
  const isAuthor = architecture === "author";
  if (!autoPublish) {
    const cmd = readyPublishCommand(bookId, roundId, architecture);
    return {
      status: "ready",
      bookId,
      roundId,
      message: `READY TO PUBLISH — all ${status.writtenChapters} chapters gated + QC PUBLISHABLE. Review, then ship:\n  ${cmd}`,
    };
  }

  // ── AUTHOR arch: publish-final (commit → push → sync → cleanup) ──
  if (isAuthor) {
    const pf = await deps.runVerb(["publish-final", bookId]);
    if (pf.code !== 0) return mkHalt(bookId, "ready", "infra", `publish-final failed (exit ${pf.code}): ${(pf.stderr || pf.stdout).slice(0, 300)}`);
    // publish-final prints its own DEPLOY REQUIRED block; echo the one-line
    // pointer here so the conductor's own outcome names the owed deploy + the
    // machine-checkable clear command (FINAL-HARDENING-PLAN 2026-07-04).
    return {
      status: "published",
      bookId,
      roundId: roundId ?? "",
      message: `PUBLISHED — publish-final shipped ${bookId}: package committed + pushed, origin synced 0/0, per-book debris cleaned. ⚠ NOT live until the separate manual deploy — run the 3 steps printed above (upload-book-packages-to-s3 → gh workflow run deploy.yml → npm run verify:live); ${bookId} stays tracked in book-packages/.pending-deploy.json until verify:live confirms parity.`,
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

function planOnly(bookId: string, deps: AutopilotDeps, opts: Pick<AutopilotOptions, "regen" | "architecture" | "autoPublish">): AutopilotOutcome {
  const regen = opts.regen ?? false;
  const architecture = opts.architecture; // required — no silent default (see AutopilotOptions)
  const autoPublish = opts.autoPublish ?? false;
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
  const writeSessions = phase === "research" || phase === "write"
    ? (architecture === "compiler" ? toWrite * 4 : toWrite)
    : 0;
  const writeLabel = architecture === "compiler"
    ? `${writeSessions} (${toWrite} chapter(s) × 4 bounded section artifacts)`
    : `${writeSessions} (one per remaining chapter)`;
  const publishLabel = autoPublish
    ? "AUTO on convergence (full promote gate, then commit+push to main)"
    : "OFF (--no-publish: halt at ready-to-publish for manual review)";
  const lines = [
    `AUTOPILOT PLAN — ${bookId}`,
    `  current phase: ${phase}`,
    `  architecture: ${architecture === "compiler" ? "v23 compiler" : architecture === "author" ? "v24 author (whole-chapter author + reader review)" : "legacy whole-chapter writer"}`,
    `  codex sessions that WOULD spawn from here (estimate):`,
    `    research: ${phase === "research" ? 1 : 0}`,
    `    write:    ${writeLabel}`,
    `    qc round: base ~${firstWave} (sweep + keyA + keyB + major-triage + ${N}×bar)`,
    `              + up to 2 tiebreak reads per BORDERLINE chapter (≤${2 * N})`,
    `              + up to 1 confirm read per publishable candidate (≤${N})`,
    `              = ≤${perRoundMax} sessions/round worst case (typical: far lower)`,
    `              ×(1 initial + up to 3 repair rounds)`,
    `  publish: ${publishLabel}`,
    `  ${NOT_METERED_MESSAGE} — every session runs via codex exec on the subscription, not billed API tokens.`,
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
