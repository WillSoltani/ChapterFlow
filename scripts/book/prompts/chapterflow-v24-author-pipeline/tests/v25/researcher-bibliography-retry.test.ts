import assert from "node:assert/strict";

import { isPlaceholderChapterTitle, runResearcherBibliography, type BibliographyResult } from "../../src/agents/researcher-bibliography.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import { createScriptedResultRunner, mintingExecution } from "./fakes/uniquenessRunner.js";
import { isCredentialFailureMessage, isUnretryableProviderMessage } from "../../src/runtime/modelErrors.js";
import { finishV25Tests, requiredTest } from "./harness.js";

/**
 * Task 11ag — bounded retry for the BIBLIOGRAPHY researcher.
 *
 * Bibliography is step 1 of a book run and was the ONE research surface with no
 * retry at all: a single degenerate or transient response aborted the entire run
 * before any chapter work could start. Live 2026-07-28 (Franklin canary): the
 * agent returned a bare {} and the run died with "bibliography invalid: bookId
 * \"undefined\" must be a lowercase-dash slug; title missing; author missing; ...".
 *
 * These pin the same classes chapter research already handles (11a/11j/11k/11ad/11af).
 */

function validBibliography(): BibliographyResult {
  return {
    bookId: "the-autobiography-of-benjamin-franklin",
    title: "The Autobiography of Benjamin Franklin",
    author: "Benjamin Franklin",
    edition: { publisher: "Dover", publishedYear: 1996, chapterCount: 4, isbn13: "9780486290737", language: "en" },
    flatChapters: [
      { number: 1, title: "Boyhood and Apprenticeship" },
      { number: 2, title: "The Thirteen Virtues" },
      { number: 3, title: "Civic Projects" },
      { number: 4, title: "Public Service" },
    ],
    thesis: "A life can be engineered by deliberate, tracked practice rather than left to temperament or luck.",
    teachingArc: "Franklin moves from imitation and self-education, through a written system for habit change, to civic institutions built on the same method. Each stage reuses the prior one's discipline at a larger scale.",
    authorVoice: {
      register: "plainspoken",
      signatureMoves: ["self-deprecating anecdote", "ledger accounting of behavior", "practical civic proposal"],
      avoidMoves: ["moralizing without a worked example"],
    },
    confidence: "high",
  };
}

function input() {
  return { title: "The Autobiography of Benjamin Franklin", author: "Benjamin Franklin" };
}

function scriptedRig(script: readonly Readonly<{ outcome: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "CANCELLED" | "UNKNOWN"; output?: unknown; error?: { code: string; message: string } }>[]) {
  const base: ModelTaskContext = {
    bookId: "the-autobiography-of-benjamin-franklin",
    runId: "run-fixture",
    attemptId: "attempt-fixture",
    stageId: "research",
    operationId: "research-bibliography",
    workDir: "/tmp/cf-v25-biblio-retry",
    signal: new AbortController().signal,
  };
  const { runner, prompts, runs } = createScriptedResultRunner(script);
  const seen = new Set<string>();
  const attemptIds: string[] = [];
  const recordingRunner = {
    async run(request: Parameters<typeof runner.run>[0]) {
      attemptIds.push(request.context.attemptId);
      if (seen.has(request.context.attemptId)) throw new Error(`attempt id reused: ${request.context.attemptId}`);
      seen.add(request.context.attemptId);
      return runner.run(request);
    },
  };
  return { execution: mintingExecution(recordingRunner, base), prompts, runs, attemptIds };
}

function recordingSleep() {
  const waited: number[] = [];
  return { sleep: async (ms: number): Promise<void> => { waited.push(ms); }, waited };
}

requiredTest("1 a degenerate bare {} bibliography retries with a complete-object directive and then succeeds (Task 11ag)", async () => {
  const subject = scriptedRig([
    { outcome: "SUCCEEDED", output: {} },
    { outcome: "SUCCEEDED", output: validBibliography() },
  ]);
  const clock = recordingSleep();
  const result = await runResearcherBibliography(input(), subject.execution, { sleep: clock.sleep });
  assert.equal(result.bookId, "the-autobiography-of-benjamin-franklin");
  assert.equal(subject.runs(), 2, "the empty must be retried, not fatal");
  const retryPrompt = subject.prompts.at(-1) ?? "";
  assert.match(retryPrompt, /complete/i, "retry must demand a complete object");
  assert.doesNotMatch(retryPrompt, /\{\s*\}/, "never echo the empty blob back (11ad entrenchment)");
  assert.equal(new Set(subject.attemptIds).size, 2, "each attempt admits a fresh id");
});

requiredTest("2 a validator-rejected bibliography retries with its exact problems and then succeeds (Task 11ag)", async () => {
  const partial = { ...validBibliography(), thesis: "too short" } as BibliographyResult;
  const subject = scriptedRig([
    { outcome: "SUCCEEDED", output: partial },
    { outcome: "SUCCEEDED", output: validBibliography() },
  ]);
  const result = await runResearcherBibliography(input(), subject.execution, { sleep: async () => {} });
  assert.equal(result.confidence, "high");
  assert.equal(subject.runs(), 2);
  assert.match(subject.prompts.at(-1) ?? "", /thesis too short/i, "retry must carry the validator's own problem line");
});

