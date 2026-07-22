/**
 * sweep-defect-v2 — the per-affected-chapter sweep defect FINGERPRINT.
 *
 * The v1 whole-finding key (`sweepDefectKey`) bound the free-form `problem` prose AND the entire
 * chapter array into one indivisible identity. That blocked two honest reviewers from corroborating
 * the SAME real defect whenever they worded the problem differently or named overlapping (not
 * identical) chapter sets — a real gate then read as an uncorroborated stochastic flip and was
 * demoted, shipping the defect. v2 fixes that by keying corroboration per chapter on
 * (bookId + family + unit + distinctive quote + chapter + bytes), excluding the prose. These tests
 * pin: (1) what the fingerprint binds/excludes, and (2) the per-chapter corroboration behaviour via
 * the shared evaluator (`sweepChapterStatus` with an injected prior round — pure, no disk).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import {
  appendSweepHistory,
  chapterClearsPath,
  loadSweepHistory,
  sweepChapterStatus,
  sweepDefectFingerprintV2,
  sweepDefectKey,
  sweepHistoryPath,
  sweepRecordPath,
  sweepRoundRecordPath,
  type SweepRecord,
} from "../src/qc/sweep.js";
import { QC_ORCHESTRATOR_DIR } from "../src/qc/orchestrator/artifacts.js";

const ROUND = "r-fp-current";
const BOOK = "zz-fixture-sweep-fp";
// Four hashed chapters so cross-membership and frozen-content cases have bytes to bind.
const HASHES: Record<string, string> = { "1": "h1", "2": "h2", "3": "h3", "4": "h4" };

type FindingInput = {
  family: SweepRecord["findings"][number]["family"];
  severity?: "blocker" | "advisory";
  chapters: number[];
  unitId?: string;
  quote: string;
  problem?: string;
  expectedFix?: string;
};

function rec(opts: {
  verdict?: SweepRecord["verdict"];
  roundId?: string;
  reviewerSessionId?: string;
  reviewer?: string;
  hashes?: Record<string, string>;
  findings: FindingInput[];
}): SweepRecord {
  return {
    schemaVersion: "sweep-attest-v1",
    bookId: BOOK,
    roundId: opts.roundId ?? ROUND,
    verdict: opts.verdict ?? "REVISE",
    reviewer: opts.reviewer ?? "codex-qc:sweep",
    reviewerSessionId: opts.reviewerSessionId ?? "session-current",
    attestedAt: "2026-01-01T00:00:00.000Z",
    contentHashes: opts.hashes ?? HASHES,
    checkedFamilies: [],
    findings: opts.findings.map((f) => ({
      family: f.family,
      severity: f.severity ?? "blocker",
      chapters: f.chapters,
      unitId: f.unitId ?? "u",
      quote: f.quote,
      problem: f.problem ?? "p",
      expectedFix: f.expectedFix ?? "f",
    })),
  };
}

/** A prior INDEPENDENT round (different roundId + session) over the same bytes. */
function priorRound(findings: FindingInput[], reviewerSessionId = "session-prior"): SweepRecord {
  return rec({ roundId: "r-fp-prior", reviewerSessionId, findings });
}

const FP = (chapter: number, extra: Partial<{ family: SweepRecord["findings"][number]["family"]; unitId: string; quote: string }> = {}) =>
  sweepDefectFingerprintV2(
    { bookId: BOOK, contentHashes: HASHES },
    { family: extra.family ?? "persona_drift", unitId: extra.unitId ?? "u", quote: extra.quote ?? "Genevieve" },
    chapter,
  );

// ── 1. What the fingerprint binds / excludes ─────────────────────────────────────────────

test("fingerprint: free-form problem/expectedFix are EXCLUDED from identity", () => {
  const a = sweepDefectFingerprintV2({ bookId: BOOK, contentHashes: HASHES }, { family: "persona_drift", unitId: "u", quote: "Genevieve" }, 2);
  // Same family/unit/quote/chapter/bytes; the finding's prose is not even an input here — identical fp.
  const b = sweepDefectFingerprintV2({ bookId: BOOK, contentHashes: HASHES }, { family: "persona_drift", unitId: "u", quote: "Genevieve" }, 2);
  assert.equal(a, b);
  assert.ok(a?.startsWith("sweep-defect-v2:"), "v2 fingerprints are version-prefixed");
});

