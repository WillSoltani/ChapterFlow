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
import { sha256Hex } from "../../contracts/contractUtil.js";
import type { SplitLaneCorpusConfigV1 } from "./reviewLaneTypes.js";
import { admitChapter, resolveJsonPath } from "./nativeReviewQualification.js";
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

// ── IMP-22 additive v2 single-question corpus ─────────────────────────────────

type QuizQuestionV21 = ChapterV21["quiz"]["questions"][number];

export type QuizBaseItemSpecV2 = {
  fixtureKey: string;
  partition: CorpusPartitionV2;
  baseBookId: string;
  baseChapter: number;
  targetQuestionIndex1: number;
  cleanProof: {
    status: "CURATOR_VERIFIED_UNIQUE_DEVELOPMENT_GOLD";
    keyedAnswerIndex: number;
    defensibleAnswerIndices: [number];
    evidencePath: string;
    sourceDesignation: string;
    curatorRationale: string;
  };
  mechanismFixture: {
    fixtureId: string;
    mode: "supported" | "causal-overreach";
    supportText: string;
    prompt: string;
    supportedChoice: string;
    causalOverreachChoice: string;
    unrelatedChoice: string;
    explanation: string;
    curatorRationale: string;
  };
};

export type QuizCorpusSpecV2 = SplitLaneCorpusSpecV2Base & {
  role: "quiz";
  builderMode: "quiz-quad-per-base-single-question-v2";
  singleQuestionProjection: true;
  keyMismatchPolicy: "rotate-key-to-next-choice-v1";
  ambiguityProofPolicy: "duplicate-keyed-choice-adversarial-proof-v1";
  knownDefectExclusions: Array<{ bookId: string; chapter: number; questionIndex1: number; reason: string }>;
  baseItems: QuizBaseItemSpecV2[];
};

