import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BibliographyResult } from "../../src/agents/researcher-bibliography.js";
import type { ChapterResearchResult } from "../../src/agents/researcher-chapter.js";
import { createProductionBookRunComposition } from "../../src/app/bookRunComposition.js";
import { bookDesignPath, writeJsonFile } from "../../src/artifacts/artifactStore.js";
import { deriveBookDesign } from "../../src/compiler/bookDesign.js";
import { compileChapterBlueprint } from "../../src/compiler/chapterBlueprint.js";
import { compileSourcePacketFromSidecar } from "../../src/compiler/sourcePacket.js";
import type { ProcessResult, ProcessSpec, ProcessSupervisor } from "../../src/runtime/processTypes.js";
import type { SourceSidecarV2 } from "../../src/source/sidecarSchema.js";
import { REVIEW_FACTORS } from "../../src/artifacts/artifactTypes.js";
import { compileCreditFixture, creditChapterSpec } from "../fixtures/creditBookFixture.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BOOK = "v4-production-composition-fixture";
const TITLE = "Production Composition Fixture";
const AUTHOR = "Fixture Author";
const SOURCE_SHA = "a20d1cdab0fc33c4c1f840f4cf99089816e022d4";

function bibliography(): BibliographyResult {
  return {
    bookId: BOOK,
    title: TITLE,
    author: AUTHOR,
    edition: { name: "fixture", chapterCount: 1, language: "English" },
    flatChapters: [{ number: 1, title: "Optimize Your Credit Cards" }],
    thesis: "Visible account information can differ from repayment intent, so timing and utilization choices change what lenders can observe.",
    teachingArc: "One concrete account snapshot establishes visible credit signals, then a bounded practice turns that mechanism into a repeatable decision.",
    authorVoice: {
      register: "plainspoken",
      signatureMoves: ["concrete account scenes", "mechanism contrasts", "short action labels"],
      avoidMoves: ["guaranteed score promises"],
    },
    confidence: "high",
  };
}

