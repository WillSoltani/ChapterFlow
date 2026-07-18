/**
 * IMP-20 WP-B7 — hermetic split-lane role corpus builders (design §§H/I/J).
 *
 * Covers unit tests 30, 31, 32, 33 + the H2 candidate-book exclusion test.
 * The always-run tests are fully hermetic (synthetic specs/ledger written under
 * an OS temp dir; the source builder reads NO book package). Two supporting
 * tests exercise the reader/quiz builders end-to-end against the REAL committed
 * specs + the 140-eval book packages; they are `xenv`-guarded so a bare checkout
 * without the packages skips with a machine-checked reason rather than failing.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

import { test, xenv } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  CorpusBuildError,
  SCHEMA_SCAFFOLD_PLAN_SPEC,
  readMutationSpec,
  readCleanBaseScoreLedger,
} from "../src/bakeoff/migration/corpusBuilderCore.js";
import { buildReaderCorpus, assembleReaderCases } from "../src/bakeoff/migration/readerCorpusBuilder.js";
import { buildQuizCorpus, assembleQuizCases } from "../src/bakeoff/migration/quizCorpusBuilder.js";
import { buildSourceCorpus, classifySourceUnit } from "../src/bakeoff/migration/sourceCorpusBuilder.js";
import type { SplitLaneCorpusConfigV1 } from "../src/bakeoff/migration/reviewLaneTypes.js";

const MIGRATION_SRC = resolve(PIPELINE_DIR, "src", "bakeoff", "migration");
const CONTRACTS_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
const BOOK_PACKAGES_DIR = resolve(PIPELINE_DIR, "..", "..", "..", "..", "book-packages");
const REAL_LEDGER = resolve(CONTRACTS_DIR, "clean-base-score-ledger.v1.json");

function newTmp(prefix: string): string {
  return mkdtempSync(resolve(tmpdir(), prefix));
}

function writeJson(dir: string, name: string, value: unknown): string {
  const p = resolve(dir, name);
  writeFileSync(p, JSON.stringify(value, null, 2));
  return p;
}

const MINIMAL_LEDGER = {
  schema: "clean-base-score-ledger-v1",
  cleanBaseFloor: 87.0,
  cleanBases: [],
};

const SOURCE_GOVERNANCE = {
  definitionsFrozenBeforeLiveOutput: true,
  calibrationVsHoldoutSeparated: true,
  holdoutImmutableOnceLiveQualificationBegins: true,
  noInCampaignInstrumentTreadmill: "terminate + new id",
  independentHumanRater: false,
  sourceCleanStatusNeverInferredFromOverallScore: true,
};

/** A complete, PRESENT source-unit evidence bundle (design H2 "every case must
 *  include …"). Deterministic — no timestamps. */
function presentSourceUnit(slotId: string, family: string, bookId: string): Record<string, unknown> {
  return {
    unitSlotId: slotId,
    family,
    ownerInputRequired: true,
    sourceSemanticsStatus: "PRESENT",
    bookId,
    chapterNumber: 1,
    evidence: {
      chapterUnit: { unitId: `${slotId}-unit`, text: `Chapter prose for ${slotId}.` },
      sourceUsePlanUnit: {
        unitId: `${slotId}-unit`, origin: "source_bound", form: "case", claimStrength: "descriptive",
        anchorIds: [`${slotId}-a1`], allowedDetailTypes: ["documented_specific"], forbiddenDetailTypes: ["invented_dialogue"],
        detailSufficiency: "partial", framingRequired: false,
      },
      sourcePacket: { schemaVersion: "source-packet-v2", bookId, chapterNumber: 1 },
      sidecar: { schemaVersion: "source-v2", testableFacts: [{ id: `${slotId}-f1`, claim: "a documented claim" }] },
      anchorCatalog: [{ id: `${slotId}-a1`, kind: "testable_fact", label: "anchor", text: "supporting text", supportsClaimTypes: ["example"] }],
      expectedOrigin: "source_bound",
      expectedForm: "case",
      claimStrengthExpected: "descriptive",
      allowedDetailTypes: ["documented_specific"],
      forbiddenDetailTypes: ["invented_dialogue"],
      goldChapterEvidenceSpans: ["Chapter prose"],
      goldSourceEvidenceSpans: ["supporting text"],
      provenanceHashes: {
        chapterContentSha256: `sha256:chapter-${slotId}`,
        sourceUsePlanSha256: `sha256:plan-${slotId}`,
        sourcePacketSha256: `sha256:packet-${slotId}`,
        sidecarSha256: `sha256:sidecar-${slotId}`,
      },
    },
  };
}

