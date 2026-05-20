/**
 * Support-section audit (C11–C15).
 *
 * The breakdown audits (B-series) and per-example checks (C1–C10) caught
 * breakdown/example defects but missed a defect class that shipped 48 Laws of
 * Power and partially 12 Week Year: the support sections (reviewCards, quiz,
 * implementationPlan) generated from a template skeleton with one substituted
 * label, so every card's `back` field was literally identical, every quiz
 * prompt shared an 8+ word prefix, and example scenarios contained title-
 * keyword injection like "the say email" / "the much memo" / "the always
 * scene". score-chapters.ts gave these chapters 20/20 on examples and 5/5 on
 * cards because the rubric only checked structural counts.
 *
 * Severity choices:
 *   C11 BLOCKER — duplicate reviewCard backs make spaced repetition useless;
 *     the reader sees the same answer 5 times.
 *   C12 BLOCKER — template quiz prompts test recognition of a label, not the
 *     skill the chapter teaches.
 *   C13 BLOCKER — title-keyword injection produces grammatical garbage like
 *     "the say email"; the chapter is unshipable.
 *   C14 BLOCKER — trailing-fragment text ("…into being silent in e") indicates
 *     truncation during generation; the field is incomplete.
 *   C15 MAJOR — role/domain mismatch ("nurse Chris" in "architecture critique")
 *     suggests a template substituted entities without checking coherence.
 */

import { ChapterV21 } from "../types.js";
import { finding } from "./shared.js";

export type SupportFinding = {
  checkId: string;
  severity: "blocker" | "major" | "minor";
  unit: string;
  message: string;
  evidence?: string;
};

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for", "from",
  "had", "has", "have", "he", "her", "his", "how", "if", "in", "into", "is",
  "it", "its", "no", "not", "of", "on", "or", "our", "out", "over", "she",
  "so", "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "this", "those", "to", "too", "up", "was", "we", "were", "what",
  "when", "where", "which", "while", "who", "why", "will", "with", "you",
  "your",
]);

// Title lemmas to check for injection. These are words that are NOT nouns
// and therefore can never legitimately appear in "the <lemma> <noun>"
// constructions. The defect we're catching is e.g. "the say email" (verb
// forced as adjective), "the always scene" (adverb forced as adjective),
// "the much memo" (quantifier forced as adjective). Nouns appearing in
// titles like "Behavior", "Body", "Conversation", "Power" can naturally
// form noun-noun compounds and are NOT flagged.
const TITLE_INJECTION_TRIGGER_LEMMAS = new Set([
  // Adverbs
  "always", "never", "often", "rarely", "seldom", "sometimes", "usually",
  // Verbs commonly appearing in self-help title imperatives
  "say", "do", "get", "make", "take", "give", "go", "find", "win", "lose",
  "build", "break", "stop", "start", "keep", "learn", "ask", "tell", "show",
  "see", "hear", "speak", "talk", "use", "play", "court", "crush", "guard",
  "conceal", "appear", "seem", "pose", "strike", "concentrate", "control",
  "master", "preach", "disdain", "create", "avoid", "discover", "enter",
  "plan",
  // Quantifiers / comparatives
  "much", "less", "more", "fewer", "many", "few",
  // Other clearly non-noun title words
  "not", "only", "even", "still",
]);

/**
 * C11 — identical review-card backs.
 *
 * Triggers when every back in a chapter is literally identical (after trimming).
 * The legitimate use of similar backs is when two cards drill the same retrieval
 * cue from different angles; identical-across-all-cards is always a template
 * artifact.
 */
export function checkReviewCardBackDuplication(
  cards: ChapterV21["reviewCards"],
): SupportFinding[] {
  if (!cards || cards.length < 2) return [];
  const backs = cards.map((c) => (c.back ?? "").trim());
  if (backs.length < 2) return [];

  // All identical
  if (backs.every((b) => b === backs[0])) {
    return [{
      checkId: "C11.identical_backs",
      severity: "blocker",
      unit: "reviewCards",
      message: `all ${backs.length} reviewCard.back fields are literally identical — template artifact, retrieval value is zero`,
      evidence: backs[0].slice(0, 200),
    }];
  }

  // Or ≥ 80% pairwise identical (template with one outlier)
  let identicalPairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < backs.length; i++) {
    for (let j = i + 1; j < backs.length; j++) {
      totalPairs++;
      if (backs[i] === backs[j]) identicalPairs++;
    }
  }
  if (totalPairs > 0 && identicalPairs / totalPairs >= 0.8) {
    return [{
      checkId: "C11.mostly_identical_backs",
      severity: "blocker",
      unit: "reviewCards",
      message: `${identicalPairs}/${totalPairs} reviewCard.back pairs are identical — template artifact`,
      evidence: backs[0].slice(0, 200),
    }];
  }
  return [];
}

