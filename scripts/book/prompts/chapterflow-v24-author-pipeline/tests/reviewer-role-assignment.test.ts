/**
 * IMP-20 WP-B5 — fixed judge assignment (design §G) replaces the §16 harness's
 * execution-order rotation (baseline E-06).
 *
 * Unit test 23: the primary judge is a pure function of the sealed spec — the
 *   SAME across every candidate cell, never rotated by execution order.
 * Unit test 24: the backup / audit read is drawn from a FROZEN, BALANCED subset
 *   that is deterministic and output-independent — never chosen after seeing a
 *   candidate's result.
 * Integration 6: the same fixed primary judge reads all four cells end to end.
 * Integration 7: the fixed backup read lands only on the frozen audit subset.
 */

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import {
  assignFixedRoles,
  isInFrozenAuditSubset,
  QUIZ_DETERMINISTIC_CHECKER_VERSION,
} from "../src/bakeoff/migration/reviewerRoleAssignment.js";
import { panelAssignment, reviewOneSample } from "../src/bakeoff/migration/reviewRunner.js";
import { MigrationGuardError, rootedWrite } from "../src/bakeoff/migration/guards.js";
import { qualificationPath, DEFAULT_QUAL_THRESHOLDS } from "../src/bakeoff/migration/qualification.js";
import { sampleRecordPath } from "../src/bakeoff/migration/sampleRunner.js";
import { READER_RUBRIC_VERSION, REVIEW_DOC_HASH_VERSION } from "../src/review/readerReview.js";
import { pipelineRel } from "../src/bakeoff/paths.js";
import type {
  ExperimentSpecV1,
  MigrationReviewSummaryV1,
  MigrationSampleRecordV1,
} from "../src/bakeoff/migration/experimentTypes.js";
import type { ChapterReviewV1 } from "../src/artifacts/artifactTypes.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { confirmatorySpec, mkSealFixture } from "./migration-helpers.js";
import { fixtureChapter, fakeAutopilotDeps } from "./model-bakeoff-helpers.js";

const TWO_JUDGE_PANEL = [
  { model: "gpt-5.5", effort: "high" as const },
  { model: "gpt-5.6-sol", effort: "xhigh" as const },
];

function mkRecord(over: Partial<MigrationSampleRecordV1> = {}): MigrationSampleRecordV1 {
  return {
    schema: "migration-sample-record-v1",
    experimentId: "exp-role",
    stage: "confirmatory",
    blindSampleId: "aaaaaaaaaaaa",
    cellId: "55-H",
    bookId: "zz-mig-book-a",
    chapterNumber: 1,
    stratum: "research-heavy",
    sampleIndex: 1,
    executionOrder: 0,
    outcome: {
      providerOutcome: "content_completed",
      replayed: false,
      firstWriteDeterministicPass: true,
      durationMs: 1,
      writerSessionIds: ["w"],
    },
    artifact: { contentSha256: "0".repeat(64), chapterRelPath: "x/x.chapter.json" },
    critics: { c37Overreach: 0, c37SceneCompletion: 0, c37GenericLeak: 0, registerAdvisories: 0, causalClaims: 0, diversity: null },
    review: null,
    tokens: null,
    unavailableFields: ["tokens"],
    recordedAt: "2026-07-10T00:00:00.000Z",
    ...over,
  };
}

const FAKE_REVIEW_SUMMARY: MigrationReviewSummaryV1 = {
  composite: 50,
  ship: false,
  keysClean: false,
  valid: true,
  pass: false,
  quizAdjudicationStatus: "adjudicated",
  complaintsMustFix: 3,
  reviewerSessionId: "r",
  judgeModel: "gpt-5.5",
  judgeEffort: "high",
};

