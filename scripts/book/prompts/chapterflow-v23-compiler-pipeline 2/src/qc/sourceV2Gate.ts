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

/**
 * Source-v2 has two useful enforcement levels:
 *
 * - `checkSourceV2Gate` is the structural gate used by promotion/QC preflight. It
 *   fails only on hard schema/floor/anchor defects; noisy realness heuristics remain
 *   advisory.
 * - `checkSourceV2PrewriteGate` is the autonomous authoring readiness gate. It is
 *   intentionally stricter before writer fanout: if research looks too thin or a
 *   real-world named example has unsupported hard specifics, repair the sidecar now
 *   rather than letting writers invent detail and paying for a QC repair round later.
 *
 * This does NOT loosen QC or promotion. It moves selected source-quality failures
 * earlier, where a research-repair agent can fix them cheaply.
 */
export const PREWRITE_BLOCKING_SOURCE_ADVISORIES = new Set([
  "SV2.realness_placeholder_example",
  "SV2.realness_non_testable_fact",
  "SV2.realness_unsupported_entity",
  "SV2.realness_repeated_boilerplate",
  "SV2.realness_concept_only",
  "SV2.realness_fabricated_sidecar",
]);

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
  const out: SourceFactForPack[] = [];

  for (const f of (Array.isArray(sc?.testableFacts) ? sc.testableFacts : [])) {
    const fact: SourceFactForPack = {
      id: String(f?.id ?? ""),
      claim: String(f?.claim ?? ""),
      becauseMechanism: String(f?.becauseMechanism ?? ""),
      commonError: String(f?.commonError ?? ""),
      errorIsWhy: String(f?.errorIsWhy ?? ""),
    };
    if (fact.id && fact.claim) out.push(fact);
  }

  // QC reviewers and blind key judges see `sourceFacts`, not the full sidecar.
  // In v22.0, verified named-example hardSpecifics (e.g. "four acute care
  // hospitals", "over four years") lived only under namedExamples[].hardSpecifics,
  // so a writer could faithfully use a verified sidecar detail and still get a
  // first-round factual_accuracy REVISE because the QC pack did not expose that
  // detail. Promote those hard specifics into explicit pack facts. This does NOT
  // loosen QC: it makes the QC input match the source-reality contract.
  for (const ex of (Array.isArray(sc?.namedExamples) ? sc.namedExamples : [])) {
    if (ex?.realWorld === false) continue;
    const id = String(ex?.id ?? "").trim();
    const label = String(ex?.label ?? "").trim();
    const summary = String(ex?.summary ?? "").trim();
    const specifics = (Array.isArray(ex?.hardSpecifics) ? ex.hardSpecifics : [])
      .map((v: unknown) => String(v ?? "").trim())
      .filter(Boolean);
    if (!id || (!label && !summary && specifics.length === 0)) continue;
    const specificText = specifics.length ? specifics.join("; ") : "no listed hard specifics";
    out.push({
      id: `${id}.sourceDetails`,
      claim: `${label || id}: ${summary || "real-world named example"} Verified hard specifics: ${specificText}.`,
      becauseMechanism: String(ex?.teachesWhat ?? "The named case supplies concrete source grounding for this chapter.").trim(),
      commonError: `Using ${label || id} as a vague mood example, inventing extra facts, or repeating its location/scale labels when they do not do new teaching work.`,
      errorIsWhy: "QC checks factual_accuracy against this pack; every load-bearing number, place, date, duration, and role must appear here or be removed/softened.",
    });
  }

  const seen = new Set<string>();
  return out.filter((f) => {
    const key = f.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

export function checkSourceV2PrewriteGate(bookId: string, chapterNumbers?: number[], roots: SourceV2Roots = {}): SourceV2GateReport {
  const base = checkSourceV2Gate(bookId, chapterNumbers, roots);
  const findings = base.findings.map((f) => {
    if (f.severity === "advisory" && PREWRITE_BLOCKING_SOURCE_ADVISORIES.has(f.checkId)) {
      return { ...f, severity: "blocker" as const, message: `Pre-write source readiness: ${f.message}` };
    }
    return f;
  });
  return { ...base, findings, passed: !findings.some((f) => f.severity === "blocker") };
}

export function formatSourceV2GateReport(report: SourceV2GateReport): string {
  const blockerCount = report.findings.filter((f) => f.severity === "blocker").length;
  const advisoryCount = report.findings.filter((f) => f.severity === "advisory").length;
  const tail = advisoryCount ? `, ${advisoryCount} advisory` : "";
  const lines = [`source-v2-gate: ${report.passed ? "PASS" : "BLOCK"} (${report.chaptersChecked} chapter(s), ${blockerCount} blocker(s)${tail})`];
  for (const f of report.findings) {
    lines.push(`  [${f.severity.toUpperCase()} ${f.checkId}] ${f.chapterNumber ? `ch${String(f.chapterNumber).padStart(2, "0")}: ` : ""}${f.message}`);
  }
  return lines.join("\n");
}
