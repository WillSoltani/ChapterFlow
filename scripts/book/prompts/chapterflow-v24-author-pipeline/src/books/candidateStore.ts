import { randomBytes } from "node:crypto";
import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { PlannedArtifact, Result } from "../contracts/v4Core.js";
import { type AtomicBookFileSeams, finalizeCandidateDirectory } from "./atomicBookFiles.js";
import { createBookContentReader, type BookContentReaderSeams } from "./bookContentReader.js";
import { candidateManifestDigest } from "./candidateDigest.js";
import {
  ARTIFACT_KINDS,
  ARTIFACT_MEDIA_TYPES,
  type CandidateEntry,
  type CandidateInputFile,
  type CandidateManifest,
  type CandidateSelector,
  type CandidateSnapshot,
  type CandidateStore,
} from "./candidateTypes.js";
import {
  bookPaths,
  candidatePaths,
  contentPath,
  ensureDirectoryWithinBooksRoot,
  requireBooksRoot,
  requireLogicalPath,
  requirePathId,
} from "./bookPaths.js";
import type { CurrentPointerStore } from "./currentPointer.js";
import type { BookWriteLock } from "./leaseTypes.js";

export type CandidateStagePoint =
  | "candidate.before-content"
  | "candidate.after-content"
  | "candidate.before-manifest"
  | "candidate.after-manifest";

export interface CandidateStoreSeams {
  readonly point?: (name: CandidateStagePoint, logicalPath?: string) => void;
  readonly tempSuffix?: () => string;
  readonly atomic?: AtomicBookFileSeams;
  readonly reader?: BookContentReaderSeams;
}

export interface CandidateStoreOptions {
  readonly booksRoot: string;
  readonly writeLock: BookWriteLock;
  readonly currentPointerStore: CurrentPointerStore;
  readonly seams?: CandidateStoreSeams;
}

interface ValidatedStage {
  readonly bookId: string;
  readonly candidateId: string;
  readonly parentCandidateId?: string;
  readonly createdByRunId: string;
  readonly createdAt: string;
  readonly entries: readonly CandidateEntry[];
  readonly files: readonly CandidateInputFile[];
}

function failed<T>(code: string, message: string, retryable = false): Result<T> {
  return { ok: false, error: { code, message, retryable } };
}

function isCanonicalUtc(value: string): boolean {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isKind(value: unknown): value is CandidateEntry["kind"] {
  return typeof value === "string" && (ARTIFACT_KINDS as readonly string[]).includes(value);
}

function isMediaType(value: unknown): value is CandidateEntry["mediaType"] {
  return typeof value === "string" && (ARTIFACT_MEDIA_TYPES as readonly string[]).includes(value);
}

function validateArtifact(value: unknown, label: string): Result<PlannedArtifact> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return failed("CANDIDATE_INVALID", `${label} must be an object`);
  }
  const artifact = value as Record<string, unknown>;
  if (!isKind(artifact.kind) || !isMediaType(artifact.mediaType) || typeof artifact.logicalPath !== "string") {
    return failed("CANDIDATE_INVALID", `${label} metadata is invalid`);
  }
  try {
    requireLogicalPath(artifact.logicalPath);
  } catch (cause) {
    return failed("CANDIDATE_INVALID", `${label}: ${(cause as Error).message}`);
  }
  return {
    ok: true,
    value: { kind: artifact.kind, logicalPath: artifact.logicalPath, mediaType: artifact.mediaType },
  };
}

function validateStage(input: Readonly<{
  bookId: string;
  candidateId: string;
  parentCandidateId?: string;
  createdByRunId: string;
  expectedInventory: readonly PlannedArtifact[];
  files: readonly CandidateInputFile[];
  createdAt: string;
}>): Result<ValidatedStage> {
  try {
    requirePathId(input.bookId, "bookId");
    requirePathId(input.candidateId, "candidateId");
    if (input.parentCandidateId !== undefined) requirePathId(input.parentCandidateId, "candidateId");
  } catch (cause) {
    return failed("CANDIDATE_INVALID", (cause as Error).message);
  }
  if (typeof input.createdByRunId !== "string" || input.createdByRunId.length === 0) {
    return failed("CANDIDATE_INVALID", "createdByRunId must be a non-empty opaque ID");
  }
  if (typeof input.createdAt !== "string" || !isCanonicalUtc(input.createdAt)) {
    return failed("CANDIDATE_INVALID", "createdAt must be canonical UTC ISO time");
  }
  if (!Array.isArray(input.expectedInventory) || !Array.isArray(input.files)) {
    return failed("CANDIDATE_INVALID", "expectedInventory and files must be arrays");
  }
  if (input.expectedInventory.length !== input.files.length) {
    return failed("CANDIDATE_INVALID", "candidate files must exactly match expected inventory length and order");
  }

  const entries: CandidateEntry[] = [];
  const files: CandidateInputFile[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < input.expectedInventory.length; index += 1) {
    const expected = validateArtifact(input.expectedInventory[index], `expectedInventory[${index}]`);
    if (!expected.ok) return expected;
    const actual = validateArtifact(input.files[index], `files[${index}]`);
    if (!actual.ok) return actual;
    const rawFile = input.files[index] as CandidateInputFile;
    if (!(rawFile.bytes instanceof Uint8Array)) {
      return failed("CANDIDATE_INVALID", `files[${index}].bytes must be Uint8Array`);
    }
    if (
      expected.value.kind !== actual.value.kind ||
      expected.value.logicalPath !== actual.value.logicalPath ||
      expected.value.mediaType !== actual.value.mediaType
    ) {
      return failed("CANDIDATE_INVALID", `files[${index}] metadata/order differs from expectedInventory`);
    }
    if (seen.has(expected.value.logicalPath)) {
      return failed("CANDIDATE_INVALID", `duplicate candidate logicalPath: ${expected.value.logicalPath}`);
    }
    seen.add(expected.value.logicalPath);
    const bytes = Buffer.from(rawFile.bytes);
    entries.push({ ...expected.value, byteLength: bytes.byteLength });
    files.push({ ...expected.value, bytes });
  }
  return {
    ok: true,
    value: {
      bookId: input.bookId,
      candidateId: input.candidateId,
      ...(input.parentCandidateId === undefined ? {} : { parentCandidateId: input.parentCandidateId }),
      createdByRunId: input.createdByRunId,
      createdAt: input.createdAt,
      entries,
      files,
    },
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw cause;
  }
}

