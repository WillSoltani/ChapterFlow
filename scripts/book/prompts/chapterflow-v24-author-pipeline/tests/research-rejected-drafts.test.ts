/**
 * R-283 round 2 (observability) — a REJECTED research draft is persisted.
 *
 * The live Franklin failure (book-run-d51c92fc, 2026-09-04) could not be
 * diagnosed from the run directory at all. Only PASSING sidecars land under
 * `research-runs/<id>/sidecars/`, `attempts.jsonl` carries gateway metadata with
 * no model output in it, and the attempt root got no files, so the only record of
 * what the model actually wrote was the aggregate error string — a list of
 * problem lines with the offending draft gone. Every rejected draft is now
 * written under `research-runs/<id>/rejected/chNN.attemptK.json`, through the same
 * run-directory writer the sidecars use, so the next live rejection is readable
 * after the fact.
 *
 * The file is diagnostics ONLY: it is not read back by anything, it is bounded in
 * size, and it takes no part in the run's identity (the manifest hashes the two
 * sidecar files per chapter, and compatibility is over code/prompt/config), which
 * the resume assertion at the bottom pins.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import { baseResult, input } from "./researchSidecarFixture.js";
import {
  MAX_CHAPTER_RESEARCH_ATTEMPTS,
  runResearcherChapter,
  type ChapterResearchInput,
  type ChapterResearchResult,
  type RejectedChapterDraft,
} from "../src/agents/researcher-chapter.js";
import {
  MAX_REJECTED_DRAFT_BYTES,
  REJECTED_DRAFTS_DIR,
  researchBook,
  serializeRejectedDraft,
} from "../src/researcher.js";
import { readResearchRunManifest } from "../src/lib/researchRunManifest.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import type { ModelCallerExecution, ModelTaskRunner } from "../src/app/modelTaskRunner.js";

function franklinInput(): ChapterResearchInput {
  return { ...input("Benjamin Franklin", "memoir"), chapter: { number: 1, title: "Unit One" } };
}

function execution(script: Array<ChapterResearchResult | Error>): ModelCallerExecution {
  let i = 0;
  const runner: ModelTaskRunner = {
    async run(request) {
      const step = script[Math.min(i, script.length - 1)];
      i += 1;
      if (step instanceof Error) throw step;
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: step };
    },
  };
  return {
    runner,
    context: {
      bookId: "zz-rejected", runId: "run-rejected", attemptId: "attempt-1",
      stageId: "research", operationId: "op-rejected", workDir: process.cwd(),
      signal: new AbortController().signal,
    },
  };
}

// ── the agent hands every rejected draft to the sink ─────────────────────────

test("R-283 round 2: every rejected draft reaches the sink with its raw output and its problem lines", async () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  const stillBad = baseResult();
  stillBad.coreClaim = "The book still records the duty in a ledger the next member inherits.";
  const rejected: RejectedChapterDraft[] = [];

  await assert.rejects(
    runResearcherChapter(franklinInput(), execution([bad, stillBad]), {
      sleep: async () => {},
      onRejectedDraft: (record) => { rejected.push(record); },
    }),
    /chapter research invalid after 3 attempts/,
  );

  assert.equal(rejected.length, MAX_CHAPTER_RESEARCH_ATTEMPTS, "one record per rejected attempt");
  assert.deepEqual(rejected.map((record) => record.attempt), [1, 2, 3]);
  for (const record of rejected) {
    assert.equal(record.chapterNumber, 1);
    assert.ok(record.problems.some((problem) => /meta-reference "The book" found/.test(problem)), "the validator's own lines are kept");
    // The scripted runner returns `bad` once and then `stillBad`, so attempt 1
    // carries the first draft and attempts 2-3 carry the second: what is
    // persisted is THIS attempt's raw output, not a re-render of anything.
    const expected = record.attempt === 1 ? bad.coreClaim : stillBad.coreClaim;
    assert.equal((record.draft as ChapterResearchResult).coreClaim, expected, "the RAW model output is the thing persisted");
    // This rejection was repair-eligible, so the repair response is captured too:
    // without it a live post-mortem cannot tell a repair that was never made from
    // one that was made and still failed.
    assert.ok(record.repair, "a repaired attempt records its repair");
    assert.equal((record.repair!.response as ChapterResearchResult).coreClaim, stillBad.coreClaim);
    assert.ok(record.repair!.problems.some((problem) => /meta-reference/.test(problem)), "why the repaired draft was still rejected");
  }
});

test("R-283 round 2: a rejection that spent no repair records no repair, and a passing draft records nothing at all", async () => {
  const mixed = baseResult();
  mixed.coreClaim = "The book records the duty in a ledger the next member inherits.";
  mixed.voiceCues = ["only one cue"]; // not purely lexical: no repair is spent
  const rejected: RejectedChapterDraft[] = [];
  await assert.rejects(
    runResearcherChapter(franklinInput(), execution([mixed]), {
      sleep: async () => {},
      onRejectedDraft: (record) => { rejected.push(record); },
    }),
    /chapter research invalid after 3 attempts/,
  );
  assert.equal(rejected.length, MAX_CHAPTER_RESEARCH_ATTEMPTS);
  assert.ok(rejected.every((record) => record.repair === undefined));

  const clean: RejectedChapterDraft[] = [];
  const passed = await runResearcherChapter(franklinInput(), execution([baseResult()]), {
    sleep: async () => {},
    onRejectedDraft: (record) => { clean.push(record); },
  });
  assert.equal(passed.chapterNumber, 1);
  assert.deepEqual(clean, [], "a draft that passes on attempt 1 writes no rejection file");
});

test("R-283 round 2: a throwing sink cannot change what research does — diagnostics never gate the pipeline", async () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  const stillBad = baseResult();
  stillBad.coreClaim = "The book still records the duty in a ledger the next member inherits.";

  // A sink that throws on every rejected attempt must not become the run's error:
  // what the operator gets back is still the content defect the validator found.
  await assert.rejects(
    runResearcherChapter(franklinInput(), execution([bad, stillBad]), {
      sleep: async () => {},
      onRejectedDraft: () => { throw new Error("disk full"); },
    }),
    (error: Error) => {
      assert.match(error.message, /chapter research invalid after 3 attempts/);
      assert.doesNotMatch(error.message, /disk full/);
      return true;
    },
  );

  // …and a passing chapter is unaffected either way.
  const result = await runResearcherChapter(franklinInput(), execution([baseResult()]), {
    sleep: async () => {},
    onRejectedDraft: () => { throw new Error("disk full"); },
  });
  assert.equal(result.coreClaim, baseResult().coreClaim);
});

// ── the record is bounded ────────────────────────────────────────────────────

test("R-283 round 2: a huge rejected draft is truncated to a bounded, still-parseable record", () => {
  const draft = baseResult();
  draft.paraphraseNotes = "x".repeat(2 * MAX_REJECTED_DRAFT_BYTES);
  const text = serializeRejectedDraft({
    chapterNumber: 7,
    attempt: 2,
    draft,
    problems: ['meta-reference "the book" found in `coreClaim`: "…"'],
    repair: { response: draft, merged: true, problems: ["still bad"] },
  }, MAX_REJECTED_DRAFT_BYTES);

  assert.ok(Buffer.byteLength(text, "utf8") <= MAX_REJECTED_DRAFT_BYTES, `record is ${Buffer.byteLength(text, "utf8")} bytes`);
  const parsed = JSON.parse(text) as Record<string, unknown>;
  assert.equal(parsed.chapterNumber, 7);
  assert.equal(parsed.attempt, 2);
  assert.equal(parsed.truncated, true, "truncation is stated, never silent");
  assert.deepEqual(parsed.problems, ['meta-reference "the book" found in `coreClaim`: "…"'], "the problem lines survive truncation");
  assert.match(String(parsed.note ?? ""), /truncat/i);
});

test("R-283 round 2: a record that fits is written whole, with no truncation marker", () => {
  const text = serializeRejectedDraft({
    chapterNumber: 1,
    attempt: 1,
    draft: baseResult(),
    problems: ["voiceCues needs 2-4 items"],
  }, MAX_REJECTED_DRAFT_BYTES);
  const parsed = JSON.parse(text) as Record<string, unknown>;
  assert.equal(parsed.truncated, undefined);
  assert.equal((parsed.draft as ChapterResearchResult).coreClaim, baseResult().coreClaim);
  assert.equal(parsed.repair, undefined);
});

// ── the orchestrator writes it into the RUN directory ────────────────────────

const BOOK = "zz-rejected-drafts";

function bibliography(count = 2): BibliographyResult {
  return {
    bookId: BOOK,
    title: "Synthetic Rejected Drafts",
    author: "Test Author",
    edition: { name: "Synthetic edition", publisher: "Fixture Press", publishedYear: 2026, language: "English", chapterCount: count },
    flatChapters: Array.from({ length: count }, (_, i) => ({ number: i + 1, title: `Unit ${i + 1}` })),
    thesis: "A rejected draft that is not persisted cannot be diagnosed after the run.",
    teachingArc: "The arc moves from an unreadable aggregate error to a durable per-attempt record of what the model wrote.",
    authorVoice: { register: "plainspoken", signatureMoves: ["concrete operations", "short causal chains", "explicit tradeoffs"], avoidMoves: ["mysticism"] },
    confidence: "high",
  } as BibliographyResult;
}

/** A distinct admissible result per chapter — two identical sidecars would fail
 *  source coherence, which is a different guard than the one under test here. */
