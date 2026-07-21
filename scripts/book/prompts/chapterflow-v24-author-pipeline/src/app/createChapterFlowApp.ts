import {
  createChapterFlowPipeline,
  type ChapterFlowPipeline,
  type ChapterFlowPipelineDependencies,
} from "./pipeline.js";
import { CompilerApplicationPort } from "./compilerApplicationPort.js";
import { createModelTaskRunner, type ModelTaskRunner } from "./modelTaskRunner.js";

export interface ChapterFlowApp {
  readonly pipeline: ChapterFlowPipeline;
  readonly compiler: CompilerApplicationPort | null;
}

export function createChapterFlowApp(
  dependencies: ChapterFlowPipelineDependencies & Readonly<{ pipelineRoot?: string; modelTaskRunner?: ModelTaskRunner }>,
): ChapterFlowApp {
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
  const compiler = dependencies.pipelineRoot
    ? new CompilerApplicationPort({
        pipelineRoot: dependencies.pipelineRoot,
        contentReader: dependencies.contentReader,
        candidateStore: dependencies.candidateStore,
        runner: dependencies.modelTaskRunner ?? createModelTaskRunner(dependencies.modelGateway),
        ids: dependencies.ids,
        clock: dependencies.clock,
      })
    : null;
  return Object.freeze({ pipeline, compiler });
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
