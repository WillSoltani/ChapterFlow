import { existsSync, mkdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { STAGE_CACHE_CODE_VERSION, type ProviderIdentity } from "./cache/stageCache.js";
import { CANONICAL_STATE } from "./lib/chapterPaths.js";
import { canonicalJsonSha256 } from "./lib/canonicalJson.js";
import { writeFileAtomic } from "./lib/atomicWrite.js";
import { readerContentHash } from "./lib/readerContent.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "./types.js";

export const GENERATION_RUN_MANIFEST_SCHEMA_VERSION = "chapter-generation-run-v1" as const;
export const GENERATION_STAGE_PROVENANCE_SCHEMA_VERSION = "chapter-generation-stage-v1" as const;
export const GENERATION_DEGRADATION_EVENT_SCHEMA_VERSION = "generation-degradation-event-v1" as const;
export const GENERATION_DEBT_REPORT_SCHEMA_VERSION = "generation-debt-report-v1" as const;
export const GENERATION_DEGRADATION_WAIVER_FILE_SCHEMA_VERSION = "generation-degradation-waivers-v1" as const;
export const GENERATION_DEGRADATION_WAIVER_SCHEMA_VERSION = "generation-degradation-waiver-v1" as const;
export const GENERATION_PROMPT_SET_ID = "chapterflow-v21-authored-prompts-v1" as const;
export const GENERATION_CONFIG_ID = "chapterflow-v21-authored-config-v1" as const;
export const GENERATION_PROVENANCE_PROJECTION_VERSION = "generation-provenance-internal-v1" as const;

export type GenerationDegradableStage =
  | "voice-pass"
  | "line-editor"
  | "try-this-now"
  | "memorable-lines"
  | "writer-example"
  | "categorizer";

export type GenerationStage =
  | "editor-in-chief"
  | "curriculum-planner"
  | "writer-hook"
  | "writer-breakdown"
  | GenerationDegradableStage
  | "example-curator"
  | "writer-quiz"
  | "writer-cards"
  | "writer-implementation-plan"
  | "key-takeaway"
  | "assembly"
  | "ship-gate";

export type GenerationDegradationSeverity = "advisory" | "serious";
export type GenerationRequiredDisposition = "visible_advisory" | "resolve_before_production";
export type GenerationStageStatus = "primary" | "fallback" | "skipped" | "blocked";

export type GenerationFallbackUsed = {
  kind: string;
  policy: "availability" | "operator-supplied" | "metadata-only";
  reason: string;
};

export type GenerationDegradationEventV1 = {
  schemaVersion: typeof GENERATION_DEGRADATION_EVENT_SCHEMA_VERSION;
  eventId: string;
  stage: GenerationDegradableStage;
  inputHashes: Record<string, string>;
  error: {
    class: string;
    message: string;
  };
  attemptCount: number;
  fallbackUsed: GenerationFallbackUsed;
  outputHash: string;
  severity: GenerationDegradationSeverity;
  requiredDisposition: GenerationRequiredDisposition;
  observedAt: string;
};

export type GenerationStageProvenanceV1 = {
  schemaVersion: typeof GENERATION_STAGE_PROVENANCE_SCHEMA_VERSION;
  stage: GenerationStage;
  status: GenerationStageStatus;
  inputHash: string;
  outputHash: string | null;
  attemptCount: number;
  provider: ProviderIdentity;
  completedAt: string;
  degradationEventId?: string;
};

export type GenerationRunManifestV1 = {
  schemaVersion: typeof GENERATION_RUN_MANIFEST_SCHEMA_VERSION;
  runId: string;
  chapterId: string;
  authorSessionId: string;
  createdAt: string;
  promptSetId: string;
  configId: string;
  codeVersion: string;
  provider: ProviderIdentity;
  sourceHash: string | null;
  sourceAnchorCatalogHash: string | null;
  planHash: string | null;
  chapterSchemaVersion: typeof V21_SCHEMA_VERSION;
  projection: {
    version: typeof GENERATION_PROVENANCE_PROJECTION_VERSION;
    readerContentHashInclusion: "excluded";
    note: string;
  };
  stages: GenerationStageProvenanceV1[];
  degradations: GenerationDegradationEventV1[];
};

export type GenerationDegradationWaiverV1 = {
  schemaVersion: typeof GENERATION_DEGRADATION_WAIVER_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  eventId: string;
  stage: GenerationDegradableStage;
  outputHash: string;
  chapterReaderContentHash: string;
  waivedBy: string;
  reason: string;
  createdAt: string;
};

export type GenerationDegradationWaiverFileV1 = {
  schemaVersion: typeof GENERATION_DEGRADATION_WAIVER_FILE_SCHEMA_VERSION;
  bookId: string;
  records: GenerationDegradationWaiverV1[];
};

export type GenerationDebtFinding = {
  checkId:
    | "GDEBT.unresolved_serious_degradation"
    | "GDEBT.advisory_degradation"
    | "GDEBT.waiver_stale";
  severity: "blocker" | "advisory";
  chapterNumber?: number;
  chapterId: string;
  eventId: string;
  stage: GenerationDegradableStage;
  message: string;
  requiredDisposition: GenerationRequiredDisposition;
  outputHash: string;
};

export type GenerationDebtReport = {
  schemaVersion: typeof GENERATION_DEBT_REPORT_SCHEMA_VERSION;
  bookId: string;
  totalBlockers: number;
  totalAdvisories: number;
  findings: GenerationDebtFinding[];
  waived: Array<{
    chapterId: string;
    eventId: string;
    stage: GenerationDegradableStage;
    waivedBy: string;
  }>;
};

export type CreateGenerationRunManifestInput = {
  runId: string;
  chapterId: string;
  authorSessionId: string;
  provider: ProviderIdentity;
  codeVersion?: string;
  promptSetId?: string;
  configId?: string;
  sourceHash?: string | null;
  sourceAnchorCatalogHash?: string | null;
  planHash?: string | null;
  createdAt?: string;
};

export type RecordGenerationStageInput = {
  stage: GenerationStage;
  status?: GenerationStageStatus;
  input?: unknown;
  inputHash?: string;
  output?: unknown;
  outputHash?: string | null;
  attemptCount?: number;
  provider?: ProviderIdentity;
  completedAt?: string;
  degradationEventId?: string;
};

export type RecordGenerationDegradationInput = {
  stage: GenerationDegradableStage;
  inputHashes: Record<string, string>;
  error: unknown;
  attemptCount: number;
  fallbackUsed: GenerationFallbackUsed;
  fallbackOutput: unknown;
  severity: GenerationDegradationSeverity;
  requiredDisposition: GenerationRequiredDisposition;
  observedAt?: string;
};

export function generationInputHash(value: unknown): string {
  return canonicalJsonSha256(value ?? null);
}

export function generationInputHashes(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, generationInputHash(value)]));
}

