/**
 * liveRun — a thin, human-facing wrapper around `runAutopilot` that surfaces an
 * update on EVERY major event of a book run (research → write → gate → QC →
 * repair → ready) as a clean, timestamped terminal line AND a macOS desktop
 * notification, so you can kick a book off with one input and walk away.
 *
 * Why this exists: `book-autopilot <bookId>` is a terminal conductor that shells
 * out to headless `codex exec` sub-sessions for the WORK. Those Codex sessions do
 * NOT appear in the Codex.app window — their output is piped back here. The
 * conductor already funnels every milestone through a single `deps.log(...)`
 * chokepoint; this wrapper overrides ONLY that callback (every other dep stays the
 * real one), so it sees each event exactly once and can never drift from the
 * orchestrator's own notion of "what just happened".
 *
 * It changes NO pipeline behavior — same lock, same gates, same env, same exit
 * code. It only re-presents the event stream and pings you.
 *
 * Run it directly:
 *     npx tsx src/orchestrator/liveRun.ts <bookId> [--max-parallel N] [--max-repair N] [--no-notify] [--sound]
 * or via the CLI verb:
 *     npx tsx src/cli.ts book-run <bookId> [...same flags]
 *
 * Flags: --max-parallel N, --max-repair N, --plan (dry-run spawn plan),
 *        --legacy-whole-chapter-writer (use the v22 whole-chapter writer path instead of
 *          the v23 compiler path), --no-publish (halt at ready-to-publish for review; auto-publish is ON by
 *          default — on convergence it runs the full promote gate, then commits + pushes
 *          the package to main; NOT a live deploy, which stays manual),
 *        --no-notify (terminal only), --sound (notification sound), --log <file>.
 */
import { spawn } from "child_process";
import { appendFileSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

import {
  formatOutcome,
  parseRoundId,
  runAutopilot,
  type AutopilotOutcome,
} from "./autopilot.js";
import { evidenceMatrixPath } from "../qc/orchestrator/artifacts.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { loadSweepRecord, sweepFindingBlocks } from "../qc/sweep.js";
import { STRICT_PIPELINE_ENV } from "../lib/strictEnv.js";
import { writeSelfHealingRepairPrompt, type SelfHealingStage, type SelfHealingFinding } from "../repair/selfHealingRepair.js";

// ── Presentation ────────────────────────────────────────────────────────────────

const TTY = !!process.stdout.isTTY;
const c = (code: string, s: string) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s: string) => c("2", s);
const bold = (s: string) => c("1", s);
const green = (s: string) => c("32", s);
const yellow = (s: string) => c("33", s);
const cyan = (s: string) => c("36", s);
const red = (s: string) => c("31", s);

function clock(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ── macOS notifications (best-effort; a failure never touches the run) ───────────

let notifyEnabled = true;
let notifySound = false;

/** Strip newlines + escape the chars osascript's string literal can't hold. */
function osaSafe(s: string): string {
  return s.replace(/[\\"]/g, "'").replace(/[\r\n]+/g, " ").slice(0, 240);
}

function notify(title: string, body: string): void {
  if (!notifyEnabled || process.platform !== "darwin") return;
  const script =
    `display notification "${osaSafe(body)}" with title "${osaSafe(title)}"` +
    (notifySound ? ' sound name "Glass"' : "");
  try {
    const child = spawn("osascript", ["-e", script], { stdio: "ignore", detached: true });
    child.on("error", () => {}); // a missing osascript must not break the run
    child.unref();
  } catch {
    /* ignore */
  }
}

// ── Round verdict tally (read the evidence matrix the conductor just wrote) ──────

type Tally = { pub: number; total: number; detail: string };

/** Read state/.../<roundId>/evidence-matrix.json → "8/11 publishable (3 REVISE)".
 *  Returns null if the matrix isn't on disk yet (e.g. a round that just opened). */
function tallyFor(bookId: string, roundId: string | null): Tally | null {
  if (!roundId) return null;
  try {
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(bookId, roundId), "utf8"));
    const chapters: Array<{ finalVerdict?: string }> = matrix?.chapters ?? [];
    if (!chapters.length) return null;
    const pub = chapters.filter((ch) => ch.finalVerdict === "PUBLISHABLE").length;
    const byVerdict: Record<string, number> = {};
    for (const ch of chapters) {
      const v = ch.finalVerdict ?? "UNKNOWN";
      byVerdict[v] = (byVerdict[v] ?? 0) + 1;
    }
    const detail = Object.entries(byVerdict)
      .filter(([k]) => k !== "PUBLISHABLE")
      .map(([k, v]) => `${v} ${k}`)
      .join(", ");
    return { pub, total: chapters.length, detail };
  } catch {
    return null;
  }
}

function tallyLine(t: Tally | null): string {
  if (!t) return "";
  const head = `${t.pub}/${t.total} publishable`;
  return t.detail ? `${head} (${t.detail})` : head;
}

/** Format an evidence matrix's per-chapter verdicts as "ch1 ✓ · ch2 ✓ · ch3 REVISE · …" (sorted by
 *  chapter number; PUBLISHABLE → ✓). Pure (no IO) so it is unit-testable. "" for an empty set. */
export function formatChapterVerdicts(chapters: Array<{ chapterNumber?: number; finalVerdict?: string }>): string {
  return chapters
    .slice()
    .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))
    .map((ch) => {
      const n = ch.chapterNumber ?? "?";
      const v = ch.finalVerdict ?? "UNKNOWN";
      return v === "PUBLISHABLE" ? `ch${n} ✓` : `ch${n} ${v}`;
    })
    .join(" · ");
}

