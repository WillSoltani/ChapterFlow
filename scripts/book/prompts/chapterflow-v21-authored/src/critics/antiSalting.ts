/**
 * Anti-salting critic. Catches the gaming patterns observed in the May 2026
 * 7 Habits of Highly Effective People incident, where a writer agent — under
 * pressure to pass cross-chapter pattern audits (BP1, BP3, BP9, BP13) —
 * inserted unique tokens into user-facing fields to break verbatim n-gram
 * matching without actually rewriting the prose. The result shipped because
 * the deterministic gates only check verbatim repeats, not English coherence
 * or semantic plausibility.
 *
 * Examples from the incident:
 *   Quiz prompt (Ch1 q07): "map q7 person map studio critique wants to pick
 *                           the safe sketch. Which reply changes the frame?"
 *   Quiz prompt (Ch2 q07): "goose q7 person goose studio critique wants to
 *                           pick the safe sketch. Which reply changes the frame?"
 *   Example scenario: "Maplefield Bridgeton 10:20 p.m.. MaplefieldBridgeton
 *                      The room..."
 *
 * Patterns detected:
 *   AS1 — Identifier-token injection inside prose
 *         A token like q7 / q07 / p2 / ex1 appearing INSIDE a sentence (not at
 *         a sentence boundary) is almost always salt. Real prose contains no
 *         such tokens.
 *   AS2 — Jammed proper nouns (CamelCase without separator)
 *         Two capitalized words mashed together: "MaplefieldBridgeton",
 *         "HarborlineNorthwell". Real English never produces these.
 *   AS3 — Doubled period followed by another sentence
 *         "10:20 p.m.. The room..." is a generation parse error or a
 *         deliberate marker. Real prose uses single periods.
 *   AS4 — Repeated single-word "marker tokens" across chapters
 *         When the SAME quiz-question position across many chapters substitutes
 *         a single short noun token at the same position with each chapter's
 *         unique marker. Looks like: Ch1 says "Which map move should…",
 *         Ch2 says "Which goose move should…", Ch3 says "Which mission move
 *         should…". Detected by comparing same-position prompts pairwise and
 *         flagging if 80%+ of words are identical.
 *
 * Severity: every AS-code is a BLOCKER. There is no legitimate use of these
 * patterns in v21 prose. False positives are acceptable because the cost of a
 * spurious block (operator reviews and overrides) is much lower than the cost
 * of shipping salted prose (book ships unreadable).
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding } from "./shared.js";

// ── Pattern catalog ─────────────────────────────────────────────────────────

/**
 * Identifier-style scaffold tokens injected into prose — authoring ids the salter lifts
 * out of the structured id fields ("q7" from questionId "q07") and drops into reader prose
 * to break n-gram matching. Two patterns, split by domain-collision risk:
 *
 *  - q-tokens are LOWERCASE-only (case-sensitive). Uppercase "Q<n>" collides with real
 *    domain tokens that must NOT fire — quarters ("Q3 earnings", Q1–Q4) and product names
 *    ("Audi Q7", "Q5") — so only the lowercase id-field form ("q7"/"q07") is safe to catch.
 *    `c\d` / `p\d` are dropped: not v21 id prefixes (the real ones are q/ex/card/chapter)
 *    and they collide with domain tokens (C3 vertebra, Series C2, P50, the gene p53).
 *  - ex / card / chapter tokens match in ANY case: no domain token looks like
 *    "EX1"/"Card2"/"CHAPTER3", so case-insensitive is safe and catches an uppercased leak.
 *
 * Residual marker-evasions (an uppercase "Q7", or a c/p marker a rule-aware adversary
 * picks) are out of scope HERE but backstopped downstream: the verbatim skeleton such a
 * marker leaves in examples/breakdown trips AS10 (5-token window shared with ≥2 priors),
 * and a templated quiz prompt trips AS4 / AS13. Field-aware: structured id fields
 * (questionId / cardId / exampleId) are not scanned.
 */
const SALT_Q_TOKEN = /\bq\d{1,3}\b/;
const SALT_PREFIX_TOKEN = /\b(?:ex|card|chapter)\d{1,3}\b/i;

