/**
 * Q07b - THE NARROW SOURCE-FIDELITY JUDGE CHANGE (owner decision D20 = A).
 * Hermetic: no model call leaves this file; every runner is a fake.
 *
 * What #584 (Q07) measured and what this file keeps from it:
 *   J1 - a correct contradiction was demoted to WARN only because its
 *        sourceQuote ran past MAX_SOURCE_QUOTE_CHARS, a bound the prompt never
 *        stated. The prompt now states it, rendered from the constants.
 *   J3 - claim kinds other than names, dates and numbers were never asked for.
 *        The checklist is kept; its answer-key item is NARROWED to quiz items
 *        about the book's own history, because on rr21 ch13 q08 the unnarrowed
 *        item drew SF3 blockers on the CORRECT key of an invented "Imagine..."
 *        transfer scenario, which the repair lane would turn into a wrong key.
 * What it drops: J2 (the prose/learning split). At effort xhigh thinking is
 * 88-92% of every call whatever the surface count, so D20 gives the judge its
 * own routing role, `fidelity`, at effort high instead; the answer-key judge
 * stays on `qc` at xhigh.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  CHECKABLE_KINDS,
  SOURCE_FIDELITY_CONTRADICTED_CODE,
  buildSourceFidelityUserPrompt,
  chapterFidelitySurfaces,
  classifySourceFidelityFindings,
  judgeChapterSourceFidelity,
  makeLiveSourceFidelityAsk,
  sourceFidelitySystemPrompt,
  type SourceFidelityRequest,
} from "../../src/critics/semantic/sourceFidelityJudge.js";
import { makeLiveAskModel } from "../../src/critics/semantic/quizKeyJudge.js";
import { validateModelRoutingConfig } from "../../src/runtime/codexRoute.js";
import { MAX_SOURCE_QUOTE_CHARS, MIN_SOURCE_QUOTE_CHARS, normalizedQuote, quoteShapeProblem } from "../../src/source/sourceText.js";
import type { ModelTaskRunRequest, ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import { finishV25Tests, requiredTest } from "./harness.js";
import { FRANKLIN_PROPRIETARIES_SLICE_PATH, makeGateCleanChapter } from "../helpers.js";

const SLICE = readFileSync(FRANKLIN_PROPRIETARIES_SLICE_PATH, "utf8");
const REV6_ERROR = "The brothers will not meet him.";

/** The carve-out, pinned LITERALLY: a scenario key must not draw SF3 from the
 *  prompt's own instructions. */
const CARVE_OUT = "The key check does not apply to an invented transfer scenario - a made-up, usually present-day situation that a question opens with \"Imagine...\", \"Suppose...\" or \"You are...\" (a neighborhood board, a colleague, a team) - or to a question built on one of the chapter's example scenarios, because there the keyed choice is a judgment the chapter teaches, not a claim about the book; any history such an item states in its prompt, choices or explanation is still checked like every other claim.";

/** The six claim-type checklist lines, exactly as #584 (68a59d4fd) wrote them. */
const CHECKLIST_LINES = [
  "Check claims of these kinds against the source, not only names, dates and numbers:",
  "- who acted, spoke, decided or received something;",
  "- order and timing (before, after, then, while, right as, until);",
  "- a stated cause or motive (because, so that, in order to);",
  "- credit and attribution (who proposed, invented, wrote or is credited with something);",
  "- membership (who belonged to which club, company, family or side);",
  "- finality and exclusivity words (only, ended, never, first, last, final);",
] as const;

/** sha256 of the model-memory system prompt on origin/main b5efca3f5. */
const MODEL_MEMORY_PROMPT_SHA256 = "62048d9399b9f80b48c90a4d0a10f5a5c55d5668d6969f2396776427da0ae73d";

function franklinChapter() {
  const chapter = makeGateCleanChapter("franklin-fidelity-narrow", 4);
  chapter.keyTakeaway = `${REV6_ERROR} ${chapter.keyTakeaway}`.slice(0, 220);
  return chapter;
}

