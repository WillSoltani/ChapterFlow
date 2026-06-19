import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLocalQuizSession, type LocalQuizData } from "./useQuizSession";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeLocalQuiz(questionCount: number): LocalQuizData {
  return {
    chapterId: "ch-1",
    passingScorePercent: 80,
    questions: Array.from({ length: questionCount }, (_, i) => ({
      id: `q${i}`,
      prompt: `Prompt ${i}?`,
      options: ["A) first", "B) second", "C) third"],
      correctIndex: 1,
      explanation: `Because ${i}.`,
    })),
  };
}

// ─── RF-1: an empty local quiz must NOT produce a usable offline session ──────
//
// On the prod (API) content path the chapter adapter ships an EMPTY quiz
// (`{ questions: [] }`) because the real quiz is fetched from a separate
// endpoint. If a quiz fetch fails after the chapter prose already loaded, the
// load() catch falls back to this builder. A truthy 0-question session there is
// rendered by QuizPanel as the terminal "No quiz questions available for this
// chapter." and strands the reader. Returning null instead lets load()/retry()
// surface a RETRYABLE error. These assertions lock that contract.

test("buildLocalQuizSession returns null when the local quiz is undefined", () => {
  assert.equal(buildLocalQuizSession(undefined, 3), null);
});

test("buildLocalQuizSession returns null for a present-but-empty quiz (RF-1)", () => {
  const empty = makeLocalQuiz(0);
  assert.equal(empty.questions.length, 0);
  assert.equal(buildLocalQuizSession(empty, 3), null);
});

test("buildLocalQuizSession builds a ready session for a non-empty quiz", () => {
  const session = buildLocalQuizSession(makeLocalQuiz(2), 5);
  assert.ok(session, "expected a session for a non-empty quiz");
  assert.equal(session.chapterId, "ch-1");
  assert.equal(session.chapterNumber, 5);
  assert.equal(session.status, "ready");
  assert.equal(session.passingScorePercent, 80);
  assert.equal(session.result, null);
  assert.equal(session.questions.length, 2);
});

test("buildLocalQuizSession keys choices in the local `-choice-` scheme and strips A)/B) labels", () => {
  const session = buildLocalQuizSession(makeLocalQuiz(1), 1);
  assert.ok(session);
  const q = session.questions[0];
  assert.equal(q.questionId, "q0");
  // correctIndex is 1, so the correct choiceId is `<id>-choice-1` and the label
  // prefix ("B) ") is stripped from the visible text.
  assert.equal(q.correctChoiceId, "q0-choice-1");
  assert.equal(q.correctIndex, 1);
  assert.deepEqual(
    q.choices.map((c) => c.choiceId),
    ["q0-choice-0", "q0-choice-1", "q0-choice-2"]
  );
  assert.deepEqual(
    q.choices.map((c) => c.text),
    ["first", "second", "third"]
  );
});
