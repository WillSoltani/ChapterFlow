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

import { promoteBook, stripInternalFields } from "../src/promoteBook.js";
import { attestationPath, chapterContentHash, writeAttestation } from "../src/critics/qcAttestation.js";
import { loadChapterIndex } from "../src/generateBook.js";
import { verifyProductionPackage } from "../src/verifyProductionPackage.js";
import { hostname as osHostname } from "os";
import {
  acquirePromotionLease,
  promotionLockDir,
  promotionLockPath,
  releasePromotionLease,
} from "../src/promotionLease.js";
import { test } from "./harness.js";
import { makeChapter, makeSourceV2SidecarFixture, PIPELINE_DIR, runCli, STATE_CHAPTERS, writeFixtureBook, writeResearchRunManifestFixture } from "./helpers.js";
import {
  currentMajorFindings,
  MAJOR_WAIVER_FILE_SCHEMA_VERSION,
  MAJOR_WAIVER_RECORD_SCHEMA_VERSION,
  waiverPath,
} from "../src/qc/majorDisposition.js";

const BOOK = "zz-fixture-promote";
const MAJOR_BOOK = "zz-fixture-promote-major-clean";

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
  rmSync(sourceRunDir(MAJOR_BOOK, "zz-test-major-clean"), { recursive: true, force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "books", "_transactions"), { recursive: true, force: true });
  // Clear the promotion LOCK dir too. The lease lock lives under _locks (NOT
  // _transactions), so a leaked canonical lock or `.recovered-*` sibling for
  // either fixture book would otherwise survive into the next test and make a
  // later MAJOR_BOOK/BOOK promote fail-closed at lease acquisition. Every test
  // that uses these fixtures starts via setupMajorCleanFixture (-> cleanupFixture),
  // so clearing here guarantees a clean-lock START, not only a clean finally.
  const locksDir = resolve(PIPELINE_DIR, "state", "books", "_locks");
  try {
    for (const f of readdirSync(locksDir)) {
      if (f.startsWith(`${BOOK}.promotion.lock`) || f.startsWith(`${MAJOR_BOOK}.promotion.lock`)) {
        rmSync(resolve(locksDir, f), { force: true });
      }
    }
  } catch {}
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
  return resolve(PIPELINE_DIR, "../../../../book-packages", `${bookId}.v21.json`);
}

function gateReportPath(bookId: string): string {
  return resolve(PIPELINE_DIR, "state", "books", `${bookId}.gate.json`);
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
  return resolve(PIPELINE_DIR, "../../../../.chapterflow/runs", bookId, runId);
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

function setupMajorCleanFixture(): ReturnType<typeof loadChapterIndex> {
  cleanupFixture();
  const sourceBook = "drive";
  const sourceIndex = loadChapterIndex(sourceBook);
  const chapters = sourceIndex.map((spec) => {
    const source = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, `${spec.chapterId}.v21-native.chapter.json`), "utf8"));
    const nn = String(spec.chapterNumber).padStart(2, "0");
    return {
      ...source,
      chapterId: `${MAJOR_BOOK}-ch${nn}`,
      number: spec.chapterNumber,
    };
  });
  writeFixtureBook(STATE_CHAPTERS, chapters);
  const index = chapters.map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title }));
  writeFixtureIndex(MAJOR_BOOK, chapters.map((ch) => ({ chapterId: ch.chapterId, number: ch.number, title: ch.title })));
  writeSourceSidecars(MAJOR_BOOK, index, "zz-test-major-clean");
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

