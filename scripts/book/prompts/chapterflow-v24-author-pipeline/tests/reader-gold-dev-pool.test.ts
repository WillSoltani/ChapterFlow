/** reader-gold-dev-pool-v1 — prose-blind frozen selection (owner-ratified D2/D3).
 * Pins the EXACT 24-chapter selection so any silent rule drift fails loudly,
 * proves the rule depends on chapter counts only, and pins create-once. */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  READER_GOLD_DEV_POOL_MANIFEST_REL_PATH,
  READER_GOLD_DEV_POOL_TARGET,
  buildReaderGoldDevPoolSelection,
  evenlySpacedChapters,
  materializeReaderGoldDevPoolSelection,
  positionStratum,
  validateReaderGoldDevPoolSelectionManifest,
} from "../src/bakeoff/migration/readerGoldDevPool.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");

const PINNED_SELECTION: Record<string, number[]> = {
  factfulness: [1, 4, 6, 9, 11],
  "made-to-stick": [1, 2, 3, 4, 5, 6],
  nudge: [1, 3, 6, 8, 11, 13, 16, 18],
  "the-happiness-hypothesis": [1, 4, 6, 9, 11],
};

function syntheticRoot(counts: Record<string, number>, marker: string): string {
  const root = mkdtempSync(resolve(tmpdir(), "reader-gold-pool-"));
  for (const [bookId, count] of Object.entries(counts)) {
    const path = resolve(root, `book-packages/${bookId}.v21.json`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({
      bookId,
      marker,
      chapters: Array.from({ length: count }, (_, i) => ({ n: i + 1, prose: `${marker}-${bookId}-${i}` })),
    }));
  }
  return root;
}

test("selection is deterministic and pins the exact 24 chapters (5+6+8+5 across position strata)", () => {
  const first = buildReaderGoldDevPoolSelection({ repositoryRoot: REPOSITORY_ROOT });
  const second = buildReaderGoldDevPoolSelection({ repositoryRoot: REPOSITORY_ROOT });
  assert.deepEqual(first, second, "two builds must be byte-identical");
  assert.deepEqual(validateReaderGoldDevPoolSelectionManifest(first), []);
  assert.equal(first.totalSelected, READER_GOLD_DEV_POOL_TARGET);
  for (const book of first.books) {
    assert.deepEqual(book.selectedChapters.map((c) => c.chapterNumber), PINNED_SELECTION[book.bookId],
      `frozen selection drifted for ${book.bookId}`);
  }
  const strata = first.books.flatMap((b) => b.selectedChapters.map((c) => c.positionStratum));
  for (const stratum of ["early", "middle", "late"] as const) {
    assert.ok(strata.filter((s) => s === stratum).length >= 6, `stratum ${stratum} under-represented`);
  }
});

test("selection depends on chapter counts ONLY — different prose, same counts, identical selection", () => {
  const rootA = syntheticRoot({ factfulness: 11, "made-to-stick": 6, nudge: 18, "the-happiness-hypothesis": 11 }, "alpha");
  const rootB = syntheticRoot({ factfulness: 11, "made-to-stick": 6, nudge: 18, "the-happiness-hypothesis": 11 }, "beta");
  try {
    const a = buildReaderGoldDevPoolSelection({ repositoryRoot: rootA });
    const b = buildReaderGoldDevPoolSelection({ repositoryRoot: rootB });
    assert.notDeepEqual(a.books.map((x) => x.packageBytesSha256), b.books.map((x) => x.packageBytesSha256),
      "fixture packages must actually differ in bytes");
    assert.deepEqual(
      a.books.map((x) => ({ bookId: x.bookId, quota: x.quota, chapters: x.selectedChapters })),
      b.books.map((x) => ({ bookId: x.bookId, quota: x.quota, chapters: x.selectedChapters })),
      "prose must never influence the selection");
  } finally {
    rmSync(rootA, { recursive: true, force: true });
    rmSync(rootB, { recursive: true, force: true });
  }
});

test("create-once: idempotent re-materialization; a tampered retained manifest fails closed", () => {
  const root = syntheticRoot({ factfulness: 11, "made-to-stick": 6, nudge: 18, "the-happiness-hypothesis": 11 }, "gamma");
  try {
    const first = materializeReaderGoldDevPoolSelection({ repositoryRoot: root, write: true });
    assert.equal(first.written, true);
    const manifestPath = resolve(root, READER_GOLD_DEV_POOL_MANIFEST_REL_PATH);
    const bytes = readFileSync(manifestPath, "utf8");
    const again = materializeReaderGoldDevPoolSelection({ repositoryRoot: root, write: true });
    assert.equal(again.selectionSha256, first.selectionSha256);
    assert.equal(readFileSync(manifestPath, "utf8"), bytes, "re-materialization must be byte-identical");
    writeFileSync(manifestPath, bytes.replace("\"totalSelected\": 24", "\"totalSelected\": 23"));
    assert.throws(() => materializeReaderGoldDevPoolSelection({ repositoryRoot: root }),
      /frozen and may never be re-selected/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validator refuses provenance-flag and self-hash tampering; helpers behave at boundaries", () => {
  const manifest = buildReaderGoldDevPoolSelection({ repositoryRoot: REPOSITORY_ROOT });
  const labelled = structuredClone(manifest) as unknown as { ratification: Record<string, unknown> };
  labelled.ratification.candidateOutputsUsedForLabels = true;
  assert.ok(validateReaderGoldDevPoolSelectionManifest(labelled).some((x) => x.includes("provenance")));
  const tampered = structuredClone(manifest) as unknown as { books: Array<{ quota: number }> };
  tampered.books[0].quota += 1;
  assert.ok(validateReaderGoldDevPoolSelectionManifest(tampered).some((x) => x.includes("self-hash")));

  assert.deepEqual(evenlySpacedChapters(6, 6), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(evenlySpacedChapters(11, 5), [1, 4, 6, 9, 11]);
  assert.equal(positionStratum(1, 11), "early");
  assert.equal(positionStratum(6, 11), "middle");
  assert.equal(positionStratum(11, 11), "late");
});
