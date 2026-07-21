/**
 * THE single definition of the v21 "deterministic battery" — the pure-code gates
 * (no model judgment, no formal QC round) a chapter must pass:
 *
 *   source-v2 · ship-gate · author-check · intra-book · book-gate · plan-enforcement
 *
 * WHY THIS MODULE EXISTS.  finalizeQcRound computed these six inline, and the
 * standalone CLI gates (gate-chapter / book-gate / source-v2-gate) computed an
 * overlapping set separately — two lists that could drift (the bug class this
 * pipeline keeps getting bitten by). The stale-round treadmill that stalled
 * the-power-of-full-engagement for ~6 rounds was deterministic NITS discovered
 * INSIDE expensive formal QC rounds (15-36 reviewer submissions each): an
 * em-dash fix introduced a 38-word sentence, a shape-plan slot, a dangling
 * anchor — each surfaced one-at-a-time, each costing a whole round.
 *
 * `evaluateDeterministic` is the shared evaluator that BOTH finalize AND the cheap
 * `qc-converge` preflight call. Because they call the same code, "qc-converge
 * reports CLEAN" provably means "finalize will surface zero deterministic
 * findings" — so the operator converges the deterministic layer locally and for
 * free, then spends exactly ONE formal round on the irreducibly-semantic layer
 * (sweep / keyA / keyB / bar / confirm).
 *
 * Read-only: no round / ledger / attestation writes. The six gate entry points it
 * calls are themselves pure over on-disk content + source sidecars + plan
 * artifacts; this module only aggregates them.
 *
 * Scope note: `repairLedger` and `majors` are round-state, NOT pure content, so
 * they stay in finalize and are deliberately absent here.
 */

import { checkAuthoringContract } from "../../critics/authoringContract.js";
import { runBookGate, type BookGateReport } from "../../critics/bookGate.js";
import type { BookPatternAuditReport } from "../../critics/bookPatternAudit.js";
import { runShipGate, type GateReport } from "../../critics/finalGate.js";
import { loadChapterSidecar } from "../../critics/sourceGrounding.js";
import { runIntraBookChecks } from "../../critics/intraBook.js";
import type { ChapterV21, CriticFinding } from "../../types.js";
import type { ACFinding } from "../../critics/authoringContract.js";
import { checkSourceV2Gate, type SourceV2GateReport } from "../sourceV2Gate.js";
import { checkPlanEnforcement, type PlanFinding } from "../planEnforcement.js";
import { classDefectBanner, groupByClassDefect } from "./findingGrouping.js";

/** The six deterministic checks each resolve to PASS or FAIL (no MISSING/STALE —
 *  those are semantic/round-state concerns that live in finalize). */
export type DetStatus = "PASS" | "FAIL";

export type DeterministicChecks = {
  sourceV2: DetStatus;
  shipGate: DetStatus;
  authorCheck: DetStatus;
  intraBook: DetStatus;
  bookGate: DetStatus;
  planEnforcement: DetStatus;
};

export type DeterministicGate = keyof DeterministicChecks;

/** A flattened, render-ready deterministic finding (the union of all six gates'
 *  finding shapes). `severity` is left as a string so the four gates' distinct
 *  severity unions compose without friction. */
export type ConvergeFinding = {
  scope: "chapter" | "book";
  chapterNumber?: number;
  gate: DeterministicGate;
  catalogId: string;
  severity: string;
  unit: string;
  message: string;
  evidence?: string;
};

export type DeterministicChapterEval = {
  chapterNumber: number;
  chapterId: string;
  checks: DeterministicChecks;
  /** The raw gate outputs — reused by finalize for finalizerFindings/rawByChapter. */
  raw: {
    source: SourceV2GateReport;
    shipGate: GateReport;
    authorFindings: ACFinding[];
    intraFindings: CriticFinding[];
    planFindings: PlanFinding[];
  };
  /** The FAIL-driving findings for this chapter (for rendering). */
  findings: ConvergeFinding[];
};

export type DeterministicReport = {
  bookId: string;
  /** Every selected chapter passes all six deterministic checks. */
  clean: boolean;
  bookGate: BookGateReport;
  /** Cross-chapter book-gate findings that drove a FAIL (blockers + majors). */
  bookFindings: ConvergeFinding[];
  perChapter: Map<number, DeterministicChapterEval>;
};

