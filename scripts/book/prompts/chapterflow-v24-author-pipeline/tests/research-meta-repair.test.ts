/**
 * R-283 — the meta-reference wall, and the targeted repair that gets past it.
 *
 * LIVE EVIDENCE (Franklin, book-run-d51c92fc, 2026-09-04T04:11-04:23Z, the first
 * run of the finished source-text pipeline). Nineteen chapters were mapped at
 * 100% span coverage; the stage died at chapter research with all four dispatched
 * chapters failing their FIRST attempt on the meta-reference guard:
 *
 *   ch01 attempt 1: "this chapter", "the chapter", "the book", "the memoir" (+1 ungrounded quote)
 *        attempt 2: "the book"
 *        attempt 3: "the book" + author-surname-verb "Franklin writes"     → chapter FAILED
 *   ch02 attempt 1: "this chapter", "The chapter", "the author", "the book" (+3 ungrounded quotes)
 *        attempt 2: "the author", "the book"
 *        attempt 3: gateway schema validation rejected the previous output  → chapter FAILED
 *   ch03/ch04: also failed attempt 1, recovered on attempt 2 (attempts.jsonl).
 *
 * Two defects made that unrecoverable, and this file pins the fix for both:
 *
 *  1. THE PROMPT never told the source-text researcher that a `sourceQuote` is
 *     evidence FOR a world fact rather than a licence to describe the passage.
 *     Shown the chapter's own bytes, the model narrated the bytes. ch01's span is
 *     Franklin's 1771 letter to his son — a passage whose own subject IS the act
 *     of writing — so the narration was the path of least resistance.
 *
 *  2. THE FEEDBACK named only the matched PHRASE ("the book"), never the sentence
 *     that carried it, and the only remedy was a full regeneration: three whole
 *     re-drafts of a 20 KB sidecar to move one clause. Attempts 2 and 3 show the
 *     model converging (4 hits → 1) and then losing the thread entirely.
 *
 * The repair is deliberately NOT a weakening: a sidecar fact that refers to the
 * text is still invalid, the merged repair is re-validated by the SAME validator,
 * and a repair that still trips the guard fails closed with the original error.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import { baseResult, bibliography, input } from "./researchSidecarFixture.js";
import {
  MAX_CHAPTER_RESEARCH_ATTEMPTS,
  MAX_QUOTED_SENTENCE_CHARS,
  MAX_CHAPTER_RESEARCH_MODEL_CALLS,
  MAX_META_REPAIRS_PER_ATTEMPT,
  applyMetaRepair,
  buildMetaRepairPrompt,
  buildUserPrompt,
  collectChapterResearchProblems,
  collectChapterResearchReport,
  runResearcherChapter,
  type ChapterResearchInput,
  type ChapterResearchResult,
} from "../src/agents/researcher-chapter.js";
import { MAX_BIBLIOGRAPHY_ATTEMPTS } from "../src/agents/researcher-bibliography.js";
import { researchAttemptCapForChapters } from "../src/app/researchCandidateApplicationPort.js";
import { compatibilityRejectionReasons, type ResearchCompatibility, type ResearchRunManifest } from "../src/lib/researchRunManifest.js";
import type { ModelCallerExecution, ModelTaskRunner } from "../src/app/modelTaskRunner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "..");

/** The committed public-domain slice IS the live run's chapter-1 span: from
 *  "Dear son:" onward it is byte-identical to offsets 53..20273 of the frozen
 *  source-text.txt the failing run froze (sha256 d76a33bb…). So the prompt this
 *  file builds is the REAL failing input, built with no model call. */
const FRANKLIN_CH01_SPAN = readFileSync(resolve(PIPELINE_DIR, "tests", "fixtures", "franklin-autobiography-slice.txt"), "utf8");

const metaProblems = (problems: string[]): string[] => problems.filter((p) => p.startsWith("meta-reference"));

function franklinInput(): ChapterResearchInput {
  return { ...input("Benjamin Franklin", "memoir"), chapter: { number: 1, title: "Unit One" } };
}