class FileCandidateStore implements CandidateStore {
  readonly #booksRoot: string;
  readonly #writeLock: BookWriteLock;
  readonly #reader: ReturnType<typeof createBookContentReader>;
  readonly #seams: CandidateStoreSeams;

  constructor(options: CandidateStoreOptions) {
    this.#booksRoot = requireBooksRoot(options.booksRoot);
    this.#writeLock = options.writeLock;
    this.#seams = options.seams ?? {};
    this.#reader = createBookContentReader({
      booksRoot: this.#booksRoot,
      currentPointerStore: options.currentPointerStore,
      seams: this.#seams.reader,
    });
  }

  async stage(input: Readonly<{
    bookId: string;
    candidateId: string;
    parentCandidateId?: string;
    createdByRunId: string;
    expectedInventory: readonly PlannedArtifact[];
    files: readonly CandidateInputFile[];
    createdAt: string;
  }>): Promise<Result<CandidateManifest>> {
    const valid = validateStage(input);
    if (!valid.ok) return valid;
    const prepared = valid.value;
    const paths = candidatePaths(this.#booksRoot, prepared.bookId, prepared.candidateId);
    try {
      if (await pathExists(paths.candidateRoot)) {
        return failed("CANDIDATE_EXISTS", `candidate already exists: ${prepared.candidateId}`);
      }
    } catch (cause) {
      return failed("CANDIDATE_IO", `candidate existence check failed: ${(cause as Error).message}`);
    }

    const metadata = {
      schemaVersion: "1" as const,
      bookId: prepared.bookId,
      candidateId: prepared.candidateId,
      ...(prepared.parentCandidateId === undefined ? {} : { parentCandidateId: prepared.parentCandidateId }),
      createdByRunId: prepared.createdByRunId,
      entries: prepared.entries,
      createdAt: prepared.createdAt,
    };
    let manifest: CandidateManifest;
    try {
      manifest = { ...metadata, manifestDigest: candidateManifestDigest(metadata, prepared.files) };
    } catch (cause) {
      return failed("CANDIDATE_INVALID", `candidate checksum input invalid: ${(cause as Error).message}`);
    }

    let stagedPath: string;
    try {
      await ensureDirectoryWithinBooksRoot(
        this.#booksRoot,
        bookPaths(this.#booksRoot, prepared.bookId).candidatesRoot,
      );
      const suffix = this.#seams.tempSuffix?.() ?? randomBytes(8).toString("hex");
      stagedPath = await mkdtemp(join(bookPaths(this.#booksRoot, prepared.bookId).candidatesRoot, `.${prepared.candidateId}.tmp-${suffix}-`));
      const stagedContent = join(stagedPath, "content");
      await mkdir(stagedContent);
      for (const file of prepared.files) {
        this.#seams.point?.("candidate.before-content", file.logicalPath);
        const destination = contentPath(stagedContent, file.logicalPath);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, file.bytes, { flag: "wx", mode: 0o600 });
        this.#seams.point?.("candidate.after-content", file.logicalPath);
      }
      this.#seams.point?.("candidate.before-manifest");
      await writeFile(join(stagedPath, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      this.#seams.point?.("candidate.after-manifest");
    } catch (cause) {
      return failed("CANDIDATE_IO", `candidate preparation failed: ${(cause as Error).message}`);
    }

    let finalized = false;
    const result = await this.#writeLock.run<CandidateManifest>(prepared.bookId, async () => {
      try {
        if (await pathExists(paths.candidateRoot)) {
          return failed("CANDIDATE_EXISTS", `candidate already exists: ${prepared.candidateId}`);
        }
        await finalizeCandidateDirectory(stagedPath, paths.candidateRoot, this.#seams.atomic);
        finalized = true;
        return { ok: true, value: manifest };
      } catch (cause) {
        return failed("CANDIDATE_IO", `candidate finalization failed: ${(cause as Error).message}`);
      }
    });
    if (!finalized && !result.ok && (result.error.code === "CANDIDATE_EXISTS" || result.error.code === "LOCK_BUSY")) {
      await rm(stagedPath, { recursive: true, force: true }).catch(() => undefined);
    }
    return result;
  }

  open(input: Readonly<{ bookId: string; selector: CandidateSelector }>): Promise<Result<CandidateSnapshot>> {
    return this.#reader.open(input);
  }
}

export function createCandidateStore(options: CandidateStoreOptions): CandidateStore {
  return new FileCandidateStore(options);
}

export type {
  CandidateEntry,
  CandidateInputFile,
  CandidateManifest,
  CandidateSelector,
  CandidateSnapshot,
  CandidateStore,
} from "./candidateTypes.js";
