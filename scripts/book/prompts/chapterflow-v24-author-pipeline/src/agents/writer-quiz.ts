import type { BookBrief, ChapterDesignDoc, SourceAnchorForPrompt } from "../types.js";
import type { BreakdownOutput } from "./writer-breakdown.js";
import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

export type QuizOutput = {
  passingScorePercent: number;
  questions: Array<{
    questionId: string;
    sourceAnchorId?: string;
    sourceAnchorIds?: string[];
    keyEvidenceAnchorIds?: string[];
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
  sourceAnchors?: SourceAnchorForPrompt[];
};

/** Legacy direct writer. Compiler application port owns authoring. */
export async function runWriterQuiz(_input: QuizInput): Promise<QuizOutput> {
  throw legacyRouteDisabled("writer.runWriterQuiz");
}
