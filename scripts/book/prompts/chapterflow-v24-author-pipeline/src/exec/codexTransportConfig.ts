/**
 * Low-level `codex exec` transport configuration.
 *
 * This module owns only the fixed required flags and deterministic argv
 * assembly used by the hermetic execution envelope. Keeping this narrow makes
 * the one IMP-24D mechanical correction surface incapable of changing live
 * qualification, smoke evaluation, diagnostics, or process execution policy.
 */

import { existsSync, readFileSync } from "node:fs";

import type {
  CodexSandboxV1,
  ExecutionProfileV1,
} from "../contracts/executionProfile.js";
import {
  assertFlagsSupported,
  type CodexCliQualificationV1,
  ExecPreflightError,
} from "./cliQualification.js";

/** Flags every v1 hermetic spawn requires from the installed CLI. */
export const CODEX_EXEC_REQUIRED_FLAGS_BASE: readonly string[] = [
  "--sandbox", "-c", "--ignore-user-config", "--ignore-rules", "--output-last-message",
];

/** Exact keyword subset proven by the installed Codex structured-output path
 * and the earlier successful Stage-Q probe. Validation keywords that are not
 * in this set stay in deterministic post-parse validators. */
export const CODEX_TRANSPORT_SUPPORTED_SCHEMA_KEYWORDS = Object.freeze([
  "$schema",
  "$id",
  "title",
  "description",
  "type",
  "additionalProperties",
  "required",
  "properties",
  "items",
  "enum",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "multipleOf",
  "pattern",
  "format",
  "$defs",
  "$ref",
  "anyOf",
] as const);

const SUPPORTED_SCHEMA_KEYWORDS = new Set<string>(CODEX_TRANSPORT_SUPPORTED_SCHEMA_KEYWORDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function schemaTypeIncludes(value: unknown, expected: string): boolean {
  return value === expected || Array.isArray(value) && value.includes(expected);
}

function walkCodexTransportSchema(
  value: unknown,
  where: string,
  inventory: Set<string>,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${where}: schema node must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    inventory.add(key);
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(key)) {
      errors.push(`${where}.${key}: unsupported Codex transport schema keyword ${JSON.stringify(key)}`);
    }
  }

  if ("enum" in value && !("type" in value)) {
    errors.push(`${where}.type: enum schema must declare an explicit type`);
  }
  if ("format" in value && ![
    "date-time", "time", "date", "duration", "email", "hostname", "ipv4", "ipv6", "uuid",
  ].includes(String(value.format))) {
    errors.push(`${where}.format: unsupported Codex transport string format ${JSON.stringify(value.format)}`);
  }

  if (schemaTypeIncludes(value.type, "object")) {
    if (!isRecord(value.properties)) errors.push(`${where}.properties: object schema must define properties`);
    if (value.additionalProperties !== false) errors.push(`${where}.additionalProperties: object schema must set false`);
    if (!Array.isArray(value.required) || !value.required.every((item) => typeof item === "string")) {
      errors.push(`${where}.required: object schema must require every property`);
    } else if (isRecord(value.properties)) {
      const propertyNames = Object.keys(value.properties).sort();
      const required = [...value.required].sort();
      if (JSON.stringify(required) !== JSON.stringify(propertyNames)) {
        errors.push(`${where}.required: must contain every property exactly once`);
      }
    }
  }

  if (isRecord(value.properties)) {
    for (const [name, child] of Object.entries(value.properties)) {
      const childWhere = `${where}.properties.${name}`;
      if (!isRecord(child)) {
        errors.push(`${childWhere}: property schema must be an object`);
        continue;
      }
      if (!("type" in child) && !("$ref" in child) && !("anyOf" in child)) {
        errors.push(`${childWhere}: property schema must declare type, $ref, or anyOf`);
      }
      walkCodexTransportSchema(child, childWhere, inventory, errors);
    }
  }
  if (isRecord(value.$defs)) {
    for (const [name, child] of Object.entries(value.$defs)) {
      walkCodexTransportSchema(child, `${where}.$defs.${name}`, inventory, errors);
    }
  }
  if (schemaTypeIncludes(value.type, "array")) {
    if (!isRecord(value.items)) errors.push(`${where}.items: array schema must define one item schema`);
    else {
      if (!("type" in value.items) && !("$ref" in value.items) && !("anyOf" in value.items)) {
        errors.push(`${where}.items: item schema must declare type, $ref, or anyOf`);
      }
      walkCodexTransportSchema(value.items, `${where}.items`, inventory, errors);
    }
  }
  if (Array.isArray(value.anyOf)) {
    value.anyOf.forEach((child, index) =>
      walkCodexTransportSchema(child, `${where}.anyOf[${index}]`, inventory, errors));
  }
}

