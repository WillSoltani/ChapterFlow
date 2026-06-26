/**
 * normalizeChapterProvenance — the repair-mislabel self-heal that unblocks publish
 * for the willpower ch5 wedge (a CORRUPTION repair stamped "source-anchor-map-v1"
 * instead of the canonical "chapter-source-anchor-map-v1" on an otherwise-valid
 * source-anchor map → PPKG.authoring_provenance_missing despite QC PASS).
 *
 * Asserts it NORMALIZES the recognized mislabel and NEVER fabricates: a missing,
 * empty, or alien-schema block is left untouched so the gate still (correctly)
 * rejects it.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { CHAPTERS_DIR, chapterFileName } from "../src/lib/chapterPaths.js";
import { CANONICAL_SOURCE_ANCHOR_SCHEMA, normalizeChapterProvenance } from "../src/qc/normalizeProvenance.js";

const BOOK = "zz-fixture-provnorm";

const VALID_ANCHORS = (n: number) => ({
  sourceHash: "deadbeefcafe0000",
  sourceSidecarPath: `/runs/${BOOK}/sidecars/source/ch${String(n).padStart(2, "0")}.source.json`,
  observedAnchorIds: [`ch${n}.concept`, `ch${n}.fact.1`, `ch${n}.fact.2`],
  effectiveAnchors: { hook: [`ch${n}.fact.1`], keyTakeaway: [`ch${n}.fact.2`] },
});

function writeChapter(n: number, authoring: unknown): string {
  const chapterId = `${BOOK}-ch${String(n).padStart(2, "0")}`;
  const path = resolve(CHAPTERS_DIR, chapterFileName(chapterId));
  const chapter: Record<string, unknown> = { schemaVersion: "v21-native", chapterId, number: n, title: `Ch ${n}` };
  if (authoring !== undefined) chapter.authoring = authoring;
  writeFileSync(path, JSON.stringify(chapter, null, 2) + "\n", "utf8");
  return path;
}

function readSchema(n: number): string | undefined {
  const path = resolve(CHAPTERS_DIR, chapterFileName(`${BOOK}-ch${String(n).padStart(2, "0")}`));
  return JSON.parse(readFileSync(path, "utf8"))?.authoring?.sourceAnchors?.schemaVersion;
}

function cleanup(): void {
  for (let n = 1; n <= 6; n++) {
    const p = resolve(CHAPTERS_DIR, chapterFileName(`${BOOK}-ch${String(n).padStart(2, "0")}`));
    rmSync(p, { force: true });
  }
}

test("normalizeChapterProvenance re-stamps a mislabeled-but-valid block; leaves canonical/missing/empty/alien untouched", () => {
  try {
    if (!existsSync(CHAPTERS_DIR)) mkdirSync(CHAPTERS_DIR, { recursive: true });
    cleanup();
    // ch1: the willpower wedge — recognized variant + a real source-anchor map → MUST normalize.
    writeChapter(1, { schemaVersion: "chapter-authoring-v1", sourceAnchors: { schemaVersion: "source-anchor-map-v1", ...VALID_ANCHORS(1) } });
    // ch2: already canonical → no change.
    writeChapter(2, { schemaVersion: "chapter-authoring-v1", sourceAnchors: { schemaVersion: CANONICAL_SOURCE_ANCHOR_SCHEMA, ...VALID_ANCHORS(2) } });
    // ch3: recognized variant but an EMPTY shell (no observedAnchorIds) → must NOT be fabricated into valid.
    writeChapter(3, { schemaVersion: "chapter-authoring-v1", sourceAnchors: { schemaVersion: "source-anchor-map-v1", observedAnchorIds: [], effectiveAnchors: {} } });
    // ch4: ALIEN schema on a valid structure → must NOT normalize (could be a real schema mismatch).
    writeChapter(4, { schemaVersion: "chapter-authoring-v1", sourceAnchors: { schemaVersion: "totally-different-v9", ...VALID_ANCHORS(4) } });
    // ch5: no authoring block at all (v1-style) → no change, no crash.
    writeChapter(5, undefined);

    const fixed = normalizeChapterProvenance(BOOK);

    // Only ch1 corrected, reported with its prior label.
    assert.deepEqual(fixed, [{ chapterNumber: 1, chapterId: `${BOOK}-ch01`, from: "source-anchor-map-v1", kind: "relabel" }]);
    assert.equal(readSchema(1), CANONICAL_SOURCE_ANCHOR_SCHEMA, "ch1 re-stamped to canonical");
    // ch1 content otherwise intact (observed anchors preserved).
    const ch1 = JSON.parse(readFileSync(resolve(CHAPTERS_DIR, chapterFileName(`${BOOK}-ch01`)), "utf8"));
    assert.deepEqual(ch1.authoring.sourceAnchors.observedAnchorIds, ["ch1.concept", "ch1.fact.1", "ch1.fact.2"]);

    assert.equal(readSchema(2), CANONICAL_SOURCE_ANCHOR_SCHEMA, "ch2 unchanged (was canonical)");
    assert.equal(readSchema(3), "source-anchor-map-v1", "ch3 empty shell NOT fabricated");
    assert.equal(readSchema(4), "totally-different-v9", "ch4 alien schema left for the gate");

    // Idempotent: a second pass changes nothing.
    assert.deepEqual(normalizeChapterProvenance(BOOK), []);
  } finally {
    cleanup();
  }
});

test("normalizeChapterProvenance RECONSTRUCTS a gutted block from retained effectiveAnchors; skips a gut with none", () => {
  try {
    if (!existsSync(CHAPTERS_DIR)) mkdirSync(CHAPTERS_DIR, { recursive: true });
    cleanup();
    // ch1: a valid canonical sibling (no change).
    writeChapter(1, { schemaVersion: "chapter-authoring-v1", sourceAnchors: { schemaVersion: CANONICAL_SOURCE_ANCHOR_SCHEMA, ...VALID_ANCHORS(1) } });
    // ch2: the tiny-habits ch3 GUT — schemaVersion + observedAnchorIds + sourceSidecarPath DROPPED; only effectiveAnchors survived.
    writeChapter(2, { schemaVersion: "chapter-authoring-v1", sourceAnchors: { effectiveAnchors: { hook: ["ch2.concept", "ch2.fact.1"], keyTakeaway: ["ch2.fact.2", "ch2.concept"] } } });
    // ch3: gut with EMPTY effectiveAnchors → nothing real to derive from → must NOT reconstruct.
    writeChapter(3, { schemaVersion: "chapter-authoring-v1", sourceAnchors: { effectiveAnchors: {} } });

    const fixed = normalizeChapterProvenance(BOOK);

    // Only ch2 reconstructed (via the gut path).
    assert.deepEqual(fixed.map((f) => ({ n: f.chapterNumber, kind: f.kind })), [{ n: 2, kind: "reconstruct" }]);
    const ch2 = JSON.parse(readFileSync(resolve(CHAPTERS_DIR, chapterFileName(`${BOOK}-ch02`)), "utf8"));
    assert.equal(ch2.authoring.sourceAnchors.schemaVersion, CANONICAL_SOURCE_ANCHOR_SCHEMA, "ch2 schemaVersion re-derived → canonical");
    // observedAnchorIds re-derived from effectiveAnchors (unique + sorted): {ch2.concept, ch2.fact.1, ch2.fact.2}.
    assert.deepEqual(ch2.authoring.sourceAnchors.observedAnchorIds, ["ch2.concept", "ch2.fact.1", "ch2.fact.2"]);
    // the real provenance (effectiveAnchors) is preserved verbatim.
    assert.deepEqual(ch2.authoring.sourceAnchors.effectiveAnchors, { hook: ["ch2.concept", "ch2.fact.1"], keyTakeaway: ["ch2.fact.2", "ch2.concept"] });

    // ch3 (empty effectiveAnchors) was NOT reconstructed — never fabricate.
    const ch3 = JSON.parse(readFileSync(resolve(CHAPTERS_DIR, chapterFileName(`${BOOK}-ch03`)), "utf8"));
    assert.equal(ch3.authoring.sourceAnchors.schemaVersion, undefined, "empty-effectiveAnchors gut NOT reconstructed");

    // Idempotent.
    assert.deepEqual(normalizeChapterProvenance(BOOK), []);
  } finally {
    cleanup();
  }
});

test("normalizeChapterProvenance RELABELS the 'source-anchors-v1' drift (the-willpower-instinct ch2 wedge) to canonical, preserving anchors", () => {
  cleanup();
  try {
    // The the-willpower-instinct ch2 wedge a live run hit: a CORRUPTION repair stamped the
    // pluralized/no-map variant "source-anchors-v1" on an otherwise-COMPLETE block (observed +
    // sidecar + effectiveAnchors all present) → PPKG.authoring_provenance_missing despite QC PASS.
    // RECOGNIZED_VARIANT must cover it so RELABEL fires (NOT a GUT reconstruct).
    writeChapter(1, { schemaVersion: "chapter-authoring-v1", sourceAnchors: { schemaVersion: "source-anchors-v1", ...VALID_ANCHORS(1) } });
    const fixed = normalizeChapterProvenance(BOOK);
    assert.deepEqual(fixed, [{ chapterNumber: 1, chapterId: `${BOOK}-ch01`, from: "source-anchors-v1", kind: "relabel" }]);
    assert.equal(readSchema(1), CANONICAL_SOURCE_ANCHOR_SCHEMA, "source-anchors-v1 relabeled to canonical");
    // byte-preserving token swap: the real anchor data + top-level authoring schema are untouched
    const ch1 = JSON.parse(readFileSync(resolve(CHAPTERS_DIR, chapterFileName(`${BOOK}-ch01`)), "utf8"));
    assert.deepEqual(ch1.authoring.sourceAnchors.observedAnchorIds, ["ch1.concept", "ch1.fact.1", "ch1.fact.2"]);
    assert.equal(ch1.authoring.schemaVersion, "chapter-authoring-v1", "top-level authoring.schemaVersion untouched");
    // Idempotent.
    assert.deepEqual(normalizeChapterProvenance(BOOK), []);
  } finally {
    cleanup();
  }
});