function writePanelQualifications(roots: ReturnType<typeof mkSealFixture>["roots"], spec: ExperimentSpecV1): void {
  for (const judge of spec.judgePanel) {
    const q = {
      schema: "migration-judge-qualification-v1", judge, corpusId: "c", corpusSha256: "0".repeat(64),
      instrumentVersions: { readerRubricVersion: READER_RUBRIC_VERSION, reviewDocHashVersion: REVIEW_DOC_HASH_VERSION },
      scoredAt: "2026-07-10T00:00:00.000Z", perClass: [], falsePositiveRate: 0, evidenceQuoteValidityRate: 1,
      schemaValidityRate: 1, injectionResistanceRate: 1, thresholds: DEFAULT_QUAL_THRESHOLDS, qualified: true,
      labelProvenance: { human: 0, synthetic: 9 }, dryRunOnly: true,
    };
    rootedWrite(roots, qualificationPath(roots, judge as { model: string; effort: "high" }), JSON.stringify(q, null, 2));
  }
}

function mkFakeReview(reads: string[]): typeof import("../src/orchestrator/authorReview.js").reviewOneChapter {
  return (async (_b, _c, _d, _io, _bar, labelSuffix) => {
    reads.push(String(labelSuffix));
    return {
      composite: 88, ship84: true, keyCheck: { matches: 3, of: 3 }, valid: true, pass: true,
      complaints: [], quotes: [], tells: [], oneParagraphVerdict: "PASS", reviewerSessionId: `r${reads.length}`,
      quizAdjudication: { status: "adjudicated" },
    } as unknown as ChapterReviewV1;
  }) as typeof import("../src/orchestrator/authorReview.js").reviewOneChapter;
}

// ── Unit test 23 — fixed primary invariant across cells ───────────────────────

test("23: assignFixedRoles pins ONE primary judge for every cell — no execution-order rotation", () => {
  const spec = confirmatorySpec({ judgePanel: TWO_JUDGE_PANEL });
  const cells = ["55-H", "55-XH", "56S-H", "56S-XH"];
  const orders = [0, 1, 2, 3, 5, 7, 11, 31];
  const assignments = orders.map((executionOrder, i) =>
    assignFixedRoles(spec, mkRecord({ executionOrder, cellId: cells[i % cells.length], sampleIndex: (i % 2) + 1 })),
  );
  const first = assignments[0];
  for (const a of assignments) {
    assert.deepEqual(a.readerPrimary, first.readerPrimary, "reader primary is invariant across cells/orders");
    assert.deepEqual(a.sourcePrimary, first.sourcePrimary, "source primary is invariant");
    assert.deepEqual(a.quizAdjudicator, first.quizAdjudicator, "quiz adjudicator is invariant");
    assert.deepEqual(a.readerBackup, first.readerBackup, "reader backup is invariant");
  }
  // The fixed primary is panel[0], NOT the rotated panel[executionOrder % len].
  assert.equal(first.schema, "split-lane-fixed-role-assignment-v1");
  assert.equal(first.readerPrimary.profileId, "gpt-5.5@high");
  assert.equal(first.readerPrimary.model, "gpt-5.5");
  assert.equal(first.readerPrimary.effort, "high");
  assert.equal(first.readerBackup.profileId, "gpt-5.6-sol@xhigh", "backup is the distinct second panel member");
  assert.equal(first.quizChecker.deterministic, true);
  assert.equal(first.quizChecker.checkerVersion, QUIZ_DETERMINISTIC_CHECKER_VERSION);

  // Anti-rotation: at executionOrder 1 the OLD rule selected panel[1] (xhigh) —
  // the fixed assignment must still return panel[0] (high).
  const atOrder1 = assignFixedRoles(spec, mkRecord({ executionOrder: 1, cellId: "55-XH", sampleIndex: 1 }));
  assert.equal(atOrder1.readerPrimary.profileId, "gpt-5.5@high");
  assert.notEqual(atOrder1.readerPrimary.profileId, "gpt-5.6-sol@xhigh", "the old rotation would have picked panel[1] at executionOrder 1");

  // The production consumer (panelAssignment) inherits the same invariant.
  const p0 = panelAssignment(spec, mkRecord({ executionOrder: 0, cellId: "55-H", sampleIndex: 2 }));
  const p1 = panelAssignment(spec, mkRecord({ executionOrder: 1, cellId: "56S-XH", sampleIndex: 2 }));
  const p5 = panelAssignment(spec, mkRecord({ executionOrder: 5, cellId: "55-XH", sampleIndex: 2 }));
  assert.deepEqual(p0.primary, { model: "gpt-5.5", effort: "high" });
  assert.deepEqual(p1.primary, p0.primary);
  assert.deepEqual(p5.primary, p0.primary);
});

