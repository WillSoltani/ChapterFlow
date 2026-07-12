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

import type { SplitLaneCorpusConfigV1 } from "./reviewLaneTypes.js";
import type { SourceOriginV1, UnitFormV1, ClaimStrengthV1, SourceUsePlanUnitV1 } from "../../contracts/sourceUsePlan.js";
import {
  CorpusBuildError,
  SPLIT_LANE_CORPUS_BUILDER_VERSION,
  SPLIT_LANE_CORPUS_PROVENANCE_SCHEMA,
  SPLIT_LANE_CORPUS_SCHEMA,
  SOURCE_SEMANTICS_MISSING,
  SOURCE_SEMANTICS_PRESENT,
  assertComposition,
  assertGoldGovernance,
  canonicalPretty,
  hashValue,
  readCleanBaseScoreLedger,
  readMutationSpec,
  type CorpusBuildResultV1,
  type CorpusProvenanceManifestV1,
  type SourceUnitSpecV1,
  type SplitLaneMutationSpecV1,
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
