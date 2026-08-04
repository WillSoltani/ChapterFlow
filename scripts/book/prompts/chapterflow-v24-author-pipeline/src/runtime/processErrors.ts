import { isAbsolute } from "node:path";

import type { ProcessSpec } from "./processTypes.js";

export class ProcessSpecError extends Error {
  readonly code = "PROCESS_SPEC_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "ProcessSpecError";
  }
}

function positiveSafeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function validateProcessSpec(spec: ProcessSpec): string[] {
  const errors: string[] = [];
  if (typeof spec.command !== "string" || spec.command.length === 0 || spec.command.includes("\0")) {
    errors.push("command must be a non-empty string without null bytes");
  }
  if (!Array.isArray(spec.args) || spec.args.some((arg) => typeof arg !== "string" || arg.includes("\0"))) {
    errors.push("args must be strings without null bytes");
  }
  if (typeof spec.cwd !== "string" || !isAbsolute(spec.cwd) || spec.cwd.includes("\0")) {
    errors.push("cwd must be an absolute path without null bytes");
  }
  if (!(spec.stdin instanceof Uint8Array)) errors.push("stdin must be Uint8Array");
  if (spec.environment === null || typeof spec.environment !== "object" || Array.isArray(spec.environment)) {
    errors.push("environment must be a string record");
  } else {
    for (const [name, value] of Object.entries(spec.environment)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || typeof value !== "string" || value.includes("\0")) {
        errors.push("environment contains an invalid name or value");
        break;
      }
    }
  }
  if (!positiveSafeInteger(spec.timeoutMs)) errors.push("timeoutMs must be a positive safe integer");
  if (!positiveSafeInteger(spec.terminateGraceMs)) errors.push("terminateGraceMs must be a positive safe integer");
  if (!positiveSafeInteger(spec.maxStdoutBytes)) errors.push("maxStdoutBytes must be a positive safe integer");
  if (!positiveSafeInteger(spec.maxStderrBytes)) errors.push("maxStderrBytes must be a positive safe integer");
  if (!(spec.signal instanceof AbortSignal)) errors.push("signal must be AbortSignal");
  return errors;
}

export function boundedProcessDiagnostic(code: string, maximumBytes: number): Uint8Array {
  const bytes = Buffer.from(code, "utf8");
  return new Uint8Array(bytes.subarray(0, Math.max(0, maximumBytes)));
}
