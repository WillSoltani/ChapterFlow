import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { useState } from "react";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { QuizPanel } from "./QuizPanel";
import type { QuizSessionView } from "../hooks/useQuizSession";
import type { QuizAttemptProgress } from "../lib/reader-quiz-flow-core";

// jsdom has no layout: the panel scrolls cards into view and escapes ids for a
// selector, so give it inert stand-ins.
const realScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
const realCss = (globalThis as { CSS?: unknown }).CSS;

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = () => {};
  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    writable: true,
    value: { escape: (value: string) => value },
  });
});

afterEach(() => {
  cleanup();
  window.HTMLElement.prototype.scrollIntoView = realScrollIntoView;
  Object.defineProperty(globalThis, "CSS", { configurable: true, writable: true, value: realCss });
});

const CORRECT: Record<string, string> = { q1: "q1-a", q2: "q2-a", q3: "q3-a" };

function makeSession(overrides: Partial<QuizSessionView> = {}, questionCount = 2): QuizSessionView {
  const questions = Array.from({ length: questionCount }, (_, i) => {
    const id = `q${i + 1}`;
    return {
      questionId: id,
      prompt: `Prompt ${i + 1}`,
      explanation: `Because of reason ${i + 1}.`,
      choices: ["a", "b", "c"].map((letter) => ({ choiceId: `${id}-${letter}`, text: `${id} choice ${letter}` })),
    };
  });
  return {
    chapterId: "ch-1",
    chapterNumber: 1,
    title: "Chapter one",
    passingScorePercent: 80,
    status: "ready",
    attemptNumber: 1,
    nextAttemptNumber: null,
    attemptsCount: 0,
    failureStreak: 0,
    cooldownSeconds: 0,
    nextAttemptAvailableAt: null,
    highestScorePercent: 0,
    unlockedNextChapter: false,
    questions,
    result: null,
    history: [],
    ...overrides,
  };
}

async function checkAnswer(questionId: string, choiceId: string) {
  return { isCorrect: CORRECT[questionId] === choiceId };
}

type HarnessProps = {
  session: QuizSessionView;
  initialAnswers?: Record<string, string>;
  submitting?: boolean;
  learningMode?: "guided" | "standard" | "challenge";
  questionFlow?: "all-at-once" | "one-by-one";
  onSubmit?: () => void;
  onAnswered?: (answers: Record<string, string>) => void;
  loadProgress?: (attemptNumber: number) => QuizAttemptProgress;
  onProgressChange?: (attemptNumber: number, progress: QuizAttemptProgress) => void;
};

/** Holds the answers the way useQuizSession does, so grading feeds back in. */
function Harness({
  session,
  initialAnswers = {},
  submitting = false,
  learningMode = "standard",
  questionFlow = "all-at-once",
  onSubmit = () => {},
  onAnswered,
  loadProgress,
  onProgressChange,
}: HarnessProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  return (
    <QuizPanel
      session={session}
      answers={answers}
      explanationOpen={{}}
      loading={false}
      submitting={submitting}
      error={null}
      cooldownSeconds={0}
      onAnswer={(questionId, choiceId) => {
        setAnswers((prev) => {
          const next = { ...prev, [questionId]: choiceId };
          onAnswered?.(next);
          return next;
        });
      }}
      onCheckAnswer={checkAnswer}
      onSubmit={onSubmit}
      onReviewSummary={() => {}}
      onRetry={() => {}}
      onContinueToPractice={() => {}}
      onToggleExplanation={() => {}}
      learningMode={learningMode}
      questionFlow={questionFlow}
      {...(loadProgress ? { loadProgress } : {})}
      {...(onProgressChange ? { onProgressChange } : {})}
    />
  );
}

