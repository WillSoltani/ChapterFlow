/**
 * IMP-20 WP-B10 — recovery experiment spec + seal-prep + no-model pilot dry run.
 *
 * Covers unit test 35 (no recovery artifact mutates canonical chapter state) and
 * integration tests 10 (changed prompt/schema invalidates qualification), 11
 * (changed role assignment invalidates the experiment seal), 13 (a new campaign
 * cannot start before role qualification), and 14 (the pilot dry run makes zero
 * model calls). All model-free: sibling Wave-B capabilities are injected as test
 * doubles typed by the Wave-A frozen function-type aliases.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test, xenv } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import { assertNotClosed } from "../src/bakeoff/migration/guards.js";
import type {
  JudgeCapabilityQualificationV1,
} from "../src/contracts/judgeCapabilityQualification.js";
import type {
  AggregatedChapterReviewV1,
  AggregateChapterReviewInputV1,
} from "../src/contracts/aggregateChapterReview.js";
import type { ExperimentSpecV1, MigrationSampleRecordV1 } from "../src/bakeoff/migration/experimentTypes.js";
import type {
  FixedRoleAssignmentV1,
  ReviewLaneRole,
  RoleJudgeSelectionV1,
  RoleQualificationRegistryV1,
} from "../src/bakeoff/migration/reviewLaneTypes.js";
import {
  buildRecoveryExperimentSpec,
  buildSplitLaneInstrumentManifest,
  enumerateRecoveryCells,
  prepareRecoverySeal,
  recoveryArtifactFiles,
  recoveryAuditSubsetCellIds,
  recoveryQualificationIsFresh,
  recoverySpecSha256,
  runRecoveryPilotDryRun,
  sealRecoveryExperiment,
  splitLaneInstrumentManifestSha256,
  RECOVERY_CANDIDATE_JUDGE_PROFILES,
  RECOVERY_EXPERIMENT_ID,
  RECOVERY_PROPOSED_HARD_CEILING,
  RECOVERY_REQUIRED_ROLES,
  type RecoverySpecInputsV1,
} from "../src/bakeoff/migration/recoveryExperiment.js";

// ── fixtures ──────────────────────────────────────────────────────────────────

const BASE_INPUTS: RecoverySpecInputsV1 = {
  readerSchemaSha256: "reader-schema-sha-aaaa",
  sourceSchemaSha256: "source-schema-sha-bbbb",
  quizAdjudicationSchemaSha256: "quiz-schema-sha-cccc",
  executionProfileHash: "exec-profile-hash-dddd",
  routePolicyVersion: "route-policy-v1.0",
  thresholdsSha256: "thresholds-sha-eeee",
  readerCorpusSha256: "reader-corpus-sha-ffff",
  sourceCorpusSha256: "source-corpus-sha-gggg",
  quizCorpusSha256: "quiz-corpus-sha-hhhh",
  randomizationSeed: "seed-rand",
  pilotSeed: "seed-pilot",
  diagnosticSeed: "seed-diag",
};

const EMPTY_REGISTRY: RoleQualificationRegistryV1 = {
  schema: "split-lane-role-qualification-registry-v1",
  profiles: [],
};

/** An `assertRoleSetReady` double that ALWAYS refuses (no role-qualified set). */
const assertRoleSetNotReady = (): void => {
  throw new Error("no role-qualified reviewer set: registry has no qualified primary/backup");
};
/** An `assertRoleSetReady` double that ACCEPTS (a fully-qualified set exists). */
const assertRoleSetReadyOk = (): void => {};

/** A `selectRoleJudges` double naming the first candidate profile per role. */
const selectRoleJudgesOk = (_registry: RoleQualificationRegistryV1, role: ReviewLaneRole): RoleJudgeSelectionV1 => ({
  schema: "split-lane-role-judge-selection-v1",
  role,
  status: "SELECTED",
  primaryProfileId: RECOVERY_CANDIDATE_JUDGE_PROFILES[0].profileId,
  backupProfileId: RECOVERY_CANDIDATE_JUDGE_PROFILES[1].profileId,
  blockedReason: null,
  selectionRationale: ["highest held-out alignment"],
});