/**
 * C12 — template quiz prompts.
 *
 * Triggers when ≥ 2 quiz questions share an 8+ word prefix or share a
 * distinctive 8+ word substring. Real prompts vary across questions because
 * each question instantiates a different scenario; a template instantiates
 * the same skeleton with one substituted noun.
 */
export function checkQuizPromptTemplate(
  quiz: ChapterV21["quiz"],
): SupportFinding[] {
  if (!quiz?.questions || quiz.questions.length < 2) return [];
  const prompts = quiz.questions.map((q) => (q.prompt ?? "").trim());

  // Substring n-gram check: find 8-grams that appear in ≥ 2 prompts.
  const ngrams = new Map<string, Set<number>>();
  const NGRAM_LEN = 8;
  prompts.forEach((p, idx) => {
    const words = p.split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z0-9'-]/g, ""));
    for (let s = 0; s + NGRAM_LEN <= words.length; s++) {
      const slice = words.slice(s, s + NGRAM_LEN);
      // Skip n-grams that are mostly stopwords — they false-positive on
      // legitimate phrases ("which of the following best describes").
      const contentTokens = slice.filter((w) => w.length > 0 && !STOPWORDS.has(w)).length;
      if (contentTokens < 4) continue;
      const key = slice.join(" ");
      if (!ngrams.has(key)) ngrams.set(key, new Set());
      ngrams.get(key)!.add(idx);
    }
  });

  // Find the longest repeated n-gram across ≥ 2 prompts.
  let worst: { ngram: string; chapters: number[] } | null = null;
  for (const [ngram, set] of ngrams.entries()) {
    if (set.size >= 2) {
      if (!worst || ngram.length > worst.ngram.length) {
        worst = { ngram, chapters: [...set] };
      }
    }
  }
  if (!worst) return [];

  return [{
    checkId: "C12.quiz_template_prompt",
    severity: "blocker",
    unit: "quiz",
    message: `${worst.chapters.length} quiz prompts share the same 8-word phrase "${worst.ngram}" — quiz is template-generated, not testing skill application`,
    evidence: prompts[worst.chapters[0]].slice(0, 220),
  }];
}

/**
 * C13 — title-keyword injection in example scenarios.
 *
 * Detects the defect where the chapter title's distinctive lemma is injected
 * into scenario prose as an unnatural adjective: "the say email" (from "Always
 * Say Less Than Necessary"), "the much memo" (from "So Much Depends on
 * Reputation"), "the always scene" (from "Always Say…").
 *
 * Heuristic: extract title lemmas (excluding stopwords and content-noun
 * safelist), then look for `\bthe <lemma> <noun>\b` constructions where the
 * lemma is being forced as an adjective.
 */
export function checkTitleKeywordInjection(
  title: string,
  examples: ChapterV21["examples"],
): SupportFinding[] {
  if (!title || !examples || examples.length === 0) return [];

  const titleLemmas = title
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9'-]/g, ""))
    .filter((w) => TITLE_INJECTION_TRIGGER_LEMMAS.has(w));

  if (titleLemmas.length === 0) return [];

  const findings: SupportFinding[] = [];

  examples.forEach((ex, i) => {
    const text = `${ex.scenario ?? ""} ${ex.whatToDo ?? ""} ${ex.whyItMatters ?? ""}`;
    for (const lemma of titleLemmas) {
      // "the <lemma> <word>" or "<lemma> scene" used as a forced modifier.
      // Avoid matching legitimate prose where the lemma is the actual subject:
      //   bad: "the say email sits in view"
      //   bad: "Use the always scene"
      //   bad: "the much memo"
      //   ok:  "the say-less rule" (hyphenated; we don't match hyphens)
      //   ok:  "the law works because"
      const injection = new RegExp(`\\bthe\\s+${escapeRegex(lemma)}\\s+([a-z]+)\\b`, "gi");
      const matches = [...text.matchAll(injection)];
      for (const m of matches) {
        const followNoun = m[1];
        // Allow grammatical noun phrases: "the law works", "the friend says"
        // — i.e., when the lemma is genuinely a noun and the following word
        // is a verb. The defect is when followNoun is itself a noun like
        // "email", "scene", "memo", "spreadsheet" — forming a junk compound.
        // Use a small inflection check: if followNoun ends in common verb
        // inflections, skip.
        if (/(s|ed|ing)$/.test(followNoun) && followNoun.length > 4) continue;
        findings.push({
          checkId: "C13.title_keyword_injection",
          severity: "blocker",
          unit: `example[${i}]`,
          message: `title-keyword "${lemma}" injected as adjective in "the ${lemma} ${followNoun}" — template artifact forcing chapter title into example prose`,
          evidence: text.slice(Math.max(0, m.index! - 40), m.index! + 80),
        });
      }
    }
  });

  return findings;
}

