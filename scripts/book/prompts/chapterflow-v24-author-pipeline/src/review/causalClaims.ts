/**
 * causalClaims (IMP-08, F-023 / plan instruction 7) — a typed causal-claim
 * representation extracted from EVERY reader-facing surface (narrative tiers,
 * examples, quiz explanations, review cards, memorable lines, practice), each
 * claim linked to the plan units that could license it and to the plan's
 * strongest permitted claim strength.
 *
 * This is the causal-verifier's INPUT PACKET and the deterministic spine the
 * C37 advisory critic already enforces (same CAUSAL_RE lexicon — one owner).
 * Verifier posture in v1: the packet + task builders are the IMP-11 interface
 * (judge qualification / balanced panels); nothing here feeds a gate,
 * threshold, or acceptance predicate, and a chapter with NO plan extracts
 * claims but judges nothing (absence grants nothing and blocks nothing —
 * the C37 rule).
 */

import type { ChapterV21 } from "../types.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import { claimStrengthRank } from "../compiler/sourceUsePlanCompiler.js";
import { CAUSAL_RE, planAggregate } from "../critics/sourceRegister.js";

// ── Claim shapes ──────────────────────────────────────────────────────────────

export type CausalClaimV1 = {
  /** Where the claim lives, chapter-path style: "hook", "breakdown.deepRead",
   *  "examples[1].whyItMatters", "quiz[2].explanation", "reviewCards[0].back",
   *  "memorableLines[3]", "implementationPlan.coreSkill". */
  surface: string;
  /** The matched causal span (the lexicon hit). */
  span: string;
  /** Bounded context around the span (≤240 chars) for the verifier. */
  excerpt: string;
};

export type CausalClaimExtraction = {
  chapterId: string;
  /** False for legacy chapters with no source-use plan: claims are still
   *  extracted (representation), but nothing is judged. */
  planKnown: boolean;
  /** The plan's aggregate strongest permitted claim strength (null = no plan). */
  strongestPermitted: string | null;
  /** Plan units whose claimStrength is `causal` — the only units that could
   *  license a causal span. Empty + planKnown = every claim is an overreach. */
  licensingUnitIds: string[];
  claims: CausalClaimV1[];
  /** claims when the plan licenses NO causal unit (the F-023 class); [] when
   *  the plan permits causal or is unknown. */
  overreaches: CausalClaimV1[];
};

// ── Surface enumeration (instruction 7's list, cards included) ────────────────

function claimSurfaces(ch: ChapterV21): Array<{ surface: string; text: string }> {
  const out: Array<{ surface: string; text: string }> = [];
  const add = (surface: string, text: unknown): void => {
    if (typeof text === "string" && text.trim().length > 0) out.push({ surface, text });
  };
  add("hook", ch.hook);
  add("counterintuition", ch.counterintuition);
  add("keyTakeaway", ch.keyTakeaway);
  add("tryThisNow", ch.tryThisNow);
  add("breakdown.fastRead", ch.breakdown?.fastRead);
  add("breakdown.deepRead", ch.breakdown?.deepRead);
  add("breakdown.fullRead", ch.breakdown?.fullRead);
  (ch.examples ?? []).forEach((ex, i) => {
    add(`examples[${i}].scenario`, ex?.scenario);
    add(`examples[${i}].whatToDo`, ex?.whatToDo);
    add(`examples[${i}].whyItMatters`, ex?.whyItMatters);
  });
  (ch.quiz?.questions ?? []).forEach((q, i) => add(`quiz[${i}].explanation`, q?.explanation));
  (ch.reviewCards ?? []).forEach((c, i) => {
    add(`reviewCards[${i}].front`, c?.front);
    add(`reviewCards[${i}].back`, c?.back);
  });
  (ch.memorableLines ?? []).forEach((m, i) => add(`memorableLines[${i}]`, m?.text));
  add("implementationPlan.coreSkill", ch.implementationPlan?.coreSkill);
  return out;
}

function excerptAround(text: string, index: number, span: string): string {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + span.length + 90);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

// ── Extraction ────────────────────────────────────────────────────────────────

/** Extract every causal-register span from the chapter's reader-facing
 *  surfaces and link the set to the plan's licensing reality. Pure; no disk. */