// ── invariants + reproducibility ──────────────────────────────────────────────

test("recovery spec: new identity is NOT a closed old seal, is byte-reproducible, and pins the safety invariants", () => {
  // The new id must never be in the closed-experiment freeze set.
  assert.doesNotThrow(() => assertNotClosed(RECOVERY_EXPERIMENT_ID));

  const a = buildRecoveryExperimentSpec(BASE_INPUTS);
  const b = buildRecoveryExperimentSpec(BASE_INPUTS);
  assert.equal(hashCanonical(a), hashCanonical(b), "identical inputs must yield a byte-identical spec");

  assert.equal(a.schema, "split-lane-recovery-experiment-spec-v1");
  assert.equal(a.experimentId, RECOVERY_EXPERIMENT_ID);
  // Literal-typed safety invariants — no code path can flip them.
  assert.equal(a.imp13Dormant, true);
  assert.equal(a.productionActivation, false);
  assert.equal(a.separateAuthorizationRequired, true);
  assert.deepEqual(a.bookSpecificExceptions, [], "no book-specific exceptions");
  assert.equal(a.humanAdjudicationPause.required, true);
  assert.ok(a.humanAdjudicationPause.unadjudicatedDisputes.length >= 1, "records the open owner adjudication (R-4)");
  // No repair / bounded infra replay only.
  assert.equal(a.execution.boundedRetry.maxReplaysPerCall, 1);
  assert.ok(!a.execution.boundedRetry.replayableOutcomes.includes("content_invalid" as never), "content is never replayed");
  assert.equal(a.execution.callCeiling, RECOVERY_PROPOSED_HARD_CEILING);
  assert.equal(a.execution.authMode, "chatgpt-subscription-codex-exec");
  // Runtime judges are GPT-only — never an Anthropic/Claude model.
  for (const p of a.candidateJudgeProfiles) {
    assert.ok(/^gpt-/i.test(p.model), `candidate judge ${p.profileId} must be a GPT profile, got ${p.model}`);
  }
  // 4 strata × 4 authoring configs × 1 sample = 16 candidate cells.
  assert.equal(a.candidateInputs.diagnostic.length, 16);
  assert.equal(a.candidateInputs.confirmatory.length, 0, "confirmatory set is empty until a clean pilot");
});

// ── integration 10 — changed prompt/schema invalidates qualification ──────────

test("integration 10: a changed reader schema (or any instrument input) stales a prior qualification via the manifest hash", () => {
  const specA = buildRecoveryExperimentSpec(BASE_INPUTS);
  const manifestShaA = splitLaneInstrumentManifestSha256(specA.instrumentManifest);

  // A qualification measured under manifest A records that hash.
  const qual: JudgeCapabilityQualificationV1 = {
    profileId: "gpt-5.5@high",
    model: "gpt-5.5",
    effort: "high",
    readerExperience: "QUALIFIED",
    sourceIntegrity: "NOT_TESTED",
    quizIntegrity: "NOT_TESTED",
    securityBoundary: "QUALIFIED",
    evidenceHashes: [],
    corpusHashes: [],
    instrumentHashes: [manifestShaA],
    qualifiedAt: "2026-07-12T00:00:00.000Z",
  };
  assert.equal(recoveryQualificationIsFresh(qual, manifestShaA), true, "fresh under the manifest it was measured on");

  // Change the reader schema sha → new manifest hash → the old qualification is stale.
  const specB = buildRecoveryExperimentSpec({ ...BASE_INPUTS, readerSchemaSha256: "reader-schema-sha-CHANGED" });
  const manifestShaB = splitLaneInstrumentManifestSha256(specB.instrumentManifest);
  assert.notEqual(manifestShaB, manifestShaA, "a changed schema must change the instrument manifest hash");
  assert.equal(recoveryQualificationIsFresh(qual, manifestShaB), false, "an old qualification cannot satisfy the new manifest");

  // Every behavior-affecting input must move the manifest hash.
  const drivers: Array<Partial<RecoverySpecInputsV1>> = [
    { sourceSchemaSha256: "x" }, { quizAdjudicationSchemaSha256: "x" }, { thresholdsSha256: "x" },
    { executionProfileHash: "x" }, { routePolicyVersion: "x" },
    { readerCorpusSha256: "x" }, { sourceCorpusSha256: "x" }, { quizCorpusSha256: "x" },
  ];
  for (const d of drivers) {
    const m = splitLaneInstrumentManifestSha256(buildRecoveryExperimentSpec({ ...BASE_INPUTS, ...d }).instrumentManifest);
    assert.notEqual(m, manifestShaA, `changing ${Object.keys(d)[0]} must stale the manifest`);
  }
});

