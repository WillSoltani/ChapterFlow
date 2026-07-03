import { expectedSourceChapters } from "../qc/sourceV2Gate.js";
import { evidenceMapPath, readJsonFile, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
import { EVIDENCE_MAP_SCHEMA_VERSION, type ChapterEvidenceMapV1 } from "../artifacts/artifactTypes.js";
import { normSlug } from "../lib/chapterPaths.js";

export type EvidenceFinding = { checkId: string; severity: "blocker" | "advisory"; chapterNumber?: number; path?: string; message: string };
export type EvidenceGateReport = { bookId: string; passed: boolean; chaptersChecked: number; findings: EvidenceFinding[] };

export function validateEvidenceMap(map: ChapterEvidenceMapV1): EvidenceFinding[] {
  const findings: EvidenceFinding[] = [];
  const ch = map.chapterNumber;
  const push = (checkId: string, severity: EvidenceFinding["severity"], message: string, path?: string) => findings.push({ checkId, severity, chapterNumber: ch, message, path });
  if (map.schemaVersion !== EVIDENCE_MAP_SCHEMA_VERSION) push("EV1.schema", "blocker", `evidence map schemaVersion must be ${EVIDENCE_MAP_SCHEMA_VERSION}`);
  for (const [path, e] of Object.entries(map.paths ?? {})) {
    if (e.unsupportedAnchorIds.length > 0) push("EV2.unsupported_anchor", "blocker", `${path} cites unsupported source anchors: ${e.unsupportedAnchorIds.join(", ")}`, path);
    // Numbers/entities are advisory here to avoid false blocking ordinary fictional names and
    // harmless durations; source/ship/QC remain strict. The risk score escalates on these.
    if (e.unsupportedNumbers.length > 0) push("EV3.unsupported_number", "advisory", `${path} has numbers not visible in source packet: ${e.unsupportedNumbers.join(", ")}`, path);
    if (e.unsupportedEntities.length > 0) push("EV4.unsupported_entity", "advisory", `${path} has entities not visible in source packet: ${e.unsupportedEntities.slice(0, 6).join(", ")}`, path);
  }
  if (map.summary.factCoverage < 0.2) push("EV5.low_coverage", "advisory", `source anchor coverage is low (${Math.round(map.summary.factCoverage * 100)}%)`);
  return findings;
}

export function checkEvidenceGate(bookId: string, roots: CompilerStoreRoots = {}): EvidenceGateReport {
  const normalized = normSlug(bookId);
  const chapters = expectedSourceChapters(normalized, { stateRoot: roots.stateRoot });
  const findings: EvidenceFinding[] = [];
  for (const chapterNumber of chapters) {
    const path = evidenceMapPath(normalized, chapterNumber, roots);
    try {
      findings.push(...validateEvidenceMap(readJsonFile<ChapterEvidenceMapV1>(path)));
    } catch (err) {
      findings.push({ checkId: "EV0.missing_or_malformed", severity: "blocker", chapterNumber, path, message: `missing/unreadable evidence map: ${(err as Error).message}` });
    }
  }
  return { bookId: normalized, passed: !findings.some((f) => f.severity === "blocker"), chaptersChecked: chapters.length, findings };
}

export function formatEvidenceGateReport(report: EvidenceGateReport): string {
  const blockers = report.findings.filter((f) => f.severity === "blocker").length;
  const advisories = report.findings.filter((f) => f.severity === "advisory").length;
  const lines = [`evidence-gate: ${report.passed ? "PASS" : "BLOCK"} (${report.chaptersChecked} chapter(s), ${blockers} blocker(s), ${advisories} advisory)`];
  for (const f of report.findings) lines.push(`  [${f.severity.toUpperCase()} ${f.checkId}] ${f.chapterNumber ? `ch${String(f.chapterNumber).padStart(2, "0")}: ` : ""}${f.message}${f.path ? ` (${f.path})` : ""}`);
  return lines.join("\n");
}
