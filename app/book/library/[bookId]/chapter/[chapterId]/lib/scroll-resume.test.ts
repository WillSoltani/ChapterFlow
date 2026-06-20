import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCROLL_RESUME_MIN_OFFSET,
  SCROLL_RESUME_MAX_ENTRIES,
  scrollResumeKey,
  parseScrollResumeMap,
  serializeScrollResumeMap,
  pruneScrollResumeMap,
  upsertScrollResume,
  getScrollResumeOffset,
  decideRestoreTarget,
  type ScrollResumeMap,
} from "./scroll-resume";

// ─── scrollResumeKey ─────────────────────────────────────────────────────────

test("scrollResumeKey composes bookId and chapterId distinctly", () => {
  assert.equal(scrollResumeKey("atomic-habits", "ch02"), "atomic-habits::ch02");
  // The "::" separator keeps (a, bc) and (ab, c) from colliding.
  assert.notEqual(scrollResumeKey("a", "bc"), scrollResumeKey("ab", "c"));
});

// ─── parseScrollResumeMap ────────────────────────────────────────────────────

test("parseScrollResumeMap returns {} for empty/garbage/non-object input", () => {
  assert.deepEqual(parseScrollResumeMap(null), {});
  assert.deepEqual(parseScrollResumeMap(""), {});
  assert.deepEqual(parseScrollResumeMap("not json"), {});
  assert.deepEqual(parseScrollResumeMap("[1,2,3]"), {}); // arrays rejected
  assert.deepEqual(parseScrollResumeMap("42"), {});
  assert.deepEqual(parseScrollResumeMap("null"), {});
});

test("parseScrollResumeMap keeps valid entries and rounds y", () => {
  const map = parseScrollResumeMap('{"b::c":{"y":120.7,"t":1000}}');
  assert.deepEqual(map, { "b::c": { y: 121, t: 1000 } });
});

test("parseScrollResumeMap drops malformed entries but keeps siblings", () => {
  const map = parseScrollResumeMap(
    JSON.stringify({
      good: { y: 500, t: 10 },
      negY: { y: -5, t: 10 },
      nanY: { y: "nope", t: 10 },
      nullVal: null,
      arrVal: [1],
      noY: { t: 10 },
      missingT: { y: 300 }, // t defaults to 0, entry kept
    })
  );
  assert.deepEqual(map, {
    good: { y: 500, t: 10 },
    missingT: { y: 300, t: 0 },
  });
});

// ─── serialize round-trip ────────────────────────────────────────────────────

test("serialize → parse round-trips a clean map", () => {
  const map: ScrollResumeMap = { "x::y": { y: 800, t: 123 } };
  assert.deepEqual(parseScrollResumeMap(serializeScrollResumeMap(map)), map);
});

// ─── upsertScrollResume ──────────────────────────────────────────────────────

test("upsert adds an entry at/above the min offset and rounds y", () => {
  const next = upsertScrollResume({}, "k", 812.4, 1000);
  assert.deepEqual(next, { k: { y: 812, t: 1000 } });
});

test("upsert is immutable — does not mutate the input map", () => {
  const original: ScrollResumeMap = { k: { y: 400, t: 1 } };
  const snapshot = JSON.parse(JSON.stringify(original));
  upsertScrollResume(original, "k", 900, 2);
  assert.deepEqual(original, snapshot);
});

test("upsert below the min offset REMOVES the entry (scroll-to-top erases stale deep position)", () => {
  const start: ScrollResumeMap = { k: { y: 900, t: 1 } };
  const afterTop = upsertScrollResume(start, "k", 10, 2);
  assert.deepEqual(afterTop, {});
  // Exactly at the threshold is kept; one below is dropped.
  assert.ok(upsertScrollResume({}, "k", SCROLL_RESUME_MIN_OFFSET, 1).k);
  assert.equal(upsertScrollResume({}, "k", SCROLL_RESUME_MIN_OFFSET - 1, 1).k, undefined);
});