// ── integration 11 — changed role assignment invalidates the experiment seal ──

test("integration 11: any change to the fixed role assignment invalidates the experiment seal (spec + manifest hash)", () => {
  const spec = buildRecoveryExperimentSpec(BASE_INPUTS);
  const specShaBefore = recoverySpecSha256(spec);
  const manifestShaBefore = splitLaneInstrumentManifestSha256(spec.instrumentManifest);

  // Mutate the fixed role assignment (a different primary reader judge).
  const mutated = structuredClone(spec);
  mutated.roleAssignment.readerPrimary = { profileId: "gpt-5.6-sol@high", model: "gpt-5.6-sol", effort: "high" };
  assert.notEqual(recoverySpecSha256(mutated), specShaBefore, "a changed role assignment must stale the sealed spec hash");

  // The manifest binds the role assignment via fixedRoleAssignmentSha256, so a
  // re-derived manifest over the mutated assignment also changes.
  const remanifest = buildSplitLaneInstrumentManifest(BASE_INPUTS, hashCanonical(mutated.roleAssignment));
  assert.notEqual(splitLaneInstrumentManifestSha256(remanifest), manifestShaBefore, "role-assignment change moves the manifest hash");
});

// ── integration 13 — new campaign cannot start before role qualification ──────

test("integration 13: a new campaign cannot seal before the role-qualified reviewer set exists (fail-closed)", () => {
  const spec = buildRecoveryExperimentSpec(BASE_INPUTS);

  // prepareRecoverySeal never seals in this package, and honestly records that
  // no role-qualified set exists.
  const prep = prepareRecoverySeal(
    spec, EMPTY_REGISTRY, RECOVERY_REQUIRED_ROLES,
    { assertNotClosed, assertRoleSetReady: assertRoleSetNotReady }, "2026-07-12T00:00:00.000Z",
  );
  assert.equal(prep.sealed, false);
  assert.equal(prep.roleQualifiedSetExists, false);
  assert.ok(/does not exist/.test(prep.sealBlockedReason));
  assert.equal(prep.separateAuthorizationRequired, true);

  // sealRecoveryExperiment is fail-closed: it THROWS when the role set is not ready.
  assert.throws(
    () => sealRecoveryExperiment(
      spec, EMPTY_REGISTRY, RECOVERY_REQUIRED_ROLES,
      { assertNotClosed, assertRoleSetReady: assertRoleSetNotReady, selectRoleJudges: selectRoleJudgesOk }, "2026-07-12T00:00:00.000Z",
    ),
    /no role-qualified reviewer set/,
    "sealing must fail closed before qualification",
  );

  // A closed old id can NEVER be sealed even if roles were ready.
  assert.throws(
    () => sealRecoveryExperiment(
      { ...spec, experimentId: "layer-n-v2-qualification" }, EMPTY_REGISTRY, RECOVERY_REQUIRED_ROLES,
      { assertNotClosed, assertRoleSetReady: assertRoleSetReadyOk, selectRoleJudges: selectRoleJudgesOk }, "2026-07-12T00:00:00.000Z",
    ),
    "a closed old campaign id must never seal",
  );

  // The go-forward path: once the role set is ready, sealing succeeds and records
  // the frozen per-role judge selection.
  const seal = sealRecoveryExperiment(
    spec, EMPTY_REGISTRY, RECOVERY_REQUIRED_ROLES,
    { assertNotClosed, assertRoleSetReady: assertRoleSetReadyOk, selectRoleJudges: selectRoleJudgesOk }, "2026-07-12T00:00:00.000Z",
  );
  assert.equal(seal.schema, "split-lane-recovery-seal-v1");
  assert.equal(seal.sealedRoleSelection.reader, RECOVERY_CANDIDATE_JUDGE_PROFILES[0].profileId);
  assert.ok(seal.sealedRoleSelection.source && seal.sealedRoleSelection.quiz);

  // Even when roles ARE ready, this package still only PREPARES (never seals).
  const prepReady = prepareRecoverySeal(
    spec, EMPTY_REGISTRY, RECOVERY_REQUIRED_ROLES,
    { assertNotClosed, assertRoleSetReady: assertRoleSetReadyOk }, "2026-07-12T00:00:00.000Z",
  );
  assert.equal(prepReady.sealed, false);
  assert.equal(prepReady.roleQualifiedSetExists, true);
});

