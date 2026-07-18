import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical } from "../src/contracts/contractUtil.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER,
  candidateAvailabilityProvenanceSha256,
  candidateAvailabilitySemanticProjectionV3,
  candidateAvailabilitySemanticSha256,
  candidateAvailabilitySha256,
  type CandidateAvailabilityV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
  IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
  candidateAvailabilityPolicySha256,
  discoverCandidateAvailabilityV3,
} from "../src/orchestrator/forwardRoleQualificationLiveV3.js";
import {
  assertImp24CandidateAvailabilitySemanticResumeV3,
  stableRoleQualificationCampaignReportProjectionV3,
  type Imp24RoleQualificationCampaignReportV1,
} from "../src/orchestrator/forwardRoleQualificationCampaignV3.js";
import { sameImp24ETransportSmokeBindingSemantics } from "../src/orchestrator/forwardTransportSmokeCampaignV3.js";
import type { Imp24DTransportSmokeInputBindingV1 } from "../src/orchestrator/forwardTransportSmokeEvidenceV3.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const VERIFIED_AT = "2026-07-14T14:00:00.000Z";

function advertisedModels() {
  const bySlug = new Map<string, Set<string>>();
  for (const role of ["reader", "source", "quiz"] as const) {
    for (const candidate of IMP24_ROLE_CANDIDATE_ORDER[role]) {
      const efforts = bySlug.get(candidate.model) ?? new Set<string>();
      efforts.add(candidate.effort);
      bySlug.set(candidate.model, efforts);
    }
  }
  return [...bySlug].map(([slug, efforts]) => ({
    slug,
    visibility: "list",
    supported_reasoning_levels: [...efforts].sort().map((effort) => ({ effort })),
  }));
}

function discover(cachePath: string): CandidateAvailabilityV3 {
  return discoverCandidateAvailabilityV3({
    policy: IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
    policyBytesSha256: IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
    modelsCachePath: cachePath,
    verifiedAt: VERIFIED_AT,
  });
}

test("IMP-24E timestamp/raw-format refresh changes provenance but not availability semantics", () => {
  const roots = mkTestRoots("imp24e-availability-provenance");
  try {
    const firstPath = resolve(roots.base, "models-cache-first.json");
    const secondPath = resolve(roots.base, "models-cache-second.json");
    const models = advertisedModels();
    writeFileSync(firstPath, JSON.stringify({
      client_version: "0.144.0",
      fetched_at: "2026-07-14T13:00:00.000Z",
      models,
    }));
    writeFileSync(secondPath, `${JSON.stringify({
      models,
      fetched_at: "2026-07-14T13:46:36.164Z",
      client_version: "0.144.0",
    }, null, 4)}\n`);

    const first = discover(firstPath);
    const second = discover(secondPath);
    assert.equal(first.semanticSha256, second.semanticSha256);
    assert.notEqual(first.availabilitySha256, second.availabilitySha256,
      "the archived full-snapshot identity remains provenance-sensitive");
    assert.deepEqual(candidateAvailabilitySemanticProjectionV3(first),
      candidateAvailabilitySemanticProjectionV3(second));
    assert.notEqual(first.provenanceSha256, second.provenanceSha256);
    assert.equal(first.provenanceSha256, candidateAvailabilityProvenanceSha256(first));
    assert.equal(second.provenanceSha256, candidateAvailabilityProvenanceSha256(second));
    assert.notEqual(first.sourceBytesSha256, second.sourceBytesSha256);
    assert.notEqual(first.sourceFetchedAt, second.sourceFetchedAt);
    assert.equal(first.entries.every((entry) => entry.reasonCode === "AVAILABLE"), true);
  } finally {
    roots.dispose();
  }
});

