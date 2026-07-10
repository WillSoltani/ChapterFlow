/**
 * IMP-03 (F-004..F-007, F-013): the compiler-owned SOURCE-USE PLAN.
 *
 * Compiles the frozen `source-use-plan` v1 contract (src/contracts/sourceUsePlan.ts)
 * from a chapter's source packet: one orthogonal license row per claim- or
 * scenario-bearing unit — source ORIGIN, rhetorical FORM, CLAIM STRENGTH, detail
 * permissions, evidence sufficiency, and framing — instead of one overloaded enum.
 *
 * OWNERSHIP: only this compiler mints or changes origin, case binding, claim
 * strength, sufficiency, or detail permissions. The plan is written next to the
 * packet at compile time, hash-bound to the exact packet bytes
 * (`sourcePacketSha256`), and is immutable for an authoring attempt: writers get
 * a rendered card block plus the plan hash in their attempt lineage; they never
 * receive a mutable plan object, their isolated workspace (IMP-01) cannot reach
 * the plan file, and candidates carrying plan-control fields are rejected
 * (embeddedPlanMutationFindings). A needed change routes UPSTREAM through
 * source-plan recompile, which changes the plan hash and thereby stales every
 * dependent attempt.
 *
 * Deliberately conservative derivations (the F-C causal-overreach fix):
 *  - claim strength is NEVER inferred from prose, temporal sequence, or
 *    association. A fact with a researcher-attested mechanism sentence carries
 *    "mechanistic"; a fact whose replicationStatus is below robust degrades to
 *    "descriptive"; everything else is "descriptive". "causal", "inferential",
 *    and "correlational" are never minted by this v1 compiler — no sidecar field
 *    attests them; they become reachable only through an explicit upstream
 *    research field, never a downstream relabel.
 *  - a real-world case with fewer than 2 documented hardSpecifics gets NO scene
 *    license: it degrades to a source-bound EXPLANATION unit (concept_only) —
 *    reference the case expository, never stage it.
 *  - detail sufficiency "full" is never minted: 2-4 checkable specifics license
 *    a PARTIAL scene (documented specifics only), not scene completion.
 */

import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import {
  type ClaimStrengthV1,
  type SourceUsePlanUnitV1,
  type SourceUsePlanV1,
  sourceUsePlanHash,
  validateSourceUsePlan,
} from "../contracts/sourceUsePlan.js";
import { sourcePacketHash } from "./sourcePacket.js";

/** Ownership marker + compiler version hash carried in every plan (contract field
 *  `compilerVersion`). Bump the trailing version on any derivation-rule change so
 *  existing plans stale loudly instead of silently meaning something new. */
export const SOURCE_PLAN_COMPILER_VERSION = "chapterflow-source-plan-compiler/1 (compiler-owned)" as const;

/** The ordered claim-strength ladder (weakest → strongest). */
export const CLAIM_STRENGTH_ORDER: readonly ClaimStrengthV1[] = [
  "descriptive",
  "inferential",
  "correlational",
  "mechanistic",
  "causal",
];

/** The strongest strength this compiler will ever mint (see header). */
export const COMPILER_MAX_CLAIM_STRENGTH: ClaimStrengthV1 = "mechanistic";

export function claimStrengthRank(s: ClaimStrengthV1): number {
  return CLAIM_STRENGTH_ORDER.indexOf(s);
}

// ── Detail-permission category vocabularies (from master plan §8.4) ───────────
// Categories, not instances: the packet/anchors bound the INSTANCES (which
// numbers, which names); these bound the KINDS of detail a unit may carry.

export const CASE_DETAIL_ALLOWED = [
  "documented_specific",
  "documented_number",
  "documented_name",
  "documented_place",
  "documented_date",
] as const;
export const CASE_DETAIL_FORBIDDEN = [
  "invented_dialogue",
  "invented_thoughts",
  "invented_participant",
  "invented_date",
  "invented_setting",
  "invented_outcome",
  "asserted_causation",
  "invented_quantified_effect",
  "restamp_protected_specific",
  "scene_completion",
] as const;

