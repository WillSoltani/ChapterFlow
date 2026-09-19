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

test("gateway review evaluator defaults to pipeline profile and accepts isolated-attempt profile", async () => {
  const profiles: string[] = [];
  const runner = {
    async run(request: Parameters<import("../src/app/modelTaskRunner.js").ModelTaskRunner["run"]>[0]) {
      profiles.push(request.profileId);
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED" as const, output: { outcome: "PASS", issues: [] } };
    },
  };
  assert.ok((await new ModelGatewayReviewEvaluator(runner).evaluate({ candidate, taskContext: context })).ok);
  assert.ok((await new ModelGatewayReviewEvaluator(runner, "attempt-read-json-v1").evaluate({ candidate, taskContext: context })).ok);
  assert.deepEqual(profiles, ["pipeline-read-json-v1", "attempt-read-json-v1"]);
  assert.throws(() => new ModelGatewayReviewEvaluator(runner, "unregistered-read-json" as never), /REVIEW_PROFILE_INVALID/);
});

test("gateway review packet contains ordered chapters plus one pattern audit only", async () => {
  const first = makeChapter("review-book", 1);
  const second = makeChapter("review-book", 2);
  const firstBytes = Buffer.from(`${JSON.stringify(first)}\n`);
  const secondBytes = Buffer.from(`${JSON.stringify(second)}\n`);
  const twoAuditBytes = Buffer.from(`${JSON.stringify(runBookPatternAudit({
    bookId: "review-book",
    chapters: [first, second],
    requirePlanArtifacts: false,
    checkSourceAlignment: false,
  }))}\n`);
  const privateBytes = Buffer.from('{"secret":"omit"}');
  const packetFiles = [
    { kind: "SIDECAR" as const, logicalPath: "compiler/private-task.json", mediaType: "application/json" as const, byteLength: privateBytes.byteLength, bytes: privateBytes },
    { kind: "CHAPTER" as const, logicalPath: "chapters/ch02.json", mediaType: "application/json" as const, byteLength: secondBytes.byteLength, bytes: secondBytes },
    { kind: "SIDECAR" as const, logicalPath: BOOK_PATTERN_AUDIT_LOGICAL_PATH, mediaType: "application/json" as const, byteLength: twoAuditBytes.byteLength, bytes: twoAuditBytes },
    { kind: "CHAPTER" as const, logicalPath: "chapters/ch01.json", mediaType: "application/json" as const, byteLength: firstBytes.byteLength, bytes: firstBytes },
  ];
  const metadata: CandidateManifestMetadata = {
    schemaVersion: "1", bookId: "review-book", candidateId: "candidate-ordered", createdByRunId: "run-1",
    entries: packetFiles.map(({ bytes: _bytes, ...entry }) => entry),
    createdAt: "2026-07-21T00:00:00.000Z",
  };
  const orderedCandidate: CandidateSnapshot = {
    manifest: { ...metadata, manifestDigest: candidateManifestDigest(metadata, packetFiles) },
    files: packetFiles,
  };
  let document = "";
  const evaluator = new ModelGatewayReviewEvaluator({
    async run(request) {
      document = new TextDecoder().decode(request.prompt.inputs.find((input) => input.name === "user_prompt")!.bytes);
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  });
  const evaluated = await evaluator.evaluate({ candidate: orderedCandidate, taskContext: context });
  assert.ok(evaluated.ok);
  assert.ok(document.indexOf("FILE chapters/ch01.json") < document.indexOf("FILE chapters/ch02.json"));
  assert.ok(document.indexOf("FILE chapters/ch02.json") < document.indexOf(`FILE ${BOOK_PATTERN_AUDIT_LOGICAL_PATH}`));
  assert.equal(document.includes("compiler/private-task.json"), false);
  assert.equal(document.includes("secret"), false);
});

/**
 * R-152 — the baseline reviewer's `code` had no enum and `parseIssue` accepted
 * any non-empty string, so the live Franklin reviews minted 40+ one-off codes
 * including POSITIVE ATTESTATIONS (CONTENT_VERIFIED_CONSISTENT,
 * PATTERN_AUDIT_CONFIRMS_CLEAN, CONTENT_REVIEWED_NO_INJECTION). Those became
 * REVIEW.* advisories in the QC round and were handed to repair as work.
 */
test("R-152: the baseline reviewer's issue codes are a closed list; an invented code lands on OTHER", async () => {
  const evaluator = new ModelGatewayReviewEvaluator({
    async run() {
      return {
        attemptId: "attempt-1",
        outcome: "SUCCEEDED",
        output: {
          outcome: "FAIL",
          issues: [
            { code: "STRUCTURAL_DEFECT", severity: "BLOCKER", message: "chapter 2 has no quiz" },
            { code: "CONTENT_VERIFIED_CONSISTENT", severity: "WARN", message: "content reads consistently" },
          ],
        },
      };
    },
  });
  const result = await evaluator.evaluate({ candidate, taskContext: context });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.ok);
  const [known, invented] = result.value.issues;
  assert.equal(known.code, "STRUCTURAL_DEFECT", "an in-enum code passes through unchanged");
  assert.equal(invented.code, "OTHER", `an invented code must not become its own class: ${JSON.stringify(invented)}`);
  // The raw code is evidence, not vocabulary: it survives on the message.
  assert.match(invented.message, /CONTENT_VERIFIED_CONSISTENT/, invented.message);
});

