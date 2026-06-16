import type { BookGateReport } from "../../critics/bookGate.js";
import type { ACFinding } from "../../critics/authoringContract.js";
import type { GateFinding, GateReport } from "../../critics/finalGate.js";
import type { AxisScore } from "../../critics/semantic/publishableBar.js";
import type { ManualKeyJudgeRecord } from "../manualKeyJudge.js";
import type { MajorFindingSnapshot } from "../majorDisposition.js";
import type { SourceV2GateReport } from "../sourceV2Gate.js";
import type { SweepRecord } from "../sweep.js";
import type { EvidenceChapterDecision } from "./finalize.js";
import type { SubmissionFinding, ValidatedBarReadSubmission, ValidatedConfirmReadSubmission } from "./schemas.js";

export type FinalizerRawEvidence = {
  source: SourceV2GateReport;
  authorFindings: ACFinding[];
  shipGate: GateReport;
  intraFindings: Array<{ checkId?: string; severity?: string; message: string; evidence?: string; unit?: string }>;
  bookGate: BookGateReport;
  sweepRecord: SweepRecord | null;
  keyJudge: ManualKeyJudgeRecord | null;
  bar: ValidatedBarReadSubmission | null;
  confirm: ValidatedConfirmReadSubmission | null;
  confirmAccepted: boolean;
};

function chapterLabel(n: number): string {
  return `ch${String(n).padStart(2, "0")}`;
}

function nonemptyText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "QC failed this check, but did not provide a more specific quote.";
}

function severity(value: unknown): SubmissionFinding["severity"] {
  return value === "blocker" || value === "major" || value === "minor" || value === "advisory" ? value : "blocker";
}

function gateFindingToRepair(chapterNumber: number, f: GateFinding): SubmissionFinding {
  return {
    chapterNumber,
    unitId: f.unit,
    repairClass: f.catalogId,
    severity: severity(f.severity),
    quote: nonemptyText(f.evidence, f.message),
    problem: f.message,
    expectedFix: `Repair ${f.unit} so the ${f.catalogId} ship-gate finding no longer fires; rerun author-check and gate-chapter.`,
    globalTheme: f.catalogId,
  };
}

function majorFindingToRepair(f: MajorFindingSnapshot, chapterNumber?: number): SubmissionFinding {
  const scopeChapter = f.scope.match(/^chapter:(\d+):/);
  const parsedChapter = scopeChapter ? Number(scopeChapter[1]) : undefined;
  return {
    chapterNumber: chapterNumber ?? parsedChapter,
    unitId: f.scope,
    repairClass: f.checkId,
    severity: "major",
    quote: nonemptyText(f.evidence, f.message),
    problem: `Current unresolved major ${f.id}: ${f.message}`,
    expectedFix: f.scope === "book"
      ? "Repair the book-wide pattern across all affected chapters, then rerun book-gate and major-status."
      : "Repair the current major finding in this chapter, then rerun author-check, gate-chapter, and major-status.",
    globalTheme: "major",
  };
}

function axisFinding(chapterNumber: number, axis: AxisScore, quote: string, problem: string): SubmissionFinding {
  return {
    chapterNumber,
    unitId: axis.hits[0]?.unitId ?? `bar.${axis.axis}`,
    repairClass: axis.axis,
    severity: axis.tier === "CORRUPTION" ? "blocker" : axis.score < 0.6 ? "major" : "advisory",
    quote,
    problem,
    expectedFix: `Repair the ${axis.axis} defect and rerun author-check/gate-chapter before starting a fresh QC round.`,
    globalTheme: axis.axis,
  };
}