/**
 * Runs of 2+ jammed 4+-letter capitalized words. Catches the salt artifact — INVENTED
 * place/person names jammed without a space:
 *   MaplefieldBridgeton, HarborlineNorthwell, CooperLatham, ZenithKestrel
 * `{2,}` (not exactly two) so a THREE-hump jam ("MaplefieldBridgetonHarborline",
 * "PowerPointSharePoint") still matches — the old fixed-pair form ended in `\b` after the
 * 2nd hump and silently failed to match when a 3rd capital followed. Allows legitimate
 * compound names like McDonald, MacArthur, O'Brien, JPMorgan: each half must be 4+
 * lowercase letters, so a 2-3-letter prefix (Mc/Mac/JP) never forms a hump.
 */
const JAMMED_PROPER_NOUNS = /\b(?:[A-Z][a-z]{3,}){2,}\b/g;

/**
 * Real CamelCase BRAND names whose halves are both 4+ letters legitimately trip the
 * pattern (the corpus is self-help / productivity / business prose, where these appear).
 * Allowlisted so a chapter naming one doesn't hard-block — now that publish is automatic,
 * a spurious AS2 block HALTS an unattended run. The salt artifact (jammed invented
 * place/person names) is never on this list and still fires. Exact spellings; extend as
 * the corpus needs.
 */
const CAMELCASE_BRAND_ALLOWLIST = new Set<string>([
  "PowerPoint", "SharePoint", "OpenTable", "LandRover", "FaceTime", "SoundCloud",
  "WordPress", "DoorDash", "MailChimp", "MasterCard", "QuickBooks", "TaskRabbit",
  "ClassPass", "DeepMind", "SurveyMonkey", "PostMates", "MoviePass", "NerdWallet",
  "SalesForce", "BlackBerry", "AstraZeneca",
]);

/**
 * Doubled period followed by whitespace + capital letter. Catches:
 *   "10:20 p.m.. The room"
 *   "Tuesday afternoon.. She walked"
 * Allowed forms: single periods, ellipses (...), ?., !.
 */
const DOUBLED_PERIOD = /\w\.\.\s+[A-Z]/;

// ── Chapter-level critics ───────────────────────────────────────────────────

/**
 * AS1 — identifier-token injection. Scans every text field of a chapter for
 * inline identifier-like tokens. The chapter's structured identifier fields
 * (questionId, exampleId, cardId, chapterId) are intentionally skipped.
 */
export function checkChapterIdentifierTokens(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const fields: Array<{ unit: string; text: string }> = [];

  // Hook + counterintuition + tryThisNow + keyTakeaway
  if (chapter.hook) fields.push({ unit: "hook", text: chapter.hook });
  if (chapter.counterintuition) fields.push({ unit: "counterintuition", text: chapter.counterintuition });
  if (chapter.tryThisNow) fields.push({ unit: "tryThisNow", text: chapter.tryThisNow });
  if (chapter.keyTakeaway) fields.push({ unit: "keyTakeaway", text: chapter.keyTakeaway });

  // Breakdown tiers
  if (chapter.breakdown?.fastRead) fields.push({ unit: "breakdown.fastRead", text: chapter.breakdown.fastRead });
  if (chapter.breakdown?.deepRead) fields.push({ unit: "breakdown.deepRead", text: chapter.breakdown.deepRead });
  if (chapter.breakdown?.fullRead) fields.push({ unit: "breakdown.fullRead", text: chapter.breakdown.fullRead });

  // Examples — every text field except the id
  (chapter.examples ?? []).forEach((ex, i) => {
    if (ex.title) fields.push({ unit: `example[${i}].title`, text: ex.title });
    if (ex.scenario) fields.push({ unit: `example[${i}].scenario`, text: ex.scenario });
    if (ex.whatToDo) fields.push({ unit: `example[${i}].whatToDo`, text: ex.whatToDo });
    if (ex.whyItMatters) fields.push({ unit: `example[${i}].whyItMatters`, text: ex.whyItMatters });
  });

  // Quiz — prompt, choices, explanation (NOT questionId)
  (chapter.quiz?.questions ?? []).forEach((q) => {
    if (q.prompt) fields.push({ unit: `quiz.${q.questionId}.prompt`, text: q.prompt });
    (q.choices ?? []).forEach((c, ci) => {
      if (typeof c === "string") fields.push({ unit: `quiz.${q.questionId}.choice[${ci}]`, text: c });
    });
    if (q.explanation) fields.push({ unit: `quiz.${q.questionId}.explanation`, text: q.explanation });
  });

  // Review cards — front + back (NOT cardId)
  (chapter.reviewCards ?? []).forEach((card) => {
    if (card.front) fields.push({ unit: `card.${card.cardId}.front`, text: card.front });
    if (card.back) fields.push({ unit: `card.${card.cardId}.back`, text: card.back });
  });

  // Implementation plan
  const ip = chapter.implementationPlan;
  if (ip) {
    if (ip.title) fields.push({ unit: "implementationPlan.title", text: ip.title });
    if (ip.coreSkill) fields.push({ unit: "implementationPlan.coreSkill", text: ip.coreSkill });
    if (ip.twentyFourHourChallenge) fields.push({ unit: "implementationPlan.twentyFourHourChallenge", text: ip.twentyFourHourChallenge });
    if (ip.weeklyPractice) fields.push({ unit: "implementationPlan.weeklyPractice", text: ip.weeklyPractice });
    (ip.ifThenPlans ?? []).forEach((p, i) => {
      if (p.plan) fields.push({ unit: `implementationPlan.ifThen[${i}].plan`, text: p.plan });
    });
  }

  for (const { unit, text } of fields) {
    const match = text.match(SALT_Q_TOKEN) ?? text.match(SALT_PREFIX_TOKEN);
    if (match) {
      findings.push(
        finding(
          "AS1.identifier_token_injection" as any,
          "blocker",
          `${unit} contains identifier-like token "${match[0]}" inside prose — this looks like salting to evade n-gram critics. Rewrite the sentence without the token.`,
          text.slice(Math.max(0, (match.index ?? 0) - 30), (match.index ?? 0) + 60),
        ),
      );
    }
  }
  return findings;
}

