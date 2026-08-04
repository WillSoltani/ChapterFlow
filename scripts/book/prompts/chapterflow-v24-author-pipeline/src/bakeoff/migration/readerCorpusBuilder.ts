/**
 * IMP-20 WP-B7 — hermetic reader-experience role corpus builder (design H1/§J).
 *
 * Builds a reader-lane qualification corpus of complete chapters from the 8
 * ledgered clean bases: 12 clean controls (admitted by a role-specific audit —
 * structural admission + the data-enforced ledger floor/gates, NOT a high total
 * score), 8 reader-visible hard blockers (owner-authored gold ops), and 10
 * non-blocking craft weaknesses (builder-minted benign appends). Clean-ness of a
 * base is the ledger label; the reader lane's blocker/contradiction judgments are
 * SEMANTIC gold declared by the owner spec, never inferred here.
 *
 * PURE: reads the injected roots and RETURNS bytes; writes nothing. FAILS CLOSED
 * (never shrinks) when an owner-authored variant's gold ops are still pending or
 * a base cannot be admitted (design R-3; test-33-adjacent no-silent-[] rule).
 */

import type { ChapterV21 } from "../../types.js";
import { sha256Hex } from "../../contracts/contractUtil.js";
import type { SplitLaneCorpusConfigV1 } from "./reviewLaneTypes.js";
import { admitChapter } from "./nativeReviewQualification.js";
import {
  CURATOR_DEVELOPMENT_LABEL,
  CorpusBuildError,
  SPLIT_LANE_CORPUS_BUILDER_VERSION,
  SPLIT_LANE_CORPUS_BUILDER_V2_VERSION,
  SPLIT_LANE_CORPUS_PROVENANCE_SCHEMA,
  SPLIT_LANE_CORPUS_PROVENANCE_V2_SCHEMA,
  SPLIT_LANE_CORPUS_SCHEMA,
  SPLIT_LANE_CORPUS_V2_SCHEMA,
  SOURCE_SEMANTICS_MISSING,
  applyMutationOps,
  assertCandidateBookExcluded,
  assertComposition,
  assertCorpusConfigMatchesSpecV2,
  assertExactCandidateExclusionsV2,
  assertExactCompositionV2,
  assertGoldGovernance,
  assertGoldGovernanceV2,
  assertPortableCorpusSpecV2,
  assertProtectedContentUnchanged,
  canonicalPretty,
  chapterContentHash,
  cloneChapterAs,
  hashValue,
  loadAdmittedBase,
  readCleanBaseScoreLedger,
  readCorpusSpecV2,
  readMutationSpec,
  type CleanBaseScoreLedgerV1,
  type CorpusBuildResultV2,
  type CorpusBuildResultV1,
  type CorpusPartitionV2,
  type CorpusProvenanceManifestV1,
  type CuratorDevelopmentProvenanceV2,
  type CorpusVariantSpecV1,
  type MutationOpV1,
  type SplitLaneCorpusSpecV2Base,
  type SplitLaneRoleCorpusV2,
  type SplitLaneMutationSpecV1,
  type SplitLaneRoleCorpusV1,
} from "./corpusBuilderCore.js";

const READER_KINDS = ["clean", "reader-visible-hard-blocker", "craft-nonblocker"] as const;
type ReaderKind = (typeof READER_KINDS)[number];

export type ReaderCorpusCaseV1 = {
  caseId: string;
  role: "reader";
  kind: ReaderKind;
  baseBookId: string;
  baseChapter: number;
  chapter: ChapterV21;
  expected: Record<string, unknown>;
  /** reader cases never carry source semantics — they cannot judge source truth. */
  sourceSemanticsStatus: typeof SOURCE_SEMANTICS_MISSING;
  requiresPhase2: false;
  provenance: {
    mutationSource: "unmutated" | "builder-generated" | "owner-authored";
    baseContentSha256: string;
    variantContentSha256: string;
    chapterContentSha256: string;
    mutationOps: CorpusVariantSpecV1["ops"];
    cleanBaseScore: number;
    cleanBaseGates: { epistemic: string; ethics: string; externalAccuracy: string };
    renderedBytes: number;
    shipAdvisoryClean: boolean;
    shipAdvisoryBlockers: string[];
    goldRationale: string | null;
  };
};

