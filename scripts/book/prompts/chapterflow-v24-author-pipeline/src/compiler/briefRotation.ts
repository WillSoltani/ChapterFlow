/**
 * v24 W4 — brief-level variety ROTATION (the prevention lever for content
 * residuals; readerBudgets CHB6–CHB9 are the write-time backstop).
 *
 * The published the-power-of-moments v24 shipped MORE templated on scaffolding
 * than the prior book: 10/12 chapters share ONE 24-hour-challenge skeleton
 * ("In/Within the next 24 hours…"), hooks are claim-type 10/12, fastRead
 * openers claim-type 11/12, tryThisNow starts "Pick…" 6/12. Readers named the
 * "sameness of section architecture / example cadence" directly. The chapter
 * brief already deals HARD reservations (cases, cast, quiz key) that make
 * cross-chapter collisions structurally impossible; this module extends that
 * dealer to the three residual monocultures by RESERVING, per chapter:
 *
 *   openerType     — the hook/fastRead opening MODE, rotated across
 *                    {question, scene, claim, statistic} so no single type
 *                    lands on more than ceil(2/3·N) chapters and adjacent
 *                    chapters differ where the caps allow.
 *   challengeFrame — a distinct framing for the 24-hour challenge, dealt
 *                    no-repeat from a pool of ≥8 frames (see CHALLENGE_FRAMES)
 *                    so the "In the next 24 hours," stem cannot recur.
 *   practiceShape  — the tryThisNow STRUCTURE, rotated from a pool so the
 *                    "Pick one …" menu opener cannot dominate.
 *
 * Everything here is DETERMINISTIC (fnv1a-seeded, dealt in ascending chapter
 * order — no Math.random), so a brief compiled twice is byte-identical and a
 * regenerated single chapter lands the same reservation it had before.
 *
 * ── DESIGN OF THE POOLS ──
 * openerType: the four opener classes the CHB6 regex classifier recognizes.
 *   Rotation cap = ceil(2/3·N) (same "no class on more than two-thirds of
 *   chapters" budget CHB6 enforces), so the deal can never itself produce a
 *   brief-set that CHB6 would then block.
 * challengeFrame (≥8 frames, no-repeat until the pool is exhausted): each is a
 *   concrete alternative to the "In the next 24 hours," stem — a DIFFERENT
 *   trigger/action shape, not a synonym spin:
 *     before-your-next-X       — attach the action to the next occurrence of a
 *                                 recurring event ("Before your next handoff…").
 *     replace-one-Y            — swap one existing habit/artifact for the taught
 *                                 one ("Replace one status update with…").
 *     script-one-sentence      — pre-write the exact words to say once.
 *     timebox-N-minutes        — do it inside a named minute budget.
 *     audit-one-artifact       — inspect one existing thing for the pattern.
 *     teach-it-to-someone      — explain the move to one other person.
 *     pre-write-the-exact-line — draft the precise line before the moment.
 *     attach-to-existing-routine — bolt the action onto a routine already in place.
 *   When N exceeds the pool size the deal WRAPS (a frame may recur) — CHB7's
 *   scaffold-family budget (no first-4-words family on more than ceil(1/3·N)
 *   chapters) is the backstop that still catches over-concentration, and the
 *   brief gate's BR7 rotation cap allows a wrapped frame only up to that same
 *   ceil(1/3·N) share.
 * practiceShape (≥6 shapes, rotated with the same two-thirds cap as openerType):
 *   distinct tryThisNow STRUCTURES so the "Pick one …" opener cannot dominate:
 *     single-imperative        — one direct command, no menu.
 *     if-then-trigger          — "When X happens, do Y."
 *     two-step-sequence        — do A, then B.
 *     observe-then-note        — watch one thing, then record it.
 *     say-aloud-script         — say a specific sentence out loud.
 *     measure-one-number       — capture one concrete number.
 */

import { fnv1a } from "../lib/fnv1a.js";
import { normSlug } from "../lib/chapterPaths.js";

/** Bumped whenever the SET of dealt rotation fields changes — part of the regen-cap
 *  lineage hash, so a rotation redesign re-keys chapters' write budgets honestly.
 *  v2 = the S-tier deal (exampleLenses + practiceVerb + requireFrictionExample). */
export const ROTATION_SCHEMA_VERSION = "brief-rotation-v2";

export const OPENER_TYPES = ["question", "scene", "claim", "statistic"] as const;
export type OpenerType = (typeof OPENER_TYPES)[number];

