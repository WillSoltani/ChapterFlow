/**
 * Final ship gate for v21 chapters.
 *
 * Runs every relevant critic over a fully-assembled ChapterV21 and returns
 * pass/fail with detailed findings. The orchestrator calls this BEFORE
 * persisting the chapter to disk. A chapter that fails any BLOCKER cannot
 * ship.
 *
 * Coverage is documented in FAILURE-MODES.md. Every BLOCKER row in that
 * catalog must have a corresponding check here.
 */

import { ChapterV21, CriticFinding, ExampleV21 } from "../types.js";
import { checkBannedPhrases, checkNoChapterNumberLiteral, checkNoEmDash, checkNoMetaReference } from "./register.js";
import { checkAlphabetCyclingNames, checkDecisionPoint, checkExampleTemplating, checkNamedProtagonist, checkSpecificScene } from "./narrative.js";
import { checkCapitalization, checkExampleTitleVerbShell, checkMaxWordCount, checkSentenceSanity } from "./integrity.js";
import { finding } from "./shared.js";
import { checkCardTestsRetrieval, checkQuizTestsApplication } from "./pedagogy.js";
import { checkAnswerPositionBalance, checkEnumValidity } from "./schema.js";
import {
  checkQuizAnswerLengthRatio,
  checkQuizBannedTailPhrase,
  checkQuizDuplicateChoices,
  checkQuizLabelShapedCorrect,
  checkQuizLowercaseChoiceStart,
  checkQuizPromptOpenerMonotony,
  checkQuizStrawmanDistractors,
  checkQuizUnexpectedFields,
} from "./quizQuality.js";
import {
  checkChapterDoubledPeriods,
  checkChapterIdentifierTokens,
  checkChapterJammedNouns,
} from "./antiSalting.js";
import {
  checkCadenceVariance,
  checkClosingLineLandings,
  checkConcreteParagraphOpeners,
  checkCrossTierPhraseUniqueness,
  checkOpeningConcreteness,
  checkParagraphStartVariety,
  checkTiersProgressive,
} from "./prose.js";
import { checkReadingLevel } from "./readingLevel.js";
import { runSupportSectionAudit } from "./supportSectionAudit.js";

export type GateSeverity = "blocker" | "major" | "minor";

export type GateFinding = {
  catalogId: string;          // entry from FAILURE-MODES.md (e.g., "B1", "C3")
  severity: GateSeverity;
  unit: string;               // human-readable location ("breakdown.fastRead", "example[2]", "quiz.q05")
  message: string;
  evidence?: string;          // truncated offending text
};

export type GateReport = {
  passed: boolean;
  blockers: GateFinding[];    // any of these failing means the chapter does NOT ship
  majors: GateFinding[];      // chapter still ships but findings are surfaced
  minors: GateFinding[];      // advisory only
  summary: {
    blockersCount: number;
    majorsCount: number;
    minorsCount: number;
  };
};

