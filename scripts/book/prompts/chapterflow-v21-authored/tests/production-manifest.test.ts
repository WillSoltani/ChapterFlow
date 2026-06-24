import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { canonicalJsonSha256 } from "../src/lib/canonicalJson.js";
import { stripInternalFields } from "../src/lib/readerContent.js";
import {
  buildProductionManifest,
  PRODUCTION_MANIFEST_SCHEMA_VERSION_V1,
  PRODUCTION_MANIFEST_SCHEMA_VERSION_V2,
  type BuildProductionManifestInput,
  type ProductionManifestPayloadV2,
} from "../src/productionManifest.js";
import type { FingerprintRoots } from "../src/lib/pipelineFingerprint.js";
import {
  canonicalIndexHashFor,
  collectSourceVerifyItems,
  LEGACY_EXEMPTION_SCHEMA,
} from "../src/qc/sourceRealityPolicy.js";
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

function addAuthoringEvidence(chapter: ChapterV21): ChapterV21 {
  const anchorId = `fact-${chapter.number}`;
  const effectiveAnchors: Record<string, string[]> = {
    hook: [anchorId],
    counterintuition: [anchorId],
    "breakdown.fastRead": [anchorId],
    "breakdown.deepRead": [anchorId],
    "breakdown.fullRead": [anchorId],
    keyTakeaway: [anchorId],
    tryThisNow: [anchorId],
    "implementationPlan.title": [anchorId],
    "implementationPlan.coreSkill": [anchorId],
    "implementationPlan.twentyFourHourChallenge": [anchorId],
    "implementationPlan.weeklyPractice": [anchorId],
  };
  chapter.examples.forEach((example, i) => {
    example.sourceAnchorId = anchorId;
    example.sourceAnchorIds = [anchorId];
    effectiveAnchors[`examples[${i}]`] = [anchorId];
  });
  chapter.quiz.questions.forEach((question, i) => {
    question.sourceAnchorId = anchorId;
    question.sourceAnchorIds = [anchorId];
    question.keyEvidenceAnchorIds = [anchorId];
    effectiveAnchors[`quiz.questions[${i}]`] = [anchorId];
    effectiveAnchors[`quiz.questions[${i}].keyEvidence`] = [anchorId];
  });
  chapter.reviewCards.forEach((card, i) => {
    card.sourceAnchorId = anchorId;
    card.sourceAnchorIds = [anchorId];
    effectiveAnchors[`reviewCards[${i}]`] = [anchorId];
  });
  chapter.implementationPlan.titleSourceAnchorIds = [anchorId];
  chapter.implementationPlan.coreSkillSourceAnchorIds = [anchorId];
  chapter.implementationPlan.twentyFourHourChallengeSourceAnchorIds = [anchorId];
  chapter.implementationPlan.weeklyPracticeSourceAnchorIds = [anchorId];
  chapter.implementationPlan.ifThenPlans.forEach((item, i) => {
    item.sourceAnchorId = anchorId;
    item.sourceAnchorIds = [anchorId];
    effectiveAnchors[`implementationPlan.ifThenPlans[${i}]`] = [anchorId];
  });
  chapter.memorableLines?.forEach((line, i) => {
    line.sourceAnchorIds = [anchorId];
    effectiveAnchors[`memorableLines[${i}]`] = [anchorId];
  });
  chapter.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: `fixture-source-${chapter.number}`,
      observedAnchorIds: [anchorId],
      effectiveAnchors,
    },
  };
  return chapter;
}

function fixtureRoot(name: string): string {
  return resolve(TMP_DIR, `production-manifest-${name}`);
}

type Fixture = {
  root: string;
  stateRoot: string;
  runsRoot: string;
  packagePath: string;
  recordPath: string;
  exemptionsFile: string;
  pkg: BookPackageV21;
  chapters: ChapterV21[];
  indexPath: string;
  sourcePath: string;
  qcPath: string;
};

/** A genuinely VERIFIED source-verify record covering every verifiable item in
 *  the fixture's sidecars, with distinct per-item sources/notes. Written to the
 *  fixture's sandbox record path (never the real pipeline dir). */