// ── integration 14 — pilot dry run makes zero model calls ─────────────────────

test("integration 14: the recovery pilot dry run plans 16 cells, makes ZERO model calls, and every route is the injected test route", () => {
  const spec = buildRecoveryExperimentSpec(BASE_INPUTS);

  let spawnAttempts = 0;
  const onSpawnAttempt = (): never => {
    spawnAttempts += 1;
    throw new Error("a dry run must not spawn any model call");
  };

  const dry = runRecoveryPilotDryRun(spec, { assertNotClosed, onSpawnAttempt }, "2026-07-12T00:00:00.000Z");

  assert.equal(spawnAttempts, 0, "the spawn double must never be invoked");
  assert.equal(dry.modelCallsMade, 0);
  assert.equal(dry.apiCallsMade, 0);
  assert.equal(dry.cellCount, 16);
  assert.equal(dry.routeInvariantHeld, true);
  // Every planned spawn resolves to the injected test route — no API, no fallback.
  for (const s of dry.plannedSpawns) {
    assert.equal(s.route.executionRoute, "injected_test_runner");
    assert.equal(s.route.authMode, "test");
    assert.equal(s.route.apiKeyPresent, false);
    assert.equal(s.route.apiFallbackAllowed, false);
  }
  // The frozen balanced audit subset is one cell per stratum (4), chosen before output.
  assert.equal(dry.auditSubsetCellIds.length, 4);
  assert.equal(recoveryAuditSubsetCellIds(spec.candidateInputs.diagnostic).length, 4);
  // Anti-rotation: one fixed role-assignment hash used for every cell.
  assert.equal(dry.fixedRoleAssignmentSha256, spec.instrumentManifest.fixedRoleAssignmentSha256);
  assert.ok(dry.stopConditions.includes("API route"));

  // A dry run of a CLOSED old id is refused at the closure gate.
  assert.throws(
    () => runRecoveryPilotDryRun({ ...spec, experimentId: "diagnostic-stack-2026-07" }, { assertNotClosed }, "2026-07-12T00:00:00.000Z"),
    "a closed old campaign cannot be dry-run",
  );
});

// ── the injected function-type aliases bind the real B4/B5 signatures ─────────

test("recovery conductor deps type-check against the Wave-A frozen B4/B5 signatures", () => {
  // Doubles that satisfy the frozen aliases exactly — proves the recovery
  // conductor consumes siblings only via the frozen signatures (no divergence).
  const aggregate = (input: AggregateChapterReviewInputV1): AggregatedChapterReviewV1 => ({
    schema: "aggregated-chapter-review-v1",
    chapterContentSha256: input.chapterContentSha256,
    readerResultSha256: "r", sourceResultSha256: "s", quizResultSha256: "q",
    deterministicCriticBundleSha256: input.deterministic.bundleSha256,
    readerComposite: 0, readerBar: input.readerBar,
    finalStatus: "INCONCLUSIVE", blockingReasons: [], revisionReasons: [], escalationReasons: [],
  });
  const assignFixedRoles = (_spec: ExperimentSpecV1, _record: MigrationSampleRecordV1): FixedRoleAssignmentV1 =>
    buildRecoveryExperimentSpec(BASE_INPUTS).roleAssignment;
  // The doubles are structurally the frozen aliases; a compile is the assertion.
  assert.equal(typeof aggregate, "function");
  assert.equal(typeof assignFixedRoles, "function");
  assert.equal(enumerateRecoveryCells().length, 16);
});