export type ReaderAssembly = {
  cases: ReaderCorpusCaseV1[];
  generated: Record<string, number>;
  pendingOwnerVariants: string[];
  cleanBases: Array<Record<string, unknown>>;
};

function readerKindOf(v: CorpusVariantSpecV1): ReaderKind {
  if (!(READER_KINDS as readonly string[]).includes(v.kind)) {
    throw new CorpusBuildError(`reader variant ${v.variantKey} has out-of-boundary kind ${v.kind}`, { variantKey: v.variantKey });
  }
  return v.kind as ReaderKind;
}

/** Assemble every BUILDABLE reader case (clean + builder-minted craft + supplied
 *  owner-authored hard blockers). Owner-authored variants with EMPTY ops are
 *  recorded pending and skipped — never fabricated. Does NOT enforce composition
 *  (buildReaderCorpus does), so a partial assembly stays inspectable. */
export function assembleReaderCases(
  spec: SplitLaneMutationSpecV1,
  config: SplitLaneCorpusConfigV1,
  ledger: CleanBaseScoreLedgerV1,
): ReaderAssembly {
  const variants = spec.variants ?? [];
  if (variants.length === 0) throw new CorpusBuildError("reader spec carries no variants", { corpusId: spec.corpusId });
  const cases: ReaderCorpusCaseV1[] = [];
  const generated: Record<string, number> = {};
  const pendingOwnerVariants: string[] = [];
  const seen = new Set<string>();
  const cleanBaseSeen = new Map<string, Record<string, unknown>>();

  for (const v of variants) {
    if (seen.has(v.variantKey)) throw new CorpusBuildError(`duplicate reader variantKey ${v.variantKey}`, { variantKey: v.variantKey });
    seen.add(v.variantKey);
    const kind = readerKindOf(v);

    // Owner-authored gold not yet supplied → pending, never fabricated (R-3).
    if (v.ownerAuthoredOps === true && v.ops.length === 0) {
      pendingOwnerVariants.push(v.variantKey);
      continue;
    }

    const base = loadAdmittedBase(config.sourceRoots.bookPackagesDir, v.baseBookId, v.baseChapter, config.minRenderBytes, ledger);
    if (!cleanBaseSeen.has(`${v.baseBookId}#${v.baseChapter}`)) {
      cleanBaseSeen.set(`${v.baseBookId}#${v.baseChapter}`, {
        bookId: v.baseBookId,
        chapterNumber: v.baseChapter,
        contentDesignScore: base.ledgerScore,
        gates: base.ledgerGates,
        packageCanonicalSha256: base.packageCanonicalSha256,
        packageRawSha256: base.packageRawSha256,
        baseContentSha256: chapterContentHash(base.chapter),
      });
    }

    let chapter: ChapterV21;
    let mutationSource: ReaderCorpusCaseV1["provenance"]["mutationSource"];
    if (kind === "clean") {
      if (v.ops.length !== 0) throw new CorpusBuildError(`clean reader variant ${v.variantKey} must be unmutated (ops must be [])`, { variantKey: v.variantKey });
      chapter = base.chapter;
      mutationSource = "unmutated";
    } else {
      chapter = cloneChapterAs(base.chapter, `${v.variantKey}-chapter`);
      applyMutationOps(chapter, v.ops);
      mutationSource = v.builderGenerated === true ? "builder-generated" : "owner-authored";
    }

    // Every variant chapter must remain structurally admissible after mutation.
    const varAdmission = kind === "clean" ? base.admission : admitVariant(chapter, config.minRenderBytes, v.variantKey);

    cases.push({
      caseId: v.variantKey,
      role: "reader",
      kind,
      baseBookId: v.baseBookId,
      baseChapter: v.baseChapter,
      chapter,
      expected: v.expected,
      sourceSemanticsStatus: SOURCE_SEMANTICS_MISSING,
      requiresPhase2: false,
      provenance: {
        mutationSource,
        baseContentSha256: chapterContentHash(base.chapter),
        variantContentSha256: chapterContentHash(chapter),
        chapterContentSha256: chapterContentHash(chapter),
        mutationOps: v.ops,
        cleanBaseScore: base.ledgerScore,
        cleanBaseGates: base.ledgerGates,
        renderedBytes: varAdmission.renderedBytes,
        shipAdvisoryClean: varAdmission.shipClean,
        shipAdvisoryBlockers: [...new Set(varAdmission.shipBlockers)],
        goldRationale: v.goldRationale ?? null,
      },
    });
    generated[kind] = (generated[kind] ?? 0) + 1;
  }

  return { cases, generated, pendingOwnerVariants, cleanBases: [...cleanBaseSeen.values()] };
}

