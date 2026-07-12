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
import type { SplitLaneCorpusConfigV1 } from "./reviewLaneTypes.js";
import { admitChapter } from "./nativeReviewQualification.js";
import {
  CorpusBuildError,
  SPLIT_LANE_CORPUS_BUILDER_VERSION,
  SPLIT_LANE_CORPUS_PROVENANCE_SCHEMA,
  SPLIT_LANE_CORPUS_SCHEMA,
  SOURCE_SEMANTICS_MISSING,
  applyMutationOps,
  assertComposition,
  assertGoldGovernance,
  canonicalPretty,
  chapterContentHash,
  cloneChapterAs,
  hashValue,
  loadAdmittedBase,
  readCleanBaseScoreLedger,
  readMutationSpec,
  type CleanBaseScoreLedgerV1,
  type CorpusBuildResultV1,
  type CorpusProvenanceManifestV1,
  type CorpusVariantSpecV1,
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