export type QuizCorpusCaseV2 = {
  caseId: string;
  role: "quiz";
  partition: CorpusPartitionV2;
  kind: QuizKind;
  baseBookId: string;
  baseChapter: number;
  sourceQuestionIndex1: number;
  questionIndex1: 1;
  chapter: ChapterV21;
  expected: Record<string, unknown>;
  sourceSemanticsStatus: typeof SOURCE_SEMANTICS_MISSING;
  requiresPhase2: true;
  cleanItemProof: QuizBaseItemSpecV2["cleanProof"] & {
    evidenceSha256: string;
    independentHumanRater: false;
  };
  curation: CuratorDevelopmentProvenanceV2;
  adversarialAmbiguityProof: null | {
    schema: "quiz-ambiguity-adversarial-proof-v1";
    proofMethod: "duplicate-keyed-choice";
    singleBestAnswerAttempt: "FAILED_TWO_TEXT_IDENTICAL_DEFENSIBLE_CHOICES";
    defensibleAnswerIndices: [number, number];
    duplicatedChoiceSha256: string;
    independentHumanRater: false;
  };
  mechanismProof: null | {
    schema: "quiz-mechanism-proof-v1";
    mode: "supported" | "causal-overreach";
    supportPath: "/breakdown/fullRead";
    supportTextSha256: string;
    keyedMechanismSupported: boolean;
    defensibleAnswerIndices: [number];
  };
  provenance: {
    basePackageCanonicalSha256: string;
    sourceChapterContentSha256: string;
    isolatedBaseContentSha256: string;
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

function readQuizCorpusSpecV2(path: string): QuizCorpusSpecV2 {
  const base = readCorpusSpecV2(path, "quiz");
  if (base.builderMode !== "quiz-quad-per-base-single-question-v2") {
    throw new CorpusBuildError(`quiz v2 builderMode must be quiz-quad-per-base-single-question-v2 (got ${base.builderMode})`, { path });
  }
  const spec = base as QuizCorpusSpecV2;
  if (spec.singleQuestionProjection !== true) throw new CorpusBuildError("quiz v2 spec must set singleQuestionProjection=true", { path });
  if (spec.keyMismatchPolicy !== "rotate-key-to-next-choice-v1") throw new CorpusBuildError("quiz v2 spec has unknown keyMismatchPolicy", { path });
  if (spec.ambiguityProofPolicy !== "duplicate-keyed-choice-adversarial-proof-v1") throw new CorpusBuildError("quiz v2 spec has unknown ambiguityProofPolicy", { path });
  if (!Array.isArray(spec.knownDefectExclusions)) throw new CorpusBuildError("quiz v2 spec must declare knownDefectExclusions[]", { path });
  if (!Array.isArray(spec.baseItems) || spec.baseItems.length === 0) throw new CorpusBuildError("quiz v2 spec must carry baseItems[]", { path });
  const requiredDefectCoordinates = new Set([
    "the-power-of-moments#1#3",
    "peak#1#1",
    "peak#1#6",
    "decisive#1#4",
  ]);
  const declaredDefectCoordinates = new Set<string>();
  for (const entry of spec.knownDefectExclusions) {
    const coordinate = `${entry.bookId}#${entry.chapter}#${entry.questionIndex1}`;
    if (declaredDefectCoordinates.has(coordinate)) throw new CorpusBuildError(`quiz v2 spec duplicates known defect exclusion ${coordinate}`, { path, coordinate });
    if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) throw new CorpusBuildError(`quiz v2 known defect exclusion ${coordinate} has no reason`, { path, coordinate });
    declaredDefectCoordinates.add(coordinate);
  }
  for (const coordinate of requiredDefectCoordinates) {
    if (!declaredDefectCoordinates.has(coordinate)) throw new CorpusBuildError(`quiz v2 spec omits known defect exclusion ${coordinate}`, { path, coordinate });
  }
  const fixtureKeys = new Set<string>();
  const coordinates = new Set<string>();
  for (const item of spec.baseItems) {
    if (typeof item.fixtureKey !== "string" || item.fixtureKey.length === 0) throw new CorpusBuildError("quiz v2 base item is missing fixtureKey", { path });
    if (fixtureKeys.has(item.fixtureKey)) throw new CorpusBuildError(`duplicate quiz v2 fixtureKey ${item.fixtureKey}`, { path });
    fixtureKeys.add(item.fixtureKey);
    if (item.partition !== "calibration" && item.partition !== "holdout") throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} has invalid partition`, { path });
    if (!Number.isInteger(item.targetQuestionIndex1) || item.targetQuestionIndex1 < 1) throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} has invalid targetQuestionIndex1`, { path });
    const coordinate = `${item.baseBookId}#${item.baseChapter}#${item.targetQuestionIndex1}`;
    if (coordinates.has(coordinate)) throw new CorpusBuildError(`quiz v2 base coordinate ${coordinate} is reused across calibration/holdout`, { path });
    if (declaredDefectCoordinates.has(coordinate)) throw new CorpusBuildError(`quiz v2 clean base coordinate ${coordinate} is a known defective item`, { path, coordinate });
    coordinates.add(coordinate);
    if (item.cleanProof?.status !== "CURATOR_VERIFIED_UNIQUE_DEVELOPMENT_GOLD" || item.cleanProof.defensibleAnswerIndices?.length !== 1) {
      throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} is missing a unique-answer curator proof`, { path });
    }
    if (!Number.isInteger(item.cleanProof.keyedAnswerIndex) || item.cleanProof.keyedAnswerIndex < 0
      || item.cleanProof.evidencePath !== "/quiz/questions/0/explanation"
      || typeof item.cleanProof.sourceDesignation !== "string" || item.cleanProof.sourceDesignation.trim().length === 0
      || typeof item.cleanProof.curatorRationale !== "string" || item.cleanProof.curatorRationale.trim().length === 0) {
      throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} has an incomplete curator clean proof`, { path });
    }
    const fixture = item.mechanismFixture;
    if (!fixture || !["supported", "causal-overreach"].includes(fixture.mode)) throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} has invalid mechanism fixture`, { path });
    const substantive = [fixture.supportText, fixture.prompt, fixture.supportedChoice, fixture.causalOverreachChoice, fixture.unrelatedChoice, fixture.explanation, fixture.curatorRationale];
    if (substantive.some((value) => typeof value !== "string" || value.trim().length === 0)) throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} mechanism fixture has an empty substantive field`, { path });
    if (fixture.prompt !== "Which mechanism is supported by the IMP-22 fixture evidence?") {
      throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} mechanism prompt must ask for the supported mechanism`, { path });
    }
    if (fixture.mode === "causal-overreach"
      && (!/\bguarantee(?:s|d)?\b/i.test(fixture.causalOverreachChoice)
        || !/\b(?:does not|cannot) guarantee\b/i.test(fixture.supportText))) {
      throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} causal-overreach fixture must pair an explicit guarantee with an explicit no-guarantee support limit`, { path });
    }
    if (new Set([fixture.supportedChoice, fixture.causalOverreachChoice, fixture.unrelatedChoice]).size !== 3) {
      throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} mechanism choices must be distinct`, { path });
    }
  }
  return spec;
}

function quizV2Curation(curatorRationale: string, sourceDesignation: string): CuratorDevelopmentProvenanceV2 {
  return {
    labelProvenance: CURATOR_DEVELOPMENT_LABEL,
    ownerApprovedForDevelopmentBakeoff: true,
    independentHumanRater: false,
    curatorRationale,
    sourceDesignation,
  };
}

/** A single-question projection remains ChapterV21-schema-valid, but deliberately
 * falls below the production chapter's four-question completeness floor. No other
 * completeness problem is permitted in this qualification-only artifact. */
function admitSingleQuestionVariant(chapter: ChapterV21, minRenderBytes: number, caseId: string) {
  const admission = admitChapter(chapter);
  if (!admission.schemaOk) throw new CorpusBuildError(`quiz v2 ${caseId} fails ChapterV21 schema`, { caseId });
  if (!admission.renderOk) throw new CorpusBuildError(`quiz v2 ${caseId} does not render`, { caseId });
  if (admission.renderedBytes < minRenderBytes) throw new CorpusBuildError(`quiz v2 ${caseId} rendered ${admission.renderedBytes}B < floor ${minRenderBytes}B`, { caseId });
  const unexpected = admission.completenessProblems.filter((problem) => !/^quiz has 1 questions \(<4\)$/.test(problem));
  if (unexpected.length > 0) throw new CorpusBuildError(`quiz v2 ${caseId} has unexpected completeness defects: ${unexpected.join("; ")}`, { caseId, unexpected });
  return admission;
}

function mechanismQuestion(item: QuizBaseItemSpecV2): { question: QuizQuestionV21; defensibleAnswerIndex: number; keyedMechanismSupported: boolean } {
  const f = item.mechanismFixture;
  const supported = f.mode === "supported";
  const choices = supported
    ? [f.supportedChoice, f.causalOverreachChoice, f.unrelatedChoice]
    : [f.causalOverreachChoice, f.supportedChoice, f.unrelatedChoice];
  return {
    question: {
      questionId: `imp22-${item.fixtureKey}-${f.fixtureId}`,
      prompt: f.prompt,
      choices,
      correctIndex: 0,
      explanation: f.explanation,
      bloomsLevel: "analyze",
      depthLevel: "deep",
    },
    defensibleAnswerIndex: supported ? 0 : 1,
    keyedMechanismSupported: supported,
  };
}

/** Build 48 isolated items: each of 10 holdout and 2 calibration coordinates
 * yields a clean item, controlled wrong-key mutation, mechanically indisputable
 * ambiguity mutation, and explicit supported/overreach mechanism fixture. */
export function buildQuizCorpusV2(config: SplitLaneCorpusConfigV1): CorpusBuildResultV2<QuizCorpusCaseV2> {
  if (config.role !== "quiz") throw new CorpusBuildError(`buildQuizCorpusV2 requires role "quiz" (got ${config.role})`, { role: config.role });
  const spec = readQuizCorpusSpecV2(config.mutationSpecPath);
  assertCorpusConfigMatchesSpecV2(spec, config);
  assertGoldGovernanceV2(spec);
  assertPortableCorpusSpecV2(spec);
  assertExactCandidateExclusionsV2(spec.excludedCandidateBookIds);
  const ledger = readCleanBaseScoreLedger(config.cleanBaseScoreLedgerPath);
  const excludedCandidateBookIds = [...new Set([...(spec.excludedCandidateBookIds ?? []), ...(config.excludedCandidateBookIds ?? [])])].sort();
  assertExactCandidateExclusionsV2(excludedCandidateBookIds);
  const casesByPartition: Record<CorpusPartitionV2, QuizCorpusCaseV2[]> = { calibration: [], holdout: [] };
  const generated: Record<CorpusPartitionV2, Record<string, number>> = { calibration: {}, holdout: {} };

  for (const item of spec.baseItems) {
    assertCandidateBookExcluded(item.baseBookId, excludedCandidateBookIds, item.fixtureKey);
    const base = loadAdmittedBase(config.sourceRoots.bookPackagesDir, item.baseBookId, item.baseChapter, config.minRenderBytes, ledger);
    const sourceQuestion = base.chapter.quiz.questions[item.targetQuestionIndex1 - 1];
    if (!sourceQuestion) throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} target question does not exist`, { item });
    if (sourceQuestion.correctIndex !== item.cleanProof.keyedAnswerIndex || item.cleanProof.defensibleAnswerIndices[0] !== sourceQuestion.correctIndex) {
      throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} clean proof does not match the stored key`, { item });
    }
    const isolatedBase = JSON.parse(JSON.stringify(base.chapter)) as ChapterV21;
    isolatedBase.quiz.questions = [JSON.parse(JSON.stringify(sourceQuestion)) as QuizQuestionV21];
    const cleanEvidence = resolveJsonPath(isolatedBase as unknown, item.cleanProof.evidencePath);
    if (typeof cleanEvidence !== "string" || cleanEvidence.trim().length === 0) {
      throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} clean proof evidencePath does not resolve to text`, { evidencePath: item.cleanProof.evidencePath });
    }
    const cleanItemProof: QuizCorpusCaseV2["cleanItemProof"] = {
      ...item.cleanProof,
      evidenceSha256: hashValue(cleanEvidence),
      independentHumanRater: false,
    };

    const addCase = (
      kind: QuizKind,
      chapter: ChapterV21,
      ops: MutationOpV1[],
      expected: Record<string, unknown>,
      curation: CuratorDevelopmentProvenanceV2,
      ambiguityProof: QuizCorpusCaseV2["adversarialAmbiguityProof"],
      mechanismProof: QuizCorpusCaseV2["mechanismProof"],
    ): void => {
      const caseId = `QUIZ-V2-${item.partition.toUpperCase()}-${kind}-${item.fixtureKey}`;
      const admission = admitSingleQuestionVariant(chapter, config.minRenderBytes, caseId);
      const variantContentSha256 = hashValue(chapter);
      const protectedContentSha256 = assertProtectedContentUnchanged(isolatedBase, chapter, ops, caseId);
      if (kind !== "uniquely-correct-clean" && variantContentSha256 === hashValue(isolatedBase)) {
        throw new CorpusBuildError(`quiz v2 mutation ${caseId} did not change content`, { caseId });
      }
      const payload = {
        caseId,
        role: "quiz" as const,
        partition: item.partition,
        kind,
        baseBookId: item.baseBookId,
        baseChapter: item.baseChapter,
        sourceQuestionIndex1: item.targetQuestionIndex1,
        questionIndex1: 1 as const,
        chapter,
        expected,
        sourceSemanticsStatus: SOURCE_SEMANTICS_MISSING,
        requiresPhase2: true as const,
        cleanItemProof,
        curation,
        adversarialAmbiguityProof: ambiguityProof,
        mechanismProof,
        provenance: {
          basePackageCanonicalSha256: base.packageCanonicalSha256,
          sourceChapterContentSha256: hashValue(base.chapter),
          isolatedBaseContentSha256: hashValue(isolatedBase),
          variantContentSha256,
          mutationOps: ops,
          mutationOpsSha256: hashValue(ops),
          protectedContentSha256,
          cleanBaseScore: base.ledgerScore,
          cleanBaseGates: base.ledgerGates,
          renderedBytes: admission.renderedBytes,
        },
      };
      casesByPartition[item.partition].push({ ...payload, substantiveCaseSha256: hashValue(payload) });
      generated[item.partition][kind] = (generated[item.partition][kind] ?? 0) + 1;
    };

    addCase(
      "uniquely-correct-clean",
      isolatedBase,
      [],
      {
        goldResult: "PASS",
        keyCorrect: "correct",
        uniqueAnswer: true,
        defensibleAnswerIndices: item.cleanProof.defensibleAnswerIndices,
        keyedMechanismSupported: true,
      },
      quizV2Curation(item.cleanProof.curatorRationale, item.cleanProof.sourceDesignation),
      null,
      null,
    );

    const mismatch = JSON.parse(JSON.stringify(isolatedBase)) as ChapterV21;
    const wrongIndex = (sourceQuestion.correctIndex + 1) % sourceQuestion.choices.length;
    const mismatchOps: MutationOpV1[] = [{ path: "/quiz/questions/0/correctIndex", op: "replace", value: wrongIndex }];
    applyMutationOps(mismatch, mismatchOps);
    addCase(
      "key-mismatch",
      mismatch,
      mismatchOps,
      {
        goldResult: "BLOCK",
        keyCorrect: "wrong",
        uniqueAnswer: true,
        originalCorrectIndex: sourceQuestion.correctIndex,
        mutatedCorrectIndex: wrongIndex,
        defensibleAnswerIndices: [sourceQuestion.correctIndex],
        keyedMechanismSupported: true,
      },
      quizV2Curation("The stored key alone is rotated away from a curator-verified unique answer; question, choices, and explanation remain protected.", `controlled pair of ${item.fixtureKey}`),
      null,
      null,
    );

    const ambiguous = JSON.parse(JSON.stringify(isolatedBase)) as ChapterV21;
    const duplicateIndex = (sourceQuestion.correctIndex + 1) % sourceQuestion.choices.length;
    const keyedChoice = sourceQuestion.choices[sourceQuestion.correctIndex];
    const ambiguityOps: MutationOpV1[] = [{ path: `/quiz/questions/0/choices/${duplicateIndex}`, op: "replace", value: keyedChoice }];
    applyMutationOps(ambiguous, ambiguityOps);
    if (ambiguous.quiz.questions[0].choices[duplicateIndex] !== ambiguous.quiz.questions[0].choices[sourceQuestion.correctIndex]) {
      throw new CorpusBuildError(`quiz v2 ${item.fixtureKey} ambiguity mutation failed to produce identical defensible choices`, { item });
    }
    addCase(
      "genuine-ambiguity",
      ambiguous,
      ambiguityOps,
      {
        goldResult: "BLOCK",
        keyCorrect: "ambiguous",
        uniqueAnswer: false,
        defensibleAnswerIndices: [sourceQuestion.correctIndex, duplicateIndex],
        keyedMechanismSupported: true,
      },
      quizV2Curation("The keyed answer is duplicated verbatim into a second position, so no adversarial single-best reading can distinguish them.", `controlled pair of ${item.fixtureKey}`),
      {
        schema: "quiz-ambiguity-adversarial-proof-v1",
        proofMethod: "duplicate-keyed-choice",
        singleBestAnswerAttempt: "FAILED_TWO_TEXT_IDENTICAL_DEFENSIBLE_CHOICES",
        defensibleAnswerIndices: [sourceQuestion.correctIndex, duplicateIndex],
        duplicatedChoiceSha256: hashValue(keyedChoice),
        independentHumanRater: false,
      },
      null,
    );

    const mechanism = JSON.parse(JSON.stringify(isolatedBase)) as ChapterV21;
    const mechanismBuilt = mechanismQuestion(item);
    const mechanismOps: MutationOpV1[] = [
      { path: "/breakdown/fullRead", op: "append", value: `\n\n${item.mechanismFixture.supportText}` },
      { path: "/quiz/questions/0", op: "replace", value: mechanismBuilt.question },
    ];
    applyMutationOps(mechanism, mechanismOps);
    addCase(
      "mechanism-causal-key",
      mechanism,
      mechanismOps,
      {
        goldResult: mechanismBuilt.keyedMechanismSupported ? "PASS" : "BLOCK",
        keyCorrect: mechanismBuilt.keyedMechanismSupported ? "correct" : "wrong",
        keyedMechanismSupported: mechanismBuilt.keyedMechanismSupported,
        uniqueAnswer: true,
        defensibleAnswerIndices: [mechanismBuilt.defensibleAnswerIndex],
        mechanismMode: item.mechanismFixture.mode,
      },
      quizV2Curation(item.mechanismFixture.curatorRationale, `explicit mechanism fixture ${item.mechanismFixture.fixtureId}`),
      null,
      {
        schema: "quiz-mechanism-proof-v1",
        mode: item.mechanismFixture.mode,
        supportPath: "/breakdown/fullRead",
        supportTextSha256: hashValue(item.mechanismFixture.supportText),
        keyedMechanismSupported: mechanismBuilt.keyedMechanismSupported,
        defensibleAnswerIndices: [mechanismBuilt.defensibleAnswerIndex],
      },
    );
  }

  for (const partition of ["calibration", "holdout"] as const) {
    generated[partition].total = casesByPartition[partition].length;
    assertExactCompositionV2(spec.expectedCompositionByPartition[partition], generated[partition], partition, "quiz");
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
    role: "quiz" as const,
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
  const corpus: SplitLaneRoleCorpusV2<QuizCorpusCaseV2> = {
    ...corpusDraft,
    substantiveCorpusSha256: hashValue(corpusDraft),
  };
  const corpusBytes = canonicalPretty(corpus);
  const caseSha256 = Object.fromEntries(
    [...casesByPartition.calibration, ...casesByPartition.holdout].map((c) => [c.caseId, c.substantiveCaseSha256]),
  );
  const provenanceManifest = {
    schema: SPLIT_LANE_CORPUS_PROVENANCE_V2_SCHEMA,
    role: "quiz" as const,
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