export function createGenerationRunManifest(input: CreateGenerationRunManifestInput): GenerationRunManifestV1 {
  return {
    schemaVersion: GENERATION_RUN_MANIFEST_SCHEMA_VERSION,
    runId: input.runId,
    chapterId: input.chapterId,
    authorSessionId: input.authorSessionId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    promptSetId: input.promptSetId ?? GENERATION_PROMPT_SET_ID,
    configId: input.configId ?? GENERATION_CONFIG_ID,
    codeVersion: input.codeVersion ?? STAGE_CACHE_CODE_VERSION,
    provider: input.provider,
    sourceHash: input.sourceHash ?? null,
    sourceAnchorCatalogHash: input.sourceAnchorCatalogHash ?? null,
    planHash: input.planHash ?? null,
    chapterSchemaVersion: V21_SCHEMA_VERSION,
    projection: {
      version: GENERATION_PROVENANCE_PROJECTION_VERSION,
      readerContentHashInclusion: "excluded",
      note: "Generation provenance is authoring-internal and is stripped before reader-content hashing.",
    },
    stages: [],
    degradations: [],
  };
}

export function recordGenerationStage(
  manifest: GenerationRunManifestV1,
  input: RecordGenerationStageInput,
): GenerationStageProvenanceV1 {
  const stage: GenerationStageProvenanceV1 = {
    schemaVersion: GENERATION_STAGE_PROVENANCE_SCHEMA_VERSION,
    stage: input.stage,
    status: input.status ?? "primary",
    inputHash: input.inputHash ?? generationInputHash(input.input ?? null),
    outputHash: input.outputHash === undefined ? generationInputHash(input.output ?? null) : input.outputHash,
    attemptCount: input.attemptCount ?? 1,
    provider: input.provider ?? manifest.provider,
    completedAt: input.completedAt ?? new Date().toISOString(),
    ...(input.degradationEventId ? { degradationEventId: input.degradationEventId } : {}),
  };
  manifest.stages.push(stage);
  return stage;
}

