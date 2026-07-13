/**
 * IMP-22 fresh-content validation campaign harness.
 *
 * This module deliberately does not implement another review system. It accepts
 * PreparedAuthorCandidate values from the existing deferred author path and
 * sends each one through forwardChapterConductor. Its responsibilities are the
 * campaign-level invariants the chapter conductor cannot own: frozen selection,
 * no-overlap, first-write denominators, bounded repair/regeneration, evidence
 * preservation, and pilot/gold acceptance accounting.
 *
 * There is no provider, publish, promotion, deployment, or upload capability in
 * this dependency surface. Live execution is supplied by a driver through the
 * narrow producer/input-builder/conductor seams exported below.
 */

import { existsSync } from "fs";
import { isAbsolute, relative, resolve } from "path";

import { sourcePacketHash } from "../compiler/sourcePacket.js";
import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { aggregateIsFresh } from "../contracts/aggregateChapterReview.js";
import { validateChapterPatch, type ChapterPatchV1 } from "../contracts/repairContracts.js";
import { sourceUsePlanHash } from "../contracts/sourceUsePlan.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { semanticSourceHash } from "../source/sourceIntegrity.js";
import type { ChapterV21 } from "../types.js";
import { REQUIRED_SWEEP_FAMILIES, type SweepRecord } from "../qc/sweep.js";
import type { AutopilotDeps } from "./autopilot.js";
import {
  authorWriteOneChapter,
  type AuthorIo,
  type AuthorWriteOneResult,
  type PreparedAuthorCandidate,
} from "./authorRun.js";
import { finalizeAttempt, unexpectedAttemptWrites } from "./chapterTransaction.js";
import { applyChapterPatch, nonScopeDrift } from "./repairPatch.js";
import {
  runForwardChapterConductor,
  type ForwardChapterConductorDeps,
  type ForwardChapterConductorInputV1,
  type ForwardChapterConductorResultV1,
  type ForwardReviewExecutionEntryV1,
} from "./forwardChapterConductor.js";

export const FORWARD_VALIDATION_MANIFEST_SCHEMA = "forward-validation-manifest-v1" as const;
export const FORWARD_VALIDATION_RESULT_SCHEMA = "forward-validation-campaign-result-v1" as const;
export const FORWARD_FIRST_WRITE_SNAPSHOT_SCHEMA = "forward-first-write-snapshot-v1" as const;
export const FORWARD_ATTEMPT_RECORD_SCHEMA = "forward-validation-attempt-record-v1" as const;
export const FORWARD_DESTINATION_PROOF_SCHEMA = "forward-experiment-destination-proof-v1" as const;
export const FORWARD_PERSISTENCE_RECEIPT_SCHEMA = "forward-persistence-receipt-v1" as const;
export const FORWARD_GOLD_EVIDENCE_SCHEMA = "forward-gold-evidence-v1" as const;
export const PILOT_EXPERIMENT_ID = "s16-forward-sol-pilot-v1" as const;
export const GOLD_EXPERIMENT_ID = "s16-forward-sol-gold-book-v1" as const;
export const PILOT_ENVELOPE_EXPERIMENT_ID = "s16-forward-sol-pilot-v2-envelope" as const;
export const GOLD_ENVELOPE_EXPERIMENT_ID = "s16-forward-sol-gold-book-v2-envelope" as const;
export type ForwardValidationIdentityFamily = "legacy-v1" | "imp24-v2-envelope";

export const FORWARD_CHAPTER_STRATA = [
  "research-heavy",
  "abstract-conceptual",
  "example-heavy",
  "causal-quiz-sensitive",
] as const;
export type ForwardChapterStratum = (typeof FORWARD_CHAPTER_STRATA)[number];

export const FORWARD_RISK_SIGNALS = [
  "sparse-source-detail",
  "several-source-bound-named-claims",
  "disputed-or-conflicting-evidence",
  "causal-teaching-claims",
  "difficult-attribution",
  "difficult-quiz-design",
  "cross-chapter-dependency",
  "prior-repeated-failure",
] as const;
export type ForwardRiskSignal = (typeof FORWARD_RISK_SIGNALS)[number];

export type ForwardWriterRouteV1 = {
  model: "gpt-5.6-sol";
  effort: "high" | "xhigh";
  reasons: ForwardRiskSignal[];
};

/** Literal false values are intentionally part of every frozen manifest. */
export const FORWARD_VALIDATION_CAPABILITIES = Object.freeze({
  publish: false,
  promote: false,
  deploy: false,
  upload: false,
} as const);

export const FORWARD_REPAIR_POLICY = Object.freeze({
  maxRepairAttemptsPerChapter: 1,
  maxRegenerationsPerChapter: 1,
  maxAuthoringCandidatesPerChapter: 2,
  maxInfrastructureReplaysPerAttempt: 1,
  regenerationAfterRepairOnlyFor: ["WRONG_ROUTE", "WHOLE_CHAPTER_FAILURE"] as const,
  maxSystemicCorrectionCycles: 2,
} as const);

export type ForwardSourceCoordinateV1 = {
  bookId: string;
  chapterNumber: number;
  chapterId: string;
  stratum: ForwardChapterStratum;
  sourceComplete: boolean;
  evidenceFresh: boolean;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  anchorCatalogSha256: string;
  sourceArchiveId: string;
  riskSignals: ForwardRiskSignal[];
};

export type ForwardBookSelectionCandidateV1 = {
  bookId: string;
  sourceComplete: boolean;
  representativeTags: string[];
  chapters: ForwardSourceCoordinateV1[];
};

export type ForwardValidationTargetV1 = ForwardSourceCoordinateV1 & {
  outputRunId: string;
  outputRelPath: string;
  writerRoute: ForwardWriterRouteV1;
};

type ForwardValidationManifestBaseV1 = {
  schema: typeof FORWARD_VALIDATION_MANIFEST_SCHEMA;
  experimentId: string;
  kind: "pilot" | "gold";
  frozenAtIso: string;
  roleAssignmentSha256: string;
  instrumentManifestSha256: string;
  thresholdsSha256: string;
  /** Exact byte hash of input-materialization.json. This closes the brief/index
   * freshness surface that packet/plan coordinate hashes alone cannot cover. */
  inputMaterializationSha256: string;
  productionInstrumentSealSha256: string;
  selectionPolicyVersion: "imp22-forward-selection-v1";
  qualificationBookIds: string[];
  targets: ForwardValidationTargetV1[];
  capabilities: typeof FORWARD_VALIDATION_CAPABILITIES;
  repairPolicy: typeof FORWARD_REPAIR_POLICY;
};

export type ForwardPilotManifestV1 = ForwardValidationManifestBaseV1 & {
  kind: "pilot";
  correctionCycle: 0 | 1 | 2;
  previousExperimentId: string | null;
  verifiedSystemicRootCause: VerifiedSystemicRootCauseV1 | null;
};

export type ForwardGoldManifestV1 = ForwardValidationManifestBaseV1 & {
  kind: "gold";
  pilotAccepted: true;
  pilotManifestSha256: string;
  pilotResultSha256: string;
  pilotBookIds: string[];
  goldEvaluatorInstrumentSha256: string;
};

export type ForwardValidationManifestV1 = ForwardPilotManifestV1 | ForwardGoldManifestV1;

export type FrozenForwardValidationManifestV1<T extends ForwardValidationManifestV1 = ForwardValidationManifestV1> = {
  manifest: Readonly<T>;
  manifestSha256: string;
};

export type VerifiedSystemicRootCauseV1 = {
  classification:
    | "PROMPT_OR_CONTRACT"
    | "SOURCE_PROJECTION"
    | "MODEL_ROUTING"
    | "REVIEW_INSTRUMENT"
    | "SCORER_OR_AGGREGATOR"
    | "STATE_OR_PROVENANCE";
  rootCauseId: string;
  severity: "P0" | "P1" | "P2";
  affectedChapterKeys: string[];
  regressionTestId: string;
};

export type BuildManifestCommon = {
  frozenAtIso: string;
  roleAssignmentSha256: string;
  instrumentManifestSha256: string;
  thresholdsSha256: string;
  inputMaterializationSha256: string;
  productionInstrumentSealSha256: string;
  qualificationBookIds: string[];
};

export type BuildPilotManifestInput = BuildManifestCommon & {
  books: ForwardBookSelectionCandidateV1[];
  goldReservedBookIds?: string[];
  correctionCycle?: 0 | 1 | 2;
  priorPilotExperimentIds?: string[];
  priorOutputRunIds?: string[];
  /** Corrected pilots must carry the same threshold hash as their predecessor. */
  priorThresholdsSha256?: string;
  verifiedSystemicRootCause?: VerifiedSystemicRootCauseV1 | null;
  /** Omitted preserves the retained IMP-22 identity. IMP-24 always supplies the
   * new envelope family and therefore cannot overwrite old pilot evidence. */
  identityFamily?: ForwardValidationIdentityFamily;
};

export type BuildGoldManifestInput = BuildManifestCommon & {
  books: ForwardBookSelectionCandidateV1[];
  pilotBookIds: string[];
  pilotAccepted: true;
  pilotManifestSha256: string;
  pilotResultSha256: string;
  goldEvaluatorInstrumentSha256: string;
  identityFamily?: ForwardValidationIdentityFamily;
};

export class ForwardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardValidationError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardValidationError(message);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertHash(label: string, value: string): void {
  requireCondition(nonEmpty(value), `${label} is required`);
}

function chapterKey(value: Pick<ForwardSourceCoordinateV1, "bookId" | "chapterNumber">): string {
  return `${value.bookId}/ch${String(value.chapterNumber).padStart(2, "0")}`;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as Readonly<T>;
}

function routeFor(riskSignals: readonly ForwardRiskSignal[]): ForwardWriterRouteV1 {
  const reasons = [...new Set(riskSignals)].sort() as ForwardRiskSignal[];
  return { model: "gpt-5.6-sol", effort: reasons.length > 0 ? "xhigh" : "high", reasons };
}

function validateCoordinate(coordinate: ForwardSourceCoordinateV1): void {
  requireCondition(nonEmpty(coordinate.bookId), "selection coordinate has no bookId");
  requireCondition(Number.isInteger(coordinate.chapterNumber) && coordinate.chapterNumber > 0, `${coordinate.bookId}: invalid chapter number`);
  requireCondition(nonEmpty(coordinate.chapterId), `${chapterKey(coordinate)}: chapterId is required`);
  requireCondition(FORWARD_CHAPTER_STRATA.includes(coordinate.stratum), `${chapterKey(coordinate)}: invalid stratum`);
  requireCondition(coordinate.sourceComplete === true, `${chapterKey(coordinate)}: incomplete source evidence`);
  requireCondition(coordinate.evidenceFresh === true, `${chapterKey(coordinate)}: stale source evidence`);
  for (const field of ["sourceUsePlanSha256", "sourcePacketSha256", "sidecarSha256", "anchorCatalogSha256", "sourceArchiveId"] as const) {
    assertHash(`${chapterKey(coordinate)}.${field}`, coordinate[field]);
  }
  for (const risk of coordinate.riskSignals) requireCondition(FORWARD_RISK_SIGNALS.includes(risk), `${chapterKey(coordinate)}: unknown risk signal ${risk}`);
}

function targetFrom(coordinate: ForwardSourceCoordinateV1, experimentId: string): ForwardValidationTargetV1 {
  validateCoordinate(coordinate);
  const nn = String(coordinate.chapterNumber).padStart(2, "0");
  return {
    ...coordinate,
    riskSignals: [...coordinate.riskSignals],
    outputRunId: `${experimentId}--${coordinate.bookId}--ch${nn}`,
    outputRelPath: `state/migration-experiments/${experimentId}/candidates/${coordinate.bookId}/${coordinate.chapterId}.v21-native.chapter.json`,
    writerRoute: routeFor(coordinate.riskSignals),
  };
}

