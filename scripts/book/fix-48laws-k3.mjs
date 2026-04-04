#!/usr/bin/env node
/**
 * Fix K3: Redistribute decision_point format across work/school/personal.
 *
 * Strategy: For ~16 chapters, swap the decision_point example's category
 * to school or personal, and swap another example of that category to work.
 * This preserves the 2/2/2 category balance per chapter.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));

let fixes = 0;

// For chapters 1-16: move decision_point to school (swap with a school example to work)
// For chapters 17-32: move decision_point to personal (swap with a personal example to work)
// Chapters 33-48: keep as work

for (let i = 0; i < data.chapters.length; i++) {
  const ch = data.chapters[i];
  const exs = ch.examples;

  const dpIdx = exs.findIndex(e => e.format === "decision_point");
  if (dpIdx === -1) continue;

  if (ch.number <= 16) {
    // Swap decision_point to school, one school example to work
    const schoolIdx = exs.findIndex(e => e.category === "school" && e.format !== "decision_point");
    if (schoolIdx === -1) continue;
    exs[dpIdx].category = "school";
    exs[schoolIdx].category = "work";
    fixes++;
  } else if (ch.number <= 32) {
    // Swap decision_point to personal, one personal example to work
    const personalIdx = exs.findIndex(e => e.category === "personal" && e.format !== "decision_point");
    if (personalIdx === -1) continue;
    exs[dpIdx].category = "personal";
    exs[personalIdx].category = "work";
    fixes++;
  }
  // ch33-48: keep as work
}

writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
console.log(`K3 fix: ${fixes} category swaps applied.`);

// Verify
const formatCatMap = {};
for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    if (!formatCatMap[ex.format]) formatCatMap[ex.format] = {};
    formatCatMap[ex.format][ex.category] = (formatCatMap[ex.format][ex.category] || 0) + 1;
  }
}
console.log("\nFormat → Category distribution:");
for (const [fmt, cats] of Object.entries(formatCatMap)) {
  const parts = Object.entries(cats).map(([c, n]) => c + ":" + n);
  const catSet = new Set(Object.keys(cats));
  const status = catSet.size === 1 ? "FAIL" : "PASS";
  console.log(`  ${status}: ${fmt} → ${parts.join(", ")}`);
}

// Verify 2/2/2 balance
let imbalanced = 0;
for (const ch of data.chapters) {
  const cats = { work: 0, school: 0, personal: 0 };
  ch.examples.forEach(e => cats[e.category]++);
  if (cats.work !== 2 || cats.school !== 2 || cats.personal !== 2) {
    console.log(`  WARNING: ch${ch.number} category balance: ${JSON.stringify(cats)}`);
    imbalanced++;
  }
}
console.log(`\nCategory balance: ${imbalanced === 0 ? "All chapters 2/2/2" : imbalanced + " imbalanced"}`);
