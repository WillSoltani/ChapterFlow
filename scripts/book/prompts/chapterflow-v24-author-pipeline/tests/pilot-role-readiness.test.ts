/** s16-forward-pilot-role-readiness-v1 (plan v2 P3). Proves: (1) corpus
 * selection is deterministic, hash-pinned to FROZEN inputs, and matches the
 * IMP-24G §5.2-§5.4 mixes exactly; (2) the D9 exclusion holds — the three
 * owner-rubric-audited chapters never anchor "acceptable"; (3) the §5.5
 * thresholds are encoded verbatim (a drift here is threshold weakening);
 * (4) the §5.7 budget arithmetic is structural; (5) canaries are disjoint from
 * holdouts; (6) development-grade labels ride every artifact. Runs against the
 * REAL frozen inputs — xenv-skipped where the corpus bundle is absent. */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { test, xenv } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import {
  IMP24_V3_BUNDLE_REL_PATH,
  OWNER_AUDITED_CONTROL_DOCS,
  PILOT_READINESS_BUDGET,
  PILOT_READINESS_CANDIDATE_ORDERS,
  PILOT_READINESS_COST_PROBE,
  PILOT_READINESS_STOPPING,
  PILOT_READINESS_THRESHOLDS,
  buildPilotRoleReadinessCorpus,
  buildPilotRoleReadinessPlan,
  selectAcceptableControls,
} from "../src/bakeoff/migration/pilotRoleReadinessInstrument.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const BUNDLE_PRESENT = existsSync(resolve(REPOSITORY_ROOT, IMP24_V3_BUNDLE_REL_PATH));

// ── Constants: thresholds, orders, budget (drift = weakening; fail loudly) ───

test("§5.5 thresholds are encoded verbatim — any change here is threshold weakening", () => {
  const r = PILOT_READINESS_THRESHOLDS.reader;
  assert.deepEqual([r.protocolValidity.min, r.protocolValidity.of, r.protocolValidity.zeroMiss], [12, 12, true]);
  assert.deepEqual([r.canarySemanticCorrectness.min, r.canarySemanticCorrectness.of], [2, 2]);
  assert.deepEqual([r.hardBlockerSensitivity.min, r.hardBlockerSensitivity.of, r.hardBlockerSensitivity.zeroMiss], [4, 4, true]);
  assert.deepEqual([r.falseReaderBlockersOnAcceptableAndCraft.min, r.falseReaderBlockersOnAcceptableAndCraft.of, r.falseReaderBlockersOnAcceptableAndCraft.zeroMiss], [8, 8, true]);
  assert.deepEqual([r.acceptableControlSuccess.min, r.acceptableControlSuccess.of], [3, 4]);
  assert.deepEqual([r.craftCategoryDetected.min, r.craftCategoryDetected.of], [3, 4]);
  assert.deepEqual([r.requiredCasesResolved.min, r.requiredCasesResolved.of, r.requiredCasesResolved.zeroMiss], [12, 12, true]);

  const s = PILOT_READINESS_THRESHOLDS.source;
  assert.deepEqual([s.highSeverityDefectSensitivity.min, s.highSeverityDefectSensitivity.of, s.highSeverityDefectSensitivity.zeroMiss], [10, 10, true]);
  assert.deepEqual([s.falseHighSeverityBlockerFreeOnClean.min, s.falseHighSeverityBlockerFreeOnClean.of, s.falseHighSeverityBlockerFreeOnClean.zeroMiss], [2, 2, true]);
  assert.deepEqual([s.supportRegisterAccuracy.min, s.supportRegisterAccuracy.of], [10, 12]);
  assert.deepEqual([s.missingEvidenceInconclusive.min, s.missingEvidenceInconclusive.of, s.missingEvidenceInconclusive.zeroMiss], [1, 1, true]);

  const q = PILOT_READINESS_THRESHOLDS.quiz;
  assert.deepEqual([q.wrongKeyDetection.min, q.wrongKeyDetection.of, q.wrongKeyDetection.zeroMiss], [3, 3, true]);
  assert.deepEqual([q.cleanUniqueAnswerSuccess.min, q.cleanUniqueAnswerSuccess.of], [2, 3]);
  assert.deepEqual([q.ambiguityDetection.min, q.ambiguityDetection.of], [2, 3]);
  assert.deepEqual([q.mechanismAccuracy.min, q.mechanismAccuracy.of], [2, 3]);
});

