/**
 * Regression: assembleSections() (src/sections/assembleSections.ts) used to run only the
 * runtime ChapterV21 schema (assembleChapterV21OrThrow) and never checkSectionGate. The
 * orchestrated path is safe because the conductor always runs validate-sections before
 * assemble-sections, but the standalone `assemble-sections` CLI verb — whose name implies
 * validated output — would happily assemble section packs that `validate-sections` blocks
 * if it were ever run out of order or on its own. assembleSections() must now re-run the
 * section gate itself and refuse to assemble any chapter with a blocker finding.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

import { test } from "./harness.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { compileChapterBlueprint } from "../src/compiler/chapterBlueprint.js";
import { blueprintPath, sectionPath, sourcePacketPath, writeJsonFile, type CompilerStoreRoots } from "../src/artifacts/artifactStore.js";
import type { ActionPackV1, ChapterBlueprintV1, ExamplePackV1, LearningPackV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterSpec } from "../src/generateChapter.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";
import { canonicalChapterIndexPath } from "../src/lib/chapterSet.js";
import { CHAPTERS_DIR, chapterFileName } from "../src/lib/chapterPaths.js";
import { assembleSections } from "../src/sections/assembleSections.js";

const BOOK = "zz-fixture-gate-required";

/** Seven distinct card fronts/backs for the compliant credit fixture: distinct first
 *  three words per family (SEC132), and no back opening on the "The <shape> is"
 *  announcement scaffold. */
const creditCardFronts = [
  "Which visible number does a lender read before your payment posts?",
  "What happens to utilization when a balance is reported early?",
  "How does a reporting snapshot differ from a payment due date?",
  "Why can an on-time payment still leave a noisy signal?",
  "When should a small payment land to change the report?",
  "Where does the account information a lender reads come from?",
  "Who benefits when the visible balance matches the real behaviour?",
];
const creditCardBacks = [
  "A lender reads the balance the card reported, not the payment you are planning to make tomorrow.",
  "Utilization falls as soon as the reported balance falls, which is why the timing beats the intention here.",
  "Snapshots happen on the reporting date, which can sit weeks away from the due date printed on the bill.",
  "On-time payment builds a history, and the balance captured in that month still travels alongside it.",
  "Small payments land best before the reporting date, because only what is recorded can be read later.",
  "Account information comes from the issuer's own report, so the issuer's snapshot is the view that counts.",
  "Borrowers benefit when the recorded number matches behaviour, since nothing else about intent is visible.",
];

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
  return { chapterId: `${BOOK}-ch01`, chapterNumber: 1, chapterTitle: "Optimize Your Credit Cards" };
}

/** A section-gate-clean, assembling single-chapter fixture (mirrors compiler-pipeline.test.ts's
 *  compileFixture()): every field individually satisfies assembleChapterV21OrThrow AND the whole
 *  section gate, so assembleSections() succeeds for it untouched unless a test corrupts a field. */
