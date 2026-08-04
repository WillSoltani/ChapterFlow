/**
 * IMP-20 WP-B7 — hermetic source-and-claim-integrity role corpus builder
 * (design H2/§J, R-3). UNLIKE reader/quiz, source cases are NOT mutations of
 * v21 packages (those are pre-source-v2 and carry no SourceUsePlanV1): every
 * source case is an evidence-complete OWNER INPUT — chapter unit + exact
 * source-use-plan unit + validated packet + validated sidecar + anchors +
 * expected origin/form/claim-strength + allowed/forbidden detail types + gold
 * chapter&source spans + provenance hashes.
 *
 * Fail-closed rules baked in (E-04 / E-09 / H2):
 *  - A unit whose sourceSemanticsStatus is not exactly PRESENT is EXCLUDED and
 *    recorded MISSING — source ORIGIN/FORM/CLAIM-STRENGTH are NEVER inferred
 *    from a synthesized planSpec (test 33). classifySourceUnit performs the
 *    classification with zero inference.
 *  - A PRESENT unit whose bookId is a diagnostic/confirmatory candidate FAILS
 *    CLOSED (H2) — a judge is never qualified on a book it will later author.
 *  - The builder HALTS (never shrinks) if the surviving evidence-complete count
 *    for any family is below expectedComposition (E-09 no-silent-drop).
 *
 * PURE: reads the injected mutation spec + ledger and RETURNS bytes; writes
 * nothing. Reads NO book package (units are owner-supplied evidence bundles).
 */

import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import type { SplitLaneCorpusConfigV1 } from "./reviewLaneTypes.js";
import type { SourceOriginV1, UnitFormV1, ClaimStrengthV1, SourceUsePlanUnitV1 } from "../../contracts/sourceUsePlan.js";
import type { SourceSidecarV2, TestableFact } from "../../source/sidecarSchema.js";
import { compileSourcePacketFromSidecar, sourcePacketHash } from "../../compiler/sourcePacket.js";
import { compileSourceUsePlan } from "../../compiler/sourceUsePlanCompiler.js";
import { sourceUsePlanHash } from "../../contracts/sourceUsePlan.js";
import { buildSourceAnchorCatalog, semanticSourceHash } from "../../source/sourceIntegrity.js";
import { validateSourceV2SidecarForPlanning } from "../../source/sourceEvidence.js";
import { sha256Hex } from "../../contracts/contractUtil.js";
import {
  CorpusBuildError,
  CORPUS_PARTITIONS_V2,
  CURATOR_DEVELOPMENT_LABEL,
  SPLIT_LANE_CORPUS_BUILDER_VERSION,
  SPLIT_LANE_CORPUS_BUILDER_V2_VERSION,
  SPLIT_LANE_CORPUS_PROVENANCE_SCHEMA,
  SPLIT_LANE_CORPUS_PROVENANCE_V2_SCHEMA,
  SPLIT_LANE_CORPUS_SCHEMA,
  SPLIT_LANE_CORPUS_V2_SCHEMA,
  SOURCE_SEMANTICS_MISSING,
  SOURCE_SEMANTICS_PRESENT,
  assertCandidateBookExcluded,
  assertComposition,
  assertCorpusConfigMatchesSpecV2,
  assertExactCompositionV2,
  assertGoldGovernance,
  assertGoldGovernanceV2,
  assertPortableCorpusSpecV2,
  canonicalPretty,
  hashValue,
  readCleanBaseScoreLedger,
  readCorpusSpecV2,
  readMutationSpec,
  type CorpusBuildResultV2,
  type CorpusBuildResultV1,
  type CorpusPartitionV2,
  type CorpusProvenanceManifestV1,
  type CorpusProvenanceManifestV2,
  type SourceUnitSpecV1,
  type SplitLaneCorpusPartitionEnvelopeV2,
  type SplitLaneCorpusSpecV2Base,
  type SplitLaneMutationSpecV1,
  type SplitLaneRoleCorpusV2,
  type SplitLaneRoleCorpusV1,
} from "./corpusBuilderCore.js";

// Frozen enum whitelists mirroring the compiler-owned SourceUsePlanV1 axes
// (src/contracts/sourceUsePlan.ts). Imported as TYPES; the runtime whitelist is
// module-private there, so it is re-stated here for owner-input validation.
const ORIGINS: readonly SourceOriginV1[] = ["source_bound", "constructed", "generic"];
const FORMS: readonly UnitFormV1[] = ["case", "application", "operational_scenario", "explanation", "analogy"];
const STRENGTHS: readonly ClaimStrengthV1[] = ["descriptive", "inferential", "correlational", "mechanistic", "causal"];

/** The evidence a PRESENT source unit MUST carry (design H2 "every case must
 *  include …"). A PRESENT unit missing any field FAILS CLOSED — the builder
 *  never fabricates the missing evidence. */
export const REQUIRED_SOURCE_EVIDENCE_FIELDS = [
  "chapterUnit",
  "sourceUsePlanUnit",
  "sourcePacket",
  "sidecar",
  "anchorCatalog",
  "expectedOrigin",
  "expectedForm",
  "claimStrengthExpected",
  "allowedDetailTypes",
  "forbiddenDetailTypes",
  "goldChapterEvidenceSpans",
  "goldSourceEvidenceSpans",
  "provenanceHashes",
] as const;