export function recordGenerationDegradation(
  manifest: GenerationRunManifestV1,
  input: RecordGenerationDegradationInput,
): GenerationDegradationEventV1 {
  const err = errorParts(input.error);
  const outputHash = generationInputHash(input.fallbackOutput ?? null);
  const stableForId = {
    schemaVersion: GENERATION_DEGRADATION_EVENT_SCHEMA_VERSION,
    runId: manifest.runId,
    chapterId: manifest.chapterId,
    stage: input.stage,
    inputHashes: input.inputHashes,
    error: err,
    attemptCount: input.attemptCount,
    fallbackUsed: input.fallbackUsed,
    outputHash,
    severity: input.severity,
    requiredDisposition: input.requiredDisposition,
  };
  const eventId = `gde_${canonicalJsonSha256(stableForId).replace(/^sha256:/, "").slice(0, 24)}`;
  const event: GenerationDegradationEventV1 = {
    ...stableForId,
    eventId,
    observedAt: input.observedAt ?? new Date().toISOString(),
  };
  manifest.degradations.push(event);
  recordGenerationStage(manifest, {
    stage: input.stage,
    status: "fallback",
    inputHash: generationInputHash(input.inputHashes),
    outputHash,
    attemptCount: input.attemptCount,
    degradationEventId: eventId,
    completedAt: event.observedAt,
  });
  return event;
}

export function stampChapterGenerationProvenance(
  chapter: ChapterV21,
  manifest: GenerationRunManifestV1,
): ChapterV21 {
  return {
    ...chapter,
    schemaVersion: V21_SCHEMA_VERSION,
    authoring: {
      ...(chapter.authoring ?? {}),
      schemaVersion: "chapter-authoring-v1",
      generation: manifest,
    },
  };
}

export function generationManifestPathFor(chapterId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "generation-manifests", `${chapterId}.generation.json`);
}

export function writeGenerationManifestSidecar(
  manifest: GenerationRunManifestV1,
  stateRoot: string = CANONICAL_STATE,
): string {
  const path = generationManifestPathFor(manifest.chapterId, stateRoot);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileAtomic(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return path;
}

export function generationWaiverPath(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "waivers", `${bookId}.generation-degradation-waivers.json`);
}

export function loadGenerationDegradationWaivers(
  bookId: string,
  stateRoot: string = CANONICAL_STATE,
): GenerationDegradationWaiverV1[] {
  const path = generationWaiverPath(bookId, stateRoot);
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<GenerationDegradationWaiverFileV1>;
    if (raw.schemaVersion !== GENERATION_DEGRADATION_WAIVER_FILE_SCHEMA_VERSION || !Array.isArray(raw.records)) return [];
    return raw.records.filter(isWaiverForBook(bookId));
  } catch {
    return [];
  }
}

