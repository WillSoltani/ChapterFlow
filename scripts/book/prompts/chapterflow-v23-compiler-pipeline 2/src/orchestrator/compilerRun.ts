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

const SECTION_REPAIR_RULES: readonly string[] = [
    "- Open the relevant task card(s); they contain the exact source packet, blueprint, output path, and schema.",
    "- Edit only the failing section output JSON.",
    "- Preserve sourceAnchorIds and blueprint correctIndex pattern.",
    "- If an example-pack fails count, rewrite it as the exact six blueprint examples; do not append filler examples to an old pack.",
    "- If an example cites a namedExample/example anchor, include at least two of that anchor's hardSpecifics verbatim in the example text so the final source-provenance gate can verify it.",
    "- For examples, source facts/cases must drive a human decision in the scene. whyItMatters must explain the same sourceFactIds cited by that example and the decision shown in the scenario; do not pivot to a neighboring named case just to satisfy hardSpecifics. If the named case is supporting rather than identical, state the source fact's decision logic first and use the case as a boundary or example. Never stage source labels as props, title subjects, wall cards, desk objects, compass/placeholder prose, or source-label comparison commands. Never use source-figure names as invented actors. Do not repeat any exact five-word phrase across three or more example scenarios, whatToDo lines, or whyItMatters lines, including source/legal labels and including phrases where only two words carry content; vary anchors and sentence shapes. Known SEC89/BP13 stamps include \"transition, milestone, or pit, then\", \"a transition, milestone, or pit\", \"the stake-fit rule because a\", \"red phone by the pool\", \"attention, meaning, or memory\", and \"tradeoff memo\". Never use stock next-step phrases like \"so the next action is\", \"the next action is to\", or \"the next action is\". Do not use jammed CamelCase proper nouns such as BrokerCheck in reader-facing prose. Do not use formulaic closers such as \"[Name] decides after X, not before\" across chapters. Do not make pending/until/only-if evidence gates the default ending, and do not repeatedly close with \"partial answer/result/outcome, then next action/review/later evidence\". Do not make the default scene pressure a tactile mundane action while another person waits, asks, or presses for an answer; vary point of view, timing, stakes, and scene mechanics. Vary outcomes with decisive rejection, bounded approval, chosen comparison winner, post-decision audit, owner action, or changed sizing. Include controlled friction or recovery without turning the ending into a repeated partial-answer/next-action template. Do not cycle generic action containers across chapters, especially tradeoff memo, prospectus packet, broker statement, portfolio policy file, bond quote sheet, allocation worksheet, and research queue; if you use a document, memo, note, or audit, make it one chapter-specific detail rather than the scene engine. Do not reuse the document-plus-old-default/shortcut-plus-repair frame. Do not make the book-wide default scene engine \"old shortcut/default/test fails, checklist/source fact interrupts, decision becomes pending/rejected/review\"; vary the opening action, pressure, turning point, and outcome logic with engines such as pressure-tested process, two plausible choices, successful execution with friction, a consequence after a past decision, a boundary case, or a changed amount/timing/commitment after new evidence. Do not lean on repeated generic scene containers or default venues such as budget apps, shared spreadsheets, calendar reminders, service counters, notebook margins, team chats, kitchen tables, conference rooms, or break rooms unless the source case requires that workflow.",
    "- For summary packs, rewrite dense prose into short sentences and plain verbs until fastRead, deepRead, and fullRead clear the section readability gate: aim fastRead at grade 7 or below, deepRead at grade 8.5 or below, and fullRead at grade 9.5 or below, and the assembled breakdown must read at Flesch ease 70 or higher — prefer concrete verbs over abstractions. Keep keyTakeaway at 30 words or fewer. Use the blueprint's reservedVariety.hookShape as the hook's assigned opening move, and vary hook first words across the selected batch: no three hooks in five may start with the same word. Do not default to location-stamp openers like \"At\", \"In\", or \"On\". Do not paste source-note sentences or long framework/list runs verbatim; keep any required hardSpecific phrase short and paraphrase the surrounding claim. Seed at least three standalone memorable-line candidates of 8–14 words, and if SEC118 fires make sure at least two of them land at 14 words or fewer so they count as clean memorable lines. Never echo a famous hardSpecific as a reusable five-word tag across summary tiers; if a case detail such as \"red phone by the pool\" must appear, use it in one teaching unit and paraphrase the mechanism elsewhere. Never use \"attention, meaning, or memory\" or variants such as \"attention, meaning, memory\" and \"attention, meaning, or shared...\" as generic proof loops; name the chapter-specific observable proof instead. Never expose audit labels like \"Fact 2\" or \"Fact five\", \"Source 3\" or \"Source six\", or source-note numbering in ANY digit or spelled-out form; name the evidence itself. Avoid jammed CamelCase source labels unless the exact brand is allowlisted; use a spaced natural name or descriptive phrase. If SEC83 fires, rewrite the reported summary tier with a chapter-specific skeleton: use this chapter's core move, named cases, framework members, and limits; remove reusable five-word connective runs such as \"the practical question is therefore\", \"the hard edge is\", \"the useful answer is\", \"targets are transitions, milestones, and\", \"at least 3 named cases\", \"red phone by the pool\", \"the stake-fit rule because a\", \"attention, meaning, or memory\", source-grounding prose like \"concrete settings give memory a handle\" / \"claims checkable\", or any repeated list like \"elevation, insight, pride, and connection\". Every body paragraph after the opener should contain a unique named case label or hardSpecific from this source packet.",
    "- For learning packs, rewrite distractors as plausible misconceptions without absolute tells: avoid always, never, automatically, impossible, guaranteed, entirely, ever, forever, completely, wholly, absolutely, under no circumstances, and in all cases. The keyed answer must NOT be the longest choice by character count: give every distractor equal scenario-specific substance and keep hedge words (usually, often, sometimes, generally, typically, tends to, may, might) in distractors no less than in the key; the secondary length bound still holds — keep the key below 1.4x the average distractor word count and at or below 1.5x the average distractor character count. If SEC117 fires, rewrite the named bare-recall questions to pose a NEW scenario (transfer): open with \"you are...\", \"imagine...\", \"suppose...\", \"your team...\", or a concrete apply/analyze task and set bloomsLevel to apply/analyze/evaluate, so at least 7 of 9 questions test transfer rather than recall. Follow each quiz slot's dealt promptShape, answerStyle, distractorTrap, and caseCueIds; AS5/AS6 will block same-position quiz skeletons and reused answer/distractor wording across chapters. Never expose audit labels like \"Fact 2\" or \"Fact five\", \"Source 3\" or \"Source six\", or source-note numbering in ANY digit or spelled-out form in prompts, choices, explanations, or cards; name the evidence itself. Avoid jammed CamelCase source labels unless the exact brand is allowlisted; use a spaced natural name or descriptive phrase. Keyed answers must name this chapter's requiredFactIds mechanism/case in fresh concrete language, not an abstract book slogan. Concrete namedExample anchors may be used for quiz and review-card provenance when their supportsClaimTypes include the needed claim type. If SEC81 fires, rewrite the reported review-card fronts/backs around their requiredFactIds, caseCueIds, and dealt frontShape/retrievalTarget/backShape with chapter-specific nouns, cases, mechanisms, contrasts, triggers, or failure modes. Include a hardSpecific or case label from the cued named case when caseCueIds is present. Never make review cards retrieve source-grounding requirements like \"at least 3 named cases\", \"concrete settings give memory a handle\", \"named people, places, dates, or numbers\", \"claims checkable\", or QC/source-anchor discipline. Do not use generic card stems like \"What should you inspect\", \"What check does\", \"Why does this matter\", \"What is the key move\", or \"How can you apply\"; vary front/back sentence shapes across every card.",
    "- For action packs, make every ifThenPlans[].context a situational trigger phrase, not a bare venue, source label, or stage direction. Never expose audit labels like \"Fact 2\" or \"Fact five\", \"Source 3\" or \"Source six\", or source-note numbering in ANY digit or spelled-out form; name the evidence itself. Avoid jammed CamelCase source labels unless the exact brand is allowlisted; use a spaced natural name or descriptive phrase. Start tryThisNow with a chapter-specific trigger; do not reuse book-wide opener shells such as \"Open the next stock idea\", \"Before the next stock decision\", or \"Each Friday\". Rewrite implementationPlan.coreSkill so its final sentence is chapter-specific and not shared with sibling chapters. AS8 compares implementation fields across chapters; each if-then plan must follow the blueprint's dealt action.ifThenPlanShapes[] and action.practiceConstraint rather than a reusable checkpoint/blank/pending shell. Do not recreate the stock \"social pressure pushes/favors/praises X, then pause for evidence first/before approving/copying it\" if-then shell across chapters; use chapter-specific triggers and actions such as owner handoff, deletion, field test, refusal rule, measurement swap, rehearsal, or post-moment review. Vary twentyFourHourChallenge openers and cadences across chapters; do not reuse \"Before tomorrow ends\" / \"Within the next day\" as a book-wide challenge shell. Do not use \"attention, meaning, or memory\" or variants such as \"attention, meaning, memory\" and \"attention, meaning, or shared...\" as generic proof loops; name the chapter-specific observable proof, behavior, receipt, or recovery signal instead. Do not make the book-wide default practice \"create/open a template, row, gate, blank, or checkpoint and keep the idea pending until every blank is filled\"; vary the behavior, artifact, cadence, and decision ritual. Do not paste source-note sentences or long framework/list runs into action fields; translate the source into a reader action and vary checklist wording.",
    "- Never keep hard-banned register phrases or opener shells such as \"The trap is to\", \"The trap is not\", \"The mistake is to\", \"The paradox is that\", \"Most readers assume\", or \"Most people think\". These are policy bans, not style suggestions.",
    "- Avoid soft-banned house tics unless truly necessary: \"rather than\", \"That matters because\", \"turns out to be\", and \"treats it as\". If the section gate reports SEC90, rewrite the reported field with plain alternatives.",
    "- Preserve the VOICE CARD register the task card set for this book: a repair must keep the book's established voice (register, person, cadence, warmth) and must not revert the field to a neutral textbook voice. Never quote the voice card, mention the author, or import register from another book.",
    "- Do not invent new real-world entities, numbers, dates, people, institutions, or outcomes.",
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
