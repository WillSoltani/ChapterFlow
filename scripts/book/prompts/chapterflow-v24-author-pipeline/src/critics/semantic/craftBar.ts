/**
 * THE CRAFT BAR — the fifth semantic QC read.
 *
 * The publishable bar (publishableBar.ts) scores the corruption + core-quality
 * axes that gate "is this a finished, non-corrupt chapter?" — quiz keys,
 * distractors, cards, examples, prose, plans, facts, behavioral naturalness,
 * memorable lines (9 axes, weights sum 100). Mapped onto the post-publish content
 * rubric (`.claude/skills/book-score/RUBRIC.md`), that bar covers quizzes,
 * practicalness, and retention — roughly a quarter of the rubric's 100 points.
 *
 * The OTHER ~64 points — Summaries (11), Tone (10), Transfer (11), Idea density (8),
 * Honesty about limits (9), plus Insight/Beginner — have NO axis on the publishable
 * bar. That gap is exactly why the-power-of-moments exited QC GREEN and then scored
 * 74.7 on the rubric (POM rank 95/98). The craft bar closes the largest, judgeable
 * part of that gap without touching the publishable bar (whose corruption model is
 * load-bearing and MUST NOT be re-weighted).
 *
 * Five axes, weights sum to EXACTLY 100 (HARD INVARIANT — computeCraftVerdict assumes
 * a 0–100 scale):
 *   summaries_depth  25  ← RUBRIC §7  Quality of summaries
 *   tone_register    20  ← RUBRIC §8  Tone (voice fit, anti-generic)
 *   transfer_design  20  ← RUBRIC §4  Transfer (lens > tactic)
 *   idea_density     20  ← RUBRIC §10 Idea density (no filler)
 *   limits_honesty   15  ← RUBRIC §5  Honesty about limits
 *
 * The craft bar NEVER claims CORRUPTION (it is a quality read, not a defect gate):
 * its only tiers are GREEN and YELLOW, and its worst verdict is "REVISE for craft".
 * It can add a reason to revise; it can never upgrade, excuse, or veto any other
 * check's verdict. Default mode is `shadow` — recorded and surfaced, never gating —
 * until the enforce floors are calibrated against real shadow data.
 */

import type { AxisHit } from "./publishableBar.js";

export type CraftAxisId =
  | "summaries_depth"
  | "tone_register"
  | "transfer_design"
  | "idea_density"
  | "limits_honesty";

/** Weights sum to EXACTLY 100 (HARD INVARIANT). */
export const CRAFT_AXIS_WEIGHTS: Record<CraftAxisId, number> = {
  summaries_depth: 25,
  tone_register: 20,
  transfer_design: 20,
  idea_density: 20,
  limits_honesty: 15,
};

export const CRAFT_AXIS_FLOOR = 0.6; // any axis below this caps the chapter at YELLOW
export const CRAFT_OVERALL_FLOOR = 75; // overall ≥ this AND no axis < floor for GREEN

/** The craft bar has no corruption tier — only GREEN (publishable-craft) and YELLOW
 *  (craft below the bar). Kept as a named type so the plumbing reads like the bar's. */
export type CraftTier = "GREEN" | "YELLOW";

/** A cited craft defect. Reuses the publishable-bar hit shape verbatim (unitId, quote,
 *  defect, optional concrete fix) so the repair path can route a craft hit exactly like
 *  a bar hit. */
export type CraftHit = AxisHit;

export type CraftAxisScore = {
  axis: CraftAxisId;
  /** 0..1 quality on this axis. */
  score: number;
  /** verbatim citations for a below-floor axis (cite-or-it-didn't-happen). */
  hits: CraftHit[];
};

export type CraftVerdict = {
  chapterId: string;
  overall: number; // 0..100, weighted
  tier: CraftTier;
  gate: CraftTier;
  axes: CraftAxisScore[];
  ran: boolean; // false => DID NOT RUN — never a GREEN
  note?: string;
};

function weightedOverall(axes: CraftAxisScore[]): number {
  let num = 0, den = 0;
  for (const a of axes) {
    const w = CRAFT_AXIS_WEIGHTS[a.axis] ?? 0;
    num += w * Math.max(0, Math.min(1, a.score));
    den += w;
  }
  return den === 0 ? 0 : Math.round((num / den) * 100);
}

/**
 * Reduce per-axis craft scores to a verdict. Mirrors publishableBar's computeVerdict
 * shape, minus the corruption veto (the craft bar has none): a chapter is GREEN only
 * when the weighted overall ≥ CRAFT_OVERALL_FLOOR AND no axis < CRAFT_AXIS_FLOOR;
 * otherwise YELLOW. A read that DID NOT RUN is YELLOW (never a silent GREEN).
 */
export function computeCraftVerdict(chapterId: string, axes: CraftAxisScore[], ran = true): CraftVerdict {
  if (!ran) {
    return { chapterId, overall: 0, tier: "YELLOW", gate: "YELLOW", axes, ran: false, note: "DID NOT RUN — not a craft pass" };
  }
  const overall = weightedOverall(axes);
  const belowFloor = overall < CRAFT_OVERALL_FLOOR || axes.some((a) => a.score < CRAFT_AXIS_FLOOR);
  const tier: CraftTier = belowFloor ? "YELLOW" : "GREEN";
  return { chapterId, overall, tier, gate: tier, axes, ran };
}

/**
 * The per-axis detection prose — the SAME strings the craft reviewer scores against.
 * Copied/adapted VERBATIM from the corresponding RUBRIC.md factor definitions so the
 * craft read and the post-publish score can never drift, and each carries its
 * false-positive guard.
 */
