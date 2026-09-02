import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { compileSourcePacketFromSidecar, tagBookWideDuplicateFacts } from "../src/compiler/sourcePacket.js";
import { compiledFactsFromSidecar, REQUIRED_QUIZ_FACT_FLOOR } from "../src/compiler/sourcePacketFacts.js";
import { validateSourcePacket } from "../src/compiler/sourcePacketGate.js";
import { canonicalJsonSha256 } from "../src/lib/canonicalJson.js";
import { assertFactIdsSubset, compileChapterBlueprint } from "../src/compiler/chapterBlueprint.js";
import { validateBlueprint } from "../src/compiler/blueprintGate.js";
import { checkSectionGate, validateActionPack, validateExamplePack, validateLearningPack, validateSectionPack, validateSummaryPack } from "../src/sections/sectionGate.js";
import { buildEvidenceMap } from "../src/evidence/evidenceMap.js";
import { validateEvidenceMap } from "../src/evidence/evidenceGate.js";
import { scoreChapterRisk } from "../src/risk/chapterRisk.js";
import { assembleChapterV21OrThrow } from "../src/assembler.js";
import { buildSectionTaskMarkdown } from "../src/sections/sectionTasks.js";
import { CHAPTER_PROSE_CARD_CAPS, clampProsePassage } from "../src/sections/chapterProse.js";
import { memorableLineScore, selectMemorableLinesDeterministic } from "../src/optimizers/memorableLines.js";
import { countSyllables } from "../src/critics/readingLevel.js";
import { C7_BANNED_NAMES } from "../src/critics/finalGate.js";
import { checkNoEmDash } from "../src/critics/register.js";
import type { ChapterSpec } from "../src/generateChapter.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";
import { blueprintPath, sectionPath, sourcePacketPath, writeJsonFile } from "../src/artifacts/artifactStore.js";
import type { ActionPackV1, ExamplePackV1, LearningPackV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";

function long(words: string, times: number): string {
  return Array.from({ length: times }, () => words).join(" ");
}

function sidecar(): SourceSidecarV2 {
  const facts = Array.from({ length: 9 }, (_, i) => ({
    id: `ch01.fact.${i + 1}`,
    claim: `Credit utilization signal ${i + 1} changes lender-visible risk before a bill is fully paid.`,
    becauseMechanism: `Because balances can be reported before payment, a lower visible balance gives the scoring model cleaner information ${i + 1}.`,
    commonError: `Assuming only the due date matters ${i + 1}.`,
    errorIsWhy: `The reporting snapshot can matter before the due date ${i + 1}.`,
  }));
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Optimize Your Credit Cards",
    centralConcept: { id: "ch01.concept.credit", name: "Credit card optimization", plainDefinition: "Small payment and utilization choices change what lenders see.", whyItMatters: "The reader can improve the signal without pretending money is magic." },
    keyClaims: facts.map((f) => f.claim),
    namedExamples: [
      { id: "ch01.case.fico", label: "FICO score range", summary: "FICO scores are commonly discussed on a 300 to 850 scale when explaining credit behavior.", teachesWhat: "Credit behavior becomes a lender-facing signal.", hardSpecifics: ["300 to 850 scale", "credit utilization"], realWorld: true },
      { id: "ch01.case.cfpb", label: "Consumer Financial Protection Bureau credit reports", summary: "The CFPB explains that credit reports collect account and payment information used by lenders.", teachesWhat: "A report is an input, not a moral judgment.", hardSpecifics: ["credit reports", "lenders use account information"], realWorld: true },
    ],
    hardEdge: "Do not promise an exact score increase.",
    paraphraseNotes: "Keep numbers limited to the verified 300 to 850 score range and the source-local credit utilization mechanism.",
    testableFacts: facts,
    frameworks: [{ name: "Three-part credit signal", members: ["payment history", "utilization", "account age"] }],
  };
}

function chapter(): ChapterSpec {
  return { chapterId: "money-book-ch01", chapterNumber: 1, chapterTitle: "Optimize Your Credit Cards" };
}

function compileFixture() {
  const packet = compileSourcePacketFromSidecar({ bookId: "money-book", chapter: chapter(), sidecar: sidecar(), sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId: "money-book", chapter: chapter(), packet, packetPath: "/tmp/ch01.source-packet.json" });
  const aid = packet.allowedAnchors[0].id;
  const quizAid = packet.allowedAnchors.find((a) => a.id.includes(".fact.") && a.supportsClaimTypes.includes("quiz_prompt") && a.supportsClaimTypes.includes("quiz_key_evidence"))?.id ?? aid;
  const exampleAid = packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("example"))?.id ?? aid;
  const fids = packet.facts.map((f) => f.id);
  const quizExplanations = [
    "The right move lowers the visible balance before the signal travels; the other options rely on intention or extra accounts.",
    "The keyed choice changes what a lender-facing report can show, while the distractors leave the noisy balance untouched.",
    "The correct response works at the reporting input itself; hoping or adding complexity does not clean up the snapshot.",
    "The useful answer names a concrete balance action, not a feeling about being careful with the account.",
    "The key follows the mechanism by changing reported utilization; the wrong options dodge that mechanism.",
    "The best choice makes the account information cleaner before it is read, instead of trusting later interpretation.",
    "The answer is the option that acts on the visible number; the alternatives are delays or distractions.",
    "The chapter logic points to the reported balance, so the correct choice changes that signal directly.",
    "The keyed action is useful because it changes the system input; the distractors change comfort, not evidence.",
  ];
  const quizChoiceRows = [
    ["Lower the visible balance before the snapshot", "Leave the balance until the snapshot passes", "Open another card before checking utilization"],
    ["Pay before the reportable balance is read", "Trust repayment intent after the report", "Move the reminder after the due date"],
    ["Inspect utilization while it can change", "Track reward points while payment waits", "Ask the lender to infer careful habits"],
    ["Make the account signal cleaner now", "Add another account for more variety", "Trust payment history before checking"],
    ["Reduce the balance the system sees", "Keep extra cash idle for comfort", "Delay review until the bill arrives"],
    ["Set an alert before balance reporting", "Wait for the statement before acting", "Focus on card color and rewards"],
    ["Change the number lenders may read", "Assume intent will look obvious", "Describe a higher credit limit story"],
    ["Check the report-facing account data", "Treat the due date as sufficient", "Compare unrelated card perks first"],
    ["Act on utilization before it travels", "Hope later context repairs the signal", "Open a new budget spreadsheet tab"],
  ];
  const quizPrompts = [
    "Maya wants the next credit snapshot to look less risky. Which action changes the visible signal?",
    "A borrower pays on time but carries a high reportable balance. What move fits the mechanism?",
    "The account page shows utilization before payday. Which response acts while the signal can still change?",
    "A reader wants the system to see cleaner account information. Which option does that directly?",
    "The balance may be reported before the due date. What should the reader inspect first?",
    "A careful cardholder keeps missing the reporting moment. Which small setup best supports the habit?",
    "The lender will later read account data, not intent. Which choice changes the evidence?",
    "A card user is comparing payment timing and perks. Which detail belongs at the center?",
    "The reader has one minute before closing the app. Which action follows the credit-signal idea?",
  ];
  const summary: SummaryPackV1 = {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: blueprint.chapterId,
    hook: { hook: "Maya opens her card app before payday and sees the balance that a lender might see first.", sourceAnchorIds: [aid], counterintuition: "Paying on time is necessary, but the visible balance can still make a careful borrower look riskier than their actual behavior.", counterintuitionSourceAnchorIds: [aid] },
    breakdown: {
      // Written to the P02 rubric-aligned readability spec: plain, short sentences so
      // each tier clears its FK ceiling AND the assembled breakdown reads at Flesch
      // ease ≥70 (the new SEC12 whole-breakdown floor). Distinct memorable candidates
      // are seeded across tiers for the ≥3 memorable-line requirement.
      fastRead: long("Pay before the snapshot. A lower balance can make a careful borrower look careful. Make the signal match the care you already show.", 25),
      deepRead: long("A card keeps a record of what you owe. It does not read your plan. The system reads what you owe, not what you mean to do. So lower what the card shows before it goes to a lender.", 45),
      fullRead: long("The move here is simple to start. Look at your own balance first. Bring down what you owe when you can. Small early payments change the story your card tells. Set a nudge before the day the balance is read. What a lender sees matters more than what you plan. This keeps the main idea true without a promise of an exact jump in your score.", 70),
      sourceAnchorIds: { fastRead: [aid], deepRead: [aid], fullRead: [aid] },
    },
    keyTakeaway: "Treat credit behavior as a visible signal: the useful move is to change what the system can see, not to hope your intention will be understood.",
    keyTakeawaySourceAnchorIds: [aid],
    tryThisNow: "Open one credit account and write down the balance that would be visible if the snapshot happened today.",
    tryThisNowSourceAnchorIds: [aid],
    sourceFactIds: fids.slice(0, 3),
  };
  const examples: ExamplePackV1 = {
    schemaVersion: "section-artifact-v1",
    artifactType: "example-pack",
    chapterId: blueprint.chapterId,
    examples: blueprint.sections.examples.map((slot, i) => {
      const titles = ["Visible Balance Choice", "Snapshot Payment Plan", "Utilization Recovery", "Report Signal Contrast", "Cash Plan Tradeoff", "Next Statement Check"];
      const scenarios = [
        "{name} stands at the kitchen table with the card app open and chooses whether to pay a small amount before the balance becomes visible. The decision is concrete: leave the high utilization signal alone, or make the balance match the careful behavior {name} already has.",
        "Before a shift change, {name} checks the account page and notices that the number a lender could see is higher than expected. The choice is practical: wait for payday pride, or move enough cash now to lower the visible credit utilization signal.",
        "{name} pauses in a library study room after seeing the statement date and the payment date pull in different directions. The decision is specific: treat the due date as the only event, or reduce the balance before account information travels.",
        "At a quiet branch kiosk, {name} compares a planned purchase with the balance that may be reported first. The tradeoff is visible: buy now and carry the noisy utilization number, or delay the purchase until the account signal is cleaner.",
        "{name} reviews a grocery receipt in the parking lot and realizes the cash plan still has room for a small payment. The recovery move is modest: use that room to clean the lender-facing balance instead of spending it because the bill is not due.",
        "During a Sunday budget check, {name} sees that autopay will arrive after the possible reporting moment. The repair is concrete: set a pre-snapshot alert and decide whether a small early payment makes the next visible number less misleading.",
      ];
      const protagonist = slot.allowedNames[0] ?? blueprint.reservedVariety.allowedNames[i % blueprint.reservedVariety.allowedNames.length] ?? "Maya";
      const caseId = slot.requiredCaseIds[0] ?? exampleAid;
      const caseAnchor = packet.allowedAnchors.find((a) => a.id === caseId);
      const hardSpecifics = caseAnchor?.hardSpecifics?.slice(0, 2).join(" and ") ?? "credit reports and lenders use account information";
      return {
        exampleId: `ex${String(i + 1).padStart(2, "0")}`,
        slotId: slot.slotId,
        title: titles[i],
        scenario: scenarios[i].replaceAll("{name}", protagonist),
        whatToDo: "Open the account, identify the visible balance, and choose the smallest payment that changes the signal without breaking your cash plan.",
        whyItMatters: `The action works because credit behavior is read as account information, so a smaller visible balance can change what the system has to interpret. This example stays tied to ${hardSpecifics}.`,
        sourceAnchorIds: [caseId],
        sourceFactIds: [slot.requiredFactIds[0] ?? fids[0]],
        namedCaseIds: [caseId],
      };
    }),
  };
  const learning: LearningPackV1 = {
    schemaVersion: "section-artifact-v1",
    artifactType: "learning-pack",
    chapterId: blueprint.chapterId,
    quiz: {
      passingScorePercent: 70,
      questions: blueprint.sections.quiz.map((q, i) => ({
        questionId: q.questionId,
        sourceAnchorIds: [quizAid],
        keyEvidenceAnchorIds: [quizAid],
        prompt: quizPrompts[i],
        choices: (() => {
          const row = quizChoiceRows[i];
          const choices = ["", "", ""];
          choices[q.correctIndex] = row[0];
          choices[(q.correctIndex + 1) % 3] = row[1];
          choices[(q.correctIndex + 2) % 3] = row[2];
          return choices;
        })(),
        correctIndex: q.correctIndex,
        explanation: quizExplanations[i],
        bloomsLevel: "apply",
        depthLevel: q.depthLevel,
      })),
    },
    cards: {
      cards: blueprint.sections.cards.map((c) => ({ cardId: c.cardId, sourceAnchorIds: [aid], front: `What credit-card signal should you inspect before a snapshot ${c.cardId}?`, back: "Inspect the balance or utilization that would be visible to the reporting system, because that is the account information lenders can later read.", difficulty: c.difficulty })),
    },
  };
  const action: ActionPackV1 = {
    schemaVersion: "section-artifact-v1",
    artifactType: "action-pack",
    chapterId: blueprint.chapterId,
    tryThisNow: "Open one card account, find the balance that would be visible today, and choose one payment or alert that makes the next snapshot less noisy.",
    tryThisNowSourceAnchorIds: [aid],
    implementationPlan: {
      title: "Lower The Visible Balance",
      titleSourceAnchorIds: [aid],
      coreSkill: "Use the account view as an early signal check so the number a lender sees is closer to your actual repayment behavior, not merely your intention.",
      coreSkillSourceAnchorIds: [aid],
      ifThenPlans: [0, 1, 2].map((i) => ({ context: `Before payment cycle ${i + 1}`, plan: "If the visible balance is higher than the signal you want to send, then make the smallest useful payment or set a reminder before the snapshot.", sourceAnchorIds: [aid] })),
      twentyFourHourChallenge: "Within twenty-four hours, check one account and set one alert before the next balance snapshot.",
      twentyFourHourChallengeSourceAnchorIds: [aid],
      weeklyPractice: "Once a week, check the visible balance and decide whether a small payment or reminder would make the signal cleaner.",
      weeklyPracticeSourceAnchorIds: [aid],
    },
  };
  return { packet, blueprint, summary, examples, learning, action };
}

function cloneLearning(pack: LearningPackV1): LearningPackV1 {
  return JSON.parse(JSON.stringify(pack)) as LearningPackV1;
}

function cloneSummary(pack: SummaryPackV1): SummaryPackV1 {
  return JSON.parse(JSON.stringify(pack)) as SummaryPackV1;
}

function cloneExamples(pack: ExamplePackV1): ExamplePackV1 {
  return JSON.parse(JSON.stringify(pack)) as ExamplePackV1;
}

function cloneAction(pack: ActionPackV1): ActionPackV1 {
  return JSON.parse(JSON.stringify(pack)) as ActionPackV1;
}

import { extractNamesFromText } from "../src/librarian/libraryState.js";

test("SEC35 name extraction: interjection sentence-openers are never protagonist names (live Bennett wedge)", () => {
  // "Well, the ledger says otherwise." wedged the Bennett example-pack three
  // attempts running: "Well" flagged as an undealt protagonist. Same family as
  // the temporal-adverb and conjunct-adverb batches before it.
  const scenario = "Well, the ledger says otherwise. Now the clerk counts again. Suddenly the total matches. Meanwhile Priya checks the drawer.";
  const names = extractNamesFromText(scenario);
  for (const notAName of ["Well", "Now", "Suddenly", "Meanwhile"]) {
    assert.ok(!names.includes(notAName), `interjection "${notAName}" must not extract as a name`);
  }
  assert.ok(names.includes("Priya"), "real dealt names still extract");
});

test("v23 section task prompts warn learning and summary writers about cross-chapter similarity gates", () => {
  const fx = compileFixture();
  const learningTask = buildSectionTaskMarkdown({
    bookId: "money-book",
    kind: "learning-pack",
    blueprint: fx.blueprint,
    sourcePacket: fx.packet,
    outputPath: "/tmp/learning-pack.json",
    context: { voiceCard: null, bookScars: null },
  });
  // P07: the contract is now a layered brief — the cross-chapter gate awareness is
  // preserved as DESIGN-AROUND rules (each names its check id), so these assert the new
  // phrasing rather than the pre-P07 blocklist wording.
  assert.match(learningTask, /SEC81 compares review cards across the book/);
  assert.match(learningTask, /requiredFactIds/);
  assert.match(learningTask, /What should you inspect \/ What check does/);
  assert.match(learningTask, /AS5\/AS12 compare q01-to-q01/);
  assert.match(learningTask, /AS6 compares correct answers and distractors/);
  assert.match(learningTask, /promptShape, answerStyle, distractorTrap, and caseCueIds/);
  assert.match(learningTask, /caseCueIds/);
  assert.match(learningTask, /bloomsLevel/);
  assert.match(learningTask, /depthLevel/);
  assert.match(learningTask, /frontShape, retrievalTarget, and backShape/);
  assert.match(learningTask, /must not retrieve a source-grounding requirement/);
  // Every design-around line names its enforcing validator.
  assert.match(learningTask, /the validator enforces this/);

  const summaryTask = buildSectionTaskMarkdown({
    bookId: "money-book",
    kind: "summary-pack",
    blueprint: fx.blueprint,
    sourcePacket: fx.packet,
    outputPath: "/tmp/summary-pack.json",
    context: { voiceCard: null, bookScars: null },
  });
  assert.match(summaryTask, /chapter-specific skeleton/);
  assert.match(summaryTask, /reusable five-word connective run/);
  assert.match(summaryTask, /AS10\/AS11 compare fastRead, deepRead, and fullRead/);

  const exampleTask = buildSectionTaskMarkdown({
    bookId: "money-book",
    kind: "example-pack",
    blueprint: fx.blueprint,
    sourcePacket: fx.packet,
    outputPath: "/tmp/example-pack.json",
    context: { voiceCard: null, bookScars: null },
  });
  assert.match(exampleTask, /sceneFrame\/requiredBeat/);
  assert.match(exampleTask, /six DIFFERENT scene engines/);

  const actionTask = buildSectionTaskMarkdown({
    bookId: "money-book",
    kind: "action-pack",
    blueprint: fx.blueprint,
    sourcePacket: fx.packet,
    outputPath: "/tmp/action-pack.json",
    context: { voiceCard: null, bookScars: null },
  });
  assert.match(actionTask, /AS8 compares implementationPlan fields across chapters/);
  assert.match(actionTask, /action\.ifThenPlanShapes\[\]/);
  assert.match(actionTask, /action\.practiceForm/);
  assert.match(actionTask, /action\.practiceConstraint/);
  assert.match(actionTask, /classify\/choose\/predict worksheet/);
  // A non-scar book (money-book) must NOT inherit another book's scar tissue.
  assert.doesNotMatch(actionTask, /transition, milestone, or pit/);
});

// ── Task 11ai — the quiz/cards must be derivable from THIS chapter's own prose ──
// Finding 45: each section pack is drafted independently from the same SOURCE PACKET,
// so the learning writer saw every allowed fact/anchor — not the SUBSET the summary
// writer actually put into the reader-visible prose. The blind reader panel failed all
// four canary chapters on one class: quiz stems and cards naming facts ("Dr. Thomas
// Bond", "1751", "Temperance") that appear nowhere in the Fast/Deep/Full read. The fix
// is two-sided — the writer SEES the drafted prose (Part A) and a deterministic gate
// backstops it (Part B, SEC120).

/** Render a learning-pack card with (or without) this chapter's drafted prose. */
function renderLearningTask(
  fx: ReturnType<typeof compileFixture>,
  chapterProse?: SummaryPackV1,
  deliveryMode?: "FILE_WRITE" | "DIRECT_JSON",
): string {
  return buildSectionTaskMarkdown({
    bookId: "money-book",
    kind: "learning-pack",
    blueprint: fx.blueprint,
    sourcePacket: fx.packet,
    outputPath: "/tmp/learning-pack.json",
    context: { voiceCard: null, bookScars: null },
    deliveryMode,
    chapterProse,
  });
}