// ── unit test 35 — no recovery artifact mutates canonical chapter state ───────

test("test 35: recovery artifacts write ONLY under the isolated experiment dir — never canonical state/chapters or state/books", () => {
  const spec = buildRecoveryExperimentSpec(BASE_INPUTS);
  const prep = prepareRecoverySeal(
    spec, EMPTY_REGISTRY, RECOVERY_REQUIRED_ROLES,
    { assertNotClosed, assertRoleSetReady: assertRoleSetNotReady }, "2026-07-12T00:00:00.000Z",
  );
  const dry = runRecoveryPilotDryRun(spec, { assertNotClosed }, "2026-07-12T00:00:00.000Z");
  const files = recoveryArtifactFiles(spec, prep, dry);

  assert.equal(files.length, 3);
  const roots = mkTestRoots("recovery-artifacts");
  try {
    for (const f of files) {
      // Every relPath is confined to the isolated experiment directory and names
      // NO canonical tree.
      assert.ok(f.relPath.startsWith(`${RECOVERY_EXPERIMENT_ID}/`), `relPath must stay in the experiment dir: ${f.relPath}`);
      assert.ok(!f.relPath.includes("state/chapters"), "no canonical chapters path");
      assert.ok(!f.relPath.includes("state/books"), "no canonical books path");

      const abs = resolve(roots.base, f.relPath);
      assert.ok(abs.startsWith(roots.base), "write must stay under the test root");
      assert.ok(!abs.includes("/state/chapters/"), "resolved path must not enter canonical chapters");
      assert.ok(!abs.includes("/state/books/"), "resolved path must not enter canonical books");
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, f.bytes);
      assert.ok(existsSync(abs), "artifact written under the isolated root");
      // The bytes round-trip as valid JSON.
      JSON.parse(f.bytes);
    }
  } finally {
    roots.dispose();
  }
});

// ── committed-artifact consistency (env-guarded on a corpus-complete checkout) ─

xenv(
  "committed spec.json / seal-prep.json are internally consistent (spec hash matches seal-prep binding)",
  "committed recovery artifacts not present on this checkout",
  () => existsSync(resolve("state/migration-experiments/s16-reviewer-recovery-v1/spec.json")),
  () => {
    const dir = resolve("state/migration-experiments/s16-reviewer-recovery-v1");
    const spec = JSON.parse(readFileSync(resolve(dir, "spec.json"), "utf8"));
    const prep = JSON.parse(readFileSync(resolve(dir, "seal-prep.json"), "utf8"));

    assert.equal(spec.schema, "split-lane-recovery-experiment-spec-v1");
    assert.equal(spec.experimentId, RECOVERY_EXPERIMENT_ID);
    assert.equal(spec.imp13Dormant, true);
    assert.equal(spec.productionActivation, false);
    assert.equal(spec.separateAuthorizationRequired, true);
    assert.deepEqual(spec.bookSpecificExceptions, []);
    assert.doesNotThrow(() => assertNotClosed(spec.experimentId));

    assert.equal(prep.sealed, false, "committed seal-prep is never sealed");
    assert.equal(prep.roleQualifiedSetExists, false, "no role-qualified set exists yet");
    assert.equal(prep.specSha256, hashCanonical(spec), "seal-prep binds the committed spec hash");
    assert.equal(prep.instrumentManifestSha256, splitLaneInstrumentManifestSha256(spec.instrumentManifest));
    assert.equal(prep.fixedRoleAssignmentSha256, spec.instrumentManifest.fixedRoleAssignmentSha256);
    assert.equal(prep.proposedHardCeiling, RECOVERY_PROPOSED_HARD_CEILING);
  },
);
