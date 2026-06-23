import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";

import { assembleChapterV21 } from "../src/assembler.js";
import {
  createGenerationRunManifest,
  createGenerationDegradationWaiver,
  evaluateGenerationDebt,
  recordGenerationDegradation,
  type GenerationDegradableStage,
  type GenerationRunManifestV1,
} from "../src/generationDegradation.js";
import { generateChapter, type BookMeta, type ChapterSpec, type GenerateChapterAgents } from "../src/generateChapter.js";
import { readerContentHash } from "../src/lib/readerContent.js";
import type { BookBrief, ChapterDesignDoc, SourceAnchorForPrompt } from "../src/types.js";
import { TMP_DIR, writeCanonicalIndexFixture } from "./helpers.js";
import { test } from "./harness.js";

const BOOK = "zz-fixture-generation-debt";
const CHAPTER_ID = `${BOOK}-ch01`;

const ANCHORS: SourceAnchorForPrompt[] = [
  {
    id: "ch01.concept.harbor",
    kind: "concept",
    label: "Harbor Checkpoint",
    text: "A synthetic checkpoint preserves evidence before a handoff.",
    supportsClaimTypes: ["core_move", "hook", "breakdown_claim", "implementation_guidance", "takeaway"],
  },
  {
    id: "ch01.fact.1",
    kind: "testable_fact",
    label: "Tuesday intake",
    text: "The Tuesday intake review caught six errors while source context was still visible.",
    supportsClaimTypes: ["quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card", "takeaway"],
  },
  {
    id: "ch01.ex.1",
    kind: "named_example",
    label: "Lantern Ledger",
    text: "Lantern Ledger used a source-backed example with a named audit trail.",
    supportsClaimTypes: ["example"],
  },
];

function bookMeta(): BookMeta {
  return { bookId: BOOK, title: "Generation Debt", author: "Fixture Author" };
}

function chapterSpec(): ChapterSpec {
  return { chapterId: CHAPTER_ID, chapterNumber: 1, chapterTitle: "The harbor checkpoint" };
}

function validBrief(): BookBrief {
  return {
    bookId: BOOK,
    title: "Generation Debt",
    author: "Fixture Author",
    thesisParagraph: "A synthetic thesis says fallback output must remain visible and pass the same gates as primary output.",
    coreIdeas: [
      { name: "Visible debt", oneSentence: "Record fallback use.", mentalMove: "Stamp the event.", sourceAnchors: ["ch01.fact.1"] },
      { name: "Same gate", oneSentence: "Validate fallback output.", mentalMove: "Run the same checks.", sourceAnchors: ["ch01.fact.1"] },
      { name: "Bound waivers", oneSentence: "Waivers bind to content.", mentalMove: "Hash the exact output.", sourceAnchors: ["ch01.fact.1"] },
    ],
    targetReader: "Pipeline operators.",
    voiceCharter: {
      register: "plainspoken",
      person: "second",
      cadence: "medium",
      signatureMoves: ["name the operational decision"],
      avoidMoves: ["hide fallback state"],
    },
    teachingArc: "Every fallback remains auditable.",
    forbiddenMoves: ["Do not hide fallback state."],
  };
}

function validPlan(): ChapterDesignDoc {
  return {
    chapterId: CHAPTER_ID,
    number: 1,
    title: "The harbor checkpoint",
    coreMove: "Record every fallback as durable quality debt before the artifact can look complete.",
    coreMoveSourceAnchorIds: ["ch01.concept.harbor"],
    exampleCount: 1,
    exampleSpecs: [
      {
        domain: "support audit workflow",
        audience: "a pipeline operator",
        stakes: "a fallback looking clean",
        format: "vignette",
        requiredBeat: "the operator notices the fallback before promotion",
        sourceAnchorIds: ["ch01.ex.1"],
      },
    ],
    quizFocus: { count: 2, bloomsMix: { apply: 2 }, transferEmphasis: 1, sourceAnchorIds: ["ch01.fact.1"] },
    cardFocus: { count: 1, retrievalPractice: true, sourceAnchorIds: ["ch01.fact.1"] },
    readingTimeMinutes: 6,
  };
}

