import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { runShipGate } from "../critics/finalGate.js";
import { runBookGate } from "../critics/bookGate.js";
import { loadBookChapters } from "./manualKeyJudge.js";

export const WAIVERS_DIR = resolve(CANONICAL_STATE, "waivers");

export type MajorFindingSnapshot = {
  id: string;
  scope: string;
  checkId: string;
  message: string;
  evidence?: string;
};

export type MajorDisposition = {
  findingId: string;
  status: "resolved" | "waived";
  reason: string;
  reviewer: string;
  roundId: string;
  timestamp: string;
};

export type WaiverFile = {
  schemaVersion: "major-waivers-v1";
  bookId: string;
  dispositions: MajorDisposition[];
};

function shortHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

function findingId(scope: string, checkId: string, message: string, evidence?: string): string {
  return shortHash(`${scope}\n${checkId}\n${message}\n${evidence ?? ""}`);
}

export function currentMajorFindings(bookId: string, chapters = loadBookChapters(bookId)): MajorFindingSnapshot[] {
  const out: MajorFindingSnapshot[] = [];
  for (const ch of chapters) {
    const gate = runShipGate(ch);
    for (const f of gate.majors) {
      const scope = `chapter:${ch.number}:${f.unit}`;
      out.push({ id: findingId(scope, f.catalogId, f.message, f.evidence), scope, checkId: f.catalogId, message: f.message, evidence: f.evidence });
    }
  }
  const bookGate = runBookGate(bookId, chapters);
  for (const f of bookGate.findings.filter((x) => x.severity === "major")) {
    const scope = "book";
    out.push({ id: findingId(scope, f.catalogId, f.message, f.evidence), scope, checkId: f.catalogId, message: f.message, evidence: f.evidence });
  }
  return out;
}

export function waiverPath(bookId: string): string {
  return resolve(WAIVERS_DIR, `${bookId}.json`);
}

export function loadWaivers(bookId: string): WaiverFile {
  const p = waiverPath(bookId);
  if (!existsSync(p)) return { schemaVersion: "major-waivers-v1", bookId, dispositions: [] };
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as WaiverFile;
    return { schemaVersion: "major-waivers-v1", bookId, dispositions: parsed.dispositions ?? [] };
  } catch {
    return { schemaVersion: "major-waivers-v1", bookId, dispositions: [] };
  }
}

export function writeDisposition(bookId: string, disposition: MajorDisposition): string {
  const file = loadWaivers(bookId);
  file.dispositions = [...file.dispositions.filter((d) => d.findingId !== disposition.findingId), disposition];
  mkdirSync(WAIVERS_DIR, { recursive: true });
  const p = waiverPath(bookId);
  writeFileSync(p, JSON.stringify(file, null, 2), "utf8");
  return p;
}

export function unresolvedMajors(bookId: string, chapters = loadBookChapters(bookId)): MajorFindingSnapshot[] {
  const dispositions = new Map(loadWaivers(bookId).dispositions.map((d) => [d.findingId, d]));
  return currentMajorFindings(bookId, chapters).filter((f) => {
    const d = dispositions.get(f.id);
    return !d || (d.status !== "resolved" && d.status !== "waived");
  });
}

export function formatMajorStatus(bookId: string, chapters = loadBookChapters(bookId)): string {
  const current = currentMajorFindings(bookId, chapters);
  const dispositions = new Map(loadWaivers(bookId).dispositions.map((d) => [d.findingId, d]));
  const lines = [`major-status: ${current.length === 0 ? "PASS" : "CHECK"} (${current.length} current major(s))`];
  for (const f of current) {
    const d = dispositions.get(f.id);
    lines.push(`  [${d ? d.status.toUpperCase() : "UNRESOLVED"}] ${f.id} ${f.scope} ${f.checkId}: ${f.message.slice(0, 180)}`);
  }
  return lines.join("\n");
}

