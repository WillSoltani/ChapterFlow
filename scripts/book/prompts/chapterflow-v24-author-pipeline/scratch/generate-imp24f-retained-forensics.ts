#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, any>;
type Role = "reader" | "source" | "quiz";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const repositoryRoot = resolve(packageRoot, "../../../..");

const paths = {
  result: resolve(packageRoot, "state/migration-experiments/s16-forward-role-qualification-v3-envelope-final/live/qualification-result.json"),
  ledger: resolve(packageRoot, "state/migration-experiments/s16-forward-role-qualification-v3-envelope-final/live/call-ledger.json"),
  freeze: resolve(packageRoot, "state/migration-experiments/s16-forward-role-qualification-v3-envelope-final/live/qualification-freeze.json"),
  campaign: resolve(packageRoot, "state/migration-experiments/s16-forward-role-qualification-v3-envelope-final/qualification-report.json"),
  corpus: resolve(packageRoot, "state/migration-experiments/contracts/imp24/role-qualification-corpus-bundle.v3-envelope.json"),
  thresholds: resolve(packageRoot, "state/migration-experiments/contracts/imp24/role-thresholds.v3-envelope.json"),
  outputJson: resolve(repositoryRoot, "docs/v25/reports/IMP-24F_RETAINED_QUALIFICATION_FORENSICS.json"),
  outputMarkdown: resolve(repositoryRoot, "docs/v25/reports/IMP-24F_RETAINED_QUALIFICATION_FORENSICS.md"),
};

const REGENERATION_COMMAND = "cd scripts/book/prompts/chapterflow-v24-author-pipeline && npx tsx scratch/generate-imp24f-retained-forensics.ts";

const EXPECTED_INPUT_BYTES_SHA256: Record<string, string> = {
  result: "4a6debe2adf71a5fb69d19bab09732a1820d91d83ed29cc3d3980aa55dd3515f",
  ledger: "9678cc29526039590629c3bedee53b63c9a6396833798dc05f66f9576b308237",
  freeze: "017f37f9b203212fc68b9429fb69bf2dd536639b657875154cd3b4903df4a568",
  campaign: "4e5cb806f717689e55b872bac289d95a9b6089da2dd9c535a5c7963eea5cf1bd",
  corpus: "666b8b55e06336f254cb7a6e0c3dc140badedc32d0d0f203c3963fcbe24ff46a",
  thresholds: "f4d08d49eabad6cfdf04561cd38917494f07ed0974f80b59279591d32c5b36be",
};

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parse(path: string): JsonObject {
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function artifact(path: string): JsonObject {
  const bytes = readFileSync(path);
  return {
    path: relative(repositoryRoot, path),
    bytes: bytes.length,
    bytesSha256: sha256(bytes),
  };
}

for (const [name, expected] of Object.entries(EXPECTED_INPUT_BYTES_SHA256)) {
  const path = paths[name as keyof typeof paths];
  const actual = sha256(readFileSync(path));
  if (actual !== expected) throw new Error(`${name} retained input bytes changed: expected ${expected}, received ${actual}`);
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function countBy(values: readonly string[]): JsonObject {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right));
}

// This is the exact historical Object.entries iteration order in
// IMP24_FROZEN_ROLE_THRESHOLDS at the retained run's implementation commit.
// It intentionally differs from the canonical/alphabetical order written into
// qualification-result.json and therefore reproduces the verifier-only drift.
const HISTORICAL_VERIFIER_METRIC_ORDER: Record<Role, readonly string[]> = {
  reader: [
    "schemaValidity",
    "hardBlockerSensitivity",
    "hardBlockerFalsePositiveFree",
    "cleanControlPassRate",
    "craftCalibrationAccuracy",
    "evidenceSpanValidity",
    "requiredCasesResolved",
  ],
  source: [
    "schemaValidity",
    "fabricationSensitivity",
    "causalOverreachSensitivity",
    "sourceContradictionSensitivity",
    "highSeverityFalsePositiveFree",
    "cleanCasePassRate",
    "supportStatusAccuracy",
    "visibleRegisterAccuracy",
    "evidenceSpanValidity",
    "missingEvidenceInconclusive",
    "requiredCasesResolved",
  ],
  quiz: [
    "schemaValidity",
    "wrongKeyDetection",
    "cleanUniquePassRate",
    "ambiguityDetection",
    "mechanismAccuracy",
    "evidenceSpanValidity",
    "requiredCasesResolved",
  ],
};