/** 1-indexed number of the book's MIDDLE chapter given a chapter count (ceil(N/2): 11→6, 10→5, 1→1). */
export function middleChapterNumber(total: number): number {
  return Math.max(1, Math.ceil(total / 2));
}

/** A compact per-chapter verdict line for a QC round. Presentation-only (reads the same evidence
 *  matrix tallyFor does). null if not on disk yet / empty. */
function perChapterVerdictLine(bookId: string, roundId: string | null): string | null {
  if (!roundId) return null;
  try {
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(bookId, roundId), "utf8"));
    const chapters: Array<{ chapterNumber?: number; finalVerdict?: string }> = matrix?.chapters ?? [];
    if (!chapters.length) return null;
    return formatChapterVerdicts(chapters);
  } catch {
    return null;
  }
}

// ── Event classification — turn one `[autopilot] …` line into an update ──────────

type Update = {
  icon: string;
  label: string;
  text: string;
  /** Major events get a desktop notification; minor ones only print. */
  major: boolean;
  /** If set, append (and notify) the round's publishable tally. */
  tallyRound?: string | null;
  /** Colorizer for the label, for terminal flavor. */
  tone: (s: string) => string;
};

let lastPhase: string | null = null;

export function classify(bookId: string, raw: string): Update {
  const line = raw.replace(/^\[autopilot\]\s*/, "");
  const round = parseRoundId(line);

  // Run start — lock acquired under strict invariants.
  if (/strict invariants ENFORCED/.test(line)) {
    return { icon: "🔒", label: "START", text: "run started · strict invariants enforced · lock acquired", major: true, tone: bold };
  }

  // Phase heartbeat: `phase=write written=3/11 gated=0 qcd=0`. Print every beat,
  // but only NOTIFY when the phase NAME changes (write→gate→qc→ready), so a 11-
  // chapter write doesn't fire 11 notifications.
  const ph = line.match(/^phase=(\w+)\s+written=(\S+)\s+gated=(\S+)\s+qcd=(\S+)/);
  if (ph) {
    const [, phase, written, gated, qcd] = ph;
    const changed = phase !== lastPhase;
    lastPhase = phase;
    return {
      icon: "📊",
      label: `PHASE ${phase}`,
      text: `written ${written} · gated ${gated} · qc'd ${qcd}`,
      major: changed,
      tone: cyan,
    };
  }

  if (/^research: spawning/.test(line)) {
    return { icon: "🔬", label: "RESEARCH", text: "spawning research session", major: true, tone: cyan };
  }
  const writeStart = line.match(/^write:\s*(\d+)\s+chapter/);
  if (writeStart) {
    return { icon: "✍️ ", label: "WRITE", text: `authoring ${writeStart[1]} chapter(s)`, major: true, tone: cyan };
  }
  // Per-chapter write progress (one writer agent per chapter, ≤max-parallel concurrent). These
  // print to the live stream but are NOT desktop notifications — else an 11-chapter book would
  // fire 22 pings. The terminal interleaves them as the parallel writers start/finish.
  const chWriting = line.match(/^write ch(\d+): writer working/);
  if (chWriting) {
    return { icon: "  ✍️", label: `ch${chWriting[1]}`, text: "writer working", major: false, tone: cyan };
  }
  const chWritten = line.match(/^write ch(\d+): done/);
  if (chWritten) {
    return { icon: "  ✓", label: `ch${chWritten[1]}`, text: "write done", major: false, tone: green };
  }
  const chDone = line.match(/^write ch(\d+) session exited (-?\d+)/);
  if (chDone) {
    const [, n, code] = chDone;
    const ok = code === "0";
    return {
      icon: ok ? "  ·" : "  ✗",
      label: `ch${n}`,
      text: ok ? "written" : `write session exited ${code}`,
      major: !ok,
      tone: ok ? dim : red,
    };
  }
  const gateDeterministicRepair = line.match(/^gate deterministic repair attempt (\d+)\/(\d+)/);
  if (gateDeterministicRepair) {
    return { icon: "🚪", label: "GATE REPAIR", text: `attempt ${gateDeterministicRepair[1]}/${gateDeterministicRepair[2]} (deterministic gates)`, major: true, tone: yellow };
  }
  const gateMajorRepair = line.match(/^gate major repair attempt (\d+)\/(\d+)/);
  if (gateMajorRepair) {
    return { icon: "🚪", label: "GATE MAJOR REPAIR", text: `attempt ${gateMajorRepair[1]}/${gateMajorRepair[2]} (blocking majors)`, major: true, tone: yellow };
  }
  const gateMajorShardStart = line.match(/^gate major repair (ch\d+|book): working(?: \((\d+) major\(s\)\))?/);
  if (gateMajorShardStart) {
    const [, shard, count] = gateMajorShardStart;
    return { icon: "  🔧", label: "GATE MAJOR", text: `${shard} working${count ? ` · ${count} major(s)` : ""}`, major: false, tone: yellow };
  }
  const gateMajorShardExit = line.match(/^gate major repair (ch\d+|book): exited (-?\d+)/);
  if (gateMajorShardExit) {
    const [, shard, code] = gateMajorShardExit;
    const ok = code === "0";
    return { icon: ok ? "  ✓" : "  ✗", label: "GATE MAJOR", text: `${shard} exited ${code}`, major: !ok, tone: ok ? green : red };
  }
  const gateRepair = line.match(/^gate repair attempt (\d+)\/(\d+)/);
  if (gateRepair) {
    return { icon: "🚪", label: "GATE REPAIR", text: `attempt ${gateRepair[1]}/${gateRepair[2]} (deterministic gates)`, major: true, tone: yellow };
  }
  if (/^QC PASS on round/.test(line)) {
    return { icon: "✅", label: "QC PASS", text: "all chapters publishable", major: true, tallyRound: round, tone: green };
  }
  const qcOpen = line.match(/^QC round \S+ opened(.*)$/);
  if (qcOpen) {
    return { icon: "🧪", label: "QC ROUND", text: `opened${qcOpen[1] || ""}`.trim(), major: true, tone: cyan };
  }
  if (/^qc-diagnose/.test(line)) {
    return { icon: "🔎", label: "QC VERDICT", text: "round diagnosed", major: true, tallyRound: round, tone: cyan };
  }
  const qcRepair = line.match(/^QC repair attempt (\d+)\/(\d+).*?(\d+) surgical/);
  if (qcRepair) {
    return { icon: "🔧", label: "QC REPAIR", text: `attempt ${qcRepair[1]}/${qcRepair[2]} · ${qcRepair[3]} surgical session(s)`, major: true, tone: yellow };
  }
  if (/^QC repair attempt/.test(line)) {
    const m = line.match(/^QC repair attempt (\d+)\/(\d+)/);
    return { icon: "🔧", label: "QC REPAIR", text: m ? `attempt ${m[1]}/${m[2]}` : "repair dispatched", major: true, tone: yellow };
  }
  if (/^WARNING:/.test(line)) {
    return { icon: "⚠️ ", label: "WARNING", text: line.replace(/^WARNING:\s*/, ""), major: true, tone: yellow };
  }

  // Anything else (session-exit notes, reviewer skips, fanout notes) — print quietly.
  return { icon: "  ·", label: "", text: line, major: false, tone: dim };
}

