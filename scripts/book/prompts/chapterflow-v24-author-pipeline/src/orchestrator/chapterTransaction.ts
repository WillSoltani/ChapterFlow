/**
 * chapterTransaction — conductor-owned candidate → compare-and-swap canonical
 * commit for whole-chapter content work (IMP-01; F-001 P0, F-020 P0; master
 * plan §8.8; consumes the frozen `candidate-transaction` v1 contract).
 *
 * The pre-IMP-01 flow asked author/repair agents to write the CANONICAL
 * chapter path directly (workspace-write at the pipeline root), then validated
 * whatever landed and byte-restored on failure. That exposed three windows the
 * `range` campaign hit live: concurrent readers parsing a half-saved file
 * (conductor crash + six orphaned writers), failed drafts standing in for
 * reviewed bytes until restore, and restore itself failing (F6).
 *
 * New protocol (the plan's qualified isolated-writable fallback):
 *
 *   1. mint an immutable ATTEMPT: identity + expected canonical base hash +
 *      an attempt-scoped workspace (the agent's cwd — the ONLY writable dir);
 *   2. the agent writes exactly ONE file there: the candidate chapter JSON
 *      (repair attempts get the workspace pre-seeded with the original bytes);
 *   3. the conductor imports the candidate (size cap, JSON parse, identity),
 *      rejects unexpected workspace writes, and validates ENTIRELY in memory /
 *      against candidate bytes — gate composite with COMMITTED siblings as
 *      context, rubric metrics with the candidate substituted into the book,
 *      write-contract checks — never exposing the candidate as canonical;
 *   4. commit is compare-and-swap: the canonical bytes must still hash to the
 *      attempt's expected base (both-absent counts as a match), then the
 *      replacement is one atomic rename. A mismatch is `stale_base` — never a
 *      rebase, never a last-writer-wins overwrite, never an auto-retry;
 *   5. a pending commit manifest brackets the swap so a crash between rename
 *      and bookkeeping recovers deterministically (finish or mark aborted);
 *   6. failed / malformed / stale attempts leave canonical bytes untouched —
 *      the old restore lane is structurally unnecessary (nothing to restore).
 *
 * Canonical reads/writes go through the caller-supplied IO seam (the same
 * `AuthorIo` functions tests already inject), so fixture-rooted tests and the
 * bakeoff's slot-rooted candidates keep working unchanged.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";

import type { ChapterV21 } from "../types.js";
import { REPO_ROOT, chapterFileName } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { sha256Hex } from "../contracts/contractUtil.js";
import type { AttemptIdentityV1, AttemptKindV1, CandidateOutcomeV1, CommitManifestV1 } from "../contracts/candidateTransaction.js";
import { runChapterGateComposite } from "../critics/chapterGateComposite.js";

/** Attempt evidence root — pipeline-local, gitignored, EXCLUDED from chapter
 *  enumeration by construction (nothing under state/). */
export const ATTEMPTS_ROOT = resolve(REPO_ROOT, ".attempts");

/** Candidate byte ceiling. Real ChapterV21 files run ~40–90 KB; 2 MB flags a
 *  runaway/duplicated output as `truncated_output`-class garbage, not content. */
export const CANDIDATE_MAX_BYTES = 2 * 1024 * 1024;

/** The minimal canonical-IO seam the transaction needs (structurally a subset
 *  of AuthorIo, so callers pass their existing io object straight through). */
export type ChapterCanonicalIo = {
  readChapterFile: (bookId: string, chapterNumber: number) => string | null;
  writeChapterFile: (bookId: string, chapterNumber: number, bytes: string) => void;
};

export type ChapterAttempt = {
  identity: AttemptIdentityV1;
  attemptDir: string;
  /** The agent's cwd — its ONLY writable directory (codex workspace-write). */
  workspaceDir: string;
  candidateFileName: string;
  candidatePath: string;
};

export type MintAttemptOptions = {
  bookId: string;
  chapterNumber: number;
  chapterId: string;
  attemptKind: AttemptKindV1;
  attemptSequence: number;
  designLineage?: string;
  executionProfileHash?: string;
  promptSha256: string;
  inputHashes?: Record<string, string>;
  io: ChapterCanonicalIo;
  /** Pre-seed the workspace candidate with these bytes (surgical repair edits
   *  a COPY of the original — never the canonical file). */
  seedBytes?: string;
  /** Override the attempts root (tests use tmp roots). */
  attemptsRoot?: string;
};

let attemptCounter = 0;

