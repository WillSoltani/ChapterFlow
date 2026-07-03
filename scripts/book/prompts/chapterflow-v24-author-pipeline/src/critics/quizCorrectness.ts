/**
 * Quiz-correctness critics (Phase 2). Catch defect classes the structural gate
 * misses. SHADOW (advisory) until calibrated to blocker.
 *
 * IMPORTANT calibration note (measured 2026-06-03): most of the Phase-2 quiz
 * critics in the master plan (format-identifiable key D2, prompt-skeleton
 * collapse) did NOT separate clean from corrupt on the CURRENT corpus, because
 * the documented defects (drive 99/99 directive-prefix distractors, UH 180/180
 * container-noun keys, let-them 20/20 duplicate keys) were repaired, and the
 * residual forms evade deterministic detection (3 equally-coherent choices, a
 * unique pasted quote per prompt defeating frame-normalization). Those defects
 * are caught by the semantic judge (Phase 4), not here. The one check that is
 * deterministically SOUND and zero-false-positive is the keyed-choice
 * duplication detector below — a real gap (BP21 explicitly skips the correct
 * index), kept as defect-class coverage against recurrence even though the
 * repaired corpus does not currently trigger it.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding } from "./shared.js";

function normKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * D1 — cross-chapter keyed-choice duplication. The let-them-theory defect: the
 * SAME keyed (correct) choice string appears as the key in multiple chapters
 * (e.g. "sort control from conduct" keyed in 20/20). `checkBookQuizCrossChapter
 * Duplicates` (BP21) explicitly `continue`s on the correct index, so an
 * identical KEY across chapters is invisible to it. This closes that gap: a
 * keyed answer is authored per chapter, so the same key string in ≥2 chapters
 * means the writer reused an answer template instead of testing each chapter's
 * own idea. Short keys (<30 chars, e.g. "It depends.") are exempt — they may
 * legitimately recur. BLOCKER-worthy, shipped MAJOR (shadow) until promoted.
 */
export function checkKeyedChoiceDuplication(chapters: ChapterV21[]): CriticFinding[] {
  const seen = new Map<string, Array<{ chapter: number; questionId: string }>>();
  for (const ch of chapters) {
    for (const q of ch.quiz?.questions ?? []) {
      const ci = q.correctIndex;
      const c = q.choices?.[ci];
      if (typeof c !== "string") continue;
      const key = normKey(c);
      if (key.length < 30) continue; // short answers may legitimately recur
      const list = seen.get(key) ?? [];
      list.push({ chapter: ch.number, questionId: q.questionId });
      seen.set(key, list);
    }
  }
  const findings: CriticFinding[] = [];
  for (const [key, occ] of seen) {
    const distinctChapters = new Set(occ.map((o) => o.chapter));
    if (distinctChapters.size >= 2) {
      const locs = [...distinctChapters].sort((a, b) => a - b).join(", ");
      findings.push(
        finding(
          "D1.cross_chapter_keyed_choice" as any,
          "major", // shadow; promote to blocker once enabled in the gate
          `the same correct-answer string is keyed in ${distinctChapters.size} chapters (ch ${locs}) — an authored answer reused as a template across chapters tests the answer phrase, not each chapter's idea. Rewrite each chapter's keyed choice from its own source.`,
          key.slice(0, 80),
        ),
      );
    }
  }
  return findings;
}
