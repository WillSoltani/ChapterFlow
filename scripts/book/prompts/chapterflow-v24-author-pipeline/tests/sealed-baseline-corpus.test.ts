/**
 * WP-303 (+701a) — the sealed-baseline packet (L-25 Phase-3 re-slice folded
 * WP-701's model-free parts into WP-303; the LIVE compile-chain corpus freeze
 * stays deferred to Phase 6).
 *
 * `tests/fixtures/sealed-baseline-corpus.v1.json` is the single frozen,
 * hash-pinned pointer map from the three fixed bakeoff-corpus units to the
 * owner-audited D7 calibration run (docs/v25/rubric-audit-2026-07-15/, sealed
 * 20260715T110908Z) and to their published chapter content (book-packages/).
 * It NEVER copies retained evidence bytes — every entry is a relPath + sha256
 * pointer, exactly the WP-701 "reference, don't copy" convention. This suite
 * proves: (1) every pin matches the retained bytes on disk right now; (2) the
 * packet's diagnostic numbers are byte-identical to the arithmetic single
 * source of truth (RUBRIC_CALIBRATION_REFERENCES in rubricAuditInstrument.ts)
 * — this file adds pointers that instrument does not carry, it never forks a
 * second copy of the numbers; (3) the D7 harness machinery
 * (rubricAuditInstrument's batch builder + auditPackageAssembler) can
 * assemble a structurally sound, APP-FAITHFUL audit package straight from
 * these sealed units with ZERO model or API calls.
 */

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR } from "./helpers.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import { chapterFileName } from "../src/lib/chapterPaths.js";
import { assembleAuditPackage } from "../src/bakeoff/auditPackageAssembler.js";
import {
  RUBRIC_AUDIT_BAR_D7,
  RUBRIC_CALIBRATION_REFERENCES,
  RUBRIC_OWNER_RUN_ID,
  RUBRIC_OWNER_RUN_REL_PATH,
  buildRubricAuditBatch,
  materializeRubricAuditBatch,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import type { ChapterV21 } from "../src/types.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const FIXTURE_PATH = resolve(
  PIPELINE_DIR, "tests/fixtures/sealed-baseline-corpus.v1.json");

type SealedUnit = {
  unit: string;
  bookId: string;
  chapterNumber: number;
  chapterTitle: string;
  readerDocRelPath: string;
  readerDocSha256: string;
  sealedAdjudicatedRecordRelPath: string;
  sealedAdjudicatedRecordSha256: string;
  sealedChapterDiagnostic: number;
  publishedPackageRelPath: string;
  publishedPackageSha256: string;
};

type SealedBaselineCorpus = {
  schema: string;
  purpose: string;
  ownerRunId: string;
  ownerRunRelPath: string;
  units: SealedUnit[];
};

function loadFixture(): SealedBaselineCorpus {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as SealedBaselineCorpus;
}

function loadPublishedChapter(unit: SealedUnit): ChapterV21 {
  const pkg = JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, unit.publishedPackageRelPath), "utf8")) as {
    chapters: ChapterV21[];
  };
  const chapter = pkg.chapters.find((c) => c.number === unit.chapterNumber);
  assert.ok(chapter, `${unit.unit}: chapter ${unit.chapterNumber} missing from ${unit.publishedPackageRelPath}`);
  return chapter as ChapterV21;
}

/**
 * buildRubricAuditBatch expects the `{book:{slug|id}, chapters:[...]}` shape
 * (its OWN package convention) and resolves the calibration reference doc
 * relative to `repositoryRoot` — neither matches the real shipped
 * book-packages/*.v21.json shape (`book.bookId`) used at the real repo root
 * directly. Materialize a disposable temp repo carrying (a) the REAL, sealed,
 * hash-verified anchor chapter re-wrapped in the harness's own package shape
 * and (b) a byte-identical copy of the retained calibration reader-doc at the
 * same relative path, so the harness call below is genuine (real content,
 * real hash chain) without asking buildRubricAuditBatch to read a shape it
 * was never contracted to accept.
 */
function materializeAnchorRepo(unit: SealedUnit, chapter: ChapterV21): { roots: ReturnType<typeof mkTestRoots>; packageRelPath: string } {
  const roots = mkTestRoots("wp303-sealed-baseline-harness");
  const calibrationRef = RUBRIC_CALIBRATION_REFERENCES.find((r) => r.unit === unit.unit)!;
  const calibrationBytes = readFileSync(resolve(REPOSITORY_ROOT, calibrationRef.docRelPath));
  const calibrationAbs = resolve(roots.base, calibrationRef.docRelPath);
  mkdirSync(resolve(calibrationAbs, ".."), { recursive: true });
  writeFileSync(calibrationAbs, calibrationBytes);

  const packageRelPath = `book-packages/${unit.bookId}.v21.json`;
  const packageAbs = resolve(roots.base, packageRelPath);
  mkdirSync(resolve(packageAbs, ".."), { recursive: true });
  writeFileSync(packageAbs, JSON.stringify({ book: { slug: unit.bookId }, chapters: [chapter] }));
  return { roots, packageRelPath };
}

