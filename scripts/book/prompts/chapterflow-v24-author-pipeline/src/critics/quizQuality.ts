/**
 * Quiz quality critic. The defect-class catalog learned from auditing 86
 * shipped v21 books — strawman distractors, oversized correct answers,
 * prompt-opener monotony, label-shaped right answers, lowercase choice
 * starts, in-question duplicates, validator-illegal fields, banned tail
 * clauses, cross-chapter template substitution, cross-chapter duplicate
 * distractors. Every check fail-closes at the ship gate so the writer's
 * retry loop must produce clean output or quarantine.
 *
 * Chapter-level checks operate on a single QuizV21. Book-level checks
 * (n-gram template detection, cross-chapter duplicate distractors) take
 * the assembled ChapterV21[] and run from runBookGate.
 *
 * Thresholds were calibrated against the audit run that found:
 *   - execution.v21: "Keep the old message…" × 80 across 10 chapters
 *   - the-12-week-year.v21: "until the team feels more certain delay the
 *     decision…" × 102 across 21 chapters
 *   - deep-work.v21: "Answer every visible request first so no one can
 *     accuse the team of being unavailable" × 9 across 9 chapters
 *   - the-one-thing.v21: "Ranking would make action impossible" verbatim
 *     in 6 chapters, "It proves easy tasks never matter" in 6 chapters
 *
 * All four shipped without any existing critic flagging them.
 */

import { ChapterV21, CriticFinding, QuizV21 } from "../types.js";
import { finding, truncate } from "./shared.js";

// ── Regex catalog ───────────────────────────────────────────────────────────

/**
 * Strawman trigger words. A non-correct choice that uses an absolute word
 * can usually be defeated without actually understanding the chapter — the
 * reader just picks the choice without an extreme word. Distractors should
 * be defeatable by the chapter's framework, not by an absolute trigger.
 */
const STRAWMAN_TRIGGER = /\b(always|never|automatically|impossible|guaranteed|entirely|ever|forever|completely|wholly|absolutely|under no circumstances|in all cases)\b/i;

/**
 * Verbs that legitimize a short correct-answer phrase. A correct answer of
 * ≤6 words without one of these reads as a label ("Cut charting time.")
 * rather than an action sentence ("Cut charting time during the day shift.").
 * The list is intentionally broad — false positives are preferred to false
 * negatives because labels are the failure mode.
 */
const VERB_HINT = /\b(is|are|was|were|be|been|being|has|have|had|do|does|did|can|could|should|would|will|may|might|must|name|build|cut|add|delete|remove|stop|start|run|pause|wait|trust|review|reset|reroute|track|set|map|check|read|write|ask|tell|listen|use|apply|treat|test|show|prove|reduce|increase|require|create|allow|prevent|enable|involve|describe|mean|reflect|indicate|imply|produce|stem|come|happen|occur|signal|aggregate|average|weight|filter|combine|compare|see|find|know|understand|expect|predict|forecast|estimate|interpret|choose|select|decide|consider|note|claim|argue|assert|deny|accept|reject|hold|prefer|favor|advise|recommend|lead|drive|influence|affect|change|shift|move|raise|lower|grow|shrink|focus|skip|cancel|withdraw|hand|devote)\b/i;

/**
 * Allowed keys on a QuizQuestion in the v21 native schema. Any other key
 * is rejected by the upstream validator at /api/book/_lib/validate-book-
 * package.ts (422 on unexpected fields), so we fail-close here too.
 * `correctAnswerIndex` is permitted as a legacy alias.
 */
const ALLOWED_QUESTION_KEYS = new Set([
  "questionId",
  "sourceAnchorId", // Phase 3 (v2) provenance — required by SC11 on v2 chapters; stripped at promote so it never reaches the package validator
  "prompt",
  "choices",
  "correctIndex",
  "correctAnswerIndex",
  "explanation",
  "bloomsLevel",
  "depthLevel",
]);

/**
 * Banned tail-clause phrases. These emerged repeatedly across the audited
 * books as templated wrong-answer suffixes inserted by fix-applier agents
 * during bulk distractor regeneration. Hardcoded here AND mirrored in
 * config/banned-phrases.json so the writer system prompt sees them.
 */
const BANNED_TAIL_CLAUSES: ReadonlyArray<string> = [
  "fits the immediate pressure around",
  "could make that choice seem workable",
  "gives that route a concrete rationale",
  "making the tradeoff feel defensible",
  "looks persuasive because the recent evidence is tidy",
  "while preserving the spirit of the original",
  "without disrupting the broader workflow",
  "given the constraints in play",
  "based on the available signal",
  "who is responsible for a",
  "until the team feels more certain",
  "delay the decision so",
  "can stay flexible",
  "keep the old message for now",
  "so the team does not lose energy",
  "answer every visible request first",
  "accuse the team of being unavailable",
  "remove every source of entertainment forever",
  "the memo is thin because strategic work should always be short",
  "ranking would make action impossible",
  "it proves easy tasks never matter",
  "choose the action with consequence over noise",
  "under the stated evidence test",
  "after checking the concrete source condition",
];

