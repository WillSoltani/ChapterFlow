/**
 * Researcher chapter-sidecar guards (R-023, R-024, R-025, R-034).
 *
 * The chapter validator is the only thing standing between a model-minted
 * sidecar and every downstream writer, because no downstream agent ever sees
 * the book. These tests pin four properties the Phase-A audit found broken on
 * the released Franklin book:
 *
 *  R-023 the author-verb guard must be derived from THIS book's author, not a
 *        hardcoded surname list that happens to omit the author in hand.
 *  R-024 the meta-reference guard must scan testableFacts, example labels and
 *        hardSpecifics — narrative fields the packet carries to writers.
 *  R-025 one attempt must report EVERY distinct meta hit, so a single retry can
 *        fix them all rather than burning the 3-attempt budget one hit at a time.
 *  R-034 the .txt sidecar (what source-loader.ts and the BP6 pattern audit read)
 *        must carry hardSpecifics, testableFacts and frameworks.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  authorSurnames,
  collectChapterResearchProblems,
  renderChapterSidecar,
  runResearcherChapter,
  type ChapterResearchResult,
} from "../src/agents/researcher-chapter.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import { baseResult, input } from "./researchSidecarFixture.js";
import type { ModelCallerExecution, ModelTaskRunner } from "../src/app/modelTaskRunner.js";
import { runSourceCoherenceCheck } from "../src/critics/sourceCoherence.js";

const metaProblems = (problems: string[]): string[] => problems.filter((p) => p.startsWith("meta-reference"));
const verbProblems = (problems: string[]): string[] => problems.filter((p) => p.startsWith("author-surname-verb"));

// ── R-023 ────────────────────────────────────────────────────────────────────

test("R-023: authorSurnames derives the surname from a full author name", () => {
  assert.deepEqual(authorSurnames("Benjamin Franklin"), ["franklin"]);
  assert.deepEqual(authorSurnames("Nassim Nicholas Taleb"), ["taleb"]);
  assert.deepEqual(authorSurnames("Chip Heath and Dan Heath"), ["heath"]);
  assert.deepEqual(authorSurnames("Martin Luther King, Jr."), ["king"]);
  assert.deepEqual(authorSurnames(""), []);
});

test("R-023: the author-verb guard fires for THIS book's author, not a hardcoded list", () => {
  const r = baseResult();
  r.keyClaims[0] = "Franklin argues that a rotating duty is inherited by name.";
  const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
  assert.equal(verbProblems(problems).length, 1, `expected one author-verb problem, got ${JSON.stringify(problems)}`);
  assert.match(verbProblems(problems)[0], /Franklin argues/);
});

test("R-023: the author-verb guard does NOT fire for an unrelated author's surname", () => {
  const r = baseResult();
  // "Kahneman" is a surname from the deleted hardcoded list. On a Franklin book
  // it is a third-party attribution, not a meta-reference to THIS text.
  r.keyClaims[0] = "Kahneman argues that attention is a scarce resource.";
  const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
  assert.deepEqual(verbProblems(problems), []);
});

// ── R-053 — the memoir carve-out, END TO END on BOTH routes ─────────────────
//
// REVIEW ROUND 3, blocking finding. R-053 narrowed the author-verb alternation on
// memoirs, and the carve-out landed at ONE of the two call sites: the researcher's
// own validator passed the genre, `critics/sourceCoherence.ts` (SC5) did not. A
// memoir sidecar naming its subject as an actor therefore PASSED research and then
// tripped SC5, and researcher.ts aborts the whole research session on a coherence
// blocker — after every chapter has been paid for. The guard's signature now takes
// the bibliography record, so a call site cannot drop the genre by forgetting an
// argument, and this test drives one sidecar through BOTH routes.
//
// It is RED against the old second call site: reverting SC5 to
// `authorVerbRegexes({ author: bibliography.author })` makes the memoir assertions
// below fail with SC5.author_surname_verb while the researcher half still passes,
// which is exactly the split the finding describes.

/** Both routes' verdicts for one sidecar, so neither can be pinned alone. */
function bothRoutes(r: ChapterResearchResult, author: string, genre?: BibliographyResult["genre"]) {
  const in_ = input(author, genre);
  const report = runSourceCoherenceCheck({ bibliography: in_.bibliography, chapters: [r] });
  return {
    researchVerbProblems: verbProblems(collectChapterResearchProblems(r, in_)),
    coherenceCodes: report.findings.map((f) => f.code),
    coherencePassed: report.passed,
  };
}

