/**
 * IMP-24 — additive V3 role corpus construction and model-free gold audits.
 *
 * This module intentionally does not modify or rebuild the IMP-22 V2 inputs.
 * It accepts their exact retained bytes, verifies their frozen raw hashes, and
 * derives a new V3 corpus identity.  Calibration outputs are never consulted:
 * the only inherited inputs are the frozen, owner-approved development corpus
 * fixtures.  V3 canaries are separate from holdout and every role has exactly
 * two canaries.
 *
 * The source derivation fixes the verified IMP-23 defect.  Real source facts
 * remain confined to source-bound families.  Constructed and generic cases use
 * independent, family-appropriate text bases; their defect twins change only
 * `evidence.chapterUnit`.  The generic twin adds exactly one prohibited kind
 * of specificity and the constructed twin removes visible hypothetical
 * framing without adding a date, name, statistic, quotation, or historical
 * claim.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import type { ReviewEvidenceKind } from "../../contracts/reviewEvidenceEnvelope.js";
import {
  completeKeyFreeReaderDocumentBytesV2,
  segmentCompleteKeyFreeReaderDocumentV2,
} from "../../review/completeKeyFreeReaderDocumentV2.js";
import { renderChapterReaderDocPhase1 } from "../../review/renderReaderDoc.js";
import { validateChapterV21 } from "../../runtimeSchemas.js";
import { resolveEvidenceRefIds } from "../../review/evidenceReferenceResolver.js";
import {
  createReviewEvidenceEnvelope,
  deriveReviewEvidenceEnvelopeSha256,
  serializeReviewEvidenceEnvelope,
  type ReviewEvidenceSegmentInputV1,
} from "../../review/reviewEvidenceEnvelope.js";
import { chapterCompleteness, resolveJsonPath } from "./nativeReviewQualification.js";
import {
  applyMutationOps,
  assertProtectedContentUnchanged,
  canonicalPretty,
  hashValue,
  type MutationOpV1,
} from "./corpusBuilderCore.js";
import type { ReaderCorpusCaseV2 } from "./readerCorpusBuilder.js";
import type { Imp22SourceCorpusCaseV2 } from "./sourceCorpusBuilder.js";
import type { QuizCorpusCaseV2 } from "./quizCorpusBuilder.js";

/** Protocol/corpus identity. Its retained bytes and semantic hashes are frozen
 * by IMP-24B and must not change merely because a zero-call execution was
 * superseded. */
export const IMP24_ROLE_QUALIFICATION_PROTOCOL_ID =
  "s16-forward-role-qualification-v3-envelope" as const;
/** Backwards-compatible name for the frozen V3 protocol/corpus identity. */
export const IMP24_ROLE_QUALIFICATION_ID = IMP24_ROLE_QUALIFICATION_PROTOCOL_ID;
/** The IMP-24B execution under the protocol identity is terminal and may not
 * resume. IMP-24C authorizes this distinct successor execution identity. */
export const IMP24_ROLE_QUALIFICATION_CLOSED_EXECUTION_ID =
  IMP24_ROLE_QUALIFICATION_PROTOCOL_ID;
export const IMP24_ROLE_QUALIFICATION_EXECUTION_ID =
  "s16-forward-role-qualification-v3-envelope-r1" as const;
export const IMP24_CORPUS_SCHEMA = "imp24-role-qualification-corpus-v3" as const;
export const IMP24_CORPUS_BUNDLE_SCHEMA = "imp24-role-qualification-corpus-bundle-v1" as const;
export const IMP24_CORPUS_AUDIT_SCHEMA = "imp24-model-free-corpus-audit-v1" as const;
export const IMP24_LEGACY_EVIDENCE_CLOSURE_SCHEMA = "imp24-legacy-evidence-closure-v1" as const;

export const IMP24_CORPUS_EXPECTED_COUNTS = {
  reader: { canary: 2, holdout: 30 },
  source: { canary: 2, holdout: 40 },
  quiz: { canary: 2, holdout: 40 },
} as const;

export const IMP24_FROZEN_V2_INPUTS = {
  reader: {
    fileName: "reader-corpus.imp22-v2.json",
    corpusId: "imp22-forward-sol-reader-corpus-v2",
    rawSha256: "efaf5a3d80cbf46bcae9511030fba8fc02fbcb4a055241ca867b8c0a1729ccbe",
    substantiveCorpusSha256: "sha256:5743b9acec5e71c6e536cd32cd9b518b75418eb34ac4f8a14073b5f82e531cc8",
  },
  source: {
    fileName: "source-corpus.imp22-v2.json",
    corpusId: "s16-forward-sol-source-corpus-v1",
    rawSha256: "0e3791580c0b2461622033e9369047f5752b7de70537e276af45794f4c2b6435",
    substantiveCorpusSha256: "sha256:f706bcf03e7d81bf2c435d52626f4e03632fa66e1b155c73b606b503ad4d0b91",
  },
  quiz: {
    fileName: "quiz-corpus.imp22-v2.json",
    corpusId: "imp22-forward-sol-quiz-corpus-v2",
    rawSha256: "9d59ac17cdc79df71eac763a78450f32faea4b535136cf8ef944c63d9d470c4b",
    substantiveCorpusSha256: "sha256:bc7a9ede537e85394d7a794d09a62462bbfda2684df8426072b8a38ac25aadad",
  },
} as const;

export const IMP24_SOURCE_PRIMARY_CATEGORY_PRECEDENCE = [
  "source_contradiction",
  "unsupported_attribution",
  "claim_strength_overreach",
  "missing_visible_framing",
  "generic_specificity_leak",
  "invented_detail",
  "missing_required_evidence",
] as const;

export type Imp24ReviewRole = "reader" | "source" | "quiz";
export type Imp24CorpusPartitionName = "canary" | "holdout";
export type Imp24SourcePrimaryCategory = (typeof IMP24_SOURCE_PRIMARY_CATEGORY_PRECEDENCE)[number];

export class Imp24CorpusError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "Imp24CorpusError";
    this.issues = issues;
  }
}

export type Imp24FrozenJsonInput = {
  fileName: string;
  bytes: Buffer;
};

export type Imp24FrozenV2Inputs = {
  reader: Imp24FrozenJsonInput;
  source: Imp24FrozenJsonInput;
  quiz: Imp24FrozenJsonInput;
};

export type Imp24ControlledMutation = {
  schema: "imp24-controlled-mutation-v1";
  mutationId: string;
  declaredPaths: string[];
  operationCount: number;
  primaryDefect: string;
  secondaryCategories: string[];
  protectedProjectionSha256: string;
  specificityKind: "named_organization" | "date" | "exact_metric" | "quotation" | null;
};

export type Imp24CaseGovernance = {
  schema: "imp24-case-governance-v1";
  v2InputCaseId: string;
  v2InputCaseSha256: string;
  goldProvenance: "fresh-model-free-audit-of-frozen-v2-fixture";
  canaryExcludedFromMetrics: boolean;
  eligibleForPreLiveFreeze: true;
  controlledMutation: Imp24ControlledMutation | null;
};

export type Imp24ReaderCase = Omit<ReaderCorpusCaseV2, "caseId" | "partition" | "substantiveCaseSha256"> & {
  caseId: string;
  partition: Imp24CorpusPartitionName;
  imp24: Imp24CaseGovernance;
  substantiveCaseSha256: string;
};

export type Imp24SourceCase = Omit<
  Imp22SourceCorpusCaseV2,
  "caseId" | "partition" | "pairedCaseId" | "evidence" | "expected" | "mutation" | "provenance"
> & {
  caseId: string;
  partition: Imp24CorpusPartitionName;
  pairedCaseId: string;
  evidence: Imp22SourceCorpusCaseV2["evidence"];
  expected: Imp22SourceCorpusCaseV2["expected"] & {
    expectedPrimaryCategory: Imp24SourcePrimaryCategory | null;
    expectedSecondaryCategories: string[];
  };
  mutation: {
    schema: "imp24-source-controlled-mutation-v1";
    pairKey: string;
    cleanCaseId: string;
    defectCaseId: string;
    declaredMutationPaths: ["evidence.chapterUnit"];
    cleanChapterUnitSha256: string;
    defectChapterUnitSha256: string;
    protectedProjectionSha256: string;
  };
  provenance: Imp22SourceCorpusCaseV2["provenance"] & {
    pairKey: string;
    basisKind: "source-bound-fact" | "constructed-application" | "generic-operational";
    basisSlot: string;
  };
  imp24: Imp24CaseGovernance;
  substantiveCaseSha256: string;
};

/**
 * Model-free source gold derived from compiler-owned plan/anchor/source bytes
 * and the exact reader-facing chapter unit.  The retained `item.expected`
 * object is deliberately absent from this type and from both derivation paths.
 */
export type Imp24DerivedSourceSemantics = {
  result: "PASS" | "BLOCK";
  supportStatus: "SUPPORTED" | "UNSUPPORTED" | "NOT_APPLICABLE";
  primaryCategory: Imp24SourcePrimaryCategory | null;
  secondaryCategories: Imp24SourcePrimaryCategory[];
  visibleRegister: "clearly_sourced" | "clearly_constructed" | "clearly_generic" | "presented_as_fact";
  framingAdequate: boolean | null;
  claimStrengthFit: boolean | null;
  namedSpecificityAllowed: boolean | null;
};

type Imp24SourceSemanticInput = Pick<Imp24SourceCase, "caseId" | "evidence">;

export type Imp24QuizCase = Omit<QuizCorpusCaseV2, "caseId" | "partition" | "substantiveCaseSha256"> & {
  caseId: string;
  partition: Imp24CorpusPartitionName;
  imp24: Imp24CaseGovernance;
  substantiveCaseSha256: string;
};

export type Imp24CorpusPartition<TCase> = {
  partition: Imp24CorpusPartitionName;
  expectedCount: number;
  generatedComposition: Record<string, number>;
  cases: TCase[];
  substantivePartitionSha256: string;
};

export type Imp24RoleCorpus<TCase> = {
  schema: typeof IMP24_CORPUS_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  role: Imp24ReviewRole;
  corpusId: string;
  sourceV2CorpusId: string;
  sourceV2RawSha256: string;
  sourceV2SubstantiveCorpusSha256: string;
  canary: Imp24CorpusPartition<TCase>;
  holdout: Imp24CorpusPartition<TCase>;
  substantiveCorpusSha256: string;
};

export type Imp24CorpusBundle = {
  schema: typeof IMP24_CORPUS_BUNDLE_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  reader: Imp24RoleCorpus<Imp24ReaderCase>;
  source: Imp24RoleCorpus<Imp24SourceCase>;
  quiz: Imp24RoleCorpus<Imp24QuizCase>;
  substantiveBundleSha256: string;
};

type FrozenV2Corpus<TCase> = {
  schema: string;
  role: Imp24ReviewRole;
  corpusId: string;
  substantiveCorpusSha256: string;
  partitions: {
    calibration: { cases: TCase[] };
    holdout: { cases: TCase[] };
  };
};

type ParsedFrozenInputs = {
  reader: FrozenV2Corpus<ReaderCorpusCaseV2>;
  source: FrozenV2Corpus<Imp22SourceCorpusCaseV2>;
  quiz: FrozenV2Corpus<QuizCorpusCaseV2>;
};

type AuditCounts = Record<Imp24ReviewRole, Record<Imp24CorpusPartitionName, number>>;
type AuditSemanticCaseSha256 = Record<Imp24ReviewRole, Record<string, string>>;
type AuditCaseSha256 = Record<Imp24ReviewRole, Record<string, string>>;
type AuditPartitionSha256 = Record<Imp24ReviewRole, Record<Imp24CorpusPartitionName, string>>;
type AuditRoleSha256 = Record<Imp24ReviewRole, string>;
type AuditSourceInputSha256 = Record<Imp24ReviewRole, string>;

export type Imp24CorpusAuditPass = {
  schema: typeof IMP24_CORPUS_AUDIT_SCHEMA;
  passId: "independent-object-audit" | "independent-serialized-audit";
  status: "PASS" | "FAIL";
  issues: string[];
  counts: AuditCounts;
  artifactBytesSha256: string;
  sourceInputRawSha256: AuditSourceInputSha256;
  caseSha256: AuditCaseSha256;
  partitionSha256: AuditPartitionSha256;
  roleSha256: AuditRoleSha256;
  bundleSha256: string;
  evidenceEnvelopeSha256: AuditCaseSha256;
  semanticCaseSha256: AuditSemanticCaseSha256;
  agreementProjectionSha256: string;
};

export type Imp24RetainedCorpusAuditOptions = {
  /** Canonical retained V3 bundle written by certification materialization. */
  corpusBundlePath: string;
  /** Directory containing the byte-frozen reader/source/quiz V2 inputs. */
  contractsDir: string;
};

export type Imp24CorpusCertification = {
  schema: "imp24-corpus-certification-v1";
  status: "PASS";
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  passA: Imp24CorpusAuditPass;
  passB: Imp24CorpusAuditPass;
  agreementSha256: string;
};

/**
 * Frozen model-free semantic proofs for the eleven clean quiz controls.  These
 * hashes were derived by inspecting the prompt, every choice, and the stored
 * explanation before V3 qualification.  The defensible answer is identified
 * by choice bytes, never by the mutable `correctIndex` or retained gold label.
 *
 * Pass A addresses the proof by immutable corpus coordinate and validates the
 * prompt/explanation/choice components separately.  Pass B uses the distinct
 * evidence-digest lookup below.  Keeping the two representations separate is
 * intentional: a defect in one lookup cannot silently manufacture agreement.
 */
type QuizCleanSemanticProofA = {
  promptSha256: string;
  explanationSha256: string;
  semanticEvidenceSha256: string;
  defensibleChoiceSha256: string;
  distractorChoiceSha256s: [string, string];
};

const QUIZ_CLEAN_SEMANTIC_PROOFS_A: Readonly<Record<string, QuizCleanSemanticProofA>> = Object.freeze({
  "canary|decisive|2|1": {
    promptSha256: "sha256:71406e55f9c2e10c2dbb9b34a0b54218351ee3af38e2098225dcd85117e9b16b",
    explanationSha256: "sha256:563dfa6253737637b7f30ff532bd4838b66583337364c1bd6b5d8225be460da4",
    semanticEvidenceSha256: "sha256:cf63f29537557567a75e7caa6e942a43400e0b9174bd3e55a0b62538214c7bf0",
    defensibleChoiceSha256: "sha256:85b125461f740d1073e98fd500049da90a34e1991ef71f782606b6e7de21b37b",
    distractorChoiceSha256s: [
      "sha256:97b1ba318bfcc2b6ae8b968ca636a461e3b7908c0f7a49a0ca69fb0fe37f629f",
      "sha256:ecb914d6a9302f1b0eaf702f9eabe72e2193d63baa5550290d72fc8a1fc4a6cd",
    ],
  },
  "holdout|behave|1|1": {
    promptSha256: "sha256:40d57a4aede5e522d81e94c6c479dd903a00bcc37fb4b9acb25e8685d2226943",
    explanationSha256: "sha256:1e13cca6bbe914c32adf4e7488353c03b496c6c0e89df6f8785ae14abd5e880c",
    semanticEvidenceSha256: "sha256:3a864b9175dd1f2d627053151a1521d575993c48ae1f24f8e77fad18d9e9d4e6",
    defensibleChoiceSha256: "sha256:350782203b83b8ab69ae032e34994908302414a362847b2c417b7a471e0bffa7",
    distractorChoiceSha256s: [
      "sha256:0b513447378407999a35c616f68b250a9c59861b78848e94f95c4fbe78639a5b",
      "sha256:5b5c4dbc5002b2b1077a6f9aaaa323b6d1ee10b8eb435555291e0f17d0a150de",
    ],
  },
  "holdout|behave|2|1": {
    promptSha256: "sha256:3066efef69472733e6052d8e57bcb201bddeffb62f21e16b196d5d6ac33d40ff",
    explanationSha256: "sha256:d8df2aeca4db00b8101ebbe7c02914380c9a59047a7cb530f486abd6f36eac59",
    semanticEvidenceSha256: "sha256:be518d30e5fab849fe8fa8bb7523f60a7ed3b234a0decbebdfdee973e9ff400c",
    defensibleChoiceSha256: "sha256:2ae50780b24911e48725cb7c4b57bde4749f3b27bff46661a55225c13ed7244c",
    distractorChoiceSha256s: [
      "sha256:7ca6bf23bcdcd3f683b806beca4f20be1f39e3ef34d605e8aab22df7d0951593",
      "sha256:d2c5aadc91a92d9264dba9ec5e585cf476a2197ed9d57ff99b4a7321c9bb95b7",
    ],
  },
  "holdout|the-checklist-manifesto|1|1": {
    promptSha256: "sha256:103c64c049013353e1bb9afaaa285ab233c9b7746251195fb2c4eb343a34f4c7",
    explanationSha256: "sha256:2bd8c2fbc3ff1c2bbcbe58db02eaf3d8b1758762e01ba6c5e742b7b9ab7e139c",
    semanticEvidenceSha256: "sha256:42a965b2789482af3fc86f962e15036fb8c0f7954f6149ca948b01437b0c7006",
    defensibleChoiceSha256: "sha256:5d3d68d5582e70b96ace0856f87b45c81a8af22583f995b876e3f9dc451a0ca3",
    distractorChoiceSha256s: [
      "sha256:401eb447bf1a766a038c65b79cd507f24f88c946c480c0c3f62f2f19affa6d19",
      "sha256:660376dba4d931a93a5d3168dd907a7421650b76be9e3ec4eafde44a9bf29452",
    ],
  },
  "holdout|the-checklist-manifesto|2|1": {
    promptSha256: "sha256:06d7860e1d1333c6aac4b64ab1cd6b75d57506b76964e85d49bab43711f3b79a",
    explanationSha256: "sha256:8d6dd0a9e24f111195934e287b2037ebafdc888b9475ff2f4584172150c366e2",
    semanticEvidenceSha256: "sha256:82114ec40dbb488d4be82f8d45576fc71a42c1e7495fe7e878e5d247704df1ad",
    defensibleChoiceSha256: "sha256:5b87e51a0a03f73bf4bda5f294dddd85a9eb358e2a5a89fb23c6849563836851",
    distractorChoiceSha256s: [
      "sha256:321510677e8a5bf745767fb9a57d7fbe871518c477b7922f7a1952f395b919d0",
      "sha256:f437e78195625dab3db7ec77d4ac894f02717db6ece537d4ae13cc255295418d",
    ],
  },
  "holdout|difficult-conversations|2|1": {
    promptSha256: "sha256:0100d9dc9af915b8b16b1ecfe892e67b14238978be259a3fbbd48d43b836a57c",
    explanationSha256: "sha256:19e88bb0c1762ef778b73c2f23357bcb81805e2545f8957e42323febef43d5b9",
    semanticEvidenceSha256: "sha256:0abdff86d78218b54e8895b9226482059038c27869e9ddf396a6eb4607520b5f",
    defensibleChoiceSha256: "sha256:bfa7dd6fe1109271d87a3ec413c0cfb13ed9ecec28ebe02c8fc9457d6312fb88",
    distractorChoiceSha256s: [
      "sha256:1afe7519aa538faef66ec2b2456f19c484ee88a35160823903ad69528cf3fa31",
      "sha256:bfeadda499b0413991d03e576c4901a638a522c18e6b147ab05d42f0c21f67b9",
    ],
  },
  "holdout|make-it-stick|1|1": {
    promptSha256: "sha256:6a1604b1839e9365e8ee27f85a0c558e334c0b2e385c16417068914c62472c21",
    explanationSha256: "sha256:5ae11b55321bf4d13ea05e169f5d36c2414a71d77531e96a7e3223da2cb695ef",
    semanticEvidenceSha256: "sha256:1611cd59065edf51d4688ab646fb5c91dbb1a0fc0266cecf6580af9f1e8ccd60",
    defensibleChoiceSha256: "sha256:1ee5ce2d7b7a7a2244e85d6bfb1644c02923d27887fbdae35e2203ac892333d1",
    distractorChoiceSha256s: [
      "sha256:31fbc2d0c41cfb1c7590dd5b1eb3e25dba68c1ae74faa153a759d456cc4a3395",
      "sha256:f04ed57431518b6bce7cfab0525d9396928e79058b502673b6e1c2009c819899",
    ],
  },
  "holdout|make-it-stick|2|1": {
    promptSha256: "sha256:617ea1fd860f0c0a23801f53664e41f5e973d5060a090c00de9f5a4588f3b601",
    explanationSha256: "sha256:7286f2c7b51dbe80a395898f158d4ca5681648f0a293de8c98802f422c9f2c3f",
    semanticEvidenceSha256: "sha256:e00574da30ccab6f950ebd59fd178e5a34da5c18af04a42fd5d1eff44613143e",
    defensibleChoiceSha256: "sha256:9c291b3122e3f2da028131d254d6abb128c6d531cf68e43c804f5fd80def7c15",
    distractorChoiceSha256s: [
      "sha256:0951818cb367600cecb220df04dd79f70eb5d490ccc7b651853e150609660c67",
      "sha256:ded11af65d28ffe33b6423d0d90375811dda4bc7cf18689a6e2d67924af25c87",
    ],
  },
  "holdout|peak|2|1": {
    promptSha256: "sha256:37491933bed89dc939219bc35e28887b532c3ae4a46e3940ae1ef7a5164b42c4",
    explanationSha256: "sha256:5811c5b279fbb9484898a3f15fe23e4b97a1fd6a243568eb8c8195e3ec2cff6d",
    semanticEvidenceSha256: "sha256:9921b8bc6713d44ef30f36c7fc9d8bdcc0c49d6d5d04cdff36f9f9055fec7fb5",
    defensibleChoiceSha256: "sha256:f32a3cbf1aa2259589c2b27bd8bb8fb489dc9b54d5c871a5ead033987ea9f401",
    distractorChoiceSha256s: [
      "sha256:171d78eb1ca24d82e31c87ec4a09352a9ab8455c11b75cf0a22ed15bd5852e73",
      "sha256:7b15378f1de51c42a6480d4e6e3c7e177e2a20e2f1a9acff310be0359739d82d",
    ],
  },
  "holdout|the-willpower-instinct|1|1": {
    promptSha256: "sha256:709e3caf9f005c384f59706d4e2335e82842136b24aa5792333aedf84ecf048b",
    explanationSha256: "sha256:04d99d92dc746aa52671e63ecb0cfed66a531800ba5c8558bd1341e1686c76b6",
    semanticEvidenceSha256: "sha256:20d80d9f401a647c2a5dd614e6596d29de8188dd931d1de9636f867350237750",
    defensibleChoiceSha256: "sha256:a7c7cc8a00abacfd45eccb3188527aadad4f67c377a44e6adfcf13b0525a623f",
    distractorChoiceSha256s: [
      "sha256:2e4f4b6db7853a774114c16a88f9c6cbffc22b7cd4b090db94667261917d5f2d",
      "sha256:2eb51b50dcabfbc9cbce80b7a222d62a20c23a8ad5665d25c240fd84523d9850",
    ],
  },
  "holdout|the-willpower-instinct|2|1": {
    promptSha256: "sha256:219f8e4986a00a4ab1c50591ef1b84a0c966658c9df36d1fae6f5277b17f9f02",
    explanationSha256: "sha256:f8399c0de413c36372e1286669c21e32e9721a89c0e371dac3f9a49b20e3aa52",
    semanticEvidenceSha256: "sha256:336a55c29a5a97246e676e68e6d7ddf59f5563eb2ca2c4282f3af0bfb20e32d9",
    defensibleChoiceSha256: "sha256:a4ea918e9f0058f417ac6d8db53b6f44790cd59caa6f47816d16e095d1a2f33e",
    distractorChoiceSha256s: [
      "sha256:d1e5aab8d175e369b5c0d49a0313581896b1545ba2682c7f4b6632a3234c378b",
      "sha256:f9e540964f6dd293e747ddac0d0200288d3821344316e35ad45d8ca3778ab5c3",
    ],
  },
});

type QuizSemanticDigestProofB = {
  coordinate: string;
  defensibleChoiceSha256: string;
};