export function codexTransportSchemaKeywordInventory(schema: unknown): string[] {
  const inventory = new Set<string>();
  walkCodexTransportSchema(schema, "$", inventory, []);
  return [...inventory].sort();
}

export function codexTransportSchemaCompatibilityErrors(schema: unknown): string[] {
  const inventory = new Set<string>();
  const errors: string[] = [];
  walkCodexTransportSchema(schema, "$", inventory, errors);
  if (isRecord(schema) && schema.type !== "object") {
    errors.unshift(`$.type: root output schema must have type "object"`);
  }
  return errors;
}

export type CodexTransportOutputSchemaProjection = {
  canonicalPath: string;
  transportPath: string;
  projectedBytes: string | null;
  removedUniqueItems: number;
};

/** Validate and return the canonical model-facing schema. IMP-24E removes
 * provider-incompatible keywords from the committed schemas themselves, so no
 * ephemeral mutation may hide a future compatibility regression. */
export function describeCodexTransportOutputSchema(args: {
  outputSchemaPath: string;
  lastMessagePath: string;
}): CodexTransportOutputSchemaProjection {
  if (!existsSync(args.outputSchemaPath)) return {
    canonicalPath: args.outputSchemaPath,
    transportPath: args.outputSchemaPath,
    projectedBytes: null,
    removedUniqueItems: 0,
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(args.outputSchemaPath, "utf8"));
  } catch (error) {
    throw new ExecPreflightError(
      `output schema is not valid JSON (${(error as Error).message.split("\n")[0]})`,
    );
  }
  if (!isRecord(parsed)) throw new ExecPreflightError("output schema must be a JSON object");
  const errors = codexTransportSchemaCompatibilityErrors(parsed);
  if (errors.length > 0) {
    throw new ExecPreflightError(`output schema is not Codex-transport-compatible: ${errors.join("; ")}`);
  }
  return {
    canonicalPath: args.outputSchemaPath,
    transportPath: args.outputSchemaPath,
    projectedBytes: null,
    removedUniqueItems: 0,
  };
}

/** Return the validated canonical schema path. */
export function codexTransportOutputSchemaPath(args: {
  outputSchemaPath: string;
  lastMessagePath: string;
}): string {
  return describeCodexTransportOutputSchema(args).transportPath;
}

/** Build the hermetic `codex exec` argv. Flag order is FIXED (manifests diff
 *  cleanly): sandbox → git-check → isolation → project-doc neutralization →
 *  model → effort → add-dirs → output capture → task (always last). */
export function hermeticExecArgv(opts: {
  profile: ExecutionProfileV1;
  qualification: CodexCliQualificationV1;
  sandbox: CodexSandboxV1;
  model: string;
  reasoningEffort: string;
  writableRoots: readonly string[];
  skipGitRepoCheck: boolean;
  lastMessagePath: string;
  task: string;
  /** §16 D1 (owner directive 2026-07-11): when a structured-output JSON Schema
   *  file is supplied, the broker binds `--output-schema <file>` so the model's
   *  FINAL response is constrained to the schema at the execution layer — not by
   *  a prose legend. Stays on the ChatGPT-subscription codex exec route. */
  outputSchemaPath?: string;
}): string[] {
  const required = opts.outputSchemaPath
    ? [...opts.profile.requiredCliFlags, "--output-schema"]
    : opts.profile.requiredCliFlags;
  assertFlagsSupported(opts.qualification, required);
  if (!opts.profile.allowedSandboxes.includes(opts.sandbox)) {
    throw new ExecPreflightError(
      `role "${opts.profile.role}" does not allow sandbox "${opts.sandbox}" (allowed: ${opts.profile.allowedSandboxes.join(", ")})`,
    );
  }
  const argv = ["exec", "--sandbox", opts.sandbox];
  if (opts.skipGitRepoCheck) argv.push("--skip-git-repo-check");
  if (opts.profile.ignoreUserConfig) argv.push("--ignore-user-config");
  if (opts.profile.ignoreRules) argv.push("--ignore-rules");
  if (opts.profile.neutralizeProjectDocs) argv.push("-c", "project_doc_max_bytes=0");
  argv.push("-c", `model=${opts.model}`);
  argv.push("-c", `model_reasoning_effort=${opts.reasoningEffort}`);
  if (opts.sandbox === "workspace-write") {
    for (const dir of opts.writableRoots) argv.push("--add-dir", dir);
  }
  if (opts.outputSchemaPath) {
    argv.push("--output-schema", codexTransportOutputSchemaPath({
      outputSchemaPath: opts.outputSchemaPath,
      lastMessagePath: opts.lastMessagePath,
    }));
  }
  argv.push("--output-last-message", opts.lastMessagePath);
  argv.push(opts.task);
  return argv;
}
