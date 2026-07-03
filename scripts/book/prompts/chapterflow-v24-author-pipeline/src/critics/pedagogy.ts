/**
 * Pedagogy critics — check that questions and cards test the right thing.
 * Quiz questions must test application of the idea, not recall of the text.
 * Review card fronts must pose retrieval prompts, not comprehension checks.
 */

import { ChapterV21, CriticFinding, QuizQuestion, ReviewCard } from "../types.js";
import { finding, pickEvidence, truncate } from "./shared.js";
import { splitSentences } from "./textUtils.js";
import { loadChapterSidecar } from "./sourceGrounding.js";
import { realEntityTokensFromSidecar } from "./evidenceIntegrity.js";

const QUIZ_FORBIDDEN_OPENERS = [
  /^\s*what does the (chapter|author|book)/i,
  /^\s*according to the (chapter|author|book)/i,
  /^\s*what is the main point of the (chapter|section)/i,
  /^\s*how does the (chapter|author|book) describe/i,
  /^\s*in this (chapter|section|book|law)/i,
  /^\s*(machiavelli|kahneman|clear|taleb|housel|tetlock|cialdini|greene|duhigg|eyal)\s+(argues|opens|says|writes|claims|describes)/i,
];

const QUIZ_APPLICATION_OPENERS = [
  /^\s*(a|an)\s+(manager|teacher|student|founder|parent|coach|director|vp|engineer|designer|writer|analyst)/i,
  /^\s*when a reader/i,
  /^\s*if you/i,
  /^\s*a team is/i,
  /^\s*a person who/i,
  /^\s*in which scenario/i,
  /^\s*which action/i,
  /^\s*which move/i,
  /^\s*which plan best/i,
  /^\s*you are/i,
  /^\s*someone\s/i,
];

// Mid-prompt question stems that mark an application/analysis item even when the
// prompt does not OPEN with a whitelisted subject (e.g. a scenario-first prompt
// that ends "…what should she infer first?"). Register-agnostic.
const QUIZ_APPLICATION_STEMS = [
  /\bwhat should\b/i,
  /\bwhat (would|will) (she|he|they|you)\b/i,
  /\bwhat is the (cleanest|best|first|right|smartest|wisest|safest)\b/i,
  /\bwhich (choice|action|move|plan|response|read|reading|step|option|inference)\b[^?]*\bbest\b/i,
  /\bbest (next )?(move|step|response|read|action|inference)\b/i,
  /\bwhat should (she|he|they|you) (infer|do|conclude|prioritize|notice|change|fix)\b/i,
];

export function checkQuizTestsApplication(q: QuizQuestion): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const prompt = (q.prompt ?? "").trim();
  if (!prompt) {
    findings.push(
      finding(
        "pedagogy.quiz_tests_application",
        "blocker",
        "quiz question has empty prompt",
      ),
    );
    return findings;
  }

  for (const re of QUIZ_FORBIDDEN_OPENERS) {
    if (re.test(prompt)) {
      findings.push(
        finding(
          "pedagogy.quiz_tests_application",
          "major",
          "quiz prompt tests recall-about-text, not application of the idea",
          prompt,
        ),
      );
      return findings;
    }
  }

  // Minor hint: flag if none of the preferred application-style openers are present
  const hasAppOpener = QUIZ_APPLICATION_OPENERS.some((re) => re.test(prompt));
  const hasAppStem = QUIZ_APPLICATION_STEMS.some((re) => re.test(prompt));
  if (!hasAppOpener && !hasAppStem && prompt.length < 120) {
    findings.push(
      finding(
        "pedagogy.quiz_tests_application",
        "minor",
        "prompt is short and does not obviously test application — consider a scenario-based framing",
        prompt,
      ),
    );
  }
  return findings;
}

const CARD_FORBIDDEN_OPENERS = [
  /^\s*what does (the )?(chapter|book|author)/i,
  /^\s*according to (the )?(chapter|book|author)/i,
  /^\s*how does (the )?chapter/i,
  /^\s*what goes wrong (in|when) the chapter/i,
];

