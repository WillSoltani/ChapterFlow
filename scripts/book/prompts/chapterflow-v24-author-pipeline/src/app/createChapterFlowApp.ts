import {
  createChapterFlowPipeline,
  type ChapterFlowPipeline,
  type ChapterFlowPipelineDependencies,
} from "./pipeline.js";
import { CompilerApplicationPort } from "./compilerApplicationPort.js";
import { ResearchCandidateApplicationPort } from "./researchCandidateApplicationPort.js";
import { CandidateQcEvaluator } from "./candidateQcEvaluator.js";
import {
  BookRunApplicationService,
  type BookRunEventSink,
} from "./bookRunApplicationService.js";
import type { CurrentPointerStore } from "../books/currentPointer.js";
import type { SectionPackCache } from "../books/sectionPackCache.js";
import type { SectionAvoidStore } from "../books/sectionAvoidStore.js";
import type { CandidateRepairApplicationPort } from "./candidateRepairApplicationPort.js";
import { createModelTaskRunner, type ModelTaskRunner } from "./modelTaskRunner.js";

export interface ChapterFlowApp {
  readonly pipeline: ChapterFlowPipeline;
  readonly compiler: CompilerApplicationPort | null;
  readonly research: ResearchCandidateApplicationPort | null;
  readonly candidateQc: CandidateQcEvaluator;
  readonly bookRun: BookRunApplicationService | null;
}

export function createChapterFlowApp(
  dependencies: ChapterFlowPipelineDependencies & Readonly<{
    pipelineRoot?: string;
    modelTaskRunner?: ModelTaskRunner;
    currentPointerStore?: CurrentPointerStore;
    bookRunEvents?: BookRunEventSink;
    repairApplication?: CandidateRepairApplicationPort;
    sectionPackCache?: SectionPackCache;
    sectionAvoidStore?: SectionAvoidStore;
  }>,
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
  const runner = dependencies.modelTaskRunner ?? createModelTaskRunner(dependencies.modelGateway);
  const compiler = dependencies.pipelineRoot
    ? new CompilerApplicationPort({
      pipelineRoot: dependencies.pipelineRoot,
      contentReader: dependencies.contentReader,
      candidateStore: dependencies.candidateStore,
        runner,
      runStore: dependencies.runStore,
      stageCoordinator: dependencies.stageCoordinator,
      ids: dependencies.ids,
      clock: dependencies.clock,
      ...(dependencies.sectionPackCache ? { sectionPackCache: dependencies.sectionPackCache } : {}),
      ...(dependencies.sectionAvoidStore ? { sectionAvoidStore: dependencies.sectionAvoidStore } : {}),
      })
    : null;
  const research = dependencies.pipelineRoot
    ? new ResearchCandidateApplicationPort({
        pipelineRoot: dependencies.pipelineRoot,
        runStore: dependencies.runStore,
        stageCoordinator: dependencies.stageCoordinator,
        candidateStore: dependencies.candidateStore,
        runner,
        ids: dependencies.ids,
        clock: dependencies.clock,
      })
    : null;
  // Thread the composition's model-task runner (role "qc") into fresh-qc so the
  // LLM answer-key judge actually executes in production. Without a runner the
  // judge is inert; the fresh-qc call site supplies the matching taskContext.
  const candidateQc = new CandidateQcEvaluator(dependencies.contentReader, { runner });
  const bookRun = dependencies.pipelineRoot && compiler && research
    && dependencies.currentPointerStore && dependencies.bookRunEvents
    ? new BookRunApplicationService({
        research,
        compiler,
        ...(dependencies.repairApplication === undefined ? {} : { repair: dependencies.repairApplication }),
        contentReader: dependencies.contentReader,
        candidateQc,
        reviews: dependencies.reviewService,
        qc: dependencies.qcService,
        promotion: dependencies.promotionService,
        currentPointer: dependencies.currentPointerStore,
        runStore: dependencies.runStore,
        stageCoordinator: dependencies.stageCoordinator,
        clock: dependencies.clock,
        ids: dependencies.ids,
        events: dependencies.bookRunEvents,
        pipelineRoot: dependencies.pipelineRoot,
      })
    : null;
  return Object.freeze({ pipeline, compiler, research, candidateQc, bookRun });
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
