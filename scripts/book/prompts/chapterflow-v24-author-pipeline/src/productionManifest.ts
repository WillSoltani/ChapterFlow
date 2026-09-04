import type { CandidateReleaseVerdict } from "./release/candidateReleaseVerdict.js";
import { existsSync, readFileSync } from "fs";
import { basename, relative, resolve, sep } from "path";

import type { BookPackageV21, ChapterV21 } from "./types.js";
import { V21_SCHEMA_VERSION } from "./types.js";
import { isApprovedReviewer, isAttestationFresh, type QcAttestation } from "./critics/qcAttestation.js";
import { CANONICAL_STATE, REPO_ROOT, normSlug } from "./lib/chapterPaths.js";
import {
  canonicalChapterIndexPath,
  compareChapterSetToCanonical,
  readCandidateChapterSet,
  readCanonicalChapterIndex,
} from "./lib/chapterSet.js";
import { canonicalJson, canonicalJsonSha256 } from "./lib/canonicalJson.js";
import {
  candidateChapterArtifactPath,
  candidateManifestPath,
  readCandidateJson,
  resolveCandidateSourceSidecar,
  candidateChapterHasSourceV2,
  type CandidateEvidence,
} from "./lib/candidateEvidence.js";
import { findRunArtifact } from "./lib/runDirs.js";
import {
  READER_CONTENT_HASH_VERSION,
  READER_CONTENT_STRIP_RULES_VERSION,
  readerContentHash,
} from "./lib/readerContent.js";
import {
  buildPipelineFingerprints,
  type FingerprintRoots,
  type PipelineFingerprint,
} from "./lib/pipelineFingerprint.js";
import { parseSourceVerifyRecord, sourceVerifyRecordPath } from "./critics/sourceVerify.js";
import {
  evaluateSourceRealityPolicy,
  type SourceRealityClassification,
  type SourceRealityDecision,
} from "./qc/sourceRealityPolicy.js";

// ── Schema versions ───────────────────────────────────────────────────────────
// v1 is preserved for read-compatibility with already-promoted packages; v2 is
// the schema for NEWLY promoted packages and is the only version that binds the
// source-reality verification record and deterministic build-input fingerprints.
export const PRODUCTION_MANIFEST_SCHEMA_VERSION_V1 = "chapterflow-production-manifest-v1" as const;
export const PRODUCTION_MANIFEST_SCHEMA_VERSION_V2 = "chapterflow-production-manifest-v2" as const;
/** The schema version stamped on newly built manifests. */
export const PRODUCTION_MANIFEST_SCHEMA_VERSION = PRODUCTION_MANIFEST_SCHEMA_VERSION_V2;
export const SUPPORTED_PRODUCTION_MANIFEST_SCHEMA_VERSIONS = [
  PRODUCTION_MANIFEST_SCHEMA_VERSION_V1,
  PRODUCTION_MANIFEST_SCHEMA_VERSION_V2,
] as const;

export const PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION_V1 = "chapterflow-production-manifest-payload-v1" as const;
export const PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION_V2 = "chapterflow-production-manifest-payload-v2" as const;
/** Back-compat alias kept pointing at the current (v2) payload schema version. */
export const PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION = PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION_V2;

export const PRODUCTION_CANONICAL_JSON_VERSION = "canonical-json-sha256-v1" as const;

// Human-readable provenance LABELS. In v1 these WERE the prompt/config/code
// identity; in v2 they are retained only as metadata (req 8) — the identity is
// the deterministic fingerprint over the actual files.
export const PRODUCTION_PROMPT_SET_LABEL = "chapterflow-v21-authored-prompts-v1" as const;
export const PRODUCTION_CONFIG_LABEL = "chapterflow-v21-authored-config-v1" as const;
export const PRODUCTION_CODE_LABEL = "chapterflow-v21-authored-production-package-v1" as const;
// Back-compat aliases (the v1 constant names).
export const PRODUCTION_PROMPT_SET_ID = PRODUCTION_PROMPT_SET_LABEL;
export const PRODUCTION_CONFIG_ID = PRODUCTION_CONFIG_LABEL;
export const PRODUCTION_PACKAGE_CODE_ID = PRODUCTION_CODE_LABEL;

const DEFAULT_RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow", "runs");

export type ProductionManifestVersion = "v1" | "v2";

export type ProductionManifestFinding = {
  checkId: string;
  severity: "blocker";
  message: string;
  chapterNumber?: number;
  path?: string;
  expected?: unknown;
  actual?: unknown;
};

export type ProductionManifestChapter = {
  chapterId: string;
  chapterNumber: number;
  title: string;
  readerContentHash: string;
  sourceEvidence: {
    path: string;
    semanticHash: string;
    schemaVersion: string | null;
  };
  authoringEvidence: {
    path: string;
    semanticHash: string;
    schemaVersion: string | null;
    sourceHash: string | null;
  } | null;
  generationEvidence: {
    path: string;
    semanticHash: string;
    schemaVersion: string | null;
    runId: string | null;
    degradationCount: number;
    seriousDegradationCount: number;
    advisoryDegradationCount: number;
  } | null;
  /**
   * The legacy per-chapter `state/qc/<bookId>-chNN.qc.json` attestation (the v21
   * pipeline shape). ALWAYS an object on the canonical-index regime — unchanged,
   * still required, still gated on schema/verdict/roundId/freshness/reviewer.
   *
   * NULL on the v25 candidate regime, where no such file exists and none is
   * wanted: the candidate's QC authority is the round-level v25 QC round the
   * release named and the release preflight verified PASS against this exact
   * candidate digest. What was relied on is recorded at payload level in
   * `candidateQcEvidence` (and hashed into the contentId) rather than left
   * unstated.
   */
  qcAttestation: {
    path: string;
    semanticHash: string;
    roundId: string;
    contentHash: string;
    hashVersion: string;
    reviewer: string;
    reviewedAt: string;
  } | null;
};

/**
 * WHAT THE CANDIDATE REGIME RELIED ON FOR QC, recorded in the payload.
 *
 * The v21 per-chapter attestation is a file a chapter-at-a-time reviewer wrote
 * into ambient `state/qc`. The v25 candidate route has no such file and cannot
 * grow one: its QC is a ROUND, bound by digest to one whole candidate, and the
 * release preflight verifies that round's outcome is PASS for THIS candidate
 * before the pointer CAS. Recording the round identity here means the manifest
 * states which QC authority it stands on instead of silently having none, and
 * because it is payload data it is hashed into the contentId — a released pair
 * cannot be re-pointed at a different round without changing its identity.
 */
export type ProductionManifestCandidateQcEvidence = {
  source: "v25-qc-round";
  reviewId: string;
  qcRoundId: string;
  /** Why there is no per-chapter attestation, stated rather than implied. */
  perChapterAttestation: "subsumed-by-round";
  /**
   * R-254 — THE VERDICT THE NAMED ROUND ACTUALLY REACHED.
   *
   * Two ids alone made the released pair unable to state its own QC result:
   * neither a verifier nor a human could tell that the named round PASSed, and
   * the round/review JSON it names lives only under the v25 root, which is
   * never committed and which publish never preserves. This block carries the
   * outcome, the issue counts by severity, the per-chapter panel composites
   * (R-229's census — the numbers that were free text nothing parsed) and, when
   * the candidate has one, the whole-book catalog-rubric result (R-080).
   *
   * OPTIONAL, and its absence is honest rather than lenient: a manifest built
   * before this field existed, or by a caller that holds no round to read,
   * records no verdict instead of a fabricated one. It is payload data, so it
   * is hashed into the contentId — a released pair cannot be re-pointed at a
   * different verdict without changing its identity — and the verifier replays
   * the manifest's OWN declared block rather than recomputing it, exactly as it
   * already does for the reviewId/qcRoundId pair.
   */
  verdict?: CandidateReleaseVerdict;
};

/**
 * Source-reality verification evidence bound into a v2 payload. It proves not
 * just WHICH sidecars were used (the per-chapter sourceEvidence) but that the
 * book's sidecars passed reality verification — and exactly which record (or
 * legacy exemption) carried that verdict. Recomputed from disk by the verifier,
 * so tampering, deletion, replacement, a wrong-book record, or a stale exemption
 * all move the contentId or fail reconstruction (req 3, 4, 9).
 */
export type ProductionSourceRealityEvidence = {
  bookId: string;
  /** verified | legacy-exempt | not-applicable. Only non-blocking decisions can be bound. */
  policyResult: Extract<SourceRealityDecision, "required-and-verified" | "legacy-exempt" | "not-applicable">;
  classification: SourceRealityClassification;
  /** Present only when policyResult === "required-and-verified". */
  record: {
    path: string;
    schemaVersion: string | null;
    semanticHash: string;
    bookId: string | null;
    verifier: string | null;
    verifiedAt: string | null;
  } | null;
  /** Present only when policyResult === "legacy-exempt". */
  exemption: {
    path: string;
    schemaVersion: string;
    semanticHash: string;
    approvedBy: string;
    approvedAt: string;
    expiresAt: string | null;
    boundIdentity: {
      canonicalIndexHash: string | null;
      packageId: string | null;
      contentId: string | null;
    };
  } | null;
};