function sourceEvidence(): any {
  return {
    schemaVersion: "planning-source-evidence-v1",
    bookId: BOOK,
    chapterNumber: 1,
    bookSource: null,
    toc: null,
    chapterSource: null,
    chapterSidecar: { schemaVersion: "source-v2", chapterNumber: 1 },
    chapterSidecarPath: "/tmp/source/ch01.source.json",
    chapterSourcePath: null,
    bookSourcePath: null,
    tocPath: null,
    sourceHash: "sha256:source",
    anchorCatalogHash: "sha256:anchors",
    anchors: ANCHORS,
    available: true,
    sourceV2: true,
  };
}

function manifest(): GenerationRunManifestV1 {
  return createGenerationRunManifest({
    runId: "run-generation-debt",
    chapterId: CHAPTER_ID,
    authorSessionId: "author-session",
    provider: { tier: "writer", provider: "anthropic-cli", model: "fixture-model" },
    codeVersion: "test-code",
    sourceHash: "sha256:source",
    sourceAnchorCatalogHash: "sha256:anchors",
    planHash: "sha256:plan",
    createdAt: "2026-06-23T00:00:00.000Z",
  });
}

function validAssembleInput(generation = manifest()): any {
  return {
    plan: validPlan(),
    breakdown: {
      fastRead: "Fast read text with a concrete source-backed checkpoint.",
      deepRead: "Deep read text explains why the checkpoint preserves source context before the handoff.",
      fullRead: "Full read text adds limits, risks, and the operational reason fallback debt must stay visible.",
      sourceAnchorIds: {
        fastRead: ["ch01.concept.harbor"],
        deepRead: ["ch01.concept.harbor"],
        fullRead: ["ch01.concept.harbor"],
      },
    },
    examples: [
      {
        exampleId: "ex01",
        sourceAnchorIds: ["ch01.ex.1"],
        title: "Lantern Ledger fallback review",
        scenario: "Rina opens the Lantern Ledger after a fallback run and sees the event before anyone treats the file as clean.",
        whatToDo: "Keep the event attached to the chapter and rerun the same validation path used for primary output.",
        whyItMatters: "A fallback that keeps its source anchor can still be reviewed honestly before promotion.",
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        {
          questionId: "q01",
          sourceAnchorIds: ["ch01.fact.1"],
          keyEvidenceAnchorIds: ["ch01.fact.1"],
          prompt: "When a fallback is used, what should the operator check first?",
          choices: ["The durable event", "The clean-looking file", "The old log line"],
          correctIndex: 0,
          explanation: "The durable event is the only record promotion can evaluate later.",
          bloomsLevel: "apply",
          depthLevel: "standard",
        },
        {
          questionId: "q02",
          sourceAnchorIds: ["ch01.fact.1"],
          keyEvidenceAnchorIds: ["ch01.fact.1"],
          prompt: "Which waiver is acceptable for a serious degradation?",
          choices: ["One bound to this exact content", "One copied from another chapter", "One with no output hash"],
          correctIndex: 0,
          explanation: "The waiver must bind to the event and the exact reader-facing content.",
          bloomsLevel: "apply",
          depthLevel: "standard",
        },
      ],
    },
    cards: {
      cards: [
        {
          cardId: "rc01",
          sourceAnchorIds: ["ch01.fact.1"],
          front: "What makes fallback debt promotable later?",
          back: "A durable event plus an exact-content waiver when the debt is serious.",
          difficulty: "easy",
        },
      ],
    },
    implementationPlan: {
      title: "Stamp fallback debt clearly",
      titleSourceAnchorIds: ["ch01.concept.harbor"],
      coreSkill: "Keep fallback use visible as durable quality debt so later promotion can evaluate the exact content.",
      coreSkillSourceAnchorIds: ["ch01.concept.harbor"],
      ifThenPlans: [
        { sourceAnchorIds: ["ch01.concept.harbor"], context: "a stage fails", plan: "If a stage fails, then record the fallback before assembling output." },
        { sourceAnchorIds: ["ch01.concept.harbor"], context: "a waiver is requested", plan: "If a waiver is requested, then bind it to the exact event and content hashes." },
        { sourceAnchorIds: ["ch01.concept.harbor"], context: "promotion runs", plan: "If promotion runs, then block unresolved serious debt." },
      ],
      twentyFourHourChallenge: "Review one chapter artifact and confirm fallback state is visible.",
      twentyFourHourChallengeSourceAnchorIds: ["ch01.concept.harbor"],
      weeklyPractice: "Each week, sample generated chapters for unresolved serious degradation.",
      weeklyPracticeSourceAnchorIds: ["ch01.concept.harbor"],
    },
    keyTakeaway: "Fallback output can proceed only when it stays visible, source-bound, and available for promotion to block or waive.",
    keyTakeawaySourceAnchorIds: ["ch01.concept.harbor"],
    hook: {
      hook: "A fallback is not clean just because the file exists.",
      sourceAnchorIds: ["ch01.concept.harbor"],
    },
    tryThisNow: "Open the newest chapter artifact and find its fallback ledger before reading the prose.",
    tryThisNowSourceAnchorIds: ["ch01.concept.harbor"],
    sourceEvidence: sourceEvidence(),
    generation,
  };
}