/**
 * Run the full deterministic battery over `chapters` (the selected subset), using
 * `allChapters` for the cross-chapter checks (book-gate, plan-enforcement, and the
 * prior-chapter siblings intra-book compares against). This mirrors EXACTLY what
 * finalizeQcRound computes for these six checks — see finalize.ts (the per-chapter
 * `checks.{sourceV2,shipGate,authorCheck,intraBook,bookGate,planEnforcement}`
 * assignments) — so a CLEAN result here guarantees finalize raises no deterministic
 * finding.
 */
export function evaluateDeterministic(
  bookId: string,
  chapters: ChapterV21[],
  allChapters: ChapterV21[],
  patternAudit?: BookPatternAuditReport,
): DeterministicReport {
  // Book-level checks computed ONCE (exemplar ownership + cross-chapter patterns).
  const bookGate = runBookGate(bookId, allChapters, { patternAudit });
  const bookGateStatus: DetStatus = bookGate.passed ? "PASS" : "FAIL";
  const planFindingsAll = checkPlanEnforcement(bookId, allChapters);

  const bookFindings: ConvergeFinding[] = bookGate.passed
    ? []
    : bookGate.findings
        .filter((f) => f.severity !== "minor")
        .map((f) => ({
          scope: "book" as const,
          gate: "bookGate" as const,
          catalogId: f.catalogId,
          severity: String(f.severity),
          unit: f.chapters?.length ? `ch ${f.chapters.join(", ")}` : "",
          message: f.message,
          evidence: f.evidence,
        }));

  let clean = bookGateStatus === "PASS";
  const perChapter = new Map<number, DeterministicChapterEval>();

  for (const ch of chapters) {
    const source = checkSourceV2Gate(bookId, [ch.number]);
    const shipGate = runShipGate(ch);
    const authorFindings = checkAuthoringContract(ch, {
      sidecar: loadChapterSidecar(ch.chapterId),
      filePath: `state/chapters/${ch.chapterId}.v21-native.chapter.json`,
    });
    const intraFindings = runIntraBookChecks(ch, allChapters.filter((o) => o.number < ch.number));
    const planFindings = planFindingsAll.filter((f) => f.chapterNumber === ch.number);

    const checks: DeterministicChecks = {
      sourceV2: source.passed ? "PASS" : "FAIL",
      shipGate: shipGate.blockers.length === 0 ? "PASS" : "FAIL",
      // Severity-aware (matches finalize's openSerious = blocker/major): the gate must not be
      // STRICTER than the publish decision it feeds. Today every authoring-contract finding is
      // "major" so this is behaviour-identical, but ACSeverity also permits "minor" — a future
      // minor AC check must NOT REVISE a chapter on its own. (intraBook below is already blocker-only.)
      authorCheck: authorFindings.some((f) => f.severity === "blocker" || f.severity === "major") ? "FAIL" : "PASS",
      intraBook: intraFindings.some((f) => f.severity === "blocker") ? "FAIL" : "PASS",
      bookGate: bookGateStatus,
      planEnforcement: planFindings.length === 0 ? "PASS" : "FAIL",
    };

    // The FAIL-driving findings only — exactly what makes each check fail in
    // finalize (ship-gate + intra-book on BLOCKERS; author-check on BLOCKER/MAJOR;
    // plan-enforcement on ANY finding (always blocker); source-v2 fails when not passed).
    const findings: ConvergeFinding[] = [];
    if (!source.passed) {
      for (const f of source.findings) {
        findings.push({ scope: "chapter", chapterNumber: ch.number, gate: "sourceV2", catalogId: String(f.checkId), severity: String(f.severity), unit: "", message: f.message });
      }
    }
    for (const f of shipGate.blockers) {
      findings.push({ scope: "chapter", chapterNumber: ch.number, gate: "shipGate", catalogId: f.catalogId, severity: String(f.severity), unit: f.unit, message: f.message, evidence: f.evidence });
    }
    for (const f of authorFindings.filter((x) => x.severity === "blocker" || x.severity === "major")) {
      findings.push({ scope: "chapter", chapterNumber: ch.number, gate: "authorCheck", catalogId: f.checkId, severity: String(f.severity), unit: f.unit, message: f.message, evidence: f.evidence });
    }
    for (const f of intraFindings.filter((x) => x.severity === "blocker")) {
      findings.push({ scope: "chapter", chapterNumber: ch.number, gate: "intraBook", catalogId: String(f.checkId), severity: String(f.severity), unit: "", message: f.message, evidence: f.evidence });
    }
    for (const f of planFindings) {
      findings.push({ scope: "chapter", chapterNumber: ch.number, gate: "planEnforcement", catalogId: f.checkId, severity: String(f.severity), unit: "", message: f.message, evidence: f.evidence });
    }

    if (
      checks.sourceV2 !== "PASS" ||
      checks.shipGate !== "PASS" ||
      checks.authorCheck !== "PASS" ||
      checks.intraBook !== "PASS" ||
      checks.bookGate !== "PASS" ||
      checks.planEnforcement !== "PASS"
    ) {
      clean = false;
    }

    perChapter.set(ch.number, {
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      checks,
      raw: { source, shipGate, authorFindings, intraFindings, planFindings },
      findings,
    });
  }

  return { bookId, clean, bookGate, bookFindings, perChapter };
}

