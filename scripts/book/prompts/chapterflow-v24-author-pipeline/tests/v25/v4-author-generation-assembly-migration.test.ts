import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  assembleChapterV21OrThrow,
  openAuthorV4ContentSelection,
  type AssembleInput,
} from "../../src/assembler.js";
import type { BookContentReader, CandidateInputFile } from "../../src/books/candidateTypes.js";
import { LegacyAuthorStateAdapter } from "../../src/contracts/legacyAuthorStateAdapter.js";
import type { PlannedArtifact } from "../../src/contracts/v4Core.js";
import type { Result } from "../../src/contracts/v4Core.js";
import { selectMemorableLinesDeterministic } from "../../src/optimizers/memorableLines.js";
import {
  assembleSections,
  type AuthorV4SectionChapterPaths,
} from "../../src/sections/assembleSections.js";
import { checkSectionGate } from "../../src/sections/sectionGate.js";
import { readSectionTask, type SectionTask } from "../../src/sections/sectionTasks.js";
import { compileCreditFixture, writeCreditFixture } from "../fixtures/creditBookFixture.js";

const BOOK = "v4-generation-fixture";
const RUN = "generation-run";
const INPUT = "section-input";
const CREATED = "2026-07-20T13:00:00.000Z";

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function artifact(logicalPath: string, value: unknown, kind: PlannedArtifact["kind"] = "SIDECAR"): CandidateInputFile {
  return { kind, mediaType: "application/json", logicalPath, bytes: new TextEncoder().encode(JSON.stringify(value)) };
}

function paths(): AuthorV4SectionChapterPaths {
  return {
    chapterNumber: 1,
    blueprint: "content/blueprint.json",
    sourcePacket: "content/source-packet.json",
    sourceSidecar: "content/source-sidecar.json",
    summary: "content/summary.json",
    examples: "content/examples.json",
    learning: "content/learning.json",
    action: "content/action.json",
    output: `content/chapters/${BOOK}-ch01.v21-native.chapter.json`,
  };
}

function legacyInput(fixture: ReturnType<typeof compileCreditFixture>): AssembleInput {
  return {
    plan: fixture.blueprint.plan,
    breakdown: fixture.summary.breakdown,
    examples: fixture.examples.examples,
    quiz: fixture.learning.quiz,
    cards: fixture.learning.cards,
    implementationPlan: fixture.action.implementationPlan,
    keyTakeaway: fixture.summary.keyTakeaway,
    keyTakeawaySourceAnchorIds: fixture.summary.keyTakeawaySourceAnchorIds,
    hook: fixture.summary.hook,
    tryThisNow: fixture.action.tryThisNow || fixture.summary.tryThisNow,
    tryThisNowSourceAnchorIds: fixture.action.tryThisNowSourceAnchorIds || fixture.summary.tryThisNowSourceAnchorIds,
    sourceEvidence: {
      schemaVersion: "planning-source-evidence-v1",
      bookId: BOOK,
      chapterNumber: 1,
      bookSource: null,
      toc: null,
      chapterSource: null,
      chapterSidecar: null,
      chapterSidecarPath: fixture.packet.sourceSidecarPath,
      chapterSourcePath: null,
      bookSourcePath: null,
      tocPath: null,
      sourceHash: fixture.packet.sourceHash ?? "source-packet",
      anchorCatalogHash: fixture.packet.sourceHash ?? "source-packet",
      anchors: fixture.packet.allowedAnchors,
      available: true,
      sourceV2: true,
    },
  };
}

