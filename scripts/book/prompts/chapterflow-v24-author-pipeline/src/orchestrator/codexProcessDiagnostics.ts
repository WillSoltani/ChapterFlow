/**
 * Bounded subprocess diagnostics for retained Codex attempts.
 *
 * This module is intentionally process-only. It does not interpret reviewer
 * content, alter qualification outcomes, or provide another logging system.
 * Full streams live only in memory long enough to hash them; persisted text is
 * explicitly redacted and capped at 32 KiB per stream.
 */

import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { CodexRunnerProcessError } from "./codexAgent.js";

export const CODEX_PROCESS_DIAGNOSTICS_SCHEMA = "codex-process-diagnostics-v1" as const;
export const CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES = 32 * 1_024;
export const CODEX_PROCESS_DIAGNOSTICS_HEAD_BYTES = 8 * 1_024;
export const CODEX_PROCESS_DIAGNOSTICS_TAIL_BYTES = 24 * 1_024;
export const CODEX_PROCESS_DIAGNOSTICS_MAX_ERROR_BYTES = 8 * 1_024;

export type CodexProcessInvocationV1 = "NOT_INVOKED" | "RUNNER_THROWN" | "RUNNER_RETURNED";
export type CodexProcessFailureKindV1 =
  | "preflight_error"
  | "returned_nonzero"
  | "post_run_error"
  | "timeout"
  | "spawn_error"
  | "runner_error";

export type CodexProcessResultObservationV1 = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CodexProcessDiagnosticsV1 = {
  schema: typeof CODEX_PROCESS_DIAGNOSTICS_SCHEMA;
  attemptId: string;
  requestSha256: string;
  sessionId: string | null;
  invocation: CodexProcessInvocationV1;
  classification: string;
  failureKind: CodexProcessFailureKindV1 | null;
  errorName: string | null;
  errorMessage: string | null;
  timedOut: boolean;
  exitCode: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  stdoutSha256: string;
  stderrSha256: string;
  stdoutRetained: string;
  stderrRetained: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  diagnosticsSha256: string;
};

export type BuildCodexProcessDiagnosticsArgsV1 = {
  attemptId: string;
  requestSha256: string;
  sessionId: string | null;
  invocation: CodexProcessInvocationV1;
  classification: string;
  result?: CodexProcessResultObservationV1 | null;
  error?: unknown;
};

export type ExpectedCodexProcessDiagnosticsBindingV1 = Partial<Pick<
  CodexProcessDiagnosticsV1,
  "attemptId" | "requestSha256" | "sessionId" | "invocation" | "classification"
>>;

const SHA256 = /^[a-f0-9]{64}$/;
const INVOCATIONS: readonly CodexProcessInvocationV1[] = ["NOT_INVOKED", "RUNNER_THROWN", "RUNNER_RETURNED"];
const FAILURE_KINDS: readonly CodexProcessFailureKindV1[] = [
  "preflight_error",
  "returned_nonzero",
  "post_run_error",
  "timeout",
  "spawn_error",
  "runner_error",
];
const EXACT_KEYS = [
  "schema",
  "attemptId",
  "requestSha256",
  "sessionId",
  "invocation",
  "classification",
  "failureKind",
  "errorName",
  "errorMessage",
  "timedOut",
  "exitCode",
  "stdoutBytes",
  "stderrBytes",
  "stdoutSha256",
  "stderrSha256",
  "stdoutRetained",
  "stderrRetained",
  "stdoutTruncated",
  "stderrTruncated",
  "diagnosticsSha256",
] as const;

export class CodexProcessDiagnosticsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexProcessDiagnosticsValidationError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CodexProcessDiagnosticsValidationError(message);
}

function utf8Prefix(text: string, maximumBytes: number): string {
  let end = 0;
  let bytes = 0;
  for (const character of text) {
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > maximumBytes) break;
    bytes += characterBytes;
    end += character.length;
  }
  return text.slice(0, end);
}

function utf8Suffix(text: string, maximumBytes: number): string {
  let start = text.length;
  let bytes = 0;
  while (start > 0) {
    let characterStart = start - 1;
    const finalUnit = text.charCodeAt(characterStart);
    if (finalUnit >= 0xdc00 && finalUnit <= 0xdfff && characterStart > 0) {
      const priorUnit = text.charCodeAt(characterStart - 1);
      if (priorUnit >= 0xd800 && priorUnit <= 0xdbff) characterStart -= 1;
    }
    const character = text.slice(characterStart, start);
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > maximumBytes) break;
    bytes += characterBytes;
    start = characterStart;
  }
  return text.slice(start);
}

