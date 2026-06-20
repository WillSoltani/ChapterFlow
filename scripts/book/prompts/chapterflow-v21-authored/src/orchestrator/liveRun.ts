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
 *        --auto-publish (DANGER: skips the human publish gate — off by default),
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
import { STRICT_PIPELINE_ENV } from "../lib/strictEnv.js";

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

function classify(bookId: string, raw: string): Update {
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
    console.error("Usage: book-run <bookId> [--max-parallel N] [--max-repair N] [--plan] [--auto-publish] [--no-notify] [--sound] [--log <file>]");
    return 2;
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
  const autoPublish = flags["auto-publish"] === true;
  const plan = flags["plan"] === true;

  console.log(bold(`\n📖 Book run — ${bookId}`));
  console.log(
    dim(
      `   codex=${process.env.CHAPTERFLOW_CODEX_BIN ?? "(PATH)"} · notify=${notifyEnabled ? "on" : "off"}` +
        `${notifySound ? "+sound" : ""}${logFile ? ` · log=${logFile}` : ""}${plan ? " · PLAN (dry-run)" : ""}` +
        `${autoPublish ? " · AUTO-PUBLISH ⚠️ (human gate skipped)" : ""}`,
    ),
  );
  if (autoPublish) {
    console.log(yellow("   ⚠️  --auto-publish will ship without a human go-ahead. Publishing is irreversible."));
  }
  console.log("");
  notify(`📖 ${bookId} · launching`, "Book run started — you'll get a ping on every major event.");

  const started = Date.now();
  const outcome: AutopilotOutcome = await runAutopilot({
    bookId,
    plan,
    autoPublish,
    maxRepairRounds: Number.isInteger(maxRepair) ? maxRepair : undefined,
    maxParallel: Number.isInteger(maxParallel) ? maxParallel : undefined,
    deps: { log: (m) => emit(bookId, m) },
  });

  const mins = Math.round((Date.now() - started) / 60000);
  const summary = formatOutcome(outcome);
  const halted = outcome.status === "halt";
  console.log("\n" + (halted ? red(summary) : green(summary)) + dim(`   (${mins} min)`));

  // Final ping carries the outcome + (when known) the round's tally.
  const finalRound = "roundId" in outcome ? outcome.roundId ?? null : null;
  const finalTail = finalRound ? ` · ${tallyLine(tallyFor(bookId, finalRound))}` : "";
  notify(`📖 ${bookId} · ${outcome.status.toUpperCase()}`, summary.replace(/^AUTOPILOT[^:]*:\s*/, "") + finalTail);

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
