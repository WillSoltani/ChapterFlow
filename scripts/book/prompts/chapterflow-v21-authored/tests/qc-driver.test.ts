import assert from "node:assert/strict";

import { test } from "./harness.js";
import { driveQcRoundCore, type QcDriveSteps } from "../src/qc/auto/driver.js";
import type { FinalizeQcRoundResult } from "../src/qc/orchestrator/finalize.js";

type Verdict = "PUBLISHABLE" | "REVISE" | "CORRUPTION" | "NEEDS_MORE_QC";

function finalized(verdicts: Verdict[]): FinalizeQcRoundResult {
  const chapters = verdicts.map((v, i) => ({ chapterNumber: i + 1, finalVerdict: v, checks: {} })) as unknown as FinalizeQcRoundResult["chapters"];
  return {
    ok: verdicts.length > 0 && verdicts.every((v) => v === "PUBLISHABLE"),
    allPublishable: verdicts.length > 0 && verdicts.every((v) => v === "PUBLISHABLE"),
    repairRequired: verdicts.some((v) => v === "REVISE" || v === "CORRUPTION"),
    incomplete: verdicts.some((v) => v === "NEEDS_MORE_QC"),
    evidenceMatrixPath: "", repairBriefPath: "", repairPromptPath: "",
    attestationsWritten: verdicts.filter((v) => v === "PUBLISHABLE").length,
    chapters, errors: [],
  };
}

function makeSteps(over: Partial<QcDriveSteps> = {}): { steps: QcDriveSteps; calls: { waves: string[]; metrics: number } } {
  const calls = { waves: [] as string[], metrics: 0 };
  const steps: QcDriveSteps = {
    spawnReviewers: async (_cards, wave) => { calls.waves.push(wave); return {}; },
    firstWaveCards: () => ["/t/00-sweep.md", "/t/bar/ch01.md"],
    confirmCards: () => ["/t/confirm/ch01.md"],
    countSubmissions: () => 3,
    submissionPresent: () => true,
    collect: () => ({ ok: true, errors: [] }),
    generateConfirmCandidates: () => ({ ok: true, errors: [] }),
    finalize: () => finalized(["PUBLISHABLE"]),
    ledgerOpenCount: () => 0,
    recordMetrics: () => { calls.metrics++; },
    verifyFullBook: async () => true,
    log: () => {},
    ...over,
  };
  return { steps, calls };
}

test("driver: clean full-book round → PASS (verifies qc-status, records metrics, both waves)", async () => {
  const { steps, calls } = makeSteps();
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: true });
  assert.equal(r.outcome, "PASS");
  assert.equal(calls.metrics, 1, "metrics recorded exactly once");
  assert.deepEqual(calls.waves, ["first", "confirm"], "first + confirm waves run, no retry");
});

test("driver: all-publishable but qc-status disagrees → QC_STATUS_FAIL", async () => {
  const { steps } = makeSteps({ verifyFullBook: async () => false });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: true });
  assert.equal(r.outcome, "QC_STATUS_FAIL");
});

test("driver: subset clean round → PASS_SUBSET (never runs full-book qc-status)", async () => {
  let verified = false;
  const { steps } = makeSteps({ verifyFullBook: async () => { verified = true; return true; } });
  const r = await driveQcRoundCore(steps, { isSubset: true, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "PASS_SUBSET");
  assert.equal(verified, false, "a subset is not a book-level pass — qc-status must not run");
});

test("driver: a REVISE chapter → REPAIR with counts", async () => {
  const { steps } = makeSteps({ finalize: () => finalized(["PUBLISHABLE", "REVISE"]) });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "REPAIR");
  assert.equal(r.counts.revise, 1);
  assert.equal(r.counts.publishable, 1);
});

test("driver: zero submissions → INCOMPLETE(no-submissions); collect/finalize never run", async () => {
  let collected = false;
  const { steps } = makeSteps({ countSubmissions: () => 0, collect: () => { collected = true; return { ok: true, errors: [] }; } });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "INCOMPLETE");
  assert.equal(r.reason, "no-submissions");
  assert.equal(collected, false);
});

test("driver: collect failure → INCOMPLETE(collect-failed) surfacing errors", async () => {
  const { steps } = makeSteps({ collect: () => ({ ok: false, errors: ["bad bar submission"] }) });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "INCOMPLETE");
  assert.equal(r.reason, "collect-failed");
  assert.deepEqual(r.collectErrors, ["bad bar submission"]);
});

test("driver: generateConfirmCandidates failure → INCOMPLETE(confirm-failed); finalize never runs", async () => {
  let finalizes = 0;
  const { steps } = makeSteps({
    generateConfirmCandidates: () => ({ ok: false, errors: ["confirm candidate generation failed"] }),
    finalize: () => { finalizes++; return finalized(["PUBLISHABLE"]); },
  });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "INCOMPLETE");
  assert.equal(r.reason, "confirm-failed");
  assert.equal(finalizes, 0, "confirm-candidates failing short-circuits before finalize");
});

test("driver: narrow retry does NOT fire when ALL cards are missing (can't single out a flaky one)", async () => {
  let finalizeCalls = 0;
  let retried = 0;
  const { steps } = makeSteps({
    finalize: () => { finalizeCalls++; return finalized(["NEEDS_MORE_QC"]); }, // stays incomplete
    submissionPresent: () => false, // EVERY card missing → not a single flaky reviewer
    spawnReviewers: async (_c, wave) => { if (wave === "retry") retried++; return {}; },
  });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: true });
  assert.equal(r.outcome, "INCOMPLETE");
  assert.equal(r.reason, "needs-more-qc");
  assert.equal(retried, 0, "all-missing is a systemic failure, not a narrow retry");
  assert.equal(finalizeCalls, 1, "no re-finalize when the retry is skipped");
});

test("driver: a reviewer that mutates a chapter → INTEGRITY (round void, finalize never runs)", async () => {
  let finalizes = 0;
  const { steps } = makeSteps({
    spawnReviewers: async (_c, wave) => (wave === "first" ? { integrityViolation: "ch02 changed during the round" } : {}),
    finalize: () => { finalizes++; return finalized(["PUBLISHABLE"]); },
  });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: true });
  assert.equal(r.outcome, "INTEGRITY");
  assert.match(r.reason ?? "", /ch02 changed/);
  assert.equal(finalizes, 0);
});

test("driver: NARROW retry re-spawns only the missing cards, then PASSes", async () => {
  let finalizeCalls = 0;
  const retried: string[][] = [];
  const { steps } = makeSteps({
    finalize: () => { finalizeCalls++; return finalizeCalls === 1 ? finalized(["NEEDS_MORE_QC"]) : finalized(["PUBLISHABLE"]); },
    submissionPresent: (card) => !card.includes("ch01"), // the ch01 bar + confirm cards are "missing"
    spawnReviewers: async (cards, wave) => { if (wave === "retry") retried.push(cards); return {}; },
  });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: true });
  assert.equal(r.outcome, "PASS");
  assert.equal(finalizeCalls, 2, "re-finalized after the narrow retry");
  assert.equal(retried.length, 1, "exactly one retry wave");
  assert.ok(retried[0].length > 0 && retried[0].every((c) => c.includes("ch01")), "only the missing ch01 cards were re-spawned");
});