function syntheticSourceSpec(opts: { units: Array<Record<string, unknown>>; expectedComposition: Record<string, number>; excluded?: string[] }): Record<string, unknown> {
  return {
    schema: "split-lane-corpus-mutation-spec-v1",
    role: "source",
    corpusId: "s16-split-lane-source-corpus-test",
    governance: SOURCE_GOVERNANCE,
    cleanBaseScoreLedger: "clean-base-score-ledger.v1.json",
    minRenderBytes: 8000,
    excludedCandidateBookIds: opts.excluded ?? [],
    expectedComposition: opts.expectedComposition,
    softDenominators: {},
    familyGold: {
      "supported-source-bound": { expectedResult: "PASS", expectedRegister: "clearly_sourced", expectedSupportStatus: "SUPPORTED" },
      "framed-constructed": { expectedResult: "PASS", expectedRegister: "clearly_constructed", expectedSupportStatus: "NOT_APPLICABLE" },
    },
    units: opts.units,
  };
}

function sourceConfig(mutationSpecPath: string, cleanBaseScoreLedgerPath: string, excluded: string[] = []): SplitLaneCorpusConfigV1 {
  return {
    schema: "split-lane-corpus-builder-config-v1",
    role: "source",
    sourceRoots: { bookPackagesDir: BOOK_PACKAGES_DIR },
    mutationSpecPath,
    cleanBaseScoreLedgerPath,
    excludedCandidateBookIds: excluded,
    minRenderBytes: 8000,
  };
}

// ── Test 30 — a missing mutation spec FAILS CLOSED (never a silent []) ─────────

test("30: every role builder fails closed when the mutation spec is missing", () => {
  const tmp = newTmp("cf-b7-30-");
  const ledgerPath = writeJson(tmp, "ledger.json", MINIMAL_LEDGER);
  const missingSpec = resolve(tmp, "does-not-exist.json");

  for (const role of ["reader", "source", "quiz"] as const) {
    const config: SplitLaneCorpusConfigV1 = {
      schema: "split-lane-corpus-builder-config-v1",
      role,
      sourceRoots: { bookPackagesDir: BOOK_PACKAGES_DIR },
      mutationSpecPath: missingSpec,
      cleanBaseScoreLedgerPath: ledgerPath,
      excludedCandidateBookIds: [],
      minRenderBytes: 8000,
    };
    const build = role === "reader" ? () => buildReaderCorpus(config) : role === "source" ? () => buildSourceCorpus(config) : () => buildQuizCorpus(config);
    assert.throws(build, (e: unknown) => e instanceof CorpusBuildError && /mutation spec missing/i.test((e as Error).message), `${role} builder must fail closed on a missing spec`);
  }

  // A missing score ledger also fails closed (a source spec is present here).
  const specPath = writeJson(tmp, "source-spec.json", syntheticSourceSpec({ units: [], expectedComposition: { total: 1 } }));
  assert.throws(
    () => buildSourceCorpus(sourceConfig(specPath, resolve(tmp, "no-ledger.json"))),
    (e: unknown) => e instanceof CorpusBuildError && /score ledger missing/i.test((e as Error).message),
    "a missing score ledger must fail closed",
  );
});

// ── Test 31 — no absolute user/temp path in any migration builder source ───────

test("31: no migration source hardcodes an absolute user or temp path", () => {
  const files = readdirSync(MIGRATION_SRC).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 4, "migration module family present");
  for (const f of files) {
    const text = readFileSync(resolve(MIGRATION_SRC, f), "utf8");
    assert.ok(!/\/Users\//.test(text), `${f} must not hardcode an absolute /Users/ path (roots are injected)`);
    assert.ok(!/\/private\/tmp\//.test(text), `${f} must not hardcode an absolute /private/tmp/ path`);
    assert.ok(!text.includes("process.env"), `${f} must not read ambient process.env`);
  }
});

// ── Test 32 — the source corpus build is byte-reproducible ─────────────────────

test("32: source corpus build is byte-reproducible (identical config → identical bytes)", () => {
  const tmp = newTmp("cf-b7-32-");
  const ledgerPath = writeJson(tmp, "ledger.json", MINIMAL_LEDGER);
  const spec = syntheticSourceSpec({
    units: [
      presentSourceUnit("SRC-SB-01", "supported-source-bound", "held-out-book-a"),
      presentSourceUnit("SRC-SB-02", "supported-source-bound", "held-out-book-b"),
      presentSourceUnit("SRC-FC-01", "framed-constructed", "held-out-book-c"),
    ],
    expectedComposition: { "supported-source-bound": 2, "framed-constructed": 1, total: 3 },
  });
  const specPath = writeJson(tmp, "source-spec.json", spec);
  const config = sourceConfig(specPath, ledgerPath);

  const a = buildSourceCorpus(config);
  const b = buildSourceCorpus(config);
  assert.equal(a.corpusBytes, b.corpusBytes, "two builds of the same config must produce byte-identical corpus bytes");
  assert.equal(a.provenanceManifest.corpusSha256, b.provenanceManifest.corpusSha256, "corpus sha256 must be stable across builds");
  // The bytes are canonical (recursively key-sorted) and carry no timestamp.
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(a.corpusBytes), "corpus bytes must contain no ISO timestamp");
  assert.equal(a.corpus.cases.length, 3, "all three PRESENT units are built");
  assert.equal(a.corpus.generatedComposition["supported-source-bound"], 2);
});

