import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { checkChapterProvenance } from "../src/critics/sourceGrounding.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import {
  currentProviderIdentity,
  validateStageCache,
  writeStageCacheManifest,
} from "../src/cache/stageCache.js";
import {
  buildBriefCacheInputs,
  buildChapterCacheInputs,
  buildPlanCacheInputs,
  generateChapter,
  type BookMeta,
  type ChapterSpec,
} from "../src/generateChapter.js";
import { stripInternalFields } from "../src/lib/readerContent.js";
import { buildProductionManifest } from "../src/productionManifest.js";
import { loadPlanningSourceEvidence } from "../src/source/sourceEvidence.js";
import type { BookBrief, ChapterDesignDoc, ChapterV21 } from "../src/types.js";
import { makeChapter, TMP_DIR, writeCanonicalIndexFixture, writeResearchRunManifestFixture } from "./helpers.js";
import { test } from "./harness.js";

const BOOK = "zz-fixture-source-anchors";

function sidecar(chapterNumber = 1): any {
  const nn = String(chapterNumber).padStart(2, "0");
  return {
    schemaVersion: "source-v2",
    chapterNumber,
    chapterTitle: "The harbor principle",
    centralConcept: {
      id: `ch${nn}.concept.harbor`,
      name: "Harbor Principle",
      plainDefinition: "A synthetic concept used for provenance tests.",
    },
    keyClaims: ["Synthetic claim."],
    namedExamples: [
      {
        id: `ch${nn}.ex.lantern`,
        label: "Lantern Ledger",
        summary: "The lantern ledger case turns on beacon, quay, and cargo specifics.",
        teachesWhat: "Use concrete source examples.",
        hardSpecifics: ["lantern", "ledger", "beacon"],
        realWorld: false,
      },
      {
        id: `ch${nn}.ex.compass`,
        label: "Compass Review",
        summary: "The compass review case turns on tide, mast, and anchor specifics.",
        teachesWhat: "Check early evidence.",
        hardSpecifics: ["compass", "tide", "mast"],
        realWorld: false,
      },
      {
        id: `ch${nn}.ex.quay`,
        label: "Quay Handoff",
        summary: "The quay handoff case turns on harbor, cargo, and beacon specifics.",
        teachesWhat: "Preserve audit trails.",
        hardSpecifics: ["quay", "cargo", "harbor"],
        realWorld: false,
      },
    ],
    hardEdge: "Do not replace source evidence with generic memory.",
    testableFacts: Array.from({ length: 9 }, (_, i) => ({
      id: `ch${nn}.fact.${i + 1}`,
      claim: `Synthetic fact ${i + 1}`,
      becauseMechanism: `Synthetic mechanism ${i + 1}`,
      commonError: `Synthetic error ${i + 1}`,
      errorIsWhy: `Synthetic correction ${i + 1}`,
    })),
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fixtureRoot(name: string): string {
  return resolve(TMP_DIR, `source-anchored-planning-${name}`);
}

function writeSourceRun(root: string, bookId = BOOK, chapterNumber = 1, source = sidecar(chapterNumber)): { stateRoot: string; runsRoot: string; sidecarPath: string } {
  const stateRoot = resolve(root, "state");
  const runsRoot = resolve(root, "runs");
  const runDir = resolve(runsRoot, bookId, "run-a");
  writeResearchRunManifestFixture({
    runDir,
    bookId,
    chapters: [{ number: chapterNumber, title: source.chapterTitle ?? `Chapter ${chapterNumber}` }],
  });
  mkdirSync(resolve(runDir, "source-freeze"), { recursive: true });
  writeFileSync(resolve(runDir, "source-freeze", "book-source.md"), "Synthetic book source says evidence comes first.\n", "utf8");
  writeJson(resolve(runDir, "source-freeze", "toc.json"), [{ number: chapterNumber, title: source.chapterTitle ?? `Chapter ${chapterNumber}` }]);
  const sidecarPath = resolve(runDir, "sidecars", "source", `ch${String(chapterNumber).padStart(2, "0")}.source.json`);
  writeJson(sidecarPath, source);
  return { stateRoot, runsRoot, sidecarPath };
}

function bookMeta(bookId = BOOK): BookMeta {
  return { bookId, title: "Source Anchors", author: "Fixture Author" };
}

function chapterSpec(bookId = BOOK, n = 1): ChapterSpec {
  return {
    chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: "The harbor principle",
  };
}

function validBrief(): BookBrief {
  return {
    bookId: BOOK,
    title: "Source Anchors",
    author: "Fixture Author",
    thesisParagraph: "A synthetic thesis says source evidence must precede every design decision in the chapter pipeline.",
    sourceAnchorIds: ["ch01.fact.1"],
    coreIdeas: [
      { name: "Evidence first", oneSentence: "Load evidence before planning.", mentalMove: "Check the sidecar.", sourceAnchors: ["ch01.fact.1"] },
      { name: "Anchors travel", oneSentence: "Carry anchors to each unit.", mentalMove: "Attach IDs.", sourceAnchors: ["ch01.fact.2"] },
      { name: "Projection strips", oneSentence: "Reader payloads omit internals.", mentalMove: "Project public content.", sourceAnchors: ["ch01.fact.3"] },
    ],
    targetReader: "Operators hardening a generation pipeline.",
    voiceCharter: {
      register: "plainspoken",
      person: "second",
      cadence: "medium",
      signatureMoves: ["open concretely", "name the decision"],
      avoidMoves: ["generic planning", "memory-only claims"],
    },
    teachingArc: "Evidence flows from source to plan to prose.",
    forbiddenMoves: ["Do not plan from memory.", "Do not fabricate anchors.", "Do not ship authoring internals."],
  };
}

function validPlan(): ChapterDesignDoc {
  return {
    chapterId: `${BOOK}-ch01`,
    number: 1,
    title: "The harbor principle",
    coreMove: "Check the validated source sidecar before choosing the chapter's teaching move.",
    coreMoveSourceAnchorIds: ["ch01.fact.1"],
    exampleCount: 3,
    exampleSpecs: [0, 1, 2].map((i) => ({
      domain: `source audit workflow ${i + 1}`,
      audience: "a pipeline operator",
      stakes: "preventing memory-based planning from shipping",
      format: "vignette",
      requiredBeat: "the operator checks the anchor before writing the unit",
      sourceAnchorIds: ["ch01.ex.lantern"],
    })),
    quizFocus: { count: 6, bloomsMix: { apply: 6 }, transferEmphasis: 1, sourceAnchorIds: ["ch01.fact.2"] },
    cardFocus: { count: 3, retrievalPractice: true, sourceAnchorIds: ["ch01.fact.3"] },
    readingTimeMinutes: 7,
  };
}

function fullyAnchorLegacyUnits(chapter: ReturnType<typeof makeChapter>): void {
  for (const example of chapter.examples) example.sourceAnchorId = "ch01.fact.1";
  for (const question of chapter.quiz.questions) question.sourceAnchorId = "ch01.fact.2";
  for (const card of chapter.reviewCards) card.sourceAnchorId = "ch01.fact.3";
  for (const item of chapter.implementationPlan.ifThenPlans) item.sourceAnchorId = "ch01.fact.4";
}

test("source-v2 provenance requires anchors for every claim-bearing chapter unit, not only legacy arrays", () => {
  const chapter = makeChapter(BOOK, 1);
  fullyAnchorLegacyUnits(chapter);

  const findings = checkChapterProvenance(chapter, sidecar());
  const messages = findings.map((finding) => finding.message).join("\n");

  for (const unit of [
    "hook",
    "counterintuition",
    "breakdown.fastRead",
    "breakdown.deepRead",
    "breakdown.fullRead",
    "keyTakeaway",
    "implementationPlan.coreSkill",
    "implementationPlan.twentyFourHourChallenge",
    "implementationPlan.weeklyPractice",
    "memorableLines[0]",
  ]) {
    assert.match(messages, new RegExp(unit.replace(/[.[\]]/g, "\\$&")), `${unit} must require source anchors`);
  }
});

function fullyAnchoredChapter(): ChapterV21 {
  const chapter = makeChapter(BOOK, 1);
  for (const example of chapter.examples) {
    example.sourceAnchorId = "ch01.ex.lantern";
    example.sourceAnchorIds = ["ch01.ex.lantern"];
    example.scenario += " Lantern ledger beacon.";
  }
  for (const question of chapter.quiz.questions) {
    question.sourceAnchorId = "ch01.fact.2";
    question.sourceAnchorIds = ["ch01.fact.2"];
    question.keyEvidenceAnchorIds = ["ch01.fact.2"];
  }
  for (const card of chapter.reviewCards) {
    card.sourceAnchorId = "ch01.fact.3";
    card.sourceAnchorIds = ["ch01.fact.3"];
  }
  chapter.implementationPlan.titleSourceAnchorIds = ["ch01.fact.4"];
  chapter.implementationPlan.coreSkillSourceAnchorIds = ["ch01.fact.4"];
  chapter.implementationPlan.twentyFourHourChallengeSourceAnchorIds = ["ch01.fact.4"];
  chapter.implementationPlan.weeklyPracticeSourceAnchorIds = ["ch01.fact.4"];
  for (const item of chapter.implementationPlan.ifThenPlans) {
    item.sourceAnchorId = "ch01.fact.4";
    item.sourceAnchorIds = ["ch01.fact.4"];
  }
  const effectiveAnchors: Record<string, string[]> = {
    hook: ["ch01.fact.1"],
    counterintuition: ["ch01.fact.1"],
    "breakdown.fastRead": ["ch01.fact.1"],
    "breakdown.deepRead": ["ch01.fact.1"],
    "breakdown.fullRead": ["ch01.fact.1"],
    keyTakeaway: ["ch01.fact.1"],
    tryThisNow: ["ch01.fact.4"],
    "implementationPlan.title": ["ch01.fact.4"],
    "implementationPlan.coreSkill": ["ch01.fact.4"],
    "implementationPlan.twentyFourHourChallenge": ["ch01.fact.4"],
    "implementationPlan.weeklyPractice": ["ch01.fact.4"],
  };
  chapter.examples.forEach((_, i) => {
    effectiveAnchors[`examples[${i}]`] = ["ch01.ex.lantern"];
  });
  chapter.quiz.questions.forEach((_, i) => {
    effectiveAnchors[`quiz.questions[${i}]`] = ["ch01.fact.2"];
    effectiveAnchors[`quiz.questions[${i}].keyEvidence`] = ["ch01.fact.2"];
  });
  chapter.reviewCards.forEach((_, i) => {
    effectiveAnchors[`reviewCards[${i}]`] = ["ch01.fact.3"];
  });
  chapter.implementationPlan.ifThenPlans.forEach((_, i) => {
    effectiveAnchors[`implementationPlan.ifThenPlans[${i}]`] = ["ch01.fact.4"];
  });
  chapter.memorableLines?.forEach((line, i) => {
    line.sourceAnchorIds = ["ch01.fact.1"];
    effectiveAnchors[`memorableLines[${i}]`] = ["ch01.fact.1"];
  });
  chapter.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "test-source-hash",
      sourceSidecarPath: "/tmp/source.json",
      observedAnchorIds: ["ch01.concept.harbor", "ch01.ex.lantern", ...Array.from({ length: 9 }, (_, i) => `ch01.fact.${i + 1}`)],
      effectiveAnchors,
    },
  };
  return chapter;
}