const SEVERITY_RANK: Record<string, number> = { blocker: 0, major: 1, minor: 2, advisory: 3 };

function severityRank(sev: string): number {
  return SEVERITY_RANK[sev] ?? 99;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function renderFindingLine(f: ConvergeFinding): string {
  const loc = f.unit ? `${f.unit}: ` : "";
  const ev = f.evidence ? ` — "${truncate(f.evidence, 140)}"` : "";
  return `  - [${f.catalogId}] ${loc}${f.message}${ev}`;
}

/** Render a set of findings grouped by CLASS DEFECT (shared banner wording with
 *  the repair prompt), best-severity group first. */
function renderGroupedFindings(findings: ConvergeFinding[]): string[] {
  const lines: string[] = [];
  const groups = groupByClassDefect(findings, (f) => f.catalogId, (f) => f.unit || f.catalogId);
  const groupSeverity = (g: { items: ConvergeFinding[] }) => Math.min(...g.items.map((f) => severityRank(f.severity)));
  groups.sort((a, b) => groupSeverity(a) - groupSeverity(b));
  for (const g of groups) {
    if (g.isClassDefect) lines.push(`  - ${classDefectBanner(g.repairClass, g.items.length, g.container)}`);
    for (const f of g.items.slice().sort((x, y) => severityRank(x.severity) - severityRank(y.severity))) {
      lines.push(renderFindingLine(f));
    }
  }
  return lines;
}

/** Human-readable convergence report. CLEAN never implies publishability — it
 *  explicitly states that semantic review still requires a formal round. */
export function renderConvergeReport(report: DeterministicReport): string {
  const chapters = [...report.perChapter.values()].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const chaptersWithFindings = chapters.filter((c) => c.findings.length > 0);
  const totalFindings = chaptersWithFindings.reduce((s, c) => s + c.findings.length, 0) + report.bookFindings.length;
  const lines: string[] = [];

  if (report.clean) {
    lines.push(`DETERMINISTIC-CLEAN — ${report.bookId} (${chapters.length} chapter${chapters.length === 1 ? "" : "s"})`);
    lines.push("  All deterministic gates pass (source-v2, ship-gate, author-check, intra-book, book-gate, plan-enforcement).");
    lines.push("  NOT a publishability verdict: semantic review (sweep, keyA/keyB, bar, confirm) still requires ONE formal qc-auto round.");
    return lines.join("\n") + "\n";
  }

  lines.push(`DETERMINISTIC-DIRTY — ${report.bookId}: ${totalFindings} finding(s) across ${chaptersWithFindings.length} chapter(s)${report.bookFindings.length ? ` + ${report.bookFindings.length} book-level` : ""}`);
  lines.push("  Fix ALL of these in ONE pass, then re-run qc-converge until CLEAN before opening a formal round (each formal round costs 15-36 reviewer submissions).");
  if (report.bookFindings.length) {
    lines.push("");
    lines.push("book-level:");
    lines.push(...renderGroupedFindings(report.bookFindings));
  }
  for (const c of chaptersWithFindings) {
    lines.push("");
    lines.push(`ch${String(c.chapterNumber).padStart(2, "0")}:`);
    lines.push(...renderGroupedFindings(c.findings));
  }
  return lines.join("\n") + "\n";
}

/** Machine-readable view for `qc-converge --json`. */
export function convergeReportJson(report: DeterministicReport): unknown {
  return {
    bookId: report.bookId,
    clean: report.clean,
    bookFindings: report.bookFindings,
    chapters: [...report.perChapter.values()].map((c) => ({
      chapterNumber: c.chapterNumber,
      chapterId: c.chapterId,
      checks: c.checks,
      findings: c.findings,
    })),
  };
}
