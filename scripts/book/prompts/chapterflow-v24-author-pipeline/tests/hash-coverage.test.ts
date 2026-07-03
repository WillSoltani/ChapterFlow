/**
 * Pins chapterContentHash coverage to the ChapterV21 type.
 *
 * The QC-attestation gate is only as strong as this hash: any reader-facing
 * field NOT covered can be edited after review without going STALE. The
 * xfail block at the bottom is the verified list of such fields (2026-06-09
 * review) — Phase 1 inverts the projection to an exclude-list and flips them.
 */

import assert from "node:assert/strict";

import { chapterContentHash, chapterContentHashV1, isAttestationFresh } from "../src/critics/qcAttestation.js";
import type { ChapterV21 } from "../src/types.js";
import { test } from "./harness.js";
import { deepStrip, makeChapter } from "./helpers.js";

const BOOK = "zz-fixture-hash";

function mutated(fn: (ch: ChapterV21) => void): { base: string; changed: string } {
  const base = makeChapter(BOOK, 1);
  const copy: ChapterV21 = structuredClone(base);
  fn(copy);
  return { base: chapterContentHash(base), changed: chapterContentHash(copy) };
}

function assertCovered(label: string, fn: (ch: ChapterV21) => void): void {
  test(`covers ${label}`, () => {
    const { base, changed } = mutated(fn);
    assert.notEqual(changed, base, `${label} changed but hash did not — a post-review edit here ships under a "fresh" attestation`);
  });
}

function assertExcluded(label: string, fn: (ch: ChapterV21) => void): void {
  test(`excludes ${label} (by design)`, () => {
    const { base, changed } = mutated(fn);
    assert.equal(changed, base, `${label} should not affect the hash`);
  });
}

// ── Determinism ──────────────────────────────────────────────────────────────

test("hash is deterministic across clones", () => {
  const ch = makeChapter(BOOK, 2);
  assert.equal(chapterContentHash(ch), chapterContentHash(structuredClone(ch)));
});

test("hash survives top-level key reordering (canonical projection)", () => {
  const ch = makeChapter(BOOK, 3);
  // Rebuild the object with reversed key insertion order.
  const reversed = Object.fromEntries(Object.entries(ch).reverse()) as unknown as ChapterV21;
  assert.equal(chapterContentHash(ch), chapterContentHash(reversed));
});

// ── Reader-facing fields that ARE covered (regression-pin them) ─────────────

assertCovered("title", (c) => { c.title = c.title + " revised"; });
assertCovered("hook", (c) => { c.hook = c.hook + " now sharper"; });
assertCovered("counterintuition", (c) => { c.counterintuition = "Entirely different claim."; });
assertCovered("keyTakeaway", (c) => { c.keyTakeaway = c.keyTakeaway + " Updated."; });
assertCovered("tryThisNow", (c) => { c.tryThisNow = "Do a different thing immediately."; });
assertCovered("breakdown.fastRead", (c) => { c.breakdown.fastRead += " Extra sentence."; });
assertCovered("breakdown.deepRead", (c) => { c.breakdown.deepRead += " Extra sentence."; });
assertCovered("breakdown.fullRead", (c) => { c.breakdown.fullRead += " Extra sentence."; });
assertCovered("examples[].title", (c) => { c.examples[0].title = "Renamed scene"; });
assertCovered("examples[].scenario", (c) => { c.examples[0].scenario += " A new twist."; });
assertCovered("examples[].whatToDo", (c) => { c.examples[0].whatToDo += " Then re-check."; });
assertCovered("examples[].whyItMatters", (c) => { c.examples[0].whyItMatters += " It compounds."; });
assertCovered("quiz prompt", (c) => { c.quiz.questions[0].prompt += " (updated)"; });
assertCovered("quiz choices", (c) => { c.quiz.questions[0].choices[1] += " instead"; });
assertCovered("quiz correctIndex — THE wrong-key field", (c) => {
  c.quiz.questions[0].correctIndex = (c.quiz.questions[0].correctIndex + 1) % 3;
});
assertCovered("quiz explanation", (c) => { c.quiz.questions[0].explanation += " Because."; });
assertCovered("reviewCards[].front", (c) => { c.reviewCards[0].front += " (v2)"; });
assertCovered("reviewCards[].back", (c) => { c.reviewCards[0].back += " (v2)"; });
assertCovered("implementationPlan.title", (c) => { c.implementationPlan.title = "Another skill"; });
assertCovered("implementationPlan.coreSkill", (c) => { c.implementationPlan.coreSkill += " More."; });
assertCovered("implementationPlan.ifThenPlans", (c) => { c.implementationPlan.ifThenPlans[0].plan += " Always."; });
assertCovered("memorableLines", (c) => { c.memorableLines![0].text = "A different line."; });

