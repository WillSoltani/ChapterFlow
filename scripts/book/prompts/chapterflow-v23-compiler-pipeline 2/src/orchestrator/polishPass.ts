/**
 * polishPass — the v23 craft layer, reintroduced as a bounded, metrics-routed
 * polish stage that CANNOT corrupt provenance, keys, or grounding (F7).
 *
 * WHY THIS EXISTS
 * ---------------
 * The legacy whole-chapter writer (src/generateChapter.ts) ran a voice-pass, a
 * risk-gated line-editor, and a memorable-lines optimizer. The v23 compiler
 * route (compilerRun.ts `doCompilerWrite`) dropped all of it: sections → assembly
 * → evidence → risk, with NO sentence-level craft pass. The rubric consequence
 * on the-power-of-moments was Tone 63 / Density 66 / Retention 72.
 *
 * WHAT THIS DOES (and deliberately does NOT)
 * ------------------------------------------
 * `convergePolish` measures the DENSE/thin direction of the deterministic rubric
 * on the two SAFE-to-rewrite section artifacts — summary-pack (breakdown tiers)
 * and example-pack (scenarios) — and, for artifacts that FAIL, spawns one bounded
 * polish session per artifact that rewrites at the sentence level while preserving
 * verbatim every provenance/grounding field. It edits SECTION ARTIFACTS
 * (pre-assembly), then the caller re-validates and re-assembles. It NEVER edits
 * assembled `state/chapters/` (that is exactly the provenance drift F3 found), and
 * NEVER touches learning-pack (quiz keys) or action-pack (if-then structure) —
 * those are too fragile and are routed to targeted repair elsewhere (P12).
 *
 * Polish is BEST-EFFORT: it never halts the run on quality grounds. It halts only
 * on infra errors (a lost run lock). A polish session that fails is logged, not
 * fatal — assembly (and the strict final gates) still decide publishability.
 *
 * Selection uses the SAME config/rubric-thresholds.json as the P04 pre-flight, so
 * there is one ruler. We target only the DENSE/thin direction (ease below the
 * band's fail boundary; too-few clean memorable lines) — reading EASIER than the
 * band is not a defect, so it never triggers polish.
 */