function context(): ModelTaskContext {
  return {
    bookId: "franklin-fidelity-narrow",
    runId: "run-fidelity-narrow",
    attemptId: "attempt-fidelity-narrow",
    stageId: "qc",
    operationId: "operation-fidelity-narrow",
    workDir: "/synthetic/pipeline",
    signal: new AbortController().signal,
  } as unknown as ModelTaskContext;
}

/** A runner that records every request and answers with `output`. */
function capturingRunner(output: unknown): { runner: ModelTaskRunner; requests: ModelTaskRunRequest[] } {
  const requests: ModelTaskRunRequest[] = [];
  return {
    requests,
    runner: {
      async run(request) {
        requests.push(request);
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
      },
    },
  };
}

function request(): SourceFidelityRequest {
  const chapter = franklinChapter();
  return {
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    surfaces: chapterFidelitySurfaces(chapter),
    provenance: "source-text",
    sourceContext: SLICE,
    chunkIndex: 0,
    chunkCount: 1,
    claimHints: [],
  };
}

// ── J1 ──────────────────────────────────────────────────────────────────────

requiredTest("Q07b J1: the source-text judge prompt states the sourceQuote bound, rendered from the constants", () => {
  const system = sourceFidelitySystemPrompt("source-text");
  assert.ok(
    system.includes(`- sourceQuote is the shortest run of the SOURCE TEXT that settles the claim: one or two sentences, between ${MIN_SOURCE_QUOTE_CHARS} and ${MAX_SOURCE_QUOTE_CHARS} characters. A longer or shorter quote cannot be verified, so the finding cannot count as evidence.`),
    `the system prompt must state the ${MIN_SOURCE_QUOTE_CHARS}-${MAX_SOURCE_QUOTE_CHARS} bound:\n${system}`,
  );
});

requiredTest("Q07b J1: the output-shape line echoes the sourceQuote bound", () => {
  const prompt = buildSourceFidelityUserPrompt(request());
  assert.ok(
    prompt.includes(`"sourceQuote":<verbatim source text of ${MIN_SOURCE_QUOTE_CHARS}-${MAX_SOURCE_QUOTE_CHARS} characters, or null>`),
    prompt.slice(-600),
  );
});

requiredTest("Q07b J1 GUARD: an over-long sourceQuote is still refused as a WARN", async () => {
  // UNCHANGED behaviour: J1 tells the model the rule; the code still enforces it.
  const start = SLICE.indexOf("they agreed to a meeting");
  assert.ok(start >= 0);
  const longQuote = SLICE.slice(start, start + 330);
  assert.ok(normalizedQuote(longQuote).length > MAX_SOURCE_QUOTE_CHARS, `${normalizedQuote(longQuote).length}`);
  assert.ok(quoteShapeProblem(longQuote)?.includes(`at most ${MAX_SOURCE_QUOTE_CHARS} characters`));
  const report = await judgeChapterSourceFidelity({
    chapter: franklinChapter(),
    source: { provenance: "source-text", spanText: SLICE },
    ask: async () => ({
      findings: [{
        surface: "chapter/keyTakeaway",
        quote: REV6_ERROR,
        claim: "The Penn brothers refused to meet Franklin.",
        verdict: "contradicted",
        sourceQuote: longQuote,
        checkableKind: "sequence",
        note: "the source records the meeting",
      }],
    }),
  });
  const classified = classifySourceFidelityFindings(report);
  const issue = classified.issues.find((entry) => entry.code === SOURCE_FIDELITY_CONTRADICTED_CODE);
  assert.ok(issue, JSON.stringify(classified.issues, null, 2));
  assert.equal(issue.severity, "WARN", issue.message);
  assert.match(issue.message, /the source quote is unusable: sourceQuote is \d+ characters; quote at most 240/);
});

// ── J3, narrowed ────────────────────────────────────────────────────────────

requiredTest("Q07b J3: the source-text judge prompt carries the claim-type checklist lines", () => {
  const system = sourceFidelitySystemPrompt("source-text");
  for (const line of CHECKLIST_LINES) {
    assert.ok(system.split("\n").includes(line), `missing checklist line: ${line}\n${system}`);
  }
});

