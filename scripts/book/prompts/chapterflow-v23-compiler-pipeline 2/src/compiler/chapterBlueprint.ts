import { existsSync } from "fs";

import type { ChapterSpec } from "../generateChapter.js";
import { loadCanonicalChapterIndex, readCanonicalChapterIndex } from "../lib/chapterSet.js";
import { normSlug } from "../lib/chapterPaths.js";
import { canonicalJsonSha256 } from "../lib/canonicalJson.js";
import { fnv1a } from "../lib/fnv1a.js";
import { blueprintPath, readJsonFile, sourcePacketPath, writeJsonFile, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
import {
  CHAPTER_BLUEPRINT_SCHEMA_VERSION,
  type ChapterBlueprintV1,
  type ExampleSlotV1,
  type QuizSlotV1,
  type CardSlotV1,
  type SourcePacketV1,
} from "../artifacts/artifactTypes.js";
import type { BloomsLevel, ChapterDesignDoc, ExampleFormat } from "../types.js";
import { C7_BANNED_NAMES } from "../critics/finalGate.js";
import { loadNameBank, usedNamesByChapter } from "../librarian/namePlan.js";
import { planVenues } from "../librarian/venuePlan.js";
import { protectedSourceNames } from "./sourceNames.js";

export type CompileBlueprintsResult = {
  bookId: string;
  written: string[];
  findings: string[];
};

const FALLBACK_NAME_BANK = [
  "Liam", "Noah", "Ethan", "Lucas", "Benjamin", "Jack", "Jacob", "William", "James", "Henry", "Alexander", "Logan",
  "Mason", "Oliver", "Elijah", "Nathan", "Samuel", "Daniel", "Matthew", "Carter", "Wyatt", "Hudson", "Isaac", "Ryan",
  "Connor", "Cole", "Aiden", "Dylan", "Adam", "Nicholas", "Joshua", "Tyler", "Brandon", "Cameron", "Evan", "Hunter",
  "Landon", "Aaron", "Eric", "Kevin", "Brian", "Scott", "Craig", "Dean", "Grant", "Reid", "Blake", "Brady",
  "Brett", "Chase", "Cody", "Curtis", "Derek", "Drew", "Garrett", "Gavin", "Heath", "Jared", "Jesse", "Jordan",
];
const C7_BANNED = new Set(C7_BANNED_NAMES);
const NAME_BUCKET_COUNT = 40;
let cachedCompilerNameBank: string[] | null = null;

function compilerNameBank(): string[] {
  if (cachedCompilerNameBank) return cachedCompilerNameBank;
  try {
    const loaded = loadNameBank();
    cachedCompilerNameBank = loaded.length >= EXAMPLE_SLOT_COUNT ? loaded : FALLBACK_NAME_BANK;
  } catch {
    cachedCompilerNameBank = FALLBACK_NAME_BANK;
  }
  return cachedCompilerNameBank;
}

function rotate<T>(xs: T[], offset: number): T[] {
  if (xs.length === 0) return [];
  const n = ((offset % xs.length) + xs.length) % xs.length;
  return xs.slice(n).concat(xs.slice(0, n));
}

function chapterNameCandidates(bookId: string, chapterNumber: number): string[] {
  const bank = compilerNameBank().filter((name) => !C7_BANNED.has(name));
  const rotated = rotate(bank, fnv1a(normSlug(bookId)) % Math.max(1, bank.length));
  const bucket = (chapterNumber - 1) % NAME_BUCKET_COUNT;
  return rotated.filter((_, i) => i % NAME_BUCKET_COUNT === bucket);
}

function siblingUsedNames(bookId: string, chapterNumber: number): Set<string> {
  const used = new Set<string>();
  try {
    for (const [chapter, names] of Object.entries(usedNamesByChapter(bookId))) {
      if (Number(chapter) === chapterNumber) continue;
      for (const name of names) used.add(name);
    }
  } catch {
    // Name reuse is also caught by book-gate; blueprint compilation should not
    // fail just because an old chapter on disk is unreadable.
  }
  return used;
}

function dealAllowedNames(bookId: string, chapterNumber: number, packet: SourcePacketV1): { allowedNames: string[]; sourceProtectedNames: Set<string>; siblingNames: Set<string> } {
  const bank = compilerNameBank();
  const sourceProtectedNames = protectedSourceNames(packet, bank);
  const siblingNames = siblingUsedNames(bookId, chapterNumber);
  const candidates = chapterNameCandidates(bookId, chapterNumber).filter((name) => !sourceProtectedNames.has(name) && !siblingNames.has(name));
  const allowedNames = candidates.slice(0, EXAMPLE_SLOT_COUNT);
  if (allowedNames.length >= EXAMPLE_SLOT_COUNT) return { allowedNames, sourceProtectedNames, siblingNames };

  // Extremely source-name-heavy chapters can exhaust a bucket. Fill deterministically
  // only after preserving the bucketed, cross-chapter-disjoint primary allocation.
  for (const name of compilerNameBank()) {
    if (allowedNames.length >= EXAMPLE_SLOT_COUNT) break;
    if (C7_BANNED.has(name) || sourceProtectedNames.has(name) || siblingNames.has(name) || allowedNames.includes(name)) continue;
    allowedNames.push(name);
  }
  return { allowedNames, sourceProtectedNames, siblingNames };
}

const FALLBACK_VENUES = [
  "broker statement", "portfolio policy file", "bond quote sheet", "tax worksheet", "fund fact sheet", "annual-report notes", "order ticket", "client email draft", "valuation memo", "allocation worksheet", "research queue", "prospectus packet",
];

function plannedVenuePalette(bookId: string, chapterNumber: number): string[] {
  if (chapterNumber > 34) return pick(FALLBACK_VENUES, chapterNumber - 1, EXAMPLE_SLOT_COUNT);
  try {
    return planVenues(bookId, 1, 34).allocation[chapterNumber] ?? pick(FALLBACK_VENUES, chapterNumber - 1, EXAMPLE_SLOT_COUNT);
  } catch {
    return pick(FALLBACK_VENUES, chapterNumber - 1, EXAMPLE_SLOT_COUNT);
  }
}

const SCENE_MODES = [
  "decision-under-pressure", "mistake-recovery", "before-after audit", "conversation repair", "stakes audit", "deadline triage", "small experiment", "feedback loop", "checklist walkthrough",
];

const ACTION_MECHANISMS = [
  "two-minute audit", "calendar trigger", "one-message request", "default swap", "if-then rehearsal", "friction removal", "receipt check", "decision log", "environment edit",
];

const WEEKLY_FORMS = [
  "one repeated audit", "two-trigger checklist", "weekly calendar review", "one saved template", "Sunday reset", "Friday evidence log", "one recurring conversation", "three-minute scoreboard",
];

const QUIZ_PROMPT_SHAPES = [
  "case decision with a named source mechanism",
  "failure diagnosis from the chapter's commonError",
  "boundary-condition test",
  "two-option tradeoff",
  "mechanism trace from cause to action",
  "misread-correction scenario",
  "implementation trigger",
  "evidence-priority question",
  "transfer scenario in a fresh domain",
];

const QUIZ_ANSWER_STYLES = [
  "verb-led action tied to the required fact",
  "named mechanism check",
  "boundary rule in plain language",
  "specific evidence choice",
  "diagnostic sign plus response",
  "small reversible experiment",
  "sequence step with timing",
  "contrast between tempting shortcut and source logic",
  "reader-facing decision criterion",
];

const QUIZ_DISTRACTOR_TRAPS = [
  "plausible timing shortcut",
  "comforting but unsupported reaction",
  "overgeneralized rule",
  "wrong evidence source",
  "premature social move",
  "label-only answer",
  "delay disguised as caution",
  "measurement without action",
  "ritual without mechanism",
];

const CARD_FRONT_SHAPES = [
  "compare two chapter-specific options",
  "name the failure mode",
  "identify the trigger",
  "recall the named-case lesson",
  "state the boundary condition",
  "spot the diagnostic sign",
  "trace the mechanism",
];

const CARD_RETRIEVAL_TARGETS = [
  "mechanism",
  "common error",
  "hard edge",
  "named case",
  "implementation trigger",
  "boundary",
  "contrast",
];

const CARD_BACK_SHAPES = [
  "start with the concrete noun",
  "start with the action verb",
  "start with the contrast",
  "start with the source case",
  "start with the failure mode",
  "start with the trigger",
  "start with the boundary",
];

const IF_THEN_PLAN_SHAPES = [
  "trigger -> visible check -> smallest next move",
  "tempting shortcut -> source-specific countercheck",
  "unclear owner -> named handoff or refusal",
  "over-broad rule -> boundary-sized action",
  "missed signal -> recovery action",
  "popular move -> local proof or refusal",
];

const PRACTICE_CONSTRAINTS = [
  "approve the move only after naming the person whose response should change",
  "make the first test small enough to observe before the next handoff",
  "choose between two concrete options rather than adding a general checklist",
  "tie the timing to the chapter's real stake instead of a generic weekly cadence",
  "force one explicit reject, resize, or proceed decision",
  "define a visible proof point before adding ceremony",
  "keep the practice inside one live moment, not a broad program redesign",
  "name who owns the next action before the moment repeats",
  "replace the copied surface detail with the local behavior it should change",
  "use one participant reaction as evidence before scaling the idea",
  "make the stop rule as specific as the action rule",
  "choose a repair that can be tested in ordinary language",
  "separate the attractive gesture from the human need it is meant to serve",
  "write the failure path before choosing the visible move",
  "make the practice prove fit, not fluency with the source case",
  "turn the source mechanism into a local decision rule",
  "name the tradeoff the reader must accept before acting",
  "keep the exercise grounded in one observable response",
  "assign one owner and one consequence for the next attempt",
  "prefer a reversible field test over a polished rollout",
  "change the measure before changing the whole experience",
  "make the repeat condition visible to someone who was not in the planning meeting",
  "cut one decorative element before adding a new one",
  "let a real participant's stake set the size of the move",
];

const EXAMPLE_SCENE_FRAMES = [
  "post-decision consequence that forces a correction",
  "failed small experiment with a revised second attempt",
  "two stakeholders disagree before the protagonist chooses",
  "measurement surprise after the obvious fix looked good",
  "boundary case where the tactic would be manipulative",
  "owner handoff that changes who must act next",
  "before-after comparison with one visible behavior shift",
  "rejection of an attractive but mismatched tactic",
  "successful execution with one unresolved constraint",
  "participant interview that changes the design target",
  "deletion exercise that removes a decorative gesture",
  "field test where the evidence changes the size of the move",
  "quiet pilot where one participant's after-effect changes the brief",
  "rehearsal where a borrowed line gets cut before launch",
  "two-option field check that rejects the more photogenic move",
  "late complaint that makes the team resize a gesture",
  "source-specific fit test before a tempting copy spreads",
  "small ownership note that changes the next person's behavior",
  "practice run where social pressure exposes the real stake",
  "post-event audit that separates applause from changed action",
  "stakeholder veto that turns a ritual into a plainer repair",
  "timing change after the first attempt lands in the wrong place",
  "participant quote that replaces a broad rollout with one trial",
  "recovery decision where charm loses to a verifiable outcome",
  "frontline check that keeps the evidence but changes the target",
  "failed celebration draft revised around a real threshold",
  "bounded approval where the stop rule matters as much as the move",
  "small contrast test between remembered effect and surface appeal",
  "handoff repair that names the owner before the repeat",
  "field observation that removes the decorative part first",
  "pressure rehearsal that makes the risk visible before action",
  "measurement swap from easy approval to observable behavior",
  "relationship check where the response changes the design size",
  "service recovery choice that keeps the story but changes the proof",
  "course correction after a polished version teaches the wrong lesson",
  "local refusal where the source detail becomes a boundary",
];

const PRACTICE_FORMS = [
  "before-after audit",
  "stakeholder interview",
  "one-page decision log",
  "rehearsal script",
  "deletion exercise",
  "field test",
  "two-option comparison",
  "owner handoff note",
  "failure-premortem note",
  "measurement swap",
  "boundary refusal",
  "post-moment evidence review",
];

const EXAMPLE_SLOT_COUNT = 6;
const FORBIDDEN_NAME_GUIDANCE_LIMIT = 24;

const EXAMPLE_PURPOSES: ExampleSlotV1["purpose"][] = [
  "failure-mode",
  "application",
  "recovery",
  "contrast",
  "decision",
  "application",
];

const EXAMPLE_BEATS = [
  "show a sound process being pressure-tested before commitment",
  "show the reader-facing move changing a real decision",
  "show friction or recovery after a first attempt goes sideways",
  "compare two plausible choices with a grounded reason for the better move",
  "show a tradeoff decision under mild time or social pressure",
  "show a bounded decision with one inconvenient constraint still visible",
  "show successful execution with one inconvenient constraint still present",
  "show a boundary case where waiting, acting, or sizing the decision carries a cost",
  "show a second opinion changing the action without turning into a lecture",
  "show a record-keeping step that clarifies the choice without becoming the whole scene",
  "show a small reversal where new evidence changes the amount, timing, or commitment",
  "show the after-effect of an earlier decision and the adjustment it forces now",
];

const EXAMPLE_FORMATS: ExampleFormat[] = [
  "decision_point",
  "before_after",
  "mistake_recovery",
  "contrast",
  "planning_choice",
  "decision_memo",
];

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function pick<T>(xs: T[], offset: number, count: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(xs[(offset + i) % xs.length]);
  return out;
}

function forbiddenNameGuidance(allowedNames: string[], sourceProtectedNames: Set<string>, siblingNames: Set<string>): string[] {
  const protectedFirst = [...sourceProtectedNames].sort();
  const siblingNext = [...siblingNames].sort();
  const remainingBank = compilerNameBank().filter((name) => !allowedNames.includes(name) && !sourceProtectedNames.has(name) && !siblingNames.has(name));
  return uniq([...protectedFirst, ...siblingNext, ...remainingBank]).slice(0, FORBIDDEN_NAME_GUIDANCE_LIMIT);
}

function shuffledAnswerPattern(chapterNumber: number, count: number, salt: number): number[] {
  const pool = Array.from({ length: count }, (_, i) => i % 3);
  let seed = fnv1a(`answer-pattern:${chapterNumber}:${count}:${salt}`);
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function answerPattern(chapterNumber: number, count: number): number[] {
  // Balanced, deterministic, and pseudo-shuffled. The dealer walks chapters in
  // order and gives each one the first balanced pattern that was not already
  // used by an earlier chapter of the same quiz length, preventing BP14 rhythm
  // collisions in parallel book runs.
  const accepted: string[] = [];
  let selected = shuffledAnswerPattern(chapterNumber, count, 0);
  for (let n = 1; n <= chapterNumber; n++) {
    let candidate = shuffledAnswerPattern(n, count, 0);
    for (let salt = 1; accepted.includes(candidate.join(",")) && salt < 1000; salt++) {
      candidate = shuffledAnswerPattern(n, count, salt);
    }
    if (n === chapterNumber) selected = candidate;
    accepted.push(candidate.join(","));
  }
  return selected;
}

function bloomsMix(count: number): Partial<Record<BloomsLevel, number>> {
  const mix: Partial<Record<BloomsLevel, number>> = { apply: Math.ceil(count * 0.45), analyze: Math.floor(count * 0.3) };
  const used = Object.values(mix).reduce((a, b) => a + (b ?? 0), 0);
  mix.understand = Math.max(0, count - used);
  return mix;
}

function rawFactIds(packet: SourcePacketV1): string[] {
  return packet.facts.map((f) => f.id).filter(Boolean);
}

function isSourceGroundingMetaFact(fact: SourcePacketV1["facts"][number]): boolean {
  const value = `${fact.claim ?? ""} ${fact.mechanism ?? ""}`.toLowerCase();
  return /\bat least\s+\d+\s+named cases\b/.test(value)
    || /\bconcrete settings give memory a handle\b/.test(value)
    || /\bmake the claim checkable\b/.test(value)
    || /\bnamed people, places, dates,? or numbers\b/.test(value)
    || /\bprevent the writer from inventing\b/.test(value)
    || /\bquiz-worthy material\b/.test(value)
    || /\bcase can test a different misreading\b/.test(value)
    || /\bseeds? distractors?\b/.test(value)
    || /\blater qc\b/.test(value)
    || /\bsource anchors?\b/.test(value);
}

function factIds(packet: SourcePacketV1): string[] {
  const teaching = packet.facts.filter((f) => !isSourceGroundingMetaFact(f)).map((f) => f.id).filter(Boolean);
  return teaching.length >= 3 ? teaching : rawFactIds(packet);
}

function exampleFactId(ids: string[], chapterNumber: number, slotIndex: number): string | undefined {
  if (!ids.length) return undefined;
  return ids[(slotIndex + chapterNumber - 1) % ids.length];
}

function caseIds(packet: SourcePacketV1): string[] {
  return packet.namedCases.map((c) => c.id).filter(Boolean);
}

function keywordRoots(value: string): Set<string> {
  const stop = new Set([
    "about", "after", "again", "against", "because", "before", "being", "between", "chapter", "claim", "could", "every",
    "evidence", "example", "from", "into", "more", "should", "source", "than", "that", "their", "there", "these", "this",
    "through", "when", "where", "which", "while", "with", "without", "would",
  ]);
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word
      .replace(/ies$/, "y")
      .replace(/(?:ing|ed|es|s)$/, ""));
  return new Set(words.filter((word) => word.length >= 4 && !stop.has(word)));
}

function rankedCaseIdsForFact(packet: SourcePacketV1, factId: string | undefined, fallbackIndex: number): string[] {
  const cases = packet.namedCases;
  if (!cases.length) return [];
  const fallback = cases[fallbackIndex % cases.length]?.id;
  const fact = packet.facts.find((f) => f.id === factId);
  if (!fact) return rotate(cases.map((c) => c.id).filter(Boolean), fallbackIndex);
  const factTerms = keywordRoots([
    fact.claim,
    fact.mechanism,
    fact.commonError,
    fact.whyWrong,
    ...fact.groundedEntities,
    ...fact.groundedNumbers,
  ].join(" "));
  const scored = cases.map((c) => {
    const caseTerms = keywordRoots([c.label, c.summary, ...c.hardSpecifics].join(" "));
    let score = 0;
    for (const term of caseTerms) if (factTerms.has(term)) score++;
    return { id: c.id, score };
  }).sort((a, b) => b.score - a.score);
  const ids = scored[0]?.score >= 2 ? scored.map((item) => item.id) : rotate(cases.map((c) => c.id).filter(Boolean), fallbackIndex);
  return uniq(ids.filter(Boolean));
}

function bestCaseIdForFact(packet: SourcePacketV1, factId: string | undefined, fallbackIndex: number): string[] {
  const [best] = rankedCaseIdsForFact(packet, factId, fallbackIndex);
  return best ? [best] : [];
}

function exampleCaseIdForFact(packet: SourcePacketV1, factId: string | undefined, fallbackIndex: number, usedCaseCounts: Map<string, number>): string[] {
  const ranked = rankedCaseIdsForFact(packet, factId, fallbackIndex);
  const minCount = Math.min(...ranked.map((id) => usedCaseCounts.get(id) ?? 0));
  const next = ranked.find((id) => (usedCaseCounts.get(id) ?? 0) === minCount) ?? ranked[0];
  if (!next) return [];
  usedCaseCounts.set(next, (usedCaseCounts.get(next) ?? 0) + 1);
  return [next];
}

function buildPlan(chapter: ChapterSpec, packet: SourcePacketV1, examples: ExampleSlotV1[], quizCount: number, cardCount: number): ChapterDesignDoc {
  const ids = factIds(packet);
  const exampleSpecs = examples.map((slot, i) => ({
    domain: `${slot.venue}: ${slot.sceneMode}; ${slot.sceneFrame}`,
    audience: "a reader applying this chapter in a realistic everyday decision",
    stakes: slot.purpose === "failure-mode" ? "the default behavior quietly costs the reader" : "a small correct move creates a visible improvement",
    format: EXAMPLE_FORMATS[i],
    requiredBeat: slot.requiredBeat,
    sourceAnchorIds: [...slot.requiredCaseIds],
  }));
  return {
    chapterId: chapter.chapterId,
    number: chapter.chapterNumber,
    title: chapter.chapterTitle,
    coreMove: packet.facts[0]?.mechanism || packet.facts[0]?.claim || `Use ${chapter.chapterTitle} as a concrete decision tool.`,
    coreMoveSourceAnchorIds: ids.slice(0, 2),
    exampleCount: examples.length,
    exampleSpecs,
    quizFocus: {
      count: quizCount,
      bloomsMix: bloomsMix(quizCount),
      transferEmphasis: 0.75,
      sourceAnchorIds: ids.slice(0, Math.min(ids.length, 9)),
    },
    cardFocus: {
      count: cardCount,
      retrievalPractice: true,
      sourceAnchorIds: ids.slice(0, Math.min(ids.length, cardCount)),
    },
    readingTimeMinutes: 8,
  };
}

export function compileChapterBlueprint(args: {
  bookId: string;
  chapter: ChapterSpec;
  packet: SourcePacketV1;
  packetPath: string;
}): ChapterBlueprintV1 {
  const { bookId, chapter, packet, packetPath } = args;
  const ids = factIds(packet);
  const allFactIds = rawFactIds(packet);
  const cases = caseIds(packet);
  const n = chapter.chapterNumber;
  const quizCount = 9;
  const cardCount = 7;
  const exampleCount = EXAMPLE_SLOT_COUNT;
  const { allowedNames, sourceProtectedNames, siblingNames } = dealAllowedNames(bookId, n, packet);
  const venuePalette = plannedVenuePalette(bookId, n);
  const pattern = answerPattern(n, quizCount);
  const usedExampleCaseCounts = new Map<string, number>();
  const examples: ExampleSlotV1[] = Array.from({ length: exampleCount }, (_, i) => {
    const factId = exampleFactId(ids, n, i);
    return {
      slotId: `ex${String(i + 1).padStart(2, "0")}`,
      purpose: EXAMPLE_PURPOSES[(n + i - 1) % EXAMPLE_PURPOSES.length],
      sceneMode: SCENE_MODES[(n + i) % SCENE_MODES.length],
      sceneFrame: EXAMPLE_SCENE_FRAMES[(n * 5 + i * 7) % EXAMPLE_SCENE_FRAMES.length],
      venue: venuePalette[i % venuePalette.length],
      allowedNames: pick(allowedNames, i, 3),
      requiredFactIds: factId ? [factId] : [],
      requiredCaseIds: exampleCaseIdForFact(packet, factId, i, usedExampleCaseCounts),
      forbiddenVenues: FALLBACK_VENUES.filter((v) => !venuePalette.includes(v)).slice(0, 4),
      requiredBeat: EXAMPLE_BEATS[(n + i - 1) % EXAMPLE_BEATS.length],
    };
  });
  const quiz: QuizSlotV1[] = Array.from({ length: quizCount }, (_, i) => ({
    questionId: `q${String(i + 1).padStart(2, "0")}`,
    requiredFactIds: ids.length ? [ids[i % ids.length]] : [],
    caseCueIds: cases.length ? [cases[(n + i - 1) % cases.length]] : [],
    correctIndex: pattern[i],
    depthLevel: i < 2 ? "simple" : i < 6 ? "standard" : "deep",
    promptShape: QUIZ_PROMPT_SHAPES[(n + i - 1) % QUIZ_PROMPT_SHAPES.length],
    answerStyle: QUIZ_ANSWER_STYLES[(n * 2 + i) % QUIZ_ANSWER_STYLES.length],
    distractorTrap: QUIZ_DISTRACTOR_TRAPS[(n * 3 + i) % QUIZ_DISTRACTOR_TRAPS.length],
  }));
  const cards: CardSlotV1[] = Array.from({ length: cardCount }, (_, i) => ({
    cardId: `rc${String(i + 1).padStart(2, "0")}`,
    requiredFactIds: ids.length ? [ids[i % ids.length]] : [],
    caseCueIds: cases.length ? [cases[(n * 2 + i) % cases.length]] : [],
    difficulty: i < 2 ? "easy" : i < 5 ? "medium" : "hard",
    frontShape: CARD_FRONT_SHAPES[(n + i - 1) % CARD_FRONT_SHAPES.length],
    retrievalTarget: CARD_RETRIEVAL_TARGETS[(n * 2 + i) % CARD_RETRIEVAL_TARGETS.length],
    backShape: CARD_BACK_SHAPES[(n * 3 + i) % CARD_BACK_SHAPES.length],
  }));
  const actionMechanism = ACTION_MECHANISMS[(n - 1) % ACTION_MECHANISMS.length];
  const weeklyPracticeForm = WEEKLY_FORMS[(n - 1) % WEEKLY_FORMS.length];
  const practiceForm = PRACTICE_FORMS[(n - 1) % PRACTICE_FORMS.length];
  const plan = buildPlan(chapter, packet, examples, quizCount, cardCount);
  return {
    schemaVersion: CHAPTER_BLUEPRINT_SCHEMA_VERSION,
    bookId: normSlug(bookId),
    chapterId: chapter.chapterId,
    chapterNumber: chapter.chapterNumber,
    title: chapter.chapterTitle,
    sourcePacketPath: packetPath,
    sourcePacketHash: canonicalJsonSha256(packet),
    plan,
    coreMove: {
      statement: plan.coreMove,
      sourceFactIds: ids.slice(0, 2),
    },
    reservedVariety: {
      allowedNames,
      forbiddenNames: forbiddenNameGuidance(allowedNames, sourceProtectedNames, siblingNames),
      hookShape: n % 3 === 0 ? "question-into-specific-scene" : n % 3 === 1 ? "object-in-motion" : "reader-default-reversal",
      counterShape: n % 2 === 0 ? "misleading-default" : "obvious-advice-backfires",
      sceneMechanism: SCENE_MODES[n % SCENE_MODES.length],
      sceneMode: SCENE_MODES[(n + 1) % SCENE_MODES.length],
      venuePalette,
      answerIndexPattern: pattern,
      actionMechanism,
      weeklyPracticeForm,
    },
    sections: {
      hook: { shape: n % 2 === 0 ? "reader-stakes" : "concrete-moment", requiredFactIds: ids.slice(0, 1) },
      summaries: { fastReadTargetChars: [350, 900], deepReadTargetChars: [1000, 2200], fullReadTargetChars: [2400, 4200], requiredFactIds: ids.slice(0, 5) },
      examples,
      quiz,
      cards,
      action: {
        actionMechanism,
        requiredFactIds: ids.slice(0, 3),
        weeklyPracticeForm,
        ifThenPlanShapes: pick(IF_THEN_PLAN_SHAPES, n - 1, 3),
        practiceForm,
        practiceConstraint: PRACTICE_CONSTRAINTS[(n - 1) % PRACTICE_CONSTRAINTS.length],
      },
    },
    constraints: {
      allowedFactIds: allFactIds,
      allowedCaseIds: cases,
      forbiddenClaims: packet.forbiddenClaims,
      forbiddenLeakage: packet.forbiddenLeakage.map((f) => f.warning),
      bannedHouseTics: ["in this chapter", "the book says", "the author argues", "say aloud", "reflect on"],
    },
  };
}

export function compileBlueprints(bookId: string, roots: CompilerStoreRoots = {}): CompileBlueprintsResult {
  const normalized = normSlug(bookId);
  const index = readCanonicalChapterIndex(normalized, roots.stateRoot);
  if (!index.ok) return { bookId: normalized, written: [], findings: index.blockers.map((b) => `${b.checkId}: ${b.message}`) };
  const written: string[] = [];
  const findings: string[] = [];
  for (const chapter of index.chapters) {
    const packetP = sourcePacketPath(normalized, chapter.chapterNumber, roots);
    if (!existsSync(packetP)) {
      findings.push(`ch${String(chapter.chapterNumber).padStart(2, "0")}: missing source packet at ${packetP}`);
      continue;
    }
    const packet = readJsonFile<SourcePacketV1>(packetP);
    const blueprint = compileChapterBlueprint({ bookId: normalized, chapter, packet, packetPath: packetP });
    const out = blueprintPath(normalized, chapter.chapterNumber, roots);
    writeJsonFile(out, blueprint);
    written.push(out);
  }
  return { bookId: normalized, written, findings };
}