test("degradable stage failures create durable events with fallback and disposition", () => {
  const stages: GenerationDegradableStage[] = [
    "voice-pass",
    "line-editor",
    "try-this-now",
    "memorable-lines",
    "writer-example",
    "categorizer",
  ];
  const run = manifest();

  for (const stage of stages) {
    recordGenerationDegradation(run, {
      stage,
      inputHashes: { input: `sha256:${stage}` },
      error: new Error(`${stage} injected failure`),
      attemptCount: 2,
      fallbackUsed: { kind: `${stage}-fallback`, policy: "availability", reason: "synthetic regression" },
      fallbackOutput: { stage, ok: true },
      severity: stage === "categorizer" ? "advisory" : "serious",
      requiredDisposition: stage === "categorizer" ? "visible_advisory" : "resolve_before_production",
      observedAt: "2026-06-23T00:00:00.000Z",
    });
  }

  assert.deepEqual(run.degradations.map((event) => event.stage), stages);
  for (const event of run.degradations) {
    assert.ok(event.eventId.startsWith("gde_"));
    assert.equal(event.attemptCount, 2);
    assert.ok(event.fallbackUsed.kind.endsWith("fallback"));
    assert.ok(event.outputHash.startsWith("sha256:"));
    assert.match(event.error.message, /injected failure/);
    assert.ok(event.requiredDisposition === "resolve_before_production" || event.requiredDisposition === "visible_advisory");
  }
});

test("promotion debt evaluation blocks unresolved serious degradation and honors exact-content waivers", () => {
  const run = manifest();
  const event = recordGenerationDegradation(run, {
    stage: "line-editor",
    inputHashes: { draft: "sha256:draft" },
    error: new Error("line editor unavailable"),
    attemptCount: 1,
    fallbackUsed: { kind: "voice-passed-draft", policy: "availability", reason: "line editor failed after voice pass" },
    fallbackOutput: { kept: "voice draft" },
    severity: "serious",
    requiredDisposition: "resolve_before_production",
    observedAt: "2026-06-23T00:00:00.000Z",
  });
  const assembled = assembleChapterV21(validAssembleInput(run));
  assert.equal(assembled.ok, true, assembled.ok ? "" : JSON.stringify(assembled.findings));
  if (!assembled.ok) throw new Error("assemble failed");

  const blocked = evaluateGenerationDebt(BOOK, [assembled.chapter], { waivers: [] });
  assert.equal(blocked.totalBlockers, 1);
  assert.match(blocked.findings[0].message, /line-editor/);

  const waiver = createGenerationDegradationWaiver({
    bookId: BOOK,
    chapterId: CHAPTER_ID,
    event,
    chapterReaderContentHash: readerContentHash(assembled.chapter),
    waivedBy: "codex-qc:fixture",
    reason: "Fixture waiver binds this exact fallback output.",
    createdAt: "2026-06-23T00:00:00.000Z",
  });
  const waived = evaluateGenerationDebt(BOOK, [assembled.chapter], { waivers: [waiver] });
  assert.equal(waived.totalBlockers, 0);
  assert.equal(waived.waived.length, 1);

  assembled.chapter.keyTakeaway += " Changed.";
  const stale = evaluateGenerationDebt(BOOK, [assembled.chapter], { waivers: [waiver] });
  assert.equal(stale.totalBlockers, 1, "content-bound waiver must stale when reader content changes");
});

