import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export class BookPathBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookPathBoundaryError";
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    if (character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f) return true;
  }
  return false;
}

export function requireBooksRoot(booksRoot: string): string {
  if (typeof booksRoot !== "string" || booksRoot.length === 0 || !isAbsolute(booksRoot) || booksRoot.includes("\0")) {
    throw new Error("booksRoot must be an absolute path");
  }
  return resolve(booksRoot);
}

export function requirePathId(value: string, label: "bookId" | "candidateId"): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    hasControlCharacter(value)
  ) {
    throw new Error(`${label} must be one safe opaque path segment`);
  }
  return value;
}

export function requireLogicalPath(value: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    hasControlCharacter(value)
  ) {
    throw new Error("logicalPath must be a safe relative POSIX path");
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error("logicalPath must not contain empty, dot, or parent segments");
  }
  return value;
}

function assertWithin(root: string, child: string): string {
  if (child !== root && !child.startsWith(`${root}${sep}`)) {
    throw new Error(`resolved path escaped booksRoot: ${child}`);
  }
  return child;
}

function isWithin(root: string, child: string): boolean {
  return child === root || child.startsWith(`${root}${sep}`);
}

async function canonicalRoot(booksRootInput: string): Promise<{ readonly path: string; readonly real: string }> {
  const path = requireBooksRoot(booksRootInput);
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new BookPathBoundaryError(`booksRoot must be a real directory: ${path}`);
  }
  return { path, real: await realpath(path) };
}

async function assertExistingDirectoryChain(
  booksRootInput: string,
  directoryInput: string,
): Promise<{ readonly rootReal: string; readonly directory: string }> {
  const root = await canonicalRoot(booksRootInput);
  const directory = assertWithin(root.path, resolve(directoryInput));
  const segments = relative(root.path, directory).split(sep).filter(Boolean);
  let current = root.path;
  for (const segment of segments) {
    current = resolve(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new BookPathBoundaryError(`storage ancestor must be a real directory: ${current}`);
    }
  }
  const directoryReal = await realpath(directory);
  if (!isWithin(root.real, directoryReal)) {
    throw new BookPathBoundaryError(`storage path escaped canonical booksRoot: ${directory}`);
  }
  return { rootReal: root.real, directory };
}

export async function assertDirectoryWithinBooksRoot(booksRoot: string, directory: string): Promise<void> {
  await assertExistingDirectoryChain(booksRoot, directory);
}

export async function ensureDirectoryWithinBooksRoot(booksRootInput: string, directoryInput: string): Promise<void> {
  const root = await canonicalRoot(booksRootInput);
  const directory = assertWithin(root.path, resolve(directoryInput));
  const segments = relative(root.path, directory).split(sep).filter(Boolean);
  let current = root.path;
  let missing = false;
  for (const segment of segments) {
    current = resolve(current, segment);
    if (missing) continue;
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new BookPathBoundaryError(`storage ancestor must be a real directory: ${current}`);
      }
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
      missing = true;
    }
  }
  await mkdir(directory, { recursive: true });
  await assertExistingDirectoryChain(root.path, directory);
}

export async function readRegularFileWithinBooksRoot(booksRoot: string, filePathInput: string): Promise<Buffer> {
  const filePath = resolve(filePathInput);
  const parent = await assertExistingDirectoryChain(booksRoot, dirname(filePath));
  const initialStat = await lstat(filePath);
  if (initialStat.isSymbolicLink() || !initialStat.isFile()) {
    throw new BookPathBoundaryError(`storage file must be regular and non-symlink: ${filePath}`);
  }
  let handle;
  try {
    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ELOOP") {
      throw new BookPathBoundaryError(`storage file must not be a symlink: ${filePath}`);
    }
    throw cause;
  }
  try {
    const openedStat = await handle.stat();
    if (!openedStat.isFile()) {
      throw new BookPathBoundaryError(`storage file must be regular: ${filePath}`);
    }
    const pathStat = await lstat(filePath);
    if (pathStat.isSymbolicLink() || !pathStat.isFile()) {
      throw new BookPathBoundaryError(`storage file must be regular and non-symlink: ${filePath}`);
    }
    if (openedStat.dev !== pathStat.dev || openedStat.ino !== pathStat.ino) {
      throw new BookPathBoundaryError(`storage file changed during no-follow open: ${filePath}`);
    }
    const fileReal = await realpath(filePath);
    if (!isWithin(parent.rootReal, fileReal)) {
      throw new BookPathBoundaryError(`storage file escaped canonical booksRoot: ${filePath}`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export interface BookPaths {
  readonly bookRoot: string;
  readonly locksRoot: string;
  readonly writeLock: string;
  readonly currentPointer: string;
  readonly candidatesRoot: string;
}

export interface CandidatePaths {
  readonly candidateRoot: string;
  readonly manifest: string;
  readonly contentRoot: string;
}

export function bookPaths(booksRootInput: string, bookIdInput: string): BookPaths {
  const booksRoot = requireBooksRoot(booksRootInput);
  const bookId = requirePathId(bookIdInput, "bookId");
  const bookRoot = assertWithin(booksRoot, resolve(booksRoot, bookId));
  const locksRoot = resolve(bookRoot, "locks");
  return {
    bookRoot,
    locksRoot,
    writeLock: resolve(locksRoot, "write.lock"),
    currentPointer: resolve(bookRoot, "current.json"),
    candidatesRoot: resolve(bookRoot, "candidates"),
  };
}

export function candidatePaths(booksRoot: string, bookId: string, candidateIdInput: string): CandidatePaths {
  const paths = bookPaths(booksRoot, bookId);
  const candidateId = requirePathId(candidateIdInput, "candidateId");
  const candidateRoot = assertWithin(paths.candidatesRoot, resolve(paths.candidatesRoot, candidateId));
  return {
    candidateRoot,
    manifest: resolve(candidateRoot, "manifest.json"),
    contentRoot: resolve(candidateRoot, "content"),
  };
}

export function contentPath(contentRoot: string, logicalPath: string): string {
  const safe = requireLogicalPath(logicalPath);
  return assertWithin(contentRoot, resolve(contentRoot, ...safe.split("/")));
}
