/**
 * Run the v21 ship gate against an existing chapter file. Used to sanity-
 * check that the gate doesn't reject known-good chapters.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/run-ship-gate.ts <path/to/chapter.json>
 */

import { readFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { runShipGate, formatGateReport } from "../critics/finalGate.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: run-ship-gate.ts <chapter.json>");
  process.exit(2);
}
const chapter = JSON.parse(readFileSync(resolve(file), "utf8")) as ChapterV21;
const report = runShipGate(chapter);
console.log(formatGateReport(report));
console.log("");
console.log(`Total findings: ${report.blockers.length + report.majors.length + report.minors.length}`);
if (report.majors.length > 0) {
  console.log("");
  console.log("Major findings:");
  for (const f of report.majors) {
    console.log(`  [${f.catalogId}] ${f.unit}: ${f.message}`);
  }
}
if (report.minors.length > 0) {
  console.log("");
  console.log("Minor findings:");
  for (const f of report.minors) {
    console.log(`  [${f.catalogId}] ${f.unit}: ${f.message}`);
  }
}
process.exit(report.passed ? 0 : 1);
