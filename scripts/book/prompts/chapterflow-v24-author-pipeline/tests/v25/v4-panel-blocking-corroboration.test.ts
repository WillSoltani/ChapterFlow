/**
 * Owner decision D2 (A2): a reader-panel seat's `READER.BLOCKING.<category>`
 * finding blocks only when >=2 DISTINCT seats raise the same category on the
 * same chapter. Only `schema_or_app_breaking` still blocks on a single seat.
 * Every other single-seat finding is kept as WARN `READER.SINGLE_SEAT.<category>`.
 *
 * Two halves:
 *   1. unit tests of the ONE pure rule function (`corroboratePanelBlockingFindings`);
 *   2. a REPLAY of that same function over the 14 stored panel reviews of run
 *      book-run-39a37d06-59c8-430a-87fe-3ad3b19a1c14 (trimmed fixture, generated
 *      read-only by the S06 gen-fixture.py and cmp-equal to its reference), asserting
 *      the D2 = A2 table exactly and the D2 = A reference table exactly.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  corroboratePanelBlockingFindings,
  PANEL_SINGLE_SEAT_BLOCKING_CATEGORIES,
} from "../../src/review/panelBlockingCorroboration.js";
import {
  isReaderPanelInfraCode,
  READER_BLOCKING_CODE_PREFIX,
  READER_SINGLE_SEAT_CODE_PREFIX,
} from "../../src/review/readerPanelIssueCodes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

type Finding = { chapter: string | number; seatId: string; category: string; tag?: string };

function f(chapter: string | number, seatId: string, category: string, tag?: string): Finding {
  return { chapter, seatId, category, ...(tag === undefined ? {} : { tag }) };
}

function shape(results: ReturnType<typeof corroboratePanelBlockingFindings<Finding>>): string[] {
  return results.map((entry) => `${entry.severity} ${entry.code}`);
}

// ── 1. The pure rule ────────────────────────────────────────────────────────

requiredTest("D2 constants: only schema_or_app_breaking blocks on one seat; codes use the two prefix constants", () => {
  assert.deepEqual([...PANEL_SINGLE_SEAT_BLOCKING_CATEGORIES], ["schema_or_app_breaking"]);
  assert.equal(READER_SINGLE_SEAT_CODE_PREFIX, "READER.SINGLE_SEAT.");
  assert.equal(READER_BLOCKING_CODE_PREFIX, "READER.BLOCKING.");
});

requiredTest("two distinct seats, same chapter + category -> both BLOCKER READER.BLOCKING.<cat>", () => {
  const out = corroboratePanelBlockingFindings([
    f(1, "seat-cold", "internal_contradiction"),
    f(1, "seat-skeptic", "internal_contradiction"),
  ]);
  assert.deepEqual(shape(out), [
    "BLOCKER READER.BLOCKING.internal_contradiction",
    "BLOCKER READER.BLOCKING.internal_contradiction",
  ]);
});

requiredTest("one seat -> WARN READER.SINGLE_SEAT.<cat>", () => {
  const out = corroboratePanelBlockingFindings([f(1, "seat-cold", "internal_contradiction")]);
  assert.deepEqual(shape(out), ["WARN READER.SINGLE_SEAT.internal_contradiction"]);
});

requiredTest("D2 = A2 exceptions: single-seat schema_or_app_breaking stays BLOCKER; single-seat unsafe becomes WARN", () => {
  const out = corroboratePanelBlockingFindings([
    f(3, "seat-cold", "schema_or_app_breaking"),
    f(3, "seat-skeptic", "unsafe"),
  ]);
  assert.deepEqual(shape(out), [
    "BLOCKER READER.BLOCKING.schema_or_app_breaking",
    "WARN READER.SINGLE_SEAT.unsafe",
  ]);
});

requiredTest("same category from two seats on DIFFERENT chapters is not corroborated", () => {
  const out = corroboratePanelBlockingFindings([
    f(1, "seat-cold", "structurally_invalid"),
    f(2, "seat-skeptic", "structurally_invalid"),
  ]);
  assert.deepEqual(shape(out), [
    "WARN READER.SINGLE_SEAT.structurally_invalid",
    "WARN READER.SINGLE_SEAT.structurally_invalid",
  ]);
});

requiredTest("the same seat raising a category twice on one chapter is not corroborated", () => {
  const out = corroboratePanelBlockingFindings([
    f(1, "seat-skeptic", "structurally_invalid", "a"),
    f(1, "seat-skeptic", "structurally_invalid", "b"),
  ]);
  assert.deepEqual(shape(out), [
    "WARN READER.SINGLE_SEAT.structurally_invalid",
    "WARN READER.SINGLE_SEAT.structurally_invalid",
  ]);
});

requiredTest("two seats with DIFFERENT categories on one chapter are not corroborated", () => {
  const out = corroboratePanelBlockingFindings([
    f(1, "seat-cold", "structurally_invalid"),
    f(1, "seat-skeptic", "unusable"),
  ]);
  assert.deepEqual(shape(out), [
    "WARN READER.SINGLE_SEAT.structurally_invalid",
    "WARN READER.SINGLE_SEAT.unusable",
  ]);
});

requiredTest("three seats on the same chapter + category -> every finding BLOCKER", () => {
  const out = corroboratePanelBlockingFindings([
    f(4, "seat-cold", "unusable"),
    f(4, "seat-skeptic", "unusable"),
    f(4, "seat-practitioner", "unusable"),
  ]);
  assert.deepEqual(shape(out), [
    "BLOCKER READER.BLOCKING.unusable",
    "BLOCKER READER.BLOCKING.unusable",
    "BLOCKER READER.BLOCKING.unusable",
  ]);
});

requiredTest("empty input -> empty output", () => {
  assert.deepEqual(corroboratePanelBlockingFindings([]), []);
});

requiredTest("output order = input order, and each finding object is returned untouched", () => {
  const input = [
    f(2, "seat-cold", "unsafe", "x"),
    f(1, "seat-cold", "internal_contradiction", "y"),
    f(2, "seat-practitioner", "unsafe", "z"),
    f(1, "seat-skeptic", "structurally_invalid", "w"),
  ];
  const snapshot = JSON.parse(JSON.stringify(input)) as Finding[];
  const out = corroboratePanelBlockingFindings(input);
  assert.equal(out.length, input.length);
  out.forEach((entry, index) => assert.equal(entry.finding, input[index], `position ${index}`));
  assert.deepEqual(input, snapshot, "the rule must not mutate its input");
  assert.deepEqual(shape(out), [
    "BLOCKER READER.BLOCKING.unsafe",
    "WARN READER.SINGLE_SEAT.internal_contradiction",
    "BLOCKER READER.BLOCKING.unsafe",
    "WARN READER.SINGLE_SEAT.structurally_invalid",
  ]);
});

// ── 2. The replay over the 14 stored panels of run 39a37d06 ─────────────────

type StoredBlocker = { code: string; severity: string; location: string; message: string };
type StoredReview = { reviewId: string; outcome: string; blockers: StoredBlocker[] };

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "franklin-39a37d06-panel-blockers.json");

function loadFixture(): { runId: string; reviews: StoredReview[] } {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as { runId: string; reviews: StoredReview[] };
}

/** Split on the FIRST TWO "/" only — a unit may itself contain " / " (EC-1). */
function splitLocation(location: string): [string, string | undefined, string | undefined] {
  const first = location.indexOf("/");
  if (first < 0) return [location, undefined, undefined];
  const second = location.indexOf("/", first + 1);
  if (second < 0) return [location.slice(0, first), location.slice(first + 1), undefined];
  return [location.slice(0, first), location.slice(first + 1, second), location.slice(second + 1)];
}

