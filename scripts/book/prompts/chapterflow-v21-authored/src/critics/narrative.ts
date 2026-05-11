/**
 * Narrative critics — check that example scenarios are scenes, not
 * thesis-paraphrases. These are the single largest class of failure in v13's
 * weak books (e.g. tiny-habits 4.2% named-protagonist rate).
 */

import {
  CriticFinding,
  Example,
  MaybeToned,
  ToneKeyed,
  resolveDirect,
} from "../types.js";
import { allTones, finding, pickEvidence, truncate } from "./shared.js";

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
];

const ROLE_ANCHORS = [
  "manager", "teacher", "student", "founder", "parent", "coach", "director",
  "vp", " pm ", "engineer", "designer", "nurse", "doctor", "lead", "principal",
  "partner", "trainer", "attorney", "analyst", "producer",
];

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
    return hasAnchor || hasRole;
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
];

export function checkDecisionPoint(ex: Example): CriticFinding[] {
  const findings: CriticFinding[] = [];
  // Retrospective formats have their decision beat in the reflection itself,
  // not in a forward-looking moment. Skip the forward-decision cue check.
  if (ex.format === "postmortem" || ex.format === "reflection" || ex.format === "before_after") {
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