const QUIZ_CLEAN_SEMANTIC_DIGESTS_B: Readonly<Record<string, QuizSemanticDigestProofB>> = Object.freeze({
  "sha256:cf63f29537557567a75e7caa6e942a43400e0b9174bd3e55a0b62538214c7bf0": { coordinate: "canary|decisive|2|1", defensibleChoiceSha256: "sha256:85b125461f740d1073e98fd500049da90a34e1991ef71f782606b6e7de21b37b" },
  "sha256:3a864b9175dd1f2d627053151a1521d575993c48ae1f24f8e77fad18d9e9d4e6": { coordinate: "holdout|behave|1|1", defensibleChoiceSha256: "sha256:350782203b83b8ab69ae032e34994908302414a362847b2c417b7a471e0bffa7" },
  "sha256:be518d30e5fab849fe8fa8bb7523f60a7ed3b234a0decbebdfdee973e9ff400c": { coordinate: "holdout|behave|2|1", defensibleChoiceSha256: "sha256:2ae50780b24911e48725cb7c4b57bde4749f3b27bff46661a55225c13ed7244c" },
  "sha256:42a965b2789482af3fc86f962e15036fb8c0f7954f6149ca948b01437b0c7006": { coordinate: "holdout|the-checklist-manifesto|1|1", defensibleChoiceSha256: "sha256:5d3d68d5582e70b96ace0856f87b45c81a8af22583f995b876e3f9dc451a0ca3" },
  "sha256:82114ec40dbb488d4be82f8d45576fc71a42c1e7495fe7e878e5d247704df1ad": { coordinate: "holdout|the-checklist-manifesto|2|1", defensibleChoiceSha256: "sha256:5b87e51a0a03f73bf4bda5f294dddd85a9eb358e2a5a89fb23c6849563836851" },
  "sha256:0abdff86d78218b54e8895b9226482059038c27869e9ddf396a6eb4607520b5f": { coordinate: "holdout|difficult-conversations|2|1", defensibleChoiceSha256: "sha256:bfa7dd6fe1109271d87a3ec413c0cfb13ed9ecec28ebe02c8fc9457d6312fb88" },
  "sha256:1611cd59065edf51d4688ab646fb5c91dbb1a0fc0266cecf6580af9f1e8ccd60": { coordinate: "holdout|make-it-stick|1|1", defensibleChoiceSha256: "sha256:1ee5ce2d7b7a7a2244e85d6bfb1644c02923d27887fbdae35e2203ac892333d1" },
  "sha256:e00574da30ccab6f950ebd59fd178e5a34da5c18af04a42fd5d1eff44613143e": { coordinate: "holdout|make-it-stick|2|1", defensibleChoiceSha256: "sha256:9c291b3122e3f2da028131d254d6abb128c6d531cf68e43c804f5fd80def7c15" },
  "sha256:9921b8bc6713d44ef30f36c7fc9d8bdcc0c49d6d5d04cdff36f9f9055fec7fb5": { coordinate: "holdout|peak|2|1", defensibleChoiceSha256: "sha256:f32a3cbf1aa2259589c2b27bd8bb8fb489dc9b54d5c871a5ead033987ea9f401" },
  "sha256:20d80d9f401a647c2a5dd614e6596d29de8188dd931d1de9636f867350237750": { coordinate: "holdout|the-willpower-instinct|1|1", defensibleChoiceSha256: "sha256:a7c7cc8a00abacfd45eccb3188527aadad4f67c377a44e6adfcf13b0525a623f" },
  "sha256:336a55c29a5a97246e676e68e6d7ddf59f5563eb2ca2c4282f3af0bfb20e32d9": { coordinate: "holdout|the-willpower-instinct|2|1", defensibleChoiceSha256: "sha256:a4ea918e9f0058f417ac6d8db53b6f44790cd59caa6f47816d16e095d1a2f33e" },
});

type QuizMechanismSemanticProofA = {
  semanticEvidenceSha256: string;
  defensibleChoiceSha256: string;
  supportSha256: string;
  mode: "supported" | "causal-overreach";
};

const QUIZ_MECHANISM_SEMANTIC_PROOFS_A: Readonly<Record<string, QuizMechanismSemanticProofA>> = Object.freeze({
  "holdout|behave|1|1": { semanticEvidenceSha256: "sha256:7948932a52ca33a2f3d874289ae6432112416988947960bee4c88d57c6dad1c5", defensibleChoiceSha256: "sha256:11ae779234ac47643ea425da949f53f19c01794b51c359ee698dfece4d2d6c67", supportSha256: "sha256:beef32b65e4872187c2fbac632e7329259cd3e974d5bab82713290b3cd2a459f", mode: "supported" },
  "holdout|behave|2|1": { semanticEvidenceSha256: "sha256:7948932a52ca33a2f3d874289ae6432112416988947960bee4c88d57c6dad1c5", defensibleChoiceSha256: "sha256:11ae779234ac47643ea425da949f53f19c01794b51c359ee698dfece4d2d6c67", supportSha256: "sha256:beef32b65e4872187c2fbac632e7329259cd3e974d5bab82713290b3cd2a459f", mode: "supported" },
  "holdout|the-checklist-manifesto|1|1": { semanticEvidenceSha256: "sha256:a8a74ed459c8a20cf1cdffc5896d7796a509adc69b70f377255f1f6d01aa60d5", defensibleChoiceSha256: "sha256:b44977234b0fb856909cdb9e1eb3c25ed291e7c586d10df80c7aa80191ba8ceb", supportSha256: "sha256:70926245f6fee5dbe73010bb5c2d6496d3717cbc5072a43eb183cbed4cbf3663", mode: "causal-overreach" },
  "holdout|the-checklist-manifesto|2|1": { semanticEvidenceSha256: "sha256:a8a74ed459c8a20cf1cdffc5896d7796a509adc69b70f377255f1f6d01aa60d5", defensibleChoiceSha256: "sha256:b44977234b0fb856909cdb9e1eb3c25ed291e7c586d10df80c7aa80191ba8ceb", supportSha256: "sha256:70926245f6fee5dbe73010bb5c2d6496d3717cbc5072a43eb183cbed4cbf3663", mode: "causal-overreach" },
  "holdout|difficult-conversations|2|1": { semanticEvidenceSha256: "sha256:dbf18950b4840a290bcbce0f6ba78c3e3a3641122570c5d7078c0471363365d0", defensibleChoiceSha256: "sha256:287c05ed71ca4a7cefeac06a99fa836d7d64ffd9f95839fd5e913d98778fa4e1", supportSha256: "sha256:d7396e24a67bd5284d55cc2edeb25c7627636c0ffbc92be739fa010c428a2787", mode: "supported" },
  "holdout|make-it-stick|1|1": { semanticEvidenceSha256: "sha256:35fdd73cb4dc2298c6dd6b0a457f42bd08d4e48c52c024e015236eda892cc856", defensibleChoiceSha256: "sha256:76e26d3ac61c249948f24d6f32169136ec6f9938cb70185bf631b1e6c3760376", supportSha256: "sha256:d4bf4c07e54874c5ab67e332a8187d5240747e5aa9d02006b0292f212bb215ca", mode: "causal-overreach" },
  "holdout|make-it-stick|2|1": { semanticEvidenceSha256: "sha256:35fdd73cb4dc2298c6dd6b0a457f42bd08d4e48c52c024e015236eda892cc856", defensibleChoiceSha256: "sha256:76e26d3ac61c249948f24d6f32169136ec6f9938cb70185bf631b1e6c3760376", supportSha256: "sha256:d4bf4c07e54874c5ab67e332a8187d5240747e5aa9d02006b0292f212bb215ca", mode: "causal-overreach" },
  "holdout|peak|2|1": { semanticEvidenceSha256: "sha256:a8a74ed459c8a20cf1cdffc5896d7796a509adc69b70f377255f1f6d01aa60d5", defensibleChoiceSha256: "sha256:b44977234b0fb856909cdb9e1eb3c25ed291e7c586d10df80c7aa80191ba8ceb", supportSha256: "sha256:70926245f6fee5dbe73010bb5c2d6496d3717cbc5072a43eb183cbed4cbf3663", mode: "causal-overreach" },
  "holdout|the-willpower-instinct|1|1": { semanticEvidenceSha256: "sha256:dbf18950b4840a290bcbce0f6ba78c3e3a3641122570c5d7078c0471363365d0", defensibleChoiceSha256: "sha256:287c05ed71ca4a7cefeac06a99fa836d7d64ffd9f95839fd5e913d98778fa4e1", supportSha256: "sha256:d7396e24a67bd5284d55cc2edeb25c7627636c0ffbc92be739fa010c428a2787", mode: "supported" },
  "holdout|the-willpower-instinct|2|1": { semanticEvidenceSha256: "sha256:dbf18950b4840a290bcbce0f6ba78c3e3a3641122570c5d7078c0471363365d0", defensibleChoiceSha256: "sha256:287c05ed71ca4a7cefeac06a99fa836d7d64ffd9f95839fd5e913d98778fa4e1", supportSha256: "sha256:d7396e24a67bd5284d55cc2edeb25c7627636c0ffbc92be739fa010c428a2787", mode: "supported" },
});

