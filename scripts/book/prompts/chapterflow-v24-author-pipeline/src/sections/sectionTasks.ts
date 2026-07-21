import { existsSync, readFileSync } from "fs";

import { expectedSourceChapters } from "../qc/sourceV2Gate.js";
import { normSlug } from "../lib/chapterPaths.js";
import { voiceCard, voiceRegisterLine } from "../lib/voiceCard.js";
import { loadBookScars } from "../lib/bookScars.js";
import {
  blueprintPath,
  readJsonFile,
  sectionPath,
  sectionTaskPath,
  writeTextFile,
  sourcePacketPath,
  type CompilerStoreRoots,
} from "../artifacts/artifactStore.js";
import { SECTION_KINDS, type ChapterBlueprintV1, type SectionKind, type SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { readAuthorV4SelectedText, type AuthorV4ContentSelection } from "../assembler.js";

export type SectionTask = {
  bookId: string;
  chapterNumber: number;
  chapterId: string;
  kind: SectionKind;
  taskPath: string;
  outputPath: string;
  exists: boolean;
};

const ROLE_NAME: Record<SectionKind, string> = {
  "summary-pack": "SummaryPack writer",
  "example-pack": "ExamplePack writer",
  "learning-pack": "LearningPack writer",
  "action-pack": "ActionPack writer",
};

/**
 * The section-writer contract, rebuilt (P07) from four scar-tissue blocklists into
 * a LAYERED brief. Each contract composes three layers:
 *   - universalCore   — the artifact spec + count/length invariants + the handful
 *                       of universal craft rules NOT enforced by any gate. Applies
 *                       to every book.
 *   - gateAwareness   — the ~8 cross-chapter/leak rules a writer must DESIGN AROUND
 *                       (not merely avoid). Every other gate-restated prohibition is
 *                       DELETED from prose: the section/book gates (SEC80–SEC118,
 *                       AS5–AS13) enforce them, so a prose copy buys dilution, not
 *                       safety. Each line ends "the validator enforces this."
 *   - craftBrief      — what an EXCELLENT artifact of this kind looks like (the rubric
 *                       grades this, not the bans), the rubric targets in one line, and
 *                       the VOICE CARD slot (rendered adjacent below by the task builder).
 *
 * Book-specific "scars" (a phrase/prop/venue from ONE book — "red phone by the pool",
 * "tradeoff memo") used to live in these universal strings and leaked one book's voice
 * into every other book. They now live in config/book-scars/<bookId>.json and render
 * ONLY into their owning book's task (see bookScarsSection). See docs/v23/CONTRACT-RULE-AUDIT.md
 * for the sentence-by-sentence disposition of the old contracts.
 */

/** KEEP VERBATIM. This VOICE/LIVED-MOMENTS paragraph validated a +3.0 composite lift
 *  (commit 3702dd2d5); tests/contract-refactor.test.ts snapshots it exactly. Do not edit. */
const SUMMARY_VOICE_PARAGRAPH =
  `VOICE — narrate the real cases as LIVED MOMENTS, not abstract summaries: this genre teaches through concrete stories, so build deepRead and fullRead AROUND this chapter's real named cases. Open a case with one specific sensory moment drawn ONLY from its hardSpecifics (a named person, place, object, or number that is actually in the source), let the reader briefly FEEL the moment, THEN name the principle it proves. As a STYLE model only: prefer "The nurse taped a bright cartoon over the ceiling light so the boy staring up during the scan had something to find, and he stopped crying" over "Environments can be redesigned to reduce patient distress." Invent nothing beyond this chapter's own source hardSpecifics — the sample scene is only a voice model, so never import its nurse/boy/scan or any other book's cast, and if you have only a bare fact, state it plainly rather than embroidering it.`;

/** The voice line closing every craftBrief. Coherent whether or not a VOICE CARD
 *  follows (books with no voice signal get no card — P05), so it is never a dangling
 *  reference. Summary/example carry the register; learning/action match it. */
function voiceCraftLine(kind: SectionKind): string {
  return kind === "summary-pack" || kind === "example-pack"
    ? `VOICE: when a VOICE CARD is shown below, write in its register (match it, never quote it); with no card, use a plain, concrete register — short sentences, plain verbs.`
    : `VOICE: when a VOICE CARD register note is shown below, keep explanations and actions in that register; with no card, use a plain, concrete register — short sentences, plain verbs, not a neutral textbook voice.`;
}

/** Layer 1 — artifact spec, count/length invariants, and the universal craft rules
 *  no gate enforces (so they must live in prose, tightened). */
function universalCore(kind: SectionKind): string[] {
  switch (kind) {
    case "summary-pack":
      return [
        "UNIVERSAL — Write ONLY the hook, tiered summaries, keyTakeaway, and optional tryThisNow; no examples, quiz, review cards, or implementationPlan.",
        "Cite an allowed sourceAnchorId for the hook, each breakdown tier, keyTakeaway, and tryThisNow.",
        "keyTakeaway: 30 words or fewer.",
        "Tier floors: fastRead >=350 chars at grade <=7; deepRead >=1000 chars at grade <=8.5; fullRead >=2400 chars at grade <=9.5; the assembled breakdown reads at Flesch ease >=70. Short sentences, plain verbs.",
        "Teach the chapter, not the provenance discipline: no reader-facing source-grounding rules (\"at least 3 named cases\", \"concrete settings give memory a handle\", \"claims checkable\").",
        "Output SummaryPackV1 JSON only.",
      ];
    case "example-pack":
      return [
        "UNIVERSAL — Write ONLY the example pack; no summaries, quiz, cards, or implementation.",
        "Produce exactly the six blueprint slots (the final v21 gate requires six). exampleId = \"ex01\"..\"ex06\" in slot order, or \"chNN-exNN-slug\"; never include the bookId.",
        "Every example is a concrete human scene with a NAMED person living a defining moment. Use a different dealt name per slot; never use a source-figure name as an invented actor.",
        "Each example cites a namedExample/example anchor; source facts DRIVE the decision and never appear as props, labels, wall cards, desk objects, or title subjects.",
        "whatToDo adds a new instruction/test/refusal rule not already narrated in the scenario. whyItMatters explains the same cited sourceFactIds and the decision shown.",
        "Output ExamplePackV1 JSON only.",
      ];
    case "learning-pack":
      return [
        "UNIVERSAL — Write ONLY the quiz and review cards.",
        "Each question: questionId, prompt, exactly 3 choices, correctIndex (MUST match the blueprint slot), explanation, bloomsLevel (remember|understand|apply|analyze|evaluate|create), depthLevel (from the slot).",
        "Provenance uses claim-type-matching anchors (quiz_prompt/quiz_explanation/quiz_key_evidence, review_card), including >=1 of a cited anchor's hardSpecifics verbatim when it has them (SEC55–SEC58); namedExample anchors qualify when listed.",
        "Hedge words (usually, often, sometimes, generally, typically, tends to, may, might) appear in distractors no less than in the key — never signal the answer by hedging it.",
        "A review card must not retrieve a source-grounding requirement (\"at least 3 named cases\", \"claims checkable\") — those are provenance supports, not learning goals.",
        "Output LearningPackV1 JSON only.",
      ];
    case "action-pack":
      return [
        "UNIVERSAL — Write ONLY tryThisNow and implementationPlan. Actions must be concrete, low-friction, and provable.",
        "All provenance uses anchors whose supportsClaimTypes include implementation_guidance; concrete namedExample anchors qualify when the packet lists that type.",
        "implementationPlan.coreSkill is built around action.practiceForm and action.practiceConstraint; twentyFourHourChallenge uses the dealt action.practiceForm as its exercise form.",
        "The example pack's characters are fictional and exist only there — never name them in tryThisNow or the implementation plan (\"hand it to Sophie by name\"); the reader has no Sophie. Translate the mechanism into a behavior (SEC119); the validator enforces this.",
        "Output ActionPackV1 JSON only.",
      ];
  }
}

/** Layer 2 — the cross-chapter / leak rules to DESIGN AROUND. Each names the enforcing
 *  check and ends "the validator enforces this." Everything else class-B is deleted from
 *  prose. The audit-label / CamelCase / " / "-seam leak family is shared by all four. */
const LEAK_FAMILY_LINE =
  "Never leak bookkeeping into reader prose: no source-note numbering (\"Fact 2\", \"Source 3\", any form), no jammed CamelCase source labels, and never carry an anchor label's \" / \" separator into a sentence — name the case naturally (SEC103/SEC104/SEC105/SEC88); the validator enforces this.";

function gateAwareness(kind: SectionKind): string[] {
  switch (kind) {
    case "summary-pack":
      return [
        "DESIGN AROUND THE GATES:",
        "AS10/AS11 compare fastRead, deepRead, and fullRead across the whole book: give every tier a chapter-specific skeleton — open from this chapter's core move, rotate its named cases and framework members, use unique transition verbs; never repeat the book's framework list as a stock sentence (SEC82/SEC83); the validator enforces this.",
        "No reusable five-word connective run repeated across tiers or chapters, and in fullRead every body paragraph after the opener carries a unique named case or hardSpecific (SEC82/SEC83); the validator enforces this.",
        "Only cite a namedExample anchor in a tier that includes at least two of its hardSpecifics verbatim; prefer testable_fact/framework anchors otherwise (SEC13/SEC14); the validator enforces this.",
        "In a parallel batch, vary hook first words — no three in five share a first word, and do not default to \"At\"/\"In\"/\"On\" location stamps (SEC95); the validator enforces this.",
        LEAK_FAMILY_LINE,
      ];
    case "example-pack":
      return [
        "DESIGN AROUND THE GATES:",
        "AS9/SEC80/SEC89 compare examples across chapters: each of the six slots needs a distinct role, timing, scene engine, turning point, and advice shape — obey the dealt sceneFrame/requiredBeat so same-position slots never share one dramatic transaction; the validator enforces this.",
        "No exact five-word phrase across three or more scenarios, whatToDo, or whyItMatters lines — even source/legal labels (SEC87); the validator enforces this.",
        "Each example cites a namedExample/example anchor and includes at least two of its hardSpecifics verbatim (SEC33); the validator enforces this.",
        "Do not let the book default to one scene engine, action container, venue, ending, or evidence-gate across chapters (SEC85/SEC93/SEC96/SEC98/SEC100/SEC101/SEC108/SEC112); the validator enforces this.",
        LEAK_FAMILY_LINE,
      ];
    case "learning-pack":
      return [
        "DESIGN AROUND THE GATES:",
        "AS5/AS12 compare q01-to-q01 across the book: give every slot a different scenario, opening, decision pressure, and evidence source; obey its dealt promptShape, answerStyle, distractorTrap, and caseCueIds; the validator enforces this.",
        "AS6 compares correct answers and distractors across chapters: every correct answer names this chapter's requiredFactIds mechanism in fresh words, never a book-level slogan; the validator enforces this.",
        "SEC81 compares review cards across the book: each follows its dealt frontShape, retrievalTarget, and backShape with a chapter-specific noun/case/mechanism; the validator enforces this.",
        "Distractor discipline: no strawman absolutes, the key is never the longest choice by chars (nor >1.4x avg distractor words / >1.5x avg chars), no mechanical proof tails (SEC52/SEC53/SEC59/SEC116); the validator enforces this.",
        "At least 7 of 9 questions pose a NEW scenario — transfer, not recall (SEC117); the validator enforces this.",
        LEAK_FAMILY_LINE,
      ];
    case "action-pack":
      return [
        "DESIGN AROUND THE GATES:",
        "AS8 compares implementationPlan fields across chapters: each ifThen follows a different dealt action.ifThenPlanShapes[] entry and carries this chapter's requiredFactIds mechanism, action.practiceForm, and action.practiceConstraint; the validator enforces this.",
        "No reused opener/closer/challenge shell across chapters — tryThisNow opener, coreSkill closer, and twentyFourHourChallenge opener must each be chapter-specific (SEC84/SEC94/SEC114); the validator enforces this.",
        "Do not default across chapters to the classify/choose/predict worksheet, the blank/checkpoint-kept-pending template, or the social-pressure-then-pause if-then (SEC102/SEC109/SEC115); the validator enforces this.",
        "Each ifThenPlans[].context is a situational trigger phrase (\"Before buying a familiar security\"), not a bare venue, source label, or stage direction (SEC67); the validator enforces this.",
        "Cite implementation_guidance anchors and include at least two of a cited anchor's hardSpecifics verbatim (SEC73/SEC74); the validator enforces this.",
        LEAK_FAMILY_LINE,
      ];
  }
}

/** Layer 3 — what excellent looks like (the rubric grades this), the rubric targets in
 *  one line, and the voice slot. */
function craftBrief(kind: SectionKind): string[] {
  switch (kind) {
    case "summary-pack":
      return [
        "WHAT EXCELLENT LOOKS LIKE: teach the chapter's spine through its real cases as lived moments.",
        SUMMARY_VOICE_PARAGRAPH,
        "Use reservedVariety.hookShape as the hook's assigned opening move. Seed at least three standalone memorable-line candidates in the breakdown: 8–14 words, portable, not a list, question, or \"if not/if so\" fragment; at least two at 14 words or fewer so they count as clean.",
        "RUBRIC TARGETS: Flesch ease >=70 (grades: fastRead <=7, deepRead <=8.5, fullRead <=9.5); at least two clean (<=14-word) memorable lines.",
        voiceCraftLine(kind),
      ];
    case "example-pack":
      return [
        "WHAT EXCELLENT LOOKS LIKE: six DIFFERENT scene engines — not six variations of \"a person weighs two options\". At least THREE are non-deliberation: a surprise that lands on someone; a ritual observed mid-action; a consequence unfolding from an earlier choice; a boundary case where the move backfires or must be withheld; a first-time or milestone; or a public recognition.",
        "Vary WHAT KIND of moment it is and WHO experiences it — a swapped name or prop is a repeat, not a variation. Let the dealt sceneFrame/requiredBeat set the kind of moment for each slot.",
        "RUBRIC TARGETS: a distinct scene engine per slot; vary openings, venues, protagonists, outcomes, and title grammar across the six.",
        voiceCraftLine(kind),
      ];
    case "learning-pack":
      return [
        "WHAT EXCELLENT LOOKS LIKE: transfer-first questions the reader reasons through (\"you are…\", \"imagine…\", \"suppose…\", \"your team…\", \"a colleague…\"), set to apply/analyze/evaluate.",
        "Distractors are plausible MISCONCEPTIONS on the mechanism, not recognizable by length or hedging. Keep prompts lean; name at most one case. Cards ask a chapter-specific mechanism/contrast/failure-mode in varied stems, never a generic \"What should you inspect / What check does\" shell.",
        "If a stem names a case, the question must hinge on it, not staple in a standalone case-identifier sentence to hit a quota.",
        "RUBRIC TARGETS: low distractor-tell rate (key never longest or most-hedged); high transfer ratio (>=7 of 9 new-scenario).",
        voiceCraftLine(kind),
      ];
    case "action-pack":
      return [
        "WHAT EXCELLENT LOOKS LIKE: actions a reader can actually notice and run today — a concrete trigger, a low-friction move, a provable result.",
        "tryThisNow opens with a chapter-specific trigger. coreSkill ends on a chapter-specific practice. ifThenPlans[].context is a situational trigger, not a bare venue. Vary the behavior across chapters: a two-option comparison, a price cap, a rejection rule, a delegation boundary, a one-minute audit, a cadence change, an owner question.",
        "Never instruct the reader to write or recite a source label (\"write '60-second painful trial beside 90-second trial with milder ending'\"); translate the mechanism into a behavior.",
        "RUBRIC TARGETS: every action concrete, low-friction, and provable; no reused opener/closer/challenge shell across chapters.",
        voiceCraftLine(kind),
      ];
  }
}

function sectionContract(kind: SectionKind): string {
  return [
    universalCore(kind).join("\n"),
    gateAwareness(kind).join("\n"),
    craftBrief(kind).join("\n"),
  ].join("\n\n");
}

/** The book-scars block, or "" when the book has no scar file (most books). Rendered
 *  between TASK and the VOICE CARD, so a writer sees ONLY its own book's over-used
 *  material — never another book's. Enforcement stays in the gates; this is guidance. */
function bookScarsSection(bookId: string): string {
  const scars = loadBookScars(bookId);
  if (!scars) return "";
  const lines: string[] = [
    "\n\nKNOWN OVER-USED MATERIAL FOR THIS BOOK — each item may appear in at most one teaching unit book-wide; paraphrase the mechanism everywhere else.",
  ];
  if (scars.phrases.length) lines.push(`- Over-used case phrases: ${scars.phrases.map((p) => `"${p}"`).join("; ")}.`);
  if (scars.frames.length) lines.push(`- Over-used scene/prop/connective frames: ${scars.frames.join("; ")}.`);
  for (const note of scars.notes) lines.push(`- ${note}`);
  return lines.join("\n");
}

function sectionSchemaHint(kind: SectionKind): string {
  switch (kind) {
    case "summary-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"summary-pack","chapterId":"...","hook":{...HookOutput},"breakdown":{...BreakdownOutput},"keyTakeaway":"...","keyTakeawaySourceAnchorIds":["..."],"tryThisNow":"...","tryThisNowSourceAnchorIds":["..."],"sourceFactIds":["..."]}`;
    case "example-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"example-pack","chapterId":"...","examples":[{"exampleId":"ex01","title":"...","scenario":"...","whatToDo":"...","whyItMatters":"...","sourceAnchorIds":["..."],"sourceFactIds":["..."],"namedCaseIds":["..."]}]}`;
    case "learning-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"learning-pack","chapterId":"...","quiz":{"passingScorePercent":70,"questions":[{"questionId":"q01","sourceAnchorIds":["..."],"keyEvidenceAnchorIds":["..."],"prompt":"...","choices":["...","...","..."],"correctIndex":0,"explanation":"...","bloomsLevel":"apply","depthLevel":"standard"}]},"cards":{"cards":[...]}}`;
    case "action-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"action-pack","chapterId":"...","tryThisNow":"...","tryThisNowSourceAnchorIds":["..."],"implementationPlan":{...ImplementationPlanOutput}}`;
  }
}

/** The DO NOT block shared by every section-writer task card. Extracted so the
 *  v23 polish pass (src/orchestrator/polishPass.ts) can reuse the EXACT same
 *  preservation contract verbatim — a polisher must honor the same bans as the
 *  original writer. `outputPath` scopes the first line to the one artifact the
 *  agent may touch. */
export function sectionDoNotLines(outputPath: string): string[] {
  return [
    `- Do not edit any file except ${outputPath}.`,
    "- Do not weaken schemas, gates, source sidecars, QC artifacts, or other chapters.",
    "- Do not introduce new real-world entities, numbers, dates, places, participants, studies, institutions, or outcomes unless they appear in the source packet below.",
    "- Name a real, public case from the source plainly, or describe it in the chapter's own words; never anonymize a nameable case into a periphrastic tell.",
    `- Do not mention "this chapter", "the book", or "the author" in reader-facing content.`,
    `- Never use hard-banned register phrases or opener shells such as "The trap is to", "The trap is not", "The mistake is to", "The paradox is that", "Most readers assume", or "Most people think".`,
    `- Avoid soft-banned house tics: "rather than", "That matters because", "turns out to be", and "treats it as". Use plain alternatives unless the phrase is truly necessary.`,
    "- Do not change the final ChapterV21 schema; this is an intermediate artifact only.",
  ];
}

/** The VOICE CARD block inserted between TASK and DO NOT, or "" when the book
 *  has no voice signal (voiceCard returns null → omit the section entirely, no
 *  empty scaffolding). summary/example writers carry the register — they set the
 *  book's voice — so they get the full card; learning/action writers get a
 *  2-line register note so explanations and actions match, not another card. */
function voiceCardSection(kind: SectionKind, card: string | null): string {
  if (!card) return "";
  if (kind === "summary-pack" || kind === "example-pack") {
    return `\n\nVOICE CARD — how THIS book sounds (register only; match it, do not quote it)\n${card}`;
  }
  return `\n\nVOICE CARD — register note\n- ${voiceRegisterLine(card)}\n- Keep explanations and actions in this register — plain verbs, short sentences; do not slip into a neutral textbook voice.`;
}

/** The action slice's projection of reservedVariety: everything EXCEPT the example-only
 *  casting lists (allowedNames/forbiddenNames). Keeps actionMechanism, weeklyPracticeForm,
 *  and the rest the action writer actually designs around. See F13 / SEC119. */
function actionReservedVariety(rv: ChapterBlueprintV1["reservedVariety"]): Omit<ChapterBlueprintV1["reservedVariety"], "allowedNames" | "forbiddenNames"> {
  const { allowedNames: _allowedNames, forbiddenNames: _forbiddenNames, ...rest } = rv;
  return rest;
}

export function buildSectionTaskMarkdown(args: { bookId: string; kind: SectionKind; blueprint: ChapterBlueprintV1; sourcePacket: SourcePacketV1; outputPath: string }): string {
  const { bookId, kind, blueprint, sourcePacket, outputPath } = args;
  // Each writer consumes only its own section's slots plus a little shared chapter
  // context; the per-slot dealt fields (sceneFrame, promptShape, correctIndex,
  // requiredFactIds, action.practiceForm, …) all live inside these section slices.
  // coreMove is shared context every kind's craft brief references, so it is dealt to
  // each. That makes the FULL CHAPTER BLUEPRINT block redundant — the pre-P07 task
  // pasted the whole blueprint AND the section slice (duplication), so dropping the full
  // copy is the single largest token saving (see docs/v23/CONTRACT-RULE-AUDIT.md).
  const sectionInput = kind === "summary-pack"
    ? { hook: blueprint.sections.hook, summaries: blueprint.sections.summaries, coreMove: blueprint.coreMove, reservedVariety: blueprint.reservedVariety }
    : kind === "example-pack"
      ? { examples: blueprint.sections.examples, coreMove: blueprint.coreMove, reservedVariety: blueprint.reservedVariety, forbiddenLeakage: blueprint.constraints.forbiddenLeakage }
      : kind === "learning-pack"
        ? { quiz: blueprint.sections.quiz, cards: blueprint.sections.cards, coreMove: blueprint.coreMove, answerIndexPattern: blueprint.reservedVariety.answerIndexPattern }
        // P15 (F13): the action writer gets actionMechanism/weeklyPracticeForm etc. but
        // NOT allowedNames/forbiddenNames — those exist only for example casting, and shipping
        // them let the action writer treat the fictional cast (Sophie/Margaret/Lorne) as real
        // people in the reader's plan. SEC119 backstops this; the trim removes the temptation.
        : { action: blueprint.sections.action, coreMove: blueprint.coreMove, reservedVariety: actionReservedVariety(blueprint.reservedVariety) };
  // The writer consumes the source packet as its ALLOWED facts/cases list, not the compiler's
  // internal pedagogical ranking. Strip the P13 ranking metadata (per-fact teachingPriority and
  // packet.coreMoveFactId) from the writer-facing copy — the blueprint already encodes which fact
  // is dealt where — so the ranking never leaks into the writer prompt or spends its tokens.
  const writerPacket = { ...sourcePacket, coreMoveFactId: undefined, facts: sourcePacket.facts.map(({ teachingPriority: _tp, ...f }) => f) };
  return `ROLE\nYou are the ${ROLE_NAME[kind]} for ChapterFlow v23. You have one bounded artifact to produce.\n\nINPUTS\n- bookId: ${bookId}\n- chapterId: ${blueprint.chapterId}\n- chapterNumber: ${blueprint.chapterNumber}\n- outputPath: ${outputPath}\n\nTASK\n${sectionContract(kind)}${bookScarsSection(bookId)}${voiceCardSection(kind, voiceCard(bookId))}\n\nDO NOT\n${sectionDoNotLines(outputPath).join("\n")}\n\nOUTPUT SCHEMA HINT\n\`\`\`json\n${sectionSchemaHint(kind)}\n\`\`\`\n\nSECTION BLUEPRINT — the slots and dealt variety for THIS section\n\`\`\`json\n${JSON.stringify(sectionInput, null, 2)}\n\`\`\`\n\nSOURCE PACKET — ONLY allowed facts/cases/numbers/entities\n\`\`\`json\n${JSON.stringify(writerPacket, null, 2)}\n\`\`\`\n\nVALIDATION\nAfter writing ${outputPath}, run:\n\n  npx tsx src/cli.ts validate-sections ${bookId} --chapters ${blueprint.chapterNumber} --section ${kind}\n\nStop only when validation passes for this section or the validator gives a precise blocker you cannot resolve without more source.\n`;
}

export function dealSectionTasks(bookId: string, roots: CompilerStoreRoots = {}): SectionTask[] {
  const normalized = normSlug(bookId);
  const tasks: SectionTask[] = [];
  for (const chapterNumber of expectedSourceChapters(normalized, { stateRoot: roots.stateRoot })) {
    const blueprint = readJsonFile<ChapterBlueprintV1>(blueprintPath(normalized, chapterNumber, roots));
    const sourcePacket = readJsonFile<SourcePacketV1>(sourcePacketPath(normalized, chapterNumber, roots));
    for (const kind of SECTION_KINDS) {
      const outputPath = sectionPath(normalized, chapterNumber, kind, roots);
      const taskPath = sectionTaskPath(normalized, chapterNumber, kind, roots);
      writeTextFile(taskPath, buildSectionTaskMarkdown({ bookId: normalized, kind, blueprint, sourcePacket, outputPath }));
      tasks.push({ bookId: normalized, chapterNumber, chapterId: blueprint.chapterId, kind, taskPath, outputPath, exists: existsSync(outputPath) });
    }
  }
  return tasks;
}

export function sectionTasks(bookId: string, roots: CompilerStoreRoots = {}): SectionTask[] {
  const normalized = normSlug(bookId);
  const tasks: SectionTask[] = [];
  for (const chapterNumber of expectedSourceChapters(normalized, { stateRoot: roots.stateRoot })) {
    let chapterId = `${normalized}-ch${String(chapterNumber).padStart(2, "0")}`;
    try { chapterId = readJsonFile<ChapterBlueprintV1>(blueprintPath(normalized, chapterNumber, roots)).chapterId; } catch { /* keep derived */ }
    for (const kind of SECTION_KINDS) {
      const taskPath = sectionTaskPath(normalized, chapterNumber, kind, roots);
      const outputPath = sectionPath(normalized, chapterNumber, kind, roots);
      tasks.push({ bookId: normalized, chapterNumber, chapterId, kind, taskPath, outputPath, exists: existsSync(outputPath) });
    }
  }
  return tasks;
}

export function missingSectionTasks(bookId: string, roots: CompilerStoreRoots = {}): SectionTask[] {
  return sectionTasks(bookId, roots).filter((t) => !t.exists || !existsSync(t.taskPath));
}

export function readSectionTask(task: SectionTask, selected?: Readonly<{ content: AuthorV4ContentSelection; logicalPath: string }>): string {
  if (selected) return readAuthorV4SelectedText(selected.content, selected.logicalPath);
  return readFileSync(task.taskPath, "utf8");
}
