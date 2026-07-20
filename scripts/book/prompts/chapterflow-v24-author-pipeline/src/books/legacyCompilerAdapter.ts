import { isAbsolute, relative, resolve } from "node:path";

import type { CompilerStoreRoots } from "../artifacts/artifactStore.js";
import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { validateBlueprint } from "../compiler/blueprintGate.js";
import { deriveBookDesign, validateBookDesign } from "../compiler/bookDesign.js";
import { compileChapterBriefs, renderBriefMd } from "../compiler/chapterBrief.js";
import { compileChapterBlueprint } from "../compiler/chapterBlueprint.js";
import { dealContentDeviceAllows, dealContentDeviceBans } from "../compiler/contentDeviceDeal.js";
import type { PlannedArtifact, PortError, Result } from "../contracts/v4Core.js";
import type { ChapterSpec } from "../generateChapter.js";
import type { ExecutionProfile } from "../runtime/executionPolicyTypes.js";
import type { PromptRequest } from "../runtime/promptRequest.js";
import { sourceBundleFromBytes, type SourceBundle } from "../source-loader.js";
import type {
  BookContentReader,
  CandidateInputFile,
  CandidateManifest,
  CandidateSelector,
  CandidateSnapshot,
  CandidateStore,
} from "./candidateTypes.js";

export const COMPILER_SHADOW_PROFILE = Object.freeze<ExecutionProfile>({
  id: "compiler.shadow.compare.v1",
  workDirPolicy: "ATTEMPT_ROOT",
  mode: "READ_ONLY",
  outputSchemaId: "json.object.v1",
  timeoutMs: 60_000,
  terminateGraceMs: 2_000,
  maxStdoutBytes: 1_048_576,
  maxStderrBytes: 262_144,
});

export type CompilerCompatibilityContext = Readonly<{
  bookId: string;
  runId: string;
  selector: CandidateSelector;
  pipelineRoot: string;
  disposableRoot: string;
  legacyRoots: CompilerStoreRoots;
  shadowRoots: CompilerStoreRoots;
  profile: ExecutionProfile;
}>;

export type CompilerComparison<T> = Readonly<{
  legacy: T;
  shadow: T | null;
  matched: boolean;
  selected: "LEGACY";
  mismatch: string | null;
}>;

export type SnapshotComparison = Readonly<{
  matched: boolean;
  selected: null;
  mismatch: string | null;
}>;

export type CandidateSourcePaths = Readonly<{
  chapterSource?: string;
  bookSource?: string;
  toc?: string;
}>;

export type CompilerArtifactComparisonInput = Readonly<{
  chapter: ChapterSpec;
  packet: SourcePacketV1;
  totalChapters: number;
}>;

type AdapterError = PortError & { readonly code: "COMPILER_CONTEXT_INVALID" | "COMPILER_SELECTOR_BLOCKED" };

