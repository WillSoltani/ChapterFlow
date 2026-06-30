/**
 * Per-chapter checkpoint helper for the three-step Codex workflow.
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-qc-chapter.ts <bookId> <chapterId>
 *
 * Runs the v21 ship gate on one chapter, runs the book pattern audit over all
 * currently written chapters, and records pass/fail status in the manual ledger.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { ChapterV21 } from "../types.js";
import { formatGateReport, runShipGate } from "../critics/finalGate.js";
import { formatBookPatternAuditReport, runBookPatternAudit } from "../critics/bookPatternAudit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../../state");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadWrittenChapters(bookId: string): ChapterV21[] {
  const indexPath = resolve(STATE, "indexes", `${bookId}.json`);
  const index = readJson<Array<{ chapterId: string }>>(indexPath);
  const chapters: ChapterV21[] = [];
  for (const spec of index) {
    const path = resolve(STATE, "chapters", `${spec.chapterId}.v21-native.chapter.json`);
    if (!existsSync(path)) continue;
    chapters.push(readJson<ChapterV21>(path));
  }
  return chapters.sort((a, b) => a.number - b.number);
}

function updateLedger(bookId: string, chapterId: string, status: Record<string, unknown>) {
  const ledgerPath = resolve(STATE, "books", `${bookId}.manual-generation-ledger.json`);
  if (!existsSync(ledgerPath)) return;
  let ledger: any;
  try {
    ledger = readJson<any>(ledgerPath);
  } catch {
    return;
  }
  ledger.updatedAt = new Date().toISOString();
  ledger.chapterStatuses = ledger.chapterStatuses ?? {};
  ledger.chapterStatuses[chapterId] = {
    ...(ledger.chapterStatuses[chapterId] ?? {}),
    ...status,
    checkedAt: new Date().toISOString(),
  };
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), "utf8");
}

function main() {
  const [bookId, chapterId] = process.argv.slice(2);
  if (!bookId || !chapterId) {
    console.error("Usage: codex-qc-chapter.ts <bookId> <chapterId>");
    process.exit(2);
  }

  const chapterPath = resolve(STATE, "chapters", `${chapterId}.v21-native.chapter.json`);
  if (!existsSync(chapterPath)) {
    console.error(`Missing chapter file: ${chapterPath}`);
    process.exit(2);
  }

  const chapter = readJson<ChapterV21>(chapterPath);
  const gate = runShipGate(chapter);
  console.log(formatGateReport(gate));

  const chapters = loadWrittenChapters(bookId);
  const audit = runBookPatternAudit({ bookId, chapters });
  console.log("");
  console.log(formatBookPatternAuditReport(audit));

  updateLedger(bookId, chapterId, {
    shipGatePassed: gate.passed,
    shipGateBlockers: gate.blockers.length,
    shipGateMajors: gate.majors.length,
    patternAuditPassed: audit.passed,
    patternAuditBlockers: audit.findings.filter((f) => f.severity === "blocker").length,
    writtenChapterCountAtCheck: chapters.length,
  });

  if (!gate.passed || !audit.passed) {
    console.error("");
    console.error(`CHECKPOINT BLOCKED ${chapterId}. Rewrite structurally, then rerun this command.`);
    process.exit(1);
  }

  console.log("");
  console.log(`CHECKPOINT PASS ${chapterId}`);
}

main();
