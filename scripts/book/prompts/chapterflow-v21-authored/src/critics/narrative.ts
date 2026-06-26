/**
 * Narrative critics — check that example scenarios are scenes, not
 * thesis-paraphrases. These are the single largest class of failure in v13's
 * weak books (e.g. tiny-habits 4.2% named-protagonist rate).
 */

import {
  ChapterV21,
  CriticFinding,
  Example,
  MaybeToned,
  ToneKeyed,
  resolveDirect,
} from "../types.js";
import { allTones, finding, loadStandardGivenNames, pickEvidence, truncate } from "./shared.js";

const PROPER_NOUN_STOPWORDS = new Set([
  "The", "A", "An", "If", "When", "That", "But", "Chapter", "Monday", "Tuesday",
  "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "She", "He", "They",
  "It", "This", "And", "Or", "So", "Her", "His", "Then", "Because", "Before",
  "After", "While", "Once", "During", "Without", "Within", "Yet", "Still",
  "Such", "Here", "There", "Whenever", "Even", "Only", "Often", "Now",
  "Yesterday", "Today", "Tomorrow", "Like", "Unlike", "Both", "Either",
  "Neither", "Every", "No", "Any", "Some",
]);

const PROPER_NOUN_RE = /\b[A-Z][a-z]{2,}\b/g;

/**
 * Check N: detects Cartesian-product / template-locked examples within a
 * chapter. When an agent (especially GPT-in-Codex) generates "6 examples"
 * by substituting name+city+role into one shared template, the scenarios
 * end up sharing long verbatim phrases. This check looks for 5+ consecutive
 * words that appear identically in 3 or more example scenarios — a signature
 * Cartesian-product gives but legitimate scene-writing does not.
 *
 * Specifically: 7-powers ch1 shipped with
 *   "{name} is a {role} in {city} at {time}, standing over a marked-up
 *    spreadsheet and a cold cup of coffee. Two options look similar until
 *    {name} traces the unit cost curve..."
 * across 6 examples. This check fires on that.
 */
