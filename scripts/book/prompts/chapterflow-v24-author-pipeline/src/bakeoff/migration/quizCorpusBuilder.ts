/**
 * IMP-20 WP-B7 — hermetic quiz-integrity role corpus builder (design H3/§J).
 *
 * Builds a quiz-lane qualification corpus of deterministic paired fixtures from
 * the ledgered clean bases: 10 uniquely-correct clean, 10 key-mismatch (the
 * builder mints a concrete wrong correctIndex deterministically), 10
 * genuinely-ambiguous and 10 mechanism/causal-key (owner-authored gold ops).
 * Every case runs the two-phase blindness protocol at qualification time
 * (requiresPhase2), so each case carries the chapter + gold, never a live key.
 *
 * PURE: reads the injected roots and RETURNS bytes; writes nothing. FAILS CLOSED
 * (never shrinks) when an owner-authored variant's gold ops are pending or a
 * base cannot be admitted.
 */

import type { ChapterV21 } from "../../types.js";
import type { SplitLaneCorpusConfigV1 } from "./reviewLaneTypes.js";
import { admitChapter, resolveJsonPath } from "./nativeReviewQualification.js";
import {
  CorpusBuildError,
  SPLIT_LANE_CORPUS_BUILDER_VERSION,
  SPLIT_LANE_CORPUS_PROVENANCE_SCHEMA,
  SPLIT_LANE_CORPUS_SCHEMA,
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
  type MutationOpV1,
  type SplitLaneMutationSpecV1,
  type SplitLaneRoleCorpusV1,
} from "./corpusBuilderCore.js";

const QUIZ_KINDS = ["uniquely-correct-clean", "key-mismatch", "genuine-ambiguity", "mechanism-causal-key"] as const;
type QuizKind = (typeof QUIZ_KINDS)[number];

export type QuizCorpusCaseV1 = {
  caseId: string;
  role: "quiz";
  kind: QuizKind;
  baseBookId: string;
  baseChapter: number;
  chapter: ChapterV21;
  expected: Record<string, unknown>;
  requiresPhase2: true;
  provenance: {
    mutationSource: "unmutated" | "builder-generated" | "owner-authored";
    baseContentSha256: string;
    variantContentSha256: string;
    chapterContentSha256: string;
    mutationOps: MutationOpV1[];
    keyMismatchDetail: { questionIndex1: number; originalCorrectIndex: number; mutatedCorrectIndex: number } | null;
    cleanBaseScore: number;
    cleanBaseGates: { epistemic: string; ethics: string; externalAccuracy: string };
    renderedBytes: number;
    shipAdvisoryClean: boolean;
    shipAdvisoryBlockers: string[];
    goldRationale: string | null;
  };
};

export type QuizAssembly = {
  cases: QuizCorpusCaseV1[];
  generated: Record<string, number>;
  pendingOwnerVariants: string[];
  cleanBases: Array<Record<string, unknown>>;
};

function quizKindOf(v: CorpusVariantSpecV1): QuizKind {
  if (!(QUIZ_KINDS as readonly string[]).includes(v.kind)) {
    throw new CorpusBuildError(`quiz variant ${v.variantKey} has out-of-boundary kind ${v.kind}`, { variantKey: v.variantKey });
  }
  return v.kind as QuizKind;
}

/** Resolve a builder-minted key-mismatch op to a concrete correctIndex swap.
 *  Deterministic: the wrong option is (original + 1) mod choices.length — the
 *  same rule the retired Layer-N v2 builder used, so a mismatch is always a
 *  genuine wrong key, never accidentally the same index. */
function resolveKeyMismatchOp(chapter: ChapterV21, op: MutationOpV1): { concrete: MutationOpV1; detail: QuizCorpusCaseV1["provenance"]["keyMismatchDetail"] } {
  if (!op.path.endsWith("/correctIndex")) {
    throw new CorpusBuildError(`key-mismatch op must target a /correctIndex path (got ${op.path})`, { path: op.path });
  }
  const qPathMatch = op.path.match(/\/quiz\/questions\/(\d+)\/correctIndex$/);
  if (!qPathMatch) throw new CorpusBuildError(`key-mismatch op path is not a quiz question correctIndex: ${op.path}`, { path: op.path });
  const qIndex0 = Number(qPathMatch[1]);
  const question = resolveJsonPath(chapter as unknown, `/quiz/questions/${qIndex0}`) as { correctIndex?: number; choices?: unknown[] } | undefined;
  if (!question || typeof question.correctIndex !== "number" || !Array.isArray(question.choices)) {
    throw new CorpusBuildError(`key-mismatch target question ${qIndex0} has no correctIndex/choices`, { path: op.path });
  }
  const orig = question.correctIndex;
  const len = question.choices.length;
  if (len < 2) throw new CorpusBuildError(`key-mismatch target question ${qIndex0} has <2 choices`, { path: op.path });
  const wrong = (orig + 1) % len;
  return {
    concrete: { path: op.path, op: "replace", value: wrong },
    detail: { questionIndex1: qIndex0 + 1, originalCorrectIndex: orig, mutatedCorrectIndex: wrong },
  };
}

/** Assemble every BUILDABLE quiz case. Owner-authored ambiguity/mechanism
 *  variants with EMPTY ops are recorded pending and skipped — never fabricated. */
