import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  LIFECYCLE_CASE_IDS,
  finalQualification,
  type FinalQualificationInput,
} from "../src/app/finalQualification.js";

const COMMIT = "bbee558ad980632738431a722d79f977ae284738";

function readyInput(): FinalQualificationInput {
  return {
    currentCommit: COMMIT,
    typecheck: {
      command: "CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ALLOW_MODEL_GEN=0 npm run typecheck",
      executed: true,
      exitCode: 0,
      commit: COMMIT,
    },
    lifecycleCases: LIFECYCLE_CASE_IDS.map((caseId) => ({
      caseId,
      status: "PASS",
      commit: COMMIT,
      safeDiagnostic: `diagnose ${caseId}`,
      rollbackBoundary: `retain ${caseId} state`,
      manualOwner: `${caseId} owner`,
    })),
    runners: [
      { runnerId: "ORDINARY_TEST_NO_API", command: "CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ALLOW_MODEL_GEN=0 CHAPTERFLOW_LEAK_GUARD=1 npm run test:no-api", executed: true, unfiltered: true, exitCode: 0, fileCount: 300, caseCount: 2_000, commit: COMMIT },
      { runnerId: "V25_LIFECYCLE", command: "CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ALLOW_MODEL_GEN=0 CHAPTERFLOW_LEAK_GUARD=1 npx tsx tests/v25/run.ts", executed: true, unfiltered: true, exitCode: 0, fileCount: 33, caseCount: 150, commit: COMMIT },
    ],
    liveRouteCount: 0,
    productionRootDiffCount: 0,
    legacyBypassCount: 0,
  };
}

test("final qualification returns only manual-review readiness for exact current PASS inventory", () => {
  const result = finalQualification(readyInput());
  assert.deepEqual(result, {
    outcome: "READY_FOR_MANUAL_RELEASE_REVIEW",
    currentCommit: COMMIT,
    blockers: [],
  });
});

test("missing duplicate failed and skipped lifecycle cases block with owning LC IDs", () => {
  const base = readyInput();
  const cases = base.lifecycleCases.filter((entry) => entry.caseId !== "LC-02").map((entry) =>
    entry.caseId === "LC-03" ? { ...entry, status: "FAIL" as const }
      : entry.caseId === "LC-04" ? { ...entry, status: "SKIP" as const }
        : entry
  );
  const lc01 = cases.find((entry) => entry.caseId === "LC-01");
  assert.ok(lc01);
  const result = finalQualification({ ...base, lifecycleCases: [...cases, lc01] });
  assert.equal(result.outcome, "BLOCKED");
  assert.ok(result.blockers.some((blocker) => blocker.owner === "LC-01" && /exactly one/.test(blocker.message)));
  assert.ok(result.blockers.some((blocker) => blocker.owner === "LC-02" && /exactly one/.test(blocker.message)));
  assert.ok(result.blockers.some((blocker) => blocker.owner === "LC-03" && /FAIL/.test(blocker.message)));
  assert.ok(result.blockers.some((blocker) => blocker.owner === "LC-04" && /SKIP/.test(blocker.message)));
  const failed = result.blockers.find((blocker) => blocker.owner === "LC-03" && /FAIL/.test(blocker.message));
  assert.deepEqual(failed, {
    owner: "LC-03",
    message: "required lifecycle case is FAIL",
    safeDiagnostic: "diagnose LC-03",
    rollbackBoundary: "retain LC-03 state",
    manualOwner: "LC-03 owner",
  });
});

test("typecheck command mismatch blocks caller-asserted success", () => {
  const base = readyInput();
  const result = finalQualification({
    ...base,
    typecheck: { ...base.typecheck, command: "npm run typecheck" },
  });
  assert.equal(result.outcome, "BLOCKED");
  assert.ok(result.blockers.some((blocker) => blocker.owner === "TYPECHECK" && /command must be/.test(blocker.message)));
});

test("typecheck not executed blocks caller-asserted success", () => {
  const base = readyInput();
  const result = finalQualification({
    ...base,
    typecheck: { ...base.typecheck, executed: false },
  });
  assert.equal(result.outcome, "BLOCKED");
  assert.ok(result.blockers.some((blocker) => blocker.owner === "TYPECHECK" && /not executed/.test(blocker.message)));
});