/** Mint one immutable attempt: identity + expected canonical base + workspace. */
export function mintChapterAttempt(opts: MintAttemptOptions): ChapterAttempt {
  const nn = String(opts.chapterNumber).padStart(2, "0");
  const root = opts.attemptsRoot ?? ATTEMPTS_ROOT;
  const currentBytes = opts.io.readChapterFile(opts.bookId, opts.chapterNumber);
  const expectedBaseSha256 = currentBytes === null ? null : sha256Hex(currentBytes);
  const chapterRoot = join(root, opts.bookId, `ch${nn}`);
  recoverIncompleteCommits(chapterRoot, opts.io, opts.bookId, opts.chapterNumber);
  const attemptId = `${opts.bookId}-ch${nn}-${opts.attemptKind}-${opts.attemptSequence}-${Date.now().toString(36)}-${(attemptCounter++).toString(36)}-${process.pid.toString(36)}`;
  const attemptDir = join(chapterRoot, attemptId);
  const workspaceDir = join(attemptDir, "workspace");
  mkdirSync(workspaceDir, { recursive: true, mode: 0o700 });
  const candidateFileName = chapterFileName(opts.chapterId);
  const identity: AttemptIdentityV1 = {
    schema: "attempt-identity-v1",
    attemptId,
    bookId: opts.bookId,
    chapterNumber: opts.chapterNumber,
    designLineage: opts.designLineage ?? "",
    attemptKind: opts.attemptKind,
    attemptSequence: opts.attemptSequence,
    executionProfileHash: opts.executionProfileHash ?? "",
    promptSha256: opts.promptSha256,
    inputHashes: opts.inputHashes ?? {},
    outputSchemaVersion: "chapterflow-v21-authored",
    expectedBaseSha256,
    expectedBaseGeneration: countCommits(chapterRoot),
  };
  writeFileSync(join(attemptDir, "attempt.json"), JSON.stringify(identity, null, 2) + "\n");
  const candidatePath = join(workspaceDir, candidateFileName);
  if (opts.seedBytes !== undefined) writeFileSync(candidatePath, opts.seedBytes);
  return { identity, attemptDir, workspaceDir, candidateFileName, candidatePath };
}

export type CandidateImport =
  | { ok: true; bytes: string; chapter: ChapterV21; sha256: string }
  | { ok: false; outcome: CandidateOutcomeV1; reason: string };

/** Read + structurally admit the candidate the agent left in its workspace. */
export function importCandidate(attempt: ChapterAttempt): CandidateImport {
  if (!existsSync(attempt.candidatePath)) {
    return { ok: false, outcome: "validation_failed", reason: `no candidate file written (${attempt.candidateFileName})` };
  }
  let size = 0;
  try { size = statSync(attempt.candidatePath).size; } catch { /* handled by read below */ }
  if (size > CANDIDATE_MAX_BYTES) {
    return { ok: false, outcome: "malformed_output", reason: `candidate is ${size} bytes (> ${CANDIDATE_MAX_BYTES} cap) — runaway output rejected` };
  }
  let bytes: string;
  try {
    bytes = readFileSync(attempt.candidatePath, "utf8");
  } catch (err) {
    return { ok: false, outcome: "infrastructure_failure", reason: `candidate unreadable: ${(err as Error).message}` };
  }
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(bytes) as ChapterV21;
  } catch (err) {
    return { ok: false, outcome: "malformed_output", reason: `candidate is not valid JSON (${(err as Error).message.split("\n")[0]})` };
  }
  const expectedId = attempt.candidateFileName.replace(/\.v21-native\.chapter\.json$/i, "");
  if ((chapter.chapterId ?? "") !== expectedId) {
    return { ok: false, outcome: "validation_failed", reason: `candidate chapterId "${chapter.chapterId}" != expected "${expectedId}" (wrong-identity output rejected)` };
  }
  return { ok: true, bytes, chapter, sha256: sha256Hex(bytes) };
}

/** Any workspace entry besides the candidate file is an unexpected write —
 *  first-class attempt failure, never silently tolerated (F-020). */
export function unexpectedAttemptWrites(attempt: ChapterAttempt): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    let entries;
    try { entries = readdirSync(join(attempt.workspaceDir, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const relPath = rel === "" ? e.name : join(rel, e.name);
      if (e.isDirectory()) walk(relPath);
      else if (relPath !== attempt.candidateFileName) out.push(relPath);
    }
  };
  walk("");
  return out.sort();
}

/** Gate the candidate with COMMITTED siblings as context. The sibling-context
 *  path is the chapter's canonical home (so the candidate is compared against
 *  the committed book and its own committed bytes are excluded); the attempt
 *  key keeps the CLI-era per-chapter gate history continuous. */