requiredTest("Q07b J3: the keyed-answer item applies only to quiz items about the book's own history", () => {
  const system = sourceFidelitySystemPrompt("source-text");
  const keyItem = system.split("\n").find((line) => line.startsWith("- for every quiz item"));
  assert.ok(keyItem, `no keyed-answer checklist item:\n${system}`);
  assert.ok(keyItem.startsWith("- for every quiz item about the book's own history"), keyItem);
  // A question that places the reader inside the book's events is still history.
  assert.ok(keyItem.includes("places the reader inside the book's events"), keyItem);
  assert.ok(keyItem.includes("\"You are Franklin...\""), keyItem);
  assert.ok(keyItem.includes("\"Suppose you are Franklin in that seat...\""), keyItem);
  assert.ok(keyItem.includes("(surface quiz.qNN/key)"), keyItem);
  // Contradicted ONLY when the source supports another choice.
  assert.ok(
    keyItem.includes("report the key as \"contradicted\" on the quiz.qNN/key surface, with that source line as sourceQuote, only when the source supports another choice"),
    keyItem,
  );
  // The unnarrowed #584 item must not survive beside it.
  assert.equal(system.includes("- for every quiz item, whether the keyed choice"), false, system);
});

requiredTest("Q07b J3: the scenario carve-out sentence is in the prompt verbatim, after the key item", () => {
  const system = sourceFidelitySystemPrompt("source-text");
  const at = system.indexOf(CARVE_OUT);
  assert.ok(at >= 0, `carve-out sentence missing:\n${system}`);
  assert.ok(at > system.indexOf("- for every quiz item about the book's own history"), "the carve-out must follow the key item");
  assert.equal(system.indexOf(CARVE_OUT, at + 1), -1, "the carve-out appears once");
});

requiredTest("Q07b J3: the checkableKind sentence after the list names every CHECKABLE_KINDS value", () => {
  const system = sourceFidelitySystemPrompt("source-text");
  const sentence = `The list above names the kinds of claim to CHECK, not checkableKind values: checkableKind is always exactly one of ${CHECKABLE_KINDS.map((kind) => `"${kind}"`).join(", ")}.`;
  const at = system.indexOf(sentence);
  assert.ok(at >= 0, `checkableKind sentence missing:\n${system}`);
  assert.ok(at > system.indexOf(CHECKLIST_LINES[0]), "the checkableKind sentence must follow the checklist");
  for (const kind of CHECKABLE_KINDS) assert.ok(sentence.includes(`"${kind}"`));
});

requiredTest("Q07b GUARD: the model-memory judge prompt is byte-unchanged", () => {
  const system = sourceFidelitySystemPrompt("model-memory");
  assert.equal(createHash("sha256").update(system).digest("hex"), MODEL_MEMORY_PROMPT_SHA256, system);
});

// ── D20: the judge's own routing role ───────────────────────────────────────

requiredTest("Q07b D20: makeLiveSourceFidelityAsk requests role fidelity on the long read profile", async () => {
  const { runner, requests } = capturingRunner({ findings: [] });
  const ask = makeLiveSourceFidelityAsk({ execution: { runner, context: context() } });
  const answer = await ask(request());
  assert.deepEqual(answer, { findings: [] });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.role, "fidelity");
  assert.equal(requests[0]!.profileId, "pipeline-read-json-long-v1");
});

requiredTest("Q07b D20 GUARD: the answer-key judge still requests role qc", async () => {
  const { runner, requests } = capturingRunner({ index: 0, confidence: "high", correctText: "alpha", reason: "scripted" });
  const ask = makeLiveAskModel({ execution: { runner, context: context() } });
  await ask({ prompt: "Which?", choices: ["alpha", "beta", "gamma"] });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.role, "qc");
});

requiredTest("Q07b D20 GUARD: validateModelRoutingConfig still refuses an unknown role key", () => {
  const roleRoute = { route: "claude-cli", model: "claude-sonnet-5", effort: "high" };
  const typo = validateModelRoutingConfig({ defaultRoute: roleRoute, roles: { qc: roleRoute, fidelty: roleRoute } });
  assert.equal(typo.ok, false);
  assert.equal(typo.ok === false && typo.errors.some((error) => error.path === "/roles/fidelty"), true, JSON.stringify(typo));
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
