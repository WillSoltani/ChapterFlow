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
  SourceClaimType,
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
import type { GenerationRunManifestV1 } from "./generationDegradation.js";
import { formatRuntimeFindings, RuntimeSchemaFinding, validateAssembleInput } from "./runtimeSchemas.js";
import type { BookContentReader, CandidateSelector, CandidateSnapshot } from "./books/candidateTypes.js";

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
  generation?: GenerationRunManifestV1;
};

export interface AuthorV4ContentSelection {
  readonly bookId: string;
  readonly selector: CandidateSelector;
  readonly snapshot: CandidateSnapshot;
}

export async function openAuthorV4ContentSelection(
  reader: BookContentReader,
  input: Readonly<{ bookId: string; selector: CandidateSelector }>,
): Promise<AuthorV4ContentSelection> {
  if (input.selector.kind !== "CANDIDATE") throw new Error("V4 content selector blocked: CURRENT/ambient fallback is forbidden");
  const opened = await reader.open(input);
  if (!opened.ok) throw new Error(`V4 content selector blocked: ${opened.error.code}: ${opened.error.message}`);
  const selection = { ...input, snapshot: opened.value };
  const invalid = authorV4SelectionError(selection);
  if (invalid) throw new Error(`V4 content selector blocked: ${invalid}`);
  return selection;
}

export function authorV4SelectionError(selection: AuthorV4ContentSelection): string | null {
  if (selection.snapshot.manifest.bookId !== selection.bookId) return "candidate snapshot bookId differs from explicit selector context";
  if (selection.selector.kind !== "CANDIDATE") return "CURRENT/ambient fallback is forbidden";
  if (selection.snapshot.manifest.candidateId !== selection.selector.candidateId) return "candidate snapshot differs from explicit candidate selector";
  return null;
}

export function readAuthorV4SelectedText(selection: AuthorV4ContentSelection, logicalPath: string): string {
  const invalid = authorV4SelectionError(selection);
  if (invalid) throw new Error(`V4 content selector blocked: ${invalid}`);
  const matches = selection.snapshot.files.filter((file) => file.logicalPath === logicalPath);
  if (matches.length !== 1) throw new Error(`V4 content selector blocked: expected one ${logicalPath}, found ${matches.length}`);
  return Buffer.from(matches[0].bytes).toString("utf8");
}

export function readAuthorV4SelectedJson<T>(selection: AuthorV4ContentSelection, logicalPath: string): T {
  return JSON.parse(readAuthorV4SelectedText(selection, logicalPath)) as T;
}

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
  const planAnchors = input.sourceEvidence?.anchors ?? [];
  const defaultAnchors = defaultAnchorIds(planAnchors, plan);
  // Claim-type-aware default anchor: the fallback for an example / quiz unit must
  // be an anchor that can SUPPORT that claim type, or SC11.6 false-gates a grounded
  // unit (a concept anchor cannot support example/quiz claims).
  const defaultAnchorsFor = (claimType: SourceClaimType): string[] => defaultAnchorIds(planAnchors, plan, claimType);
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
      normalizeAnchorIds(spec?.sourceAnchorIds).length > 0 ? normalizeAnchorIds(spec?.sourceAnchorIds) : defaultAnchorsFor("example"),
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
      const fallback = normalizeAnchorIds(plan.quizFocus.sourceAnchorIds).length > 0 ? normalizeAnchorIds(plan.quizFocus.sourceAnchorIds) : defaultAnchorsFor("quiz_prompt");
      const sourceAnchorIds = remember(`quiz.questions[${i}]`, q.sourceAnchorIds ?? q.sourceAnchorId, fallback);
      const keyEvidenceAnchorIds = remember(`quiz.questions[${i}].keyEvidence`, q.keyEvidenceAnchorIds, sourceAnchorIds);
      return {
        questionId: q.questionId,
        sourceAnchorId: q.sourceAnchorId ?? sourceAnchorIds[0],
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
    schemaVersion: V21_SCHEMA_VERSION,
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
    authoring: input.sourceEvidence?.sourceV2 || input.generation
      ? {
          schemaVersion: "chapter-authoring-v1",
          ...(input.sourceEvidence?.sourceV2
            ? {
                sourceAnchors: {
                  schemaVersion: "chapter-source-anchor-map-v1" as const,
                  sourceHash: input.sourceEvidence.sourceHash,
                  sourceSidecarPath: input.sourceEvidence.chapterSidecarPath ?? undefined,
                  observedAnchorIds: input.sourceEvidence.anchors.map((anchor) => anchor.id),
                  effectiveAnchors: Object.fromEntries(Object.entries(anchorMap).filter(([, ids]) => ids.length > 0)),
                },
              }
            : {}),
          ...(input.generation ? { generation: input.generation } : {}),
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

function defaultAnchorIds(anchors: SourceAnchorForPrompt[], plan: ChapterDesignDoc, claimType?: SourceClaimType): string[] {
  const planned = normalizeAnchorIds(plan.coreMoveSourceAnchorIds);
  if (planned.length > 0) return planned;
  // Never fall back to an anchor that CANNOT support the unit's claim type. A
  // concept anchor cannot support example / quiz claims, so a generic concept
  // fallback for an example or quiz unit self-inflicts an SC11.6 unsupported_anchor
  // blocker on perfectly-grounded content. Prefer a claim-type-supporting anchor
  // (a concept first when it qualifies, else any eligible); only when NO anchor can
  // support the claim do we fall back to any anchor (the prior behavior — SC11.6 may
  // then fire, but only because the source genuinely lacks a supporting anchor).
  const eligible = claimType ? anchors.filter((a) => a.supportsClaimTypes?.includes(claimType)) : anchors;
  const eligibleConcept = eligible.find((anchor) => anchor.kind === "concept");
  if (eligibleConcept) return [eligibleConcept.id];
  if (eligible.length > 0) return eligible.slice(0, 1).map((anchor) => anchor.id);
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