// ── Chapter-level checks ────────────────────────────────────────────────────

/**
 * BP15 — strawman distractor. A non-correct choice containing an absolute
 * trigger word is defeatable without the chapter's framework. Severity:
 * MAJOR — wrong but not corrupting. Writer should rewrite to a scenario-
 * anchored qualifier ("in most cases," "for the kind of judgments the
 * chapter describes") that preserves the wrong reading.
 */
// When the absolute sits inside a hypothetical/reported clause ("forgiveness
// requires acting AS IF the insult NEVER happened"), the absolute belongs to the
// misconception the stem is testing, not to a gratuitous strawman tell — so it is
// not a length/extremity giveaway. Suppress those; keep firing on a bare absolute
// claim ("this NEVER works").
const STRAWMAN_HYPOTHETICAL = /\b(as if|as though|pretend(?:s|ing)?|imagin\w+|act(?:s|ing)? as (?:if|though)|believe[s]? that)\b/i;

export function checkQuizStrawmanDistractors(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    const correct = pickCorrectIndex(q);
    if (correct == null) continue;
    for (let i = 0; i < (q.choices ?? []).length; i++) {
      if (i === correct) continue;
      const choice = q.choices[i];
      if (typeof choice !== "string") continue;
      const match = choice.match(STRAWMAN_TRIGGER);
      if (match) {
        // FP guard: absolute embedded in a hypothetical clause BEFORE the trigger
        // is part of the named misconception, not a strawman tell.
        const before = choice.slice(0, match.index ?? 0);
        if (STRAWMAN_HYPOTHETICAL.test(before)) continue;
        findings.push(
          finding(
            "BP15.quiz_strawman_distractor",
            "major",
            `${q.questionId} choice[${i}] uses absolute trigger "${match[0]}" — rewrite as a scenario-anchored wrong-but-plausible claim`,
            choice,
          ),
        );
      }
    }
  }
  return findings;
}

/**
 * BP16 — answer length ratio. Correct/avg-distractor length ratio reveals
 * length-bias gaming: when the right answer is 2× longer than wrong ones,
 * test-takers can pick correctly without reading. Threshold tiers:
 *   ratio ≥ 2.0 → BLOCKER
 *   ratio ≥ 1.5 → MAJOR
 */
export function checkQuizAnswerLengthRatio(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    const correct = pickCorrectIndex(q);
    if (correct == null) continue;
    const choices = q.choices ?? [];
    if (choices.length < 2) continue;
    const correctText = choices[correct];
    if (typeof correctText !== "string") continue;
    const cLen = wordCount(correctText);
    const distractors = choices.filter((_, i) => i !== correct);
    const distractorLens = distractors.map((c) => (typeof c === "string" ? wordCount(c) : 0));
    const avgDist = distractorLens.reduce((a, b) => a + b, 0) / Math.max(1, distractorLens.length);
    if (avgDist === 0) continue;
    const ratio = cLen / avgDist;
    if (ratio >= 2.0) {
      findings.push(
        finding(
          "BP16.quiz_answer_length_blocker" as any,
          "blocker",
          `${q.questionId} correct answer is ${ratio.toFixed(2)}× the average distractor length (${cLen}w vs ${avgDist.toFixed(1)}w avg) — shorten the correct choice or lengthen distractors with scenario-specific content`,
          correctText,
        ),
      );
    } else if (ratio >= 1.5) {
      findings.push(
        finding(
          "BP16.quiz_answer_length_major" as any,
          "major",
          `${q.questionId} correct answer is ${ratio.toFixed(2)}× the average distractor length (target <1.4) — readers can identify the correct answer by length alone`,
          correctText,
        ),
      );
    }
  }
  return findings;
}

/**
 * BP25 — statistical correct-is-longest rate (the "distractor tell").
 * BP16 catches a single question whose key is 1.5-2× longer; this catches
 * the subtler chapter-level pattern the 2026-06-10 reader review exposed:
 * the keyed answer is merely the LONGEST choice, by any margin, in nearly
 * every question — so a test-wise reader scores 9/9 without reading the
 * chapter. Catalog baseline at introduction: 68% of all questions
 * (drive 94%, dare-to-lead 82%); gold sits at ~68%, so the threshold is
 * set ABOVE gold (advisory fires only on the worst offenders) while the
 * refresh target (≤45%, ~chance for 3 choices) lives in catalog-audit and
 * STEP-2 guidance. ADVISORY (minor) — campaign-mode signal, not a gate.
 */
const CORRECT_LONGEST_RATE_ADVISORY = 0.78;