export function createGenerationDegradationWaiver(input: {
  bookId: string;
  chapterId: string;
  event: GenerationDegradationEventV1;
  chapterReaderContentHash: string;
  waivedBy: string;
  reason: string;
  createdAt?: string;
}): GenerationDegradationWaiverV1 {
  return {
    schemaVersion: GENERATION_DEGRADATION_WAIVER_SCHEMA_VERSION,
    bookId: input.bookId,
    chapterId: input.chapterId,
    eventId: input.event.eventId,
    stage: input.event.stage,
    outputHash: input.event.outputHash,
    chapterReaderContentHash: input.chapterReaderContentHash,
    waivedBy: input.waivedBy,
    reason: input.reason,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function evaluateGenerationDebt(
  bookId: string,
  chapters: ChapterV21[],
  options: { waivers?: GenerationDegradationWaiverV1[]; stateRoot?: string } = {},
): GenerationDebtReport {
  const waivers = options.waivers ?? loadGenerationDegradationWaivers(bookId, options.stateRoot);
  const findings: GenerationDebtFinding[] = [];
  const waived: GenerationDebtReport["waived"] = [];

  for (const chapter of chapters) {
    const events = chapter.authoring?.generation?.degradations ?? [];
    const contentHash = readerContentHash(chapter);
    for (const event of events) {
      if (event.severity === "advisory" || event.requiredDisposition === "visible_advisory") {
        findings.push({
          checkId: "GDEBT.advisory_degradation",
          severity: "advisory",
          chapterNumber: chapter.number,
          chapterId: chapter.chapterId,
          eventId: event.eventId,
          stage: event.stage,
          requiredDisposition: event.requiredDisposition,
          outputHash: event.outputHash,
          message: `${chapter.chapterId} recorded advisory generation degradation at ${event.stage}: ${event.error.message}`,
        });
        continue;
      }

      const matchingWaiver = waivers.find((waiver) =>
        waiver.bookId === bookId &&
        waiver.chapterId === chapter.chapterId &&
        waiver.eventId === event.eventId &&
        waiver.stage === event.stage &&
        waiver.outputHash === event.outputHash &&
        waiver.chapterReaderContentHash === contentHash,
      );
      if (matchingWaiver) {
        waived.push({
          chapterId: chapter.chapterId,
          eventId: event.eventId,
          stage: event.stage,
          waivedBy: matchingWaiver.waivedBy,
        });
        continue;
      }

      const stale = waivers.find((waiver) =>
        waiver.bookId === bookId &&
        waiver.chapterId === chapter.chapterId &&
        waiver.eventId === event.eventId,
      );
      findings.push({
        checkId: stale ? "GDEBT.waiver_stale" : "GDEBT.unresolved_serious_degradation",
        severity: "blocker",
        chapterNumber: chapter.number,
        chapterId: chapter.chapterId,
        eventId: event.eventId,
        stage: event.stage,
        requiredDisposition: event.requiredDisposition,
        outputHash: event.outputHash,
        message: stale
          ? `${chapter.chapterId} has a stale waiver for ${event.stage}; waiver content hash ${stale.chapterReaderContentHash} does not match current reader content ${contentHash}.`
          : `${chapter.chapterId} has unresolved serious generation degradation at ${event.stage}: ${event.error.message}`,
      });
    }
  }

  return {
    schemaVersion: GENERATION_DEBT_REPORT_SCHEMA_VERSION,
    bookId,
    findings,
    waived,
    totalBlockers: findings.filter((finding) => finding.severity === "blocker").length,
    totalAdvisories: findings.filter((finding) => finding.severity === "advisory").length,
  };
}

function errorParts(error: unknown): GenerationDegradationEventV1["error"] {
  if (error instanceof Error) {
    return { class: error.name || "Error", message: error.message };
  }
  return { class: typeof error, message: String(error) };
}

function isWaiverForBook(bookId: string): (waiver: unknown) => waiver is GenerationDegradationWaiverV1 {
  return (waiver: unknown): waiver is GenerationDegradationWaiverV1 => {
    if (!waiver || typeof waiver !== "object" || Array.isArray(waiver)) return false;
    const record = waiver as Partial<GenerationDegradationWaiverV1>;
    return record.schemaVersion === GENERATION_DEGRADATION_WAIVER_SCHEMA_VERSION &&
      record.bookId === bookId &&
      typeof record.chapterId === "string" &&
      typeof record.eventId === "string" &&
      typeof record.outputHash === "string" &&
      typeof record.chapterReaderContentHash === "string" &&
      typeof record.waivedBy === "string" &&
      typeof record.reason === "string" &&
      typeof record.createdAt === "string";
  };
}