test("upsert clamps a negative/non-finite y to 0 (→ below min → removed)", () => {
  assert.deepEqual(upsertScrollResume({ k: { y: 900, t: 1 } }, "k", -50, 2), {});
  assert.deepEqual(upsertScrollResume({ k: { y: 900, t: 1 } }, "k", Number.NaN, 2), {});
});

test("upsert prunes to the cap, keeping the NEWEST entries by save time", () => {
  let map: ScrollResumeMap = {};
  // Insert cap+5 entries with increasing timestamps; t === index.
  for (let i = 0; i < SCROLL_RESUME_MAX_ENTRIES + 5; i++) {
    map = upsertScrollResume(map, `k${i}`, 500, i);
  }
  const keys = Object.keys(map);
  assert.equal(keys.length, SCROLL_RESUME_MAX_ENTRIES);
  // The 5 oldest (k0..k4) must have been evicted; the newest must remain.
  assert.equal(map.k0, undefined);
  assert.equal(map.k4, undefined);
  assert.ok(map.k5);
  assert.ok(map[`k${SCROLL_RESUME_MAX_ENTRIES + 4}`]);
});

// ─── pruneScrollResumeMap ────────────────────────────────────────────────────

test("prune is a no-op at/under the cap", () => {
  const map: ScrollResumeMap = { a: { y: 1, t: 1 }, b: { y: 2, t: 2 } };
  assert.equal(pruneScrollResumeMap(map, 5), map); // same reference when under cap
});

test("prune keeps newest by t and is deterministic on ties", () => {
  const map: ScrollResumeMap = {
    old: { y: 1, t: 1 },
    tieA: { y: 1, t: 9 },
    tieB: { y: 1, t: 9 },
  };
  // cap=2 keeps both newest (t=9) and evicts the old one — no tie-break needed.
  const two = pruneScrollResumeMap(map, 2);
  assert.deepEqual(new Set(Object.keys(two)), new Set(["tieA", "tieB"]));
  assert.equal(two.old, undefined);

  // cap=1 forces the tie-break between the two t=9 entries: ascending key wins.
  const one = pruneScrollResumeMap(map, 1);
  assert.deepEqual(Object.keys(one), ["tieA"]);
});

// ─── getScrollResumeOffset ───────────────────────────────────────────────────

test("getScrollResumeOffset returns the offset when present and worth restoring", () => {
  const map: ScrollResumeMap = { k: { y: 640, t: 1 } };
  assert.equal(getScrollResumeOffset(map, "k"), 640);
});

test("getScrollResumeOffset returns null when absent or below the min", () => {
  assert.equal(getScrollResumeOffset({}, "missing"), null);
  assert.equal(getScrollResumeOffset({ k: { y: 50, t: 1 } }, "k"), null);
});

// ─── decideRestoreTarget ─────────────────────────────────────────────────────

test("decideRestoreTarget returns null when there's no saved offset", () => {
  assert.equal(decideRestoreTarget({ savedOffset: null, maxScroll: 5000 }), null);
});

test("decideRestoreTarget returns null below the min offset", () => {
  assert.equal(decideRestoreTarget({ savedOffset: 100, maxScroll: 5000 }), null);
});

test("decideRestoreTarget returns the saved offset when the page is tall enough", () => {
  assert.equal(decideRestoreTarget({ savedOffset: 1500, maxScroll: 5000 }), 1500);
});

test("decideRestoreTarget clamps to maxScroll when the chapter is now shorter", () => {
  // Saved deep in a long variant; re-opened on a shorter one → clamp to the end.
  assert.equal(decideRestoreTarget({ savedOffset: 4000, maxScroll: 1200.6 }), 1201);
});

test("decideRestoreTarget returns null when the page can't scroll meaningfully", () => {
  assert.equal(decideRestoreTarget({ savedOffset: 1500, maxScroll: 0 }), null);
  assert.equal(decideRestoreTarget({ savedOffset: 1500, maxScroll: 50 }), null);
  assert.equal(
    decideRestoreTarget({ savedOffset: 1500, maxScroll: Number.NaN }),
    null
  );
});
