import { test } from "node:test";
import assert from "node:assert/strict";
import { needsReconcile, reconcileProvisionalPass } from "./quizReconcile";
import type { QuizAttemptSummaryView, QuizSessionView } from "../hooks/useQuizSession";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeResult(passed: boolean): QuizAttemptSummaryView {
  return {
    attemptNumber: 1,
    scorePercent: passed ? 100 : 20,
    correctAnswers: passed ? 5 : 1,
    totalQuestions: 5,
    passed,
    submittedAt: "2026-06-19T00:00:00.000Z",
  };
}

function makeSession(overrides: Partial<QuizSessionView> = {}): QuizSessionView {
  return {
    chapterId: "book:1",
    chapterNumber: 1,
    title: "Chapter 1",
    passingScorePercent: 70,
    status: "passed",
    attemptNumber: 1,
    nextAttemptNumber: null,
    attemptsCount: 1,
    failureStreak: 0,
    cooldownSeconds: 0,
    nextAttemptAvailableAt: null,
    highestScorePercent: 100,
    unlockedNextChapter: true,
    questions: [],
    result: makeResult(true),
    history: [],
    ...overrides,
  };
}

/** A deps factory that records call order so submit→unlock ordering is testable. */
function makeDeps(opts: {
  online?: boolean;
  submit: () => Promise<{ session: QuizSessionView | null } | null>;
  claim?: () => Promise<unknown>;
}) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      isOnline: () => opts.online ?? true,
      submit: async () => {
        calls.push("submit");
        return opts.submit();
      },
      claimLoopCompleteIP: async () => {
        calls.push("claim");
        return (opts.claim ?? (async () => undefined))();
      },
    },
  };
}

// ─── needsReconcile ──────────────────────────────────────────────────────────

test("needsReconcile: provisional PASS needs reconciling", () => {
  assert.equal(needsReconcile(makeSession({ provisional: true })), true);
});

test("needsReconcile: provisional FAIL is left to a normal online retry", () => {
  assert.equal(
    needsReconcile(makeSession({ provisional: true, result: makeResult(false) })),
    false,
  );
});

test("needsReconcile: a non-provisional (server-confirmed) pass never reconciles", () => {
  assert.equal(needsReconcile(makeSession({ provisional: false })), false);
  assert.equal(needsReconcile(makeSession({})), false); // provisional undefined
});

test("needsReconcile: null/undefined session never reconciles", () => {
  assert.equal(needsReconcile(null), false);
  assert.equal(needsReconcile(undefined), false);
});

// ─── reconcileProvisionalPass ────────────────────────────────────────────────

test("reconcile: offline → no submit, returns 'offline'", async () => {
  const { calls, deps } = makeDeps({
    online: false,
    submit: async () => ({ session: makeSession({ provisional: false }) }),
  });
  const outcome = await reconcileProvisionalPass(deps);
  assert.equal(outcome, "offline");
  assert.deepEqual(calls, []); // never even attempted the network
});

test("reconcile: server confirms the pass → submit THEN unlock, returns 'confirmed'", async () => {
  const { calls, deps } = makeDeps({
    submit: async () => ({ session: makeSession({ provisional: false }) }),
  });
  const outcome = await reconcileProvisionalPass(deps);
  assert.equal(outcome, "confirmed");
  assert.deepEqual(calls, ["submit", "claim"]); // ordered: unlock requires a recorded pass
});

test("reconcile: submit still falls back to provisional (offline) → 'offline', no IP claim", async () => {
  const { calls, deps } = makeDeps({
    submit: async () => ({ session: makeSession({ provisional: true }) }),
  });
  const outcome = await reconcileProvisionalPass(deps);
  assert.equal(outcome, "offline");
  assert.deepEqual(calls, ["submit"]); // claim must NOT fire without a server-recorded pass
});

test("reconcile: submit throws → 'failed', no IP claim", async () => {
  const { calls, deps } = makeDeps({
    submit: async () => {
      throw new Error("network");
    },
  });
  const outcome = await reconcileProvisionalPass(deps);
  assert.equal(outcome, "failed");
  assert.deepEqual(calls, ["submit"]);
});

test("reconcile: submit returns null session → 'failed', no IP claim", async () => {
  const { calls, deps } = makeDeps({ submit: async () => ({ session: null }) });
  const outcome = await reconcileProvisionalPass(deps);
  assert.equal(outcome, "failed");
  assert.deepEqual(calls, ["submit"]);
});

test("reconcile: server grades resubmission as NOT passed → 'rejected', no IP claim", async () => {
  const { calls, deps } = makeDeps({
    submit: async () => ({ session: makeSession({ provisional: false, result: makeResult(false) }) }),
  });
  const outcome = await reconcileProvisionalPass(deps);
  assert.equal(outcome, "rejected");
  assert.deepEqual(calls, ["submit"]); // do not award IP for a pass the server rejected
});

test("reconcile: a failed loop-complete IP claim is non-fatal → still 'confirmed'", async () => {
  const { calls, deps } = makeDeps({
    submit: async () => ({ session: makeSession({ provisional: false }) }),
    claim: async () => {
      throw new Error("unlock 500");
    },
  });
  const outcome = await reconcileProvisionalPass(deps);
  assert.equal(outcome, "confirmed"); // core reconcile (server advance + pipeline) already succeeded
  assert.deepEqual(calls, ["submit", "claim"]);
});
