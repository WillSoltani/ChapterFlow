/**
 * WP-303 — version-pinned regression tests for the writer-instruction stack
 * (authorRun.ts CARD_BLOCK_VERSIONS: invariants-v3, quality-bar-v4,
 * self-verify-v4, format-v25-v2 carrying the F-1..F-8 block, plus
 * precedence-v1 and premium-v3 for full-stack coverage).
 *
 * IMP-05 instruction 13 established the convention: "bump the matching
 * version whenever a block's text changes" (authorRun.ts CARD_BLOCK_VERSIONS
 * comment) — but nothing previously ENFORCED it. This suite hash-pins each
 * versioned block, keyed by its CURRENT version string:
 *
 *   - editing a block's text WITHOUT bumping CARD_BLOCK_VERSIONS[key] leaves
 *     the version key unchanged, so the pinned hash for that (still current)
 *     version now mismatches the live text — FAILS.
 *   - bumping the version string alone (or with a text change) requires
 *     adding a NEW pin entry under the new version string in the SAME
 *     change — an unbumped/unpinned edit cannot pass silently either way.
 *
 * This keeps the D3-craft ground truth (content-excellence-anchors.test.ts)
 * comparable across future prompt edits: a version bump is a conscious,
 * reviewable act, not a silent drift.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import {
  AUTHOR_FORMAT_V25_BLOCK,
  AUTHOR_HOUSE_RULES,
  AUTHOR_PRECEDENCE,
  AUTHOR_PREMIUM_BLOCK,
  AUTHOR_QUALITY_BAR,
  CARD_BLOCK_VERSIONS,
  authorCardComposition,
  authorSelfVerify,
} from "../src/orchestrator/authorRun.js";

type VersionKey = "precedence" | "invariants" | "formatV25" | "qualityBar" | "premium" | "selfVerify";

const BLOCKS: ReadonlyArray<{ label: string; versionKey: VersionKey; text: () => string }> = [
  { label: "AUTHOR_PRECEDENCE", versionKey: "precedence", text: () => AUTHOR_PRECEDENCE },
  { label: "AUTHOR_HOUSE_RULES (GLOBAL INVARIANTS)", versionKey: "invariants", text: () => AUTHOR_HOUSE_RULES },
  { label: "AUTHOR_FORMAT_V25_BLOCK (F-1..F-8, card form)", versionKey: "formatV25", text: () => AUTHOR_FORMAT_V25_BLOCK },
  { label: "AUTHOR_QUALITY_BAR", versionKey: "qualityBar", text: () => AUTHOR_QUALITY_BAR },
  { label: "AUTHOR_PREMIUM_BLOCK", versionKey: "premium", text: () => AUTHOR_PREMIUM_BLOCK },
  // Fixed args make the parameterized relPath preamble deterministic so the
  // WHOLE rendered block (including the F-1..F-8 write-time evidence list) is
  // pinnable; a change to the fixed relPath/bookId/chapterNumber args below
  // never happens in production (real call sites always pass real values), so
  // it cannot mask a real content edit.
  { label: "authorSelfVerify() (F-1..F-8 write-time evidence block)", versionKey: "selfVerify", text: () => authorSelfVerify("wp303-fixture", 1, "wp303/fixture/path.json") },
];

// Sealed 2026-07-16 (WP-303). Keyed by the CURRENT CARD_BLOCK_VERSIONS value —
// see the file header for exactly how this catches an unbumped edit.
const SEALED_BLOCK_HASH_BY_VERSION: Record<string, string> = {
  "precedence-v1": "21bd217dba492949d61c2c5884cdee2af38e5f696144f21ca66b5a22ac43f363",
  "invariants-v3": "33aab3fb62751be02b7d4a647bd732defc36c9bff681a2072aabc4f7a41405d0",
  "format-v25-v2": "470363b5b4ac957188bd24224a5ea782d6c91f5a44a960405330916d063f7e08",
  "quality-bar-v4": "bb8b4125eb1fd2ba876668f181d53c18129d6fc41b099a1db53f953c1237ef58",
  "premium-v3": "88452ed1e25969d81f23f5c1376174a2bd7bd727512ea6759984ef730b80743c",
  "self-verify-v4": "bf98383f751fdf1a772ef038a6ea8fc1b33449265fcdd6c872218dde4e669eaf",
};

test("every versioned writer-instruction block is hash-pinned to its CURRENT version — an edit without a version bump fails", () => {
  for (const block of BLOCKS) {
    const version = CARD_BLOCK_VERSIONS[block.versionKey];
    const expectedHash = SEALED_BLOCK_HASH_BY_VERSION[version];
    assert.ok(
      expectedHash,
      `${block.label}: no sealed pin recorded for version '${version}' — a version bump must add its hash pin in THIS SAME change (see file header)`,
    );
    assert.equal(
      sha256Hex(block.text()),
      expectedHash,
      `${block.label}: text changed while CARD_BLOCK_VERSIONS.${block.versionKey} is still '${version}' — bump the version (and add its pin here) or this is an unintended drift`,
    );
  }
});

test("the hash pin has teeth: a single appended byte on any block would flip its hash", () => {
  for (const block of BLOCKS) {
    const version = CARD_BLOCK_VERSIONS[block.versionKey];
    const mutatedHash = sha256Hex(`${block.text()} `);
    assert.notEqual(mutatedHash, SEALED_BLOCK_HASH_BY_VERSION[version],
      `${block.label}: the pin must react to a one-byte edit`);
  }
});

test("CARD_BLOCK_VERSIONS carries exactly the expected version strings for the covered blocks (no silent rename)", () => {
  assert.equal(CARD_BLOCK_VERSIONS.precedence, "precedence-v1");
  assert.equal(CARD_BLOCK_VERSIONS.invariants, "invariants-v3");
  assert.equal(CARD_BLOCK_VERSIONS.formatV25, "format-v25-v2");
  assert.equal(CARD_BLOCK_VERSIONS.qualityBar, "quality-bar-v4");
  assert.equal(CARD_BLOCK_VERSIONS.premium, "premium-v3");
  assert.equal(CARD_BLOCK_VERSIONS.selfVerify, "self-verify-v4");
});

// authorCardComposition() folds precedence/invariants/formatV25/qualityBar/
// premium + the version map into one control hash (excludes selfVerify, which
// is parameterized per-call) — a secondary, coarser aggregate regression on
// top of the per-block pins above.
test("authorCardComposition().controlSha256 is stable (aggregate card-drift seal)", () => {
  assert.equal(authorCardComposition().controlSha256,
    "c9c859f785923cf5e8f1fd5aa356e7c032ac725fa3f54dbf099a7c0f37ce99e2");
});
