/** Shared shapes for the v26 lesson-first chapter tool. A chapter is the v21 authored chapter
 *  (the shape the app validator adapts); the tool adds chapterId/number/readingTimeMinutes at assembly. */

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

export interface RoleConfig {
  readonly bin: string;
  readonly model: string;
  readonly effort: Effort;
}

export interface Example {
  exampleId: string;
  title: string;
  tags: string[];
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
}

export interface QuizQuestion {
  questionId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  bloomsLevel: string;
}

export interface ReviewCard {
  cardId: string;
  front: string;
  back: string;
  difficulty: string;
}

export interface IfThenPlan {
  context: string;
  plan: string;
}

export interface Chapter {
  title: string;
  hook: string;
  counterintuition: string;
  keyTakeaway: string;
  tryThisNow: string;
  breakdown: { fastRead: string; deepRead: string; fullRead: string };
  examples: Example[];
  quiz: { passingScorePercent: number; questions: QuizQuestion[] };
  reviewCards: ReviewCard[];
  implementationPlan: {
    coreSkill: string;
    ifThenPlans: IfThenPlan[];
    twentyFourHourChallenge: string;
    weeklyPractice: string;
  };
  memorableLines: { text: string }[];
}

export interface ChapterSpan {
  chapterNumber: number;
  chapterTitle: string;
  startOffset: number;
  endOffset: number;
}
