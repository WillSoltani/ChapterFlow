import type { ExecutionProfile } from "./executionPolicyTypes.js";

export interface ModelProcessRoute {
  readonly id: string;
  build(profile: ExecutionProfile): Readonly<{
    command: string;
    args: readonly string[];
  }>;
}

const FIXED_CODEX_MODEL = "gpt-5.5";
const FIXED_REASONING_EFFORT = "high";

/** Route id, exported so callers (e.g. ModelGateway's model-CLI preflight) can
 *  identify "this is the real codex route" without a magic string literal. */
export const CODEX_ROUTE_ID = "codex-chatgpt-subscription-v1";

/** Sole production mapping. Prompt never enters build(), so route cannot place
 * prompt/source bytes in argv. Final '-' tells Codex to consume task on stdin. */
export function createCodexRoute(): ModelProcessRoute {
  return Object.freeze({
    id: CODEX_ROUTE_ID,
    build(profile: ExecutionProfile) {
      const sandbox = profile.mode === "READ_ONLY" ? "read-only" : "workspace-write";
      const args = [
        "exec",
        "--sandbox",
        sandbox,
        ...(profile.workDirPolicy === "ATTEMPT_ROOT" ? ["--skip-git-repo-check"] : []),
        "--ignore-user-config",
        "--ignore-rules",
        "-c",
        "project_doc_max_bytes=0",
        "-c",
        `model=${FIXED_CODEX_MODEL}`,
        "-c",
        `model_reasoning_effort=${FIXED_REASONING_EFFORT}`,
        "-",
      ] as const;
      return { command: "codex", args };
    },
  });
}
