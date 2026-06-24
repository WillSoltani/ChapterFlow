import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { adaptV21ToV13 } from "./v21-adapter";

// Run from the repo root (npm test), so process.cwd() is the project root.
const BOOK_PACKAGES_DIR = join(process.cwd(), "book-packages");

const baseRawPkg = JSON.parse(
  readFileSync(join(BOOK_PACKAGES_DIR, "atomic-habits.v21.json"), "utf8"),
) as { chapters: Record<string, unknown>[] };

// A real, valid v21 package whose FIRST chapter's quiz has one question with NO
// authored answer key and one with it — everything else left intact.
function patchedPackageWithQuiz() {
  const quiz = {
    passingScorePercent: 70,
    questions: [
      { questionId: "missing", prompt: "p", choices: ["A", "B", "C"], explanation: "e" },
      {
        questionId: "present",
        prompt: "p",
        choices: ["A", "B", "C"],
        correctIndex: 2,
        explanation: "e",
      },
    ],
  };
  const [first, ...rest] = baseRawPkg.chapters;
  return { ...baseRawPkg, chapters: [{ ...first, quiz }, ...rest] };
}

/**
 * Regression guard (server adapter). A v21 quiz question with NO authored
 * correctIndex must adapt to `correctIndex === undefined`, NOT a fabricated 0.
 * A fabricated 0 silently grades every reader against choice A and defeats the
 * `quiz_question_missing_answer_key` guards in quiz-session/content-service/
 * quiz-service, which fire only when the key is not a number.
 */
test("adaptV21ToV13 leaves a missing quiz correctIndex undefined (not 0)", () => {
  const pkg = adaptV21ToV13(patchedPackageWithQuiz());
  const questions = pkg.chapters[0].quiz.questions;
  const missing = questions.find((q) => q.questionId === "missing");
  const present = questions.find((q) => q.questionId === "present");
  assert.ok(missing && present, "expected both fixture questions to survive adaptation");

  assert.notEqual(missing!.correctIndex, 0, "a missing key must NOT be fabricated as 0");
  assert.equal(
    missing!.correctIndex,
    undefined,
    "a missing key must stay undefined so the runtime guard fires",
  );
  assert.equal(present!.correctIndex, 2, "an authored correctIndex must be preserved");

  // The S3 write is JSON.stringify; an undefined key is dropped entirely, so the
  // read-time guard (typeof correctAnswerIndex/correctIndex !== "number") throws.
  const roundTripped = JSON.parse(JSON.stringify(missing));
  assert.equal(
    "correctIndex" in roundTripped,
    false,
    "an undefined correctIndex must not survive S3 JSON serialization",
  );
});

/**
 * Content-integrity guard. Every authored v21 quiz question (and retryQuestions)
 * must declare an in-bounds correct-answer index. A question with no key is a
 * silent-grading defect: the adapter leaves it undefined and the runtime grader
 * 500s. Catch it loudly here, at the corpus, before anything publishes. This is
 * the regression guard for the 78-question answer-key corruption across
 * pitch-anything / extreme-ownership / the-laws-of-human-nature.
 */
test("every v21 book-package quiz question declares an in-bounds correct-answer index", () => {
  const files = readdirSync(BOOK_PACKAGES_DIR).filter((f) => f.endsWith(".v21.json"));
  assert.ok(files.length > 0, "expected at least one v21 book package to scan");

  const offenders: string[] = [];
  for (const file of files) {
    const pkg = JSON.parse(readFileSync(join(BOOK_PACKAGES_DIR, file), "utf8")) as {
      chapters?: {
        number?: number;
        quiz?: { questions?: unknown[]; retryQuestions?: unknown[] };
      }[];
    };
    for (const ch of pkg.chapters ?? []) {
      for (const listName of ["questions", "retryQuestions"] as const) {
        const list = ch.quiz?.[listName] ?? [];
        for (const raw of list) {
          const q = raw as {
            questionId?: string;
            choices?: unknown[];
            correctIndex?: unknown;
            correctAnswerIndex?: unknown;
          };
          const idx =
            typeof q.correctAnswerIndex === "number"
              ? q.correctAnswerIndex
              : typeof q.correctIndex === "number"
                ? q.correctIndex
                : undefined;
          const choiceCount = Array.isArray(q.choices) ? q.choices.length : 0;
          if (idx === undefined || idx < 0 || idx >= choiceCount) {
            offenders.push(
              `${file} ch${ch.number} ${listName} "${q.questionId ?? "?"}" (idx=${String(idx)}, choices=${choiceCount})`,
            );
          }
        }
      }
    }
  }

  assert.equal(
    offenders.length,
    0,
    `quiz questions with a missing/out-of-bounds correct-answer index:\n${offenders.join("\n")}`,
  );
});