function compileFixture() {
  const packet = compileSourcePacketFromSidecar({ bookId: BOOK, chapter: chapter(), sidecar: sidecar(), sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId: BOOK, chapter: chapter(), packet, packetPath: "/tmp/ch01.source-packet.json" });
  const aid = packet.allowedAnchors[0].id;
  const quizAid = packet.allowedAnchors.find((a) => a.id.includes(".fact.") && a.supportsClaimTypes.includes("quiz_prompt") && a.supportsClaimTypes.includes("quiz_key_evidence"))?.id ?? aid;
  const exampleAid = packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("example"))?.id ?? aid;
  const fids = packet.facts.map((f) => f.id);
  // Package 1B: the keyed answer (row[0]) is the SHORTEST of its three choices in
  // every row, so this compliant fixture carries a 0% distractor-tell rate against
  // SEC116's rubric budget of 20%. Before, three of the nine keys were the uniquely
  // longest choice (33%), which the old advisory-only check never reported as a
  // failure of the fixture.
  const quizChoiceRows = [
    ["Lower the visible balance before the snapshot", "Leave the balance untouched until the snapshot has already passed", "Open another card first and check utilization afterwards"],
    ["Pay before the reportable balance is read", "Trust that repayment intent will be understood after the report", "Move the payment reminder to a date after the bill is due"],
    ["Inspect utilization while it can change", "Track reward points and let the payment question wait", "Ask the lender to infer careful habits from history"],
    ["Make the account signal cleaner now", "Add another account so the mix shows more variety", "Trust the payment history before checking anything else"],
    ["Reduce the balance the system sees", "Keep the extra cash idle so the month feels comfortable", "Delay the whole review until the paper bill arrives"],
    ["Set an alert before balance reporting", "Wait for the printed statement before taking any action", "Focus on the card colour and the rewards programme"],
    ["Change the number lenders may read", "Assume the careful intent will look obvious enough", "Describe a higher credit limit when the story comes up"],
    ["Check the report-facing account data", "Treat the due date as sufficient on its own", "Compare the unrelated card perks before anything else"],
    ["Act on utilization before it travels", "Hope that later context repairs the damaged signal", "Open a new budget spreadsheet tab and start over"],
  ];
  // Package 1B: every stem now poses the scenario itself. SEC117 counts transfer on
  // the STEM'S OWN CUE WORDS rather than on the bloomsLevel string, and this
  // fixture's nine questions carried an "apply" label with no cue anywhere — 0/9
  // real transfer behind a 9/9 label. The first three words of each stem are also
  // distinct, which is what SEC132 measures.
  const quizPrompts = [
    "Suppose you want the next credit snapshot to look less risky. Which action changes the visible signal?",
    "Imagine a borrower who pays on time but still carries a high reportable balance. What move fits the mechanism?",
    "You are looking at the account page before payday and utilization is high. Which response acts while the signal can still change?",
    "Your team wants the system to see cleaner account information. Which option does that directly?",
    "A colleague warns that the balance may be reported before the due date. What should be inspected first?",
    "Consider a careful cardholder who keeps missing the reporting moment. Which small setup best supports the habit?",
    "Picture this scenario: the lender will later read account data, not intent. Which choice changes the evidence?",
    "Suppose a card user is comparing payment timing against card perks. Which detail belongs at the center?",
    "You are one minute from closing the app. Which action follows the credit-signal idea?",
  ];
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
  const summary: SummaryPackV1 = {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: blueprint.chapterId,
    hook: { hook: "Maya opens her card app before payday and sees the balance that a lender might see first.", sourceAnchorIds: [aid], counterintuition: "Paying on time is necessary, but the visible balance can still make a careful borrower look riskier than their actual behavior.", counterintuitionSourceAnchorIds: [aid] },
    // Breakdown prose written to the P02 rubric-aligned readability spec: plain,
    // short sentences so each tier clears its FK ceiling AND the assembled
    // breakdown reads at Flesch ease ≥70 (the SEC12 whole-breakdown floor), with
    // ≥3 distinct memorable-line candidates seeded across tiers.
    breakdown: {
      fastRead: long("Pay before the snapshot. A lower balance can make a careful borrower look careful. Make the signal match the care you already show.", 25),
      deepRead: long("A card keeps a record of what you owe. It does not read your plan. The system reads what you owe, not what you mean to do. So lower what the card shows before it goes to a lender.", 45),
      // Package 1B: the two named cases the examples cite are TAUGHT here, once,
      // outside the repeated block (SEC128 blocks a chapter that builds units on a
      // case its reader-visible prose never states; the repeated block is left alone
      // so the soft-banned-phrase budget and the SEC120 standalone haystack, which
      // excludes fullRead, both stay exactly as they were).
      fullRead: `${long("The move here is simple to start. Look at your own balance first. Bring down what you owe when you can. Small early payments change the story your card tells. Set a nudge before the day the balance is read. What a lender sees matters more than what you plan. This keeps the main idea true without a promise of an exact jump in your score.", 70)} Credit reports collect the account record, and lenders use account information from those reports. A score commonly sits on a 300 to 850 scale, and credit utilization is one of the inputs behind it.`,
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
      // Package 1B: seven distinct fronts and seven distinct backs. Every card used to
      // carry the SAME front stem and a byte-identical back, which SEC132 now blocks
      // as three-or-more identical openers inside one chapter.
      cards: blueprint.sections.cards.map((c, i) => ({ cardId: c.cardId, sourceAnchorIds: [aid], front: creditCardFronts[i % creditCardFronts.length], back: creditCardBacks[i % creditCardBacks.length], difficulty: c.difficulty })),
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

function writeChapterFixture(roots: CompilerStoreRoots, fx: ReturnType<typeof compileFixture>): void {
  writeJsonFile(sourcePacketPath(BOOK, 1, roots), fx.packet as SourcePacketV1);
  writeJsonFile(blueprintPath(BOOK, 1, roots), fx.blueprint as ChapterBlueprintV1);
  writeJsonFile(sectionPath(BOOK, 1, "summary-pack", roots), fx.summary);
  writeJsonFile(sectionPath(BOOK, 1, "example-pack", roots), fx.examples);
  writeJsonFile(sectionPath(BOOK, 1, "learning-pack", roots), fx.learning);
  writeJsonFile(sectionPath(BOOK, 1, "action-pack", roots), fx.action);
}

function freshRoots(label: string): CompilerStoreRoots {
  const stateRoot = resolve(tmpdir(), `cf-v23-assemble-gate-${label}-${process.pid}-${Date.now()}`);
  mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
  writeJsonFile(canonicalChapterIndexPath(BOOK, stateRoot), [chapter()]);
  return { stateRoot };
}

function chapterOutputPath(): string {
  return resolve(CHAPTERS_DIR, chapterFileName(`${BOOK}-ch01`));
}

test("assembleSections refuses to assemble a chapter that fails the section gate and writes nothing for it", () => {
  const roots = freshRoots("blocked");
  try {
    rmSync(chapterOutputPath(), { force: true });
    const fx = compileFixture();
    // Inject a hard-banned register phrase (SEC92) that only the section gate — not
    // assembleChapterV21OrThrow's runtime schema check — would ever catch.
    const summary = JSON.parse(JSON.stringify(fx.summary)) as SummaryPackV1;
    summary.breakdown.deepRead = `${summary.breakdown.deepRead}\n\nThe trap is to trust the first impressive number and stop.`;
    writeChapterFixture(roots, { ...fx, summary });

    const result = assembleSections(BOOK, roots);

    assert.equal(result.written.length, 0, "a section-gate-blocked chapter must not be written");
    assert.ok(
      result.findings.some((f) => f.startsWith("ch01:") && /section-gate blocked assembly/.test(f)),
      result.findings.join("\n"),
    );
    assert.equal(existsSync(chapterOutputPath()), false, "no ChapterV21 file should land on disk for a gate-blocked chapter");
  } finally {
    rmSync(roots.stateRoot!, { recursive: true, force: true });
    rmSync(chapterOutputPath(), { force: true });
  }
});

test("assembleSections still assembles a chapter that clears the section gate", () => {
  const roots = freshRoots("clean");
  try {
    rmSync(chapterOutputPath(), { force: true });
    const fx = compileFixture();
    writeChapterFixture(roots, fx);

    const result = assembleSections(BOOK, roots);

    assert.equal(result.findings.length, 0, result.findings.join("\n"));
    assert.equal(result.written.length, 1);
    assert.equal(existsSync(chapterOutputPath()), true);
  } finally {
    rmSync(roots.stateRoot!, { recursive: true, force: true });
    rmSync(chapterOutputPath(), { force: true });
  }
});