/**
 * AS2 — jammed proper nouns. Two 4+-letter capitalized words mashed without
 * a space ("MaplefieldBridgeton"). Real English doesn't produce these; they
 * are template-substitution artifacts.
 */
export function checkChapterJammedNouns(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const fields: Array<{ unit: string; text: string }> = [];

  // Same field set as AS1 — every text field except structured ids
  if (chapter.hook) fields.push({ unit: "hook", text: chapter.hook });
  if (chapter.counterintuition) fields.push({ unit: "counterintuition", text: chapter.counterintuition });
  if (chapter.tryThisNow) fields.push({ unit: "tryThisNow", text: chapter.tryThisNow });
  if (chapter.keyTakeaway) fields.push({ unit: "keyTakeaway", text: chapter.keyTakeaway });
  if (chapter.breakdown?.fastRead) fields.push({ unit: "breakdown.fastRead", text: chapter.breakdown.fastRead });
  if (chapter.breakdown?.deepRead) fields.push({ unit: "breakdown.deepRead", text: chapter.breakdown.deepRead });
  if (chapter.breakdown?.fullRead) fields.push({ unit: "breakdown.fullRead", text: chapter.breakdown.fullRead });
  (chapter.examples ?? []).forEach((ex, i) => {
    if (ex.title) fields.push({ unit: `example[${i}].title`, text: ex.title });
    if (ex.scenario) fields.push({ unit: `example[${i}].scenario`, text: ex.scenario });
    if (ex.whatToDo) fields.push({ unit: `example[${i}].whatToDo`, text: ex.whatToDo });
    if (ex.whyItMatters) fields.push({ unit: `example[${i}].whyItMatters`, text: ex.whyItMatters });
  });
  (chapter.quiz?.questions ?? []).forEach((q) => {
    if (q.prompt) fields.push({ unit: `quiz.${q.questionId}.prompt`, text: q.prompt });
    (q.choices ?? []).forEach((c, ci) => {
      if (typeof c === "string") fields.push({ unit: `quiz.${q.questionId}.choice[${ci}]`, text: c });
    });
    if (q.explanation) fields.push({ unit: `quiz.${q.questionId}.explanation`, text: q.explanation });
  });
  (chapter.reviewCards ?? []).forEach((card) => {
    if (card.front) fields.push({ unit: `card.${card.cardId}.front`, text: card.front });
    if (card.back) fields.push({ unit: `card.${card.cardId}.back`, text: card.back });
  });

  for (const { unit, text } of fields) {
    // Scan ALL jammed-noun matches and report the first that is NOT an allowlisted brand,
    // so a real salt artifact later in the field still fires even if a brand appears first.
    for (const m of text.matchAll(JAMMED_PROPER_NOUNS)) {
      if (CAMELCASE_BRAND_ALLOWLIST.has(m[0])) continue;
      findings.push(
        finding(
          "AS2.jammed_proper_nouns" as any,
          "blocker",
          `${unit} contains jammed proper nouns "${m[0]}" — two capitalized words mashed without a space. Rewrite as separate words with a separator, or use a single coherent place name.`,
          text.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 60),
        ),
      );
      break; // one finding per field, as before
    }
  }
  return findings;
}

