import type { BookContentReader, CandidateSnapshot } from "../books/candidateTypes.js";
import type { CandidateIdentity, Result } from "../contracts/v4Core.js";
import {
  buildExpectedProductionManifestForPackage,
  type BuildProductionManifestResult,
  type ProductionManifestVersion,
} from "../productionManifest.js";
import {
  buildLegacyReaderPackage,
  PRODUCTION_MANIFEST_SIDECAR_SCHEMA,
  type ProductionManifestSidecar,
} from "../promoteBook.js";
import { normSlug } from "../lib/chapterPaths.js";
import type { FingerprintRoots } from "../lib/pipelineFingerprint.js";
import { verifyProductionPackage } from "../verifyProductionPackage.js";
import type { PromotionService } from "./promotionTypes.js";
import type { BookPackageV21, ChapterV21 } from "../types.js";

export type CanonicalPackageMetadata = Readonly<{
  title: string;
  author: string;
  packageId: string;
  createdAt: string;
  contentOwner?: string;
  categories?: string[];
  tags?: string[];
}>;

export type CanonicalPackage = Readonly<{
  candidate: CandidateIdentity;
  package: BookPackageV21;
}>;

/** The release artifacts a candidate release publishes. `sidecar` is the
 *  state-side production manifest publish-final's preflight
 *  (verifyProductionPackage) loads next to the package — a package published
 *  WITHOUT it is unshippable (PPKG.sidecar_missing), so the writer must publish
 *  both or neither. */
export type CanonicalPackageWriter = (input: Readonly<{
  bookId: string;
  candidate: CandidateIdentity;
  package: BookPackageV21;
  sidecar: ProductionManifestSidecar;
}>) => void | Promise<void>;

/** Read-location seams for the production-manifest build. Production omits every
 *  field (the canonical state/runs roots and the real clock are the defaults);
 *  hermetic tests point the build at a disposable tree. */
export type CanonicalManifestOptions = Readonly<{
  stateRoot?: string;
  runsRoot?: string;
  recordPath?: string;
  exemptionsFile?: string;
  fingerprintRoots?: FingerprintRoots;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}>;

export type CanonicalPackageAdapterOptions = Readonly<{
  contentReader: BookContentReader;
  promotionService: PromotionService;
  packageWriter: CanonicalPackageWriter;
  manifest?: CanonicalManifestOptions;
}>;

export type CanonicalReleaseRequest = Readonly<{
  bookId: string;
  candidate: CandidateIdentity;
  reviewId: string;
  qcRoundId: string;
  expectedBookRevision: number;
  promotedAt: string;
  metadata: CanonicalPackageMetadata;
}>;

export type CanonicalReleaseResult = Readonly<{
  package: BookPackageV21;
  sidecar: ProductionManifestSidecar;
  bookRevision: number;
  readback: "VERIFIED";
}>;

export type CanonicalCurrentRelease = Readonly<{
  candidate: CandidateIdentity;
  bookRevision: number;
}>;

function failed<T>(code: string, message: string, retryable = false): Result<T> {
  return { ok: false, error: { code, message, retryable } };
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

function parseChapters(snapshot: CandidateSnapshot): Result<ChapterV21[]> {
  const chapters: ChapterV21[] = [];
  const chapterFiles = snapshot.files.filter((file) => file.kind === "CHAPTER");
  if (chapterFiles.length === 0) return failed("PACKAGE_CANDIDATE_INVALID", "candidate has no chapter artifacts");
  for (const file of chapterFiles) {
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(file.bytes).toString("utf8"));
    } catch (cause) {
      return failed("PACKAGE_CANDIDATE_INVALID", `${file.logicalPath} is not JSON: ${errorMessage(cause)}`);
    }
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      (value as { schemaVersion?: unknown }).schemaVersion !== "chapterflow-v21-authored" ||
      typeof (value as { chapterId?: unknown }).chapterId !== "string" ||
      !Number.isSafeInteger((value as { number?: unknown }).number)
    ) {
      return failed("PACKAGE_CANDIDATE_INVALID", `${file.logicalPath} is not a v21 chapter`);
    }
    chapters.push(value as ChapterV21);
  }
  chapters.sort((left, right) => left.number - right.number);
  if (new Set(chapters.map((chapter) => chapter.chapterId)).size !== chapters.length) {
    return failed("PACKAGE_CANDIDATE_INVALID", "candidate contains duplicate chapter identities");
  }
  return { ok: true, value: chapters };
}

/** The package identity `verifyProductionPackage` (PPKG.package_id_shape) demands:
 *  `<normalised bookId>-v21-<epochMs>`. The package BODY always carries the
 *  normalised slug (buildLegacyReaderPackage normSlugs book.bookId), so a caller
 *  that derives the packageId from a RAW argv bookId ships a package whose id can
 *  never verify. Fail closed here, at release time, instead of at publish time. */