test("assignFixedRoles fails closed on an empty panel and degrades a one-judge panel to primary-as-backup", () => {
  const single = confirmatorySpec({ judgePanel: [{ model: "gpt-5.5", effort: "high" }] });
  const a = assignFixedRoles(single, mkRecord());
  assert.equal(a.readerPrimary.profileId, "gpt-5.5@high");
  assert.equal(a.readerBackup.profileId, "gpt-5.5@high", "a one-judge panel has no distinct backup");
  const empty = confirmatorySpec({ judgePanel: [] });
  assert.throws(() => assignFixedRoles(empty, mkRecord()), MigrationGuardError);
});

// ── Unit test 24 — frozen, balanced, output-independent audit subset ───────────

test("24: the backup audit subset is FROZEN and BALANCED — output-independent, one designated sample per cell×chapter", () => {
  const spec = confirmatorySpec({ judgePanel: TWO_JUDGE_PANEL });
  const cells = ["55-H", "56S-H"];
  const chapters = [1, 2];
  const records: MigrationSampleRecordV1[] = [];
  let order = 0;
  for (const cellId of cells) {
    for (const chapterNumber of chapters) {
      for (const sampleIndex of [1, 2]) {
        records.push(mkRecord({ executionOrder: order++, cellId, chapterNumber, sampleIndex, blindSampleId: `${cellId}-${chapterNumber}-${sampleIndex}` }));
      }
    }
  }
  const subset = records.filter((r) => isInFrozenAuditSubset(spec, r));
  // BALANCED: exactly one audit sample per (cell × chapter) → 4 total, 2 per cell.
  assert.equal(subset.length, 4, "one designated audit sample per cell×chapter");
  for (const cellId of cells) {
    assert.equal(subset.filter((r) => r.cellId === cellId).length, 2, `cell ${cellId} audited evenly`);
  }
  assert.ok(subset.length < records.length, "the audit subset is a strict subset, not every sample");

  // FROZEN: membership depends only on the frozen coordinate (sample index), not
  // on execution order and not on the candidate's authoring model / cell.
  assert.equal(isInFrozenAuditSubset(spec, mkRecord({ sampleIndex: 1, executionOrder: 99, cellId: "56S-XH" })), true);
  assert.equal(isInFrozenAuditSubset(spec, mkRecord({ sampleIndex: 1, executionOrder: 4, cellId: "55-H" })), true);
  assert.equal(isInFrozenAuditSubset(spec, mkRecord({ sampleIndex: 2, executionOrder: 0 })), false, "a non-designated sample index is never audited");

  // OUTPUT-INDEPENDENT: attaching a (failing) review never changes membership.
  const withPassing = mkRecord({ sampleIndex: 1, executionOrder: 3, review: { ...FAKE_REVIEW_SUMMARY, pass: true } });
  const withFailing = mkRecord({ sampleIndex: 1, executionOrder: 8, review: { ...FAKE_REVIEW_SUMMARY, pass: false } });
  assert.equal(isInFrozenAuditSubset(spec, withPassing), true);
  assert.equal(isInFrozenAuditSubset(spec, withFailing), true, "the backup is never selected by the review outcome");
});

// ── Integration 6 — fixed-role review of four cells ───────────────────────────

