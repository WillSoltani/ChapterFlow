/**
 * Model capability-probe result contract (WP-502 — V25 S-Tier §8 Lane 5).
 *
 * A bounded, fail-closed protocol proves a named 5.6 model is usable BEFORE any
 * book run. It runs four ordered checks per (model, effort):
 *
 *   1. `existence`     — the exact model slug + reasoning effort is advertised by
 *                        the LOCAL Codex `models_cache.json` (zero calls).
 *   2. `auth-route`    — the isolated CODEX_HOME auth material is
 *                        ChatGPT-subscription OAuth, not a metered API key
 *                        (`assertChatgptSubscriptionAuth`, zero calls).
 *   3. `output-schema` — `codex exec --output-schema` strict-subset acceptance
 *                        (LIVE, deferred to Phase-6 execution under `--execute-live`).
 *   4. `effort-flag`   — `-c model_reasoning_effort=<effort>` acceptance
 *                        (LIVE, deferred to Phase-6 execution under `--execute-live`).
 *
 * Each check yields one `ModelCapabilityCheckResultV1`: `SUPPORTED`,
 * `UNSUPPORTED` (fail-closed), or `NOT_TESTED` (an untested live check on the
 * dry default path — honestly recorded, NEVER assumed to pass, exactly as
 * `judge-capability-qualification` distinguishes `NOT_TESTED` from failure).
 *
 * On ANY `UNSUPPORTED` check the aggregate report carries an
 * `UnsupportedModelConfigV1` — the typed `UNSUPPORTED_MODEL_CONFIG` result the
 * WP-504 fail-closed run-start path consumes to halt (a missing model =
 * `UNSUPPORTED(existence)`, never a guess; no silent substitution).
 *
 * `effort` reuses the repo-local `EffortLevelV1` union (no API-only `max`).
 */

import { ContractDescriptor, expectFields, isNonEmptyString } from "./contractUtil.js";
import type { EffortLevelV1 } from "./executionProfile.js";

export const MODEL_CAPABILITY_CHECK_RESULT_SCHEMA = "model-capability-check-result-v1" as const;
export const UNSUPPORTED_MODEL_CONFIG_SCHEMA = "unsupported-model-config-v1" as const;
export const MODEL_CAPABILITY_PROBE_REPORT_SCHEMA = "model-capability-probe-report-v1" as const;

/** The four ordered checks. Order is load-bearing: the probe stops at the first
 *  fail-closed `UNSUPPORTED`, so a cheap local check never runs after a prior
 *  failure and a live call never fires unless every local check passed. */
export const MODEL_CAPABILITY_CHECKS = ["existence", "auth-route", "output-schema", "effort-flag"] as const;
export type ModelCapabilityCheckV1 = (typeof MODEL_CAPABILITY_CHECKS)[number];

/** Which checks require a live `codex exec` call (deferred to Phase 6). */
export const MODEL_CAPABILITY_LIVE_CHECKS = ["output-schema", "effort-flag"] as const;

/** The per-check outcomes. `NOT_TESTED` is distinct from `UNSUPPORTED` — an
 *  untested live check on the dry path is honestly recorded, never assumed pass. */
export const MODEL_CAPABILITY_STATUSES = ["SUPPORTED", "UNSUPPORTED", "NOT_TESTED"] as const;
export type ModelCapabilityProbeStatusV1 = (typeof MODEL_CAPABILITY_STATUSES)[number];

/** The aggregate verdict for one (model, effort) probe.
 *  - `UNSUPPORTED`      — at least one check is UNSUPPORTED (fail-closed halt).
 *  - `SUPPORTED`        — all four checks are SUPPORTED (fully proven usable).
 *  - `NOT_FULLY_TESTED` — no UNSUPPORTED check, but ≥1 live check is NOT_TESTED
 *                         (the dry default path: local checks pass, live deferred). */
export const MODEL_CAPABILITY_OVERALL = ["SUPPORTED", "UNSUPPORTED", "NOT_FULLY_TESTED"] as const;
export type ModelCapabilityOverallV1 = (typeof MODEL_CAPABILITY_OVERALL)[number];