function sourceTextInput(): ChapterResearchInput {
  return {
    ...franklinInput(),
    sourceSpan: { startOffset: 0, endOffset: FRANKLIN_CH01_SPAN.length, text: FRANKLIN_CH01_SPAN },
    sourceTextSha256: "d76a33bb69813511731ae2e9df4dff2440050340dc72c065cfbab57e8632e860",
  };
}

/** A fake model runner over a scripted list of outcomes. A `ChapterResearchResult`
 *  is returned; an `Error` is thrown. Every user prompt is captured in order. */
function execution(script: Array<ChapterResearchResult | Error>, prompts: string[]): ModelCallerExecution {
  const decoder = new TextDecoder();
  let i = 0;
  const runner: ModelTaskRunner = {
    async run(request) {
      const userPrompt = request.prompt.inputs.find((entry) => entry.name === "user_prompt");
      prompts.push(userPrompt ? decoder.decode(userPrompt.bytes) : "");
      const step = script[Math.min(i, script.length - 1)];
      i += 1;
      if (step instanceof Error) throw step;
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: step };
    },
  };
  return {
    runner,
    context: {
      bookId: "zz-repair", runId: "run-repair", attemptId: "attempt-1",
      stageId: "research", operationId: "op-repair", workDir: process.cwd(),
      signal: new AbortController().signal,
    },
  };
}

const isRepairPrompt = (prompt: string): boolean => prompt.includes("# Repair task");

// ── (a) the prompt states the standalone-facts contract in SOURCE-TEXT mode ──