test("fallback examples cannot bypass source-anchor validation", () => {
  const input = validAssembleInput();
  input.examples[0] = {
    ...input.examples[0],
    sourceAnchorIds: ["ch01.fact.404"],
    scenario: "Rina invents an unsupported fallback scene with no matching source anchor.",
  };

  const result = assembleChapterV21(input);
  assert.equal(result.ok, false);
  assert.ok(
    result.findings.some((finding) => finding.path === "/examples/0/sourceAnchorIds/0"),
    `expected source-anchor finding, got ${JSON.stringify(result.findings)}`,
  );
});

test("valid fallback output can assemble while remaining visible in generation provenance", () => {
  const run = manifest();
  recordGenerationDegradation(run, {
    stage: "try-this-now",
    inputHashes: { plan: "sha256:plan" },
    error: new Error("try-this-now timed out"),
    attemptCount: 1,
    fallbackUsed: { kind: "omitted-optional-callout", policy: "availability", reason: "optional support stage failed" },
    fallbackOutput: null,
    severity: "serious",
    requiredDisposition: "resolve_before_production",
    observedAt: "2026-06-23T00:00:00.000Z",
  });
  const input = validAssembleInput(run);
  delete input.tryThisNow;
  delete input.tryThisNowSourceAnchorIds;

  const result = assembleChapterV21(input);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.findings));
  if (!result.ok) throw new Error("assemble failed");
  assert.equal(result.chapter.schemaVersion, "chapterflow-v21-authored");
  assert.equal(result.chapter.authoring?.generation?.schemaVersion, "chapter-generation-run-v1");
  assert.equal(result.chapter.authoring?.generation?.degradations[0]?.stage, "try-this-now");
});

test("generated chapter assembly stamps canonical schema and generation provenance", () => {
  const run = manifest();
  const result = assembleChapterV21(validAssembleInput(run));
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.findings));
  if (!result.ok) throw new Error("assemble failed");
  assert.equal(result.chapter.schemaVersion, "chapterflow-v21-authored");
  assert.equal(result.chapter.authoring?.schemaVersion, "chapter-authoring-v1");
  assert.equal(result.chapter.authoring?.generation?.runId, "run-generation-debt");
  assert.equal(result.chapter.authoring?.generation?.authorSessionId, "author-session");
  assert.equal(result.chapter.authoring?.generation?.provider.model, "fixture-model");
  assert.equal(result.chapter.authoring?.generation?.sourceHash, "sha256:source");
  assert.equal(result.chapter.authoring?.generation?.planHash, "sha256:plan");
});

