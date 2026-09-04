import { loadBannedPhrases } from "../critics/shared.js";
import { voiceRegisterLine } from "../lib/voiceCard.js";
import {
  CHAPTER_PROSE_CARD_CAPS,
  chapterProseFields,
  clampProsePassage,
  packetProseDerivability,
  renderProseSpecificList,
  renderProseStandDownIds,
  classifyProseSpecific,
  type ChapterProseSource,
  type ProseDerivability,
  type ProseSpecificMark,
} from "./chapterProse.js";
import { bookRuleGovernsChapter, type BookScars } from "../lib/bookScars.js";
import type { SectionAvoidEntry } from "../books/sectionAvoidStore.js";
import type { CompilerStoreRoots } from "../artifacts/artifactStore.js";
import type { ChapterBlueprintV1, SectionKind, SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { boundSourceQuoteForCard } from "../compiler/sourcePacketProjection.js";
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
 *  (commit 3702dd2d5); tests/contract-refactor.test.ts snapshots it exactly.
 *
 *  ONE WORD HAS MOVED SINCE THAT VALIDATION (R-015): the closing clause read "state
 *  it plainly rather than embroidering it", and "rather than" is soft-banned by the
 *  SAME prompt (config/banned-phrases.json, perBookBudget 15), so the paragraph the
 *  writer is told to imitate as a style model spent one of the book's allowance and
 *  modelled a tic the DO NOT block asks it to avoid. It now reads "instead of" — the
 *  plain substitute the ban's own reason names. The scene, the contrast pair, and
 *  the invent-nothing clause are byte-identical to the validated text.
 *
 *  Do not edit further: any change beyond a ban conflict of that kind is an unvalidated
 *  change to a paragraph whose lift was measured, and the snapshot test will fail. */
const SUMMARY_VOICE_PARAGRAPH =
  `VOICE — narrate the real cases as LIVED MOMENTS, not abstract summaries: this genre teaches through concrete stories, so build deepRead and fullRead AROUND this chapter's real named cases. Open a case with one specific sensory moment drawn ONLY from its hardSpecifics (a named person, place, object, or number that is actually in the source), let the reader briefly FEEL the moment, THEN name the principle it proves. As a STYLE model only: prefer "The nurse taped a bright cartoon over the ceiling light so the boy staring up during the scan had something to find, and he stopped crying" over "Environments can be redesigned to reduce patient distress." Invent nothing beyond this chapter's own source hardSpecifics — the sample scene is only a voice model, so never import its nurse/boy/scan or any other book's cast, and if you have only a bare fact, state it plainly instead of embroidering it.`;

/** The voice line closing every craftBrief. Coherent whether or not a VOICE CARD
 *  follows (books with no voice signal get no card — P05), so it is never a dangling
 *  reference. Summary/example carry the register; learning/action match it.
 *
 *  The no-card fallback names a plain, concrete REGISTER and stops there: it used to
 *  add "short sentences, plain verbs", which outranked whatever cadence a card asked
 *  for (R-005). Cadence is stated once, as a measurable, in the summary tier-floor
 *  rule — where it names the two critics that actually score it and the severity they
 *  carry (E7.long_sentence / E8.monotone_cadence, majors raised at chapter assembly
 *  in critics/finalGate.ts, not blockers and not checked by sectionGate). */
function voiceCraftLine(kind: SectionKind): string {
  return kind === "summary-pack" || kind === "example-pack"
    ? `VOICE: when a VOICE CARD is shown below, write in its register (match it, never quote it); with no card, use a plain, concrete register.`
    : `VOICE: when a VOICE CARD register note is shown below, keep explanations and actions in that register; with no card, use a plain, concrete register, not a neutral textbook voice.`;
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
        "Tier floors: fastRead >=350 chars at grade <=7 (aim 420-600 — never ride the floor); deepRead >=1000 chars at grade <=8.5 (aim 1150-1600); fullRead >=2400 chars at grade <=9.5 (aim 2700-3400); the assembled breakdown reads at Flesch ease >=70. Vary sentence length: plain verbs, no sentence over 30 words, and never a run of same-length short declaratives — E7.long_sentence and E8.monotone_cadence each raise a major at chapter assembly. Meet the length floors with concrete detail, not padding.",
        "TIER ROLES — a longer tier ADDS, it never restates: fastRead gives the immediate move and why it matters now; deepRead explains the mechanism through this chapter's named cases, complete enough that a reader who stops there can answer the quiz; fullRead adds what deepRead left out, each in its own sentences: the antecedents, the second-order consequence, the hard edge or limit, and the nuance. The first sentence of each tier differs in wording and structure, and no fullRead sentence reuses a deepRead sentence: restating more than a quarter of a tier's sentences, or adding almost no new content words, is refused (SEC130/SEC131).",
        "Teach the chapter, not the provenance discipline: no reader-facing source-grounding rules (\"at least 3 named cases\", \"concrete settings give memory a handle\", \"claims checkable\").",
        "Output SummaryPackV1 JSON only.",
      ];
    case "example-pack":
      return [
        "UNIVERSAL — Write ONLY the example pack; no summaries, quiz, cards, or implementation.",
        "Produce exactly the six blueprint slots (the final v21 gate requires six). exampleId = \"ex01\"..\"ex06\" in slot order, or \"chNN-exNN-slug\"; never include the bookId.",
        "Every example is a concrete human scene with a NAMED person living a defining moment. Use a different dealt name per slot; never use a source-figure name as an invented actor.",
        "Each example cites a namedExample/example anchor; source facts DRIVE the decision and never appear as props, labels, wall cards, desk objects, or title subjects.",
        "SCENE ENGINE BY SLOT: even slots (ex01/ex03/ex05) carry their dealt DECISION frame — a person choosing between two concrete options, catching an error, or paying a cost. Odd slots (ex02/ex04/ex06) carry their dealt EXPERIENTIAL frame as the WHOLE scene: a surprise, a ritual, a first time, a recognition — not a lived moment with a deliberation grafted on. Every scenario, either kind, still shows something at stake happening in the scene: a cost, a friction, a consequence, a correction (SEC31); the validator enforces this per example.",
        "whatToDo adds a new instruction/test/refusal rule not already narrated in the scenario. whyItMatters explains the cited fact's own MECHANISM and the decision shown — repeating the case's names and numbers is not an explanation, and the case is named at most once, never in the first clause (SEC39).",
        "Output ExamplePackV1 JSON only.",
      ];
    case "learning-pack":
      return [
        "UNIVERSAL — Write ONLY the quiz and review cards.",
        "Each question: questionId, prompt, exactly 3 choices, correctIndex (MUST match the blueprint slot), explanation, bloomsLevel (remember|understand|apply|analyze|evaluate|create), depthLevel (from the slot).",
        "Provenance uses claim-type-matching anchors (quiz_prompt/quiz_explanation/quiz_key_evidence, review_card); namedExample anchors qualify when listed. Cite the case BY NATURAL REFERENCE: no verbatim token is required of a stem, an explanation or a card, and nothing you name may be missing from the chapter's own fast/deep prose (SEC55/SEC120).",
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
        "TEACH EACH CASE ONCE: every case this chapter cites must show at least two of its hardSpecifics somewhere across the hook, the three tiers and the keyTakeaway — once per chapter, not once per unit. After that, name the case naturally; no single specific may appear in more than half the units that cite it, and 40% is the target (SEC14/SEC129); the validator enforces this.",
        "In a parallel batch, vary hook first words — no three in five share a first word, and do not default to \"At\"/\"In\"/\"On\" location stamps (SEC95); the validator enforces this.",
        LEAK_FAMILY_LINE,
      ];
    case "example-pack":
      return [
        "DESIGN AROUND THE GATES:",
        "AS9/SEC80/SEC89 compare examples across chapters: each of the six slots needs a distinct role, timing, scene engine, turning point, and advice shape; the validator enforces this. Obey the dealt sceneFrame/requiredBeat as well: no gate reads them, so nothing but you keeps same-position slots from sharing one dramatic transaction.",
        "No exact five-word phrase across three or more scenarios, whatToDo, or whyItMatters lines — even source/legal labels (SEC87); the validator enforces this.",
        "Each example cites a namedExample/example anchor and uses at least ONE of its hardSpecifics — in the scenario, in whatToDo or in whyItMatters, wherever it belongs. NEVER get it in by having your character read, remember or recall the source case: the scene lives its own moment (SEC33/SEC133); the validator enforces this.",
        "Do not let the book default to one scene engine, action container, venue, ending, or evidence-gate across chapters (SEC85/SEC93/SEC96/SEC98/SEC100/SEC101/SEC108/SEC112); the validator enforces this.",
        LEAK_FAMILY_LINE,
      ];
    case "learning-pack":
      return [
        "DESIGN AROUND THE GATES:",
        "AS5/AS12 compare q01-to-q01 across the book: give every slot a different scenario, opening, decision pressure, and evidence source; the validator enforces this. Obey each slot's dealt promptShape, answerStyle, distractorTrap, and caseCueIds too: no gate reads them, and they are the book's variety budget.",
        "AS6 compares correct answers and distractors across chapters: every correct answer names this chapter's requiredFactIds mechanism in fresh words, never a book-level slogan; the validator enforces this.",
        "SEC81 compares review cards across the book: each card needs its own chapter-specific noun, case, or mechanism; the validator enforces this. The dealt frontShape, retrievalTarget, and backShape steer that variety and no gate reads them.",
        "Distractor discipline: no strawman absolutes in ANY choice INCLUDING THE KEY, the key is never the longest choice by chars (nor >1.4x avg distractor words / >1.5x avg chars), no proof tails; more than 20% of the chapter's questions keying the longest choice blocks (SEC52/SEC53/SEC59/SEC116/SEC121).",
        "CHOICE PARITY METHOD: write the two distractors FIRST (15-22 words of concrete chapter-specific substance each), then write the key to the longer distractor's word count (±3) AND to at most 1.5x the average distractor's characters. SEC53 measures both, so a word-matched key built from longer words still fails. CUT the overflow, never park it in the explanation: the explanation says why the key is right, it does not carry the rest of the key.",
        "At least 7 of 9 questions pose a NEW scenario IN THE STEM (\"you are…\", \"imagine…\", \"suppose…\", \"your team…\", \"a colleague…\", \"consider a…\") — an apply-level bloomsLevel no longer counts for anything the stem does not say (SEC117); the validator enforces this.",
        LEAK_FAMILY_LINE,
      ];
    case "action-pack":
      return [
        "DESIGN AROUND THE GATES:",
        "AS8 compares implementationPlan fields across chapters: each ifThen carries this chapter's requiredFactIds mechanism in its own words; the validator enforces this. No gate reads the dealt action.ifThenPlanShapes[], practiceForm, or practiceConstraint, so give each ifThen a different dealt shape yourself.",
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
        "A memorable line STATES THE IDEA and carries AT MOST ONE source specific — the case itself is taught by the tiers, so a line does not have to name it. The three the book ships are picked from your breakdown by principle density, they may not reproduce the hook, the counterintuition or the keyTakeaway, and no two may turn on the same detail (SEC16/SEC118/SEC135); the validator enforces this.",
        "RUBRIC TARGETS: Flesch ease >=70 (grades: fastRead <=7, deepRead <=8.5, fullRead <=9.5); at least two clean (<=14-word) memorable lines.",
        voiceCraftLine(kind),
      ];
    case "example-pack":
      return [
        "WHAT EXCELLENT LOOKS LIKE: six DIFFERENT scene engines — not six variations of \"a person weighs two options\". At least THREE are non-deliberation: a surprise that lands on someone; a ritual observed mid-action; a consequence unfolding from an earlier choice; a boundary case where the move backfires or must be withheld; a first-time or milestone; or a public recognition.",
        "Vary WHAT KIND of moment it is and WHO experiences it — a swapped name or prop is a repeat, not a variation. The dealt sceneFrame/requiredBeat IS the kind of moment for that slot; the three odd slots are where the non-deliberation scenes live.",
        "The dealt venue, sceneMode and sceneFrame are STAGING DIRECTIONS, not text: realize each as concrete scene detail in your own words and NEVER reproduce the dealt string verbatim in the prose. A scenario that opens by quoting its venue (\"kept a working note on ...\") reads as template smell, and a garbled dealt string quoted literally reads as corrupted prose.",
        "RUBRIC TARGETS: a distinct scene engine per slot; vary openings, venues, protagonists, outcomes, and title grammar across the six.",
        voiceCraftLine(kind),
      ];
    case "learning-pack":
      return [
        "WHAT EXCELLENT LOOKS LIKE: transfer-first questions the reader reasons through (\"you are…\", \"imagine…\", \"suppose…\", \"your team…\", \"a colleague…\"), set to apply/analyze/evaluate.",
        "Distractors are plausible MISCONCEPTIONS on the mechanism, not recognizable by length, hedging or SHAPE: when the key turns on a boundary qualifier (\"only…\", \"not…\", \"unless…\"), give at least one distractor the same shape (SEC134). Keep prompts lean; name at most one case. Cards ask a chapter-specific mechanism/contrast/failure-mode in varied stems, never a generic \"What should you inspect / What check does\" shell.",
        "If a stem names a case, the question must hinge on it, not staple in a standalone case-identifier sentence to hit a quota.",
        "The dealt frontShape, retrievalTarget and backShape are STAGING DIRECTIONS, not text: they name the ANGLE a card takes, never words to write. Never open a back by announcing the angle (\"The contrast is\", \"The boundary is\", \"The trigger is\", \"The failure mode is\", \"The source case is\"); open on the concrete thing itself and let the angle show. Three cards or stems in one chapter opening the same way is refused (SEC132).",
        "RUBRIC TARGETS: low distractor-tell rate (key never longest or most-hedged); high transfer ratio (>=7 of 9 new-scenario).",
        voiceCraftLine(kind),
      ];
    case "action-pack":
      return [
        "WHAT EXCELLENT LOOKS LIKE: actions a reader can actually notice and run today — a concrete trigger, a low-friction move, a provable result.",
        "tryThisNow opens with a chapter-specific trigger. coreSkill ends on a chapter-specific practice. ifThenPlans[].context is a situational trigger, not a bare venue. Vary the behavior across chapters: a two-option comparison, a price cap, a rejection rule, a delegation boundary, a one-minute audit, a cadence change, an owner question.",
        "The dealt practiceForm, practiceConstraint and ifThenPlanShapes are STAGING DIRECTIONS, not text: realize practiceForm and practiceConstraint ONCE, inside coreSkill, in your own words; give each ifThen a different dealt shape and a different observable move; open twentyFourHourChallenge on the reader's trigger, not on a time box (\"In the next 24 hours\").",
        "Never instruct the reader to write or recite a source label (\"write '60-second painful trial beside 90-second trial with milder ending'\"); translate the mechanism into a behavior.",
        "RUBRIC TARGETS: every action concrete, low-friction, and provable; no reused opener/closer/challenge shell across chapters.",
        voiceCraftLine(kind),
      ];
  }
}

