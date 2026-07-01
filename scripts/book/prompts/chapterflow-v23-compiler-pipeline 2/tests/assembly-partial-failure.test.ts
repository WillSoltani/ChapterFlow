/**
 * Regression for the "one bad chapter resets the whole book" trap: assembleSections()
 * (src/sections/assembleSections.ts) already reports per-chapter findings ("chNN: <message>"),
 * but doCompilerWrite used to route ANY assemble-sections failure through the generic
 * runCompilerVerb halt, which the conductor treated as a whole-write-phase stop — one
 * persistently-bad chapter forced a full book reset instead of a scoped repair.
 *
 * convergeAssembly() (src/orchestrator/compilerRun.ts) now parses the failing chapter
 * number(s) out of those findings and repairs ONLY those chapters, bounded by
 * SECTION_REPAIR_MAX_PASSES, leaving healthy chapters untouched.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { compileChapterBlueprint } from "../src/compiler/chapterBlueprint.js";
import { blueprintPath, sectionPath, sourcePacketPath, writeJsonFile } from "../src/artifacts/artifactStore.js";
import type { ActionPackV1, ChapterBlueprintV1, ExamplePackV1, LearningPackV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterSpec } from "../src/generateChapter.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";
import { canonicalChapterIndexPath } from "../src/lib/chapterSet.js";
import { CANONICAL_STATE, CHAPTERS_DIR, chapterFileName } from "../src/lib/chapterPaths.js";
import { assembleSections } from "../src/sections/assembleSections.js";
import { resolveDeps, type AutopilotDeps, type VerbResult } from "../src/orchestrator/autopilot.js";
import { convergeAssembly, SECTION_REPAIR_MAX_PASSES } from "../src/orchestrator/compilerRun.js";

const BOOK = "zz-fixture-assembly-partial";

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

/** A fully valid, assembling fixture for one chapter — packet/blueprint/summary/examples/
 *  learning/action all agree with the blueprint's dealt slot counts, so assembleSections()
 *  succeeds for it untouched. Mirrors compiler-pipeline.test.ts's compileFixture(). */
