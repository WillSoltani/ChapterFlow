/**
 * WP-303 — content-excellence stack regression anchors (sealed baseline
 * chapters).
 *
 * Pins the write-time content-excellence invariants (Chapter Format v25
 * F-1..F-8, docs/v25/CHAPTER_FORMAT_V25.md; plus the D7 lead-thread and B15
 * example-count write contracts) against the THREE real, sealed baseline
 * chapters WP-701/303 froze (nudge-ch03, made-to-stick-ch04,
 * the-happiness-hypothesis-ch06 — the same units the owner's D7 rubric audit
 * scored on 2026-07-15; see tests/fixtures/sealed-baseline-corpus.v1.json).
 * Anchors are loaded straight from the tracked book-packages/*.v21.json on
 * every run and hash-verified against the sealed pin — nothing is copied into
 * a new fixture file (repo convention: "FIXTURE POLICY: fixtures are
 * SYNTHETIC. No copyrighted book text is committed here", tests/helpers.ts).
 * Findings that could embed real chapter prose (the F25 advisory heuristics'
 * `evidence` field) are pinned by hash, never by literal text, for the same
 * reason.
 *
 * A change to `authorWriteContractFindings` (authorRun.ts), `checkFormatV25`
 * (critics/formatV25.ts), or the CHAPTER FORMAT v25 write-time instruction
 * blocks that regresses what these three REAL chapters produce is caught
 * here — proving the invariants stay comparable across future prompt/logic
 * edits, independent of any live model call.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import {
  AUTHOR_FORMAT_V25_BLOCK,
  authorSelfVerify,
  authorWriteContractFindings,
} from "../src/orchestrator/authorRun.js";
import {
  checkFormatV25,
  checkFormatV25DuplicateExamples,
  checkFormatV25LoopClosure,
  checkFormatV25QuizFeedback,
  checkFormatV25TierSerialOpeners,
} from "../src/critics/formatV25.js";
import { CHAPTER_BRIEF_SCHEMA_VERSION, type ChapterBriefV1, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterV21 } from "../src/types.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const FIXTURE_PATH = resolve(PIPELINE_DIR, "tests/fixtures/sealed-baseline-corpus.v1.json");

type SealedUnit = {
  unit: string;
  bookId: string;
  chapterNumber: number;
  publishedPackageRelPath: string;
  publishedPackageSha256: string;
};

function loadFixtureUnits(): SealedUnit[] {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as { units: SealedUnit[] };
  return fixture.units;
}

/** Load one sealed anchor straight from the tracked package, re-verifying the
 *  whole-file hash pin every time — an anchor is never used unsealed. */
function loadAnchor(unit: SealedUnit): ChapterV21 {
  const bytes = readFileSync(resolve(REPOSITORY_ROOT, unit.publishedPackageRelPath));
  assert.equal(sha256Hex(bytes), unit.publishedPackageSha256,
    `${unit.unit}: published package drifted from its sealed pin — re-seal explicitly, never edit the anchor silently`);
  const pkg = JSON.parse(bytes.toString("utf8")) as { chapters: ChapterV21[] };
  const chapter = pkg.chapters.find((c) => c.number === unit.chapterNumber);
  assert.ok(chapter, `${unit.unit}: chapter ${unit.chapterNumber} missing`);
  return chapter as ChapterV21;
}

const ANCHORS = loadFixtureUnits().map((unit) => ({ unit, chapter: loadAnchor(unit) }));

function emptyPacket(): SourcePacketV1 {
  return {
    schemaVersion: "source-packet-v1",
    bookId: "zz-anchor", chapterId: "zz-anchor-ch00", chapterNumber: 0, chapterTitle: "zz",
    sourceSidecarPath: null, sourceHash: null,
    facts: [], namedCases: [], frameworks: [], allowedAnchors: [],
    allowedNumbers: [], allowedEntities: [], allowedPlaces: [],
    forbiddenClaims: [], forbiddenLeakage: [],
    sourceQuality: { status: "adequate", risks: [] },
  };
}

