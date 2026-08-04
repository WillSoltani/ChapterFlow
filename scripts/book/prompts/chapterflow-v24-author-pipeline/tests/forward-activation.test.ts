/** Dormant local forward-activation policy: strict prerequisites, explicit SOL
 * routes, fixed reviewers, no external effects, and auditable rollback. */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical } from "../src/contracts/contractUtil.js";
import {
  FORWARD_ACTIVATION_SCHEMA,
  FORWARD_ROLLBACK_TRIGGERS,
  ForwardActivationError,
  LOCAL_ROUTE_PROFILE_SCHEMA,
  SOL_FORWARD_PROFILE_ID,
  SOL_FORWARD_WRITER_MODEL,
  VERIFIED_NO_API_ROUTE_SCHEMA,
  activateForwardPolicy,
  bindVerifiedNoApiRoute,
  buildForwardActivationPolicy,
  fixedReviewerProfilesHash,
  parseForwardActivationPolicy,
  resolveForwardWriterRoute,
  rollbackForwardPolicy,
  validateForwardActivationPolicy,
  type FixedReviewerProfilesV1,
  type ForwardActivationIO,
  type ForwardActivationRequestV1,
  type LocalForwardRouteProfileV1,
  type QualifiedReviewerProfileV1,
  type VerifiedNoApiRouteCoreV1,
} from "../src/orchestrator/forwardActivation.js";
import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const POLICY_PATH = "/injected/local/forward-activation.json";
const sha = (char: string): string => char.repeat(64);

function reviewer(model: string, effort: QualifiedReviewerProfileV1["effort"], hashChar: string): QualifiedReviewerProfileV1 {
  return {
    profileId: `${model}@${effort}`,
    model,
    effort,
    qualificationHash: sha(hashChar),
  };
}

function reviewers(): FixedReviewerProfilesV1 {
  return {
    readerPrimary: reviewer("gpt-5.5", "high", "1"),
    readerBackup: reviewer("gpt-5.5", "xhigh", "2"),
    sourcePrimary: reviewer("gpt-5.6-sol", "high", "3"),
    sourceAdjudicator: reviewer("gpt-5.5", "xhigh", "4"),
    quizAdjudicator: reviewer("gpt-5.5", "high", "5"),
    quizChecker: { deterministic: true, checkerVersion: "quiz-answer-tell-checker-v1" },
  };
}

function previousProfile(fixed = reviewers()): LocalForwardRouteProfileV1 {
  return {
    schema: LOCAL_ROUTE_PROFILE_SCHEMA,
    profileId: "previous-qualified-local-v1",
    writer: { model: "gpt-5.5", effort: "high" },
    highRiskWriter: { model: "gpt-5.5", effort: "xhigh" },
    reviewers: fixed,
  };
}

function routeProof(): ReturnType<typeof bindVerifiedNoApiRoute> {
  const core: VerifiedNoApiRouteCoreV1 = {
    schema: VERIFIED_NO_API_ROUTE_SCHEMA,
    verified: true,
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    routePolicyVersion: "route-policy-v1.0",
    executionProfileHash: sha("a"),
    cliVersion: "codex-cli-test",
  };
  return bindVerifiedNoApiRoute(core);
}

function activationRequest(): ForwardActivationRequestV1 {
  const fixed = reviewers();
  return {
    activationId: "forward-local-activation-001",
    activatedAt: "2026-07-12T18:00:00.000Z",
    qualificationPassed: true,
    pilotPassed: true,
    goldBookPassed: true,
    hardGateFailures: [],
    frozenRoleAssignmentHash: fixedReviewerProfilesHash(fixed),
    fixedReviewerProfiles: fixed,
    noApiRoute: routeProof(),
    previousProfile: previousProfile(fixed),
    evidence: {
      qualificationEvidenceHash: sha("b"),
      pilotEvidenceHash: sha("c"),
      goldBookEvidenceHash: sha("d"),
    },
  };
}

type MemoryPolicyStore = {
  io: ForwardActivationIO;
  writes: Array<{ path: string; text: string }>;
  text: () => string | null;
};

function memoryPolicyStore(initial: string | null = null): MemoryPolicyStore {
  let stored = initial;
  const writes: Array<{ path: string; text: string }> = [];
  return {
    io: {
      readText: () => stored,
      writeTextAtomic: (path, text) => {
        writes.push({ path, text });
        stored = text;
      },
    },
    writes,
    text: () => stored,
  };
}

