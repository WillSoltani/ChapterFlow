/**
 * C35 — lineage-key quiz (CF-I-1). A quiz KEY rewards naming/citing the source lineage
 * ("Tie the move to Getting to Yes … so the frame is traceable") over applying the idea,
 * with the explanation reinforcing lineage/traceable/checkable (multipliers ch08, report
 * §7.3.2). Flags the KEY only — a source-citing DISTRACTOR is fine.
 *
 * Calibration contract: a lineage KEY (+ reinforcing explanation) FIRES; an application key
 * is SPARED; a source-citing DISTRACTOR is SPARED (only the key is inspected); a lineage-shaped
 * key WITHOUT a reinforcing explanation is SPARED; the corpora are pinned at MEASURED counts.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, labelCleanCorpusChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import { questionKeysOnLineage, findLineageKeyQuestions, checkLineageKeyQuiz } from "../src/critics/lineageKeyQuiz.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

const LINEAGE_Q1 = {
  questionId: "q01",
  prompt: "A neighborhood mediator borrows this negotiation move for a rent dispute. What has to travel with the move?",
  choices: [
    "Tie the move to Getting to Yes and its named authors, Roger Fisher and William Ury, so the frame is traceable.",
    "Ask for the interest under the demand before hardening the counter-position.",
    "Insist on rank so the tactic sounds approved.",
  ],
  correctIndex: 0,
  explanation: "The source lineage matters here. Rank can make a tactic sound approved, but Fisher and Ury make the negotiation frame checkable instead of generic.",
};
const LINEAGE_Q2 = {
  questionId: "q04",
  prompt: "A mentor wants to teach how-questions under pressure. What keeps the tactic from sounding like jargon?",
  choices: [
    "Practise the question on a real constraint before the next meeting.",
    "Call it a common habit everyone already uses.",
    "Name Chris Voss and his FBI negotiation experience as the lineage behind the tactic.",
  ],
  correctIndex: 2,
  explanation: "Voss's FBI negotiation background gives the tactic a real source. Calling it a common habit makes it sound easy, but it loses the lineage the fact supplies.",
};

function chapterWithQuestions(questions: any[]): ChapterV21 {
  return { number: 1, quiz: { passingScorePercent: 70, questions } } as unknown as ChapterV21;
}

// ── The pure per-question detector ────────────────────────────────────────────

test("C35: questionKeysOnLineage fires when the KEY cites lineage AND the explanation reinforces it", () => {
  assert.equal(questionKeysOnLineage(LINEAGE_Q1), true);
  assert.equal(questionKeysOnLineage(LINEAGE_Q2), true);
});

test("C35: questionKeysOnLineage SPARES an application key", () => {
  const appQ = {
    ...LINEAGE_Q1,
    choices: ["Ask for the interest under the demand before hardening the counter-position.", "Tie the move to Getting to Yes so the frame is traceable.", "Insist on rank."],
    correctIndex: 0,
    explanation: "The applied move is to surface the interest first; naming the source is not the tested skill here.",
  };
  assert.equal(questionKeysOnLineage(appQ), false, "the KEY tests application; a lineage DISTRACTOR is fine");
});

test("C35: questionKeysOnLineage SPARES a lineage-shaped key with NO reinforcing explanation", () => {
  const q = { ...LINEAGE_Q1, explanation: "Because surfacing the interest is what actually moves the negotiation forward under pressure." };
  assert.equal(questionKeysOnLineage(q), false, "requires BOTH key-citation and explanation reinforcement");
});

// ── The chapter-level critic ──────────────────────────────────────────────────

const APPLICATION_Q = {
  questionId: "q02",
  prompt: "A team lead sees a demand harden into a status fight. What is the best next move?",
  choices: [
    "Surface the interest under the demand before hardening the counter-position.",
    "Escalate to rank so the decision sticks.",
    "Restate the demand louder to win the exchange.",
  ],
  correctIndex: 0,
  explanation: "Surfacing the interest keeps the useful facts in play instead of turning pressure into a personality fight.",
};

test("C35 fires ONCE per chapter and lists the offending question ids (multipliers ch08 shape)", () => {
  const ch = chapterWithQuestions([LINEAGE_Q1, APPLICATION_Q, LINEAGE_Q2]);
  assert.deepEqual(findLineageKeyQuestions(ch), [0, 2]);
  const findings = checkLineageKeyQuiz(ch);
  assert.equal(findings.length, 1, "one advisory per chapter");
  assert.equal(findings[0].severity, "minor", "ADVISORY — never blocks");
  assert.match(findings[0].message, /NAMING\/CITING the source lineage/);
  assert.match(findings[0].message, /q01, q04/);
});

test("C35 is silent when only a DISTRACTOR cites the source", () => {
  const q = {
    ...LINEAGE_Q1,
    choices: ["Ask for the interest under the demand first.", "Tie the move to Getting to Yes so the frame is traceable.", "Insist on rank so it sounds approved."],
    correctIndex: 0,
    explanation: "Surfacing the interest is the applied skill; the source distractor is a plausible miss about lineage.",
  };
  assert.equal(checkLineageKeyQuiz(chapterWithQuestions([q])).length, 0);
});

// ── Ship-gate wiring + severity ───────────────────────────────────────────────

test("C35: the ship gate surfaces the lineage key as a minor (wiring + severity)", () => {
  const ch = makeChapter("zz-c35-gate", 4);
  ch.quiz.questions[0].choices = [
    "Tie the move to Getting to Yes and its named authors, so the frame is traceable to a real source.",
    ch.quiz.questions[0].choices[1],
    ch.quiz.questions[0].choices[2],
  ];
  ch.quiz.questions[0].correctIndex = 0;
  ch.quiz.questions[0].explanation = "The source lineage matters here: naming the authors makes the frame checkable instead of generic.";
  const report = runShipGate(ch);
  assert.ok(report.minors.some((m) => m.catalogId === "C35.lineage_key_quiz"), `expected a C35 minor; got ${report.minors.map((m) => m.catalogId).join(", ")}`);
  assert.ok(!report.blockers.some((b) => b.catalogId === "C35.lineage_key_quiz"), "C35 must never be a blocker");
});

test("C35: an unplanted makeChapter (application keys) is clean", () => {
  assert.equal(checkLineageKeyQuiz(makeChapter("zz-c35-clean", 3)).length, 0);
});

// ── Gold-corpus calibration pins (zero everywhere — the tic is a multipliers residual) ──

test("C35: synthetic gold corpus has ZERO lineage-key findings", () => {
  for (const { bookId, files } of [...goldChapterFiles(), ...labelCleanCorpusChapterFiles()]) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      assert.equal(checkLineageKeyQuiz(ch).length, 0, `C35 false positive on synthetic gold ${bookId} ${ch.chapterId}`);
    }
  }
});

{
  const bookId = "start-with-why";
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`C35 gold pin: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
  } else {
    test(`C35: real gold corpus ${bookId} (${files.length} ch) is ZERO (lineage keys are a multipliers residual)`, () => {
      const firing: string[] = [];
      for (const f of files) {
        const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
        if (checkLineageKeyQuiz(ch).length > 0) firing.push(ch.chapterId);
      }
      assert.equal(firing.length, 0, `C35 gold-corpus pin drifted (expected 0; got ${firing.length}: ${firing.join(", ")})`);
    });
  }
}
