/**
 * Register/machinery advisory surfacing (CF-I-2, 2026-07-09 — the C31 fold-in,
 * owner decision 4).
 *
 * The C31–C36 detectors are ADVISORY-MINOR (exampleRegister, metaCaseProtagonist,
 * beatVocabularyEcho, citationDateDoorway, lineageKeyQuiz, apparatusLeakage). They
 * surface machinery leaking into reader prose — evaluator-card register, an internal
 * artifact acting as the scene's subject, dealt beat labels rendered verbatim, a
 * citation-date doorway, a quiz key that rewards naming the source lineage over
 * applying the idea, and (CF-J) the source guide's own apparatus: page citations,
 * guide-structure narration, machinery terms in quiz/card text, spec-narration.
 * They never block: finalGate lists all of them as `minor`, none is in ENFORCED_MAJOR,
 * and none is wired to a gate/contract/acceptance predicate.
 *
 * S5's root cause (verification report §7.2) is that these advisory findings never
 * reached the retry/repair lanes: rubric-preflight FAILures inject concrete fix
 * lines into the next writer's card, but advisory critic findings did not — so a
 * chapter that trips ONLY C31–C35 was re-authored (for some OTHER blocking reason)
 * with no word about the register defect, and the leak survived the round.
 *
 * This module is the single surfacing helper. It runs the five detectors on a draft
 * and formats their messages as concrete fix lines. Callers append the block to a
 * card THEY ARE ALREADY BUILDING for a blocking reason (a gate blocker, a rubric
 * FAIL, a write-contract FAIL, or a reviewer must-fix repair) — so the advisory
 * NEVER triggers a retry on its own and NEVER changes any pass/fail predicate. It
 * only changes the TEXT the next writer/editor sees. Pure; no disk.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { truncate } from "./shared.js";
import { checkExampleRegister } from "./exampleRegister.js";
import { checkMetaCaseProtagonist } from "./metaCaseProtagonist.js";
import { checkBeatVocabularyEcho } from "./beatVocabularyEcho.js";
import { checkCitationDateDoorway } from "./citationDateDoorway.js";
import { checkLineageKeyQuiz } from "./lineageKeyQuiz.js";
import { checkApparatusLeakage } from "./apparatusLeakage.js";

/** The C31–C36 register/machinery advisory family, collected on one chapter draft.
 *  Every finding is MINOR (advisory) — this function does not gate anything; it only
 *  gathers the findings a surfacing caller will render as text. Pure; [] = clean.
 *  (C36 — source-guide apparatus leakage, CF-J 2026-07-09 — rides the SAME routing
 *  as its siblings by construction: write-retry cards, the review-repair directive,
 *  and the regen attempt-1 card all render this collection.) */
export function collectRegisterAdvisories(chapter: ChapterV21): CriticFinding[] {
  return [
    ...checkExampleRegister(chapter),
    ...checkMetaCaseProtagonist(chapter),
    ...checkBeatVocabularyEcho(chapter),
    ...checkCitationDateDoorway(chapter),
    ...checkLineageKeyQuiz(chapter),
    ...checkApparatusLeakage(chapter),
  ];
}

/** Concise per-finding fix lines for a retry card / repair directive — `- [Cxx] …`.
 *  Messages are truncated so the block stays lean on the card. Pure; [] = clean. */
export function registerAdvisoryFixLines(chapter: ChapterV21): string[] {
  return collectRegisterAdvisories(chapter).map(
    (f) => `- [${f.checkId}] ${truncate(f.message, 260)}`,
  );
}

/** The full labelled block to append to a retry card, or "" when the draft is clean.
 *  The heading states plainly that these are ADVISORY (they never fail the gate) so a
 *  writer does not read them as new blockers — the point is that the reviewers CAN
 *  see them, so clear them while rewriting for the real blocker. Pure. */
export function registerAdvisoryRetryBlock(chapter: ChapterV21): string {
  const lines = registerAdvisoryFixLines(chapter);
  if (lines.length === 0) return "";
  return (
    "\n\nADVISORY REGISTER NOTES (these never fail the gate — fix them while you rewrite)\n" +
    "Your previous draft tripped these advisory machinery/register detectors. They do NOT block, " +
    "but the blinded reviewers can feel them — clear each one in this rewrite so the reader meets the scene, not the pipeline:\n" +
    lines.join("\n")
  );
}
