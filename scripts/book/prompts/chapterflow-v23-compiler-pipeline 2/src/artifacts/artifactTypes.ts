import type { BreakdownOutput } from "../agents/writer-breakdown.js";
import type { CardsOutput } from "../agents/writer-cards.js";
import type { ExampleOutput } from "../agents/writer-example.js";
import type { HookOutput } from "../agents/writer-hook.js";
import type { ImplementationPlanOutput } from "../agents/writer-implementation-plan.js";
import type { MemorableLine } from "../agents/memorable-lines.js";
import type { QuizOutput } from "../agents/writer-quiz.js";
import type { ChapterDesignDoc, SourceAnchorForPrompt, SourceClaimType } from "../types.js";

export const V23_COMPILER_SCHEMA_VERSION = "chapterflow-v23-compiler" as const;
export const SOURCE_PACKET_SCHEMA_VERSION = "source-packet-v1" as const;
export const CHAPTER_BLUEPRINT_SCHEMA_VERSION = "chapter-blueprint-v1" as const;
export const SECTION_ARTIFACT_SCHEMA_VERSION = "section-artifact-v1" as const;
export const EVIDENCE_MAP_SCHEMA_VERSION = "chapter-evidence-map-v1" as const;
export const RISK_SCORE_SCHEMA_VERSION = "chapter-risk-score-v1" as const;

export type CompilerStage =
  | "source-packets"
  | "blueprints"
  | "sections"
  | "assembly"
  | "evidence"
  | "risk";

export type CompilerRunRecord = {
  schemaVersion: typeof V23_COMPILER_SCHEMA_VERSION;
  bookId: string;
  runId: string;
  createdAt: string;
  architecture: "compiler";
  finalChapterSchema: "chapterflow-v21-authored";
};

export type SourcePacketFact = {
  id: string;
  claim: string;
  mechanism: string;
  commonError: string;
  whyWrong: string;
  allowedClaimTypes: SourceClaimType[];
  groundedNumbers: string[];
  groundedEntities: string[];
  groundedPlaces: string[];
  verificationRefs: string[];
  replicationStatus?: "robust" | "mixed" | "contested" | "failed";
};

export type SourcePacketCase = {
  id: string;
  label: string;
  summary: string;
  realWorld: boolean;
  naturalSetting?: string;
  hardSpecifics: string[];
  allowedUses: SourceClaimType[];
  forbiddenUses: string[];
  doNotRestamp: string[];
};

export type SourcePacketFramework = {
  id: string;
  name: string;
  members: string[];
  completenessRequired: boolean;
};

export type SourcePacketV1 = {
  schemaVersion: typeof SOURCE_PACKET_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  sourceSidecarPath: string | null;
  sourceHash: string | null;
  facts: SourcePacketFact[];
  namedCases: SourcePacketCase[];
  frameworks: SourcePacketFramework[];
  allowedAnchors: SourceAnchorForPrompt[];
  allowedNumbers: string[];
  allowedEntities: string[];
  allowedPlaces: string[];
  forbiddenClaims: string[];
  forbiddenLeakage: Array<{ from?: string; into: string; warning: string }>;
  sourceQuality: {
    status: "strong" | "adequate" | "thin" | "blocked";
    risks: string[];
  };
};

export type HookSlot = {
  shape: string;
  requiredFactIds: string[];
};

export type SummarySlot = {
  fastReadTargetChars: [number, number];
  deepReadTargetChars: [number, number];
  fullReadTargetChars: [number, number];
  requiredFactIds: string[];
};

export type ExampleSlotV1 = {
  slotId: string;
  purpose: "failure-mode" | "application" | "contrast" | "recovery" | "decision";
  sceneMode: string;
  sceneFrame: string;
  venue: string;
  allowedNames: string[];
  requiredFactIds: string[];
  requiredCaseIds: string[];
  forbiddenVenues: string[];
  requiredBeat: string;
};

export type QuizSlotV1 = {
  questionId: string;
  requiredFactIds: string[];
  caseCueIds: string[];
  correctIndex: number;
  depthLevel: "simple" | "standard" | "deep";
  promptShape: string;
  answerStyle: string;
  distractorTrap: string;
};

export type CardSlotV1 = {
  cardId: string;
  requiredFactIds: string[];
  caseCueIds: string[];
  difficulty: "easy" | "medium" | "hard";
  frontShape: string;
  retrievalTarget: string;
  backShape: string;
};