function cloneRequest(): ForwardActivationRequestV1 {
  return JSON.parse(JSON.stringify(activationRequest())) as ForwardActivationRequestV1;
}

test("activation refuses every required failed prerequisite and performs no write", () => {
  const cases: Array<{ name: string; mutate: (request: ForwardActivationRequestV1) => void; expected: RegExp }> = [
    { name: "qualification", mutate: (r) => { r.qualificationPassed = false; }, expected: /qualificationPassed/ },
    { name: "pilot", mutate: (r) => { r.pilotPassed = false; }, expected: /pilotPassed/ },
    { name: "gold book", mutate: (r) => { r.goldBookPassed = false; }, expected: /goldBookPassed/ },
    { name: "hard gate", mutate: (r) => { r.hardGateFailures = ["epistemic_gate"]; }, expected: /hardGateFailures/ },
    { name: "assignment hash", mutate: (r) => { r.frozenRoleAssignmentHash = sha("0"); }, expected: /does not bind fixedReviewerProfiles/ },
    {
      name: "route not verified",
      mutate: (r) => { (r.noApiRoute as unknown as { verified: boolean }).verified = false; },
      expected: /noApiRoute\.verified/,
    },
    {
      name: "API fallback",
      mutate: (r) => { (r.noApiRoute as unknown as { apiFallbackAllowed: boolean }).apiFallbackAllowed = true; },
      expected: /apiFallbackAllowed/,
    },
  ];

  for (const entry of cases) {
    const request = cloneRequest();
    entry.mutate(request);
    const store = memoryPolicyStore();
    assert.throws(
      () => activateForwardPolicy(POLICY_PATH, request, store.io),
      (error: unknown) => error instanceof ForwardActivationError && entry.expected.test(error.message),
      entry.name,
    );
    assert.equal(store.writes.length, 0, `${entry.name}: refusal must happen before persistence`);
  }
});

test("qualified activation writes exactly one atomic local policy with fixed routes and reviewers", () => {
  const request = activationRequest();
  const store = memoryPolicyStore();
  const policy = activateForwardPolicy(POLICY_PATH, request, store.io);

  assert.equal(policy.schema, FORWARD_ACTIVATION_SCHEMA);
  assert.equal(policy.status, "ACTIVE");
  assert.equal(policy.localOnly, true);
  assert.deepEqual(policy.activatedProfile.writer, { model: SOL_FORWARD_WRITER_MODEL, effort: "high" });
  assert.deepEqual(policy.activatedProfile.highRiskWriter, { model: SOL_FORWARD_WRITER_MODEL, effort: "xhigh" });
  assert.deepEqual(policy.activatedProfile.reviewers, request.fixedReviewerProfiles);
  assert.deepEqual(policy.previousProfile, request.previousProfile);
  assert.deepEqual(policy.selectedProfile, policy.activatedProfile);
  assert.deepEqual(policy.rollbackTriggers, [...FORWARD_ROLLBACK_TRIGGERS]);
  assert.deepEqual(policy.criteria.hardGateFailures, []);
  assert.equal(policy.criteria.frozenRoleAssignmentHash, fixedReviewerProfilesHash(policy.activatedProfile.reviewers));
  assert.deepEqual([policy.publish, policy.promotion, policy.deployment, policy.upload], [false, false, false, false]);

  assert.equal(store.writes.length, 1, "activation is one atomic single-file write");
  assert.equal(store.writes[0].path, POLICY_PATH);
  assert.ok(store.writes[0].text.endsWith("\n"));
  assert.deepEqual(parseForwardActivationPolicy(store.writes[0].text), policy);

  assert.throws(
    () => activateForwardPolicy(POLICY_PATH, request, store.io),
    /refusing an implicit overwrite/,
  );
  assert.equal(store.writes.length, 1, "an existing policy is never overwritten implicitly");
});

