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

import { readFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21, CriticFinding, ExampleV21 } from "../types.js";
import { CANONICAL_STATE, parseChapterId } from "../lib/chapterPaths.js";
import { checkBannedPhrases, checkNoChapterNumberLiteral, checkNoEmDash, checkNoMetaReference } from "./register.js";
import { checkAlphabetCyclingNames, checkDecisionPoint, checkExampleTemplating, checkExampleSettingStamping, checkExampleProtagonistReuse, checkNamedProtagonist, checkSpecificScene } from "./narrative.js";
import { checkCapitalization, checkExampleTitleVerbShell, checkMaxWordCount, checkSentenceSanity } from "./integrity.js";
import { finding } from "./shared.js";
import { checkCardTestsRetrieval, checkQuizTestsApplication } from "./pedagogy.js";
import { checkAnswerPositionBalance, checkEnumValidity } from "./schema.js";
import {
  checkQuizAnswerLabelLeak,
  checkQuizAnswerLengthRatio,
  checkQuizChoiceLabelUniform,
  checkQuizCorrectLongestRate,
  checkQuizBannedTailPhrase,
  checkQuizDuplicateChoices,
  checkQuizLabelShapedCorrect,
  checkQuizLowercaseChoiceStart,
  checkQuizPromptOpenerMonotony,
  checkQuizStrawmanDistractors,
  checkQuizUnexpectedFields,
  checkWithinChapterQuizTemplates,
} from "./quizQuality.js";
import {
  checkChapterDoubledPeriods,
  checkChapterIdentifierTokens,
  checkChapterJammedNouns,
} from "./antiSalting.js";
import { checkBreakdownCrossTierVerbatim } from "./intraBookFieldSimilarity.js";
import { checkExampleSourceGrounding, checkChapterProvenance, loadChapterSidecar } from "./sourceGrounding.js";
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
import { checkPlainLanguage } from "./plainLanguage.js";
import { checkScaffoldLeak } from "./scaffoldLeak.js";
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