export function checkQuizCorrectLongestRate(quiz: QuizV21): CriticFinding[] {
  let eligible = 0;
  let longest = 0;
  for (const q of quiz.questions ?? []) {
    const correct = pickCorrectIndex(q);
    if (correct == null) continue;
    const choices = q.choices ?? [];
    if (choices.length < 2 || typeof choices[correct] !== "string") continue;
    eligible++;
    if (choices.every((c, i) => i === correct || (typeof c === "string" ? c.length : 0) < choices[correct].length)) {
      longest++;
    }
  }
  if (eligible < 4) return [];
  const rate = longest / eligible;
  if (rate < CORRECT_LONGEST_RATE_ADVISORY) return [];
  return [
    finding(
      "BP25.quiz_correct_longest_rate" as any,
      "minor",
      `keyed answer is the longest choice in ${longest}/${eligible} questions (${(rate * 100).toFixed(0)}%) — a test-wise reader can ace this quiz by length alone. Balance choice lengths: give distractors scenario-specific substance or trim the keys (refresh target ≤45%).`,
      `${longest}/${eligible}`,
    ),
  ];
}

/**
 * BP17 — prompt opener monotony. When >5 of 9 prompts in a chapter open
 * with "A " or "An ", the quiz reads as a single template ("A manager…",
 * "A founder…", "A nurse…"). Severity: MAJOR.
 */
export function checkQuizPromptOpenerMonotony(quiz: QuizV21): CriticFinding[] {
  const questions = quiz.questions ?? [];
  if (questions.length < 7) return []; // floor: ignore very-short quizzes
  let aanCount = 0;
  for (const q of questions) {
    if (typeof q.prompt === "string" && /^An? [A-Z]/.test(q.prompt)) aanCount++;
  }
  // threshold: ≤5 of 9 (or proportionally for other counts)
  const threshold = Math.ceil(questions.length * (5 / 9));
  if (aanCount > threshold) {
    return [
      finding(
        "BP17.quiz_opener_monotony" as any,
        "major",
        `${aanCount} of ${questions.length} prompts open with "A/An " (max ${threshold}) — vary openers using conditional ("When a manager…"), second-person ("Your team…"), or claim-evaluation ("A colleague argues…") openers`,
      ),
    ];
  }
  return [];
}

/**
 * BP33 — causal-attribution key shape (W3, FINAL-HARDENING-PLAN 2026-07-04;
 * BROADENED 2026-07-04 after the start-with-why gold run: ch02/ch05 Q2 keyed a
 * remedy/outcome that did NOT open with an imperative verb, so the narrow
 * incident-1 check missed them while the blinded reader caught them).
 *
 * A causal stem ("why did X", "what caused X", "what led to X", …) demands a
 * key that names the specific CAUSE the prose shows. This critic flags THREE
 * mechanically-detectable bad key shapes — each a shape, never a semantic
 * judgement (key QUALITY stays with the blinded readers + the key-judge; the
 * standing CHB14/15/17 rule: lexical quiz-QUALITY gates measured INVERTED on
 * the owner top-5 → BP33 is ADVISORY (minor), never a blocker):
 *   (a) remedy shape   — the key opens as an imperative prescription
 *                        ("Schedule a weekly review"); a fix isn't a past cause.
 *   (b) moral shape    — the key opens as a generic aphorism / advice
 *                        ("Always start with why", "The lesson is …"); a moral
 *                        isn't a cause.
 *   (c) outcome-restatement — the key's content words are ≥70% a subset of the
 *                        stem's own words and it introduces NO new causal noun;
 *                        it just repeats what happened instead of why.
 * Distractor-family soundness and "multiple arguably-correct" are semantic and
 * remain with the reader instrument (readerReview PROCESS step 1). Calibrated
 * zero-FP over the shipped corpus before landing.
 */
export const CAUSAL_STEM_RX = /\b(why did|why was|why were|why had|what caused|what was causing|what led to|what explains|what accounts for|(?:the|a) (?:main|primary|root|real|underlying) (?:reason|cause|driver))\b/i;
const IMPERATIVE_LEAD_RX = /^\s*(?:schedule|set|assign|create|run|hold|write|start|stop|build|book|block|put|make|give|send|ask|meet|review|track|plan|pick|choose|add|remove|cut|define|establish|institute|adopt|implement|introduce|launch|require|commit|rotate|pair|split|shorten|lengthen|replace|swap|delegate|escalate|document|standardize|automate)\b/i;
/** Generic moral / advice lead — an aphorism, not a cause of a past outcome. */
const MORAL_ADVICE_LEAD_RX = /^\s*(?:always|never|you (?:should|must|need to|have to)|it'?s (?:important|essential|crucial|vital|key|best)|the (?:key|lesson|takeaway|point|goal|trick|secret|answer|moral) (?:is|was)|focus on|remember (?:to|that)|make sure|be sure to|prioriti[sz]e|don'?t forget|strive to|aim to)\b/i;

