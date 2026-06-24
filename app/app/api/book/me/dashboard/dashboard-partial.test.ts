import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyDashboardReads,
  CRITICAL_DASHBOARD_SOURCES,
  OPTIONAL_DASHBOARD_SOURCES,
  type DashboardSourceOutcomes,
} from "./dashboard-partial";

/** Every source succeeded. */
function allOk(): DashboardSourceOutcomes {
  const outcomes: DashboardSourceOutcomes = {};
  for (const s of CRITICAL_DASHBOARD_SOURCES) outcomes[s] = true;
  for (const s of OPTIONAL_DASHBOARD_SOURCES) outcomes[s] = true;
  return outcomes;
}

test("all reads succeed → ok, not partial, no warnings", () => {
  const decision = classifyDashboardReads(allOk());
  assert.equal(decision.ok, true);
  assert.equal(decision.partial, false);
  assert.deepEqual(decision.failedCritical, []);
  assert.deepEqual(decision.warnings, []);
});

test("a failed CRITICAL read → not ok (caller throws 503), partial irrelevant", () => {
  const outcomes = allOk();
  outcomes.entitlement = false;
  const decision = classifyDashboardReads(outcomes);
  assert.equal(decision.ok, false);
  assert.deepEqual(decision.failedCritical, ["entitlement"]);
  // partial is only meaningful when ok; must not be true while failing loud.
  assert.equal(decision.partial, false);
});

test("entitlement failure is critical — never collapses to a served FREE dashboard", () => {
  // Guards the money-path regression: a missing entitlement must 503, not FREE.
  const outcomes = allOk();
  outcomes.entitlement = false;
  assert.equal(classifyDashboardReads(outcomes).ok, false);
});

test("chapterStates is treated as critical (default decision)", () => {
  const outcomes = allOk();
  outcomes.chapterStates = false;
  const decision = classifyDashboardReads(outcomes);
  assert.equal(decision.ok, false);
  assert.ok(decision.failedCritical.includes("chapterStates"));
});

test("a failed OPTIONAL read → ok + partial + that source in warnings", () => {
  const outcomes = allOk();
  outcomes.badgeAwards = false;
  const decision = classifyDashboardReads(outcomes);
  assert.equal(decision.ok, true);
  assert.equal(decision.partial, true);
  assert.deepEqual(decision.warnings, ["badgeAwards"]);
});

test("profile is optional (default decision) — its failure degrades, not 503", () => {
  const outcomes = allOk();
  outcomes.profile = false;
  const decision = classifyDashboardReads(outcomes);
  assert.equal(decision.ok, true);
  assert.equal(decision.partial, true);
  assert.ok(decision.warnings.includes("profile"));
});

test("multiple optional failures listed in canonical order", () => {
  const outcomes = allOk();
  outcomes.readingDays = false;
  outcomes.settings = false;
  const decision = classifyDashboardReads(outcomes);
  assert.equal(decision.ok, true);
  // canonical order: settings before readingDays
  assert.deepEqual(decision.warnings, ["settings", "readingDays"]);
});

test("an absent outcome entry is treated as failed (never read as success)", () => {
  // Defensive: a missing critical entry must fail loud, not silently pass.
  const decision = classifyDashboardReads({});
  assert.equal(decision.ok, false);
  assert.deepEqual(decision.failedCritical, [...CRITICAL_DASHBOARD_SOURCES]);
});