function allocatedNamesForChapter(chapter: ChapterV21): Set<string> {
  const parsed = parseChapterId(chapter.chapterId);
  if (!parsed) return new Set();
  try {
    const raw = readFileSync(resolve(CANONICAL_STATE, "name-plans", `${parsed.bookId}.name-plan.json`), "utf8");
    const plan = JSON.parse(raw) as { allocation?: Record<string, string[]>; diagnostics?: { alreadyAuthored?: number[] } };
    // ECHO-LOOPHOLE GUARD (2026-06-11 review): a re-planned ALREADY-AUTHORED
    // chapter carries its on-disk names verbatim, so honoring its allocation
    // would whitelist any banned-pool name the chapter used illegitimately —
    // permanently silencing the C7 blocker for it. Only pre-authoring FRESH
    // deals license a banned-pool name.
    const carried = new Set(plan.diagnostics?.alreadyAuthored ?? []);
    if (carried.has(chapter.number) || carried.has(parsed.num)) return new Set();
    return new Set(plan.allocation?.[String(chapter.number)] ?? plan.allocation?.[String(parsed.num)] ?? []);
  } catch {
    return new Set();
  }
}

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
  // C18 — within-chapter location-stamping (the ch2-of-4HWW "Princeton in every
  // scene" defect the QC bar caught but the gates missed). BLOCKER: calibrated
  // zero false-positives across the gold corpus (daring-greatly + start-with-why,
  // 21 ch), rework (v2), and the 14 clean 4HWW chapters; the location-context
  // narrowing spares central concepts/entities (Golden Circle, Basecamp, Rogers).
  // (C22/C23: renumbered from C18/C19 in Phase 4 — supportSectionAudit already
  // owned C11–C21, so the first rename onto C18/C19 reproduced the exact
  // catalog-collision class it was meant to fix. The check-registry test now
  // guards the namespace; next free id is C24+.)
  C22: "blocker",
  // C23 — same protagonist leads multiple example scenes. SHADOW=major: precise
  // and zero-FP in calibration, but no confirmed true-positive yet (the ch5/ch14
  // reuse is breakdown-vs-example, which C23 doesn't see), so it surfaces rather
  // than blocks until a real example-vs-example reuse confirms it.
  C23: "major",
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
  // D1's "short prompt, no application opener" case is authored as a soft hint
  // (minor) by checkQuizTestsApplication, but pushing it under "D1" re-stamped it
  // major and made it a convergence-blocking finding. Route the hint to its own
  // minor id so only the real recall-about-text case (D1, major) blocks.
  "D1.short_prompt": "minor",
  D2: "minor",
  // Reading level (E)
  E1: "major",
  // E2 — tier progression. Upgraded to blocker May 2026 after the Start With Why
  // incident shipped 14 chapters whose fastRead/deepRead/fullRead tiers all
  // opened with the same first sentence. If all three tiers open with the
  // same line, the tiers don't progress and the breakdown structure has no
  // pedagogical layering — a structural failure, not a stylistic one.
  E2: "blocker",
  E3: "minor",
  // E7 — plain language: simple vocabulary + short sentences across ALL
  // reader-facing fields (not just the breakdown tiers E1 scores). See
  // critics/plainLanguage.ts. complex_word is advisory (word choice is
  // contextual); run-ons and dense one-liners are majors.
  "E7.complex_word": "minor",
  "E7.long_sentence": "major",
  "E7.dense_headline": "major",
  // SL — scaffold leak: authoring scaffolding that surfaced as reader prose.
  // Format-tag tokens are unambiguous (underscore_forms can't occur in English),
  // so they BLOCK; domain-label paste and spectator-prop staging are majors.
  "SL1.format_tag_leak": "blocker",
  "SL2.domain_label_leak": "major",
  "SL3.spectator_prop": "major",
  // Quiz-quality critic (BP15–BP21, schema.quiz_*)
  "BP15.quiz_strawman_distractor": "major",
  "BP16.quiz_answer_length_blocker": "blocker",
  "BP16.quiz_answer_length_major": "major",
  "BP17.quiz_opener_monotony": "major",
  "BP18.quiz_label_shape_correct": "minor",
  // BP27 — answer-label leak: the key is identifiable from its choice label
  // alone (e.g. key "…move", every distractor "…misconception"). Lets a reader
  // ace the quiz without reading. Conservative detector (fires only when a
  // marker word makes the key uniquely identifiable), so it blocks.
  "BP27.quiz_answer_label_leak": "blocker",
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
  "AS5.chapter_quiz_prompt_matches_prior": "blocker",
  "AS6.chapter_quiz_distractor_matches_prior": "blocker",
  "AS7.chapter_card_matches_prior": "blocker",
  "AS8.chapter_plan_matches_prior": "blocker",
  "AS9.chapter_example_matches_prior": "blocker",
  "AS10.chapter_field_ngram_matches_prior": "blocker",
  "AS11.chapter_breakdown_paragraph_verbatim_prior": "blocker",
  "AS12.chapter_quiz_position_matches_prior": "blocker",
  // AS13 — within-chapter quiz template (June 2026 unreasonable-hospitality
  // incident). Chapter-time twin of book-wide BP20; catches a single chapter
  // whose nine questions collapse to one distractor skeleton, which previously
  // only surfaced at book-gate. Threshold ≥8 calibrated so coherent shared
  // content (≤7) clears while templated skeletons (≥9) block; the only promoted
  // books it flags are 3 that shipped pre-existing quiz templating (execution,
  // measure-what-matters, the-12-week-year) — true positives, not noise.
  "AS13.within_chapter_quiz_template": "blocker",
  "BP24.cross_tier_breakdown_verbatim": "blocker",
  // BP25 — statistical correct-is-longest rate (the distractor tell).
  // ADVISORY: catalog baseline is 68% incl. gold; threshold 0.78 fires only
  // on the worst offenders (drive 94%). Refresh target ≤45% lives in
  // catalog-audit + STEP-2; promote to major only after the catalog refresh.
  "BP25.quiz_correct_longest_rate": "minor",
  "BP26.exemplar_chapter_reuse": "minor",
  "BP27.venue_stamping": "major",
  // BP28/BP29 — the structural-sameness axes the model sweep caught on
  // the-daily-stoic (repeated_unit callback frames / location_stamping try-now
  // clock stamps) that no deterministic gate saw. BP28 is SHADOW major
  // (calibrated to zero on the clean corpus; promote to blocker only after a
  // reproducible clean zero + a confirmed true positive — the SC9-reversal
  // caution). BP29 is lexically FP-safe (clean corpus = zero try-now clock
  // stamps), so it is a fast blocker-promotion candidate once calibration holds.
  "BP28.callback_frame_reuse": "major",
  "BP29.timing_anchor_stamping": "major",
  // BP30 — try-now timer/calendar action-container DENSITY (location_stamping).
  // SHADOW major (surfaces, does not flip the gate): calibrated to zero on the
  // clean corpus by FRACTION (fires only when the scheduling container saturates
  // >= 50% of chapters; clean max is stillness 0.31), fires on the-daily-stoic
  // 0.67. Promote to blocker only after the clean-zero pin holds in CI and a
  // second true-positive confirms it (the SC9-reversal caution). The sibling
  // families repeated_unit/scene_skeleton get NO gate — not separable from clean.
  "BP30.action_container_reuse": "major",
  // BP31 — uniform Title-Case quiz choice labels: every choice wears a
  // "Label:" tag so the key is sortable by label valence without reading. SHADOW
  // major (zero across the clean+gold corpus; not in ENFORCED_MAJOR).
  "BP31.quiz_choice_label_uniform": "major",
  // Source grounding (May 2026 SWW round-1 root cause: invented scenarios with
  // zero reference to real source cases). SHADOW=major. A mid-session promotion to
  // blocker was REVERTED here: the verification pass proved the "zero-FP on gold"
  // claim FALSE — as a blocker SC9 fires on 16 of 21 gold (reference-quality)
  // chapters (daring-greatly 5/7, start-with-why 11/14) because well-grounded
  // scenes don't always name a source proper noun the way SC9 demands. SC9 is too
  // strict to be a hard blocker; it stays advisory and the semantic QC catches the
  // real ungrounded cases. (The earlier calibration run reported 0 only because the
  // gold sidecars weren't resolving at that moment — a fragile, non-reproducible 0.)
  "SC9.example_not_source_grounded": "major",
  // SC11.0 — no source run/sidecar on disk (Phase 0). SHADOW=major: missing
  // source reliably predicts word-salad, but it's advisory until Phase 3
  // guarantees every active book a resolvable sidecar (then → blocker).
  "SC11.0.no_source_run": "major",
  // SC11.1/.2 — declared provenance (Phase 3). v2-gated: fires only when the
  // chapter's sidecar is schemaVersion source-v2, so v1 chapters never brick.
  "SC11.1.missing_provenance": "blocker",
  "SC11.2.anchor_specific_not_present": "blocker",
};

