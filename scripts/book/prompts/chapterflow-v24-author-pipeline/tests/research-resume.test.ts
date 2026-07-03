import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

import { test } from "./harness.js";
import { researchBook } from "../src/researcher.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import type { ChapterResearchInput, ChapterResearchResult } from "../src/agents/researcher-chapter.js";
import { readResearchRunManifest } from "../src/lib/researchRunManifest.js";

const BOOK = "zz-research-resume";

function bibliography(title = "Synthetic Research Resume", author = "Test Author", count = 4): BibliographyResult {
  return {
    bookId: BOOK,
    title,
    author,
    edition: {
      name: "Synthetic edition",
      publisher: "Fixture Press",
      publishedYear: 2026,
      language: "English",
      chapterCount: count,
    },
    flatChapters: Array.from({ length: count }, (_, i) => ({ number: i + 1, title: `Durable Unit ${i + 1}` })),
    thesis: "Durable research matters because completed provider work should survive a later worker failure.",
    teachingArc: "The synthetic arc moves from setup to interruption to recovery so the orchestrator proves it can resume missing work only.",
    authorVoice: {
      register: "plainspoken",
      signatureMoves: ["concrete operations", "short causal chains", "explicit tradeoffs"],
      avoidMoves: ["mysticism", "ornamental abstractions"],
    },
    confidence: "high",
  };
}

function chapterResult(input: ChapterResearchInput): ChapterResearchResult {
  const n = input.chapter.number;
  const word = `unit${n}`;
  return {
    chapterNumber: n,
    chapterTitle: input.chapter.title,
    focus: `${word} focus explains durable completion with enough concrete operational detail to satisfy the source validator.`,
    coreClaim: `${word} completed work must be persisted before any sibling failure can erase it.`,
    centralConcept: {
      name: `${word} durable commit`,
      plainDefinition: `${word} means a finished provider result is written atomically before the batch waits on unrelated workers.`,
      whyItMatters: `${word} protects expensive research from being repeated after interruption.`,
    },
    keyClaims: [
      `${word} claims should survive process interruption.`,
      `${word} claims need an audit trail.`,
      `${word} claims should not be repeated once complete.`,
      `${word} claims need explicit retry state.`,
    ],
    namedExamples: [{
      label: `${word} worker`,
      summary: `A ${word} worker finishes its provider call and records the sidecar before another worker reports failure.`,
      teachesWhat: `The ${word} result is reusable after restart.`,
    }],
    hardEdge: `${word} failure handling must preserve raw observations and make retry decisions explicit rather than erasing partial progress.`,
    voiceCues: [`${word} directness`, `${word} concrete sequencing`],
    paraphraseNotes: Array.from(
      { length: 90 },
      (_, i) => `${word}-token-${i} ${word}-persisted-${i} ${word}-evidence-${i} ${word}-restart-${i} ${word}-claim-${i}`,
    ).join(" "),
  };
}

function listRunIds(root: string): string[] {
  const bookDir = resolve(root, BOOK);
  return existsSync(bookDir) ? readdirSync(bookDir).sort() : [];
}

function runDir(root: string, runId: string): string {
  return resolve(root, BOOK, runId);
}

function assertManifestOk(root: string, runId: string) {
  const parsed = readResearchRunManifest(runDir(root, runId));
  assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.errors.join("; "));
  return parsed.manifest;
}

