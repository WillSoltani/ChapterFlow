import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

import { evidenceMatrixPath, loadCraftReadArtifact, repairBriefPath, repairPromptPath } from "./artifacts.js";
import { computeCraftVerdict, craftReadMode, CRAFT_AXIS_FLOOR } from "../../critics/semantic/craftBar.js";
import { effectiveLedger, type EffectiveLedgerFinding } from "./ledger.js";
import { classDefectBanner, unitContainer } from "./findingGrouping.js";
import { C7_BANNED_NAMES } from "../../critics/finalGate.js";
import { extractNamesFromText } from "../../librarian/libraryState.js";
import { loadNameBank } from "../../librarian/namePlan.js";
import { loadBookChapters } from "../manualKeyJudge.js";

const SEVERITY_RANK: Record<string, number> = { blocker: 0, major: 1, minor: 2, advisory: 3 };

function chapterLabel(f: EffectiveLedgerFinding): string {
  if (f.chapterNumber !== undefined) return `ch${String(f.chapterNumber).padStart(2, "0")}`;
  if (f.chapters?.length) return `chapters ${f.chapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}`;
  return "book-wide";
}

function chapterPath(bookId: string, n: number): string {
  return `state/chapters/${bookId}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`;
}

function validationCommands(bookId: string, findings: EffectiveLedgerFinding[], extraChapters: number[] = []): string[] {
  const chapters = [...new Set([...findings.flatMap((f) => f.chapterNumber !== undefined ? [f.chapterNumber] : f.chapters ?? []), ...extraChapters])].sort((a, b) => a - b);
  const lines: string[] = [];
  for (const n of chapters) {
    lines.push(`npx tsx src/cli.ts author-check ${chapterPath(bookId, n)}`);
    lines.push(`npx tsx src/cli.ts gate-chapter ${chapterPath(bookId, n)}`);
  }
  lines.push(`npx tsx src/cli.ts book-gate ${bookId}`);
  // The convergence gate — repair is done only when this reports DETERMINISTIC-CLEAN.
  lines.push(`npx tsx src/cli.ts qc-converge ${bookId}`);
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

/**
 * P1.3 — every non-PUBLISHABLE chapter in the verdict matrix, not just the ones
 * that happen to carry a ledger finding. A book-wide major (e.g. venue-stamping)
 * fails ALL chapters → REVISE but emits a finding for only one or two, so the
 * ledger-only "affected chapters" line under-named the repair scope and left the
 * rest un-repaired round after round. Union this with the ledger chapters.
 */
function nonPublishableMatrixChapters(bookId: string, roundId: string): number[] {
  const matrix = readEvidenceMatrix(bookId, roundId);
  if (!Array.isArray(matrix?.chapters)) return [];
  return matrix.chapters
    .filter((d: any) => d?.finalVerdict === "REVISE" || d?.finalVerdict === "CORRUPTION" || d?.finalVerdict === "NEEDS_MORE_QC")
    .map((d: any) => d?.chapterNumber)
    .filter((n: any) => Number.isInteger(n) && n > 0);
}

/**
 * Split the verdict matrix's non-PUBLISHABLE chapters by WHY they failed, so the
 * repair prompt can distinguish chapters that need direct edits from those only
 * caught by a shared/book-wide status (fix the pattern at its source — do not
 * re-author each member, which would needlessly invalidate a carried-green
 * chapter) and those that just need a fresh QC read.
 */
function categorizeMatrixChapters(bookId: string, roundId: string): { revise: number[]; needsMoreQc: number[] } {
  const matrix = readEvidenceMatrix(bookId, roundId);
  const out = { revise: [] as number[], needsMoreQc: [] as number[] };
  if (!Array.isArray(matrix?.chapters)) return out;
  for (const d of matrix.chapters) {
    const n = d?.chapterNumber;
    if (!Number.isInteger(n) || n <= 0) continue;
    if (d.finalVerdict === "REVISE" || d.finalVerdict === "CORRUPTION") out.revise.push(n);
    else if (d.finalVerdict === "NEEDS_MORE_QC") out.needsMoreQc.push(n);
  }
  return out;
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

/**
 * F6b — the SHADOW craft-read section. In shadow mode the craft read never enters the blocking
 * ledger (that would pull an otherwise-publishable chapter into the repair edit bucket), so its
 * below-the-bar hits are surfaced HERE, advisory and clearly non-gating: information for the
 * operator while the enforce floors are calibrated. Reads the evidence matrix (for which chapters
 * scored craft YELLOW) + the craft artifacts (for the cited hits). Returns [] when off/enforce, or
 * when nothing scored below the bar.
 */
function renderCraftShadowSection(bookId: string, roundId: string): string[] {
  if (craftReadMode() !== "shadow") return [];
  const matrix = readEvidenceMatrix(bookId, roundId);
  const chapters = Array.isArray(matrix?.chapters) ? matrix.chapters : [];
  const lines: string[] = [];
  for (const d of chapters) {
    if (d?.craft?.status !== "YELLOW") continue;
    const n = d.chapterNumber;
    const art = loadCraftReadArtifact(bookId, roundId, n);
    if (!art) continue;
    const verdict = computeCraftVerdict(art.chapterId, art.axes, true);
    const axisLines: string[] = [];
    for (const axis of art.axes) {
      const belowFloor = axis.score < CRAFT_AXIS_FLOOR;
      if (!belowFloor && axis.hits.length === 0) continue;
      axisLines.push(`  - ${axis.axis} = ${axis.score.toFixed(2)}${belowFloor ? " (below floor)" : ""}`);
      for (const h of axis.hits) axisLines.push(`    - \`${h.unitId}\`: ${h.defect}${h.fix ? ` → fix: ${h.fix}` : ""}`);
    }
    if (axisLines.length === 0) continue;
    lines.push(`- **ch${String(n).padStart(2, "0")}** craft ${verdict.overall}/100 (YELLOW):`);
    lines.push(...axisLines);
  }
  if (lines.length === 0) return [];
  return [
    "",
    "## Craft read (shadow — advisory, NON-gating)",
    "The craft bar (summaries/tone/transfer/idea-density/limits) scored these chapters below the",
    "bar. This is ADVISORY: in shadow mode the craft read never changes a QC verdict and never",
    "requires an edit. Do NOT edit a chapter solely to clear a craft-shadow note.",
    ...lines,
  ];
}

export function renderRepairBriefMarkdown(bookId: string, roundId: string, findings = effectiveLedger(bookId, roundId)): string {
  const active = findings.filter((f) => f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun");
  const lines: string[] = [];
  lines.push(`# Repair brief — ${bookId} (${roundId})`);
  lines.push("");
  lines.push("## Repair-agent rules");
  lines.push("- SCOPE: edits go to chapter JSON under `state/chapters/` only (re-dealing a dealt slot by RUNNING a CLI allocator is fine — it updates a `state/` plan). NEVER hand-edit pipeline code, allocators, gates, prompts, or config — any file under `src/`, `config/`, or `agent-prompts/`. \"Fix at the source\" / \"fix the class\" means re-authoring the offending chapters' CONTENT so they stop sharing the pattern (e.g. stage examples in different settings, write distinct quiz stems) — NOT editing the venue palette, an allocator, or the card generator. A code/config edit changes every future book and is out of bounds here.");
  lines.push("- If a finding can ONLY be fixed by hand-editing pipeline code/config (an allocator/gate/palette/generator bug, not chapter content), STOP and report it to the operator. Do not edit code.");
  lines.push("- Do not run `qc-attest`, `bar-attest`, `sweep-attest`, `key-resolve`, `major-disposition`, `promote-book`, or any command that certifies publishability.");
  lines.push("- Do not mark findings closed. Only repair chapter content.");
  lines.push("- Preserve quiz keys unless a finding explicitly identifies a wrong key and the source facts support the correction.");
  lines.push("- After edits, run the validation commands below: `author-check`, `gate-chapter`, `book-gate`, then `qc-converge` — do NOT hand off until `qc-converge` reports DETERMINISTIC-CLEAN (fix everything it lists in ONE pass, so the next QC round can't bounce on a mechanical nit).");
  lines.push("- Final publishability always requires a fresh QC round after repair.");
  lines.push("");
  lines.push("## Validation commands");
  lines.push("```bash");
  for (const cmd of validationCommands(bookId, active, nonPublishableMatrixChapters(bookId, roundId))) lines.push(cmd);
  lines.push("```");
  lines.push("");
  const craftShadow = renderCraftShadowSection(bookId, roundId);
  if (active.length === 0) {
    lines.push("No open repair findings in the ledger.");
    lines.push(...craftShadow);
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
  lines.push(...craftShadow);
  return lines.join("\n") + "\n";
}

export function writeRepairBrief(bookId: string, roundId: string): string {
  const path = repairBriefPath(bookId, roundId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderRepairBriefMarkdown(bookId, roundId), "utf8");
  writeRepairPrompt(bookId, roundId);
  return path;
}


/** The deterministic guardrails a content edit can trip. Injected into the repair prompt so a
 *  repair that fixes one finding does not spawn a DIFFERENT one next round — the "no new issue"
 *  envelope. These are exactly what `gate-chapter` / `book-gate` / `qc-converge` enforce. */
function renderConstraintEnvelope(bookId: string): string[] {
  const L: string[] = [];
  L.push("CONSTRAINT ENVELOPE — your edit must not trip a DIFFERENT gate (that just spawns a new finding next round).");
  L.push("Before you hand off, confirm your edit obeys ALL of these (they are what gate-chapter / book-gate / qc-converge enforce):");
  L.push(`- C7 (blocker): do NOT introduce a protagonist name from the banned pool unless it was dealt to THIS chapter — ${C7_BANNED_NAMES.join(", ")}. Use the SAFE-RENAME POOL below.`);
  L.push("- F1 (blocker): do NOT give a character a name that already recurs in another chapter (cross-chapter collision). The SAFE-RENAME POOL is pre-filtered for this.");
  L.push("- SP2 (blocker): NEVER change an example's planSpec.format — it must equal the dealt scene shape. Re-stage WITHIN the dealt shape; don't swap shapes.");
  L.push("- B1 (blocker): do NOT open a hook / counterintuition / keyTakeaway with \"In this chapter\", \"This chapter\", \"The chapter\", or \"The author\".");
  L.push("- A13 (major): keep scenario openers clean — no doubled periods, no \"Name, plural-noun verb\" apposition, and ≤2 commas in the first 80 characters.");
  L.push("- C23 (major): one protagonist per example — do NOT reuse the same character name across two examples in the same chapter.");
  L.push("- BP28/BP29/BP31 (major, book-wide templating): do NOT introduce a card-front phrasing, a clock time (e.g. 9:10 a.m.), or a uniform \"Label:\" quiz-choice format that already recurs across other chapters.");
  L.push("- Preserve every number / proper noun / source anchor — source-v2 grounding must survive your edit.");
  const pool = safeRenamePool(bookId);
  if (pool.length) {
    L.push(`- SAFE-RENAME POOL (vetted: not C7-banned, not used in any chapter → safe from C7 + F1). If a fix needs a NEW character name, pick from: ${pool.slice(0, 15).join(", ")}.`);
  }
  return L;
}

/** Bank names that are safe to introduce anywhere in this book: not C7-banned, and not already
 *  used (by `extractNamesFromText`, the same extractor F1 uses) in ANY chapter — so the pool is
 *  immune to C7 and to an F1 cross-chapter collision. Fail-safe: any read error → [] (the
 *  envelope simply omits the pool; it never crashes the brief). */
function safeRenamePool(bookId: string): string[] {
  try {
    const banned = new Set(C7_BANNED_NAMES);
    const used = new Set<string>();
    for (const ch of loadBookChapters(bookId)) {
      for (const name of extractNamesFromText(JSON.stringify(ch))) used.add(name);
    }
    return loadNameBank().filter((n) => !banned.has(n) && !used.has(n));
  } catch {
    return [];
  }
}

export function renderRepairPromptMarkdown(bookId: string, roundId: string, findings = effectiveLedger(bookId, roundId)): string {
  const active = findings.filter((f) => f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun");
  const matrixChapters = nonPublishableMatrixChapters(bookId, roundId);
  const ledgerChapters = active.flatMap((f) => f.chapterNumber !== undefined ? [f.chapterNumber] : f.chapters ?? []);
  // Bucket the affected chapters by why they failed so a repair writer edits only
  // what needs editing (over-naming would invalidate carried-green chapters).
  const ledgerSet = new Set<number>(ledgerChapters);
  const matrixCat = categorizeMatrixChapters(bookId, roundId);
  const fmt = (ns: number[]) => [...new Set(ns)].sort((a, b) => a - b).map((n) => `ch${String(n).padStart(2, "0")}`).join(", ");
  const editChapters = [...ledgerSet].sort((a, b) => a - b);
  const bookWideChapters = matrixCat.revise.filter((n) => !ledgerSet.has(n));
  const reQcChapters = matrixCat.needsMoreQc.filter((n) => !ledgerSet.has(n));
  const buckets: string[] = [];
  if (editChapters.length) buckets.push(`${fmt(editChapters)} [edit]`);
  if (bookWideChapters.length) buckets.push(`${fmt(bookWideChapters)} [book-wide status — fix the shared pattern at its source; do NOT re-author each]`);
  if (reQcChapters.length) buckets.push(`${fmt(reQcChapters)} [re-QC only — missing/stale evidence, no edits]`);
  const themes = [...new Set(active.map((f) => f.globalTheme || f.repairClass || "general"))].sort();
  const lines: string[] = [];
  lines.push("You are a fresh Writer Codex repair session for ChapterFlow.");
  lines.push("Your job is to repair the listed chapters only.");
  lines.push("SCOPE: your edits go to chapter JSON under state/chapters/ only (re-dealing a dealt slot by RUNNING a CLI allocator is fine — it updates a state/ plan). You must NEVER hand-edit pipeline code, allocators, gates, prompts, or config — any file under src/, config/, or agent-prompts/. \"Fix root causes\" / \"fix the class at its source\" below means re-authoring the offending chapters' CONTENT so they stop sharing the pattern (stage examples in different settings, write distinct quiz stems) — NOT editing the venue palette, an allocator, or the card generator. A code/config edit changes every future book and is out of bounds for a repair session.");
  lines.push("If a finding can ONLY be fixed by hand-editing pipeline code/config (an allocator/gate/palette/generator bug, not chapter content), STOP and report it to the operator. Do not edit code.");
  lines.push("You are not a QC reviewer.");
  lines.push("You must not run qc-attest, qc-submit, sweep-attest, bar-attest,");
  lines.push("key-resolve, major-disposition, promote-book, or any command that certifies.");
  lines.push("Fix root causes in the chapter CONTENT, not just the quoted text.");
  lines.push("Preserve source-v2 provenance.");
  lines.push("After each edited chapter, run author-check and gate-chapter.");
  lines.push("After all edits, run book-gate.");
  lines.push(`Do NOT hand off until \`qc-converge ${bookId}\` reports DETERMINISTIC-CLEAN — it runs the SAME deterministic battery QC finalize uses, so a clean result means the next QC round won't bounce on a mechanical nit (em-dash, >34-word sentence, shape-plan slot, dangling anchor). Fix EVERYTHING it lists in ONE pass; do not stop at the first finding.`);
  lines.push("Report changed files and validation output.");
  lines.push("");
  lines.push(`bookId: ${bookId}`);
  lines.push(`roundId: ${roundId}`);
  lines.push(`affected chapters: ${buckets.length ? buckets.join("; ") : "none"}`);
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
  lines.push(...renderConstraintEnvelope(bookId));
  lines.push("");
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
    // Group by (repairClass, unit-container) so a defect repeated across sibling units
    // (e.g. plan_actionability on ifThenPlans[1]/[2]/[3]) renders ONE class-level
    // instruction. Re-authoring only the quoted units leaves siblings to re-fail next
    // round (the whack-a-mole stall observed on the-daily-stoic ch3 across 3 QC rounds).
    const groups = new Map<string, EffectiveLedgerFinding[]>();
    for (const f of chapterFindings) {
      const gkey = `${f.repairClass} ${unitContainer(f.unitId)}`;
      if (!groups.has(gkey)) groups.set(gkey, []);
      groups.get(gkey)!.push(f);
    }
    const bySeverity = (a: EffectiveLedgerFinding, b: EffectiveLedgerFinding) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99);
    const orderedGroups = [...groups.values()].sort((a, b) => bySeverity(a[0], b[0]));
    for (const group of orderedGroups) {
      if (group.length >= 2) {
        lines.push("");
        lines.push(`- ${classDefectBanner(group[0].repairClass, group.length, unitContainer(group[0].unitId))}`);
      }
      for (const f of group.slice().sort(bySeverity)) {
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
  }
  lines.push("");
  lines.push("validation commands:");
  lines.push("```bash");
  for (const cmd of validationCommands(bookId, active, matrixChapters)) lines.push(cmd);
  lines.push("```");
  return lines.join("\n") + "\n";
}

export function writeRepairPrompt(bookId: string, roundId: string): string {
  const path = repairPromptPath(bookId, roundId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderRepairPromptMarkdown(bookId, roundId), "utf8");
  return path;
}
