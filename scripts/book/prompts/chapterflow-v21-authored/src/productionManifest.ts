import { existsSync, readFileSync } from "fs";
import { basename, relative, resolve, sep } from "path";

import type { ChapterSpec } from "./generateChapter.js";
import type { BookPackageV21, ChapterV21 } from "./types.js";
import { V21_SCHEMA_VERSION } from "./types.js";
import { isApprovedReviewer, isAttestationFresh, type QcAttestation } from "./critics/qcAttestation.js";
import { CANONICAL_STATE, REPO_ROOT, normSlug } from "./lib/chapterPaths.js";
import {
  canonicalChapterIndexPath,
  compareChapterSetToCanonical,
  formatChapterSetBlockers,
  readCanonicalChapterIndex,
} from "./lib/chapterSet.js";
import { canonicalJson, canonicalJsonSha256 } from "./lib/canonicalJson.js";
import { findRunArtifact } from "./lib/runDirs.js";
import {
  READER_CONTENT_HASH_VERSION,
  READER_CONTENT_STRIP_RULES_VERSION,
  readerContentHash,
} from "./lib/readerContent.js";

export const PRODUCTION_MANIFEST_SCHEMA_VERSION = "chapterflow-production-manifest-v1" as const;
export const PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION = "chapterflow-production-manifest-payload-v1" as const;
export const PRODUCTION_CANONICAL_JSON_VERSION = "canonical-json-sha256-v1" as const;
export const PRODUCTION_PROMPT_SET_ID = "chapterflow-v21-authored-prompts-v1" as const;
export const PRODUCTION_CONFIG_ID = "chapterflow-v21-authored-config-v1" as const;
export const PRODUCTION_PACKAGE_CODE_ID = "chapterflow-v21-authored-production-package-v1" as const;

const DEFAULT_RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow", "runs");

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
  qcAttestation: {
    path: string;
    semanticHash: string;
    roundId: string;
    contentHash: string;
    hashVersion: string;
    reviewer: string;
    reviewedAt: string;
  };
};

export type ProductionManifestPayload = {
  schemaVersion: typeof PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION;
  bookId: string;
  packageSchemaVersion: typeof V21_SCHEMA_VERSION;
  book: {
    title: string;
    author: string;
    categories?: string[];
    tags?: string[];
    contentOwner: string;
  };
  canonicalIndex: {
    path: string;
    semanticHash: string;
    chapters: Array<{ chapterId: string; chapterNumber: number; chapterTitle: string }>;
  };
  chapters: ProductionManifestChapter[];
  evidencePolicy: {
    sourceEvidence: "required";
    authoringEvidence: "required-for-source-v2";
    qcAttestation: "required";
  };
  versions: {
    canonicalJson: typeof PRODUCTION_CANONICAL_JSON_VERSION;
    readerContentHash: typeof READER_CONTENT_HASH_VERSION;
    readerContentStripRules: typeof READER_CONTENT_STRIP_RULES_VERSION;
    promptSet: string;
    config: string;
    code: string;
  };
};

