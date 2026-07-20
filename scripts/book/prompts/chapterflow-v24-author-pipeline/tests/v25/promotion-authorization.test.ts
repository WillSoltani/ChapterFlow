import assert from "node:assert/strict";

import { candidateManifestDigest } from "../../src/books/candidateDigest.js";
import type { BookContentReader, CandidateSnapshot, CandidateStore } from "../../src/books/candidateTypes.js";
import type { CurrentBookPointer, CurrentPointerStore } from "../../src/books/currentPointer.js";
import type { Result } from "../../src/contracts/v4Core.js";
import type { QcRoundResult, QcService } from "../../src/qc/qcTypes.js";
import { createPromotionService, type PromotionRequest } from "../../src/release/promotionService.js";
import type { CanonicalReviewResult, ReviewService } from "../../src/review/reviewTypes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const REVIEW_AT = "2026-07-20T12:00:01.000Z";
const QC_AT = "2026-07-20T12:00:02.000Z";
const PROMOTED_AT = "2026-07-20T12:00:03.000Z";
const CLOCK_AT = "2026-07-20T12:00:04.000Z";

function snapshot(bookId = "promotion-book", candidateId = "candidate-1", body = "chapter\n"): CandidateSnapshot {
  const bytes = Buffer.from(body, "utf8");
  const entries = [{
    kind: "CHAPTER" as const,
    logicalPath: "chapters/ch01.md",
    mediaType: "text/markdown" as const,
    byteLength: bytes.byteLength,
  }];
  const metadata = {
    schemaVersion: "1" as const,
    bookId,
    candidateId,
    createdByRunId: "run-promotion",
    entries,
    createdAt: "2026-07-20T12:00:00.000Z",
  };
  const manifestDigest = candidateManifestDigest(metadata, [{ bytes }]);
  return {
    manifest: { ...metadata, manifestDigest },
    files: [{ ...entries[0], bytes }],
  };
}

function requestFor(candidate: CandidateSnapshot, expectedBookRevision = 0): PromotionRequest {
  return {
    bookId: candidate.manifest.bookId,
    candidate: {
      candidateId: candidate.manifest.candidateId,
      manifestDigest: candidate.manifest.manifestDigest,
    },
    reviewId: "review-1",
    qcRoundId: "round-1",
    expectedBookRevision,
    promotedAt: PROMOTED_AT,
  };
}

function canonicalReview(request: PromotionRequest, outcome: "PASS" | "FAIL" | "ERROR" = "PASS"): CanonicalReviewResult {
  return {
    schemaVersion: "1",
    reviewId: request.reviewId,
    candidate: { ...request.candidate },
    outcome,
    issues: outcome === "PASS" ? [] : [{ code: `REVIEW_${outcome}`, severity: "BLOCKER", message: outcome }],
    completedAt: REVIEW_AT,
  };
}

function qcRound(request: PromotionRequest, outcome: "PASS" | "FAIL" | "ERROR" = "PASS"): QcRoundResult {
  return {
    schemaVersion: "1",
    roundId: request.qcRoundId,
    candidate: { ...request.candidate },
    reviewId: request.reviewId,
    outcome,
    issues: outcome === "PASS" ? [] : [{ code: `QC_${outcome}`, severity: "BLOCKER", message: outcome }],
    completedAt: QC_AT,
  };
}

type PortOverrides = {
  readonly candidate?: unknown;
  readonly review?: unknown;
  readonly qc?: unknown;
  readonly pointer?: unknown;
  readonly cas?: unknown;
  readonly readback?: unknown;
};

function selected(overrides: PortOverrides, key: keyof PortOverrides, fallback: unknown): unknown {
  return Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback;
}