export function assembleQuizCases(
  spec: SplitLaneMutationSpecV1,
  config: SplitLaneCorpusConfigV1,
  ledger: CleanBaseScoreLedgerV1,
): QuizAssembly {
  const variants = spec.variants ?? [];
  if (variants.length === 0) throw new CorpusBuildError("quiz spec carries no variants", { corpusId: spec.corpusId });
  const cases: QuizCorpusCaseV1[] = [];
  const generated: Record<string, number> = {};
  const pendingOwnerVariants: string[] = [];
  const seen = new Set<string>();
  const cleanBaseSeen = new Map<string, Record<string, unknown>>();

  for (const v of variants) {
    if (seen.has(v.variantKey)) throw new CorpusBuildError(`duplicate quiz variantKey ${v.variantKey}`, { variantKey: v.variantKey });
    seen.add(v.variantKey);
    const kind = quizKindOf(v);

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
    let mutationSource: QuizCorpusCaseV1["provenance"]["mutationSource"];
    let mutationOps: MutationOpV1[] = v.ops;
    let keyMismatchDetail: QuizCorpusCaseV1["provenance"]["keyMismatchDetail"] = null;

    if (kind === "uniquely-correct-clean") {
      if (v.ops.length !== 0) throw new CorpusBuildError(`clean quiz variant ${v.variantKey} must be unmutated (ops must be [])`, { variantKey: v.variantKey });
      chapter = base.chapter;
      mutationSource = "unmutated";
    } else if (kind === "key-mismatch") {
      if (v.builderGenerated !== true) throw new CorpusBuildError(`key-mismatch variant ${v.variantKey} must be builderGenerated`, { variantKey: v.variantKey });
      if (v.ops.length !== 1) throw new CorpusBuildError(`key-mismatch variant ${v.variantKey} must carry exactly one directive op`, { variantKey: v.variantKey });
      chapter = cloneChapterAs(base.chapter, `${v.variantKey}-chapter`);
      const resolved = resolveKeyMismatchOp(chapter, v.ops[0]);
      applyMutationOps(chapter, [resolved.concrete]);
      mutationOps = [resolved.concrete];
      keyMismatchDetail = resolved.detail;
      mutationSource = "builder-generated";
    } else {
      // owner-authored ambiguity / mechanism gold (ops supplied)
      chapter = cloneChapterAs(base.chapter, `${v.variantKey}-chapter`);
      applyMutationOps(chapter, v.ops);
      mutationSource = "owner-authored";
    }

    const adm = kind === "uniquely-correct-clean" ? base.admission : admitVariant(chapter, config.minRenderBytes, v.variantKey);

    cases.push({
      caseId: v.variantKey,
      role: "quiz",
      kind,
      baseBookId: v.baseBookId,
      baseChapter: v.baseChapter,
      chapter,
      expected: v.expected,
      requiresPhase2: true,
      provenance: {
        mutationSource,
        baseContentSha256: chapterContentHash(base.chapter),
        variantContentSha256: chapterContentHash(chapter),
        chapterContentSha256: chapterContentHash(chapter),
        mutationOps,
        keyMismatchDetail,
        cleanBaseScore: base.ledgerScore,
        cleanBaseGates: base.ledgerGates,
        renderedBytes: adm.renderedBytes,
        shipAdvisoryClean: adm.shipClean,
        shipAdvisoryBlockers: [...new Set(adm.shipBlockers)],
        goldRationale: v.goldRationale ?? null,
      },
    });
    generated[kind] = (generated[kind] ?? 0) + 1;
  }

  return { cases, generated, pendingOwnerVariants, cleanBases: [...cleanBaseSeen.values()] };
}

function admitVariant(chapter: ChapterV21, minRenderBytes: number, variantKey: string) {
  const adm = admitChapter(chapter);
  if (!adm.schemaOk) throw new CorpusBuildError(`quiz variant ${variantKey} fails ChapterV21 schema after mutation`, { variantKey });
  if (!adm.renderOk) throw new CorpusBuildError(`quiz variant ${variantKey} does not render after mutation`, { variantKey });
  if (adm.renderedBytes < minRenderBytes) throw new CorpusBuildError(`quiz variant ${variantKey} rendered ${adm.renderedBytes}B < floor ${minRenderBytes}B`, { variantKey });
  if (!adm.complete) throw new CorpusBuildError(`quiz variant ${variantKey} incomplete after mutation: ${adm.completenessProblems.join("; ")}`, { variantKey });
  return adm;
}

/** Build the quiz corpus. FAIL CLOSED on missing spec/ledger, ungoverned gold,
 *  an inadmissible base/variant, or a composition shortfall (owner-authored gold
 *  ops pending). */
export function buildQuizCorpus(config: SplitLaneCorpusConfigV1): CorpusBuildResultV1<QuizCorpusCaseV1> {
  if (config.role !== "quiz") throw new CorpusBuildError(`buildQuizCorpus requires role "quiz" (got ${config.role})`, { role: config.role });
  const spec = readMutationSpec(config.mutationSpecPath, "quiz");
  assertGoldGovernance(spec);
  const ledger = readCleanBaseScoreLedger(config.cleanBaseScoreLedgerPath);

  const assembly = assembleQuizCases(spec, config, ledger);
  assertComposition(spec.expectedComposition, assembly.generated, "quiz", {
    corpusId: spec.corpusId,
    pendingOwnerVariants: assembly.pendingOwnerVariants,
  });

  const corpus: SplitLaneRoleCorpusV1<QuizCorpusCaseV1> = {
    schema: SPLIT_LANE_CORPUS_SCHEMA,
    role: "quiz",
    corpusId: spec.corpusId,
    builderVersion: SPLIT_LANE_CORPUS_BUILDER_VERSION,
    sourceCorpus: "ledgered 140-eval clean bases, schema-only normalized to current ChapterV21 (deterministic paired quiz fixtures)",
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
    role: "quiz",
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
      keyMismatchDetail: c.provenance.keyMismatchDetail,
      expected: c.expected,
      requiresPhase2: c.requiresPhase2,
    })),
    excludedUnits: [],
    corpusSha256,
  };

  return { corpus, provenanceManifest, corpusBytes: canonicalPretty(corpus) };
}
