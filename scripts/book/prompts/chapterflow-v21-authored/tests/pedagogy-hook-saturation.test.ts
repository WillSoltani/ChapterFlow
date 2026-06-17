/**
 * Hook-saturation guard — the durable fix for the scene_skeleton class.
 *
 * The pedagogy hook allocator deals ONE hook shape per chapter with a 50% "dominant"
 * slot (HOOK_CHAPTER_PATTERN=[0,1,0,2]). When the dominant resolved to a SCENE-SKELETON-
 * PRONE shape (object-in-motion / room-after-action — whose definition templates an
 * "[object] travels surface→surface" opener), all 10 even chapters of eat-that-frog
 * opened with the same frame, which only the NON-deterministic model sweep can catch.
 * The fix bars a scene-prone shape from the dominant slot and caps total share at deal
 * time. These tests lock it across many bookIds/sizes: the dominant is NEVER scene-prone,
 * no scene-prone shape exceeds 40%, no shape exceeds 60% — and the eat-that-frog deal
 * specifically no longer makes object-in-motion the dominant.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planPedagogy, loadPedagogyPalettes } from "../src/librarian/pedagogyPlan.js";

const palettes = loadPedagogyPalettes();
const PRONE = new Set(palettes.hookShapes.filter((h) => h.sceneSkeletonProne).map((h) => h.id));

const BOOK_IDS = [
  "eat-that-frog", "outliers", "pmbok-guide", "hyperfocus", "the-book-of-boundaries",
  "deep-work", "atomic-habits", "the-power-of-habit", "thinking-fast-and-slow", "mindset",
  "grit", "drive", "flow", "range", "ultralearning", "make-it-stick", "peak", "so-good",
];
const SIZES = [7, 9, 12, 13, 21, 31, 32];

function hookCounts(bookId: string, n: number): Map<string, number> {
  const plan = planPedagogy(bookId, 1, n);
  const counts = new Map<string, number>();
  for (let c = 1; c <= n; c++) {
    const h = plan.allocation[c].hookShape;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return counts;
}

test("config tags >= 2 scene-skeleton-prone hook shapes (the template seeders)", () => {
  assert.ok(PRONE.has("object-in-motion"), "object-in-motion must be tagged scene-skeleton-prone");
  assert.ok(PRONE.has("room-after-action"), "room-after-action must be tagged scene-skeleton-prone");
  assert.ok(PRONE.size <= palettes.hookShapes.length - 1, "at least one non-prone shape must exist to be the dominant");
});

test("the dominant hook shape is NEVER scene-skeleton-prone, across many bookIds and sizes", () => {
  for (const id of BOOK_IDS) {
    for (const n of SIZES) {
      const plan = planPedagogy(id, 1, n);
      assert.ok(
        !PRONE.has(plan.bookMix.dominantHookShape),
        `${id} N=${n}: dominant "${plan.bookMix.dominantHookShape}" is scene-skeleton-prone — it must be demoted out of the 50% slot`,
      );
    }
  }
});

test("no scene-prone shape exceeds 40% and no shape exceeds 60% of any book (deal-time cap holds)", () => {
  for (const id of BOOK_IDS) {
    for (const n of SIZES) {
      for (const [h, cnt] of hookCounts(id, n)) {
        const share = cnt / n;
        assert.ok(share <= 0.6 + 1e-9, `${id} N=${n}: "${h}" at ${share.toFixed(3)} exceeds the 0.60 cap`);
        if (PRONE.has(h)) {
          assert.ok(share <= 0.4 + 1e-9, `${id} N=${n}: scene-prone "${h}" at ${share.toFixed(3)} exceeds the 0.40 cap`);
        }
      }
    }
  }
});

test("partial / single-chapter re-deals do NOT throw (saturation is a whole-book property) yet still demote the dominant", () => {
  // The operator re-deals single chapters (fanout --from N --to N --all, the repair path)
  // and previews partial ranges (pedagogy-plan --from N --to M); a 1-3 chapter slice is
  // trivially 100%/67% of one shape and must NOT trip the whole-book saturation cap — but
  // the scene-prone demotion still has to apply to whatever chapter is re-dealt.
  for (const id of ["daring-greatly", "eat-that-frog", "outliers", "the-gifts-of-imperfection"]) {
    for (const [from, to] of [[1, 1], [5, 5], [1, 2], [1, 3], [2, 4]] as const) {
      assert.doesNotThrow(() => planPedagogy(id, from, to), `${id} ch${from}-${to} must not throw on a partial re-deal`);
      const plan = planPedagogy(id, from, to);
      assert.ok(!PRONE.has(plan.bookMix.dominantHookShape), `${id} ch${from}-${to}: dominant "${plan.bookMix.dominantHookShape}" must not be scene-prone`);
    }
  }
});

test("eat-that-frog specifically: object-in-motion is no longer the 50% dominant (the exact failure)", () => {
  const plan = planPedagogy("eat-that-frog", 1, 21);
  assert.notEqual(plan.bookMix.dominantHookShape, "object-in-motion");
  const om = (hookCounts("eat-that-frog", 21).get("object-in-motion") ?? 0) / 21;
  assert.ok(om <= 0.4 + 1e-9, `object-in-motion at ${om.toFixed(3)} must be a <=40% secondary, not the 50% dominant`);
});