/** Stopwords stripped before the outcome-restatement content-word overlap. */
const CAUSAL_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "by", "as",
  "at", "from", "into", "that", "this", "these", "those", "it", "its", "was", "were", "is",
  "are", "be", "been", "being", "did", "does", "do", "had", "has", "have", "why", "what",
  "how", "when", "who", "which", "them", "they", "their", "his", "her", "our", "your",
  "would", "could", "should", "will", "than", "then", "so", "because", "about", "over",
]);

function causalContentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []).filter((w) => !CAUSAL_STOPWORDS.has(w));
}

export function checkQuizCausalKeyShape(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    const prompt = typeof q.prompt === "string" ? q.prompt : "";
    if (!CAUSAL_STEM_RX.test(prompt)) continue;
    const correct = pickCorrectIndex(q);
    if (correct == null) continue;
    const correctText = q.choices?.[correct];
    if (typeof correctText !== "string") continue;

    let shape: string | null = null;
    if (IMPERATIVE_LEAD_RX.test(correctText)) {
      shape = "opens as an imperative prescription — a remedy cannot be the cause of a past outcome";
    } else if (MORAL_ADVICE_LEAD_RX.test(correctText)) {
      shape = "opens as a generic moral/advice aphorism — a lesson is not the cause the stem asks for";
    } else {
      // (c) outcome-restatement: the key adds no cause-word the stem didn't
      // already have. Guard on a minimum key length so terse legitimate keys
      // ("Loss aversion.") aren't judged on a 1-word overlap.
      const keyWords = causalContentWords(correctText);
      const stemWords = new Set(causalContentWords(prompt));
      if (keyWords.length >= 3) {
        const shared = keyWords.filter((w) => stemWords.has(w)).length;
        if (shared / keyWords.length >= 0.7) {
          shape = "restates the stem's own outcome words and introduces no new cause — key the specific mechanism the prose shows, not a paraphrase of what happened";
        }
      }
    }
    if (shape) {
      findings.push(
        finding(
          "BP33.causal_key_remedy_shape" as any,
          "minor",
          `${q.questionId} stem asks for a CAUSE ("${truncate(prompt, 80)}") but the keyed choice ${shape}`,
          correctText,
        ),
      );
    }
  }
  return findings;
}

/**
 * BP18 — label-shaped correct answer. A correct answer of ≤6 words with no
 * verb reads as a label ("Cut charting time.") rather than a complete
 * action ("Cut charting time during the day shift."). Severity: MINOR.
 * Mostly diagnostic; not a blocker because edge cases (legitimate short
 * answers like "Yes, with disclosure") trigger false positives.
 */
export function checkQuizLabelShapedCorrect(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    const correct = pickCorrectIndex(q);
    if (correct == null) continue;
    const correctText = q.choices?.[correct];
    if (typeof correctText !== "string") continue;
    const wc = wordCount(correctText);
    if (wc <= 6 && !VERB_HINT.test(correctText)) {
      findings.push(
        finding(
          "BP18.quiz_label_shape_correct" as any,
          "minor",
          `${q.questionId} correct answer is ${wc} words and label-shaped (no verb) — expand to a complete action sentence`,
          correctText,
        ),
      );
    }
  }
  return findings;
}

/**
 * Schema — duplicate choices within a single question. Renders as two
 * literally-identical options. Severity: BLOCKER (corrupts the question).
 */
/**
 * Answer-label leak (BP27). When choices carry a leading "Label: sentence"
 * tag, the correct answer must NOT be identifiable from its label alone. The
 * boundaries-book regen shipped two chapters where the key was always labelled
 * "…move" and every distractor "…misconception" — a reader could ace the quiz
 * without reading a word. We fire ONLY on the unambiguous signal: every
 * distractor's label carries an explicit wrongness marker (misconception / myth
 * / misread / …) that the key's label lacks, so the reader just picks the one
 * choice NOT branded wrong. Neutral named-misconception labels (the GOOD pattern
 * — "The Courtesy Cover / The Signal Read / The Endurance Bet") carry no marker
 * and never fire; a key legitimately labelled "best/right/sound" is NOT flagged
 * (those words are too common to treat as a tell without false positives). */
const WRONGNESS_LABEL_MARKER = /\b(misconception|misreads?|myth|fallacy|mistaken?|errors?|fails?)\b/i;

function choiceLabel(choice: unknown): string {
  if (typeof choice !== "string") return "";
  const i = choice.indexOf(": ");
  return i > 0 ? choice.slice(0, i) : "";
}

