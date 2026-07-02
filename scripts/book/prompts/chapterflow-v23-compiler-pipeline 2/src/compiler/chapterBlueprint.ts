import { existsSync } from "fs";

import type { ChapterSpec } from "../generateChapter.js";
import { loadCanonicalChapterIndex, readCanonicalChapterIndex } from "../lib/chapterSet.js";
import { normSlug } from "../lib/chapterPaths.js";
import { canonicalJsonSha256 } from "../lib/canonicalJson.js";
import { fnv1a } from "../lib/fnv1a.js";
import { blueprintPath, readJsonFile, slotSaltsPath, sourcePacketPath, writeJsonFile, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
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
import { loadNameBank } from "../librarian/namePlan.js";
import { planVenues } from "../librarian/venuePlan.js";
import { protectedSourceNames } from "./sourceNames.js";

export type CompileBlueprintsResult = {
  bookId: string;
  written: string[];
  findings: string[];
};

// ── Repair-owned slot salts (P10) ────────────────────────────────────────────────
// A blueprint is a PURE function of (bookId, chapterNumber, sourcePacket) — and now a fourth
// input: the repair-owned salts sidecar (state/book-design/<bookId>.slot-salts.json). QC repair
// bumps a named salt to RE-DEAL a specific slot family for a specific chapter (e.g. a
// scene_skeleton finding on ch2 → bump ch2.exampleFrames → its example scenes get fresh frames).
// The salt is mixed into ONLY the matching deal's index math, and DEFAULT salt 0 leaves every
// deal byte-identical to today (an absent file ⇒ every salt 0), so the determinism contract is
// preserved: "given (index, packets, salts) the blueprint is reproducible". The salts file is
// repair-owned — nothing but redealAndRegenerate writes it (see src/orchestrator/repairRouting.ts).

export type ChapterSlotSalts = { exampleFrames?: number; venues?: number; quizShapes?: number; names?: number };
export type SlotSalts = { chapters: Record<string, ChapterSlotSalts> };

function normalizeSalt(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Read (and normalize) the salts sidecar for a book. Missing/unreadable/negative ⇒ all-zero
 *  salts, i.e. today's blueprint. Fail-safe by design: a corrupt salts file must never crash a
 *  compile — it just deals the un-salted (baseline) slots. */
export function readSlotSalts(bookId: string, roots: CompilerStoreRoots = {}): SlotSalts {
  const p = slotSaltsPath(bookId, roots);
  if (!existsSync(p)) return { chapters: {} };
  try {
    const raw = readJsonFile<SlotSalts>(p);
    const chapters: Record<string, ChapterSlotSalts> = {};
    for (const [k, v] of Object.entries(raw?.chapters ?? {})) {
      if (!/^\d+$/.test(String(k))) continue;
      chapters[String(k)] = {
        exampleFrames: normalizeSalt((v as ChapterSlotSalts)?.exampleFrames),
        venues: normalizeSalt((v as ChapterSlotSalts)?.venues),
        quizShapes: normalizeSalt((v as ChapterSlotSalts)?.quizShapes),
        names: normalizeSalt((v as ChapterSlotSalts)?.names),
      };
    }
    return { chapters };
  } catch {
    return { chapters: {} };
  }
}

/** The four salts for one chapter (0 for any not set). */
export function chapterSalts(salts: SlotSalts, chapterNumber: number): Required<ChapterSlotSalts> {
  const c = salts.chapters[String(chapterNumber)] ?? {};
  return {
    exampleFrames: normalizeSalt(c.exampleFrames),
    venues: normalizeSalt(c.venues),
    quizShapes: normalizeSalt(c.quizShapes),
    names: normalizeSalt(c.names),
  };
}

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

function chapterNameCandidates(bookId: string, chapterNumber: number, nameSalt = 0): string[] {
  const bank = compilerNameBank().filter((name) => !C7_BANNED.has(name));
  // nameSalt rotates the bank a further `nameSalt` positions before bucketing, so a `redeal:names`
  // bump draws this chapter from a shifted slice of the bank (fresh protagonists to resolve a
  // persona_drift finding). Salt 0 ⇒ the original offset, i.e. byte-identical to today.
  const rotated = rotate(bank, (fnv1a(normSlug(bookId)) + nameSalt) % Math.max(1, bank.length));
  const bucket = (chapterNumber - 1) % NAME_BUCKET_COUNT;
  return rotated.filter((_, i) => i % NAME_BUCKET_COUNT === bucket);
}

function dealAllowedNamesGiven(bookId: string, chapterNumber: number, packet: SourcePacketV1, siblingNames: Set<string>, nameSalt = 0): { allowedNames: string[]; sourceProtectedNames: Set<string> } {
  const bank = compilerNameBank();
  const sourceProtectedNames = protectedSourceNames(packet, bank);
  const candidates = chapterNameCandidates(bookId, chapterNumber, nameSalt).filter((name) => !sourceProtectedNames.has(name) && !siblingNames.has(name));
  const allowedNames = candidates.slice(0, EXAMPLE_SLOT_COUNT);
  if (allowedNames.length >= EXAMPLE_SLOT_COUNT) return { allowedNames, sourceProtectedNames };

  // Extremely source-name-heavy chapters can exhaust a bucket. Fill deterministically
  // only after preserving the bucketed, cross-chapter-disjoint primary allocation.
  for (const name of compilerNameBank()) {
    if (allowedNames.length >= EXAMPLE_SLOT_COUNT) break;
    if (C7_BANNED.has(name) || sourceProtectedNames.has(name) || siblingNames.has(name) || allowedNames.includes(name)) continue;
    allowedNames.push(name);
  }
  return { allowedNames, sourceProtectedNames };
}

/**
 * Deterministically replays the name deal for every EARLIER chapter that shares
 * this chapter's bucket — (n - 1) % NAME_BUCKET_COUNT — using only the canonical
 * chapter index and each chapter's own source packet (both pure inputs of the
 * compiler, fixed before any chapter is authored). Different-bucket chapters are
 * already disjoint via chapterNameCandidates' bucket filter and need no replay.
 *
 * This intentionally never reads CHAPTERS_DIR / authored chapter content: doing
 * so made reservedVariety.allowedNames depend on how much of the book had been
 * assembled when the blueprint was compiled, so re-compiling after a partial
 * assembly could deal different names than a fresh compile (non-reproducible
 * blueprints, see blueprint-determinism.test.ts).
 */
function siblingUsedNames(bookId: string, chapterNumber: number, roots: CompilerStoreRoots, salts: SlotSalts): Set<string> {
  const used = new Set<string>();
  const bucket = (chapterNumber - 1) % NAME_BUCKET_COUNT;
  const index = readCanonicalChapterIndex(bookId, roots.stateRoot);
  if (!index.ok) return used;
  const earlierSameBucket = index.chapters
    .map((c) => c.chapterNumber)
    .filter((n) => n < chapterNumber && (n - 1) % NAME_BUCKET_COUNT === bucket)
    .sort((a, b) => a - b);
  for (const n of earlierSameBucket) {
    const packetP = sourcePacketPath(bookId, n, roots);
    if (!existsSync(packetP)) continue;
    try {
      const packet = readJsonFile<SourcePacketV1>(packetP);
      // Replay the sibling's deal with ITS OWN name salt — a sibling that was re-dealt draws a
      // different slice, so using salt 0 here would compute the wrong "used" set and could deal a
      // colliding name into this chapter. Determinism given (index, packets, salts) requires the
      // replay honor each sibling's persisted salt.
      const { allowedNames } = dealAllowedNamesGiven(bookId, n, packet, used, chapterSalts(salts, n).names);
      for (const name of allowedNames) used.add(name);
    } catch {
      // An earlier sibling's packet being unreadable should not fail this
      // chapter's compile; book-gate independently catches name collisions.
    }
  }
  return used;
}

function dealAllowedNames(bookId: string, chapterNumber: number, packet: SourcePacketV1, roots: CompilerStoreRoots, salts: SlotSalts): { allowedNames: string[]; sourceProtectedNames: Set<string>; siblingNames: Set<string> } {
  const siblingNames = siblingUsedNames(bookId, chapterNumber, roots, salts);
  const { allowedNames, sourceProtectedNames } = dealAllowedNamesGiven(bookId, chapterNumber, packet, siblingNames, chapterSalts(salts, chapterNumber).names);
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

// Non-deliberation / experiential scene engines. Every frame above is a decision-evaluation
// transaction, which collapses every example into "a proxy weighs a choice" (a book-score panel
// flagged this as the dominant sameness; QC's scene_skeleton sweep rejects on it). These are
// genuinely different scene TYPES. The slot loop deals HALF of each chapter's six example slots
// from this pool and half from the decision pool above, so every chapter MIXES decision scenes
// with lived moments — the structural lever against scene_skeleton sameness and flat,
// all-deliberation prose. Genre-flexible: the neutral ones (consequence, first-time, recognition)
// fit any book; the warmer ones (kindness, ceremony) shine in an experiences book.
const EXAMPLE_SCENE_FRAMES_EXPERIENTIAL = [
  "an unexpected kindness that lands and gets retold afterward",
  "a small ceremony that marks a transition so it feels earned",
  "a first-time experience that sets a lasting benchmark",
  "a peak moment recalled vividly long after the day it happened",
  "a shared ritual observed in mid-action as it builds connection",
  "a public recognition that shifts how someone sees themselves",
  "one sensory detail that turns an ordinary moment into a kept memory",
  "a stranger's small gesture that becomes a story worth repeating",
  "a hard truth delivered with enough care that it finally registers",
  "a milestone reached and the small marker that seals it",
  "a break in the routine script that leaves a lasting after-image",
  "a moment of genuine connection during an otherwise routine handoff",
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

// Non-deliberation beats, paired with the experiential frames so the experiential slots carry a
// non-deliberation beat (not a decision beat grafted onto a lived-moment frame).
const EXAMPLE_BEATS_EXPERIENTIAL = [
  "show a surprise breaking the expected script and the after-image it leaves",
  "show a milestone marked so it feels earned rather than automatic",
  "show a first encounter setting the tone for everything that follows",
  "show a shared ritual turning a routine into real connection",
  "show a recognition landing and changing how someone acts next",
  "show a sensory peak that becomes the whole remembered experience",
  "show a hard truth delivered with care so it finally registers",
  "show a small kindness rippling well past the moment it happened",
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

// Mirrors bookPatternAudit.ts's BP14 prefix rule exactly: a Q1-Q5 prefix is a
// blocker once it is shared by >= 3 chapters AND by >= 60% of chapters. There
// are 210 distinct Q1-Q5 prefixes reachable from a balanced 9-slot pool (3x
// zeros/ones/twos shuffled) — comfortably more than any realistic chapter
// count, so the cap below is always satisfiable within the salt<1000 budget.
const BP14_PREFIX_LEN = 5;
const BP14_MIN_BLOCKER_COUNT = 3;
const BP14_MAJORITY_THRESHOLD = 0.6;

// The largest number of chapters that may share one Q1-Q5 prefix without
// tripping BP14's "count >= 3 AND count/total >= 0.6" rule, for a book of
// `total` chapters (each carrying a 9-question quiz, so BP14's own
// chaptersWithQuiz denominator equals `total`).
export function maxSharedPrefixCount(total: number): number {
  if (total < BP14_MIN_BLOCKER_COUNT) return Infinity;
  for (let c = BP14_MIN_BLOCKER_COUNT; c <= total; c++) {
    if (c / total >= BP14_MAJORITY_THRESHOLD) return c - 1;
  }
  return total;
}

function answerPattern(chapterNumber: number, count: number, totalChapters?: number): number[] {
  // Balanced, deterministic, and pseudo-shuffled. The dealer walks chapters in
  // order and gives each one the first balanced pattern that was not already
  // used (full sequence) by an earlier chapter of the same quiz length, AND
  // whose Q1-Q5 prefix has not already reached BP14's majority-share cap.
  // This guarantees the dealt patterns satisfy BOTH BP14 rules (identical
  // full sequence, and a Q1-Q5 prefix shared by >=60% of chapters) rather
  // than just the full-sequence rule — closing the gap where final QC could
  // block on a prefix collision that the section gate then refuses to let a
  // repair agent fix (correctIndex is pinned post-blueprint).
  const total = totalChapters && totalChapters > 0 ? totalChapters : chapterNumber;
  const maxPrefixUses = maxSharedPrefixCount(total);
  const accepted: string[] = [];
  const prefixCounts = new Map<string, number>();
  let selected = shuffledAnswerPattern(chapterNumber, count, 0);
  for (let n = 1; n <= chapterNumber; n++) {
    let candidate = shuffledAnswerPattern(n, count, 0);
    let prefix = candidate.slice(0, BP14_PREFIX_LEN).join(",");
    for (
      let salt = 1;
      (accepted.includes(candidate.join(",")) || (prefixCounts.get(prefix) ?? 0) >= maxPrefixUses) && salt < 1000;
      salt++
    ) {
      candidate = shuffledAnswerPattern(n, count, salt);
      prefix = candidate.slice(0, BP14_PREFIX_LEN).join(",");
    }
    if (n === chapterNumber) selected = candidate;
    accepted.push(candidate.join(","));
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
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

// Teaching-content fact ids for quiz/card/hook/summary/action slots. Source-grounding meta facts (facts
// *about* using named cases, keeping claims checkable, etc. -- see isSourceGroundingMetaFact) read like
// real facts to the packet schema but are process instructions left over from source compilation, not
// something a reader should be quizzed on, so they are filtered out here. If filtering would leave fewer
// than 3 teaching facts, that's a source-packet coverage problem worse than the rare meta fact leaking into
// a slot, so this falls back to the full raw set rather than starving downstream slots of anchors.
//
// Either way the result stays a subset of rawFactIds(packet): teaching is a filter over packet.facts, and
// the fallback branch *is* rawFactIds(packet). constraints.allowedFactIds (see compileChapterBlueprint)
// is deliberately built from rawFactIds, not this filtered set, because it is a citation permission list
// consumed by blueprintGate's BPV9 check and the section gate's anchor validation -- those must accept
// every real packet fact id, including meta facts, in case one is legitimately cited outside a learning
// slot. assertFactIdsSubset() below enforces that dealt ids never escape that permission list.
function factIds(packet: SourcePacketV1): string[] {
  // Also drop facts the source-packet compiler tagged bookWideDuplicate: the same boilerplate
  // thesis restamped onto every chapter. Dealing it into teaching slots (summary/example/action/
  // card/quiz) forces every chapter to teach the identical claim, saturating the section-gate
  // SEC90 phrase budget book-wide. It stays in packet.facts and constraints.allowedFactIds, so
  // a writer MAY still cite it for grounding — it just is not a required teaching fact anywhere.
  const teaching = packet.facts.filter((f) => !isSourceGroundingMetaFact(f) && !f.bookWideDuplicate).map((f) => f.id).filter(Boolean);
  return teaching.length >= 3 ? teaching : rawFactIds(packet);
}

// Defensive invariant check: every fact id dealt into a chapter's requiredFactIds slots must be a member of
// constraints.allowedFactIds, or the section gate's anchor validation will reject legitimate writer output
// for a fact the compiler itself dealt. See the comment on factIds() above for why this should always hold
// by construction; this assertion turns a silent divergence into a loud, immediate compile-time failure
// instead of a confusing downstream gate rejection.
export function assertFactIdsSubset(dealt: string[], allowed: string[], context: string): void {
  const allowedSet = new Set(allowed);
  const escaped = dealt.filter((id) => !allowedSet.has(id));
  if (escaped.length > 0) {
    throw new Error(
      `${context}: requiredFactIds [${escaped.join(", ")}] are not present in constraints.allowedFactIds; ` +
        "the teaching-filtered fact set (factIds) must always be a subset of the raw source-packet fact set (rawFactIds)",
    );
  }
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
  roots?: CompilerStoreRoots;
  /** Total chapters in the book, for BP14 prefix-cap math. Defaults to the
   *  current chapter's own number (a safe lower bound: it under-constrains
   *  rather than over-constrains when the caller doesn't know the final
   *  count yet). */
  totalChapters?: number;
  /** Repair-owned per-book slot salts (P10). Defaults to reading the sidecar via `roots`; an
   *  absent file / all-zero salts ⇒ byte-identical to today. Injectable so a test can drive the
   *  re-deal without touching disk. */
  salts?: SlotSalts;
}): ChapterBlueprintV1 {
  const { bookId, chapter, packet, packetPath, roots = {}, totalChapters, salts = readSlotSalts(bookId, roots) } = args;
  const ids = factIds(packet);
  const allFactIds = rawFactIds(packet);
  assertFactIdsSubset(ids, allFactIds, `chapter ${chapter.chapterNumber} blueprint`);
  const cases = caseIds(packet);
  const n = chapter.chapterNumber;
  // The four dealt-slot salts for THIS chapter (0 ⇒ baseline). Each is mixed into ONLY its own
  // deal's index math below, so bumping one re-deals one slot family and leaves the rest identical.
  const { exampleFrames: exampleSalt, venues: venueSalt, quizShapes: quizSalt } = chapterSalts(salts, n);
  const quizCount = 9;
  const cardCount = 7;
  const exampleCount = EXAMPLE_SLOT_COUNT;
  const { allowedNames, sourceProtectedNames, siblingNames } = dealAllowedNames(bookId, n, packet, roots, salts);
  // venueSalt rotates the planned palette so a `redeal:venue` bump re-stamps the chapter's example
  // venues; rotate(…, 0) is the identity, so salt 0 keeps the original palette order.
  const venuePalette = rotate(plannedVenuePalette(bookId, n), venueSalt);
  const pattern = answerPattern(n, quizCount, totalChapters);
  const usedExampleCaseCounts = new Map<string, number>();
  const examples: ExampleSlotV1[] = Array.from({ length: exampleCount }, (_, i) => {
    const factId = exampleFactId(ids, n, i);
    return {
      slotId: `ex${String(i + 1).padStart(2, "0")}`,
      purpose: EXAMPLE_PURPOSES[(n + i - 1) % EXAMPLE_PURPOSES.length],
      sceneMode: SCENE_MODES[(n + i) % SCENE_MODES.length],
      // Guarantee a MIX: odd slots get a non-deliberation experiential engine, even slots a
      // decision engine — so every chapter's six examples span both kinds (3+3) instead of six
      // flavors of "decide." This is the deterministic lever against scene_skeleton sameness.
      // exampleSalt shifts the scene-frame + beat pick (only) so a `redeal:example-slot` bump
      // gives the chapter fresh scene engines to break a scene_skeleton/repeated_unit shell; salt 0
      // ⇒ the original index, byte-identical to today.
      sceneFrame: i % 2 === 1
        ? EXAMPLE_SCENE_FRAMES_EXPERIENTIAL[(n * 3 + i * 5 + exampleSalt) % EXAMPLE_SCENE_FRAMES_EXPERIENTIAL.length]
        : EXAMPLE_SCENE_FRAMES[(n * 5 + i * 7 + exampleSalt) % EXAMPLE_SCENE_FRAMES.length],
      venue: venuePalette[i % venuePalette.length],
      allowedNames: pick(allowedNames, i, 3),
      requiredFactIds: factId ? [factId] : [],
      requiredCaseIds: exampleCaseIdForFact(packet, factId, i, usedExampleCaseCounts),
      forbiddenVenues: FALLBACK_VENUES.filter((v) => !venuePalette.includes(v)).slice(0, 4),
      requiredBeat: i % 2 === 1
        ? EXAMPLE_BEATS_EXPERIENTIAL[(n * 3 + i + exampleSalt) % EXAMPLE_BEATS_EXPERIENTIAL.length]
        : EXAMPLE_BEATS[(n + i - 1 + exampleSalt) % EXAMPLE_BEATS.length],
    };
  });
  const quiz: QuizSlotV1[] = Array.from({ length: quizCount }, (_, i) => ({
    questionId: `q${String(i + 1).padStart(2, "0")}`,
    requiredFactIds: ids.length ? [ids[i % ids.length]] : [],
    caseCueIds: cases.length ? [cases[(n + i - 1) % cases.length]] : [],
    // correctIndex stays UNSALTED — it is pinned by answerPattern's BP14-safe deal and a
    // repair must never silently move a quiz key. quizSalt shifts only the SHAPE picks (prompt/
    // answer/distractor here; card shapes below), the redeal:quiz-slot / redeal:card-slot lever.
    correctIndex: pattern[i],
    depthLevel: i < 2 ? "simple" : i < 6 ? "standard" : "deep",
    promptShape: QUIZ_PROMPT_SHAPES[(n + i - 1 + quizSalt) % QUIZ_PROMPT_SHAPES.length],
    answerStyle: QUIZ_ANSWER_STYLES[(n * 2 + i + quizSalt) % QUIZ_ANSWER_STYLES.length],
    distractorTrap: QUIZ_DISTRACTOR_TRAPS[(n * 3 + i + quizSalt) % QUIZ_DISTRACTOR_TRAPS.length],
  }));
  const cards: CardSlotV1[] = Array.from({ length: cardCount }, (_, i) => ({
    cardId: `rc${String(i + 1).padStart(2, "0")}`,
    requiredFactIds: ids.length ? [ids[i % ids.length]] : [],
    caseCueIds: cases.length ? [cases[(n * 2 + i) % cases.length]] : [],
    difficulty: i < 2 ? "easy" : i < 5 ? "medium" : "hard",
    frontShape: CARD_FRONT_SHAPES[(n + i - 1 + quizSalt) % CARD_FRONT_SHAPES.length],
    retrievalTarget: CARD_RETRIEVAL_TARGETS[(n * 2 + i + quizSalt) % CARD_RETRIEVAL_TARGETS.length],
    backShape: CARD_BACK_SHAPES[(n * 3 + i + quizSalt) % CARD_BACK_SHAPES.length],
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
    const blueprint = compileChapterBlueprint({ bookId: normalized, chapter, packet, packetPath: packetP, roots, totalChapters: index.chapters.length });
    const out = blueprintPath(normalized, chapter.chapterNumber, roots);
    writeJsonFile(out, blueprint);
    written.push(out);
  }
  return { bookId: normalized, written, findings };
}
