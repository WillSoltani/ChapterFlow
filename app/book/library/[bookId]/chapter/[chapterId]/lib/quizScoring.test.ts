import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCarryForwardAnswers, scoreSessionLocally } from "./quizScoring";
import type { QuizQuestionView, QuizSessionView } from "../hooks/useQuizSession";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FIXED_NOW = () => "2026-06-11T00:00:00.000Z";

/** Local fallback choiceId scheme (buildLocalSession). */
function localChoiceId(questionId: string, index: number): string {
  return `${questionId}-choice-${index}`;
}
/** Server choiceId scheme (quiz-session.ts) — deliberately different. */
function serverChoiceId(questionId: string, index: number): string {
  return `${questionId}::choice::${index}`;
}

function makeQuestion(
  questionId: string,
  correctIndex: number,
  scheme: (q: string, i: number) => string = localChoiceId,
): QuizQuestionView {
  return {
    questionId,
    prompt: `Prompt ${questionId}`,
    choices: [0, 1, 2, 3].map((index) => ({
      choiceId: scheme(questionId, index),
      text: `Choice ${index}`,
    })),
    explanation: "Because.",
    correctChoiceId: scheme(questionId, correctIndex),
    correctIndex,
  };
}

/** A fresh (no-result) session of 3 questions whose correct answers are index 0. */
function makeSession(
  passingScorePercent = 70,
  scheme: (q: string, i: number) => string = localChoiceId,
): QuizSessionView {
  return {
    chapterId: "book:1",
    chapterNumber: 1,
    title: "Chapter 1",
    passingScorePercent,
    status: "ready",
    attemptNumber: 1,
    nextAttemptNumber: null,
    attemptsCount: 0,
    failureStreak: 0,
    cooldownSeconds: 0,
    nextAttemptAvailableAt: null,
    highestScorePercent: 0,
    unlockedNextChapter: false,
    questions: [
      makeQuestion("q1", 0, scheme),
      makeQuestion("q2", 0, scheme),
      makeQuestion("q3", 0, scheme),
    ],
    result: null,
    history: [],
  };
}

const correct = (questionId: string) => localChoiceId(questionId, 0);
const wrong = (questionId: string) => localChoiceId(questionId, 1);

// ─── Tests ───────────────────────────────────────────────────────────────────

test("retake answering the previously-missed questions correctly scores 100% (guards the score-drop regression)", () => {
  const session = makeSession(70);

  // First attempt: q1 right, q2 wrong, q3 right → 2/3 = 67%, fails the 70% gate.
  const firstAttemptAnswers = {
    q1: correct("q1"),
    q2: wrong("q2"),
    q3: correct("q3"),
  };
  const firstGraded = scoreSessionLocally(session, firstAttemptAnswers, {}, FIXED_NOW);
  assert.ok(firstGraded?.result, "first attempt should produce a result");
  assert.equal(firstGraded!.result!.scorePercent, 67);
  assert.equal(firstGraded!.result!.passed, false);

  // Retake with default settings (retryIncorrectOnly): q1 and q3 are hidden, so
  // the user only re-answers q2. Their q1/q3 answers must be carried forward
  // into the displayed (fresh) session.
  const carried = buildCarryForwardAnswers(firstGraded!, makeSession(70));
  assert.deepEqual(
    carried,
    { q1: correct("q1"), q3: correct("q3") },
    "carry-forward should seed exactly the previously-correct answers",
  );

  // User now answers the one missed question (q2) correctly.
  const retakeAnswers = { ...carried, q2: correct("q2") };
  const retakeGraded = scoreSessionLocally(makeSession(70), retakeAnswers, {}, FIXED_NOW);
  assert.ok(retakeGraded?.result, "retake should produce a result");
  assert.equal(retakeGraded!.result!.scorePercent, 100);
  assert.equal(retakeGraded!.result!.correctAnswers, 3);
  assert.equal(retakeGraded!.result!.passed, true);
});

