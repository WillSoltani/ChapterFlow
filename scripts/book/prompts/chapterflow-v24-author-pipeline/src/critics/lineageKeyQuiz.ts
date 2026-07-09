/**
 * C35 — lineage-key quiz (advisory, CF-I-1 2026-07-09). A quiz whose CORRECT choice
 * rewards NAMING/CITING the source lineage rather than APPLYING the idea. On the fresh
 * `multipliers` run the pipeline's own anchor discipline (name your source, keep it
 * traceable) leaked into reader pedagogy: ch08 q01 keys on "Tie the move to Getting to
 * Yes and its named authors, Roger Fisher and William Ury, so the frame is traceable"
 * and q04 on "Name Chris Voss and his FBI negotiation experience as the lineage behind
 * the tactic" (report §7.3.2). The quiz should test whether the reader can USE the move,
 * not whether they can cite where it came from.
 *
 * THE DISCRIMINATOR (per question — flags the KEY only, never a distractor). Fire when
 * BOTH hold for the correct choice:
 *   (1) the KEY TEXT rewards citation: a cite-verb + source pattern — "tie the move to
 *       <X>", "name <X> …as the lineage", "cite", "attribute", "so the frame/it is
 *       traceable"; and
 *   (2) the EXPLANATION REINFORCES lineage as the tested skill: it contains
 *       lineage/traceable/real source/checkable/source lineage.
 * Requiring BOTH keeps it narrow: a KEY that merely mentions a source name (legitimate)
 * without the "so it's traceable" framing, or an explanation about lineage attached to a
 * key that tests application, does not fire. Distractors that cite sources are FINE —
 * only the graded answer is inspected.
 *
 * One advisory per chapter, listing the offending question indices. SEVERITY: MINOR
 * (advisory) — quiz key QUALITY gates on the blinded readers + key-judge; keyEvidence
 * anchor-traceability (sourceGrounding) is untouched. C35 only flags the ANSWER CONTENT
 * pattern. See tests/lineage-key-quiz.test.ts.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";

// Cite-verb + source patterns in the KEY. Each requires a citing ACTION on a source, not
// a mere mention.
const KEY_CITATION_PATTERNS: RegExp[] = [
  /\btie(?:s|d)?\s+(?:the|this|that|it|the move|the tactic|the frame)\b[^.]*\bto\b/i, // "tie the move to <X>"
  /\bname\b[^.]*\bas the (?:lineage|source|origin)\b/i,                                 // "name <X> as the lineage"
  /\bas the lineage\b/i,
  /\bso (?:the frame|the move|the idea|it|the tactic) (?:is|stays|becomes) (?:traceable|checkable)\b/i,
  /\bkeep(?:s|ing)?\b[^.]*\b(?:traceable|checkable|the lineage)\b/i,
  /\b(?:cite|attribute|credit)\b[^.]*\b(?:source|author|lineage|origin)\b/i,
];
// The EXPLANATION must reinforce lineage/citation as the tested skill.
const EXPLANATION_LINEAGE_RE = /\b(?:source lineage|lineage|traceable|checkable|real source|its? real source)\b/i;

/** Does a single quiz question key on naming/citing the lineage (KEY + explanation)? Pure. */
export function questionKeysOnLineage(question: any): boolean {
  const choices: string[] = Array.isArray(question?.choices) ? question.choices : [];
  const idx = question?.correctIndex;
  if (typeof idx !== "number" || idx < 0 || idx >= choices.length) return false;
  const key = typeof choices[idx] === "string" ? choices[idx] : "";
  const explanation = typeof question?.explanation === "string" ? question.explanation : "";
  if (!key) return false;
  const keyCites = KEY_CITATION_PATTERNS.some((re) => re.test(key));
  if (!keyCites) return false;
  return EXPLANATION_LINEAGE_RE.test(explanation);
}

/** Indices (0-based) of quiz questions that key on lineage. Pure. */
export function findLineageKeyQuestions(chapter: ChapterV21): number[] {
  const questions = chapter.quiz?.questions ?? [];
  const hits: number[] = [];
  questions.forEach((q, i) => {
    if (questionKeysOnLineage(q)) hits.push(i);
  });
  return hits;
}

/**
 * C35 — one advisory per chapter whose quiz has ≥1 lineage-keyed question. Lists the
 * question indices. MINOR; never blocks.
 */
export function checkLineageKeyQuiz(chapter: ChapterV21): CriticFinding[] {
  const hits = findLineageKeyQuestions(chapter);
  if (hits.length === 0) return [];
  const labels = hits.map((i) => {
    const q = chapter.quiz?.questions?.[i];
    return q?.questionId ?? `q${String(i + 1).padStart(2, "0")}`;
  });
  return [
    finding(
      "C35.lineage_key_quiz" as any,
      "minor",
      `${hits.length} quiz question(s) key on NAMING/CITING the source lineage rather than applying the idea (${labels.join(", ")}) — e.g. "Tie the move to <source> so the frame is traceable". This is the pipeline's anchor discipline leaking into reader pedagogy: the quiz should test whether the reader can USE the move under a new situation, not whether they can cite where it came from. Rewrite each key to test application; the source may stay in the explanation as support, never as the graded skill.`,
      truncate(labels.join(", "), 120),
    ),
  ];
}
