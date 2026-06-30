import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { SOURCE_PACKET_SCHEMA_VERSION } from "../artifacts/artifactTypes.js";
import { expectedSourceChapters } from "../qc/sourceV2Gate.js";
import { readJsonFile, sourcePacketPath, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
import { normSlug } from "../lib/chapterPaths.js";

export type PacketGateFinding = {
  checkId: string;
  severity: "blocker" | "advisory";
  chapterNumber?: number;
  message: string;
  path?: string;
};

export type PacketGateReport = {
  bookId: string;
  passed: boolean;
  chaptersChecked: number;
  findings: PacketGateFinding[];
};

export function validateSourcePacket(packet: SourcePacketV1): PacketGateFinding[] {
  const findings: PacketGateFinding[] = [];
  const ch = packet.chapterNumber;
  const push = (checkId: string, severity: PacketGateFinding["severity"], message: string, path?: string) => findings.push({ checkId, severity, chapterNumber: ch, message, path });
  if (packet.schemaVersion !== SOURCE_PACKET_SCHEMA_VERSION) push("SP1.schema", "blocker", `source packet schemaVersion must be ${SOURCE_PACKET_SCHEMA_VERSION}`, "/schemaVersion");
  if (!packet.chapterId || !Number.isInteger(packet.chapterNumber)) push("SP2.identity", "blocker", "source packet missing chapterId/chapterNumber");
  if (!Array.isArray(packet.facts) || packet.facts.length < 6) push("SP3.fact_floor", "blocker", `source packet has ${packet.facts?.length ?? 0} fact(s); need at least 6 before authoring`, "/facts");
  if (packet.facts.length < 9) push("SP4.quiz_floor", "advisory", `source packet has ${packet.facts.length} fact(s); 9+ is preferred for a 9-question quiz`, "/facts");
  const factIds = new Set<string>();
  for (const [i, f] of (packet.facts ?? []).entries()) {
    if (!f.id || !f.claim) push("SP5.fact_shape", "blocker", `facts[${i}] missing id or claim`, `/facts/${i}`);
    if (factIds.has(f.id)) push("SP6.fact_id_duplicate", "blocker", `duplicate fact id ${f.id}`, `/facts/${i}/id`);
    factIds.add(f.id);
    if (!f.mechanism || !f.commonError || !f.whyWrong) push("SP7.fact_pedagogy", "blocker", `fact ${f.id} must include mechanism, commonError, and whyWrong`, `/facts/${i}`);
  }
  const caseIds = new Set<string>();
  for (const [i, c] of (packet.namedCases ?? []).entries()) {
    if (!c.id || !c.label) push("SP8.case_shape", "blocker", `namedCases[${i}] missing id or label`, `/namedCases/${i}`);
    if (caseIds.has(c.id)) push("SP9.case_id_duplicate", "blocker", `duplicate namedCase id ${c.id}`, `/namedCases/${i}/id`);
    caseIds.add(c.id);
    if (c.realWorld && c.hardSpecifics.length < 2) push("SP10.case_specifics", "blocker", `real-world namedCase ${c.id} lacks 2+ hardSpecifics`, `/namedCases/${i}/hardSpecifics`);
    const supportText = `${c.summary} ${c.hardSpecifics.join(" ")}`.toLowerCase();
    if (c.realWorld && c.hardSpecifics.some((s) => !supportText.includes(s.toLowerCase().split(/\s+/)[0] ?? ""))) {
      push("SP11.case_specifics_visible", "advisory", `namedCase ${c.id} hardSpecifics should be visible in summary/source notes`, `/namedCases/${i}`);
    }
  }
  if (!Array.isArray(packet.allowedAnchors) || packet.allowedAnchors.length === 0) push("SP12.anchors", "blocker", "source packet has no allowed source anchors", "/allowedAnchors");
  if (packet.sourceQuality.status === "blocked") push("SP13.source_quality", "blocker", `sourceQuality is blocked: ${packet.sourceQuality.risks.join("; ")}`);
  return findings;
}

export function checkSourcePacketGate(bookId: string, roots: CompilerStoreRoots = {}): PacketGateReport {
  const normalized = normSlug(bookId);
  const findings: PacketGateFinding[] = [];
  const chapters = expectedSourceChapters(normalized, { stateRoot: roots.stateRoot });
  for (const chapterNumber of chapters) {
    const path = sourcePacketPath(normalized, chapterNumber, roots);
    try {
      const packet = readJsonFile<SourcePacketV1>(path);
      findings.push(...validateSourcePacket(packet));
    } catch (err) {
      findings.push({ checkId: "SP0.missing_or_malformed", severity: "blocker", chapterNumber, path, message: `missing/unreadable source packet: ${(err as Error).message}` });
    }
  }
  return { bookId: normalized, passed: !findings.some((f) => f.severity === "blocker"), chaptersChecked: chapters.length, findings };
}

export function formatSourcePacketGateReport(report: PacketGateReport): string {
  const blockers = report.findings.filter((f) => f.severity === "blocker").length;
  const advisories = report.findings.filter((f) => f.severity === "advisory").length;
  const lines = [`source-packet-gate: ${report.passed ? "PASS" : "BLOCK"} (${report.chaptersChecked} chapter(s), ${blockers} blocker(s), ${advisories} advisory)`];
  for (const f of report.findings) {
    lines.push(`  [${f.severity.toUpperCase()} ${f.checkId}] ${f.chapterNumber ? `ch${String(f.chapterNumber).padStart(2, "0")}: ` : ""}${f.message}${f.path ? ` (${f.path})` : ""}`);
  }
  return lines.join("\n");
}