export const EXPLANATION_DETAIL_ALLOWED = ["concept", "documented_specific", "documented_number"] as const;
export const EXPLANATION_DETAIL_FORBIDDEN = [
  "invented_scene",
  "invented_participant",
  "asserted_causation",
  "invented_quantified_effect",
] as const;

export const CONSTRUCTED_DETAIL_ALLOWED = [
  "fictional_name",
  "role_label",
  "concrete_action",
  "hypothetical_consequence",
] as const;
export const CONSTRUCTED_DETAIL_FORBIDDEN = [
  "real_person",
  "real_organization",
  "fabricated_statistic",
  "fabricated_date",
  "fabricated_credential",
  "fabricated_citation",
  "historical_claim",
  "outcome_reported_as_fact",
] as const;

export const GENERIC_DETAIL_ALLOWED = [
  "role_label",
  "observable_action",
  "constraint",
  "tradeoff",
  "workflow_step",
] as const;
export const GENERIC_DETAIL_FORBIDDEN = [
  "named_person",
  "named_organization",
  "date",
  "exact_metric",
  "credential",
  "biography",
  "historical_claim",
] as const;

export const ANALOGY_DETAIL_ALLOWED = ["everyday_object", "familiar_process"] as const;
export const ANALOGY_DETAIL_FORBIDDEN = [
  "real_person",
  "fabricated_statistic",
  "historical_claim",
  "literal_equivalence",
] as const;

// ── Compilation ───────────────────────────────────────────────────────────────

export type CompiledSourceUsePlan = {
  plan: SourceUsePlanV1;
  /** Non-fatal derivation notes (e.g. a case id absent from the anchor catalog). */
  findings: string[];
};

function factClaimStrength(fact: SourcePacketV1["facts"][number]): ClaimStrengthV1 {
  if (fact.replicationStatus && fact.replicationStatus !== "robust") return "descriptive";
  return typeof fact.mechanism === "string" && fact.mechanism.trim().length > 0 ? "mechanistic" : "descriptive";
}

/**
 * Derive the chapter's source-use plan from its compiled packet. Deterministic and
 * pure (no fs/clock): identical packet bytes → identical plan → identical hash.
 * Throws only when the derived plan fails its own frozen contract (a compiler bug,
 * never a data condition — data problems become findings/omissions instead).
 */
