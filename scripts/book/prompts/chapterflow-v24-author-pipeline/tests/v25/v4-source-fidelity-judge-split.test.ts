/**
 * Q07 - SOURCE-FIDELITY JUDGE RELIABILITY (J1 quote bound, J2 two-call split,
 * J3 claim-type checklist). Hermetic: every model call is an injected `ask`.
 *
 * Measured on candidate rr21 (S02 + Wave B check): a correct contradiction was
 * demoted to WARN only because its sourceQuote was 320 characters - the code
 * caps quotes at MAX_SOURCE_QUOTE_CHARS and the prompt never said so (J1); at
 * xhigh the thinking alone used 75-93% of the 64k output cap and 1 call in 5
 * capped out, so each chapter is now judged in two calls, prose and learning
 * surfaces (J2); and claim kinds other than names, dates and numbers - who
 * acted, order, cause, credit, membership, finality, the keyed answer - were
 * never asked for (J3).
 *
 * New symbols are read through a NAMESPACE import so this file loads on the
 * pre-change code and fails there with an AssertionError, not a link error.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as judge from "../../src/critics/semantic/sourceFidelityJudge.js";
import {
  SOURCE_FIDELITY_CONTRADICTED_CODE,
  SOURCE_FIDELITY_KEY_CODE,
  SOURCE_FIDELITY_MAX_CONTEXT_CHARS,
  buildSourceFidelityUserPrompt,
  chapterFidelitySurfaces,
  chunkSourceContext,
  classifySourceFidelityFindings,
  judgeChapterSourceFidelity,
  sourceFidelityCallCount,
  sourceFidelitySystemPrompt,
  type ChapterFidelitySurface,
  type SourceFidelityFinding,
  type SourceFidelityRequest,
} from "../../src/critics/semantic/sourceFidelityJudge.js";
import { MAX_SOURCE_QUOTE_CHARS, MIN_SOURCE_QUOTE_CHARS, normalizedQuote, quoteShapeProblem } from "../../src/source/sourceText.js";
import { finishV25Tests, requiredTest } from "./harness.js";
import { FRANKLIN_PROPRIETARIES_SLICE_PATH, makeGateCleanChapter } from "../helpers.js";

const SLICE = readFileSync(FRANKLIN_PROPRIETARIES_SLICE_PATH, "utf8");
const SOURCE_LINE = "it was concluded that I should give them the heads of our complaints in writing";
const REV6_ERROR = "The brothers will not meet him.";

function franklinChapter() {
  const chapter = makeGateCleanChapter("franklin-fidelity-split", 4);
  chapter.keyTakeaway = `${REV6_ERROR} ${chapter.keyTakeaway}`.slice(0, 220);
  return chapter;
}

const PROSE_KINDS: ReadonlySet<string> = new Set(["prose", "memorable_line"]);

/** Request fields added by J2, read without assuming the type has them. */
function groupOf(request: SourceFidelityRequest): unknown {
  return (request as unknown as Record<string, unknown>).surfaceGroup;
}

/** True when `part` is `whole` with some entries removed, order kept. */
function isSubsequence<T>(part: readonly T[], whole: readonly T[]): boolean {
  let cursor = 0;
  for (const entry of whole) if (cursor < part.length && part[cursor] === entry) cursor += 1;
  return cursor === part.length;
}

/** The fidelity-hint line shape `fidelityClaimHints` mints: 'category (location): message'. */
const hint = (location: string, message = "reads like fact I cannot check") =>
  `origin_ambiguous_to_reader (${location}): ${message}`;

// ── J1 ──────────────────────────────────────────────────────────────────────

requiredTest("Q07 J1: the source-text judge prompt states the sourceQuote bound the code enforces", () => {
  const system = sourceFidelitySystemPrompt("source-text");
  assert.ok(
    system.includes(`between ${MIN_SOURCE_QUOTE_CHARS} and ${MAX_SOURCE_QUOTE_CHARS} characters`),
    `the system prompt must state the ${MIN_SOURCE_QUOTE_CHARS}-${MAX_SOURCE_QUOTE_CHARS} bound:\n${system}`,
  );
  assert.match(system, /shortest run of the SOURCE TEXT that settles the claim/);
  assert.match(system, /cannot be verified/);
});

