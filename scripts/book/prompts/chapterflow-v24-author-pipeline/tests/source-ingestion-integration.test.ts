/**
 * WP source-ingestion — end to end, with no model call.
 *
 * The pieces are unit-tested next door (source-text-ingestion, chapter-map,
 * source-quote-grounding). This file wires them together the way a real run
 * does, over a 20 KB slice of the public-domain Gutenberg Autobiography, and
 * pins the five claims the package is judged on:
 *
 *   1. spans validate against the real text;
 *   2. quotes validate — a fact quoting the book is admitted;
 *   3. an unquotable fact is DROPPED rather than admitted or fabricated;
 *   4. run identity binds the text hash, so a resume with a different text is
 *      refused instead of silently rewriting the book from other bytes;
 *   5. provenance is recorded — manifest, sidecars, freeze report, candidate.
 *
 * And the sixth, which is what makes the other five safe to ship: the
 * model-memory path is unchanged.
 */

import assert from "node:assert/strict";
import { createHash } from "crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import { test } from "./harness.js";
import { FRANKLIN_SLICE_PATH } from "./helpers.js";
import { researchBook, SOURCE_TEXT_REL_PATH, CHAPTER_MAP_REL_PATH } from "../src/researcher.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import type { ChapterResearchInput, ChapterResearchResult } from "../src/agents/researcher-chapter.js";
import { collectChapterResearchProblems } from "../src/agents/researcher-chapter.js";
import { normalizeIngestedText } from "../src/source/sourceText.js";
import { compatibilityRejectionReasons, researchInputHash, readResearchRunManifest, RESEARCH_RUN_CODE_VERSION } from "../src/lib/researchRunManifest.js";
import { buildSourceTextVerifyRecord } from "../src/source/sourceTextVerify.js";
import { checkSourceVerifyRecord, verifiableItems } from "../src/critics/sourceVerify.js";
import { decideSourceRealityPolicy } from "../src/qc/sourceRealityPolicy.js";
import { resolveChapterMap, chapterSpanText, type ChapterMapV1 } from "../src/source/chapterMap.js";
import { intentCommandId } from "../src/app/researchCandidateApplicationPort.js";
import { runResearcherChapter } from "../src/agents/researcher-chapter.js";
import { createUniquenessEnforcingRunner, mintingExecution } from "./v25/fakes/uniquenessRunner.js";

const TEXT = existsSync(FRANKLIN_SLICE_PATH) ? normalizeIngestedText(readFileSync(FRANKLIN_SLICE_PATH, "utf8")) : "";
const HALF = Math.floor(TEXT.length / 2);

function tempRoot(): string {
  return mkdtempSync(resolve(tmpdir(), "cf-ingest-e2e-"));
}

/** Two chapters over the slice, anchored on its real sentences. */
function anchors(): Array<{ chapterNumber: number; startAnchor: string; endAnchor: string }> {
  const firstHalf = TEXT.slice(0, HALF);
  const secondHalf = TEXT.slice(HALF);
  return [
    { chapterNumber: 1, startAnchor: TEXT.slice(0, 90), endAnchor: firstHalf.slice(-90) },
    { chapterNumber: 2, startAnchor: secondHalf.slice(0, 90), endAnchor: TEXT.slice(-90) },
  ];
}

function bibliography(withMap: boolean): BibliographyResult {
  return {
    bookId: "zz-franklin-slice",
    title: "Autobiography of Benjamin Franklin",
    author: "Benjamin Franklin",
    edition: { chapterCount: 2, language: "English" },
    flatChapters: [{ number: 1, title: "Ancestry" }, { number: 2, title: "Early Youth" }],
    thesis: "A tradesman's account of how deliberate habits and civic organisation built a public life.",
    teachingArc: "The first unit establishes family and trade; the second establishes reading, writing and the first ventures away from home.",
    authorVoice: { register: "plainspoken", signatureMoves: ["first-person recollection", "plain trade detail", "dry aside"], avoidMoves: ["abstraction"] },
    confidence: "high",
    genre: "memoir",
    ...(withMap ? { chapterMap: anchors() } : {}),
  };
}

/** A source-grounded chapter result built BY QUOTING the span it is handed, so
 *  the fixture cannot drift from the text. `poison` makes one fact unquotable. */
