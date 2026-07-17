/**
 * WP-603 — stage-level progress reporting for the `generate-book` terminal command.
 *
 * `generateBookCommand.ts` (WP-601) already prints a truthful startup summary and a
 * terminal artifact-location block. This module adds a STRUCTURED progress emitter
 * that reports each stage of the 12-step lifecycle (see that module's header) as it
 * starts/completes, through the SAME injected log seam (`deps.log`) — no parallel
 * logging framework, no new telemetry.
 *
 * Honesty constraint (WP-601/WP-603 out-of-scope: don't touch the conductor). Steps
 * 5-9 of the 12-step lifecycle — execute the author-first pipeline, persist per-stage
 * state, run the floor + D7 gate, produce the V21 output, run final validation — all
 * happen INSIDE one call into the conductor (`runAutopilot`). This layer cannot see
 * those five sub-phases independently, so reporting five separate start/complete
 * pairs for work it never observed would be a fabricated phase. Those steps are
 * therefore reported as ONE honestly-labeled bundled span: `author-pipeline`
 * ("steps 5-9").
 *
 * Verbosity contract:
 *   - quiet (default): only MILESTONE steps print, and only their COMPLETION line.
 *   - --verbose: every step prints both a start line and a complete line.
 *   - Regardless of quiet/verbose, any non-"ok" completion (warn/fatal) ALWAYS
 *     prints — a halted or blocked run must never go silent (directive 3).
 *
 * Status vocabulary is deliberately the SAME three levels `DoctorFinding` already
 * uses (`ok` / `warn` / `fatal`) rather than a new one.
 */

export type GenerateBookStepId =
  | "config"
  | "model-check"
  | "preflight"
  | "clobber-check"
  | "init-run"
  | "author-pipeline"
  | "classify"
  | "artifacts";

export type GenerateBookStepStatus = "ok" | "warn" | "fatal";

type StepDef = { num: string; title: string; milestone: boolean };

/** One row per lifecycle stage this LAYER can observe starting/completing. `num`
 *  mirrors the module-header numbering in generateBookCommand.ts (steps 5-9 collapse
 *  to the single conductor-owned `author-pipeline` span — see the module header). */
export const GENERATE_BOOK_STEP_DEFS: Record<GenerateBookStepId, StepDef> = {
  config: { num: "2", title: "load + resolve config", milestone: false },
  "model-check": { num: "3", title: "confirm the model is supported", milestone: false },
  preflight: { num: "1", title: "validate prerequisites (doctor preflight)", milestone: true },
  "clobber-check": { num: "4a", title: "refuse-clobber guard", milestone: false },
  "init-run": { num: "4", title: "init/resume the run (mint run id)", milestone: false },
  "author-pipeline": { num: "5-9", title: "execute the author-first pipeline (conductor)", milestone: true },
  classify: { num: "10", title: "classify the outcome", milestone: false },
  artifacts: { num: "11", title: "print artifact + evidence locations", milestone: true },
};

/** The lifecycle in the order `generateBookCommand` actually reaches each stage
 *  (used by tests to assert the canonical sequence; not every run reaches every
 *  step — an early exit legitimately stops the sequence short). */
export const GENERATE_BOOK_STEP_ORDER: readonly GenerateBookStepId[] = [
  "config",
  "model-check",
  "preflight",
  "clobber-check",
  "init-run",
  "author-pipeline",
  "classify",
  "artifacts",
];

export type ProgressPhase = "start" | GenerateBookStepStatus;

export type ProgressEvent = {
  step: GenerateBookStepId;
  num: string;
  title: string;
  phase: ProgressPhase;
  /** Milliseconds since the matching `start` — `null` on a `start` event, or on a
   *  `complete` with no matching `start` (never a fabricated 0). */
  elapsedMs: number | null;
  detail?: string;
};

const ICON: Record<ProgressPhase, string> = { start: "…", ok: "✓", warn: "⚠", fatal: "✗" };

export function formatProgressLine(e: ProgressEvent): string {
  const icon = ICON[e.phase];
  const elapsed = e.elapsedMs != null ? ` (${e.elapsedMs}ms)` : "";
  const suffix = e.phase === "start" ? "" : `: ${e.phase}`;
  const detail = e.detail ? ` — ${e.detail}` : "";
  return `[progress] [${e.num}/12] ${icon} ${e.title}${suffix}${elapsed}${detail}`;
}

export type ProgressReporter = {
  start(step: GenerateBookStepId, detail?: string): void;
  complete(step: GenerateBookStepId, status: GenerateBookStepStatus, detail?: string): void;
  /** Every event emitted this run, in order — the deterministic record a test
   *  captures directly (in addition to whatever reached `log`). */
  readonly events: readonly ProgressEvent[];
};

/**
 * Build a progress reporter over the command's OWN injected `log`/`now` seam
 * (never `console.*` directly, never a new clock) — fully deterministic and
 * injectable: a test supplies a fake `now` (e.g. an incrementing counter) and a
 * capturing `log`, and can additionally read `.events` back directly.
 */
export function createProgressReporter(opts: {
  log: (line: string) => void;
  now: () => number;
  verbose: boolean;
}): ProgressReporter {
  const { log, now, verbose } = opts;
  const startedAt = new Map<GenerateBookStepId, number>();
  const events: ProgressEvent[] = [];
  return {
    events,
    start(step, detail) {
      startedAt.set(step, now());
      const def = GENERATE_BOOK_STEP_DEFS[step];
      const event: ProgressEvent = { step, num: def.num, title: def.title, phase: "start", elapsedMs: null, detail };
      events.push(event);
      if (verbose) log(formatProgressLine(event));
    },
    complete(step, status, detail) {
      const t0 = startedAt.get(step);
      const elapsedMs = t0 === undefined ? null : now() - t0;
      const def = GENERATE_BOOK_STEP_DEFS[step];
      const event: ProgressEvent = { step, num: def.num, title: def.title, phase: status, elapsedMs, detail };
      events.push(event);
      // Quiet mode still speaks up for anything that isn't a clean "ok" — a
      // halted/blocked run must never read as silence (directive 3).
      if (verbose || def.milestone || status !== "ok") log(formatProgressLine(event));
    },
  };
}