export function checkQuizAnswerLabelLeak(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    const correct = pickCorrectIndex(q);
    if (correct == null) continue;
    const choices = q.choices ?? [];
    if (choices.length < 2) continue;
    const labels = choices.map(choiceLabel);
    if (labels.filter((l) => l.trim()).length < choices.length) continue; // every choice must carry a "Label: …" tag
    const keyWrong = WRONGNESS_LABEL_MARKER.test(labels[correct]);
    const distractorLabels = labels.filter((_, j) => j !== correct);
    const distractorsAllBrandedWrong = distractorLabels.length > 0 && distractorLabels.every((l) => WRONGNESS_LABEL_MARKER.test(l));
    if (distractorsAllBrandedWrong && !keyWrong) {
      findings.push(
        finding(
          "BP27.quiz_answer_label_leak" as any,
          "blocker",
          `${q.questionId} every distractor's label is branded a misconception/myth while the key's is not, so the correct answer is identifiable from the LABELS alone — relabel so no label reveals which choice is right`,
          truncate(choices[correct] as string, 120),
        ),
      );
    }
  }
  return findings;
}

/**
 * Uniform Title-Case choice labels (BP31). Every choice wearing a Title-Case
 * "Label: sentence" tag ("Private Self-Governance: …" / "Status Proof: …" /
 * "Audience Craft: …") lets a reader sort the key by the VALENCE of the labels
 * alone — the key's tag reads virtuous, the distractors' tags self-condemn —
 * without engaging the chapter. This is the-daily-stoic's quiz_distractor_quality
 * REVISE driver (54/108 questions; the bar floors the axis to ~0.54). It is the
 * lexical, deterministically-separable half of the defect: ALL-three-Title-Case-
 * labelled is ZERO across the entire clean+gold corpus (year-of-less, drive,
 * range, four-thousand-weeks, rework, the-let-them-theory, unreasonable-
 * hospitality, gifts-of-imperfection, daring-greatly, start-with-why) and 54 on
 * the-daily-stoic. We fire ONLY on this all-uniform Title-Case signal — the
 * any-case / asymmetric label form is NOT separable (clean unreasonable-
 * hospitality carries 26 asymmetric any-case labels and shipped), so the
 * key-plain / distractors-labelled variant stays the writer-card ban + the model
 * bar's job (the SC9 caution). SHADOW major: surfaces and names the question
 * without flipping the gate; BP27 (explicit wrongness-marker labels) remains the
 * blocker for its narrower case.
 *
 * A "Title-Case label" = 1–4 tokens, each capitalised (hyphens/apostrophes
 * allowed inside a token), before the first ": ". A sentence that merely
 * contains ": " ("She said: stop") is not a label — "said" is lowercase — and
 * the all-choices condition means a single stray dialogue colon never fires.
 */
const TITLE_CASE_LABEL = /^[A-Z][A-Za-z0-9'\-]*(?:[ ][A-Z][A-Za-z0-9'\-]*){0,3}$/;

function isTitleCaseLabel(choice: unknown): boolean {
  return TITLE_CASE_LABEL.test(choiceLabel(choice));
}

export function checkQuizChoiceLabelUniform(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    const choices = q.choices ?? [];
    if (choices.length < 2) continue;
    if (!choices.every(isTitleCaseLabel)) continue;
    const labels = choices.map((c) => `"${choiceLabel(c)}:"`).join(", ");
    findings.push(
      finding(
        "BP31.quiz_choice_label_uniform" as any,
        "major",
        `${q.questionId} every choice wears a Title-Case category label (${labels}) — a reader can sort the key by the labels' valence without reading the chapter. Drop the labels: write every choice as a plain sentence in the same register, so only meaning separates the key.`,
        truncate((choices as string[]).join(" | "), 160),
      ),
    );
  }
  return findings;
}

/**
 * Pronoun / referent drift (BP32). A quiz question whose STEM establishes the
 * protagonist's gender with pronouns (she/her vs he/his) while its CHOICES answer
 * with the OPPOSITE gendered pronoun — e.g. the-daily-stoic ch03 "Selma drafts a post…
 * how patient *she* looked" with choices "*He* should correct *his* motive". This is
 * name-swap RESIDUE: a `--all` re-dispatch renamed the stem protagonist (a different
 * gender) but the choice pronouns were never updated. No deterministic gate caught it,
 * so it leaked to the model bar as quiz_distractor_quality and only surfaced once it
 * became the binding axis (3rd QC round). [[gpt-pipeline-run-daily-stoic-2026-06-16]]
 *
 * We fire ONLY on an UNAMBIGUOUS stem-gender vs choice-gender CONFLICT — both sides
 * must each resolve to a single, opposite gender. A question with mixed pronouns (a
 * two-person scene) or no pronouns resolves to null and NEVER fires, so the signal is
 * a pure internal contradiction with zero name→gender guessing. SHADOW major (surfaces
 * + names the question without flipping the gate). A1 (planNames forceFresh on `--all`)
 * prevents the residue at source; this is the deterministic safety net.
 */
