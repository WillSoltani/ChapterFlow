import { voiceRegisterLine } from "../lib/voiceCard.js";
import { CHAPTER_PROSE_CARD_CAPS, chapterProseFields, clampProsePassage, type ChapterProseSource } from "./chapterProse.js";
import type { BookScars } from "../lib/bookScars.js";
import type { SectionAvoidEntry } from "../books/sectionAvoidStore.js";
import type { CompilerStoreRoots } from "../artifacts/artifactStore.js";
import type { ChapterBlueprintV1, SectionKind, SourcePacketV1 } from "../artifacts/artifactTypes.js";
import type { AuthorV4ContentSelection } from "../assembler.js";
import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

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
        "Tier floors: fastRead >=350 chars at grade <=7 (aim 420-600 — never ride the floor); deepRead >=1000 chars at grade <=8.5 (aim 1150-1600); fullRead >=2400 chars at grade <=9.5 (aim 2700-3400); the assembled breakdown reads at Flesch ease >=70. Short sentences, plain verbs — but meet the length floors with concrete detail, not padding.",
        "Teach the chapter, not the provenance discipline: no reader-facing source-grounding rules (\"at least 3 named cases\", \"concrete settings give memory a handle\", \"claims checkable\").",
        "Output SummaryPackV1 JSON only.",
      ];
    case "example-pack":
      return [
        "UNIVERSAL — Write ONLY the example pack; no summaries, quiz, cards, or implementation.",
        "Produce exactly the six blueprint slots (the final v21 gate requires six). exampleId = \"ex01\"..\"ex06\" in slot order, or \"chNN-exNN-slug\"; never include the bookId.",
        "Every example is a concrete human scene with a NAMED person living a defining moment. Use a different dealt name per slot; never use a source-figure name as an invented actor.",
        "Each example cites a namedExample/example anchor; source facts DRIVE the decision and never appear as props, labels, wall cards, desk objects, or title subjects.",
        "EVERY scenario shows a visible decision, tradeoff, mistake, friction, or recovery IN THE SCENE — a person choosing between two concrete options, catching an error, or paying a cost — not a smooth description of someone doing the right thing (SEC31); the validator enforces this per example.",
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
        "Distractor discipline: no strawman absolutes, the key is never the longest choice by chars (nor >1.4x avg distractor words / >1.5x avg chars), no proof tails; most-keys-longest blocks outright (SEC52/SEC53/SEC59/SEC116/SEC121).",
        "CHOICE PARITY METHOD: write the two distractors FIRST (15-22 words of concrete chapter-specific substance each), then write the key to the longer distractor's word count (±3), moving overflow into the explanation; count words per choice and rebalance wherever the key is longest.",
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
        "The three highest-scoring candidates are each validated against their own tier's cited anchors: if a candidate's tier cites one or more case anchors carrying two or more hardSpecifics, that line itself — not just the surrounding tier — must ground ANY ONE of those cited cases by including at least two of them verbatim (SEC16); grounding a single cited case is enough (you do NOT need two specifics from every cited case), so weave two of one case's concrete specifics into the aphorism from the start; the validator enforces this.",
        "RUBRIC TARGETS: Flesch ease >=70 (grades: fastRead <=7, deepRead <=8.5, fullRead <=9.5); at least two clean (<=14-word) memorable lines.",
        voiceCraftLine(kind),
      ];
    case "example-pack":
      return [
        "WHAT EXCELLENT LOOKS LIKE: six DIFFERENT scene engines — not six variations of \"a person weighs two options\". At least THREE are non-deliberation: a surprise that lands on someone; a ritual observed mid-action; a consequence unfolding from an earlier choice; a boundary case where the move backfires or must be withheld; a first-time or milestone; or a public recognition.",
        "Vary WHAT KIND of moment it is and WHO experiences it — a swapped name or prop is a repeat, not a variation. Let the dealt sceneFrame/requiredBeat set the kind of moment for each slot.",
        "The dealt venue, sceneMode and sceneFrame are STAGING DIRECTIONS, not text: realize each as concrete scene detail in your own words and NEVER reproduce the dealt string verbatim in the prose. A scenario that opens by quoting its venue (\"kept a working note on ...\") reads as template smell, and a garbled dealt string quoted literally reads as corrupted prose.",
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
 *  material — never another book's. Enforcement stays in the gates; this is guidance.
 *
 *  Two blocks, deliberately separate. Prohibitions come FIRST and are absolute.
 *  Over-used material follows and carries a quota of one plus an instruction to
 *  paraphrase elsewhere — correct for scar tissue, and the exact inverse of what a
 *  safety rule needs, which is why a prohibition must never be filed as a phrase,
 *  frame, or note. */
function bookScarsSection(scars: BookScars | null): string {
  return renderBookScarsBlock(scars);
}

/**
 * The rendered scar block, or "" when the book has no scars.
 *
 * Exported because the section writer is not the only surface that must honour a
 * book's rules: the candidate-repair writer rewrites a chapter after a QC or
 * panel failure and needs the same prohibitions, in the same framing, or a repair
 * can reintroduce exactly the wording a panel blocked. Both callers must render
 * from one function so the two prompts cannot drift.
 */
export function renderBookScarsBlock(scars: BookScars | null): string {
  if (!scars) return "";
  const blocks: string[] = [];

  if (scars.prohibitions.length) {
    const hard: string[] = [
      // Phrased to cover BOTH shapes a rule takes: a ban and a requirement. An
      // earlier wording ("there is no number of times any of these may appear")
      // quantified over the items themselves, which read correctly for a ban and
      // inverted a mandate — telling the writer that a phrase a FACT PIN requires
      // must never appear.
      "\n\nNON-NEGOTIABLE RULES FOR THIS BOOK — each rule below is absolute, whether it forbids something or requires it. They are not style preferences and carry no quota: a rule that forbids something admits no permitted first use and no paraphrase, and a rule that requires something must be satisfied on every surface it names. Where two rules could appear to collide, the one that protects the reader from harm wins, and the other yields.",
    ];
    for (const rule of scars.prohibitions) hard.push(`- ${rule}`);
    blocks.push(hard.join("\n"));
  }

  const overUse: string[] = [];
  if (scars.phrases.length) overUse.push(`- Over-used case phrases: ${scars.phrases.map((p) => `"${p}"`).join("; ")}.`);
  if (scars.frames.length) overUse.push(`- Over-used scene/prop/connective frames: ${scars.frames.join("; ")}.`);
  for (const note of scars.notes) overUse.push(`- ${note}`);
  if (overUse.length) {
    blocks.push([
      "\n\nKNOWN OVER-USED MATERIAL FOR THIS BOOK — each item may appear in at most one teaching unit book-wide; paraphrase the mechanism everywhere else.",
      ...overUse,
    ].join("\n"));
  }

  return blocks.join("");
}

function sectionSchemaHint(kind: SectionKind, deliveryMode: SectionTaskDeliveryMode = "FILE_WRITE"): string {
  if (deliveryMode === "DIRECT_JSON") {
    switch (kind) {
      case "summary-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"summary-pack","chapterId":"chapter-id","hook":{"hook":"A concrete chapter-specific tension opens this lesson with enough detail to orient the reader.","counterintuition":"The intuitive move can hide the mechanism that matters most.","sourceAnchorIds":["anchor-id"],"counterintuitionSourceAnchorIds":["anchor-id"]},"breakdown":{"fastRead":"Write the complete fast-read summary here.","deepRead":"Write the complete deep-read summary here.","fullRead":"Write the complete full-read summary here.","sourceAnchorIds":{"fastRead":["anchor-id"],"deepRead":["anchor-id"],"fullRead":["anchor-id"]}},"keyTakeaway":"State one concrete takeaway.","keyTakeawaySourceAnchorIds":["anchor-id"],"tryThisNow":"State one immediate action grounded in the chapter.","tryThisNowSourceAnchorIds":["anchor-id"],"sourceFactIds":["fact-id"]}`;
      case "example-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"example-pack","chapterId":"chapter-id","examples":[{"exampleId":"ex01","slotId":"example-slot-id","title":"Concrete Moment","scenario":"A named person faces a specific chapter-grounded decision and experiences its consequence.","whatToDo":"Take one concrete action that applies the demonstrated mechanism.","whyItMatters":"Explain why that action follows from the cited source fact.","sourceAnchorIds":["anchor-id"],"sourceFactIds":["fact-id"],"namedCaseIds":["case-id"],"introducedEntities":["Person Name"],"numbersUsed":["verified number"]}]}`;
      case "learning-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"learning-pack","chapterId":"chapter-id","quiz":{"passingScorePercent":70,"questions":[{"questionId":"q01","sourceAnchorId":"anchor-id","sourceAnchorIds":["anchor-id"],"keyEvidenceAnchorIds":["anchor-id"],"prompt":"Suppose you face a chapter-specific decision; which response best applies the mechanism?","choices":["Plausible response one","Plausible response two","Plausible response three"],"correctIndex":0,"explanation":"Explain why the keyed response follows from the cited evidence.","bloomsLevel":"apply","depthLevel":"standard"}]},"cards":{"cards":[{"cardId":"card01","sourceAnchorId":"anchor-id","sourceAnchorIds":["anchor-id"],"front":"Which chapter-specific mechanism should you retrieve here?","back":"State the mechanism, its boundary, and the concrete evidence that makes it useful.","difficulty":"easy"}]}}`;
      case "action-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"action-pack","chapterId":"chapter-id","tryThisNow":"Take one concrete, low-friction action that applies the cited mechanism today.","tryThisNowSourceAnchorIds":["anchor-id"],"implementationPlan":{"title":"Practice One Concrete Skill","titleSourceAnchorIds":["anchor-id"],"coreSkill":"Describe the skill, trigger, constraint, and observable result in concrete terms.","coreSkillSourceAnchorIds":["anchor-id"],"ifThenPlans":[{"sourceAnchorId":"anchor-id","sourceAnchorIds":["anchor-id"],"context":"Before a specific recurring decision","plan":"If the trigger appears, then perform the chapter-specific action and check its result."}],"twentyFourHourChallenge":"Run the chapter-specific practice once within twenty-four hours and record the observable result.","twentyFourHourChallengeSourceAnchorIds":["anchor-id"],"weeklyPractice":"Repeat the practice on a specific cadence and adjust from observed results.","weeklyPracticeSourceAnchorIds":["anchor-id"]}}`;
    }
  }
  switch (kind) {
    case "summary-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"summary-pack","chapterId":"...","hook":{...HookOutput},"breakdown":{...BreakdownOutput},"keyTakeaway":"...","keyTakeawaySourceAnchorIds":["..."],"tryThisNow":"...","tryThisNowSourceAnchorIds":["..."],"sourceFactIds":["..."]}`;
    case "example-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"example-pack","chapterId":"...","examples":[{"exampleId":"ex01","title":"...","scenario":"...","whatToDo":"...","whyItMatters":"...","sourceAnchorIds":["..."],"sourceFactIds":["..."],"namedCaseIds":["..."]}]}`;
    case "learning-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"learning-pack","chapterId":"...","quiz":{"passingScorePercent":70,"questions":[{"questionId":"q01","sourceAnchorIds":["..."],"keyEvidenceAnchorIds":["..."],"prompt":"...","choices":["...","...","..."],"correctIndex":0,"explanation":"...","bloomsLevel":"apply","depthLevel":"standard"}]},"cards":{"cards":[...]}}`;
    case "action-pack": return `{"schemaVersion":"section-artifact-v1","artifactType":"action-pack","chapterId":"...","tryThisNow":"...","tryThisNowSourceAnchorIds":["..."],"implementationPlan":{...ImplementationPlanOutput}}`;
  }
}

function directJsonShapeRules(kind: SectionKind): string {
  switch (kind) {
    case "summary-pack": return "- hook.hook must be at least 40 characters.";
    case "learning-pack": return "- Every cards.cards[].front must be a retrieval question ending in ?.";
    case "action-pack": return "- Every implementationPlan.ifThenPlans[].plan must begin with If.";
    case "example-pack": return "";
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

export type SectionTaskRenderContext = Readonly<{
  voiceCard: string | null;
  bookScars: BookScars | null;
}>;

export type SectionTaskDeliveryMode = "FILE_WRITE" | "DIRECT_JSON";

/**
 * Verbatim gate-blocker feedback for a bounded section RETRY. The compiler's
 * section gate is a deterministic function of the draft; when it rejects a draft
 * the precise blockers ARE the repair instructions, so a retry pastes them back
 * (with the rejected draft) instead of throwing them away. Mirrors v24's
 * author-first retry cards, where a gate/preflight FAIL feeds the retry prompt.
 */
export type SectionRetryFeedback = Readonly<{
  /** Rendered blocker lines from the prior attempt. For an in-process section-gate
   *  rejection these are `checkId@path:message` lines; for a GATEWAY schema
   *  rejection or a transient process failure (Task 11j) this is a single cause
   *  line — there are no per-check blockers to enumerate. */
  blockerLines: readonly string[];
  /** The prior attempt's rejected draft, echoed so the model edits rather than
   *  restarts. ABSENT for a gateway/transient rejection: the raw invalid output
   *  never leaves the gateway, so there is nothing to echo — never fabricate one. */
  priorDraft?: unknown;
  /** Set when the GATEWAY's source-controlled OUTPUT schema (not the in-process
   *  section gate) rejected the previous output — MODEL_OUTPUT_INVALID. The card
   *  reminds the model of the schema; it cannot echo the unavailable raw output. */
  gatewaySchemaRejection?: boolean;
  /** Set when the previous attempt was lost to a TRANSIENT model process failure
   *  (MODEL_PROCESS_FAILED) before any output was produced — nothing was wrong
   *  with the content, so the card asks only for a correct result this time. */
  transientProcessFailure?: boolean;
}>;

// Task 11h: matches an anchor-specifics gate blocker — the shared message shape emitted by
// validateAnchorHardSpecifics (SEC14 summary_anchor_specifics, SEC16 summary_memorable_anchor_specifics)
// and the SEC33 example_anchor_specifics gate: "…cites <anchorId> but uses <present>/<min> required
// hardSpecifics verbatim…". Capture group 1 = the cited anchor id, group 2 = the required count.
const ANCHOR_SPECIFICS_BLOCKER_RE = /cites (\S+) but uses \d+\/(\d+) required hardSpecifics verbatim/;

/**
 * Task 11h enrichment. An anchor-specifics blocker names the cited case id and the required
 * COUNT but never the STRINGS: the writer has the case in its SOURCE PACKET yet cannot tell
 * which concrete strings the deterministic gate accepts as verbatim matches, so it drifts
 * 0/2 → 1/2 by luck. This enumerates, for each DISTINCT anchor id cited by an anchor-specifics
 * blocker, that anchor's own `hardSpecifics` — looked up from the SAME `packet.allowedAnchors`
 * the validator reads (validateAnchorHardSpecifics keys `sourceAnchorById(packet)` on id), never
 * re-derived, so the list cannot drift from what the gate checks — and states the gate's actual
 * matching rule (exact case-insensitive substring). Cases not cited by any blocker are omitted,
 * keeping the card targeted instead of dumping the whole packet.
 */
function anchorSpecificsEnumeration(
  blockerLines: readonly string[],
  anchors: readonly SourcePacketV1["allowedAnchors"][number][],
): string {
  const requiredMinById = new Map<string, number>();
  for (const line of blockerLines) {
    const match = ANCHOR_SPECIFICS_BLOCKER_RE.exec(line);
    if (!match) continue;
    const min = Number(match[2]);
    // Same case cited by multiple units: enumerate against the strictest required count.
    requiredMinById.set(match[1], Math.max(requiredMinById.get(match[1]) ?? 0, Number.isFinite(min) ? min : 0));
  }
  if (requiredMinById.size === 0) return "";
  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
  const blocks: string[] = [];
  for (const [id, min] of requiredMinById) {
    const specifics = byId.get(id)?.hardSpecifics ?? [];
    if (specifics.length === 0) continue;
    const quoted = specifics.map((specific) => `    • "${specific}"`).join("\n");
    blocks.push(`REQUIRED VERBATIM SPECIFICS — ${id} (use at least ${min} EXACTLY as written):\n${quoted}`);
  }
  if (blocks.length === 0) return "";
  return `\n\nThe anchor-specifics gate matches each required string by EXACT case-insensitive substring — a paraphrase, synonym, or reworded clause does NOT count. Copy the listed strings into the cited unit verbatim; because matching is case-insensitive, capitalizing the first letter of a specific that opens a sentence is safe and still counts as verbatim — do this, since the readability gate SEC106 rejects an uncapitalized sentence start:\n${blocks.join("\n")}\n`;
}

// Task 11l: matches an anchor-FILING / claim-class gate blocker — the family emitted whenever a
// draft cites an anchor under a claim class its `supportsClaimTypes` does not list. SEC32
// (example_anchor_claim_type: "example N sourceAnchorId <id> does not support example claims; use a
// named-example anchor and keep fact ids in sourceFactIds") and its validateAnchorClaimType siblings
// (SEC13/SEC15/SEC55, "<label> cites <id> (<kind>) but that anchor does not support <claimType>
// claims") share the "does not support <claimType> claims" tail. This is a DIFFERENT gate class than
// 11h's anchor-SPECIFICS blocker ("…uses P/N required hardSpecifics verbatim"), which this must NOT
// match — the two enrichments stay orthogonal.
const ANCHOR_FILING_BLOCKER_RE = /does not support \S+ claims/i;

/**
 * Task 11l enrichment (generalizes finding 15). An anchor-filing blocker tells the writer that one
 * cited id is filed under the wrong claim class, but never which of the packet's anchors ARE
 * capable of the class it needs — same feedback-quality gap as 11h, different gate. This appends a
 * generic ANCHOR INVENTORY: the packet's own `allowedAnchors` grouped by the SAME discriminators the
 * gates read — `supportsClaimTypes` (SEC32/SEC55 pass/fail) and `kind` (named in the reject
 * message) — never a regex on the id. Group 1 lists every example-claim-capable anchor
 * (supportsClaimTypes ⊇ {example}); group 2 lists fact-class anchors (kind testable_fact that do not
 * support example) with the gate's own filing rule (cite in sourceFactIds, never as an example
 * anchor); a catch-all lists any remaining anchors with the exact claim classes each one supports so
 * concept/framework anchors can be filed correctly too. Fires ONLY when a filing blocker is present,
 * so cards without an anchor-class problem stay lean.
 */
function anchorInventoryAppendix(
  blockerLines: readonly string[],
  anchors: readonly SourcePacketV1["allowedAnchors"][number][],
): string {
  if (!blockerLines.some((line) => ANCHOR_FILING_BLOCKER_RE.test(line))) return "";
  if (anchors.length === 0) return "";
  const supportsExample = (a: SourcePacketV1["allowedAnchors"][number]): boolean =>
    a.supportsClaimTypes?.includes("example") ?? false;
  const exampleCapable = anchors.filter(supportsExample);
  const factClass = anchors.filter((a) => a.kind === "testable_fact" && !supportsExample(a));
  const filed = new Set([...exampleCapable, ...factClass].map((a) => a.id));
  const other = anchors.filter((a) => !filed.has(a.id));
  const bullet = (a: SourcePacketV1["allowedAnchors"][number]): string => `    • ${a.id}`;
  const groups: string[] = [];
  if (exampleCapable.length > 0) {
    groups.push(`may anchor example claims (file these as an example's sourceAnchorIds):\n${exampleCapable.map(bullet).join("\n")}`);
  }
  if (factClass.length > 0) {
    groups.push(`facts — cite in sourceFactIds, never as example anchors:\n${factClass.map(bullet).join("\n")}`);
  }
  if (other.length > 0) {
    groups.push(`other anchors — file each ONLY under a claim class it lists:\n${other.map((a) => `    • ${a.id} (supports: ${(a.supportsClaimTypes ?? []).join(", ") || "none"})`).join("\n")}`);
  }
  if (groups.length === 0) return "";
  return `\n\nANCHOR INVENTORY — an anchor may back a claim ONLY when its packet.allowedAnchors[] supportsClaimTypes lists that claim class; these groups are read straight off that field (and each anchor's kind), so file every id by its class:\n${groups.join("\n\n")}\n`;
}

/**
 * Task 11aa — the cross-chapter ASSEMBLY-AVOID block. A section writer sees only
 * its own chapter, so it cannot know the concrete phrase(s) other chapters already
 * spent; the cross-chapter gates (SEC93 venue, …) only compare packs at assembly.
 * When assembly evicts a colliding pack it records the collision durably; on the
 * re-draft the compiler port passes those entries here so the writer designs AWAY
 * from the exact phrase(s) the KEPT chapters retain. Renders "" when there is no
 * avoid-context (every non-re-draft task card stays byte-identical). Distinct from
 * retryFeedbackSection, which echoes THIS section's own-gate blockers within one run.
 */
function assemblyAvoidSection(avoids: readonly SectionAvoidEntry[] = []): string {
  if (avoids.length === 0) return "";
  const lines = avoids.map((avoid) => `- ${avoid.message}`).join("\n");
  return `\n\nCROSS-CHAPTER ASSEMBLY CONFLICT — a prior draft of this section collided with other chapters when the book was assembled. The section gate cannot see these in isolation; resolve every line and change nothing else:\n${lines}\n`;
}

/**
 * Task 11ai — the CHAPTER PROSE block (learning-pack only). The packs are drafted
 * independently from one source packet, so without this the quiz writer designs from
 * every ALLOWED fact instead of the subset the summary writer actually put on the
 * page — the dominant blind-reader BLOCKER class (finding 45: stems and cards naming
 * "Dr. Thomas Bond", "1751", "Temperance" that appear nowhere in the read tiers).
 * Compile order is summary → example → learning → action, so this chapter's prose is
 * already drafted when the learning card is built; showing it makes the derivable-
 * from-the-prose promise satisfiable by construction. SEC120 backstops it.
 *
 * Renders "" for every other kind and whenever no prose is supplied, so every
 * existing task card stays byte-identical.
 */
function chapterProseSection(kind: SectionKind, source?: ChapterProseSource | null): string {
  if (kind !== "learning-pack" || !source) return "";
  const fields = chapterProseFields(source);
  const passages: string[] = [];
  // Each passage is clamped to CHAPTER_PROSE_CARD_CAPS — well above the top of every
  // contract aim band, so conformant prose renders whole and only a runaway tier
  // (nothing enforces a tier CEILING; SEC6 checks floors) is trimmed. Without this the
  // card's pinned length bound would be a hope rather than a bound.
  let clamped = false;
  const passage = (label: string, key: keyof typeof CHAPTER_PROSE_CARD_CAPS): void => {
    if (!fields[key]) return;
    const rendered = clampProsePassage(fields[key], CHAPTER_PROSE_CARD_CAPS[key]);
    clamped ||= rendered.length !== fields[key].length;
    passages.push(`${label}: ${rendered}`);
  };
  passage("HOOK", "hook");
  passage("COUNTERINTUITION", "counterintuition");
  passage("FAST READ", "fastRead");
  passage("DEEP READ", "deepRead");
  passage("FULL READ", "fullRead");
  passage("KEY TAKEAWAY", "keyTakeaway");
  if (passages.length === 0) return "";
  // The "EVERYTHING" claim has to stay true: an over-long passage is marked, and the
  // header says so rather than overstating what is shown.
  const completeness = clamped
    ? "A passage marked […prose truncated] ran past the card budget and was cut there; write only from what is shown."
    : "This is EVERYTHING the reader has seen when they reach your quiz and cards.";
  return `\n\nCHAPTER PROSE — the reader-visible text of THIS chapter, already drafted. ${completeness}\n${passages.join("\n\n")}\n\nDERIVABLE FROM THE PROSE — every quiz stem, every choice, every explanation, and every review card must be answerable from the CHAPTER PROSE above ALONE. Cite only names, dates, numbers, and terms that appear in that prose; a term the prose never uses cannot be introduced on a card back, and a date or figure the prose never states cannot be reasoned about in a stem. If a fact is in the SOURCE PACKET below but not in the prose, it is NOT available to you here — teach what the reader was actually shown, or the question cannot be derived from the page (SEC120); the validator enforces this.`;
}

function retryFeedbackSection(feedback?: SectionRetryFeedback, anchors: readonly SourcePacketV1["allowedAnchors"][number][] = []): string {
  if (!feedback || feedback.blockerLines.length === 0) return "";
  const blockers = feedback.blockerLines.map((line) => `- ${line}`).join("\n");
  // A transient model process failure (Task 11j): no content problem and no
  // output to echo — ask only for a correct result this time.
  if (feedback.transientProcessFailure) {
    return `\n\nPREVIOUS ATTEMPT DID NOT COMPLETE — nothing was wrong with your content:\n${blockers}\nProduce a correct result this time. Return exactly one JSON object matching the schema hint above and nothing else.\n`;
  }
  // A GATEWAY-level output-schema rejection (Task 11j): the raw invalid output
  // stays inside the gateway and cannot be echoed back — never fabricate one.
  if (feedback.gatewaySchemaRejection) {
    return `\n\nPREVIOUS OUTPUT REJECTED BEFORE IT REACHED THIS PROCESS:\n${blockers}\nThe raw invalid output stays inside the output-schema gate and cannot be echoed back here. Return exactly one JSON object matching the schema hint above and nothing else.\n`;
  }
  const enumeration = anchorSpecificsEnumeration(feedback.blockerLines, anchors);
  const inventory = anchorInventoryAppendix(feedback.blockerLines, anchors);
  return `\n\nPREVIOUS DRAFT REJECTED BY SECTION GATES — fix exactly these:\n${blockers}\n\nThese blockers come from the same deterministic gates that will re-validate your next draft. Resolve every listed blocker and change nothing else. Your rejected draft was:\n\`\`\`json\n${JSON.stringify(feedback.priorDraft, null, 2)}\n\`\`\`\n${enumeration}${inventory}`;
}

export function buildSectionTaskMarkdown(args: { bookId: string; kind: SectionKind; blueprint: ChapterBlueprintV1; sourcePacket: SourcePacketV1; outputPath: string; context: SectionTaskRenderContext; deliveryMode?: SectionTaskDeliveryMode; retryFeedback?: SectionRetryFeedback; assemblyAvoid?: readonly SectionAvoidEntry[];
  /** Task 11ai — THIS chapter's already-drafted summary pack (its reader-visible
   *  prose). Consumed by the learning-pack card only; ABSENT everywhere else, so an
   *  omitted field renders exactly today's task card. */
  chapterProse?: ChapterProseSource | null }): string {
  const { bookId, kind, blueprint, sourcePacket, outputPath, context, deliveryMode = "FILE_WRITE", retryFeedback, assemblyAvoid, chapterProse } = args;
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
  // Task 11z: the quiz gates (SEC55-58) demand >=1 of a cited case's
  // hardSpecifics verbatim in each prompt/explanation, and each slot's case
  // citations are DEALT (caseCueIds) — the writer cannot choose to cite less.
  // Joining slot->case->specifics preemptively collapses first-draft SEC56
  // density instead of relying on retry cards to teach it slot by slot.
  const quizSpecificsPreflight = (() => {
    if (kind !== "learning-pack") return "";
    const byId = new Map((sourcePacket.allowedAnchors ?? []).map((a) => [a.id, a] as const));
    const slots = blueprint.sections.quiz ?? [];
    const citedCases = new Map<string, string[]>();
    const slotLines: string[] = [];
    slots.forEach((slot, i) => {
      const cues = ((slot as { caseCueIds?: string[] }).caseCueIds ?? []).filter((id) => (byId.get(id)?.hardSpecifics ?? []).length > 0);
      if (!cues.length) return;
      for (const id of cues) citedCases.set(id, byId.get(id)?.hardSpecifics ?? []);
      slotLines.push(`q${i + 1}:${cues.join(",")}`);
    });
    if (!slotLines.length) return "";
    const caseLines = [...citedCases.entries()].map(([id, specs]) => `- ${id}: ${specs.map((x) => `"${x}"`).join(" | ")}`);
    return `\n\nREQUIRED VERBATIM SPECIFICS BY QUIZ SLOT (SEC56 checks the PROMPT and the EXPLANATION separately: each citing question weaves at least 1 of its case's specifics verbatim — exact case-insensitive substring — into the prompt AND at least 1 into the explanation):\n${caseLines.join("\n")}\nSlots: ${slotLines.join("  ")}`;
  })();
  if (deliveryMode === "DIRECT_JSON") {
    const shapeRules = directJsonShapeRules(kind);
    return `ROLE\nYou are the ${ROLE_NAME[kind]} for ChapterFlow v23. You have one bounded artifact to produce.\n\nINPUTS\n- bookId: ${bookId}\n- chapterId: ${blueprint.chapterId}\n- chapterNumber: ${blueprint.chapterNumber}\n\nTASK\n${sectionContract(kind)}${bookScarsSection(context.bookScars)}${voiceCardSection(kind, context.voiceCard)}\n\nDELIVERY\n- Do not use tools, shell commands, filesystem access, or network access.\n- Do not read or write files.\n- Final response must be exactly one JSON object matching the schema hint.\n- Return no prose and no Markdown fence.${shapeRules ? `\n${shapeRules}` : ""}\n\nDO NOT\n${sectionDoNotLines(outputPath).slice(1).join("\n")}\n\nOUTPUT SCHEMA HINT\n\`\`\`json\n${sectionSchemaHint(kind, deliveryMode)}\n\`\`\`\n\nSECTION BLUEPRINT — the slots and dealt variety for THIS section\n\`\`\`json\n${JSON.stringify(sectionInput, null, 2)}\n\`\`\`${quizSpecificsPreflight}${chapterProseSection(kind, chapterProse)}\n\nSOURCE PACKET — ONLY allowed facts/cases/numbers/entities\n\`\`\`json\n${JSON.stringify(writerPacket, null, 2)}\n\`\`\`\n${retryFeedbackSection(retryFeedback, sourcePacket.allowedAnchors)}${assemblyAvoidSection(assemblyAvoid)}`;
  }
  return `ROLE\nYou are the ${ROLE_NAME[kind]} for ChapterFlow v23. You have one bounded artifact to produce.\n\nINPUTS\n- bookId: ${bookId}\n- chapterId: ${blueprint.chapterId}\n- chapterNumber: ${blueprint.chapterNumber}\n- outputPath: ${outputPath}\n\nTASK\n${sectionContract(kind)}${bookScarsSection(context.bookScars)}${voiceCardSection(kind, context.voiceCard)}\n\nDO NOT\n${sectionDoNotLines(outputPath).join("\n")}\n\nOUTPUT SCHEMA HINT\n\`\`\`json\n${sectionSchemaHint(kind)}\n\`\`\`\n\nSECTION BLUEPRINT — the slots and dealt variety for THIS section\n\`\`\`json\n${JSON.stringify(sectionInput, null, 2)}\n\`\`\`${quizSpecificsPreflight}${chapterProseSection(kind, chapterProse)}\n\nSOURCE PACKET — ONLY allowed facts/cases/numbers/entities\n\`\`\`json\n${JSON.stringify(writerPacket, null, 2)}\n\`\`\`\n\nVALIDATION\nYour draft is validated externally by deterministic section gates — you cannot run the validator yourself here. If a gate rejects the draft, its precise blockers come back to you as exact fixes; resolve every listed blocker and change nothing else.\n${retryFeedbackSection(retryFeedback, sourcePacket.allowedAnchors)}${assemblyAvoidSection(assemblyAvoid)}`;
}

export function dealSectionTasks(_bookId: string, _roots: CompilerStoreRoots = {}): SectionTask[] {
  throw legacyRouteDisabled("sectionTasks.dealSectionTasks");
}

export function sectionTasks(_bookId: string, _roots: CompilerStoreRoots = {}): SectionTask[] {
  throw legacyRouteDisabled("sectionTasks.sectionTasks");
}

export function missingSectionTasks(_bookId: string, _roots: CompilerStoreRoots = {}): SectionTask[] {
  throw legacyRouteDisabled("sectionTasks.missingSectionTasks");
}

export function readSectionTask(_task: SectionTask, _selected?: Readonly<{ content: AuthorV4ContentSelection; logicalPath: string }>): string {
  throw legacyRouteDisabled("sectionTasks.readSectionTask");
}
