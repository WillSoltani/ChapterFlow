/**
 * Repair contracts (frozen by IMP-00; IMPLEMENTED by IMP-07).
 *
 * Master plan §8.7 / F-010: surgical and section repairs return a TYPED PATCH
 * against an exact base + source-plan hash; the conductor applies it in memory,
 * revalidates the whole chapter and the semantic dependency closure, and commits
 * via compare-and-swap. Findings are structured — reviewer prose rides along as
 * untrusted evidence and can never expand scope, change tools/paths/models, or
 * waive gates (F-021).
 */

import { ContractDescriptor, expectFields, isNonEmptyString, isStringArray } from "./contractUtil.js";

export type RepairSeverityV1 = "must_fix" | "should_fix" | "advisory";

export type RepairRouteV1 = "surgical" | "section" | "regeneration" | "upstream-source" | "restore";

export type RepairFindingV1 = {
  schema: "repair-finding-v1";
  findingId: string;
  category: string;
  severity: RepairSeverityV1;
  unitIds: string[];
  evidenceQuotes: string[];
  violatedInvariantIds: string[];
  /** JSON paths the repair may touch. Anything else is out of scope. */
  permittedRepairScope: string[];
  prohibitedChanges: string[];
  sourcePlanDependencies: string[];
  recommendedRoute: RepairRouteV1;
};

export type ChapterPatchOperationV1 = {
  /** Dotted/bracket JSON path into ChapterV21; must be inside the route allowlist. */
  path: string;
  expectedOldValueHash: string;
  replacement: unknown;
  dependencyUnitIds: string[];
};

export type ChapterPatchV1 = {
  schema: "chapter-patch-v1";
  chapterId: string;
  expectedBaseHash: string;
  sourcePlanHash: string;
  findingIds: string[];
  operations: ChapterPatchOperationV1[];
};

/** Field names a finding may NEVER carry — control-plane injection guard
 *  (IMP-07 item 2). Consumers reject a finding containing any of these. */
export const FINDING_FORBIDDEN_CONTROL_FIELDS: readonly string[] = [
  "model", "effort", "reasoningEffort", "tools", "permissions", "sandbox",
  "outputPath", "outputProtocol", "retries", "retryPolicy", "gates", "acceptance",
  "publish", "promotion", "cwd", "env", "argv",
];

export function validateRepairFinding(f: unknown): string[] {
  const errors: string[] = [];
  if (f === null || typeof f !== "object") return ["finding: not an object"];
  const v = f as Record<string, unknown>;
  expectFields(v, [
    "schema", "findingId", "category", "severity", "unitIds", "evidenceQuotes",
    "violatedInvariantIds", "permittedRepairScope", "prohibitedChanges",
    "sourcePlanDependencies", "recommendedRoute",
  ], errors, "finding");
  if (v.schema !== "repair-finding-v1") errors.push("finding: wrong schema tag");
  if (!["must_fix", "should_fix", "advisory"].includes(v.severity as string)) errors.push(`finding: unknown severity "${String(v.severity)}"`);
  if (!["surgical", "section", "regeneration", "upstream-source", "restore"].includes(v.recommendedRoute as string)) {
    errors.push(`finding: unknown recommendedRoute "${String(v.recommendedRoute)}"`);
  }
  if (!isStringArray(v.evidenceQuotes)) errors.push("finding: evidenceQuotes must be string[]");
  for (const forbidden of FINDING_FORBIDDEN_CONTROL_FIELDS) {
    if (forbidden in v) errors.push(`finding: control-plane field "${forbidden}" is forbidden (untrusted data cannot expand authority)`);
  }
  return errors;
}

export function validateChapterPatch(p: unknown): string[] {
  const errors: string[] = [];
  if (p === null || typeof p !== "object") return ["patch: not an object"];
  const v = p as Record<string, unknown>;
  expectFields(v, ["schema", "chapterId", "expectedBaseHash", "sourcePlanHash", "findingIds", "operations"], errors, "patch");
  if (v.schema !== "chapter-patch-v1") errors.push("patch: wrong schema tag");
  if (!isNonEmptyString(v.expectedBaseHash)) errors.push("patch: expectedBaseHash required (stale patches are rejected, never rebased)");
  if (!isNonEmptyString(v.sourcePlanHash)) errors.push("patch: sourcePlanHash required");
  if (!Array.isArray(v.operations) || (v.operations as unknown[]).length === 0) {
    errors.push("patch: operations must be a non-empty array");
    return errors;
  }
  (v.operations as unknown[]).forEach((o, i) => {
    if (o === null || typeof o !== "object") { errors.push(`patch.operations[${i}]: not an object`); return; }
    const op = o as Record<string, unknown>;
    const where = `patch.operations[${i}]`;
    expectFields(op, ["path", "expectedOldValueHash", "replacement", "dependencyUnitIds"], errors, where);
    const path = String(op.path ?? "");
    if (/__proto__|prototype|constructor/.test(path)) errors.push(`${where}: prototype-pollution path rejected`);
    if (path.startsWith("/") || path.includes("..")) errors.push(`${where}: absolute/parent paths rejected`);
  });
  return errors;
}

export const REPAIR_CONTRACT: ContractDescriptor = {
  name: "repair",
  version: 1,
  ownerPrompt: "IMP-07",
  description: "Structured repair findings (evidence-bound, control-plane-forbidden) and typed chapter patches (base+plan hash pinned, path-allowlisted, old-value verified).",
  fields: {
    RepairFindingV1: {
      schema: "\"repair-finding-v1\"", findingId: "string", category: "string",
      severity: "\"must_fix\"|\"should_fix\"|\"advisory\"", unitIds: "string[]",
      evidenceQuotes: "string[]", violatedInvariantIds: "string[]",
      permittedRepairScope: "string[]", prohibitedChanges: "string[]",
      sourcePlanDependencies: "string[]",
      recommendedRoute: "\"surgical\"|\"section\"|\"regeneration\"|\"upstream-source\"|\"restore\"",
    },
    ChapterPatchV1: {
      schema: "\"chapter-patch-v1\"", chapterId: "string", expectedBaseHash: "string",
      sourcePlanHash: "string", findingIds: "string[]",
      operations: "{ path, expectedOldValueHash, replacement, dependencyUnitIds }[]",
    },
    forbiddenControlFields: "model, effort, reasoningEffort, tools, permissions, sandbox, outputPath, outputProtocol, retries, retryPolicy, gates, acceptance, publish, promotion, cwd, env, argv",
  },
};