test("IMP-24E semantic availability hash changes only for behavior-affecting projection drift", () => {
  const roots = mkTestRoots("imp24e-availability-semantics");
  try {
    const cachePath = resolve(roots.base, "models-cache.json");
    writeFileSync(cachePath, JSON.stringify({
      client_version: "0.144.0",
      fetched_at: "2026-07-14T13:30:00.000Z",
      models: advertisedModels(),
    }));
    const available = discover(cachePath);

    const unavailable = structuredClone(available);
    unavailable.entries[0] = {
      ...unavailable.entries[0],
      status: "UNAVAILABLE",
      modelListed: false,
      reasonCode: "MODEL_NOT_LISTED",
      reason: "exact model slug absent from local Codex cache",
    };
    assert.notEqual(candidateAvailabilitySemanticSha256(unavailable), available.semanticSha256);

    const unsupportedEffort = structuredClone(available);
    unsupportedEffort.entries[0] = {
      ...unsupportedEffort.entries[0],
      status: "UNAVAILABLE",
      effortSupported: false,
      reasonCode: "EFFORT_UNSUPPORTED",
      reason: "reasoning effort is not advertised",
    };
    assert.notEqual(candidateAvailabilitySemanticSha256(unsupportedEffort), available.semanticSha256);

    const notVisible = structuredClone(available);
    notVisible.entries[0] = {
      ...notVisible.entries[0],
      status: "UNAVAILABLE",
      visible: false,
      reasonCode: "MODEL_NOT_VISIBLE",
      reason: "diagnostic wording is non-semantic",
    };
    assert.notEqual(candidateAvailabilitySemanticSha256(notVisible), available.semanticSha256);

    const reordered = structuredClone(available);
    reordered.candidateOrderSha256 = hashCanonical(["changed-order"]);
    assert.notEqual(candidateAvailabilitySemanticSha256(reordered), available.semanticSha256);

    const modelChanged = structuredClone(available);
    modelChanged.entries[0] = { ...modelChanged.entries[0], model: "different-model" };
    assert.notEqual(candidateAvailabilitySemanticSha256(modelChanged), available.semanticSha256);

    const provenanceOnly = {
      ...available,
      sourceBytesSha256: "b0f324c6c71bd31ab89b31d5992c77afb3fc8925ad5537d0d9cf4aea721f892e",
      sourceFetchedAt: "2026-07-14T13:46:36.164Z",
      sourceQualifiedAt: "2026-07-14T14:00:00.000Z",
      sourceAgeSeconds: 803.836,
    };
    assert.equal(candidateAvailabilitySemanticSha256(provenanceOnly), available.semanticSha256,
      "the reported b1452c -> b0f324 provenance-only class must not block");
  } finally {
    roots.dispose();
  }
});

test("IMP-24E exact b1452c to b0f324 cache refresh is provenance-only", () => {
  const roots = mkTestRoots("imp24e-exact-reported-cache-refresh");
  try {
    const cachePath = resolve(roots.base, "models_cache.json");
    writeFileSync(cachePath, JSON.stringify({
      client_version: "0.144.0",
      fetched_at: "2026-07-14T13:30:00.000Z",
      models: advertisedModels(),
    }));
    const baseline = discover(cachePath);
    const qualifiedAt = "2026-07-14T14:00:00.000Z";
    const reported = (sourceBytesSha256: string, sourceFetchedAt: string): CandidateAvailabilityV3 => {
      const { availabilitySha256: _legacy, provenanceSha256: _provenance, ...rest } = baseline;
      const core: CandidateAvailabilityV3 = {
        ...rest,
        sourceBytesSha256,
        sourceFetchedAt,
        sourceQualifiedAt: qualifiedAt,
        sourceAgeSeconds: (Date.parse(qualifiedAt) - Date.parse(sourceFetchedAt)) / 1_000,
        provenanceSha256: "0".repeat(64),
        availabilitySha256: "0".repeat(64),
      };
      core.provenanceSha256 = candidateAvailabilityProvenanceSha256(core);
      const { availabilitySha256: _self, ...draft } = core;
      core.availabilitySha256 = candidateAvailabilitySha256(draft);
      return core;
    };
    const oldCache = reported(
      "b1452c5f70a83fdee1d6306ccd2a66275fda1f91719d2bf87eb0915af589f7f6",
      "2026-07-14T11:00:23.719Z",
    );
    const newCache = reported(
      "b0f324c6c71bd31ab89b31d5992c77afb3fc8925ad5537d0d9cf4aea721f892e",
      "2026-07-14T13:46:36.164Z",
    );
    assert.equal(oldCache.sourceBytesSha256,
      "b1452c5f70a83fdee1d6306ccd2a66275fda1f91719d2bf87eb0915af589f7f6");
    assert.equal(newCache.sourceBytesSha256,
      "b0f324c6c71bd31ab89b31d5992c77afb3fc8925ad5537d0d9cf4aea721f892e");
    assert.equal(hashCanonical(oldCache.entries), hashCanonical(newCache.entries));
    assert.equal(candidateAvailabilitySemanticSha256(oldCache),
      candidateAvailabilitySemanticSha256(newCache));
    assert.notEqual(oldCache.provenanceSha256, newCache.provenanceSha256);
    assert.notEqual(oldCache.availabilitySha256, newCache.availabilitySha256);
  } finally {
    roots.dispose();
  }
});

