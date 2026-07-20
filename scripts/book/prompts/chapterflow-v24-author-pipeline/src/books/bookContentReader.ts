import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import type { Result } from "../contracts/v4Core.js";
import { candidateManifestDigest } from "./candidateDigest.js";
import {
  ARTIFACT_KINDS,
  ARTIFACT_MEDIA_TYPES,
  type BookContentReader,
  type CandidateEntry,
  type CandidateManifest,
  type CandidateSelector,
  type CandidateSnapshot,
} from "./candidateTypes.js";
import { candidatePaths, contentPath, requireBooksRoot, requireLogicalPath, requirePathId } from "./bookPaths.js";
import type { CurrentPointerStore } from "./currentPointer.js";

export interface BookContentReaderSeams {
  readonly point?: (name: "reader.after-pointer" | "reader.after-manifest" | "reader.after-content") => void;
}

export interface BookContentReaderOptions {
  readonly booksRoot: string;
  readonly currentPointerStore: CurrentPointerStore;
  readonly seams?: BookContentReaderSeams;
}

const ENTRY_KEYS = ["byteLength", "kind", "logicalPath", "mediaType"];
const MANIFEST_KEYS = ["bookId", "candidateId", "createdAt", "createdByRunId", "entries", "manifestDigest", "schemaVersion"];
const MANIFEST_PARENT_KEYS = [
  "bookId",
  "candidateId",
  "createdAt",
  "createdByRunId",
  "entries",
  "manifestDigest",
  "parentCandidateId",
  "schemaVersion",
];

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function byteCompare(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function sameOrderedStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return sameOrderedStrings(Object.keys(value).sort(), [...keys]);
}

function isCanonicalUtc(value: string): boolean {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isArtifactKind(value: unknown): value is CandidateEntry["kind"] {
  return typeof value === "string" && (ARTIFACT_KINDS as readonly string[]).includes(value);
}

function isArtifactMediaType(value: unknown): value is CandidateEntry["mediaType"] {
  return typeof value === "string" && (ARTIFACT_MEDIA_TYPES as readonly string[]).includes(value);
}

function parseManifest(value: unknown, bookId: string, candidateId: string): Result<CandidateManifest> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return failed("CANDIDATE_MISMATCH", "candidate manifest must be an object");
  }
  const record = value as Record<string, unknown>;
  const expectedKeys = record.parentCandidateId === undefined ? MANIFEST_KEYS : MANIFEST_PARENT_KEYS;
  if (!exactKeys(record, expectedKeys)) {
    return failed("CANDIDATE_MISMATCH", "candidate manifest fields do not match schema 1");
  }
  if (
    record.schemaVersion !== "1" ||
    record.bookId !== bookId ||
    record.candidateId !== candidateId ||
    typeof record.createdByRunId !== "string" ||
    record.createdByRunId.length === 0 ||
    typeof record.createdAt !== "string" ||
    !isCanonicalUtc(record.createdAt) ||
    typeof record.manifestDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.manifestDigest) ||
    !Array.isArray(record.entries)
  ) {
    return failed("CANDIDATE_MISMATCH", "candidate manifest values do not match schema 1");
  }
  try {
    if (record.parentCandidateId !== undefined) {
      if (typeof record.parentCandidateId !== "string") throw new Error("parentCandidateId must be a string");
      requirePathId(record.parentCandidateId, "candidateId");
    }
  } catch (cause) {
    return failed("CANDIDATE_MISMATCH", (cause as Error).message);
  }

  const entries: CandidateEntry[] = [];
  const seen = new Set<string>();
  for (const [index, valueEntry] of record.entries.entries()) {
    if (!valueEntry || typeof valueEntry !== "object" || Array.isArray(valueEntry)) {
      return failed("CANDIDATE_MISMATCH", `candidate entry ${index} must be an object`);
    }
    const entry = valueEntry as Record<string, unknown>;
    if (
      !exactKeys(entry, ENTRY_KEYS) ||
      !isArtifactKind(entry.kind) ||
      !isArtifactMediaType(entry.mediaType) ||
      typeof entry.logicalPath !== "string" ||
      !Number.isSafeInteger(entry.byteLength) ||
      (entry.byteLength as number) < 0
    ) {
      return failed("CANDIDATE_MISMATCH", `candidate entry ${index} does not match schema 1`);
    }
    try {
      requireLogicalPath(entry.logicalPath);
    } catch (cause) {
      return failed("CANDIDATE_MISMATCH", `candidate entry ${index}: ${(cause as Error).message}`);
    }
    if (seen.has(entry.logicalPath)) {
      return failed("CANDIDATE_MISMATCH", `duplicate candidate logicalPath: ${entry.logicalPath}`);
    }
    seen.add(entry.logicalPath);
    entries.push(entry as unknown as CandidateEntry);
  }

  return {
    ok: true,
    value: {
      schemaVersion: "1",
      bookId,
      candidateId,
      ...(record.parentCandidateId === undefined ? {} : { parentCandidateId: record.parentCandidateId as string }),
      createdByRunId: record.createdByRunId,
      entries,
      manifestDigest: record.manifestDigest,
      createdAt: record.createdAt,
    },
  };
}