const REQUIRED_PROVENANCE_HASHES = ["chapterContentSha256", "sourceUsePlanSha256", "sourcePacketSha256", "sidecarSha256"] as const;

export type SourceUnitClassification = {
  unitSlotId: string;
  family: string;
  status: typeof SOURCE_SEMANTICS_PRESENT | typeof SOURCE_SEMANTICS_MISSING;
  reason: string;
};

/**
 * Classify a source unit slot by its DECLARED sourceSemanticsStatus alone — with
 * ZERO inference. Anything other than the exact PRESENT sentinel (including
 * OWNER_INPUT_PENDING or an absent value) is MISSING. The builder never reads a
 * chapter planSpec, never derives an origin, and never promotes a MISSING slot
 * (E-04 / test 33).
 */
export function classifySourceUnit(unit: SourceUnitSpecV1): SourceUnitClassification {
  const present = unit.sourceSemanticsStatus === SOURCE_SEMANTICS_PRESENT;
  return {
    unitSlotId: unit.unitSlotId,
    family: unit.family,
    status: present ? SOURCE_SEMANTICS_PRESENT : SOURCE_SEMANTICS_MISSING,
    reason: present
      ? "owner-declared source semantics PRESENT"
      : `source semantics absent (declared "${String(unit.sourceSemanticsStatus)}") — recorded MISSING, never inferred`,
  };
}

export type SourceCorpusCaseV1 = {
  caseId: string;
  role: "source";
  family: string;
  bookId: string;
  chapterNumber: number;
  sourceSemanticsStatus: typeof SOURCE_SEMANTICS_PRESENT;
  evidence: Record<string, unknown>;
  expected: Record<string, unknown>;
  provenance: {
    expectedOrigin: SourceOriginV1;
    expectedForm: UnitFormV1;
    claimStrengthExpected: ClaimStrengthV1;
    sourceUsePlanUnitId: string;
    provenanceHashes: Record<string, unknown>;
    evidenceSha256: string;
  };
};

export type SourceAssembly = {
  cases: SourceCorpusCaseV1[];
  generated: Record<string, number>;
  excluded: Array<{ unitSlotId: string; family: string; sourceSemanticsStatus: typeof SOURCE_SEMANTICS_MISSING; reason: string }>;
};

function assertEnum<T extends string>(value: unknown, whitelist: readonly T[], field: string, unitSlotId: string): T {
  if (typeof value !== "string" || !(whitelist as readonly string[]).includes(value)) {
    throw new CorpusBuildError(`source unit ${unitSlotId}: ${field} "${String(value)}" is not a valid ${field}`, { unitSlotId, field });
  }
  return value as T;
}

/** Assemble the PRESENT source cases, excluding MISSING units (recorded). Does
 *  NOT enforce composition (buildSourceCorpus does). H2 exclusion is enforced
 *  here immediately — a PRESENT candidate-book unit FAILS CLOSED. */
