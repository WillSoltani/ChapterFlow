import type { AutopilotDeps, AutopilotOutcome, VerbResult } from "./autopilot.js";
import { missingSectionTasks, readSectionTask, sectionTasks } from "../sections/sectionTasks.js";
import { sourcePrewriteRepairPrompt } from "./compilerTasks.js";
import { contributorSessionIdsForChapter, writeSectionSessionRecord } from "./sectionSessionRecord.js";
import { convergePolish, compilerPolishMode } from "./polishPass.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { recordCompilerAssemblyProvenance } from "../qc/sessionProvenance.js";
import { acquireCompilerWriteLock, assemblyInputPath, COMPILER_RUN_OWNER_ENV, sectionPath } from "../artifacts/artifactStore.js";
import { SECTION_KINDS } from "../artifacts/artifactTypes.js";
import { normSlug } from "../lib/chapterPaths.js";

const SOURCE_REPAIR_MAX_PASSES = 3;
export const SECTION_REPAIR_MAX_PASSES = 2;

type SpawnOptions = Parameters<AutopilotDeps["spawn"]>[0];

export function stampCompilerAssemblyProvenance(bookId: string, deps: Pick<AutopilotDeps, "mkSessionId" | "log">): number {
  let stamped = 0;
  for (const chapter of loadBookChapters(bookId)) {
    const assemblerSessionId = deps.mkSessionId(`compiler-assembly-ch${chapter.number}`);
    const contributors = contributorSessionIdsForChapter(bookId, chapter.number);
    const p = recordCompilerAssemblyProvenance({
      chapterId: chapter.chapterId,
      assemblerSessionId,
      contentHash: chapterContentHash(chapter),
      contributorSessionIds: contributors,
    });
    if (p) stamped++;
  }
  deps.log(`[autopilot] compiler assembly provenance: stamped ${stamped} chapter author record(s)`);
  return stamped;
}

type CompilerWriteOptions = {
  maxParallel: number;
  heartbeat?: () => boolean;
};

function halt(bookId: string, reason: string, category: "infra" | "content" = "content"): AutopilotOutcome {
  return { status: "halt", bookId, phase: "write", category, reason };
}