test("writer route resolution pins ordinary high and high-risk xhigh with no silent fallback", () => {
  const policy = buildForwardActivationPolicy(activationRequest());
  assert.deepEqual(resolveForwardWriterRoute(policy, "ordinary"), {
    profileId: SOL_FORWARD_PROFILE_ID,
    riskClass: "ordinary",
    model: SOL_FORWARD_WRITER_MODEL,
    effort: "high",
    source: FORWARD_ACTIVATION_SCHEMA,
  });
  assert.deepEqual(resolveForwardWriterRoute(policy, "high-risk"), {
    profileId: SOL_FORWARD_PROFILE_ID,
    riskClass: "high-risk",
    model: SOL_FORWARD_WRITER_MODEL,
    effort: "xhigh",
    source: FORWARD_ACTIVATION_SCHEMA,
  });
  assert.throws(
    () => resolveForwardWriterRoute(policy, "unknown" as never),
    /no silent fallback is allowed/,
  );
});

test("publish, promotion, deployment, and upload remain literal false and unsafe input is rejected", () => {
  const clean = buildForwardActivationPolicy(activationRequest());
  for (const capability of ["publish", "promotion", "deployment", "upload"] as const) {
    const tampered = JSON.parse(JSON.stringify(clean)) as unknown as Record<string, unknown>;
    tampered[capability] = true;
    assert.ok(
      validateForwardActivationPolicy(tampered).some((error) => error.includes(`policy.${capability}`)),
      `${capability}=true must be schema-invalid`,
    );
    assert.throws(
      () => resolveForwardWriterRoute(tampered as never, "ordinary"),
      ForwardActivationError,
    );
  }

  const unsafeRequest = activationRequest() as ForwardActivationRequestV1 & { publish: boolean };
  unsafeRequest.publish = true;
  assert.throws(() => buildForwardActivationPolicy(unsafeRequest), /unexpected "publish"/);
});

test("rollback is explicit and auditable, atomically restores the previous profile, and cannot repeat", () => {
  const store = memoryPolicyStore();
  const active = activateForwardPolicy(POLICY_PATH, activationRequest(), store.io);
  const priorHash = hashCanonical(active);
  const rolledBack = rollbackForwardPolicy(POLICY_PATH, {
    rollbackId: "rollback-001",
    rolledBackAt: "2026-07-12T19:00:00.000Z",
    trigger: "operator_requested",
    reason: "Owner-requested local rollback after verification exercise.",
  }, store.io);

  assert.equal(rolledBack.status, "ROLLED_BACK");
  assert.deepEqual(rolledBack.selectedProfile, active.previousProfile);
  assert.equal(rolledBack.rollback.fromProfileId, SOL_FORWARD_PROFILE_ID);
  assert.equal(rolledBack.rollback.restoredProfileId, active.previousProfile.profileId);
  assert.equal(rolledBack.rollback.priorActivePolicyHash, priorHash);
  assert.equal(rolledBack.rollback.trigger, "operator_requested");
  assert.equal(store.writes.length, 2, "activation and rollback each perform one atomic write");
  assert.deepEqual(parseForwardActivationPolicy(store.text()!), rolledBack);

  assert.deepEqual(resolveForwardWriterRoute(rolledBack, "ordinary"), {
    profileId: active.previousProfile.profileId,
    riskClass: "ordinary",
    model: active.previousProfile.writer.model,
    effort: active.previousProfile.writer.effort,
    source: FORWARD_ACTIVATION_SCHEMA,
  });
  assert.deepEqual(resolveForwardWriterRoute(rolledBack, "high-risk"), {
    profileId: active.previousProfile.profileId,
    riskClass: "high-risk",
    model: active.previousProfile.highRiskWriter.model,
    effort: active.previousProfile.highRiskWriter.effort,
    source: FORWARD_ACTIVATION_SCHEMA,
  });

  assert.throws(
    () => rollbackForwardPolicy(POLICY_PATH, {
      rollbackId: "rollback-002",
      rolledBackAt: "2026-07-12T20:00:00.000Z",
      trigger: "operator_requested",
      reason: "Must not overwrite the first audit event.",
    }, store.io),
    /already rolled back/,
  );
  assert.equal(store.writes.length, 2, "second rollback is refused before persistence");
});

test("forward activation module has no ambient filesystem, environment, clock, or default-path mutation", () => {
  const source = readFileSync(resolve(PIPELINE_DIR, "src", "orchestrator", "forwardActivation.ts"), "utf8");
  assert.doesNotMatch(source, /from ["'](?:node:)?fs["']/);
  assert.doesNotMatch(source, /process\.env|Date\.now\(|new Date\(|tmpdir\(/);
  assert.doesNotMatch(source, /writeFileAtomic/);
  assert.match(source, /writeTextAtomic/);
});
