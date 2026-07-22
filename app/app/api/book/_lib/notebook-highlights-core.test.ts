import { test } from "node:test";
import assert from "node:assert/strict";
import { BookApiError } from "./errors";
import { buildChapterStateNotebookEntries } from "./notebook-entries";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_SNIPPET_MAX_CHARS,
  buildHighlightNotebookEntries,
  highlightItemToNotebookEntry,
  parseHighlightCreateInput,
  parseHighlightUpdateInput,
  validateHighlightAnchor,
  validateHighlightColor,
  validateHighlightSnippet,
} from "./notebook-highlights-core";
import type { BookUserHighlightItem, HighlightAnchor } from "./types";

/**
 * Feature B6 — reader highlights. Covers the whole create → list → update →
 * delete lifecycle through the shared pure core (the route + repo are thin
 * wrappers over these functions), plus the anchor-shape validation and a guard
 * that existing notebook entry types are unaffected.
 */

const VALID_ANCHOR: HighlightAnchor = {
  variant: "prose",
  tone: "neutral",
  blockIndex: 4,
  blockType: "paragraph",
  startChar: 12,
  endChar: 48,
};

function createBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    bookId: "atomic-habits",
    chapterNumber: 3,
    color: "yellow",
    snippet: "Habits are the compound interest of self-improvement.",
    anchor: { ...VALID_ANCHOR },
    ...overrides,
  };
}

/**
 * In-memory stand-in for the DynamoDB seam so a full create/list/update/delete
 * round-trip can be exercised without `server-only`/AWS. It applies the SAME
 * transformations the repo does: create stamps timestamps, update merges the
 * validated patch and bumps `updatedAt`, delete removes the row.
 */