/** The maximum number of live `codex exec` calls the probe may make per model,
 *  TOTAL across the output-schema + effort-flag checks. A refusal is never
 *  retried, so the happy path uses two; the cap is the hard budget guard. */
export const MODEL_CAPABILITY_LIVE_CALL_BUDGET = 3 as const;

/** One check's typed result (§1: model, effort, check, status, human reason). */
export type ModelCapabilityCheckResultV1 = {
  schema: typeof MODEL_CAPABILITY_CHECK_RESULT_SCHEMA;
  model: string;
  effort: EffortLevelV1;
  check: ModelCapabilityCheckV1;
  status: ModelCapabilityProbeStatusV1;
  /** Human-legible reason (non-secret): why this check passed, failed, or was
   *  deferred. Never carries auth-material contents — only enum-grade facts. */
  reason: string;
};

/** The `UNSUPPORTED_MODEL_CONFIG` result WP-504's fail-closed run-start path
 *  consumes: the failing model/effort, the failing check, and a truthful reason.
 *  Constructed ONLY from a check whose status is `UNSUPPORTED`. */
export type UnsupportedModelConfigV1 = {
  schema: typeof UNSUPPORTED_MODEL_CONFIG_SCHEMA;
  model: string;
  effort: EffortLevelV1;
  failingCheck: ModelCapabilityCheckV1;
  reason: string;
};

/** The aggregate per-(model, effort) probe report: the four ordered check
 *  results, the live-call accounting, the overall verdict, and the
 *  fail-closed config (non-null iff a check is UNSUPPORTED). */
export type ModelCapabilityProbeReportV1 = {
  schema: typeof MODEL_CAPABILITY_PROBE_REPORT_SCHEMA;
  model: string;
  effort: EffortLevelV1;
  /** Whether the live checks were authorized this run (`--execute-live`). */
  executeLive: boolean;
  verifiedAt: string;
  /** Exactly four results, in MODEL_CAPABILITY_CHECKS order. */
  checks: ModelCapabilityCheckResultV1[];
  /** Live `codex exec` calls actually made (0 on the dry default path). */
  liveCallsMade: number;
  /** The hard per-model live-call budget the probe never exceeds. */
  liveCallBudget: number;
  overall: ModelCapabilityOverallV1;
  /** Non-null iff `overall === "UNSUPPORTED"` — the WP-504-consumable result. */
  unsupportedConfig: UnsupportedModelConfigV1 | null;
};

// ── validation ─────────────────────────────────────────────────────────────

const EFFORTS = ["minimal", "low", "medium", "high", "xhigh"] as const;

function isEnum(v: unknown, allowed: readonly string[]): boolean {
  return typeof v === "string" && allowed.includes(v);
}

function noUnknownKeys(v: Record<string, unknown>, allowed: readonly string[], errors: string[], where: string): void {
  for (const k of Object.keys(v)) {
    if (!allowed.includes(k)) errors.push(`${where}: unknown key "${k}"`);
  }
}

const CHECK_RESULT_KEYS = ["schema", "model", "effort", "check", "status", "reason"] as const;