const EXPECTED_UNITS = ["nudge-ch03", "the-happiness-hypothesis-ch06", "made-to-stick-ch04"];
const ALLOWED_UNIT_KEYS = new Set([
  "unit", "bookId", "chapterNumber", "chapterTitle",
  "readerDocRelPath", "readerDocSha256",
  "sealedAdjudicatedRecordRelPath", "sealedAdjudicatedRecordSha256",
  "sealedChapterDiagnostic",
  "publishedPackageRelPath", "publishedPackageSha256",
]);

// ── Structure + no-copied-evidence guard ──────────────────────────────────────

test("sealed-baseline-corpus fixture lists exactly the 3 frozen bakeoff-corpus units", () => {
  const fixture = loadFixture();
  assert.equal(fixture.schema, "sealed-baseline-corpus-v1");
  assert.equal(fixture.ownerRunId, RUBRIC_OWNER_RUN_ID);
  assert.equal(fixture.ownerRunRelPath, RUBRIC_OWNER_RUN_REL_PATH);
  assert.equal(fixture.units.length, 3);
  assert.deepEqual(fixture.units.map((u) => u.unit).sort(), [...EXPECTED_UNITS].sort());
});

test("the packet carries ONLY relPath+hash pointers — no retained evidence bytes copied in", () => {
  const fixture = loadFixture();
  for (const unit of fixture.units) {
    const keys = new Set(Object.keys(unit));
    assert.equal(keys.size, ALLOWED_UNIT_KEYS.size, `${unit.unit}: unexpected field count`);
    for (const key of keys) assert.ok(ALLOWED_UNIT_KEYS.has(key), `${unit.unit}: unexpected field '${key}'`);
    for (const hashField of ["readerDocSha256", "sealedAdjudicatedRecordSha256", "publishedPackageSha256"] as const) {
      assert.match(unit[hashField], /^[0-9a-f]{64}$/, `${unit.unit}.${hashField} must be a sha256 hex digest, not inline content`);
    }
  }
});

// ── Fixture-integrity: every pin matches the retained bytes on disk NOW ──────

test("fixture integrity: every hash pin matches the retained artifact bytes on disk", () => {
  const fixture = loadFixture();
  for (const unit of fixture.units) {
    const readerDocBytes = readFileSync(resolve(REPOSITORY_ROOT, unit.readerDocRelPath));
    assert.equal(sha256Hex(readerDocBytes), unit.readerDocSha256,
      `${unit.unit}: reader doc drifted from the sealed pin — re-seal required, never silently update`);

    const adjudicatedBytes = readFileSync(resolve(REPOSITORY_ROOT, unit.sealedAdjudicatedRecordRelPath));
    assert.equal(sha256Hex(adjudicatedBytes), unit.sealedAdjudicatedRecordSha256,
      `${unit.unit}: sealed adjudicated record drifted from the sealed pin`);

    const packageBytes = readFileSync(resolve(REPOSITORY_ROOT, unit.publishedPackageRelPath));
    assert.equal(sha256Hex(packageBytes), unit.publishedPackageSha256,
      `${unit.unit}: published package drifted from the sealed pin`);
  }
});

test("fixture integrity has teeth: a one-byte drift on any retained path would fail the pin", () => {
  const fixture = loadFixture();
  const unit = fixture.units[0];
  const realBytes = readFileSync(resolve(REPOSITORY_ROOT, unit.readerDocRelPath));
  const driftedHash = sha256Hex(Buffer.concat([realBytes, Buffer.from(" ")]));
  assert.notEqual(driftedHash, unit.readerDocSha256, "the hash pin must react to a single appended byte");
});

// ── Cross-validation: no second, drift-prone copy of the diagnostic numbers ──