function chapterResearch(): ChapterResearchResult & SourceSidecarV2 {
  const factRows = [
    [
      "A FICO score is commonly presented on a 300 to 850 scale when credit behavior is discussed.",
      "Because the scale compresses report data into one lender-facing signal, account information can affect how risk is summarized.",
      "A score records personal worth rather than report data.",
      "The scale summarizes selected credit information, not character.",
    ],
    [
      "CFPB credit reports collect account and payment information that lenders can inspect.",
      "Because lenders receive reported account records, visible balances can matter before private repayment plans become observable.",
      "A lender automatically sees every future payment intention.",
      "A report contains recorded account information, not an unwritten plan.",
    ],
    [
      "A $1,000 reported balance against a $5,000 limit represents 20 percent utilization.",
      "Because utilization compares reported balance with available credit, lowering the numerator changes the ratio directly.",
      "Only the number of open cards determines utilization.",
      "Reported balance and available limit determine the ratio in this example.",
    ],
    [
      "A balance reported on May 1 can precede a payment due on May 20.",
      "Because reporting and due dates can be different events, an on-time later payment does not alter the earlier snapshot.",
      "Every issuer reports only after the due date.",
      "The two dated events demonstrate why timing must be checked rather than assumed.",
    ],
    [
      "Experian describes credit utilization as reported revolving balances compared with credit limits.",
      "Because the comparison uses report-facing figures, a smaller visible balance produces a different utilization input.",
      "Utilization measures monthly income instead of revolving account data.",
      "The ratio compares balances and limits, not wages.",
    ],
    [
      "Equifax credit files can include account balances, limits, and payment history supplied by data furnishers.",
      "Because furnishers transmit account fields, checking those fields can reveal what evidence a lender may later receive.",
      "A credit file contains only public court records.",
      "Account-level fields form part of the file alongside any other permitted records.",
    ],
    [
      "TransUnion consumer disclosures let a person inspect reported account information for accuracy.",
      "Because disclosure exposes recorded fields, an incorrect balance can be identified before relying on the resulting signal.",
      "Consumers cannot inspect any information held in a credit file.",
      "A disclosure exists to make reported information visible to the consumer.",
    ],
    [
      "Federal Reserve consumer guidance separates a credit report from a credit score derived from report information.",
      "Because a score is calculated from recorded inputs, improving input accuracy differs from arguing about an opaque final number.",
      "A report and a score are identical documents.",
      "One contains source information while the other summarizes selected inputs.",
    ],
    [
      "Three major U.S. credit bureaus maintain separate files that can differ in reported account details.",
      "Because furnishers may update each bureau on different schedules, one file can show a balance another has not yet received.",
      "Every bureau file must be byte-for-byte identical at all times.",
      "Separate update paths allow temporary differences without changing the underlying account.",
    ],
  ] as const;
  const facts = factRows.map(([claim, becauseMechanism, commonError, errorIsWhy], index) => ({
    id: `ch01.fact.${index + 1}`,
    claim,
    becauseMechanism,
    commonError,
    errorIsWhy,
  }));
  const paraphraseNotes = Array.from({ length: 90 }, (_, index) => (
    `balance-${index + 1} reporting-snapshot payment-timing utilization-signal lender-visible evidence-choice.`
  )).join(" ").slice(0, 2_200);
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Optimize Your Credit Cards",
    focus: "visible account balances create a report-facing signal before repayment intent can supply later context.",
    coreClaim: "small payment and utilization choices can change lender-visible information before a bill is fully paid.",
    centralConcept: {
      id: "ch01.concept.credit",
      name: "Credit card optimization",
      plainDefinition: "Small payment and utilization choices change what lenders see.",
      whyItMatters: "The reader can improve the signal without pretending money is magic.",
    },
    keyClaims: facts.map((fact) => fact.claim),
    namedExamples: [
      {
        id: "ch01.case.fico",
        label: "FICO score range",
        summary: "FICO scores are commonly discussed on a 300 to 850 scale, and credit utilization is one report-facing part of credit behavior.",
        teachesWhat: "Credit behavior becomes a lender-facing signal.",
        hardSpecifics: ["300 to 850 scale", "credit utilization"],
        realWorld: true,
      },
      {
        id: "ch01.case.cfpb",
        label: "Consumer Financial Protection Bureau credit reports",
        summary: "The CFPB explains that credit reports collect account and payment information; lenders use account information when evaluating credit applications.",
        teachesWhat: "A report is an input, not a moral judgment.",
        hardSpecifics: ["credit reports", "lenders use account information"],
        realWorld: true,
      },
      {
        id: "ch01.case.federal-reserve",
        label: "Federal Reserve consumer credit report guidance",
        summary: "Federal Reserve consumer guidance describes account balances and payment history as concrete information available in credit reports.",
        teachesWhat: "Report-facing account data supplies observable evidence separate from private repayment intent.",
        hardSpecifics: ["Federal Reserve", "account balances and payment history"],
        realWorld: true,
      },
    ],
    hardEdge: "Do not promise an exact score increase. useful guidance changes visible evidence without claiming a guaranteed outcome or fixed effect size.",
    voiceCues: ["open with a visible account decision", "contrast reported evidence with private intent"],
    paraphraseNotes,
    testableFacts: facts,
    frameworks: [{ name: "Three-part credit signal", members: ["payment history", "utilization", "account age"] }],
  };
}

