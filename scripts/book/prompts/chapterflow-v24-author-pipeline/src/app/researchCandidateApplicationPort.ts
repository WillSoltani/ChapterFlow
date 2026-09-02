import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import {
  MAX_BIBLIOGRAPHY_ATTEMPTS,
  runResearcherBibliography,
  type BibliographyInput,
  type BibliographyResult,
} from "../agents/researcher-bibliography.js";
import {
  MAX_CHAPTER_RESEARCH_ATTEMPTS,
  collectHardSpecificLengthProblems,
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
import {
  DEFAULT_RESEARCH_LEASE_TTL_MS,
  RESEARCH_RUN_MANIFEST_FILE,
  appendResearchEvent,
  isSafeResearchRunId,
  withManifestUpdateLock,
} from "../lib/researchRunManifest.js";
import { loadBookScars } from "../lib/bookScars.js";
import { researchBook } from "../researcher.js";
import { reconcileAttempt, RECONCILED_UNSETTLED_ON_RESUME } from "../run-state/reconcileAttempt.js";
import type { RunStore } from "../run-state/runStore.js";
import type { AttemptSnapshot, RunDefinition } from "../run-state/runTypes.js";
import type { StageCoordinator } from "../run-state/stageTypes.js";
import { evaluateSourceV2Integrity, isResearchRouteBlockingFinding } from "../source/sourceIntegrity.js";
import type { ChapterFlowClock, ChapterFlowIdFactory } from "./pipeline.js";
import type { ModelCallerExecution, ModelTaskRunner } from "./modelTaskRunner.js";

const RESEARCH_STAGES = Object.freeze(["research", "seed-candidate"] as const);
/**
 * Per-run research attempt cap, DERIVED from the retry budgets the stage
 * actually spends: every bounded chapter-research retry admits a new run-state
 * attempt (up to MAX_CHAPTER_RESEARCH_ATTEMPTS), as does every bibliography
 * retry (up to MAX_BIBLIOGRAPHY_ATTEMPTS).
 *
 * The exact chapter count is still unknowable here — the run definition is
 * created before the bibliography runs, and a definition cannot change
 * afterwards without making fileRunStore.createRun throw CONFLICT on resume.
 * So the cap is taken at an explicit chapter CEILING instead of a flat magic
 * number: it now moves whenever either retry budget moves, which the previous
 * flat 4096 (≈1365 chapters at full retry, ~300x any real book) did not.
 */
export function researchAttemptCapForChapters(chapters: number): number {
  return MAX_CHAPTER_RESEARCH_ATTEMPTS * Math.max(0, Math.trunc(chapters)) + MAX_BIBLIOGRAPHY_ATTEMPTS;
}

/**
 * Chapter ceiling the cap is taken at. Deliberately well above any real book's
 * chapter list (the longest in the catalogue is far under this) so the cap is a
 * runaway-loop bound, never a limit a legitimate book or a resumed run can hit.
 */
export const MAX_RESEARCHABLE_CHAPTERS = 120;

export const MAX_RESEARCH_ATTEMPTS = researchAttemptCapForChapters(MAX_RESEARCHABLE_CHAPTERS);
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
  /**
   * Operator pin naming an existing research run DIRECTORY under
   * <v25Root>/research-runs/<bookId>/. This is a WEAKER TRUST CLASS than the
   * successor-chain attestation: a research run has no run-state record, so the
   * run-state corroboration #successorChainBindsRun performs is structurally
   * unavailable for it — do not claim parity. Validation is therefore
   * manifest-intrinsic (bookId, runId, status, input hash, five-field
   * compatibility, parser integrity, bibliography hash and chapter-list
   * binding, full per-chapter reusability) plus strict confinement — resolved
   * path AND realpath — to <v25Root>/research-runs/<bookId>.
   *
   * That is acceptable because every durable artifact the pipeline owns already
   * lives under v25Root (run-state, books, the event journal, research-runs), so
   * an actor who can write the pinned directory can already write run-state: the
   * pin confers no authority the v25Root trust boundary does not. What it must
   * not do is extend reach BEYOND that boundary (the confinement checks) or
   * become a second acceptance path for the control-run bind — which mutual
   * exclusion with resumeRunId guarantees structurally, since successorAccepted
   * requires resumeRunId to be present.
   *
   * Deliberately NOT corroborated against the book-run event journal: the
   * research COMPLETED event does record researchRunId, but BookRunEventSink.read
   * filters to a single run, and widening it to a book-scoped scan would weaken
   * the sink's own per-run isolation while buying nothing (the journal lives
   * under the same v25Root).
   */
  readonly researchRunId?: string;
  readonly chapterConcurrency?: number;
  readonly forceRefresh?: boolean;
  /**
   * Opt-in crash recovery. A hard-killed run (SIGKILL / host teardown — NOT the
   * SIGINT path, which settles its own attempts) can leave an attempt admitted
   * with no terminal record, which fail-closes replay at
   * RESEARCH_ATTEMPT_UNCERTAIN forever. When true AND this is a resume, such
   * unsettled attempts are explicitly reconciled (settled ABANDONED with a
   * RECONCILED_UNSETTLED_ON_RESUME marker) so the run can replay. Default false
   * preserves the fail-closed contract exactly. Only ever settles
   * admitted-with-no-terminal-record attempts; never rewrites settled ones.
   */
  readonly reconcileUnsettled?: boolean;
  readonly signal: AbortSignal;
}

