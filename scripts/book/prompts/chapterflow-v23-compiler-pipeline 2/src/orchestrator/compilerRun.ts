import { existsSync, readFileSync } from "fs";

import type { AutopilotDeps, AutopilotOutcome, VerbResult } from "./autopilot.js";
import { missingSectionTasks, readSectionTask, sectionTasks, type SectionTask } from "../sections/sectionTasks.js";
import { sourcePrewriteRepairPrompt } from "./compilerTasks.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { recordCompilerAssemblyProvenance } from "../qc/sessionProvenance.js";

const SOURCE_REPAIR_MAX_PASSES = 3;
const SECTION_REPAIR_MAX_PASSES = 2;

type SpawnOptions = Parameters<AutopilotDeps["spawn"]>[0];

type CompilerSectionSessionRecord = {
  schemaVersion: "compiler-section-session-v1";
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  sectionKind: SectionTask["kind"];
  sectionSessionId: string;
  outputPath: string;
  recordedAt: string;
};

function sectionSessionSidecarPath(task: SectionTask): string {
  return `${task.outputPath}.session.json`;
}

function writeSectionSessionRecord(task: SectionTask, sessionId: string): void {
  if (!existsSync(task.outputPath)) return;
  const rec: CompilerSectionSessionRecord = {
    schemaVersion: "compiler-section-session-v1",
    bookId: task.bookId,
    chapterId: task.chapterId,
    chapterNumber: task.chapterNumber,
    sectionKind: task.kind,
    sectionSessionId: sessionId,
    outputPath: task.outputPath,
    recordedAt: new Date().toISOString(),
  };
  writeFileAtomic(sectionSessionSidecarPath(task), JSON.stringify(rec, null, 2) + "\n");
}

function contributorSessionIdsForChapter(bookId: string, chapterNumber: number): string[] {
  const ids: string[] = [];
  for (const task of sectionTasks(bookId).filter((t) => t.chapterNumber === chapterNumber)) {
    const p = sectionSessionSidecarPath(task);
    if (!existsSync(p)) continue;
    try {
      const rec = JSON.parse(readFileSync(p, "utf8")) as Partial<CompilerSectionSessionRecord>;
      if (rec.sectionSessionId) ids.push(rec.sectionSessionId);
    } catch {
      // Session sidecars are audit metadata; a torn sidecar should never sink assembly.
    }
  }
  return [...new Set(ids)].sort();
}

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

async function convergeSourceReadiness(bookId: string, deps: AutopilotDeps, heartbeat: () => boolean): Promise<AutopilotOutcome | null> {
  let lastReport = "";
  for (let attempt = 0; attempt <= SOURCE_REPAIR_MAX_PASSES; attempt++) {
    if (!heartbeat()) return halt(bookId, `lost the run lock for ${bookId} while checking source readiness — halting to avoid two conductors on the same book.`, "infra");
    const gate = await deps.runVerb(["source-v2-gate", bookId, "--prewrite"]);
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
    } as SpawnOptions);
    if (!r.ok) deps.log(`[autopilot] compiler source repair exited ${r.exitCode}`);
  }
  return halt(bookId, `source-v2-gate --prewrite still BLOCKS before section generation. Fix source sidecars manually.\n${lastReport.slice(0, 2000)}`);
}

async function runCompilerVerb(bookId: string, deps: AutopilotDeps, args: string[], label: string): Promise<AutopilotOutcome | null> {
  const r = await deps.runVerb(args);
  if (r.code === 0) {
    const line = reportOf(r).split(/\r?\n/).slice(-1)[0] ?? "PASS";
    deps.log(`[autopilot] compiler ${label}: ${line}`);
    return null;
  }
  const category = r.code >= 2 ? "infra" : "content";
  return halt(bookId, `compiler ${label} failed (exit ${r.code}).\n${reportOf(r).slice(0, 2000)}`, category);
}

