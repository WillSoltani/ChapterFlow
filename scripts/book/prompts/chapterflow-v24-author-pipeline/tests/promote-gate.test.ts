/**
 * Promote-path enforcement: the AS5–AS12 intra-book suite must run AT PROMOTE,
 * not only in gate-chapter. Until Phase 1 it didn't (verified 2026-06-09) —
 * the identical-card-backs incident class passed promote cleanly.
 *
 * Uses a zz-fixture book written into the REAL state/chapters (promoteBook's
 * state dir is not injectable); everything is cleaned up in finally.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { promoteBook, stripInternalFields, productionManifestSidecarPath } from "../src/promoteBook.js";
import { attestationPath, chapterContentHash, writeAttestation } from "../src/critics/qcAttestation.js";
import { loadChapterIndex } from "../src/generateBook.js";
import { verifyProductionPackage } from "../src/verifyProductionPackage.js";
import { hostname as osHostname } from "os";
import { test } from "./harness.js";
import { makeChapter, makeGateCleanChapter, makeSourceV2SidecarFixture, PIPELINE_DIR, runCli, STATE_CHAPTERS, writeFixtureBook, writeResearchRunManifestFixture, writeVerifiedSourceVerifyRecord } from "./helpers.js";
import {
  currentMajorFindings,
  MAJOR_WAIVER_FILE_SCHEMA_VERSION,
  MAJOR_WAIVER_RECORD_SCHEMA_VERSION,
  waiverPath,
} from "../src/qc/majorDisposition.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";
import { firstMachineryExampleTag, isMachineryExampleTag } from "../src/lib/readerContent.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import { RUBRIC_AUDIT_BAR_D7 } from "../src/bakeoff/migration/rubricAuditInstrument.js";
import {
  CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV,
  D7_REAUTHOR_BUDGET_PER_AUDIT,
  d7ShipGateHaltPath,
  d7ShipGateReceiptPath,
  deriveCurrentD7Content,
  sealD7ShipGateReceipt,
  type D7ShipGateCustody,
  type D7ShipGateReceiptV1,
  type D7ShipGateVerdict,
} from "../src/critics/d7ShipGate.js";
import type { ChapterV21 } from "../src/types.js";

const BOOK = "zz-fixture-promote";
const MAJOR_BOOK = "zz-fixture-promote-major-clean";
const SUBSET_BOOK = "zz-fixture-promote-subset";

function cleanupFixture(): void {
  for (const f of readdirSync(STATE_CHAPTERS)) {
    if (f.startsWith(`${BOOK}-ch`) || f.startsWith(`${MAJOR_BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
  }
  const booksDir = resolve(PIPELINE_DIR, "state", "books");
  rmSync(resolve(booksDir, `${BOOK}.gate.json`), { force: true });
  rmSync(resolve(booksDir, `${MAJOR_BOOK}.gate.json`), { force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "indexes", `${BOOK}.json`), { force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "indexes", `${MAJOR_BOOK}.json`), { force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "briefs", `${MAJOR_BOOK}.manual-brief.json`), { force: true });
  rmSync(waiverPath(MAJOR_BOOK), { force: true });
  rmSync(productionPackagePath(MAJOR_BOOK), { force: true });
  rmSync(productionManifestSidecarPath(MAJOR_BOOK), { force: true });
  rmSync(sourceVerifyRecordPath(BOOK), { force: true });
  rmSync(sourceVerifyRecordPath(MAJOR_BOOK), { force: true });
  const d7BooksDir = resolve(PIPELINE_DIR, "state", "books");
  rmSync(d7ShipGateReceiptPath(MAJOR_BOOK, d7BooksDir), { force: true });
  rmSync(d7ShipGateHaltPath(MAJOR_BOOK, d7BooksDir), { force: true });
  rmSync(productionManifestSidecarPath(BOOK), { force: true });
  // Remove the WHOLE fixture research-run dir, not just the one runId subdir — the
  // synthetic fixtures create `.chapterflow/runs/<fixtureBook>/` from scratch (unlike
  // the old `drive` clone, whose parent dir pre-existed), so leaving the empty parent
  // behind is a fixture leak.
  rmSync(resolve(PIPELINE_DIR, ".chapterflow/runs", MAJOR_BOOK), { recursive: true, force: true });
  rmSync(resolve(PIPELINE_DIR, ".chapterflow/runs", BOOK), { recursive: true, force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "books", "_transactions"), { recursive: true, force: true });
  for (const n of Array.from({ length: 20 }, (_, i) => i + 1)) {
    rmSync(attestationPath(MAJOR_BOOK, n), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "plans", `${MAJOR_BOOK}-ch${String(n).padStart(2, "0")}.manual-plan.json`), { force: true });
  }
  const blocked = resolve(booksDir, "_blocked");
  try {
    for (const f of readdirSync(blocked)) {
      if (f.startsWith(`${BOOK}.`) || f.startsWith(`${MAJOR_BOOK}.`)) rmSync(resolve(blocked, f), { force: true });
    }
  } catch {}
}

function writeFixtureIndex(bookId: string, chapters: Array<{ chapterId: string; number: number; title: string }>): void {
  const indexPath = resolve(PIPELINE_DIR, "state", "indexes", `${bookId}.json`);
  mkdirSync(resolve(PIPELINE_DIR, "state", "indexes"), { recursive: true });
  writeFileSync(
    indexPath,
    JSON.stringify(chapters.map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title })), null, 2),
    "utf8",
  );
}

function snapshotFile(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function restoreFile(path: string, snapshot: string | null): void {
  if (snapshot === null) rmSync(path, { force: true });
  else writeFileSync(path, snapshot, "utf8");
}

function productionPackagePath(bookId: string): string {
  return resolve(PIPELINE_DIR, "book-packages", `${bookId}.v21.json`);
}

function gateReportPath(bookId: string): string {
  return resolve(PIPELINE_DIR, "state", "books", `${bookId}.gate.json`);
}

function ensureFixtureProductionPackage(bookId: string, title: string, author: string): boolean {
  const path = productionPackagePath(bookId);
  if (existsSync(path)) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ schemaVersion: "chapterflow-book-v21", book: { bookId, title, author }, chapters: [] }, null, 2) + "\n", "utf8");
  return true;
}

function blockedReports(bookId: string): string[] {
  const dir = resolve(PIPELINE_DIR, "state", "books", "_blocked");
  try {
    return readdirSync(dir).filter((f) => f.startsWith(`${bookId}.`));
  } catch {
    return [];
  }
}

function sourceRunDir(bookId: string, runId: string): string {
  return resolve(PIPELINE_DIR, ".chapterflow/runs", bookId, runId);
}

/** Remove EVERY `zz-test*` source-run dir for a book, not just one pid-suffixed runId. These run
 *  dirs are written under `.chapterflow/runs/<bookId>/zz-test-...-<pid>` and an interrupted test
 *  leaks them; a leftover `drive` source sidecar then makes a LATER run's generate-book cache key
 *  include source evidence the manifest cannot reproduce (a cross-run flaky failure). Clearing all
 *  test-run dirs (at setup AND teardown) makes the suite order-independent. */
function cleanupTestSourceRuns(bookId: string): void {
  const root = resolve(PIPELINE_DIR, ".chapterflow/runs", bookId);
  try {
    for (const d of readdirSync(root)) {
      if (d.startsWith("zz-test")) rmSync(resolve(root, d), { recursive: true, force: true });
    }
  } catch { /* dir absent — nothing to clean */ }
}

function chapterStatePath(chapterId: string): string {
  return resolve(STATE_CHAPTERS, `${chapterId}.v21-native.chapter.json`);
}

function sourceAnchorId(chapterNumber: number, kind: "fact" | "ex" | "concept", index = 1): string {
  const nn = String(chapterNumber).padStart(2, "0");
  if (kind === "concept") return `ch${nn}.concept.intake-checkpoint`;
  return `ch${nn}.${kind}.${index}`;
}

function sourceSpecifics(text: string): string[] {
  const stop = new Set("about above after again against also because before below between chapter could every first from have into more must only other should their there these those through under where which while with would your".split(" "));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []) {
    const clean = word.replace(/^'+|'+$/g, "");
    if (clean.length < 4 || stop.has(clean) || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 3) break;
  }
  return out.length >= 2 ? out : ["source", "fixture"];
}

