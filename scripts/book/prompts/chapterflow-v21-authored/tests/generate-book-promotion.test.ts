import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { chapterContentHash, attestationPath, writeAttestation } from "../src/critics/qcAttestation.js";
import { currentProviderIdentity, writeStageCacheManifest } from "../src/cache/stageCache.js";
import { buildChapterCacheInputs } from "../src/generateChapter.js";
import { generateBook, loadChapterIndex } from "../src/generateBook.js";
import { loadAuthorProvenance, provenancePath } from "../src/qc/sessionProvenance.js";
import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS } from "./helpers.js";

function snapshotFile(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function restoreFile(path: string, snapshot: string | null): void {
  if (snapshot === null) rmSync(path, { force: true });
  else writeFileSync(path, snapshot, "utf8");
}

test("generateBook range runs do not write or overwrite production packages", async () => {
  const bookId = "drive";
  const chapterNumber = 6;
  const index = loadChapterIndex(bookId);
  const chapterSpec = index.find((spec) => spec.chapterNumber === chapterNumber);
  assert.ok(chapterSpec, "drive fixture must include chapter 6");

  const packagePath = resolve(PIPELINE_DIR, "../../../../book-packages", `${bookId}.v21.json`);
  const gateReportPath = resolve(PIPELINE_DIR, "state", "books", `${bookId}.gate.json`);
  const bookGateReportPath = resolve(PIPELINE_DIR, "state", "books", `${bookId}.book-gate.json`);
  const ledgerPath = resolve(PIPELINE_DIR, "state", "library-state.json");
  const qcPath = attestationPath(bookId, chapterNumber);
  const chapterPath = resolve(STATE_CHAPTERS, `${chapterSpec.chapterId}.v21-native.chapter.json`);
  const cacheManifestPath = `${chapterPath}.cache-manifest.json`;
  const authorProvenancePath = provenancePath(chapterSpec.chapterId);
  const packageBefore = readFileSync(packagePath, "utf8");
  const gateReportBefore = snapshotFile(gateReportPath);
  const bookGateReportBefore = snapshotFile(bookGateReportPath);
  const ledgerBefore = snapshotFile(ledgerPath);
  const qcBefore = snapshotFile(qcPath);
  const cacheManifestBefore = snapshotFile(cacheManifestPath);
  const authorProvenanceBefore = snapshotFile(authorProvenancePath);
  const prevNoApi = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const prevRequireKeyJudge = process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE;
  const prevSessionId = process.env.CHAPTERFLOW_SESSION_ID;

  try {
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    delete process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE;
    process.env.CHAPTERFLOW_SESSION_ID = "author-generate-range-regression";
    const chapter = JSON.parse(readFileSync(chapterPath, "utf8"));
    writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId,
      chapterNumber,
      chapterId: chapterSpec.chapterId,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(chapter),
      hashVersion: "v2",
      reviewer: "claude-qc:generate-range-regression",
      reviewedAt: "2026-06-23T00:00:00.000Z",
    });
    writeStageCacheManifest({
      artifactPath: chapterPath,
      artifactType: "chapter",
      artifactId: chapterSpec.chapterId,
      inputs: buildChapterCacheInputs(
        { bookId, title: "Drive", author: "Daniel H. Pink" },
        chapterSpec,
        currentProviderIdentity("writer"),
      ),
      generatorName: "generateChapter",
      provider: currentProviderIdentity("writer"),
    });

    const result = await generateBook(
      { bookId, title: "Drive", author: "Daniel H. Pink" },
      index,
      {
        fromChapter: chapterNumber,
        toChapter: chapterNumber,
        noCategorizer: true,
        manualCategories: ["Psychology"],
        manualTags: ["motivation"],
        logger: () => {},
      },
    );

    assert.equal(result.failed.length, 0);
    assert.equal(loadAuthorProvenance(chapterSpec.chapterId)?.authorSessionId, "author-generate-range-regression");
    assert.equal(result.promotion, undefined, "partial range generation must stop before production promotion");
    assert.equal(readFileSync(packagePath, "utf8"), packageBefore, "range generation must not overwrite the existing production package");
  } finally {
    restoreFile(qcPath, qcBefore);
    restoreFile(gateReportPath, gateReportBefore);
    restoreFile(bookGateReportPath, bookGateReportBefore);
    restoreFile(ledgerPath, ledgerBefore);
    restoreFile(packagePath, packageBefore);
    restoreFile(cacheManifestPath, cacheManifestBefore);
    restoreFile(authorProvenancePath, authorProvenanceBefore);
    if (prevNoApi === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prevNoApi;
    if (prevRequireKeyJudge === undefined) delete process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE;
    else process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE = prevRequireKeyJudge;
    if (prevSessionId === undefined) delete process.env.CHAPTERFLOW_SESSION_ID;
    else process.env.CHAPTERFLOW_SESSION_ID = prevSessionId;
  }
});