requiredTest("Q07 J1: the output-shape line echoes the sourceQuote bound", () => {
  const chapter = franklinChapter();
  const prompt = buildSourceFidelityUserPrompt({
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    surfaces: chapterFidelitySurfaces(chapter),
    provenance: "source-text",
    sourceContext: SLICE,
    chunkIndex: 0,
    chunkCount: 1,
    claimHints: [],
    surfaceGroup: "prose",
    surfaceGroupCount: 2,
  } as SourceFidelityRequest);
  assert.ok(
    prompt.includes(`"sourceQuote":<verbatim source text of ${MIN_SOURCE_QUOTE_CHARS}-${MAX_SOURCE_QUOTE_CHARS} characters, or null>`),
    prompt.slice(-600),
  );
});

requiredTest("Q07 J1 GUARD: an over-long sourceQuote is still refused as a WARN by quoteShapeProblem", async () => {
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

requiredTest("Q07 J1 GUARD: the model-memory judge prompt is unchanged (no quote bound, no checklist)", () => {
  const system = sourceFidelitySystemPrompt("model-memory");
  assert.equal(system.includes(`${MAX_SOURCE_QUOTE_CHARS} characters`), false, system);
  assert.equal(system.includes("right as"), false, system);
  assert.match(system, /Leave sourceQuote null/);
});

// ── J3 ──────────────────────────────────────────────────────────────────────

requiredTest("Q07 J3: the source-text judge prompt carries the claim-type checklist", () => {
  const system = sourceFidelitySystemPrompt("source-text");
  for (const item of [
    "not only names, dates and numbers",
    "who acted, spoke, decided or received something",
    "before, after, then, while, right as, until",
    "because, so that, in order to",
    "who proposed, invented, wrote or is credited",
    "who belonged to which club, company, family or side",
    "only, ended, never, first, last, final",
    "quiz.qNN/key",
  ]) {
    assert.ok(system.includes(item), `checklist item missing: ${item}\n${system}`);
  }
  assert.match(system, /report the key as "contradicted" on the quiz\.qNN\/key surface/);
});

// ── J2: the split ───────────────────────────────────────────────────────────

requiredTest("Q07 J2: the surface-group vocabulary is exported, prose first", () => {
  assert.deepEqual(judge.SOURCE_FIDELITY_SURFACE_GROUPS, ["prose", "learning"]);
  assert.equal(typeof judge.sourceFidelitySurfaceGroup, "function");
  const expected: Record<string, string> = {
    prose: "prose",
    memorable_line: "prose",
    example: "learning",
    quiz_prompt: "learning",
    quiz_choices: "learning",
    quiz_key: "learning",
    quiz_explanation: "learning",
    card: "learning",
    plan: "learning",
  };
  for (const [kind, group] of Object.entries(expected)) {
    assert.equal(judge.sourceFidelitySurfaceGroup(kind as ChapterFidelitySurface["kind"]), group, kind);
  }
});

requiredTest("Q07 J2: one chunk issues exactly two requests whose surfaces partition the chapter", async () => {
  const chapter = franklinChapter();
  const all = chapterFidelitySurfaces(chapter);
  assert.ok(all.some((surface) => PROSE_KINDS.has(surface.kind)));
  assert.ok(all.some((surface) => !PROSE_KINDS.has(surface.kind)));
  const requests: SourceFidelityRequest[] = [];
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: SLICE },
    ask: async (request) => { requests.push(request); return { findings: [] }; },
  });
  assert.equal(requests.length, 2, "one chunk, two surface-group calls");
  assert.deepEqual(requests.map(groupOf), ["prose", "learning"]);
  const [prose, learning] = requests;
  assert.ok(prose.surfaces.every((surface) => PROSE_KINDS.has(surface.kind)), JSON.stringify(prose.surfaces.map((s) => s.id)));
  assert.ok(learning.surfaces.every((surface) => !PROSE_KINDS.has(surface.kind)), JSON.stringify(learning.surfaces.map((s) => s.id)));
  // A partition: no surface lost, none duplicated, each half in original order.
  const ids = all.map((surface) => surface.id);
  const proseIds = prose.surfaces.map((surface) => surface.id);
  const learningIds = learning.surfaces.map((surface) => surface.id);
  assert.equal(proseIds.length + learningIds.length, ids.length);
  assert.deepEqual([...proseIds, ...learningIds].sort(), [...ids].sort());
  assert.ok(isSubsequence(proseIds, ids) && isSubsequence(learningIds, ids));
  // Surfaces are handed over byte-identical.
  for (const surface of [...prose.surfaces, ...learning.surfaces]) {
    assert.deepEqual(surface, all.find((entry) => entry.id === surface.id));
  }
  // Everything else about the chunk is as it always was.
  for (const request of requests) {
    assert.equal(request.chunkIndex, 0);
    assert.equal(request.chunkCount, 1);
    assert.equal(request.sourceContext, SLICE);
    assert.equal(request.provenance, "source-text");
  }
  assert.equal(report.calls, 2);
  assert.equal(report.chunkCount, 1);
  assert.deepEqual(report.surfaces, all, "classification still verifies quotes against the WHOLE surface list");
});

