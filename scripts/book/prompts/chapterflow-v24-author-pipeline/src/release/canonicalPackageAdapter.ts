import type { BookContentReader, CandidateSnapshot } from "../books/candidateTypes.js";
import type { CandidateIdentity, Result } from "../contracts/v4Core.js";
import {
  buildExpectedProductionManifestForPackage,
  type BuildProductionManifestResult,
  type ProductionManifestVersion,
} from "../productionManifest.js";
import { buildLegacyReaderPackage } from "../promoteBook.js";
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

export type CanonicalPackageWriter = (input: Readonly<{
  bookId: string;
  candidate: CandidateIdentity;
  package: BookPackageV21;
}>) => void | Promise<void>;

export type CanonicalPackageAdapterOptions = Readonly<{
  contentReader: BookContentReader;
  promotionService: PromotionService;
  packageWriter: CanonicalPackageWriter;
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
  bookRevision: number;
  readback: "VERIFIED";
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

export async function assembleCanonicalPackage(input: Readonly<{
  bookId: string;
  candidate: CandidateIdentity;
  metadata: CanonicalPackageMetadata;
  contentReader: BookContentReader;
}>): Promise<Result<CanonicalPackage>> {
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
    if (!promoted.ok) return promoted;
    try {
      await this.#options.packageWriter({
        bookId: request.bookId,
        candidate: { ...request.candidate },
        package: assembled.value.package,
      });
    } catch (cause) {
      return failed("RECONCILIATION_REQUIRED", `package write failed after pointer commit: ${errorMessage(cause)}`);
    }
    return {
      ok: true,
      value: {
        package: assembled.value.package,
        bookRevision: promoted.value.bookRevision,
        readback: promoted.value.readback,
      },
    };
  }
}

/** Real production-manifest builder used by legacy/V4 parity proof. */
export function buildCanonicalPackageManifest(args: Readonly<{
  package: BookPackageV21;
  stateRoot?: string;
  runsRoot?: string;
  manifestVersion?: ProductionManifestVersion;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}>): BuildProductionManifestResult {
  return buildExpectedProductionManifestForPackage({
    pkg: args.package,
    stateRoot: args.stateRoot,
    runsRoot: args.runsRoot,
    manifestVersion: args.manifestVersion,
    env: args.env,
    now: args.now,
  });
}