export const CHALLENGE_FRAMES = [
  "before-your-next-X",
  "replace-one-Y",
  "script-one-sentence",
  "timebox-N-minutes",
  "audit-one-artifact",
  "teach-it-to-someone",
  "pre-write-the-exact-line",
  "attach-to-existing-routine",
] as const;
export type ChallengeFrame = (typeof CHALLENGE_FRAMES)[number];

export const PRACTICE_SHAPES = [
  "single-imperative",
  "if-then-trigger",
  "two-step-sequence",
  "observe-then-note",
  "say-aloud-script",
  "measure-one-number",
] as const;
export type PracticeShape = (typeof PRACTICE_SHAPES)[number];

/**
 * v24 S-tier P2 — example DRAMATURGY lenses. The halted `execution` run shipped
 * 54/54 examples in ONE class (named proxy + prop gesture + business document +
 * meeting furniture) and the acceptance readers named the "same named-proxy
 * scenes… same skeleton" directly. Each chapter is dealt THREE lenses; its 6
 * examples must cover all three, with the house default (prop-tableau) capped
 * at 2 scenes per chapter by the card instruction. Lens instructions carry
 * their own fabrication guardrails (dialogue only for invented proxy
 * characters; counterfactuals framed as reasoning, never as events) because a
 * dramaturgy that invites invented quotes from real people would trade churn
 * for an EW1 invented-witness defect.
 */
export const EXAMPLE_LENSES = [
  "prop-tableau",
  "dialogue-beat",
  "before-after-ledger",
  "postmortem",
  "walkthrough",
  "counterfactual",
  "outsider-witness",
  "numbers-detective",
] as const;
export type ExampleLens = (typeof EXAMPLE_LENSES)[number];

export const LENS_INSTRUCTION: Record<ExampleLens, string> = {
  "prop-tableau": "a person mid-moment with one physical artifact (the classic scene — use it, but in AT MOST 2 of your 6 examples).",
  "dialogue-beat": "a short spoken exchange carries the turn. Quoted lines ONLY from your invented cast; real source people are paraphrased, never given invented quotes.",
  "before-after-ledger": "show the same numbers or facts BEFORE and AFTER the move — the delta is the story.",
  "postmortem": "a past-tense autopsy: the decision already played out; trace why it went the way it went.",
  "walkthrough": "a step-by-step trace of someone applying the move, decision by decision.",
  "counterfactual": "reason out loud what would have followed WITHOUT the move — framed explicitly as reasoning ('had they not…'), never narrated as events that happened.",
  "outsider-witness": "the scene through the eyes of someone downstream — a customer, a junior, a partner — who feels the consequences without attending the meeting.",
  "numbers-detective": "start from one number or fact that does not add up, and trace it back to the cause.",
};

/** v24 S-tier P4 — practice VERB registers. The halted run opened practice items
 *  with "touch the …" on 5/9 chapters and "Open …" on 5/9 — mid-sentence tics
 *  that the first-4-words scaffold family cannot see. One dealt verb register
 *  per chapter keeps the physical-action vocabulary from saturating book-wide. */
export const PRACTICE_VERBS = [
  "write",
  "say",
  "mark",
  "count",
  "ask",
  "circle",
  "schedule",
  "read-aloud",
  "cross-out",
  "move",
] as const;
export type PracticeVerb = (typeof PRACTICE_VERBS)[number];

/** Human, one-line writer instruction for each opener type — rendered verbatim
 *  into the brief md so the writer gets an EXPLICIT mode, not a label. */
export const OPENER_INSTRUCTION: Record<OpenerType, string> = {
  question: "Open the hook with a QUESTION the reader can't answer yet.",
  scene: "Open the hook with a SCENE — a specific person mid-moment, no thesis first.",
  claim: "Open the hook with a flat CLAIM that sounds wrong until the chapter proves it.",
  statistic: "Open the hook with a concrete NUMBER or measured result, then the stakes.",
};

export const PRACTICE_INSTRUCTION: Record<PracticeShape, string> = {
  "single-imperative": "Shape tryThisNow as ONE direct command — no 'Pick one…' menu, no a/b/or-c options.",
  "if-then-trigger": "Shape tryThisNow as an if-then trigger: 'When X happens, do Y.'",
  "two-step-sequence": "Shape tryThisNow as a two-step sequence: do A, then do B.",
  "observe-then-note": "Shape tryThisNow as observe-then-note: watch one specific thing, then write down what you saw.",
  "say-aloud-script": "Shape tryThisNow around a say-aloud script: give the exact sentence to say out loud.",
  "measure-one-number": "Shape tryThisNow around one measurement: capture a single concrete number.",
};

/** The challenge-frame instruction ALWAYS bans the "In the next 24 hours," stem
 *  and states the concrete alternative framing. */