/**
 * AS3 — doubled period. A sentence ending in `..` followed by whitespace + a
 * capital letter is a generation parse error or a deliberate marker.
 */
export function checkChapterDoubledPeriods(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const fields: Array<{ unit: string; text: string }> = [];

  if (chapter.hook) fields.push({ unit: "hook", text: chapter.hook });
  if (chapter.breakdown?.fastRead) fields.push({ unit: "breakdown.fastRead", text: chapter.breakdown.fastRead });
  if (chapter.breakdown?.deepRead) fields.push({ unit: "breakdown.deepRead", text: chapter.breakdown.deepRead });
  if (chapter.breakdown?.fullRead) fields.push({ unit: "breakdown.fullRead", text: chapter.breakdown.fullRead });
  (chapter.examples ?? []).forEach((ex, i) => {
    if (ex.scenario) fields.push({ unit: `example[${i}].scenario`, text: ex.scenario });
    if (ex.whatToDo) fields.push({ unit: `example[${i}].whatToDo`, text: ex.whatToDo });
    if (ex.whyItMatters) fields.push({ unit: `example[${i}].whyItMatters`, text: ex.whyItMatters });
  });

  for (const { unit, text } of fields) {
    const match = text.match(DOUBLED_PERIOD);
    if (match) {
      findings.push(
        finding(
          "AS3.doubled_period" as any,
          "blocker",
          `${unit} contains doubled period "${match[0]}" — generation parse error or sentence-boundary salting. Replace with a single period.`,
          text.slice(Math.max(0, (match.index ?? 0) - 30), (match.index ?? 0) + 60),
        ),
      );
    }
  }
  return findings;
}

// ── Book-level critic ───────────────────────────────────────────────────────

/**
 * AS4 — positional quiz prompt template substitution. For each question
 * position N across chapters (q01 in Ch1 vs q01 in Ch2 vs ... vs q01 in Ch11),
 * computes a token-level similarity score. If 5+ chapters share >70% identical
 * words at the same prompt position, that's a template skeleton with
 * substituted nouns — the exact pattern from the Covey incident.
 *
 * The Covey example: every chapter's q06 was:
 *   "If the [TOKEN] family calendar rewards push through fatigue, which plan
 *    best serves [TOKEN] balance?"
 * with TOKEN varying per chapter. Token-level diff catches this immediately:
 * the 14 non-TOKEN words are identical, so similarity is 14/16 = 87.5% > 70%.
 */
/**
 * Minimum identical (multiset-shared) word count for a same-position prompt group to
 * count as a salt skeleton. A legitimate short recall stem with a distinct CONCEPT per
 * chapter ("What is the main idea behind anchoring/framing/…?") shares 6 words; a salt
 * skeleton with a one-token MARKER ("After Reyes'/Patel's setback which step best restores
 * momentum?") shares 7. 7 is the exact line: it exempts the 6-shared distinct-concept stem
 * (the false positive) while still firing on the 7-shared marker skeleton (an adversarial
 * probe's evasion). Note there is no cross-chapter verbatim-quiz-prompt backstop downstream
 * (AS10 covers examples/breakdown, AS12 covers answer SEQUENCES), so this floor must stay
 * tight — do not raise it. Below 7 shared, salt and a legitimate short stem are
 * indistinguishable by length alone (the irreducible limit of this heuristic).
 */
const SHARED_SKELETON_MIN = 7;

