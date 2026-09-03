/**
 * QUIZ + CARD PEDAGOGY REDESIGN (package 1B items f-j; register R-068, R-069,
 * R-070, R-073, R-283).
 *
 * Five checks, each measured on the live Franklin rev-6 candidate
 * (candidates/repair-r7-candidate-88b631ed39a56eb62937d07df3bd0f72):
 *
 *  SEC117 TRANSFER — counted `bloomsLevel ∈ {apply,…}` OR a scenario cue in the
 *    stem, so a metadata STRING satisfied the floor. All 36 rev-6 questions
 *    qualified; 23 of them on the label alone with no cue anywhere in the stem, and
 *    the fresh six-reader panel scored quizzes 63 and transfer 71 on those same
 *    bytes. Transfer is now measured on the STEM'S OWN CUE WORDS. Per chapter the
 *    cue-only counts are 3/9, 3/9, 1/9, 6/9 against a floor of 6, so three of the
 *    four rev-6 chapters now fail a floor they used to clear on a label.
 *  SEC125 (advisory) — the label is still checked for validity and now also reported
 *    when it CLAIMS apply-level and the stem carries no cue, because the catalog
 *    rubric (score.py) still counts that label as transfer.
 *  SEC116 DISTRACTOR TELL — pedagogyThresholds states the rubric goal as "< 20%
 *    book-wide" and then set a budget of 2 per chapter, conceding in its own comment
 *    that "2/9 tells = 22% — just above" it, and shipped ADVISORY. rev-6 measured
 *    2/9, 1/9, 2/9, 3/9 = 22.2% book-wide and only ch04 tripped the advisory. The
 *    budget is now the rubric's own number: above 20% of a chapter's questions blocks.
 *  SEC52 ABSOLUTES — the strawman-absolute rule skipped the KEYED choice
 *    (`if (choiceIndex === q.correctIndex) continue`). Measured on the 36 rev-6
 *    questions: absolutes in 3 keys and 0 of 72 distractors. Now symmetric, with the
 *    same prose carve-out applied to all three choices.
 *  SEC134 QUALIFIER PARITY (advisory) — 14 of 36 rev-6 keys (39%) carry an
 *    "only"/"not" boundary qualifier against 7 of 72 distractors (10%). Per chapter
 *    the key:distractor rate ratios are 4.0x, 5.0x, (1 key only), 2.7x.
 *  SEC132 OPENER SIGNATURES — no gate compared card fronts, card backs or quiz stems
 *    WITHIN a chapter (SEC81 is cross-chapter, word-set based at 0.75, and the
 *    highest intra-chapter card-back similarity in rev-6 is 0.42, so it could not
 *    fire). Three identical openers in one chapter now block. Card backs are
 *    signed by their announcement SHAPE ("The contrast is", "The boundary is", "The
 *    trigger was"), which is how the defect actually presents: 3, 3, 2 and 4 of the
 *    seven backs per rev-6 chapter open that way.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { validateLearningPack, type SectionFinding } from "../src/sections/sectionGate.js";
import { QUIZ_TELL_MAX_RATE_PCT } from "../src/sections/pedagogyThresholds.js";
import type { ChapterBlueprintV1, LearningPackV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";

const CHID = "zz-quiz-ch02";
const EMPTY_PACKET = { allowedAnchors: [], facts: [], namedCases: [] } as unknown as SourcePacketV1;

function byCheck(findings: SectionFinding[], id: string): SectionFinding[] {
  return findings.filter((f) => f.checkId === id);
}

function blueprint(quizCount: number, cardCount = 0): ChapterBlueprintV1 {
  return {
    chapterNumber: 2,
    chapterId: CHID,
    sections: {
      quiz: Array.from({ length: quizCount }, (_, i) => ({ questionId: `q${String(i + 1).padStart(2, "0")}`, correctIndex: 0, depthLevel: "standard" })),
      cards: Array.from({ length: cardCount }, (_, i) => ({ cardId: `rc${String(i + 1).padStart(2, "0")}` })),
    },
    constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
}

type Q = { prompt: string; choices: string[]; correctIndex?: number; blooms?: string };

function pack(questions: Q[], cards: { front: string; back: string }[] = []): LearningPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "learning-pack",
    chapterId: CHID,
    quiz: { passingScorePercent: 70, questions: questions.map((q, i) => ({
      questionId: `q${String(i + 1).padStart(2, "0")}`,
      sourceAnchorIds: [], keyEvidenceAnchorIds: [],
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex ?? 0,
      explanation: "The keyed move changes the visible signal; the wrong choices rely on intention instead.",
      bloomsLevel: q.blooms ?? "apply",
      depthLevel: "standard",
    })) },
    cards: { cards: cards.map((c, i) => ({ cardId: `rc${String(i + 1).padStart(2, "0")}`, sourceAnchorIds: [], front: c.front, back: c.back, difficulty: "easy" })) },
  } as unknown as LearningPackV1;
}

function findings(questions: Q[], cards: { front: string; back: string }[] = [], prose?: SummaryPackV1): SectionFinding[] {
  return validateLearningPack(pack(questions, cards), blueprint(questions.length, cards.length), EMPTY_PACKET, prose);
}

// Choice set with NO tell and NO boundary qualifier: the keyed answer (index 0) is
// not the longest, and none of the three carries only/not/unless/except, so the tell
// and qualifier-parity checks below measure exactly what each test introduces.
const EVEN = [
  "Write the rule down before the moment arrives so the choice is already made.",
  "Wait until the pressure passes and then decide what would have been the better move here.",
  "Ask a colleague to decide for you so the outcome belongs to someone else.",
];
const CUE_STEM = "Suppose you keep missing the same weekly deadline for the third month running. What fixes it?";
const RECALL_STEM = "Which statement best restates the definition of the mechanism given in the reading?";

// ── SEC117 / SEC125 — transfer is measured on the stem (R-069) ───────────────

test("SEC117 no longer counts a bare-recall stem as transfer because its bloomsLevel says apply", () => {
  // The live shape: 9 recall stems, all labelled apply. Under the old rule the
  // metadata string alone cleared the floor of 6.
  const qs: Q[] = Array.from({ length: 9 }, () => ({ prompt: RECALL_STEM, choices: [...EVEN], blooms: "apply" }));
  const transfer = byCheck(findings(qs), "SEC117.quiz_transfer_floor");
  assert.equal(transfer.length, 1, "a quiz of labelled-apply recall stems must fail the transfer floor");
  assert.equal(transfer[0].severity, "blocker");
  assert.match(transfer[0].message, /0\/9/, "the realized cue count is reported");
});

test("SEC117 counts a stem that actually poses a scenario", () => {
  const qs: Q[] = Array.from({ length: 9 }, (_, i) => ({ prompt: i < 7 ? CUE_STEM : RECALL_STEM, choices: [...EVEN], blooms: "remember" }));
  assert.deepEqual(byCheck(findings(qs), "SEC117.quiz_transfer_floor"), [], "7 of 9 cued stems meets the target even with a remember label");
});

test("SEC125 reports the questions whose apply label the stem does not earn", () => {
  const qs: Q[] = Array.from({ length: 9 }, (_, i) => ({ prompt: i < 7 ? CUE_STEM : RECALL_STEM, choices: [...EVEN], blooms: "apply" }));
  const label = byCheck(findings(qs), "SEC125.quiz_metadata").filter((f) => f.severity === "advisory");
  assert.equal(label.length, 1, "the label/stem mismatch must be reported");
  assert.match(label[0].message, /q08, q09/, "and must name the questions");
  assert.match(label[0].message, /rubric/i, "and say why it matters: the catalog rubric counts the label");
});

// ── SEC116 — the tell budget is the rubric's own 20% (R-070) ─────────────────

const TELL_CHOICES = [
  "This deliberately longer keyed answer carries far more characters than either distractor option does here today.",
  "A short plausible distractor.",
  "Another short plausible distractor.",
];

function withTells(count: number, total = 9): Q[] {
  return Array.from({ length: total }, (_, i) => ({ prompt: CUE_STEM, choices: i < count ? [...TELL_CHOICES] : [...EVEN] }));
}

test("SEC116 blocks a chapter above the rubric's 20% distractor-tell rate", () => {
  assert.equal(QUIZ_TELL_MAX_RATE_PCT, 20);
  const tell = byCheck(findings(withTells(2)), "SEC116.quiz_distractor_tell");
  assert.equal(tell.length, 1, "2 of 9 = 22.2% is above the rubric goal the file already cites");
  assert.equal(tell[0].severity, "blocker", "the budget the rubric states is a budget, not a shadow");
  assert.match(tell[0].message, /22\.2%/);
  assert.match(tell[0].message, /q01/, "the offending questionIds are named");
});

test("SEC116 stays silent at or below 20%", () => {
  assert.deepEqual(byCheck(findings(withTells(1)), "SEC116.quiz_distractor_tell"), [], "1 of 9 = 11.1% is inside the budget");
  assert.deepEqual(byCheck(findings(withTells(2, 10)), "SEC116.quiz_distractor_tell"), [], "2 of 10 = 20.0% is exactly at the budget");
});

// ── SEC52 — absolutes are symmetric between key and distractors (R-068) ──────

const ABSOLUTE_KEY = "Falling short still counts as worthwhile only if the practice produced real improvement, never because effort was spent.";

test("SEC52 now fires on an absolute in the KEYED choice", () => {
  const qs: Q[] = [{ prompt: CUE_STEM, choices: [ABSOLUTE_KEY, EVEN[1], EVEN[2]], correctIndex: 0 }];
  const strawman = byCheck(findings(qs), "SEC52.quiz_strawman_distractor");
  assert.equal(strawman.length, 1, "an absolute in the key is a bigger tell than one in a distractor");
  assert.equal(strawman[0].severity, "blocker");
  assert.match(strawman[0].message, /choice 0/);
});

test("SEC52's prose carve-out applies to the key exactly as it applies to a distractor", () => {
  const prose = {
    hook: { hook: "A man who never arrived at the perfection he aimed at kept the ledger anyway." },
    breakdown: {
      fastRead: "He never arrived at the perfection he aimed at, and he kept the ledger anyway for years.",
      deepRead: "The record never stopped, which is the point: the habit outlived the ambition that started it.",
      fullRead: "Nothing in the scheme promised perfection, and he said so plainly when he wrote it down later.",
    },
    keyTakeaway: "Keep the record even when the goal is out of reach.",
  } as unknown as SummaryPackV1;
  const qs: Q[] = [{ prompt: CUE_STEM, choices: [ABSOLUTE_KEY, EVEN[1], EVEN[2]], correctIndex: 0 }];
  assert.deepEqual(byCheck(findings(qs, [], prose), "SEC52.quiz_strawman_distractor"), [], "an absolute the chapter's own prose uses is not a strawman, in any choice");
});

// ── SEC134 — qualifier parity (R-283) ────────────────────────────────────────

test("SEC134 advises when the keys carry the boundary qualifier and the distractors do not", () => {
  // The live rev-6 ch02 rate: 5 of 9 keys carry only/not, 2 of 18 distractors do.
  const qualifiedKey = "It still counts only when the practice produced a measurable change, not when effort alone was spent.";
  const qs: Q[] = Array.from({ length: 9 }, (_, i) => ({
    prompt: CUE_STEM,
    choices: i < 5 ? [qualifiedKey, EVEN[1], EVEN[2]] : [...EVEN],
    correctIndex: 0,
  }));
  const parity = byCheck(findings(qs), "SEC134.quiz_qualifier_parity");
  assert.equal(parity.length, 1);
  assert.equal(parity[0].severity, "advisory", "shape parity is guidance until the contract has steered it");
  assert.match(parity[0].message, /5\/9/);
});

test("SEC134 stays silent when distractors carry the qualifier at the same rate", () => {
  const qualifiedKey = "It still counts only when the practice produced a measurable change, not when effort alone was spent.";
  const qualifiedDistractor = "It counts only when someone else noticed the change, not when the record shows it.";
  const qs: Q[] = Array.from({ length: 9 }, (_, i) => ({
    prompt: CUE_STEM,
    choices: i < 5 ? [qualifiedKey, qualifiedDistractor, EVEN[2]] : [...EVEN],
    correctIndex: 0,
  }));
  assert.deepEqual(byCheck(findings(qs), "SEC134.quiz_qualifier_parity"), []);
});

test("SEC134 does not fire on one or two qualified keys", () => {
  const qualifiedKey = "It still counts only when the practice produced a measurable change, not when effort alone was spent.";
  const qs: Q[] = Array.from({ length: 9 }, (_, i) => ({ prompt: CUE_STEM, choices: i < 2 ? [qualifiedKey, EVEN[1], EVEN[2]] : [...EVEN], correctIndex: 0 }));
  assert.deepEqual(byCheck(findings(qs), "SEC134.quiz_qualifier_parity"), [], "two of nine is a shape, not a signature");
});

// ── SEC132 — opener signatures inside one chapter (R-073) ────────────────────

/** Live rev-6 card backs, verbatim: three of ch01's seven open on the scaffold. */
const SCAFFOLD_BACKS = [
  "The contrast is stark: no backup fund existed, and travel costs had already eaten the margin before the trip began.",
  "The boundary is completion of the term: leaving before a nine-year term ends breaks the bond that paid for the training.",
  "The trigger is discovery itself: once authorship came out, praise turned to resentment rather than pride.",
];
const CONCRETE_BACKS = [
  "Two print shops, no more, made up the whole local trade the day the boots hit the street with one coin left.",
  "Notice that the term was fixed at the very start of the bond so the master could recover years of training costs.",
  "Mistaking a one-sided sighting for a real relationship is the failure mode worth naming here for the reader.",
  "A handwriting sample is the concrete image: a copy of a fine engraved model never matches the model itself.",
];
const FRONTS = [
  "What failure mode leads someone to credit polished writing to schooling?",
  "Where does the bond stop protecting the apprentice?",
  "Which signal turns praise into resentment?",
  "What did the first purchase decide?",
  "How many print shops made up the trade?",
  "When does a sighting count as a relationship?",
  "Why does a copied model never match the original?",
];