export const CHALLENGE_INSTRUCTION: Record<ChallengeFrame, string> = {
  "before-your-next-X": "attach it to the reader's NEXT occurrence of a recurring event — 'Before your next <event>, …'",
  "replace-one-Y": "have the reader SWAP one existing habit or artifact for the taught move — 'Replace one <thing> with …'",
  "script-one-sentence": "have the reader pre-write ONE exact sentence to say or send.",
  "timebox-N-minutes": "give a named MINUTE budget — 'Spend <N> minutes …' — not a 24-hour window.",
  "audit-one-artifact": "have the reader AUDIT one existing artifact for the chapter's pattern.",
  "teach-it-to-someone": "have the reader TEACH the move to one other person in their own words.",
  "pre-write-the-exact-line": "have the reader DRAFT the precise line they will use, before the moment arrives.",
  "attach-to-existing-routine": "BOLT the action onto a routine already in the reader's day — name the routine.",
};

/** ceil(2/3 · N) — the "no type on more than two-thirds of chapters" cap CHB6
 *  enforces; the opener/practice deals honor it so they can never mint a
 *  brief-set CHB6 would block. */
export function twoThirdsCap(totalChapters: number): number {
  return Math.ceil((2 * Math.max(1, totalChapters)) / 3);
}

/** ceil(1/3 · N) — the scaffold-family spread cap CHB7 enforces and the cap a
 *  WRAPPED challengeFrame is allowed up to when N exceeds the pool. */
export function oneThirdCap(totalChapters: number): number {
  return Math.ceil(Math.max(1, totalChapters) / 3);
}

/** Deterministic rotation deal: walk chapters 1..N in order, giving each the
 *  next pool member (fnv1a-rotated per book) that (a) has not hit `perItemCap`
 *  and (b) differs from the previous chapter's pick when any legal alternative
 *  exists. Returns index i → pool member for chapters 1..N. Pure. */
export function dealRotation<T>(
  bookId: string,
  namespace: string,
  pool: readonly T[],
  totalChapters: number,
  perItemCap: number,
): T[] {
  const n = Math.max(0, totalChapters);
  if (pool.length === 0 || n === 0) return [];
  const start = fnv1a(`${normSlug(bookId)}:${namespace}`) % pool.length;
  const rotated: T[] = [];
  for (let i = 0; i < pool.length; i++) rotated.push(pool[(start + i) % pool.length]);

  const counts = new Map<T, number>();
  const result: T[] = [];
  for (let chapter = 0; chapter < n; chapter++) {
    const prev = chapter > 0 ? result[chapter - 1] : undefined;
    // Walk the rotated pool from a per-chapter offset so the deal advances even
    // when caps aren't binding, giving an even, adjacent-differing spread.
    const offset = chapter % rotated.length;
    let choice: T | undefined;
    let fallbackUnderCap: T | undefined; // under-cap but equals prev (last resort before over-cap)
    let anyFallback: T | undefined; // absolute last resort (all at cap)
    for (let k = 0; k < rotated.length; k++) {
      const cand = rotated[(offset + k) % rotated.length];
      if (anyFallback === undefined) anyFallback = cand;
      const underCap = (counts.get(cand) ?? 0) < perItemCap;
      if (!underCap) continue;
      if (fallbackUnderCap === undefined) fallbackUnderCap = cand;
      if (cand !== prev) { choice = cand; break; }
    }
    const picked = choice ?? fallbackUnderCap ?? anyFallback!;
    counts.set(picked, (counts.get(picked) ?? 0) + 1);
    result.push(picked);
  }
  return result;
}

/** Deal each chapter a TRIPLE of distinct example lenses. Same determinism
 *  contract as dealRotation (fnv1a-seeded, ascending walk, pure): per chapter,
 *  walk the rotated pool from an advancing offset picking 3 DISTINCT lenses,
 *  each under the global two-thirds cap where possible (cap relaxes only when
 *  every lens is at cap — 8×cap ≥ 3N for every real book size, so in practice
 *  the cap binds, never breaks). Adjacent chapters start from different
 *  offsets, so triples shift chapter to chapter. */
