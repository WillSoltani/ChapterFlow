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
 *  - Publish is human-gated: the conductor HALTS at "ready to publish" unless
 *    --auto-publish is set (and even then never commits/pushes on its own).
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
import { REPO_ROOT } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { loadBookChapters, keyPackDir } from "../qc/manualKeyJudge.js";
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
import { sweepPackPath } from "../qc/sweep.js";
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
export function decidePhase(s: BookStatus): AutopilotPhase {
  if (s.packaged) return "shipped";
  const allWritten = s.expectedChapters != null && s.writtenChapters >= s.expectedChapters && s.writtenChapters > 0;
  const allGated = allWritten && s.gatedChapters === s.writtenChapters && s.bookGatePass === true;
  const allQcd = allWritten && s.qcdChapters === s.writtenChapters;
  if (allGated && allQcd) return "ready"; // == publishable && !packaged
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
  maxRepairRounds?: number; // default 3
  maxParallel?: number; // default 6
  autoPublish?: boolean; // default false → HALT at ready-to-publish
  plan?: boolean; // dry-run: print the spawn plan, take no action
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
  | { status: "published"; bookId: string; roundId: string }
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
      try { const tmp = `${path}.hb-${owner}`; writeFileSync(tmp, mkRecord(), "utf8"); renameSync(tmp, path); } catch { return false; }
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

export async function runAutopilot(opts: AutopilotOptions): Promise<AutopilotOutcome> {
  const deps = resolveDeps(opts.deps);
  const bookId = opts.bookId;
  const maxRepair = opts.maxRepairRounds ?? 3;
  const maxParallel = opts.maxParallel ?? 6;
  const autoPublish = opts.autoPublish ?? false;

  if (opts.plan) return planOnly(bookId, deps);

  // Same-book lock: refuse to start if another run holds it (prevents two conductors
  // racing the same book's state). Released in `finally` on every exit path.
  const lock = deps.acquireLock(bookId);
  if (!lock.ok) {
    return mkHalt(bookId, safePhase(bookId, deps), "infra", `could not acquire the run lock for ${bookId} (${lock.heldBy ?? "unknown"}). If a previous run died, remove state/autopilot-locks/${bookId}.lock and retry.`);
  }
  deps.log(`[autopilot] strict invariants ENFORCED (no-API · source-verify-required · session-independence); lock acquired for ${bookId}`);

  try {
    let lastSignature = "";
    for (let iter = 0; iter < MAX_LOOP_ITERS; iter++) {
      // Heartbeat: keep our lock fresh AND detect a steal. If refresh() reports we no
      // longer own it (a successor took over after our heartbeat went stale), HALT rather
      // than keep conducting — never two conductors driving the same book.
      if (lock.refresh && !lock.refresh()) {
        return mkHalt(bookId, safePhase(bookId, deps), "infra", `lost the run lock for ${bookId} mid-run (ownership taken over OR heartbeat write failed) — halting to avoid two conductors on the same book.`);
      }
      const status = deps.statusOf(bookId);
      const phase = decidePhase(status);
      const sig = `${phase}:${status.writtenChapters}/${status.expectedChapters ?? "?"}:${status.gatedChapters}:${status.qcdChapters}`;
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
        await doWrite(bookId, status, maxParallel, deps);
        continue;
      }
      if (phase === "gate") {
        const halt = await doGate(bookId, maxRepair, deps);
        if (halt) return halt;
        continue;
      }
      if (phase === "qc") {
        const result = await doQcWithRepair(bookId, maxRepair, maxParallel, deps);
        if (result) return result; // halt or ready handled inside; null = re-loop
        continue;
      }
    }
    return mkHalt(bookId, safePhase(bookId, deps), "progress", `loop iteration cap (${MAX_LOOP_ITERS}) hit — likely a stuck phase`);
  } catch (err) {
    // A codex spawn rejection (timeout / ENOENT) or any unexpected throw becomes a
    // structured infra halt with a resume hint — never an unhandled rejection that
    // crashes the walk-away run with a bare stack trace.
    return mkHalt(bookId, safePhase(bookId, deps), "infra", `unexpected failure: ${(err as Error)?.message ?? String(err)} — re-run \`book-autopilot ${bookId}\` to resume from the current phase (logs: state/autopilot-logs/${bookId}).`);
  } finally {
    lock.release();
  }
}

/** decidePhase guarded against a statusOf that itself throws (used only in halt/error paths). */
function safePhase(bookId: string, deps: AutopilotDeps): AutopilotPhase {
  try { return decidePhase(deps.statusOf(bookId)); } catch { return "research"; }
}

