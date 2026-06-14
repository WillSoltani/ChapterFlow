import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

import { evidenceMatrixPath, repairBriefPath, repairPromptPath } from "./artifacts.js";
import { effectiveLedger, type EffectiveLedgerFinding } from "./ledger.js";

const SEVERITY_RANK: Record<string, number> = { blocker: 0, major: 1, minor: 2, advisory: 3 };

function chapterLabel(f: EffectiveLedgerFinding): string {
  if (f.chapterNumber !== undefined) return `ch${String(f.chapterNumber).padStart(2, "0")}`;
  if (f.chapters?.length) return `chapters ${f.chapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}`;
  return "book-wide";
}

function chapterPath(bookId: string, n: number): string {
  return `state/chapters/${bookId}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`;
}

function validationCommands(bookId: string, findings: EffectiveLedgerFinding[]): string[] {
  const chapters = [...new Set(findings.flatMap((f) => f.chapterNumber !== undefined ? [f.chapterNumber] : f.chapters ?? []))].sort((a, b) => a - b);
  const lines: string[] = [];
  for (const n of chapters) {
    lines.push(`npx tsx src/cli.ts author-check ${chapterPath(bookId, n)}`);
    lines.push(`npx tsx src/cli.ts gate-chapter ${chapterPath(bookId, n)}`);
  }
  lines.push(`npx tsx src/cli.ts book-gate ${bookId}`);
  return lines;
}

