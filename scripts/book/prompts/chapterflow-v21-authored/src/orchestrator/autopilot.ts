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
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, unlinkSync, appendFileSync } from "fs";
import { hostname } from "os";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { computeBookStatus, type BookStatus } from "../lifecycle/bookStatus.js";
import { STRICT_PIPELINE_ENV } from "../lib/strictEnv.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { spawnCodexAgent, type CodexAgentResult, type CodexSandbox } from "./codexAgent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const AGENT_PROMPTS_DIR = resolve(PIPELINE_DIR, "agent-prompts");
const STATE_CHAPTERS = resolve(PIPELINE_DIR, "state", "chapters");

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
  /** Acquire a same-book run lock so two autopilots can't race the same book.
   *  release() is idempotent; heldBy is set when acquisition FAILS. */
  acquireLock: (bookId: string) => { ok: boolean; release: () => void; heldBy?: string };
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
export function chapterNumberFromCard(path: string): number | null {
  const matches = [...path.matchAll(/ch0*(\d+)/gi)];
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
}

/** A role label for a card path, used to build a readable distinct session id. */
function roleLabelFromCard(path: string): string {
  const base = path.replace(/\\/g, "/").split("/").slice(-2).join("-").replace(/\.md$/i, "");
  return base.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
  return out;
}

/** The single spawn choke point: run one agent and persist its outcome (durable log).
 *  A spawn rejection (timeout/ENOENT) propagates to runAutopilot's try/catch → infra halt. */
