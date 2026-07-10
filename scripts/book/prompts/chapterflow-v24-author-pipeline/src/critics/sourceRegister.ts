/**
 * IMP-04 (F-004..F-007, F-013) — the source-register critic family (C37).
 *
 * Operationalizes the compiler-owned SOURCE-USE PLAN (IMP-03) at the chapter
 * level: it checks the reader-facing prose's AGGREGATE register against the
 * plan's AGGREGATE permissions. Deterministic and plan-aware — NO magic phrase
 * is required (the plan §8.5/§8.11 forbids a mandatory marker), and a chapter
 * with NO plan is skipped entirely (legacy path; absence grants nothing and
 * blocks nothing).
 *
 * Three checks, all ADVISORY-MINOR (calibration-pending, exactly like C31-C35 —
 * none is wired to a gate/blocker/acceptance predicate; the register/factuality
 * BLOCKERS stay owned by sourceGrounding/sourceRealness, untouched):
 *
 *  C37.claim_strength_overreach — causal/inevitability language in reader prose
 *    when the plan's strongest permitted claim strength is below "causal" (the
 *    F-C fix: descriptive/correlational sources must not become causal through
 *    transition language, quiz explanation, plan text, or a memorable line).
 *
 *  C37.unsupported_scene_completion — invented-scene completion markers (invented
 *    dialogue quotes, interior-thought verbs, "moments later"-style beat closure)
 *    when NO plan unit carries a scene license (every case degraded to
 *    explanation-only), i.e. the writer staged a scene the evidence cannot support.
 *
 *  C37.generic_specific_leak — dates, exact metrics, or credentials in the prose
 *    when the plan has NO source_bound anchor that could ground them AND the only
 *    permitted origins are generic/constructed (a generic operational scenario or
 *    a constructed application inventing a plausible year/figure/credential).
 *
 * Conservative by construction: each check fires ONLY when the plan's aggregate
 * permission makes the register unsupportable, and each finding carries the
 * offending span as evidence. False positives are surfaced, never blocking, and
 * the calibration is IMP-11's job before any promotion to blocker.
 */

import type { ChapterV21, CriticFinding } from "../types.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import type { RepairFindingV1 } from "../contracts/repairContracts.js";
import { claimStrengthRank } from "../compiler/sourceUsePlanCompiler.js";
import { finding, truncate } from "./shared.js";

// ── reader-facing prose (shared scope with the C33 family) ────────────────────

function readerParts(chapter: ChapterV21): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [];
  const add = (where: string, text: unknown): void => {
    if (typeof text === "string" && text.trim().length > 0) out.push({ where, text });
  };
  add("hook", chapter.hook);
  add("counterintuition", chapter.counterintuition);
  add("keyTakeaway", chapter.keyTakeaway);
  add("breakdown.fastRead", chapter.breakdown?.fastRead);
  add("breakdown.deepRead", chapter.breakdown?.deepRead);
  add("breakdown.fullRead", chapter.breakdown?.fullRead);
  (chapter.examples ?? []).forEach((ex, i) => {
    const id = `examples[${i}]`;
    add(`${id}.scenario`, ex?.scenario);
    add(`${id}.whyItMatters`, ex?.whyItMatters);
  });
  (chapter.quiz?.questions ?? []).forEach((q, i) => add(`quiz[${i}].explanation`, q?.explanation));
  (chapter.memorableLines ?? []).forEach((m, i) => add(`memorableLines[${i}]`, m?.text));
  add("implementationPlan.coreSkill", chapter.implementationPlan?.coreSkill);
  return out;
}

// ── plan aggregates ───────────────────────────────────────────────────────────

export type PlanAggregate = {
  strongestClaim: string;
  anySceneLicense: boolean;
  anySourceBound: boolean;
  onlyInventedOrigins: boolean;
};

