/**
 * IMP-12 item 2 — the production-leak detector's own mechanism tests, plus the
 * always-on forbidden-shadow invariant and the injectable-roots abstraction.
 *
 * "Demonstrate that removing one key protection makes its fixture fail" (verify
 * step 5): a deliberately mutated manifest MUST be reported; an untouched one
 * MUST be clean.
 */

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import {
  diffRootManifests,
  guardedProductionRoots,
  snapshotProductionRoots,
  verifyProductionRoots,
  walkRootManifest,
  formatLeakReports,
  type LeakGuardSnapshot,
} from "./productionLeakGuard.js";

test("testRoots: every slot lives under one disposable base; dispose removes the whole tree; two rigs never collide", () => {
  const a = mkTestRoots();
  const b = mkTestRoots();
  assert.notEqual(a.base, b.base, "two rigs get distinct bases (pid+seq unique)");
  for (const slot of [a.stateRoot, a.attemptsRoot, a.evidenceRoot, a.execLogRoot, a.workspacesRoot, a.homeRoot, a.bakeoffRoot, a.reviewsRoot]) {
    assert.ok(slot.startsWith(a.base), "every slot is under the base");
  }
  writeFileSync(join(a.stateRoot, "probe.json"), "{}");
  a.dispose();
  assert.throws(() => walkRootManifest(a.base) && rmSync(join(a.stateRoot, "probe.json")), /ENOENT|./);
  b.dispose();
});

test("walk + diff: an added, a changed, and a removed entry are each reported; an untouched tree is clean", () => {
  const roots = mkTestRoots();
  try {
    mkdirSync(join(roots.stateRoot, "sub"), { recursive: true });
    writeFileSync(join(roots.stateRoot, "keep.json"), "1");
    writeFileSync(join(roots.stateRoot, "gone.json"), "2");
    const before = walkRootManifest(roots.stateRoot);
    assert.deepEqual(diffRootManifests(before, walkRootManifest(roots.stateRoot)), { added: [], removed: [], changed: [] }, "identical walk is clean");

    writeFileSync(join(roots.stateRoot, "new.json"), "3");
    writeFileSync(join(roots.stateRoot, "keep.json"), "changed-bytes");
    rmSync(join(roots.stateRoot, "gone.json"));
    const diff = diffRootManifests(before, walkRootManifest(roots.stateRoot));
    assert.deepEqual(diff.added, ["new.json"]);
    assert.deepEqual(diff.removed, ["gone.json"]);
    assert.deepEqual(diff.changed, ["keep.json"]);
    assert.match(formatLeakReports([{ root: "x", ...diff }]), /\+ new\.json[\s\S]*- gone\.json[\s\S]*~ keep\.json/);
  } finally {
    roots.dispose();
  }
});

test("the guarded-root set names the forbidden shadow + pipeline roots as diffable, and the user codex home as read-safe (not diffed)", () => {
  const roots = guardedProductionRoots();
  const byName = Object.fromEntries(roots.map((r) => [r.name, r]));
  assert.ok(Object.keys(byName).some((n) => n.includes("forbidden shadow")), "the repo-root shadow is guarded (CLAUDE.md P0)");
  for (const n of ["pipeline-state", "pipeline-logs", "pipeline-attempts"]) {
    assert.ok(byName[n]?.diffable, `${n} is diffed by the runner`);
  }
  assert.equal(byName["user-codex-home"]?.diffable, false, "the user codex home is enumerated but NOT diffed (ambient churn; auth-copy pinned in exec-envelope.test.ts)");
  // snapshotProductionRoots (what the runner uses) therefore excludes the codex home.
  const snapshotNames = new Set(snapshotProductionRoots().map((r) => r.name));
  assert.ok(!snapshotNames.has("user-codex-home"), "the runner snapshot excludes the noisy codex home");
});

test("verifyProductionRoots is empty when nothing moved; a planted write is reported (controlled root, not the live churning home)", () => {
  // Run over a CONTROLLED tmp root — the real ~/.codex churns from any live
  // Codex session, so a self-consistency assertion over the live guarded set
  // would be environment-flaky. The property under test (snapshot then re-walk
  // with no interleaved write ⇒ clean; with a write ⇒ reported) is root-agnostic.
  const roots = mkTestRoots();
  try {
    writeFileSync(join(roots.stateRoot, "seed.json"), "{}");
    const snap: LeakGuardSnapshot = [{ name: "controlled", path: roots.stateRoot, manifest: walkRootManifest(roots.stateRoot) }];
    assert.deepEqual(verifyProductionRoots(snap), [], "a no-op window is clean");
    writeFileSync(join(roots.stateRoot, "leaked.json"), "1");
    const reports = verifyProductionRoots(snap);
    assert.equal(reports.length, 1, "a planted write is reported");
    assert.deepEqual(reports[0].added, ["leaked.json"]);
    assert.match(formatLeakReports(reports), /PRODUCTION-ROOT MUTATION: controlled/);
  } finally {
    roots.dispose();
  }
});