async function spawnAndLog(bookId: string, opts: Parameters<SpawnAgent>[0], deps: AutopilotDeps): Promise<CodexAgentResult> {
  const r = await deps.spawn(opts);
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
      // First wave excludes the confirm/ subtree (generated later); callers ask
      // for it explicitly via subdir="confirm".
      if (e.isDirectory()) {
        if (!subdir && e.name === "confirm") continue;
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

/** Map a task-card path → its QC role + chapter (for narrow-retry presence checks). */
function roleFromCard(card: string): { role: string; chapter: number | null } {
  const p = card.replace(/\\/g, "/").toLowerCase();
  if (p.includes("/bar/")) return { role: "bar", chapter: chapterNumberFromCard(card) };
  if (p.includes("/confirm/")) return { role: "confirm", chapter: chapterNumberFromCard(card) };
  if (p.includes("keya")) return { role: "keyA", chapter: null };
  if (p.includes("keyb")) return { role: "keyB", chapter: null };
  if (p.includes("sweep")) return { role: "sweep", chapter: null };
  if (p.includes("major")) return { role: "major", chapter: null };
  return { role: "unknown", chapter: chapterNumberFromCard(card) };
}

function submissionPresentOnDisk(bookId: string, roundId: string, card: string): boolean {
  const base = resolve(PIPELINE_DIR, "state", "qc-orchestrator", bookId, roundId, "submissions");
  const { role, chapter } = roleFromCard(card);
  if ((role === "bar" || role === "confirm") && chapter != null) {
    const dir = resolve(base, role);
    if (!existsSync(dir)) return false;
    const tok = `ch${String(chapter).padStart(2, "0")}`;
    return readdirSync(dir).some((f) => f.includes(tok) && f.endsWith(".json"));
  }
  const dir = resolve(base, role);
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

/** Single-shape (not a discriminated union): the pipeline tsconfig runs strict:false,
 *  which widens boolean-literal discriminants and defeats union narrowing — so heldBy
 *  is just an optional field, always safe to read. */
export type BookLock = { ok: boolean; release: () => void; heldBy?: string };

/** Acquire an advisory per-book run lock under `lockDir` so two autopilots (or an
 *  autopilot + a manual run) can't race the same book. A lock younger than staleMs
 *  blocks; a malformed or older one is taken over. release() is idempotent.
 *  Exported (and dir-parameterized) so it's unit-testable against a temp dir. */
export function acquireBookLock(lockDir: string, bookId: string, staleMs = 2 * 60 * 60 * 1000): BookLock {
  const path = resolve(lockDir, `${bookId}.lock`);
  if (existsSync(path)) {
    try {
      const cur = JSON.parse(readFileSync(path, "utf8")) as { pid?: number; host?: string; at?: string };
      const ageMs = cur.at ? Date.now() - Date.parse(cur.at) : NaN;
      if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < staleMs) {
        return { ok: false, release: () => {}, heldBy: `pid ${cur.pid ?? "?"}@${cur.host ?? "?"} since ${cur.at}` };
      }
    } catch { /* malformed → treat as stale, take over */ }
  }
  // Never throw: a write failure (disk full / permission) returns ok:false so the
  // conductor halts cleanly via its `if (!lock.ok)` guard — it must NOT escape as an
  // exception, which (the acquire happens before runAutopilot's try) would crash the
  // run instead of producing a structured infra halt.
  try {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(path, JSON.stringify({ pid: process.pid, host: hostname(), at: new Date().toISOString() }), "utf8");
  } catch (err) {
    return { ok: false, release: () => {}, heldBy: `lock-file write failed (${(err as Error)?.message ?? String(err)})` };
  }
  let released = false;
  return {
    ok: true,
    release: () => { if (released) return; released = true; try { if (existsSync(path)) unlinkSync(path); } catch { /* best-effort */ } },
  };
}

function resolveDeps(d?: Partial<AutopilotDeps>): AutopilotDeps {
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
  const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId("research"), cwd: PIPELINE_DIR, sandbox: "workspace-write" }, deps);
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
    const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId(`write-ch${n}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" }, deps);
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
    const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId(`gate-repair-${attempt}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" }, deps);
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
    const round = await driveQcRound(bookId, maxParallel, deps);
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
    const repairTask = existsSync(repairPromptPath)
      ? deps.readTask(repairPromptPath)
      : `Repair the QC findings for bookId ${bookId} round ${round.roundId} in chapter content, then run qc-converge ${bookId} until CLEAN.`;
    deps.log(`[autopilot] QC repair attempt ${attempt + 1}/${maxRepair} on round ${round.roundId}`);
    const r = await spawnAndLog(bookId, { task: repairTask, sessionId: deps.mkSessionId(`qc-repair-${attempt + 1}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" }, deps);
    if (!r.ok) deps.log(`[autopilot] repair session exited ${r.exitCode}`);
    // Converge deterministic gates so the NEXT formal round won't bounce on a nit.
    for (let c = 0; c < maxRepair; c++) {
      const cv = await deps.runVerb(["qc-converge", bookId]);
      if (cv.code === 0) break;
      if (cv.code >= 2) return mkHalt(bookId, "qc", "infra", `qc-converge errored (exit ${cv.code}) during repair convergence — not a content problem; inspect: ${(cv.stderr || cv.stdout).slice(0, 300)}`);
      const cr = await spawnAndLog(bookId, { task: `Fix the remaining deterministic findings for ${bookId}, then qc-converge until CLEAN.\n\n${cv.stdout}`, sessionId: deps.mkSessionId(`qc-converge-fix-${attempt + 1}-${c}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" }, deps);
      if (!cr.ok) break;
    }
    // loop → drive a FRESH round (a repair invalidates the prior one)
  }
  return null;
}

type QcRoundResult = { roundId: string | null; verdict: "PASS" | "REVISE" | "INCOMPLETE" | "INTEGRITY" | "ERROR"; note: string };

/** Drive ONE headless QC round: open → first-wave reviewers → collect →
 *  confirm-candidates → confirm reviewers → finalize. Each reviewer is a fresh
 *  codex session with a distinct session id (independence by construction), fenced
 *  by chapter-content hashes (reviewers must not edit chapters). */
async function driveQcRound(bookId: string, maxParallel: number, deps: AutopilotDeps): Promise<QcRoundResult> {
  // Open the round + write first-wave task cards (also runs the deterministic preflight).
  const create = await deps.runVerb(["qc-orchestrate", bookId, "--create"]);
  const roundId = parseRoundId(create.stdout) ?? parseRoundId(create.stderr);
  if (!roundId) return { roundId: null, verdict: "ERROR", note: `--create produced no round id (preflight may have blocked): ${(create.stderr || create.stdout).slice(0, 300)}` };
  // A nonzero --create that still printed a round id means "created-with-errors" —
  // require exit 0 before spending reviewer sessions on a malformed round.
  if (create.code !== 0) return { roundId, verdict: "ERROR", note: `--create exited ${create.code} (created-with-errors): ${(create.stderr || create.stdout).slice(0, 300)}` };
  deps.log(`[autopilot] QC round ${roundId} opened`);

  const firstWave = deps.listTaskCards(bookId, roundId);
  const v1 = await fencedReviewers(bookId, roundId, firstWave, maxParallel, deps);
  if (v1) return { roundId, verdict: "INTEGRITY", note: v1 };

  await deps.runVerb(["qc-orchestrate", bookId, "--collect", "--round", roundId]);
  await deps.runVerb(["qc-orchestrate", bookId, "--confirm-candidates", "--round", roundId]);

  const confirmCards = deps.listTaskCards(bookId, roundId, "confirm");
  if (confirmCards.length) {
    const v2 = await fencedReviewers(bookId, roundId, confirmCards, maxParallel, deps);
    if (v2) return { roundId, verdict: "INTEGRITY", note: v2 };
  }

  let finalize = await deps.runVerb(["qc-orchestrate", bookId, "--finalize", "--round", roundId]);
  // Narrow retry: INCOMPLETE (exit 3) usually means ONE reviewer agent didn't submit.
  // Re-spawn ONLY the cards still missing a submission, once, then re-finalize (the
  // finalize verb re-collects) — rather than halting the whole book on one flaky agent.
  if (finalize.code === 3) {
    const allCards = [...firstWave, ...confirmCards];
    const missing = allCards.filter((c) => !deps.submissionPresent(bookId, roundId, c));
    if (missing.length > 0 && missing.length < allCards.length) {
      deps.log(`[autopilot] QC INCOMPLETE — narrow retry of ${missing.length}/${allCards.length} missing reviewer card(s)`);
      const v3 = await fencedReviewers(bookId, roundId, missing, maxParallel, deps);
      if (v3) return { roundId, verdict: "INTEGRITY", note: v3 };
      finalize = await deps.runVerb(["qc-orchestrate", bookId, "--finalize", "--round", roundId]);
    }
  }
  if (finalize.code === 0) return { roundId, verdict: "PASS", note: "" };
  if (finalize.code === 3) return { roundId, verdict: "INCOMPLETE", note: "missing/stale evidence" };
  return { roundId, verdict: "REVISE", note: (finalize.stdout || "").slice(0, 200) };
}

/** Spawn a reviewer wave fenced by chapter-content hashes: reviewers must NOT edit
 *  chapters. Returns a violation message if any chapter changed across the wave
 *  (read-only contract broken → the round is void), else null. Wave-level because
 *  reviewers run in parallel (per-reviewer attribution isn't possible here). */
async function fencedReviewers(bookId: string, roundId: string, cards: string[], maxParallel: number, deps: AutopilotDeps): Promise<string | null> {
  if (!cards.length) return null;
  const before = deps.chapterHashes(bookId);
  await spawnReviewers(bookId, roundId, cards, maxParallel, deps);
  const after = deps.chapterHashes(bookId);
  const changed = Object.keys(before).filter((k) => after[k] !== before[k]);
  const appeared = Object.keys(after).filter((k) => !(k in before));
  if (changed.length || appeared.length) {
    const which = [...changed, ...appeared.map((a) => `+${a}`)].join(", ");
    return `reviewer(s) MUTATED chapter content during round ${roundId} (chapters: ${which}) — reviewers are read-only; this round is void.`;
  }
  return null;
}

async function spawnReviewers(bookId: string, roundId: string, cards: string[], maxParallel: number, deps: AutopilotDeps): Promise<void> {
  deps.log(`[autopilot] QC: dispatching ${cards.length} reviewer session(s) (parallel ≤${maxParallel})`);
  await mapWithConcurrency(cards, maxParallel, async (card) => {
    const label = roleLabelFromCard(card);
    // PR1: reviewers run workspace-write because qc-submit writes its submission via
    // the CLI; the "do NOT edit chapters" contract is enforced by the caller's
    // hash-fence (detection), NOT by the sandbox. PR2 flips this to a read-only
    // sandbox + a submission broker (prevention) — don't let this prose imply the
    // sandbox is read-only today.
    const task = `${deps.readTask(card)}\n\n---\nYou are a fresh QC reviewer subagent (round ${roundId}). Do ONLY this card's review and run its qc-submit. Do not edit chapters.`;
    const r = await spawnAndLog(bookId, { task, sessionId: deps.mkSessionId(`qc-${label}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" as CodexSandbox }, deps);
    if (!r.ok) deps.log(`[autopilot] reviewer ${label} exited ${r.exitCode}`);
    return r;
  });
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
  // chapter (N+4), THEN up to one confirm reviewer per publishable-candidate chapter
  // (≤N). The old "~N+3 per round" under-counted: it omitted the major-triage card
  // and didn't separate the confirm wave.
  const N = status.expectedChapters ?? status.writtenChapters ?? 0;
  const firstWave = N + 4;
  const perRoundMax = firstWave + N;
  const lines = [
    `AUTOPILOT PLAN — ${bookId}`,
    `  current phase: ${phase}`,
    `  codex sessions that WOULD spawn from here (estimate):`,
    `    research: ${phase === "research" ? 1 : 0}`,
    `    write:    ${phase === "research" || phase === "write" ? toWrite : 0} (one per remaining chapter)`,
    `    qc round: ~${firstWave} first-wave (sweep + keyA + keyB + major-triage + ${N}×bar) + ≤${N} confirm = ≤${perRoundMax} sessions/round`,
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
