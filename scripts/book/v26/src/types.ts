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

/** The writer's private note on the one lesson a chapter teaches; it rides along as `_lesson` and is stripped before checks. */
export interface LessonCard {
  lesson: string;
  wrongBelief: string;
  keyPhrase: string;
  hookQuestion: string;
  storyNames: string[];
  evidence: string[];
}

/** Which step raised an issue. */
export type IssueSource = "det" | "fact" | "lesson" | "quiz" | "keysolve" | "coldreader" | "nochapter" | "review";

export interface Issue {
  source: IssueSource;
  blocking: boolean;
  field?: string;
  text: string;
}