function card(container: HTMLElement, questionId: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-quiz-question="${questionId}"]`);
  assert.ok(el, `card ${questionId} should be rendered`);
  return el;
}

function choice(scope: HTMLElement, choiceId: string, questionId: string): HTMLElement {
  const letter = choiceId.slice(choiceId.lastIndexOf("-") + 1);
  return within(scope).getByRole("radio", { name: new RegExp(`${questionId} choice ${letter}$`) });
}

test("the last card points back to an unanswered question instead of submitting", async () => {
  let submits = 0;
  const view = render(<Harness session={makeSession()} onSubmit={() => { submits += 1; }} />);

  const last = card(view.container, "q2");
  fireEvent.click(choice(last, "q2-a", "q2"));
  await waitFor(() => assert.ok(within(last).getByText("Correct!")));

  assert.equal(within(last).queryByRole("button", { name: /See Your Results/ }), null);
  const jump = within(last).getByRole("button", { name: /Answer question 1/ });
  assert.ok(within(last).getByText("1 question left"));
  fireEvent.click(jump);
  assert.equal(submits, 0, "an incomplete quiz must not be submitted");
});

test("one-by-one: the jump goes back to the unanswered card and submit waits for it", async () => {
  let submits = 0;
  const view = render(
    <Harness session={makeSession()} questionFlow="one-by-one" onSubmit={() => { submits += 1; }} />
  );

  fireEvent.click(view.getByRole("button", { name: /Next/ }));
  const last = card(view.container, "q2");
  fireEvent.click(choice(last, "q2-a", "q2"));
  await waitFor(() => assert.ok(within(last).getByText("Correct!")));

  fireEvent.click(within(last).getByRole("button", { name: /Answer question 1/ }));
  const first = card(view.container, "q1");
  assert.equal(view.container.querySelector('[data-quiz-question="q2"]'), null);
  fireEvent.click(choice(first, "q1-a", "q1"));
  await waitFor(() => assert.ok(within(first).getByText("Correct!")));
  assert.equal(submits, 0);
});

test("once every question is answered the results button submits exactly that once", async () => {
  let submits = 0;
  const view = render(<Harness session={makeSession()} onSubmit={() => { submits += 1; }} />);

  fireEvent.click(choice(card(view.container, "q1"), "q1-a", "q1"));
  await waitFor(() => assert.ok(within(card(view.container, "q1")).getByText("Correct!")));
  const last = card(view.container, "q2");
  fireEvent.click(choice(last, "q2-a", "q2"));
  await waitFor(() => assert.ok(within(last).getByRole("button", { name: /See Your Results/ })));
  assert.ok(within(last).getByText("All 2 questions answered"));

  fireEvent.click(within(last).getByRole("button", { name: /See Your Results/ }));
  assert.equal(submits, 1);
});

test("while a submit is in flight the results button is disabled and busy", () => {
  let submits = 0;
  const resolvedProgress: QuizAttemptProgress = {
    feedback: { q1: "correct", q2: "correct" },
    retriesUsed: {},
    disabledChoices: {},
    correctByQuestion: { q1: "q1-a", q2: "q2-a" },
    retakeQuestionIds: [],
  };
  const view = render(
    <Harness
      session={makeSession()}
      initialAnswers={{ q1: "q1-a", q2: "q2-a" }}
      submitting
      onSubmit={() => { submits += 1; }}
      loadProgress={() => resolvedProgress}
    />
  );

  const button = within(card(view.container, "q2")).getByRole("button", { name: /Checking your answers/ });
  assert.equal((button as HTMLButtonElement).disabled, true);
  assert.equal(button.getAttribute("aria-busy"), "true");
  fireEvent.click(button);
  assert.equal(submits, 0);
});

test("grading and retries survive an unmount and remount of the same attempt", async () => {
  const store = new Map<number, QuizAttemptProgress>();
  const saves: QuizAttemptProgress[] = [];
  let loads = 0;
  let answers: Record<string, string> = {};
  const loadProgress = (attempt: number) => {
    loads += 1;
    return store.get(attempt) ?? {
      feedback: {}, retriesUsed: {}, disabledChoices: {}, correctByQuestion: {}, retakeQuestionIds: [],
    };
  };
  const onProgressChange = (attempt: number, progress: QuizAttemptProgress) => {
    saves.push(progress);
    store.set(attempt, progress);
  };
  const session = makeSession({}, 3);

  const first = render(
    <Harness
      session={session}
      learningMode="guided"
      onAnswered={(next) => { answers = next; }}
      loadProgress={loadProgress}
      onProgressChange={onProgressChange}
    />
  );
  fireEvent.click(choice(card(first.container, "q1"), "q1-a", "q1"));
  await waitFor(() => assert.ok(within(card(first.container, "q1")).getByText("Correct!")));
  fireEvent.click(choice(card(first.container, "q2"), "q2-b", "q2"));
  await waitFor(() => assert.ok(within(card(first.container, "q2")).getByText(/1 retry left/)));
  assert.deepEqual(store.get(1)?.feedback, { q1: "correct", q2: "incorrect-retry" });
  first.unmount();

  // The tab comes back: a new panel for the same attempt.
  const savesBeforeRemount = saves.length;
  const second = render(
    <Harness
      session={{ ...session }}
      initialAnswers={answers}
      learningMode="guided"
      loadProgress={loadProgress}
      onProgressChange={onProgressChange}
    />
  );

  const q1 = card(second.container, "q1");
  assert.ok(within(q1).getByText("Correct!"), "the checkmark carries over");
  assert.equal(choice(q1, "q1-a", "q1").getAttribute("aria-checked"), "true");
  const q2 = card(second.container, "q2");
  assert.ok(within(q2).getByText(/1 retry left/), "the used retry carries over");
  assert.equal((choice(q2, "q2-b", "q2") as HTMLButtonElement).disabled, true, "the tried choice stays ruled out");

  for (const saved of saves.slice(savesBeforeRemount)) {
    assert.ok(Object.keys(saved.feedback).length > 0, "mounting must not save empty grading over the draft");
  }
  assert.deepEqual(store.get(1)?.feedback, { q1: "correct", q2: "incorrect-retry" });

  // A fresh load() of the same attempt hands down a new session object; the
  // panel keeps its grading and does not hydrate again.
  const loadsAfterRemount = loads;
  second.rerender(
    <Harness
      session={{ ...session }}
      initialAnswers={answers}
      learningMode="guided"
      loadProgress={loadProgress}
      onProgressChange={onProgressChange}
    />
  );
  assert.equal(loads, loadsAfterRemount);
  assert.ok(within(card(second.container, "q1")).getByText("Correct!"));
  assert.ok(within(card(second.container, "q2")).getByText(/1 retry left/));
});

test("the review view of a passed quiz offers no retake", () => {
  const graded = makeSession(
    {
      status: "passed",
      result: {
        attemptNumber: 1,
        scorePercent: 50,
        correctAnswers: 1,
        totalQuestions: 2,
        passed: true,
        submittedAt: "2026-11-12T00:00:00.000Z",
      },
    },
    2,
  );
  graded.questions = graded.questions.map((q) => ({
    ...q,
    correctChoiceId: CORRECT[q.questionId],
    selectedChoiceId: q.questionId === "q1" ? "q1-a" : "q2-b",
    isCorrect: q.questionId === "q1",
  }));
  const view = render(<Harness session={graded} />);

  fireEvent.click(view.getByRole("button", { name: "Review your answers" }));
  assert.ok(view.getByRole("button", { name: /Back to Results/ }));
  assert.equal(view.queryByRole("button", { name: /Retake Quiz/ }), null);
});
