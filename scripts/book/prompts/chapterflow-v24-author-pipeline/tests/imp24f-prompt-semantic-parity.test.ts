import assert from "node:assert/strict";

import { REVIEW_FACTORS } from "../src/artifacts/artifactTypes.js";
import {
  READER_ADVISORY_CATEGORIES,
  READER_BLOCKING_CATEGORIES,
  READER_ESCALATION_CATEGORIES,
} from "../src/contracts/readerExperienceReview.js";
import {
  IMP24_SEMANTIC_PROMPT_HASHES,
  buildImp24RolePromptSourceHashes,
} from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import { buildQuizIntegrityAdjudicationTask } from "../src/review/quizIntegrityReview.js";
import {
  QUIZ_INTEGRITY_SEMANTIC_RULES_VERSION,
  QUIZ_INTEGRITY_SEMANTIC_SHA256,
  renderQuizIntegritySemanticRules,
} from "../src/review/quizIntegritySemanticRules.js";
import { buildReaderExperienceTask } from "../src/review/readerExperienceReview.js";
import {
  READER_EXPERIENCE_FACTOR_DEFINITIONS,
  READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION,
  READER_EXPERIENCE_SEMANTIC_SHA256,
  renderReaderExperienceSemanticRubric,
} from "../src/review/readerExperienceSemanticRubric.js";
import { createReviewEvidenceEnvelope } from "../src/review/reviewEvidenceEnvelope.js";
import {
  buildQuizIntegrityInlineReviewTask,
  buildReaderExperienceInlineReviewTask,
  buildSourceIntegrityInlineReviewTask,
} from "../src/review/reviewModelOutputV2.js";
import {
  buildSourceIntegrityTask,
  type SourceReviewPacketV1,
} from "../src/review/sourceIntegrityReview.js";
import {
  SOURCE_INTEGRITY_SEMANTIC_RULES_VERSION,
  SOURCE_INTEGRITY_SEMANTIC_SHA256,
  renderSourceIntegritySemanticRules,
} from "../src/review/sourceIntegritySemanticRules.js";
import { test } from "./harness.js";

function occurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function envelope(lane: "reader" | "source" | "quiz") {
  const segments = lane === "reader"
    ? [{ refId: "RD-001", kind: "chapter" as const, text: "Deterministic semantic-parity fixture evidence." }]
    : lane === "source"
      ? [
        { refId: "CH-001", kind: "chapter" as const, text: "Deterministic candidate claim." },
        { refId: "PLAN-001", kind: "plan" as const, text: "Deterministic source-use license." },
        { refId: "SRC-001", kind: "source_claim" as const, text: "Deterministic supporting source claim." },
      ]
      : [
        { refId: "CH-001", kind: "chapter" as const, text: "The key-free chapter mechanism." },
        { refId: "Q001-PROMPT", kind: "quiz_prompt" as const, text: "Which choice follows?" },
        { refId: "Q001-CHOICE-000", kind: "quiz_choice" as const, text: "0: First choice." },
        { refId: "Q001-DERIVATION", kind: "quiz_derivation" as const, text: "Committed blind derivation." },
        { refId: "Q001-KEY", kind: "quiz_key" as const, text: "Stored key: 0." },
        { refId: "Q001-EXPLANATION", kind: "quiz_explanation" as const, text: "Stored explanation." },
      ];
  return createReviewEvidenceEnvelope({
    lane,
    envelopeId: `${lane}-semantic-parity`,
    caseId: `${lane}-semantic-parity-case`,
    instrumentVersion: "imp24f-semantic-parity",
    segments,
  });
}

const SOURCE_PACKET: SourceReviewPacketV1 = {
  role: "source-verifier",
  chapterDocument: "A key-free deterministic source-parity fixture.",
  sourcePlanLicense: ["fixture license"],
  sourcePacket: {} as SourceReviewPacketV1["sourcePacket"],
  sourceSidecar: {},
  anchorCatalog: [],
  requiredSourceUnitIds: ["fixture-unit"],
};

