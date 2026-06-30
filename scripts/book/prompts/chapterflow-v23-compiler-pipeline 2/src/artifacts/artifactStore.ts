import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { CANONICAL_STATE, normSlug } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import type { CompilerRunRecord, SectionKind } from "./artifactTypes.js";
import { V23_COMPILER_SCHEMA_VERSION } from "./artifactTypes.js";

export type CompilerStoreRoots = {
  stateRoot?: string;
};

const DEFAULT_RUN_ID = "v23-current";

export function compilerBookRoot(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(roots.stateRoot ?? CANONICAL_STATE, "books", normSlug(bookId));
}

export function compilerCurrentRunPath(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(compilerBookRoot(bookId, roots), "current-run.json");
}

export function compilerRunRoot(bookId: string, runIdOrRoots?: string | CompilerStoreRoots, maybeRoots: CompilerStoreRoots = {}): string {
  const runId = typeof runIdOrRoots === "string" ? runIdOrRoots : currentRunId(bookId, runIdOrRoots ?? {});
  const roots = typeof runIdOrRoots === "string" ? maybeRoots : runIdOrRoots ?? {};
  return resolve(compilerBookRoot(bookId, roots), "runs", runId);
}

export function currentRunId(bookId: string, roots: CompilerStoreRoots = {}): string {
  const p = compilerCurrentRunPath(bookId, roots);
  if (existsSync(p)) {
    try {
      const rec = JSON.parse(readFileSync(p, "utf8")) as Partial<CompilerRunRecord>;
      if (rec?.runId) return rec.runId;
    } catch {
      /* recreate below */
    }
  }
  return DEFAULT_RUN_ID;
}

export function ensureCompilerRun(bookId: string, roots: CompilerStoreRoots = {}): CompilerRunRecord {
  const normalized = normSlug(bookId);
  const currentPath = compilerCurrentRunPath(normalized, roots);
  mkdirSync(dirname(currentPath), { recursive: true });
  let rec: CompilerRunRecord | null = null;
  if (existsSync(currentPath)) {
    try {
      const parsed = JSON.parse(readFileSync(currentPath, "utf8"));
      if (parsed?.schemaVersion === V23_COMPILER_SCHEMA_VERSION && parsed?.bookId === normalized && parsed?.runId) {
        rec = parsed as CompilerRunRecord;
      }
    } catch {
      rec = null;
    }
  }
  if (!rec) {
    rec = {
      schemaVersion: V23_COMPILER_SCHEMA_VERSION,
      bookId: normalized,
      runId: DEFAULT_RUN_ID,
      createdAt: new Date().toISOString(),
      architecture: "compiler",
      finalChapterSchema: "chapterflow-v21-authored",
    };
    writeFileAtomic(currentPath, JSON.stringify(rec, null, 2) + "\n");
  }
  mkdirSync(compilerRunRoot(normalized, rec.runId, roots), { recursive: true });
  return rec;
}

export function artifactDir(bookId: string, stage: string, roots: CompilerStoreRoots = {}): string {
  const rec = ensureCompilerRun(bookId, roots);
  const dir = resolve(compilerRunRoot(bookId, rec.runId, roots), stage);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sourcePacketPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "source-packets", roots), `ch${String(chapterNumber).padStart(2, "0")}.source-packet.json`);
}

export function blueprintPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "blueprints", roots), `ch${String(chapterNumber).padStart(2, "0")}.blueprint.json`);
}

export function sectionDir(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  const dir = resolve(artifactDir(bookId, "sections", roots), `ch${String(chapterNumber).padStart(2, "0")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sectionPath(bookId: string, chapterNumber: number, kind: SectionKind, roots: CompilerStoreRoots = {}): string {
  return resolve(sectionDir(bookId, chapterNumber, roots), `${kind}.json`);
}

export function sectionTaskDir(bookId: string, roots: CompilerStoreRoots = {}): string {
  const dir = resolve(artifactDir(bookId, "tasks", roots), "sections");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sectionTaskPath(bookId: string, chapterNumber: number, kind: SectionKind, roots: CompilerStoreRoots = {}): string {
  return resolve(sectionTaskDir(bookId, roots), `ch${String(chapterNumber).padStart(2, "0")}.${kind}.md`);
}

export function evidenceMapPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "evidence", roots), `ch${String(chapterNumber).padStart(2, "0")}.evidence-map.json`);
}

export function riskScorePath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "risk", roots), `ch${String(chapterNumber).padStart(2, "0")}.risk.json`);
}

export function bookRiskPath(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "risk", roots), `book-risk.json`);
}

export function assemblyInputPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "assembly", roots), `ch${String(chapterNumber).padStart(2, "0")}.assemble-input.json`);
}

export function readJsonFile<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, JSON.stringify(value, null, 2) + "\n");
}

export function existingSectionTaskPaths(bookId: string, roots: CompilerStoreRoots = {}): string[] {
  const dir = sectionTaskDir(bookId, roots);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => resolve(dir, f));
}

export function writeTextFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}