async function spawnMissingSectionTasks(bookId: string, deps: AutopilotDeps, maxParallel: number): Promise<void> {
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
    } as SpawnOptions);
    if (r.ok) writeSectionSessionRecord(task, sid);
    deps.log(`[autopilot] section ch${String(task.chapterNumber).padStart(2, "0")} ${task.kind}: exited ${r.exitCode}`);
  });
}

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
    "- Open the relevant task card(s); they contain the exact source packet, blueprint, output path, and schema.",
    "- Edit only the failing section output JSON.",
    "- Preserve sourceAnchorIds and blueprint correctIndex pattern.",
    "- If an example-pack fails count, rewrite it as the exact six blueprint examples; do not append filler examples to an old pack.",
    "- If an example cites a namedExample/example anchor, include at least two of that anchor's hardSpecifics verbatim in the example text so the final source-provenance gate can verify it.",
    "- For examples, source facts/cases must drive a human decision in the scene. whyItMatters must explain the same sourceFactIds cited by that example and the decision shown in the scenario; do not pivot to a neighboring named case just to satisfy hardSpecifics. If the named case is supporting rather than identical, state the source fact's decision logic first and use the case as a boundary or example. Never stage source labels as props, title subjects, wall cards, desk objects, compass/placeholder prose, or source-label comparison commands. Never use source-figure names as invented actors. Do not repeat any exact five-word phrase across three or more example scenarios, whatToDo lines, or whyItMatters lines, including source/legal labels and including phrases where only two words carry content; vary anchors and sentence shapes. Known SEC89/BP13 stamps include \"transition, milestone, or pit, then\", \"a transition, milestone, or pit\", \"the stake-fit rule because a\", \"red phone by the pool\", \"attention, meaning, or memory\", and \"tradeoff memo\". Never use stock next-step phrases like \"so the next action is\", \"the next action is to\", or \"the next action is\". Do not use jammed CamelCase proper nouns such as BrokerCheck in reader-facing prose. Do not use formulaic closers such as \"[Name] decides after X, not before\" across chapters. Do not make pending/until/only-if evidence gates the default ending, and do not repeatedly close with \"partial answer/result/outcome, then next action/review/later evidence\". Do not make the default scene pressure a tactile mundane action while another person waits, asks, or presses for an answer; vary point of view, timing, stakes, and scene mechanics. Vary outcomes with decisive rejection, bounded approval, chosen comparison winner, post-decision audit, owner action, or changed sizing. Include controlled friction or recovery without turning the ending into a repeated partial-answer/next-action template. Do not cycle generic action containers across chapters, especially tradeoff memo, prospectus packet, broker statement, portfolio policy file, bond quote sheet, allocation worksheet, and research queue; if you use a document, memo, note, or audit, make it one chapter-specific detail rather than the scene engine. Do not reuse the document-plus-old-default/shortcut-plus-repair frame. Do not make the book-wide default scene engine \"old shortcut/default/test fails, checklist/source fact interrupts, decision becomes pending/rejected/review\"; vary the opening action, pressure, turning point, and outcome logic with engines such as pressure-tested process, two plausible choices, successful execution with friction, a consequence after a past decision, a boundary case, or a changed amount/timing/commitment after new evidence. Do not lean on repeated generic scene containers or default venues such as budget apps, shared spreadsheets, calendar reminders, service counters, notebook margins, team chats, kitchen tables, conference rooms, or break rooms unless the source case requires that workflow.",
    "- For summary packs, rewrite dense prose into short, plain sentences until fastRead, deepRead, and fullRead clear the section readability gate. Keep keyTakeaway at 30 words or fewer. Use the blueprint's reservedVariety.hookShape as the hook's assigned opening move, and vary hook first words across the selected batch: no three hooks in five may start with the same word. Do not default to location-stamp openers like \"At\", \"In\", or \"On\". Do not paste source-note sentences or long framework/list runs verbatim; keep any required hardSpecific phrase short and paraphrase the surrounding claim. Never echo a famous hardSpecific as a reusable five-word tag across summary tiers; if a case detail such as \"red phone by the pool\" must appear, use it in one teaching unit and paraphrase the mechanism elsewhere. Never use \"attention, meaning, or memory\" or variants such as \"attention, meaning, memory\" and \"attention, meaning, or shared...\" as generic proof loops; name the chapter-specific observable proof instead. Never expose audit labels like \"Fact 2\", \"Source 3\", or source-note numbering; name the evidence itself. Avoid jammed CamelCase source labels unless the exact brand is allowlisted; use a spaced natural name or descriptive phrase. If SEC83 fires, rewrite the reported summary tier with a chapter-specific skeleton: use this chapter's core move, named cases, framework members, and limits; remove reusable five-word connective runs such as \"the practical question is therefore\", \"the hard edge is\", \"the useful answer is\", \"targets are transitions, milestones, and\", \"at least 3 named cases\", \"red phone by the pool\", \"the stake-fit rule because a\", \"attention, meaning, or memory\", source-grounding prose like \"concrete settings give memory a handle\" / \"claims checkable\", or any repeated list like \"elevation, insight, pride, and connection\". Every body paragraph after the opener should contain a unique named case label or hardSpecific from this source packet.",
    "- For learning packs, rewrite distractors as plausible misconceptions without absolute tells: avoid always, never, automatically, impossible, guaranteed, entirely, ever, forever, completely, wholly, absolutely, under no circumstances, and in all cases. Keep the keyed answer below 1.4x the average distractor word count and at or below 1.5x the average distractor character count. Follow each quiz slot's dealt promptShape, answerStyle, distractorTrap, and caseCueIds; AS5/AS6 will block same-position quiz skeletons and reused answer/distractor wording across chapters. Never expose audit labels like \"Fact 2\", \"Source 3\", or source-note numbering in prompts, choices, explanations, or cards; name the evidence itself. Avoid jammed CamelCase source labels unless the exact brand is allowlisted; use a spaced natural name or descriptive phrase. Keyed answers must name this chapter's requiredFactIds mechanism/case in fresh concrete language, not an abstract book slogan. Concrete namedExample anchors may be used for quiz and review-card provenance when their supportsClaimTypes include the needed claim type. If SEC81 fires, rewrite the reported review-card fronts/backs around their requiredFactIds, caseCueIds, and dealt frontShape/retrievalTarget/backShape with chapter-specific nouns, cases, mechanisms, contrasts, triggers, or failure modes. Include a hardSpecific or case label from the cued named case when caseCueIds is present. Never make review cards retrieve source-grounding requirements like \"at least 3 named cases\", \"concrete settings give memory a handle\", \"named people, places, dates, or numbers\", \"claims checkable\", or QC/source-anchor discipline. Do not use generic card stems like \"What should you inspect\", \"What check does\", \"Why does this matter\", \"What is the key move\", or \"How can you apply\"; vary front/back sentence shapes across every card.",
    "- For action packs, make every ifThenPlans[].context a situational trigger phrase, not a bare venue, source label, or stage direction. Never expose audit labels like \"Fact 2\", \"Source 3\", or source-note numbering; name the evidence itself. Avoid jammed CamelCase source labels unless the exact brand is allowlisted; use a spaced natural name or descriptive phrase. Start tryThisNow with a chapter-specific trigger; do not reuse book-wide opener shells such as \"Open the next stock idea\", \"Before the next stock decision\", or \"Each Friday\". Rewrite implementationPlan.coreSkill so its final sentence is chapter-specific and not shared with sibling chapters. AS8 compares implementation fields across chapters; each if-then plan must follow the blueprint's dealt action.ifThenPlanShapes[] and action.practiceConstraint rather than a reusable checkpoint/blank/pending shell. Do not recreate the stock \"social pressure pushes/favors/praises X, then pause for evidence first/before approving/copying it\" if-then shell across chapters; use chapter-specific triggers and actions such as owner handoff, deletion, field test, refusal rule, measurement swap, rehearsal, or post-moment review. Vary twentyFourHourChallenge openers and cadences across chapters; do not reuse \"Before tomorrow ends\" / \"Within the next day\" as a book-wide challenge shell. Do not use \"attention, meaning, or memory\" or variants such as \"attention, meaning, memory\" and \"attention, meaning, or shared...\" as generic proof loops; name the chapter-specific observable proof, behavior, receipt, or recovery signal instead. Do not make the book-wide default practice \"create/open a template, row, gate, blank, or checkpoint and keep the idea pending until every blank is filled\"; vary the behavior, artifact, cadence, and decision ritual. Do not paste source-note sentences or long framework/list runs into action fields; translate the source into a reader action and vary checklist wording.",
    "- Never keep hard-banned register phrases or opener shells such as \"The trap is to\", \"The trap is not\", \"The mistake is to\", \"The paradox is that\", \"Most readers assume\", or \"Most people think\". These are policy bans, not style suggestions.",
    "- Avoid soft-banned house tics unless truly necessary: \"rather than\", \"That matters because\", \"turns out to be\", and \"treats it as\". If the section gate reports SEC90, rewrite the reported field with plain alternatives.",
    "- Do not invent new real-world entities, numbers, dates, people, institutions, or outcomes.",
    `- After editing, run: npx tsx src/cli.ts validate-sections ${bookId}`,
    "",
    "Return a concise summary of the files fixed and the validation result.",
  ].join("\n");
}