test("IMP-24E terminal report resume permits only preflight/provenance hash churn", () => {
  const sha = (value: string) => value.repeat(64).slice(0, 64);
  const retained = {
    candidateAvailabilitySha256: sha("a"),
    preflightSha256: sha("b"),
    callLedgerSha256: sha("c"),
    artifactBytesSha256: {
      candidateAvailability: sha("d"),
      candidateAvailabilitySemantic: sha("e"),
      candidateAvailabilityProvenance: sha("f"),
      preflight: sha("1"),
      callLedger: sha("2"),
    },
    callCounts: { cachedReceipts: 0 },
    reportSha256: sha("3"),
  } as unknown as Imp24RoleQualificationCampaignReportV1;
  const provenanceRefresh = {
    ...retained,
    preflightSha256: sha("4"),
    callLedgerSha256: sha("5"),
    artifactBytesSha256: {
      ...retained.artifactBytesSha256,
      candidateAvailabilityProvenance: sha("6"),
      preflight: sha("7"),
      callLedger: sha("8"),
    },
    callCounts: { ...retained.callCounts, cachedReceipts: 9 },
    reportSha256: sha("9"),
  };
  assert.deepEqual(
    stableRoleQualificationCampaignReportProjectionV3(provenanceRefresh),
    stableRoleQualificationCampaignReportProjectionV3(retained),
  );
  const semanticDrift = { ...provenanceRefresh, candidateAvailabilitySha256: sha("0") };
  assert.notEqual(
    hashCanonical(stableRoleQualificationCampaignReportProjectionV3(semanticDrift)),
    hashCanonical(stableRoleQualificationCampaignReportProjectionV3(retained)),
  );
});

test("IMP-24E availability honors the frozen 300-second future skew and exact policy hashes", () => {
  const roots = mkTestRoots("imp24e-future-cache");
  try {
    const { policySha256, ...policyCore } = IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY;
    assert.equal(IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY.maximumFutureSkewSeconds, 300);
    assert.equal(policySha256,
      "18273dba06ad95a8bb49d202872f0e18e8762e8847d0560a80673f42d64847e9");
    assert.equal(candidateAvailabilityPolicySha256(policyCore), policySha256);
    assert.equal(IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
      "1f7801eb55bc848b34525c0abb7fb572b16bfad75301c10e3f306ad3f32db90d");

    const writeCache = (name: string, fetchedAt: string): string => {
      const cachePath = resolve(roots.base, name);
      writeFileSync(cachePath, JSON.stringify({
        client_version: "0.144.0",
        fetched_at: fetchedAt,
        models: advertisedModels(),
      }));
      return cachePath;
    };
    const oneMillisecondFuture = discover(writeCache(
      "models-cache-1ms-future.json",
      "2026-07-14T14:00:00.001Z",
    ));
    assert.equal(oneMillisecondFuture.sourceAgeSeconds, -0.001);
    const boundary = discover(writeCache(
      "models-cache-300s-future.json",
      "2026-07-14T14:05:00.000Z",
    ));
    assert.equal(boundary.sourceAgeSeconds, -300);

    const beyondBoundaryPath = writeCache(
      "models-cache-over-300s-future.json",
      "2026-07-14T14:05:00.001Z",
    );
    assert.throws(() => discover(beyondBoundaryPath),
      /candidate availability cache is 301s in the future/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24E fixed smoke bindings and resume ignore provenance but reject semantics", () => {
  const roots = mkTestRoots("imp24e-binding-resume-semantics");
  try {
    const firstPath = resolve(roots.base, "first.json");
    const secondPath = resolve(roots.base, "second.json");
    writeFileSync(firstPath, JSON.stringify({
      client_version: "0.144.0",
      fetched_at: "2026-07-14T13:00:00.000Z",
      models: advertisedModels(),
    }));
    writeFileSync(secondPath, JSON.stringify({
      client_version: "0.144.1",
      fetched_at: "2026-07-14T13:30:00.000Z",
      models: advertisedModels(),
    }, null, 2));
    const first = discover(firstPath);
    const second = discover(secondPath);
    const binding = (availability: CandidateAvailabilityV3) => {
      const { experimentId: _execution, ...candidateAvailability } = availability;
      return {
        candidateAvailability,
        calls: [{ role: "reader" }, { role: "source" }],
      } as unknown as Imp24DTransportSmokeInputBindingV1;
    };
    assert.equal(sameImp24ETransportSmokeBindingSemantics(binding(first), binding(second)), true);
    assert.doesNotThrow(() => assertImp24CandidateAvailabilitySemanticResumeV3(first, second));

    const drifted = structuredClone(second);
    drifted.entries[0] = {
      ...drifted.entries[0],
      status: "UNAVAILABLE",
      modelListed: false,
      reasonCode: "MODEL_NOT_LISTED",
    };
    assert.equal(sameImp24ETransportSmokeBindingSemantics(binding(first), binding(drifted)), false);
    assert.throws(() => assertImp24CandidateAvailabilitySemanticResumeV3(first, drifted),
      /semantics changed on resume before live execution/);
  } finally {
    roots.dispose();
  }
});