test("learning-pack task card carries THIS chapter's drafted prose and the derivable-from-prose rule (Task 11ai)", () => {
  const fx = compileFixture();
  const bare = renderLearningTask(fx);
  const withProse = renderLearningTask(fx, fx.summary);

  // Absent prose = today's card, unchanged (every existing task-card test stays green).
  assert.doesNotMatch(bare, /CHAPTER PROSE/, "no prose supplied → no prose block");

  assert.match(withProse, /CHAPTER PROSE/, "the drafted prose block must be rendered");
  // Each drafted passage reaches the card, clamped to its documented cap (Task 11ai
  // review, minor a — this fixture's tiers are synthetic repeats far past any aim
  // band, so they exercise the clamp; the hook and keyTakeaway are under their caps
  // and must render verbatim).
  for (const [key, passage] of [
    ["hook", fx.summary.hook.hook],
    ["counterintuition", fx.summary.hook.counterintuition],
    ["fastRead", fx.summary.breakdown.fastRead],
    ["deepRead", fx.summary.breakdown.deepRead],
    ["fullRead", fx.summary.breakdown.fullRead],
    ["keyTakeaway", fx.summary.keyTakeaway],
  ] as const) {
    assert.ok(passage, "fixture summary must supply every reader-visible passage");
    const rendered = clampProsePassage(passage!, CHAPTER_PROSE_CARD_CAPS[key]);
    assert.ok(withProse.includes(rendered), `prose block must carry the drafted passage: ${passage!.slice(0, 40)}…`);
  }
  assert.ok(withProse.includes(fx.summary.hook.hook!), "a passage inside its cap is carried verbatim");
  assert.ok(withProse.includes(fx.summary.keyTakeaway!), "a passage inside its cap is carried verbatim");
  // The rule: derivable from the prose alone, and a packet fact absent from the prose
  // is simply unavailable.
  assert.match(withProse, /every quiz stem[\s\S]{0,200}review card must be answerable from the tiers above marked testable/);
  assert.match(withProse, /not in the prose, it is NOT available/);
  assert.match(withProse, /SEC120/, "the rule names its enforcing validator");

  // The block is learning-pack-only: the other three renders are byte-identical with
  // and without the field.
  for (const kind of ["summary-pack", "example-pack", "action-pack"] as const) {
    const args = { bookId: "money-book", kind, blueprint: fx.blueprint, sourcePacket: fx.packet, outputPath: `/tmp/${kind}.json`, context: { voiceCard: null, bookScars: null } };
    assert.equal(
      buildSectionTaskMarkdown({ ...args, chapterProse: fx.summary }),
      buildSectionTaskMarkdown(args),
      `${kind}: chapter prose is a learning-pack input only`,
    );
  }
  // The live compiler drafts through DIRECT_JSON — the block must reach that card too.
  assert.match(renderLearningTask(fx, fx.summary, "DIRECT_JSON"), /CHAPTER PROSE/);
});

test("SEC120 blocks a quiz stem whose cited specific never appears in the chapter's drafted prose (Task 11ai)", () => {
  const fx = compileFixture();
  const anchor = fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("quiz_prompt") && (a.hardSpecifics ?? []).length > 0);
  assert.ok(anchor, "fixture needs a specifics-rich quiz-capable anchor");
  const specific = anchor!.hardSpecifics![0];
  assert.equal(fx.summary.breakdown.fullRead.includes(specific), false, "fixture prose must not already name the specific");
  // Task 11an: the anchor must be SATISFIABLE — at least one of its specifics on
  // the standalone page — or SEC58 would compel exactly what SEC120 forbids and
  // the pair would be unsatisfiable (SEC120 now stands down in that case, by
  // design). Put a DIFFERENT specific on the page so reaching past it is a real
  // choice the writer made, which is what this test is about.
  const onPage = (anchor!.hardSpecifics ?? []).find((x) => x !== specific) ?? specific;
  const prose = {
    ...fx.summary,
    breakdown: { ...fx.summary.breakdown, deepRead: `${fx.summary.breakdown.deepRead} The deep read states ${onPage} outright.` },
  };

  const bad = cloneLearning(fx.learning);
  const q = bad.quiz.questions[0];
  q.sourceAnchorIds = [anchor!.id];
  q.keyEvidenceAnchorIds = [anchor!.id];
  q.prompt = `A reader checks the ${specific} recorded in 1751 before the next snapshot. Which move changes what a lender can read?`;
  q.explanation = `The keyed move changes the ${specific} the report shows, while the other options leave it untouched.`;

  // No prose supplied (legacy/other callers) → the check MUST no-op.
  const legacy = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.deepEqual(legacy.filter((f) => f.checkId.startsWith("SEC120")), [], "absent prose must no-op, never fire");

  const hits = validateLearningPack(bad, fx.blueprint, fx.packet, prose).filter((f) => f.checkId === "SEC120.learning_prose_derivable");
  assert.equal(hits.length, 1, hits.map((f) => f.message).join("\n"));
  assert.equal(hits[0].severity, "blocker", "SEC120 is a blocker, like its SEC55–SEC58 learning-family siblings");
  assert.equal(hits[0].section, "learning-pack");
  assert.equal(hits[0].path, "/quiz/questions/0");
  assert.match(hits[0].message, new RegExp(specific.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the blocker names the offending specific");
  assert.match(hits[0].message, /1751/, "a 4-digit year absent from the prose is flagged too");

  // Zero false positive: prose that actually shows the specific and the year clears it.
  const grounded = cloneSummary(fx.summary);
  grounded.breakdown.deepRead = `${grounded.breakdown.deepRead} The ${specific} written down in 1751 is the number a lender reads first.`;
  assert.deepEqual(
    validateLearningPack(bad, fx.blueprint, fx.packet, grounded).filter((f) => f.checkId === "SEC120.learning_prose_derivable"),
    [],
    "a specific the prose actually shows must never fire",
  );

  // Number-word folding (Franklin pincer): SEC56 and a book-scar FACT PIN can
  // force "thirteen virtues" verbatim into the quiz while the independently
  // drafted prose writes "13 virtues" — the same fact in different notation.
  // Without folding, SEC120 and SEC56 are jointly unsatisfiable and the pack
  // blocks on every draft. Both sides run through one normalizer, so word and
  // digit forms must be interchangeable IN EITHER DIRECTION.
  const wordQuiz = cloneLearning(fx.learning);
  const wq = wordQuiz.quiz.questions[0];
  wq.sourceAnchorIds = [anchor!.id];
  wq.keyEvidenceAnchorIds = [anchor!.id];
  wq.prompt = `The plan names thirteen virtues tracked beside the ${specific}. Which move changes what a lender can read?`;
  wq.explanation = `Thirteen virtues, one per week, and the ${specific} stay visible either way.`;
  const digitProse = cloneSummary(fx.summary);
  digitProse.breakdown.deepRead = `${digitProse.breakdown.deepRead} The plan names 13 virtues, and the ${specific} written down in 1751 sits beside them.`;
  assert.deepEqual(
    validateLearningPack(wordQuiz, fx.blueprint, fx.packet, digitProse).filter((f) => f.checkId === "SEC120.learning_prose_derivable"),
    [],
    "'thirteen' in the quiz must match '13' in the prose",
  );
  const digitQuiz = cloneLearning(fx.learning);
  const dq = digitQuiz.quiz.questions[0];
  dq.sourceAnchorIds = [anchor!.id];
  dq.keyEvidenceAnchorIds = [anchor!.id];
  dq.prompt = `The plan names 13 virtues tracked beside the ${specific}. Which move changes what a lender can read?`;
  dq.explanation = `13 virtues, one per week, and the ${specific} stay visible either way.`;
  const wordProse = cloneSummary(fx.summary);
  wordProse.breakdown.deepRead = `${wordProse.breakdown.deepRead} The plan names thirteen virtues, and the ${specific} written down in 1751 sits beside them.`;
  assert.deepEqual(
    validateLearningPack(digitQuiz, fx.blueprint, fx.packet, wordProse).filter((f) => f.checkId === "SEC120.learning_prose_derivable"),
    [],
    "'13' in the quiz must match 'thirteen' in the prose",
  );

  // Qualified-name folding (Franklin pincer, live round 18): the sidecar's formal
  // "Library Company of Philadelphia" is forced verbatim into the unit by SEC58
  // while the readability-pressured prose writes "the Library Company" — a reader
  // who saw the head name AND the qualifier on the page can derive the qualified
  // form, so both halves present must clear, and a missing half must still block.
  const qualifiedQuiz = cloneLearning(fx.learning);
  const qq = qualifiedQuiz.quiz.questions[0];
  qq.sourceAnchorIds = [anchor!.id];
  qq.keyEvidenceAnchorIds = [anchor!.id];
  qq.prompt = `The Library Company of Philadelphia tracked the ${specific}. Which move changes what a lender can read?`;
  qq.explanation = `The Library Company of Philadelphia keeps the ${specific} visible either way.`;
  const anchorWithQualified = { ...anchor!, hardSpecifics: [...(anchor!.hardSpecifics ?? []), "Library Company of Philadelphia"] };
  const qualifiedPacket = { ...fx.packet, allowedAnchors: fx.packet.allowedAnchors.map((a) => (a.id === anchor!.id ? anchorWithQualified : a)) };
  const splitProse = cloneSummary(fx.summary);
  splitProse.breakdown.deepRead = `${splitProse.breakdown.deepRead} In Philadelphia fifty subscribers built the Library Company, and the ${specific} written down in 1751 sat in its ledger.`;
  assert.deepEqual(
    validateLearningPack(qualifiedQuiz, fx.blueprint, qualifiedPacket, splitProse).filter((f) => f.checkId === "SEC120.learning_prose_derivable"),
    [],
    "'Library Company of Philadelphia' must be derivable from prose showing 'Library Company' and 'Philadelphia' separately",
  );
  const headOnlyProse = cloneSummary(fx.summary);
  headOnlyProse.breakdown.deepRead = `${headOnlyProse.breakdown.deepRead} Fifty subscribers built the Library Company, and the ${specific} written down in 1751 sat in its ledger.`;
  const headOnlyHits = validateLearningPack(qualifiedQuiz, fx.blueprint, qualifiedPacket, headOnlyProse).filter((f) => f.checkId === "SEC120.learning_prose_derivable");
  assert.equal(headOnlyHits.length, 1, "the qualifier half missing from prose must still block");
  assert.match(headOnlyHits[0].message, /Library Company of Philadelphia/, "the blocker names the underivable qualified specific");

  // Clipped-phrase folding (Franklin pincer, live round 22): sidecar
  // hardSpecifics are telegraphic ("slipped under door") while the
  // naturalize-into-sentences scar rule makes the prose write them out
  // ("slipped his essays under the printing-house door"), and SEC58 forces the
  // clipped form verbatim into the unit. In-order tokens within one local span
  // are derivable; the same words scattered across distant sentences are not.
  const clippedQuiz = cloneLearning(fx.learning);
  const cq = clippedQuiz.quiz.questions[0];
  cq.sourceAnchorIds = [anchor!.id];
  cq.keyEvidenceAnchorIds = [anchor!.id];
  cq.prompt = `The essays slipped under door overnight sat beside the ${specific}. Which move changes what a lender can read?`;
  cq.explanation = `The slipped under door delivery and the ${specific} stay visible either way.`;
  const anchorWithClipped = { ...anchor!, hardSpecifics: [...(anchor!.hardSpecifics ?? []), "slipped under door"] };
  const clippedPacket = { ...fx.packet, allowedAnchors: fx.packet.allowedAnchors.map((a) => (a.id === anchor!.id ? anchorWithClipped : a)) };
  const naturalizedProse = cloneSummary(fx.summary);
  naturalizedProse.breakdown.deepRead = `${naturalizedProse.breakdown.deepRead} He slipped his unsigned essays under the printing-house door at night, and the ${specific} written down in 1751 sat in the same drawer.`;
  assert.deepEqual(
    validateLearningPack(clippedQuiz, fx.blueprint, clippedPacket, naturalizedProse).filter((f) => f.checkId === "SEC120.learning_prose_derivable"),
    [],
    "'slipped under door' must be derivable from prose writing the phrase out naturally in one sentence",
  );
  const scatteredProse = cloneSummary(fx.summary);
  scatteredProse.breakdown.deepRead = `${scatteredProse.breakdown.deepRead} He slipped once on the icy step outside. Years later a debt was worked off day by day, entry by entry, line by line, page by page, season by season, ledger by ledger, and the record finally passed under the shop door, and the ${specific} written down in 1751 sat in the drawer.`;
  const scatteredHits = validateLearningPack(clippedQuiz, fx.blueprint, clippedPacket, scatteredProse).filter((f) => f.checkId === "SEC120.learning_prose_derivable");
  assert.equal(scatteredHits.length, 1, "the same words scattered beyond the gap bound must still block");
  assert.match(scatteredHits[0].message, /slipped under door/, "the blocker names the underivable clipped specific");
});

test("SEC120 blocks a review card that introduces a term the chapter's prose never uses (Task 11ai)", () => {
  const fx = compileFixture();
  const anchor = fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("review_card") && (a.hardSpecifics ?? []).length > 0);
  assert.ok(anchor, "fixture needs a specifics-rich card-capable anchor");
  const specific = anchor!.hardSpecifics![0];
  // Task 11an: keep the anchor SATISFIABLE (see the quiz case) so this stays a
  // test about a writer reaching past an on-page specific, not about the
  // unsatisfiable SEC58/SEC120 pair.
  const onPage = (anchor!.hardSpecifics ?? []).find((x) => x !== specific) ?? specific;
  const prose = {
    ...fx.summary,
    breakdown: { ...fx.summary.breakdown, deepRead: `${fx.summary.breakdown.deepRead} The deep read states ${onPage} outright.` },
  };

  const bad = cloneLearning(fx.learning);
  bad.cards.cards[0].sourceAnchorIds = [anchor!.id];
  bad.cards.cards[0].back = `Retrieve the ${specific} first, because that is the account information a lender can read before any payment lands.`;

  const hits = validateLearningPack(bad, fx.blueprint, fx.packet, prose).filter((f) => f.checkId === "SEC120.learning_prose_derivable");
  assert.ok(hits.some((f) => f.path === "/cards/cards/0"), hits.map((f) => `${f.path}: ${f.message}`).join("\n"));
  // Unused anchor specifics are NOT the card's problem — only what the unit itself cites.
  const untouched = cloneLearning(fx.learning);
  untouched.cards.cards[0].sourceAnchorIds = [anchor!.id];
  assert.deepEqual(
    validateLearningPack(untouched, fx.blueprint, fx.packet, fx.summary).filter((f) => f.checkId === "SEC120.learning_prose_derivable" && f.path === "/cards/cards/0"),
    [],
    "citing an anchor without naming its specifics is not a derivability failure",
  );
});

// Task 11ai REVIEW — the year branch was the one asymmetric path: years were pulled
// from the RAW unit text but tested against the NORMALISED haystack, where
// normalizeProseText turns "$1,800" into "1 800". A figure that IS on the page then
// read as a phantom, emitting an unactionable retry line ("remove 1800") and burning
// bounded retries on money/quantity books. Both sides now collapse digit-group
// separators and compare on digit boundaries.
test("SEC120's year rule normalises BOTH sides: a comma-grouped figure on the page is not a phantom (Task 11ai review)", () => {
  const fx = compileFixture();
  assert.deepEqual(
    validateLearningPack(cloneLearning(fx.learning), fx.blueprint, fx.packet, fx.summary).filter((f) => f.checkId === "SEC120.learning_prose_derivable"),
    [],
    "baseline: the untouched fixture pack is derivable from its own prose",
  );
  const missingFor = (prompt: string, proseSentence: string): string[] => {
    const bad = cloneLearning(fx.learning);
    bad.quiz.questions[0].prompt = prompt;
    const prose = cloneSummary(fx.summary);
    prose.breakdown.deepRead = `${prose.breakdown.deepRead} ${proseSentence}`;
    return validateLearningPack(bad, fx.blueprint, fx.packet, prose)
      .filter((f) => f.checkId === "SEC120.learning_prose_derivable" && f.path === "/quiz/questions/0")
      .map((f) => f.message);
  };
  // Same number, different punctuation on each side — must NOT fire.
  assert.deepEqual(missingFor(
    "A reader keeps a 1800 dollar buffer before the statement closes. Which move protects it?",
    "She kept a $1,800 buffer on hand while the statement closed.",
  ), [], "a thousands-separated figure in the prose is the same figure as the bare one in the stem");
  assert.deepEqual(missingFor(
    "A reader walks 2000 steps a day between statement dates. Which habit shows up first?",
    "She walked 2,000 steps a day while the balance sat unpaid.",
  ), [], "2,000 in the prose answers 2000 in the stem");
  assert.deepEqual(missingFor(
    "A reader compares the 1600 point swing against the next snapshot. Which move matters?",
    "The report showed a 1,600 point swing after the payment landed.",
  ), [], "1,600 in the prose answers 1600 in the stem");
  assert.deepEqual(missingFor(
    "A reader reads the 1751 charter before the reporting date arrives. Which move helps?",
    "The 1751st charter in the file still governs how the balance is read.",
  ), [], "digit-boundary matching: the number is on the page even inside an ordinal");

  // Still a blocker when the figure genuinely is not on the page.
  const absent = missingFor(
    "A reader checks the 1751 charter before the reporting date arrives. Which move helps?",
    "The charter in the file still governs how the balance is read.",
  );
  assert.equal(absent.length, 1, absent.join("\n"));
  assert.match(absent[0], /1751/, "a year the prose never states is still blocked");
  // And a longer number that merely CONTAINS the digits is not a match.
  const swallowed = missingFor(
    "A reader checks the 1751 charter before the reporting date arrives. Which move helps?",
    "The charter numbered 11751 in the file still governs how the balance is read.",
  );
  assert.equal(swallowed.length, 1, "1751 inside 11751 is a different number, not a match");
});

// Task 11ai REVIEW (minor b) — checkSectionGate reads the sibling summary pack off
// disk without re-gating it, so a stub pack (a hook and nothing else) could become a
// near-empty haystack that fails everything. The chapter the reader sees is the read
// tiers; without them there is nothing to be derivable FROM.
test("SEC120 no-ops against a summary pack with no drafted read tiers (Task 11ai review)", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  bad.quiz.questions[0].prompt = "A reader checks the 1751 charter before the reporting date arrives. Which move helps?";
  assert.ok(
    validateLearningPack(bad, fx.blueprint, fx.packet, fx.summary).some((f) => f.checkId === "SEC120.learning_prose_derivable"),
    "control: against the real drafted prose the same pack IS blocked",
  );
  const stub = cloneSummary(fx.summary);
  stub.breakdown = { ...stub.breakdown, fastRead: "", deepRead: "", fullRead: "" } as SummaryPackV1["breakdown"];
  assert.deepEqual(
    validateLearningPack(bad, fx.blueprint, fx.packet, stub).filter((f) => f.checkId === "SEC120.learning_prose_derivable"),
    [],
    "a summary pack with no read tiers is not this chapter's prose — the backstop no-ops",
  );
});

test("the section gate feeds a chapter's own summary prose into its learning-pack check (Task 11ai)", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v25-prose-derivable-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const anchor = fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("quiz_prompt") && (a.hardSpecifics ?? []).length > 0)!;
  const specific = anchor.hardSpecifics![0];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), [chapter()]);
    writeJsonFile(sourcePacketPath("money-book", 1, roots), fx.packet);
    writeJsonFile(blueprintPath("money-book", 1, roots), fx.blueprint);

    const bad = cloneLearning(fx.learning);
    const q = bad.quiz.questions[0];
    q.sourceAnchorIds = [anchor.id];
    q.keyEvidenceAnchorIds = [anchor.id];
    q.prompt = `A reader checks the ${specific} before the next snapshot. Which move changes what a lender can read?`;
    q.explanation = `The keyed move changes the ${specific} the report shows, while the other options leave it untouched.`;
    writeJsonFile(sectionPath("money-book", 1, "learning-pack", roots), bad);

    // No summary pack on disk yet → nothing to compare against → the check no-ops.
    const withoutProse = checkSectionGate("money-book", roots, { chapters: [1], sections: ["learning-pack"] });
    assert.equal(withoutProse.findings.some((f) => f.checkId === "SEC120.learning_prose_derivable"), false, "no drafted prose → no SEC120 finding");

    // With the sibling summary pack present, the gate sees the chapter's own prose.
    // Task 11an: the summary must put ONE of the anchor's specifics on the page,
    // or SEC120 stands down (SEC58 would compel exactly what it forbids) and this
    // plumbing assertion would test nothing. A DIFFERENT specific stays off-page,
    // so the quiz above is still reaching past a legal choice.
    const onPage = (anchor.hardSpecifics ?? []).find((x) => x !== specific) ?? specific;
    const summaryWithAnchor = {
      ...fx.summary,
      breakdown: { ...fx.summary.breakdown, deepRead: `${fx.summary.breakdown.deepRead} The deep read states ${onPage} outright.` },
    };
    writeJsonFile(sectionPath("money-book", 1, "summary-pack", roots), summaryWithAnchor);
    const report = checkSectionGate("money-book", roots, { chapters: [1], sections: ["learning-pack"] });
    assert.equal(report.passed, false);
    assert.ok(
      report.findings.some((f) => f.checkId === "SEC120.learning_prose_derivable" && f.chapterNumber === 1 && f.section === "learning-pack"),
      report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
    );
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 source packet compiler turns source-v2 into authoring-ready typed facts/cases", () => {
  const { packet } = compileFixture();
  assert.equal(packet.schemaVersion, "source-packet-v1");
  assert.equal(packet.facts.length, 9);
  assert.ok(packet.allowedNumbers.includes("300"));
  assert.ok(packet.allowedNumbers.includes("850"));
  const namedCaseAnchor = packet.allowedAnchors.find((a) => a.id === "ch01.case.fico");
  assert.ok(namedCaseAnchor?.supportsClaimTypes.includes("quiz_prompt"), "named-example anchors must support quiz prompts when hard specifics are available");
  assert.ok(namedCaseAnchor?.supportsClaimTypes.includes("quiz_key_evidence"), "named-example anchors must support quiz key evidence when hard specifics are available");
  assert.ok(namedCaseAnchor?.supportsClaimTypes.includes("review_card"), "named-example anchors must support review cards when hard specifics are available");
  assert.ok(packet.namedCases.every((c) => !c.realWorld || c.hardSpecifics.length >= 2));
  assert.equal(validateSourcePacket(packet).filter((f) => f.severity === "blocker").length, 0);
});