export interface ResearchCandidateApplicationResult {
  readonly schemaVersion: "1";
  readonly bookId: string;
  readonly title: string;
  readonly author: string;
  readonly intakeRunId: string;
  readonly researchRunId: string;
  /**
   * Present ONLY when this result is a successor-recovery intake: the id of the
   * terminal-FAILED predecessor control run whose durable research this successor
   * reused (finding 8 / task 11d). The intake seam (bookRunApplicationService)
   * reads this as the pipeline's own attestation of the predecessor→successor
   * link — corroborated against durable run-state — so a successor run may be
   * intaken by the resumed book-run without breaking the exact-run bind. Absent
   * on every non-recovery result, whose intakeRunId equals the run of record.
   */
  readonly recoveredFromRunId?: string;
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
  if (input.researchRunId !== undefined) {
    if (!isSafeResearchRunId(input.researchRunId)) {
      throw new Error("RESEARCH_INPUT_INVALID:researchRunId must be one safe opaque path segment");
    }
    // A resume with durable research+seed events never reaches this port at all,
    // so a pin there would be a silent no-op; worse, accepting the combination
    // would make the successor exception reachable with a pin present, creating
    // a SECOND acceptance path for the control-run bind.
    if (input.resumeRunId !== undefined) {
      throw new Error("RESEARCH_INPUT_INVALID:researchRunId and resumeRunId are mutually exclusive");
    }
    // At this layer the two are genuinely contradictory: one says "read exactly
    // this bundle", the other says "discard every bundle".
    if (input.forceRefresh === true) {
      throw new Error("RESEARCH_INPUT_INVALID:researchRunId and forceRefresh are mutually exclusive");
    }
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

/**
 * The run's INTENT identity. `researchRunId` is deliberately absent: a run
 * definition drift makes fileRunStore.createRun throw CONFLICT, so folding the
 * pin in here would mean a run started WITHOUT the pin could never be resumed
 * WITH it (surfacing as a misleading RESEARCH_RESUME_CONFLICT). The pin selects
 * an INPUT, not an intent.
 */
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

/** Chapter numbers that admitted a `research-chNN` model attempt in this run —
 *  i.e. were RE-RESEARCHED. Every other expected chapter was reused from durable
 *  sidecars. Shared by the successor-recovery provenance record and the
 *  research-pin operator line so the two can never drift apart. */
function reResearchedChapterNumbers(attempts: readonly AttemptSnapshot[]): number[] {
  const found = new Set<number>();
  for (const attempt of attempts) {
    const match = attempt.admission.operationId.match(/^research-ch(\d+)$/);
    if (match) found.add(Number(match[1]));
  }
  return [...found].sort((a, b) => a - b);
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

/** Non-throwing mirror of {@link requireSourceV2}: true iff the chapter has no
 *  research-route-blocking source-v2 finding. Used as the durable-sidecar reuse
 *  gate on recovery so a cached sidecar that no longer passes the source-v2
 *  route validator is re-researched rather than reused (or crashing the run). */
export function chapterRouteValid(chapter: ChapterResearchResult): boolean {
  try {
    const decision = evaluateSourceV2Integrity(chapter, {
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
    });
    if (decision.findings.some(isResearchRouteBlockingFinding)) return false;
    // Apply the short-token research contract to the reused sidecar too: a STALE
    // sidecar minted before the <=5-word hardSpecifics policy carries clause-length
    // specifics that break downstream composition (SEC16). Rejecting it here makes
    // reuse fall through to re-research — the designed migration path, no separate
    // migrator. Shares collectHardSpecificLengthProblems with the fresh-research
    // validator so the two can never diverge.
    if (collectHardSpecificLengthProblems(chapter.namedExamples).length > 0) return false;
    return true;
  } catch {
    return false;
  }
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
        // Seed the book's own scars. This was hardcoded null, which made the
        // ENTIRE scar mechanism inert in production: the loader had no caller, so
        // no phrase, frame, note or panel-blocker rule ever reached a writer
        // prompt — including the fact pins written directly off reader-panel FAILs
        // during the canary. The compiler already validated and rendered this
        // field; only the data was missing. The documented repair loop (scar →
        // evict → fresh run) depends on it, and so does --research-run-id, whose
        // whole purpose is making that loop cheap.
        bookScars: loadBookScars(result.bookId),
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

/** Reconstruct the per-chapter compiler source mapping from a seed candidate's
 *  durable `inputs/chapter-index.json` bytes. Shared source of truth for the
 *  source-path convention: the port's own resume rehydrate uses it, and the
 *  book-run service's post-recovery durable-seed rehydrate (task 11g) uses the
 *  same helper so both derive a byte-identical mapping from the same index.
 *  Throws the exact RESEARCH_RESUME_INVALID errors on malformed/invalid input. */
export function researchSourcesFromChapterIndex(indexBytes: Uint8Array): readonly ResearchCandidateSourceMapping[] {
  const decoder = new TextDecoder();
  let chapters: Array<{ chapterNumber: number }>;
  try {
    chapters = JSON.parse(decoder.decode(indexBytes)) as Array<{ chapterNumber: number }>;
  } catch {
    throw new Error("RESEARCH_RESUME_INVALID:seed candidate metadata is malformed");
  }
  if (!Array.isArray(chapters)) {
    throw new Error("RESEARCH_RESUME_INVALID:seed candidate metadata schema is invalid");
  }
  return chapters.map((chapter) => {
    const logical = sourcePaths(chapter.chapterNumber);
    return Object.freeze({
      chapterNumber: chapter.chapterNumber,
      sidecarLogicalPath: logical.json,
      sourceLogicalPaths: Object.freeze([logical.text, "inputs/source-freeze/book-source.md", "inputs/source-freeze/toc.json"]),
    });
  });
}

function resultFromSnapshot(snapshot: CandidateSnapshot, intakeRunId: string, resumed: boolean): ResearchCandidateApplicationResult {
  const decoder = new TextDecoder();
  const index = snapshot.files.find((file) => file.logicalPath === "inputs/chapter-index.json");
  const manifestFile = snapshot.files.find((file) => file.logicalPath === "inputs/research/research-run.manifest.json");
  if (!index || !manifestFile) throw new Error("RESEARCH_RESUME_INVALID:seed candidate lacks intake metadata");
  let manifest: { runId?: unknown };
  try {
    manifest = JSON.parse(decoder.decode(manifestFile.bytes)) as { runId?: unknown };
  } catch {
    throw new Error("RESEARCH_RESUME_INVALID:seed candidate metadata is malformed");
  }
  const sources = researchSourcesFromChapterIndex(index.bytes);
  if (typeof manifest.runId !== "string") {
    throw new Error("RESEARCH_RESUME_INVALID:seed candidate metadata schema is invalid");
  }
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

  /** Settle each admitted-with-no-terminal-record attempt as ABANDONED with the
   *  RECONCILED_UNSETTLED_ON_RESUME marker and emit one operator-visible event
   *  line (phase, attemptId, action) per reconciliation. reconcileAttempt is a
   *  no-op on an already-settled attempt, so a lost race never rewrites a real
   *  outcome. */
  async #reconcileUnsettled(bookId: string, runId: string, unsettled: readonly AttemptSnapshot[]): Promise<void> {
    for (const attempt of unsettled) {
      const settled = await reconcileAttempt(this.#dependencies.runStore, {
        bookId,
        runId,
        attemptId: attempt.admission.attemptId,
        outcome: "ABANDONED",
        finishedAt: safeClock(this.#dependencies.clock),
        detail: RECONCILED_UNSETTLED_ON_RESUME,
      });
      if (!settled.ok && settled.error.code !== "CONFLICT") {
        throw new Error(`RESEARCH_RECONCILE_FAILED:${settled.error.code}`);
      }
      console.error(
        `[book-run] reconcile phase=${attempt.admission.stageId} attempt=${attempt.admission.attemptId} action=${RECONCILED_UNSETTLED_ON_RESUME}`,
      );
    }
  }

  /** Record successor-recovery provenance in BOTH the shared research-run
   *  manifest (durable, flows into the seed candidate) and the book-run event
   *  log (operator-visible console line). The reused-chapter list is derived
   *  from the successor run's own attempts: a chapter that admitted a
   *  `research-chNN` attempt in this run was re-researched; every other expected
   *  chapter was reused from the predecessor's durable sidecars. The manifest
   *  append is idempotent per successor id, so a re-materialized seed on a later
   *  resume produces byte-identical manifest bytes. */
  #recordSuccessorProvenance(args: {
    bundlePath: string;
    researchRunId: string;
    predecessorRunId: string;
    successorRunId: string;
    attempts: readonly AttemptSnapshot[];
    chapters: readonly number[];
  }): void {
    const reResearchedList = reResearchedChapterNumbers(args.attempts);
    const reResearched = new Set<number>(reResearchedList);
    const reused = args.chapters.filter((n) => !reResearched.has(n)).sort((a, b) => a - b);
    const now = new Date(safeClock(this.#dependencies.clock));
    withManifestUpdateLock({
      runDir: args.bundlePath,
      runId: args.researchRunId,
      ownerId: `research-successor-${args.successorRunId}`,
      now,
      ttlMs: DEFAULT_RESEARCH_LEASE_TTL_MS,
      update: (manifest) => {
        const already = manifest.events.some(
          (event) => event.type === "run.successor_recovery" && event.data?.successorControlRunId === args.successorRunId,
        );
        if (already) return;
        appendResearchEvent(manifest, {
          type: "run.successor_recovery",
          message: `Control run ${args.successorRunId} recovered durable research from failed predecessor ${args.predecessorRunId}; reused chapters [${reused.join(", ")}], re-researched [${reResearchedList.join(", ")}].`,
          data: {
            predecessorControlRunId: args.predecessorRunId,
            successorControlRunId: args.successorRunId,
            reusedChapters: reused,
            reResearchedChapters: reResearchedList,
          },
        }, now.toISOString());
      },
    });
    console.error(
      `[book-run] research-successor predecessor=${args.predecessorRunId} successor=${args.successorRunId} researchRunId=${args.researchRunId} reused-chapters=${reused.join(",")} reresearched-chapters=${reResearchedList.join(",")} action=REUSE_DURABLE_RESEARCH`,
    );
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
    let definition = definitionFor(input, runId, createdAt);
    let created = await this.#dependencies.runStore.createRun(definition);
    if (!created.ok && created.error.code === "CONFLICT" && input.resumeRunId !== undefined) {
      throw new Error("RESEARCH_RESUME_CONFLICT:resume run definition differs from requested intent");
    }
    if (!created.ok) throw new Error(`RESEARCH_RUN_UNAVAILABLE:${created.error.code}`);

    let candidateId = candidateIdFor(runId);
    if (created.value.status === "COMPLETED") {
      const snapshot = await openSeed(this.#dependencies.candidateStore, definition.bookId, candidateId);
      if (!snapshot) throw new Error("RESEARCH_RESUME_INVALID:completed run seed candidate is unavailable");
      const resumed = resultFromSnapshot(snapshot, runId, true);
      return Object.freeze({ ...resumed, title: input.title, author: input.author });
    }
    // A resume whose control run went TERMINAL cannot be reopened — run-state runs
    // are immutable once terminal. Finding 7 (2026-07-23 canary): a FAILED control
    // run stranded 6/7 durable chapter sidecars behind a fail-closed
    // RESEARCH_RUN_TERMINAL error, and a fresh book-run would re-research all N.
    // With the explicit --reconcile-unsettled recovery opt-in, open a SUCCESSOR
    // control run instead: it reuses the shared, still-compatible legacy research
    // run (durable K sidecars, source-v2-validated on reuse) and re-runs only the
    // missing/failed N−K chapters. The legacy research layer is keyed on
    // input+compatibility, NOT on control-run identity, so the successor discovers
    // and continues the very same durable research the failed run produced.
    // Without the flag, the fail-closed contract is preserved verbatim.
    let reuseDurableResearch = false;
    let predecessorRunId: string | undefined;
    if (created.value.status !== "RUNNING") {
      if (created.value.status !== "FAILED" || input.resumeRunId === undefined || input.reconcileUnsettled !== true) {
        throw new Error(`RESEARCH_RUN_TERMINAL:${created.value.status}`);
      }
      predecessorRunId = runId;
      const successorRunId = this.#dependencies.ids.nextRunId();
      const successorCreatedAt = safeClock(this.#dependencies.clock);
      const successorDefinition = definitionFor(input, successorRunId, successorCreatedAt);
      const successorCreated = await this.#dependencies.runStore.createRun(successorDefinition);
      if (!successorCreated.ok) throw new Error(`RESEARCH_RUN_UNAVAILABLE:${successorCreated.error.code}`);
      if (successorCreated.value.status !== "RUNNING") throw new Error(`RESEARCH_RUN_TERMINAL:${successorCreated.value.status}`);
      runId = successorRunId;
      createdAt = successorCreatedAt;
      definition = successorDefinition;
      created = successorCreated;
      candidateId = candidateIdFor(successorRunId);
      // Drive the legacy research layer to REUSE durable work (forceRefresh=false
      // via resumedRun) and report the outcome as a resume.
      resumedRun = true;
      reuseDurableResearch = true;
    }
    const uncertain = created.value.attempts.filter((attempt) => attempt.status === "ACTIVE" || attempt.status === "STALE");
    if (uncertain.length > 0) {
      if (input.reconcileUnsettled !== true) {
        throw new Error("RESEARCH_ATTEMPT_UNCERTAIN:unsettled model attempt blocks replay");
      }
      await this.#reconcileUnsettled(definition.bookId, runId, uncertain);
    }
    // Every prior attempt (settled or just-reconciled) reserves its deterministic
    // attempt id. A crash-resume re-runs the missing research work, which would
    // re-admit those exact ids and fail closed at the gateway with
    // MODEL_ATTEMPT_EXISTS. Salt the attempt-id namespace with the prior-attempt
    // count so the resumed generation mints FRESH, non-colliding ids. A fresh run
    // has zero prior attempts, so the id namespace is unchanged.
    const priorAttemptCount = created.value.attempts.length;

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
      const modelAttemptId = this.#dependencies.ids.modelAttemptId(runId);
      const baseAttemptId = priorAttemptCount === 0 ? modelAttemptId : `${modelAttemptId}-r${priorAttemptCount}`;
      const research = await researchBook(input.title, input.author, {
        bookId: definition.bookId,
        chapterConcurrency: input.chapterConcurrency,
        // Legacy research cache is global to its injected research root. A new
        // V4 control run must not SILENTLY adopt an earlier compatible bundle;
        // only an exact, known control-run resume may reuse durable chapter
        // work. An explicit --research-run-id pin is not silent: it names one
        // exact run id under THIS run's own research root and is rejected
        // outright unless the manifest proves same book, same run id, allowed
        // status, identical input identity, an identical five-field
        // compatibility fingerprint, an internally consistent bibliography, and
        // every chapter durably reusable.
        forceRefresh: input.researchRunId !== undefined ? false : (!resumedRun || input.forceRefresh === true),
        ...(input.researchRunId === undefined ? {} : { pinnedRunId: input.researchRunId }),
        runsRoot: resolve(input.v25Root, "research-runs"),
        stateRoot: resolve(input.v25Root, "research-state"),
        // A durable chapter reused on resume must still pass the source-v2 route
        // validator (the same gate requireSourceV2 applies to freshly-researched
        // chapters); a cached sidecar that no longer does is re-researched, not
        // reused. Never crashes on a corrupt reused sidecar.
        validateReusedChapter: chapterRouteValid,
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
      // Defense-in-depth readback: researchBook surfaces the run it actually
      // adopted, so the pin is verified against what happened, not what was asked.
      if (input.researchRunId !== undefined && research.runId !== input.researchRunId) {
        throw new Error(`RESEARCH_RUN_PIN_MISMATCH:research adopted run ${research.runId}, pin requested ${input.researchRunId}`);
      }
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

      // Record successor-recovery provenance BEFORE materializing the seed so the
      // reused-chapter list + predecessor link are durably captured in the seed's
      // research-run manifest (and the book-run event log). Only on the recovery
      // path; a normal run has no predecessor.
      if (reuseDurableResearch && predecessorRunId !== undefined) {
        this.#recordSuccessorProvenance({
          bundlePath: research.bundlePath,
          researchRunId: research.runId,
          predecessorRunId,
          successorRunId: runId,
          attempts: live.value.attempts,
          chapters: research.chapters.map((chapter) => chapter.chapterNumber),
        });
      }

      if (input.researchRunId !== undefined) {
        // A NON-EMPTY re-researched list under a pin means a durable sidecar
        // failed chapterRouteValid at reuse time (a validator tightening). The
        // book is still correct — it just lost section-pack cache reuse, because
        // re-researching even one chapter rewrites the book-level book-source.md
        // and perturbs every chapter's packetDigest. Log it loudly; never fail.
        const reResearched = reResearchedChapterNumbers(live.value.attempts);
        const reResearchedSet = new Set(reResearched);
        const reused = research.chapters
          .map((chapter) => chapter.chapterNumber)
          .filter((n) => !reResearchedSet.has(n))
          .sort((a, b) => a - b);
        console.error(
          `[book-run] research-pin book=${definition.bookId} pinned-research-run=${input.researchRunId} reused-chapters=${reused.join(",")} reresearched-chapters=${reResearched.join(",")} action=REUSE_PINNED_RESEARCH`,
        );
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
        ...(reuseDurableResearch && predecessorRunId !== undefined ? { recoveredFromRunId: predecessorRunId } : {}),
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