/**
 * C14 — trailing-fragment text.
 *
 * `scenario`, `whatToDo`, `whyItMatters`, and reviewCard.back must end with
 * terminal punctuation. Truncation during generation produces fragments like
 * "…into being silent in e" or "…what is the right" that leave the reader
 * mid-thought.
 */
export function checkTrailingFragments(chapter: ChapterV21): SupportFinding[] {
  const findings: SupportFinding[] = [];

  // Terminal punctuation: . ! ? plus ASCII quotes (" ') plus Unicode quotes
  // (U+201D right double, U+2019 right single, U+201C left double, U+2018 left
  // single) plus closing paren/bracket. Build via RegExp constructor so the
  // Unicode codepoints are unambiguous in source.
  const validEnding = new RegExp(
    "[.!?\"'" +
    String.fromCharCode(0x201D) +
    String.fromCharCode(0x2019) +
    String.fromCharCode(0x201C) +
    String.fromCharCode(0x2018) +
    ")\\]]\\s*$"
  );

  const checkField = (text: string | undefined, unit: string) => {
    if (!text) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    if (!validEnding.test(trimmed)) {
      findings.push({
        checkId: "C14.trailing_fragment",
        severity: "blocker",
        unit,
        message: `field ends without terminal punctuation — truncated during generation`,
        evidence: "…" + trimmed.slice(-100),
      });
    }
  };

  (chapter.examples ?? []).forEach((ex, i) => {
    checkField(ex.scenario, `example[${i}].scenario`);
    checkField(ex.whatToDo, `example[${i}].whatToDo`);
    checkField(ex.whyItMatters, `example[${i}].whyItMatters`);
  });

  (chapter.reviewCards ?? []).forEach((c, i) => {
    checkField(c.back, `reviewCards[${i}].back`);
    checkField(c.front, `reviewCards[${i}].front`);
  });

  (chapter.quiz?.questions ?? []).forEach((q, i) => {
    const unit = `quiz.q${String(i + 1).padStart(2, "0")}`;
    checkField(q.explanation, `${unit}.explanation`);
  });

  return findings;
}

/**
 * C15 — role/domain mismatch in example scenarios.
 *
 * Detects "ROLE NAME" patterns ("nurse Chris", "engineer Camille", "doctor
 * Lea") in example scenarios where the named role contradicts the
 * planSpec.domain. This catches template substitution where a role from one
 * scenario got pasted into a different domain.
 */