test("sealedChapterDiagnostic is byte-identical to the instrument's RUBRIC_CALIBRATION_REFERENCES (single source of truth)", () => {
  const fixture = loadFixture();
  assert.equal(fixture.units.length, RUBRIC_CALIBRATION_REFERENCES.length);
  for (const unit of fixture.units) {
    const reference = RUBRIC_CALIBRATION_REFERENCES.find((r) => r.unit === unit.unit);
    assert.ok(reference, `${unit.unit}: no matching RUBRIC_CALIBRATION_REFERENCES entry`);
    assert.equal(unit.sealedChapterDiagnostic, reference!.expectedChapterDiagnostic,
      `${unit.unit}: fixture diagnostic must be the SAME number as the instrument's calibration reference, never a re-typed copy`);
    assert.equal(unit.readerDocRelPath, reference!.docRelPath);
    assert.equal(unit.readerDocSha256, reference!.docSha256);
  }
});

// ── Model-free harness assembly (WP-303 item 3) ───────────────────────────────

test("buildRubricAuditBatch assembles a structurally sound, app-faithful package from each sealed unit — zero model calls", () => {
  const fixture = loadFixture();
  for (const unit of fixture.units) {
    const chapterObj = loadPublishedChapter(unit);
    const { roots, packageRelPath } = materializeAnchorRepo(unit, chapterObj);
    try {
      const built = buildRubricAuditBatch({
        repositoryRoot: roots.base,
        auditId: `wp303-model-free-check-${unit.unit}`,
        purpose: "WP-303 (+701a) model-free harness-assembly check",
        packagePath: packageRelPath,
        chapterNumbers: [unit.chapterNumber],
        calibrationUnit: unit.unit,
      });
      assert.equal(built.manifest.chapters.length, 1);
      const chapter = built.manifest.chapters[0];
      assert.equal(chapter.unit, unit.unit);
      assert.equal(chapter.bookId, unit.bookId);
      assert.equal(chapter.chapterNumber, unit.chapterNumber);
      assert.match(chapter.docSha256, /^[0-9a-f]{64}$/);
      assert.equal(built.manifest.bar.meanMin, RUBRIC_AUDIT_BAR_D7.meanMin);
      assert.equal(built.manifest.calibration.unit, unit.unit);
      assert.equal(built.manifest.calibration.expectedChapterDiagnostic, unit.sealedChapterDiagnostic);

      const document = built.documents.get(chapter.docRelPath);
      assert.ok(document, "the assembled audit document must be present");
      const answerLines = document!.split("\n").filter((line) => line.startsWith("Answer: ")).length;
      assert.equal(answerLines, chapterObj.quiz.questions.length,
        "the assembled package renders the FULL app-faithful key surface (never key-stripped)");
    } finally {
      roots.dispose();
    }
  }
});

test("materializeRubricAuditBatch reports zero model/API calls and writes nothing without write:true", () => {
  const fixture = loadFixture();
  const unit = fixture.units[0];
  const chapterObj = loadPublishedChapter(unit);
  const { roots, packageRelPath } = materializeAnchorRepo(unit, chapterObj);
  try {
    const result = materializeRubricAuditBatch({
      repositoryRoot: roots.base,
      auditId: `wp303-model-free-materialize-check-${unit.unit}`,
      purpose: "WP-303 (+701a) model-free harness-assembly check (materialize, no write)",
      packagePath: packageRelPath,
      chapterNumbers: [unit.chapterNumber],
      calibrationUnit: unit.unit,
    });
    assert.equal(result.modelCalls, 0);
    assert.equal(result.apiCalls, 0);
    assert.equal(result.written, false, "no write:true was requested — nothing should land on disk");
    assert.equal(result.chapterCount, 1);
  } finally {
    roots.dispose();
  }
});

test("auditPackageAssembler.assembleAuditPackage builds the same structural shape from canonical-file state — zero model calls", () => {
  const fixture = loadFixture();
  const unit = fixture.units[0];
  const chapter = loadPublishedChapter(unit);
  const roots = mkTestRoots("wp303-audit-assembler");
  try {
    const chaptersDir = resolve(roots.base, "chapters");
    mkdirSync(chaptersDir, { recursive: true });
    const chapterId = `${unit.bookId}-ch${String(unit.chapterNumber).padStart(2, "0")}`;
    writeFileSync(resolve(chaptersDir, chapterFileName(chapterId)), JSON.stringify({ ...chapter, chapterId }));

    const assembled = assembleAuditPackage({ bookId: unit.bookId, chaptersDir });
    assert.equal(assembled.book.id, unit.bookId);
    assert.equal(assembled.chapters.length, 1);
    assert.equal(assembled.chapters[0].number, unit.chapterNumber);
    assert.equal(assembled.chapters[0].hook, chapter.hook);
    assert.ok(assembled.chapters[0].quiz.questions.length > 0);
    for (const question of assembled.chapters[0].quiz.questions) {
      assert.ok(Number.isInteger(question.correctIndex), "assembled quiz keys survive intact — never stripped");
    }
  } finally {
    roots.dispose();
  }
});
