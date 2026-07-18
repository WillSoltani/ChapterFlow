/**
 * IMP-20 §E — legacy reader-review adapter (WP-B1).
 *
 *  - test 21: a legacy `ChapterReviewV1` (the ship84 instrument) parses onto the
 *    new `ReaderExperienceReviewV1` shape ONLY through `adaptLegacyReaderReview`
 *    — fed straight into the new strict validator it is rejected; the adapter
 *    maps ship84 → recommendation and drops the model-owned ship bit.
 *  - test 22: an adapted legacy record can NEVER satisfy the new freshness
 *    predicate `readerReviewIsFresh` — the LEGACY rubricVersion is the decisive
 *    wedge (matching every bound hash, freshness still fails; only rewriting the
 *    rubricVersion to the new version would flip it).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  CHAPTER_REVIEW_SCHEMA_VERSION,
  type ChapterReviewV1,
  type ReviewFactor,
  REVIEW_FACTORS,
} from "../src/artifacts/artifactTypes.js";
import {
  READER_EXPERIENCE_RUBRIC_VERSION,
  readerReviewIsFresh,
  validateReaderExperienceReview,
} from "../src/contracts/readerExperienceReview.js";
import {
  adaptLegacyReaderReview,
  LEGACY_NO_SCHEMA,
  LEGACY_READER_RUBRIC_VERSION,
} from "../src/review/legacyReaderReviewAdapter.js";

const CONTENT_SHA = "1".repeat(64);
const DOC_SHA = "2".repeat(64);

function scores(): Record<ReviewFactor, number> {
  const s = {} as Record<ReviewFactor, number>;
  for (const f of REVIEW_FACTORS) s[f] = 82;
  return s;
}

/** A persisted legacy ChapterReviewV1 (the ship84 instrument), stamped under
 *  the legacy reader-rubric-v3-phase1 version. */
function fxLegacyReview(over: Partial<ChapterReviewV1> = {}): ChapterReviewV1 {
  return {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: "zz-fixture-book-ch01",
    chapterNumber: 1,
    contentHash: CONTENT_SHA,
    reviewerSessionId: "sess-legacy",
    scores: scores(),
    composite: 85.8,
    ship84: true,
    pass: true,
    valid: true,
    keyCheck: { derived: ["a", "b", "c"], matches: 3, of: 3, disagreements: [] },
    quotes: [{ quote: "a verbatim strong line", why: "clear mechanism", verified: true }],
    tells: ["Q2 longest-choice tell"],
    complaints: [],
    oneParagraphVerdict: "Shippable as-is.",
    docHash: DOC_SHA,
    hashVersion: "v3",
    rubricVersion: "reader-rubric-v3-phase1",
    ...over,
  };
}

// ── test 21 — legacy ship84 parses ONLY through the adapter ────────────────────

test("21: a legacy ChapterReviewV1 parses onto the new shape only through the adapter", () => {
  const legacy = fxLegacyReview();

  // Fed straight into the new strict validator, the legacy record is rejected
  // (wrong schema tag, no recommendation, a stray ship84 key, …).
  const directErrors = validateReaderExperienceReview(legacy as unknown as Record<string, unknown>);
  assert.ok(directErrors.length > 0, "raw legacy record must NOT validate as a ReaderExperienceReviewV1");

  // Only via the adapter does it become a schema-valid ReaderExperienceReviewV1.
  const adapted = adaptLegacyReaderReview(legacy);
  assert.deepEqual(
    validateReaderExperienceReview(adapted as unknown as Record<string, unknown>),
    [],
    "adapted legacy record must be schema-valid",
  );

  // The model-owned ship bit is dropped; ship84===true maps to SHIP.
  assert.ok(!("ship84" in (adapted as Record<string, unknown>)), "adapter must drop the ship84 field");
  assert.equal(adapted.recommendation, "SHIP");

  // ship84===false + a mustFix complaint → BLOCK.
  const blocked = adaptLegacyReaderReview(
    fxLegacyReview({
      ship84: false,
      pass: false,
      complaints: [{ unit: "quiz Q2", problem: "broken key", mustFix: true }],
    }),
  );
  assert.equal(blocked.recommendation, "BLOCK");
  // the mustFix complaint is preserved (annotated) as an advisory, never a fabricated blocker.
  assert.equal(blocked.blockingFindings.length, 0);
  assert.equal(blocked.advisoryFindings.length, 1);
  assert.ok(blocked.advisoryFindings[0].problem.includes("[legacy mustFix]"));

  // ship84===false with NO mustFix (the "ship bit artifact" case) → REVISE.
  const revise = adaptLegacyReaderReview(
    fxLegacyReview({ ship84: false, pass: false, composite: 85.8, complaints: [] }),
  );
  assert.equal(revise.recommendation, "REVISE");
});

// ── test 22 — an adapted legacy record can never satisfy new freshness ─────────

test("22: an adapted legacy record can never satisfy the new freshness predicate", () => {
  const adapted = adaptLegacyReaderReview(fxLegacyReview());

  // Every bound hash matches — content, doc, and the legacy-no-schema sentinel —
  // yet freshness FAILS, solely on the rubricVersion wedge.
  assert.equal(adapted.chapterContentSha256, CONTENT_SHA);
  assert.equal(adapted.readerDocumentSha256, DOC_SHA);
  assert.equal(adapted.schemaSha256, LEGACY_NO_SCHEMA);
  assert.equal(
    readerReviewIsFresh(adapted, CONTENT_SHA, DOC_SHA, LEGACY_NO_SCHEMA),
    false,
    "legacy record must not be fresh",
  );

  // The version wedge is the DECISIVE reason: the stamped rubricVersion is the
  // legacy one, not the new one.
  assert.equal(adapted.rubricVersion, LEGACY_READER_RUBRIC_VERSION);
  assert.notEqual(adapted.rubricVersion, READER_EXPERIENCE_RUBRIC_VERSION);

  // Prove it: only rewriting the rubricVersion to the NEW version (which the
  // adapter never does) would make an otherwise hash-matching record fresh.
  const rewired = { ...adapted, rubricVersion: READER_EXPERIENCE_RUBRIC_VERSION };
  assert.equal(
    readerReviewIsFresh(rewired, CONTENT_SHA, DOC_SHA, LEGACY_NO_SCHEMA),
    true,
    "the ONLY freshness blocker is the legacy rubricVersion",
  );

  // A pre-E2 legacy record with no docHash still adapts (sentinel doc hash) and
  // is still not fresh.
  const noDoc = adaptLegacyReaderReview(fxLegacyReview({ docHash: undefined }));
  assert.equal(readerReviewIsFresh(noDoc, CONTENT_SHA, noDoc.readerDocumentSha256, LEGACY_NO_SCHEMA), false);
});
