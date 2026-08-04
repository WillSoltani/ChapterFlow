/**
 * EffectiveContextManifestV1 + ExecResultV1 — the frozen "what the model call
 * ACTUALLY received / produced" evidence contract (IMP-00 item 9, F-019).
 *
 * The manifest is captured immutably BEFORE spawn: binary identity, exact argv
 * (task replaced by its hash — cards can be 18k+ chars), working directory and
 * its policy, environment KEY NAMES (never values, except the two non-secret
 * strict pipeline invariants), isolated CODEX_HOME provenance (source path
 * identifier — never credential bytes or credential hashes), the discovered
 * project-instruction chain with per-file hashes + neutralization flags, the
 * role workspace file manifest when one exists, resolved model/effort/sandbox,
 * task hash, CLI qualification reference, and the profile hash.
 *
 * The result sidecar is written after the process ends: exit/outcome, duration,
 * stdout/stderr sizes + hashes, and which channel supplied the final message
 * (`-o` file = authoritative; last-stdout-line = recorded fallback).
 *
 * IMP-10's attempt-evidence store LINKS to these files; it does not replace them.
 */

import { ContractDescriptor, expectFields, isNonEmptyString } from "./contractUtil.js";
import type { AgentRole, CodexSandboxV1, WorkingDirPolicyV1 } from "./executionProfile.js";

export type InstructionSourceV1 = {
  path: string;
  sha256: string;
  bytes: number;
  /** true when the envelope neutralized discovery of this file (project docs
   *  disabled / ignored config); the file is still hashed as evidence. */
  neutralized: boolean;
};

export type WorkspaceFileV1 = { relPath: string; sha256: string; bytes: number };

export type EffectiveContextManifestV1 = {
  schema: "effective-context-manifest-v1";
  manifestVersion: 1;
  sessionId: string;
  role: AgentRole;
  profileHash: string;
  bin: { path: string; version: string; sha256?: string };
  /** Exact argv with the positional task replaced by "<task-sha256:...>". */
  argv: string[];
  cwd: string;
  cwdPolicy: WorkingDirPolicyV1;
  /** Child environment key NAMES (values never recorded here). */
  envKeys: string[];
  /** Caller-supplied env keys (subset of envKeys; intentional, recorded). */
  callerEnvKeys: string[];
  /** The non-secret strict pipeline invariants, values included. */
  strictEnv: Record<string, string>;
  codexHome: { dir: string; authMaterial: "auth.json" | "none"; authSourcePath?: string };
  instructionSources: InstructionSourceV1[];
  workspace?: { dir: string; files: WorkspaceFileV1[] };
  model: string;
  reasoningEffort: string;
  sandbox: CodexSandboxV1;
  timeoutMs: number;
  taskSha256: string;
  taskBytes: number;
  qualification: { cliVersion: string; flagsRequired: string[]; synthetic: boolean };
  createdAtIso: string;
};

export type ExecResultV1 = {
  schema: "exec-result-v1";
  sessionId: string;
  exitCode: number;
  ok: boolean;
  durationMs: number;
  stdoutSha256: string;
  stdoutBytes: number;
  stderrSha256: string;
  stderrBytes: number;
  finalMessageSource: "output-file" | "stdout-fallback";
  finalMessageSha256: string;
  endedAtIso: string;
};

export function validateEffectiveContextManifest(m: unknown): string[] {
  const errors: string[] = [];
  if (m === null || typeof m !== "object") return ["manifest: not an object"];
  const v = m as Record<string, unknown>;
  expectFields(v, [
    "schema", "manifestVersion", "sessionId", "role", "profileHash", "bin", "argv", "cwd",
    "cwdPolicy", "envKeys", "callerEnvKeys", "strictEnv", "codexHome", "instructionSources",
    "model", "reasoningEffort", "sandbox", "timeoutMs", "taskSha256", "taskBytes",
    "qualification", "createdAtIso",
  ], errors, "manifest");
  if (v.schema !== "effective-context-manifest-v1") errors.push("manifest: wrong schema tag");
  if (!isNonEmptyString(v.sessionId)) errors.push("manifest: sessionId required");
  if (!isNonEmptyString(v.profileHash)) errors.push("manifest: profileHash required");
  if (!isNonEmptyString(v.model)) errors.push("manifest: model must be explicit");
  if (!Array.isArray(v.argv) || (v.argv as unknown[]).some((a) => typeof a !== "string")) errors.push("manifest: argv must be string[]");
  const argv = (v.argv as string[]) ?? [];
  if (argv.some((a) => a.length > 4096)) errors.push("manifest: argv element exceeds 4096 chars — task must be hash-replaced, never inlined");
  return errors;
}

export const EFFECTIVE_CONTEXT_CONTRACT: ContractDescriptor = {
  name: "effective-context-manifest",
  version: 1,
  ownerPrompt: "IMP-00",
  description: "Immutable pre-spawn capture of the effective Codex execution envelope (binary, argv, cwd, env keys, isolated home, instruction chain hashes, workspace manifest, model/effort/sandbox, task hash, qualification) plus a post-run result sidecar.",
  fields: {
    schema: "\"effective-context-manifest-v1\"",
    manifestVersion: "1",
    sessionId: "string",
    role: "AgentRole",
    profileHash: "sha256 of the canonical ExecutionProfileV1",
    bin: "{ path, version, sha256? }",
    argv: "string[] (task arg replaced by <task-sha256:...>)",
    cwd: "string",
    cwdPolicy: "WorkingDirPolicyV1",
    envKeys: "string[] (names only)",
    callerEnvKeys: "string[]",
    strictEnv: "Record<string,string> (non-secret invariants only)",
    codexHome: "{ dir, authMaterial: \"auth.json\"|\"none\", authSourcePath? }",
    instructionSources: "{ path, sha256, bytes, neutralized }[]",
    workspace: "{ dir, files: { relPath, sha256, bytes }[] }?",
    model: "string",
    reasoningEffort: "string",
    sandbox: "CodexSandboxV1",
    timeoutMs: "number",
    taskSha256: "string",
    taskBytes: "number",
    qualification: "{ cliVersion, flagsRequired: string[], synthetic: boolean }",
    createdAtIso: "string",
    __result_sidecar: "ExecResultV1 { schema: \"exec-result-v1\", sessionId, exitCode, ok, durationMs, stdoutSha256, stdoutBytes, stderrSha256, stderrBytes, finalMessageSource, finalMessageSha256, endedAtIso }",
  },
};