function creditBreakdown() {
  const fastRead = [
    "A card can send your balance before the bill is due.",
    "That date may shape what a lender can see.",
    "Your plan to pay later is still private.",
    "The file holds the sum sent by the card firm.",
    "So check both the due date and the report date.",
    "Paying early can lower the sum in that one view.",
    "No one can promise how much a score will move.",
    "Your first job is to make the file true.",
  ].join(" ");
  const deepRead = [
    "A credit file is a set of facts from past reports.",
    "It does not show each plan in your head.",
    "A bank may see the last sum sent by an issuer.",
    "That sum can arrive well before your next due date.",
    "A later on-time payment does not erase an old view.",
    "The two dates serve two different jobs.",
    "One date tells you when the bill must be paid.",
    "Another may tell the bureau what the account showed.",
    "You can ask the issuer when it sends that data.",
    "You can also read each bureau file for wrong facts.",
    "A low card sum uses less of the open limit.",
    "For example, one thousand of five thousand is twenty percent.",
    "The math is plain, but the timing can hide it.",
    "An early payment may change the next sent sum.",
    "A late file update may still show the old sum.",
    "Check the record before you trust the score.",
    "Private intent cannot replace facts already on file.",
    "Good habits make the seen data match your care.",
    "Bad data needs a fix, not a guess.",
    "Keep proof when you ask for an error to change.",
    "A clean file can still lead to many loan results.",
    "Treat each score claim as a bound, not a vow.",
  ].join(" ");
  const fullRead = [
    "Start with the last card bill and the live account view.",
    "Write down the balance, limit, due date, and close date.",
    "Then ask when the issuer sends data to each bureau.",
    "The answer may not match the day your bill is due.",
    "That gap is why a good plan checks both dates.",
    "Next, work out how much of the limit is in use.",
    "Divide the sent balance by the full open limit.",
    "A one thousand dollar sum on five thousand is twenty percent.",
    "This ratio is one part of the facts a lender sees.",
    "It is not a score by itself.",
    "It is not proof of your worth.",
    "It is one sign drawn from the credit file.",
    "Now choose a sum you can pay with no new debt.",
    "A small early payment can cut the next seen balance.",
    "Do not drain rent, food, or cash set aside for needs.",
    "The aim is sound cash use and true report data.",
    "After the payment clears, save the bank proof.",
    "Then check the next bill for the new amount.",
    "A bureau file may take more time to catch up.",
    "Read all three files if a loan date is near.",
    "One file can lag while another shows the new sum.",
    "That lag does not mean either score is fake.",
    "It means the paths may move at a different pace.",
    "If a field is wrong, note the exact account and sum.",
    "Send the proof through the bureau's stated dispute path.",
    "Keep the case code and each reply you get.",
    "Do not claim fraud when a slow update is enough.",
    "Do not ignore a clear error that stays in place.",
    "A calm record helps you tell those cases apart.",
    "Score tools may show a range from 300 to 850.",
    "That range can help name where a result sits.",
    "It cannot tell you why each lender made a choice.",
    "Loan firms may use more facts than one score.",
    "Rates, income, debt, and loan rules can also matter.",
    "Keep your claim small enough for the proof you have.",
    "Say the file changed when the file changed.",
    "Say the balance fell when the balance fell.",
    "Do not promise a set gain in points.",
    "No honest check can make that fixed vow.",
    "A useful routine can still be clear and firm.",
    "Review dates, pick a safe payment, and save proof.",
    "Then read the next report before you draw a result.",
    "Repeat the check when a large loan plan gets close.",
    "Skip it when the cost would harm a core need.",
    "The best move fits both the file and your cash.",
    "Seen facts guide the lender; sound limits guard you.",
    "Timing changes the signal before intent becomes public.",
    "Clear records beat bold score claims every time.",
    "Small checks work best when they fit a real pay plan.",
    "Each saved note gives the next choice a firm base.",
    "Facts come first, then action, then one more clear check.",
  ].join(" ");
  assert.ok(fastRead.length >= 350);
  assert.ok(deepRead.length >= 1_000);
  assert.ok(fullRead.length >= 2_400);
  return { fastRead, deepRead, fullRead };
}