const FEMALE_PRONOUN = /\b(?:she|her|hers|herself)\b/gi;
const MALE_PRONOUN = /\b(?:he|him|his|himself)\b/gi;

/** A single gender when the text's gendered pronouns are present and ALL agree;
 *  null when there are none or they are mixed (undetermined → never fires). */
function pronounGender(text: string): "she/her" | "he/him" | null {
  const f = (text.match(FEMALE_PRONOUN) ?? []).length;
  const m = (text.match(MALE_PRONOUN) ?? []).length;
  if (f > 0 && m === 0) return "she/her";
  if (m > 0 && f === 0) return "he/him";
  return null;
}

export function checkQuizPronounReferent(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    const stemGender = pronounGender(q.prompt ?? "");
    if (!stemGender) continue;
    const choiceGender = pronounGender((q.choices ?? []).join("  "));
    if (!choiceGender) continue;
    if (stemGender !== choiceGender) {
      findings.push(
        finding(
          "BP32.quiz_pronoun_referent_mismatch" as any,
          "major",
          `${q.questionId} the stem refers to the protagonist as "${stemGender}" but the choices answer with "${choiceGender}" — a pronoun/referent mismatch (usually name-swap residue). Make the choices' pronouns match the stem's protagonist.`,
          truncate(`${q.prompt} | ${(q.choices ?? []).join(" / ")}`, 200),
        ),
      );
    }
  }
  return findings;
}

export function checkQuizDuplicateChoices(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    const choices = q.choices ?? [];
    const seen = new Set<string>();
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      if (typeof c !== "string") continue;
      const key = c.toLowerCase().trim();
      if (seen.has(key)) {
        findings.push(
          finding(
            "schema.quiz_duplicate_choice" as any,
            "blocker",
            `${q.questionId} choice[${i}] is a duplicate of a prior choice — corrupts the multiple-choice contract`,
            c,
          ),
        );
      }
      seen.add(key);
    }
  }
  return findings;
}

/**
 * Schema — lowercase choice start. Choices that begin with a lowercase
 * letter present poorly and signal generation errors. Severity: MAJOR.
 */
export function checkQuizLowercaseChoiceStart(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    for (let i = 0; i < (q.choices ?? []).length; i++) {
      const c = q.choices[i];
      if (typeof c !== "string") continue;
      const trimmed = c.replace(/^[\s"'“‘«\[]+/, "");
      if (!trimmed) continue;
      const first = trimmed.charAt(0);
      if (/[a-z]/.test(first)) {
        findings.push(
          finding(
            "schema.quiz_lowercase_choice_start" as any,
            "major",
            `${q.questionId} choice[${i}] starts with a lowercase letter — capitalize the first word`,
            c.slice(0, 120),
          ),
        );
      }
    }
  }
  return findings;
}

/**
 * Schema — unexpected field on a quiz question. The upstream validator
 * rejects any field outside the allowed set with a 422 response. Severity:
 * BLOCKER. Common offender: `whyItMatters` (belongs on examples, not quiz).
 */
export function checkQuizUnexpectedFields(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    for (const key of Object.keys(q)) {
      if (!ALLOWED_QUESTION_KEYS.has(key)) {
        findings.push(
          finding(
            "schema.quiz_unexpected_field" as any,
            "blocker",
            `${q.questionId} carries field "${key}" outside the allowed set — upstream validator returns 422`,
            JSON.stringify((q as any)[key]).slice(0, 120),
          ),
        );
      }
    }
  }
  return findings;
}

/**
 * BP19 — banned tail-clause phrase. Every entry in BANNED_TAIL_CLAUSES is
 * a phrase that emerged across multiple books during bulk distractor
 * regeneration. Their presence reliably indicates template substitution.
 * Severity: BLOCKER.
 */
export function checkQuizBannedTailPhrase(quiz: QuizV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const q of quiz.questions ?? []) {
    const allText = [q.prompt, ...(q.choices ?? []), q.explanation ?? ""].join(" ").toLowerCase();
    for (const banned of BANNED_TAIL_CLAUSES) {
      if (allText.includes(banned)) {
        findings.push(
          finding(
            "BP19.quiz_banned_tail_phrase" as any,
            "blocker",
            `${q.questionId} contains banned template phrase "${banned}" — rewrite using scenario-specific language`,
            banned,
          ),
        );
        break; // one finding per question is enough
      }
    }
  }
  return findings;
}

// ── Book-level checks (run from bookGate) ───────────────────────────────────

/**
 * BP20 — quiz n-gram template repeat. Detects the catastrophic template
 * substitution failure mode where a fixed phrase appears in distractors
 * across many chapters. Thresholds chosen against the 86-book audit:
 *   - 5-word phrase appearing ≥ 20 times → BLOCKER
 *   - 6-word phrase appearing ≥ 10 times → BLOCKER
 *   - 8-word phrase appearing ≥ 5 times  → BLOCKER
 * Lower thresholds for longer phrases because long verbatim spans
 * coincidentally repeating is essentially impossible.
 */