function applySourceProvenance(chapter: any): any {
  const chapterNumber = chapter.number;
  const nn = String(chapterNumber).padStart(2, "0");
  const factIds = Array.from({ length: 9 }, (_, i) => sourceAnchorId(chapterNumber, "fact", i + 1));
  const effectiveAnchors: Record<string, string[]> = {
    hook: [factIds[0]],
    counterintuition: [factIds[0]],
    "breakdown.fastRead": [factIds[0]],
    "breakdown.deepRead": [factIds[1]],
    "breakdown.fullRead": [factIds[2]],
    keyTakeaway: [factIds[3]],
    tryThisNow: [factIds[4]],
    "implementationPlan.title": [factIds[4]],
    "implementationPlan.coreSkill": [factIds[4]],
    "implementationPlan.twentyFourHourChallenge": [factIds[4]],
    "implementationPlan.weeklyPractice": [factIds[4]],
  };

  chapter.hookSourceAnchorIds = [factIds[0]];
  chapter.counterintuitionSourceAnchorIds = [factIds[0]];
  chapter.keyTakeawaySourceAnchorIds = [factIds[3]];
  chapter.tryThisNowSourceAnchorIds = [factIds[4]];
  chapter.examples?.forEach((example: any, i: number) => {
    const id = sourceAnchorId(chapterNumber, "ex", i + 1);
    example.sourceAnchorId = id;
    example.sourceAnchorIds = [id];
    effectiveAnchors[`examples[${i}]`] = [id];
  });
  chapter.quiz?.questions?.forEach((question: any, i: number) => {
    const id = factIds[i % factIds.length];
    question.sourceAnchorId = id;
    effectiveAnchors[`quiz.questions[${i}]`] = [id];
    effectiveAnchors[`quiz.questions[${i}].keyEvidence`] = [id];
  });
  chapter.reviewCards?.forEach((card: any, i: number) => {
    const id = factIds[(i + 3) % factIds.length];
    card.sourceAnchorId = id;
    card.sourceAnchorIds = [id];
    effectiveAnchors[`reviewCards[${i}]`] = [id];
  });
  if (chapter.implementationPlan) {
    chapter.implementationPlan.titleSourceAnchorIds = [factIds[4]];
    chapter.implementationPlan.coreSkillSourceAnchorIds = [factIds[4]];
    chapter.implementationPlan.twentyFourHourChallengeSourceAnchorIds = [factIds[4]];
    chapter.implementationPlan.weeklyPracticeSourceAnchorIds = [factIds[4]];
    chapter.implementationPlan.ifThenPlans?.forEach((item: any, i: number) => {
      const id = factIds[(i + 4) % factIds.length];
      item.sourceAnchorId = id;
      item.sourceAnchorIds = [id];
      effectiveAnchors[`implementationPlan.ifThenPlans[${i}]`] = [id];
    });
  }
  chapter.memorableLines?.forEach((line: any, i: number) => {
    const id = factIds[i % factIds.length];
    line.sourceAnchorIds = [id];
    effectiveAnchors[`memorableLines[${i}]`] = [id];
  });
  chapter.authoring = {
    ...(chapter.authoring ?? {}),
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: `fixture-source-${chapter.chapterId}`,
      observedAnchorIds: [
        sourceAnchorId(chapterNumber, "concept"),
        ...Array.from({ length: chapter.examples?.length ?? 0 }, (_, i) => sourceAnchorId(chapterNumber, "ex", i + 1)),
        ...factIds,
      ],
      effectiveAnchors,
    },
  };
  if (!chapter.authoring.sourceAnchors.observedAnchorIds.includes(`ch${nn}.concept.intake-checkpoint`)) {
    throw new Error("source provenance fixture failed to build concept anchor");
  }
  return chapter;
}

function sourceSidecarForChapter(chapter: any, chapterTitle: string): any {
  const base = makeSourceV2SidecarFixture({ chapterNumber: chapter.number, chapterTitle });
  base.namedExamples = (chapter.examples ?? []).map((example: any, i: number) => {
    const text = [example.title, example.scenario, example.whatToDo, example.whyItMatters].filter(Boolean).join(" ");
    const specifics = sourceSpecifics(text);
    return {
      id: sourceAnchorId(chapter.number, "ex", i + 1),
      label: String(example.title ?? `Chapter ${chapter.number} sourced example ${i + 1}`),
      summary: `${String(example.scenario ?? "").slice(0, 260)} ${specifics.join(" ")}.`,
      teachesWhat: String(example.whyItMatters ?? "Use the chapter's concrete source example."),
      hardSpecifics: specifics,
      realWorld: false,
    };
  });
  base.testableFacts = base.testableFacts.map((fact: any) => ({
    ...fact,
    derivedFrom: sourceAnchorId(chapter.number, "concept"),
  }));
  base.paraphraseNotes = `${chapterTitle} source fixture names ${base.namedExamples.map((ex: any) => ex.hardSpecifics.slice(0, 2).join(" ")).join("; ")}.`;
  return base;
}

function writeSourceSidecars(bookId: string, chapters: Array<{ chapterNumber: number; chapterId: string; chapterTitle?: string; title?: string }>, runId: string): void {
  writeResearchRunManifestFixture({
    runDir: sourceRunDir(bookId, runId),
    bookId,
    chapters: chapters.map((spec) => ({ number: spec.chapterNumber, title: spec.chapterTitle ?? spec.title ?? spec.chapterId })),
  });
  const dir = resolve(sourceRunDir(bookId, runId), "sidecars", "source");
  mkdirSync(dir, { recursive: true });
  for (const spec of chapters) {
    const chapterPath = chapterStatePath(spec.chapterId);
    const chapter = applySourceProvenance(JSON.parse(readFileSync(chapterPath, "utf8")));
    writeFileSync(chapterPath, `${JSON.stringify(chapter, null, 2)}\n`, "utf8");
    writeFileSync(
      resolve(dir, `ch${String(spec.chapterNumber).padStart(2, "0")}.source.json`),
      `${JSON.stringify(sourceSidecarForChapter(chapter, spec.chapterTitle ?? spec.title ?? chapter.title), null, 2)}\n`,
      "utf8",
    );
  }
}

/** Plant ONE deterministic, NON-ADVISORY major into a chapter: an ISBN in reader
 *  prose trips SL5.publication_detail (a "major" in SEVERITY_FROM_CATALOG that is
 *  NOT in majorPolicy's ADVISORY_MAJOR_PREFIXES), so `majorPolicy.unresolved` is
 *  non-empty and CHAPTERFLOW_ENFORCE_MAJORS=1 has a real major to block on. Chosen
 *  because SL5_ISBN_RE is literally /\bISBN\b/ over reader fields — a single,
 *  side-effect-free string the "clean" variant simply omits. Planted in
 *  breakdown.fullRead so the content edit in the waiver-staleness test (which
 *  rewrites tryThisNow) leaves the major FIRING while staling its waiver hash. */
function plantEnforceableMajor(chapter: ChapterV21): void {
  chapter.breakdown.fullRead += " The team even logged the reference ISBN so the record stayed traceable.";
}

function setupMajorCleanFixture(): ReturnType<typeof loadChapterIndex> {
  cleanupFixture();
  // Hermetic synthetic book. This used to clone the first 8 chapters of the `drive`
  // gold corpus, which is ABSENT on a bare checkout — the F-12 inertness. A single
  // gate-clean synthetic chapter promotes GREEN through the full ship/book/intra-book/
  // source-reality/QC stack (validated); a MULTI-chapter synthetic book instead trips
  // the intra-book AS5–AS12 template-collision detectors, because makeGateCleanChapter
  // shares position-indexed skeletons across chapters where real distinct prose does
  // not. So one chapter is the hermetic promotable unit — it exercises the identical
  // promotion transaction machinery these tests target. One enforceable major is
  // planted so the advisory-vs-enforced and content-bound-waiver tests have a real
  // non-advisory major.
  const chapters: ChapterV21[] = [makeGateCleanChapter(MAJOR_BOOK, 1)];
  plantEnforceableMajor(chapters[0]);
  writeFixtureBook(STATE_CHAPTERS, chapters);
  const index = chapters.map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title }));
  writeFixtureIndex(MAJOR_BOOK, chapters.map((ch) => ({ chapterId: ch.chapterId, number: ch.number, title: ch.title })));
  writeSourceSidecars(MAJOR_BOOK, index, "zz-test-major-clean");
  // Source-reality is now an always-on production invariant — a source-v2 fixture promotes only
  // with a valid VERIFIED record. Write one covering every sidecar item so the MAJOR_BOOK
  // success-path tests exercise the required-and-verified path (not a record-missing block).
  writeVerifiedSourceVerifyRecord(MAJOR_BOOK);
  mkdirSync(resolve(PIPELINE_DIR, "state", "briefs"), { recursive: true });
  writeFileSync(resolve(PIPELINE_DIR, "state", "briefs", `${MAJOR_BOOK}.manual-brief.json`), JSON.stringify({
    schemaVersion: "manual-book-brief-v1",
    bookId: MAJOR_BOOK,
    title: "Major Clean Fixture",
    author: "Test Author",
  }, null, 2) + "\n", "utf8");
  mkdirSync(resolve(PIPELINE_DIR, "state", "plans"), { recursive: true });
  for (const ch of chapters) {
    writeFileSync(resolve(PIPELINE_DIR, "state", "plans", `${ch.chapterId}.manual-plan.json`), JSON.stringify({
      schemaVersion: "manual-chapter-plan-v1",
      bookId: MAJOR_BOOK,
      chapterId: ch.chapterId,
      chapterNumber: ch.number,
      title: ch.title,
      coreMove: "Use the fixture signal.",
    }, null, 2) + "\n", "utf8");
    writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId: MAJOR_BOOK,
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(ch),
      hashVersion: "v2",
      reviewer: "human:major-clean-fixture",
      reviewedAt: "2026-06-23T00:00:00.000Z",
      roundId: "r-major-clean",
      roundRole: "confirm",
    });
  }
  return index;
}