test("promoteBook rejects a caller-provided one-chapter subset of a canonical book and leaves production bytes unchanged", () => {
  const bookId = "drive";
  const chapterNumber = 6;
  const chapterPath = resolve(STATE_CHAPTERS, `${bookId}-ch${String(chapterNumber).padStart(2, "0")}.v21-native.chapter.json`);
  const packagePath = productionPackagePath(bookId);
  const reportPath = gateReportPath(bookId);
  const qcPath = attestationPath(bookId, chapterNumber);
  const packageBefore = readFileSync(packagePath, "utf8");
  const reportBefore = snapshotFile(reportPath);
  const qcBefore = snapshotFile(qcPath);

  try {
    withPromotionEnvCleared(() => {
      const chapter = JSON.parse(readFileSync(chapterPath, "utf8"));
      writeAttestation({
        schemaVersion: "qc-attest-v1",
        bookId,
        chapterNumber,
        chapterId: chapter.chapterId,
        verdict: "PUBLISHABLE",
        contentHash: chapterContentHash(chapter),
        hashVersion: "v2",
        reviewer: "claude-qc:canonical-subset-regression",
        reviewedAt: "2026-06-23T00:00:00.000Z",
      });

      const result = promoteBook({
        bookId,
        title: "Drive",
        author: "Daniel H. Pink",
        chapters: [{ chapterId: chapter.chapterId, chapterNumber, chapterTitle: chapter.title }],
        categories: ["Business"],
        tags: ["motivation"],
      });

      assert.equal(result.promoted, false, "a single chapter from a canonical multi-chapter book must not promote");
      assert.match(result.reason, /canonical|complete|subset|chapter set/i);
      assert.equal(readFileSync(packagePath, "utf8"), packageBefore, "rejected subset promotion must leave the existing production package byte-identical");
    });
  } finally {
    restoreFile(qcPath, qcBefore);
    restoreFile(reportPath, reportBefore);
    restoreFile(packagePath, packageBefore);
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
  const bookId = "drive";
  const runId = `zz-test-promote-manifest-${process.pid}`;
  const index = loadChapterIndex(bookId);
  const packagePath = productionPackagePath(bookId);
  const reportPath = gateReportPath(bookId);
  const packageBefore = readFileSync(packagePath, "utf8");
  const reportBefore = snapshotFile(reportPath);
  const waiverBefore = snapshotFile(waiverPath(bookId));
  const qcBefore = new Map(index.map((spec) => [spec.chapterNumber, snapshotFile(attestationPath(bookId, spec.chapterNumber))]));
  const chapterBefore = new Map(index.map((spec) => [spec.chapterId, snapshotFile(chapterStatePath(spec.chapterId))]));

  try {
    withPromotionEnvCleared(() => {
      writeSourceSidecars(bookId, index, runId);
      for (const spec of index) {
        const chapter = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, `${spec.chapterId}.v21-native.chapter.json`), "utf8"));
        writeAttestation({
          schemaVersion: "qc-attest-v1",
          bookId,
          chapterNumber: spec.chapterNumber,
          chapterId: spec.chapterId,
          verdict: "PUBLISHABLE",
          contentHash: chapterContentHash(chapter),
          hashVersion: "v2",
          reviewer: "claude-qc:canonical-full-regression",
          reviewedAt: "2026-06-23T00:00:00.000Z",
          roundId: "canonical-full-regression-round",
          roundRole: "attest",
        });
      }
      writeContentBoundMajorWaivers(bookId, index.map((spec) =>
        JSON.parse(readFileSync(resolve(STATE_CHAPTERS, `${spec.chapterId}.v21-native.chapter.json`), "utf8")),
      ), "human:canonical-full-regression", "canonical-full-regression-round");

      const result = promoteBook({
        bookId,
        title: "Drive",
        author: "Daniel H. Pink",
        chapters: index,
        categories: ["Psychology", "Self-Help", "Productivity", "Behavioral Economics"],
        tags: ["motivation", "autonomy", "mastery", "purpose", "incentives", "behavior-change"],
      });

      assert.equal(result.promoted, true, result.reason);
      const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
      assert.deepEqual(pkg.chapters.map((ch: any) => ch.chapterId), index.map((spec) => spec.chapterId));
    });
  } finally {
    for (const spec of index) restoreFile(chapterStatePath(spec.chapterId), chapterBefore.get(spec.chapterId) ?? null);
    for (const spec of index) restoreFile(attestationPath(bookId, spec.chapterNumber), qcBefore.get(spec.chapterNumber) ?? null);
    rmSync(sourceRunDir(bookId, runId), { recursive: true, force: true });
    restoreFile(waiverPath(bookId), waiverBefore);
    restoreFile(reportPath, reportBefore);
    restoreFile(packagePath, packageBefore);
  }
});

