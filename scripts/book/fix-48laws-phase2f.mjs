#!/usr/bin/env node
/**
 * Phase 2f: Fix remaining G4, G5, and K3 issues
 *
 * 1. Fix "think about" in ch11 and ch36 (keep 1, replace 1)
 * 2. Fix K3: reassign some decision_point examples to school/personal categories
 * 3. Fix remaining G5 gentle opener repetitions
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));
let fixCount = 0;

// ─── 1. Fix "think about" in ch11 and ch36 ───
for (const chNum of [11, 36]) {
  const ch = data.chapters.find((c) => c.number === chNum);
  if (!ch) continue;
  let chStr = JSON.stringify(ch);
  let count = 0;
  chStr = chStr.replace(/\bthink about\b/gi, (match) => {
    count++;
    if (count <= 1) return match;
    fixCount++;
    return match[0] === "T" ? "Consider" : "consider";
  });
  const parsed = JSON.parse(chStr);
  Object.assign(ch, parsed);
}

// ─── 2. Fix K3: Move some decision_point examples to school/personal ───
// Find decision_point examples and reassign some categories
let dpWork = 0, dpSchool = 0, dpPersonal = 0;
for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    if (ex.format === "decision_point") {
      if (ex.category === "work") dpWork++;
      else if (ex.category === "school") dpSchool++;
      else if (ex.category === "personal") dpPersonal++;
    }
  }
}

// Move ~1/3 of work decision_points to school and ~1/3 to personal
// Pick chapters where decision_point is work and another work example exists
let movedToSchool = 0, movedToPersonal = 0;
const targetSchool = Math.floor(dpWork / 3);
const targetPersonal = Math.floor(dpWork / 3);

for (const ch of data.chapters) {
  const exs = ch.examples;
  const dpIdx = exs.findIndex(e => e.format === "decision_point" && e.category === "work");
  if (dpIdx === -1) continue;

  // Check if we can swap: does this chapter have more than 2 work examples?
  const workCount = exs.filter(e => e.category === "work").length;
  const schoolCount = exs.filter(e => e.category === "school").length;
  const personalCount = exs.filter(e => e.category === "personal").length;

  if (movedToSchool < targetSchool && workCount > 2 && schoolCount < 3) {
    exs[dpIdx].category = "school";
    movedToSchool++;
    fixCount++;
  } else if (movedToPersonal < targetPersonal && workCount > 2 && personalCount < 3) {
    exs[dpIdx].category = "personal";
    movedToPersonal++;
    fixCount++;
  }
}

console.log(`K3: Moved ${movedToSchool} decision_points to school, ${movedToPersonal} to personal`);

// ─── 3. Fix remaining G5 gentle opener repetitions ───
// Collect all gentle openers and their counts
const openerCounts = {};
function walkGentleOpeners(obj, path) {
  if (typeof obj === "string" && path.endsWith(".gentle")) {
    const first6 = obj.trim().split(/\s+/).slice(0, 6).join(" ");
    openerCounts[first6] = (openerCounts[first6] || 0) + 1;
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkGentleOpeners(v, `${path}[${i}]`));
  } else if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj)) walkGentleOpeners(obj[k], `${path}.${k}`);
  }
}
walkGentleOpeners(data, "root");

const overused = Object.entries(openerCounts)
  .filter(([, c]) => c > 2)
  .sort((a, b) => b[1] - a[1]);

console.log(`\nOverused gentle openers (>2): ${overused.length}`);
for (const [o, c] of overused.slice(0, 10)) {
  console.log(`  "${o}": ${c}`);
}

// For each overused opener, replace all but 2 with varied alternatives
const genericAlts = [
  "Right now, before going further, picture",
  "Pause here for a moment and",
  "Take a breath and notice what",
  "Sit with this thought for a",
  "One question before you continue reading:",
  "Something quiet happens when you let",
  "Let this settle: the next time",
  "Notice what comes up when you",
  "Hold this idea loosely and see",
  "A small experiment before you move",
  "When you are ready, try to",
  "Look back at your week and",
  "Picture the last conversation where you",
  "Remember a moment when someone made",
  "Name one person who naturally does",
  "Close your eyes briefly and recall",
  "Write down the first thought that",
  "Ask yourself quietly: when was the",
  "Without judging yourself, recall a time",
  "Consider this: over the last month",
  "Something worth sitting with: how often",
  "Start by recalling your most recent",
  "Quick check: can you name one",
  "Honest question for yourself: do you",
  "Bring to mind a situation where",
  "One thing to test this week:",
  "A simple prompt: name the last",
  "Here is a quiet test: think",
  "Slow down and ask: when did",
  "Reflect on this before continuing: how",
  "Try this: write down the name",
  "Before the next section, jot down",
  "Think back to a time when",
  "Challenge yourself: can you describe the",
  "One more thing before moving on:",
];

let altCounter = 0;

function walkAndFixOpeners2(obj, path) {
  if (typeof obj === "string" && path.endsWith(".gentle")) {
    const first6 = obj.trim().split(/\s+/).slice(0, 6).join(" ");
    for (const [opener, count] of overused) {
      if (first6 === opener) {
        // Track how many we've seen
        if (!walkAndFixOpeners2._seen) walkAndFixOpeners2._seen = {};
        walkAndFixOpeners2._seen[opener] = (walkAndFixOpeners2._seen[opener] || 0) + 1;

        if (walkAndFixOpeners2._seen[opener] <= 2) return obj; // keep first 2

        // Replace opener
        const alt = genericAlts[altCounter % genericAlts.length];
        altCounter++;
        const words = obj.trim().split(/\s+/);
        const rest = words.slice(6).join(" ");
        fixCount++;
        return alt + " " + rest;
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((v, i) => walkAndFixOpeners2(v, `${path}[${i}]`));
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = walkAndFixOpeners2(obj[k], `${path}.${k}`);
    }
    return out;
  }
  return obj;
}

const fixed = walkAndFixOpeners2(data, "root");

writeFileSync(filePath, JSON.stringify(fixed, null, 2) + "\n");
console.log(`\nPhase 2f complete. ${fixCount} fixes applied.`);
