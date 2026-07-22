import type { PortError, Result } from "../contracts/v4Core.js";

export interface ExecutionProfile {
  readonly id: string;
  readonly workDirPolicy: "PIPELINE_ROOT" | "ATTEMPT_ROOT";
  readonly mode: "READ_ONLY" | "WORKSPACE_WRITE";
  readonly outputSchemaId: string;
  readonly timeoutMs: number;
  readonly terminateGraceMs: number;
  readonly maxStdoutBytes: number;
  readonly maxStderrBytes: number;
  /** Task 6 (model-routing mechanism): optional pipeline-role tag a caller may
   *  attach to a profile so route selection (`resolveRoleRoute`, codexRoute.ts)
   *  can pick a per-role model/effort. Unset today on every source-controlled
   *  profile — no call site threads it through yet; Task 7/8 wire per-task
   *  role tagging into the gateway. */
  readonly role?: "research" | "author" | "repair" | "review" | "qc";
}

export interface ResolvedExecutionPolicy {
  readonly profile: ExecutionProfile;
  readonly workDir: string;
  readonly environment: Readonly<Record<string, string>>;
}

export interface ExecutionPolicy {
  resolve(profileId: string, workDir: string): Result<ResolvedExecutionPolicy>;
  validateOutput(outputSchemaId: string, bytes: Uint8Array): Result<unknown>;
}

export interface ExecutionPolicyError extends PortError {
  readonly code:
    | "PROFILE_NOT_FOUND"
    | "PROFILE_INVALID"
    | "WORKDIR_INVALID"
    | "WORKDIR_POLICY_VIOLATION"
    | "ENVIRONMENT_INVALID"
    | "OUTPUT_INVALID";
}
