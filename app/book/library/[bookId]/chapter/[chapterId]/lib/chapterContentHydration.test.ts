import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildChapterSeedKey,
  classifyStartAccessFailure,
  decideChapterContentFetch,
  getOrCreateBookStartRequest,
  isInitialReaderSeedForRoute,
  mapInitialReaderProgressToManifest,
  shouldRetainApiChapterAfterFailure,
  shouldRenderInitialReaderContent,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterContentHydration";
import type { InitialChapterReaderSeed } from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterFromApi";

function seed(
  overrides: Partial<InitialChapterReaderSeed> = {},
): InitialChapterReaderSeed {
  return {
    schemaVersion: 1,
    authorization: "active-entitled-started-unlocked",
    route: { bookId: "book-a", chapterId: "book-a-ch02", chapterNumber: 2 },
    onboardingCompleted: true,
    content: {
      chapter: {
        chapterId: "internal-ch02",
        number: 2,
        title: "A known heading",
        readingTimeMinutes: 5,
        contentVariants: {
          medium: {
            chapterBreakdown: { direct: "Known server-rendered prose." },
          },
        },
      },
      progress: {
        currentChapterNumber: 2,
        unlockedThroughChapterNumber: 3,
        completedChapters: [1],
      },
    },
    ...overrides,
  };
}

const ROUTE = {
  bookId: "book-a",
  chapterId: "book-a-ch02",
  chapterNumber: 2,
};

test("buildChapterSeedKey encodes book, chapter number, and refetch key", () => {
  assert.equal(buildChapterSeedKey("book-a", 3, 0), "book-a:3:0");
  assert.equal(buildChapterSeedKey("book-b", 12, 2), "book-b:12:2");
  assert.notEqual(
    buildChapterSeedKey("book-a", 1, 0),
    buildChapterSeedKey("book-b", 1, 0),
    "same-number chapters in different books must never share served identity",
  );
});

test("serves the server seed instead of fetching when it is present (no client fetch)", () => {
  // The core WS3-024 guarantee: a hydrated entry chapter is served from the
  // initial payload, so no network fetch fires.
  const decision = decideChapterContentFetch({
    hasUsableSeed: true,
    refetchKey: 0,
    seedKey: buildChapterSeedKey("book-a", 1, 0),
    servedSeedKey: null,
  });
  assert.equal(decision, "serve-seed");
});

test("does not re-fetch after a seed for the same (chapter, refetch) was applied", () => {
  const seedKey = buildChapterSeedKey("book-a", 1, 0);
  const decision = decideChapterContentFetch({
    hasUsableSeed: true,
    refetchKey: 0,
    seedKey,
    servedSeedKey: seedKey, // already served (mount lazy-init or prior re-seed)
  });
  assert.equal(decision, "skip-served");
});

test("fetches when there is no usable seed (un-hydrated / not-started / locked chapter)", () => {
  const decision = decideChapterContentFetch({
    hasUsableSeed: false,
    refetchKey: 0,
    seedKey: buildChapterSeedKey("book-a", 4, 0),
    servedSeedKey: null,
  });
  assert.equal(decision, "fetch");
});

test("a retry (refetchKey > 0) always fetches, even with a seed present", () => {
  const decision = decideChapterContentFetch({
    hasUsableSeed: true,
    refetchKey: 1,
    seedKey: buildChapterSeedKey("book-a", 1, 1),
    servedSeedKey: buildChapterSeedKey("book-a", 1, 0), // the mount seed, a different key
  });
  assert.equal(decision, "fetch");
});

test("navigation to a different hydrated chapter serves that chapter's seed", () => {
  // Same hook instance, chapterNumber advanced 1 -> 2 with a fresh matching seed.
  const decision = decideChapterContentFetch({
    hasUsableSeed: true,
    refetchKey: 0,
    seedKey: buildChapterSeedKey("book-a", 2, 0),
    servedSeedKey: buildChapterSeedKey("book-a", 1, 0), // seed already served for chapter 1
  });
  assert.equal(decision, "serve-seed");
});

test("navigation to the same chapter number in another book serves the new seed", () => {
  const decision = decideChapterContentFetch({
    hasUsableSeed: true,
    refetchKey: 0,
    seedKey: buildChapterSeedKey("book-b", 1, 0),
    servedSeedKey: buildChapterSeedKey("book-a", 1, 0),
  });
  assert.equal(decision, "serve-seed");
});