export function checkBookQuizPromptTemplates(chapters: ChapterV21[]): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (chapters.length < 2) return findings;

  // Group prompts by question position (q01 across all chapters, q02 across all, etc.)
  const byPosition = new Map<string, Array<{ chapter: number; questionId: string; prompt: string }>>();
  for (const ch of chapters) {
    for (const q of ch.quiz?.questions ?? []) {
      if (typeof q.prompt !== "string" || !q.prompt) continue;
      const key = q.questionId; // q01, q02, ...
      const list = byPosition.get(key) ?? [];
      list.push({ chapter: ch.number, questionId: q.questionId, prompt: q.prompt });
      byPosition.set(key, list);
    }
  }

  for (const [position, prompts] of byPosition.entries()) {
    if (prompts.length < 3) continue;

    // For each pair, compute token-set similarity (Jaccard-style on word multiset).
    // If 5+ prompts in the group share >70% similarity pairwise with at least
    // one other, the group is template-substitution.
    const tokenSets = prompts.map((p) => tokenize(p.prompt));
    const highSimilarity = new Map<number, number[]>();
    for (let i = 0; i < prompts.length; i++) {
      for (let j = i + 1; j < prompts.length; j++) {
        const sim = wordOverlapSimilarity(tokenSets[i], tokenSets[j]);
        const shared = sharedWordCount(tokenSets[i], tokenSets[j]);
        // BOTH a high overlap ratio AND a long enough shared skeleton. The ratio alone
        // false-fires on short distinct-concept recall stems ("What is the main idea behind
        // anchoring?" vs "…framing?" = 6 shared words, 0.86 ratio — legitimately distinct
        // concepts). A real salt skeleton is LONG (it has to span an n-gram window to be
        // worth gaming): the Covey artifact shared 14 words. SHARED_SKELETON_MIN separates
        // them; within-chapter (AS13) and cross-chapter n-gram (AS10–AS12) backstop the rest.
        if (sim >= 0.7 && shared >= SHARED_SKELETON_MIN) {
          const list = highSimilarity.get(i) ?? [];
          list.push(j);
          highSimilarity.set(i, list);
        }
      }
    }

    // Build connected component (anyone in the cluster who has at least one
    // 70%+ similar neighbor counts toward the cluster size).
    const inCluster = new Set<number>();
    for (const [i, neighbors] of highSimilarity.entries()) {
      inCluster.add(i);
      for (const n of neighbors) inCluster.add(n);
    }
    if (inCluster.size >= 3) {
      const chs = [...inCluster].map((idx) => `Ch${prompts[idx].chapter}`).sort();
      const sample = prompts[[...inCluster][0]].prompt;
      findings.push(
        finding(
          "AS4.quiz_prompt_template_substitution" as any,
          "blocker",
          `${inCluster.size} chapters share >70% identical words at quiz position ${position} (${chs.join(", ")}). This is template substitution with marker tokens — the prompts share a skeleton with only 1-2 substituted words per chapter. Rewrite each chapter's ${position} as a distinct scenario.`,
          sample.slice(0, 200),
        ),
      );
    }
  }

  return findings;
}

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Tokenize a string into lowercase word tokens, stripping punctuation. Used
 * for similarity scoring.
 */
function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
}

/**
 * Word-overlap similarity: |A ∩ B| / max(|A|, |B|). Treats each prompt as a
 * multiset of words; ratio of shared words to the longer prompt's length.
 *
 * Chose this over Jaccard (|A ∩ B| / |A ∪ B|) because Jaccard double-counts
 * the differences. For two prompts that share a 14-word skeleton with 2 unique
 * tokens each:
 *   word-overlap: 14 / 16 = 0.875
 *   Jaccard:      14 / 18 = 0.778
 * Both fire above the 0.7 threshold; word-overlap is more intuitive to read.
 */
function wordOverlapSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  return sharedWordCount(a, b) / Math.max(a.length, b.length);
}

/** Multiset intersection size: how many word occurrences a and b share. */
function sharedWordCount(a: string[], b: string[]): number {
  const counterA = new Map<string, number>();
  for (const w of a) counterA.set(w, (counterA.get(w) ?? 0) + 1);
  const counterB = new Map<string, number>();
  for (const w of b) counterB.set(w, (counterB.get(w) ?? 0) + 1);
  let shared = 0;
  for (const [w, ca] of counterA) shared += Math.min(ca, counterB.get(w) ?? 0);
  return shared;
}
