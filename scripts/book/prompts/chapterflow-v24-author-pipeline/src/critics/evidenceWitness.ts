/**
 * Invented-witness critic (EW1) — a fictional character cast as a research
 * SUBJECT must never carry a documented finding (the "Piper move").
 *
 * THE DEFECT (the dominant residual `factual_accuracy` CORRUPTION on the live
 * the-willpower-instinct run — 6 instances across ch02/04/06/07/10). The writer
 * stages an INVENTED character inside a REAL researcher's documented study and has
 * them act out / voice the result:
 *   "participants Rachel and William mark the shortlist form…"     (ch04)
 *   "Participant Lawrence rubs the cup … in Dianne Tice and Ellen
 *    Bratslavsky's emotional distress work."                        (ch06)
 *   "Brigitte's sleeve sticks to the vinyl chair as the plate lands
 *    in Walter Mischel's … Nursery School room."                    (ch07)
 *   "In the Trier Social Stress Test room … Adam whispers …"        (ch02)
 *   "Beau asks after Kelly McGonigal's class. Janelle closes …"     (ch10)
 * The documented STUDY result is the evidence; an invented witness narrating it
 * from inside the study is fabrication wearing a finding's costume — the instant a
 * reader senses the "participant" is invented, the teaching loses its ground.
 *
 * EI1/EI2 (evidenceIntegrity.ts) already block the SYNTACTIC testimonial
 * ("Brad's report names the hinge"). They deliberately punt THIS case as semantic:
 * "a regex can't tell invented 'Piper' from real 'Schultz'." True for the NAME
 * alone — but the CASTING GRAMMAR betrays it. "participant <GivenName>" /
 * "subject <GivenName>" casts a fictional person as a study subject, and real
 * research writing never does (it names the researcher, or anonymizes to
 * "Participant A"). That grammar is fully detectable and ZERO-FP across the entire
 * committed corpus (gold daring-greatly + start-with-why and all production books).
 *
 * SCOPE (the gate critic is the PROVABLY-clean half; the rest is the writer's job).
 *   - EW1 fires ONLY on `participant(s)/subject(s) <Capitalized-given-name>` — the
 *     loud cast tell, calibrated zero-FP on the whole corpus. SHADOW = major (a
 *     deterministic complement to the semantic factual_accuracy axis; advisory
 *     until a gold proof clears it for blocker promotion).
 *   - The subtler "invented actor inside <RealResearcher>'s lab/class/paradigm
 *     room" shape (Brigitte/Adam/Beau above) is SEMANTIC — it needs the research
 *     brief to tell an invented actor from a real subject. That is surfaced for
 *     writer disposition by `findWitnessCandidates` (the `evidence-audit` CLI
 *     lever + STEP-2 law), NOT asserted as a gate finding, so a real cited subject
 *     is never gate-flagged.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";
import { splitSentences } from "./textUtils.js";

// Capitalized words that look name-shaped but never head an invented-subject cast.
const NAME_STOPWORDS = new Set([
  "The", "This", "That", "These", "Those", "Their", "They", "Them", "Then",
  "Today", "Tomorrow", "Yesterday", "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May",
  "June", "July", "August", "September", "October", "November", "December",
  "When", "While", "Because", "After", "Before", "During", "Here", "There",
  "Both", "Each", "Every", "Some", "Many", "Most", "One", "Once", "Who", "Whose",
  "Which", "What", "How", "Why", "Are", "Were", "Was", "Will", "Would", "Can",
  "Could", "Should", "Must", "Often", "Sometimes", "Usually", "Now", "Later",
  "First", "Second", "Third", "Next", "Group", "Number", "Type", "Level",
  "Another", "Brain", "Options", "Delivery", "Team", "Anyone", "Someone", "Everyone",
]);

export type WitnessPattern = "participant_cast" | "actor_in_named_study";

export type InventedWitnessHit = {
  /** The cast subject as written ("Rachel", "Lawrence", "Adam"). */
  subject: string;
  /** Which class of pattern matched, for the message + routing. */
  pattern: WitnessPattern;
  /** The full sentence, for evidence. */
  sentence: string;
};

// ── Detector A — PARTICIPANT CAST (deterministic, gate-grade, zero-FP) ─────────
// A fictional person cast as a study subject: "participants Rachel and William",
// "Participant Lawrence", "subject Cyrus". A real source names the RESEARCHER, and
// a real study anonymizes its subjects ("Participant A", "the participants rated"),
// so a capitalized GIVEN NAME owned by participant/subject is the invented-witness
// tell. `[A-Z][a-z]+` requires a lowercase tail, so single-letter anonymization
// ("Participant A") and acronyms never match.
const PARTICIPANT_CAST = /\b([Pp]articipants?|[Ss]ubjects?)\s+([A-Z][a-z]+)\b/g;

/** Pure detector A: every `participant/subject <GivenName>` cast in `text`. The
 *  deterministic, gate-grade half — provably zero-FP on the committed corpus. */
