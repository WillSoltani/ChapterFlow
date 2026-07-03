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
 *  v2 = the S-tier deal (exampleLenses + practiceVerb + requireFrictionExample).
 *  v3 = the STIER-2 deal (example arcs + lead thread + quiz stem/failure-mode/order
 *  deals + per-slot practice shapes + memorable shapes + limits placement +
 *  grounding form — plan docs/v24/STIER2-PLAN-2026-07-03.md §B). */
export const ROTATION_SCHEMA_VERSION = "brief-rotation-v3";

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

// ── STIER-2 (v3) pools — plan §B P10-P16. Every pool exists because the halted
// `execution` run stamped the corresponding single shape book-wide (54/54 example
// skeletons, one stem opener mold on 32% of stems, one wrongness class per book,
// "read aloud" ×4 practice slots, one aphorism mold 27/27, the same limits closer
// 9/9, one appositive grounding rhythm). Deal the shape; never name just one. ──

/** Where a worked example ENTERS the framework loop — the internal-beat rotation.
 *  The halted run entered all 54 examples at the demand and walked the full loop. */
export const EXAMPLE_ENTRY_POINTS = [
  "at-the-demand",
  "mid-behavior",
  "at-the-return-moment",
  "aftermath-looking-back",
  "outsider-arrives",
  "before-anyone-notices",
] as const;
export type ExampleEntryPoint = (typeof EXAMPLE_ENTRY_POINTS)[number];

export const ENTRY_INSTRUCTION: Record<ExampleEntryPoint, string> = {
  "at-the-demand": "open at the moment the demand/standard is stated",
  "mid-behavior": "open mid-action, demand already in the past — no setup",
  "at-the-return-moment": "open AT the check-in/return moment itself",
  "aftermath-looking-back": "open after it's over, tracing back what happened",
  "outsider-arrives": "open when someone outside the room first feels the effect",
  "before-anyone-notices": "open on the early signal nobody has flagged yet",
};

/** How the example RESOLVES. failure|partial are dealt ONLY to friction-flagged
 *  chapters (requireFrictionExample stays the master — the ×N dutiful-failure
 *  ritual stays un-stamped; grill round-2b #2 + the original round-2 #14). */
export const EXAMPLE_OUTCOMES = [
  "clean-win",
  "failure",
  "partial",
  "averted-late",
  "still-open",
] as const;
export type ExampleOutcome = (typeof EXAMPLE_OUTCOMES)[number];

export const OUTCOME_INSTRUCTION: Record<ExampleOutcome, string> = {
  "clean-win": "the move works — but earn it, show the cost paid",
  "failure": "the move is skipped or botched and the miss lands",
  "partial": "the move half-works; name what stayed broken",
  "averted-late": "headed for a miss, caught late — barely",
  "still-open": "ends unresolved; the return point is set but not yet met",
};

/** The rhetoric INSIDE the app's fixed whatToDo/whyItMatters labels (the labels are
 *  product UI, verified live — vary the register, never the schema). */
export const FIELD_STYLES = [
  "direct-imperative",
  "cost-first",
  "mechanism-first",
  "question-then-answer",
  "shortest-possible",
] as const;
export type FieldStyle = (typeof FIELD_STYLES)[number];

export const FIELD_STYLE_INSTRUCTION: Record<FieldStyle, string> = {
  "direct-imperative": "whatToDo/whyItMatters as direct commands to the reader",
  "cost-first": "lead whatToDo/whyItMatters with what skipping this costs",
  "mechanism-first": "lead with WHY it works, then the move",
  "question-then-answer": "open with the question the reader would ask, answer it",
  "shortest-possible": "make both fields the tersest in the chapter — no preamble",
};

/** One dealt row per example slot. `prop`: this slot carries ONE physical/sensory
 *  anchor (dealt to 2-3 slots per chapter — never all; the halted run's ch05
 *  "small physical props recur → scaffold smell" is the counter-lesson). */
export type ExampleArc = {
  entry: ExampleEntryPoint;
  outcome: ExampleOutcome;
  fieldStyle: FieldStyle;
  prop: boolean;
};