// ── Sink: print + (maybe) notify + (maybe) append to a log file ──────────────────

let logFile: string | null = null;

function emit(bookId: string, raw: string): void {
  const u = classify(bookId, raw);
  let text = u.text;
  if (u.tallyRound !== undefined) {
    const t = tallyLine(tallyFor(bookId, u.tallyRound));
    if (t) text += ` — ${u.label === "QC PASS" ? green(t) : bold(t)}`;
  }
  const label = u.label ? u.tone(`${u.label}`) + " " : "";
  const stamp = dim(clock());
  console.log(`${stamp} ${u.icon} ${label}${text}`);

  // For a QC round verdict (QC PASS / QC VERDICT), follow with a compact per-chapter breakdown so
  // the operator sees exactly which chapters passed vs need a revise this round.
  if (u.tallyRound !== undefined) {
    const perCh = perChapterVerdictLine(bookId, u.tallyRound);
    if (perCh) console.log(`${dim(clock())}      ${dim(perCh)}`);
  }

  if (logFile) {
    try {
      appendFileSync(logFile, `${new Date().toISOString()} [${u.major ? "MAJOR" : "info"}] ${u.label} ${u.text}\n`);
    } catch {
      /* a log-file hiccup must not break the run */
    }
  }

  if (u.major) {
    // The notification body strips ANSI (we built `text` from clean parts, but the
    // tally was colorized — re-derive a clean body).
    const cleanTail = u.tallyRound !== undefined ? ` — ${tallyLine(tallyFor(bookId, u.tallyRound))}` : "";
    notify(`📖 ${bookId} · ${u.label || "update"}`, `${u.text}${cleanTail}`.trim());
  }
}

