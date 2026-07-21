import assert from "node:assert/strict";

import { ModelGatewayReviewEvaluator } from "../src/app/modelGatewayReviewEvaluator.js";
import { candidateManifestDigest, type CandidateManifestMetadata } from "../src/books/candidateDigest.js";
import type { CandidateSnapshot } from "../src/books/candidateTypes.js";
import type { ModelTaskContext } from "../src/contracts/v4Core.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../src/critics/bookPatternAudit.js";
import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";

const context: ModelTaskContext = {
  bookId: "review-book", runId: "run-1", attemptId: "attempt-1", stageId: "review",
  operationId: "canonical", workDir: "/tmp", signal: new AbortController().signal,
};
const chapter = makeChapter("review-book", 1);
const chapterBytes = Buffer.from(`${JSON.stringify(chapter)}\n`);
const auditBytes = Buffer.from(`${JSON.stringify(runBookPatternAudit({
  bookId: "review-book",
  chapters: [chapter],
  requirePlanArtifacts: false,
  checkSourceAlignment: false,
}))}\n`);
const files = [
  { kind: "CHAPTER" as const, logicalPath: "chapters/review-book-ch01.v21-native.chapter.json", mediaType: "application/json" as const, byteLength: chapterBytes.byteLength, bytes: chapterBytes },
  { kind: "SIDECAR" as const, logicalPath: BOOK_PATTERN_AUDIT_LOGICAL_PATH, mediaType: "application/json" as const, byteLength: auditBytes.byteLength, bytes: auditBytes },
];
const manifestMetadata: CandidateManifestMetadata = {
  schemaVersion: "1", bookId: "review-book", candidateId: "candidate-1", createdByRunId: "run-1",
  entries: files.map(({ bytes: _bytes, ...entry }) => entry),
  createdAt: "2026-07-21T00:00:00.000Z",
};
const candidate: CandidateSnapshot = {
  manifest: { ...manifestMetadata, manifestDigest: candidateManifestDigest(manifestMetadata, files) },
  files,
};

test("gateway review evaluator preserves PASS FAIL and ERROR model outcomes", async () => {
  for (const outcome of ["PASS", "FAIL", "ERROR"] as const) {
    let calls = 0;
    const evaluator = new ModelGatewayReviewEvaluator({
      async run(request) {
        calls += 1;
        assert.strictEqual(request.context, context);
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome, issues: [] } };
      },
    });
    assert.deepEqual(await evaluator.evaluate({ candidate, taskContext: context }), { ok: true, value: { outcome, issues: [] } });
    assert.equal(calls, 1);
  }
});

test("gateway review evaluator converts failed or invalid model results to errors", async () => {
  const failed = new ModelGatewayReviewEvaluator({
    async run() { return { attemptId: "attempt-1", outcome: "FAILED", error: { code: "DOWN", message: "offline" } }; },
  });
  assert.deepEqual(await failed.evaluate({ candidate, taskContext: context }), {
    ok: false, error: { code: "REVIEW_MODEL_FAILED", message: "DOWN:offline" },
  });
  const invalid = new ModelGatewayReviewEvaluator({
    async run() { return { attemptId: "attempt-1", outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [{ code: "B", severity: "BLOCKER", message: "bad" }] } }; },
  });
  assert.equal((await invalid.evaluate({ candidate, taskContext: context })).ok, false);
});
