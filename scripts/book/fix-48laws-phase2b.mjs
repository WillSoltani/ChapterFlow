#!/usr/bin/env node
/**
 * Phase 2b: Fix closing sentence vocabulary
 * Replace banned words (structural, mechanism, pattern, dynamic, framework, system)
 * ONLY in the last sentence of: chapterBreakdown, whyItMatters, moreDetails, whatToDo, oneMinuteRecap
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));

let fixCount = 0;

const replacements = {
  structural: [
    "built-in",
    "underlying",
    "foundational",
    "deep-rooted",
    "embedded",
    "architectural",
    "core",
    "load-bearing",
  ],
  mechanism: [
    "process",
    "method",
    "approach",
    "technique",
    "lever",
    "operation",
    "engine",
    "function",
  ],
  pattern: [
    "tendency",
    "habit",
    "behavior",
    "rhythm",
    "sequence",
    "cycle",
    "routine",
    "shape",
  ],
  dynamic: [
    "interaction",
    "tension",
    "relationship",
    "force",
    "current",
    "interplay",
    "exchange",
    "pressure",
  ],
  framework: [
    "model",
    "approach",
    "lens",
    "method",
    "blueprint",
    "scaffold",
    "guide",
    "structure",
  ],
  system: [
    "setup",
    "arrangement",
    "structure",
    "network",
    "process",
    "apparatus",
    "machine",
    "order",
  ],
};

// Track how many times each replacement was used to rotate through alternatives
const usageCounts = {};
for (const w of Object.keys(replacements)) usageCounts[w] = 0;

const bannedFields = [
  "chapterBreakdown",
  "whyItMatters",
  "moreDetails",
  "whatToDo",
  "oneMinuteRecap",
];

function isInBannedField(path) {
  return bannedFields.some((f) => path.includes(f));
}

function fixLastSentence(text) {
  // Split into sentences, fix the last one
  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length === 0) return text;

  let lastPart = parts[parts.length - 1];
  let changed = false;

  for (const [word, alts] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    if (regex.test(lastPart)) {
      const alt = alts[usageCounts[word] % alts.length];
      usageCounts[word]++;
      lastPart = lastPart.replace(regex, (match) => {
        changed = true;
        if (match[0] === match[0].toUpperCase()) {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });
    }
  }

  if (changed) {
    parts[parts.length - 1] = lastPart;
    fixCount++;
    return parts.join(" ");
  }
  return text;
}

function walkAndFix(obj, path) {
  if (typeof obj === "string") {
    if (isInBannedField(path)) {
      return fixLastSentence(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((v, i) => walkAndFix(v, `${path}[${i}]`));
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = walkAndFix(obj[k], `${path}.${k}`);
    }
    return out;
  }
  return obj;
}

const fixed = walkAndFix(data, "root");

writeFileSync(filePath, JSON.stringify(fixed, null, 2) + "\n", "utf-8");
console.log(`Phase 2b complete. ${fixCount} closing sentences fixed.`);