/** Quiz stem SHAPES (dealt 4 per chapter; shapes may repeat across the 9 stems —
 *  WORDING may not: no stem's first four words repeat another's. Pigeonhole-safe
 *  by design; grill round-2b #4). */
export const QUIZ_STEM_SHAPES = [
  "cold-diagnosis",
  "choose-next-move",
  "predict-consequence",
  "spot-the-violation",
  "best-explanation-why",
  "ordering-priority",
  "transfer-new-domain",
  "failure-postmortem",
] as const;
export type QuizStemShape = (typeof QUIZ_STEM_SHAPES)[number];

export const STEM_SHAPE_INSTRUCTION: Record<QuizStemShape, string> = {
  "cold-diagnosis": "present symptoms; ask what is actually wrong",
  "choose-next-move": "a live scenario; ask for the single best next action",
  "predict-consequence": "a choice was just made; ask what happens downstream",
  "spot-the-violation": "a plausible-looking plan; ask which principle it breaks",
  "best-explanation-why": "an outcome happened; ask WHY (mechanism, not recall)",
  "ordering-priority": "several valid actions; ask which comes FIRST and why",
  "transfer-new-domain": "the chapter's move in a non-business setting; ask what maps",
  "failure-postmortem": "it already failed; ask which earlier step was the cause",
};

/** How each DISTRACTOR is derived FROM the key (transform, never 'a bad answer').
 *  4 dealt per chapter; within one question the distractors use different modes. */
export const QUIZ_FAILURE_MODES = [
  "wrong-target",
  "wrong-timing",
  "wrong-proof",
  "wrong-scope",
  "half-measure",
  "right-move-wrong-trigger",
  "over-correction",
  "borrowed-authority",
] as const;
export type QuizFailureMode = (typeof QUIZ_FAILURE_MODES)[number];

export const FAILURE_MODE_INSTRUCTION: Record<QuizFailureMode, string> = {
  "wrong-target": "the right move aimed at the wrong person/thing",
  "wrong-timing": "the right move too early or too late",
  "wrong-proof": "accepts the wrong evidence as settling it",
  "wrong-scope": "applies the move too broadly or too narrowly",
  "half-measure": "starts the move but stops before the part that matters",
  "right-move-wrong-trigger": "correct action fired by the wrong signal",
  "over-correction": "overshoots into the opposite failure",
  "borrowed-authority": "outsources the judgment to a rank, brand, or precedent",
};

/** Memorable-line SHAPES (3 dealt per chapter — kills the one-mold aphorism:
 *  27/27 halted lines were expectation-reversing noun phrases). */
export const MEMORABLE_SHAPES = [
  "reversal",
  "redefinition",
  "cost-statement",
  "pointed-question",
  "imperative",
] as const;
export type MemorableShape = (typeof MEMORABLE_SHAPES)[number];

export const MEMORABLE_SHAPE_INSTRUCTION: Record<MemorableShape, string> = {
  reversal: "a line that flips the expected direction",
  redefinition: "redefine a familiar word on the chapter's terms",
  "cost-statement": "name the concrete price of the default behavior",
  "pointed-question": "a question sharp enough to reread",
  imperative: "a command short enough to say from memory",
};

/** Where the honest-limits paragraph LIVES (the requirement itself never moves —
 *  only its slot; the halted run closed 9/9 fullReads with the same paragraph). */
export const LIMITS_PLACEMENTS = [
  "early-aside",
  "inside-a-failing-example",
  "closing-paragraph",
] as const;
export type LimitsPlacement = (typeof LIMITS_PLACEMENTS)[number];

export const LIMITS_INSTRUCTION: Record<LimitsPlacement, string> = {
  "early-aside": "put the limits/when-NOT-to paragraph EARLY in the deep read, as an aside — do not save it for the ending",
  "inside-a-failing-example": "let a failing/partial example CARRY the limits — show where the move breaks instead of appending a warning paragraph",
  "closing-paragraph": "close the full read with the limits paragraph (the classic slot — fine here, other chapters own other slots)",
};

/** First-mention grounding FORM for real companies/events (one dealt primary form
 *  per chapter — a single appositive rhythm ×9 is the next stamp; grill 2b #14). */