export function findParticipantCasts(text: string): InventedWitnessHit[] {
  if (!text || typeof text !== "string") return [];
  const hits: InventedWitnessHit[] = [];
  for (const sentence of splitSentences(text)) {
    const seen = new Set<string>();
    PARTICIPANT_CAST.lastIndex = 0;
    for (let m = PARTICIPANT_CAST.exec(sentence); m; m = PARTICIPANT_CAST.exec(sentence)) {
      const name = m[2];
      if (NAME_STOPWORDS.has(name)) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      hits.push({ subject: name, pattern: "participant_cast", sentence });
    }
  }
  return hits;
}

// ── Detector B — ACTOR INSIDE A NAMED RESEARCH SETTING (checklist-only) ────────
// The subtler Piper shape: a bare given-name actor performing an embodied/dialogue
// action in the SAME sentence as a real-research-setting reference — a possessive
// real-name owning a study noun ("in Walter Mischel's … room", "in Tice and
// Bratslavsky's … work", "after Kelly McGonigal's class"), or a named paradigm
// room ("In the Trier Social Stress Test room"). This is SEMANTIC — it cannot tell
// an invented actor from a real documented subject without the brief — so it is
// surfaced for WRITER DISPOSITION only (the evidence-audit CLI), never a gate
// finding. A wider net is fine there: a false candidate costs one brief-check.