export function checkBookQuizNgramTemplates(chapters: ChapterV21[]): CriticFinding[] {
  const allWords: string[] = [];
  for (const ch of chapters) {
    for (const q of ch.quiz?.questions ?? []) {
      // Scan PROMPT first — this is where the May 2026 Covey incident slipped
      // a "Which X move should a analyst make" skeleton past the gate
      // because the critic originally only checked choices.
      if (typeof q.prompt === "string" && q.prompt) {
        allWords.push(...q.prompt.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean));
      }
      // Then choices (original behavior — catches distractor templates).
      for (const c of q.choices ?? []) {
        if (typeof c !== "string") continue;
        const tokens = c.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
        allWords.push(...tokens);
      }
      // Then explanation — same defect class can hide there.
      if (typeof q.explanation === "string" && q.explanation) {
        allWords.push(...q.explanation.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean));
      }
    }
  }

  const findings: CriticFinding[] = [];
  const windows: Array<{ n: number; threshold: number }> = [
    { n: 8, threshold: 5 },
    { n: 6, threshold: 10 },
    { n: 5, threshold: 20 },
  ];

  // Deduplicate overlapping reports. When a long run of identical text exists
  // (e.g., a 13-word boilerplate distractor), the n-gram window slides across
  // it and produces N adjacent overlapping n-grams, each with the same high
  // count. We want one finding per template instance, not one per window
  // position. Strategy: when we report a phrase, lock out every internal
  // 4-gram from future reports. Any sliding-window neighbor of a template
  // instance shares a 4-gram with it, so the lockout catches the whole
  // template family in one finding. Unrelated templates that happen to share
  // a 4-gram are rare enough that the small false-negative rate is acceptable
  // versus the much worse over-reporting failure.
  const locked4grams = new Set<string>();
  for (const { n, threshold } of windows) {
    if (allWords.length < n) continue;
    const counts = new Map<string, number>();
    for (let i = 0; i <= allWords.length - n; i++) {
      const phrase = allWords.slice(i, i + n).join(" ");
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
    const offenders = [...counts.entries()]
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1]);
    for (const [phrase, count] of offenders) {
      const tokens = phrase.split(" ");
      const fingerprints = collectNGramFingerprints(tokens, 4);
      const overlap = [...fingerprints].some((fp) => locked4grams.has(fp));
      if (overlap) continue;
      for (const fp of fingerprints) locked4grams.add(fp);
      findings.push(
        finding(
          "BP20.quiz_ngram_template_repeat" as any,
          "blocker",
          `${n}-word phrase appears ${count} times across quiz choices book-wide — template substitution. Rewrite distractors with scenario-specific language; no 5+ word phrase should repeat across chapters`,
          phrase,
        ),
      );
    }
  }
  return findings;
}

/** Return every contiguous k-gram of `tokens` as space-joined strings. Used to
 *  fingerprint a phrase for deduplication: if any k-gram of a candidate phrase
 *  matches a k-gram of an already-reported phrase, they are part of the same
 *  template instance (sliding-window neighbors). */
function collectNGramFingerprints(tokens: string[], k: number): Set<string> {
  const out = new Set<string>();
  if (tokens.length < k) {
    out.add(tokens.join(" "));
    return out;
  }
  for (let i = 0; i <= tokens.length - k; i++) {
    out.add(tokens.slice(i, i + k).join(" "));
  }
  return out;
}

/**
 * AS13 — within-chapter quiz template repeat. The chapter-time, single-chapter
 * twin of BP20 (which only fires book-wide at book-gate). A writer agent can
 * collapse one chapter's nine quiz questions into a single distractor skeleton
 * with a noun swapped per question. Because BP20's thresholds are tuned for the
 * book-wide corpus (5-word ≥20×) and the intra-book AS5/AS6 critics only compare
 * a chapter against PRIOR siblings, the very first corrupted chapter — and every
 * corrupted chapter viewed in isolation — passes the per-chapter ship gate, so
 * gate-chapter prints "PASS" on a fully templated chapter. This is the
 * unreasonable-hospitality (June 2026) incident: all 9 questions per chapter
 * shared "<Name> should copy <CONCEPT> as a fixed performance, even though the
 * present cue says otherwise" and the chapter gate still reported PASS.
 *
 * Detection: pool a single chapter's quiz prompts + choices + explanations into
 * one token stream (same fields as BP20) and count repeated 8-word phrases.
 * Threshold ≥8 calibrated against the full corpus: legitimate coherent content
 * (e.g. the-black-swan ch6's shared prompt stem, with real distinct questions
 * beneath it) tops out at 7 within-chapter 8-gram repeats, while a templated
 * skeleton reused once per question hits ≥9 (every corrupted unreasonable-
 * hospitality chapter is ≥9). The 7/9 gap is the zero-false-positive separator.
 * Across all 1,406 promoted chapters AS13 flags 46 — but all 46 are confined to
 * three books (execution, measure-what-matters, the-12-week-year) that shipped
 * with documented quiz-explanation templating PREDATING this critic (execution
 * and the-12-week-year are named in this file's header above). Those are true
 * positives surfacing pre-existing debt; the other 89 books / 1,360 chapters
 * produce zero flags. Severity: BLOCKER.
 */
