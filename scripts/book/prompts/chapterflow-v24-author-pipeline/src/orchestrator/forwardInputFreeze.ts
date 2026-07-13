/**
 * IMP-22 forward-only input inventory and materialization.
 *
 * This module is deliberately model-free. It turns already researched source
 * artifacts into a hash-frozen, experiment-local authoring input tree. It never
 * reads a prior chapter as author input and it has no publish/promotion surface.
 * The only fields consumed from a historical book package are book metadata and
 * the canonical chapter identities/titles.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { basename, relative, resolve } from "path";

import type { SourcePacketV1, CompilerRunRecord } from "../artifacts/artifactTypes.js";
import { V23_COMPILER_SCHEMA_VERSION } from "../artifacts/artifactTypes.js";
import {
  chapterBriefMdPath,
  chapterBriefPath,
  sourcePacketPath,
  sourceUsePlanPath,
  type CompilerStoreRoots,
} from "../artifacts/artifactStore.js";
import {
  compileChapterBriefs,
  renderBriefMd,
} from "../compiler/chapterBrief.js";
import {
  compileSourcePacketFromSidecar,
  sourcePacketHash,
  tagBookWideDuplicateFacts,
} from "../compiler/sourcePacket.js";
import { applyTeachingRanking } from "../compiler/sourcePacketFacts.js";
import { validateSourcePacket } from "../compiler/sourcePacketGate.js";
import { compileSourceUsePlan } from "../compiler/sourceUsePlanCompiler.js";
import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { sourceUsePlanHash, validateSourceUsePlan, type SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import type { ChapterSpec } from "../generateChapter.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { normSlug } from "../lib/chapterPaths.js";
import { canonicalJson } from "../lib/canonicalJson.js";
import { buildSourceAnchorCatalog } from "../source/sourceEvidence.js";
import { evaluateSourceV2Integrity, semanticSourceHash } from "../source/sourceIntegrity.js";
import type { SourceSidecarV2 } from "../source/sidecarSchema.js";
import type { BookBrief, SourceAnchorForPrompt } from "../types.js";
import {
  FORWARD_CHAPTER_STRATA,
  type ForwardBookSelectionCandidateV1,
  type ForwardChapterStratum,
  type ForwardRiskSignal,
  type ForwardSourceCoordinateV1,
} from "./forwardValidationCampaign.js";

export const FORWARD_INPUT_FREEZE_SCHEMA = "forward-input-freeze-v1" as const;
export const FORWARD_BOOK_INPUT_SCHEMA = "forward-book-input-v1" as const;
export const FORWARD_INPUT_SELECTION_POLICY = "imp22-forward-input-selection-v1" as const;
export const FORWARD_EXPERIMENT_COMPILER_RUN_ID = "imp22-inputs-v1" as const;

export class ForwardInputFreezeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardInputFreezeError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardInputFreezeError(message);
}

function readBytes(path: string): Buffer {
  try {
    return readFileSync(path);
  } catch (error) {
    throw new ForwardInputFreezeError(`cannot read required input ${path}: ${(error as Error).message}`);
  }
}

function readJson<T>(path: string): { value: T; bytes: Buffer } {
  const bytes = readBytes(path);
  try {
    return { value: JSON.parse(bytes.toString("utf8")) as T, bytes };
  } catch (error) {
    throw new ForwardInputFreezeError(`required input is not JSON ${path}: ${(error as Error).message}`);
  }
}

function stableJson(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}

function writeStableJson(path: string, value: unknown): void {
  writeFileAtomic(path, stableJson(value));
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.map(normSlug))].sort((a, b) => a.localeCompare(b));
}

function chapterFileStem(chapterNumber: number, suffix: string): string {
  return `ch${String(chapterNumber).padStart(2, "0")}.${suffix}`;
}

export type ForwardInputFileRoot = "packet-archive" | "source-archive" | "package-archive";

export type FrozenForwardInputFileV1 = {
  root: ForwardInputFileRoot;
  relativePath: string;
  bytesSha256: string;
};

export type ForwardChapterFeaturesV1 = {
  factCount: number;
  mechanismFactCount: number;
  nonRobustFactCount: number;
  namedCaseCount: number;
  realWorldCaseCount: number;
  hardSpecificCount: number;
  groundedNumberCount: number;
  groundedEntityCount: number;
  frameworkMemberCount: number;
  conceptualTokenCount: number;
  causalMarkerCount: number;
  bookWideDuplicateCount: number;
  stratumScores: Record<ForwardChapterStratum, number>;
};

export type ForwardChapterInputV1 = {
  spec: ChapterSpec;
  packet: SourcePacketV1;
  /** Exact archived packet bytes (gold packets are deterministically compiled bytes). */
  packetBytes: string;
  plan: SourceUsePlanV1;
  sidecar: SourceSidecarV2;
  /** Exact archived source-v2 bytes, preserved into the experiment-local copy. */
  sidecarBytes: string;
  anchors: SourceAnchorForPrompt[];
  features: ForwardChapterFeaturesV1;
  hashes: {
    packetArchiveBytesSha256: string;
    packetBytesSha256: string;
    sourcePacketSha256: string;
    sourceUsePlanSha256: string;
    sidecarBytesSha256: string;
    sidecarSha256: string;
    anchorCatalogSha256: string;
  };
  sourceFiles: FrozenForwardInputFileV1[];
};

export type ForwardBookInputV1 = {
  schema: typeof FORWARD_BOOK_INPUT_SCHEMA;
  bookId: string;
  sourceArchiveId: string;
  titleProjection: {
    bookId: string;
    title: string;
    author: string;
    categories: string[];
    tags: string[];
    chapters: ChapterSpec[];
  };
  titleProjectionSha256: string;
  packageBytesSha256: string | null;
  chapters: ForwardChapterInputV1[];
  sourceComplete: boolean;
  representativeTags: string[];
  sourceFiles: FrozenForwardInputFileV1[];
  bookInputSha256: string;
};