function appendFinalToLog(status: "halt" | "ready" | "published" | "shipped", summary: string, repairPromptPath?: string): void {
  if (!logFile) return;
  try {
    appendFileSync(logFile, `${new Date().toISOString()} [FINAL] ${status.toUpperCase()} ${summary}\n`);
    if (repairPromptPath) appendFileSync(logFile, `${new Date().toISOString()} [FINAL] repair prompt: ${repairPromptPath}\n`);
  } catch {
    /* final log write must not change the run outcome */
  }
}

function haltStageForRepair(outcome: Extract<AutopilotOutcome, { status: "halt" }>): SelfHealingStage {
  if (outcome.phase === "research") return "research";
  if (outcome.phase === "write" && /source-v2|source readiness|sidecar|prewrite/i.test(outcome.reason)) return "source";
  if (outcome.phase === "write") return "chapter-generation";
  if (outcome.phase === "gate") return "ship-gate";
  if (outcome.phase === "qc") return "qc";
  if (outcome.phase === "ready") return "promotion";
  return "unknown";
}

function haltSeverityForRepair(outcome: Extract<AutopilotOutcome, { status: "halt" }>): "blocker" | "infra" {
  return outcome.category === "infra" || outcome.category === "progress" || outcome.category === "integrity" ? "infra" : "blocker";
}

function parseSourceGateFindingsForRepair(text: string): SelfHealingFinding[] {
  const findings: SelfHealingFinding[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*\[(?:(BLOCKER|ADVISORY)\s+)?([^\]]+)\]\s+(?:ch(\d{2}):\s*)?(.+)$/i);
    if (!m) continue;
    const [, sev, id, ch, message] = m;
    findings.push({
      id: id.trim(),
      severity: sev ? sev.toLowerCase() : /realness_/i.test(id) ? "blocker" : undefined,
      chapterNumber: ch ? Number(ch) : undefined,
      unit: "source-v2",
      message: message.trim(),
      expectedFix: /realness_unsupported_entity/i.test(id)
        ? "For each listed namedExamples[i], add verified concrete hardSpecifics and echo at least two of them in summary/paraphraseNotes, or replace the broad entity with a concrete verified case."
        : "Repair the source-v2 sidecar field named by the gate, preserving stable ids and verified provenance.",
    });
  }
  return findings;
}

function sourceRepairArtifacts(bookId: string, findings: SelfHealingFinding[]): string[] {
  const chapters = [...new Set(findings.map((f) => f.chapterNumber).filter((n): n is number => Number.isInteger(n)))].sort((a, b) => a - b);
  return [
    `state/indexes/${bookId}.json`,
    `.chapterflow/runs/${bookId}/**/sidecars/source/ch*.source.json`,
    `.chapterflow/source-verify-${bookId}.md`,
    ...chapters.map((n) => `.chapterflow/runs/${bookId}/**/sidecars/source/ch${String(n).padStart(2, "0")}.source.json`),
  ];
}