function compilerOutputs(fixtureRoot: string) {
  const base = compileCreditFixture(BOOK, { stateRoot: fixtureRoot });
  const cleanBreakdown = creditBreakdown();
  const chapter = creditChapterSpec(BOOK);
  const packet = compileSourcePacketFromSidecar({
    bookId: BOOK,
    chapter,
    sidecar: chapterResearch(),
    sidecarPath: "inputs/source/ch01.source.json",
    sourceHash: "fixture-source-hash",
  });
  writeJsonFile(
    bookDesignPath(BOOK, { stateRoot: fixtureRoot }),
    deriveBookDesign(BOOK, { packets: [packet], chapters: 1 }),
  );
  const blueprint = compileChapterBlueprint({
    bookId: BOOK,
    chapter,
    packet,
    packetPath: "compiler/ch01/source-packet.json",
    roots: { stateRoot: fixtureRoot },
  });
  const anchorId = packet.allowedAnchors[0].id;
  const quizAnchorId = packet.allowedAnchors.find((anchor) => (
    anchor.id.includes(".fact.")
    && anchor.supportsClaimTypes.includes("quiz_prompt")
    && anchor.supportsClaimTypes.includes("quiz_key_evidence")
  ))?.id ?? anchorId;
  const summary = {
    ...base.summary,
    chapterId: blueprint.chapterId,
    hook: {
      ...base.summary.hook,
      sourceAnchorIds: [anchorId],
      counterintuitionSourceAnchorIds: [anchorId],
    },
    breakdown: {
      ...base.summary.breakdown,
      fastRead: cleanBreakdown.fastRead,
      deepRead: cleanBreakdown.deepRead,
      fullRead: cleanBreakdown.fullRead,
      sourceAnchorIds: { fastRead: [anchorId], deepRead: [anchorId], fullRead: [anchorId] },
    },
    keyTakeawaySourceAnchorIds: [anchorId],
    tryThisNowSourceAnchorIds: [anchorId],
    sourceFactIds: packet.facts.slice(0, 3).map((fact) => fact.id),
  };
  const examples = {
    ...base.examples,
    chapterId: blueprint.chapterId,
    examples: blueprint.sections.examples.map((slot, index) => {
      const template = base.examples.examples[index];
      assert.ok(template);
      const oldName = base.blueprint.sections.examples[index]?.allowedNames[0];
      const protagonist = slot.allowedNames[0]
        ?? blueprint.reservedVariety.allowedNames[index % blueprint.reservedVariety.allowedNames.length]
        ?? "Maya";
      const caseId = slot.requiredCaseIds[0] ?? packet.namedCases[0].id;
      const caseAnchor = packet.allowedAnchors.find((anchor) => anchor.id === caseId);
      const hardSpecifics = caseAnchor?.hardSpecifics?.slice(0, 2).join(" and ")
        ?? "credit reports and account balances";
      return {
        ...template,
        slotId: slot.slotId,
        scenario: oldName ? template.scenario.replaceAll(oldName, protagonist) : template.scenario,
        whyItMatters: `The action changes report-facing account information, so a smaller visible balance gives a lender different evidence to interpret. This example stays tied to ${hardSpecifics}.`,
        sourceAnchorIds: [caseId],
        sourceFactIds: [slot.requiredFactIds[0] ?? packet.facts[0].id],
        namedCaseIds: [caseId],
      };
    }),
  };
  const learning = {
    ...base.learning,
    chapterId: blueprint.chapterId,
    quiz: {
      ...base.learning.quiz,
      questions: blueprint.sections.quiz.map((slot, index) => {
        const template = base.learning.quiz.questions[index];
        assert.ok(template);
        const correct = template.choices[template.correctIndex];
        const distractors = template.choices.filter((_, choiceIndex) => choiceIndex !== template.correctIndex);
        const choices = ["", "", ""];
        choices[slot.correctIndex] = correct;
        choices[(slot.correctIndex + 1) % 3] = distractors[0];
        choices[(slot.correctIndex + 2) % 3] = distractors[1];
        const directLanguage = (value: string) => value
          .replace(/\bthe chapter logic\b/gi, "the account record")
          .replace(/\bthe chapter's\b/gi, "the account's")
          .replace(/\bthe chapter\b/gi, "the account logic")
          .replace(/\bchapter's\b/gi, "account guidance")
          .replace(/\bchapter\b/gi, "account guidance");
        return {
          ...template,
          questionId: slot.questionId,
          sourceAnchorIds: [quizAnchorId],
          keyEvidenceAnchorIds: [quizAnchorId],
          prompt: directLanguage(template.prompt),
          choices: choices.map(directLanguage),
          explanation: directLanguage(template.explanation),
          correctIndex: slot.correctIndex,
          depthLevel: slot.depthLevel,
        };
      }),
    },
    cards: {
      cards: blueprint.sections.cards.map((slot, index) => {
        const template = base.learning.cards.cards[index];
        assert.ok(template);
        const backs = [
          "Inspect the balance or utilization visible in the report, because that recorded account information is what a lender can later read.",
          "Compare the reported revolving balance with the available limit; together those two figures determine utilization for that snapshot.",
          "Check the issuer's reporting date before assuming the payment due date controls which balance appears in a credit file.",
          "Review the consumer disclosure for account fields that look wrong, then dispute recorded errors instead of guessing about an opaque score.",
          "Treat repayment intent and reported evidence as separate: a future payment plan cannot revise a snapshot that was already sent.",
          "Compare files from separate credit bureaus when timing matters, since furnishers can update those records on different schedules.",
          "Avoid promising a fixed score increase; improve accurate report-facing inputs while keeping any outcome claim properly bounded.",
        ];
        return {
          ...template,
          cardId: slot.cardId,
          front: template.front.replace(/\bthe chapter's\b/gi, "the account's"),
          back: backs[index],
          sourceAnchorIds: [anchorId],
          difficulty: slot.difficulty,
        };
      }),
    },
  };
  const action = {
    ...base.action,
    chapterId: blueprint.chapterId,
    tryThisNowSourceAnchorIds: [anchorId],
    implementationPlan: {
      ...base.action.implementationPlan,
      titleSourceAnchorIds: [anchorId],
      coreSkillSourceAnchorIds: [anchorId],
      ifThenPlans: base.action.implementationPlan.ifThenPlans.map((plan) => ({ ...plan, sourceAnchorIds: [anchorId] })),
      twentyFourHourChallengeSourceAnchorIds: [anchorId],
      weeklyPracticeSourceAnchorIds: [anchorId],
    },
  };
  return { summary, examples, learning, action };
}

/** A schema-valid reader-experience content object (the runtime stamps the
 *  schema/reviewerRole/rubricVersion + hash bindings on top). Empty findings +
 *  SHIP keep the panel PASS so the fixture book still promotes. */
function readerReview(questionCount: number): Record<string, unknown> {
  const scores: Record<string, number> = {};
  for (const factor of REVIEW_FACTORS) scores[factor] = 82;
  return {
    scores,
    // One derivation per question (R-133): the strict reader assembly rejects a
    // seat whose positional derivation does not cover the chapter's quiz.
    quizDerivation: {
      answers: Array.from({ length: questionCount }, () => "a"),
      mechanisms: Array.from({ length: questionCount }, (_value, index) => `the prose forces choice a in q${index + 1}`),
      confidence: Array.from({ length: questionCount }, () => "high"),
      ambiguities: Array.from({ length: questionCount }, () => ""),
      tells: [],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidence: [],
    weakestEvidence: [],
    oneParagraphVerdict: "The chapter is usable and clear.",
  };
}

class FixtureProcessSupervisor implements ProcessSupervisor {
  readonly specs: ProcessSpec[] = [];
  readonly #outputs: unknown[];

  constructor(outputs: readonly unknown[]) {
    this.#outputs = [...outputs];
  }

  async run(spec: ProcessSpec): Promise<ProcessResult> {
    // Fresh-qc runs the LLM answer-key judge once per quiz question. Answer every
    // judge call with a low-confidence verdict — never a confident wrong-key flag —
    // so the fixture book still promotes, without consuming the ordered pipeline
    // outputs. The judge system prompt is the reliable, count-independent marker.
    const isQuizKeyJudge = new TextDecoder().decode(spec.stdin).includes("answer-key auditor");
    const output = isQuizKeyJudge
      ? { index: 0, confidence: "low", correctText: "scripted judge choice", reason: "fixture judge verdict" }
      : this.#outputs.shift();
    if (output === undefined) throw new Error("fixture process received an unexpected model call");
    this.specs.push(spec);
    return {
      outcome: "EXITED",
      exitCode: 0,
      stdout: new TextEncoder().encode(JSON.stringify(output)),
      stderr: new Uint8Array(),
      stdoutTruncated: false,
      stderrTruncated: false,
    };
  }

  remaining(): number {
    return this.#outputs.length;
  }
}

requiredTest("production composition reaches isolated local promotion and exact current readback", async ({ roots }) => {
  const fixtureRoot = resolve(roots.tempRoot, "compiler-fixture");
  const compilerFixture = compilerOutputs(fixtureRoot);
  const supervisor = new FixtureProcessSupervisor([
    bibliography(),
    chapterResearch(),
    compilerFixture.summary,
    compilerFixture.examples,
    compilerFixture.learning,
    compilerFixture.action,
    // Canonical review = semantic panel: baseline model review first, then the
    // IMP-20 blind reader panel — three reader-experience seats per chapter.
    { outcome: "PASS", issues: [] },
    readerReview(compilerFixture.learning.quiz.questions.length),
    readerReview(compilerFixture.learning.quiz.questions.length),
    readerReview(compilerFixture.learning.quiz.questions.length),
  ]);
  const v25Root = resolve(roots.tempRoot, "composition-v25");
  const attemptRoot = resolve(roots.attemptsRoot, "composition-run");
  const logPath = resolve(roots.logsRoot, "composition-events.jsonl");
  const externalPackage = resolve(PIPELINE_ROOT, "book-packages", BOOK);
  assert.equal(existsSync(externalPackage), false, "fixture book must not preexist in production package root");

  const composition = await createProductionBookRunComposition({
    bookId: BOOK,
    pipelineRoot: PIPELINE_ROOT,
    v25Root,
    attemptRoot,
    logPath,
    processSupervisor: supervisor,
  });
  assert.ok(composition.app.bookRun, "production composition must expose book-run application service");
  const result = await composition.app.bookRun.run({
    bookId: BOOK,
    title: TITLE,
    author: AUTHOR,
    sourceGitSha: SOURCE_SHA,
    v25Root,
    attemptRoot,
    regen: false,
    maxRepairRounds: 1,
    promoteLocal: true,
    signal: new AbortController().signal,
  });

  const qcStatus = await composition.qcService.readStatus(BOOK);
  assert.equal(result.ok, true, JSON.stringify({ result, qcStatus }));
  assert.ok(result.ok);
  assert.equal(result.value.status, "PROMOTED");
  assert.equal(result.value.readback, "VERIFIED");
  assert.equal(result.value.bookRevision, 1);
  const pointer = await composition.currentPointerStore.read(BOOK);
  assert.ok(pointer.ok && pointer.value);
  assert.equal(pointer.value.candidateId, result.value.candidate.candidateId);
  assert.equal(pointer.value.manifestDigest, result.value.candidate.manifestDigest);
  assert.equal(pointer.value.revision, 1);
  const current = await composition.contentReader.open({ bookId: BOOK, selector: { kind: "CURRENT" } });
  assert.ok(current.ok);
  assert.equal(current.value.currentRevision, 1);
  assert.equal(current.value.manifest.manifestDigest, result.value.candidate.manifestDigest);
  assert.equal(current.value.files.filter((file) => file.kind === "CHAPTER").length, 1);

  const judgeSpecCount = (specs: readonly ProcessSpec[]): number =>
    specs.filter((spec) => new TextDecoder().decode(spec.stdin).includes("answer-key auditor")).length;
  const judgeInitial = judgeSpecCount(supervisor.specs);
  assert.ok(judgeInitial >= 1, "at least one quiz-key judge task must cross the process boundary during live fresh-qc");
  assert.equal(
    supervisor.specs.length,
    10 + judgeInitial,
    "research, compiler, baseline review, three-seat reader panel, plus one fresh-qc quiz-key judge call per quiz question",
  );
  assert.equal(supervisor.remaining(), 0);
  assert.ok(
    supervisor.specs.some((spec) => new TextDecoder().decode(spec.stdin).includes("READER-EXPERIENCE REVIEW")),
    "a reader-experience task must cross the process boundary during canonical review",
  );
  assert.ok(
    supervisor.specs.some((spec) => new TextDecoder().decode(spec.stdin).includes("answer-key auditor")),
    "a quiz-key-judge task must cross the process boundary during live fresh-qc",
  );
  for (const spec of supervisor.specs) {
    // Task 7 Step 6 flip: the D1 default route is now claude-cli (Sonnet 5).
    assert.equal(spec.command, "claude");
    assert.equal(spec.environment.OPENAI_API_KEY, undefined);
    assert.equal(spec.environment.ANTHROPIC_API_KEY, undefined);
    assert.equal(spec.environment.CHAPTERFLOW_PROVIDER, undefined);
  }
  const events = readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { phase: string; status: string });
  assert.deepEqual(events.filter((event) => event.status === "COMPLETED").map((event) => event.phase), [
    "intake", "research", "seed", "compile", "review", "fresh-qc", "promotion",
  ]);
  assert.ok(events.some((event) => event.phase === "repair" && event.status === "SKIPPED"));
  assert.equal(existsSync(externalPackage), false, "local promotion must not write production package root");

  const resumed = await composition.app.bookRun.run({
    bookId: BOOK,
    title: TITLE,
    author: AUTHOR,
    sourceGitSha: SOURCE_SHA,
    v25Root,
    attemptRoot,
    resumeRunId: result.value.runId,
    regen: false,
    maxRepairRounds: 1,
    promoteLocal: true,
    signal: new AbortController().signal,
  });
  assert.equal(resumed.ok, true, JSON.stringify(resumed));
  assert.ok(resumed.ok);
  assert.equal(resumed.value.runId, result.value.runId);
  assert.deepEqual(resumed.value.candidate, result.value.candidate);
  assert.equal(resumed.value.bookRevision, result.value.bookRevision);
  assert.equal(resumed.value.readback, "VERIFIED");
  assert.equal(
    supervisor.specs.length,
    10 + judgeInitial,
    "resume reuses all settled attempts including the durable fresh-qc round — the non-deterministic quiz-key judge never re-runs",
  );
  assert.equal(judgeSpecCount(supervisor.specs), judgeInitial, "the fresh-qc quiz-key judge runs once and is reused from the durable round on resume");
  const resumedEvents = readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { phase: string; status: string });
  assert.equal(
    resumedEvents.filter((event) => event.phase === "research" && event.status === "COMPLETED").length,
    1,
    "resume must not repeat completed research phase",
  );
  assert.equal(
    resumedEvents.filter((event) => event.phase === "seed" && event.status === "COMPLETED").length,
    1,
    "resume must reuse exact immutable seed",
  );
  assert.equal(existsSync(externalPackage), false, "resume must stay inside isolated roots");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