requiredTest("Q07 J2: an over-long span is judged chunk-major, prose before learning", async () => {
  const chapter = franklinChapter();
  const long = `${SLICE}\n\n`.repeat(Math.ceil((SOURCE_FIDELITY_MAX_CONTEXT_CHARS * 2.2) / SLICE.length));
  const chunks = chunkSourceContext(long);
  assert.ok(chunks.length >= 3);
  const seen: string[] = [];
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: long },
    ask: async (request) => { seen.push(`${request.chunkIndex}:${String(groupOf(request))}`); return { findings: [] }; },
  });
  assert.deepEqual(seen, chunks.flatMap((_, index) => [`${index}:prose`, `${index}:learning`]));
  assert.equal(report.calls, chunks.length * 2);
  assert.equal(report.chunkCount, chunks.length);
});

requiredTest("Q07 J2: sourceFidelityCallCount counts both halves", () => {
  assert.equal(sourceFidelityCallCount({ provenance: "source-text", spanText: SLICE }), 2);
  assert.equal(sourceFidelityCallCount({ provenance: "model-memory", recalledClaims: ["a claim"] }), 2);
  const long = `${SLICE}\n\n`.repeat(Math.ceil((SOURCE_FIDELITY_MAX_CONTEXT_CHARS * 2.2) / SLICE.length));
  assert.equal(sourceFidelityCallCount({ provenance: "source-text", spanText: long }), chunkSourceContext(long).length * 2);
});

requiredTest("Q07 J2: a model-memory chapter is also judged in two halves", async () => {
  const groups: unknown[] = [];
  const report = await judgeChapterSourceFidelity({
    chapter: franklinChapter(),
    source: { provenance: "model-memory", recalledClaims: ["Franklin met the proprietaries."] },
    ask: async (request) => { groups.push(groupOf(request)); return { findings: [] }; },
  });
  assert.deepEqual(groups, ["prose", "learning"]);
  assert.equal(report.calls, 2);
});

// ── J2: hint routing ────────────────────────────────────────────────────────

