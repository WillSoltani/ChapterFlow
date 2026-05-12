/**
 * Writer — quiz.
 *
 * Produces a chapter's quiz (typically 6–12 multiple-choice application
 * questions). Respects ChapterDesignDoc.quizFocus exactly: count, Bloom's mix,
 * transferEmphasis. Outputs canonical Bloom's and depth enums.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { BookBrief, ChapterDesignDoc } from "../types.js";
import { BreakdownOutput } from "./writer-breakdown.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type QuizOutput = {
  passingScorePercent: number;
  questions: Array<{
    questionId: string;
    prompt: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
    bloomsLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    depthLevel: "simple" | "standard" | "deep";
  }>;
};

export type QuizInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  breakdown: BreakdownOutput;
};

export async function runWriterQuiz(input: QuizInput): Promise<QuizOutput> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "writer-quiz.system.md"),
    "utf8",
  );
  const userPrompt = buildUserPrompt(input);

  let attempt = 0;
  let lastErr: Error | null = null;
  while (attempt < 3) {
    attempt += 1;
    try {
      const reasons = lastErr
        ? lastErr.message.replace(/^quiz invalid:\s*/, "- ").replace(/;\s*/g, "\n- ")
        : "";
      const retryUser =
        attempt === 1
          ? userPrompt
          : [
              userPrompt,
              "",
              "# Your previous draft was rejected by the validator.",
              "Reasons:",
              reasons,
              "",
              "Rewrite the QuizOutput JSON. Every question must have exactly 3 choices. Each prompt asks the reader to apply the idea to a new situation; do not pose questions about a written artifact. Speak to the reader.",
              "CRITICAL: Distribute correctIndex values evenly — each position (0, 1, 2) must appear in roughly one-third of questions. No single position may appear in more than 50% of questions. Before writing, plan out your correctIndex sequence explicitly (e.g. 0,2,1,0,2,1,...) and stick to it.",
            ].join("\n");
      const result = await callClaude<QuizOutput>({
        tier: "writer",
        system: systemPrompt,
        user: retryUser,
        maxTokens: 6000,
        temperature: 0.55,
        jsonMode: true,
        timeoutMs: 360_000,
      });
      return validateQuiz(result.content, input);
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error("quiz writer failed after retries");
}

function buildUserPrompt(input: QuizInput): string {
  const parts: string[] = [];
  parts.push(`# Book brief`);
  parts.push("```json");
  parts.push(JSON.stringify(input.brief, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Chapter design doc`);
  parts.push("```json");
  parts.push(JSON.stringify(input.plan, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Chapter breakdown (for grounding — DO NOT quote or narrate)`);
  parts.push("## fastRead");
  parts.push(input.breakdown.fastRead);
  parts.push("## deepRead");
  parts.push(input.breakdown.deepRead);
  parts.push("");
  parts.push(`Write the QuizOutput JSON now. Count must equal ${input.plan.quizFocus.count}. Bloom's mix must match ${JSON.stringify(input.plan.quizFocus.bloomsMix)} exactly. Balance correctIndex across positions 0, 1, 2.`);
  return parts.join("\n");
}

const CANONICAL_BLOOMS = new Set(["remember","understand","apply","analyze","evaluate","create"]);
const CANONICAL_DEPTH = new Set(["simple","standard","deep"]);

function validateQuiz(q: QuizOutput, input: QuizInput): QuizOutput {
  const problems: string[] = [];
  if (!q || typeof q !== "object") throw new Error("quiz writer returned non-object");
  if (typeof q.passingScorePercent !== "number") q.passingScorePercent = 70;
  if (!Array.isArray(q.questions)) problems.push("questions missing");

  const expectedCount = input.plan.quizFocus.count;
  if (q.questions.length !== expectedCount) {
    problems.push(`question count ${q.questions.length} != expected ${expectedCount}`);
  }

  // Defense in depth: ship gate also catches these, but failing here forces
  // the writer's retry loop to fire instead of quarantining post-assembly.
  const metaRegexes = [
    /\bthis chapter\b/i,
    /\bthe chapter\b/i,
    /\bthe author\b/i,
    /\bthe book\b/i,
    /\bin this (chapter|section|book|law)\b/i,
    /\bchapter\s+\d+\b/,
  ];

  // Questions: canonical enums, position bounds, choice count
  for (const [i, question] of q.questions.entries()) {
    if (!question.prompt || question.prompt.length < 30) problems.push(`q${i} prompt too short`);
    if (!Array.isArray(question.choices) || question.choices.length !== 3) {
      problems.push(`q${i} must have exactly 3 choices (got ${question.choices?.length})`);
    }
    if (question.correctIndex < 0 || question.correctIndex > 2) {
      problems.push(`q${i} correctIndex out of range`);
    }
    if (!CANONICAL_BLOOMS.has(question.bloomsLevel)) {
      problems.push(`q${i} non-canonical bloomsLevel "${question.bloomsLevel}"`);
    }
    if (!CANONICAL_DEPTH.has(question.depthLevel)) {
      problems.push(`q${i} non-canonical depthLevel "${question.depthLevel}"`);
    }
    if (!question.explanation || question.explanation.length < 80) {
      problems.push(`q${i} explanation too short (${question.explanation?.length})`);
    }
    const qFullText = `${question.prompt} ${(question.choices ?? []).join(" ")} ${question.explanation ?? ""}`;
    for (const re of metaRegexes) {
      const m = qFullText.match(re);
      if (m) {
        problems.push(`q${i} contains meta-reference "${m[0]}"`);
        break;
      }
    }
    // enforce questionId format
    question.questionId = `q${String(i + 1).padStart(2, "0")}`;
  }

  // Bloom's mix: allow small deviation (±1 per level) to give the writer room
  if (input.plan.quizFocus.bloomsMix) {
    const actual: Record<string, number> = {};
    for (const qq of q.questions) actual[qq.bloomsLevel] = (actual[qq.bloomsLevel] ?? 0) + 1;
    for (const [level, expected] of Object.entries(input.plan.quizFocus.bloomsMix)) {
      const got = actual[level] ?? 0;
      if (Math.abs(got - (expected as number)) > 1) {
        problems.push(`bloom level "${level}" expected ${expected}, got ${got}`);
      }
    }
  }

  // Answer-position distribution
  const posCounts = [0, 0, 0];
  for (const qq of q.questions) posCounts[qq.correctIndex] += 1;
  const total = q.questions.length;
  if (total >= 4) {
    const maxFrac = Math.max(...posCounts) / total;
    if (maxFrac > 0.5) {
      problems.push(`correctIndex position ${posCounts.indexOf(Math.max(...posCounts))} wins ${(maxFrac * 100).toFixed(0)}% (max 50%)`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`quiz invalid: ${problems.join("; ")}`);
  }
  return q;
}