function checkPackageIdentity(bookId: string, metadata: CanonicalPackageMetadata): Result<null> {
  const slug = normSlug(bookId);
  if (!new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-v21-\\d+$`).test(metadata.packageId)) {
    return failed(
      "PACKAGE_METADATA_INVALID",
      `packageId ${JSON.stringify(metadata.packageId)} must be "${slug}-v21-<epochMs>" (derived from the NORMALISED book id, which is what the package body and the production verifier carry)`,
    );
  }
  return { ok: true, value: null };
}

export async function assembleCanonicalPackage(input: Readonly<{
  bookId: string;
  candidate: CandidateIdentity;
  metadata: CanonicalPackageMetadata;
  contentReader: BookContentReader;
}>): Promise<Result<CanonicalPackage>> {
  const identity = checkPackageIdentity(input.bookId, input.metadata);
  if (!identity.ok) return identity;
  let opened;
  try {
    opened = await input.contentReader.open({
      bookId: input.bookId,
      selector: { kind: "CANDIDATE", candidateId: input.candidate.candidateId },
    });
  } catch (cause) {
    return failed("PACKAGE_CANDIDATE_UNAVAILABLE", `candidate read failed: ${errorMessage(cause)}`);
  }
  if (!opened.ok) return failed(opened.error.code, opened.error.message, opened.error.retryable);
  if (
    opened.value.manifest.bookId !== input.bookId ||
    opened.value.manifest.candidateId !== input.candidate.candidateId ||
    opened.value.manifest.manifestDigest !== input.candidate.manifestDigest ||
    opened.value.currentRevision !== undefined
  ) {
    return failed("PACKAGE_CANDIDATE_MISMATCH", "explicit candidate read returned different identity or CURRENT state");
  }
  const chapters = parseChapters(opened.value);
  if (!chapters.ok) return chapters;
  return {
    ok: true,
    value: {
      candidate: { ...input.candidate },
      package: buildLegacyReaderPackage({
        bookId: input.bookId,
        ...input.metadata,
        chapters: chapters.value,
      }),
    },
  };
}

/** Real V4 release route. Assembly is read-only; package write follows verified CAS/readback. */
export class CanonicalPackageAdapter {
  readonly #options: CanonicalPackageAdapterOptions;

  constructor(options: CanonicalPackageAdapterOptions) {
    this.#options = options;
  }

  async readCurrent(bookId: string): Promise<Result<CanonicalCurrentRelease | null>> {
    let opened;
    try {
      opened = await this.#options.contentReader.open({ bookId, selector: { kind: "CURRENT" } });
    } catch (cause) {
      return failed("CURRENT_UNAVAILABLE", `CURRENT read failed: ${errorMessage(cause)}`);
    }
    if (!opened.ok) {
      return opened.error.code === "CURRENT_NOT_SET"
        ? { ok: true, value: null }
        : failed("CURRENT_UNAVAILABLE", opened.error.message, opened.error.retryable);
    }
    if (!Number.isSafeInteger(opened.value.currentRevision) || (opened.value.currentRevision ?? 0) < 1) {
      return failed("CURRENT_UNAVAILABLE", "CURRENT read returned no valid revision");
    }
    return {
      ok: true,
      value: {
        candidate: {
          candidateId: opened.value.manifest.candidateId,
          manifestDigest: opened.value.manifest.manifestDigest,
        },
        bookRevision: opened.value.currentRevision as number,
      },
    };
  }

  async release(request: CanonicalReleaseRequest): Promise<Result<CanonicalReleaseResult>> {
    const assembled = await assembleCanonicalPackage({
      bookId: request.bookId,
      candidate: request.candidate,
      metadata: request.metadata,
      contentReader: this.#options.contentReader,
    });
    if (!assembled.ok) return assembled;

    const promoted = await this.#options.promotionService.promote({
      bookId: request.bookId,
      candidate: request.candidate,
      reviewId: request.reviewId,
      qcRoundId: request.qcRoundId,
      expectedBookRevision: request.expectedBookRevision,
      promotedAt: request.promotedAt,
    });
    if (!promoted.ok) {
      if (promoted.error.code !== "REVISION_CONFLICT") return promoted;
      const current = await this.readCurrent(request.bookId);
      if (
        current.ok &&
        current.value !== null &&
        current.value.bookRevision === request.expectedBookRevision + 1 &&
        current.value.candidate.candidateId === request.candidate.candidateId &&
        current.value.candidate.manifestDigest === request.candidate.manifestDigest
      ) {
        return failed(
          "RECONCILIATION_REQUIRED",
          "CURRENT names this candidate, but prior release intent cannot be proven; package write suppressed",
        );
      }
      return promoted;
    }
    // The production-manifest SIDECAR is built here, from the very package that
    // is about to be written, so the two can never disagree by construction:
    // packageId/createdAt/bookId are copied off the assembled package, and the
    // manifest payload is the same canonical build publish-final's verifier
    // recomputes from state. Without it a v25-released book is unshippable —
    // verifyProductionPackage fails PPKG.sidecar_missing and publish-final's
    // preflight refuses to copy anything.
    //
    // It runs AFTER the pointer commit for two reasons: the candidate-bound
    // assembly above must stay free of ambient-state reads (a candidate-only
    // release never touches state/indexes to build its package), and a manifest
    // that cannot be built must leave production untouched. An unbuildable
    // manifest therefore lands in the SAME recoverable state a failed package
    // write does — pointer committed, nothing published, RECONCILIATION_REQUIRED
    // — never a package on disk with no manifest behind it.
    const built = buildCanonicalPackageManifest({
      package: assembled.value.package,
      ...this.#options.manifest,
    });
    if (!built.ok) {
      return failed(
        "RECONCILIATION_REQUIRED",
        `production manifest unbuildable after pointer commit; nothing published: ${built.findings
          .map((finding) => `${finding.checkId}${finding.chapterNumber ? ` (ch${finding.chapterNumber})` : ""}: ${finding.message}`)
          .join("; ")}`,
      );
    }
    const sidecar: ProductionManifestSidecar = {
      schemaVersion: PRODUCTION_MANIFEST_SIDECAR_SCHEMA,
      bookId: assembled.value.package.book.bookId,
      packageId: assembled.value.package.packageId,
      createdAt: assembled.value.package.createdAt,
      manifest: built.manifest,
    };
    // RELEASE-TIME SELF-VERIFY — the same call promoteBook makes on its candidate
    // pair before it declares success (promoteBook.ts: verifyProductionPackage
    // with packageData + manifestData + compareLooseState). Building the sidecar
    // is not proof it is shippable: the manifest builder hashes the PACKAGE
    // chapters, so it cannot see a package whose reader content has drifted from
    // the loose state chapters — and register-web refuses to register exactly
    // that pair (it verifies with compareLooseState: true). Verifying the
    // in-memory pair here means a release can never report success on a pair a
    // later publish step would reject.
    //
    // Fail-closed AFTER the pointer commit lands in the same recoverable state an
    // unbuildable manifest or a failed package write does: pointer committed,
    // NOTHING published, RECONCILIATION_REQUIRED.
    const verification = verifyProductionPackage({
      packageData: assembled.value.package,
      manifestData: sidecar,
      compareLooseState: true,
      stateRoot: this.#options.manifest?.stateRoot,
      runsRoot: this.#options.manifest?.runsRoot,
      recordPath: this.#options.manifest?.recordPath,
      exemptionsFile: this.#options.manifest?.exemptionsFile,
      fingerprintRoots: this.#options.manifest?.fingerprintRoots,
      env: this.#options.manifest?.env,
      now: this.#options.manifest?.now,
    });
    if (!verification.ok) {
      return failed(
        "RECONCILIATION_REQUIRED",
        `released pair fails production verification after pointer commit; nothing published: ${verification.findings
          .map((finding) => `${finding.checkId}${finding.chapterNumber ? ` (ch${finding.chapterNumber})` : ""}: ${finding.message}`)
          .join("; ")}`,
      );
    }
    try {
      await this.#options.packageWriter({
        bookId: request.bookId,
        candidate: { ...request.candidate },
        package: assembled.value.package,
        sidecar,
      });
    } catch (cause) {
      return failed("RECONCILIATION_REQUIRED", `package write failed after pointer commit: ${errorMessage(cause)}`);
    }
    return {
      ok: true,
      value: {
        package: assembled.value.package,
        sidecar,
        bookRevision: promoted.value.bookRevision,
        readback: promoted.value.readback,
      },
    };
  }
}

/** Real production-manifest builder used by legacy/V4 parity proof. */
export function buildCanonicalPackageManifest(args: Readonly<CanonicalManifestOptions & {
  package: BookPackageV21;
  manifestVersion?: ProductionManifestVersion;
}>): BuildProductionManifestResult {
  return buildExpectedProductionManifestForPackage({
    pkg: args.package,
    stateRoot: args.stateRoot,
    runsRoot: args.runsRoot,
    recordPath: args.recordPath,
    exemptionsFile: args.exemptionsFile,
    fingerprintRoots: args.fingerprintRoots,
    manifestVersion: args.manifestVersion,
    env: args.env,
    now: args.now,
  });
}