type Replayed = { outcome: "PASS" | "FAIL" | "ERROR"; kept: number; downgraded: number };

/**
 * Re-decide one stored review under the rule. Only READER.BLOCKING.* BLOCKERs
 * whose location's second segment starts with "seat-" are seat findings and go
 * through the function; every other BLOCKER (quiz verdicts at chNN/quiz/...,
 * SEMANTIC_PANEL_READER_FAILED) stays a BLOCKER untouched.
 */
function replay(review: Pick<StoredReview, "blockers">, singleSeatBlocking?: readonly string[]): Replayed {
  const seat: { chapter: string; seatId: string; category: string }[] = [];
  const other: StoredBlocker[] = [];
  for (const blocker of review.blockers) {
    const [chapter, second] = splitLocation(blocker.location);
    if (blocker.code.startsWith(READER_BLOCKING_CODE_PREFIX) && second !== undefined && second.startsWith("seat-")) {
      seat.push({ chapter, seatId: second, category: blocker.code.slice(READER_BLOCKING_CODE_PREFIX.length) });
    } else {
      other.push(blocker);
    }
  }
  const decided = singleSeatBlocking === undefined
    ? corroboratePanelBlockingFindings(seat)
    : corroboratePanelBlockingFindings(seat, singleSeatBlocking);
  const kept = decided.filter((entry) => entry.severity === "BLOCKER").length;
  const downgraded = decided.length - kept;
  const outcome = other.some((blocker) => isReaderPanelInfraCode(blocker.code))
    ? "ERROR"
    : (other.length > 0 || kept > 0) ? "FAIL" : "PASS";
  return { outcome, kept, downgraded };
}

