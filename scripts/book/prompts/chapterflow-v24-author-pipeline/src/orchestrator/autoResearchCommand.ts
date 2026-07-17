/**
 * WP-701b — the `auto-research <bookId> --title X --author Y` stage verb.
 *
 * ONE documented entry that runs EXACTLY the autopilot's COMPLIANT codex research phase
 * (research → chapter index + source-v2 sidecars) and STOPS before authoring. It exists
 * because the Phase-6 corpus freeze needs a single V25-policy research run per book that
 * never advances into writing:
 *   - the legacy `research` verb (cli.ts → researcher.ts) routes via the Anthropic provider
 *     router — non-codex, outside modelPolicy, unledgered — and MUST NOT be used;
 *   - the compliant research lives only inside the autopilot's doResearch (role "research"
 *     → modelPolicy, hermetic envelope, WP-503-ledgered), but the autopilot phase loop has
 *     no phase-stop. This verb reuses doResearch through `runAutoResearch` and returns.
 *
 * This module holds the command's testable CORE (arg parse, fresh-book preflight, exit-code
 * classification); `src/cli.ts`'s `runAutoResearchVerb` parses argv and calls it with
 * production deps. Every seam is injectable so the whole command is exercised MODEL-FREE.
 * A REAL research run is an owner-D-3-gated Phase-6 live call (ledger L-37).
 *
 * ── Exit-code table (truthful; distinct per failure class) ──────────────────────
 *   0  OK             — research complete: chapter index + source-v2 sidecars on disk.
 *   1  HALT           — a research halt not otherwise classified (fallback).
 *   2  USAGE          — bad args / missing --title/--author / a non-canonical bookId
 *                       (governance halt) / a FATAL global preflight finding.
 *   3  LOCK_REFUSED   — a second concurrent run could not take the same-book lock.
 *   4  HALT_INFRA     — research halted 'infra' (session exited / transient — inspect & retry).
 *   5  HALT_CONTENT   — research halted 'content' (a restored archive / genuine research
 *                       failure — remove backups from reach or re-dispatch research).
 *   6  HALT_PROGRESS  — research made no progress (no chapter index after the retry cap).
 */

import {
  runAutoResearch,
  type AutoResearchOutcome,
} from "./autopilot.js";
import {
  runGeneratePreflightChecks,
  formatDoctor,
  type DoctorFinding,
} from "../lifecycle/doctor.js";

/** Exit codes — the truthful operator contract (see the module header table). */
export const AUTO_RESEARCH_EXIT = {
  OK: 0,
  HALT: 1,
  USAGE: 2,
  LOCK_REFUSED: 3,
  HALT_INFRA: 4,
  HALT_CONTENT: 5,
  HALT_PROGRESS: 6,
} as const;

export type AutoResearchParsed = {
  bookId: string;
  title: string;
  author: string;
};

export type ParseResult =
  | { ok: true; parsed: AutoResearchParsed }
  | { ok: false; code: number; message: string };

function stringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

export function parseAutoResearchArgs(
  args: string[],
  flags: Record<string, string | boolean>,
): ParseResult {
  const bookId = args[0];
  if (!bookId) {
    return {
      ok: false,
      code: AUTO_RESEARCH_EXIT.USAGE,
      message:
        'Usage: auto-research <bookId> --title "<title>" --author "<author>"\n' +
        "  Runs the COMPLIANT codex research phase (role=research → modelPolicy, hermetic\n" +
        "  envelope, ≤2 passes, freshness-checked) and STOPS before authoring: it writes the\n" +
        "  chapter index (state/indexes/<bookId>.json) + source-v2 sidecars, then halts.\n" +
        "  NOT the legacy `research` verb (that routes off-policy through the Anthropic router).",
    };
  }
  const title = stringFlag(flags, "title");
  const author = stringFlag(flags, "author");
  if (!title || !author) {
    return {
      ok: false,
      code: AUTO_RESEARCH_EXIT.USAGE,
      message: "Both --title and --author are required (the book's declared identity, recorded in the run ledger).",
    };
  }
  return { ok: true, parsed: { bookId, title, author } };
}

/** Injectable seams so the whole command is exercised model-free in tests. The defaults are
 *  the production pieces; a test overrides `runConductor`/`runPreflight` to drive the flow
 *  without spawning a single codex session. */
export type AutoResearchDeps = {
  /** The compliant research entrypoint (runAutoResearch). Tests pass a scripted double. */
  runConductor: (opts: { bookId: string; title?: string; author?: string; runId?: string }) => Promise<AutoResearchOutcome>;
  /** The GLOBAL fresh-book doctor preflight (WP-602b fresh path). Tests pass a stub. */
  runPreflight: (opts: { bookId?: string; resume?: boolean }) => Promise<DoctorFinding[]>;
  now: () => number;
  log: (line: string) => void;
  /** Env surface so a run reads/sets CHAPTERFLOW_RUN_ID without leaking into the parent
   *  process in tests. */
  env: Record<string, string | undefined>;
};

export function defaultAutoResearchDeps(): AutoResearchDeps {
  return {
    runConductor: runAutoResearch,
    // The WP-602b fresh-book preflight: GLOBAL doctor battery + the fresh-vs-existing gate on
    // the per-book existing-state checks (a genuinely fresh new book runs the globals only, no
    // per-book fatal). Reused verbatim — this verb invents NO new checks.
    runPreflight: runGeneratePreflightChecks,
    now: () => Date.now(),
    log: (line) => console.log(line),
    env: process.env as Record<string, string | undefined>,
  };
}