test("§5.6 candidate orders are frozen (sol/5.5 only; Terra/Luna live in the non-qualifying probe)", () => {
  assert.deepEqual(PILOT_READINESS_CANDIDATE_ORDERS.reader.map((p) => p.profileId),
    ["gpt-5.6-sol@high", "gpt-5.5@high", "gpt-5.6-sol@xhigh", "gpt-5.5@xhigh"]);
  assert.deepEqual(PILOT_READINESS_CANDIDATE_ORDERS.source.map((p) => p.profileId),
    ["gpt-5.6-sol@xhigh", "gpt-5.5@xhigh", "gpt-5.6-sol@high", "gpt-5.5@high"]);
  assert.deepEqual(PILOT_READINESS_CANDIDATE_ORDERS.quiz.map((p) => p.profileId),
    PILOT_READINESS_CANDIDATE_ORDERS.source.map((p) => p.profileId));
  for (const order of Object.values(PILOT_READINESS_CANDIDATE_ORDERS)) {
    assert.ok(order.every((p) => !p.model.includes("terra") && !p.model.includes("luna")),
      "cost candidates never enter the qualifying order (D6)");
  }
  assert.equal(PILOT_READINESS_COST_PROBE.nonQualifying, true);
  assert.equal(PILOT_READINESS_COST_PROBE.runsOnlyAfter, "PILOT_ROLE_SET_READY");
  assert.deepEqual(PILOT_READINESS_COST_PROBE.profiles.map((p) => p.profileId),
    ["gpt-5.6-terra@medium", "gpt-5.6-terra@high", "gpt-5.6-terra@xhigh", "gpt-5.6-luna@high", "gpt-5.6-luna@xhigh"]);
  assert.equal(PILOT_READINESS_COST_PROBE.readerBaseMaximumCalls, 70);
  assert.equal(PILOT_READINESS_COST_PROBE.shortlistedExtensionMaximumCalls, 56);
});

test("§5.7 budget arithmetic is structural: 24 canaries + stop-set holdouts = 84 base, 168 hard", () => {
  const profiles = PILOT_READINESS_CANDIDATE_ORDERS.reader.length;
  const roles = 3;
  const canaries = profiles * PILOT_READINESS_BUDGET.canaryCallsPerProfileRole * roles;
  const holdouts = (PILOT_READINESS_STOPPING.reader + PILOT_READINESS_STOPPING.source + PILOT_READINESS_STOPPING.quiz)
    * PILOT_READINESS_BUDGET.holdoutCallsPerRole;
  assert.equal(canaries, 24);
  assert.equal(canaries + holdouts, PILOT_READINESS_BUDGET.baseMaximumCalls);
  assert.equal(PILOT_READINESS_BUDGET.baseMaximumCalls, 84);
  assert.equal(PILOT_READINESS_BUDGET.hardMaximumCalls, 168);
});

// ── D9 acceptable-control selection ───────────────────────────────────────────

test("D9 selection: owner-audited docs excluded; 4 holdouts (<=2/book) + disjoint canary", () => {
  const controls = [
    { doc: "made-to-stick-ch04.md", readerDocumentSha256: "a", agreedComposite: 89.95 },
    { doc: "made-to-stick-ch05.md", readerDocumentSha256: "b", agreedComposite: 89.9 },
    { doc: "made-to-stick-ch01.md", readerDocumentSha256: "c", agreedComposite: 89.8 },
    { doc: "made-to-stick-ch03.md", readerDocumentSha256: "d", agreedComposite: 89.6 },
    { doc: "the-happiness-hypothesis-ch04.md", readerDocumentSha256: "e", agreedComposite: 88.65 },
    { doc: "the-happiness-hypothesis-ch11.md", readerDocumentSha256: "f", agreedComposite: 88.05 },
    { doc: "nudge-ch08.md", readerDocumentSha256: "g", agreedComposite: 87.55 },
    { doc: "the-happiness-hypothesis-ch09.md", readerDocumentSha256: "h", agreedComposite: 87.5 },
    { doc: "the-happiness-hypothesis-ch06.md", readerDocumentSha256: "i", agreedComposite: 87.1 },
    { doc: "nudge-ch03.md", readerDocumentSha256: "j", agreedComposite: 86.95 },
  ];
  const picked = selectAcceptableControls(controls);
  assert.deepEqual(picked.holdout.map((c) => c.doc),
    ["made-to-stick-ch05.md", "made-to-stick-ch01.md", "the-happiness-hypothesis-ch04.md", "the-happiness-hypothesis-ch11.md"]);
  assert.equal(picked.canary.doc, "nudge-ch08.md");
  for (const excluded of OWNER_AUDITED_CONTROL_DOCS) {
    assert.ok(!picked.holdout.some((c) => c.doc === excluded) && picked.canary.doc !== excluded,
      `owner-audited ${excluded} must never anchor acceptable`);
  }
});

// ── Corpus build against the real frozen inputs ───────────────────────────────