test("R-152: the reviewer prompt states the closed code list and forbids pass attestations", async () => {
  const prompts: string[] = [];
  const evaluator = new ModelGatewayReviewEvaluator({
    async run(request) {
      prompts.push(Buffer.from(request.prompt.inputs.find((input) => input.name === "system_prompt")!.bytes).toString("utf8"));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  });
  await evaluator.evaluate({ candidate, taskContext: context });
  assert.equal(prompts.length, 1);
  for (const code of ["STRUCTURAL_DEFECT", "OTHER"]) {
    assert.ok(prompts[0].includes(code), `the prompt must name the closed code ${code}`);
  }
  assert.match(prompts[0], /only defects/i, prompts[0]);
});

/**
 * R-287 — THE BASELINE REVIEWER JUDGES WHAT READERS SEE.
 *
 * Live Franklin (run book-run-39a37d06, review-120c5985fc3838d8d670bc914a22c450):
 * after six review-repair rounds the panel returned FAIL on ONE blocker,
 * PATTERN_AUDIT_DEFECT, whose whole case was `examples[*].planSpec.domain /
 * .audience / .stakes` recycling between chapters — authoring-internal planner
 * metadata that `promoteBook`/`stripInternalFields` delete before a package ever
 * ships and that no reader can see. The repair lane refuses that finding
 * (REVIEW_REPAIR_FINDING_UNSCOPED: compiler/context-owned), the stored FAIL
 * replays on every resume, and the book wedged.
 *
 * The reviewer was shown each chapter's RAW candidate JSON, so it was asked to
 * judge fields the product does not contain. It is now handed the SAME reader
 * projection the shipped package carries; the audit sidecar and the framing are
 * untouched.
 */
test("R-287: the reviewer packet carries the READER projection of each chapter, never planSpec or sourceAnchorId", async () => {
  const base = makeChapter("review-book", 1);
  const authored = {
    ...base,
    examples: base.examples.map((example, index) => ({ ...example, sourceAnchorId: `anchor-${index + 1}` })),
  } as unknown as typeof base;
  const authoredBytes = Buffer.from(`${JSON.stringify(authored, null, 2)}\n`);
  const authoredAuditBytes = Buffer.from(`${JSON.stringify(runBookPatternAudit({
    bookId: "review-book",
    chapters: [authored],
    requirePlanArtifacts: false,
    checkSourceAlignment: false,
  }), null, 2)}\n`);
  const authoredFiles = [
    { kind: "CHAPTER" as const, logicalPath: "content/chapters/review-book-ch01.v21-native.chapter.json", mediaType: "application/json" as const, byteLength: authoredBytes.byteLength, bytes: authoredBytes },
    { kind: "SIDECAR" as const, logicalPath: BOOK_PATTERN_AUDIT_LOGICAL_PATH, mediaType: "application/json" as const, byteLength: authoredAuditBytes.byteLength, bytes: authoredAuditBytes },
  ];
  const authoredMetadata: CandidateManifestMetadata = {
    schemaVersion: "1", bookId: "review-book", candidateId: "candidate-authored", createdByRunId: "run-1",
    entries: authoredFiles.map(({ bytes: _bytes, ...entry }) => entry),
    createdAt: "2026-09-19T00:00:00.000Z",
  };
  const authoredCandidate: CandidateSnapshot = {
    manifest: { ...authoredMetadata, manifestDigest: candidateManifestDigest(authoredMetadata, authoredFiles) },
    files: authoredFiles,
  };
  // The raw candidate DOES carry both internals — otherwise this test proves nothing.
  const raw = authoredBytes.toString("utf8");
  assert.ok(raw.includes("planSpec"), "fixture must carry planSpec");
  assert.ok(raw.includes("sourceAnchorId"), "fixture must carry sourceAnchorId");

  let document = "";
  const evaluator = new ModelGatewayReviewEvaluator({
    async run(request) {
      document = new TextDecoder().decode(request.prompt.inputs.find((input) => input.name === "user_prompt")!.bytes);
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  });
  const evaluated = await evaluator.evaluate({ candidate: authoredCandidate, taskContext: context });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(document.includes("planSpec"), false, "the reviewer must never be shown the planner's design rationale");
  assert.equal(document.includes("sourceAnchorId"), false, "the reviewer must never be shown gate-time provenance");
  // Reader content — and the framing, and the audit sidecar — survive intact.
  assert.ok(document.includes(`FILE ${authoredFiles[0].logicalPath} (application/json)`), document.slice(0, 200));
  assert.ok(document.includes(base.title), "the chapter title is reader content");
  assert.ok(document.includes(base.examples[0].whatToDo), "example prose is reader content");
  assert.ok(document.includes(authoredAuditBytes.toString("utf8").trimEnd()), "the pattern-audit sidecar is passed through verbatim");
});