test("fingerprint: quote style is normalized (unicode/case/whitespace/curly quotes/wrapping punctuation) but meaning is not", () => {
  const canonical = FP(2, { quote: "the corner office" });
  // Curly quotes + case + collapsed whitespace + a trailing period that does not change the words.
  assert.equal(FP(2, { quote: "  “The   Corner Office.”  " }), canonical, "wrapping/style differences collapse to one signature");
  // A MATERIALLY different quote (one word changed) must NOT collapse.
  assert.notEqual(FP(2, { quote: "the corner desk" }), canonical, "a materially different quote keeps a distinct signature");
});

test("fingerprint: chapter / family / unit each discriminate identity", () => {
  const base = FP(2);
  assert.notEqual(FP(3), base, "a different chapter is a different fingerprint");
  assert.notEqual(FP(2, { family: "location_stamping" }), base, "a different family is a different fingerprint");
  assert.notEqual(FP(2, { unitId: "v" }), base, "a different unit is a different fingerprint");
});

test("fingerprint: missing content hash for the chapter yields null (cannot bind the bytes read)", () => {
  assert.equal(sweepDefectFingerprintV2({ bookId: BOOK, contentHashes: HASHES }, { family: "persona_drift", unitId: "u", quote: "Genevieve" }, 9), null);
  assert.equal(sweepDefectFingerprintV2({ bookId: BOOK, contentHashes: {} }, { family: "persona_drift", unitId: "u", quote: "Genevieve" }, 2), null);
});

test("fingerprint: the v1 key separated what v2 unites — different problem wording => different v1 key, SAME v2 fingerprint", () => {
  const recBase = { bookId: BOOK, contentHashes: HASHES };
  const findingA = { family: "persona_drift" as const, severity: "blocker" as const, chapters: [2], unitId: "u", quote: "Genevieve", problem: "reused name across scenes", expectedFix: "f" };
  const findingB = { ...findingA, problem: "the same character keeps reappearing" };
  assert.notEqual(sweepDefectKey(recBase, findingA), sweepDefectKey(recBase, findingB), "v1 key folds the problem prose → two wordings diverge");
  assert.equal(sweepDefectFingerprintV2(recBase, findingA, 2), sweepDefectFingerprintV2(recBase, findingB, 2), "v2 fingerprint excludes the prose → two wordings unite");
});

// ── 2. Per-chapter corroboration through the shared evaluator (sweepChapterStatus) ───────────

test("corroboration: same family/unit/quote/chapter with DIFFERENT problem wording corroborates and BLOCKS", () => {
  const cur = rec({ findings: [{ family: "persona_drift", chapters: [2], quote: "Genevieve", problem: "reused name across scenes" }] });
  const prior = priorRound([{ family: "persona_drift", chapters: [2], quote: "Genevieve", problem: "the same character keeps reappearing" }]);
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, prior), "FAIL", "two reads on the same defect, worded differently, still corroborate");
});

test("corroboration: chapter sets [1,2,3] vs [2,3,4] corroborate ONLY on the shared chapters 2 and 3", () => {
  const cur = rec({ findings: [{ family: "persona_drift", chapters: [1, 2, 3], quote: "Genevieve" }] });
  const prior = priorRound([{ family: "persona_drift", chapters: [2, 3, 4], quote: "Genevieve" }]);
  assert.equal(sweepChapterStatus(cur, 1, "h1", ROUND, prior), "PASS", "ch1 (named only by current) is uncorroborated → demoted");
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, prior), "FAIL", "ch2 is named by both → corroborated → blocks");
  assert.equal(sweepChapterStatus(cur, 3, "h3", ROUND, prior), "FAIL", "ch3 is named by both → corroborated → blocks");
  assert.equal(sweepChapterStatus(cur, 4, "h4", ROUND, prior), "PASS", "ch4 is named only by prior → current never gated it");
});

test("corroboration: same chapter but a MATERIALLY DIFFERENT quote does NOT corroborate (demoted)", () => {
  const cur = rec({ findings: [{ family: "persona_drift", chapters: [2], quote: "Genevieve" }] });
  const prior = priorRound([{ family: "persona_drift", chapters: [2], quote: "Bartholomew" }]);
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, prior), "PASS", "a different quote is a different defect → no corroboration");
});