/** Small, explicit credential redaction. It intentionally does not redact
 * model names, CLI flags, paths, exit codes, provider status text, or ordinary
 * uses of words such as "token" and "authorization". */
export function redactCodexProcessDiagnosticsText(text: string): string {
  const marker = "[REDACTED]";
  const assignmentCredentialKey = String.raw`(?:(?:openai|anthropic|codex)[_-]?api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|auth[_-]?token|codex[_-]?auth[_-]?token|api[_-]?key|client[_-]?secret|password)`;
  const jsonCredentialKey = String.raw`(?:${assignmentCredentialKey}|authorization|cookie)`;
  return text
    .replace(
      new RegExp(`("${jsonCredentialKey}"\\s*:\\s*)"(?:\\\\.|[^"\\\\])*"`, "gi"),
      `$1"${marker}"`,
    )
    // Header-shaped fields must run before the generic assignment matcher;
    // otherwise only the word "Bearer" would be removed and its credential
    // could remain after the first whitespace.
    .replace(
      /\b((?:authorization|proxy-authorization)\s*[:=]\s*)(?:(?:bearer|basic)\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n]+)/gi,
      `$1${marker}`,
    )
    .replace(
      /\b((?:authorization|proxy-authorization)\s*[:=]\s*)([a-z0-9+/_=-]{16,})(?=\s|$)/gi,
      `$1${marker}`,
    )
    .replace(/\b((?:cookie|set-cookie)\s*:\s*)[^\r\n]*/gi, `$1${marker}`)
    .replace(
      new RegExp(`\\b((${assignmentCredentialKey})\\s*[:=]\\s*)(?:"[^"\\r\\n]*"|'[^'\\r\\n]*'|[^\\s,;\\r\\n]+)`, "gi"),
      `$1${marker}`,
    )
    .replace(/(--(?:api-key|access-token|refresh-token|id-token)(?:\s+|=))(?:"[^"]*"|'[^']*'|\S+)/gi, `$1${marker}`)
    .replace(/\bsk-(?:proj-)?[a-z0-9_-]{16,}\b/gi, marker)
    .replace(/\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/gi, marker);
}

export function retainBoundedCodexProcessStream(text: string): {
  retained: string;
  truncated: boolean;
  bytes: number;
  sha256: string;
} {
  const bytes = Buffer.byteLength(text);
  const sha256 = sha256Hex(text);
  // Redact the complete in-memory stream before selecting persisted text. This
  // prevents a credential crossing a head/tail cut from surviving as a partial
  // secret. Raw bytes and the full-stream hash above are computed first.
  const redacted = redactCodexProcessDiagnosticsText(text);
  const redactedBytes = Buffer.byteLength(redacted);
  // Redaction normally shrinks a stream, but many extremely short secret
  // values can make the explicit marker projection larger than the raw input.
  // The persisted 32 KiB ceiling is absolute, so truncate when either the raw
  // stream or its safe redacted projection exceeds it. Raw byte/hash evidence
  // above remains bound to the exact pre-redaction stream.
  const truncated = bytes > CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES
    || redactedBytes > CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES;
  // If credential redaction itself made an oversized raw stream fit, retain
  // that safe projection once. Prefix+suffix selection is only meaningful
  // while the redacted projection is still oversized; otherwise the slices
  // overlap and duplicate text that never occurred in the stream.
  const retained = redactedBytes > CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES
    ? `${utf8Prefix(redacted, CODEX_PROCESS_DIAGNOSTICS_HEAD_BYTES)}${utf8Suffix(redacted, CODEX_PROCESS_DIAGNOSTICS_TAIL_BYTES)}`
    : redacted;
  requireCondition(Buffer.byteLength(retained) <= CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES,
    "bounded Codex process stream exceeds the 32 KiB retention ceiling");
  return { retained, truncated, bytes, sha256 };
}

function boundedErrorText(text: string): string {
  return utf8Prefix(redactCodexProcessDiagnosticsText(text), CODEX_PROCESS_DIAGNOSTICS_MAX_ERROR_BYTES);
}

function normalizedError(error: unknown): { errorName: string; errorMessage: string } | null {
  if (error === undefined || error === null) return null;
  if (error instanceof CodexRunnerProcessError) {
    return {
      errorName: boundedErrorText(error.errorName || error.name || "Error"),
      errorMessage: boundedErrorText(error.errorMessage || error.message || "unknown runner error"),
    };
  }
  if (error instanceof Error) {
    return {
      errorName: boundedErrorText(error.name || "Error"),
      errorMessage: boundedErrorText(error.message || "unknown runner error"),
    };
  }
  return { errorName: "NonErrorThrown", errorMessage: boundedErrorText(String(error)) };
}

