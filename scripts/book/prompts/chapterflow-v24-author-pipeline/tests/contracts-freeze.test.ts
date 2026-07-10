/**
 * IMP-00: Phase-0 contract freeze + validator coverage.
 *
 * The frozen `contract-manifest.json` pins { name, version, hash } for all nine
 * cross-package contracts (execution profile, effective context, candidate
 * transaction, source-use plan, repair, review, route, attempt evidence, worker
 * report). Editing a contract without a version bump + regenerated manifest +
 * integration review is the "silent schema drift across parallel branches"
 * merge blocker from master-plan §12 — these tests make that drift a FAIL.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  ALL_CONTRACTS,
  computeContractManifest,
  contractFreezeDivergences,
  contractHash,
  loadFrozenManifest,
  validateChapterPatch,
  validateRepairFinding,
  validateSourceUsePlan,
  validateWorkerReport,
  type SourceUsePlanV1,
  type WorkerImplementationReportV1,
} from "../src/contracts/index.js";

test("contract manifest is frozen and matches the live descriptors exactly", () => {
  const divergences = contractFreezeDivergences();
  assert.deepEqual(divergences, [], `contract drift detected:\n${divergences.join("\n")}`);
});

test("all nine Phase-0 contracts are present at version 1 with distinct owners", () => {
  const manifest = loadFrozenManifest();
  assert.equal(manifest.contracts.length, 9);
  const names = manifest.contracts.map((c) => c.name).sort();
  assert.deepEqual(names, [
    "attempt-evidence-manifest", "candidate-transaction", "effective-context-manifest",
    "execution-profile", "repair", "review-output", "route-result",
    "source-use-plan", "worker-implementation-report",
  ]);
  for (const c of manifest.contracts) assert.equal(c.version, 1, `${c.name} must be v1 at freeze`);
  const owners = new Set(manifest.contracts.map((c) => c.ownerPrompt));
  for (const owner of ["IMP-00", "IMP-01", "IMP-02", "IMP-03", "IMP-07", "IMP-08", "IMP-10"]) {
    assert.ok(owners.has(owner), `expected an ${owner}-owned contract`);
  }
});

test("a field change without a version bump is detected as hash drift", () => {
  const mutated = ALL_CONTRACTS.map((c) =>
    c.name === "repair" ? { ...c, fields: { ...c.fields, smuggled: "string" } } : c,
  );
  const frozen = loadFrozenManifest();
  const changed = mutated.find((c) => c.name === "repair")!;
  const frozenRepair = frozen.contracts.find((c) => c.name === "repair")!;
  assert.notEqual(contractHash(changed), frozenRepair.hash, "mutated descriptor must not match the frozen hash");
});

test("computeContractManifest is deterministic for a fixed timestamp", () => {
  const a = computeContractManifest("2026-07-10T00:00:00.000Z");
  const b = computeContractManifest("2026-07-10T00:00:00.000Z");
  assert.deepEqual(a, b);
});

// ── worker-report validator: adverse/empty fields are explicit ────────────────

function validReport(): WorkerImplementationReportV1 {
  return {
    schema: "worker-implementation-report-v1",
    promptId: "IMP-00",
    baselineHash: "abc",
    resultHash: "def",
    contractVersions: { "execution-profile": 1 },
    filesChanged: ["src/x.ts"],
    requirementsImplemented: [{ requirementId: "IMP00-R01", status: "implemented" }],
    testsRequired: ["contracts-freeze"],
    testsRun: ["contracts-freeze"],
    testResults: { pass: 1, fail: 0, xfail: 0, xpass: 0, skip: 0, xenv: 0, commands: ["npm test"] },
    gateChanges: [],
    bookSpecificExceptions: [],
    unexpectedWrites: [],
    unresolvedRisks: [],
    dependencyAssumptions: [],
  };
}

test("worker report: a fully explicit report validates", () => {
  assert.deepEqual(validateWorkerReport(validReport()), []);
});

test("worker report: omitting an adverse field (unexpectedWrites) is a schema violation", () => {
  const r = validReport() as unknown as Record<string, unknown>;
  delete r.unexpectedWrites;
  assert.ok(validateWorkerReport(r).some((e) => e.includes("unexpectedWrites")));
});

test("worker report: deferred requirement must name deferredTo", () => {
  const r = validReport();
  r.requirementsImplemented.push({ requirementId: "IMP00-R99", status: "deferred" });
  assert.ok(validateWorkerReport(r).some((e) => e.includes("deferredTo")));
});

test("worker report: promptId must be IMP-NN", () => {
  const r = { ...validReport(), promptId: "imp0" };
  assert.ok(validateWorkerReport(r).some((e) => e.includes("promptId")));
});

// ── source-use-plan validator: the semantic invariants every consumer shares ──

function planWith(unit: Partial<SourceUsePlanV1["units"][number]>): SourceUsePlanV1 {
  return {
    schema: "source-use-plan-v1",
    planVersion: 1,
    bookId: "fixture-book",
    chapterNumber: 1,
    sourcePacketSha256: "deadbeef",
    compilerVersion: "test",
    units: [{
      unitId: "u1",
      origin: "source_bound",
      form: "case",
      claimStrength: "descriptive",
      caseId: "case-1",
      anchorIds: ["a1"],
      allowedDetailTypes: ["decision"],
      forbiddenDetailTypes: ["dialogue"],
      detailSufficiency: "full",
      framingRequired: false,
      ...unit,
    }],
  };
}

test("source plan: a well-formed sourced case validates", () => {
  assert.deepEqual(validateSourceUsePlan(planWith({})), []);
});

test("source plan: sourced case without caseId fails", () => {
  assert.ok(validateSourceUsePlan(planWith({ caseId: undefined })).some((e) => e.includes("caseId")));
});

test("source plan: sourced unit with zero anchors fails", () => {
  assert.ok(validateSourceUsePlan(planWith({ anchorIds: [] })).some((e) => e.includes("anchor")));
});

test("source plan: constructed unit must require framing", () => {
  assert.ok(
    validateSourceUsePlan(planWith({ origin: "constructed", form: "application", caseId: undefined, framingRequired: false }))
      .some((e) => e.includes("framingRequired")),
  );
});

test("source plan: generic unit cannot carry causal claim strength", () => {
  assert.ok(
    validateSourceUsePlan(planWith({ origin: "generic", form: "operational_scenario", caseId: undefined, claimStrength: "causal" }))
      .some((e) => e.includes("causal")),
  );
});

test("source plan: concept_only sufficiency cannot authorize a sourced case scene", () => {
  assert.ok(
    validateSourceUsePlan(planWith({ detailSufficiency: "concept_only" }))
      .some((e) => e.includes("concept_only")),
  );
});

// ── repair contracts: untrusted data cannot expand authority ──────────────────

test("repair finding: control-plane fields are rejected", () => {
  const finding = {
    schema: "repair-finding-v1",
    findingId: "f1", category: "quiz", severity: "must_fix",
    unitIds: ["u1"], evidenceQuotes: ["quote"], violatedInvariantIds: ["Q1"],
    permittedRepairScope: ["quiz.items[0]"], prohibitedChanges: [], sourcePlanDependencies: [],
    recommendedRoute: "surgical",
    model: "gpt-5.6-sol", // injection attempt
  };
  assert.ok(validateRepairFinding(finding).some((e) => e.includes("control-plane")));
});

test("chapter patch: prototype-pollution and parent paths are rejected", () => {
  const base = {
    schema: "chapter-patch-v1", chapterId: "b-ch01", expectedBaseHash: "h", sourcePlanHash: "p",
    findingIds: ["f1"],
  };
  const polluted = { ...base, operations: [{ path: "__proto__.x", expectedOldValueHash: "h", replacement: 1, dependencyUnitIds: [] }] };
  assert.ok(validateChapterPatch(polluted).some((e) => e.includes("prototype-pollution")));
  const parent = { ...base, operations: [{ path: "../other", expectedOldValueHash: "h", replacement: 1, dependencyUnitIds: [] }] };
  assert.ok(validateChapterPatch(parent).some((e) => e.includes("rejected")));
});

test("chapter patch: expectedBaseHash is mandatory (stale patches are rejected, never rebased)", () => {
  const p = {
    schema: "chapter-patch-v1", chapterId: "b-ch01", expectedBaseHash: "", sourcePlanHash: "p",
    findingIds: [], operations: [{ path: "quiz", expectedOldValueHash: "h", replacement: 1, dependencyUnitIds: [] }],
  };
  assert.ok(validateChapterPatch(p).some((e) => e.includes("expectedBaseHash")));
});