test("IMP-24F reader production and qualification tasks share one semantic projection", () => {
  const marker = `READER SEMANTIC RUBRIC ${READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION} (sha256 ${READER_EXPERIENCE_SEMANTIC_SHA256})`;
  const production = buildReaderExperienceTask("reader.md");
  const qualification = buildReaderExperienceInlineReviewTask(envelope("reader"));

  assert.equal(occurrences(production, marker), 1);
  assert.equal(occurrences(qualification, marker), 1);
  assert.ok(production.includes(renderReaderExperienceSemanticRubric()));
  assert.ok(qualification.includes(renderReaderExperienceSemanticRubric()));
  assert.match(qualification, /0-100/);
  for (const factor of REVIEW_FACTORS) {
    assert.ok(READER_EXPERIENCE_FACTOR_DEFINITIONS[factor].length > 0);
    assert.ok(qualification.includes(`- ${factor}: ${READER_EXPERIENCE_FACTOR_DEFINITIONS[factor]}.`));
  }
  for (const category of [...READER_BLOCKING_CATEGORIES, ...READER_ESCALATION_CATEGORIES, ...READER_ADVISORY_CATEGORIES]) {
    assert.ok(qualification.includes(category), `shared reader authority/category missing ${category}`);
  }
  assert.match(qualification, /evidenceRefIds/);
  assert.match(production, /evidenceSpans/);
});

test("IMP-24F source production and qualification tasks share one semantic projection", () => {
  const marker = `SOURCE SEMANTIC RULES ${SOURCE_INTEGRITY_SEMANTIC_RULES_VERSION} (sha256 ${SOURCE_INTEGRITY_SEMANTIC_SHA256})`;
  const production = buildSourceIntegrityTask(SOURCE_PACKET, {
    outputSchemaRelPath: "source.schema.json",
    schemaSha256: "a".repeat(64),
  }).task;
  const qualification = buildSourceIntegrityInlineReviewTask(envelope("source"));

  assert.equal(occurrences(production, marker), 1);
  assert.equal(occurrences(qualification, marker), 1);
  assert.ok(production.includes(renderSourceIntegritySemanticRules()));
  assert.ok(qualification.includes(renderSourceIntegritySemanticRules()));
  assert.match(qualification, /only review lane allowed to judge external factual truth/i);
  assert.match(qualification, /INCONCLUSIVE.*missing/i);
  assert.match(qualification, /invented_dialogue/);
  assert.match(qualification, /fabricated_statistic/);
  assert.match(qualification, /chapterEvidenceRefIds and sourceEvidenceRefIds/);
  assert.match(production, /chapterEvidenceSpans, sourceEvidenceSpans/);
});

test("IMP-24F quiz audit proves a material mismatch required a shared successor identity", () => {
  const marker = `QUIZ SEMANTIC RULES ${QUIZ_INTEGRITY_SEMANTIC_RULES_VERSION} (sha256 ${QUIZ_INTEGRITY_SEMANTIC_SHA256})`;
  const production = buildQuizIntegrityAdjudicationTask("quiz.md");
  const qualification = buildQuizIntegrityInlineReviewTask(envelope("quiz"));

  assert.equal(occurrences(production, marker), 1);
  assert.equal(occurrences(qualification, marker), 1);
  assert.ok(production.includes(renderQuizIntegritySemanticRules()));
  assert.ok(qualification.includes(renderQuizIntegritySemanticRules()));
  assert.match(qualification, /EVIDENCE, not authority/);
  assert.match(qualification, /defensibleAnswerIndices/);
  assert.match(qualification, /keyedMechanismSupported/);
});

test("IMP-24F semantic rendering is deterministic and semantic drift stales only its lane identity", () => {
  assert.equal(renderReaderExperienceSemanticRubric(), renderReaderExperienceSemanticRubric());
  assert.equal(renderSourceIntegritySemanticRules(), renderSourceIntegritySemanticRules());
  assert.equal(renderQuizIntegritySemanticRules(), renderQuizIntegritySemanticRules());

  const moduleSha256 = "f".repeat(64);
  const baseline = buildImp24RolePromptSourceHashes({ moduleSha256 });
  const changed = buildImp24RolePromptSourceHashes({
    moduleSha256,
    semantic: {
      ...IMP24_SEMANTIC_PROMPT_HASHES,
      reader: { ...IMP24_SEMANTIC_PROMPT_HASHES.reader, sha256: "e".repeat(64) },
    },
  });
  assert.notEqual(changed.reader, baseline.reader, "semantic drift must stale retained reader qualification evidence");
  assert.equal(changed.source, baseline.source);
  assert.equal(changed.quiz, baseline.quiz);
});
