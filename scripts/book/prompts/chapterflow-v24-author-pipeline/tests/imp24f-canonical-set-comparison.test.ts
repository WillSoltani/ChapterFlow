import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical } from "../src/contracts/contractUtil.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { qualifyRole } from "../src/bakeoff/migration/roleQualification.js";
import {
  IMP24_FROZEN_ROLE_THRESHOLDS,
  type RoleQualificationRunnerResultV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import { projectRoleQualificationResultForSetComparisonV3 } from
  "../src/orchestrator/forwardRetainedRoleQualificationEvidenceV3.js";
import { test } from "./harness.js";

const TERMINAL_RESULT_PATH = resolve(
  PIPELINE_DIR,
  "state/migration-experiments/s16-forward-role-qualification-v3-envelope-final/live/qualification-result.json",
);

function loadTerminalResult(): RoleQualificationRunnerResultV3 {
  return JSON.parse(readFileSync(TERMINAL_RESULT_PATH, "utf8")) as RoleQualificationRunnerResultV3;
}

test("IMP-24F canonical set comparison accepts the seven exact retained threshold-order differences", () => {
  const retained = loadTerminalResult();
  const recomputed: RoleQualificationRunnerResultV3 = {
    ...retained,
    profileRoleResults: retained.profileRoleResults.map((item) => ({
      ...item,
      outcome: item.metrics === null
        ? item.outcome
        : qualifyRole(item.role, item.metrics.metrics, IMP24_FROZEN_ROLE_THRESHOLDS, item.metrics.denominators),
    })),
  };
  const orderingMismatches = retained.profileRoleResults.filter((item, index) =>
    hashCanonical(item.outcome) !== hashCanonical(recomputed.profileRoleResults[index].outcome));

  assert.equal(orderingMismatches.length, 7);
  const exactReaderMismatch = orderingMismatches.find((item) =>
    item.role === "reader" && item.profile.profileId === "gpt-5.6-sol@high")!;
  assert.deepEqual(exactReaderMismatch.outcome.failedThresholds, [
    "cleanControlPassRate",
    "evidenceSpanValidity",
    "hardBlockerSensitivity",
    "requiredCasesResolved",
    "schemaValidity",
  ]);
  assert.deepEqual(recomputed.profileRoleResults.find((item) =>
    item.role === "reader" && item.profile.profileId === "gpt-5.6-sol@high")!.outcome.failedThresholds, [
    "schemaValidity",
    "hardBlockerSensitivity",
    "cleanControlPassRate",
    "evidenceSpanValidity",
    "requiredCasesResolved",
  ]);

  assert.notEqual(hashCanonical(retained), hashCanonical(recomputed),
    "the raw terminal comparison must reproduce the historical ordering defect");
  assert.equal(
    hashCanonical(projectRoleQualificationResultForSetComparisonV3(retained)),
    hashCanonical(projectRoleQualificationResultForSetComparisonV3(recomputed)),
  );

  const projected = projectRoleQualificationResultForSetComparisonV3(retained);
  assert.strictEqual(projected.schedule, retained.schedule);
  assert.strictEqual(projected.attempts, retained.attempts);
  assert.strictEqual(projected.qualifiers, retained.qualifiers);
  assert.strictEqual(projected.selected, retained.selected);
  assert.strictEqual(projected.registry, retained.registry);
});

test("IMP-24F comparison projection rejects duplicate threshold members instead of masking corruption", () => {
  const retained = loadTerminalResult();
  const firstFailed = retained.profileRoleResults.find((item) => item.outcome.failedThresholds.length > 0)!;
  const duplicate: RoleQualificationRunnerResultV3 = {
    ...retained,
    profileRoleResults: retained.profileRoleResults.map((item) => item === firstFailed
      ? {
          ...item,
          outcome: {
            ...item.outcome,
            failedThresholds: [...item.outcome.failedThresholds, item.outcome.failedThresholds[0]],
          },
        }
      : item),
  };
  assert.throws(() => projectRoleQualificationResultForSetComparisonV3(duplicate), /duplicate member/);
});
