/**
 * Intra-book quiz similarity critic. The chapter-level counterpart of AS4 /
 * BP20: catches templated quiz content WHEN A NEW CHAPTER IS WRITTEN against
 * already-cached prior chapters of the same book, instead of waiting for the
 * book gate at finalization to surface the defect.
 *
 * Background — the May 2026 "7 Habits Step 2" incident:
 *   A writer agent produced 11 chapters where every chapter's quiz prompts
 *   and distractors were the same text with name/location substitutions:
 *     Ch1 q02: "Your family is split after the call connects. What should
 *               Camille protect before choosing the next action?"
 *     Ch2 q02: "Your family is split after the call connects. What should
 *               Hector protect before choosing the next action?"
 *     ... Ch11 q02 with Sabine.
 *   The per-chapter ship gates all passed because they ran chapter-in-
 *   isolation. AS4 and BP20 detected it at book-gate time, but by then
 *   ALL 11 CHAPTERS had been written. Hours of work wasted because the
 *   writer agent never saw the structural feedback until the end.
 *
 * Fix:
 *   The `gate-chapter` CLI now auto-discovers sibling chapter files (every
 *   <bookId>-ch*.v21-native.chapter.json in state/chapters/) and runs this
 *   critic against them. So Ch2 is compared to Ch1 the moment Ch2 is ship-
 *   gated. If Ch2's quiz is just Ch1's quiz with names swapped, the gate
 *   blocks at Chapter 2 — the agent fixes Ch2 before writing Ch3+.
 *
 * Codes:
 *   AS5 — chapter quiz prompt matches a prior chapter's same-position
 *         prompt at >70% word overlap. Detects template substitution
 *         with only proper-noun changes.
 *   AS6 — chapter quiz distractor at position X matches a prior chapter's
 *         same-position distractor at >80% word overlap. The threshold is
 *         higher than AS5 because legitimate distractors of similar concepts
 *         can share more vocabulary than prompts.
 *
 * Both fire as BLOCKER. False positives are acceptable — the cost of a
 * spurious block (writer rewrites a distractor) is much lower than the
 * cost of shipping templated quizzes across an entire book.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding } from "./shared.js";

const PROMPT_SIMILARITY_BLOCKER = 0.7;
const DISTRACTOR_SIMILARITY_BLOCKER = 0.8;

/**
 * Runs cross-chapter checks between `chapter` and every prior chapter of the
 * same book. Pass the array of already-cached chapters from
 * state/chapters/<bookId>-ch*.v21-native.chapter.json (excluding the one
 * being gated). Returns BLOCKER findings for AS5 (prompt similarity) and
 * AS6 (distractor similarity).
 *
 * If priorChapters is empty (no siblings cached yet), returns []. The first
 * chapter of a book has nothing to compare against and passes this critic
 * trivially.
 */
