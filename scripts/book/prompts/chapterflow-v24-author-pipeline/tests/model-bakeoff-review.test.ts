/**
 * Model bake-off — the review phase (WP-702).
 *
 * PRIMARY judge: the Claude-side D7 rubric-audit instrument (judgeCandidateD7),
 * driven by an INJECTED Claude-worker double, entirely model-free. Proves: the D7
 * composite is produced by the harness (not a codex read); the leak check runs on
 * every D7 task BEFORE dispatch; an unassemblable candidate is INELIGIBLE
 * (d7Composite null, no codex fallback).
 *
 * ADVISORY (non-blocking): the codex whole-book panel read (reviewCandidate) —
 * retained, recorded, but never used for eligibility or ranking.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { SpawnCodexAgentOptions, CodexAgentResult } from "../src/orchestrator/codexAgent.js";
import { bakeoffRoots, PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { assertNoIdentityLeak, forbiddenReviewTokens, reviewCandidate, BlindingLeakError } from "../src/bakeoff/review.js";
import { judgeCandidateD7 } from "../src/bakeoff/d7Judge.js";
import type { CandidateSpec } from "../src/bakeoff/types.js";
import { fixtureChapter, tmpRoot, fakeAutopilotDeps } from "./model-bakeoff-helpers.js";
import { fullFixtureChapter, makeD7Repo, d7WorkerDouble } from "./model-bakeoff-d7-helpers.js";
import type { D7WorkerRequest } from "../src/bakeoff/d7Judge.js";

const SPECS: CandidateSpec[] = [
  { model: "gpt-5.6-sol", slug: "gpt-5-6-sol", slot: "w1", effort: "xhigh" },
  { model: "gpt-5.6-terra", slug: "gpt-5-6-terra", slot: "w2", effort: "xhigh" },
  { model: "gpt-5.6-luna", slug: "gpt-5-6-luna", slot: "w3", effort: "xhigh" },
];

const CALIBRATION_UNIT = "made-to-stick-ch04";

// ── PRIMARY: the Claude-side D7 judge ─────────────────────────────────────────

test("judgeCandidateD7 drives the D7 harness to a chapter-diagnostic composite via an injected Claude-worker double — model-free, no codex read", async () => {
  const repo = makeD7Repo("cf-d7-judge-ok", CALIBRATION_UNIT);
  try {
    const chapters = [fullFixtureChapter("zz-d7-book", 1)];
    const dispatched: D7WorkerRequest[] = [];
    const worker = d7WorkerDouble({
      repositoryRoot: repo.base,
      calibrationUnit: CALIBRATION_UNIT,
      ratingForUnit: () => 4, // a passing D7 (uniform 4 → composite 100)
      onDispatch: (req) => dispatched.push(req),
    });

    const j = await judgeCandidateD7({
      bookId: "zz-d7-book", label: "B", chapters,
      repositoryRoot: repo.base, auditId: "bakeoff-d7-ok-b",
      calibrationUnit: CALIBRATION_UNIT, worker, forbidden: [], log: () => {},
    });

    // The composite is a real number produced by the harness's deterministic report.
    assert.equal(typeof j.d7Composite, "number");
    assert.ok((j.d7Composite ?? 0) >= 80, `D7 composite should clear the bar (got ${j.d7Composite})`);
    assert.equal(j.verdict, "PASS");
    assert.equal(j.d7GatesPass, true);
    assert.equal(j.d7LayerIndependencePass, true);
    assert.equal(j.allCoreDomainsPass, true);
    assert.equal(j.calibrationPass, true);
    assert.equal(j.chapters.length, 1);
    assert.equal(j.chapters[0].chapterNumber, 1);
    assert.equal(j.label, "B");
    assert.equal(j.contentSha256.length, 64);

    // The harness dispatched primary+verification+adjudicator for the candidate
    // chapter AND the hidden calibration unit — never a codex model turn.
    const roles = dispatched.filter((d) => d.unit === "zz-d7-book-ch01").map((d) => d.role).sort();
    assert.deepEqual(roles, ["adjudicator", "primary", "verification"]);
    assert.ok(dispatched.some((d) => d.kind === "calibration"), "the hidden calibration item is audited too");
    // Every dispatched task is self-contained (no filesystem paths leak).
    for (const d of dispatched) {
      assert.ok(!d.task.includes(repo.base) && !d.task.includes("/private/"), "no filesystem path in a D7 task");
    }

    // WP-503: every Claude-side ingest is ledgered (proven end-to-end here).
    const { readCallLedgerEntries } = await import("../src/telemetry/runCallLedger.js");
    const entries = readCallLedgerEntries(
      resolve(repo.base, "scripts/book/prompts/chapterflow-v24-author-pipeline"),
      "zz-d7-book-ch01", "bakeoff-d7-ok-b");
    assert.ok(entries.length >= 3, "primary+verification+adjudicator ingests ledgered");
    assert.ok(entries.every((e) => e.family === "claude-side" && e.stage === "d7-rubric-audit"));
  } finally {
    repo.dispose();
  }
});

test("judgeCandidateD7 resume is idempotent: a completed audit is re-ingested from disk, NEVER re-dispatched to the worker", async () => {
  const repo = makeD7Repo("cf-d7-judge-resume", CALIBRATION_UNIT);
  try {
    const chapters = [fullFixtureChapter("zz-d7-resume", 1)];
    let dispatches = 0;
    const worker = d7WorkerDouble({ repositoryRoot: repo.base, calibrationUnit: CALIBRATION_UNIT, ratingForUnit: () => 4, onDispatch: () => { dispatches += 1; } });
    const args = {
      bookId: "zz-d7-resume", label: "A" as const, chapters,
      repositoryRoot: repo.base, auditId: "bakeoff-d7-resume-a",
      calibrationUnit: CALIBRATION_UNIT, worker, forbidden: [], log: () => {},
    };
    const first = await judgeCandidateD7(args);
    const firstDispatches = dispatches;
    assert.ok(firstDispatches >= 6, "run 1 dispatched primary+verification+adjudicator for the chapter and calibration");

    // Re-run with the SAME audit id: every record is retained → zero re-dispatch,
    // identical composite. (A real Claude worker returns different bytes each call;
    // re-dispatching would be rejected by the immutable-evidence store.)
    dispatches = 0;
    const second = await judgeCandidateD7(args);
    assert.equal(dispatches, 0, "a completed audit re-dispatches nothing on resume");
    assert.equal(second.d7Composite, first.d7Composite, "resume reproduces the same composite");
    assert.equal(second.verdict, first.verdict);
  } finally {
    repo.dispose();
  }
});

test("a candidate whose chapters cannot fail-closed-assemble is INELIGIBLE (d7Composite null) — keys never synthesized, no codex fallback", async () => {
  const repo = makeD7Repo("cf-d7-judge-unassemblable", CALIBRATION_UNIT);
  try {
    // A chapter whose sole quiz question is missing its explanation → assembly refuses.
    const broken = fullFixtureChapter("zz-d7-broken", 1) as unknown as { quiz: { questions: Array<{ explanation: string }> } };
    broken.quiz.questions[0].explanation = "  ";
    let dispatched = 0;
    const worker = d7WorkerDouble({ repositoryRoot: repo.base, calibrationUnit: CALIBRATION_UNIT, onDispatch: () => { dispatched += 1; } });

    const j = await judgeCandidateD7({
      bookId: "zz-d7-broken", label: "A", chapters: [broken as never],
      repositoryRoot: repo.base, auditId: "bakeoff-d7-broken-a",
      calibrationUnit: CALIBRATION_UNIT, worker, forbidden: [], log: () => {},
    });

    assert.equal(j.d7Composite, null, "an unassemblable candidate has no D7 composite");
    assert.ok(/explanation/.test(j.ineligibleReason ?? ""), "the reason names the missing explanation");
    assert.equal(dispatched, 0, "no Claude worker was dispatched — the candidate was refused at assembly");
  } finally {
    repo.dispose();
  }
});

test("the identity-leak check runs on every D7 task BEFORE dispatch — a leaking token refuses the whole audit, no worker is called", async () => {
  const repo = makeD7Repo("cf-d7-judge-leak", CALIBRATION_UNIT);
  try {
    const chapters = [fullFixtureChapter("zz-d7-leak", 1)];
    let dispatched = 0;
    const worker = d7WorkerDouble({ repositoryRoot: repo.base, calibrationUnit: CALIBRATION_UNIT, onDispatch: () => { dispatched += 1; } });

    // "fishmonger" appears in the fixture chapter's audit document; treating it as a
    // forbidden identity token forces the pre-dispatch leak check to fire.
    const j = await judgeCandidateD7({
      bookId: "zz-d7-leak", label: "C", chapters,
      repositoryRoot: repo.base, auditId: "bakeoff-d7-leak-c",
      calibrationUnit: CALIBRATION_UNIT, worker, forbidden: ["fishmonger"], log: () => {},
    });

    assert.equal(j.d7Composite, null, "a leaked packet is never dispatched or scored");
    assert.ok(/leak/i.test(j.ineligibleReason ?? ""), "the D7 input failed the identity-leak check before dispatch");
    assert.equal(dispatched, 0, "no reviewer was spawned over an unblinded D7 packet");
  } finally {
    repo.dispose();
  }
});

test("assertNoIdentityLeak-backed guard is fail-closed: a direct leak throws BlindingLeakError", () => {
  // The D7 judge swallows this into an ineligible reason (proven above); the guard
  // itself is fail-closed by construction.
  assert.throws(() => assertNoIdentityLeak("the gpt-5.6-sol writer", ["gpt-5.6-sol"], "unit test"), BlindingLeakError);
});

// ── ADVISORY (non-blocking): the codex whole-book panel read ──────────────────

const TEN_SCORES = { retention: 82, quizzes: 80, transfer: 81, practical: 83, summaries: 80, tone: 82, limits: 78, insight: 79, density: 80, beginner: 84 };

function judgeSpawn(
  record: SpawnCodexAgentOptions[],
  scoreOf: (readNo: number) => number,
): (opts: SpawnCodexAgentOptions) => Promise<CodexAgentResult> {
  let bookReads = 0;
  return async (opts) => {
    record.push(opts);
    const docRel = opts.task.match(/at: (\S+)/)?.[1] ?? "";
    const docText = readFileSync(resolve(opts.cwd ?? PIPELINE_DIR, docRel), "utf8");
    const quote = docText.split("\n").find((l) => l.length > 30 && !l.startsWith("#") && !l.startsWith("=")) ?? docText.slice(0, 40);
    const isBookReview = opts.task.includes("gate_verdict") || opts.task.startsWith("BLINDED BOOK REVIEW") || opts.task.includes("book3_churn");
    let payload: Record<string, unknown>;
    if (isBookReview) {
      bookReads += 1;
      const c = scoreOf(bookReads);
      const scores = Object.fromEntries(Object.keys(TEN_SCORES).map((k) => [k, c]));
      payload = { gate_verdict: "PASS", book3_churn: "LOW", quizDerivation: {}, scores, quotes: [{ quote, why: "strong" }], oneParagraphVerdict: "solid" };
    } else {
      payload = { quizDerivation: { answers: [], keyDisagreements: [], tells: [] }, scores: TEN_SCORES, ship84: true, quotes: [{ quote, why: "strong" }], complaints: [], oneParagraphVerdict: "ships" };
    }
    const finalMessage = "```json\n" + JSON.stringify(payload) + "\n```";
    return { ok: true, exitCode: 0, finalMessage, stdout: finalMessage, stderr: "", durationMs: 3, sessionId: opts.sessionId };
  };
}

test("advisory reviewCandidate pins the fixed cross-model judge on every spawn, blinds every packet, and persists under the opaque label (non-blocking)", async () => {
  const bookId = "zz-bakeoff-review";
  const roots = bakeoffRoots(bookId, "r1", tmpRoot("cf-bakeoff-review-"));
  const chapters = [fixtureChapter(bookId, 1), fixtureChapter(bookId, 2)];
  const spawns: SpawnCodexAgentOptions[] = [];
  const deps = fakeAutopilotDeps({
    spawn: judgeSpawn(spawns, () => 80) as unknown as AutopilotDeps["spawn"],
  }) as AutopilotDeps;

  const review = await reviewCandidate(bookId, "B", chapters, deps, roots, {
    runId: "r1",
    judge: { model: "gpt-5.6-terra", effort: "high" },
    forbidden: forbiddenReviewTokens(SPECS),
    log: () => {},
    chapterParallel: 1,
  });

  assert.ok(spawns.length >= 4, "2 chapter reads + 2 book reads at minimum");
  for (const s of spawns) {
    assert.equal(s.model, "gpt-5.6-terra", "advisory judge model pinned on every reviewer spawn");
    assert.equal(s.reasoningEffort, "high", "advisory judge effort pinned");
    assert.equal(s.sandbox, "read-only", "reviewers never write");
  }
  const forbidden = forbiddenReviewTokens(SPECS);
  for (const s of spawns) {
    for (const tok of forbidden) {
      assert.ok(!new RegExp(`(^|[^a-z0-9])${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`, "i").test(s.task), `task leaks "${tok}"`);
    }
  }
  assert.equal(review.bookReads.length, 2, "no tiebreak when the two reads agree");
  assert.equal(review.bookGate, "PASS");
  assert.equal(review.label, "B");
  assert.ok(existsSync(join(roots.reviewsDir, "B", "review.json")));
});

test("advisory: disagreeing book reads trigger exactly ONE independent tiebreak read", async () => {
  const bookId = "zz-bakeoff-tiebreak";
  const roots = bakeoffRoots(bookId, "r1", tmpRoot("cf-bakeoff-tb-"));
  const chapters = [fixtureChapter(bookId, 1)];
  const spawns: SpawnCodexAgentOptions[] = [];
  const deps = fakeAutopilotDeps({
    spawn: judgeSpawn(spawns, (readNo) => (readNo === 1 ? 88 : readNo === 2 ? 70 : 80)) as unknown as AutopilotDeps["spawn"],
  }) as AutopilotDeps;

  const review = await reviewCandidate(bookId, "A", chapters, deps, roots, {
    runId: "r1",
    judge: { model: "gpt-5.6-terra", effort: "high" },
    forbidden: [],
    log: () => {},
    chapterParallel: 1,
  });
  assert.equal(review.bookReads.length, 3, "one tiebreak read on disagreement");
  assert.ok(review.bookComposite !== null);
});