function groundedChapter(input: ChapterResearchInput, poison: boolean): ChapterResearchResult {
  const span = input.sourceSpan!.text;
  // Ten well-separated runs of the real text, used as this chapter's quotes.
  const stride = Math.floor((span.length - 400) / 12);
  const quote = (i: number): string => span.slice(200 + i * stride, 200 + i * stride + 120).replace(/\s+/g, " ").trim();
  const n = input.chapter.number;
  const prefix = `ch0${n}`;

  // hardSpecifics must occur verbatim in the span AND be noun phrases (R-051).
  // Real proper nouns from each half of the slice, verified present by the
  // assertion below — a fixture whose tokens were sliced blindly out of the prose
  // would keep tripping the clause guard, which is the guard working.
  const TOKENS: Record<number, string[]> = {
    1: ["Ecton", "Northamptonshire", "Twyford", "Jonathan Shipley", "Winchester", "House of Lords"],
    2: ["Milk Street", "Cotton Mather", "Abiah Folger", "Peter Folger", "Josiah", "Nantucket"],
  };
  const token = (i: number): string => {
    const bank = TOKENS[n] ?? TOKENS[1];
    const value = bank[i % bank.length];
    if (!span.includes(value)) throw new Error(`fixture token ${JSON.stringify(value)} is not in the chapter ${n} span`);
    return value;
  };
  // Ten facts with disjoint vocabulary: the SV2 realness heuristics flag a sidecar
  // whose claims are one sentence with a swapped index, which is what a lazily
  // generated fixture looks like — and is a real defect, so the fixture must not
  // have it.
  const SUBJECTS: Record<number, string[]> = {
    1: ["the Ecton freehold", "the village blacksmith's forge", "the Twyford letter", "the bishop's library", "the parish register", "the thirty-acre holding", "the eldest-son custom", "the Winchester road", "the family arms", "the January date"],
    2: ["the Milk Street house", "Josiah's tallow trade", "Abiah Folger's marriage", "the Nantucket line", "Peter Folger's verses", "the Episcopal congregation", "the seventeen children", "the tithing-man's visit", "the Boston harbour trade", "the youngest-son schooling"],
  };
  const VERBS = ["is dated", "is priced", "is located", "is counted", "is named", "is attributed", "is compared", "is recorded", "is measured", "is credited"];
  const facts = Array.from({ length: 10 }, (_, i) => {
    const subject = (SUBJECTS[n] ?? SUBJECTS[1])[i];
    return {
      id: `${prefix}.fact.${i + 1}`,
      claim: `In the account ${subject} ${VERBS[i]} precisely enough for a reader to check it against the page.`,
      becauseMechanism: `Because the passage supplies the person and the place around ${subject}, a reader can test it instead of trusting a summary of it.`,
      commonError: `Treating ${subject} as a later embellishment supplied by an editor.`,
      errorIsWhy: `The passage carries it directly, so the editorial-embellishment reading fails on the page itself.`,
      sourceQuote: poison && i === 0 ? "Franklin flew a kite in a thunderstorm over Philadelphia in 1752" : quote(i),
    };
  });
  return {
    schemaVersion: "source-v2",
    chapterNumber: n,
    chapterTitle: input.chapter.title,
    focus: `Franklin sets out the household, trade and reading that shaped unit ${n} of the account, with the names and places that make it checkable.`,
    coreClaim: `Franklin's early circumstances are described concretely enough to be checked against the page.`,
    centralConcept: {
      id: `${prefix}.concept.a`,
      name: "the tradesman's record",
      plainDefinition: "A first-person record of trade, family and reading, written with names, places and dates a reader can check.",
      whyItMatters: "A reader can test every claim against the account rather than trusting a summary of it.",
    },
    keyClaims: [
      "Franklin names the relatives whose trade shaped his own.",
      "Franklin describes the reading he did before he was apprenticed.",
      "Franklin gives the places his family lived and worked.",
      "Franklin dates the events he recounts wherever he can.",
    ],
    namedExamples: [1, 2, 3].map((i) => ({
      id: `${prefix}.case.${i}`,
      label: `${token(i - 1)} episode`,
      summary: n === 1
        ? `Franklin walks through the ${token(i - 1)} material, giving the holding, the trade and the dates that let a reader test the claim.`
        : `The ${token(i - 1)} passage supplies a household, a price and a name, which is what makes the episode checkable rather than merely vivid.`,
      teachesWhat: "A named episode carries the claim better than a summary of it.",
      hardSpecifics: [token(i), token(i + 4)],
      realWorld: true,
      sourceQuote: quote(i + 9),
      hardSpecificEvidence: [
        { specific: token(i), proposition: `Franklin's account names this in episode ${i}.`, sourceQuote: quote(i + 9) },
        { specific: token(i + 4), proposition: `Franklin's account names this too in episode ${i}.`, sourceQuote: quote(i + 9) },
      ],
    })),
    hardEdge: "A reader finishing this part usually concludes that the record is a moral fable; it is a tradesman's ledger of names, places and prices, and the moral reading imports a shape the page does not have.",
    voiceCues: ["first-person recollection", "plain trade detail"],
    // Deliberately DISTINCT per unit — disjoint vocabulary AND disjoint sentence
    // shapes. SC8 blocks cross-chapter paraphrase reuse on shared 8-grams, and a
    // fixture that shared one paragraph would be measuring that critic instead of
    // this package.
    paraphraseNotes: Array.from({ length: 30 }, (_, i) => {
      const bank = n === 1
        ? ["candlemaker", "tallow", "Nantucket", "grandfather", "smithy", "psalter", "Boston", "apprentice", "printing", "brother"]
        : ["Amboy", "ferry", "Burlington", "gingerbread", "Bradford", "Keimer", "composing", "guilder", "lodging", "wharf"];
      const word = bank[i % bank.length];
      return n === 1
        ? `The ${word} appears at position ${i}, dated and located.`
        : `At position ${i} a ${word} is named; whoever paid for it is given too.`;
    }).join(" ").slice(0, 2400),
    testableFacts: facts,
  };
}

