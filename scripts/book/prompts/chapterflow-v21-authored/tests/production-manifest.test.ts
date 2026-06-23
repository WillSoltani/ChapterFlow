import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { canonicalJsonSha256 } from "../src/lib/canonicalJson.js";
import { stripInternalFields } from "../src/lib/readerContent.js";
import { buildProductionManifest } from "../src/productionManifest.js";
import { V21_SCHEMA_VERSION, type BookPackageV21, type ChapterV21 } from "../src/types.js";
import { packagePathForBook, verifyProductionPackage } from "../src/verifyProductionPackage.js";
import { cleanTmp, makeChapter, runCli, TMP_DIR, writeResearchRunManifestFixture } from "./helpers.js";
import { test } from "./harness.js";

const BOOK = "zz-fixture-production-manifest";
const TITLE = "Production Manifest Fixture";
const AUTHOR = "Nobody";

function writeJson(path: string, value: unknown): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

function readJson<T = any>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).reverse().map(([k, v]) => [k, reverseKeys(v)]));
  }
  return value;
}

function fixtureRoot(name: string): string {
  return resolve(TMP_DIR, `production-manifest-${name}`);
}

function makeFixture(name: string, createdAt = "2026-06-23T00:00:00.000Z"): {
  root: string;
  stateRoot: string;
  runsRoot: string;
  packagePath: string;
  pkg: BookPackageV21;
  chapters: ChapterV21[];
  indexPath: string;
  sourcePath: string;
  qcPath: string;
} {
  const root = fixtureRoot(name);
  rmSync(root, { recursive: true, force: true });
  const stateRoot = resolve(root, "state");
  const runsRoot = resolve(root, "runs");
  const packagePath = resolve(root, "book-packages", `${BOOK}.v21.json`);
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const index = chapters.map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title }));
  const indexPath = resolve(stateRoot, "indexes", `${BOOK}.json`);
  writeJson(indexPath, index);
  writeResearchRunManifestFixture({
    runDir: resolve(runsRoot, BOOK, "run-a"),
    bookId: BOOK,
    chapters: index.map((ch) => ({ number: ch.chapterNumber, title: ch.chapterTitle })),
  });

  for (const ch of chapters) {
    writeJson(resolve(stateRoot, "chapters", `${ch.chapterId}.v21-native.chapter.json`), ch);
    writeJson(resolve(runsRoot, BOOK, "run-a", "sidecars", "source", `ch${String(ch.number).padStart(2, "0")}.source.json`), {
      schemaVersion: "source-v2",
      bookId: BOOK,
      chapterId: ch.chapterId,
      chapterNumber: ch.number,
      centralConcept: { name: `Concept ${ch.number}`, plainDefinition: "Synthetic source evidence." },
      testableFacts: [{ id: `fact-${ch.number}`, claim: "claim", becauseMechanism: "because", commonError: "error", errorIsWhy: "why" }],
    });
    writeJson(resolve(stateRoot, "qc", `${BOOK}-ch${String(ch.number).padStart(2, "0")}.qc.json`), {
      schemaVersion: "qc-attest-v1",
      bookId: BOOK,
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(ch),
      hashVersion: "v2",
      reviewer: "codex-qc:production-manifest-test",
      reviewedAt: "2026-06-23T00:00:00.000Z",
      roundId: "round-a",
      roundRole: "attest",
    });
  }

  const shipped = chapters.map((ch) => stripInternalFields(ch));
  const manifestResult = buildProductionManifest({
    bookId: BOOK,
    title: TITLE,
    author: AUTHOR,
    contentOwner: "chapterflow",
    categories: ["Self-Help"],
    tags: ["fixture"],
    chapters: shipped,
    stateRoot,
    runsRoot,
    createdAt,
    runId: "run-a",
    packagePath,
  });
  assert.equal(manifestResult.ok, true, manifestResult.ok ? "" : manifestResult.findings.map((f) => f.message).join("\n"));
  if (!manifestResult.ok) throw new Error("manifest build failed");
  const pkg: BookPackageV21 = {
    schemaVersion: V21_SCHEMA_VERSION,
    packageId: manifestResult.manifest.contentId,
    createdAt,
    contentOwner: "chapterflow",
    book: { bookId: BOOK, title: TITLE, author: AUTHOR, categories: ["Self-Help"], tags: ["fixture"] },
    productionManifest: manifestResult.manifest,
    chapters: shipped,
  };
  writeJson(packagePath, pkg);
  return {
    root,
    stateRoot,
    runsRoot,
    packagePath,
    pkg,
    chapters,
    indexPath,
    sourcePath: resolve(runsRoot, BOOK, "run-a", "sidecars", "source", "ch01.source.json"),
    qcPath: resolve(stateRoot, "qc", `${BOOK}-ch01.qc.json`),
  };
}

function verifyFixture(f: ReturnType<typeof makeFixture>) {
  return verifyProductionPackage({
    packagePath: f.packagePath,
    stateRoot: f.stateRoot,
    runsRoot: f.runsRoot,
    compareLooseState: true,
  });
}

