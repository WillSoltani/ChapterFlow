/**
 * C2 — the reader panel's 0-100 factor scale must carry band anchors, and every
 * numeric claim in those anchors must be RECOMPUTED from the published 140-book
 * evaluation data.
 *
 * The first attempt at C2 shipped a false statistic into a judging prompt ("the
 * best book scored 89.7", "no shipped book reached 90"). The catalogue's real
 * maximum is 90.1 and exactly one book is >= 90. This file exists so that class
 * of error cannot come back:
 *
 *  - test 1 pins the band TAXONOMY: the declared bands must reproduce the `band`
 *    label the evaluation data publishes for all 140 books, with no gaps.
 *  - test 2 pins the DISTRIBUTION constants (book count, per-band counts, top
 *    score, domain count) against the data.
 *  - test 3 is the anti-false-statistic guard: EVERY numeric token in the
 *    rendered block must be a member of the set recomputed from the data. A
 *    future edit that invents a number fails here.
 *  - test 4 pins the INSTRUMENT: the block must be rendered into the prompt the
 *    V25 gating panel actually sends to each seat (buildBlindReaderTask ->
 *    buildReaderExperienceTask), not merely into a module nothing renders.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  CATALOGUE_BOOK_COUNT,
  CATALOGUE_DOMAIN_COUNT,
  CATALOGUE_SCORE_BANDS,
  CATALOGUE_TOP_SCORE,
  REVIEW_SCORE_SCALE_MAX,
  bandForCatalogueScore,
  renderReviewScoreBandBlock,
} from "../src/review/reviewScoreBands.js";
import { buildReaderExperienceTask } from "../src/review/readerExperienceReview.js";
import { READER_PANEL_SEATS, buildBlindReaderTask } from "../src/review/laneOrchestrator.js";
import { buildReaderReviewTask } from "../src/review/readerReview.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../..");
const EVAL_DATA = resolve(
  REPO_ROOT,
  "docs/v25/chapterflow-140-evaluation/chapterflow-140-evaluation-report-data.json",
);

type EvalBook = { title: string; score: number; band: string };
type EvalData = {
  meta: { books: number; rubric: string };
  domain_names: string[];
  domain_weights: Record<string, number>;
  books: EvalBook[];
};

let cached: EvalData | null = null;
function loadEvaluationData(): EvalData {
  assert.ok(
    existsSync(EVAL_DATA),
    `the 140-book evaluation data is the SOLE source for every number in the band block; missing: ${EVAL_DATA}`,
  );
  if (cached === null) cached = JSON.parse(readFileSync(EVAL_DATA, "utf8")) as EvalData;
  return cached;
}

test("band taxonomy: the declared bands reproduce the published band label of all 140 books", () => {
  const data = loadEvaluationData();

  // Bands are contiguous, descending, and cover the whole 0..scale-max range.
  const sorted = [...CATALOGUE_SCORE_BANDS].sort((a, b) => b.min - a.min);
  assert.deepEqual(sorted, [...CATALOGUE_SCORE_BANDS], "bands are declared highest-first");
  assert.equal(sorted[0].max, REVIEW_SCORE_SCALE_MAX, "the top band ends at the scale maximum");
  assert.equal(sorted[sorted.length - 1].min, 0, "the bottom band starts at 0");
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(
      sorted[i].max < sorted[i - 1].min,
      `band ${sorted[i].name} must not overlap ${sorted[i - 1].name}`,
    );
    assert.ok(
      Math.abs(sorted[i - 1].min - sorted[i].max - 0.1) < 1e-9,
      `bands ${sorted[i].name}/${sorted[i - 1].name} must be contiguous at one-decimal resolution`,
    );
  }

  // The declared band names are EXACTLY the label set the data publishes.
  const publishedNames = [...new Set(data.books.map((b) => b.band))];
  assert.deepEqual(
    [...CATALOGUE_SCORE_BANDS].map((b) => b.name).sort(),
    [...publishedNames].sort(),
    "declared band names === the distinct `band` labels in the evaluation data",
  );

  // And the declared ranges reproduce the published label for EVERY book.
  for (const book of data.books) {
    assert.equal(
      bandForCatalogueScore(book.score),
      book.band,
      `band range must reproduce the published label for "${book.title}" (${book.score})`,
    );
  }
});

test("band distribution constants are recomputed from the evaluation data", () => {
  const data = loadEvaluationData();

  assert.equal(CATALOGUE_BOOK_COUNT, data.books.length, "book count === books in the data");
  assert.equal(CATALOGUE_BOOK_COUNT, data.meta.books, "book count === meta.books");

  const scores = data.books.map((b) => b.score);
  assert.equal(CATALOGUE_TOP_SCORE, Math.max(...scores), "top score === max score in the data");
  assert.ok(
    Math.max(...scores) <= REVIEW_SCORE_SCALE_MAX && Math.min(...scores) >= 0,
    "every catalogue score lies on the declared 0..scale-max range",
  );

  assert.equal(CATALOGUE_DOMAIN_COUNT, data.domain_names.length, "domain count === domain_names");
  assert.equal(
    CATALOGUE_DOMAIN_COUNT,
    Object.keys(data.domain_weights).length,
    "domain count === weighted domains",
  );

  for (const band of CATALOGUE_SCORE_BANDS) {
    const observed = data.books.filter((b) => b.band === band.name).length;
    assert.equal(band.count, observed, `band ${band.name}: declared count === observed count`);
  }
  assert.equal(
    CATALOGUE_SCORE_BANDS.reduce((n, b) => n + b.count, 0),
    data.books.length,
    "the per-band counts partition the catalogue",
  );
});

test("anti-false-statistic guard: every number in the rendered band block is recomputed from the data", () => {
  const data = loadEvaluationData();
  const block = renderReviewScoreBandBlock();

  // The allowed set is built from the DATA, never from the block.
  const allowed = new Set<number>();
  allowed.add(0);
  allowed.add(REVIEW_SCORE_SCALE_MAX);
  allowed.add(data.books.length);
  allowed.add(data.meta.books);
  allowed.add(data.domain_names.length);
  allowed.add(Math.max(...data.books.map((b) => b.score)));
  for (const band of CATALOGUE_SCORE_BANDS) {
    // Bounds are legitimate only because test 1 proved them against the data.
    allowed.add(band.min);
    allowed.add(band.max);
    allowed.add(data.books.filter((b) => b.band === band.name).length);
  }

  const numbers = (block.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  assert.ok(numbers.length > 0, "the block must actually contain numbers");
  for (const n of numbers) {
    assert.ok(
      allowed.has(n),
      `band block states ${n}, which is not recomputable from the evaluation data (allowed: ${[...allowed].sort((a, b) => a - b).join(", ")})`,
    );
  }

  // A statistic the previous attempt invented must never reappear.
  assert.equal(block.includes("89.7"), false, "89.7 is not the catalogue maximum");
  assert.ok(
    block.includes(String(Math.max(...data.books.map((b) => b.score)))),
    "the block must quote the real catalogue maximum",
  );
});

test("the band block is rendered into the instrument that GATES: every panel seat's task", () => {
  const block = renderReviewScoreBandBlock();

  assert.ok(
    buildReaderExperienceTask("workspace/ch01.phase1.md").includes(block),
    "the reader-experience instrument carries the band anchors",
  );
  assert.ok(READER_PANEL_SEATS.length > 0, "the frozen panel has seats");
  for (const seat of READER_PANEL_SEATS) {
    assert.ok(
      buildBlindReaderTask(seat, "workspace/ch01.phase1.md").includes(block),
      `panel seat ${seat.id} is sent the band anchors`,
    );
  }
  assert.ok(
    buildReaderReviewTask("workspace/ch01.txt").includes(block),
    "the legacy authoring-gate instrument scores on the same anchored scale",
  );
});