export const GROUNDING_FORMS = [
  "appositive",
  "prior-sentence-setup",
  "parenthetical-era-role",
] as const;
export type GroundingForm = (typeof GROUNDING_FORMS)[number];

export const GROUNDING_INSTRUCTION: Record<GroundingForm, string> = {
  appositive: "ground anchors with a short appositive — 'Session C, GE's talent review, …'",
  "prior-sentence-setup": "spend the SENTENCE BEFORE the anchor setting it up in plain words",
  "parenthetical-era-role": "ground anchors with a parenthetical era/role — '(GE's 1990s operating review)'",
};

/** Jittered distinct-entry floor per chapter ∈ {2,3,4} — the coverage PROFILE is
 *  itself dealt so nine chapters don't share one variety fingerprint
 *  ("homogeneous heterogeneity", grill round-2a #3). Pure. */
export function dealEntryFloor(bookId: string, chapterIdx: number): number {
  return 2 + ((fnv1a(`${normSlug(bookId)}:brief-entry-floor`) + chapterIdx) % 3);
}

/** Dealt example COUNT per chapter ∈ {4,5,6} (schema-legal; gates tolerate ≥4).
 *  The fixed six was itself reader-named ("Six examples teach the same move…"). */
export function dealExampleCounts(bookId: string, totalChapters: number): number[] {
  const n = Math.max(0, totalChapters);
  const start = fnv1a(`${normSlug(bookId)}:brief-example-count`);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(4 + ((start + i * 2) % 3));
  return out;
}

/** Deal each chapter's example ARC rows. Deterministic, pure, packet-blind.
 *  Guarantees BY CONSTRUCTION (the writer never counts):
 *   - row count == dealExampleCounts[i];
 *   - ≥ dealEntryFloor distinct entry points (pool walk with advancing offset);
 *   - friction chapters get ≥1 failure|partial outcome; non-friction chapters get
 *     NONE dealt (organic friction stays legal — dealt-absence is not a ban);
 *   - ≥ min(3, count) distinct outcomes within the chapter's legal outcome pool;
 *   - ≥ min(4, count) distinct fieldStyles;
 *   - exactly 2-3 prop slots (never 0, never all). */
export function dealExampleArcs(
  bookId: string,
  totalChapters: number,
  frictionFlags: boolean[],
  counts?: number[],
): ExampleArc[][] {
  const n = Math.max(0, totalChapters);
  if (n === 0) return [];
  const slug = normSlug(bookId);
  const exampleCounts = counts ?? dealExampleCounts(bookId, n);

  const rotate = <T,>(pool: readonly T[], namespace: string): T[] => {
    const start = fnv1a(`${slug}:${namespace}`) % pool.length;
    const out: T[] = [];
    for (let i = 0; i < pool.length; i++) out.push(pool[(start + i) % pool.length]);
    return out;
  };
  const entries = rotate(EXAMPLE_ENTRY_POINTS, "brief-example-entry");
  const styles = rotate(FIELD_STYLES, "brief-field-style");
  const frictionOutcomes: ExampleOutcome[] = ["failure", "partial"];
  const calmOutcomes: ExampleOutcome[] = ["clean-win", "averted-late", "still-open"];

  const result: ExampleArc[][] = [];
  for (let c = 0; c < n; c++) {
    const count = Math.min(6, Math.max(4, exampleCounts[c] ?? 6));
    const friction = frictionFlags[c] ?? true;
    const floor = Math.min(dealEntryFloor(bookId, c), count);

    // Entries: advancing-offset walk (distinct until the pool cycles), then
    // enforce the jittered floor by swapping tail repeats for unused entries.
    const entryOffset = (c * 3) % entries.length;
    const rowEntries: ExampleEntryPoint[] = [];
    for (let k = 0; k < count; k++) rowEntries.push(entries[(entryOffset + k) % entries.length]);
    const distinct = new Set(rowEntries);
    if (distinct.size < floor) {
      const unused = entries.filter((e) => !distinct.has(e));
      for (let k = count - 1; k >= 0 && new Set(rowEntries).size < floor && unused.length > 0; k--) {
        const seenBefore = rowEntries.slice(0, k).includes(rowEntries[k]);
        if (seenBefore) rowEntries[k] = unused.shift()!;
      }
    }

    // Outcomes: friction chapters seed one failure|partial (position rotates);
    // remaining slots walk the calm pool; distinct floor min(3, count) inside the
    // chapter's LEGAL pool (calm pool alone has exactly 3 classes).
    const rowOutcomes: ExampleOutcome[] = new Array(count);
    const calmOffset = (fnv1a(`${slug}:brief-example-outcome`) + c) % calmOutcomes.length;
    for (let k = 0; k < count; k++) rowOutcomes[k] = calmOutcomes[(calmOffset + k) % calmOutcomes.length];
    if (friction) {
      const fSlot = (fnv1a(`${slug}:brief-friction-slot`) + c) % count;
      rowOutcomes[fSlot] = frictionOutcomes[(fnv1a(`${slug}:brief-friction-kind`) + c) % frictionOutcomes.length];
    }

    // Field styles: advancing-offset walk over the 5-pool — ≥min(4,count) distinct.
    const styleOffset = (c * 2) % styles.length;
    const rowStyles: FieldStyle[] = [];
    for (let k = 0; k < count; k++) rowStyles.push(styles[(styleOffset + k) % styles.length]);

    // Prop slots: 2 + jitter (never 0, never all 4-6), spread from a rotating start.
    const propCount = 2 + ((fnv1a(`${slug}:brief-prop-count`) + c) % 2);
    const propStart = (fnv1a(`${slug}:brief-prop-slot`) + c) % count;
    const props = new Array<boolean>(count).fill(false);
    for (let k = 0; k < propCount; k++) props[(propStart + k * 2) % count] = true;

    const rows: ExampleArc[] = [];
    for (let k = 0; k < count; k++) {
      rows.push({ entry: rowEntries[k], outcome: rowOutcomes[k], fieldStyle: rowStyles[k], prop: props[k] });
    }
    result.push(rows);
  }
  return result;
}

