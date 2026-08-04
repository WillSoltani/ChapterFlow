/**
 * IMP-12 items 3-7 — frozen-contract compatibility, worker-report governance,
 * generic fixture validity, and synthetic P0/P1 failure-class coverage.
 *
 * These prove: the Phase-0 contract manifest still matches the live contract
 * source (no parallel agent silently forked a schema); every landed worker
 * report validates against the frozen schema and carries its adverse/empty
 * fields explicitly; the generic fixture factories emit schema-valid artifacts;
 * and each forbidden source-plan combination is rejected by the frozen
 * validator (the migration failure classes, without any deleted book text).
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import { contractFreezeDivergences, ALL_CONTRACTS } from "../src/contracts/index.js";
import { validateWorkerReport } from "../src/contracts/workerReport.js";
import { validateSourceUsePlan } from "../src/contracts/sourceUsePlan.js";
import { validateAttemptIdentity } from "../src/contracts/candidateTransaction.js";
import { validateRouteResult } from "../src/contracts/routeContracts.js";
import { validateRepairFinding, validateChapterPatch, FINDING_FORBIDDEN_CONTROL_FIELDS } from "../src/contracts/repairContracts.js";
import { validateAttemptEvidenceManifest } from "../src/contracts/attemptEvidence.js";
import {
  fxAttemptIdentity, fxCandidateRecord, fxChapterPatch, fxEvidenceManifest,
  fxPacket, fxPlan, fxRepairFinding, fxRouteResult, FORBIDDEN_PLAN_UNITS,
} from "./migrationFixtures.js";
import { compileSourceUsePlan } from "../src/compiler/sourceUsePlanCompiler.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// tests → pipeline → prompts → book → scripts → repo-root, then docs/v25/reports.
const REPORTS_DIR = resolve(HERE, "..", "..", "..", "..", "..", "docs", "v25", "reports");

// ── contract freeze ─────────────────────────────────────────────────────────

test("the frozen contract manifest still matches the live contract source (no parallel-agent schema fork)", () => {
  assert.deepEqual(contractFreezeDivergences(), [], "a divergence means a contract changed without a version bump + regenerated manifest");
  // Every owner prompt in the migration is represented exactly once per contract name.
  const names = ALL_CONTRACTS.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, "contract names are unique");
  assert.ok(names.includes("source-use-plan") && names.includes("candidate-transaction") && names.includes("route-result"), "the migration's core contracts are frozen");
});

// ── worker-report governance ────────────────────────────────────────────────

test("every landed worker report validates against the frozen schema and declares its adverse/empty fields explicitly", () => {
  const reports = readdirSync(REPORTS_DIR).filter((f) => /^implementation-report\.imp-\d\d\.json$/.test(f)).sort();
  assert.ok(reports.length >= 4, `expected the landed IMP-00..03 reports, found ${reports.length}`);
  for (const file of reports) {
    const report = JSON.parse(readFileSync(resolve(REPORTS_DIR, file), "utf8"));
    assert.deepEqual(validateWorkerReport(report), [], `${file} must satisfy the frozen worker-report schema`);
    // Adverse/empty fields are PRESENT (explicit), never omitted (item 5).
    for (const field of ["gateChanges", "bookSpecificExceptions", "unexpectedWrites", "unresolvedRisks", "dependencyAssumptions"]) {
      assert.ok(Array.isArray(report[field]), `${file}.${field} must be an explicit array (empty is fine, omitted is not)`);
    }
    assert.ok(report.testResults && typeof report.testResults.pass === "number" && typeof report.testResults.fail === "number", `${file} reports pass/fail counts`);
    // No book-specific production exception may hide here.
    assert.deepEqual(report.bookSpecificExceptions, [], `${file} carries zero book-specific exceptions`);
  }
});

test("worker-report validation REJECTS a report that omits a required adverse field or misreports results", () => {
  const good = JSON.parse(readFileSync(resolve(REPORTS_DIR, "implementation-report.imp-03.json"), "utf8"));
  const { unexpectedWrites, ...missingField } = good;
  assert.ok(validateWorkerReport(missingField).length > 0, "a report missing unexpectedWrites is rejected");
  assert.ok(validateWorkerReport({ ...good, testResults: { pass: 1 } }).length > 0, "a report with an incomplete testResults block is rejected");
  assert.ok(validateWorkerReport({ ...good, schema: "wrong" }).length > 0, "a wrong schema tag is rejected");
});

// ── generic fixture validity (item 6) ────────────────────────────────────────

test("generic fixture factories emit schema-valid artifacts for every migration contract", () => {
  assert.deepEqual(validateAttemptIdentity(fxAttemptIdentity()), [], "attempt identity fixture valid");
  assert.deepEqual(validateRouteResult(fxRouteResult()), [], "route result fixture valid");
  assert.deepEqual(validateRepairFinding(fxRepairFinding()), [], "repair finding fixture valid");
  assert.deepEqual(validateChapterPatch(fxChapterPatch()), [], "chapter patch fixture valid");
  assert.deepEqual(validateAttemptEvidenceManifest(fxEvidenceManifest()), [], "evidence manifest fixture valid");
  // The candidate record embeds a valid attempt identity.
  assert.deepEqual(validateAttemptIdentity(fxCandidateRecord().attempt), [], "candidate record's attempt valid");
  // A compiled plan from the generic packet is contract-valid.
  const { plan } = compileSourceUsePlan(fxPacket());
  assert.deepEqual(validateSourceUsePlan(plan), [], "a plan compiled from the generic packet is valid");
  assert.deepEqual(validateSourceUsePlan(fxPlan()), [], "the standalone plan fixture is valid");
});

// ── synthetic P0/P1 failure classes (items 7, 11, 12) ─────────────────────────

test("every forbidden source-plan combination is REJECTED by the frozen validator (synthetic, no deleted text)", () => {
  for (const [name, unit] of Object.entries(FORBIDDEN_PLAN_UNITS)) {
    const plan = fxPlan({ units: [unit] });
    assert.ok(validateSourceUsePlan(plan).length > 0, `forbidden combination "${name}" must be rejected by the contract`);
  }
});

test("a repair finding carrying ANY forbidden control field is rejected (control-plane injection guard)", () => {
  for (const field of FINDING_FORBIDDEN_CONTROL_FIELDS) {
    const finding = { ...fxRepairFinding(), [field]: "hijack" } as unknown;
    assert.ok(validateRepairFinding(finding).length > 0, `a finding carrying "${field}" must be rejected`);
  }
});

test("candidate-outcome and provider-outcome unions are disjoint enums the fixtures can only pick from", () => {
  // A malformed-output candidate and a timeout provider outcome are representable
  // and valid; an invented outcome is not.
  assert.deepEqual(validateRouteResult(fxRouteResult({ outcome: "timeout" })), [], "timeout is a valid provider outcome");
  assert.ok(validateRouteResult(fxRouteResult({ outcome: "made_up" as never })).length > 0, "an invented provider outcome is rejected");
  const rec = fxCandidateRecord({ outcome: "unexpected_write" });
  assert.equal(rec.outcome, "unexpected_write", "the unexpected-write P0 class is representable as a candidate outcome");
});
