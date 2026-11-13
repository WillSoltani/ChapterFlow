import { test } from "node:test";
import assert from "node:assert/strict";
import { saveTakeaway, type SaveTakeawayDeps } from "./save-takeaway-core";

const NOW = "2026-11-13T10:00:00.000Z";
const STATE_URL = "/app/api/book/me/books/atomic-habits/chapters/4/state";
const LOCAL_KEY = "reader:atomic-habits:atomic-habits-ch04";

type Call = { url: string; method: string; body: unknown };

function makeDeps(opts: {
  serverItem?: unknown;
  local?: Record<string, unknown> | null;
  failPatch?: boolean;
}) {
  const calls: Call[] = [];
  const store = new Map<string, string>();
  if (opts.local) store.set(LOCAL_KEY, JSON.stringify(opts.local));
  let notebookRefetches = 0;
  const deps: SaveTakeawayDeps = {
    fetchJson: async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (method === "GET") return { state: opts.serverItem ?? null } as T;
      if (opts.failPatch) throw new Error("network");
      return { state: {} } as T;
    },
    refetchNotebook: async () => {
      notebookRefetches += 1;
    },
    readLocal: (key) => store.get(key) ?? null,
    writeLocal: (key, value) => {
      store.set(key, value);
    },
    now: () => NOW,
  };
  return {
    deps,
    calls,
    local: () => {
      const raw = store.get(LOCAL_KEY);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    },
    notebookRefetches: () => notebookRefetches,
  };
}

const INPUT = {
  bookId: "atomic-habits",
  chapterId: "atomic-habits-ch04",
  chapterNumber: 4,
  text: "Make it obvious.",
  localKey: LOCAL_KEY,
};

const SERVER_ITEM = {
  userId: "u",
  bookId: "atomic-habits",
  chapterNumber: 4,
  chapterId: "atomic-habits-ch04-server",
  state: {
    activeTab: "quiz",
    readingDepth: "standard",
    quizAnswers: { q1: "a" },
    quizResult: { score: 80, passed: true },
    notes: "Habits compound.",
    notesUpdatedAt: "2026-11-10T09:00:00.000Z",
    bookmarkedTakeaways: [0],
    bookmarkedTakeawayTexts: { "0": "Systems over goals." },
    staleLegacyField: true,
  },
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-10T09:00:00.000Z",
};

test("DATA-04: the takeaway is saved to the account with every chapter-state field kept", async () => {
  const h = makeDeps({ serverItem: SERVER_ITEM });
  await saveTakeaway(h.deps, INPUT);
  assert.deepEqual(
    h.calls.map((c) => `${c.method} ${c.url}`),
    [`GET ${STATE_URL}`, `PATCH ${STATE_URL}`],
  );
  assert.deepEqual(h.calls[1]!.body, {
    chapterId: "atomic-habits-ch04-server",
    state: {
      activeTab: "quiz",
      readingDepth: "standard",
      quizAnswers: { q1: "a" },
      quizResult: { score: 80, passed: true },
      notes: "Habits compound.\n\nMake it obvious.",
      notesUpdatedAt: NOW,
      bookmarkedTakeaways: [0],
      bookmarkedTakeawayTexts: { "0": "Systems over goals." },
    },
  });
});

test("DATA-04: keys the server would reject are not sent", async () => {
  const h = makeDeps({ serverItem: SERVER_ITEM });
  await saveTakeaway(h.deps, INPUT);
  const sent = (h.calls[1]!.body as { state: Record<string, unknown> }).state;
  assert.equal("staleLegacyField" in sent, false);
});

test("DATA-04: with no server row the first takeaway starts the notes", async () => {
  const h = makeDeps({ serverItem: null });
  await saveTakeaway(h.deps, INPUT);
  assert.deepEqual(h.calls[1]!.body, {
    chapterId: "atomic-habits-ch04",
    state: { notes: "Make it obvious.", notesUpdatedAt: NOW },
  });
});

test("DATA-04: the local copy is updated and keeps its bookmarks and other fields", async () => {
  const h = makeDeps({
    serverItem: SERVER_ITEM,
    local: {
      activeTab: "summary",
      notes: "Habits compound.",
      notesUpdatedAt: "2026-11-10T09:00:00.000Z",
      bookmarkedTakeawayTexts: { "0": "Systems over goals." },
      fontScale: "md",
    },
  });
  await saveTakeaway(h.deps, INPUT);
  assert.deepEqual(h.local(), {
    activeTab: "summary",
    notes: "Habits compound.\n\nMake it obvious.",
    notesUpdatedAt: NOW,
    bookmarkedTakeawayTexts: { "0": "Systems over goals." },
    fontScale: "md",
  });
});

test("DATA-04: no local copy is invented when the device has none", async () => {
  const h = makeDeps({ serverItem: SERVER_ITEM, local: null });
  await saveTakeaway(h.deps, INPUT);
  assert.equal(h.local(), null);
});

test("DATA-04: newer notes on this device are kept, not overwritten by older server notes", async () => {
  const h = makeDeps({
    serverItem: SERVER_ITEM,
    local: { notes: "Habits compound. Edited here.", notesUpdatedAt: "2026-11-12T09:00:00.000Z" },
  });
  await saveTakeaway(h.deps, INPUT);
  const sent = (h.calls[1]!.body as { state: Record<string, unknown> }).state;
  assert.equal(sent.notes, "Habits compound. Edited here.\n\nMake it obvious.");
});

test("DATA-04: the notebook is refetched after a successful save", async () => {
  const h = makeDeps({ serverItem: SERVER_ITEM });
  await saveTakeaway(h.deps, INPUT);
  assert.equal(h.notebookRefetches(), 1);
});

test("DATA-04: a failed save throws, leaves the local copy alone and does not refetch", async () => {
  const local = { notes: "Habits compound.", notesUpdatedAt: "2026-11-10T09:00:00.000Z" };
  const h = makeDeps({ serverItem: SERVER_ITEM, local, failPatch: true });
  await assert.rejects(saveTakeaway(h.deps, INPUT));
  assert.deepEqual(h.local(), local);
  assert.equal(h.notebookRefetches(), 0);
});