test("nonzero typecheck exit blocks caller-asserted success", () => {
  const base = readyInput();
  const result = finalQualification({
    ...base,
    typecheck: { ...base.typecheck, exitCode: 1 },
  });
  assert.equal(result.outcome, "BLOCKED");
  assert.ok(result.blockers.some((blocker) => blocker.owner === "TYPECHECK" && /exit code is 1/.test(blocker.message)));
});

test("missing typecheck exit blocks caller-asserted success", () => {
  const base = readyInput();
  const result = finalQualification({
    ...base,
    typecheck: { ...base.typecheck, exitCode: null },
  });
  assert.equal(result.outcome, "BLOCKED");
  assert.ok(result.blockers.some((blocker) => blocker.owner === "TYPECHECK" && /exit code is unavailable/.test(blocker.message)));
});

test("stale typecheck commit blocks caller-asserted success", () => {
  const base = readyInput();
  const result = finalQualification({
    ...base,
    typecheck: { ...base.typecheck, commit: "stale-commit" },
  });
  assert.equal(result.outcome, "BLOCKED");
  assert.ok(result.blockers.some((blocker) => blocker.owner === "TYPECHECK" && /current commit/.test(blocker.message)));
});

test("both complete unfiltered runner observations must pass at current commit", () => {
  const base = readyInput();
  const result = finalQualification({
    ...base,
    runners: [
      { ...base.runners[0], executed: false, exitCode: null, fileCount: -1 },
      { ...base.runners[1], command: "npx tsx tests/v25/run.ts filter", unfiltered: false, exitCode: 1, caseCount: 0, commit: "stale-commit" },
    ],
  });
  assert.equal(result.outcome, "BLOCKED");
  assert.ok(result.blockers.some((blocker) => blocker.owner === "ORDINARY_TEST_NO_API" && /not executed/.test(blocker.message)));
  assert.ok(result.blockers.some((blocker) => blocker.owner === "ORDINARY_TEST_NO_API" && /file inventory/.test(blocker.message)));
  assert.ok(result.blockers.some((blocker) => blocker.owner === "V25_LIFECYCLE" && /filtered/.test(blocker.message)));
  assert.ok(result.blockers.some((blocker) => blocker.owner === "V25_LIFECYCLE" && /command/.test(blocker.message)));
  assert.ok(result.blockers.some((blocker) => blocker.owner === "V25_LIFECYCLE" && /exit code/.test(blocker.message)));
  assert.ok(result.blockers.some((blocker) => blocker.owner === "V25_LIFECYCLE" && /case inventory/.test(blocker.message)));
  assert.ok(result.blockers.some((blocker) => blocker.owner === "V25_LIFECYCLE" && /current commit/.test(blocker.message)));
});

test("failed lifecycle observation requires nonempty diagnostic rollback and manual owner", () => {
  const base = readyInput();
  const result = finalQualification({
    ...base,
    lifecycleCases: base.lifecycleCases.map((entry) => entry.caseId === "LC-06"
      ? { ...entry, status: "FAIL", safeDiagnostic: "", rollbackBoundary: " ", manualOwner: "" }
      : entry),
  });
  assert.equal(result.outcome, "BLOCKED");
  assert.ok(result.blockers.some((blocker) =>
    blocker.owner === "LC-06"
    && /safeDiagnostic, rollbackBoundary, manualOwner/.test(blocker.message)
  ));
});

test("live route production-root diff or legacy bypass blocks readiness", () => {
  const result = finalQualification({
    ...readyInput(),
    liveRouteCount: 1,
    productionRootDiffCount: 2,
    legacyBypassCount: 3,
  });
  assert.equal(result.outcome, "BLOCKED");
  assert.deepEqual(
    result.blockers.filter((blocker) => ["LIVE_ROUTES", "PRODUCTION_ROOTS", "LEGACY_BYPASS"].includes(blocker.owner)).map((blocker) => blocker.owner),
    ["LIVE_ROUTES", "PRODUCTION_ROOTS", "LEGACY_BYPASS"],
  );
});