async function main(): Promise<void> {
  const temp = mkdtempSync(join(tmpdir(), "cf-v4-author-generation-r2-"));
  const compilerRoot = resolve(temp, "compiler-state");
  const sidecarPath = resolve(temp, "legacy-source-sidecar.json");
  const sidecar = {
    centralConcept: { plainDefinition: "A lender-visible balance is an input, not a judgment." },
    hardEdge: "Do not promise an exact score increase.",
    paraphraseNotes: "Explain reporting timing without copying source prose.",
    namedExamples: [],
  };
  writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2) + "\n");
  const fixture = compileCreditFixture(BOOK, { stateRoot: compilerRoot });
  fixture.packet.sourceSidecarPath = sidecarPath;
  writeCreditFixture(BOOK, { stateRoot: compilerRoot }, fixture);
  const chapterPaths = paths();
  const taskPath = "content/task.md";
  const taskText = "selected bounded section task";
  const files: CandidateInputFile[] = [
    artifact(chapterPaths.blueprint, fixture.blueprint),
    artifact(chapterPaths.sourcePacket, fixture.packet),
    artifact(chapterPaths.sourceSidecar, sidecar),
    artifact(chapterPaths.summary, fixture.summary),
    artifact(chapterPaths.examples, fixture.examples),
    artifact(chapterPaths.learning, fixture.learning),
    artifact(chapterPaths.action, fixture.action),
    { kind: "SIDECAR", mediaType: "text/markdown", logicalPath: taskPath, bytes: new TextEncoder().encode(taskText) },
  ];
  const inventory = files.map(({ bytes: _bytes, ...entry }) => entry);
  const adapter = new LegacyAuthorStateAdapter({ legacyRoot: resolve(temp, "legacy"), shadowRoot: resolve(temp, "shadow"), disposable: true });
  const staged = await adapter.stageCompleteCandidate({ bookId: BOOK, candidateId: INPUT, createdByRunId: RUN, expectedInventory: inventory, files, createdAt: CREATED });
  assert.equal(staged.ok, true);

  let readerCalls = 0;
  const reader: BookContentReader = {
    open: async (input) => {
      readerCalls++;
      return adapter.openShadowCandidate(input);
    },
  };
  const selection = await openAuthorV4ContentSelection(reader, { bookId: BOOK, selector: { kind: "CANDIDATE", candidateId: INPUT } });
  assert.equal(readerCalls, 1);
  assert.deepEqual(selection.snapshot.manifest.entries.map((entry) => entry.logicalPath), inventory.map((entry) => entry.logicalPath));
  const sourceBefore = selection.snapshot.files.map((file) => Buffer.from(file.bytes).toString("hex"));
  console.log("PASS 1/7 complete selected input opens once through real BookContentReader with ordered inventory");

  const task: SectionTask = { bookId: BOOK, chapterNumber: 1, chapterId: `${BOOK}-ch01`, kind: "summary-pack", taskPath: "/forbidden/ambient-task", outputPath: "/forbidden/output", exists: true };
  assert.equal(readSectionTask(task, { content: selection, logicalPath: taskPath }), taskText);
  await assert.rejects(() => openAuthorV4ContentSelection(reader, { bookId: BOOK, selector: { kind: "CURRENT" } }), /ambient fallback is forbidden/);
  console.log("PASS 2/7 selected section task/source authority uses explicit CANDIDATE; CURRENT fallback blocks");

  const selectedGate = checkSectionGate(BOOK, {}, {
    selectedChapters: [{
      chapterNumber: 1,
      blueprint: fixture.blueprint,
      sourcePacket: fixture.packet,
      sourceSidecar: sidecar,
      packs: {
        "summary-pack": fixture.summary,
        "example-pack": fixture.examples,
        "learning-pack": fixture.learning,
        "action-pack": fixture.action,
      },
    }],
  });
  const legacyGate = checkSectionGate(BOOK, { stateRoot: compilerRoot });
  assert.deepEqual(
    selectedGate.findings.map((finding) => `${finding.severity}:${finding.checkId}:${finding.chapterNumber ?? 0}`),
    legacyGate.findings.map((finding) => `${finding.severity}:${finding.checkId}:${finding.chapterNumber ?? 0}`),
    "selected gate retains full legacy whole-book checkSectionGate semantics",
  );
  const assembled = assembleSections(BOOK, {}, { content: selection, chapters: [chapterPaths] });
  assert.deepEqual(assembled.findings, []);
  assert.equal(assembled.written.length, 0);
  assert.equal(assembled.candidateFiles?.length, 1);
  const selectedChapter = JSON.parse(Buffer.from(assembled.candidateFiles![0].bytes).toString("utf8"));
  const legacyChapter = assembleChapterV21OrThrow(legacyInput(fixture));
  const deterministic = selectMemorableLinesDeterministic(legacyChapter);
  legacyChapter.memorableLines = deterministic.length >= 3 ? deterministic : legacyChapter.memorableLines;
  assert.deepEqual(selectedChapter, legacyChapter);
  console.log("PASS 3/7 selected assembleSections runs legacy whole-book gate parity and yields equal ordered chapter JSON");

  writeFileSync(sidecarPath, JSON.stringify({ centralConcept: { plainDefinition: "ambient poison must not be read" } }) + "\n");
  const afterAmbientPoison = assembleSections(BOOK, {}, { content: selection, chapters: [chapterPaths] });
  assert.deepEqual(afterAmbientPoison.findings, []);
  assert.deepEqual(afterAmbientPoison.candidateFiles, assembled.candidateFiles);
  console.log("PASS 4/7 selected source packet/sidecar bytes ignore poisoned ambient path and remain pure");

  const incomplete = assembleSections(BOOK, {}, { content: selection, chapters: [{ ...chapterPaths, action: "content/missing-action.json" }] });
  assert.equal(incomplete.candidateFiles?.length, 0);
  assert.match(incomplete.findings[0], /expected one content\/missing-action\.json, found 0/);
  console.log("PASS 5/7 missing/partial section yields no complete candidate inventory");

  const outputInventory = assembled.candidateFiles!.map(({ bytes: _bytes, ...entry }) => entry);
  const outputStage = await adapter.stageCompleteCandidate({
    bookId: BOOK,
    candidateId: "assembled-output",
    createdByRunId: "assembly-run",
    expectedInventory: outputInventory,
    files: assembled.candidateFiles!,
    createdAt: "2026-07-20T13:00:01.000Z",
  });
  assert.equal(outputStage.ok, true);
  const output = expectOk(await adapter.openShadowCandidate({ bookId: BOOK, selector: { kind: "CANDIDATE", candidateId: "assembled-output" } }));
  assert.deepEqual(JSON.parse(Buffer.from(output.files[0].bytes).toString("utf8")), legacyChapter);
  console.log("PASS 6/7 assembled bytes become visible only after exact complete create-only CandidateStore stage");

  const overwrite = await adapter.stageCompleteCandidate({
    bookId: BOOK,
    candidateId: "assembled-output",
    createdByRunId: "other-run",
    expectedInventory: outputInventory,
    files: [{ ...outputInventory[0], bytes: new TextEncoder().encode("{}") }],
    createdAt: "2026-07-20T13:00:02.000Z",
  });
  assert.equal(overwrite.ok, false);
  const corrupt = assembleSections(BOOK, {}, { content: { ...selection, selector: { kind: "CANDIDATE", candidateId: "wrong" } }, chapters: [chapterPaths] });
  assert.equal(corrupt.candidateFiles?.length, 0);
  assert.match(corrupt.findings[0], /selector blocked/);
  const selectedAfter = expectOk(await adapter.openShadowCandidate({ bookId: BOOK, selector: { kind: "CANDIDATE", candidateId: INPUT } }));
  assert.deepEqual(selectedAfter.files.map((file) => Buffer.from(file.bytes).toString("hex")), sourceBefore);
  console.log("PASS 7/7 overwrite/corrupt selector block; validation and assembly preserve source candidate bytes");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