// ── Test 33 — source semantics are NEVER inferred (from planSpec or otherwise) ─

test("33: source semantics are never inferred — absent semantics → MISSING + excluded", () => {
  // classifySourceUnit derives ONLY from the declared sentinel; it never reads
  // evidence to synthesize an origin/form.
  const pending = { unitSlotId: "SRC-SB-01", family: "supported-source-bound", sourceSemanticsStatus: "OWNER_INPUT_PENDING" };
  assert.equal(classifySourceUnit(pending).status, "MISSING", "OWNER_INPUT_PENDING is MISSING, never PRESENT");
  assert.equal(classifySourceUnit({ unitSlotId: "x", family: "f" }).status, "MISSING", "absent status is MISSING");
  assert.equal(classifySourceUnit({ unitSlotId: "y", family: "supported-source-bound", sourceSemanticsStatus: "PRESENT" }).status, "PRESENT");

  // A whole spec of pending units builds ZERO cases, records each MISSING, and
  // FAILS CLOSED at composition — it never fabricates a planSpec/format.
  const tmp = newTmp("cf-b7-33-");
  const ledgerPath = writeJson(tmp, "ledger.json", MINIMAL_LEDGER);
  const spec = syntheticSourceSpec({
    units: [pending, { unitSlotId: "SRC-FC-01", family: "framed-constructed", sourceSemanticsStatus: "OWNER_INPUT_PENDING" }],
    expectedComposition: { "supported-source-bound": 1, "framed-constructed": 1, total: 2 },
  });
  const specPath = writeJson(tmp, "source-spec.json", spec);
  let thrown: CorpusBuildError | null = null;
  try {
    buildSourceCorpus(sourceConfig(specPath, ledgerPath));
  } catch (e) {
    thrown = e as CorpusBuildError;
  }
  assert.ok(thrown instanceof CorpusBuildError, "an all-pending source spec fails closed, never silently []");
  const excluded = (thrown!.detail.excludedUnits ?? []) as Array<{ sourceSemanticsStatus: string }>;
  assert.equal(excluded.length, 2, "both pending units are recorded excluded");
  assert.ok(excluded.every((u) => u.sourceSemanticsStatus === "MISSING"), "every excluded unit is recorded MISSING (never inferred)");

  // Static: the source builder never READS/WRITES a chapter planSpec (a bare
  // word in a documentation comment is fine; member access / assignment is the
  // E-04 anti-pattern), and the shared schema scaffold format is neutral.
  const srcText = readFileSync(resolve(MIGRATION_SRC, "sourceCorpusBuilder.ts"), "utf8");
  assert.ok(!/\.planSpec\b/.test(srcText), "the source builder must never access a chapter .planSpec for semantics");
  assert.ok(!/\bplanSpec\s*[:=]/.test(srcText), "the source builder must never assign a synthesized planSpec");
  assert.ok(!/"scenario"/.test(srcText), "the source builder must never emit the E-04 'scenario' format literal");
  assert.equal(SCHEMA_SCAFFOLD_PLAN_SPEC.format, "unspecified", "the reader/quiz schema scaffold format is neutral, never 'scenario' (E-04)");
});

// ── H2 — the source builder fails closed on a reserved candidate book ──────────

test("H2: source builder fails closed when a built case uses an excluded candidate book", () => {
  const tmp = newTmp("cf-b7-h2-");
  const ledgerPath = writeJson(tmp, "ledger.json", MINIMAL_LEDGER);
  // One PRESENT unit whose bookId is a diagnostic/confirmatory candidate.
  const spec = syntheticSourceSpec({
    units: [presentSourceUnit("SRC-SB-01", "supported-source-bound", "start-with-why")],
    expectedComposition: { "supported-source-bound": 1, total: 1 },
    excluded: ["start-with-why", "radical-candor"],
  });
  const specPath = writeJson(tmp, "source-spec.json", spec);
  assert.throws(
    () => buildSourceCorpus(sourceConfig(specPath, ledgerPath, ["start-with-why", "radical-candor"])),
    (e: unknown) => e instanceof CorpusBuildError && /reserved candidate book/i.test((e as Error).message) && /H2/.test((e as Error).message),
    "a PRESENT unit on a candidate book must fail closed (H2)",
  );

  // The committed source spec pins exactly the two candidate books (H2).
  if (existsSync(resolve(CONTRACTS_DIR, "source-corpus-spec.json"))) {
    const committed = readMutationSpec(resolve(CONTRACTS_DIR, "source-corpus-spec.json"), "source");
    assert.deepEqual(committed.excludedCandidateBookIds, ["start-with-why", "radical-candor"], "committed source spec pins the two candidate books");
  }
});