function makeStore(userId: string) {
  const rows = new Map<string, BookUserHighlightItem>();
  let seq = 0;
  return {
    create(body: Record<string, unknown>): BookUserHighlightItem {
      const input = parseHighlightCreateInput(body);
      const id = `hl-${++seq}`;
      const now = `2026-07-02T00:00:0${seq}.000Z`;
      const item: BookUserHighlightItem = {
        userId,
        highlightId: id,
        bookId: input.bookId,
        bookTitle: input.bookTitle || input.bookId,
        chapterNumber: input.chapterNumber,
        chapterTitle: input.chapterTitle || `Chapter ${input.chapterNumber}`,
        color: input.color,
        snippet: input.snippet,
        anchor: input.anchor,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(id, item);
      return item;
    },
    list(filters?: { bookId?: string | null; chapter?: number | null }) {
      return buildHighlightNotebookEntries([...rows.values()], filters);
    },
    update(id: string, patchBody: Record<string, unknown>): BookUserHighlightItem {
      const existing = rows.get(id);
      if (!existing) throw new BookApiError(404, "not_found", "Highlight not found.");
      const patch = parseHighlightUpdateInput(patchBody);
      const updated: BookUserHighlightItem = {
        ...existing,
        ...(patch.color !== undefined ? { color: patch.color } : {}),
        ...(patch.snippet !== undefined ? { snippet: patch.snippet } : {}),
        ...(patch.anchor !== undefined ? { anchor: patch.anchor } : {}),
        updatedAt: "2026-07-02T09:00:00.000Z",
      };
      rows.set(id, updated);
      return updated;
    },
    delete(id: string) {
      if (!rows.delete(id)) throw new BookApiError(404, "not_found", "Highlight not found.");
    },
  };
}

// ── Lifecycle: create → list → update → delete ────────────────────────────────

test("create: a highlight round-trips anchor + color + snippet through validation + projection", () => {
  const store = makeStore("user-1");
  const item = store.create(createBody());
  const entry = highlightItemToNotebookEntry(item);

  assert.equal(entry.type, "highlight");
  assert.equal(entry.id, "highlight:hl-1");
  assert.equal(entry.bookId, "atomic-habits");
  assert.equal(entry.chapterNumber, 3);
  assert.equal(entry.color, "yellow");
  assert.equal(entry.snippet, "Habits are the compound interest of self-improvement.");
  assert.equal(entry.content, entry.snippet); // content mirrors snippet for the shared UI/search
  assert.deepEqual(entry.anchor, VALID_ANCHOR);
});

test("list + filter: highlights filter by bookId and chapter like the other entry types", () => {
  const store = makeStore("user-1");
  store.create(createBody({ bookId: "atomic-habits", chapterNumber: 3 }));
  store.create(createBody({ bookId: "atomic-habits", chapterNumber: 7 }));
  store.create(createBody({ bookId: "deep-work", chapterNumber: 3 }));

  assert.equal(store.list().length, 3);
  assert.equal(store.list({ bookId: "atomic-habits" }).length, 2);
  assert.equal(store.list({ chapter: 3 }).length, 2);
  assert.equal(store.list({ bookId: "atomic-habits", chapter: 3 }).length, 1);
  assert.equal(store.list({ bookId: "atomic-habits", chapter: 3 })[0]!.bookId, "atomic-habits");
  // absent filters (null) match everything — GET back-compat
  assert.equal(store.list({ bookId: null, chapter: null }).length, 3);
});

test("update: colour/snippet/anchor change, identity + createdAt are preserved", () => {
  const store = makeStore("user-1");
  const created = store.create(createBody());
  const newAnchor: HighlightAnchor = { ...VALID_ANCHOR, startChar: 100, endChar: 140 };

  const updated = store.update(created.highlightId, {
    color: "green",
    snippet: "  Updated selection.  ",
    anchor: { ...newAnchor },
  });

  assert.equal(updated.highlightId, created.highlightId);
  assert.equal(updated.createdAt, created.createdAt);
  assert.notEqual(updated.updatedAt, created.updatedAt);
  assert.equal(updated.color, "green");
  assert.equal(updated.snippet, "Updated selection."); // trimmed
  assert.deepEqual(updated.anchor, newAnchor);
});

test("update: rejects an empty patch (nothing to change)", () => {
  const store = makeStore("user-1");
  const created = store.create(createBody());
  assert.throws(
    () => store.update(created.highlightId, {}),
    (e: unknown) => e instanceof BookApiError && e.status === 400,
  );
});

test("delete: removes the highlight; deleting a missing one is a 404", () => {
  const store = makeStore("user-1");
  const created = store.create(createBody());
  assert.equal(store.list().length, 1);
  store.delete(created.highlightId);
  assert.equal(store.list().length, 0);
  assert.throws(
    () => store.delete(created.highlightId),
    (e: unknown) => e instanceof BookApiError && e.status === 404,
  );
});

// ── Anchor shape validation (the DoD "invalid anchor → 400" case) ─────────────

test("validateHighlightAnchor accepts a well-formed anchor and drops extra keys", () => {
  const anchor = validateHighlightAnchor({ ...VALID_ANCHOR, extra: "ignored" });
  assert.deepEqual(anchor, VALID_ANCHOR);
  assert.equal((anchor as Record<string, unknown>).extra, undefined);
});

test("an invalid anchor is rejected with a 400 (missing field, wrong type, bad range, non-object)", () => {
  const bad: unknown[] = [
    undefined,
    null,
    "not-an-object",
    [VALID_ANCHOR],
    { ...VALID_ANCHOR, variant: undefined }, // missing string
    { ...VALID_ANCHOR, variant: "" }, // empty string
    { ...VALID_ANCHOR, blockIndex: "4" }, // wrong type
    { ...VALID_ANCHOR, startChar: -1 }, // negative
    { ...VALID_ANCHOR, endChar: 2.5 }, // non-integer
    { ...VALID_ANCHOR, startChar: 50, endChar: 10 }, // negative span
  ];
  for (const value of bad) {
    assert.throws(
      () => validateHighlightAnchor(value),
      (e: unknown) => e instanceof BookApiError && e.status === 400 && e.code === "invalid_anchor",
      `expected 400 for ${JSON.stringify(value)}`,
    );
  }
});

test("parseHighlightCreateInput rejects a body whose anchor is invalid with a 400", () => {
  assert.throws(
    () => parseHighlightCreateInput(createBody({ anchor: { variant: "prose" } })),
    (e: unknown) => e instanceof BookApiError && e.status === 400,
  );
});

// ── Colour + snippet validation ───────────────────────────────────────────────

test("validateHighlightColor accepts every enum member and rejects anything else", () => {
  for (const c of HIGHLIGHT_COLORS) assert.equal(validateHighlightColor(c), c);
  for (const bad of ["red", "YELLOW", "", 1, null, undefined]) {
    assert.throws(
      () => validateHighlightColor(bad),
      (e: unknown) => e instanceof BookApiError && e.status === 400,
    );
  }
});

test("validateHighlightSnippet trims, requires non-empty, and caps at the max length", () => {
  assert.equal(validateHighlightSnippet("  hello  "), "hello");
  const long = "x".repeat(HIGHLIGHT_SNIPPET_MAX_CHARS + 250);
  assert.equal(validateHighlightSnippet(long).length, HIGHLIGHT_SNIPPET_MAX_CHARS);
  for (const bad of ["", "   ", 42, null, undefined]) {
    assert.throws(
      () => validateHighlightSnippet(bad),
      (e: unknown) => e instanceof BookApiError && e.status === 400,
    );
  }
});

// ── Create-input guards ───────────────────────────────────────────────────────

test("parseHighlightCreateInput requires bookId, chapterNumber, color, snippet, anchor", () => {
  const missing = [
    createBody({ bookId: undefined }),
    createBody({ chapterNumber: undefined }),
    createBody({ chapterNumber: -1 }),
    createBody({ color: undefined }),
    createBody({ snippet: undefined }),
    createBody({ anchor: undefined }),
  ];
  for (const body of missing) {
    assert.throws(
      () => parseHighlightCreateInput(body),
      (e: unknown) => e instanceof BookApiError && e.status === 400,
    );
  }
});

test("parseHighlightCreateInput accepts type:'highlight' but rejects any other explicit type", () => {
  assert.doesNotThrow(() => parseHighlightCreateInput(createBody({ type: "highlight" })));
  assert.throws(
    () => parseHighlightCreateInput(createBody({ type: "note" })),
    (e: unknown) => e instanceof BookApiError && e.status === 400 && e.code === "unsupported_type",
  );
});

test("parseHighlightCreateInput carries optional bookTitle/chapterTitle through", () => {
  const parsed = parseHighlightCreateInput(
    createBody({ bookTitle: "Atomic Habits", chapterTitle: "The Fundamentals" }),
  );
  assert.equal(parsed.bookTitle, "Atomic Habits");
  assert.equal(parsed.chapterTitle, "The Fundamentals");
});

// ── Existing entry types are unaffected ───────────────────────────────────────

test("existing note/bookmark entries carry NO highlight-only fields (shape unchanged)", () => {
  const entries = buildChapterStateNotebookEntries(
    {
      notes: "A plain note.",
      bookmarkedTakeaways: [0],
      bookmarkedTakeawayTexts: { "0": "A bookmarked line." },
    },
    {
      bookId: "atomic-habits",
      bookTitle: "Atomic Habits",
      chapterNumber: 3,
      chapterTitle: "Chapter 3",
      createdAt: "2026-07-02T10:00:00.000Z",
    },
  );
  assert.equal(entries.length, 2);
  for (const e of entries) {
    assert.equal(e.color, undefined);
    assert.equal(e.snippet, undefined);
    assert.equal(e.anchor, undefined);
    assert.ok(e.type === "note" || e.type === "bookmark");
  }
});
