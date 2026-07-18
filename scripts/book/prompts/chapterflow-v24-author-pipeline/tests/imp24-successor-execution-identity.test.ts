import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  IMP24_ROLE_QUALIFICATION_CLOSED_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_ID,
  IMP24_ROLE_QUALIFICATION_PROTOCOL_ID,
  IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
} from "../src/bakeoff/migration/imp24Corpus.js";
import {
  IMP24_FROZEN_ROLE_THRESHOLDS,
  IMP24_ROLE_CANDIDATE_ORDER,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import { FORBIDDEN_PROVIDER_ENV } from "../src/exec/executionEnvelope.js";
import {
  IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
  IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
  discoverCandidateAvailabilityV3,
} from "../src/orchestrator/forwardRoleQualificationLiveV3.js";
import { resolveImp24SuccessorExperimentDir } from "../src/orchestrator/forwardRoleQualificationCampaignV3.js";
import { buildForwardProductionInstrumentSeal } from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CONTRACT_ROOT = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts", "imp24");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

test("IMP-24E keeps protocol/r1/r2 identities frozen while advancing only active execution to final", () => {
  assert.equal(IMP24_ROLE_QUALIFICATION_PROTOCOL_ID, "s16-forward-role-qualification-v3-envelope");
  assert.equal(IMP24_ROLE_QUALIFICATION_ID, IMP24_ROLE_QUALIFICATION_PROTOCOL_ID);
  assert.equal(IMP24_ROLE_QUALIFICATION_CLOSED_EXECUTION_ID, IMP24_ROLE_QUALIFICATION_PROTOCOL_ID);
  assert.equal(IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID, "s16-forward-role-qualification-v3-envelope-r1");
  assert.equal(IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID, "s16-forward-role-qualification-v3-envelope-r2");
  assert.equal(IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID,
    "s16-forward-role-qualification-v3-envelope-final");
  assert.equal(IMP24_ROLE_QUALIFICATION_EXECUTION_ID, IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID);
  assert.notEqual(IMP24_ROLE_QUALIFICATION_EXECUTION_ID, IMP24_ROLE_QUALIFICATION_CLOSED_EXECUTION_ID);
  assert.notEqual(IMP24_ROLE_QUALIFICATION_EXECUTION_ID, IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID);

  const corpus = readJson(resolve(CONTRACT_ROOT, "role-qualification-corpus-bundle.v3-envelope.json"));
  const certification = readJson(resolve(CONTRACT_ROOT, "instrument-certification-binding.json"));
  assert.equal(corpus.experimentId, IMP24_ROLE_QUALIFICATION_PROTOCOL_ID);
  assert.equal(certification.experimentId, IMP24_ROLE_QUALIFICATION_PROTOCOL_ID);
  assert.equal(
    corpus.substantiveBundleSha256,
    "sha256:4501809686161a541ad776bdbfea9c716ec402d89ef397a072f93143ce28fcac",
  );
  assert.equal(certification.promptBundleSha256, "4da98a79943739dd223f12f5ff7c33bd238a114f065bdd09bfcffa66925aae00");
  assert.equal(certification.schemaBundleSha256, "7e73469d522429deb2d55232e0dbba95725e15ca067da2b8213c10dc43fa6613");
  assert.equal(certification.thresholdsSha256, "8f16369a655a8ea6bf392a5d00c875c1619e4c9c43ec605474c892f75f6450aa");
  assert.equal(hashCanonical(IMP24_FROZEN_ROLE_THRESHOLDS), certification.thresholdsSha256);
  assert.equal(hashCanonical(IMP24_ROLE_CANDIDATE_ORDER), "b688f64ae66f211b2c62270a79157d997bd4dee269dcacd969f7cd9741b44190");

  const closure = readJson(resolve(REPOSITORY_ROOT, "docs", "v25", "reports", "IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.json"));
  assert.equal(closure.executionId, IMP24_ROLE_QUALIFICATION_CLOSED_EXECUTION_ID);
  assert.equal(closure.mayResume, false);
  assert.equal((closure.supersededBy as Record<string, unknown>).executionId, IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID);
  assert.equal(
    basename((closure.stateTreeBinding as Record<string, unknown>).path as string),
    IMP24_ROLE_QUALIFICATION_CLOSED_EXECUTION_ID,
  );
});

test("IMP-24E candidate discovery mints only the final execution identity without reordering profiles", () => {
  const roots = mkTestRoots("imp24-successor-execution-identity");
  try {
    const effortsByModel = new Map<string, Set<string>>();
    for (const role of ["reader", "source", "quiz"] as const) {
      for (const candidate of IMP24_ROLE_CANDIDATE_ORDER[role]) {
        const efforts = effortsByModel.get(candidate.model) ?? new Set<string>();
        efforts.add(candidate.effort);
        effortsByModel.set(candidate.model, efforts);
      }
    }
    const fetchedAt = "2026-07-13T12:00:00.000Z";
    const modelsCachePath = resolve(roots.base, "models_cache.json");
    writeFileSync(modelsCachePath, JSON.stringify({
      fetched_at: fetchedAt,
      models: [...effortsByModel.entries()].map(([slug, efforts]) => ({
        slug,
        visibility: "list",
        supported_reasoning_levels: [...efforts].map((effort) => ({ effort })),
      })),
    }), "utf8");

    const availability = discoverCandidateAvailabilityV3({
      policy: IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
      policyBytesSha256: IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
      modelsCachePath,
      verifiedAt: fetchedAt,
    });
    assert.equal(availability.experimentId, IMP24_ROLE_QUALIFICATION_EXECUTION_ID);
    assert.equal(availability.candidateOrderSha256, hashCanonical(IMP24_ROLE_CANDIDATE_ORDER));
    assert.ok(availability.entries.every((entry) => entry.status === "AVAILABLE"));
    assert.deepEqual(
      availability.entries.map(({ role, ordinal, profileId }) => ({ role, ordinal, profileId })),
      (["reader", "source", "quiz"] as const).flatMap((role) =>
        IMP24_ROLE_CANDIDATE_ORDER[role].map(({ profileId }, ordinal) => ({ role, ordinal, profileId }))),
    );
  } finally {
    roots.dispose();
  }
});

test("IMP-24E campaign accepts only the exact final state root and rejects historical execution roots", () => {
  const successorRoot = resolve(
    REPOSITORY_ROOT,
    "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments",
    IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  );
  const closedRoot = resolve(
    REPOSITORY_ROOT,
    "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments",
    IMP24_ROLE_QUALIFICATION_CLOSED_EXECUTION_ID,
  );
  const r1Root = resolve(
    REPOSITORY_ROOT,
    "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments",
    IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
  );
  const r2Root = resolve(
    REPOSITORY_ROOT,
    "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments",
    IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
  );
  assert.equal(resolveImp24SuccessorExperimentDir(REPOSITORY_ROOT, successorRoot), successorRoot);
  assert.throws(
    () => resolveImp24SuccessorExperimentDir(REPOSITORY_ROOT, closedRoot),
    /requires the exact s16-forward-role-qualification-v3-envelope-final retained state root/,
  );
  assert.throws(
    () => resolveImp24SuccessorExperimentDir(REPOSITORY_ROOT, r1Root),
    /requires the exact s16-forward-role-qualification-v3-envelope-final retained state root/,
  );
  assert.throws(
    () => resolveImp24SuccessorExperimentDir(REPOSITORY_ROOT, r2Root),
    /requires the exact s16-forward-role-qualification-v3-envelope-final retained state root/,
  );
});

test("IMP-24C successor call graph exposes only codex exec and remints the production seal", () => {
  const sources = [
    "src/orchestrator/forwardRoleQualificationCampaignV3.ts",
    "src/orchestrator/forwardRoleQualificationLiveV3.ts",
    "src/bakeoff/migration/roleQualificationRunnerV3.ts",
  ].map((relativePath) => readFileSync(resolve(PIPELINE_DIR, relativePath), "utf8")).join("\n");
  for (const directRoute of [
    /\bfetch\s*\(/,
    /https?\.request\s*\(/,
    /\baxios\b/,
    /new\s+OpenAI\s*\(/,
    /openai\.(?:chat|responses)/,
    /anthropic\.(?:messages|completions)/,
  ]) assert.doesNotMatch(sources, directRoute);
  assert.ok(sources.includes("codex exec") || sources.includes("codex-exec"));
  assert.ok(FORBIDDEN_PROVIDER_ENV.includes("OPENAI_API_KEY"));
  assert.ok(FORBIDDEN_PROVIDER_ENV.includes("ANTHROPIC_API_KEY"));

  const seal = buildForwardProductionInstrumentSeal({ repositoryRoot: REPOSITORY_ROOT });
  assert.notEqual(seal.sealSha256,
    "8ee638990c927fd9c6e15be8754512c0774da0065ce793851927eecde88f4187",
  "control-plane implementation bytes must remint the IMP-24B production seal");
  assert.deepEqual(seal.capabilities, {
    publish: false,
    promote: false,
    deploy: false,
    upload: false,
    api: false,
  });
});