function assertSystemicRootCause(root: VerifiedSystemicRootCauseV1 | null | undefined): asserts root is VerifiedSystemicRootCauseV1 {
  requireCondition(!!root, "a corrected pilot requires one verified systemic root cause");
  requireCondition(nonEmpty(root.rootCauseId), "systemic root cause id is required");
  requireCondition(nonEmpty(root.regressionTestId), "systemic correction requires a regression test id");
  const affected = sortedUnique(root.affectedChapterKeys);
  requireCondition(root.severity === "P0" || root.severity === "P1" || affected.length >= 2,
    "systemic correction requires one P0/P1 architecture failure or the same root cause in at least two chapters");
}

export function pilotCorrectionExperimentId(
  cycle: 0 | 1 | 2,
  family: ForwardValidationIdentityFamily = "legacy-v1",
): string {
  const base = family === "imp24-v2-envelope" ? PILOT_ENVELOPE_EXPERIMENT_ID : PILOT_EXPERIMENT_ID;
  return cycle === 0 ? base : `${base}-correction-${cycle}`;
}

/** Refuses a third development correction and requires a verified systemic cause. */
export function nextPilotCorrectionExperimentId(
  previousExperimentIds: readonly string[],
  rootCause: VerifiedSystemicRootCauseV1,
  family: ForwardValidationIdentityFamily = "legacy-v1",
): string {
  assertSystemicRootCause(rootCause);
  const expected = [
    pilotCorrectionExperimentId(0, family),
    pilotCorrectionExperimentId(1, family),
    pilotCorrectionExperimentId(2, family),
  ];
  requireCondition(previousExperimentIds.length > 0, "cannot correct a pilot that has not run");
  requireCondition(previousExperimentIds.length <= 2, "the two systemic correction cycles are exhausted");
  previousExperimentIds.forEach((id, i) => requireCondition(id === expected[i], `pilot correction history is not contiguous at ${id}`));
  return expected[previousExperimentIds.length];
}

function freezeManifest<T extends ForwardValidationManifestV1>(manifest: T): FrozenForwardValidationManifestV1<T> {
  const copy = JSON.parse(JSON.stringify(manifest)) as T;
  const manifestSha256 = hashCanonical(copy);
  return { manifest: deepFreeze(copy), manifestSha256 };
}

function commonManifest(input: BuildManifestCommon): Pick<ForwardValidationManifestBaseV1,
  "schema" | "frozenAtIso" | "roleAssignmentSha256" | "instrumentManifestSha256" | "thresholdsSha256" | "inputMaterializationSha256" | "productionInstrumentSealSha256" |
  "selectionPolicyVersion" | "qualificationBookIds" | "capabilities" | "repairPolicy"> {
  requireCondition(!Number.isNaN(Date.parse(input.frozenAtIso)), "frozenAtIso must be an ISO timestamp");
  assertHash("roleAssignmentSha256", input.roleAssignmentSha256);
  assertHash("instrumentManifestSha256", input.instrumentManifestSha256);
  assertHash("thresholdsSha256", input.thresholdsSha256);
  assertHash("inputMaterializationSha256", input.inputMaterializationSha256);
  assertHash("productionInstrumentSealSha256", input.productionInstrumentSealSha256);
  return {
    schema: FORWARD_VALIDATION_MANIFEST_SCHEMA,
    frozenAtIso: input.frozenAtIso,
    roleAssignmentSha256: input.roleAssignmentSha256,
    instrumentManifestSha256: input.instrumentManifestSha256,
    thresholdsSha256: input.thresholdsSha256,
    inputMaterializationSha256: input.inputMaterializationSha256,
    productionInstrumentSealSha256: input.productionInstrumentSealSha256,
    selectionPolicyVersion: "imp22-forward-selection-v1",
    qualificationBookIds: sortedUnique(input.qualificationBookIds),
    capabilities: FORWARD_VALIDATION_CAPABILITIES,
    repairPolicy: FORWARD_REPAIR_POLICY,
  };
}