function runOnce(args: { runsRoot: string; stateRoot: string; sourceTextPath?: string; poison?: boolean; skipDrop?: boolean }) {
  const calls: ChapterResearchInput[] = [];
  return researchBook("Autobiography of Benjamin Franklin", "Benjamin Franklin", {
    bookId: "zz-franklin-slice",
    runsRoot: args.runsRoot,
    stateRoot: args.stateRoot,
    chapterConcurrency: 1,
    logger: (m: string) => { if (process.env.CF_DEBUG_INGEST === "1") console.error(m); },
    ...(args.sourceTextPath === undefined ? {} : { sourceTextPath: args.sourceTextPath }),
    deps: {
      runBibliography: async () => bibliography(args.sourceTextPath !== undefined),
      runChapter: async (input: ChapterResearchInput) => {
        calls.push(input);
        if (!input.sourceSpan) {
          // model-memory fixture: a chapter with no quotes at all.
          const chapter = groundedChapter({ ...input, sourceSpan: { startOffset: 0, endOffset: TEXT.length, text: TEXT } }, false);
          for (const fact of chapter.testableFacts!) delete fact.sourceQuote;
          for (const example of chapter.namedExamples) {
            delete example.sourceQuote;
            delete example.hardSpecificEvidence;
            example.hardSpecifics = ["Josiah Franklin", "Boston"];
          }
          return { ...chapter, sourceProvenance: "model-memory" as const };
        }
        return groundedChapter(input, args.poison === true && args.skipDrop === true && input.chapter.number === 1);
      },
    },
  }).then((result) => ({ result, calls }));
}

// ── 1 + 2 + 5: spans validate, quotes validate, provenance is recorded ────────