export type ActionSlotV1 = {
  actionMechanism: string;
  requiredFactIds: string[];
  weeklyPracticeForm: string;
  ifThenPlanShapes: string[];
  practiceForm: string;
  practiceConstraint: string;
};

export type ChapterBlueprintV1 = {
  schemaVersion: typeof CHAPTER_BLUEPRINT_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  title: string;
  sourcePacketPath: string;
  sourcePacketHash: string;
  plan: ChapterDesignDoc;
  coreMove: {
    statement: string;
    sourceFactIds: string[];
  };
  reservedVariety: {
    allowedNames: string[];
    forbiddenNames: string[];
    hookShape: string;
    counterShape: string;
    sceneMechanism: string;
    sceneMode: string;
    venuePalette: string[];
    answerIndexPattern: number[];
    actionMechanism: string;
    weeklyPracticeForm: string;
  };
  sections: {
    hook: HookSlot;
    summaries: SummarySlot;
    examples: ExampleSlotV1[];
    quiz: QuizSlotV1[];
    cards: CardSlotV1[];
    action: ActionSlotV1;
  };
  constraints: {
    allowedFactIds: string[];
    allowedCaseIds: string[];
    forbiddenClaims: string[];
    forbiddenLeakage: string[];
    bannedHouseTics: string[];
  };
};

export type SummaryPackV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "summary-pack";
  chapterId: string;
  hook: HookOutput;
  breakdown: BreakdownOutput;
  keyTakeaway: string;
  keyTakeawaySourceAnchorIds: string[];
  tryThisNow?: string;
  tryThisNowSourceAnchorIds?: string[];
  sourceFactIds: string[];
};

export type ExamplePackV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "example-pack";
  chapterId: string;
  examples: Array<ExampleOutput & {
    slotId?: string;
    sourceFactIds?: string[];
    namedCaseIds?: string[];
    introducedEntities?: string[];
    numbersUsed?: string[];
  }>;
};

export type LearningPackV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "learning-pack";
  chapterId: string;
  quiz: QuizOutput;
  cards: CardsOutput;
};

export type ActionPackV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "action-pack";
  chapterId: string;
  tryThisNow: string;
  tryThisNowSourceAnchorIds: string[];
  implementationPlan: ImplementationPlanOutput;
};

export type SectionPackV1 = SummaryPackV1 | ExamplePackV1 | LearningPackV1 | ActionPackV1;
export type SectionKind = SectionPackV1["artifactType"];

export const SECTION_KINDS: readonly SectionKind[] = [
  "summary-pack",
  "example-pack",
  "learning-pack",
  "action-pack",
] as const;

export type ChapterEvidenceMapV1 = {
  schemaVersion: typeof EVIDENCE_MAP_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  sourcePacketHash: string;
  paths: Record<string, {
    sourceFactIds: string[];
    sourceAnchorIds: string[];
    namedCaseIds: string[];
    numbersUsed: string[];
    entitiesUsed: string[];
    unsupportedNumbers: string[];
    unsupportedEntities: string[];
    unsupportedAnchorIds: string[];
  }>;
  summary: {
    unsupportedNumbers: string[];
    unsupportedEntities: string[];
    unsupportedAnchorIds: string[];
    factCoverage: number;
  };
};

export type ChapterRiskScoreV1 = {
  schemaVersion: typeof RISK_SCORE_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  score: number;
  lane: "low" | "medium" | "high";
  reasons: string[];
  recommendedAction: "formal-qc" | "qc-shadow" | "regenerate-section";
};

export type BookRiskScoreV1 = {
  schemaVersion: typeof RISK_SCORE_SCHEMA_VERSION;
  bookId: string;
  generatedAt: string;
  lane: "low" | "medium" | "high";
  chapters: ChapterRiskScoreV1[];
  bookWideRisks: string[];
};

export type VoicePatchV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "voice-patch";
  chapterId: string;
  patches: JsonPatchOperation[];
};

export type JsonPatchOperation =
  | { op: "replace" | "add"; path: string; value: unknown }
  | { op: "remove"; path: string };

export type MemorableLinesDeterministic = {
  memorableLines: MemorableLine[];
  generatedBy: "deterministic" | "model";
};
