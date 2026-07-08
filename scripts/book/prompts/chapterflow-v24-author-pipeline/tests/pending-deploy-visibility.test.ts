/**
 * pending-deploy visibility (F-11) — publish-final WRITES the deploy-owed sentinel;
 * these readers/formatters surface it in doctor / book-status so the debt can't go
 * invisible once the publish print scrolls away.
 *
 * Locks in the contract:
 *  - reader outcomes: absent outer root → outer-root-missing (NOT "clean"); absent
 *    sentinel → clean; malformed/non-JSON/no-pending[] → malformed (loud, no throw);
 *    empty pending[] → clean; ≥1 entry → pending (entries verbatim)
 *  - doctor: a pending-deploy WARN section iff the sentinel is non-empty; escalated
 *    wording past 24h; missing outer root warns (never a false all-clear); malformed
 *    sentinel warns instead of crashing
 *  - book-status: prints the steps verbatim for a listed book; silent for an unlisted one
 *
 * Everything runs against a THROWAWAY tmp outer-root fixture — nothing touches the
 * real checkout or its sentinel.
 */
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { checkPendingDeploy } from "../src/lifecycle/doctor.js";
import {
  PENDING_DEPLOY_REL,
  PENDING_DEPLOY_SCHEMA,
  PENDING_DEPLOY_STEPS,
  formatBookPendingDeploy,
  mergePendingDeploy,
  pendingDeployAgeHours,
  readPendingDeploy,
  type PendingDeployEntry,
} from "../src/publish/publishFinal.js";