test("without carry-forward, the same retake would regress below the first score (documents the bug)", () => {
  const session = makeSession(70);
  const firstGraded = scoreSessionLocally(
    session,
    { q1: correct("q1"), q2: wrong("q2"), q3: correct("q3") },
    {},
    FIXED_NOW,
  );

  // The pre-fix behavior: only the visible (previously-missed) question is in
  // the answer map; q1/q3 fall through to null and are scored wrong.
  const buggyRetake = scoreSessionLocally(makeSession(70), { q2: correct("q2") }, {}, FIXED_NOW);
  assert.equal(buggyRetake!.result!.scorePercent, 33);
  assert.ok(
    buggyRetake!.result!.scorePercent < firstGraded!.result!.scorePercent,
    "without carry-forward an improving user's score paradoxically drops",
  );
});

test("buildCarryForwardAnswers ignores incorrect and unanswered questions", () => {
  const graded = scoreSessionLocally(
    makeSession(70),
    { q1: correct("q1"), q2: wrong("q2") /* q3 unanswered */ },
    {},
    FIXED_NOW,
  );
  assert.deepEqual(buildCarryForwardAnswers(graded!, makeSession(70)), { q1: correct("q1") });
});

test("carry-forward maps onto the TARGET session's choiceId scheme, not the prior session's (guards the server/local scheme mismatch)", () => {
  // First attempt graded by the SERVER (server choiceId scheme): q1/q3 right, q2 wrong.
  const serverSession = makeSession(70, serverChoiceId);
  const serverGraded = scoreSessionLocally(
    serverSession,
    {
      q1: serverChoiceId("q1", 0),
      q2: serverChoiceId("q2", 1), // wrong
      q3: serverChoiceId("q3", 0),
    },
    {},
    FIXED_NOW,
  );
  assert.equal(serverGraded!.result!.passed, false);

  // The retake is displayed as a LOCAL fallback session (different scheme).
  const localTarget = makeSession(70, localChoiceId);
  const carried = buildCarryForwardAnswers(serverGraded!, localTarget);

  // Carried ids MUST be in the LOCAL (target) scheme — not the server ids they
  // came from — or they would never match the displayed correctChoiceId.
  assert.deepEqual(carried, {
    q1: localChoiceId("q1", 0),
    q3: localChoiceId("q3", 0),
  });

  // Answering the missed q2 correctly on the local target now scores 100%.
  const retake = scoreSessionLocally(
    makeSession(70, localChoiceId),
    { ...carried, q2: localChoiceId("q2", 0) },
    {},
    FIXED_NOW,
  );
  assert.equal(retake!.result!.scorePercent, 100);
  assert.equal(retake!.result!.passed, true);
});

test("scoreSessionLocally returns null when there are no questions", () => {
  const empty = { ...makeSession(70), questions: [] };
  assert.equal(scoreSessionLocally(empty, {}, {}, FIXED_NOW), null);
});

// ─── H3 (SEC-QUIZ-LEAK): scoring a server "ready" session that no longer ships
//     the answer key — offline scoring must lean on captured /check verdicts ──

/** A server "ready" session whose questions carry NO correctChoiceId (post-H3). */
function keylessServerSession(passingScorePercent = 70): QuizSessionView {
  const session = makeSession(passingScorePercent, serverChoiceId);
  return {
    ...session,
    questions: session.questions.map((q) => {
      const stripped: QuizQuestionView = { ...q };
      delete stripped.correctChoiceId;
      delete stripped.correctIndex;
      return stripped;
    }),
  };
}

