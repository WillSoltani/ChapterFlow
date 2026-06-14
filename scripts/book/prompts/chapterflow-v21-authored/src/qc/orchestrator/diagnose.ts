import { existsSync, readFileSync } from "fs";

import { evidenceMatrixPath, repairPromptPath } from "./artifacts.js";

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

function failedChecks(decision: any): string[] {
  const checks = decision?.checks ?? {};
  const out: string[] = [];
  for (const [key, value] of Object.entries(checks)) {
    const ok = value === "PASS" || value === "GREEN" || value === "PUBLISHABLE" || value === "NO_OPEN_BLOCKERS" || value === "NOT_APPLICABLE";
    if (!ok) out.push(`${key}=${String(value)}`);
  }
  return out;
}

export function renderQcDiagnose(bookId: string, roundId: string): string {
  const matrixPath = evidenceMatrixPath(bookId, roundId);
  if (!existsSync(matrixPath)) throw new Error(`Missing evidence matrix: ${matrixPath}`);
  const matrix = readJson(matrixPath);
  const chapters = Array.isArray(matrix?.chapters) ? matrix.chapters : [];
  const verdicts = { PUBLISHABLE: 0, REVISE: 0, CORRUPTION: 0, NEEDS_MORE_QC: 0 };
  const common = new Map<string, number>();
  const bookWide = new Map<string, string>();
  const chapterLines: string[] = [];

  for (const decision of chapters) {
    if (decision.finalVerdict in verdicts) verdicts[decision.finalVerdict as keyof typeof verdicts]++;
    const failed = failedChecks(decision);
    for (const f of failed) common.set(f, (common.get(f) ?? 0) + 1);
    if (decision.checks?.bookGate === "FAIL") bookWide.set("bookGate", "bookGate FAIL");
    for (const f of decision.majorStatus?.book ?? []) bookWide.set(`major:${f.id}`, `${f.id} ${f.message}`);
    if (failed.length > 0) chapterLines.push(`  ch${String(decision.chapterNumber).padStart(2, "0")}: ${failed.join(", ")}`);
  }

  const prompt = repairPromptPath(bookId, roundId);
  const lines: string[] = [];
  lines.push(`QC DIAGNOSE — ${bookId} ${roundId}`);
  lines.push(`verdicts: PUBLISHABLE=${verdicts.PUBLISHABLE} REVISE=${verdicts.REVISE} CORRUPTION=${verdicts.CORRUPTION} NEEDS_MORE_QC=${verdicts.NEEDS_MORE_QC}`);
  lines.push("common failures:");
  const commonRows = [...common.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (commonRows.length === 0) lines.push("  none");
  else for (const [check, count] of commonRows) lines.push(`  ${check} on ${count}/${chapters.length}`);
  lines.push("book-wide blockers:");
  if (bookWide.size === 0) lines.push("  none");
  else for (const item of bookWide.values()) lines.push(`  ${item}`);
  lines.push("per-chapter failed checks:");
  if (chapterLines.length === 0) lines.push("  none");
  else lines.push(...chapterLines);
  lines.push("repair prompt:");
  lines.push(`  ${prompt}`);
  lines.push("next:");
  lines.push(`  run major-status ${bookId}`);
  lines.push(`  open repair prompt: ${prompt}`);
  lines.push(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass`);
  return lines.join("\n") + "\n";
}