function processFailureKind(args: BuildCodexProcessDiagnosticsArgsV1): CodexProcessFailureKindV1 | null {
  if (args.invocation === "NOT_INVOKED") return args.error === undefined || args.error === null ? null : "preflight_error";
  if (args.invocation === "RUNNER_RETURNED") {
    if (args.result?.exitCode !== 0) return "returned_nonzero";
    return args.error === undefined || args.error === null ? null : "post_run_error";
  }
  if (args.error instanceof CodexRunnerProcessError) return args.error.failureKind;
  return "runner_error";
}

export function codexProcessDiagnosticsSha256(
  value: Omit<CodexProcessDiagnosticsV1, "diagnosticsSha256">,
): string {
  return hashCanonical(value);
}

export function buildCodexProcessDiagnosticsV1(
  args: BuildCodexProcessDiagnosticsArgsV1,
): CodexProcessDiagnosticsV1 {
  requireCondition(typeof args.attemptId === "string" && args.attemptId.trim().length > 0,
    "Codex process diagnostics attemptId is required");
  requireCondition(SHA256.test(args.requestSha256),
    "Codex process diagnostics requestSha256 must be a lowercase SHA-256");
  requireCondition(INVOCATIONS.includes(args.invocation),
    `Codex process diagnostics invocation is invalid: ${String(args.invocation)}`);
  requireCondition(typeof args.classification === "string" && args.classification.trim().length > 0,
    "Codex process diagnostics classification is required");
  requireCondition(args.invocation === "NOT_INVOKED"
    ? args.sessionId === null && (args.result === undefined || args.result === null)
    : typeof args.sessionId === "string" && args.sessionId.trim().length > 0,
  "Codex process diagnostics session binding does not match invocation");
  requireCondition(args.invocation === "RUNNER_RETURNED"
    ? args.result !== undefined && args.result !== null
    : args.result === undefined || args.result === null,
  "Codex process diagnostics returned-result presence does not match invocation");

  const typedRunnerError = args.error instanceof CodexRunnerProcessError ? args.error : null;
  const stdout = args.invocation === "RUNNER_RETURNED"
    ? args.result!.stdout
    : args.invocation === "RUNNER_THROWN"
      ? typedRunnerError?.stdout ?? ""
      : "";
  const stderr = args.invocation === "RUNNER_RETURNED"
    ? args.result!.stderr
    : args.invocation === "RUNNER_THROWN"
      ? typedRunnerError?.stderr ?? ""
      : "";
  const stdoutProjection = retainBoundedCodexProcessStream(stdout);
  const stderrProjection = retainBoundedCodexProcessStream(stderr);
  const error = normalizedError(args.error);
  const core: Omit<CodexProcessDiagnosticsV1, "diagnosticsSha256"> = {
    schema: CODEX_PROCESS_DIAGNOSTICS_SCHEMA,
    attemptId: args.attemptId,
    requestSha256: args.requestSha256,
    sessionId: args.sessionId,
    invocation: args.invocation,
    classification: args.classification,
    failureKind: processFailureKind(args),
    errorName: error?.errorName ?? null,
    errorMessage: error?.errorMessage ?? null,
    timedOut: typedRunnerError?.timedOut ?? false,
    exitCode: args.invocation === "RUNNER_RETURNED"
      ? args.result!.exitCode
      : typedRunnerError?.exitCode ?? null,
    stdoutBytes: stdoutProjection.bytes,
    stderrBytes: stderrProjection.bytes,
    stdoutSha256: stdoutProjection.sha256,
    stderrSha256: stderrProjection.sha256,
    stdoutRetained: stdoutProjection.retained,
    stderrRetained: stderrProjection.retained,
    stdoutTruncated: stdoutProjection.truncated,
    stderrTruncated: stderrProjection.truncated,
  };
  const diagnostics = { ...core, diagnosticsSha256: codexProcessDiagnosticsSha256(core) };
  validateCodexProcessDiagnosticsV1(diagnostics, {
    attemptId: args.attemptId,
    requestSha256: args.requestSha256,
    sessionId: args.sessionId,
    invocation: args.invocation,
    classification: args.classification,
  });
  return diagnostics;
}

