/**
 * F5 — `--research-run-id` research-run pin, at the researchBook seam.
 *
 * The pin is resolve-then-adopt: it names an EXISTING research run directory
 * under <runsRoot>/<bookId>/ and adopts that run's own (hash-verified)
 * bibliography, so no bibliography model call is made and every chapter reuses
 * its durable sidecar. It NEVER falls back to scanning
 * (findCompatibleResearchRun) or to creating a run (createResearchRun): every
 * failure throws a distinct RESEARCH_RUN_PIN_* code and leaves the run
 * directory count unchanged. That run-dir-count assertion is the mechanical
 * proof of "fail closed, never scan".
 */

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

import { test, xenv } from "./harness.js";
import { researchBook } from "../src/researcher.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import type { ChapterResearchInput, ChapterResearchResult } from "../src/agents/researcher-chapter.js";
import { RESEARCH_RUN_MANIFEST_FILE, hashJson } from "../src/lib/researchRunManifest.js";

const BOOK = "zz-research-pin";
const OTHER_BOOK = "zz-research-pin-other";
const TITLE = "Synthetic Research Pin";
const AUTHOR = "Test Author";

function bibliography(title = TITLE, author = AUTHOR, count = 3, bookId = BOOK): BibliographyResult {
  return {
    bookId,
    title,
    author,
    edition: {
      name: "Synthetic edition",
      publisher: "Fixture Press",
      publishedYear: 2026,
      language: "English",
      chapterCount: count,
    },
    flatChapters: Array.from({ length: count }, (_, i) => ({ number: i + 1, title: `Pinned Unit ${i + 1}` })),
    thesis: "A pinned research run must be adopted whole so a content repair never re-mints the bibliography.",
    teachingArc: "The arc moves from a completed run to an explicit operator pin so the orchestrator proves it reuses durable work exactly.",
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
    focus: `${word} focus explains durable adoption with enough concrete operational detail to satisfy the source validator.`,
    coreClaim: `${word} completed work must be adoptable by an explicit pin instead of rediscovered by a scan.`,
    centralConcept: {
      name: `${word} durable adoption`,
      plainDefinition: `${word} means a finished research bundle is read verbatim when an operator names it by id.`,
      whyItMatters: `${word} protects expensive research and every downstream cached section pack from a re-minted bibliography.`,
    },
    keyClaims: [
      `${word} claims should survive an explicit operator pin.`,
      `${word} claims need an audit trail.`,
      `${word} claims should not be repeated once complete.`,
      `${word} claims need explicit retry state.`,
    ],
    namedExamples: [{
      label: `${word} operator`,
      summary: `A ${word} operator names one research run id and the researcher adopts that exact bundle without a model call.`,
      teachesWhat: `The ${word} result is reusable after an eviction-driven repair.`,
    }],
    hardEdge: `${word} failure handling must fail closed on any pin that cannot be proven same-book, same-input, and fully reusable.`,
    voiceCues: [`${word} directness`, `${word} concrete sequencing`],
    paraphraseNotes: Array.from(
      { length: 90 },
      (_, i) => `${word}-token-${i} ${word}-persisted-${i} ${word}-evidence-${i} ${word}-restart-${i} ${word}-claim-${i}`,
    ).join(" "),
  };
}

type Calls = { bibliography: number; chapters: number[] };

function tempRoots(): { tmp: string; runsRoot: string; stateRoot: string } {
  const tmp = mkdtempSync(join(tmpdir(), "cf-research-pin-"));
  return { tmp, runsRoot: resolve(tmp, "runs"), stateRoot: resolve(tmp, "state") };
}

function listRunIds(runsRoot: string, book = BOOK): string[] {
  const bookDir = resolve(runsRoot, book);
  return existsSync(bookDir) ? readdirSync(bookDir).sort() : [];
}

function runDir(runsRoot: string, runId: string, book = BOOK): string {
  return resolve(runsRoot, book, runId);
}

function manifestPath(runsRoot: string, runId: string, book = BOOK): string {
  return resolve(runDir(runsRoot, runId, book), RESEARCH_RUN_MANIFEST_FILE);
}