function ports(candidate: CandidateSnapshot, overrides: PortOverrides = {}) {
  const request = requestFor(candidate);
  const storedReview = canonicalReview(request);
  const storedQc = qcRound(request);
  const calls = { candidate: 0, review: 0, qc: 0, pointerRead: 0, cas: 0, readback: 0 };
  let pointer: CurrentBookPointer | null = null;
  const candidateStore: CandidateStore = {
    stage: async () => { throw new Error("stage is outside promotion"); },
    open: async () => {
      calls.candidate += 1;
      return selected(overrides, "candidate", { ok: true, value: candidate }) as Result<CandidateSnapshot>;
    },
  };
  const reviewService: ReviewService = {
    screen: async () => { throw new Error("screen is outside promotion"); },
    reviewCanonical: async () => { throw new Error("review execution is outside promotion"); },
    get: async () => {
      calls.review += 1;
      return selected(overrides, "review", { ok: true, value: storedReview }) as Result<CanonicalReviewResult>;
    },
  };
  const qcService: QcService = {
    readStatus: async () => { throw new Error("status is outside promotion"); },
    runFresh: async () => { throw new Error("QC execution is outside promotion"); },
    getRound: async () => {
      calls.qc += 1;
      return selected(overrides, "qc", { ok: true, value: storedQc }) as Result<QcRoundResult>;
    },
    diagnose: async () => { throw new Error("diagnosis is outside promotion"); },
    repairLedger: async () => { throw new Error("repair is outside promotion"); },
  };
  const currentPointerStore: CurrentPointerStore = {
    read: async () => {
      calls.pointerRead += 1;
      return selected(overrides, "pointer", { ok: true, value: pointer }) as Result<CurrentBookPointer | null>;
    },
    compareAndSet: async ({ expectedRevision, next }) => {
      calls.cas += 1;
      if (Object.prototype.hasOwnProperty.call(overrides, "cas")) {
        return overrides.cas as Result<CurrentBookPointer>;
      }
      const actual = pointer?.revision ?? 0;
      if (actual !== expectedRevision) {
        return { ok: false, error: { code: "REVISION_CONFLICT", message: "conflict", retryable: true } };
      }
      pointer = { ...next };
      return { ok: true, value: { ...next } };
    },
  };
  const contentReader: BookContentReader = {
    open: async () => {
      calls.readback += 1;
      return selected(overrides, "readback", {
        ok: true,
        value: {
          manifest: candidate.manifest,
          files: candidate.files,
          currentRevision: pointer?.revision,
        },
      }) as Result<CandidateSnapshot>;
    },
  };
  const service = createPromotionService({
    candidateStore,
    contentReader,
    reviewService,
    qcService,
    currentPointerStore,
    clock: () => CLOCK_AT,
  });
  return { calls, request, service };
}