// ── outcome → exit code ──────────────────────────────────────────────────────────

export type ExitClassification = { code: number; label: string; reason: string };

/** Map an AutoResearchOutcome to a truthful, DISTINCT exit code. A lock refusal is exit 3
 *  (its own circuit-breaker class); the research-phase halt categories map to distinct codes
 *  (infra 4 / content 5 / progress 6); a non-canonical bookId (governance halt) is a usage
 *  error (exit 2); success is exit 0. */
export function classifyAutoResearchExit(outcome: AutoResearchOutcome): ExitClassification {
  if (outcome.status === "research-complete") {
    return { code: AUTO_RESEARCH_EXIT.OK, label: "RESEARCH_COMPLETE", reason: outcome.message };
  }
  const reason = outcome.reason;
  // The same lock phrase runAutoResearch (and runAutopilot) emit — detected here so a
  // concurrent second run is truthfully the LOCK_REFUSED class, not a generic infra halt.
  if (/could not acquire the run lock|lost the run lock/i.test(reason)) {
    return { code: AUTO_RESEARCH_EXIT.LOCK_REFUSED, label: "LOCK_REFUSED", reason };
  }
  switch (outcome.category) {
    case "infra": return { code: AUTO_RESEARCH_EXIT.HALT_INFRA, label: "HALT_INFRA", reason };
    case "content": return { code: AUTO_RESEARCH_EXIT.HALT_CONTENT, label: "HALT_CONTENT", reason };
    case "progress": return { code: AUTO_RESEARCH_EXIT.HALT_PROGRESS, label: "HALT_PROGRESS", reason };
    case "governance": return { code: AUTO_RESEARCH_EXIT.USAGE, label: "USAGE", reason };
    default: return { code: AUTO_RESEARCH_EXIT.HALT, label: "HALT", reason };
  }
}

// ── the command ────────────────────────────────────────────────────────────────

export type AutoResearchResult = {
  code: number;
  /** The classification label (RESEARCH_COMPLETE / PREFLIGHT_FATAL / LOCK_REFUSED /
   *  HALT_INFRA / HALT_CONTENT / HALT_PROGRESS / USAGE / HALT). */
  label: string;
  /** True once the compliant research phase was invoked (false for a pre-work exit). */
  ranConductor: boolean;
  /** The run id used for the ledger (undefined only for a pre-conductor exit). */
  runId?: string;
};

export async function autoResearchCommand(
  parsed: AutoResearchParsed,
  depsOverride?: Partial<AutoResearchDeps>,
): Promise<AutoResearchResult> {
  const deps: AutoResearchDeps = { ...defaultAutoResearchDeps(), ...depsOverride };
  const log = deps.log;
  const bookId = parsed.bookId;

  // ── step 1: GLOBAL fresh-book preflight (WP-602b fresh path) BEFORE spawning. A FATAL
  //    finding refuses to spawn (exit 2); warns are advisory and printed. ──
  const findings = await deps.runPreflight({ bookId });
  const fatals = findings.filter((f) => f.level === "fatal");
  log(formatDoctor(findings));
  if (fatals.length > 0) {
    log(`auto-research: preflight found ${fatals.length} FATAL finding(s) — refusing to spawn research for ${bookId}. Fix the above, then retry.`);
    return { code: AUTO_RESEARCH_EXIT.USAGE, label: "PREFLIGHT_FATAL", ranConductor: false };
  }

  // ── step 2: mint a stable WP-503 run id so the printed artifact locations belong to THIS
  //    run (the conductor reuses it for the unified call ledger). ──
  const runId = deps.env.CHAPTERFLOW_RUN_ID ?? `auto-research-${bookId}-${deps.now()}`;
  log(`auto-research — ${bookId}`);
  log(`  title:   ${parsed.title} · author: ${parsed.author}`);
  log(`  mode:    compliant codex research (role=research → modelPolicy sol@high, hermetic envelope, ≤2 passes, freshness-checked); STOPS before authoring`);
  log(`  run id:  ${runId}`);

  // ── step 3: run EXACTLY the autopilot research phase, then STOP (no write/author phase). ──
  const outcome = await deps.runConductor({ bookId, title: parsed.title, author: parsed.author, runId });

  const cls = classifyAutoResearchExit(outcome);
  if (outcome.status === "research-complete") {
    log(`auto-research: RESEARCH_COMPLETE — ${outcome.message}`);
    log(`  chapter index:      ${outcome.indexPath}`);
    log(`  source-v2 sidecars: ${outcome.sidecarsDir ? `${outcome.sidecarsDir}/<run>/sidecars/source/` : `(under .chapterflow/runs/${bookId}/<run>/sidecars/source/)`}`);
    log(`  next step (owner-gated authoring, SEPARATE): npx tsx src/cli.ts generate-book ${bookId} --title "${parsed.title}" --author "${parsed.author}" --resume`);
  } else {
    log(`auto-research: ${cls.label} (research ${outcome.phase} halt · category ${outcome.category}) — ${cls.reason}`);
  }
  return { code: cls.code, label: cls.label, ranConductor: true, runId };
}