export function planAggregate(plan: SourceUsePlanV1): PlanAggregate {
  let strongestClaim = "descriptive";
  let anySceneLicense = false;
  let anySourceBound = false;
  for (const u of plan.units) {
    if (claimStrengthRank(u.claimStrength) > claimStrengthRank(strongestClaim as never)) strongestClaim = u.claimStrength;
    if (u.form === "case" && u.detailSufficiency !== "concept_only") anySceneLicense = true;
    if (u.origin === "source_bound") anySourceBound = true;
  }
  return {
    strongestClaim,
    anySceneLicense,
    anySourceBound,
    onlyInventedOrigins: plan.units.length > 0 && !anySourceBound,
  };
}

// ── detection lexicons (spans, not whole-clause semantics) ────────────────────

/** Strong causal / inevitability connectives. A hit is only a FINDING when the
 *  plan permits no causal unit — so descriptive evidence stated as cause.
 *  Exported (IMP-08): causalClaims.extractCausalClaims reuses this ONE lexicon
 *  so the critic and the causal-verifier packet can never drift apart. */
export const CAUSAL_RE =
  /\b(causes?|caused|causing|because of (?:this|that|it)|leads? directly to|led directly to|guarantees?|guaranteed|inevitably|proves? that|is the reason|are the reason|results? in|resulted in|makes? (?:you|it|them) (?:succeed|fail|win|lose)|will (?:always|never))\b/gi;

/** Invented-scene completion markers: a spoken quote, an interior-thought verb,
 *  or a beat-closure transition. A hit is only a FINDING when NO scene license
 *  exists in the plan (every case is explanation-only). */