test("promoteBook embeds a production manifest identity instead of trusting timestamp package metadata", () => {
  const bookId = "drive";
  const runId = `zz-test-promote-manifest-identity-${process.pid}`;
  const index = loadChapterIndex(bookId);
  const packagePath = productionPackagePath(bookId);
  const reportPath = gateReportPath(bookId);
  const packageBefore = readFileSync(packagePath, "utf8");
  const reportBefore = snapshotFile(reportPath);
  const waiverBefore = snapshotFile(waiverPath(bookId));
  const qcBefore = new Map(index.map((spec) => [spec.chapterNumber, snapshotFile(attestationPath(bookId, spec.chapterNumber))]));
  const chapterBefore = new Map(index.map((spec) => [spec.chapterId, snapshotFile(chapterStatePath(spec.chapterId))]));

  try {
    withPromotionEnvCleared(() => {
      writeSourceSidecars(bookId, index, runId);
      for (const spec of index) {
        const chapter = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, `${spec.chapterId}.v21-native.chapter.json`), "utf8"));
        writeAttestation({
          schemaVersion: "qc-attest-v1",
          bookId,
          chapterNumber: spec.chapterNumber,
          chapterId: spec.chapterId,
          verdict: "PUBLISHABLE",
          contentHash: chapterContentHash(chapter),
          hashVersion: "v2",
          reviewer: "claude-qc:manifest-regression",
          reviewedAt: "2026-06-23T00:00:00.000Z",
          roundId: "manifest-regression-round",
          roundRole: "attest",
        });
      }
      writeContentBoundMajorWaivers(bookId, index.map((spec) =>
        JSON.parse(readFileSync(resolve(STATE_CHAPTERS, `${spec.chapterId}.v21-native.chapter.json`), "utf8")),
      ), "human:manifest-regression", "manifest-regression-round");

      const result = promoteBook({
        bookId,
        title: "Drive",
        author: "Daniel H. Pink",
        chapters: index,
        categories: ["Psychology", "Self-Help", "Productivity", "Behavioral Economics"],
        tags: ["motivation", "autonomy", "mastery", "purpose", "incentives", "behavior-change"],
      });

      assert.equal(result.promoted, true, result.reason);
      const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
      assert.equal(pkg.packageId, pkg.productionManifest?.contentId, "package identity must be derived from the embedded production manifest");
      assert.equal(typeof pkg.productionManifest?.payloadHash, "string", "manifest must carry a recomputable canonical payload hash");
    });
  } finally {
    for (const spec of index) restoreFile(chapterStatePath(spec.chapterId), chapterBefore.get(spec.chapterId) ?? null);
    for (const spec of index) restoreFile(attestationPath(bookId, spec.chapterNumber), qcBefore.get(spec.chapterNumber) ?? null);
    rmSync(sourceRunDir(bookId, runId), { recursive: true, force: true });
    restoreFile(waiverPath(bookId), waiverBefore);
    restoreFile(reportPath, reportBefore);
    restoreFile(packagePath, packageBefore);
  }
});

test("promoteBook blocks unresolved majors by default and writes no visible package", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      const chapters = loadMajorFixtureChapters();
      assert.ok(currentMajorFindings(MAJOR_BOOK, chapters).length > 0, "fixture must expose current deterministic majors");
      const result = promoteMajorFixture(index);
      assert.equal(result.promoted, false, "unresolved majors must block production");
      assert.match(result.reason, /major/i);
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, "blocked major policy must leave no production package");
    });
  } finally {
    console.warn = oldWarn;
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanupFixture();
  }
});

test("content-bound major waivers permit only the exact finding/content and stale after edits", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
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
    });
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

