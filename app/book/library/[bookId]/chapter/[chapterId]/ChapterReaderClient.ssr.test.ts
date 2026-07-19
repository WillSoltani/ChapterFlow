import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { InitialChapterReaderSeed } from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterFromApi";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "next/navigation") {
    return {
      usePathname: () => "/book/library/book-a/chapter/book-a-ch02",
      useRouter: () => ({
        replace() {},
        push() {},
        prefetch() {},
      }),
      useSearchParams: () => new URLSearchParams(),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

after(() => {
  Module._load = originalLoad;
});

test("production reader SSR contains attested prose before effects run", async () => {
  const { ChapterReaderClient } = await import("./ChapterReaderClient");
  const initialBook: LibraryBookDetail = {
    id: "book-a",
    title: "Known Book",
    author: "Known Author",
    icon: "book",
    category: "Learning",
    categories: ["Learning"],
    difficulty: "Easy",
    estimatedMinutes: 10,
    chapterCount: 2,
    synopsis: "Known synopsis",
    tags: [],
    variantFamily: "EMH",
    publishedVersion: 1,
    chapters: [
      {
        id: "book-a-ch01",
        chapterId: "book-a-ch01",
        number: 1,
        code: "01",
        title: "First",
        minutes: 5,
      },
      {
        id: "book-a-ch02",
        chapterId: "book-a-ch02",
        number: 2,
        code: "02",
        title: "Known heading",
        minutes: 5,
      },
    ],
  };
  const initialSeed: InitialChapterReaderSeed = {
    schemaVersion: 1,
    authorization: "active-entitled-started-unlocked",
    route: { bookId: "book-a", chapterId: "book-a-ch02", chapterNumber: 2 },
    onboardingCompleted: true,
    content: {
      chapter: {
        chapterId: "internal-ch02",
        number: 2,
        title: "Known heading",
        readingTimeMinutes: 5,
        contentVariants: {
          medium: {
            chapterBreakdown: { direct: "Known server-rendered prose marker." },
            takeaways: ["Known takeaway"],
          },
        },
      },
      progress: {
        currentChapterNumber: 2,
        unlockedThroughChapterNumber: 2,
        completedChapters: [1],
      },
    },
  };

  const html = renderToStaticMarkup(
    React.createElement(ChapterReaderClient, {
      bookId: "book-a",
      chapterId: "book-a-ch02",
      chapterOrder: 2,
      initialBook,
      initialSeed,
    }),
  );

  assert.match(html, /Known heading/);
  assert.match(html, /Known server-rendered prose marker/);
  assert.doesNotMatch(html, /Loading chapter/);
  assert.doesNotMatch(html, /animate-pulse/);

  const legacyHtml = renderToStaticMarkup(
    React.createElement(ChapterReaderClient, {
      bookId: "book-a",
      chapterId: "book-a-ch02",
      chapterOrder: 2,
      initialBook,
    }),
  );
  assert.match(legacyHtml, /Loading chapter/);
  assert.doesNotMatch(legacyHtml, /Known server-rendered prose marker/);
});