/** Admit a mutated variant chapter (bases are admitted inside loadAdmittedBase;
 *  variants are re-admitted here after mutation). */
function admitVariant(chapter: ChapterV21, minRenderBytes: number, variantKey: string) {
  const adm = admitChapter(chapter);
  if (!adm.schemaOk) throw new CorpusBuildError(`reader variant ${variantKey} fails ChapterV21 schema after mutation`, { variantKey });
  if (!adm.renderOk) throw new CorpusBuildError(`reader variant ${variantKey} does not render after mutation`, { variantKey });
  if (adm.renderedBytes < minRenderBytes) throw new CorpusBuildError(`reader variant ${variantKey} rendered ${adm.renderedBytes}B < floor ${minRenderBytes}B`, { variantKey });
  if (!adm.complete) throw new CorpusBuildError(`reader variant ${variantKey} incomplete after mutation: ${adm.completenessProblems.join("; ")}`, { variantKey });
  return adm;
}

/** Build the reader corpus. FAIL CLOSED on missing spec/ledger, ungoverned gold,
 *  an inadmissible base/variant, or a composition shortfall (owner-authored gold
 *  ops pending) — never a silent []. */
export function buildReaderCorpus(config: SplitLaneCorpusConfigV1): CorpusBuildResultV1<ReaderCorpusCaseV1> {
  if (config.role !== "reader") throw new CorpusBuildError(`buildReaderCorpus requires role "reader" (got ${config.role})`, { role: config.role });
  const spec = readMutationSpec(config.mutationSpecPath, "reader");
  assertGoldGovernance(spec);
  const ledger = readCleanBaseScoreLedger(config.cleanBaseScoreLedgerPath);

  const assembly = assembleReaderCases(spec, config, ledger);
  assertComposition(spec.expectedComposition, assembly.generated, "reader", {
    corpusId: spec.corpusId,
    pendingOwnerVariants: assembly.pendingOwnerVariants,
  });

  const corpus: SplitLaneRoleCorpusV1<ReaderCorpusCaseV1> = {
    schema: SPLIT_LANE_CORPUS_SCHEMA,
    role: "reader",
    corpusId: spec.corpusId,
    builderVersion: SPLIT_LANE_CORPUS_BUILDER_VERSION,
    sourceCorpus: "ledgered 140-eval clean bases, schema-only normalized to current ChapterV21 (no source-semantic inference)",
    independentHumanRater: false,
    minRenderBytes: config.minRenderBytes,
    expectedComposition: spec.expectedComposition,
    generatedComposition: assembly.generated,
    softDenominators: spec.softDenominators ?? {},
    cases: [...assembly.cases].sort((a, b) => a.caseId.localeCompare(b.caseId)),
  };

  const corpusSha256 = hashValue(corpus);
  const provenanceManifest: CorpusProvenanceManifestV1 = {
    schema: SPLIT_LANE_CORPUS_PROVENANCE_SCHEMA,
    role: "reader",
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
    cleanBases: assembly.cleanBases,
    cases: corpus.cases.map((c) => ({
      caseId: c.caseId,
      kind: c.kind,
      baseBookId: c.baseBookId,
      baseChapter: c.baseChapter,
      mutationSource: c.provenance.mutationSource,
      baseContentSha256: c.provenance.baseContentSha256,
      variantContentSha256: c.provenance.variantContentSha256,
      chapterContentSha256: c.provenance.chapterContentSha256,
      expected: c.expected,
      sourceSemanticsStatus: c.sourceSemanticsStatus,
    })),
    excludedUnits: [],
    corpusSha256,
  };

  return { corpus, provenanceManifest, corpusBytes: canonicalPretty(corpus) };
}