async function convergeSections(bookId: string, deps: AutopilotDeps, maxParallel: number, heartbeat: () => boolean): Promise<AutopilotOutcome | null> {
  await spawnMissingSectionTasks(bookId, deps, maxParallel);
  for (let attempt = 0; attempt <= SECTION_REPAIR_MAX_PASSES; attempt++) {
    if (!heartbeat()) return halt(bookId, `lost the run lock for ${bookId} during compiler section validation`, "infra");
    const gate = await deps.runVerb(["validate-sections", bookId]);
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
    } as SpawnOptions);
    if (!r.ok) deps.log(`[autopilot] compiler section repair exited ${r.exitCode}`);
  }
  return null;
}

export async function doCompilerWrite(bookId: string, deps: AutopilotDeps, opts: CompilerWriteOptions): Promise<AutopilotOutcome | null> {
  const heartbeat = opts.heartbeat ?? (() => true);
  const sourceHalt = await convergeSourceReadiness(bookId, deps, heartbeat);
  if (sourceHalt) return sourceHalt;

  for (const [args, label] of [
    [["compile-source-packets", bookId], "source-packets"],
    [["source-packet-gate", bookId], "source-packet-gate"],
    [["compile-blueprints", bookId], "blueprints"],
    [["blueprint-gate", bookId], "blueprint-gate"],
    [["deal-section-tasks", bookId], "section-task-deal"],
  ] as Array<[string[], string]>) {
    const h = await runCompilerVerb(bookId, deps, args, label);
    if (h) return h;
  }

  const sectionHalt = await convergeSections(bookId, deps, opts.maxParallel, heartbeat);
  if (sectionHalt) return sectionHalt;

  const assemblyHalt = await runCompilerVerb(bookId, deps, ["assemble-sections", bookId], "assembly");
  if (assemblyHalt) return assemblyHalt;
  try { stampCompilerAssemblyProvenance(bookId, deps); }
  catch (err) { deps.log(`[autopilot] compiler assembly provenance warning: ${(err as Error).message}`); }

  for (const [args, label] of [
    [["build-evidence-maps", bookId], "evidence-map"],
    [["evidence-gate", bookId], "evidence-gate"],
    [["risk-score", bookId], "risk-score"],
  ] as Array<[string[], string]>) {
    const h = await runCompilerVerb(bookId, deps, args, label);
    if (h) return h;
  }
  deps.log(`[autopilot] compiler write: section artifacts assembled into ChapterV21; advancing to deterministic gates`);
  return null;
}
