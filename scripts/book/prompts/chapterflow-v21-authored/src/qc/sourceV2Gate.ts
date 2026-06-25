import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { CANONICAL_STATE, REPO_ROOT } from "../lib/chapterPaths.js";
import { formatChapterSetBlockers, readCanonicalChapterIndex } from "../lib/chapterSet.js";
import { findRunArtifact } from "../lib/runDirs.js";
import { formatTocIssues, parseTocFile } from "../lib/tocContract.js";
import { evaluateSourceV2Integrity, rawSourceHash, semanticSourceHash } from "../source/sourceIntegrity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow/runs");

export type SourceV2Roots = {
  stateRoot?: string;
  runsRoot?: string;
};

export type SourceV2Finding = {
  checkId: string;
  /** Structural checks are "blocker"; realness heuristics surface as "advisory"
   *  (carried through from evaluateSourceV2Integrity) and never gate. */
  severity: "blocker" | "advisory";
  chapterNumber?: number;
  message: string;
};

export type SourceV2GateReport = {
  bookId: string;
  passed: boolean;
  chaptersChecked: number;
  findings: SourceV2Finding[];
};

export type ExpectedSourceChaptersReport =
  | { ok: true; chapters: number[]; findings: SourceV2Finding[] }
  | { ok: false; chapters: []; findings: SourceV2Finding[] };

export type SourceFactForPack = {
  id: string;
  claim: string;
  becauseMechanism: string;
  commonError: string;
  errorIsWhy: string;
};

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

function latestTocPath(bookId: string, roots: SourceV2Roots = {}): string | null {
  return findRunArtifact(roots.runsRoot ?? RUNS_ROOT, bookId, "source-freeze/toc.json");
}

function tocCrossCheckFindings(bookId: string, expectedNumbers: number[], roots: SourceV2Roots = {}): SourceV2Finding[] {
  const tocPath = latestTocPath(bookId, roots);
  if (!tocPath) return [];
  const parsed = parseTocFile(tocPath, { bookId });
  if (!parsed.ok) {
    return [{
      checkId: "SV2.toc_malformed",
      severity: "blocker",
      message: `TOC cross-check failed at ${tocPath}: ${formatTocIssues(parsed.issues)}`,
    }];
  }
  const tocNumbers = parsed.chapters.map((ch) => ch.number);
  if (tocNumbers.length !== expectedNumbers.length || tocNumbers.some((n, i) => n !== expectedNumbers[i])) {
    return [{
      checkId: "SV2.toc_index_mismatch",
      severity: "blocker",
      message: `TOC chapter sequence [${tocNumbers.join(", ")}] does not match canonical index [${expectedNumbers.join(", ")}].`,
    }];
  }
  return [];
}

export function resolveExpectedSourceChapters(bookId: string, roots: SourceV2Roots = {}): ExpectedSourceChaptersReport {
  const canonical = readCanonicalChapterIndex(bookId, roots.stateRoot ?? CANONICAL_STATE);
  if (!canonical.ok) {
    return {
      ok: false,
      chapters: [],
      findings: [{
        checkId: "SV2.canonical_index_blocked",
        severity: "blocker",
        message: formatChapterSetBlockers(canonical.blockers),
      }],
    };
  }
  const chapters = canonical.chapters.map((ch) => ch.chapterNumber);
  return { ok: true, chapters, findings: tocCrossCheckFindings(bookId, chapters, roots) };
}

export function expectedSourceChapters(bookId: string, roots: SourceV2Roots = {}): number[] {
  const resolved = resolveExpectedSourceChapters(bookId, roots);
  return resolved.ok ? resolved.chapters : [];
}

export function expectedSourceChapterFindings(bookId: string, roots: SourceV2Roots = {}): SourceV2Finding[] {
  return resolveExpectedSourceChapters(bookId, roots).findings;
}

export function sourceSidecarPathFor(bookId: string, chapterNumber: number, roots: SourceV2Roots = {}): string | null {
  return findRunArtifact(roots.runsRoot ?? RUNS_ROOT, bookId, `sidecars/source/ch${String(chapterNumber).padStart(2, "0")}.source.json`);
}

