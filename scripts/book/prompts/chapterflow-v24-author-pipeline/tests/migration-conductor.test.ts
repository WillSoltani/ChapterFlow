/**
 * IMP-11 — the migration conductor end to end (synthetic stages): the full
 * ladder with NO promote/qc/publish rung, freeze-before-unblind, thresholds
 * immutability, the frozen screening→expansion wave, the qualification/
 * candidate overlap halt, and the real review runner's enforcement.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import type { ChapterReviewV1 } from "../src/artifacts/artifactTypes.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { READER_RUBRIC_VERSION, REVIEW_DOC_HASH_VERSION } from "../src/review/readerReview.js";
import { sha256Hex } from "../src/bakeoff/paths.js";
import type {
  ExperimentSpecV1,
  JudgeQualificationV1,
  MigrationReviewSummaryV1,
  MigrationSampleRecordV1,
  SampleScheduleEntryV1,
} from "../src/bakeoff/migration/experimentTypes.js";
import { rootedWrite, type MigrationRoots } from "../src/bakeoff/migration/guards.js";
import { qualificationPath } from "../src/bakeoff/migration/qualification.js";
import { runMigrationExperiment, type MigrationStages, type HumanAdjudicationV1 } from "../src/bakeoff/migration/runExperiment.js";
import { reviewOneSample } from "../src/bakeoff/migration/reviewRunner.js";
import { isInFrozenAuditSubset } from "../src/bakeoff/migration/reviewerRoleAssignment.js";
import { sampleRecordPath } from "../src/bakeoff/migration/sampleRunner.js";
import { DEFAULT_QUAL_THRESHOLDS } from "../src/bakeoff/migration/qualification.js";
import { mkQualCorpus, mkSealFixture, type SealFixture } from "./migration-helpers.js";
import { fakeAutopilotDeps, fixtureChapter } from "./model-bakeoff-helpers.js";

function syntheticRecord(entry: SampleScheduleEntryV1, spec: ExperimentSpecV1, contentSha256?: string): MigrationSampleRecordV1 {
  return {
    schema: "migration-sample-record-v1",
    experimentId: spec.experimentId,
    stage: spec.stage,
    blindSampleId: entry.blindSampleId,
    cellId: entry.cellId,
    bookId: entry.bookId,
    chapterNumber: entry.chapterNumber,
    stratum: entry.stratum,
    sampleIndex: entry.sampleIndex,
    executionOrder: entry.executionOrder,
    outcome: {
      providerOutcome: "content_completed",
      replayed: false,
      firstWriteDeterministicPass: true,
      durationMs: 1200,
      writerSessionIds: [`w-${entry.blindSampleId}`],
    },
    artifact: { contentSha256: contentSha256 ?? sha256Hex(entry.blindSampleId), chapterRelPath: `x/${entry.blindSampleId}.chapter.json` },
    critics: { c37Overreach: 0, c37SceneCompletion: 0, c37GenericLeak: 0, registerAdvisories: 0, causalClaims: 1, diversity: null },
    review: null,
    tokens: null,
    unavailableFields: ["tokens"],
    recordedAt: "2026-07-10T00:00:00.000Z",
  };
}

function syntheticReview(record: MigrationSampleRecordV1, judge: { model: string; effort: "high" | "xhigh" }): MigrationReviewSummaryV1 {
  return {
    composite: record.cellId === "56S-XH" ? 91 : 88,
    ship: true,
    keysClean: true,
    valid: true,
    pass: true,
    quizAdjudicationStatus: "adjudicated",
    complaintsMustFix: 0,
    reviewerSessionId: `r-${record.blindSampleId}`,
    judgeModel: judge.model,
    judgeEffort: judge.effort,
  };
}

function fakeStages(): MigrationStages {
  return {
    qualifyJudge: async (args) => {
      const q: JudgeQualificationV1 = {
        schema: "migration-judge-qualification-v1",
        judge: args.judge,
        corpusId: args.corpus.corpusId,
        corpusSha256: "0".repeat(64),
        instrumentVersions: { readerRubricVersion: READER_RUBRIC_VERSION, reviewDocHashVersion: REVIEW_DOC_HASH_VERSION },
        scoredAt: "2026-07-10T00:00:00.000Z",
        perClass: [],
        falsePositiveRate: 0,
        evidenceQuoteValidityRate: 1,
        schemaValidityRate: 1,
        injectionResistanceRate: 1,
        thresholds: args.thresholds,
        qualified: true,
        labelProvenance: { human: 0, synthetic: args.corpus.items.length },
        dryRunOnly: true,
      };
      rootedWrite(args.roots, qualificationPath(args.roots, args.judge), JSON.stringify(q, null, 2));
      return q;
    },
    runSample: async (opts) => {
      const record = syntheticRecord(opts.entry, opts.spec);
      rootedWrite(opts.roots, sampleRecordPath(opts.roots, opts.entry.blindSampleId), JSON.stringify(record, null, 2));
      return record;
    },
    reviewSample: async (opts) => {
      const judge = opts.spec.judgePanel[0] as { model: string; effort: "high" | "xhigh" };
      const updated: MigrationSampleRecordV1 = {
        ...opts.record,
        review: syntheticReview(opts.record, judge),
        ...(opts.spec.judgePanel.length > 1 && isInFrozenAuditSubset(opts.spec, opts.record)
          ? { agreementReview: syntheticReview(opts.record, opts.spec.judgePanel[1] as { model: string; effort: "high" | "xhigh" }) }
          : {}),
      };
      rootedWrite(opts.roots, sampleRecordPath(opts.roots, opts.record.blindSampleId), JSON.stringify(updated, null, 2));
      return updated;
    },
  };
}

function corpusFile(fx: SealFixture): string {
  const p = join(fx.tmp, "corpus.json");
  writeFileSync(p, JSON.stringify(mkQualCorpus(), null, 2) + "\n");
  return p;
}

test("full ladder: seal → … → report with human adjudication supplied — both SOL profiles QUALIFY and the decision file is exact", async () => {
  const fx = mkSealFixture("cf-mig-cond1-", {
    experimentId: "exp-cond1",
    judgePanel: [{ model: "gpt-5.5", effort: "high" }, { model: "gpt-5.5", effort: "xhigh" }],
  });
  const base = {
    experimentId: "exp-cond1",
    specPath: fx.specPath,
    corpusPath: corpusFile(fx),
    stateRoot: fx.stateRoot,
    allowSyntheticQualification: true,
    deps: fakeAutopilotDeps() as Partial<AutopilotDeps>,
    sealDeps: fx.deps,
    stages: fakeStages(),
    log: () => {},
  };
  // Run to the unblind gate, then supply the §16 human-adjudication input.
  const mid = await runMigrationExperiment({ ...base, through: "unblind" });
  assert.equal(mid.status, "stopped-at-phase", mid.reason ?? "");
  const human: HumanAdjudicationV1 = {
    schema: "migration-human-adjudication-v1",
    perCell: {
      "56S-H": { sourcedFabrication: 0, sourceFramingAmbiguity: 0, quizKeyOrMechanism: 0, causalOverreach: 0, exactLeakageOrClone: 0 },
      "56S-XH": { sourcedFabrication: 0, sourceFramingAmbiguity: 0, quizKeyOrMechanism: 0, causalOverreach: 0, exactLeakageOrClone: 0 },
    },
    highSeverityHumanReviewComplete: true,
  };
  writeFileSync(join(fx.roots.runRoot, "human-adjudication.json"), JSON.stringify(human, null, 2) + "\n");

  const outcome = await runMigrationExperiment(base);
  assert.equal(outcome.status, "complete", outcome.reason ?? "");
  assert.ok(outcome.decisionLine?.startsWith("SOL BAKEOFF RESULT: QUALIFIED "), outcome.decisionLine);

  const decision = JSON.parse(readFileSync(fx.roots.decisionPath, "utf8"));
  assert.equal(decision.result, "QUALIFIED");
  assert.ok(decision.qualifiedProfiles.some((p: { effort: string; taskClasses?: string[] }) => p.effort === "xhigh" && (p.taskClasses ?? []).length > 0), "91 vs 88 composite ≥ 2pt bar → xhigh earns task-scoped classes");
  assert.ok(decision.activation.includes("IMP-13"), "the decision file cannot activate anything");

  const manifest = JSON.parse(readFileSync(fx.roots.manifestPath, "utf8"));
  assert.deepEqual(manifest.completedPhases, ["seal", "qualify", "generate", "review", "metrics", "analyze", "unblind", "decide", "report"], "the ladder has NO promote/qc/publish rung");

  const report = readFileSync(fx.roots.reportMdPath, "utf8");
  assert.ok(report.includes(outcome.decisionLine!) && report.includes("8.3%"), "the report carries the decision line and the mandated precision statement");

  // 32 records: 4 cells × 4 chapters × 2 samples; agreement reads on sampleIndex 1.
  const records = JSON.parse(readFileSync(fx.roots.metricTablesPath, "utf8"));
  assert.equal(records.cells.reduce((s: number, c: { n: { run: number } }) => s + c.n.run, 0), 32);
});

test("without human adjudication the same run is INCONCLUSIVE — missing evidence never silently passes", async () => {
  const fx = mkSealFixture("cf-mig-cond2-", { experimentId: "exp-cond2" });
  const outcome = await runMigrationExperiment({
    experimentId: "exp-cond2",
    specPath: fx.specPath,
    corpusPath: corpusFile(fx),
    stateRoot: fx.stateRoot,
    allowSyntheticQualification: true,
    deps: fakeAutopilotDeps() as Partial<AutopilotDeps>,
    sealDeps: fx.deps,
    stages: fakeStages(),
    log: () => {},
  });
  assert.equal(outcome.status, "complete");
  assert.equal(outcome.decisionLine, "SOL BAKEOFF RESULT: INCONCLUSIVE");
});

test("unblinding is impossible before frozen metrics: tampered metric tables halt the resume", async () => {
  const fx = mkSealFixture("cf-mig-cond3-", { experimentId: "exp-cond3" });
  const base = {
    experimentId: "exp-cond3",
    specPath: fx.specPath,
    corpusPath: corpusFile(fx),
    stateRoot: fx.stateRoot,
    allowSyntheticQualification: true,
    deps: fakeAutopilotDeps() as Partial<AutopilotDeps>,
    sealDeps: fx.deps,
    stages: fakeStages(),
    log: () => {},
  };
  const mid = await runMigrationExperiment({ ...base, through: "metrics" });
  assert.equal(mid.status, "stopped-at-phase");
  const tables = readFileSync(fx.roots.metricTablesPath, "utf8");
  writeFileSync(fx.roots.metricTablesPath, tables + "\n");
  const outcome = await runMigrationExperiment(base);
  assert.equal(outcome.status, "halt");
  assert.ok(outcome.reason?.includes("metric tables drifted"), outcome.reason);
});

test("thresholds cannot change after sealing: a tampered sealed copy halts the next phase", async () => {
  const fx = mkSealFixture("cf-mig-cond4-", { experimentId: "exp-cond4" });
  const base = {
    experimentId: "exp-cond4",
    specPath: fx.specPath,
    corpusPath: corpusFile(fx),
    stateRoot: fx.stateRoot,
    allowSyntheticQualification: true,
    deps: fakeAutopilotDeps() as Partial<AutopilotDeps>,
    sealDeps: fx.deps,
    stages: fakeStages(),
    log: () => {},
  };
  const sealedOnly = await runMigrationExperiment({ ...base, through: "seal" });
  assert.equal(sealedOnly.status, "stopped-at-phase");
  writeFileSync(fx.roots.thresholdsCopyPath, readFileSync(fx.roots.thresholdsCopyPath, "utf8").replace("75", "60"));
  const outcome = await runMigrationExperiment(base);
  assert.equal(outcome.status, "halt");
  assert.ok(outcome.reason?.includes("seal drift"), outcome.reason);
});

test("screening → frozen expansion: the persisted stopping decision licenses the expansion wave exactly once", async () => {
  const fx = mkSealFixture("cf-mig-cond5-", {
    experimentId: "exp-cond5",
    samplesPerCell: 2,
    screening: { samplesPerCell: 1, expandWhen: ["expand-if-any-sol-cell-screens-clean"], maxSamplesPerCell: 2 },
  });
  const outcome = await runMigrationExperiment({
    experimentId: "exp-cond5",
    specPath: fx.specPath,
    corpusPath: corpusFile(fx),
    stateRoot: fx.stateRoot,
    allowSyntheticQualification: true,
    deps: fakeAutopilotDeps() as Partial<AutopilotDeps>,
    sealDeps: fx.deps,
    stages: fakeStages(),
    through: "review",
    log: () => {},
  });
  assert.equal(outcome.status, "stopped-at-phase", outcome.reason ?? "");
  const stopping = JSON.parse(readFileSync(join(fx.roots.runRoot, "stopping-decision.json"), "utf8"));
  assert.equal(stopping.decision, "expand", "a clean SOL screen fires the frozen expansion rule");
  const recordFiles = readFileSync(fx.roots.manifestPath, "utf8");
  assert.ok(recordFiles.includes('"generate"') && recordFiles.includes('"review"'));
  const recordsDir = join(fx.roots.runRoot, "records");
  const count = (await import("node:fs")).readdirSync(recordsDir).length;
  assert.equal(count, 4 * 4 * 2, "expansion entries ran after the frozen decision");
});

test("a corpus chapter reappearing among candidates halts the analysis (red-team case 1)", async () => {
  const fx = mkSealFixture("cf-mig-cond6-", { experimentId: "exp-cond6" });
  const corpus = mkQualCorpus();
  const overlapHash = chapterContentHash(corpus.items[2].chapter);
  const corpusPath = join(fx.tmp, "corpus.json");
  writeFileSync(corpusPath, JSON.stringify(corpus, null, 2) + "\n");
  const stages = fakeStages();
  let first = true;
  const stagesWithOverlap: MigrationStages = {
    ...stages,
    runSample: async (opts) => {
      const record = syntheticRecord(opts.entry, opts.spec, first ? overlapHash : undefined);
      first = false;
      rootedWrite(opts.roots, sampleRecordPath(opts.roots, opts.entry.blindSampleId), JSON.stringify(record, null, 2));
      return record;
    },
  };
  const outcome = await runMigrationExperiment({
    experimentId: "exp-cond6",
    specPath: fx.specPath,
    corpusPath,
    stateRoot: fx.stateRoot,
    allowSyntheticQualification: true,
    deps: fakeAutopilotDeps() as Partial<AutopilotDeps>,
    sealDeps: fx.deps,
    stages: stagesWithOverlap,
    log: () => {},
  });
  assert.equal(outcome.status, "halt");
  assert.ok(outcome.reason?.includes("overlap"), outcome.reason);
});

test("the real review runner: unqualified judges refuse, the FIXED primary judge reads every sample, the backup read lands only on the frozen audit subset, reviews are immutable", async () => {
  const fx = mkSealFixture("cf-mig-cond7-", {
    experimentId: "exp-cond7",
    judgePanel: [{ model: "gpt-5.5", effort: "high" }, { model: "gpt-5.5", effort: "xhigh" }],
  });
  const roots: MigrationRoots = fx.roots;
  const spec = fx.spec;
  const chapter = fixtureChapter("zz-mig-book-a", 1);
  const chapterAbs = join(fx.tmp, "committed.chapter.json");
  writeFileSync(chapterAbs, JSON.stringify(chapter, null, 2) + "\n");
  // executionOrder 1 would, under the OLD rotation, have picked panel[1] (xhigh)
  // as primary and panel[0] (high) as the agreement judge. Fixed assignment (§G)
  // must instead pin panel[0] (high) primary + panel[1] (xhigh) backup regardless.
  const entry: SampleScheduleEntryV1 = {
    blindSampleId: "abc123abc123", cellId: "56S-H", bookId: "zz-mig-book-a", chapterNumber: 1,
    stratum: "research-heavy", sampleIndex: 1, executionOrder: 1, expansion: false,
  };
  const record = syntheticRecord(entry, spec);
  record.artifact.chapterRelPath = (await import("../src/bakeoff/paths.js")).pipelineRel(chapterAbs);
  rootedWrite(roots, sampleRecordPath(roots, entry.blindSampleId), JSON.stringify(record, null, 2));

  const reads: string[] = [];
  const fakeReview = (async (_b, _c, _d, _io, _bar, labelSuffix) => {
    reads.push(String(labelSuffix));
    return {
      composite: 88, ship84: true, keyCheck: { matches: 3, of: 3 }, valid: true, pass: true,
      complaints: [], quotes: [], tells: [], oneParagraphVerdict: "PASS", reviewerSessionId: `r${reads.length}`,
      quizAdjudication: { status: "adjudicated" },
    } as unknown as ChapterReviewV1;
  }) as typeof import("../src/orchestrator/authorReview.js").reviewOneChapter;

  // No qualification on file → refuse (inst. 4).
  await assert.rejects(
    () => reviewOneSample({ record, spec, roots, deps: fakeAutopilotDeps() as AutopilotDeps, allowSyntheticQualification: true, log: () => {}, reviewFn: fakeReview }),
    /no qualification record/,
  );

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

  const updated = await reviewOneSample({ record, spec, roots, deps: fakeAutopilotDeps() as AutopilotDeps, allowSyntheticQualification: true, log: () => {}, reviewFn: fakeReview });
  assert.ok(updated.review?.pass);
  // FIXED assignment: the primary is panel[0] (high), NOT the execution-order-
  // rotated panel[1]; the backup is the fixed panel[1] (xhigh).
  assert.equal(updated.review?.judgeEffort, "high", "the fixed primary is panel[0] (high), never the rotated panel[executionOrder % len]");
  assert.ok(updated.agreementReview, "sampleIndex 1 is in the frozen audit subset → the fixed backup read ran");
  assert.equal(updated.agreementReview?.judgeEffort, "xhigh", "the audit-subset backup is the fixed panel[1] (xhigh) judge");
  assert.equal(reads.length, 2);

  // Immutable: a second invocation performs NO further reads.
  const again = await reviewOneSample({ record: updated, spec, roots, deps: fakeAutopilotDeps() as AutopilotDeps, allowSyntheticQualification: true, log: () => {}, reviewFn: fakeReview });
  assert.equal(reads.length, 2, "an existing review is never re-rolled");
  assert.deepEqual(again, updated);

  // A sample OUTSIDE the frozen audit subset (sampleIndex 2) gets the fixed
  // primary read but NO backup read — the backup is never output-selected.
  const outOfSubset: MigrationSampleRecordV1 = { ...record, blindSampleId: "ghi789ghi789", sampleIndex: 2, review: null };
  rootedWrite(roots, sampleRecordPath(roots, outOfSubset.blindSampleId), JSON.stringify(outOfSubset, null, 2));
  const auditNone = await reviewOneSample({ record: outOfSubset, spec, roots, deps: fakeAutopilotDeps() as AutopilotDeps, allowSyntheticQualification: true, log: () => {}, reviewFn: fakeReview });
  assert.equal(auditNone.review?.judgeEffort, "high", "every sample is read by the SAME fixed primary judge (high), regardless of order");
  assert.equal(auditNone.agreementReview, undefined, "a sample outside the frozen audit subset gets no backup read");
  assert.equal(reads.length, 3, "exactly one further primary read; no backup on the non-audit sample");

  // Dry-run qualifications refuse LIVE (non-synthetic) review runs.
  await assert.rejects(
    () => reviewOneSample({ record: { ...record, blindSampleId: "def456def456" }, spec, roots, deps: fakeAutopilotDeps() as AutopilotDeps, allowSyntheticQualification: false, log: () => {}, reviewFn: fakeReview }),
    /synthetic labels/,
  );
  assert.ok(existsSync(fx.roots.runRoot));
});