// ── Provenance / metadata exclusions (the promote-strip invariant) ──────────

assertExcluded("sourceAnchorId on an example", (c) => { c.examples[0].sourceAnchorId = "anchor-99"; });
assertExcluded("sourceAnchorIds on an example", (c) => { c.examples[0].sourceAnchorIds = ["anchor-99", "anchor-100"]; });
assertExcluded("sourceAnchorId on a quiz question", (c) => { c.quiz.questions[0].sourceAnchorId = "anchor-7"; });
assertExcluded("keyEvidenceAnchorIds on a quiz question", (c) => { c.quiz.questions[0].keyEvidenceAnchorIds = ["anchor-7"]; });
assertExcluded("sourceAnchorId on a review card", (c) => { c.reviewCards[0].sourceAnchorId = "anchor-3"; });
assertExcluded("authoring source anchor map", (c) => {
  c.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "hash-a",
      observedAnchorIds: ["anchor-1"],
      effectiveAnchors: { hook: ["anchor-1"] },
    },
  };
});
assertExcluded("chapterId / number (identity metadata)", (c) => { c.chapterId = "other-book-ch09"; c.number = 9; });
assertExcluded("questionId convention", (c) => { c.quiz.questions[0].questionId = "renamed-q1"; });
assertExcluded("planSpec (writer scaffolding, not shown to readers)", (c) => {
  c.examples[0].planSpec.domain = "different domain";
  c.examples[0].planSpec.requiredBeat = "different beat";
});

test("promote-time provenance strip cannot stale a valid attestation", () => {
  const ch = makeChapter(BOOK, 4);
  for (const ex of ch.examples) ex.sourceAnchorId = "a1";
  for (const q of ch.quiz.questions) q.sourceAnchorId = "a2";
  for (const card of ch.reviewCards) card.sourceAnchorId = "a3";
  const stripped = deepStrip(ch, "sourceAnchorId");
  assert.equal(chapterContentHash(ch), chapterContentHash(stripped));
});

// ── Formerly-missed fields, covered since the v2 exclude-list inversion ─────
// (these were the verified 2026-06-09 gaps: the v1 include-list silently
// dropped them, so a post-review edit shipped under a "fresh" attestation)

assertCovered("quiz.passingScorePercent", (c) => { c.quiz.passingScorePercent = 95; });
assertCovered("readingTimeMinutes", (c) => { c.readingTimeMinutes = 45; });
assertCovered("examples[].tags", (c) => { c.examples[0].tags = ["completely", "different"]; });
assertCovered("reviewCards[].difficulty", (c) => {
  c.reviewCards[0].difficulty = c.reviewCards[0].difficulty === "hard" ? "easy" : "hard";
});

test("implementationPlan inner key order does not affect the hash (deep key sort)", () => {
  const ch = makeChapter(BOOK, 5);
  const reordered = structuredClone(ch);
  reordered.implementationPlan = Object.fromEntries(
    Object.entries(reordered.implementationPlan).reverse(),
  ) as ChapterV21["implementationPlan"];
  assert.equal(chapterContentHash(ch), chapterContentHash(reordered));
});

// ── Hash versioning: legacy v1 attestations must keep verifying ─────────────

test("a legacy v1 attestation (no hashVersion) stays FRESH for unchanged content", () => {
  const ch = makeChapter(BOOK, 6);
  const att = {
    schemaVersion: "qc-attest-v1" as const,
    bookId: BOOK,
    chapterNumber: 6,
    chapterId: ch.chapterId,
    verdict: "PUBLISHABLE" as const,
    contentHash: chapterContentHashV1(ch), // recorded before the v2 switch
    reviewer: "test",
    reviewedAt: "2026-06-01T00:00:00.000Z",
  };
  assert.ok(isAttestationFresh(att, ch), "v2 rollout must not mass-stale existing attestations");
  const edited = structuredClone(ch);
  edited.quiz.questions[0].correctIndex = (edited.quiz.questions[0].correctIndex + 1) % 3;
  assert.ok(!isAttestationFresh(att, edited), "a real edit must still stale a v1 attestation");
});