export type ProductionManifestVersionsV1 = {
  canonicalJson: typeof PRODUCTION_CANONICAL_JSON_VERSION;
  readerContentHash: typeof READER_CONTENT_HASH_VERSION;
  readerContentStripRules: typeof READER_CONTENT_STRIP_RULES_VERSION;
  promptSet: string;
  config: string;
  code: string;
};

export type ProductionManifestVersionsV2 = {
  canonicalJson: typeof PRODUCTION_CANONICAL_JSON_VERSION;
  readerContentHash: typeof READER_CONTENT_HASH_VERSION;
  readerContentStripRules: typeof READER_CONTENT_STRIP_RULES_VERSION;
  /** Content fingerprint over the actual prompt files (req 5). */
  promptBundle: PipelineFingerprint;
  /** Content fingerprint over the actual config files (req 5). */
  configBundle: PipelineFingerprint;
  /** Content fingerprint over the pipeline source + package metadata (req 5). */
  codeFingerprint: PipelineFingerprint;
  /** Human-readable labels, retained as metadata only (req 8). */
  labels: { promptSet: string; config: string; code: string };
};

export type ProductionManifestChapterSpec = { chapterId: string; chapterNumber: number; chapterTitle: string };

/**
 * WHERE the manifest's chapter set came from. Exactly one of these blocks is
 * present in a payload, and it is what tells the verifier how to reconstruct the
 * set from disk:
 *
 *  - `canonicalIndex` — the legacy/ambient route. The set is `state/indexes/<bookId>.json`
 *    and the package chapters are cross-checked against it. Byte-identical to
 *    what this builder has always produced.
 *  - `candidateChapterSet` — the v25 CANDIDATE release route (promote-book with
 *    --candidate-id). The set is the candidate's own CHAPTER artifacts, which are
 *    exactly the chapters in this package; `candidateId`/`manifestDigest` name the
 *    digest-bound candidate they were read from and are hashed into the contentId.
 *    A candidate-only book root HAS no state/indexes, and this route never reads it.
 */
export type ProductionManifestCanonicalIndexBlock = {
  path: string;
  semanticHash: string;
  chapters: ProductionManifestChapterSpec[];
};

export type ProductionManifestCandidateChapterSetBlock = {
  source: "candidate";
  candidateId: string;
  manifestDigest: string;
  semanticHash: string;
  chapters: ProductionManifestChapterSpec[];
};

/** The candidate whose CHAPTER artifacts are the chapter set for this build. */
export type ProductionChapterSetSource = Readonly<{
  kind: "candidate";
  candidateId: string;
  manifestDigest: string;
}>;

/**
 * What a CALLER expects a manifest's chapter-set authority to be.
 *
 * A manifest DECLARES its own regime, and a verifier that only reads that
 * declaration lets the artifact under test choose how it is checked. A caller
 * that independently knows which release it is looking at — the release adapter
 * self-verifying the candidate it JUST released, or any consumer holding the
 * candidate identity the CURRENT pointer names — passes what it expects, and the
 * declaration must match it exactly. Callers with no release context (the
 * recovery flows, which verify an already-shipped pair with nothing but the two
 * files) omit it, and the declaration selects the regime as before.
 */
export type ExpectedChapterSetSource = "canonical-index" | ProductionChapterSetSource;

/** The semanticHash a candidate chapter-set block binds over its own specs —
 *  the SAME function the builder used, so the verifier can prove the recorded
 *  block is internally consistent rather than trusting its stored hash. */
export function chapterSetSpecsSemanticHash(specs: readonly ProductionManifestChapterSpec[]): string {
  return canonicalJsonSha256(specs);
}

/** The per-chapter evidence fields a candidate carries for itself. Exactly the
 *  three the canonical-index regime reads out of `.chapterflow/runs` and
 *  `state/chapters`; only WHERE they come from differs. */
export type CandidateChapterEvidence = {
  sourceEvidence: ProductionManifestChapter["sourceEvidence"];
  authoringEvidence: ProductionManifestChapter["authoringEvidence"];
  generationEvidence: ProductionManifestChapter["generationEvidence"];
};

export type CandidateChapterEvidenceResult =
  | { ok: true; evidence: CandidateChapterEvidence }
  | { ok: false; findings: ProductionManifestFinding[] };

export type CandidateChapterEvidenceResolver = (spec: ProductionManifestChapterSpec) => CandidateChapterEvidenceResult;

/**
 * RECOMPUTE the candidate regime's per-chapter evidence from the candidate's own
 * bytes — the same digest-verified file set the chapter artifacts came from.
 *
 * This is the re-pointing the live release needed. `PPKG.source_missing` and
 * `PPKG.authoring_provenance_missing` are the SAME gates with the same check ids
 * and the same fail-closed behaviour; they now look in the candidate instead of
 * in a `.chapterflow/runs` tree that a candidate-only book root does not have. A
 * chapter whose sidecar is genuinely absent from the candidate still fails.
 */
export function candidateChapterEvidenceResolver(evidence: CandidateEvidence): CandidateChapterEvidenceResolver {
  return (spec) => {
    const findings: ProductionManifestFinding[] = [];

    const sidecar = resolveCandidateSourceSidecar(evidence, spec.chapterNumber, spec.chapterId);
    let sourceEvidence: ProductionManifestChapter["sourceEvidence"] | null = null;
    let sourceSchema: string | null = null;
    if (!sidecar.ok) {
      findings.push(blocker({
        checkId: "PPKG.source_missing",
        chapterNumber: spec.chapterNumber,
        message:
          `Missing source sidecar for ${spec.chapterId} (chapter ${spec.chapterNumber}) in candidate ` +
          `${evidence.candidateId}: ${sidecar.message}`,
      }));
    } else {
      sourceSchema = typeof (sidecar.value as { schemaVersion?: unknown })?.schemaVersion === "string"
        ? (sidecar.value as { schemaVersion: string }).schemaVersion
        : null;
      // ANTI-DOWNGRADE (adversarial review): the packet's sourceSidecarPath is
      // writer-declared, so a pointer aimed at a decoy could resolve to a
      // non-source-v2 file and silently disarm the source-v2-only authoring
      // gate below while an honest source-v2 sidecar sat at the staged
      // location. If ANY candidate source location holds source-v2, the
      // chapter IS source-v2 for gating purposes — pointer games cannot
      // lower the bar, only genuinely-v1 chapters keep the v1 shape.
      if (sourceSchema !== "source-v2" && candidateChapterHasSourceV2(evidence, spec.chapterNumber)) {
        sourceSchema = "source-v2";
      }
      sourceEvidence = {
        path: candidateManifestPath(sidecar.logicalPath),
        semanticHash: sidecar.hash,
        schemaVersion: sourceSchema,
      };
    }

    // The candidate's UNSTRIPPED chapter artifact is this regime's
    // `state/chapters/<id>.v21-native.chapter.json`: it is where
    // `authoring.sourceAnchors` and `authoring.generation` live before
    // `stripInternalFields` removes them from the shipped package.
    const chapterPath = candidateChapterArtifactPath(spec.chapterId);
    const authored = readCandidateJson(evidence, chapterPath);
    let authoringEvidence: ProductionManifestChapter["authoringEvidence"] = null;
    let generationEvidence: ProductionManifestChapter["generationEvidence"] = null;
    if (authored.ok) {
      const value = authored.value as { authoring?: { sourceAnchors?: any; generation?: any } };
      const sourceAnchors = value?.authoring?.sourceAnchors;
      const generation = value?.authoring?.generation;
      const authoringSchema = typeof sourceAnchors?.schemaVersion === "string" ? sourceAnchors.schemaVersion : null;
      if (sourceAnchors) {
        authoringEvidence = {
          path: candidateManifestPath(chapterPath),
          semanticHash: canonicalJsonSha256(sourceAnchors),
          schemaVersion: authoringSchema,
          sourceHash: typeof sourceAnchors?.sourceHash === "string" ? sourceAnchors.sourceHash : null,
        };
      }
      if (generation && typeof generation === "object") {
        const degradations = Array.isArray(generation.degradations) ? generation.degradations : [];
        generationEvidence = {
          path: candidateManifestPath(chapterPath),
          semanticHash: canonicalJsonSha256(generation),
          schemaVersion: typeof generation.schemaVersion === "string" ? generation.schemaVersion : null,
          runId: typeof generation.runId === "string" ? generation.runId : null,
          degradationCount: degradations.length,
          seriousDegradationCount: degradations.filter((event: any) => event?.severity === "serious").length,
          advisoryDegradationCount: degradations.filter((event: any) => event?.severity === "advisory").length,
        };
      }
      if (sourceSchema === "source-v2" && (!sourceAnchors || authoringSchema !== "chapter-source-anchor-map-v1")) {
        findings.push(blocker({
          checkId: "PPKG.authoring_provenance_missing",
          chapterNumber: spec.chapterNumber,
          path: candidateManifestPath(chapterPath),
          message: `Source-v2 chapter ${spec.chapterId} is missing authoring.sourceAnchors provenance in the candidate chapter artifact.`,
        }));
      }
    } else if (sourceSchema === "source-v2") {
      findings.push(blocker({
        checkId: "PPKG.authoring_unreadable",
        chapterNumber: spec.chapterNumber,
        path: candidateManifestPath(chapterPath),
        message: `Missing candidate chapter authoring evidence: ${authored.message}`,
      }));
    }

    if (findings.length > 0 || sourceEvidence === null) {
      return { ok: false, findings: findings.length > 0 ? findings : [blocker({ checkId: "PPKG.source_missing", chapterNumber: spec.chapterNumber, message: `Missing source sidecar for ${spec.chapterId}.` })] };
    }
    return { ok: true, evidence: { sourceEvidence, authoringEvidence, generationEvidence } };
  };
}

