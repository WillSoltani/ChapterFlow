/**
 * Source-use-plan contract (frozen by IMP-00; IMPLEMENTED by IMP-03).
 *
 * Master plan §8.4 / F-004..F-007: every claim- or scenario-bearing unit gets a
 * COMPILER-OWNED plan with orthogonal source origin, rhetorical form, and claim
 * strength — not one overloaded enum. Writers and repair agents cannot relabel
 * these fields; a change is a lineage change that invalidates dependent evidence
 * and routes upstream. The plan hash binds briefs, cards, candidates, patches,
 * and reviews to the exact plan they were produced under.
 */

import { ContractDescriptor, expectFields, hashCanonical, isNonEmptyString, isStringArray } from "./contractUtil.js";

export type SourceOriginV1 = "source_bound" | "constructed" | "generic";

export type UnitFormV1 = "case" | "application" | "operational_scenario" | "explanation" | "analogy";

export type ClaimStrengthV1 = "descriptive" | "inferential" | "correlational" | "mechanistic" | "causal";

export type DetailSufficiencyV1 = "full" | "partial" | "concept_only";

export type SourceUsePlanUnitV1 = {
  unitId: string;
  origin: SourceOriginV1;
  form: UnitFormV1;
  claimStrength: ClaimStrengthV1;
  /** Required when origin === "source_bound" and the unit uses a named case. */
  caseId?: string;
  anchorIds: string[];
  allowedDetailTypes: string[];
  forbiddenDetailTypes: string[];
  detailSufficiency: DetailSufficiencyV1;
  /** true → reader prose must establish non-factual register at first entry
   *  (semantically — no single magic phrase; see IMP-04). */
  framingRequired: boolean;
};

export type SourceUsePlanV1 = {
  schema: "source-use-plan-v1";
  planVersion: 1;
  bookId: string;
  chapterNumber: number;
  sourcePacketSha256: string;
  compilerVersion: string;
  units: SourceUsePlanUnitV1[];
};

/** Canonical plan hash — the value carried in briefs/cards/attempts/patches. */
export function sourceUsePlanHash(plan: SourceUsePlanV1): string {
  return hashCanonical(plan);
}

const ORIGINS = ["source_bound", "constructed", "generic"];
const FORMS = ["case", "application", "operational_scenario", "explanation", "analogy"];
const STRENGTHS = ["descriptive", "inferential", "correlational", "mechanistic", "causal"];
const SUFFICIENCY = ["full", "partial", "concept_only"];

export function validateSourceUsePlan(p: unknown): string[] {
  const errors: string[] = [];
  if (p === null || typeof p !== "object") return ["plan: not an object"];
  const v = p as Record<string, unknown>;
  expectFields(v, ["schema", "planVersion", "bookId", "chapterNumber", "sourcePacketSha256", "compilerVersion", "units"], errors, "plan");
  if (v.schema !== "source-use-plan-v1") errors.push("plan: wrong schema tag");
  if (!Array.isArray(v.units)) { errors.push("plan: units must be an array"); return errors; }
  (v.units as unknown[]).forEach((u, i) => {
    if (u === null || typeof u !== "object") { errors.push(`plan.units[${i}]: not an object`); return; }
    const unit = u as Record<string, unknown>;
    const where = `plan.units[${i}]`;
    expectFields(unit, ["unitId", "origin", "form", "claimStrength", "anchorIds", "allowedDetailTypes", "forbiddenDetailTypes", "detailSufficiency", "framingRequired"], errors, where);
    if (!ORIGINS.includes(unit.origin as string)) errors.push(`${where}: unknown origin "${String(unit.origin)}"`);
    if (!FORMS.includes(unit.form as string)) errors.push(`${where}: unknown form "${String(unit.form)}"`);
    if (!STRENGTHS.includes(unit.claimStrength as string)) errors.push(`${where}: unknown claimStrength "${String(unit.claimStrength)}"`);
    if (!SUFFICIENCY.includes(unit.detailSufficiency as string)) errors.push(`${where}: unknown detailSufficiency "${String(unit.detailSufficiency)}"`);
    if (!isStringArray(unit.anchorIds)) errors.push(`${where}: anchorIds must be string[]`);
    // Semantic invariants the compiler must never emit (validated here so every
    // consumer rejects them identically):
    if (unit.origin === "source_bound" && unit.form === "case" && !isNonEmptyString(unit.caseId)) {
      errors.push(`${where}: source_bound case units require caseId`);
    }
    if (unit.origin === "source_bound" && (unit.anchorIds as string[] | undefined)?.length === 0) {
      errors.push(`${where}: source_bound units require at least one anchor`);
    }
    if (unit.origin !== "source_bound" && unit.claimStrength === "causal") {
      errors.push(`${where}: constructed/generic units cannot carry causal claim strength about the real world`);
    }
    if (unit.detailSufficiency === "concept_only" && unit.origin === "source_bound" && unit.form === "case") {
      errors.push(`${where}: concept_only sufficiency cannot authorize a sourced case scene`);
    }
    if (unit.origin === "constructed" && unit.framingRequired !== true) {
      errors.push(`${where}: constructed units require framingRequired=true`);
    }
  });
  return errors;
}

export const SOURCE_USE_PLAN_CONTRACT: ContractDescriptor = {
  name: "source-use-plan",
  version: 1,
  ownerPrompt: "IMP-03",
  description: "Compiler-owned per-unit source semantics: orthogonal origin/form/claim-strength plus detail permissions, sufficiency, and framing; hash-bound into briefs, cards, attempts, patches, and reviews.",
  fields: {
    SourceUsePlanV1: {
      schema: "\"source-use-plan-v1\"", planVersion: "1", bookId: "string", chapterNumber: "number",
      sourcePacketSha256: "string", compilerVersion: "string", units: "SourceUsePlanUnitV1[]",
    },
    SourceUsePlanUnitV1: {
      unitId: "string",
      origin: "\"source_bound\"|\"constructed\"|\"generic\"",
      form: "\"case\"|\"application\"|\"operational_scenario\"|\"explanation\"|\"analogy\"",
      claimStrength: "\"descriptive\"|\"inferential\"|\"correlational\"|\"mechanistic\"|\"causal\"",
      caseId: "string?", anchorIds: "string[]", allowedDetailTypes: "string[]",
      forbiddenDetailTypes: "string[]", detailSufficiency: "\"full\"|\"partial\"|\"concept_only\"",
      framingRequired: "boolean",
    },
  },
};
