import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isChapterStateStale,
  mergeChapterState,
} from "./chapter-state-merge-core";

const OLD = "2026-11-10T08:00:00.000Z";
const NEW = "2026-11-12T08:00:00.000Z";

test("keys the incoming write leaves out keep their stored values", () => {
  const merged = mergeChapterState(
    { activeTab: "summary", notes: "kept", notesUpdatedAt: OLD, fontScale: "md" },
    { activeTab: "quiz" }
  );
  assert.deepEqual(merged, {
    activeTab: "quiz",
    notes: "kept",
    notesUpdatedAt: OLD,
    fontScale: "md",
  });
});

test("unstamped incoming notes never replace stamped stored notes", () => {
  const merged = mergeChapterState(
    { notes: "written on the laptop", notesUpdatedAt: NEW },
    { notes: "", activeTab: "examples" }
  );
  assert.equal(merged.notes, "written on the laptop");
  assert.equal(merged.notesUpdatedAt, NEW);
  assert.equal(merged.activeTab, "examples");
});

test("unstamped incoming (explicit null stamp) keeps stamped stored notes", () => {
  const merged = mergeChapterState(
    { notes: "stored", notesUpdatedAt: NEW },
    { notes: "stale copy", notesUpdatedAt: null }
  );
  assert.equal(merged.notes, "stored");
  assert.equal(merged.notesUpdatedAt, NEW);
});

test("stamped incoming notes win over unstamped stored notes", () => {
  const merged = mergeChapterState(
    { notes: "legacy" },
    { notes: "fresh", notesUpdatedAt: OLD }
  );
  assert.equal(merged.notes, "fresh");
  assert.equal(merged.notesUpdatedAt, OLD);
});

test("newer incoming notes win", () => {
  const merged = mergeChapterState(
    { notes: "old", notesUpdatedAt: OLD },
    { notes: "new", notesUpdatedAt: NEW }
  );
  assert.equal(merged.notes, "new");
  assert.equal(merged.notesUpdatedAt, NEW);
});

test("older incoming notes lose to newer stored notes", () => {
  const merged = mergeChapterState(
    { notes: "new", notesUpdatedAt: NEW },
    { notes: "old", notesUpdatedAt: OLD, focusMode: true }
  );
  assert.equal(merged.notes, "new");
  assert.equal(merged.notesUpdatedAt, NEW);
  assert.equal(merged.focusMode, true);
});

test("neither side stamped: incoming notes win, as before", () => {
  const merged = mergeChapterState({ notes: "stored" }, { notes: "" });
  assert.equal(merged.notes, "");
});

test("an explicit empty bookmark array clears stored bookmarks", () => {
  const merged = mergeChapterState(
    {
      bookmarkedTakeaways: [1, 2],
      bookmarkedTakeawayTexts: { "1": "a", "2": "b" },
    },
    { bookmarkedTakeaways: [], bookmarkedTakeawayTexts: {} }
  );
  assert.deepEqual(merged.bookmarkedTakeaways, []);
  assert.deepEqual(merged.bookmarkedTakeawayTexts, {});
});

test("first write with no stored row is the incoming state", () => {
  const incoming = { notes: "hi", notesUpdatedAt: NEW };
  assert.deepEqual(mergeChapterState(undefined, incoming), incoming);
});

test("isChapterStateStale only checks when the caller sends expectedUpdatedAt", () => {
  assert.equal(isChapterStateStale(undefined, OLD), false);
  assert.equal(isChapterStateStale(OLD, OLD), false);
  assert.equal(isChapterStateStale(OLD, NEW), true);
  // The caller expected a row that is not there, or expected none and one exists.
  assert.equal(isChapterStateStale(OLD, null), true);
  assert.equal(isChapterStateStale(null, null), false);
  assert.equal(isChapterStateStale(null, OLD), true);
});