function chapterResult(chapterInput: ChapterResearchInput): ChapterResearchResult {
  const n = chapterInput.chapter.number;
  const word = `unit${n}`;
  const base = baseResult();
  return {
    ...base,
    chapterNumber: n,
    chapterTitle: chapterInput.chapter.title,
    focus: `${word} focus: a rotating duty in a small club keeps every member accountable to the same weekly question.`,
    coreClaim: `${word}: a duty that rotates by name is kept because the next person inherits a visible record of it.`,
    centralConcept: { ...base.centralConcept, id: `ch0${n}.concept.${word}`, name: `${word} rotating duty` },
    keyClaims: base.keyClaims.map((claim) => `${word} ${claim}`),
    namedExamples: base.namedExamples.map((example) => ({ ...example, id: `ch0${n}.${example.id}`, label: `${word} ${example.label}` })),
    testableFacts: base.testableFacts!.map((fact) => ({ ...fact, id: `ch0${n}.${fact.id}`, derivedFrom: `ch0${n}.${fact.derivedFrom}` })),
    hardEdge: `${word}: rotation is often read as fairness machinery, and it is accountability machinery — a named successor inherits the record, so neglect cannot hide inside a group average.`,
    paraphraseNotes: Array.from(
      { length: 40 },
      (_, i) => `${word}-token-${i} ${word}-record-${i} ${word}-owner-${i}`,
    ).join(" "),
  };
}

