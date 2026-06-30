/**
 * BP31 — uniform Title-Case quiz choice labels (the quiz_distractor_quality
 * valence-telegraph). The detector fires ONLY on the deterministically-separable
 * lexical signal: a question where EVERY choice wears a Title-Case "Label:" tag.
 * Calibration (measured on disk): ZERO all-Title-Case-labelled questions across
 * the verified-clean + gold corpus; 54/108 on the-daily-stoic. These tests pin
 * BOTH halves — it CATCHES the uniform-label form and does NOT false-positive on
 * plain prose, asymmetric labels, the inline lowercase-tag form, or the clean
 * corpus.
 *
 * The committed fires-on-defect assertions are SYNTHETIC (stable regardless of
 * the on-disk the-daily-stoic content, which the fix regenerates clean).
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { test, skip } from "./harness.js";
import { makeChapter, labelCleanCorpusChapterFiles } from "./helpers.js";
import { checkQuizChoiceLabelUniform } from "../src/critics/quizQuality.js";
import { checkBookQuizChoiceLabelUniform } from "../src/critics/bookRepetition.js";
import { isWriteBarrierActionable, type BookGateFinding } from "../src/critics/bookGate.js";
import type { ChapterV21, QuizV21 } from "../src/types.js";

function quizOf(...questions: { choices: string[]; correctIndex?: number }[]): QuizV21 {
  return {
    passingScorePercent: 70,
    questions: questions.map((q, i) => ({
      questionId: `q${String(i + 1).padStart(2, "0")}`,
      prompt: "Which move fits the chapter's idea?",
      choices: q.choices,
      correctIndex: q.correctIndex ?? 0,
    })),
  } as unknown as QuizV21;
}

test("BP31 fires when EVERY choice wears a Title-Case label", () => {
  const quiz = quizOf({
    choices: [
      "Private Self-Governance: the note trains his conduct before it manages any image.",
      "Audience Craft: the note is a polished lesson meant to impress later readers.",
      "Status Proof: the note matters because an emperor's public image needed care.",
    ],
    correctIndex: 0,
  });
  const f = checkQuizChoiceLabelUniform(quiz);
  assert.equal(f.length, 1, JSON.stringify(f));
  assert.equal(f[0].checkId, "BP31.quiz_choice_label_uniform");
  assert.equal(f[0].severity, "major");
});

test("BP31 fires on single-word and hyphenated Title-Case labels too", () => {
  assert.equal(checkQuizChoiceLabelUniform(quizOf({
    choices: ["Comfort-Origin: she blames the setback.", "Constraint-Agency: she names one move.", "Status-Cure: she chases approval."],
  })).length, 1);
});

test("BP31 does NOT fire on plain-prose choices (the clean / GOOD pattern)", () => {
  const quiz = quizOf({
    choices: [
      "They prove the inventory can stay practical because habits are already controlled.",
      "They show the ban extends proven habit change rather than replacing prior progress.",
      "They make the first month a budgeting exercise with little connection to skills.",
    ],
    correctIndex: 1,
  });
  assert.deepEqual(checkQuizChoiceLabelUniform(quiz), []);
});

test("BP31 does NOT fire on the ASYMMETRIC form (key plain, distractors labelled)", () => {
  // ch02's "The Stone-Face mistake:" form: NOT separable deterministically
  // (clean unreasonable-hospitality carries 26 such) → left to the bar + prompt.
  const quiz = quizOf({
    choices: [
      "The Stone-Face mistake: train yourself to feel nothing at all.",
      "Patrice should keep concern intact while refusing a destructive passion.",
      "The Floodgate mistake: let every feeling steer the reply.",
    ],
    correctIndex: 1,
  });
  assert.deepEqual(checkQuizChoiceLabelUniform(quiz), [], "inline lowercase-tag form is not the all-Title-Case signal");
});

test("BP31 does NOT fire on a stray dialogue colon in one choice", () => {
  const quiz = quizOf({
    choices: ["She said: wait for the heat to pass.", "He answered the email at once.", "They argued for an hour."],
  });
  assert.deepEqual(checkQuizChoiceLabelUniform(quiz), []);
});

test("BP31 book-wide names exactly the chapters carrying a uniform-labelled question", () => {
  const labelled = [
    "Withdrawal Lens: he reads the slight as proof to retreat.",
    "Cooperation Lens: he treats the role in front of him as the task.",
    "Approval Lens: he serves the crowd that wants comfort.",
  ];
  const chapters: ChapterV21[] = [1, 2, 3, 4, 5].map((n) => {
    const ch = makeChapter("zz-fixture-bp31", n);
    if (n === 2 || n === 4) ch.quiz.questions[0].choices = labelled;
    return ch;
  });
  const findings = checkBookQuizChoiceLabelUniform(chapters);
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.deepEqual(findings[0].chapters, [2, 4]);
  assert.equal(findings[0].checkId, "BP31.quiz_choice_label_uniform");
});

test("BP31 is write-barrier ACTIONABLE (re-dispatched before QC), alongside BP28/29/30 + blockers", () => {
  const mk = (catalogId: string, severity: BookGateFinding["severity"]): BookGateFinding => ({ catalogId, severity, message: "", evidence: "", chapters: [1] });
  // The fix: a BP31 shadow major must trigger a targeted write-barrier re-dispatch
  // so the writer re-authors the labelled quiz BEFORE handing off to QC.
  assert.equal(isWriteBarrierActionable(mk("BP31.quiz_choice_label_uniform", "major")), true, "BP31 must be barrier-actionable");
  // Parity with its sibling shadow majors and with hard blockers.
  assert.equal(isWriteBarrierActionable(mk("BP28.callback_frame_reuse", "major")), true);
  assert.equal(isWriteBarrierActionable(mk("BP29.timing_anchor_stamping", "major")), true);
  assert.equal(isWriteBarrierActionable(mk("BP30.action_container_reuse", "major")), true);
  assert.equal(isWriteBarrierActionable(mk("F1.cross_chapter_dup", "blocker")), true);
  // A non-listed major (a per-chapter check, not a book-wide structural-sameness
  // detector) does NOT trigger barrier re-dispatch.
  assert.equal(isWriteBarrierActionable(mk("BP15.quiz_strawman_distractor", "major")), false, "an un-listed major must not trigger barrier re-dispatch");
  assert.equal(isWriteBarrierActionable(mk("schema.quiz_lowercase_choice_start", "minor")), false);
});

// ── Clean-corpus calibration: ZERO across the verified-clean + gold corpus.
for (const { bookId, files } of labelCleanCorpusChapterFiles()) {
  if (files.length === 0) {
    skip(`clean corpus: ${bookId} BP31 stays zero`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`clean corpus: ${bookId} — BP31 emits ZERO across ${files.length} chapters (per-chapter and book-wide)`, () => {
    const chapters = files.map((file) => JSON.parse(readFileSync(file, "utf8")) as ChapterV21);
    const perChapter = chapters.flatMap((ch) =>
      checkQuizChoiceLabelUniform(ch.quiz).map((f) => `${ch.chapterId}: ${f.message}`),
    );
    assert.deepEqual(perChapter, [], `BP31 per-chapter false-positive on ${bookId}`);
    assert.deepEqual(
      checkBookQuizChoiceLabelUniform(chapters).map((f) => f.chapters.join(",")),
      [],
      `BP31 book-wide false-positive on ${bookId}`,
    );
  });
}