export function checkRoleDomainCoherence(
  examples: ChapterV21["examples"],
): SupportFinding[] {
  if (!examples || examples.length === 0) return [];

  const findings: SupportFinding[] = [];

  // Role-noun ROLE NAME pattern. Match lowercase role followed by a capitalized
  // first name. Keep the role list narrow so we don't false-positive on
  // capitalized words mid-sentence.
  const ROLE_PATTERN = /\b(nurse|doctor|engineer|teacher|attorney|architect|surgeon|pilot|chef|barista|dentist|accountant|paramedic|firefighter|electrician|plumber|carpenter|librarian|pharmacist|veterinarian|psychologist|therapist|midwife|geologist|astronomer|biologist|chemist|physicist|mathematician|sociologist|economist|historian|journalist|reporter|editor|novelist|poet|sculptor|painter|musician|composer|dancer|actor|director|producer|photographer|designer|developer|programmer|analyst|consultant|partner|associate|manager|executive|founder|investor|trader)\s+([A-Z][a-z]+)/;

  examples.forEach((ex, i) => {
    if (!ex.scenario || !ex.planSpec?.domain) return;
    const scenario = ex.scenario;
    const domain = ex.planSpec.domain.toLowerCase();

    const match = scenario.match(ROLE_PATTERN);
    if (!match) return;
    const role = match[1].toLowerCase();
    const name = match[2];

    // If the role word appears in the domain, the example is coherent.
    if (domain.includes(role)) return;

    // If a different role appears in the domain that conflicts with this
    // role, that's a mismatch. Otherwise, the example might just be
    // introducing a character; only flag when the domain explicitly names a
    // different professional context.
    const domainHasDifferentRole = /\b(hospital|clinic|courtroom|hearing|firm|agency|gallery|studio|warehouse|factory|laboratory|stage|kitchen|classroom|cockpit|negotiation|board|audit|inauguration|deposition|investigation|review|architecture|critique|design)\b/.test(domain);

    if (domainHasDifferentRole) {
      findings.push({
        checkId: "C15.role_domain_mismatch",
        severity: "major",
        unit: `example[${i}].scenario`,
        message: `scenario introduces "${role} ${name}" but planSpec.domain is "${ex.planSpec.domain}" — role does not fit domain, suggests template substitution`,
        evidence: scenario.slice(0, 200),
      });
    }
  });

  return findings;
}

/**
 * C16 — broken example template.
 *
 * Catches the pipeline failure mode where the writer dumps planSpec fields
 * directly into prose using a broken template:
 *   "[Object] waits in the [domain] as [Name] arrives."
 *   "[Name] must decide before [object] leaves view: [requiredBeat]."
 *   whatToDo: "[Name]: [requiredBeat verbatim]"
 *
 * These phrases are never legitimate creative prose — they are artifacts of
 * a writer that lost the scenario-generation step and fell back to a fill-in
 * template. Even one occurrence in a chapter blocks shipping.
 */
export function checkBrokenExampleTemplate(
  examples: ChapterV21["examples"],
): SupportFinding[] {
  if (!examples || examples.length === 0) return [];

  const findings: SupportFinding[] = [];

  // Pattern 1: "[Object] waits in the [domain] as [Name] arrives"
  const waitsPattern = /\bwaits in the .{4,70} as [A-Z][a-z]+ arrives\b/;
  // Pattern 2: "[Name] must decide before [fragment] leaves view"
  const leavesViewPattern = /\bmust decide before .{4,60} leaves view\b/;
  // Pattern 3: whatToDo starts with "Name: " (protagonist name + colon dump)
  const wtdDumpPattern = /^[A-Z][a-z]+:\s+[A-Z]/;

  examples.forEach((ex, i) => {
    const scenario = ex.scenario ?? "";
    const whatToDo = ex.whatToDo ?? "";

    if (waitsPattern.test(scenario)) {
      findings.push({
        checkId: "C16.broken_example_template",
        severity: "blocker",
        unit: `example[${i}].scenario`,
        message: `scenario uses broken "waits in the … as Name arrives" template — planSpec domain was pasted into prose instead of generating a real scene`,
        evidence: scenario.slice(0, 200),
      });
    }

    if (leavesViewPattern.test(scenario)) {
      findings.push({
        checkId: "C16.broken_example_template",
        severity: "blocker",
        unit: `example[${i}].scenario`,
        message: `scenario uses broken "must decide before … leaves view" template — requiredBeat was pasted verbatim into scenario`,
        evidence: scenario.slice(0, 200),
      });
    }

    if (wtdDumpPattern.test(whatToDo)) {
      findings.push({
        checkId: "C16.broken_example_template",
        severity: "blocker",
        unit: `example[${i}].whatToDo`,
        message: `whatToDo starts with "Name: …" — requiredBeat was dumped directly without rewriting as advice`,
        evidence: whatToDo.slice(0, 120),
      });
    }
  });

  return findings;
}

/**
 * C17 — requiredBeat verbatim in prose.
 *
 * Fires when a significant chunk of planSpec.requiredBeat text (≥10 words)
 * appears verbatim in scenario, whatToDo, or whyItMatters. The requiredBeat
 * is a writer's internal instruction, not reader-facing prose. Copying it
 * directly means the writer skipped the creative step.
 */
