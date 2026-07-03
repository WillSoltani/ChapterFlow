import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { findRunArtifact } from "../lib/runDirs.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const REPO_ROOT = resolve(__dirname, "../..");
const RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow/runs");

export function sourceSidecarRelPath(chapterNumber: number): string {
  return `sidecars/source/ch${String(chapterNumber).padStart(2, "0")}.source.json`;
}

export function findSourceSidecar(bookId: string, chapterNumber: number): string | null {
  return findRunArtifact(RUNS_ROOT, bookId, sourceSidecarRelPath(chapterNumber));
}