export function findingsFromEvidenceDecision(decision: EvidenceChapterDecision, raw: FinalizerRawEvidence): SubmissionFinding[] {
  const out: SubmissionFinding[] = [];
  const chapterNumber = decision.chapterNumber;

  if (decision.checks.sourceV2 === "FAIL") {
    for (const f of raw.source.findings.filter((x) => x.chapterNumber === undefined || x.chapterNumber === chapterNumber)) {
      out.push({
        chapterNumber,
        unitId: `source-v2/${chapterLabel(chapterNumber)}`,
        repairClass: "source_v2",
        severity: "blocker",
        quote: nonemptyText(f.message),
        problem: f.message,
        expectedFix: "Repair the source-v2 sidecar or rerun source-v2 research, then regenerate authoring prompts and the chapter from source notes.",
        globalTheme: "source_v2",
      });
    }
  }

  if (decision.checks.authorCheck === "FAIL") {
    for (const f of raw.authorFindings) {
      out.push({
        chapterNumber,
        unitId: f.unit,
        repairClass: f.checkId,
        severity: severity(f.severity),
        quote: nonemptyText(f.evidence, f.message),
        problem: `${f.job}: ${f.message}`,
        expectedFix: "Re-author the field from source notes; do not surface-dodge the check. Rerun author-check after editing.",
        globalTheme: f.checkId,
      });
    }
  }

  if (decision.checks.shipGate === "FAIL") {
    for (const f of [...raw.shipGate.blockers, ...raw.shipGate.majors]) {
      out.push(gateFindingToRepair(chapterNumber, f));
    }
  }

  if (decision.checks.intraBook === "FAIL") {
    for (const f of raw.intraFindings.filter((x) => x.severity === "blocker")) {
      out.push({
        chapterNumber,
        unitId: f.unit ?? f.checkId ?? "intra-book",
        repairClass: f.checkId ?? "intra_book",
        severity: "blocker",
        quote: nonemptyText(f.evidence, f.message),
        problem: f.message,
        expectedFix: "Repair the repeated cross-chapter pattern against prior/current chapters, then rerun gate-chapter.",
        globalTheme: "intra_book",
      });
    }
  }

  if (decision.checks.bookGate === "FAIL") {
    for (const f of raw.bookGate.findings.filter((x) => x.severity === "blocker" || x.severity === "major")) {
      out.push({
        // Chapter-scoped book-gate findings (F1, BP28/BP29, B-class) carry the
        // offending chapters so repair targets only those; book-wide findings
        // (e.g. F3) leave chapters undefined and repair addresses the whole book.
        chapters: f.chapters,
        unitId: "book",
        repairClass: f.catalogId,
        severity: severity(f.severity),
        quote: nonemptyText(f.evidence, f.message),
        problem: f.message,
        expectedFix: f.chapters?.length
          ? "Repair the named offending chapters so the cross-chapter pattern no longer fires; rerun book-gate before a fresh QC round."
          : "Repair the book-wide pattern, not one isolated chapter; rerun book-gate before a fresh QC round.",
        globalTheme: "book_gate",
      });
    }
  }

  if (decision.checks.majors === "FAIL") {
    for (const f of decision.majorStatus.chapter) out.push(majorFindingToRepair(f, chapterNumber));
    for (const f of decision.majorStatus.book) out.push(majorFindingToRepair(f));
  }

  if (decision.checks.manualKeyJudge === "FAIL" || decision.checks.manualKeyJudge === "NEEDS_ADJUDICATION") {
    const mismatches = raw.keyJudge?.mismatches ?? [];
    const disagreements = raw.keyJudge?.disagreements ?? [];
    if (mismatches.length > 0) {
      for (const mismatch of mismatches) {
        out.push({
          chapterNumber,
          unitId: `quiz.q${String(mismatch.questionIndex + 1).padStart(2, "0")}`,
          repairClass: "manual_keyjudge",
          severity: "blocker",
          quote: `storedIndex=${mismatch.storedIndex}; agreedIndex=${mismatch.agreedIndex}`,
          problem: raw.keyJudge?.reason ?? "manual keyjudge found a wrong stored quiz key",
          expectedFix: "Repair the quiz key/question/choices against source facts, then run fresh keyA/keyB QC.",
          globalTheme: "manual_keyjudge",
        });
      }
    }
    if (disagreements.length > 0) {
      out.push({
        chapterNumber,
        unitId: "quiz",
        repairClass: "manual_keyjudge",
        severity: "major",
        quote: `question indices: ${disagreements.join(", ")}`,
        problem: raw.keyJudge?.reason ?? "keyA/keyB need adjudication",
        expectedFix: "Repair ambiguous quiz questions/choices or adjudicate from source facts, then run fresh keyA/keyB QC.",
        globalTheme: "manual_keyjudge",
      });
    }
    if (mismatches.length === 0 && disagreements.length === 0 && raw.keyJudge?.reason) {
      out.push({
        chapterNumber,
        unitId: "quiz",
        repairClass: "manual_keyjudge",
        severity: "major",
        quote: raw.keyJudge.reason,
        problem: raw.keyJudge.reason,
        expectedFix: "Repair quiz evidence or rerun keyA/keyB QC with complete source-backed derivations.",
        globalTheme: "manual_keyjudge",
      });
    }
  }

  if (decision.checks.sweep === "FAIL" && raw.sweepRecord) {
    // F6b: a sweep finding spans many chapters (f.chapters). This function runs
    // once PER chapter, and the old emission stamped a per-chapter `chapterNumber`,
    // so stableFindingId (which keys on chapterNumber when present) minted N
    // distinct ledger ids for ONE cross-chapter finding — inflating the open count
    // (the-daily-stoic's single location_stamping sweep finding became 6). The fix
    // is to DROP the per-chapter chapterNumber (below): with it absent,
    // stableFindingId keys the finding on its sorted `chapters` span, so every
    // spanned chapter's emission collapses to ONE ledger id (appendFindings dedups
    // by findingId). This mirrors the book-gate handler above exactly. NB: do NOT
    // also gate this on `min(f.chapters) === chapterNumber` — on a partial/subset
    // round (or when the min chapter is STALE while siblings still FAIL) the min
    // chapter may never be processed, which would drop the finding entirely.
    for (const f of raw.sweepRecord.findings.filter((x) => x.chapters.includes(chapterNumber))) {
      out.push({
        chapters: f.chapters,
        unitId: f.unitId,
        repairClass: f.family,
        severity: raw.sweepRecord.verdict === "CORRUPTION" ? "blocker" : "major",
        quote: nonemptyText(f.quote),
        problem: f.problem,
        expectedFix: f.expectedFix,
        globalTheme: f.family,
      });
    }
  }

  if ((decision.checks.barRead === "YELLOW" || decision.checks.barRead === "RED") && raw.bar) {
    for (const axis of raw.bar.axes) {
      for (const hit of axis.hits) {
        out.push(axisFinding(chapterNumber, axis, nonemptyText(hit.quote), hit.defect));
      }
      if (axis.hits.length === 0) {
        if (axis.score < 0.6) {
          // P1.5 — a sub-0.6 axis with NO cited hit still REVISEs the chapter.
          // Always synthesise an actionable (major) finding so the chapter has a
          // repair target and is never demoted to NEEDS_MORE_QC with nothing to
          // fix ("non-publishable decision lacked actionable repair evidence").
          out.push(axisFinding(
            chapterNumber,
            axis,
            nonemptyText(raw.bar.notes?.trim(), `bar.${axis.axis} scored ${axis.score.toFixed(2)} below the 0.60 floor`),
            `Bar read scored ${axis.axis} ${axis.score.toFixed(2)} (below the 0.60 floor) but cited no specific hit — re-author this axis to publishable quality.`,
          ));
        } else if (axis.score < 0.85 && raw.bar.notes?.trim()) {
          out.push(axisFinding(chapterNumber, axis, raw.bar.notes.trim(), `Bar read scored ${axis.axis} ${axis.score.toFixed(2)}: ${raw.bar.notes.trim()}`));
        }
      }
    }
  }

  if (raw.confirmAccepted && (decision.checks.confirmRead === "REVISE" || decision.checks.confirmRead === "CORRUPTION") && raw.confirm) {
    out.push(...raw.confirm.findings);
  }

  return out;
}