requiredTest("3 a persistently invalid bibliography fails closed after MAX_ATTEMPTS(3) with accumulated problems (Task 11ag)", async () => {
  const subject = scriptedRig([{ outcome: "SUCCEEDED", output: {} }]);
  const clock = recordingSleep();
  await assert.rejects(
    runResearcherBibliography(input(), subject.execution, { sleep: clock.sleep }),
    (error: unknown) => {
      assert.match((error as Error).message, /bibliography invalid/i);
      assert.match((error as Error).message, /3 attempt/i);
      return true;
    },
  );
  assert.equal(subject.runs(), 3, "exactly MAX_ATTEMPTS — never a fourth");
});

requiredTest("4 a transient MODEL_PROCESS_FAILED retries after bounded backoff, then succeeds (Task 11ag)", async () => {
  const subject = scriptedRig([
    { outcome: "FAILED", error: { code: "MODEL_PROCESS_FAILED", message: "bounded model process did not succeed" } },
    { outcome: "SUCCEEDED", output: validBibliography() },
  ]);
  const clock = recordingSleep();
  const result = await runResearcherBibliography(input(), subject.execution, { sleep: clock.sleep });
  assert.equal(result.author, "Benjamin Franklin");
  assert.equal(subject.runs(), 2);
  assert.deepEqual(clock.waited, [2000], "one bounded backoff before attempt 2");
});

requiredTest("5 durable QUOTA EXHAUSTION fails fast on attempt 1 with the real provider message (Task 11ag + 11af)", async () => {
  const subject = scriptedRig([
    { outcome: "FAILED", error: { code: "MODEL_PROCESS_FAILED", message: "You've hit your weekly limit · resets Jul 28 at 8pm (America/Halifax) (api_error_status=429)" } },
  ]);
  const clock = recordingSleep();
  await assert.rejects(
    runResearcherBibliography(input(), subject.execution, { sleep: clock.sleep }),
    (error: unknown) => {
      assert.match((error as Error).message, /weekly limit/i);
      return true;
    },
  );
  assert.equal(subject.runs(), 1, "quota exhaustion must not burn further attempts");
  assert.deepEqual(clock.waited, []);
});

requiredTest("7 CREDENTIAL failure fails fast on attempt 1 with the provider's own words (Task 11aj)", async () => {
  const subject = scriptedRig([
    { outcome: "FAILED", error: { code: "MODEL_PROCESS_FAILED", message: "Not logged in \u00b7 Please run /login" } },
  ]);
  const clock = recordingSleep();
  await assert.rejects(
    runResearcherBibliography(input(), subject.execution, { sleep: clock.sleep }),
    (error: unknown) => {
      assert.match((error as Error).message, /not logged in/i, "the operator must see the real cause");
      assert.doesNotMatch((error as Error).message, /transient/i, "a login failure is not a transient blip");
      return true;
    },
  );
  assert.equal(subject.runs(), 1, "a credential failure must not burn further attempts");
  assert.deepEqual(clock.waited, [], "no backoff on a credential block");
});

requiredTest("8 isCredentialFailureMessage separates auth blocks from ordinary failures (Task 11aj)", () => {
  assert.equal(isCredentialFailureMessage("Not logged in \u00b7 Please run /login"), true);
  assert.equal(isCredentialFailureMessage("authentication failed"), true);
  assert.equal(isCredentialFailureMessage("bounded model process did not succeed"), false);
  assert.equal(isCredentialFailureMessage("API Error: 429 rate_limit_error"), false);
  // the union used by the retry loops covers quota AND credentials
  assert.equal(isUnretryableProviderMessage("You've hit your weekly limit \u00b7 resets Jul 28 at 8pm"), true);
  assert.equal(isUnretryableProviderMessage("Not logged in"), true);
  assert.equal(isUnretryableProviderMessage("bounded model process did not succeed"), false);
});

requiredTest("6 CANCELLED propagates immediately with NO retry (Task 11ag)", async () => {
  const subject = scriptedRig([
    { outcome: "CANCELLED", error: { code: "MODEL_RUN_CANCELLED", message: "operator cancelled the run" } },
  ]);
  await assert.rejects(runResearcherBibliography(input(), subject.execution, { sleep: async () => {} }), () => true);
  assert.equal(subject.runs(), 1, "operator intent is never retried");
});

/**
 * Live defect (Franklin, run book-run-4dc2a413, 2026-09-17): the frozen source
 * text carries only bare roman numerals as in-text chapter headings, so the
 * bibliography agent copied the numeral for 8 of 19 chapters ("VII", "X", ...)
 * and recalled real titles for the rest. The validator accepted any non-empty
 * title, and the title is FROZEN chapter identity downstream (the repair lane
 * refuses a replacement whose title differs, PR #562; the reader panel flags
 * "Chapter 7: VII" as READER.BLOCKING.structurally_invalid), so it must be
 * caught HERE, where the existing retry loop can re-prompt for a real title.
 */