const QUIZ_MECHANISM_SEMANTIC_DIGESTS_B: Readonly<Record<string, { defensibleChoiceSha256: string; supportSha256: string; mode: "supported" | "causal-overreach" }>> = Object.freeze({
  "sha256:7948932a52ca33a2f3d874289ae6432112416988947960bee4c88d57c6dad1c5": { defensibleChoiceSha256: "sha256:11ae779234ac47643ea425da949f53f19c01794b51c359ee698dfece4d2d6c67", supportSha256: "sha256:beef32b65e4872187c2fbac632e7329259cd3e974d5bab82713290b3cd2a459f", mode: "supported" },
  "sha256:a8a74ed459c8a20cf1cdffc5896d7796a509adc69b70f377255f1f6d01aa60d5": { defensibleChoiceSha256: "sha256:b44977234b0fb856909cdb9e1eb3c25ed291e7c586d10df80c7aa80191ba8ceb", supportSha256: "sha256:70926245f6fee5dbe73010bb5c2d6496d3717cbc5072a43eb183cbed4cbf3663", mode: "causal-overreach" },
  "sha256:dbf18950b4840a290bcbce0f6ba78c3e3a3641122570c5d7078c0471363365d0": { defensibleChoiceSha256: "sha256:287c05ed71ca4a7cefeac06a99fa836d7d64ffd9f95839fd5e913d98778fa4e1", supportSha256: "sha256:d7396e24a67bd5284d55cc2edeb25c7627636c0ffbc92be739fa010c428a2787", mode: "supported" },
  "sha256:35fdd73cb4dc2298c6dd6b0a457f42bd08d4e48c52c024e015236eda892cc856": { defensibleChoiceSha256: "sha256:76e26d3ac61c249948f24d6f32169136ec6f9938cb70185bf631b1e6c3760376", supportSha256: "sha256:d4bf4c07e54874c5ab67e332a8187d5240747e5aa9d02006b0292f212bb215ca", mode: "causal-overreach" },
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseFrozenInput<TCase>(
  input: Imp24FrozenJsonInput,
  role: Imp24ReviewRole,
): FrozenV2Corpus<TCase> {
  const frozen = IMP24_FROZEN_V2_INPUTS[role];
  if (input.fileName !== frozen.fileName) {
    throw new Imp24CorpusError(`${role} input filename is not the frozen IMP-22 identity`, [
      `expected ${frozen.fileName}, got ${input.fileName}`,
    ]);
  }
  const rawSha256 = sha256Hex(input.bytes);
  if (rawSha256 !== frozen.rawSha256) {
    throw new Imp24CorpusError(`${role} frozen IMP-22 corpus bytes drifted`, [
      `expected ${frozen.rawSha256}, got ${rawSha256}`,
    ]);
  }
  let parsed: FrozenV2Corpus<TCase>;
  try {
    parsed = JSON.parse(input.bytes.toString("utf8")) as FrozenV2Corpus<TCase>;
  } catch (error) {
    throw new Imp24CorpusError(`${role} frozen IMP-22 corpus is not JSON`, [(error as Error).message]);
  }
  if (parsed.schema !== "split-lane-role-corpus-v2"
    || parsed.role !== role
    || parsed.corpusId !== frozen.corpusId
    || parsed.substantiveCorpusSha256 !== frozen.substantiveCorpusSha256) {
    throw new Imp24CorpusError(`${role} frozen IMP-22 corpus identity mismatch`, [
      `schema=${parsed.schema}`,
      `role=${parsed.role}`,
      `corpusId=${parsed.corpusId}`,
      `substantiveCorpusSha256=${parsed.substantiveCorpusSha256}`,
    ]);
  }
  if (!Array.isArray(parsed.partitions?.calibration?.cases)
    || !Array.isArray(parsed.partitions?.holdout?.cases)) {
    throw new Imp24CorpusError(`${role} frozen IMP-22 corpus is missing calibration/holdout cases`);
  }
  return parsed;
}

function parseFrozenInputs(inputs: Imp24FrozenV2Inputs): ParsedFrozenInputs {
  return {
    reader: parseFrozenInput<ReaderCorpusCaseV2>(inputs.reader, "reader"),
    source: parseFrozenInput<Imp22SourceCorpusCaseV2>(inputs.source, "source"),
    quiz: parseFrozenInput<QuizCorpusCaseV2>(inputs.quiz, "quiz"),
  };
}

export function loadImp24FrozenV2Inputs(contractsDir: string): Imp24FrozenV2Inputs {
  const read = (role: Imp24ReviewRole): Imp24FrozenJsonInput => {
    const fileName = IMP24_FROZEN_V2_INPUTS[role].fileName;
    return { fileName, bytes: readFileSync(resolve(contractsDir, fileName)) };
  };
  return { reader: read("reader"), source: read("source"), quiz: read("quiz") };
}

function composition(cases: Array<{ kind?: string; family?: string; pairSide?: string }>): Record<string, number> {
  const result: Record<string, number> = { total: cases.length };
  for (const item of cases) {
    const key = item.kind ?? `${item.family ?? "unknown"}:${item.pairSide ?? "unknown"}`;
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function governance(
  v2Case: { caseId: string },
  partition: Imp24CorpusPartitionName,
  mutation: Omit<Imp24ControlledMutation, "schema"> | null,
): Imp24CaseGovernance {
  return {
    schema: "imp24-case-governance-v1",
    v2InputCaseId: v2Case.caseId,
    v2InputCaseSha256: hashValue(v2Case),
    goldProvenance: "fresh-model-free-audit-of-frozen-v2-fixture",
    canaryExcludedFromMetrics: partition === "canary",
    eligibleForPreLiveFreeze: true,
    controlledMutation: mutation ? { schema: "imp24-controlled-mutation-v1", ...mutation } : null,
  };
}

function buildReaderCase(v2Case: ReaderCorpusCaseV2, partition: Imp24CorpusPartitionName): Imp24ReaderCase {
  const cloned = clone(v2Case);
  const caseId = cloned.caseId
    .replace("READER-V2-CALIBRATION-", "READER-V3-CANARY-")
    .replace("READER-V2-HOLDOUT-", "READER-V3-HOLDOUT-");
  const ops = cloned.provenance.mutationOps;
  const primary = cloned.kind === "reader-visible-hard-blocker"
    ? String(cloned.expected.expectedBlockingCategory ?? "reader-visible-hard-blocker")
    : cloned.kind === "craft-nonblocker"
      ? String(cloned.expected.expectedWeakness ?? "craft-nonblocker")
      : null;
  const mutation = primary === null ? null : {
    mutationId: `${caseId}-controlled-mutation`,
    declaredPaths: ops.map((op) => op.path),
    operationCount: ops.length,
    primaryDefect: primary,
    secondaryCategories: [],
    protectedProjectionSha256: cloned.provenance.protectedContentSha256,
    specificityKind: null,
  } satisfies Omit<Imp24ControlledMutation, "schema">;
  const payload = {
    ...cloned,
    caseId,
    partition,
    imp24: governance(v2Case, partition, mutation),
  };
  delete (payload as Partial<ReaderCorpusCaseV2>).substantiveCaseSha256;
  return { ...payload, substantiveCaseSha256: hashValue(payload) };
}

function buildQuizCase(v2Case: QuizCorpusCaseV2, partition: Imp24CorpusPartitionName): Imp24QuizCase {
  const cloned = clone(v2Case);
  const caseId = cloned.caseId
    .replace("QUIZ-V2-CALIBRATION-", "QUIZ-V3-CANARY-")
    .replace("QUIZ-V2-HOLDOUT-", "QUIZ-V3-HOLDOUT-");
  const ops = cloned.provenance.mutationOps;
  const primary = cloned.kind === "key-mismatch"
    ? "wrong_key"
    : cloned.kind === "genuine-ambiguity"
      ? "genuine_ambiguity"
      : cloned.kind === "mechanism-causal-key" && cloned.expected.goldResult === "BLOCK"
        ? "mechanism_mismatch"
        : null;
  const mutation = primary === null ? null : {
    mutationId: `${caseId}-controlled-mutation`,
    declaredPaths: ops.map((op) => op.path),
    operationCount: ops.length,
    primaryDefect: primary,
    secondaryCategories: [],
    protectedProjectionSha256: cloned.provenance.protectedContentSha256,
    specificityKind: null,
  } satisfies Omit<Imp24ControlledMutation, "schema">;
  const payload = {
    ...cloned,
    caseId,
    partition,
    imp24: governance(v2Case, partition, mutation),
  };
  delete (payload as Partial<QuizCorpusCaseV2>).substantiveCaseSha256;
  return { ...payload, substantiveCaseSha256: hashValue(payload) };
}

type SourcePairText = {
  clean: string;
  defect: string;
  basisKind: Imp24SourceCase["provenance"]["basisKind"];
  specificityKind: Imp24ControlledMutation["specificityKind"];
};

const CONSTRUCTED_TEXT_PAIRS: readonly SourcePairText[] = [
  {
    clean: "Consider a hypothetical support team testing a short notification-free focus block before reviewing its queue.",
    defect: "A support team tested a short notification-free focus block before reviewing its queue.",
    basisKind: "constructed-application",
    specificityKind: null,
  },
  {
    clean: "Imagine a hypothetical project team trying a visible decision log during a fictional product-planning exercise.",
    defect: "A project team tried a visible decision log during a product-planning exercise.",
    basisKind: "constructed-application",
    specificityKind: null,
  },
  {
    clean: "Suppose a fictional workshop facilitator asks a hypothetical group to pause before choosing its next task.",
    defect: "A workshop facilitator asked a group to pause before choosing its next task.",
    basisKind: "constructed-application",
    specificityKind: null,
  },
  {
    clean: "In a hypothetical example, a service team tries grouping routine checks into one scheduled window.",
    defect: "A service team grouped routine checks into one scheduled window.",
    basisKind: "constructed-application",
    specificityKind: null,
  },
] as const;

const GENERIC_TEXT_PAIRS: readonly SourcePairText[] = [
  {
    clean: "A project manager can pause before opening a feed and compare the next action with the current task.",
    defect: "A project manager at Northstar Systems can pause before opening a feed and compare the next action with the current task.",
    basisKind: "generic-operational",
    specificityKind: "named_organization",
  },
  {
    clean: "A support lead can group routine alerts into a scheduled review window.",
    defect: "On March 12, 2019, a support lead can group routine alerts into a scheduled review window.",
    basisKind: "generic-operational",
    specificityKind: "date",
  },
  {
    clean: "A team member can mute a nonessential alert while completing one focused step.",
    defect: "A team member can mute a nonessential alert for exactly 47 minutes while completing one focused step.",
    basisKind: "generic-operational",
    specificityKind: "exact_metric",
  },
  {
    clean: "An operations coordinator can ask whether a quick check serves the current workflow.",
    defect: "An operations coordinator can say, “Check now,” before asking whether a quick check serves the current workflow.",
    basisKind: "generic-operational",
    specificityKind: "quotation",
  },
] as const;

function sourceProtectedProjection(evidence: Imp22SourceCorpusCaseV2["evidence"]): unknown {
  const projection = clone(evidence) as Imp22SourceCorpusCaseV2["evidence"];
  delete (projection as Partial<typeof projection>).chapterUnit;
  delete (projection as Partial<typeof projection>).goldChapterEvidenceSpans;
  delete (projection as Partial<typeof projection>).protectedProjectionSha256;
  const hashes = { ...projection.provenanceHashes } as Partial<typeof projection.provenanceHashes>;
  delete hashes.chapterContentSha256;
  projection.provenanceHashes = hashes as typeof projection.provenanceHashes;
  return projection;
}

function sourcePairText(
  clean: Imp22SourceCorpusCaseV2,
  partition: Imp24CorpusPartitionName,
  familySlot: number,
): SourcePairText {
  if (clean.pairId === "constructed-application-framing") return CONSTRUCTED_TEXT_PAIRS[familySlot];
  if (clean.pairId === "generic-operational-specificity") return GENERIC_TEXT_PAIRS[familySlot];
  return {
    clean: clean.evidence.chapterUnit,
    defect: "",
    basisKind: "source-bound-fact",
    specificityKind: null,
  };
}

function convertSourcePair(
  v2Clean: Imp22SourceCorpusCaseV2,
  v2Defect: Imp22SourceCorpusCaseV2,
  partition: Imp24CorpusPartitionName,
  familySlot: number,
): [Imp24SourceCase, Imp24SourceCase] {
  let texts = sourcePairText(v2Clean, partition, familySlot);
  if (texts.defect.length === 0) texts = { ...texts, defect: v2Defect.evidence.chapterUnit };
  const basisSlot = partition === "canary" ? "canary-01" : String(familySlot + 1).padStart(2, "0");
  const prefix = partition === "canary" ? "SOURCE-V3-CANARY" : "SOURCE-V3-HOLDOUT";
  const token = texts.basisKind === "constructed-application"
    ? `constructed-application-${basisSlot}`
    : texts.basisKind === "generic-operational"
      ? `generic-operational-${basisSlot}`
      : v2Clean.caseId
        .replace(/^SOURCE-(?:CALIBRATION|HOLDOUT)-/, "")
        .replace(/-clean$/, "");
  const cleanCaseId = `${prefix}-${token}-clean`;
  const defectCaseId = `${prefix}-${token}-defect`;
  const pairKey = `imp24::${partition}::${token}`;
  const protectedProjectionSha256 = hashValue(sourceProtectedProjection(v2Clean.evidence));
  const mutation = {
    schema: "imp24-source-controlled-mutation-v1" as const,
    pairKey,
    cleanCaseId,
    defectCaseId,
    declaredMutationPaths: ["evidence.chapterUnit"] as ["evidence.chapterUnit"],
    cleanChapterUnitSha256: sha256Hex(texts.clean),
    defectChapterUnitSha256: sha256Hex(texts.defect),
    protectedProjectionSha256,
  };

  const makeCase = (
    input: Imp22SourceCorpusCaseV2,
    side: "clean" | "defect",
  ): Imp24SourceCase => {
    const chapterUnit = side === "clean" ? texts.clean : texts.defect;
    const caseId = side === "clean" ? cleanCaseId : defectCaseId;
    const pairedCaseId = side === "clean" ? defectCaseId : cleanCaseId;
    const evidence = clone(input.evidence);
    evidence.chapterUnit = chapterUnit;
    evidence.goldChapterEvidenceSpans = [chapterUnit];
    evidence.provenanceHashes.chapterContentSha256 = sha256Hex(chapterUnit);
    evidence.protectedProjectionSha256 = protectedProjectionSha256;
    const derived = deriveImp24SourceSemantics({ caseId, evidence });
    const expected = {
      ...clone(input.expected),
      goldResult: derived.result,
      expectedVisibleRegister: derived.visibleRegister,
      expectedSupportStatus: derived.supportStatus,
      expectedCategory: derived.primaryCategory,
      expectedPrimaryCategory: derived.primaryCategory,
      expectedSecondaryCategories: [...derived.secondaryCategories],
      expectedFramingAdequate: derived.framingAdequate,
      expectedClaimStrengthFit: derived.claimStrengthFit,
      expectedNamedSpecificityAllowed: derived.namedSpecificityAllowed,
    };
    const controlledMutation = {
      mutationId: `${pairKey}-chapter-unit`,
      declaredPaths: ["evidence.chapterUnit"],
      operationCount: 1,
      primaryDefect: String(derived.primaryCategory ?? "none"),
      secondaryCategories: [...derived.secondaryCategories],
      protectedProjectionSha256,
      specificityKind: texts.specificityKind,
    } satisfies Omit<Imp24ControlledMutation, "schema">;
    const provenance = {
      ...clone(input.provenance),
      pairKey,
      basisKind: texts.basisKind,
      basisSlot,
      evidenceSha256: hashValue(evidence),
    };
    const payload = {
      ...clone(input),
      caseId,
      partition,
      pairedCaseId,
      evidence,
      expected,
      mutation,
      provenance,
      imp24: governance(input, partition, side === "defect" ? controlledMutation : null),
    };
    return { ...payload, substantiveCaseSha256: hashValue(payload) };
  };
  return [makeCase(v2Clean, "clean"), makeCase(v2Defect, "defect")];
}

function sourcePairs(cases: Imp22SourceCorpusCaseV2[]): Array<[Imp22SourceCorpusCaseV2, Imp22SourceCorpusCaseV2]> {
  const grouped = new Map<string, Imp22SourceCorpusCaseV2[]>();
  for (const item of cases) {
    const key = item.provenance.pairKey;
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }
  return [...grouped.values()]
    .map((group): [Imp22SourceCorpusCaseV2, Imp22SourceCorpusCaseV2] => {
      const clean = group.find((item) => item.pairSide === "clean");
      const defect = group.find((item) => item.pairSide === "defect");
      if (group.length !== 2 || !clean || !defect) {
        throw new Imp24CorpusError("frozen source pair is not exactly one clean plus one defect", group.map((c) => c.caseId));
      }
      return [clean, defect];
    })
    .sort((a, b) => a[0].caseId.localeCompare(b[0].caseId));
}

function makePartition<TCase extends { caseId: string; kind?: string; family?: string; pairSide?: string }>(
  partition: Imp24CorpusPartitionName,
  expectedCount: number,
  cases: TCase[],
): Imp24CorpusPartition<TCase> {
  const sorted = [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId));
  const payload = {
    partition,
    expectedCount,
    generatedComposition: composition(sorted),
    cases: sorted,
  };
  return { ...payload, substantivePartitionSha256: hashValue(payload) };
}

function makeRoleCorpus<TCase extends { caseId: string; kind?: string; family?: string; pairSide?: string }>(
  role: Imp24ReviewRole,
  sourceV2: FrozenV2Corpus<unknown>,
  canary: TCase[],
  holdout: TCase[],
): Imp24RoleCorpus<TCase> {
  const draft = {
    schema: IMP24_CORPUS_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    role,
    corpusId: `imp24-${role}-role-corpus-v3-envelope`,
    sourceV2CorpusId: sourceV2.corpusId,
    sourceV2RawSha256: IMP24_FROZEN_V2_INPUTS[role].rawSha256,
    sourceV2SubstantiveCorpusSha256: sourceV2.substantiveCorpusSha256,
    canary: makePartition("canary", IMP24_CORPUS_EXPECTED_COUNTS[role].canary, canary),
    holdout: makePartition("holdout", IMP24_CORPUS_EXPECTED_COUNTS[role].holdout, holdout),
  };
  return { ...draft, substantiveCorpusSha256: hashValue(draft) };
}

function pickExactly<T extends { caseId: string }>(cases: T[], ids: string[], role: string): T[] {
  const selected = ids.map((id) => cases.find((item) => item.caseId === id));
  const missing = ids.filter((_, index) => !selected[index]);
  if (missing.length > 0) throw new Imp24CorpusError(`${role} frozen input is missing required V3 canary fixtures`, missing);
  return selected as T[];
}

export function buildImp24CorpusBundle(inputs: Imp24FrozenV2Inputs): Imp24CorpusBundle {
  const parsed = parseFrozenInputs(inputs);

  const readerCanaryV2 = pickExactly(parsed.reader.partitions.calibration.cases, [
    "READER-V2-CALIBRATION-clean-make-it-stick-ch02",
    "READER-V2-CALIBRATION-reader-visible-hard-blocker-make-it-stick-ch02",
  ], "reader");
  const readerCanary = readerCanaryV2.map((item) => buildReaderCase(item, "canary"));
  const readerHoldout = parsed.reader.partitions.holdout.cases.map((item) => buildReaderCase(item, "holdout"));

  const quizCanaryV2 = pickExactly(parsed.quiz.partitions.calibration.cases, [
    "QUIZ-V2-CALIBRATION-uniquely-correct-clean-decisive-ch02-q01",
    "QUIZ-V2-CALIBRATION-key-mismatch-decisive-ch02-q01",
  ], "quiz");
  const quizCanary = quizCanaryV2.map((item) => buildQuizCase(item, "canary"));
  const quizHoldout = parsed.quiz.partitions.holdout.cases.map((item) => buildQuizCase(item, "holdout"));

  const sourceCanaryPair = sourcePairs(parsed.source.partitions.calibration.cases)
    .find(([clean]) => clean.pairId === "source-bound-detail");
  if (!sourceCanaryPair) throw new Imp24CorpusError("source frozen input is missing the source-bound canary pair");
  const sourceCanary = convertSourcePair(...sourceCanaryPair, "canary", 0);
  const sourceHoldout: Imp24SourceCase[] = [];
  const holdoutPairs = sourcePairs(parsed.source.partitions.holdout.cases);
  const familySlots = new Map<string, number>();
  for (const pair of holdoutPairs) {
    const pairId = pair[0].pairId;
    const slot = familySlots.get(pairId) ?? 0;
    sourceHoldout.push(...convertSourcePair(...pair, "holdout", slot));
    familySlots.set(pairId, slot + 1);
  }

  const draft = {
    schema: IMP24_CORPUS_BUNDLE_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    reader: makeRoleCorpus("reader", parsed.reader, readerCanary, readerHoldout),
    source: makeRoleCorpus("source", parsed.source, sourceCanary, sourceHoldout),
    quiz: makeRoleCorpus("quiz", parsed.quiz, quizCanary, quizHoldout),
  };
  const bundle: Imp24CorpusBundle = { ...draft, substantiveBundleSha256: hashValue(draft) };
  const audit = auditImp24CorpusPassA(bundle);
  if (audit.status !== "PASS") throw new Imp24CorpusError("derived IMP-24 corpus failed object audit", audit.issues);
  return bundle;
}

export function serializeImp24CorpusBundle(bundle: Imp24CorpusBundle): string {
  return canonicalPretty(bundle);
}

export const IMP24_ROLE_PARTITION_ARTIFACT_SCHEMA = "imp24-role-partition-artifact-v1" as const;
export const IMP24_CORPUS_PROVENANCE_SCHEMA = "imp24-corpus-provenance-v1" as const;
export const IMP24_CORPUS_PROVENANCE_ARTIFACT_FILE_NAME = "corpus-provenance.v3-envelope.json" as const;

export type Imp24RolePartitionArtifact = {
  schema: typeof IMP24_ROLE_PARTITION_ARTIFACT_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  role: Imp24ReviewRole;
  partition: Imp24CorpusPartitionName;
  corpusId: string;
  sourceV2CorpusId: string;
  sourceV2RawSha256: string;
  sourceV2SubstantiveCorpusSha256: string;
  corpusSubstantiveSha256: string;
  retainedPartition: Imp24CorpusPartition<Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase>;
  artifactSha256: string;
};

export type Imp24CorpusArtifactIdentity = {
  role: Imp24ReviewRole;
  partition: Imp24CorpusPartitionName;
  fileName: string;
  artifactSha256: string;
  bytesSha256: string;
  caseCount: number;
};

export type Imp24StandaloneArtifactIdentity = {
  fileName: string;
  artifactSha256: string;
  bytesSha256: string;
};

export type Imp24CorpusAuditArtifactIdentity = Imp24StandaloneArtifactIdentity & {
  passId: Imp24CorpusAuditPass["passId"];
  status: Imp24CorpusAuditPass["status"];
  agreementProjectionSha256: string;
};

export type Imp24CorpusProvenanceArtifact = {
  schema: typeof IMP24_CORPUS_PROVENANCE_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  sourceInputs: Record<Imp24ReviewRole, {
    fileName: string;
    corpusId: string;
    rawSha256: string;
    substantiveCorpusSha256: string;
  }>;
  bundleSha256: string;
  partitionArtifacts: Imp24CorpusArtifactIdentity[];
  derivation: "deterministic-forward-only-from-byte-frozen-v2-inputs";
  provenanceSha256: string;
};

export function imp24RolePartitionArtifactFileName(
  role: Imp24ReviewRole,
  partition: Imp24CorpusPartitionName,
): string {
  return `${role}-${partition}-corpus.v3-envelope.json`;
}

export function buildImp24RolePartitionArtifact(
  bundle: Imp24CorpusBundle,
  role: Imp24ReviewRole,
  partition: Imp24CorpusPartitionName,
): Imp24RolePartitionArtifact {
  const corpus = bundle[role] as Imp24RoleCorpus<Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase>;
  const core = {
    schema: IMP24_ROLE_PARTITION_ARTIFACT_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    role,
    partition,
    corpusId: corpus.corpusId,
    sourceV2CorpusId: corpus.sourceV2CorpusId,
    sourceV2RawSha256: corpus.sourceV2RawSha256,
    sourceV2SubstantiveCorpusSha256: corpus.sourceV2SubstantiveCorpusSha256,
    corpusSubstantiveSha256: corpus.substantiveCorpusSha256,
    retainedPartition: clone(corpus[partition]),
  };
  return { ...core, artifactSha256: hashValue(core) };
}

export function serializeImp24RolePartitionArtifact(
  bundle: Imp24CorpusBundle,
  role: Imp24ReviewRole,
  partition: Imp24CorpusPartitionName,
): string {
  return canonicalPretty(buildImp24RolePartitionArtifact(bundle, role, partition));
}

export function imp24CorpusPartitionArtifactIdentities(bundle: Imp24CorpusBundle): Imp24CorpusArtifactIdentity[] {
  const identities: Imp24CorpusArtifactIdentity[] = [];
  for (const role of ["reader", "source", "quiz"] as const) {
    for (const partition of ["canary", "holdout"] as const) {
      const artifact = buildImp24RolePartitionArtifact(bundle, role, partition);
      const bytes = canonicalPretty(artifact);
      identities.push({
        role,
        partition,
        fileName: imp24RolePartitionArtifactFileName(role, partition),
        artifactSha256: artifact.artifactSha256,
        bytesSha256: sha256Hex(bytes),
        caseCount: artifact.retainedPartition.cases.length,
      });
    }
  }
  return identities;
}

export function buildImp24CorpusProvenanceArtifact(bundle: Imp24CorpusBundle): Imp24CorpusProvenanceArtifact {
  const core = {
    schema: IMP24_CORPUS_PROVENANCE_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    sourceInputs: Object.fromEntries((["reader", "source", "quiz"] as const).map((role) => [role, {
      fileName: IMP24_FROZEN_V2_INPUTS[role].fileName,
      corpusId: IMP24_FROZEN_V2_INPUTS[role].corpusId,
      rawSha256: IMP24_FROZEN_V2_INPUTS[role].rawSha256,
      substantiveCorpusSha256: IMP24_FROZEN_V2_INPUTS[role].substantiveCorpusSha256,
    }])) as Imp24CorpusProvenanceArtifact["sourceInputs"],
    bundleSha256: bundle.substantiveBundleSha256,
    partitionArtifacts: imp24CorpusPartitionArtifactIdentities(bundle),
    derivation: "deterministic-forward-only-from-byte-frozen-v2-inputs" as const,
  };
  return { ...core, provenanceSha256: hashValue(core) };
}

export function serializeImp24CorpusProvenanceArtifact(bundle: Imp24CorpusBundle): string {
  return canonicalPretty(buildImp24CorpusProvenanceArtifact(bundle));
}

export function imp24CorpusProvenanceArtifactIdentity(
  bundle: Imp24CorpusBundle,
): Imp24StandaloneArtifactIdentity {
  const artifact = buildImp24CorpusProvenanceArtifact(bundle);
  const bytes = canonicalPretty(artifact);
  return {
    fileName: IMP24_CORPUS_PROVENANCE_ARTIFACT_FILE_NAME,
    artifactSha256: artifact.provenanceSha256,
    bytesSha256: sha256Hex(bytes),
  };
}

export function imp24CorpusAuditArtifactFileName(pass: Imp24CorpusAuditPass): string {
  return pass.passId === "independent-object-audit"
    ? "corpus-audit-pass-a.json"
    : "corpus-audit-pass-b.json";
}

export function serializeImp24CorpusAuditArtifact(pass: Imp24CorpusAuditPass): string {
  return canonicalPretty(pass);
}

export function imp24CorpusAuditArtifactIdentity(
  pass: Imp24CorpusAuditPass,
): Imp24CorpusAuditArtifactIdentity {
  const bytes = serializeImp24CorpusAuditArtifact(pass);
  return {
    passId: pass.passId,
    status: pass.status,
    agreementProjectionSha256: pass.agreementProjectionSha256,
    fileName: imp24CorpusAuditArtifactFileName(pass),
    artifactSha256: hashValue(pass),
    bytesSha256: sha256Hex(bytes),
  };
}

function addIssue(issues: string[], condition: unknown, message: string): void {
  if (!condition) issues.push(message);
}

const IMP24_CORPUS_AUDIT_INSTRUMENT_VERSION = "imp24-model-free-corpus-evidence-audit-v1";

function compileCorpusAuditEnvelope(
  role: Imp24ReviewRole,
  item: { caseId: string; partition: Imp24CorpusPartitionName },
  segments: ReviewEvidenceSegmentInputV1[],
  requiredKinds: readonly ReviewEvidenceKind[],
): string {
  const envelope = createReviewEvidenceEnvelope({
    lane: role,
    envelopeId: `imp24-audit:${item.caseId}`,
    caseId: item.caseId,
    instrumentVersion: IMP24_CORPUS_AUDIT_INSTRUMENT_VERSION,
    segments,
    immutableBindings: { partition: item.partition },
    requiredKinds,
  });
  for (const segment of envelope.segments) {
    resolveEvidenceRefIds(envelope, [segment.refId], {
      allowedKinds: [segment.kind],
      where: `${item.caseId}.${segment.refId}`,
    });
    if (segment.sha256 !== sha256Hex(segment.text)) {
      throw new Imp24CorpusError(`${item.caseId}: audit envelope segment hash drift at ${segment.refId}`);
    }
  }
  const { envelopeSha256: _ignored, ...hashInput } = envelope;
  if (deriveReviewEvidenceEnvelopeSha256(hashInput) !== envelope.envelopeSha256) {
    throw new Imp24CorpusError(`${item.caseId}: audit envelope hash drift`);
  }
  // Hash exact canonical bytes as well as validating the semantic envelope hash.
  return sha256Hex(serializeReviewEvidenceEnvelope(envelope));
}

function sourceAuditSegmentsA(item: Imp24SourceCase): ReviewEvidenceSegmentInputV1[] {
  const plan = item.evidence.sourceUsePlanUnit;
  const segments: ReviewEvidenceSegmentInputV1[] = [
    { refId: "C-001", kind: "chapter", text: item.evidence.chapterUnit },
    { refId: "P-001", kind: "plan", text: canonicalJson(plan) },
  ];
  for (const [index, anchorId] of plan.anchorIds.entries()) {
    const sidecar = (item.evidence.sidecar.testableFacts as SidecarFactForAudit[])
      .find((candidate) => candidate.id === anchorId);
    const anchor = (item.evidence.anchorCatalog as Array<{ id?: string; text?: string }>)
      .find((candidate) => candidate.id === anchorId);
    if (!sidecar || typeof anchor?.text !== "string") {
      throw new Imp24CorpusError(`${item.caseId}: pass A cannot resolve source audit anchor ${anchorId}`);
    }
    const suffix = String(index + 1).padStart(3, "0");
    segments.push(
      { refId: `SC-${suffix}`, kind: "source_claim", text: sidecar.claim },
      { refId: `SM-${suffix}`, kind: "source_mechanism", text: sidecar.becauseMechanism },
      { refId: `SA-${suffix}`, kind: "source_anchor", text: anchor.text },
    );
  }
  return segments;
}

function sourceAuditSegmentsB(item: Imp24SourceCase): ReviewEvidenceSegmentInputV1[] {
  const unit = item.evidence.sourceUsePlanUnit;
  const segments: ReviewEvidenceSegmentInputV1[] = [
    { refId: "C-001", kind: "chapter", text: item.evidence.chapterUnit },
    { refId: "P-001", kind: "plan", text: canonicalJson(unit) },
  ];
  for (let index = 0; index < unit.anchorIds.length; index += 1) {
    const anchorId = unit.anchorIds[index];
    const packetFact = (item.evidence.sourcePacket.facts as PacketFactForAudit[])
      .find((candidate) => candidate.id === anchorId);
    const retainedAnchor = (item.evidence.anchorCatalog as Array<{ id?: string; text?: string }>)
      .find((candidate) => candidate.id === anchorId);
    if (!packetFact || typeof retainedAnchor?.text !== "string") {
      throw new Imp24CorpusError(`${item.caseId}: pass B cannot resolve source audit anchor ${anchorId}`);
    }
    const suffix = String(index + 1).padStart(3, "0");
    segments.push(
      { refId: `SC-${suffix}`, kind: "source_claim", text: packetFact.claim },
      { refId: `SM-${suffix}`, kind: "source_mechanism", text: packetFact.mechanism },
      { refId: `SA-${suffix}`, kind: "source_anchor", text: retainedAnchor.text },
    );
  }
  return segments;
}

function quizAuditSegments(item: Imp24QuizCase): ReviewEvidenceSegmentInputV1[] {
  const question = item.chapter.quiz.questions[0];
  if (!question) throw new Imp24CorpusError(`${item.caseId}: quiz audit envelope has no question`);
  return [
    { refId: "C-001", kind: "chapter", text: completeKeyFreeReaderDocumentBytesV2(item.chapter) },
    { refId: "QP-001", kind: "quiz_prompt", text: question.prompt },
    ...question.choices.map((text, index): ReviewEvidenceSegmentInputV1 => ({
      refId: `QC-${String(index + 1).padStart(3, "0")}`,
      kind: "quiz_choice",
      text,
    })),
    { refId: "QD-001", kind: "quiz_derivation", text: item.cleanItemProof.curatorRationale },
    { refId: "QK-001", kind: "quiz_key", text: `${question.correctIndex}:${question.choices[question.correctIndex] ?? ""}` },
    { refId: "QE-001", kind: "quiz_explanation", text: question.explanation },
  ];
}

function evidenceEnvelopeProjectionA(
  item: Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase,
): string {
  if (item.role === "reader") {
    const document = completeKeyFreeReaderDocumentBytesV2(item.chapter);
    return compileCorpusAuditEnvelope("reader", item, segmentCompleteKeyFreeReaderDocumentV2(document)
      .map((segment) => ({ ...segment, kind: "chapter" as const })), ["chapter"]);
  }
  if (item.role === "source") {
    return compileCorpusAuditEnvelope("source", item, sourceAuditSegmentsA(item), ["chapter", "plan"]);
  }
  return compileCorpusAuditEnvelope("quiz", item, quizAuditSegments(item), [
    "chapter", "quiz_prompt", "quiz_choice", "quiz_derivation", "quiz_key", "quiz_explanation",
  ]);
}

function evidenceEnvelopeProjectionB(
  item: Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase,
): string {
  if (item.role === "reader") {
    const document = completeKeyFreeReaderDocumentBytesV2(item.chapter);
    const chunks = document.split(/(?=^## )/m).filter((chunk) => chunk.length > 0);
    if (chunks.join("") !== document) throw new Imp24CorpusError(`${item.caseId}: pass B reader envelope segmentation is lossy`);
    return compileCorpusAuditEnvelope("reader", item, chunks.map((text, index) => ({
      refId: `RD-${String(index + 1).padStart(3, "0")}`,
      kind: "chapter" as const,
      text,
    })), ["chapter"]);
  }
  if (item.role === "source") {
    return compileCorpusAuditEnvelope("source", item, sourceAuditSegmentsB(item), ["chapter", "plan"]);
  }
  return compileCorpusAuditEnvelope("quiz", item, quizAuditSegments(item), [
    "chapter", "quiz_prompt", "quiz_choice", "quiz_derivation", "quiz_key", "quiz_explanation",
  ]);
}

function noSourceTruthGold(expected: Record<string, unknown>): boolean {
  return Object.keys(expected).every((key) => !/(?:external|fabricat|sourceTruth|sourceContradiction)/i.test(key));
}

type Imp24ReaderBlockingCategory = "unsafe" | "internal_contradiction" | "unusable";
type Imp24ReaderCraftCategory =
  | "thin_explanation"
  | "weak_transition"
  | "tone"
  | "pacing"
  | "repetition"
  | "density"
  | "weak_active_processing";

type Imp24DerivedReaderSemantics = {
  kind: "clean" | "reader-visible-hard-blocker" | "craft-nonblocker";
  recommendation: "SHIP" | "REVISE" | "BLOCK";
  blockingCategory: Imp24ReaderBlockingCategory | null;
  craftCategory: Imp24ReaderCraftCategory | null;
  completeReaderDocumentSha256: string;
  quizQuestionCount: number;
  mutationPaths: string[];
};

function readerCoordinate(item: Pick<Imp24ReaderCase, "partition" | "baseBookId" | "baseChapter">): string {
  return `${item.partition}|${item.baseBookId}|${item.baseChapter}`;
}

function readerBaselineByCoordinate(cases: Imp24ReaderCase[], issues: string[]): Map<string, Imp24ReaderCase> {
  const groups = new Map<string, Imp24ReaderCase[]>();
  for (const item of cases) {
    const key = readerCoordinate(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const baselines = new Map<string, Imp24ReaderCase>();
  for (const [key, group] of groups) {
    const candidates = group.filter((item) => item.provenance.mutationOps.length === 0);
    addIssue(issues, candidates.length === 1, `${key}: reader audit requires exactly one zero-mutation clean control`);
    if (candidates.length === 1) baselines.set(key, candidates[0]);
  }
  return baselines;
}

function readerVisibleTextValuesA(item: Imp24ReaderCase): string[] {
  const chapter = item.chapter;
  const experience = chapter.experiencePlan;
  return [
    chapter.title,
    chapter.hook,
    chapter.counterintuition,
    chapter.reflectionBefore,
    chapter.breakdown.fastRead,
    chapter.breakdown.deepRead,
    chapter.breakdown.fullRead,
    chapter.reflectionAfter,
    chapter.keyTakeaway,
    chapter.tryThisNow,
    ...chapter.examples.flatMap((example) => [example.title, example.scenario, example.whatToDo, example.whyItMatters]),
    ...chapter.quiz.questions.flatMap((question) => [question.prompt, ...question.choices]),
    ...chapter.reviewCards.flatMap((card) => [card.front, card.back]),
    chapter.implementationPlan.coreSkill,
    ...chapter.implementationPlan.ifThenPlans.flatMap((plan) => [plan.context, plan.plan]),
    chapter.implementationPlan.twentyFourHourChallenge,
    chapter.implementationPlan.weeklyPractice,
    ...(chapter.memorableLines ?? []).map((line) => line.text),
    experience?.failureRecovery?.normalizingLine,
    experience?.failureRecovery?.cueQuestion,
    ...(experience?.failureRecovery?.options ?? []),
    experience?.failureRecovery?.repairLine,
    experience?.transferPrompt?.prompt,
    ...(experience?.transferPrompt?.contexts ?? []),
    ...(experience?.behaviorLoop?.readerPatterns ?? []).map((pattern) => pattern.label),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function validateCompleteReaderDocumentA(item: Imp24ReaderCase, issues: string[]): string {
  try {
    const document = completeKeyFreeReaderDocumentBytesV2(item.chapter);
    const segments = segmentCompleteKeyFreeReaderDocumentV2(document);
    addIssue(issues, segments.length > 0 && segments.map((segment) => segment.text).join("") === document,
      `${item.caseId}: pass A complete V2 reader segments do not reconstruct exact bytes`);
    for (const value of readerVisibleTextValuesA(item)) {
      addIssue(issues, document.includes(value), `${item.caseId}: pass A complete V2 reader bytes omit visible text ${JSON.stringify(value.slice(0, 80))}`);
    }
    for (const question of item.chapter.quiz.questions) {
      if (question.explanation?.trim()) {
        addIssue(issues, !document.includes(question.explanation), `${item.caseId}: pass A key explanation leaked into key-free reader bytes`);
      }
      if (question.questionId?.trim()) {
        addIssue(issues, !document.includes(question.questionId), `${item.caseId}: pass A internal quiz identity leaked into key-free reader bytes`);
      }
    }
    return document;
  } catch (error) {
    issues.push(`${item.caseId}: pass A complete V2 reader render failed: ${(error as Error).message}`);
    return "";
  }
}

function readerInstructionalTextA(item: Imp24ReaderCase): string {
  const chapter = item.chapter;
  const experience = chapter.experiencePlan;
  return [
    chapter.title,
    chapter.hook,
    chapter.counterintuition,
    chapter.reflectionBefore,
    chapter.breakdown.fastRead,
    chapter.breakdown.deepRead,
    chapter.breakdown.fullRead,
    chapter.reflectionAfter,
    chapter.keyTakeaway,
    chapter.tryThisNow,
    ...chapter.examples.flatMap((example) => [example.title, example.scenario, example.whatToDo, example.whyItMatters]),
    ...chapter.quiz.questions.flatMap((question) => [question.prompt, ...question.choices]),
    ...chapter.reviewCards.flatMap((card) => [card.front, card.back]),
    chapter.implementationPlan.coreSkill,
    ...chapter.implementationPlan.ifThenPlans.flatMap((plan) => [plan.context, plan.plan]),
    chapter.implementationPlan.twentyFourHourChallenge,
    chapter.implementationPlan.weeklyPractice,
    ...(chapter.memorableLines ?? []).map((line) => line.text),
    experience?.failureRecovery?.normalizingLine,
    experience?.failureRecovery?.cueQuestion,
    ...(experience?.failureRecovery?.options ?? []),
    experience?.failureRecovery?.repairLine,
    experience?.transferPrompt?.prompt,
    ...(experience?.transferPrompt?.contexts ?? []),
    ...(experience?.behaviorLoop?.readerPatterns ?? []).map((pattern) => pattern.label),
  ].filter((value): value is string => typeof value === "string").join("\n");
}

function readerMutationText(ops: MutationOpV1[]): string {
  return ops.map((op) => typeof op.value === "string" ? op.value : canonicalJson(op.value)).join("\n");
}

function deriveReaderBlockingCategoriesA(text: string): Imp24ReaderBlockingCategory[] {
  const categories: Imp24ReaderBlockingCategory[] = [];
  const unsafe = /\b(?:skip|omit|bypass|disable|ignore)\b[^.\n]{0,140}\b(?:safety|warning|stop|highest-consequence check)/i.test(text)
    || /\bpublicly humiliat|\bcontinu(?:e|ing) even if\b[^.\n]{0,80}\bstop\b|\bwithout telling (?:the )?team\b/i.test(text)
    || /(?:^|[.!?]\s)(?:send|submit|publish|post|transfer|purchase|delete)\b[^.!?\n]{0,100}\b(?:now|immediately|without (?:review|confirmation|approval))\b/i.test(text);
  if (unsafe) categories.push("unsafe");
  const contradiction = /\bnever widen a narrow decision frame\b|\blearning stance is never useful\b|\bretrieval standard is completely backward\b|\bdisregard every method stated above\b|\bbody state can never affect\b/i.test(text)
    || (/\bIMP-22 controlled blocker\b/i.test(text) && /\b(?:exact opposite|never|none|irrelevant in every case|must be rejected)\b/i.test(text))
    || /\bexact opposite (?:rule )?is always correct\b/i.test(text);
  if (contradiction) categories.push("internal_contradiction");
  const unusable = /\bchecking whether learning seems learned\b/i.test(text)
    || /\brelevant thing in the appropriate way\b[\s\S]{0,180}\b(?:observable action|stopping rule)\b/i.test(text)
    || /\bdo not (?:record|measure|define)\b[\s\S]{0,220}\b(?:feedback|schedule|stopping rule|target behavior|stop)\b/i.test(text);
  if (unusable) categories.push("unusable");
  return [...new Set(categories)];
}

function deriveReaderCraftCategoriesA(text: string): Imp24ReaderCraftCategory[] {
  const categories: Imp24ReaderCraftCategory[] = [];
  if (/\bimportant because (?:this is )?an? important\b|\breasons that are generally important\b/i.test(text)) categories.push("thin_explanation");
  if (/\bthat is that point\b|\banyway,? the next point\b|\bone thing,? and then there is another thing\b/i.test(text)) categories.push("weak_transition");
  if (/\bonly a careless reader\b|\bobviously,? any sensible reader\b/i.test(text)) categories.push("tone");
  if ((text.match(/\bpause\b/gi)?.length ?? 0) >= 3 || ((text.match(/\bstop\b/gi)?.length ?? 0) >= 2 && (text.match(/\bcontinue\b/gi)?.length ?? 0) >= 2)) categories.push("pacing");
  if (/\bpractice is practice\b|\bmatters because it matters\b|\bworth remembering because it is worth remembering\b/i.test(text)) categories.push("repetition");
  if ((text.match(/\bmoment(?:s|ariness|-like)?\b/gi)?.length ?? 0) >= 4) categories.push("density");
  if (/\bthink about this chapter for a while\b[\s\S]{0,160}\bin a general way\b[\s\S]{0,120}\bmight apply\b/i.test(text)) categories.push("weak_active_processing");
  return [...new Set(categories)];
}

function validateReaderQuizStructureA(item: Imp24ReaderCase, issues: string[]): void {
  const questions = item.chapter.quiz.questions;
  addIssue(issues, questions.length > 0, `${item.caseId}: pass A reader quiz has no questions`);
  const ids = new Set<string>();
  questions.forEach((question, index) => {
    const prefix = `${item.caseId}: pass A reader quiz Q${index + 1}`;
    addIssue(issues, question.prompt.trim().length > 0, `${prefix} has an empty prompt`);
    addIssue(issues, question.choices.length === 3 && question.choices.every((choice) => choice.trim().length > 0), `${prefix} does not have three non-empty choices`);
    addIssue(issues, new Set(question.choices.map((choice) => choice.trim())).size === question.choices.length, `${prefix} has duplicate choices and no unique deterministic key`);
    addIssue(issues, Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < question.choices.length, `${prefix} stored key is out of range`);
    addIssue(issues, question.explanation.trim().length > 0, `${prefix} has no key explanation`);
    addIssue(issues, !ids.has(question.questionId), `${prefix} duplicates internal question identity ${question.questionId}`);
    ids.add(question.questionId);
  });
}

/** Pass A consumes only schema, render, and completeness admission. Keep that
 * projection pure: the legacy admission helper also runs the ship gate, whose
 * name-plan lookup can materialize canonical book-run pointers even though its
 * ship verdict is intentionally unused by IMP-24 certification. */
function imp24ReaderAdmission(chapter: Imp24ReaderCase["chapter"]): {
  schemaOk: boolean;
  renderOk: boolean;
  complete: boolean;
} {
  const schema = validateChapterV21(chapter);
  let renderOk = false;
  try {
    renderChapterReaderDocPhase1(schema.ok ? schema.value : chapter);
    renderOk = true;
  } catch {
    renderOk = false;
  }
  return {
    schemaOk: schema.ok,
    renderOk,
    complete: chapterCompleteness(chapter).length === 0,
  };
}

function deriveReaderSemanticsA(
  item: Imp24ReaderCase,
  baseline: Imp24ReaderCase,
  issues: string[],
): Imp24DerivedReaderSemantics | null {
  const admission = imp24ReaderAdmission(item.chapter);
  addIssue(issues, admission.schemaOk && admission.renderOk && admission.complete,
    `${item.caseId}: pass A reader chapter is not complete/renderable/schema-valid`);
  const document = validateCompleteReaderDocumentA(item, issues);
  validateReaderQuizStructureA(item, issues);
  addIssue(issues, item.sourceSemanticsStatus === "MISSING", `${item.caseId}: pass A reader case claims source semantics`);
  addIssue(issues, noSourceTruthGold(item.expected), `${item.caseId}: pass A reader gold crosses into source truth`);

  const ops = item.provenance.mutationOps;
  const paths = ops.map((op) => op.path);
  addIssue(issues, item.provenance.mutationOpsSha256 === hashValue(ops), `${item.caseId}: pass A reader mutation-op hash drift`);
  addIssue(issues, item.provenance.variantContentSha256 === hashValue(item.chapter), `${item.caseId}: pass A reader variant-content hash drift`);
  addIssue(issues, baseline.provenance.variantContentSha256 === item.provenance.baseContentSha256,
    `${item.caseId}: pass A reader clean-base content binding drift`);

  if (ops.length === 0) {
    addIssue(issues, canonicalJson(item.chapter) === canonicalJson(baseline.chapter), `${item.caseId}: pass A zero-mutation case differs from its clean control`);
    addIssue(issues, item.imp24.controlledMutation === null, `${item.caseId}: pass A clean control declares a mutation`);
  } else {
    const rebuilt = clone(baseline.chapter);
    try {
      applyMutationOps(rebuilt, ops);
      addIssue(issues, canonicalJson(rebuilt) === canonicalJson(item.chapter), `${item.caseId}: pass A reader variant is not exactly its declared mutation`);
      const protectedSha256 = assertProtectedContentUnchanged(baseline.chapter, item.chapter, ops, item.caseId);
      addIssue(issues, protectedSha256 === item.provenance.protectedContentSha256, `${item.caseId}: pass A reader protected content hash drift`);
    } catch (error) {
      issues.push(`${item.caseId}: pass A reader mutation reconstruction failed: ${(error as Error).message}`);
    }
    addIssue(issues, ops.length === 1, `${item.caseId}: pass A reader negative case does not contain exactly one controlled mutation`);
    addIssue(issues, item.imp24.controlledMutation?.operationCount === 1, `${item.caseId}: pass A reader mutation governance is not exactly one operation`);
    addIssue(issues, canonicalJson(item.imp24.controlledMutation?.declaredPaths ?? []) === canonicalJson(paths), `${item.caseId}: pass A reader declared mutation paths drift`);
  }

  const baselineBlockers = deriveReaderBlockingCategoriesA(readerInstructionalTextA(baseline));
  addIssue(issues, baselineBlockers.length === 0, `${item.caseId}: pass A clean control contains deterministic blocker(s): ${baselineBlockers.join(",")}`);
  const mutationText = readerMutationText(ops);
  const blockers = deriveReaderBlockingCategoriesA(mutationText);
  const craft = deriveReaderCraftCategoriesA(mutationText);
  let derived: Omit<Imp24DerivedReaderSemantics, "completeReaderDocumentSha256" | "quizQuestionCount" | "mutationPaths">;
  if (ops.length === 0 && blockers.length === 0 && craft.length === 0) {
    derived = { kind: "clean", recommendation: "SHIP", blockingCategory: null, craftCategory: null };
  } else if (blockers.length === 1 && craft.length === 0) {
    derived = { kind: "reader-visible-hard-blocker", recommendation: "BLOCK", blockingCategory: blockers[0], craftCategory: null };
  } else if (blockers.length === 0 && craft.length === 1 && admission.schemaOk && admission.complete) {
    derived = { kind: "craft-nonblocker", recommendation: "REVISE", blockingCategory: null, craftCategory: craft[0] };
  } else {
    issues.push(`${item.caseId}: pass A cannot derive one reader semantic class (blockers=${blockers.join(",") || "none"}; craft=${craft.join(",") || "none"})`);
    return null;
  }
  addIssue(issues, item.kind === derived.kind, `${item.caseId}: pass A independently derived kind ${derived.kind}, not stored ${item.kind}`);
  addIssue(issues, item.expected.expectedRecommendation === derived.recommendation,
    `${item.caseId}: pass A independently derived ${derived.recommendation}, not stored ${String(item.expected.expectedRecommendation)}`);
  if (derived.blockingCategory !== null) {
    addIssue(issues, item.expected.expectedBlockingCategory === derived.blockingCategory,
      `${item.caseId}: pass A independently derived blocker ${derived.blockingCategory}, not stored ${String(item.expected.expectedBlockingCategory)}`);
    addIssue(issues, item.expected.onPageDecidable === true, `${item.caseId}: pass A hard blocker is not declared on-page decidable`);
  } else {
    addIssue(issues, item.expected.prohibitBlockingFindings === true, `${item.caseId}: pass A nonblocking reader case permits blockers`);
  }
  if (derived.craftCategory !== null) {
    addIssue(issues, item.expected.expectedWeakness === derived.craftCategory,
      `${item.caseId}: pass A independently derived craft weakness ${derived.craftCategory}, not stored ${String(item.expected.expectedWeakness)}`);
  }
  return {
    ...derived,
    completeReaderDocumentSha256: hashValue(document),
    quizQuestionCount: item.chapter.quiz.questions.length,
    mutationPaths: [...paths],
  };
}

function jsonPointerPartsB(path: string): string[] {
  if (!path.startsWith("/")) throw new Imp24CorpusError(`pass B JSON pointer is not absolute: ${path}`);
  const parts = path.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (parts.length === 0 || parts.some((part) => part.length === 0)) throw new Imp24CorpusError(`pass B JSON pointer is empty: ${path}`);
  return parts;
}

function readPointerB(root: unknown, path: string): unknown {
  let current = root;
  for (const part of jsonPointerPartsB(path)) {
    if (current === null || typeof current !== "object" || !(part in (current as Record<string, unknown>))) {
      throw new Imp24CorpusError(`pass B JSON pointer does not resolve: ${path}`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function writePointerB(root: unknown, path: string, value: unknown): void {
  const parts = jsonPointerPartsB(path);
  let current = root as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (next === null || typeof next !== "object") throw new Imp24CorpusError(`pass B JSON pointer parent does not resolve: ${path}`);
    current = next as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function applyMutationOpsB<T>(base: T, ops: MutationOpV1[]): T {
  const result = clone(base);
  for (const op of ops) {
    if (op.op === "replace") {
      writePointerB(result, op.path, clone(op.value));
    } else if (op.op === "append") {
      const before = readPointerB(result, op.path);
      if (typeof before !== "string" || typeof op.value !== "string") {
        throw new Imp24CorpusError(`pass B append mutation is not string-to-string: ${op.path}`);
      }
      writePointerB(result, op.path, before + op.value);
    } else {
      throw new Imp24CorpusError(`pass B encountered unsupported mutation op ${String((op as MutationOpV1).op)}`);
    }
  }
  return result;
}

function protectedProjectionSha256B(base: unknown, variant: unknown, ops: MutationOpV1[], caseId: string): string {
  const left = clone(base);
  const right = clone(variant);
  for (const op of ops) {
    writePointerB(left, op.path, "__IMP22_DECLARED_MUTATION_PATH__");
    writePointerB(right, op.path, "__IMP22_DECLARED_MUTATION_PATH__");
  }
  if (canonicalJson(left) !== canonicalJson(right)) {
    throw new Imp24CorpusError(`${caseId}: pass B protected reader content differs outside declared mutation paths`);
  }
  return hashValue(left);
}

function validateCompleteReaderDocumentB(item: Imp24ReaderCase, issues: string[]): string {
  try {
    const bytes = completeKeyFreeReaderDocumentBytesV2(item.chapter);
    addIssue(issues, bytes.endsWith("\n") && bytes.startsWith(`# ${item.chapter.title}\n`),
      `${item.caseId}: pass B complete V2 reader bytes have invalid title/newline framing`);
    const requiredHeadings = ["Hook", "Fast read", "Deep read", "Full read", "Key takeaway", "Try this now", "Examples", "Quiz", "Review cards", "Implementation plan"];
    for (const heading of requiredHeadings) {
      addIssue(issues, bytes.includes(`## ${heading}\n`), `${item.caseId}: pass B complete V2 reader bytes omit ${heading}`);
    }
    const chunks = bytes.split(/(?=^## )/m).filter((chunk) => chunk.length > 0);
    addIssue(issues, chunks.length > 0 && chunks.join("") === bytes, `${item.caseId}: pass B natural reader segmentation is not lossless`);
    item.chapter.quiz.questions.forEach((question, index) => {
      addIssue(issues, bytes.includes(`Q${index + 1}. ${question.prompt}`), `${item.caseId}: pass B reader bytes omit quiz prompt Q${index + 1}`);
      question.choices.forEach((choice, choiceIndex) => {
        addIssue(issues, bytes.includes(`${"abc"[choiceIndex]}) ${choice}`), `${item.caseId}: pass B reader bytes omit Q${index + 1} choice ${choiceIndex}`);
      });
      addIssue(issues, !bytes.includes(question.explanation), `${item.caseId}: pass B key explanation leaked into complete key-free reader bytes`);
    });
    return bytes;
  } catch (error) {
    issues.push(`${item.caseId}: pass B complete V2 reader render failed: ${(error as Error).message}`);
    return "";
  }
}

function readerInstructionalTextB(item: Imp24ReaderCase): string {
  const chapter = item.chapter;
  return canonicalJson({
    title: chapter.title,
    hook: chapter.hook,
    counterintuition: chapter.counterintuition,
    reflectionBefore: chapter.reflectionBefore,
    breakdown: chapter.breakdown,
    reflectionAfter: chapter.reflectionAfter,
    keyTakeaway: chapter.keyTakeaway,
    tryThisNow: chapter.tryThisNow,
    examples: chapter.examples.map((example) => ({ title: example.title, scenario: example.scenario, whatToDo: example.whatToDo, whyItMatters: example.whyItMatters })),
    quiz: chapter.quiz.questions.map((question) => ({ prompt: question.prompt, choices: question.choices })),
    reviewCards: chapter.reviewCards.map((card) => ({ front: card.front, back: card.back })),
    implementationPlan: {
      coreSkill: chapter.implementationPlan.coreSkill,
      ifThenPlans: chapter.implementationPlan.ifThenPlans,
      twentyFourHourChallenge: chapter.implementationPlan.twentyFourHourChallenge,
      weeklyPractice: chapter.implementationPlan.weeklyPractice,
    },
    memorableLines: chapter.memorableLines?.map((line) => line.text) ?? [],
    experiencePlan: chapter.experiencePlan ?? null,
  });
}

function deriveReaderBlockingCategoriesB(text: string): Imp24ReaderBlockingCategory[] {
  const lower = text.toLowerCase().replace(/\\n/g, " ").replace(/\s+/g, " ");
  const result: Imp24ReaderBlockingCategory[] = [];
  const unsafeTerms = [
    "skipping every safety check",
    "disabling any warning",
    "continuing even if a teammate tells you to stop",
    "omit the three highest-consequence checks",
    "without telling the team",
    "publicly humiliating",
    "everyone complies without objection",
  ];
  const directDispatch = /(?:^|[^a-z])(?:send|submit|publish|post|transfer|purchase|delete)\s+[^.!?]{0,80}(?:now|immediately|without review|without confirmation|without approval)/i.test(text);
  if (unsafeTerms.some((term) => lower.includes(term)) || directDispatch) result.push("unsafe");
  const contradictionTerms = [
    "never widen a narrow decision frame",
    "a learning stance is never useful",
    "retrieval standard is completely backward",
    "disregard every method stated above",
    "the exact opposite rule is always correct",
    "body state can never affect attention or control",
  ];
  if (contradictionTerms.some((term) => lower.includes(term)) || (lower.includes("imp-22 controlled blocker") && lower.includes("must be rejected"))) {
    result.push("internal_contradiction");
  }
  const unusable = lower.includes("test learning by checking whether learning seems learned")
    || (lower.includes("relevant thing in the appropriate way") && lower.includes("observable action or stopping rule"))
    || (lower.includes("do not measure the attempt") && lower.includes("seek feedback") && lower.includes("practice should stop"));
  if (unusable) result.push("unusable");
  return [...new Set(result)];
}

function deriveReaderCraftCategoriesB(text: string): Imp24ReaderCraftCategory[] {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const result: Imp24ReaderCraftCategory[] = [];
  if (lower.includes("reasons that are generally important") || lower.includes("important because this is an important thing")) result.push("thin_explanation");
  if (lower.includes("that is that point") || lower.includes("discussion moves on") || lower.includes("the next point is the next point")) result.push("weak_transition");
  if (lower.includes("careless reader") || (lower.includes("obviously") && lower.includes("sensible reader"))) result.push("tone");
  const words = lower.match(/[a-z]+/g) ?? [];
  if (words.filter((word) => word === "pause").length >= 3
    || (words.filter((word) => word === "stop").length >= 2 && words.filter((word) => word === "continue").length >= 2)) result.push("pacing");
  if (lower.includes("practice is practice") || (lower.includes("because it matters") && lower.includes("worth remembering because it is worth remembering"))) result.push("repetition");
  if (words.filter((word) => word.startsWith("moment")).length >= 4) result.push("density");
  if (lower.includes("think about this chapter for a while") && lower.includes("in a general way") && lower.includes("might apply")) result.push("weak_active_processing");
  return [...new Set(result)];
}

function validateReaderRequiredComponentsB(item: Imp24ReaderCase, issues: string[]): void {
  const chapter = item.chapter;
  const prefix = `${item.caseId}: pass B reader`;
  addIssue(issues, chapter.title.trim().length > 0 && chapter.hook.trim().length > 0 && chapter.keyTakeaway.trim().length > 0 && (chapter.tryThisNow?.trim().length ?? 0) > 0,
    `${prefix} misses a required title/hook/takeaway/action component`);
  addIssue(issues, chapter.breakdown.fastRead.trim().length > 0 && chapter.breakdown.deepRead.trim().length > 0 && chapter.breakdown.fullRead.trim().length > 0,
    `${prefix} misses a required breakdown tier`);
  addIssue(issues, chapter.examples.length >= 2 && chapter.examples.every((example) => example.scenario.trim() && example.whatToDo.trim() && example.whyItMatters.trim()),
    `${prefix} has an incomplete example component`);
  addIssue(issues, chapter.reviewCards.length >= 2 && chapter.reviewCards.every((card) => card.front.trim() && card.back.trim()),
    `${prefix} has an incomplete review-card component`);
  addIssue(issues, chapter.implementationPlan.coreSkill.trim().length > 0
    && chapter.implementationPlan.ifThenPlans.length > 0
    && chapter.implementationPlan.ifThenPlans.every((plan) => plan.context.trim() && plan.plan.trim())
    && chapter.implementationPlan.twentyFourHourChallenge.trim().length > 0
    && chapter.implementationPlan.weeklyPractice.trim().length > 0,
  `${prefix} has an incomplete implementation plan`);
  addIssue(issues, chapter.quiz.questions.length > 0, `${prefix} quiz is empty`);
  const questionIds = new Set<string>();
  chapter.quiz.questions.forEach((question, index) => {
    const choices = question.choices.map((choice) => choice.trim());
    addIssue(issues, question.prompt.trim().length > 0 && choices.length === 3 && choices.every(Boolean), `${prefix} Q${index + 1} is structurally incomplete`);
    addIssue(issues, new Set(choices).size === choices.length, `${prefix} Q${index + 1} has deterministically ambiguous duplicate choices`);
    addIssue(issues, Number.isSafeInteger(question.correctIndex) && question.choices[question.correctIndex] !== undefined, `${prefix} Q${index + 1} stored key does not resolve`);
    addIssue(issues, question.explanation.trim().length > 0, `${prefix} Q${index + 1} has no key explanation`);
    addIssue(issues, !questionIds.has(question.questionId), `${prefix} Q${index + 1} repeats questionId ${question.questionId}`);
    questionIds.add(question.questionId);
  });
}

function deriveReaderSemanticsB(
  item: Imp24ReaderCase,
  baseline: Imp24ReaderCase,
  issues: string[],
): Imp24DerivedReaderSemantics | null {
  const document = validateCompleteReaderDocumentB(item, issues);
  validateReaderRequiredComponentsB(item, issues);
  addIssue(issues, item.role === "reader" && item.sourceSemanticsStatus === "MISSING", `${item.caseId}: pass B serialized reader authority drift`);
  addIssue(issues, noSourceTruthGold(item.expected), `${item.caseId}: pass B serialized reader gold crosses into source truth`);

  const ops = item.provenance.mutationOps;
  const paths = ops.map((op) => op.path);
  addIssue(issues, item.provenance.mutationOpsSha256 === hashValue(ops), `${item.caseId}: pass B reader mutation-op hash drift`);
  addIssue(issues, item.provenance.variantContentSha256 === hashValue(item.chapter), `${item.caseId}: pass B reader variant-content hash drift`);
  addIssue(issues, baseline.provenance.variantContentSha256 === item.provenance.baseContentSha256, `${item.caseId}: pass B reader clean-base content binding drift`);
  if (ops.length === 0) {
    addIssue(issues, canonicalJson(item.chapter) === canonicalJson(baseline.chapter), `${item.caseId}: pass B zero-mutation case differs from its clean control`);
    addIssue(issues, item.imp24.controlledMutation === null, `${item.caseId}: pass B clean control declares a mutation`);
  } else {
    try {
      const rebuilt = applyMutationOpsB(baseline.chapter, ops);
      addIssue(issues, canonicalJson(rebuilt) === canonicalJson(item.chapter), `${item.caseId}: pass B reader variant is not exactly its declared mutation`);
      addIssue(issues, protectedProjectionSha256B(baseline.chapter, item.chapter, ops, item.caseId) === item.provenance.protectedContentSha256,
        `${item.caseId}: pass B reader protected content hash drift`);
    } catch (error) {
      issues.push(`${item.caseId}: pass B reader mutation reconstruction failed: ${(error as Error).message}`);
    }
    addIssue(issues, ops.length === 1 && item.imp24.controlledMutation?.operationCount === 1,
      `${item.caseId}: pass B reader negative case is not exactly one controlled mutation`);
    addIssue(issues, canonicalJson(item.imp24.controlledMutation?.declaredPaths ?? []) === canonicalJson(paths), `${item.caseId}: pass B reader declared mutation paths drift`);
  }

  const baseSignals = deriveReaderBlockingCategoriesB(readerInstructionalTextB(baseline));
  addIssue(issues, baseSignals.length === 0, `${item.caseId}: pass B clean control contains deterministic blocker(s): ${baseSignals.join(",")}`);
  const mutationText = ops.map((op) => JSON.stringify(op.value)).join(" ");
  const blockers = deriveReaderBlockingCategoriesB(mutationText);
  const craft = deriveReaderCraftCategoriesB(mutationText);
  let derived: Omit<Imp24DerivedReaderSemantics, "completeReaderDocumentSha256" | "quizQuestionCount" | "mutationPaths">;
  if (ops.length === 0 && blockers.length === 0 && craft.length === 0) {
    derived = { kind: "clean", recommendation: "SHIP", blockingCategory: null, craftCategory: null };
  } else if (blockers.length === 1 && craft.length === 0) {
    derived = { kind: "reader-visible-hard-blocker", recommendation: "BLOCK", blockingCategory: blockers[0], craftCategory: null };
  } else if (blockers.length === 0 && craft.length === 1) {
    derived = { kind: "craft-nonblocker", recommendation: "REVISE", blockingCategory: null, craftCategory: craft[0] };
  } else {
    issues.push(`${item.caseId}: pass B cannot derive one reader semantic class (blockers=${blockers.join(",") || "none"}; craft=${craft.join(",") || "none"})`);
    return null;
  }
  addIssue(issues, item.kind === derived.kind, `${item.caseId}: pass B independently derived kind ${derived.kind}, not stored ${item.kind}`);
  addIssue(issues, item.expected.expectedRecommendation === derived.recommendation,
    `${item.caseId}: pass B independently derived ${derived.recommendation}, not stored ${String(item.expected.expectedRecommendation)}`);
  if (derived.blockingCategory !== null) {
    addIssue(issues, item.expected.expectedBlockingCategory === derived.blockingCategory,
      `${item.caseId}: pass B independently derived blocker ${derived.blockingCategory}, not stored ${String(item.expected.expectedBlockingCategory)}`);
    addIssue(issues, item.expected.onPageDecidable === true, `${item.caseId}: pass B hard blocker is not on-page decidable`);
  } else {
    addIssue(issues, item.expected.prohibitBlockingFindings === true, `${item.caseId}: pass B nonblocking reader case permits blockers`);
  }
  if (derived.craftCategory !== null) {
    addIssue(issues, item.expected.expectedWeakness === derived.craftCategory,
      `${item.caseId}: pass B independently derived craft weakness ${derived.craftCategory}, not stored ${String(item.expected.expectedWeakness)}`);
  }
  return {
    ...derived,
    completeReaderDocumentSha256: hashValue(document),
    quizQuestionCount: item.chapter.quiz.questions.length,
    mutationPaths: [...paths],
  };
}

function genericForbiddenKinds(text: string): string[] {
  const kinds: string[] = [];
  if (/\b(?:19|20)\d{2}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/i.test(text)) kinds.push("date");
  if (/[“”"]/.test(text)) kinds.push("quotation");
  if (/\bexactly\s+\d+\b|\b\d+\s*(?:percent|%|minutes?|hours?|participants?|people)\b/i.test(text)) kinds.push("exact_metric");
  if (/\bNorthstar Systems\b|\b(?:Dr\.|Mr\.|Ms\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/.test(text)) kinds.push("named_entity");
  if (/\b(?:iPhone|Facebook|historical event|was launched|was founded)\b/i.test(text)) kinds.push("historical_claim");
  return [...new Set(kinds)];
}

type SidecarFactForAudit = {
  id: string;
  claim: string;
  becauseMechanism: string;
  commonError: string;
};

type PacketFactForAudit = {
  id: string;
  claim: string;
  mechanism: string;
  commonError: string;
};

function selectedSidecarFactForPassA(input: Imp24SourceSemanticInput): SidecarFactForAudit {
  const plan = input.evidence.sourceUsePlanUnit;
  const anchorId = plan.anchorIds[0];
  if (plan.anchorIds.length !== 1 || input.evidence.anchorIds.length !== 1 || input.evidence.anchorIds[0] !== anchorId) {
    throw new Imp24CorpusError(`${input.caseId}: pass A cannot derive a unique source-bound anchor`);
  }
  const fact = (input.evidence.sidecar.testableFacts as SidecarFactForAudit[])
    .find((candidate) => candidate.id === anchorId);
  const anchor = (input.evidence.anchorCatalog as Array<{ id?: string; text?: string }>)
    .find((candidate) => candidate.id === anchorId);
  if (!fact || typeof anchor?.text !== "string"
    || !anchor.text.includes(fact.claim)
    || !anchor.text.includes(fact.becauseMechanism)
    || !anchor.text.includes(fact.commonError)) {
    throw new Imp24CorpusError(`${input.caseId}: pass A selected sidecar fact and anchor bytes disagree`);
  }
  return fact;
}

function passASourceResidual(text: string, fact: SidecarFactForAudit): string {
  let residual = text;
  for (const fragment of [fact.claim, fact.becauseMechanism]) {
    residual = residual.split(fragment).join("");
  }
  for (const prefix of [
    "The Digital Minimalism chapter source states:",
    "The source describes this mechanism without a universal guarantee:",
    "The source states:",
  ]) {
    residual = residual.split(prefix).join("");
  }
  return residual.replace(/[\s.,;:!?()[\]{}'\"“”\-]/g, "");
}

/**
 * Pass A is an object-level derivation.  It uses the compiler-selected plan
 * unit, the structured source sidecar, the selected anchor-catalog bytes, and
 * the chapter bytes.  It never reads pair labels, mutations, or `expected`.
 */
export function deriveImp24SourceSemanticsPassA(
  input: Imp24SourceSemanticInput,
): Imp24DerivedSourceSemantics {
  const plan = input.evidence.sourceUsePlanUnit;
  const text = input.evidence.chapterUnit;

  if (plan.origin === "constructed") {
    if (plan.form !== "application" || plan.framingRequired !== true || plan.anchorIds.length !== 0) {
      throw new Imp24CorpusError(`${input.caseId}: pass A constructed plan is internally inconsistent`);
    }
    const framed = /\b(?:hypothetical|fictional|imagine|suppose)\b/i.test(text);
    const primary = framed ? null : "missing_visible_framing";
    return {
      result: framed ? "PASS" : "BLOCK",
      primaryCategory: primary,
      secondaryCategories: [],
      supportStatus: "NOT_APPLICABLE",
      visibleRegister: framed ? "clearly_constructed" : "presented_as_fact",
      framingAdequate: framed,
      claimStrengthFit: null,
      namedSpecificityAllowed: null,
    };
  }

  if (plan.origin === "generic") {
    if (plan.form !== "operational_scenario" || plan.anchorIds.length !== 0) {
      throw new Imp24CorpusError(`${input.caseId}: pass A generic plan is internally inconsistent`);
    }
    const specificityKinds = genericForbiddenKinds(text);
    const primary = specificityKinds.length === 0 ? null : "generic_specificity_leak";
    return {
      result: primary === null ? "PASS" : "BLOCK",
      primaryCategory: primary,
      secondaryCategories: [],
      supportStatus: "NOT_APPLICABLE",
      visibleRegister: primary === null ? "clearly_generic" : "presented_as_fact",
      framingAdequate: null,
      claimStrengthFit: null,
      namedSpecificityAllowed: primary === null,
    };
  }

  if (plan.origin !== "source_bound") {
    throw new Imp24CorpusError(`${input.caseId}: pass A encountered unknown source origin ${String(plan.origin)}`);
  }
  const fact = selectedSidecarFactForPassA(input);
  const categories: Imp24SourcePrimaryCategory[] = [];
  if (text.includes(fact.commonError)) categories.push("source_contradiction");
  if (/\b(?:trial|study|research)\b[^:]{0,120}\b(?:established|proved|reported|found)\b/i.test(text)
    || /\bled by\s+(?:Dr\.|Professor)\b/i.test(text)) {
    categories.push("unsupported_attribution");
  }
  if (plan.claimStrength !== "causal"
    && /\bproves?\b|\balways causes?\b|\bevery person\b|\bwithout exception\b/i.test(text)) {
    categories.push("claim_strength_overreach");
  }
  if (categories.length === 0) {
    const hasSourceClaim = text.includes(fact.claim) || text.includes(fact.becauseMechanism);
    if (!hasSourceClaim || passASourceResidual(text, fact).length > 0) categories.push("invented_detail");
  }
  const ordered = [...new Set(categories)].sort((left, right) =>
    IMP24_SOURCE_PRIMARY_CATEGORY_PRECEDENCE.indexOf(left)
      - IMP24_SOURCE_PRIMARY_CATEGORY_PRECEDENCE.indexOf(right));
  const primary = ordered[0] ?? null;
  return {
    result: primary === null ? "PASS" : "BLOCK",
    primaryCategory: primary,
    secondaryCategories: ordered.slice(1),
    supportStatus: primary === null ? "SUPPORTED" : "UNSUPPORTED",
    visibleRegister: primary === null ? "clearly_sourced" : "presented_as_fact",
    framingAdequate: null,
    claimStrengthFit: primary !== "claim_strength_overreach",
    namedSpecificityAllowed: null,
  };
}

function selectedPacketFactForPassB(input: Imp24SourceSemanticInput): PacketFactForAudit {
  const plan = input.evidence.sourceUsePlanUnit;
  const selectedIds = [...new Set([...plan.anchorIds, ...input.evidence.anchorIds])];
  if (selectedIds.length !== 1 || plan.anchorIds.length !== 1 || input.evidence.anchorIds.length !== 1) {
    throw new Imp24CorpusError(`${input.caseId}: pass B cannot resolve one source-packet fact`);
  }
  const fact = (input.evidence.sourcePacket.facts as PacketFactForAudit[])
    .find((candidate) => candidate.id === selectedIds[0]);
  const anchor = (input.evidence.sourcePacket.allowedAnchors as Array<{ id?: string; text?: string }>)
    .find((candidate) => candidate.id === selectedIds[0]);
  if (!fact || typeof anchor?.text !== "string"
    || !anchor.text.includes(fact.claim)
    || !anchor.text.includes(fact.mechanism)
    || !anchor.text.includes(fact.commonError)) {
    throw new Imp24CorpusError(`${input.caseId}: pass B source-packet fact and allowed-anchor bytes disagree`);
  }
  return fact;
}

function passBExactSupportedSourceTexts(fact: PacketFactForAudit): string[] {
  return [
    `The Digital Minimalism chapter source states: ${fact.claim}`,
    `The source describes this mechanism without a universal guarantee: ${fact.claim} ${fact.mechanism}`,
    `The source states: ${fact.claim} ${fact.mechanism}`,
  ].map((value) => value.trim().replace(/\s+/g, " "));
}

/**
 * Pass B is deliberately separate from pass A.  It derives from the retained
 * source-packet fact/allowed-anchor representation and exact sentence forms;
 * it does not call pass A's sidecar/residual/specificity helpers and never
 * reads `item.expected`.
 */
export function deriveImp24SourceSemanticsPassB(
  input: Imp24SourceSemanticInput,
): Imp24DerivedSourceSemantics {
  const unit = input.evidence.sourceUsePlanUnit;
  const chapter = input.evidence.chapterUnit.trim().replace(/\s+/g, " ");

  if (unit.origin === "constructed") {
    if (unit.form !== "application" || !unit.framingRequired || unit.anchorIds.length !== 0) {
      throw new Imp24CorpusError(`${input.caseId}: pass B rejects malformed constructed plan bytes`);
    }
    const visiblyConstructed = /^(?:consider|imagine|suppose)\b|\b(?:hypothetical|fictional)\b/i.test(chapter);
    return {
      result: visiblyConstructed ? "PASS" : "BLOCK",
      primaryCategory: visiblyConstructed ? null : "missing_visible_framing",
      secondaryCategories: [],
      supportStatus: "NOT_APPLICABLE",
      visibleRegister: visiblyConstructed ? "clearly_constructed" : "presented_as_fact",
      framingAdequate: visiblyConstructed,
      claimStrengthFit: null,
      namedSpecificityAllowed: null,
    };
  }

  if (unit.origin === "generic") {
    if (unit.form !== "operational_scenario" || unit.anchorIds.length !== 0) {
      throw new Imp24CorpusError(`${input.caseId}: pass B rejects malformed generic plan bytes`);
    }
    const leaksSpecificity = /\b(?:19|20)\d{2}\b|[“”\"]|\bexactly\s+\d+\b|\bNorthstar Systems\b|\b(?:Dr\.|Mr\.|Ms\.)\s+[A-Z]/.test(chapter);
    return {
      result: leaksSpecificity ? "BLOCK" : "PASS",
      primaryCategory: leaksSpecificity ? "generic_specificity_leak" : null,
      secondaryCategories: [],
      supportStatus: "NOT_APPLICABLE",
      visibleRegister: leaksSpecificity ? "presented_as_fact" : "clearly_generic",
      framingAdequate: null,
      claimStrengthFit: null,
      namedSpecificityAllowed: !leaksSpecificity,
    };
  }

  if (unit.origin !== "source_bound") {
    throw new Imp24CorpusError(`${input.caseId}: pass B encountered unknown source origin ${String(unit.origin)}`);
  }
  const fact = selectedPacketFactForPassB(input);
  const exactSupported = passBExactSupportedSourceTexts(fact).includes(chapter);
  let primary: Imp24SourcePrimaryCategory | null = null;
  let secondary: Imp24SourcePrimaryCategory[] = [];
  const unsupportedAuthority = /\b(?:trial|study|research)\b[^:]{0,120}\b(?:established|proved|reported|found)\b/i.test(chapter)
    || /\bled by\s+(?:Dr\.|Professor)\b/i.test(chapter);
  if (!exactSupported) {
    if (chapter.includes(fact.commonError)) {
      primary = "source_contradiction";
      if (unsupportedAuthority) secondary = ["unsupported_attribution"];
    } else if (unsupportedAuthority) {
      primary = "unsupported_attribution";
    } else if (unit.claimStrength !== "causal"
      && /\bthis proves that\b.*\balways causes?\b.*\bevery person\b.*\bwithout exception\b/i.test(chapter)) {
      primary = "claim_strength_overreach";
    } else {
      primary = "invented_detail";
    }
  }
  return {
    result: primary === null ? "PASS" : "BLOCK",
    primaryCategory: primary,
    secondaryCategories: secondary,
    supportStatus: primary === null ? "SUPPORTED" : "UNSUPPORTED",
    visibleRegister: primary === null ? "clearly_sourced" : "presented_as_fact",
    framingAdequate: null,
    claimStrengthFit: primary !== "claim_strength_overreach",
    namedSpecificityAllowed: null,
  };
}

/** Consensus gold used by certification and V3 evaluation. */
export function deriveImp24SourceSemantics(
  input: Imp24SourceSemanticInput,
): Imp24DerivedSourceSemantics {
  const passA = deriveImp24SourceSemanticsPassA(input);
  const passB = deriveImp24SourceSemanticsPassB(input);
  if (canonicalJson(passA) !== canonicalJson(passB)) {
    throw new Imp24CorpusError(`${input.caseId}: independent source semantic derivations disagree`, [
      `passA=${canonicalJson(passA)}`,
      `passB=${canonicalJson(passB)}`,
    ]);
  }
  return passA;
}

function auditStoredSourceLabels(
  item: Imp24SourceCase,
  derived: Imp24DerivedSourceSemantics,
  pass: "A" | "B",
  issues: string[],
): void {
  const prefix = `${item.caseId}: pass ${pass} independently derived`;
  addIssue(issues, item.expected.goldResult === derived.result, `${prefix} result ${derived.result}, not stored ${item.expected.goldResult}`);
  addIssue(issues, item.expected.expectedSupportStatus === derived.supportStatus, `${prefix} support ${derived.supportStatus}, not stored ${item.expected.expectedSupportStatus}`);
  addIssue(issues, item.expected.expectedCategory === derived.primaryCategory, `${prefix} category ${String(derived.primaryCategory)}, not stored ${String(item.expected.expectedCategory)}`);
  addIssue(issues, item.expected.expectedPrimaryCategory === derived.primaryCategory, `${prefix} primary category ${String(derived.primaryCategory)}, not stored ${String(item.expected.expectedPrimaryCategory)}`);
  addIssue(issues, canonicalJson(item.expected.expectedSecondaryCategories) === canonicalJson(derived.secondaryCategories), `${prefix} secondary categories ${canonicalJson(derived.secondaryCategories)}`);
  addIssue(issues, item.expected.expectedVisibleRegister === derived.visibleRegister, `${prefix} visible register ${derived.visibleRegister}`);
  addIssue(issues, item.expected.expectedFramingAdequate === derived.framingAdequate, `${prefix} framing adequacy ${String(derived.framingAdequate)}`);
  addIssue(issues, item.expected.expectedClaimStrengthFit === derived.claimStrengthFit, `${prefix} claim-strength fit ${String(derived.claimStrengthFit)}`);
  addIssue(issues, item.expected.expectedNamedSpecificityAllowed === derived.namedSpecificityAllowed, `${prefix} named-specificity allowance ${String(derived.namedSpecificityAllowed)}`);
}

function sourcePairProjection(item: Imp24SourceCase): string {
  return hashValue(sourceProtectedProjection(item.evidence));
}

function auditSourceCasesA(cases: Imp24SourceCase[], issues: string[]): void {
  const pairs = new Map<string, Imp24SourceCase[]>();
  for (const item of cases) {
    const group = pairs.get(item.provenance.pairKey) ?? [];
    group.push(item);
    pairs.set(item.provenance.pairKey, group);
    addIssue(issues, item.evidence.provenanceHashes.chapterContentSha256 === sha256Hex(item.evidence.chapterUnit), `${item.caseId}: chapter unit hash drift`);
    addIssue(issues, item.evidence.provenanceHashes.sourcePacketSha256 === hashValue(item.evidence.sourcePacket), `${item.caseId}: source packet hash drift`);
    addIssue(issues, item.evidence.provenanceHashes.sidecarSha256 === hashValue(item.evidence.sidecar), `${item.caseId}: source sidecar hash drift`);
    addIssue(issues, item.evidence.provenanceHashes.anchorCatalogSha256 === hashValue(item.evidence.anchorCatalog), `${item.caseId}: source anchor-catalog hash drift`);
    addIssue(issues, item.provenance.evidenceSha256 === hashValue(item.evidence), `${item.caseId}: source evidence hash drift`);
    addIssue(issues, canonicalJson(item.evidence.anchorIds) === canonicalJson(item.evidence.sourceUsePlanUnit.anchorIds),
      `${item.caseId}: source plan/packet anchor membership drift`);
    addIssue(issues, item.evidence.goldChapterEvidenceSpans.length === 1 && item.evidence.goldChapterEvidenceSpans[0] === item.evidence.chapterUnit, `${item.caseId}: chapter evidence is not the exact retained unit`);
    try {
      auditStoredSourceLabels(item, deriveImp24SourceSemanticsPassA(item), "A", issues);
    } catch (error) {
      issues.push(`${item.caseId}: pass A source semantic derivation failed: ${(error as Error).message}`);
    }
    if (item.pairSide === "clean") {
      addIssue(issues, item.expected.goldResult === "PASS", `${item.caseId}: clean source gold is not PASS`);
      addIssue(issues, item.expected.expectedPrimaryCategory === null, `${item.caseId}: clean source case declares a blocker category`);
    } else {
      const primary = item.expected.expectedPrimaryCategory;
      addIssue(issues, item.expected.goldResult === "BLOCK", `${item.caseId}: defect source gold is not BLOCK`);
      addIssue(issues, primary !== null, `${item.caseId}: defect source case has no primary category`);
      const allCategories = primary === null ? [] : [primary, ...item.expected.expectedSecondaryCategories];
      const precedence = allCategories
        .map((category) => IMP24_SOURCE_PRIMARY_CATEGORY_PRECEDENCE.indexOf(category as Imp24SourcePrimaryCategory))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0];
      addIssue(issues, primary !== null && precedence === IMP24_SOURCE_PRIMARY_CATEGORY_PRECEDENCE.indexOf(primary), `${item.caseId}: primary category violates frozen precedence`);
      addIssue(issues, item.imp24.controlledMutation?.operationCount === 1, `${item.caseId}: source defect does not have exactly one controlled mutation`);
      addIssue(issues, item.imp24.controlledMutation?.declaredPaths.join(",") === "evidence.chapterUnit", `${item.caseId}: source mutation changes a non-declared path`);
    }
    if (item.provenance.basisKind === "generic-operational") {
      const forbidden = genericForbiddenKinds(item.evidence.chapterUnit);
      if (item.pairSide === "clean") {
        addIssue(issues, forbidden.length === 0, `${item.caseId}: clean generic text contains prohibited specificity (${forbidden.join(",")})`);
        addIssue(issues, !/2007|iPhone|Facebook/i.test(item.evidence.chapterUnit), `${item.caseId}: former invalid sourced generic basis survived`);
      } else {
        const expectedKind = item.imp24.controlledMutation?.specificityKind;
        const normalized = forbidden.map((kind) => kind === "named_entity" ? "named_organization" : kind);
        addIssue(issues, expectedKind !== null && expectedKind !== undefined && normalized.length === 1 && normalized[0] === expectedKind, `${item.caseId}: generic defect does not add exactly its one declared specificity`);
      }
    }
    if (item.provenance.basisKind === "constructed-application") {
      const forbidden = genericForbiddenKinds(item.evidence.chapterUnit);
      addIssue(issues, forbidden.length === 0, `${item.caseId}: constructed text contains a real/date/quote/statistical/historical specificity`);
      const visiblyHypothetical = /\b(?:hypothetical|fictional|imagine|suppose)\b/i.test(item.evidence.chapterUnit);
      addIssue(issues, item.pairSide === "clean" ? visiblyHypothetical : !visiblyHypothetical, `${item.caseId}: constructed framing does not match gold`);
    }
  }
  for (const [pairKey, group] of pairs) {
    const clean = group.find((item) => item.pairSide === "clean");
    const defect = group.find((item) => item.pairSide === "defect");
    addIssue(issues, group.length === 2 && !!clean && !!defect, `${pairKey}: source pair is not exactly clean plus defect`);
    if (!clean || !defect) continue;
    addIssue(issues, clean.evidence.chapterUnit !== defect.evidence.chapterUnit, `${pairKey}: source mutation is byte-identical`);
    const actualProtectedProjectionSha256 = sourcePairProjection(clean);
    addIssue(issues, actualProtectedProjectionSha256 === sourcePairProjection(defect), `${pairKey}: protected source evidence changed`);
    addIssue(issues, clean.mutation.protectedProjectionSha256 === defect.mutation.protectedProjectionSha256, `${pairKey}: mutation protection hash differs`);
    addIssue(issues, clean.mutation.protectedProjectionSha256 === actualProtectedProjectionSha256,
      `${pairKey}: stored source mutation protection hash is not the recomputed projection`);
    addIssue(issues, defect.imp24.controlledMutation?.protectedProjectionSha256 === actualProtectedProjectionSha256,
      `${pairKey}: source governance protection hash is not the recomputed projection`);
    addIssue(issues, clean.mutation.cleanChapterUnitSha256 === sha256Hex(clean.evidence.chapterUnit), `${pairKey}: clean mutation hash drift`);
    addIssue(issues, defect.mutation.defectChapterUnitSha256 === sha256Hex(defect.evidence.chapterUnit), `${pairKey}: defect mutation hash drift`);
  }
}

type Imp24DerivedQuizSemantics = {
  kind: "uniquely-correct-clean" | "key-mismatch" | "genuine-ambiguity" | "mechanism-causal-key";
  result: "PASS" | "BLOCK";
  keyCorrect: "correct" | "ambiguous" | "wrong";
  uniqueAnswer: boolean;
  defensibleAnswerIndices: number[];
  keyedMechanismSupported: boolean;
  cleanEvidenceSha256: string;
  mechanismSupportTextSha256: string | null;
  mutationPaths: string[];
};

function quizCoordinate(item: Pick<Imp24QuizCase, "partition" | "baseBookId" | "baseChapter" | "sourceQuestionIndex1">): string {
  return `${item.partition}|${item.baseBookId}|${item.baseChapter}|${item.sourceQuestionIndex1}`;
}

function quizBaselineByCoordinate(cases: Imp24QuizCase[], issues: string[]): Map<string, Imp24QuizCase> {
  const groups = new Map<string, Imp24QuizCase[]>();
  for (const item of cases) {
    const key = quizCoordinate(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const baselines = new Map<string, Imp24QuizCase>();
  for (const [key, group] of groups) {
    const candidates = group.filter((item) => item.provenance.mutationOps.length === 0);
    addIssue(issues, candidates.length === 1, `${key}: quiz audit requires exactly one zero-mutation clean control`);
    if (candidates.length === 1) baselines.set(key, candidates[0]);
  }
  return baselines;
}

function cleanQuizSemanticEvidenceSha256(question: Imp24QuizCase["chapter"]["quiz"]["questions"][number]): string {
  return hashValue({ prompt: question.prompt, choices: question.choices, explanation: question.explanation });
}

function independentlyDefensibleCleanIndexA(
  baseline: Imp24QuizCase,
  issues: string[],
): number {
  const coordinate = quizCoordinate(baseline);
  const proof = QUIZ_CLEAN_SEMANTIC_PROOFS_A[coordinate];
  const question = baseline.chapter.quiz.questions[0];
  if (!proof || !question) {
    issues.push(`${baseline.caseId}: pass A has no frozen independent clean semantic proof for ${coordinate}`);
    return -1;
  }
  addIssue(issues, hashValue(question.prompt) === proof.promptSha256,
    `${baseline.caseId}: pass A clean prompt differs from independent semantic proof`);
  addIssue(issues, hashValue(question.explanation) === proof.explanationSha256,
    `${baseline.caseId}: pass A clean explanation differs from independent semantic proof`);
  addIssue(issues, cleanQuizSemanticEvidenceSha256(question) === proof.semanticEvidenceSha256,
    `${baseline.caseId}: pass A clean prompt/choices/explanation semantic digest drift`);
  const choiceHashes = question.choices.map(hashValue);
  const matching = choiceHashes
    .map((sha256, index) => ({ sha256, index }))
    .filter(({ sha256 }) => sha256 === proof.defensibleChoiceSha256)
    .map(({ index }) => index);
  const distractors = choiceHashes.filter((sha256) => sha256 !== proof.defensibleChoiceSha256).sort();
  addIssue(issues, matching.length === 1, `${baseline.caseId}: pass A independent clean proof does not select exactly one choice`);
  addIssue(issues, canonicalJson(distractors) === canonicalJson([...proof.distractorChoiceSha256s].sort()),
    `${baseline.caseId}: pass A clean distractor evidence differs from independent semantic proof`);
  return matching[0] ?? -1;
}

function independentlyDefensibleCleanIndexB(
  baseline: Imp24QuizCase,
  issues: string[],
): number {
  const question = baseline.chapter.quiz.questions[0];
  if (!question) {
    issues.push(`${baseline.caseId}: pass B clean semantic proof has no question`);
    return -1;
  }
  const digest = hashValue({
    explanation: question.explanation,
    choices: [...question.choices],
    prompt: question.prompt,
  });
  // canonical JSON sorts object keys, so the deliberately different property
  // insertion order still addresses the same immutable semantic bytes.
  const proof = QUIZ_CLEAN_SEMANTIC_DIGESTS_B[digest];
  const coordinate = `${baseline.partition}|${baseline.baseBookId}|${baseline.baseChapter}|${baseline.sourceQuestionIndex1}`;
  if (!proof || proof.coordinate !== coordinate) {
    issues.push(`${baseline.caseId}: pass B retained prompt/choices/explanation lacks its independent semantic digest`);
    return -1;
  }
  const indices = question.choices
    .map((choice, index) => ({ index, sha256: hashValue(choice) }))
    .filter(({ sha256 }) => sha256 === proof.defensibleChoiceSha256)
    .map(({ index }) => index);
  addIssue(issues, indices.length === 1, `${baseline.caseId}: pass B independent clean proof does not resolve one choice`);
  return indices[0] ?? -1;
}

function mechanismSupportParagraph(item: Imp24QuizCase): string {
  return item.chapter.breakdown.fullRead.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).at(-1) ?? "";
}

function independentlyDefensibleMechanismIndexA(
  item: Imp24QuizCase,
  supportText: string,
  issues: string[],
): { index: number; proof: QuizMechanismSemanticProofA | null } {
  const coordinate = quizCoordinate(item);
  const proof = QUIZ_MECHANISM_SEMANTIC_PROOFS_A[coordinate];
  const question = item.chapter.quiz.questions[0];
  if (!proof || !question) {
    issues.push(`${item.caseId}: pass A has no frozen mechanism semantic proof for ${coordinate}`);
    return { index: -1, proof: null };
  }
  const digest = hashValue({
    prompt: question.prompt,
    choices: question.choices,
    explanation: question.explanation,
    support: supportText,
  });
  addIssue(issues, digest === proof.semanticEvidenceSha256,
    `${item.caseId}: pass A mechanism prompt/choices/explanation/support semantic digest drift`);
  addIssue(issues, hashValue(supportText) === proof.supportSha256,
    `${item.caseId}: pass A mechanism support differs from independent semantic proof`);
  const indices = question.choices.map((choice, index) => ({ index, sha256: hashValue(choice) }))
    .filter(({ sha256 }) => sha256 === proof.defensibleChoiceSha256).map(({ index }) => index);
  addIssue(issues, indices.length === 1, `${item.caseId}: pass A mechanism proof does not select exactly one choice`);
  return { index: indices[0] ?? -1, proof };
}

function independentlyDefensibleMechanismIndexB(
  item: Imp24QuizCase,
  supportText: string,
  issues: string[],
): { index: number; proof: (typeof QUIZ_MECHANISM_SEMANTIC_DIGESTS_B)[string] | null } {
  const question = item.chapter.quiz.questions[0];
  if (!question) {
    issues.push(`${item.caseId}: pass B mechanism semantic proof has no question`);
    return { index: -1, proof: null };
  }
  const digest = hashValue({
    support: supportText,
    explanation: question.explanation,
    choices: [...question.choices],
    prompt: question.prompt,
  });
  const proof = QUIZ_MECHANISM_SEMANTIC_DIGESTS_B[digest];
  if (!proof) {
    issues.push(`${item.caseId}: pass B retained mechanism evidence lacks an independent semantic digest`);
    return { index: -1, proof: null };
  }
  addIssue(issues, hashValue(supportText) === proof.supportSha256,
    `${item.caseId}: pass B mechanism support differs from independent semantic proof`);
  const indices = question.choices.map((choice, index) => ({ index, sha256: hashValue(choice) }))
    .filter(({ sha256 }) => sha256 === proof.defensibleChoiceSha256).map(({ index }) => index);
  addIssue(issues, indices.length === 1, `${item.caseId}: pass B mechanism proof does not resolve one defensible choice`);
  return { index: indices[0] ?? -1, proof };
}

function deriveMechanismDefensibleIndexA(item: Imp24QuizCase, supportText: string): number {
  if (!/\b(?:may|can)\b|\bdoes not guarantee\b|\bcannot guarantee\b/i.test(supportText)) {
    throw new Imp24CorpusError(`${item.caseId}: pass A mechanism support text lacks a bounded causal statement`);
  }
  const choices = item.chapter.quiz.questions[0].choices;
  const candidates = choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => !/\b(?:guarantee(?:s|d)?|automatically)\b/i.test(choice))
    .filter(({ choice }) => !/\b(?:source|archive|packet|classification|historical record)\b/i.test(choice))
    .filter(({ choice }) => /\b(?:may|can|reduce|improve|create|comparison|feedback|attentional|responsibility|time)\b/i.test(choice));
  if (candidates.length !== 1) {
    throw new Imp24CorpusError(`${item.caseId}: pass A mechanism proof does not yield one bounded defensible choice`);
  }
  return candidates[0].index;
}

function validateCleanQuizProofA(
  item: Imp24QuizCase,
  baseline: Imp24QuizCase,
  issues: string[],
): { evidenceSha256: string; defensibleIndex: number } {
  const proof = item.cleanItemProof;
  addIssue(issues, canonicalJson(proof) === canonicalJson(baseline.cleanItemProof), `${item.caseId}: pass A clean-item proof differs from its clean control`);
  addIssue(issues, proof.evidencePath === "/quiz/questions/0/explanation", `${item.caseId}: pass A clean-item proof does not bind the exact key explanation path`);
  let evidence = "";
  try {
    const resolved = resolveJsonPath(baseline.chapter as unknown, proof.evidencePath);
    if (typeof resolved !== "string" || resolved.trim().length === 0) throw new Imp24CorpusError("clean-item evidence path is not non-empty text");
    evidence = resolved;
  } catch (error) {
    issues.push(`${item.caseId}: pass A clean-item evidence path did not resolve: ${(error as Error).message}`);
  }
  addIssue(issues, proof.evidenceSha256 === hashValue(evidence), `${item.caseId}: pass A clean-item evidence hash does not match exact resolved explanation`);
  const defensibleIndex = independentlyDefensibleCleanIndexA(baseline, issues);
  addIssue(issues, proof.keyedAnswerIndex === defensibleIndex
    && proof.defensibleAnswerIndices.length === 1
    && proof.defensibleAnswerIndices[0] === defensibleIndex,
  `${item.caseId}: pass A clean-item proof does not resolve the independently defensible choice`);
  return { evidenceSha256: proof.evidenceSha256, defensibleIndex };
}

function validateMechanismProofA(item: Imp24QuizCase, issues: string[]): { defensibleIndex: number; supportSha256: string } | null {
  const proof = item.mechanismProof;
  if (!proof) {
    issues.push(`${item.caseId}: pass A mechanism case has no mechanism proof`);
    return null;
  }
  addIssue(issues, proof.supportPath === "/breakdown/fullRead", `${item.caseId}: pass A mechanism support path is not the complete-reader fullRead path`);
  const appendOps = item.provenance.mutationOps.filter((op) => op.op === "append" && op.path === proof.supportPath);
  addIssue(issues, appendOps.length === 1 && typeof appendOps[0]?.value === "string", `${item.caseId}: pass A mechanism proof has no unique appended support fragment`);
  if (appendOps.length !== 1 || typeof appendOps[0].value !== "string") return null;
  const appended = appendOps[0].value;
  const supportText = appended.trim();
  let resolved = "";
  try {
    const value = resolveJsonPath(item.chapter as unknown, proof.supportPath);
    if (typeof value !== "string") throw new Imp24CorpusError("mechanism support path is not text");
    resolved = value;
  } catch (error) {
    issues.push(`${item.caseId}: pass A mechanism support path did not resolve: ${(error as Error).message}`);
  }
  addIssue(issues, resolved.endsWith(appended) && supportText.length > 0, `${item.caseId}: pass A mechanism support fragment is not exact retained fullRead suffix bytes`);
  addIssue(issues, proof.supportTextSha256 === hashValue(supportText), `${item.caseId}: pass A mechanism support hash does not match exact support fragment`);
  let heuristicIndex = -1;
  try {
    heuristicIndex = deriveMechanismDefensibleIndexA(item, supportText);
  } catch (error) {
    issues.push((error as Error).message);
  }
  const semantic = independentlyDefensibleMechanismIndexA(item, supportText, issues);
  const defensibleIndex = semantic.index;
  addIssue(issues, heuristicIndex === defensibleIndex,
    `${item.caseId}: pass A bounded-choice heuristic disagrees with frozen semantic proof`);
  addIssue(issues, proof.defensibleAnswerIndices.length === 1 && proof.defensibleAnswerIndices[0] === defensibleIndex,
    `${item.caseId}: pass A mechanism proof defensible index differs from bounded choice ${defensibleIndex}`);
  const supported = item.chapter.quiz.questions[0].correctIndex === defensibleIndex;
  addIssue(issues, proof.keyedMechanismSupported === supported, `${item.caseId}: pass A mechanism supported flag differs from key/choice evidence`);
  addIssue(issues, proof.mode === semantic.proof?.mode, `${item.caseId}: pass A mechanism mode differs from independent semantic evidence`);
  addIssue(issues, proof.mode === (supported ? "supported" : "causal-overreach"), `${item.caseId}: pass A mechanism mode differs from bounded key evidence`);
  return { defensibleIndex, supportSha256: proof.supportTextSha256 };
}

function deriveQuizSemanticsA(
  item: Imp24QuizCase,
  baseline: Imp24QuizCase,
  issues: string[],
): Imp24DerivedQuizSemantics | null {
  const question = item.chapter.quiz.questions[0];
  const baseQuestion = baseline.chapter.quiz.questions[0];
  addIssue(issues, item.chapter.quiz.questions.length === 1 && !!question, `${item.caseId}: pass A quiz case is not one isolated question`);
  addIssue(issues, baseline.chapter.quiz.questions.length === 1 && !!baseQuestion, `${item.caseId}: pass A clean quiz control is not isolated`);
  if (!question || !baseQuestion) return null;
  addIssue(issues, item.questionIndex1 === 1, `${item.caseId}: pass A packet-local question index is not one`);
  addIssue(issues, question.prompt.trim().length > 0 && question.choices.length === 3 && question.choices.every((choice) => choice.trim()), `${item.caseId}: pass A quiz prompt/choices are incomplete`);
  addIssue(issues, Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < question.choices.length, `${item.caseId}: pass A stored quiz key is out of range`);
  const cleanProof = validateCleanQuizProofA(item, baseline, issues);
  const cleanEvidenceSha256 = cleanProof.evidenceSha256;
  const cleanDefensibleIndex = cleanProof.defensibleIndex;
  addIssue(issues, baseQuestion.correctIndex === cleanDefensibleIndex,
    `${item.caseId}: pass A clean stored key differs from independent semantic proof`);
  const ops = item.provenance.mutationOps;
  const paths = ops.map((op) => op.path);
  addIssue(issues, item.provenance.mutationOpsSha256 === hashValue(ops), `${item.caseId}: pass A quiz mutation-op hash drift`);
  addIssue(issues, item.provenance.variantContentSha256 === hashValue(item.chapter), `${item.caseId}: pass A quiz variant-content hash drift`);
  addIssue(issues, baseline.provenance.variantContentSha256 === item.provenance.isolatedBaseContentSha256,
    `${item.caseId}: pass A isolated clean quiz binding drift`);
  if (ops.length === 0) {
    addIssue(issues, canonicalJson(item.chapter) === canonicalJson(baseline.chapter), `${item.caseId}: pass A zero-mutation quiz differs from clean control`);
  } else {
    try {
      const rebuilt = clone(baseline.chapter);
      applyMutationOps(rebuilt, ops);
      addIssue(issues, canonicalJson(rebuilt) === canonicalJson(item.chapter), `${item.caseId}: pass A quiz variant is not exactly its declared mutation`);
      addIssue(issues, assertProtectedContentUnchanged(baseline.chapter, item.chapter, ops, item.caseId) === item.provenance.protectedContentSha256,
        `${item.caseId}: pass A quiz protected content hash drift`);
    } catch (error) {
      issues.push(`${item.caseId}: pass A quiz mutation reconstruction failed: ${(error as Error).message}`);
    }
  }

  let derived: Omit<Imp24DerivedQuizSemantics, "cleanEvidenceSha256" | "mechanismSupportTextSha256" | "mutationPaths">;
  let mechanismSupportTextSha256: string | null = null;
  if (ops.length === 0) {
    derived = {
      kind: "uniquely-correct-clean",
      result: "PASS",
      keyCorrect: "correct",
      uniqueAnswer: true,
      defensibleAnswerIndices: [cleanDefensibleIndex],
      keyedMechanismSupported: true,
    };
    addIssue(issues, item.adversarialAmbiguityProof === null && item.mechanismProof === null, `${item.caseId}: pass A clean quiz carries a variant proof`);
  } else if (paths.length === 1 && paths[0] === "/quiz/questions/0/correctIndex") {
    addIssue(issues, question.correctIndex !== cleanDefensibleIndex, `${item.caseId}: pass A key-mismatch mutation did not move away from the defensible answer`);
    addIssue(issues, canonicalJson({ ...question, correctIndex: baseQuestion.correctIndex }) === canonicalJson(baseQuestion), `${item.caseId}: pass A key-mismatch changed content besides the key`);
    derived = {
      kind: "key-mismatch",
      result: "BLOCK",
      keyCorrect: "wrong",
      uniqueAnswer: true,
      defensibleAnswerIndices: [cleanDefensibleIndex],
      keyedMechanismSupported: true,
    };
  } else if (paths.length === 1 && /^\/quiz\/questions\/0\/choices\/\d+$/.test(paths[0])) {
    const matching = question.choices
      .map((choice, index) => ({ choice, index }))
      .filter(({ choice }) => choice === question.choices[cleanDefensibleIndex])
      .map(({ index }) => index);
    const defensible = [cleanDefensibleIndex, ...matching.filter((index) => index !== cleanDefensibleIndex)];
    addIssue(issues, defensible.length === 2 && defensible.includes(cleanDefensibleIndex), `${item.caseId}: pass A ambiguity mutation does not produce exactly two identical defensible choices`);
    const proof = item.adversarialAmbiguityProof;
    addIssue(issues, !!proof
      && canonicalJson(proof.defensibleAnswerIndices) === canonicalJson(defensible)
      && proof.duplicatedChoiceSha256 === hashValue(question.choices[cleanDefensibleIndex]),
    `${item.caseId}: pass A ambiguity proof does not resolve exact duplicated choice bytes`);
    derived = {
      kind: "genuine-ambiguity",
      result: "BLOCK",
      keyCorrect: "ambiguous",
      uniqueAnswer: false,
      defensibleAnswerIndices: defensible,
      keyedMechanismSupported: true,
    };
  } else if (paths.length === 2 && paths.includes("/breakdown/fullRead") && paths.includes("/quiz/questions/0")) {
    const mechanism = validateMechanismProofA(item, issues);
    if (!mechanism) return null;
    const supported = question.correctIndex === mechanism.defensibleIndex;
    mechanismSupportTextSha256 = mechanism.supportSha256;
    derived = {
      kind: "mechanism-causal-key",
      result: supported ? "PASS" : "BLOCK",
      keyCorrect: supported ? "correct" : "wrong",
      uniqueAnswer: true,
      defensibleAnswerIndices: [mechanism.defensibleIndex],
      keyedMechanismSupported: supported,
    };
  } else {
    issues.push(`${item.caseId}: pass A cannot derive quiz mutation family from ${paths.join(",") || "no paths"}`);
    return null;
  }

  addIssue(issues, item.kind === derived.kind, `${item.caseId}: pass A independently derived quiz kind ${derived.kind}, not stored ${item.kind}`);
  addIssue(issues, item.expected.goldResult === derived.result, `${item.caseId}: pass A independently derived quiz result ${derived.result}`);
  addIssue(issues, item.expected.keyCorrect === derived.keyCorrect, `${item.caseId}: pass A independently derived key status ${derived.keyCorrect}`);
  addIssue(issues, item.expected.uniqueAnswer === derived.uniqueAnswer, `${item.caseId}: pass A independently derived uniqueAnswer=${derived.uniqueAnswer}`);
  addIssue(issues, canonicalJson(item.expected.defensibleAnswerIndices) === canonicalJson(derived.defensibleAnswerIndices),
    `${item.caseId}: pass A independently derived defensible indices ${canonicalJson(derived.defensibleAnswerIndices)}`);
  addIssue(issues, item.expected.keyedMechanismSupported === derived.keyedMechanismSupported,
    `${item.caseId}: pass A independently derived keyedMechanismSupported=${derived.keyedMechanismSupported}`);
  return { ...derived, cleanEvidenceSha256, mechanismSupportTextSha256, mutationPaths: [...paths] };
}

function deriveMechanismDefensibleIndexB(item: Imp24QuizCase): number {
  const choices = item.chapter.quiz.questions[0].choices;
  const scores = choices.map((choice, index) => {
    const lower = choice.toLowerCase();
    let score = 0;
    if (/\b(?:may|can|reduce|improve|create|lets|attentional|responsibility|comparison|feedback|time)\b/.test(lower)) score += 4;
    if (/\b(?:guarantee(?:s|d)?|automatically)\b/.test(lower)) score -= 20;
    if (/\b(?:source|archive|packet|classification|historical record)\b/.test(lower)) score -= 30;
    return { index, score };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  if (scores[0].score <= 0 || scores[0].score === scores[1]?.score) {
    throw new Imp24CorpusError(`${item.caseId}: pass B mechanism choices do not have one bounded semantic winner`);
  }
  return scores[0].index;
}

function deriveQuizSemanticsB(
  item: Imp24QuizCase,
  baseline: Imp24QuizCase,
  issues: string[],
): Imp24DerivedQuizSemantics | null {
  const question = item.chapter.quiz.questions[0];
  const baseQuestion = baseline.chapter.quiz.questions[0];
  addIssue(issues, item.chapter.quiz.questions.length === 1 && !!question && baseline.chapter.quiz.questions.length === 1 && !!baseQuestion,
    `${item.caseId}: pass B quiz/control is not a one-question packet`);
  if (!question || !baseQuestion) return null;
  addIssue(issues, item.questionIndex1 === 1 && question.choices.length === 3 && Number.isSafeInteger(question.correctIndex) && question.choices[question.correctIndex] !== undefined,
    `${item.caseId}: pass B quiz identity/key is structurally invalid`);

  const proof = item.cleanItemProof;
  addIssue(issues, canonicalJson(proof) === canonicalJson(baseline.cleanItemProof), `${item.caseId}: pass B clean proof differs from zero-mutation control`);
  addIssue(issues, proof.evidencePath === "/quiz/questions/0/explanation", `${item.caseId}: pass B clean proof path is not the exact explanation path`);
  let cleanEvidence = "";
  try {
    const resolved = readPointerB(baseline.chapter, proof.evidencePath);
    if (typeof resolved !== "string" || resolved.trim().length === 0) throw new Imp24CorpusError("pass B clean proof path is not text");
    cleanEvidence = resolved;
  } catch (error) {
    issues.push(`${item.caseId}: pass B clean proof path did not resolve: ${(error as Error).message}`);
  }
  addIssue(issues, proof.evidenceSha256 === hashValue(cleanEvidence), `${item.caseId}: pass B clean proof hash differs from exact resolved explanation`);
  const cleanDefensibleIndex = independentlyDefensibleCleanIndexB(baseline, issues);
  addIssue(issues, baseQuestion.correctIndex === cleanDefensibleIndex,
    `${item.caseId}: pass B clean stored key differs from independent semantic proof`);
  addIssue(issues, proof.keyedAnswerIndex === cleanDefensibleIndex
    && canonicalJson(proof.defensibleAnswerIndices) === canonicalJson([cleanDefensibleIndex]),
  `${item.caseId}: pass B clean proof differs from independently defensible choice`);

  const ops = item.provenance.mutationOps;
  const paths = ops.map((op) => op.path);
  addIssue(issues, item.provenance.mutationOpsSha256 === hashValue(ops), `${item.caseId}: pass B quiz mutation-op hash drift`);
  addIssue(issues, item.provenance.variantContentSha256 === hashValue(item.chapter), `${item.caseId}: pass B quiz variant-content hash drift`);
  addIssue(issues, baseline.provenance.variantContentSha256 === item.provenance.isolatedBaseContentSha256, `${item.caseId}: pass B isolated clean quiz binding drift`);
  if (ops.length > 0) {
    try {
      const rebuilt = applyMutationOpsB(baseline.chapter, ops);
      addIssue(issues, canonicalJson(rebuilt) === canonicalJson(item.chapter), `${item.caseId}: pass B quiz variant is not exactly its declared mutation`);
      addIssue(issues, protectedProjectionSha256B(baseline.chapter, item.chapter, ops, item.caseId) === item.provenance.protectedContentSha256,
        `${item.caseId}: pass B quiz protected content hash drift`);
    } catch (error) {
      issues.push(`${item.caseId}: pass B quiz mutation reconstruction failed: ${(error as Error).message}`);
    }
  }

  let derived: Omit<Imp24DerivedQuizSemantics, "cleanEvidenceSha256" | "mechanismSupportTextSha256" | "mutationPaths">;
  let supportSha256: string | null = null;
  const samePrompt = question.prompt === baseQuestion.prompt;
  const sameChoices = canonicalJson(question.choices) === canonicalJson(baseQuestion.choices);
  const sameExplanation = question.explanation === baseQuestion.explanation;
  if (ops.length === 0) {
    derived = { kind: "uniquely-correct-clean", result: "PASS", keyCorrect: "correct", uniqueAnswer: true,
      defensibleAnswerIndices: [cleanDefensibleIndex], keyedMechanismSupported: true };
  } else if (samePrompt && sameChoices && sameExplanation && question.correctIndex !== cleanDefensibleIndex) {
    derived = { kind: "key-mismatch", result: "BLOCK", keyCorrect: "wrong", uniqueAnswer: true,
      defensibleAnswerIndices: [cleanDefensibleIndex], keyedMechanismSupported: true };
  } else {
    const matching = question.choices
      .map((choice, index) => ({ choice, index }))
      .filter(({ choice }) => choice === baseQuestion.choices[cleanDefensibleIndex])
      .map(({ index }) => index);
    const duplicates = [cleanDefensibleIndex, ...matching.filter((index) => index !== cleanDefensibleIndex)];
    if (samePrompt && sameExplanation && question.correctIndex === cleanDefensibleIndex && duplicates.length === 2) {
      const ambiguityProof = item.adversarialAmbiguityProof;
      addIssue(issues, !!ambiguityProof
        && ambiguityProof.duplicatedChoiceSha256 === hashValue(baseQuestion.choices[cleanDefensibleIndex])
        && canonicalJson(ambiguityProof.defensibleAnswerIndices) === canonicalJson(duplicates),
      `${item.caseId}: pass B ambiguity proof does not match duplicated choice bytes`);
      derived = { kind: "genuine-ambiguity", result: "BLOCK", keyCorrect: "ambiguous", uniqueAnswer: false,
        defensibleAnswerIndices: duplicates, keyedMechanismSupported: true };
    } else {
      const mechanismProof = item.mechanismProof;
      if (!mechanismProof || mechanismProof.supportPath !== "/breakdown/fullRead") {
        issues.push(`${item.caseId}: pass B cannot derive quiz family and has no exact mechanism proof`);
        return null;
      }
      const fullRead = item.chapter.breakdown.fullRead;
      const finalParagraph = mechanismSupportParagraph(item);
      addIssue(issues, finalParagraph.startsWith("IMP-22 fixture evidence:"), `${item.caseId}: pass B mechanism support is not the retained fixture paragraph`);
      addIssue(issues, mechanismProof.supportTextSha256 === hashValue(finalParagraph), `${item.caseId}: pass B mechanism support hash differs from exact final paragraph`);
      const append = ops.find((op) => op.op === "append" && op.path === mechanismProof.supportPath);
      addIssue(issues, typeof append?.value === "string" && fullRead.endsWith(append.value) && append.value.trim() === finalParagraph,
        `${item.caseId}: pass B mechanism support is not the exact declared append bytes`);
      let heuristicIndex = -1;
      try { heuristicIndex = deriveMechanismDefensibleIndexB(item); }
      catch (error) { issues.push((error as Error).message); }
      const semantic = independentlyDefensibleMechanismIndexB(item, finalParagraph, issues);
      const defensible = semantic.index;
      addIssue(issues, heuristicIndex === defensible,
        `${item.caseId}: pass B bounded-choice heuristic disagrees with frozen semantic proof`);
      const supported = question.correctIndex === defensible;
      addIssue(issues, canonicalJson(mechanismProof.defensibleAnswerIndices) === canonicalJson([defensible]), `${item.caseId}: pass B mechanism proof defensible index drift`);
      addIssue(issues, mechanismProof.keyedMechanismSupported === supported, `${item.caseId}: pass B mechanism supported flag drift`);
      addIssue(issues, mechanismProof.mode === semantic.proof?.mode, `${item.caseId}: pass B mechanism mode differs from independent semantic evidence`);
      addIssue(issues, mechanismProof.mode === (supported ? "supported" : "causal-overreach"), `${item.caseId}: pass B mechanism mode drift`);
      supportSha256 = mechanismProof.supportTextSha256;
      derived = { kind: "mechanism-causal-key", result: supported ? "PASS" : "BLOCK", keyCorrect: supported ? "correct" : "wrong",
        uniqueAnswer: true, defensibleAnswerIndices: [defensible], keyedMechanismSupported: supported };
    }
  }
  addIssue(issues, item.kind === derived.kind, `${item.caseId}: pass B independently derived quiz kind ${derived.kind}, not stored ${item.kind}`);
  addIssue(issues, item.expected.goldResult === derived.result, `${item.caseId}: pass B independently derived quiz result ${derived.result}`);
  addIssue(issues, item.expected.keyCorrect === derived.keyCorrect, `${item.caseId}: pass B independently derived key status ${derived.keyCorrect}`);
  addIssue(issues, item.expected.uniqueAnswer === derived.uniqueAnswer, `${item.caseId}: pass B independently derived uniqueAnswer=${derived.uniqueAnswer}`);
  addIssue(issues, canonicalJson(item.expected.defensibleAnswerIndices) === canonicalJson(derived.defensibleAnswerIndices),
    `${item.caseId}: pass B independently derived defensible indices ${canonicalJson(derived.defensibleAnswerIndices)}`);
  addIssue(issues, item.expected.keyedMechanismSupported === derived.keyedMechanismSupported,
    `${item.caseId}: pass B independently derived keyedMechanismSupported=${derived.keyedMechanismSupported}`);
  return {
    ...derived,
    cleanEvidenceSha256: proof.evidenceSha256,
    mechanismSupportTextSha256: supportSha256,
    mutationPaths: [...paths],
  };
}

type AuditHashSummary = {
  artifactBytesSha256: string;
  sourceInputRawSha256: AuditSourceInputSha256;
  counts: AuditCounts;
  caseSha256: AuditCaseSha256;
  partitionSha256: AuditPartitionSha256;
  roleSha256: AuditRoleSha256;
  bundleSha256: string;
  evidenceEnvelopeSha256: AuditCaseSha256;
};

function expectedV3CorpusId(role: Imp24ReviewRole): string {
  return `imp24-${role}-role-corpus-v3-envelope`;
}

function auditCountsAndHashes(bundle: Imp24CorpusBundle, issues: string[]): AuditHashSummary {
  const counts = {} as AuditCounts;
  const caseSha256 = { reader: {}, source: {}, quiz: {} } as AuditCaseSha256;
  const partitionSha256 = {} as AuditPartitionSha256;
  const roleSha256 = {} as AuditRoleSha256;
  const evidenceEnvelopeSha256 = { reader: {}, source: {}, quiz: {} } as AuditCaseSha256;
  const sourceInputRawSha256 = {} as AuditSourceInputSha256;

  for (const role of ["reader", "source", "quiz"] as const) {
    const corpus = bundle[role] as Imp24RoleCorpus<Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase>;
    const frozen = IMP24_FROZEN_V2_INPUTS[role];
    sourceInputRawSha256[role] = corpus.sourceV2RawSha256;
    addIssue(issues, corpus.schema === IMP24_CORPUS_SCHEMA, `${role}: V3 corpus schema mismatch`);
    addIssue(issues, corpus.experimentId === IMP24_ROLE_QUALIFICATION_ID, `${role}: V3 experiment identity mismatch`);
    addIssue(issues, corpus.role === role, `${role}: role metadata mismatch`);
    addIssue(issues, corpus.corpusId === expectedV3CorpusId(role), `${role}: V3 corpus identity mismatch`);
    addIssue(issues, corpus.sourceV2CorpusId === frozen.corpusId, `${role}: frozen V2 corpus identity mismatch`);
    addIssue(issues, corpus.sourceV2RawSha256 === frozen.rawSha256, `${role}: frozen V2 raw hash metadata drift`);
    addIssue(issues, corpus.sourceV2SubstantiveCorpusSha256 === frozen.substantiveCorpusSha256,
      `${role}: frozen V2 substantive hash metadata drift`);

    counts[role] = { canary: corpus.canary.cases.length, holdout: corpus.holdout.cases.length };
    partitionSha256[role] = { canary: "", holdout: "" };
    const caseIds = new Set<string>();
    const v2IdsByPartition = { canary: new Set<string>(), holdout: new Set<string>() };
    const v2HashesByPartition = { canary: new Set<string>(), holdout: new Set<string>() };
    for (const partition of ["canary", "holdout"] as const) {
      const retained = corpus[partition];
      addIssue(issues, retained.partition === partition, `${role} ${partition}: partition metadata drift`);
      addIssue(issues, retained.cases.length === IMP24_CORPUS_EXPECTED_COUNTS[role][partition],
        `${role} ${partition}: expected ${IMP24_CORPUS_EXPECTED_COUNTS[role][partition]} cases, got ${retained.cases.length}`);
      addIssue(issues, retained.expectedCount === IMP24_CORPUS_EXPECTED_COUNTS[role][partition], `${role} ${partition}: expectedCount metadata drift`);
      addIssue(issues, canonicalJson(retained.generatedComposition) === canonicalJson(composition(retained.cases)),
        `${role} ${partition}: generated composition drift`);
      const sortedIds = retained.cases.map((item) => item.caseId).sort();
      addIssue(issues, canonicalJson(retained.cases.map((item) => item.caseId)) === canonicalJson(sortedIds),
        `${role} ${partition}: case order is not deterministic`);
      for (const item of retained.cases) {
        addIssue(issues, item.role === role, `${item.caseId}: item role ${item.role} is not containing role ${role}`);
        addIssue(issues, item.partition === partition, `${item.caseId}: item partition ${item.partition} is not containing partition ${partition}`);
        addIssue(issues, item.imp24?.schema === "imp24-case-governance-v1", `${item.caseId}: governance schema drift`);
        addIssue(issues, item.imp24?.canaryExcludedFromMetrics === (partition === "canary"),
          `${item.caseId}: canary metric-exclusion governance drift`);
        addIssue(issues, item.imp24?.eligibleForPreLiveFreeze === true, `${item.caseId}: case is not eligible for pre-live freeze`);
        addIssue(issues, item.imp24?.goldProvenance === "fresh-model-free-audit-of-frozen-v2-fixture",
          `${item.caseId}: model-free gold provenance drift`);
        addIssue(issues, !caseIds.has(item.caseId), `${role}: duplicate caseId ${item.caseId}`);
        caseIds.add(item.caseId);
        const v2Id = item.imp24?.v2InputCaseId ?? "";
        const v2Sha = item.imp24?.v2InputCaseSha256 ?? "";
        addIssue(issues, v2Id.length > 0 && !v2IdsByPartition[partition].has(v2Id), `${item.caseId}: duplicate/empty V2 input identity`);
        addIssue(issues, v2Sha.length > 0 && !v2HashesByPartition[partition].has(v2Sha), `${item.caseId}: duplicate/empty V2 input hash`);
        v2IdsByPartition[partition].add(v2Id);
        v2HashesByPartition[partition].add(v2Sha);
        const withoutHash = clone(item) as Record<string, unknown>;
        delete withoutHash.substantiveCaseSha256;
        const actual = hashValue(withoutHash);
        addIssue(issues, actual === item.substantiveCaseSha256, `${item.caseId}: substantive case hash drift`);
        caseSha256[role][item.caseId] = actual;
        try {
          evidenceEnvelopeSha256[role][item.caseId] = evidenceEnvelopeProjectionA(item);
        } catch (error) {
          issues.push(`${item.caseId}: pass A evidence-envelope audit failed: ${(error as Error).message}`);
        }
      }
      for (const v2Id of v2IdsByPartition.canary) {
        addIssue(issues, !v2IdsByPartition.holdout.has(v2Id), `${role}: V2 input ${v2Id} appears in canary and holdout`);
      }
      for (const v2Sha of v2HashesByPartition.canary) {
        addIssue(issues, !v2HashesByPartition.holdout.has(v2Sha), `${role}: V2 input hash ${v2Sha} appears in canary and holdout`);
      }
      const partitionPayload = clone(retained) as Record<string, unknown>;
      delete partitionPayload.substantivePartitionSha256;
      const actualPartitionSha256 = hashValue(partitionPayload);
      addIssue(issues, retained.substantivePartitionSha256 === actualPartitionSha256,
        `${role} ${partition}: substantive partition hash drift`);
      partitionSha256[role][partition] = actualPartitionSha256;
    }
    const rolePayload = clone(corpus) as Record<string, unknown>;
    delete rolePayload.substantiveCorpusSha256;
    const actualRoleSha256 = hashValue(rolePayload);
    addIssue(issues, corpus.substantiveCorpusSha256 === actualRoleSha256, `${role}: substantive role corpus hash drift`);
    roleSha256[role] = actualRoleSha256;
  }

  const bundlePayload = clone(bundle) as Record<string, unknown>;
  delete bundlePayload.substantiveBundleSha256;
  const bundleSha256 = hashValue(bundlePayload);
  addIssue(issues, bundle.substantiveBundleSha256 === bundleSha256, "substantive bundle hash drift");
  return {
    artifactBytesSha256: sha256Hex(serializeImp24CorpusBundle(bundle)),
    sourceInputRawSha256,
    counts,
    caseSha256,
    partitionSha256,
    roleSha256,
    bundleSha256,
    evidenceEnvelopeSha256,
  };
}

function auditProjection(summary: AuditHashSummary, semanticCaseSha256: AuditSemanticCaseSha256): string {
  return hashValue({ ...summary, semanticCaseSha256 });
}

function emptySemanticCaseSha256(): AuditSemanticCaseSha256 {
  return { reader: {}, source: {}, quiz: {} };
}

export function auditImp24CorpusPassA(bundle: Imp24CorpusBundle): Imp24CorpusAuditPass {
  const issues: string[] = [];
  const semanticCaseSha256 = emptySemanticCaseSha256();
  addIssue(issues, bundle.schema === IMP24_CORPUS_BUNDLE_SCHEMA, "bundle schema mismatch");
  addIssue(issues, bundle.experimentId === IMP24_ROLE_QUALIFICATION_ID, "bundle experiment identity mismatch");
  const readerCases = [...bundle.reader.canary.cases, ...bundle.reader.holdout.cases];
  const readerBaselines = readerBaselineByCoordinate(readerCases, issues);
  for (const item of readerCases) {
    const baseline = readerBaselines.get(readerCoordinate(item));
    if (!baseline) continue;
    const derived = deriveReaderSemanticsA(item, baseline, issues);
    if (derived) semanticCaseSha256.reader[item.caseId] = hashValue(derived);
  }
  const sourceCases = [...bundle.source.canary.cases, ...bundle.source.holdout.cases];
  auditSourceCasesA(sourceCases, issues);
  for (const item of sourceCases) {
    try { semanticCaseSha256.source[item.caseId] = hashValue(deriveImp24SourceSemanticsPassA(item)); }
    catch { /* auditSourceCasesA already records the exact derivation error. */ }
  }
  const quizCases = [...bundle.quiz.canary.cases, ...bundle.quiz.holdout.cases];
  const quizBaselines = quizBaselineByCoordinate(quizCases, issues);
  for (const item of quizCases) {
    const baseline = quizBaselines.get(quizCoordinate(item));
    if (!baseline) continue;
    const derived = deriveQuizSemanticsA(item, baseline, issues);
    if (derived) semanticCaseSha256.quiz[item.caseId] = hashValue(derived);
  }
  const normalized = auditCountsAndHashes(bundle, issues);
  return {
    schema: IMP24_CORPUS_AUDIT_SCHEMA,
    passId: "independent-object-audit",
    status: issues.length === 0 ? "PASS" : "FAIL",
    issues,
    ...normalized,
    semanticCaseSha256,
    agreementProjectionSha256: auditProjection(normalized, semanticCaseSha256),
  };
}

type FrozenAuditInventoryB = {
  rawSha256: AuditSourceInputSha256;
  cases: Record<Imp24ReviewRole, Record<"calibration" | "holdout", Map<string, unknown>>>;
};

function loadFrozenAuditInventoryB(contractsDir: string, issues: string[]): FrozenAuditInventoryB {
  const rawSha256 = {} as AuditSourceInputSha256;
  const cases = {
    reader: { calibration: new Map<string, unknown>(), holdout: new Map<string, unknown>() },
    source: { calibration: new Map<string, unknown>(), holdout: new Map<string, unknown>() },
    quiz: { calibration: new Map<string, unknown>(), holdout: new Map<string, unknown>() },
  } satisfies FrozenAuditInventoryB["cases"];
  for (const role of ["reader", "source", "quiz"] as const) {
    const expected = IMP24_FROZEN_V2_INPUTS[role];
    const path = resolve(contractsDir, expected.fileName);
    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch (error) {
      issues.push(`pass B cannot read frozen ${role} input ${path}: ${(error as Error).message}`);
      rawSha256[role] = "";
      continue;
    }
    const raw = sha256Hex(bytes);
    rawSha256[role] = raw;
    addIssue(issues, raw === expected.rawSha256, `pass B frozen ${role} raw bytes drift`);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    } catch (error) {
      issues.push(`pass B frozen ${role} input is not JSON: ${(error as Error).message}`);
      continue;
    }
    addIssue(issues, parsed.schema === "split-lane-role-corpus-v2", `pass B frozen ${role} schema drift`);
    addIssue(issues, parsed.role === role, `pass B frozen ${role} role drift`);
    addIssue(issues, parsed.corpusId === expected.corpusId, `pass B frozen ${role} corpus identity drift`);
    addIssue(issues, parsed.substantiveCorpusSha256 === expected.substantiveCorpusSha256,
      `pass B frozen ${role} substantive identity drift`);
    const partitions = parsed.partitions as Record<string, { cases?: unknown[] }> | undefined;
    for (const partition of ["calibration", "holdout"] as const) {
      const retainedCases = partitions?.[partition]?.cases;
      if (!Array.isArray(retainedCases)) {
        issues.push(`pass B frozen ${role} ${partition} cases are absent`);
        continue;
      }
      for (const candidate of retainedCases) {
        const record = candidate as Record<string, unknown>;
        const caseId = typeof record.caseId === "string" ? record.caseId : "";
        addIssue(issues, caseId.length > 0 && !cases[role][partition].has(caseId),
          `pass B frozen ${role} ${partition} has duplicate/empty case identity ${caseId}`);
        if (caseId.length > 0) cases[role][partition].set(caseId, candidate);
      }
    }
  }
  return { rawSha256, cases };
}

function compositionB(cases: Array<Record<string, unknown>>): Record<string, number> {
  const out: Record<string, number> = { total: cases.length };
  for (let index = 0; index < cases.length; index += 1) {
    const item = cases[index];
    const key = typeof item.kind === "string"
      ? item.kind
      : `${typeof item.family === "string" ? item.family : "unknown"}:${typeof item.pairSide === "string" ? item.pairSide : "unknown"}`;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function sourceProtectedProjectionB(evidence: Imp22SourceCorpusCaseV2["evidence"]): unknown {
  const result = clone(evidence) as Record<string, unknown>;
  delete result.chapterUnit;
  delete result.goldChapterEvidenceSpans;
  delete result.protectedProjectionSha256;
  const hashes = { ...(result.provenanceHashes as Record<string, unknown>) };
  delete hashes.chapterContentSha256;
  result.provenanceHashes = hashes;
  return result;
}

function exactV2ProjectionB(item: Imp24ReaderCase | Imp24QuizCase, original: unknown): boolean {
  const projected = clone(item) as unknown as Record<string, unknown>;
  delete projected.imp24;
  projected.caseId = item.imp24.v2InputCaseId;
  projected.partition = item.partition === "canary" ? "calibration" : "holdout";
  const originalRecord = clone(original) as Record<string, unknown>;
  projected.substantiveCaseSha256 = originalRecord.substantiveCaseSha256;
  return canonicalJson(projected) === canonicalJson(originalRecord);
}

function expectedSourcePairTextB(item: Imp24SourceCase, original: Imp22SourceCorpusCaseV2): string {
  if (item.provenance.basisKind === "source-bound-fact") return original.evidence.chapterUnit;
  const slot = item.partition === "canary" ? 0 : Math.max(0, Number(item.provenance.basisSlot) - 1);
  const pair = item.provenance.basisKind === "constructed-application"
    ? CONSTRUCTED_TEXT_PAIRS[slot]
    : GENERIC_TEXT_PAIRS[slot];
  if (!pair) return "";
  return item.pairSide === "clean" ? pair.clean : pair.defect;
}

function validateFrozenCaseBindingB(
  role: Imp24ReviewRole,
  partition: Imp24CorpusPartitionName,
  item: Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase,
  inventory: FrozenAuditInventoryB | undefined,
  issues: string[],
): void {
  if (!inventory) return;
  const sourcePartition = partition === "canary" ? "calibration" : "holdout";
  const original = inventory.cases[role][sourcePartition].get(item.imp24.v2InputCaseId);
  addIssue(issues, original !== undefined, `${item.caseId}: pass B V2 governance identity does not resolve in ${sourcePartition}`);
  if (original === undefined) return;
  addIssue(issues, item.imp24.v2InputCaseSha256 === hashValue(original), `${item.caseId}: pass B V2 governance hash drift`);
  if (role === "reader" || role === "quiz") {
    addIssue(issues, exactV2ProjectionB(item as Imp24ReaderCase | Imp24QuizCase, original),
      `${item.caseId}: pass B V3 ${role} case is not the exact frozen V2 fixture plus governance identity`);
    return;
  }
  const sourceItem = item as Imp24SourceCase;
  const sourceOriginal = original as Imp22SourceCorpusCaseV2;
  addIssue(issues, sourceItem.pairSide === sourceOriginal.pairSide && sourceItem.pairId === sourceOriginal.pairId,
    `${item.caseId}: pass B source pair identity differs from frozen V2 fixture`);
  addIssue(issues, sourceItem.evidence.chapterUnit === expectedSourcePairTextB(sourceItem, sourceOriginal),
    `${item.caseId}: pass B source text is not its independently frozen family text`);
  addIssue(issues,
    canonicalJson(sourceProtectedProjectionB(sourceItem.evidence)) === canonicalJson(sourceProtectedProjectionB(sourceOriginal.evidence)),
    `${item.caseId}: pass B source protected evidence differs from frozen V2 fixture`);
}

function auditRetainedCountsAndHashesB(
  bundle: Imp24CorpusBundle,
  artifactBytes: Buffer,
  issues: string[],
  inventory?: FrozenAuditInventoryB,
): AuditHashSummary {
  const counts = {} as AuditCounts;
  const caseSha256 = { reader: {}, source: {}, quiz: {} } as AuditCaseSha256;
  const partitionSha256 = {} as AuditPartitionSha256;
  const roleSha256 = {} as AuditRoleSha256;
  const evidenceEnvelopeSha256 = { reader: {}, source: {}, quiz: {} } as AuditCaseSha256;
  const sourceInputRawSha256 = inventory?.rawSha256 ?? {
    reader: bundle.reader.sourceV2RawSha256,
    source: bundle.source.sourceV2RawSha256,
    quiz: bundle.quiz.sourceV2RawSha256,
  };
  addIssue(issues, artifactBytes.toString("utf8") === canonicalPretty(bundle),
    "pass B retained corpus bytes are not the exact canonical serialization");

  for (const role of ["reader", "source", "quiz"] as const) {
    const corpus = bundle[role] as Imp24RoleCorpus<Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase>;
    const frozen = IMP24_FROZEN_V2_INPUTS[role];
    addIssue(issues, corpus.schema === IMP24_CORPUS_SCHEMA && corpus.experimentId === IMP24_ROLE_QUALIFICATION_ID,
      `pass B ${role} corpus identity header drift`);
    addIssue(issues, corpus.role === role && corpus.corpusId === expectedV3CorpusId(role), `pass B ${role} role/corpus identity drift`);
    addIssue(issues, corpus.sourceV2CorpusId === frozen.corpusId, `pass B ${role} source corpus identity drift`);
    addIssue(issues, corpus.sourceV2RawSha256 === sourceInputRawSha256[role]
      && corpus.sourceV2RawSha256 === frozen.rawSha256, `pass B ${role} source raw hash drift`);
    addIssue(issues, corpus.sourceV2SubstantiveCorpusSha256 === frozen.substantiveCorpusSha256,
      `pass B ${role} source substantive hash drift`);
    counts[role] = { canary: corpus.canary.cases.length, holdout: corpus.holdout.cases.length };
    partitionSha256[role] = { canary: "", holdout: "" };
    const seenCaseIds = new Set<string>();
    const partitionV2Ids: Record<Imp24CorpusPartitionName, Set<string>> = { canary: new Set(), holdout: new Set() };
    const partitionV2Hashes: Record<Imp24CorpusPartitionName, Set<string>> = { canary: new Set(), holdout: new Set() };
    for (const partition of ["canary", "holdout"] as const) {
      const retained = corpus[partition];
      addIssue(issues, retained.partition === partition && retained.expectedCount === IMP24_CORPUS_EXPECTED_COUNTS[role][partition],
        `pass B ${role} ${partition} metadata drift`);
      addIssue(issues, retained.cases.length === IMP24_CORPUS_EXPECTED_COUNTS[role][partition],
        `pass B ${role} ${partition} exact count drift`);
      addIssue(issues,
        canonicalJson(compositionB(retained.cases as unknown as Array<Record<string, unknown>>)) === canonicalJson(retained.generatedComposition),
        `pass B ${role} ${partition} composition drift`);
      const orderedIds = retained.cases.map((candidate) => candidate.caseId);
      addIssue(issues, orderedIds.every((value, index) => index === 0 || orderedIds[index - 1].localeCompare(value) <= 0),
        `pass B ${role} ${partition} case order drift`);
      for (const candidate of retained.cases) {
        const item = candidate as Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase;
        addIssue(issues, item.role === role, `${item.caseId}: pass B role membership drift`);
        addIssue(issues, item.partition === partition, `${item.caseId}: pass B partition membership drift`);
        addIssue(issues, item.imp24?.canaryExcludedFromMetrics === (partition === "canary"),
          `${item.caseId}: pass B canary exclusion governance drift`);
        addIssue(issues, item.imp24?.eligibleForPreLiveFreeze === true
          && item.imp24?.goldProvenance === "fresh-model-free-audit-of-frozen-v2-fixture",
        `${item.caseId}: pass B freeze/gold governance drift`);
        addIssue(issues, !seenCaseIds.has(item.caseId), `${item.caseId}: pass B duplicate case identity`);
        seenCaseIds.add(item.caseId);
        const v2Id = item.imp24?.v2InputCaseId ?? "";
        const v2Hash = item.imp24?.v2InputCaseSha256 ?? "";
        addIssue(issues, v2Id.length > 0 && !partitionV2Ids[partition].has(v2Id), `${item.caseId}: pass B duplicate/empty V2 input identity`);
        addIssue(issues, v2Hash.length > 0 && !partitionV2Hashes[partition].has(v2Hash), `${item.caseId}: pass B duplicate/empty V2 input hash`);
        partitionV2Ids[partition].add(v2Id);
        partitionV2Hashes[partition].add(v2Hash);
        validateFrozenCaseBindingB(role, partition, item, inventory, issues);
        const caseCore = clone(item) as Record<string, unknown>;
        delete caseCore.substantiveCaseSha256;
        const actualCaseSha256 = hashValue(caseCore);
        addIssue(issues, item.substantiveCaseSha256 === actualCaseSha256, `${item.caseId}: pass B substantive case hash drift`);
        caseSha256[role][item.caseId] = actualCaseSha256;
        try {
          evidenceEnvelopeSha256[role][item.caseId] = evidenceEnvelopeProjectionB(item);
        } catch (error) {
          issues.push(`${item.caseId}: pass B evidence-envelope audit failed: ${(error as Error).message}`);
        }
      }
      const partitionCore = clone(retained) as Record<string, unknown>;
      delete partitionCore.substantivePartitionSha256;
      const actualPartitionSha256 = hashValue(partitionCore);
      addIssue(issues, retained.substantivePartitionSha256 === actualPartitionSha256,
        `pass B ${role} ${partition} substantive partition hash drift`);
      partitionSha256[role][partition] = actualPartitionSha256;
    }
    for (const v2Id of partitionV2Ids.canary) {
      addIssue(issues, !partitionV2Ids.holdout.has(v2Id), `pass B ${role} V2 input ${v2Id} overlaps canary/holdout`);
    }
    for (const v2Hash of partitionV2Hashes.canary) {
      addIssue(issues, !partitionV2Hashes.holdout.has(v2Hash), `pass B ${role} V2 input hash ${v2Hash} overlaps canary/holdout`);
    }
    const roleCore = clone(corpus) as Record<string, unknown>;
    delete roleCore.substantiveCorpusSha256;
    const actualRoleSha256 = hashValue(roleCore);
    addIssue(issues, corpus.substantiveCorpusSha256 === actualRoleSha256, `pass B ${role} substantive role hash drift`);
    roleSha256[role] = actualRoleSha256;
  }
  const bundleCore = clone(bundle) as Record<string, unknown>;
  delete bundleCore.substantiveBundleSha256;
  const bundleSha256 = hashValue(bundleCore);
  addIssue(issues, bundle.substantiveBundleSha256 === bundleSha256, "pass B substantive bundle hash drift");
  return {
    artifactBytesSha256: sha256Hex(artifactBytes),
    sourceInputRawSha256,
    counts,
    caseSha256,
    partitionSha256,
    roleSha256,
    bundleSha256,
    evidenceEnvelopeSha256,
  };
}

function readerBaselinesB(cases: Imp24ReaderCase[], issues: string[]): Map<string, Imp24ReaderCase> {
  const buckets: Record<string, Imp24ReaderCase[]> = {};
  for (let index = 0; index < cases.length; index += 1) {
    const item = cases[index];
    const key = `${item.partition}/${item.baseBookId}/${item.baseChapter}`;
    (buckets[key] ??= []).push(item);
  }
  const result = new Map<string, Imp24ReaderCase>();
  for (const key of Object.keys(buckets).sort()) {
    const controls = buckets[key].filter((item) => item.provenance.mutationOps.length === 0);
    addIssue(issues, controls.length === 1, `${key}: pass B reader inventory does not have exactly one clean control`);
    if (controls.length === 1) result.set(key.replaceAll("/", "|"), controls[0]);
  }
  return result;
}

function quizBaselinesB(cases: Imp24QuizCase[], issues: string[]): Map<string, Imp24QuizCase> {
  const buckets = new Map<string, Imp24QuizCase[]>();
  for (const item of cases) {
    const key = [item.partition, item.baseBookId, item.baseChapter, item.sourceQuestionIndex1].join("#");
    const values = buckets.get(key) ?? [];
    values.push(item);
    buckets.set(key, values);
  }
  const result = new Map<string, Imp24QuizCase>();
  for (const [key, values] of buckets) {
    const clean = values.filter((item) => item.provenance.mutationOps.length === 0);
    addIssue(issues, clean.length === 1, `${key}: pass B quiz inventory does not have exactly one clean control`);
    if (clean.length === 1) result.set(key.replaceAll("#", "|"), clean[0]);
  }
  return result;
}

function auditStoredSourceLabelsB(
  item: Imp24SourceCase,
  derived: Imp24DerivedSourceSemantics,
  issues: string[],
): void {
  const expected = item.expected;
  const prefix = `${item.caseId}: pass B independently derived`;
  addIssue(issues, expected.goldResult === derived.result, `${prefix} result ${derived.result}`);
  addIssue(issues, expected.expectedSupportStatus === derived.supportStatus, `${prefix} support ${derived.supportStatus}`);
  addIssue(issues, expected.expectedCategory === derived.primaryCategory, `${prefix} category ${String(derived.primaryCategory)}`);
  addIssue(issues, expected.expectedPrimaryCategory === derived.primaryCategory, `${prefix} primary category ${String(derived.primaryCategory)}`);
  addIssue(issues, canonicalJson(expected.expectedSecondaryCategories) === canonicalJson(derived.secondaryCategories),
    `${prefix} secondary categories ${canonicalJson(derived.secondaryCategories)}`);
  addIssue(issues, expected.expectedVisibleRegister === derived.visibleRegister, `${prefix} visible register ${derived.visibleRegister}`);
  addIssue(issues, expected.expectedFramingAdequate === derived.framingAdequate, `${prefix} framing adequacy`);
  addIssue(issues, expected.expectedClaimStrengthFit === derived.claimStrengthFit, `${prefix} claim strength`);
  addIssue(issues, expected.expectedNamedSpecificityAllowed === derived.namedSpecificityAllowed, `${prefix} specificity allowance`);
}

function genericSpecificityLeakB(text: string): boolean {
  const normalized = text.normalize("NFKC");
  return /(?:^|\W)(?:19|20)\d{2}(?:\W|$)/.test(normalized)
    || /["“”]/.test(normalized)
    || /\bexactly\s+\d+\b/i.test(normalized)
    || /\bNorthstar\s+Systems\b/i.test(normalized)
    || /\b(?:Dr|Mr|Ms)\.\s+[A-Z]/.test(normalized)
    || /\b(?:iPhone|Facebook)\b/.test(normalized);
}

/**
 * Independent pass B begins from serialized bytes and deliberately performs a
 * JSON-level audit rather than calling pass A's role validators. Agreement is
 * over exact case/partition hashes, counts, and independently derived semantic
 * projections, so serialization drift or semantic relabeling fails closed.
 */
function auditImp24CorpusPassBBytes(
  artifactBytes: Buffer,
  inventory?: FrozenAuditInventoryB,
): Imp24CorpusAuditPass {
  const issues: string[] = [];
  const semanticCaseSha256 = emptySemanticCaseSha256();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(artifactBytes.toString("utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new Imp24CorpusError("serialized IMP-24 corpus is not JSON", [(error as Error).message]);
  }
  const reparsed = raw as unknown as Imp24CorpusBundle;
  addIssue(issues, raw.schema === IMP24_CORPUS_BUNDLE_SCHEMA, "serialized bundle schema mismatch");
  addIssue(issues, raw.experimentId === IMP24_ROLE_QUALIFICATION_ID, "serialized bundle experiment identity mismatch");
  const normalized = auditRetainedCountsAndHashesB(reparsed, artifactBytes, issues, inventory);

  const readerCases = [...reparsed.reader.canary.cases, ...reparsed.reader.holdout.cases];
  const readerBaselines = readerBaselinesB(readerCases, issues);
  for (const item of readerCases) {
    const baseline = readerBaselines.get(readerCoordinate(item));
    if (!baseline) continue;
    const derived = deriveReaderSemanticsB(item, baseline, issues);
    if (derived) semanticCaseSha256.reader[item.caseId] = hashValue(derived);
  }

  const sourcePairsByKey = new Map<string, Imp24SourceCase[]>();
  for (const item of [...reparsed.source.canary.cases, ...reparsed.source.holdout.cases]) {
    const pair = sourcePairsByKey.get(item.provenance.pairKey) ?? [];
    pair.push(item);
    sourcePairsByKey.set(item.provenance.pairKey, pair);
    try {
      const derived = deriveImp24SourceSemanticsPassB(item);
      auditStoredSourceLabelsB(item, derived, issues);
      semanticCaseSha256.source[item.caseId] = hashValue(derived);
    } catch (error) {
      issues.push(`${item.caseId}: pass B source semantic derivation failed: ${(error as Error).message}`);
    }
    addIssue(issues, item.evidence.provenanceHashes.chapterContentSha256 === sha256Hex(item.evidence.chapterUnit),
      `${item.caseId}: pass B chapter unit hash drift`);
    addIssue(issues, item.evidence.provenanceHashes.sourcePacketSha256 === hashValue(item.evidence.sourcePacket),
      `${item.caseId}: pass B source packet hash drift`);
    addIssue(issues, item.evidence.provenanceHashes.sidecarSha256 === hashValue(item.evidence.sidecar),
      `${item.caseId}: pass B source sidecar hash drift`);
    addIssue(issues, item.evidence.provenanceHashes.anchorCatalogSha256 === hashValue(item.evidence.anchorCatalog),
      `${item.caseId}: pass B anchor-catalog hash drift`);
    addIssue(issues, item.provenance.evidenceSha256 === hashValue(item.evidence), `${item.caseId}: pass B source evidence hash drift`);
    addIssue(issues, canonicalJson(item.evidence.anchorIds) === canonicalJson(item.evidence.sourceUsePlanUnit.anchorIds),
      `${item.caseId}: pass B source plan/packet anchor membership drift`);
    addIssue(issues, item.pairSide !== "defect" || item.expected.expectedPrimaryCategory !== null, `${item.caseId}: serialized source defect lacks primary category`);
    addIssue(issues, item.pairSide !== "clean" || item.expected.expectedPrimaryCategory === null, `${item.caseId}: serialized source clean has primary category`);
    if (item.provenance.basisKind === "generic-operational" && item.pairSide === "clean") {
      addIssue(issues, !genericSpecificityLeakB(item.evidence.chapterUnit), `${item.caseId}: serialized clean generic is invalid`);
    }
    if (item.provenance.basisKind === "constructed-application") {
      const framed = /\b(?:hypothetical|fictional|imagine|suppose)\b/i.test(item.evidence.chapterUnit);
      addIssue(issues, item.pairSide === "clean" ? framed : !framed, `${item.caseId}: serialized constructed framing invalid`);
    }
  }
  for (const [pairKey, pair] of sourcePairsByKey) {
    const clean = pair.find((item) => item.pairSide === "clean");
    const defect = pair.find((item) => item.pairSide === "defect");
    addIssue(issues, pair.length === 2 && !!clean && !!defect, `${pairKey}: serialized source pair incomplete`);
    if (clean && defect) {
      addIssue(issues, clean.evidence.chapterUnit !== defect.evidence.chapterUnit, `${pairKey}: serialized source mutation vanished`);
      const cleanProjectionSha256 = hashValue(sourceProtectedProjectionB(clean.evidence));
      const defectProjectionSha256 = hashValue(sourceProtectedProjectionB(defect.evidence));
      addIssue(issues, cleanProjectionSha256 === defectProjectionSha256, `${pairKey}: serialized protected source projection drift`);
      addIssue(issues, clean.mutation.protectedProjectionSha256 === cleanProjectionSha256
        && defect.mutation.protectedProjectionSha256 === cleanProjectionSha256,
      `${pairKey}: pass B stored source mutation protection hash drift`);
      addIssue(issues, defect.imp24.controlledMutation?.protectedProjectionSha256 === cleanProjectionSha256,
        `${pairKey}: pass B source governance protection hash drift`);
      addIssue(issues, defect.imp24.controlledMutation?.operationCount === 1
        && canonicalJson(defect.imp24.controlledMutation.declaredPaths) === canonicalJson(["evidence.chapterUnit"]),
      `${pairKey}: pass B source mutation is not exactly the declared chapter-unit change`);
      addIssue(issues, clean.mutation.cleanChapterUnitSha256 === sha256Hex(clean.evidence.chapterUnit)
        && defect.mutation.defectChapterUnitSha256 === sha256Hex(defect.evidence.chapterUnit),
      `${pairKey}: pass B source mutation text hash drift`);
    }
  }

  const quizCases = [...reparsed.quiz.canary.cases, ...reparsed.quiz.holdout.cases];
  const quizBaselines = quizBaselinesB(quizCases, issues);
  for (const item of quizCases) {
    const baseline = quizBaselines.get(quizCoordinate(item));
    if (!baseline) continue;
    const derived = deriveQuizSemanticsB(item, baseline, issues);
    if (derived) semanticCaseSha256.quiz[item.caseId] = hashValue(derived);
  }

  return {
    schema: IMP24_CORPUS_AUDIT_SCHEMA,
    passId: "independent-serialized-audit",
    status: issues.length === 0 ? "PASS" : "FAIL",
    issues,
    ...normalized,
    semanticCaseSha256,
    agreementProjectionSha256: auditProjection(normalized, semanticCaseSha256),
  };
}

/** Compatibility entrypoint for deterministic in-memory tests.  The certified
 * pre-live flow must use `auditImp24CorpusRetainedArtifactPassB` below. */
export function auditImp24CorpusPassB(serializedBundle: string): Imp24CorpusAuditPass {
  return auditImp24CorpusPassBBytes(Buffer.from(serializedBundle, "utf8"));
}

/**
 * Genuine retained-artifact Pass B.  This entrypoint reads both the V3 bundle
 * and all three frozen V2 source artifacts from disk, then performs the JSON-
 * level audit without invoking Pass A, its top-level hash validator, or its
 * baseline selectors.
 */
export function auditImp24CorpusRetainedArtifactPassB(
  options: Imp24RetainedCorpusAuditOptions,
): Imp24CorpusAuditPass {
  const issues: string[] = [];
  const inventory = loadFrozenAuditInventoryB(resolve(options.contractsDir), issues);
  let artifactBytes: Buffer;
  try {
    artifactBytes = readFileSync(resolve(options.corpusBundlePath));
  } catch (error) {
    throw new Imp24CorpusError("retained IMP-24 corpus artifact cannot be read", [(error as Error).message]);
  }
  const audit = auditImp24CorpusPassBBytes(artifactBytes, inventory);
  if (issues.length === 0) return audit;
  const mergedIssues = [...issues, ...audit.issues];
  return { ...audit, status: "FAIL", issues: mergedIssues };
}

export function certifyImp24Corpora(bundle: Imp24CorpusBundle): Imp24CorpusCertification {
  const passA = auditImp24CorpusPassA(bundle);
  const serialized = serializeImp24CorpusBundle(bundle);
  const passB = auditImp24CorpusPassB(serialized);
  if (passA.status !== "PASS" || passB.status !== "PASS") {
    throw new Imp24CorpusError("IMP-24 model-free corpus audit failed", [...passA.issues, ...passB.issues]);
  }
  if (passA.agreementProjectionSha256 !== passB.agreementProjectionSha256) {
    throw new Imp24CorpusError("independent IMP-24 corpus audits disagree", [
      `passA=${passA.agreementProjectionSha256}`,
      `passB=${passB.agreementProjectionSha256}`,
    ]);
  }
  return {
    schema: "imp24-corpus-certification-v1",
    status: "PASS",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    passA,
    passB,
    agreementSha256: passA.agreementProjectionSha256,
  };
}

export const IMP24_LEGACY_EVIDENCE_IDENTITIES = {
  v1: {
    experimentId: "s16-forward-role-qualification-v1",
    repositoryPath: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v1",
    gitTreeId: "6e8b88c60ddf6972dc5f296926d4221c459d713f",
    lsTreeSha256: "599d2ebd695b42817754bf6e12039184234b5ccae85b8887f64d983e2b2daf76",
    invalidationDecision: "INVALID_INSTRUMENT_DO_NOT_ATTEST",
    invalidationRelativePath: "live/calibration/CALIBRATION_INVALIDATION.json",
  },
  v2: {
    experimentId: "s16-forward-role-qualification-v2",
    repositoryPath: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v2",
    gitTreeId: "2522d62da3b17cc3de799c85172c5f5780df532c",
    lsTreeSha256: "d1968f2e31c639d84bf136b33b61edd76c796e95d68c8f52fe7288257ade03d7",
    invalidationDecision: "BLOCKED_CALIBRATION_INVALID",
    invalidationRelativePath: "live/calibration/CALIBRATION_INVALIDATION.json",
  },
} as const;

export type Imp24LegacyEvidenceClosureArtifact = {
  schema: typeof IMP24_LEGACY_EVIDENCE_CLOSURE_SCHEMA;
  status: "PRESERVED_CLOSED_NON_RESUMABLE";
  successorExperimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  identities: Array<{
    experimentId: string;
    repositoryPath: string;
    gitTreeId: string;
    lsTreeSha256: string;
    invalidationDecision: string;
    holdoutStarted: false;
    resumable: false;
    attestable: false;
    reinterpretable: false;
  }>;
  closureSha256: string;
};

function git(repositoryRoot: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
}

export function assertImp24LegacyEvidencePreservation(repositoryRoot: string): Imp24LegacyEvidenceClosureArtifact {
  const identities: Imp24LegacyEvidenceClosureArtifact["identities"] = [];
  for (const version of ["v1", "v2"] as const) {
    const expected = IMP24_LEGACY_EVIDENCE_IDENTITIES[version];
    const treeId = git(repositoryRoot, ["rev-parse", `HEAD:${expected.repositoryPath}`]).trim();
    const lsTree = git(repositoryRoot, ["ls-tree", "-r", "HEAD", expected.repositoryPath]);
    const lsTreeSha256 = sha256Hex(lsTree);
    if (treeId !== expected.gitTreeId || lsTreeSha256 !== expected.lsTreeSha256) {
      throw new Imp24CorpusError(`${version} legacy evidence identity drift`, [
        `tree expected=${expected.gitTreeId} actual=${treeId}`,
        `ls-tree expected=${expected.lsTreeSha256} actual=${lsTreeSha256}`,
      ]);
    }
    // `git diff` alone misses untracked additions.  The closed evidence trees
    // must be byte-for-byte clean in the working tree as well as exact in HEAD;
    // an additive file inside either old identity would otherwise create an
    // ambiguous, apparently resumable evidence surface.
    const status = git(repositoryRoot, [
      "status", "--porcelain=v1", "--untracked-files=all", "--", expected.repositoryPath,
    ]).trim();
    if (status.length > 0) {
      throw new Imp24CorpusError(`${version} legacy evidence has working-tree modifications`, status.split("\n"));
    }
    const invalidationPath = resolve(repositoryRoot, expected.repositoryPath, expected.invalidationRelativePath);
    const invalidation = JSON.parse(readFileSync(invalidationPath, "utf8")) as Record<string, unknown>;
    if (invalidation.experimentId !== expected.experimentId
      || invalidation.decision !== expected.invalidationDecision
      || invalidation.holdoutStarted !== false) {
      throw new Imp24CorpusError(`${version} invalidation metadata drifted`, [canonicalJson(invalidation)]);
    }
    const nonResumable = version === "v1"
      ? invalidation.furtherCorrectedRerunsAllowed === false
      : invalidation.furtherCorrectedRerunAllowed === false && invalidation.attestationWritten === false;
    if (!nonResumable) throw new Imp24CorpusError(`${version} is not explicitly closed/non-resumable`);
    identities.push({
      experimentId: expected.experimentId,
      repositoryPath: expected.repositoryPath,
      gitTreeId: treeId,
      lsTreeSha256,
      invalidationDecision: expected.invalidationDecision,
      holdoutStarted: false,
      resumable: false,
      attestable: false,
      reinterpretable: false,
    });
  }
  const draft = {
    schema: IMP24_LEGACY_EVIDENCE_CLOSURE_SCHEMA,
    status: "PRESERVED_CLOSED_NON_RESUMABLE" as const,
    successorExperimentId: IMP24_ROLE_QUALIFICATION_ID,
    identities,
  };
  return { ...draft, closureSha256: hashValue(draft) };
}

export function materializeImp24LegacyEvidenceClosure(
  repositoryRoot: string,
  outputPath: string,
): Imp24LegacyEvidenceClosureArtifact {
  const artifact = assertImp24LegacyEvidencePreservation(repositoryRoot);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, canonicalPretty(artifact), "utf8");
  return artifact;
}
