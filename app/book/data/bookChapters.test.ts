import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  BookPackage,
  PackageChapter,
  PackageSummaryBlock,
  PackageVariantContent,
  VariantFamily,
  VariantKey,
} from "@/app/book/data/book-package-core";
import { buildBundle, type ChapterSummaryBlock } from "@/app/book/data/bookChapters";

// ─── D10 progressive (cumulative) rendering gate (WP-405) ─────────────────────
//
// buildBundle is the single seam both the local and API reader paths funnel
// through. These tests pin the gate: serial-layer v21/EMH books compose their
// read layers cumulatively (Standard = fast+deep, Challenge = all three, Simple =
// fast only), while every other book — a layer-independent (F-1) v21 book, a
// strict-v12 book, a PBC/v13 book — keeps single-layer-per-mode selection.

const FAST = "Fast-read prose: the one-paragraph core lesson stated plainly.";
const DEEP = "Deep-read prose: the mechanism, evidence, and nuance behind the lesson.";
const FULL = "Full-read prose: boundary conditions, misuse, and integration of the lesson.";

function paragraphs(blocks: ChapterSummaryBlock[]): string[] {
  return blocks.filter((b) => b.type === "paragraph").map((b) => b.text);
}

function para(text: string): PackageSummaryBlock {
  return { type: "paragraph", text };
}

function variant(prose: string): PackageVariantContent {
  return { chapterBreakdown: prose, summaryBlocks: [para(prose)] };
}

function pkg(
  schemaVersion: string,
  variantFamily: VariantFamily,
  contentVariants: Partial<Record<VariantKey, PackageVariantContent>>,
  extra?: Partial<Pick<BookPackage, "layerIndependent">>,
): BookPackage {
  const chapter: PackageChapter = {
    chapterId: "ch-1",
    number: 1,
    title: "Chapter One",
    readingTimeMinutes: 8,
    contentVariants,
    examples: [],
    quiz: { passingScorePercent: 80, questions: [] },
  };
  return {
    schemaVersion,
    packageId: "p",
    createdAt: "",
    contentOwner: "",
    book: {
      bookId: "demo",
      title: "Demo",
      author: "Author",
      categories: [],
      variantFamily,
    },
    chapters: [chapter],
    ...extra,
  };
}

function bundleChapter(bookPackage: BookPackage) {
  return buildBundle(bookPackage, undefined, "direct", { suppressEmptyQuizWarning: true })
    .chapters[0];
}

const EMH_THREE = { easy: variant(FAST), medium: variant(DEEP), hard: variant(FULL) };

// ── Serial-layer v21/EMH → cumulative ──────────────────────────────────────────

test("serial-layer v21: Simple = fastRead only", () => {
  const ch = bundleChapter(pkg("chapterflow-v21-authored", "EMH", EMH_THREE));
  assert.deepEqual(paragraphs(ch.summaryByDepth.simple), [FAST]);
});

test("serial-layer v21: Standard = fastRead + deepRead", () => {
  const ch = bundleChapter(pkg("chapterflow-v21-authored", "EMH", EMH_THREE));
  assert.deepEqual(paragraphs(ch.summaryByDepth.standard), [FAST, DEEP]);
});

test("serial-layer v21: Challenge = fastRead + deepRead + fullRead", () => {
  const ch = bundleChapter(pkg("chapterflow-v21-authored", "EMH", EMH_THREE));
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [FAST, DEEP, FULL]);
});

test("serial-layer v21: takeaways/recap by depth stay coherent (no crash, cumulative applied)", () => {
  // With no per-layer takeaways/recap in the fixture, the cumulative helpers fall
  // back to the single-layer set — proving the associated by-depth fields are
  // wired without altering output when layers carry no distinct takeaways/recap.
  const ch = bundleChapter(pkg("chapterflow-v21-authored", "EMH", EMH_THREE));
  assert.deepEqual(ch.takeawaysByDepth.standard, ch.takeawaysByDepth.deeper);
  assert.deepEqual(ch.recapByDepth.standard, []);
});

// ── Layer-independent (F-1) v21 → single layer ─────────────────────────────────

test("layer-independent v21 (marker=true): Standard keeps deepRead only (no concatenation)", () => {
  const ch = bundleChapter(
    pkg("chapterflow-v21-authored", "EMH", EMH_THREE, { layerIndependent: true }),
  );
  assert.deepEqual(paragraphs(ch.summaryByDepth.simple), [FAST]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.standard), [DEEP]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [FULL]);
});

// ── Non-v21 families unchanged ────────────────────────────────────────────────

test("strict-v12 EMH (schemaVersion 1.1.0): single-layer selection unchanged", () => {
  const ch = bundleChapter(pkg("1.1.0", "EMH", EMH_THREE));
  assert.deepEqual(paragraphs(ch.summaryByDepth.simple), [FAST]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.standard), [DEEP]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [FULL]);
});

test("PBC/v13 book: single-layer selection unchanged (never concatenated)", () => {
  const PRECISE = "Precise-tier prose.";
  const BALANCED = "Balanced-tier prose.";
  const CHALLENGING = "Challenging-tier prose.";
  const ch = bundleChapter(
    pkg("nstd", "PBC", {
      precise: variant(PRECISE),
      balanced: variant(BALANCED),
      challenging: variant(CHALLENGING),
    }),
  );
  assert.deepEqual(paragraphs(ch.summaryByDepth.simple), [PRECISE]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.standard), [BALANCED]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [CHALLENGING]);
});

// ── Missing-layer guards ──────────────────────────────────────────────────────

test("serial-layer v21 missing deepRead: Standard falls back to fastRead, Challenge = fast+full", () => {
  const ch = bundleChapter(
    pkg("chapterflow-v21-authored", "EMH", { easy: variant(FAST), hard: variant(FULL) }),
  );
  assert.deepEqual(paragraphs(ch.summaryByDepth.standard), [FAST]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [FAST, FULL]);
  // No empty section anywhere.
  for (const depth of ["simple", "standard", "deeper"] as const) {
    assert.ok(
      ch.summaryByDepth[depth].every((b) => b.text.trim().length > 0),
      `${depth} must not contain an empty block`,
    );
  }
});

test("serial-layer v21 with only fullRead: no depth renders an empty section", () => {
  // Pathological: cumulative keys for Standard ([easy, medium]) are both absent;
  // the composition must fall back to the single-layer selection, never empty.
  const ch = bundleChapter(
    pkg("chapterflow-v21-authored", "EMH", { hard: variant(FULL) }),
  );
  assert.deepEqual(paragraphs(ch.summaryByDepth.standard), [FULL]);
  assert.deepEqual(paragraphs(ch.summaryByDepth.deeper), [FULL]);
});

// ── Stable ids ────────────────────────────────────────────────────────────────

test("composed blocks carry stable, unique ${depth}-p-N ids", () => {
  const ch = bundleChapter(pkg("chapterflow-v21-authored", "EMH", EMH_THREE));
  assert.deepEqual(
    ch.summaryByDepth.deeper.map((b) => b.id),
    ["deeper-p-1", "deeper-p-2", "deeper-p-3"],
  );
});