function writeVerifiedRecord(recordPath: string, stateRoot: string, runsRoot: string): void {
  const items = collectSourceVerifyItems(BOOK, { stateRoot, runsRoot });
  const byChapter = new Map<number, Array<{ id: string; kind: string; verdict: string; sourceRef: string; note: string }>>();
  for (const it of items) {
    const arr = byChapter.get(it.chapterNumber) ?? [];
    arr.push({ id: it.id, kind: it.kind, verdict: "VERIFIED", sourceRef: `https://example.com/${BOOK}/${it.id}`, note: `verified ${it.id} against its cited source` });
    byChapter.set(it.chapterNumber, arr);
  }
  const record = {
    schemaVersion: "source-verify-record-v1",
    bookId: BOOK,
    verifiedBy: "codex-source-verify:production-manifest-test",
    verifiedAt: "2026-06-23T00:00:00.000Z",
    chapters: [...byChapter.keys()].sort((a, b) => a - b).map((chapterNumber) => ({ chapterNumber, items: byChapter.get(chapterNumber)! })),
  };
  mkdirSync(resolve(recordPath, ".."), { recursive: true });
  writeFileSync(recordPath, "```json\n" + JSON.stringify(record, null, 2) + "\n```\n", "utf8");
}

function makeFixture(
  name: string,
  opts: { createdAt?: string; manifestVersion?: "v1" | "v2"; fingerprintRoots?: FingerprintRoots; writeRecord?: boolean } = {},
): Fixture {
  const createdAt = opts.createdAt ?? "2026-06-23T00:00:00.000Z";
  const root = fixtureRoot(name);
  rmSync(root, { recursive: true, force: true });
  const stateRoot = resolve(root, "state");
  const runsRoot = resolve(root, "runs");
  const packagePath = resolve(root, "book-packages", `${BOOK}.v21.json`);
  const recordPath = resolve(root, ".chapterflow", `source-verify-${BOOK}.md`);
  const exemptionsFile = resolve(root, "config", "source-reality-legacy-exemptions.json");
  const chapters = [addAuthoringEvidence(makeChapter(BOOK, 1)), addAuthoringEvidence(makeChapter(BOOK, 2))];
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

  if (opts.writeRecord !== false) writeVerifiedRecord(recordPath, stateRoot, runsRoot);

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
    recordPath,
    exemptionsFile,
    fingerprintRoots: opts.fingerprintRoots,
    manifestVersion: opts.manifestVersion,
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
    recordPath,
    exemptionsFile,
    pkg,
    chapters,
    indexPath,
    sourcePath: resolve(runsRoot, BOOK, "run-a", "sidecars", "source", "ch01.source.json"),
    qcPath: resolve(stateRoot, "qc", `${BOOK}-ch01.qc.json`),
  };
}

function verifyFixture(f: Fixture, fingerprintRoots?: FingerprintRoots) {
  return verifyProductionPackage({
    packagePath: f.packagePath,
    stateRoot: f.stateRoot,
    runsRoot: f.runsRoot,
    recordPath: f.recordPath,
    exemptionsFile: f.exemptionsFile,
    fingerprintRoots,
    compareLooseState: true,
  });
}