export function sourceHashFor(bookId: string, chapterNumber: number, roots: SourceV2Roots = {}): string | null {
  const p = sourceSidecarPathFor(bookId, chapterNumber, roots);
  if (!p || !existsSync(p)) return null;
  try {
    return semanticSourceHash(readJson(p));
  } catch {
    return null;
  }
}

export function sourceRawHashFor(bookId: string, chapterNumber: number, roots: SourceV2Roots = {}): string | null {
  const p = sourceSidecarPathFor(bookId, chapterNumber, roots);
  if (!p || !existsSync(p)) return null;
  return rawSourceHash(readFileSync(p, "utf8"));
}

export function loadSourceV2Sidecar(bookId: string, chapterNumber: number, roots: SourceV2Roots = {}): any | null {
  const p = sourceSidecarPathFor(bookId, chapterNumber, roots);
  if (!p || !existsSync(p)) return null;
  try {
    return readJson(p);
  } catch {
    return null;
  }
}

export function sourceFactsForPack(sc: any): SourceFactForPack[] {
  return (Array.isArray(sc?.testableFacts) ? sc.testableFacts : []).map((f: any) => ({
    id: String(f?.id ?? ""),
    claim: String(f?.claim ?? ""),
    becauseMechanism: String(f?.becauseMechanism ?? ""),
    commonError: String(f?.commonError ?? ""),
    errorIsWhy: String(f?.errorIsWhy ?? ""),
  })).filter((f: SourceFactForPack) => f.id && f.claim);
}

export function checkSourceV2Gate(bookId: string, chapterNumbers?: number[], roots: SourceV2Roots = {}): SourceV2GateReport {
  const findings: SourceV2Finding[] = [];
  let expected = chapterNumbers;
  const canonical = readCanonicalChapterIndex(bookId, roots.stateRoot ?? CANONICAL_STATE);
  const canonicalTitles = canonical.ok
    ? new Map(canonical.chapters.map((chapter) => [chapter.chapterNumber, chapter.chapterTitle]))
    : new Map<number, string>();
  if (!expected) {
    const resolved = resolveExpectedSourceChapters(bookId, roots);
    findings.push(...resolved.findings);
    expected = resolved.ok ? resolved.chapters : [];
  }
  if (expected.length === 0) {
    findings.push({ checkId: "SV2.no_chapters", severity: "blocker", message: `No expected source chapters found for ${bookId}.` });
  }
  for (const chapterNumber of expected) {
    const p = sourceSidecarPathFor(bookId, chapterNumber, roots);
    if (!p || !existsSync(p)) {
      findings.push({ checkId: "SV2.missing_sidecar", severity: "blocker", chapterNumber, message: `Missing source sidecar for ch${String(chapterNumber).padStart(2, "0")}.` });
      continue;
    }
    let raw = "";
    let sc: any;
    try {
      raw = readFileSync(p, "utf8");
      sc = JSON.parse(raw);
    } catch (err) {
      findings.push({ checkId: "SV2.unreadable_sidecar", severity: "blocker", chapterNumber, message: `Unreadable source sidecar ${p}: ${(err as Error).message}` });
      continue;
    }
    const decision = evaluateSourceV2Integrity(sc, {
      chapterNumber,
      chapterTitle: canonicalTitles.get(chapterNumber),
      rawText: raw,
    });
    findings.push(...decision.findings);
  }
  // Realness findings are advisory and surfaced in `findings` but do NOT fail the
  // gate — only structural blockers do.
  return { bookId, passed: !findings.some((f) => f.severity === "blocker"), chaptersChecked: expected.length, findings };
}

export function formatSourceV2GateReport(report: SourceV2GateReport): string {
  const lines = [`source-v2-gate: ${report.passed ? "PASS" : "BLOCK"} (${report.chaptersChecked} chapter(s), ${report.findings.length} blocker(s))`];
  for (const f of report.findings) {
    lines.push(`  [${f.checkId}] ${f.chapterNumber ? `ch${String(f.chapterNumber).padStart(2, "0")}: ` : ""}${f.message}`);
  }
  return lines.join("\n");
}
