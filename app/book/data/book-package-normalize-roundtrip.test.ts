import { test } from "node:test";
import assert from "node:assert/strict";
// Reuse the existing fixture import surface (same as bookPackages.test.ts) rather
// than opening any book-packages/*.v21.json directly. BOOK_PACKAGES are the
// normalizer's outputs, computed at module load via normalizeAnyPackage.
import { BOOK_PACKAGES, normalizeAnyPackage } from "./bookPackages";
import type {
  ResolvedBookPackage,
  ResolveTone,
  ToneKeyed,
} from "@/lib/book-package-types";

// Round-trip coverage for WS3-008: the normalizer output must conform to the
// canonical RESOLVED (tone-flattened) stage, single-sourced in
// lib/book-package-types.ts. Both a compile-time (type-level) assertion and a
// runtime spot-check on the fields the finding flagged as drifted between the
// raw (tone-keyed) and resolved (string) type systems: chapterBreakdown,
// oneMinuteRecap, keyTakeaways, and quiz explanation.

// ── Compile-time conformance (fails `tsc` / npm run verify on drift) ─────────
// 1. The normalizer's return type is assignable to the canonical Resolved type.
// 2. The lifecycle contract: a raw tone-keyed value resolves to a plain string.
const _typeConformance: [
  ReturnType<typeof normalizeAnyPackage> extends ResolvedBookPackage ? true : false,
  ResolveTone<ToneKeyed> extends string ? true : false,
] = [true, true];

// A minimal RAW v13/NSTD package built inline (NOT from the corpus) so the
// tone-keyed → string flattening of every flagged field is exercised end-to-end,
// including oneMinuteRecap/keyTakeaways which the v21 corpus does not populate.
const RAW_NSTD_FIXTURE = {
  schemaVersion: "1.1.0",
  packageId: "pkg-roundtrip-test",
  createdAt: "2026-01-01T00:00:00.000Z",
  contentOwner: "test",
  book: {
    bookId: "roundtrip-test-book",
    title: "Round Trip",
    author: "Tester",
    categories: ["testing"],
    variantFamily: "EMH",
  },
  chapters: [
    {
      chapterId: "ch-1",
      number: 1,
      title: "One",
      readingTimeMinutes: 5,
      contentVariants: {
        easy: {
          chapterBreakdown: {
            gentle: "G breakdown",
            direct: "D breakdown",
            competitive: "C breakdown",
          },
          keyTakeaways: [
            { point: { gentle: "G point", direct: "D point", competitive: "C point" } },
          ],
          oneMinuteRecap: {
            retrieve: { gentle: "G retrieve", direct: "D retrieve", competitive: "C retrieve" },
            connect: { gentle: "G connect", direct: "D connect", competitive: "C connect" },
            preview: { gentle: "G preview", direct: "D preview", competitive: "C preview" },
          },
        },
      },
      examples: [],
      quiz: {
        passingScorePercent: 80,
        questions: [
          {
            questionId: "q1",
            prompt: "Prompt?",
            choices: ["a", "b"],
            correctIndex: 0,
            explanation: { gentle: "G expl", direct: "D expl", competitive: "C expl" },
          },
        ],
      },
    },
  ],
};

test("canonical Resolved stage is the normalizer contract (type-level + corpus)", () => {
  assert.deepEqual(_typeConformance, [true, true]);

  // BOOK_PACKAGES are normalizer outputs — assignable to the canonical type.
  const resolvedPackages: ResolvedBookPackage[] = BOOK_PACKAGES;
  assert.ok(resolvedPackages.length > 0, "expected at least one normalized package fixture");

  // Runtime spot-check over the real corpus for the fields v21 packages populate:
  // chapterBreakdown (Raw ToneKeyed) must arrive as a flattened string, and quiz
  // explanation must never be a tone-keyed object.
  let sawChapterBreakdown = false;
  let sawExplanation = false;
  for (const pkg of resolvedPackages) {
    for (const chapter of pkg.chapters) {
      for (const variant of Object.values(chapter.contentVariants)) {
        if (variant?.chapterBreakdown !== undefined) {
          assert.equal(
            typeof variant.chapterBreakdown,
            "string",
            "chapterBreakdown must be a flattened string, not a tone-keyed object"
          );
          sawChapterBreakdown = true;
        }
      }
      for (const q of chapter.quiz.questions) {
        if (q.explanation !== undefined) {
          assert.equal(
            typeof q.explanation,
            "string",
            "quiz explanation must be a flattened string for v21 packages"
          );
          sawExplanation = true;
        }
      }
    }
  }
  assert.ok(sawChapterBreakdown, "no corpus fixture exercised chapterBreakdown");
  assert.ok(sawExplanation, "no corpus fixture exercised quiz explanation");
});

test("normalizer flattens every flagged tone-keyed field to Resolved strings", () => {
  const resolved: ResolvedBookPackage = normalizeAnyPackage(RAW_NSTD_FIXTURE, "direct");
  const variant = resolved.chapters[0]?.contentVariants.easy;
  assert.ok(variant, "expected the easy variant to normalize");

  // chapterBreakdown: ToneKeyed -> string, resolved to the requested "direct" tone.
  assert.equal(typeof variant!.chapterBreakdown, "string");
  assert.equal(variant!.chapterBreakdown, "D breakdown");

  // keyTakeaways: Array<{ point: ToneKeyed }> -> string[].
  assert.ok(Array.isArray(variant!.keyTakeaways));
  assert.deepEqual(variant!.keyTakeaways, ["D point"]);

  // oneMinuteRecap: tone-keyed retrieve/connect/preview -> string[].
  assert.deepEqual(variant!.oneMinuteRecap, ["D retrieve", "D connect", "D preview"]);

  // explanation: ToneKeyed -> string.
  const explanation = resolved.chapters[0]?.quiz.questions[0]?.explanation;
  assert.equal(typeof explanation, "string");
  assert.equal(explanation, "D expl");
});