// ── Isolated fingerprint fixture (prompt/config/code change tests) ────────────
function makeFingerprintFixture(name: string): { dir: string; roots: FingerprintRoots; files: Record<string, string> } {
  const dir = resolve(TMP_DIR, `fp-${name}`);
  rmSync(dir, { recursive: true, force: true });
  const files = {
    prompt: resolve(dir, "prompts", "STEP-2-WRITE-CHAPTERS.md"),
    config: resolve(dir, "config", "pedagogy-palettes.json"),
    code: resolve(dir, "src", "promoteBook.ts"),
    pkg: resolve(dir, "package.json"),
    lock: resolve(dir, "package-lock.json"),
  };
  mkdirSync(resolve(dir, "prompts"), { recursive: true });
  mkdirSync(resolve(dir, "config"), { recursive: true });
  mkdirSync(resolve(dir, "src"), { recursive: true });
  writeFileSync(files.prompt, "# Authoring law\nWrite chapters in second person.\n", "utf8");
  writeFileSync(files.config, JSON.stringify({ palette: "A" }, null, 2), "utf8");
  writeFileSync(files.code, "export const VERSION = 1;\n", "utf8");
  writeFileSync(files.pkg, JSON.stringify({ name: "fp", version: "0.0.0" }, null, 2), "utf8");
  writeFileSync(files.lock, JSON.stringify({ lockfileVersion: 3, packages: {} }, null, 2), "utf8");
  const roots: FingerprintRoots = {
    promptDirs: [{ prefix: "agent-prompts", dir: resolve(dir, "prompts"), match: /\.md$/i }],
    configDir: resolve(dir, "config"),
    codeSrcDir: resolve(dir, "src"),
    packageJsonPath: files.pkg,
    lockfilePath: files.lock,
  };
  return { dir, roots, files };
}

function contentIdWithFingerprint(f: Fixture, fingerprintRoots: FingerprintRoots, createdAt = "2026-06-23T00:00:00.000Z"): string {
  const shipped = f.chapters.map((ch) => stripInternalFields(ch));
  const input: BuildProductionManifestInput = {
    bookId: BOOK,
    title: TITLE,
    author: AUTHOR,
    contentOwner: "chapterflow",
    categories: ["Self-Help"],
    tags: ["fixture"],
    chapters: shipped,
    stateRoot: f.stateRoot,
    runsRoot: f.runsRoot,
    recordPath: f.recordPath,
    exemptionsFile: f.exemptionsFile,
    fingerprintRoots,
    createdAt,
    runId: "run-a",
    packagePath: f.packagePath,
  };
  const r = buildProductionManifest(input);
  assert.equal(r.ok, true, r.ok ? "" : r.findings.map((x) => x.message).join("\n"));
  if (!r.ok) throw new Error("build failed");
  return r.manifest.contentId;
}