function editManifest(runsRoot: string, runId: string, mutate: (raw: Record<string, any>) => void, book = BOOK): void {
  const path = manifestPath(runsRoot, runId, book);
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
  mutate(raw);
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

/** Seed one COMPLETE research run through the normal (unpinned) path.
 *  `forceRefresh` mints a SECOND, newer compatible run so a test can prove the
 *  pin selects by id rather than falling through to the newest-first scan. */
async function seedCompleteRun(
  runsRoot: string,
  stateRoot: string,
  options: { title?: string; forceRefresh?: boolean } = {},
): Promise<string> {
  const title = options.title ?? TITLE;
  const result = await researchBook(title, AUTHOR, {
    bookId: BOOK,
    runsRoot,
    stateRoot,
    chapterConcurrency: 3,
    ...(options.forceRefresh === true ? { forceRefresh: true } : {}),
    deps: {
      runBibliography: async () => bibliography(title),
      runChapter: async (input) => chapterResult(input),
    },
  });
  return result.runId;
}

/** Invoke researchBook with a pin, counting every model call it makes. */
async function pinned(
  runsRoot: string,
  stateRoot: string,
  pinnedRunId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ result: Awaited<ReturnType<typeof researchBook>> | null; error: Error | null; calls: Calls }> {
  const calls: Calls = { bibliography: 0, chapters: [] };
  const title = (overrides.title as string | undefined) ?? TITLE;
  const bookId = (overrides.bookId as string | undefined) ?? BOOK;
  delete overrides.title;
  try {
    const result = await researchBook(title, AUTHOR, {
      bookId,
      runsRoot,
      stateRoot,
      chapterConcurrency: 3,
      pinnedRunId,
      deps: {
        runBibliography: async () => {
          calls.bibliography += 1;
          return bibliography(title);
        },
        runChapter: async (input) => {
          calls.chapters.push(input.chapter.number);
          return chapterResult(input);
        },
      },
      ...overrides,
    } as Parameters<typeof researchBook>[2]);
    return { result, error: null, calls };
  } catch (error) {
    return { result: null, error: error as Error, calls };
  }
}

function sourceFreezeBytes(runsRoot: string, runId: string): Record<string, string> {
  const dir = runDir(runsRoot, runId);
  const out: Record<string, string> = {};
  for (const rel of ["source-freeze/toc.json", "source-freeze/book-source.md", "source-freeze/source-freeze-report.md"]) {
    out[rel] = readFileSync(resolve(dir, rel), "utf8");
  }
  for (const name of readdirSync(resolve(dir, "sidecars", "source")).sort()) {
    out[`sidecars/source/${name}`] = readFileSync(resolve(dir, "sidecars", "source", name), "utf8");
  }
  return out;
}

test("a valid pin adopts the named run with zero model calls and byte-stable packet inputs", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);
    // A SECOND, newer, equally compatible run: findCompatibleResearchRun sorts
    // newest-createdAt first, so adopting the OLDER pinned id proves selection
    // is by explicit id, not by the scan the pin replaces.
    const decoy = await seedCompleteRun(runsRoot, stateRoot, { forceRefresh: true });
    assert.notEqual(decoy, runId, "the decoy must be a distinct newer run");
    const before = sourceFreezeBytes(runsRoot, runId);
    const runsBefore = listRunIds(runsRoot);

    const { result, error, calls } = await pinned(runsRoot, stateRoot, runId);
    assert.equal(error, null, error?.message);
    assert.ok(result);
    assert.equal(result.runId, runId, "the pin adopts the NAMED run, not the newest compatible one");
    assert.equal(calls.bibliography, 0, "a pin must make zero bibliography model calls");
    assert.deepEqual(calls.chapters, [], "a pin must make zero chapter model calls");
    assert.deepEqual(listRunIds(runsRoot), runsBefore, "a pin creates no new research run directory");

    const after = sourceFreezeBytes(runsRoot, runId);
    // These three feed sidecarHash -> packetDigest -> the section-pack cache key.
    assert.equal(after["source-freeze/toc.json"], before["source-freeze/toc.json"]);
    assert.equal(after["source-freeze/book-source.md"], before["source-freeze/book-source.md"]);
    for (const key of Object.keys(before).filter((k) => k.startsWith("sidecars/source/"))) {
      assert.equal(after[key], before[key], `${key} must be byte-identical under a pinned reuse`);
    }
    // Deliberately OUTSIDE the packet: this file carries a wall-clock timestamp.
    assert.notEqual(
      after["source-freeze/source-freeze-report.md"],
      before["source-freeze/source-freeze-report.md"],
      "source-freeze-report.md is regenerated but is not part of sourceLogicalPaths",
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("an unresolvable pin fails closed and never falls back to scanning or creating a run", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);
    const runsBefore = listRunIds(runsRoot);

    const { error, calls } = await pinned(runsRoot, stateRoot, "20260101T000000000Z-does-not-exist");
    assert.ok(error);
    assert.match(error.message, /^RESEARCH_RUN_PIN_NOT_FOUND:/);
    assert.match(error.message, new RegExp(runId), "the message lists the available run ids so a typo looks like a typo");
    assert.equal(calls.bibliography, 0);
    assert.deepEqual(calls.chapters, []);
    assert.deepEqual(listRunIds(runsRoot), runsBefore, "a rejected pin must not create a run directory");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a pin that is not one safe opaque path segment is rejected before any filesystem read", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    await seedCompleteRun(runsRoot, stateRoot);
    const runsBefore = listRunIds(runsRoot);
    for (const bad of ["..", ".", "a/b", "../../etc", "/abs/path", "a\\\\b", "", "-leading-dash", "has space", "bel\\u0007char"]) {
      const { error, calls } = await pinned(runsRoot, stateRoot, bad);
      assert.ok(error, `expected rejection for ${JSON.stringify(bad)}`);
      assert.match(error.message, /^RESEARCH_RUN_PIN_ESCAPED:/, `for ${JSON.stringify(bad)}: ${error.message}`);
      assert.equal(calls.bibliography, 0);
      assert.deepEqual(calls.chapters, []);
    }
    assert.deepEqual(listRunIds(runsRoot), runsBefore);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

xenv(
  "a symlinked run directory that escapes the research root is rejected",
  "symlinks are unavailable on this filesystem",
  () => {
    const probe = mkdtempSync(join(tmpdir(), "cf-symlink-probe-"));
    try {
      mkdirSync(resolve(probe, "target"));
      symlinkSync(resolve(probe, "target"), resolve(probe, "link"), "dir");
      return true;
    } catch {
      return false;
    } finally {
      rmSync(probe, { recursive: true, force: true });
    }
  },
  async () => {
    const { tmp, runsRoot, stateRoot } = tempRoots();
    try {
      const runId = await seedCompleteRun(runsRoot, stateRoot);
      // Move a genuine, fully valid run OUTSIDE runsRoot and symlink it back in.
      const outside = resolve(tmp, "outside", runId);
      mkdirSync(resolve(tmp, "outside"), { recursive: true });
      cpSync(runDir(runsRoot, runId), outside, { recursive: true });
      rmSync(runDir(runsRoot, runId), { recursive: true, force: true });
      symlinkSync(outside, runDir(runsRoot, runId), "dir");

      const { error, calls } = await pinned(runsRoot, stateRoot, runId);
      assert.ok(error);
      assert.match(error.message, /^RESEARCH_RUN_PIN_ESCAPED:.*via symlink/);
      assert.equal(calls.bibliography, 0);
      assert.deepEqual(calls.chapters, []);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test("a run copied under another book, or renamed, is rejected on manifest identity", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);

    // Cross-book substitution: book A's bundle placed under book B.
    mkdirSync(resolve(runsRoot, OTHER_BOOK), { recursive: true });
    cpSync(runDir(runsRoot, runId), runDir(runsRoot, runId, OTHER_BOOK), { recursive: true });
    const cross = await pinned(runsRoot, stateRoot, runId, { bookId: OTHER_BOOK });
    assert.ok(cross.error);
    assert.match(cross.error.message, /^RESEARCH_RUN_PIN_INVALID:.*manifest bookId/);
    assert.equal(cross.calls.bibliography, 0);

    // Renamed directory: identity comes from manifest.runId, never the dir name.
    const renamed = `${runId}-copy`;
    cpSync(runDir(runsRoot, runId), runDir(runsRoot, renamed), { recursive: true });
    const renamedResult = await pinned(runsRoot, stateRoot, renamed);
    assert.ok(renamedResult.error);
    assert.match(renamedResult.error.message, /^RESEARCH_RUN_PIN_INVALID:.*manifest runId .* does not match pinned id/);
    assert.equal(renamedResult.calls.bibliography, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a pin never waives input identity or the five-field compatibility fingerprint", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);

    const drifted = await pinned(runsRoot, stateRoot, runId, { title: "A Completely Different Book" });
    assert.ok(drifted.error);
    assert.match(drifted.error.message, /^RESEARCH_RUN_PIN_INVALID:.*input hash changed/);
    assert.equal(drifted.calls.bibliography, 0);

    for (const key of ["codeVersion", "promptHash", "configHash", "provider", "model"] as const) {
      const original = JSON.parse(readFileSync(manifestPath(runsRoot, runId), "utf8")) as Record<string, any>;
      editManifest(runsRoot, runId, (raw) => {
        raw.compatibility[key] = `drifted-${key}`;
      });
      const { error, calls } = await pinned(runsRoot, stateRoot, runId);
      assert.ok(error, `${key} drift must reject`);
      assert.match(error.message, new RegExp(`^RESEARCH_RUN_PIN_INVALID:.*${key} changed`));
      assert.equal(calls.bibliography, 0);
      writeFileSync(manifestPath(runsRoot, runId), `${JSON.stringify(original, null, 2)}\n`, "utf8");
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("the pin status allowlist admits complete and running but never failed or coherence_failed", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);

    for (const status of ["failed", "coherence_failed"] as const) {
      editManifest(runsRoot, runId, (raw) => { raw.overallStatus = status; });
      const { error, calls } = await pinned(runsRoot, stateRoot, runId);
      assert.ok(error, `${status} must reject`);
      assert.match(error.message, new RegExp(`^RESEARCH_RUN_PIN_INVALID:.*status ${status} not allowed`));
      assert.equal(calls.bibliography, 0);
      assert.deepEqual(calls.chapters, []);
    }

    // "running" is the transient state a pinned adoption itself passes through
    // (researcher step 3 sets it before step 4 sets complete): admitting it keeps
    // an interrupted pin recoverable, and the full evidence set still applies.
    editManifest(runsRoot, runId, (raw) => { raw.overallStatus = "running"; });
    const ok = await pinned(runsRoot, stateRoot, runId);
    assert.equal(ok.error, null, ok.error?.message);
    assert.equal(ok.result?.runId, runId);
    assert.equal(ok.calls.bibliography, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a partially reusable run fails closed under a pin, naming the offending chapters", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);
    const runsBefore = listRunIds(runsRoot);

    const sidecar = resolve(runDir(runsRoot, runId), "sidecars", "source", "ch02.source.json");
    const original = readFileSync(sidecar, "utf8");
    rmSync(sidecar);
    const missing = await pinned(runsRoot, stateRoot, runId);
    assert.ok(missing.error);
    assert.match(missing.error.message, /^RESEARCH_RUN_PIN_INCOMPLETE:chapters \[2\]/);
    assert.equal(missing.calls.bibliography, 0);
    assert.deepEqual(missing.calls.chapters, [], "the pin must not silently re-research the missing chapter");
    writeFileSync(sidecar, original, "utf8");

    const text = resolve(runDir(runsRoot, runId), "sidecars", "source", "ch03.source.txt");
    writeFileSync(text, `${readFileSync(text, "utf8")}\ntampered\n`, "utf8");
    const tampered = await pinned(runsRoot, stateRoot, runId);
    assert.ok(tampered.error);
    assert.match(tampered.error.message, /^RESEARCH_RUN_PIN_INCOMPLETE:chapters \[3\]/);
    assert.equal(tampered.calls.bibliography, 0);
    assert.deepEqual(listRunIds(runsRoot), runsBefore);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a pinned run missing a source-freeze artifact fails closed before seed materialization", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);
    rmSync(resolve(runDir(runsRoot, runId), "source-freeze", "toc.json"));
    const { error, calls } = await pinned(runsRoot, stateRoot, runId);
    assert.ok(error);
    assert.match(error.message, /^RESEARCH_RUN_PIN_INCOMPLETE:missing source-freeze artifact\(s\): source-freeze\/toc\.json/);
    assert.equal(calls.bibliography, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a pinned run whose bibliography bytes or chapter list drift from the manifest is rejected", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);
    const rawPath = resolve(runDir(runsRoot, runId), "source-freeze", "bibliography.raw.json");
    const original = readFileSync(rawPath, "utf8");

    // (a) bytes tampered, manifest.bibliography.hash left alone.
    const tampered = JSON.parse(original) as BibliographyResult;
    tampered.thesis = `${tampered.thesis} tampered`;
    writeFileSync(rawPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
    const bytes = await pinned(runsRoot, stateRoot, runId);
    assert.ok(bytes.error);
    assert.match(bytes.error.message, /^RESEARCH_RUN_PIN_INVALID:bibliography bytes do not match manifest hash/);
    assert.equal(bytes.calls.bibliography, 0);

    // (b) a DIFFERENT chapter list whose hash IS updated in the manifest: the
    //     manifest parser still passes (expectedChapters/expectedChaptersHash are
    //     internally consistent) but the bibliography that actually feeds
    //     toc.json / book-source.md describes another book.
    const substituted = JSON.parse(original) as BibliographyResult;
    substituted.flatChapters = substituted.flatChapters!.map((ch) => ({ ...ch, title: `Substituted ${ch.number}` }));
    writeFileSync(rawPath, `${JSON.stringify(substituted, null, 2)}\n`, "utf8");
    editManifest(runsRoot, runId, (raw) => {
      raw.bibliography.hash = hashJson(substituted);
    });
    const list = await pinned(runsRoot, stateRoot, runId);
    assert.ok(list.error);
    assert.match(list.error.message, /^RESEARCH_RUN_PIN_INVALID:bibliography chapter list does not match expectedChaptersHash/);
    assert.equal(list.calls.bibliography, 0);
    writeFileSync(rawPath, original, "utf8");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a structurally tampered manifest is rejected as unreadable, not laundered", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);
    const original = readFileSync(manifestPath(runsRoot, runId), "utf8");

    editManifest(runsRoot, runId, (raw) => { raw.expectedChaptersHash = "0".repeat(64); });
    const hashDrift = await pinned(runsRoot, stateRoot, runId);
    assert.ok(hashDrift.error);
    assert.match(hashDrift.error.message, /^RESEARCH_RUN_PIN_UNREADABLE:/);
    assert.equal(hashDrift.calls.bibliography, 0);
    writeFileSync(manifestPath(runsRoot, runId), original, "utf8");

    editManifest(runsRoot, runId, (raw) => { delete raw.chapters["01"].outputJsonHash; });
    const missingHash = await pinned(runsRoot, stateRoot, runId);
    assert.ok(missingHash.error);
    assert.match(missingHash.error.message, /^RESEARCH_RUN_PIN_UNREADABLE:/);
    assert.equal(missingHash.calls.bibliography, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a pin combined with forceRefresh, or without a bookId, is rejected outright", async () => {
  const { tmp, runsRoot, stateRoot } = tempRoots();
  try {
    const runId = await seedCompleteRun(runsRoot, stateRoot);

    const forced = await pinned(runsRoot, stateRoot, runId, { forceRefresh: true });
    assert.ok(forced.error);
    assert.match(forced.error.message, /^RESEARCH_RUN_PIN_INVALID:pinned run cannot be combined with forceRefresh/);
    assert.equal(forced.calls.bibliography, 0);

    const calls: Calls = { bibliography: 0, chapters: [] };
    await assert.rejects(
      researchBook(TITLE, AUTHOR, {
        runsRoot,
        stateRoot,
        pinnedRunId: runId,
        deps: {
          runBibliography: async () => { calls.bibliography += 1; return bibliography(); },
          runChapter: async (input) => { calls.chapters.push(input.chapter.number); return chapterResult(input); },
        },
      } as Parameters<typeof researchBook>[2]),
      /^Error: RESEARCH_RUN_PIN_INVALID:bookId is required to resolve a pinned research run$/,
    );
    assert.equal(calls.bibliography, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
