/**
 * Status helper for the ChapterFlow v21 three-step Codex workflow.
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-book-status.ts <bookId> [--gates] [--json]
 *
 * Reports whether Step 1 artifacts, manual plans, and chapter JSON files exist.
 * With --gates, runs ship gate on every written chapter and the book pattern
 * audit over written chapters.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { ChapterV21 } from "../types.js";
import { runShipGate } from "../critics/finalGate.js";
import { formatBookPatternAuditReport, runBookPatternAudit } from "../critics/bookPatternAudit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../../state");

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags = new Set<string>();
  for (const arg of argv) {
    if (arg.startsWith("--")) flags.add(arg.slice(2));
    else positional.push(arg);
  }
  return { bookId: positional[0], gates: flags.has("gates"), json: flags.has("json") };
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function planPath(chapterId: string) {
  return resolve(STATE, "plans", `${chapterId}.manual-plan.json`);
}

function chapterPath(chapterId: string) {
  return resolve(STATE, "chapters", `${chapterId}.v21-native.chapter.json`);
}

function main() {
  const { bookId, gates, json } = parseArgs(process.argv.slice(2));
  if (!bookId) {
    console.error("Usage: codex-book-status.ts <bookId> [--gates] [--json]");
    process.exit(2);
  }

  const indexPath = resolve(STATE, "indexes", `${bookId}.json`);
  if (!existsSync(indexPath)) {
    console.error(`Missing chapter index: ${indexPath}`);
    process.exit(2);
  }

  const chapters = readJson<Array<{ chapterId: string; chapterNumber: number; chapterTitle: string }>>(indexPath) ?? [];
  const briefPath = resolve(STATE, "briefs", `${bookId}.manual-brief.json`);
  const ledgerPath = resolve(STATE, "books", `${bookId}.manual-generation-ledger.json`);
  const coreMapPath = resolve(STATE, "books", `${bookId}.chapter-core-map.json`);

  const planRows = chapters.map((ch) => ({ ...ch, path: planPath(ch.chapterId), exists: existsSync(planPath(ch.chapterId)) }));
  const chapterRows = chapters.map((ch) => ({ ...ch, path: chapterPath(ch.chapterId), exists: existsSync(chapterPath(ch.chapterId)) }));
  const writtenChapters: ChapterV21[] = [];
  for (const row of chapterRows) {
    if (!row.exists) continue;
    const loaded = readJson<ChapterV21>(row.path);
    if (loaded) writtenChapters.push(loaded);
  }

  const gateRows: Array<{ number: number; chapterId: string; passed: boolean; blockers: number; majors: number }> = [];
  if (gates) {
    for (const ch of writtenChapters.sort((a, b) => a.number - b.number)) {
      const report = runShipGate(ch);
      gateRows.push({
        number: ch.number,
        chapterId: ch.chapterId,
        passed: report.passed,
        blockers: report.blockers.length,
        majors: report.majors.length,
      });
    }
  }

  const patternAudit = writtenChapters.length
    ? runBookPatternAudit({ bookId, chapters: writtenChapters })
    : null;

  const summary = {
    bookId,
    expectedChapters: chapters.length,
    setup: {
      brief: existsSync(briefPath),
      ledger: existsSync(ledgerPath),
      coreMap: existsSync(coreMapPath),
      briefPath,
      ledgerPath,
      coreMapPath,
    },
    plans: {
      present: planRows.filter((r) => r.exists).length,
      missing: planRows.filter((r) => !r.exists).map((r) => r.chapterNumber),
    },
    chapters: {
      present: chapterRows.filter((r) => r.exists).length,
      missing: chapterRows.filter((r) => !r.exists).map((r) => r.chapterNumber),
    },
    gates: gateRows,
    patternAudit,
  };

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`Codex v21 status: ${bookId}`);
  console.log(`  expected chapters: ${chapters.length}`);
  console.log(`  setup artifacts:`);
  console.log(`    brief: ${summary.setup.brief ? "yes" : "NO"}`);
  console.log(`    ledger: ${summary.setup.ledger ? "yes" : "NO"}`);
  console.log(`    core map: ${summary.setup.coreMap ? "yes" : "NO"}`);
  console.log(`  plans: ${summary.plans.present}/${chapters.length}`);
  if (summary.plans.missing.length) console.log(`    missing plans: ${summary.plans.missing.join(", ")}`);
  console.log(`  chapters: ${summary.chapters.present}/${chapters.length}`);
  if (summary.chapters.missing.length) console.log(`    missing chapters: ${summary.chapters.missing.join(", ")}`);

  if (gates) {
    const failed = gateRows.filter((r) => !r.passed);
    console.log(`  ship gates checked: ${gateRows.length}`);
    if (failed.length) {
      console.log(`    failed gates: ${failed.map((r) => `ch${r.number}(${r.blockers} blockers)`).join(", ")}`);
    } else if (gateRows.length) {
      console.log(`    all written chapters blocker-clean`);
    }
  }

  if (patternAudit) {
    console.log("");
    console.log(formatBookPatternAuditReport(patternAudit));
  }

  const setupDone = summary.setup.brief && summary.setup.ledger && summary.setup.coreMap;
  const plansDone = summary.plans.present === chapters.length;
  const chaptersDone = summary.chapters.present === chapters.length;
  console.log("");
  if (!setupDone || !plansDone) {
    console.log("Next step: Step 1 setup/planning is incomplete.");
  } else if (!chaptersDone) {
    console.log(`Next step: Step 2 writing. Next missing chapter: ${summary.chapters.missing[0]}`);
  } else if (patternAudit && !patternAudit.passed) {
    console.log("Next step: Step 2 structural rewrite for pattern-audit blockers.");
  } else {
    console.log("Next step: Step 3 finalize.");
  }
}

main();
