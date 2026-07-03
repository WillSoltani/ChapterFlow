import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, TMP_DIR, cleanTmp, makeChapter } from "./helpers.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import {
  AuthorProvenanceConflictError,
  cacheAcceptancePath,
  classifySessionProvenance,
  loadAuthorProvenance,
  loadCacheAcceptances,
  provenancePath,
  recordAuthorProvenance,
  recordCacheAcceptance,
  recordCompilerAssemblyProvenance,
  violatesSessionIndependence,
} from "../src/qc/sessionProvenance.js";

const BOOK = "zz-fixture-author-provenance";
const CHAPTER_ID = `${BOOK}-ch01`;

function cleanup(): void {
  cleanTmp();
  rmSync(provenancePath(CHAPTER_ID), { force: true });
}

test("applyAuthored stamps author provenance for manually accepted chapter content", () => {
  try {
    cleanup();
    const chapterPath = resolve(TMP_DIR, `${CHAPTER_ID}.v21-native.chapter.json`);
    const patchPath = resolve(TMP_DIR, "manual-patch.json");
    mkdirSync(dirname(chapterPath), { recursive: true });
    writeFileSync(chapterPath, JSON.stringify(makeChapter(BOOK, 1), null, 2) + "\n", "utf8");
    writeFileSync(patchPath, JSON.stringify({ coreSkill: "Compare the source note before routing the next visible action." }, null, 2), "utf8");

    const result = spawnSync("npx", ["tsx", "src/scratch/applyAuthored.ts", chapterPath, patchPath], {
      cwd: PIPELINE_DIR,
      encoding: "utf8",
      env: { ...process.env, CHAPTERFLOW_SESSION_ID: "manual-author-session" },
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(loadAuthorProvenance(CHAPTER_ID)?.authorSessionId, "manual-author-session");
  } finally {
    cleanup();
  }
});

test("applyAuthored refuses manual acceptance without CHAPTERFLOW_SESSION_ID", () => {
  try {
    cleanup();
    const chapterPath = resolve(TMP_DIR, `${CHAPTER_ID}.v21-native.chapter.json`);
    const patchPath = resolve(TMP_DIR, "manual-patch.json");
    mkdirSync(dirname(chapterPath), { recursive: true });
    writeFileSync(chapterPath, JSON.stringify(makeChapter(BOOK, 1), null, 2) + "\n", "utf8");
    writeFileSync(patchPath, JSON.stringify({ coreSkill: "Compare the source note before routing the next visible action." }, null, 2), "utf8");
    const env = { ...process.env };
    delete env.CHAPTERFLOW_SESSION_ID;

    const result = spawnSync("npx", ["tsx", "src/scratch/applyAuthored.ts", chapterPath, patchPath], {
      cwd: PIPELINE_DIR,
      encoding: "utf8",
      env,
      timeout: 30_000,
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /CHAPTERFLOW_SESSION_ID/);
    assert.equal(loadAuthorProvenance(CHAPTER_ID), null);
  } finally {
    cleanup();
  }
});

test("applyAuthored re-run with identical content under a DIFFERENT session preserves the original author (idempotent, no crash)", () => {
  try {
    cleanup();
    const chapterPath = resolve(TMP_DIR, `${CHAPTER_ID}.v21-native.chapter.json`);
    const patchPath = resolve(TMP_DIR, "manual-patch.json");
    mkdirSync(dirname(chapterPath), { recursive: true });
    writeFileSync(chapterPath, JSON.stringify(makeChapter(BOOK, 1), null, 2) + "\n", "utf8");
    writeFileSync(patchPath, JSON.stringify({ coreSkill: "Compare the source note before routing the next visible action." }, null, 2), "utf8");

    const run = (session: string) =>
      spawnSync("npx", ["tsx", "src/scratch/applyAuthored.ts", chapterPath, patchPath], {
        cwd: PIPELINE_DIR,
        encoding: "utf8",
        env: { ...process.env, CHAPTERFLOW_SESSION_ID: session },
        timeout: 30_000,
      });

    const first = run("apply-author-A");
    assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
    assert.equal(loadAuthorProvenance(CHAPTER_ID)?.authorSessionId, "apply-author-A");

    // Re-applying the SAME patch (byte-identical resulting content) under a DIFFERENT
    // session must not crash and must not transfer authorship to the re-applier.
    const second = run("apply-author-B");
    assert.equal(second.status, 0, `idempotent re-apply must not crash: ${second.stdout}\n${second.stderr}`);
    assert.equal(
      loadAuthorProvenance(CHAPTER_ID)?.authorSessionId,
      "apply-author-A",
      "identical-content re-apply must preserve the original author, not the re-applier",
    );
  } finally {
    cleanup();
  }
});

// ── Provenance lifecycle: author identity survives cache reuse / ingestion ─────
// These pin the corrected contract: author provenance identifies the session that
// AUTHORED the current content; a cache accepter is never an author; provenance is
// create-once per content hash; only a deliberate re-authoring that CHANGES the
// content may replace an author, and an identical-content overwrite fails loudly.

const LC_BOOK = "zz-provenance-lifecycle";
const LC_CH = `${LC_BOOK}-ch01`;

function cleanLifecycle(): void {
  rmSync(provenancePath(LC_CH), { force: true });
  rmSync(cacheAcceptancePath(LC_CH), { force: true });
}

function reauthoredHash(): string {
  // A genuinely re-authored variant: changing a reader field changes the content hash.
  return chapterContentHash(
    makeChapter(LC_BOOK, 1, {
      overrides: { keyTakeaway: "A re-authored takeaway that materially changes the reader content under a new session." },
    }),
  );
}

test("create-once: the first author is recorded and bound to the content hash (v2)", () => {
  try {
    cleanLifecycle();
    const hashA = chapterContentHash(makeChapter(LC_BOOK, 1));
    recordAuthorProvenance(LC_CH, "session-A", hashA);
    const rec = loadAuthorProvenance(LC_CH);
    assert.equal(rec?.authorSessionId, "session-A");
    assert.equal(rec?.contentHash, hashA);
    assert.equal(rec?.schemaVersion, "author-provenance-v2");
  } finally {
    cleanLifecycle();
  }
});

test("author A authors; session B reusing the cache keeps A as author and is logged separately", () => {
  // scenarios 1 + 2: cache acceptance under B may record B separately but never as author.
  try {
    cleanLifecycle();
    const hashA = chapterContentHash(makeChapter(LC_BOOK, 1));
    recordAuthorProvenance(LC_CH, "session-A", hashA);

    recordCacheAcceptance({ chapterId: LC_CH, sessionId: "session-B", contentHash: hashA, cacheManifestHash: "manifest-hash" });

    assert.equal(loadAuthorProvenance(LC_CH)?.authorSessionId, "session-A", "author remains A after B reuses the cache");
    const acc = loadCacheAcceptances(LC_CH);
    assert.equal(acc.length, 1);
    assert.equal(acc[0].cacheAcceptedBySessionId, "session-B");
    assert.equal(acc[0].contentHash, hashA);
    assert.equal(acc[0].cacheManifestHash, "manifest-hash");
  } finally {
    cleanLifecycle();
  }
});

test("a chapter with no author provenance reused by B remains legacy/unknown (acceptance ≠ author)", () => {
  // scenario 3 + requirement 9: cache-acceptance evidence must not be read as author evidence.
  try {
    cleanLifecycle();
    recordCacheAcceptance({ chapterId: LC_CH, sessionId: "session-B", contentHash: chapterContentHash(makeChapter(LC_BOOK, 1)), cacheManifestHash: "m" });
    assert.equal(loadAuthorProvenance(LC_CH), null, "acceptance must not create author provenance");
    const state = classifySessionProvenance(loadAuthorProvenance(LC_CH)?.authorSessionId, `author ${LC_CH}`);
    assert.equal(state.kind, "legacy_unknown", "missing author provenance stays legacy/unknown and cannot certify");
    assert.equal(loadCacheAcceptances(LC_CH).length, 1, "the acceptance is still recorded as its own audit event");
  } finally {
    cleanLifecycle();
  }
});

test("a later reviewer session B is detected as independent from author A", () => {
  // scenario 4
  const prev = process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
  try {
    cleanLifecycle();
    process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = "1";
    recordAuthorProvenance(LC_CH, "session-A", chapterContentHash(makeChapter(LC_BOOK, 1)));
    const author = loadAuthorProvenance(LC_CH)?.authorSessionId;
    assert.equal(violatesSessionIndependence(author, "session-B"), false, "A authored, B reviews ⇒ independent");
    assert.equal(violatesSessionIndependence(author, "session-A"), true, "A authored AND A reviews ⇒ violation");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    else process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = prev;
    cleanLifecycle();
  }
});

test("re-authoring CHANGED content under C creates a new content-bound record with the transition", () => {
  // scenario 5
  try {
    cleanLifecycle();
    const hashA = chapterContentHash(makeChapter(LC_BOOK, 1));
    recordAuthorProvenance(LC_CH, "session-A", hashA);

    const hashC = reauthoredHash();
    assert.notEqual(hashC, hashA, "fixture sanity: re-authored content has a different hash");
    recordAuthorProvenance(LC_CH, "session-C", hashC);

    const rec = loadAuthorProvenance(LC_CH);
    assert.equal(rec?.authorSessionId, "session-C");
    assert.equal(rec?.contentHash, hashC);
    assert.equal(rec?.previousContentHash, hashA, "transition records the prior content hash");
    assert.equal(rec?.previousAuthorSessionId, "session-A", "transition records the prior author");
  } finally {
    cleanLifecycle();
  }
});

test("reusing IDENTICAL content under C cannot replace author A — loud conflict", () => {
  // scenario 6 + requirement 11
  try {
    cleanLifecycle();
    const hashA = chapterContentHash(makeChapter(LC_BOOK, 1));
    recordAuthorProvenance(LC_CH, "session-A", hashA);
    assert.throws(
      () => recordAuthorProvenance(LC_CH, "session-C", hashA),
      (err: unknown) => err instanceof AuthorProvenanceConflictError && err.existingAuthorSessionId === "session-A" && err.attemptedAuthorSessionId === "session-C",
      "identical content + different author must throw AuthorProvenanceConflictError",
    );
    assert.equal(loadAuthorProvenance(LC_CH)?.authorSessionId, "session-A", "author A is preserved after the refused overwrite");
  } finally {
    cleanLifecycle();
  }
});

test("idempotent: the same author re-stamping identical content is a no-op success", () => {
  try {
    cleanLifecycle();
    const hashA = chapterContentHash(makeChapter(LC_BOOK, 1));
    recordAuthorProvenance(LC_CH, "session-A", hashA);
    const stampedAt = loadAuthorProvenance(LC_CH)?.stampedAt;
    assert.doesNotThrow(() => recordAuthorProvenance(LC_CH, "session-A", hashA));
    assert.equal(loadAuthorProvenance(LC_CH)?.authorSessionId, "session-A");
    assert.equal(loadAuthorProvenance(LC_CH)?.stampedAt, stampedAt, "an idempotent re-stamp does not rewrite the record");
  } finally {
    cleanLifecycle();
  }
});

test("a hash-less re-stamp from a different session cannot clobber a content-bound author", () => {
  // requirement 11 (defensive): a v2 record is never blindly overwritten without a proving hash.
  try {
    cleanLifecycle();
    const hashA = chapterContentHash(makeChapter(LC_BOOK, 1));
    recordAuthorProvenance(LC_CH, "session-A", hashA);
    assert.throws(() => recordAuthorProvenance(LC_CH, "session-B"), AuthorProvenanceConflictError);
    assert.equal(loadAuthorProvenance(LC_CH)?.authorSessionId, "session-A");
  } finally {
    cleanLifecycle();
  }
});

test("a legacy v1 record (no content hash) is upgraded by a genuine re-author, keeping the prior author in the transition", () => {
  // legacy provenance handling: backward-compatible overwrite for hash-less records.
  try {
    cleanLifecycle();
    recordAuthorProvenance(LC_CH, "legacy-A"); // no hash ⇒ v1 record
    assert.equal(loadAuthorProvenance(LC_CH)?.schemaVersion, "author-provenance-v1");
    assert.equal(loadAuthorProvenance(LC_CH)?.contentHash, undefined);

    recordAuthorProvenance(LC_CH, "author-B", reauthoredHash());
    const rec = loadAuthorProvenance(LC_CH);
    assert.equal(rec?.schemaVersion, "author-provenance-v2");
    assert.equal(rec?.authorSessionId, "author-B");
    assert.equal(rec?.previousAuthorSessionId, "legacy-A");
  } finally {
    cleanLifecycle();
  }
});

test("provenance and cache-acceptance writes never change the chapter content hash", () => {
  // scenario 7 + requirement 7
  try {
    cleanLifecycle();
    const ch = makeChapter(LC_BOOK, 1);
    const before = chapterContentHash(ch);
    recordAuthorProvenance(LC_CH, "session-A", before);
    recordCacheAcceptance({ chapterId: LC_CH, sessionId: "session-B", contentHash: before, cacheManifestHash: "m" });
    assert.equal(chapterContentHash(ch), before, "sidecar writes must not affect the reader content hash");
  } finally {
    cleanLifecycle();
  }
});

test("recordAuthorProvenance and recordCacheAcceptance are no-ops without a session id", () => {
  const prev = process.env.CHAPTERFLOW_SESSION_ID;
  try {
    cleanLifecycle();
    delete process.env.CHAPTERFLOW_SESSION_ID;
    const hashA = chapterContentHash(makeChapter(LC_BOOK, 1));
    assert.equal(recordAuthorProvenance(LC_CH, undefined, hashA), null);
    assert.equal(loadAuthorProvenance(LC_CH), null);
    assert.equal(recordCacheAcceptance({ chapterId: LC_CH, sessionId: undefined, contentHash: hashA, cacheManifestHash: "m" }), null);
    assert.equal(loadCacheAcceptances(LC_CH).length, 0);
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_SESSION_ID;
    else process.env.CHAPTERFLOW_SESSION_ID = prev;
    cleanLifecycle();
  }
});


test("v23 compiler assembly stamps chapter-level author provenance with contributor audit", () => {
  const chapterId = `${BOOK}-compiler-ch01`;
  const path = provenancePath(chapterId);
  try {
    rmSync(path, { force: true });
    const hash = chapterContentHash(makeChapter(BOOK, 1));
    recordCompilerAssemblyProvenance({
      chapterId,
      assemblerSessionId: "compiler-assembly-session",
      contentHash: hash,
      contributorSessionIds: ["section-summary", "section-example", "section-example"],
    });
    const rec = loadAuthorProvenance(chapterId);
    assert.equal(rec?.authorSessionId, "compiler-assembly-session");
    assert.equal(rec?.contentHash, hash);
    assert.equal(rec?.producer, "v23-compiler-assembler");
    assert.deepEqual(rec?.contributorSessionIds, ["section-example", "section-summary"]);

    // Idempotent assembly of identical content by a new conductor must not reassign authorship.
    recordCompilerAssemblyProvenance({
      chapterId,
      assemblerSessionId: "different-conductor-session",
      contentHash: hash,
      contributorSessionIds: ["section-action"],
    });
    assert.equal(loadAuthorProvenance(chapterId)?.authorSessionId, "compiler-assembly-session");
  } finally {
    rmSync(path, { force: true });
  }
});