test("accepts only an exact route-bound, unlocked reader attestation", () => {
  assert.equal(isInitialReaderSeedForRoute(seed(), ROUTE), true);
  assert.equal(
    isInitialReaderSeedForRoute(
      seed({ route: { ...ROUTE, bookId: "book-b" } }),
      ROUTE,
    ),
    false,
  );
  assert.equal(
    isInitialReaderSeedForRoute(
      seed({ route: { ...ROUTE, chapterId: "book-a-ch03" } }),
      ROUTE,
    ),
    false,
  );
  assert.equal(
    isInitialReaderSeedForRoute(
      seed({
        content: {
          ...seed().content,
          chapter: { ...seed().content.chapter, number: 3 },
        },
      }),
      ROUTE,
    ),
    false,
  );
  assert.equal(
    isInitialReaderSeedForRoute(
      seed({
        content: {
          ...seed().content,
          progress: {
            ...seed().content.progress,
            unlockedThroughChapterNumber: 1,
          },
        },
      }),
      ROUTE,
    ),
    false,
  );
});

test("maps numeric seed progress to manifest IDs", () => {
  assert.deepEqual(
    mapInitialReaderProgressToManifest(
      seed().content.progress,
      [
        { id: "book-a-ch01", number: 1 },
        { id: "book-a-ch02", number: 2 },
        { id: "book-a-ch03", number: 3 },
        { id: "book-a-ch04", number: 4 },
      ],
      ROUTE,
    ),
    {
      currentChapterId: "book-a-ch02",
      completedChapterIds: ["book-a-ch01"],
      unlockedChapterIds: ["book-a-ch01", "book-a-ch02", "book-a-ch03"],
    },
  );
});

test("initial content renders before mutable local hydration only for a usable attestation", () => {
  assert.equal(
    shouldRenderInitialReaderContent({
      hasAttestedSeed: true,
      contentHydrated: true,
      hasChapter: true,
    }),
    true,
  );
  for (const missing of ["seed", "content", "chapter"] as const) {
    assert.equal(
      shouldRenderInitialReaderContent({
        hasAttestedSeed: missing !== "seed",
        contentHydrated: missing !== "content",
        hasChapter: missing !== "chapter",
      }),
      false,
    );
  }
});

test("classifies terminal and transient start failures without message matching", () => {
  assert.equal(classifyStartAccessFailure({ status: 403, code: "account_deleted" }), "account_deleted");
  assert.equal(classifyStartAccessFailure({ status: 401 }), "reauth");
  assert.equal(classifyStartAccessFailure({ status: 402 }), "paywall");
  assert.equal(classifyStartAccessFailure({ status: 403, code: "paywall_book_limit" }), "paywall");
  assert.equal(
    classifyStartAccessFailure({ status: 403, code: "email_verification_required" }),
    "email_verification",
  );
  assert.equal(
    classifyStartAccessFailure({ status: 403, code: "free_access_review_required" }),
    "review",
  );
  assert.equal(classifyStartAccessFailure({ status: 403, code: "chapter_locked" }), "blocked");
  assert.equal(classifyStartAccessFailure({ status: 429 }), "blocked");
  assert.equal(
    classifyStartAccessFailure({ status: 503, code: "verifier_unavailable" }),
    "transient",
  );
  assert.equal(classifyStartAccessFailure({ status: 500 }), "transient");
  assert.equal(classifyStartAccessFailure({ status: null }), "transient");
});

test("an API seed survives only transient network and server failures", () => {
  assert.equal(
    shouldRetainApiChapterAfterFailure({ hasApiChapter: true, status: null }),
    true,
  );
  assert.equal(
    shouldRetainApiChapterAfterFailure({ hasApiChapter: true, status: 503 }),
    true,
  );
  for (const status of [401, 402, 403, 429]) {
    assert.equal(
      shouldRetainApiChapterAfterFailure({ hasApiChapter: true, status }),
      false,
    );
  }
});

test("the client creates exactly one start request per mounted book", async () => {
  let calls = 0;
  const create = async () => {
    calls += 1;
    return calls;
  };
  const first = getOrCreateBookStartRequest({
    current: null,
    bookId: "book-a",
    create,
  });
  const repeated = getOrCreateBookStartRequest({
    current: first.entry,
    bookId: "book-a",
    create,
  });
  assert.equal(first.created, true);
  assert.equal(repeated.created, false);
  assert.equal(repeated.entry.request, first.entry.request);
  assert.equal(await repeated.entry.request, 1);
  assert.equal(calls, 1);
});