export function checkIntraBookQuizSimilarity(
  chapter: ChapterV21,
  priorChapters: ChapterV21[],
): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (priorChapters.length === 0) return findings;

  const currentQs = chapter.quiz?.questions ?? [];
  if (currentQs.length === 0) return findings;

  // Build a lookup from questionId → prompt for each prior chapter.
  // Same-position comparison means matching by questionId (q01, q02, ...).
  for (const currentQ of currentQs) {
    if (typeof currentQ.prompt !== "string" || !currentQ.prompt) continue;
    const currentPromptTokens = tokenize(currentQ.prompt);
    if (currentPromptTokens.length < 4) continue;

    for (const priorCh of priorChapters) {
      const priorQ = (priorCh.quiz?.questions ?? []).find(
        (q) => q.questionId === currentQ.questionId,
      );
      if (!priorQ || typeof priorQ.prompt !== "string") continue;

      // AS5 — prompt-to-prompt similarity at same position.
      const priorPromptTokens = tokenize(priorQ.prompt);
      const promptSim = wordOverlapSimilarity(currentPromptTokens, priorPromptTokens);
      if (promptSim >= PROMPT_SIMILARITY_BLOCKER) {
        findings.push(
          finding(
            "AS5.chapter_quiz_prompt_matches_prior" as any,
            "blocker",
            `${currentQ.questionId} prompt is ${(promptSim * 100).toFixed(0)}% identical to Ch${priorCh.number} ${priorQ.questionId} prompt. This is template substitution — rewrite this chapter's ${currentQ.questionId} from THIS chapter's source notes, not by adapting another chapter's. The fix is to choose a DIFFERENT scenario, not to swap names or nouns in the same skeleton.`,
            `current: ${currentQ.prompt.slice(0, 100)} | prior Ch${priorCh.number}: ${priorQ.prompt.slice(0, 100)}`,
          ),
        );
        // Don't double-report the same currentQ against multiple priors;
        // the first match is enough to signal the agent.
        break;
      }
    }
  }

  // AS6 — distractor-to-distractor similarity at same position.
  // For each (current question position, current choice index), collect every
  // prior chapter whose same-position question has any choice that matches at
  // ≥80% word overlap. Emit ONE finding per (currentQ, choiceIdx) summarizing
  // all the prior matches, not one finding per (current, prior) pair. The
  // grouped form is what the writer agent needs: "this choice is the same as
  // 10 prior chapters' choices — rewrite it" rather than 10 separate findings.
  for (const currentQ of currentQs) {
    if (!Array.isArray(currentQ.choices) || currentQ.choices.length < 2) continue;
    const currentCorrect = currentQ.correctIndex;
    for (let ci = 0; ci < currentQ.choices.length; ci++) {
      const curChoice = currentQ.choices[ci];
      if (typeof curChoice !== "string" || !curChoice) continue;
      const curTokens = tokenize(curChoice);
      if (curTokens.length < 4) continue;

      const matches: Array<{ chapter: number; pi: number; sim: number; priChoice: string; isCorrectPair: boolean }> = [];
      const isCurrentCorrect = ci === currentCorrect;
      for (const priorCh of priorChapters) {
        const priorQ = (priorCh.quiz?.questions ?? []).find(
          (q) => q.questionId === currentQ.questionId,
        );
        if (!priorQ || !Array.isArray(priorQ.choices)) continue;
        const priorCorrect = priorQ.correctIndex;
        let bestSim = 0;
        let bestPi = -1;
        let bestIsCorrect = false;
        for (let pi = 0; pi < priorQ.choices.length; pi++) {
          const priChoice = priorQ.choices[pi];
          if (typeof priChoice !== "string") continue;
          const priTokens = tokenize(priChoice);
          const sim = wordOverlapSimilarity(curTokens, priTokens);
          if (sim > bestSim) {
            bestSim = sim;
            bestPi = pi;
            bestIsCorrect = pi === priorCorrect;
          }
        }
        if (bestSim >= DISTRACTOR_SIMILARITY_BLOCKER && bestPi >= 0) {
          matches.push({
            chapter: priorCh.number,
            pi: bestPi,
            sim: bestSim,
            priChoice: priorQ.choices[bestPi] as string,
            isCorrectPair: isCurrentCorrect && bestIsCorrect,
          });
        }
      }

      if (matches.length === 0) continue;

      // Group all matches into one finding for this (currentQ, ci).
      const chList = matches.map((m) => `Ch${m.chapter}`).sort().join(", ");
      const role = isCurrentCorrect ? "CORRECT answer" : `choice[${ci}]`;
      const correctPairs = matches.filter((m) => m.isCorrectPair).length;
      const correctNote = isCurrentCorrect && correctPairs === matches.length
        ? " Each chapter teaches a different mental move; correct answers must diverge accordingly. Rewrite from THIS chapter's source notes."
        : " Distractors must not be reused across chapters — rewrite this one to reflect THIS chapter's specific misreading from its hardEdge.";
      const exampleMatch = matches[0];
      findings.push(
        finding(
          "AS6.chapter_quiz_distractor_matches_prior" as any,
          "blocker",
          `${currentQ.questionId} ${role} matches ${matches.length} prior chapter(s) at ≥80% word overlap: ${chList}.${correctNote}`,
          `current: ${curChoice.slice(0, 100)} | matched in Ch${exampleMatch.chapter}: ${exampleMatch.priChoice.slice(0, 100)}`,
        ),
      );
    }
  }

  return findings;
}

/** Tokenize lowercase words, strip punctuation. */
function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
}

/**
 * Word-overlap similarity: |A ∩ B| / max(|A|, |B|). Same metric as AS4
 * (book-level) — keeps thresholds and intuition consistent across the
 * two stages of the same detector class.
 */
function wordOverlapSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const counterA = new Map<string, number>();
  for (const w of a) counterA.set(w, (counterA.get(w) ?? 0) + 1);
  const counterB = new Map<string, number>();
  for (const w of b) counterB.set(w, (counterB.get(w) ?? 0) + 1);
  let shared = 0;
  for (const [w, ca] of counterA) {
    const cb = counterB.get(w) ?? 0;
    shared += Math.min(ca, cb);
  }
  return shared / Math.max(a.length, b.length);
}