export function checkRequiredBeatVerbatim(
  examples: ChapterV21["examples"],
): SupportFinding[] {
  if (!examples || examples.length === 0) return [];
  const findings: SupportFinding[] = [];

  examples.forEach((ex, i) => {
    const beat = (ex.planSpec as any)?.requiredBeat ?? "";
    if (!beat || beat.split(/\s+/).length < 10) return;

    // Extract a 10-word window from the beat and search for it verbatim
    const beatWords = beat.split(/\s+/);
    // Use the first 10 words as the fingerprint (most distinctive part)
    const fingerprint = beatWords.slice(0, 10).join(" ").toLowerCase().replace(/[^a-z\s]/g, "");

    const fields: Array<[string, string]> = [
      [`example[${i}].scenario`, ex.scenario ?? ""],
      [`example[${i}].whatToDo`, ex.whatToDo ?? ""],
      [`example[${i}].whyItMatters`, ex.whyItMatters ?? ""],
    ];

    for (const [unit, text] of fields) {
      const normalized = text.toLowerCase().replace(/[^a-z\s]/g, "");
      if (normalized.includes(fingerprint)) {
        findings.push({
          checkId: "C17.required_beat_verbatim",
          severity: "blocker",
          unit,
          message: `requiredBeat text appears verbatim in ${unit} — writer pasted the internal instruction instead of enacting it as prose`,
          evidence: beat.slice(0, 120),
        });
        break; // only one finding per example
      }
    }
  });

  return findings;
}

/**
 * C18 — correct answer telegraphed by length.
 *
 * When the correct choice is ≥1.5× the average distractor length, a
 * test-taking strategy of "pick the longest" scores correctly without
 * reading. Fires MAJOR at >1.5× and BLOCKER at >2.0× (guessable by
 * inspection).
 */
export function checkQuizAnswerLengthRatio(
  quiz: ChapterV21["quiz"],
): SupportFinding[] {
  if (!quiz?.questions || quiz.questions.length === 0) return [];
  const findings: SupportFinding[] = [];
  for (const [i, q] of quiz.questions.entries()) {
    if (!Array.isArray(q.choices) || q.choices.length !== 3) continue;
    if (q.correctIndex < 0 || q.correctIndex > 2) continue;
    const correctLen = q.choices[q.correctIndex]?.length ?? 0;
    const distractorAvg =
      q.choices.filter((_, j) => j !== q.correctIndex).reduce((s, c) => s + c.length, 0) / 2;
    if (distractorAvg === 0) continue;
    const ratio = correctLen / distractorAvg;
    if (ratio > 2.0) {
      findings.push({
        checkId: "C18.answer_length_telegraphed",
        severity: "blocker",
        unit: `quiz.q${String(i + 1).padStart(2, "0")}`,
        message: `correct answer is ${ratio.toFixed(1)}× the average distractor length — guessable by length alone; trim correct choice or expand distractors`,
        evidence: q.choices[q.correctIndex].slice(0, 100),
      });
    } else if (ratio > 1.5) {
      findings.push({
        checkId: "C18.answer_length_telegraphed",
        severity: "major",
        unit: `quiz.q${String(i + 1).padStart(2, "0")}`,
        message: `correct answer is ${ratio.toFixed(1)}× the average distractor length (target ≤1.5×) — trim correct choice or expand distractors`,
        evidence: q.choices[q.correctIndex].slice(0, 100),
      });
    }
  }
  return findings;
}

/**
 * C19 — A/An question opener lock.
 *
 * Fires MAJOR when >5 of 9 questions start with "A " or "An " — the
 * persona-framing template ("A manager asks…", "An engineer notices…")
 * makes every prompt look structurally identical.
 */
export function checkQuizOpenerLock(
  quiz: ChapterV21["quiz"],
): SupportFinding[] {
  if (!quiz?.questions || quiz.questions.length < 5) return [];
  const aAnCount = quiz.questions.filter((q) => /^An? [A-Z]/.test(q.prompt ?? "")).length;
  if (aAnCount > 5) {
    return [{
      checkId: "C19.quiz_opener_lock",
      severity: "major",
      unit: "quiz",
      message: `${aAnCount} of ${quiz.questions.length} questions start with "A/An…" (max 5) — vary question openers so the format carries information`,
      evidence: `${aAnCount}/${quiz.questions.length} use A/An opener`,
    }];
  }
  return [];
}