function writeContentBoundMajorWaivers(bookId: string, chapters: any[], reviewer = "human:major-clean-fixture", roundId = "r-major-clean"): void {
  const dispositions = currentMajorFindings(bookId, chapters).map((finding) => ({
    schemaVersion: MAJOR_WAIVER_RECORD_SCHEMA_VERSION,
    findingId: finding.id,
    status: "waived_accepted_debt",
    checkId: finding.checkId,
    scope: finding.scope,
    reason: "Synthetic fixture intentionally preserves deterministic major findings while testing production policy.",
    reviewer,
    roundId,
    roundRole: "confirm",
    timestamp: "2026-06-23T00:00:00.000Z",
    contentHash: finding.contentHash,
    contentHashVersion: finding.contentHashVersion,
    findingHash: finding.findingHash,
  }));
  mkdirSync(resolve(PIPELINE_DIR, "state", "waivers"), { recursive: true });
  writeFileSync(waiverPath(bookId), JSON.stringify({
    schemaVersion: MAJOR_WAIVER_FILE_SCHEMA_VERSION,
    bookId,
    dispositions,
  }, null, 2) + "\n", "utf8");
}

function waiveCurrentMajors(bookId: string, chapters = loadMajorFixtureChapters()): void {
  writeContentBoundMajorWaivers(bookId, chapters);
}

function loadMajorFixtureChapters(): any[] {
  return loadChapterIndex(MAJOR_BOOK).map((spec) =>
    JSON.parse(readFileSync(resolve(STATE_CHAPTERS, `${spec.chapterId}.v21-native.chapter.json`), "utf8")),
  );
}

function promoteMajorFixture(chapters = loadChapterIndex(MAJOR_BOOK), faultAt?: string) {
  return promoteBook({
    bookId: MAJOR_BOOK,
    title: "Major Clean Fixture",
    author: "Test Author",
    chapters,
    categories: ["Business"],
    tags: ["fixture"],
  }, {
    ...(faultAt ? { faultAt, transactionId: `tx-${faultAt}` } : {}),
    now: () => new Date("2026-06-23T00:00:00.000Z"),
  } as any);
}

function withPromotionEnvCleared<T>(fn: () => T): T {
  const prevNoApi = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const prevRequireKeyJudge = process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE;
  try {
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    delete process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE;
    return fn();
  } finally {
    if (prevNoApi === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prevNoApi;
    if (prevRequireKeyJudge === undefined) delete process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE;
    else process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE = prevRequireKeyJudge;
  }
}

/** Opt in to deterministic-major enforcement. Majors are ADVISORY by default
 *  (the calibrated empty-by-design behavior); CHAPTERFLOW_ENFORCE_MAJORS=1 turns
 *  the content-bound-waiver enforcement back on for the tests that exercise it. */
function withMajorsEnforced<T>(fn: () => T): T {
  const prev = process.env.CHAPTERFLOW_ENFORCE_MAJORS;
  try {
    process.env.CHAPTERFLOW_ENFORCE_MAJORS = "1";
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_ENFORCE_MAJORS;
    else process.env.CHAPTERFLOW_ENFORCE_MAJORS = prev;
  }
}

test("promoteBook rejects a caller-provided one-chapter subset of a canonical book and leaves production bytes unchanged", () => {
  // Hermetic: a 2-chapter synthetic canonical index; the caller promotes only ch01.
  // The subset is rejected at the canonical-chapter-set proof (Step 0.5), BEFORE any
  // ship/book gate or production write — so the chapter content need not be gate-clean
  // (was: cloned from the `drive` gold corpus, absent on a bare checkout — F-12).
  const bookId = SUBSET_BOOK;
  const chapters = [makeChapter(bookId, 1), makeChapter(bookId, 2)];
  const chapterNumber = 6; // an unrelated attested chapter number — irrelevant to the subset rejection
  const packagePath = productionPackagePath(bookId);
  const reportPath = gateReportPath(bookId);
  const qcPath = attestationPath(bookId, chapterNumber);
  const seededPackage = ensureFixtureProductionPackage(bookId, "Subset Fixture", "Nobody");
  const packageBefore = readFileSync(packagePath, "utf8");
  const reportBefore = snapshotFile(reportPath);
  const qcBefore = snapshotFile(qcPath);

  try {
    withPromotionEnvCleared(() => {
      writeFixtureBook(STATE_CHAPTERS, chapters);
      writeFixtureIndex(bookId, chapters.map((ch) => ({ chapterId: ch.chapterId, number: ch.number, title: ch.title })));
      writeAttestation({
        schemaVersion: "qc-attest-v1",
        bookId,
        chapterNumber,
        chapterId: `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`,
        verdict: "PUBLISHABLE",
        contentHash: chapterContentHash(chapters[0]),
        hashVersion: "v2",
        reviewer: "codex-qc:canonical-subset-regression",
        reviewedAt: "2026-06-23T00:00:00.000Z",
      });

      const result = promoteBook({
        bookId,
        title: "Subset Fixture",
        author: "Nobody",
        chapters: [{ chapterId: chapters[0].chapterId, chapterNumber: 1, chapterTitle: chapters[0].title }],
        categories: ["Business"],
        tags: ["motivation"],
      });

      assert.equal(result.promoted, false, "a single chapter from a canonical multi-chapter book must not promote");
      assert.match(result.reason, /canonical|complete|subset|chapter set/i);
      assert.equal(readFileSync(packagePath, "utf8"), packageBefore, "rejected subset promotion must leave the existing production package byte-identical");
    });
  } finally {
    for (const ch of chapters) rmSync(chapterStatePath(ch.chapterId), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "indexes", `${bookId}.json`), { force: true });
    restoreFile(qcPath, qcBefore);
    restoreFile(reportPath, reportBefore);
    if (seededPackage) rmSync(packagePath, { force: true });
    else restoreFile(packagePath, packageBefore);
  }
});

test("promoteBook fails closed when the canonical index is missing or malformed and writes no production state", () => {
  const cases = [
    { bookId: "zz-fixture-missing-index", indexBytes: null, expected: "CHSET.index_missing" },
    { bookId: "zz-fixture-malformed-index", indexBytes: "{ not-json", expected: "CHSET.index_malformed" },
  ];

  for (const c of cases) {
    const indexPath = resolve(PIPELINE_DIR, "state", "indexes", `${c.bookId}.json`);
    const packagePath = productionPackagePath(c.bookId);
    const reportPath = gateReportPath(c.bookId);
    const blockedBefore = blockedReports(c.bookId);
    try {
      rmSync(packagePath, { force: true });
      rmSync(reportPath, { force: true });
      rmSync(indexPath, { force: true });
      if (c.indexBytes !== null) {
        mkdirSync(resolve(PIPELINE_DIR, "state", "indexes"), { recursive: true });
        writeFileSync(indexPath, c.indexBytes, "utf8");
      }

      const result = promoteBook({
        bookId: c.bookId,
        title: "Fixture",
        author: "Nobody",
        chapters: [{ chapterId: `${c.bookId}-ch01`, chapterNumber: 1, chapterTitle: "One" }],
      });

      assert.equal(result.promoted, false);
      assert.ok(result.canonicalBlockers?.some((f) => f.checkId === c.expected), `expected ${c.expected}, got ${result.reason}`);
      assert.equal(existsSync(packagePath), false, "canonical-index rejection must not write a production package");
      assert.equal(existsSync(reportPath), false, "canonical-index rejection must not write a gate report");
      assert.deepEqual(blockedReports(c.bookId), blockedBefore, "canonical-index rejection must not write quarantine reports");
    } finally {
      rmSync(indexPath, { force: true });
      rmSync(packagePath, { force: true });
      rmSync(reportPath, { force: true });
    }
  }
});