/**
 * REPLAY the candidate evidence a manifest under test RECORDED, for a verifier
 * that holds the released pair but not the candidate.
 *
 * BE EXACT ABOUT WHAT THIS PROVES. Replaying recorded bytes proves the payload is
 * internally consistent — the recorded evidence is what the recorded contentId
 * and payloadHash are actually derived over — and it leaves every check that does
 * NOT depend on the candidate fully live: the recorded chapter set vs the package
 * (compareRecordedCandidateChapterSet), per-chapter reader-content hashes,
 * package identity, source-reality evidence recomputed from disk, and the three
 * build-input fingerprints recomputed from disk. It does NOT re-read the
 * candidate, so it cannot detect a manifest whose recorded source evidence never
 * matched the candidate it names.
 *
 * That residual is closed by the caller that CAN open the candidate: the release
 * adapter passes `candidateEvidence` and gets the recompute above, before the
 * pair is ever written. This replay exists so a consumer holding only the two
 * shipped files (publish-final's preflight, register-web, the recovery flows)
 * keeps verifying a candidate pair instead of failing on evidence it has no
 * access to — the same "callers with no release context" carve-out the
 * expectedChapterSetSource layer already documents.
 */
export function recordedCandidateChapterEvidenceResolver(
  payload: ProductionManifestPayload,
): CandidateChapterEvidenceResolver {
  const byChapterId = new Map<string, ProductionManifestChapter>();
  for (const chapter of payload.chapters ?? []) {
    if (chapter && typeof chapter.chapterId === "string") byChapterId.set(chapter.chapterId, chapter);
  }
  return (spec) => {
    const recorded = byChapterId.get(spec.chapterId);
    if (!recorded || !isObject(recorded.sourceEvidence as unknown)) {
      return {
        ok: false,
        findings: [blocker({
          checkId: "PPKG.candidate_evidence_unrecorded",
          chapterNumber: spec.chapterNumber,
          message:
            `The manifest records no candidate source evidence for ${spec.chapterId}, so a verifier without the ` +
            "candidate has nothing to replay for that chapter.",
        })],
      };
    }
    return {
      ok: true,
      evidence: {
        sourceEvidence: recorded.sourceEvidence,
        authoringEvidence: recorded.authoringEvidence ?? null,
        generationEvidence: recorded.generationEvidence ?? null,
      },
    };
  };
}

type ChapterSetPayloadBlock =
  | { canonicalIndex: ProductionManifestCanonicalIndexBlock }
  | {
    candidateChapterSet: ProductionManifestCandidateChapterSetBlock;
    candidateQcEvidence: ProductionManifestCandidateQcEvidence;
  };

type CommonPayloadFields = {
  bookId: string;
  packageSchemaVersion: typeof V21_SCHEMA_VERSION;
  book: {
    title: string;
    author: string;
    categories?: string[];
    tags?: string[];
    contentOwner: string;
  };
  chapters: ProductionManifestChapter[];
} & ChapterSetPayloadBlock;

export type ProductionManifestPayloadV1 = CommonPayloadFields & {
  schemaVersion: typeof PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION_V1;
  evidencePolicy: {
    sourceEvidence: "required";
    authoringEvidence: "required-for-source-v2";
    /** "required" on the canonical-index regime; on the candidate regime the
     *  per-chapter attestation never existed and the payload says which QC
     *  authority it stands on instead — a policy the payload itself does not
     *  meet must never be hashed into contentId (adversarial review caught the
     *  self-contradiction). */
    qcAttestation: "required" | "subsumed-by-v25-qc-round";
  };
  versions: ProductionManifestVersionsV1;
};

export type ProductionManifestPayloadV2 = CommonPayloadFields & {
  schemaVersion: typeof PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION_V2;
  sourceRealityEvidence: ProductionSourceRealityEvidence;
  evidencePolicy: {
    sourceEvidence: "required";
    authoringEvidence: "required-for-source-v2";
    sourceReality: "required-for-source-v2";
    qcAttestation: "required" | "subsumed-by-v25-qc-round";
  };
  versions: ProductionManifestVersionsV2;
};

export type ProductionManifestPayload = ProductionManifestPayloadV1 | ProductionManifestPayloadV2;

export type ProductionPackageManifest = {
  schemaVersion:
    | typeof PRODUCTION_MANIFEST_SCHEMA_VERSION_V1
    | typeof PRODUCTION_MANIFEST_SCHEMA_VERSION_V2;
  contentId: string;
  payloadHash: string;
  payload: ProductionManifestPayload;
  metadata: {
    createdAt: string;
    generator: string;
    runId: string;
    packagePath?: string;
  };
};

export type ProductionManifestRoots = {
  stateRoot?: string;
  runsRoot?: string;
};

export type BuildProductionManifestInput = ProductionManifestRoots & {
  bookId: string;
  title: string;
  author: string;
  contentOwner: string;
  categories?: string[];
  tags?: string[];
  chapters: ChapterV21[];
  /** Present ONLY on the v25 candidate-release route. When set, `chapters` (the
   *  candidate's own CHAPTER artifacts, already assembled into this package) ARE
   *  the chapter set and the ambient canonical index is not read at all. Absent
   *  on the legacy route, whose canonical-index behaviour is unchanged. */
  chapterSetSource?: ProductionChapterSetSource;
  /** Candidate regime ONLY, and REQUIRED there. Where the per-chapter source and
   *  authoring evidence comes from when the book root is candidate-only. See
   *  `candidateChapterEvidenceResolver` (recompute from the candidate bytes) and
   *  `recordedCandidateChapterEvidenceResolver` (replay what a manifest under
   *  test recorded). Ignored on the canonical-index regime. */
  candidateChapterEvidence?: CandidateChapterEvidenceResolver;
  /** Candidate regime ONLY, and REQUIRED there. The v25 round-level QC identity
   *  the release verified against this candidate. */
  candidateQcEvidence?: { reviewId: string; qcRoundId: string; verdict?: CandidateReleaseVerdict };
  createdAt: string;
  generator?: string;
  runId?: string;
  packagePath?: string;
  /** Default "v2". v1 is built only to recompute the expected manifest for an
   *  already-promoted v1 package (read-compatibility). */
  manifestVersion?: ProductionManifestVersion;
  /** Human-readable labels (used by v1 `versions` and v2 `versions.labels`). */
  promptSetId?: string;
  configId?: string;
  codeId?: string;
  /** v2 build-input fingerprint root overrides (tests). */
  fingerprintRoots?: FingerprintRoots;
  /** v2 source-reality record/exemption read-location overrides (tests). */
  recordPath?: string;
  exemptionsFile?: string;
  env?: NodeJS.ProcessEnv;
  now?: Date;
};

export type BuildProductionManifestResult =
  | { ok: true; manifest: ProductionPackageManifest; payload: ProductionManifestPayload; findings: [] }
  | { ok: false; findings: ProductionManifestFinding[] };

type JsonWithHash =
  | { ok: true; value: any; hash: string }
  | { ok: false; finding: ProductionManifestFinding };

function blocker(args: Omit<ProductionManifestFinding, "severity">): ProductionManifestFinding {
  return { severity: "blocker", ...args };
}

function readJsonWithSemanticHash(path: string, checkId: string, label: string, chapterNumber?: number): JsonWithHash {
  if (!existsSync(path)) {
    return { ok: false, finding: blocker({ checkId, chapterNumber, path, message: `Missing ${label} at ${path}.` }) };
  }
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return { ok: true, value, hash: canonicalJsonSha256(value) };
  } catch (err) {
    return {
      ok: false,
      finding: blocker({ checkId, chapterNumber, path, message: `Unreadable ${label} at ${path}: ${(err as Error).message}` }),
    };
  }
}

function normalizeManifestPath(path: string): string {
  return path.split(sep).join("/");
}

function logicalStatePath(stateRoot: string, path: string): string {
  const rel = normalizeManifestPath(relative(stateRoot, path));
  return rel.startsWith("..") ? normalizeManifestPath(path) : `state/${rel}`;
}