test("SEC132 blocks three card backs in one chapter that open on the same announcement shape", () => {
  const cards = FRONTS.map((front, i) => ({ front, back: [...SCAFFOLD_BACKS, ...CONCRETE_BACKS][i] }));
  const opener = byCheck(findings([], cards), "SEC132.chapter_opener_signature");
  assert.equal(opener.length, 1, "three scaffolded backs in seven is the rev-6 ch01 rate");
  assert.equal(opener[0].severity, "blocker");
  assert.match(opener[0].message, /card back/i);
});

test("SEC132 leaves two scaffolded backs alone (the rev-6 ch03 rate)", () => {
  const backs = [...SCAFFOLD_BACKS.slice(0, 2), ...CONCRETE_BACKS, CONCRETE_BACKS[0]];
  const cards = FRONTS.map((front, i) => ({ front, back: backs[i] }));
  assert.deepEqual(byCheck(findings([], cards), "SEC132.chapter_opener_signature"), [], "two is a coincidence, three is a signature");
});

test("SEC132 blocks three quiz stems in one chapter that open on the same three words", () => {
  const qs: Q[] = [
    { prompt: "Which of the following best explains why the record outlived the ambition?", choices: [...EVEN] },
    { prompt: "Which of the following best explains why the ledger kept its value?", choices: [...EVEN] },
    { prompt: "Which of the following best explains why the habit survived the goal?", choices: [...EVEN] },
    { prompt: CUE_STEM, choices: [...EVEN] },
  ];
  const opener = byCheck(findings(qs), "SEC132.chapter_opener_signature");
  assert.equal(opener.length, 1);
  assert.equal(opener[0].severity, "blocker");
  assert.match(opener[0].message, /quiz stem/i);
  assert.match(opener[0].message, /which of the/i, "the message quotes the repeated opener");
});
