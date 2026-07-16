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

// ─── D10 progressive (cumulative) rendering (WP-405) ──────────────────────────
//
// Serial-layer v21 books author fastRead/deepRead/fullRead as complementary
// slices (fastRead ≈ 15% of the prose). The reader now composes them
// cumulatively: Simple = fastRead, Standard = fastRead+deepRead, Challenge = all
// three — recovering the prose that single-layer rendering hid. Distinct one-
// paragraph tiers make the composition observable by paragraph text.

const FAST = "Fast-read prose: the one-paragraph core lesson stated plainly.";
const DEEP = "Deep-read prose: the mechanism, evidence, and nuance behind the core lesson.";
const FULL = "Full-read prose: boundary conditions, misuse, and integration of the lesson.";

function paragraphs(blocks: ChapterSummaryBlock[]): string[] {
  return blocks.filter((b) => b.type === "paragraph").map((b) => b.text);
}

function threeTierChapter() {
  return apiChapter({
    contentVariants: {
      easy: { chapterBreakdown: { direct: FAST } },
      medium: { chapterBreakdown: { direct: DEEP } },
      hard: { chapterBreakdown: { direct: FULL } },
    },
  });
}

test("D10: Simple renders fastRead only", () => {
  const ch = adaptApiChapterToBookChapter(threeTierChapter(), BOOK);
  assert.deepEqual(paragraphs(ch.summaryByDepth.simple), [FAST]);
});

test("D10: Standard composes fastRead + deepRead in order", () => {
  const ch = adaptApiChapterToBookChapter(threeTierChapter(), BOOK);
  assert.deepEqual(paragraphs(ch.summaryByDepth.standard), [FAST, DEEP]);
});

test("D10: Challenge (deeper) composes all three layers in order", () => {
  const ch = adaptApiChapterToBookChapter(threeTierChapter(), BOOK);
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [FAST, DEEP, FULL]);
});

test("D10: composed prose volume is strictly cumulative (Simple < Standard < Challenge)", () => {
  const ch = adaptApiChapterToBookChapter(threeTierChapter(), BOOK);
  const chars = (blocks: ChapterSummaryBlock[]) =>
    paragraphs(blocks).reduce((n, t) => n + t.length, 0);
  const simple = chars(ch.summaryByDepth.simple);
  const standard = chars(ch.summaryByDepth.standard);
  const deeper = chars(ch.summaryByDepth.deeper);
  assert.ok(simple < standard, `expected simple(${simple}) < standard(${standard})`);
  assert.ok(standard < deeper, `expected standard(${standard}) < deeper(${deeper})`);
});

test("D10: composed blocks carry stable, unique ${depth}-p-N ids", () => {
  const ch = adaptApiChapterToBookChapter(threeTierChapter(), BOOK);
  for (const depth of ["simple", "standard", "deeper"] as const) {
    const ids = ch.summaryByDepth[depth].map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length, `${depth} block ids must be unique`);
    for (const id of ids) {
      assert.ok(id.startsWith(`${depth}-`), `id "${id}" must be keyed to depth "${depth}"`);
    }
  }
  const stdParaIds = ch.summaryByDepth.standard
    .filter((b) => b.type === "paragraph")
    .map((b) => b.id);
  assert.deepEqual(stdParaIds, ["standard-p-1", "standard-p-2"]);
});

test("D10: a chapter missing deepRead + fullRead composes only fastRead, no empty section", () => {
  const ch = adaptApiChapterToBookChapter(
    apiChapter({ contentVariants: { easy: { chapterBreakdown: { direct: FAST } } } }),
    BOOK,
  );
  // Every present layer is fastRead only ⇒ each depth shows just fastRead; no
  // depth renders an empty section, and the missing layers are silently skipped.
  assert.deepEqual(paragraphs(ch.summaryByDepth.simple), [FAST]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.standard), [FAST]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [FAST]);
  assert.equal(isReconstructedChapterEmpty(ch), false);
});

test("D10: a chapter missing fullRead composes fastRead+deepRead for Challenge, no empty section", () => {
  const ch = adaptApiChapterToBookChapter(
    apiChapter({
      contentVariants: {
        easy: { chapterBreakdown: { direct: FAST } },
        medium: { chapterBreakdown: { direct: DEEP } },
      },
    }),
    BOOK,
  );
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [FAST, DEEP]);
  assert.ok(ch.summaryByDepth.deeper.every((b) => b.text.trim().length > 0), "no empty block");
});

test("D10: byte-identical blocks repeated across layers render once (dedup)", () => {
  // v21 memorable lines are appended as identical bullet blocks to every tier;
  // the cumulative Challenge view collapses those repeats to one occurrence each
  // while keeping the complementary prose paragraphs from every layer.
  const shared = "A memorable line repeated verbatim in every layer.";
  const ch = adaptApiChapterToBookChapter(
    {
      ...threeTierChapter(),
      v21Extras: { memorableLines: [{ text: shared }] },
    },
    BOOK,
  );
  const sharedBullets = ch.summaryByDepth.deeper
    .filter((b) => b.type === "bullet")
    .map((b) => b.text)
    .filter((t) => t === shared);
  assert.equal(sharedBullets.length, 1, "the repeated memorable-line bullet must appear exactly once");
  // Prose paragraphs, being complementary, are NOT collapsed.
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [FAST, DEEP, FULL]);
});