const FRANKLIN_LIVE_TITLES: readonly string[] = [
  "I",                              // 1  placeholder
  "Beginning Life as a Printer",    // 2
  "Arrival in Philadelphia",        // 3
  "First Visit to Boston",          // 4
  "Early Friends in Philadelphia",  // 5
  "First Visit to London",          // 6
  "VII",                            // 7  placeholder
  "VIII",                           // 8  placeholder
  "IX",                             // 9  placeholder
  "X",                              // 10 placeholder
  "Interest in Public Affairs",     // 11
  "Defense of the Province",        // 12
  "Public Services and Duties",     // 13
  "Albany Plan of Union",           // 14
  "XV",                             // 15 placeholder
  "Braddock's Expedition",          // 16
  "XVII",                           // 17 placeholder
  "Scientific Experiments",         // 18
  "XIX",                            // 19 placeholder
];

const PLACEHOLDER_CHAPTERS = [1, 7, 8, 9, 10, 15, 17, 19] as const;
const REAL_TITLE_CHAPTERS = [2, 3, 4, 5, 6, 11, 12, 13, 14, 16, 18] as const;

function bibliographyWithTitles(titles: readonly string[]): BibliographyResult {
  const base = validBibliography();
  return {
    ...base,
    edition: { ...base.edition, chapterCount: titles.length },
    flatChapters: titles.map((title, index) => ({ number: index + 1, title })),
  };
}

requiredTest("9 the live Franklin bibliography is rejected naming every bare-numeral chapter and no real-titled one (2026-09-17)", async () => {
  const bad = bibliographyWithTitles(FRANKLIN_LIVE_TITLES);
  const subject = scriptedRig([{ outcome: "SUCCEEDED", output: bad }]);
  await assert.rejects(
    runResearcherBibliography(input(), subject.execution, { sleep: async () => {} }),
    (error: unknown) => {
      const message = (error as Error).message;
      for (const number of PLACEHOLDER_CHAPTERS) {
        assert.match(
          message,
          new RegExp(`chapter ${number} title "${FRANKLIN_LIVE_TITLES[number - 1]}" is a bare numeral/placeholder`),
          `chapter ${number} ("${FRANKLIN_LIVE_TITLES[number - 1]}") must be reported as a placeholder title`,
        );
      }
      assert.match(message, /short descriptive title \(3-8 words\)/, "the problem must tell the model what to do instead");
      for (const number of REAL_TITLE_CHAPTERS) {
        assert.doesNotMatch(
          message,
          new RegExp(`chapter ${number} title`),
          `chapter ${number} ("${FRANKLIN_LIVE_TITLES[number - 1]}") is a real title and must NOT be reported`,
        );
      }
      return true;
    },
  );
  assert.equal(subject.runs(), 3, "the placeholder titles go through the ordinary retry budget");
});

requiredTest("10 a numeral-titled first attempt is re-prompted with the placeholder problems and a titled second attempt is accepted (2026-09-17)", async () => {
  const fixed = FRANKLIN_LIVE_TITLES.map((title, index) =>
    (PLACEHOLDER_CHAPTERS as readonly number[]).includes(index + 1) ? `Descriptive Title For Chapter ${index + 1}` : title,
  );
  const subject = scriptedRig([
    { outcome: "SUCCEEDED", output: bibliographyWithTitles(FRANKLIN_LIVE_TITLES) },
    { outcome: "SUCCEEDED", output: bibliographyWithTitles(fixed) },
  ]);
  const result = await runResearcherBibliography(input(), subject.execution, { sleep: async () => {} });
  assert.equal(result.flatChapters?.[6]?.title, "Descriptive Title For Chapter 7");
  assert.equal(subject.runs(), 2);
  const retryPrompt = subject.prompts.at(-1) ?? "";
  assert.match(retryPrompt, /chapter 7 title "VII" is a bare numeral\/placeholder/, "the retry directive must carry the placeholder problem");
  assert.match(retryPrompt, /chapter 1 title "I" is a bare numeral\/placeholder/);
});

requiredTest("11 isPlaceholderChapterTitle separates bare numerals and structural labels from real titles (2026-09-17)", () => {
  // Placeholders: a bare roman numeral, a bare number, a structural label with
  // or without its number, and any single character.
  for (const title of ["VII", "x", "10", "10.", "Chapter 7", "Part II", "Section", "X", "A"]) {
    assert.equal(isPlaceholderChapterTitle(title), true, `"${title}" is a placeholder chapter title`);
  }
  // Real titles. "The Year 1776" carries words around the number and passes;
  // "1776" ALONE would be a bare number and is rejected (asserted below).
  for (const title of ["Beginning Life as a Printer", "Braddock's Expedition", "The Year 1776", "X-Men Origins"]) {
    assert.equal(isPlaceholderChapterTitle(title), false, `"${title}" is a real chapter title`);
  }
  assert.equal(isPlaceholderChapterTitle("1776"), true, "a bare year is still a bare number");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