test("stripInternalFields removes planSpec + sourceAnchorId everywhere, without staling the attestation hash", () => {
  const ch = makeChapter(BOOK, 9);
  for (const ex of ch.examples) {
    ex.sourceAnchorId = "a1";
    ex.sourceAnchorIds = ["a1"];
  }
  for (const q of ch.quiz.questions) {
    q.sourceAnchorId = "a2";
    q.sourceAnchorIds = ["a2"];
    q.keyEvidenceAnchorIds = ["a2"];
  }
  for (const card of ch.reviewCards) {
    card.sourceAnchorId = "a3";
    card.sourceAnchorIds = ["a3"];
  }
  ch.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "hash-a",
      observedAnchorIds: ["a1"],
      effectiveAnchors: { hook: ["a1"] },
    },
  };

  const before = chapterContentHash(ch);
  const shipped = stripInternalFields(ch);

  const json = JSON.stringify(shipped);
  assert.doesNotMatch(json, /planSpec/, "writer scaffolding must not ship to readers");
  assert.doesNotMatch(json, /sourceAnchorId/, "gate provenance must not ship to readers");
  assert.doesNotMatch(json, /authoring/, "authoring audit map must not ship to readers");
  assert.equal(shipped.examples[0].scenario, ch.examples[0].scenario, "reader content untouched");
  assert.equal(chapterContentHash(shipped), before, "the strip must never stale a QC attestation");
  assert.ok((ch.examples[0] as any).planSpec, "strip works on a copy — state chapters are not mutated");
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

// ── Concurrency-safe promotion: per-book lease + owner-proven recovery ────────
// promoteBook used to call recoverPromotionTransactions(bookId) at the start of
// every publish, broadly `rmSync`-removing EVERY `<bookId>.*` staging directory
// with no ownership/liveness/age check — a second promotion's "recovery" could
// delete a live promotion's staging transaction. These pin the replacement: a
// per-book lease serializes promotion, and recovery removes only directories
// proven to belong to a dead prior owner.

const PROMO_TX_DIR = resolve(PIPELINE_DIR, "state", "books", "_transactions");
const FIXED_NOW = "2026-06-23T00:00:00.000Z";
// A lease acquired here (with a tiny TTL) is genuinely EXPIRED by the time a
// promotion running at FIXED_NOW evaluates it — so the liveness gate, not the
// "still live" short-circuit, decides whether it may be recovered.
const STALE_AT = new Date(Date.parse(FIXED_NOW) - 60_000);

/** Remove the per-book promotion lock and any `.recovered-*` forensic siblings.
 *  cleanupFixture clears `_transactions` but not the separate `_locks` dir. */
function clearPromotionLocks(bookId: string): void {
  try {
    for (const f of readdirSync(promotionLockDir())) {
      if (f.startsWith(`${bookId}.promotion.lock`)) rmSync(resolve(promotionLockDir(), f), { force: true });
    }
  } catch { /* dir may not exist */ }
}

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

test("a live promotion lease blocks a second promotion and never touches its staging directory", () => {
  try {
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      // Process A: holds a LIVE lease (expires an hour after the fixed clock B uses)
      // and has a staging directory mid-publish.
      const a = acquirePromotionLease(MAJOR_BOOK, "tx-A", { now: new Date(FIXED_NOW), ttlMs: 60 * 60 * 1000 });
      const aStaging = writeFakeStagingTx(MAJOR_BOOK, "tx-A", { pid: process.pid, hostname: osHostname(), ownerToken: a.ownerToken });

      // Process B: a full promote. It must fail closed and leave A untouched.
      const b = promoteMajorFixture(index);
      assert.equal(b.promoted, false, "B must not publish while A holds the lease");
      // Require the LEASE-specific reason (not a permissive OR) so the test fails
      // loud if B were blocked by an upstream gate instead of the lease, rather
      // than passing for the wrong reason.
      assert.match(b.reason, /PROMOTION_LEASE_UNAVAILABLE: Promotion already active/, b.reason);
      assert.ok(existsSync(aStaging), "B must NOT delete A's staging directory (the old broad-delete hazard)");
      assert.ok(existsSync(resolve(aStaging, "package.v21.json")), "A's staged bytes survive B's attempt");
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, "B must not publish a production package");

      assert.equal(releasePromotionLease(a), true);
    });
  } finally {
    clearPromotionLocks(MAJOR_BOOK);
    cleanupFixture();
  }
});