export function checkWithinChapterQuizTemplates(chapter: ChapterV21): CriticFinding[] {
  const words: string[] = [];
  for (const q of chapter.quiz?.questions ?? []) {
    if (typeof q.prompt === "string" && q.prompt) {
      words.push(...q.prompt.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean));
    }
    for (const c of q.choices ?? []) {
      if (typeof c !== "string") continue;
      words.push(...c.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean));
    }
    if (typeof q.explanation === "string" && q.explanation) {
      words.push(...q.explanation.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean));
    }
  }

  const N = 8;
  const THRESHOLD = 8;
  if (words.length < N) return [];

  const counts = new Map<string, number>();
  for (let i = 0; i <= words.length - N; i++) {
    const phrase = words.slice(i, i + N).join(" ");
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }

  // Same dedup strategy as BP20: a long verbatim skeleton produces many adjacent
  // overlapping 8-grams, all over threshold. Report one finding per template
  // family by locking out every internal 4-gram once a phrase is reported.
  const locked4grams = new Set<string>();
  const findings: CriticFinding[] = [];
  const offenders = [...counts.entries()]
    .filter(([, count]) => count >= THRESHOLD)
    .sort((a, b) => b[1] - a[1]);
  for (const [phrase, count] of offenders) {
    const tokens = phrase.split(" ");
    const fingerprints = collectNGramFingerprints(tokens, 4);
    if ([...fingerprints].some((fp) => locked4grams.has(fp))) continue;
    for (const fp of fingerprints) locked4grams.add(fp);
    findings.push(
      finding(
        "AS13.within_chapter_quiz_template" as any,
        "blocker",
        `${N}-word phrase repeats ${count}× within this chapter's quiz — the questions share one templated skeleton with a noun swapped per question. Rewrite each question's prompt and distractors with scenario-specific language; no 8-word span should recur across a chapter's own questions.`,
        phrase,
      ),
    );
  }
  return findings;
}

/**
 * BP21 — cross-chapter duplicate distractor. The same wrong choice text
 * appearing verbatim in multiple chapters (e.g., "Ranking would make action
 * impossible" across 6 chapters of the-one-thing) is a generation artifact,
 * not authored content. Severity: BLOCKER.
 */
export function checkBookQuizCrossChapterDuplicates(chapters: ChapterV21[]): CriticFinding[] {
  const seen = new Map<string, Array<{ chapter: number; questionId: string; index: number }>>();
  for (const ch of chapters) {
    for (const q of ch.quiz?.questions ?? []) {
      const correct = pickCorrectIndex(q);
      if (correct == null) continue;
      for (let i = 0; i < (q.choices ?? []).length; i++) {
        if (i === correct) continue; // ignore correct-answer duplicates — different defect class
        const c = q.choices[i];
        if (typeof c !== "string") continue;
        const key = c.toLowerCase().trim();
        if (!key || key.length < 30) continue; // ignore short choices (legitimate to repeat "It depends.")
        const list = seen.get(key) ?? [];
        list.push({ chapter: ch.number, questionId: q.questionId, index: i });
        seen.set(key, list);
      }
    }
  }

  const findings: CriticFinding[] = [];
  for (const [text, occurrences] of seen.entries()) {
    if (occurrences.length < 2) continue;
    // Only flag if the duplicates span multiple chapters.
    const distinctChapters = new Set(occurrences.map((o) => o.chapter));
    if (distinctChapters.size < 2) continue;
    const locs = occurrences
      .map((o) => `Ch${o.chapter} ${o.questionId} #${o.index}`)
      .join(", ");
    findings.push(
      finding(
        "BP21.quiz_cross_chapter_duplicate" as any,
        "blocker",
        `distractor text duplicated across ${distinctChapters.size} chapters (${occurrences.length} total occurrences: ${locs}) — rewrite each per-chapter using the prompt's specific actor and scenario`,
        truncate(text, 160),
      ),
    );
  }
  return findings;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function pickCorrectIndex(q: any): number | null {
  const c = q?.correctIndex ?? q?.correctAnswerIndex;
  if (typeof c !== "number") return null;
  if (c < 0 || c >= (q?.choices?.length ?? 0)) return null;
  return c;
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}
