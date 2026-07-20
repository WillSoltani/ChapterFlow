import {
  createChapterFlowPipeline,
  type ChapterFlowPipeline,
  type ChapterFlowPipelineDependencies,
} from "./pipeline.js";

export interface ChapterFlowApp {
  readonly pipeline: ChapterFlowPipeline;
}

export function createChapterFlowApp(dependencies: ChapterFlowPipelineDependencies): ChapterFlowApp {
  const pipeline = createChapterFlowPipeline({
    runStore: dependencies.runStore,
    stageCoordinator: dependencies.stageCoordinator,
    modelGateway: dependencies.modelGateway,
    candidateStore: dependencies.candidateStore,
    contentReader: dependencies.contentReader,
    reviewService: dependencies.reviewService,
    qcService: dependencies.qcService,
    promotionService: dependencies.promotionService,
    clock: dependencies.clock,
    ids: dependencies.ids,
  });
  return Object.freeze({ pipeline });
}

export type {
  CandidateGatewayFileV1,
  CandidateGatewayOutputV1,
  ChapterFlowClock,
  ChapterFlowIdFactory,
  ChapterFlowPipeline,
  ChapterFlowPipelineDependencies,
  WalkingSkeletonInput,
  WalkingSkeletonResult,
  WalkingSkeletonStage,
} from "./pipeline.js";