function logicalRunPath(runsRoot: string, path: string): string {
  const rel = normalizeManifestPath(relative(runsRoot, path));
  return rel.startsWith("..") ? normalizeManifestPath(path) : `.chapterflow/runs/${rel}`;
}

/** The CANONICAL logical location of the source-verify record (req 3 "logical
 *  path"). Derived from the bookId, NOT from a recordPath override, so the
 *  contentId is identical whether built at the default path or a test override. */
function logicalSourceVerifyRecordPath(bookId: string): string {
  return `.chapterflow/source-verify-${bookId}.md`;
}
const LOGICAL_EXEMPTIONS_PATH = "config/source-reality-legacy-exemptions.json";

function qcAttestationPathFor(stateRoot: string, bookId: string, chapterNumber: number): string {
  return resolve(stateRoot, "qc", `${bookId}-ch${String(chapterNumber).padStart(2, "0")}.qc.json`);
}

function stateChapterPathFor(stateRoot: string, chapterId: string): string {
  return resolve(stateRoot, "chapters", `${chapterId}.v21-native.chapter.json`);
}

function sourceSidecarPathFor(runsRoot: string, bookId: string, chapterNumber: number): string | null {
  return findRunArtifact(runsRoot, bookId, `sidecars/source/ch${String(chapterNumber).padStart(2, "0")}.source.json`);
}

function requireString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

const CANDIDATE_MANIFEST_DIGEST_PATTERN = /^[a-f0-9]{64}$/;

type ResolvedChapterSet =
  | {
    ok: true;
    regime: "canonical-index" | "candidate";
    specs: ProductionManifestChapterSpec[];
    block: ChapterSetPayloadBlock;
    deferredFindings: ProductionManifestFinding[];
  }
  | { ok: false; findings: ProductionManifestFinding[] };

/**
 * The chapter set for one manifest build, plus the payload block that records
 * where it came from.
 *
 * LEGACY (no `chapterSetSource`): unchanged. The canonical index is the set, the
 * package chapters are compared to it, and the index FILE's semantic hash is
 * bound into the payload. An unreadable/missing index still returns immediately
 * (nothing downstream is meaningful without a set); a set mismatch or an
 * unreadable index file are still DEFERRED so they report alongside per-chapter
 * findings, in the same order as before.
 *
 * CANDIDATE (`chapterSetSource` set): the candidate's CHAPTER artifacts are the
 * set. `readCandidateChapterSet` applies the same normalization the index gets,
 * so id shape / book ownership / duplicate ids / duplicate numbers still fail
 * closed. Nothing under state/indexes is opened, and the candidate identity is
 * hashed into the payload so the contentId is bound to the digest the release
 * verified.
 */
function resolveChapterSet(
  input: BuildProductionManifestInput,
  stateRoot: string,
  bookId: string,
): ResolvedChapterSet {
  const source = input.chapterSetSource;
  if (source !== undefined) {
    if (
      source === null || typeof source !== "object" || source.kind !== "candidate" ||
      typeof source.candidateId !== "string" || source.candidateId.length === 0 ||
      typeof source.manifestDigest !== "string" || !CANDIDATE_MANIFEST_DIGEST_PATTERN.test(source.manifestDigest)
    ) {
      return {
        ok: false,
        findings: [blocker({
          checkId: "PPKG.chapter_set_source_invalid",
          message: "Candidate chapter-set source must be { kind: \"candidate\", candidateId, manifestDigest } with a 64-hex digest.",
          actual: source,
        })],
      };
    }
    const candidate = readCandidateChapterSet(bookId, input.chapters);
    if (!candidate.ok) {
      return {
        ok: false,
        findings: candidate.blockers.map((f) => blocker({
          checkId: f.checkId,
          message: f.message,
          expected: f.expected,
          actual: f.actual,
        })),
      };
    }
    const qc = input.candidateQcEvidence;
    if (
      qc === undefined || qc === null || typeof qc !== "object" ||
      typeof qc.reviewId !== "string" || qc.reviewId.length === 0 ||
      typeof qc.qcRoundId !== "string" || qc.qcRoundId.length === 0
    ) {
      // The candidate regime has no per-chapter state/qc attestation to fall back
      // on, so a build with no round identity would produce a manifest that
      // evidences no QC authority at all. Refuse to build one.
      return {
        ok: false,
        findings: [blocker({
          checkId: "PPKG.candidate_qc_evidence_missing",
          message:
            "A candidate-regime manifest must record the v25 QC round it relied on " +
            "({ reviewId, qcRoundId }); the per-chapter state/qc attestation is the v21 shape and does not exist here.",
          actual: qc,
        })],
      };
    }
    // R-254: a verdict block that does not validate must never reach a sidecar.
    // The read-side validator would refuse it later, which means a build that
    // let it through would ship a pair the verifier immediately rejects; refuse
    // it HERE, where the caller can still be told what it handed over.
    if (qc.verdict !== undefined && !validCandidateReleaseVerdict(qc.verdict)) {
      return {
        ok: false,
        findings: [blocker({
          checkId: "PPKG.candidate_qc_verdict_invalid",
          message:
            "productionManifest.payload.candidateQcEvidence.verdict is present but not a valid verdict block " +
            "(qcOutcome/reviewOutcome, issue counts by severity, per-chapter panel composites, and an optional rubric block).",
          actual: qc.verdict,
        })],
      };
    }
    const specs = candidate.chapters.map((spec) => ({
      chapterId: spec.chapterId,
      chapterNumber: spec.chapterNumber,
      chapterTitle: spec.chapterTitle,
    }));
    return {
      ok: true,
      regime: "candidate",
      specs,
      block: {
        candidateChapterSet: {
          source: "candidate",
          candidateId: source.candidateId,
          manifestDigest: source.manifestDigest,
          semanticHash: chapterSetSpecsSemanticHash(specs),
          chapters: specs,
        },
        candidateQcEvidence: {
          source: "v25-qc-round",
          reviewId: qc.reviewId,
          qcRoundId: qc.qcRoundId,
          perChapterAttestation: "subsumed-by-round",
          // Copied VERBATIM when the caller supplies it, and omitted entirely
          // when it does not: the builder never synthesizes a verdict, so a
          // manifest either carries the one its release actually held or says
          // nothing (R-254).
          ...(qc.verdict === undefined ? {} : { verdict: qc.verdict }),
        },
      },
      deferredFindings: [],
    };
  }

  const canonical = readCanonicalChapterIndex(bookId, stateRoot);
  if (!canonical.ok) {
    return {
      ok: false,
      findings: canonical.blockers.map((f) => blocker({
        checkId: f.checkId,
        message: f.message,
        expected: f.expected,
        actual: f.actual,
      })),
    };
  }

  const deferredFindings: ProductionManifestFinding[] = [];
  const set = compareChapterSetToCanonical({
    bookId,
    canonical: canonical.chapters,
    actual: input.chapters,
    actualLabel: "production package chapters",
  });
  if (!set.ok) {
    deferredFindings.push(...set.blockers.map((f) => blocker({
      checkId: f.checkId,
      message: f.message,
      expected: f.expected,
      actual: f.actual,
    })));
  }

  const indexPath = canonicalChapterIndexPath(bookId, stateRoot);
  const index = readJsonWithSemanticHash(indexPath, "PPKG.index_unreadable", "canonical chapter index");
  if (!index.ok) {
    deferredFindings.push(index.finding);
    // The set itself is usable (it came from readCanonicalChapterIndex above);
    // only the file hash is not. The build fails on the deferred finding, so the
    // placeholder hash below can never reach a returned payload.
  }
  const specs = canonical.chapters.map((spec) => ({
    chapterId: spec.chapterId,
    chapterNumber: spec.chapterNumber,
    chapterTitle: spec.chapterTitle,
  }));
  return {
    ok: true,
    regime: "canonical-index",
    specs,
    block: {
      canonicalIndex: {
        path: logicalStatePath(stateRoot, indexPath),
        semanticHash: index.ok ? index.hash : "",
        chapters: specs,
      },
    },
    deferredFindings,
  };
}