test("source-v2 provenance passes when every claim-bearing unit has valid allowed anchors", () => {
  const findings = checkChapterProvenance(fullyAnchoredChapter(), sidecar());
  assert.deepEqual(findings, []);
});

test("source-v2 provenance rejects nonexistent, wrong-chapter, placeholder, and unsupported anchors precisely", () => {
  const cases: Array<{ name: string; mutate: (chapter: ChapterV21) => void; checkId: string; evidence: string }> = [
    {
      name: "nonexistent",
      checkId: "SC11.5.unknown_anchor",
      evidence: "ch01.fact.404",
      mutate: (chapter) => { chapter.authoring!.sourceAnchors.effectiveAnchors.hook = ["ch01.fact.404"]; },
    },
    {
      name: "wrong-chapter",
      checkId: "SC11.4.wrong_chapter_anchor",
      evidence: "ch02.fact.1",
      mutate: (chapter) => { chapter.authoring!.sourceAnchors.effectiveAnchors.hook = ["ch02.fact.1"]; },
    },
    {
      name: "placeholder",
      checkId: "SC11.3.placeholder_anchor",
      evidence: "anchor-99",
      mutate: (chapter) => { chapter.authoring!.sourceAnchors.effectiveAnchors.hook = ["anchor-99"]; },
    },
    {
      name: "unsupported",
      checkId: "SC11.6.unsupported_anchor",
      evidence: "ch01.ex.lantern",
      mutate: (chapter) => { chapter.authoring!.sourceAnchors.effectiveAnchors["quiz.questions[0]"] = ["ch01.ex.lantern"]; },
    },
  ];
  for (const c of cases) {
    const chapter = fullyAnchoredChapter();
    c.mutate(chapter);
    const findings = checkChapterProvenance(chapter, sidecar());
    assert.ok(
      findings.some((finding) => finding.checkId === c.checkId && finding.evidence === c.evidence),
      `${c.name} should raise ${c.checkId}; got ${findings.map((finding) => `${finding.checkId}:${finding.evidence}`).join(", ")}`,
    );
  }
});