test("a stale lease whose owner is still alive cannot be stolen by a second promotion", () => {
  try {
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      // Lease A is long past its TTL relative to B's clock, but its owner pid
      // (this very process) is alive — the long-running-promotion case a bare
      // wall-clock TTL would have wrongly stolen.
      const a = acquirePromotionLease(MAJOR_BOOK, "tx-A", { now: STALE_AT, ttlMs: 1 });

      const b = promoteMajorFixture(index); // B's now = FIXED_NOW, so A is "expired"
      assert.equal(b.promoted, false, "an expired-but-alive owner must not be displaced");
      // Require the liveness-gate reason specifically: if a future edit made the
      // lease look still-live (so the gate never ran), this fails instead of
      // silently passing via the lease-unavailable alternative.
      assert.match(b.reason, /PROMOTION_LEASE_UNAVAILABLE:[\s\S]*still alive/, b.reason);
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false);

      assert.equal(releasePromotionLease(a), true);
    });
  } finally {
    clearPromotionLocks(MAJOR_BOOK);
    cleanupFixture();
  }
});

test("an expired lease whose owner liveness is unknown fails the promotion closed", () => {
  try {
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      // A foreign-host owner: expired, but its death cannot be proven.
      acquirePromotionLease(MAJOR_BOOK, "tx-ghost", { now: STALE_AT, ttlMs: 1, hostname: "ghost-host-not-here" });

      const b = promoteMajorFixture(index); // default probe -> remote host -> unknown
      assert.equal(b.promoted, false, "unknown liveness must fail closed, not steal the lock");
      assert.match(b.reason, /PROMOTION_LEASE_UNAVAILABLE:[\s\S]*unknown; failing closed/, b.reason);
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false);
    });
  } finally {
    clearPromotionLocks(MAJOR_BOOK);
    cleanupFixture();
  }
});

test("an expired lease with a known-dead owner is recovered and the promotion proceeds", () => {
  try {
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      // A stale lease left by a now-dead owner. Capture its token so the test can
      // prove the recovered evidence is THIS owner's, not a leftover sibling.
      const dead = acquirePromotionLease(MAJOR_BOOK, "tx-dead", { now: STALE_AT, ttlMs: 1 });

      const result = promoteMajorWith(index, { leaseLiveness: () => "dead" });
      assert.equal(result.promoted, true, result.reason);
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), true, "a provably-dead owner's lease is recoverable");
      // Scope the evidence check to THIS book's recovered sibling AND confirm it
      // carries the displaced dead owner's token — so a leftover `.recovered-*`
      // from another fixture/run cannot satisfy this for the wrong reason.
      const recovered = readdirSync(promotionLockDir()).filter((name) =>
        name.startsWith(`${MAJOR_BOOK}.promotion.lock.recovered-`),
      );
      assert.equal(recovered.length, 1, `exactly one recovered sibling expected, got ${JSON.stringify(recovered)}`);
      const recoveredRecord = JSON.parse(readFileSync(resolve(promotionLockDir(), recovered[0]), "utf8"));
      assert.equal(recoveredRecord.ownerToken, dead.ownerToken, "the forensic sibling is the displaced dead owner's lock");
    });
  } finally {
    clearPromotionLocks(MAJOR_BOOK);
    cleanupFixture();
  }
});

test("two simulated promotions for one book cannot both publish", () => {
  try {
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      // Promotion A is in progress: it holds the live lease.
      const a = acquirePromotionLease(MAJOR_BOOK, "tx-A", { now: new Date(FIXED_NOW), ttlMs: 60 * 60 * 1000 });

      // Promotion B cannot publish while A is live.
      const blockedB = promoteMajorFixture(index);
      assert.equal(blockedB.promoted, false, "B cannot publish concurrently with A");
      assert.match(blockedB.reason, /PROMOTION_LEASE_UNAVAILABLE: Promotion already active/, blockedB.reason);
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, "no package while A holds the lease");

      // A finishes and releases — now exactly one promotion may publish.
      assert.equal(releasePromotionLease(a), true);
      const published = promoteMajorFixture(index);
      assert.equal(published.promoted, true, published.reason);
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), true, "after A releases, a single promotion publishes");
    });
  } finally {
    clearPromotionLocks(MAJOR_BOOK);
    cleanupFixture();
  }
});

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

      // The lease was released on the way out, so a clean re-promote can proceed.
      assert.equal(existsSync(promotionLockPath(MAJOR_BOOK)), false, "the faulted owner released its lease");
    });
  } finally {
    console.warn = oldWarn;
    clearPromotionLocks(MAJOR_BOOK);
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
    clearPromotionLocks(MAJOR_BOOK);
    cleanupFixture();
  }
});

