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

function makeSteps(over: Partial<QcDriveSteps> = {}): { steps: QcDriveSteps; calls: { waves: string[]; metrics: number }; filled: Set<string> } {
  const calls = { waves: [] as string[], metrics: 0 };
  // Models the broker filling a card's submission: the DEFAULT spawnReviewers records the
  // wave AND marks every spawned card present, so the dynamic-wave loop converges (a card
  // is "pending" until a wave fills it). Tests that need a flaky/no-op reviewer override
  // spawnReviewers (which then does NOT fill) + submissionPresent.
  const filled = new Set<string>();
  const steps: QcDriveSteps = {
    spawnReviewers: async (cards, wave) => { calls.waves.push(wave); for (const c of cards) filled.add(c); return {}; },
    firstWaveCards: () => ["/t/00-sweep.md", "/t/bar/ch01.md"],
    pendingReviewCards: () => ["/t/confirm/ch01.md"],
    countSubmissions: () => 3,
    submissionPresent: (c) => filled.has(c),
    collect: () => ({ ok: true, errors: [] }),
    generateConfirmCandidates: () => ({ ok: true, errors: [] }),
    finalize: () => finalized(["PUBLISHABLE"]),
    ledgerOpenCount: () => 0,
    recordMetrics: () => { calls.metrics++; },
    verifyFullBook: async () => true,
    log: () => {},
    ...over,
  };
  return { steps, calls, filled };
}

test("driver: clean full-book round → PASS (verifies qc-status, records metrics, both waves)", async () => {
  const { steps, calls } = makeSteps();
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: true });
  assert.equal(r.outcome, "PASS");
  assert.equal(calls.metrics, 1, "metrics recorded exactly once");
  assert.deepEqual(calls.waves, ["first", "dynamic"], "first wave + one dynamic wave (confirm), no retry");
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

test("driver: a MIXED round (REVISE + a NEEDS_MORE_QC chapter) → REPAIR, not INCOMPLETE (actionable findings beat incompleteness → repair loop, not a false INFRA halt)", async () => {
  // The first-real-run case: sweep flagged some chapters (REVISE) while others were blocked
  // from confirm-candidacy by their own open findings (NEEDS_MORE_QC). finalize.incomplete
  // AND finalize.repairRequired are both true; the round must route to REPAIR (the autopilot
  // maps REPAIR→REVISE→its repair loop), never INCOMPLETE (which it halts on as INFRA).
  const { steps } = makeSteps({ finalize: () => finalized(["REVISE", "NEEDS_MORE_QC", "PUBLISHABLE"]) });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "REPAIR", "genuine REVISE findings win over a still-pending confirm read");
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

test("driver: a SUCCESSFUL narrow retry RE-ENTERS converge+finalize so a newly-eligible confirm card is generated and reviewed (no false-INCOMPLETE halt)", async () => {
  // The hard case: a bar read is flaky through the first + dynamic waves (zero-progress
  // stop) and lands ONLY on the narrow retry. That makes its chapter a fresh publishable
  // candidate whose CONFIRM card hasn't been generated yet. A bare re-finalize would strand
  // it → false INCOMPLETE. The re-entry must regenerate + review the confirm card → PASS.
  const filled = new Set<string>(["/t/00-sweep.md"]); // sweep already in from a prior fill
  let genCalls = 0;
  let finalizeCalls = 0;
  const waves: string[] = [];
  const { steps, calls } = makeSteps({
    firstWaveCards: () => ["/t/00-sweep.md", "/t/bar/ch01.md"],
    // The bar read is FLAKY: it fills only on the "retry" wave, never on first/dynamic.
    spawnReviewers: async (cards, wave) => {
      waves.push(wave);
      for (const c of cards) {
        if (c === "/t/bar/ch01.md" && wave !== "retry") continue; // flaky until the retry
        filled.add(c);
      }
      return {};
    },
    countSubmissions: () => filled.size,
    submissionPresent: (c) => filled.has(c),
    // The confirm card becomes eligible ONLY after the bar landed AND confirm-candidates has
    // regenerated post-retry (genCalls ≥ 2: once in the first pass, once in the re-entry).
    pendingReviewCards: () => (filled.has("/t/bar/ch01.md") && genCalls >= 2 ? ["/t/confirm/ch01.md"] : []),
    generateConfirmCandidates: () => { genCalls++; return { ok: true, errors: [] }; },
    finalize: () => { finalizeCalls++; return filled.has("/t/confirm/ch01.md") ? finalized(["PUBLISHABLE"]) : finalized(["NEEDS_MORE_QC"]); },
  });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: true });
  assert.equal(r.outcome, "PASS", "re-entry generated + reviewed the confirm card; pre-fix this was a false INCOMPLETE");
  assert.equal(calls.metrics, 1, "metrics recorded exactly once across the re-entry");
  assert.ok(waves.includes("retry"), "the narrow retry ran");
  assert.ok(filled.has("/t/confirm/ch01.md"), "the newly-eligible confirm card was generated AND reviewed (filled)");
  assert.ok(finalizeCalls <= 2, "bounded: first-pass finalize + exactly one of {re-entry, bare} finalize");
});

