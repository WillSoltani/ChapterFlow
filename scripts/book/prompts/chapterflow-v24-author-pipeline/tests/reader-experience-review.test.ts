/**
 * IMP-20 §A — reader-experience lane (WP-B1).
 *
 * Pins the three reader-lane prompt/schema invariants (the E-01 fix):
 *  - test 1: the reader prompt CANNOT declare external fabrication — there is no
 *    `mustFix` mechanism and no external source-truth blocking category the
 *    reader may emit; the authority-limit disclaimer is present.
 *  - test 2: the reader prompt CAN emit `origin_ambiguous_to_reader` for a
 *    passage that reads as factual but whose status is unclear.
 *  - test 3: the frozen A1 reader schema REJECTS source-truth blocker categories
 *    (fabricated / factually_wrong / source_contradictory) while accepting the
 *    on-page-decidable ones (e.g. internal_contradiction).
 *
 * Also exercises the model-free lane runner over an injected reviewFn (no live
 * model call) to confirm build→parse→assemble→validate composes.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  READER_ADVISORY_CATEGORIES,
  READER_BLOCKING_CATEGORIES,
  READER_ESCALATION_CATEGORIES,
  READER_EXPERIENCE_RUBRIC_VERSION,
  type ReaderExperienceReviewV1,
  validateReaderExperienceReview,
} from "../src/contracts/readerExperienceReview.js";
import {
  assembleReaderExperienceReview,
  buildReaderExperienceTask,
  parseReaderExperienceReview,
  runReaderExperienceReview,
} from "../src/review/readerExperienceReview.js";

// ── a canonical schema-valid model output (the 10 model-emitted fields) ───────

function validModelOutput(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "reader-experience-review-v1",
    scores: {
      retention: 82, quizzes: 80, transfer: 78, practical: 81, summaries: 79,
      tone: 83, limits: 77, insight: 80, density: 76, beginner: 84,
    },
    quizDerivation: {
      answers: ["a", "b", "c"],
      mechanisms: ["m1", "m2", "m3"],
      confidence: ["high", "medium", "high"],
      ambiguities: ["", "", ""],
      tells: [],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidence: ["a strong verbatim line"],
    weakestEvidence: [],
    oneParagraphVerdict: "Solid on-page chapter.",
    ...over,
  };
}

const BINDINGS = {
  chapterContentSha256: "c".repeat(64),
  readerDocumentSha256: "d".repeat(64),
  schemaSha256: "s".repeat(64),
};

// ── test 1 — reader prompt cannot declare external fabrication ─────────────────

test("1: reader prompt grants NO external-fabrication / mustFix blocking authority", () => {
  const task = buildReaderExperienceTask("workspace/ch01.phase1.md");

  // The legacy severity mechanism is gone: no `mustFix` anywhere in the prompt.
  assert.ok(!/mustFix/i.test(task), "prompt must not contain the legacy mustFix mechanism");

  // The dropped external source-truth blocking categories never appear as
  // emittable category tokens.
  for (const dropped of ["factually_wrong", "source_contradictory", "fabricated_example"]) {
    assert.ok(!task.includes(dropped), `prompt must not offer a "${dropped}" category`);
  }

  // The blocking-category enumeration the prompt offers is EXACTLY the five
  // on-page-decidable categories (no source-truth category among them).
  const blockingEnum = READER_BLOCKING_CATEGORIES.join("|");
  assert.ok(task.includes(blockingEnum), "prompt must enumerate the on-page blocking categories");
  for (const forbidden of ["fabricated", "factually_wrong", "source_contradictory"]) {
    assert.ok(
      !READER_BLOCKING_CATEGORIES.includes(forbidden as never),
      `"${forbidden}" must not be an on-page blocking category`,
    );
  }

  // And the authority-limit disclaimer is present verbatim: the reader may not
  // decide external factual truth.
  assert.ok(
    task.includes("You may not determine whether an external"),
    "prompt must state the source-truth authority limit",
  );
});

// ── test 2 — reader prompt CAN emit origin_ambiguous_to_reader ────────────────

test("2: reader prompt instructs origin_ambiguous_to_reader for unclear factual status", () => {
  const task = buildReaderExperienceTask("workspace/ch01.phase1.md");
  assert.ok(
    READER_ESCALATION_CATEGORIES.includes("origin_ambiguous_to_reader"),
    "origin_ambiguous_to_reader must be an escalation category",
  );
  assert.ok(
    task.includes("origin_ambiguous_to_reader"),
    "prompt must offer the origin_ambiguous_to_reader escalation signal",
  );
  assert.ok(
    task.includes("reads as factual but its status is unclear"),
    "prompt must tell the reader WHEN to emit origin_ambiguous_to_reader",
  );
});

// ── test 3 — reader schema rejects source-truth blocker categories ─────────────

test("3: reader schema rejects source-truth blocker categories, accepts on-page ones", () => {
  // A blockingFinding in a dropped external source-truth category is rejected.
  for (const badCategory of ["fabricated", "factually_wrong", "source_contradictory"]) {
    const record = assembleValid({
      blockingFindings: [
        { category: badCategory, unit: "example 2", problem: "invented event", evidenceSpans: [] },
      ],
    });
    const errors = validateReaderExperienceReview(record);
    assert.ok(
      errors.some((e) => e.includes("blockingFindings") && e.toLowerCase().includes("category")),
      `category "${badCategory}" must be rejected as an unknown blocking category`,
    );
  }

  // An on-page-decidable blocking category is accepted.
  const good = assembleValid({
    recommendation: "BLOCK",
    blockingFindings: [
      {
        category: "internal_contradiction",
        unit: "deep read",
        problem: "the chapter contradicts its own earlier claim",
        evidenceSpans: ["says X here", "says not-X there"],
      },
    ],
  });
  assert.deepEqual(validateReaderExperienceReview(good), [], "on-page blocking category must validate");

  // Sanity: every declared advisory category is a legal advisory value.
  for (const c of READER_ADVISORY_CATEGORIES) {
    const rec = assembleValid({ advisoryFindings: [{ category: c, unit: "u", problem: "p", evidenceSpans: [] }] });
    assert.deepEqual(validateReaderExperienceReview(rec), [], `advisory category "${c}" must validate`);
  }
});

/** Build a full, stamped, schema-valid ReaderExperienceReviewV1 (then optionally
 *  mutated by the caller's override) WITHOUT going through the throwing
 *  assemble path, so a test can validate a deliberately-invalid record. */
