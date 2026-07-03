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

export type BriefRotation = {
  openerType: OpenerType;
  challengeFrame: ChallengeFrame;
  practiceShape: PracticeShape;
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

  const openers = dealRotation(bookId, "brief-opener", OPENER_TYPES, n, openerCap);
  const frames = dealRotation(bookId, "brief-challenge-frame", CHALLENGE_FRAMES, n, frameCap);
  const shapes = dealRotation(bookId, "brief-practice-shape", PRACTICE_SHAPES, n, practiceCap);

  const out = new Map<number, BriefRotation>();
  for (let i = 0; i < n; i++) {
    out.set(i + 1, { openerType: openers[i], challengeFrame: frames[i], practiceShape: shapes[i] });
  }
  return out;
}