export function assembleSourceCases(spec: SplitLaneMutationSpecV1, config: SplitLaneCorpusConfigV1): SourceAssembly {
  const units = spec.units ?? [];
  if (units.length === 0) throw new CorpusBuildError("source spec carries no units", { corpusId: spec.corpusId });
  const familyGold = spec.familyGold ?? {};
  const excludedBooks = new Set([...(config.excludedCandidateBookIds ?? []), ...(spec.excludedCandidateBookIds ?? [])]);

  const cases: SourceCorpusCaseV1[] = [];
  const generated: Record<string, number> = {};
  const excluded: SourceAssembly["excluded"] = [];
  const seen = new Set<string>();

  for (const unit of units) {
    if (seen.has(unit.unitSlotId)) throw new CorpusBuildError(`duplicate source unitSlotId ${unit.unitSlotId}`, { unitSlotId: unit.unitSlotId });
    seen.add(unit.unitSlotId);

    const cls = classifySourceUnit(unit);
    if (cls.status === SOURCE_SEMANTICS_MISSING) {
      excluded.push({ unitSlotId: unit.unitSlotId, family: unit.family, sourceSemanticsStatus: SOURCE_SEMANTICS_MISSING, reason: cls.reason });
      continue;
    }

    // PRESENT: evidence must be complete (never fabricated), bookId must not be
    // a reserved candidate book (H2), enums must be valid, gold must exist.
    const evidence = unit.evidence;
    if (!evidence || typeof evidence !== "object") {
      throw new CorpusBuildError(`source unit ${unit.unitSlotId} is PRESENT but carries no evidence bundle`, { unitSlotId: unit.unitSlotId });
    }
    for (const f of REQUIRED_SOURCE_EVIDENCE_FIELDS) {
      if (evidence[f] === undefined || evidence[f] === null) {
        throw new CorpusBuildError(`source unit ${unit.unitSlotId} is PRESENT but missing required evidence field ${f}`, { unitSlotId: unit.unitSlotId, field: f });
      }
    }
    const bookId = typeof unit.bookId === "string" ? unit.bookId : undefined;
    if (!bookId) throw new CorpusBuildError(`source unit ${unit.unitSlotId} is PRESENT but declares no bookId`, { unitSlotId: unit.unitSlotId });
    if (excludedBooks.has(bookId)) {
      throw new CorpusBuildError(
        `source unit ${unit.unitSlotId} uses reserved candidate book "${bookId}" (H2) — a judge is never qualified on a book it will later author; the builder fails closed`,
        { unitSlotId: unit.unitSlotId, bookId, excludedCandidateBookIds: [...excludedBooks] },
      );
    }
    if (typeof unit.chapterNumber !== "number") throw new CorpusBuildError(`source unit ${unit.unitSlotId} declares no chapterNumber`, { unitSlotId: unit.unitSlotId });

    const expectedOrigin = assertEnum<SourceOriginV1>(evidence.expectedOrigin, ORIGINS, "expectedOrigin", unit.unitSlotId);
    const expectedForm = assertEnum<UnitFormV1>(evidence.expectedForm, FORMS, "expectedForm", unit.unitSlotId);
    const claimStrengthExpected = assertEnum<ClaimStrengthV1>(evidence.claimStrengthExpected, STRENGTHS, "claimStrengthExpected", unit.unitSlotId);

    const provHashes = evidence.provenanceHashes as Record<string, unknown>;
    for (const h of REQUIRED_PROVENANCE_HASHES) {
      if (typeof provHashes[h] !== "string" || (provHashes[h] as string).length === 0) {
        throw new CorpusBuildError(`source unit ${unit.unitSlotId} provenanceHashes.${h} must be a non-empty string`, { unitSlotId: unit.unitSlotId, hash: h });
      }
    }

    const gold = familyGold[unit.family];
    if (!gold) throw new CorpusBuildError(`source unit ${unit.unitSlotId} family "${unit.family}" has no familyGold entry`, { unitSlotId: unit.unitSlotId, family: unit.family });
    // Owner-supplied per-unit expected may not contradict the family gold.
    const expected = { ...gold, ...(unit.expected ?? {}) };

    const planUnit = evidence.sourceUsePlanUnit as SourceUsePlanUnitV1;
    cases.push({
      caseId: unit.unitSlotId,
      role: "source",
      family: unit.family,
      bookId,
      chapterNumber: unit.chapterNumber,
      sourceSemanticsStatus: SOURCE_SEMANTICS_PRESENT,
      evidence,
      expected,
      provenance: {
        expectedOrigin,
        expectedForm,
        claimStrengthExpected,
        sourceUsePlanUnitId: typeof planUnit?.unitId === "string" ? planUnit.unitId : unit.unitSlotId,
        provenanceHashes: provHashes,
        evidenceSha256: hashValue(evidence),
      },
    });
    generated[unit.family] = (generated[unit.family] ?? 0) + 1;
  }

  return { cases, generated, excluded };
}

/** Build the source corpus. FAIL CLOSED on missing spec/ledger, ungoverned gold,
 *  incomplete PRESENT evidence, an H2 candidate-book leak, or a per-family
 *  composition shortfall (evidence-complete owner units pending, R-3). */
export function buildSourceCorpus(config: SplitLaneCorpusConfigV1): CorpusBuildResultV1<SourceCorpusCaseV1> {
  if (config.role !== "source") throw new CorpusBuildError(`buildSourceCorpus requires role "source" (got ${config.role})`, { role: config.role });
  const spec = readMutationSpec(config.mutationSpecPath, "source");
  assertGoldGovernance(spec);
  const ledger = readCleanBaseScoreLedger(config.cleanBaseScoreLedgerPath);

  // Structural coherence: every declared paired family's positive AND negative
  // must be a bucket in expectedComposition, so the qualifier can compute paired
  // detection and enforce zero-miss on the negative side (H2).
  for (const pair of spec.pairedFamilies ?? []) {
    for (const side of [pair.positive, pair.negative]) {
      if (!(side in spec.expectedComposition)) {
        throw new CorpusBuildError(`paired family "${side}" is not declared in expectedComposition`, { side, pair });
      }
    }
  }

  const assembly = assembleSourceCases(spec, config);
  assertComposition(spec.expectedComposition, assembly.generated, "source", {
    corpusId: spec.corpusId,
    excludedUnits: assembly.excluded,
  });

  const corpus: SplitLaneRoleCorpusV1<SourceCorpusCaseV1> = {
    schema: SPLIT_LANE_CORPUS_SCHEMA,
    role: "source",
    corpusId: spec.corpusId,
    builderVersion: SPLIT_LANE_CORPUS_BUILDER_VERSION,
    sourceCorpus: "evidence-complete owner-input source units (chapter + exact plan unit + packet + sidecar + anchors + gold spans + provenance)",
    independentHumanRater: false,
    minRenderBytes: config.minRenderBytes,
    expectedComposition: spec.expectedComposition,
    generatedComposition: assembly.generated,
    softDenominators: spec.softDenominators ?? {},
    zeroMissCategories: spec.zeroMissCategories ?? [],
    pairedFamilies: spec.pairedFamilies ?? [],
    cases: [...assembly.cases].sort((a, b) => a.caseId.localeCompare(b.caseId)),
  };

  const corpusSha256 = hashValue(corpus);
  const provenanceManifest: CorpusProvenanceManifestV1 = {
    schema: SPLIT_LANE_CORPUS_PROVENANCE_SCHEMA,
    role: "source",
    corpusId: spec.corpusId,
    builderVersion: SPLIT_LANE_CORPUS_BUILDER_VERSION,
    mutationSpecSha256: hashValue(spec),
    cleanBaseScoreLedgerSha256: hashValue(ledger),
    minRenderBytes: config.minRenderBytes,
    independentHumanRater: false,
    governance: spec.governance,
    expectedComposition: spec.expectedComposition,
    generatedComposition: assembly.generated,
    softDenominators: spec.softDenominators ?? {},
    cleanBases: [],
    cases: corpus.cases.map((c) => ({
      caseId: c.caseId,
      family: c.family,
      bookId: c.bookId,
      chapterNumber: c.chapterNumber,
      sourceSemanticsStatus: c.sourceSemanticsStatus,
      expectedOrigin: c.provenance.expectedOrigin,
      expectedForm: c.provenance.expectedForm,
      claimStrengthExpected: c.provenance.claimStrengthExpected,
      provenanceHashes: c.provenance.provenanceHashes,
      evidenceSha256: c.provenance.evidenceSha256,
      expected: c.expected,
    })),
    excludedUnits: assembly.excluded,
    zeroMissCategories: spec.zeroMissCategories ?? [],
    pairedFamilies: spec.pairedFamilies ?? [],
    corpusSha256,
  };

  return { corpus, provenanceManifest, corpusBytes: canonicalPretty(corpus) };
}