function latestSweepFindingsForRepair(bookId: string): { findings: SelfHealingFinding[]; artifacts: string[]; roundId?: string } {
  try {
    const rec = loadSweepRecord(bookId);
    if (!rec) return { findings: [], artifacts: [`state/qc/${bookId}.sweep.json`] };
    const rawFindings = rec.findings ?? [];
    const blocking = rawFindings.filter(sweepFindingBlocks);
    // For a QC-confirmation halt, non-blocking/advisory sweep notes are useful context, but the
    // blocker(s) are the actual repair target. If there are no blockers, preserve the raw notes so
    // the repair agent can diagnose why the sweep would not corroborate.
    const selected = blocking.length ? blocking : rawFindings;
    const findings: SelfHealingFinding[] = selected.map((f) => {
      const chapters = (f.chapters ?? []).map((n) => Number(n)).filter((n) => Number.isInteger(n));
      const chapterLabel = chapters.length ? `chapter(s): ${chapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}. ` : "";
      return {
        id: f.defectKey ?? f.unitId ?? f.family,
        severity: f.severity ?? (sweepFindingBlocks(f) ? "blocker" : "advisory"),
        unit: f.family,
        chapterNumber: chapters.length === 1 ? chapters[0] : undefined,
        message: `${chapterLabel}${f.problem ?? "Sweep finding requires inspection."}`,
        evidence: f.quote,
        expectedFix: f.expectedFix,
      };
    });
    const artifacts = [
      `state/qc/${bookId}.sweep.json`,
      `state/qc/${bookId}.sweep-history.jsonl`,
      `state/qc-orchestrator/${bookId}/${rec.roundId}/sweep-record.json`,
      `state/qc-orchestrator/${bookId}/${rec.roundId}/evidence-matrix.json`,
      `state/qc-orchestrator/${bookId}/${rec.roundId}/repair-prompt.md`,
    ];
    return { findings, artifacts, roundId: rec.roundId };
  } catch {
    return { findings: [], artifacts: [`state/qc/${bookId}.sweep.json`, `state/qc/${bookId}.sweep-history.jsonl`] };
  }
}

function writeHaltRepairPrompt(bookId: string, outcome: Extract<AutopilotOutcome, { status: "halt" }>): string | undefined {
  try {
    const isSourceHalt = outcome.phase === "write" && /source-v2|source readiness|sidecar|prewrite/i.test(outcome.reason);
    const sourceFindings = isSourceHalt ? parseSourceGateFindingsForRepair(outcome.reason) : [];
    const sweep = outcome.phase === "qc" ? latestSweepFindingsForRepair(bookId) : { findings: [], artifacts: [] as string[], roundId: undefined };
    const isQcConfirmation = outcome.phase === "qc" && /confirm|corroborat|sweep/i.test(outcome.reason);
    const repair = writeSelfHealingRepairPrompt({
      bookId,
      runId: sweep.roundId ?? "book-run",
      stage: haltStageForRepair(outcome),
      severity: isSourceHalt ? "blocker" : haltSeverityForRepair(outcome),
      summary: outcome.reason,
      findings: isSourceHalt ? sourceFindings : sweep.findings,
      artifacts: isSourceHalt ? sourceRepairArtifacts(bookId, sourceFindings) : sweep.artifacts,
      recommendedFixes: isSourceHalt
        ? [
            "Repair research/source sidecars before authoring. Do not write chapters from thin or unsupported source notes.",
            "For SV2.realness_unsupported_entity, add verified concrete hardSpecifics to the listed namedExamples and make those specifics visible in summary/paraphraseNotes, or replace the broad entity with a concrete verified case.",
            "If a sidecar edit changes a fact or named case, update the source-verify record and rerun source-verify-check. Do not invent details to satisfy the gate.",
          ]
        : isQcConfirmation
          ? [
              "Treat the latest sweep record as the evidence source. Repair the named chapter content; do not edit QC gates or mark attestations manually.",
              "For each sweep blocker, replace cross-unit bleed, repeated location stamping, or templated scene structure with chapter-specific action grounded in the existing source anchors.",
              "After editing, rerun deterministic convergence before reopening QC. The changed chapter(s) must receive fresh QC; do not reuse stale attestations.",
            ]
          : undefined,
      validationCommands: isSourceHalt
        ? [
            `npx tsx src/cli.ts source-v2-gate ${bookId} --prewrite`,
            `npx tsx src/cli.ts source-v2-gate ${bookId}`,
            `npx tsx src/cli.ts source-verify-check ${bookId}`,
            `npx tsx src/cli.ts book-run ${bookId} --no-publish`,
          ]
        : [
            `npx tsx src/cli.ts qc-converge ${bookId}`,
            `npx tsx src/cli.ts book-run ${bookId} --no-publish`,
          ],
      nextCommand: `npx tsx src/cli.ts book-run ${bookId} --no-publish`,
    });
    return repair.promptPath;
  } catch {
    return undefined;
  }
}

