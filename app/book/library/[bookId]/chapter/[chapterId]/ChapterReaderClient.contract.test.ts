import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readerPath = new URL("./ChapterReaderClient.tsx", import.meta.url);
const source = readFileSync(readerPath, "utf8");

test("reader shell stays slim and composes the route-local reader authorities", () => {
  const physicalLines = source.split("\n").length;
  assert.ok(
    physicalLines <= 500,
    `ChapterReaderClient.tsx must be <=500 physical lines; found ${physicalLines}`,
  );

  for (const authority of [
    "useReaderAccess",
    "useReaderSettings",
    "useReaderProgress",
    "useReaderPhaseFlow",
    "useChapterQuiz",
    "useReaderExamples",
  ]) {
    assert.match(source, new RegExp(`\\b${authority}\\(`), `missing ${authority} composition`);
  }

  for (const view of [
    "ReaderAccessState",
    "ReaderChrome",
    "ReaderPhaseContent",
    "ReaderOverlays",
  ]) {
    assert.match(source, new RegExp(`<${view}\\b`), `missing ${view} composition`);
  }
});
