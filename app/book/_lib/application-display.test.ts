import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeApplicationStates,
  countAppliedChapters,
  getChapterApplicationBadge,
} from "./application-display";
import type { ChapterApplicationState } from "@/app/app/api/book/_lib/types";

/**
 * Two-axis completion (feedback #4) — library/rollup display helpers.
 *
 * Guards: (1) application state is SERVER-ONLY and can't be reconstructed from local
 * progress; (2) graceful degradation with zero commitments; (3) the rollup count math;
 * (4) the per-chapter badge per state (and "nothing when none").
 */

// ── normalizeApplicationStates (server-only, graceful) ───────────────────────

test("normalize: valid sparse server map passes through, drops 'none'", () => {
  const input = { "b:1": "committed", "b:2": "applied", "b:3": "none" };
  assert.deepEqual(normalizeApplicationStates(input), {
    "b:1": "committed",
    "b:2": "applied",
  });
});

test("normalize: missing / non-object / array → {} (graceful degradation)", () => {
  assert.deepEqual(normalizeApplicationStates(undefined), {});
  assert.deepEqual(normalizeApplicationStates(null), {});
  assert.deepEqual(normalizeApplicationStates("nope"), {});
  assert.deepEqual(normalizeApplicationStates(["b:1"]), {});
});

test("normalize: invalid values are dropped", () => {
  const input = { "b:1": "applied", "b:2": "bogus", "b:3": 5, "b:4": null };
  assert.deepEqual(normalizeApplicationStates(input), { "b:1": "applied" });
});

test("normalize: local-progress-shaped data yields NO application state (can't reconstruct from local)", () => {
  // Feeding completion/score data (the local progress shape) must not synthesize any
  // application state — values aren't valid application strings.
  const localish = {
    completedChapterIds: ["b:1", "b:2"],
    chapterScores: { "b:1": 90 },
    unlockedChapterIds: ["b:1"],
  };
  assert.deepEqual(normalizeApplicationStates(localish), {});
});

// ── countAppliedChapters (rollup math) ───────────────────────────────────────

test("count: counts only 'applied', ignores committed/none", () => {
  assert.equal(
    countAppliedChapters({ "b:1": "applied", "b:2": "committed", "b:3": "applied" }),
    2,
  );
});

test("count: empty map → 0 (zero-commitment book reads as today)", () => {
  assert.equal(countAppliedChapters({}), 0);
});

// ── getChapterApplicationBadge (per-state card badge) ────────────────────────

test("badge: applied → gold Applied with sr suffix", () => {
  const b = getChapterApplicationBadge("applied");
  assert.deepEqual(b, { tone: "applied", label: "Applied", srSuffix: " · Applied" });
});

test("badge: committed → Committed with sr suffix", () => {
  const b = getChapterApplicationBadge("committed");
  assert.deepEqual(b, { tone: "committed", label: "Committed", srSuffix: " · Committed" });
});

test("badge: none → null (nothing rendered, card unchanged)", () => {
  assert.equal(getChapterApplicationBadge("none"), null);
});

test("badge: every state is handled", () => {
  for (const s of ["none", "committed", "applied"] as ChapterApplicationState[]) {
    // Must not throw and must be null-or-descriptor.
    const b = getChapterApplicationBadge(s);
    assert.ok(b === null || (b.label.length > 0 && b.srSuffix.length > 0));
  }
});
