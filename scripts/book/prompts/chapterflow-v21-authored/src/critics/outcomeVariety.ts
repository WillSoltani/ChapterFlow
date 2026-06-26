/**
 * Outcome-variety critic (C28) — a chapter whose every example resolves in clean,
 * instant success reads as survivorship gloss.
 *
 * THE DEFECT. Across a chapter's example slate, every scene wins on the first
 * try: the email "closes on Friday", the manager "approves that afternoon", the
 * habit "sticks within a week". No scene shows a failed first attempt, a relapse,
 * a setback, or a cost — and no outcome stays partial. A reader who then tries the
 * move and does NOT succeed instantly is left feeling like the failure, because
 * the book quietly taught that the method always works the first time.
 *
 * EXISTING. C1–C3 / sceneConcreteness (C26) validate scene STRUCTURE and staging
 * — that a scenario is a grounded, concrete human moment. None of them look at the
 * OUTCOME of the scene. A perfectly concrete, well-staged scene can still resolve
 * in frictionless instant success, and nothing flagged it until now.
 *
 * THE DISCRIMINATOR. C28 fires on a chapter only when BOTH hold:
 *   (1) the chapter carries enough examples to reasonably expect variety
 *       (≥ MIN_EXAMPLES), AND
 *   (2) ZERO of those examples carry an OUTCOME signal — none uses a
 *       friction-bearing `format` (`mistake_recovery` / `postmortem`), and none of
 *       the reader-facing prose (scenario + whyItMatters) carries a failure,
 *       relapse, setback, cost, conflict, or partial-outcome cue (this is the
 *       `before_after`-with-cost case generalized to every format).
 * Condition (2) is the gold false-positive guard, mirroring C26's grounding guard.
 * The reference books and the synthetic gold corpus are saturated with friction
 * vocabulary in their scenarios (a record "conflicts" with the signed note, "drift"
 * becomes an "expensive rework cycle", a charge is "challenged") so they never trip
 * C28. A genuinely all-success regen chapter matches NONE of it, so it does.
 *
 * SEVERITY: MINOR (advisory, shadow). This is a STRENGTHEN signal that surfaces as
 * QC debt; the gating judgment on outcome realism stays with the semantic bar
 * (WT-E). A chapter-level property — one finding per chapter, never per example.
 * Calibrated ZERO-FP on the gold corpus — see tests/outcome-variety.test.ts.
 */

import { ChapterV21, CriticFinding, ExampleV21 } from "../types.js";
import { finding, truncate } from "./shared.js";

// ── (1) Friction-bearing formats ─────────────────────────────────────────────
// Formats whose very name promises a non-clean outcome: a recovery from a mistake,
// or an analysis of what went wrong. An example in one of these carries outcome
// friction by construction, independent of its prose.
const FRICTION_FORMATS = new Set(["mistake_recovery", "postmortem"]);

// ── (2) Outcome-friction prose signal ────────────────────────────────────────
// Failure, relapse, setback, cost, conflict, and partial-outcome vocabulary. An
// example whose reader-facing prose carries ANY of these is NOT a clean instant
// win, so it grounds the chapter and C28 cannot fire on it. Generous by design:
// more friction vocabulary means fewer false positives, and it cannot suppress a
// true positive because an all-success scene matches NONE of it. Deliberately
// EXCLUDES very common, weakly-friction words ("again", "slow", "fix", "hard")
// whose presence in ordinary prose would make the gate fire on nothing.
const FRICTION_RE = new RegExp(
  "\\b(?:" +
    // failure & error
    "fail(?:s|ed|ing|ure|ures)?|mistakes?|mistaken|misstep|blunders?|" +
    "errors?|wrong|flaws?|flawed|faults?|botched|misfir(?:e|ed|es)|backfir(?:e|ed|es)|" +
    "broke|broken|breaks\\s+down|" +
    // relapse & slip
    "relapse[ds]?|slips?|slipped|slipping|laps(?:e|ed|es)|backslid(?:e|es)?|" +
    "regress(?:ed|es|ion)?|derail(?:s|ed)?|stumbl(?:e|ed|es)|fell\\s+off|falls?\\s+off|" +
    // setback & cost
    "setbacks?|costs?|costly|expensive|painful|penalt(?:y|ies)|price|" +
    "los(?:e|es|ing|t|ses?)|sacrific(?:e|ed|es)|expenses?|damag(?:e|ed|es)|" +
    "suffer(?:s|ed|ing)?|" +
    // partial & stalled
    "partial(?:ly)?|incomplete|unfinished|halfway|fell\\s+short|falls?\\s+short|" +
    "short\\s+of|not\\s+enough|stall(?:s|ed)?|plateau(?:s|ed)?|" +
    "struggl(?:e|ed|es|ing)|" +
    // conflict & friction
    "conflict(?:s|ing)?|mismatch(?:es|ed)?|discrepanc(?:y|ies)|" +
    "disagree(?:s|d|ment)?|disput(?:e|ed|es)|drift(?:s|ed|ing)?|gaps?|missing|" +
    "vanish(?:es|ed)?|tension|pushback|resist(?:s|ed|ance)?|friction|" +
    "reject(?:s|ed|ion)?|denied|refus(?:e|ed|es|al)|challeng(?:e|ed|es)|competing|" +
    // remediation (you repair / rework / correct a problem)
    "repair(?:s|ed)?|reworks?|reworked|correct(?:s|ed|ion|ions)?|do-?over|restart(?:s|ed)?|" +
    // emotional cost
    "frustrat(?:ed|ion|ing)|anxious|anxiety|embarrass(?:ed|ing|ment)?|ashamed|" +
    "doubts?|doubted|regrets?|regretted|worried|nervous|overwhelmed|discouraged" +
  ")\\b",
  "i",
);