test("corroboration: same quote but a DIFFERENT family or unit does NOT corroborate (no unrelated same-chapter merge)", () => {
  const cur = rec({ findings: [{ family: "location_stamping", chapters: [2], quote: "the dock" }] });
  const priorFamily = priorRound([{ family: "persona_drift", chapters: [2], quote: "the dock" }]);
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, priorFamily), "PASS", "same quote, different family → unrelated defects must not corroborate");
  const curUnit = rec({ findings: [{ family: "location_stamping", chapters: [2], unitId: "venue.a", quote: "the dock" }] });
  const priorUnit = priorRound([{ family: "location_stamping", chapters: [2], quote: "the dock" }]); // unitId "u"
  assert.equal(sweepChapterStatus(curUnit, 2, "h2", ROUND, priorUnit), "PASS", "same quote, different unit → unrelated defects must not corroborate");
});

test("corroboration: a NON-DISTINCTIVE generic phrase remains non-gating and never becomes a corroborating identity", () => {
  // 'had already' is a tense auxiliary — sweepFindingBlocks filters it before corroboration is even
  // considered, so it neither gates nor can corroborate, even if a prior read named the same phrase.
  const cur = rec({ findings: [{ family: "repeated_unit", chapters: [2, 3], quote: "had already" }] });
  const prior = priorRound([{ family: "repeated_unit", chapters: [2, 3], quote: "had already" }]);
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, prior), "PASS", "a generic phrase cannot prove templating → never gates");
  assert.equal(sweepChapterStatus(cur, 3, "h3", ROUND, prior), "PASS");
});

test("corroboration: a different reviewer LABEL but the SAME reviewerSessionId is NOT independent (cannot self-corroborate)", () => {
  const cur = rec({ reviewerSessionId: "shared-session", reviewer: "codex-qc:sweep", findings: [{ family: "persona_drift", chapters: [2], quote: "Genevieve" }] });
  // Same session id, different human-readable reviewer label, copied into another round.
  const prior = priorRound([{ family: "persona_drift", chapters: [2], quote: "Genevieve" }], "shared-session");
  prior.reviewer = "codex-qc:sweep-rerun";
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, prior), "PASS", "one session relabelled is still one read — not two independent reviewers");
});

test("corroboration: two SEPARATE sessions over UNCHANGED bytes with the same defect BLOCK", () => {
  const cur = rec({ reviewerSessionId: "session-A", findings: [{ family: "persona_drift", chapters: [2], quote: "Genevieve" }] });
  const prior = priorRound([{ family: "persona_drift", chapters: [2], quote: "Genevieve" }], "session-B");
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, prior), "FAIL", "two independent reads agreeing over frozen bytes is a real gate");
});

test("corroboration: CHANGED bytes permit a fresh defect to BLOCK on the FIRST read (no corroboration required)", () => {
  const cur = rec({ findings: [{ family: "persona_drift", chapters: [2], quote: "Genevieve" }] });
  // Prior read chapter 2 at OLD bytes → not frozen-since-prior → the current single read is trusted.
  const prior = priorRound([]);
  prior.contentHashes = { ...HASHES, "2": "h2-OLD" };
  prior.verdict = "PASS";
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, prior), "FAIL", "a gate on freshly-changed content stands on one read");
});

// ── 3. v1 history compatibility + new-record storage (requirements 12 & 13) ──────────────────

const DISK_BOOK = "zz-fixture-sweep-fp-disk";
const QC_ORCHESTRATOR_EXISTED = existsSync(QC_ORCHESTRATOR_DIR);

function diskReset(): void {
  rmSync(sweepHistoryPath(DISK_BOOK), { force: true });
  rmSync(chapterClearsPath(DISK_BOOK), { force: true });
  rmSync(sweepRecordPath(DISK_BOOK), { force: true });
  rmSync(resolve(QC_ORCHESTRATOR_DIR, DISK_BOOK), { recursive: true, force: true });
  if (!QC_ORCHESTRATOR_EXISTED && existsSync(QC_ORCHESTRATOR_DIR) && readdirSync(QC_ORCHESTRATOR_DIR).length === 0) rmdirSync(QC_ORCHESTRATOR_DIR);
}

const DISK_HASHES: Record<string, string> = { "1": "d1", "2": "d2" };
const DISK_FINDING = { family: "persona_drift" as const, severity: "blocker" as const, chapters: [1, 2], unitId: "u", quote: "Genevieve", problem: "p", expectedFix: "f" };