interface TreeInventory {
  readonly files: readonly string[];
  readonly directories: readonly string[];
}

async function inventoryTree(root: string): Promise<Result<TreeInventory>> {
  const files: string[] = [];
  const directories: string[] = [];
  const visit = async (directory: string): Promise<Result<null>> => {
    let children;
    try {
      children = await readdir(directory, { withFileTypes: true });
    } catch (cause) {
      return failed("CANDIDATE_MISMATCH", `candidate content inventory unreadable: ${(cause as Error).message}`);
    }
    children.sort((left, right) => byteCompare(left.name, right.name));
    for (const child of children) {
      const absolute = resolve(directory, child.name);
      const logicalPath = relative(root, absolute).split(sep).join("/");
      if (child.isDirectory()) {
        directories.push(logicalPath);
        const nested = await visit(absolute);
        if (!nested.ok) return nested;
      } else if (child.isFile()) {
        files.push(logicalPath);
      } else {
        return failed("CANDIDATE_MISMATCH", `candidate content contains non-regular entry: ${logicalPath}`);
      }
    }
    return { ok: true, value: null };
  };
  const visited = await visit(root);
  if (!visited.ok) return visited;
  return {
    ok: true,
    value: { files: files.sort(byteCompare), directories: directories.sort(byteCompare) },
  };
}

function expectedDirectories(paths: readonly string[]): string[] {
  const directories = new Set<string>();
  for (const path of paths) {
    const segments = path.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      directories.add(segments.slice(0, index).join("/"));
    }
  }
  return [...directories].sort(byteCompare);
}

async function requireCandidateLayout(candidateRoot: string): Promise<Result<null>> {
  let children;
  try {
    children = await readdir(candidateRoot, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      return failed("CANDIDATE_NOT_FOUND", `candidate not found: ${candidateRoot}`);
    }
    return failed("CANDIDATE_IO", `candidate directory read failed: ${(cause as Error).message}`);
  }
  const names = children.map((child) => child.name).sort(byteCompare);
  if (!sameOrderedStrings(names, ["content", "manifest.json"])) {
    return failed("CANDIDATE_MISMATCH", "candidate root inventory must contain only content and manifest.json");
  }
  const content = children.find((child) => child.name === "content");
  const manifest = children.find((child) => child.name === "manifest.json");
  if (!content?.isDirectory() || !manifest?.isFile()) {
    return failed("CANDIDATE_MISMATCH", "candidate root contains invalid content or manifest entry type");
  }
  return { ok: true, value: null };
}

class PureBookContentReader implements BookContentReader {
  readonly #booksRoot: string;
  readonly #currentPointerStore: CurrentPointerStore;
  readonly #seams: BookContentReaderSeams;

  constructor(options: BookContentReaderOptions) {
    this.#booksRoot = requireBooksRoot(options.booksRoot);
    this.#currentPointerStore = options.currentPointerStore;
    this.#seams = options.seams ?? {};
  }