test("R-053 (round 3): the fixture is clean on BOTH routes, so any finding below is the mutation", () => {
  const clean = bothRoutes(baseResult(), "Benjamin Franklin", "memoir");
  assert.deepEqual(clean.researchVerbProblems, []);
  assert.deepEqual(clean.coherenceCodes, [], "the base sidecar must pass the coherence critic clean");
  assert.equal(clean.coherencePassed, true);
});

test("R-053 (round 3): a memoir sidecar naming its subject as an actor passes research AND the coherence critic", () => {
  for (const worldly of [
    "Franklin opens a printing house on Market Street with a borrowed press.",
    "Franklin introduces the lightning rod to Philadelphia rooftops.",
  ]) {
    const r = baseResult();
    r.keyClaims[0] = worldly;
    const memoir = bothRoutes(r, "Benjamin Franklin", "memoir");
    assert.deepEqual(memoir.researchVerbProblems, [], `research validator blocked: ${worldly}`);
    assert.ok(
      !memoir.coherenceCodes.includes("SC5.author_surname_verb"),
      `SC5 blocked a memoir construction the researcher accepted (${worldly}): ${JSON.stringify(memoir.coherenceCodes)}`,
    );
    assert.equal(memoir.coherencePassed, true, `the research stage would abort on: ${worldly}`);

    // The carve-out is GENRE-GATED, not a weakening: the same sentence on a
    // non-memoir book is still blocked on both routes, exactly as before R-053.
    const other = bothRoutes(r, "Benjamin Franklin", "practical");
    assert.equal(other.researchVerbProblems.length, 1, `non-memoir research must still block: ${worldly}`);
    assert.ok(other.coherenceCodes.includes("SC5.author_surname_verb"), `non-memoir SC5 must still block: ${worldly}`);
    assert.equal(other.coherencePassed, false);

    // An UNCLASSIFIED book behaves byte-for-byte as it did before the field existed.
    const unclassified = bothRoutes(r, "Benjamin Franklin", undefined);
    assert.equal(unclassified.researchVerbProblems.length, 1);
    assert.ok(unclassified.coherenceCodes.includes("SC5.author_surname_verb"));
  }
});

test("R-053 (round 3): on a memoir BOTH routes still block every text-attribution verb", () => {
  for (const speaking of [
    "Franklin argues that a rotating duty is inherited by name.",
    "Franklin writes that a visible ledger makes neglect legible.",
    "Franklin claims the ward rota was his own idea.",
    "Franklin notes the price of the borrowed press.",
    "Franklin observes the tide of subscriptions turning.",
    "Franklin says the query must be written down.",
    "Franklin explains the draught of the stove.",
    "Franklin points out the cost of a skipped patrol.",
  ]) {
    const r = baseResult();
    r.keyClaims[0] = speaking;
    const memoir = bothRoutes(r, "Benjamin Franklin", "memoir");
    assert.equal(memoir.researchVerbProblems.length, 1, `memoir research must still block: ${speaking}`);
    assert.ok(memoir.coherenceCodes.includes("SC5.author_surname_verb"), `memoir SC5 must still block: ${speaking}`);
    assert.equal(memoir.coherencePassed, false);
  }
});

// ── R-024 ────────────────────────────────────────────────────────────────────

test("R-024: the meta-reference guard scans every testableFacts field", () => {
  const fields = ["claim", "becauseMechanism", "commonError", "errorIsWhy"] as const;
  for (const field of fields) {
    const r = baseResult();
    r.testableFacts![0][field] = "The book leaves the estate negotiation unresolved.";
    const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
    assert.ok(
      metaProblems(problems).length > 0,
      `expected a meta-reference problem for testableFacts[0].${field}, got ${JSON.stringify(problems)}`,
    );
  }
});

