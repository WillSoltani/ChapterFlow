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
  SourceAnchorForPrompt,
  V21_SCHEMA_VERSION,
} from "./types.js";
import { BreakdownOutput } from "./agents/writer-breakdown.js";
import { ExampleOutput } from "./agents/writer-example.js";
import { QuizOutput } from "./agents/writer-quiz.js";
import { CardsOutput } from "./agents/writer-cards.js";
import { ImplementationPlanOutput } from "./agents/writer-implementation-plan.js";
import { HookOutput } from "./agents/writer-hook.js";
import { MemorableLine } from "./agents/memorable-lines.js";
import type { PlanningSourceEvidence } from "./source/sourceEvidence.js";
import { formatRuntimeFindings, RuntimeSchemaFinding, validateAssembleInput } from "./runtimeSchemas.js";

export type AssembleInput = {
  plan: ChapterDesignDoc;
  breakdown: BreakdownOutput;
  examples: ExampleOutput[];
  quiz: QuizOutput;
  cards: CardsOutput;
  implementationPlan: ImplementationPlanOutput;
  keyTakeaway: string;
  keyTakeawaySourceAnchorIds?: string[];
  hook: HookOutput;
  tryThisNow?: string;
  tryThisNowSourceAnchorIds?: string[];
  memorableLines?: MemorableLine[];
  sourceEvidence?: PlanningSourceEvidence;
};

export type AssembleChapterResult =
  | { ok: true; chapter: ChapterV21; findings: [] }
  | { ok: false; findings: RuntimeSchemaFinding[] };

export class AssemblyValidationError extends Error {
  readonly findings: RuntimeSchemaFinding[];

  constructor(findings: RuntimeSchemaFinding[]) {
    super(`assembleChapterV21 input failed runtime schema: ${formatRuntimeFindings(findings)}`);
    this.name = "AssemblyValidationError";
    this.findings = findings;
  }
}

export function assembleChapterV21(input: unknown): AssembleChapterResult {
  return tryAssembleChapterV21(input);
}

export function tryAssembleChapterV21(input: unknown): AssembleChapterResult {
  const parsed = validateAssembleInput(input);
  if (!parsed.ok) return { ok: false, findings: parsed.findings };
  return { ok: true, chapter: assembleChapterV21Validated(parsed.value), findings: [] };
}

export function assembleChapterV21OrThrow(input: unknown): ChapterV21 {
  const result = tryAssembleChapterV21(input);
  if (!result.ok) throw new AssemblyValidationError(result.findings);
  return result.chapter;
}

