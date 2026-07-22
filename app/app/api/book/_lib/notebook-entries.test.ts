import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChapterStateNotebookEntries } from "./notebook-entries";

/**
 * Guards the chapter-state -> Notebook projection behind GET /me/notebook.
 *
 * The bug (NOTES-BOOKMARK-UNCLEAR): the reader stores bookmarked takeaways as
 * numeric INDICES, but the route read that array expecting STRINGS, so every
 * bookmark was silently dropped and /book/notebook always showed "0 entries".
 * The fix reads the index->text map (bookmarkedTakeawayTexts) instead.
 */

const META = {
  bookId: "atomic-habits",
  bookTitle: "Atomic Habits",
  chapterNumber: 3,
  chapterTitle: "Chapter 3",
  createdAt: "2026-06-19T10:00:00.000Z",
};

test("emits a bookmark entry for each bookmarked takeaway text (the fix)", () => {
  const entries = buildChapterStateNotebookEntries(
    {
      bookmarkedTakeaways: [0, 2],
      bookmarkedTakeawayTexts: {
        "0": "Habits are the compound interest of self-improvement.",
        "2": "You do not rise to the level of your goals.",
      },
    },
    META,
  );
  const bookmarks = entries.filter((e) => e.type === "bookmark");
  assert.equal(bookmarks.length, 2);
  assert.deepEqual(
    bookmarks.map((b) => b.content),
    [
      "Habits are the compound interest of self-improvement.",
      "You do not rise to the level of your goals.",
    ],
  );
  // IDs are keyed by the original index so they stay stable.
  assert.deepEqual(
    bookmarks.map((b) => b.id),
    ["bookmark:atomic-habits:3:0", "bookmark:atomic-habits:3:2"],
  );
  assert.ok(bookmarks.every((b) => b.bookTitle === "Atomic Habits"));
});

test("REGRESSION: a state that only has the numeric index array (no text map) yields NO bookmark entries — this is the exact pre-fix bug and the documented legacy gap", () => {
  const entries = buildChapterStateNotebookEntries(
    { bookmarkedTakeaways: [0, 1, 2] },
    META,
  );
  assert.equal(entries.filter((e) => e.type === "bookmark").length, 0);
});

test("the working sibling: notes still surface as a Note entry", () => {
  const entries = buildChapterStateNotebookEntries(
    { notes: "Start with a two-minute version of the habit." },
    META,
  );
  const notes = entries.filter((e) => e.type === "note");
  assert.equal(notes.length, 1);
  assert.equal(notes[0]!.content, "Start with a two-minute version of the habit.");
  assert.equal(notes[0]!.id, "note:atomic-habits:3");
});

test("notes and bookmarks coexist on the same chapter state", () => {
  const entries = buildChapterStateNotebookEntries(
    {
      notes: "My note",
      bookmarkedTakeaways: [1],
      bookmarkedTakeawayTexts: { "1": "A bookmarked line." },
    },
    META,
  );
  assert.equal(entries.filter((e) => e.type === "note").length, 1);
  assert.equal(entries.filter((e) => e.type === "bookmark").length, 1);
});

test("skips empty, whitespace-only, and non-string takeaway texts", () => {
  const entries = buildChapterStateNotebookEntries(
    {
      bookmarkedTakeawayTexts: {
        "0": "",
        "1": "   ",
        "2": 42 as unknown as string,
        "3": "Real takeaway.",
      },
    },
    META,
  );
  const bookmarks = entries.filter((e) => e.type === "bookmark");
  assert.equal(bookmarks.length, 1);
  assert.equal(bookmarks[0]!.content, "Real takeaway.");
  assert.equal(bookmarks[0]!.id, "bookmark:atomic-habits:3:3");
});

test("bookmark entries come out in ascending index order regardless of insertion order", () => {
  const entries = buildChapterStateNotebookEntries(
    {
      bookmarkedTakeawayTexts: { "10": "ten", "2": "two", "1": "one" },
    },
    META,
  );
  assert.deepEqual(
    entries.filter((e) => e.type === "bookmark").map((b) => b.content),
    ["one", "two", "ten"],
  );
});

test("a malformed text map (array / null) is ignored rather than throwing", () => {
  assert.deepEqual(
    buildChapterStateNotebookEntries(
      { bookmarkedTakeawayTexts: ["nope"] as unknown as Record<string, string> },
      META,
    ),
    [],
  );
  assert.deepEqual(buildChapterStateNotebookEntries(null, META), []);
  assert.deepEqual(buildChapterStateNotebookEntries(undefined, META), []);
});