test("generation loads and passes validated source evidence before editor and planner calls", async () => {
  const root = fixtureRoot("order");
  rmSync(root, { recursive: true, force: true });
  const { stateRoot, runsRoot } = writeSourceRun(root);
  const calls: string[] = [];
  const priorAllow = process.env.CHAPTERFLOW_ALLOW_MODEL_GEN;
  process.env.CHAPTERFLOW_ALLOW_MODEL_GEN = "1";
  try {
    await assert.rejects(
      generateChapter(bookMeta(), chapterSpec(), {
        stateRoot,
        runsRoot,
        sourceV2Required: true,
        agents: {
          runEditorInChief: async (input) => {
            calls.push("editor");
            assert.match(input.sourceExcerpt ?? "", /Validated source-v2 anchor catalog/);
            return validBrief();
          },
          runCurriculumPlanner: async (input) => {
            calls.push("planner");
            assert.deepEqual(calls, ["editor", "planner"]);
            assert.match(input.chapterSource ?? "", /Exact validated chapter sidecar/);
            assert.equal(input.sourceAnchors?.some((anchor) => anchor.id === "ch01.fact.1"), true);
            throw new Error("STOP_AFTER_PLANNER");
          },
        },
      }),
      /STOP_AFTER_PLANNER/,
    );
    assert.deepEqual(calls, ["editor", "planner"]);
  } finally {
    if (priorAllow === undefined) delete process.env.CHAPTERFLOW_ALLOW_MODEL_GEN;
    else process.env.CHAPTERFLOW_ALLOW_MODEL_GEN = priorAllow;
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing or invalid required source-v2 evidence stops generation before planning agents run", async () => {
  for (const variant of ["missing", "invalid"] as const) {
    const root = fixtureRoot(`fail-closed-${variant}`);
    rmSync(root, { recursive: true, force: true });
    const stateRoot = resolve(root, "state");
    const runsRoot = resolve(root, "runs");
    if (variant === "invalid") {
      const invalid = sidecar();
      delete invalid.centralConcept.id;
      writeSourceRun(root, BOOK, 1, invalid);
    }
    let editorCalls = 0;
    let plannerCalls = 0;
    const priorAllow = process.env.CHAPTERFLOW_ALLOW_MODEL_GEN;
    process.env.CHAPTERFLOW_ALLOW_MODEL_GEN = "1";
    try {
      await assert.rejects(
        generateChapter(bookMeta(), chapterSpec(), {
          stateRoot,
          runsRoot,
          sourceV2Required: true,
          agents: {
            runEditorInChief: async () => {
              editorCalls += 1;
              return validBrief();
            },
            runCurriculumPlanner: async () => {
              plannerCalls += 1;
              return validPlan();
            },
          },
        }),
        /source evidence blocked/,
      );
      assert.equal(editorCalls, 0, `${variant}: editor must not run`);
      assert.equal(plannerCalls, 0, `${variant}: planner must not run`);
    } finally {
      if (priorAllow === undefined) delete process.env.CHAPTERFLOW_ALLOW_MODEL_GEN;
      else process.env.CHAPTERFLOW_ALLOW_MODEL_GEN = priorAllow;
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("source fact changes invalidate brief, plan, and downstream chapter cache manifests", () => {
  const root = fixtureRoot("cache");
  rmSync(root, { recursive: true, force: true });
  const { stateRoot, runsRoot, sidecarPath } = writeSourceRun(root);
  try {
    const provider = currentProviderIdentity("writer");
    const codeVersion = "source-cache-test";
    const book = bookMeta();
    const chapter = chapterSpec();
    const before = loadPlanningSourceEvidence(book.bookId, chapter.chapterNumber, { runsRoot, requireSourceV2: true });
    const artifacts = [
      {
        path: resolve(stateRoot, "briefs", `${BOOK}.brief.json`),
        artifactType: "book-brief" as const,
        artifactId: BOOK,
        generatorName: "book-brief",
        oldInputs: buildBriefCacheInputs(book, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: before }),
        newInputs: () => buildBriefCacheInputs(book, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: loadPlanningSourceEvidence(book.bookId, chapter.chapterNumber, { runsRoot, requireSourceV2: true }) }),
      },
      {
        path: resolve(stateRoot, "plans", `${chapter.chapterId}.plan.json`),
        artifactType: "chapter-plan" as const,
        artifactId: chapter.chapterId,
        generatorName: "chapter-plan",
        oldInputs: buildPlanCacheInputs(book, chapter, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: before }),
        newInputs: () => buildPlanCacheInputs(book, chapter, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: loadPlanningSourceEvidence(book.bookId, chapter.chapterNumber, { runsRoot, requireSourceV2: true }) }),
      },
      {
        path: resolve(stateRoot, "chapters", `${chapter.chapterId}.v21-native.chapter.json`),
        artifactType: "chapter" as const,
        artifactId: chapter.chapterId,
        generatorName: "generateChapter",
        oldInputs: buildChapterCacheInputs(book, chapter, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: before }),
        newInputs: () => buildChapterCacheInputs(book, chapter, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: loadPlanningSourceEvidence(book.bookId, chapter.chapterNumber, { runsRoot, requireSourceV2: true }) }),
      },
    ];
    for (const artifact of artifacts) {
      writeJson(artifact.path, { ok: true, artifact: artifact.artifactId });
      writeStageCacheManifest({
        artifactPath: artifact.path,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        inputs: artifact.oldInputs,
        generatorName: artifact.generatorName,
        provider,
        codeVersion,
      });
    }
    const changed = sidecar();
    changed.testableFacts[0].claim = "Synthetic fact 1 changed at the source.";
    writeJson(sidecarPath, changed);
    for (const artifact of artifacts) {
      const validation = validateStageCache({
        artifactPath: artifact.path,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        inputs: artifact.newInputs(),
        generatorName: artifact.generatorName,
        provider,
        codeVersion,
      });
      assert.equal(validation.ok, false, `${artifact.artifactType} cache must stale after source change`);
      assert.ok(!validation.ok && validation.changedDependencies.includes("source-evidence"), `${artifact.artifactType} should name source-evidence as changed`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("promotion projection strips public internals but manifest retains state authoring evidence", () => {
  const root = fixtureRoot("promotion");
  rmSync(root, { recursive: true, force: true });
  const { stateRoot, runsRoot } = writeSourceRun(root);
  try {
    const chapter = fullyAnchoredChapter();
    const shipped = stripInternalFields(chapter);
    writeCanonicalIndexFixture(BOOK, [{ chapterId: chapter.chapterId, number: chapter.number, title: chapter.title }], resolve(stateRoot, "indexes"));
    writeJson(resolve(stateRoot, "chapters", `${chapter.chapterId}.v21-native.chapter.json`), chapter);
    writeJson(resolve(stateRoot, "qc", `${BOOK}-ch01.qc.json`), {
      schemaVersion: "qc-attest-v1",
      bookId: BOOK,
      chapterNumber: 1,
      chapterId: chapter.chapterId,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(chapter),
      hashVersion: "v2",
      reviewer: "codex-qc:source-anchor-test",
      reviewedAt: "2026-06-23T00:00:00.000Z",
      roundId: "round-source-anchor-test",
      roundRole: "attest",
    });
    const manifest = buildProductionManifest({
      bookId: BOOK,
      title: "Source Anchors",
      author: "Fixture Author",
      contentOwner: "chapterflow",
      chapters: [shipped],
      stateRoot,
      runsRoot,
      createdAt: "2026-06-23T00:00:00.000Z",
      runId: "run-a",
      packagePath: resolve(root, "book-packages", `${BOOK}.v21.json`),
    });
    assert.equal(manifest.ok, true, manifest.ok ? "" : manifest.findings.map((finding) => finding.message).join("\n"));
    if (!manifest.ok) throw new Error("manifest failed");

    const publicJson = JSON.stringify(shipped);
    assert.doesNotMatch(publicJson, /authoring|sourceAnchorId|sourceAnchorIds|keyEvidenceAnchorIds/);
    const stateChapter = JSON.parse(readFileSync(resolve(stateRoot, "chapters", `${chapter.chapterId}.v21-native.chapter.json`), "utf8"));
    assert.ok(stateChapter.authoring?.sourceAnchors?.effectiveAnchors?.hook, "state artifact must retain authoring anchors");
    const manifestChapter = manifest.manifest.payload.chapters[0];
    assert.equal(manifestChapter.authoringEvidence?.schemaVersion, "chapter-source-anchor-map-v1");
    assert.ok(manifestChapter.authoringEvidence?.semanticHash, "manifest must retain a verifiable authoring evidence hash");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
