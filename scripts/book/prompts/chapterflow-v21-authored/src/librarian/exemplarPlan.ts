/**
 * Exemplar plan — book-level ownership for marquee real-world cases.
 *
 * Repeated source figures become a catalog stamp when parallel chapter agents
 * each treat the same famous case as their teaching unit. This plan reads the
 * source sidecars first and gives every repeated figure/case/event exactly one
 * chapter owner: the chapter where the source sidecar treats it most centrally
 * (earliest namedExamples slot, then lowest chapter number). Other chapters may
 * mention it only in passing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { findSourceSidecar } from "./sourceSidecars.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const EXEMPLAR_PLANS_DIR = resolve(__dirname, "../../state/exemplar-plans");

export type ExemplarForbidden = {
  name: string;
  ownerChapter: number;
};

export type ExemplarChapterPlan = {
  assigned: string[];
  forbidden: ExemplarForbidden[];
};

export type ExemplarPlan = {
  schemaVersion: "exemplar-plan-v1";
  bookId: string;
  createdAt: string;
  fromChapter: number;
  toChapter: number;
  allocation: Record<number, ExemplarChapterPlan>;
  diagnostics: {
    contested: number;
    chaptersWithoutSidecar: number[];
  };
};

type CandidateOccurrence = {
  key: string;
  display: string;
  chapter: number;
  order: number;
};

type CandidateRecord = {
  display: string;
  chapters: Map<number, number>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanDisplay(value: string): string {
  return value
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[\s"'([{]+|[\s"',.;:!?)}\]]+$/g, "")
    .replace(/'s$/i, "")
    .trim();
}

export function normalizeExemplarCandidate(value: string): string {
  return cleanDisplay(value)
    .replace(/\b(the|a|an)\b/gi, " ")
    .replace(/[^\wÀ-ÖØ-öø-ÿ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function candidateTokens(text: string): string[] {
  return text.match(/[A-Z]{2,}|[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ]*(?:[.'’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*|\d{4}|[A-Za-zÀ-ÖØ-öø-ÿ]+|&/g) ?? [];
}

function isNameToken(token: string): boolean {
  return /^[A-ZÀ-ÖØ-Þ]/.test(token) && !/^\d{4}$/.test(token);
}

function isYearToken(token: string): boolean {
  return /^(18|19|20)\d{2}$/.test(token);
}

function isConnector(token: string): boolean {
  return /^(of|the|and|for|in|on|de|du|van|von|la|le|&)$/i.test(token);
}

function trimConnectors(tokens: string[]): string[] {
  let start = 0;
  let end = tokens.length;
  while (start < end && isConnector(tokens[start])) start++;
  while (end > start && isConnector(tokens[end - 1])) end--;
  return tokens.slice(start, end);
}

function maybePushSequence(out: string[], seq: string[]): void {
  const trimmed = trimConnectors(seq);
  if (trimmed.length === 0) return;
  const nameCount = trimmed.filter(isNameToken).length;
  const hasYear = trimmed.some(isYearToken);
  if (nameCount < 2 && !(nameCount >= 1 && hasYear)) return;
  const display = cleanDisplay(trimmed.join(" "));
  const key = normalizeExemplarCandidate(display);
  if (key.length < 4) return;
  out.push(display);
}

export function extractExemplarCandidatesFromText(text: string, allowSingleProper = false): string[] {
  const tokens = candidateTokens(text);
  const out: string[] = [];
  let seq: string[] = [];
  for (const token of tokens) {
    if (isNameToken(token) || isYearToken(token)) {
      seq.push(token);
      continue;
    }
    if (isConnector(token) && seq.some(isNameToken)) {
      seq.push(token);
      continue;
    }
    maybePushSequence(out, seq);
    seq = [];
  }
  maybePushSequence(out, seq);

  if (allowSingleProper) {
    for (const token of tokens) {
      if (!isNameToken(token) || token.length < 4) continue;
      const display = cleanDisplay(token);
      if (/^(This|That|When|Where|What|Why|How|Chapter|Guidepost)$/i.test(display)) continue;
      out.push(display);
    }
  }

  const seen = new Set<string>();
  return out.filter((candidate) => {
    const key = normalizeExemplarCandidate(candidate);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sidecarOccurrences(sidecar: unknown, chapter: number): CandidateOccurrence[] {
  const out: CandidateOccurrence[] = [];
  if (!isRecord(sidecar)) return out;

  const namedExamples = Array.isArray(sidecar.namedExamples) ? sidecar.namedExamples : [];
  namedExamples.forEach((entry, idx) => {
    const sources: string[] = [];
    if (typeof entry === "string") {
      sources.push(entry);
    } else if (isRecord(entry)) {
      if (typeof entry.label === "string") sources.push(entry.label);
      if (typeof entry.summary === "string") sources.push(entry.summary);
      if (Array.isArray(entry.hardSpecifics)) {
        for (const specific of entry.hardSpecifics) {
          if (typeof specific === "string") sources.push(specific);
        }
      }
    }
    for (const source of sources) {
      for (const display of extractExemplarCandidatesFromText(source)) {
        out.push({ key: normalizeExemplarCandidate(display), display, chapter, order: idx });
      }
    }
  });

  if (Array.isArray(sidecar.properNouns)) {
    sidecar.properNouns.forEach((value, idx) => {
      if (typeof value !== "string") return;
      for (const display of extractExemplarCandidatesFromText(value, true)) {
        out.push({ key: normalizeExemplarCandidate(display), display, chapter, order: 1000 + idx });
      }
    });
  }

  return out.filter((candidate) => candidate.key.length > 0);
}

function sortChapterNumbers(a: string, b: string): number {
  return Number(a) - Number(b);
}

export function planExemplars(bookId: string, from: number, to: number): ExemplarPlan {
  if (to < from) throw new Error(`to (${to}) < from (${from})`);
  if (from < 1) throw new Error(`from (${from}) must be >= 1`);

  const byCandidate = new Map<string, CandidateRecord>();
  const chapterCandidates = new Map<number, Map<string, { display: string; order: number }>>();
  const chaptersWithoutSidecar: number[] = [];

  for (let chapter = from; chapter <= to; chapter++) {
    const sidecarPath = findSourceSidecar(bookId, chapter);
    if (!sidecarPath || !existsSync(sidecarPath)) {
      console.warn(`exemplar-plan: no source sidecar for "${bookId}" ch${String(chapter).padStart(2, "0")}; continuing with empty candidates.`);
      chaptersWithoutSidecar.push(chapter);
      chapterCandidates.set(chapter, new Map());
      continue;
    }
    let sidecar: unknown;
    try {
      sidecar = JSON.parse(readFileSync(sidecarPath, "utf8"));
    } catch (err) {
      console.warn(`exemplar-plan: unreadable sidecar for "${bookId}" ch${String(chapter).padStart(2, "0")}: ${(err as Error).message}`);
      chaptersWithoutSidecar.push(chapter);
      chapterCandidates.set(chapter, new Map());
      continue;
    }
    const perChapter = new Map<string, { display: string; order: number }>();
    for (const occurrence of sidecarOccurrences(sidecar, chapter)) {
      const current = perChapter.get(occurrence.key);
      if (!current || occurrence.order < current.order) {
        perChapter.set(occurrence.key, { display: occurrence.display, order: occurrence.order });
      }
    }
    chapterCandidates.set(chapter, perChapter);
    for (const [key, value] of perChapter) {
      const record = byCandidate.get(key) ?? { display: value.display, chapters: new Map<number, number>() };
      if (value.order < (record.chapters.get(chapter) ?? Number.POSITIVE_INFINITY)) {
        record.chapters.set(chapter, value.order);
      }
      byCandidate.set(key, record);
    }
  }

  const ownerByCandidate = new Map<string, number>();
  for (const [key, record] of byCandidate) {
    let ownerChapter = Number.POSITIVE_INFINITY;
    let ownerOrder = Number.POSITIVE_INFINITY;
    for (const [chapter, order] of record.chapters) {
      if (order < ownerOrder || (order === ownerOrder && chapter < ownerChapter)) {
        ownerChapter = chapter;
        ownerOrder = order;
      }
    }
    ownerByCandidate.set(key, ownerChapter);
  }

  const allocation: Record<number, ExemplarChapterPlan> = {};
  for (let chapter = from; chapter <= to; chapter++) {
    allocation[chapter] = { assigned: [], forbidden: [] };
  }

  for (const [chapterKey, perChapter] of Array.from(chapterCandidates.entries()).sort((a, b) => a[0] - b[0])) {
    const chapter = Number(chapterKey);
    for (const [key, value] of Array.from(perChapter.entries()).sort((a, b) => a[1].order - b[1].order || a[1].display.localeCompare(b[1].display))) {
      const ownerChapter = ownerByCandidate.get(key);
      const record = byCandidate.get(key);
      const display = record?.display ?? value.display;
      if (ownerChapter === chapter) {
        allocation[chapter].assigned.push(display);
      } else if (ownerChapter !== undefined) {
        allocation[chapter].forbidden.push({ name: display, ownerChapter });
      }
    }
  }

  return {
    schemaVersion: "exemplar-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    fromChapter: from,
    toChapter: to,
    allocation,
    diagnostics: {
      contested: Array.from(byCandidate.values()).filter((record) => record.chapters.size >= 2).length,
      chaptersWithoutSidecar,
    },
  };
}

export function writeExemplarPlan(plan: ExemplarPlan): string {
  mkdirSync(EXEMPLAR_PLANS_DIR, { recursive: true });
  const path = resolve(EXEMPLAR_PLANS_DIR, `${plan.bookId}.exemplar-plan.json`);
  writeFileSync(path, JSON.stringify(plan, null, 2), "utf8");
  return path;
}

export function formatExemplarPlan(plan: ExemplarPlan): string {
  const lines: string[] = [`Exemplar plan — ${plan.bookId} ch${plan.fromChapter}-${plan.toChapter}`];
  lines.push(`  contested:${plan.diagnostics.contested}  missing-sidecars:${plan.diagnostics.chaptersWithoutSidecar.join(",") || "none"}`);
  lines.push("");
  for (const [chapter, entry] of Object.entries(plan.allocation).sort((a, b) => sortChapterNumbers(a[0], b[0]))) {
    const assigned = entry.assigned.length ? entry.assigned.join(", ") : "(none)";
    const forbidden = entry.forbidden.length
      ? entry.forbidden.map((item) => `${item.name} (ch${item.ownerChapter})`).join(", ")
      : "(none)";
    lines.push(`  ch${String(chapter).padStart(2, "0")}: owns ${assigned}; forbidden ${forbidden}`);
  }
  return lines.join("\n");
}
