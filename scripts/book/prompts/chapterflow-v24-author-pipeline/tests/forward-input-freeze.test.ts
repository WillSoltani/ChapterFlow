/** IMP-22 model-free source-input inventory/materialization. */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import {
  compileSourcePacketFromSidecar,
  tagBookWideDuplicateFacts,
} from "../src/compiler/sourcePacket.js";
import { applyTeachingRanking } from "../src/compiler/sourcePacketFacts.js";
import { semanticSourceHash } from "../src/source/sourceIntegrity.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";
import {
  ForwardInputFreezeError,
  assertForwardBookSetDisjoint,
  assertForwardInputFreezeFresh,
  buildFullBookGoldSelection,
  freezeForwardInputs,
  inventoryGoldBookInput,
  inventoryPilotBookInput,
  materializeForwardBookInput,
  selectDeterministicCrossBookFallback,
  selectPilotInputs,
  verifyFrozenInputFiles,
  type ForwardBookInputV1,
  type FrozenForwardInputFileV1,
} from "../src/orchestrator/forwardInputFreeze.js";

function sourceSidecar(n: number, title: string, bookTag: string): SourceSidecarV2 {
  const nn = String(n).padStart(2, "0");
  return {
    schemaVersion: "source-v2",
    chapterNumber: n,
    chapterTitle: title,
    centralConcept: {
      id: `ch${nn}.concept`,
      name: `${bookTag} decision pattern ${n}`,
      plainDefinition: `A chapter-specific way to distinguish evidence ${n} from an attractive assumption.`,
      whyItMatters: `The reader can test decision ${n} before acting on it.`,
    },
    keyClaims: [
      `Decision pattern ${n} needs visible evidence.`,
      `A comparison makes the boundary of pattern ${n} testable.`,
      `The chapter ${n} mechanism must not be stated as a guarantee.`,
    ],
    namedExamples: [0, 1, 2].map((i) => ({
      id: `ch${nn}.ex.${i + 1}`,
      label: `${bookTag} Case ${n}-${i + 1}`,
      summary: `${bookTag} Case ${n}-${i + 1} documents Site ${n}${i + 1} in 20${10 + n} with measure ${100 + i}.`,
      teachesWhat: `The case tests chapter ${n}'s distinction in a different setting.`,
      hardSpecifics: [`Site ${n}${i + 1}`, `20${10 + n}`, `measure ${100 + i}`],
      realWorld: true,
    })),
    hardEdge: `Do not turn chapter ${n}'s evidence into a universal promise.`,
    testableFacts: Array.from({ length: 9 }, (_, i) => ({
      id: `ch${nn}.fact.${i + 1}`,
      claim: `${bookTag} chapter ${n} fact ${i + 1} is supported by case ${((i % 3) + 1)} and marker ${n * 100 + i}.`,
      becauseMechanism: `Because marker ${n * 100 + i} changes the observable decision step, the claim can be checked against behavior.`,
      commonError: `Treating marker ${n * 100 + i} as decoration rather than evidence.`,
      errorIsWhy: `That removes the chapter-specific mechanism from fact ${i + 1}.`,
      derivedFrom: `ch${nn}.ex.${(i % 3) + 1}`,
    })),
    frameworks: [{ name: `${bookTag} ${n} loop`, members: [`observe-${n}`, `compare-${n}`, `decide-${n}`] }],
  };
}

type FixtureBook = {
  bookId: string;
  packetDir: string;
  sidecarDir: string;
  packagePath: string;
  sourceArchiveId: string;
  fileMap: Map<string, string>;
};