export const CRAFT_AXIS_RUBRIC: Record<CraftAxisId, string> = {
  summaries_depth:
    "RUBRIC §7 — Quality of summaries (the first, often only, surface read). Score fastRead/deepRead/fullRead as a set. ACCURACY & COMPLETENESS: each faithfully captures the chapter's real argument, nothing key dropped. PROGRESSIVE DEPTH: fast ⊂ deep ⊂ full — each tier ADDS, it does not just repeat the one below (a tier that re-states its shorter sibling with new words drags the axis). DISTILLATION: tight, no padding or restatement to hit a length. SELF-CONTAINED: each tier reads as a complete thought at its level. STANDALONE VALUE: the fast read ALONE leaves the reader with the core idea. NO TIER-DUPLICATION: not the same sentences pasted across fast/deep/full. FP-guard: a shared, deliberate through-line across tiers is fine — the defect is duplicated SENTENCES / no added information, not a consistent thesis stated at escalating depth.",
  tone_register:
    "RUBRIC §8 — Tone (voice fit & anti-generic), scored against THIS book's voice card (attached to the packet). REGISTER FIT: the prose matches this book's declared voice, not one interchangeable house voice. NON-GENERIC: a distinct, sourced voice a reader could not mistake for the generic-AI-narrator. WARMTH WITHOUT CONDESCENSION: confident and human, never content-farm-cheap or over-explaining to the reader. NO APHORISM-STACKING: it does not pile slogans to fake depth. PLAINNESS ON FIRST USE: every term stays plain on first use. FP-guard: a calm, plain register is NOT 'generic' — bland house-voice reads as AI slop, but a precise, unshowy voice that fits the voice card is GOOD; do not penalize plainness itself, only interchangeable/voiceless prose.",
  transfer_design:
    "RUBRIC §4 — Transfer (lens > tactic): can the reader apply the idea to situations the book never mentioned? LENS vs TACTIC: the chapter hands a reusable way of SEEING a class of situations, not a one-off trick. GENERALIZATION: the idea is framed as a principle, not welded to its single example. REUSABILITY ACROSS DOMAINS: the reader could carry it to work, health, money, relationships. MECHANISM OVER RECIPE: it explains WHY it works, so it adapts — not just a fixed checklist. FP-guard: a genuinely lens-level chapter that also gives one concrete tactic is GOOD; the defect is a chapter that is ONLY a bound-to-one-example tactic with no transferable principle.",
  idea_density:
    "RUBRIC §10 — Idea density (no filler): the most common AI-content sin. SIGNAL PER PARAGRAPH: each paragraph earns its place with new information. NO RESTATEMENT: it does not re-say the paragraph above with new words. NO PADDING-TO-LENGTH: length is set by content, not a word target. ECONOMY: the chapter could not be meaningfully shorter without loss. FP-guard: deliberate, vivid repetition for emphasis (a callback, a refrain) is GOOD — the defect is low new-information density, one idea stretched across many paragraphs, not intentional restatement for effect.",
  limits_honesty:
    "RUBRIC §5 — Honesty about limits (the teacher-vs-hype-man tell). BOUNDARY/LIMIT COVERAGE: the chapter teaches when the idea does NOT apply, or its failure mode. NO OVERSELLING: it does not state one idea as a law of everything. COUNTER-CASES: it acknowledges exceptions, tradeoffs, and when to do the opposite. CALIBRATED CONFIDENCE: the strength of each claim matches the strength of its evidence. FP-guard: a tightly-scoped chapter that names its boundary in one honest line is GOOD — full coverage is not required for a narrow claim; the defect is an idea sold as universal with no boundary at all.",
};

// ── Mode gating ────────────────────────────────────────────────────────────────
// CHAPTERFLOW_CRAFT_READ = off | shadow | enforce  (default: shadow).
//   off      — byte-identical to pre-craft behavior: no craft column, no artifacts, no findings.
//   shadow   — request + record the craft read, surface a NON-gating status column, and add
//              craft hits to the repair brief marked advisory; NEVER changes a finalize verdict.
//   enforce  — a chapter below the craft floors becomes REVISE (never CORRUPTION), with craft
//              hits routed as surgical-class repair directives. Committed config must never set
//              this — it is flipped only after the shadow floors are calibrated on real data.
export type CraftReadMode = "off" | "shadow" | "enforce";

export function craftReadMode(): CraftReadMode {
  const v = (process.env.CHAPTERFLOW_CRAFT_READ ?? "").trim().toLowerCase();
  if (v === "off" || v === "enforce") return v;
  return "shadow";
}

/** Pretty-print a craft verdict for reports / the QC session. */
export function formatCraftVerdict(v: CraftVerdict): string {
  const lines: string[] = [];
  const dims = v.axes.map((a) => `${a.axis.split("_").map((w) => w[0]).join("").toUpperCase()}=${a.score.toFixed(2)}`).join(" ");
  lines.push(`Craft bar: ${v.gate} — ${v.overall}/100  [${dims}]`);
  if (!v.ran) lines.push("  ⚠️ DID NOT RUN — this is NOT a craft pass.");
  for (const a of v.axes) {
    for (const h of a.hits) lines.push(`  [${a.axis}] ${h.unitId}: ${h.defect} — "${h.quote.slice(0, 80)}"`);
  }
  if (v.gate === "YELLOW") lines.push("  → craft below the bar (summaries/tone/transfer/density/limits). Advisory in shadow; a REVISE reason in enforce.");
  return lines.join("\n");
}