// ── IMP-22 additive v2 corpus ─────────────────────────────────────────────────

export type ReaderMutationSpecV2 = {
  category: string;
  ops: MutationOpV1[];
  expected: Record<string, unknown>;
  curatorRationale: string;
};

export type ReaderBaseCaseSpecV2 = {
  fixtureKey: string;
  partition: CorpusPartitionV2;
  baseBookId: string;
  baseChapter: number;
  cleanExpected: Record<string, unknown>;
  cleanAudit: {
    status: "DEVELOPMENT_CLEAN_CONTROL";
    knownDefects: [];
    sourceDesignation: string;
    curatorRationale: string;
  };
  hardMutation: ReaderMutationSpecV2;
  craftMutation: ReaderMutationSpecV2;
};

export type ReaderCorpusSpecV2 = SplitLaneCorpusSpecV2Base & {
  role: "reader";
  builderMode: "reader-triplet-per-base-v2";
  knownChapterDefectExclusions: Array<{ bookId: string; chapter: number; reason: string }>;
  baseCases: ReaderBaseCaseSpecV2[];
};

export type ReaderCorpusCaseV2 = {
  caseId: string;
  role: "reader";
  partition: CorpusPartitionV2;
  kind: ReaderKind;
  baseBookId: string;
  baseChapter: number;
  chapter: ChapterV21;
  expected: Record<string, unknown>;
  sourceSemanticsStatus: typeof SOURCE_SEMANTICS_MISSING;
  requiresPhase2: false;
  baseCleanControlAudit: {
    status: "DEVELOPMENT_CLEAN_CONTROL";
    knownDefects: [];
    sourceDesignation: string;
    curatorRationale: string;
    independentHumanRater: false;
  };
  curation: CuratorDevelopmentProvenanceV2;
  provenance: {
    basePackageCanonicalSha256: string;
    baseContentSha256: string;
    variantContentSha256: string;
    mutationOps: MutationOpV1[];
    mutationOpsSha256: string;
    protectedContentSha256: string;
    cleanBaseScore: number;
    cleanBaseGates: { epistemic: string; ethics: string; externalAccuracy: string };
    renderedBytes: number;
  };
  substantiveCaseSha256: string;
};

