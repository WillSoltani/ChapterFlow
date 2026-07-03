#!/usr/bin/env node

/**
 * v21 package validator that actually runs the v21 ship gate and book gate.
 * Use this in addition to scripts/book/validate-book.mjs. The legacy validator
 * checks package shape; this checks the authored v21 quality gates.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { runShipGate } from "../critics/finalGate.js";
import { runBookGate, formatBookGateReport } from "../critics/bookGate.js";

const pathArg = process.argv[2];
if (!pathArg) {
  console.error("Usage: validate-v21-package.ts <book-packages/<bookId>.v21.json>");
  process.exit(2);
}

const packagePath = resolve(process.cwd(), pathArg);
if (!existsSync(packagePath)) {
  console.error(`Package not found: ${packagePath}`);
  process.exit(2);
}

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const bookId = pkg.book?.bookId ?? "unknown";
const chapters = (pkg.chapters ?? []) as ChapterV21[];

let shipBlockers = 0;
let shipMajors = 0;

console.log(`v21 package validation: ${bookId} (${chapters.length} chapters)`);

for (const ch of chapters) {
  const report = runShipGate(ch);
  shipBlockers += report.blockers.length;
  shipMajors += report.majors.length;
  const status = report.blockers.length ? "BLOCK" : "PASS";
  console.log(`  ch${String(ch.number).padStart(2, "0")} ${status}: ${report.blockers.length} blocker(s), ${report.majors.length} major(s)`);
  for (const f of report.blockers.slice(0, 8)) {
    console.log(`    [${f.catalogId}] ${f.unit}: ${f.message}`);
  }
  if (report.blockers.length > 8) {
    console.log(`    ... ${report.blockers.length - 8} more blocker(s)`);
  }
}

const bookGate = runBookGate(bookId, chapters);
console.log("");
console.log(formatBookGateReport(bookGate));

const bookBlockers = bookGate.findings.filter((f) => f.severity === "blocker").length;
console.log("");
console.log(`Result: ${shipBlockers === 0 && bookBlockers === 0 ? "PASS" : "BLOCK"}`);
console.log(`Ship gate: ${shipBlockers} blocker(s), ${shipMajors} major(s)`);
console.log(`Book gate: ${bookBlockers} blocker(s)`);

process.exit(shipBlockers === 0 && bookBlockers === 0 ? 0 : 1);