test("late worker failure preserves completed chapter sidecars immediately", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-research-resume-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");
  const calls: number[] = [];

  try {
    await assert.rejects(
      () => researchBook("Synthetic Research Resume", "Test Author", {
        bookId: BOOK,
        runsRoot,
        stateRoot,
        chapterConcurrency: 4,
        deps: {
          runBibliography: async () => bibliography(),
          runChapter: async (input) => {
            calls.push(input.chapter.number);
            if (input.chapter.number === 4) {
              await new Promise((resolveTimer) => setTimeout(resolveTimer, 20));
              throw new Error("late synthetic provider failure");
            }
            return chapterResult(input);
          },
        },
      }),
      /late synthetic provider failure/,
    );

    assert.deepEqual(calls.sort((a, b) => a - b), [1, 2, 3, 4]);
    const [runId] = listRunIds(runsRoot);
    assert.ok(runId, "failed research still creates an auditable run directory");
    for (const n of [1, 2, 3]) {
      const num = String(n).padStart(2, "0");
      assert.ok(existsSync(resolve(runsRoot, BOOK, runId, "sidecars", "source", `ch${num}.source.json`)), `ch${num} JSON sidecar should survive`);
      assert.ok(existsSync(resolve(runsRoot, BOOK, runId, "sidecars", "source", `ch${num}.source.txt`)), `ch${num} text sidecar should survive`);
    }
    const manifest = assertManifestOk(runsRoot, runId);
    assert.equal(manifest.chapters["01"].status, "succeeded");
    assert.equal(manifest.chapters["02"].status, "succeeded");
    assert.equal(manifest.chapters["03"].status, "succeeded");
    assert.equal(manifest.chapters["04"].status, "failed");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resume skips completed compatible chapters and calls provider only for missing work", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-research-resume-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");
  const firstCalls: number[] = [];
  const resumeCalls: number[] = [];

  try {
    await assert.rejects(
      () => researchBook("Synthetic Research Resume", "Test Author", {
        bookId: BOOK,
        runsRoot,
        stateRoot,
        chapterConcurrency: 4,
        deps: {
          runBibliography: async () => bibliography(),
          runChapter: async (input) => {
            firstCalls.push(input.chapter.number);
            if (input.chapter.number === 4) {
              await new Promise((resolveTimer) => setTimeout(resolveTimer, 20));
              throw new Error("late synthetic provider failure");
            }
            return chapterResult(input);
          },
        },
      }),
      /late synthetic provider failure/,
    );
    const [failedRunId] = listRunIds(runsRoot);

    const result = await researchBook("Synthetic Research Resume", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      chapterConcurrency: 4,
      deps: {
        runBibliography: async () => {
          throw new Error("bibliography provider should not repeat on compatible resume");
        },
        runChapter: async (input) => {
          resumeCalls.push(input.chapter.number);
          if (input.chapter.number !== 4) throw new Error(`chapter ${input.chapter.number} repeated unexpectedly`);
          return chapterResult(input);
        },
      },
    });

    assert.equal(result.runId, failedRunId, "resume should continue the compatible interrupted run");
    assert.deepEqual(resumeCalls, [4], "only the failed chapter should call the provider");
    assert.equal(result.chapters.length, 4);
    const manifest = assertManifestOk(runsRoot, failedRunId);
    assert.equal(manifest.overallStatus, "complete");
    for (const n of [1, 2, 3, 4]) assert.equal(manifest.chapters[String(n).padStart(2, "0")].status, "succeeded");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("changed input hash rejects old run and creates a new one", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-research-resume-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");
  const calls: number[] = [];

  try {
    const first = await researchBook("Synthetic Research Resume", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      chapterConcurrency: 2,
      deps: {
        runBibliography: async () => bibliography("Synthetic Research Resume", "Test Author", 2),
        runChapter: async (input) => chapterResult(input),
      },
    });

    const second = await researchBook("Synthetic Research Resume Revised", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      chapterConcurrency: 2,
      deps: {
        runBibliography: async () => bibliography("Synthetic Research Resume Revised", "Test Author", 2),
        runChapter: async (input) => {
          calls.push(input.chapter.number);
          return chapterResult(input);
        },
      },
    });

    assert.notEqual(second.runId, first.runId, "changed input must not reuse old run");
    assert.deepEqual(calls.sort((a, b) => a - b), [1, 2], "new compatible inputs should research every expected chapter");
    assert.equal(listRunIds(runsRoot).length, 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("two runs created in the same millisecond get distinct run IDs", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-research-resume-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");
  const fixedClock = () => new Date("2026-06-23T12:00:00.123Z");

  try {
    const first = await researchBook("Synthetic Research Resume", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      clock: fixedClock,
      chapterConcurrency: 1,
      deps: {
        runBibliography: async () => bibliography("Synthetic Research Resume", "Test Author", 1),
        runChapter: async (input) => chapterResult(input),
      },
    });
    const second = await researchBook("Synthetic Research Resume", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      clock: fixedClock,
      forceRefresh: true,
      chapterConcurrency: 1,
      deps: {
        runBibliography: async () => bibliography("Synthetic Research Resume", "Test Author", 1),
        runChapter: async (input) => chapterResult(input),
      },
    });

    assert.notEqual(first.runId, second.runId);
    assert.match(first.runId, /^20260623T120000123Z-/);
    assert.match(second.runId, /^20260623T120000123Z-/);
    assert.equal(listRunIds(runsRoot).length, 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("stale in-progress chapter claim is reclaimed and retried", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-research-resume-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");
  const calls: number[] = [];

  try {
    const first = await researchBook("Synthetic Research Resume", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      chapterConcurrency: 3,
      deps: {
        runBibliography: async () => bibliography("Synthetic Research Resume", "Test Author", 3),
        runChapter: async (input) => chapterResult(input),
      },
    });
    const dir = runDir(runsRoot, first.runId);
    rmSync(resolve(dir, "sidecars", "source", "ch02.source.json"), { force: true });
    rmSync(resolve(dir, "sidecars", "source", "ch02.source.txt"), { force: true });

    const manifestPath = resolve(dir, "research-run.manifest.json");
    const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    raw.overallStatus = "failed";
    raw.chapters["02"].status = "in_progress";
    raw.chapters["02"].lease = {
      ownerId: "dead-owner",
      pid: 123456,
      host: "old-host",
      claimedAt: "2026-06-23T11:00:00.000Z",
      expiresAt: "2026-06-23T11:01:00.000Z",
    };
    delete raw.chapters["02"].outputJsonHash;
    delete raw.chapters["02"].outputTextHash;
    delete raw.chapters["02"].completedAt;
    writeFileSync(manifestPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    mkdirSync(resolve(dir, "claims"), { recursive: true });
    writeFileSync(resolve(dir, "claims", "ch02.claim.json"), `${JSON.stringify({
      schemaVersion: "chapterflow.researchRunManifest.v1",
      kind: "chapter",
      runId: first.runId,
      chapterNumber: 2,
      ownerId: "dead-owner",
      pid: 123456,
      host: "old-host",
      claimedAt: "2026-06-23T11:00:00.000Z",
      expiresAt: "2026-06-23T11:01:00.000Z",
    }, null, 2)}\n`, "utf8");

    await researchBook("Synthetic Research Resume", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      clock: () => new Date("2026-06-23T12:00:00.000Z"),
      chapterConcurrency: 3,
      deps: {
        runBibliography: async () => {
          throw new Error("bibliography provider should not repeat on stale-claim resume");
        },
        runChapter: async (input) => {
          calls.push(input.chapter.number);
          return chapterResult(input);
        },
      },
    });

    assert.deepEqual(calls, [2]);
    const manifest = assertManifestOk(runsRoot, first.runId);
    assert.equal(manifest.chapters["02"].status, "succeeded");
    assert.ok(manifest.events.some((event) => event.type === "chapter.stale_reclaimed"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("malformed manifests fail closed and are not treated as compatible", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-research-resume-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");
  const badRun = resolve(runsRoot, BOOK, "bad-run");
  const calls: number[] = [];

  try {
    mkdirSync(badRun, { recursive: true });
    writeFileSync(resolve(badRun, "research-run.manifest.json"), `${JSON.stringify({ bad: true }, null, 2)}\n`, "utf8");

    const result = await researchBook("Synthetic Research Resume", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      chapterConcurrency: 2,
      deps: {
        runBibliography: async () => bibliography("Synthetic Research Resume", "Test Author", 2),
        runChapter: async (input) => {
          calls.push(input.chapter.number);
          return chapterResult(input);
        },
      },
    });

    assert.notEqual(result.runId, "bad-run");
    assert.deepEqual(calls.sort((a, b) => a - b), [1, 2]);
    assert.ok(listRunIds(runsRoot).includes("bad-run"), "bad evidence is preserved for audit");
    assert.equal(listRunIds(runsRoot).length, 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
