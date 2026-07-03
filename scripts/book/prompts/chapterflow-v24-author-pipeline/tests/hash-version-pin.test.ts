/**
 * Golden pin for the v2 chapterContentHash ALGORITHM (issue I4 guard).
 *
 * hash-coverage.test.ts pins WHICH fields affect the hash; it does NOT pin the hash VALUE, so ADDING a
 * new key to V2_EXCLUDE_DEEP (exactly what this branch did with `authoring`/`*SourceAnchorIds`) slips
 * through silently — yet it changes the v2 hash for every chapter carrying that key and re-stales their
 * (git-tracked) attestations across a checkout/merge with no version marker. This file fails LOUDLY on
 * any v2-algorithm change so it is forced to bump QcHashVersion (add v3 + a frozen v2 path), never edit
 * v2 in place. If you intentionally changed the algorithm: add v3, do NOT just update GOLDEN_V2.
 */

import assert from "node:assert/strict";

import { chapterContentHash } from "../src/critics/qcAttestation.js";
import type { ChapterV21 } from "../src/types.js";
import { test } from "./harness.js";

// Self-contained fixture (NOT makeChapter — so this pin tracks the ALGORITHM, not fixture drift). It
// carries the v2-EXCLUDED scaffolding keys (authoring + every *SourceAnchorIds + exampleId/cardId/…)
// so the exclude-list genuinely participates in the result.
const GOLDEN_CHAPTER = {
  schemaVersion: "chapterflow-v21-authored",
  chapterId: "zz-golden-ch01", number: 1, title: "Golden Pin", readingTimeMinutes: 11,
  hook: "A fixed hook.", hookSourceAnchorIds: ["ch01.fact.1"],
  counterintuition: "A fixed counterintuition.", counterintuitionSourceAnchorIds: ["ch01.fact.1"],
  tryThisNow: "Do the fixed thing.", tryThisNowSourceAnchorIds: ["ch01.fact.1"],
  keyTakeaway: "The fixed takeaway.", keyTakeawaySourceAnchorIds: ["ch01.fact.1"],
  breakdown: { fastRead: "Fast.", deepRead: "Deep.", fullRead: "Full." },
  examples: [{ exampleId: "ex01", sourceAnchorId: "ch01.ex.a", sourceAnchorIds: ["ch01.ex.a"], title: "Ex", format: "audit", scenario: "S.", whatToDo: "W.", whyItMatters: "Y." }],
  quiz: { questions: [{ questionId: "q01", sourceAnchorId: "ch01.fact.1", prompt: "P?", choices: ["a", "b", "c"], correctIndex: 0, explanation: "E." }] },
  reviewCards: [{ cardId: "c01", sourceAnchorId: "ch01.fact.1", sourceAnchorIds: ["ch01.fact.1"], front: "F", back: "B" }],
  implementationPlan: { title: "Plan", titleSourceAnchorIds: ["ch01.fact.1"], coreSkill: "CS", coreSkillSourceAnchorIds: ["ch01.fact.1"] },
  memorableLines: [{ text: "Line.", location: "breakdown.fastRead", why: "W", sourceAnchorIds: ["ch01.fact.1"] }],
  authoring: { schemaVersion: "chapter-authoring-v1", sourceAnchors: { effectiveAnchors: { hook: ["ch01.fact.1"] } } },
} as unknown as ChapterV21;

// Recompute deliberately (never auto-update) if and only if you are ADDING a v3 version, not mutating v2.
const GOLDEN_V2 = "0d5839bb2fbae2b1";

test("v2 chapterContentHash is algorithm-pinned (an in-place change silently re-stales attestations — bump QcHashVersion to v3 instead)", () => {
  assert.equal(
    chapterContentHash(GOLDEN_CHAPTER),
    GOLDEN_V2,
    "the v2 hash ALGORITHM changed. If intentional, add a NEW \"v3\" QcHashVersion, freeze this set as v2, " +
      "branch the new set under v3 in hashForVersion/isAttestationFresh, and stamp new attestations v3 — " +
      "do NOT edit V2_EXCLUDE_DEEP in place (that re-stales every tracked attestation across a merge).",
  );
});

test("v2 hash ignores the excluded scaffolding keys (authoring + *SourceAnchorIds) — so they can be stripped at promote without going stale", () => {
  const stripped = JSON.parse(JSON.stringify(GOLDEN_CHAPTER)) as Record<string, unknown>;
  delete stripped.authoring;
  for (const k of Object.keys(stripped)) if (k.endsWith("SourceAnchorIds")) delete stripped[k];
  // unit-level anchors too
  (stripped.examples as Array<Record<string, unknown>>).forEach((e) => { delete e.sourceAnchorId; delete e.sourceAnchorIds; delete e.exampleId; });
  assert.equal(
    chapterContentHash(stripped as unknown as ChapterV21),
    GOLDEN_V2,
    "removing v2-EXCLUDED keys must NOT change the hash — if it did, an exclude key was dropped from V2_EXCLUDE_DEEP",
  );
});
