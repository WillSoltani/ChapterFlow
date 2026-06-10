/**
 * Defect-corpus tests: every known shipped-incident class gets a synthetic
 * reproduction, and the suite asserts the gates CATCH it.
 *
 * The pair at the heart of this file (AS7 alive vs AS5 dead) reproduces the
 * 2026-06-09 review's headline finding: AS7 matches cards POSITIONALLY so it
 * works for any id convention, while AS5/AS6 match quizzes by exact
 * questionId equality — and 16 of 17 on-disk questionId conventions are
 * chapter-scoped, so AS5/AS6 currently compare nothing.
 */

import assert from "node:assert/strict";

import { checkIntraBookCardSimilarity } from "../src/critics/intraBookFieldSimilarity.js";
import { checkIntraBookQuizSimilarity } from "../src/critics/intraBookQuizSimilarity.js";
import { runBookGate } from "../src/critics/bookGate.js";
import { test, xfail } from "./harness.js";
import { makeChapter } from "./helpers.js";

// ── Incident: unreasonable-hospitality — identical card backs, 20 chapters ──

test("AS7 catches identical card backs across siblings (UH incident class)", () => {
  const book = "zz-fixture-uh";
  const ch1 = makeChapter(book, 1);
  const ch2 = makeChapter(book, 2);
  const ch3 = makeChapter(book, 3, {
    overrides: { reviewCards: structuredClone(ch1.reviewCards) },
  });
  const findings = checkIntraBookCardSimilarity(ch3, [ch1, ch2]);
  assert.ok(
    findings.some((f) => f.checkId.startsWith("AS7")),
    `expected AS7 blocker for verbatim card reuse, got: ${JSON.stringify(findings.map((f) => f.checkId))}`,
  );
});

test("AS7 stays quiet for genuinely varied cards (no false positive)", () => {
  const book = "zz-fixture-uh-clean";
  const findings = checkIntraBookCardSimilarity(makeChapter(book, 3), [
    makeChapter(book, 1),
    makeChapter(book, 2),
  ]);
  assert.deepEqual(findings, [], `AS7 false positive on disjoint-vocabulary chapters: ${JSON.stringify(findings.map((f) => f.checkId))}`);
});

// ── Incident: Covey/rich-dad quiz template substitution (AS5) ───────────────

test("AS5 catches a verbatim quiz copy when questionIds align (plain q01.. convention)", () => {
  const book = "zz-fixture-as5-alive";
  const ch1 = makeChapter(book, 1, { questionIdStyle: "plain" });
  const ch3 = makeChapter(book, 3, { questionIdStyle: "plain" });
  // Plant the defect: ch3 reuses ch1's prompts wholesale (ids stay positional).
  ch3.quiz.questions = ch3.quiz.questions.map((q, i) => ({
    ...q,
    prompt: ch1.quiz.questions[i].prompt,
  }));
  const findings = checkIntraBookQuizSimilarity(ch3, [ch1]);
  assert.ok(
    findings.some((f) => f.checkId.startsWith("AS5")),
    `expected AS5 blocker for verbatim prompt reuse, got: ${JSON.stringify(findings.map((f) => f.checkId))}`,
  );
});

xfail(
  "AS5 catches the same verbatim quiz copy under chapter-scoped questionIds (the dominant on-disk convention)",
  "VERIFIED DEAD PATH: AS5/AS6 match by exact questionId equality (intraBookQuizSimilarity.ts:76-78); chapter-scoped ids (<bookId>-chNN-qNN, 16 of 17 on-disk conventions) never collide across chapters, so the critics compare nothing — Phase 1: switch to positional matching + add a questionId-format invariant",
  () => {
    const book = "zz-fixture-as5-dead";
    const ch1 = makeChapter(book, 1, { questionIdStyle: "scoped" });
    const ch3 = makeChapter(book, 3, { questionIdStyle: "scoped" });
    ch3.quiz.questions = ch3.quiz.questions.map((q, i) => ({
      ...q,
      prompt: ch1.quiz.questions[i].prompt, // same defect as the alive test
    }));
    const findings = checkIntraBookQuizSimilarity(ch3, [ch1]);
    assert.ok(
      findings.some((f) => f.checkId.startsWith("AS5")),
      "identical defect as the alive test, but invisible under scoped ids",
    );
  },
);

// ── Incident: HWF — protagonist name reused across chapters (F1) ────────────

test("book-gate F1 catches a recurring protagonist reused across chapters", () => {
  const book = "zz-fixture-f1";
  const chapters = [1, 2, 3].map((n) => {
    const ch = makeChapter(book, n);
    // A "real protagonist" = named ≥2× within one scenario; reuse her in every chapter.
    ch.examples[0].scenario =
      `Margaux stared at the morning report and saw the totals drift apart. ` +
      `By noon Margaux had traced the gap to a skipped reconciliation step, and she ` +
      `wrote the missing check into the team's opening routine before the next shift began. ` +
      `The fix held through the end of the month.`;
    return ch;
  });
  const report = runBookGate(book, chapters);
  const f1 = report.findings.filter((f) => f.catalogId === "F1");
  assert.ok(
    f1.length > 0,
    `expected an F1 finding for 'Margaux' recurring in 3 chapters; findings: ${JSON.stringify(report.findings.map((f) => f.catalogId))}`,
  );
});