// ── Shared chapter/index evidence gathering (identical for v1 and v2) ──────────
function gatherCommonPayload(
  input: BuildProductionManifestInput,
  stateRoot: string,
  runsRoot: string,
  bookId: string,
): { ok: true; common: CommonPayloadFields } | { ok: false; findings: ProductionManifestFinding[] } {
  const findings: ProductionManifestFinding[] = [];

  // ── The chapter set, and where it came from ─────────────────────────────────
  // Two routes, one shape downstream. The candidate route derives the set from
  // the candidate's own CHAPTER artifacts (== this package's chapters) and never
  // touches state/indexes; the legacy route is byte-for-byte what it always was.
  const chapterSet = resolveChapterSet(input, stateRoot, bookId);
  if (!chapterSet.ok) return { ok: false, findings: chapterSet.findings };
  const { specs, block } = chapterSet;
  findings.push(...chapterSet.deferredFindings);

  // ── WHERE THE PER-CHAPTER EVIDENCE COMES FROM ───────────────────────────────
  // The canonical-index regime reads ambient `.chapterflow/runs` sidecars,
  // `state/chapters` authoring artifacts and `state/qc` attestations — unchanged,
  // byte for byte. The candidate regime reads the candidate, because a
  // candidate-only book root HAS none of those three and never will: that is what
  // "candidate-only" means. Same gates, re-pointed at the artifacts the candidate
  // actually carries.
  const candidateRegime = chapterSet.regime === "candidate";
  const resolveCandidateEvidence = input.candidateChapterEvidence;
  if (candidateRegime && resolveCandidateEvidence === undefined) {
    return {
      ok: false,
      findings: [blocker({
        checkId: "PPKG.candidate_evidence_unavailable",
        message:
          "A candidate-regime manifest build needs a candidate evidence resolver (candidateChapterEvidence); " +
          "ambient state/runs evidence is not this regime's authority and a candidate-only book root has none.",
      })],
    };
  }

  const chapterPayloads: ProductionManifestChapter[] = [];
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const chapter = input.chapters[i];
    if (!chapter) continue;

    if (candidateRegime) {
      const resolved = resolveCandidateEvidence!(spec);
      if (!resolved.ok) {
        findings.push(...resolved.findings);
        continue;
      }
      chapterPayloads.push({
        chapterId: spec.chapterId,
        chapterNumber: spec.chapterNumber,
        title: spec.chapterTitle || chapter.title || "",
        readerContentHash: readerContentHash(chapter),
        sourceEvidence: resolved.evidence.sourceEvidence,
        authoringEvidence: resolved.evidence.authoringEvidence,
        generationEvidence: resolved.evidence.generationEvidence,
        // No per-chapter v21 attestation exists on this regime; the round-level
        // authority is recorded in payload.candidateQcEvidence.
        qcAttestation: null,
      });
      continue;
    }

    const sourcePath = sourceSidecarPathFor(runsRoot, bookId, spec.chapterNumber);
    let sourceHash = "";
    let sourceSchema: string | null = null;
    if (!sourcePath) {
      findings.push(blocker({
        checkId: "PPKG.source_missing",
        chapterNumber: spec.chapterNumber,
        message: `Missing source sidecar for ${spec.chapterId} (chapter ${spec.chapterNumber}).`,
      }));
    } else {
      const source = readJsonWithSemanticHash(sourcePath, "PPKG.source_unreadable", "source sidecar", spec.chapterNumber);
      if (source.ok) {
        sourceHash = source.hash;
        sourceSchema = typeof source.value?.schemaVersion === "string" ? source.value.schemaVersion : null;
      } else {
        findings.push(source.finding);
      }
    }

    const authoringPath = stateChapterPathFor(stateRoot, spec.chapterId);
    let authoringEvidence: ProductionManifestChapter["authoringEvidence"] = null;
    let generationEvidence: ProductionManifestChapter["generationEvidence"] = null;
    const authored = readJsonWithSemanticHash(authoringPath, "PPKG.authoring_unreadable", "state chapter authoring evidence", spec.chapterNumber);
    if (authored.ok) {
      const sourceAnchors = authored.value?.authoring?.sourceAnchors;
      const generation = authored.value?.authoring?.generation;
      const authoringSchema = typeof sourceAnchors?.schemaVersion === "string" ? sourceAnchors.schemaVersion : null;
      const authoringHash = sourceAnchors ? canonicalJsonSha256(sourceAnchors) : "";
      const authoringSourceHash = typeof sourceAnchors?.sourceHash === "string" ? sourceAnchors.sourceHash : null;
      if (sourceAnchors) {
        authoringEvidence = {
          path: logicalStatePath(stateRoot, authoringPath),
          semanticHash: authoringHash,
          schemaVersion: authoringSchema,
          sourceHash: authoringSourceHash,
        };
      }
      if (generation && typeof generation === "object") {
        const degradations = Array.isArray(generation.degradations) ? generation.degradations : [];
        generationEvidence = {
          path: logicalStatePath(stateRoot, authoringPath),
          semanticHash: canonicalJsonSha256(generation),
          schemaVersion: typeof generation.schemaVersion === "string" ? generation.schemaVersion : null,
          runId: typeof generation.runId === "string" ? generation.runId : null,
          degradationCount: degradations.length,
          seriousDegradationCount: degradations.filter((event: any) => event?.severity === "serious").length,
          advisoryDegradationCount: degradations.filter((event: any) => event?.severity === "advisory").length,
        };
      }
      if (sourceSchema === "source-v2" && (!sourceAnchors || authoringSchema !== "chapter-source-anchor-map-v1")) {
        findings.push(blocker({
          checkId: "PPKG.authoring_provenance_missing",
          chapterNumber: spec.chapterNumber,
          path: authoringPath,
          message: `Source-v2 chapter ${spec.chapterId} is missing authoring.sourceAnchors provenance in the state chapter artifact.`,
        }));
      }
    } else if (sourceSchema === "source-v2") {
      findings.push(authored.finding);
    }

    const qcPath = qcAttestationPathFor(stateRoot, bookId, spec.chapterNumber);
    let qcHash = "";
    let qcRoundId = "";
    let qcContentHash = "";
    let qcHashVersion = "";
    let qcReviewer = "";
    let qcReviewedAt = "";
    const qc = readJsonWithSemanticHash(qcPath, "PPKG.qc_missing", "QC attestation", spec.chapterNumber);
    if (qc.ok) {
      const att = qc.value as QcAttestation;
      qcHash = qc.hash;
      qcRoundId = requireString(att.roundId);
      qcContentHash = requireString(att.contentHash);
      qcHashVersion = requireString(att.hashVersion, "v1");
      qcReviewer = requireString(att.reviewer);
      qcReviewedAt = requireString(att.reviewedAt);
      if (att.schemaVersion !== "qc-attest-v1") {
        findings.push(blocker({
          checkId: "PPKG.qc_schema_mismatch",
          chapterNumber: spec.chapterNumber,
          path: qcPath,
          message: `QC attestation for ${spec.chapterId} has schemaVersion ${JSON.stringify((att as any).schemaVersion)}, expected "qc-attest-v1".`,
          expected: "qc-attest-v1",
          actual: (att as any).schemaVersion,
        }));
      }
      if (att.verdict !== "PUBLISHABLE") {
        findings.push(blocker({
          checkId: "PPKG.qc_not_publishable",
          chapterNumber: spec.chapterNumber,
          path: qcPath,
          message: `QC attestation for ${spec.chapterId} is ${JSON.stringify(att.verdict)}, expected PUBLISHABLE.`,
          expected: "PUBLISHABLE",
          actual: att.verdict,
        }));
      }
      if (!qcRoundId) {
        findings.push(blocker({
          checkId: "PPKG.qc_round_missing",
          chapterNumber: spec.chapterNumber,
          path: qcPath,
          message: `QC attestation for ${spec.chapterId} is missing roundId; production manifests require round-backed QC evidence.`,
        }));
      }
      // Freshness is checked against the LOOSE state chapter (authored.value)
      // when it is readable, NOT against the packaged `chapter`. The reader-content
      // strip (reader-content-strip-v3) removes fields that ARE inside the QC
      // attestation hash's scope (implementationPlan.title, per-chapter
      // schemaVersion, memorableLines[].location/why, depthLevel, …) but are NOT
      // in the frozen V2_EXCLUDE set — hashing the stripped chapter would falsely
      // stale every attestation. The loose state chapter carries exactly the bytes
      // the reviewer attested. (If the state chapter is unreadable that is already
      // an authoring-evidence failure; fall back to the packaged chapter so we
      // never skip the freshness gate.)
      const freshnessChapter = (authored.ok ? (authored.value as ChapterV21) : chapter);
      if (!isAttestationFresh(att, freshnessChapter)) {
        findings.push(blocker({
          checkId: "PPKG.qc_stale",
          chapterNumber: spec.chapterNumber,
          path: qcPath,
          message: `QC attestation for ${spec.chapterId} is stale against the packaged reader content.`,
        }));
      }
      if (!isApprovedReviewer(qcReviewer)) {
        findings.push(blocker({
          checkId: "PPKG.qc_reviewer_unapproved",
          chapterNumber: spec.chapterNumber,
          path: qcPath,
          message: `QC attestation reviewer "${qcReviewer}" is not an approved QC reviewer role.`,
          actual: qcReviewer,
        }));
      }
    } else {
      findings.push(qc.finding);
    }

    chapterPayloads.push({
      chapterId: spec.chapterId,
      chapterNumber: spec.chapterNumber,
      title: spec.chapterTitle || chapter.title || "",
      readerContentHash: readerContentHash(chapter),
      sourceEvidence: {
        path: sourcePath ? logicalRunPath(runsRoot, sourcePath) : `.chapterflow/runs/${bookId}/<missing>/sidecars/source/ch${String(spec.chapterNumber).padStart(2, "0")}.source.json`,
        semanticHash: sourceHash,
        schemaVersion: sourceSchema,
      },
      authoringEvidence,
      generationEvidence,
      qcAttestation: {
        path: logicalStatePath(stateRoot, qcPath),
        semanticHash: qcHash,
        roundId: qcRoundId,
        contentHash: qcContentHash,
        hashVersion: qcHashVersion,
        reviewer: qcReviewer,
        reviewedAt: qcReviewedAt,
      },
    });
  }

  if (findings.length > 0) return { ok: false, findings };

  const common: CommonPayloadFields = {
    bookId,
    packageSchemaVersion: V21_SCHEMA_VERSION,
    book: {
      title: input.title,
      author: input.author,
      categories: input.categories,
      tags: input.tags,
      contentOwner: input.contentOwner,
    },
    ...block,
    chapters: chapterPayloads,
  };
  return { ok: true, common };
}