function writeFixtureBook(base: string, bookId: string, chapterCount: number, priorProse = "PRIOR_PROSE_SENTINEL"): FixtureBook {
  const sourceArchiveId = "archive-v1";
  const packetDir = join(base, "packets", bookId);
  const sidecarDir = join(base, "sidecars", bookId, sourceArchiveId);
  const packageDir = join(base, "packages");
  mkdirSync(packetDir, { recursive: true });
  mkdirSync(sidecarDir, { recursive: true });
  mkdirSync(packageDir, { recursive: true });
  const packets = [];
  const parts: Array<{ n: number; title: string; sidecar: SourceSidecarV2; sidecarPath: string }> = [];
  for (let n = 1; n <= chapterCount; n++) {
    const title = `${bookId} title ${n}`;
    const sidecar = sourceSidecar(n, title, bookId);
    const sidecarPath = join(sidecarDir, `ch${String(n).padStart(2, "0")}.source.json`);
    writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2) + "\n");
    const packet = compileSourcePacketFromSidecar({
      bookId,
      chapter: { chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`, chapterNumber: n, chapterTitle: title },
      sidecar,
      sidecarPath,
      sourceHash: semanticSourceHash(sidecar),
    });
    packets.push(packet);
    parts.push({ n, title, sidecar, sidecarPath });
  }
  tagBookWideDuplicateFacts(packets);
  packets.forEach(applyTeachingRanking);
  const fileMap = new Map<string, string>();
  for (let i = 0; i < packets.length; i++) {
    const packetPath = join(packetDir, `ch${String(i + 1).padStart(2, "0")}.source-packet.json`);
    writeFileSync(packetPath, JSON.stringify(packets[i], null, 2) + "\n");
    fileMap.set(`packet-archive:${bookId}/${sourceArchiveId}/${packetPath.split("/").pop()}`, packetPath);
    fileMap.set(`source-archive:${bookId}/${sourceArchiveId}/${parts[i].sidecarPath.split("/").pop()}`, parts[i].sidecarPath);
  }
  const packagePath = join(packageDir, `${bookId}.v21.json`);
  writeFileSync(packagePath, JSON.stringify({
    schemaVersion: "chapterflow-v21-authored",
    book: { bookId, title: `${bookId} book`, author: "Fixture Author", categories: ["Learning"], tags: ["evidence"] },
    chapters: parts.map((part) => ({
      chapterId: `${bookId}-ch${String(part.n).padStart(2, "0")}`,
      number: part.n,
      title: part.title,
      hook: `${priorProse} ${part.n}`,
      breakdown: { fullRead: `${priorProse} full ${part.n}` },
    })),
  }, null, 2) + "\n");
  fileMap.set(`package-archive:${bookId}/${packagePath.split("/").pop()}`, packagePath);
  return { bookId, packetDir, sidecarDir, packagePath, sourceArchiveId, fileMap };
}

function pilotInput(book: FixtureBook): ForwardBookInputV1 {
  return inventoryPilotBookInput({
    bookId: book.bookId,
    packetDir: book.packetDir,
    sidecarDir: book.sidecarDir,
    sourceArchiveId: book.sourceArchiveId,
    representativeTags: ["research", "concept", "application"],
  });
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) visit(path); else out.push(path);
    }
  };
  visit(root);
  return out.sort();
}

test("pilot input inventory compiles fresh plans and deterministically selects a balanced non-overlapping 8", () => {
  const roots = mkTestRoots("forward-input-pilot");
  try {
    const one = pilotInput(writeFixtureBook(roots.base, "pilot-one", 6));
    const two = pilotInput(writeFixtureBook(roots.base, "pilot-two", 6));
    const selected = selectPilotInputs([two, one]);
    const again = selectPilotInputs([one, two]);
    assert.deepEqual(selected, again);
    const chapters = selected.flatMap((book) => book.chapters);
    assert.equal(chapters.length, 8);
    assert.equal(new Set(chapters.map((chapter) => `${chapter.bookId}/${chapter.chapterNumber}`)).size, 8);
    for (const stratum of ["research-heavy", "abstract-conceptual", "example-heavy", "causal-quiz-sensitive"]) {
      assert.equal(chapters.filter((chapter) => chapter.stratum === stratum).length, 2);
    }
    for (const input of [one, two]) {
      for (const chapter of input.chapters) {
        assert.equal(chapter.plan.sourcePacketSha256, chapter.hashes.sourcePacketSha256);
        assert.equal(chapter.anchors.length, chapter.packet.allowedAnchors.length);
      }
    }
  } finally {
    roots.dispose();
  }
});

test("frozen source bytes fail closed on drift and book sets fail closed on overlap", () => {
  const roots = mkTestRoots("forward-input-drift");
  try {
    const fixture = writeFixtureBook(roots.base, "pilot-drift", 4);
    const input = pilotInput(fixture);
    const resolver = (file: FrozenForwardInputFileV1): string => {
      const path = fixture.fileMap.get(`${file.root}:${file.relativePath}`);
      assert.ok(path, `${file.root}:${file.relativePath}`);
      return path;
    };
    verifyFrozenInputFiles(input.sourceFiles, resolver);
    const sourceFile = input.sourceFiles.find((file) => file.root === "source-archive")!;
    writeFileSync(resolver(sourceFile), "{}\n");
    assert.throws(() => verifyFrozenInputFiles(input.sourceFiles, resolver), ForwardInputFreezeError);
    assert.throws(() => assertForwardBookSetDisjoint({
      qualificationBookIds: ["shared"],
      pilotBookIds: ["shared"],
      goldBookIds: ["gold"],
    }), /overlap/);
  } finally {
    roots.dispose();
  }
});

test("13-chapter gold input is harness-compatible, keeps every chapter in a hash-bound stratum, and never projects prior prose", () => {
  const roots = mkTestRoots("forward-input-gold");
  try {
    const fixture = writeFixtureBook(roots.base, "gold-thirteen", 13);
    const eligibility = inventoryGoldBookInput({
      bookId: fixture.bookId,
      packagePath: fixture.packagePath,
      sidecarDir: fixture.sidecarDir,
      sourceArchiveId: fixture.sourceArchiveId,
    });
    assert.equal(eligibility.status, "ELIGIBLE_FULL_BOOK");
    assert.equal(eligibility.book?.chapters.length, 13);
    assert.equal(eligibility.currentCampaignHarnessCompatible, true);
    assert.deepEqual(eligibility.harnessCompatibilityReasons, []);
    assert.equal(JSON.stringify(eligibility.book).includes("PRIOR_PROSE_SENTINEL"), false);
    const goldSelection = buildFullBookGoldSelection(eligibility.book!);
    assert.equal(goldSelection.candidate.chapters.length, 13);
    assert.equal(new Set(goldSelection.candidate.chapters.map((chapter) => chapter.chapterNumber)).size, 13);
    assert.equal(new Set(goldSelection.candidate.chapters.map((chapter) => chapter.stratum)).size, 4);
    assert.match(goldSelection.stratumAssignmentSha256, /^[a-f0-9]{64}$/);

    const materialized = materializeForwardBookInput({
      book: eligibility.book!,
      experimentStateRoot: join(roots.base, "gold-experiment", "state"),
      frozenAtIso: "2026-07-12T12:00:00.000Z",
    });
    assert.equal(Object.keys(materialized.chapterBriefSha256).length, 13);
    const allText = walkFiles(materialized.stateRoot).map((path) => readFileSync(path, "utf8")).join("\n");
    assert.equal(allText.includes("PRIOR_PROSE_SENTINEL"), false);
    assert.equal(allText.includes('"priorChapterProseUsed":false'), true);
    assert.equal(existsSync(join(materialized.stateRoot, "chapters")), false);
  } finally {
    roots.dispose();
  }
});

test("gold reconstruction fails closed on a missing sidecar", () => {
  const roots = mkTestRoots("forward-input-gold-gap");
  try {
    const fixture = writeFixtureBook(roots.base, "gold-gap", 8);
    rmSync(join(fixture.sidecarDir, "ch08.source.json"));
    const eligibility = inventoryGoldBookInput({
      bookId: fixture.bookId,
      packagePath: fixture.packagePath,
      sidecarDir: fixture.sidecarDir,
      sourceArchiveId: fixture.sourceArchiveId,
    });
    assert.equal(eligibility.status, "INELIGIBLE");
    assert.match(eligibility.ineligibilityReasons.join(" "), /MISSING_OR_UNREADABLE_SIDECAR_CH08/);
  } finally {
    roots.dispose();
  }
});

test("cross-book fallback is deterministic, explicit, fixed-size, and respects exclusions", () => {
  const roots = mkTestRoots("forward-input-fallback");
  try {
    const a = pilotInput(writeFixtureBook(roots.base, "fallback-a", 7));
    const b = pilotInput(writeFixtureBook(roots.base, "fallback-b", 7));
    const c = pilotInput(writeFixtureBook(roots.base, "excluded-c", 7));
    const first = selectDeterministicCrossBookFallback({ candidates: [c, b, a], excludedBookIds: ["excluded-c"], targetCount: 12 });
    const second = selectDeterministicCrossBookFallback({ candidates: [a, b, c], excludedBookIds: ["excluded-c"], targetCount: 12 });
    assert.deepEqual(first, second);
    assert.equal(first.kind, "cross-book-equivalent");
    assert.equal(first.chapters.length, 12);
    assert.deepEqual(first.bookIds, ["fallback-a", "fallback-b"]);
    assert.ok(first.chapters.every((chapter) => chapter.bookId !== "excluded-c"));
  } finally {
    roots.dispose();
  }
});

test("combined freeze hashes the denominator and enforces qualification/pilot/gold disjointness", () => {
  const roots = mkTestRoots("forward-input-combined");
  try {
    const oneFixture = writeFixtureBook(roots.base, "freeze-pilot-one", 5);
    const twoFixture = writeFixtureBook(roots.base, "freeze-pilot-two", 5);
    const goldFixture = writeFixtureBook(roots.base, "freeze-gold", 8);
    const gold = inventoryGoldBookInput({
      bookId: goldFixture.bookId,
      packagePath: goldFixture.packagePath,
      sidecarDir: goldFixture.sidecarDir,
      sourceArchiveId: goldFixture.sourceArchiveId,
    });
    const frozen = freezeForwardInputs({
      frozenAtIso: "2026-07-12T12:00:00.000Z",
      qualificationBookIds: ["qualification-only"],
      pilotBooks: [pilotInput(oneFixture), pilotInput(twoFixture)],
      gold,
    });
    assertForwardInputFreezeFresh(frozen);
    assert.equal(frozen.pilot.flatMap((book) => book.chapters).length, 8);
    assert.equal(frozen.goldChapterCount, 8);
    const tampered = { ...frozen, goldChapterCount: 7 };
    assert.throws(() => assertForwardInputFreezeFresh(tampered), /manifest hash drift/);
  } finally {
    roots.dispose();
  }
});
