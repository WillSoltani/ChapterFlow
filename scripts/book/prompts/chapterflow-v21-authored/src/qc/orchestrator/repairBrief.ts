import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

import { repairBriefPath } from "./artifacts.js";
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
  return path;
}