// ── Phase: research ──────────────────────────────────────────────────────────

async function doResearch(bookId: string, deps: AutopilotDeps): Promise<boolean> {
  const promptPath = resolve(AGENT_PROMPTS_DIR, "RESEARCH-CODEX-SESSION.md");
  const task = `${deps.readTask(promptPath)}\n\n---\nRun the research phase for bookId: ${bookId}. Follow the playbook above until book-status reports the write phase.`;
  deps.log(`[autopilot] research: spawning 1 codex session for ${bookId}`);
  const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId("research"), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
  if (!r.ok) deps.log(`[autopilot] research session exited ${r.exitCode}: ${r.stderr.slice(0, 300)}`);
  return r.ok;
}

// ── Phase: write (fan out one agent per MISSING chapter) ──────────────────────

async function doWrite(bookId: string, status: BookStatus, maxParallel: number, deps: AutopilotDeps): Promise<void> {
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
    const n = chapterNumberFromCard(card);
    const task = `${deps.readTask(card)}\n\n---\nYou are a fresh Writer subagent for bookId ${bookId}, chapter ${n}. Author the chapter per the dispatch card above, then run author-check + gate-chapter until clean.`;
    const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId(`write-ch${n}`), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
    if (!r.ok) deps.log(`[autopilot] write ch${n} session exited ${r.exitCode}`);
    return r;
  });
}

// ── Phase: gate (repair ship/book-gate blockers, bounded) ─────────────────────

async function doGate(bookId: string, maxRepair: number, deps: AutopilotDeps): Promise<AutopilotOutcome | null> {
  for (let attempt = 1; attempt <= maxRepair; attempt++) {
    const converge = await deps.runVerb(["qc-converge", bookId]);
    if (converge.code === 0) return null; // DETERMINISTIC-CLEAN → re-loop (advances to qc)
    // exit 1 = dirty content (repair); exit ≥2 = qc-converge itself errored (no chapters,
    // bad args, internal) — that's infra, NOT a reason to tell an agent to edit content.
    if (converge.code >= 2) return mkHalt(bookId, "gate", "infra", `qc-converge errored (exit ${converge.code}) — not a content problem; inspect: ${(converge.stderr || converge.stdout).slice(0, 300)}`);
    deps.log(`[autopilot] gate repair attempt ${attempt}/${maxRepair} — converging deterministic gates`);
    const task = `Fix the DETERMINISTIC gate findings below for bookId ${bookId} by editing chapter CONTENT only (state/chapters/), then run \`npx tsx src/cli.ts qc-converge ${bookId}\` until it reports DETERMINISTIC-CLEAN. Fix EVERY finding in one pass. Do NOT edit pipeline code/config.\n\n${converge.stdout}`;
    const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId(`gate-repair-${attempt}`), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
    if (!r.ok) deps.log(`[autopilot] gate repair session exited ${r.exitCode}`);
  }
  const final = await deps.runVerb(["qc-converge", bookId]);
  if (final.code === 0) return null;
  if (final.code >= 2) return mkHalt(bookId, "gate", "infra", `qc-converge errored (exit ${final.code}) after ${maxRepair} repair rounds — inspect: ${(final.stderr || final.stdout).slice(0, 300)}`);
  return mkHalt(bookId, "gate", "content", `deterministic gates still DIRTY after ${maxRepair} repair rounds — escalate. Run: npx tsx src/cli.ts qc-converge ${bookId}`);
}

// ── Phase: qc (headless round + bounded repair loop) ──────────────────────────

/** Returns an outcome to STOP on (halt), or null to RE-LOOP (round passed → status
 *  advances to ready). The repair loop honors qc-diagnose governance + stuck-detect. */
