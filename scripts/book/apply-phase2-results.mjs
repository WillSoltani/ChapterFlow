#!/usr/bin/env node
/**
 * Applies Anthropic Batch API results to friends-and-influence.modern.json
 * Usage: node scripts/book/apply-phase2-results.mjs <result-file.jsonl> [result-file2.jsonl] ...
 *
 * Handles three fix types based on custom_id prefix:
 *   bd-ch{N}-{depth}-{tone}     → replaces chapterBreakdown text
 *   md-ch{N}-{depth}-kt{I}-{tone} → sets keyTakeaways[I].moreDetails.{tone}
 *   dlg-ch{N}-{exampleId}-{tone}  → replaces scenario.{tone}
 */

import { readFileSync, writeFileSync } from "fs";

const FILE = "book-packages/friends-and-influence.modern.json";
const resultFiles = process.argv.slice(2);

if (resultFiles.length === 0) {
  console.error("Usage: node apply-phase2-results.mjs <result1.jsonl> [result2.jsonl] ...");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(FILE, "utf-8"));
const chapters = pkg.chapters;

const stats = { breakdowns: 0, moreDetails: 0, dialogues: 0, errors: 0 };

for (const rf of resultFiles) {
  const lines = readFileSync(rf, "utf-8").trim().split("\n");
  console.log(`Processing ${rf}: ${lines.length} results`);

  for (const line of lines) {
    let result;
    try { result = JSON.parse(line); } catch (e) { stats.errors++; continue; }

    const id = result.custom_id;
    const response = result.result;

    // Extract text from the response
    let text;
    if (response?.type === "succeeded" && response.message?.content?.[0]?.text) {
      text = response.message.content[0].text.trim();
    } else {
      console.error(`  FAILED: ${id} — ${response?.type || "unknown"}`);
      stats.errors++;
      continue;
    }

    // Parse custom_id to determine fix type
    if (id.startsWith("bd-")) {
      // bd-ch{N}-{depth}-{tone}
      const match = id.match(/^bd-ch(\d+)-(medium|hard)-(gentle|direct|competitive)$/);
      if (!match) { console.error(`  BAD ID: ${id}`); stats.errors++; continue; }
      const [, chNum, depth, tone] = match;
      const ch = chapters.find(c => c.number === parseInt(chNum));
      if (!ch?.contentVariants?.[depth]?.chapterBreakdown) { stats.errors++; continue; }
      ch.contentVariants[depth].chapterBreakdown[tone] = text;
      stats.breakdowns++;
    }
    else if (id.startsWith("md-")) {
      // md-ch{N}-{depth}-kt{I}-{tone}
      const match = id.match(/^md-ch(\d+)-(medium|hard)-kt(\d+)-(gentle|direct|competitive)$/);
      if (!match) { console.error(`  BAD ID: ${id}`); stats.errors++; continue; }
      const [, chNum, depth, ktIdx, tone] = match;
      const ch = chapters.find(c => c.number === parseInt(chNum));
      const kt = ch?.contentVariants?.[depth]?.keyTakeaways?.[parseInt(ktIdx)];
      if (!kt) { stats.errors++; continue; }
      if (!kt.moreDetails) kt.moreDetails = {};
      kt.moreDetails[tone] = text;
      stats.moreDetails++;
    }
    else if (id.startsWith("dlg-")) {
      // dlg-ch{N}-{exampleId}-{tone}
      const match = id.match(/^dlg-ch(\d+)-(.+)-(gentle|direct|competitive)$/);
      if (!match) { console.error(`  BAD ID: ${id}`); stats.errors++; continue; }
      const [, chNum, exampleId, tone] = match;
      const ch = chapters.find(c => c.number === parseInt(chNum));
      const ex = ch?.examples?.find(e => e.exampleId === exampleId);
      if (!ex?.scenario) { stats.errors++; continue; }
      ex.scenario[tone] = text;
      stats.dialogues++;
    }
    else {
      console.error(`  UNKNOWN prefix: ${id}`);
      stats.errors++;
    }
  }
}

writeFileSync(FILE, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

console.log(`\nApplied:`);
console.log(`  Breakdowns expanded: ${stats.breakdowns}`);
console.log(`  moreDetails added:   ${stats.moreDetails}`);
console.log(`  Dialogues rewritten: ${stats.dialogues}`);
console.log(`  Errors:              ${stats.errors}`);
console.log(`\nRe-run validator: node scripts/book/validate-book.mjs ${FILE}`);