// ── IMP-22 forward-only v2 paired source corpus ──────────────────────────────

type Imp22SourceSnapshotV2 = {
  bookId: string;
  chapterNumber: number;
  relativePath: string;
  archiveOrigin: string;
  archiveRawSha256: string;
  basePackage: string;
  basePackageRawSha256: string;
};

type Imp22SourcePartitionRuleV2 = {
  calibrationFactIds: string[];
  holdoutFactIds: string[];
  noFactIdAppearsInBothPartitions: true;
};

type Imp22SourceFamilyPairV2 = {
  pairId: string;
  positive: string;
  negative: string;
  origin: SourceOriginV1;
  form: UnitFormV1;
  claimStrength?: ClaimStrengthV1;
  detailSufficiency?: "full" | "partial" | "concept_only";
  framingRequired?: boolean;
  cleanVisibleRegister: string;
  defectVisibleRegister: string;
  cleanSupportStatus: string;
  defectSupportStatus: string;
  defectCategory: string;
  cleanTemplate: string;
  defectTemplate?: string;
  defectAppend?: string;
  contradictionFactIds?: string[];
  contradictionTemplate?: string;
  mutationPaths: ["chapterUnit"];
};

type Imp22SourceCorpusSpecV2 = SplitLaneCorpusSpecV2Base & {
  role: "source";
  sourceSnapshot: Imp22SourceSnapshotV2;
  baseFactIds: string[];
  partitionRule: Imp22SourcePartitionRuleV2;
  pairedFamilies: Imp22SourceFamilyPairV2[];
  requiredEvidenceFields: string[];
};

export type Imp22SourceMutationManifestV2 = {
  schema: "imp22-source-controlled-mutation-v1";
  pairKey: string;
  cleanCaseId: string;
  defectCaseId: string;
  declaredMutationPaths: ["chapterUnit"];
  cleanChapterUnitSha256: string;
  defectChapterUnitSha256: string;
  protectedProjectionSha256: string;
};

export type Imp22SourceCorpusCaseV2 = {
  caseId: string;
  role: "source";
  partition: CorpusPartitionV2;
  family: string;
  pairId: string;
  pairSide: "clean" | "defect";
  pairedCaseId: string;
  bookId: string;
  chapterNumber: number;
  sourceSemanticsStatus: typeof SOURCE_SEMANTICS_PRESENT;
  evidence: {
    chapterUnit: string;
    sourceUsePlan: ReturnType<typeof compileSourceUsePlan>["plan"];
    sourceUsePlanUnit: SourceUsePlanUnitV1;
    sourcePacket: ReturnType<typeof compileSourcePacketFromSidecar>;
    sidecar: SourceSidecarV2;
    anchorCatalog: ReturnType<typeof buildSourceAnchorCatalog>;
    anchorIds: string[];
    expectedOrigin: SourceOriginV1;
    expectedForm: UnitFormV1;
    claimStrengthExpected: ClaimStrengthV1;
    detailSufficiency: SourceUsePlanUnitV1["detailSufficiency"];
    allowedDetailTypes: string[];
    forbiddenDetailTypes: string[];
    visibleFramingRequired: boolean;
    goldChapterEvidenceSpans: string[];
    goldSourceEvidenceSpans: string[];
    provenanceHashes: {
      chapterContentSha256: string;
      sourceUsePlanSha256: string;
      sourcePacketSha256: string;
      sidecarSha256: string;
      anchorCatalogSha256: string;
      sourceSnapshotRawSha256: string;
      basePackageRawSha256: string;
    };
    protectedProjectionSha256: string;
  };
  expected: {
    goldResult: "PASS" | "BLOCK";
    expectedVisibleRegister: string;
    expectedSupportStatus: string;
    expectedCategory: string | null;
    expectedFramingAdequate: boolean | null;
    expectedClaimStrengthFit: boolean | null;
    expectedNamedSpecificityAllowed: boolean | null;
  };
  mutation: Imp22SourceMutationManifestV2;
  provenance: {
    labelProvenance: typeof CURATOR_DEVELOPMENT_LABEL;
    ownerApprovedForDevelopmentBakeoff: true;
    independentHumanRater: false;
    baseFactId: string;
    sourceUsePlanUnitId: string;
    pairKey: string;
    evidenceSha256: string;
  };
};

