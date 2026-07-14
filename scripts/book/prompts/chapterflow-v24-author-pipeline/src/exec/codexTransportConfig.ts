/**
 * Low-level `codex exec` transport configuration.
 *
 * This module owns only the fixed required flags and deterministic argv
 * assembly used by the hermetic execution envelope. Keeping this narrow makes
 * the one IMP-24D mechanical correction surface incapable of changing live
 * qualification, smoke evaluation, diagnostics, or process execution policy.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

const CODEX_TRANSPORT_SCHEMA_FILENAME_PREFIX = "codex-output-schema.transport";
const SCHEMA_MAP_KEYS = new Set([
  "$defs", "definitions", "dependentSchemas", "patternProperties", "properties",
]);
const SCHEMA_ARRAY_KEYS = new Set(["allOf", "anyOf", "oneOf", "prefixItems"]);
const SCHEMA_SINGLE_KEYS = new Set([
  "additionalItems", "additionalProperties", "contains", "contentSchema", "else", "if",
  "items", "not", "propertyNames", "then", "unevaluatedItems", "unevaluatedProperties",
]);

function sha256Hex(bytes: string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneLiteral(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneLiteral);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneLiteral(child)]));
}

/** Project one canonical JSON Schema into the strict subset accepted by the
 * ChatGPT-authenticated Codex transport. The production schema is never
 * modified: this removes only the provider-rejected `uniqueItems` assertion
 * from an ephemeral execution copy. The canonical post-parse validators still
 * enforce uniqueness, so an output with duplicates remains invalid and gets no
 * retry or favorable reinterpretation. */
function projectCodexTransportSchemaNode(value: unknown): { value: unknown; removedUniqueItems: number } {
  if (!isRecord(value)) return { value, removedUniqueItems: 0 };

  let removedUniqueItems = 0;
  const projectedEntries: Array<[string, unknown]> = [];
  for (const [key, child] of Object.entries(value)) {
    if (key === "uniqueItems") {
      removedUniqueItems += 1;
      continue;
    }
    if (SCHEMA_MAP_KEYS.has(key) && isRecord(child)) {
      const projectedMapEntries: Array<[string, unknown]> = [];
      for (const [name, childSchema] of Object.entries(child)) {
        const result = projectCodexTransportSchemaNode(childSchema);
        removedUniqueItems += result.removedUniqueItems;
        projectedMapEntries.push([name, result.value]);
      }
      projectedEntries.push([key, Object.fromEntries(projectedMapEntries)]);
      continue;
    }
    if (key === "dependencies" && isRecord(child)) {
      const projectedDependencyEntries: Array<[string, unknown]> = [];
      for (const [name, dependency] of Object.entries(child)) {
        if (Array.isArray(dependency)) {
          projectedDependencyEntries.push([name, cloneLiteral(dependency)]);
          continue;
        }
        const result = projectCodexTransportSchemaNode(dependency);
        removedUniqueItems += result.removedUniqueItems;
        projectedDependencyEntries.push([name, result.value]);
      }
      projectedEntries.push([key, Object.fromEntries(projectedDependencyEntries)]);
      continue;
    }
    if (SCHEMA_ARRAY_KEYS.has(key) && Array.isArray(child)) {
      const projectedSchemas = child.map((childSchema) => {
        const result = projectCodexTransportSchemaNode(childSchema);
        removedUniqueItems += result.removedUniqueItems;
        return result.value;
      });
      projectedEntries.push([key, projectedSchemas]);
      continue;
    }
    if (SCHEMA_SINGLE_KEYS.has(key)) {
      if (key === "items" && Array.isArray(child)) {
        const projectedItems = child.map((childSchema) => {
          const result = projectCodexTransportSchemaNode(childSchema);
          removedUniqueItems += result.removedUniqueItems;
          return result.value;
        });
        projectedEntries.push([key, projectedItems]);
      } else {
        const result = projectCodexTransportSchemaNode(child);
        removedUniqueItems += result.removedUniqueItems;
        projectedEntries.push([key, result.value]);
      }
      continue;
    }
    // Unknown keywords and annotation/validation values are data, not schema
    // containers. Deep-clone them without interpreting a property name such as
    // `uniqueItems` inside `default`, `enum`, or `dependentRequired` as a schema
    // assertion. This also preserves own keys named `__proto__`.
    projectedEntries.push([key, cloneLiteral(child)]);
  }
  return { value: Object.fromEntries(projectedEntries), removedUniqueItems };
}

export type CodexTransportOutputSchemaProjection = {
  canonicalPath: string;
  transportPath: string;
  projectedBytes: string | null;
  removedUniqueItems: number;
};

/** Purely derive the exact schema path and bytes Codex should receive. The
 * descriptor is also used by retained-evidence verification so the recorded
 * manifest remains a truthful description of the actual process argv. */
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
  const projected = projectCodexTransportSchemaNode(parsed);
  if (projected.removedUniqueItems === 0) return {
    canonicalPath: args.outputSchemaPath,
    transportPath: args.outputSchemaPath,
    projectedBytes: null,
    removedUniqueItems: 0,
  };
  const bytes = `${JSON.stringify(projected.value, null, 2)}\n`;
  const path = resolve(dirname(args.lastMessagePath),
    `${CODEX_TRANSPORT_SCHEMA_FILENAME_PREFIX}.${sha256Hex(bytes)}.json`);
  return {
    canonicalPath: args.outputSchemaPath,
    transportPath: path,
    projectedBytes: bytes,
    removedUniqueItems: projected.removedUniqueItems,
  };
}

/** Materialize only the ephemeral provider projection. The canonical schema
 * is never modified; the session cleanup removes this private 0600 file. */
export function codexTransportOutputSchemaPath(args: {
  outputSchemaPath: string;
  lastMessagePath: string;
}): string {
  const projection = describeCodexTransportOutputSchema(args);
  if (projection.projectedBytes !== null) {
    writeFileSync(projection.transportPath, projection.projectedBytes, { encoding: "utf8", mode: 0o600 });
  }
  return projection.transportPath;
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
