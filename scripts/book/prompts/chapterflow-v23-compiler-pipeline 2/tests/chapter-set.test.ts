import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import {
  compareChapterSetToCanonical,
  readCanonicalChapterIndex,
} from "../src/lib/chapterSet.js";
import { test } from "./harness.js";
import { TMP_DIR } from "./helpers.js";

const BOOK = "zz-canonical-helper";

function spec(n: number, bookId = BOOK): { chapterId: string; chapterNumber: number; chapterTitle: string } {
  return {
    chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: `Chapter ${n}`,
  };
}

function checkIds(blockers: Array<{ checkId: string }>): string[] {
  return blockers.map((b) => b.checkId);
}

test("chapter-set comparison rejects missing, extra, duplicate, wrong, and reordered chapters", () => {
  const canonical = [spec(1), spec(2), spec(3)];
  const cases: Array<{ name: string; actual: any[]; ids: string[] }> = [
    {
      name: "empty chapter set",
      actual: [],
      ids: ["CHSET.count_mismatch", "CHSET.missing_chapter"],
    },
    {
      name: "missing chapter",
      actual: [spec(1), spec(3)],
      ids: ["CHSET.count_mismatch", "CHSET.missing_chapter"],
    },
    {
      name: "extra chapter",
      actual: [spec(1), spec(2), spec(3), spec(4)],
      ids: ["CHSET.count_mismatch", "CHSET.extra_chapter"],
    },
    {
      name: "duplicate number",
      actual: [spec(1), { ...spec(2), chapterNumber: 1 }, spec(3)],
      ids: ["CHSET.actual_id_number_mismatch", "CHSET.actual_duplicate_number"],
    },
    {
      name: "duplicate id",
      actual: [spec(1), { ...spec(1), chapterNumber: 1 }, spec(3)],
      ids: ["CHSET.actual_duplicate_id", "CHSET.actual_duplicate_number", "CHSET.missing_chapter"],
    },
    {
      name: "wrong id",
      actual: [{ ...spec(1), chapterId: "other-book-ch01" }, spec(2), spec(3)],
      ids: ["CHSET.actual_book_mismatch", "CHSET.missing_chapter", "CHSET.extra_chapter"],
    },
    {
      name: "wrong number",
      actual: [{ ...spec(1), chapterNumber: 2 }, spec(2), spec(3)],
      ids: ["CHSET.actual_id_number_mismatch", "CHSET.actual_duplicate_number"],
    },
    {
      name: "reordered complete set",
      actual: [spec(2), spec(1), spec(3)],
      ids: ["CHSET.position_mismatch"],
    },
  ];

  for (const c of cases) {
    const result = compareChapterSetToCanonical({ bookId: BOOK, canonical, actual: c.actual, actualLabel: c.name });
    assert.equal(result.ok, false, `${c.name} must fail`);
    const ids = checkIds(result.blockers);
    for (const id of c.ids) assert.ok(ids.includes(id), `${c.name} missing ${id}; got ${ids.join(", ")}`);
  }
});

test("chapter-set comparison accepts the complete canonical order", () => {
  const canonical = [spec(1), spec(2), spec(3)];
  const result = compareChapterSetToCanonical({ bookId: BOOK, canonical, actual: canonical });
  assert.equal(result.ok, true);
  assert.deepEqual(result.blockers, []);
});

test("canonical index reader fails closed on missing, malformed, empty, and duplicate indexes", () => {
  const root = resolve(TMP_DIR, "chapter-set-index");
  const indexes = resolve(root, "indexes");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(indexes, { recursive: true });

  try {
    assert.equal(readCanonicalChapterIndex("missing-book", root).ok, false);

    writeFileSync(resolve(indexes, "bad-json.json"), "{ nope", "utf8");
    assert.ok(checkIds(readCanonicalChapterIndex("bad-json", root).blockers).includes("CHSET.index_malformed"));

    writeFileSync(resolve(indexes, "not-array.json"), JSON.stringify({ chapters: [] }), "utf8");
    assert.ok(checkIds(readCanonicalChapterIndex("not-array", root).blockers).includes("CHSET.index_malformed"));

    writeFileSync(resolve(indexes, "empty.json"), JSON.stringify([]), "utf8");
    assert.ok(checkIds(readCanonicalChapterIndex("empty", root).blockers).includes("CHSET.index_empty"));

    writeFileSync(resolve(indexes, `${BOOK}.json`), JSON.stringify([spec(1), spec(1)], null, 2), "utf8");
    const duplicate = readCanonicalChapterIndex(BOOK, root);
    assert.equal(duplicate.ok, false);
    assert.ok(checkIds(duplicate.blockers).includes("CHSET.index_duplicate_id"));
    assert.ok(checkIds(duplicate.blockers).includes("CHSET.index_duplicate_number"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
