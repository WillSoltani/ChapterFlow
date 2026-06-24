import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildExportManifest,
  ExportSourceTracker,
  type ExportSourceStatus,
} from "./export-manifest-core";

const AT = "2026-06-24T00:00:00.000Z";

// ─── buildExportManifest ──────────────────────────────────────────────────────

test("all sources complete → complete:true, empty partialSources", () => {
  const sources: ExportSourceStatus[] = [
    { name: "readingDays", count: 3, complete: true },
    { name: "badges", count: 1, complete: true },
  ];
  const m = buildExportManifest(sources, AT);
  assert.equal(m.complete, true);
  assert.deepEqual(m.partialSources, []);
  assert.deepEqual(m.counts, { readingDays: 3, badges: 1 });
  assert.equal(m.generatedAt, AT);
});

test("a single incomplete source flips complete:false and lists it", () => {
  const sources: ExportSourceStatus[] = [
    { name: "readingDays", count: 3, complete: true },
    { name: "analyticsEvents", count: 200, complete: false, reason: "truncated" },
  ];
  const m = buildExportManifest(sources, AT);
  assert.equal(m.complete, false);
  assert.deepEqual(m.partialSources, ["analyticsEvents"]);
});

test("partialSources is sorted for stable output", () => {
  const sources: ExportSourceStatus[] = [
    { name: "zeta", count: 0, complete: false, reason: "read_failed" },
    { name: "alpha", count: 0, complete: false, reason: "read_failed" },
  ];
  assert.deepEqual(buildExportManifest(sources, AT).partialSources, ["alpha", "zeta"]);
});

// ─── ExportSourceTracker.runSource ────────────────────────────────────────────

test("runSource records a successful array read as complete", async () => {
  const tracker = new ExportSourceTracker();
  const items = await tracker.runSource("badges", async () => [1, 2, 3], []);
  assert.deepEqual(items, [1, 2, 3]);
  const m = tracker.build(AT);
  assert.equal(m.complete, true);
  assert.equal(m.counts.badges, 3);
});

test("runSource records a {items,truncated:true} read as incomplete (truncated)", async () => {
  const tracker = new ExportSourceTracker();
  const items = await tracker.runSource(
    "analyticsEvents",
    async () => ({ items: [1, 2], truncated: true }),
    [],
  );
  assert.deepEqual(items, [1, 2]);
  const m = tracker.build(AT);
  assert.equal(m.complete, false);
  assert.deepEqual(m.partialSources, ["analyticsEvents"]);
  assert.equal(m.sources.find((s) => s.name === "analyticsEvents")?.reason, "truncated");
});

test("runSource catches a THROWN read → read_failed, returns fallback (export still succeeds)", async () => {
  // This is the silently-failed-source case the manifest exists to expose.
  const tracker = new ExportSourceTracker();
  const fallback: number[] = [];
  const items = await tracker.runSource(
    "flowPointsLedger",
    async () => {
      throw new Error("dynamo down");
    },
    fallback,
  );
  assert.equal(items, fallback, "must return the fallback, not throw");
  const m = tracker.build(AT);
  assert.equal(m.complete, false);
  assert.deepEqual(m.partialSources, ["flowPointsLedger"]);
  assert.equal(m.sources.find((s) => s.name === "flowPointsLedger")?.reason, "read_failed");
  // Count reflects the fallback length (0), so the manifest doesn't overstate.
  assert.equal(m.counts.flowPointsLedger, 0);
});

test("runSource treats a plain array (no truncated field) as complete", async () => {
  const tracker = new ExportSourceTracker();
  await tracker.runSource("savedBooks", async () => [{ a: 1 }], []);
  assert.equal(tracker.build(AT).complete, true);
});

test("explicit record() participates in the manifest (e.g. analytics not configured)", () => {
  const tracker = new ExportSourceTracker();
  tracker.record({ name: "analyticsEvents", count: 0, complete: true });
  const m = tracker.build(AT);
  assert.equal(m.complete, true);
  assert.equal(m.counts.analyticsEvents, 0);
});

test("mixed sources: one failure makes the whole export incomplete but still built", async () => {
  const tracker = new ExportSourceTracker();
  await tracker.runSource("readingDays", async () => [1, 2], []);
  await tracker.runSource("badges", async () => {
    throw new Error("x");
  }, []);
  const m = tracker.build(AT);
  assert.equal(m.complete, false);
  assert.deepEqual(m.partialSources, ["badges"]);
  assert.equal(m.counts.readingDays, 2);
});