function failed<T>(code: AdapterError["code"], message: string): Result<T, AdapterError> {
  return { ok: false, error: { code, message, retryable: false } };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
      .map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

function normalized(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function within(base: string, target: string): boolean {
  const rel = relative(resolve(base), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function snapshotFingerprint(snapshot: CandidateSnapshot): string {
  return normalized({
    identity: {
      schemaVersion: snapshot.manifest.schemaVersion,
      bookId: snapshot.manifest.bookId,
      candidateId: snapshot.manifest.candidateId,
      createdByRunId: snapshot.manifest.createdByRunId,
      manifestDigest: snapshot.manifest.manifestDigest,
      entries: snapshot.manifest.entries,
    },
    files: snapshot.files.map((file) => ({
      kind: file.kind,
      logicalPath: file.logicalPath,
      mediaType: file.mediaType,
      byteLength: file.byteLength,
      bytes: Buffer.from(file.bytes).toString("base64"),
    })),
  });
}

function assertContext(context: CompilerCompatibilityContext): void {
  for (const [name, value] of [["bookId", context.bookId], ["runId", context.runId]] as const) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new Error(`${name} is invalid`);
  }
  if (!isAbsolute(context.pipelineRoot)) throw new Error("pipelineRoot must be absolute");
  if (!isAbsolute(context.disposableRoot)) throw new Error("disposableRoot must be absolute");
  const legacyRoot = context.legacyRoots.stateRoot;
  const shadowRoot = context.shadowRoots.stateRoot;
  if (!legacyRoot || !shadowRoot || !isAbsolute(legacyRoot) || !isAbsolute(shadowRoot)) {
    throw new Error("legacy and shadow state roots must be explicit absolute paths");
  }
  if (!within(context.disposableRoot, shadowRoot)) throw new Error("shadow root must be within disposableRoot");
  if (within(legacyRoot, shadowRoot) || within(shadowRoot, legacyRoot)) throw new Error("shadow root must be distinct from legacy root");
  if (within(context.pipelineRoot, shadowRoot) || within(shadowRoot, context.pipelineRoot)) {
    throw new Error("shadow root must be distinct from pipelineRoot");
  }
  if (context.profile.id !== COMPILER_SHADOW_PROFILE.id || normalized(context.profile) !== normalized(COMPILER_SHADOW_PROFILE)) {
    throw new Error(`compiler shadow profile must be ${COMPILER_SHADOW_PROFILE.id}`);
  }
  if (context.selector.kind !== "CURRENT" && context.selector.kind !== "CANDIDATE") throw new Error("candidate selector is required");
}

export function compilerShadowPrompt(inputs: PromptRequest["inputs"]): PromptRequest {
  return {
    templateId: "compiler.shadow.compare.v1",
    inputs: inputs.map((input) => ({
      name: input.name,
      mediaType: input.mediaType,
      bytes: Buffer.from(input.bytes),
    })),
  };
}

export function compareCandidateSnapshots(legacy: CandidateSnapshot, shadow: CandidateSnapshot): SnapshotComparison {
  const matched = snapshotFingerprint(legacy) === snapshotFingerprint(shadow);
  return {
    matched,
    selected: null,
    mismatch: matched ? null : "candidate manifest identity, inventory, order, or bytes differ",
  };
}

export function sourceBundleFromCandidate(
  snapshot: CandidateSnapshot,
  bookId: string,
  chapterNumber: number | undefined,
  paths: CandidateSourcePaths,
): Result<SourceBundle> {
  if (snapshot.manifest.bookId !== bookId) return failed("COMPILER_SELECTOR_BLOCKED", "selected candidate bookId mismatch");
  const byPath = new Map(snapshot.files.map((file) => [file.logicalPath, file.bytes]));
  const requested = [paths.chapterSource, paths.bookSource, paths.toc].filter((path): path is string => path !== undefined);
  const missing = requested.filter((path) => !byPath.has(path));
  if (missing.length > 0) return failed("COMPILER_SELECTOR_BLOCKED", `selected candidate lacks required source artifact(s): ${missing.join(", ")}`);
  return {
    ok: true,
    value: sourceBundleFromBytes(bookId, chapterNumber, {
      ...(paths.chapterSource ? { chapterSource: byPath.get(paths.chapterSource)! } : {}),
      ...(paths.bookSource ? { bookSource: byPath.get(paths.bookSource)! } : {}),
      ...(paths.toc ? { toc: byPath.get(paths.toc)! } : {}),
    }),
  };
}

/** Compatibility only: legacy remains first and authoritative; shadow mismatch never replaces it. */
export class LegacyCompilerAdapter {
  readonly #context: CompilerCompatibilityContext;
  readonly #contentReader: BookContentReader;
  readonly #candidateStore: CandidateStore;

  constructor(input: Readonly<{
    context: CompilerCompatibilityContext;
    contentReader: BookContentReader;
    candidateStore: CandidateStore;
  }>) {
    assertContext(input.context);
    this.#context = input.context;
    this.#contentReader = input.contentReader;
    this.#candidateStore = input.candidateStore;
  }

  get context(): CompilerCompatibilityContext {
    return this.#context;
  }

  async openSelectedContent(): Promise<Result<CandidateSnapshot>> {
    return this.#contentReader.open({ bookId: this.#context.bookId, selector: this.#context.selector });
  }

  async compare<T>(legacy: () => T, shadow: (roots: CompilerStoreRoots) => T): Promise<CompilerComparison<T>> {
    const legacyValue = legacy();
    try {
      const shadowValue = shadow(this.#context.shadowRoots);
      const matched = normalized(legacyValue) === normalized(shadowValue);
      return {
        legacy: legacyValue,
        shadow: shadowValue,
        matched,
        selected: "LEGACY",
        mismatch: matched ? null : "normalized legacy and shadow compiler results differ",
      };
    } catch (cause) {
      return {
        legacy: legacyValue,
        shadow: null,
        matched: false,
        selected: "LEGACY",
        mismatch: `shadow comparison blocked: ${(cause as Error).message}`,
      };
    }
  }

  /** Direct owned-symbol shadow route. Callbacks cannot bypass supplied roots. */
  async compareCompilerArtifacts(input: CompilerArtifactComparisonInput): Promise<CompilerComparison<unknown>> {
    const compile = (roots: CompilerStoreRoots): unknown => {
      const design = deriveBookDesign(this.#context.bookId, {
        roots,
        packets: [input.packet],
        chapters: input.totalChapters,
      });
      const blueprint = compileChapterBlueprint({
        bookId: this.#context.bookId,
        chapter: input.chapter,
        packet: input.packet,
        packetPath: `candidate://${this.#context.runId}/packets/ch${String(input.chapter.chapterNumber).padStart(2, "0")}.json`,
        roots,
        totalChapters: input.totalChapters,
      });
      const briefs = compileChapterBriefs(this.#context.bookId, { roots });
      return {
        design,
        blueprint,
        briefs: briefs.briefs.map((brief) => ({ brief, markdown: renderBriefMd(brief) })),
        gates: {
          design: validateBookDesign(design, input.totalChapters),
          blueprint: validateBlueprint(blueprint),
          briefFindings: briefs.findings,
        },
        contentDevices: {
          bans: dealContentDeviceBans(input.chapter.chapterNumber, input.totalChapters),
          allows: dealContentDeviceAllows(input.chapter.chapterNumber, input.totalChapters),
        },
      };
    };
    return this.compare(() => compile(this.#context.legacyRoots), () => compile(this.#context.shadowRoots));
  }

  async stageCandidate(input: Readonly<{
    candidateId: string;
    parentCandidateId?: string;
    expectedInventory: readonly PlannedArtifact[];
    files: readonly CandidateInputFile[];
    createdAt: string;
  }>): Promise<Result<CandidateManifest>> {
    return this.#candidateStore.stage({
      bookId: this.#context.bookId,
      candidateId: input.candidateId,
      ...(input.parentCandidateId === undefined ? {} : { parentCandidateId: input.parentCandidateId }),
      createdByRunId: this.#context.runId,
      expectedInventory: input.expectedInventory,
      files: input.files,
      createdAt: input.createdAt,
    });
  }
}