test("promoteBook still promotes a complete correctly ordered canonical book", () => {
  // Hermetic: promote the full synthetic fixture book (was: the `drive` gold corpus,
  // absent on a bare checkout — F-12). The fixture carries an advisory major, exactly
  // like a real clean-corpus book (majors are advisory by default), so this exercises
  // the real "promotes GREEN with advisory majors present" production path.
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      const result = promoteMajorFixture(index);

      assert.equal(result.promoted, true, result.reason);
      const pkg = JSON.parse(readFileSync(productionPackagePath(MAJOR_BOOK), "utf8"));
      assert.deepEqual(pkg.chapters.map((ch: any) => ch.chapterId), index.map((spec) => spec.chapterId));
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("promoteBook writes a slim package (no embedded manifest, human-readable packageId) plus a state-side manifest sidecar", () => {
  // Hermetic: promote the synthetic fixture book (was: `drive`, absent — F-12).
  const bookId = MAJOR_BOOK;
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      const result = promoteMajorFixture(index);

      assert.equal(result.promoted, true, result.reason);
      const pkg = JSON.parse(readFileSync(productionPackagePath(bookId), "utf8"));
      // K1: the shipped package carries reader content only — no embedded manifest.
      assert.equal(pkg.productionManifest, undefined, "the shipped package must NOT embed a production manifest (it moved to the sidecar)");
      assert.match(pkg.packageId, new RegExp(`^${bookId}-v21-\\d+$`), "packageId must be human-readable <bookId>-v21-<epochMs>, not a sha256");
      // The manifest lives in the state-side sidecar; its contentId is a sha256 of
      // the canonical payload and matches the sidecar's + package's identity fields.
      const sidecar = JSON.parse(readFileSync(productionManifestSidecarPath(bookId), "utf8"));
      assert.equal(sidecar.schemaVersion, "chapterflow-production-manifest-sidecar-v1");
      assert.equal(sidecar.packageId, pkg.packageId, "sidecar packageId binds the shipped package");
      assert.equal(sidecar.createdAt, pkg.createdAt, "sidecar createdAt binds the shipped package");
      assert.match(sidecar.manifest.contentId, /^sha256:/, "the manifest carries a recomputable canonical content id");
      assert.equal(typeof sidecar.manifest.payloadHash, "string", "manifest must carry a recomputable canonical payload hash");
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("promoteBook treats unresolved majors as ADVISORY by default and blocks them only under CHAPTERFLOW_ENFORCE_MAJORS=1", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      const chapters = loadMajorFixtureChapters();
      assert.ok(currentMajorFindings(MAJOR_BOOK, chapters).length > 0, "fixture must expose current deterministic majors");

      // Default = advisory: the unresolved majors are surfaced but do NOT block.
      const advisory = promoteMajorFixture(index);
      assert.equal(advisory.promoted, true, `majors are advisory by default; promote should succeed: ${advisory.reason}`);
      assert.equal(advisory.majorBlockerCount, 0, "no major blockers in advisory (default) mode");
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      // Opt-in enforcement: the same unresolved majors now block production.
      const enforced = withMajorsEnforced(() => promoteMajorFixture(index));
      assert.equal(enforced.promoted, false, "under CHAPTERFLOW_ENFORCE_MAJORS=1 unresolved majors block");
      assert.ok(enforced.majorBlockerCount > 0, "enforced majors are counted as blockers");
      assert.match(enforced.reason, /major/i);
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, "blocked major policy must leave no production package");
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("content-bound major waivers permit only the exact finding/content and stale after edits", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => withMajorsEnforced(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      const promoted = promoteMajorFixture(index);
      assert.equal(promoted.promoted, true, promoted.reason);
      const packageBefore = readFileSync(productionPackagePath(MAJOR_BOOK), "utf8");

      const chPath = resolve(STATE_CHAPTERS, `${MAJOR_BOOK}-ch01.v21-native.chapter.json`);
      const chapter = JSON.parse(readFileSync(chPath, "utf8"));
      chapter.tryThisNow = `${chapter.tryThisNow} Write the result in one plain sentence before moving on.`;
      writeFileSync(chPath, JSON.stringify(chapter, null, 2), "utf8");
      writeAttestation({
        schemaVersion: "qc-attest-v1",
        bookId: MAJOR_BOOK,
        chapterNumber: chapter.number,
        chapterId: chapter.chapterId,
        verdict: "PUBLISHABLE",
        contentHash: chapterContentHash(chapter),
        hashVersion: "v2",
        reviewer: "human:major-clean-fixture",
        reviewedAt: "2026-06-23T00:01:00.000Z",
        roundId: "r-major-clean",
        roundRole: "confirm",
      });

      const blocked = promoteMajorFixture(index);
      assert.equal(blocked.promoted, false, "editing content must stale the prior major waivers");
      assert.match(blocked.reason, /major/i);
      assert.equal(readFileSync(productionPackagePath(MAJOR_BOOK), "utf8"), packageBefore, "stale waiver must not overwrite the last verified package");
    }));
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("promotion transaction fault injection leaves no visible package and reruns deterministically", () => {
  const oldWarn = console.warn;
  const faultPoints = ["beforeStaging", "afterStaging", "afterVerification", "beforeFinalRename", "beforeRegistryUpdate"];
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      let expectedBytes: string | null = null;
      for (const point of faultPoints) {
        if (process.env.CHAPTERFLOW_TEST_TRACE === "1") console.log(`    fault point ${point}`);
        rmSync(productionPackagePath(MAJOR_BOOK), { force: true });
        rmSync(gateReportPath(MAJOR_BOOK), { force: true });
        assert.throws(() => promoteMajorFixture(index, point), new RegExp(point), `fault ${point} must abort promotion`);
        assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, `${point} must not expose a production package`);

        const recovered = promoteMajorFixture(index);
        assert.equal(recovered.promoted, true, recovered.reason);
        const verification = verifyProductionPackage({ packagePath: productionPackagePath(MAJOR_BOOK), compareLooseState: true });
        assert.equal(verification.ok, true, verification.findings.map((f) => f.message).join("\n"));
        const bytes = readFileSync(productionPackagePath(MAJOR_BOOK), "utf8");
        if (expectedBytes === null) expectedBytes = bytes;
        assert.equal(bytes, expectedBytes, `recovery after ${point} must produce byte-identical package output`);
      }
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("re-promoting the identical manifest is idempotent and resolves to a verified package", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      const first = promoteMajorFixture(index);
      assert.equal(first.promoted, true, first.reason);
      const firstBytes = readFileSync(productionPackagePath(MAJOR_BOOK), "utf8");
      const second = promoteMajorFixture(index);
      assert.equal(second.promoted, true, second.reason);
      assert.equal(readFileSync(productionPackagePath(MAJOR_BOOK), "utf8"), firstBytes, "identical re-promote must keep package bytes stable");
      const verified = verifyProductionPackage({ packagePath: productionPackagePath(MAJOR_BOOK), compareLooseState: true });
      assert.equal(verified.ok, true, verified.findings.map((f) => f.message).join("\n"));
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("promoteBook runs the intra-book suite and blocks on planted card reuse", () => {
  try {
    const ch1 = makeChapter(BOOK, 1);
    const ch2 = makeChapter(BOOK, 2);
    const ch3 = makeChapter(BOOK, 3, { overrides: { reviewCards: structuredClone(ch1.reviewCards) } });
    writeFixtureBook(STATE_CHAPTERS, [ch1, ch2, ch3]);
    writeFixtureIndex(BOOK, [ch1, ch2, ch3]);

    const result = promoteBook({
      bookId: BOOK,
      title: "Fixture",
      author: "Nobody",
      chapters: [1, 2, 3].map((n) => ({
        chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
        chapterNumber: n,
        chapterTitle: `Chapter ${n}`,
      })) as any,
    });

    assert.equal(result.promoted, false, "a book with verbatim card reuse must not promote");
    assert.ok(
      result.intraBookBlockerCount > 0,
      `intra-book blockers must be counted at promote (got ${result.intraBookBlockerCount}) — ` +
        "if this is 0, promote is once again shipping what gate-chapter blocks",
    );
    // The count alone is hollow: clean fixtures already trip AS8/AS9/AS10/AS12
    // (templated plans/examples across chapters), so the PLANTED defect — AS7
    // card reuse, the UH incident class this test exists for — must be
    // asserted specifically or its enforcement can regress without failing.
    const report = JSON.parse(readFileSync(resolve(PIPELINE_DIR, "state", "books", `${BOOK}.gate.json`), "utf8"));
    assert.ok(
      (report.intraBook?.findings ?? []).some((f: any) => String(f.checkId).startsWith("AS7")),
      "the planted AS7 card-reuse must appear in promote's intra-book findings",
    );
  } finally {
    cleanupFixture();
  }
});

test("reader-content-strip-v3 removes planSpec/sourceAnchorId AND the v3 internals; QC freshness is checked against the LOOSE chapter so the strip never stales a real attestation", () => {
  const ch = makeChapter(BOOK, 9);
  for (const ex of ch.examples) {
    ex.sourceAnchorId = "a1";
    ex.sourceAnchorIds = ["a1"];
    (ex as any).namedCaseIds = ["nc1"];
    (ex as any).sourceFactIds = ["sf1"];
  }
  for (const q of ch.quiz.questions) {
    q.sourceAnchorId = "a2";
    q.sourceAnchorIds = ["a2"];
    q.keyEvidenceAnchorIds = ["a2"];
    (q as any).depthLevel = 2;
  }
  for (const card of ch.reviewCards) {
    card.sourceAnchorId = "a3";
    card.sourceAnchorIds = ["a3"];
  }
  (ch as any).memorableLines = [{ text: "A memorable reader line.", location: "breakdown.deepRead", why: "it sticks" }];
  ch.implementationPlan.title = "Some Skill Title";
  ch.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "hash-a",
      observedAnchorIds: ["a1"],
      effectiveAnchors: { hook: ["a1"] },
    },
  };

  // What the reviewer attested is the LOOSE state chapter; the manifest checks
  // freshness against it (productionManifest.ts gatherCommonPayload), never
  // against the v3-stripped shipped chapter.
  const looseHash = chapterContentHash(ch);
  const shipped = stripInternalFields(ch);

  const json = JSON.stringify(shipped);
  // Deep-key internals gone.
  assert.doesNotMatch(json, /planSpec/, "writer scaffolding must not ship to readers");
  assert.doesNotMatch(json, /sourceAnchorId/, "gate provenance must not ship to readers");
  assert.doesNotMatch(json, /authoring/, "authoring audit map must not ship to readers");
  assert.doesNotMatch(json, /namedCaseIds/, "v3: namedCaseIds must not ship");
  assert.doesNotMatch(json, /sourceFactIds/, "v3: sourceFactIds must not ship");
  assert.doesNotMatch(json, /depthLevel/, "v3: quiz depthLevel must not ship");
  // Path-aware internals gone.
  assert.equal((shipped as any).schemaVersion, undefined, "v3: per-chapter schemaVersion must not ship");
  assert.equal(shipped.implementationPlan.title, undefined, "v3: implementationPlan.title must not ship");
  assert.equal((shipped.memorableLines as any)[0].location, undefined, "v3: memorableLines[].location must not ship");
  assert.equal((shipped.memorableLines as any)[0].why, undefined, "v3: memorableLines[].why must not ship");
  // Reader content that SHARES a generic key name survives.
  assert.equal(shipped.examples[0].scenario, ch.examples[0].scenario, "reader content untouched");
  assert.equal(shipped.examples[0].title, ch.examples[0].title, "examples[].title survives");
  assert.equal(shipped.title, ch.title, "chapters[].title survives");
  assert.equal(shipped.examples[0].whyItMatters, ch.examples[0].whyItMatters, "examples[].whyItMatters survives");
  assert.equal((shipped.memorableLines as any)[0].text, "A memorable reader line.", "memorableLines[].text survives");
  // The pipeline's freshness input (the loose chapter) is NOT mutated by the strip
  // (the strip works on a copy), so a recorded attestation stays fresh.
  assert.equal(chapterContentHash(ch), looseHash, "the strip must not mutate the loose chapter it hashes freshness against");
  assert.ok((ch.examples[0] as any).planSpec, "strip works on a copy — state chapters are not mutated");
});

test("strip removes writer-INVENTED *SourceAnchorIds variants — strip ⊇ verifier suffix rule (live: high-output-management ch10 breakdownSourceAnchorIds)", () => {
  // The verifier (verifyProductionPackage FORBIDDEN_SOURCE_ANCHOR_RE) rejects ANY
  // key ending in SourceAnchorId(s); the strip used to remove only an enumerated
  // list, so a variant name passed the strip and fail-closed the promote.
  const ch = makeChapter(BOOK, 9) as any;
  ch.breakdownSourceAnchorIds = { fastRead: ["a1"] };            // live variant
  ch.breakdown.summarySourceAnchorIds = ["a1"];                  // nested variant
  ch.examples[0].storySourceAnchorId = "a1";                     // singular variant
  const shipped = stripInternalFields(ch) as any;
  const json = JSON.stringify(shipped);
  assert.doesNotMatch(json, /SourceAnchorIds?"/, "every *SourceAnchorId(s) key is stripped, whatever the prefix");
  assert.equal(shipped.breakdown.fastRead, ch.breakdown.fastRead, "reader content survives");
});

// ── CF-I machinery-tag strip (Fix D) — dealt beat labels shipped as example display
// tags (live: multipliers ch07 tags "early signal" / "return point"). The strip
// filters them; firstMachineryExampleTag is the verifier-side mirror. ──

test("strip removes machinery watchlist example tags (multipliers-ch07 style) and keeps benign tags — strip ⊇ verifier", () => {
  const ch = makeChapter(BOOK, 9) as any;
  // The live ch07 shape: dealt beat labels mixed into otherwise-benign display tags.
  ch.examples[0].tags = ["HarperCollins", "metadata", "early signal"];
  ch.examples[1].tags = ["return point", "one behavior", "partial"];
  ch.examples[2].tags = ["rescue", "judgment", "repair"];        // fully benign — untouched
  ch.examples[3].tags = ["Late Catch"];                          // case-insensitive; emptied list stays []
  ch.examples[4].tags = ["reckoning"];                           // single-word surface as the WHOLE tag → dropped
  // Measured false positive that pins the single-word scoping: dare-to-lead ch8's
  // "reckoning, rumble, revolution" is the book's OWN framework vocabulary — a longer
  // tag merely CONTAINING a single-word surface is legitimate reader content.
  ch.examples[5].tags = ["reckoning, rumble, revolution"];

  const before = JSON.stringify(ch.examples.map((e: any) => e.tags));
  const shipped = stripInternalFields(ch) as any;
  assert.deepEqual(shipped.examples[0].tags, ["HarperCollins", "metadata"], "the machinery tag is dropped, the rest survive");
  assert.deepEqual(shipped.examples[1].tags, ["one behavior", "partial"], "'return point' is dropped");
  assert.deepEqual(shipped.examples[2].tags, ["rescue", "judgment", "repair"], "benign tags are untouched");
  assert.deepEqual(shipped.examples[3].tags, [], "an emptied tag list ships as an empty array");
  assert.deepEqual(shipped.examples[4].tags, [], "a single-word surface as the whole tag is dropped");
  assert.deepEqual(shipped.examples[5].tags, ["reckoning, rumble, revolution"], "a legitimate tag that merely contains a single-word surface survives (dare-to-lead ch8)");
  // strip ⊇ verifier: the stripped chapter provably carries no machinery tag.
  assert.equal(firstMachineryExampleTag(shipped), null, "the verifier mirror finds nothing after the strip");
  assert.equal(firstMachineryExampleTag(ch), "early signal", "the mirror finds the first machinery tag on the un-stripped chapter");
  assert.equal(JSON.stringify(ch.examples.map((e: any) => e.tags)), before, "the strip works on a copy — the loose chapter is not mutated");
  // The matcher itself: word-boundary, not substring, for multi-word surfaces.
  assert.equal(isMachineryExampleTag("nearly signal"), false, "no substring matching across word boundaries");
  assert.equal(isMachineryExampleTag("the early signal beat"), true, "a multi-word surface inside a longer tag still matches");
});

test("verifyProductionPackage flags a machinery example tag as PPKG.machinery_tag (BLOCKER — mirrors the planSpec forbidden-field severity)", () => {
  const mkPkg = (tags: string[]) => ({
    schemaVersion: "chapterflow-v21-authored",
    packageId: "zz-machinery-tag-v21-1",
    createdAt: "2026-07-09T00:00:00.000Z",
    contentOwner: "chapterflow",
    book: { bookId: "zz-machinery-tag", title: "T", author: "A" },
    chapters: [{ chapterId: "zz-machinery-tag-ch01", number: 1, title: "C1", examples: [{ exampleId: "ex01", title: "E", tags }] }],
  });
  const flagged = verifyProductionPackage({ packageData: mkPkg(["HarperCollins", "early signal"]) });
  assert.equal(flagged.ok, false, "a package with a machinery tag must not verify");
  const finding = flagged.findings.find((f) => f.checkId === "PPKG.machinery_tag");
  assert.ok(finding, `expected PPKG.machinery_tag, got [${flagged.findings.map((f) => f.checkId).join(", ")}]`);
  assert.equal(finding!.severity, "blocker", "the machinery-tag check mirrors the forbidden-field blocker severity");
  assert.equal(finding!.actual, "early signal", "the finding names the offending tag");
  assert.equal((finding as any).chapterNumber, 1, "the finding names the chapter");

  const clean = verifyProductionPackage({ packageData: mkPkg(["HarperCollins", "metadata"]) });
  assert.ok(!clean.findings.some((f) => f.checkId === "PPKG.machinery_tag"), "benign tags produce no machinery-tag finding");
});

// ── Safe canonical chapter-file loader (CHSET.chapter_file_unreadable) ────────
// promoteBook used to `JSON.parse(readFileSync(...))` each canonical chapter file
// inline; one corrupt file threw before promotion could return a structured
// PromotionResult, so unattended automation got a raw exception instead of a
// deterministic fail-closed verdict. These pin the safe-loader boundary.

const LOADER_TX_DIR = resolve(PIPELINE_DIR, "state", "books", "_transactions");

function loaderIndexPath(bookId: string): string {
  return resolve(PIPELINE_DIR, "state", "indexes", `${bookId}.json`);
}

/** Remove every piece of state a loader-fixture book could have written. */
function cleanupLoaderFixture(bookId: string): void {
  const chapterId = `${bookId}-ch01`;
  rmSync(chapterStatePath(chapterId), { recursive: true, force: true });
  rmSync(loaderIndexPath(bookId), { force: true });
  rmSync(productionPackagePath(bookId), { force: true });
  rmSync(gateReportPath(bookId), { force: true });
  const blocked = resolve(PIPELINE_DIR, "state", "books", "_blocked");
  try {
    for (const f of readdirSync(blocked)) if (f.startsWith(`${bookId}.`)) rmSync(resolve(blocked, f), { force: true });
  } catch {}
  try {
    for (const f of readdirSync(LOADER_TX_DIR)) if (f.startsWith(`${bookId}.`)) rmSync(resolve(LOADER_TX_DIR, f), { recursive: true, force: true });
  } catch {}
}

function promoteLoaderFixture(bookId: string, title = "Loader Fixture") {
  const chapterId = `${bookId}-ch01`;
  return promoteBook({
    bookId,
    title,
    author: "Nobody",
    chapters: [{ chapterId, chapterNumber: 1, chapterTitle: "One" }],
  });
}

test("promoteBook does not throw on invalid JSON in a canonical chapter and returns CHSET.chapter_file_unreadable naming the chapter and path", () => {
  const bookId = "zz-loader-badjson";
  const chapterId = `${bookId}-ch01`;
  const chapterPath = chapterStatePath(chapterId);
  const packagePath = productionPackagePath(bookId);
  const reportPath = gateReportPath(bookId);
  const blockedBefore = blockedReports(bookId);
  try {
    cleanupLoaderFixture(bookId);
    writeFixtureIndex(bookId, [{ chapterId, number: 1, title: "One" }]);
    writeFileSync(chapterPath, "{ this is : not valid json", "utf8");

    // A throw here fails the test — that throw IS the regression being guarded.
    const result = promoteLoaderFixture(bookId);

    assert.equal(result.promoted, false, "an unreadable chapter must not promote");
    assert.ok(
      result.canonicalBlockers?.some((b) => b.checkId === "CHSET.chapter_file_unreadable"),
      `expected CHSET.chapter_file_unreadable, got ${result.reason}`,
    );
    assert.match(result.reason, new RegExp(chapterId), "the blocker must name the chapter");
    assert.ok(result.reason.includes(chapterPath), `the blocker must name the file path; reason: ${result.reason}`);
    // Fail-closed: no production state written on the loader path.
    assert.equal(existsSync(packagePath), false, "an unreadable chapter must not write a production package");
    assert.equal(existsSync(reportPath), false, "an unreadable chapter must not write a gate report");
    assert.deepEqual(blockedReports(bookId), blockedBefore, "an unreadable chapter must not write a quarantine report");
  } finally {
    cleanupLoaderFixture(bookId);
  }
});

test("promoteBook fails closed on an unreadable or a missing canonical chapter file", () => {
  // Case A: the path exists but cannot be read as a file — a directory at the
  //         chapter path makes readFileSync throw EISDIR (cross-platform).
  // Case B: the chapter file is absent entirely.
  const cases = [
    { bookId: "zz-loader-unreadable", make: (p: string) => mkdirSync(p, { recursive: true }), expected: "CHSET.chapter_file_unreadable" },
    { bookId: "zz-loader-missing", make: (_p: string) => {}, expected: "CHSET.chapter_file_missing" },
  ];
  for (const c of cases) {
    const chapterId = `${c.bookId}-ch01`;
    const chapterPath = chapterStatePath(chapterId);
    const packagePath = productionPackagePath(c.bookId);
    const reportPath = gateReportPath(c.bookId);
    try {
      cleanupLoaderFixture(c.bookId);
      writeFixtureIndex(c.bookId, [{ chapterId, number: 1, title: "One" }]);
      c.make(chapterPath);

      const result = promoteLoaderFixture(c.bookId);

      assert.equal(result.promoted, false, `${c.expected} must not promote`);
      assert.ok(
        result.canonicalBlockers?.some((b) => b.checkId === c.expected),
        `expected ${c.expected}, got ${result.reason}`,
      );
      assert.equal(existsSync(packagePath), false, `${c.expected} must not write a production package`);
      assert.equal(existsSync(reportPath), false, `${c.expected} must not write a gate report`);
    } finally {
      cleanupLoaderFixture(c.bookId);
    }
  }
});

test("promoteBook routes valid JSON with a malformed chapter shape to the schema-first ship gate and returns schema findings", () => {
  const bookId = "zz-loader-badshape";
  const chapterId = `${bookId}-ch01`;
  const chapterPath = chapterStatePath(chapterId);
  const reportPath = gateReportPath(bookId);
  const packagePath = productionPackagePath(bookId);
  try {
    cleanupLoaderFixture(bookId);
    // Structurally complete (so the deeper critics don't crash) with ONE schema
    // violation: readingTimeMinutes must be a finite number, not a string.
    const ch = makeChapter(bookId, 1);
    (ch as any).readingTimeMinutes = "seven";
    writeFileSync(chapterPath, JSON.stringify(ch, null, 2), "utf8");
    writeFixtureIndex(bookId, [{ chapterId, number: 1, title: ch.title }]);

    const result = promoteBook({
      bookId,
      title: "Loader Fixture",
      author: "Nobody",
      chapters: [{ chapterId, chapterNumber: 1, chapterTitle: ch.title }],
    });

    assert.equal(result.promoted, false, "a malformed chapter shape must not promote");
    assert.equal(result.canonicalBlockerCount, 0, "valid JSON with a bad shape is NOT a canonical-set/loader blocker");
    assert.ok(result.shipGateBlockerCount > 0, "the malformed shape must surface as ship-gate blockers");
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const shipBlockers = report.shipGate.perChapter.flatMap((g: any) => g.blockers ?? []);
    assert.ok(
      shipBlockers.some((b: any) => String(b.catalogId).startsWith("schema.")),
      `expected a schema.* ship-gate finding; got ${JSON.stringify(shipBlockers.map((b: any) => b.catalogId))}`,
    );
  } finally {
    cleanupLoaderFixture(bookId);
  }
});

test("a failed loader promotion preserves an existing production package byte-for-byte and leaves no transaction directory", () => {
  const bookId = "zz-loader-preserve";
  const chapterId = `${bookId}-ch01`;
  const chapterPath = chapterStatePath(chapterId);
  const packagePath = productionPackagePath(bookId);
  try {
    cleanupLoaderFixture(bookId);
    // Seed a pre-existing production package with recognizable bytes.
    mkdirSync(dirname(packagePath), { recursive: true });
    const seeded = `{"seed":"do-not-touch","schemaVersion":"prior"}\n`;
    writeFileSync(packagePath, seeded, "utf8");

    writeFixtureIndex(bookId, [{ chapterId, number: 1, title: "One" }]);
    writeFileSync(chapterPath, "{ not json", "utf8");

    const result = promoteLoaderFixture(bookId);
    assert.equal(result.promoted, false, "the corrupt chapter must block promotion");
    assert.equal(
      readFileSync(packagePath, "utf8"),
      seeded,
      "a failed loader promotion must leave the existing production package byte-identical",
    );

    let txLeftovers: string[] = [];
    try { txLeftovers = readdirSync(LOADER_TX_DIR).filter((f) => f.startsWith(`${bookId}.`)); } catch {}
    assert.deepEqual(txLeftovers, [], "a failed loader promotion must not leave a live promotion transaction directory");
  } finally {
    cleanupLoaderFixture(bookId);
  }
});

test("CLI promote-book exits nonzero WITHOUT a raw stack trace when a canonical chapter is invalid JSON", () => {
  const bookId = "zz-loader-cli";
  const chapterId = `${bookId}-ch01`;
  const chapterPath = chapterStatePath(chapterId);
  try {
    cleanupLoaderFixture(bookId);
    writeFixtureIndex(bookId, [{ chapterId, number: 1, title: "One" }]);
    writeFileSync(chapterPath, "{ not valid json", "utf8");

    const { status, out } = runCli([
      "promote-book", bookId,
      "--title", "Loader Fixture",
      "--author", "Nobody",
      "--categories", "Business",
      "--tags", "fixture",
    ]);

    assert.notEqual(status, 0, `promote-book must exit nonzero on a corrupt chapter; output tail:\n${out.slice(-1500)}`);
    assert.match(out, /CHSET\.chapter_file_unreadable/, `the structured blocker must be reported; output tail:\n${out.slice(-1500)}`);
    // A thrown error printed by the CLI top-level (`console.error(err)`) renders
    // stack frames like "    at <fn> (<file>:line:col)". The deterministic
    // fail-closed verdict must not contain any.
    assert.doesNotMatch(out, /\n\s+at .+:\d+:\d+/, `a raw stack trace leaked:\n${out.slice(-2000)}`);
  } finally {
    cleanupLoaderFixture(bookId);
  }
});

// ── Crash-safe promotion: transactional staging + owner-proven recovery ───────
// promoteBook used to call recoverPromotionTransactions(bookId) at the start of
// every publish, broadly `rmSync`-removing EVERY `<bookId>.*` staging directory
// with no ownership/liveness/age check — a second promotion's "recovery" could
// delete a live promotion's staging transaction. These pin the replacement:
// staging goes live via a single atomic rename, and recovery (reapAbandoned-
// TransactionDirs) removes ONLY directories proven to belong to a DEAD prior
// owner. No cross-process lease — the autopilot serializes per-book work.

const PROMO_TX_DIR = resolve(PIPELINE_DIR, "state", "books", "_transactions");
const FIXED_NOW = "2026-06-23T00:00:00.000Z";

/** Fabricate a leftover staging transaction directory with an owner stamp,
 *  standing in for a prior (crashed) promotion's transaction. */
function writeFakeStagingTx(bookId: string, txId: string, owner: { pid: number; hostname: string; ownerToken?: string }): string {
  const dir = resolve(PROMO_TX_DIR, `${bookId}.${txId}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "owner.json"), JSON.stringify({
    schemaVersion: "promotion-tx-owner-v1",
    bookId,
    transactionId: txId,
    ownerId: `promote-fake-${txId}`,
    ownerToken: owner.ownerToken ?? `fake-owner-token-${txId}`,
    pid: owner.pid,
    hostname: owner.hostname,
    createdAt: FIXED_NOW,
  }, null, 2) + "\n", "utf8");
  // Staged bytes that the old broad delete would have destroyed.
  writeFileSync(resolve(dir, "package.v21.json"), `{"staged":"${txId}"}\n`, "utf8");
  return dir;
}

function promoteMajorWith(index: ReturnType<typeof loadChapterIndex>, options: Record<string, unknown>) {
  return promoteBook({
    bookId: MAJOR_BOOK,
    title: "Major Clean Fixture",
    author: "Test Author",
    chapters: index,
    categories: ["Business"],
    tags: ["fixture"],
  }, { now: () => new Date(FIXED_NOW), ...options } as any);
}

test("promotion fault injection leaves owner-attributed, recoverable transaction evidence", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      assert.throws(() => promoteMajorFixture(index, "afterStaging"), /afterStaging/);

      const txDir = resolve(PROMO_TX_DIR, `${MAJOR_BOOK}.tx-afterStaging`);
      assert.ok(existsSync(txDir), "the faulted transaction directory survives as recovery evidence");
      const owner = JSON.parse(readFileSync(resolve(txDir, "owner.json"), "utf8"));
      assert.equal(owner.schemaVersion, "promotion-tx-owner-v1");
      assert.equal(owner.transactionId, "tx-afterStaging");
      assert.equal(owner.pid, process.pid, "the evidence attributes the transaction to its owner pid");
      assert.ok(typeof owner.ownerToken === "string" && owner.ownerToken.length > 0, "owner token recorded");
      const journal = JSON.parse(readFileSync(resolve(txDir, "journal.json"), "utf8"));
      assert.equal(journal.state, "staged", "the journal records the last durable transition reached");
      assert.ok(existsSync(resolve(txDir, "package.v21.json")), "the staged package bytes are recoverable");
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, "a fault exposes no production package");
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

// ── WP-401: D7 rubric-audit SHIP GATE wired into promote ──────────────────────
// promoteBook now refuses to ship a NEW/CHANGED book without a fresh, sealed D7
// PASS receipt bound to the exact bytes (REQUIRE mode). A FAIL/VOID/stale/tamper
// receipt blocks regardless of REQUIRE. A byte-identical re-promote of the shipped
// corpus is EXEMPT (no-retroactivity). These promote the REAL fixture book through
// the whole gate stack with a fixture receipt written to the state sidecar path.

const D7_STATE_BOOKS_DIR = resolve(PIPELINE_DIR, "state", "books");

function withRequireD7<T>(fn: () => T): T {
  const prev = process.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV];
  try {
    process.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV] = "1";
    return fn();
  } finally {
    if (prev === undefined) delete process.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV];
    else process.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV] = prev;
  }
}

/** Seal a fixture D7 receipt for `bookId` bound to its CURRENT canonical content,
 *  and write it to the state-side path the gate resolves. `staleUnit` deliberately
 *  breaks one content hash to exercise the stale-content path. The custody block is
 *  non-empty + well-formed (audit_id `zz-d7-fixture` has no retained dir, so the
 *  gate re-verifies 'retained-absent' and enforces only the seal + custody shape —
 *  see d7-ship-gate.test.ts for the mint-time real-artifact validation). */
function fixtureCustody(units: string[]): D7ShipGateCustody[] {
  return units.map((unit) => ({
    unit,
    primaryDispatchSha256: sha256Hex(Buffer.from(`${unit}-primary-dispatch`, "utf8")),
    verificationDispatchSha256: sha256Hex(Buffer.from(`${unit}-verification-dispatch`, "utf8")),
    pairSealSha256: sha256Hex(Buffer.from(`${unit}-pair-seal`, "utf8")),
    adjudicationCanonicalSha256: sha256Hex(Buffer.from(`${unit}-adjudication`, "utf8")),
  }));
}

function writeFixtureD7Receipt(bookId: string, opts: { verdict: D7ShipGateVerdict; round?: number; staleUnit?: string }): void {
  const content = deriveCurrentD7Content({ bookId });
  const pass = opts.verdict === "PASS";
  const chapters = [...content.entries()].map(([unit, entry]) => ({
    unit,
    chapterNumber: entry.chapterNumber,
    chapterDiagnostic: pass ? 90 : 69,
    coreDomainMin: pass ? 3.5 : 2.0,
    coreDomainsPass: pass,
    gatesPass: true,
    layerIndependencePass: pass,
    pass,
    contentDocSha256: opts.staleUnit === unit ? "f".repeat(64) : entry.contentDocSha256,
    headingInventorySha256: entry.headingInventorySha256,
  }));
  const mean = pass ? 90 : 69;
  const receipt: D7ShipGateReceiptV1 = sealD7ShipGateReceipt({
    schema_version: "1.0.0",
    artifact_type: "chapterflow_d7_ship_gate_receipt",
    issuer: "chapterflow_evaluation_orchestrator",
    book_id: bookId,
    audit_id: "zz-d7-fixture",
    round: opts.round ?? 1,
    reauthor_budget_per_audit: D7_REAUTHOR_BUDGET_PER_AUDIT,
    instrument: { rubric_version: "2.0", bar: RUBRIC_AUDIT_BAR_D7 },
    verdict: opts.verdict,
    book_cds: mean,
    summary: {
      chapter_count: chapters.length, mean, min: pass ? 88 : 67.66,
      mean_pass: pass, min_pass: pass, all_core_domains_pass: pass,
      all_gates_pass: true, all_layer_independence_pass: pass, calibration_pass: true,
    },
    calibration: { unit: "cal", expected: 67.66, observed: 67.66, abs_delta: 0, tolerance: 3, pass: true },
    chapters,
    custody: fixtureCustody(chapters.map((chapter) => chapter.unit)),
    report_sha256: "0".repeat(64),
  });
  mkdirSync(D7_STATE_BOOKS_DIR, { recursive: true });
  writeFileSync(d7ShipGateReceiptPath(bookId, D7_STATE_BOOKS_DIR), JSON.stringify(receipt, null, 2) + "\n", "utf8");
}

test("WP-401: a new book with NO D7 receipt is refused under REQUIRE and leaves no production package", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => withRequireD7(() => {
      const index = setupMajorCleanFixture();
      const result = promoteMajorFixture(index);
      assert.equal(result.promoted, false, "REQUIRE mode blocks a new book with no receipt");
      assert.ok(result.d7ShipGateBlockerCount > 0, "the D7 gate contributes a blocker");
      assert.equal(result.d7ShipGateDecision, "block");
      assert.match(result.reason, /D7.receipt_missing|D7 ship-gate/i);
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, "a D7-blocked promote writes no production package");
    }));
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("WP-401: a fresh PASS receipt bound to the shipped bytes ALLOWS promotion (advisory; honest retained-absent path)", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    // The fixture receipt's audit (`zz-d7-fixture`) has no retained dir, so custody
    // re-verifies 'retained-absent'. rt-401 round 2 (finding A) moved this honest
    // retained-absent PASS to ADVISORY mode; under REQUIRE the retained audit
    // evidence must be present (asserted by the next test).
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      writeFixtureD7Receipt(MAJOR_BOOK, { verdict: "PASS" });
      const result = promoteMajorFixture(index);
      assert.equal(result.promoted, true, result.reason);
      assert.equal(result.d7ShipGateDecision, "pass");
      assert.equal(result.d7ShipGateBlockerCount, 0);
      assert.ok(existsSync(productionPackagePath(MAJOR_BOOK)), "a D7-PASS book ships");
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("WP-401 (rt-401 finding A): under REQUIRE a retained-absent PASS receipt is BLOCKED — the retained audit evidence must be present", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => withRequireD7(() => {
      const index = setupMajorCleanFixture();
      writeFixtureD7Receipt(MAJOR_BOOK, { verdict: "PASS" }); // audit_id zz-d7-fixture → no retained dir
      const result = promoteMajorFixture(index);
      assert.equal(result.promoted, false, "REQUIRE mandates the retained audit evidence be present at gate time");
      assert.equal(result.d7ShipGateDecision, "block");
      assert.ok(result.d7ShipGateBlockerCount > 0, "the D7 gate contributes a blocker");
      const report = JSON.parse(readFileSync(gateReportPath(MAJOR_BOOK), "utf8"));
      assert.ok(
        (report.d7ShipGate?.blockers ?? []).some((b: string) => b.startsWith("D7.retained_audit_required")),
        `expected a D7.retained_audit_required blocker; got ${JSON.stringify(report.d7ShipGate?.blockers)}`,
      );
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, "a D7-blocked promote writes no production package");
    }));
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("WP-401: a FAIL D7 receipt is quarantined (blocks even without REQUIRE) and writes a one-round halt record", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      writeFixtureD7Receipt(MAJOR_BOOK, { verdict: "FAIL", round: 1 });
      const result = promoteMajorFixture(index); // NOTE: no REQUIRE — a present FAIL always blocks
      assert.equal(result.promoted, false, "a book you audited and it FAILED can never ship");
      assert.ok(result.d7ShipGateBlockerCount > 0);
      assert.equal(result.d7ShipGateDecision, "block");
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, "a FAIL D7 receipt writes no production package");
      const haltPath = d7ShipGateHaltPath(MAJOR_BOOK, D7_STATE_BOOKS_DIR);
      assert.ok(existsSync(haltPath), "a FAIL emits the owner-visible halt record");
      const halt = JSON.parse(readFileSync(haltPath, "utf8"));
      assert.equal(halt.halt_category, "BLOCKED_QUALITY_BAR");
      assert.equal(halt.re_author_directive.allowed_reauthors, 1, "round 1 owes one full re-author");
      assert.equal(halt.re_author_directive.terminal, false);
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("WP-401: one-round policy — a round-2 FAIL receipt halts BLOCKED_QUALITY_BAR terminally for the owner", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      writeFixtureD7Receipt(MAJOR_BOOK, { verdict: "FAIL", round: 2 });
      const result = promoteMajorFixture(index);
      assert.equal(result.promoted, false);
      const halt = JSON.parse(readFileSync(d7ShipGateHaltPath(MAJOR_BOOK, D7_STATE_BOOKS_DIR), "utf8"));
      assert.equal(halt.round, 2);
      assert.equal(halt.re_author_directive.terminal, true, "the single re-author budget is exhausted at round 2");
      assert.equal(halt.re_author_directive.allowed_reauthors, 0);
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("WP-401: a receipt bound to STALE bytes (content changed since the audit) is refused", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => withRequireD7(() => {
      const index = setupMajorCleanFixture();
      writeFixtureD7Receipt(MAJOR_BOOK, { verdict: "PASS", staleUnit: `${MAJOR_BOOK}-ch01` });
      const result = promoteMajorFixture(index);
      assert.equal(result.promoted, false, "a receipt not bound to the current bytes is stale");
      assert.equal(result.d7ShipGateDecision, "block");
      const report = JSON.parse(readFileSync(gateReportPath(MAJOR_BOOK), "utf8"));
      assert.ok(
        (report.d7ShipGate?.blockers ?? []).some((b: string) => b.startsWith("D7.stale_content")),
        `expected a D7.stale_content blocker; got ${JSON.stringify(report.d7ShipGate?.blockers)}`,
      );
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false);
    }));
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("WP-401 no-retroactivity: a byte-identical re-promote of a shipped package is EXEMPT even under REQUIRE (no receipt)", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      // First promote WITHOUT the gate required (advisory) creates the shipped package.
      const first = promoteMajorFixture(index);
      assert.equal(first.promoted, true, first.reason);
      assert.equal(first.d7ShipGateDecision, "advisory-skip");
      const shippedBytes = readFileSync(productionPackagePath(MAJOR_BOOK), "utf8");

      // Re-promote the identical content under REQUIRE, with NO receipt: the
      // byte-identical candidate is exempt (an already-shipped book stays untouchable).
      const second = withRequireD7(() => promoteMajorFixture(index));
      assert.equal(second.promoted, true, `a byte-identical re-promote must be exempt: ${second.reason}`);
      assert.equal(second.d7ShipGateDecision, "exempt");
      assert.equal(second.d7ShipGateBlockerCount, 0);
      assert.equal(readFileSync(productionPackagePath(MAJOR_BOOK), "utf8"), shippedBytes, "the exempt re-promote keeps the shipped bytes stable");
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});

test("recovery removes only the dead prior owner's transaction, never a live or unknown one", () => {
  const oldWarn = console.warn;
  const DEAD_PID = 424242;
  const LIVE_PID = 424243;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      // Two orphan staging directories from prior runs on this host.
      const deadDir = writeFakeStagingTx(MAJOR_BOOK, "dead-orphan", { pid: DEAD_PID, hostname: osHostname() });
      const liveDir = writeFakeStagingTx(MAJOR_BOOK, "live-orphan", { pid: LIVE_PID, hostname: osHostname() });

      // Promote with an injected probe: only DEAD_PID is provably dead. (The probe
      // is consulted only by recovery here — the fresh lease wx-creates cleanly.)
      const result = promoteMajorWith(index, {
        leaseLiveness: (owner: { pid: number }) =>
          owner.pid === DEAD_PID ? "dead" : owner.pid === LIVE_PID ? "alive" : "unknown",
      });

      assert.equal(result.promoted, true, result.reason);
      assert.equal(existsSync(deadDir), false, "the provably-dead owner's transaction is reaped");
      assert.ok(existsSync(liveDir), "a live (or unknown) owner's transaction is NEVER reaped");
      assert.ok(existsSync(resolve(liveDir, "package.v21.json")), "the spared owner's staged bytes are intact");
    });
  } finally {
    console.warn = oldWarn;
    cleanupFixture();
  }
});