export function checkExampleTemplating(
  examples: Array<{ scenario?: string; title?: string }>,
): CriticFinding[] {
  if (examples.length < 3) return [];

  // Normalize: lowercase, collapse whitespace, drop the first word (often the
  // protagonist's name, which we expect to vary).
  const tokenizedScenarios = examples.map((ex) => {
    const raw = (ex.scenario ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const words = raw.split(" ");
    return words.slice(1); // skip the leading protagonist name
  });

  // Build all 5-grams across all scenarios with their owning example index.
  const NGRAM = 5;
  const ngramToExamples = new Map<string, Set<number>>();
  for (let i = 0; i < tokenizedScenarios.length; i++) {
    const words = tokenizedScenarios[i];
    for (let j = 0; j + NGRAM <= words.length; j++) {
      const gram = words.slice(j, j + NGRAM).join(" ");
      // Skip grams that are mostly stopwords / generic phrases (these will
      // overlap naturally between real scenes too).
      if (/^[a-z ]+$/.test(gram) && gram.replace(/ /g, "").length >= 20) {
        if (!ngramToExamples.has(gram)) ngramToExamples.set(gram, new Set());
        ngramToExamples.get(gram)!.add(i);
      }
    }
  }

  const findings: CriticFinding[] = [];
  const reportedExamples = new Set<number>();
  for (const [gram, exSet] of ngramToExamples) {
    if (exSet.size >= 3) {
      const indices = Array.from(exSet).sort((a, b) => a - b);
      // Report once per offending example.
      const newOnes = indices.filter((i) => !reportedExamples.has(i));
      if (newOnes.length === 0) continue;
      for (const i of indices) reportedExamples.add(i);
      findings.push(
        finding(
          "narrative.example_templating",
          "blocker",
          `examples ${indices.map((i) => i + 1).join(", ")} share the verbatim 5-word phrase "${gram}" — this is a Cartesian-product / template-locked output, not distinct scenes`,
          gram,
        ),
      );
    }
  }

  // Also catch shared title patterns: if 3+ titles share an exact 3-word
  // substring after the first word, it's the same template.
  const titles = examples.map((ex) => (ex.title ?? "").toLowerCase().split(/\s+/).slice(1));
  const titleNgram = 3;
  const titleNgramToExamples = new Map<string, Set<number>>();
  for (let i = 0; i < titles.length; i++) {
    const words = titles[i];
    for (let j = 0; j + titleNgram <= words.length; j++) {
      const gram = words.slice(j, j + titleNgram).join(" ");
      if (gram.replace(/ /g, "").length >= 8) {
        if (!titleNgramToExamples.has(gram)) titleNgramToExamples.set(gram, new Set());
        titleNgramToExamples.get(gram)!.add(i);
      }
    }
  }
  for (const [gram, exSet] of titleNgramToExamples) {
    if (exSet.size >= 3) {
      const indices = Array.from(exSet).sort((a, b) => a - b);
      findings.push(
        finding(
          "narrative.title_templating",
          "blocker",
          `example titles ${indices.map((i) => i + 1).join(", ")} share the 3-word phrase "${gram}" — titles must be specific to each scene, not "<Name> ${gram}..." across the slate`,
          gram,
        ),
      );
      break; // one report per chapter is enough
    }
  }

  return findings;
}

/**
 * Check: one proper noun is stamped across most example scenarios as a shared
 * setting/entity — the ch2-of-4HWW "Princeton University in all six scenes"
 * defect that the QC bar caught but the gates missed. Distinct from
 * checkExampleTemplating (which needs a verbatim shared 5-gram): here the prose
 * varies but the same place/institution is bolted onto every scene, which reads
 * as source-stuffing rather than distinct real-world scenes. Exempts nouns that
 * appear in the chapter's THESIS text (hook/counterintuition/keyTakeaway/
 * breakdown) — those are the book's genuinely central entity (e.g. "Basecamp"
 * for "scratch your own itch") and legitimately recur across scenes.
 */
const SPATIAL_PREP = new Set([
  "in", "at", "inside", "outside", "near", "within", "across", "atop", "aboard", "into", "onto", "around",
]);

export function checkExampleSettingStamping(
  examples: Array<{ scenario?: string }>,
  coreTeachingText: string,
): CriticFinding[] {
  const n = examples.length;
  if (n < 4) return [];
  const exempt = (coreTeachingText ?? "").toLowerCase();
  // Collect, per example, proper nouns used as a SETTING — a capitalized token
  // within 4 words after a spatial preposition ("in a Princeton room"). This
  // targets a single LOCATION stamped across scenes (the ch2 "Princeton" x6
  // defect) while ignoring a concept/figure merely referenced ("Rogers's law",
  // "the Golden Circle"), which is what produced the false positives on the gold
  // corpus before this narrowing.
  const nounToExamples = new Map<string, Set<number>>();
  examples.forEach((ex, i) => {
    const words = (ex.scenario ?? "").split(/\s+/);
    const seen = new Set<string>();
    for (let w = 0; w < words.length; w++) {
      const m = words[w].match(/^([A-Z][a-z]{2,})/);
      if (!m) continue;
      const noun = m[1];
      if (PROPER_NOUN_STOPWORDS.has(noun) || seen.has(noun)) continue;
      let spatial = false;
      for (let k = Math.max(0, w - 4); k < w; k++) {
        if (SPATIAL_PREP.has(words[k].toLowerCase().replace(/[^a-z]/g, ""))) { spatial = true; break; }
      }
      if (!spatial) continue;
      seen.add(noun);
      if (!nounToExamples.has(noun)) nounToExamples.set(noun, new Set());
      nounToExamples.get(noun)!.add(i);
    }
  });
  const threshold = Math.max(4, Math.ceil(n * 0.6));
  const findings: CriticFinding[] = [];
  for (const [noun, idxs] of nounToExamples) {
    if (idxs.size < threshold) continue;
    if (exempt.includes(noun.toLowerCase())) continue; // central concept/entity — legit
    findings.push(
      finding(
        "narrative.example_setting_stamping",
        "major",
        `the location "${noun}" is the setting in ${idxs.size} of ${n} example scenes (examples ${[...idxs].map((i) => i + 1).join(", ")}) — a single place stamped across the slate reads as source-stuffing, not ${idxs.size} distinct real-world scenes. Vary the settings.`,
        noun,
      ),
    );
  }
  return findings;
}

/**
 * Check: the same protagonist name leads more than one example scene. The name
 * plan allocates a distinct protagonist per example, so a name that is the
 * recurring actor (>=2 mentions) in two scenes is a reused/templated cast — the
 * within-chapter twin of book-gate F1, which the 4HWW QC flagged on ch5/ch14.
 * Counts only names that recur within a scenario (>=2x) so one-off place/entity
 * nouns can't false-positive.
 */
export function checkExampleProtagonistReuse(
  examples: Array<{ scenario?: string }>,
): CriticFinding[] {
  if (examples.length < 2) return [];
  const protagonistOf = (scenario: string): string | null => {
    const counts = new Map<string, number>();
    for (const m of (scenario ?? "").matchAll(PROPER_NOUN_RE)) {
      const w = m[0];
      if (PROPER_NOUN_STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestC = 1;
    for (const [w, c] of counts) if (c >= 2 && c > bestC) { best = w; bestC = c; }
    return best;
  };
  const nameToExamples = new Map<string, number[]>();
  examples.forEach((ex, i) => {
    const p = protagonistOf(ex.scenario ?? "");
    if (!p) return;
    if (!nameToExamples.has(p)) nameToExamples.set(p, []);
    nameToExamples.get(p)!.push(i + 1);
  });
  const findings: CriticFinding[] = [];
  for (const [name, exs] of nameToExamples) {
    if (exs.length >= 2) {
      findings.push(
        finding(
          "narrative.example_protagonist_reuse",
          "major",
          `"${name}" is the recurring protagonist of multiple examples (${exs.join(", ")}) — each scene needs its own named protagonist (the name plan allocates one per scene). A reused name across scenes reads as a templated cast.`,
          name,
        ),
      );
    }
  }
  return findings;
}

/**
 * ── Cast discipline (C24 cast-overflow, C25 example↔quiz cast-shuffle) ────────
 *
 * THE DEFECT. Two cast failures the existing critics miss:
 *  (1) Willpower's "Bailey" is three DIFFERENT people across the examples and the
 *      quiz — one name silently reassigned to new roles. C23 catches the
 *      example-vs-example half (a name leading ≥2 scenes), but nothing checked
 *      whether that reshuffled name then LEAKS INTO A GRADED QUIZ QUESTION, where
 *      the reader can no longer tell which "Bailey" the question means.
 *  (2) A regen chapter ran NINE interchangeable coaches — a crowded, faceless cast
 *      where no single person carries a lesson. Nothing counted the cast size.
 *
 * THE CALIBRATION (a full-corpus sweep of 330 shipped chapters / 23 books drove
 * both thresholds). The DISCRIMINATOR for "a named person" is recurrence: a real
 * protagonist is named and then acted ON again ("Aisha … she …"), so it appears
 * ≥2× in its own scenario; a one-off capitalized token (a CITY — "Houston",
 * "Kyoto" — or a real ORG — "Dell", "Disney") appears once. Counting every
 * capitalized token over-fired to 15–23 on reference-quality daring-greatly;
 * counting only NAMES THAT RECUR WITHIN A SINGLE SCENARIO tops out at exactly 6
 * across the gold corpus (daring-greatly ch06/ch07), so the cap is > 6. The
 * determiner guard ("the delivery", "a table") strips capitalized common nouns.
 */

// Capitalized tokens that are name-shaped but never a person (sentence-initial
// adverbs / discourse markers most likely to recur). Kept LOCAL so the shared
// PROPER_NOUN_STOPWORDS (used by C1/C22/C23) is not perturbed.
const NON_PERSON_WORDS = new Set([
  "Maybe", "Perhaps", "Meanwhile", "Instead", "Later", "Soon", "Suddenly",
  "Finally", "Eventually", "Nobody", "Somebody", "Everybody", "Anybody",
  "Nothing", "Something", "Everything", "Anything", "Someone", "Everyone",
  "Anyone", "Today", "Tonight", "Together", "Often", "Always", "Never",
]);

// Determiners that mark the following capitalized token as a COMMON noun
// ("the Delivery", "a Table", "their Report") rather than a person's name.
const NAME_DETERMINERS = new Set([
  "the", "a", "an", "her", "his", "their", "its", "this", "that", "these",
  "those", "each", "every", "some", "one", "two", "another", "no", "any",
  "my", "your", "our",
]);

/** Count capitalized PERSON names in a span. A token counts only if it is not a
 *  stopword / discourse marker AND is not immediately preceded by a determiner
 *  (which would make it a common noun). Pure + exhaustively unit-testable. */
export function countPersonNames(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  if (!text || typeof text !== "string") return counts;
  const tokens = text.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const m = tokens[i].match(/^["'“(]*([A-Z][a-z]{2,})/);
    if (!m) continue;
    const name = m[1];
    if (PROPER_NOUN_STOPWORDS.has(name) || NON_PERSON_WORDS.has(name)) continue;
    // Capitalized gerund/participle sentence-openers ("Watching", "Standing") are
    // never first names; excluding "-ing" tokens kills that whole FP class (the
    // rare "-ing" first name, e.g. "Channing", is a tolerable under-count for a
    // shadow gate that must never over-count).
    if (/ing$/.test(name)) continue;
    const prev = (tokens[i - 1] ?? "").toLowerCase().replace(/[^a-z]/g, "");
    if (NAME_DETERMINERS.has(prev)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/** Names that RECUR (≥2×) within a single span — the chapter's actual actors. */
function recurringActors(text: string): Set<string> {
  const out = new Set<string>();
  for (const [name, n] of countPersonNames(text)) if (n >= 2) out.add(name);
  return out;
}

/** The lead protagonist of one scenario: the most-mentioned recurring person
 *  (mirrors C23's protagonistOf, but through the determiner-guarded counter). */
function leadProtagonist(text: string): string | null {
  let best: string | null = null;
  let bestCount = 1;
  for (const [name, n] of countPersonNames(text)) {
    if (n >= 2 && n > bestCount) { best = name; bestCount = n; }
  }
  return best;
}

function scenarioText(ex: { scenario?: MaybeToned<string> }): string {
  return allTones(ex.scenario).join(" \n ");
}

/** The distinct named cast of a chapter: every person who recurs within at least
 *  one example scenario, unioned across the slate. Pure (scenarios → names). */
export function chapterCast(scenarios: string[]): string[] {
  const cast = new Set<string>();
  for (const sc of scenarios) for (const a of recurringActors(sc)) cast.add(a);
  return [...cast].sort();
}

/** Names that lead ≥2 distinct example scenarios → distinct people sharing one
 *  name (the example side of the reshuffle). Pure. Returns name → 1-based scenes. */
export function multiOwnedLeads(scenarios: string[]): Map<string, number[]> {
  const owners = new Map<string, number[]>();
  scenarios.forEach((sc, i) => {
    const lead = leadProtagonist(sc);
    if (!lead) return;
    if (!owners.has(lead)) owners.set(lead, []);
    owners.get(lead)!.push(i + 1);
  });
  for (const [name, scenes] of [...owners]) if (scenes.length < 2) owners.delete(name);
  return owners;
}

const CAST_CAP = 6;
const C24_FIX =
  "Cut the cast to ≤6 named people: give each example a single protagonist, demote minor named foils to unnamed roles (\"a colleague\"), and stop introducing a fresh named bystander in every scene.";

/**
 * C24 — cast overflow. More than CAST_CAP (6) distinct named protagonists recur
 * across the example slate: a crowded, interchangeable cast where no one person
 * carries a lesson. SHADOW major (zero on the gold corpus — daring-greatly tops
 * out at exactly 6; promote only via the gold-corpus proof).
 */
export function checkCastSize(chapter: ChapterV21): CriticFinding[] {
  const scenarios = (chapter.examples ?? []).map(scenarioText);
  const cast = chapterCast(scenarios);
  if (cast.length <= CAST_CAP) return [];
  return [
    finding(
      "C24.cast_overflow" as any,
      "major",
      `examples: the chapter casts ${cast.length} distinct named protagonists, over the cap of ${CAST_CAP} — "${truncate(cast.join(", "), 60)}" (a crowded, interchangeable cast blurs which person carries each lesson). ${C24_FIX}`,
      cast.join(", "),
    ),
  ];
}

const C25_FIX =
  "A quiz scenario must reuse one example's protagonist consistently or introduce a clearly new name — never a name that already denotes several different people. Re-key this question to an unambiguous name.";

/**
 * C25 — example↔quiz cast shuffle. A name that is the lead protagonist of ≥2
 * DIFFERENT example scenes (so it already denotes multiple people) ALSO surfaces
 * in the quiz, contaminating a GRADED question with a reshuffled identity. This
 * is the cross-surface half C23 (example-only) cannot see; it routes a quiz
 * re-key, not an example rename. SHADOW major (zero on the gold corpus, which
 * reuses each single-owner example name in its quiz consistently). The quiz scan
 * is name-presence only, so a clean book that reuses a UNIQUE example protagonist
 * in its matching quiz question (daring-greatly's Mei→q3) never fires.
 */
export function checkExampleQuizNameConsistency(chapter: ChapterV21): CriticFinding[] {
  const scenarios = (chapter.examples ?? []).map(scenarioText);
  const reshuffled = multiOwnedLeads(scenarios);
  if (reshuffled.size === 0) return [];
  const questions = chapter.quiz?.questions ?? [];
  const findings: CriticFinding[] = [];
  for (const [name, scenes] of reshuffled) {
    // Find the first quiz question that names this reshuffled person (evidence).
    let evidence: string | null = null;
    for (const q of questions) {
      const qText = [q.prompt, ...(q.choices ?? []), q.explanation ?? ""].join(" ");
      if (countPersonNames(qText).has(name)) { evidence = q.prompt ?? qText; break; }
    }
    if (evidence === null) continue; // reshuffled name stays inside the examples → C23's job, not C25's
    findings.push(
      finding(
        "C25.cast_shuffle" as any,
        "major",
        `quiz: "${truncate(name, 60)}" leads ${scenes.length} different example scenes (${scenes.join(", ")}) AND appears in the quiz — the graded question silently inherits a reshuffled identity, so the reader cannot tell which "${name}" it means. ${C25_FIX}`,
        evidence,
      ),
    );
  }
  return findings;
}

/**
 * ── C27 — exotic / off-standard name density (advisory) ──────────────────────
 *
 * THE DEFECT (Finding #8). A chapter's example cast is a slate of affected,
 * uncommon names — Thomasina, Rhiannon, Soledad, Osvald, Eero, Saoirse — that
 * read as trying-too-hard and are hard for a reader to hold across six scenes.
 * Nothing scored commonality: catalogAudit tracks cross-book name COLLISIONS
 * (reuse), and C7 bans a specific over-used handful (the opposite signal).
 *
 * THE STANDARD (owner direction 2026-06-25). Example protagonists should read as
 * standard contemporary American/Canadian names — the same pool the pre-authoring
 * allocator deals (config/name-bank.json), plus the diminutives the formal pool
 * omits (config/common-given-names.json). The commonality ORACLE is the union of
 * those two (loadStandardGivenNames). A cast name absent from it is "off-standard".
 *
 * THE DISCRIMINATOR / FP GUARD. The cast is the chapter's RECURRING actors via the
 * gold-calibrated chapterCast (so one-off cities/orgs and determiner-led common
 * nouns never count — the same extractor C24 proved zero-FP on a 330-chapter
 * sweep). C27 fires only when the cast is large enough to read as a slate
 * (>= C27_MIN_CAST) AND a strict majority of it is off-standard (> 60%). MINOR /
 * SHADOW: it surfaces QC debt, it never blocks; commonality is corpus-relative,
 * so this is a STRENGTHEN signal, not a gating judgment. The gold corpus is held
 * clean by regenerating its example casts onto standard names (the defect this
 * critic targets is precisely that the old generation shipped an off-standard
 * cast). See config/common-given-names.json + tests/name-commonality.test.ts.
 */
const C27_MIN_CAST = 4;
const C27_UNCOMMON_SHARE = 0.6;
const C27_FIX =
  "Draw protagonists from standard contemporary American/Canadian names (the allocator's name pool); reserve an unusual name only for when it does real characterization work. A whole cast of uncommon names reads as affected and is hard to track.";

/** Pure: the off-standard share of a recurring cast. Exhaustively unit-testable. */
export function offStandardNames(cast: string[]): string[] {
  const standard = loadStandardGivenNames();
  return cast.filter((n) => !standard.has(n.toLowerCase()));
}

export function checkNameCommonality(chapter: ChapterV21): CriticFinding[] {
  const scenarios = (chapter.examples ?? []).map(scenarioText);
  const cast = chapterCast(scenarios);
  if (cast.length < C27_MIN_CAST) return [];
  const uncommon = offStandardNames(cast);
  const share = uncommon.length / cast.length;
  if (share <= C27_UNCOMMON_SHARE) return [];
  return [
    finding(
      "C27.exotic_name_density" as any,
      "minor",
      `examples: ${uncommon.length} of ${cast.length} named protagonists are off-standard (${Math.round(share * 100)}% of the cast) — "${truncate(uncommon.join(", "), 60)}" (an all-uncommon cast reads as affected and is hard to track). ${C27_FIX}`,
      uncommon.join(", "),
    ),
  ];
}

/**
 * Check N: alphabet-cycling protagonist names within a chapter.
 *
 * When an agent enumerates names by walking the alphabet, the first letters
 * of consecutive example titles run A, B, C, D, E... — a script tell that
 * the agent generated a name list rather than choosing protagonists scene
 * by scene. Antifragile shipped with 21/25 chapters following this pattern
 * (Aderemi, Brontez, Cvetko, Delyth, Evaristo, Flavia → Gennaro, Hanneli,
 * Irfan, Jacinta, Kostya, Liora → ...). C8 didn't catch it because the
 * scenarios themselves were varied; only the naming was patterned.
 *
 * Fires when 4 or more example titles in a chapter start with consecutive
 * letters of the alphabet (in either order). Below 4 may be accidental;
 * 4+ is mechanical.
 */
export function checkAlphabetCyclingNames(
  examples: Array<{ title?: string }>,
): CriticFinding[] {
  if (examples.length < 4) return [];
  const firstLetters: string[] = examples
    .map((ex) => (ex.title ?? "").trim().charAt(0).toUpperCase())
    .filter((c) => /^[A-Z]$/.test(c));
  if (firstLetters.length < 4) return [];

  // Find the longest run of consecutive alphabet letters in the sequence
  // (in title order — the order the agent picked the names).
  let longestRun = 1;
  let runStart = 0;
  let bestStart = 0;
  for (let i = 1; i < firstLetters.length; i++) {
    const diff = firstLetters[i].charCodeAt(0) - firstLetters[i - 1].charCodeAt(0);
    if (diff === 1 || diff === -1) {
      const run = i - runStart + 1;
      if (run > longestRun) {
        longestRun = run;
        bestStart = runStart;
      }
    } else {
      runStart = i;
    }
  }

  if (longestRun >= 4) {
    const offenders = firstLetters.slice(bestStart, bestStart + longestRun).join("");
    return [
      finding(
        "narrative.alphabet_cycling_names",
        "blocker",
        `${longestRun} consecutive example titles start with alphabet-sequential letters (${offenders}) — agent enumerated the alphabet instead of choosing protagonists scene by scene; rewrite with unrelated names`,
        offenders,
      ),
    ];
  }
  return [];
}

/** Check 1: named protagonist present in scenario. */
export function checkNamedProtagonist(ex: Example): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const texts = allTones(ex.scenario);
  if (texts.length === 0) {
    findings.push(
      finding(
        "narrative.named_protagonist",
        "blocker",
        "example.scenario is missing or empty",
      ),
    );
    return findings;
  }

  // Pass if ANY tone has a named protagonist; fail only if all tones lack one.
  let anyPassed = false;
  for (const text of texts) {
    const matches = text.match(PROPER_NOUN_RE) ?? [];
    const realNames = matches.filter((m) => !PROPER_NOUN_STOPWORDS.has(m));
    if (realNames.length > 0) {
      anyPassed = true;
      break;
    }
  }
  if (!anyPassed) {
    findings.push(
      finding(
        "narrative.named_protagonist",
        "blocker",
        "scenario has no named protagonist — reads as thesis-paraphrase, not a scene",
        texts[0],
      ),
    );
  }
  return findings;
}

/** Check 2: specific scene anchoring. */
const SCENE_ANCHORS = [
  // days
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  // clock times
  " a.m.", " p.m.", " am ", " pm ", ":00", ":15", ":30", ":45",
  // time-of-day phrases
  "this morning", "this afternoon", "tonight", "this evening", "late night",
  "at dawn", "before lunch", "after lunch", "before dinner", "after dinner",
  // concrete locations / objects
  "at the meeting", "on the call", "in the draft", "in the email",
  "on the dashboard", "in the doc", "on the board", "on the court",
  "at her desk", "at his desk", "at their desk", "across the table",
  "in the review", "in her inbox", "in his inbox",
  "at the pass", "on the counter", "at the kitchen table",
  "in chambers", "on the floor", "at the bench", "at the podium",
  "in the practice room", "in the control room", "in the hallway",
  // scene deictics
  "sunday night", "before the meeting", "after the meeting",
  "hovers over", "hovering over", "hovers above", "is hovering over",
  // historical/ancient-register deictics (Stoic/philosophy books are concrete
  // but not modern-office; these never occur in a 21st-century-office scene, so
  // adding them is monotonic — C2 fires LESS, never on a new modern scene)
  "at dusk", "by dusk", "by dawn", "before first light", "at first light",
  "in the lesson room", "in the courtyard", "on the stair", "in the colonnade",
  "in the forum", "by lamplight",
];

const ROLE_ANCHORS = [
  "manager", "teacher", "student", "founder", "parent", "coach", "director",
  "vp", " pm ", "engineer", "designer", "nurse", "doctor", "lead", "principal",
  "partner", "trainer", "attorney", "analyst", "producer",
  // historical/ancient-register roles
  "emperor", "senator", "clerk", "scribe", "slave", "freedman", "merchant",
  "guard", "soldier", "philosopher", "herald", "sailor", "magistrate", "tutor",
];

const CONCRETE_OBJECT_ANCHOR_RE =
  /\b(?:clipboard|dashboard|counter|table|desk|screen|laptop|whiteboard|memo|memos|chart|folder|binder|briefing|docket|proposal|draft|invoice|worksheet|headset|map|plan|form|report|note|notes|email|inbox|calendar|radio|camera|microscope|slide|spreadsheet|contract|ballot|case file|waiting room|practice room|courtroom|kitchen|warehouse|lab|clinic|hospital|studio|classroom|conference room|hearing room|boardroom|shop floor|control room|break room|tablet|tablets|wax seal|seal|scroll|scrolls|reed|stylus|lamp|wick|cloak|jar|amphora|spear|broom|ledger|petition|decree|dispatch|colonnade|courtyard|portico|stoa|altar|forum|marketplace|granary|aqueduct|shirt|closet|workbench|wrench|gate board)\b/;

const PLACE_PHRASE_RE =
  /\b(?:at|in|on|inside|outside|beside|behind|under|across)\s+(?:the|a|an|her|his|their)\s+[a-z0-9'-]+(?:\s+[a-z0-9'-]+){0,4}\b/;

// A specific NAMED place after a locative preposition ("in Nicopolis", "outside
// Epictetus's room", "across Nero's court"). PLACE_PHRASE_RE requires a lowercase
// article, so proper-noun / possessive places (common in historical-register
// scenes) slip past it even though they are concrete settings. Tested on the
// ORIGINAL (cased) text, so it keys on the capital letter. Only ever makes C2
// pass MORE — it cannot raise any book's count.
const PROPER_PLACE_RE =
  /\b(?:at|in|on|inside|outside|beside|behind|near|across|through|along)\s+(?:the\s+|a\s+|an\s+|her\s+|his\s+|their\s+)?[A-Z][a-z]+(?:'s)?\b/;

export function checkSpecificScene(ex: Example): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const texts = allTones(ex.scenario);
  if (texts.length === 0) return findings;

  // Pass if ANY tone meets both length and anchor bar.
  const passing = texts.find((text) => {
    if (text.length < 180) return false;
    const lower = text.toLowerCase();
    const hasAnchor = SCENE_ANCHORS.some((a) => lower.includes(a));
    const hasRole = ROLE_ANCHORS.some((r) => lower.includes(r));
    const hasPlace = PLACE_PHRASE_RE.test(lower) || PROPER_PLACE_RE.test(text);
    const hasConcretePlace = hasPlace && CONCRETE_OBJECT_ANCHOR_RE.test(lower);
    const hasLabeledSceneObject = /\blabeled\b/.test(lower);
    return hasAnchor || hasRole || hasConcretePlace || hasLabeledSceneObject;
  });

  if (!passing) {
    // Pick the longest tone as evidence; report the specific failure mode.
    const longest = texts.reduce((a, b) => (a.length >= b.length ? a : b));
    if (longest.length < 180) {
      findings.push(
        finding(
          "narrative.specific_scene",
          "major",
          `scenario too short (${longest.length} chars) — needs ≥180 chars of concrete setup`,
          longest,
        ),
      );
    } else {
      findings.push(
        finding(
          "narrative.specific_scene",
          "major",
          "scenario lacks specific setting (time/place/role) — feels abstract",
          longest,
        ),
      );
    }
  }
  return findings;
}

/** Check 3: decision point present. */
const DECISION_CUES = [
  "has to decide", "must decide", "must choose", "is about to", "before she",
  "before he", "is deciding", "faces a choice", "the question is",
  "decide whether", "decide which", "to decide", "will decide",
  "must pick", "has to pick", "has to choose",
  "debates whether", "is torn between", "is deciding whether",
  "choosing between", "has a decision to make", "the real decision",
  "will have to decide", "needs to decide", "needs to choose",
  "hovers over", "hovering over", "hovers above",
  "the vote is", "the deadline is", "in the next", "before the next",
  "before the window", "window closes", "before time runs out",
  "before the vote", "before six o'clock", "before five o'clock",
  "must tell", "must say whether", "must answer whether", "has to tell",
  "has to say", "minutes before", "seconds before", "hours before",
  "before the dose", "before the hearing", "before the meeting starts",
  // Naturalistic constructions (2026-06-11): added so authors can write
  // scene-native decision pressure instead of stamping the original list —
  // the stillness QC found "minutes before"/"must tell" stamped in 22+
  // scenarios because the old narrow list was the only way to pass C3.
  "weighs", "weighing", "wonders whether", "wondering whether", "considers",
  "considering whether", "torn between", "should she", "should he",
  "should they", "could either", "what to do about", "decision", "deciding",
  "or wait", "or send", "not sure whether", "hesitates", "unsent",
  // Naturalistic FORK constructions (2026-06-14): high-precision phrasings the
  // year-of-less authors used that the list missed, so C3 false-flagged scenes
  // that DO force a choice ("Two paths sit in front of her. She can walk…";
  // "Lin has to answer before the report goes out"). Each phrase is a genuine
  // decision signal, so adding them lowers false positives without letting a
  // decision-LESS scene pass.
  "two paths", "two options", "two choices", "two ways", "two routes", "two doors",
  "has to answer", "has to respond", "has to reply", "can either", "either way",
  "the choice is", "a choice between", "chooses between", "picks between",
];

/** Formats whose POINT is a live decision — only these require a decision
 *  cue. Forcing decision language into discovery/observation shapes (audit,
 *  vignette, dialogue…) produced incoherent scenes and book-wide deadline
 *  stamps (stillness QC, 2026-06-11). */
// Only formats whose scene-shape definition is a LIVE binary choice carry a
// decision-beat requirement. mistake_recovery (noticing/repair), predict_reveal
// (reveal), decision_memo (a written artifact), and planning_choice (allocation)
// center on something other than forcing a fork, so demanding an explicit
// decision cue in them is a false positive — it over-fired on contemplative,
// register-varied scenes assigned those shapes. Keep only the two true forks.
const DECISION_FORMATS = new Set([
  "decision_point", "dilemma",
]);

export function checkDecisionPoint(ex: Example): CriticFinding[] {
  const findings: CriticFinding[] = [];
  // Only decision-family formats must carry a decision beat; all other
  // shapes (retrospective, discovery, observational) are exempt.
  if (!DECISION_FORMATS.has(ex.format ?? "")) {
    return findings;
  }
  const texts = allTones(ex.scenario);
  const anyHasCue = texts.some((t) => {
    const lower = t.toLowerCase();
    return DECISION_CUES.some((c) => lower.includes(c));
  });
  if (!anyHasCue && texts.length > 0) {
    findings.push(
      finding(
        "narrative.decision_point",
        "major",
        "scenario has no explicit decision point — example doesn't force the reader into the protagonist's shoes",
        texts[0],
      ),
    );
  }
  return findings;
}