/**
 * ENFORCED_MAJOR — the curated set of MAJOR catalog ids that additionally FAIL
 * `runShipGate().passed` (the per-chapter write self-gate), promoting them from
 * "surfaced QC debt" to "must fix before submit".
 *
 * It is **deliberately empty.** The audit proposed enforcing the high-frequency
 * REVISE drivers (C2/C3/E1/E4/E7/A13/C23) here, but a calibration over the 5 clean
 * reference books REFUTED that: every one of those critics fires on clean books
 * that shipped — often HARDER than on the book they were meant to catch. E4 fires
 * at 50% of paragraphs on a clean stillness chapter vs 43% on the-daily-stoic
 * defect; C23 fires on a clean stillness chapter doing the exact thing the stoic
 * defect does. There is no threshold that fires on the defect but not the clean
 * corpus, so enforcing any of them would retroactively fail reference-quality
 * books — the SC9-reversal trap. Those majors are handled by PREVENTION (the
 * writer cards / STEP-2 "write-time-preventable majors") + the model QC, which
 * judges them in context the way a deterministic gate cannot.
 *
 * An id belongs here ONLY after it is shown to fire ZERO times across the clean
 * corpus (guarded by the enforced-major calibration test). Adding one is then a
 * one-line change. Until a critic is made genuinely precise, this stays empty.
 */