export type ProductionPackageManifest = {
  schemaVersion: typeof PRODUCTION_MANIFEST_SCHEMA_VERSION;
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
  createdAt: string;
  generator?: string;
  runId?: string;
  packagePath?: string;
  promptSetId?: string;
  configId?: string;
  codeId?: string;
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

function buildPayload(input: BuildProductionManifestInput): { ok: true; payload: ProductionManifestPayload } | { ok: false; findings: ProductionManifestFinding[] } {
  const stateRoot = input.stateRoot ?? CANONICAL_STATE;
  const runsRoot = input.runsRoot ?? DEFAULT_RUNS_ROOT;
  const bookId = normSlug(input.bookId);
  const findings: ProductionManifestFinding[] = [];

  const canonical = readCanonicalChapterIndex(bookId, stateRoot);
  if (!canonical.ok) {
    findings.push(...canonical.blockers.map((f) => blocker({
      checkId: f.checkId,
      message: f.message,
      expected: f.expected,
      actual: f.actual,
    })));
    return { ok: false, findings };
  }

  const set = compareChapterSetToCanonical({
    bookId,
    canonical: canonical.chapters,
    actual: input.chapters,
    actualLabel: "production package chapters",
  });
  if (!set.ok) {
    findings.push(...set.blockers.map((f) => blocker({
      checkId: f.checkId,
      message: f.message,
      expected: f.expected,
      actual: f.actual,
    })));
  }

  const indexPath = canonicalChapterIndexPath(bookId, stateRoot);
  const index = readJsonWithSemanticHash(indexPath, "PPKG.index_unreadable", "canonical chapter index");
  if (!index.ok) findings.push(index.finding);

  const chapterPayloads: ProductionManifestChapter[] = [];
  for (let i = 0; i < canonical.chapters.length; i++) {
    const spec = canonical.chapters[i];
    const chapter = input.chapters[i];
    if (!chapter) continue;

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
    const authored = readJsonWithSemanticHash(authoringPath, "PPKG.authoring_unreadable", "state chapter authoring evidence", spec.chapterNumber);
    if (authored.ok) {
      const sourceAnchors = authored.value?.authoring?.sourceAnchors;
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
      if (!isAttestationFresh(att, chapter)) {
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

  if (findings.length > 0 || !index.ok) {
    return {
      ok: false,
      findings: findings.length > 0
        ? findings
        : [blocker({ checkId: "PPKG.manifest_payload_unavailable", message: `Cannot build production manifest payload: ${formatChapterSetBlockers(canonical.blockers)}` })],
    };
  }

  const payload: ProductionManifestPayload = {
    schemaVersion: PRODUCTION_MANIFEST_PAYLOAD_SCHEMA_VERSION,
    bookId,
    packageSchemaVersion: V21_SCHEMA_VERSION,
    book: {
      title: input.title,
      author: input.author,
      categories: input.categories,
      tags: input.tags,
      contentOwner: input.contentOwner,
    },
    canonicalIndex: {
      path: logicalStatePath(stateRoot, indexPath),
      semanticHash: index.hash,
      chapters: canonical.chapters.map((spec) => ({
        chapterId: spec.chapterId,
        chapterNumber: spec.chapterNumber,
        chapterTitle: spec.chapterTitle,
      })),
    },
    chapters: chapterPayloads,
    evidencePolicy: {
      sourceEvidence: "required",
      authoringEvidence: "required-for-source-v2",
      qcAttestation: "required",
    },
    versions: {
      canonicalJson: PRODUCTION_CANONICAL_JSON_VERSION,
      readerContentHash: READER_CONTENT_HASH_VERSION,
      readerContentStripRules: READER_CONTENT_STRIP_RULES_VERSION,
      promptSet: input.promptSetId ?? PRODUCTION_PROMPT_SET_ID,
      config: input.configId ?? PRODUCTION_CONFIG_ID,
      code: input.codeId ?? PRODUCTION_PACKAGE_CODE_ID,
    },
  };
  return { ok: true, payload };
}

export function buildProductionManifest(input: BuildProductionManifestInput): BuildProductionManifestResult {
  const payloadResult = buildPayload(input);
  if (!payloadResult.ok) return payloadResult;
  const payloadHash = canonicalJsonSha256(payloadResult.payload);
  const manifest: ProductionPackageManifest = {
    schemaVersion: PRODUCTION_MANIFEST_SCHEMA_VERSION,
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

export function validateProductionManifest(value: unknown): { ok: true; manifest: ProductionPackageManifest } | { ok: false; findings: ProductionManifestFinding[] } {
  const findings: ProductionManifestFinding[] = [];
  if (!isObject(value)) {
    return { ok: false, findings: [blocker({ checkId: "PPKG.manifest_missing", message: "Package is missing productionManifest." })] };
  }
  if (value.schemaVersion !== PRODUCTION_MANIFEST_SCHEMA_VERSION) {
    findings.push(blocker({
      checkId: "PPKG.manifest_schema_mismatch",
      message: `productionManifest.schemaVersion is ${JSON.stringify(value.schemaVersion)}, expected ${PRODUCTION_MANIFEST_SCHEMA_VERSION}.`,
      expected: PRODUCTION_MANIFEST_SCHEMA_VERSION,
      actual: value.schemaVersion,
    }));
  }
  if (!isString(value.contentId)) findings.push(blocker({ checkId: "PPKG.manifest_content_id_missing", message: "productionManifest.contentId must be a non-empty string." }));
  if (!isString(value.payloadHash)) findings.push(blocker({ checkId: "PPKG.manifest_payload_hash_missing", message: "productionManifest.payloadHash must be a non-empty string." }));
  if (!isObject(value.payload)) findings.push(blocker({ checkId: "PPKG.manifest_payload_missing", message: "productionManifest.payload must be an object." }));
  if (!isObject(value.metadata)) findings.push(blocker({ checkId: "PPKG.manifest_metadata_missing", message: "productionManifest.metadata must be an object." }));
  else {
    if (!isString(value.metadata.createdAt)) findings.push(blocker({ checkId: "PPKG.manifest_created_at_missing", message: "productionManifest.metadata.createdAt must be a non-empty string." }));
    if (!isString(value.metadata.generator)) findings.push(blocker({ checkId: "PPKG.manifest_generator_missing", message: "productionManifest.metadata.generator must be a non-empty string." }));
    if (!isString(value.metadata.runId)) findings.push(blocker({ checkId: "PPKG.manifest_run_id_missing", message: "productionManifest.metadata.runId must be a non-empty string." }));
  }
  if (findings.length > 0) return { ok: false, findings };
  return { ok: true, manifest: value as ProductionPackageManifest };
}

export function productionManifestPayloadHash(payload: ProductionManifestPayload): string {
  return canonicalJsonSha256(payload);
}

export function productionManifestPayloadBytes(payload: ProductionManifestPayload): string {
  return canonicalJson(payload);
}

export function buildExpectedProductionManifestForPackage(args: {
  pkg: BookPackageV21;
  stateRoot?: string;
  runsRoot?: string;
  createdAt?: string;
  generator?: string;
  runId?: string;
  packagePath?: string;
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
    stateRoot: args.stateRoot,
    runsRoot: args.runsRoot,
    createdAt: args.createdAt ?? args.pkg.createdAt,
    generator: args.generator,
    runId: args.runId,
    packagePath: args.packagePath,
  });
}

export function manifestSourceFileName(chapter: ProductionManifestChapter): string {
  return basename(chapter.sourceEvidence.path);
}