test("driver e2e: borderline bar → t2/t3 tiebreak → confirm → PASS (the dynamic-wave loop reviews generated work)", async () => {
  // The reviewer's blocker-2: confirm-candidates emits bar-tiebreak t2/t3 cards for a
  // borderline chapter (and BLOCKS it); only after they're reviewed + regenerated does the
  // confirm card appear. The loop must drive all of that to a PASS.
  const filled = new Set<string>();
  let genCalls = 0;
  const waves: { wave: string; cards: string[] }[] = [];
  const steps: QcDriveSteps = {
    spawnReviewers: async (cards, wave) => { waves.push({ wave, cards }); for (const c of cards) filled.add(c); return {}; },
    firstWaveCards: () => ["/t/bar/ch01.md"],
    pendingReviewCards: () => {
      const out: string[] = [];
      if (genCalls >= 1) out.push("/t/bar-tiebreak/ch01-t2.md", "/t/bar-tiebreak/ch01-t3.md"); // borderline → tiebreak first
      if (genCalls >= 2 && filled.has("/t/bar-tiebreak/ch01-t2.md") && filled.has("/t/bar-tiebreak/ch01-t3.md")) out.push("/t/confirm/ch01.md"); // then confirm
      return out;
    },
    countSubmissions: () => 1,
    submissionPresent: (c) => filled.has(c),
    collect: () => ({ ok: true, errors: [] }),
    generateConfirmCandidates: () => { genCalls++; return { ok: true, errors: [] }; },
    finalize: () => finalized(["PUBLISHABLE"]),
    ledgerOpenCount: () => 0, recordMetrics: () => {}, verifyFullBook: async () => true, log: () => {},
  };
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: true });
  assert.equal(r.outcome, "PASS");
  const spawned = waves.flatMap((w) => w.cards);
  assert.ok(spawned.includes("/t/bar-tiebreak/ch01-t2.md") && spawned.includes("/t/bar-tiebreak/ch01-t3.md"), "both tiebreak reads were reviewed (not stranded)");
  assert.ok(spawned.includes("/t/confirm/ch01.md"), "the confirm card generated AFTER the tiebreak was reviewed");
});

