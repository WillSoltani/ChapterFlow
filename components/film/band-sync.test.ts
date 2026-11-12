import { test } from "node:test";
import assert from "node:assert/strict";
import { bandTierEntry } from "../../scripts/film/band-sync.mjs";

const FRAME = { w: 1080, h: 1920 };
const BAND = { x: 0, y: 474, w: 1080, h: 972 };
const manifest = (extra: { count?: number; v?: string } = {}) => ({ width: 900, height: 810, frame: FRAME, band: BAND, count: 241, ...extra });

test("bandTierEntry: a manifest version replaces the timeline's", () => {
  const { entry, stale } = bandTierEntry({ v: "old" }, manifest({ v: "new" }), 241, "palace-00-b900");
  assert.deepEqual(entry, { width: 900, height: 810, frame: FRAME, band: BAND, v: "new" });
  assert.equal(stale, null);
});

test("bandTierEntry: a manifest with no version (placeholder) keeps the timeline's version", () => {
  // Regression: syncTimeline used to replace the entry with one that had no v,
  // so the tier's frame URLs lost their ?v= cache-buster.
  const { entry } = bandTierEntry({ v: "mwbqtkt9" }, manifest(), 241, "palace-00-b900");
  assert.equal(entry.v, "mwbqtkt9");
});

test("bandTierEntry: no version anywhere leaves v out", () => {
  const { entry } = bandTierEntry(undefined, manifest(), 241, "palace-00-b900");
  assert.equal("v" in entry, false);
});

test("bandTierEntry: a tier with a different frame count than the film is stale", () => {
  // Regression: a landscape re-encode with 260 frames left the 241-frame tier
  // in place and nothing said so.
  const { stale } = bandTierEntry({ v: "a" }, manifest({ v: "a" }), 260, "palace-00-b900");
  assert.match(stale ?? "", /palace-00-b900 holds 241 frames but the film has 260/);
  assert.match(stale ?? "", /--bands/);
});