function eligibleBook(book: ForwardBookSelectionCandidateV1, excluded: Set<string>): boolean {
  if (!book.sourceComplete || excluded.has(book.bookId)) return false;
  if (!nonEmpty(book.bookId)) return false;
  const seen = new Set<string>();
  for (const coordinate of book.chapters) {
    if (coordinate.bookId !== book.bookId) return false;
    try { validateCoordinate(coordinate); } catch { return false; }
    const key = chapterKey(coordinate);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** Deterministically selects the lexicographically first eligible book pair
 * capable of contributing exactly one chapter per stratum per book. */
export function buildPilotManifest(input: BuildPilotManifestInput): FrozenForwardValidationManifestV1<ForwardPilotManifestV1> {
  const cycle = input.correctionCycle ?? 0;
  const identityFamily = input.identityFamily ?? "legacy-v1";
  requireCondition(cycle >= 0 && cycle <= 2, "pilot correction cycle must be 0, 1, or 2");
  if (cycle > 0) {
    assertSystemicRootCause(input.verifiedSystemicRootCause);
    const prior = input.priorPilotExperimentIds ?? [];
    const next = nextPilotCorrectionExperimentId(prior, input.verifiedSystemicRootCause, identityFamily);
    requireCondition(next === pilotCorrectionExperimentId(cycle, identityFamily), `correction cycle ${cycle} does not follow the supplied history`);
    requireCondition(nonEmpty(input.priorThresholdsSha256) && input.priorThresholdsSha256 === input.thresholdsSha256,
      "corrected pilot must retain the prior frozen thresholds hash");
  } else {
    requireCondition(!input.verifiedSystemicRootCause, "base pilot cannot carry a correction root cause");
  }
  const experimentId = pilotCorrectionExperimentId(cycle, identityFamily);
  const excluded = new Set([...input.qualificationBookIds, ...(input.goldReservedBookIds ?? [])]);
  const books = input.books.filter((book) => eligibleBook(book, excluded)).sort((a, b) => a.bookId.localeCompare(b.bookId));
  let selected: ForwardBookSelectionCandidateV1[] | null = null;
  for (let i = 0; i < books.length && !selected; i++) {
    for (let j = i + 1; j < books.length && !selected; j++) {
      const pair = [books[i], books[j]];
      const capable = FORWARD_CHAPTER_STRATA.every((stratum) => pair.every((book) => book.chapters.some((c) => c.stratum === stratum)));
      if (capable) selected = pair;
    }
  }
  requireCondition(selected !== null, "pilot selection requires two unused evidence-complete books with one chapter in every frozen stratum");
  const targets: ForwardValidationTargetV1[] = [];
  for (const stratum of FORWARD_CHAPTER_STRATA) {
    for (const book of selected) {
      const coordinate = book.chapters
        .filter((chapter) => chapter.stratum === stratum)
        .sort((a, b) => a.chapterNumber - b.chapterNumber)[0];
      requireCondition(!!coordinate, `${book.bookId}: no ${stratum} chapter`);
      targets.push(targetFrom(coordinate, experimentId));
    }
  }
  const priorRuns = new Set(input.priorOutputRunIds ?? []);
  requireCondition(targets.every((target) => !priorRuns.has(target.outputRunId)), "corrected pilot must use fresh output run ids");
  const manifest: ForwardPilotManifestV1 = {
    ...commonManifest(input),
    experimentId,
    kind: "pilot",
    targets,
    correctionCycle: cycle,
    previousExperimentId: cycle === 0 ? null : pilotCorrectionExperimentId((cycle - 1) as 0 | 1, identityFamily),
    verifiedSystemicRootCause: input.verifiedSystemicRootCause ?? null,
  };
  assertManifest(manifest);
  return freezeManifest(manifest);
}

/** IMP-24 identity-safe wrapper. It preserves the frozen selection and gates
 * while preventing new envelope results from landing under the V1 pilot id. */
export function buildPilotManifestV2Envelope(
  input: Omit<BuildPilotManifestInput, "identityFamily">,
): FrozenForwardValidationManifestV1<ForwardPilotManifestV1> {
  return buildPilotManifest({ ...input, identityFamily: "imp24-v2-envelope" });
}

/** Deterministically selects one unused evidence-complete full book with at
 * least eight chapters. IMP-22 prefers (but does not require) 8–12 chapters, so
 * that range is ranked first; a complete 13+ chapter book remains eligible and
 * must never be silently truncated or mislabeled as an 8–12 chapter book. */
export function buildGoldManifest(input: BuildGoldManifestInput): FrozenForwardValidationManifestV1<ForwardGoldManifestV1> {
  requireCondition(input.pilotAccepted === true, "gold validation cannot start before the frozen pilot passes");
  assertHash("pilotManifestSha256", input.pilotManifestSha256);
  assertHash("pilotResultSha256", input.pilotResultSha256);
  assertHash("goldEvaluatorInstrumentSha256", input.goldEvaluatorInstrumentSha256);
  const excluded = new Set([...input.qualificationBookIds, ...input.pilotBookIds]);
  const books = input.books
    .filter((book) => eligibleBook(book, excluded) && book.chapters.length >= 8)
    .sort((a, b) => {
      const preferredA = a.chapters.length >= 8 && a.chapters.length <= 12 ? 1 : 0;
      const preferredB = b.chapters.length >= 8 && b.chapters.length <= 12 ? 1 : 0;
      if (preferredA !== preferredB) return preferredB - preferredA;
      const strataA = new Set(a.chapters.map((c) => c.stratum)).size;
      const strataB = new Set(b.chapters.map((c) => c.stratum)).size;
      if (strataA !== strataB) return strataB - strataA;
      const tagsA = new Set(a.representativeTags).size;
      const tagsB = new Set(b.representativeTags).size;
      return tagsA !== tagsB ? tagsB - tagsA : a.bookId.localeCompare(b.bookId);
    });
  requireCondition(books.length > 0, "gold selection requires one unused evidence-complete full book with at least 8 chapters");
  const book = books[0];
  const experimentId = input.identityFamily === "imp24-v2-envelope"
    ? GOLD_ENVELOPE_EXPERIMENT_ID
    : GOLD_EXPERIMENT_ID;
  const targets = [...book.chapters]
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map((coordinate) => targetFrom(coordinate, experimentId));
  const manifest: ForwardGoldManifestV1 = {
    ...commonManifest(input),
    experimentId,
    kind: "gold",
    targets,
    pilotAccepted: true,
    pilotManifestSha256: input.pilotManifestSha256,
    pilotResultSha256: input.pilotResultSha256,
    pilotBookIds: sortedUnique(input.pilotBookIds),
    goldEvaluatorInstrumentSha256: input.goldEvaluatorInstrumentSha256,
  };
  assertManifest(manifest);
  return freezeManifest(manifest);
}

/** IMP-24 identity-safe full-book wrapper using the unchanged gold gates. */
export function buildGoldManifestV2Envelope(
  input: Omit<BuildGoldManifestInput, "identityFamily">,
): FrozenForwardValidationManifestV1<ForwardGoldManifestV1> {
  return buildGoldManifest({ ...input, identityFamily: "imp24-v2-envelope" });
}

export function assertManifest(manifest: ForwardValidationManifestV1): void {
  requireCondition(manifest.schema === FORWARD_VALIDATION_MANIFEST_SCHEMA, "wrong forward-validation manifest schema");
  requireCondition(manifest.capabilities.publish === false && manifest.capabilities.promote === false
    && manifest.capabilities.deploy === false && manifest.capabilities.upload === false,
  "validation manifest cannot carry publish/promote/deploy/upload authority");
  requireCondition(hashCanonical(manifest.repairPolicy) === hashCanonical(FORWARD_REPAIR_POLICY), "repair policy differs from the frozen IMP-22 limits");
  assertHash("inputMaterializationSha256", manifest.inputMaterializationSha256);
  assertHash("productionInstrumentSealSha256", manifest.productionInstrumentSealSha256);
  requireCondition(manifest.targets.length === (manifest.kind === "pilot" ? 8 : manifest.targets.length), "pilot must contain exactly eight chapters");
  requireCondition(manifest.kind !== "gold" || manifest.targets.length >= 8, "gold full book must contain at least 8 chapters");
  const identityFamily: ForwardValidationIdentityFamily = manifest.experimentId.includes("v2-envelope")
    ? "imp24-v2-envelope"
    : "legacy-v1";
  requireCondition(manifest.kind === "pilot"
    ? manifest.experimentId === pilotCorrectionExperimentId(manifest.correctionCycle, identityFamily)
    : manifest.experimentId === (identityFamily === "imp24-v2-envelope" ? GOLD_ENVELOPE_EXPERIMENT_ID : GOLD_EXPERIMENT_ID),
  "manifest experimentId is not the deterministic id for its kind/correction cycle");
  requireCondition(hashCanonical(manifest.qualificationBookIds) === hashCanonical(sortedUnique(manifest.qualificationBookIds)),
    "manifest qualification book exclusions must be sorted and unique");
  const keys = manifest.targets.map(chapterKey);
  requireCondition(new Set(keys).size === keys.length, "manifest contains duplicate chapter coordinates");
  requireCondition(new Set(manifest.targets.map((t) => t.outputRunId)).size === manifest.targets.length, "manifest output run ids are not unique");
  const excluded = new Set(manifest.qualificationBookIds);
  if (manifest.kind === "gold") for (const id of manifest.pilotBookIds) excluded.add(id);
  requireCondition(manifest.targets.every((target) => !excluded.has(target.bookId)), "manifest overlaps qualification or pilot books");
  for (const target of manifest.targets) {
    validateCoordinate(target);
    const nn = String(target.chapterNumber).padStart(2, "0");
    requireCondition(/^[a-z0-9][a-z0-9._-]{0,127}$/.test(target.bookId), `${chapterKey(target)}: bookId is not canonical-path safe`);
    requireCondition(target.chapterId === `${target.bookId}-ch${nn}`,
      `${chapterKey(target)}: chapterId is not the canonical coordinate-derived id`);
    requireCondition(hashCanonical(target.writerRoute) === hashCanonical(routeFor(target.riskSignals)), `${chapterKey(target)}: writer route is not derived from the frozen risk profile`);
    requireCondition(target.outputRunId === `${manifest.experimentId}--${target.bookId}--ch${nn}`,
      `${chapterKey(target)}: outputRunId is not the deterministic experiment route`);
    requireCondition(target.outputRelPath === `state/migration-experiments/${manifest.experimentId}/candidates/${target.bookId}/${target.chapterId}.v21-native.chapter.json`,
      `${chapterKey(target)}: outputRelPath is not the deterministic experiment-local route`);
  }
  if (manifest.kind === "pilot") {
    const books = new Set(manifest.targets.map((target) => target.bookId));
    requireCondition(books.size === 2, "pilot must use exactly two books/source collections");
    for (const stratum of FORWARD_CHAPTER_STRATA) {
      requireCondition(manifest.targets.filter((target) => target.stratum === stratum).length === 2, `pilot requires exactly two ${stratum} chapters`);
    }
  } else {
    assertHash("goldEvaluatorInstrumentSha256", manifest.goldEvaluatorInstrumentSha256);
    requireCondition(manifest.pilotAccepted === true && nonEmpty(manifest.pilotManifestSha256) && nonEmpty(manifest.pilotResultSha256),
      "gold manifest is not bound to an accepted frozen pilot result");
    requireCondition(new Set(manifest.targets.map((target) => target.bookId)).size === 1, "gold book manifest must select one book");
  }
}

export type ForwardCandidateStage = "first-write" | "repair" | "regeneration";
export type ForwardFailureClassification =
  | "CONTENT_SPECIFIC"
  | "PROMPT_OR_CONTRACT"
  | "SOURCE_PROJECTION"
  | "MODEL_ROUTING"
  | "REVIEW_INSTRUMENT"
  | "SCORER_OR_AGGREGATOR"
  | "STATE_OR_PROVENANCE"
  | "UNKNOWN";

export type ForwardCandidateRequestV1 = {
  manifestSha256: string;
  target: ForwardValidationTargetV1;
  stage: ForwardCandidateStage;
  sequence: 1;
  complaints: string[];
  repairScopes: string[];
  previous: ForwardValidationAttemptRecordV1 | null;
};

export type ForwardWriterRouteReceiptV1 = {
  model: string;
  effort: string;
  outputRunId: string;
  outputRelPath: string;
  destinationProof: ForwardExperimentDestinationProofV1;
  destinationProofSha256: string;
};

/** Every mutable author surface is named and rooted below one per-attempt
 * experiment directory.  The live adapter requires a COMPLETE AuthorIo beside
 * this proof; Partial<AuthorIo> is intentionally impossible here so canonical
 * defaults cannot leak into a validation campaign. */
export type ForwardExperimentDestinationProofV1 = {
  schema: typeof FORWARD_DESTINATION_PROOF_SCHEMA;
  experimentId: string;
  outputRunId: string;
  outputRelPath: string;
  experimentRootAbs: string;
  chapterOutputAbsPath: string;
  provenanceRootAbs: string;
  leadOverrideRootAbs: string;
  attemptsRootAbs: string;
  evidenceRootAbs: string;
  diversityLedgerRootAbs: string;
  gateAttemptStateAbsPath: string;
  executionManifestRootAbs: string;
  qualificationCacheRootAbs: string;
  sessionLogRootAbs: string;
  execSessionRootAbs: string;
  frozenIndexAbsPath: string;
  frozenIndexSha256: string;
  rubricThresholdsAbsPath: string;
  rubricThresholdsSha256: string;
  nameBankSnapshotAbsPath: string;
  nameBankSnapshotSha256: string;
  materializedInputSnapshotRootAbs: string;
  materializedInputSnapshotSha256: string;
};

export type ForwardPersistenceReceiptV1 = {
  schema: typeof FORWARD_PERSISTENCE_RECEIPT_SCHEMA;
  kind: "attempt" | "first-write-snapshot" | "gold-evaluator" | "gold-rater" | "gold-sweep";
  storageId: string;
  contentSha256: string;
};

export type ForwardGoldEvidenceArtifactV1 = {
  schema: typeof FORWARD_GOLD_EVIDENCE_SCHEMA;
  kind: "gold-evaluator" | "gold-rater" | "gold-sweep";
  actorId: string;
  executionId: string;
  finalChapterContentHashes: Record<string, string>;
  /** Evaluator verdict hash, isolated-rater result hash, or sweep hash. */
  payloadSha256: string;
};

export type ForwardGoldPersistedEvidenceRefV1 = {
  actorId: string;
  executionId: string;
  payloadSha256: string;
  artifactSha256: string;
  receipt: ForwardPersistenceReceiptV1;
};

export type ForwardGoldEvidenceBindingV1 = {
  finalChapterContentHashes: Record<string, string>;
  evaluator: ForwardGoldPersistedEvidenceRefV1;
  /** Exactly two isolated blind-rater records; runtime validation enforces
   * distinct actor, execution, artifact, and storage identities. */
  raters: [ForwardGoldPersistedEvidenceRefV1, ForwardGoldPersistedEvidenceRefV1];
  sweep: ForwardGoldPersistedEvidenceRefV1;
};

export type ForwardCandidateProductionV1 =
  | {
      ok: true;
      prepared: PreparedAuthorCandidate;
      routeReceipt: ForwardWriterRouteReceiptV1;
      patch?: ChapterPatchV1;
      /** Exact preserved base used to build the patch. The campaign independently
       * applies the typed patch and compares the resulting chapter to `prepared`;
       * a caller-provided equality assertion is not an authority. */
      patchBase?: { bytes: string; chapter: ChapterV21 };
    }
  | {
      ok: false;
      reason: string;
      failureClassification: ForwardFailureClassification;
      failureDisposition?: FailedRepairDisposition;
    };

export type ForwardFinalizationRouteV1 =
  | { kind: "stop"; classification: ForwardFailureClassification; reason: string }
  | { kind: "repair"; repairKind: "surgical" | "section"; complaints: string[]; scopes: string[] }
  | { kind: "regeneration"; complaints: string[] };

export type FailedRepairDisposition = "WRONG_ROUTE" | "WHOLE_CHAPTER_FAILURE" | "REPAIR_CONTENT_FAILURE" | "INFRASTRUCTURE";

export type ForwardValidationAttemptRecordV1 = {
  schema: typeof FORWARD_ATTEMPT_RECORD_SCHEMA;
  chapterKey: string;
  stage: ForwardCandidateStage;
  attemptId: string | null;
  attemptDir: string | null;
  candidateBytesSha256: string | null;
  candidateContentSha256: string | null;
  patchSha256: string | null;
  reader: ForwardChapterConductorResultV1["reader"];
  source: ForwardChapterConductorResultV1["source"];
  quiz: ForwardChapterConductorResultV1["quiz"];
  aggregate: ForwardChapterConductorResultV1["aggregate"];
  executionEnvelope: ForwardChapterConductorResultV1["executionEnvelope"] | null;
  executionEnvelopeSha256: string | null;
  /** Complete retained result for every reviewed attempt. V3 evidence
   * verification requires this field; it is optional only so archived V1
   * records remain parseable without reinterpretation. */
  conductorResult?: ForwardChapterConductorResultV1 | null;
  conductorResultSha256?: string | null;
  disposition: ForwardChapterConductorResultV1["disposition"] | "NOT_REVIEWED";
  finalStatus: ForwardChapterConductorResultV1["finalStatus"];
  pass: boolean;
  failureClassification: ForwardFailureClassification | null;
  repairFailureDisposition?: FailedRepairDisposition | null;
  failureReasons: string[];
};

export type ForwardFirstWriteSnapshotV1 = {
  schema: typeof FORWARD_FIRST_WRITE_SNAPSHOT_SCHEMA;
  experimentId: string;
  manifestSha256: string;
  totalChapters: number;
  passCount: number;
  passRate: number;
  entries: Array<{
    chapterKey: string;
    attemptId: string | null;
    candidateBytesSha256: string | null;
    executionEnvelopeSha256: string | null;
    finalStatus: ForwardChapterConductorResultV1["finalStatus"];
    pass: boolean;
  }>;
};

export type ForwardAcceptanceAccountingV1 = {
  totalChapters: number;
  firstWritePassCount: number;
  firstWritePassRate: number;
  finalPassCount: number;
  finalPassRate: number;
  finalSourceBlockers: number;
  finalQuizBlockers: number;
  finalReaderHardBlockers: number;
  wrongQuizKeys: number;
  unsupportedSourceBoundInventedDetails: number;
  misleadingConstructedFraming: number;
  genericHistoricalSpecificityLeaks: number;
  unsupportedHighSeverityCausalClaims: number;
  repairAttempts: number;
  fullRegenerations: number;
  chaptersRequiringContentRepair: number;
  repeatedOrUnboundedRepair: number;
  stateProvenanceSchemaFailures: number;
  unexpectedWrites: number;
  staleEvidenceAccepted: number;
};

export type ForwardGoldBookEvaluationV1 = {
  technicalCompleteness: "PASS" | "FAIL";
  epistemicInstructionalSafety: "PASS" | "FAIL";
  ethicsReaderAutonomy: "PASS" | "FAIL";
  purposeAudienceDeclaration: "PASS" | "FAIL";
  externalAccuracy: "PASS" | "FAIL";
  contentDesignScore: number;
  sweep: SweepRecord;
  evidenceBinding: ForwardGoldEvidenceBindingV1;
};

export type ForwardValidationCampaignResultV1 = {
  schema: typeof FORWARD_VALIDATION_RESULT_SCHEMA;
  experimentId: string;
  manifestSha256: string;
  kind: "pilot" | "gold";
  firstWriteSnapshot: Readonly<ForwardFirstWriteSnapshotV1>;
  firstWriteSnapshotSha256: string;
  attempts: ForwardValidationAttemptRecordV1[];
  finalByChapter: Record<string, ForwardValidationAttemptRecordV1>;
  accounting: ForwardAcceptanceAccountingV1;
  goldEvaluation: ForwardGoldBookEvaluationV1 | null;
  hardFailures: string[];
  accepted: boolean;
  capabilitiesUsed: typeof FORWARD_VALIDATION_CAPABILITIES;
  persistenceReceipts: ForwardPersistenceReceiptV1[];
};

export type ForwardValidationCampaignDeps = {
  produceCandidate: (request: ForwardCandidateRequestV1) => Promise<ForwardCandidateProductionV1>;
  buildConductorInput: (args: {
    target: ForwardValidationTargetV1;
    prepared: PreparedAuthorCandidate;
    stage: ForwardCandidateStage;
  }) => Promise<ForwardChapterConductorInputV1> | ForwardChapterConductorInputV1;
  /** Omit to call the real forwardChapterConductor with conductorDeps. */
  conductCandidate?: (input: ForwardChapterConductorInputV1) => Promise<ForwardChapterConductorResultV1>;
  conductorDeps?: ForwardChapterConductorDeps;
  routeFirstFailure: (args: {
    target: ForwardValidationTargetV1;
    first: ForwardValidationAttemptRecordV1;
  }) => ForwardFinalizationRouteV1;
  classifyFailedRepair: (args: {
    target: ForwardValidationTargetV1;
    first: ForwardValidationAttemptRecordV1;
    repair: ForwardValidationAttemptRecordV1;
  }) => FailedRepairDisposition;
  /** Must durably preserve every attempt record/envelope before the next stage. */
  preserveAttempt: (
    record: Readonly<ForwardValidationAttemptRecordV1>,
    contentSha256: string,
  ) => Promise<ForwardPersistenceReceiptV1> | ForwardPersistenceReceiptV1;
  /** Must durably freeze the denominator before any repair/regeneration begins. */
  freezeFirstWriteMetrics: (
    snapshot: Readonly<ForwardFirstWriteSnapshotV1>,
    sha256: string,
  ) => Promise<ForwardPersistenceReceiptV1> | ForwardPersistenceReceiptV1;
  /** Read the artifact identified by a sink receipt from durable storage. The
   * campaign hashes this read-back itself before it advances. */
  readPersistedEvidence: (receipt: Readonly<ForwardPersistenceReceiptV1>) => Promise<unknown> | unknown;
  /** Exact crash-resume seam. A phase-local evidence store may return the one
   * previously preserved record for this coordinate/stage. The campaign
   * revalidates its identity and reuses it instead of reminting an attempt or
   * spending a model call. */
  loadPreservedAttempt?: (args: {
    target: ForwardValidationTargetV1;
    stage: ForwardCandidateStage;
  }) => Promise<ForwardValidationAttemptRecordV1 | null> | ForwardValidationAttemptRecordV1 | null;
  evaluateGoldBook?: (args: {
    manifest: Readonly<ForwardGoldManifestV1>;
    finalByChapter: Readonly<Record<string, ForwardValidationAttemptRecordV1>>;
  }) => Promise<ForwardGoldBookEvaluationV1>;
};

function isStrictDescendant(root: string, child: string): boolean {
  const rel = relative(root, child);
  return rel.length > 0 && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

function assertExperimentDestination(
  target: ForwardValidationTargetV1,
  proof: ForwardExperimentDestinationProofV1,
): void {
  requireCondition(proof?.schema === FORWARD_DESTINATION_PROOF_SCHEMA, `${chapterKey(target)}: missing experiment destination proof`);
  requireCondition(proof.outputRunId === target.outputRunId, `${chapterKey(target)}: destination proof carries wrong output run id`);
  requireCondition(proof.outputRelPath === target.outputRelPath, `${chapterKey(target)}: destination proof carries wrong output path`);
  requireCondition(target.outputRunId.startsWith(`${proof.experimentId}--`), `${chapterKey(target)}: destination proof experiment id is not bound to the output run`);
  for (const [label, value] of Object.entries({
    experimentRootAbs: proof.experimentRootAbs,
    chapterOutputAbsPath: proof.chapterOutputAbsPath,
    provenanceRootAbs: proof.provenanceRootAbs,
    leadOverrideRootAbs: proof.leadOverrideRootAbs,
    attemptsRootAbs: proof.attemptsRootAbs,
    evidenceRootAbs: proof.evidenceRootAbs,
    diversityLedgerRootAbs: proof.diversityLedgerRootAbs,
    gateAttemptStateAbsPath: proof.gateAttemptStateAbsPath,
    executionManifestRootAbs: proof.executionManifestRootAbs,
    qualificationCacheRootAbs: proof.qualificationCacheRootAbs,
    sessionLogRootAbs: proof.sessionLogRootAbs,
    execSessionRootAbs: proof.execSessionRootAbs,
    frozenIndexAbsPath: proof.frozenIndexAbsPath,
    rubricThresholdsAbsPath: proof.rubricThresholdsAbsPath,
    nameBankSnapshotAbsPath: proof.nameBankSnapshotAbsPath,
    materializedInputSnapshotRootAbs: proof.materializedInputSnapshotRootAbs,
  })) {
    requireCondition(nonEmpty(value) && isAbsolute(value) && resolve(value) === value, `${chapterKey(target)}: ${label} must be a normalized absolute path`);
  }
  requireCondition(proof.experimentRootAbs.split(/[\\/]/).at(-1) === target.outputRunId,
    `${chapterKey(target)}: experiment root must be dedicated to this exact output run`);
  for (const [label, value] of Object.entries({
    chapterOutputAbsPath: proof.chapterOutputAbsPath,
    provenanceRootAbs: proof.provenanceRootAbs,
    leadOverrideRootAbs: proof.leadOverrideRootAbs,
    attemptsRootAbs: proof.attemptsRootAbs,
    evidenceRootAbs: proof.evidenceRootAbs,
    diversityLedgerRootAbs: proof.diversityLedgerRootAbs,
    gateAttemptStateAbsPath: proof.gateAttemptStateAbsPath,
    executionManifestRootAbs: proof.executionManifestRootAbs,
    qualificationCacheRootAbs: proof.qualificationCacheRootAbs,
    sessionLogRootAbs: proof.sessionLogRootAbs,
    execSessionRootAbs: proof.execSessionRootAbs,
    frozenIndexAbsPath: proof.frozenIndexAbsPath,
    rubricThresholdsAbsPath: proof.rubricThresholdsAbsPath,
    nameBankSnapshotAbsPath: proof.nameBankSnapshotAbsPath,
    materializedInputSnapshotRootAbs: proof.materializedInputSnapshotRootAbs,
  })) {
    requireCondition(isStrictDescendant(proof.experimentRootAbs, value), `${chapterKey(target)}: ${label} escapes the experiment root`);
  }
  requireCondition(/^[a-f0-9]{64}$/.test(proof.frozenIndexSha256), `${chapterKey(target)}: frozen index hash is invalid`);
  requireCondition(/^[a-f0-9]{64}$/.test(proof.rubricThresholdsSha256), `${chapterKey(target)}: rubric threshold hash is invalid`);
  requireCondition(/^[a-f0-9]{64}$/.test(proof.nameBankSnapshotSha256), `${chapterKey(target)}: name-bank snapshot hash is invalid`);
  requireCondition(/^[a-f0-9]{64}$/.test(proof.materializedInputSnapshotSha256), `${chapterKey(target)}: materialized input snapshot hash is invalid`);
}

const COMPLETE_AUTHOR_IO_METHODS: readonly (keyof AuthorIo)[] = [
  "chapterExists", "readBriefMd", "readBrief", "readPacket", "readSourcePlan", "loadChapters",
  "nameBankOk", "voiceCard", "authorSessionOf", "recordProvenance", "readProvenance", "restoreProvenance",
  "readChapterFile", "writeChapterFile", "removeChapterFile", "readLeadOverride", "writeLeadOverride",
  "removeLeadOverride", "gateCandidate", "rubricWithCandidate", "attemptsRoot", "evidenceRoot", "diversityLedgerRoot",
];

function assertCompleteExperimentIo(io: AuthorIo, proof: ForwardExperimentDestinationProofV1): void {
  requireCondition(io && typeof io === "object", "forward author destination did not provide AuthorIo");
  const missing = COMPLETE_AUTHOR_IO_METHODS.filter((key) => typeof io[key] !== "function");
  requireCondition(missing.length === 0, `forward author destination has incomplete AuthorIo (${missing.join(", ")}); canonical defaults are forbidden`);
  requireCondition(resolve(io.attemptsRoot()) === proof.attemptsRootAbs, "forward author attemptsRoot does not match its destination proof");
  requireCondition(resolve(io.evidenceRoot!() ?? "") === proof.evidenceRootAbs, "forward author evidenceRoot does not match its destination proof");
  requireCondition(resolve(io.diversityLedgerRoot!() ?? "") === proof.diversityLedgerRootAbs, "forward author diversity root does not match its destination proof");
}

/** Adapter for the real deferred author seam. Surgical/section patch production
 * remains a separate injected adapter because authorRepair owns that protocol. */
export function createDeferredAuthorProducer(args: {
  deps: AutopilotDeps;
  decorateAuthorCard?: (request: ForwardCandidateRequestV1, card: string) => string;
  attemptInputHashes?: (
    request: ForwardCandidateRequestV1,
    destination: { io: AuthorIo; destinationProof: ForwardExperimentDestinationProofV1 },
  ) => Record<string, string>;
  ioFor: (target: ForwardValidationTargetV1) => {
    io: AuthorIo;
    destinationProof: ForwardExperimentDestinationProofV1;
  };
}): ForwardValidationCampaignDeps["produceCandidate"] {
  return async (request) => {
    if (request.stage === "repair") {
      return { ok: false, reason: "typed patch production must use the authorRepair adapter", failureClassification: "PROMPT_OR_CONTRACT" };
    }
    // Resolve and validate the complete experiment-local IO BEFORE the author
    // function can spawn. This is the live-path guard against Partial defaults
    // silently pointing chapters/provenance/attempts at canonical state.
    const destination = args.ioFor(request.target);
    assertExperimentDestination(request.target, destination.destinationProof);
    assertCompleteExperimentIo(destination.io, destination.destinationProof);
    const result = await authorWriteOneChapter(request.target.bookId, request.target.chapterNumber, args.deps, {
      io: destination.io,
      complaints: request.stage === "regeneration" ? request.complaints : undefined,
      firstWriteOnly: true,
      deferCommit: true,
      model: request.target.writerRoute.model,
      effort: request.target.writerRoute.effort,
      outputRelPath: request.target.outputRelPath,
      ...(args.attemptInputHashes ? { attemptInputHashes: args.attemptInputHashes(request, destination) } : {}),
      ...(args.decorateAuthorCard ? { cardOverride: (card) => args.decorateAuthorCard!(request, card) } : {}),
    });
    if (!result.ok) return { ok: false, reason: result.reason, failureClassification: classifyAuthorWriteFailure(result) };
    if (!("committed" in result) || result.committed !== false) {
      return { ok: false, reason: "author path committed instead of returning a deferred candidate", failureClassification: "STATE_OR_PROVENANCE" };
    }
    return {
      ok: true,
      prepared: result.pending,
      routeReceipt: {
        model: request.target.writerRoute.model,
        effort: request.target.writerRoute.effort,
        outputRunId: request.target.outputRunId,
        outputRelPath: request.target.outputRelPath,
        destinationProof: destination.destinationProof,
        destinationProofSha256: hashCanonical(destination.destinationProof),
      },
    };
  };
}

export function classifyAuthorWriteFailure(
  result: Extract<AuthorWriteOneResult, { ok: false }>,
): ForwardFailureClassification {
  return result.failureKind === "INFRASTRUCTURE"
    ? "MODEL_ROUTING"
    : result.failureKind === "STATE_OR_PROVENANCE"
      ? "STATE_OR_PROVENANCE"
      : result.failureKind === "PROMPT_OR_CONTRACT"
        ? "PROMPT_OR_CONTRACT"
        : "CONTENT_SPECIFIC";
}

function productionFailureRecord(
  target: ForwardValidationTargetV1,
  stage: ForwardCandidateStage,
  reason: string,
  classification: ForwardFailureClassification,
  failureDisposition?: FailedRepairDisposition,
): ForwardValidationAttemptRecordV1 {
  return {
    schema: FORWARD_ATTEMPT_RECORD_SCHEMA,
    chapterKey: chapterKey(target),
    stage,
    attemptId: null,
    attemptDir: null,
    candidateBytesSha256: null,
    candidateContentSha256: null,
    patchSha256: null,
    reader: null,
    source: null,
    quiz: null,
    aggregate: null,
    executionEnvelope: null,
    executionEnvelopeSha256: null,
    disposition: "NOT_REVIEWED",
    finalStatus: "INCONCLUSIVE",
    pass: false,
    failureClassification: classification,
    ...(stage === "repair" ? { repairFailureDisposition: failureDisposition ?? (classification === "MODEL_ROUTING" || classification === "STATE_OR_PROVENANCE" ? "INFRASTRUCTURE" : "REPAIR_CONTENT_FAILURE") } : {}),
    failureReasons: [reason],
  };
}

function assertRouteReceipt(target: ForwardValidationTargetV1, receipt: ForwardWriterRouteReceiptV1): void {
  requireCondition(receipt.model === target.writerRoute.model, `${chapterKey(target)}: writer used wrong model`);
  requireCondition(receipt.effort === target.writerRoute.effort, `${chapterKey(target)}: writer used wrong effort`);
  requireCondition(receipt.outputRunId === target.outputRunId, `${chapterKey(target)}: writer used stale/wrong output run id`);
  requireCondition(receipt.outputRelPath === target.outputRelPath, `${chapterKey(target)}: writer used stale/wrong output path`);
  assertExperimentDestination(target, receipt.destinationProof);
  requireCondition(receipt.destinationProofSha256 === hashCanonical(receipt.destinationProof), `${chapterKey(target)}: destination-proof hash mismatch`);
}

function assertPrepared(target: ForwardValidationTargetV1, stage: ForwardCandidateStage, prepared: PreparedAuthorCandidate): void {
  requireCondition(prepared.bookId === target.bookId && prepared.chapterNumber === target.chapterNumber && prepared.chapterId === target.chapterId,
    `${chapterKey(target)}: prepared candidate identity mismatch`);
  requireCondition(prepared.plan !== null, `${chapterKey(target)}: forward validation requires a source-use plan`);
  requireCondition(sourceUsePlanHash(prepared.plan) === target.sourceUsePlanSha256, `${chapterKey(target)}: prepared candidate carries stale source-use plan`);
  requireCondition(prepared.attempt.identity.attemptSequence === 1, `${chapterKey(target)}: hidden candidate retry/selection is not allowed`);
  const expectedKind = stage === "first-write" ? "author-initial" : stage === "regeneration" ? "author-regeneration" : null;
  if (expectedKind) requireCondition(prepared.attempt.identity.attemptKind === expectedKind, `${chapterKey(target)}: ${stage} attempt kind mismatch`);
  else requireCondition(prepared.attempt.identity.attemptKind === "surgical-repair" || prepared.attempt.identity.attemptKind === "section-repair",
    `${chapterKey(target)}: repair attempt kind mismatch`);
}

function assertPatch(
  target: ForwardValidationTargetV1,
  production: Extract<ForwardCandidateProductionV1, { ok: true }>,
  previous: ForwardValidationAttemptRecordV1 | null,
  requestedScopes: readonly string[],
): void {
  requireCondition(!!production.patch, `${chapterKey(target)}: repair must preserve its typed patch`);
  const errors = validateChapterPatch(production.patch);
  requireCondition(errors.length === 0, `${chapterKey(target)}: invalid typed patch (${errors.join("; ")})`);
  requireCondition(production.patch.chapterId === target.chapterId, `${chapterKey(target)}: patch chapterId mismatch`);
  requireCondition(production.patch.sourcePlanHash === target.sourceUsePlanSha256, `${chapterKey(target)}: patch source-plan hash is stale`);
  requireCondition(!!previous?.candidateBytesSha256, `${chapterKey(target)}: repair is missing the preserved first candidate base`);
  requireCondition(production.patch.expectedBaseHash === previous.candidateBytesSha256, `${chapterKey(target)}: patch base hash does not bind the preserved first candidate`);
  requireCondition(!!production.patchBase, `${chapterKey(target)}: repair is missing the preserved base bytes/object`);
  requireCondition(sha256Hex(production.patchBase.bytes) === previous.candidateBytesSha256,
    `${chapterKey(target)}: supplied repair base bytes do not match the preserved first candidate`);
  requireCondition(hashCanonical(JSON.parse(production.patchBase.bytes)) === hashCanonical(production.patchBase.chapter),
    `${chapterKey(target)}: supplied repair base bytes/object disagree`);

  const scopePrefixes = requestedScopes.flatMap((scope) => scope === "practice"
    ? ["implementationPlan", "tryThisNow"]
    : [scope]);
  requireCondition(scopePrefixes.length > 0, `${chapterKey(target)}: repair has no requested scopes`);
  for (const op of production.patch.operations) {
    requireCondition(scopePrefixes.some((scope) => op.path === scope || op.path.startsWith(`${scope}.`) || op.path.startsWith(`${scope}[`)),
      `${chapterKey(target)}: patch path ${op.path} exceeds the requested repair scopes`);
  }

  const route = production.prepared.attempt.identity.attemptKind === "section-repair" ? "section" : "surgical";
  const applied = applyChapterPatch({
    originalBytes: production.patchBase.bytes,
    original: production.patchBase.chapter,
    patch: production.patch,
    route,
    plan: production.prepared.plan,
  });
  requireCondition(applied.ok, `${chapterKey(target)}: typed patch cannot be applied (${applied.ok ? "unknown" : applied.reason})`);
  if (!applied.ok) return;
  requireCondition(nonScopeDrift(production.patchBase.chapter, applied.chapter, applied.touchedPaths).length === 0,
    `${chapterKey(target)}: applied repair drifted outside its typed operations`);
  requireCondition(hashCanonical(applied.chapter) === hashCanonical(production.prepared.chapter),
    `${chapterKey(target)}: prepared repair candidate is not the independently applied typed patch`);
  let preparedBytesObject: unknown;
  try { preparedBytesObject = JSON.parse(production.prepared.bytes); }
  catch { throw new ForwardValidationError(`${chapterKey(target)}: prepared repair bytes are not JSON`); }
  requireCondition(hashCanonical(preparedBytesObject) === hashCanonical(applied.chapter),
    `${chapterKey(target)}: prepared repair bytes are not the independently applied typed patch`);
}

function assertConductorInput(target: ForwardValidationTargetV1, prepared: PreparedAuthorCandidate, input: ForwardChapterConductorInputV1, manifest: ForwardValidationManifestV1): void {
  requireCondition(input.prepared === prepared, `${chapterKey(target)}: input builder substituted a hidden candidate`);
  requireCondition(typeof input.rereadAuthoritativeSourceEvidence === "function", `${chapterKey(target)}: input builder omitted authoritative source-evidence re-read`);
  requireCondition(input.frozen.roleAssignmentSha256 === manifest.roleAssignmentSha256, `${chapterKey(target)}: wrong frozen role assignment`);
  requireCondition(input.frozen.instrumentManifestSha256 === manifest.instrumentManifestSha256, `${chapterKey(target)}: wrong frozen review instruments`);
  requireCondition(sourcePacketHash(input.sourcePacket) === target.sourcePacketSha256, `${chapterKey(target)}: stale source packet`);
  requireCondition(semanticSourceHash(input.sourceSidecar) === target.sidecarSha256, `${chapterKey(target)}: stale source sidecar`);
  requireCondition(hashCanonical(input.anchorCatalog) === target.anchorCatalogSha256, `${chapterKey(target)}: stale anchor catalog`);
}

/** Campaign-level acceptance gate for V2 packet-local source calls. The
 * conductor owns each operation key; this check binds the retained execution
 * list to the authoritative source-envelope hashes in exact compiler order. */
export function forwardV2SourceExecutionOrderProblems(args: {
  executions: readonly ForwardReviewExecutionEntryV1[];
  sourceEnvelopeSha256s: readonly string[];
  sourceAdjudicationTriggered: boolean;
}): string[] {
  const problems: string[] = [];
  const operationCount = args.sourceEnvelopeSha256s.length;
  if (operationCount < 1) return ["committed V2 result has no authoritative source envelope operations"];
  const sourcePrimaryExecutions = args.executions.filter((execution) => execution.panelRole === "sourcePrimary");
  const sourceAdjudicatorExecutions = args.executions.filter((execution) => execution.panelRole === "sourceAdjudicator");
  const validate = (
    entries: readonly ForwardReviewExecutionEntryV1[],
    panelRole: "sourcePrimary" | "sourceAdjudicator",
  ): void => {
    if (entries.length !== operationCount) {
      problems.push(`committed V2 result requires exactly ${operationCount} ${panelRole} executions`);
      return;
    }
    const operationKeys = entries.map((entry) => entry.reviewOperationKey);
    if (operationKeys.some((key) => typeof key !== "string" || key.trim().length === 0)
        || new Set(operationKeys).size !== operationCount) {
      problems.push(`committed V2 ${panelRole} executions do not retain unique source operation keys`);
    }
    entries.forEach((entry, index) => {
      const expectedEnvelopeSha256 = args.sourceEnvelopeSha256s[index];
      if (entry.reviewOperationKey !== entry.expected.reviewOperationKey
          || entry.received?.reviewOperationKey !== entry.reviewOperationKey) {
        problems.push(`committed V2 ${panelRole} execution ${index + 1} changed its conductor-owned operation key`);
      }
      if (entry.expected.evidenceEnvelopeSha256 !== expectedEnvelopeSha256
          || entry.received?.evidenceEnvelopeSha256 !== expectedEnvelopeSha256) {
        problems.push(`committed V2 ${panelRole} execution ${index + 1} is not bound to the authoritative source envelope order`);
      }
    });
  };
  validate(sourcePrimaryExecutions, "sourcePrimary");
  if (args.sourceAdjudicationTriggered) {
    validate(sourceAdjudicatorExecutions, "sourceAdjudicator");
    if (sourceAdjudicatorExecutions.length === sourcePrimaryExecutions.length
        && sourceAdjudicatorExecutions.some((entry, index) =>
          entry.reviewOperationKey !== sourcePrimaryExecutions[index]?.reviewOperationKey)) {
      problems.push("committed V2 source adjudicator operation order differs from source primary order");
    }
  } else if (sourceAdjudicatorExecutions.length !== 0) {
    problems.push("committed V2 result contains untriggered source adjudicator executions");
  }
  return problems;
}

function conductorResultProblems(
  target: ForwardValidationTargetV1,
  prepared: PreparedAuthorCandidate,
  result: ForwardChapterConductorResultV1,
  manifest: ForwardValidationManifestV1,
): string[] {
  const problems: string[] = [];
  const envelope = result.executionEnvelope;
  if (result.executionEnvelopeSha256 !== hashCanonical(envelope)) problems.push("execution-envelope hash mismatch");
  if (envelope.attemptId !== prepared.attempt.identity.attemptId) problems.push("execution envelope bound to a different attempt");
  if (envelope.candidateBytesSha256 !== sha256Hex(prepared.bytes)) problems.push("execution envelope bound to stale candidate bytes");
  if (envelope.candidateContentSha256 !== chapterContentHash(prepared.chapter)) problems.push("execution envelope bound to stale candidate content");
  if (envelope.sourceUsePlanSha256 !== target.sourceUsePlanSha256) problems.push("execution envelope carries stale source-use plan");
  if (envelope.sourcePacketSha256 !== target.sourcePacketSha256) problems.push("execution envelope carries stale source packet");
  if (envelope.sidecarSha256 !== target.sidecarSha256) problems.push("execution envelope carries stale sidecar");
  if (envelope.anchorCatalogSha256 !== target.anchorCatalogSha256) problems.push("execution envelope carries stale anchor catalog");
  if (envelope.roleAssignmentSha256 !== manifest.roleAssignmentSha256) problems.push("execution envelope carries wrong role assignment");
  if (envelope.instrumentManifestSha256 !== manifest.instrumentManifestSha256) problems.push("execution envelope carries wrong instrument manifest");
  if (envelope.finalStatus !== result.finalStatus || envelope.disposition !== result.disposition) problems.push("execution envelope/result disposition mismatch");
  if (result.aggregate) {
    if (!result.reader || !result.source || !result.quiz || !envelope.deterministicCriticBundleSha256) problems.push("aggregate is missing bound lane evidence");
    else if (!aggregateIsFresh(result.aggregate, {
      chapterContentSha256: envelope.candidateContentSha256,
      readerResultSha256: hashCanonical(result.reader),
      sourceResultSha256: hashCanonical(result.source),
      quizResultSha256: hashCanonical(result.quiz),
      deterministicCriticBundleSha256: envelope.deterministicCriticBundleSha256,
    })) problems.push("aggregate is stale against lane evidence");
  }
  if (result.reader && envelope.readerResultSha256 !== hashCanonical(result.reader)) problems.push("execution envelope carries stale reader result");
  if (result.readerAudit && envelope.readerAuditResultSha256 !== hashCanonical(result.readerAudit)) problems.push("execution envelope carries stale reader-audit result");
  if (!result.readerAudit && envelope.readerAuditResultSha256) problems.push("execution envelope carries reader-audit evidence without a result");
  if (result.source && envelope.sourceResultSha256 !== hashCanonical(result.source)) problems.push("execution envelope carries stale source result");
  if (result.sourceAdjudication && envelope.sourceAdjudicatorResultSha256 !== hashCanonical(result.sourceAdjudication)) problems.push("execution envelope carries stale source-adjudication result");
  if (!result.sourceAdjudication && envelope.sourceAdjudicatorResultSha256) problems.push("execution envelope carries source-adjudication evidence without a result");
  if (result.quiz && envelope.quizResultSha256 !== hashCanonical(result.quiz)) problems.push("execution envelope carries stale quiz result");
  if (result.aggregate && envelope.aggregateSha256 !== hashCanonical(result.aggregate)) problems.push("execution envelope carries stale aggregate result");
  if (result.disposition === "COMMITTED") {
    if (result.finalStatus !== "PASS" || result.aggregate?.finalStatus !== "PASS") problems.push("non-PASS result claims committed");
    if (!result.commitResult?.ok || !("committed" in result.commitResult) || result.commitResult.committed !== true) problems.push("committed result lacks commit confirmation");
    if (envelope.executions.some((execution) => execution.status !== "VERIFIED")) problems.push("committed result contains unverified reviewer execution");
    const v2SourceEnvelopeSha256s = result.authoritativeV2?.sourceEnvelopeSha256s ?? null;
    const sourceOperationCount = v2SourceEnvelopeSha256s?.length ?? 1;
    if (v2SourceEnvelopeSha256s && sourceOperationCount < 1) {
      problems.push("committed V2 result has no authoritative source envelope operations");
    }
    const expectedPanelRoles = [
      "readerPrimary",
      ...(envelope.readerAuditSelected ? ["readerAudit"] : []),
      ...Array.from({ length: sourceOperationCount }, () => "sourcePrimary"),
      ...(envelope.sourceAdjudicationTriggered
        ? Array.from({ length: sourceOperationCount }, () => "sourceAdjudicator")
        : []),
      "quizSemanticAdjudicator",
    ];
    const expectedLanes = expectedPanelRoles.map((role) => role.startsWith("reader") ? "reader" : role.startsWith("source") ? "source" : "quiz");
    if (envelope.executions.map((execution) => execution.panelRole ?? "missing").join(",") !== expectedPanelRoles.join(",")) {
      problems.push("committed result does not preserve the frozen primary/audit/adjudicator panel order");
    }
    if (envelope.executions.map((execution) => execution.lane).join(",") !== expectedLanes.join(",")) {
      problems.push("committed result panel roles do not match their split lanes");
    }
    if (v2SourceEnvelopeSha256s) {
      problems.push(...forwardV2SourceExecutionOrderProblems({
        executions: envelope.executions,
        sourceEnvelopeSha256s: v2SourceEnvelopeSha256s,
        sourceAdjudicationTriggered: envelope.sourceAdjudicationTriggered === true,
      }));
      const readerExecutions = envelope.executions.filter((execution) => execution.lane === "reader");
      const quizExecutions = envelope.executions.filter((execution) => execution.lane === "quiz");
      if (readerExecutions.some((execution) => execution.reviewOperationKey !== "reader")
          || quizExecutions.some((execution) => execution.reviewOperationKey !== "quiz")) {
        problems.push("committed V2 reader/quiz execution operation keys differ from the fixed conductor identities");
      }
    }
    if (Boolean(result.readerAudit) !== Boolean(envelope.readerAuditSelected)) problems.push("committed result reader-audit selection/evidence mismatch");
    if (Boolean(result.sourceAdjudication) !== Boolean(envelope.sourceAdjudicationTriggered)) problems.push("committed result source-adjudication trigger/evidence mismatch");
    const executionIds = envelope.executions.map((execution) => execution.received?.executionId ?? "");
    if (executionIds.some((id) => !id) || new Set(executionIds).size !== executionIds.length) problems.push("committed result lacks independent reviewer execution ids for the complete frozen panel");
    if (result.reader?.blockingFindings.length !== 0) problems.push("committed result contains a reader hard blocker");
    if (result.source?.result !== "PASS" || result.source.blockingFindingIds.length !== 0) problems.push("committed result contains a source blocker/inconclusive verdict");
    if (result.quiz?.result !== "PASS" || result.quiz.questions.some((question) => !question.keyCorrect || !question.uniqueAnswer || !question.mechanismSupported)) {
      problems.push("committed result contains a quiz blocker");
    }
    if ((result.aggregate?.readerComposite ?? -1) < 80) problems.push("committed result is below the frozen reader bar");
  }
  return problems;
}

async function runOneAttempt(args: {
  manifest: Readonly<ForwardValidationManifestV1>;
  manifestSha256: string;
  target: ForwardValidationTargetV1;
  stage: ForwardCandidateStage;
  complaints?: string[];
  repairScopes?: string[];
  previous: ForwardValidationAttemptRecordV1 | null;
  deps: ForwardValidationCampaignDeps;
}): Promise<ForwardValidationAttemptRecordV1> {
  const { manifest, manifestSha256, target, stage, previous, deps } = args;
  let production: ForwardCandidateProductionV1;
  try {
    production = await deps.produceCandidate({
      manifestSha256,
      target,
      stage,
      sequence: 1,
      complaints: [...(args.complaints ?? [])],
      repairScopes: [...(args.repairScopes ?? [])],
      previous,
    });
  } catch (error) {
    production = { ok: false, reason: `candidate producer threw: ${(error as Error).message}`, failureClassification: "STATE_OR_PROVENANCE" };
  }
  if (!production.ok) return productionFailureRecord(target, stage, production.reason, production.failureClassification, production.failureDisposition);

  const prepared = production.prepared;
  try {
    assertRouteReceipt(target, production.routeReceipt);
    assertPrepared(target, stage, prepared);
    if (stage === "repair") assertPatch(target, production, previous, args.repairScopes ?? []);
    else requireCondition(!production.patch, `${chapterKey(target)}: ${stage} smuggled a repair patch`);
    const allowed = stage === "repair" ? ["patch.json"] : [];
    const unexpected = unexpectedAttemptWrites(prepared.attempt, allowed);
    requireCondition(unexpected.length === 0, `${chapterKey(target)}: unexpected workspace write(s): ${unexpected.join(", ")}`);
    const input = await deps.buildConductorInput({ target, prepared, stage });
    assertConductorInput(target, prepared, input, manifest);
    const result = deps.conductCandidate
      ? await deps.conductCandidate(input)
      : await runForwardChapterConductor(input, deps.conductorDeps ?? (() => { throw new ForwardValidationError("real conductor requires conductorDeps"); })());
    const problems = conductorResultProblems(target, prepared, result, manifest);
    const pass = problems.length === 0 && result.disposition === "COMMITTED" && result.finalStatus === "PASS";
    return {
      schema: FORWARD_ATTEMPT_RECORD_SCHEMA,
      chapterKey: chapterKey(target),
      stage,
      attemptId: prepared.attempt.identity.attemptId,
      attemptDir: prepared.attempt.attemptDir,
      candidateBytesSha256: sha256Hex(prepared.bytes),
      candidateContentSha256: chapterContentHash(prepared.chapter),
      patchSha256: production.patch ? hashCanonical(production.patch) : null,
      reader: result.reader,
      source: result.source,
      quiz: result.quiz,
      aggregate: result.aggregate,
      executionEnvelope: result.executionEnvelope,
      executionEnvelopeSha256: result.executionEnvelopeSha256,
      conductorResult: result,
      conductorResultSha256: hashCanonical(result),
      disposition: problems.length > 0 ? "NOT_REVIEWED" : result.disposition,
      finalStatus: problems.length > 0 ? "INCONCLUSIVE" : result.finalStatus,
      pass,
      failureClassification: pass ? null : problems.length > 0 ? "STATE_OR_PROVENANCE" : null,
      ...(stage === "repair" && !pass ? {
        repairFailureDisposition: problems.length > 0
          ? "INFRASTRUCTURE" as const
          : result.reason.toLowerCase().includes("wrong route")
            ? "WRONG_ROUTE" as const
            : (result.aggregate?.readerComposite ?? 100) < 80
              ? "WHOLE_CHAPTER_FAILURE" as const
              : "REPAIR_CONTENT_FAILURE" as const,
      } : {}),
      failureReasons: problems.length > 0 ? problems : pass ? [] : [result.reason],
    };
  } catch (error) {
    const reason = (error as Error).message;
    const unexpected = /unexpected workspace write/.test(reason);
    finalizeAttempt(prepared.attempt, unexpected ? "unexpected_write" : "validation_failed", reason);
    return {
      ...productionFailureRecord(target, stage, reason, "STATE_OR_PROVENANCE"),
      attemptId: prepared.attempt.identity.attemptId,
      attemptDir: prepared.attempt.attemptDir,
      candidateBytesSha256: sha256Hex(prepared.bytes),
      candidateContentSha256: chapterContentHash(prepared.chapter),
      patchSha256: production.patch ? hashCanonical(production.patch) : null,
    };
  }
}

function frozenFirstWriteSnapshot(manifest: Readonly<ForwardValidationManifestV1>, manifestSha256: string, attempts: readonly ForwardValidationAttemptRecordV1[]): Readonly<ForwardFirstWriteSnapshotV1> {
  const passCount = attempts.filter((attempt) => attempt.pass).length;
  const snapshot: ForwardFirstWriteSnapshotV1 = {
    schema: FORWARD_FIRST_WRITE_SNAPSHOT_SCHEMA,
    experimentId: manifest.experimentId,
    manifestSha256,
    totalChapters: attempts.length,
    passCount,
    passRate: attempts.length === 0 ? 0 : passCount / attempts.length,
    entries: attempts.map((attempt) => ({
      chapterKey: attempt.chapterKey,
      attemptId: attempt.attemptId,
      candidateBytesSha256: attempt.candidateBytesSha256,
      executionEnvelopeSha256: attempt.executionEnvelopeSha256,
      finalStatus: attempt.finalStatus,
      pass: attempt.pass,
    })),
  };
  return deepFreeze(snapshot);
}

function sourceCategoryCount(record: ForwardValidationAttemptRecordV1, category: string): number {
  return record.source?.units.flatMap((unit) => unit.findings).filter((finding) => finding.category === category && (finding.severity === "blocker" || finding.severity === "major")).length ?? 0;
}

function accounting(
  first: readonly ForwardValidationAttemptRecordV1[],
  attempts: readonly ForwardValidationAttemptRecordV1[],
  finalByChapter: Readonly<Record<string, ForwardValidationAttemptRecordV1>>,
): ForwardAcceptanceAccountingV1 {
  const finals = Object.values(finalByChapter);
  const firstWritePassCount = first.filter((entry) => entry.pass).length;
  const finalPassCount = finals.filter((entry) => entry.pass).length;
  const sourceBlockers = finals.reduce((n, entry) => n + (entry.source?.blockingFindingIds.length ?? 0), 0);
  const quizBlockers = finals.reduce((n, entry) => n + (entry.quiz?.result === "BLOCK" ? 1 : 0), 0);
  const readerBlockers = finals.reduce((n, entry) => n + (entry.reader?.blockingFindings.length ?? 0), 0);
  const wrongKeys = finals.reduce((n, entry) => n + (entry.quiz?.questions.filter((q) => !q.keyCorrect).length ?? 0), 0);
  const causal = finals.reduce((n, entry) => n + (entry.source?.units.filter((unit) => unit.claimStrengthExpected === "causal" && unit.claimStrengthFit === false
    && unit.findings.some((finding) => finding.severity === "blocker" || finding.severity === "major")).length ?? 0), 0);
  const hardFailureReasons = attempts.flatMap((entry) => entry.failureReasons);
  const repairedKeys = new Set(attempts.filter((entry) => entry.stage !== "first-write").map((entry) => entry.chapterKey));
  return {
    totalChapters: first.length,
    firstWritePassCount,
    firstWritePassRate: first.length ? firstWritePassCount / first.length : 0,
    finalPassCount,
    finalPassRate: first.length ? finalPassCount / first.length : 0,
    finalSourceBlockers: sourceBlockers,
    finalQuizBlockers: quizBlockers,
    finalReaderHardBlockers: readerBlockers,
    wrongQuizKeys: wrongKeys,
    unsupportedSourceBoundInventedDetails: finals.reduce((n, entry) => n + sourceCategoryCount(entry, "invented_detail"), 0),
    misleadingConstructedFraming: finals.reduce((n, entry) => n + sourceCategoryCount(entry, "missing_visible_framing"), 0),
    genericHistoricalSpecificityLeaks: finals.reduce((n, entry) => n + sourceCategoryCount(entry, "generic_specificity_leak"), 0),
    unsupportedHighSeverityCausalClaims: causal,
    repairAttempts: attempts.filter((entry) => entry.stage === "repair").length,
    fullRegenerations: attempts.filter((entry) => entry.stage === "regeneration").length,
    chaptersRequiringContentRepair: repairedKeys.size,
    repeatedOrUnboundedRepair: Math.max(0, attempts.filter((entry) => entry.stage === "repair").length - new Set(attempts.filter((entry) => entry.stage === "repair").map((entry) => entry.chapterKey)).size),
    stateProvenanceSchemaFailures: attempts.filter((entry) => entry.failureClassification === "STATE_OR_PROVENANCE").length,
    unexpectedWrites: hardFailureReasons.filter((reason) => /unexpected workspace write/i.test(reason)).length,
    staleEvidenceAccepted: 0,
  };
}

function goldEvaluationProblems(
  manifest: Readonly<ForwardGoldManifestV1>,
  evaluation: ForwardGoldBookEvaluationV1,
  finalByChapter: Readonly<Record<string, ForwardValidationAttemptRecordV1>>,
): string[] {
  const problems: string[] = [];
  for (const [label, verdict] of Object.entries({
    technicalCompleteness: evaluation.technicalCompleteness,
    epistemicInstructionalSafety: evaluation.epistemicInstructionalSafety,
    ethicsReaderAutonomy: evaluation.ethicsReaderAutonomy,
    purposeAudienceDeclaration: evaluation.purposeAudienceDeclaration,
    externalAccuracy: evaluation.externalAccuracy,
  })) if (verdict !== "PASS") problems.push(`${label} is ${verdict}`);
  if (!Number.isFinite(evaluation.contentDesignScore) || evaluation.contentDesignScore < 80) problems.push(`Content Design Score ${evaluation.contentDesignScore} < 80`);
  if (!evaluation.evidenceBinding) problems.push("gold evaluation has no persisted evaluator/rater/sweep evidence binding");
  const sweep = evaluation.sweep;
  const bookId = manifest.targets[0]?.bookId;
  if (sweep.schemaVersion !== "sweep-attest-v1" || sweep.bookId !== bookId || sweep.verdict !== "PASS") problems.push("book sweep is not a PASS for the frozen gold book");
  for (const family of REQUIRED_SWEEP_FAMILIES) if (!sweep.checkedFamilies.includes(family)) problems.push(`book sweep omitted ${family}`);
  for (const target of manifest.targets) {
    const final = finalByChapter[chapterKey(target)];
    if (!final?.candidateContentSha256 || sweep.contentHashes[String(target.chapterNumber)] !== final.candidateContentSha256) {
      problems.push(`${chapterKey(target)}: sweep is stale against final content`);
    }
  }
  return problems;
}

function finalChapterContentHashes(
  manifest: Readonly<ForwardGoldManifestV1>,
  finalByChapter: Readonly<Record<string, ForwardValidationAttemptRecordV1>>,
): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const target of manifest.targets) {
    const hash = finalByChapter[chapterKey(target)]?.candidateContentSha256;
    requireCondition(nonEmpty(hash), `${chapterKey(target)}: final candidate content hash is missing`);
    hashes[String(target.chapterNumber)] = hash;
  }
  return hashes;
}

function goldEvaluatorPayloadSha256(evaluation: ForwardGoldBookEvaluationV1): string {
  return hashCanonical({
    technicalCompleteness: evaluation.technicalCompleteness,
    epistemicInstructionalSafety: evaluation.epistemicInstructionalSafety,
    ethicsReaderAutonomy: evaluation.ethicsReaderAutonomy,
    purposeAudienceDeclaration: evaluation.purposeAudienceDeclaration,
    externalAccuracy: evaluation.externalAccuracy,
    contentDesignScore: evaluation.contentDesignScore,
  });
}

function acceptanceProblems(
  manifest: Readonly<ForwardValidationManifestV1>,
  account: ForwardAcceptanceAccountingV1,
  finalByChapter: Readonly<Record<string, ForwardValidationAttemptRecordV1>>,
  goldEvaluation: ForwardGoldBookEvaluationV1 | null,
): string[] {
  const problems: string[] = [];
  const minimumFirst = manifest.kind === "pilot" ? 6 / 8 : 0.75;
  if (account.firstWritePassRate < minimumFirst) problems.push(`first-write pass rate ${account.firstWritePassRate} < ${minimumFirst}`);
  if (account.finalPassCount !== account.totalChapters) problems.push(`final PASS ${account.finalPassCount}/${account.totalChapters}`);
  for (const [label, count] of Object.entries({
    finalSourceBlockers: account.finalSourceBlockers,
    finalQuizBlockers: account.finalQuizBlockers,
    finalReaderHardBlockers: account.finalReaderHardBlockers,
    wrongQuizKeys: account.wrongQuizKeys,
    unsupportedSourceBoundInventedDetails: account.unsupportedSourceBoundInventedDetails,
    misleadingConstructedFraming: account.misleadingConstructedFraming,
    genericHistoricalSpecificityLeaks: account.genericHistoricalSpecificityLeaks,
    unsupportedHighSeverityCausalClaims: account.unsupportedHighSeverityCausalClaims,
    stateProvenanceSchemaFailures: account.stateProvenanceSchemaFailures,
    unexpectedWrites: account.unexpectedWrites,
    staleEvidenceAccepted: account.staleEvidenceAccepted,
    repeatedOrUnboundedRepair: account.repeatedOrUnboundedRepair,
  })) if (count !== 0) problems.push(`${label}=${count}`);
  for (const target of manifest.targets) {
    const final = finalByChapter[chapterKey(target)];
    if (final?.pass && (final.aggregate?.readerComposite ?? -1) < 80) problems.push(`${chapterKey(target)}: reader composite below 80`);
    if (final?.pass && final.executionEnvelope && final.executionEnvelope.finalStatus !== "PASS") problems.push(`${chapterKey(target)}: final envelope is not PASS`);
  }
  if (manifest.kind === "gold") {
    if (account.fullRegenerations / account.totalChapters > 0.25) problems.push("full regeneration demand exceeds 25%");
    if (account.chaptersRequiringContentRepair / account.totalChapters > 0.40) problems.push("content repair demand exceeds 40%");
    if (!goldEvaluation) problems.push("gold book evaluation was not produced");
    else problems.push(...goldEvaluationProblems(manifest, goldEvaluation, finalByChapter));
  }
  return problems;
}

/** Execute one frozen pilot or gold campaign. All first writes finish and their
 * denominator is durably frozen before the first repair/regeneration request. */
export async function runForwardValidationCampaign(
  frozen: FrozenForwardValidationManifestV1,
  deps: ForwardValidationCampaignDeps,
): Promise<ForwardValidationCampaignResultV1> {
  const manifest = frozen.manifest;
  assertManifest(manifest);
  requireCondition(hashCanonical(manifest) === frozen.manifestSha256, "forward-validation manifest hash is stale/tampered");
  requireCondition(typeof deps.produceCandidate === "function" && typeof deps.buildConductorInput === "function", "campaign requires candidate and conductor-input adapters");
  requireCondition(
    typeof deps.preserveAttempt === "function"
      && typeof deps.freezeFirstWriteMetrics === "function"
      && typeof deps.readPersistedEvidence === "function",
    "campaign requires durable evidence sinks with read-back",
  );

  const attempts: ForwardValidationAttemptRecordV1[] = [];
  const first: ForwardValidationAttemptRecordV1[] = [];
  const finalByChapter: Record<string, ForwardValidationAttemptRecordV1> = {};
  const hardFailures: string[] = [];
  const persistenceReceipts: ForwardPersistenceReceiptV1[] = [];

  const verifyPersistence = async (
    expectedKind: ForwardPersistenceReceiptV1["kind"],
    expectedSha256: string,
    receipt: ForwardPersistenceReceiptV1,
  ): Promise<unknown> => {
    requireCondition(receipt?.schema === FORWARD_PERSISTENCE_RECEIPT_SCHEMA, `${expectedKind}: sink returned no valid persistence receipt`);
    requireCondition(receipt.kind === expectedKind, `${expectedKind}: sink returned a receipt for ${receipt.kind}`);
    requireCondition(nonEmpty(receipt.storageId), `${expectedKind}: persistence receipt has no storage id`);
    requireCondition(receipt.contentSha256 === expectedSha256, `${expectedKind}: persistence receipt hash does not match the artifact`);
    const readBack = await deps.readPersistedEvidence(receipt);
    requireCondition(readBack !== undefined && readBack !== null, `${expectedKind}: durable read-back returned no artifact`);
    requireCondition(hashCanonical(readBack) === expectedSha256, `${expectedKind}: durable read-back hash does not match the artifact`);
    persistenceReceipts.push(deepFreeze(JSON.parse(JSON.stringify(receipt)) as ForwardPersistenceReceiptV1) as ForwardPersistenceReceiptV1);
    return readBack;
  };

  const verifyGoldEvidencePersistence = async (
    evaluation: ForwardGoldBookEvaluationV1,
    goldManifest: Readonly<ForwardGoldManifestV1>,
  ): Promise<void> => {
    const binding = evaluation.evidenceBinding;
    requireCondition(!!binding, "gold evaluation omitted its evidence binding");
    const expectedChapterHashes = finalChapterContentHashes(goldManifest, finalByChapter);
    requireCondition(hashCanonical(binding.finalChapterContentHashes) === hashCanonical(expectedChapterHashes),
      "gold evidence binding is stale against final chapter hashes");

    const refs: Array<{
      kind: "gold-evaluator" | "gold-rater" | "gold-sweep";
      ref: ForwardGoldPersistedEvidenceRefV1;
      expectedPayloadSha256: string;
    }> = [
      { kind: "gold-evaluator", ref: binding.evaluator, expectedPayloadSha256: goldEvaluatorPayloadSha256(evaluation) },
      ...binding.raters.map((ref) => ({ kind: "gold-rater" as const, ref, expectedPayloadSha256: ref.payloadSha256 })),
      { kind: "gold-sweep", ref: binding.sweep, expectedPayloadSha256: hashCanonical(evaluation.sweep) },
    ];
    requireCondition(binding.raters.length === 2, "gold evaluation requires exactly two isolated rater evidence records");
    const actorIds = refs.map(({ ref }) => ref.actorId);
    const executionIds = refs.map(({ ref }) => ref.executionId);
    const artifactHashes = refs.map(({ ref }) => ref.artifactSha256);
    const storageIds = refs.map(({ ref }) => ref.receipt.storageId);
    requireCondition(actorIds.every(nonEmpty) && new Set(actorIds).size === refs.length, "gold evaluator/raters/sweep must have independent actor ids");
    requireCondition(executionIds.every(nonEmpty) && new Set(executionIds).size === refs.length, "gold evaluator/raters/sweep must have independent execution ids");
    requireCondition(artifactHashes.every(nonEmpty) && new Set(artifactHashes).size === refs.length,
      "gold evaluator/raters/sweep evidence artifacts are not independent");
    requireCondition(storageIds.every(nonEmpty) && new Set(storageIds).size === refs.length,
      "gold evaluator/raters/sweep evidence receipts reuse durable storage ids");

    for (const { kind, ref, expectedPayloadSha256 } of refs) {
      requireCondition(ref.payloadSha256 === expectedPayloadSha256, `${kind}: payload hash does not match the evaluated result`);
      requireCondition(ref.receipt.kind === kind, `${kind}: wrong persistence receipt kind`);
      requireCondition(ref.receipt.contentSha256 === ref.artifactSha256, `${kind}: artifact/receipt hash mismatch`);
      const readBack = await verifyPersistence(kind, ref.artifactSha256, ref.receipt) as ForwardGoldEvidenceArtifactV1;
      requireCondition(readBack?.schema === FORWARD_GOLD_EVIDENCE_SCHEMA && readBack.kind === kind, `${kind}: wrong durable evidence schema/kind`);
      requireCondition(readBack.actorId === ref.actorId && readBack.executionId === ref.executionId, `${kind}: durable evidence identity mismatch`);
      requireCondition(readBack.payloadSha256 === expectedPayloadSha256, `${kind}: durable payload hash mismatch`);
      requireCondition(hashCanonical(readBack.finalChapterContentHashes) === hashCanonical(expectedChapterHashes),
        `${kind}: durable evidence is stale against final chapter hashes`);
    }
  };

  const preserve = async (record: ForwardValidationAttemptRecordV1): Promise<void> => {
    attempts.push(record);
    const frozenRecord = deepFreeze(JSON.parse(JSON.stringify(record)) as ForwardValidationAttemptRecordV1);
    const contentSha256 = hashCanonical(frozenRecord);
    const receipt = await deps.preserveAttempt(frozenRecord, contentSha256);
    await verifyPersistence("attempt", contentSha256, receipt);
  };

  const runOrResume = async (args: {
    target: ForwardValidationTargetV1;
    stage: ForwardCandidateStage;
    complaints?: string[];
    repairScopes?: string[];
    previous: ForwardValidationAttemptRecordV1 | null;
  }): Promise<ForwardValidationAttemptRecordV1> => {
    const resumed = await deps.loadPreservedAttempt?.({ target: args.target, stage: args.stage });
    if (resumed) {
      requireCondition(resumed.schema === FORWARD_ATTEMPT_RECORD_SCHEMA, `${chapterKey(args.target)}: resumed attempt schema drift`);
      requireCondition(resumed.chapterKey === chapterKey(args.target) && resumed.stage === args.stage,
        `${chapterKey(args.target)}: resumed attempt identity/stage drift`);
      requireCondition(resumed.attemptId === null || (resumed.attemptDir !== null && attemptEvidenceStillPresent(resumed)),
        `${chapterKey(args.target)}: resumed attempt evidence directory is missing`);
      return deepFreeze(JSON.parse(JSON.stringify(resumed)) as ForwardValidationAttemptRecordV1) as ForwardValidationAttemptRecordV1;
    }
    return runOneAttempt({
      manifest,
      manifestSha256: frozen.manifestSha256,
      target: args.target,
      stage: args.stage,
      complaints: args.complaints,
      repairScopes: args.repairScopes,
      previous: args.previous,
      deps,
    });
  };

  // Phase one: no finalization may run inside this loop.
  for (const target of manifest.targets) {
    const record = await runOrResume({ target, stage: "first-write", previous: null });
    first.push(record);
    finalByChapter[record.chapterKey] = record;
    await preserve(record);
  }
  const firstWriteSnapshot = frozenFirstWriteSnapshot(manifest, frozen.manifestSha256, first);
  const firstWriteSnapshotSha256 = hashCanonical(firstWriteSnapshot);
  const firstWriteReceipt = await deps.freezeFirstWriteMetrics(firstWriteSnapshot, firstWriteSnapshotSha256);
  await verifyPersistence("first-write-snapshot", firstWriteSnapshotSha256, firstWriteReceipt);

  // Phase two: one bounded route per failed chapter. A typed patch is not a
  // second authoring candidate; the only permitted repair→regen sequence is the
  // explicit wrong-route/whole-chapter exception.
  for (const target of manifest.targets) {
    const key = chapterKey(target);
    const firstRecord = finalByChapter[key];
    if (firstRecord.pass) continue;
    if (firstRecord.failureClassification === "STATE_OR_PROVENANCE") {
      hardFailures.push(`${key}: first-write failed state/provenance containment`);
      continue;
    }
    const route = deps.routeFirstFailure({ target, first: firstRecord });
    if (route.kind === "stop") {
      if (route.classification !== "CONTENT_SPECIFIC") hardFailures.push(`${key}: ${route.classification}: ${route.reason}`);
      continue;
    }
    if (route.kind === "regeneration") {
      const regen = await runOrResume({ target, stage: "regeneration", complaints: route.complaints, previous: firstRecord });
      await preserve(regen);
      finalByChapter[key] = regen;
      continue;
    }
    const repair = await runOrResume({ target, stage: "repair", complaints: route.complaints, repairScopes: route.scopes, previous: firstRecord });
    await preserve(repair);
    finalByChapter[key] = repair;
    if (repair.pass) continue;
    if (repair.failureClassification === "STATE_OR_PROVENANCE") {
      hardFailures.push(`${key}: repair failed state/provenance containment`);
      continue;
    }
    const disposition = deps.classifyFailedRepair({ target, first: firstRecord, repair });
    if (disposition === "INFRASTRUCTURE") {
      hardFailures.push(`${key}: repair infrastructure failure`);
      continue;
    }
    if (!FORWARD_REPAIR_POLICY.regenerationAfterRepairOnlyFor.includes(disposition as "WRONG_ROUTE" | "WHOLE_CHAPTER_FAILURE")) continue;
    const regen = await runOrResume({ target, stage: "regeneration", complaints: route.complaints, previous: repair });
    await preserve(regen);
    finalByChapter[key] = regen;
  }

  const account = accounting(first, attempts, finalByChapter);
  let goldEvaluation: ForwardGoldBookEvaluationV1 | null = null;
  if (manifest.kind === "gold" && Object.values(finalByChapter).every((record) => record.pass)) {
    requireCondition(typeof deps.evaluateGoldBook === "function", "gold campaign requires a book-evaluation/sweep adapter");
    goldEvaluation = await deps.evaluateGoldBook({ manifest, finalByChapter });
    try { await verifyGoldEvidencePersistence(goldEvaluation, manifest); }
    catch (error) { hardFailures.push(`gold evidence binding failed: ${(error as Error).message}`); }
  }
  hardFailures.push(...acceptanceProblems(manifest, account, finalByChapter, goldEvaluation));
  const uniqueHardFailures = sortedUnique(hardFailures);
  return {
    schema: FORWARD_VALIDATION_RESULT_SCHEMA,
    experimentId: manifest.experimentId,
    manifestSha256: frozen.manifestSha256,
    kind: manifest.kind,
    firstWriteSnapshot,
    firstWriteSnapshotSha256,
    attempts,
    finalByChapter,
    accounting: account,
    goldEvaluation,
    hardFailures: uniqueHardFailures,
    accepted: uniqueHardFailures.length === 0,
    capabilitiesUsed: FORWARD_VALIDATION_CAPABILITIES,
    persistenceReceipts,
  };
}

/** Convenience wrapper for a live driver that wants the real conductor without
 * weakening the campaign dependency type. */
export function realForwardConductor(deps: ForwardChapterConductorDeps): NonNullable<ForwardValidationCampaignDeps["conductCandidate"]> {
  return (input) => runForwardChapterConductor(input, deps);
}

/** Useful to evidence sinks that preserve an attempt directory by reference. */
export function attemptEvidenceStillPresent(record: ForwardValidationAttemptRecordV1): boolean {
  return record.attemptDir !== null && existsSync(record.attemptDir);
}