function assembleValid(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "reader-experience-review-v1",
    reviewerRole: "reader-experience",
    chapterContentSha256: BINDINGS.chapterContentSha256,
    readerDocumentSha256: BINDINGS.readerDocumentSha256,
    rubricVersion: READER_EXPERIENCE_RUBRIC_VERSION,
    schemaSha256: BINDINGS.schemaSha256,
    ...validModelOutput(),
    ...over,
  };
}

// ── lane composition (model-free) ─────────────────────────────────────────────

test("reader lane: build→parse→assemble→validate composes over an injected reviewFn (no model call)", async () => {
  const canned = "```json\n" + JSON.stringify(validModelOutput()) + "\n```";
  let sawTask = "";
  const record = await runReaderExperienceReview(
    { docRelPath: "workspace/ch01.phase1.md", ...BINDINGS },
    { reviewFn: async (task) => { sawTask = task; return canned; } },
  );
  assert.ok(sawTask.includes("READER-EXPERIENCE REVIEW"), "reviewFn received the built reader task");
  assert.equal(record.schema, "reader-experience-review-v1");
  assert.equal(record.reviewerRole, "reader-experience");
  assert.equal(record.rubricVersion, READER_EXPERIENCE_RUBRIC_VERSION);
  assert.equal(record.chapterContentSha256, BINDINGS.chapterContentSha256);
  assert.equal(record.readerDocumentSha256, BINDINGS.readerDocumentSha256);
  assert.equal(record.schemaSha256, BINDINGS.schemaSha256);
  assert.deepEqual(validateReaderExperienceReview(record as unknown as Record<string, unknown>), []);
  // The stamped record carries no legacy ship bit.
  assert.ok(!("ship84" in (record as Record<string, unknown>)), "new record must not carry ship84");
});

test("reader lane: a malformed reviewer output fails closed (no self-attested pass)", async () => {
  const bad = "```json\n" + JSON.stringify(validModelOutput({ recommendation: "MAYBE" })) + "\n```";
  await assert.rejects(
    () => runReaderExperienceReview({ docRelPath: "d.md", ...BINDINGS }, { reviewFn: async () => bad }),
    /not schema-valid/,
  );
  // No fenced JSON at all → also fails closed.
  await assert.rejects(
    () => runReaderExperienceReview({ docRelPath: "d.md", ...BINDINGS }, { reviewFn: async () => "no json here" }),
    /no parseable fenced JSON/,
  );
});

test("parseReaderExperienceReview takes the last json-labelled fence, null on none", () => {
  assert.equal(parseReaderExperienceReview("plain text"), null);
  const two = "```json\n{\"a\":1}\n```\nnoise\n```json\n{\"b\":2}\n```";
  assert.deepEqual(parseReaderExperienceReview(two), { b: 2 });
  // assemble throws on a partial object (missing required fields).
  assert.throws(() => assembleReaderExperienceReview({ schema: "reader-experience-review-v1" }, BINDINGS), /not schema-valid/);
});