function readReaderCorpusSpecV2(path: string): ReaderCorpusSpecV2 {
  const base = readCorpusSpecV2(path, "reader");
  if (base.builderMode !== "reader-triplet-per-base-v2") {
    throw new CorpusBuildError(`reader v2 builderMode must be reader-triplet-per-base-v2 (got ${base.builderMode})`, { path });
  }
  const spec = base as ReaderCorpusSpecV2;
  if (!Array.isArray(spec.knownChapterDefectExclusions)) throw new CorpusBuildError("reader v2 spec must declare knownChapterDefectExclusions[]", { path });
  if (!Array.isArray(spec.baseCases) || spec.baseCases.length === 0) {
    throw new CorpusBuildError("reader v2 spec must carry baseCases[]", { path });
  }
  const requiredDefectChapters = new Set(["the-power-of-moments#1", "peak#1", "decisive#1"]);
  const declaredDefectChapters = new Set<string>();
  for (const entry of spec.knownChapterDefectExclusions) {
    const coordinate = `${entry.bookId}#${entry.chapter}`;
    if (declaredDefectChapters.has(coordinate)) throw new CorpusBuildError(`reader v2 spec duplicates known chapter-defect exclusion ${coordinate}`, { path, coordinate });
    if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) throw new CorpusBuildError(`reader v2 known chapter-defect exclusion ${coordinate} has no reason`, { path, coordinate });
    declaredDefectChapters.add(coordinate);
  }
  for (const coordinate of requiredDefectChapters) {
    if (!declaredDefectChapters.has(coordinate)) throw new CorpusBuildError(`reader v2 spec omits known chapter-defect exclusion ${coordinate}`, { path, coordinate });
  }
  const fixtureKeys = new Set<string>();
  const coordinates = new Set<string>();
  for (const item of spec.baseCases) {
    if (!item || typeof item !== "object") throw new CorpusBuildError("reader v2 base case must be an object", { path });
    if (typeof item.fixtureKey !== "string" || item.fixtureKey.length === 0) throw new CorpusBuildError("reader v2 base case is missing fixtureKey", { path });
    if (fixtureKeys.has(item.fixtureKey)) throw new CorpusBuildError(`duplicate reader v2 fixtureKey ${item.fixtureKey}`, { path });
    fixtureKeys.add(item.fixtureKey);
    if (item.partition !== "calibration" && item.partition !== "holdout") throw new CorpusBuildError(`reader v2 ${item.fixtureKey} has invalid partition`, { path });
    const coordinate = `${item.baseBookId}#${item.baseChapter}`;
    if (coordinates.has(coordinate)) throw new CorpusBuildError(`reader v2 base coordinate ${coordinate} is reused across calibration/holdout`, { path });
    if (declaredDefectChapters.has(coordinate)) throw new CorpusBuildError(`reader v2 base coordinate ${coordinate} has a declared quiz-integrity defect`, { path, coordinate });
    coordinates.add(coordinate);
    if (!item.cleanExpected || typeof item.cleanExpected !== "object") throw new CorpusBuildError(`reader v2 ${item.fixtureKey} is missing cleanExpected`, { path });
    if (item.cleanAudit?.status !== "DEVELOPMENT_CLEAN_CONTROL" || !Array.isArray(item.cleanAudit.knownDefects) || item.cleanAudit.knownDefects.length !== 0) {
      throw new CorpusBuildError(`reader v2 ${item.fixtureKey} clean audit is missing or declares a known defect`, { path });
    }
    if (typeof item.cleanAudit.sourceDesignation !== "string" || item.cleanAudit.sourceDesignation.trim().length === 0
      || typeof item.cleanAudit.curatorRationale !== "string" || item.cleanAudit.curatorRationale.trim().length === 0) {
      throw new CorpusBuildError(`reader v2 ${item.fixtureKey} clean audit is missing its curator rationale/designation`, { path });
    }
    for (const [label, mutation] of [["hard", item.hardMutation], ["craft", item.craftMutation]] as const) {
      if (!mutation || !Array.isArray(mutation.ops) || mutation.ops.length === 0) {
        throw new CorpusBuildError(`reader v2 ${item.fixtureKey} ${label} mutation must carry explicit curator-authored ops`, { path });
      }
      if (typeof mutation.category !== "string" || mutation.category.trim().length === 0
        || !mutation.expected || typeof mutation.expected !== "object") {
        throw new CorpusBuildError(`reader v2 ${item.fixtureKey} ${label} mutation is missing category/expected gold`, { path });
      }
      if (typeof mutation.curatorRationale !== "string" || mutation.curatorRationale.length === 0) {
        throw new CorpusBuildError(`reader v2 ${item.fixtureKey} ${label} mutation is missing curatorRationale`, { path });
      }
    }
  }
  return spec;
}

