/**
 * Model bake-off — canonical promotion of the SELECTED winner.
 *
 * This is the run's ONLY crossing point into canonical state, and it happens
 * strictly AFTER selection:
 *
 *   1. fail-closed guards: a winner exists; its candidate chapters verify
 *      against their recorded content hashes; canonical state/chapters holds
 *      NO conflicting chapters for the book (byte-identical = idempotent
 *      resume; different bytes = refuse, never overwrite);
 *   2. copy the winner's chapter files into state/chapters/ (atomic per-file);
 *   3. BYTE-IDENTITY verification: read every promoted file back and compare
 *      byte-for-byte against the candidate source;
 *   4. stamp canonical author provenance from the winner's slot provenance
 *      (the real author sessions, bound to content hashes);
 *   5. write the durable bake-off provenance sidecar
 *      state/books/<bookId>.model-bakeoff.json (winner model/effort, run id,
 *      shared-input hashes, task-card hashes, all candidates' chapter hashes);
 *   6. the CALLER then re-runs the full deterministic preflight (qc-converge)
 *      and opens formal QC through the existing conductor — never here.
 *
 * Publication is NEVER performed here. Losing candidates are never touched.
 */

import { existsSync, mkdirSync, readFileSync } from "fs";
import { resolve } from "path";

import type { ChapterV21 } from "../types.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { CHAPTERS_DIR, chapterFileName, normSlug } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { authorChapterId } from "../orchestrator/authorRun.js";
import { recordAuthorProvenance } from "../qc/sessionProvenance.js";
import type { BakeoffManifestV1, CandidateSpec, CandidateStateV1, PromotionRecordV1 } from "./types.js";
import { PIPELINE_DIR, pipelineRel, sha256Hex, type BakeoffRoots } from "./paths.js";
import { slotChapterAbsPath } from "./candidates.js";

export class PromotionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromotionError";
  }
}

export type PromoteWinnerArgs = {
  bookId: string;
  manifest: BakeoffManifestV1;
  winner: CandidateSpec;
  winnerState: CandidateStateV1;
  roots: BakeoffRoots;
  candidateChapterHashes: Record<string, Record<string, string | null>>;
  log: (m: string) => void;
  /** Injectable for tests (default: real canonical provenance stamp). */
  stampProvenance?: (chapterId: string, sessionId: string, contentHash: string) => void;
  /** Injectable canonical chapters dir (tests use a tmp root). */
  chaptersDir?: string;
  /** Injectable sidecar path (default state/books/<bookId>.model-bakeoff.json). */
  sidecarPath?: string;
};

/** The canonical bake-off provenance sidecar path. */
export function bakeoffSidecarPath(bookId: string): string {
  return resolve(PIPELINE_DIR, "state", "books", `${normSlug(bookId)}.model-bakeoff.json`);
}

