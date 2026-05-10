/**
 * Assembles agent outputs into the v21-native BookPackageV21 / ChapterV21
 * shape. Single canonical voice. No tone matrix. No redundant summary fields.
 *
 * Downstream consumers branch on `schemaVersion === "chapterflow-v21-authored"`
 * to know how to read this. Legacy v13 consumers are unaffected — v13 files
 * still exist and still validate against their v13 schema.
 */

import {
  ChapterDesignDoc,
  ChapterV21,
  ExampleV21,
  ImplementationPlanV21,
  QuizV21,
  ReviewCardV21,
  V21_SCHEMA_VERSION,
} from "./types.js";
import { BreakdownOutput } from "./agents/writer-breakdown.js";
import { ExampleOutput } from "./agents/writer-example.js";
import { QuizOutput } from "./agents/writer-quiz.js";
import { CardsOutput } from "./agents/writer-cards.js";
import { ImplementationPlanOutput } from "./agents/writer-implementation-plan.js";
import { HookOutput } from "./agents/writer-hook.js";
import { MemorableLine } from "./agents/memorable-lines.js";

export type AssembleInput = {
  plan: ChapterDesignDoc;
  breakdown: BreakdownOutput;
  examples: ExampleOutput[];
  quiz: QuizOutput;
  cards: CardsOutput;
  implementationPlan: ImplementationPlanOutput;
  keyTakeaway: string;
  hook: HookOutput;
  tryThisNow?: string;
  memorableLines?: MemorableLine[];
};

export function assembleChapterV21(input: AssembleInput): ChapterV21 {
  const { plan, breakdown, examples, quiz, cards, implementationPlan, keyTakeaway, hook } = input;

  const assembledExamples: ExampleV21[] = examples.map((ex, i) => {
    const spec = plan.exampleSpecs[i];
    return {
      exampleId: ex.exampleId || `ch${String(plan.number).padStart(2, "0")}-ex${String(i + 1).padStart(2, "0")}`,
      title: ex.title,
      tags: buildTags(spec),
      planSpec: {
        domain: spec.domain,
        audience: spec.audience,
        stakes: spec.stakes,
        format: spec.format,
        requiredBeat: spec.requiredBeat,
      },
      scenario: ex.scenario,
      whatToDo: ex.whatToDo,
      whyItMatters: ex.whyItMatters,
    };
  });

  const assembledQuiz: QuizV21 = {
    passingScorePercent: quiz.passingScorePercent ?? 70,
    questions: quiz.questions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      bloomsLevel: q.bloomsLevel,
      depthLevel: q.depthLevel,
    })),
  };

  const assembledCards: ReviewCardV21[] = cards.cards.map((c) => ({
    cardId: c.cardId,
    front: c.front,
    back: c.back,
    difficulty: c.difficulty,
  }));

  const assembledPlan: ImplementationPlanV21 = {
    coreSkill: implementationPlan.coreSkill,
    ifThenPlans: implementationPlan.ifThenPlans.map((it) => ({
      context: it.context,
      plan: it.plan,
    })),
    twentyFourHourChallenge: implementationPlan.twentyFourHourChallenge,
    weeklyPractice: implementationPlan.weeklyPractice,
  };

  return {
    chapterId: plan.chapterId,
    number: plan.number,
    title: plan.title,
    readingTimeMinutes: plan.readingTimeMinutes,
    hook: hook.hook,
    counterintuition: hook.counterintuition,
    tryThisNow: input.tryThisNow,
    keyTakeaway,
    breakdown: {
      fastRead: breakdown.fastRead,
      deepRead: breakdown.deepRead,
      fullRead: breakdown.fullRead,
    },
    examples: assembledExamples,
    quiz: assembledQuiz,
    reviewCards: assembledCards,
    implementationPlan: assembledPlan,
    memorableLines: input.memorableLines,
  };
}

export { V21_SCHEMA_VERSION };

/** Build ≤4 short display tags from a planner spec. Keeps the user-facing
 *  tag surface crisp; the full spec lives on example.planSpec for tooling. */
function buildTags(spec: ChapterDesignDoc["exampleSpecs"][number]): string[] {
  const tags: string[] = [spec.format];
  // Extract 1-2 short nouns from the domain as additional tags.
  const domainWords = spec.domain.toLowerCase().split(/\s+/);
  const interesting = domainWords.filter(
    (w) => w.length > 4 && !["about", "against", "under", "their", "which", "while", "versus"].includes(w),
  );
  if (interesting.length > 0) tags.push(interesting[0].replace(/[^a-z]/g, ""));
  if (interesting.length > 2) tags.push(interesting[2].replace(/[^a-z]/g, ""));
  return tags.filter(Boolean).slice(0, 4);
}