test("R-024: the meta-reference guard scans example labels, hardSpecifics and the concept name", () => {
  for (const mutate of [
    (r: ChapterResearchResult) => { r.namedExamples[0].label = "The book's closing plea"; },
    (r: ChapterResearchResult) => { r.namedExamples[0].hardSpecifics = ["chapter 4", "each Friday"]; },
    (r: ChapterResearchResult) => { r.centralConcept.name = "the author's rotating duty"; },
  ]) {
    const r = baseResult();
    mutate(r);
    const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
    assert.ok(metaProblems(problems).length > 0, `expected a meta-reference problem, got ${JSON.stringify(problems)}`);
  }
});

// ── R-025 ────────────────────────────────────────────────────────────────────

test("R-025: one attempt reports every DISTINCT meta-reference, not only the first", () => {
  const r = baseResult();
  r.focus = "This chapter explains why a rotating duty is inherited by name in a small club.";
  r.coreClaim = "The author records the duty in a ledger the next member inherits.";
  r.hardEdge = "The book is often read as fairness machinery. It is accountability machinery, because a named successor inherits the record and neglect cannot hide.";
  const found = metaProblems(collectChapterResearchProblems(r, input("Benjamin Franklin")));
  const joined = found.join(" | ").toLowerCase();
  for (const phrase of ["this chapter", "the author", "the book"]) {
    assert.ok(joined.includes(`"${phrase}"`), `expected "${phrase}" to be reported; got ${JSON.stringify(found)}`);
  }
});

test("R-025: a repeated meta-reference is reported once and the report is capped", () => {
  const r = baseResult();
  r.keyClaims = r.keyClaims.map(() => "The author repeats the same phrase in every claim.");
  const found = metaProblems(collectChapterResearchProblems(r, input("Benjamin Franklin")));
  assert.equal(found.length, 1, `expected one deduped problem, got ${JSON.stringify(found)}`);
});

test("R-025: every distinct author-verb construction is reported, not only the first", () => {
  const r = baseResult();
  r.keyClaims[0] = "Franklin argues that a rotating duty is inherited by name.";
  r.keyClaims[1] = "Franklin writes that a visible ledger makes neglect legible.";
  const found = verbProblems(collectChapterResearchProblems(r, input("Benjamin Franklin")));
  assert.equal(found.length, 2, `expected both constructions, got ${JSON.stringify(found)}`);
});

// ── R-034 ────────────────────────────────────────────────────────────────────

