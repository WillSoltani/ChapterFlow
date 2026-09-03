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
import { loadSceneMechanisms } from "../librarian/sceneMechanismPlan.js";
import { protectedSourceNames } from "./sourceNames.js";
import { rotate, rankedCaseIdsForFact, scoredCaseIdsForFact, CASE_LINKAGE_MIN_SCORE, isSourceGroundingMetaFact, hasRealMechanism } from "./sourcePacketFacts.js";
import { genreForBook, reservedFigureNamesForGenre, resolvePools, type ResolvedPools } from "./bookDesign.js";

// isSourceGroundingMetaFact moved to sourcePacketFacts.ts (P13) to break the fact-helper
// layering smell and let rankTeachingFacts reuse it; re-exported here for back-compat.
export { isSourceGroundingMetaFact } from "./sourcePacketFacts.js";

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

// Exported ADDITIVELY for the v24 chapter-brief compiler (chapterBrief.ts), which reuses the
// same bank + deal so brief cast reservations stay consistent with blueprint name deals.
export function compilerNameBank(): string[] {
  if (cachedCompilerNameBank) return cachedCompilerNameBank;
  try {
    const loaded = loadNameBank();
    cachedCompilerNameBank = loaded.length >= EXAMPLE_SLOT_COUNT ? loaded : FALLBACK_NAME_BANK;
  } catch {
    cachedCompilerNameBank = FALLBACK_NAME_BANK;
  }
  return cachedCompilerNameBank;
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

// Exported ADDITIVELY for the v24 chapter-brief compiler: brief cast names are drawn from the
// SAME deterministic deal the blueprint uses, so briefs and blueprints can never disagree about
// which invented names a chapter owns.
export function dealAllowedNames(bookId: string, chapterNumber: number, packet: SourcePacketV1, roots: CompilerStoreRoots, salts: SlotSalts): { allowedNames: string[]; sourceProtectedNames: Set<string>; siblingNames: Set<string> } {
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

// R-117 — the ten orthogonal dramatic transactions from config/scene-mechanisms.json, loaded
// through the same validated loader sceneMechanismPlan uses. Cached: the blueprint compiler is
// called once per chapter and the config never changes inside a process.
let cachedSceneMechanismDirectives: string[] | null = null;
export function sceneMechanismDirectives(): string[] {
  if (cachedSceneMechanismDirectives) return cachedSceneMechanismDirectives;
  try {
    cachedSceneMechanismDirectives = loadSceneMechanisms().map((m) => m.directive);
  } catch {
    // A missing/short palette must never crash a compile: fall back to the stance list, which is
    // exactly the pre-R-117 behaviour for the mechanism field.
    cachedSceneMechanismDirectives = null;
  }
  return cachedSceneMechanismDirectives ?? [...SCENE_MODES];
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

// R-102 — POOL WIDTH IS THE VARIETY BUDGET.
//
// Every quiz/card shape pool used to hold EXACTLY as many entries as the chapter has slots
// (9 prompt shapes for 9 questions, 7 back shapes for 7 cards). With slots == pool size the
// dealt MULTISET is forced: every chapter must use every shape, and the only thing a deal can
// move is which slot gets which — which is why ch01..ch04 shipped one list rotated by 1, 2, 3.
// Widening each pool past its slot count is what makes a per-chapter SUBSET possible, so two
// chapters can genuinely differ in which shapes they use at all. The added entries are new
// writer-facing shape names in the same texture as the originals, which stay at the head.
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
  "order-of-operations question (what must happen first)",
  "cost-of-waiting scenario",
  "who-owns-the-next-move question",
  "stop-rule test (when to refuse or reverse)",
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
  "named owner plus the move they make next",
  "threshold stated as a number or a visible sign",
  "refusal with the condition that would change it",
  "second-order consequence the move avoids",
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
  "right move aimed at the wrong person",
  "correct step taken one stage too early",
  "the source case's surface detail copied instead of its mechanism",
  "effort substituted for the visible proof",
];

const CARD_FRONT_SHAPES = [
  "compare two chapter-specific options",
  "name the failure mode",
  "identify the trigger",
  "recall the named-case lesson",
  "state the boundary condition",
  "spot the diagnostic sign",
  "trace the mechanism",
  "predict what happens if the move is skipped",
  "name who acts next and on what signal",
  "give the stop rule for this move",
  "say what evidence would settle it",
];

const CARD_RETRIEVAL_TARGETS = [
  "mechanism",
  "common error",
  "hard edge",
  "named case",
  "implementation trigger",
  "boundary",
  "contrast",
  "second-order consequence",
  "owner of the next move",
  "stop rule",
  "evidence test",
];

// R-112 — CARD BACKS ARE STAGING DIRECTIONS, NOT OPENING WORDS.
//
// The pool used to hold seven "start with the X" instructions dealt to seven card slots, so
// EVERY chapter received all seven and the writer was told, card by card, which word to open
// on. Phase A counted the result on the live candidate: 15 of 28 card backs opened on a
// scaffold ("The contrast is…", "The boundary is…"). An instruction about the first word can
// only be obeyed by writing that first word.
//
// These say what the answer must CONTAIN and how tight it must be — the retrieval property a
// reader is actually being trained on — and never name an opening token. Widened to 11 so a
// 7-card chapter draws a subset (see the pool-width note above).
const CARD_BACK_SHAPES = [
  "answer in one sentence with no lead-in",
  "name the mechanism before naming the case",
  "give the concrete noun and the number that goes with it",
  "state the action and who performs it",
  "name the failure first, then the correction",
  "give the trigger and the move it fires, in that order",
  "state the limit and one case that sits outside it",
  "answer with the contrast made explicit in both directions",
  "give the evidence that would settle it, not the conclusion",
  "close on the consequence the reader avoids",
  "answer in the reader's own situation, not the source's",
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

// Hook openers. Widened 3 -> 9 (P11) so a fixed chapter position no longer draws
// from only three shapes book-wide: the first three are the original set (unchanged
// text so existing prose intuition holds); the six after are new writer-facing shape
// names in the same texture. dealPositional round-robins them across chapters.
const HOOK_SHAPES = [
  "question-into-specific-scene",
  "object-in-motion",
  "reader-default-reversal",
  "cold-specific-number",
  "mid-scene-dialogue",
  "after-the-fact-consequence",
  "second-person-test",
  "contrast-of-two-moments",
  "object-left-behind",
];

// Counter-move framings. Widened 2 -> 6 (P11) for the same reason as HOOK_SHAPES:
// n%2 gave the whole book exactly two counter shapes. First two are the originals.
const COUNTER_SHAPES = [
  "misleading-default",
  "obvious-advice-backfires",
  "popular-move-quietly-fails",
  "intuition-points-wrong-way",
  "safe-choice-hidden-cost",
  "expert-consensus-overturned",
];

const EXAMPLE_SLOT_COUNT = 6;
const FORBIDDEN_NAME_GUIDANCE_LIMIT = 24;

// R-128 — the five DISTINCT purposes. The sixth example slot has no sixth purpose to give it,
// so it draws a second value from the same pool through its own registered deal
// (`examplePurposeTail`) rather than hard-coding a repeat of "application" at slot 5. Splitting
// the deal in two is what lets BPV11 audit both: a six-entry pool with "application" twice would
// make that value's column frequency 2/6 and trip the round-robin cap by construction.
const EXAMPLE_PURPOSES: ExampleSlotV1["purpose"][] = [
  "failure-mode",
  "application",
  "recovery",
  "contrast",
  "decision",
];
const EXAMPLE_PURPOSE_SLOTS = EXAMPLE_PURPOSES.length;

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

// R-104 — the example FORMAT was `EXAMPLE_FORMATS[i]`: a bare slot index, no chapter term at
// all, so all four live chapters shipped the identical six-format sequence and the package's
// example tag column read decision_point / before_after / mistake_recovery / contrast /
// planning_choice / decision_memo verbatim in every chapter. BPV3 only checked that the six were
// distinct WITHIN a chapter, which a constant sequence satisfies perfectly.
//
// It is now a registered positional deal like every other pool (`exampleFormat`), widened past
// the six slots so chapters draw different SUBSETS. Every added format is already a member of
// the ExampleFormat union in src/types.ts.
const EXAMPLE_FORMATS: ExampleFormat[] = [
  "decision_point",
  "before_after",
  "mistake_recovery",
  "contrast",
  "planning_choice",
  "decision_memo",
  "dilemma",
  "postmortem",
  "predict_reveal",
  "audit",
];

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

// ── Positional dealer (P11) ────────────────────────────────────────────────
//
// Generalizes the one correctly-aligned dealer in the codebase (answerPattern's
// BP14-aware quiz-key deal) to EVERY other positional shape, so cross-chapter
// same-position collisions are impossible BY CONSTRUCTION instead of detected
// after writing by AS5/AS6/AS8/AS9 and the scene_skeleton sweep.
//
// The prior deals were bare modular arithmetic: promptShape `(n+i-1)%9`,
// distractorTrap `(n*3+i)%9` (gcd(3,9)=3 -> only THREE distinct traps ever land
// at a fixed quiz position, book-wide), experiential sceneFrame `(n*3+i*5)%12`
// (period 4), hookShape `n%3` (THREE shapes total), counterShape `n%2` (TWO).
// A blind writer handed the identical same-position shape as three chapters back,
// under the same section contract, produces same-position text that QC then
// REVISEs. dealPositional makes that structurally impossible.
//
// GUARANTEES (proved by tests/positional-dealers.test.ts):
//  (a) for a fixed slotIndex at salt 0, the value does not repeat across chapters
//      until the pool is exhausted, then round-robins with MAXIMAL spacing
//      (exactly `pool.length` chapters between repeats);
//  (b) within one chapter, the values dealt to distinct slotIndexes of the same
//      poolKey are distinct whenever slotCount <= pool.length;
//  (c) STABLE under totalChapters growth at salt 0: the closed form depends only
//      on (bookId, poolKey, chapterNumber, slotIndex) — NOT on totalChapters —
//      so a chapter already dealt keeps its value when the book grows.
//
// SALTS (P10 integration — the reviewer-reconciled semantics). P10's repair-owned
// sidecar salts are PER-CHAPTER: a redeal bumps ONE chapter's salt and must change
// ONLY that chapter (P10's pinned contract). A naive per-chapter rank shift lands
// the salted chapter on a value some sibling already holds (pigeonhole) and trips
// BPV11's round-robin cap. So a salted chapter REPLAYS its siblings — every other
// chapter at ITS OWN salted rank, resolved in ascending chapter order exactly like
// answerPattern's sibling replay — and scans forward from (base + salt) to the
// first value whose sibling count at this slot is BELOW the BPV11 cap
// ceil(C / P). Such a value always exists (sibling count sums to C-1 < cap·P), so
// a P10 redeal can never create an avoidable same-position collision. Unsalted
// chapters keep the pure closed form (identical bytes to the pre-salt world), and
// a plain `salt` WITHOUT `saltOf` is a raw rank shift for pools that are not
// cross-chapter comparable (the per-chapter venue palette ordering).
function seededPermutation(size: number, seedKey: string): number[] {
  const order = Array.from({ length: size }, (_, i) => i);
  let seed = fnv1a(seedKey);
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Symbol permutation — WHICH pool entry each rank names. Unchanged seed key, so a book that
 *  keeps the same rank keeps the same string. */
function poolPermutation(size: number, bookId: string, poolKey: string): number[] {
  return seededPermutation(size, `positional:${normSlug(bookId)}:${poolKey}`);
}

// ── R-102: the rank function is a randomized LATIN SQUARE, not a marching shift ──────
//
// The old rank was `((n - 1) + slotIndex) % P`: chapter n's row is chapter (n-1)'s row rotated
// by one. Live consequence on the candidate: ch01..ch04's seven card back shapes were ONE list
// rotated by 1, 2 and 3, and ch03's nine prompt shapes were all nine shapes in marching order.
//
// What CANNOT change: BPV11's round-robin cap. At a fixed slot the column must still visit each
// pool value once every P chapters, or the same-position sameness AS5/AS6/AS8/AS9 punish comes
// straight back. A per-chapter *independent* permutation (the register's literal suggestion)
// breaks exactly that — over 12 chapters and a 9-pool it lands a value 3x at some slot with high
// probability, which BPV11 blocks. So independence is not available; what is available is a
// different LATIN SQUARE.
//
//   rank(n, i) = ( rowPerm[(n - 1) mod P] + colPerm[i mod P] ) mod P
//
//   rows    — for a fixed n, distinct i give distinct colPerm[i], hence distinct ranks: within
//             a chapter every slot still gets a different pool entry (guarantee (b)).
//   columns — for a fixed i, as n runs over any P consecutive chapters, (n-1) mod P covers every
//             residue and rowPerm is a bijection, so the column is a permutation of the pool:
//             exactly one use of each value per P chapters, i.e. the ceil(C/P) cap BPV11 checks
//             (guarantee (a)), with repeats maximally spaced.
//   growth  — depends only on (bookId, poolKey, n, i) (guarantee (c)).
//
// What it buys: chapter n and chapter n+1 are no longer index-rotations of each other, because
// colPerm scrambles the slot axis before the row offset is applied. And once a pool is WIDER
// than the slot count (see the pool-width note above), the set each chapter draws differs too.
function rowPermutation(size: number, bookId: string, poolKey: string): number[] {
  return seededPermutation(size, `positional-row:${normSlug(bookId)}:${poolKey}`);
}

function colPermutation(size: number, bookId: string, poolKey: string): number[] {
  return seededPermutation(size, `positional-col:${normSlug(bookId)}:${poolKey}`);
}

export function dealPositional<T>(args: {
  pool: readonly T[];
  bookId: string;
  poolKey: string;
  chapterNumber: number;
  slotIndex: number;
  totalChapters: number;
  /** Raw rank shift, applied WITHOUT sibling replay. Only for pools that are not
   *  cross-chapter comparable (per-chapter venue palettes). Cross-chapter pools
   *  must use `saltOf` so the collision-avoiding scan engages. */
  salt?: number;
  /** Per-chapter salt lookup (P10 sidecar). When provided and ANY chapter is
   *  salted, salted chapters resolve via the sibling-replay scan. */
  saltOf?: (chapterNumber: number) => number;
}): T {
  const { pool, bookId, poolKey, chapterNumber, slotIndex, salt = 0, saltOf } = args;
  if (pool.length === 0) throw new Error(`dealPositional: empty pool for poolKey ${poolKey}`);
  const P = pool.length;
  const perm = poolPermutation(P, bookId, poolKey);
  const rowPerm = rowPermutation(P, bookId, poolKey);
  const colPerm = colPermutation(P, bookId, poolKey);
  const colOffset = colPerm[((slotIndex % P) + P) % P];
  const baseRank = (n: number) => ((rowPerm[(((n - 1) % P) + P) % P] + colOffset) % P + P) % P;
  if (!saltOf) {
    // Closed form (+ optional raw shift for non-comparable pools).
    return pool[perm[(baseRank(chapterNumber) + Math.max(0, salt)) % P]];
  }
  const C = Math.max(args.totalChapters, chapterNumber, 1);
  const cap = Math.max(1, Math.ceil(C / P));
  // Resolve every chapter's rank in ascending order (answerPattern's replay
  // convention): unsalted chapters take the closed form; a salted chapter scans
  // forward from (base + salt) to the first value BELOW the cap among the ranks
  // resolved so far plus all unsalted siblings (their ranks are order-independent).
  const resolveRank = (resolved: Map<number, number>, n: number): number => {
    const s = Math.max(0, saltOf(n) ?? 0);
    if (s === 0) return baseRank(n);
    const counts = new Map<number, number>();
    for (let m = 1; m <= C; m++) {
      if (m === n) continue;
      const mRank = resolved.has(m) ? resolved.get(m)! : (Math.max(0, saltOf(m) ?? 0) === 0 ? baseRank(m) : -1);
      if (mRank >= 0) counts.set(perm[mRank], (counts.get(perm[mRank]) ?? 0) + 1);
    }
    // A redeal must move OFF the chapter's own flagged value: excluding self makes the own
    // residue the least-crowded, so a plain sub-cap scan would walk straight back onto it and
    // the redeal would be a byte-level no-op. Prefer the first sub-cap value at a DIFFERENT
    // rank; fall back to the own rank only when every other value is at the cap (saturated
    // column — staying put is then the only BPV11-clean option).
    let ownRankFallback = -1;
    for (let step = 0; step < P; step++) {
      const r = (baseRank(n) + s + step) % P;
      if ((counts.get(perm[r]) ?? 0) >= cap) continue;
      if (r === baseRank(n)) { ownRankFallback = r; continue; }
      return r;
    }
    return ownRankFallback >= 0 ? ownRankFallback : (baseRank(n) + s) % P;
  };
  const resolved = new Map<number, number>();
  for (let m = 1; m <= chapterNumber; m++) resolved.set(m, resolveRank(resolved, m));
  return pool[perm[resolved.get(chapterNumber)!]];
}

// Registry of every positional deal, so blueprintGate can recompute the book's
// deals (BPV11) and floor-check thin pools (BPV12) generically instead of
// re-implementing each extraction. `slots` is the number of same-poolKey slots
// a single chapter fills (1 = a chapter-level deal). `extract` returns the dealt
// values in slot order for one chapter's blueprint.
export type PositionalDealDescriptor = {
  poolKey: string;
  poolSize: number;
  slots: number;
  perChapter: boolean;
  /** True pool size at a given slotIndex. Defaults to poolSize; overridden for
   *  the example fields whose slots draw from two pools by parity (odd = the
   *  smaller experiential pool). BPV11 needs the TRUE pool size — inferring it
   *  from observed distinct values would mask a broken deal (a period-3 deal
   *  over a 9-pool looks perfectly balanced against its own 3 observed values). */
  poolSizeAt?: (slotIndex: number) => number;
  /**
   * CONTENT-DRIVEN deals (R-128). Fact ids, case cues and venues are not drawn from a fixed
   * book-wide vocabulary: their candidate space is the chapter's own packet, and its size
   * differs chapter to chapter. BPV11's round-robin cap needs ONE book-wide pool size, so it
   * cannot be computed for them and applying the descriptor's size would be arithmetic theatre.
   *
   * These columns are audited by BPV13 instead, which sizes the pool to the values the column
   * ITSELF was dealt and raises an ADVISORY when one value takes more of the column than that
   * variety allows. What it catches: the R-125 collapse (a fixed card slot seeing two cases in a
   * whole book) and the R-127 constant (a fixed card slot teaching one fact in every chapter).
   * What it does NOT block: anything — it is advisory precisely because a legitimate small packet
   * (two cases, four facts) concentrates a column for content reasons, and failing a run on that
   * would be weakening the pipeline's ability to ship a thin-but-honest chapter, not tightening it.
   */
  contentDriven?: boolean;
  extract: (bp: ChapterBlueprintV1) => string[];
};

const exampleParityPoolSize = (dec: number, exp: number) => (slotIndex: number) => (slotIndex % 2 === 1 ? exp : dec);

export const POSITIONAL_DEALS: PositionalDealDescriptor[] = [
  { poolKey: "quizPromptShape", poolSize: QUIZ_PROMPT_SHAPES.length, slots: 9, perChapter: false, extract: (bp) => bp.sections.quiz.map((q) => q.promptShape) },
  { poolKey: "quizAnswerStyle", poolSize: QUIZ_ANSWER_STYLES.length, slots: 9, perChapter: false, extract: (bp) => bp.sections.quiz.map((q) => q.answerStyle) },
  { poolKey: "quizDistractorTrap", poolSize: QUIZ_DISTRACTOR_TRAPS.length, slots: 9, perChapter: false, extract: (bp) => bp.sections.quiz.map((q) => q.distractorTrap) },
  { poolKey: "cardFrontShape", poolSize: CARD_FRONT_SHAPES.length, slots: 7, perChapter: false, extract: (bp) => bp.sections.cards.map((c) => c.frontShape) },
  { poolKey: "cardRetrievalTarget", poolSize: CARD_RETRIEVAL_TARGETS.length, slots: 7, perChapter: false, extract: (bp) => bp.sections.cards.map((c) => c.retrievalTarget) },
  { poolKey: "cardBackShape", poolSize: CARD_BACK_SHAPES.length, slots: 7, perChapter: false, extract: (bp) => bp.sections.cards.map((c) => c.backShape) },
  // sceneFrame / requiredBeat: even slots deal from the decision pool, odd from
  // the smaller experiential pool. poolSizeAt returns the correct per-slot pool.
  { poolKey: "exampleSceneFrame", poolSize: EXAMPLE_SCENE_FRAMES.length, slots: 6, perChapter: false, poolSizeAt: exampleParityPoolSize(EXAMPLE_SCENE_FRAMES.length, EXAMPLE_SCENE_FRAMES_EXPERIENTIAL.length), extract: (bp) => bp.sections.examples.map((e) => e.sceneFrame) },
  { poolKey: "exampleRequiredBeat", poolSize: EXAMPLE_BEATS.length, slots: 6, perChapter: false, poolSizeAt: exampleParityPoolSize(EXAMPLE_BEATS.length, EXAMPLE_BEATS_EXPERIENTIAL.length), extract: (bp) => bp.sections.examples.map((e) => e.requiredBeat) },
  { poolKey: "ifThenPlanShape", poolSize: IF_THEN_PLAN_SHAPES.length, slots: 3, perChapter: false, extract: (bp) => bp.sections.action.ifThenPlanShapes },
  { poolKey: "hookShape", poolSize: HOOK_SHAPES.length, slots: 1, perChapter: true, extract: (bp) => [bp.reservedVariety.hookShape] },
  { poolKey: "counterShape", poolSize: COUNTER_SHAPES.length, slots: 1, perChapter: true, extract: (bp) => [bp.reservedVariety.counterShape] },
  { poolKey: "actionMechanism", poolSize: ACTION_MECHANISMS.length, slots: 1, perChapter: true, extract: (bp) => [bp.reservedVariety.actionMechanism] },
  { poolKey: "weeklyPracticeForm", poolSize: WEEKLY_FORMS.length, slots: 1, perChapter: true, extract: (bp) => [bp.reservedVariety.weeklyPracticeForm] },
  { poolKey: "practiceForm", poolSize: PRACTICE_FORMS.length, slots: 1, perChapter: true, extract: (bp) => [bp.sections.action.practiceForm] },
  { poolKey: "practiceConstraint", poolSize: PRACTICE_CONSTRAINTS.length, slots: 1, perChapter: true, extract: (bp) => [bp.sections.action.practiceConstraint] },
  // ── R-128: the ten deals that were computed OUTSIDE this registry ─────────────────────
  //
  // BPV11/BPV12 are the only cross-chapter collision audit in the pipeline, and they can only
  // see what POSITIONAL_DEALS declares. Every entry below was, until this change, a bare modular
  // expression inside compileChapterBlueprint — invisible to the audit, and (R-102/R-104/R-118/
  // R-125/R-127) most of them were the broken ones. Registering them is what makes the gate able
  // to catch the next regression of the same kind instead of a Phase-A reader finding it.
  { poolKey: "examplePurpose", poolSize: EXAMPLE_PURPOSES.length, slots: EXAMPLE_PURPOSE_SLOTS, perChapter: false, extract: (bp) => bp.sections.examples.slice(0, EXAMPLE_PURPOSE_SLOTS).map((e) => e.purpose) },
  // The sixth example slot's purpose: a second draw from the same five-value pool through its own
  // per-chapter deal, so its column is audited without making "application" a duplicate pool entry.
  { poolKey: "examplePurposeTail", poolSize: EXAMPLE_PURPOSES.length, slots: 1, perChapter: true, extract: (bp) => [bp.sections.examples[EXAMPLE_PURPOSE_SLOTS]?.purpose].filter((v): v is ExampleSlotV1["purpose"] => !!v) },
  { poolKey: "exampleSceneMode", poolSize: SCENE_MODES.length, slots: 6, perChapter: false, extract: (bp) => bp.sections.examples.map((e) => e.sceneMode) },
  { poolKey: "exampleFormat", poolSize: EXAMPLE_FORMATS.length, slots: 6, perChapter: false, extract: (bp) => (bp.plan?.exampleSpecs ?? []).map((spec) => String(spec.format)) },
  { poolKey: "hookShapeSection", poolSize: HOOK_SHAPES.length, slots: 1, perChapter: true, extract: (bp) => [bp.sections.hook.shape] },
  { poolKey: "reservedSceneMode", poolSize: SCENE_MODES.length, slots: 1, perChapter: true, extract: (bp) => [bp.reservedVariety.sceneMode] },
  { poolKey: "sceneMechanism", poolSize: sceneMechanismDirectives().length, slots: 1, perChapter: true, extract: (bp) => [bp.reservedVariety.sceneMechanism] },
  // The venue deal orders THIS chapter's own six-venue palette, so its "pool" is the palette.
  { poolKey: "venue", contentDriven: true, poolSize: EXAMPLE_SLOT_COUNT, slots: 6, perChapter: false, extract: (bp) => bp.sections.examples.map((e) => e.venue) },
  // Fact and case cue deals are CONTENT-driven — see PositionalDealDescriptor.contentDriven.
  { poolKey: "cardFact", contentDriven: true, poolSize: 0, slots: 7, perChapter: false, extract: (bp) => bp.sections.cards.map((c) => c.requiredFactIds[0] ?? "") },
  { poolKey: "quizCaseCue", contentDriven: true, poolSize: 0, slots: 9, perChapter: false, extract: (bp) => bp.sections.quiz.map((q) => q.caseCueIds[0] ?? "") },
  { poolKey: "cardCaseCue", contentDriven: true, poolSize: 0, slots: 7, perChapter: false, extract: (bp) => bp.sections.cards.map((c) => c.caseCueIds[0] ?? "") },
];

// P10 sidecar-field → poolKey mapping: which coarse repair salt drives which deals.
// hook/counter/action deals have no repair lever yet — they stay unsalted.
const SALT_FIELD_BY_POOLKEY: Record<string, keyof ChapterSlotSalts> = {
  exampleSceneFrame: "exampleFrames",
  exampleSceneFrameExperiential: "exampleFrames",
  exampleRequiredBeat: "exampleFrames",
  exampleRequiredBeatExperiential: "exampleFrames",
  quizPromptShape: "quizShapes",
  quizAnswerStyle: "quizShapes",
  quizDistractorTrap: "quizShapes",
  cardFrontShape: "quizShapes",
  cardRetrievalTarget: "quizShapes",
  cardBackShape: "quizShapes",
};

function pick<T>(xs: T[], offset: number, count: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(xs[(offset + i) % xs.length]);
  return out;
}

/**
 * R-114 / R-115 — the forbidden-name list is INFORMATION, not padding.
 *
 * It used to be: source-protected names, then sibling names, then as much of the rest of the
 * name bank as fitted a 24-entry cap. Only the first few entries carried information. The
 * padding actively lied: live ch03 forbade "Russell" while live ch04's allowedNames contained
 * "Russell" — the book's own later deal contradicted the guidance, because the bank tail is not
 * a prohibition, it is simply "names this chapter did not happen to draw".
 *
 * R-115: the head of the list was the five hard-coded investing figures (Benjamin, Graham,
 * Dodd, Buffett, Warren), which on a memoir BY Benjamin Franklin opened the writer's forbidden
 * list with "Benjamin". Those five are now genre-keyed config (config/genre-pools.json,
 * `reservedFigureNames`), and only the book's own genre contributes them.
 *
 * What stays: names the packet itself protects (real source figures in THIS chapter's material)
 * and names an earlier same-bucket sibling chapter was dealt. Both are true prohibitions.
 *
 * `dealtElsewhere` is a defensive filter, not a source of entries: any name this book actually
 * deals to some chapter is removed, so the list can never contradict a deal again.
 */
function forbiddenNameGuidance(sourceProtectedNames: Set<string>, siblingNames: Set<string>, genreReservedNames: Set<string>): string[] {
  const protectedFirst = [...genreReservedNames].sort();
  const packetNext = [...sourceProtectedNames].filter((name) => !genreReservedNames.has(name)).sort();
  const siblingNext = [...siblingNames].sort();
  return uniq([...protectedFirst, ...packetNext, ...siblingNext]).slice(0, FORBIDDEN_NAME_GUIDANCE_LIMIT);
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

// Exported ADDITIVELY for the v24 chapter-brief compiler: the brief's answerIndexPattern is the
// SAME BP14-safe anti-gaming deal the compiler path pins into blueprints — solved technology,
// reused rather than reinvented.
export function answerPattern(chapterNumber: number, count: number, totalChapters?: number): number[] {
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

// ── P13: pedagogical fact ordering / role assignment ──────────────────────────────
//
// When a packet carries the P13 ranking (facts[].teachingPriority set by
// sourcePacketFacts.applyTeachingRanking), the blueprint deals facts by RANK rather than
// packet order: the teaching pool (factIds) is sorted by teachingPriority, so cards/examples/
// summary anchors — which all index into `ids` — automatically teach the best facts first, and
// quiz slots are routed by role (assignFactsByRole). LEGACY packets (no teachingPriority) return
// the pool in packet order, so every downstream slot is byte-identical to the pre-P13 world; the
// feature keys purely on field presence.

/** Fact-id → 1-based teachingPriority, or null when no fact carries a ranking (legacy packet). */
function teachingPriorityOf(packet: SourcePacketV1): Map<string, number> | null {
  const entries = packet.facts
    .filter((f) => typeof f.teachingPriority === "number")
    .map((f) => [f.id, f.teachingPriority as number] as const);
  return entries.length ? new Map(entries) : null;
}

/** The teaching pool, ordered by teachingPriority when present (best fact first, id-stable
 *  tie-break), else in packet order. Always a subset of factIds ⊆ rawFactIds, so
 *  assertFactIdsSubset holds by construction. */
function orderedTeachingIds(packet: SourcePacketV1): string[] {
  const teaching = factIds(packet);
  const priority = teachingPriorityOf(packet);
  if (!priority) return teaching;
  return [...teaching].sort((a, b) => {
    const pa = priority.get(a) ?? Number.POSITIVE_INFINITY;
    const pb = priority.get(b) ?? Number.POSITIVE_INFINITY;
    return pa - pb || (a < b ? -1 : a > b ? 1 : 0);
  });
}

/** Teaching-pool ids (in the given order) whose fact carries a REAL mechanism. */
function mechanismTeachingIds(packet: SourcePacketV1, orderedIds: string[]): string[] {
  const byId = new Map(packet.facts.map((f) => [f.id, f]));
  return orderedIds.filter((id) => { const f = byId.get(id); return !!f && hasRealMechanism(f); });
}

export type FactRolePreference = "mechanism" | "definitional" | "any";

function rolePreferenceKey(id: string, prefer: FactRolePreference, mechanismSet: Set<string>): number {
  if (prefer === "any") return 0;
  const isMechanism = mechanismSet.has(id);
  // "mechanism" slots want mechanism facts first; "definitional" slots want non-mechanism first.
  if (prefer === "mechanism") return isMechanism ? 0 : 1;
  return isMechanism ? 1 : 0;
}

/**
 * Pure, deterministic assignment of ranked fact ids to a list of role-typed slots.
 * For each slot in order, picks the fact that best matches the slot's role preference
 * (mechanism-bearing vs definitional), breaking ties toward the LEAST-used fact and then
 * by rank — so facts spread across slots (round-robin) rather than clumping on rank 1.
 * No fact is used more than `maxPerFact` times whenever the pool is large enough
 * (rankedIds.length * maxPerFact >= slots.length), which the quiz caller guarantees via
 * maxPerFact = ceil(quizCount / distinctFacts). Returns [] for an empty pool.
 */
export function assignFactsByRole(
  rankedIds: string[],
  slots: FactRolePreference[],
  opts: { maxPerFact: number; mechanismIds?: string[] },
): string[] {
  if (rankedIds.length === 0) return [];
  const cap = opts.maxPerFact > 0 ? opts.maxPerFact : Number.POSITIVE_INFINITY;
  const mechanismSet = new Set(opts.mechanismIds ?? []);
  const rankIndex = new Map(rankedIds.map((id, i) => [id, i]));
  const usage = new Map<string, number>();
  const out: string[] = [];
  for (const prefer of slots) {
    const ordered = [...rankedIds].sort((a, b) =>
      rolePreferenceKey(a, prefer, mechanismSet) - rolePreferenceKey(b, prefer, mechanismSet)
      || (usage.get(a) ?? 0) - (usage.get(b) ?? 0)
      || (rankIndex.get(a)! - rankIndex.get(b)!),
    );
    const chosen = ordered.find((id) => (usage.get(id) ?? 0) < cap) ?? ordered[0];
    usage.set(chosen, (usage.get(chosen) ?? 0) + 1);
    out.push(chosen);
  }
  return out;
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

/** The best-linked case for a fact, ignoring load. Kept as the single-slot helper for callers
 *  that must cite something and have no budget to balance. */
export function bestCaseIdForFact(packet: SourcePacketV1, factId: string | undefined, fallbackIndex: number): string[] {
  const [best] = rankedCaseIdsForFact(packet, factId, fallbackIndex);
  return best ? [best] : [];
}

// ── R-101 / R-062 / R-119 / R-125 — fact-relevant case cue dealing ────────────────────
//
// THREE defects shared one root: a case cue was chosen by SLOT POSITION or by raw load, not by
// whether the slot's fact has anything to do with the case.
//
//   R-101  exampleCaseIdForFact load-balanced across the WHOLE ranked list. On live ch03 the
//          fact militia-workaround scored militia=11, hospital=3, junto=1 — and the dealer gave
//          ex05 `junto`, the worst-linked case, purely because junto was the least used.
//   R-062  quiz cues were `cases[(n + i - 1) % |cases|]` — pure position. SEC56 then makes the
//          dealt cue MANDATORY in the reader-facing stem and explanation, so a Penn-negotiation
//          question opened on a near-shipwreck and the explanation disclaimed it.
//   R-119  nine quiz slots over five cases forced each case's specifics onto four quiz surfaces.
//   R-125  card cues used the stride (n*2 + i), so an even |cases| left a fixed card slot seeing
//          only two distinct cases in the whole book.
//
// The replacement is one dealer with three knobs:
//   • HEAD TOLERANCE — load-balancing happens only among cases within CASE_CUE_HEAD_TOLERANCE
//     points of the best score, so a balance decision can never reach past a genuinely better
//     link. (R-101.)
//   • LINKAGE REQUIREMENT — quiz and card slots take a cue ONLY when the fact clears
//     CASE_LINKAGE_MIN_SCORE against some case. An unlinked slot gets NO cue, which is what stops
//     SEC56 from welding an unrelated case into the stem. Example slots pass requireLink:false
//     because BPV10 makes an example anchor mandatory. (R-062.)
//   • MULTIPLICITY CAP — quiz and cards each hold a case to MAX_CASE_CUES_PER_SURFACE cues, so
//     no case reaches more than MAX_CASE_CUES_PER_CHAPTER learning units. (R-119/R-125.)
//
// WHAT THIS STOPS BLOCKING: nothing. No gate reads caseCueIds; SEC55-58 validate the cues that
// ARE present. Fewer, better-linked cues mean SEC56 fires on fewer slots — each of which now has
// a case whose specifics genuinely belong in the answer.
export const CASE_CUE_HEAD_TOLERANCE = 1;
/** Quiz + card slots one case may cue in a chapter. Two is enough for a case to be retrievable
 *  from more than one angle and far below the four-per-case the positional stride forced. */
export const MAX_CASE_CUES_PER_CHAPTER = 2;
/** …split ONE per learning surface. A single shared counter let the quiz (dealt first) spend the
 *  whole budget and leave every card uncued, which trades one monoculture for another; a per-
 *  surface cap of 1 keeps the chapter cap at 2 while guaranteeing cards can still anchor. */
export const MAX_CASE_CUES_PER_SURFACE = 1;

export function dealCaseCue(
  packet: SourcePacketV1,
  factId: string | undefined,
  fallbackIndex: number,
  used: Map<string, number>,
  opts: { cap: number; requireLink: boolean },
): string[] {
  const scored = scoredCaseIdsForFact(packet, factId, fallbackIndex);
  if (!scored.length) return [];
  const top = scored[0].score;
  if (opts.requireLink && top < CASE_LINKAGE_MIN_SCORE) return [];
  const head = scored.filter((item) => item.score >= top - CASE_CUE_HEAD_TOLERANCE).map((item) => item.id);
  const underCap = head.filter((id) => (used.get(id) ?? 0) < opts.cap);
  // A required cue (examples) still gets the least-used head case when every head case is at
  // cap; an optional cue (quiz/cards) simply goes uncued rather than over-citing a case.
  const candidates = underCap.length ? underCap : (opts.requireLink ? [] : head);
  if (!candidates.length) return [];
  const minCount = Math.min(...candidates.map((id) => used.get(id) ?? 0));
  const next = candidates.find((id) => (used.get(id) ?? 0) === minCount)!;
  used.set(next, (used.get(next) ?? 0) + 1);
  return [next];
}

function buildPlan(chapter: ChapterSpec, packet: SourcePacketV1, examples: ExampleSlotV1[], quizCount: number, cardCount: number, exampleFormats: ExampleFormat[]): ChapterDesignDoc {
  const ids = orderedTeachingIds(packet);
  // P13: the core move is the chapter's BEST idea (top-ranked mechanism fact), not facts[0].
  // Legacy packets carry no coreMoveFactId, so this falls back to the pre-P13 facts[0] behavior.
  const coreFact = packet.coreMoveFactId ? packet.facts.find((f) => f.id === packet.coreMoveFactId) : undefined;
  const coreMove = (coreFact?.mechanism || coreFact?.claim)
    || packet.facts[0]?.mechanism || packet.facts[0]?.claim
    || `Use ${chapter.chapterTitle} as a concrete decision tool.`;
  const exampleSpecs = examples.map((slot, i) => ({
    // R-111 — the domain is the VENUE, full stop.
    //
    // It used to be `${venue}: ${sceneMode}; ${sceneFrame}` — three unrelated staging fields
    // welded into one string. assembler.buildTags then took words [0] and [2] of that string as
    // the example's reader-visible TAGS, which is how the shipped package ended up tagged
    // ["decision_memo", "working", "bags"] off the domain "a working note on four courses a
    // year: small experiment; a first encounter with buckets and bags that sets a benchmark".
    // sceneMode and sceneFrame already reach the writer as their own fields on this slot, so
    // nothing is lost by not restating them here.
    domain: slot.venue,
    audience: "a reader applying this chapter in a realistic everyday decision",
    stakes: slot.purpose === "failure-mode" ? "the default behavior quietly costs the reader" : "a small correct move creates a visible improvement",
    format: exampleFormats[i],
    requiredBeat: slot.requiredBeat,
    sourceAnchorIds: [...slot.requiredCaseIds],
  }));
  return {
    chapterId: chapter.chapterId,
    number: chapter.chapterNumber,
    title: chapter.chapterTitle,
    coreMove,
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

// ── P14: resolved pools (per-book design → genre → legacy) ──────────────────────
//
// The legacy in-code constants above are packaged as a ResolvedPools object so resolvePools can
// return them UNCHANGED as the byte-compat fallback. A book without a design artifact mapped to the
// `generic` genre resolves to exactly this — every deal draws from the identical constant array, the
// venue palette comes from plannedVenuePalette (global palette + FALLBACK_VENUES forbidden) exactly
// as before — so its blueprint is byte-identical to the pre-P14 world.
function legacyResolvedPools(bookId: string): ResolvedPools {
  return {
    source: "legacy",
    genre: "generic",
    sceneFramesDecision: [...EXAMPLE_SCENE_FRAMES],
    sceneFramesExperiential: [...EXAMPLE_SCENE_FRAMES_EXPERIENTIAL],
    beatsDecision: [...EXAMPLE_BEATS],
    beatsExperiential: [...EXAMPLE_BEATS_EXPERIENTIAL],
    venues: [...FALLBACK_VENUES],
    practiceConstraints: [...PRACTICE_CONSTRAINTS],
    practiceForms: [...PRACTICE_FORMS],
    actionMechanisms: [...ACTION_MECHANISMS],
    weeklyForms: [...WEEKLY_FORMS],
    venuePaletteFor: (chapterNumber: number) => plannedVenuePalette(bookId, chapterNumber),
    forbiddenVenuesFor: (venuePalette: string[]) => FALLBACK_VENUES.filter((v) => !venuePalette.includes(v)).slice(0, 4),
  };
}

/** The pools a book's blueprints actually deal from, resolved through the design → genre → legacy
 *  tiers. Exported so blueprintGate can size its positional-collision math (BPV11/BPV12) to the
 *  SAME per-book pools the compile used, instead of the global constant sizes. */
export function resolvedPoolsForBook(bookId: string, roots: CompilerStoreRoots = {}): ResolvedPools {
  return resolvePools(bookId, roots, legacyResolvedPools(normSlug(bookId)));
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
  // P14: resolve the per-book variety pools (design artifact → genre → legacy constants). For a book
  // without a design artifact mapped to the `generic` genre this returns the legacy constants
  // unchanged, so the blueprint stays byte-identical. Cards/quiz/hook/counter/if-then/scene-mode
  // SHAPE vocabularies are genre-neutral and NOT designable — they keep drawing from the module
  // constants; only the flavored pools (frames, beats, venues, practice constraints/forms, action
  // mechanisms, weekly forms) come from `pools`.
  const pools = resolvePools(bookId, roots, legacyResolvedPools(normSlug(bookId)));
  // P13: `ids` is the teaching pool ordered by pedagogical rank when the packet carries the
  // ranking (facts[].teachingPriority), else packet order (legacy → byte-identical). Cards,
  // examples, summaries, hook, and the plan's source anchors all index into `ids`, so they
  // pick up rank ordering for free; quiz slots are role-routed separately (assignFactsByRole).
  const ids = orderedTeachingIds(packet);
  const rankingActive = teachingPriorityOf(packet) !== null;
  const mechanismIds = mechanismTeachingIds(packet, ids);
  const allFactIds = rawFactIds(packet);
  assertFactIdsSubset(ids, allFactIds, `chapter ${chapter.chapterNumber} blueprint`);
  const cases = caseIds(packet);
  const n = chapter.chapterNumber;
  // P10 × P11: the per-chapter repair salts drive the positional deals. Each poolKey maps to its
  // coarse sidecar field (SALT_FIELD_BY_POOLKEY); a salted chapter resolves via dealPositional's
  // sibling-replay scan so a redeal changes ONLY that chapter and never creates an avoidable
  // same-position collision (BPV11-safe). The venue deal orders THIS chapter's own palette (not
  // cross-chapter comparable), so its salt is a raw rank shift without replay.
  const totalForDeal = totalChapters && totalChapters > 0 ? Math.max(totalChapters, n) : n;
  const saltOfFor = (poolKey: string) => {
    const field = SALT_FIELD_BY_POOLKEY[poolKey];
    return field ? (m: number) => chapterSalts(salts, m)[field] : undefined;
  };
  const deal = <T,>(pool: readonly T[], poolKey: string, slotIndex: number): T =>
    dealPositional({ pool, bookId, poolKey, chapterNumber: n, slotIndex, totalChapters: totalForDeal, saltOf: saltOfFor(poolKey) });
  const { venues: venueSalt } = chapterSalts(salts, n);
  const quizCount = 9;
  const cardCount = 7;
  const exampleCount = EXAMPLE_SLOT_COUNT;
  const { allowedNames, siblingNames } = dealAllowedNames(bookId, n, packet, roots, salts);
  // R-115 — guidance vs. deal. The DEAL still excludes the default reserved block (via
  // dealAllowedNames → protectedSourceNames' default), because sectionGate's SEC34 reserves those
  // same names book-wide and dealing one would deadlock a compile. The GUIDANCE shows only real
  // prohibitions for THIS book: its genre's canon plus the names its own packet protects.
  const genreReservedNames = new Set(reservedFigureNamesForGenre(genreForBook(bookId)));
  const packetProtectedNames = protectedSourceNames(packet, compilerNameBank(), []);
  const venuePalette = pools.venuePaletteFor(n);
  // R-113 — forbiddenVenues is the ADJACENT chapters' palettes, not "four venues this chapter
  // did not draw". The old list was `allVenues.filter(not in palette).slice(0, 4)`: with the
  // derived venues sitting at the head of the pool, every chapter forbade the same four derived
  // strings, and because the pool head was book-wide those four were another chapter's tokens
  // re-injected as a prohibition. Neighbours are the collision the field was written to prevent.
  const forbiddenVenues = uniq(
    [n - 1, n + 1]
      .filter((m) => m >= 1)
      .flatMap((m) => {
        try {
          return pools.venuePaletteFor(m);
        } catch {
          return [] as string[];
        }
      })
      .filter((v) => !venuePalette.includes(v)),
  ).slice(0, 4);
  const pattern = answerPattern(n, quizCount, totalChapters);
  // R-119/R-125 — quiz and cards share ONE cue counter; examples keep their own budget because
  // BPV10 makes an example anchor mandatory and their cap is set by the slot count, not by the
  // learning-unit ceiling.
  const usedExampleCaseCounts = new Map<string, number>();
  const usedQuizCaseCounts = new Map<string, number>();
  const usedCardCaseCounts = new Map<string, number>();
  const exampleCaseCap = Math.max(1, Math.ceil(exampleCount / Math.max(1, cases.length)));
  const examples: ExampleSlotV1[] = Array.from({ length: exampleCount }, (_, i) => {
    const factId = exampleFactId(ids, n, i);
    return {
      slotId: `ex${String(i + 1).padStart(2, "0")}`,
      // R-128 — purpose and sceneMode were `(n + i - 1) % 6` / `(n + i) % 9`: bare marching
      // arithmetic invisible to BPV11. Both are registered positional deals now.
      purpose: i < EXAMPLE_PURPOSE_SLOTS
        ? deal(EXAMPLE_PURPOSES, "examplePurpose", i)
        : deal(EXAMPLE_PURPOSES, "examplePurposeTail", 0),
      sceneMode: deal(SCENE_MODES, "exampleSceneMode", i),
      // Guarantee a MIX: odd slots get a non-deliberation experiential engine, even slots a
      // decision engine — so every chapter's six examples span both kinds (3+3) instead of six
      // flavors of "decide." This is the deterministic lever against scene_skeleton sameness.
      // Each half is dealt via dealPositional over ITS OWN pool at the real slot index, so
      // even slots never collide with a prior chapter's same even slot (and likewise odd),
      // while the 3+3 decision/experiential parity is preserved by the parity switch itself.
      // A `redeal:example-slot` bump (exampleFrames salt) re-deals via the sibling-safe scan.
      sceneFrame: i % 2 === 1
        ? deal(pools.sceneFramesExperiential, "exampleSceneFrameExperiential", i)
        : deal(pools.sceneFramesDecision, "exampleSceneFrame", i),
      // Deal which palette entry lands in each slot so slot 0's venue is not always
      // venuePalette[0]; a `redeal:venue` bump shifts the ordering (raw rank shift — the
      // palette is chapter-local, so there is no cross-chapter column to scan against).
      venue: dealPositional({ pool: venuePalette, bookId, poolKey: "venue", chapterNumber: n, slotIndex: i, totalChapters: totalForDeal, salt: venueSalt }),
      // R-120 — ONE dealt protagonist per slot, disjoint across the chapter's six slots.
      //
      // It used to be `pick(allowedNames, i, 3)` over a six-name list: a modular WINDOW, so slot
      // 5 received [names[5], names[0], names[1]] — the same two people it had already offered
      // to slots 0 and 1. Phase A recorded the consequence in the prose: one name playing an
      // adult in ex01 and a child in ex04 of the same chapter. The chapter's whole cast is still
      // visible to the writer (and to SEC35) via reservedVariety.allowedNames; what the slot
      // carries now is who this scene belongs to.
      allowedNames: allowedNames[i] ? [allowedNames[i]] : [],
      requiredFactIds: factId ? [factId] : [],
      requiredCaseIds: dealCaseCue(packet, factId, i, usedExampleCaseCounts, { cap: exampleCaseCap, requireLink: false }),
      forbiddenVenues,
      requiredBeat: i % 2 === 1
        ? deal(pools.beatsExperiential, "exampleRequiredBeatExperiential", i)
        : deal(pools.beatsDecision, "exampleRequiredBeat", i),
    };
  });
  // Depth per quiz slot (unchanged mapping): slots 0-1 simple, 2-5 standard, 6-8 deep.
  const quizDepth = (i: number): QuizSlotV1["depthLevel"] => (i < 2 ? "simple" : i < 6 ? "standard" : "deep");
  // P13 quiz fact routing: deep (apply/analyze) slots prefer mechanism-bearing facts, simple
  // (remember/understand) slots prefer definitional/boundary facts, and no fact is used on more
  // than ceil(quizCount / distinctFacts) questions. Legacy packets keep positional round-robin.
  const quizFactBySlot: (string | undefined)[] = rankingActive && ids.length
    ? assignFactsByRole(
        ids,
        Array.from({ length: quizCount }, (_, i) => {
          const d = quizDepth(i);
          return d === "deep" ? "mechanism" : d === "simple" ? "definitional" : "any";
        }),
        { maxPerFact: Math.ceil(quizCount / Math.max(1, ids.length)), mechanismIds },
      )
    : Array.from({ length: quizCount }, (_, i) => (ids.length ? ids[i % ids.length] : undefined));
  const quiz: QuizSlotV1[] = Array.from({ length: quizCount }, (_, i) => ({
    questionId: `q${String(i + 1).padStart(2, "0")}`,
    requiredFactIds: quizFactBySlot[i] ? [quizFactBySlot[i] as string] : [],
    caseCueIds: dealCaseCue(packet, quizFactBySlot[i], i, usedQuizCaseCounts, { cap: MAX_CASE_CUES_PER_SURFACE, requireLink: true }),
    // correctIndex stays UNSALTED — it is pinned by answerPattern's BP14-safe deal and a
    // repair must never silently move a quiz key. quizSalt shifts only the SHAPE picks (prompt/
    // answer/distractor here; card shapes below), the redeal:quiz-slot / redeal:card-slot lever.
    correctIndex: pattern[i],
    depthLevel: quizDepth(i),
    promptShape: deal(QUIZ_PROMPT_SHAPES, "quizPromptShape", i),
    answerStyle: deal(QUIZ_ANSWER_STYLES, "quizAnswerStyle", i),
    distractorTrap: deal(QUIZ_DISTRACTOR_TRAPS, "quizDistractorTrap", i),
  }));
  assertFactIdsSubset(quiz.flatMap((q) => q.requiredFactIds), allFactIds, `chapter ${chapter.chapterNumber} quiz`);
  // ── R-127 — card fact routing: chapter-varying AND coverage-completing ────────────────
  //
  // It used to be `ids[i % ids.length]`: no chapter term at all (unlike the example dealer),
  // so card slot i taught rank-i fact in EVERY chapter of the book, and because difficulty is
  // pinned to the same index the chapter's best-ranked fact was always an "easy" card and its
  // hardest facts always "hard". With 7 cards over 10-11 ranked ids, the tail 3-4 facts of every
  // chapter reached no card at all.
  //
  // The replacement deals cards from the rank list ROTATED BY CHAPTER (so a fixed card slot sees
  // a different fact each chapter, and rank no longer implies difficulty), then runs a coverage
  // pass that places any teaching fact still mandated nowhere onto a trailing card slot.
  // Difficulty stays positional — it is a property of the SLOT, not of the fact.
  const routedElsewhere = new Set<string>([
    ...quizFactBySlot.filter((id): id is string => !!id),
    ...examples.flatMap((ex) => ex.requiredFactIds),
  ]);
  const rotatedIds = rotate([...ids], ids.length ? (n - 1) % ids.length : 0);
  const cardFacts = Array.from({ length: cardCount }, (_, i) => (rotatedIds.length ? rotatedIds[i % rotatedIds.length] : undefined));
  // Coverage pass: a teaching fact that reaches neither the quiz, an example nor a card is a fact
  // the chapter mandates nowhere. Place each such orphan on a trailing card slot, but only over a
  // fact that is still taught somewhere else — so covering one fact can never orphan another.
  const orphans = ids.filter((id) => !routedElsewhere.has(id) && !cardFacts.includes(id));
  for (let slot = cardCount - 1; slot >= 0 && orphans.length > 0; slot--) {
    const current = cardFacts[slot];
    const coveredWithoutThisSlot = !current || routedElsewhere.has(current) || cardFacts.some((id, j) => j !== slot && id === current);
    if (!coveredWithoutThisSlot) continue;
    cardFacts[slot] = orphans.shift();
  }
  const cards: CardSlotV1[] = Array.from({ length: cardCount }, (_, i) => ({
    cardId: `rc${String(i + 1).padStart(2, "0")}`,
    requiredFactIds: cardFacts[i] ? [cardFacts[i] as string] : [],
    caseCueIds: dealCaseCue(packet, cardFacts[i], i, usedCardCaseCounts, { cap: MAX_CASE_CUES_PER_SURFACE, requireLink: true }),
    difficulty: i < 2 ? "easy" : i < 5 ? "medium" : "hard",
    frontShape: deal(CARD_FRONT_SHAPES, "cardFrontShape", i),
    retrievalTarget: deal(CARD_RETRIEVAL_TARGETS, "cardRetrievalTarget", i),
    backShape: deal(CARD_BACK_SHAPES, "cardBackShape", i),
  }));
  const actionMechanism = deal(pools.actionMechanisms, "actionMechanism", 0);
  const weeklyPracticeForm = deal(pools.weeklyForms, "weeklyPracticeForm", 0);
  const practiceForm = deal(pools.practiceForms, "practiceForm", 0);
  const exampleFormats = Array.from({ length: exampleCount }, (_, i) => deal(EXAMPLE_FORMATS, "exampleFormat", i));
  const plan = buildPlan(chapter, packet, examples, quizCount, cardCount, exampleFormats);
  const hookShape = deal(HOOK_SHAPES, "hookShape", 0);
  // R-117 — sceneMechanism and sceneMode were `SCENE_MODES[n % 9]` and `SCENE_MODES[(n + 1) % 9]`:
  // ADJACENT members of one nine-string list handed to the writer as two different instructions
  // ("your marquee MOVE is conversation repair; your STANCE is stakes audit"). Meanwhile
  // config/scene-mechanisms.json held ten genuinely orthogonal dramatic transactions with written
  // directives, loaded by nothing on this path. The mechanism now comes from that palette and the
  // mode keeps SCENE_MODES, so the two axes are actually two axes. Both are registered deals.
  const sceneMechanism = deal(sceneMechanismDirectives(), "sceneMechanism", 0);
  const sceneMode = deal(SCENE_MODES, "reservedSceneMode", 0);
  // R-126 — the hook, the coreMove, the summaries spine and the action step all keyed the SAME
  // head of the ranked teaching list, with no rotation by chapter or by section: in all four live
  // blueprints summaries.requiredFactIds and action.requiredFactIds were byte-identical triples.
  // The spine STAYS the top-3 (that is the pedagogical claim P13 makes and it is a good one);
  // what moves is everything keyed off it — the hook rotates within the top-3 by chapter, and the
  // action step prefers mechanism facts the spine did NOT already mandate.
  const summarySpine = rankingActive ? ids.slice(0, 3) : ids.slice(0, 5);
  const hookFactIds = ids.length ? [ids.slice(0, Math.min(3, ids.length))[(n - 1) % Math.min(3, ids.length)]] : [];
  const spine = new Set(summarySpine);
  const actionFactIds = rankingActive
    ? uniq([
        ...mechanismIds.filter((id) => !spine.has(id)),
        ...ids.filter((id) => !spine.has(id)),
        ...mechanismIds,
        ...ids,
      ]).slice(0, 3)
    : ids.slice(0, 3);
  return {
    schemaVersion: CHAPTER_BLUEPRINT_SCHEMA_VERSION,
    bookId: normSlug(bookId),
    chapterId: chapter.chapterId,
    chapterNumber: chapter.chapterNumber,
    title: chapter.chapterTitle,
    sourcePacketPath: packetPath,
    sourcePacketHash: canonicalJsonSha256(packet),
    // P14: pin the blueprint to the design artifact bytes it was compiled from. Present ONLY on the
    // design path (source === "derived"); omitted on genre-fallback and legacy so those blueprints
    // stay byte-identical to the pre-P14 world (JSON.stringify drops the absent key).
    ...(pools.source === "derived" && pools.designHash ? { designHash: pools.designHash } : {}),
    plan,
    coreMove: {
      statement: plan.coreMove,
      sourceFactIds: ids.slice(0, 2),
    },
    reservedVariety: {
      allowedNames,
      forbiddenNames: forbiddenNameGuidance(packetProtectedNames, siblingNames, genreReservedNames),
      hookShape,
      counterShape: deal(COUNTER_SHAPES, "counterShape", 0),
      sceneMechanism,
      sceneMode,
      venuePalette,
      answerIndexPattern: pattern,
      actionMechanism,
      weeklyPracticeForm,
    },
    sections: {
      // R-118 — this used to be a SECOND hook deal, `n % 2 === 0 ? "reader-stakes" :
      // "concrete-moment"`, competing with the nine-shape reservedVariety.hookShape the summary
      // writer receives in the same prompt. Half the book got each of two shapes, the binary
      // escaped BPV12's pool floor entirely, and the writer was handed two different opening
      // instructions. One deal now, and BPV11/BPV12 audit it (registered as `hookShapeSection`).
      hook: { shape: hookShape, requiredFactIds: hookFactIds },
      // P13: summaries teach the top-3 SPINE facts (best ideas) when ranked; legacy packets keep
      // the historical top-5 packet-order slice so their blueprints are byte-identical.
      summaries: { fastReadTargetChars: [350, 900], deepReadTargetChars: [1000, 2200], fullReadTargetChars: [2400, 4200], requiredFactIds: summarySpine },
      examples,
      quiz,
      cards,
      action: {
        actionMechanism,
        // P13 + R-126: the top-3 MECHANISM facts the summaries spine did not already mandate
        // (padded from rank order, then from the spine itself if the chapter has too few facts
        // to avoid it). Legacy packets keep the historical top-3 packet-order slice.
        requiredFactIds: actionFactIds,
        weeklyPracticeForm,
        ifThenPlanShapes: Array.from({ length: 3 }, (_, i) => deal(IF_THEN_PLAN_SHAPES, "ifThenPlanShape", i)),
        practiceForm,
        practiceConstraint: deal(pools.practiceConstraints, "practiceConstraint", 0),
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