test("compat: a NEW record stores fingerprintVersion + per-chapter v2 fingerprints (on disk too)", () => {
  diskReset();
  try {
    const stored = appendSweepHistory({
      schemaVersion: "sweep-attest-v1",
      bookId: DISK_BOOK,
      roundId: "r1",
      verdict: "REVISE",
      reviewer: "codex-qc:sweep",
      reviewerSessionId: "s1",
      attestedAt: "2026-01-01T00:00:00.000Z",
      contentHashes: DISK_HASHES,
      checkedFamilies: [],
      findings: [DISK_FINDING],
    });
    assert.equal(stored.fingerprintVersion, "sweep-defect-v2", "the record carries the v2 version marker");
    const fps = stored.findings[0].defectFingerprints ?? [];
    assert.deepEqual(fps.map((e) => e.chapter), [1, 2], "one fingerprint per named chapter that has bytes");
    assert.ok(fps.every((e) => e.fingerprint.startsWith("sweep-defect-v2:")), "each entry is a v2 fingerprint");
    const onDisk = JSON.parse(readFileSync(sweepRoundRecordPath(DISK_BOOK, "r1"), "utf8"));
    assert.equal(onDisk.fingerprintVersion, "sweep-defect-v2", "the immutable round record persists the version");
    assert.equal(onDisk.findings[0].defectFingerprints.length, 2, "and the per-chapter fingerprints");
  } finally {
    diskReset();
  }
});

test("compat: a LEGACY v1 record (v1 key, no v2 fields) validates, derives v2 at read, and is NOT rewritten in place", () => {
  diskReset();
  try {
    const legacyDefectKey = sweepDefectKey({ bookId: DISK_BOOK, contentHashes: DISK_HASHES }, DISK_FINDING);
    const legacy = {
      schemaVersion: "sweep-attest-v1",
      bookId: DISK_BOOK,
      roundId: "r-legacy",
      verdict: "REVISE",
      reviewer: "codex-qc:sweep",
      reviewerSessionId: "s-legacy",
      attestedAt: "2026-01-01T00:00:00.000Z",
      contentHashes: DISK_HASHES,
      checkedFamilies: [],
      findings: [{ ...DISK_FINDING, defectKey: legacyDefectKey }], // v1 key present; NO version / fingerprints
    };
    const p = sweepRoundRecordPath(DISK_BOOK, "r-legacy");
    mkdirSync(dirname(p), { recursive: true });
    const legacyBytes = JSON.stringify(legacy, null, 2);
    writeFileSync(p, legacyBytes, "utf8");

    const hist = loadSweepHistory(DISK_BOOK);
    assert.equal(hist.length, 1, "the legacy round record loads");
    assert.equal(hist[0].fingerprintVersion, "sweep-defect-v2", "v2 is derived at read time");
    assert.equal((hist[0].findings[0].defectFingerprints ?? []).length, 2, "per-chapter v2 fingerprints derived from the legacy fields");
    assert.equal(hist[0].findings[0].defectKey, legacyDefectKey, "the stored v1 key still validates and is preserved");
    assert.equal(readFileSync(p, "utf8"), legacyBytes, "the immutable legacy evidence on disk is byte-for-byte untouched");
  } finally {
    diskReset();
  }
});

test("compat: a tampered stored v2 fingerprint is rejected at read (same contract as defectKey)", () => {
  diskReset();
  try {
    const stored = appendSweepHistory({
      schemaVersion: "sweep-attest-v1",
      bookId: DISK_BOOK,
      roundId: "r-tamper",
      verdict: "REVISE",
      reviewer: "codex-qc:sweep",
      reviewerSessionId: "s2",
      attestedAt: "2026-01-01T00:00:00.000Z",
      contentHashes: DISK_HASHES,
      checkedFamilies: [],
      findings: [DISK_FINDING],
    });
    const p = sweepRoundRecordPath(DISK_BOOK, "r-tamper");
    const tampered = JSON.parse(JSON.stringify(stored));
    tampered.findings[0].defectFingerprints[0].fingerprint = "sweep-defect-v2:deadbeefdeadbeefdeadbeef";
    writeFileSync(p, JSON.stringify(tampered, null, 2), "utf8");
    assert.throws(() => loadSweepHistory(DISK_BOOK), /defectFingerprints mismatch/, "a forged per-chapter fingerprint must fail loudly");
  } finally {
    diskReset();
  }
});
