import { test } from "node:test";
import assert from "node:assert/strict";
import type { BookChapter, ChapterSummaryBlock } from "@/app/book/data/bookChapters";
import {
  adaptApiChapterToBookChapter,
  isReconstructedChapterEmpty,
  type ApiChapter,
} from "./chapterFromApi";

// ─── PAR-3 ────────────────────────────────────────────────────────────────────
//
// The reader only falls back to the local bundle when the chapter fetch ERRORS.
// A prod 200 whose active variant reconstructs to EMPTY prose (a present variant
// KEY with blank prose — the route's `variant_missing` guard only catches the
// zero-KEYS case) would otherwise install a body-less chapter: chrome (title,
// phase tabs) over a blank Summary, no error, no fallback. `isReconstructedChapter
// Empty` is the post-200 content-sanity check `useChapterContent` uses to route
// such a 200 through the same fallback path as a failed fetch.

const BOOK = { bookId: "demo-book", title: "Demo", author: "Author" };

function apiChapter(overrides: Partial<ApiChapter>): ApiChapter {
  return {
    chapterId: "demo-ch-1",
    number: 1,
    title: "Chapter One",
    readingTimeMinutes: 12,
    ...overrides,
  };
}

function paragraph(id: string, text: string): ChapterSummaryBlock {
  return { id, type: "paragraph", text };
}

// A BookChapter-shaped stub carrying only the `summaryByDepth` the helper reads.
function chapterWithSummaries(
  summaryByDepth: Partial<Record<"simple" | "standard" | "deeper", ChapterSummaryBlock[]>>,
): BookChapter {
  return {
    summaryByDepth: {
      simple: summaryByDepth.simple ?? [],
      standard: summaryByDepth.standard ?? [],
      deeper: summaryByDepth.deeper ?? [],
    },
  } as unknown as BookChapter;
}

// ─── isReconstructedChapterEmpty (unit) ───────────────────────────────────────

test("isReconstructedChapterEmpty: true when every depth summary is empty", () => {
  assert.equal(isReconstructedChapterEmpty(chapterWithSummaries({})), true);
});

test("isReconstructedChapterEmpty: true when blocks exist but all text is blank/whitespace", () => {
  const blank = chapterWithSummaries({
    simple: [paragraph("simple-p-1", "   ")],
    standard: [paragraph("standard-p-1", "")],
    deeper: [paragraph("deeper-p-1", "\n\t")],
  });
  assert.equal(isReconstructedChapterEmpty(blank), true);
});

test("isReconstructedChapterEmpty: false when ANY single depth has renderable prose", () => {
  // Only `standard` has a body; the helper must NOT report empty (a depth switch
  // would still surface content), so we never discard partially-good API content.
  const oneDepth = chapterWithSummaries({
    standard: [paragraph("standard-p-1", "Real prose for the standard depth.")],
  });
  assert.equal(isReconstructedChapterEmpty(oneDepth), false);
});

test("isReconstructedChapterEmpty: false when all depths have prose", () => {
  const full = chapterWithSummaries({
    simple: [paragraph("simple-p-1", "Simple body.")],
    standard: [paragraph("standard-p-1", "Standard body.")],
    deeper: [paragraph("deeper-p-1", "Deeper body.")],
  });
  assert.equal(isReconstructedChapterEmpty(full), false);
});

// ─── Real reconstruct-then-detect path (integration, non-vacuous) ─────────────

test("adaptApiChapterToBookChapter: a present-but-blank-prose 200 reconstructs to empty (PAR-3 mechanism)", () => {
  // contentVariants keys are PRESENT (so the route's zero-keys `variant_missing`
  // guard does not fire → 200) but every variant's prose is blank.
  const empty = adaptApiChapterToBookChapter(
    apiChapter({ contentVariants: { easy: {}, medium: {}, hard: {} } }),
    BOOK,
  );
  assert.equal(empty.summaryByDepth.simple.length, 0);
  assert.equal(empty.summaryByDepth.standard.length, 0);
  assert.equal(empty.summaryByDepth.deeper.length, 0);
  assert.equal(isReconstructedChapterEmpty(empty), true);
});

test("adaptApiChapterToBookChapter: a normal 200 with prose reconstructs to non-empty", () => {
  const full = adaptApiChapterToBookChapter(
    apiChapter({
      contentVariants: {
        easy: { chapterBreakdown: { direct: "Easy-tier prose explaining the idea clearly." } },
        medium: {
          chapterBreakdown: {
            direct: "Medium-tier prose explaining the idea in more depth and nuance.",
          },
        },
        hard: {
          chapterBreakdown: {
            direct: "Hard-tier prose with the full and complete treatment of the idea.",
          },
        },
      },
    }),
    BOOK,
  );
  assert.ok(full.summaryByDepth.standard.length > 0, "expected a reconstructed standard body");
  assert.equal(isReconstructedChapterEmpty(full), false);
});