// ── v2 source-reality evidence ────────────────────────────────────────────────
function buildSourceRealityEvidence(
  input: BuildProductionManifestInput,
  stateRoot: string,
  runsRoot: string,
  bookId: string,
): { ok: true; evidence: ProductionSourceRealityEvidence } | { ok: false; findings: ProductionManifestFinding[] } {
  const policy = evaluateSourceRealityPolicy({
    bookId,
    env: input.env ?? process.env,
    now: input.now ?? new Date(),
    roots: { stateRoot, runsRoot, recordPath: input.recordPath, exemptionsFile: input.exemptionsFile },
  });

  // A blocking policy means the source was never (validly) reality-checked. A v2
  // manifest cannot be reconstructed for such a book: surface the policy blockers
  // (prefixed) so promotion fails closed and a later verify cannot reconstruct an
  // expected manifest if the record was deleted/tampered/expired (req 4, 12).
  if (policy.blocking) {
    return {
      ok: false,
      findings: policy.findings.map((f) => blocker({
        checkId: `PPKG.${f.checkId}`,
        chapterNumber: f.chapterNumber,
        message: f.message,
      })),
    };
  }

  const evidence: ProductionSourceRealityEvidence = {
    bookId,
    policyResult: policy.decision as ProductionSourceRealityEvidence["policyResult"],
    classification: policy.classification,
    record: null,
    exemption: null,
  };

  if (policy.decision === "required-and-verified") {
    const recordPath = input.recordPath ?? sourceVerifyRecordPath(bookId);
    let parsed: any = null;
    try {
      parsed = parseSourceVerifyRecord(readFileSync(recordPath, "utf8")).record;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      return {
        ok: false,
        findings: [blocker({
          checkId: "PPKG.source_reality_record_unreadable",
          message: `Source-reality verdict is required-and-verified but the record at ${recordPath} could not be re-read for binding.`,
        })],
      };
    }
    evidence.record = {
      path: logicalSourceVerifyRecordPath(bookId),
      schemaVersion: optionalString(parsed.schemaVersion),
      semanticHash: canonicalJsonSha256(parsed),
      bookId: optionalString(parsed.bookId),
      verifier: optionalString(parsed.verifiedBy ?? parsed.verifier ?? parsed.verifierSession ?? parsed.session),
      verifiedAt: optionalString(parsed.verifiedAt ?? parsed.reviewedAt),
    };
  } else if (policy.decision === "legacy-exempt" && policy.exemption) {
    const ex = policy.exemption;
    evidence.exemption = {
      path: LOGICAL_EXEMPTIONS_PATH,
      schemaVersion: ex.schemaVersion,
      semanticHash: canonicalJsonSha256(ex),
      approvedBy: ex.approvedBy,
      approvedAt: ex.approvedAt,
      expiresAt: optionalString(ex.expiresAt),
      boundIdentity: {
        canonicalIndexHash: optionalString(ex.canonicalIndexHash),
        packageId: optionalString(ex.packageId),
        contentId: optionalString(ex.contentId),
      },
    };
  }
  // policy.decision === "not-applicable" → record and exemption stay null.

  return { ok: true, evidence };
}

function buildPayload(
  input: BuildProductionManifestInput,
): { ok: true; payload: ProductionManifestPayload } | { ok: false; findings: ProductionManifestFinding[] } {
  const stateRoot = input.stateRoot ?? CANONICAL_STATE;
  const runsRoot = input.runsRoot ?? DEFAULT_RUNS_ROOT;
  const bookId = normSlug(input.bookId);
  const version: ProductionManifestVersion = input.manifestVersion ?? "v2";

  const gathered = gatherCommonPayload(input, stateRoot, runsRoot, bookId);
  if (!gathered.ok) return gathered;
  const common = gathered.common;

  const promptLabel = input.promptSetId ?? PRODUCTION_PROMPT_SET_LABEL;
  const configLabel = input.configId ?? PRODUCTION_CONFIG_LABEL;
  const codeLabel = input.codeId ?? PRODUCTION_CODE_LABEL;

  if (version === "v1") {
    const payload: ProductionManifestPayloadV1 = {
      schemaVersion: PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION_V1,
      ...common,
      evidencePolicy: {
        sourceEvidence: "required",
        authoringEvidence: "required-for-source-v2",
        qcAttestation: input.candidateQcEvidence === undefined ? "required" : "subsumed-by-v25-qc-round",
      },
      versions: {
        canonicalJson: PRODUCTION_CANONICAL_JSON_VERSION,
        readerContentHash: READER_CONTENT_HASH_VERSION,
        readerContentStripRules: READER_CONTENT_STRIP_RULES_VERSION,
        promptSet: promptLabel,
        config: configLabel,
        code: codeLabel,
      },
    };
    return { ok: true, payload };
  }

  // v2 — bind source-reality evidence + deterministic build-input fingerprints.
  const evidence = buildSourceRealityEvidence(input, stateRoot, runsRoot, bookId);
  if (!evidence.ok) return evidence;

  const fingerprints = buildPipelineFingerprints(input.fingerprintRoots);
  if (!fingerprints.ok) {
    return {
      ok: false,
      findings: fingerprints.errors.map((message) => blocker({ checkId: "PPKG.fingerprint_unbuildable", message })),
    };
  }

  const payload: ProductionManifestPayloadV2 = {
    schemaVersion: PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION_V2,
    ...common,
    sourceRealityEvidence: evidence.evidence,
    evidencePolicy: {
      sourceEvidence: "required",
      authoringEvidence: "required-for-source-v2",
      sourceReality: "required-for-source-v2",
      qcAttestation: input.candidateQcEvidence === undefined ? "required" : "subsumed-by-v25-qc-round",
    },
    versions: {
      canonicalJson: PRODUCTION_CANONICAL_JSON_VERSION,
      readerContentHash: READER_CONTENT_HASH_VERSION,
      readerContentStripRules: READER_CONTENT_STRIP_RULES_VERSION,
      promptBundle: fingerprints.fingerprints.promptBundle,
      configBundle: fingerprints.fingerprints.configBundle,
      codeFingerprint: fingerprints.fingerprints.codeFingerprint,
      labels: { promptSet: promptLabel, config: configLabel, code: codeLabel },
    },
  };
  return { ok: true, payload };
}