export const ENFORCED_MAJOR = new Set<string>([]);

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
  const allocatedNames = allocatedNamesForChapter(chapter);

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
  // E7 — plain language (simple vocabulary + short sentences) across EVERY
  // reader-facing field. Closes the gap where only the breakdown tiers were
  // scored, so jargon/run-ons in quizzes, cards, examples, and headlines no
  // longer ship unflagged.
  for (const f of checkPlainLanguage(chapter)) {
    push(f.checkId as string, `plain_language`, f.message, f.evidence);
  }
  // SL — scaffold leak: format-tag tokens / domain-label paste / spectator-prop
  // staging surfacing as reader prose (the-book-of-boundaries shipped these in
  // 12/13 chapters). See critics/scaffoldLeak.ts.
  for (const f of checkScaffoldLeak(chapter)) {
    push(f.checkId as string, f.unit, f.message, f.evidence);
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

  // ── Example-slate coherence the deterministic gates missed but the 4HWW
  // semantic QC caught: (C11) one proper noun stamped across most scenes as a
  // shared setting (ch2 "Princeton University" in all six), and (C12) the same
  // protagonist leading multiple scenes (ch5/ch14). The thesis text exempts the
  // book's genuinely-central entity from C11.
  {
    // Exempt only the chapter's CORE TEACHING (keyTakeaway + counterintuition +
    // the sidecar's centralConcept/focus/coreClaim) — NOT the breakdown, which
    // discusses the examples and would launder a stamped location ("Princeton")
    // into the exemption. A genuinely central concept/entity ("Golden Circle")
    // lives in the core teaching and is correctly spared.
    const sc: any = loadChapterSidecar(chapter.chapterId) ?? {};
    const coreTeachingText = [
      chapter.keyTakeaway,
      chapter.counterintuition ?? "",
      sc.centralConcept?.name ?? "",
      sc.focus ?? "",
      sc.coreClaim ?? "",
    ].join(" \n ");
    for (const f of checkExampleSettingStamping(chapter.examples, coreTeachingText)) {
      push("C22", "examples", f.message, f.evidence);
    }
    for (const f of checkExampleProtagonistReuse(chapter.examples)) {
      push("C23", "examples", f.message, f.evidence);
    }
  }

  // ── SC9 source-grounding: each example scenario must reference at least
  // one proper-noun anchor from the chapter's source sidecar namedExamples.
  // Closes the May 2026 SWW round-1 root cause where scenarios were
  // invented (Anika at Oakland repair bay) with zero reference to Sinek's
  // real cases (American/Japanese car-door assembly, Wright brothers,
  // Apple, MLK, TiVo). Once scenarios are detached from source material,
  // templating naturally follows.
  for (const f of checkExampleSourceGrounding(chapter)) {
    push(f.checkId as string, "examples", f.message, f.evidence);
  }
  // SC11 — declared provenance (Phase 3, v2-gated; v1 chapters return [] → skip).
  for (const f of checkChapterProvenance(chapter)) {
    push(f.checkId as string, f.message.split(" ")[0] || "provenance", f.message, f.evidence);
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
      if (allocatedNames.has(name)) continue;
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
    // D1 — application vs recall. The critic's own severity decides the catalog id:
    // the recall-about-text case is a real major (D1); the short-prompt hint is a
    // minor (D1.short_prompt) and must not block convergence.
    for (const f of checkQuizTestsApplication(q as any)) push(f.severity === "minor" ? "D1.short_prompt" : "D1", unit, f.message, f.evidence);
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
  for (const f of checkQuizCorrectLongestRate(chapter.quiz)) {
    push(f.checkId as string, "quiz", f.message, f.evidence);
  }
  for (const f of checkQuizPromptOpenerMonotony(chapter.quiz)) {
    push(f.checkId as string, "quiz", f.message, f.evidence);
  }
  for (const f of checkQuizLabelShapedCorrect(chapter.quiz)) {
    push(f.checkId as string, `quiz.${extractQid(f.message)}`, f.message, f.evidence);
  }
  for (const f of checkQuizAnswerLabelLeak(chapter.quiz)) {
    push(f.checkId as string, `quiz.${extractQid(f.message)}`, f.message, f.evidence);
  }
  for (const f of checkQuizChoiceLabelUniform(chapter.quiz)) {
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
  // AS13 — within-chapter quiz template. Chapter-time twin of book-wide BP20:
  // catches a single chapter whose questions collapse to one distractor
  // skeleton (noun swapped per question). Without this the per-chapter gate
  // prints PASS on a fully templated chapter and the defect only surfaces at
  // book-gate (the June 2026 unreasonable-hospitality incident).
  for (const f of checkWithinChapterQuizTemplates(chapter)) {
    push(f.checkId as string, "quiz", f.message, f.evidence);
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

  // ── BP24 — cross-tier breakdown verbatim duplication ────────────────────
  // The May 2026 "7 Habits Step 2 second-round" incident: Ch3 DeepRead and
  // FullRead shared a 1,436-character verbatim block. The existing B8 critic
  // (prose.ts:checkCrossTierPhraseUniqueness) returns after the first 4-word
  // match and only emits one minor finding per chapter — it does not
  // escalate by total duplicated mass. BP24 catches large-block copy-paste
  // explicitly by computing the longest contiguous common substring between
  // each tier pair.
  for (const f of checkBreakdownCrossTierVerbatim(chapter)) {
    push(f.checkId as string, "breakdown.cross-tier", f.message, f.evidence);
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

  // The gate fails on any blocker OR any ENFORCED major (a curated, clean-corpus-
  // calibrated subset of majors that block the write self-gate). ENFORCED_MAJOR is
  // currently empty — see its definition for why no quality major is enforceable —
  // so this is presently equivalent to `blockers.length === 0`, but the mechanism
  // is wired and test-guarded so a genuinely-precise critic can be promoted in one
  // line without touching every `gate.passed` consumer.
  const enforcedMajors = majors.filter((f) => ENFORCED_MAJOR.has(f.catalogId));

  return {
    passed: blockers.length === 0 && enforcedMajors.length === 0,
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
