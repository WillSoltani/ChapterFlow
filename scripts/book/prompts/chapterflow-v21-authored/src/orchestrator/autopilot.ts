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
import { existsSync, readdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { computeBookStatus, type BookStatus } from "../lifecycle/bookStatus.js";
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

export type AutopilotOutcome =
  | { status: "shipped"; bookId: string }
  | { status: "ready"; bookId: string; roundId?: string; message: string }
  | { status: "published"; bookId: string; roundId: string }
  | { status: "halt"; bookId: string; phase: AutopilotPhase; reason: string };

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

function defaultRunVerb(): RunVerb {
  return (args, env) =>
    new Promise((resolvePromise, rejectPromise) => {
      const child = spawn("npx", ["tsx", "src/cli.ts", ...args], {
        cwd: PIPELINE_DIR,
        env: { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "1", ...(env ?? {}) },
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
      return { status: "halt", bookId, phase, reason: `no progress in phase "${phase}" (state unchanged after an action: ${sig}) — inspect: npx tsx src/cli.ts book-status ${bookId}` };
    }
    lastSignature = sig;

    if (phase === "research") {
      const ok = await doResearch(bookId, deps);
      if (!ok) return { status: "halt", bookId, phase, reason: "research agent did not complete; inspect research artifacts" };
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
  return { status: "halt", bookId, phase: decidePhase(deps.statusOf(bookId)), reason: `loop iteration cap (${MAX_LOOP_ITERS}) hit — likely a stuck phase` };
}

// ── Phase: research ──────────────────────────────────────────────────────────

async function doResearch(bookId: string, deps: AutopilotDeps): Promise<boolean> {
  const promptPath = resolve(AGENT_PROMPTS_DIR, "RESEARCH-CODEX-SESSION.md");
  const task = `${deps.readTask(promptPath)}\n\n---\nRun the research phase for bookId: ${bookId}. Follow the playbook above until book-status reports the write phase.`;
  deps.log(`[autopilot] research: spawning 1 codex session for ${bookId}`);
  const r = await deps.spawn({ task, sessionId: deps.mkSessionId("research"), cwd: PIPELINE_DIR, sandbox: "workspace-write" });
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
    const r = await deps.spawn({ task, sessionId: deps.mkSessionId(`write-ch${n}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" });
    if (!r.ok) deps.log(`[autopilot] write ch${n} session exited ${r.exitCode}`);
    return r;
  });
}

// ── Phase: gate (repair ship/book-gate blockers, bounded) ─────────────────────

async function doGate(bookId: string, maxRepair: number, deps: AutopilotDeps): Promise<AutopilotOutcome | null> {
  for (let attempt = 1; attempt <= maxRepair; attempt++) {
    const converge = await deps.runVerb(["qc-converge", bookId]);
    if (converge.code === 0) return null; // DETERMINISTIC-CLEAN → re-loop (advances to qc)
    deps.log(`[autopilot] gate repair attempt ${attempt}/${maxRepair} — converging deterministic gates`);
    const task = `Fix the DETERMINISTIC gate findings below for bookId ${bookId} by editing chapter CONTENT only (state/chapters/), then run \`npx tsx src/cli.ts qc-converge ${bookId}\` until it reports DETERMINISTIC-CLEAN. Fix EVERY finding in one pass. Do NOT edit pipeline code/config.\n\n${converge.stdout}`;
    const r = await deps.spawn({ task, sessionId: deps.mkSessionId(`gate-repair-${attempt}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" });
    if (!r.ok) deps.log(`[autopilot] gate repair session exited ${r.exitCode}`);
  }
  const final = await deps.runVerb(["qc-converge", bookId]);
  if (final.code === 0) return null;
  return { status: "halt", bookId, phase: "gate", reason: `deterministic gates still DIRTY after ${maxRepair} repair rounds — escalate. Run: npx tsx src/cli.ts qc-converge ${bookId}` };
}

// ── Phase: qc (headless round + bounded repair loop) ──────────────────────────

/** Returns an outcome to STOP on (halt), or null to RE-LOOP (round passed → status
 *  advances to ready). The repair loop honors qc-diagnose governance + stuck-detect. */
async function doQcWithRepair(bookId: string, maxRepair: number, maxParallel: number, deps: AutopilotDeps): Promise<AutopilotOutcome | null> {
  let prevSignatures = new Set<string>();
  for (let attempt = 0; attempt <= maxRepair; attempt++) {
    const round = await driveQcRound(bookId, maxParallel, deps);
    if (!round.roundId) {
      return { status: "halt", bookId, phase: "qc", reason: `could not open/finalize a QC round (${round.note})` };
    }
    if (round.verdict === "PASS") {
      deps.log(`[autopilot] QC PASS on round ${round.roundId}`);
      return null; // re-loop → ready
    }
    if (round.verdict === "INCOMPLETE") {
      return { status: "halt", bookId, phase: "qc", reason: `QC round ${round.roundId} INCOMPLETE (missing reviewer submissions) — a reviewer agent likely failed. Inspect: npx tsx src/cli.ts qc-diagnose ${bookId} --round ${round.roundId}` };
    }
    // REVISE → repair, but never past the bound and never without diagnose.
    if (attempt === maxRepair) {
      return { status: "halt", bookId, phase: "qc", reason: `QC still REVISE after ${maxRepair} repair rounds — escalate (likely a source/research limitation). Last round: ${round.roundId}` };
    }
    const diagnose = await deps.runVerb(["qc-diagnose", bookId, "--round", round.roundId]);
    deps.log(`[autopilot] qc-diagnose (round ${round.roundId}):\n${diagnose.stdout.slice(0, 600)}`);
    if (/major-disposition/.test(diagnose.stdout)) {
      return { status: "halt", bookId, phase: "qc", reason: `a MAJOR finding needs human disposition (waive vs fix) — the autopilot never auto-waives. Review: npx tsx src/cli.ts qc-diagnose ${bookId} --round ${round.roundId}` };
    }
    const sigs = findingSignatures(diagnose.stdout);
    if (attempt > 0 && noProgress(prevSignatures, sigs)) {
      return { status: "halt", bookId, phase: "qc", reason: `repair made NO progress (same findings survived a content edit) — escalate. Round: ${round.roundId}` };
    }
    prevSignatures = sigs;

    // Spawn ONE repair writer with the generated repair prompt, then converge
    // deterministically before the next (fresh) round — the treadmill-killer.
    const repairPromptPath = resolve(PIPELINE_DIR, "state", "qc-orchestrator", bookId, round.roundId, "repair-prompt.md");
    const repairTask = existsSync(repairPromptPath)
      ? deps.readTask(repairPromptPath)
      : `Repair the QC findings for bookId ${bookId} round ${round.roundId} in chapter content, then run qc-converge ${bookId} until CLEAN.`;
    deps.log(`[autopilot] QC repair attempt ${attempt + 1}/${maxRepair} on round ${round.roundId}`);
    const r = await deps.spawn({ task: repairTask, sessionId: deps.mkSessionId(`qc-repair-${attempt + 1}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" });
    if (!r.ok) deps.log(`[autopilot] repair session exited ${r.exitCode}`);
    // Converge deterministic gates so the NEXT formal round won't bounce on a nit.
    for (let c = 0; c < maxRepair; c++) {
      const cv = await deps.runVerb(["qc-converge", bookId]);
      if (cv.code === 0) break;
      const cr = await deps.spawn({ task: `Fix the remaining deterministic findings for ${bookId}, then qc-converge until CLEAN.\n\n${cv.stdout}`, sessionId: deps.mkSessionId(`qc-converge-fix-${attempt + 1}-${c}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" });
      if (!cr.ok) break;
    }
    // loop → drive a FRESH round (a repair invalidates the prior one)
  }
  return null;
}

type QcRoundResult = { roundId: string | null; verdict: "PASS" | "REVISE" | "INCOMPLETE" | "ERROR"; note: string };

/** Drive ONE headless QC round: open → first-wave reviewers → collect →
 *  confirm-candidates → confirm reviewers → finalize. Each reviewer is a fresh
 *  codex session with a distinct session id (independence by construction). */
async function driveQcRound(bookId: string, maxParallel: number, deps: AutopilotDeps): Promise<QcRoundResult> {
  // Open the round + write first-wave task cards (also runs the deterministic preflight).
  const create = await deps.runVerb(["qc-orchestrate", bookId, "--create"]);
  const roundId = parseRoundId(create.stdout) ?? parseRoundId(create.stderr);
  if (!roundId) return { roundId: null, verdict: "ERROR", note: `--create produced no round id (preflight may have blocked): ${(create.stderr || create.stdout).slice(0, 300)}` };
  deps.log(`[autopilot] QC round ${roundId} opened`);

  const firstWave = deps.listTaskCards(bookId, roundId);
  await spawnReviewers(bookId, roundId, firstWave, maxParallel, deps);

  await deps.runVerb(["qc-orchestrate", bookId, "--collect", "--round", roundId]);
  await deps.runVerb(["qc-orchestrate", bookId, "--confirm-candidates", "--round", roundId]);

  const confirmCards = deps.listTaskCards(bookId, roundId, "confirm");
  if (confirmCards.length) await spawnReviewers(bookId, roundId, confirmCards, maxParallel, deps);

  const finalize = await deps.runVerb(["qc-orchestrate", bookId, "--finalize", "--round", roundId]);
  if (finalize.code === 0) return { roundId, verdict: "PASS", note: "" };
  if (finalize.code === 3) return { roundId, verdict: "INCOMPLETE", note: "missing/stale evidence" };
  return { roundId, verdict: "REVISE", note: (finalize.stdout || "").slice(0, 200) };
}

async function spawnReviewers(bookId: string, roundId: string, cards: string[], maxParallel: number, deps: AutopilotDeps): Promise<void> {
  deps.log(`[autopilot] QC: dispatching ${cards.length} reviewer session(s) (parallel ≤${maxParallel})`);
  await mapWithConcurrency(cards, maxParallel, async (card) => {
    const label = roleLabelFromCard(card);
    // Read-only sandbox: reviewers must NOT edit chapters (qc-submit writes its own
    // submission file, which the sandbox still permits via the CLI it runs).
    const task = `${deps.readTask(card)}\n\n---\nYou are a fresh QC reviewer subagent (round ${roundId}). Do ONLY this card's review and run its qc-submit. Do not edit chapters.`;
    const r = await deps.spawn({ task, sessionId: deps.mkSessionId(`qc-${label}`), cwd: PIPELINE_DIR, sandbox: "workspace-write" as CodexSandbox });
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
  if (!roundId) return { status: "halt", bookId, phase: "ready", reason: "auto-publish requested but no passed round id found; publish manually" };
  const pub = await deps.runVerb(["publish-after-qc", bookId, "--round", roundId]); // no --commit/--push: those stay explicit
  if (pub.code !== 0) return { status: "halt", bookId, phase: "ready", reason: `publish-after-qc failed (exit ${pub.code}): ${(pub.stderr || pub.stdout).slice(0, 300)}` };
  return { status: "published", bookId, roundId };
}

// ── --plan dry-run (cost preview; takes NO action) ────────────────────────────

function planOnly(bookId: string, deps: AutopilotDeps): AutopilotOutcome {
  const status = deps.statusOf(bookId);
  const phase = decidePhase(status);
  const expected = deps.expectedChapterNumbers(bookId);
  const written = new Set(status.chapters.filter((c) => c.written).map((c) => c.number));
  const toWrite = expected.filter((n) => !written.has(n)).length || Math.max(0, (status.expectedChapters ?? 0) - status.writtenChapters);
  const lines = [
    `AUTOPILOT PLAN — ${bookId}`,
    `  current phase: ${phase}`,
    `  codex sessions that WOULD spawn from here (estimate):`,
    `    research: ${phase === "research" ? 1 : 0}`,
    `    write:    ${phase === "research" || phase === "write" ? toWrite : 0} (one per remaining chapter)`,
    `    qc round: ~${(status.expectedChapters ?? status.writtenChapters) + 3} per round (sweep+keyA+keyB + bar/ch + confirm/ch), up to 3 repair rounds`,
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
    case "halt": return `AUTOPILOT HALT — ${o.bookId} [phase ${o.phase}]: ${o.reason}`;
  }
}