export function promoteWinner(args: PromoteWinnerArgs): PromotionRecordV1 {
  const { bookId, manifest, winner, winnerState, roots } = args;
  const chaptersDir = args.chaptersDir ?? CHAPTERS_DIR;
  const stamp = args.stampProvenance ?? ((chapterId: string, sessionId: string, contentHash: string) => {
    recordAuthorProvenance(chapterId, sessionId, contentHash);
  });
  const chapterNumbers = manifest.freeze?.chapterNumbers ?? [];
  if (chapterNumbers.length === 0) throw new PromotionError("no frozen chapter set — cannot promote");

  // 1a. Source verification: every winner chapter exists and hashes to the
  // recorded generation result (a drifted candidate is a fail-closed error).
  type Staged = { chapterNumber: number; chapterId: string; src: string; dst: string; bytes: string; contentHash: string; authorSessionId: string };
  const staged: Staged[] = [];
  for (const n of chapterNumbers) {
    const rec = winnerState.chapters.find((c) => c.chapterNumber === n);
    if (!rec?.ok || !rec.contentSha256) throw new PromotionError(`winner ${winner.model} ch${n}: no verified generation record`);
    const src = slotChapterAbsPath(roots, winner.slot, bookId, n);
    if (!existsSync(src)) throw new PromotionError(`winner ${winner.model} ch${n}: candidate chapter missing at ${src}`);
    const bytes = readFileSync(src, "utf8");
    let parsed: ChapterV21;
    try {
      parsed = JSON.parse(bytes) as ChapterV21;
    } catch (err) {
      throw new PromotionError(`winner ${winner.model} ch${n}: unparseable candidate chapter (${(err as Error).message})`);
    }
    const contentHash = chapterContentHash(parsed);
    if (contentHash !== rec.contentSha256) {
      throw new PromotionError(`winner ${winner.model} ch${n}: candidate bytes drifted since generation (${rec.contentSha256.slice(0, 12)} → ${contentHash.slice(0, 12)}) — refusing to promote unverified content`);
    }
    const chapterId = authorChapterId(bookId, n);
    const lastOk = rec.attempts.filter((a) => a.ok).pop() ?? rec.attempts[rec.attempts.length - 1];
    staged.push({
      chapterNumber: n,
      chapterId,
      src,
      dst: resolve(chaptersDir, chapterFileName(chapterId)),
      bytes,
      contentHash,
      authorSessionId: lastOk?.sessionId ?? `bakeoff-${winner.slot}-unknown`,
    });
  }

  // 1b. Canonical collision guard: never overwrite different existing bytes.
  for (const s of staged) {
    if (existsSync(s.dst)) {
      const existing = readFileSync(s.dst, "utf8");
      if (existing !== s.bytes) {
        throw new PromotionError(
          `canonical ${pipelineRel(s.dst)} already holds DIFFERENT bytes — a bake-off must never overwrite canonical chapters. ` +
          `Move the existing book aside (or use a fresh bookId) and re-run promotion.`,
        );
      }
    }
  }

  // 2. Copy (atomic per file; byte-identical re-promotion is a no-op rewrite).
  mkdirSync(chaptersDir, { recursive: true });
  for (const s of staged) writeFileAtomic(s.dst, s.bytes);

  // 3. Byte-identity verification — read back and compare EXACT bytes.
  for (const s of staged) {
    const back = readFileSync(s.dst, "utf8");
    if (back !== s.bytes) {
      throw new PromotionError(`byte-identity verification FAILED for ${pipelineRel(s.dst)} — promoted file does not match the selected candidate`);
    }
  }
  args.log(`[bakeoff] promotion: ${staged.length} chapters byte-verified into ${pipelineRel(chaptersDir)}`);

  // 4. Canonical author provenance (real author sessions, bound to content).
  const authorSessionIds: Record<string, string> = {};
  for (const s of staged) {
    try {
      stamp(s.chapterId, s.authorSessionId, s.contentHash);
    } catch (err) {
      // A create-once conflict at IDENTICAL content means a prior promotion of
      // the same run already stamped it — fine. Anything else fails closed.
      if (!/identical|already/i.test((err as Error).message)) {
        throw new PromotionError(`provenance stamp failed for ${s.chapterId}: ${(err as Error).message}`);
      }
    }
    authorSessionIds[s.chapterId] = s.authorSessionId;
  }

  const record: PromotionRecordV1 = {
    schemaVersion: "model-bakeoff-promotion-v1",
    promotedAt: new Date().toISOString(),
    winnerModel: winner.model,
    winnerEffort: winner.effort,
    runId: manifest.runId,
    chapterFiles: staged.map((s) => ({ relPath: pipelineRel(s.dst), sha256: sha256Hex(s.bytes) })),
    byteIdentityVerified: true,
    sharedInputsSha256: manifest.freeze?.combinedSha256 ?? "",
    taskCardTemplateSha256: manifest.freeze?.taskCardTemplateSha256 ?? {},
    candidateChapterHashes: args.candidateChapterHashes,
    authorSessionIds,
  };

  // 5. Durable canonical sidecar.
  const sidecar = args.sidecarPath ?? bakeoffSidecarPath(bookId);
  mkdirSync(resolve(sidecar, ".."), { recursive: true });
  writeFileAtomic(sidecar, JSON.stringify(record, null, 2) + "\n");
  args.log(`[bakeoff] promotion: provenance sidecar written (${pipelineRel(sidecar)})`);
  return record;
}