/** Deal K DISTINCT members per chapter from a pool with an advancing offset —
 *  the dealLensTriples pattern, generalized (pure). */
export function dealDistinctSet<T>(
  bookId: string,
  namespace: string,
  pool: readonly T[],
  totalChapters: number,
  k: number,
  stride = 3,
): T[][] {
  const n = Math.max(0, totalChapters);
  if (n === 0) return [];
  const slug = normSlug(bookId);
  const start = fnv1a(`${slug}:${namespace}`) % pool.length;
  const rotated: T[] = [];
  for (let i = 0; i < pool.length; i++) rotated.push(pool[(start + i) % pool.length]);
  const result: T[][] = [];
  for (let c = 0; c < n; c++) {
    const offset = (c * stride) % rotated.length;
    const set: T[] = [];
    for (let i = 0; i < rotated.length && set.length < Math.min(k, rotated.length); i++) {
      const cand = rotated[(offset + i) % rotated.length];
      if (!set.includes(cand)) set.push(cand);
    }
    result.push(set);
  }
  return result;
}

/** Dealt fact→question order: a permutation of 1..9 per chapter (the halted run's
 *  questions marched 1:1 in packet-fact order — a predictable spine; grill 2a #6).
 *  Deterministic Fisher-Yates over an fnv1a-seeded LCG. Pure. */