const SCENE_QUOTE_RE = /["“][^"”]{12,}["”]/g;              // a >=12-char spoken line
const INTERIOR_THOUGHT_RE = /\b(thought to (?:himself|herself|themselves)|realized (?:that )?(?:he|she|they)|felt (?:a|an|the|his|her|their)|wondered (?:if|whether)|decided (?:to|that))\b/gi;
const BEAT_CLOSE_RE = /\b(moments? later|the next morning|by (?:the|that) (?:afternoon|evening|night)|hours? later|that (?:same )?(?:day|week|night)|in the end,)\b/gi;

/** Fabricated-specific shapes for generic/constructed content: a bare year, an
 *  exact percentage/figure, or a credential. Only a FINDING when the plan is
 *  invented-origins-only (no source_bound anchor to ground a real specific). */
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const EXACT_METRIC_RE = /\b\d{1,3}(?:\.\d+)?%|\$\s?\d[\d,]*(?:\.\d+)?\b/g;
const CREDENTIAL_RE = /\b(PhD|Ph\.D\.|MD|M\.D\.|MBA|CEO|CFO|CTO|professor|Dr\.)\b/g;

function firstMatch(re: RegExp, text: string): string | null {
  re.lastIndex = 0;
  const m = re.exec(text);
  return m ? m[0] : null;
}

// ── the critic ────────────────────────────────────────────────────────────────

/** Run the C37 source-register family against a chapter + its plan. Returns []
 *  when the chapter has NO plan (legacy) or nothing trips. Pure; no disk. */
export function checkSourceRegister(chapter: ChapterV21, plan: SourceUsePlanV1 | null): CriticFinding[] {
  if (!plan || plan.units.length === 0) return [];
  const agg = planAggregate(plan);
  const parts = readerParts(chapter);
  const findings: CriticFinding[] = [];

  // C37.claim_strength_overreach — causal register where the plan permits none.
  if (claimStrengthRank(agg.strongestClaim as never) < claimStrengthRank("causal")) {
    for (const { where, text } of parts) {
      const hit = firstMatch(CAUSAL_RE, text);
      if (hit) {
        findings.push(finding(
          "C37.claim_strength_overreach", "minor",
          `${where}: causal/inevitability language ("${hit}") but the source-use plan permits at most "${agg.strongestClaim}" claim strength — state the mechanism, not a guaranteed cause. Route a genuine causal claim upstream to source-plan recompile.`,
          truncate(text, 160),
        ));
        break; // one finding per chapter suffices to surface the pattern
      }
    }
  }

  // C37.unsupported_scene_completion — staged scene where no unit is scene-licensed.
  if (!agg.anySceneLicense) {
    for (const { where, text } of parts) {
      if (!where.startsWith("examples")) continue; // scenes live in examples
      const hit = firstMatch(SCENE_QUOTE_RE, text) ?? firstMatch(INTERIOR_THOUGHT_RE, text) ?? firstMatch(BEAT_CLOSE_RE, text);
      if (hit) {
        findings.push(finding(
          "C37.unsupported_scene_completion", "minor",
          `${where}: invented-scene completion ("${truncate(hit, 40)}") but no source-use-plan unit carries a scene license — this chapter's cases are explanation-only. Reference the case expository or use a clearly-framed constructed application; do not stage an unsupported scene.`,
          truncate(text, 160),
        ));
        break;
      }
    }
  }

  // C37.generic_specific_leak — a fabricated specific in invented-origins-only content.
  if (agg.onlyInventedOrigins) {
    for (const { where, text } of parts) {
      const hit = firstMatch(YEAR_RE, text) ?? firstMatch(EXACT_METRIC_RE, text) ?? firstMatch(CREDENTIAL_RE, text);
      if (hit) {
        findings.push(finding(
          "C37.generic_specific_leak", "minor",
          `${where}: a specific ("${hit}") in prose whose source-use plan has no source_bound anchor to ground it — a generic scenario or constructed application must not invent a date, exact metric, or credential. Use role labels and observable actions instead.`,
          truncate(text, 160),
        ));
        break;
      }
    }
  }

  return findings;
}

// ── evidence-bound repair findings (instruction 9; frozen RepairFindingV1) ─────

/** The plan field each C37 check implicates, and its permitted repair scope. */
const C37_REPAIR: Record<string, { planField: string; category: string; scope: string[] }> = {
  "C37.claim_strength_overreach": { planField: "claimStrength", category: "register.claim-strength", scope: ["breakdown", "quiz", "keyTakeaway", "memorableLines"] },
  "C37.unsupported_scene_completion": { planField: "detailSufficiency", category: "register.scene-completion", scope: ["examples"] },
  "C37.generic_specific_leak": { planField: "origin", category: "register.generic-specific", scope: ["examples", "breakdown"] },
};

/** Convert the C37 findings into frozen RepairFindingV1 records — bound to the
 *  implicated plan field, the offending evidence quote, severity, and the
 *  permitted repair scope (instruction 9: free-form prose cannot authorize
 *  broader edits). The `unitIds` reference the plan units of the implicated
 *  origin/strength; a register fix that would require CHANGING a unit routes
 *  upstream (recommendedRoute = "upstream-source"), never a local relabel. */
export function sourceRegisterRepairFindings(chapter: ChapterV21, plan: SourceUsePlanV1 | null): RepairFindingV1[] {
  if (!plan) return [];
  const critFindings = checkSourceRegister(chapter, plan);
  return critFindings.map((f, i): RepairFindingV1 => {
    const spec = C37_REPAIR[f.checkId] ?? { planField: "origin", category: "register", scope: ["breakdown"] };
    // A claim-strength/scene overreach is fixed by SOFTENING the prose to the
    // permitted register (surgical), never by changing the plan. A genuine need
    // for a stronger claim routes upstream.
    return {
      schema: "repair-finding-v1",
      findingId: `${f.checkId}#${i}`,
      category: spec.category,
      severity: "advisory",
      unitIds: plan.units.map((u) => u.unitId).slice(0, 8),
      evidenceQuotes: f.evidence ? [f.evidence] : [],
      violatedInvariantIds: [f.checkId],
      permittedRepairScope: spec.scope,
      prohibitedChanges: ["origin", "form", "claimStrength", "detailSufficiency", "framingRequired"],
      sourcePlanDependencies: [spec.planField],
      recommendedRoute: "surgical",
    };
  });
}
