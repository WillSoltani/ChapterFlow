import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const SOURCE = readFileSync(
  new URL("./initial-chapter-content.ts", import.meta.url),
  "utf8",
);

test("server reader hydration remains a read-only render path", () => {
  const forbiddenCalls = [
    "getUserAccessibleChapter",
    "repointProgressVersion",
    "ensureUserBookStarted",
    "reserveBookEntitlement",
    "applyProgressCursorTouch",
    "awardFlowPoints",
    "setBookDeviceCookie",
  ];

  for (const name of forbiddenCalls) {
    assert.equal(
      SOURCE.includes(`${name}(`),
      false,
      `initial reader render must not call ${name}`,
    );
  }
});

test("server reader hydration uses only strongly-read entitlement and progress state", () => {
  assert.match(SOURCE, /getUserEntitlement\([\s\S]*consistentRead: true/);
  assert.match(SOURCE, /getUserProgress\([\s\S]*consistentRead: true/);
  assert.match(SOURCE, /buildChapterKey\(progress\.contentPrefix, chapter\.number\)/);
});