function compileFixture(ch: ChapterSpec) {
  const packet = compileSourcePacketFromSidecar({ bookId: BOOK, chapter: ch, sidecar: sidecar(), sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId: BOOK, chapter: ch, packet, packetPath: `/tmp/${ch.chapterId}.source-packet.json` });
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
      fastRead: long("Pay before the snapshot. Lower the visible balance. Make the signal match the care you already show.", 35),
      deepRead: long("A card system records account information. It does not read your intent. The useful move is to reduce what the system sees before the signal travels to lenders.", 65),
      fullRead: long("The reader-facing move is practical. Make the balance visible to yourself. Reduce avoidable utilization. Set a trigger before the reportable moment. This keeps the source idea intact without promising an exact score jump.", 120),
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

function writeChapterFixture(fx: ReturnType<typeof compileFixture>): void {
  const n = fx.blueprint.chapterNumber;
  writeJsonFile(sourcePacketPath(BOOK, n), fx.packet as SourcePacketV1);
  writeJsonFile(blueprintPath(BOOK, n), fx.blueprint as ChapterBlueprintV1);
  writeJsonFile(sectionPath(BOOK, n, "summary-pack"), fx.summary);
  writeJsonFile(sectionPath(BOOK, n, "example-pack"), fx.examples);
  writeJsonFile(sectionPath(BOOK, n, "learning-pack"), fx.learning);
  writeJsonFile(sectionPath(BOOK, n, "action-pack"), fx.action);
}

/** Drops one example slot so assembleChapterV21OrThrow's plan.exampleSpecs-vs-examples.length
 *  check fails — a realistic "malformed section pack" that only affects THIS chapter's assembly. */
function breakExamplePack(n: number, examples: ExamplePackV1): void {
  const broken: ExamplePackV1 = { ...examples, examples: examples.examples.slice(0, 5) };
  writeJsonFile(sectionPath(BOOK, n, "example-pack"), broken);
}

function fakeRunVerb(): AutopilotDeps["runVerb"] {
  return async (args): Promise<VerbResult> => {
    if (args[0] === "assemble-sections") {
      const result = assembleSections(args[1]);
      const stdout = result.written.map((p) => `wrote ${p}`).join("\n");
      if (result.findings.length) return { code: 1, stdout, stderr: result.findings.join("\n") };
      return { code: 0, stdout: `${stdout}\nassemble-sections: PASS (${result.written.length} chapter(s))`, stderr: "" };
    }
    throw new Error(`unexpected verb in test: ${args.join(" ")}`);
  };
}

function cleanFixtureState(): void {
  rmSync(resolve(CANONICAL_STATE, "books", BOOK), { recursive: true, force: true });
  rmSync(canonicalChapterIndexPath(BOOK), { force: true });
  rmSync(resolve(CHAPTERS_DIR, chapterFileName(`${BOOK}-ch01`)), { force: true });
  rmSync(resolve(CHAPTERS_DIR, chapterFileName(`${BOOK}-ch02`)), { force: true });
}

function setUpTwoChapterBook(): { ch1: ReturnType<typeof compileFixture>; ch2: ReturnType<typeof compileFixture> } {
  const chapters: ChapterSpec[] = [
    { chapterId: `${BOOK}-ch01`, chapterNumber: 1, chapterTitle: "Optimize Your Credit Cards" },
    { chapterId: `${BOOK}-ch02`, chapterNumber: 2, chapterTitle: "Use Cash Carefully" },
  ];
  mkdirSync(resolve(CANONICAL_STATE, "indexes"), { recursive: true });
  writeJsonFile(canonicalChapterIndexPath(BOOK), chapters);
  const ch1 = compileFixture(chapters[0]);
  const ch2 = compileFixture(chapters[1]);
  writeChapterFixture(ch1);
  writeChapterFixture(ch2);
  return { ch1, ch2 };
}

test("convergeAssembly repairs only the chapter whose section pack is malformed; the healthy chapter is left untouched", async () => {
  cleanFixtureState();
  try {
    const { ch2 } = setUpTwoChapterBook();
    breakExamplePack(2, ch2.examples); // only ch02 is now malformed

    const spawnedFor: number[] = [];
    const deps = resolveDeps({
      runVerb: fakeRunVerb(),
      mkSessionId: (label) => label,
      logSession: () => {},
      log: () => {},
      spawn: (async (o: { sessionId: string }) => {
        const m = o.sessionId.match(/ch(\d+)$/);
        const n = m ? Number(m[1]) : NaN;
        spawnedFor.push(n);
        // The repair agent fixes exactly the chapter it was scoped to.
        if (n === 2) writeJsonFile(sectionPath(BOOK, 2, "example-pack"), ch2.examples);
        return { ok: true, exitCode: 0, finalMessage: "fixed", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
      }) as unknown as AutopilotDeps["spawn"],
    });

    const outcome = await convergeAssembly(BOOK, deps, 2, () => true);
    assert.equal(outcome, null, "assembly should converge once the scoped repair fixes ch02");
    assert.deepEqual(spawnedFor, [2], "only ch02 should ever receive a repair agent — ch01 was never broken");

    const final = assembleSections(BOOK);
    assert.equal(final.findings.length, 0);
    assert.equal(final.written.length, 2, "both chapters are written once assembly converges");
  } finally {
    cleanFixtureState();
  }
});

test("convergeAssembly halts with a message naming only the persistently-bad chapter, not the whole book", async () => {
  cleanFixtureState();
  try {
    const { ch2 } = setUpTwoChapterBook();
    breakExamplePack(2, ch2.examples); // ch02 stays malformed for every repair attempt

    const spawnedFor: number[] = [];
    const deps = resolveDeps({
      runVerb: fakeRunVerb(),
      mkSessionId: (label) => label,
      logSession: () => {},
      log: () => {},
      spawn: (async (o: { sessionId: string }) => {
        const m = o.sessionId.match(/ch(\d+)$/);
        spawnedFor.push(m ? Number(m[1]) : NaN);
        // Repair agent runs but never actually fixes the pack (simulates a stuck defect).
        return { ok: true, exitCode: 0, finalMessage: "could not fix it", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
      }) as unknown as AutopilotDeps["spawn"],
    });

    const outcome = await convergeAssembly(BOOK, deps, 2, () => true);
    assert.ok(outcome && outcome.status === "halt", "assembly should halt once the repair budget is exhausted");
    if (!outcome || outcome.status !== "halt") return;
    assert.equal(outcome.category, "content");
    assert.match(outcome.reason, /ch02/, "the halt must name the specific failing chapter");
    assert.doesNotMatch(outcome.reason, /ch01/, "the halt must not implicate the healthy chapter");
    assert.doesNotMatch(
      outcome.reason,
      /^compiler assembly failed \(exit \d+\)\./,
      "the halt must not be the generic whole-book message once a chapter is isolated",
    );
    assert.match(outcome.reason, /every other chapter assembled successfully/i);

    assert.deepEqual([...new Set(spawnedFor)], [2], "only ch02 should ever receive a repair agent, across every bounded attempt");
    assert.equal(spawnedFor.length, SECTION_REPAIR_MAX_PASSES, "repair attempts are bounded by SECTION_REPAIR_MAX_PASSES");

    // ch01 was never touched by a repair pass; its section artifacts still assemble on their own.
    const ch1Only = assembleSections(BOOK);
    assert.ok(ch1Only.written.some((p) => p.includes(`${BOOK}-ch01`)));
  } finally {
    cleanFixtureState();
  }
});

/** Extract the source of a top-level function declaration by brace-matching from its
 *  opening `{` to the matching `}`, so we can inspect its trailing statement directly
 *  rather than exercising it at runtime (the tail in question is unreachable by
 *  construction — see the guard below). */
function extractFunctionBody(src: string, functionName: string): string {
  const sigIdx = src.indexOf(`function ${functionName}(`);
  assert.ok(sigIdx >= 0, `function ${functionName} not found in compilerRun.ts`);
  // The signature's own default-parameter object literals (e.g. `= {}`) contain braces too,
  // so anchor on the return-type arrow immediately before the body's opening brace.
  const returnArrow = src.indexOf("): Promise<AutopilotOutcome | null> {", sigIdx);
  assert.ok(returnArrow >= 0, `${functionName}: could not find its "): Promise<AutopilotOutcome | null> {" signature tail`);
  const open = returnArrow + "): Promise<AutopilotOutcome | null> {".length - 1;
  let depth = 0;
  let end = open;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  return src.slice(open + 1, end);
}

test("convergeSections and convergeAssembly do not fall through to a bare 'return null' after their bounded repair loop", () => {
  // Both loops always return-or-halt on their final bounded attempt, so the statement
  // after the `for` loop is unreachable today. That's exactly the footgun: if a later
  // change ever turns the loop's halt-on-exhaustion branch into a `continue`, a trailing
  // `return null` would silently reinterpret "gave up" as "succeeded" and let invalid
  // sections/assembly advance. Pin it as a loud `throw` instead, so this file can never
  // regress back to a bare success fallthrough.
  const src = readFileSync(resolve(PIPELINE_DIR, "src/orchestrator/compilerRun.ts"), "utf8");
  for (const fn of ["convergeSections", "convergeAssembly"]) {
    const body = extractFunctionBody(src, fn);
    const afterLoop = body.slice(body.lastIndexOf("\n  }\n") + "\n  }\n".length).trim();
    const afterLoopCode = afterLoop
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
      .trim();
    assert.ok(afterLoopCode.length > 0, `${fn}: could not locate the statement after the repair loop`);
    assert.doesNotMatch(afterLoopCode, /^return null;/, `${fn}: must not fall through to a bare "return null" after the bounded repair loop`);
    assert.match(afterLoopCode, /^throw new Error\(/, `${fn}: the unreachable tail after the bounded repair loop must be a loud throw, not a silent success return`);
  }
});