const SEVERITY_FROM_CATALOG: Record<string, GateSeverity> = {
  // Schema (A)
  A1: "blocker",
  A2: "blocker",
  A3: "blocker",
  A4: "major",
  A5: "blocker",
  // Voice (B)
  B1: "blocker",
  B2: "blocker",
  B3: "major",
  B4: "major",
  B5: "blocker",
  B7: "minor",
  B8: "minor",
  // Examples (C)
  C1: "blocker",
  C2: "major",
  C3: "major",
  C7: "blocker",
  C8: "blocker",
  C9: "blocker",
  C10: "blocker",
  E4: "major",
  A11: "blocker",
  A12: "blocker",
  "A12-breakdown": "blocker",
  A13: "major",
  A14: "major",
  A15: "blocker",
  A16: "blocker",
  "A16.quiz_count_floor": "blocker",
  "A16.cards_count_floor": "blocker",
  "A16.examples_count_floor": "blocker",
  // Support sections (C11–C15) — review cards, quiz templates, title-keyword
  // injection, trailing fragments, role/domain mismatch.
  C11: "blocker",
  "C11.identical_backs": "blocker",
  "C11.mostly_identical_backs": "blocker",
  C12: "blocker",
  "C12.quiz_template_prompt": "blocker",
  C13: "blocker",
  "C13.title_keyword_injection": "blocker",
  C14: "blocker",
  "C14.trailing_fragment": "blocker",
  C15: "major",
  "C15.role_domain_mismatch": "major",
  // Broken example template + requiredBeat paste (C16–C17)
  C16: "blocker",
  "C16.broken_example_template": "blocker",
  C17: "blocker",
  "C17.required_beat_verbatim": "blocker",
  // Pedagogy (D)
  D1: "major",
  D2: "minor",
  // Reading level (E)
  E1: "major",
  E2: "major",
  E3: "minor",
  // Quiz-quality critic (BP15–BP21, schema.quiz_*)
  "BP15.quiz_strawman_distractor": "major",
  "BP16.quiz_answer_length_blocker": "blocker",
  "BP16.quiz_answer_length_major": "major",
  "BP17.quiz_opener_monotony": "major",
  "BP18.quiz_label_shape_correct": "minor",
  "BP19.quiz_banned_tail_phrase": "blocker",
  "BP20.quiz_ngram_template_repeat": "blocker",
  "BP21.quiz_cross_chapter_duplicate": "blocker",
  "schema.quiz_duplicate_choice": "blocker",
  "schema.quiz_lowercase_choice_start": "major",
  "schema.quiz_unexpected_field": "blocker",
  // Anti-salting (May 2026 Covey incident).
  "AS1.identifier_token_injection": "blocker",
  "AS2.jammed_proper_nouns": "blocker",
  "AS3.doubled_period": "blocker",
  "AS4.quiz_prompt_template_substitution": "blocker",
};

const HOOK_BANNED_OPENERS = /^\s*(in this (chapter|book)|this chapter|the chapter|the author)/i;

/**
 * A15 — tier-length stub floor. A chapter whose tier prose falls below the
 * stub floor cannot ship. The score-chapters rubric docks points for short
 * tiers but the gate previously accepted them; 48 Laws of Power shipped
 * with 0/48 chapters at the fullRead target (avg 347 chars, 12% of target)
 * and the rubric still scored A- 88%. Hard floors fail-closed instead.
 */
function checkTierLengthFloors(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const fast = chapter.breakdown?.fastRead?.length ?? 0;
  const deep = chapter.breakdown?.deepRead?.length ?? 0;
  const full = chapter.breakdown?.fullRead?.length ?? 0;

  if (fast < 350) {
    findings.push(finding(
      "A15.stub_fastRead" as any,
      "blocker",
      `breakdown.fastRead is ${fast} chars (floor 350). A chapter with fastRead under 350 is a stub — the gate refuses to ship it.`,
      chapter.breakdown?.fastRead?.slice(0, 120) ?? "",
    ));
  }
  if (deep < 1000) {
    findings.push(finding(
      "A15.stub_deepRead" as any,
      "blocker",
      `breakdown.deepRead is ${deep} chars (floor 1000). A chapter with deepRead under 1000 is a stub — the gate refuses to ship it.`,
      chapter.breakdown?.deepRead?.slice(0, 120) ?? "",
    ));
  }
  if (full < 2400) {
    findings.push(finding(
      "A15.stub_fullRead" as any,
      "blocker",
      `breakdown.fullRead is ${full} chars (floor 2400). A chapter with fullRead under 2400 is a stub — the gate refuses to ship it.`,
      chapter.breakdown?.fullRead?.slice(0, 120) ?? "",
    ));
  }
  return findings;
}

/**
 * A16 — support-section count floor. A chapter must ship with the full slate
 * of quiz questions, review cards, and examples. The 48 Laws of Power book
 * shipped with 46 of 48 chapters at 3 quiz questions (instead of 9), because
 * the writer-quiz agent's count check only fires inside the writer's retry
 * loop and the ship gate had no minimum. extreme-ownership and zero-to-one
 * had the same defect on 5 and 13 chapters respectively.
 *
 * Floors:
 *   quiz.questions     >= 9
 *   reviewCards        >= 4 (most books ship 5; floor of 4 matches atomic-habits)
 *   examples           >= 6
 */
