/**
 * ADJUDICATING THE PANEL'S BLIND QUIZ DERIVATION (R-131, R-135).
 *
 * The reader-panel prompt makes derivation the headline task - "Answer its quiz
 * YOURSELF from the prose. This document contains NO answer key - your
 * derivation IS the review's key evidence" - and every seat returns one
 * (`ReaderExperienceReviewV1.quizDerivation`, positional with the questions,
 * with a per-question confidence). Until this module, `aggregateReaderPanel`
 * copied three buckets out of each seat review and threw the derivation away
 * (laneOrchestrator.ts:412), so the ONE signal in the pipeline capable of
 * catching a wrong answer key from readers who never saw the key was computed
 * three times per chapter and discarded three times per chapter.
 *
 * WHAT IT DECIDES, and why the line is where it is.
 *
 *   - A STRICT MAJORITY of seats derive the SAME answer, that answer is not the
 *     key, and every one of those seats says HIGH confidence -> BLOCKER
 *     `READER.BLOCKING.structurally_invalid` on that question. Independent
 *     readers, blind to the key, confidently agreeing on a different answer is
 *     the strongest on-page evidence available that the question does not work
 *     as keyed. It stays inside the reader lane's authority: this is a claim
 *     about the QUESTION, decidable from the page, not a claim about the world.
 *   - ANY OTHER disagreement - one seat, or a majority that is not unanimous in
 *     confidence, or any low/medium-confidence dissent -> WARN
 *     `READER.PANEL.QUIZ_DERIVATION_SPLIT`, which the fresh-QC lane reads and
 *     hands to the answer-key judge as a FLAGGED question. R-135's finding was
 *     that the ambiguous questions are exactly the bad ones, so the weaker
 *     signal is routed, never dropped.
 *
 * Requiring every majority seat to be high-confidence (rather than, say, a
 * majority of the high-confidence seats) is deliberate: a blocker minted here
 * fails the whole canonical review, and a two-of-three split where one seat
 * hedged is precisely the case the key judge should settle with the source in
 * front of it. Nothing is lost by routing it - the WARN carries every seat's
 * answer and confidence.
 *
 * Pure and deterministic.
 */

import { quizItemId } from "./quizDerivation.js";
import type { ChapterV21 } from "../types.js";

/** The panel's confident, blind, majority disagreement with the stored key. */
export const PANEL_QUIZ_DERIVED_WRONG_CODE = "READER.BLOCKING.structurally_invalid" as const;

/** A weaker derivation disagreement, routed to the answer-key judge. */
export const PANEL_QUIZ_DERIVATION_SPLIT_CODE = "READER.PANEL.QUIZ_DERIVATION_SPLIT" as const;

export type PanelSeatDerivation = {
  readonly seatId: string;
  readonly answers: readonly ("a" | "b" | "c")[];
  readonly confidence: readonly ("low" | "medium" | "high")[];
};

export type PanelQuizAdjudicationIssue = {
  readonly code: typeof PANEL_QUIZ_DERIVED_WRONG_CODE | typeof PANEL_QUIZ_DERIVATION_SPLIT_CODE;
  readonly severity: "WARN" | "BLOCKER";
  readonly message: string;
  readonly questionId: string;
  readonly questionIndex: number;
};

const LETTER_INDEX: Readonly<Record<string, number>> = { a: 0, b: 1, c: 2 };

function letter(index: number): string {
  return index >= 0 && index <= 2 ? "abc"[index] : `#${index}`;
}

/**
 * Adjudicate one chapter's panel derivations against its stored answer key.
 *
 * `derivations` are the per-seat derivations in seat order; a seat whose arrays
 * do not cover a question contributes nothing for that question (the reader
 * contract already fails a seat whose derivation is short, so this is a guard,
 * not a policy).
 */
export function adjudicatePanelQuizDerivations(
  chapter: ChapterV21,
  derivations: readonly PanelSeatDerivation[],
): readonly PanelQuizAdjudicationIssue[] {
  const questions = chapter.quiz?.questions ?? [];
  const seatCount = derivations.length;
  if (seatCount === 0) return [];
  const issues: PanelQuizAdjudicationIssue[] = [];

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const keyed = question.correctIndex;
    const votes: Array<{ seatId: string; derived: number; confidence: "low" | "medium" | "high" }> = [];
    for (const seat of derivations) {
      const answer = seat.answers[index];
      const confidence = seat.confidence[index];
      if (answer === undefined || confidence === undefined) continue;
      const derived = LETTER_INDEX[answer];
      if (derived === undefined) continue;
      votes.push({ seatId: seat.seatId, derived, confidence });
    }
    const dissent = votes.filter((vote) => vote.derived !== keyed);
    if (dissent.length === 0) continue;

    const questionId = quizItemId(chapter, index);
    const detail = votes
      .map((vote) => `${vote.seatId}=${letter(vote.derived)}/${vote.confidence}`)
      .join(", ");

    // Group the dissenting seats by the answer they landed on: a majority must
    // agree on the SAME wrong answer, not merely disagree with the key.
    const byAnswer = new Map<number, typeof dissent>();
    for (const vote of dissent) byAnswer.set(vote.derived, [...(byAnswer.get(vote.derived) ?? []), vote]);
    const majority = [...byAnswer.entries()]
      .filter(([, group]) => group.length * 2 > seatCount && group.every((vote) => vote.confidence === "high"))
      .sort(([left], [right]) => left - right)[0];

    if (majority !== undefined) {
      const [answer, group] = majority;
      issues.push({
        code: PANEL_QUIZ_DERIVED_WRONG_CODE,
        severity: "BLOCKER",
        message:
          `${group.length} of ${seatCount} blind reader seats independently derived choice ${letter(answer)} at high confidence`
          + ` for ${questionId}, but the stored key is choice ${letter(keyed)}. The question does not work as keyed`
          + ` (seat derivations: ${detail}).`,
        questionId,
        questionIndex: index,
      });
      continue;
    }

    issues.push({
      code: PANEL_QUIZ_DERIVATION_SPLIT_CODE,
      severity: "WARN",
      message:
        `blind reader seats disagree with the stored key for ${questionId} (key: choice ${letter(keyed)};`
        + ` seat derivations: ${detail}). Routed to the answer-key judge as a flagged question.`,
      questionId,
      questionIndex: index,
    });
  }
  return issues;
}