test("scoreSessionLocally scores a keyless (post-H3) session from captured /check verdicts", () => {
  const session = keylessServerSession(70);
  const answers = {
    q1: serverChoiceId("q1", 0),
    q2: serverChoiceId("q2", 3), // the user's (wrong) committed choice
    q3: serverChoiceId("q3", 0),
  };
  // Verdicts captured while answering — q2 was graded wrong by the server.
  const checked = {
    q1: { selectedChoiceId: serverChoiceId("q1", 0), isCorrect: true },
    q2: { selectedChoiceId: serverChoiceId("q2", 3), isCorrect: false },
    q3: { selectedChoiceId: serverChoiceId("q3", 0), isCorrect: true },
  };
  const graded = scoreSessionLocally(session, answers, checked, FIXED_NOW);
  assert.equal(graded!.result!.correctAnswers, 2);
  assert.equal(graded!.result!.scorePercent, 67);
  assert.equal(graded!.result!.passed, false);
  // Without a shipped key and no captured reveal, the wrong answer can't be
  // enrolled offline — correctChoiceId stays undefined; /submit reconciles it.
  assert.equal(graded!.questions[1]!.correctChoiceId, undefined);
});

test("scoreSessionLocally ignores a STALE captured verdict whose choice no longer matches the committed answer", () => {
  const session = keylessServerSession(70);
  // Captured verdict says q1 choice-0 was correct, but the user has since
  // committed choice-1 — the stale verdict must NOT score q1 correct.
  const checked = {
    q1: { selectedChoiceId: serverChoiceId("q1", 0), isCorrect: true },
  };
  const graded = scoreSessionLocally(
    session,
    { q1: serverChoiceId("q1", 1), q2: serverChoiceId("q2", 1), q3: serverChoiceId("q3", 1) },
    checked,
    FIXED_NOW,
  );
  // No usable signal for any question (stale verdict ignored, no key) → 0%.
  assert.equal(graded!.result!.scorePercent, 0);
});

test("scoreSessionLocally still uses the local-bundle key when present (offline local session, no captured verdicts)", () => {
  // The buildLocalSession fallback keeps its own correctChoiceId — scoring it
  // with an empty checkedResults map must still grade against that key.
  const local = makeSession(70, localChoiceId);
  const graded = scoreSessionLocally(
    local,
    { q1: localChoiceId("q1", 0), q2: localChoiceId("q2", 1), q3: localChoiceId("q3", 0) },
    {},
    FIXED_NOW,
  );
  assert.equal(graded!.result!.correctAnswers, 2); // q1, q3 right; q2 wrong
  assert.equal(graded!.questions[1]!.correctChoiceId, localChoiceId("q2", 0));
});

test("buildCarryForwardAnswers falls back to the prior correct selection when the target ships no key (post-H3 server retake)", () => {
  // Prior attempt graded by the server: q1/q3 correct, q2 wrong.
  const serverGraded = scoreSessionLocally(
    makeSession(70, serverChoiceId),
    { q1: serverChoiceId("q1", 0), q2: serverChoiceId("q2", 1), q3: serverChoiceId("q3", 0) },
    {},
    FIXED_NOW,
  );
  // The retake target is a keyless server "ready" session (same scheme).
  const carried = buildCarryForwardAnswers(serverGraded!, keylessServerSession(70));
  // No target key, but graded + target share the server scheme, so the user's
  // prior correct selections carry forward verbatim.
  assert.deepEqual(carried, {
    q1: serverChoiceId("q1", 0),
    q3: serverChoiceId("q3", 0),
  });
});

test("buildCarryForwardAnswers does NOT carry ACROSS schemes (offline LOCAL graded → keyless SERVER retake target)", () => {
  // Prior attempt graded by an OFFLINE LOCAL session (`-choice-` scheme): q1/q3 right.
  const localGraded = scoreSessionLocally(
    makeSession(70, localChoiceId),
    { q1: localChoiceId("q1", 0), q2: localChoiceId("q2", 1), q3: localChoiceId("q3", 0) },
    {},
    FIXED_NOW,
  );
  // Reconnect retake target is a keyless SERVER (`::choice::`) session.
  const carried = buildCarryForwardAnswers(localGraded!, keylessServerSession(70));
  // Carrying the local-scheme ids onto the server session would seed answers the
  // server rejects as invalid — so NOTHING is carried (the caller keeps the local
  // session and its provisional path instead, rather than dropping the score).
  assert.deepEqual(carried, {});
});