function replayTable(label: string, singleSeatBlocking?: readonly string[]): string[] {
  const { reviews } = loadFixture();
  return reviews.map((review, index) => {
    const result = replay(review, singleSeatBlocking);
    const line = `REPLAY ${label} P${index + 1} ${review.reviewId} ${result.outcome} ${result.kept}/${result.downgraded}`;
    console.log(line);
    return `P${index + 1} ${result.outcome} ${result.kept}/${result.downgraded}`;
  });
}

requiredTest("replay fixture: 14 stored panel reviews of run 39a37d06", () => {
  const fixture = loadFixture();
  assert.equal(fixture.runId, "book-run-39a37d06-59c8-430a-87fe-3ad3b19a1c14");
  assert.equal(fixture.reviews.length, 14);
  // EC-1 is live in the fixture: a unit containing " / " is still one seat finding.
  assert.ok(fixture.reviews.some((review) => review.blockers.some((blocker) => splitLocation(blocker.location)[2]?.includes(" / "))));
});

requiredTest("REPLAY D2 = A2 (implemented default) reproduces the spec table exactly", () => {
  assert.deepEqual(replayTable("D2=A2"), [
    "P1 FAIL 20/14",
    "P2 FAIL 14/13",
    "P3 FAIL 5/16",
    "P4 FAIL 6/11",
    "P5 FAIL 2/11",
    "P6 FAIL 4/15",
    "P7 FAIL 2/13",
    "P8 FAIL 5/4",
    "P9 FAIL 10/8",
    "P10 PASS 0/9",
    "P11 FAIL 2/8",
    "P12 PASS 0/15",
    "P13 FAIL 3/13",
    "P14 ERROR 0/5",
  ]);
});

requiredTest("REPLAY D2 = A (reference, unsafe also single-seat blocking) reproduces the reference table exactly", () => {
  assert.deepEqual(replayTable("D2=A", ["unsafe", "schema_or_app_breaking"]), [
    "P1 FAIL 20/14",
    "P2 FAIL 16/11",
    "P3 FAIL 5/16",
    "P4 FAIL 6/11",
    "P5 FAIL 2/11",
    "P6 FAIL 4/15",
    "P7 FAIL 3/12",
    "P8 FAIL 5/4",
    "P9 FAIL 11/7",
    "P10 FAIL 1/8",
    "P11 FAIL 2/8",
    "P12 PASS 0/15",
    "P13 FAIL 3/13",
    "P14 ERROR 0/5",
  ]);
});

requiredTest("replay: a chNN/quiz/qNN READER.BLOCKING.structurally_invalid verdict is never a seat finding and keeps the outcome FAIL", () => {
  const result = replay({
    blockers: [
      { code: "READER.BLOCKING.structurally_invalid", severity: "BLOCKER", location: "ch09/quiz/q08", message: "3 of 3 blind reader seats independently derived choice b" },
      { code: "READER.BLOCKING.structurally_invalid", severity: "BLOCKER", location: "ch09/seat-cold/Quiz Q8 / Card 2", message: "single seat" },
    ],
  });
  assert.deepEqual(result, { outcome: "FAIL", kept: 0, downgraded: 1 });
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