function readerV2Curation(curatorRationale: string, sourceDesignation: string): CuratorDevelopmentProvenanceV2 {
  return {
    labelProvenance: CURATOR_DEVELOPMENT_LABEL,
    ownerApprovedForDevelopmentBakeoff: true,
    independentHumanRater: false,
    curatorRationale,
    sourceDesignation,
  };
}

/** Build the additive IMP-22 reader corpus: ten holdout and two calibration
 * base coordinates, each yielding one clean, one schema-valid visible blocker,
 * and one non-blocking craft case. */
export function buildReaderCorpusV2(config: SplitLaneCorpusConfigV1): CorpusBuildResultV2<ReaderCorpusCaseV2> {
  if (config.role !== "reader") throw new CorpusBuildError(`buildReaderCorpusV2 requires role "reader" (got ${config.role})`, { role: config.role });
  const spec = readReaderCorpusSpecV2(config.mutationSpecPath);
  assertCorpusConfigMatchesSpecV2(spec, config);
  assertGoldGovernanceV2(spec);
  assertPortableCorpusSpecV2(spec);
  assertExactCandidateExclusionsV2(spec.excludedCandidateBookIds);
  const ledger = readCleanBaseScoreLedger(config.cleanBaseScoreLedgerPath);
  const excludedCandidateBookIds = [...new Set([...(spec.excludedCandidateBookIds ?? []), ...(config.excludedCandidateBookIds ?? [])])].sort();
  assertExactCandidateExclusionsV2(excludedCandidateBookIds);
  const casesByPartition: Record<CorpusPartitionV2, ReaderCorpusCaseV2[]> = { calibration: [], holdout: [] };
  const generated: Record<CorpusPartitionV2, Record<string, number>> = { calibration: {}, holdout: {} };

  for (const item of spec.baseCases) {
    assertCandidateBookExcluded(item.baseBookId, excludedCandidateBookIds, item.fixtureKey);
    const base = loadAdmittedBase(config.sourceRoots.bookPackagesDir, item.baseBookId, item.baseChapter, config.minRenderBytes, ledger);

    const addCase = (
      kind: ReaderKind,
      chapter: ChapterV21,
      ops: MutationOpV1[],
      expected: Record<string, unknown>,
      curation: CuratorDevelopmentProvenanceV2,
      renderedBytes: number,
    ): void => {
      const caseId = `READER-V2-${item.partition.toUpperCase()}-${kind}-${item.fixtureKey}`;
      const variantContentSha256 = hashValue(chapter);
      const protectedContentSha256 = assertProtectedContentUnchanged(base.chapter, chapter, ops, caseId);
      if (kind !== "clean" && variantContentSha256 === hashValue(base.chapter)) {
        throw new CorpusBuildError(`reader v2 mutation ${caseId} did not change chapter content`, { caseId });
      }
      const payload = {
        caseId,
        role: "reader" as const,
        partition: item.partition,
        kind,
        baseBookId: item.baseBookId,
        baseChapter: item.baseChapter,
        chapter,
        expected,
        sourceSemanticsStatus: SOURCE_SEMANTICS_MISSING,
        requiresPhase2: false as const,
        baseCleanControlAudit: {
          ...item.cleanAudit,
          independentHumanRater: false as const,
        },
        curation,
        provenance: {
          basePackageCanonicalSha256: base.packageCanonicalSha256,
          baseContentSha256: hashValue(base.chapter),
          variantContentSha256,
          mutationOps: ops,
          mutationOpsSha256: hashValue(ops),
          protectedContentSha256,
          cleanBaseScore: base.ledgerScore,
          cleanBaseGates: base.ledgerGates,
          renderedBytes,
        },
      };
      casesByPartition[item.partition].push({ ...payload, substantiveCaseSha256: hashValue(payload) });
      generated[item.partition][kind] = (generated[item.partition][kind] ?? 0) + 1;
    };

    addCase(
      "clean",
      base.chapter,
      [],
      item.cleanExpected,
      readerV2Curation(item.cleanAudit.curatorRationale, item.cleanAudit.sourceDesignation),
      base.admission.renderedBytes,
    );

    for (const [kind, mutation] of [["reader-visible-hard-blocker", item.hardMutation], ["craft-nonblocker", item.craftMutation]] as const) {
      const chapter = JSON.parse(JSON.stringify(base.chapter)) as ChapterV21;
      applyMutationOps(chapter, mutation.ops);
      const admission = admitVariant(chapter, config.minRenderBytes, `${item.fixtureKey}-${kind}`);
      addCase(
        kind,
        chapter,
        mutation.ops,
        mutation.expected,
        readerV2Curation(mutation.curatorRationale, `IMP-22 ${mutation.category} controlled mutation`),
        admission.renderedBytes,
      );
    }
  }

  for (const partition of ["calibration", "holdout"] as const) {
    generated[partition].total = casesByPartition[partition].length;
    assertExactCompositionV2(spec.expectedCompositionByPartition[partition], generated[partition], partition, "reader");
    casesByPartition[partition].sort((a, b) => a.caseId.localeCompare(b.caseId));
  }

  const specSha256 = hashValue(spec);
  const ledgerSha256 = hashValue(ledger);
  const exclusionSha256 = hashValue(excludedCandidateBookIds);
  const partitionPayload = (partition: CorpusPartitionV2) => ({
    partition,
    expectedComposition: spec.expectedCompositionByPartition[partition],
    generatedComposition: generated[partition],
    cases: casesByPartition[partition],
  });
  const calibrationPayload = partitionPayload("calibration");
  const holdoutPayload = partitionPayload("holdout");
  const corpusDraft = {
    schema: SPLIT_LANE_CORPUS_V2_SCHEMA,
    role: "reader" as const,
    corpusId: spec.corpusId,
    builderVersion: SPLIT_LANE_CORPUS_BUILDER_V2_VERSION,
    labelProvenance: CURATOR_DEVELOPMENT_LABEL,
    ownerApprovedForDevelopmentBakeoff: true as const,
    independentHumanRater: false as const,
    specSha256,
    cleanBaseScoreLedgerSha256: ledgerSha256,
    excludedCandidateBookIds,
    excludedCandidateBookIdsSha256: exclusionSha256,
    partitions: {
      calibration: { ...calibrationPayload, substantivePartitionSha256: hashValue(calibrationPayload) },
      holdout: { ...holdoutPayload, substantivePartitionSha256: hashValue(holdoutPayload) },
    },
  };
  const corpus: SplitLaneRoleCorpusV2<ReaderCorpusCaseV2> = {
    ...corpusDraft,
    substantiveCorpusSha256: hashValue(corpusDraft),
  };
  const corpusBytes = canonicalPretty(corpus);
  const caseSha256 = Object.fromEntries(
    [...casesByPartition.calibration, ...casesByPartition.holdout].map((c) => [c.caseId, c.substantiveCaseSha256]),
  );
  const provenanceManifest = {
    schema: SPLIT_LANE_CORPUS_PROVENANCE_V2_SCHEMA,
    role: "reader" as const,
    corpusId: spec.corpusId,
    builderVersion: SPLIT_LANE_CORPUS_BUILDER_V2_VERSION,
    labelProvenance: CURATOR_DEVELOPMENT_LABEL,
    ownerApprovedForDevelopmentBakeoff: true as const,
    independentHumanRater: false as const,
    specSha256,
    cleanBaseScoreLedgerSha256: ledgerSha256,
    excludedCandidateBookIds,
    excludedCandidateBookIdsSha256: exclusionSha256,
    partitionSha256: {
      calibration: corpus.partitions.calibration.substantivePartitionSha256,
      holdout: corpus.partitions.holdout.substantivePartitionSha256,
    },
    caseSha256,
    substantiveCorpusSha256: corpus.substantiveCorpusSha256,
    corpusBytesSha256: `sha256:${sha256Hex(corpusBytes)}`,
  };
  return { corpus, provenanceManifest, corpusBytes };
}