function assertErrorCode(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

requiredTest("matching immutable candidate canonical PASS and fresh QC PASS authorize one verified promotion", async () => {
  const candidate = snapshot();
  const fixture = ports(candidate);
  const result = await fixture.service.promote(fixture.request);
  assert.deepEqual(result, {
    ok: true,
    value: {
      bookId: fixture.request.bookId,
      candidate: fixture.request.candidate,
      bookRevision: 1,
      readback: "VERIFIED",
      promotedAt: PROMOTED_AT,
    },
  });
  assert.deepEqual(fixture.calls, { candidate: 1, review: 1, qc: 1, pointerRead: 1, cas: 1, readback: 1 });
});

requiredTest("invalid requests aliases and malformed ports fail closed before unsafe continuation", async () => {
  const candidate = snapshot();
  const invalid = ports(candidate);
  const malformed = { ...invalid.request, expectedBookRevision: -1 };
  assertErrorCode(await invalid.service.promote(malformed), "PROMOTION_INVALID");
  assert.deepEqual(invalid.calls, { candidate: 0, review: 0, qc: 0, pointerRead: 0, cas: 0, readback: 0 });

  const coercible = ports(candidate);
  const coercibleDigest = {
    ...coercible.request,
    candidate: {
      candidateId: coercible.request.candidate.candidateId,
      manifestDigest: { toString: () => coercible.request.candidate.manifestDigest },
    },
  } as unknown as PromotionRequest;
  assertErrorCode(await coercible.service.promote(coercibleDigest), "PROMOTION_INVALID");
  assert.deepEqual(coercible.calls, { candidate: 0, review: 0, qc: 0, pointerRead: 0, cas: 0, readback: 0 });

  const overflow = ports(candidate);
  assertErrorCode(
    await overflow.service.promote({ ...overflow.request, expectedBookRevision: Number.MAX_SAFE_INTEGER }),
    "PROMOTION_INVALID",
  );
  assert.deepEqual(overflow.calls, { candidate: 0, review: 0, qc: 0, pointerRead: 0, cas: 0, readback: 0 });

  const fixture = ports(candidate);
  const mutable = fixture.request as unknown as {
    bookId: string;
    candidate: { candidateId: string; manifestDigest: string };
    reviewId: string;
    qcRoundId: string;
    expectedBookRevision: number;
    promotedAt: string;
  };
  const pending = fixture.service.promote(mutable);
  mutable.bookId = "mutated-book";
  mutable.candidate.candidateId = "mutated-candidate";
  mutable.candidate.manifestDigest = "f".repeat(64);
  mutable.reviewId = "mutated-review";
  mutable.qcRoundId = "mutated-round";
  mutable.expectedBookRevision = 99;
  mutable.promotedAt = "2026-07-20T12:00:04.000Z";
  assert.equal((await pending).ok, true);
  await assertMalformedPortBoundaries(candidate);
  await assertCasSuccessValidation(candidate);
});

requiredTest("screening missing non-PASS or mismatched canonical review writes zero pointer bytes", async () => {
  const candidate = snapshot();
  const baseline = requestFor(candidate);
  const screening = {
    candidate: { ...baseline.candidate },
    outcome: "SHORTLIST" as const,
    issues: [],
  } as unknown as CanonicalReviewResult;
  const mismatched = canonicalReview(baseline);
  const cases: Array<[string, Result<CanonicalReviewResult>, string]> = [
    ["screening", { ok: true, value: screening }, "REVIEW_MISMATCH"],
    ["missing", { ok: false, error: { code: "REVIEW_NOT_FOUND", message: "missing" } }, "REVIEW_NOT_FOUND"],
    ["fail", { ok: true, value: canonicalReview(baseline, "FAIL") }, "REVIEW_NOT_PROMOTABLE"],
    ["error", { ok: true, value: canonicalReview(baseline, "ERROR") }, "REVIEW_NOT_PROMOTABLE"],
    ["mismatch", { ok: true, value: { ...mismatched, candidate: { ...mismatched.candidate, candidateId: "other" } } }, "REVIEW_MISMATCH"],
  ];
  for (const [label, review, code] of cases) {
    const fixture = ports(candidate, { review });
    assertErrorCode(await fixture.service.promote(fixture.request), code);
    assert.equal(fixture.calls.cas, 0, label);
    assert.equal(fixture.calls.qc, 0, label);
    assert.equal(fixture.calls.readback, 0, label);
  }
});

requiredTest("missing non-PASS stale or mismatched QC writes zero pointer bytes", async () => {
  const candidate = snapshot();
  const baseline = requestFor(candidate);
  const matching = qcRound(baseline);
  const cases: Array<[string, Result<QcRoundResult>, string]> = [
    ["missing", { ok: false, error: { code: "QC_ROUND_NOT_FOUND", message: "missing" } }, "QC_ROUND_NOT_FOUND"],
    ["fail", { ok: true, value: qcRound(baseline, "FAIL") }, "QC_NOT_PROMOTABLE"],
    ["error", { ok: true, value: qcRound(baseline, "ERROR") }, "QC_NOT_PROMOTABLE"],
    ["stale", { ok: true, value: { ...matching, completedAt: REVIEW_AT } }, "QC_STALE"],
    ["candidate mismatch", { ok: true, value: { ...matching, candidate: { ...matching.candidate, manifestDigest: "f".repeat(64) } } }, "QC_MISMATCH"],
    ["review mismatch", { ok: true, value: { ...matching, reviewId: "other-review" } }, "QC_MISMATCH"],
  ];
  for (const [label, qc, code] of cases) {
    const fixture = ports(candidate, { qc });
    assertErrorCode(await fixture.service.promote(fixture.request), code);
    assert.equal(fixture.calls.cas, 0, label);
    assert.equal(fixture.calls.pointerRead, 0, label);
    assert.equal(fixture.calls.readback, 0, label);
  }
});

requiredTest("missing or checksum-drifted candidate blocks before authority and compare-and-set", async () => {
  const candidate = snapshot();
  const missing = ports(candidate, { candidate: { ok: false, error: { code: "CANDIDATE_NOT_FOUND", message: "missing" } } });
  assertErrorCode(await missing.service.promote(missing.request), "CANDIDATE_NOT_FOUND");
  assert.deepEqual(missing.calls, { candidate: 1, review: 0, qc: 0, pointerRead: 0, cas: 0, readback: 0 });

  const drifted = snapshot();
  const driftedFiles = [{ ...drifted.files[0], bytes: Buffer.from("drifted\n", "utf8") }];
  const mismatch = ports(candidate, { candidate: { ok: true, value: { ...drifted, files: driftedFiles } } });
  assertErrorCode(await mismatch.service.promote(mismatch.request), "CANDIDATE_MISMATCH");
  assert.deepEqual(mismatch.calls, { candidate: 1, review: 0, qc: 0, pointerRead: 0, cas: 0, readback: 0 });
});

async function assertMalformedPortBoundaries(candidate: CandidateSnapshot): Promise<void> {
  const malformedValues: Array<[string, unknown]> = [
    ["null envelope", null],
    ["malformed PortError", { ok: false, error: { code: 7, message: { unsafe: true } } }],
  ];
  const boundaries: Array<{
    readonly key: keyof PortOverrides;
    readonly code: string;
    readonly message: string;
    readonly expectedCalls: Readonly<Record<keyof ReturnType<typeof ports>["calls"], number>>;
  }> = [
    {
      key: "candidate",
      code: "CANDIDATE_UNAVAILABLE",
      message: "candidate store returned an invalid Result",
      expectedCalls: { candidate: 1, review: 0, qc: 0, pointerRead: 0, cas: 0, readback: 0 },
    },
    {
      key: "review",
      code: "REVIEW_UNAVAILABLE",
      message: "review service returned an invalid Result",
      expectedCalls: { candidate: 1, review: 1, qc: 0, pointerRead: 0, cas: 0, readback: 0 },
    },
    {
      key: "qc",
      code: "QC_UNAVAILABLE",
      message: "QC service returned an invalid Result",
      expectedCalls: { candidate: 1, review: 1, qc: 1, pointerRead: 0, cas: 0, readback: 0 },
    },
    {
      key: "pointer",
      code: "REVISION_UNAVAILABLE",
      message: "current pointer store returned an invalid Result",
      expectedCalls: { candidate: 1, review: 1, qc: 1, pointerRead: 1, cas: 0, readback: 0 },
    },
    {
      key: "cas",
      code: "RECONCILIATION_REQUIRED",
      message: "current pointer commit returned an invalid Result",
      expectedCalls: { candidate: 1, review: 1, qc: 1, pointerRead: 1, cas: 1, readback: 0 },
    },
    {
      key: "readback",
      code: "RECONCILIATION_REQUIRED",
      message: "post-commit CURRENT readback returned an invalid Result",
      expectedCalls: { candidate: 1, review: 1, qc: 1, pointerRead: 1, cas: 1, readback: 1 },
    },
  ];

  for (const boundary of boundaries) {
    for (const [shape, malformed] of malformedValues) {
      const fixture = ports(candidate, { [boundary.key]: malformed });
      const result = await fixture.service.promote(fixture.request);
      assert.equal(result.ok, false, `${boundary.key} ${shape}`);
      if (!result.ok) {
        assert.equal(result.error.code, boundary.code, `${boundary.key} ${shape}`);
        assert.equal(result.error.message, boundary.message, `${boundary.key} ${shape}`);
        assert.equal(typeof result.error.code, "string");
        assert.equal(typeof result.error.message, "string");
      }
      assert.deepEqual(fixture.calls, boundary.expectedCalls, `${boundary.key} ${shape}`);
    }
  }
}

async function assertCasSuccessValidation(candidate: CandidateSnapshot): Promise<void> {
  const baseline = requestFor(candidate);
  const expected = {
    schemaVersion: "1" as const,
    bookId: baseline.bookId,
    candidateId: baseline.candidate.candidateId,
    manifestDigest: baseline.candidate.manifestDigest,
    revision: 1,
    updatedAt: baseline.promotedAt,
  };
  const cases: Array<[string, unknown]> = [
    ["unknown key", { ok: true, value: { ...expected, unexpected: true } }],
    ["wrong identity", { ok: true, value: { ...expected, candidateId: "candidate-other" } }],
    ["null success", { ok: true, value: null }],
  ];
  for (const [label, cas] of cases) {
    const fixture = ports(candidate, { cas });
    const result = await fixture.service.promote(fixture.request);
    assertErrorCode(result, "RECONCILIATION_REQUIRED");
    assert.equal(fixture.calls.cas, 1, label);
    assert.equal(fixture.calls.readback, 0, label);
  }
}

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