export async function gateCandidate(
  candidate: ChapterV21,
  canonicalAbsPath: string,
  attemptKey: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const r = await runChapterGateComposite(candidate, canonicalAbsPath, attemptKey);
  return r.crashed ? { code: 1, stdout: "", stderr: r.report } : { code: r.exitCode, stdout: r.report, stderr: "" };
}

/** Rubric metrics with the candidate SUBSTITUTED into the committed book —
 *  byte-compatible stdout with the `rubric-metrics` verb (same formatter), so
 *  callers keep their existing chNN-verdict-line parsing. */
export async function rubricMetricsWithCandidate(
  bookId: string,
  chapterNumber: number,
  candidate: ChapterV21,
  loadChapters: (bookId: string) => ChapterV21[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { computeBookRubricMetrics, formatRubricMetrics } = await import("../metrics/bookRubricMetrics.js");
    let siblings: ChapterV21[] = [];
    try { siblings = loadChapters(bookId).filter((c) => c.number !== chapterNumber); } catch { siblings = []; }
    const report = computeBookRubricMetrics(bookId, { chapters: [...siblings, candidate] });
    return { code: 0, stdout: formatRubricMetrics(report), stderr: "" };
  } catch (err) {
    return { code: 1, stdout: "", stderr: `rubric-metrics (candidate): ${(err as Error).message}` };
  }
}

export type CommitResult =
  | { ok: true; committedSha256: string; commitManifestPath: string }
  | { ok: false; outcome: "stale_base"; reason: string };

/** Compare-and-swap commit: canonical must still hash to the attempt's expected
 *  base; the replacement is one atomic write through the caller's IO seam. A
 *  pending manifest brackets the swap for deterministic crash recovery. */
export function commitChapterCandidate(args: {
  attempt: ChapterAttempt;
  bytes: string;
  io: ChapterCanonicalIo;
  /** Evidence identifiers this commit invalidates (reviews/acceptance) — recorded
   *  in the manifest; actual invalidation stays with the existing callers. */
  invalidated?: string[];
}): CommitResult {
  const { attempt, bytes, io } = args;
  const { bookId, chapterNumber, expectedBaseSha256 } = attempt.identity;
  const currentBytes = io.readChapterFile(bookId, chapterNumber);
  const currentSha = currentBytes === null ? null : sha256Hex(currentBytes);
  if (currentSha !== expectedBaseSha256) {
    const manifest = buildCommitManifest(attempt, currentSha, sha256Hex(bytes), args.invalidated ?? [], "aborted_stale_base");
    try { writeFileSync(join(attempt.attemptDir, "commit-manifest.json"), JSON.stringify(manifest, null, 2) + "\n"); } catch { /* evidence best-effort */ }
    return {
      ok: false,
      outcome: "stale_base",
      reason:
        `canonical ${bookId} ch${String(chapterNumber).padStart(2, "0")} changed under this attempt ` +
        `(expected base ${expectedBaseSha256?.slice(0, 12) ?? "<absent>"}, found ${currentSha?.slice(0, 12) ?? "<absent>"}) — ` +
        `stale attempt loses; no overwrite, no auto-retry (bounded policy owns any retry)`,
    };
  }
  const committedSha256 = sha256Hex(bytes);
  const manifest = buildCommitManifest(attempt, currentSha, committedSha256, args.invalidated ?? [], "pending");
  const manifestPath = join(attempt.attemptDir, "commit-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  io.writeChapterFile(bookId, chapterNumber, bytes);
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, phase: "committed" }, null, 2) + "\n");
  return { ok: true, committedSha256, commitManifestPath: manifestPath };
}

type PhasedCommitManifest = CommitManifestV1 & { phase: "pending" | "committed" | "aborted_stale_base" | "aborted_recovered" };

function buildCommitManifest(
  attempt: ChapterAttempt,
  previousSha256: string | null,
  committedSha256: string,
  invalidated: string[],
  phase: PhasedCommitManifest["phase"],
): PhasedCommitManifest {
  return {
    schema: "commit-manifest-v1",
    attemptId: attempt.identity.attemptId,
    bookId: attempt.identity.bookId,
    chapterNumber: attempt.identity.chapterNumber,
    previousSha256,
    committedSha256,
    committedGeneration: attempt.identity.expectedBaseGeneration + 1,
    invalidated,
    committedAtIso: new Date().toISOString(),
    phase,
  };
}