export function validateModelCapabilityCheckResult(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["model-capability-check: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, CHECK_RESULT_KEYS as unknown as string[], errors, "model-capability-check");
  noUnknownKeys(v, CHECK_RESULT_KEYS as unknown as string[], errors, "model-capability-check");
  if (v.schema !== MODEL_CAPABILITY_CHECK_RESULT_SCHEMA) {
    errors.push(`model-capability-check: schema must be "${MODEL_CAPABILITY_CHECK_RESULT_SCHEMA}"`);
  }
  if (!isNonEmptyString(v.model)) errors.push("model-capability-check: model must be a non-empty string");
  if (!isEnum(v.effort, EFFORTS)) errors.push(`model-capability-check: unknown effort "${String(v.effort)}"`);
  if (!isEnum(v.check, MODEL_CAPABILITY_CHECKS)) {
    errors.push(`model-capability-check: check must be existence|auth-route|output-schema|effort-flag`);
  }
  if (!isEnum(v.status, MODEL_CAPABILITY_STATUSES)) {
    errors.push(`model-capability-check: status must be SUPPORTED|UNSUPPORTED|NOT_TESTED`);
  }
  if (!isNonEmptyString(v.reason)) errors.push("model-capability-check: reason must be a non-empty string");
  return errors;
}

const UNSUPPORTED_CONFIG_KEYS = ["schema", "model", "effort", "failingCheck", "reason"] as const;

export function validateUnsupportedModelConfig(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["unsupported-model-config: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, UNSUPPORTED_CONFIG_KEYS as unknown as string[], errors, "unsupported-model-config");
  noUnknownKeys(v, UNSUPPORTED_CONFIG_KEYS as unknown as string[], errors, "unsupported-model-config");
  if (v.schema !== UNSUPPORTED_MODEL_CONFIG_SCHEMA) {
    errors.push(`unsupported-model-config: schema must be "${UNSUPPORTED_MODEL_CONFIG_SCHEMA}"`);
  }
  if (!isNonEmptyString(v.model)) errors.push("unsupported-model-config: model must be a non-empty string");
  if (!isEnum(v.effort, EFFORTS)) errors.push(`unsupported-model-config: unknown effort "${String(v.effort)}"`);
  if (!isEnum(v.failingCheck, MODEL_CAPABILITY_CHECKS)) {
    errors.push("unsupported-model-config: failingCheck must be existence|auth-route|output-schema|effort-flag");
  }
  if (!isNonEmptyString(v.reason)) errors.push("unsupported-model-config: reason must be a non-empty string");
  return errors;
}

const PROBE_REPORT_KEYS = [
  "schema", "model", "effort", "executeLive", "verifiedAt", "checks",
  "liveCallsMade", "liveCallBudget", "overall", "unsupportedConfig",
] as const;

export function validateModelCapabilityProbeReport(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["model-capability-probe-report: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, PROBE_REPORT_KEYS as unknown as string[], errors, "model-capability-probe-report");
  noUnknownKeys(v, PROBE_REPORT_KEYS as unknown as string[], errors, "model-capability-probe-report");
  if (v.schema !== MODEL_CAPABILITY_PROBE_REPORT_SCHEMA) {
    errors.push(`model-capability-probe-report: schema must be "${MODEL_CAPABILITY_PROBE_REPORT_SCHEMA}"`);
  }
  if (!isNonEmptyString(v.model)) errors.push("model-capability-probe-report: model must be a non-empty string");
  if (!isEnum(v.effort, EFFORTS)) errors.push(`model-capability-probe-report: unknown effort "${String(v.effort)}"`);
  if (typeof v.executeLive !== "boolean") errors.push("model-capability-probe-report: executeLive must be a boolean");
  if (!isNonEmptyString(v.verifiedAt)) errors.push("model-capability-probe-report: verifiedAt must be a non-empty string");
  if (!Array.isArray(v.checks)) {
    errors.push("model-capability-probe-report: checks must be an array");
  } else {
    if (v.checks.length !== MODEL_CAPABILITY_CHECKS.length) {
      errors.push(`model-capability-probe-report: checks must carry all ${MODEL_CAPABILITY_CHECKS.length} ordered checks`);
    }
    v.checks.forEach((c, i) => {
      for (const e of validateModelCapabilityCheckResult(c)) errors.push(`model-capability-probe-report.checks[${i}]: ${e}`);
      if ((c as Record<string, unknown>)?.check !== MODEL_CAPABILITY_CHECKS[i]) {
        errors.push(`model-capability-probe-report.checks[${i}]: out of order (expected "${MODEL_CAPABILITY_CHECKS[i]}")`);
      }
    });
  }
  if (typeof v.liveCallsMade !== "number" || !Number.isInteger(v.liveCallsMade) || v.liveCallsMade < 0) {
    errors.push("model-capability-probe-report: liveCallsMade must be a non-negative integer");
  }
  if (typeof v.liveCallBudget !== "number" || v.liveCallBudget !== MODEL_CAPABILITY_LIVE_CALL_BUDGET) {
    errors.push(`model-capability-probe-report: liveCallBudget must be ${MODEL_CAPABILITY_LIVE_CALL_BUDGET}`);
  }
  if (typeof v.liveCallsMade === "number" && v.liveCallsMade > MODEL_CAPABILITY_LIVE_CALL_BUDGET) {
    errors.push("model-capability-probe-report: liveCallsMade exceeds the per-model live-call budget");
  }
  if (!isEnum(v.overall, MODEL_CAPABILITY_OVERALL)) {
    errors.push("model-capability-probe-report: overall must be SUPPORTED|UNSUPPORTED|NOT_FULLY_TESTED");
  }
  if (v.overall === "UNSUPPORTED") {
    for (const e of validateUnsupportedModelConfig(v.unsupportedConfig)) errors.push(`model-capability-probe-report.unsupportedConfig: ${e}`);
  } else if (v.unsupportedConfig !== null) {
    errors.push("model-capability-probe-report: unsupportedConfig must be null unless overall is UNSUPPORTED");
  }
  return errors;
}

/** Build the WP-504-consumable `UNSUPPORTED_MODEL_CONFIG` result from a check
 *  whose status is `UNSUPPORTED`. Throws on any other status — a supported or
 *  untested check must never be dressed up as a fail-closed config. */
export function unsupportedModelConfigFromCheck(check: ModelCapabilityCheckResultV1): UnsupportedModelConfigV1 {
  if (check.status !== "UNSUPPORTED") {
    throw new Error(`cannot build UNSUPPORTED_MODEL_CONFIG from a ${check.status} check (${check.check})`);
  }
  return {
    schema: UNSUPPORTED_MODEL_CONFIG_SCHEMA,
    model: check.model,
    effort: check.effort,
    failingCheck: check.check,
    reason: check.reason,
  };
}

export const MODEL_CAPABILITY_PROBE_CONTRACT: ContractDescriptor = {
  name: "model-capability-probe",
  version: 1,
  ownerPrompt: "WP-502",
  description:
    "Bounded fail-closed capability-probe result: a per-check record (existence|auth-route|output-schema|effort-flag → SUPPORTED|UNSUPPORTED|NOT_TESTED with a human reason), the WP-504-consumable UNSUPPORTED_MODEL_CONFIG result, and an aggregate per-(model,effort) report carrying the four ordered checks, live-call accounting (≤3/model), overall verdict, and the fail-closed config (non-null iff UNSUPPORTED). Existence uses the local models_cache.json only; the two live checks are --execute-live-gated and deferred to Phase 6.",
  fields: {
    ModelCapabilityCheckResultV1: {
      schema: "\"model-capability-check-result-v1\"",
      model: "string",
      effort: "\"minimal\"|\"low\"|\"medium\"|\"high\"|\"xhigh\"",
      check: "\"existence\"|\"auth-route\"|\"output-schema\"|\"effort-flag\"",
      status: "\"SUPPORTED\"|\"UNSUPPORTED\"|\"NOT_TESTED\"",
      reason: "string",
    },
    UnsupportedModelConfigV1: {
      schema: "\"unsupported-model-config-v1\"",
      model: "string",
      effort: "\"minimal\"|\"low\"|\"medium\"|\"high\"|\"xhigh\"",
      failingCheck: "\"existence\"|\"auth-route\"|\"output-schema\"|\"effort-flag\"",
      reason: "string",
    },
    ModelCapabilityProbeReportV1: {
      schema: "\"model-capability-probe-report-v1\"",
      model: "string",
      effort: "\"minimal\"|\"low\"|\"medium\"|\"high\"|\"xhigh\"",
      executeLive: "boolean",
      verifiedAt: "string",
      checks: "ModelCapabilityCheckResultV1[]",
      liveCallsMade: "number",
      liveCallBudget: "number",
      overall: "\"SUPPORTED\"|\"UNSUPPORTED\"|\"NOT_FULLY_TESTED\"",
      unsupportedConfig: "UnsupportedModelConfigV1|null",
    },
  },
};