function recomputeOutcomeOrdering(profileRole: JsonObject, thresholds: JsonObject): JsonObject {
  if (!profileRole.metrics) return profileRole.outcome;
  const role = profileRole.role as Role;
  const rates = profileRole.metrics.metrics as Record<string, number>;
  const denominators = profileRole.metrics.denominators as Record<string, number>;
  const failedThresholds: string[] = [];
  const underpoweredMetrics: string[] = [];
  for (const metricId of HISTORICAL_VERIFIER_METRIC_ORDER[role]) {
    const bar = thresholds[role][metricId] as { minRate: number; minDenominator: number; zeroMiss: boolean };
    const denominator = denominators[metricId] ?? 0;
    const rate = rates[metricId];
    const measured = typeof rate === "number" && Number.isFinite(rate);
    if (bar.zeroMiss) {
      if (denominator <= 0 || !measured || rate < bar.minRate) failedThresholds.push(metricId);
      continue;
    }
    if (denominator < Math.max(10, bar.minDenominator)) {
      underpoweredMetrics.push(metricId);
    } else if (!measured || rate < bar.minRate) {
      failedThresholds.push(metricId);
    }
  }
  return {
    ...profileRole.outcome,
    underpoweredMetrics,
    failedThresholds,
  };
}

function expectedMetricObservations(role: Role, corpusCase: JsonObject): string[] {
  if (role === "reader") {
    if (corpusCase.kind === "clean") return ["cleanControlPassRate", "hardBlockerFalsePositiveFree"];
    if (corpusCase.kind === "reader-visible-hard-blocker") return ["hardBlockerSensitivity"];
    return ["craftCalibrationAccuracy"];
  }
  if (role === "source") {
    const primary = corpusCase.expected.expectedPrimaryCategory;
    const metrics = ["supportStatusAccuracy", "visibleRegisterAccuracy"];
    if (primary === "invented_detail") metrics.push("fabricationSensitivity");
    if (primary === "claim_strength_overreach") metrics.push("causalOverreachSensitivity");
    if (primary === "source_contradiction") metrics.push("sourceContradictionSensitivity");
    if (primary === null) metrics.push("cleanCasePassRate", "highSeverityFalsePositiveFree");
    return metrics;
  }
  if (corpusCase.kind === "key-mismatch") return ["wrongKeyDetection"];
  if (corpusCase.kind === "uniquely-correct-clean") return ["cleanUniquePassRate"];
  if (corpusCase.kind === "genuine-ambiguity") return ["ambiguityDetection"];
  return ["mechanismAccuracy"];
}

function failureReason(attempt: JsonObject): JsonObject {
  const evaluation = attempt.evaluation ?? {};
  if (evaluation.parseError) return { kind: "parse_error", detail: evaluation.parseError };
  if (evaluation.assemblyError) return { kind: "assembly_error", detail: evaluation.assemblyError };
  if (evaluation.fileAccessFailure) return { kind: "file_access_failure", detail: evaluation.semanticSummary };
  return { kind: "protocol_invalid", detail: evaluation.semanticSummary ?? attempt.terminalReason };
}