/**
 * The three layers, composed — the exact craft contract a section writer of this
 * kind wrote under.
 *
 * Exported for the SAME reason `renderBookScarsBlock` is: the candidate-repair
 * writer rewrites the very fields a section writer produced, and until it was
 * given this text it rewrote them under no craft contract at all — no tier
 * floors, no CHOICE PARITY method, no distractor discipline, no craft brief. One
 * function, two callers, so the writer prompt and the repair prompt cannot drift
 * on what an excellent artifact of this kind is.
 */
export function sectionContract(kind: SectionKind): string {
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
function bookScarsSection(scars: BookScars | null, chapterNumber: number): string {
  return renderBookScarsBlock(scars, chapterNumber);
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
export function renderBookScarsBlock(scars: BookScars | null, chapterNumber: number): string {
  if (!scars) return "";
  const blocks: string[] = [];

  // R-274: only the rules that govern THIS chapter. A rule labelled "(chNN)" is a
  // statement about one chapter's episode; rendering it into the other chapters'
  // prompts spends the prompt on facts the writer cannot use and asserts them as
  // NON-NEGOTIABLE where they do not apply. Franklin's ch01 writer received 14 such
  // pins. Unlabelled rules still govern every chapter.
  const prohibitions = scars.prohibitions.filter((rule) => bookRuleGovernsChapter(rule, chapterNumber));
  if (prohibitions.length) {
    const hard: string[] = [
      // Phrased to cover BOTH shapes a rule takes: a ban and a requirement. An
      // earlier wording ("there is no number of times any of these may appear")
      // quantified over the items themselves, which read correctly for a ban and
      // inverted a mandate — telling the writer that a phrase a FACT PIN requires
      // must never appear.
      "\n\nNON-NEGOTIABLE RULES FOR THIS BOOK — each rule below is absolute, whether it forbids something or requires it. They are not style preferences and carry no quota: a rule that forbids something admits no permitted first use and no paraphrase, and a rule that requires something must be satisfied on every surface it names. Where two rules could appear to collide, the one that protects the reader from harm wins, and the other yields.",
    ];
    for (const rule of prohibitions) hard.push(`- ${rule}`);
    blocks.push(hard.join("\n"));
  }

  // R-008: notes are NOT over-use material. They are this book's standing style and
  // consistency rules (Franklin files two panel-blocker pins and three cadence rules
  // here), and the over-use header below rations each item to one teaching unit and
  // tells the writer to paraphrase it everywhere else. Under that header a cadence
  // rule reads as "vary sentence length once, then stop" and a chronology pin as
  // "state the order once, then reword it" — the same inversion the prohibition
  // channel exists to prevent. They get their own header, with no quota.
  if (scars.notes.length) {
    blocks.push([
      "\n\nSTYLE NOTES FOR THIS BOOK — apply throughout; these carry no quota and are not over-used material.",
      ...scars.notes.map((note) => `- ${note}`),
    ].join("\n"));
  }

  const overUse: string[] = [];
  if (scars.phrases.length) overUse.push(`- Over-used case phrases: ${scars.phrases.map((p) => `"${p}"`).join("; ")}.`);
  if (scars.frames.length) overUse.push(`- Over-used scene/prop/connective frames: ${scars.frames.join("; ")}.`);
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

/** The hard-banned phrases, rendered compactly from config/banned-phrases.json —
 *  the same file critics/register.ts checkBannedPhrases reads, which is what SEC92
 *  and the ship gate both call. Reading the config instead of hand-copying it is
 *  the point of R-014: a phrase added to the ban list reaches the writer the same
 *  day it starts failing drafts. */
function hardBannedPhraseList(): string {
  const config = loadBannedPhrases() as { hardBanned?: Array<{ phrase: string }> };
  return (config.hardBanned ?? []).map((entry) => `"${entry.phrase}"`).join("; ");
}

/** The soft-banned tics WITH their per-book budgets. The budget is the whole
 *  difference between the nine: "chapter argues that" is allowed 0 times a book
 *  and "rather than" 15, and a writer told only "avoid these" cannot tell them
 *  apart. Budgets are enforced book-wide by critics/bookGate.ts. */
function softBannedPhraseList(): string {
  const config = loadBannedPhrases() as { softBanned?: Array<{ phrase: string; perBookBudget?: number }> };
  return (config.softBanned ?? [])
    .map((entry) => `"${entry.phrase}" (max ${entry.perBookBudget ?? 0})`)
    .join("; ");
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
    // The em dash is hard-banned on every reader-facing field by the SHIP gate (B5,
    // critics/register.ts checkNoEmDash) and nothing said so at drafting time: the
    // live Franklin QC round qc-29d119c59544a5d991c71c7c9fec04bb carried 68 B5
    // blockers out of 96 — a write/ship disagreement, not a writer failing a rule it
    // had been given. SEC123 now mirrors B5 at compile time; this line is the half
    // that stops the em dash being minted in the first place.
    //
    // KEPT SHORT ON PURPOSE. The rendered learning-pack card sits at 61.5% of its
    // pinned pre-refactor length against a 62% ceiling (tests/contract-refactor.test.ts),
    // so ~237 characters is the entire budget this line has. It spends them on the
    // three things a writer cannot infer: the exact character (U+2014, shown
    // literally so no one has to guess which dash), what to use instead, and that
    // one occurrence is fatal. The pin is not moved to make room for it.
    `- Never use an em dash (—, U+2014) in reader-facing text; use a comma, period, parenthesis, or colon. No exceptions, no permitted first use: one fails the chapter (B5) and the draft (SEC123).`,
    // R-014. This used to name six of the 82 hard-banned phrases and four of the
    // nine soft-banned ones, so 76 strings that fail the draft outright (SEC92
    // pushes a BLOCKER on any of them, across every reader-facing field) were
    // never disclosed to the writer, and the four soft tics it did name arrived
    // with no budget. The em-dash precedent is the argument: 68 live B5 blockers
    // on a rule the writer had never been given. Rendered FROM config/
    // banned-phrases.json at build time, so the list cannot drift from the one
    // the gate reads and the drift class is closed rather than re-copied.
    `- HARD-BANNED PHRASES. One occurrence in reader-facing text, in any casing, fails the draft (SEC92) and the chapter (B-register); no permitted first use: ${hardBannedPhraseList()}.`,
    `- SOFT-BANNED house tics; "max N" is the WHOLE BOOK's allowance, and 0 means never: ${softBannedPhraseList()}. Prefer a plain alternative every time.`,
    "- Do not change the final ChapterV21 schema; this is an intermediate artifact only.",
  ];
}

/** The VOICE CARD block inserted between TASK and DO NOT, or "" when the book
 *  has no voice signal (voiceCard returns null → omit the section entirely, no
 *  empty scaffolding). summary/example writers carry the register — they set the
 *  book's voice — so they get the full card; learning/action writers get a
 *  2-line register note so explanations and actions match, not another card.
 *
 *  Both headers NAME the record the card was rendered from (R-004's second half).
 *  voiceCard() draws, in order, on the book's editor-in-chief charter, its curated
 *  author-voice profile, or the bibliography's authorVoice block — which the run
 *  freezes into the source packet under "## Author voice" (src/researcher.ts:958-964),
 *  the same packet this writer is reading. Without the naming line a writer holding
 *  both took them for two independent voice instructions. All three sources are named
 *  because the card string does not record which one fired. */
function voiceCardSection(kind: SectionKind, card: string | null): string {
  if (!card) return "";
  if (kind === "summary-pack" || kind === "example-pack") {
    return `\n\nVOICE CARD — how THIS book sounds (register only; match it, do not quote it)\nThis is the book's own voice record — its editor charter, its curated author-voice profile, or the "Author voice" block frozen into the source packet — rendered as an instruction; the card and that record are one voice, not two.\n${card}`;
  }
  return `\n\nVOICE CARD — register note, lifted from the same book voice record the summary and example writers matched\n- ${voiceRegisterLine(card)}\n- Keep explanations and actions in this register; do not slip into a neutral textbook voice.`;
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
// validateAnchorHardSpecifics (SEC74 action_anchor_specifics) and the SEC33
// example_anchor_specifics gate: "…cites <anchorId> but uses <present>/<min> required
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
 * matching rule (raw case-insensitive substring OR, for a multi-word specific, an in-order
 * clipped match: validateAnchorHardSpecifics -> clippedPhraseDerivable, SUBSEQUENCE_GAP_TOKENS
 * = 8, over normalizeDerivabilityText). Cases not cited by any blocker are omitted,
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
    blocks.push(`REQUIRED VERBATIM SPECIFICS — ${id} (use at least ${min}, matched by the rule above):\n${quoted}`);
  }
  if (blocks.length === 0) return "";
  return `\n\nThe anchor-specifics gate counts a required string as used when EITHER its exact text appears (case-insensitive) OR — for a multi-word string — its words appear IN ORDER in the same unit with no more than eight words between neighbours. Case, punctuation, digit separators and number words are normalized first, so "thirteen" matches "13". A synonym, a dropped word, or a reordering does NOT count, and a single-word string must appear exactly. So build the specific INTO a grammatical sentence of your own, keeping its words in order and close together, instead of pasting the telegraphic note as written:\n${blocks.join("\n")}\n`;
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
  const lines = avoids.map((avoid) => `- ${avoid.message}${assemblyAvoidEscalation(avoid)}`).join("\n");
  return `\n\nCROSS-CHAPTER ASSEMBLY CONFLICT — a prior draft of this section collided with other chapters when the book was assembled. The section gate cannot see these in isolation; resolve every line and change nothing else:\n${lines}\n`;
}

/**
 * The REGENERATION-livelock escalation. A first-round ban renders "" here, so
 * every task card that existed before this change stays byte-identical.
 *
 * The canary run showed the failure this exists for: the polite one-line ban
 * ("… — rewrite this tier's connective prose") was issued, the section WAS
 * re-drafted, and the writer re-minted the identical phrase. A ban that has
 * already failed N times is not made truer by repeating it, so from round 2 the
 * card stops describing the collision and starts naming the mechanical
 * constraint: the exact token sequence, the gate that rejects it, how many
 * re-drafts already re-used it, and the chapters that are ALLOWED to keep it (the
 * gate permits the phrase to exist — just not in this chapter too).
 */
function assemblyAvoidEscalation(avoid: SectionAvoidEntry): string {
  const rounds = avoid.rounds ?? 1;
  if (rounds <= 1) return "";
  const kept = avoid.keptByChapters.length > 0
    ? avoid.keptByChapters.map((chapterNumber) => `ch${String(chapterNumber).padStart(2, "0")}`).join(", ")
    : "other chapters";
  const priorDrafts = rounds - 1;
  return `\n  ESCALATED — ${priorDrafts} earlier re-draft${priorDrafts === 1 ? "" : "s"} of this section re-used this wording, so the book still cannot assemble. Gate ${avoid.checkId} rejects it. The banned token sequence is exactly: "${avoid.phrase}". Those words must not appear in this section in that order — delete the sentence that carries them and make its point another way; do not paraphrase around the edges and leave the sequence intact. ${kept} keep this wording and are allowed to; this chapter is the one that must give it up.`;
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
/**
 * R-055 — the chapter's own thesis, rendered as ORIENTATION and labelled as such.
 *
 * WHAT THIS IS. focus / coreClaim / hardEdge / keyClaims are the researcher's
 * paraphrase of what the chapter argues. Before this package no writer saw them at
 * all, which is how the released Franklin ch04 shipped a false fact while the
 * truer keyClaim sat unused in the sidecar.
 *
 * WHY IT IS NOT IN THE PACKET BLOCK. The packet block's header says "ONLY allowed
 * facts/cases/numbers/entities". These four fields carry NO sourceQuote and are
 * checked against the frozen text by no gate, so putting them there would widen
 * the citable channel of an accuracy package with unverified prose — and hardEdge
 * is by contract (researcher-chapter.system.md rule 5) the tempting WRONG reading,
 * which must never be presented to a writer as an allowed fact.
 *
 * Renders "" when the packet carries no chapterContext, so every model-memory card
 * and every legacy packet renders byte-identically.
 */
function chapterContextSection(context: SourcePacketV1["chapterContext"]): string {
  if (!context) return "";
  const body = {
    focus: context.focus || undefined,
    coreClaim: context.coreClaim || undefined,
    hardEdge: context.hardEdge || undefined,
    keyClaims: context.keyClaims && context.keyClaims.length > 0 ? context.keyClaims : undefined,
  };
  if (Object.values(body).every((v) => v === undefined)) return "";
  return `\n\nCHAPTER CONTEXT — READ-ONLY ORIENTATION, NOT CITABLE\nWhat this chapter argues, in the researcher's own paraphrase. It is NOT part of the allowed factual material: it is not a source of citable specifics, so take no claim, number, name or case detail from it — those come only from the SOURCE PACKET below. "hardEdge" states the tempting WRONG reading a careless summary reaches for; never assert it as true.\n\`\`\`json\n${JSON.stringify(body, null, 2)}\n\`\`\``;
}

function chapterProseSection(kind: SectionKind, source?: ChapterProseSource | null, derivability?: ProseDerivability | null): string {
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
  // Task 11ak: FULL READ is shown as CONTEXT but is deliberately NOT testable —
  // the tiers are a progressive-depth promise, and a reader who stops after Deep
  // must still be able to answer. SEC120 measures derivability against the
  // standalone tiers only, so the label must not invite testing from it.
  passage("FULL READ (NOT testable)", "fullRead");
  passage("KEY TAKEAWAY", "keyTakeaway");
  if (passages.length === 0) return "";
  // The "EVERYTHING" claim has to stay true: an over-long passage is marked, and the
  // header says so rather than overstating what is shown.
  const completeness = clamped
    ? "A passage marked […prose truncated] ran past the card budget and was cut there; write only from what is shown."
    : "This is EVERYTHING the reader has seen when they reach your quiz and cards.";
  return `\n\nCHAPTER PROSE — the reader-visible text of THIS chapter, already drafted. ${completeness}\n${passages.join("\n\n")}\n\nDERIVABLE FROM THE PROSE — every quiz stem, every choice, every explanation, and every review card must be answerable from the tiers above marked testable (HOOK, COUNTERINTUITION, FAST READ, DEEP READ, KEY TAKEAWAY) ALONE. FULL READ is context only: a name, date or figure appearing nowhere else is off-limits — a reader who stops after Deep must still answer. Cite only names, dates, numbers, and terms that appear in that prose; a term the prose never uses cannot be introduced on a card back, and a date or figure the prose never states cannot be reasoned about in a stem. If a fact is in the SOURCE PACKET below but not in the prose, it is NOT available to you here — teach what the reader was actually shown, or the question cannot be derived from the page (SEC120); the validator enforces this.${derivabilitySection(derivability)}`;
}

/**
 * Task 11ao — the COMPUTED lists. The rule above is a rule; this is the answer.
 *
 * The live Franklin canary burned three attempts on ch01 because the card showed the
 * prose, stated the rule, and left the writer to diff a 16-anchor packet against 2,632
 * characters of prose in its head — while a different block on the SAME card listed
 * "Peter Folger" | "1675" | "Sherburne town" as the strings q2 had to carry verbatim.
 * Two of those three were exactly what SEC120 then rejected. The diff is deterministic,
 * so the card does it (packetProseDerivability, through the gate's own predicate).
 *
 * Renders "" whenever the split is unavailable — which is exactly when SEC120 no-ops —
 * so a card without drafted prose stays byte-identical.
 */
function derivabilitySection(derivability?: ProseDerivability | null): string {
  if (!derivability?.available) return "";
  const blocks: string[] = [];
  if (derivability.derivable.length > 0) {
    blocks.push(`SPECIFICS THE PROSE SUPPORTS — computed from the prose above with the validator's own matcher (case, punctuation, digit separators and number words all folded), so this is not a judgement call. A specific whose figures the prose does not itself show is left off it — SEC120 also checks year figures, unconditionally. Build the quiz and the cards out of these:\n${renderProseSpecificList(derivability.derivable)}`);
  }
  if (derivability.notDerivable.length > 0) {
    blocks.push(`NOT DERIVABLE FROM THE PROSE — DO NOT USE. The SOURCE PACKET below carries every string here, but no testable tier above shows it, so a reader of THIS chapter cannot answer a stem, a choice, an explanation or a card that names one — naming it in a distractor counts too. SEC120 rejects any unit that cites the listed anchor and uses the string; the reader cannot answer it either way, so teach the same material through the supported list instead:\n${renderProseSpecificList(derivability.notDerivable)}`);
  }
  if (derivability.unprintedNames.length > 0) {
    blocks.push(`NAMES THE PROSE NEVER PRINTS — no validator checks these, and that is the point: a reader still cannot recognise a person, group or place this chapter never named. Refer to the case the way the prose does:\n${renderProseSpecificList(derivability.unprintedNames)}`);
  }
  if (derivability.standDownIds.size > 0) {
    blocks.push(`SEC120 STANDS DOWN for these cases, because the prose shows NONE of their specifics: ${renderProseStandDownIds(derivability.standDownIds)}. A slot dealt one of them may still use its SPECIFICS verbatim — the anchor-specifics gate compels one and nothing else would satisfy it — but only those strings are exempt: SEC120's year rule has NO stand-down, so a four-digit year the prose never states still blocks, even inside a stood-down case's own specific. The chapter's prose does not back this material, so keep such a unit's claim to what the prose does support.`);
  }
  if (blocks.length === 0) return "";
  return `\n\n${blocks.join("\n\n")}`;
}

// Task 11ao: a SEC120 rejection line. The compiler renders blockers as
// `checkId@path:message`, so the id is the reliable half; the message tail is matched
// too for any caller that passes bare messages.
const PROSE_DERIVABILITY_BLOCKER_RE = /SEC120\.learning_prose_derivable|appears? nowhere in this chapter's drafted prose/;

/**
 * Task 11ao — the SEC120 retry appendix. The blocker names the OFFENDING strings and
 * nothing else, so a writer that reads it as "delete these three words" produces a
 * fourth draft with a different underivable string. The canary did exactly that three
 * times. This restates the RULE the blocker enforces and hands back the ALLOWED
 * strings, computed from the same split the card's prose block renders.
 *
 * Fires only when a SEC120 line is actually present and the split is available, so
 * every other retry card stays byte-identical.
 */
function proseDerivabilityAppendix(blockerLines: readonly string[], derivability?: ProseDerivability | null): string {
  if (!derivability?.available) return "";
  if (!blockerLines.some((line) => PROSE_DERIVABILITY_BLOCKER_RE.test(line))) return "";
  const parts: string[] = [`DERIVABILITY RULE (SEC120) — what the blocker above enforces, stated once: every quiz stem, every choice, every explanation and every review card must be answerable from THIS chapter's drafted prose ALONE (HOOK, COUNTERINTUITION, FAST READ, DEEP READ, KEY TAKEAWAY; FULL READ does not count). Deleting the offending string is only half the fix — replace it with one the prose actually shows, or the next draft blocks on a different string.`];
  if (derivability.derivable.length > 0) {
    parts.push(`ALLOWED SPECIFICS — every string here IS on the page and may be used verbatim:\n${renderProseSpecificList(derivability.derivable)}`);
  }
  if (derivability.notDerivable.length > 0) {
    parts.push(`NOT DERIVABLE — DO NOT USE, in a key or in a distractor:\n${renderProseSpecificList(derivability.notDerivable)}`);
  }
  return `\n\n${parts.join("\n\n")}\n`;
}

function retryFeedbackSection(feedback?: SectionRetryFeedback, anchors: readonly SourcePacketV1["allowedAnchors"][number][] = [], derivability?: ProseDerivability | null): string {
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
  const derivabilityHelp = proseDerivabilityAppendix(feedback.blockerLines, derivability);
  return `\n\nPREVIOUS DRAFT REJECTED BY SECTION GATES — fix exactly these:\n${blockers}\n\nThese blockers come from the same deterministic gates that will re-validate your next draft. Resolve every listed blocker and change nothing else. Your rejected draft was:\n\`\`\`json\n${JSON.stringify(feedback.priorDraft, null, 2)}\n\`\`\`\n${enumeration}${inventory}${derivabilityHelp}`;
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
  //
  // R-055 (review round 2): chapterContext is stripped too. It is the RESEARCHER'S
  // PARAPHRASE — unquoted, and checked against the frozen text by no gate — and
  // this block's own header tells the writer everything in it is an allowed fact.
  // hardEdge is the sharpest case: rule 5 of researcher-chapter.system.md makes its
  // first move the tempting WRONG reading, so shipping it inside the citable block
  // hands the writer a falsehood labelled as source material. It is rendered
  // instead by chapterContextSection(), under a header that says what it is.
  //
  // R-046 (review round 2): a source-text packet carries a sourceQuote of up to
  // MAX_SOURCE_QUOTE_CHARS on every fact and every case. This card's length is
  // budget-pinned in absolute characters, so the quote is bounded here exactly as
  // the whole-chapter projection bounds it — same function, same limit.
  const writerPacket = {
    ...sourcePacket,
    coreMoveFactId: undefined,
    chapterContext: undefined,
    facts: sourcePacket.facts.map(({ teachingPriority: _tp, ...f }) => (
      typeof f.sourceQuote === "string" ? { ...f, sourceQuote: boundSourceQuoteForCard(f.sourceQuote) } : f
    )),
    // Guarded rather than defaulted: a packet with no namedCases key must keep
    // rendering without one (a `?? []` here would add "namedCases": [] to every
    // such card and move a budget that is pinned in absolute characters).
    ...(Array.isArray(sourcePacket.namedCases)
      ? { namedCases: sourcePacket.namedCases.map((c) => (typeof c.sourceQuote === "string" ? { ...c, sourceQuote: boundSourceQuoteForCard(c.sourceQuote) } : c)) }
      : {}),
  };
  // Task 11ao: ONE computed split per card, shared by the prose block, the quiz
  // preflight and the SEC120 retry appendix, so the three can never disagree with each
  // other or with the gate. Unavailable (and every block below renders "") wherever
  // SEC120 itself no-ops.
  const derivability = kind === "learning-pack" ? packetProseDerivability(sourcePacket, chapterProse) : null;

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
    // Task 11ao — MARK each required specific against the drafted prose. Unmarked,
    // this block is a standing instruction to use strings SEC120 rejects: the live
    // canary's ch01 card listed «"Peter Folger" | "1675" | "Sherburne town"» for q2
    // and the gate then blocked two of the three, three attempts running.
    //
    // Review round 3 (MINOR 1): marked with the SAME classifier the ALLOWED list uses
    // (classifyProseSpecific), not with rule 1 alone. Marking with rule 1 while the
    // list additionally applied offerableAsDerivable made one card contradict itself —
    // a digit-bearing specific matched only by the qualified-name/clipped-phrase
    // folding was marked "[on the page]" here and silently absent from
    // "SPECIFICS THE PROSE SUPPORTS" below. The third mark names that case instead.
    const MARKS: Record<ProseSpecificMark, string> = {
      "on-page": " [on the page]",
      folded: " [on the page by folding — not offered]",
      "off-page": " [NOT ON THE PAGE]",
    };
    const mark = (specific: string): string => (derivability?.available
      ? MARKS[classifyProseSpecific(specific, derivability.normalizedProse)]
      : "");
    const caseLines = [...citedCases.entries()].map(([id, specs]) => `- ${id}: ${specs.map((x) => `"${x}"${mark(x)}`).join(" | ")}`);
    const derivabilityNote = derivability?.available
      ? `\nMarked against the CHAPTER PROSE below. [NOT ON THE PAGE] is rejected by SEC120 even though this block requires a verbatim specific; [on the page by folding — not offered] passes rule 1 but carries a figure this card cannot check; prefer [on the page]. With ALL of a case's specifics [NOT ON THE PAGE] SEC120 stands down — use one AS A STRING only: its year rule has NO stand-down, so an off-page four-digit year still blocks.`
      : "";
    return `\n\nREQUIRED VERBATIM SPECIFICS BY QUIZ SLOT (SEC56 checks the PROMPT and the EXPLANATION separately: each citing question weaves at least 1 of its case's specifics into the prompt AND at least 1 into the explanation; matching is case-insensitive and folds an in-order rendering, so naturalize each one):\n${caseLines.join("\n")}\nSlots: ${slotLines.join("  ")}${derivabilityNote}`;
  })();
  if (deliveryMode === "DIRECT_JSON") {
    const shapeRules = directJsonShapeRules(kind);
    return `ROLE\nYou are the ${ROLE_NAME[kind]} for ChapterFlow v23. You have one bounded artifact to produce.\n\nINPUTS\n- bookId: ${bookId}\n- chapterId: ${blueprint.chapterId}\n- chapterNumber: ${blueprint.chapterNumber}\n- chapterTitle: ${blueprint.title}\n\nTASK\n${sectionContract(kind)}${bookScarsSection(context.bookScars, blueprint.chapterNumber)}${voiceCardSection(kind, context.voiceCard)}\n\nDELIVERY\n- Do not use tools, shell commands, filesystem access, or network access.\n- Do not read or write files.\n- Final response must be exactly one JSON object matching the schema hint.\n- Return no prose and no Markdown fence.\n- Your draft is validated externally by deterministic section gates; you cannot run them here. A rejection comes back to you as its precise blockers, which you resolve while changing nothing else.${shapeRules ? `\n${shapeRules}` : ""}\n\nDO NOT\n${sectionDoNotLines(outputPath).slice(1).join("\n")}\n\nOUTPUT SCHEMA HINT\n\`\`\`json\n${sectionSchemaHint(kind, deliveryMode)}\n\`\`\`\n\nSECTION BLUEPRINT — the slots and dealt variety for THIS section\n\`\`\`json\n${JSON.stringify(sectionInput, null, 2)}\n\`\`\`${quizSpecificsPreflight}${chapterProseSection(kind, chapterProse, derivability)}${chapterContextSection(sourcePacket.chapterContext)}\n\nSOURCE PACKET — ONLY allowed facts/cases/numbers/entities\n\`\`\`json\n${JSON.stringify(writerPacket, null, 2)}\n\`\`\`\n${retryFeedbackSection(retryFeedback, sourcePacket.allowedAnchors, derivability)}${assemblyAvoidSection(assemblyAvoid)}`;
  }
  return `ROLE\nYou are the ${ROLE_NAME[kind]} for ChapterFlow v23. You have one bounded artifact to produce.\n\nINPUTS\n- bookId: ${bookId}\n- chapterId: ${blueprint.chapterId}\n- chapterNumber: ${blueprint.chapterNumber}\n- chapterTitle: ${blueprint.title}\n- outputPath: ${outputPath}\n\nTASK\n${sectionContract(kind)}${bookScarsSection(context.bookScars, blueprint.chapterNumber)}${voiceCardSection(kind, context.voiceCard)}\n\nDO NOT\n${sectionDoNotLines(outputPath).join("\n")}\n\nOUTPUT SCHEMA HINT\n\`\`\`json\n${sectionSchemaHint(kind)}\n\`\`\`\n\nSECTION BLUEPRINT — the slots and dealt variety for THIS section\n\`\`\`json\n${JSON.stringify(sectionInput, null, 2)}\n\`\`\`${quizSpecificsPreflight}${chapterProseSection(kind, chapterProse, derivability)}${chapterContextSection(sourcePacket.chapterContext)}\n\nSOURCE PACKET — ONLY allowed facts/cases/numbers/entities\n\`\`\`json\n${JSON.stringify(writerPacket, null, 2)}\n\`\`\`\n\nVALIDATION\nYour draft is validated externally by deterministic section gates — you cannot run the validator yourself here. If a gate rejects the draft, its precise blockers come back to you as exact fixes; resolve every listed blocker and change nothing else.\n${retryFeedbackSection(retryFeedback, sourcePacket.allowedAnchors, derivability)}${assemblyAvoidSection(assemblyAvoid)}`;
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