/** Real reader-seat locations (rr21 and neighbours), and where each hint goes. */
const ROUTED: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["ch07/seat-cold/Deep read", ["prose"]],
  ["ch13/seat-x/Deep read / Card 4", ["prose", "learning"]],
  ["ch07/seat-x/Example 6", ["learning"]],
  ["ch19/seat-x/whole chapter", ["prose", "learning"]],
  ["ch13/seat-x/deep read / quiz Q7", ["prose", "learning"]],
  ["ch01/seat-x/fast read / try this now", ["prose"]],
  ["ch07/seat-x/Full read (Denham aside)", ["prose"]],
  ["ch01/seat-skeptic/example[0]", ["learning"]],
  ["ch02/seat-x/Quiz Q3", ["learning"]],
  ["ch02/seat-x/Q7", ["learning"]],
  ["ch02/seat-x/hook", ["prose"]],
  ["ch02/seat-x/Counterintuition", ["prose"]],
  ["ch02/seat-x/Key takeaway", ["prose"]],
  ["ch02/seat-x/memorable line 2", ["prose"]],
  ["ch02/seat-x/If-then plan", ["learning"]],
  ["ch02/seat-x/24-hour challenge", ["learning"]],
  ["ch02/seat-x/weekly practice", ["learning"]],
  ["ch02/seat-x/Core skill", ["learning"]],
  ["ch02/seat-x/question 4", ["learning"]],
];

requiredTest("Q07 J2: a hint routes by the surface its location names; none or both -> both calls", () => {
  assert.equal(typeof judge.sourceFidelityHintGroups, "function");
  for (const [location, groups] of ROUTED) {
    assert.deepEqual(judge.sourceFidelityHintGroups(hint(location)), groups, location);
  }
  // The message never routes: only the location segment is read.
  assert.deepEqual(judge.sourceFidelityHintGroups(hint("ch07/seat-cold/Deep read", "the quiz card example plan")), ["prose"]);
  // No parseable location (another harness's own hint, or a truncated line) -> both.
  assert.deepEqual(judge.sourceFidelityHintGroups("a free-text hint with no location"), ["prose", "learning"]);
  assert.deepEqual(judge.sourceFidelityHintGroups(`origin_ambiguous_to_reader (ch07/seat-x/Deep read${"x".repeat(420)}...`), ["prose", "learning"]);
});

requiredTest("Q07 J2: every hint reaches a call; none is dropped or altered", async () => {
  const hints = ROUTED.map(([location], index) => hint(location, `message ${index}`));
  hints.push("a free-text hint with no location");
  const requests: SourceFidelityRequest[] = [];
  await judgeChapterSourceFidelity({
    chapter: franklinChapter(),
    source: { provenance: "source-text", spanText: SLICE },
    claimHints: hints,
    ask: async (request) => { requests.push(request); return { findings: [] }; },
  });
  assert.equal(requests.length, 2);
  const [prose, learning] = requests;
  // Each half keeps the input order; together they carry every hint, byte-identical.
  assert.ok(isSubsequence(prose.claimHints, hints) && isSubsequence(learning.claimHints, hints));
  const union = new Set([...prose.claimHints, ...learning.claimHints]);
  assert.deepEqual([...union].sort(), [...hints].sort());
  ROUTED.forEach(([location, groups], index) => {
    const line = hints[index];
    assert.equal(prose.claimHints.includes(line), groups.includes("prose"), `${location} -> prose`);
    assert.equal(learning.claimHints.includes(line), groups.includes("learning"), `${location} -> learning`);
  });
  const free = hints[hints.length - 1];
  assert.ok(prose.claimHints.includes(free) && learning.claimHints.includes(free));
});

requiredTest("Q07 J2: a group with no surfaces issues no call and its hints go to the other call", async () => {
  const chapter = franklinChapter();
  chapter.examples = [];
  chapter.quiz.questions = [];
  chapter.reviewCards = [];
  delete (chapter as { implementationPlan?: unknown }).implementationPlan;
  const surfaces = chapterFidelitySurfaces(chapter);
  assert.ok(surfaces.length > 0 && surfaces.every((surface) => PROSE_KINDS.has(surface.kind)), JSON.stringify(surfaces.map((s) => s.id)));
  const hints = [hint("ch04/seat-x/Example 6"), hint("ch04/seat-x/Deep read")];
  const requests: SourceFidelityRequest[] = [];
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: SLICE },
    claimHints: hints,
    ask: async (request) => { requests.push(request); return { findings: [] }; },
  });
  assert.equal(requests.length, 1);
  assert.equal(groupOf(requests[0]), "prose");
  assert.deepEqual(requests[0].claimHints, hints, "the learning-only hint is not dropped");
  assert.equal(report.calls, 1);
});

