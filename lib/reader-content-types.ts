/** Shared reader-content contracts consumed by route and marketing UI. */
export type ReadingDepth = "simple" | "standard" | "deeper";
export type ExampleScope = "work" | "school" | "personal";

export type ChapterQuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type ChapterSummaryBlock =
  | {
      id: string;
      type: "paragraph";
      text: string;
    }
  | {
      id: string;
      type: "bullet";
      text: string;
      detail?: string | undefined
    };

export type ScenarioDecisionOption = {
  id: string;
  text: string;
  isRecommended: boolean;
};

export type ChapterExample = {
  id: string;
  title: string;
  scope: ExampleScope;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  decisionOptions?: ScenarioDecisionOption[];
  reflectionPrompt?: string | undefined;
};

export type ImplementationPlanItem = {
  coreSkill: string;
  ifThenPlans: Array<{ context: string; plan: string }>;
  twentyFourHourChallenge: string;
  weeklyPractice: string;
};

export type ReviewCardItem = {
  id: string;
  front: string;
  back: string;
  difficulty: "easy" | "medium" | "hard";
};
