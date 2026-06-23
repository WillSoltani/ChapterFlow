import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

import { test } from "./harness.js";
import { runCli } from "./helpers.js";
import { researchBook } from "../src/researcher.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import type { ChapterResearchInput, ChapterResearchResult } from "../src/agents/researcher-chapter.js";
import { computeNextTask } from "../src/next-task.js";
import {
  buildInitialResearchRunManifest,
  expectedChaptersHash,
  RESEARCH_RUN_CODE_VERSION,
  type ResearchCompatibility,
} from "../src/lib/researchRunManifest.js";
import { findRunArtifact } from "../src/lib/runDirs.js";
import { buildCanonicalToc, flattenTocChapters, parseToc, TOC_SCHEMA_VERSION } from "../src/lib/tocContract.js";
import { checkSourceV2Gate } from "../src/qc/sourceV2Gate.js";

const BOOK = "zz-toc-contract";

function bibliography(): BibliographyResult {
  return {
    bookId: BOOK,
    title: "Synthetic TOC Contract",
    author: "Fixture Author",
    edition: {
      name: "Synthetic edition",
      publisher: "Fixture Press",
      publishedYear: 2026,
      language: "English",
      chapterCount: 2,
    },
    flatChapters: [
      { number: 1, title: "Contract One" },
      { number: 2, title: "Contract Two" },
    ],
    thesis: "A single table of contents contract prevents producers and consumers from disagreeing about expected chapters.",
    teachingArc: "The synthetic arc starts with a producer writing a flat bibliography, then checks the persisted TOC shape that downstream commands consume.",
    authorVoice: {
      register: "plainspoken",
      signatureMoves: ["direct contracts", "audit-friendly state", "explicit failures"],
      avoidMoves: ["implicit fallbacks", "silent coercion", "partial artifacts"],
    },
    confidence: "high",
  };
}

function chapterResult(input: ChapterResearchInput): ChapterResearchResult {
  const n = input.chapter.number;
  const word = `contract${n}`;
  return {
    chapterNumber: n,
    chapterTitle: input.chapter.title,
    focus: `${word} focuses on keeping the unit list authoritative across every downstream stage of the fixture pipeline.`,
    coreClaim: `${word} requires every consumer to read the same validated unit sequence before acting.`,
    centralConcept: {
      name: `${word} canonical sequence`,
      plainDefinition: `${word} is the validated list of unit numbers and titles that every artifact decision must share.`,
      whyItMatters: `${word} blocks partial files from masquerading as a complete book.`,
    },
    keyClaims: [
      `${word} keeps unit numbers positive and unique.`,
      `${word} makes the source of authority explicit.`,
      `${word} preserves raw observations during migration.`,
      `${word} rejects ambiguous shapes before authoring starts.`,
    ],
    namedExamples: [{
      label: `${word} resolver`,
      summary: `A fixture resolver compares manifests before it accepts a run artifact for unit ${n}.`,
      teachesWhat: `The ${word} decision is based on compatibility, not directory freshness alone.`,
    }],
    hardEdge: `${word} treats a malformed authority file as a blocker. It does not guess from nearby sidecars, because a partial artifact set can look plausible while still omitting expected chapters.`,
    voiceCues: [`${word} directness`, `${word} evidence-first phrasing`],
    paraphraseNotes: Array.from(
      { length: 90 },
      (_, i) => `${word}-note-${i} ${word}-artifact-${i} ${word}-authority-${i} ${word}-manifest-${i} ${word}-coverage-${i}`,
    ).join(" "),
  };
}

