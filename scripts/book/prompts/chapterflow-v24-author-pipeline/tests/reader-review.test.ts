/**
 * reader-review — component A1 (v24 reader-proxy instrument) unit tests:
 * renderChapterReaderDoc byte contract, REVIEW_WEIGHTS invariant, the blinded
 * task template, parseReaderReview validation, adjudicateReview (quote
 * byte-verification, key check, weighted composite, bar boundary), and
 * writeChapterReview persistence under an INJECTED state root (never the
 * repo's real state/).
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { test } from "./harness.js";
import type { ChapterV21 } from "../src/types.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../src/artifacts/artifactTypes.js";
import { renderChapterReaderDoc } from "../src/review/renderReaderDoc.js";
import {
  REVIEW_WEIGHTS,
  AUTHOR_CHAPTER_BAR,
  DocIntegrityError,
  adjudicateReview,
  assertChapterReaderDocIntegrity,
  buildReaderReviewTask,
  chapterDocKeyRowLines,
  chapterDocQuestionLineCount,
  parseReaderReview,
  screenChapterStructuralClaims,
  writeChapterReview,
  type ParsedReaderReview,
} from "../src/review/readerReview.js";
import { resolveChapterBar, resolveChapterNoiseBand, CHAPTER_NOISE_BAND_DEFAULT } from "../src/orchestrator/authorReview.js";
import { ensureTrailingNewline } from "../src/lib/atomicWrite.js";

// ── Fixture ─────────────────────────────────────────────────────────────────

function fixtureChapter(): ChapterV21 {
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: "zz-review-fixture-ch01",
    number: 1,
    title: "The Two-Minute Start",
    readingTimeMinutes: 9,
    hook: "The habit you keep is the one that starts smaller than feels useful.",
    keyTakeaway: "Shrink any new habit to a two-minute version so showing up becomes the first skill you practice.",
    tryThisNow: "Pick one stalled habit and do only its first two minutes before your next meal.",
    breakdown: {
      fastRead: "A runner laces her shoes, steps outside, and stops. That was the workout. The rule caps the START, not the goal.",
      deepRead: "The mechanism is friction: the first two minutes carry almost all of a habit's activation cost, so capping them makes starting automatic.",
      fullRead: "The limit is honest: two-minute starts will not train you for a marathon. They train the identity of someone who shows up, which is the prerequisite.",
    },
    examples: [
      {
        exampleId: "ex-1",
        title: "Gym shoes, then stop",
        tags: ["habit"],
        planSpec: { domain: "fitness", audience: "beginner", stakes: "low", format: "vignette", requiredBeat: "start small" },
        scenario: "A new gym-goer commits to putting on workout shoes and standing on the mat. Nothing else counts toward the streak.",
        whatToDo: "Cap the habit at its first two minutes and let stopping be allowed.",
        whyItMatters: "Showing up is the vote that compounds into an identity.",
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        {
          questionId: "q1",
          prompt: "What does the two-minute rule cap?",
          choices: ["The starting effort", "The weekly volume", "The total goal"],
          correctIndex: 0,
          explanation: "It caps the start of the habit, not the ambition behind it.",
          bloomsLevel: "understand",
          depthLevel: "standard",
        },
        {
          questionId: "q2",
          prompt: "Why cap the start of a habit?",
          choices: ["To save money", "Because the first minutes carry the activation cost", "To impress a coach"],
          correctIndex: 1,
          explanation: "The first two minutes carry most of the friction, so capping them makes starting automatic.",
          bloomsLevel: "understand",
          depthLevel: "standard",
        },
        {
          questionId: "q3",
          prompt: "What do repeated two-minute starts build first?",
          choices: ["Endurance", "Equipment familiarity", "The identity of someone who shows up"],
          correctIndex: 2,
          explanation: "Each start is a vote for the identity; skill volume comes later.",
          bloomsLevel: "apply",
          depthLevel: "standard",
        },
      ],
    },
    reviewCards: [
      { cardId: "c1", front: "What is the two-minute rule?", back: "Scale any habit down to a two-minute version and let that count.", difficulty: "easy" },
    ],
    implementationPlan: {
      title: "Shrink the starting habit",
      coreSkill: "Reduce any habit to a two-minute entry version. Practice the art of showing up before optimizing anything else.",
      ifThenPlans: [{ context: "After I pour my morning coffee", plan: "If I sit down at the table, then I open the book for two minutes." }],
      twentyFourHourChallenge: "Do one two-minute start on a stalled habit today.",
      weeklyPractice: "Log seven two-minute starts this week; count starts, not minutes.",
    },
    memorableLines: [
      { text: "Showing up is the vote that compounds into an identity.", location: "example[0].whyItMatters", why: "Concrete image of identity voting." },
    ],
  };
}

function allScores(v: number): Record<ReviewFactor, number> {
  const scores = {} as Record<ReviewFactor, number>;
  for (const f of REVIEW_FACTORS) scores[f] = v;
  return scores;
}

function goodParsed(overrides: Partial<ParsedReaderReview> = {}): ParsedReaderReview {
  return {
    quizDerivation: { answers: ["a", "b", "c"], keyDisagreements: [], tells: [] },
    scores: allScores(90),
    ship84: true,
    quotes: [
      { quote: "Showing up is the vote that compounds into an identity.", why: "strong memorable line" },
      { quote: "The rule caps the START, not the goal.", why: "crisp mechanism statement" },
    ],
    complaints: [],
    oneParagraphVerdict: "Solid chapter.",
    ...overrides,
  };
}

function fencedJson(obj: unknown): string {
  return "```json\n" + JSON.stringify(obj, null, 2) + "\n```";
}

function parsedAsRaw(p: ParsedReaderReview): Record<string, unknown> {
  return {
    quizDerivation: p.quizDerivation,
    scores: p.scores,
    ship84: p.ship84,
    quotes: p.quotes,
    complaints: p.complaints,
    oneParagraphVerdict: p.oneParagraphVerdict,
  };
}

// ── Weights ─────────────────────────────────────────────────────────────────

test("REVIEW_WEIGHTS sums to 100 and covers exactly the 10 review factors", () => {
  const sum = Object.values(REVIEW_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(sum, 100);
  assert.deepEqual(Object.keys(REVIEW_WEIGHTS).sort(), [...REVIEW_FACTORS].sort());
  assert.equal(REVIEW_FACTORS.length, 10);
});

// ── Renderer ────────────────────────────────────────────────────────────────

test("renderChapterReaderDoc: every reader-facing section header is present, in order", () => {
  const doc = renderChapterReaderDoc(fixtureChapter());
  const headers = [
    "# The Two-Minute Start",
    "## Hook",
    "## Fast read",
    "## Deep read",
    "## Full read",
    "## Key takeaway",
    "## Try this now",
    "## Examples",
    "### Example 1: Gym shoes, then stop",
    "## Quiz",
    "## Review cards",
    "## Implementation plan",
    "## Memorable lines",
    "## ANSWER KEY (for key-soundness checking — derive your own answers from the prose FIRST)",
  ];
  let cursor = -1;
  for (const h of headers) {
    const at = doc.indexOf(h);
    assert.ok(at > cursor, `header missing or out of order: ${h}`);
    cursor = at;
  }
  // Field prefixes from the validated renderer.
  assert.ok(doc.includes("What to do: Cap the habit at its first two minutes"));
  assert.ok(doc.includes("Why it matters: Showing up is the vote"));
  assert.ok(doc.includes("Card 1 — Front: What is the two-minute rule?"));
  assert.ok(doc.includes("          Back: Scale any habit down"));
  assert.ok(doc.includes("If-then 1: [After I pour my morning coffee] If I sit down at the table"));
  assert.ok(doc.includes("24-hour challenge: "));
  assert.ok(doc.includes("Weekly practice: "));
  assert.ok(doc.includes("- Showing up is the vote that compounds into an identity."));
  assert.ok(doc.includes("   a) The starting effort"));
  // 2026-07-03 explanation-leak fix: explanations must NOT appear before the
  // ANSWER KEY (they disclosed the intended key under the choices); they now
  // render inside the key rows instead.
  const keyHeaderAt = doc.indexOf("## ANSWER KEY");
  assert.ok(!doc.slice(0, keyHeaderAt).includes("Explanation:"), "no explanation text above the ANSWER KEY");
  assert.ok(/^Q\d+: [abc] — It caps the start of the habit/m.test(doc.slice(keyHeaderAt)), "explanation rides its key row");
});

test("renderChapterReaderDoc: answer key at the bottom maps correctIndex 0/1/2 to a/b/c", () => {
  const doc = renderChapterReaderDoc(fixtureChapter());
  const keyAt = doc.indexOf("## ANSWER KEY");
  assert.ok(keyAt > 0);
  const keyBlock = doc.slice(keyAt);
  const lines = keyBlock.split("\n").slice(1);
  // Rows carry the letter mapping first; explanations ride after " — " (2026-07-03 leak fix).
  assert.deepEqual(lines.map((l) => l.split(" — ")[0]), ["Q1: a", "Q2: b", "Q3: c"]);
  // Nothing after the key: the document ENDS with the mapped key rows.
  assert.ok(/\nQ3: c( — [^\n]*)?$/.test(doc));
});

// ── Task template ───────────────────────────────────────────────────────────

test("buildReaderReviewTask substitutes the doc path and the bar into the GATE line", () => {
  const task = buildReaderReviewTask("scratch/eval-proxy/some-book/ch03.txt", 84);
  assert.ok(task.includes("is at: scratch/eval-proxy/some-book/ch03.txt"));
  assert.ok(task.includes("professional >=84/100 bar? true/false"));
  assert.ok(task.includes('"ship84": false'));
  assert.ok(task.includes('"complaints": [{"unit": "...", "problem": "...", "mustFix": false}]'));
  const task90 = buildReaderReviewTask("doc.txt", 90);
  assert.ok(task90.includes("professional >=90/100 bar? true/false"));
  // The JSON contract field name stays ship84 regardless of the bar.
  assert.ok(task90.includes('"ship84"'));
});

// ── parseReaderReview ───────────────────────────────────────────────────────

test("parseReaderReview: a valid fenced json block parses (LAST block wins)", () => {
  const decoy = fencedJson({ scores: "not the review" });
  const real = fencedJson(parsedAsRaw(goodParsed()));
  const parsed = parseReaderReview(`preamble prose\n${decoy}\nmore prose\n${real}\ntrailing note`);
  assert.ok(parsed, "expected a parsed review");
  assert.equal(parsed.ship84, true);
  assert.equal(parsed.scores.retention, 90);
  assert.deepEqual(parsed.quizDerivation.answers, ["a", "b", "c"]);
  assert.equal(parsed.quotes.length, 2);
  assert.equal(parsed.oneParagraphVerdict, "Solid chapter.");
});

test("parseReaderReview: a missing factor => null", () => {
  const raw = parsedAsRaw(goodParsed());
  delete (raw.scores as Record<string, unknown>).density;
  assert.equal(parseReaderReview(fencedJson(raw)), null);
});

test("parseReaderReview: a non-numeric or out-of-range score => null", () => {
  const nonNumeric = parsedAsRaw(goodParsed());
  (nonNumeric.scores as Record<string, unknown>).tone = "85";
  assert.equal(parseReaderReview(fencedJson(nonNumeric)), null);

  const outOfRange = parsedAsRaw(goodParsed());
  (outOfRange.scores as Record<string, unknown>).tone = 101;
  assert.equal(parseReaderReview(fencedJson(outOfRange)), null);

  const badShip = parsedAsRaw(goodParsed());
  badShip.ship84 = "true";
  assert.equal(parseReaderReview(fencedJson(badShip)), null);

  assert.equal(parseReaderReview("no fenced block here"), null);
});

// ── adjudicateReview ────────────────────────────────────────────────────────

test("adjudicateReview: verified quotes + clean keys + ship => valid PASS with correct composite", () => {
  const ch = fixtureChapter();
  const doc = renderChapterReaderDoc(ch);
  const review = adjudicateReview(goodParsed(), doc, ch, { bar: 84, reviewerSessionId: "sess-1" });
  assert.equal(review.schemaVersion, "chapterflow-review-v1");
  assert.equal(review.chapterId, "zz-review-fixture-ch01");
  assert.equal(review.chapterNumber, 1);
  assert.equal(review.reviewerSessionId, "sess-1");
  assert.match(review.contentHash, /^[0-9a-f]{16}$/);
  assert.equal(review.valid, true);
  assert.ok(review.quotes.every((q) => q.verified));
  assert.deepEqual(review.keyCheck, { derived: ["a", "b", "c"], matches: 3, of: 3, disagreements: [] });
  assert.equal(review.composite, 90); // all factors 90 → weighted mean 90.0
  assert.equal(review.ship84, true);
  assert.equal(review.pass, true);
});

test("adjudicateReview: ONE fabricated quote => valid=false and pass=false (others stay verified)", () => {
  const ch = fixtureChapter();
  const doc = renderChapterReaderDoc(ch);
  const parsed = goodParsed({
    quotes: [
      { quote: "Showing up is the vote that compounds into an identity.", why: "real line" },
      { quote: "This exact sentence does not appear in the document.", why: "fabricated" },
    ],
  });
  const review = adjudicateReview(parsed, doc, ch, { bar: 84 });
  assert.equal(review.quotes[0].verified, true);
  assert.equal(review.quotes[1].verified, false);
  assert.equal(review.valid, false);
  assert.equal(review.pass, false);
});

test("adjudicateReview: a key mismatch is counted with a positional disagreement and blocks pass", () => {
  const ch = fixtureChapter();
  const doc = renderChapterReaderDoc(ch);
  const parsed = goodParsed({ quizDerivation: { answers: ["a", "c", "c"], keyDisagreements: ["Q2 feels ambiguous"], tells: ["Q3 longest choice is the key"] } });
  const review = adjudicateReview(parsed, doc, ch, { bar: 84 });
  assert.equal(review.valid, true); // quotes still verify
  assert.equal(review.keyCheck.of, 3);
  assert.equal(review.keyCheck.matches, 2);
  assert.deepEqual(review.keyCheck.disagreements, ["Q2: reader=c key=b"]);
  assert.deepEqual(review.tells, ["Q3 longest choice is the key"]);
  assert.equal(review.pass, false, "matches !== of must block pass");
});

test("adjudicateReview: composite boundary — 83.9 fails bar 84, 84.0 passes", () => {
  const ch = fixtureChapter();
  const doc = renderChapterReaderDoc(ch);

  // All factors 84 except tone (weight 10) at 83 → 84 - 10*1/100 = 83.9 exactly.
  const under = adjudicateReview(goodParsed({ scores: { ...allScores(84), tone: 83 } }), doc, ch, { bar: 84 });
  assert.equal(under.composite, 83.9);
  assert.equal(under.valid, true);
  assert.equal(under.ship84, true);
  assert.equal(under.keyCheck.matches, under.keyCheck.of);
  assert.equal(under.pass, false, "83.9 must fail a bar of 84");

  const at = adjudicateReview(goodParsed({ scores: allScores(84) }), doc, ch, { bar: 84 });
  assert.equal(at.composite, 84);
  assert.equal(at.pass, true, "84.0 with ship84 + clean keys + verified quotes must pass");
});

// ── Phase 2 — the chapter soft bar is 80 (production default), true blockers strict ──

test("AUTHOR_CHAPTER_BAR is 80 and is the resolved production default", () => {
  assert.equal(AUTHOR_CHAPTER_BAR, 80, "the chapter soft bar is 80 (lowered from 84 by owner decision)");
  const saved = process.env.CHAPTERFLOW_CHAPTER_BAR;
  delete process.env.CHAPTERFLOW_CHAPTER_BAR;
  try {
    assert.equal(resolveChapterBar(), 80, "unset env → 80");
    process.env.CHAPTERFLOW_CHAPTER_BAR = "82";
    assert.equal(resolveChapterBar(), 82, "env override is honored");
    process.env.CHAPTERFLOW_CHAPTER_BAR = "not-a-number";
    assert.throws(() => resolveChapterBar(), /CHAPTERFLOW_CHAPTER_BAR is set but not a finite/, "garbage env fails closed");
    process.env.CHAPTERFLOW_CHAPTER_BAR = "150";
    assert.throws(() => resolveChapterBar(), /0-100/, "out-of-range env fails closed");
  } finally {
    if (saved === undefined) delete process.env.CHAPTERFLOW_CHAPTER_BAR;
    else process.env.CHAPTERFLOW_CHAPTER_BAR = saved;
  }
});

test("buildReaderReviewTask defaults the GATE line to the 80 bar", () => {
  const task = buildReaderReviewTask("doc.txt"); // no explicit bar → production default
  assert.ok(task.includes("professional >=80/100 bar? true/false"), "default GATE line reads 80");
});

test("chapter bar 80: 79.9 fails, 80.0 passes, 83 passes — all with clean keys + verified quotes + ship", () => {
  const ch = fixtureChapter();
  const doc = renderChapterReaderDoc(ch);

  // All factors 80 except tone (weight 10) at 79 → 80 - 10*1/100 = 79.9 exactly.
  const under = adjudicateReview(goodParsed({ scores: { ...allScores(80), tone: 79 } }), doc, ch, { bar: AUTHOR_CHAPTER_BAR });
  assert.equal(under.composite, 79.9);
  assert.equal(under.valid, true);
  assert.equal(under.ship84, true);
  assert.equal(under.keyCheck.matches, under.keyCheck.of);
  assert.equal(under.pass, false, "79.9 must fail the 80 bar (→ repair/regen)");

  const at = adjudicateReview(goodParsed({ scores: allScores(80) }), doc, ch, { bar: AUTHOR_CHAPTER_BAR });
  assert.equal(at.composite, 80);
  assert.equal(at.pass, true, "80.0 with no true blocker must pass the 80 bar");

  const mid = adjudicateReview(goodParsed({ scores: allScores(83) }), doc, ch, { bar: AUTHOR_CHAPTER_BAR });
  assert.equal(mid.composite, 83);
  assert.equal(mid.pass, true, "83 with no true blocker must pass the 80 bar");
});

test("chapter bar 80: a true blocker (key mismatch) fails even at composite 85 — lowered bar does NOT relax blockers", () => {
  const ch = fixtureChapter();
  const doc = renderChapterReaderDoc(ch);
  // Composite 85 (well over the 80 bar) but Q2 keyed wrong → a deterministic
  // true blocker that the soft-bar change must NOT wave through.
  const parsed = goodParsed({ scores: allScores(85), quizDerivation: { answers: ["a", "c", "c"], keyDisagreements: [], tells: [] } });
  const review = adjudicateReview(parsed, doc, ch, { bar: AUTHOR_CHAPTER_BAR });
  assert.equal(review.composite, 85);
  assert.equal(review.keyCheck.matches !== review.keyCheck.of, true, "key mismatch present");
  assert.equal(review.pass, false, "a key-soundness blocker fails regardless of a passing composite");

  // A fabricated quote is likewise a hard blocker at composite 85.
  const badQuote = goodParsed({ scores: allScores(85), quotes: [{ quote: "not in the doc at all", why: "fabricated" }] });
  const r2 = adjudicateReview(badQuote, doc, ch, { bar: AUTHOR_CHAPTER_BAR });
  assert.equal(r2.valid, false);
  assert.equal(r2.pass, false, "quote fabrication blocks pass even above the bar");
});

test("resolveChapterNoiseBand defaults to the measured panel band and fails closed on garbage", () => {
  assert.equal(CHAPTER_NOISE_BAND_DEFAULT, 3.7);
  const saved = process.env.CHAPTERFLOW_CHAPTER_NOISE_BAND;
  delete process.env.CHAPTERFLOW_CHAPTER_NOISE_BAND;
  try {
    assert.equal(resolveChapterNoiseBand(), 3.7, "unset → default band");
    process.env.CHAPTERFLOW_CHAPTER_NOISE_BAND = "2.5";
    assert.equal(resolveChapterNoiseBand(), 2.5);
    process.env.CHAPTERFLOW_CHAPTER_NOISE_BAND = "-1";
    assert.throws(() => resolveChapterNoiseBand(), /not a finite non-negative/);
  } finally {
    if (saved === undefined) delete process.env.CHAPTERFLOW_CHAPTER_NOISE_BAND;
    else process.env.CHAPTERFLOW_CHAPTER_NOISE_BAND = saved;
  }
});

test("adjudicateReview: complaints pass through verbatim and default to empty", () => {
  const ch = fixtureChapter();
  const doc = renderChapterReaderDoc(ch);
  const withComplaints = adjudicateReview(
    goodParsed({ complaints: [{ unit: "quiz Q2", problem: "choice b restates the explanation", mustFix: true }] }),
    doc,
    ch,
  );
  assert.deepEqual(withComplaints.complaints, [{ unit: "quiz Q2", problem: "choice b restates the explanation", mustFix: true }]);
  const without = adjudicateReview(goodParsed(), doc, ch);
  assert.deepEqual(without.complaints, []);
});

// ── sampleChapters (eval-reader-proxy) ──────────────────────────────────────

test("sampleChapters: deterministic md5(bookId:number) ascending sample, stable across calls", async () => {
  const { sampleChapters } = await import("../src/review/evalReaderProxy.js");
  const chapters = Array.from({ length: 8 }, (_, i) => ({ ...fixtureChapter(), number: i + 1 })) as ChapterV21[];
  const a = sampleChapters("some-book", chapters, 3).map((c) => c.number);
  const b = sampleChapters("some-book", chapters, 3).map((c) => c.number);
  assert.equal(a.length, 3);
  assert.deepEqual(a, b, "sampling must be deterministic");
  // Matches the spec'd ordering: md5(`${bookId}:${number}`) hex ascending.
  const { createHash } = await import("crypto");
  const expected = chapters
    .map((c) => ({ n: c.number, key: createHash("md5").update(`some-book:${c.number}`).digest("hex") }))
    .sort((x, y) => (x.key < y.key ? -1 : 1))
    .slice(0, 3)
    .map((x) => x.n);
  assert.deepEqual(a, expected);
  // A different book id yields a different (still deterministic) sample order key-space.
  const other = sampleChapters("other-book", chapters, 8).map((c) => c.number);
  assert.equal(other.length, 8);
  // Oversampling clamps to the chapter count.
  assert.equal(sampleChapters("some-book", chapters, 99).length, 8);
});

// ── writeChapterReview ──────────────────────────────────────────────────────

test("writeChapterReview: writes state/reviews/<bookId>/chNN.review.json under an INJECTED root", () => {
  const ch = fixtureChapter();
  const doc = renderChapterReaderDoc(ch);
  const review = adjudicateReview(goodParsed(), doc, ch, { bar: 84, reviewerSessionId: "sess-w" });
  const root = mkdtempSync(join(tmpdir(), "cf-reader-review-"));
  try {
    const path = writeChapterReview("zz-review-fixture", review, root);
    assert.equal(path, join(root, "reviews", "zz-review-fixture", "ch01.review.json"));
    assert.ok(existsSync(path));
    const readBack = JSON.parse(readFileSync(path, "utf8"));
    assert.deepEqual(readBack, review);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Q1: reader-facing doc trailing newline (via the write choke point) ────────

test("Q1 ensureTrailingNewline is idempotent and quote-safe on a chapter doc", () => {
  const raw = renderChapterReaderDoc(fixtureChapter());
  assert.ok(!raw.endsWith("\n"), "the raw renderer ends on the last key row (no newline)");
  const withNl = ensureTrailingNewline(raw);
  assert.ok(withNl.endsWith("\n"));
  assert.equal(ensureTrailingNewline(withNl), withNl, "idempotent");
  // A quote of interior content still byte-verifies against the newline-terminated doc.
  assert.ok(withNl.includes("The rule caps the START, not the goal."));
});

// ── Q2 (chapter analog): assertChapterReaderDocIntegrity ──────────────────────

test("Q2 chapter recount counts question lines above + key rows below the ANSWER KEY header", () => {
  const doc = ensureTrailingNewline(renderChapterReaderDoc(fixtureChapter()));
  assert.equal(chapterDocQuestionLineCount(doc), 3);
  const rows = chapterDocKeyRowLines(doc);
  assert.deepEqual([...rows.keys()].sort((a, b) => a - b), [1, 2, 3]);
  assert.ok(rows.get(3)! > 0);
});

test("Q2 chapter integrity passes on a complete doc and THROWS on truncation / missing newline", () => {
  const ch = fixtureChapter();
  const doc = ensureTrailingNewline(renderChapterReaderDoc(ch));
  assert.doesNotThrow(() => assertChapterReaderDocIntegrity(doc, ch));

  const truncated = doc.replace(/\nQ3: c[^\n]*\n$/, "\n"); // drop the last answer-key row
  assert.throws(() => assertChapterReaderDocIntegrity(truncated, ch), (e: unknown) => {
    assert.ok(e instanceof DocIntegrityError);
    assert.match((e as Error).message, /2 answer-key row\(s\) vs 3/);
    return true;
  });

  const noNewline = doc.replace(/\n$/, "");
  assert.throws(() => assertChapterReaderDocIntegrity(noNewline, ch), (e: unknown) => {
    assert.ok(e instanceof DocIntegrityError);
    assert.match((e as Error).message, /trailing newline/);
    return true;
  });
});

// ── Q3 (chapter analog): screenChapterStructuralClaims + adjudicateReview ─────

test("Q3 chapter: a no-ship reader's disproven 'key omits Q3' claim invalidates the vote", () => {
  const ch = fixtureChapter();
  const doc = ensureTrailingNewline(renderChapterReaderDoc(ch));
  const parsed = goodParsed({
    ship84: false,
    quizDerivation: { answers: ["a", "b", "c"], keyDisagreements: ["The answer key omits Q3."], tells: [] },
  });
  const review = adjudicateReview(parsed, doc, ch, { bar: 84, reviewerSessionId: "s-fail" });
  assert.equal(review.valid, false, "disproven structural claim invalidates → respawn-eligible");
  assert.ok(review.structuralScreen);
  assert.equal(review.structuralScreen!.decisions[0].verdict, "disproven");
  assert.equal(review.structuralScreen!.decisions[0].q, 3);
  assert.match(review.structuralScreen!.invalidatedBy!, /Q3 key row present/);
});

test("Q3 chapter: a CONFIRMED claim (Q genuinely unkeyed) throws DocIntegrityError", () => {
  const ch = fixtureChapter();
  const doc = ensureTrailingNewline(renderChapterReaderDoc(ch)).replace(/\nQ3: c[^\n]*\n$/, "\n");
  const parsed = goodParsed({ ship84: false, quizDerivation: { answers: ["a", "b", "c"], keyDisagreements: ["The answer key omits Q3."], tells: [] } });
  assert.throws(() => adjudicateReview(parsed, doc, ch, { bar: 84 }), (e: unknown) => {
    assert.ok(e instanceof DocIntegrityError);
    assert.match((e as Error).message, /CONFIRMED by recount: Q3/);
    return true;
  });
});

test("Q3 chapter: fuzzy claim, a ship-yes reader, and an honest no-ship are NO-OPs", () => {
  const ch = fixtureChapter();
  const doc = ensureTrailingNewline(renderChapterReaderDoc(ch));
  // ship84 true → never screened (no structural veto raised).
  const shipYes = screenChapterStructuralClaims(goodParsed({ ship84: true, quizDerivation: { answers: ["a"], keyDisagreements: ["the key omits Q3"], tells: [] } }), doc);
  assert.equal(shipYes.claimsScanned, 0);
  // No-ship but no specific question number → NO-OP.
  const fuzzy = adjudicateReview(goodParsed({ ship84: false, quizDerivation: { answers: ["a", "b", "c"], keyDisagreements: ["the answer key feels incomplete"], tells: [] } }), doc, ch, { bar: 84 });
  assert.equal(fuzzy.valid, true, "byte-verified quotes + fuzzy claim → still a valid (no-ship) vote");
  assert.equal(fuzzy.structuralScreen!.claimsScanned, 0);
});
