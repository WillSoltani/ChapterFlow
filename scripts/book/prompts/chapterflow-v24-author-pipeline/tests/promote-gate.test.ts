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
        reviewer: "claude-qc:canonical-subset-regression",
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

test("ambient legacy release state cannot authorize promotion or mutate package state", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      const packagePath = productionPackagePath(MAJOR_BOOK);
      const sidecarPath = productionManifestSidecarPath(MAJOR_BOOK);
      const transactionsPath = resolve(PIPELINE_DIR, "state", "books", "_transactions");
      const ownerHostname = "legacy-release-test-host";
      const transactionNames = () => {
        try {
          return readdirSync(transactionsPath).filter((name) => name.startsWith(`${MAJOR_BOOK}.`)).sort();
        } catch {
          return [];
        }
      };
      const seedTransaction = (transactionId: string, pid: number) => {
        const dir = resolve(transactionsPath, `${MAJOR_BOOK}.${transactionId}`);
        const bytes = `${JSON.stringify({ staged: transactionId })}\n`;
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, "owner.json"), `${JSON.stringify({
          schemaVersion: "promotion-tx-owner-v1",
          bookId: MAJOR_BOOK,
          transactionId,
          ownerId: `legacy-${transactionId}`,
          ownerToken: `legacy-token-${transactionId}`,
          pid,
          hostname: ownerHostname,
          createdAt: "2026-06-22T00:00:00.000Z",
        }, null, 2)}\n`, "utf8");
        writeFileSync(resolve(dir, "package.v21.json"), bytes, "utf8");
        return { dir, bytes };
      };
      const dead = seedTransaction("dead-owner", 41001);
      const live = seedTransaction("live-owner", 41002);
      const unknown = seedTransaction("unknown-owner", 41003);
      const freshDir = resolve(transactionsPath, `${MAJOR_BOOK}.fresh-blocked`);

      const result = promoteBook({
        bookId: MAJOR_BOOK,
        title: "Major Clean Fixture",
        author: "Test Author",
        chapters: index,
        categories: ["Business"],
        tags: ["fixture"],
      }, {
        now: () => new Date("2026-06-23T00:00:00.000Z"),
        transactionId: "fresh-blocked",
        leaseHostname: ownerHostname,
        leaseLiveness: ({ pid }) => pid === 41001 ? "dead" : pid === 41002 ? "alive" : "unknown",
      });

      assert.equal(result.promoted, false, "ambient chapters, attestations, and waivers cannot authorize release");
      assert.match(result.reason, /QC0\.missing_attestation/);
      const report = JSON.parse(readFileSync(gateReportPath(MAJOR_BOOK), "utf8"));
      const qcIds = (report.qcAttestation?.findings ?? []).map((finding: any) => finding.checkId);
      const bookIds = (report.bookGate?.findings ?? []).map((finding: any) => finding.catalogId ?? finding.checkId);
      assert.ok(qcIds.includes("QC0.missing_attestation"), `missing candidate-bound QC blocker: ${qcIds.join(", ")}`);
      assert.ok(bookIds.includes("BOOK_PATTERN_AUDIT_UNBOUND"), `missing candidate-bound pattern-audit blocker: ${bookIds.join(", ")}`);
      assert.equal(existsSync(dead.dir), false, "provably dead prior-owner transaction must be reaped");
      assert.ok(existsSync(live.dir), "live prior-owner transaction name must survive");
      assert.ok(existsSync(unknown.dir), "unknown prior-owner transaction name must survive");
      assert.equal(readFileSync(resolve(live.dir, "package.v21.json"), "utf8"), live.bytes, "live staged bytes must survive unchanged");
      assert.equal(readFileSync(resolve(unknown.dir, "package.v21.json"), "utf8"), unknown.bytes, "unknown staged bytes must survive unchanged");
      assert.deepEqual(
        transactionNames(),
        [`${MAJOR_BOOK}.live-owner`, `${MAJOR_BOOK}.unknown-owner`],
        "only live and unknown prior-owner transaction names may remain",
      );
      assert.equal(existsSync(freshDir), false, "blocked release must not create a fresh transaction");
      assert.equal(existsSync(packagePath), false, "blocked legacy path must not write a package");
      assert.equal(existsSync(sidecarPath), false, "blocked legacy path must not write a manifest sidecar");
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
