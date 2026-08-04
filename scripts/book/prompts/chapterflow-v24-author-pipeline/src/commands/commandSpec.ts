import type { GitSha, Result } from "../contracts/v4Core.js";

export interface CommandContext {
  readonly argv: readonly string[];
  readonly sourceGitSha: GitSha;
  readonly abortSignal: AbortSignal;
}

export interface CommandSpec {
  readonly id: string;
  readonly requiredConfig: readonly string[];
  readonly mode: "READ" | "WRITE" | "MODEL";
  run(context: CommandContext): Promise<Result<unknown>>;
}