import type { AutopilotDeps, AutopilotOutcome } from "./autopilot.js";
import { recordPolishSession } from "./sectionSessionRecord.js";
import { sectionTasks, sectionDoNotLines, type SectionTask } from "../sections/sectionTasks.js";
import { readJsonFile, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
import { cleanMemorableLineCount, houseTicDensity, nominalizationRate, readabilityMetrics } from "../metrics/rubricMetrics.js";
import { selectMemorableLinesDeterministic } from "../optimizers/memorableLines.js";
import { loadRubricThresholds, type RubricThresholds } from "../metrics/rubricThresholds.js";
import type { ChapterV21 } from "../types.js";
import type { ExamplePackV1, SummaryPackV1 } from "../artifacts/artifactTypes.js";
import { existsSync, readFileSync } from "fs";

type SpawnOptions = Parameters<AutopilotDeps["spawn"]>[0];

/** The env that selects the polish mode. `risk` (default) polishes only failing
 *  artifacts; `never` skips polish entirely (byte-for-byte no-op — the compiler
 *  write behaves exactly as before this pass existed); `always` polishes every
 *  summary/example artifact regardless of metrics. */
export const COMPILER_POLISH_MODE_ENV = "CHAPTERFLOW_COMPILER_POLISH";

export type PolishMode = "risk" | "never" | "always";

export function compilerPolishMode(env: NodeJS.ProcessEnv = process.env): PolishMode {
  const v = env[COMPILER_POLISH_MODE_ENV];
  return v === "never" || v === "always" ? v : "risk";
}

/** The kinds polish is allowed to touch. learning-pack/action-pack are OUT of
 *  scope (quiz keys + if-then structure are too fragile). */
export const POLISHABLE_KINDS = ["summary-pack", "example-pack"] as const;
export type PolishableKind = (typeof POLISHABLE_KINDS)[number];

function isPolishable(kind: SectionTask["kind"]): kind is PolishableKind {
  return kind === "summary-pack" || kind === "example-pack";
}

// ── metrics ──────────────────────────────────────────────────────────────────

export type PolishMetric = { key: string; value: number; target: string; failing: boolean };

export type PolishArtifactMetrics = {
  metrics: PolishMetric[];
  /** True iff a GATE metric is in its DENSE/thin fail zone — the polish trigger. */
  fail: boolean;
  /** Human-readable one-liners for the GATE metrics currently failing. */
  failingReasons: string[];
};

function round(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : n;
}

/** The DENSE-direction ease fail boundary. Mirrors bookRubricMetrics.bandVerdict's
 *  low-side FAIL condition (below min by more than warnTolerance), but one-sided:
 *  reading EASIER than the band is never a polish target. */
function easeIsDense(ease: number, t: RubricThresholds): boolean {
  return Number.isFinite(ease) && ease < t.fleschEase.min - t.fleschEase.warnTolerance;
}

function breakdownProseOf(pack: SummaryPackV1): string {
  const b = pack.breakdown;
  return [b?.fastRead, b?.deepRead, b?.fullRead].filter((p): p is string => typeof p === "string" && p.length > 0).join("\n\n");
}

function scenarioProseOf(pack: ExamplePackV1): string {
  return (pack.examples ?? []).map((e) => (typeof e.scenario === "string" ? e.scenario : "")).filter((s) => s.length > 0).join("\n\n");
}

/** Summary-pack: breakdown ease (GATE, dense) + clean memorable-line count (GATE,
 *  thin) + FK grade (advisory) + nominalization (advisory diagnostic). */
export function summaryPackMetrics(pack: SummaryPackV1, t: RubricThresholds): PolishArtifactMetrics {
  const prose = breakdownProseOf(pack);
  const r = readabilityMetrics(prose);
  const ease = r?.flesch ?? NaN;
  const fk = r?.fk ?? NaN;
  const memClean = cleanMemorableLineCount(
    selectMemorableLinesDeterministic({ breakdown: pack.breakdown } as unknown as ChapterV21).map((l) => l.text),
  );
  const nom = nominalizationRate(prose);

  const easeFail = easeIsDense(ease, t);
  const memFail = memClean < t.memorableCleanMin;
  const metrics: PolishMetric[] = [
    { key: "breakdownEase", value: round(ease), target: `≥ ${t.fleschEase.min} (dense-fail < ${t.fleschEase.min - t.fleschEase.warnTolerance})`, failing: easeFail },
    { key: "memorableClean", value: memClean, target: `≥ ${t.memorableCleanMin} clean (≤14-word) lines`, failing: memFail },
    { key: "breakdownFk", value: round(fk), target: `~${t.fkGrade.min}-${t.fkGrade.max} (advisory)`, failing: false },
    { key: "nominalizationRate", value: round(nom), target: `≤ ${t.nominalizationRateWarnMax}% (advisory)`, failing: false },
  ];
  const failingReasons: string[] = [];
  if (easeFail) failingReasons.push(`breakdown reads too dense (Flesch ease ${round(ease)}; lift toward the ${t.fleschEase.min}-${t.fleschEase.max} band)`);
  if (memFail) failingReasons.push(`only ${memClean} clean memorable line(s) (need ≥ ${t.memorableCleanMin}; each ≤14 words)`);
  return { metrics, fail: easeFail || memFail, failingReasons };
}

/** Example-pack: scenario ease (GATE, dense) + house-tic density (advisory). */
export function examplePackMetrics(pack: ExamplePackV1, t: RubricThresholds): PolishArtifactMetrics {
  const prose = scenarioProseOf(pack);
  const ease = readabilityMetrics(prose)?.flesch ?? NaN;
  const tics = houseTicDensity(prose);
  const easeFail = easeIsDense(ease, t);
  const metrics: PolishMetric[] = [
    { key: "scenarioEase", value: round(ease), target: `≥ ${t.fleschEase.min} (dense-fail < ${t.fleschEase.min - t.fleschEase.warnTolerance})`, failing: easeFail },
    { key: "houseTicDensity", value: tics, target: `≤ ${t.houseTicDensityWarnMax} (advisory)`, failing: false },
  ];
  const failingReasons: string[] = [];
  if (easeFail) failingReasons.push(`example scenarios read too dense (Flesch ease ${round(ease)}; lift toward the ${t.fleschEase.min}-${t.fleschEase.max} band)`);
  return { metrics, fail: easeFail, failingReasons };
}

export function artifactMetrics(kind: PolishableKind, pack: SummaryPackV1 | ExamplePackV1, t: RubricThresholds): PolishArtifactMetrics {
  return kind === "summary-pack" ? summaryPackMetrics(pack as SummaryPackV1, t) : examplePackMetrics(pack as ExamplePackV1, t);
}

// ── selection ──────────────────────────────────────────────────────────────────

export type PolishTarget = {
  task: SectionTask;
  kind: PolishableKind;
  metrics: PolishArtifactMetrics;
};

function readPack(task: SectionTask): SummaryPackV1 | ExamplePackV1 | null {
  try {
    return readJsonFile<SummaryPackV1 | ExamplePackV1>(task.outputPath);
  } catch {
    return null;
  }
}

/** Enumerate the summary/example artifacts on disk and decide which to polish.
 *  `mode`: `always` selects every present polishable artifact; `risk` selects only
 *  the ones whose metrics FAIL. One entry per artifact (a run polishes an artifact
 *  at most once, retried at most once — enforced by the caller). */
export function selectPolishTargets(tasks: SectionTask[], t: RubricThresholds, mode: PolishMode): PolishTarget[] {
  if (mode === "never") return [];
  const out: PolishTarget[] = [];
  for (const task of tasks) {
    if (!isPolishable(task.kind)) continue;
    if (!existsSync(task.outputPath)) continue;
    const pack = readPack(task);
    if (!pack) continue;
    const metrics = artifactMetrics(task.kind, pack, t);
    if (mode === "always" || metrics.fail) out.push({ task, kind: task.kind, metrics });
  }
  return out;
}

// ── polish task template ────────────────────────────────────────────────────────

/** Read any VOICE guidance the section-writer task card carried, so the polisher
 *  preserves the same register. Best-effort: absent/unreadable card → no clause. */
function voiceCardClause(task: SectionTask): string {
  try {
    if (!existsSync(task.taskPath)) return "";
    const card = readFileSync(task.taskPath, "utf8");
    if (!/\bVOICE\b/.test(card)) return "";
    return `- PRESERVE the VOICE register described in the section task card at ${task.taskPath}; match its tone, do not flatten it.`;
  } catch {
    return "";
  }
}

const SUMMARY_PRESERVE: string[] = [
  "- PRESERVE VERBATIM every provenance field: breakdown.sourceAnchorIds (all tiers), hook.sourceAnchorIds, keyTakeawaySourceAnchorIds, tryThisNowSourceAnchorIds, and sourceFactIds. Do not add, drop, or reorder any id.",
  "- PRESERVE VERBATIM every required hardSpecific phrase already cited from a source anchor (named people, places, dates, numbers). You may re-sentence AROUND them, but the hardSpecific tokens must survive character-for-character.",
  "- PRESERVE the MEANING of keyTakeaway and keep it ≤ 30 words. Light wording changes are allowed; do not change which idea it names.",
  "- Do NOT touch quiz, review cards, or the learning-pack/action-pack — they are out of scope for this pass.",
];

const EXAMPLE_PRESERVE: string[] = [
  "- PRESERVE VERBATIM every provenance field on every example: sourceAnchorIds, sourceFactIds, namedCaseIds, exampleId, and slotId. Do not add, drop, or reorder any id.",
  "- PRESERVE VERBATIM every required hardSpecific phrase already cited from the named case (people, places, dates, numbers). Re-sentence around them; the tokens must survive character-for-character.",
  "- PRESERVE the SEMANTICS of each whatToDo: it must still give the same reader instruction/test as before. Tighten wording only; do not swap it for a different action.",
  "- Do NOT change any example's protagonist name, named case, or numbers, and introduce NO new entities/numbers.",
  "- Do NOT touch quiz, review cards, or the learning-pack/action-pack — they are out of scope for this pass.",
];

/** Author the bounded polish task for ONE failing artifact. Names ONLY that
 *  artifact path, quotes the failing metrics + targets, instructs sentence-level
 *  rewriting, reuses the section DO-NOT block verbatim, and finishes with the
 *  scoped validate-sections command. */
export function buildPolishTask(target: PolishTarget): string {
  const { task, kind, metrics } = target;
  const failing = metrics.metrics.filter((m) => m.failing);
  const metricLines = (failing.length ? failing : metrics.metrics).map((m) => `- ${m.key} = ${m.value} — target ${m.target}${m.failing ? "  ← FAILING" : ""}`);
  const preserve = kind === "summary-pack" ? SUMMARY_PRESERVE : EXAMPLE_PRESERVE;
  const voice = voiceCardClause(task);
  const rewriteTargets = kind === "summary-pack"
    ? [
        "- Rewrite the breakdown tiers (fastRead, deepRead, fullRead) at the SENTENCE level: shorten long sentences, replace abstract nouns with concrete verbs, cut restatement, and de-nominalize (prefer \"decide\" over \"decision-making\").",
        "- Lift the assembled breakdown toward the Flesch ease band; do not pad — say the same thing in plainer, shorter sentences.",
        "- Strengthen 2–3 standalone memorable-line candidate sentences to ≤ 14 words each: portable, concrete, complete claims (not questions, not category lists, not \"if not/if so\" fragments).",
      ]
    : [
        "- Rewrite each example scenario at the SENTENCE level: shorten long sentences, replace abstract nouns with concrete verbs, cut restatement, and de-nominalize.",
        "- Keep every scene's protagonist, named case, decision, and outcome exactly as they are — only the PROSE gets plainer and tighter.",
      ];
  return [
    "ROLE",
    `You are the v23 COMPILER POLISH agent for ${task.bookId}, chapter ${task.chapterNumber}, ${kind}.`,
    "You perform a bounded, sentence-level craft pass on ONE section artifact. You do not add content, invent facts, or change what is taught — you make the existing prose read more clearly.",
    "",
    "ARTIFACT — edit ONLY this file",
    `- ${task.outputPath}`,
    `- Its section task card (source packet, blueprint, schema, VOICE guidance) is at: ${task.taskPath}`,
    "",
    "WHY THIS ARTIFACT WAS SELECTED (deterministic rubric metrics)",
    ...metricLines,
    "",
    "REWRITE INSTRUCTIONS",
    ...rewriteTargets,
    "",
    "PRESERVE (verbatim — a polish pass must not corrupt provenance, keys, or grounding)",
    ...preserve,
    ...(voice ? [voice] : []),
    "",
    "DO NOT",
    ...sectionDoNotLines(task.outputPath),
    "",
    "VALIDATION",
    `After editing, run and make sure it passes:\n\n  npx tsx src/cli.ts validate-sections ${task.bookId} --chapters ${task.chapterNumber} --section ${kind}\n`,
    "If any preservation constraint conflicts with a readability change, KEEP the constraint and leave that sentence as-is. Return a concise summary of what you tightened.",
  ].join("\n");
}

// ── converge ─────────────────────────────────────────────────────────────────

export type PolishOptions = {
  maxParallel: number;
  heartbeat?: () => boolean;
  mode?: PolishMode;
  ownerEnv?: Record<string, string>;
  /** Override thresholds (tests). Defaults to config/rubric-thresholds.json. */
  thresholds?: RubricThresholds;
  /** Override artifact roots (tests). */
  roots?: CompilerStoreRoots;
  /** Test seam: supply the section tasks directly instead of enumerating on disk. */
  tasks?: SectionTask[];
};

function halt(bookId: string, reason: string): AutopilotOutcome {
  return { status: "halt", bookId, phase: "write", category: "infra", reason };
}

async function mapWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

const POLISH_MAX_RETRIES = 1;

/** Spawn ONE polish session for a target and stamp its provenance on success. */
async function runOnePolish(bookId: string, deps: AutopilotDeps, target: PolishTarget, ownerEnv: Record<string, string>, attempt: number): Promise<void> {
  const { task, kind } = target;
  const label = `compiler-polish-${kind}-ch${String(task.chapterNumber).padStart(2, "0")}${attempt > 0 ? `-retry${attempt}` : ""}`;
  const sessionId = deps.mkSessionId(label);
  deps.log(`[autopilot] compiler polish ch${String(task.chapterNumber).padStart(2, "0")} ${kind}${attempt > 0 ? ` (retry ${attempt})` : ""}: ${target.metrics.failingReasons.join("; ") || "always-mode"}`);
  const r = await deps.spawn({
    task: buildPolishTask(target),
    sessionId,
    cwd: process.cwd(),
    sandbox: "workspace-write",
    reasoningEffort: "medium",
    env: ownerEnv,
  } as SpawnOptions);
  try { deps.logSession(bookId, label, r); } catch { /* best effort */ }
  if (r.ok) recordPolishSession(task, sessionId);
  else deps.log(`[autopilot] compiler polish ch${String(task.chapterNumber).padStart(2, "0")} ${kind} exited ${r.exitCode}`);
}

/** Re-measure ONE target from disk after a polish edit (fresh pack read). Returns
 *  the recomputed metrics, or the prior metrics if the artifact became unreadable
 *  (a torn artifact is caught by the caller's re-validation, not here). */
function remeasure(target: PolishTarget, t: RubricThresholds): PolishArtifactMetrics {
  const pack = readPack(target.task);
  if (!pack) return target.metrics;
  return artifactMetrics(target.kind, pack, t);
}

/**
 * Measure the polishable section artifacts, polish the ones that FAIL (one session
 * per artifact), re-measure, retry the still-failing once, and report. BEST-EFFORT:
 * never halts on quality — only on a lost run lock (infra). Shaped like the other
 * converge* functions (heartbeat / ownerEnv / halt categories).
 */
export async function convergePolish(bookId: string, deps: AutopilotDeps, opts: PolishOptions): Promise<AutopilotOutcome | null> {
  const mode = opts.mode ?? compilerPolishMode();
  if (mode === "never") return null;
  const heartbeat = opts.heartbeat ?? (() => true);
  const ownerEnv = opts.ownerEnv ?? {};
  const thresholds = opts.thresholds ?? loadRubricThresholds();
  const tasks = opts.tasks ?? sectionTasks(bookId, opts.roots);

  if (!heartbeat()) return halt(bookId, `lost the run lock for ${bookId} before compiler polish`);

  const targets = selectPolishTargets(tasks, thresholds, mode);
  if (targets.length === 0) {
    deps.log(`[autopilot] compiler polish (${mode}): no summary/example artifacts need polishing`);
    return null;
  }
  deps.log(`[autopilot] compiler polish (${mode}): polishing ${targets.length} artifact(s) (parallel ≤${opts.maxParallel})`);

  // First pass — one session per selected artifact.
  await mapWithConcurrency(targets, opts.maxParallel, async (target) => {
    if (!heartbeat()) return; // lost lock mid-run: stop spawning; the check below halts
    await runOnePolish(bookId, deps, target, ownerEnv, 0);
  });
  if (!heartbeat()) return halt(bookId, `lost the run lock for ${bookId} during compiler polish`);

  // Retry pass (capped at 1) — only artifacts still failing on a fresh read. In
  // `always` mode there is no fail condition, so nothing is retried.
  let retried = 0;
  let stillFailing = 0;
  if (mode !== "always") {
    const retryTargets = targets
      .map((target) => ({ target, metrics: remeasure(target, thresholds) }))
      .filter((x) => x.metrics.fail)
      .map((x) => ({ ...x.target, metrics: x.metrics }));
    if (retryTargets.length) {
      await mapWithConcurrency(retryTargets, opts.maxParallel, async (target) => {
        if (!heartbeat()) return;
        await runOnePolish(bookId, deps, target, ownerEnv, POLISH_MAX_RETRIES);
      });
      retried = retryTargets.length;
      if (!heartbeat()) return halt(bookId, `lost the run lock for ${bookId} during compiler polish retry`);
      stillFailing = retryTargets
        .map((target) => remeasure(target, thresholds))
        .filter((m) => m.fail).length;
    }
  }
  deps.log(`[autopilot] compiler polish (${mode}): polished ${targets.length}, retried ${retried}, still-below-target ${stillFailing} (best-effort — assembly + gates decide publishability)`);
  return null;
}