function requireString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CorpusBuildError(`IMP-22 source spec: ${where} must be a non-empty string`, { where });
  }
  return value;
}

function fillSourceTemplate(template: string, fact: TestableFact): string {
  const claimLower = fact.claim.length > 0
    ? fact.claim.charAt(0).toLowerCase() + fact.claim.slice(1)
    : fact.claim;
  return template
    .split("{{claim}}").join(fact.claim)
    .split("{{claimLower}}").join(claimLower)
    .split("{{mechanism}}").join(fact.becauseMechanism)
    .split("{{commonError}}").join(fact.commonError)
    .split("{{errorIsWhy}}").join(fact.errorIsWhy)
    .trim();
}

function safeCaseToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sourcePlanUnitForPair(
  pair: Imp22SourceFamilyPairV2,
  fact: TestableFact,
  plan: ReturnType<typeof compileSourceUsePlan>["plan"],
): SourceUsePlanUnitV1 {
  const unitId =
    pair.origin === "constructed"
      ? `unit.ch${String(plan.chapterNumber).padStart(2, "0")}.constructed-application`
      : pair.origin === "generic"
        ? `unit.ch${String(plan.chapterNumber).padStart(2, "0")}.generic-scenario`
        : `unit.fact.${fact.id}`;
  const unit = plan.units.find((candidate) => candidate.unitId === unitId);
  if (!unit) {
    throw new CorpusBuildError(`IMP-22 source pair ${pair.pairId}: compiled plan has no unit ${unitId}`, {
      pairId: pair.pairId,
      unitId,
    });
  }
  if (unit.origin !== pair.origin || unit.form !== pair.form) {
    throw new CorpusBuildError(
      `IMP-22 source pair ${pair.pairId}: declared ${pair.origin}/${pair.form} contradicts compiler-owned ${unit.origin}/${unit.form}`,
      { pairId: pair.pairId, declaredOrigin: pair.origin, declaredForm: pair.form, unit },
    );
  }
  if (pair.claimStrength && unit.claimStrength !== pair.claimStrength) {
    throw new CorpusBuildError(
      `IMP-22 source pair ${pair.pairId}: declared claimStrength ${pair.claimStrength} contradicts compiler-owned ${unit.claimStrength}`,
      { pairId: pair.pairId, unit },
    );
  }
  if (pair.detailSufficiency && unit.detailSufficiency !== pair.detailSufficiency) {
    throw new CorpusBuildError(
      `IMP-22 source pair ${pair.pairId}: declared detailSufficiency ${pair.detailSufficiency} contradicts compiler-owned ${unit.detailSufficiency}`,
      { pairId: pair.pairId, unit },
    );
  }
  if (pair.framingRequired !== undefined && unit.framingRequired !== pair.framingRequired) {
    throw new CorpusBuildError(
      `IMP-22 source pair ${pair.pairId}: declared framingRequired ${pair.framingRequired} contradicts compiler-owned ${unit.framingRequired}`,
      { pairId: pair.pairId, unit },
    );
  }
  return unit;
}

function generatedComposition(cases: readonly Imp22SourceCorpusCaseV2[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cases) out[c.family] = (out[c.family] ?? 0) + 1;
  out.total = cases.length;
  return out;
}

/** Build the additive IMP-22 source corpus from a byte-preserved authoritative
 * source-v2 snapshot. Five facts are crossed with five frozen family recipes:
 * fact 1 is calibration, facts 2-5 are holdout. Each clean case has exactly one
 * controlled defect twin; packet/plan/sidecar/anchor evidence is identical
 * across the pair and protected by a shared projection hash. */