// ── Supporting (xenv on the 140-eval packages) — reader/quiz over the real spec ─

function haveReaderInputs(): boolean {
  return existsSync(resolve(CONTRACTS_DIR, "reader-corpus-spec.json")) && existsSync(REAL_LEDGER) &&
    existsSync(resolve(BOOK_PACKAGES_DIR, "difficult-conversations.v21.json")) && existsSync(resolve(BOOK_PACKAGES_DIR, "behave.v21.json"));
}

xenv(
  "reader builder assembles clean+craft from real bases and fails closed on pending owner hard-blockers",
  "requires the committed reader spec, score ledger, and the 140-eval book packages",
  haveReaderInputs,
  () => {
    const ledger = readCleanBaseScoreLedger(REAL_LEDGER);
    const spec = readMutationSpec(resolve(CONTRACTS_DIR, "reader-corpus-spec.json"), "reader");
    const config: SplitLaneCorpusConfigV1 = {
      schema: "split-lane-corpus-builder-config-v1", role: "reader",
      sourceRoots: { bookPackagesDir: BOOK_PACKAGES_DIR },
      mutationSpecPath: resolve(CONTRACTS_DIR, "reader-corpus-spec.json"),
      cleanBaseScoreLedgerPath: REAL_LEDGER,
      excludedCandidateBookIds: [], minRenderBytes: spec.minRenderBytes,
    };
    const asm = assembleReaderCases(spec, config, ledger);
    assert.equal(asm.generated["clean"], 12, "12 clean controls admitted (structural + ledger floor)");
    assert.equal(asm.generated["craft-nonblocker"], 10, "10 builder-minted craft variants");
    assert.equal(asm.pendingOwnerVariants.length, 8, "8 reader-visible hard blockers are owner-authored gold, still pending");
    assert.ok(asm.cases.every((c) => c.sourceSemanticsStatus === "MISSING"), "reader cases never carry source semantics");
    // FAIL CLOSED rather than shrink (owner hard-blocker gold pending) — no silent [].
    assert.throws(() => buildReaderCorpus(config), (e: unknown) => e instanceof CorpusBuildError && /fails closed rather than shrink/i.test((e as Error).message));
  },
);

function haveQuizInputs(): boolean {
  return existsSync(resolve(CONTRACTS_DIR, "quiz-corpus-spec.json")) && existsSync(REAL_LEDGER) &&
    existsSync(resolve(BOOK_PACKAGES_DIR, "difficult-conversations.v21.json"));
}

xenv(
  "quiz builder mints deterministic key-mismatches and fails closed on pending owner ambiguity/mechanism gold",
  "requires the committed quiz spec, score ledger, and the 140-eval book packages",
  haveQuizInputs,
  () => {
    const ledger = readCleanBaseScoreLedger(REAL_LEDGER);
    const spec = readMutationSpec(resolve(CONTRACTS_DIR, "quiz-corpus-spec.json"), "quiz");
    const config: SplitLaneCorpusConfigV1 = {
      schema: "split-lane-corpus-builder-config-v1", role: "quiz",
      sourceRoots: { bookPackagesDir: BOOK_PACKAGES_DIR },
      mutationSpecPath: resolve(CONTRACTS_DIR, "quiz-corpus-spec.json"),
      cleanBaseScoreLedgerPath: REAL_LEDGER,
      excludedCandidateBookIds: [], minRenderBytes: spec.minRenderBytes,
    };
    const asm = assembleQuizCases(spec, config, ledger);
    assert.equal(asm.generated["uniquely-correct-clean"], 10, "10 clean quiz controls");
    assert.equal(asm.generated["key-mismatch"], 10, "10 builder-minted key-mismatch variants");
    assert.equal(asm.pendingOwnerVariants.length, 20, "20 owner-authored ambiguity/mechanism variants pending");
    for (const c of asm.cases.filter((k) => k.kind === "key-mismatch")) {
      const d = c.provenance.keyMismatchDetail!;
      assert.notEqual(d.mutatedCorrectIndex, d.originalCorrectIndex, "a minted key-mismatch is a genuine wrong key");
    }
    assert.throws(() => buildQuizCorpus(config), (e: unknown) => e instanceof CorpusBuildError && /fails closed rather than shrink/i.test((e as Error).message));
  },
);
