import { expectedSourceChapters } from "../qc/sourceV2Gate.js";
import {
  bookRiskPath,
  evidenceMapPath,
  readJsonFile,
  riskScorePath,
  sourcePacketPath,
  writeJsonFile,
  type CompilerStoreRoots,
} from "../artifacts/artifactStore.js";
import {
  RISK_SCORE_SCHEMA_VERSION,
  type BookRiskScoreV1,
  type ChapterEvidenceMapV1,
  type ChapterRiskScoreV1,
  type SourcePacketV1,
} from "../artifacts/artifactTypes.js";
import { normSlug } from "../lib/chapterPaths.js";
import { loadBookRubricMetricsArtifact } from "../metrics/bookRubricMetrics.js";

export type RiskScoreResult = { bookId: string; written: string[]; report: BookRiskScoreV1; findings: string[] };

/** Chapter numbers the rubric pre-flight artifact (if any) marks `fail`. Empty when no artifact
 *  exists — risk scoring is decoupled from whether the pre-flight has run yet. */
function loadRubricFailSet(bookId: string, roots: CompilerStoreRoots): Set<number> {
  const report = loadBookRubricMetricsArtifact(bookId, roots);
  const set = new Set<number>();
  if (!report) return set;
  for (const ch of report.chapters) {
    if (ch.verdict === "fail") set.add(ch.chapterNumber);
  }
  return set;
}

function laneFromScore(score: number): ChapterRiskScoreV1["lane"] {
  if (score >= 7) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function actionFromLane(lane: ChapterRiskScoreV1["lane"]): ChapterRiskScoreV1["recommendedAction"] {
  return lane === "high" ? "qc-shadow" : "formal-qc";
}

export type ChapterRiskInputs = {
  /** Set when the rubric pre-flight artifact marks THIS chapter `fail` (P04). Adds +3 so the
   *  chapter clears the high-risk lane and gets narrow QC-shadow visibility even in shadow mode.
   *  A missing rubric artifact leaves this undefined and contributes nothing. */
  rubricFail?: boolean;
};

export function scoreChapterRisk(packet: SourcePacketV1, evidence?: ChapterEvidenceMapV1, inputs: ChapterRiskInputs = {}): ChapterRiskScoreV1 {
  const reasons: string[] = [];
  let score = 0;
  if (packet.sourceQuality.status === "thin") { score += 4; reasons.push("source packet is thin"); }
  if (packet.sourceQuality.status === "adequate") { reasons.push("source packet is adequate but clean"); }
  if (packet.facts.length < 9) { score += 2; reasons.push(`only ${packet.facts.length} fact(s) for quiz/learning pack`); }
  const weakCases = packet.namedCases.filter((c) => c.realWorld && c.hardSpecifics.length < 2).length;
  if (weakCases > 0) { score += 4; reasons.push(`${weakCases} real-world named case(s) lack 2+ hardSpecifics`); }
  if (evidence) {
    if (evidence.summary.unsupportedAnchorIds.length > 0) { score += 6; reasons.push("evidence map has unsupported source anchors"); }
    if (evidence.summary.unsupportedNumbers.length > 1) { score += Math.min(3, evidence.summary.unsupportedNumbers.length - 1); reasons.push(`${evidence.summary.unsupportedNumbers.length} unsupported number(s) surfaced`); }
    if (evidence.summary.unsupportedEntities.length > 12) { score += 1; reasons.push("many entities were not visible in source packet"); }
    if (evidence.summary.factCoverage < 0.2) { score += 1; reasons.push("low source anchor coverage"); }
  } else {
    score += 3; reasons.push("evidence map missing");
  }
  if (inputs.rubricFail) { score += 3; reasons.push("rubric pre-flight FAIL (readability/tell/transfer/memorable) — route to qc-shadow"); }
  const lane = laneFromScore(score);
  return {
    schemaVersion: RISK_SCORE_SCHEMA_VERSION,
    bookId: packet.bookId,
    chapterId: packet.chapterId,
    chapterNumber: packet.chapterNumber,
    score,
    lane,
    reasons,
    recommendedAction: actionFromLane(lane),
  };
}

export function computeBookRisk(bookId: string, roots: CompilerStoreRoots = {}): RiskScoreResult {
  const normalized = normSlug(bookId);
  const written: string[] = [];
  const findings: string[] = [];
  const chapters: ChapterRiskScoreV1[] = [];
  // Rubric pre-flight (P04) routing: if a rubric-metrics artifact exists, chapters it marks
  // `fail` get a +3 risk bump (→ qc-shadow visibility). Missing artifact contributes nothing.
  const rubricFailByNumber = loadRubricFailSet(normalized, roots);
  for (const chapterNumber of expectedSourceChapters(normalized, { stateRoot: roots.stateRoot })) {
    try {
      const packet = readJsonFile<SourcePacketV1>(sourcePacketPath(normalized, chapterNumber, roots));
      let evidence: ChapterEvidenceMapV1 | undefined;
      try { evidence = readJsonFile<ChapterEvidenceMapV1>(evidenceMapPath(normalized, chapterNumber, roots)); } catch { evidence = undefined; }
      const risk = scoreChapterRisk(packet, evidence, { rubricFail: rubricFailByNumber.has(chapterNumber) });
      writeJsonFile(riskScorePath(normalized, chapterNumber, roots), risk);
      written.push(riskScorePath(normalized, chapterNumber, roots));
      chapters.push(risk);
    } catch (err) {
      findings.push(`ch${String(chapterNumber).padStart(2, "0")}: ${(err as Error).message}`);
    }
  }
  const max = chapters.reduce((m, ch) => Math.max(m, ch.score), 0);
  const lane = laneFromScore(max);
  const bookWideRisks: string[] = [];
  const high = chapters.filter((ch) => ch.lane === "high");
  if (high.length > 0) bookWideRisks.push(`${high.length} high-risk chapter(s) should receive narrow QC shadow before formal QC`);
  const report: BookRiskScoreV1 = { schemaVersion: RISK_SCORE_SCHEMA_VERSION, bookId: normalized, generatedAt: new Date().toISOString(), lane, chapters, bookWideRisks };
  const out = bookRiskPath(normalized, roots);
  writeJsonFile(out, report);
  written.push(out);
  return { bookId: normalized, written, report, findings };
}

export function formatBookRisk(report: BookRiskScoreV1): string {
  const counts = { low: 0, medium: 0, high: 0 };
  for (const ch of report.chapters) counts[ch.lane] += 1;
  const lines = [`risk-score: ${report.lane.toUpperCase()} (low ${counts.low} · medium ${counts.medium} · high ${counts.high})`];
  for (const ch of report.chapters) lines.push(`  ch${String(ch.chapterNumber).padStart(2, "0")}: ${ch.lane} score=${ch.score}${ch.reasons.length ? ` — ${ch.reasons.join("; ")}` : ""}`);
  for (const risk of report.bookWideRisks) lines.push(`  [BOOK] ${risk}`);
  return lines.join("\n");
}