async function doQcWithRepair(bookId: string, maxRepair: number, maxParallel: number, deps: AutopilotDeps): Promise<AutopilotOutcome | null> {
  let prevSignatures = new Set<string>();
  for (let attempt = 0; attempt <= maxRepair; attempt++) {
    // First round is full; repair rounds (attempt>0) re-review only the chapters the
    // repair changed (incremental — book-wide sweep + gates still run over the whole
    // book). Tiebreak is ON for EVERY round: it only costs extra reads for BORDERLINE
    // chapters, and the driver's dynamic-wave loop now actually reviews the t2/t3 cards —
    // so a borderline INITIAL round smooths the variance instead of forcing a needless
    // repair (it used to be repair-only, which was a no-op since the cards never ran).
    const round = await driveQcRound(bookId, maxParallel, deps, { incremental: attempt > 0, tiebreak: true });
    if (round.verdict === "ERROR" || !round.roundId) {
      return mkHalt(bookId, "qc", "infra", `could not open/finalize a QC round (${round.note})`);
    }
    if (round.verdict === "INTEGRITY") {
      return mkHalt(bookId, "qc", "integrity", `${round.note} Inspect state/autopilot-logs/${bookId} to find the offending reviewer session, then re-run.`);
    }
    if (round.verdict === "PASS") {
      deps.log(`[autopilot] QC PASS on round ${round.roundId}`);
      return null; // re-loop → ready
    }
    if (round.verdict === "INCOMPLETE") {
      return mkHalt(bookId, "qc", "infra", `QC round ${round.roundId} INCOMPLETE (reviewer submissions still missing after a narrow retry) — a reviewer agent likely failed. Inspect: npx tsx src/cli.ts qc-diagnose ${bookId} --round ${round.roundId}`);
    }
    // REVISE → repair, but never past the bound and never without diagnose.
    if (attempt === maxRepair) {
      return mkHalt(bookId, "qc", "content", `QC still REVISE after ${maxRepair} repair rounds — escalate (likely a source/research limitation). Last round: ${round.roundId}`);
    }
    const diagnose = await deps.runVerb(["qc-diagnose", bookId, "--round", round.roundId]);
    deps.log(`[autopilot] qc-diagnose (round ${round.roundId}):\n${diagnose.stdout.slice(0, 600)}`);
    if (/major-disposition/.test(diagnose.stdout)) {
      return mkHalt(bookId, "qc", "governance", `a MAJOR finding needs human disposition (waive vs fix) — the autopilot never auto-waives. Review: npx tsx src/cli.ts qc-diagnose ${bookId} --round ${round.roundId}`);
    }
    const sigs = findingSignatures(diagnose.stdout);
    if (attempt > 0 && noProgress(prevSignatures, sigs)) {
      return mkHalt(bookId, "qc", "progress", `repair made NO progress (same findings survived a content edit) — escalate. Round: ${round.roundId}`);
    }
    prevSignatures = sigs;

    // Spawn ONE repair writer with the generated repair prompt, then converge
    // deterministically before the next (fresh) round — the treadmill-killer.
    const repairPromptPath = resolve(PIPELINE_DIR, "state", "qc-orchestrator", bookId, round.roundId, "repair-prompt.md");
    // Re-attach the DEALT authoring card for each flagged chapter. The repair brief gives the
    // per-unit WHAT (quote + expected fix); the card gives the per-slot HOW — the distinct
    // shape/venue/opener slots the deal computed. Without it a repair re-authors blind and
    // collapses sibling scenes onto a NEW shared shell (the documented homogenization that
    // feeds the templating the sweep then flags). Attaching it lets the writer restage onto
    // the variety that was already designed in.
    const flagged = flaggedChapterNumbers(bookId, round.roundId);
    const dealtCards = flagged.size
      ? deps.listWriteCards(bookId)
          .filter((c) => { const n = chapterNumberFromCard(c); return n != null && flagged.has(n); })
          .map((c) => `\n\n--- DEALT AUTHORING CARD ch${chapterNumberFromCard(c)} (restage onto THESE dealt shape/venue/opener slots — do NOT collapse the scenes onto a new shared frame) ---\n${deps.readTask(c)}`)
          .join("")
      : "";
    const repairTask = (existsSync(repairPromptPath)
      ? deps.readTask(repairPromptPath)
      : `Repair the QC findings for bookId ${bookId} round ${round.roundId} in chapter content, then run qc-converge ${bookId} until CLEAN.`) + dealtCards;
    deps.log(`[autopilot] QC repair attempt ${attempt + 1}/${maxRepair} on round ${round.roundId}`);
    // Collateral-edit guard: snapshot the GREEN (non-flagged) chapters' hashes. A repair that
    // edits a chapter carrying a passing review invalidates its attestation → forced re-review
    // → possible regression (the green->regress half of the 7->1 divergence). Warn loudly.
    const preHashes = deps.chapterHashes(bookId);
    const r = await spawnAndLog(bookId, { task: repairTask, sessionId: deps.mkSessionId(`qc-repair-${attempt + 1}`), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
    if (!r.ok) deps.log(`[autopilot] repair session exited ${r.exitCode}`);
    const postHashes = deps.chapterHashes(bookId);
    const collateral = Object.keys(postHashes).filter((n) => !flagged.has(Number(n)) && preHashes[n] !== undefined && preHashes[n] !== postHashes[n]);
    // Only warn when we actually know the flagged set (a found matrix); an empty `flagged`
    // means the matrix wasn't readable, and we can't distinguish collateral from intended.
    if (flagged.size && collateral.length) deps.log(`[autopilot] WARNING: repair collaterally edited non-flagged chapter(s) ${collateral.map((n) => `ch${n}`).join(", ")} — they carried a passing review and will be re-reviewed next round (possible regression). The repair brief scopes edits to the flagged chapters only.`);
    // Converge deterministic gates so the NEXT formal round won't bounce on a nit.
    for (let c = 0; c < maxRepair; c++) {
      const cv = await deps.runVerb(["qc-converge", bookId]);
      if (cv.code === 0) break;
      if (cv.code >= 2) return mkHalt(bookId, "qc", "infra", `qc-converge errored (exit ${cv.code}) during repair convergence — not a content problem; inspect: ${(cv.stderr || cv.stdout).slice(0, 300)}`);
      const cr = await spawnAndLog(bookId, { task: `Fix the remaining deterministic findings for ${bookId}, then qc-converge until CLEAN.\n\n${cv.stdout}`, sessionId: deps.mkSessionId(`qc-converge-fix-${attempt + 1}-${c}`), cwd: PIPELINE_DIR, sandbox: "workspace-write", writableRoots: WORK_WRITABLE_ROOTS }, deps);
      if (!cr.ok) break;
    }
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
async function driveQcRound(bookId: string, maxParallel: number, deps: AutopilotDeps, opts: { incremental: boolean; tiebreak: boolean }): Promise<QcRoundResult> {
  // Open the round + write first-wave task cards (also runs the deterministic preflight).
  const createArgs = ["qc-orchestrate", bookId, "--create"];
  if (opts.incremental) createArgs.push("--incremental");
  if (opts.tiebreak) createArgs.push("--tiebreak");
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
    finalize: async () => { const r = await deps.runVerb(["qc-orchestrate", bookId, "--finalize", "--round", roundId]); return parseFinalizeResult(r.stdout, r.code); },
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

/** Parse `qc-orchestrate --finalize` JSON stdout into a FinalizeQcRoundResult. Falls
 *  back to inferring the verdict from the exit code (0 PASS / 1 REPAIR / 3 INCOMPLETE)
 *  when stdout isn't the expected JSON — keeps the conductor robust. */
function parseFinalizeResult(stdout: string, code: number): FinalizeQcRoundResult {
  try {
    const j = JSON.parse(stdout) as Partial<FinalizeQcRoundResult>;
    if (j && typeof j.allPublishable === "boolean" && Array.isArray(j.chapters)) return j as FinalizeQcRoundResult;
  } catch { /* fall through to exit-code inference */ }
  return {
    ok: code === 0, allPublishable: code === 0, repairRequired: code === 1, incomplete: code === 3,
    evidenceMatrixPath: "", repairBriefPath: "", repairPromptPath: "",
    attestationsWritten: 0, chapters: [], errors: [],
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
  const attempt = async (taskText: string, sid: string, fileLabel: string): Promise<{ agentOk: boolean; json: string | null; submitOk: boolean; rejection?: string }> => {
    const r = await spawnAndLog(bookId, { task: taskText, sessionId: sid, cwd: ws.cwd, sandbox: "read-only" as CodexSandbox, skipGitRepoCheck: true }, deps);
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
  const pub = await deps.runVerb(["publish-after-qc", bookId, "--round", roundId]); // no --commit/--push: those stay explicit
  if (pub.code !== 0) return mkHalt(bookId, "ready", "infra", `publish-after-qc failed (exit ${pub.code}): ${(pub.stderr || pub.stdout).slice(0, 300)}`);
  return { status: "published", bookId, roundId };
}

// ── --plan dry-run (cost preview; takes NO action) ────────────────────────────

function planOnly(bookId: string, deps: AutopilotDeps): AutopilotOutcome {
  const status = deps.statusOf(bookId);
  const phase = decidePhase(status);
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
    `  publish: gated (stops at "ready to publish" unless --auto-publish)`,
    `  no API metering — every session runs via codex exec on the subscription.`,
  ];
  deps.log(lines.join("\n"));
  return { status: "ready", bookId, message: "(plan only — no action taken)" };
}

export function formatOutcome(o: AutopilotOutcome): string {
  switch (o.status) {
    case "shipped": return `AUTOPILOT — ${o.bookId}: already shipped (packaged).`;
    case "published": return `AUTOPILOT — ${o.bookId}: PUBLISHED from round ${o.roundId}.`;
    case "ready": return `AUTOPILOT — ${o.bookId}: ${o.message}`;
    case "halt": return `AUTOPILOT HALT — ${o.bookId} [phase ${o.phase} · ${o.category}]: ${o.reason}`;
  }
}