/** Deterministic idempotent recovery: a `pending` manifest means a crash landed
 *  between the swap bracket writes. If canonical already holds the committed
 *  bytes, finish the bracket; otherwise the swap never happened — mark aborted.
 *  Called on every mint for the same chapter, and exported for direct use. */
export function recoverIncompleteCommits(
  chapterRoot: string,
  io: ChapterCanonicalIo,
  bookId: string,
  chapterNumber: number,
): Array<{ attemptId: string; resolution: "committed" | "aborted_recovered" }> {
  const resolutions: Array<{ attemptId: string; resolution: "committed" | "aborted_recovered" }> = [];
  let entries: string[] = [];
  try { entries = readdirSync(chapterRoot); } catch { return resolutions; }
  for (const attemptId of entries) {
    const manifestPath = join(chapterRoot, attemptId, "commit-manifest.json");
    let manifest: PhasedCommitManifest;
    try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PhasedCommitManifest; } catch { continue; }
    if (manifest.phase !== "pending") continue;
    const currentBytes = io.readChapterFile(bookId, chapterNumber);
    const currentSha = currentBytes === null ? null : sha256Hex(currentBytes);
    const resolution = currentSha === manifest.committedSha256 ? "committed" : "aborted_recovered";
    try { writeFileSync(manifestPath, JSON.stringify({ ...manifest, phase: resolution }, null, 2) + "\n"); } catch { continue; }
    resolutions.push({ attemptId: manifest.attemptId, resolution });
  }
  return resolutions;
}

function countCommits(chapterRoot: string): number {
  let n = 0;
  let entries: string[] = [];
  try { entries = readdirSync(chapterRoot); } catch { return 0; }
  for (const attemptId of entries) {
    try {
      const m = JSON.parse(readFileSync(join(chapterRoot, attemptId, "commit-manifest.json"), "utf8")) as PhasedCommitManifest;
      if (m.phase === "committed") n++;
    } catch { /* not a commit */ }
  }
  return n;
}

/** Record the attempt's terminal disposition; on success the workspace is
 *  removed (the candidate equals the canonical bytes), on failure the candidate
 *  is KEPT for forensics (IMP-10 owns durable evidence; this is the interim). */
export function finalizeAttempt(attempt: ChapterAttempt, outcome: CandidateOutcomeV1, detail?: string): void {
  try {
    writeFileSync(
      join(attempt.attemptDir, "outcome.json"),
      JSON.stringify({ schema: "attempt-outcome-v1", attemptId: attempt.identity.attemptId, outcome, detail: detail ?? "", atIso: new Date().toISOString() }, null, 2) + "\n",
    );
  } catch { /* evidence best-effort */ }
  if (outcome === "committed") {
    try { rmSync(attempt.workspaceDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

/** Bounded crash-net sweep for attempt debris. Refuses to remove attempts whose
 *  commit bracket is still `pending` (recovery owns those). Default 7 days. */
export function sweepStaleAttempts(opts: { attemptsRoot?: string; olderThanMs?: number; now?: number } = {}): string[] {
  const root = opts.attemptsRoot ?? ATTEMPTS_ROOT;
  const threshold = opts.olderThanMs ?? 7 * 24 * 60 * 60 * 1000;
  const now = opts.now ?? Date.now();
  const removed: string[] = [];
  let books: string[] = [];
  try { books = readdirSync(root); } catch { return removed; }
  for (const book of books) {
    let chapters: string[] = [];
    try { chapters = readdirSync(join(root, book)); } catch { continue; }
    for (const ch of chapters) {
      let attempts: string[] = [];
      try { attempts = readdirSync(join(root, book, ch)); } catch { continue; }
      for (const attemptId of attempts) {
        const dir = join(root, book, ch, attemptId);
        try {
          if (now - statSync(dir).mtimeMs < threshold) continue;
          try {
            const m = JSON.parse(readFileSync(join(dir, "commit-manifest.json"), "utf8")) as PhasedCommitManifest;
            if (m.phase === "pending") continue; // recovery owns pending brackets
          } catch { /* no manifest — plain debris */ }
          rmSync(dir, { recursive: true, force: true });
          removed.push(dir);
        } catch { /* contended/gone */ }
      }
    }
  }
  return removed;
}

/** Atomic default for the canonical write seam (IMP-01 also upgrades the
 *  direct-write default in resolveAuthorIo to this — a plain writeFileSync at
 *  the canonical path was the torn-read wedge the plan's F-001 documents). */
export function atomicCanonicalWrite(absPath: string, bytes: string): void {
  writeFileAtomic(absPath, bytes);
}