export function compileSourceUsePlan(packet: SourcePacketV1): CompiledSourceUsePlan {
  const nn = String(packet.chapterNumber).padStart(2, "0");
  const findings: string[] = [];
  const anchorIdSet = new Set((packet.allowedAnchors ?? []).map((a) => a.id));
  const conceptAnchor = (packet.allowedAnchors ?? []).find((a) => a.kind === "concept")?.id;
  const fallbackAnchor = conceptAnchor ?? (packet.allowedAnchors ?? [])[0]?.id;

  const resolveAnchors = (preferredId: string, label: string): string[] | null => {
    if (anchorIdSet.has(preferredId)) return [preferredId];
    if (fallbackAnchor) {
      findings.push(`${label}: id "${preferredId}" is not in the anchor catalog — anchored on "${fallbackAnchor}" instead`);
      return [fallbackAnchor];
    }
    findings.push(`${label}: no anchor resolvable (empty catalog) — unit omitted; nothing is licensed by omission`);
    return null;
  };

  const units: SourceUsePlanUnitV1[] = [];

  // One source-bound EXPLANATION unit per fact: direct conceptual explanation is
  // the first-class form (§8.4) — teaching a claim/mechanism expository needs no
  // cast, prop, setting, or completed scene, and must never be penalized for
  // lacking them.
  for (const fact of packet.facts ?? []) {
    if (!fact?.id) continue;
    const anchors = resolveAnchors(fact.id, `fact ${fact.id}`);
    if (!anchors) continue;
    units.push({
      unitId: `unit.fact.${fact.id}`,
      origin: "source_bound",
      form: "explanation",
      claimStrength: factClaimStrength(fact),
      anchorIds: anchors,
      allowedDetailTypes: [...EXPLANATION_DETAIL_ALLOWED],
      forbiddenDetailTypes: [...EXPLANATION_DETAIL_FORBIDDEN],
      detailSufficiency: "concept_only",
      framingRequired: false,
    });
  }

  // Named cases: a scene license exists ONLY with >= 2 documented hardSpecifics
  // (partial sufficiency — documented specifics, never completion). Below that,
  // the case degrades to explanation-form: reference it, don't stage it. A
  // non-real-world case (the source book's own named device) keeps its license
  // but MUST be framed as the book's device, never as history.
  for (const namedCase of packet.namedCases ?? []) {
    if (!namedCase?.id) continue;
    const anchors = resolveAnchors(namedCase.id, `case ${namedCase.id}`);
    if (!anchors) continue;
    const specifics = Array.isArray(namedCase.hardSpecifics) ? namedCase.hardSpecifics.length : 0;
    const sceneLicensed = specifics >= 2;
    if (sceneLicensed) {
      units.push({
        unitId: `unit.case.${namedCase.id}`,
        origin: "source_bound",
        form: "case",
        claimStrength: "descriptive",
        caseId: namedCase.id,
        anchorIds: anchors,
        allowedDetailTypes: [...CASE_DETAIL_ALLOWED],
        forbiddenDetailTypes: [...CASE_DETAIL_FORBIDDEN],
        detailSufficiency: "partial",
        framingRequired: namedCase.realWorld === false,
      });
    } else {
      findings.push(`case ${namedCase.id}: only ${specifics} documented hardSpecific(s) — no scene license; explanation-only unit minted`);
      units.push({
        unitId: `unit.case.${namedCase.id}`,
        origin: "source_bound",
        form: "explanation",
        claimStrength: "descriptive",
        caseId: namedCase.id,
        anchorIds: anchors,
        allowedDetailTypes: [...EXPLANATION_DETAIL_ALLOWED],
        forbiddenDetailTypes: [...EXPLANATION_DETAIL_FORBIDDEN],
        detailSufficiency: "concept_only",
        framingRequired: namedCase.realWorld === false,
      });
    }
  }

  // Chapter-level invented-material licenses (one each): constructed application,
  // generic operational scenario, analogy. Origin/form/strength are fixed by
  // construction; none may assert real-world claims of its own (strength stays
  // descriptive — the sourced facts' strength lives on the fact units).
  units.push({
    unitId: `unit.ch${nn}.constructed-application`,
    origin: "constructed",
    form: "application",
    claimStrength: "descriptive",
    anchorIds: [],
    allowedDetailTypes: [...CONSTRUCTED_DETAIL_ALLOWED],
    forbiddenDetailTypes: [...CONSTRUCTED_DETAIL_FORBIDDEN],
    detailSufficiency: "concept_only",
    framingRequired: true,
  });
  units.push({
    unitId: `unit.ch${nn}.generic-scenario`,
    origin: "generic",
    form: "operational_scenario",
    claimStrength: "descriptive",
    anchorIds: [],
    allowedDetailTypes: [...GENERIC_DETAIL_ALLOWED],
    forbiddenDetailTypes: [...GENERIC_DETAIL_FORBIDDEN],
    detailSufficiency: "concept_only",
    framingRequired: false,
  });
  units.push({
    unitId: `unit.ch${nn}.analogy`,
    origin: "constructed",
    form: "analogy",
    claimStrength: "descriptive",
    anchorIds: [],
    allowedDetailTypes: [...ANALOGY_DETAIL_ALLOWED],
    forbiddenDetailTypes: [...ANALOGY_DETAIL_FORBIDDEN],
    detailSufficiency: "concept_only",
    framingRequired: true,
  });

  const plan: SourceUsePlanV1 = {
    schema: "source-use-plan-v1",
    planVersion: 1,
    bookId: packet.bookId,
    chapterNumber: packet.chapterNumber,
    sourcePacketSha256: sourcePacketHash(packet),
    compilerVersion: SOURCE_PLAN_COMPILER_VERSION,
    units,
  };

  const errors = validateSourceUsePlan(plan);
  if (errors.length > 0) {
    throw new Error(`compileSourceUsePlan produced a contract-invalid plan (compiler bug): ${errors.join("; ")}`);
  }
  for (const unit of units) {
    if (claimStrengthRank(unit.claimStrength) > claimStrengthRank(COMPILER_MAX_CLAIM_STRENGTH)) {
      throw new Error(`compileSourceUsePlan minted claim strength "${unit.claimStrength}" on ${unit.unitId} (compiler bug: ceiling is ${COMPILER_MAX_CLAIM_STRENGTH})`);
    }
  }
  return { plan, findings };
}