function checkSupportCountFloors(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const quizCount = chapter.quiz?.questions?.length ?? 0;
  const cardCount = chapter.reviewCards?.length ?? 0;
  const exampleCount = chapter.examples?.length ?? 0;

  if (quizCount < 9) {
    findings.push(finding(
      "A16.quiz_count_floor" as any,
      "blocker",
      `quiz.questions has ${quizCount} entries (floor 9). Chapter is missing ${9 - quizCount} quiz questions — likely a partial generation or unrefreshed stub.`,
      `${quizCount}/9`,
    ));
  }
  if (cardCount < 4) {
    findings.push(finding(
      "A16.cards_count_floor" as any,
      "blocker",
      `reviewCards has ${cardCount} entries (floor 4). Chapter is missing review cards — likely a partial generation.`,
      `${cardCount}/4`,
    ));
  }
  if (exampleCount < 6) {
    findings.push(finding(
      "A16.examples_count_floor" as any,
      "blocker",
      `examples has ${exampleCount} entries (floor 6). Chapter is missing examples — likely a partial generation.`,
      `${exampleCount}/6`,
    ));
  }
  return findings;
}

function checkBreakdownSentenceCapitalization(
  text: string | undefined,
  tier: "fastRead" | "deepRead" | "fullRead",
): Array<{ message: string; evidence?: string }> {
  if (!text) return [];
  const findings: Array<{ message: string; evidence?: string }> = [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim().length > 0);
  for (const [index, sentence] of sentences.entries()) {
    if (index === 0) continue;
    const trimmed = sentence.replace(/^[\s"'“‘«\[]+/, "");
    if (!trimmed) continue;
    const first = trimmed.charAt(0);
    // Numerals and parenthesized clauses are common legitimate prose openers.
    if (/[0-9]/.test(first) || first === "(") continue;
    if (/[a-z]/.test(first)) {
      findings.push({
        message: `breakdown.${tier} sentence ${index + 1} starts with a lowercase letter after a sentence boundary`,
        evidence: sentence.slice(0, 180),
      });
    }
  }
  return findings;
}

export function runShipGate(chapter: ChapterV21): GateReport {
  const findings: GateFinding[] = [];

  const push = (catalogId: string, unit: string, message: string, evidence?: string) => {
    const severity = SEVERITY_FROM_CATALOG[catalogId];
    if (!severity) {
      throw new Error(`finalGate: catalogId "${catalogId}" not registered in SEVERITY_FROM_CATALOG`);
    }
    findings.push({ catalogId, severity, unit, message, evidence });
  };

  // ── Hook (B1, B2, B4, B5, A12, A13) ──────────────────────────────────────
  if (chapter.hook) {
    if (HOOK_BANNED_OPENERS.test(chapter.hook)) {
      push("B1", "hook", "hook opens with meta-reference", chapter.hook);
    }
    for (const f of checkCapitalization(chapter.hook, "hook")) push("A12", "hook", f.message, f.evidence);
    for (const f of checkSentenceSanity(chapter.hook, "hook")) {
      push(f.severity === "minor" ? "A13" : "A13", "hook", f.message, f.evidence);
    }
    runRegisterChecks("hook", chapter.hook, push);
  }
  if (chapter.counterintuition) {
    for (const f of checkCapitalization(chapter.counterintuition, "counterintuition")) push("A12", "counterintuition", f.message, f.evidence);
    for (const f of checkSentenceSanity(chapter.counterintuition, "counterintuition")) push("A13", "counterintuition", f.message, f.evidence);
    runRegisterChecks("counterintuition", chapter.counterintuition, push);
  }
  if (chapter.keyTakeaway) {
    for (const f of checkCapitalization(chapter.keyTakeaway, "keyTakeaway")) push("A12", "keyTakeaway", f.message, f.evidence);
    for (const f of checkSentenceSanity(chapter.keyTakeaway, "keyTakeaway")) push("A13", "keyTakeaway", f.message, f.evidence);
    for (const f of checkMaxWordCount(chapter.keyTakeaway, "keyTakeaway", 30)) push("A14", "keyTakeaway", f.message, f.evidence);
    runRegisterChecks("keyTakeaway", chapter.keyTakeaway, push);
  }
  if (chapter.tryThisNow) {
    for (const f of checkCapitalization(chapter.tryThisNow, "tryThisNow")) push("A12", "tryThisNow", f.message, f.evidence);
    for (const f of checkSentenceSanity(chapter.tryThisNow, "tryThisNow")) push("A13", "tryThisNow", f.message, f.evidence);
    runRegisterChecks("tryThisNow", chapter.tryThisNow, push);
  }
  // Backwards-compat: legacy v21 packages (tiny-habits) used reflectionBefore/After.
  // We still register-check them so they don't sneak past with bad content, but
  // new chapters won't populate them.
  if (chapter.reflectionBefore) {
    runRegisterChecks("reflectionBefore", chapter.reflectionBefore, push);
  }
  if (chapter.reflectionAfter) {
    runRegisterChecks("reflectionAfter", chapter.reflectionAfter, push);
  }
  if (chapter.memorableLines) {
    chapter.memorableLines.forEach((line, i) => {
      runRegisterChecks(`memorableLines[${i}]`, line.text, push);
    });
    // A11: every pinned memorable line's .text MUST appear verbatim somewhere
    // in the chapter's breakdown prose. The marker agent extracts lines FROM
    // the prose at generation time, so this invariant holds by construction
    // after a fresh run. But polish/refactor passes can rewrite prose while
    // leaving the pin stale, which breaks the reader's quote / share-card
    // surface. Fail closed so any prose edit that drops a pinned sentence
    // either restores the pin or repoints it to a new sentence.
    const proseHaystack =
      (chapter.breakdown.fastRead ?? "") +
      "\n" +
      (chapter.breakdown.deepRead ?? "") +
      "\n" +
      (chapter.breakdown.fullRead ?? "");
    chapter.memorableLines.forEach((line, i) => {
      if (!line?.text) return;
      if (!proseHaystack.includes(line.text)) {
        push(
          "A11",
          `memorableLines[${i}]`,
          `pinned memorable line "${line.text.slice(0, 80)}${line.text.length > 80 ? "…" : ""}" does not appear verbatim in any breakdown tier — either restore the original sentence to the prose or repoint memorableLines[${i}].text to a sentence that does appear`,
          line.text,
        );
      }
    });
  }

  // ── Breakdown (B1, B2, B4, B5, E1, E2, E3, B7, B8) ───────────────────────
  for (const [tierName, tierText] of [
    ["fastRead", chapter.breakdown.fastRead],
    ["deepRead", chapter.breakdown.deepRead],
    ["fullRead", chapter.breakdown.fullRead],
  ] as const) {
    for (const f of checkBreakdownSentenceCapitalization(tierText, tierName)) {
      push("A12-breakdown", `breakdown.${tierName}`, f.message, f.evidence);
    }
    runRegisterChecks(`breakdown.${tierName}`, tierText, push);
    for (const f of checkReadingLevel(tierText, tierName)) {
      push("E1", `breakdown.${tierName}`, f.message);
    }
    for (const f of checkConcreteParagraphOpeners(tierText, `breakdown.${tierName}`)) {
      push("E4", `breakdown.${tierName}`, f.message);
    }
    for (const f of checkOpeningConcreteness(tierText, `breakdown.${tierName}`)) {
      push("E3", `breakdown.${tierName}`, f.message);
    }
    for (const f of checkParagraphStartVariety(tierText, `breakdown.${tierName}`)) {
      push("B7", `breakdown.${tierName}`, f.message);
    }
    for (const f of checkCadenceVariance(tierText, `breakdown.${tierName}`)) {
      push("B7", `breakdown.${tierName}`, f.message);
    }
    for (const f of checkClosingLineLandings(tierText, `breakdown.${tierName}`)) {
      push("B7", `breakdown.${tierName}`, f.message);
    }
  }
  // A15 — tier-length stub floor. Refuses to ship chapters whose breakdown
  // prose falls below the stub threshold. Fail-closed because the rubric
  // alone docked points but accepted stubs anyway (48 Laws of Power).
  for (const f of checkTierLengthFloors(chapter)) {
    push("A15", `tier_length`, f.message, f.evidence);
  }
  // A16 — support-section count floor. Refuses to ship chapters that are
  // missing quiz questions, review cards, or examples. 48 Laws shipped with
  // 46/48 chapters at 3 quiz questions instead of 9 because the writer's
  // retry-loop check fires upstream of any ship-gate verification.
  for (const f of checkSupportCountFloors(chapter)) {
    push(f.checkId as string, `support_counts`, f.message, f.evidence);
  }
  // E2 — tier progression
  for (const f of checkTiersProgressive(
    { fastRead: chapter.breakdown.fastRead, deepRead: chapter.breakdown.deepRead, fullRead: chapter.breakdown.fullRead },
    "breakdown",
  )) {
    push("E2", "breakdown", f.message);
  }
  // B8 — cross-tier verbatim
  const allowList = [chapter.title, ...chapter.title.split(/\s+/).filter((w) => w.length > 4).slice(0, 3)];
  for (const f of checkCrossTierPhraseUniqueness(
    { fastRead: chapter.breakdown.fastRead, deepRead: chapter.breakdown.deepRead, fullRead: chapter.breakdown.fullRead },
    allowList,
    "breakdown",
  )) {
    push("B8", "breakdown", f.message);
  }

  // ── Example-slate templating (C8): catches Cartesian-product output where
  // an agent shipped N "examples" that are one template with substituted
  // name/role/city. Fired by GPT-in-Codex on smarter-faster-better and
  // seven-powers; would have prevented both bad books from shipping.
  for (const f of checkExampleTemplating(chapter.examples)) {
    push("C8", "examples", f.message, f.evidence);
  }

  // ── Alphabet-cycling protagonist names (C9): a script tell where an agent
  // enumerated the alphabet rather than choosing protagonists scene by scene.
  // Caught Antifragile shipping with 21/25 chapters using A-B-C-D-E-F → G-H-…
  for (const f of checkAlphabetCyclingNames(chapter.examples)) {
    push("C9", "examples", f.message, f.evidence);
  }

  // ── Example-title verb shell (C10): when 4+ of 6 titles share the same
  // second word (the verb), the titles all follow a "<Name> verb <domain>"
  // shell — e.g., Indistractable Ch15: "Samantha handles shipyard…",
  // "Grant handles university…", "Audrey handles restaurant…". C8 misses
  // this because each title's 3-word substring is unique.
  for (const f of checkExampleTitleVerbShell(chapter.examples)) {
    push("C10", "examples", f.message, f.evidence);
  }

  // ── Examples (B1, B2, B4, B5, C1, C2, C3, C7) ────────────────────────────
  chapter.examples.forEach((ex, i) => {
    const unit = `example[${i}]`;
    // Treat as legacy Example shape for narrative critics (they accept v21 example minus `tags/planSpec`)
    const exForCritic = {
      ...ex,
      category: "work" as const,
      contexts: ex.tags ?? [],
      // The narrative critic only reads scenario, format, etc.
      format: ex.planSpec.format,
    } as unknown as ExampleV21 & { category: string; contexts: string[]; format: string };

    for (const f of checkNamedProtagonist(exForCritic as any)) push("C1", unit, f.message, f.evidence);
    for (const f of checkSpecificScene(exForCritic as any)) push("C2", unit, f.message, f.evidence);
    for (const f of checkDecisionPoint(exForCritic as any)) push("C3", unit, f.message, f.evidence);

    // A12 / A13 — capitalization and sentence sanity on example scenario and title.
    for (const f of checkCapitalization(ex.scenario, `${unit}.scenario`)) push("A12", `${unit}.scenario`, f.message, f.evidence);
    for (const f of checkCapitalization(ex.title, `${unit}.title`)) push("A12", `${unit}.title`, f.message, f.evidence);
    for (const f of checkSentenceSanity(ex.scenario, `${unit}.scenario`)) push("A13", `${unit}.scenario`, f.message, f.evidence);

    const exFullText = `${ex.scenario} ${ex.whatToDo} ${ex.whyItMatters} ${ex.title}`;
    runRegisterChecks(unit, exFullText, push);

    // C7 — banned-pool name in scenario
    const bannedPool = ["Priya","Omar","Maya","Marcus","Elena","Lena","Victor","Theo","Jonah","Mateo","Tessa","Owen","Mira","Malik","Nadia","Felix","Caleb","Talia","Elise","Naomi"];
    for (const name of bannedPool) {
      if (new RegExp(`\\b${name}\\b`).test(ex.scenario) || new RegExp(`\\b${name}\\b`).test(ex.title)) {
        push("C7", unit, `banned-pool protagonist name "${name}" used`, ex.scenario);
        break;
      }
    }
  });

  // ── Quiz (A1, A2, A3, A4, A5, D1) ────────────────────────────────────────
  chapter.quiz.questions.forEach((q, i) => {
    const unit = `quiz.q${String(i + 1).padStart(2, "0")}`;
    // A5 — exactly 3 choices
    if (!Array.isArray(q.choices) || q.choices.length !== 3) {
      push("A5", unit, `choices length ${q.choices?.length} (must be 3)`);
    }
    // A1 / A2 / A3 — schema enum validity
    for (const f of checkEnumValidity(q as any)) {
      const isBloomFail = f.message.includes("bloomsLevel");
      push(isBloomFail ? (q.bloomsLevel ? "A1" : "A3") : "A2", unit, f.message);
    }
    // D1 — application vs recall
    for (const f of checkQuizTestsApplication(q as any)) push("D1", unit, f.message, f.evidence);
    // Register checks on prompt + choices + explanation
    runRegisterChecks(unit, `${q.prompt} ${q.choices.join(" ")} ${q.explanation ?? ""}`, push);
  });
  // A4 — answer-position balance
  for (const f of checkAnswerPositionBalance(chapter.quiz as any, chapter.number)) {
    push("A4", "quiz", f.message);
  }

  // ── Quiz quality (BP15–BP19, schema.quiz_*) ─────────────────────────────
  // These run on a single chapter's quiz. The book-level template checks
  // (BP20, BP21) run from runBookGate after every chapter is assembled.
  for (const f of checkQuizStrawmanDistractors(chapter.quiz)) {
    push(f.checkId as string, `quiz.${extractQid(f.message)}`, f.message, f.evidence);
  }
  for (const f of checkQuizAnswerLengthRatio(chapter.quiz)) {
    push(f.checkId as string, `quiz.${extractQid(f.message)}`, f.message, f.evidence);
  }
  for (const f of checkQuizPromptOpenerMonotony(chapter.quiz)) {
    push(f.checkId as string, "quiz", f.message, f.evidence);
  }
  for (const f of checkQuizLabelShapedCorrect(chapter.quiz)) {
    push(f.checkId as string, `quiz.${extractQid(f.message)}`, f.message, f.evidence);
  }
  for (const f of checkQuizDuplicateChoices(chapter.quiz)) {
    push(f.checkId as string, `quiz.${extractQid(f.message)}`, f.message, f.evidence);
  }
  for (const f of checkQuizLowercaseChoiceStart(chapter.quiz)) {
    push(f.checkId as string, `quiz.${extractQid(f.message)}`, f.message, f.evidence);
  }
  for (const f of checkQuizUnexpectedFields(chapter.quiz)) {
    push(f.checkId as string, `quiz.${extractQid(f.message)}`, f.message, f.evidence);
  }
  for (const f of checkQuizBannedTailPhrase(chapter.quiz)) {
    push(f.checkId as string, `quiz.${extractQid(f.message)}`, f.message, f.evidence);
  }

  // ── Anti-salting critics (AS1-AS3, chapter-level) ───────────────────────
  // Catches the May 2026 Covey incident: writer agents inserting identifier
  // tokens / jammed proper nouns / doubled periods to evade n-gram critics.
  // Every AS finding is a BLOCKER.
  for (const f of checkChapterIdentifierTokens(chapter)) {
    push(f.checkId as string, "anti-salting", f.message, f.evidence);
  }
  for (const f of checkChapterJammedNouns(chapter)) {
    push(f.checkId as string, "anti-salting", f.message, f.evidence);
  }
  for (const f of checkChapterDoubledPeriods(chapter)) {
    push(f.checkId as string, "anti-salting", f.message, f.evidence);
  }

  // ── Cards (D2, B1, B2, B4, B5) ───────────────────────────────────────────
  chapter.reviewCards.forEach((c, i) => {
    const unit = `card[${i}]`;
    for (const f of checkCardTestsRetrieval(c as any)) push("D2", unit, f.message, f.evidence);
    runRegisterChecks(unit, `${c.front} ${c.back}`, push);
  });

  // ── Implementation plan (B1, B2, B4, B5) ─────────────────────────────────
  runRegisterChecks("implementationPlan.coreSkill", chapter.implementationPlan.coreSkill, push);
  runRegisterChecks("implementationPlan.twentyFourHour", chapter.implementationPlan.twentyFourHourChallenge, push);
  runRegisterChecks("implementationPlan.weeklyPractice", chapter.implementationPlan.weeklyPractice, push);
  chapter.implementationPlan.ifThenPlans.forEach((it, i) => {
    runRegisterChecks(`implementationPlan.ifThen[${i}]`, it.plan, push);
  });

  // ── Support-section audit (C11–C15) ──────────────────────────────────────
  // Catches the defect class that shipped 48 Laws of Power and partially
  // 12 Week Year: review-card backs literally identical across all cards,
  // quiz prompts sharing a long template prefix, title-keyword injected as
  // adjective in example scenarios ("the say email"), trailing-fragment text
  // ("…being silent in e"), role/domain mismatch ("nurse Chris" in an
  // architecture critique).
  for (const f of runSupportSectionAudit(chapter)) {
    findings.push({
      catalogId: f.checkId,
      severity: f.severity,
      unit: f.unit,
      message: f.message,
      evidence: f.evidence,
    });
  }

  const blockers = findings.filter((f) => f.severity === "blocker");
  const majors = findings.filter((f) => f.severity === "major");
  const minors = findings.filter((f) => f.severity === "minor");

  return {
    passed: blockers.length === 0,
    blockers,
    majors,
    minors,
    summary: {
      blockersCount: blockers.length,
      majorsCount: majors.length,
      minorsCount: minors.length,
    },
  };
}

/** Register-level checks that apply to every text-bearing field. */
function runRegisterChecks(unit: string, text: string, push: (catalogId: string, unit: string, message: string, evidence?: string) => void): void {
  for (const f of checkNoMetaReference(text)) {
    push("B1", unit, f.message, f.evidence);
  }
  for (const f of checkNoChapterNumberLiteral(text)) {
    push("B2", unit, f.message, f.evidence);
  }
  for (const f of checkNoEmDash(text)) {
    push("B5", unit, f.message, f.evidence);
  }
  for (const f of checkBannedPhrases(text).findings) {
    push("B4", unit, f.message, f.evidence);
  }
}

/** Pull a "qNN" identifier out of a quiz-quality finding message for unit
 *  routing. Quiz-quality findings start with "qNN choice[…]" or "qNN " so
 *  the leading token is the question id. Falls back to "unknown" if the
 *  pattern doesn't match (which shouldn't happen). */
function extractQid(message: string): string {
  const m = message.match(/^(q\d{2,3})\b/);
  return m ? m[1] : "unknown";
}

/** Pretty-print a gate report for logging. */
export function formatGateReport(report: GateReport): string {
  const lines: string[] = [];
  lines.push(`Ship gate: ${report.passed ? "PASS" : "BLOCK"}`);
  lines.push(`  blockers: ${report.summary.blockersCount}`);
  lines.push(`  majors: ${report.summary.majorsCount}`);
  lines.push(`  minors: ${report.summary.minorsCount}`);
  if (report.blockers.length > 0) {
    lines.push("  Blocker findings:");
    for (const f of report.blockers) {
      lines.push(`    [${f.catalogId}] ${f.unit}: ${f.message}`);
    }
  }
  return lines.join("\n");
}
