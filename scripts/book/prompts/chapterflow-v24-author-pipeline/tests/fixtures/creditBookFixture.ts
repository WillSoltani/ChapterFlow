/**
 * A section-gate-clean, single-chapter compiler fixture (credit-cards book), reusable across
 * tests that need a book whose section artifacts assemble into a valid ChapterV21. Lifted from the
 * inline fixture in tests/assemble-requires-section-gate.test.ts and parameterized by bookId so
 * more than one test file can build an isolated copy. Every field individually satisfies
 * assembleChapterV21OrThrow AND the whole section gate.
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { compileSourcePacketFromSidecar } from "../../src/compiler/sourcePacket.js";
import { compileChapterBlueprint } from "../../src/compiler/chapterBlueprint.js";
import { blueprintPath, sectionPath, sourcePacketPath, writeJsonFile, type CompilerStoreRoots } from "../../src/artifacts/artifactStore.js";
import type { ActionPackV1, ChapterBlueprintV1, ExamplePackV1, LearningPackV1, SourcePacketV1, SummaryPackV1 } from "../../src/artifacts/artifactTypes.js";
import type { ChapterSpec } from "../../src/generateChapter.js";
import type { SourceSidecarV2 } from "../../src/source/sidecarSchema.js";
import { canonicalChapterIndexPath } from "../../src/lib/chapterSet.js";

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

export function creditChapterSpec(bookId: string): ChapterSpec {
  return { chapterId: `${bookId}-ch01`, chapterNumber: 1, chapterTitle: "Optimize Your Credit Cards" };
}

export type CreditFixture = { packet: SourcePacketV1; blueprint: ChapterBlueprintV1; summary: SummaryPackV1; examples: ExamplePackV1; learning: LearningPackV1; action: ActionPackV1 };

/** Compile the credit fixture's packet + blueprint + four section packs for `bookId`.
 *  `roots` only affects reads inside compileChapterBlueprint (salts sidecar); pass the same roots
 *  used when writing so a salt bump is honored. */
export function compileCreditFixture(bookId: string, roots: CompilerStoreRoots = {}): CreditFixture {
  const spec = creditChapterSpec(bookId);
  const packet = compileSourcePacketFromSidecar({ bookId, chapter: spec, sidecar: sidecar(), sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId, chapter: spec, packet, packetPath: "/tmp/ch01.source-packet.json", roots });
  const aid = packet.allowedAnchors[0].id;
  const quizAid = packet.allowedAnchors.find((a) => a.id.includes(".fact.") && a.supportsClaimTypes.includes("quiz_prompt") && a.supportsClaimTypes.includes("quiz_key_evidence"))?.id ?? aid;
  const exampleAid = packet.allowedAnchors.find((a) => a.supportsClaimTypes.includes("example"))?.id ?? aid;
  const fids = packet.facts.map((f) => f.id);
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
    breakdown: {
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

/** Write the fixture's index + packet + blueprint + four section packs under `roots`. */
export function writeCreditFixture(bookId: string, roots: CompilerStoreRoots, fx: CreditFixture): void {
  mkdirSync(resolve(roots.stateRoot!, "indexes"), { recursive: true });
  writeJsonFile(canonicalChapterIndexPath(bookId, roots.stateRoot), [creditChapterSpec(bookId)]);
  writeJsonFile(sourcePacketPath(bookId, 1, roots), fx.packet as SourcePacketV1);
  writeJsonFile(blueprintPath(bookId, 1, roots), fx.blueprint as ChapterBlueprintV1);
  writeJsonFile(sectionPath(bookId, 1, "summary-pack", roots), fx.summary);
  writeJsonFile(sectionPath(bookId, 1, "example-pack", roots), fx.examples);
  writeJsonFile(sectionPath(bookId, 1, "learning-pack", roots), fx.learning);
  writeJsonFile(sectionPath(bookId, 1, "action-pack", roots), fx.action);
}
