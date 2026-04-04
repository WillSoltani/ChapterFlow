#!/usr/bin/env node
/**
 * Phase 2 mechanical fixes for the-48-laws-of-power.modern.json
 *
 * 1. Remove "landscape" (1 instance)
 * 2. Reduce "leverage" (keep max 1 per chapter, 6 total; replace rest)
 * 3. Reduce "think about" (keep max 1 per chapter; replace rest)
 * 4. Reduce "pay attention to" (keep max 1 per chapter; replace rest)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
let raw = readFileSync(filePath, "utf-8");
const data = JSON.parse(raw);

let fixCount = 0;

// ─── Helper: replace N-1 out of N occurrences of a phrase in a chapter ───
// Keeps the first occurrence, replaces subsequent ones with a random alternative.
function reducePhrase(text, phrase, alternatives, maxKeep = 1) {
  const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
  let count = 0;
  let changes = 0;
  return text.replace(regex, (match) => {
    count++;
    if (count <= maxKeep) return match; // keep first occurrence(s)
    changes++;
    // Pick replacement based on position to get variety
    const alt = alternatives[(count - maxKeep - 1) % alternatives.length];
    // Match original case
    if (match[0] === match[0].toUpperCase()) {
      return alt.charAt(0).toUpperCase() + alt.slice(1);
    }
    return alt;
  });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── 1. Remove "landscape" ───
{
  const before = JSON.stringify(data);
  function removeLandscape(obj) {
    if (typeof obj === "string") {
      return obj.replace(/\blandscape\b/gi, (m) => {
        fixCount++;
        return "environment";
      });
    }
    if (Array.isArray(obj)) return obj.map(removeLandscape);
    if (obj && typeof obj === "object") {
      const out = {};
      for (const k of Object.keys(obj)) out[k] = removeLandscape(obj[k]);
      return out;
    }
    return obj;
  }
  const fixed = removeLandscape(data);
  Object.assign(data, fixed);
}

// ─── 2-4. Reduce overused phrases per chapter ───
const phraseReplacements = {
  "think about": [
    "consider",
    "reflect on",
    "examine",
    "weigh",
    "look at",
    "sit with",
    "ask yourself about",
    "turn your attention to",
  ],
  "pay attention to": [
    "watch for",
    "note",
    "observe",
    "track",
    "stay alert to",
    "keep an eye on",
    "register",
  ],
  leverage: [
    "use",
    "employ",
    "apply",
    "capitalize on",
    "put to work",
    "draw on",
    "turn into advantage",
    "make use of",
  ],
};

function processChapter(ch) {
  let chStr = JSON.stringify(ch);

  for (const [phrase, alts] of Object.entries(phraseReplacements)) {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
    const matches = chStr.match(regex) || [];
    if (matches.length <= 1) continue;

    // Keep first, replace rest
    let count = 0;
    chStr = chStr.replace(regex, (match) => {
      count++;
      if (count <= 1) return match;
      fixCount++;
      const alt = alts[(count - 2) % alts.length];
      if (match[0] === match[0].toUpperCase()) {
        return alt.charAt(0).toUpperCase() + alt.slice(1);
      }
      return alt;
    });
  }

  return JSON.parse(chStr);
}

// Track leverage across book — only keep 6 total
let leverageKept = 0;
const maxLeverageBook = 6;

for (let i = 0; i < data.chapters.length; i++) {
  data.chapters[i] = processChapter(data.chapters[i]);
}

// Second pass: enforce book-wide leverage cap of 6
{
  let leverageTotal = 0;
  const chapterStrs = data.chapters.map((ch) => JSON.stringify(ch));
  for (let i = 0; i < chapterStrs.length; i++) {
    const matches = chapterStrs[i].match(/\bleverage\b/gi) || [];
    leverageTotal += matches.length;
  }

  if (leverageTotal > maxLeverageBook) {
    // Remove leverage from later chapters first
    let toRemove = leverageTotal - maxLeverageBook;
    for (let i = data.chapters.length - 1; i >= 0 && toRemove > 0; i--) {
      let chStr = JSON.stringify(data.chapters[i]);
      const matches = chStr.match(/\bleverage\b/gi) || [];
      if (matches.length === 0) continue;

      const alts = phraseReplacements.leverage;
      let count = 0;
      chStr = chStr.replace(/\bleverage\b/gi, (match) => {
        if (toRemove <= 0) return match;
        count++;
        toRemove--;
        fixCount++;
        const alt = alts[count % alts.length];
        if (match[0] === match[0].toUpperCase()) {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });
      data.chapters[i] = JSON.parse(chStr);
    }
  }
}

writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`Phase 2 complete. ${fixCount} fixes applied.`);

// Verify
let leverageFinal = 0;
for (const ch of data.chapters) {
  let chStr = JSON.stringify(ch);
  leverageFinal += (chStr.match(/\bleverage\b/gi) || []).length;
}
console.log(`Leverage total: ${leverageFinal} (target: ≤6)`);