function mkBrief(over: Partial<ChapterBriefV1>): ChapterBriefV1 {
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: "zz-anchor-ch03", chapterNumber: 3, title: "zz",
    coreMove: "x", thesis: "x", readerPromise: "x",
    ownedCases: [], notYours: [], cast: [], answerIndexPattern: [],
    avoid: [], lengthBudget: { renderedChars: 1000, tolerance: 0.2 }, flavor: [],
    openerType: "question", challengeFrame: "before-your-next-X", practiceShape: "single-imperative",
    ...over,
  };
}

// ── Anchor N: authorWriteContractFindings matches the sealed expectation ────
//
// Real chapters carry no retained ChapterBriefV1 (only the published output was
// sealed) — with brief=null the B15/D7 brief-scoped checks are inert by
// construction and only the brief-independent checks (D9 timer sanity, W1
// label-leak) run. All three sealed anchors are clean: zero complaints.

test("anchor nudge-ch03: authorWriteContractFindings matches the sealed expectation (clean)", () => {
  const { chapter } = ANCHORS.find((a) => a.unit.unit === "nudge-ch03")!;
  assert.deepEqual(authorWriteContractFindings(chapter, null, emptyPacket()), []);
});

test("anchor made-to-stick-ch04: authorWriteContractFindings matches the sealed expectation (clean)", () => {
  const { chapter } = ANCHORS.find((a) => a.unit.unit === "made-to-stick-ch04")!;
  assert.deepEqual(authorWriteContractFindings(chapter, null, emptyPacket()), []);
});

test("anchor the-happiness-hypothesis-ch06: authorWriteContractFindings matches the sealed expectation (clean)", () => {
  const { chapter } = ANCHORS.find((a) => a.unit.unit === "the-happiness-hypothesis-ch06")!;
  assert.deepEqual(authorWriteContractFindings(chapter, null, emptyPacket()), []);
});

// ── Anchor content hashes are stable + the format-block invariants are
//    finding/byte-stable against each anchor (hash-pinned, never literal
//    prose, per the fixture policy above) ────────────────────────────────────

const SEALED_FORMAT_V25_SEAL: Record<string, { chapterSha256: string; findingsCount: number; findingsSha256: string; catalogCounts: Record<string, number> }> = {
  "nudge-ch03": {
    chapterSha256: "5568a8db97f88f78c3bd39abd7084b7de27d50e9ff52806c60419136099e3549",
    findingsCount: 18,
    findingsSha256: "0827131c06af1502e5b910aa8ba2f7b87ef833b15aa3016861934d314e8f38c7",
    catalogCounts: { "F25.quiz_feedback": 18 },
  },
  "made-to-stick-ch04": {
    chapterSha256: "16ddf26299dc01d5f1eb4bcff953ed988a58f99dd13378de17a15049ad7e5f86",
    findingsCount: 19,
    findingsSha256: "4b6d7b94844e26424b37011c44c4efb0742dc859a0839da99756881fe5bc3d3c",
    catalogCounts: { "F25.quiz_feedback": 18, "F25.tier_serial_opener": 1 },
  },
  "the-happiness-hypothesis-ch06": {
    chapterSha256: "81a69940431214382755befb2fcd8254f303e7666678335b73a5bd2e692fe0de",
    findingsCount: 20,
    findingsSha256: "f13fe086d2818e82d9b6e00cef13aa72005b3153275a350b93420fef79fb12f8",
    catalogCounts: { "F25.quiz_feedback": 18, "F25.tier_serial_opener": 2 },
  },
};

test("anchor content hashes are stable (re-derivation matches the sealed per-chapter pin)", () => {
  for (const { unit, chapter } of ANCHORS) {
    const seal = SEALED_FORMAT_V25_SEAL[unit.unit];
    assert.ok(seal, `${unit.unit}: no sealed anchor-hash entry`);
    assert.equal(sha256Hex(JSON.stringify(chapter)), seal.chapterSha256,
      `${unit.unit}: anchor content hash drifted — a hash change requires an explicit re-seal, never a silent update`);
  }
});

