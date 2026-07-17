/**
 * WP-E24 — D7 judge attempt cap + terminal state (V25-AUD-02/03).
 *
 * Model-free, fixture-driven proofs that judgeCandidateD7:
 *  - stamps terminalState "judged" on a candidate driven to a full composite;
 *  - retries a rejected (unit, role) record up to D7_ATTEMPT_CAP times, salvaging
 *    a run when a stochastic slip clears within the cap;
 *  - on cap exhaustion reaches the RECORDED terminal outcome INSTRUMENT_FAIL
 *    (terminalState "instrument-fail", verdict "INSTRUMENT_FAIL", composite null)
 *    — never an erased one, and never a codex fallback.
 *
 * The worker is an injected double; zero model/codex calls.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { judgeCandidateD7, D7_ATTEMPT_CAP, type D7WorkerDispatch, type D7WorkerRequest } from "../src/bakeoff/d7Judge.js";
import { fullFixtureChapter, makeD7Repo, d7WorkerDouble } from "./model-bakeoff-d7-helpers.js";

const CALIBRATION_UNIT = "made-to-stick-ch04";

/** Break an ATOMIC rating (non-numeric) so the record is HARD-rejected on every
 *  attempt — never a derivable aggregate slip, so the cap is the only exit. */
function corruptAtomicRating(recordText: string): string {
  const record = JSON.parse(recordText) as { domains: Record<string, { subcriteria: Record<string, { rating: unknown }> }> };
  const domainKey = Object.keys(record.domains)[0];
  const subKey = Object.keys(record.domains[domainKey].subcriteria)[0];
  record.domains[domainKey].subcriteria[subKey].rating = "corrupt";
  return JSON.stringify(record, null, 2);
}

test("terminalState 'judged' on a candidate driven to a full D7 composite", async () => {
  const repo = makeD7Repo("cf-d7-cap-judged", CALIBRATION_UNIT);
  try {
    const worker = d7WorkerDouble({ repositoryRoot: repo.base, calibrationUnit: CALIBRATION_UNIT, ratingForUnit: () => 4 });
    const j = await judgeCandidateD7({
      bookId: "zz-d7-judged", label: "A", chapters: [fullFixtureChapter("zz-d7-judged", 1)],
      repositoryRoot: repo.base, auditId: "bakeoff-d7-judged-a",
      calibrationUnit: CALIBRATION_UNIT, worker, forbidden: [], log: () => {},
    });
    assert.equal(j.terminalState, "judged");
    assert.equal(j.verdict, "PASS");
    assert.equal(typeof j.d7Composite, "number");
  } finally {
    repo.dispose();
  }
});

test("a (unit, role) whose worker returns an invalid record on every attempt reaches INSTRUMENT_FAIL after exactly D7_ATTEMPT_CAP attempts", async () => {
  const repo = makeD7Repo("cf-d7-cap-fail", CALIBRATION_UNIT);
  try {
    const requests: D7WorkerRequest[] = [];
    const base = d7WorkerDouble({
      repositoryRoot: repo.base, calibrationUnit: CALIBRATION_UNIT, ratingForUnit: () => 4,
      onDispatch: (req) => requests.push(req),
    });
    const worker: D7WorkerDispatch = async (req) => corruptAtomicRating(await base(req));

    const j = await judgeCandidateD7({
      bookId: "zz-d7-cap", label: "B", chapters: [fullFixtureChapter("zz-d7-cap", 1)],
      repositoryRoot: repo.base, auditId: "bakeoff-d7-cap-b",
      calibrationUnit: CALIBRATION_UNIT, worker, forbidden: [], log: () => {},
    });

    // The RECORDED terminal outcome — never erased, never a codex fallback.
    assert.equal(j.terminalState, "instrument-fail");
    assert.equal(j.verdict, "INSTRUMENT_FAIL");
    assert.equal(j.d7Composite, null);
    assert.ok(/exhausted 3 attempts/.test(j.ineligibleReason ?? ""), j.ineligibleReason ?? "no reason");

    // Exactly D7_ATTEMPT_CAP dispatches, all for the FIRST (unit, role), with a
    // strictly increasing 1-based attempt index — then the judge stops (no further
    // roles/units are dispatched once the instrument fails).
    assert.equal(requests.length, D7_ATTEMPT_CAP);
    assert.deepEqual(requests.map((r) => r.attempt), [1, 2, 3]);
    assert.ok(requests.every((r) => r.unit === "zz-d7-cap-ch01" && r.role === "primary"),
      "the cap is per-(unit, role): all attempts are the same first unit+role");
  } finally {
    repo.dispose();
  }
});