function tmpOuter(label: string): string {
  return resolve(tmpdir(), `cf-v24-pending-deploy-${label}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
}

/** Build a tmp outer root containing a sentinel with the given raw text (or no file). */
function makeOuter(label: string, sentinel?: string): { outer: string; cleanup: () => void } {
  const outer = tmpOuter(label);
  mkdirSync(resolve(outer, "book-packages"), { recursive: true });
  if (sentinel !== undefined) writeFileSync(resolve(outer, PENDING_DEPLOY_REL), sentinel);
  return { outer, cleanup: () => rmSync(outer, { recursive: true, force: true }) };
}

function entry(bookId: string, publishedAt: string): PendingDeployEntry {
  return { bookId, packageSha256: "a".repeat(64), publishedAt, steps: [...PENDING_DEPLOY_STEPS] };
}

// ── reader outcomes ──────────────────────────────────────────────────────────

test("readPendingDeploy: absent outer root degrades to outer-root-missing (NOT a false clean)", () => {
  const report = readPendingDeploy(resolve(tmpdir(), `cf-v24-does-not-exist-${process.pid}-${Math.random().toString(36).slice(2, 8)}`));
  assert.equal(report.outcome, "outer-root-missing");
  assert.notEqual(report.outcome, "clean");
  assert.match((report as { warning: string }).warning, /UNKNOWN/);
});

test("readPendingDeploy: outer root present but no sentinel file → clean", () => {
  const { outer, cleanup } = makeOuter("no-file");
  try {
    assert.equal(readPendingDeploy(outer).outcome, "clean");
  } finally {
    cleanup();
  }
});

test("readPendingDeploy: non-JSON sentinel → malformed (loud parse warning, never throws)", () => {
  const { outer, cleanup } = makeOuter("torn", "{ this is not json ]");
  try {
    const report = readPendingDeploy(outer);
    assert.equal(report.outcome, "malformed");
    assert.match((report as { warning: string }).warning, /not valid JSON/);
  } finally {
    cleanup();
  }
});

test("readPendingDeploy: JSON without a pending[] array → malformed", () => {
  const { outer, cleanup } = makeOuter("no-array", JSON.stringify({ schemaVersion: PENDING_DEPLOY_SCHEMA, pending: "nope" }));
  try {
    assert.equal(readPendingDeploy(outer).outcome, "malformed");
  } finally {
    cleanup();
  }
});

test("readPendingDeploy: empty pending[] → clean", () => {
  const { outer, cleanup } = makeOuter("empty", JSON.stringify({ schemaVersion: PENDING_DEPLOY_SCHEMA, pending: [] }));
  try {
    assert.equal(readPendingDeploy(outer).outcome, "clean");
  } finally {
    cleanup();
  }
});

test("readPendingDeploy: one valid entry → pending with the entry preserved verbatim", () => {
  const raw = mergePendingDeploy(null, entry("the-example-book", "2026-07-08T00:00:00.000Z"));
  const { outer, cleanup } = makeOuter("one", raw);
  try {
    const report = readPendingDeploy(outer);
    assert.equal(report.outcome, "pending");
    assert.equal(report.entries.length, 1);
    assert.equal(report.entries[0].bookId, "the-example-book");
    assert.deepEqual(report.entries[0].steps, [...PENDING_DEPLOY_STEPS]);
  } finally {
    cleanup();
  }
});

// ── age helper ───────────────────────────────────────────────────────────────

test("pendingDeployAgeHours: whole-hours math; unparseable → null; never negative", () => {
  const base = Date.parse("2026-07-08T00:00:00.000Z");
  assert.equal(pendingDeployAgeHours("2026-07-08T00:00:00.000Z", base + 90 * 60 * 1000), 1); // 90min → 1h floor
  assert.equal(pendingDeployAgeHours("2026-07-08T00:00:00.000Z", base + 25 * 3_600_000), 25);
  assert.equal(pendingDeployAgeHours("2026-07-08T00:00:00.000Z", base - 3_600_000), 0);       // future → clamped 0
  assert.equal(pendingDeployAgeHours("not-a-date", base), null);
});

// ── doctor section ───────────────────────────────────────────────────────────

test("checkPendingDeploy: clean sentinel → a single ok finding, no warning", () => {
  const { outer, cleanup } = makeOuter("doc-clean", JSON.stringify({ schemaVersion: PENDING_DEPLOY_SCHEMA, pending: [] }));
  try {
    const findings = checkPendingDeploy(outer);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, "ok");
    assert.equal(findings[0].check, "pending-deploy");
  } finally {
    cleanup();
  }
});

test("checkPendingDeploy: pending entry <24h → warn (not fatal), fresh wording", () => {
  const published = "2026-07-08T00:00:00.000Z";
  const raw = mergePendingDeploy(null, entry("fresh-book", published));
  const { outer, cleanup } = makeOuter("doc-fresh", raw);
  try {
    const now = Date.parse(published) + 3 * 3_600_000; // 3h old
    const findings = checkPendingDeploy(outer, now);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, "warn");
    assert.match(findings[0].message, /DEPLOY PENDING/);
    assert.match(findings[0].message, /3h ago/);
    assert.doesNotMatch(findings[0].message, /STALE/);
  } finally {
    cleanup();
  }
});

test("checkPendingDeploy: pending entry >24h → warn with escalated STALE wording", () => {
  const published = "2026-07-08T00:00:00.000Z";
  const raw = mergePendingDeploy(null, entry("stale-book", published));
  const { outer, cleanup } = makeOuter("doc-stale", raw);
  try {
    const now = Date.parse(published) + 48 * 3_600_000; // 48h old
    const findings = checkPendingDeploy(outer, now);
    assert.equal(findings[0].level, "warn");
    assert.match(findings[0].message, /STALE >24h/);
    assert.match(findings[0].message, /48h/);
  } finally {
    cleanup();
  }
});

test("checkPendingDeploy: missing outer root → warn (never a false all-clear)", () => {
  const findings = checkPendingDeploy(resolve(tmpdir(), `cf-v24-absent-${process.pid}-${Math.random().toString(36).slice(2, 8)}`));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "warn");
  assert.match(findings[0].message, /UNKNOWN/);
});

test("checkPendingDeploy: malformed sentinel → warn, does not throw (doctor stays alive)", () => {
  const { outer, cleanup } = makeOuter("doc-torn", "}{ hand-edited garbage");
  try {
    const findings = checkPendingDeploy(outer);
    assert.equal(findings[0].level, "warn");
  } finally {
    cleanup();
  }
});

// ── book-status block ────────────────────────────────────────────────────────

test("formatBookPendingDeploy: prints steps verbatim for a LISTED book", () => {
  const raw = mergePendingDeploy(null, entry("listed-book", "2026-07-08T00:00:00.000Z"));
  const { outer, cleanup } = makeOuter("bs-listed", raw);
  try {
    const block = formatBookPendingDeploy("listed-book", readPendingDeploy(outer));
    assert.ok(block, "expected a block for a listed book");
    for (const step of PENDING_DEPLOY_STEPS) assert.ok(block!.includes(step), `block should print step "${step}" verbatim`);
    assert.match(block!, /DEPLOY PENDING/);
  } finally {
    cleanup();
  }
});

test("formatBookPendingDeploy: silent (null) for an UNLISTED book", () => {
  const raw = mergePendingDeploy(null, entry("some-other-book", "2026-07-08T00:00:00.000Z"));
  const { outer, cleanup } = makeOuter("bs-unlisted", raw);
  try {
    assert.equal(formatBookPendingDeploy("not-in-sentinel", readPendingDeploy(outer)), null);
  } finally {
    cleanup();
  }
});

test("formatBookPendingDeploy: null when there is no pending debt at all", () => {
  const { outer, cleanup } = makeOuter("bs-clean");
  try {
    assert.equal(formatBookPendingDeploy("any-book", readPendingDeploy(outer)), null);
  } finally {
    cleanup();
  }
});