  async open(input: Readonly<{ bookId: string; selector: CandidateSelector }>): Promise<Result<CandidateSnapshot>> {
    try {
      requirePathId(input.bookId, "bookId");
    } catch (cause) {
      return failed("INVALID_BOOK_ID", (cause as Error).message);
    }
    let candidateId: string;
    let expectedDigest: string | undefined;
    let currentRevision: number | undefined;
    if (input.selector?.kind === "CURRENT") {
      const current = await this.#currentPointerStore.read(input.bookId);
      if (!current.ok) return current;
      if (!current.value) return failed("CURRENT_NOT_SET", `current pointer is not set for ${input.bookId}`);
      candidateId = current.value.candidateId;
      expectedDigest = current.value.manifestDigest;
      currentRevision = current.value.revision;
      this.#seams.point?.("reader.after-pointer");
    } else if (input.selector?.kind === "CANDIDATE" && typeof input.selector.candidateId === "string") {
      candidateId = input.selector.candidateId;
    } else {
      return failed("INVALID_SELECTOR", "candidate selector must be CANDIDATE or CURRENT");
    }
    try {
      requirePathId(candidateId, "candidateId");
    } catch (cause) {
      return failed("INVALID_SELECTOR", (cause as Error).message);
    }

    const paths = candidatePaths(this.#booksRoot, input.bookId, candidateId);
    const layout = await requireCandidateLayout(paths.candidateRoot);
    if (!layout.ok) return layout;

    let manifestJson: unknown;
    try {
      const manifestStat = await lstat(paths.manifest);
      const contentStat = await lstat(paths.contentRoot);
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || !contentStat.isDirectory() || contentStat.isSymbolicLink()) {
        return failed("CANDIDATE_MISMATCH", "candidate manifest/content types are invalid");
      }
      manifestJson = JSON.parse(await readFile(paths.manifest, "utf8"));
    } catch (cause) {
      return failed("CANDIDATE_MISMATCH", `candidate manifest is unreadable or corrupt: ${(cause as Error).message}`);
    }
    const manifestResult = parseManifest(manifestJson, input.bookId, candidateId);
    if (!manifestResult.ok) return manifestResult;
    const manifest = manifestResult.value;
    this.#seams.point?.("reader.after-manifest");

    const inventory = await inventoryTree(paths.contentRoot);
    if (!inventory.ok) return inventory;
    const declaredPaths = manifest.entries.map((entry) => entry.logicalPath);
    const sortedDeclaredPaths = [...declaredPaths].sort(byteCompare);
    if (!sameOrderedStrings(inventory.value.files, sortedDeclaredPaths)) {
      return failed("CANDIDATE_MISMATCH", "candidate file inventory differs from manifest");
    }
    if (!sameOrderedStrings(inventory.value.directories, expectedDirectories(declaredPaths))) {
      return failed("CANDIDATE_MISMATCH", "candidate directory inventory differs from manifest");
    }

    const files: Array<CandidateEntry & { bytes: Uint8Array }> = [];
    for (const entry of manifest.entries) {
      try {
        const path = contentPath(paths.contentRoot, entry.logicalPath);
        const stat = await lstat(path);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          return failed("CANDIDATE_MISMATCH", `declared candidate entry is not a regular file: ${entry.logicalPath}`);
        }
        const bytes = await readFile(path);
        if (bytes.byteLength !== entry.byteLength) {
          return failed("CANDIDATE_MISMATCH", `candidate byteLength differs at ${entry.logicalPath}`);
        }
        files.push({ ...entry, bytes: Buffer.from(bytes) });
      } catch (cause) {
        return failed("CANDIDATE_MISMATCH", `declared candidate entry unreadable: ${(cause as Error).message}`);
      }
    }
    this.#seams.point?.("reader.after-content");

    let digest: string;
    try {
      const { manifestDigest: _stored, ...metadata } = manifest;
      digest = candidateManifestDigest(metadata, files);
    } catch (cause) {
      return failed("CANDIDATE_MISMATCH", `candidate checksum could not be computed: ${(cause as Error).message}`);
    }
    if (digest !== manifest.manifestDigest || (expectedDigest !== undefined && digest !== expectedDigest)) {
      return failed("CANDIDATE_MISMATCH", "candidate manifestDigest verification failed");
    }
    return {
      ok: true,
      value: {
        manifest,
        files,
        ...(currentRevision === undefined ? {} : { currentRevision }),
      },
    };
  }
}

export function createBookContentReader(options: BookContentReaderOptions): BookContentReader {
  return new PureBookContentReader(options);
}

export type { BookContentReader, CandidateSelector, CandidateSnapshot } from "./candidateTypes.js";
