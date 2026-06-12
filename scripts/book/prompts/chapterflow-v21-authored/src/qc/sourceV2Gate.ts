import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { CANONICAL_STATE, REPO_ROOT } from "../lib/chapterPaths.js";
import { findRunArtifact } from "../lib/runDirs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow/runs");

export type SourceV2Finding = {
  checkId: string;
  severity: "blocker";
  chapterNumber?: number;
  message: string;
};

export type SourceV2GateReport = {
  bookId: string;
  passed: boolean;
  chaptersChecked: number;
  findings: SourceV2Finding[];
};

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

function latestTocPath(bookId: string): string | null {
  return findRunArtifact(RUNS_ROOT, bookId, "source-freeze/toc.json");
}

function chaptersFromToc(bookId: string): number[] {
  const tocPath = latestTocPath(bookId);
  if (!tocPath) return [];
  const toc = readJson(tocPath);
  const flat = (toc.flatChapters && toc.flatChapters.length > 0
    ? toc.flatChapters
    : (toc.sections ?? []).flatMap((s: any) => s.chapters ?? []))
    .slice()
    .sort((a: any, b: any) => a.number - b.number);
  return flat.map((ch: any) => Number(ch.number)).filter((n: number) => Number.isFinite(n));
}

function chaptersFromIndex(bookId: string): number[] {
  const p = resolve(CANONICAL_STATE, "indexes", `${bookId}.json`);
  if (!existsSync(p)) return [];
  try {
    const idx = readJson(p) as Array<{ chapterNumber?: number }>;
    return idx.map((ch) => Number(ch.chapterNumber)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function chaptersFromSourceDir(bookId: string): number[] {
  const bookRunsDir = resolve(RUNS_ROOT, bookId);
  try {
    const runs = readdirSync(bookRunsDir)
      .filter((d) => statSync(resolve(bookRunsDir, d)).isDirectory())
      .sort()
      .reverse();
    for (const run of runs) {
      const dir = resolve(bookRunsDir, run, "sidecars", "source");
      if (!existsSync(dir)) continue;
      const nums = readdirSync(dir)
        .map((f) => f.match(/^ch(\d{1,3})\.source\.json$/)?.[1])
        .filter(Boolean)
        .map((n) => Number(n))
        .sort((a, b) => a - b);
      if (nums.length > 0) return nums;
    }
  } catch {
    return [];
  }
  return [];
}

export function expectedSourceChapters(bookId: string): number[] {
  const fromIndex = chaptersFromIndex(bookId);
  if (fromIndex.length > 0) return fromIndex;
  const fromToc = chaptersFromToc(bookId);
  if (fromToc.length > 0) return fromToc;
  return chaptersFromSourceDir(bookId);
}

export function sourceSidecarPathFor(bookId: string, chapterNumber: number): string | null {
  return findRunArtifact(RUNS_ROOT, bookId, `sidecars/source/ch${String(chapterNumber).padStart(2, "0")}.source.json`);
}

export function sourceHashFor(bookId: string, chapterNumber: number): string | null {
  const p = sourceSidecarPathFor(bookId, chapterNumber);
  if (!p || !existsSync(p)) return null;
  return hashText(readFileSync(p, "utf8"));
}

export function loadSourceV2Sidecar(bookId: string, chapterNumber: number): any | null {
  const p = sourceSidecarPathFor(bookId, chapterNumber);
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

function nonempty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function checkSourceV2Gate(bookId: string, chapterNumbers = expectedSourceChapters(bookId)): SourceV2GateReport {
  const findings: SourceV2Finding[] = [];
  if (chapterNumbers.length === 0) {
    findings.push({ checkId: "SV2.no_chapters", severity: "blocker", message: `No expected source chapters found for ${bookId}.` });
  }
  for (const chapterNumber of chapterNumbers) {
    const p = sourceSidecarPathFor(bookId, chapterNumber);
    if (!p || !existsSync(p)) {
      findings.push({ checkId: "SV2.missing_sidecar", severity: "blocker", chapterNumber, message: `Missing source sidecar for ch${String(chapterNumber).padStart(2, "0")}.` });
      continue;
    }
    let sc: any;
    try {
      sc = readJson(p);
    } catch (err) {
      findings.push({ checkId: "SV2.unreadable_sidecar", severity: "blocker", chapterNumber, message: `Unreadable source sidecar ${p}: ${(err as Error).message}` });
      continue;
    }
    if (sc?.schemaVersion !== "source-v2") {
      findings.push({ checkId: "SV2.not_source_v2", severity: "blocker", chapterNumber, message: `Sidecar is schemaVersion ${JSON.stringify(sc?.schemaVersion)}; no-api mode requires "source-v2".` });
    }
    if (!sc?.centralConcept || !nonempty(sc.centralConcept.name) || !nonempty(sc.centralConcept.plainDefinition)) {
      findings.push({ checkId: "SV2.central_concept_missing", severity: "blocker", chapterNumber, message: `centralConcept.name and centralConcept.plainDefinition are required.` });
    }
    const namedExamples = Array.isArray(sc?.namedExamples) ? sc.namedExamples : [];
    if (namedExamples.length < 3) {
      findings.push({ checkId: "SV2.named_examples_floor", severity: "blocker", chapterNumber, message: `namedExamples has ${namedExamples.length}; need at least 3.` });
    }
    namedExamples.forEach((ex: any, i: number) => {
      const specifics = Array.isArray(ex?.hardSpecifics) ? ex.hardSpecifics.filter(nonempty) : [];
      if (specifics.length < 2) {
        findings.push({ checkId: "SV2.hard_specifics_floor", severity: "blocker", chapterNumber, message: `namedExamples[${i}] has ${specifics.length} hardSpecifics; need at least 2.` });
      }
    });
    const facts = Array.isArray(sc?.testableFacts) ? sc.testableFacts : [];
    if (facts.length < 9) {
      findings.push({ checkId: "SV2.testable_facts_floor", severity: "blocker", chapterNumber, message: `testableFacts has ${facts.length}; need at least 9.` });
    }
    facts.forEach((fact: any, i: number) => {
      const missing = ["claim", "becauseMechanism", "commonError", "errorIsWhy"].filter((k) => !nonempty(fact?.[k]));
      if (missing.length > 0) {
        findings.push({ checkId: "SV2.testable_fact_missing_field", severity: "blocker", chapterNumber, message: `testableFacts[${i}] is missing ${missing.join(", ")}.` });
      }
    });
  }
  return { bookId, passed: findings.length === 0, chaptersChecked: chapterNumbers.length, findings };
}

export function formatSourceV2GateReport(report: SourceV2GateReport): string {
  const lines = [`source-v2-gate: ${report.passed ? "PASS" : "BLOCK"} (${report.chaptersChecked} chapter(s), ${report.findings.length} blocker(s))`];
  for (const f of report.findings) {
    lines.push(`  [${f.checkId}] ${f.chapterNumber ? `ch${String(f.chapterNumber).padStart(2, "0")}: ` : ""}${f.message}`);
  }
  return lines.join("\n");
}