test("a successor stealing the lock mid-publish aborts the owner at the rename and never force-publishes (req 15)", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      // Simulate a successor recovering the lock between staging and the final
      // rename: overwrite the on-disk lock with a foreign owner token at the seam
      // promoteBook exposes immediately before its pre-rename ownership re-assert.
      const foreignToken = "successor-token-deadbeefdeadbeef";
      const steal = (): void => {
        const lockPath = promotionLockPath(MAJOR_BOOK);
        const rec = JSON.parse(readFileSync(lockPath, "utf8"));
        rec.ownerToken = foreignToken;
        writeFileSync(lockPath, JSON.stringify(rec, null, 2), "utf8");
      };

      assert.throws(
        () => promoteMajorWith(index, { transactionId: "tx-steal", onBeforeFinalRename: steal }),
        /no longer holds the lock/,
        "the original owner must abort at the ownership re-assert, not force the rename",
      );

      // Requirement 15: the package was NOT force-published behind the successor.
      assert.equal(existsSync(productionPackagePath(MAJOR_BOOK)), false, "ownership loss must NOT publish a package");
      // The successor's lock survives — the aborted owner's release is a no-op.
      const surviving = JSON.parse(readFileSync(promotionLockPath(MAJOR_BOOK), "utf8"));
      assert.equal(surviving.ownerToken, foreignToken, "the successor's lock must survive the aborted owner");
      // The journal never advanced to 'published' (the rename never ran).
      const journal = JSON.parse(readFileSync(resolve(PROMO_TX_DIR, `${MAJOR_BOOK}.tx-steal`, "journal.json"), "utf8"));
      assert.notEqual(journal.state, "published", "a lost-ownership publish must not reach the published state");
    });
  } finally {
    console.warn = oldWarn;
    // The foreign-token lock is not ours to release via the API; clear directly.
    clearPromotionLocks(MAJOR_BOOK);
    cleanupFixture();
  }
});

test("a promotion that cannot acquire the lease performs NO transaction recovery (reap is gated behind acquisition: req 1)", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    withPromotionEnvCleared(() => {
      const index = setupMajorCleanFixture();
      waiveCurrentMajors(MAJOR_BOOK);
      rmSync(productionPackagePath(MAJOR_BOOK), { force: true });

      // A dead-owner orphan that recovery WOULD reap — if recovery ran.
      const deadDir = writeFakeStagingTx(MAJOR_BOOK, "dead-orphan", { pid: 424242, hostname: osHostname() });

      // Another process holds the lease live, so B cannot acquire it.
      const a = acquirePromotionLease(MAJOR_BOOK, "tx-A", { now: new Date(FIXED_NOW), ttlMs: 60 * 60 * 1000 });

      // B fails closed at acquisition. Because reap runs strictly AFTER a
      // successful acquire, the dead-owner orphan must SURVIVE — proving recovery
      // is gated behind the lease and never runs lock-free (requirement 1).
      const b = promoteMajorFixture(index);
      assert.equal(b.promoted, false, "B cannot acquire while A holds the lease");
      assert.match(b.reason, /PROMOTION_LEASE_UNAVAILABLE: Promotion already active/, b.reason);
      assert.ok(existsSync(deadDir), "recovery must NOT run when the lease is unavailable (it is gated behind acquisition)");

      assert.equal(releasePromotionLease(a), true);
    });
  } finally {
    console.warn = oldWarn;
    clearPromotionLocks(MAJOR_BOOK);
    cleanupFixture();
  }
});
