import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateBookPackage } from "./validate-book-package";
import { BookApiError } from "./errors";

const rawPackage = JSON.parse(
  readFileSync(
    join(process.cwd(), "book-packages", "atomic-habits.v21.json"),
    "utf8",
  ),
) as unknown;

test("validateBookPackage accepts a real bundled package", () => {
  const pkg = validateBookPackage(rawPackage);
  assert.ok(pkg.chapters.length > 0, "expected chapters to survive validation");
  assert.equal(typeof pkg.book, "object");
});

test("validateBookPackage rejects malformed input with a BookApiError", () => {
  assert.throws(
    () => validateBookPackage({}),
    (err: unknown) => err instanceof BookApiError,
  );
  assert.throws(() => validateBookPackage(null));
  assert.throws(() =>
    validateBookPackage({ schemaVersion: "x", book: {}, chapters: [] }),
  );
});

// --- v21 ingestion-validation regression (cluster v21-validation) ---------
// validateBookPackage early-returned adaptV21ToV13(raw) for any v21 package,
// running NONE of the v13 semantic gates on the adapted output. These cases
// assert the gates now fire on the adapter output (and that a sound package
// still passes).

type V21Question = {
  questionId: string;
  prompt: string;
  choices: string[];
  correctIndex: number | undefined;
};

type V21Chapter = {
  chapterId: string;
  number: number;
  title: string;
  breakdown: { fastRead: string; deepRead: string; fullRead: string };
  examples: unknown[];
  quiz: { passingScorePercent: number; questions: V21Question[] };
};

function v21Question(overrides: Partial<V21Question> = {}): V21Question {
  return {
    questionId: "q-1",
    prompt: "What is the core idea?",
    choices: ["A", "B", "C"],
    correctIndex: 1,
    ...overrides,
  };
}

function v21Chapter(overrides: Partial<V21Chapter> = {}): V21Chapter {
  return {
    chapterId: "ch-1",
    number: 1,
    title: "Chapter One",
    breakdown: {
      fastRead: "Fast read prose.",
      deepRead: "Deep read prose.",
      fullRead: "Full read prose.",
    },
    examples: [],
    quiz: { passingScorePercent: 70, questions: [v21Question()] },
    ...overrides,
  };
}

function v21Package(chapters: V21Chapter[]) {
  return {
    schemaVersion: "chapterflow-v21-authored",
    packageId: "pkg-test",
    createdAt: "2026-01-01T00:00:00.000Z",
    contentOwner: "chapterflow",
    book: {
      bookId: "test-book",
      title: "Test Book",
      author: "Tester",
      categories: ["mindset"],
      tags: ["test"],
    },
    chapters,
  };
}

function isInvalidPackageError(err: unknown): boolean {
  return err instanceof BookApiError && err.status === 422 && err.code === "invalid_package";
}

test("validateBookPackage accepts a sound synthetic v21 package", () => {
  const pkg = validateBookPackage(v21Package([v21Chapter(), v21Chapter({ chapterId: "ch-2", number: 2 })]));
  assert.equal(pkg.chapters.length, 2);
  assert.equal(pkg.schemaVersion, "chapterflow-v21-authored");
});

test("validateBookPackage rejects a v21 quiz question with a missing answer key", () => {
  const ch = v21Chapter({
    quiz: { passingScorePercent: 70, questions: [v21Question({ correctIndex: undefined })] },
  });
  assert.throws(() => validateBookPackage(v21Package([ch])), isInvalidPackageError);
});

test("validateBookPackage rejects a v21 quiz question with an out-of-range correct index", () => {
  const ch = v21Chapter({
    quiz: {
      passingScorePercent: 70,
      questions: [v21Question({ choices: ["A", "B"], correctIndex: 5 })],
    },
  });
  assert.throws(() => validateBookPackage(v21Package([ch])), isInvalidPackageError);
});

test("validateBookPackage rejects a v21 package with duplicate chapter numbers", () => {
  const pkg = v21Package([
    v21Chapter({ chapterId: "ch-a", number: 1 }),
    v21Chapter({ chapterId: "ch-b", number: 1 }),
  ]);
  assert.throws(() => validateBookPackage(pkg), isInvalidPackageError);
});

test("validateBookPackage rejects a v21 package with a non-positive chapter number", () => {
  assert.throws(
    () => validateBookPackage(v21Package([v21Chapter({ number: 0 })])),
    isInvalidPackageError,
  );
});

test("validateBookPackage rejects a v21 package with an out-of-range passing score", () => {
  const ch = v21Chapter({ quiz: { passingScorePercent: 5, questions: [v21Question()] } });
  assert.throws(() => validateBookPackage(v21Package([ch])), isInvalidPackageError);
});

test("validateBookPackage rejects a v21 chapter missing a breakdown tier (incomplete variants)", () => {
  // Drop fullRead → adapter emits only easy+medium → variant-completeness gate fires.
  const ch = v21Chapter();
  // @ts-expect-error intentionally producing an incomplete breakdown for the test
  ch.breakdown = { fastRead: "Fast.", deepRead: "Deep." };
  assert.throws(() => validateBookPackage(v21Package([ch])), isInvalidPackageError);
});

test("validateBookPackage rejects duplicate questionIds within a v21 chapter quiz", () => {
  const ch = v21Chapter({
    quiz: {
      passingScorePercent: 70,
      questions: [v21Question({ questionId: "dup" }), v21Question({ questionId: "dup" })],
    },
  });
  assert.throws(() => validateBookPackage(v21Package([ch])), isInvalidPackageError);
});