test("R-283 round 2: rejected drafts land under <runDir>/rejected/chNN.attemptK.json and nowhere else", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cf-rejected-drafts-"));
  const runsRoot = resolve(tmp, "runs");
  const stateRoot = resolve(tmp, "state");
  try {
    const first = await researchBook("Synthetic Rejected Drafts", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      chapterConcurrency: 1,
      deps: {
        runBibliography: async () => bibliography(),
        runChapter: async (chapterInput, context) => {
          if (chapterInput.chapter.number === 2) {
            const rejectedDraft = { ...chapterResult(chapterInput), coreClaim: "The book records the duty in a ledger." };
            context?.onRejectedDraft({
              chapterNumber: 2,
              attempt: 1,
              draft: rejectedDraft,
              problems: ['meta-reference "The book" found in `coreClaim`: "The book records the duty in a ledger."'],
              repair: { response: rejectedDraft, merged: true, problems: ['meta-reference "The book" found in `coreClaim`'] },
            });
          }
          return chapterResult(chapterInput);
        },
      },
    });

    const runDir = resolve(runsRoot, BOOK, first.runId);
    const rejectedDir = resolve(runDir, REJECTED_DRAFTS_DIR);
    assert.deepEqual(readdirSync(rejectedDir), ["ch02.attempt1.json"], "one file per rejected attempt, named by chapter and attempt");
    const record = JSON.parse(readFileSync(resolve(rejectedDir, "ch02.attempt1.json"), "utf8")) as Record<string, unknown>;
    assert.equal(record.chapterNumber, 2);
    assert.equal(record.attempt, 1);
    assert.match(String((record.problems as string[])[0]), /meta-reference "The book"/);
    assert.equal((record.draft as ChapterResearchResult).coreClaim, "The book records the duty in a ledger.");
    assert.ok(record.repair, "the repair response is persisted alongside the draft");
    assert.ok(typeof record.recordedAt === "string" && record.recordedAt.length > 0);

    // Chapter 1 passed: no file, and the sidecars are untouched by any of this.
    assert.ok(!existsSync(resolve(rejectedDir, "ch01.attempt1.json")));
    assert.ok(existsSync(resolve(runDir, "sidecars", "source", "ch02.source.json")));

    // The record takes no part in run identity: the manifest still parses, still
    // reports both chapters succeeded, and a second call RESUMES the same run
    // rather than minting a new one.
    const parsed = readResearchRunManifest(runDir);
    assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.errors.join("; "));
    const second = await researchBook("Synthetic Rejected Drafts", "Test Author", {
      bookId: BOOK,
      runsRoot,
      stateRoot,
      chapterConcurrency: 1,
      deps: {
        runBibliography: async () => { throw new Error("bibliography must not repeat on a compatible resume"); },
        runChapter: async () => { throw new Error("no chapter should be re-researched"); },
      },
    });
    assert.equal(second.runId, first.runId, "a rejected-draft file does not invalidate the run it sits in");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("R-283 round 2: a durable quota cap ends the loop — and the draft it ended on is still persisted", async () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  const rejected: RejectedChapterDraft[] = [];
  await assert.rejects(
    runResearcherChapter(
      franklinInput(),
      execution([bad, new Error("MODEL_TASK_FAILED:MODEL_PROCESS_FAILED:weekly limit reached; resets 2026-09-08")]),
      { sleep: async () => {}, onRejectedDraft: (record) => { rejected.push(record); } },
    ),
    /weekly limit reached/,
  );
  // The break-out path is the LAST chance to write this draft down; a run that
  // dies on a quota cap is exactly the one an operator comes back to read.
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].attempt, 1);
  assert.equal((rejected[0].draft as ChapterResearchResult).coreClaim, bad.coreClaim);
  assert.equal(rejected[0].repair?.merged, false);
  assert.ok(rejected[0].repair!.problems.some((problem) => /weekly limit reached/.test(problem)));
});
