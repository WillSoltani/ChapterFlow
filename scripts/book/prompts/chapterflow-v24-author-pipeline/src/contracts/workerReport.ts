/**
 * Worker implementation-report contract (frozen + owned by IMP-00, test-governed
 * by IMP-12).
 *
 * Every IMP-XX work package must emit `implementation-report.imp-XX.json`
 * conforming to this schema. The integration auditor (plan §15) treats worker
 * prose as hypothesis; this JSON is the machine-checkable claim surface. Empty
 * and ADVERSE fields are explicit — omitting a failing test or an unexpected
 * write is a schema violation, not an editorial choice.
 */

import { ContractDescriptor, expectFields, isNonEmptyString, isStringArray } from "./contractUtil.js";

export type RequirementStatusV1 = "implemented" | "partial" | "deferred";

export type WorkerImplementationReportV1 = {
  schema: "worker-implementation-report-v1";
  promptId: string;
  /** Content identity of the tree the worker started from (git SHA when
   *  available, else a content hash) — and of the finished tree. */
  baselineHash: string;
  resultHash: string;
  /** Contract name → version this package was built against. */
  contractVersions: Record<string, number>;
  filesChanged: string[];
  requirementsImplemented: Array<{
    requirementId: string;
    status: RequirementStatusV1;
    note?: string;
    deferredTo?: string;
  }>;
  testsRequired: string[];
  testsRun: string[];
  testResults: {
    pass: number;
    fail: number;
    xfail: number;
    xpass: number;
    skip: number;
    xenv: number;
    commands: string[];
  };
  /** MUST be [] for every migration package (no gate weakening). */
  gateChanges: string[];
  /** MUST be [] — no book/chapter/author/range-specific behavior. */
  bookSpecificExceptions: string[];
  unexpectedWrites: string[];
  unresolvedRisks: string[];
  dependencyAssumptions: string[];
};

export function validateWorkerReport(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["report: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, [
    "schema", "promptId", "baselineHash", "resultHash", "contractVersions", "filesChanged",
    "requirementsImplemented", "testsRequired", "testsRun", "testResults", "gateChanges",
    "bookSpecificExceptions", "unexpectedWrites", "unresolvedRisks", "dependencyAssumptions",
  ], errors, "report");
  if (v.schema !== "worker-implementation-report-v1") errors.push("report: wrong schema tag");
  if (!/^IMP-\d{2}$/.test(String(v.promptId))) errors.push(`report: promptId must match IMP-NN, got "${String(v.promptId)}"`);
  if (!isNonEmptyString(v.baselineHash) || !isNonEmptyString(v.resultHash)) errors.push("report: baselineHash and resultHash required");
  for (const arrField of ["filesChanged", "testsRequired", "testsRun", "gateChanges", "bookSpecificExceptions", "unexpectedWrites", "unresolvedRisks", "dependencyAssumptions"]) {
    if (!isStringArray(v[arrField])) errors.push(`report: ${arrField} must be string[] (explicit [] when empty)`);
  }
  if (!Array.isArray(v.requirementsImplemented)) {
    errors.push("report: requirementsImplemented must be an array");
  } else {
    (v.requirementsImplemented as unknown[]).forEach((r2, i) => {
      const req = r2 as Record<string, unknown>;
      if (!isNonEmptyString(req?.requirementId)) errors.push(`report.requirementsImplemented[${i}]: requirementId required`);
      if (!["implemented", "partial", "deferred"].includes(String(req?.status))) {
        errors.push(`report.requirementsImplemented[${i}]: status must be implemented|partial|deferred`);
      }
      if (String(req?.status) === "deferred" && !isNonEmptyString(req?.deferredTo)) {
        errors.push(`report.requirementsImplemented[${i}]: deferred requirements must name deferredTo`);
      }
    });
  }
  const tr = v.testResults as Record<string, unknown> | undefined;
  if (!tr || typeof tr !== "object") {
    errors.push("report: testResults required");
  } else {
    for (const n of ["pass", "fail", "xfail", "xpass", "skip", "xenv"]) {
      if (typeof tr[n] !== "number") errors.push(`report.testResults.${n} must be a number (0 is explicit)`);
    }
    if (!isStringArray(tr.commands)) errors.push("report.testResults.commands must be string[]");
  }
  return errors;
}

export const WORKER_REPORT_CONTRACT: ContractDescriptor = {
  name: "worker-implementation-report",
  version: 1,
  ownerPrompt: "IMP-00",
  description: "Machine-readable per-package implementation report; adverse and empty fields are explicit and schema-enforced.",
  fields: {
    WorkerImplementationReportV1: {
      schema: "\"worker-implementation-report-v1\"",
      promptId: "\"IMP-NN\"", baselineHash: "string", resultHash: "string",
      contractVersions: "Record<string,number>", filesChanged: "string[]",
      requirementsImplemented: "{ requirementId, status: implemented|partial|deferred, note?, deferredTo? }[]",
      testsRequired: "string[]", testsRun: "string[]",
      testResults: "{ pass, fail, xfail, xpass, skip, xenv, commands: string[] }",
      gateChanges: "string[] (must be [])", bookSpecificExceptions: "string[] (must be [])",
      unexpectedWrites: "string[]", unresolvedRisks: "string[]", dependencyAssumptions: "string[]",
    },
  },
};
