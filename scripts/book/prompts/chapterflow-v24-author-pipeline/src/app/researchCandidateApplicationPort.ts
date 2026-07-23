import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import {
  runResearcherBibliography,
  type BibliographyInput,
  type BibliographyResult,
} from "../agents/researcher-bibliography.js";
import {
  runResearcherChapter,
  type ChapterResearchInput,
  type ChapterResearchResult,
} from "../agents/researcher-chapter.js";
import type {
  CandidateInputFile,
  CandidateSnapshot,
  CandidateStore,
} from "../books/candidateTypes.js";
import type { CandidateIdentity, ModelTaskContext, PlannedArtifact, UtcIso } from "../contracts/v4Core.js";
import { RESEARCH_RUN_MANIFEST_FILE } from "../lib/researchRunManifest.js";
import { researchBook } from "../researcher.js";
import type { RunStore } from "../run-state/runStore.js";
import type { RunDefinition } from "../run-state/runTypes.js";
import type { StageCoordinator } from "../run-state/stageTypes.js";
import { evaluateSourceV2Integrity, isResearchRouteBlockingFinding } from "../source/sourceIntegrity.js";
import type { ChapterFlowClock, ChapterFlowIdFactory } from "./pipeline.js";
import type { ModelCallerExecution, ModelTaskRunner } from "./modelTaskRunner.js";

const RESEARCH_STAGES = Object.freeze(["research", "seed-candidate"] as const);
// Generous per-run attempt cap. Each chapter-research operation now admits a
// NEW run-state attempt on every bounded retry (up to
// MAX_CHAPTER_RESEARCH_ATTEMPTS from researcher-chapter.ts), plus one
// bibliography attempt, so the run must budget MAX_CHAPTER_RESEARCH_ATTEMPTS ×
// chapters + 1. The chapter count is unknown when the run definition is created
// (research has not run yet), so — mirroring bookRunComposition's reader-lane
// generous flat cap — we budget a flat value large enough for any real book
// (4096 ÷ 3 ≈ 1365 chapters at full retry) rather than threading the count.
const MAX_RESEARCH_ATTEMPTS = 4096;
const V4_RESEARCH_PROFILE_ID = "attempt-read-json-v1";

export interface ResearchCandidateSourceMapping {
  readonly chapterNumber: number;
  readonly sidecarLogicalPath: string;
  readonly sourceLogicalPaths: readonly string[];
}

export interface ResearchCandidateApplicationRequest {
  readonly title: string;
  readonly author: string;
  readonly bookId?: string;
  readonly sourceGitSha: string;
  readonly v25Root: string;
  readonly attemptRoot: string;
  readonly newRunId?: string;
  readonly resumeRunId?: string;
  readonly chapterConcurrency?: number;
  readonly forceRefresh?: boolean;
  readonly signal: AbortSignal;
}

export interface ResearchCandidateApplicationResult {
  readonly schemaVersion: "1";
  readonly bookId: string;
  readonly title: string;
  readonly author: string;
  readonly intakeRunId: string;
  readonly researchRunId: string;
  readonly candidate: CandidateIdentity;
  readonly indexLogicalPath: "inputs/chapter-index.json";
  readonly sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json";
  readonly sources: readonly ResearchCandidateSourceMapping[];
  readonly resumed: boolean;
}

export interface ResearchCandidateApplicationPortDependencies {
  readonly pipelineRoot: string;
  readonly runStore: RunStore;
  readonly stageCoordinator: StageCoordinator;
  readonly candidateStore: CandidateStore;
  readonly runner: ModelTaskRunner;
  readonly ids: ChapterFlowIdFactory;
  readonly clock: ChapterFlowClock;
}

