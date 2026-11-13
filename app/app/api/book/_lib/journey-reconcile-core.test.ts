import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeJourneyResults,
  pendingJourneyBookIds,
  reconcileJourneyCore,
  type JourneyReconcileDeps,
} from "./journey-reconcile-core";

const DEF = { books: [{ bookId: "a" }, { bookId: "b" }, { bookId: "c" }] };

type Row = Awaited<ReturnType<JourneyReconcileDeps["readProgress"]>>[number];

function row(bookId: string, completed: number): Row {
  return {
    bookId,
    completedChapters: Array.from({ length: completed }, (_, i) => i + 1),
    currentChapterNumber: completed + 1,
    manifestKey: `m/${bookId}`,
  };
}

function makeDeps(
  calls: string[],
  opts: {
    rows: Row[];
    counts: Record<string, number>;
    totalBooks?: number;
    startCredited?: string[];
    advanceReturnsNull?: string[];
  }
): JourneyReconcileDeps {
  const credited = [...(opts.startCredited ?? [])];
  const total = opts.totalBooks ?? DEF.books.length;
  return {
    readProgress: async (bookIds) => {
      calls.push(`readProgress:${bookIds.join(",")}`);
      return opts.rows.filter((r) => bookIds.includes(r.bookId));
    },
    readChapterCounts: async (entries) => {
      calls.push(`readChapterCounts:${entries.map((e) => e.bookId).join(",")}`);
      const map = new Map<string, number>();
      for (const e of entries) {
        const count = opts.counts[e.bookId];
        if (count !== undefined) map.set(e.bookId, count);
      }
      return map;
    },
    advance: async (bookId) => {
      calls.push(`advance:${bookId}`);
      if (opts.advanceReturnsNull?.includes(bookId)) return null;
      credited.push(bookId);
      return { completedAt: credited.length >= total ? "2026-11-13T00:00:00.000Z" : null };
    },
    awardCompletion: async () => {
      calls.push("awardCompletion");
      return { bonusIPAwarded: 350, badgeAwarded: "journey-badge" };
    },
  };
}

test("pendingJourneyBookIds lists journey books not yet credited", () => {
  assert.deepEqual(pendingJourneyBookIds(DEF, ["b"]), ["a", "c"]);
  assert.deepEqual(pendingJourneyBookIds(DEF, ["a", "b", "c"]), []);
});

test("a finished book is credited; unfinished and unstarted books are not", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls, {
    rows: [row("a", 10), row("b", 3)],
    counts: { a: 10, b: 10 },
  });
  const result = await reconcileJourneyCore(
    deps,
    { journeyId: "j1", completedBookIds: [], completedAt: null },
    DEF
  );
  assert.deepEqual(calls, [
    "readProgress:a,b,c",
    "readChapterCounts:a,b",
    "advance:a",
  ]);
  assert.deepEqual(result, {
    journeyId: "j1",
    advanced: true,
    completed: false,
    bonusIPAwarded: 0,
    badgeAwarded: null,
  });
});

test("crediting the last missing books completes the journey and awards once", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls, {
    rows: [row("a", 4), row("c", 6)],
    counts: { a: 4, c: 6 },
    startCredited: ["b"],
  });
  const result = await reconcileJourneyCore(
    deps,
    { journeyId: "j1", completedBookIds: ["b"], completedAt: null },
    DEF
  );
  assert.deepEqual(calls, [
    "readProgress:a,c",
    "readChapterCounts:a,c",
    "advance:a",
    "advance:c",
    "awardCompletion",
  ]);
  assert.deepEqual(result, {
    journeyId: "j1",
    advanced: true,
    completed: true,
    bonusIPAwarded: 350,
    badgeAwarded: "journey-badge",
  });
});

test("a book another request already credited is not counted and awards nothing", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls, {
    rows: [row("a", 4)],
    counts: { a: 4 },
    advanceReturnsNull: ["a"],
  });
  const result = await reconcileJourneyCore(
    deps,
    { journeyId: "j1", completedBookIds: [], completedAt: null },
    DEF
  );
  assert.equal(result, null);
  assert.equal(calls.includes("awardCompletion"), false);
});

test("an unknown chapter count never credits the book", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls, { rows: [row("a", 40)], counts: {} });
  const result = await reconcileJourneyCore(
    deps,
    { journeyId: "j1", completedBookIds: [], completedAt: null },
    DEF
  );
  assert.equal(result, null);
  assert.equal(calls.some((c) => c.startsWith("advance")), false);
});

test("a completed journey or one with nothing pending reads nothing", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls, { rows: [row("a", 4)], counts: { a: 4 } });
  assert.equal(
    await reconcileJourneyCore(
      deps,
      { journeyId: "j1", completedBookIds: [], completedAt: "2026-11-01T00:00:00.000Z" },
      DEF
    ),
    null
  );
  assert.equal(
    await reconcileJourneyCore(
      deps,
      { journeyId: "j1", completedBookIds: ["a", "b", "c"], completedAt: null },
      DEF
    ),
    null
  );
  assert.deepEqual(calls, []);
});

test("no started journey books skips the manifest read", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls, { rows: [], counts: {} });
  const result = await reconcileJourneyCore(
    deps,
    { journeyId: "j1", completedBookIds: [], completedAt: null },
    DEF
  );
  assert.equal(result, null);
  assert.deepEqual(calls, ["readProgress:a,b,c"]);
});

test("mergeJourneyResults keeps one entry per journey", () => {
  assert.deepEqual(
    mergeJourneyResults([
      { journeyId: "j1", advanced: true, completed: false, bonusIPAwarded: 0, badgeAwarded: null },
      { journeyId: "j2", advanced: false, completed: false, bonusIPAwarded: 0, badgeAwarded: null },
      { journeyId: "j1", advanced: true, completed: true, bonusIPAwarded: 350, badgeAwarded: "b" },
    ]),
    [
      { journeyId: "j1", advanced: true, completed: true, bonusIPAwarded: 350, badgeAwarded: "b" },
      { journeyId: "j2", advanced: false, completed: false, bonusIPAwarded: 0, badgeAwarded: null },
    ]
  );
});