export function buildProductionManifest(input: BuildProductionManifestInput): BuildProductionManifestResult {
  const payloadResult = buildPayload(input);
  if (!payloadResult.ok) return payloadResult;
  const payloadHash = canonicalJsonSha256(payloadResult.payload);
  const schemaVersion = (input.manifestVersion ?? "v2") === "v1"
    ? PRODUCTION_MANIFEST_SCHEMA_VERSION_V1
    : PRODUCTION_MANIFEST_SCHEMA_VERSION_V2;
  const manifest: ProductionPackageManifest = {
    schemaVersion,
    contentId: payloadHash,
    payloadHash,
    payload: payloadResult.payload,
    metadata: {
      createdAt: input.createdAt,
      generator: input.generator ?? "promoteBook",
      runId: input.runId ?? process.env.CHAPTERFLOW_RUN_ID ?? process.env.CHAPTERFLOW_SESSION_ID ?? "manual-promote",
      packagePath: input.packagePath ? normalizeManifestPath(input.packagePath).split("/").slice(-2).join("/") : undefined,
    },
  };
  return { ok: true, manifest, payload: payloadResult.payload, findings: [] };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function validateChapterSetBlock(payload: Record<string, unknown>): ProductionManifestFinding[] {
  const hasCanonicalIndex = payload.canonicalIndex !== undefined;
  const hasCandidateSet = payload.candidateChapterSet !== undefined;
  if (hasCanonicalIndex === hasCandidateSet) {
    return [blocker({
      checkId: "PPKG.manifest_chapter_set_ambiguous",
      message: hasCanonicalIndex
        ? "productionManifest.payload declares BOTH canonicalIndex and candidateChapterSet; exactly one chapter-set authority is allowed."
        : "productionManifest.payload declares neither canonicalIndex nor candidateChapterSet; a manifest must name where its chapter set came from.",
    })];
  }
  if (hasCanonicalIndex) {
    if (!isObject(payload.canonicalIndex)) {
      return [blocker({ checkId: "PPKG.manifest_canonical_index_invalid", message: "productionManifest.payload.canonicalIndex must be an object." })];
    }
    // The canonical-index regime keeps its per-chapter state/qc attestations. A
    // round-level candidate QC block here would be a legacy manifest claiming an
    // authority its own regime never checked.
    return payload.candidateQcEvidence === undefined
      ? []
      : [blocker({
        checkId: "PPKG.manifest_candidate_qc_evidence_invalid",
        message: "A canonical-index manifest must not carry candidateQcEvidence; its QC authority is the per-chapter state/qc attestation.",
      })];
  }
  const block = payload.candidateChapterSet;
  if (!isObject(block)) {
    return [blocker({ checkId: "PPKG.manifest_candidate_chapter_set_invalid", message: "productionManifest.payload.candidateChapterSet must be an object." })];
  }
  if (
    block.source !== "candidate" ||
    !isString(block.candidateId) ||
    !isString(block.manifestDigest) || !CANDIDATE_MANIFEST_DIGEST_PATTERN.test(block.manifestDigest) ||
    !isString(block.semanticHash) ||
    !Array.isArray(block.chapters) || block.chapters.length === 0
  ) {
    return [blocker({
      checkId: "PPKG.manifest_candidate_chapter_set_invalid",
      message: "productionManifest.payload.candidateChapterSet must declare source \"candidate\", a candidateId, a 64-hex manifestDigest, a semanticHash, and a non-empty chapters array.",
    })];
  }
  // A candidate manifest MUST name the QC authority it stood on. Without this the
  // regime would be a way to ship with no recorded QC evidence at all, which is
  // the one thing dropping the per-chapter attestation must not become.
  const qc = payload.candidateQcEvidence;
  if (
    !isObject(qc) ||
    qc.source !== "v25-qc-round" ||
    !isString(qc.reviewId) ||
    !isString(qc.qcRoundId) ||
    qc.perChapterAttestation !== "subsumed-by-round" ||
    // R-254: the verdict block is OPTIONAL but never free-form. A present block
    // that does not validate is refused rather than shipped as unreadable
    // evidence — the whole point of putting it in the payload is that a reader
    // can trust its shape.
    (qc.verdict !== undefined && !validCandidateReleaseVerdict(qc.verdict))
  ) {
    return [blocker({
      checkId: "PPKG.manifest_candidate_qc_evidence_invalid",
      message:
        "productionManifest.payload.candidateQcEvidence must declare source \"v25-qc-round\", a reviewId, a qcRoundId, " +
        "and perChapterAttestation \"subsumed-by-round\" — a candidate manifest has no per-chapter state/qc attestation and must name the round it relied on instead.",
    })];
  }
  return [];
}

/** The chapter-set source a manifest DECLARES, for the verifier's recompute.
 *  Returns undefined for the legacy (canonical-index) route, whose recompute is
 *  unchanged. Only reached after validateProductionManifest has accepted the
 *  block's shape.
 *
 *  A DECLARATION IS NOT EVIDENCE. It selects which regime the verifier
 *  reconstructs under; what the package is checked AGAINST on the candidate
 *  regime is `recordedCandidateChapterSet` below — the set the manifest itself
 *  recorded and bound into its contentId — never the package's own chapters. */
export function declaredChapterSetSource(payload: ProductionManifestPayload): ProductionChapterSetSource | undefined {
  const block = (payload as unknown as Record<string, unknown>).candidateChapterSet;
  if (!isObject(block) || block.source !== "candidate") return undefined;
  if (!isString(block.candidateId) || !isString(block.manifestDigest)) return undefined;
  return { kind: "candidate", candidateId: block.candidateId, manifestDigest: block.manifestDigest };
}

/** The v25 QC round a candidate payload DECLARES it relied on. Undefined on the
 *  legacy regime. Like `declaredChapterSetSource`, this is a DECLARATION, not
 *  evidence: it is what the verifier's rebuild is parameterised by, and a caller
 *  that independently knows which round the release verified passes
 *  `expectedCandidateQcEvidence` so the declaration cannot disagree with it. */
export function declaredCandidateQcEvidence(
  payload: ProductionManifestPayload,
): { reviewId: string; qcRoundId: string; verdict?: CandidateReleaseVerdict } | undefined {
  const block = (payload as unknown as Record<string, unknown>).candidateQcEvidence;
  if (!isObject(block) || block.source !== "v25-qc-round") return undefined;
  if (!isString(block.reviewId) || !isString(block.qcRoundId)) return undefined;
  // The verdict rides back into the expected-manifest recompute the same way
  // the ids do: REPLAYED from the manifest's own declaration, never recomputed
  // from artifacts the verifier does not have. Tampering with it therefore
  // changes the contentId and fails the pair, which is exactly the protection
  // hashing it into the payload buys.
  const verdict = validCandidateReleaseVerdict(block.verdict) ? block.verdict as CandidateReleaseVerdict : undefined;
  return {
    reviewId: block.reviewId,
    qcRoundId: block.qcRoundId,
    ...(verdict === undefined ? {} : { verdict }),
  };
}

function validIssueCounts(value: unknown): boolean {
  if (!isObject(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== 3 || keys[0] !== "BLOCKER" || keys[1] !== "INFO" || keys[2] !== "WARN") return false;
  return keys.every((key) => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0);
}

const RELEASE_OUTCOMES = new Set(["PASS", "FAIL", "ERROR"]);

/** Shape gate for the optional R-254 verdict block. Strict on every field it
 *  declares; the block is either absent or complete. */
export function validCandidateReleaseVerdict(value: unknown): boolean {
  if (value === undefined) return false;
  if (!isObject(value)) return false;
  const allowed = new Set([
    "qcOutcome", "qcIssueCounts", "reviewOutcome", "reviewIssueCounts", "panelChapterComposites", "rubric",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  if (!isString(value.qcOutcome) || !RELEASE_OUTCOMES.has(value.qcOutcome)) return false;
  if (!isString(value.reviewOutcome) || !RELEASE_OUTCOMES.has(value.reviewOutcome)) return false;
  if (!validIssueCounts(value.qcIssueCounts) || !validIssueCounts(value.reviewIssueCounts)) return false;
  const composites = value.panelChapterComposites;
  if (!Array.isArray(composites)) return false;
  for (const entry of composites) {
    if (!isObject(entry)) return false;
    const keys = Object.keys(entry).sort();
    if (keys.length !== 2 || keys[0] !== "chapterNumber" || keys[1] !== "composite") return false;
    if (!Number.isSafeInteger(entry.chapterNumber) || (entry.chapterNumber as number) < 1) return false;
    if (typeof entry.composite !== "number" || !Number.isFinite(entry.composite)) return false;
  }
  if (value.rubric === undefined) return true;
  const rubric = value.rubric;
  if (!isObject(rubric)) return false;
  const rubricKeys = new Set([
    "instrumentVersion", "composite", "tier", "gate", "churn", "bar", "factorFloor",
    "highQuality", "factorMedians", "sampledChapterNumbers", "totalChapters", "readerCount",
  ]);
  if (Object.keys(rubric).some((key) => !rubricKeys.has(key)) || Object.keys(rubric).length !== rubricKeys.size) return false;
  if (!isString(rubric.instrumentVersion) || rubric.instrumentVersion.length === 0) return false;
  if (typeof rubric.composite !== "number" || !Number.isFinite(rubric.composite)) return false;
  if (!isString(rubric.tier) || rubric.tier.length === 0) return false;
  if (rubric.gate !== "PASS" && rubric.gate !== "FAIL" && rubric.gate !== "SPLIT") return false;
  if (rubric.churn !== "LOW" && rubric.churn !== "MED" && rubric.churn !== "HIGH") return false;
  if (!Number.isSafeInteger(rubric.bar) || !Number.isSafeInteger(rubric.factorFloor)) return false;
  if (typeof rubric.highQuality !== "boolean") return false;
  if (!isObject(rubric.factorMedians)) return false;
  if (Object.values(rubric.factorMedians).some((score) => typeof score !== "number" || !Number.isFinite(score))) return false;
  if (!Array.isArray(rubric.sampledChapterNumbers) || rubric.sampledChapterNumbers.length === 0) return false;
  if (rubric.sampledChapterNumbers.some((number) => !Number.isSafeInteger(number) || (number as number) < 1)) return false;
  if (!Number.isSafeInteger(rubric.totalChapters) || (rubric.totalChapters as number) < 1) return false;
  if (!Number.isSafeInteger(rubric.readerCount) || (rubric.readerCount as number) < 1) return false;
  return true;
}

/**
 * The candidate chapter set a payload RECORDED — the id/number/title spec list
 * the release wrote down and hashed into the contentId. Undefined on the legacy
 * canonical-index route (whose authority is the index file on disk).
 *
 * This is the candidate route's stand-in for the canonical index: an authority
 * that exists in the manifest INDEPENDENTLY of the package, so "is this package
 * the chapter set this manifest is about?" is answerable without rebuilding the
 * expected manifest out of the package under test.
 */
export function recordedCandidateChapterSet(
  payload: ProductionManifestPayload,
): ProductionManifestCandidateChapterSetBlock | undefined {
  const block = (payload as unknown as Record<string, unknown>).candidateChapterSet;
  if (!isObject(block) || block.source !== "candidate") return undefined;
  if (!isString(block.candidateId) || !isString(block.manifestDigest) || !isString(block.semanticHash)) return undefined;
  if (!Array.isArray(block.chapters)) return undefined;
  return block as unknown as ProductionManifestCandidateChapterSetBlock;
}

export type ValidateProductionManifestResult =
  | { ok: true; manifest: ProductionPackageManifest; version: ProductionManifestVersion }
  | { ok: false; findings: ProductionManifestFinding[] };

export function validateProductionManifest(value: unknown): ValidateProductionManifestResult {
  const findings: ProductionManifestFinding[] = [];
  if (!isObject(value)) {
    return { ok: false, findings: [blocker({ checkId: "PPKG.manifest_missing", message: "Package is missing productionManifest." })] };
  }
  const schema = value.schemaVersion;
  let version: ProductionManifestVersion | null = null;
  if (schema === PRODUCTION_MANIFEST_SCHEMA_VERSION_V2) version = "v2";
  else if (schema === PRODUCTION_MANIFEST_SCHEMA_VERSION_V1) version = "v1";
  if (!version) {
    findings.push(blocker({
      checkId: "PPKG.manifest_schema_mismatch",
      message: `productionManifest.schemaVersion is ${JSON.stringify(schema)}, expected one of ${SUPPORTED_PRODUCTION_MANIFEST_SCHEMA_VERSIONS.join(", ")}.`,
      expected: SUPPORTED_PRODUCTION_MANIFEST_SCHEMA_VERSIONS.join(", "),
      actual: schema,
    }));
  }
  if (!isString(value.contentId)) findings.push(blocker({ checkId: "PPKG.manifest_content_id_missing", message: "productionManifest.contentId must be a non-empty string." }));
  if (!isString(value.payloadHash)) findings.push(blocker({ checkId: "PPKG.manifest_payload_hash_missing", message: "productionManifest.payloadHash must be a non-empty string." }));
  if (!isObject(value.payload)) findings.push(blocker({ checkId: "PPKG.manifest_payload_missing", message: "productionManifest.payload must be an object." }));
  else if (version) {
    // Do not let a v1 payload masquerade as v2 evidence (or vice-versa): the
    // payload schema version must agree with the envelope version (req 2).
    const expectedPayloadSchema = version === "v2" ? PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION_V2 : PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION_V1;
    if (value.payload.schemaVersion !== expectedPayloadSchema) {
      findings.push(blocker({
        checkId: "PPKG.manifest_payload_schema_mismatch",
        message: `productionManifest.payload.schemaVersion is ${JSON.stringify(value.payload.schemaVersion)}, expected ${expectedPayloadSchema} for a ${schema} manifest.`,
        expected: expectedPayloadSchema,
        actual: value.payload.schemaVersion,
      }));
    }
    // Exactly ONE chapter-set block, and it must be well formed. This is the
    // single read-gate that decides how the verifier reconstructs the set from
    // disk, so a payload that declares neither (nothing to reconstruct against)
    // or both (two conflicting authorities) fails closed here rather than
    // silently picking one.
    findings.push(...validateChapterSetBlock(value.payload as Record<string, unknown>));
    if (version === "v2") {
      // A v2 payload must carry both forms of evidence that distinguish it from v1:
      // the source-reality evidence and the three build-input fingerprints. Validate
      // the shape HERE (the single read-gate) so a forged/corrupted v2 payload fails
      // closed with a structured finding instead of throwing in the verifier (req 1, 7).
      const payload = value.payload as Record<string, unknown>;
      const evidence = payload.sourceRealityEvidence;
      if (!isObject(evidence)) {
        findings.push(blocker({
          checkId: "PPKG.manifest_source_reality_evidence_missing",
          message: "productionManifest.payload.sourceRealityEvidence must be an object in a v2 manifest.",
        }));
      } else {
        if (!isString(evidence.bookId)) findings.push(blocker({ checkId: "PPKG.manifest_source_reality_bookid_missing", message: "sourceRealityEvidence.bookId must be a non-empty string." }));
        if (!isString(evidence.policyResult)) findings.push(blocker({ checkId: "PPKG.manifest_source_reality_policy_missing", message: "sourceRealityEvidence.policyResult must be a non-empty string." }));
      }
      const versions = payload.versions;
      if (!isObject(versions)) {
        findings.push(blocker({ checkId: "PPKG.manifest_versions_missing", message: "productionManifest.payload.versions must be an object in a v2 manifest." }));
      } else {
        for (const bundle of ["promptBundle", "configBundle", "codeFingerprint"] as const) {
          const fp = (versions as Record<string, unknown>)[bundle];
          if (!isObject(fp) || !isString(fp.bundleHash)) {
            findings.push(blocker({
              checkId: "PPKG.manifest_fingerprint_missing",
              message: `productionManifest.payload.versions.${bundle}.bundleHash must be a non-empty string in a v2 manifest.`,
            }));
          }
        }
      }
    }
  }
  if (!isObject(value.metadata)) findings.push(blocker({ checkId: "PPKG.manifest_metadata_missing", message: "productionManifest.metadata must be an object." }));
  else {
    if (!isString(value.metadata.createdAt)) findings.push(blocker({ checkId: "PPKG.manifest_created_at_missing", message: "productionManifest.metadata.createdAt must be a non-empty string." }));
    if (!isString(value.metadata.generator)) findings.push(blocker({ checkId: "PPKG.manifest_generator_missing", message: "productionManifest.metadata.generator must be a non-empty string." }));
    if (!isString(value.metadata.runId)) findings.push(blocker({ checkId: "PPKG.manifest_run_id_missing", message: "productionManifest.metadata.runId must be a non-empty string." }));
  }
  if (findings.length > 0 || !version) return { ok: false, findings };
  return { ok: true, manifest: value as ProductionPackageManifest, version };
}

export function productionManifestPayloadHash(payload: ProductionManifestPayload): string {
  return canonicalJsonSha256(payload);
}

export function productionManifestPayloadBytes(payload: ProductionManifestPayload): string {
  return canonicalJson(payload);
}

export function buildExpectedProductionManifestForPackage(args: {
  pkg: BookPackageV21;
  /** Candidate-release chapter-set source (see BuildProductionManifestInput).
   *  The verifier passes what the manifest under test DECLARES, so a
   *  candidate-sourced package recomputes without the ambient index. */
  chapterSetSource?: ProductionChapterSetSource;
  /** Candidate regime only — see BuildProductionManifestInput. */
  candidateChapterEvidence?: CandidateChapterEvidenceResolver;
  /** Candidate regime only — see BuildProductionManifestInput. Carries the
   *  optional R-254 verdict block so a verifier's declared-evidence REPLAY
   *  rebuilds the same payload (and therefore the same contentId) as the
   *  release that wrote it. */
  candidateQcEvidence?: { reviewId: string; qcRoundId: string; verdict?: CandidateReleaseVerdict };
  stateRoot?: string;
  runsRoot?: string;
  createdAt?: string;
  generator?: string;
  runId?: string;
  packagePath?: string;
  manifestVersion?: ProductionManifestVersion;
  fingerprintRoots?: FingerprintRoots;
  recordPath?: string;
  exemptionsFile?: string;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}): BuildProductionManifestResult {
  const bookId = args.pkg.book?.bookId;
  return buildProductionManifest({
    bookId,
    title: args.pkg.book?.title ?? "",
    author: args.pkg.book?.author ?? "",
    contentOwner: args.pkg.contentOwner ?? "chapterflow",
    categories: args.pkg.book?.categories,
    tags: args.pkg.book?.tags,
    chapters: args.pkg.chapters ?? [],
    ...(args.chapterSetSource === undefined ? {} : { chapterSetSource: args.chapterSetSource }),
    ...(args.candidateChapterEvidence === undefined ? {} : { candidateChapterEvidence: args.candidateChapterEvidence }),
    ...(args.candidateQcEvidence === undefined ? {} : { candidateQcEvidence: args.candidateQcEvidence }),
    stateRoot: args.stateRoot,
    runsRoot: args.runsRoot,
    createdAt: args.createdAt ?? args.pkg.createdAt,
    generator: args.generator,
    runId: args.runId,
    packagePath: args.packagePath,
    manifestVersion: args.manifestVersion,
    fingerprintRoots: args.fingerprintRoots,
    recordPath: args.recordPath,
    exemptionsFile: args.exemptionsFile,
    env: args.env,
    now: args.now,
  });
}

export function manifestSourceFileName(chapter: ProductionManifestChapter): string {
  return basename(chapter.sourceEvidence.path);
}