// A research-setting noun a real study/lab owns.
const SETTING_NOUN = "lab|laboratory|stud(?:y|ies)|experiments?|paradigms?|protocols?|procedures?|trials?|nurser(?:y|ies)|classrooms?|class|wards?|clinics?|rooms?|sessions?|setups?|work";
// "in/at/inside/within/during/after/before Researcher's [≤4 words, proper nouns OK] <setting>".
// The preposition may be sentence-initial (capitalized); the owner token allows
// internal capitals ("McGonigal", "DeYoung"); the gap allows Capitalized words so a
// multi-word setting name is spanned ("Mischel's Stanford Bing Nursery School room").
const SETTING_POSSESSIVE = new RegExp(
  `\\b(?:[Ii]n|[Aa]t|[Ii]nside|[Ww]ithin|[Dd]uring|[Aa]fter|[Bb]efore)\\s+([A-Z][A-Za-z.'’-]*(?:\\s+(?:and\\s+)?[A-Z][A-Za-z.'’-]*){0,3})['’]s\\s+(?:[\\w'’-]+\\s+){0,4}(?:${SETTING_NOUN})\\b`,
);
// "in/at the <Proper Noun…> (Test|Paradigm|Task|Experiment|Study|Inventory|Scale) room/setting/session".
// Lazy {1,4}? so the capture does NOT swallow the keyword ("Trier Social Stress" + "Test" + "room").
const NAMED_PARADIGM_ROOM = /\b(?:[Ii]n|[Aa]t|[Ii]nside)\s+the\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,4}?)\s+(?:Test|Paradigm|Task|Experiment|Study|Inventory|Scale)\s+(?:room|setting|session|space)\b/;
// An embodied / dialogue action a staged actor performs (optionally via a possessed
// body part — "Brigitte's sleeve sticks").
const EMBODIED_VERB =
  /(?:^|[\s("“'])([A-Z][a-z]+)(?:['’]s\s+\w+)?\s+(?:says?|said|whispers?|whispered|mutters?|muttered|asks?|asked|answers?|replies|replied|nods?|nodded|rubs?|rubbed|sticks?|stuck|leans?|leaned|marks?|marked|reads?|closes?|closed|opens?|opened|grabs?|taps?|slides?|pulls?|pushes?|shifts?|breathes?|sits?|stands?|holds?|picks?|sets?|places?|wipes?|scratches?|stares?|glances?|reaches?)\b/;

/** Does `sentence` reference a real, named research setting? Returns the possessive
 *  owner (so the actor detector can exclude it), or "" for a paradigm-room match,
 *  or null when there is no setting. */
function namedResearchSettingOwner(sentence: string): string | null {
  const m = SETTING_POSSESSIVE.exec(sentence);
  if (m) return m[1];
  if (NAMED_PARADIGM_ROOM.test(sentence)) return "";
  return null;
}

/** The bare-given-name actor performing an embodied action in `sentence`, if any
 *  (excluding the setting owner + stopwords). */
function embodiedActor(sentence: string, ownerFirst: string | null): string | null {
  const m = EMBODIED_VERB.exec(sentence);
  if (!m) return null;
  const actor = m[1];
  if (NAME_STOPWORDS.has(actor) || actor === ownerFirst) return null;
  return actor;
}

/**
 * Pure detector A+B: participant casts PLUS the semantic "actor in a named study"
 * shape. For the `evidence-audit` writer lever — a wider net for disposition, NOT
 * for the gate. Detector B fires when a named-research-setting sentence has a
 * bare-given-name actor (≠ the setting owner) performing an embodied/dialogue
 * action in the SAME or the IMMEDIATELY FOLLOWING sentence (the staging and the
 * action often split across two sentences — "In the Trier … Test room, …. Adam
 * whispers …").
 */
export function findWitnessCandidates(text: string): InventedWitnessHit[] {
  if (!text || typeof text !== "string") return [];
  const hits = findParticipantCasts(text);
  const castSentences = new Set(hits.map((h) => h.sentence));
  const sentences = splitSentences(text);
  const flagged = new Set<string>();
  for (let i = 0; i < sentences.length; i++) {
    const owner = namedResearchSettingOwner(sentences[i]);
    if (owner === null) continue;
    const ownerFirst = owner ? owner.split(/\s+/)[0] : null;
    for (const s of [sentences[i], sentences[i + 1]].filter(Boolean)) {
      if (castSentences.has(s) || flagged.has(s)) continue; // A already routed it
      const actor = embodiedActor(s, ownerFirst);
      if (!actor) continue;
      flagged.add(s);
      hits.push({ subject: actor, pattern: "actor_in_named_study", sentence: s });
      break; // one actor per setting is enough to route the disposition
    }
  }
  return hits;
}

// ── Reader-facing field walker (the surfaces a reader actually sees) ───────────
function readerFields(chapter: ChapterV21): Array<{ unit: string; text: string }> {
  const fields: Array<{ unit: string; text: string }> = [];
  const add = (unit: string, text: unknown) => {
    if (typeof text === "string" && text.trim()) fields.push({ unit, text });
  };
  add("hook", chapter.hook);
  add("counterintuition", chapter.counterintuition);
  add("keyTakeaway", chapter.keyTakeaway);
  const bd = chapter.breakdown ?? ({} as any);
  for (const tier of ["fastRead", "deepRead", "fullRead"] as const) add(`breakdown.${tier}`, bd[tier]);
  chapter.examples?.forEach((e, i) => {
    add(`examples[${i}].scenario`, e.scenario);
    add(`examples[${i}].whatToDo`, e.whatToDo);
    add(`examples[${i}].whyItMatters`, e.whyItMatters);
  });
  chapter.quiz?.questions?.forEach((q, i) => {
    add(`quiz.questions[${i}].prompt`, q.prompt);
    (q.choices ?? []).forEach((c, j) => add(`quiz.questions[${i}].choices[${j}]`, c));
    add(`quiz.questions[${i}].explanation`, q.explanation);
  });
  chapter.reviewCards?.forEach((c, i) => {
    add(`reviewCards[${i}].front`, c.front);
    add(`reviewCards[${i}].back`, c.back);
  });
  chapter.memorableLines?.forEach((l, i) => add(`memorableLines[${i}].text`, l.text));
  return fields;
}

const EW1_FIX =
  "Report the documented study result as the evidence (cite the researcher/finding), then move the invented actor into a plain everyday setting where they APPLY the lesson — never cast them as a subject inside the real study. Do not merely rename the participant.";

/**
 * EW1 — an invented character cast as a research subject in reader prose. SHADOW =
 * major (a deterministic complement to the semantic factual_accuracy axis;
 * advisory until a gold proof clears it for blocker promotion). Fires ONLY on the
 * provably-clean `participant/subject <GivenName>` cast — the wider semantic shape
 * is the writer's disposition job (evidence-audit), not a gate finding.
 */
export function checkInventedWitness(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const { unit, text } of readerFields(chapter)) {
    for (const hit of findParticipantCasts(text)) {
      findings.push(
        finding(
          "EW1.invented_witness" as any,
          "major",
          `${unit}: invented witness — "${truncate(hit.subject, 40)}" is cast as a study participant/subject (a fictional person staged inside real research, the "Piper move"; reads as factual_accuracy corruption at QC). ${EW1_FIX}`,
          hit.sentence,
        ),
      );
    }
  }
  return findings;
}

export type EvidenceAuditItem = {
  unit: string;
  pattern: WitnessPattern;
  subject: string;
  sentence: string;
};

/**
 * Walk the reader-facing fields and surface every invented-witness CANDIDATE — the
 * gate-grade `participant/subject <name>` cast (detector A) AND the semantic
 * "actor staged in a named study" shape (detector B). This is the WIDER net for
 * the `evidence-audit` writer lever: the writer dispositions each against the
 * research brief (a false candidate costs one brief-check). NOT the gate —
 * checkInventedWitness (detector A only) is the gate finding.
 */
export function auditChapterWitnesses(chapter: ChapterV21): EvidenceAuditItem[] {
  const items: EvidenceAuditItem[] = [];
  for (const { unit, text } of readerFields(chapter)) {
    for (const hit of findWitnessCandidates(text)) {
      items.push({ unit, pattern: hit.pattern, subject: hit.subject, sentence: hit.sentence });
    }
  }
  return items;
}