export function checkCardTestsRetrieval(rc: ReviewCard): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const front = pickEvidence(rc.front);
  if (!front) {
    findings.push(
      finding(
        "pedagogy.card_tests_retrieval",
        "major",
        "review card front is empty",
      ),
    );
    return findings;
  }
  for (const re of CARD_FORBIDDEN_OPENERS) {
    if (re.test(front)) {
      findings.push(
        finding(
          "pedagogy.card_tests_retrieval",
          "minor",
          "card front is a comprehension check, not retrieval practice",
          front,
        ),
      );
      return findings;
    }
  }
  return findings;
}

/**
 * D3 — keyTakeaway distillability (ADVISORY / minor). The "one-sentence test":
 * a reader should be able to repeat the chapter's keyTakeaway as one concrete,
 * repeatable move. A takeaway that stays fully at arm's length — a pileup of
 * nominalized concept-nouns ("cultivation", "motivation", "recognition") and NO
 * concrete anchor — reads abstract, and a tired beginner cannot carry it.
 *
 * This NEVER blocks. Word choice is contextual and a conceptual book may state
 * an abstract truth legitimately, so a false positive must cost nothing; it only
 * nudges the writer to name the move. It is conservative ON PURPOSE — calibrated
 * against the 1,606 shipped keyTakeaways so it fires on ~4.5% (the genuinely
 * arm's-length ones a beginner can't carry, e.g. "Vulnerability with boundaries
 * means risking exposure for love, creativity, and integrity"), not on the many
 * good imperative takeaways ("Keep reserves that…", "Trade weak signals for…")
 * that simply carry abstract nouns, nor on directives embedded after a clause
 * break ("…, so check the base rate"). A finding
 * fires only when the takeaway is abstraction-heavy (≥3 distinct nominalizations)
 * AND offers the reader no move to grab: not an imperative directive, no
 * second-person, no number, no named entity, no "X, not Y" contrast. It is
 * deliberately NOT a length check — A14 (integrity.length_cap) already caps the
 * word count; this is about whether the sentence names a move.
 */
// A nominalized abstract noun: ≥4 letters of stem before an abstraction suffix
// (so "motion"/"comment"/"city" — stem <4 — do not match, but "cultivation",
// "movement", "quality", "representativeness" do).
const NOMINALIZATION_RE = /\b[a-z]{4,}(?:tions?|ments?|ness|ities|ity|isms?|ances?|ences?|izations?|isations?)\b/gi;
// Imperative-verb openers — a takeaway that OPENS with one of these is itself a
// directive (it names the move), so it is concrete by construction. Closed list
// drawn from the verbs that actually open shipped imperative takeaways. It is a
// pragmatic proxy, not exhaustive: a NEW book whose imperative takeaway opens with
// an unlisted verb may draw a spurious advisory — acceptable for a minor nudge
// (a model-backed check would judge "names a move?" precisely; this is the cheap,
// never-gating stand-in). Bias is toward UNDER-firing; over-fires are bounded noise.
const IMPERATIVE_VERBS = new Set([
  "keep", "welcome", "prefer", "respect", "run", "build", "trade", "ground", "begin",
  "treat", "use", "ask", "pick", "choose", "hold", "name", "check", "spot", "notice",
  "start", "stop", "make", "give", "take", "turn", "try", "avoid", "protect", "grow",
  "drop", "watch", "find", "set", "tie", "place", "put", "bring", "carry", "lead",
  "look", "reach", "separate", "compare", "explore", "evaluate", "learn", "trace",
  "map", "frame", "aim", "default", "resist", "replace", "swap", "cut", "limit",
  "guard", "plan", "test", "measure", "decide", "commit", "practice", "rehearse",
  "favor", "favour", "anchor", "expect", "let", "do", "design", "write", "say",
  // openers seen on shipped imperative takeaways the v1 calibration missed
  "match", "honor", "honour", "manage", "interpret", "translate", "become", "divide",
  "overcome", "prioritize", "prioritise", "defend", "restore", "repair", "schedule",
  "pause", "exploit", "convert", "count", "renew", "audit", "install", "slow",
]);

// Leading conjunctions/adverbs that can sit in front of an embedded directive
// ("…, SO check the base rate"; "…, THEN restore it") without changing that the
// clause issues an imperative.
const CLAUSE_LEAD = /^(?:so|then|and|but|or|yet|thus|therefore|hence|now)\b\s*/i;

