import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isInitialReaderProgressEligible,
  runAuthorizedChapterHydration,
} from "./initial-chapter-content-core";

test("a Free downgrade cannot hydrate progress for a book outside unlockedBookIds", async () => {
  let contentReads = 0;
  const result = await runAuthorizedChapterHydration({
    entitlement: {
      plan: "FREE",
      unlockedBookIds: ["already-unlocked-a", "already-unlocked-b"],
    },
    bookId: "pro-started-before-downgrade",
    load: async () => {
      contentReads += 1;
      return "chapter prose";
    },
  });

  assert.equal(result, null);
  assert.equal(contentReads, 0, "denied hydration must not read chapter prose");
});

test("current Pro and explicitly unlocked Free books retain read-only hydration", async () => {
  const pro = await runAuthorizedChapterHydration({
    entitlement: { plan: "PRO", unlockedBookIds: [] },
    bookId: "book-a",
    load: async () => "pro chapter",
  });
  const free = await runAuthorizedChapterHydration({
    entitlement: { plan: "FREE", unlockedBookIds: ["book-a"] },
    bookId: "book-a",
    load: async () => "free chapter",
  });

  assert.equal(pro, "pro chapter");
  assert.equal(free, "free chapter");
});

test("a missing entitlement fails closed before content loading", async () => {
  let contentReads = 0;
  const result = await runAuthorizedChapterHydration({
    entitlement: null,
    bookId: "book-a",
    load: async () => {
      contentReads += 1;
      return "chapter prose";
    },
  });

  assert.equal(result, null);
  assert.equal(contentReads, 0);
});

test("initial hydration requires an existing, unlocked, current-version progress pin", () => {
  const current = {
    pinnedBookVersion: 4,
    contentPrefix: "book-content/books/book-a/v000004",
    unlockedThroughChapterNumber: 3,
  };

  assert.equal(
    isInitialReaderProgressEligible({
      progress: null,
      publishedVersion: 4,
      chapterNumber: 2,
    }),
    false,
    "an unstarted book has no progress attestation",
  );
  assert.equal(
    isInitialReaderProgressEligible({
      progress: current,
      publishedVersion: 4,
      chapterNumber: 4,
    }),
    false,
    "a locked chapter must not be server rendered",
  );
  assert.equal(
    isInitialReaderProgressEligible({
      progress: current,
      publishedVersion: 5,
      chapterNumber: 2,
    }),
    false,
    "version migration remains owned by the client/API path",
  );
  assert.equal(
    isInitialReaderProgressEligible({
      progress: { ...current, contentPrefix: "  " },
      publishedVersion: 4,
      chapterNumber: 2,
    }),
    false,
  );
  assert.equal(
    isInitialReaderProgressEligible({
      progress: current,
      publishedVersion: 4,
      chapterNumber: 2,
    }),
    true,
  );
});