test("research writes a versioned canonical flat TOC that downstream consumers cannot read as zero chapters", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-toc-contract-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");

  try {
    const result = await researchBook("Synthetic TOC Contract", "Fixture Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      chapterConcurrency: 1,
      deps: {
        runBibliography: async () => bibliography(),
        runChapter: async (input) => chapterResult(input),
      },
    });

    const tocPath = resolve(runsRoot, BOOK, result.runId, "source-freeze", "toc.json");
    assert.ok(existsSync(tocPath), "research must persist toc.json");
    const toc = JSON.parse(readFileSync(tocPath, "utf8"));
    assert.equal(toc.schemaVersion, "chapterflow.toc.v1");
    assert.equal(toc.bookId, BOOK);
    assert.deepEqual(toc.flatChapters, [
      { id: `${BOOK}-ch01`, number: 1, title: "Contract One" },
      { id: `${BOOK}-ch02`, number: 2, title: "Contract Two" },
    ]);
    assert.equal(toc.chapters, undefined, "new writes must not use the legacy toc.chapters shape");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

function compatibility(): ResearchCompatibility {
  return {
    codeVersion: RESEARCH_RUN_CODE_VERSION,
    promptHash: "prompt",
    configHash: "config",
    provider: "fixture",
    model: "fixture-model",
  };
}

function writeManifestRun(args: {
  runsRoot: string;
  bookDir: string;
  runId: string;
  bookId: string;
  createdAt: string;
  artifact?: boolean;
  chapters?: Array<{ number: number; title: string }>;
}): string {
  const runDir = resolve(args.runsRoot, args.bookDir, args.runId);
  const chapters = args.chapters ?? [
    { number: 1, title: "Contract One" },
    { number: 2, title: "Contract Two" },
  ];
  const manifest = buildInitialResearchRunManifest({
    runId: args.runId,
    bookId: args.bookId,
    createdAt: args.createdAt,
    input: {
      title: "Synthetic TOC Contract",
      author: "Fixture Author",
      bookIdHint: args.bookId,
      hash: "input",
    },
    bibliographyHash: "bibliography",
    bibliographyPath: "source-freeze/toc.json",
    expectedChapters: chapters,
    compatibility: compatibility(),
  });
  manifest.overallStatus = "complete";
  manifest.expectedChaptersHash = expectedChaptersHash(chapters);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(resolve(runDir, "research-run.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (args.artifact) {
    const artifactPath = resolve(runDir, "source-freeze", "toc.json");
    mkdirSync(resolve(runDir, "source-freeze"), { recursive: true });
    writeFileSync(artifactPath, JSON.stringify({ marker: args.runId }, null, 2), "utf8");
  }
  return runDir;
}

function writeIndex(stateRoot: string, bookId: string, count: number): void {
  const dir = resolve(stateRoot, "indexes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${bookId}.json`), `${JSON.stringify(Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`,
      chapterNumber: n,
      chapterTitle: `Contract ${n}`,
    };
  }), null, 2)}\n`, "utf8");
}

function sourceV2Sidecar(n: number): Record<string, unknown> {
  return {
    schemaVersion: "source-v2",
    centralConcept: {
      id: `concept-${n}`,
      name: `Contract Concept ${n}`,
      plainDefinition: `A fixture definition with enough detail for unit ${n}.`,
    },
    namedExamples: Array.from({ length: 3 }, (_, i) => ({
      id: `ex-${n}-${i}`,
      label: `Example ${n}-${i}`,
      summary: `A synthetic source example ${i} for unit ${n}.`,
      hardSpecifics: [`specific-${n}-${i}-a`, `specific-${n}-${i}-b`],
    })),
    testableFacts: Array.from({ length: 9 }, (_, i) => ({
      id: `fact-${n}-${i}`,
      claim: `Claim ${n}-${i}`,
      becauseMechanism: `Mechanism ${n}-${i}`,
      commonError: `Error ${n}-${i}`,
      errorIsWhy: `Why ${n}-${i}`,
    })),
  };
}

function writeSourceSidecar(runDir: string, chapterNumber: number): void {
  const dir = resolve(runDir, "sidecars", "source");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `ch${String(chapterNumber).padStart(2, "0")}.source.json`), `${JSON.stringify(sourceV2Sidecar(chapterNumber), null, 2)}\n`, "utf8");
}

test("run artifact resolution skips newer incompatible runs and selects the compatible artifact", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-run-resolver-"));
  const runsRoot = resolve(tmp, "runs");

  try {
    const older = writeManifestRun({
      runsRoot,
      bookDir: BOOK,
      runId: "20260623T120000000Z-compatible",
      bookId: BOOK,
      createdAt: "2026-06-23T12:00:00.000Z",
      artifact: true,
    });
    writeManifestRun({
      runsRoot,
      bookDir: BOOK,
      runId: "20260623T130000000Z-wrong-book",
      bookId: "zz-different-book",
      createdAt: "2026-06-23T13:00:00.000Z",
      artifact: true,
    });

    const picked = findRunArtifact(runsRoot, BOOK, "source-freeze/toc.json");
    assert.equal(picked, resolve(older, "source-freeze", "toc.json"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("TOC migration flattens every supported legacy shape to the same canonical sequence", () => {
  const expected = [
    { id: `${BOOK}-ch01`, number: 1, title: "Contract One" },
    { id: `${BOOK}-ch02`, number: 2, title: "Contract Two" },
  ];
  const shapes = [
    { title: "flatChapters", raw: { bookId: BOOK, title: "Synthetic TOC", author: "Fixture", flatChapters: expected.map(({ number, title }) => ({ number, title })) } },
    { title: "chapters", raw: { bookId: BOOK, title: "Synthetic TOC", author: "Fixture", chapters: expected.map(({ number, title }) => ({ number, title })) } },
    { title: "sections", raw: { bookId: BOOK, title: "Synthetic TOC", author: "Fixture", sections: [{ number: 1, title: "Part One", chapters: expected.map(({ number, title }) => ({ number, title })) }] } },
  ];

  for (const shape of shapes) {
    const parsed = parseToc(shape.raw, { bookId: BOOK });
    assert.equal(parsed.ok, true, `${shape.title}: ${parsed.ok ? "" : parsed.issues.map((i) => i.message).join("; ")}`);
    if (!parsed.ok) continue;
    assert.deepEqual(parsed.chapters, expected);
    assert.deepEqual(flattenTocChapters(shape.raw, { bookId: BOOK }), expected);
  }
});

test("TOC parser rejects empty, mixed, duplicate, reordered, wrong-book, and malformed shapes with codes", () => {
  const cases: Array<{ name: string; raw: unknown; code: string }> = [
    { name: "empty", raw: { bookId: BOOK, flatChapters: [] }, code: "TOC.empty" },
    {
      name: "mixed",
      raw: {
        bookId: BOOK,
        flatChapters: [{ number: 1, title: "One" }],
        chapters: [{ number: 1, title: "Different One" }],
      },
      code: "TOC.mixed_ambiguous",
    },
    {
      name: "duplicate",
      raw: { bookId: BOOK, flatChapters: [{ number: 1, title: "One" }, { number: 1, title: "Again" }] },
      code: "TOC.chapter_duplicate_number",
    },
    {
      name: "reordered",
      raw: { bookId: BOOK, flatChapters: [{ number: 2, title: "Two" }, { number: 1, title: "One" }] },
      code: "TOC.chapter_order",
    },
    {
      name: "wrong-book",
      raw: { bookId: "zz-other", flatChapters: [{ id: "zz-other-ch01", number: 1, title: "One" }] },
      code: "TOC.book_mismatch",
    },
    { name: "malformed", raw: [], code: "TOC.malformed" },
  ];

  for (const c of cases) {
    const parsed = parseToc(c.raw, { bookId: BOOK });
    assert.equal(parsed.ok, false, `${c.name} should fail`);
    assert.ok(!parsed.ok && parsed.issues.some((issue) => issue.code === c.code), `${c.name} missing ${c.code}: ${!parsed.ok ? parsed.issues.map((i) => i.code).join(", ") : ""}`);
  }
});

test("research canonical TOC round-trips through next-task and source-v2 gate with injected roots", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-toc-roundtrip-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");

  try {
    const result = await researchBook("Synthetic TOC Contract", "Fixture Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      chapterConcurrency: 1,
      deps: {
        runBibliography: async () => bibliography(),
        runChapter: async (input) => chapterResult(input),
      },
    });
    writeIndex(stateRoot, BOOK, 2);
    const runDir = resolve(runsRoot, BOOK, result.runId);
    writeSourceSidecar(runDir, 1);
    writeSourceSidecar(runDir, 2);
    const next = computeNextTask(BOOK, {
      runsDir: runsRoot,
      stateDir: stateRoot,
      promptsDir: resolve(tmp, "prompts"),
      repoRoot: tmp,
    });
    assert.equal(next.kind, "write-chapter", `expected next-task to see the two TOC chapters after source/index; got ${next.kind}`);
    if (next.kind === "write-chapter") assert.equal(next.chapterNumber, 1);

    const report = checkSourceV2Gate(BOOK, undefined, { stateRoot, runsRoot });
    assert.equal(report.passed, true, report.findings.map((f) => f.message).join("\n"));

    const tocPath = resolve(runsRoot, BOOK, result.runId, "source-freeze", "toc.json");
    const cli = runCli(["toc-migrate", BOOK, "--path", tocPath]);
    assert.equal(cli.status, 0, cli.out);
    assert.match(cli.out, /shape: canonical/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("sectioned legacy TOC round-trips through next-task and CLI migration without changing chapter sequence", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-sectioned-toc-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");
  const runId = "20260623T120000000Z-sectioned";
  const runDir = writeManifestRun({
    runsRoot,
    bookDir: BOOK,
    runId,
    bookId: BOOK,
    createdAt: "2026-06-23T12:00:00.000Z",
  });
  const tocPath = resolve(runDir, "source-freeze", "toc.json");

  try {
    mkdirSync(resolve(runDir, "source-freeze"), { recursive: true });
    writeFileSync(tocPath, `${JSON.stringify({
      bookId: BOOK,
      title: "Synthetic TOC Contract",
      author: "Fixture Author",
      sections: [{
        number: 1,
        title: "Part One",
        chapters: [
          { number: 1, title: "Contract One" },
          { number: 2, title: "Contract Two" },
        ],
      }],
    }, null, 2)}\n`, "utf8");

    const next = computeNextTask(BOOK, {
      runsDir: runsRoot,
      stateDir: stateRoot,
      promptsDir: resolve(tmp, "prompts"),
      repoRoot: tmp,
    });
    assert.equal(next.kind, "research-chapter");
    if (next.kind === "research-chapter") {
      assert.equal(next.chapterNumber, 1);
      assert.equal(next.chapterTitle, "Contract One");
    }

    const dryRun = runCli(["toc-migrate", BOOK, "--path", tocPath]);
    assert.equal(dryRun.status, 0, dryRun.out);
    assert.match(dryRun.out, /shape: sections/);
    assert.match(dryRun.out, /canonical rewrite needed: yes/);

    const applied = runCli(["toc-migrate", BOOK, "--path", tocPath, "--apply"]);
    assert.equal(applied.status, 0, applied.out);
    const migrated = JSON.parse(readFileSync(tocPath, "utf8"));
    assert.equal(migrated.schemaVersion, TOC_SCHEMA_VERSION);
    assert.deepEqual(flattenTocChapters(migrated, { bookId: BOOK }), [
      { id: `${BOOK}-ch01`, number: 1, title: "Contract One" },
      { id: `${BOOK}-ch02`, number: 2, title: "Contract Two" },
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("source coverage uses the canonical index even when TOC is absent or malformed", () => {
  for (const mode of ["absent", "malformed"] as const) {
    const tmp = mkdtempSync(join(tmpdir(), `cf-source-coverage-${mode}-`));
    const runsRoot = resolve(tmp, "runs");
    const stateRoot = resolve(tmp, "state");
    const chapters = Array.from({ length: 4 }, (_, i) => ({ number: i + 1, title: `Contract ${i + 1}` }));
    const runDir = writeManifestRun({
      runsRoot,
      bookDir: BOOK,
      runId: `20260623T120000000Z-${mode}`,
      bookId: BOOK,
      createdAt: "2026-06-23T12:00:00.000Z",
      chapters,
    });

    try {
      writeIndex(stateRoot, BOOK, 4);
      writeSourceSidecar(runDir, 1);
      writeSourceSidecar(runDir, 2);
      if (mode === "malformed") {
        mkdirSync(resolve(runDir, "source-freeze"), { recursive: true });
        writeFileSync(resolve(runDir, "source-freeze", "toc.json"), "{ not json", "utf8");
      }

      const report = checkSourceV2Gate(BOOK, undefined, { stateRoot, runsRoot });
      const missing = report.findings.filter((f) => f.checkId === "SV2.missing_sidecar").map((f) => f.chapterNumber);
      assert.deepEqual(missing, [3, 4], `${mode}: expected N-K missing chapters`);
      if (mode === "malformed") assert.ok(report.findings.some((f) => f.checkId === "SV2.toc_malformed"));
      assert.equal(report.passed, false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test("book-id normalization resolves one logical book across differently spelled run directories", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-run-normalization-"));
  const runsRoot = resolve(tmp, "runs");

  try {
    const runDir = writeManifestRun({
      runsRoot,
      bookDir: "ZZ TOC Contract",
      runId: "20260623T120000000Z-normalized",
      bookId: "ZZ TOC Contract",
      createdAt: "2026-06-23T12:00:00.000Z",
      artifact: true,
    });
    const picked = findRunArtifact(runsRoot, "zz_toc_contract", "source-freeze/toc.json");
    assert.equal(picked, resolve(runDir, "source-freeze", "toc.json"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
