import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { boundedProcessDiagnostic, validateProcessSpec } from "./processErrors.js";
import { writePrivateInput } from "./privateInput.js";
import { processTreeAlive, terminateProcessTree } from "./processTree.js";
import type { ProcessOutcome, ProcessResult, ProcessSpec, ProcessSupervisor } from "./processTypes.js";

type BoundedCapture = {
  readonly chunks: Buffer[];
  length: number;
  truncated: boolean;
};

function captureChunk(capture: BoundedCapture, chunk: Buffer, maximum: number): boolean {
  const remaining = Math.max(0, maximum - capture.length);
  if (remaining > 0) {
    const kept = chunk.subarray(0, remaining);
    capture.chunks.push(kept);
    capture.length += kept.length;
  }
  if (chunk.length > remaining) capture.truncated = true;
  return capture.truncated;
}

function bytes(capture: BoundedCapture): Uint8Array {
  return new Uint8Array(Buffer.concat(capture.chunks, capture.length));
}

function emptyResult(outcome: ProcessOutcome, stderr: Uint8Array = new Uint8Array()): ProcessResult {
  return {
    outcome,
    stdout: new Uint8Array(),
    stderr,
    stdoutTruncated: false,
    stderrTruncated: false,
  };
}

export class NodeProcessSupervisor implements ProcessSupervisor {
  async run(spec: ProcessSpec): Promise<ProcessResult> {
    const validation = validateProcessSpec(spec);
    if (validation.length > 0) {
      return emptyResult("SPAWN_FAILED", boundedProcessDiagnostic("PROCESS_SPEC_INVALID", spec.maxStderrBytes || 1));
    }
    if (spec.signal.aborted) return emptyResult("CANCELLED");

    return new Promise<ProcessResult>((resolve) => {
      const stdout: BoundedCapture = { chunks: [], length: 0, truncated: false };
      const stderr: BoundedCapture = { chunks: [], length: 0, truncated: false };
      let desiredOutcome: ProcessOutcome | null = null;
      let cleanup: Promise<boolean> | null = null;
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      let child: ChildProcessWithoutNullStreams | undefined;

      const requestStop = (outcome: ProcessOutcome): void => {
        if (desiredOutcome === null) desiredOutcome = outcome;
        if (child?.pid !== undefined && cleanup === null) {
          cleanup = terminateProcessTree(child.pid, spec.terminateGraceMs);
          void cleanup.then(() => settle());
        }
      };

      const onAbort = (): void => requestStop("CANCELLED");

      const settle = async (exitCode?: number | null): Promise<void> => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        spec.signal.removeEventListener("abort", onAbort);
        let cleanupOk = true;
        if (child?.pid !== undefined) {
          if (cleanup !== null) cleanupOk = await cleanup;
          else if (processTreeAlive(child.pid)) cleanupOk = await terminateProcessTree(child.pid, spec.terminateGraceMs);
        }
        const outcome = cleanupOk ? (desiredOutcome ?? "EXITED") : "CLEANUP_FAILED";
        resolve({
          outcome,
          ...(outcome === "EXITED" && exitCode !== undefined && exitCode !== null ? { exitCode } : {}),
          stdout: bytes(stdout),
          stderr: bytes(stderr),
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
        });
      };

      try {
        child = spawn(spec.command, [...spec.args], {
          cwd: spec.cwd,
          env: { ...spec.environment },
          detached: true,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (error) {
        resolve(emptyResult("SPAWN_FAILED", boundedProcessDiagnostic("PROCESS_SPAWN_FAILED", spec.maxStderrBytes)));
        return;
      }

      child.stdout.on("data", (chunk: Buffer) => {
        if (captureChunk(stdout, chunk, spec.maxStdoutBytes)) requestStop("OUTPUT_LIMIT");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        if (captureChunk(stderr, chunk, spec.maxStderrBytes)) requestStop("OUTPUT_LIMIT");
      });
      child.once("error", (error: NodeJS.ErrnoException) => {
        desiredOutcome = "SPAWN_FAILED";
        const diagnostic = boundedProcessDiagnostic(`PROCESS_SPAWN_FAILED:${error.code ?? "UNKNOWN"}`, spec.maxStderrBytes);
        captureChunk(stderr, Buffer.from(diagnostic), spec.maxStderrBytes);
        requestStop("SPAWN_FAILED");
        void settle();
      });
      child.once("close", (code) => { void settle(code); });

      spec.signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => requestStop("TIMED_OUT"), spec.timeoutMs);
      if (spec.signal.aborted) requestStop("CANCELLED");
      void writePrivateInput(child.stdin, spec.stdin).catch(() => requestStop("SPAWN_FAILED"));
    });
  }
}

export function createProcessSupervisor(): ProcessSupervisor {
  return new NodeProcessSupervisor();
}