// ── Freshness ─────────────────────────────────────────────────────────────────

/** Why a persisted plan may no longer govern authoring against `packet`
 *  (null = fresh). Missing-plan is NOT staleness — legacy books author exactly
 *  as before; a PRESENT plan that mismatches is fail-closed. */
export function sourceUsePlanStale(plan: SourceUsePlanV1, packet: SourcePacketV1): string | null {
  if (plan.bookId !== packet.bookId || plan.chapterNumber !== packet.chapterNumber) {
    return `plan identity ${plan.bookId}/ch${plan.chapterNumber} does not match packet ${packet.bookId}/ch${packet.chapterNumber}`;
  }
  const live = sourcePacketHash(packet);
  if (plan.sourcePacketSha256 !== live) {
    return `plan was compiled against packet ${plan.sourcePacketSha256.slice(0, 12)}…, but the live packet hashes ${live.slice(0, 12)}…`;
  }
  return null;
}

// ── Writer/repair relabel containment ────────────────────────────────────────

/** Plan-control field names that must NEVER appear as object keys anywhere in a
 *  chapter candidate. None collides with the ChapterV21 content schema; any hit
 *  is an attempted (or accidental) downstream relabel of compiler-owned
 *  semantics and fails the attempt. */
export const RESERVED_PLAN_CONTROL_KEYS: readonly string[] = [
  "sourceUsePlan",
  "sourceUsePlanHash",
  "sourcePlanHash",
  "sourceOrigin",
  "unitForm",
  "claimStrength",
  "detailSufficiency",
  "allowedDetailTypes",
  "forbiddenDetailTypes",
  "framingRequired",
];

/** Scan a parsed candidate for reserved plan-control keys; returns the JSON
 *  paths of every hit ([] = clean). Keys only — content STRINGS may legitimately
 *  discuss these words. */
export function embeddedPlanMutationFindings(candidate: unknown): string[] {
  const hits: string[] = [];
  const reserved = new Set(RESERVED_PLAN_CONTROL_KEYS);
  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (node === null || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const keyPath = path ? `${path}.${key}` : key;
      if (reserved.has(key)) hits.push(keyPath);
      walk(value, keyPath);
    }
  };
  walk(candidate, "");
  return hits;
}

// ── Card rendering ────────────────────────────────────────────────────────────

const FACT_ID_LIST_CAP = 12;

function shortHash(hash: string): string {
  return hash.slice(0, 16);
}

/**
 * The compact card block (conflict matrix: "compact typed permissions and one
 * short policy" — the full per-unit table stays in the artifact; the card gets
 * grouped licenses). Rendered by the CONDUCTOR from the compiler-owned plan —
 * this is instruction text, not untrusted data.
 */