/**
 * C20 — whatToDo repeats scenario content.
 *
 * Fires MAJOR when >70% of whatToDo's content words (length ≥5,
 * stopwords excluded) also appear in the scenario. The field should
 * add new instruction, not restate what already happened.
 */
export function checkWhatToDoOverlap(
  examples: ChapterV21["examples"],
): SupportFinding[] {
  if (!examples || examples.length === 0) return [];
  const findings: SupportFinding[] = [];

  const STOP = new Set([
    "a","an","and","are","as","at","be","but","by","do","for","from",
    "had","has","have","he","her","his","if","in","into","is","it","its",
    "no","not","of","on","or","she","so","that","the","their","them",
    "then","they","this","those","to","too","up","was","we","were","what",
    "when","which","who","will","with","you","your",
  ]);
  const contentWords = (t: string): Set<string> =>
    new Set(
      t.toLowerCase()
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z]/g, ""))
        .filter((w) => w.length >= 5 && !STOP.has(w)),
    );

  examples.forEach((ex, i) => {
    if (!ex.scenario || !ex.whatToDo) return;
    const scenWords = contentWords(ex.scenario);
    const wtdWords = Array.from(contentWords(ex.whatToDo));
    if (wtdWords.length === 0) return;
    const overlap = wtdWords.filter((w) => scenWords.has(w)).length / wtdWords.length;
    if (overlap > 0.7) {
      findings.push({
        checkId: "C20.what_to_do_overlap",
        severity: "major",
        unit: `example[${i}].whatToDo`,
        message: `whatToDo shares ${Math.round(overlap * 100)}% of its content words with the scenario — rewrite to add new instruction the scenario does not already contain`,
        evidence: ex.whatToDo.slice(0, 120),
      });
    }
  });
  return findings;
}

/**
 * C21 — review card circular back.
 *
 * Fires MINOR when the first 6 content words of the back share ≥4
 * matches with the front's content words AND the back is ≤30 words.
 * This pattern (back restates the front's premise rather than answering
 * the question) produces zero retrieval value: flipping the card teaches
 * nothing new.
 */
export function checkReviewCardCircularBack(
  cards: ChapterV21["reviewCards"],
): SupportFinding[] {
  if (!cards || cards.length === 0) return [];
  const findings: SupportFinding[] = [];

  const STOP = new Set([
    "a","an","and","are","as","at","be","but","by","do","for","from",
    "had","has","have","he","her","his","if","in","into","is","it","its",
    "no","not","of","on","or","she","so","that","the","their","them",
    "then","they","this","those","to","too","up","was","we","were","what",
    "when","which","who","will","with","you","your",
  ]);
  const contentWords = (t: string): string[] =>
    t.toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z]/g, ""))
      .filter((w) => w.length >= 4 && !STOP.has(w));

  cards.forEach((card, i) => {
    if (!card.front || !card.back) return;
    const backWords = contentWords(card.back);
    if (backWords.length > 30) return;
    const frontSet = new Set(contentWords(card.front));
    const firstSix = backWords.slice(0, 6);
    const overlap = firstSix.filter((w) => frontSet.has(w)).length;
    if (overlap >= 4) {
      findings.push({
        checkId: "C21.circular_back",
        severity: "minor",
        unit: `reviewCards[${i}]`,
        message: `card back likely restates the front premise (${overlap}/6 leading content words overlap with front) — rewrite back to answer the front's question, not rephrase it`,
        evidence: card.back.slice(0, 100),
      });
    }
  });
  return findings;
}

/** Run all support-section checks on a chapter. */
export function runSupportSectionAudit(chapter: ChapterV21): SupportFinding[] {
  return [
    ...checkReviewCardBackDuplication(chapter.reviewCards),
    ...checkQuizPromptTemplate(chapter.quiz),
    ...checkTitleKeywordInjection(chapter.title, chapter.examples),
    ...checkTrailingFragments(chapter),
    ...checkRoleDomainCoherence(chapter.examples),
    ...checkBrokenExampleTemplate(chapter.examples),
    ...checkRequiredBeatVerbatim(chapter.examples),
    ...checkQuizAnswerLengthRatio(chapter.quiz),
    ...checkQuizOpenerLock(chapter.quiz),
    ...checkWhatToDoOverlap(chapter.examples),
    ...checkReviewCardCircularBack(chapter.reviewCards),
  ];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
