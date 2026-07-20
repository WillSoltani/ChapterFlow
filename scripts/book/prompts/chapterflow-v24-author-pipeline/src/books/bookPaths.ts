import { isAbsolute, resolve, sep } from "node:path";

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