// ── J2: merge ───────────────────────────────────────────────────────────────

requiredTest("Q07 J2: findings from the two halves merge deterministically, chunk-major and prose first", async () => {
  const chapter = franklinChapter();
  const surfaces = chapterFidelitySurfaces(chapter);
  const key = surfaces.find((surface) => surface.kind === "quiz_key");
  assert.ok(key);
  const proseFinding: SourceFidelityFinding = {
    surface: "chapter/keyTakeaway",
    quote: REV6_ERROR,
    claim: "The Penn brothers refused to meet Franklin.",
    verdict: "contradicted",
    sourceQuote: SOURCE_LINE,
    checkableKind: "sequence",
    note: "the source records the meeting",
  };
  const keyFinding: SourceFidelityFinding = {
    surface: key.id,
    quote: key.text,
    claim: "the keyed choice is the answer the source supports",
    verdict: "contradicted",
    sourceQuote: SOURCE_LINE,
    checkableKind: "sequence",
    note: "the source supports another choice",
  };
  const run = () => judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: SLICE },
    ask: async (request) => ({
      // The learning half answers first in wall-clock terms here; order must still be prose-first.
      findings: groupOf(request) === "learning" ? [keyFinding] : [proseFinding],
    }),
  });
  const first = await run();
  const second = await run();
  assert.equal(first.calls, 2);
  assert.deepEqual(first, second, "same inputs, same report bytes");
  assert.deepEqual(first.findings.map((finding) => finding.surface), ["chapter/keyTakeaway", key.id]);
  assert.deepEqual(first.findings.map((finding) => finding.chunkIndex), [0, 0]);
  const codes = classifySourceFidelityFindings(first).issues.map((issue) => `${issue.code}:${issue.severity}`);
  assert.deepEqual(codes, [`${SOURCE_FIDELITY_CONTRADICTED_CODE}:BLOCKER`, `${SOURCE_FIDELITY_KEY_CODE}:BLOCKER`]);
});

requiredTest("Q07 J2 GUARD: the same finding returned by every call merges to one, exactly as one call's would", async () => {
  // UNCHANGED merge semantics: byte-identical surface+quote+claim collapses to
  // its best verdict whatever number of calls reported it.
  const finding: SourceFidelityFinding = {
    surface: "chapter/keyTakeaway",
    quote: REV6_ERROR,
    claim: "The Penn brothers refused to meet Franklin.",
    verdict: "contradicted",
    sourceQuote: SOURCE_LINE,
    checkableKind: "sequence",
    note: "n",
  };
  const report = await judgeChapterSourceFidelity({
    chapter: franklinChapter(),
    source: { provenance: "source-text", spanText: SLICE },
    ask: async () => ({ findings: [finding] }),
  });
  assert.equal(report.findings.length, 1);
  assert.deepEqual(report.findings[0], { ...finding, chunkIndex: 0 });
  const classified = classifySourceFidelityFindings(report);
  assert.deepEqual(classified.issues.map((issue) => issue.severity), ["BLOCKER"]);
  assert.equal(classified.verdict.gate, "RED");
});

requiredTest("Q07 J2 GUARD: an ask failure still propagates as a throw", async () => {
  await assert.rejects(
    judgeChapterSourceFidelity({
      chapter: franklinChapter(),
      source: { provenance: "source-text", spanText: SLICE },
      ask: async () => { throw new Error("SOURCE_FIDELITY_MODEL_FAILED:injected"); },
    }),
    /SOURCE_FIDELITY_MODEL_FAILED:injected/,
  );
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