// ── Arg parsing (mirrors the cli.ts flag shape: `--flag value` | bare `--flag`) ──

type Flags = Record<string, string | boolean>;

function parseArgv(raw: string[]): { args: string[]; flags: Flags } {
  const args: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < raw.length; i++) {
    const tok = raw[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = raw[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      args.push(tok);
    }
  }
  return { args, flags };
}

// ── Entry point ──────────────────────────────────────────────────────────────────

/** The wrapper, callable from cli.ts (`book-run`) or run directly. Returns the
 *  process exit code (1 on halt, else 0) — the caller decides whether to exit. */
export async function runLive(args: string[], flags: Flags): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: book-run <bookId> [--regen] [--max-parallel N] [--max-repair N] [--plan] [--no-publish] [--no-notify] [--sound] [--log <file>]   (--regen re-runs an already-published book end-to-end)");
    return 2;
  }

  // Graceful interruption. State writes are now atomic (tmp+rename), so a Ctrl-C / SIGTERM can
  // never leave a torn chapter/package — and the same-host run lock auto-frees on process death
  // (PID-liveness), so a re-run resumes cleanly. This handler just makes the interrupt LEGIBLE
  // (a clear line + a 130 exit) instead of a bare stack trace; it doesn't force-kill child codex
  // sessions (they carry their own timeouts).
  let interrupted = false;
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      if (interrupted) return;
      interrupted = true;
      console.error(red(`\n${sig} — interrupting book run for ${bookId}. State is crash-safe (atomic writes) and the run lock auto-frees; re-run \`book-run ${bookId}\` to resume.`));
      process.exit(130);
    });
  }

  // Strict invariants: force-set so the conductor's IN-PROCESS gates (ship/book
  // gate regression scan, finalize) enforce — the subprocess env is force-set
  // elsewhere, but the in-process reads need it in our own env too.
  Object.assign(process.env, STRICT_PIPELINE_ENV);

  // Default the codex binary to the installed Codex.app if the operator hasn't
  // pointed CHAPTERFLOW_CODEX_BIN somewhere else.
  if (!process.env.CHAPTERFLOW_CODEX_BIN) {
    const appBin = "/Applications/Codex.app/Contents/Resources/codex";
    if (existsSync(appBin)) process.env.CHAPTERFLOW_CODEX_BIN = appBin;
  }

  notifyEnabled = flags["no-notify"] !== true && flags["notify"] !== false;
  notifySound = flags["sound"] === true;
  logFile = typeof flags["log"] === "string" ? resolve(flags["log"]) : null;

  const maxRepair = typeof flags["max-repair"] === "string" ? parseInt(flags["max-repair"], 10) : undefined;
  const maxParallel = typeof flags["max-parallel"] === "string" ? parseInt(flags["max-parallel"], 10) : undefined;
  // Auto-publish is ON by default: on QC convergence the full promote gate runs and the
  // package is committed + pushed to main (NOT a live deploy). --no-publish restores the
  // old behavior of halting at ready-to-publish and printing the manual ship command.
  // Opt out on the PRESENCE of --no-publish in any form. The greedy arg parser can bind
  // the following token as this flag's value (`--no-publish 0` → "0"), so a `!== true`
  // check would fail OPEN (keep publishing) on the one human-safety lever. Presence-check
  // fails SAFE: any --no-publish disables auto-publish.
  const autoPublish = !("no-publish" in flags);
  const plan = flags["plan"] === true;
  // --regen: REGENERATE an already-published book. Without it, the conductor sees the committed
  // package and skips as "shipped". With it, it re-runs end-to-end over the existing package (promote
  // overwrites it) — no move-the-package-aside hack, so the web registry's static import never dangles.
  const regen = "regen" in flags;
  const architecture = "legacy-whole-chapter-writer" in flags || "legacy" in flags ? "legacy" : "compiler";

  console.log(bold(`\n📖 Book run — ${bookId}`));
  console.log(
    dim(
      `   codex=${process.env.CHAPTERFLOW_CODEX_BIN ?? "(PATH)"} · notify=${notifyEnabled ? "on" : "off"}` +
        `${notifySound ? "+sound" : ""}${logFile ? ` · log=${logFile}` : ""}${plan ? " · PLAN (dry-run)" : ""}${regen ? " · REGEN (re-run a published book)" : ""}` +
        ` · architecture=${architecture === "compiler" ? "v23 compiler" : "v22 legacy whole-chapter"}` +
        `${autoPublish ? " · auto-publish ON (commit+push to main on convergence)" : " · --no-publish (halt for review)"}`,
    ),
  );
  if (autoPublish) {
    console.log(yellow("   ⚠️  On QC convergence this auto-publishes: the full promote gate runs, then the package is committed + pushed to main. This is NOT a live deploy (still manual) and is reversible via git. Pass --no-publish to halt for review instead."));
  } else {
    console.log(dim("   --no-publish: will halt at ready-to-publish and print the manual ship command."));
  }
  console.log("");
  notify(`📖 ${bookId} · launching`, "Book run started — you'll get a ping on every major event.");

  const started = Date.now();
  const outcome: AutopilotOutcome = await runAutopilot({
    bookId,
    plan,
    autoPublish,
    regen,
    architecture,
    maxRepairRounds: Number.isInteger(maxRepair) ? maxRepair : undefined,
    maxParallel: Number.isInteger(maxParallel) ? maxParallel : undefined,
    deps: { log: (m) => emit(bookId, m) },
  });

  const mins = Math.round((Date.now() - started) / 60000);
  const summary = formatOutcome(outcome);
  const halted = outcome.status === "halt";
  const haltRepairPrompt = halted ? writeHaltRepairPrompt(bookId, outcome) : undefined;
  console.log("\n" + (halted ? red(summary) : green(summary)) + dim(`   (${mins} min)`));
  if (haltRepairPrompt) {
    console.log(yellow(`repair prompt written: ${haltRepairPrompt}`));
  }
  appendFinalToLog(outcome.status, summary, haltRepairPrompt);

  // Final ping carries the outcome + (when known) the round's tally.
  const finalRound = "roundId" in outcome ? outcome.roundId ?? null : null;
  const finalTail = finalRound ? ` · ${tallyLine(tallyFor(bookId, finalRound))}` : "";
  notify(`📖 ${bookId} · ${outcome.status.toUpperCase()}`, summary.replace(/^AUTOPILOT[^:]*:\s*/, "") + finalTail);

  // On a successful run (published / ready / shipped — anything but a halt), print the JSON of the
  // book's MIDDLE chapter so the operator can eyeball the output without hunting for the file. The
  // middle is the most representative single chapter (not the intro, not the wrap-up). Chapters live
  // in state/chapters/ and survive publish, so this works on both the published and --no-publish paths.
  // Skipped on --plan (a dry-run does no work, so there's nothing fresh to review).
  if (!halted && !plan) {
    try {
      const chapters = loadBookChapters(bookId).slice().sort((a, b) => a.number - b.number);
      if (chapters.length === 0) {
        // On the published path the conductor prunes the working chapters (package-only policy), so
        // there is nothing to preview — point at the durable artifact instead of looking like a failure.
        console.log(dim(outcome.status === "published"
          ? "\n(published — working chapters were pruned; the committed package is the durable artifact for review.)"
          : "\n(no authored chapters found on disk to print for review.)"));
      } else {
        const mid = chapters[middleChapterNumber(chapters.length) - 1];
        console.log(
          bold(`\n${"─".repeat(70)}\n📄 Middle chapter for review — chapter ${mid.number} of ${chapters.length}: "${mid.title}"\n${"─".repeat(70)}`),
        );
        console.log(JSON.stringify(mid, null, 2));
      }
    } catch (err) {
      console.log(dim(`\n(could not load the middle chapter for review: ${(err as Error).message})`));
    }
  }

  return halted ? 1 : 0;
}

// Allow `npx tsx src/orchestrator/liveRun.ts <bookId> [flags]` directly.
const invokedDirectly =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const { args, flags } = parseArgv(process.argv.slice(2));
  runLive(args, flags)
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(red(`book-run crashed: ${err?.stack || err}`));
      process.exit(1);
    });
}