// A chapter with fewer than this many examples cannot reasonably be expected to
// spend a slot on a friction scene; real chapters carry 3–9 examples.
const MIN_EXAMPLES = 3;

/** The reader-facing prose where a scene's OUTCOME lives: the scene itself and
 *  the consequence it draws. (whatToDo is prescriptive advice, not outcome.) */
function outcomeText(ex: ExampleV21): string {
  return [ex.scenario, ex.whyItMatters].filter((s) => typeof s === "string").join(" ");
}

/**
 * Why this single example is NOT a clean instant win, or null when it shows no
 * outcome friction at all. Pure (example → reason|null), exhaustively testable.
 */
export function exampleFrictionReason(ex: ExampleV21): string | null {
  const format = ex?.planSpec?.format;
  if (typeof format === "string" && FRICTION_FORMATS.has(format)) return `format:${format}`;
  const m = FRICTION_RE.exec(outcomeText(ex));
  if (m) return `cost:${m[0].toLowerCase()}`;
  return null;
}

export type UniformSuccessHit = {
  /** How many examples were inspected. */
  exampleCount: number;
  /** A representative scenario, for evidence. */
  evidence: string;
};

/**
 * Detect a uniform-success chapter from its example slate. Pure
 * (examples → hit|null) so it is exhaustively unit-testable. Returns a hit only
 * when there are ≥ MIN_EXAMPLES and NONE of them carries any outcome friction.
 */
export function detectUniformSuccess(examples: ExampleV21[] | undefined): UniformSuccessHit | null {
  if (!Array.isArray(examples) || examples.length < MIN_EXAMPLES) return null;
  for (const ex of examples) {
    if (exampleFrictionReason(ex) !== null) return null; // ≥1 friction scene → varied
  }
  return { exampleCount: examples.length, evidence: examples[0]?.scenario ?? "" };
}

const C28_FIX =
  "Make at least one scene per chapter show a failed first attempt, a relapse, or a cost — and let some outcomes stay partial. Uniform instant success reads as survivorship gloss and makes the reader feel like the failure when the move doesn't work the first time.";

/**
 * C28 — uniform success (advisory). A chapter whose every example resolves in
 * clean instant success, with no friction-bearing scene anywhere in its slate.
 * MINOR. Chapter-level: at most one finding per chapter.
 */
export function checkOutcomeVariety(chapter: ChapterV21): CriticFinding[] {
  const hit = detectUniformSuccess(chapter.examples);
  if (!hit) return [];
  return [
    finding(
      "C28.uniform_success",
      "minor",
      `examples: all ${hit.exampleCount} example scenes resolve in clean instant success — none shows a failed first attempt, relapse, setback, cost, or partial outcome — e.g. "${truncate(hit.evidence, 60)}" (no friction-bearing format [mistake_recovery/postmortem] and no cost/failure cue in any scenario). ${C28_FIX}`,
      hit.evidence,
    ),
  ];
}