test("generation array misalignment fails before chapter output is written", async () => {
  const root = resolve(TMP_DIR, "generation-debt-prewrite");
  const stateRoot = resolve(root, "state");
  rmSync(root, { recursive: true, force: true });
  writeCanonicalIndexFixture(BOOK, [{ chapterId: CHAPTER_ID, number: 1, title: "The harbor checkpoint" }], resolve(stateRoot, "indexes"));
  const outPath = resolve(stateRoot, "chapters", `${CHAPTER_ID}.v21-native.chapter.json`);
  const priorAllow = process.env.CHAPTERFLOW_ALLOW_MODEL_GEN;
  process.env.CHAPTERFLOW_ALLOW_MODEL_GEN = "1";
  try {
    const agents: Partial<GenerateChapterAgents> = {
      runEditorInChief: async () => validBrief(),
      runCurriculumPlanner: async () => validPlan(),
      runWriterHook: async () => ({ hook: "A fallback is not clean just because the file exists." }),
      runWriterBreakdown: async () => ({
        fastRead: "Fast read text with a concrete checkpoint.",
        deepRead: "Deep read text explains the checkpoint.",
        fullRead: "Full read text explains limits and risks.",
      }),
      runVoicePass: async ({ draft }: any) => draft,
      runLineEditor: async ({ draft }: any) => draft,
      runWriterExample: async () => ({
        exampleId: "ex01",
        title: "Lantern Ledger review",
        scenario: "Rina opens the Lantern Ledger after the fallback run and sees the event before anyone treats the file as clean.",
        whatToDo: "Keep the event attached to the chapter and rerun the same validation path used for primary output.",
        whyItMatters: "A fallback that keeps its evidence can still be reviewed honestly before promotion.",
      }),
      runWriterQuiz: async () => ({
        passingScorePercent: 70,
        questions: [
          {
            questionId: "q01",
            prompt: "When a fallback is used, what should the operator inspect?",
            choices: ["The durable event", "The old log line", "The clean-looking file"],
            correctIndex: 0,
            explanation: "The durable event is the only record promotion can evaluate later.",
            bloomsLevel: "apply",
            depthLevel: "standard",
          },
        ],
      }),
      runWriterCards: async () => ({
        cards: [{ cardId: "rc01", front: "What makes fallback debt visible?", back: "The durable event stays with the generated artifact.", difficulty: "easy" }],
      }),
      runWriterImplementationPlan: async () => ({
        title: "Stamp fallback debt clearly",
        coreSkill: "Keep fallback use visible as durable quality debt so later promotion can evaluate the exact content.",
        ifThenPlans: [
          { context: "a stage fails", plan: "If a stage fails, then record the fallback before assembling output." },
          { context: "a waiver is requested", plan: "If a waiver is requested, then bind it to the exact event and content hashes." },
          { context: "promotion runs", plan: "If promotion runs, then block unresolved serious debt." },
        ],
        twentyFourHourChallenge: "Review one chapter artifact and confirm fallback state is visible.",
        weeklyPractice: "Each week, sample generated chapters for unresolved serious degradation.",
      }),
      generateKeyTakeaway: async () => ({ keyTakeaway: "Fallback output can proceed only when it stays visible, source-bound, and available for promotion to block or waive." }),
      runTryThisNow: async () => ({ tryThisNow: "Open the newest chapter artifact and find its fallback ledger before reading the prose." }),
      runMemorableLines: async () => ({ memorableLines: [] }),
    };

    await assert.rejects(
      () =>
        generateChapter(bookMeta(), chapterSpec(), {
          stateRoot,
          candidatesPerSlot: 1,
          logger: () => {},
          agents,
        }),
      /assembler_contract|quizFocus\.count|AssemblyValidationError/,
    );
    assert.equal(existsSync(outPath), false, "failed generation must not leave a complete-looking chapter file");
    assert.equal(existsSync(`${outPath}.cache-manifest.json`), false, "failed generation must not leave a chapter cache manifest");
  } finally {
    if (priorAllow === undefined) delete process.env.CHAPTERFLOW_ALLOW_MODEL_GEN;
    else process.env.CHAPTERFLOW_ALLOW_MODEL_GEN = priorAllow;
    rmSync(root, { recursive: true, force: true });
  }
});

test("degradation manifest sidecar preserves raw observations beside effective chapter output", () => {
  const run = manifest();
  const event = recordGenerationDegradation(run, {
    stage: "voice-pass",
    inputHashes: { draft: "sha256:draft" },
    error: new Error("voice pass iteration failed"),
    attemptCount: 3,
    fallbackUsed: { kind: "prior-voice-pass-output", policy: "availability", reason: "last clean iteration retained" },
    fallbackOutput: { fastRead: "kept" },
    severity: "serious",
    requiredDisposition: "resolve_before_production",
    observedAt: "2026-06-23T00:00:00.000Z",
  });
  const result = assembleChapterV21(validAssembleInput(run));
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.findings));
  if (!result.ok) throw new Error("assemble failed");

  const raw = result.chapter.authoring?.generation?.degradations[0];
  assert.equal(raw?.eventId, event.eventId);
  assert.equal(raw?.error.message, "voice pass iteration failed");
  assert.equal(raw?.fallbackUsed.kind, "prior-voice-pass-output");
  assert.equal(raw?.requiredDisposition, "resolve_before_production");
  assert.ok(raw?.inputHashes.draft);
});
