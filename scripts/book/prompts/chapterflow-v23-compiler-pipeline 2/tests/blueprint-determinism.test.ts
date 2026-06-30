/**
 * ChapterBlueprintV1 is advertised as a pure function of (bookId, chapterNumber,
 * sourcePacket). Before this fix, dealAllowedNames() subtracted names extracted
 * from ALREADY-ASSEMBLED sibling chapter files on disk (usedNamesByChapter ->
 * CHAPTERS_DIR), so reservedVariety.allowedNames/forbiddenNames depended on how
 * much of the book had been assembled when the blueprint was compiled.
 *
 * This asserts compiling a chapter's blueprint is byte-identical whether or not
 * a same-bucket sibling chapter is assembled on disk. ch01 and ch41 share a name
 * bucket: (n - 1) % NAME_BUCKET_COUNT is the same for both, so they are the pair
 * the disk-based de-collision logic actually touched.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { compileChapterBlueprint } from "../src/compiler/chapterBlueprint.js";
import { CHAPTERS_DIR, chapterFileName } from "../src/lib/chapterPaths.js";
import { sourcePacketPath, writeJsonFile } from "../src/artifacts/artifactStore.js";
import type { ChapterSpec } from "../src/generateChapter.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";

const BOOK = "zz-fixture-blueprint-determinism";
const NAME_BUCKET_COUNT = 40;

function sidecar(chapterNumber: number, title: string): SourceSidecarV2 {
  const facts = Array.from({ length: 9 }, (_, i) => ({
    id: `ch${chapterNumber}.fact.${i + 1}`,
    claim: `Test claim ${i + 1} for ${title}.`,
    becauseMechanism: `Because mechanism ${i + 1} explains ${title} concretely.`,
    commonError: `Common error ${i + 1}.`,
    errorIsWhy: `Why that error is wrong ${i + 1}.`,
  }));
  return {
    schemaVersion: "source-v2",
    chapterNumber,
    chapterTitle: title,
    centralConcept: { id: `ch${chapterNumber}.concept`, name: title, plainDefinition: `${title} definition.`, whyItMatters: `${title} matters to the reader.` },
    keyClaims: facts.map((f) => f.claim),
    namedExamples: [
      { id: `ch${chapterNumber}.case.a`, label: "Case A", summary: "Case A summary with enough detail to be usable as a grounded source case.", teachesWhat: "Teaches A.", hardSpecifics: ["specific A1", "specific A2"], realWorld: true },
      { id: `ch${chapterNumber}.case.b`, label: "Case B", summary: "Case B summary with enough detail to be usable as a grounded source case.", teachesWhat: "Teaches B.", hardSpecifics: ["specific B1", "specific B2"], realWorld: true },
    ],
    hardEdge: "Do not overclaim the mechanism.",
    paraphraseNotes: "Keep claims bounded to the tested facts.",
    testableFacts: facts,
    frameworks: [{ name: "Test framework", members: ["a", "b"] }],
  };
}

function chapterSpec(n: number, title: string): ChapterSpec {
  return { chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`, chapterNumber: n, chapterTitle: title };
}

function cleanupChapterFile(chapterId: string): void {
  rmSync(resolve(CHAPTERS_DIR, chapterFileName(chapterId)), { force: true });
}

test("blueprint compiler reservedVariety is invariant to sibling chapter files on disk", () => {
  const stateRoot = resolve(tmpdir(), `cf-v23-blueprint-determinism-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const ch01 = chapterSpec(1, "Chapter One");
  const ch41 = chapterSpec(41, "Chapter Forty-One");
  assert.equal((ch01.chapterNumber - 1) % NAME_BUCKET_COUNT, (ch41.chapterNumber - 1) % NAME_BUCKET_COUNT, "fixture chapters must share a name bucket");

  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", `${BOOK}.json`), [ch01, ch41]);

    const packet1 = compileSourcePacketFromSidecar({ bookId: BOOK, chapter: ch01, sidecar: sidecar(1, "Chapter One"), sidecarPath: "/tmp/zz-ch01.source.json", sourceHash: "hash1" });
    const packet41 = compileSourcePacketFromSidecar({ bookId: BOOK, chapter: ch41, sidecar: sidecar(41, "Chapter Forty-One"), sidecarPath: "/tmp/zz-ch41.source.json", sourceHash: "hash41" });
    writeJsonFile(sourcePacketPath(BOOK, 1, roots), packet1);
    writeJsonFile(sourcePacketPath(BOOK, 41, roots), packet41);

    // Pass 1: no sibling chapter file assembled on disk yet.
    cleanupChapterFile(ch01.chapterId);
    const withoutSibling = compileChapterBlueprint({ bookId: BOOK, chapter: ch41, packet: packet41, packetPath: sourcePacketPath(BOOK, 41, roots), roots });

    const dealtName = withoutSibling.reservedVariety.allowedNames[0];
    assert.ok(dealtName, "fixture must deal at least one protagonist name");

    // Pass 2: ch01 is now fully assembled on disk and its prose happens to use
    // the exact name ch41 was dealt in pass 1.
    if (!existsSync(CHAPTERS_DIR)) mkdirSync(CHAPTERS_DIR, { recursive: true });
    const ch01Assembled = {
      schemaVersion: "v21-native",
      chapterId: ch01.chapterId,
      number: 1,
      title: ch01.chapterTitle,
      examples: [{ scenario: `${dealtName} reviews the account page and pauses before approving the purchase.` }],
    };
    writeFileSync(resolve(CHAPTERS_DIR, chapterFileName(ch01.chapterId)), JSON.stringify(ch01Assembled, null, 2) + "\n", "utf8");

    const withSibling = compileChapterBlueprint({ bookId: BOOK, chapter: ch41, packet: packet41, packetPath: sourcePacketPath(BOOK, 41, roots), roots });

    assert.deepEqual(withSibling.reservedVariety, withoutSibling.reservedVariety, "reservedVariety must not depend on whether a sibling chapter is assembled on disk");
  } finally {
    cleanupChapterFile(ch01.chapterId);
    cleanupChapterFile(ch41.chapterId);
    rmSync(stateRoot, { recursive: true, force: true });
  }
});