function readEvidenceMatrix(bookId: string, roundId: string): any | null {
  const path = evidenceMatrixPath(bookId, roundId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function failedChecks(decision: any): string[] {
  const checks = decision?.checks ?? {};
  const bad: string[] = [];
  for (const key of ["sourceV2", "authorCheck", "shipGate", "intraBook", "bookGate", "majors", "manualKeyJudge", "barRead", "confirmRead", "sweep", "repairLedger"]) {
    const value = checks[key];
    if (value === undefined) continue;
    const ok = value === "PASS" || value === "GREEN" || value === "PUBLISHABLE" || value === "NO_OPEN_BLOCKERS" || value === "NOT_APPLICABLE";
    if (!ok) bad.push(`${key}=${value}`);
  }
  return bad;
}

function renderFinalizerCauseSection(bookId: string, roundId: string): string[] {
  const matrix = readEvidenceMatrix(bookId, roundId);
  const chapters = Array.isArray(matrix?.chapters) ? matrix.chapters : [];
  if (chapters.length === 0) return [];

  const bookWide = new Map<string, string>();
  const chapterIssues: string[] = [];
  const missing: string[] = [];
  for (const decision of chapters) {
    const label = `ch${String(decision.chapterNumber).padStart(2, "0")}`;
    const failed = failedChecks(decision);
    if (decision.checks?.bookGate === "FAIL") bookWide.set("bookGate", "bookGate=FAIL");
    for (const f of decision.majorStatus?.book ?? []) bookWide.set(`major:${f.id}`, `major ${f.id} ${f.checkId}: ${f.message}`);
    if (decision.finalVerdict === "NEEDS_MORE_QC") {
      missing.push(`${label}: ${decision.reason}${failed.length ? ` (${failed.join(", ")})` : ""}`);
    } else if (decision.finalVerdict === "REVISE" || decision.finalVerdict === "CORRUPTION") {
      chapterIssues.push(`${label}: ${decision.finalVerdict}; ${failed.join(", ") || decision.reason}`);
    }
  }
  const lines: string[] = [];
  if (bookWide.size === 0 && chapterIssues.length === 0 && missing.length === 0) return lines;
  lines.push("Why QC returned REVISE:");
  if (bookWide.size > 0) {
    lines.push("- book-wide issues:");
    for (const item of bookWide.values()) lines.push(`  - ${item}`);
  }
  if (chapterIssues.length > 0) {
    lines.push("- chapter issues:");
    for (const item of chapterIssues) lines.push(`  - ${item}`);
  }
  if (missing.length > 0) {
    lines.push("- missing evidence / needs-more-qc:");
    for (const item of missing) lines.push(`  - ${item}`);
  }
  lines.push("");
  return lines;
}

export function renderRepairBriefMarkdown(bookId: string, roundId: string, findings = effectiveLedger(bookId, roundId)): string {
  const active = findings.filter((f) => f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun");
  const lines: string[] = [];
  lines.push(`# Repair brief — ${bookId} (${roundId})`);
  lines.push("");
  lines.push("## Repair-agent rules");
  lines.push("- Do not run `qc-attest`, `bar-attest`, `sweep-attest`, `key-resolve`, `major-disposition`, `promote-book`, or any command that certifies publishability.");
  lines.push("- Do not mark findings closed. Only repair chapter content.");
  lines.push("- Preserve quiz keys unless a finding explicitly identifies a wrong key and the source facts support the correction.");
  lines.push("- After edits, run the validation commands below: `author-check`, `gate-chapter`, and `book-gate`.");
  lines.push("- Final publishability always requires a fresh QC round after repair.");
  lines.push("");
  lines.push("## Validation commands");
  lines.push("```bash");
  for (const cmd of validationCommands(bookId, active)) lines.push(cmd);
  lines.push("```");
  lines.push("");
  if (active.length === 0) {
    lines.push("No open repair findings in the ledger.");
    return lines.join("\n") + "\n";
  }

  const byTheme = new Map<string, EffectiveLedgerFinding[]>();
  for (const f of active) {
    const theme = f.globalTheme || f.repairClass || "general";
    if (!byTheme.has(theme)) byTheme.set(theme, []);
    byTheme.get(theme)!.push(f);
  }
  lines.push("## Findings");
  for (const [theme, themeFindings] of [...byTheme.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push("");
    lines.push(`### ${theme}`);
    const byChapter = new Map<string, EffectiveLedgerFinding[]>();
    for (const f of themeFindings) {
      const key = chapterLabel(f);
      if (!byChapter.has(key)) byChapter.set(key, []);
      byChapter.get(key)!.push(f);
    }
    for (const [chapter, chapterFindings] of [...byChapter.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push("");
      lines.push(`#### ${chapter}`);
      const sorted = chapterFindings.slice().sort((a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99) || a.unitId.localeCompare(b.unitId));
      for (const f of sorted) {
        lines.push("");
        lines.push(`- **${f.severity.toUpperCase()} ${f.findingId}** (${f.repairClass})`);
        lines.push(`  - Unit: \`${f.unitId}\``);
        lines.push(`  - Quote: "${f.quote}"`);
        lines.push(`  - Problem: ${f.problem}`);
        lines.push(`  - Expected fix: ${f.expectedFix}`);
        if (f.status !== "open") lines.push(`  - Current status: ${f.status}${f.statusReason ? ` — ${f.statusReason}` : ""}`);
        const sources = f.sources.map((s) => `${s.sourceRole}:${s.submissionFile}`).join("; ");
        lines.push(`  - Sources: ${sources}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

export function writeRepairBrief(bookId: string, roundId: string): string {
  const path = repairBriefPath(bookId, roundId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderRepairBriefMarkdown(bookId, roundId), "utf8");
  writeRepairPrompt(bookId, roundId);
  return path;
}

export function renderRepairPromptMarkdown(bookId: string, roundId: string, findings = effectiveLedger(bookId, roundId)): string {
  const active = findings.filter((f) => f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun");
  const chapters = [...new Set(active.flatMap((f) => f.chapterNumber !== undefined ? [f.chapterNumber] : f.chapters ?? []))].sort((a, b) => a - b);
  const themes = [...new Set(active.map((f) => f.globalTheme || f.repairClass || "general"))].sort();
  const lines: string[] = [];
  lines.push("You are a fresh Writer Codex repair session for ChapterFlow.");
  lines.push("Your job is to repair the listed chapters only.");
  lines.push("You are not a QC reviewer.");
  lines.push("You must not run qc-attest, qc-submit, sweep-attest, bar-attest,");
  lines.push("key-resolve, major-disposition, promote-book, or any command that certifies.");
  lines.push("Fix root causes, not just quoted text.");
  lines.push("Preserve source-v2 provenance.");
  lines.push("After each edited chapter, run author-check and gate-chapter.");
  lines.push("After all edits, run book-gate.");
  lines.push("Report changed files and validation output.");
  lines.push("");
  lines.push(`bookId: ${bookId}`);
  lines.push(`roundId: ${roundId}`);
  lines.push(`affected chapters: ${chapters.length ? chapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ") : "none"}`);
  lines.push("");
  lines.push(...renderFinalizerCauseSection(bookId, roundId));
  if (active.length === 0) {
    const matrix = readEvidenceMatrix(bookId, roundId);
    const hasNonPublishable = Array.isArray(matrix?.chapters) && matrix.chapters.some((d: any) => d.finalVerdict !== "PUBLISHABLE");
    if (hasNonPublishable) {
      lines.push("No content repair prompt was generated because QC evidence was incomplete. Complete the missing QC artifacts instead.");
    } else {
      lines.push("No repair findings are open for this round.");
    }
    lines.push(`Evidence matrix: ${evidenceMatrixPath(bookId, roundId)}`);
    return lines.join("\n") + "\n";
  }
  lines.push("global repair themes:");
  for (const theme of themes) lines.push(`- ${theme}`);
  lines.push("");
  lines.push("findings by chapter:");
  const byChapter = new Map<string, EffectiveLedgerFinding[]>();
  for (const f of active) {
    const label = chapterLabel(f);
    if (!byChapter.has(label)) byChapter.set(label, []);
    byChapter.get(label)!.push(f);
  }
  for (const [chapter, chapterFindings] of [...byChapter.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push("");
    lines.push(`## ${chapter}`);
    for (const f of chapterFindings.slice().sort((a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99))) {
      lines.push("");
      lines.push(`- findingId: ${f.findingId}`);
      lines.push(`  severity: ${f.severity}`);
      lines.push(`  repairClass: ${f.repairClass}`);
      lines.push(`  unitId: ${f.unitId}`);
      lines.push(`  quote: "${f.quote}"`);
      lines.push(`  problem: ${f.problem}`);
      lines.push(`  expected fix: ${f.expectedFix}`);
      lines.push(`  source roles: ${[...new Set(f.sources.map((s) => s.sourceRole))].join(", ")}`);
    }
  }
  lines.push("");
  lines.push("validation commands:");
  lines.push("```bash");
  for (const cmd of validationCommands(bookId, active)) lines.push(cmd);
  lines.push("```");
  return lines.join("\n") + "\n";
}

export function writeRepairPrompt(bookId: string, roundId: string): string {
  const path = repairPromptPath(bookId, roundId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderRepairPromptMarkdown(bookId, roundId), "utf8");
  return path;
}