export function dealLensTriples(bookId: string, totalChapters: number): ExampleLens[][] {
  const n = Math.max(0, totalChapters);
  if (n === 0) return [];
  const cap = twoThirdsCap(n);
  const start = fnv1a(`${normSlug(bookId)}:brief-example-lens`) % EXAMPLE_LENSES.length;
  const rotated: ExampleLens[] = [];
  for (let i = 0; i < EXAMPLE_LENSES.length; i++) rotated.push(EXAMPLE_LENSES[(start + i) % EXAMPLE_LENSES.length]);
  const counts = new Map<ExampleLens, number>();
  const result: ExampleLens[][] = [];
  for (let chapter = 0; chapter < n; chapter++) {
    // Advance 3 per chapter so consecutive chapters' triples are offset, not nested.
    const offset = (chapter * 3) % rotated.length;
    const triple: ExampleLens[] = [];
    for (let k = 0; k < rotated.length && triple.length < 3; k++) {
      const cand = rotated[(offset + k) % rotated.length];
      if (triple.includes(cand)) continue;
      if ((counts.get(cand) ?? 0) >= cap) continue;
      triple.push(cand);
    }
    // All-at-cap fallback (unreachable for 4..30-chapter books; kept for purity).
    for (let k = 0; triple.length < 3 && k < rotated.length; k++) {
      const cand = rotated[(offset + k) % rotated.length];
      if (!triple.includes(cand)) triple.push(cand);
    }
    for (const lens of triple) counts.set(lens, (counts.get(lens) ?? 0) + 1);
    result.push(triple);
  }
  return result;
}

/** Deal the friction-example requirement to all but min(3, floor(N/3)) chapters —
 *  enough that ANY 4-chapter acceptance sample contains at least one marked chapter
 *  (unmarked < 4), without stamping the requirement on every chapter (a dutiful
 *  failure-example ×N is the next detectable ritual — adversarial round-2 #14).
 *  Unmarked chapters are spread every-third from an fnv1a-seeded start. Pure. */
export function dealFrictionFlags(bookId: string, totalChapters: number): boolean[] {
  const n = Math.max(0, totalChapters);
  if (n === 0) return [];
  const excludeCount = Math.min(3, Math.floor(n / 3));
  const start = fnv1a(`${normSlug(bookId)}:brief-friction-example`) % n;
  const flags = new Array<boolean>(n).fill(true);
  for (let k = 0; k < excludeCount; k++) flags[(start + k * 3) % n] = false;
  return flags;
}

export type BriefRotation = {
  openerType: OpenerType;
  challengeFrame: ChallengeFrame;
  practiceShape: PracticeShape;
  /** v24 S-tier P2: the three dramaturgy lenses this chapter's 6 examples must cover. */
  exampleLenses: ExampleLens[];
  /** v24 S-tier P4: the physical-action verb register for practice items. */
  practiceVerb: PracticeVerb;
  /** v24 S-tier P2 (#14): whether THIS chapter must include a failed/partial-outcome
   *  example (dealt to ~2/3 of chapters so any 4-chapter sample sees one). */
  requireFrictionExample: boolean;
};

/** Deal all three rotations for a book and return them keyed by 1-based chapter
 *  number. openerType/practiceShape use the two-thirds cap; challengeFrame uses
 *  a no-repeat cap of 1 until the pool is exhausted, then the one-third cap on
 *  wrap (so a wrapped frame still respects CHB7/BR7's spread ceiling). */
export function dealBriefRotations(bookId: string, totalChapters: number): Map<number, BriefRotation> {
  const n = Math.max(0, totalChapters);
  const openerCap = twoThirdsCap(n);
  const practiceCap = twoThirdsCap(n);
  // no-repeat until the pool is exhausted; on wrap, allow up to the one-third
  // spread ceiling (never below 1, so a short book still deals cleanly).
  const frameCap = n <= CHALLENGE_FRAMES.length ? 1 : Math.max(1, oneThirdCap(n));

  // Practice-verb registers: no-repeat until the pool is exhausted, then the
  // one-third spread ceiling on wrap (same policy as challengeFrame).
  const verbCap = n <= PRACTICE_VERBS.length ? 1 : Math.max(1, oneThirdCap(n));

  const openers = dealRotation(bookId, "brief-opener", OPENER_TYPES, n, openerCap);
  const frames = dealRotation(bookId, "brief-challenge-frame", CHALLENGE_FRAMES, n, frameCap);
  const shapes = dealRotation(bookId, "brief-practice-shape", PRACTICE_SHAPES, n, practiceCap);
  const lenses = dealLensTriples(bookId, n);
  const verbs = dealRotation(bookId, "brief-practice-verb", PRACTICE_VERBS, n, verbCap);
  const frictions = dealFrictionFlags(bookId, n);

  const out = new Map<number, BriefRotation>();
  for (let i = 0; i < n; i++) {
    out.set(i + 1, {
      openerType: openers[i],
      challengeFrame: frames[i],
      practiceShape: shapes[i],
      exampleLenses: lenses[i],
      practiceVerb: verbs[i],
      requireFrictionExample: frictions[i],
    });
  }
  return out;
}
