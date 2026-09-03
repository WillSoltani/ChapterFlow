/**
 * Research-run bounds and honest signals (R-022, R-035).
 *
 *  R-022 the per-run research attempt cap was a flat 4096 — roughly 300x what
 *        any real book needs — so it bounded nothing. It is now derived from the
 *        SAME retry budgets the research stage actually spends, against an
 *        explicit chapter ceiling, so it moves when those budgets move.
 *  R-035 `confidence: "low"` from the bibliography agent was written into an
 *        empty `if` block and printed to stdout, so nothing durable recorded
 *        that a book was researched off a low-confidence table of contents. It
 *        is now an event in the research run manifest. It does NOT fail the run:
 *        low confidence is the model's honest signal, not an error.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

import { test } from "./harness.js";
import {
  MAX_RESEARCHABLE_CHAPTERS,
  MAX_RESEARCH_ATTEMPTS,
  researchAttemptCapForChapters,
} from "../src/app/researchCandidateApplicationPort.js";
import { MAX_BIBLIOGRAPHY_ATTEMPTS, type BibliographyResult } from "../src/agents/researcher-bibliography.js";
import { MAX_CHAPTER_RESEARCH_ATTEMPTS, type ChapterResearchInput, type ChapterResearchResult } from "../src/agents/researcher-chapter.js";
import { researchBook } from "../src/researcher.js";
import { RESEARCH_RUN_MANIFEST_FILE, type ResearchRunManifest } from "../src/lib/researchRunManifest.js";

// ── R-022 ────────────────────────────────────────────────────────────────────

test("R-022: the attempt cap for a book is its real retry budget, not a flat constant", () => {
  // One chapter: its own bounded retries plus the bibliography's.
  assert.equal(researchAttemptCapForChapters(1), MAX_CHAPTER_RESEARCH_ATTEMPTS + MAX_BIBLIOGRAPHY_ATTEMPTS);
  // A 12-chapter book: 12 x chapter retries + the bibliography's.
  assert.equal(researchAttemptCapForChapters(12), 12 * MAX_CHAPTER_RESEARCH_ATTEMPTS + MAX_BIBLIOGRAPHY_ATTEMPTS);
  // The cap grows by exactly one chapter's retry budget per chapter.
  assert.equal(
    researchAttemptCapForChapters(13) - researchAttemptCapForChapters(12),
    MAX_CHAPTER_RESEARCH_ATTEMPTS,
  );
});

test("R-022: the run-definition cap is the derived ceiling, not 4096", () => {
  assert.equal(MAX_RESEARCH_ATTEMPTS, researchAttemptCapForChapters(MAX_RESEARCHABLE_CHAPTERS));
  assert.notEqual(MAX_RESEARCH_ATTEMPTS, 4096);
  // Still generous enough for any real book: the longest chapter list the
  // pipeline admits, at full retry, plus the bibliography's own attempts.
  assert.ok(MAX_RESEARCH_ATTEMPTS >= researchAttemptCapForChapters(MAX_RESEARCHABLE_CHAPTERS));
  assert.ok(MAX_RESEARCHABLE_CHAPTERS >= 60, "the ceiling must clear any real book's chapter count");
});

// ── R-035 ────────────────────────────────────────────────────────────────────

const BOOK = "zz-low-confidence";

function bibliography(confidence: BibliographyResult["confidence"], notes?: string): BibliographyResult {
  return {
    bookId: BOOK,
    title: "Synthetic Low Confidence",
    author: "Test Author",
    edition: { name: "Synthetic edition", publisher: "Fixture Press", publishedYear: 2026, language: "English", chapterCount: 2 },
    flatChapters: [{ number: 1, title: "Part One" }, { number: 2, title: "Part Two" }],
    thesis: "A book researched off an uncertain table of contents must say so where a reviewer will find it.",
    teachingArc: "The arc moves from an unrecorded stdout warning to a durable manifest event a later reader can audit.",
    authorVoice: { register: "plainspoken", signatureMoves: ["concrete operations", "short causal chains", "explicit tradeoffs"], avoidMoves: ["mysticism"] },
    confidence,
    ...(notes === undefined ? {} : { notes }),
  } as BibliographyResult;
}

function chapterResult(input: ChapterResearchInput): ChapterResearchResult {
  const n = input.chapter.number;
  const word = `unit${n}`;
  return {
    chapterNumber: n,
    chapterTitle: input.chapter.title,
    focus: `${word} focus explains how an uncertain source table is recorded with enough concrete operational detail.`,
    coreClaim: `${word} an uncertain source table must be recorded where a later reviewer will find it.`,
    centralConcept: {
      name: `${word} durable warning`,
      plainDefinition: `${word} means a low-confidence signal is written to the run manifest instead of stdout only.`,
      whyItMatters: `${word} protects a reviewer from grading work without knowing its source table was uncertain.`,
    },
    keyClaims: [
      `${word} signals should be durable.`,
      `${word} signals need an audit trail.`,
      `${word} signals should not block an honest run.`,
      `${word} signals belong beside the run they describe.`,
    ],
    namedExamples: [{
      label: `${word} reviewer`,
      summary: `A ${word} reviewer opens the run manifest and reads the recorded confidence before grading anything.`,
      teachesWhat: `The ${word} record is what makes the signal auditable later.`,
    }],
    hardEdge: `${word} handling must not fail the run: low confidence is the model's honest signal about its own knowledge, not an error state.`,
    voiceCues: [`${word} directness`, `${word} concrete sequencing`],
    paraphraseNotes: Array.from({ length: 90 }, (_, i) => `${word}-token-${i} ${word}-evidence-${i} ${word}-restart-${i} ${word}-claim-${i} ${word}-record-${i}`).join(" "),
  };
}

async function runWith(confidence: BibliographyResult["confidence"], notes?: string): Promise<{ manifest: ResearchRunManifest; logLines: string[]; cleanup: () => void }> {
  const tmp = mkdtempSync(join(tmpdir(), "cf-low-confidence-"));
  const logLines: string[] = [];
  const result = await researchBook("Synthetic Low Confidence", "Test Author", {
    bookId: BOOK,
    runsRoot: resolve(tmp, "runs"),
    stateRoot: resolve(tmp, "state"),
    chapterConcurrency: 2,
    logger: (m: string) => { logLines.push(m); },
    deps: {
      runBibliography: async () => bibliography(confidence, notes),
      runChapter: async (input) => chapterResult(input),
    },
  });
  const manifest = JSON.parse(
    readFileSync(resolve(result.bundlePath, RESEARCH_RUN_MANIFEST_FILE), "utf8"),
  ) as ResearchRunManifest;
  return { manifest, logLines, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

test("R-035: a low-confidence bibliography is recorded in the research run manifest", async () => {
  const { manifest, cleanup } = await runWith("low", "Chapter titles inferred from a part list.");
  try {
    const events = manifest.events.filter((e) => e.type === "bibliography.low_confidence");
    assert.equal(events.length, 1, `expected one low-confidence event, got ${JSON.stringify(manifest.events)}`);
    assert.match(events[0].message, /low/i);
    assert.equal(events[0].data?.confidence, "low");
    assert.equal(events[0].data?.notes, "Chapter titles inferred from a part list.");
    // The run is NOT failed by the signal.
    assert.notEqual(manifest.overallStatus, "failed");
  } finally {
    cleanup();
  }
});

test("R-035: a high-confidence bibliography records no such event", async () => {
  const { manifest, cleanup } = await runWith("high");
  try {
    assert.deepEqual(manifest.events.filter((e) => e.type === "bibliography.low_confidence"), []);
  } finally {
    cleanup();
  }
});

test("R-035: the low-confidence warning is printed once, not once per writer of it", async () => {
  // The durable manifest event and the operator-facing line are one signal.
  // Printing it from both the bibliography step and the run-creation step made
  // a single low-confidence run look like two independent findings.
  const { logLines, cleanup } = await runWith("low", "Chapter titles inferred from a part list.");
  try {
    const warnings = logLines.filter((line) => /WARNING: low confidence/i.test(line));
    assert.equal(warnings.length, 1, `expected one low-confidence log line, got ${JSON.stringify(warnings)}`);
  } finally {
    cleanup();
  }
});