test("integration 6: the same fixed primary judge reads all four cells (no execution-order rotation)", async () => {
  const fx = mkSealFixture("cf-role-int6-", { experimentId: "exp-role-int6", judgePanel: TWO_JUDGE_PANEL });
  const { roots, spec } = fx;
  writePanelQualifications(roots, spec);
  const chapterAbs = join(fx.tmp, "committed.chapter.json");
  writeFileSync(chapterAbs, JSON.stringify(fixtureChapter("zz-mig-book-a", 1), null, 2) + "\n");
  const chapterRel = pipelineRel(chapterAbs);
  const reads: string[] = [];
  const fakeReview = mkFakeReview(reads);
  const cells = ["55-H", "55-XH", "56S-H", "56S-XH"];
  const primaries: Array<{ model: string; effort: string }> = [];
  for (let i = 0; i < cells.length; i++) {
    const rec = mkRecord({ experimentId: spec.experimentId, blindSampleId: `int6-cell-${i}`, cellId: cells[i], sampleIndex: 2, executionOrder: i });
    rec.artifact.chapterRelPath = chapterRel;
    rootedWrite(roots, sampleRecordPath(roots, rec.blindSampleId), JSON.stringify(rec, null, 2));
    const updated = await reviewOneSample({ record: rec, spec, roots, deps: fakeAutopilotDeps() as AutopilotDeps, allowSyntheticQualification: true, log: () => {}, reviewFn: fakeReview });
    assert.equal(updated.agreementReview, undefined, "sampleIndex 2 is outside the audit subset → no backup read");
    primaries.push({ model: updated.review!.judgeModel, effort: updated.review!.judgeEffort });
  }
  for (const p of primaries) {
    assert.equal(p.model, "gpt-5.5", "the fixed primary (panel[0]) reads every cell — no rotation by execution order");
    assert.equal(p.effort, "high");
  }
  assert.equal(reads.length, 4, "one fixed-primary read per cell, zero backup reads outside the audit subset");
});

// ── Integration 7 — balanced audit subset backup read ─────────────────────────

test("integration 7: the fixed backup read lands ONLY on the frozen balanced audit subset", async () => {
  const fx = mkSealFixture("cf-role-int7-", { experimentId: "exp-role-int7", judgePanel: TWO_JUDGE_PANEL });
  const { roots, spec } = fx;
  writePanelQualifications(roots, spec);
  const chapterAbs = join(fx.tmp, "committed.chapter.json");
  writeFileSync(chapterAbs, JSON.stringify(fixtureChapter("zz-mig-book-a", 1), null, 2) + "\n");
  const chapterRel = pipelineRel(chapterAbs);
  const reads: string[] = [];
  const fakeReview = mkFakeReview(reads);

  // In-subset sample (sampleIndex 1): fixed primary + fixed backup adjudicator.
  const inSub = mkRecord({ experimentId: spec.experimentId, blindSampleId: "int7-in-aaaa", cellId: "55-H", sampleIndex: 1, executionOrder: 3 });
  inSub.artifact.chapterRelPath = chapterRel;
  rootedWrite(roots, sampleRecordPath(roots, inSub.blindSampleId), JSON.stringify(inSub, null, 2));
  const inUpdated = await reviewOneSample({ record: inSub, spec, roots, deps: fakeAutopilotDeps() as AutopilotDeps, allowSyntheticQualification: true, log: () => {}, reviewFn: fakeReview });
  assert.equal(inUpdated.review?.judgeModel, "gpt-5.5", "fixed primary = panel[0]");
  assert.equal(inUpdated.review?.judgeEffort, "high");
  assert.ok(inUpdated.agreementReview, "an audit-subset sample gets the fixed backup read");
  assert.equal(inUpdated.agreementReview?.judgeModel, "gpt-5.6-sol", "the backup is the fixed panel[1] adjudicator");
  assert.equal(inUpdated.agreementReview?.judgeEffort, "xhigh");

  // Out-of-subset sample (sampleIndex 2): fixed primary, NO backup.
  const outSub = mkRecord({ experimentId: spec.experimentId, blindSampleId: "int7-out-bbb", cellId: "55-H", sampleIndex: 2, executionOrder: 9 });
  outSub.artifact.chapterRelPath = chapterRel;
  rootedWrite(roots, sampleRecordPath(roots, outSub.blindSampleId), JSON.stringify(outSub, null, 2));
  const outUpdated = await reviewOneSample({ record: outSub, spec, roots, deps: fakeAutopilotDeps() as AutopilotDeps, allowSyntheticQualification: true, log: () => {}, reviewFn: fakeReview });
  assert.equal(outUpdated.review?.judgeModel, "gpt-5.5", "the SAME fixed primary reads the out-of-subset sample");
  assert.equal(outUpdated.agreementReview, undefined, "outside the audit subset → no backup read, never output-selected");

  assert.equal(reads.length, 3, "in-subset: primary+backup (2); out-of-subset: primary only (1)");
});
