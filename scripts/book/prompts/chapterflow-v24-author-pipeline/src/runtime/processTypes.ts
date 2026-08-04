export interface ProcessSpec {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly stdin: Uint8Array;
  readonly environment: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly terminateGraceMs: number;
  readonly maxStdoutBytes: number;
  readonly maxStderrBytes: number;
  readonly signal: AbortSignal;
}

export type ProcessOutcome =
  | "EXITED"
  | "SPAWN_FAILED"
  | "TIMED_OUT"
  | "CANCELLED"
  | "OUTPUT_LIMIT"
  | "CLEANUP_FAILED";

export interface ProcessResult {
  readonly outcome: ProcessOutcome;
  readonly exitCode?: number;
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
  readonly stdoutTruncated: boolean;
  readonly stderrTruncated: boolean;
}

export interface ProcessSupervisor {
  run(spec: ProcessSpec): Promise<ProcessResult>;
}
