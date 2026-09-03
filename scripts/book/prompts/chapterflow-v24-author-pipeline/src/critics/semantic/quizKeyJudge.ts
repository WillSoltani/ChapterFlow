/**
 * SEMANTIC QC — Tier 1 vertical slice: quiz answer-key correctness.
 *
 * The deterministic gates (finalGate.ts / bookGate.ts) cannot tell whether a
 * quiz's `correctIndex` actually points at the right answer — `pickCorrectIndex`
 * only validates the index is in range. That blind spot shipped the `hooked`
 * book with 21 of 72 questions marking the WRONG choice correct, past a GREEN
 * book-gate. This module closes that one blind spot.
 *
 * Method (matches the design in this session's roadmap, Lever A / D1):
 *   1. For each question, show a model the prompt + the three choices + the
 *      author's explanation (+ optional source notes) but HIDE `correctIndex`.
 *   2. Ask it to independently derive which choice is correct, with a confidence
 *      and the verbatim text of the choice it picked.
 *   3. Compare the model's index to the stored `correctIndex`. A CONFIDENT
 *      disagreement is a flag (the key is probably wrong). A medium-confidence
 *      disagreement is routed to human review, never auto-blocked. Low
 *      confidence or agreement is silent.
 *
 * Design guarantees:
 *   - SEPARATE TIER. This never runs inside runShipGate/runBookGate; those stay
 *     deterministic, offline, fast. This is opt-in and model-backed.
 *   - INJECTABLE model fn (`AskModel`) so detection/veto/report logic remains
 *     unit-testable with a deterministic oracle.
 *   - Model-backed execution requires injected `ModelTaskRunner` context.
 *     This module owns no provider, process, credential, or fallback route.
 */

import {
  jsonPromptRequest,
  type ModelCallerExecution,
} from "../../app/modelTaskRunner.js";
import type { ChapterV21 } from "../../types.js";
import type { ProviderName } from "../../providers/types.js";

export type Confidence = "high" | "medium" | "low";

/** One question's verdict. */
export type QuizKeyVerdict = {
  questionId: string;
  storedIndex: number;
  modelIndex: number;
  confidence: Confidence;
  agree: boolean;
  /** Confident disagreement => the answer key is probably wrong (veto candidate). */
  flagged: boolean;
  /** The verbatim choice text the model believes is correct (forces it to cite). */
  modelCorrectText: string;
  reason: string;
};

export type QuizKeyReport = {
  chapterId: string;
  questionsJudged: number;
  /** Confident mismatches — these are the "wrong answer key" findings. */
  flagged: QuizKeyVerdict[];
  /** Medium-confidence mismatches — surfaced for a human read, never auto-blocked. */
  review: QuizKeyVerdict[];
  all: QuizKeyVerdict[];
  cost: { inputTokens: number; outputTokens: number; estimatedCostUsd: number; calls: number };
  model: string;
};

/** A single judgment for one question. Injectable so tests can supply an oracle. */
export type ModelJudgment = {
  index: number;
  confidence: Confidence;
  correctText: string;
  reason: string;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number; model: string };
};

export type AskModel = (args: {
  prompt: string;
  choices: string[];
  explanation?: string;
  sourceContext?: string;
}) => Promise<ModelJudgment>;

const JUDGE_SYSTEM = `You are a meticulous exam answer-key auditor. You are given one multiple-choice question, its three choices, the author's explanation, and (optionally) source notes that are GROUND TRUTH about the book the question is drawn from.

Your job: independently determine which single choice is the correct answer to the question. Reason for yourself from the question and the source notes; treat the author's explanation as strong evidence of intent but VERIFY it — the explanation can be right while the marked key is wrong, which is exactly the defect you exist to catch.

Rules:
- Pick exactly one 0-based index (0, 1, or 2).
- Quote the verbatim text of the choice you picked.
- Confidence "high" only when the question has one defensibly-correct answer and you are sure. Use "medium" if you lean one way but the question is somewhat ambiguous. Use "low" if the question is genuinely ambiguous or underdetermined — do NOT force a high-confidence answer on a vague question.
- One-sentence reason.`;

