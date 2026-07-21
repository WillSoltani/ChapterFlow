import type { CandidateSnapshot } from "../books/candidateTypes.js";
import type { ModelTaskContext, Result } from "../contracts/v4Core.js";
import type { CanonicalReviewEvaluation, CanonicalReviewEvaluator, ReviewIssue } from "../review/reviewTypes.js";
import type { ModelTaskRunner } from "./modelTaskRunner.js";
import { jsonPromptRequest } from "./modelTaskRunner.js";

const REVIEW_SYSTEM = `Review candidate book content. Return JSON only:
{"outcome":"PASS"|"FAIL"|"ERROR","issues":[{"code":"...","severity":"INFO"|"WARN"|"BLOCKER","message":"...","location":"optional"}]}
PASS must contain no BLOCKER issue. Preserve uncertainty as ERROR.`;

function failure(code: string, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

function candidateText(candidate: CandidateSnapshot): string {
  const decoder = new TextDecoder();
  return candidate.files.map((file) => [
    `FILE ${file.logicalPath} (${file.mediaType})`,
    decoder.decode(file.bytes),
  ].join("\n")).join("\n\n");
}

function parseIssue(value: unknown): ReviewIssue | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const issue = value as Record<string, unknown>;
  if (typeof issue.code !== "string" || typeof issue.message !== "string") return null;
  if (issue.severity !== "INFO" && issue.severity !== "WARN" && issue.severity !== "BLOCKER") return null;
  if (issue.location !== undefined && typeof issue.location !== "string") return null;
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    ...(issue.location === undefined ? {} : { location: issue.location }),
  };
}

function parseEvaluation(value: unknown): CanonicalReviewEvaluation | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.outcome !== "PASS" && record.outcome !== "FAIL" && record.outcome !== "ERROR") return null;
  if (!Array.isArray(record.issues)) return null;
  const issues = record.issues.map(parseIssue);
  if (issues.some((issue) => issue === null)) return null;
  const normalized = issues as ReviewIssue[];
  if (record.outcome === "PASS" && normalized.some((issue) => issue.severity === "BLOCKER")) return null;
  return { outcome: record.outcome, issues: normalized };
}

export class ModelGatewayReviewEvaluator implements CanonicalReviewEvaluator {
  readonly #runner: ModelTaskRunner;

  constructor(runner: ModelTaskRunner) {
    this.#runner = runner;
  }

  async evaluate(input: Readonly<{
    candidate: CandidateSnapshot;
    taskContext: ModelTaskContext;
  }>): Promise<Result<CanonicalReviewEvaluation>> {
    const result = await this.#runner.run({
      profileId: "pipeline-read-json-v1",
      prompt: jsonPromptRequest(REVIEW_SYSTEM, candidateText(input.candidate)),
      context: input.taskContext,
    });
    if (result.outcome !== "SUCCEEDED") {
      const message = result.error ? `${result.error.code}:${result.error.message}` : result.outcome;
      return failure("REVIEW_MODEL_FAILED", message);
    }
    const evaluation = parseEvaluation(result.output);
    return evaluation ? { ok: true, value: evaluation } : failure("REVIEW_MODEL_OUTPUT_INVALID", "review model output is invalid");
  }
}