export function renderSourceUsePlanLines(plan: SourceUsePlanV1): string[] {
  const lines: string[] = [
    `SOURCE-USE PLAN (compiler-owned; plan ${shortHash(sourceUsePlanHash(plan))})`,
    "Binding license table for this chapter's content units. You cannot relabel origin, form, claim strength, sufficiency, or detail permissions — a change routes upstream to source-plan recompile, never through your output.",
    // IMP-04 instruction 2: the compact evidence-sufficiency decision policy —
    // pick the safe FORM by what the evidence supports (no magic phrase required).
    "CHOOSE THE SAFE FORM BY EVIDENCE: enough verified human/event detail → the permitted sourced form only; a concept you can teach directly → direct explanation (no cast, prop, or scene needed); an observable workflow helps → a generic operational scenario with role labels; a fictional contrast materially helps → a constructed application framed as hypothetical at first entry; not enough evidence → stop and request an upstream source-plan action, never invent to fill the gap.",
  ];

  const caseUnits = plan.units.filter((u) => u.form === "case");
  const caseExplanations = plan.units.filter((u) => u.form === "explanation" && u.caseId);
  const factUnits = plan.units.filter((u) => u.form === "explanation" && !u.caseId);

  if (caseUnits.length > 0) {
    lines.push("- SOURCED CASES (scene under license — documented material only):");
    for (const u of caseUnits) {
      lines.push(
        `  - ${u.caseId}: PARTIAL detail — use only documented specifics; never invent dialogue, thoughts, participants, dates, settings, outcomes, or numbers; a missing connective fact becomes neutral exposition, not scene completion. Claim strength: ${u.claimStrength} (report what happened; do not assert causation from it).${u.framingRequired ? " This is the source book's own named device — present it as the book's device, never as a historical event." : ""}`,
      );
    }
  }
  for (const u of caseExplanations) {
    lines.push(`  - ${u.caseId}: NO scene license (insufficient documented specifics) — reference this case expository only; do not stage it.`);
  }

  if (factUnits.length > 0) {
    const byStrength = new Map<string, string[]>();
    for (const u of factUnits) {
      const ids = byStrength.get(u.claimStrength) ?? [];
      ids.push(u.unitId.replace(/^unit\.fact\./, ""));
      byStrength.set(u.claimStrength, ids);
    }
    lines.push(
      "- SOURCED FACTS — explanation license (concept-only): teach claims and mechanisms expository. Direct conceptual explanation is a first-class form — never force a cast, prop, setting, or scene onto a unit whose evidence supports explanation only.",
    );
    for (const [strength, ids] of [...byStrength.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const idList = ids.length > FACT_ID_LIST_CAP ? `all ${ids.length} packet facts` : ids.join(", ");
      const hedge = strength === "descriptive" && byStrength.has("mechanistic")
        ? " (weaker/contested support — hedge; do not state as settled law)"
        : "";
      lines.push(`  - strength ceiling ${strength}${hedge}: ${idList}`);
    }
    lines.push("  - Never upgrade a claim past its ceiling: mechanistic material explains HOW it works; it is not a licence to promise real-world outcomes or causation beyond the stated mechanism.");
  }

  if (plan.units.some((u) => u.unitId.endsWith(".constructed-application"))) {
    lines.push(
      "- CONSTRUCTED APPLICATION — licensed: fictional/hypothetical situations applying the concept. Establish hypothetical status at first entry (semantically — no single magic phrase). Never merge a real person or organization into an invented event; no fabricated statistics, dates, credentials, or citations; consequences are possible/illustrative, never reported fact.",
    );
  }
  if (plan.units.some((u) => u.unitId.endsWith(".generic-scenario"))) {
    lines.push(
      "- GENERIC OPERATIONAL SCENARIO — licensed: anonymous instructional situations with role labels (\"a project lead\", \"the on-call engineer\"), observable decisions, constraints, tradeoffs. No invented names, dates, institutions, exact metrics, credentials, or biography. Concrete is fine; a scene is not required.",
    );
  }
  if (plan.units.some((u) => u.unitId.endsWith(".analogy"))) {
    lines.push("- ANALOGY — licensed with clear non-literal framing; no real people, statistics, or historical claims inside the analogy.");
  }

  return lines;
}