test("R-046 E2E: a source-text run freezes the text, maps two spans, quotes them, and records provenance everywhere", async () => {
  if (TEXT.length === 0) throw new Error(`${FRANKLIN_SLICE_PATH} is missing`);
  const root = tempRoot();
  try {
    const { result, calls } = await runOnce({ runsRoot: resolve(root, "runs"), stateRoot: resolve(root, "state"), sourceTextPath: FRANKLIN_SLICE_PATH });

    // FROZEN: the run owns a byte-exact copy, and it hashes to what the manifest says.
    const frozenPath = resolve(result.bundlePath, SOURCE_TEXT_REL_PATH);
    assert.ok(existsSync(frozenPath), "the text must be frozen into the research run");
    const frozen = readFileSync(frozenPath, "utf8");
    assert.equal(frozen, TEXT);
    assert.equal(createHash("sha256").update(frozen, "utf8").digest("hex"), result.sourceText!.sha256);

    // MAPPED: two spans, ordered, non-overlapping, resolved to real offsets.
    const map = JSON.parse(readFileSync(resolve(result.bundlePath, CHAPTER_MAP_REL_PATH), "utf8")) as ChapterMapV1;
    assert.equal(map.spans.length, 2);
    assert.ok(map.spans[0].endOffset <= map.spans[1].startOffset);
    assert.ok(map.coverageFraction > 0.9, `coverage ${map.coverageFraction}`);

    // HANDED TO THE RESEARCHER: each chapter got ITS OWN span, sliced from the frozen text.
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.ok(call.sourceSpan, "every chapter of a source-text run must receive a span");
      assert.equal(call.sourceSpan!.text, chapterSpanText(frozen, map.spans[call.chapter.number - 1]));
      assert.equal(call.sourceTextSha256, result.sourceText!.sha256);
    }

    // PROVENANCE — manifest, sidecars, freeze report, and the returned result.
    const manifest = readResearchRunManifest(result.bundlePath);
    assert.ok(manifest.ok, manifest.ok ? "" : manifest.errors.join("; "));
    assert.equal(manifest.manifest.sourceProvenance, "source-text");
    assert.equal(manifest.manifest.sourceText?.frozenPath, SOURCE_TEXT_REL_PATH);
    assert.equal(manifest.manifest.sourceText?.originPath, FRANKLIN_SLICE_PATH);
    assert.equal(result.sourceProvenance, "source-text");
    for (const chapter of result.chapters) {
      assert.equal(chapter.sourceProvenance, "source-text");
      assert.equal(chapter.sourceTextSha256, result.sourceText!.sha256);
    }
    const report = readFileSync(resolve(result.bundlePath, "source-freeze", "source-freeze-report.md"), "utf8");
    assert.match(report, /Source provenance: source-text/);
    assert.match(report, new RegExp(result.sourceText!.sha256));

    // THE CHECKER IS ON: the record is derived from the frozen bytes and VERIFIES.
    const record = buildSourceTextVerifyRecord({
      bookId: result.bookId,
      sidecars: result.chapters,
      sourceText: frozen,
      sourceTextSha256: result.sourceText!.sha256,
      chapterMap: map,
    });
    assert.ok(record, "a source-text run must produce a source-verify record without an operator");
    const expected = result.chapters.flatMap((chapter) => verifiableItems(chapter));
    assert.deepEqual(checkSourceVerifyRecord(expected, record), [], "every quoted item must verify against the frozen text");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 3: an unquotable fact is DROPPED ─────────────────────────────────────────

test("R-052: an unquotable fact is named on every retry and DROPPED on the last attempt, never fabricated", async () => {
  if (TEXT.length === 0) throw new Error(`${FRANKLIN_SLICE_PATH} is missing`);
  const input: ChapterResearchInput = {
    bibliography: bibliography(false),
    chapter: { number: 1, title: "Ancestry" },
    sourceSpan: { startOffset: 0, endOffset: HALF, text: TEXT.slice(0, HALF) },
    sourceTextSha256: "f".repeat(64),
  };
  const poisoned = groundedChapter(input, true);
  // The model returns the SAME poisoned draft on all three attempts.
  const { runner, prompts, calls } = createUniquenessEnforcingRunner([poisoned, poisoned, poisoned]);
  const execution = mintingExecution(runner, {
    bookId: "zz-franklin-slice", runId: "run-fixture", attemptId: "attempt-fixture",
    stageId: "research", operationId: "research-ch01", workDir: resolve(tmpdir(), "cf-ingest-attempt"),
    signal: new AbortController().signal,
  });
  const result = await runResearcherChapter(input, execution);
  assert.equal(calls(), 3, "the ungrounded item must be retried, not accepted on attempt 1");

  // Attempts 2 and 3 name the exact item and quote the exact reason.
  for (const prompt of prompts.slice(1)) {
    assert.match(prompt, /testable fact ch01\.fact\.1/);
    assert.match(prompt, /not a verbatim substring/);
  }
  // And the last attempt drops it rather than admitting or inventing one.
  assert.equal(result.testableFacts!.length, 9);
  assert.ok(!result.testableFacts!.some((fact) => fact.id === "ch01.fact.1"));
  assert.equal(result.droppedItems!.length, 1);
  assert.equal(result.droppedItems![0].id, "ch01.fact.1");
  assert.equal(result.droppedItems![0].attempts, 3, "the record must state how many attempts the item really failed");
  assert.equal(result.sourceProvenance, "source-text");
  assert.equal(result.sourceTextSha256, "f".repeat(64));
});

test("R-052: when the drop leaves the sidecar under its floor, the run says WHY instead of padding", async () => {
  if (TEXT.length === 0) throw new Error(`${FRANKLIN_SLICE_PATH} is missing`);
  const input: ChapterResearchInput = {
    bibliography: bibliography(false),
    chapter: { number: 1, title: "Ancestry" },
    sourceSpan: { startOffset: 0, endOffset: HALF, text: TEXT.slice(0, HALF) },
  };
  const draft = groundedChapter(input, false);
  // Every fact but one is unquotable: the survivors cannot reach the 9-fact floor.
  draft.testableFacts = draft.testableFacts!.map((fact, i) => (i === 0 ? fact : { ...fact, sourceQuote: `invented claim ${i} that the account never makes` }));
  const { runner } = createUniquenessEnforcingRunner([draft, draft, draft]);
  const execution = mintingExecution(runner, {
    bookId: "zz-franklin-slice", runId: "run-floor", attemptId: "attempt-floor",
    stageId: "research", operationId: "research-ch01", workDir: resolve(tmpdir(), "cf-ingest-attempt"),
    signal: new AbortController().signal,
  });
  await assert.rejects(
    runResearcherChapter(input, execution),
    (error: Error) => {
      assert.match(error.message, /^RESEARCH_SOURCE_INSUFFICIENT:/);
      assert.match(error.message, /dropped 9 item\(s\)/);
      assert.match(error.message, /do not pad it/);
      return true;
    },
  );
});

test("R-046: the orchestrator fails closed on an ungrounded chapter, whatever produced it", async () => {
  if (TEXT.length === 0) throw new Error(`${FRANKLIN_SLICE_PATH} is missing`);
  const root = tempRoot();
  try {
    await assert.rejects(
      runOnce({ runsRoot: resolve(root, "runs"), stateRoot: resolve(root, "state"), sourceTextPath: FRANKLIN_SLICE_PATH, poison: true, skipDrop: true }),
      /RESEARCH_SOURCE_UNGROUNDED:chapter 1 returned 1 item\(s\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 4: run identity binds the text ───────────────────────────────────────────

test("R-046: run identity binds the TEXT — a different text is a different run, and no text hashes exactly as before", () => {
  const base = { title: "T", author: "A", bookIdHint: "b" };
  const withoutText = researchInputHash(base);
  // Independently re-derived: the model-memory identity must be the pre-ingestion
  // value, i.e. the digest of {author,bookIdHint,title} with no source key at all.
  assert.equal(
    withoutText,
    createHash("sha256").update(JSON.stringify({ author: "A", bookIdHint: "b", title: "T" }), "utf8").digest("hex"),
    "adding a source key unconditionally would have re-keyed every existing research run",
  );
  const a = researchInputHash({ ...base, sourceTextSha256: "a".repeat(64) });
  const b = researchInputHash({ ...base, sourceTextSha256: "b".repeat(64) });
  assert.notEqual(a, withoutText);
  assert.notEqual(a, b);

  // And the rejection an operator actually sees on a resume.
  const compatibility = { codeVersion: RESEARCH_RUN_CODE_VERSION, promptHash: "p", configHash: "c", provider: "model-gateway-v1", model: "m" };
  const manifest = { input: { hash: a }, expectedChaptersHash: "x", compatibility } as never;
  assert.deepEqual(compatibilityRejectionReasons(manifest, { inputHash: b, compatibility }), ["input hash changed"]);
  assert.deepEqual(compatibilityRejectionReasons(manifest, { inputHash: a, compatibility }), []);
});

test("R-046: the book-run's own run definition binds the text, so a resume with another text conflicts", () => {
  if (TEXT.length === 0) throw new Error(`${FRANKLIN_SLICE_PATH} is missing`);
  const dir = tempRoot();
  try {
    const other = resolve(dir, "other.txt");
    writeFileSync(other, `${TEXT}\nAnd one further sentence that is not in the first text.\n`, "utf8");
    const request = (sourceTextPath?: string) => ({
      title: "Autobiography of Benjamin Franklin",
      author: "Benjamin Franklin",
      bookId: "zz-franklin-slice",
      sourceGitSha: "deadbeef",
      v25Root: resolve(dir, "v25"),
      attemptRoot: resolve(dir, "attempts"),
      ...(sourceTextPath === undefined ? {} : { sourceTextPath }),
      signal: new AbortController().signal,
    });
    const none = intentCommandId(request());
    const first = intentCommandId(request(FRANKLIN_SLICE_PATH));
    const second = intentCommandId(request(other));
    assert.notEqual(first, none, "a run WITH a text is not the same run as one without");
    assert.notEqual(first, second, "two different texts are two different runs");
    // The model-memory intent id is unchanged by this package: re-derived here
    // from the documented formula, with no source component at all.
    const expected = createHash("sha256")
      .update("Autobiography of Benjamin Franklin").update("\0")
      .update("Benjamin Franklin").update("\0")
      .update("zz-franklin-slice").update("\0")
      .update(resolve(dir, "v25")).update("\0")
      .update("resume")
      .digest("hex").slice(0, 24);
    assert.equal(none, `research-candidate-v1-${expected}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 6: the model-memory path is unchanged ────────────────────────────────────

test("R-046: with no source text the run is recorded as model-memory and nothing else changes", async () => {
  if (TEXT.length === 0) throw new Error(`${FRANKLIN_SLICE_PATH} is missing`);
  const root = tempRoot();
  try {
    const { result, calls } = await runOnce({ runsRoot: resolve(root, "runs"), stateRoot: resolve(root, "state") });
    assert.equal(result.sourceProvenance, "model-memory");
    assert.equal(result.sourceText, undefined);
    assert.equal(result.chapterMap, undefined);
    assert.ok(!existsSync(resolve(result.bundlePath, SOURCE_TEXT_REL_PATH)));
    assert.ok(!existsSync(resolve(result.bundlePath, CHAPTER_MAP_REL_PATH)));
    for (const call of calls) assert.equal(call.sourceSpan, undefined, "no span may be invented when there is no text");
    const manifest = readResearchRunManifest(result.bundlePath);
    assert.ok(manifest.ok, manifest.ok ? "" : manifest.errors.join("; "));
    assert.equal(manifest.manifest.sourceProvenance, "model-memory");
    for (const chapter of result.chapters) {
      assert.equal(chapter.sourceProvenance, "model-memory");
      assert.equal(chapter.sourceTextSha256, undefined);
      assert.equal(chapter.droppedItems, undefined);
      for (const fact of chapter.testableFacts ?? []) assert.equal(fact.sourceQuote, undefined);
    }
    const report = readFileSync(resolve(result.bundlePath, "source-freeze", "source-freeze-report.md"), "utf8");
    assert.match(report, /Source provenance: model-memory/);
    assert.match(report, /No source text was supplied/);
    // And the derived record cannot exist for it — which is exactly why the
    // policy must NOT start demanding one for model-memory books (R-047).
    assert.equal(
      buildSourceTextVerifyRecord({
        bookId: result.bookId,
        sidecars: result.chapters,
        sourceText: "",
        sourceTextSha256: "0".repeat(64),
        chapterMap: { schemaVersion: "chapterflow.chapterMap.v1", bookId: result.bookId, sourceTextSha256: "0".repeat(64), sourceTextLength: 0, coverageFraction: 0, spans: [] },
      }),
      null,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── R-047: the switch, both ways ─────────────────────────────────────────────

const POLICY_BASE = {
  bookId: "zz",
  expectedItems: [],
  hasSourceV2Sidecars: true,
  recordText: null,
  exemptionText: null,
  exemptionError: null,
  contentIdentity: { canonicalIndexHash: "h" },
  requireEnv: false,
  now: new Date("2026-09-03T00:00:00.000Z"),
};

test("R-047: a source-text book with no verifiable record BLOCKS; a model-memory book is unchanged", () => {
  const grounded = decideSourceRealityPolicy({ ...POLICY_BASE, hasSourceTextSidecars: true });
  assert.equal(grounded.applies, true);
  assert.equal(grounded.decision, "missing");
  assert.equal(grounded.blocking, true);
  assert.match(grounded.findings[0].message, /researched against a real source text/);

  // WHAT THIS STOPS BLOCKING: nothing. The previous behaviour for a book with no
  // source text is preserved exactly — non-blocking by default, blocking only
  // under the documented env opt-in.
  const recalled = decideSourceRealityPolicy({ ...POLICY_BASE, hasSourceTextSidecars: false });
  assert.equal(recalled.applies, false);
  assert.equal(recalled.decision, "not-applicable");
  assert.equal(recalled.blocking, false);
  const enforced = decideSourceRealityPolicy({ ...POLICY_BASE, hasSourceTextSidecars: false, requireEnv: true });
  assert.equal(enforced.decision, "missing");
  assert.equal(enforced.blocking, true);
});

test("R-049: a fabricated hardSpecific fails the derived record even though the sidecar is self-consistent", () => {
  if (TEXT.length === 0) throw new Error(`${FRANKLIN_SLICE_PATH} is missing`);
  const { map } = resolveChapterMap({
    bookId: "zz",
    sourceText: TEXT,
    sourceTextSha256: "0".repeat(64),
    chapters: [{ number: 1, title: "Ancestry" }, { number: 2, title: "Early Youth" }],
    spans: anchors(),
  });
  assert.ok(map);
  const sidecar = {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    sourceProvenance: "source-text",
    namedExamples: [{
      id: "ch01.case.leather",
      label: "Leather Apron Club",
      summary: "A club of tradesmen the account never calls by that name.",
      hardSpecifics: ["Leather Apron Club"],
      realWorld: true,
      // Internally consistent: the summary repeats the specific, which is all
      // SV2's self-consistency check ever asked for.
      sourceQuote: "The Leather Apron Club met every Friday evening in a tavern.",
    }],
    testableFacts: [],
  };
  const record = buildSourceTextVerifyRecord({ bookId: "zz", sidecars: [sidecar], sourceText: TEXT, sourceTextSha256: "0".repeat(64), chapterMap: map! })!;
  const blockers = checkSourceVerifyRecord(verifiableItems(sidecar), record).filter((f) => f.severity === "blocker");
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].checkId, "SV2");
  assert.match(blockers[0].message, /not VERIFIED/);
});

// ── the researcher's own admission gate ──────────────────────────────────────

test("R-058: the same sidecar that passes at chapter size fails the floors at Part size", () => {
  if (TEXT.length === 0) throw new Error(`${FRANKLIN_SLICE_PATH} is missing`);
  const input = (spanChars: number): ChapterResearchInput => ({
    bibliography: bibliography(false),
    chapter: { number: 1, title: "Ancestry" },
    sourceSpan: { startOffset: 0, endOffset: spanChars, text: TEXT.slice(0, 1).repeat(spanChars) },
  });
  const chapter = groundedChapter({ ...input(20_000), sourceSpan: { startOffset: 0, endOffset: HALF, text: TEXT.slice(0, HALF) } }, false);
  // At chapter size the floors are today's: 9 facts / 3 cases / 4 claims.
  const small = collectChapterResearchProblems(chapter, { ...input(20_000), sourceSpan: { startOffset: 0, endOffset: HALF, text: TEXT.slice(0, HALF) } });
  assert.deepEqual(small.filter((p) => /floor|keyClaims needs/.test(p)), []);
  // At Part size (110k characters) the same ten facts and three cases are not enough.
  const big = collectChapterResearchProblems(chapter, {
    bibliography: bibliography(false),
    chapter: { number: 1, title: "Ancestry" },
    sourceSpan: { startOffset: 0, endOffset: 110_000, text: "x".repeat(110_000) },
  });
  assert.ok(big.some((p) => /testableFacts has 10; need at least 18/.test(p)), big.join(" | "));
  assert.ok(big.some((p) => /namedExamples has 3; need at least 6/.test(p)), big.join(" | "));
  assert.ok(big.some((p) => /keyClaims needs 8/.test(p)), big.join(" | "));
});