test("checkFormatV25 findings are byte/finding-stable against each sealed anchor (hash-pinned, not re-derived from live wording)", () => {
  for (const { unit, chapter } of ANCHORS) {
    const seal = SEALED_FORMAT_V25_SEAL[unit.unit];
    const findings = checkFormatV25(chapter);
    assert.equal(findings.length, seal.findingsCount, `${unit.unit}: finding count drifted`);
    assert.equal(sha256Hex(JSON.stringify(findings)), seal.findingsSha256,
      `${unit.unit}: checkFormatV25 finding SET changed (logic or format-block drift) — re-seal explicitly if intended`);
    const byCatalog: Record<string, number> = {};
    for (const f of findings) byCatalog[f.catalogId] = (byCatalog[f.catalogId] ?? 0) + 1;
    assert.deepEqual(byCatalog, seal.catalogCounts, `${unit.unit}: catalogId histogram drifted`);
  }
});

test("checkFormatV25 has teeth: introducing a duplicate example flips the sealed hash", () => {
  const { chapter } = ANCHORS.find((a) => a.unit.unit === "nudge-ch03")!;
  const mutated: ChapterV21 = JSON.parse(JSON.stringify(chapter));
  mutated.examples.push({ ...mutated.examples[0], exampleId: "zz-duplicate-check" });
  assert.notEqual(sha256Hex(JSON.stringify(checkFormatV25(mutated))), SEALED_FORMAT_V25_SEAL["nudge-ch03"].findingsSha256);
});

// ── F-1..F-8 mapping: every requirement maps to at least one anchor
//    assertion, documenting which invariant enforces it right now ───────────
//
// F-1/F-2/F-3/F-5 have a DETERMINISTIC critic in critics/formatV25.ts (pinned
// above, exercised against real sealed content — F-1 and F-2 fire genuinely on
// these pre-v25 shipped anchors, proving the mapping is not vacuous). F-4/F-6/
// F-7/F-8 have NO deterministic critic today (critics/formatV25.ts's own
// header: "the semantic requirements... get ADVISORY heuristics [t]here and
// their real enforcement at the rubric-audit gate" — F-4/6/7/8 do not even
// have an advisory heuristic yet); their only current write-time enforcement
// is the instruction text itself, so the anchor assertion for those four is
// that the instruction text is actually present (hash-pinned in
// author-instruction-block-versions.test.ts) — an honest, non-vacuous
// regression anchor for "no deterministic critic exists", not a stand-in for
// one. This is a real, filed gap: the rubric-audit gate (WP-401) and D7
// reviewer carry F-4/6/7/8's real enforcement.

test("F-1 LAYERS maps to checkFormatV25TierSerialOpeners — fires genuinely on 2/3 real anchors", () => {
  const nudge = checkFormatV25TierSerialOpeners(ANCHORS.find((a) => a.unit.unit === "nudge-ch03")!.chapter);
  const stick = checkFormatV25TierSerialOpeners(ANCHORS.find((a) => a.unit.unit === "made-to-stick-ch04")!.chapter);
  const happy = checkFormatV25TierSerialOpeners(ANCHORS.find((a) => a.unit.unit === "the-happiness-hypothesis-ch06")!.chapter);
  assert.equal(nudge.length, 0, "nudge-ch03 has no serial-opener tell");
  assert.equal(stick.length, 1, "made-to-stick-ch04 (pre-v25) genuinely opens a deeper tier as a continuation");
  assert.equal(happy.length, 2, "the-happiness-hypothesis-ch06 (pre-v25) genuinely carries two serial-opener tells");
  assert.ok([...stick, ...happy].every((f) => f.catalogId === "F25.tier_serial_opener"));
});

test("F-2 QUIZ FEEDBACK maps to checkFormatV25QuizFeedback — all 3 pre-v25 anchors are missing the feedback block (18 findings each)", () => {
  for (const { unit, chapter } of ANCHORS) {
    const findings = checkFormatV25QuizFeedback(chapter);
    assert.equal(findings.length, 18, `${unit.unit}: expected 18 (9 questions x rationale+revisit) on a pre-v25 chapter`);
    assert.ok(findings.every((f) => f.catalogId === "F25.quiz_feedback"));
  }
});

test("F-3 ECONOMY maps to checkFormatV25DuplicateExamples — clean on all 3 sealed anchors", () => {
  for (const { chapter } of ANCHORS) {
    assert.deepEqual(checkFormatV25DuplicateExamples(chapter), []);
  }
});