test("the attempt cap SALVAGES a run: a (unit, role) that fails twice then returns a valid record is judged, not failed", async () => {
  const repo = makeD7Repo("cf-d7-cap-salvage", CALIBRATION_UNIT);
  try {
    const attemptsSeen: number[] = [];
    const base = d7WorkerDouble({ repositoryRoot: repo.base, calibrationUnit: CALIBRATION_UNIT, ratingForUnit: () => 4 });
    const worker: D7WorkerDispatch = async (req) => {
      const text = await base(req);
      // Only the candidate-chapter primary slips — and only on attempts 1 and 2.
      if (req.unit === "zz-d7-salvage-ch01" && req.role === "primary") {
        attemptsSeen.push(req.attempt ?? 0);
        if ((req.attempt ?? 0) < 3) return corruptAtomicRating(text);
      }
      return text;
    };

    const j = await judgeCandidateD7({
      bookId: "zz-d7-salvage", label: "C", chapters: [fullFixtureChapter("zz-d7-salvage", 1)],
      repositoryRoot: repo.base, auditId: "bakeoff-d7-salvage-c",
      calibrationUnit: CALIBRATION_UNIT, worker, forbidden: [], log: () => {},
    });

    assert.deepEqual(attemptsSeen, [1, 2, 3], "the primary was retried until it cleared within the cap");
    assert.equal(j.terminalState, "judged", "a within-cap recovery is a judged candidate, not an instrument failure");
    assert.equal(j.verdict, "PASS");
    assert.equal(typeof j.d7Composite, "number");
  } finally {
    repo.dispose();
  }
});

test("resume after exhaustion (rt FINDING C): a durable INSTRUMENT_FAIL marker returns the recorded terminal WITHOUT any new worker dispatch — a resume can never silently revive a capped candidate", async () => {
  const repo = makeD7Repo("cf-d7-cap-resume", CALIBRATION_UNIT);
  try {
    const auditId = "bakeoff-d7-resume-x";
    const base = d7WorkerDouble({ repositoryRoot: repo.base, calibrationUnit: CALIBRATION_UNIT, ratingForUnit: () => 4 });

    // Run 1: the worker always returns an invalid record → the first (unit, role)
    // exhausts the cap and the candidate reaches INSTRUMENT_FAIL, persisting a
    // durable marker beside the audit evidence.
    const failing: D7WorkerDispatch = async (req) => corruptAtomicRating(await base(req));
    const j1 = await judgeCandidateD7({
      bookId: "zz-d7-resume", label: "D", chapters: [fullFixtureChapter("zz-d7-resume", 1)],
      repositoryRoot: repo.base, auditId, calibrationUnit: CALIBRATION_UNIT, worker: failing, forbidden: [], log: () => {},
    });
    assert.equal(j1.terminalState, "instrument-fail");
    assert.equal(j1.verdict, "INSTRUMENT_FAIL");

    // Run 2 (resume, same auditId + repo): a SPY worker that would return VALID
    // records if it were ever called. The durable marker must short-circuit BEFORE
    // any dispatch — a capped candidate is never re-attempted or re-spent on.
    let dispatches = 0;
    const spy: D7WorkerDispatch = async (req) => { dispatches += 1; return base(req); };
    const j2 = await judgeCandidateD7({
      bookId: "zz-d7-resume", label: "D", chapters: [fullFixtureChapter("zz-d7-resume", 1)],
      repositoryRoot: repo.base, auditId, calibrationUnit: CALIBRATION_UNIT, worker: spy, forbidden: [], log: () => {},
    });
    assert.equal(dispatches, 0, "a resume of a capped candidate makes ZERO new worker dispatches");
    assert.equal(j2.terminalState, "instrument-fail", "the resume returns the RECORDED terminal, not a fresh judgment");
    assert.equal(j2.verdict, "INSTRUMENT_FAIL");
    assert.equal(j2.d7Composite, null);
    assert.ok(/exhausted 3 attempts/.test(j2.ineligibleReason ?? ""), j2.ineligibleReason ?? "no reason");
  } finally {
    repo.dispose();
  }
});