export function validateCodexProcessDiagnosticsV1(
  value: CodexProcessDiagnosticsV1,
  expected: ExpectedCodexProcessDiagnosticsBindingV1 = {},
): void {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value),
    "Codex process diagnostics must be an object");
  requireCondition(Object.keys(value).sort().join("\n") === [...EXACT_KEYS].sort().join("\n"),
    "Codex process diagnostics has missing or unexpected fields");
  requireCondition(value.schema === CODEX_PROCESS_DIAGNOSTICS_SCHEMA,
    "Codex process diagnostics schema mismatch");
  requireCondition(typeof value.attemptId === "string" && value.attemptId.trim().length > 0,
    "Codex process diagnostics attemptId is invalid");
  requireCondition(SHA256.test(value.requestSha256),
    "Codex process diagnostics request hash is invalid");
  requireCondition(INVOCATIONS.includes(value.invocation),
    "Codex process diagnostics invocation is invalid");
  requireCondition(typeof value.classification === "string" && value.classification.trim().length > 0,
    "Codex process diagnostics classification is invalid");
  requireCondition(value.failureKind === null || FAILURE_KINDS.includes(value.failureKind),
    "Codex process diagnostics failure kind is invalid");
  requireCondition((value.errorName === null && value.errorMessage === null)
      || (typeof value.errorName === "string" && value.errorName.length > 0
        && typeof value.errorMessage === "string" && value.errorMessage.length > 0),
  "Codex process diagnostics error fields are inconsistent");
  requireCondition((value.errorName === null || Buffer.byteLength(value.errorName) <= CODEX_PROCESS_DIAGNOSTICS_MAX_ERROR_BYTES)
      && (value.errorMessage === null || Buffer.byteLength(value.errorMessage) <= CODEX_PROCESS_DIAGNOSTICS_MAX_ERROR_BYTES),
  "Codex process diagnostics error field exceeds its byte bound");
  requireCondition(typeof value.timedOut === "boolean",
    "Codex process diagnostics timedOut must be boolean");
  requireCondition(value.exitCode === null || Number.isSafeInteger(value.exitCode),
    "Codex process diagnostics exitCode is invalid");
  requireCondition(Number.isSafeInteger(value.stdoutBytes) && value.stdoutBytes >= 0
      && Number.isSafeInteger(value.stderrBytes) && value.stderrBytes >= 0,
  "Codex process diagnostics stream byte counts are invalid");
  requireCondition(SHA256.test(value.stdoutSha256) && SHA256.test(value.stderrSha256),
    "Codex process diagnostics stream hashes are invalid");
  requireCondition(typeof value.stdoutRetained === "string" && typeof value.stderrRetained === "string"
      && Buffer.byteLength(value.stdoutRetained) <= CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES
      && Buffer.byteLength(value.stderrRetained) <= CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES,
  "Codex process diagnostics retained stream exceeds its byte bound");
  requireCondition(typeof value.stdoutTruncated === "boolean" && typeof value.stderrTruncated === "boolean"
      && (value.stdoutBytes <= CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES || value.stdoutTruncated)
      && (value.stderrBytes <= CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES || value.stderrTruncated),
  "Codex process diagnostics truncation flags underreport an oversized full stream");
  requireCondition(value.invocation === "NOT_INVOKED"
    ? value.sessionId === null
      && value.exitCode === null
      && value.stdoutBytes === 0
      && value.stderrBytes === 0
      && value.stdoutSha256 === sha256Hex("")
      && value.stderrSha256 === sha256Hex("")
      && value.stdoutRetained === ""
      && value.stderrRetained === ""
      && (value.failureKind === null || value.failureKind === "preflight_error")
    : typeof value.sessionId === "string" && value.sessionId.trim().length > 0,
  "Codex process diagnostics invocation/session/empty-stream binding is invalid");
  if (value.invocation === "RUNNER_RETURNED") {
    requireCondition(value.exitCode !== null && value.timedOut === false
        && (value.exitCode === 0
          ? value.failureKind === null || value.failureKind === "post_run_error"
          : value.failureKind === "returned_nonzero"),
    "Codex process diagnostics returned-runner binding is invalid");
  }
  if (value.invocation === "RUNNER_THROWN") {
    requireCondition(value.failureKind === "timeout"
        || value.failureKind === "spawn_error"
        || value.failureKind === "runner_error",
    "Codex process diagnostics thrown-runner failure kind is invalid");
    requireCondition(value.errorName !== null && value.errorMessage !== null,
      "Codex process diagnostics thrown-runner observation requires typed error details");
    requireCondition(value.timedOut === (value.failureKind === "timeout"),
      "Codex process diagnostics timeout flag/failure kind mismatch");
  }
  requireCondition(SHA256.test(value.diagnosticsSha256),
    "Codex process diagnostics self hash is invalid");
  const { diagnosticsSha256, ...core } = value;
  requireCondition(diagnosticsSha256 === codexProcessDiagnosticsSha256(core),
    "Codex process diagnostics self hash drift");

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (expectedValue !== undefined) {
      requireCondition(value[key as keyof CodexProcessDiagnosticsV1] === expectedValue,
        `Codex process diagnostics ${key} binding mismatch`);
    }
  }
}