async function spawnAndLog(bookId: string, deps: AutopilotDeps, label: string, opts: SpawnOptions) {
  const r = await deps.spawn(opts);
  try { deps.logSession(bookId, label, r); } catch { /* best effort */ }
  return r;
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

function reportOf(r: VerbResult): string {
  return (r.stdout || r.stderr || "").trim();
}

async function convergeSourceReadiness(bookId: string, deps: AutopilotDeps, heartbeat: () => boolean, ownerEnv: Record<string, string> = {}): Promise<AutopilotOutcome | null> {
  let lastReport = "";
  for (let attempt = 0; attempt <= SOURCE_REPAIR_MAX_PASSES; attempt++) {
    if (!heartbeat()) return halt(bookId, `lost the run lock for ${bookId} while checking source readiness — halting to avoid two conductors on the same book.`, "infra");
    const gate = await deps.runVerb(["source-v2-gate", bookId, "--prewrite"], ownerEnv);
    lastReport = reportOf(gate);
    if (gate.code === 0) {
      if (attempt > 0) deps.log(`[autopilot] compiler source readiness PASS after ${attempt} repair attempt(s)`);
      return null;
    }
    if (gate.code >= 2) return halt(bookId, `source-v2-gate --prewrite errored (exit ${gate.code}) before compiler sections — inspect research/index state:\n${lastReport.slice(0, 1200)}`, "infra");
    if (attempt >= SOURCE_REPAIR_MAX_PASSES) break;
    deps.log(`[autopilot] compiler source repair attempt ${attempt + 1}/${SOURCE_REPAIR_MAX_PASSES}: repairing authoring-ready source packets before section generation`);
    const task = sourcePrewriteRepairPrompt(bookId, lastReport, attempt + 1, SOURCE_REPAIR_MAX_PASSES);
    const r = await spawnAndLog(bookId, deps, `compiler-source-repair-${attempt + 1}`, {
      task,
      sessionId: deps.mkSessionId(`compiler-source-repair-${attempt + 1}`),
      cwd: process.cwd(),
      sandbox: "workspace-write",
      reasoningEffort: "medium",
      env: ownerEnv,
    } as SpawnOptions);
    if (!r.ok) deps.log(`[autopilot] compiler source repair exited ${r.exitCode}`);
  }
  return halt(bookId, `source-v2-gate --prewrite still BLOCKS before section generation. Fix source sidecars manually.\n${lastReport.slice(0, 2000)}`);
}

async function runCompilerVerb(bookId: string, deps: AutopilotDeps, args: string[], label: string, ownerEnv: Record<string, string> = {}): Promise<AutopilotOutcome | null> {
  const r = await deps.runVerb(args, ownerEnv);
  if (r.code === 0) {
    const line = reportOf(r).split(/\r?\n/).slice(-1)[0] ?? "PASS";
    deps.log(`[autopilot] compiler ${label}: ${line}`);
    return null;
  }
  const category = r.code >= 2 ? "infra" : "content";
  return halt(bookId, `compiler ${label} failed (exit ${r.code}).\n${reportOf(r).slice(0, 2000)}`, category);
}

async function spawnMissingSectionTasks(bookId: string, deps: AutopilotDeps, maxParallel: number, ownerEnv: Record<string, string> = {}): Promise<void> {
  const missing = missingSectionTasks(bookId);
  if (missing.length === 0) {
    deps.log(`[autopilot] compiler sections: all section artifacts already present`);
    return;
  }
  deps.log(`[autopilot] compiler sections: authoring ${missing.length} section artifact(s) (parallel ≤${maxParallel})`);
  await mapWithConcurrency(missing, maxParallel, async (task) => {
    const prompt = readSectionTask(task);
    const sid = deps.mkSessionId(`section-${task.kind}-ch${task.chapterNumber}`);
    deps.log(`[autopilot] section ch${String(task.chapterNumber).padStart(2, "0")} ${task.kind}: writer working`);
    const r = await spawnAndLog(bookId, deps, `section-${task.kind}-ch${task.chapterNumber}`, {
      task: prompt,
      sessionId: sid,
      cwd: process.cwd(),
      sandbox: "workspace-write",
      reasoningEffort: "medium",
      env: ownerEnv,
    } as SpawnOptions);
    if (r.ok) writeSectionSessionRecord(task, sid);
    deps.log(`[autopilot] section ch${String(task.chapterNumber).padStart(2, "0")} ${task.kind}: exited ${r.exitCode}`);
  });
}

// P07: repair rules mirror the section task card's layered brief — universal
// invariants + a POINTER to the validator message (the spec) + the book-scars
// mention + VOICE preservation. The per-check prose restatements were deleted:
// the section/book gates (SEC80-SEC118, AS5-AS13) enforce them, and the validator
// finding already names the exact check id and field for the repair agent to fix.
const SECTION_REPAIR_RULES: readonly string[] = [
    "- Open the relevant task card(s); each contains the exact source packet, this section's blueprint slots, output path, schema, the book's KNOWN OVER-USED MATERIAL block (if any), and the VOICE CARD for this book.",
    "- Edit only the failing section output JSON. Preserve sourceAnchorIds and the blueprint correctIndex pattern.",
    "- Fix exactly what the validator names: every finding cites its check id (SEC*/AS*) and the offending field/path. Treat that message as the spec - do not guess beyond it.",
    "- If an example-pack fails count, rewrite it as the exact six blueprint examples; do not append filler examples to an old pack.",
    "- Anchor rule: when an example/quiz/card/action cites a namedExample anchor, include at least two of that anchor's hardSpecifics verbatim so the source-provenance gate can verify it; whyItMatters must explain the same sourceFactIds and the decision shown.",
    "- DESIGN AROUND the cross-chapter and leak gates rather than restating them: give same-position slots (AS5/AS6/AS8/AS9/AS10) distinct scenarios, mechanisms, and scene engines; keep reader prose free of source-note numbering, jammed CamelCase labels, and any anchor label's \" / \" seam (SEC103/SEC104/SEC105).",
    "- Honor the book's KNOWN OVER-USED MATERIAL (config/book-scars/<bookId>.json): a listed phrase or frame may appear in at most one teaching unit book-wide - paraphrase the mechanism everywhere else.",
    "- Preserve the VOICE CARD register the task set for this book (register, person, cadence, warmth); do not revert to a neutral textbook voice, quote the card, mention the author, or import register from another book.",
    "- Never keep hard-banned register phrases/opener shells (\"The trap is to\", \"Most people think\", ...) and do not overuse soft-banned house tics (\"rather than\", \"That matters because\", ...); if the gate reports SEC90/SEC92, rewrite with plain alternatives.",
    "- Do not weaken schemas or gates, edit other chapters, or invent new real-world entities, numbers, dates, people, institutions, or outcomes.",
];

function sectionRepairPrompt(bookId: string, report: string): string {
  const tasks = sectionTasks(bookId).map((t) => `- ch${String(t.chapterNumber).padStart(2, "0")} ${t.kind}: task=${t.taskPath} output=${t.outputPath}`).join("\n");
  return [
    "ROLE",
    `You are a v23 COMPILER SECTION REPAIR agent for bookId ${bookId}.`,
    "",
    "The section validator blocked before ChapterV21 assembly. Fix only the section artifact JSON files named by the validator. Do not edit chapters, QC artifacts, schemas, gates, source sidecars, or pipeline code.",
    "",
    "VALIDATOR REPORT",
    report,
    "",
    "AVAILABLE SECTION TASKS",
    tasks,
    "",
    "REPAIR RULES",
    ...SECTION_REPAIR_RULES,
    `- After editing, run: npx tsx src/cli.ts validate-sections ${bookId}`,
    "",
    "Return a concise summary of the files fixed and the validation result.",
  ].join("\n");
}

/** chNN from an assemble-sections finding line ("chNN: <message>"). Assembly failures are
 *  reported per-chapter (assembleSections.ts wraps each chapter in its own try/catch), so this
 *  lets the conductor isolate exactly which chapter(s) need repair instead of treating any single
 *  bad chapter as a whole-book failure. Findings that don't match (e.g. "no resolvable chapters: …")
 *  are book-wide problems, not chapter-scoped ones — callers must fall back to a generic halt. */
function chapterNumbersFromAssemblyFindings(report: string): number[] {
  const nums = new Set<number>();
  for (const line of report.split(/\r?\n/)) {
    const m = line.trim().match(/^ch(\d+):/);
    if (m) nums.add(Number(m[1]));
  }
  return [...nums].sort((a, b) => a - b);
}

function assemblyRepairPrompt(bookId: string, chapters: number[], report: string, attempt: number, maxAttempts: number): string {
  const chapterList = chapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ");
  const tasks = sectionTasks(bookId)
    .filter((t) => chapters.includes(t.chapterNumber))
    .map((t) => `- ch${String(t.chapterNumber).padStart(2, "0")} ${t.kind}: task=${t.taskPath} output=${t.outputPath}`)
    .join("\n");
  return [
    "ROLE",
    `You are a v23 COMPILER ASSEMBLY REPAIR agent for bookId ${bookId} (attempt ${attempt}/${maxAttempts}).`,
    "",
    `ChapterV21 assembly failed for chapter(s) ${chapterList} ONLY — every other chapter in this book assembled cleanly. Fix only the section artifact JSON files for ${chapterList} named below. Do not open, edit, or re-validate any file for a chapter not listed above, and do not edit chapters, QC artifacts, schemas, gates, source sidecars, or pipeline code.`,
    "",
    "ASSEMBLY ERROR REPORT",
    report,
    "",
    `SECTION ARTIFACTS FOR ${chapterList} ONLY`,
    tasks,
    "",
    "REPAIR RULES",
    ...SECTION_REPAIR_RULES,
    `- After editing, run: npx tsx src/cli.ts validate-sections ${bookId} --chapters ${chapters.join(",")} && npx tsx src/cli.ts assemble-sections ${bookId}`,
    "",
    "Return a concise summary of the files fixed and the validation result.",
  ].join("\n");
}

/** stdout+stderr combined: assemble-sections prints "wrote <path>" (stdout) for chapters that
 *  succeed and "chNN: <message>" findings (stderr) for chapters that fail. A partial-failure run
 *  emits BOTH, so picking only one stream (as reportOf's stdout-or-stderr does) can silently drop
 *  the findings that name the failing chapter(s). */
function assemblyReportOf(r: VerbResult): string {
  return [r.stdout, r.stderr].filter((s) => s && s.trim().length > 0).join("\n").trim();
}

export async function convergeAssembly(bookId: string, deps: AutopilotDeps, maxParallel: number, heartbeat: () => boolean, ownerEnv: Record<string, string> = {}): Promise<AutopilotOutcome | null> {
  for (let attempt = 0; attempt <= SECTION_REPAIR_MAX_PASSES; attempt++) {
    if (!heartbeat()) return halt(bookId, `lost the run lock for ${bookId} during compiler assembly`, "infra");
    const r = await deps.runVerb(["assemble-sections", bookId], ownerEnv);
    const report = assemblyReportOf(r);
    if (r.code === 0) {
      if (attempt > 0) deps.log(`[autopilot] compiler assembly PASS after ${attempt} chapter-scoped repair attempt(s)`);
      else deps.log(`[autopilot] compiler assembly: ${report.split(/\r?\n/).slice(-1)[0] ?? "PASS"}`);
      return null;
    }
    if (r.code >= 2) return halt(bookId, `compiler assembly errored (exit ${r.code}) — inspect section artifacts:\n${report.slice(0, 2000)}`, "infra");
    const failing = chapterNumbersFromAssemblyFindings(report);
    if (failing.length === 0) {
      // Not chapter-scoped (e.g. the canonical chapter index itself didn't resolve) — there is no
      // single chapter to isolate a repair to, so fall back to the original whole-book halt.
      return halt(bookId, `compiler assembly failed (exit ${r.code}).\n${report.slice(0, 2000)}`);
    }
    const chapterList = failing.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ");
    if (attempt >= SECTION_REPAIR_MAX_PASSES) {
      const artifactPaths = failing.flatMap((n) => [assemblyInputPath(bookId, n), ...SECTION_KINDS.map((kind) => sectionPath(bookId, n, kind))]);
      const scopedFindings = report.split(/\r?\n/).filter((line) => failing.some((n) => line.trim().startsWith(`ch${String(n).padStart(2, "0")}:`))).join("\n");
      return halt(
        bookId,
        `compiler assembly still fails for chapter(s) ${chapterList} after ${SECTION_REPAIR_MAX_PASSES} chapter-scoped repair attempt(s). Every other chapter assembled successfully — inspect only these artifacts:\n${artifactPaths.join("\n")}\n\nLatest findings:\n${scopedFindings.slice(0, 2000)}`,
      );
    }
    deps.log(`[autopilot] compiler assembly repair attempt ${attempt + 1}/${SECTION_REPAIR_MAX_PASSES}: chapter(s) ${chapterList} only`);
    const scopedReport = report.split(/\r?\n/).filter((line) => failing.some((n) => line.trim().startsWith(`ch${String(n).padStart(2, "0")}:`))).join("\n");
    await mapWithConcurrency(failing, maxParallel, async (chapterNumber) => {
      const chapterReport = report.split(/\r?\n/).filter((line) => line.trim().startsWith(`ch${String(chapterNumber).padStart(2, "0")}:`)).join("\n") || scopedReport;
      const label = `compiler-assembly-repair-${attempt + 1}-ch${String(chapterNumber).padStart(2, "0")}`;
      const r2 = await spawnAndLog(bookId, deps, label, {
        task: assemblyRepairPrompt(bookId, [chapterNumber], chapterReport, attempt + 1, SECTION_REPAIR_MAX_PASSES),
        sessionId: deps.mkSessionId(label),
        cwd: process.cwd(),
        sandbox: "workspace-write",
        reasoningEffort: "medium",
        env: ownerEnv,
      } as SpawnOptions);
      if (!r2.ok) deps.log(`[autopilot] compiler assembly repair ch${String(chapterNumber).padStart(2, "0")} exited ${r2.exitCode}`);
    });
  }
  // Every loop iteration either returns success (code 0), halts on error/exhaustion, or repairs
  // and continues — assembly invalidity must always halt, never fall through to success.
  throw new Error("unreachable: assembly repair loop must halt or return within the bounded attempts");
}

async function convergeSections(bookId: string, deps: AutopilotDeps, maxParallel: number, heartbeat: () => boolean, ownerEnv: Record<string, string> = {}): Promise<AutopilotOutcome | null> {
  await spawnMissingSectionTasks(bookId, deps, maxParallel, ownerEnv);
  for (let attempt = 0; attempt <= SECTION_REPAIR_MAX_PASSES; attempt++) {
    if (!heartbeat()) return halt(bookId, `lost the run lock for ${bookId} during compiler section validation`, "infra");
    const gate = await deps.runVerb(["validate-sections", bookId], ownerEnv);
    if (gate.code === 0) return null;
    if (gate.code >= 2) return halt(bookId, `validate-sections errored (exit ${gate.code}) — inspect section artifacts:\n${reportOf(gate).slice(0, 1200)}`, "infra");
    if (attempt >= SECTION_REPAIR_MAX_PASSES) return halt(bookId, `section artifacts still invalid after ${SECTION_REPAIR_MAX_PASSES} repair attempt(s).\n${reportOf(gate).slice(0, 2000)}`);
    deps.log(`[autopilot] compiler section repair attempt ${attempt + 1}/${SECTION_REPAIR_MAX_PASSES}`);
    const r = await spawnAndLog(bookId, deps, `compiler-section-repair-${attempt + 1}`, {
      task: sectionRepairPrompt(bookId, reportOf(gate)),
      sessionId: deps.mkSessionId(`compiler-section-repair-${attempt + 1}`),
      cwd: process.cwd(),
      sandbox: "workspace-write",
      reasoningEffort: "medium",
      env: ownerEnv,
    } as SpawnOptions);
    if (!r.ok) deps.log(`[autopilot] compiler section repair exited ${r.exitCode}`);
  }
  // Every loop iteration either returns success (code 0), halts on error/exhaustion, or repairs
  // and continues — section invalidity must always halt, never fall through to success.
  throw new Error("unreachable: section repair loop must halt or return within the bounded attempts");
}

/**
 * The optional craft/polish stage (P06), between `convergeSections` and
 * `convergeAssembly`. Env `CHAPTERFLOW_COMPILER_POLISH` selects the mode:
 *   - `never`  → BYTE-FOR-BYTE no-op: returns null immediately, spawning nothing
 *                and running no extra validation, so the write behaves exactly as
 *                it did before this stage existed.
 *   - `risk` (default) / `always` → run `convergePolish` (best-effort sentence-
 *                level polish of failing / all summary+example artifacts), THEN
 *                re-run `convergeSections` once so any edit that broke a section
 *                gate is caught + repaired BEFORE assembly (reusing the existing
 *                validate-and-repair loop rather than duplicating it).
 * Polish itself never halts on quality; only a lost run lock (infra) halts.
 */
export async function runPolishStage(
  bookId: string,
  deps: AutopilotDeps,
  maxParallel: number,
  heartbeat: () => boolean,
  ownerEnv: Record<string, string> = {},
  mode: "risk" | "never" | "always" = compilerPolishMode(),
): Promise<AutopilotOutcome | null> {
  if (mode === "never") return null;
  const polishHalt = await convergePolish(bookId, deps, { maxParallel, heartbeat, mode, ownerEnv });
  if (polishHalt) return polishHalt;
  // Re-validate: a polish edit could, in principle, trip a section gate. Reuse the
  // existing validate-and-repair loop so a broken artifact is fixed before assembly.
  return convergeSections(bookId, deps, maxParallel, heartbeat, ownerEnv);
}

/** The rubric pre-flight mode env. `shadow` (default) writes the artifact + logs a summary line
 *  and NEVER halts; `enforce` runs `--gate` and halts on any `fail` chapter. New blocking checks
 *  ship shadow-first (house rule), so enforce must be opted into explicitly and is never set in
 *  committed code/config. */
export const RUBRIC_GATE_MODE_ENV = "CHAPTERFLOW_RUBRIC_GATE";

export function rubricGateMode(env: NodeJS.ProcessEnv = process.env): "shadow" | "enforce" {
  return env[RUBRIC_GATE_MODE_ENV] === "enforce" ? "enforce" : "shadow";
}

/** Run the deterministic rubric pre-flight (P04) BETWEEN evidence-gate and risk-score, so the
 *  artifact it writes is already on disk when risk-score reads it — a `fail` chapter picks up
 *  its +3 qc-shadow routing bump in the SAME compiler pass, not only on a later re-run. In
 *  shadow mode the verb runs in report mode: we log the summary line, the artifact is written,
 *  and we ALWAYS continue (a rubric-metrics infra error is logged, not fatal — the pre-flight is
 *  advisory until enforce is turned on). In enforce mode we pass `--gate`: exit 1 halts "content"
 *  with the failing table; exit ≥2 halts "infra". Exported for unit tests that inject a stub
 *  runVerb. */
export async function runRubricPreflight(
  bookId: string,
  deps: AutopilotDeps,
  ownerEnv: Record<string, string> = {},
  mode: "shadow" | "enforce" = rubricGateMode(),
): Promise<AutopilotOutcome | null> {
  const args = mode === "enforce" ? ["rubric-metrics", bookId, "--gate"] : ["rubric-metrics", bookId];
  const r = await deps.runVerb(args, ownerEnv);
  const report = reportOf(r);
  const summary = report.split(/\r?\n/).find((l) => l.trim().startsWith("rubric-metrics:")) ?? report.split(/\r?\n/)[0] ?? "";
  if (mode === "shadow") {
    if (r.code >= 2) deps.log(`[autopilot] compiler rubric-metrics (shadow): report errored (exit ${r.code}) — continuing, pre-flight is advisory`);
    else deps.log(`[autopilot] compiler rubric-metrics (shadow): ${summary}`);
    return null;
  }
  if (r.code === 0) {
    deps.log(`[autopilot] compiler rubric-metrics (enforce): ${summary}`);
    return null;
  }
  const category = r.code >= 2 ? "infra" : "content";
  return halt(bookId, `compiler rubric-metrics (enforce) failed (exit ${r.code}).\n${report.slice(0, 2000)}`, category);
}

/** The single compiler write entry point. Acquires the same-book write lock EXACTLY ONCE,
 *  here, before spawning any section work — never inside ensureCompilerRun()/artifactDir(),
 *  which every artifact path resolution (including the read-only validate-sections/
 *  assemble-sections children this function spawns, directly and via section-writer agent
 *  sessions) funnels through. Every subprocess/agent this function spawns gets
 *  COMPILER_RUN_OWNER_ENV set so it (and anything IT spawns) is recognized as part of this
 *  run rather than a competing independent one. */
export async function doCompilerWrite(bookId: string, deps: AutopilotDeps, opts: CompilerWriteOptions): Promise<AutopilotOutcome | null> {
  const normalized = normSlug(bookId);
  try {
    acquireCompilerWriteLock(normalized);
  } catch (err) {
    return halt(bookId, (err as Error).message, "infra");
  }
  const ownerEnv: Record<string, string> = { [COMPILER_RUN_OWNER_ENV]: normalized };

  const heartbeat = opts.heartbeat ?? (() => true);
  const sourceHalt = await convergeSourceReadiness(bookId, deps, heartbeat, ownerEnv);
  if (sourceHalt) return sourceHalt;

  for (const [args, label] of [
    [["compile-source-packets", bookId], "source-packets"],
    [["source-packet-gate", bookId], "source-packet-gate"],
    [["compile-blueprints", bookId], "blueprints"],
    [["blueprint-gate", bookId], "blueprint-gate"],
    [["deal-section-tasks", bookId], "section-task-deal"],
  ] as Array<[string[], string]>) {
    const h = await runCompilerVerb(bookId, deps, args, label, ownerEnv);
    if (h) return h;
  }

  const sectionHalt = await convergeSections(bookId, deps, opts.maxParallel, heartbeat, ownerEnv);
  if (sectionHalt) return sectionHalt;

  // Optional craft pass on section artifacts (pre-assembly). `never` = no-op.
  const polishHalt = await runPolishStage(bookId, deps, opts.maxParallel, heartbeat, ownerEnv);
  if (polishHalt) return polishHalt;

  const assemblyHalt = await convergeAssembly(bookId, deps, opts.maxParallel, heartbeat, ownerEnv);
  if (assemblyHalt) return assemblyHalt;
  try { stampCompilerAssemblyProvenance(bookId, deps); }
  catch (err) { deps.log(`[autopilot] compiler assembly provenance warning: ${(err as Error).message}`); }

  for (const [args, label] of [
    [["build-evidence-maps", bookId], "evidence-map"],
    [["evidence-gate", bookId], "evidence-gate"],
  ] as Array<[string[], string]>) {
    const h = await runCompilerVerb(bookId, deps, args, label, ownerEnv);
    if (h) return h;
  }

  // Pre-flight BEFORE risk-score: risk-score reads the rubric-metrics artifact (if present)
  // and bumps `fail` chapters +3 toward the qc-shadow lane — same pass, not next run.
  const rubricHalt = await runRubricPreflight(bookId, deps, ownerEnv);
  if (rubricHalt) return rubricHalt;

  const riskHalt = await runCompilerVerb(bookId, deps, ["risk-score", bookId], "risk-score", ownerEnv);
  if (riskHalt) return riskHalt;

  deps.log(`[autopilot] compiler write: section artifacts assembled into ChapterV21; advancing to deterministic gates`);
  return null;
}