test("driver e2e: a flaky first-wave bar that lands in the LOOP → confirm regenerates → confirm → PASS (blocker-3)", async () => {
  // The reviewer's blocker-3: a missing first-wave bar gates its chapter's confirm card.
  // The loop re-spawns the bar, re-collects, REGENERATES the (now-eligible) confirm card,
  // and reviews it — instead of jumping straight to finalize.
  const filled = new Set<string>();
  let barAttempts = 0;
  let genCalls = 0;
  const waves: { wave: string; cards: string[] }[] = [];
  const steps: QcDriveSteps = {
    spawnReviewers: async (cards, wave) => {
      waves.push({ wave, cards });
      for (const c of cards) {
        if (c.includes("/bar/")) { barAttempts++; if (barAttempts < 2) continue; } // bar fails the 1st spawn, lands the 2nd
        filled.add(c);
      }
      return {};
    },
    firstWaveCards: () => ["/t/00-sweep.md", "/t/bar/ch01.md"],
    pendingReviewCards: () => (filled.has("/t/bar/ch01.md") && genCalls >= 1 ? ["/t/confirm/ch01.md"] : []),
    countSubmissions: () => filled.size, // sweep lands on the first wave ⇒ >0 even with the bar missing
    submissionPresent: (c) => filled.has(c),
    collect: () => ({ ok: true, errors: [] }),
    generateConfirmCandidates: () => { genCalls++; return { ok: true, errors: [] }; },
    finalize: () => (filled.has("/t/confirm/ch01.md") ? finalized(["PUBLISHABLE"]) : finalized(["NEEDS_MORE_QC"])),
    ledgerOpenCount: () => 0, recordMetrics: () => {}, verifyFullBook: async () => true, log: () => {},
  };
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: true });
  assert.equal(r.outcome, "PASS");
  const spawned = waves.flatMap((w) => w.cards);
  assert.ok(spawned.filter((c) => c.includes("/bar/ch01")).length >= 2, "the flaky bar was re-spawned in the loop (not abandoned)");
  assert.ok(spawned.includes("/t/confirm/ch01.md"), "the confirm candidate regenerated after the bar landed was reviewed");
});

test("driver: a wave that can't be brokered (missing role token) → INFRA, not a content verdict", async () => {
  const { steps } = makeSteps({ spawnReviewers: async () => ({ infraError: "no bar token in REVIEW-PACKET" }) });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "INFRA");
  assert.match(r.reason ?? "", /token/);
});

test("driver: the dynamic-wave loop TERMINATES (no spin) when a generated card never fills", async () => {
  // Disproves the 'zero-progress guard could spin' concern: a dynamic wave that fills
  // NOTHING breaks the loop immediately (the guard), so a permanently-stuck reviewer
  // ends the round INCOMPLETE rather than looping. Nothing ever fills here.
  let dynamicWaves = 0;
  const steps: QcDriveSteps = {
    spawnReviewers: async (_cards, wave) => { if (wave === "dynamic") dynamicWaves++; return {}; }, // never fills
    firstWaveCards: () => ["/t/bar/ch01.md"],
    pendingReviewCards: () => ["/t/confirm/ch01.md"],
    countSubmissions: () => 1, // a first-wave submission exists, so we get past the no-submissions gate
    submissionPresent: () => false, // nothing is ever present → every wave makes zero progress
    collect: () => ({ ok: true, errors: [] }),
    generateConfirmCandidates: () => ({ ok: true, errors: [] }),
    finalize: () => finalized(["NEEDS_MORE_QC"]),
    ledgerOpenCount: () => 0, recordMetrics: () => {}, verifyFullBook: async () => true, log: () => {},
  };
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "INCOMPLETE");
  assert.equal(dynamicWaves, 1, "exactly ONE dynamic wave ran, then the zero-progress guard broke the loop (no spin)");
});

test("driver: a finalize with NO actionable verdict (unexpected tool exit) → INFRA, never REPAIR", async () => {
  // parseFinalizeResult's exit-code fallback on an UNEXPECTED finalize exit (e.g. 2) yields
  // a result that's neither publishable, incomplete, nor repair-required. That must NOT be
  // mislabeled REPAIR (which would send a writer to edit content on a tool error).
  const neither = { ok: false, allPublishable: false, repairRequired: false, incomplete: false, chapters: [], errors: [], evidenceMatrixPath: "", repairBriefPath: "", repairPromptPath: "", attestationsWritten: 0 } as unknown as FinalizeQcRoundResult;
  const { steps } = makeSteps({ finalize: () => neither });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "INFRA");
});

test("driver: NEEDS_MORE_QC with open repair-ledger findings routes to REPAIR, not false infra", async () => {
  const { steps } = makeSteps({
    finalize: () => finalized(["PUBLISHABLE", "NEEDS_MORE_QC"]),
    ledgerOpenCount: () => 2,
  });
  const r = await driveQcRoundCore(steps, { isSubset: false, narrowRetryOnIncomplete: false });
  assert.equal(r.outcome, "REPAIR");
  assert.equal(r.reason, "needs-more-qc-with-open-findings");
  assert.equal(r.openRepairFindings, 2);
});
