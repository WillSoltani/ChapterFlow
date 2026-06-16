/**
 * BP32 — quiz pronoun/referent drift. Name-swap residue: a `--all` re-dispatch
 * renamed the stem protagonist (a different gender) but the choice pronouns were
 * never updated, so the stem says "she" and the choices answer with "he" (observed
 * on the-daily-stoic ch03 Q4/Q9). The detector fires ONLY on an UNAMBIGUOUS
 * stem-gender vs choice-gender conflict — both sides must each resolve to a single,
 * opposite gender — so a two-person (mixed-pronoun) or no-pronoun question never
 * fires and there is zero name→gender guessing. These tests pin both halves: it
 * CATCHES the conflict and does NOT false-positive on aligned, mixed, or pronoun-free
 * questions, nor on the clean corpus.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { test, skip } from "./harness.js";
import { labelCleanCorpusChapterFiles } from "./helpers.js";
import { checkQuizPronounReferent } from "../src/critics/quizQuality.js";
import type { ChapterV21, QuizV21 } from "../src/types.js";

function quizOf(...questions: { prompt: string; choices: string[]; correctIndex?: number }[]): QuizV21 {
  return {
    passingScorePercent: 70,
    questions: questions.map((q, i) => ({
      questionId: `q${String(i + 1).padStart(2, "0")}`,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex ?? 0,
    })),
  } as unknown as QuizV21;
}

test("BP32 fires when the stem is female but the choices answer with male pronouns", () => {
  // the-daily-stoic ch03 Q4 shape: stem "Selma … how patient she looked" / choices "He should…".
  const quiz = quizOf({
    prompt: "Selma drafts a post about her hard deli shift, but the note mostly proves how patient she looked. What should she do first?",
    choices: [
      "He should use the note to correct his motive before making it public.",
      "He should post the note if it proves he handled the shift with restraint.",
      "He should polish the note until the chat sees him as reflective.",
    ],
    correctIndex: 0,
  });
  const f = checkQuizPronounReferent(quiz);
  assert.equal(f.length, 1, JSON.stringify(f));
  assert.equal(f[0].checkId, "BP32.quiz_pronoun_referent_mismatch");
  assert.equal(f[0].severity, "major");
});

test("BP32 fires in the other direction (male stem, female choices)", () => {
  const quiz = quizOf({
    prompt: "When the manager dismisses his own plan, what should he reconsider?",
    choices: [
      "She should restate her aim before the meeting starts.",
      "She should defer to her mentor's older plan.",
      "She should keep her original wording unchanged.",
    ],
  });
  assert.equal(checkQuizPronounReferent(quiz).length, 1);
});

test("BP32 does NOT fire when stem and choices share the same gender", () => {
  const quiz = quizOf({
    prompt: "Selma drafts a post about her hard shift; how should she judge it?",
    choices: [
      "She should use the note to correct her motive before posting.",
      "She should post it if it shows she stayed patient.",
      "She should polish it until readers admire her.",
    ],
  });
  assert.deepEqual(checkQuizPronounReferent(quiz), []);
});

test("BP32 does NOT fire on a two-person stem (mixed pronouns → undetermined)", () => {
  // A scene with both a she and a he must never fire — the signal requires each side
  // to resolve to ONE unambiguous gender.
  const quiz = quizOf({
    prompt: "When Mara asks her manager what he should do about the missed block, what is the Stoic move?",
    choices: [
      "He should name the constraint before reacting.",
      "He should blame the schedule and move on.",
      "He should defend the role more strongly.",
    ],
  });
  assert.deepEqual(checkQuizPronounReferent(quiz), []);
});

test("BP32 does NOT fire when the stem names a protagonist but uses no pronoun (known limit — A1 prevents this at source)", () => {
  // ch03 Q1 shape: stem "Hugo's desk…" (no gendered pronoun) with choices "Her…". We
  // deliberately do NOT guess Hugo→male; this stays the model bar's job. Documents the
  // scope: the deterministic net catches the stem-vs-choice conflict, not name→pronoun.
  const quiz = quizOf({
    prompt: "A log from Hugo's after-school desk shows three sharp replies, each sent after a parent sounded annoyed. What does clarity require?",
    choices: [
      "Her conduct begins earlier than the reply, in the impulse she did not inspect.",
      "Her good habits will handle the desk once she stops reviewing small replies.",
      "Her next shift should rely on a warmer script so the habit runs without review.",
    ],
  });
  assert.deepEqual(checkQuizPronounReferent(quiz), []);
});

test("BP32 does NOT fire on a pronoun-free question", () => {
  const quiz = quizOf({
    prompt: "Two planners miss the same calendar block. Which response inspects the dodge?",
    choices: [
      "It reads the miss as a stress cue that needs a calmer body.",
      "It treats the skipped block as proof the schedule was too tight.",
      "It watches what the mind wanted and avoided before the dodge.",
    ],
  });
  assert.deepEqual(checkQuizPronounReferent(quiz), []);
});

// ── Clean-corpus calibration: ZERO across the verified-clean + gold corpus.
for (const { bookId, files } of labelCleanCorpusChapterFiles()) {
  if (files.length === 0) {
    skip(`clean corpus: ${bookId} BP32 stays zero`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`clean corpus: ${bookId} — BP32 emits ZERO across ${files.length} chapters`, () => {
    const chapters = files.map((file) => JSON.parse(readFileSync(file, "utf8")) as ChapterV21);
    const hits = chapters.flatMap((ch) =>
      checkQuizPronounReferent(ch.quiz).map((f) => `${ch.chapterId}: ${f.message}`),
    );
    assert.deepEqual(hits, [], `BP32 false-positive on ${bookId}`);
  });
}