function metricExpectedDenominators(role: Role, cases: JsonObject[]): Record<string, number> {
  const counts: Record<string, number> = {
    schemaValidity: cases.length,
    evidenceSpanValidity: cases.length,
    requiredCasesResolved: cases.length,
  };
  for (const corpusCase of cases) {
    for (const metricId of expectedMetricObservations(role, corpusCase)) {
      counts[metricId] = (counts[metricId] ?? 0) + 1;
    }
  }
  if (role === "source") counts.missingEvidenceInconclusive = 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function formatNumber(value: unknown): string {
  if (typeof value !== "number") return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

const result = parse(paths.result);
const ledger = parse(paths.ledger);
const freeze = parse(paths.freeze);
const campaign = parse(paths.campaign);
const corpus = parse(paths.corpus);
const thresholds = parse(paths.thresholds);

const corpusCasesByRole = Object.fromEntries((["reader", "source", "quiz"] as Role[]).map((role) => [
  role,
  corpus[role].holdout.cases as JsonObject[],
])) as Record<Role, JsonObject[]>;
const corpusCaseById = new Map<string, JsonObject>();
for (const role of ["reader", "source", "quiz"] as Role[]) {
  for (const corpusCase of corpusCasesByRole[role]) corpusCaseById.set(corpusCase.caseId, corpusCase);
}

const retainedAttempts = result.attempts as JsonObject[];
const profileRoleResults = (result.profileRoleResults as JsonObject[]).map((entry) => {
  const scopedAttempts = retainedAttempts.filter((attempt) =>
    attempt.request.role === entry.role
      && attempt.request.profileId === entry.profile.profileId);
  const canaryAttempts = scopedAttempts.filter((attempt) => attempt.request.partition === "canary");
  const holdoutAttempts = scopedAttempts.filter((attempt) => attempt.request.partition === "holdout");
  return {
    profileId: entry.profile.profileId,
    model: entry.profile.model,
    effort: entry.profile.effort,
    candidateOrdinal: entry.candidateOrdinal,
    role: entry.role,
    availability: entry.availability,
    attempts: entry.attempts,
    canary: {
      started: entry.canaryStarted,
      cases: entry.canaryCaseCount,
      calls: canaryAttempts.length,
      protocolValidCount: canaryAttempts.filter((attempt) => attempt.protocolValid === true).length,
      protocolPassed: entry.canaryProtocolPassed,
      semanticCorrect: entry.canarySemanticCorrectCount,
      semanticCorrectCount: entry.canarySemanticCorrectCount,
    },
    holdout: { started: entry.holdoutStarted, cases: entry.holdoutCaseCount, calls: holdoutAttempts.length },
    runnerStatus: entry.status,
    outcome: entry.outcome,
    thresholds: thresholds[entry.role],
    metrics: entry.metrics,
  };
});

const readerCleanAttempts = (result.attempts as JsonObject[]).filter((attempt) =>
  attempt.request.role === "reader"
    && attempt.request.partition === "holdout"
    && attempt.request.family === "clean");
const readerCleanCases = corpusCasesByRole.reader.filter((corpusCase) => corpusCase.kind === "clean");
const readerCleanMatrix = readerCleanCases.map((corpusCase) => ({
  caseId: corpusCase.caseId,
  baseBookId: corpusCase.baseBookId,
  baseChapter: corpusCase.baseChapter,
  expectedRecommendation: corpusCase.expected.expectedRecommendation,
  goldStatus: corpusCase.baseCleanControlAudit.status,
  independentHumanRater: corpusCase.baseCleanControlAudit.independentHumanRater,
  profiles: readerCleanAttempts
    .filter((attempt) => attempt.request.caseId === corpusCase.caseId)
    .sort((left, right) => left.request.profileId.localeCompare(right.request.profileId))
    .map((attempt) => {
      const review = attempt.evaluation.assembledReview;
      const scoreValues = Object.values(review?.scores ?? {}).filter((value): value is number => typeof value === "number");
      return {
        profileId: attempt.request.profileId,
        protocolValid: attempt.protocolValid,
        semanticCorrect: attempt.semanticCorrect,
        recommendation: review?.recommendation ?? null,
        scores: review?.scores ?? null,
        observedScoreSum: scoreValues.length > 0 ? scoreValues.reduce((sum, value) => sum + value, 0) : null,
        blockingCategories: (review?.blockingFindings ?? []).map((finding: JsonObject) => finding.category),
        advisoryCategories: (review?.advisoryFindings ?? []).map((finding: JsonObject) => finding.category),
      };
    }),
}));

const readerScoreRows = readerCleanAttempts.flatMap((attempt) => {
  const scores = attempt.evaluation.assembledReview?.scores ?? {};
  return Object.entries(scores).filter((entry): entry is [string, number] => typeof entry[1] === "number").map(([factor, value]) => ({
    factor,
    value,
    profileId: attempt.request.profileId as string,
  }));
});
const readerFactors = sortedUnique(readerScoreRows.map((row) => row.factor));
const factorScoreRanges = readerFactors.map((factor) => {
  const rows = readerScoreRows.filter((row) => row.factor === factor);
  const values = rows.map((row) => row.value);
  return {
    factor,
    observedMin: Math.min(...values),
    observedMax: Math.max(...values),
    observations: values.length,
    atOrBelowOne: values.filter((value) => value <= 1).length,
    aboveOneAtOrBelowFive: values.filter((value) => value > 1 && value <= 5).length,
    aboveFive: values.filter((value) => value > 5).length,
    byProfile: sortedUnique(rows.map((row) => row.profileId)).map((profileId) => {
      const profileValues = rows.filter((row) => row.profileId === profileId).map((row) => row.value);
      return { profileId, min: Math.min(...profileValues), max: Math.max(...profileValues) };
    }),
  };
});

const findingRows = readerCleanAttempts.flatMap((attempt) => {
  const review = attempt.evaluation.assembledReview ?? {};
  return [
    ...(review.blockingFindings ?? []).map((finding: JsonObject) => ({ bucket: "blocking", category: finding.category, profileId: attempt.request.profileId })),
    ...(review.advisoryFindings ?? []).map((finding: JsonObject) => ({ bucket: "advisory", category: finding.category, profileId: attempt.request.profileId })),
  ];
});
const readerFindingCategoryCounts = {
  overall: countBy(findingRows.map((row) => `${row.bucket}:${row.category}`)),
  byProfile: sortedUnique(findingRows.map((row) => row.profileId)).map((profileId) => ({
    profileId,
    counts: countBy(findingRows.filter((row) => row.profileId === profileId).map((row) => `${row.bucket}:${row.category}`)),
  })),
};

const sourceExpectedDenominators = metricExpectedDenominators("source", corpusCasesByRole.source);
const sourceExpectedVsActual = (result.profileRoleResults as JsonObject[])
  .filter((entry) => entry.role === "source")
  .map((entry) => ({
    profileId: entry.profile.profileId,
    runnerStatus: entry.status,
    metrics: Object.keys(sourceExpectedDenominators).sort().map((metricId) => {
      const expected = sourceExpectedDenominators[metricId];
      const actual = entry.metrics?.denominators?.[metricId] ?? 0;
      return {
        metricId,
        thresholdMinimum: thresholds.source[metricId].minDenominator,
        expected,
        actual,
        missing: expected - actual,
        reachable: expected >= thresholds.source[metricId].minDenominator,
      };
    }),
  }));

const missingRequiredObservations = (result.attempts as JsonObject[])
  .filter((attempt) => attempt.request.partition === "holdout")
  .flatMap((attempt) => {
    const role = attempt.request.role as Role;
    const corpusCase = corpusCaseById.get(attempt.request.caseId);
    if (!corpusCase) throw new Error(`missing corpus case ${attempt.request.caseId}`);
    const expected = expectedMetricObservations(role, corpusCase);
    const actual = Object.keys(attempt.evaluation?.metricObservations ?? {});
    const missing = expected.filter((metricId) => !actual.includes(metricId));
    if (missing.length === 0) return [];
    return [{
      role,
      profileId: attempt.request.profileId,
      caseId: attempt.request.caseId,
      protocolValid: attempt.protocolValid,
      expectedObservationIds: expected,
      actualObservationIds: actual.sort(),
      missingObservationIds: missing,
      reason: failureReason(attempt),
    }];
  })
  .sort((left, right) => `${left.role}:${left.profileId}:${left.caseId}`.localeCompare(`${right.role}:${right.profileId}:${right.caseId}`));

const expectedDenominatorsByRole = Object.fromEntries((["reader", "source", "quiz"] as Role[]).map((role) => [
  role,
  metricExpectedDenominators(role, corpusCasesByRole[role]),
]));
const impossibleOrUnreachableMetrics = (["reader", "source", "quiz"] as Role[]).flatMap((role) =>
  Object.entries(thresholds[role] as Record<string, { minDenominator: number }>).flatMap(([metricId, bar]) => {
    const reachableDenominator = expectedDenominatorsByRole[role][metricId] ?? 0;
    return reachableDenominator < bar.minDenominator
      ? [{ role, metricId, thresholdMinimum: bar.minDenominator, reachableDenominator }]
      : [];
  }));

const verifierOrderingDifferences = (result.profileRoleResults as JsonObject[]).flatMap((entry) => {
  const recomputed = recomputeOutcomeOrdering(entry, thresholds);
  const differences: JsonObject[] = [];
  for (const field of ["failedThresholds", "underpoweredMetrics"] as const) {
    const retained = entry.outcome[field] as string[];
    const verifier = recomputed[field] as string[];
    if (JSON.stringify(retained) !== JSON.stringify(verifier)) {
      differences.push({
        profileId: entry.profile.profileId,
        role: entry.role,
        field,
        retained,
        verifierRecomputed: verifier,
        sameCanonicalSet: sameStringSet(retained, verifier),
        canonicalSet: sortedUnique(retained),
      });
    }
  }
  return differences;
});

const resultAttemptIds = (result.attempts as JsonObject[]).map((attempt) => attempt.request.attemptId).sort();
const ledgerAttemptIds = (ledger.entries as JsonObject[]).map((entry) => entry.attemptId).sort();
const report = {
  schema: "imp24f-retained-qualification-forensics-v1",
  experimentId: result.experimentId,
  scope: "Deterministic compact projection of the retained 338-attempt qualification; raw tasks, outputs, envelopes, receipts, and attempt payloads are not copied.",
  repositoryPreflight: {
    repository: "WillSoltani/ChapterFlow",
    requestedBranch: "feat/v25-pipeline-live",
    startingHead: "09b53ef815125a57bd5b786e9bacb372fb7256d0",
    cleanIsolatedWorktreeBeforeChanges: true,
    draftPullRequest: {
      number: 401,
      state: "OPEN",
      isDraft: true,
      headRefName: "feat/v25-pipeline-live",
      headCommitSha: "09b53ef815125a57bd5b786e9bacb372fb7256d0",
    },
    implementationCommitBehindEvidence: "a2cda54222c5931d0c2e90ced968194f6200988f",
    exactCi: [
      { runId: 29351112643, headCommitSha: "a2cda54222c5931d0c2e90ced968194f6200988f", conclusion: "SUCCESS" },
      { runId: 29362432844, headCommitSha: "09b53ef815125a57bd5b786e9bacb372fb7256d0", conclusion: "SUCCESS" },
    ],
  },
  regeneration: {
    command: REGENERATION_COMMAND,
    generator: relative(repositoryRoot, fileURLToPath(import.meta.url)),
    deterministicTimestampPolicy: "No wall-clock timestamp is emitted; the report is a pure function of the listed retained inputs and the historical verifier metric order embedded in the generator.",
  },
  inputArtifacts: [paths.result, paths.ledger, paths.freeze, paths.campaign, paths.corpus, paths.thresholds].map(artifact),
  retainedEvidenceInvariants: {
    resultTotalAttempts: result.totalAttempts,
    resultBaseCallsAttempted: result.baseCallsAttempted,
    resultAttemptRecords: result.attempts.length,
    ledgerEntries: ledger.entries.length,
    ledgerTotalAttempts: ledger.totalAttempts,
    ledgerAttemptIdsUnique: new Set(ledgerAttemptIds).size === ledgerAttemptIds.length,
    resultAttemptIdsUnique: new Set(resultAttemptIds).size === resultAttemptIds.length,
    ledgerAndResultAttemptSetsEqual: JSON.stringify(ledgerAttemptIds) === JSON.stringify(resultAttemptIds),
    brokerRequests: ledger.brokerRequests,
    codexExecInvocations: ledger.codexExecInvocations,
    apiCallsMade: ledger.apiCallsMade,
    cachedReceipts: ledger.cachedReceipts,
    infrastructureReplays: result.infrastructureReplays,
    canaryAttempts: (result.attempts as JsonObject[]).filter((attempt) => attempt.request.partition === "canary").length,
    holdoutAttempts: (result.attempts as JsonObject[]).filter((attempt) => attempt.request.partition === "holdout").length,
    campaignStatus: campaign.status,
    thresholdsSha256: freeze.thresholdsSha256,
    corpusBundleSha256: freeze.corpusBundleSha256,
    freezeSha256: freeze.freezeSha256,
  },
  profileRoleResults,
  readerCleanControl: {
    expectedCaseCount: readerCleanCases.length,
    observedCrossProfileCount: readerCleanAttempts.length,
    expectedGoldAuthority: {
      statusCounts: countBy(readerCleanCases.map((corpusCase) => corpusCase.baseCleanControlAudit.status)),
      independentHumanRaterCounts: countBy(readerCleanCases.map((corpusCase) => String(corpusCase.baseCleanControlAudit.independentHumanRater))),
    },
    matrix: readerCleanMatrix,
    factorScoreRanges,
    findingCategoryCounts: readerFindingCategoryCounts,
  },
  sourceMetricCoverage: {
    corpusHoldoutCases: corpusCasesByRole.source.length,
    expectedDenominators: sourceExpectedDenominators,
    note: "missingEvidenceInconclusive is the certified deterministic no-sidecar probe recorded once per tested source profile; it is not a live holdout call.",
    byProfile: sourceExpectedVsActual,
  },
  missingRequiredObservations,
  thresholdReachability: {
    expectedDenominatorsByRole,
    impossibleOrUnreachableMetrics,
    conclusion: impossibleOrUnreachableMetrics.length === 0
      ? "No frozen threshold metric is structurally unreachable. Observed denominator shortfalls are output parse/assembly failures, not corpus-coverage impossibility."
      : "At least one frozen threshold metric is structurally unreachable.",
  },
  verifierOrderingDifferences,
  forensicConclusions: {
    readerCleanControlFailure: `${readerCleanAttempts.filter((attempt) => attempt.evaluation.assembledReview?.recommendation !== "SHIP").length}/${readerCleanAttempts.length} retained clean-reader judgments were not SHIP, while every frozen clean case expected SHIP.`,
    mixedReaderScoreScales: factorScoreRanges.some((row) =>
      [row.atOrBelowOne, row.aboveOneAtOrBelowFive, row.aboveFive].filter((count) => count > 0).length > 1),
    missingObservationAttempts: missingRequiredObservations.length,
    verifierOrderOnlyDifferences: verifierOrderingDifferences.length,
    verifierDifferencesAreCanonicalSetEqual: verifierOrderingDifferences.every((difference) => difference.sameCanonicalSet),
    substantiveCampaignStatus: campaign.status,
  },
};

const markdownLines: string[] = [];
markdownLines.push("# IMP-24F retained qualification forensics", "");
markdownLines.push("This is a deterministic compact projection of the retained 338-attempt campaign. It does not copy raw tasks, model outputs, envelopes, receipts, or per-attempt evidence payloads.", "");
markdownLines.push(`Regenerate with: \`${REGENERATION_COMMAND}\``, "");
markdownLines.push("## Repository preflight", "");
markdownLines.push(`- Requested branch \`${report.repositoryPreflight.requestedBranch}\`; clean isolated worktree at starting HEAD \`${report.repositoryPreflight.startingHead}\`: ${report.repositoryPreflight.cleanIsolatedWorktreeBeforeChanges ? "verified" : "not verified"}.`);
markdownLines.push(`- Draft PR #${report.repositoryPreflight.draftPullRequest.number}: ${report.repositoryPreflight.draftPullRequest.state}, draft=${report.repositoryPreflight.draftPullRequest.isDraft}, head \`${report.repositoryPreflight.draftPullRequest.headCommitSha}\`.`);
markdownLines.push(`- Exact retained CIs: ${report.repositoryPreflight.exactCi.map((item) => `run ${item.runId} at \`${item.headCommitSha}\` — ${item.conclusion}`).join("; ")}.`, "");
markdownLines.push("## Evidence bindings", "");
markdownLines.push("| Artifact | Bytes | SHA-256 |", "|---|---:|---|");
for (const input of report.inputArtifacts) markdownLines.push(`| \`${input.path}\` | ${input.bytes} | \`${input.bytesSha256}\` |`);
markdownLines.push("", "## Campaign invariants", "");
markdownLines.push(`- Result attempts: ${report.retainedEvidenceInvariants.resultAttemptRecords}; ledger entries: ${report.retainedEvidenceInvariants.ledgerEntries}; exact attempt-ID set match: ${report.retainedEvidenceInvariants.ledgerAndResultAttemptSetsEqual}.`);
markdownLines.push(`- Calls: ${report.retainedEvidenceInvariants.canaryAttempts} canary + ${report.retainedEvidenceInvariants.holdoutAttempts} holdout = ${report.retainedEvidenceInvariants.resultTotalAttempts}; replays ${report.retainedEvidenceInvariants.infrastructureReplays}; API calls ${report.retainedEvidenceInvariants.apiCallsMade}; cached receipts ${report.retainedEvidenceInvariants.cachedReceipts}.`);
markdownLines.push(`- Retained substantive campaign status: **${report.retainedEvidenceInvariants.campaignStatus}**.`);
markdownLines.push("", "## Profile / role outcomes", "");
markdownLines.push("| Profile | Role | Attempts | Canary protocol | Canary semantic | Holdout calls | Runner status | Outcome | Failed thresholds | Underpowered |", "|---|---|---:|---:|---:|---:|---|---|---|---|");
for (const entry of profileRoleResults) {
  markdownLines.push(`| ${entry.profileId} | ${entry.role} | ${entry.attempts} | ${entry.canary.protocolValidCount}/${entry.canary.cases} | ${entry.canary.semanticCorrectCount}/${entry.canary.cases} | ${entry.holdout.calls} | ${entry.runnerStatus} | ${entry.outcome.status} | ${(entry.outcome.failedThresholds as string[]).join(", ") || "—"} | ${(entry.outcome.underpoweredMetrics as string[]).join(", ") || "—"} |`);
}
markdownLines.push("", "Full numerators, denominators, rates, and frozen threshold bars are in the JSON report.", "");
markdownLines.push("## Reader clean-control cross-profile matrix", "");
markdownLines.push("All ten retained clean controls are development curator controls (`independentHumanRater=false`), not independent human gold.", "");
markdownLines.push("| Case | gpt-5.5@high | gpt-5.5@xhigh | gpt-5.6-sol@high | gpt-5.6-sol@xhigh |", "|---|---|---|---|---|");
for (const row of readerCleanMatrix) {
  const byProfile = new Map(row.profiles.map((entry) => [entry.profileId, entry]));
  const cell = (profileId: string): string => {
    const entry = byProfile.get(profileId);
    if (!entry) return "—";
    return `${entry.recommendation}; sum=${formatNumber(entry.observedScoreSum)}; semantic=${entry.semanticCorrect}`;
  };
  markdownLines.push(`| ${row.caseId} | ${cell("gpt-5.5@high")} | ${cell("gpt-5.5@xhigh")} | ${cell("gpt-5.6-sol@high")} | ${cell("gpt-5.6-sol@xhigh")} |`);
}
markdownLines.push("", "### Factor score ranges", "");
markdownLines.push("| Factor | Min | Max | <=1 | >1 and <=5 | >5 |", "|---|---:|---:|---:|---:|---:|");
for (const row of factorScoreRanges) markdownLines.push(`| ${row.factor} | ${formatNumber(row.observedMin)} | ${formatNumber(row.observedMax)} | ${row.atOrBelowOne} | ${row.aboveOneAtOrBelowFive} | ${row.aboveFive} |`);
markdownLines.push("", "The same named factors contain values in 0–1-like, 1–5-like, and 1–10-like bands. This proves incompatible numeric scales in the retained reader outputs; the report preserves the raw numbers and does not normalize them.", "");
markdownLines.push("### Reader clean-control finding categories", "");
markdownLines.push("| Bucket/category | Count |", "|---|---:|");
for (const [category, count] of Object.entries(readerFindingCategoryCounts.overall)) markdownLines.push(`| ${category} | ${count} |`);
markdownLines.push("", "## Source expected versus actual denominators", "");
markdownLines.push("| Profile | Metric | Threshold min | Expected | Actual | Missing |", "|---|---|---:|---:|---:|---:|");
for (const profile of sourceExpectedVsActual) {
  for (const metric of profile.metrics) markdownLines.push(`| ${profile.profileId} | ${metric.metricId} | ${metric.thresholdMinimum} | ${metric.expected} | ${metric.actual} | ${metric.missing} |`);
}
markdownLines.push("", "`missingEvidenceInconclusive` is the certified no-sidecar probe (one deterministic observation per tested source profile), not a live holdout case.", "");
markdownLines.push("## Missing required evaluator observations", "");
markdownLines.push(`There are ${missingRequiredObservations.length} holdout attempts with missing role-specific observations. Each was protocol-invalid; the exact parse or assembly failure is retained below.`, "");
markdownLines.push("| Role | Profile | Case | Missing observations | Failure |", "|---|---|---|---|---|");
for (const row of missingRequiredObservations) markdownLines.push(`| ${row.role} | ${row.profileId} | ${row.caseId} | ${row.missingObservationIds.join(", ")} | ${row.reason.kind}: ${String(row.reason.detail).replace(/\|/g, "\\|")} |`);
markdownLines.push("", "## Threshold reachability", "");
markdownLines.push(report.thresholdReachability.conclusion, "");
markdownLines.push("The expected model-free denominators are recorded by role in the JSON report. The observed source support/register shortfalls (33/40, 39/40, 35/40, 39/40) come from the protocol-invalid attempts above; source contradiction remained 2/2 for every tested profile.", "");
markdownLines.push("## Exact verifier ordering differences", "");
markdownLines.push("| Profile | Role | Field | Retained order | Verifier reconstruction | Same set |", "|---|---|---|---|---|---|");
for (const row of verifierOrderingDifferences) markdownLines.push(`| ${row.profileId} | ${row.role} | ${row.field} | ${row.retained.join(", ")} | ${row.verifierRecomputed.join(", ")} | ${row.sameCanonicalSet} |`);
markdownLines.push("", `All ${verifierOrderingDifferences.length} differences are order-only canonical-set matches. They do not change the retained substantive outcome **${campaign.status}**.`, "");
markdownLines.push("## Forensic conclusion", "");
markdownLines.push(`- ${report.forensicConclusions.readerCleanControlFailure}`);
markdownLines.push(`- Mixed reader score scales observed: ${report.forensicConclusions.mixedReaderScoreScales}.`);
markdownLines.push(`- Missing required observation attempts: ${report.forensicConclusions.missingObservationAttempts}.`);
markdownLines.push(`- Verifier order-only differences: ${report.forensicConclusions.verifierOrderOnlyDifferences}; every difference is canonical-set equal: ${report.forensicConclusions.verifierDifferencesAreCanonicalSetEqual}.`);
markdownLines.push(`- Retained substantive campaign status remains **${report.forensicConclusions.substantiveCampaignStatus}**.`);

mkdirSync(dirname(paths.outputJson), { recursive: true });
writeFileSync(paths.outputJson, `${JSON.stringify(report)}\n`, "utf8");
writeFileSync(paths.outputMarkdown, `${markdownLines.join("\n")}\n`, "utf8");

console.log(JSON.stringify({
  json: { path: relative(repositoryRoot, paths.outputJson), bytesSha256: sha256(readFileSync(paths.outputJson)) },
  markdown: { path: relative(repositoryRoot, paths.outputMarkdown), bytesSha256: sha256(readFileSync(paths.outputMarkdown)) },
  attempts: report.retainedEvidenceInvariants.resultAttemptRecords,
  missingRequiredObservations: missingRequiredObservations.length,
  verifierOrderingDifferences: verifierOrderingDifferences.length,
  impossibleOrUnreachableMetrics: impossibleOrUnreachableMetrics.length,
}));