export function dealQuestionFactOrder(bookId: string, totalChapters: number): number[][] {
  const n = Math.max(0, totalChapters);
  const result: number[][] = [];
  for (let c = 0; c < n; c++) {
    let seed = fnv1a(`${normSlug(bookId)}:brief-question-order:ch${c + 1}`) || 1;
    const next = () => {
      // LCG (Numerical Recipes constants), deterministic across platforms.
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    const perm = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = perm.length - 1; i > 0; i--) {
      const j = next() % (i + 1);
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    result.push(perm);
  }
  return result;
}

/** Dealt lead-thread PREFERENCE: ~half the chapters prefer a REAL packet-attested
 *  person as the section-thread lead (the invented-proxy-cast device was universal
 *  9/9 — the stamp the acceptance readers list FIRST). The compile step resolves
 *  preference → actual lead (real only when the packet carries a scene-able
 *  person; invented cast[0] otherwise). Pure, packet-blind here. */
export function dealLeadPreference(bookId: string, totalChapters: number): boolean[] {
  const n = Math.max(0, totalChapters);
  const start = fnv1a(`${normSlug(bookId)}:brief-lead-kind`) % 2;
  const flags: boolean[] = [];
  for (let i = 0; i < n; i++) flags.push((i + start) % 2 === 0);
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
  /** STIER-2 P10: dealt example count ∈ {4,5,6}. */
  exampleCount: number;
  /** STIER-2 P10: one dealt (entry, outcome, fieldStyle, prop) row per example slot. */
  exampleArcs: ExampleArc[];
  /** STIER-2 P13: DISTINCT shapes for the four practice surfaces, in order
   *  [tryThisNow, 24h-challenge, weekly-practice, if-then-contexts]. Slot 0 always
   *  equals the legacy practiceShape field. */
  practiceSlotShapes: PracticeShape[];
  /** STIER-2 P12: the four stem shapes this chapter's 9 questions draw from. */
  quizStemShapes: QuizStemShape[];
  /** STIER-2 P12: the four distractor failure modes dealt to this chapter. */
  quizFailureModes: QuizFailureMode[];
  /** STIER-2 P12: dealt fact→question order (permutation of 1..9). */
  questionFactOrder: number[];
  /** STIER-2 P14: the three memorable-line shapes dealt to this chapter. */
  memorableShapes: MemorableShape[];
  /** STIER-2 P15: where the honest-limits paragraph lives in THIS chapter. */
  limitsPlacement: LimitsPlacement;
  /** STIER-2 P16: the chapter's primary first-mention grounding form. */
  groundingForm: GroundingForm;
  /** STIER-2 P11: prefer a REAL packet-attested person as the section-thread lead
   *  (compile resolves availability; invented cast[0] otherwise). */
  leadPreferReal: boolean;
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

  // STIER-2 (v3) deals — plan §B. All pure/deterministic like the rest.
  const counts = dealExampleCounts(bookId, n);
  const arcs = dealExampleArcs(bookId, n, frictions, counts);
  const slotSets = dealDistinctSet(bookId, "brief-practice-slot", PRACTICE_SHAPES, n, 4, 2);
  const stems = dealDistinctSet(bookId, "brief-quiz-stem", QUIZ_STEM_SHAPES, n, 4, 3);
  const modes = dealDistinctSet(bookId, "brief-quiz-failure-mode", QUIZ_FAILURE_MODES, n, 4, 3);
  const orders = dealQuestionFactOrder(bookId, n);
  const memShapes = dealDistinctSet(bookId, "brief-memorable-shape", MEMORABLE_SHAPES, n, 3, 2);
  const limits = dealRotation(bookId, "brief-limits-placement", LIMITS_PLACEMENTS, n, twoThirdsCap(n));
  const groundings = dealRotation(bookId, "brief-grounding-form", GROUNDING_FORMS, n, twoThirdsCap(n));
  const leadPrefs = dealLeadPreference(bookId, n);

  const out = new Map<number, BriefRotation>();
  for (let i = 0; i < n; i++) {
    // The four practice surfaces get DISTINCT shapes; slot 0 stays the legacy
    // dealt practiceShape so tryThisNow's shape is stable for v2 consumers.
    const slots = [shapes[i], ...slotSets[i].filter((s) => s !== shapes[i])].slice(0, 4);
    for (const s of PRACTICE_SHAPES) {
      if (slots.length >= 4) break;
      if (!slots.includes(s)) slots.push(s);
    }
    out.set(i + 1, {
      openerType: openers[i],
      challengeFrame: frames[i],
      practiceShape: shapes[i],
      exampleLenses: lenses[i],
      practiceVerb: verbs[i],
      requireFrictionExample: frictions[i],
      exampleCount: counts[i],
      exampleArcs: arcs[i],
      practiceSlotShapes: slots,
      quizStemShapes: stems[i],
      quizFailureModes: modes[i],
      questionFactOrder: orders[i],
      memorableShapes: memShapes[i],
      limitsPlacement: limits[i],
      groundingForm: groundings[i],
      leadPreferReal: leadPrefs[i],
    });
  }
  return out;
}
