import { existsSync } from "fs";

import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { SOURCE_PACKET_SCHEMA_VERSION } from "../artifacts/artifactTypes.js";
import { resolveExpectedSourceChapters } from "../qc/sourceV2Gate.js";
import { readJsonFile, sourcePacketPath, sourceUsePlanPath, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
import { normSlug } from "../lib/chapterPaths.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import { validateSourceUsePlan } from "../contracts/sourceUsePlan.js";
import { rankTeachingFacts, WEAK_RANKING_MIN_SCORE } from "./sourcePacketFacts.js";
import { sourceUsePlanStale } from "./sourceUsePlanCompiler.js";

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
  // SP14: templated source. The book-wide dedup pass (compileSourcePackets) tags facts whose
  // claim recurs across a majority of chapters — boilerplate the researcher restamped everywhere
  // instead of chapter-specific facts. A chapter with almost no chapter-specific facts forces every
  // section writer to teach the same book-wide claims, which the section gate then blocks book-wide
  // (SEC90 phrase budget, SEC83 summary n-gram, AS5/AS6 quiz reuse). Failing closed here — before
  // blueprints and the whole write phase — turns a doomed multi-round QC churn into an immediate
  // "re-research this chapter" signal. Only meaningful once there are enough facts to judge (SP3).
  if (Array.isArray(packet.facts) && packet.facts.length >= 6) {
    const chapterSpecific = packet.facts.filter((f) => !f.bookWideDuplicate).length;
    if (chapterSpecific < 3) {
      push(
        "SP14.templated_source",
        "blocker",
        `only ${chapterSpecific} of ${packet.facts.length} facts are chapter-specific; the rest restate book-wide claims shared across most chapters. Writing from near-identical facts produces cross-chapter templating the section gate blocks. Re-research this chapter for facts drawn from its own content, not the book's overall framework.`,
        "/facts",
      );
    }
  }
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
    // SP16 (A2): atomic specifics. A hardSpecifics entry is meant to be a short, atomic,
    // checkable detail ("red phone", "90-second trial") the writer can weave into prose.
    // A long label-PHRASE ("the four acute care hospitals across the region over four
    // years") forces the writer to recite it verbatim, which reads as pasted source notes
    // and trips the recitation/seam gates downstream. ADVISORY only — one per case, never
    // a blocker: long specifics are a style risk, not a correctness defect.
    const longSpecific = (c.hardSpecifics ?? []).find((s) => String(s ?? "").trim().split(/\s+/).filter(Boolean).length > 6);
    if (longSpecific !== undefined) {
      const first8 = String(longSpecific).trim().split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
      push(
        "SP16.atomic_specifics",
        "advisory",
        `hardSpecific "${first8}…" is a long label-phrase; prefer short atomic specifics ("red phone", "90-second trial") — long phrases force recitation into prose`,
        `/namedCases/${i}/hardSpecifics`,
      );
    }
  }
  if (!Array.isArray(packet.allowedAnchors) || packet.allowedAnchors.length === 0) push("SP12.anchors", "blocker", "source packet has no allowed source anchors", "/allowedAnchors");
  if (packet.sourceQuality.status === "blocked") push("SP13.source_quality", "blocker", `sourceQuality is blocked: ${packet.sourceQuality.risks.join("; ")}`);
  // SP15 (P13): weak pedagogical ranking. An ADVISORY early signal that research is thin — the
  // packet clears the fact floor but few facts score as solid teaching material (distinct AND
  // carrying a mechanism/case/misconception/number). Advisory, never blocking: it flags likely
  // restatement/low-insight before it shows up as a rubric Density/Insight miss, without gating a
  // book. Only meaningful once there are enough facts to judge (SP3 floor).
  if (Array.isArray(packet.facts) && packet.facts.length >= 6) {
    const strong = rankTeachingFacts(packet).filter((r) => r.score >= WEAK_RANKING_MIN_SCORE).length;
    if (strong < 4) {
      push(
        "SP15.weak_ranking",
        "advisory",
        `only ${strong} fact(s) score as solid teaching material (>= ${WEAK_RANKING_MIN_SCORE}: chapter-distinct plus a mechanism, named case, misconception, or grounded number). Thin research risks restatement/low-insight prose; prefer re-researching for chapter-distinct, mechanism-bearing facts.`,
        "/facts",
      );
    }
  }
  return findings;
}

/** IMP-03 (SP15/SP16): a PRESENT source-use plan must be contract-valid and
 *  hash-fresh against the packet on disk — invalid or stale is a BLOCKER
 *  (authoring would fail-close on it anyway; the gate says so earlier and
 *  names the fix). An ABSENT plan is an advisory only: legacy/pre-IMP-03 books
 *  author exactly as before, and absence never grants any license. Additive
 *  strengthening — no existing check is loosened. */
function validateSourceUsePlanArtifact(
  bookId: string,
  chapterNumber: number,
  packet: SourcePacketV1,
  roots: CompilerStoreRoots,
): PacketGateFinding[] {
  const findings: PacketGateFinding[] = [];
  const planPath = sourceUsePlanPath(bookId, chapterNumber, roots);
  if (!existsSync(planPath)) {
    findings.push({
      checkId: "SP15.plan_missing",
      severity: "advisory",
      chapterNumber,
      path: planPath,
      message: "no source-use plan compiled for this packet (pre-IMP-03 book) — recompile source packets to mint one; absence grants nothing",
    });
    return findings;
  }
  let plan: SourceUsePlanV1;
  try {
    plan = readJsonFile<SourceUsePlanV1>(planPath);
  } catch (err) {
    findings.push({ checkId: "SP15.plan_unreadable", severity: "blocker", chapterNumber, path: planPath, message: `source-use plan unreadable: ${(err as Error).message}` });
    return findings;
  }
  const errors = validateSourceUsePlan(plan);
  if (errors.length > 0) {
    findings.push({ checkId: "SP15.plan_invalid", severity: "blocker", chapterNumber, path: planPath, message: `source-use plan fails its frozen contract: ${errors.slice(0, 4).join("; ")}` });
    return findings;
  }
  const stale = sourceUsePlanStale(plan, packet);
  if (stale) {
    findings.push({ checkId: "SP16.plan_stale", severity: "blocker", chapterNumber, path: planPath, message: `source-use plan is stale — ${stale}; recompile source packets` });
  }
  return findings;
}

export function checkSourcePacketGate(bookId: string, roots: CompilerStoreRoots = {}): PacketGateReport {
  const normalized = normSlug(bookId);
  const findings: PacketGateFinding[] = [];
  const resolved = resolveExpectedSourceChapters(normalized, { stateRoot: roots.stateRoot });
  findings.push(...resolved.findings);
  if (!resolved.ok || resolved.chapters.length === 0) {
    findings.push({ checkId: "SP0.no_chapters", severity: "blocker", message: `No expected source chapters found for ${normalized}.` });
  }
  const chapters = resolved.chapters;
  for (const chapterNumber of chapters) {
    const path = sourcePacketPath(normalized, chapterNumber, roots);
    try {
      const packet = readJsonFile<SourcePacketV1>(path);
      findings.push(...validateSourcePacket(packet));
      findings.push(...validateSourceUsePlanArtifact(normalized, chapterNumber, packet, roots));
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
