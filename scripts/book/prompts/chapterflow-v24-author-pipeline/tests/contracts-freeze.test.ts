/**
 * IMP-00: Phase-0 contract freeze + validator coverage.
 *
 * The frozen `contract-manifest.json` pins { name, version, hash } for all
 * eighteen cross-package contracts — the nine Phase-0 contracts (execution
 * profile, effective context, candidate transaction, source-use plan, repair,
 * review, route, attempt evidence, worker report) plus the five additive IMP-20
 * split-lane / §16-recovery contracts, the two additive IMP-24 inline-review
 * contracts, the additive WP-102 emission↔web-adapter parity contract, and the
 * additive WP-305 source-projection-boundary contract.
 * Editing a contract without a version bump
 * + regenerated manifest + integration review is the "silent schema drift across
 * parallel branches" merge blocker from master-plan §12 — these tests make that
 * drift a FAIL.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  ALL_CONTRACTS,
  canonicalEmissionSample,
  computeContractManifest,
  contractFreezeDivergences,
  contractHash,
  driftedEmissionSample,
  loadFrozenManifest,
  validateChapterPatch,
  validateEmissionParity,
  validateRepairFinding,
  validateSourceUsePlan,
  validateWorkerReport,
  type SourceUsePlanV1,
  type WorkerImplementationReportV1,
} from "../src/contracts/index.js";
import { validateChapterV21 } from "../src/runtimeSchemas.js";

test("contract manifest is frozen and matches the live descriptors exactly", () => {
  const divergences = contractFreezeDivergences();
  assert.deepEqual(divergences, [], `contract drift detected:\n${divergences.join("\n")}`);
});

test("all eighteen frozen contracts are present at their pinned versions with distinct owners", () => {
  const manifest = loadFrozenManifest();
  // 9 Phase-0 contracts + the 5 additive IMP-20 split-lane / §16-recovery
  // contracts (reader-experience-review, source-integrity-review,
  // quiz-integrity-result, aggregated-chapter-review, judge-capability-qualification)
  // + the 2 additive IMP-24 inline-review contracts (review-evidence-envelope,
  // review-model-output-v2) + the WP-102 additive emission-package parity contract
  // + the WP-305 additive source-projection-boundary contract.
  assert.equal(manifest.contracts.length, 18);
  const names = manifest.contracts.map((c) => c.name).sort();
  assert.deepEqual(names, [
    "aggregated-chapter-review", "attempt-evidence-manifest", "candidate-transaction",
    "effective-context-manifest", "emission-package", "execution-profile",
    "judge-capability-qualification",
    "quiz-integrity-result", "reader-experience-review", "repair", "review-evidence-envelope",
    "review-model-output-v2", "review-output",
    "route-result", "source-integrity-review", "source-projection-boundary", "source-use-plan",
    "worker-implementation-report",
  ]);
  // route-result was deliberately bumped to v2 (owner §16 route-invariant
  // directive 2026-07-11: per-spawn subscription-route telemetry). Every other
  // contract — including the five additive IMP-20 contracts and the IMP-24
  // evidence envelope — is at v1. The semantic-only IMP-24 model output is v2.
  for (const c of manifest.contracts) {
    const expected = c.name === "route-result" || c.name === "review-model-output-v2" ? 2 : 1;
    assert.equal(c.version, expected, `${c.name} must be v${expected}`);
  }
  const owners = new Set(manifest.contracts.map((c) => c.ownerPrompt));
  for (const owner of ["IMP-00", "IMP-01", "IMP-02", "IMP-03", "IMP-07", "IMP-08", "IMP-10", "IMP-20", "IMP-24", "WP-102", "WP-305"]) {
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

// ── WP-102: the emission-package parity contract is additive ──────────────────

// The exact hashes of the sixteen contracts that predate WP-102. Registering the
// additive emission-package descriptor MUST leave every one of these untouched
// (additive-only, mirroring the IMP-20/IMP-24 notes). If any moves, a pre-existing
// descriptor was edited — a freeze violation, not an additive change.
const PRE_WP102_HASHES: Record<string, string> = {
  "aggregated-chapter-review": "47643cc6450888304fff0c4d4ad7110a8d2b401c8a3b0dcd190d77425f658215",
  "attempt-evidence-manifest": "fecbfaaf645ec1634d3fb7e8c61445f495c333c3eb1023aa79dc76461ecfa9d9",
  "candidate-transaction": "531916c55fb467e71053455a8b22c1fe20896687cf523cfc030de80f6393eb68",
  "effective-context-manifest": "11901cface6f421ddf959b4ba137fc87e97179dd6e30144b89dab13022b2bd5a",
  "execution-profile": "aa9a95b242d686ca3ab146aaada810af66eb55cb17eba2727b3be0d398cd5963",
  "judge-capability-qualification": "e05136e482673ccda68d939f1ebfa4fca0393c081c7e6c4c2be3629e18e9718b",
  "quiz-integrity-result": "4d904135f0a101a24380fb840eb2ae67fd0e2d0025c74b57debc50649a3b62e2",
  "reader-experience-review": "0fe113b60b7c323f993da1ba84759d3f3946749b1790df98448c31034900083b",
  "repair": "6641ed79c7fe682cf92d0ae3733a33c6f6fc513a888fb3d6a027b2a8db24b149",
  "review-evidence-envelope": "a293c26b050bf9a7b07059a97516d3305bbd0527ddf8898ba1b96f7aab58a26f",
  "review-model-output-v2": "fef12874436f98155bbd55523ee9ae0fbdadb0a4539a79a95e8d1d3bdb807769",
  "review-output": "f23414bbce201f5ffaa684cec569dae83bed8a99a44a5dbd6b37ef6396c9254f",
  "route-result": "bf7ffa7405ae0dbf3a54d6562e9e8089d62df2e00f247b5240de91ada6dca9fc",
  "source-integrity-review": "cd0f720288b732877025cb7de68bda4e1af52318c879acc3cad6304e072981cc",
  "source-use-plan": "8a07e86f23c3a40c585067cc6e85015600b1fde5ba2e51e7d9f15da2d9314b67",
  "worker-implementation-report": "9fbb345945e86da7b19575a15532d82df6d8d119e1aced02c0c897b2dc7c3f0d",
};

test("WP-102 registration is additive: no pre-existing contractHash moved", () => {
  const live = new Map(ALL_CONTRACTS.map((c) => [c.name, contractHash(c)]));
  const frozen = new Map(loadFrozenManifest().contracts.map((c) => [c.name, c.hash]));
  for (const [name, hash] of Object.entries(PRE_WP102_HASHES)) {
    assert.equal(live.get(name), hash, `${name} live hash moved (pre-existing descriptor edited)`);
    assert.equal(frozen.get(name), hash, `${name} manifest hash moved (non-additive manifest regen)`);
  }
});

test("emission descriptor: a field edit without a version bump is detected as hash drift", () => {
  const mutated = ALL_CONTRACTS.map((c) =>
    c.name === "emission-package" ? { ...c, fields: { ...c.fields, smuggled: "string" } } : c,
  );
  const frozenEmission = loadFrozenManifest().contracts.find((c) => c.name === "emission-package")!;
  const changed = mutated.find((c) => c.name === "emission-package")!;
  assert.notEqual(contractHash(changed), frozenEmission.hash, "mutated emission descriptor must not match the frozen hash");
});

// ── WP-305: the source-projection-boundary contract is additive ───────────────

// The exact hashes of the seventeen contracts that predate WP-305 (the sixteen
// pre-WP-102 contracts + the WP-102 emission-package). Registering the additive
// source-projection-boundary descriptor MUST leave every one of these untouched
// (additive-only, mirroring the IMP-20/IMP-24/WP-102 notes). If any moves, a
// pre-existing descriptor was edited — a freeze violation, not an additive change.
const PRE_WP305_HASHES: Record<string, string> = {
  ...PRE_WP102_HASHES,
  "emission-package": "3e1dbcb905efae7a95eccbe516240620625547230fcc93ddae4c1805b29e472e",
};

test("WP-305 registration is additive: no pre-existing contractHash moved", () => {
  const live = new Map(ALL_CONTRACTS.map((c) => [c.name, contractHash(c)]));
  const frozen = new Map(loadFrozenManifest().contracts.map((c) => [c.name, c.hash]));
  for (const [name, hash] of Object.entries(PRE_WP305_HASHES)) {
    assert.equal(live.get(name), hash, `${name} live hash moved (pre-existing descriptor edited)`);
    assert.equal(frozen.get(name), hash, `${name} manifest hash moved (non-additive manifest regen)`);
  }
});

test("source-projection-boundary descriptor: a field edit without a version bump is detected as hash drift", () => {
  const mutated = ALL_CONTRACTS.map((c) =>
    c.name === "source-projection-boundary" ? { ...c, fields: { ...c.fields, smuggled: "string" } } : c,
  );
  const frozen = loadFrozenManifest().contracts.find((c) => c.name === "source-projection-boundary")!;
  const changed = mutated.find((c) => c.name === "source-projection-boundary")!;
  assert.notEqual(contractHash(changed), frozen.hash, "mutated source-projection-boundary descriptor must not match the frozen hash");
});

// ── WP-102: the emission↔web-adapter parity validator ─────────────────────────

test("emission parity: the canonical sample is conformant and validateChapterV21-clean", () => {
  const sample = canonicalEmissionSample();
  assert.deepEqual(validateEmissionParity(sample), []);
  for (const ch of sample.chapters as unknown[]) {
    assert.ok(validateChapterV21(ch).ok, "canonical sample chapter must pass validateChapterV21");
  }
});

test("emission parity: an envelope field the adapters do not read is flagged as drift", () => {
  const drift = driftedEmissionSample();
  const errors = validateEmissionParity(drift);
  assert.ok(errors.some((e) => e.includes("audioNarration") && e.includes("not consumed")), errors.join("\n"));
});

test("emission parity: a missing required consumed field is flagged", () => {
  const sample = canonicalEmissionSample();
  delete (sample.chapters as Array<Record<string, unknown>>)[0].hook;
  assert.ok(validateEmissionParity(sample).some((e) => e.includes('missing required field "hook"')));
});

test("emission parity: an unconsumed top-level and breakdown field are both flagged", () => {
  const top = canonicalEmissionSample();
  (top as Record<string, unknown>).surprise = 1;
  assert.ok(validateEmissionParity(top).some((e) => e.startsWith("emission: field \"surprise\"")));
  const bd = canonicalEmissionSample();
  ((bd.chapters as Array<Record<string, unknown>>)[0].breakdown as Record<string, unknown>).ultraRead = "x";
  assert.ok(validateEmissionParity(bd).some((e) => e.includes("breakdown: field \"ultraRead\"")));
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
