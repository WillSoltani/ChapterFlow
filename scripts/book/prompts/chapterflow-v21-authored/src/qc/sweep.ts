import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, parseChapterId } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { loadQcRound, verifyQcRoundToken } from "./qcRound.js";
import { loadBookChapters } from "./manualKeyJudge.js";

export const QC_DIR = resolve(CANONICAL_STATE, "qc");
export const SWEEP_PACKS_DIR = resolve(CANONICAL_STATE, "qc-packs");

export type SweepPack = {
  schemaVersion: "sweep-pack-v1";
  bookId: string;
  roundId: string;
  createdAt: string;
  chapters: Array<{ chapterNumber: number; chapterId: string; contentHash: string; exampleCount: number; quizCount: number }>;
};

export type SweepRecord = {
  schemaVersion: "sweep-attest-v1";
  bookId: string;
  roundId: string;
  verdict: "PASS" | "REVISE" | "CORRUPTION";
  reviewer: string;
  attestedAt: string;
  contentHashes: Record<string, string>;
  notes?: string;
};

export type SweepFinding = { checkId: string; severity: "blocker" | "advisory"; message: string };

export function sweepPackPath(bookId: string, roundId: string): string {
  return resolve(SWEEP_PACKS_DIR, bookId, roundId, "sweep-pack.json");
}

export function sweepRecordPath(bookId: string): string {
  return resolve(QC_DIR, `${bookId}.sweep.json`);
}

export function writeSweepPack(bookId: string, roundId: string): string {
  const chapters = loadBookChapters(bookId);
  const pack: SweepPack = {
    schemaVersion: "sweep-pack-v1",
    bookId,
    roundId,
    createdAt: new Date().toISOString(),
    chapters: chapters.map((ch) => ({
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      contentHash: chapterContentHash(ch),
      exampleCount: ch.examples?.length ?? 0,
      quizCount: ch.quiz?.questions?.length ?? 0,
    })),
  };
  const p = sweepPackPath(bookId, roundId);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(pack, null, 2), "utf8");
  return p;
}

export function writeSweepAttestation(bookId: string, roundId: string, token: string, verdict: SweepRecord["verdict"], reviewer: string, notes?: string): { path?: string; error?: string } {
  if (!verifyQcRoundToken(bookId, roundId, "sweep", token)) {
    return { error: `Invalid sweep token for ${bookId} round ${roundId}.` };
  }
  const chapters = loadBookChapters(bookId);
  const contentHashes: Record<string, string> = {};
  for (const ch of chapters) contentHashes[String(ch.number)] = chapterContentHash(ch);
  const rec: SweepRecord = {
    schemaVersion: "sweep-attest-v1",
    bookId,
    roundId,
    verdict,
    reviewer,
    attestedAt: new Date().toISOString(),
    contentHashes,
    notes,
  };
  mkdirSync(QC_DIR, { recursive: true });
  const p = sweepRecordPath(bookId);
  writeFileSync(p, JSON.stringify(rec, null, 2), "utf8");
  return { path: p };
}

export function loadSweepRecord(bookId: string): SweepRecord | null {
  const p = sweepRecordPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as SweepRecord;
  } catch {
    return null;
  }
}

export function checkSweep(chapters: ChapterV21[], enforce: boolean): SweepFinding[] {
  const sev: "blocker" | "advisory" = enforce ? "blocker" : "advisory";
  const parsed = chapters[0]?.chapterId ? parseChapterId(chapters[0].chapterId) : null;
  const bookId = parsed?.bookId ?? chapters[0]?.chapterId?.replace(/-ch\d+$/i, "") ?? "";
  const rec = loadSweepRecord(bookId);
  if (!rec) return [{ checkId: "QC3.sweep_missing", severity: sev, message: `No sweep attestation for ${bookId}. Run sweep-pack and sweep-attest.` }];
  if (!loadQcRound(rec.bookId, rec.roundId)?.roles?.sweep) return [{ checkId: "QC3.sweep_round_missing", severity: sev, message: `Sweep attestation is not backed by an existing QC round file. Re-open a round and re-attest the sweep.` }];
  if (rec.verdict !== "PASS") return [{ checkId: "QC3.sweep_not_pass", severity: sev, message: `Sweep verdict is ${rec.verdict}, not PASS.` }];
  const stale = chapters.filter((ch) => rec.contentHashes[String(ch.number)] !== chapterContentHash(ch));
  if (stale.length > 0) return [{ checkId: "QC3.sweep_stale", severity: sev, message: `Sweep attestation is stale/missing for chapter(s): ${stale.map((ch) => ch.number).join(", ")}.` }];
  return [];
}

export function formatSweepStatus(bookId: string): string {
  const rec = loadSweepRecord(bookId);
  if (!rec) return `sweep-status: MISSING (${bookId})`;
  return `sweep-status: ${rec.verdict} (${bookId}, round=${rec.roundId}, reviewer=${rec.reviewer}, ${rec.attestedAt.slice(0, 10)})`;
}