xenv("readiness corpus: exact §5.2-§5.4 mixes, disjoint canaries, deterministic hash",
  "imp24 v3 corpus bundle absent on this checkout", () => BUNDLE_PRESENT, () => {
  const corpus = buildPilotRoleReadinessCorpus({ repositoryRoot: REPOSITORY_ROOT });

  // Reader: 4 acceptable + 4 hard blockers + 4 craft; canaries 1+1.
  assert.equal(corpus.reader.holdout.length, 12);
  const byCategory = (cases: Array<{ category: string }>) =>
    cases.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.category]: (acc[c.category] ?? 0) + 1 }), {});
  assert.deepEqual(byCategory(corpus.reader.holdout),
    { "acceptable-control": 4, "reader-visible-hard-blocker": 4, "craft-nonblocker": 4 });
  assert.deepEqual(corpus.reader.canary.map((c) => c.category).sort(),
    ["acceptable-control", "reader-visible-hard-blocker"]);
  const hardCategories = corpus.reader.holdout
    .filter((c) => c.category === "reader-visible-hard-blocker")
    .map((c) => String((c.payload.expected as Record<string, unknown>).expectedBlockingCategory));
  for (const required of ["internal_contradiction", "unsafe", "unusable"]) {
    assert.ok(hardCategories.includes(required), `hard-blocker set covers ${required}`);
  }
  const craftWeaknesses = corpus.reader.holdout
    .filter((c) => c.category === "craft-nonblocker")
    .map((c) => String((c.payload.expected as Record<string, unknown>).expectedWeakness));
  assert.equal(new Set(craftWeaknesses).size, 4, "4 distinct craft weaknesses");

  // Acceptable controls come from the new pool with the D9 exclusion.
  const acceptableDocs = corpus.reader.holdout
    .filter((c) => c.category === "acceptable-control")
    .map((c) => (c.origin as { doc: string }).doc);
  assert.deepEqual(acceptableDocs,
    ["made-to-stick-ch05.md", "made-to-stick-ch01.md", "the-happiness-hypothesis-ch04.md", "the-happiness-hypothesis-ch11.md"]);
  for (const acceptable of corpus.reader.holdout.filter((c) => c.category === "acceptable-control")) {
    const expected = acceptable.payload.expected as Record<string, unknown>;
    assert.equal(expected.expectedRecommendation, "SHIP");
    assert.equal(expected.policy, "reader-decision-policy-v3");
    assert.equal(expected.minComposite, 80);
    assert.ok(acceptable.payload.chapter !== undefined, "acceptable case embeds its chapter");
  }

  // Source §5.3 mix.
  assert.deepEqual(byCategory(corpus.source.holdout), {
    "supported-source-bound": 2, "unsupported-invented": 2, "unframed-constructed": 2,
    "generic-historical-specificity": 2, "causal-overreach": 2, "unsupported-or-contradicted-attribution": 2,
  });
  assert.equal(corpus.source.canary.length, 2);

  // Quiz §5.4 mix.
  assert.deepEqual(byCategory(corpus.quiz.holdout), {
    "uniquely-correct-clean": 3, "key-mismatch": 3, "genuine-ambiguity": 3, "mechanism-causal-key": 3,
  });
  assert.equal(corpus.quiz.canary.length, 2);

  // Canary/holdout disjointness + development-grade labels.
  for (const role of [corpus.reader, corpus.source, corpus.quiz]) {
    const holdoutIds = new Set(role.holdout.map((c) => c.caseId));
    for (const canary of role.canary) assert.ok(!holdoutIds.has(canary.caseId));
  }
  assert.equal(corpus.labels.readinessScope, "pipeline-internal");
  assert.equal(corpus.labels.publicationCertification, false);
  assert.equal(corpus.labels.independentHumanRater, false);
  assert.deepEqual([...corpus.excludedOwnerAuditedControls.docs], [...OWNER_AUDITED_CONTROL_DOCS]);

  // Determinism: a second build reproduces the exact corpus hash.
  const again = buildPilotRoleReadinessCorpus({ repositoryRoot: REPOSITORY_ROOT });
  assert.equal(again.corpusSha256, corpus.corpusSha256);
  assert.equal(hashCanonical(again), hashCanonical(corpus));
});

xenv("readiness plan binds corpus + thresholds + candidate instrument, deterministically",
  "imp24 v3 corpus bundle absent on this checkout", () => BUNDLE_PRESENT, () => {
  const corpus = buildPilotRoleReadinessCorpus({ repositoryRoot: REPOSITORY_ROOT });
  const plan = buildPilotRoleReadinessPlan({ repositoryRoot: REPOSITORY_ROOT, corpus });
  assert.equal(plan.corpusSha256, corpus.corpusSha256);
  assert.equal(plan.thresholdsSha256, hashCanonical(PILOT_READINESS_THRESHOLDS));
  assert.equal(plan.bindings.readerDecisionPolicy, "reader-decision-policy-v3");
  assert.equal(plan.bindings.candidateSealRawSha256.length, 64);
  assert.deepEqual([...plan.terminalStates], ["PILOT_ROLE_SET_READY", "BLOCKED_ROLE_READINESS"]);
  const again = buildPilotRoleReadinessPlan({ repositoryRoot: REPOSITORY_ROOT, corpus });
  assert.equal(again.planSha256, plan.planSha256);
});