test("F-5 LOOP CLOSURE maps to checkFormatV25LoopClosure — clean on all 3 sealed anchors", () => {
  for (const { chapter } of ANCHORS) {
    assert.deepEqual(checkFormatV25LoopClosure(chapter), []);
  }
});

test("F-4/F-6/F-7/F-8 map to the write-time instruction text ONLY (no deterministic critic exists yet)", () => {
  // F-4 EVIDENCE BRIDGE
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /EVIDENCE BRIDGE \[SCORED\]/);
  assert.match(authorSelfVerify("zz-anchor", 3, "zz/path"), /F-4 EVIDENCE BRIDGE/);
  // F-6 TAXONOMY
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /ONE TAXONOMY \[SCORED\]/);
  assert.match(authorSelfVerify("zz-anchor", 3, "zz/path"), /F-6 TAXONOMY/);
  // F-7 NAMED CONTEXT
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /NAMED REFERENCES \[SCORED\]/);
  assert.match(authorSelfVerify("zz-anchor", 3, "zz/path"), /F-7 NAMED CONTEXT/);
  // F-8 AMBIGUITY
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /8\. AMBIGUITY \[SCORED\]/);
  assert.match(authorSelfVerify("zz-anchor", 3, "zz/path"), /F-8 AMBIGUITY/);
});

// ── Negative: proving the checks have teeth on defect SHAPES derived from a
//    real sealed anchor (ephemeral in-process mutations only — nothing new is
//    committed; the base bytes stay the tracked book-packages file) ─────────

test("negative: padded-example anchor flips the B15 finding (nudge-ch03, dealt=6, padded to 7)", () => {
  const { chapter } = ANCHORS.find((a) => a.unit.unit === "nudge-ch03")!;
  const dealtBrief = mkBrief({ exampleCount: 6, rotationSchemaVersion: "wp303-fixture-v1" });

  // Baseline: dealt (6) equals wrote (6) — clean.
  assert.deepEqual(authorWriteContractFindings(chapter, dealtBrief, emptyPacket()), []);

  // Padded: append a duplicate example (the exact "5/8 round-1 writers padded a
  // 4/5-deal up to 6" defect shape) — wrote (7) now exceeds dealt (6).
  const padded: ChapterV21 = JSON.parse(JSON.stringify(chapter));
  padded.examples.push({ ...padded.examples[0], exampleId: "zz-padded-07" });
  const findings = authorWriteContractFindings(padded, dealtBrief, emptyPacket());
  assert.equal(findings.length, 1);
  assert.match(findings[0], /example count: your brief deals 6 examples \(5-6 permitted\) — you wrote 7\. Cut 1:/);
});

test("negative: lead-thread-removed anchor flips the D7 finding (nudge-ch03, dealt lead constructed then withdrawn)", () => {
  const { chapter } = ANCHORS.find((a) => a.unit.unit === "nudge-ch03")!;
  const leadBrief = mkBrief({ leadThread: { kind: "owned-case", name: "Addison" } });

  // Construct a clean baseline: an existing cast member (Addison, ex01 in the
  // sealed anchor) declared as the dealt lead, with the fastRead and a SECOND
  // example (ephemeral, original one-clause annotations only) carrying the
  // thread so the write contract is satisfied.
  const carried: ChapterV21 = JSON.parse(JSON.stringify(chapter));
  carried.breakdown.fastRead = `Addison notices it first. ${carried.breakdown.fastRead}`;
  carried.examples[1] = { ...carried.examples[1], whatToDo: `Addison flags it: ${carried.examples[1].whatToDo}` };
  assert.deepEqual(authorWriteContractFindings(carried, leadBrief, emptyPacket()), []);

  // Removed: withdraw the fastRead mention only (the "lead-thread-removed"
  // defect shape) — the fastRead-presence finding must reappear.
  const removed: ChapterV21 = JSON.parse(JSON.stringify(carried));
  removed.breakdown.fastRead = chapter.breakdown.fastRead;
  const findings = authorWriteContractFindings(removed, leadBrief, emptyPacket());
  assert.equal(findings.length, 1);
  assert.match(findings[0], /lead thread: the dealt lead case "Addison" never appears in the fastRead/);
});