export function extractCausalClaims(ch: ChapterV21, plan: SourceUsePlanV1 | null): CausalClaimExtraction {
  const claims: CausalClaimV1[] = [];
  for (const { surface, text } of claimSurfaces(ch)) {
    CAUSAL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CAUSAL_RE.exec(text)) !== null) {
      claims.push({ surface, span: m[0], excerpt: excerptAround(text, m.index, m[0]).slice(0, 240) });
    }
  }
  if (!plan || plan.units.length === 0) {
    return { chapterId: ch.chapterId, planKnown: false, strongestPermitted: null, licensingUnitIds: [], claims, overreaches: [] };
  }
  const agg = planAggregate(plan);
  const licensingUnitIds = plan.units
    .filter((u) => claimStrengthRank(u.claimStrength) >= claimStrengthRank("causal"))
    .map((u) => u.unitId);
  const causalPermitted = claimStrengthRank(agg.strongestClaim as never) >= claimStrengthRank("causal");
  return {
    chapterId: ch.chapterId,
    planKnown: true,
    strongestPermitted: agg.strongestClaim,
    licensingUnitIds,
    claims,
    overreaches: causalPermitted ? [] : claims,
  };
}

// ── Verifier packets + task builders (the IMP-11 interface) ───────────────────

/** Render the causal-verifier packet: reader-facing claims + the plan's claim
 *  ceilings. Deliberately EXCLUDES author/model identity, prior verdicts, and
 *  any answer-key material (it hosts no quiz keys at all). */
export function renderCausalVerifierPacket(ch: ChapterV21, extraction: CausalClaimExtraction): string {
  const L: string[] = [];
  L.push(`# CAUSAL CLAIM VERIFICATION PACKET — ${ch.title}`, "");
  L.push(`Plan known: ${extraction.planKnown ? "yes" : "no (legacy chapter — judge nothing, report only)"}`);
  L.push(`Strongest permitted claim strength: ${extraction.strongestPermitted ?? "(unknown)"}`);
  L.push(`Licensing unit ids (causal-rank): ${extraction.licensingUnitIds.length > 0 ? extraction.licensingUnitIds.join(", ") : "(none)"}`, "");
  L.push("## Extracted causal-register claims");
  if (extraction.claims.length === 0) L.push("(none extracted)");
  extraction.claims.forEach((c, i) => {
    L.push(`${i + 1}. [${c.surface}] span "${c.span}"`, `   context: ${c.excerpt}`);
  });
  return L.join("\n");
}

/** The causal verifier's task card. Output shape mirrors the frozen
 *  review-output posture: per-claim verdicts, quotes only from the packet. */
export function buildCausalVerifierTask(docRelPath: string): string {
  return `CAUSAL CLAIM VERIFICATION — you judge whether causal language stays within the evidence license.

The packet is at: ${docRelPath}
Read ONLY this file. Do not write any files.

For EVERY numbered claim: is the causal span within the strongest permitted claim strength, or does it state cause/inevitability the license does not support? Judge each as "within-license" | "overreach" | "unclear" with a one-line why. Do not invent evidence beyond the packet.

FINAL MESSAGE: exactly one fenced json block, no prose outside it:
{
  "schema": "causal-verdicts-v1",
  "verdicts": [{"claim": 1, "surface": "<copy>", "verdict": "within-license|overreach|unclear", "why": "..."}]
}`;
}

/** Render the source-verifier packet: reader-facing content + BOUNDED source
 *  evidence + the plan render. The caller supplies the evidence lines (already
 *  bounded/citable — e.g. key-pack source facts); this module guarantees the
 *  packet carries no identity and no prior conclusions by construction. */
export function renderSourceVerifierPacket(opts: {
  title: string;
  phase1Doc: string;
  planRender: string;
  evidenceLines: readonly string[];
}): string {
  const L: string[] = [];
  L.push(`# SOURCE ATTRIBUTION VERIFICATION PACKET — ${opts.title}`, "");
  L.push("## Reader-facing content (phase-1 document — no answer key)");
  L.push(opts.phase1Doc.trimEnd(), "");
  L.push("## Source-use plan (claim ceilings and origins)");
  L.push(opts.planRender.trimEnd(), "");
  L.push("## Bounded source evidence (the ONLY citable facts)");
  if (opts.evidenceLines.length === 0) L.push("(none provided)");
  for (const line of opts.evidenceLines) L.push(`- ${line}`);
  return L.join("\n");
}

/** The source verifier's task card (attribution/grounding judgments only). */
export function buildSourceVerifierTask(docRelPath: string): string {
  return `SOURCE ATTRIBUTION VERIFICATION — you judge whether reader-facing claims stay grounded in the bounded source evidence.

The packet is at: ${docRelPath}
Read ONLY this file. Do not write any files.

List every reader-facing claim that asserts a specific fact, attribution, or outcome the bounded evidence does not support (cite the packet evidence ids/lines you checked against). You never see who or what produced the content and you must not speculate about it; judge the page against the evidence only.

FINAL MESSAGE: exactly one fenced json block, no prose outside it:
{
  "schema": "source-verdicts-v1",
  "findings": [{"where": "<surface>", "claim": "<verbatim from the packet>", "problem": "unsupported|contradicted|over-specified", "evidenceChecked": ["..."], "why": "..."}]
}`;
}
