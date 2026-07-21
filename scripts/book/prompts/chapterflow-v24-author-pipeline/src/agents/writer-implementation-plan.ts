import type { BookBrief, ChapterDesignDoc, SourceAnchorForPrompt } from "../types.js";
import type { BreakdownOutput } from "./writer-breakdown.js";
import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

export type ImplementationPlanOutput = {
  title: string;
  titleSourceAnchorIds?: string[];
  coreSkill: string;
  coreSkillSourceAnchorIds?: string[];
  ifThenPlans: Array<{ sourceAnchorId?: string; sourceAnchorIds?: string[]; context: string; plan: string }>;
  twentyFourHourChallenge: string;
  twentyFourHourChallengeSourceAnchorIds?: string[];
  weeklyPractice: string;
  weeklyPracticeSourceAnchorIds?: string[];
};

export type PlanInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  breakdown: BreakdownOutput;
  sourceAnchors?: SourceAnchorForPrompt[];
};

/** Legacy direct writer. Compiler application port owns authoring. */
export async function runWriterImplementationPlan(_input: PlanInput): Promise<ImplementationPlanOutput> {
  throw legacyRouteDisabled("writer.runWriterImplementationPlan");
}
