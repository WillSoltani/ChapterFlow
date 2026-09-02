/**
 * The canonical-review FAIL -> repair lane.
 *
 * Before this lane existed a canonical review FAIL was TERMINAL: the book-run
 * service returned BOOK_RUN_REVIEW_FAILED and the whole book was discarded, so
 * the panel's named, reader-decidable blockers were answered by a fresh compile
 * that produced a DIFFERENT set of one-off contradictions. These cases pin the
 * replacement: the named blockers are routed into the repair machinery, the
 * repaired candidate is RE-REVIEWED by the panel, the loop is bounded and
 * operator-visible, a resume is idempotent, and a blocker whose location cannot
 * be mapped to exactly one chapter fails loud instead of vanishing.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  MAX_REVIEW_REPAIR_ORDINALS,
  MAX_REVIEW_REPAIR_ROUNDS,
  resolveReviewRepairRounds,
} from "../../src/app/bookRunApplicationService.js";
import {
  CandidateRepairApplicationPort,
  type ReviewRepairApplicationRequest,
} from "../../src/app/candidateRepairApplicationPort.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type {
  CandidateManifest,
  CandidateSnapshot,
  CandidateStore,
} from "../../src/books/candidateTypes.js";
import type { CandidateIdentity } from "../../src/contracts/v4Core.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import type { DiagnosisLookup, RepairService } from "../../src/qc/repairCoordinator.js";
import type { RepairHistoryStore } from "../../src/qc/repairHistoryStore.js";
import type { QcService } from "../../src/qc/qcTypes.js";
import type { CanonicalReviewResult, ReviewIssue, ReviewService } from "../../src/review/reviewTypes.js";
import { createFileRunStore } from "../../src/run-state/fileRunStore.js";
import { createFileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import type { ChapterV21 } from "../../src/types.js";
import { buildBookRunHarness, derivedIdOf } from "./bookRunRepairRig.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";
import { BOOK as PORT_BOOK, FAILED, candidate as portCandidate, identity } from "./repairPortRig.js";

function digestOf(files: readonly { logicalPath: string; bytes: Uint8Array }[]): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath))) {
    hash.update(file.logicalPath).update("\0").update(Buffer.from(file.bytes)).update("\0");
  }
  return hash.digest("hex");
}

// ────────────────────────────────────────────────────────────────────────────
// Port-level rig: exercises CandidateRepairApplicationPort.runFromReviewFail in
// isolation. Only the seams that lane touches are real (candidate store,
// run-state, stage coordinator, review lookup); the QC-lane seams are inert.
// ────────────────────────────────────────────────────────────────────────────

type ReviewRig = Readonly<{
  port: CandidateRepairApplicationPort;
  request: ReviewRepairApplicationRequest;
  predecessor: CandidateSnapshot;
  counts: { model: number };
  prompts: Parameters<ModelTaskRunner["run"]>[0][];
}>;

function reviewRig(
  context: TestContext,
  options: Readonly<{ issues: readonly ReviewIssue[]; outcome?: CanonicalReviewResult["outcome"]; slug: string }>,
): ReviewRig {
  const predecessor = portCandidate(context);
  const chapterOne = JSON.parse(Buffer.from(predecessor.files[0].bytes).toString("utf8")) as ChapterV21;
  const replacement: ChapterV21 = {
    ...chapterOne,
    hook: "A repaired opening names the ruling the panel said the chapter never issued.",
  };
  const stored = new Map<string, CandidateSnapshot>([[FAILED.candidateId, predecessor]]);
  const counts = { model: 0 };
  const prompts: Parameters<ModelTaskRunner["run"]>[0][] = [];
  const runRoot = resolve(context.roots.tempRoot, `${options.slug}-run-state`);
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);

  const candidates: CandidateStore = {
    async stage(input) {
      if (stored.has(input.candidateId)) return { ok: false, error: { code: "CANDIDATE_EXISTS", message: "exists" } };
      const files = input.files.map((file) => ({ ...file, byteLength: file.bytes.byteLength }));
      const manifest: CandidateManifest = {
        schemaVersion: "1",
        bookId: input.bookId,
        candidateId: input.candidateId,
        ...(input.parentCandidateId === undefined ? {} : { parentCandidateId: input.parentCandidateId }),
        createdByRunId: input.createdByRunId,
        entries: files.map(({ bytes: _bytes, ...file }) => file),
        manifestDigest: digestOf(files),
        createdAt: input.createdAt,
      };
      stored.set(input.candidateId, { manifest, files });
      return { ok: true, value: manifest };
    },
    async open(input) {
      if (input.selector.kind !== "CANDIDATE") return { ok: false, error: { code: "CANDIDATE_NOT_FOUND", message: "not found" } };
      const snapshot = stored.get(input.selector.candidateId);
      return snapshot ? { ok: true, value: snapshot } : { ok: false, error: { code: "CANDIDATE_NOT_FOUND", message: "not found" } };
    },
  };
  const failedReview: CanonicalReviewResult = {
    schemaVersion: "1",
    reviewId: "review-panel-fail",
    candidate: FAILED,
    outcome: options.outcome ?? "FAIL",
    issues: options.issues,
    completedAt: context.clock.now(),
  };
  const reviews: ReviewService = {
    async screen(value) { return { ok: true, value: { candidate: identity(value), outcome: "SHORTLIST", issues: [] } }; },
    async reviewCanonical() { throw new Error("unused: the book-run service owns re-review, not the port"); },
    async get(_bookId, reviewId) {
      return reviewId === failedReview.reviewId
        ? { ok: true, value: failedReview }
        : { ok: false, error: { code: "REVIEW_NOT_FOUND", message: "missing" } };
    },
  };
  const inert = { code: "UNUSED", message: "unused" } as const;
  const qc: QcService = {
    async getRound() { return { ok: false, error: inert }; },
    async readStatus() { return { ok: false, error: inert }; },
    async runFresh() { return { ok: false, error: inert }; },
    async diagnose() { return { ok: false, error: inert }; },
    async repairLedger() { return { ok: false, error: inert }; },
  };
  const history: RepairHistoryStore = {
    async list() { return { ok: true, value: [] }; },
    async append() { throw new Error("unused: the review lane appends no QC repair-history record"); },
  };
  const diagnoses: DiagnosisLookup = { async getDiagnosis() { return { ok: false, error: inert }; } };
  const repairs: RepairService = { async createSuccessor() { throw new Error("unused: review lane stages its own successor"); } };
  const runner: ModelTaskRunner = {
    async run(request) {
      counts.model += 1;
      prompts.push(request);
      const admittedAt = context.clock.now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      assert.equal(admitted.ok, true, JSON.stringify(admitted));
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: replacement };
    },
  };
  const port = new CandidateRepairApplicationPort({
    pipelineRoot: resolve(context.roots.base, "pipeline"),
    candidates,
    qc,
    history,
    diagnoses,
    runner,
    repairs,
    reviews,
    successorQc: { async run() { throw new Error("unused: the review lane runs no fresh QC"); } },
    runStore,
    stageCoordinator,
    clock: context.clock,
  });
  return {
    port,
    predecessor,
    counts,
    prompts,
    request: {
      bookId: PORT_BOOK,
      failedCandidate: FAILED,
      failedReviewId: failedReview.reviewId,
      successorCandidateId: "candidate-review-successor",
      repairRunId: `review-repair-run-${options.slug}`,
      sourceGitSha: "1".repeat(40),
      attemptRoot: resolve(context.roots.attemptsRoot, `${options.slug}-review-repair`),
      signal: new AbortController().signal,
    },
  };
}

const PANEL_BLOCKER: ReviewIssue = {
  code: "READER.BLOCKING.contradiction",
  severity: "BLOCKER",
  message: "the Deep read calls the statement 'his ruling'; Review Card 5 says he issued no ruling",
  location: "ch01/reader-b/deep",
};

requiredTest("a review FAIL routes its panel-named blockers into a chapter-scoped repair and stages a successor", async (context: TestContext) => {
  const rig = reviewRig(context, {
    slug: "review-repair-happy",
    issues: [
      PANEL_BLOCKER,
      { code: "READER.PANEL.FACTOR_SCORES", severity: "WARN", message: "clarity 6; momentum 7", location: "ch01" },
      { code: "READER.ADVISORY.pacing", severity: "WARN", message: "the middle beat drags", location: "ch01/reader-a/beat" },
    ],
  });

  const repaired = await rig.port.runFromReviewFail(rig.request);
  if (!repaired.ok) throw new Error(`review-repair must succeed: ${JSON.stringify(repaired.error)}`);

  // Chapter-scoped: only the chapter the blocker names was rewritten.
  assert.deepEqual([...repaired.value.targetChapterNumbers], [1]);
  assert.equal(rig.counts.model, 1, "exactly one chapter repair call");
  assert.equal(repaired.value.successor.manifest.candidateId, rig.request.successorCandidateId);
  assert.equal(repaired.value.successor.manifest.parentCandidateId, FAILED.candidateId);
  assert.notEqual(repaired.value.successor.manifest.manifestDigest, FAILED.manifestDigest);

  // The panel's blocker reached the model as a MANDATORY fix, and the advisories
  // reached it as diagnosis — the verdict itself is never rewritten or lowered.
  const brief = rig.prompts[0].prompt.inputs.find((entry) => entry.name === "repair_brief");
  assert.ok(brief, "the repair prompt must carry a brief");
  const briefText = Buffer.from(brief!.bytes).toString("utf8");
  assert.ok(briefText.includes("MANDATORY FIXES — BLOCKERS (1)"), briefText);
  assert.ok(briefText.includes("READER.BLOCKING.contradiction"), briefText);
  assert.ok(briefText.includes("READER.ADVISORY.pacing"), briefText);

  // The port does NOT judge its own work: no review, no QC round, no promotion.
  const findings = rig.prompts[0].prompt.inputs.find((entry) => entry.name === "qc_findings");
  assert.ok(findings, "the repair prompt must carry the machine-readable findings");
  const parsed = JSON.parse(Buffer.from(findings!.bytes).toString("utf8")) as readonly { code: string }[];
  assert.deepEqual(parsed.map((issue) => issue.code), ["READER.BLOCKING.contradiction"]);

  // Only chapter 1 changed; chapter 2 is byte-identical to the predecessor.
  const beforeTwo = rig.predecessor.files.find((file) => file.logicalPath.endsWith("ch02.v21-native.chapter.json"))!;
  const afterTwo = repaired.value.successor.files.find((file) => file.logicalPath === beforeTwo.logicalPath)!;
  assert.ok(Buffer.from(beforeTwo.bytes).equals(Buffer.from(afterTwo.bytes)), "an unnamed chapter must not be resampled");
});

requiredTest("a review blocker that names no single chapter fails LOUD instead of being silently dropped", async (context: TestContext) => {
  const rig = reviewRig(context, {
    slug: "review-repair-unmappable",
    issues: [
      PANEL_BLOCKER,
      { code: "READER.BLOCKING.throughline", severity: "BLOCKER", message: "the book's spine never resolves", location: "book/global" },
    ],
  });

  const repaired = await rig.port.runFromReviewFail(rig.request);
  assert.equal(repaired.ok, false, JSON.stringify(repaired));
  if (repaired.ok) throw new Error("an unmappable blocker must not be dropped");
  assert.equal(repaired.error.code, "REVIEW_REPAIR_FINDING_UNSCOPED");
  assert.ok(repaired.error.message.includes("READER.BLOCKING.throughline"), repaired.error.message);
  assert.ok(repaired.error.message.includes("book/global"), repaired.error.message);
  assert.equal(rig.counts.model, 0, "an unscoped blocker must burn zero model calls");
});

requiredTest("R-224: a reader-lane INFRASTRUCTURE blocker never authorizes a chapter repair", async (context: TestContext) => {
  // A seat whose model run did not succeed (provider block, timeout, admission
  // collision) is recorded as SEMANTIC_PANEL_READER_FAILED at the chapter the
  // panel was standing on. That location resolves — so without a guard the port
  // would happily rewrite that chapter because the PROVIDER was unavailable, and
  // the repair evidence would keep a fabricated content finding forever.
  //
  // Two live gates already keep this shape away from the port: the evaluator
  // sets the review outcome to ERROR whenever a seat throws, the book-run loop
  // enters review-repair only on FAIL, and reviewRepairPreflight refuses any
  // stored outcome that is not FAIL (pinned directly below). This is the third,
  // named guard, and it is the one that survives a future edit to either of the
  // other two.
  const rig = reviewRig(context, {
    slug: "review-repair-reader-infra",
    issues: [
      {
        code: "SEMANTIC_PANEL_READER_FAILED",
        severity: "BLOCKER",
        message: "SEMANTIC_PANEL_READER_FAILED:MODEL_PROCESS_FAILED:You've hit your weekly limit \u00b7 resets Sep 1 at 8pm",
        location: "ch01",
      },
    ],
  });

  const repaired = await rig.port.runFromReviewFail(rig.request);
  assert.equal(repaired.ok, false, JSON.stringify(repaired));
  if (repaired.ok) throw new Error("an infrastructure failure must never authorize a content repair");
  assert.equal(repaired.error.code, "REVIEW_REPAIR_FINDING_UNSCOPED");
  assert.ok(repaired.error.message.includes("SEMANTIC_PANEL_READER_FAILED"), repaired.error.message);
  assert.equal(rig.counts.model, 0, "an infrastructure blocker must burn zero model calls");
});

requiredTest("R-224: an unparseable-seat blocker is refused the same way", async (context: TestContext) => {
  const rig = reviewRig(context, {
    slug: "review-repair-reader-unparseable",
    issues: [
      PANEL_BLOCKER,
      {
        code: "SEMANTIC_PANEL_READER_UNPARSEABLE",
        severity: "BLOCKER",
        message: "reader-panel seat reader-b: no parseable JSON object in the reviewer output",
        location: "ch01",
      },
    ],
  });

  const repaired = await rig.port.runFromReviewFail(rig.request);
  assert.equal(repaired.ok, false, JSON.stringify(repaired));
  if (repaired.ok) throw new Error("a seat-schema failure must never authorize a content repair");
  assert.equal(repaired.error.code, "REVIEW_REPAIR_FINDING_UNSCOPED");
  assert.ok(repaired.error.message.includes("SEMANTIC_PANEL_READER_UNPARSEABLE"), repaired.error.message);
  assert.equal(rig.counts.model, 0);
});

requiredTest("R-224 PIN: an ERROR canonical review — the outcome a reader-lane infra failure produces — is never repair-authorizing", async (context: TestContext) => {
  // Already true before R-224 (reviewRepairPreflight requires a stored FAIL);
  // pinned here because the whole no-repair-on-infra argument rests on it.
  const rig = reviewRig(context, {
    slug: "review-repair-error-outcome",
    outcome: "ERROR",
    issues: [
      {
        code: "SEMANTIC_PANEL_READER_FAILED",
        severity: "BLOCKER",
        message: "SEMANTIC_PANEL_READER_FAILED:MODEL_PROCESS_FAILED:You've hit your weekly limit \u00b7 resets Sep 1 at 8pm",
        location: "ch01",
      },
    ],
  });

  const repaired = await rig.port.runFromReviewFail(rig.request);
  assert.equal(repaired.ok, false, JSON.stringify(repaired));
  if (repaired.ok) throw new Error("an ERROR review must never authorize a repair");
  assert.equal(repaired.error.code, "REVIEW_REPAIR_VERDICT_STALE");
  assert.ok(repaired.error.message.includes("outcome=ERROR"), repaired.error.message);
  assert.equal(rig.counts.model, 0);
});

requiredTest("a review-repair replays idempotently: a second call re-reads its successor with zero new model calls", async (context: TestContext) => {
  const rig = reviewRig(context, { slug: "review-repair-idempotent", issues: [PANEL_BLOCKER] });

  const first = await rig.port.runFromReviewFail(rig.request);
  if (!first.ok) throw new Error(`first review-repair must succeed: ${JSON.stringify(first.error)}`);
  assert.equal(rig.counts.model, 1);

  const replay = await rig.port.runFromReviewFail(rig.request);
  if (!replay.ok) throw new Error(`replayed review-repair must reconcile: ${JSON.stringify(replay.error)}`);
  assert.equal(rig.counts.model, 1, "a replayed review-repair must NOT re-run the model");
  assert.deepEqual(
    identity(replay.value.successor),
    identity(first.value.successor),
    "a replay must return the SAME successor, never a second one",
  );
});

requiredTest("a PASS canonical review is never repair-authorizing", async (context: TestContext) => {
  const rig = reviewRig(context, { slug: "review-repair-pass", outcome: "PASS", issues: [], });

  const repaired = await rig.port.runFromReviewFail(rig.request);
  assert.equal(repaired.ok, false, JSON.stringify(repaired));
  if (repaired.ok) throw new Error("a PASS review must never authorize a repair");
  assert.equal(repaired.error.code, "REVIEW_REPAIR_VERDICT_STALE");
  assert.equal(rig.counts.model, 0);
});


requiredTest("a canonical review FAIL is repaired and RE-REVIEWED, and the repaired candidate is what gets promoted", async (context: TestContext) => {
  const book = "review-repair-converges";
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"]);

  const result = await h.service.run({ ...h.request });
  if (!result.ok) throw new Error(`review-repair must converge: ${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "PROMOTED");

  // Exactly one repair round, and the panel judged the successor.
  assert.equal(h.repairCalls().length, 1, JSON.stringify(h.repairCalls()));
  assert.equal(h.reviewCalls(), 2, "the repaired candidate must be re-reviewed by the panel");

  // The PROMOTED candidate is the REPAIRED successor, not the compiled original.
  const successorId = h.repairCalls()[0].successorCandidateId;
  assert.equal(result.value.candidate.candidateId, successorId, JSON.stringify(result.value));
  assert.notEqual(result.value.candidate.candidateId, h.repairCalls()[0].failedCandidate.candidateId);

  // The verdict that counts is the successor's own review, not the FAIL.
  assert.equal(result.value.reviewId, derivedIdOf("review", derivedIdOf("review-repair-1", h.bookRunId)));

  // Operator-visible: the repair round is in the durable phase log.
  const repairEvents = h.events.filter((event) => event.phase === "repair" && event.detail?.includes("REVIEW_REPAIR"));
  assert.ok(repairEvents.some((event) => event.status === "STARTED"), JSON.stringify(h.events.map((e) => e.detail)));
  assert.ok(repairEvents.some((event) => event.status === "COMPLETED"), JSON.stringify(h.events.map((e) => e.detail)));
  assert.ok(repairEvents.some((event) => event.detail?.includes("round=1")), JSON.stringify(repairEvents.map((e) => e.detail)));
});

requiredTest("the review-repair loop is BOUNDED: the cap is enforced and the run fails closed with a clear message", async (context: TestContext) => {
  const book = "review-repair-capped";
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "FAIL", "FAIL"]);

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("an unconverged review-repair loop must fail closed");
  assert.equal(result.error.code, "BOOK_RUN_REVIEW_FAILED");
  assert.ok(
    result.error.message.includes(String(MAX_REVIEW_REPAIR_ROUNDS)),
    `the cap must be named in the failure: ${result.error.message}`,
  );
  assert.equal(h.repairCalls().length, MAX_REVIEW_REPAIR_ROUNDS, "the loop must stop at the cap");
  assert.equal(h.reviewCalls(), MAX_REVIEW_REPAIR_ROUNDS + 1, "one panel run per candidate, and no more");
  // Each round is individually visible, and the cap itself is recorded.
  for (let round = 1; round <= MAX_REVIEW_REPAIR_ROUNDS; round += 1) {
    assert.ok(
      h.events.some((event) => event.phase === "repair" && event.status === "STARTED" && event.detail?.includes(`round=${round}`)),
      `round ${round} must be in the durable phase log`,
    );
  }
  assert.ok(
    h.events.some((event) => event.phase === "repair" && event.status === "FAILED" && event.detail?.includes("cap")),
    JSON.stringify(h.events.filter((e) => e.phase === "repair").map((e) => [e.status, e.detail])),
  );
});

requiredTest("a resume mid review-repair is idempotent: replayed ordinals mint no second successor and cost nothing; fresh work continues past them", async (context: TestContext) => {
  const book = "review-repair-resume";
  // First run exhausts the spend cap on FRESH rounds whose re-reviews all FAIL,
  // leaving durable COMPLETED ordinals on disk. The resume must (a) replay each
  // of those with the SAME successor identity and zero new panel reads for the
  // replayed rounds, and (b) — since replays are free of the spend cap, the fix
  // the live Franklin resume needed — continue into FRESH ordinals beyond them.
  // The old form of this pin asserted the resume makes ZERO new panel calls in
  // total; that encoded the replay-consumes-cap bug in which a capped-out run
  // could never advance again.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "FAIL", "FAIL"]);

  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false);
  const roundsFirst = h.repairCalls().length;
  assert.equal(roundsFirst, MAX_REVIEW_REPAIR_ROUNDS);
  const idsFirst = new Set(h.repairCalls().map((request) => request.successorCandidateId));
  assert.equal(idsFirst.size, MAX_REVIEW_REPAIR_ROUNDS);

  const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(resumed.ok, false, JSON.stringify(resumed));
  if (resumed.ok) throw new Error("the resume must not invent a pass");
  assert.equal(resumed.error.code, "BOOK_RUN_REVIEW_FAILED");
  // No REPLAYED round minted a new successor id: every id from the first run
  // appears exactly once more (the replay), reusing the identity.
  const allIds = h.repairCalls().map((request) => request.successorCandidateId);
  for (const id of idsFirst) {
    assert.equal(allIds.filter((candidate) => candidate === id).length, 2, `replayed ordinal reuses its successor id exactly (${id})`);
  }
  // Fresh work CONTINUED past the replays — the point of the replay-free cap.
  assert.ok(h.repairCalls().length > roundsFirst * 2 - 1, "the resume reaches fresh ordinals beyond the replays");
});

requiredTest("a failing review-repair surfaces its own error and never masks the panel verdict", async (context: TestContext) => {
  const book = "review-repair-portfails";
  const h = await buildBookRunHarness(context, book, ["FAIL"], { repairFails: "REVIEW_REPAIR_FINDING_UNSCOPED" });

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("a failed review-repair must not promote");
  assert.equal(result.error.code, "REVIEW_REPAIR_FINDING_UNSCOPED");
  assert.ok(
    h.events.some((event) => event.phase === "repair" && event.status === "FAILED"),
    JSON.stringify(h.events.map((e) => [e.phase, e.status, e.detail])),
  );
});

// ────────────────────────────────────────────────────────────────────────────
// The review-repair lane's own ORDINAL walk.
//
// The loop counter `reviewRepairRounds` is a local initialised to 0 on every
// `service.run()`, and round one derived its ids from it — so round one was
// ALWAYS "review-repair-1". Once that run had ended FAILED, every later operator
// round re-created the same dead id, the port answered
// REVIEW_REPAIR_RUN_TERMINAL, and the book wedged exactly as the QC lane did.
// The label now comes from the shared ordinal walk, which reads run-state, so it
// survives across operator rounds. A COMPLETED ordinal is NOT spent here: this
// loop is a chain, and replaying that link re-reads its successor model-free
// while the loop advances to the next ordinal.
// ────────────────────────────────────────────────────────────────────────────

requiredTest("a FAILED review-repair ordinal no longer wedges the book: the next operator round executes under the next ordinal", async (context: TestContext) => {
  const book = "review-repair-wedge";
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"]);
  // The durable shape an earlier operator round left behind.
  await h.seedReviewRepairRun("review-repair-1", "FAILED");

  const result = await h.service.run({ ...h.request });
  if (!result.ok) throw new Error(`a FAILED review-repair run must not wedge the book: ${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "PROMOTED");

  assert.equal(h.repairCalls().length, 1, JSON.stringify(h.repairCalls()));
  assert.equal(
    h.repairCalls()[0].repairRunId,
    h.reviewRepairRunId("review-repair-2"),
    "round one must walk past the ordinal an earlier operator round burned",
  );
  // Every id the round owns moves with the ordinal, not just the run id.
  assert.equal(h.repairCalls()[0].successorCandidateId, derivedIdOf("review-repair-2-candidate", h.bookRunId));
  assert.equal(result.value.reviewId, derivedIdOf("review", derivedIdOf("review-repair-2", h.bookRunId)));

  const dead = await h.runStore.readRun(book, h.reviewRepairRunId("review-repair-1"), context.clock.now());
  assert.ok(dead.ok);
  assert.equal(dead.value.status, "FAILED", "the walk abandons nothing and rewrites nothing");
  assert.ok(
    h.events.some((event) => event.phase === "repair" && event.status === "STARTED" && event.detail?.includes("label=review-repair-2")),
    JSON.stringify(h.events.filter((event) => event.phase === "repair").map((event) => [event.status, event.detail])),
  );
});

requiredTest("a review-repair that FAILS its own ordinal leaves the next one for the NEXT operator round", async (context: TestContext) => {
  const book = "review-repair-nextround";
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "FAIL"], {
    repairFails: "REVIEW_REPAIR_MODEL_FAILED",
  });

  // Round one: the repair does its own terminal write, exactly as the port does.
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("a failed review-repair must not promote");
  assert.equal(first.error.code, "REVIEW_REPAIR_MODEL_FAILED");
  assert.equal(h.repairCalls()[0].repairRunId, h.reviewRepairRunId("review-repair-1"), "an unseeded book uses the historical ordinal-1 id");
  const burned = await h.runStore.readRun(book, h.reviewRepairRunId("review-repair-1"), context.clock.now());
  assert.ok(burned.ok);
  assert.equal(burned.value.status, "FAILED");

  // Round two — the operator simply runs again, and the round counter resets to
  // zero. THIS is the wedge: with the label derived from that counter, the
  // second call re-created the dead id and died REVIEW_REPAIR_RUN_TERMINAL,
  // forever.
  const second = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(second.ok, false, JSON.stringify(second));
  if (second.ok) throw new Error("the scripted repair still fails; only the ORDINAL should move");
  assert.notEqual(second.error.code, "REVIEW_REPAIR_RUN_TERMINAL", "a spent repair run must never be the book's terminal answer");
  assert.equal(second.error.code, "REVIEW_REPAIR_MODEL_FAILED", "round two reaches the repair itself, not its predecessor's tombstone");
  assert.equal(h.repairCalls()[1].repairRunId, h.reviewRepairRunId("review-repair-2"));
});

requiredTest("an operator-CANCELLED review-repair ordinal is never walked past: cancellation is intent, not a dead ordinal", async (context: TestContext) => {
  const book = "review-repair-cancelled";
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"]);
  await h.seedReviewRepairRun("review-repair-1", "CANCELLED");

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("a cancelled review-repair must not be silently retried under a successor");
  assert.equal(result.error.code, "REVIEW_REPAIR_CANCELLED");
  assert.equal(h.repairCalls().length, 1);
  assert.equal(
    h.repairCalls()[0].repairRunId,
    h.reviewRepairRunId("review-repair-1"),
    "the cancelled ordinal is handed straight back to the port, which answers REVIEW_REPAIR_CANCELLED",
  );
  const successor = await h.runStore.readRun(book, h.reviewRepairRunId("review-repair-2"), context.clock.now());
  assert.equal(successor.ok, false, "operator intent must never mint a successor");
});

requiredTest("the review-repair ordinal space is BOUNDED: exhaustion fails closed with the ceiling named", async (context: TestContext) => {
  const book = "review-repair-ordinals";
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"]);
  for (let ordinal = 1; ordinal <= MAX_REVIEW_REPAIR_ORDINALS; ordinal += 1) {
    await h.seedReviewRepairRun(`review-repair-${ordinal}`, "FAILED");
  }

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("an exhausted ordinal space must fail closed, never loop");
  assert.equal(result.error.code, "BOOK_RUN_REPAIR_UNAVAILABLE");
  assert.ok(
    result.error.message.includes(String(MAX_REVIEW_REPAIR_ORDINALS)),
    `the ceiling must be named in the failure: ${result.error.message}`,
  );
  assert.equal(h.repairCalls().length, 0, "an exhausted ceiling must not re-enter a spent repair run");
  const past = await h.runStore.readRun(book, h.reviewRepairRunId(`review-repair-${MAX_REVIEW_REPAIR_ORDINALS + 1}`), context.clock.now());
  assert.equal(past.ok, false, "the walk must not mint an ordinal past the ceiling");
});

requiredTest("the review-repair cap honours CHAPTERFLOW_REVIEW_REPAIR_ROUNDS and fails closed on a bad value", () => {
  const saved = process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
  try {
    delete process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
    assert.equal(resolveReviewRepairRounds(), MAX_REVIEW_REPAIR_ROUNDS, "unset falls back to the default");
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "4";
    assert.equal(resolveReviewRepairRounds(), 4, "an operator override is honoured");
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "not-a-number";
    assert.throws(() => resolveReviewRepairRounds(), /not an integer/, "garbage fails closed, never silently defaults");
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "0";
    assert.throws(() => resolveReviewRepairRounds(), /must be 1-10/, "zero would disable the lane silently");
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "99";
    assert.throws(() => resolveReviewRepairRounds(), /must be 1-10/, "a typo must not burn panels indefinitely");
  } finally {
    if (saved === undefined) delete process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
    else process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = saved;
  }
});

requiredTest("replayed COMPLETED ordinals do not consume the spend cap: a resume reaches fresh work past the cap-count", async (context: TestContext) => {
  // LIVE WEDGE this pins: the Franklin S-tier resume replayed COMPLETED
  // ordinals 1..6 (zero model calls), the per-invocation spend counter hit the
  // cap of 6 on FREE work, and the run died without ever executing a 7th
  // ordinal. The cap bounds MODEL SPEND; replays are free.
  const book = "review-repair-replay-free";
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "PASS"], {});
  const saved = process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
  try {
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "2";
    // First run: two FRESH repair rounds execute and their re-reviews FAIL, so
    // the run dies at the cap with ordinals 1-2 COMPLETED and durable.
    const first = await h.service.run({ ...h.request });
    assert.equal(first.ok, false);
    if (first.ok) throw new Error("unreachable");
    assert.match(first.error.message, /review-repair round/);
    const freshCallsAfterFirst = h.repairCalls().length;
    assert.ok(freshCallsAfterFirst >= 2, `two fresh rounds executed: ${freshCallsAfterFirst}`);

    // Resume: ordinals 1-2 REPLAY (free), then a THIRD fresh round must execute
    // within the same cap of 2 — pre-fix the replays consumed the cap and the
    // run died here without any fresh work.
    const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
    const callsAfterResume = h.repairCalls().length;
    assert.ok(
      callsAfterResume > freshCallsAfterFirst,
      `the resume must reach FRESH work past the replayed ordinals (calls ${freshCallsAfterFirst} -> ${callsAfterResume})`,
    );
    // With the third round's re-review scripted PASS, the resumed run completes.
    assert.equal(resumed.ok, true, resumed.ok ? "" : `${resumed.error.code}:${resumed.error.message}`);
  } finally {
    if (saved === undefined) delete process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
    else process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = saved;
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