function within(base: string, target: string): boolean {
  const path = relative(resolve(base), resolve(target));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function canonicalUtc(value: string): value is UtcIso {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function safeClock(clock: ChapterFlowClock): UtcIso {
  const value = clock.now();
  if (!canonicalUtc(value)) throw new Error("RESEARCH_CLOCK_INVALID:clock must return canonical UTC ISO time");
  return value;
}

function requireRequest(input: ResearchCandidateApplicationRequest, pipelineRoot: string): void {
  if (!input.title.trim() || !input.author.trim()) {
    throw new Error("RESEARCH_INPUT_INVALID:title and author are required");
  }
  if (input.bookId !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.bookId)) {
    throw new Error("RESEARCH_INPUT_INVALID:bookId must be a lowercase-dash slug");
  }
  if (!input.sourceGitSha.trim()) throw new Error("RESEARCH_INPUT_INVALID:sourceGitSha is required");
  if (input.newRunId !== undefined && input.resumeRunId !== undefined) {
    throw new Error("RESEARCH_INPUT_INVALID:newRunId and resumeRunId are mutually exclusive");
  }
  for (const [name, root] of [["v25Root", input.v25Root], ["attemptRoot", input.attemptRoot]] as const) {
    if (!isAbsolute(root)) throw new Error(`RESEARCH_INPUT_INVALID:${name} must be absolute`);
    if (within(pipelineRoot, root) || within(root, pipelineRoot)) {
      throw new Error(`RESEARCH_INPUT_INVALID:${name} must be isolated from pipeline root`);
    }
  }
  if (input.chapterConcurrency !== undefined && (!Number.isSafeInteger(input.chapterConcurrency) || input.chapterConcurrency < 1)) {
    throw new Error("RESEARCH_INPUT_INVALID:chapterConcurrency must be a positive safe integer");
  }
  if (!(input.signal instanceof AbortSignal)) throw new Error("RESEARCH_INPUT_INVALID:signal must be AbortSignal");
  if (input.signal.aborted) throw new Error("MODEL_RUN_CANCELLED:research cancelled before run creation");
}

function intentCommandId(input: ResearchCandidateApplicationRequest): string {
  const digest = createHash("sha256")
    .update(input.title.trim())
    .update("\0")
    .update(input.author.trim())
    .update("\0")
    .update(input.bookId ?? "")
    .update("\0")
    .update(resolve(input.v25Root))
    .update("\0")
    .update(input.forceRefresh === true ? "force" : "resume")
    .digest("hex")
    .slice(0, 24);
  return `research-candidate-v1-${digest}`;
}

function inferredBookId(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("RESEARCH_INPUT_INVALID:title cannot produce a bookId slug");
  return slug;
}

function requestBookId(input: ResearchCandidateApplicationRequest): string {
  return input.bookId ?? inferredBookId(input.title);
}

function normalizedIdentityWords(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function definitionFor(input: ResearchCandidateApplicationRequest, runId: string, createdAt: UtcIso): RunDefinition {
  return Object.freeze({
    schemaVersion: "1" as const,
    bookId: requestBookId(input),
    runId,
    commandId: intentCommandId(input),
    sourceGitSha: input.sourceGitSha,
    requiredStages: RESEARCH_STAGES,
    requiredInventory: Object.freeze([]),
    attemptLimits: Object.freeze({
      run: MAX_RESEARCH_ATTEMPTS,
      byStage: Object.freeze({ research: MAX_RESEARCH_ATTEMPTS, "seed-candidate": 0 }),
    }),
    createdAt,
  });
}

function candidateIdFor(runId: string): string {
  return `research-seed-${createHash("sha256").update(runId).digest("hex").slice(0, 24)}`;
}

function attemptIdFor(base: string, operationId: string): string {
  const suffix = createHash("sha256").update(operationId).digest("hex").slice(0, 16);
  const prefix = base.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 100) || "research-attempt";
  return `${prefix}-${suffix}`;
}

function operationExecution(
  dependencies: ResearchCandidateApplicationPortDependencies,
  input: ResearchCandidateApplicationRequest,
  runId: string,
  baseAttemptId: string,
  operationId: string,
): ModelCallerExecution {
  // Each model call for this operation admits its OWN run-state attempt. A
  // bounded retry (researcher-chapter) re-invokes the runner, and run-state
  // refuses to respawn an already-admitted attempt (MODEL_ATTEMPT_EXISTS), so
  // every invocation MUST carry a distinct attemptId. `nextContext` mints a
  // fresh ordinal-suffixed identity per call; `context` previews ordinal 1 for
  // any single-shot caller that reads it directly.
  let ordinal = 0;
  const build = (attempt: number): ModelTaskContext => Object.freeze({
    bookId: requestBookId(input),
    runId,
    attemptId: attemptIdFor(baseAttemptId, `${operationId}#${attempt}`),
    stageId: "research",
    operationId,
    workDir: input.attemptRoot,
    signal: input.signal,
  });
  return Object.freeze({
    runner: dependencies.runner,
    profileId: V4_RESEARCH_PROFILE_ID,
    context: build(1),
    nextContext: () => build(++ordinal),
  });
}

function requireSourceV2(chapter: ChapterResearchResult): ChapterResearchResult {
  const decision = evaluateSourceV2Integrity(chapter, {
    chapterNumber: chapter.chapterNumber,
    chapterTitle: chapter.chapterTitle,
  });
  const routeBlocking = decision.findings.filter(isResearchRouteBlockingFinding);
  if (routeBlocking.length > 0) {
    const blockers = routeBlocking
      .map((finding) => `${finding.checkId}:${finding.message}`)
      .join("; ");
    throw new Error(`RESEARCH_SOURCE_V2_INVALID:${blockers}`);
  }
  return chapter;
}

function planned(file: CandidateInputFile): PlannedArtifact {
  return { kind: file.kind, logicalPath: file.logicalPath, mediaType: file.mediaType };
}

async function inputFile(
  path: string,
  logicalPath: string,
  kind: CandidateInputFile["kind"],
  mediaType: CandidateInputFile["mediaType"],
): Promise<CandidateInputFile> {
  return { kind, logicalPath, mediaType, bytes: await readFile(path) };
}

function sourcePaths(chapterNumber: number): Readonly<{
  json: string;
  text: string;
}> {
  const stem = `ch${String(chapterNumber).padStart(2, "0")}.source`;
  return { json: `inputs/source/${stem}.json`, text: `inputs/source/${stem}.txt` };
}

async function materializeSeedFiles(result: Awaited<ReturnType<typeof researchBook>>): Promise<Readonly<{
  files: readonly CandidateInputFile[];
  sources: readonly ResearchCandidateSourceMapping[];
}>> {
  const encoder = new TextEncoder();
  const files: CandidateInputFile[] = [
    {
      kind: "SIDECAR",
      logicalPath: "inputs/chapter-index.json",
      mediaType: "application/json",
      bytes: await readFile(result.chapterIndexPath),
    },
    await inputFile(resolve(result.bundlePath, "source-freeze", "toc.json"), "inputs/source-freeze/toc.json", "PROVENANCE", "application/json"),
    await inputFile(resolve(result.bundlePath, "source-freeze", "book-source.md"), "inputs/source-freeze/book-source.md", "PROVENANCE", "text/markdown"),
    {
      kind: "SIDECAR",
      logicalPath: "inputs/compiler-section-task-context.json",
      mediaType: "application/json",
      bytes: encoder.encode(`${JSON.stringify({
        schemaVersion: "compiler-section-task-context-v1",
        bookId: result.bookId,
        voiceCard: null,
        bookScars: null,
      }, null, 2)}\n`),
    },
    await inputFile(resolve(result.bundlePath, RESEARCH_RUN_MANIFEST_FILE), "inputs/research/research-run.manifest.json", "PROVENANCE", "application/json"),
    await inputFile(resolve(result.bundlePath, "source-freeze", "bibliography.raw.json"), "inputs/research/bibliography.raw.json", "PROVENANCE", "application/json"),
    await inputFile(resolve(result.bundlePath, "source-freeze", "source-freeze-report.md"), "inputs/research/source-freeze-report.md", "PROVENANCE", "text/markdown"),
  ];
  const sources: ResearchCandidateSourceMapping[] = [];
  for (const chapter of result.chapters) {
    const logical = sourcePaths(chapter.chapterNumber);
    files.push(
      await inputFile(resolve(result.bundlePath, "sidecars", "source", `ch${String(chapter.chapterNumber).padStart(2, "0")}.source.json`), logical.json, "SIDECAR", "application/json"),
      await inputFile(resolve(result.bundlePath, "sidecars", "source", `ch${String(chapter.chapterNumber).padStart(2, "0")}.source.txt`), logical.text, "SIDECAR", "text/plain"),
    );
    sources.push(Object.freeze({
      chapterNumber: chapter.chapterNumber,
      sidecarLogicalPath: logical.json,
      sourceLogicalPaths: Object.freeze([
        logical.text,
        "inputs/source-freeze/book-source.md",
        "inputs/source-freeze/toc.json",
      ]),
    }));
  }
  if (files.length !== 7 + (2 * result.chapters.length)) {
    throw new Error("RESEARCH_SEED_INVALID:seed candidate inventory length mismatch");
  }
  return Object.freeze({ files: Object.freeze(files), sources: Object.freeze(sources) });
}

function sameFiles(snapshot: CandidateSnapshot, files: readonly CandidateInputFile[]): boolean {
  return snapshot.files.length === files.length && snapshot.files.every((file, index) => {
    const expected = files[index];
    return file.kind === expected.kind
      && file.logicalPath === expected.logicalPath
      && file.mediaType === expected.mediaType
      && Buffer.compare(Buffer.from(file.bytes), Buffer.from(expected.bytes)) === 0;
  });
}

function resultFromSnapshot(snapshot: CandidateSnapshot, intakeRunId: string, resumed: boolean): ResearchCandidateApplicationResult {
  const decoder = new TextDecoder();
  const index = snapshot.files.find((file) => file.logicalPath === "inputs/chapter-index.json");
  const manifestFile = snapshot.files.find((file) => file.logicalPath === "inputs/research/research-run.manifest.json");
  if (!index || !manifestFile) throw new Error("RESEARCH_RESUME_INVALID:seed candidate lacks intake metadata");
  let chapters: Array<{ chapterNumber: number }>;
  let manifest: { runId?: unknown };
  try {
    chapters = JSON.parse(decoder.decode(index.bytes)) as Array<{ chapterNumber: number }>;
    manifest = JSON.parse(decoder.decode(manifestFile.bytes)) as { runId?: unknown };
  } catch {
    throw new Error("RESEARCH_RESUME_INVALID:seed candidate metadata is malformed");
  }
  if (!Array.isArray(chapters) || typeof manifest.runId !== "string") {
    throw new Error("RESEARCH_RESUME_INVALID:seed candidate metadata schema is invalid");
  }
  const sources = chapters.map((chapter) => {
    const logical = sourcePaths(chapter.chapterNumber);
    return Object.freeze({
      chapterNumber: chapter.chapterNumber,
      sidecarLogicalPath: logical.json,
      sourceLogicalPaths: Object.freeze([logical.text, "inputs/source-freeze/book-source.md", "inputs/source-freeze/toc.json"]),
    });
  });
  return Object.freeze({
    schemaVersion: "1",
    bookId: snapshot.manifest.bookId,
    title: "",
    author: "",
    intakeRunId,
    researchRunId: manifest.runId,
    candidate: Object.freeze({
      candidateId: snapshot.manifest.candidateId,
      manifestDigest: snapshot.manifest.manifestDigest,
    }),
    indexLogicalPath: "inputs/chapter-index.json",
    sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json",
    sources: Object.freeze(sources),
    resumed,
  });
}

async function openSeed(
  candidateStore: CandidateStore,
  bookId: string,
  candidateId: string,
): Promise<CandidateSnapshot | null> {
  const opened = await candidateStore.open({ bookId, selector: { kind: "CANDIDATE", candidateId } });
  if (!opened.ok) return null;
  return opened.value;
}

export class ResearchCandidateApplicationPort {
  readonly #dependencies: ResearchCandidateApplicationPortDependencies;

  constructor(dependencies: ResearchCandidateApplicationPortDependencies) {
    this.#dependencies = dependencies;
  }

  async run(input: ResearchCandidateApplicationRequest): Promise<ResearchCandidateApplicationResult> {
    requireRequest(input, this.#dependencies.pipelineRoot);
    let runId = input.resumeRunId ?? input.newRunId ?? this.#dependencies.ids.nextRunId();
    let createdAt = safeClock(this.#dependencies.clock);
    let resumedRun = false;
    if (input.resumeRunId !== undefined) {
      const prior = await this.#dependencies.runStore.readRun(
        requestBookId(input),
        runId,
        createdAt,
      );
      if (prior.ok) {
        createdAt = prior.value.definition.createdAt;
        resumedRun = true;
      }
      else if (prior.error.code === "NOT_FOUND") throw new Error("RESEARCH_RESUME_NOT_FOUND:resumeRunId does not exist");
      else throw new Error(`RESEARCH_RUN_UNAVAILABLE:${prior.error.code}`);
    }
    const definition = definitionFor(input, runId, createdAt);
    const created = await this.#dependencies.runStore.createRun(definition);
    if (!created.ok && created.error.code === "CONFLICT" && input.resumeRunId !== undefined) {
      throw new Error("RESEARCH_RESUME_CONFLICT:resume run definition differs from requested intent");
    }
    if (!created.ok) throw new Error(`RESEARCH_RUN_UNAVAILABLE:${created.error.code}`);

    const candidateId = candidateIdFor(runId);
    if (created.value.status === "COMPLETED") {
      const snapshot = await openSeed(this.#dependencies.candidateStore, definition.bookId, candidateId);
      if (!snapshot) throw new Error("RESEARCH_RESUME_INVALID:completed run seed candidate is unavailable");
      const resumed = resultFromSnapshot(snapshot, runId, true);
      return Object.freeze({ ...resumed, title: input.title, author: input.author });
    }
    if (created.value.status !== "RUNNING") {
      throw new Error(`RESEARCH_RUN_TERMINAL:${created.value.status}`);
    }
    const uncertain = created.value.attempts.filter((attempt) => attempt.status === "ACTIVE" || attempt.status === "STALE");
    if (uncertain.length > 0) throw new Error("RESEARCH_ATTEMPT_UNCERTAIN:unsettled model attempt blocks replay");

    const resumePlan = await this.#dependencies.stageCoordinator.planResume(definition);
    if (!resumePlan.ok) throw new Error(`RESEARCH_RESUME_UNAVAILABLE:${resumePlan.error.code}`);
    const completedStages = new Set(resumePlan.value.completedStages);
    if (completedStages.has("seed-candidate")) {
      const snapshot = await openSeed(this.#dependencies.candidateStore, definition.bookId, candidateId);
      if (!snapshot) throw new Error("RESEARCH_RESUME_INVALID:seed checkpoint candidate is unavailable");
      const finished = await this.#dependencies.runStore.finishRun({
        bookId: definition.bookId,
        runId,
        status: "COMPLETED",
        finishedAt: safeClock(this.#dependencies.clock),
      });
      if (!finished.ok) throw new Error(`RESEARCH_RUN_UNAVAILABLE:${finished.error.code}`);
      const resumed = resultFromSnapshot(snapshot, runId, true);
      return Object.freeze({ ...resumed, title: input.title, author: input.author });
    }

    try {
      await mkdir(input.attemptRoot, { recursive: true });
      const baseAttemptId = this.#dependencies.ids.modelAttemptId(runId);
      const research = await researchBook(input.title, input.author, {
        bookId: definition.bookId,
        chapterConcurrency: input.chapterConcurrency,
        // Legacy research cache is global to its injected research root. A new
        // V4 control run must not silently adopt an earlier compatible bundle;
        // only an exact, known control-run resume may reuse durable chapter work.
        forceRefresh: !resumedRun || input.forceRefresh === true,
        runsRoot: resolve(input.v25Root, "research-runs"),
        stateRoot: resolve(input.v25Root, "research-state"),
        deps: {
          runBibliography: (bibliographyInput: BibliographyInput): Promise<BibliographyResult> => runResearcherBibliography(
            bibliographyInput,
            operationExecution(this.#dependencies, input, runId, baseAttemptId, "research-bibliography"),
          ),
          runChapter: async (chapterInput: ChapterResearchInput): Promise<ChapterResearchResult> => requireSourceV2(
            await runResearcherChapter(
              chapterInput,
              operationExecution(
                this.#dependencies,
                { ...input, bookId: chapterInput.bibliography.bookId },
                runId,
                baseAttemptId,
                `research-ch${String(chapterInput.chapter.number).padStart(2, "0")}`,
              ),
            ),
          ),
        },
      });
      if (input.bookId !== undefined && research.bookId !== input.bookId) {
        throw new Error(`RESEARCH_IDENTITY_MISMATCH:expected ${input.bookId}, got ${research.bookId}`);
      }
      if (
        normalizedIdentityWords(research.bibliography.title) !== normalizedIdentityWords(input.title)
        || normalizedIdentityWords(research.bibliography.author) !== normalizedIdentityWords(input.author)
      ) {
        throw new Error("RESEARCH_IDENTITY_MISMATCH:bibliography title or author differs from request");
      }
      if (research.bookId !== definition.bookId) {
        throw new Error(`RESEARCH_IDENTITY_MISMATCH:run bookId ${definition.bookId}, bibliography returned ${research.bookId}`);
      }

      const live = await this.#dependencies.runStore.readRun(definition.bookId, runId, safeClock(this.#dependencies.clock));
      if (!live.ok) throw new Error(`RESEARCH_RUN_UNAVAILABLE:${live.error.code}`);
      const attemptIds = live.value.attempts.map((attempt) => attempt.admission.attemptId);
      if (!completedStages.has("research")) {
        const checkpointed = await this.#dependencies.stageCoordinator.checkpoint({
          schemaVersion: "1",
          bookId: definition.bookId,
          runId,
          stageId: "research",
          status: "COMPLETED",
          attemptIds,
          completedAt: safeClock(this.#dependencies.clock),
        });
        if (!checkpointed.ok) throw new Error(`RESEARCH_CHECKPOINT_FAILED:${checkpointed.error.code}`);
      }

      const seed = await materializeSeedFiles(research);
      const expectedInventory = seed.files.map(planned);
      let snapshot = await openSeed(this.#dependencies.candidateStore, definition.bookId, candidateId);
      if (snapshot !== null && !sameFiles(snapshot, seed.files)) {
        throw new Error("RESEARCH_SEED_CONFLICT:existing immutable candidate differs from research output");
      }
      if (snapshot === null) {
        const staged = await this.#dependencies.candidateStore.stage({
          bookId: definition.bookId,
          candidateId,
          createdByRunId: runId,
          expectedInventory,
          files: seed.files,
          createdAt: safeClock(this.#dependencies.clock),
        });
        if (!staged.ok) throw new Error(`RESEARCH_SEED_FAILED:${staged.error.code}`);
        snapshot = await openSeed(this.#dependencies.candidateStore, definition.bookId, candidateId);
        if (snapshot === null) throw new Error("RESEARCH_SEED_READBACK_FAILED:candidate unavailable after stage");
      }
      if (!sameFiles(snapshot, seed.files)) throw new Error("RESEARCH_SEED_READBACK_FAILED:candidate bytes differ");
      const identity = Object.freeze({ candidateId, manifestDigest: snapshot.manifest.manifestDigest });
      const seedCheckpoint = await this.#dependencies.stageCoordinator.checkpoint({
        schemaVersion: "1",
        bookId: definition.bookId,
        runId,
        stageId: "seed-candidate",
        status: "COMPLETED",
        attemptIds: [],
        candidate: identity,
        completedAt: safeClock(this.#dependencies.clock),
      });
      if (!seedCheckpoint.ok) throw new Error(`RESEARCH_CHECKPOINT_FAILED:${seedCheckpoint.error.code}`);
      const finished = await this.#dependencies.runStore.finishRun({
        bookId: definition.bookId,
        runId,
        status: "COMPLETED",
        finishedAt: safeClock(this.#dependencies.clock),
      });
      if (!finished.ok) throw new Error(`RESEARCH_RUN_UNAVAILABLE:${finished.error.code}`);
      return Object.freeze({
        schemaVersion: "1",
        bookId: research.bookId,
        title: input.title,
        author: input.author,
        intakeRunId: runId,
        researchRunId: research.runId,
        candidate: identity,
        indexLogicalPath: "inputs/chapter-index.json",
        sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json",
        sources: seed.sources,
        resumed: resumedRun,
      });
    } catch (error) {
      const latest = await this.#dependencies.runStore.readRun(definition.bookId, runId, safeClock(this.#dependencies.clock)).catch(() => null);
      if (latest?.ok && latest.value.status === "RUNNING") {
        if (input.signal.aborted) {
          const requestedAt = safeClock(this.#dependencies.clock);
          const cancelled = await this.#dependencies.runStore.requestCancel({
            bookId: definition.bookId,
            runId,
            reason: (error as Error).message,
            requestedAt,
          }).catch(() => null);
          if (cancelled?.ok) {
            await this.#dependencies.runStore.finishRun({
              bookId: definition.bookId,
              runId,
              status: "CANCELLED",
              finishedAt: safeClock(this.#dependencies.clock),
              reason: (error as Error).message,
            }).catch(() => undefined);
          }
        } else {
          await this.#dependencies.runStore.finishRun({
            bookId: definition.bookId,
            runId,
            status: "FAILED",
            finishedAt: safeClock(this.#dependencies.clock),
            reason: (error as Error).message,
          }).catch(() => undefined);
        }
      }
      throw error;
    }
  }
}