test("verifyProductionPackage accepts a valid synthetic package and the CLI reports PASS", () => {
  const f = makeFixture("valid");
  try {
    const result = verifyFixture(f);
    assert.equal(result.ok, true, result.findings.map((finding) => finding.message).join("\n"));
    assert.equal(result.contentId, f.pkg.productionManifest.contentId);

    const cli = runCli([
      "verify-production-package",
      f.packagePath,
      "--state-root",
      f.stateRoot,
      "--runs-root",
      f.runsRoot,
      "--compare-loose-state",
    ]);
    assert.equal(cli.status, 0, cli.out);
    assert.match(cli.out, /PASS/);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("verifyProductionPackage rejects package/index/source/QC/manifest tampering", () => {
  const cases: Array<{ name: string; mutate: (f: ReturnType<typeof makeFixture>) => void; check: RegExp }> = [
    {
      name: "chapter-field",
      check: /qc_stale|manifest_payload_mismatch|chapter_hash_mismatch/i,
      mutate: (f) => {
        const pkg = readJson<BookPackageV21>(f.packagePath);
        pkg.chapters[0].title += " tampered";
        writeJson(f.packagePath, pkg);
      },
    },
    {
      name: "index-order",
      check: /CHSET\.position_mismatch/,
      mutate: (f) => {
        const index = readJson<any[]>(f.indexPath);
        writeJson(f.indexPath, [index[1], index[0]]);
      },
    },
    {
      name: "source-sidecar",
      check: /manifest_payload_mismatch|content_id_recomputed_mismatch/i,
      mutate: (f) => {
        const source = readJson(f.sourcePath);
        source.testableFacts[0].claim = "changed claim";
        writeJson(f.sourcePath, source);
      },
    },
    {
      name: "qc-artifact",
      check: /manifest_payload_mismatch|content_id_recomputed_mismatch/i,
      mutate: (f) => {
        const qc = readJson(f.qcPath);
        qc.notes = "changed QC observation";
        writeJson(f.qcPath, qc);
      },
    },
    {
      name: "manifest-hash",
      check: /PPKG\.manifest_hash_mismatch/,
      mutate: (f) => {
        const pkg = readJson<BookPackageV21>(f.packagePath);
        pkg.productionManifest.payloadHash = canonicalJsonSha256({ not: "the payload" });
        writeJson(f.packagePath, pkg);
      },
    },
    {
      name: "package-order",
      check: /CHSET\.position_mismatch/,
      mutate: (f) => {
        const pkg = readJson<BookPackageV21>(f.packagePath);
        pkg.chapters = [pkg.chapters[1], pkg.chapters[0]];
        writeJson(f.packagePath, pkg);
      },
    },
  ];

  for (const c of cases) {
    const f = makeFixture(c.name);
    try {
      c.mutate(f);
      const result = verifyFixture(f);
      assert.equal(result.ok, false, `${c.name} should fail verification`);
      const ids = result.findings.map((finding) => finding.checkId).join("\n");
      assert.match(ids, c.check, `${c.name} failed imprecisely:\n${ids}\n${result.findings.map((finding) => finding.message).join("\n")}`);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  }
});

test("canonical JSON whitespace/key-order-only changes do not change semantic hashes or verification", () => {
  const f = makeFixture("canonical-json");
  try {
    const before = verifyFixture(f);
    assert.equal(before.ok, true);
    const index = readJson(f.indexPath);
    const source = readJson(f.sourcePath);
    writeFileSync(f.indexPath, JSON.stringify(reverseKeys(index), null, 4), "utf8");
    writeFileSync(f.sourcePath, JSON.stringify(reverseKeys(source), null, 4), "utf8");
    assert.equal(canonicalJsonSha256(index), canonicalJsonSha256(readJson(f.indexPath)));
    assert.equal(canonicalJsonSha256(source), canonicalJsonSha256(readJson(f.sourcePath)));
    const after = verifyFixture(f);
    assert.equal(after.ok, true, after.findings.map((finding) => finding.message).join("\n"));
    assert.equal(after.contentId, before.contentId);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("same logical package receives the same content ID at different creation times", () => {
  const f = makeFixture("stable-content-id", "2026-06-23T00:00:00.000Z");
  try {
    const shipped = f.chapters.map((ch) => stripInternalFields(ch));
    const again = buildProductionManifest({
      bookId: BOOK,
      title: TITLE,
      author: AUTHOR,
      contentOwner: "chapterflow",
      categories: ["Self-Help"],
      tags: ["fixture"],
      chapters: shipped,
      stateRoot: f.stateRoot,
      runsRoot: f.runsRoot,
      createdAt: "2026-06-24T00:00:00.000Z",
      runId: "run-b",
      packagePath: f.packagePath,
    });
    assert.equal(again.ok, true);
    if (!again.ok) throw new Error("manifest build failed");
    assert.equal(again.manifest.contentId, f.pkg.productionManifest.contentId);
    assert.notEqual(again.manifest.metadata.createdAt, f.pkg.productionManifest.metadata.createdAt);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("missing claimed source evidence fails closed with a precise finding and does not mutate the package", () => {
  const f = makeFixture("missing-evidence");
  try {
    const before = readFileSync(f.packagePath, "utf8");
    rmSync(f.sourcePath, { force: true });
    const result = verifyFixture(f);
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.checkId === "PPKG.source_missing" && finding.chapterNumber === 1), result.findings.map((finding) => finding.checkId).join("\n"));
    assert.equal(readFileSync(f.packagePath, "utf8"), before, "verification must not mutate package bytes");
  } finally {
    rmSync(f.root, { recursive: true, force: true });
    cleanTmp();
  }
});

test("packagePathForBook resolves production package names without touching state", () => {
  const p = packagePathForBook("Some Book!");
  assert.match(p, /book-packages\/some-book\.v21\.json$/);
  assert.equal(existsSync(p), false);
});