/** Build the per-question user prompt (correctIndex is never included). */
export function buildJudgeUserPrompt(args: {
  prompt: string;
  choices: string[];
  explanation?: string;
  sourceContext?: string;
}): string {
  return [
    `QUESTION:\n${args.prompt}`,
    `CHOICES:\n${args.choices.map((c, i) => `[${i}] ${c}`).join("\n")}`,
    args.explanation ? `AUTHOR EXPLANATION (evidence of intent — verify, do not assume correct):\n${args.explanation}` : "",
    args.sourceContext ? `SOURCE NOTES (ground truth):\n${args.sourceContext}` : "",
    `Return a single JSON object: {"index": <0|1|2>, "confidence": "high"|"medium"|"low", "correctText": "<verbatim text of the choice at your chosen index>", "reason": "<one sentence>"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Model-backed implementation. Execution must be supplied by app composition;
 *  this critic owns no provider, process, credential, or fallback route. */
export function makeLiveAskModel(opts?: {
  execution?: ModelCallerExecution;
  /** Retained only so old callers fail at runtime instead of selecting a provider. */
  provider?: ProviderName;
  model?: string;
}): AskModel {
  return async (args) => {
    if (opts?.provider !== undefined || opts?.model !== undefined) {
      throw new Error("UNSUPPORTED_MODEL_SELECTOR");
    }
    const execution = opts?.execution;
    if (!execution) throw new Error("MODEL_TASK_RUNNER_REQUIRED");
    const result = await execution.runner.run({
      profileId: "pipeline-read-json-v1",
      role: "qc",
      prompt: jsonPromptRequest(JUDGE_SYSTEM, buildJudgeUserPrompt(args)),
      context: execution.context,
    });
    if (result.outcome !== "SUCCEEDED" || !isModelJudgment(result.output)) {
      const detail = result.error ? `${result.error.code}:${result.error.message}` : "invalid model output";
      throw new Error(`QUIZ_KEY_MODEL_${result.outcome}:${detail}`);
    }
    return {
      index: result.output.index,
      confidence: result.output.confidence,
      correctText: result.output.correctText,
      reason: result.output.reason,
    };
  };
}

function isModelJudgment(value: unknown): value is Omit<ModelJudgment, "usage"> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  return Number.isInteger(output.index) && Number(output.index) >= 0 && Number(output.index) <= 2 &&
    (output.confidence === "high" || output.confidence === "medium" || output.confidence === "low") &&
    typeof output.correctText === "string" && typeof output.reason === "string";
}

/** Judge every quiz question's answer key in one chapter. */
export async function judgeQuizKeys(
  chapter: ChapterV21,
  opts?: { ask?: AskModel; sourceContext?: string },
): Promise<QuizKeyReport> {
  const ask = opts?.ask ?? makeLiveAskModel();
  const all: QuizKeyVerdict[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCostUsd = 0;
  let calls = 0;
  let model = "";

  const questions = chapter.quiz?.questions ?? [];
  for (const q of questions) {
    const explanation = typeof q.explanation === "string" ? q.explanation : undefined;
    const j = await ask({ prompt: q.prompt, choices: q.choices, explanation, sourceContext: opts?.sourceContext });
    calls++;
    if (j.usage) {
      inputTokens += j.usage.inputTokens;
      outputTokens += j.usage.outputTokens;
      estimatedCostUsd += j.usage.estimatedCostUsd;
      model = j.usage.model || model;
    }
    const agree = j.index === q.correctIndex;
    all.push({
      questionId: q.questionId,
      storedIndex: q.correctIndex,
      modelIndex: j.index,
      confidence: j.confidence,
      agree,
      flagged: !agree && j.confidence === "high",
      modelCorrectText: j.correctText,
      reason: j.reason,
    });
  }

  return {
    chapterId: chapter.chapterId,
    questionsJudged: all.length,
    flagged: all.filter((v) => v.flagged),
    review: all.filter((v) => !v.agree && v.confidence === "medium"),
    all,
    cost: { inputTokens, outputTokens, estimatedCostUsd, calls },
    model,
  };
}

/** Pretty-print a report in the style of the deterministic gate reports. */
export function formatQuizKeyReport(report: QuizKeyReport): string {
  const lines: string[] = [];
  const verdict = report.flagged.length === 0 ? "PASS" : "BLOCK";
  lines.push(`Quiz answer-key judge: ${verdict} (${report.chapterId})`);
  lines.push(`  questions judged: ${report.questionsJudged}  |  flagged (wrong key): ${report.flagged.length}  |  review: ${report.review.length}`);
  if (report.model) lines.push(`  model: ${report.model}  |  cost: ~$${report.cost.estimatedCostUsd.toFixed(4)} (${report.cost.calls} calls)`);
  for (const v of report.flagged) {
    lines.push(`    [WRONG KEY] ${v.questionId}: stored correctIndex=${v.storedIndex} but the correct answer is index ${v.modelIndex}`);
    lines.push(`      model says correct: "${truncate(v.modelCorrectText, 120)}"`);
    lines.push(`      reason: ${truncate(v.reason, 160)}`);
  }
  for (const v of report.review) {
    lines.push(`    [REVIEW] ${v.questionId}: model leans index ${v.modelIndex} (stored ${v.storedIndex}), medium confidence — ${truncate(v.reason, 120)}`);
  }
  return lines.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