export type PilotBookInventoryArgs = {
  bookId: string;
  packetDir: string;
  sidecarDir: string;
  sourceArchiveId: string;
  /** Defaults to the canonical packet chapter titles. */
  bookTitle?: string;
  author?: string;
  representativeTags?: string[];
};

function packetFiles(dir: string): string[] {
  requireCondition(existsSync(dir) && statSync(dir).isDirectory(), `packet directory is missing: ${dir}`);
  return readdirSync(dir)
    .filter((name) => /^ch\d{2,3}\.source-packet\.json$/.test(name))
    .sort((a, b) => a.localeCompare(b));
}

function sidecarPath(dir: string, n: number): string {
  return resolve(dir, chapterFileStem(n, "source.json"));
}

function causalMarkers(packet: SourcePacketV1): number {
  const re = /\b(?:because|caus(?:e|es|ed|al)|drives?|leads? to|results? in|therefore|mechanism)\b/gi;
  return packet.facts.reduce((count, fact) => count + ((`${fact.claim} ${fact.mechanism}`.match(re) ?? []).length), 0);
}

function conceptualTokenCount(sidecar: SourceSidecarV2): number {
  const text = [
    sidecar.centralConcept?.name,
    sidecar.centralConcept?.plainDefinition,
    sidecar.centralConcept?.whyItMatters,
    ...(sidecar.keyClaims ?? []),
  ].filter((value): value is string => typeof value === "string").join(" ");
  return (text.match(/[A-Za-z0-9']+/g) ?? []).length;
}

export function deriveForwardChapterFeatures(packet: SourcePacketV1, sidecar: SourceSidecarV2): ForwardChapterFeaturesV1 {
  const factCount = packet.facts.length;
  const mechanismFactCount = packet.facts.filter((fact) => fact.mechanism.trim().length > 0).length;
  const nonRobustFactCount = packet.facts.filter((fact) => fact.replicationStatus && fact.replicationStatus !== "robust").length;
  const namedCaseCount = packet.namedCases.length;
  const realWorldCaseCount = packet.namedCases.filter((item) => item.realWorld).length;
  const hardSpecificCount = packet.namedCases.reduce((sum, item) => sum + item.hardSpecifics.length, 0);
  const groundedNumberCount = packet.allowedNumbers.length;
  const groundedEntityCount = packet.allowedEntities.length;
  const frameworkMemberCount = packet.frameworks.reduce((sum, framework) => sum + framework.members.length, 0);
  const conceptualTokens = conceptualTokenCount(sidecar);
  const causalMarkerCount = causalMarkers(packet);
  const bookWideDuplicateCount = packet.facts.filter((fact) => fact.bookWideDuplicate).length;
  const stratumScores: Record<ForwardChapterStratum, number> = {
    "research-heavy": factCount * 2 + realWorldCaseCount * 8 + hardSpecificCount * 3 + groundedNumberCount * 2 + groundedEntityCount,
    "abstract-conceptual": frameworkMemberCount * 6 + conceptualTokens * 2 + factCount * 2 - namedCaseCount,
    "example-heavy": namedCaseCount * 12 + realWorldCaseCount * 4 + hardSpecificCount * 4,
    "causal-quiz-sensitive": mechanismFactCount * 4 + causalMarkerCount * 3 + nonRobustFactCount * 10 + factCount + bookWideDuplicateCount * 2,
  };
  return {
    factCount,
    mechanismFactCount,
    nonRobustFactCount,
    namedCaseCount,
    realWorldCaseCount,
    hardSpecificCount,
    groundedNumberCount,
    groundedEntityCount,
    frameworkMemberCount,
    conceptualTokenCount: conceptualTokens,
    causalMarkerCount,
    bookWideDuplicateCount,
    stratumScores,
  };
}

function validateChapterInput(args: {
  bookId: string;
  packet: SourcePacketV1;
  packetBytes: Buffer;
  sidecar: SourceSidecarV2;
  sidecarBytes: Buffer;
  packetPath: string;
  sidecarPath: string;
  sourceArchiveId: string;
}): ForwardChapterInputV1 {
  const { packet, sidecar } = args;
  const bookId = normSlug(args.bookId);
  requireCondition(packet.bookId === bookId, `${args.packetPath}: packet bookId ${packet.bookId} does not match ${bookId}`);
  requireCondition(packet.chapterNumber === sidecar.chapterNumber, `${args.packetPath}: packet/sidecar chapter number mismatch`);
  requireCondition(packet.chapterTitle === sidecar.chapterTitle, `${args.packetPath}: packet/sidecar title mismatch`);
  requireCondition(packet.chapterId === `${bookId}-ch${String(packet.chapterNumber).padStart(2, "0")}`, `${args.packetPath}: noncanonical chapterId`);

  const integrity = evaluateSourceV2Integrity(sidecar, {
    chapterNumber: packet.chapterNumber,
    chapterTitle: packet.chapterTitle,
    rawText: args.sidecarBytes.toString("utf8"),
  });
  const sourceBlockers = integrity.findings.filter((finding) => finding.severity === "blocker");
  requireCondition(integrity.passed && sourceBlockers.length === 0,
    `${args.sidecarPath}: source-v2 blockers: ${sourceBlockers.map((finding) => finding.checkId).join(", ")}`);

  const packetBlockers = validateSourcePacket(packet).filter((finding) => finding.severity === "blocker");
  requireCondition(packetBlockers.length === 0,
    `${args.packetPath}: source-packet blockers: ${packetBlockers.map((finding) => finding.checkId).join(", ")}`);
  const sidecarSha256 = semanticSourceHash(sidecar);
  requireCondition(packet.sourceHash === sidecarSha256, `${args.packetPath}: packet sourceHash is stale against exact sidecar`);
  const anchors = buildSourceAnchorCatalog(sidecar);
  requireCondition(hashCanonical(packet.allowedAnchors) === hashCanonical(anchors), `${args.packetPath}: packet anchors drift from exact sidecar`);

  // sourceSidecarPath is provenance metadata, not source truth. Historical pilot
  // packets contain machine-specific /Users paths, so the experiment packet uses
  // a stable relative path while the exact archived packet bytes stay hash-frozen.
  const portablePacket: SourcePacketV1 = {
    ...packet,
    sourceSidecarPath: `source-archive/${bookId}/${args.sourceArchiveId}/${basename(args.sidecarPath)}`,
  };
  const portablePacketBytes = Buffer.from(stableJson(portablePacket));
  const compiled = compileSourceUsePlan(portablePacket);
  requireCondition(validateSourceUsePlan(compiled.plan).length === 0, `${args.packetPath}: compiled source-use plan is invalid`);
  requireCondition(compiled.plan.sourcePacketSha256 === sourcePacketHash(portablePacket), `${args.packetPath}: compiled plan is stale at creation`);
  const packetRel = `${bookId}/${args.sourceArchiveId}/${basename(args.packetPath)}`;
  const sidecarRel = `${bookId}/${args.sourceArchiveId}/${basename(args.sidecarPath)}`;
  return {
    spec: { chapterId: packet.chapterId, chapterNumber: packet.chapterNumber, chapterTitle: packet.chapterTitle },
    packet: portablePacket,
    packetBytes: portablePacketBytes.toString("utf8"),
    plan: compiled.plan,
    sidecar,
    sidecarBytes: args.sidecarBytes.toString("utf8"),
    anchors,
    features: deriveForwardChapterFeatures(portablePacket, sidecar),
    hashes: {
      packetArchiveBytesSha256: sha256Hex(args.packetBytes),
      packetBytesSha256: sha256Hex(portablePacketBytes),
      sourcePacketSha256: sourcePacketHash(portablePacket),
      sourceUsePlanSha256: sourceUsePlanHash(compiled.plan),
      sidecarBytesSha256: sha256Hex(args.sidecarBytes),
      sidecarSha256,
      anchorCatalogSha256: hashCanonical(anchors),
    },
    sourceFiles: [
      { root: "packet-archive", relativePath: packetRel, bytesSha256: sha256Hex(args.packetBytes) },
      { root: "source-archive", relativePath: sidecarRel, bytesSha256: sha256Hex(args.sidecarBytes) },
    ],
  };
}

function finalizeBookInput(input: Omit<ForwardBookInputV1, "bookInputSha256">): ForwardBookInputV1 {
  const frozen = {
    schema: input.schema,
    bookId: input.bookId,
    sourceArchiveId: input.sourceArchiveId,
    titleProjection: input.titleProjection,
    titleProjectionSha256: input.titleProjectionSha256,
    packageBytesSha256: input.packageBytesSha256,
    sourceComplete: input.sourceComplete,
    representativeTags: input.representativeTags,
    chapters: input.chapters.map((chapter) => ({
      spec: chapter.spec,
      features: chapter.features,
      hashes: chapter.hashes,
    })),
    sourceFiles: input.sourceFiles,
  };
  return { ...input, bookInputSha256: hashCanonical(frozen) };
}

export function inventoryPilotBookInput(args: PilotBookInventoryArgs): ForwardBookInputV1 {
  const bookId = normSlug(args.bookId);
  const files = packetFiles(args.packetDir);
  requireCondition(files.length >= 4, `${bookId}: pilot source inventory needs at least four chapters`);
  const chapters: ForwardChapterInputV1[] = files.map((file) => {
    const packetPath = resolve(args.packetDir, file);
    const packetRead = readJson<SourcePacketV1>(packetPath);
    const n = packetRead.value.chapterNumber;
    const sourcePath = sidecarPath(args.sidecarDir, n);
    const sidecarRead = readJson<SourceSidecarV2>(sourcePath);
    return validateChapterInput({
      bookId,
      packet: packetRead.value,
      packetBytes: packetRead.bytes,
      sidecar: sidecarRead.value,
      sidecarBytes: sidecarRead.bytes,
      packetPath,
      sidecarPath: sourcePath,
      sourceArchiveId: args.sourceArchiveId,
    });
  }).sort((a, b) => a.spec.chapterNumber - b.spec.chapterNumber);
  requireCondition(new Set(chapters.map((chapter) => chapter.spec.chapterNumber)).size === chapters.length, `${bookId}: duplicate chapter number`);
  const titleProjection = {
    bookId,
    title: args.bookTitle ?? bookId,
    author: args.author ?? "",
    categories: [] as string[],
    tags: sortedUnique(args.representativeTags ?? []),
    chapters: chapters.map((chapter) => chapter.spec),
  };
  const sourceFiles = chapters.flatMap((chapter) => chapter.sourceFiles);
  return finalizeBookInput({
    schema: FORWARD_BOOK_INPUT_SCHEMA,
    bookId,
    sourceArchiveId: args.sourceArchiveId,
    titleProjection,
    titleProjectionSha256: hashCanonical(titleProjection),
    packageBytesSha256: null,
    chapters,
    sourceComplete: true,
    representativeTags: sortedUnique(args.representativeTags ?? ["researched", "conceptual", "applied"]),
    sourceFiles,
  });
}

function scoreOrder(stratum: ForwardChapterStratum, a: ForwardChapterInputV1, b: ForwardChapterInputV1): number {
  return b.features.stratumScores[stratum] - a.features.stratumScores[stratum]
    || a.spec.chapterNumber - b.spec.chapterNumber
    || a.spec.chapterId.localeCompare(b.spec.chapterId);
}

function riskSignals(chapter: ForwardChapterInputV1, stratum: ForwardChapterStratum): ForwardRiskSignal[] {
  const risks: ForwardRiskSignal[] = [];
  const f = chapter.features;
  if (f.factCount < 9 || f.hardSpecificCount < 4) risks.push("sparse-source-detail");
  if (f.realWorldCaseCount >= 3) risks.push("several-source-bound-named-claims");
  if (f.nonRobustFactCount > 0) risks.push("disputed-or-conflicting-evidence");
  if (stratum === "causal-quiz-sensitive" && f.causalMarkerCount > 0) risks.push("causal-teaching-claims");
  if (f.groundedEntityCount >= 12) risks.push("difficult-attribution");
  if (stratum === "causal-quiz-sensitive" || f.mechanismFactCount >= 9) risks.push("difficult-quiz-design");
  if (f.bookWideDuplicateCount > 0) risks.push("cross-chapter-dependency");
  return [...new Set(risks)].sort() as ForwardRiskSignal[];
}

function coordinateFor(book: ForwardBookInputV1, chapter: ForwardChapterInputV1, stratum: ForwardChapterStratum): ForwardSourceCoordinateV1 {
  return {
    bookId: book.bookId,
    chapterNumber: chapter.spec.chapterNumber,
    chapterId: chapter.spec.chapterId,
    stratum,
    sourceComplete: true,
    evidenceFresh: true,
    sourceUsePlanSha256: chapter.hashes.sourceUsePlanSha256,
    sourcePacketSha256: chapter.hashes.sourcePacketSha256,
    sidecarSha256: chapter.hashes.sidecarSha256,
    anchorCatalogSha256: chapter.hashes.anchorCatalogSha256,
    sourceArchiveId: book.sourceArchiveId,
    riskSignals: riskSignals(chapter, stratum),
  };
}

/** Selects one distinct chapter per frozen stratum from each of exactly two books. */
export function selectPilotInputs(books: readonly ForwardBookInputV1[]): ForwardBookSelectionCandidateV1[] {
  requireCondition(books.length === 2, "pilot selection requires exactly two source-complete books");
  const sorted = [...books].sort((a, b) => a.bookId.localeCompare(b.bookId));
  requireCondition(sorted[0].bookId !== sorted[1].bookId, "pilot books must be distinct");
  return sorted.map((book) => {
    requireCondition(book.sourceComplete, `${book.bookId}: source inventory is incomplete`);
    const used = new Set<number>();
    const selected: ForwardSourceCoordinateV1[] = [];
    for (const stratum of FORWARD_CHAPTER_STRATA) {
      const chapter = [...book.chapters]
        .filter((candidate) => !used.has(candidate.spec.chapterNumber))
        .sort((a, b) => scoreOrder(stratum, a, b))[0];
      requireCondition(!!chapter, `${book.bookId}: cannot select a distinct ${stratum} chapter`);
      used.add(chapter.spec.chapterNumber);
      selected.push(coordinateFor(book, chapter, stratum));
    }
    return {
      bookId: book.bookId,
      sourceComplete: true,
      representativeTags: [...book.representativeTags],
      chapters: selected.sort((a, b) => a.chapterNumber - b.chapterNumber),
    };
  });
}

type HistoricalBookPackage = {
  schemaVersion?: unknown;
  book?: { bookId?: unknown; title?: unknown; author?: unknown; categories?: unknown; tags?: unknown };
  chapters?: Array<{ chapterId?: unknown; number?: unknown; title?: unknown; [key: string]: unknown }>;
};

export type GoldBookInventoryArgs = {
  bookId: string;
  packagePath: string;
  sidecarDir: string;
  sourceArchiveId: string;
};

export type GoldInputEligibilityV1 = {
  status: "ELIGIBLE_FULL_BOOK" | "INELIGIBLE";
  eligibleForImp22: boolean;
  ineligibilityReasons: string[];
  currentCampaignHarnessCompatible: boolean;
  harnessCompatibilityReasons: string[];
  book: ForwardBookInputV1 | null;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

/**
 * Reconstructs packets/plans solely from package metadata+titles and archived
 * source-v2 sidecars. Prior hook/breakdown/example/quiz prose is never projected
 * into the returned value.
 */
export function inventoryGoldBookInput(args: GoldBookInventoryArgs): GoldInputEligibilityV1 {
  const reasons: string[] = [];
  let packageRead: { value: HistoricalBookPackage; bytes: Buffer };
  try {
    packageRead = readJson<HistoricalBookPackage>(args.packagePath);
  } catch (error) {
    return {
      status: "INELIGIBLE",
      eligibleForImp22: false,
      ineligibilityReasons: [(error as Error).message],
      currentCampaignHarnessCompatible: false,
      harnessCompatibilityReasons: ["package could not be inventoried"],
      book: null,
    };
  }
  const bookId = normSlug(args.bookId);
  const pkg = packageRead.value;
  if (normSlug(String(pkg.book?.bookId ?? "")) !== bookId) reasons.push("PACKAGE_BOOK_ID_MISMATCH");
  if (!Array.isArray(pkg.chapters) || pkg.chapters.length < 8) reasons.push("CHAPTER_COUNT_BELOW_EIGHT");
  const projected: ChapterSpec[] = [];
  for (const [index, chapter] of (pkg.chapters ?? []).entries()) {
    const n = chapter.number;
    const title = chapter.title;
    const chapterId = chapter.chapterId;
    if (!Number.isInteger(n) || (n as number) !== index + 1) reasons.push(`NONCONTIGUOUS_CHAPTER_${index + 1}`);
    if (typeof title !== "string" || title.trim().length === 0) reasons.push(`MISSING_TITLE_${index + 1}`);
    const expectedId = `${bookId}-ch${String(index + 1).padStart(2, "0")}`;
    if (chapterId !== expectedId) reasons.push(`CHAPTER_ID_MISMATCH_${index + 1}`);
    if (Number.isInteger(n) && typeof title === "string" && typeof chapterId === "string") {
      projected.push({ chapterId, chapterNumber: n as number, chapterTitle: title });
    }
  }
  if (new Set(projected.map((chapter) => chapter.chapterId)).size !== projected.length) reasons.push("DUPLICATE_CHAPTER_ID");

  const compiled: ForwardChapterInputV1[] = [];
  const rawParts: Array<{ spec: ChapterSpec; sidecar: SourceSidecarV2; sidecarBytes: Buffer; sidecarPath: string }> = [];
  if (reasons.length === 0) {
    for (const spec of projected) {
      const path = sidecarPath(args.sidecarDir, spec.chapterNumber);
      try {
        const read = readJson<SourceSidecarV2>(path);
        if (read.value.chapterNumber !== spec.chapterNumber || read.value.chapterTitle !== spec.chapterTitle) {
          reasons.push(`SIDECAR_IDENTITY_MISMATCH_CH${String(spec.chapterNumber).padStart(2, "0")}`);
          continue;
        }
        const integrity = evaluateSourceV2Integrity(read.value, {
          chapterNumber: spec.chapterNumber,
          chapterTitle: spec.chapterTitle,
          rawText: read.bytes.toString("utf8"),
        });
        if (!integrity.passed) reasons.push(`SIDECAR_BLOCKED_CH${String(spec.chapterNumber).padStart(2, "0")}`);
        rawParts.push({ spec, sidecar: read.value, sidecarBytes: read.bytes, sidecarPath: path });
      } catch {
        reasons.push(`MISSING_OR_UNREADABLE_SIDECAR_CH${String(spec.chapterNumber).padStart(2, "0")}`);
      }
    }
  }
  const expectedNames = new Set(projected.map((chapter) => chapterFileStem(chapter.chapterNumber, "source.json")));
  if (existsSync(args.sidecarDir)) {
    const extras = readdirSync(args.sidecarDir).filter((name) => /^ch\d{2,3}\.source\.json$/.test(name) && !expectedNames.has(name));
    if (extras.length > 0) reasons.push(`UNINDEXED_SIDECARS:${extras.sort().join(",")}`);
  }
  if (reasons.length === 0) {
    const packets = rawParts.map((part) => compileSourcePacketFromSidecar({
      bookId,
      chapter: part.spec,
      sidecar: part.sidecar,
      sidecarPath: `source-archive/${bookId}/${args.sourceArchiveId}/${basename(part.sidecarPath)}`,
      sourceHash: semanticSourceHash(part.sidecar),
    }));
    tagBookWideDuplicateFacts(packets);
    packets.forEach(applyTeachingRanking);
    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      const part = rawParts[i];
      const packetBytes = Buffer.from(stableJson(packet));
      try {
        compiled.push(validateChapterInput({
          bookId,
          packet,
          packetBytes,
          sidecar: part.sidecar,
          sidecarBytes: part.sidecarBytes,
          packetPath: `compiled://${bookId}/${chapterFileStem(packet.chapterNumber, "source-packet.json")}`,
          sidecarPath: part.sidecarPath,
          sourceArchiveId: args.sourceArchiveId,
        }));
      } catch (error) {
        reasons.push(`COMPILED_INPUT_BLOCKED_CH${String(packet.chapterNumber).padStart(2, "0")}:${(error as Error).message}`);
      }
    }
  }
  if (reasons.length > 0) {
    return {
      status: "INELIGIBLE",
      eligibleForImp22: false,
      ineligibilityReasons: reasons.sort(),
      currentCampaignHarnessCompatible: false,
      harnessCompatibilityReasons: ["input is not source-complete"],
      book: null,
    };
  }

  const titleProjection = {
    bookId,
    title: String(pkg.book?.title ?? ""),
    author: String(pkg.book?.author ?? ""),
    categories: stringArray(pkg.book?.categories),
    tags: stringArray(pkg.book?.tags),
    chapters: projected,
  };
  const packageFile: FrozenForwardInputFileV1 = {
    root: "package-archive",
    relativePath: `${bookId}/${basename(args.packagePath)}`,
    bytesSha256: sha256Hex(packageRead.bytes),
  };
  const sidecarFiles: FrozenForwardInputFileV1[] = rawParts.map((part) => ({
    root: "source-archive",
    relativePath: `${bookId}/${args.sourceArchiveId}/${basename(part.sidecarPath)}`,
    bytesSha256: sha256Hex(part.sidecarBytes),
  }));
  const book = finalizeBookInput({
    schema: FORWARD_BOOK_INPUT_SCHEMA,
    bookId,
    sourceArchiveId: args.sourceArchiveId,
    titleProjection,
    titleProjectionSha256: hashCanonical(titleProjection),
    packageBytesSha256: sha256Hex(packageRead.bytes),
    chapters: compiled,
    sourceComplete: true,
    representativeTags: sortedUnique([...titleProjection.categories, ...titleProjection.tags]),
    sourceFiles: [packageFile, ...sidecarFiles],
  });
  return {
    status: "ELIGIBLE_FULL_BOOK",
    eligibleForImp22: true,
    ineligibilityReasons: [],
    currentCampaignHarnessCompatible: true,
    harnessCompatibilityReasons: [],
    book,
  };
}

export type FrozenFullBookGoldSelectionV1 = {
  candidate: ForwardBookSelectionCandidateV1;
  stratumAssignmentSha256: string;
};

/**
 * Assign every chapter of one gold book exactly once. Quotas differ by at most
 * one; within each quota the strongest remaining feature score wins, with
 * chapter number then chapterId as the frozen tie-break. This is classification,
 * never truncation: a 13-chapter book returns 13 coordinates.
 */
export function buildFullBookGoldSelection(book: ForwardBookInputV1): FrozenFullBookGoldSelectionV1 {
  requireCondition(book.sourceComplete, `${book.bookId}: gold source inventory is incomplete`);
  requireCondition(book.chapters.length >= 8, `${book.bookId}: gold book requires at least eight chapters`);
  const baseQuota = Math.floor(book.chapters.length / FORWARD_CHAPTER_STRATA.length);
  const extras = book.chapters.length % FORWARD_CHAPTER_STRATA.length;
  const unassigned = new Map(book.chapters.map((chapter) => [chapter.spec.chapterNumber, chapter]));
  const coordinates: ForwardSourceCoordinateV1[] = [];
  FORWARD_CHAPTER_STRATA.forEach((stratum, stratumIndex) => {
    const quota = baseQuota + (stratumIndex < extras ? 1 : 0);
    const picked = [...unassigned.values()].sort((a, b) => scoreOrder(stratum, a, b)).slice(0, quota);
    requireCondition(picked.length === quota, `${book.bookId}: gold stratum assignment silently shrank at ${stratum}`);
    for (const chapter of picked) {
      unassigned.delete(chapter.spec.chapterNumber);
      coordinates.push(coordinateFor(book, chapter, stratum));
    }
  });
  requireCondition(unassigned.size === 0, `${book.bookId}: gold stratum assignment omitted ${unassigned.size} chapter(s)`);
  const candidate: ForwardBookSelectionCandidateV1 = {
    bookId: book.bookId,
    sourceComplete: true,
    representativeTags: [...book.representativeTags],
    chapters: coordinates.sort((a, b) => a.chapterNumber - b.chapterNumber),
  };
  const assignment = candidate.chapters.map((chapter) => ({
    bookId: chapter.bookId,
    chapterNumber: chapter.chapterNumber,
    chapterId: chapter.chapterId,
    stratum: chapter.stratum,
    sourcePacketSha256: chapter.sourcePacketSha256,
    sourceUsePlanSha256: chapter.sourceUsePlanSha256,
    sidecarSha256: chapter.sidecarSha256,
    anchorCatalogSha256: chapter.anchorCatalogSha256,
  }));
  return { candidate, stratumAssignmentSha256: hashCanonical(assignment) };
}

export type ForwardInputBookSetsV1 = {
  qualificationBookIds: string[];
  pilotBookIds: string[];
  goldBookIds: string[];
};

export function assertForwardBookSetDisjoint(sets: ForwardInputBookSetsV1): void {
  const groups = {
    qualification: sortedUnique(sets.qualificationBookIds),
    pilot: sortedUnique(sets.pilotBookIds),
    gold: sortedUnique(sets.goldBookIds),
  };
  for (const [leftName, left] of Object.entries(groups)) {
    for (const [rightName, right] of Object.entries(groups)) {
      if (leftName >= rightName) continue;
      const overlap = left.filter((bookId) => right.includes(bookId));
      requireCondition(overlap.length === 0, `${leftName}/${rightName} book overlap: ${overlap.join(", ")}`);
    }
  }
}

export type CrossBookFallbackV1 = {
  kind: "cross-book-equivalent";
  targetCount: 10 | 11 | 12;
  chapters: ForwardSourceCoordinateV1[];
  bookIds: string[];
  selectionSha256: string;
};

/** Deterministic, explicitly cross-book fallback. It is never a truncated full book. */
export function selectDeterministicCrossBookFallback(args: {
  candidates: readonly ForwardBookInputV1[];
  excludedBookIds: readonly string[];
  targetCount?: 10 | 11 | 12;
}): CrossBookFallbackV1 {
  const targetCount = args.targetCount ?? 12;
  const excluded = new Set(sortedUnique(args.excludedBookIds));
  const books = [...args.candidates]
    .filter((book) => book.sourceComplete && !excluded.has(book.bookId))
    .sort((a, b) => a.bookId.localeCompare(b.bookId));
  requireCondition(books.length >= 2, "cross-book fallback requires at least two unused source-complete books");
  const selected: ForwardSourceCoordinateV1[] = [];
  const used = new Set<string>();
  const countByBook = new Map<string, number>();
  for (let i = 0; i < targetCount; i++) {
    const stratum = FORWARD_CHAPTER_STRATA[i % FORWARD_CHAPTER_STRATA.length];
    const available = books.flatMap((book) => book.chapters.map((chapter) => ({ book, chapter })))
      .filter(({ book, chapter }) => !used.has(`${book.bookId}/${chapter.spec.chapterNumber}`))
      .sort((a, b) => (countByBook.get(a.book.bookId) ?? 0) - (countByBook.get(b.book.bookId) ?? 0)
        || scoreOrder(stratum, a.chapter, b.chapter)
        || a.book.bookId.localeCompare(b.book.bookId));
    const chosen = available[0];
    requireCondition(!!chosen, `cross-book fallback silently shrank at ${i}/${targetCount}`);
    used.add(`${chosen.book.bookId}/${chosen.chapter.spec.chapterNumber}`);
    countByBook.set(chosen.book.bookId, (countByBook.get(chosen.book.bookId) ?? 0) + 1);
    selected.push(coordinateFor(chosen.book, chosen.chapter, stratum));
  }
  const bookIds = sortedUnique(selected.map((chapter) => chapter.bookId));
  requireCondition(bookIds.length >= 2, "fallback selection is not cross-book");
  const frozen = { kind: "cross-book-equivalent" as const, targetCount, chapters: selected, bookIds };
  return { ...frozen, selectionSha256: hashCanonical(frozen) };
}

function freshBookBrief(book: ForwardBookInputV1): BookBrief {
  const ideas = book.chapters.slice(0, 5).map((chapter) => ({
    name: chapter.sidecar.centralConcept.name,
    oneSentence: chapter.sidecar.centralConcept.plainDefinition,
    mentalMove: chapter.sidecar.centralConcept.whyItMatters || chapter.sidecar.testableFacts[0]?.becauseMechanism || "Apply the sourced distinction.",
    sourceAnchors: [chapter.sidecar.centralConcept.id, chapter.sidecar.testableFacts[0]?.id].filter((id): id is string => !!id),
  }));
  return {
    bookId: book.bookId,
    title: book.titleProjection.title,
    author: book.titleProjection.author,
    thesisParagraph: ideas.map((idea) => idea.oneSentence).join(" "),
    sourceAnchorIds: ideas.flatMap((idea) => idea.sourceAnchors),
    coreIdeas: ideas,
    targetReader: "A reader seeking an evidence-bound, practical understanding of the book's central distinctions.",
    voiceCharter: {
      register: "plainspoken",
      person: "second",
      cadence: "medium",
      signatureMoves: ["lead with a source-supported distinction", "turn concepts into observable choices", "state limitations plainly"],
      avoidMoves: ["do not invent historical detail", "do not imply guaranteed outcomes", "do not copy prior package prose"],
    },
    teachingArc: book.chapters.map((chapter) => `${chapter.spec.chapterNumber}. ${chapter.sidecar.centralConcept.name}`).join(" -> "),
    forbiddenMoves: ["No prior chapter prose as author input.", "No source-bound detail beyond the frozen packet and sidecar.", "No publish or promotion."],
  };
}

export type MaterializedForwardBookInputV1 = {
  stateRoot: string;
  bookId: string;
  inputSha256: string;
  bookBriefSha256: string;
  chapterBriefSha256: Record<string, string>;
  files: Array<{ relativePath: string; bytesSha256: string }>;
};

/**
 * Writes only inside an explicitly supplied experiment state root. The root must
 * not contain chapter prose; this prevents historical chapter files from becoming
 * an accidental brief/dealing dependency.
 */
export function materializeForwardBookInput(args: {
  book: ForwardBookInputV1;
  experimentStateRoot: string;
  frozenAtIso: string;
}): MaterializedForwardBookInputV1 {
  requireCondition(Number.isFinite(Date.parse(args.frozenAtIso)), "frozenAtIso must be an ISO timestamp");
  const stateRoot = resolve(args.experimentStateRoot);
  const chaptersDir = resolve(stateRoot, "chapters");
  const priorChapterFiles = existsSync(chaptersDir)
    ? readdirSync(chaptersDir).filter((name) => name.endsWith(".chapter.json"))
    : [];
  requireCondition(priorChapterFiles.length === 0, `experiment root contains prior chapter prose: ${priorChapterFiles.join(", ")}`);
  const roots: CompilerStoreRoots = { stateRoot };
  const bookId = args.book.bookId;
  const runRecord: CompilerRunRecord = {
    schemaVersion: V23_COMPILER_SCHEMA_VERSION,
    bookId,
    runId: FORWARD_EXPERIMENT_COMPILER_RUN_ID,
    createdAt: args.frozenAtIso,
    architecture: "compiler",
    finalChapterSchema: "chapterflow-v21-authored",
  };
  const written: string[] = [];
  const record = (path: string, text: string): void => {
    writeFileAtomic(path, text);
    written.push(path);
  };
  record(resolve(stateRoot, "indexes", `${bookId}.json`), stableJson(args.book.titleProjection.chapters));
  record(resolve(stateRoot, "books", bookId, "current-run.json"), stableJson(runRecord));
  for (const chapter of args.book.chapters) {
    record(sourcePacketPath(bookId, chapter.spec.chapterNumber, roots), chapter.packetBytes);
    record(sourceUsePlanPath(bookId, chapter.spec.chapterNumber, roots), stableJson(chapter.plan));
    record(resolve(stateRoot, "source-archive", bookId, chapterFileStem(chapter.spec.chapterNumber, "source.json")),
      chapter.sidecarBytes);
    record(resolve(stateRoot, "source-archive", bookId, chapterFileStem(chapter.spec.chapterNumber, "anchors.json")), stableJson(chapter.anchors));
  }
  const bookBrief = freshBookBrief(args.book);
  record(resolve(stateRoot, "briefs", `${bookId}.manual-brief.json`), stableJson(bookBrief));
  const briefResult = compileChapterBriefs(bookId, { roots });
  requireCondition(briefResult.findings.length === 0, `${bookId}: fresh chapter brief compilation failed: ${briefResult.findings.join("; ")}`);
  requireCondition(briefResult.briefs.length === args.book.chapters.length, `${bookId}: fresh brief compilation silently shrank`);
  const chapterBriefSha256: Record<string, string> = {};
  for (const brief of briefResult.briefs) {
    const json = stableJson(brief);
    record(chapterBriefPath(bookId, brief.chapterNumber, roots), json);
    record(chapterBriefMdPath(bookId, brief.chapterNumber, roots), `${renderBriefMd(brief)}\n`);
    chapterBriefSha256[brief.chapterId] = hashCanonical(brief);
  }
  const manifest = {
    schema: "forward-materialized-book-input-v1",
    selectionPolicy: FORWARD_INPUT_SELECTION_POLICY,
    frozenAtIso: args.frozenAtIso,
    bookId,
    sourceInputSha256: args.book.bookInputSha256,
    titleProjectionSha256: args.book.titleProjectionSha256,
    packageBytesSha256: args.book.packageBytesSha256,
    bookBriefSha256: hashCanonical(bookBrief),
    chapterBriefSha256,
    chapters: args.book.chapters.map((chapter) => ({ spec: chapter.spec, hashes: chapter.hashes })),
    capabilities: { publish: false, promote: false, deploy: false, upload: false },
    priorChapterProseUsed: false,
  };
  record(resolve(stateRoot, "forward-input-manifest.json"), stableJson(manifest));
  const files = written.map((path) => ({
    relativePath: relative(stateRoot, path),
    bytesSha256: sha256Hex(readBytes(path)),
  })).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return {
    stateRoot,
    bookId,
    inputSha256: hashCanonical(manifest),
    bookBriefSha256: hashCanonical(bookBrief),
    chapterBriefSha256,
    files,
  };
}

export type ForwardInputFreezeV1 = {
  schema: typeof FORWARD_INPUT_FREEZE_SCHEMA;
  policyVersion: typeof FORWARD_INPUT_SELECTION_POLICY;
  frozenAtIso: string;
  sets: ForwardInputBookSetsV1;
  pilot: ForwardBookSelectionCandidateV1[];
  pilotInputHashes: Record<string, string>;
  gold: ForwardBookSelectionCandidateV1;
  goldInputHash: string;
  goldStratumAssignmentSha256: string;
  goldChapterCount: number;
  goldCampaignHarnessCompatible: boolean;
  sourceFiles: FrozenForwardInputFileV1[];
  freezeSha256: string;
};

export function freezeForwardInputs(args: {
  frozenAtIso: string;
  qualificationBookIds: string[];
  pilotBooks: readonly ForwardBookInputV1[];
  gold: GoldInputEligibilityV1;
}): ForwardInputFreezeV1 {
  requireCondition(args.gold.eligibleForImp22 && !!args.gold.book, `gold input is ineligible: ${args.gold.ineligibilityReasons.join("; ")}`);
  const pilot = selectPilotInputs(args.pilotBooks);
  const sets: ForwardInputBookSetsV1 = {
    qualificationBookIds: sortedUnique(args.qualificationBookIds),
    pilotBookIds: sortedUnique(args.pilotBooks.map((book) => book.bookId)),
    goldBookIds: [args.gold.book.bookId],
  };
  assertForwardBookSetDisjoint(sets);
  const goldSelection = buildFullBookGoldSelection(args.gold.book);
  const base = {
    schema: FORWARD_INPUT_FREEZE_SCHEMA,
    policyVersion: FORWARD_INPUT_SELECTION_POLICY,
    frozenAtIso: args.frozenAtIso,
    sets,
    pilot,
    pilotInputHashes: Object.fromEntries(args.pilotBooks.map((book) => [book.bookId, book.bookInputSha256]).sort(([a], [b]) => a.localeCompare(b))),
    gold: goldSelection.candidate,
    goldInputHash: args.gold.book.bookInputSha256,
    goldStratumAssignmentSha256: goldSelection.stratumAssignmentSha256,
    goldChapterCount: args.gold.book.chapters.length,
    goldCampaignHarnessCompatible: args.gold.currentCampaignHarnessCompatible,
    sourceFiles: [...args.pilotBooks.flatMap((book) => book.sourceFiles), ...args.gold.book.sourceFiles]
      .sort((a, b) => a.root.localeCompare(b.root) || a.relativePath.localeCompare(b.relativePath)),
  };
  return { ...base, freezeSha256: hashCanonical(base) };
}

export function verifyFrozenInputFiles(
  files: readonly FrozenForwardInputFileV1[],
  resolveFile: (file: FrozenForwardInputFileV1) => string,
): void {
  for (const file of files) {
    const path = resolveFile(file);
    const actual = sha256Hex(readBytes(path));
    requireCondition(actual === file.bytesSha256, `frozen input hash drift: ${file.root}/${file.relativePath}`);
  }
}

export function assertForwardInputFreezeFresh(freeze: ForwardInputFreezeV1): void {
  const { freezeSha256, ...base } = freeze;
  requireCondition(hashCanonical(base) === freezeSha256, "forward input freeze manifest hash drift");
  assertForwardBookSetDisjoint(freeze.sets);
  requireCondition(freeze.pilot.flatMap((book) => book.chapters).length === 8, "frozen pilot denominator is not eight");
  requireCondition(freeze.gold.chapters.length === freeze.goldChapterCount, "frozen gold denominator does not match its chapter inventory");
  requireCondition(new Set(freeze.gold.chapters.map((chapter) => chapter.chapterNumber)).size === freeze.goldChapterCount,
    "frozen gold assignment duplicates or omits a chapter number");
  const goldAssignment = freeze.gold.chapters.map((chapter) => ({
    bookId: chapter.bookId,
    chapterNumber: chapter.chapterNumber,
    chapterId: chapter.chapterId,
    stratum: chapter.stratum,
    sourcePacketSha256: chapter.sourcePacketSha256,
    sourceUsePlanSha256: chapter.sourceUsePlanSha256,
    sidecarSha256: chapter.sidecarSha256,
    anchorCatalogSha256: chapter.anchorCatalogSha256,
  }));
  requireCondition(hashCanonical(goldAssignment) === freeze.goldStratumAssignmentSha256, "frozen gold stratum assignment hash drift");
  for (const stratum of FORWARD_CHAPTER_STRATA) {
    requireCondition(freeze.pilot.flatMap((book) => book.chapters).filter((chapter) => chapter.stratum === stratum).length === 2,
      `frozen pilot does not contain exactly two ${stratum} chapters`);
  }
}