function assembleChapterV21Validated(input: AssembleInput): ChapterV21 {
  const { plan, breakdown, examples, quiz, cards, implementationPlan, keyTakeaway, hook } = input;
  const anchorMap: Record<string, string[]> = {};
  const defaultAnchors = defaultAnchorIds(input.sourceEvidence?.anchors ?? [], plan);
  const remember = (path: string, ids: unknown, fallback: string[] = defaultAnchors): string[] => {
    const normalized = normalizeAnchorIds(ids);
    const chosen = normalized.length > 0 ? normalized : fallback;
    if (chosen.length > 0) anchorMap[path] = chosen;
    return chosen;
  };

  const assembledExamples: ExampleV21[] = examples.map((ex, i) => {
    const spec = plan.exampleSpecs[i];
    const sourceAnchorIds = remember(
      `examples[${i}]`,
      ex.sourceAnchorIds ?? ex.sourceAnchorId,
      normalizeAnchorIds(spec?.sourceAnchorIds).length > 0 ? normalizeAnchorIds(spec?.sourceAnchorIds) : defaultAnchors,
    );
    return {
      exampleId: ex.exampleId || `ch${String(plan.number).padStart(2, "0")}-ex${String(i + 1).padStart(2, "0")}`,
      sourceAnchorId: ex.sourceAnchorId ?? sourceAnchorIds[0],
      sourceAnchorIds,
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
    questions: quiz.questions.map((q, i) => {
      const fallback = normalizeAnchorIds(plan.quizFocus.sourceAnchorIds).length > 0 ? normalizeAnchorIds(plan.quizFocus.sourceAnchorIds) : defaultAnchors;
      const sourceAnchorIds = remember(`quiz.questions[${i}]`, q.sourceAnchorIds ?? q.sourceAnchorId, fallback);
      const keyEvidenceAnchorIds = remember(`quiz.questions[${i}].keyEvidence`, q.keyEvidenceAnchorIds, sourceAnchorIds);
      return {
        questionId: q.questionId,
        sourceAnchorId: q.sourceAnchorId ?? sourceAnchorIds[0],
        sourceAnchorIds,
        keyEvidenceAnchorIds,
        prompt: q.prompt,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        bloomsLevel: q.bloomsLevel,
        depthLevel: q.depthLevel,
      };
    }),
  };

  const assembledCards: ReviewCardV21[] = cards.cards.map((c, i) => {
    const fallback = normalizeAnchorIds(plan.cardFocus.sourceAnchorIds).length > 0 ? normalizeAnchorIds(plan.cardFocus.sourceAnchorIds) : defaultAnchors;
    const sourceAnchorIds = remember(`reviewCards[${i}]`, c.sourceAnchorIds ?? c.sourceAnchorId, fallback);
    return {
      cardId: c.cardId,
      sourceAnchorId: c.sourceAnchorId ?? sourceAnchorIds[0],
      sourceAnchorIds,
      front: c.front,
      back: c.back,
      difficulty: c.difficulty,
    };
  });

  const planFallback = normalizeAnchorIds(plan.coreMoveSourceAnchorIds).length > 0 ? normalizeAnchorIds(plan.coreMoveSourceAnchorIds) : defaultAnchors;
  const assembledPlan: ImplementationPlanV21 = {
    title: implementationPlan.title,
    titleSourceAnchorIds: remember("implementationPlan.title", implementationPlan.titleSourceAnchorIds, planFallback),
    coreSkill: implementationPlan.coreSkill,
    coreSkillSourceAnchorIds: remember("implementationPlan.coreSkill", implementationPlan.coreSkillSourceAnchorIds, planFallback),
    ifThenPlans: implementationPlan.ifThenPlans.map((it, i) => {
      const ids = remember(`implementationPlan.ifThenPlans[${i}]`, it.sourceAnchorIds ?? it.sourceAnchorId, planFallback);
      return {
        sourceAnchorId: it.sourceAnchorId ?? ids[0],
        sourceAnchorIds: ids,
        context: it.context,
        plan: it.plan,
      };
    }),
    twentyFourHourChallenge: implementationPlan.twentyFourHourChallenge,
    twentyFourHourChallengeSourceAnchorIds: remember("implementationPlan.twentyFourHourChallenge", implementationPlan.twentyFourHourChallengeSourceAnchorIds, planFallback),
    weeklyPractice: implementationPlan.weeklyPractice,
    weeklyPracticeSourceAnchorIds: remember("implementationPlan.weeklyPractice", implementationPlan.weeklyPracticeSourceAnchorIds, planFallback),
  };

  const hookAnchors = remember("hook", hook.sourceAnchorIds, planFallback);
  if (hook.counterintuition) remember("counterintuition", hook.counterintuitionSourceAnchorIds, hookAnchors);
  remember("keyTakeaway", input.keyTakeawaySourceAnchorIds, planFallback);
  if (input.tryThisNow) remember("tryThisNow", input.tryThisNowSourceAnchorIds, planFallback);
  remember("breakdown.fastRead", breakdown.sourceAnchorIds?.fastRead, planFallback);
  remember("breakdown.deepRead", breakdown.sourceAnchorIds?.deepRead, planFallback);
  remember("breakdown.fullRead", breakdown.sourceAnchorIds?.fullRead, planFallback);
  input.memorableLines?.forEach((line, i) => {
    remember(`memorableLines[${i}]`, line.sourceAnchorIds, anchorIdsForLocation(anchorMap, line.location, planFallback));
  });

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
    authoring: input.sourceEvidence?.sourceV2
      ? {
          schemaVersion: "chapter-authoring-v1",
          sourceAnchors: {
            schemaVersion: "chapter-source-anchor-map-v1",
            sourceHash: input.sourceEvidence.sourceHash,
            sourceSidecarPath: input.sourceEvidence.chapterSidecarPath ?? undefined,
            observedAnchorIds: input.sourceEvidence.anchors.map((anchor) => anchor.id),
            effectiveAnchors: Object.fromEntries(Object.entries(anchorMap).filter(([, ids]) => ids.length > 0)),
          },
        }
      : undefined,
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

function normalizeAnchorIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function defaultAnchorIds(anchors: SourceAnchorForPrompt[], plan: ChapterDesignDoc): string[] {
  const planned = normalizeAnchorIds(plan.coreMoveSourceAnchorIds);
  if (planned.length > 0) return planned;
  const concept = anchors.find((anchor) => anchor.kind === "concept");
  if (concept) return [concept.id];
  return anchors.slice(0, 1).map((anchor) => anchor.id);
}

function anchorIdsForLocation(anchorMap: Record<string, string[]>, location: string, fallback: string[]): string[] {
  if (anchorMap[location]?.length) return anchorMap[location];
  const normalized = location.replace(/^example\[(\d+)\]\..+$/, "examples[$1]");
  if (anchorMap[normalized]?.length) return anchorMap[normalized];
  return fallback;
}