test("R-283: with a source span the prompt says a sourceQuote is evidence FOR a world fact, not a reason to describe the passage", () => {
  const prompt = buildUserPrompt(sourceTextInput());
  assert.match(prompt, /# Every fact is about Benjamin Franklin and the world, never about the text/);
  assert.match(prompt, /The passage above is EVIDENCE, not the subject\./);
  assert.match(prompt, /A `sourceQuote` proves a fact about the world; it is not a licence to describe the passage\./);
  // The concrete before/after. The BOOK's author is named (that is the whole
  // remedy for "the author" on an autobiography); everything else is a slot, so
  // one book's cast cannot install itself as the house default in every other.
  assert.match(prompt, /Rejected: "The book opens with a letter to <person>/);
  assert.match(prompt, /Accepted: "Benjamin Franklin /);
  // ch01 of the live failure is Franklin's letter to his son: a passage whose own
  // subject IS the act of writing. That case has to be answered explicitly.
  assert.match(prompt, /When the passage's OWN subject is the act of writing/);
});

test("R-283: the standalone-facts block is absent from the model-memory prompt (no span, no change)", () => {
  const prompt = buildUserPrompt(franklinInput());
  assert.doesNotMatch(prompt, /never about the text/);
  assert.doesNotMatch(prompt, /The passage above is EVIDENCE/);
  assert.match(prompt, /Paraphrase only — no verbatim text from the book/, "the model-memory prompt is unchanged");
});

test("R-283: the guidance is rendered from the REAL failing chapter-1 span, so it is pinned against the live input", () => {
  const prompt = buildUserPrompt(sourceTextInput());
  // The prompt really is built over the live span's bytes.
  assert.ok(prompt.includes("Dear son: I have ever had pleasure in obtaining any little anecdotes"));
  assert.match(prompt, /# Every fact is about Benjamin Franklin and the world/);
});

// ── (4) the feedback quotes the offending SENTENCE verbatim ──────────────────

test("R-283: a meta-reference problem names the field and quotes the offending sentence verbatim", () => {
  const bad = baseResult();
  bad.paraphraseNotes = `${bad.paraphraseNotes} The book leaves the estate negotiation unresolved. A named successor still inherits the ledger.`;
  const found = metaProblems(collectChapterResearchProblems(bad, franklinInput()));
  assert.equal(found.length, 1, `expected one hit, got ${JSON.stringify(found)}`);
  assert.match(found[0], /^meta-reference "The book" found in `paraphraseNotes`: "The book leaves the estate negotiation unresolved\."/);
  // Only the offending sentence — not the whole 900-character field.
  assert.ok(!found[0].includes("A named successor still inherits the ledger."), `the report must isolate ONE sentence: ${found[0]}`);
});

test("R-283: an author-surname-verb problem also quotes the offending sentence", () => {
  const bad = baseResult();
  bad.keyClaims[1] = "Franklin writes that a visible ledger makes neglect legible.";
  const found = collectChapterResearchProblems(bad, franklinInput()).filter((p) => p.startsWith("author-surname-verb"));
  assert.equal(found.length, 1, `expected one hit, got ${JSON.stringify(found)}`);
  assert.match(found[0], /"Franklin writes" found in `keyClaims\[1\]`: "Franklin writes that a visible ledger makes neglect legible\."/);
});

test("R-283: the quoted sentence is bounded, so ten hits cannot blow up the manifest error or the repair prompt", () => {
  const bad = baseResult();
  const long = `The book ${"and a further clause that keeps going ".repeat(30)}ends here.`;
  bad.paraphraseNotes = `${bad.paraphraseNotes} ${long}`;
  const found = metaProblems(collectChapterResearchProblems(bad, franklinInput()));
  assert.equal(found.length, 1);
  const raw = found[0].match(/found in `paraphraseNotes`: ("(?:[^"\\]|\\.)*") — A sidecar/);
  assert.ok(raw, `could not read the quoted sentence out of: ${found[0]}`);
  const quoted = JSON.parse(raw![1]) as string;
  assert.ok(quoted.length <= MAX_QUOTED_SENTENCE_CHARS + 1, `quoted sentence was ${quoted.length} chars`);
  assert.ok(quoted.endsWith("…"), "a truncated quote must say it was truncated");
  assert.ok(quoted.startsWith("The book and a further clause"));
});

// ── the live failure signature, replayed through the located validator ───────

test("R-283: every construction the live Franklin run reported is located, and every one of them is repairable", () => {
  // The exact rules the 2026-09-04 run rejected, one per field the run named.
  // The rejected sidecars themselves were never persisted — only ch03/ch04 (the
  // two that passed) exist under research-runs/…/sidecars/source — which is the
  // second half of why the feedback had to start quoting the sentence.
  const bad = baseResult();
  bad.focus = "This chapter establishes that a rotating duty is inherited by name in a small mutual-improvement club.";
  bad.coreClaim = "The chapter records the duty in a ledger the next member inherits.";
  bad.keyClaims[0] = "The author kept a ledger of the weekly query.";
  bad.keyClaims[1] = "The book returns to the ledger whenever a week is skipped.";
  bad.hardEdge = "The memoir is often read as fairness machinery. It is accountability machinery, because a named successor inherits the record and neglect cannot hide inside a group average.";
  bad.testableFacts![0].claim = "Franklin writes that the club met each Friday.";

  const report = collectChapterResearchProblems(bad, franklinInput());
  const reported = report
    .map((problem) => problem.match(/^(?:meta-reference|author-surname-verb construction) "([^"]+)"/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => match[1].toLowerCase());

  // MAX_REPORTED_META_HITS caps the meta list at 5; the author-verb list is
  // reported separately, so "franklin writes" is present alongside them.
  for (const construction of ["this chapter", "the chapter", "the author", "the book", "the memoir", "franklin writes"]) {
    assert.ok(reported.includes(construction), `${construction} was not reported; got ${JSON.stringify(reported)}`);
  }
  // Every one of them names its own field and quotes its own sentence.
  assert.ok(report.every((problem) => /found in `[^`]+`: "/.test(problem)), JSON.stringify(report, null, 2));
  assert.ok(report.some((problem) => problem.includes('"This chapter establishes that a rotating duty is inherited by name in a small mutual-improvement club."')));
  assert.ok(report.some((problem) => problem.includes('"The memoir is often read as fairness machinery."')));
});

test("R-283: ch01's third live attempt — one meta-reference plus one author-verb — is repair-eligible", async () => {
  // The signature the live ch01 died on: `meta-reference "the book"` +
  // `author-surname-verb construction "Franklin writes"`. Both are prose-field
  // wording, so this is exactly the rejection the bounded repair exists for.
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  bad.testableFacts![0].claim = "Franklin writes that the club met each Friday and one member in turn wrote the week's query.";
  const prompts: string[] = [];
  const result = await runResearcherChapter(franklinInput(), execution([bad, baseResult()], prompts), { sleep: async () => {} });

  assert.equal(prompts.length, 2, "one draft + one repair — not three full re-drafts");
  assert.ok(isRepairPrompt(prompts[1]));
  assert.deepEqual(
    result.metaRepair?.offenses.map((offense) => offense.rule),
    ["meta-reference", "author-verb"],
    "a mixed lexical rejection is repaired in ONE call, not two",
  );
});

// ── (b) exactly ONE repair call, carrying the offending sentences ────────────

test("R-283: a lexical-only rejection triggers exactly one repair call whose prompt carries the offending sentences, and a repaired sidecar passes", async () => {
  // The two constructions the live ch01 attempt 2/3 died on.
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  bad.hardEdge = "The memoir is often read as fairness machinery. It is accountability machinery, because a named successor inherits the record and neglect cannot hide inside a group average.";
  const prompts: string[] = [];
  const result = await runResearcherChapter(franklinInput(), execution([bad, baseResult()], prompts), { sleep: async () => {} });

  assert.equal(prompts.length, 2, `one draft + one repair, got ${prompts.length}`);
  assert.ok(!isRepairPrompt(prompts[0]), "the first call is the ordinary draft");
  assert.ok(isRepairPrompt(prompts[1]), `the second call must be the bounded repair, got: ${prompts[1].slice(0, 200)}`);

  // The repair prompt receives the EXACT offending sentences, not just the phrases.
  assert.ok(prompts[1].includes("The book records the duty in a ledger the next member inherits."), "offending sentence 1 missing from the repair prompt");
  assert.ok(prompts[1].includes("The memoir is often read as fairness machinery."), "offending sentence 2 missing from the repair prompt");
  // …and it must NOT drag in the clean sentence that follows the offender.
  assert.ok(!prompts[1].includes("It is accountability machinery, because a named successor inherits the record and neglect cannot hide inside a group average.\n"), "the repair list must isolate the offending sentence");

  assert.equal(result.coreClaim, baseResult().coreClaim, "the repaired sidecar is what is returned");
  assert.deepEqual(collectChapterResearchProblems(result, franklinInput()), [], "the returned sidecar passes the SAME validator");
  // Provenance: the repair is recorded on the sidecar that is written to disk.
  assert.ok(result.metaRepair, "the repair must be recorded in the sidecar's provenance");
  assert.equal(result.metaRepair!.attempt, 1);
  assert.deepEqual(
    result.metaRepair!.offenses.map((offense) => offense.match).sort(),
    ["The book", "The memoir"],
  );
});

test("R-283: the repair is a MERGE — the model cannot change a sourceQuote, a hardSpecific or an id through it", async () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  // A hostile repair response: right prose, but every anchor rewritten.
  const hostile = baseResult();
  hostile.namedExamples[0].id = "ch01.ex.INVENTED";
  hostile.namedExamples[0].hardSpecifics = ["Boston", "each Tuesday", "spoken query"];
  hostile.testableFacts![0].id = "ch01.fact.INVENTED";
  (hostile.testableFacts![0] as { sourceQuote?: string }).sourceQuote = "a quote that is in no source text at all";
  hostile.frameworks = [{ name: "Invented framework", members: ["a", "b"] }];

  const prompts: string[] = [];
  const result = await runResearcherChapter(franklinInput(), execution([bad, hostile], prompts), { sleep: async () => {} });

  assert.equal(result.namedExamples[0].id, baseResult().namedExamples[0].id, "ids come from the ORIGINAL draft");
  assert.deepEqual(result.namedExamples[0].hardSpecifics, baseResult().namedExamples[0].hardSpecifics, "hardSpecifics come from the ORIGINAL draft");
  assert.equal(result.testableFacts![0].id, baseResult().testableFacts![0].id);
  assert.equal((result.testableFacts![0] as { sourceQuote?: string }).sourceQuote, undefined, "the repair must not be able to mint a sourceQuote");
  assert.deepEqual(result.frameworks, baseResult().frameworks, "only the listed prose fields are taken from the repair");
});

test("R-283: applyMetaRepair keeps the original anchors and drops nothing it was not asked to drop", () => {
  const original = baseResult();
  const repaired = baseResult();
  repaired.coreClaim = "A rotating duty is kept because the next person inherits a visible record of it.";
  const merged = applyMetaRepair(original, repaired);
  assert.ok(merged);
  assert.equal(merged!.coreClaim, repaired.coreClaim);
  assert.equal(merged!.namedExamples.length, original.namedExamples.length);
  assert.equal(merged!.testableFacts!.length, original.testableFacts!.length);
  // A non-object repair is refused outright rather than merged into a half-object.
  assert.equal(applyMetaRepair(original, null), null);
  assert.equal(applyMetaRepair(original, "{}"), null);
  assert.equal(applyMetaRepair(original, []), null);
});

// ── (c) a repair that still trips the guard fails CLOSED ─────────────────────

test("R-283: a repair that still contains a meta-reference fails closed with the ORIGINAL error", async () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  const stillBad = baseResult();
  stillBad.coreClaim = "The book still records the duty in a ledger the next member inherits.";
  const prompts: string[] = [];

  await assert.rejects(
    runResearcherChapter(franklinInput(), execution([bad, stillBad], prompts), { sleep: async () => {} }),
    (error: Error) => {
      assert.match(error.message, /chapter research invalid after 3 attempts/);
      assert.match(error.message, /meta-reference "The book" found in `coreClaim`/, "the ORIGINAL validator error is what is reported");
      return true;
    },
  );
  // Three attempts, each with one repair: the budget is the outer bound, and the
  // repair never buys a fourth attempt.
  assert.equal(prompts.length, MAX_CHAPTER_RESEARCH_ATTEMPTS * (1 + MAX_META_REPAIRS_PER_ATTEMPT));
});

test("R-283: a rejection that is NOT purely lexical does not spend a repair call", async () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  bad.voiceCues = ["only one cue"]; // a floor failure the repair cannot touch
  const prompts: string[] = [];
  await assert.rejects(
    runResearcherChapter(franklinInput(), execution([bad], prompts), { sleep: async () => {} }),
    /chapter research invalid after 3 attempts/,
  );
  assert.equal(prompts.length, MAX_CHAPTER_RESEARCH_ATTEMPTS, "a mixed rejection retries in full and buys no repair");
  assert.ok(prompts.every((prompt) => !isRepairPrompt(prompt)));
});

test("R-283: a meta-reference the repair cannot legally rewrite (a verbatim hardSpecific) does not spend a repair call", async () => {
  const bad = baseResult();
  bad.namedExamples[0].hardSpecifics = ["chapter 4", "each Friday"];
  const prompts: string[] = [];
  await assert.rejects(
    runResearcherChapter(franklinInput(), execution([bad], prompts), { sleep: async () => {} }),
    /chapter research invalid after 3 attempts/,
  );
  assert.equal(prompts.length, MAX_CHAPTER_RESEARCH_ATTEMPTS, "a hardSpecific is a verbatim source token; rewriting it is not a repair");
});

// ── (d) an infrastructure failure of the repair is an ERROR ──────────────────

test("R-283: model infrastructure failing the REPAIR call is an error, never a manufactured pass", async () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  const prompts: string[] = [];
  await assert.rejects(
    runResearcherChapter(
      franklinInput(),
      execution([bad, new Error("MODEL_TASK_FAILED:MODEL_CAPACITY_EXHAUSTED:no capacity")], prompts),
      { sleep: async () => {} },
    ),
    /MODEL_TASK_FAILED:MODEL_CAPACITY_EXHAUSTED/,
    "a capacity failure inside the repair must propagate, not be swallowed",
  );
  assert.equal(prompts.length, 2, "the run stops at the failed repair");
});

test("R-283: a TRANSIENT failure of the repair call falls back to the original rejection and still fails closed", async () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  const prompts: string[] = [];
  await assert.rejects(
    runResearcherChapter(
      franklinInput(),
      execution([bad, new Error("MODEL_TASK_FAILED:MODEL_PROCESS_FAILED:overloaded")], prompts),
      { sleep: async () => {} },
    ),
    (error: Error) => {
      assert.match(error.message, /chapter research invalid after 3 attempts/);
      assert.match(error.message, /meta-reference "The book" found/, "the content defect is still reported honestly");
      return true;
    },
  );
});

test("R-283: a repair response that is not a JSON object leaves the chapter exactly where the draft left it", async () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  const prompts: string[] = [];
  const decoder = new TextDecoder();
  let call = 0;
  const runner: ModelTaskRunner = {
    async run(request) {
      const userPrompt = request.prompt.inputs.find((entry) => entry.name === "user_prompt");
      prompts.push(userPrompt ? decoder.decode(userPrompt.bytes) : "");
      call += 1;
      // Every repair call answers with an array — a SUCCEEDED result carrying a
      // non-object, which runJsonModelTask rejects as MODEL_TASK_OUTPUT_INVALID.
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: (call % 2 === 0 ? [] : bad) as unknown as object };
    },
  };
  const exec: ModelCallerExecution = {
    runner,
    context: {
      bookId: "zz-repair", runId: "run-repair", attemptId: "attempt-1",
      stageId: "research", operationId: "op-repair", workDir: process.cwd(),
      signal: new AbortController().signal,
    },
  };
  await assert.rejects(
    runResearcherChapter(franklinInput(), exec, { sleep: async () => {} }),
    (error: Error) => {
      assert.match(error.message, /chapter research invalid after 3 attempts/);
      assert.match(error.message, /meta-reference "The book" found/, "a malformed repair must not replace the honest content defect");
      return true;
    },
  );
  assert.equal(prompts.length, MAX_CHAPTER_RESEARCH_ATTEMPTS * (1 + MAX_META_REPAIRS_PER_ATTEMPT));
});

// ── budget: the run-state attempt cap covers the repair calls ────────────────

test("R-283: the per-run research attempt cap is sized for the repair calls the stage can now spend", () => {
  assert.equal(MAX_CHAPTER_RESEARCH_MODEL_CALLS, MAX_CHAPTER_RESEARCH_ATTEMPTS * (1 + MAX_META_REPAIRS_PER_ATTEMPT));
  assert.equal(researchAttemptCapForChapters(1), MAX_CHAPTER_RESEARCH_MODEL_CALLS + MAX_BIBLIOGRAPHY_ATTEMPTS);
  assert.equal(
    researchAttemptCapForChapters(20) - researchAttemptCapForChapters(19),
    MAX_CHAPTER_RESEARCH_MODEL_CALLS,
    "every chapter can spend a repair per attempt; the cap must grow by that much",
  );
});

// ── (e) resume identity: what a prompt change does to a durable research run ─

test("R-283: the research run's prompt digest covers the SYSTEM prompts — a changed digest mints a NEW research run", () => {
  const compatibility: ResearchCompatibility = {
    codeVersion: "researcher-durable-resume-2026-06-23.1",
    promptHash: "AFTER",
    configHash: "c",
    provider: "model-gateway-v1",
    model: "m",
  };
  const manifest = { input: { hash: "h" }, expectedChaptersHash: "e", compatibility: { ...compatibility, promptHash: "BEFORE" } } as unknown as ResearchRunManifest;
  assert.deepEqual(
    compatibilityRejectionReasons(manifest, { inputHash: "h", compatibility, expectedChaptersHash: "e" }),
    ["promptHash changed"],
    "a moved prompt digest is an INCOMPATIBLE run: research starts a fresh run, which is the expected cost of editing a prompt",
  );

  // This change is in the PER-BOOK USER MESSAGE, which the digest does not cover
  // (researcher.ts hashes the two .system.md files). So the owner's next run
  // RESUMES the failed Franklin run and keeps ch03/ch04, which are already paid
  // for and were validated by the same, unchanged validator. If the guidance
  // were ever moved into a system prompt, the digest WOULD move and every
  // in-flight research run would be re-researched from scratch.
  for (const file of ["researcher-chapter.system.md", "researcher-bibliography.system.md"]) {
    const systemPrompt = readFileSync(resolve(PIPELINE_DIR, "prompts", file), "utf8");
    assert.ok(
      !systemPrompt.includes("The passage above is EVIDENCE, not the subject."),
      `${file} must not carry the per-book source-text guidance, or the prompt digest moves and every durable run is invalidated`,
    );
  }
  assert.match(buildUserPrompt(sourceTextInput()), /The passage above is EVIDENCE, not the subject\./);
});

// ── ROUND 2 (adversarial review) — the repair may not ADD an item ────────────

/**
 * BLOCKING finding, round 1. `applyMetaRepair` took `patch.keyClaims` wholesale
 * (filtered only for non-empty strings), so a repair response could APPEND key
 * claims the draft never had. The repair prompt deliberately withholds the source
 * span, and a keyClaim carries no `sourceQuote` — it is checked only by a count
 * floor — so an appended claim is ungrounded by construction and reaches the
 * writers. `namedExamples`/`testableFacts` were already add-proof (mergeById
 * ignores an entry that matches no draft id); `keyClaims` has no ids, so the only
 * add-proof merge available to it is POSITIONAL and length-bounded.
 */
test("R-283 round 2: a repair CANNOT add a key claim — the keyClaims merge is positional and length-bounded", () => {
  const draft = baseResult();
  const repaired = baseResult();
  repaired.keyClaims = [...draft.keyClaims, "INVENTED CLAIM 4", "INVENTED CLAIM 5"];

  const merged = applyMetaRepair(draft, repaired);
  assert.ok(merged);
  assert.equal(merged!.keyClaims.length, draft.keyClaims.length, "the repaired list has exactly the draft's length");
  assert.deepEqual(merged!.keyClaims, draft.keyClaims, "extra entries are dropped, not appended");
  assert.ok(!merged!.keyClaims.some((claim) => claim.includes("INVENTED")), "an ungrounded claim must never survive the merge");
});

test("R-283 round 2: the keyClaims merge replaces index i in place, keeps the draft's entry for anything unusable, and never re-orders", () => {
  const draft = baseResult();
  const repaired = baseResult();
  repaired.keyClaims = [
    "A rotating duty is inherited by name, and the ledger names the successor.", // a real in-place rewrite
    "   ",                                                                       // blank: the draft's entry stands
    42 as unknown as string,                                                     // not a string: the draft's entry stands
    // index 3 omitted entirely: a SHORTER response keeps the draft's remainder
  ];

  const merged = applyMetaRepair(draft, repaired);
  assert.ok(merged);
  assert.deepEqual(merged!.keyClaims, [
    repaired.keyClaims[0],
    draft.keyClaims[1],
    draft.keyClaims[2],
    draft.keyClaims[3],
  ]);
});

test("R-283 round 2: an appended key claim cannot reach a returned sidecar through the live repair path", async () => {
  const bad = baseResult();
  bad.keyClaims[1] = "The book returns to the ledger whenever a week is skipped.";
  const hostile = baseResult();
  hostile.keyClaims[1] = "A skipped week leaves the ledger blank beside the named owner.";
  hostile.keyClaims.push("The club also invented the lightning rod on a Friday in 1752.");

  const prompts: string[] = [];
  const result = await runResearcherChapter(franklinInput(), execution([bad, hostile], prompts), { sleep: async () => {} });

  assert.equal(prompts.length, 2, "one draft + one repair");
  assert.equal(result.keyClaims.length, baseResult().keyClaims.length);
  assert.equal(result.keyClaims[1], hostile.keyClaims[1], "the listed sentence IS repaired in place");
  assert.ok(
    !result.keyClaims.some((claim) => claim.includes("lightning rod")),
    "the claim the repair appended is not in the sidecar the writers read",
  );
});

test("R-283 round 2: the repair prompt tells the truth about keyClaims — a claim is rewritten in place, never dropped", () => {
  const bad = baseResult();
  bad.keyClaims[0] = "The book kept a ledger of the weekly query.";
  const report = collectChapterResearchProblems(bad, franklinInput());
  assert.ok(report.length > 0);
  const prompt = buildMetaRepairPrompt(franklinInput(), collectChapterResearchReport(bad, franklinInput()).offenses, bad);
  // keyClaims is an UNKEYED list: a drop and an addition are indistinguishable in
  // it, so the merge is positional and a "drop" cannot land. Saying otherwise in
  // the prompt would ask for a change the merge silently refuses.
  assert.match(prompt, /`keyClaims` .*rewrite/i);
  assert.ok(
    !/drop that entry rather than inventing a replacement[\s\S]{0,200}`keyClaims`/.test(prompt),
    "the prompt must not offer a keyClaims drop the merge cannot honour",
  );
});

// ── ROUND 2 minor 1 — the merge does not fabricate an absent optional field ──

test("R-283 round 2: a repair cannot fabricate an optional testableFacts field the draft never carried", () => {
  const draft = baseResult();
  delete (draft.testableFacts![0] as { commonError?: string }).commonError;
  delete (draft.testableFacts![0] as { errorIsWhy?: string }).errorIsWhy;

  const repaired = baseResult();
  repaired.testableFacts![0].claim = "The club met each Friday and one member in turn wrote the week's query.";

  const merged = applyMetaRepair(draft, repaired);
  assert.ok(merged);
  const fact = merged!.testableFacts![0] as Record<string, unknown>;
  assert.equal(fact.claim, repaired.testableFacts![0].claim, "the prose field the draft HAS is repaired");
  assert.ok(!("commonError" in fact), 'an absent optional field stays absent — never fabricated as ""');
  assert.ok(!("errorIsWhy" in fact), 'an absent optional field stays absent — never fabricated as ""');
});

test("R-283 round 2: a field the repair leaves blank keeps the draft's own text, byte for byte", () => {
  const draft = baseResult();
  const repaired = baseResult();
  repaired.testableFacts![0].commonError = "   ";
  (repaired.namedExamples[0] as Record<string, unknown>).summary = "";

  const merged = applyMetaRepair(draft, repaired);
  assert.ok(merged);
  assert.equal(merged!.testableFacts![0].commonError, draft.testableFacts![0].commonError);
  assert.equal(merged!.namedExamples[0].summary, draft.namedExamples[0].summary);
});

// ── ROUND 2 minor 2 — the eligibility gate is count-based, not order-based ───

test("R-283 round 2: eligibility compares COUNTS — every problem line is an offense line, wherever it sits in the list", () => {
  const bad = baseResult();
  bad.coreClaim = "The book records the duty in a ledger the next member inherits.";
  bad.focus = "This chapter establishes that a rotating duty is inherited by name in a small mutual-improvement club.";

  const report = collectChapterResearchReport(bad, franklinInput());
  assert.ok(report.offenses.length >= 2);
  assert.equal(report.problems.length, report.offenses.length, "a purely lexical rejection produces exactly one line per offense");
  // The gate is `problems.length === offenses.length`, so what makes it sound is
  // the one-line-per-offense identity — NOT where in the array the lexical lines
  // land. Pinned as a SET so a later reordering of collectChapterResearchReport
  // cannot quietly turn this into an order dependence.
  for (const offense of report.offenses) {
    const matching = report.problems.filter((problem) => problem.includes(`\`${offense.path}\``) && problem.includes(offense.match));
    assert.equal(matching.length, 1, `offense ${offense.rule} ${offense.match} in ${offense.path} must own exactly one problem line`);
  }
});