test("verifyProductionPackage accepts a valid v2 package, binds source-reality evidence, and the CLI reports PASS", () => {
  const f = makeFixture("valid");
  try {
    const result = verifyFixture(f);
    assert.equal(result.ok, true, result.findings.map((finding) => finding.message).join("\n"));
    assert.equal(result.contentId, f.pkg.productionManifest.contentId);
    assert.equal(result.manifestSchemaVersion, "v2");
    assert.equal(f.pkg.productionManifest.schemaVersion, PRODUCTION_MANIFEST_SCHEMA_VERSION_V2);

    // Source-reality evidence is bound and well-formed.
    const payload = f.pkg.productionManifest.payload as ProductionManifestPayloadV2;
    assert.equal(payload.sourceRealityEvidence.policyResult, "required-and-verified");
    assert.equal(payload.sourceRealityEvidence.bookId, BOOK);
    assert.ok(payload.sourceRealityEvidence.record);
    assert.equal(payload.sourceRealityEvidence.record!.path, `.chapterflow/source-verify-${BOOK}.md`);
    assert.equal(payload.sourceRealityEvidence.record!.verifier, "codex-source-verify:production-manifest-test");
    assert.match(payload.sourceRealityEvidence.record!.semanticHash, /^sha256:/);

    // Fingerprints are real content bundles, not static labels.
    assert.ok(payload.versions.promptBundle.fileCount > 0);
    assert.ok(payload.versions.configBundle.fileCount > 0);
    assert.ok(payload.versions.codeFingerprint.fileCount > 0);
    assert.match(payload.versions.codeFingerprint.bundleHash, /^sha256:/);
    assert.equal(payload.versions.labels.promptSet, "chapterflow-v21-authored-prompts-v1");

    const cli = runCli([
      "verify-production-package",
      f.packagePath,
      "--state-root",
      f.stateRoot,
      "--runs-root",
      f.runsRoot,
      "--record-path",
      f.recordPath,
      "--exemptions-file",
      f.exemptionsFile,
      "--compare-loose-state",
    ]);
    assert.equal(cli.status, 0, cli.out);
    assert.match(cli.out, /PASS/);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("verifyProductionPackage rejects package/index/source/QC/manifest tampering", () => {
  const cases: Array<{ name: string; mutate: (f: Fixture) => void; check: RegExp }> = [
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

test("tampering with the source-verify record fails verification", () => {
  const f = makeFixture("record-tamper");
  try {
    // Invalidate the record: blank a VERIFIED item's sourceRef (SV3).
    const raw = readFileSync(f.recordPath, "utf8");
    const tampered = raw.replace(/"sourceRef": "[^"]*"/, '"sourceRef": ""');
    assert.notEqual(tampered, raw, "tamper should change the record bytes");
    writeFileSync(f.recordPath, tampered, "utf8");
    const result = verifyFixture(f);
    assert.equal(result.ok, false, "tampered record must fail verification");
    const ids = result.findings.map((x) => x.checkId).join("\n");
    assert.match(ids, /source_reality/i, ids);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("a valid-but-changed source-verify record moves the content ID (payload mismatch)", () => {
  const f = makeFixture("record-changed");
  try {
    // Keep it VERIFIED but change the bound bytes (note text): stays policy-valid,
    // so the semantic hash drift must be what fails verification.
    const raw = readFileSync(f.recordPath, "utf8");
    const changed = raw.replace(/"note": "verified [^"]*"/, '"note": "re-verified later"');
    assert.notEqual(changed, raw);
    writeFileSync(f.recordPath, changed, "utf8");
    const result = verifyFixture(f);
    assert.equal(result.ok, false);
    const ids = result.findings.map((x) => x.checkId).join("\n");
    assert.match(ids, /manifest_payload_mismatch|content_id_recomputed_mismatch|source_reality_record_hash_mismatch/i, ids);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("deleting the source-verify record fails verification (reconstruction blocked)", () => {
  const f = makeFixture("record-delete");
  try {
    rmSync(f.recordPath, { force: true });
    const result = verifyFixture(f);
    assert.equal(result.ok, false, "missing record must fail verification");
    const ids = result.findings.map((x) => x.checkId).join("\n");
    assert.match(ids, /record_missing/i, ids);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("a wrong-book source-verify record fails verification", () => {
  const f = makeFixture("record-wrong-book");
  try {
    const raw = readFileSync(f.recordPath, "utf8");
    // Swap the record's bookId AND every item id so coverage no longer maps to the
    // book's sidecar items (the replacement signature).
    const wrong = raw.replace(new RegExp(BOOK, "g"), "some-other-book").replace(/"fact-/g, '"other-fact-');
    writeFileSync(f.recordPath, wrong, "utf8");
    const result = verifyFixture(f);
    assert.equal(result.ok, false, "wrong-book record must fail verification");
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("changing a prompt file changes the content ID; identical content/path do not", () => {
  const f = makeFixture("fp-prompt");
  const fp = makeFingerprintFixture("prompt");
  try {
    const before = contentIdWithFingerprint(f, fp.roots);
    writeFileSync(fp.files.prompt, "# Authoring law\nWrite chapters in FIRST person.\n", "utf8");
    const afterChange = contentIdWithFingerprint(f, fp.roots);
    assert.notEqual(afterChange, before, "editing a prompt file must move the content ID");

    // Same content at a different absolute path => same content ID (req 10).
    const copyDir = resolve(TMP_DIR, "fp-prompt-copy");
    rmSync(copyDir, { recursive: true, force: true });
    cpSync(fp.dir, copyDir, { recursive: true });
    const copyRoots: FingerprintRoots = {
      promptDirs: [{ prefix: "agent-prompts", dir: resolve(copyDir, "prompts"), match: /\.md$/i }],
      configDir: resolve(copyDir, "config"),
      codeSrcDir: resolve(copyDir, "src"),
      packageJsonPath: resolve(copyDir, "package.json"),
      lockfilePath: resolve(copyDir, "package-lock.json"),
    };
    const copyId = contentIdWithFingerprint(f, copyRoots);
    assert.equal(copyId, afterChange, "identical content in a different checkout path must produce the same content ID");
    rmSync(copyDir, { recursive: true, force: true });
  } finally {
    rmSync(f.root, { recursive: true, force: true });
    rmSync(fp.dir, { recursive: true, force: true });
  }
});

test("changing a config file changes the content ID", () => {
  const f = makeFixture("fp-config");
  const fp = makeFingerprintFixture("config");
  try {
    const before = contentIdWithFingerprint(f, fp.roots);
    writeFileSync(fp.files.config, JSON.stringify({ palette: "B" }, null, 2), "utf8");
    const after = contentIdWithFingerprint(f, fp.roots);
    assert.notEqual(after, before, "editing a config file must move the content ID");
  } finally {
    rmSync(f.root, { recursive: true, force: true });
    rmSync(fp.dir, { recursive: true, force: true });
  }
});

test("changing a relevant code file or the lockfile changes the content ID", () => {
  const f = makeFixture("fp-code");
  const fp = makeFingerprintFixture("code");
  try {
    const before = contentIdWithFingerprint(f, fp.roots);
    writeFileSync(fp.files.code, "export const VERSION = 2;\n", "utf8");
    const afterCode = contentIdWithFingerprint(f, fp.roots);
    assert.notEqual(afterCode, before, "editing a pipeline source file must move the content ID");

    writeFileSync(fp.files.code, "export const VERSION = 1;\n", "utf8"); // restore
    const restored = contentIdWithFingerprint(f, fp.roots);
    assert.equal(restored, before, "restoring identical bytes must restore the content ID");

    writeFileSync(fp.files.lock, JSON.stringify({ lockfileVersion: 3, packages: { x: 1 } }, null, 2), "utf8");
    const afterLock = contentIdWithFingerprint(f, fp.roots);
    assert.notEqual(afterLock, before, "editing the lockfile must move the content ID");
  } finally {
    rmSync(f.root, { recursive: true, force: true });
    rmSync(fp.dir, { recursive: true, force: true });
  }
});

test("adding a new relevant file changes the content ID (the file SET is part of the fingerprint)", () => {
  const f = makeFixture("fp-add-file");
  const fp = makeFingerprintFixture("add-file");
  try {
    const before = contentIdWithFingerprint(f, fp.roots);
    writeFileSync(resolve(fp.dir, "src", "newModule.ts"), "export const NEW = true;\n", "utf8");
    const after = contentIdWithFingerprint(f, fp.roots);
    assert.notEqual(after, before, "adding a relevant source file must move the content ID");
  } finally {
    rmSync(f.root, { recursive: true, force: true });
    rmSync(fp.dir, { recursive: true, force: true });
  }
});

test("canonical JSON whitespace/key-order-only changes (index, sidecar, record) do not change content ID or verification", () => {
  const f = makeFixture("canonical-json");
  try {
    const before = verifyFixture(f);
    assert.equal(before.ok, true, before.findings.map((finding) => finding.message).join("\n"));
    const index = readJson(f.indexPath);
    const source = readJson(f.sourcePath);
    writeFileSync(f.indexPath, JSON.stringify(reverseKeys(index), null, 4), "utf8");
    writeFileSync(f.sourcePath, JSON.stringify(reverseKeys(source), null, 4), "utf8");
    // Reformat the source-verify record's JSON block (key-order + indentation).
    const recordBlock = readFileSync(f.recordPath, "utf8").match(/```json\s*\n([\s\S]*?)\n```/);
    assert.ok(recordBlock, "record should contain a json block");
    const reformattedRecord = JSON.stringify(reverseKeys(JSON.parse(recordBlock![1])), null, 4);
    writeFileSync(f.recordPath, "```json\n" + reformattedRecord + "\n```\n", "utf8");

    assert.equal(canonicalJsonSha256(index), canonicalJsonSha256(readJson(f.indexPath)));
    assert.equal(canonicalJsonSha256(source), canonicalJsonSha256(readJson(f.sourcePath)));
    const after = verifyFixture(f);
    assert.equal(after.ok, true, after.findings.map((finding) => finding.message).join("\n"));
    assert.equal(after.contentId, before.contentId);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("re-promoting the same logical content at a different time/path yields the same content ID", () => {
  const f = makeFixture("stable-content-id", { createdAt: "2026-06-23T00:00:00.000Z" });
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
      recordPath: f.recordPath,
      exemptionsFile: f.exemptionsFile,
      createdAt: "2026-06-24T00:00:00.000Z",
      runId: "run-b",
      packagePath: resolve(f.root, "elsewhere", "deep", `${BOOK}.v21.json`),
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

// ── Legacy exemption (no record, content-bound) + stale detection ──────────────
function writeExemption(f: Fixture, expiresAt?: string): void {
  const exemption = {
    schemaVersion: LEGACY_EXEMPTION_SCHEMA,
    bookId: BOOK,
    reason: "grandfathered fixture",
    approvedBy: "owner",
    approvedAt: "2026-06-01T00:00:00.000Z",
    canonicalIndexHash: canonicalIndexHashFor(BOOK, f.stateRoot),
    ...(expiresAt ? { expiresAt } : {}),
  };
  writeJson(f.exemptionsFile, { schemaVersion: "source-reality-legacy-exemptions-v1", exemptions: [exemption] });
}

/** Promote a package whose source-reality verdict is legacy-exempt (no record,
 *  valid content-bound exemption). */
function buildExemptPackage(f: Fixture): void {
  rmSync(f.recordPath, { force: true });
  writeExemption(f); // valid, no expiry
  const shipped = f.chapters.map((ch) => stripInternalFields(ch));
  const r = buildProductionManifest({
    bookId: BOOK,
    title: TITLE,
    author: AUTHOR,
    contentOwner: "chapterflow",
    categories: ["Self-Help"],
    tags: ["fixture"],
    chapters: shipped,
    stateRoot: f.stateRoot,
    runsRoot: f.runsRoot,
    recordPath: f.recordPath,
    exemptionsFile: f.exemptionsFile,
    createdAt: f.pkg.createdAt,
    runId: "run-a",
    packagePath: f.packagePath,
    now: new Date("2026-06-23T00:00:00.000Z"),
  });
  assert.equal(r.ok, true, r.ok ? "" : r.findings.map((x) => x.message).join("\n"));
  if (!r.ok) throw new Error("exemption manifest build failed");
  const pkg = { ...f.pkg, packageId: r.manifest.contentId, productionManifest: r.manifest };
  writeJson(f.packagePath, pkg);
  f.pkg = pkg;
}

test("a content-bound legacy exemption verifies; a later-expired exemption fails on re-verification", () => {
  const f = makeFixture("exemption");
  try {
    buildExemptPackage(f);
    const ok = verifyProductionPackage({
      packagePath: f.packagePath,
      stateRoot: f.stateRoot,
      runsRoot: f.runsRoot,
      recordPath: f.recordPath,
      exemptionsFile: f.exemptionsFile,
      now: new Date("2026-06-23T00:00:00.000Z"),
      compareLooseState: true,
    });
    assert.equal(ok.ok, true, ok.findings.map((x) => x.message).join("\n"));
    const payload = f.pkg.productionManifest.payload as ProductionManifestPayloadV2;
    assert.equal(payload.sourceRealityEvidence.policyResult, "legacy-exempt");
    assert.ok(payload.sourceRealityEvidence.exemption);

    // The on-disk exemption is later renewed with an expiry that has now passed.
    // The promoted package is unchanged, but re-verification recomputes the policy
    // from disk and refuses the now-stale exemption (req 4).
    writeExemption(f, "2026-06-10T00:00:00.000Z");
    const stale = verifyProductionPackage({
      packagePath: f.packagePath,
      stateRoot: f.stateRoot,
      runsRoot: f.runsRoot,
      recordPath: f.recordPath,
      exemptionsFile: f.exemptionsFile,
      now: new Date("2026-06-23T00:00:00.000Z"),
      compareLooseState: true,
    });
    assert.equal(stale.ok, false, "a stale exemption must fail verification");
    const ids = stale.findings.map((x) => x.checkId).join("\n");
    assert.match(ids, /exemption_expired|source_reality/i, ids);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

// ── v1 read-compatibility ─────────────────────────────────────────────────────
test("an existing v1 package verifies under v1 rules and is not treated as v2 evidence", () => {
  const f = makeFixture("v1-compat", { manifestVersion: "v1" });
  try {
    const result = verifyFixture(f);
    assert.equal(result.ok, true, result.findings.map((x) => x.message).join("\n"));
    assert.equal(result.manifestSchemaVersion, "v1");
    assert.equal(f.pkg.productionManifest.schemaVersion, PRODUCTION_MANIFEST_SCHEMA_VERSION_V1);

    // A v1 payload carries the legacy static labels, NOT v2 source-reality / fingerprint evidence.
    const payload = f.pkg.productionManifest.payload as any;
    assert.equal(payload.sourceRealityEvidence, undefined, "v1 payload must not carry sourceRealityEvidence");
    assert.equal(payload.versions.promptSet, "chapterflow-v21-authored-prompts-v1");
    assert.equal(payload.versions.promptBundle, undefined, "v1 must not carry build-input fingerprints");

    // Relabeling a v1 manifest as v2 must FAIL — a v1 payload cannot masquerade as v2 evidence (req 2).
    const pkg = readJson<BookPackageV21>(f.packagePath);
    pkg.productionManifest.schemaVersion = PRODUCTION_MANIFEST_SCHEMA_VERSION_V2 as any;
    writeJson(f.packagePath, pkg);
    const masquerade = verifyFixture(f);
    assert.equal(masquerade.ok, false, "a v1 payload relabeled as v2 must fail verification");
    const ids = masquerade.findings.map((x) => x.checkId).join("\n");
    assert.match(ids, /manifest_payload_schema_mismatch|manifest_source_reality_evidence_missing/i, ids);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("a v2 package missing its build-input fingerprints fails closed (never throws)", () => {
  const f = makeFixture("v2-missing-fingerprints");
  try {
    const pkg = readJson<BookPackageV21>(f.packagePath);
    // Strip the fingerprint bundles a forged/corrupted v2 payload might omit.
    delete (pkg.productionManifest.payload as any).versions;
    writeJson(f.packagePath, pkg);
    let result: ReturnType<typeof verifyFixture>;
    assert.doesNotThrow(() => {
      result = verifyFixture(f);
    }, "a malformed v2 payload must not throw");
    assert.equal(result!.ok, false);
    const ids = result!.findings.map((x) => x.checkId).join("\n");
    assert.match(ids, /manifest_versions_missing|manifest_fingerprint_missing/i, ids);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("a missing declared fingerprint input fails the manifest build closed", () => {
  const f = makeFixture("fp-missing-input");
  const fp = makeFingerprintFixture("missing-input");
  try {
    rmSync(fp.files.lock, { force: true }); // a declared input (the lockfile) is gone
    const shipped = f.chapters.map((ch) => stripInternalFields(ch));
    const r = buildProductionManifest({
      bookId: BOOK,
      title: TITLE,
      author: AUTHOR,
      contentOwner: "chapterflow",
      chapters: shipped,
      stateRoot: f.stateRoot,
      runsRoot: f.runsRoot,
      recordPath: f.recordPath,
      exemptionsFile: f.exemptionsFile,
      fingerprintRoots: fp.roots,
      createdAt: "2026-06-23T00:00:00.000Z",
      runId: "run-a",
      packagePath: f.packagePath,
    });
    assert.equal(r.ok, false, "a missing declared fingerprint input must fail the build");
    if (!r.ok) {
      assert.match(r.findings.map((x) => x.checkId).join("\n"), /fingerprint_unbuildable/i);
    }
  } finally {
    rmSync(f.root, { recursive: true, force: true });
    rmSync(fp.dir, { recursive: true, force: true });
  }
});

test("packagePathForBook resolves production package names without touching state", () => {
  const p = packagePathForBook("Some Book!");
  assert.match(p, /book-packages\/some-book\.v21\.json$/);
  assert.equal(existsSync(p), false);
});