test("v23 source packet gate hard-blocks a 6-8 fact packet that cannot back the fixed 9-question quiz (SP13)", () => {
  const base = sidecar();
  const thinSidecar: SourceSidecarV2 = { ...base, testableFacts: base.testableFacts.slice(0, 7), keyClaims: base.keyClaims.slice(0, 7) };
  const packet = compileSourcePacketFromSidecar({ bookId: "money-book", chapter: chapter(), sidecar: thinSidecar, sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  assert.equal(packet.facts.length, 7, "packet clears the SP3 6-fact floor but stays below the 9-fact quiz need");
  assert.equal(packet.sourceQuality.status, "blocked");
  assert.ok(packet.sourceQuality.risks.some((r) => r.includes("only 7 testable fact")));
  const findings = validateSourcePacket(packet);
  const sp13 = findings.find((f) => f.checkId === "SP13.source_quality");
  assert.ok(sp13, "SP13 must fire when sourceQuality.status is blocked");
  assert.equal(sp13?.severity, "blocker");
  assert.equal(findings.some((f) => f.checkId === "SP3.fact_floor"), false, "7 facts clears the unrelated SP3 floor");
});

test("v23 book-wide dedup tags a thesis fact restamped across chapters and SP14 blocks the templated source", () => {
  // Build 7 chapters that each carry the SAME 8 boilerplate facts (only the chapter title differs
  // at the front of the claim) plus 1 genuinely chapter-specific fact — the real templated-source
  // failure mode the researcher can produce.
  const boilerplateTails = Array.from({ length: 8 }, (_, i) =>
    `depends on shared book-wide mechanism number ${i + 1} that repeats verbatim across every chapter of the book.`);
  const packets = Array.from({ length: 7 }, (_, ci) => {
    const n = ci + 1;
    const title = `Chapter ${n} Distinct Heading`;
    const boilerplate = boilerplateTails.map((tail, i) => ({
      id: `ch${String(n).padStart(2, "0")}.fact.${i + 1}`,
      claim: `${title} ${tail}`,
      becauseMechanism: `Because the same idea recurs, mechanism ${i + 1} is not specific to this chapter.`,
      commonError: `Assuming boilerplate ${i + 1} is chapter-specific.`,
      errorIsWhy: `It is the book thesis restated, not this chapter's content ${i + 1}.`,
    }));
    const specific = {
      id: `ch${String(n).padStart(2, "0")}.fact.9`,
      claim: `Chapter ${n} teaches a unique case token-${n}-alpha that appears in no other chapter of this book.`,
      becauseMechanism: `Because token-${n}-alpha is local, the writer can ground scene ${n} without repeating siblings.`,
      commonError: `Ignoring token-${n}-alpha in favor of the shared thesis.`,
      errorIsWhy: `Only token-${n}-alpha differentiates chapter ${n}.`,
    };
    const sc: SourceSidecarV2 = {
      ...sidecar(),
      chapterNumber: n,
      chapterTitle: title,
      testableFacts: [...boilerplate, specific],
      keyClaims: [...boilerplate, specific].map((f) => f.claim),
    };
    return compileSourcePacketFromSidecar({ bookId: "book", chapter: { chapterId: `book-ch${n}`, chapterNumber: n, chapterTitle: title }, sidecar: sc, sidecarPath: `/tmp/ch${n}.json`, sourceHash: "h" });
  });
  tagBookWideDuplicateFacts(packets);
  const first = packets[0];
  const tagged = first.facts.filter((f) => f.bookWideDuplicate).length;
  assert.equal(tagged, 8, "the 8 book-wide boilerplate facts are tagged");
  assert.equal(first.facts.find((f) => f.id.endsWith(".fact.9"))?.bookWideDuplicate, undefined, "the chapter-specific fact is NOT tagged");
  const sp14 = validateSourcePacket(first).find((f) => f.checkId === "SP14.templated_source");
  assert.ok(sp14 && sp14.severity === "blocker", "SP14 must block a chapter with fewer than 3 chapter-specific facts");
});

test("v23 SP14 does not fire when facts are chapter-specific (no false positive on healthy source)", () => {
  // The default fixture facts are distinct per chapter; without tagging, every fact counts as
  // chapter-specific, so SP14 must stay silent.
  const packet = compileSourcePacketFromSidecar({ bookId: "money-book", chapter: chapter(), sidecar: sidecar(), sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  assert.equal(validateSourcePacket(packet).some((f) => f.checkId === "SP14.templated_source"), false);
});

test("v23 source packet gate passes a 9-fact packet with no SP13 block", () => {
  const { packet } = compileFixture();
  assert.equal(packet.facts.length, 9);
  assert.notEqual(packet.sourceQuality.status, "blocked");
  assert.equal(validateSourcePacket(packet).some((f) => f.checkId === "SP13.source_quality"), false);
});

test("v23 source packet fact extraction is behavior-preserving: the shared compiledFactsFromSidecar helper reproduces the pre-refactor packet byte-for-byte", () => {
  // These hashes were re-derived DELIBERATELY for P13, which additively stamps a per-fact
  // teachingPriority and packet.coreMoveFactId (the pedagogical ranking). The pre-P13 values
  // were facts=sha256:5e4d1131… / packet=sha256:9da60abb… (captured before sourcePacketFacts.ts
  // existed). If either changes AGAIN without an intended packet-shape change, the extraction
  // broke behavior or the fixture drifted — re-derive deliberately, do not silently update.
  const { packet } = compileFixture();
  assert.equal(canonicalJsonSha256(packet.facts), "sha256:2ee22e0c1244fada6d279d775fb4fcf965b6fdf317b7e8a9e60e5b90fb7717b7", "compiled facts must be byte-identical to the pinned output (incl. P13 teachingPriority)");
  assert.equal(canonicalJsonSha256(packet), "sha256:6fdb1b6ed6e3333977f3b10df78c45317cf20d18b78894d9098fad587e5f7715", "the whole compiled packet must be byte-identical to the pinned output (incl. P13 ranking)");

  // The packet compiler must be USING the shared helper, not a parallel reimplementation:
  // calling compiledFactsFromSidecar directly on the same sidecar must equal packet.facts
  // MINUS the P13 ranking (compiledFactsFromSidecar only extracts facts; applyTeachingRanking
  // layers teachingPriority on top afterward).
  assert.deepEqual(compiledFactsFromSidecar(sidecar(), 1), packet.facts.map(({ teachingPriority: _tp, ...f }) => f));
});

test("v23 fact-floor parity: a sidecar with 9 raw testableFacts where 1 is malformed compiles to 8 facts and SP13 agrees with the shared REQUIRED_QUIZ_FACT_FLOOR constant", () => {
  const base = sidecar();
  const malformed: SourceSidecarV2 = {
    ...base,
    testableFacts: base.testableFacts.map((f, i) => (i === 4 ? { ...f, claim: "" } : f)),
  };
  const compiled = compiledFactsFromSidecar(malformed, 1);
  assert.equal(compiled.length, 8, "a blank-claim testableFacts entry must be dropped, not counted");
  assert.equal(base.testableFacts.length, 9, "the raw sidecar still reports 9 testableFacts");

  const packet = compileSourcePacketFromSidecar({ bookId: "money-book", chapter: chapter(), sidecar: malformed, sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  assert.equal(packet.facts.length, 8, "compileSourcePacketFromSidecar must count facts the same way as compiledFactsFromSidecar");
  assert.ok(packet.facts.length < REQUIRED_QUIZ_FACT_FLOOR, "8 compiled facts must be below the shared quiz-fact floor");
  assert.equal(packet.sourceQuality.status, "blocked");
  const sp13 = validateSourcePacket(packet).find((f) => f.checkId === "SP13.source_quality");
  assert.ok(sp13, "SP13 must block an 8-usable-fact packet at the packet gate");
  assert.equal(sp13?.severity, "blocker");
});

test("v23 blueprint compiler creates deterministic variety budgets and balanced quiz key pattern", () => {
  const { blueprint } = compileFixture();
  assert.equal(blueprint.schemaVersion, "chapter-blueprint-v1");
  assert.equal(blueprint.plan.chapterId, blueprint.chapterId);
  assert.equal(blueprint.sections.examples.length, 6, "v23 must align with the final v21 six-example floor");
  assert.equal(blueprint.sections.quiz.length, 9, "v23 must align with the final v21 nine-question quiz floor");
  assert.equal(blueprint.plan.exampleCount, 6);
  assert.equal(blueprint.plan.exampleSpecs.length, 6);
  const exampleFormats = blueprint.plan.exampleSpecs.map((spec) => spec.format);
  assert.equal(new Set(exampleFormats).size, 6, `example plan formats must be unique: ${exampleFormats.join(", ")}`);
  assert.equal(blueprint.sections.examples.every((slot) => slot.sceneFrame && slot.requiredBeat), true, "example slots must carry anti-sweep sceneFrame guidance");
  const c7 = new Set(C7_BANNED_NAMES);
  assert.equal(blueprint.reservedVariety.allowedNames.some((name) => c7.has(name)), false, "compiler must not deal final-gate C7 banned names");
  assert.equal(blueprint.sections.examples.some((slot) => slot.allowedNames.some((name) => c7.has(name))), false, "example slots must not deal C7 banned names");
  assert.equal(blueprint.plan.exampleSpecs.every((spec) => (spec.sourceAnchorIds ?? []).every((id) => id.includes(".case.") || id.includes(".example."))), true, "example specs must use example-eligible anchors");
  const counts = [0, 1, 2].map((i) => blueprint.reservedVariety.answerIndexPattern.filter((v) => v === i).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `balanced counts ${counts}`);
  assert.equal(blueprint.sections.quiz.every((q) => q.promptShape && q.answerStyle && q.distractorTrap), true, "quiz slots must carry anti-template shape guidance");
  assert.equal(blueprint.sections.quiz.every((q) => q.caseCueIds.length > 0), true, "quiz slots must carry named-case cues");
  assert.equal(blueprint.sections.cards.every((c) => c.frontShape && c.retrievalTarget && c.backShape), true, "card slots must carry anti-template shape guidance");
  assert.equal(blueprint.sections.cards.every((c) => c.caseCueIds.length > 0), true, "card slots must carry named-case cues");
  assert.equal(blueprint.sections.action.ifThenPlanShapes.length, 3, "action slot must deal if-then plan shapes");
  assert.ok(blueprint.sections.action.practiceForm.length > 0, "action slot must deal a 24-hour practice form");
  assert.ok(blueprint.sections.action.practiceConstraint.length > 0, "action slot must deal a practice constraint");
  assert.equal(validateBlueprint(blueprint).filter((f) => f.severity === "blocker").length, 0);
});

test("v23 blueprint compiler keeps source-grounding meta facts out of learning slots", () => {
  const fx = compileFixture();
  const packet = JSON.parse(JSON.stringify(fx.packet)) as typeof fx.packet;
  packet.facts[0].claim = "Example Chapter uses at least 3 named cases so the concept is grounded in concrete settings rather than abstraction.";
  packet.facts[0].mechanism = "Concrete settings give memory a handle and make the claim checkable against real-world evidence.";
  packet.facts[1].claim = "Example Chapter requires specificity because named people, places, dates, or numbers prevent the writer from inventing generic scenes.";
  packet.facts[1].mechanism = "Visible facts limit fictional embellishment and let later QC trace claims to source anchors.";
  const blueprint = compileChapterBlueprint({ bookId: "money-book", chapter: chapter(), packet, packetPath: "/tmp/ch01.source-packet.json" });
  const learningFactIds = [
    ...blueprint.sections.quiz.flatMap((q) => q.requiredFactIds),
    ...blueprint.sections.cards.flatMap((c) => c.requiredFactIds),
  ];
  assert.equal(learningFactIds.includes("ch01.fact.1"), false, "source-grounding case-count fact should not be dealt to quiz/cards");
  assert.equal(learningFactIds.includes("ch01.fact.2"), false, "source-grounding specificity/QC fact should not be dealt to quiz/cards");
});

test("v23 assertFactIdsSubset throws when a dealt fact id escapes constraints.allowedFactIds", () => {
  assert.doesNotThrow(() => assertFactIdsSubset(["ch01.fact.1", "ch01.fact.2"], ["ch01.fact.1", "ch01.fact.2", "ch01.fact.3"], "chapter 1 blueprint"));
  assert.throws(
    () => assertFactIdsSubset(["ch01.fact.1", "ch01.fact.9"], ["ch01.fact.1", "ch01.fact.2"], "chapter 1 blueprint"),
    /ch01\.fact\.9[\s\S]*not present in constraints\.allowedFactIds/,
  );
});

function dealtRequiredFactIds(blueprint: ReturnType<typeof compileChapterBlueprint>): string[] {
  return [
    ...blueprint.sections.hook.requiredFactIds,
    ...blueprint.sections.summaries.requiredFactIds,
    ...blueprint.sections.examples.flatMap((ex) => ex.requiredFactIds),
    ...blueprint.sections.quiz.flatMap((q) => q.requiredFactIds),
    ...blueprint.sections.cards.flatMap((c) => c.requiredFactIds),
    ...blueprint.sections.action.requiredFactIds,
    ...blueprint.coreMove.sourceFactIds,
  ];
}

test("v23 blueprint compiler always deals requiredFactIds that are a subset of constraints.allowedFactIds", () => {
  const { blueprint } = compileFixture();
  const allowed = new Set(blueprint.constraints.allowedFactIds);
  const dealt = dealtRequiredFactIds(blueprint);
  assert.ok(dealt.length > 0, "fixture should deal at least one requiredFactId");
  const escaped = dealt.filter((id) => !allowed.has(id));
  assert.deepEqual(escaped, [], "dealt requiredFactIds must never escape constraints.allowedFactIds");

  // <3-teaching-fact fallback: mark all but two of the packet's facts as source-grounding meta facts so
  // factIds() must fall back to the raw fact list (rawFactIds), which is exactly constraints.allowedFactIds.
  const fx = compileFixture();
  const packet = JSON.parse(JSON.stringify(fx.packet)) as typeof fx.packet;
  for (const fact of packet.facts.slice(0, 7)) {
    fact.claim = "This chapter uses at least 3 named cases so the concept is grounded in concrete settings rather than abstraction.";
    fact.mechanism = "Concrete settings give memory a handle and make the claim checkable against real-world evidence.";
  }
  const fallback = compileChapterBlueprint({ bookId: "money-book", chapter: chapter(), packet, packetPath: "/tmp/ch01.source-packet.json" });
  const fallbackAllowed = new Set(fallback.constraints.allowedFactIds);
  const fallbackDealt = dealtRequiredFactIds(fallback);
  const fallbackEscaped = fallbackDealt.filter((id) => !fallbackAllowed.has(id));
  assert.deepEqual(fallbackEscaped, [], "fallback-to-raw dealt requiredFactIds must still be a subset of constraints.allowedFactIds");
  assert.ok(
    fallbackDealt.includes("ch01.fact.1"),
    "fallback should have engaged: a source-grounding meta fact should have been dealt once teaching facts drop below 3",
  );
});

test("v23 section gate blocks source-grounding boilerplate in reader learning fields", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  bad.quiz.questions[0].explanation = "Concrete settings give memory a handle and keep claims checkable. Without at least 3 named cases, later prose invents scenes.";
  bad.cards.cards[0].front = "What failure mode appears when a scene lacks source confirmation?";
  bad.cards.cards[0].back = "The examples are part of the correctness spine, so the writer must keep claims checkable before publishing.";

  const findings = validateSectionPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC92.hard_banned_phrase" && /source-grounding|Concrete settings|failure mode appears|correctness spine/i.test(f.message)),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

// ── SEC123 — the compile-side mirror of ship-gate B5 (em dash) ────────────────
// The live Franklin QC round qc-29d119c59544a5d991c71c7c9fec04bb carried 68 B5
// blockers out of 96: the ship gate hard-bans the em dash on every reader-facing
// field and, before SEC123, no compile-side check looked for one. Every blocker in
// that class was therefore discovered a whole QC round after the compiler had
// already passed the content.

test("SEC123 blocks an em dash in reader-facing summary, example, learning and action fields", () => {
  const fx = compileFixture();

  const badSummary = cloneSummary(fx.summary);
  badSummary.keyTakeaway = `Pay the balance before the snapshot — the report cannot show what is already gone.`;
  const summaryFindings = validateSectionPack(badSummary, fx.blueprint, fx.packet)
    .filter((f) => f.checkId === "SEC123.reader_em_dash");
  assert.equal(summaryFindings.length, 1, JSON.stringify(summaryFindings));
  assert.equal(summaryFindings[0].severity, "blocker");
  assert.equal(summaryFindings[0].path, "/keyTakeaway");

  const badExamples = cloneExamples(fx.examples);
  badExamples.examples[0].scenario = `${badExamples.examples[0].scenario} She paused — then paid.`;
  assert.ok(
    validateSectionPack(badExamples, fx.blueprint, fx.packet)
      .some((f) => f.checkId === "SEC123.reader_em_dash" && f.path === "/examples/0/scenario"),
  );

  const badLearning = cloneLearning(fx.learning);
  badLearning.cards.cards[0].back = `${badLearning.cards.cards[0].back} The signal — not the intent — is what the lender reads.`;
  assert.ok(
    validateSectionPack(badLearning, fx.blueprint, fx.packet)
      .some((f) => f.checkId === "SEC123.reader_em_dash" && f.path === "/cards/cards/0/back"),
  );

  const badAction = cloneAction(fx.action);
  badAction.implementationPlan.weeklyPractice = `${badAction.implementationPlan.weeklyPractice} Check it weekly — same day each week.`;
  assert.ok(
    validateSectionPack(badAction, fx.blueprint, fx.packet)
      .some((f) => f.checkId === "SEC123.reader_em_dash" && f.path === "/implementationPlan/weeklyPractice"),
  );
});

test("SEC123 fires on exactly the character ship-gate B5 fires on, and on no other dash", () => {
  const fx = compileFixture();
  const withEmDash = cloneSummary(fx.summary);
  withEmDash.keyTakeaway = "Pay the reported balance before the snapshot — nothing later can undo it.";
  const withHyphenAndEnDash = cloneSummary(fx.summary);
  withHyphenAndEnDash.keyTakeaway = "Pay the reported balance before the snapshot - and in the 2019–2024 window it still holds.";

  // Both sides read the same primitive, so this is the drift guard: if B5's notion of
  // an em dash ever changes, SEC123's must change with it or this pair breaks.
  assert.equal(checkNoEmDash(withEmDash.keyTakeaway).length, 1);
  assert.equal(checkNoEmDash(withHyphenAndEnDash.keyTakeaway).length, 0);
  assert.equal(
    validateSectionPack(withEmDash, fx.blueprint, fx.packet).filter((f) => f.checkId === "SEC123.reader_em_dash").length,
    1,
  );
  assert.equal(
    validateSectionPack(withHyphenAndEnDash, fx.blueprint, fx.packet).filter((f) => f.checkId === "SEC123.reader_em_dash").length,
    0,
    "a hyphen and an en dash are legal; SEC123 must not exceed the ship gate it mirrors",
  );
});

test("the clean compile fixture carries no em dash, so SEC123 adds no blocker to conformant packs", () => {
  const fx = compileFixture();
  for (const pack of [fx.summary, fx.examples, fx.learning, fx.action]) {
    const findings = validateSectionPack(pack as never, fx.blueprint, fx.packet)
      .filter((f) => f.checkId === "SEC123.reader_em_dash");
    assert.deepEqual(findings, [], JSON.stringify(findings));
  }
});

test("v23 section gate blocks source-note numbering in reader-facing fields", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  bad.quiz.questions[0].explanation = "Fact 2 says the reporting snapshot matters, so the reader should act before the balance travels.";
  bad.quiz.questions[1].explanation = "The answer follows ch01.fact.3 because source IDs should never appear in reader prose.";

  const findings = validateSectionPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC103.source_numbering_leak" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 section gate blocks SPELLED-OUT source-note numbering ('Fact five favors…') but not legit prose", () => {
  // The-power-of-moments regen shipped "Fact five favors purpose framing…" in an example
  // whyItMatters and passed both SEC103 and QC because the leak regex was digit-only. The
  // spelled-out branch is verb/possessive-anchored so it never fires on ordinary prose.
  const fx = compileFixture();
  const leaked = cloneLearning(fx.learning);
  leaked.quiz.questions[0].explanation = "Fact five favors the reporting move, so the reader lowers the visible balance before the snapshot.";
  leaked.quiz.questions[1].explanation = "Fact six says the timing matters, which is why the account is paid before the statement date.";
  const leakFindings = validateSectionPack(leaked, fx.blueprint, fx.packet);
  assert.ok(
    leakFindings.filter((f) => f.checkId === "SEC103.source_numbering_leak" && f.severity === "blocker").length >= 2,
    leakFindings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );

  const clean = cloneLearning(fx.learning);
  clean.quiz.questions[0].explanation = "The fact five accounts share one billing date is why the timing still holds for the reader.";
  assert.equal(
    validateSectionPack(clean, fx.blueprint, fx.packet).some((f) => f.checkId === "SEC103.source_numbering_leak"),
    false,
    "SEC103 must not fire on legit prose 'the fact five accounts…'",
  );
});

test("v23 section gate blocks a pasted source-anchor label seam (SEC105) but not legit slashed prose", () => {
  // The-power-of-moments regen pasted internal anchor labels — "Southwest Airlines / playful
  // safety routines", "John Deere / first-day peak" — verbatim into reader prose, and a
  // book-score panel flagged the " / " seams book-wide as a tone/density drag that every gate
  // passed. SEC105 is data-driven: it fires ONLY when an actual anchor label (with the " / "
  // seam) is reproduced verbatim, so it is zero-false-positive on ordinary slashed prose.
  const fx = compileFixture();
  fx.packet.allowedAnchors[0].label = "Acme Robotics / warehouse pilot"; // internal bookkeeping label form
  const leaked = cloneLearning(fx.learning);
  leaked.quiz.questions[0].explanation = "Acme Robotics / warehouse pilot shows the move, so the reader copies the staged rollout.";
  const findings = validateSectionPack(leaked, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC105.source_label_leak" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );

  const clean = cloneLearning(fx.learning);
  clean.quiz.questions[0].explanation = "The reader weighs cost / benefit before committing, then decides on the evidence.";
  assert.equal(
    validateSectionPack(clean, fx.blueprint, fx.packet).some((f) => f.checkId === "SEC105.source_label_leak"),
    false,
    "SEC105 must not fire on legit slashed prose that is not an anchor label",
  );
});

test("v23 section gate blocks jammed proper nouns in reader-facing fields", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  bad.cards.cards[0].back = "Sharp HealthCare becomes a jammed source label here; describe the health care system in ordinary reader prose instead.";

  const findings = validateSectionPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC104.reader_jammed_proper_noun" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 section gate blocks doubled periods and lowercase sentence starts before QC", () => {
  const fx = compileFixture();
  const bad = cloneSummary(fx.summary);
  bad.breakdown.fastRead = `${bad.breakdown.fastRead} One sentence.. another sentence starts badly after the doubled period.`;

  const findings = validateSectionPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC127.reader_doubled_period" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
  assert.ok(
    findings.some((f) => f.checkId === "SEC106.reader_lowercase_sentence_start" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 section gate mirrors final gate on lowercase starts after abbreviations", () => {
  const fx = compileFixture();
  const bad = cloneSummary(fx.summary);
  bad.breakdown.deepRead = `${bad.breakdown.deepRead} A U.S. airline cannot leave this as a lowercase boundary in final chapter text.`;

  const findings = validateSectionPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC106.reader_lowercase_sentence_start" && f.path === "/breakdown/deepRead"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 section gate blocks example trailing fragments before assembly", () => {
  const fx = compileFixture();
  const bad = cloneExamples(fx.examples);
  bad.examples[0].scenario = "Mara checks the invoice before the client meeting but the generated sentence stops without a final";

  const findings = validateSectionPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC113.reader_trailing_fragment" && f.path === "/examples/0/scenario"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 section gate blocks generated sentence seams before bar review", () => {
  const fx = compileFixture();
  const bad = cloneSummary(fx.summary);
  bad.breakdown.fastRead = "A short event becomes memorable when it lifts people above routine, gives them a new insight, marks earned pride, or creates The emotional route matters because surprise and connection do different work.";

  const findings = validateSectionPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC110.reader_sentence_seam" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 learning-pack validator rejects quiz choices that import hard specifics from an uncited named case", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  bad.quiz.questions[0].sourceAnchorIds = ["ch01.case.cfpb"];
  bad.quiz.questions[0].keyEvidenceAnchorIds = ["ch01.case.cfpb"];
  bad.quiz.questions[0].prompt = "A reader is using Consumer Financial Protection Bureau credit reports to decide what evidence matters. Which answer stays source-local?";
  bad.quiz.questions[0].choices[bad.quiz.questions[0].correctIndex] = "Use the credit reports and lenders use account information details, not the 300 to 850 scale or credit utilization case.";
  bad.quiz.questions[0].explanation = "The report case is about credit reports and lenders use account information, so the answer should not borrow the FICO score range details.";

  const findings = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC111.quiz_cross_case_detail" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 blueprint compiler pairs example cases with the closest required source fact", () => {
  const spec: ChapterSpec = { chapterId: "investing-book-ch01", chapterNumber: 1, chapterTitle: "Defensive Stocks" };
  const sidecar: SourceSidecarV2 = {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Defensive Stocks",
    centralConcept: { id: "ch01.concept.defensive", name: "Defensive stock selection", plainDefinition: "Use repeatable quality filters before buying stocks.", whyItMatters: "The reader avoids confusing familiarity with safety." },
    keyClaims: [],
    namedExamples: [
      { id: "ch01.case.dow", label: "Dow Jones Industrial Average companies", summary: "Seasoned large enterprises with a financial strength screen.", teachesWhat: "Large seasoned records are easier to inspect.", hardSpecifics: ["Dow Jones Industrial Average companies", "seasoned large enterprises", "financial strength screen"], realWorld: true },
      { id: "ch01.case.dividend", label: "Dividend record screen", summary: "A long dividend payment record and shareholder cash distributions support a quality screen.", teachesWhat: "Dividend history is a quality signal.", hardSpecifics: ["long dividend payment record", "shareholder cash distributions", "quality screen"], realWorld: true },
      { id: "ch01.case.dca", label: "Dollar-cost averaging / Investor.gov", summary: "Dollar-cost averaging uses equal sums at regular intervals and buys more shares when prices are low.", teachesWhat: "A schedule reduces timing dependence.", hardSpecifics: ["equal sums at regular intervals", "Investor.gov dollar-cost averaging definition", "buys more shares when prices are low"], realWorld: true },
    ],
    hardEdge: "Do not promise profit.",
    paraphraseNotes: "Keep the claims limited to defensive quality filters.",
    testableFacts: [
      { id: "ch01.fact.1", claim: "Dollar-cost averaging reduces timing dependence.", becauseMechanism: "Regular equal purchases buy more shares when prices are low and fewer when prices are high.", commonError: "Dollar-cost averaging guarantees a profit.", errorIsWhy: "It manages entry risk but cannot remove market risk." },
      { id: "ch01.fact.2", claim: "A defensive stock list should emphasize large and seasoned companies.", becauseMechanism: "Established operations provide more evidence than promotions or small speculative issues.", commonError: "Small new companies are safer because they can grow faster.", errorIsWhy: "Growth potential does not replace a proven record." },
      { id: "ch01.fact.3", claim: "Dividend history matters as a quality signal.", becauseMechanism: "Repeated cash distributions show an ability and willingness to share earnings through cycles.", commonError: "A company that pays no dividend is automatically bad.", errorIsWhy: "The rule is a defensive filter, not a universal valuation law." },
    ],
  };
  const packet = compileSourcePacketFromSidecar({ bookId: "investing-book", chapter: spec, sidecar, sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId: "investing-book", chapter: spec, packet, packetPath: "/tmp/ch01.source-packet.json" });

  assert.deepEqual(blueprint.sections.examples[0].requiredCaseIds, ["ch01.case.dca"]);
  assert.deepEqual(blueprint.sections.examples[1].requiredCaseIds, ["ch01.case.dow"]);
  assert.deepEqual(blueprint.sections.examples[2].requiredCaseIds, ["ch01.case.dividend"]);
});

test("v23 blueprint compiler balances example cases when one source case overmatches every fact", () => {
  const spec: ChapterSpec = { chapterId: "courage-book-ch01", chapterNumber: 1, chapterTitle: "Practice Courage" };
  const sidecar: SourceSidecarV2 = {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Practice Courage",
    centralConcept: { id: "ch01.concept.courage", name: "Courage practice", plainDefinition: "Turn courage into small rehearsable moves.", whyItMatters: "The reader can practice pressure before the real moment." },
    keyClaims: [],
    namedExamples: [
      { id: "ch01.case.nashville", label: "Civil rights sit-in training / Nashville workshops", summary: "The workshops rehearsed direct action under harassment.", teachesWhat: "Practice makes pressure concrete.", hardSpecifics: ["1960 Nashville sit-ins", "nonviolent direct-action workshops", "role-played harassment"], realWorld: true },
      { id: "ch01.case.treasurer", label: "Bill Treasurer / courage-building exercises", summary: "Workplace courage training uses small-risk practice and skill-based courage framing.", teachesWhat: "Courage can be practiced as a skill.", hardSpecifics: ["workplace courage training", "small-risk practice", "skill-based courage framing"], realWorld: true },
      { id: "ch01.case.greendot", label: "Green Dot / bystander intervention", summary: "Bystander intervention scripts are practiced in campus training settings.", teachesWhat: "Scripts make action easier under social pressure.", hardSpecifics: ["violence-prevention program", "bystander intervention scripts", "campus training settings"], realWorld: true },
    ],
    hardEdge: "Do not equate courage with reckless risk.",
    paraphraseNotes: "Use the cases as bounded practice examples.",
    testableFacts: Array.from({ length: 9 }, (_, i) => ({
      id: `ch01.fact.${i + 1}`,
      claim: `Courage practice needs workplace courage training, small-risk practice, and skill-based courage framing ${i + 1}.`,
      becauseMechanism: `The practice works because workplace courage training makes small-risk practice concrete before pressure arrives ${i + 1}.`,
      commonError: `Treating courage as a heroic trait ${i + 1}.`,
      errorIsWhy: `Skill-based courage framing turns the move into practice instead of identity ${i + 1}.`,
    })),
  };
  const packet = compileSourcePacketFromSidecar({ bookId: "courage-book", chapter: spec, sidecar, sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId: "courage-book", chapter: spec, packet, packetPath: "/tmp/ch01.source-packet.json" });
  const dealt = blueprint.sections.examples.flatMap((slot) => slot.requiredCaseIds);
  const counts = new Map<string, number>();
  for (const id of dealt) counts.set(id, (counts.get(id) ?? 0) + 1);

  assert.equal(new Set(dealt).size, 3, `expected all three named cases to appear, got ${dealt.join(", ")}`);
  assert.deepEqual([...counts.values()].sort(), [2, 2, 2]);
});

test("v23 blueprint compiler rotates example fact slots across adjacent chapters", () => {
  const fx = compileFixture();
  const ch1 = compileChapterBlueprint({ bookId: "money-book", chapter: chapter(), packet: fx.packet, packetPath: "/tmp/ch01.source-packet.json" });
  const ch2 = compileChapterBlueprint({
    bookId: "money-book",
    chapter: { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    packet: fx.packet,
    packetPath: "/tmp/ch02.source-packet.json",
  });

  assert.notEqual(
    ch1.sections.examples[5].requiredFactIds[0],
    ch2.sections.examples[5].requiredFactIds[0],
    "same-position example slots must not stamp the same support fact across chapters",
  );
});

test("v23 blueprint compiler excludes source-figure first names from fictional name pool", () => {
  const fx = compileFixture();
  const packet = { ...fx.packet, allowedEntities: [...fx.packet.allowedEntities, "Graham"] };
  const blueprint = compileChapterBlueprint({ bookId: "money-book", chapter: chapter(), packet, packetPath: "/tmp/ch01.source-packet.json" });
  assert.equal(blueprint.reservedVariety.allowedNames.includes("Benjamin"), false, "Graham in the source should reserve Benjamin for source references");
  assert.equal(blueprint.sections.examples.some((slot) => slot.allowedNames.includes("Benjamin")), false, "example slots must not deal source-figure first names");
  assert.equal(blueprint.reservedVariety.forbiddenNames.includes("Benjamin"), true, "protected source names should be visible to writers as forbidden");
});

test("v23 blueprint compiler globally reserves canonical source-figure names from fictional casts", () => {
  const { blueprint } = compileFixture();
  for (const name of ["Benjamin", "Graham", "Dodd", "Buffett", "Warren"]) {
    assert.equal(blueprint.reservedVariety.allowedNames.includes(name), false, `${name} must not be dealt as a fictional protagonist`);
    assert.equal(blueprint.sections.examples.some((slot) => slot.allowedNames.includes(name)), false, `${name} must not appear in example slot names`);
    assert.equal(blueprint.reservedVariety.forbiddenNames.includes(name), true, `${name} should be visible in writer forbiddenNames`);
  }
});

test("v23 blueprint compiler deals adjacent chapters disjoint protagonist name pools", () => {
  const fx = compileFixture();
  const ch2: ChapterSpec = { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" };
  const bp1 = compileChapterBlueprint({ bookId: "money-book", chapter: chapter(), packet: fx.packet, packetPath: "/tmp/ch01.source-packet.json" });
  const bp2 = compileChapterBlueprint({ bookId: "money-book", chapter: ch2, packet: fx.packet, packetPath: "/tmp/ch02.source-packet.json" });
  assert.equal(bp1.reservedVariety.allowedNames.length, 6);
  assert.equal(bp2.reservedVariety.allowedNames.length, 6);
  const overlap = bp1.reservedVariety.allowedNames.filter((name) => bp2.reservedVariety.allowedNames.includes(name));
  assert.deepEqual(overlap, [], `adjacent chapters must not share protagonist names; overlap=${overlap.join(", ")}`);
});

test("v23 blueprint compiler avoids generic action-container venues", () => {
  const fx = compileFixture();
  const forbiddenVenueTerms = /\b(?:budget app|shared spreadsheet|calendar reminder|calendar block|service counter|notebook margin|team chat|planning call|benefits office counter|service desk)\b/i;
  const venues: string[] = [];
  for (let chapterNumber = 1; chapterNumber <= 12; chapterNumber++) {
    const spec: ChapterSpec = { chapterId: `money-book-ch${String(chapterNumber).padStart(2, "0")}`, chapterNumber, chapterTitle: `Chapter ${chapterNumber}` };
    const bp = compileChapterBlueprint({ bookId: "money-book", chapter: spec, packet: fx.packet, packetPath: `/tmp/ch${String(chapterNumber).padStart(2, "0")}.source-packet.json` });
    venues.push(...bp.sections.examples.map((slot) => slot.venue));
  }
  assert.equal(venues.some((venue) => forbiddenVenueTerms.test(venue)), false, `generic venues dealt: ${venues.filter((venue) => forbiddenVenueTerms.test(venue)).join(", ")}`);
});

test("v23 blueprint compiler deals parallel-safe adjacent example venues", () => {
  const fx = compileFixture();
  const blueprints = [10, 11, 12].map((chapterNumber) => {
    const spec: ChapterSpec = { chapterId: `money-book-ch${String(chapterNumber).padStart(2, "0")}`, chapterNumber, chapterTitle: `Chapter ${chapterNumber}` };
    return compileChapterBlueprint({ bookId: "money-book", chapter: spec, packet: fx.packet, packetPath: `/tmp/ch${String(chapterNumber).padStart(2, "0")}.source-packet.json` });
  });
  const financeDocumentContainer = /\b(?:prospectus packet|broker statement|portfolio policy file|bond quote sheet|allocation worksheet|research queue)\b/i;
  for (const bp of blueprints) {
    assert.equal(
      bp.reservedVariety.venuePalette.some((venue) => financeDocumentContainer.test(venue)),
      false,
      `blueprint should not deal finance-document containers as default venues: ${bp.reservedVariety.venuePalette.join(", ")}`,
    );
  }
  for (let i = 0; i < blueprints.length - 1; i++) {
    const current = blueprints[i].reservedVariety.venuePalette;
    const next = blueprints[i + 1].reservedVariety.venuePalette;
    const overlap = current.filter((venue) => next.includes(venue));
    assert.deepEqual(overlap, [], `adjacent blueprints must not share venues: ${overlap.join(", ")}`);
  }
});

test("v23 blueprint compiler does not repeat answer-key rhythms across nearby chapters", () => {
  const fx = compileFixture();
  const patterns: string[] = [];
  const quizShapePatterns: string[] = [];
  const actionShapePatterns: string[] = [];
  for (let chapterNumber = 1; chapterNumber <= 12; chapterNumber++) {
    const spec: ChapterSpec = { chapterId: `money-book-ch${String(chapterNumber).padStart(2, "0")}`, chapterNumber, chapterTitle: `Chapter ${chapterNumber}` };
    const bp = compileChapterBlueprint({ bookId: "money-book", chapter: spec, packet: fx.packet, packetPath: `/tmp/ch${String(chapterNumber).padStart(2, "0")}.source-packet.json` });
    patterns.push(bp.reservedVariety.answerIndexPattern.join(","));
    quizShapePatterns.push(bp.sections.quiz.map((q) => `${q.promptShape}/${q.answerStyle}/${q.distractorTrap}`).join("|"));
    actionShapePatterns.push(`${bp.sections.action.ifThenPlanShapes.join("|")} :: ${bp.sections.action.practiceConstraint}`);
  }
  assert.equal(new Set(patterns).size, patterns.length, `answer-key patterns must be unique across a 12-chapter book: ${patterns.join(" | ")}`);
  assert.ok(new Set(quizShapePatterns).size >= 6, `quiz anti-template shapes should vary across nearby chapters: ${quizShapePatterns.join(" || ")}`);
  assert.ok(new Set(actionShapePatterns).size >= 6, `action anti-template shapes should vary across nearby chapters: ${actionShapePatterns.join(" || ")}`);
});

test("v23 blueprint compiler staggers parallel example beats away from shortcut/default scene shells", () => {
  const fx = compileFixture();
  const blueprints = [16, 17, 18, 19, 20].map((chapterNumber) => {
    const spec: ChapterSpec = { chapterId: `money-book-ch${String(chapterNumber).padStart(2, "0")}`, chapterNumber, chapterTitle: `Chapter ${chapterNumber}` };
    return compileChapterBlueprint({ bookId: "money-book", chapter: spec, packet: fx.packet, packetPath: `/tmp/ch${String(chapterNumber).padStart(2, "0")}.source-packet.json` });
  });
  const firstSlotBeats = blueprints.map((bp) => bp.sections.examples[0].requiredBeat);
  const firstSlotPurposes = blueprints.map((bp) => bp.sections.examples[0].purpose);
  const allRequiredBeats = blueprints.flatMap((bp) => bp.sections.examples.map((slot) => slot.requiredBeat)).join("\n");

  assert.equal(new Set(firstSlotBeats).size, firstSlotBeats.length, `parallel ch16-20 ex01 beats must not stamp one assignment: ${firstSlotBeats.join(" | ")}`);
  assert.ok(new Set(firstSlotPurposes).size >= 4, `parallel ch16-20 ex01 purposes should vary: ${firstSlotPurposes.join(" | ")}`);
  assert.equal(/\b(?:old default|usual shortcut|shortcut|default failing)\b/i.test(allRequiredBeats), false, "blueprint beats must not instruct the repeated shortcut/default failure shell");
  assert.equal(/\bpartial outcome\b|\bnext action\b/i.test(allRequiredBeats), false, "blueprint beats must not instruct the repeated partial-outcome/next-action shell");
});

test("v23 section validators check small artifact contracts before ChapterV21 assembly", () => {
  const fx = compileFixture();
  assert.equal(validateSummaryPack(fx.summary, fx.blueprint, fx.packet).filter((f) => f.severity === "blocker").length, 0);
  assert.equal(validateExamplePack(fx.examples, fx.blueprint, fx.packet).filter((f) => f.severity === "blocker").length, 0);
  assert.equal(validateLearningPack(fx.learning, fx.blueprint, fx.packet).filter((f) => f.severity === "blocker").length, 0);
  assert.equal(validateActionPack(fx.action, fx.blueprint, fx.packet).filter((f) => f.severity === "blocker").length, 0);
});

test("v23 section gate rejects long source-note paste before ChapterV21 assembly", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-source-paste-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const sidecarPath = resolve(stateRoot, "sidecars", "source", "ch01.source.json");
  const pastedRun = "Keep numbers limited to the verified 300 to 850 score range and the source-local credit utilization mechanism.";
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), [chapter()]);
    writeJsonFile(sidecarPath, sidecar());
    writeJsonFile(sourcePacketPath("money-book", 1, roots), { ...fx.packet, sourceSidecarPath: sidecarPath });
    writeJsonFile(blueprintPath("money-book", 1, roots), fx.blueprint);

    const summary = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
    summary.breakdown.fullRead = `${summary.breakdown.fullRead}\n\n${pastedRun}`;
    const action = JSON.parse(JSON.stringify(fx.action)) as ActionPackV1;
    action.implementationPlan.weeklyPractice = pastedRun;
    writeJsonFile(sectionPath("money-book", 1, "summary-pack", roots), summary);
    writeJsonFile(sectionPath("money-book", 1, "action-pack", roots), action);

    const report = checkSectionGate("money-book", roots, { chapters: [1], sections: ["summary-pack", "action-pack"] });
    assert.equal(report.passed, false, "source-note paste should block before assembly/QC");
    assert.ok(report.findings.some((f) => f.checkId === "SEC91.source_paste" && f.section === "summary-pack" && f.path === "/breakdown/fullRead"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
    assert.ok(report.findings.some((f) => f.checkId === "SEC91.source_paste" && f.section === "action-pack" && f.path === "/implementationPlan/weeklyPractice"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
    assert.equal(report.findings.some((f) => f.checkId === "SEC91.sidecar_unavailable"), false, "a present/readable sidecar must not raise SEC91.sidecar_unavailable");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate fails closed with SEC91.sidecar_unavailable when a reported chapter's source sidecar is missing/stale", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-sidecar-unavailable-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  // Points at a run dir sidecar that was never written here (simulates a moved/renamed run dir).
  const staleSidecarPath = resolve(stateRoot, "sidecars", "source", "ch01.source.json");
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), [chapter()]);
    writeJsonFile(sourcePacketPath("money-book", 1, roots), { ...fx.packet, sourceSidecarPath: staleSidecarPath });
    writeJsonFile(blueprintPath("money-book", 1, roots), fx.blueprint);
    writeJsonFile(sectionPath("money-book", 1, "summary-pack", roots), fx.summary);

    const report = checkSectionGate("money-book", roots, { chapters: [1], sections: ["summary-pack"] });
    assert.equal(report.passed, false, "an unreadable SEC91 sidecar on a reported chapter must fail-closed, not silently pass");
    assert.ok(
      report.findings.some((f) => f.checkId === "SEC91.sidecar_unavailable" && f.chapterNumber === 1 && f.section === "summary-pack"),
      report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
    );
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

// R-041 — SEC91.sidecar_unavailable says the source-paste check could not RUN; it says
// nothing about pack CONTENT. Assembly must not gate on it, and before this both
// assembleSections paths exempted it by hardcoding its checkId string
// (assembleSections.ts:239, :305) while the report itself still called the run a BLOCK
// with no way to tell the two conditions apart. The report now carries the distinction:
// `environmental` on the finding and `contentPassed` on the report. `passed` is
// deliberately unchanged — validate-sections' exit code still fails closed on it.
test("v23 section gate reports an unrunnable-check blocker as environmental, separate from content", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-sidecar-environmental-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const staleSidecarPath = resolve(stateRoot, "sidecars", "source", "ch01.source.json");
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), [chapter()]);
    writeJsonFile(sourcePacketPath("money-book", 1, roots), { ...fx.packet, sourceSidecarPath: staleSidecarPath });
    writeJsonFile(blueprintPath("money-book", 1, roots), fx.blueprint);
    writeJsonFile(sectionPath("money-book", 1, "summary-pack", roots), fx.summary);

    const report = checkSectionGate("money-book", roots, { chapters: [1], sections: ["summary-pack"] });
    const sidecar = report.findings.filter((f) => f.checkId === "SEC91.sidecar_unavailable");
    assert.equal(sidecar.length, 1, report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
    assert.equal(sidecar[0].severity, "blocker", "validate-sections must keep failing closed on a missing sidecar");
    assert.equal(sidecar[0].environmental, true, "an unrunnable check is an environment condition, not invalid content");
    assert.equal(report.passed, false, "the run is still a BLOCK: the check did not run");
    assert.equal(report.contentPassed, true, "no CONTENT blocker was found, and the report must say so");
    assert.deepEqual(report.findings.filter((f) => f.severity === "blocker" && !f.environmental), []);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

// R-041 — the other half: a real content blocker is NOT environmental, so contentPassed
// falls with it and assembly stays blocked.
test("v23 section gate reports a content blocker as non-environmental and drops contentPassed", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-content-blocker-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), [chapter()]);
    writeJsonFile(sourcePacketPath("money-book", 1, roots), fx.packet);
    writeJsonFile(blueprintPath("money-book", 1, roots), fx.blueprint);
    const summary = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
    summary.chapterId = "money-book-ch99";
    writeJsonFile(sectionPath("money-book", 1, "summary-pack", roots), summary);

    const report = checkSectionGate("money-book", roots, { chapters: [1], sections: ["summary-pack"] });
    const contentBlockers = report.findings.filter((f) => f.severity === "blocker" && !f.environmental);
    assert.ok(contentBlockers.length > 0, report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
    assert.equal(report.contentPassed, false);
    assert.equal(report.passed, false);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects hard-banned register phrases before ChapterV21 assembly", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-hard-ban-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), [chapter()]);
    writeJsonFile(sourcePacketPath("money-book", 1, roots), fx.packet);
    writeJsonFile(blueprintPath("money-book", 1, roots), fx.blueprint);

    const summary = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
    summary.breakdown.deepRead = `${summary.breakdown.deepRead}\n\nThe trap is to trust the first impressive number and stop.`;
    writeJsonFile(sectionPath("money-book", 1, "summary-pack", roots), summary);

    const report = checkSectionGate("money-book", roots, { chapters: [1], sections: ["summary-pack"] });
    assert.equal(report.passed, false, "hard-banned register phrases should block before assembly/QC");
    assert.ok(report.findings.some((f) => f.checkId === "SEC92.hard_banned_phrase" && f.path === "/breakdown/deepRead"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate mirrors BP13 two-content-token example phrase drift", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-bp13-two-token-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      pack.examples[0].scenario = `${bp.sections.examples[0].allowedNames[0]} reviews the account page and pauses before approving the purchase. The record is incomplete, so the next action is to check the visible balance before sending money.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "BP13-style two-content-token phrase drift should block before assembly");
    assert.ok(report.findings.some((f) => f.checkId === "SEC89.example_cross_chapter_literal_ngram"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate blocks book-gate BP13 two-content-token connective drift", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-bp13-connective-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      pack.examples[0].whyItMatters = `${bp.sections.examples[0].allowedNames[0]}'s choice follows the stake-fit rule because a borrowed tactic loses force when it is detached from the participant's real concern.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "book-gate BP13 two-content-token connective drift should block before assembly");
    assert.ok(
      report.findings.some((f) => f.checkId === "SEC89.example_cross_chapter_literal_ngram" && f.message.includes("stake-fit rule because a")),
      report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
    );
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects example venue stamping before book-gate", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-venue-stamp-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      const name = bp.sections.examples[0].allowedNames[0];
      pack.examples[0].scenario = ch.chapterNumber === 1
        ? `${name} sits at the kitchen table before breakfast and compares the card balance with the cash plan. The choice is whether to make a small early payment or leave the visible signal noisy.`
        : ch.chapterNumber === 2
          ? `${name} moves a mug across the kitchen table while a payment reminder opens. The decision is whether to lower utilization now or trust the due date alone.`
          : `${name} opens the app at the kitchen table after dinner and catches a balance that may be reported soon. The recovery is to pay a small amount before the signal travels.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "third use of a venue should block before assembly");
    assert.ok(report.findings.some((f) => f.checkId === "SEC93.example_venue_stamping"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects repeated tryThisNow openers before book-gate", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-try-opener-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = JSON.parse(JSON.stringify(fx.action)) as ActionPackV1;
      pack.chapterId = bp.chapterId;
      pack.tryThisNow = ch.chapterNumber === 1
        ? "Before you send your next reply, check the visible balance and name the useful payment."
        : "Before you send your next reply, write the visible balance and choose one small adjustment.";
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "action-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [2], sections: ["action-pack"] });
    assert.equal(report.passed, false, "repeated tryThisNow opener should block before assembly");
    assert.ok(report.findings.some((f) => f.checkId === "SEC94.action_try_this_now_opener_reuse"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate mirrors selected-batch B13 summary hook first-word clustering", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-hook-first-word-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 5 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Money Chapter ${i + 1}`,
  }));
  const hooks = [
    "At payday, Maya opens her card app before payday and sees the balance that a lender might see first.",
    "Before payday, Maya opens her card app and catches the balance that a lender might see first.",
    "At the counter, Maya opens her card app before payday and sees the balance that a lender might see first.",
    "Maya opens her card app before payday and sees the balance that a lender might see first.",
    "At the bus stop, Maya opens her card app before payday and sees the balance that a lender might see first.",
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
      pack.chapterId = bp.chapterId;
      pack.hook.hook = hooks[ch.chapterNumber - 1];
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "summary-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4, 5], sections: ["summary-pack"] });
    assert.equal(report.passed, false, "B13-equivalent hook first-word clustering should block before QC");
    assert.ok(report.findings.some((f) => f.checkId === "SEC95.summary_hook_first_word_clustering"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate checks summary cross-chapter n-grams in fast/deep/full tiers", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-summary-tier-ngram-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
  ];
  const repeatedDeepRead = Array.from({ length: 120 }, (_, i) => `signalword${i}`).join(" ");
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneSummary(fx.summary);
      pack.chapterId = bp.chapterId;
      pack.breakdown.fastRead = `${ch.chapterTitle}. ${pack.breakdown.fastRead}`;
      pack.breakdown.deepRead = `${ch.chapterTitle} starts differently. ${repeatedDeepRead} ${ch.chapterNumber === 1 ? "first ending" : "second ending"}.`;
      pack.breakdown.fullRead = `${ch.chapterTitle}. ${pack.breakdown.fullRead}`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "summary-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2], sections: ["summary-pack"] });
    assert.equal(report.passed, false, "repeated deepRead prose should block before deterministic QC");
    assert.ok(
      report.findings.some((f) => f.checkId === "SEC83.summary_cross_chapter_ngram" && f.path === "/breakdown/deepRead"),
      report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
    );
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate mirrors QC AS10 summary literal-window threshold", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-summary-as10-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  const shared = "practical pattern recognition changes what people notice before the ordinary middle returns";
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneSummary(fx.summary);
      pack.chapterId = bp.chapterId;
      pack.breakdown.fastRead = `${ch.chapterTitle} opens differently. ${shared}. ${pack.breakdown.fastRead}`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "summary-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [3], sections: ["summary-pack"] });
    assert.equal(report.passed, false, "third chapter with a repeated summary literal window should block before QC");
    assert.ok(
      report.findings.some((f) => f.checkId === "SEC83.summary_cross_chapter_ngram" && f.message.includes("verbatim 5-token")),
      report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
    );
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 summary-pack validator rejects final-gate readability and run-on opener failures", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
  bad.hook.counterintuition = "The obvious shortcut is to trust the label: balance, payment, utilization, account age. The harder rule is to test what lenders can see.";
  bad.breakdown.fastRead = long("Visible-balance optimization requires disciplined utilization management before the lender-facing reporting snapshot, because otherwise interpretive account information remains noisy.", 10);
  bad.breakdown.fullRead = "Short full read.";

  const findings = validateSummaryPack(bad, fx.blueprint, fx.packet);
  assert.ok(findings.some((f) => f.checkId === "SEC11.summary_sentence_sanity" && f.severity === "blocker"), findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  assert.ok(findings.some((f) => f.checkId === "SEC12.summary_readability" && f.severity === "blocker"), findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  assert.ok(findings.some((f) => f.checkId === "SEC6.breakdown_length" && f.path === "/breakdown/fullRead" && f.severity === "blocker"), findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
});

test("v23 memorable-line selector rejects checklist, category, and dependent-fragment lines", () => {
  assert.equal(memorableLineScore("Balance sheets, earnings, and catalysts must support the claim before an active choice deserves a place."), 0);
  assert.equal(memorableLineScore("The main categories are large unpopular companies, bargain issues, and special situations."), 0);
  assert.equal(memorableLineScore("If not, the situation may only be complex."), 0);
  assert.equal(memorableLineScore("Do you need lift, a new understanding, earned pride, or stronger connection?"), 0);
  assert.equal(memorableLineScore("Ask whether the signal should be shared, private, immediate, or delayed."), 0);
  assert.equal(memorableLineScore("Keep the move only if it changes attention, meaning, or memory."), 0);
  assert.ok(memorableLineScore("A bargain is not a low price but a tested discount.") > 0);
  assert.ok(memorableLineScore("A special situation is not complexity but value with a path.") > 0);
});

test("v23 summary-pack validator rejects named-case anchors without hard specifics in breakdown", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
  const namedCaseAnchor = fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("example"))?.id;
  assert.ok(namedCaseAnchor, "fixture should expose a named-example anchor");
  bad.breakdown.sourceAnchorIds ??= {};
  bad.breakdown.sourceAnchorIds.fullRead = [namedCaseAnchor];

  const findings = validateSummaryPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC14.summary_anchor_specifics" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 summary-pack validator rejects keyTakeaway over the final A14 word cap", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
  bad.keyTakeaway = "Treat the visible credit signal as a practical input that should be checked before payment timing, cash comfort, reward points, lender review, familiar account habits, and reassuring intentions can distract the borrower.";

  const findings = validateSummaryPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC18.takeaway_word_cap" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 learning-pack validator rejects absolute-trigger strawman distractors", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  const q = bad.quiz.questions[0];
  const wrong = (q.correctIndex + 1) % q.choices.length;
  q.choices[wrong] = "They let the balance disappear completely";

  const findings = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.ok(findings.some((f) => f.checkId === "SEC52.quiz_strawman_distractor" && f.severity === "blocker"), findings.map((f) => f.checkId).join(", "));
});

test("v23 learning-pack validator rejects telegraphed correct-answer length", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  const q = bad.quiz.questions[0];
  q.choices[q.correctIndex] = "Check the lender visible balance before the reporting snapshot so utilization shows the behavior you want lenders to read";
  for (const [i] of q.choices.entries()) {
    if (i !== q.correctIndex) q.choices[i] = i === 0 ? "Check the visible balance" : "Set a reminder";
  }

  const findings = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.ok(findings.some((f) => f.checkId === "SEC53.quiz_answer_length_balance" && f.severity === "blocker"), findings.map((f) => f.checkId).join(", "));
});

test("v23 learning-pack validator rejects character-length answer tells", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  const q = bad.quiz.questions[0];
  q.choices = [
    "A familiar company feels safe",
    "Bonds seem too dull today",
    "When diversification and quality tests pass",
  ];
  q.correctIndex = 2;

  const findings = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.ok(findings.some((f) => f.checkId === "SEC53.quiz_answer_length_balance" && f.severity === "blocker"), findings.map((f) => f.checkId).join(", "));
});

test("v23 learning-pack validator accepts balanced non-strawman choices", () => {
  const fx = compileFixture();
  const findings = validateLearningPack(fx.learning, fx.blueprint, fx.packet);
  assert.ok(!findings.some((f) => f.checkId === "SEC52.quiz_strawman_distractor" || f.checkId === "SEC53.quiz_answer_length_balance"), findings.map((f) => f.checkId).join(", "));
  assert.equal(findings.filter((f) => f.severity === "blocker").length, 0);
});

test("v23 learning-pack validator rejects repeated quiz explanation skeletons", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  for (const q of bad.quiz.questions) {
    q.explanation = "The source fact says the correct answer applies the rule while the other options avoid it.";
  }

  const findings = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC54.quiz_repeated_skeleton" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 learning-pack validator rejects repeated within-chapter quiz prompt phrases", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  bad.quiz.questions[0].prompt = "A planner repeats the same named source detail before choosing a local action.";
  bad.quiz.questions[1].prompt = "A coach repeats the same named source detail before choosing a local action.";

  const findings = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC107.quiz_prompt_ngram_reuse" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 learning-pack validator rejects generated quiz choice proof tails", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  const q = bad.quiz.questions[0];
  const wrong = (q.correctIndex + 1) % q.choices.length;
  q.choices[wrong] = "Trust the same first impression. under the stated evidence test";

  const findings = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC59.quiz_mechanical_tail" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 learning-pack validator rejects missing quiz metadata before assembly", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  delete (bad.quiz.questions[0] as any).bloomsLevel;
  delete (bad.quiz.questions[0] as any).depthLevel;

  const findings = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC125.quiz_metadata" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 section gate rejects repeated quiz choice proof tails across generated chapters", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-quiz-tail-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneLearning(fx.learning);
      pack.chapterId = bp.chapterId;
      for (const [i, q] of pack.quiz.questions.entries()) {
        q.correctIndex = bp.sections.quiz[i].correctIndex;
        q.choices = [
          "Change the visible account signal before the snapshot",
          "Delay the payment timing until the bill feels settled",
          "Compare unrelated card perks before reading the balance",
        ];
        const wrong = (q.correctIndex + 1) % q.choices.length;
        q.choices[wrong] = "Trust the same first impression. under the available evidence signal";
      }
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "learning-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3], sections: ["learning-pack"] });
    assert.equal(report.passed, false, "three generated chapters with the same quiz choice tail should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC86.quiz_repeated_choice_tail"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects book-wide quiz n-gram template repeats before book-gate", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-quiz-ngram-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 5 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneLearning(fx.learning);
      pack.chapterId = bp.chapterId;
      pack.quiz.questions[0].correctIndex = bp.sections.quiz[0].correctIndex;
      pack.quiz.questions[0].explanation = "The red phone by the pool and free popsicles on a silver tray are being repeated as a template.";
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "learning-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4, 5], sections: ["learning-pack"] });
    assert.equal(report.passed, false, "five generated chapters with the same long quiz phrase should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC126.quiz_cross_chapter_ngram"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 learning-pack validator rejects anchors that cannot support quiz claim types", () => {
  const fx = compileFixture();
  const bad = cloneLearning(fx.learning);
  const conceptAnchor = fx.packet.allowedAnchors.find((a) => a.kind === "concept")?.id;
  assert.ok(conceptAnchor, "fixture should expose a concept anchor");
  bad.quiz.questions[0].sourceAnchorIds = [conceptAnchor];
  bad.quiz.questions[0].keyEvidenceAnchorIds = [conceptAnchor];

  const findings = validateLearningPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC55.quiz_anchor_claim_type" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 action-pack validator rejects bare venue contexts", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.action)) as ActionPackV1;
  bad.implementationPlan.ifThenPlans[0].context = "kitchen table";

  const findings = validateActionPack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC67.ifthen_context_trigger" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 action-pack validator rejects anchors that cannot support implementation guidance", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.action)) as ActionPackV1;
  const packet = JSON.parse(JSON.stringify(fx.packet)) as typeof fx.packet;
  const actionAnchorId = bad.implementationPlan.ifThenPlans[0]?.sourceAnchorIds?.[0];
  assert.ok(actionAnchorId, "fixture should expose an action anchor id");
  const anchor = packet.allowedAnchors.find((a) => a.id === actionAnchorId);
  assert.ok(anchor, "fixture should expose the action anchor");
  anchor.supportsClaimTypes = anchor.supportsClaimTypes.filter((claim) => claim !== "implementation_guidance");

  const findings = validateActionPack(bad, fx.blueprint, packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC73.action_anchor_claim_type" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 section gate rejects repeated action coreSkill closing sentences across generated chapters", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-action-closer-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = JSON.parse(JSON.stringify(fx.action)) as ActionPackV1;
      pack.chapterId = bp.chapterId;
      pack.implementationPlan.coreSkill = `Chapter ${ch.chapterNumber} has its own opening practice for the visible credit signal. Use a written checkpoint so the decision can be repeated under pressure.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "action-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3], sections: ["action-pack"] });
    assert.equal(report.passed, false, "three generated chapters with the same coreSkill closer should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC84.action_repeated_core_skill_closer"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated social-pressure evidence-pause if-then shells", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-social-pressure-pause-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
    { chapterId: "money-book-ch04", chapterNumber: 4, chapterTitle: "Keep The Signal Clean" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = JSON.parse(JSON.stringify(fx.action)) as ActionPackV1;
      pack.chapterId = bp.chapterId;
      pack.implementationPlan.ifThenPlans[0] = {
        context: `When social pressure pushes chapter ${ch.chapterNumber} toward a flashy shortcut`,
        plan: `If social pressure pushes chapter ${ch.chapterNumber} toward a flashy shortcut, then pause for evidence first. Check the visible balance and account information before approving the move.`,
        sourceAnchorIds: pack.implementationPlan.ifThenPlans[0].sourceAnchorIds,
      };
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "action-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4], sections: ["action-pack"] });
    assert.equal(report.passed, false, "four generated chapters reusing the social-pressure evidence-pause if-then shell should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC115.action_social_pressure_pause_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects repeated generic example action containers across generated chapters", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-example-container-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  const openers = [
    "At the kitchen table",
    "During a benefits review",
    "Before a short planning call",
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
      pack.chapterId = bp.chapterId;
      pack.examples = bp.sections.examples.map((slot, i) => {
        const protagonist = slot.allowedNames[0] ?? bp.reservedVariety.allowedNames[i % bp.reservedVariety.allowedNames.length] ?? "Maya";
        const caseId = slot.requiredCaseIds[0] ?? fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("example"))?.id ?? fx.packet.allowedAnchors[0].id;
        return {
          exampleId: `ex${String(i + 1).padStart(2, "0")}`,
          slotId: slot.slotId,
          title: `Visible Balance Review ${i + 1}`,
          scenario: i === 0
            ? `${openers[ch.chapterNumber - 1]}, ${protagonist} opens a budget app and chooses whether to pay before the balance becomes visible. The choice is concrete: compare credit reports and lenders use account information before treating a high utilization signal as harmless.`
            : `${protagonist} reviews a payment note before buying a familiar fund and chooses whether the visible balance is clean enough to send. The decision is concrete: compare the 300 to 850 scale, credit utilization, and account information before money leaves the account.`,
          whatToDo: "Write the visible balance, the familiar label, and the smallest next check in separate lines before deciding.",
          whyItMatters: "The action works because credit reports and lenders use account information, so the reader has to inspect the signal instead of trusting a label.",
          sourceAnchorIds: [caseId],
          sourceFactIds: [slot.requiredFactIds[0] ?? fx.packet.facts[0].id],
          namedCaseIds: [caseId],
        };
      });
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "three generated chapters reusing budget app as a scene container should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC85.example_repeated_action_container"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects repeated investment document scene containers across generated chapters", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-document-container-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      const name = bp.sections.examples[0].allowedNames[0];
      pack.examples[0].scenario = `${name} opens the prospectus packet before buying a familiar fund and chooses whether the visible balance is clean enough to send. The decision is concrete: compare the 300 to 850 scale, credit utilization, and account information before money leaves the account.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "three chapters using prospectus packet as a scene container should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC85.example_repeated_action_container"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects repeated document shortcut repair scene frames across generated chapters", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-document-frame-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      const name = bp.sections.examples[0].allowedNames[0];
      pack.examples[0].scenario = `${name} drags the allocation worksheet back from the signed pile after the old default fails in public. The repair is concrete: compare the 300 to 850 scale, credit utilization, and account information before money leaves the account.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "three chapters using the document-shortcut-repair frame should block");
    assert.ok(report.findings.some((f) => f.message.includes("document plus shortcut/default repair frame")), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects repeated shortcut/default failure scene frames across generated chapters", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-shortcut-frame-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      const name = bp.sections.examples[0].allowedNames[0];
      pack.examples[0].scenario = `${name} begins with the old default already failing: approve the familiar account, ignore the report timing, and clean up the details later. The review changes the action before money moves because the 300 to 850 scale, credit utilization, credit reports, and lenders use account information all point to the same visible-balance decision.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "three chapters using the shortcut/default-failure frame should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC96.example_shortcut_default_failure_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects repeated decides-after-not-before example closers across generated chapters", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-decides-after-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      const name = bp.sections.examples[0].allowedNames[0];
      pack.examples[0].scenario = `${name} checks a proposed purchase while another person waits for a yes-or-no answer. The page uses the 300 to 850 scale and credit utilization to decide whether the visible balance is clean enough before money moves. ${name} decides after credit utilization, not before.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "three chapters using the decides-after-not-before closer should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC97.example_decides_after_not_before_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated pending-until evidence-gate example endings", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-pending-until-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 6 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      const name = bp.sections.examples[0].allowedNames[0];
      pack.examples[0].scenario = `${name} compares the proposed purchase with the 300 to 850 scale and credit utilization before money moves. The purchase remains under review until credit reports and lenders use account information show the visible balance is clean enough.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4, 5, 6], sections: ["example-pack"] });
    assert.equal(report.passed, false, "six chapters using pending/until evidence gates should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC98.example_pending_until_evidence_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated partial-answer next-action example endings", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-partial-next-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 5 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      const name = bp.sections.examples[0].allowedNames[0];
      pack.examples[0].scenario = `${name} checks the account against the 300 to 850 scale and credit utilization while another person waits for an answer. The answer is only partial: the balance looks cleaner, but the next action is review, not approval, until credit reports and lenders use account information are checked.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4, 5], sections: ["example-pack"] });
    assert.equal(report.passed, false, "five chapters using partial-answer next-action endings should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC100.example_partial_next_action_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated waiting-answer example scene shells", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-waiting-answer-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 5 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  const openers = [
    "Near the ferry turnstile",
    "Before the clinic door opens",
    "After the register drawer closes",
    "Under the stairwell light",
    "Beside the mailroom counter",
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      const name = bp.sections.examples[0].allowedNames[0];
      pack.examples[0].scenario = `${openers[ch.chapterNumber - 1]}, ${name} compares the 300 to 850 scale with credit utilization while another person waits for a yes-or-no answer. The decision is concrete: lower the visible balance before credit reports and lenders use account information.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4, 5], sections: ["example-pack"] });
    assert.equal(report.passed, false, "five chapters using waiting-answer vignettes should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC101.example_waiting_answer_scene_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated pending-template action units", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-action-pending-template-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 5 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneAction(fx.action);
      pack.chapterId = bp.chapterId;
      pack.implementationPlan.twentyFourHourChallenge = `Before review ${ch.chapterNumber}, open the saved template and add blanks for the 300 to 850 scale and credit utilization. Keep the idea pending until each blank has evidence from credit reports and lenders use account information.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "action-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4, 5], sections: ["action-pack"] });
    assert.equal(report.passed, false, "five chapters using blank-template pending action units should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC102.action_pending_template_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated broad-process versus one-focused-point example frames", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-broad-process-one-point-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 5 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      const slot = bp.sections.examples[4];
      const name = slot.allowedNames[0] ?? bp.reservedVariety.allowedNames[4] ?? "Maya";
      const caseId = slot.requiredCaseIds[0] ?? fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("example"))?.id ?? fx.packet.allowedAnchors[0].id;
      pack.examples[4] = {
        ...pack.examples[4],
        slotId: slot.slotId,
        scenario: `${name} is asked to improve the whole service routine before everyone leaves for the day. The entire process has small annoyances, but one loaded moment decides whether the customer remembers the experience: the final handoff after the visible balance is explained.`,
        whatToDo: "Choose one focused intervention at the final handoff instead of polishing every minute of the routine.",
        whyItMatters: "The decision works because the account information people see is the moment that shapes the next choice, not every decorative process detail.",
        sourceAnchorIds: [caseId],
        sourceFactIds: [slot.requiredFactIds[0] ?? fx.packet.facts[0].id],
        namedCaseIds: [caseId],
      };
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4, 5], sections: ["example-pack"] });
    assert.equal(report.passed, false, "five chapters using the broad-process/one-point frame should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC108.example_broad_process_one_point_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated pleasant-average versus peak-ending example shells", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-example-peak-average-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 5 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      const name = bp.sections.examples[5].allowedNames[0];
      pack.chapterId = bp.chapterId;
      pack.examples[5] = {
        ...pack.examples[5],
        scenario: `${name} reviews the service desk after customers say the average visit is pleasant but nobody remembers the ending. The decision is concrete: keep the average condition, or build one standout ending using the 300 to 850 scale and credit utilization as visible evidence. ${name} chooses the memorable ending before routine smoothness consumes the decision.`,
        whatToDo: "Separate the average condition from the memorable ending, then choose the bounded action with visible evidence from the 300 to 850 scale and credit utilization.",
        whyItMatters: "The choice works because reported utilization changes what the system can see, so the standout ending matters more than another pleasant average.",
      };
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: chapters.map((ch) => ch.chapterNumber), sections: ["example-pack"] });
    assert.equal(report.passed, false, "five chapters using the pleasant-average/peak-ending shell should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC112.example_pleasant_average_peak_end_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated classify-opportunity choose-lever action challenges", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-action-classify-lever-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 4 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneAction(fx.action);
      pack.chapterId = bp.chapterId;
      pack.implementationPlan.twentyFourHourChallenge = `In the next day, choose one transition, milestone, or pit, pick the strongest lever for elevation, insight, pride, or connection, and write the attention, meaning, memory, or social interpretation shift you expect.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "action-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4], sections: ["action-pack"] });
    assert.equal(report.passed, false, "four chapters using the classify/lever/predict practice shell should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC109.action_classify_lever_practice_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated 24-hour challenge opener shells", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-action-challenge-opener-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 4 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneAction(fx.action);
      pack.chapterId = bp.chapterId;
      pack.implementationPlan.twentyFourHourChallenge = `Before tomorrow ends, run chapter ${ch.chapterNumber}'s practice form, record the proof point, and choose the next action.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "action-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4], sections: ["action-pack"] });
    assert.equal(report.passed, false, "four chapters using the same 24-hour challenge opener should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC114.action_challenge_opener_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

// R-020 — SEC114 used to need FOUR chapters sharing a signature, and it built that
// signature from the first three words INCLUDING the time box, so two phrasings of the
// same deadline ("Inside the next 24 hours" / "Within twenty-four hours") never grouped.
// A four-chapter book therefore had to be 100% uniform before anything fired, and even
// then only if every chapter spelled the time box the same way. Both halves are covered
// here: the openers below share their first three CONTENT words but not their time box,
// and only three of the four chapters carry the shell.
test("v23 section gate rejects a 24-hour challenge shell shared by three of four chapters across time-box phrasings", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-action-challenge-timebox-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 4 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  const challenges = [
    "Inside the next 24 hours, log one payment and name the account it protects.",
    "Within twenty-four hours, log one payment and name the balance it protects.",
    "Before tomorrow ends, log one payment and name the lender it protects.",
    "Take the statement you flagged this morning and read its fee line out loud to one other person.",
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneAction(fx.action);
      pack.chapterId = bp.chapterId;
      pack.implementationPlan.twentyFourHourChallenge = challenges[ch.chapterNumber - 1];
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "action-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4], sections: ["action-pack"] });
    const sec114 = report.findings.filter((f) => f.checkId === "SEC114.action_challenge_opener_saturation");
    assert.deepEqual(
      sec114.map((f) => f.chapterNumber).sort((a, b) => Number(a) - Number(b)),
      [1, 2, 3],
      report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
    );
    assert.equal(report.passed, false);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

// R-020 control — a chapter whose challenge simply happens to start with a time box must
// keep its own signature once the box is stripped, so unrelated moves never collide.
test("v23 section gate keeps distinct 24-hour challenges apart after the time box is stripped", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-action-challenge-timebox-ok-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 4 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  const challenges = [
    "Inside the next 24 hours, send one owner handoff note for a commitment you already made.",
    "Before you go to bed tonight, write your one exact sentence at the top of a blank page.",
    "Take the pitch from your two-minute audit and say it twice today to two different people.",
    "Before the day ends, run one stakeholder interview about your most-stalled ask.",
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneAction(fx.action);
      pack.chapterId = bp.chapterId;
      pack.implementationPlan.twentyFourHourChallenge = challenges[ch.chapterNumber - 1];
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "action-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4], sections: ["action-pack"] });
    assert.deepEqual(report.findings.filter((f) => f.checkId === "SEC114.action_challenge_opener_saturation"), []);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects saturated classify-opportunity choose-lever coreSkill units", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-action-classify-lever-core-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = Array.from({ length: 4 }, (_, i) => ({
    chapterId: `money-book-ch${String(i + 1).padStart(2, "0")}`,
    chapterNumber: i + 1,
    chapterTitle: `Chapter ${i + 1}`,
  }));
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneAction(fx.action);
      pack.chapterId = bp.chapterId;
      pack.implementationPlan.coreSkill = `Choose one transition, milestone, or pit, pick whether elevation, insight, pride, or connection is the strongest lever, and write the attention, meaning, memory, or social interpretation shift you expect.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "action-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3, 4], sections: ["action-pack"] });
    assert.equal(report.passed, false, "four coreSkill units using the classify/lever/predict shell should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC109.action_classify_lever_practice_saturation"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects requested fields that exceed soft-banned phrase budgets", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-soft-ban-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
      pack.chapterId = bp.chapterId;
      pack.keyTakeaway = "The reader treats it as a visible credit signal before choosing payment timing, reward comfort, or a familiar account habit.";
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "summary-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [3], sections: ["summary-pack"] });
    assert.equal(report.passed, false, "validating only ch3 should still count context chapters against soft-ban budgets");
    assert.ok(report.findings.some((f) => f.checkId === "SEC90.soft_banned_budget"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 example-pack validator rejects source-label prop scaffolding before QC", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  bad.examples[0] = {
    ...bad.examples[0],
    title: "Ledger card reviews FICO score range",
    scenario: "Elodie tilts a ledger card beside the north alcove; the amber ledger separates the page toward a level tablet. The northseal stays closed. She keeps moving the prop from one side of the desk to the other, but no borrower makes a decision and no credit-card tradeoff changes in the room.",
    whatToDo: "Compare 300 to 850 FICO score range beside credit utilization; settle lender-visible risk.",
    whyItMatters: "The source label is being used as set dressing instead of driving a human decision.",
  };

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC30.example_source_label_prop" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("SEC52 allows prose-grounded absolutes; gratuitous strawmen still block (Franklin virtues class)", () => {
  // The virtues chapter's own claims are absolutes ("never arrived at the
  // perfection", the speckled-axe man giving up entirely). Five distractors
  // across three consecutive live drafts blocked on echoing them. A distractor
  // using an absolute the drafted prose ITSELF uses is the chapter's real
  // tension phrased as a plausible misreading — not a fabricated strawman.
  const fx = compileFixture();
  const pack = JSON.parse(JSON.stringify(fx.learning)) as LearningPackV1;
  const q = pack.quiz.questions[0];
  const distractor = q.choices.findIndex((_, idx) => idx !== q.correctIndex);
  q.choices[distractor] = "Because a flawless record is impossible, tracking faults is pointless and the plan should be dropped.";

  const prose = cloneSummary(fx.summary);
  prose.breakdown.deepRead = `${prose.breakdown.deepRead} He found a flawless record impossible, yet the tally still thinned the marks week by week.`;
  assert.deepEqual(
    validateLearningPack(pack, fx.blueprint, fx.packet, prose)
      .filter((f) => f.checkId === "SEC52.quiz_strawman_distractor").map((f) => f.message),
    [],
    "an absolute the prose itself uses is plausible, not a strawman",
  );

  // Same distractor with prose that never uses the absolute: still blocked.
  assert.ok(
    validateLearningPack(pack, fx.blueprint, fx.packet, fx.summary)
      .some((f) => f.checkId === "SEC52.quiz_strawman_distractor"),
    "a gratuitous absolute still blocks",
  );

  // Legacy callers (no prose): strict behavior preserved.
  assert.ok(
    validateLearningPack(pack, fx.blueprint, fx.packet)
      .some((f) => f.checkId === "SEC52.quiz_strawman_distractor"),
    "absent prose keeps the strict gate",
  );
});

test("SEC107 does not count a required hardSpecific as prompt-template reuse", () => {
  // SEC56 pre-lists anchor hardSpecifics as REQUIRED VERBATIM per slot; an
  // 8+-word specific ("seven columns for the days of the week") shared by two
  // slots citing the same anchor is a source fact, not boilerplate. Live: two
  // prompts carrying the required phrase blocked three consecutive drafts.
  const fx = compileFixture();
  const pack = JSON.parse(JSON.stringify(fx.learning)) as LearningPackV1;
  const packet = JSON.parse(JSON.stringify(fx.packet)) as SourcePacketV1;
  const anchor = packet.allowedAnchors[0];
  anchor.hardSpecifics = [...(anchor.hardSpecifics ?? []), "seven ruled columns for the days of the week"];
  pack.quiz.questions[0].prompt = "The plan drew seven ruled columns for the days of the week. Which habit does the layout make visible first?";
  pack.quiz.questions[1].prompt = "A page with seven ruled columns for the days of the week greets each morning. What decision does it force?";
  assert.deepEqual(
    validateLearningPack(pack, fx.blueprint, packet)
      .filter((f) => f.checkId === "SEC107.quiz_prompt_ngram_reuse").map((f) => f.message),
    [],
    "a shared required source token is not template reuse",
  );

  // Non-source 8-grams shared across prompts still block.
  const templated = JSON.parse(JSON.stringify(fx.learning)) as LearningPackV1;
  templated.quiz.questions[0].prompt = "Before the quarterly budget review meeting starts downtown tonight, which signal should a careful borrower inspect first?";
  templated.quiz.questions[1].prompt = "Before the quarterly budget review meeting starts downtown tonight, which balance does the lender actually read?";
  assert.ok(
    validateLearningPack(templated, fx.blueprint, fx.packet)
      .some((f) => f.checkId === "SEC107.quiz_prompt_ngram_reuse"),
    "boilerplate reuse must still block",
  );
});

test("SEC49 accepts a card front ending in a quoted question (Franklin self-examination class)", () => {
  // '…: "What good shall I do this day?"' is a genuine retrieval question; the
  // bare /\?\s*$/ rejected it because the final character is the closing quote.
  const fx = compileFixture();
  const quoted = JSON.parse(JSON.stringify(fx.learning)) as LearningPackV1;
  quoted.cards.cards[0].front = 'What question did the plan pose each morning: "What good shall I do this day?"';
  assert.deepEqual(
    validateLearningPack(quoted, fx.blueprint, fx.packet).filter((f) => f.checkId === "SEC49.card_front_question").map((f) => f.message),
    [],
    "a quoted question still ends a question",
  );
  const statement = JSON.parse(JSON.stringify(fx.learning)) as LearningPackV1;
  statement.cards.cards[0].front = "The plan posed a question each morning.";
  assert.ok(
    validateLearningPack(statement, fx.blueprint, fx.packet).some((f) => f.checkId === "SEC49.card_front_question"),
    "a statement front must still block",
  );
});

test("SEC26 flags the text-as-text, never a book as a world object (Franklin memorandum-book class)", () => {
  const fx = compileFixture();

  // World object: a literal book inside the scene must pass. This is the exact
  // shape from the live Franklin canary — the virtues chapter's example scenes
  // center on the memorandum book Franklin ruled and marked, and the old bare
  // \b(the book|the author)\b pattern blocked example 5 across three
  // consecutive drafts, killing a full compile slot (COMPILER_SECTION_BLOCKED).
  const worldObject = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  worldObject.examples[0].scenario += " Each evening she rules a fresh line in the book and marks the day's fault in the book before closing it.";
  const worldFindings = validateExamplePack(worldObject, fx.blueprint, fx.packet);
  assert.deepEqual(
    worldFindings.filter((f) => f.checkId === "SEC26.example_meta").map((f) => f.message),
    [],
    "a book as a world object is not a meta-reference",
  );

  // Physical record-keeping verbs are NOT discourse (audit-confirmed residue):
  // the memorandum book showing marks / opening to a page / telling her where
  // the day went is world-object narration — the virtues chapter's payoff prose.
  const recordKeeping = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  recordKeeping.examples[0].scenario += " By Saturday the book shows only two black marks, and each night the book tells her where the day went as the book opens to the ruled page.";
  assert.deepEqual(
    validateExamplePack(recordKeeping, fx.blueprint, fx.packet)
      .filter((f) => f.checkId === "SEC26.example_meta").map((f) => f.message),
    [],
    "shows/opens/tells on a physical book are record-keeping, not the text-as-text",
  );

  // Discourse construction IS the meta-reference: still a blocker.
  const discourse = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  discourse.examples[0].whyItMatters += " The book argues that visible balances drive lender decisions.";
  assert.ok(
    validateExamplePack(discourse, fx.blueprint, fx.packet)
      .some((f) => f.checkId === "SEC26.example_meta" && f.severity === "blocker"),
    "the text-as-text must still block",
  );

  // Chapter tokens stay strict — an invented modern scene has no chapter.
  const chapterMeta = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  chapterMeta.examples[0].whyItMatters += " As this chapter shows, the signal matters.";
  assert.ok(
    validateExamplePack(chapterMeta, fx.blueprint, fx.packet)
      .some((f) => f.checkId === "SEC26.example_meta" && f.severity === "blocker"),
    "chapter references remain blocked unconditionally",
  );
});

test("v23 example-pack validator rejects stock scene opener phrases before book-gate repeats", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  const name = fx.blueprint.sections.examples[0].allowedNames[0];
  bad.examples[0].scenario = `${name} is on a phone call with the card app open and chooses whether to pay a small amount before the balance becomes visible. The decision is concrete: leave the high utilization signal alone, or make the balance match the careful behavior ${name} already has.`;

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC36.example_stock_scene_opener" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 example-pack validator rejects synthetic stays-closed scene shells before QC sweep", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  const name = fx.blueprint.sections.examples[0].allowedNames[0];
  bad.examples[0].scenario = `${name} holds a client note beside the slate cabinet; the jasper anchor records the page toward a urban hinge. The slatefilter stays closed. ${name} decides whether to use the source as a prop or make a real credit-card decision with a visible balance, a 300 to 850 scale, and credit utilization in view.`;

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC37.example_synthetic_scene_shell" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 example-pack validator rejects final-gate C8 repeated five-word scenario phrases", () => {
  const fx = compileFixture();
  const bad = cloneExamples(fx.examples);
  for (const i of [0, 2, 4]) {
    const name = fx.blueprint.sections.examples[i].allowedNames[0];
    bad.examples[i].scenario = `${name} reads the investment advisers act of 1940 note before choosing whether the visible balance deserves a payment now. The decision is concrete: compare credit reports, lenders use account information, and credit utilization before trusting a comfortable label.`;
  }

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC87.example_intra_pack_ngram" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 example-pack validator rejects final-gate AS2 jammed proper nouns", () => {
  const fx = compileFixture();
  const bad = cloneExamples(fx.examples);
  const name = fx.blueprint.sections.examples[0].allowedNames[0];
  bad.examples[0].scenario = `${name} opens BrokerCheck before deciding whether a familiar adviser label should override the visible account evidence. The decision is concrete: compare credit reports, lenders use account information, and credit utilization before trusting a comfortable label.`;

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC88.example_jammed_proper_noun" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 example-pack validator rejects repeated example title grammar", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  for (const [i, ex] of bad.examples.entries()) {
    const name = fx.blueprint.sections.examples[i].allowedNames[0];
    ex.title = `${name} decision check`;
  }

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC38.example_title_shape_reuse" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 example-pack validator rejects book-id-prefixed example ids before assembly", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  bad.examples[0].exampleId = "money-book-ch01-ex01";

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC124.example_id_shape" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 example-pack validator rejects non-example anchors on examples", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  bad.examples[0].sourceAnchorIds = ["ch01.fact.1"];

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC32.example_anchor_claim_type" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 example-pack validator rejects named-case examples that omit hard specifics", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  bad.examples[0].scenario = "Maya stands at her kitchen table with the card app open and chooses whether to pay a small amount before the balance becomes visible. The decision is concrete: leave the signal alone, or make the balance match the careful behavior she already has.";
  bad.examples[0].whatToDo = "Open the account, identify the visible balance, and choose the smallest payment that changes the signal without breaking your cash plan.";
  bad.examples[0].whyItMatters = "The action works because account behavior is read as information, so a smaller visible balance can change what the system has to interpret.";

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC33.example_anchor_specifics" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("SEC33 counts a naturalized clipped specific — unit-side folding (Franklin pincer, run 26)", () => {
  // Sidecar specifics are telegraphic notes; the naturalize-into-sentences
  // pressure makes pasting them verbatim into narration non-viable. A specific
  // whose tokens appear IN ORDER within the bounded gap carries the full fact
  // and must count; the same tokens scattered beyond the gap must not.
  const fx = compileFixture();
  const pack = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  const ex = pack.examples[0];
  const caseId = (ex.sourceAnchorIds as string[])[0];
  const anchor = fx.packet.allowedAnchors.find((a) => a.id === caseId);
  assert.ok(anchor && (anchor.hardSpecifics ?? []).length >= 2, "fixture example must cite a specifics-rich case");
  const [first, second] = anchor!.hardSpecifics!;
  const naturalized = second.split(" ").join(" simply ");
  ex.scenario = `Maya reviews the ${first} at the kitchen table while the ${naturalized} note sits beside her, and she weighs one small payment against the visible number before the snapshot lands.`;
  ex.whatToDo = "Open the account page and choose the smallest payment that changes the visible signal without breaking the weekly cash plan.";
  ex.whyItMatters = "The action works because the visible number is what gets read, so a smaller balance changes what the reader of the report concludes.";
  const clean = validateExamplePack(pack, fx.blueprint, fx.packet)
    .filter((f) => f.checkId === "SEC33.example_anchor_specifics" && f.path === "/examples/0");
  assert.deepEqual(clean, [], "in-order tokens within the gap bound carry the fact");

  const scattered = second.split(" ").join(" one two three four five six seven eight nine ");
  ex.scenario = `Maya reviews the ${first} at the kitchen table while the ${scattered} note sits beside her, and she weighs one small payment against the visible number before the snapshot lands.`;
  const blocked = validateExamplePack(pack, fx.blueprint, fx.packet)
    .filter((f) => f.checkId === "SEC33.example_anchor_specifics" && f.path === "/examples/0");
  assert.equal(blocked.length, 1, "tokens scattered beyond the gap bound must still block");
});

test("v23 example-pack validator rejects whyItMatters lines that explain a neighboring source fact", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  bad.examples[0].whyItMatters = "The household reminder keeps the purchase routine orderly while a familiar source label feels reassuring enough to continue.";

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC39.example_why_fact_alignment" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("example task states that dealt staging fields are inhabited, never quoted verbatim", () => {
  const fx = compileFixture();
  const md = buildSectionTaskMarkdown({
    kind: "example-pack",
    bookId: "money-book",
    blueprint: fx.blueprint,
    sourcePacket: fx.packet,
    outputPath: "/tmp/examples.json",
    context: { bookScars: null, voiceCard: null },
    deliveryMode: "DIRECT_JSON",
  });
  assert.match(md, /STAGING DIRECTIONS/, "the staging rule must be stated");
  assert.match(md, /NEVER reproduce the dealt string verbatim/i);
});

test("SEC120 stands down when NO specific of a cited anchor reached the standalone tiers (Task 11an pincer)", () => {
  const fx = compileFixture();
  const anchored = fx.packet.allowedAnchors.find((a) => (a.hardSpecifics ?? []).length > 0);
  assert.ok(anchored, "fixture needs a specifics-bearing anchor");
  const spec = (anchored.hardSpecifics ?? [])[0]!;

  // Prose that mentions the case but carries NONE of its hardSpecifics in the
  // standalone tiers. SEC58 still compels the card to use one verbatim, so a
  // finding here would make the pair unsatisfiable and wedge the compile.
  const proseWithout = {
    hook: "A reader opens the page.",
    breakdown: {
      fastRead: "The chapter walks through the case without quoting its figures.",
      deepRead: "It explains the mechanism in plain terms and stops short of the numbers.",
      fullRead: `The long read finally states ${spec} in full.`,
    },
    keyTakeaway: "Act on the pattern, not the anecdote.",
  };
  const usingIt = JSON.parse(JSON.stringify(fx.learning)) as LearningPackV1;
  usingIt.cards.cards[0].back = `Remember ${spec} when you plan the week.`;
  usingIt.cards.cards[0].sourceAnchorIds = [anchored.id];

  const blocked = validateLearningPack(usingIt, fx.blueprint, fx.packet, proseWithout)
    .filter((f) => f.checkId === "SEC120.learning_prose_derivable");
  assert.deepEqual(blocked.map((f) => f.message), [], "unsatisfiable pair must not block");

  // Control: once ONE specific IS on the page the writer had a legal choice, so
  // reaching past it to a DIFFERENT off-page specific is still a finding.
  const others = (anchored.hardSpecifics ?? []).filter((x) => x !== spec);
  if (others.length > 0) {
    const proseWith = {
      ...proseWithout,
      breakdown: { ...proseWithout.breakdown, deepRead: `The deep read states ${spec} outright.` },
    };
    const reaching = JSON.parse(JSON.stringify(fx.learning)) as LearningPackV1;
    reaching.cards.cards[0].back = `Remember ${others[0]} when you plan the week.`;
    reaching.cards.cards[0].sourceAnchorIds = [anchored.id];
    const found = validateLearningPack(reaching, fx.blueprint, fx.packet, proseWith)
      .filter((f) => f.checkId === "SEC120.learning_prose_derivable");
    assert.ok(found.length > 0, "a satisfiable anchor still enforces derivability");
  }
});

test("every memorable line explains ITSELF — no boilerplate 'why' repeated across the book", () => {
  // Live AUDIT_FALSE_ATTESTATION: one hardcoded string sat in why for all 12
  // entries of a four-chapter book, and the book-pattern audit attested
  // literalSubstringGroups:0 with that string in its own input set. A reason
  // identical across every choice justifies nothing.
  const chapter = {
    breakdown: {
      fastRead: "You notice the default before you act on it. The cost shows up later when nobody is watching.",
      deepRead: "Do not wait for permission but decide what you will change before the week starts. A small practice beats a large intention every time.",
      fullRead: "When the signal arrives you already know which choice you rehearsed. Name the move you will make and the moment you will make it.",
    },
  } as unknown as Parameters<typeof selectMemorableLinesDeterministic>[0];

  const lines = selectMemorableLinesDeterministic(chapter);
  assert.ok(lines.length >= 2, "fixture must yield at least two lines");
  assert.equal(new Set(lines.map((l) => l.why)).size, lines.length, "each why must be distinct");
  for (const line of lines) {
    assert.doesNotMatch(line.why, /Selected deterministically/, "the boilerplate why must be gone");
    assert.match(line.why, /^From the (fastRead|deepRead|fullRead):/, "the why names the tier it came from");
    assert.match(line.why, /score \d+/, "the why reports the score that actually chose it");
  }
});

test("learning-pack task pre-lists each quiz slot's required verbatim specifics (Task 11z)", () => {
  const fx = compileFixture();
  const md = buildSectionTaskMarkdown({
    kind: "learning-pack",
    bookId: "money-book",
    blueprint: fx.blueprint,
    sourcePacket: fx.packet,
    outputPath: "/tmp/learning.json",
    context: { bookScars: { bookId: "money-book", phrases: [], frames: [], notes: [], prohibitions: [] }, voiceCard: null },
    deliveryMode: "DIRECT_JSON",
  });
  assert.match(md, /REQUIRED VERBATIM SPECIFICS BY QUIZ SLOT/, "preflight block missing");
  const anchored = fx.packet.allowedAnchors.filter((a) => (a.hardSpecifics ?? []).length > 0);
  assert.ok(anchored.length > 0, "fixture needs a specifics-rich anchor");
  for (const a of anchored) {
    for (const spec of a.hardSpecifics ?? []) {
      assert.ok(md.includes(`"${spec}"`), `missing specific ${spec}`);
    }
  }
  assert.match(md, /at least 1 of its case's specifics verbatim/i);
  assert.match(md, /into the prompt AND at least 1 into the explanation/i);
});

test("SEC12 assembled-ease blocker names per-tier eases and the lowest tier (Task 11s)", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
  const dense = " The institutionalization of habitual cognitive predispositions necessitates deliberate metacognitive intervention, notwithstanding considerable psychological resistance characteristically encountered.";
  bad.breakdown.fastRead = dense.repeat(3).trim();
  bad.breakdown.deepRead = dense.repeat(6).trim();
  bad.breakdown.fullRead = dense.repeat(14).trim();

  const findings = validateSummaryPack(bad, fx.blueprint, fx.packet);
  const assembled = findings.filter((f) => f.checkId === "SEC12.summary_readability" && f.message.includes("assembled breakdown"));
  assert.ok(assembled.length > 0, "dense text must trip the assembled-ease floor");
  for (const f of assembled) {
    assert.match(f.message, /Per-tier ease: fastRead -?\d+\.\d, deepRead -?\d+\.\d, fullRead -?\d+\.\d; lift (fastRead|deepRead|fullRead) first\./, f.message);
  }
});

test("v23 example-pack validator rejects source-figure names as fictional actors", () => {
  const fx = compileFixture();
  const packet = { ...fx.packet, allowedEntities: [...fx.packet.allowedEntities, "Graham"] };
  const blueprint = compileChapterBlueprint({ bookId: "money-book", chapter: chapter(), packet, packetPath: "/tmp/ch01.source-packet.json" });
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  bad.examples[0].scenario = "Benjamin has a shared spreadsheet open before a purchase everyone is praising. He decides whether to treat the name as protection or run the analysis first, and the missing price check changes the decision before money leaves the account.";

  const findings = validateExamplePack(bad, blueprint, packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC34.example_source_figure_actor" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 example-pack validator rejects undealt fictional protagonist names", () => {
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  bad.examples[0].scenario = "Jacob stands at the kitchen table with the card app open and chooses whether to pay a small amount before the balance becomes visible. Jacob decides to make the balance match the careful behavior already in place.";

  const findings = validateExamplePack(bad, fx.blueprint, fx.packet);
  assert.ok(
    findings.some((f) => f.checkId === "SEC35.example_dealt_name" && f.severity === "blocker"),
    findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"),
  );
});

test("v23 SEC35 ignores sentence-initial gerunds (Copying, Balancing) — not undealt names (Task 11v)", () => {
  const fx = compileFixture();
  const good = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  const dealt = (fx.blueprint.sections.examples[0]?.allowedNames ?? [])[0] ?? fx.blueprint.reservedVariety.allowedNames[0];
  good.examples[0].scenario = `Copying the worn ledger by hand, ${dealt} traces each line before the card app opens. Balancing the numbers first, ${dealt} decides whether to pay a small amount before the balance becomes visible, and makes the total match the careful behavior already in place.`;

  const findings = validateExamplePack(good, fx.blueprint, fx.packet);
  const sec35 = findings.filter((f) => f.checkId === "SEC35.example_dealt_name");
  assert.deepEqual(sec35.map((f) => f.message), [], sec35.map((f) => f.message).join("\n"));
});

test("v23 SEC35 ignores sentence-initial temporal adverbs (Later, Meanwhile) — not undealt names (Task 11u)", () => {
  const fx = compileFixture();
  const good = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  const dealt = (fx.blueprint.sections.examples[0]?.allowedNames ?? [])[0] ?? fx.blueprint.reservedVariety.allowedNames[0];
  good.examples[0].scenario = `Later, ${dealt} opens the card app at the kitchen table and chooses whether to pay a small amount before the balance becomes visible. None of the alerts have fired yet. Meanwhile the statement waits unread. Everything hinges on the next choice. Eventually ${dealt} makes the balance match the careful behavior already in place before money moves anywhere.`;

  const findings = validateExamplePack(good, fx.blueprint, fx.packet);
  const sec35 = findings.filter((f) => f.checkId === "SEC35.example_dealt_name");
  assert.deepEqual(sec35.map((f) => f.message), [], sec35.map((f) => f.message).join("\n"));
});

test("v23 SEC35 ignores positional openers and scene prepositions (Partway, Beside) — not undealt names", () => {
  // Live hit on the Franklin canary: "Partway through the week, …" flagged
  // undealt protagonist "Partway" on three consecutive drafts and killed a
  // compile slot — the same Task 11u family, positional/prepositional rather
  // than temporal. Stopwords are exclusion-only, so covering the family cannot
  // suppress a real protagonist.
  const fx = compileFixture();
  const good = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  const dealt = (fx.blueprint.sections.examples[0]?.allowedNames ?? [])[0] ?? fx.blueprint.reservedVariety.allowedNames[0];
  good.examples[0].scenario = `Partway through the week, ${dealt} opens the card app at the kitchen table and chooses whether to pay a small amount before the balance becomes visible. Beside the statement sits an unread alert. With the total in view, ${dealt} weighs the tradeoff. From the doorway a housemate calls out. Late one night, ${dealt} checks again. Sundays, ${dealt} reviews the column of marks. Halfway to payday, ${dealt} makes the balance match the careful behavior already in place before money moves anywhere near the limit.`;

  const findings = validateExamplePack(good, fx.blueprint, fx.packet);
  const sec35 = findings.filter((f) => f.checkId === "SEC35.example_dealt_name");
  assert.deepEqual(
    sec35.map((f) => f.message),
    [],
    `positional openers must not register as undealt names:\n${sec35.map((f) => f.message).join("\n")}`,
  );
});

test("v23 SEC35 ignores capitalized hyphenated prefixes (Mid-career) — not undealt names (Task 11r)", () => {
  const fx = compileFixture();
  const good = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
  const dealt = (fx.blueprint.sections.examples[0]?.allowedNames ?? [])[0] ?? fx.blueprint.reservedVariety.allowedNames[0];
  good.examples[0].scenario = `Mid-career, ${dealt} has the card app open at the kitchen table and chooses whether to pay a small amount before the balance becomes visible. Self-control decides the order: ${dealt} makes the balance match the careful behavior already in place before money moves.`;

  const findings = validateExamplePack(good, fx.blueprint, fx.packet);
  const sec35 = findings.filter((f) => f.checkId === "SEC35.example_dealt_name");
  assert.deepEqual(
    sec35.map((f) => f.message),
    [],
    `hyphenated prefixes must not register as undealt names:\n${sec35.map((f) => f.message).join("\n")}`,
  );
});

test("v23 assembly preserves the final ChapterV21 schema while evidence/risk stay upstream", () => {
  const fx = compileFixture();
  const chapter = assembleChapterV21OrThrow({
    plan: fx.blueprint.plan,
    breakdown: fx.summary.breakdown,
    examples: fx.examples.examples,
    quiz: fx.learning.quiz,
    cards: fx.learning.cards,
    implementationPlan: fx.action.implementationPlan,
    keyTakeaway: fx.summary.keyTakeaway,
    keyTakeawaySourceAnchorIds: fx.summary.keyTakeawaySourceAnchorIds,
    hook: fx.summary.hook,
    tryThisNow: fx.action.tryThisNow,
    tryThisNowSourceAnchorIds: fx.action.tryThisNowSourceAnchorIds,
    sourceEvidence: {
      schemaVersion: "planning-source-evidence-v1",
      bookId: fx.packet.bookId,
      chapterNumber: fx.packet.chapterNumber,
      bookSource: null,
      toc: null,
      chapterSource: null,
      chapterSidecar: null,
      chapterSidecarPath: fx.packet.sourceSidecarPath,
      chapterSourcePath: null,
      bookSourcePath: null,
      tocPath: null,
      sourceHash: fx.packet.sourceHash ?? "hash",
      anchorCatalogHash: "hash",
      anchors: fx.packet.allowedAnchors,
      available: true,
      sourceV2: true,
    },
  });
  assert.equal(chapter.schemaVersion, "chapterflow-v21-authored", "final JSON schema stays unchanged");
  assert.equal(chapter.examples.length, 6, "assembled ChapterV21 must satisfy the final gate example floor without repair padding");
  assert.equal("sourceAnchorIds" in (chapter.quiz.questions[0] as Record<string, unknown>), false, "assembled quiz questions must not carry schema-rejected provenance arrays");
  assert.equal("keyEvidenceAnchorIds" in (chapter.quiz.questions[0] as Record<string, unknown>), false, "assembled quiz questions must keep key evidence in authoring.effectiveAnchors");
  assert.deepEqual(chapter.authoring?.sourceAnchors?.effectiveAnchors["quiz.questions[0].keyEvidence"], fx.learning.quiz.questions[0].keyEvidenceAnchorIds);
  const memorableLines = selectMemorableLinesDeterministic(chapter);
  const breakdownHaystack = `${chapter.breakdown.fastRead}\n${chapter.breakdown.deepRead}\n${chapter.breakdown.fullRead}`;
  assert.ok(memorableLines.length > 0, "deterministic memorable-line selector should find breakdown candidates");
  assert.equal(memorableLines.every((line) => line.location.startsWith("breakdown.")), true, "A11 only accepts memorable lines pinned to breakdown prose");
  assert.equal(memorableLines.every((line) => breakdownHaystack.includes(line.text)), true, "selected memorable lines must appear verbatim in breakdown prose");
  assert.equal(memorableLines.every((line) => line.text.split(/\s+/).length <= 16), true, "selected memorable lines should stay aphorism-short for QC");
  assert.equal(memorableLines.every((line) => !/^(it|this|that|they|these|those)\b/i.test(line.text)), true, "selected memorable lines should not depend on a pronoun antecedent");
  assert.equal(memorableLines.every((line) => !line.text.includes(":")), true, "selected memorable lines should avoid colon-list explanations");
  const map = buildEvidenceMap(fx.packet.bookId, chapter, fx.packet, fx.blueprint);
  assert.equal(validateEvidenceMap(map).filter((f) => f.severity === "blocker").length, 0);
  const risk = scoreChapterRisk(fx.packet, map);
  assert.equal(risk.lane, "low");
});


test("v23 section gate rejects repeated example opening shapes across generated chapters", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-section-shell-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = JSON.parse(JSON.stringify(fx.examples)) as ExamplePackV1;
      pack.chapterId = bp.chapterId;
      pack.examples = bp.sections.examples.map((slot, i) => {
        const protagonist = slot.allowedNames[0] ?? bp.reservedVariety.allowedNames[i % bp.reservedVariety.allowedNames.length] ?? "Maya";
        const caseId = slot.requiredCaseIds[0] ?? fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("example"))?.id ?? fx.packet.allowedAnchors[0].id;
        return {
          exampleId: `ex${String(i + 1).padStart(2, "0")}`,
          slotId: slot.slotId,
          title: `Visible Balance Decision ${i + 1}`,
          scenario: `${protagonist} opens a spreadsheet before buying a familiar fund and chooses whether to trust the familiar label. The decision is concrete: pause long enough to compare the 300 to 850 scale, credit utilization, and account information before money leaves the account.`,
          whatToDo: "Write the visible balance, the familiar label, and the smallest next check in separate cells before deciding.",
          whyItMatters: "The action works because credit reports and lenders use account information, so the reader has to inspect the signal instead of trusting a label.",
          sourceAnchorIds: [caseId],
          sourceFactIds: [slot.requiredFactIds[0] ?? fx.packet.facts[0].id],
          namedCaseIds: [caseId],
        };
      });
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [1, 2, 3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "three generated chapters with the same opening shell should block");
    assert.ok(report.findings.some((f) => f.checkId === "SEC80.example_cross_chapter_opening_shape"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate rejects scoped example phrases repeated in two other chapters", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-example-ngram-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapters: ChapterSpec[] = [
    chapter(),
    { chapterId: "money-book-ch02", chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
    { chapterId: "money-book-ch03", chapterNumber: 3, chapterTitle: "Price The Decision" },
  ];
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), chapters);
    for (const ch of chapters) {
      const bp = compileChapterBlueprint({ bookId: "money-book", chapter: ch, packet: fx.packet, packetPath: `/tmp/ch${String(ch.chapterNumber).padStart(2, "0")}.source-packet.json` });
      const pack = cloneExamples(fx.examples);
      pack.chapterId = bp.chapterId;
      pack.examples = bp.sections.examples.map((slot, i) => {
        const base = cloneExamples(fx.examples).examples[i];
        const protagonist = slot.allowedNames[0] ?? bp.reservedVariety.allowedNames[i % bp.reservedVariety.allowedNames.length] ?? "Maya";
        const caseId = slot.requiredCaseIds[0] ?? fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("example"))?.id ?? fx.packet.allowedAnchors[0].id;
        return {
          ...base,
          slotId: slot.slotId,
          scenario: base.scenario.replace(/\b[A-Z][a-z]+\b/, protagonist),
          sourceAnchorIds: [caseId],
          sourceFactIds: [slot.requiredFactIds[0] ?? fx.packet.facts[0].id],
          namedCaseIds: [caseId],
        };
      });
      const name = bp.sections.examples[0].allowedNames[0];
      pack.examples[0].scenario = `${name} hears a friend praise the same shortcut. The social pressure is mild, but the visible balance still has to be checked before money moves. The decision is concrete: compare credit reports, lenders use account information, and credit utilization before trusting the group mood.`;
      writeJsonFile(sourcePacketPath("money-book", ch.chapterNumber, roots), fx.packet);
      writeJsonFile(blueprintPath("money-book", ch.chapterNumber, roots), bp);
      writeJsonFile(sectionPath("money-book", ch.chapterNumber, "example-pack", roots), pack);
    }

    const report = checkSectionGate("money-book", roots, { chapters: [3], sections: ["example-pack"] });
    assert.equal(report.passed, false, "validating only ch3 should still see ch1/ch2 as cross-chapter context");
    assert.ok(report.findings.some((f) => f.checkId === "SEC89.example_cross_chapter_literal_ngram"), report.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("v23 section gate can validate one chapter/section in isolation for bounded agents", () => {
  const fx = compileFixture();
  const stateRoot = resolve(tmpdir(), `cf-v23-section-filter-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const sidecarPath = resolve(stateRoot, "sidecars", "source", "ch01.source.json");
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", "money-book.json"), [chapter()]);
    writeJsonFile(sidecarPath, sidecar());
    writeJsonFile(sourcePacketPath("money-book", 1, roots), { ...fx.packet, sourceSidecarPath: sidecarPath });
    writeJsonFile(blueprintPath("money-book", 1, roots), fx.blueprint);
    writeJsonFile(sectionPath("money-book", 1, "summary-pack", roots), fx.summary);

    const scoped = checkSectionGate("money-book", roots, { chapters: [1], sections: ["summary-pack"] });
    assert.equal(scoped.chaptersChecked, 1);
    assert.equal(scoped.passed, true, scoped.findings.map((f) => f.message).join("; "));

    const full = checkSectionGate("money-book", roots);
    assert.equal(full.passed, false, "full chapter validation should still block on missing sibling section artifacts");
    assert.ok(full.findings.some((f) => f.checkId === "SEC0.missing" && f.section === "example-pack"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

// ── A2: SP16.atomic_specifics (ADVISORY) ─────────────────────────────────────

test("v23 SP16 flags a >6-word hardSpecific as ONE advisory per case and never blocks the packet gate", () => {
  const base = sidecar();
  const longOne = "the four acute care hospitals across the region over four years";
  const longTwo = "a nine step onboarding checklist used by every branch office manager";
  const withLongSpecifics: SourceSidecarV2 = {
    ...base,
    namedExamples: [
      // TWO long entries in one case → exactly ONE SP16 advisory for that case.
      { ...base.namedExamples[0], hardSpecifics: [longOne, longTwo] },
      base.namedExamples[1],
    ],
  };
  const packet = compileSourcePacketFromSidecar({ bookId: "money-book", chapter: chapter(), sidecar: withLongSpecifics, sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const findings = validateSourcePacket(packet);
  const sp16 = findings.filter((f) => f.checkId === "SP16.atomic_specifics");
  assert.equal(sp16.length, 1, "one advisory per case, even with multiple long hardSpecifics");
  assert.equal(sp16[0].severity, "advisory", "SP16 is ADVISORY — a style risk, never a blocker");
  assert.match(sp16[0].message, /hardSpecific "the four acute care hospitals across the region…" is a long label-phrase/);
  assert.match(sp16[0].message, /prefer short atomic specifics \("red phone", "90-second trial"\)/);
  assert.match(sp16[0].message, /long phrases force recitation into prose/);
  assert.equal(findings.filter((f) => f.severity === "blocker").length, 0, "SP16 must not add or cause any blocker — the packet gate still passes");
});

test("v23 SP16 fires once PER case when multiple cases carry long hardSpecifics", () => {
  const base = sidecar();
  const withLongSpecifics: SourceSidecarV2 = {
    ...base,
    namedExamples: base.namedExamples.map((ex, i) => ({
      ...ex,
      hardSpecifics: [`a long label phrase with clearly more than six words number ${i + 1}`, ...ex.hardSpecifics],
    })),
  };
  const packet = compileSourcePacketFromSidecar({ bookId: "money-book", chapter: chapter(), sidecar: withLongSpecifics, sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const sp16 = validateSourcePacket(packet).filter((f) => f.checkId === "SP16.atomic_specifics");
  assert.equal(sp16.length, 2, "each named case with a long hardSpecific gets its own single advisory");
  assert.ok(sp16.every((f) => f.severity === "advisory"));
});

test("v23 SP16 is absent when every hardSpecific is short and atomic (<= 6 words)", () => {
  // The default fixture's hardSpecifics ("300 to 850 scale", "credit utilization", …) are
  // all atomic — SP16 must stay silent, and the healthy packet keeps passing untouched.
  const { packet } = compileFixture();
  const findings = validateSourcePacket(packet);
  assert.equal(findings.some((f) => f.checkId === "SP16.atomic_specifics"), false);
  assert.equal(findings.filter((f) => f.severity === "blocker").length, 0);
});

// ===========================================================================
// Wave-0 gate-small fixes (issue register R-010, R-016, R-040, R-042, R-043,
// R-044). Each test names the behaviour the gate gains or the false positive it
// stops raising; none of them relaxes a check that was catching a real defect.
// ===========================================================================

test("R-010 SEC120's blocker message names exactly the tiers its haystack reads", () => {
  // The haystack is standaloneProseText() = hook + counterintuition + fastRead +
  // deepRead + keyTakeaway (chapterProse.ts:84-89) — fullRead is deliberately
  // excluded, because the check exists to protect the reader who stops after Deep.
  // The message used to promise "(hook, fastRead, deepRead, fullRead, keyTakeaway)",
  // so the cheapest repair it invited — move the missing sentence into fullRead —
  // cannot clear the check and leaves the restatement defect behind.
  const fx = compileFixture();
  const anchor = fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("quiz_prompt") && (a.hardSpecifics ?? []).length > 1);
  assert.ok(anchor, "fixture needs a specifics-rich quiz-capable anchor");
  const specific = anchor!.hardSpecifics![0];
  const onPage = anchor!.hardSpecifics!.find((x) => x !== specific)!;
  const prose = {
    ...fx.summary,
    breakdown: { ...fx.summary.breakdown, deepRead: `${fx.summary.breakdown.deepRead} The deep read states ${onPage} outright.` },
  };
  const bad = cloneLearning(fx.learning);
  const q = bad.quiz.questions[0];
  q.sourceAnchorIds = [anchor!.id];
  q.keyEvidenceAnchorIds = [anchor!.id];
  q.prompt = `A reader checks the ${specific} before the next snapshot. Which move changes what a lender can read?`;

  const hits = validateLearningPack(bad, fx.blueprint, fx.packet, prose).filter((f) => f.checkId === "SEC120.learning_prose_derivable");
  assert.ok(hits.length > 0, "setup must trip SEC120");
  for (const hit of hits) {
    assert.match(hit.message, /\(hook, counterintuition, fastRead, deepRead, keyTakeaway\)/, "the message must name the five fields the haystack actually holds");
    assert.equal(/fullRead/.test(hit.message), false, "naming fullRead as testable prose is the false instruction this fixes");
  }
});

test("R-016 SEC53 word balance blocks ABOVE 1.4x, the bound the learning contract states as safe", () => {
  // sectionTasks.ts:138 tells the writer the key must not exceed ">1.4x avg
  // distractor words", and the CHOICE PARITY METHOD at :139 aims the key at the
  // longer distractor's count. The gate compared `>=`, so a writer who landed
  // exactly on the stated bound was blocked by the rule they had obeyed. The
  // sibling character check on the next line always used a strict `>`.
  const fx = compileFixture();
  const sec53 = (pack: LearningPackV1) =>
    validateLearningPack(pack, fx.blueprint, fx.packet).filter((f) => f.checkId === "SEC53.quiz_answer_length_balance" && f.path === "/quiz/questions/0/choices/" + pack.quiz.questions[0].correctIndex);

  const atBound = cloneLearning(fx.learning);
  const q0 = atBound.quiz.questions[0];
  const distractorIndexes = [0, 1, 2].filter((i) => i !== q0.correctIndex);
  // Two 10-word distractors → avg 10; a 14-word key is exactly 1.4x.
  for (const i of distractorIndexes) q0.choices[i] = "pay the card down a bit before the bill lands";
  q0.choices[q0.correctIndex] = "pay the card down a bit right now and log what the app shows";
  assert.equal(q0.choices[q0.correctIndex].split(/\s+/).length, 14);
  assert.deepEqual(sec53(atBound), [], "a key at exactly 1.4x average distractor words is inside the contract's stated safe zone");

  const overBound = cloneLearning(atBound);
  const q1 = overBound.quiz.questions[0];
  q1.choices[q1.correctIndex] = "pay the card down a bit right now and log what the app shows today";
  assert.equal(q1.choices[q1.correctIndex].split(/\s+/).length, 15, "15 words is 1.5x — above the stated bound");
  assert.equal(sec53(overBound).length, 1, "anything ABOVE 1.4x still blocks");
});

test("R-044 the summary pack's tryThisNow is grounded at the same bar as the action pack's", () => {
  // Both packs carry the SAME field with the SAME claim type, and the assembler
  // ships `action.tryThisNow || summary.tryThisNow` (assembleSections.ts:269,342),
  // so the action pack's copy is the one a reader sees. The summary copy was
  // validated at min 2 hardSpecifics while SEC74 validates the shipped copy at 1 —
  // retries spent on bytes that are discarded.
  const fx = compileFixture();
  const anchor = fx.packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("implementation_guidance") && (a.hardSpecifics ?? []).length >= 2);
  assert.ok(anchor, "fixture needs an implementation-capable anchor with 2+ hardSpecifics");
  const oneSpecific = `Open one account and check ${anchor!.hardSpecifics![0]} before the next snapshot happens today.`;

  const summary = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
  summary.tryThisNow = oneSpecific;
  summary.tryThisNowSourceAnchorIds = [anchor!.id];
  const summaryHits = validateSummaryPack(summary, fx.blueprint, fx.packet).filter((f) => f.path === "/tryThisNow" && f.checkId === "SEC14.summary_anchor_specifics");

  const action = JSON.parse(JSON.stringify(fx.action)) as ActionPackV1;
  action.tryThisNow = oneSpecific;
  action.tryThisNowSourceAnchorIds = [anchor!.id];
  const actionHits = validateActionPack(action, fx.blueprint, fx.packet).filter((f) => f.path === "/tryThisNow" && f.checkId === "SEC74.action_anchor_specifics");

  assert.deepEqual(actionHits, [], "SEC74 accepts one verbatim specific in the copy that actually ships");
  assert.deepEqual(summaryHits, [], "the discarded copy must not be held to a stricter bar than the shipped one");
});
test("R-043 memorable-line scoring rewards only the separators it can actually see", () => {
  // memorableLineScore rejects any sentence containing ":" before scoring, so the
  // ":" alternative in the "+3 for a separator" rule was unreachable. Deleting it
  // changes no score — this test pins that equivalence so the cleanup is provably
  // cosmetic.
  assert.equal(memorableLineScore("You cannot fix the signal: you can only change what it reports today."), 0, "a colon still disqualifies a candidate outright");
  const comma = memorableLineScore("When the balance is read, you have already decided what it says.");
  const semi = memorableLineScore("When the balance is read; you have already decided what it says.");
  assert.ok(comma > 0 && semi > 0);
  assert.equal(comma, semi, "comma and semicolon are the separators the reward can still reach");
});

test("R-040 SEC12 carries the critic's own severity: reading level blocks, abstract density advises", () => {
  // readingLevel.ts emits prose.reading_level at "major" and prose.abstract_density
  // at "minor"; the gate pushed BOTH as blockers, so a supplementary conceptual-load
  // signal the critic itself calls minor could fail a chapter on its own.
  const fx = compileFixture();
  const bad = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
  // One dense fastRead paragraph: 4+ syllable words push abstract density over its
  // budget of 2 while the sentences stay short enough to clear the FK ceiling.
  bad.breakdown.fastRead = long("Utilization visibility rewards preparation. Anticipation supports reliability. Documentation clarifies obligation.", 12);
  const sec12 = validateSummaryPack(bad, fx.blueprint, fx.packet).filter((f) => f.checkId === "SEC12.summary_readability" && f.path === "/breakdown/fastRead");
  const density = sec12.filter((f) => /four-plus-syllable/.test(f.message));
  const level = sec12.filter((f) => /Flesch-Kincaid grade/.test(f.message));
  assert.ok(density.length > 0, sec12.map((f) => `${f.severity}: ${f.message}`).join("\n"));
  assert.ok(density.every((f) => f.severity === "advisory"), "a `minor` critic finding must not be laundered into a blocker");
  assert.ok(level.every((f) => f.severity === "blocker"), "the `major` reading-level finding still blocks");
});

test("R-040 abstract density does not count the chapter's own subject vocabulary", () => {
  // The density rule counts EVERY 4+ syllable word, so a chapter whose subject is a
  // long proper noun spends its whole budget of 2 naming its own material — the
  // shipped virtues chapter could not name three of the thirteen virtues in
  // fastRead. The packet already enumerates that vocabulary in allowedEntities /
  // allowedPlaces, so those tokens are the chapter's subject, not academic filler.
  const fx = compileFixture();
  const packet = JSON.parse(JSON.stringify(fx.packet)) as SourcePacketV1;
  packet.allowedEntities = [...packet.allowedEntities, "Pennsylvania"];
  packet.allowedPlaces = [...packet.allowedPlaces, "Philadelphia"];
  assert.ok(countSyllables("Pennsylvania") >= 4 && countSyllables("Philadelphia") >= 4, "both entity tokens are 4+ syllables, i.e. countable before the exemption");

  const named = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
  named.breakdown.fastRead = long("Pennsylvania paid first. Philadelphia paid next. Pennsylvania paid again.", 20);
  const namedDensity = validateSummaryPack(named, fx.blueprint, packet)
    .filter((f) => f.checkId === "SEC12.summary_readability" && f.path === "/breakdown/fastRead" && /four-plus-syllable/.test(f.message));
  assert.deepEqual(namedDensity, [], "naming the packet's own entities must not spend the abstract-word budget");

  // The exemption is narrow: 4+ syllable words the packet does NOT name are still counted.
  const academic = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
  academic.breakdown.fastRead = long("Utilization rewards preparation. Visibility supports reliability. Documentation clarifies obligation.", 12);
  const academicDensity = validateSummaryPack(academic, fx.blueprint, packet)
    .filter((f) => f.checkId === "SEC12.summary_readability" && f.path === "/breakdown/fastRead" && /four-plus-syllable/.test(f.message));
  assert.ok(academicDensity.length > 0, "academic vocabulary the packet never names is still flagged");
});