/** Does a clause issue an imperative (optionally behind a leading conjunction)? */
function clauseIsImperative(clause: string): boolean {
  const stripped = clause.trim().replace(CLAUSE_LEAD, "");
  const first = (stripped.match(/^[A-Za-z']+/)?.[0] ?? "").toLowerCase();
  return IMPERATIVE_VERBS.has(first);
}

export function checkTakeawayDistillable(text: string | undefined, fieldLabel: string): CriticFinding[] {
  if (!text || !text.trim()) return [];
  const distinct = new Set((text.match(NOMINALIZATION_RE) ?? []).map((m) => m.toLowerCase()));
  if (distinct.size < 3) return [];                                    // not abstraction-heavy
  // A directive anywhere is a move the reader can grab — whether it OPENS the
  // takeaway ("Keep reserves that…") or is embedded after a clause break
  // ("…, so check the base rate"; "…steadiness: ask better questions, hold tension").
  if (text.split(/[,;:]/).some(clauseIsImperative)) return [];
  // Other concrete anchors. The named-entity check looks only PAST the first word
  // so a sentence-initial capital never counts as a proper noun.
  const pastFirst = text.replace(/^\s*[A-Za-z']+/, "");
  const anchored = /\b(?:you|your|you're|yourself|yourselves)\b/i.test(text)
    || /\d/.test(text)
    || /,\s*not\b/i.test(text)
    || /\bnot\b[^,.]{0,40}\bbut\b/i.test(text)
    || /[\s,:(]\b[A-Z][a-z]{2,}/.test(pastFirst);                     // a named entity grounds it
  if (anchored) return [];
  return [
    finding(
      "pedagogy.takeaway_distillable",
      "minor",
      `${fieldLabel} reads abstract (${distinct.size} concept-nouns, no move to grab) — name the one repeatable move a reader could act on today`,
      text,
    ),
  ];
}

/**
 * D4 (recycled scenario) + D6 (key references a chapter entity) — quiz transfer &
 * key-novelty. The reverted tiny-habits regen shipped quiz questions that asked the
 * reader to RECALL the chapter ("what did Deborah conclude…", four times) and keyed
 * answers whose correctness rested on "what a character in the chapter did". Catalog
 * D4 ("no transfer / same scenarios as chapter") was prompt-only; D6 is new.
 *
 * THE DISCRIMINATOR (calibrated ZERO-FP on the gold corpus — daring-greatly +
 * start-with-why). The naive rule "the prompt names a chapter entity" fires on EVERY
 * clean application question: a reference book legitimately gives each quiz question a
 * named protagonist who ALSO stars in an example, and its keys/explanations name those
 * characters and the chapter's real cases constantly. Reusing a NAME in a FRESH scene
 * is correct authoring, not the defect. So the detectors narrow to the prose tells that
 * actually separate recall from transfer:
 *  - D4 fires only on a RECALL FRAME ("what did X", "according to X", "X's story
 *    shows") pointed at a chapter-cast name — the question asks the reader to remember
 *    the chapter rather than reason from the idea.
 *  - D6 fires only when the KEYED CHOICE names a chapter-cast member the question's own
 *    prompt never introduced — the answer reaches back into the chapter's narrative for
 *    its authority. (Explanations legitimately teach with the chapter's real examples —
 *    gold proves it — so D6 reads the choice, not the explanation; an explanation keyed
 *    to a testimonial is EI2's job.)
 *
 * The chapter "cast" = proper nouns appearing NON-sentence-initially in example
 * scenarios (a sentence-initial capital is usually a concept word — "Shame", "Hope",
 * "Trust" — not a character). Real cited entities (source-v2 sidecar), the central
 * concept, and the chapter's own title words are exempted, mirroring EI / SC9, so a
 * legitimately-recurring source entity ("Apple", "Kosfeld") never trips either check.
 */
const D_PROPER_NOUN_RE = /\b[A-Z][a-z]{2,}\b/g;

// Capitalized tokens that are name-shaped but never a chapter "cast" member.
const CAST_STOPWORDS = new Set([
  "The", "A", "An", "If", "When", "That", "But", "Chapter", "Monday", "Tuesday",
  "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "She", "He", "They",
  "It", "This", "And", "Or", "So", "Her", "His", "Then", "Because", "Before",
  "After", "While", "Once", "During", "Without", "Within", "Yet", "Still", "Such",
  "Here", "There", "Whenever", "Even", "Only", "Often", "Now", "Yesterday",
  "Today", "Tomorrow", "Like", "Unlike", "Both", "Either", "Neither", "Every",
  "No", "Any", "Some", "Your", "You", "We", "Our", "Their", "Which", "Who",
  "What", "Where", "Why", "How", "One", "Two", "Three", "Each", "Most", "Many",
]);

const NAME_SHAPED = /^[A-Z][a-z]{2,}$/;

/** Bare single-token character names that do NOT sit at the start of a sentence and
 *  are NOT part of a multi-word FULL NAME. Two filters carry the zero-FP calibration:
 *   - sentence-initial capitals are usually concept words ("Shame is…", "Hope means…"),
 *     not characters; and
 *   - a token adjacent to another capitalized token is part of a real cited entity
 *     ("Ben Comen", "Walt Disney", "Volkswagen Phaeton", "London Underground") — a
 *     reference book legitimately recalls those, so they are not the invented
 *     first-name-only character ("Deborah", "Brad") the regen defect reuses.
 *  Used both to build the cast and to read the keyed choice. */
function nonInitialProperNouns(text: string): string[] {
  const out: string[] = [];
  for (const sentence of splitSentences(text ?? "")) {
    const toks = [...sentence.matchAll(/\b[A-Za-z][A-Za-z'’-]*\b/g)].map((m) => m[0]);
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i];
      if (i === 0) continue;                      // sentence-initial → skip
      if (!NAME_SHAPED.test(w) || CAST_STOPWORDS.has(w)) continue;
      const prevCap = i > 0 && NAME_SHAPED.test(toks[i - 1]);
      const nextCap = i + 1 < toks.length && NAME_SHAPED.test(toks[i + 1]);
      if (prevCap || nextCap) continue;           // part of a FULL NAME → real entity
      out.push(w);
    }
  }
  return out;
}

/** Lowercased tokens that must NOT count as a chapter character: the central
 *  concept, the chapter title, and any real source entity in the sidecar. */
function exemptCastTokens(chapter: ChapterV21, sidecar: unknown): Set<string> {
  const out = new Set<string>(realEntityTokensFromSidecar(sidecar)); // already lowercased
  const cc = (sidecar as any)?.centralConcept;
  const ccName = typeof cc === "string" ? cc : cc?.name;
  if (typeof ccName === "string") for (const t of ccName.toLowerCase().match(/[a-z][a-z'’-]+/g) ?? []) out.add(t);
  for (const w of (chapter.title ?? "").toLowerCase().split(/[^a-z0-9'-]+/)) if (w.length >= 4) out.add(w);
  return out;
}

/** The chapter's named cast — proper nouns introduced in example scenarios,
 *  minus exempted source/concept/title entities. */
function chapterCast(chapter: ChapterV21, exempt: Set<string>): Set<string> {
  const cast = new Set<string>();
  for (const ex of chapter.examples ?? []) {
    for (const n of nonInitialProperNouns(ex.scenario ?? "")) {
      if (!exempt.has(n.toLowerCase())) cast.add(n);
    }
  }
  return cast;
}

// Recall frames: a question stem that asks the reader to remember what a NAMED
// person did/said in the chapter, rather than reason about a new situation. Each
// captures the targeted name (group 1) so it can be checked against the cast.
const RECALL_FRAMES: RegExp[] = [
  /\b[Ww]hat (?:did|does|do)\s+([A-Z][a-z]{2,})\b/g,
  /\b[Ww]hy (?:did|does|do|is|was|were)\s+([A-Z][a-z]{2,})\b/g,
  /\b[Hh]ow (?:did|does|do)\s+([A-Z][a-z]{2,})\b/g,
  /\b[Aa]ccording to\s+([A-Z][a-z]{2,})\b/g,
  /\b[Ii]n ([A-Z][a-z]{2,})['’]s (?:story|case|example|scenario|chapter|study)\b/g,
  /\b([A-Z][a-z]{2,})['’]s (?:story|account|report|testimony|example|case)\s+(?:show|shows|showed|prove|proves|proved|tell|tells|told|teach|teaches|taught|reveal|reveals|revealed|illustrate|illustrates|illustrated)\b/g,
];

/** Bare first names a quiz prompt asks the reader to RECALL (from a recall frame).
 *  A full-name capture ("What does Ben Comen illustrate", "According to Bill Gates")
 *  is a real cited entity a reference book legitimately recalls, not the invented
 *  first-name-only character the regen defect reuses — so it is rejected. */
export function recallFrameTargets(prompt: string): string[] {
  const text = prompt ?? "";
  const names: string[] = [];
  for (const re of RECALL_FRAMES) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const after = text.slice(m.index + m[0].length);
      if (NAME_FOLLOWED_BY_CAP.test(after)) continue; // "<Name> <Capital>" → full name → skip
      names.push(m[1]);
    }
  }
  return names;
}
const NAME_FOLLOWED_BY_CAP = /^\s+[A-Z][a-z]{2,}/;

const D4_FIX = "Replace it with a FRESH scenario the reader has not met in this chapter — never ask what a chapter character said, did, or concluded. The reader must reason from the idea, not recall the narrative.";

/**
 * D4 — a quiz prompt that tests recall of a chapter character instead of transfer.
 * Implements catalog D4 (was prompt-only). MAJOR, shadow until the gold proof
 * promotes it (`ENFORCED_MAJOR` stays empty). Pass `sidecarOverride` in tests.
 */
export function checkQuizScenarioNovelty(chapter: ChapterV21, sidecarOverride?: unknown): CriticFinding[] {
  const sidecar = sidecarOverride ?? (chapter.chapterId ? loadChapterSidecar(chapter.chapterId) : null);
  const cast = chapterCast(chapter, exemptCastTokens(chapter, sidecar));
  if (cast.size === 0) return [];
  const findings: CriticFinding[] = [];
  (chapter.quiz?.questions ?? []).forEach((q, i) => {
    for (const name of recallFrameTargets(q.prompt ?? "")) {
      if (cast.has(name)) {
        findings.push(
          finding(
            "D4.recycled_scenario" as any,
            "major",
            `quiz.questions[${i}]: tests recall of the chapter, not transfer — the prompt asks the reader to recall "${truncate(name, 60)}", a character from this chapter's own examples, instead of posing a new situation. ${D4_FIX}`,
            q.prompt ?? "",
          ),
        );
        break; // one D4 per question is enough to surface + route the repair
      }
    }
  });
  return findings;
}

const D6_FIX = "Re-key the answer to a verifiable source fact stated in general terms, not to what a named chapter character did. The keyed choice must stand on its own for a reader who has not memorized the chapter's cast.";

/**
 * D6 — a keyed answer grounded in a same-chapter character the question never
 * introduced. NEW catalog id (D5 is taken by implementation-plan-generic). MAJOR,
 * shadow until the gold proof promotes it. Reads the keyed CHOICE only (explanations
 * teach with the chapter's real cases legitimately; a testimonial-keyed answer is EI2).
 */
export function checkQuizKeyEntity(chapter: ChapterV21, sidecarOverride?: unknown): CriticFinding[] {
  const sidecar = sidecarOverride ?? (chapter.chapterId ? loadChapterSidecar(chapter.chapterId) : null);
  const cast = chapterCast(chapter, exemptCastTokens(chapter, sidecar));
  if (cast.size === 0) return [];
  const findings: CriticFinding[] = [];
  (chapter.quiz?.questions ?? []).forEach((q, i) => {
    const ci = q.correctIndex;
    const keyed = typeof ci === "number" ? q.choices?.[ci] ?? "" : "";
    if (!keyed) return;
    // Names the question's OWN scenario introduces are fair game in the answer —
    // only a cast member the prompt never mentions is the reach-back defect.
    const promptNames = new Set((q.prompt ?? "").match(D_PROPER_NOUN_RE) ?? []);
    for (const name of nonInitialProperNouns(keyed)) {
      if (cast.has(name) && !promptNames.has(name)) {
        findings.push(
          finding(
            "D6.key_references_chapter_entity" as any,
            "major",
            `quiz.questions[${i}]: the correct answer is grounded in a chapter character — the keyed choice names "${truncate(name, 60)}" (from this chapter's examples) but the question's own scenario never introduces them, so the answer rewards remembering the chapter, not applying the idea. ${D6_FIX}`,
            keyed,
          ),
        );
        break; // one D6 per question
      }
    }
  });
  return findings;
}