export function buildImp22SourceCorpus(
  config: SplitLaneCorpusConfigV1,
): CorpusBuildResultV2<Imp22SourceCorpusCaseV2> {
  if (config.role !== "source") {
    throw new CorpusBuildError(`buildImp22SourceCorpus requires role "source" (got ${config.role})`, { role: config.role });
  }
  const common = readCorpusSpecV2(config.mutationSpecPath, "source");
  const spec = common as Imp22SourceCorpusSpecV2;
  assertCorpusConfigMatchesSpecV2(spec, config);
  assertGoldGovernanceV2(spec);
  assertPortableCorpusSpecV2(spec);
  if (!spec.sourceSnapshot || !Array.isArray(spec.baseFactIds) || !Array.isArray(spec.pairedFamilies)) {
    throw new CorpusBuildError("IMP-22 source spec is missing sourceSnapshot/baseFactIds/pairedFamilies", { corpusId: spec.corpusId });
  }
  if (spec.baseFactIds.length !== 5 || spec.pairedFamilies.length !== 5) {
    throw new CorpusBuildError("IMP-22 source corpus requires exactly five base facts and five paired families", {
      baseFacts: spec.baseFactIds.length,
      pairedFamilies: spec.pairedFamilies.length,
    });
  }

  const exclusions = [...new Set([
    ...(spec.excludedCandidateBookIds ?? []),
    ...(config.excludedCandidateBookIds ?? []),
  ])].sort();
  assertCandidateBookExcluded(spec.sourceSnapshot.bookId, exclusions, spec.corpusId);

  const snapshotPath = resolve(dirname(config.mutationSpecPath), requireString(spec.sourceSnapshot.relativePath, "sourceSnapshot.relativePath"));
  const snapshotBytes = readFileSync(snapshotPath);
  const snapshotRawSha256 = sha256Hex(snapshotBytes);
  if (snapshotRawSha256 !== spec.sourceSnapshot.archiveRawSha256) {
    throw new CorpusBuildError("IMP-22 source snapshot raw hash does not match the frozen archive hash", {
      snapshotPath,
      expected: spec.sourceSnapshot.archiveRawSha256,
      actual: snapshotRawSha256,
    });
  }
  let sidecar: SourceSidecarV2;
  try {
    sidecar = JSON.parse(snapshotBytes.toString("utf8")) as SourceSidecarV2;
  } catch (error) {
    throw new CorpusBuildError(`IMP-22 source snapshot is not JSON: ${(error as Error).message}`, { snapshotPath });
  }
  const sidecarErrors = validateSourceV2SidecarForPlanning(sidecar, spec.sourceSnapshot.chapterNumber);
  if (sidecarErrors.length > 0) {
    throw new CorpusBuildError(`IMP-22 source snapshot fails source-v2 validation: ${sidecarErrors.join("; ")}`, { snapshotPath });
  }
  if (sidecar.chapterNumber !== spec.sourceSnapshot.chapterNumber) {
    throw new CorpusBuildError("IMP-22 source snapshot chapterNumber drift", {
      expected: spec.sourceSnapshot.chapterNumber,
      actual: sidecar.chapterNumber,
    });
  }

  const packagePath = resolve(config.sourceRoots.bookPackagesDir, basename(requireString(spec.sourceSnapshot.basePackage, "sourceSnapshot.basePackage")));
  const packageRawSha256 = sha256Hex(readFileSync(packagePath));
  if (packageRawSha256 !== spec.sourceSnapshot.basePackageRawSha256) {
    throw new CorpusBuildError("IMP-22 source base package raw hash drift", {
      packagePath,
      expected: spec.sourceSnapshot.basePackageRawSha256,
      actual: packageRawSha256,
    });
  }

  const packet = compileSourcePacketFromSidecar({
    bookId: spec.sourceSnapshot.bookId,
    chapter: {
      chapterId: `${spec.sourceSnapshot.bookId}-ch${String(spec.sourceSnapshot.chapterNumber).padStart(2, "0")}`,
      chapterNumber: spec.sourceSnapshot.chapterNumber,
      chapterTitle: sidecar.chapterTitle,
    } as never,
    sidecar,
    sidecarPath: spec.sourceSnapshot.relativePath,
    sourceHash: snapshotRawSha256,
  });
  const compiled = compileSourceUsePlan(packet);
  if (compiled.findings.length > 0) {
    throw new CorpusBuildError(`IMP-22 source plan compilation produced unresolved findings: ${compiled.findings.join("; ")}`, {
      findings: compiled.findings,
    });
  }
  const plan = compiled.plan;
  const anchorCatalog = buildSourceAnchorCatalog(sidecar);
  const packetSha = sourcePacketHash(packet);
  const planSha = sourceUsePlanHash(plan);
  const sidecarSha = semanticSourceHash(sidecar);
  const anchorSha = hashValue(anchorCatalog);

  const calibrationIds = new Set(spec.partitionRule?.calibrationFactIds ?? []);
  const holdoutIds = new Set(spec.partitionRule?.holdoutFactIds ?? []);
  if (spec.partitionRule?.noFactIdAppearsInBothPartitions !== true) {
    throw new CorpusBuildError("IMP-22 source partition rule must prohibit calibration/holdout overlap", { corpusId: spec.corpusId });
  }
  for (const id of calibrationIds) {
    if (holdoutIds.has(id)) throw new CorpusBuildError(`IMP-22 source fact ${id} appears in calibration and holdout`, { id });
  }
  const declaredIds = new Set([...calibrationIds, ...holdoutIds]);
  if (declaredIds.size !== spec.baseFactIds.length || spec.baseFactIds.some((id) => !declaredIds.has(id))) {
    throw new CorpusBuildError("IMP-22 source partition rule does not cover exactly the frozen baseFactIds", {
      baseFactIds: spec.baseFactIds,
      calibrationFactIds: [...calibrationIds],
      holdoutFactIds: [...holdoutIds],
    });
  }

  const facts = new Map(sidecar.testableFacts.map((fact) => [fact.id, fact]));
  const cases: Imp22SourceCorpusCaseV2[] = [];
  const seenPairs = new Set<string>();
  for (const factId of spec.baseFactIds) {
    const fact = facts.get(factId);
    if (!fact) throw new CorpusBuildError(`IMP-22 source snapshot is missing base fact ${factId}`, { factId });
    const partition: CorpusPartitionV2 = calibrationIds.has(factId) ? "calibration" : "holdout";

    for (const pair of spec.pairedFamilies) {
      requireString(pair.pairId, "pairedFamilies[].pairId");
      requireString(pair.positive, `${pair.pairId}.positive`);
      requireString(pair.negative, `${pair.pairId}.negative`);
      if (pair.mutationPaths?.length !== 1 || pair.mutationPaths[0] !== "chapterUnit") {
        throw new CorpusBuildError(`IMP-22 source pair ${pair.pairId} may mutate only chapterUnit`, { pairId: pair.pairId });
      }
      const pairKey = `${pair.pairId}::${fact.id}`;
      if (seenPairs.has(pairKey)) throw new CorpusBuildError(`duplicate IMP-22 source pair ${pairKey}`, { pairKey });
      seenPairs.add(pairKey);

      const planUnit = sourcePlanUnitForPair(pair, fact, plan);
      const cleanUnit = fillSourceTemplate(pair.cleanTemplate, fact);
      const isSourceContradiction = pair.contradictionFactIds?.includes(fact.id) === true;
      const selectedDefectTemplate = isSourceContradiction
        ? requireString(pair.contradictionTemplate, `${pair.pairId}.contradictionTemplate`)
        : pair.defectTemplate;
      const defectCategory = isSourceContradiction ? "source_contradiction" : pair.defectCategory;
      const defectUnit = selectedDefectTemplate
        ? fillSourceTemplate(selectedDefectTemplate, fact)
        : `${cleanUnit}${requireString(pair.defectAppend, `${pair.pairId}.defectAppend`)}`;
      if (cleanUnit === defectUnit) {
        throw new CorpusBuildError(`IMP-22 source pair ${pairKey} mutation is byte-identical`, { pairKey });
      }

      const token = `${safeCaseToken(pair.pairId)}-${safeCaseToken(fact.id)}`;
      const cleanCaseId = `SOURCE-${partition.toUpperCase()}-${token}-clean`;
      const defectCaseId = `SOURCE-${partition.toUpperCase()}-${token}-defect`;
      const protectedProjectionSha256 = hashValue({
        bookId: spec.sourceSnapshot.bookId,
        chapterNumber: spec.sourceSnapshot.chapterNumber,
        fact,
        sourceUsePlan: plan,
        sourceUsePlanUnit: planUnit,
        sourcePacketSha256: packetSha,
        sidecarSha256: sidecarSha,
        anchorCatalogSha256: anchorSha,
      });
      const mutation: Imp22SourceMutationManifestV2 = {
        schema: "imp22-source-controlled-mutation-v1",
        pairKey,
        cleanCaseId,
        defectCaseId,
        declaredMutationPaths: ["chapterUnit"],
        cleanChapterUnitSha256: sha256Hex(cleanUnit),
        defectChapterUnitSha256: sha256Hex(defectUnit),
        protectedProjectionSha256,
      };

      const makeCase = (
        pairSide: "clean" | "defect",
        family: string,
        chapterUnit: string,
        pairedCaseId: string,
      ): Imp22SourceCorpusCaseV2 => {
        const defect = pairSide === "defect";
        const evidence = {
          chapterUnit,
          sourceUsePlan: plan,
          sourceUsePlanUnit: planUnit,
          sourcePacket: packet,
          sidecar,
          anchorCatalog,
          anchorIds: [...planUnit.anchorIds],
          expectedOrigin: planUnit.origin,
          expectedForm: planUnit.form,
          claimStrengthExpected: planUnit.claimStrength,
          detailSufficiency: planUnit.detailSufficiency,
          allowedDetailTypes: [...planUnit.allowedDetailTypes],
          forbiddenDetailTypes: [...planUnit.forbiddenDetailTypes],
          visibleFramingRequired: planUnit.framingRequired,
          goldChapterEvidenceSpans: [chapterUnit.slice(0, 200)],
          goldSourceEvidenceSpans: [fact.claim, fact.becauseMechanism],
          provenanceHashes: {
            chapterContentSha256: sha256Hex(chapterUnit),
            sourceUsePlanSha256: planSha,
            sourcePacketSha256: packetSha,
            sidecarSha256: sidecarSha,
            anchorCatalogSha256: anchorSha,
            sourceSnapshotRawSha256: snapshotRawSha256,
            basePackageRawSha256: packageRawSha256,
          },
          protectedProjectionSha256,
        };
        return {
          caseId: pairSide === "clean" ? cleanCaseId : defectCaseId,
          role: "source",
          partition,
          family,
          pairId: pair.pairId,
          pairSide,
          pairedCaseId,
          bookId: spec.sourceSnapshot.bookId,
          chapterNumber: spec.sourceSnapshot.chapterNumber,
          sourceSemanticsStatus: SOURCE_SEMANTICS_PRESENT,
          evidence,
          expected: {
            goldResult: defect ? "BLOCK" : "PASS",
            expectedVisibleRegister: defect ? pair.defectVisibleRegister : pair.cleanVisibleRegister,
            expectedSupportStatus: defect ? pair.defectSupportStatus : pair.cleanSupportStatus,
            expectedCategory: defect ? defectCategory : null,
            expectedFramingAdequate: planUnit.framingRequired
              ? !(defect && defectCategory === "missing_visible_framing")
              : null,
            expectedClaimStrengthFit: planUnit.origin === "source_bound"
              ? !(defect && defectCategory === "claim_strength_overreach")
              : null,
            expectedNamedSpecificityAllowed: planUnit.origin === "generic"
              ? !(defect && defectCategory === "generic_specificity_leak")
              : null,
          },
          mutation,
          provenance: {
            labelProvenance: CURATOR_DEVELOPMENT_LABEL,
            ownerApprovedForDevelopmentBakeoff: true,
            independentHumanRater: false,
            baseFactId: fact.id,
            sourceUsePlanUnitId: planUnit.unitId,
            pairKey,
            evidenceSha256: hashValue(evidence),
          },
        };
      };

      cases.push(
        makeCase("clean", pair.positive, cleanUnit, defectCaseId),
        makeCase("defect", pair.negative, defectUnit, cleanCaseId),
      );
    }
  }

  const byPartition = Object.fromEntries(
    CORPUS_PARTITIONS_V2.map((partition) => [
      partition,
      cases.filter((c) => c.partition === partition).sort((a, b) => a.caseId.localeCompare(b.caseId)),
    ]),
  ) as Record<CorpusPartitionV2, Imp22SourceCorpusCaseV2[]>;
  for (const partition of CORPUS_PARTITIONS_V2) {
    const generated = generatedComposition(byPartition[partition]);
    assertExactCompositionV2(
      spec.expectedCompositionByPartition[partition],
      generated,
      partition,
      "source corpus",
    );
  }

  const ledger = readCleanBaseScoreLedger(config.cleanBaseScoreLedgerPath);
  const specSha256 = hashValue(spec);
  const ledgerSha256 = hashValue(ledger);
  const exclusionSha256 = hashValue(exclusions);
  const partitions = Object.fromEntries(
    CORPUS_PARTITIONS_V2.map((partition) => {
      const partitionCases = byPartition[partition];
      const envelope: SplitLaneCorpusPartitionEnvelopeV2<Imp22SourceCorpusCaseV2> = {
        partition,
        expectedComposition: spec.expectedCompositionByPartition[partition],
        generatedComposition: generatedComposition(partitionCases),
        cases: partitionCases,
        substantivePartitionSha256: hashValue(partitionCases),
      };
      return [partition, envelope];
    }),
  ) as Record<CorpusPartitionV2, SplitLaneCorpusPartitionEnvelopeV2<Imp22SourceCorpusCaseV2>>;
  const substantiveCorpusSha256 = hashValue({
    role: "source",
    corpusId: spec.corpusId,
    specSha256,
    ledgerSha256,
    exclusionSha256,
    calibration: partitions.calibration.substantivePartitionSha256,
    holdout: partitions.holdout.substantivePartitionSha256,
  });
  const corpus: SplitLaneRoleCorpusV2<Imp22SourceCorpusCaseV2> = {
    schema: SPLIT_LANE_CORPUS_V2_SCHEMA,
    role: "source",
    corpusId: spec.corpusId,
    builderVersion: SPLIT_LANE_CORPUS_BUILDER_V2_VERSION,
    labelProvenance: CURATOR_DEVELOPMENT_LABEL,
    ownerApprovedForDevelopmentBakeoff: true,
    independentHumanRater: false,
    specSha256,
    cleanBaseScoreLedgerSha256: ledgerSha256,
    excludedCandidateBookIds: exclusions,
    excludedCandidateBookIdsSha256: exclusionSha256,
    partitions,
    substantiveCorpusSha256,
  };
  const corpusBytes = canonicalPretty(corpus);
  const provenanceManifest: CorpusProvenanceManifestV2 = {
    schema: SPLIT_LANE_CORPUS_PROVENANCE_V2_SCHEMA,
    role: "source",
    corpusId: spec.corpusId,
    builderVersion: SPLIT_LANE_CORPUS_BUILDER_V2_VERSION,
    labelProvenance: CURATOR_DEVELOPMENT_LABEL,
    ownerApprovedForDevelopmentBakeoff: true,
    independentHumanRater: false,
    specSha256,
    cleanBaseScoreLedgerSha256: ledgerSha256,
    excludedCandidateBookIds: exclusions,
    excludedCandidateBookIdsSha256: exclusionSha256,
    partitionSha256: {
      calibration: partitions.calibration.substantivePartitionSha256,
      holdout: partitions.holdout.substantivePartitionSha256,
    },
    caseSha256: Object.fromEntries(cases.map((c) => [c.caseId, hashValue(c)])),
    substantiveCorpusSha256,
    corpusBytesSha256: `sha256:${sha256Hex(corpusBytes)}`,
  };
  return { corpus, provenanceManifest, corpusBytes };
}
