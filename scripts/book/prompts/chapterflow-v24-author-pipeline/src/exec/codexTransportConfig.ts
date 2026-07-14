/**
 * Low-level `codex exec` transport configuration.
 *
 * This module owns only the fixed required flags and deterministic argv
 * assembly used by the hermetic execution envelope. Keeping this narrow makes
 * the one IMP-24D mechanical correction surface incapable of changing live
 * qualification, smoke evaluation, diagnostics, or process execution policy.
 */

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
  if (opts.outputSchemaPath) argv.push("--output-schema", opts.outputSchemaPath);
  argv.push("--output-last-message", opts.lastMessagePath);
  argv.push(opts.task);
  return argv;
}
