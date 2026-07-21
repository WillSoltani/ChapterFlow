export const LIFECYCLE_CASE_IDS = [
  "LC-01",
  "LC-02",
  "LC-03",
  "LC-04",
  "LC-05",
  "LC-06",
  "LC-07",
  "LC-08",
  "LC-09",
] as const;

export type LifecycleCaseId = (typeof LIFECYCLE_CASE_IDS)[number];
export type QualificationCheckStatus = "PASS" | "FAIL" | "SKIP";

export type LifecycleCaseObservation = Readonly<{
  caseId: LifecycleCaseId;
  status: QualificationCheckStatus;
  commit: string;
  safeDiagnostic: string;
  rollbackBoundary: string;
  manualOwner: string;
}>;

export const QUALIFICATION_RUNNERS = [
  {
    runnerId: "ORDINARY_TEST_NO_API",
    command: "CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ALLOW_MODEL_GEN=0 CHAPTERFLOW_LEAK_GUARD=1 npm run test:no-api",
  },
  {
    runnerId: "V25_LIFECYCLE",
    command: "CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ALLOW_MODEL_GEN=0 CHAPTERFLOW_LEAK_GUARD=1 npx tsx tests/v25/run.ts",
  },
] as const;
export type QualificationRunnerId = (typeof QUALIFICATION_RUNNERS)[number]["runnerId"];

export type RunnerObservation = Readonly<{
  runnerId: QualificationRunnerId;
  command: string;
  executed: boolean;
  unfiltered: boolean;
  exitCode: number | null;
  fileCount: number;
  caseCount: number;
  commit: string;
}>;

export type TypecheckObservation = Readonly<{
  command: string;
  executed: boolean;
  exitCode: number | null;
  commit: string;
}>;

const TYPECHECK_COMMAND = "CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ALLOW_MODEL_GEN=0 npm run typecheck";

export type FinalQualificationInput = Readonly<{
  currentCommit: string;
  typecheck: TypecheckObservation;
  lifecycleCases: readonly LifecycleCaseObservation[];
  runners: readonly RunnerObservation[];
  liveRouteCount: number;
  productionRootDiffCount: number;
  legacyBypassCount: number;
}>;

export type QualificationBlocker = Readonly<{
  owner: string;
  message: string;
  safeDiagnostic?: string;
  rollbackBoundary?: string;
  manualOwner?: string;
}>;

export type FinalQualificationResult =
  | Readonly<{
      outcome: "BLOCKED";
      currentCommit: string;
      blockers: readonly QualificationBlocker[];
    }>
  | Readonly<{
      outcome: "READY_FOR_MANUAL_RELEASE_REVIEW";
      currentCommit: string;
      blockers: readonly [];
    }>;

function sameCommit(observed: string, current: string): boolean {
  return current.trim().length > 0 && observed === current;
}

/** Pure fail-closed aggregation. It runs no test, route, release, or state mutation. */
export function finalQualification(input: FinalQualificationInput): FinalQualificationResult {
  const blockers: QualificationBlocker[] = [];
  const block = (owner: string, message: string): void => { blockers.push({ owner, message }); };

  if (input.currentCommit.trim().length === 0) block("CURRENT_COMMIT", "current commit identity is missing");
  if (input.typecheck.command !== TYPECHECK_COMMAND) block("TYPECHECK", `typecheck command must be: ${TYPECHECK_COMMAND}`);
  if (!input.typecheck.executed) block("TYPECHECK", "typecheck was not executed");
  if (input.typecheck.exitCode !== 0) block("TYPECHECK", `typecheck exit code is ${input.typecheck.exitCode ?? "unavailable"}`);
  if (!sameCommit(input.typecheck.commit, input.currentCommit)) block("TYPECHECK", "typecheck commit is not current commit");

  for (const caseId of LIFECYCLE_CASE_IDS) {
    const observations = input.lifecycleCases.filter((entry) => entry.caseId === caseId);
    if (observations.length !== 1) {
      block(caseId, `requires exactly one observation; received ${observations.length}`);
      continue;
    }
    const observation = observations[0];
    if (observation.status !== "PASS") {
      blockers.push({
        owner: caseId,
        message: `required lifecycle case is ${observation.status}`,
        safeDiagnostic: observation.safeDiagnostic,
        rollbackBoundary: observation.rollbackBoundary,
        manualOwner: observation.manualOwner,
      });
      const missingRecovery = [
        ["safeDiagnostic", observation.safeDiagnostic],
        ["rollbackBoundary", observation.rollbackBoundary],
        ["manualOwner", observation.manualOwner],
      ].filter(([, value]) => value.trim().length === 0).map(([name]) => name);
      if (missingRecovery.length > 0) block(caseId, `failed lifecycle recovery metadata missing: ${missingRecovery.join(", ")}`);
    }
    if (!sameCommit(observation.commit, input.currentCommit)) block(caseId, "lifecycle observation commit is not current commit");
  }

  if (input.lifecycleCases.length !== LIFECYCLE_CASE_IDS.length) {
    block("LIFECYCLE_INVENTORY", `requires exactly ${LIFECYCLE_CASE_IDS.length} observations; received ${input.lifecycleCases.length}`);
  }

  for (const requiredRunner of QUALIFICATION_RUNNERS) {
    const observations = input.runners.filter((entry) => entry.runnerId === requiredRunner.runnerId);
    if (observations.length !== 1) {
      block(requiredRunner.runnerId, `requires exactly one runner observation; received ${observations.length}`);
      continue;
    }
    const observation = observations[0];
    if (observation.command !== requiredRunner.command) block(requiredRunner.runnerId, `runner command must be: ${requiredRunner.command}`);
    if (!observation.executed) block(requiredRunner.runnerId, "runner was not executed");
    if (!observation.unfiltered) block(requiredRunner.runnerId, "runner inventory was filtered");
    if (observation.exitCode !== 0) block(requiredRunner.runnerId, `runner exit code is ${observation.exitCode ?? "unavailable"}`);
    if (!Number.isInteger(observation.fileCount) || observation.fileCount <= 0) block(requiredRunner.runnerId, "runner file inventory is empty or invalid");
    if (!Number.isInteger(observation.caseCount) || observation.caseCount <= 0) block(requiredRunner.runnerId, "runner case inventory is empty or invalid");
    if (!sameCommit(observation.commit, input.currentCommit)) block(requiredRunner.runnerId, "runner commit is not current commit");
  }

  if (input.runners.length !== QUALIFICATION_RUNNERS.length) {
    block("RUNNER_INVENTORY", `requires exactly ${QUALIFICATION_RUNNERS.length} runner observations; received ${input.runners.length}`);
  }
  if (input.liveRouteCount !== 0) block("LIVE_ROUTES", `expected zero live routes; observed ${input.liveRouteCount}`);
  if (input.productionRootDiffCount !== 0) {
    block("PRODUCTION_ROOTS", `expected zero production-root diffs; observed ${input.productionRootDiffCount}`);
  }
  if (input.legacyBypassCount !== 0) block("LEGACY_BYPASS", `expected zero legacy bypasses; observed ${input.legacyBypassCount}`);

  if (blockers.length > 0) return { outcome: "BLOCKED", currentCommit: input.currentCommit, blockers };
  return { outcome: "READY_FOR_MANUAL_RELEASE_REVIEW", currentCommit: input.currentCommit, blockers: [] };
}