test("R-034: the .txt sidecar carries hardSpecifics, testableFacts and frameworks", () => {
  const rendered = renderChapterSidecar(baseResult());
  assert.match(rendered, /written query/, "hardSpecifics missing from the .txt sidecar");
  assert.match(rendered, /one member in turn wrote the week's query/, "testableFacts claim missing");
  assert.match(rendered, /Turn-taking names a single owner for each Friday/, "testableFacts becauseMechanism missing");
  assert.match(rendered, /spread reading costs evenly across the tradesmen/, "testableFacts commonError missing");
  assert.match(rendered, /what made the query appear each week was one attributable owner/, "testableFacts errorIsWhy missing");
  assert.match(rendered, /Junto queries/, "frameworks missing");
});

// ── End-to-end through the retry loop ────────────────────────────────────────
//
// The two tests above exercise collectChapterResearchProblems directly, which
// this branch had to export. These two go through runResearcherChapter — the
// entry point that already existed — so the RED they produce on the pre-change
// code is a BEHAVIOUR difference (a bad sidecar was accepted; a retry carried
// one hit) rather than a missing export.

function execution(outputs: ChapterResearchResult[], userPrompts: string[]): ModelCallerExecution {
  const decoder = new TextDecoder();
  let i = 0;
  const runner: ModelTaskRunner = {
    async run(request) {
      const userPrompt = request.prompt.inputs.find((input) => input.name === "user_prompt");
      userPrompts.push(userPrompt ? decoder.decode(userPrompt.bytes) : "");
      const output = outputs[Math.min(i, outputs.length - 1)];
      i += 1;
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
    },
  };
  return {
    runner,
    context: {
      bookId: "zz-guards", runId: "run-guards", attemptId: "attempt-1",
      stageId: "research", operationId: "op-guards", workDir: process.cwd(),
      signal: new AbortController().signal,
    },
  };
}

test("the fixture used by these guard tests is otherwise admissible", () => {
  assert.deepEqual(collectChapterResearchProblems(baseResult(), input("Benjamin Franklin")), []);
});

test("R-024 (e2e): a sidecar whose ONLY defect is a meta-reference inside testableFacts is rejected", async () => {
  const bad = baseResult();
  bad.testableFacts![0].claim = "The book leaves the estate negotiation unresolved.";
  const prompts: string[] = [];
  await assert.rejects(
    runResearcherChapter(input("Benjamin Franklin"), execution([bad], prompts), { sleep: async () => {} }),
    /chapter research invalid after \d+ attempts/,
    "a meta-reference in testableFacts must not reach the writers",
  );
});

test("R-025 (e2e): the retry sent to the model carries EVERY meta hit from the failed attempt", async () => {
  const bad = baseResult();
  bad.focus = "This chapter explains why a rotating duty is inherited by name in a small club.";
  bad.coreClaim = "The author records the duty in a ledger the next member inherits.";
  bad.testableFacts![0].commonError = "The book is read as a fairness story.";
  const prompts: string[] = [];
  const result = await runResearcherChapter(
    input("Benjamin Franklin"),
    execution([bad, baseResult()], prompts),
    { sleep: async () => {} },
  );
  assert.equal(prompts.length, 2, "the bad attempt must be retried exactly once here");
  // Assert on the VALIDATOR's problem lines, not on the prompt as a whole: the
  // retry also echoes the rejected draft back to the model, so the offending
  // phrases appear in the prompt either way. What R-025 changes is how many
  // problem lines the attempt produced.
  const reported = [...prompts[1].matchAll(/meta-reference "([^"]+)" found/g)].map((m) => m[1].toLowerCase());
  assert.deepEqual(
    [...reported].sort(),
    ["the author", "the book", "this chapter"],
    `the retry must name every hit from the failed attempt; got ${JSON.stringify(reported)}`,
  );
  assert.equal(result.coreClaim, baseResult().coreClaim, "the clean second attempt is what is returned");
});

// ── R-024 (manuscript-meta patterns) ─────────────────────────────────────────

test("R-024: a claim about the source document rather than the world is rejected", () => {
  // Both strings are live Franklin artifacts. The first is the released
  // ch04.fact.09 claim; the second is the book-scar pinned from it. Neither
  // names a chapter, a book or the author as an actor, so the chapter/book/
  // author patterns alone let both through.
  for (const claim of [
    "Franklin dies in 1790 with the Penn estate tax negotiation still unresolved in his writing.",
    "No resolution is reached on the estate tax and the manuscript breaks off.",
    "The Penn estate dispute is left unrecorded after 1758.",
  ]) {
    const r = baseResult();
    r.testableFacts![0].claim = claim;
    const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
    assert.ok(
      metaProblems(problems).length > 0,
      `expected a meta-reference problem for ${JSON.stringify(claim)}, got ${JSON.stringify(problems)}`,
    );
  }
});

test("R-024: manuscript-meta patterns do not fire on ordinary world facts", () => {
  for (const claim of [
    "He set the writing in type each morning before the shop opened.",
    "The ledger records a narrative of weekly queries kept by twelve tradesmen.",
  ]) {
    const r = baseResult();
    r.testableFacts![0].claim = claim;
    const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
    assert.deepEqual(metaProblems(problems), [], `unexpected meta-reference problem for ${JSON.stringify(claim)}`);
  }
});
