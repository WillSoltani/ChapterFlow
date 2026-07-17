/**
 * WP-E11 — blind 1-chapter package builder.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX,
  CHAPTER_DIAGNOSTIC_EPOCH,
  ChapterDiagnosticPackageError,
  buildChapterDiagnosticBookId,
  buildChapterDiagnosticPackage,
  scanChapterDiagnosticForbiddenTokens,
  serializeChapterDiagnosticPackage,
  type ChapterDiagnosticPackageInput,
} from "../src/evaluation/chapterDiagnosticPackage.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";

function fixtureChapter(overrides: Partial<ChapterV21> = {}): ChapterV21 {
  const base: ChapterV21 = {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId: "nudge-ch03",
    number: 3,
    title: "Fixture Chapter Title",
    readingTimeMinutes: 8,
    hook: "A short arresting hook line about a fixture decision moment.",
    counterintuition: "The fixture claim reverses a common assumption in a testable way.",
    tryThisNow: "In the next hour, write one sentence naming a fixture assumption to test.",
    keyTakeaway: "Fixture chapters give the harness deterministic, non-identifying test content to build packages from.",
    breakdown: {
      fastRead: "Fixture fast read paragraph with enough words to look like real prose content for testing.",
      deepRead: "Fixture deep read paragraph explaining the fixture mechanism in a bit more depth than the fast read.",
      fullRead: "Fixture full read paragraph going into the fixture mechanism, its limits, and a second worked case.",
    },
    examples: [
      {
        exampleId: "ex01",
        title: "Fixture Example One",
        tags: ["fixture", "example"],
        planSpec: {
          domain: "fixture",
          audience: "fixture reader",
          stakes: "fixture stakes",
          format: "fixture format",
          requiredBeat: "fixture beat",
        },
        scenario: "Fixture scenario text describing a concrete situation for testing with enough detail to look real.",
        whatToDo: "Fixture what-to-do guidance sentence for the reader to act on in this scenario right now.",
        whyItMatters: "Fixture why-it-matters sentence explaining the stakes of the fixture scenario for the reader.",
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        {
          questionId: "q01",
          prompt: "Which fixture answer is correct for this test question about the fixture concept?",
          choices: ["Fixture wrong answer one", "Fixture correct answer", "Fixture wrong answer two"],
          correctIndex: 1,
          explanation: "Fixture explanation describing why the correct choice is correct for this test question.",
          bloomsLevel: "understand",
          depthLevel: "standard",
          revisit: { component: "Deep read", ref: "Return to the fixture mechanism passage." },
        },
      ],
    },
    reviewCards: [
      {
        cardId: "c01",
        front: "Fixture card front question text?",
        back: "Fixture card back answer text explaining the concept.",
        difficulty: "medium",
      },
    ],
    implementationPlan: {
      title: "Fixture Skill Name",
      coreSkill: "Fixture core skill description spanning a couple of sentences for test realism.",
      ifThenPlans: [
        { context: "A fixture triggering situation arises.", plan: "If the fixture context happens, then take the fixture action." },
      ],
      twentyFourHourChallenge: "Within 24 hours, perform the fixture challenge action once and note the result.",
      weeklyPractice: "For one week, repeat the fixture practice daily and record what changes.",
    },
    memorableLines: [
      { text: "Fixture lines fix nothing but they are enough to test the strip.", location: "breakdown.deepRead", why: "Fixture rationale." },
    ],
  };
  return { ...base, ...overrides };
}

function fixtureInput(overrides: Partial<ChapterDiagnosticPackageInput> = {}): ChapterDiagnosticPackageInput {
  return {
    runHash: "a1b2c3d4",
    blockCode: "nudge-ch03",
    slot: "A",
    chapter: fixtureChapter(),
    book: { title: "Nudge", categories: ["Behavioral Economics"], tags: ["choice-architecture"] },
    ...overrides,
  };
}

// ── buildChapterDiagnosticBookId ─────────────────────────────────────────────

test("buildChapterDiagnosticBookId mints the chapterdiag-- blind prefix from its three components", () => {
  const id = buildChapterDiagnosticBookId("a1b2c3d4", "nudge-ch03", "A");
  assert.equal(id, `${CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX}a1b2c3d4-nudge-ch03-A`);
  assert.ok(id.startsWith("chapterdiag--"));
});

test("buildChapterDiagnosticBookId rejects a component carrying a forbidden model token", () => {
  assert.throws(() => buildChapterDiagnosticBookId("a1b2c3d4", "sol-nudge-ch03", "A"), ChapterDiagnosticPackageError);
});

test("buildChapterDiagnosticBookId rejects an empty or non-slug component", () => {
  assert.throws(() => buildChapterDiagnosticBookId("", "nudge-ch03", "A"), ChapterDiagnosticPackageError);
  assert.throws(() => buildChapterDiagnosticBookId("a1b2c3d4", "nudge ch03", "A"), ChapterDiagnosticPackageError);
});

test("buildChapterDiagnosticBookId accepts this codebase's own candidate-slot convention (w1/w2/w3)", () => {
  // Regression: an early cut of the forbidden-token scan flagged "w1" as an
  // internal-path leak, which would have made every bake-off slot unusable —
  // candidates.ts uses exactly this convention (`work/<slot>/chapters`).
  for (const slot of ["w1", "w2", "w3", "A", "F"]) {
    const id = buildChapterDiagnosticBookId("a1b2c3d4", "nudge-ch03", slot);
    assert.equal(id, `${CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX}a1b2c3d4-nudge-ch03-${slot}`);
  }
});

test("buildChapterDiagnosticPackage round-trips end to end with slot 'w1' (not just the id function)", () => {
  // The compound blind id embeds the slot verbatim (…-nudge-ch03-w1), so this
  // also exercises the full-package forbidden-token scan, not only
  // buildChapterDiagnosticBookId's own component check.
  const built = buildChapterDiagnosticPackage(fixtureInput({ slot: "w1" }));
  assert.equal(built.blindBookId, "chapterdiag--a1b2c3d4-nudge-ch03-w1");
  assert.deepEqual(scanChapterDiagnosticForbiddenTokens(built.package), []);
});

// ── buildChapterDiagnosticPackage — happy path ──────────────────────────────

test("buildChapterDiagnosticPackage builds a genuine v21-shaped 1-chapter package", () => {
  const built = buildChapterDiagnosticPackage(fixtureInput());
  assert.equal(built.blindBookId, "chapterdiag--a1b2c3d4-nudge-ch03-A");
  assert.equal(built.package.schemaVersion, "chapterflow-v21-authored");
  assert.equal(built.package.packageId, built.blindBookId);
  assert.equal(built.package.createdAt, CHAPTER_DIAGNOSTIC_EPOCH);
  assert.equal(built.package.book.bookId, built.blindBookId);
  assert.equal(built.package.book.title, "Nudge");
  assert.equal(built.package.chapters.length, 1);
  const chapter = built.package.chapters[0];
  assert.equal(chapter.number, 1);
  assert.equal(chapter.chapterId, `${built.blindBookId}-ch01`);
  assert.equal(chapter.examples.length, 1);
  assert.equal(chapter.examples[0].exampleId, `${built.blindBookId}-ch01-ex01`);
  assert.equal(chapter.quiz.questions.length, 1);
  assert.equal(chapter.quiz.questions[0].questionId, `${built.blindBookId}-ch01-q01`);
  assert.equal(chapter.reviewCards[0].cardId, `${built.blindBookId}-ch01-card01`);
  assert.match(built.sha256, /^[0-9a-f]{64}$/);
});

test("buildChapterDiagnosticPackage never leaks the real chapterId/bookId string into the blind package", () => {
  const built = buildChapterDiagnosticPackage(fixtureInput());
  const bytes = built.bytes;
  assert.ok(!bytes.includes("nudge-ch03\""), "the real chapterId must not survive verbatim as a quoted JSON string value");
});

test("buildChapterDiagnosticPackage strips authoring-internal fields (planSpec, implementationPlan.title, memorableLines.location/why)", () => {
  const built = buildChapterDiagnosticPackage(fixtureInput());
  const chapter = built.package.chapters[0];
  assert.ok(!("planSpec" in chapter.examples[0]));
  assert.ok(!("title" in chapter.implementationPlan));
  assert.deepEqual(chapter.memorableLines, [{ text: "Fixture lines fix nothing but they are enough to test the strip." }]);
});

test("buildChapterDiagnosticPackage is deterministic — identical inputs produce byte-identical output and hash", () => {
  const first = buildChapterDiagnosticPackage(fixtureInput());
  const second = buildChapterDiagnosticPackage(fixtureInput());
  assert.equal(first.bytes, second.bytes);
  assert.equal(first.sha256, second.sha256);
});

test("buildChapterDiagnosticPackage: sha256 matches an independent hash of the returned bytes", async () => {
  const { createHash } = await import("node:crypto");
  const built = buildChapterDiagnosticPackage(fixtureInput());
  const independent = createHash("sha256").update(built.bytes, "utf8").digest("hex");
  assert.equal(built.sha256, independent);
  assert.equal(built.bytes, serializeChapterDiagnosticPackage(built.package));
});

test("buildChapterDiagnosticPackage forces chapter.number to 1 regardless of the source chapter's real number", () => {
  const built = buildChapterDiagnosticPackage(fixtureInput({ chapter: fixtureChapter({ number: 7 }) }));
  assert.equal(built.package.chapters[0].number, 1);
});

// ── Fail-closed content requirements ─────────────────────────────────────────

test("buildChapterDiagnosticPackage fails closed on a chapter with no quiz questions", () => {
  const chapter = fixtureChapter({ quiz: { passingScorePercent: 70, questions: [] } });
  assert.throws(() => buildChapterDiagnosticPackage(fixtureInput({ chapter })), ChapterDiagnosticPackageError);
});

test("buildChapterDiagnosticPackage fails closed on an out-of-range quiz correctIndex", () => {
  const chapter = fixtureChapter();
  chapter.quiz.questions[0].correctIndex = 9;
  assert.throws(() => buildChapterDiagnosticPackage(fixtureInput({ chapter })), ChapterDiagnosticPackageError);
});

test("buildChapterDiagnosticPackage fails closed on a missing book.title", () => {
  assert.throws(() => buildChapterDiagnosticPackage(fixtureInput({ book: { title: "" } })), ChapterDiagnosticPackageError);
});

// ── Forbidden-token scan — fail-closed on a hit ─────────────────────────────

test("scanChapterDiagnosticForbiddenTokens finds nothing on a clean fixture package", () => {
  const built = buildChapterDiagnosticPackage(fixtureInput());
  assert.deepEqual(scanChapterDiagnosticForbiddenTokens(built.package), []);
});

test("buildChapterDiagnosticPackage fails closed when a model-identity token leaks into book metadata", () => {
  assert.throws(
    () => buildChapterDiagnosticPackage(fixtureInput({ book: { title: "Nudge", tags: ["sol"] } })),
    (err: unknown) => err instanceof ChapterDiagnosticPackageError && /forbidden-token/.test(err.message) && /sol/.test(err.message),
  );
});

test("buildChapterDiagnosticPackage fails closed on a gpt-5.6 mention in book metadata", () => {
  assert.throws(
    () => buildChapterDiagnosticPackage(fixtureInput({ book: { title: "Nudge", categories: ["gpt-5.6 notes"] } })),
    ChapterDiagnosticPackageError,
  );
});

test("buildChapterDiagnosticPackage does NOT false-positive on ordinary English effort-like words in reader-facing labels", () => {
  // Regression guard: a book literally titled "High Output Management" (a real
  // corpus title) must not trip the "high" effort token — effort/session/path
  // categories are scoped OFF free-text fields (title/categories/tags/prose).
  const built = buildChapterDiagnosticPackage(fixtureInput({
    book: { title: "High Output Management", categories: ["Low-Stakes Habits"], tags: ["medium-effort-plans"] },
  }));
  assert.equal(built.package.book.title, "High Output Management");
});

test("buildChapterDiagnosticPackage does NOT false-positive on reviewCards.difficulty = 'medium'", () => {
  // difficulty is a closed enum ("easy"|"medium"|"hard") that legitimately
  // collides with the "medium" effort token; it must never be scanned as one.
  const built = buildChapterDiagnosticPackage(fixtureInput());
  assert.equal(built.package.chapters[0].reviewCards[0].difficulty, "medium");
});

test("scanChapterDiagnosticForbiddenTokens fires on a session-id-shaped identifier field", () => {
  const built = buildChapterDiagnosticPackage(fixtureInput());
  const poisoned = { ...built.package, packageId: "session-abc123def" };
  const hits = scanChapterDiagnosticForbiddenTokens(poisoned);
  assert.ok(hits.some((hit) => hit.category === "session-or-run-id"));
});
