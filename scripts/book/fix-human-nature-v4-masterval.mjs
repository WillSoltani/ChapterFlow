#!/usr/bin/env node
/**
 * MasterValidator Phase 1 + 2 fixes for laws-of-human-nature.modern.json
 * Addresses all automated issues from the validator report.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, "book-packages", "laws-of-human-nature.modern.json");

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJson(p, v) { fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n", "utf8"); }
function wordCount(s) { return String(s).trim().split(/\s+/).filter(Boolean).length; }
function lastSentence(s) {
  const parts = String(s).trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

let pkg = readJson(PACKAGE_PATH);
let totalFixes = 0;

function walkAndReplace(obj, replacer, currentPath = []) {
  if (typeof obj === "string") return replacer(obj, currentPath.join("."));
  if (Array.isArray(obj)) return obj.map((v, i) => walkAndReplace(v, replacer, [...currentPath, String(i)]));
  if (obj && typeof obj === "object") {
    const r = {};
    for (const [k, v] of Object.entries(obj)) r[k] = walkAndReplace(v, replacer, [...currentPath, k]);
    return r;
  }
  return obj;
}

// ═══════════════════════════════════════════════════════
// PHASE 1: BANNED PHRASE REPLACEMENTS
// ═══════════════════════════════════════════════════════
console.log("PHASE 1: Banned phrases");

const phraseReplacements = [
  // "the art of" → context-specific replacements
  [/\bthe art of leaving room/gi, "the skill of leaving room"],
  [/\bmasters the art of the incomplete/gi, "masters the incomplete"],
  // "at its core" → "fundamentally" or remove
  [/\bAt its core, what does/gi, "Fundamentally, what does"],
  // "In conclusion" → was actually "conclusions" which is fine — but let's check
  // The actual text was "uncertain conclusions" — NOT the phrase "In conclusion". False positive.
  // "robust" → "strong" / "durable"
  [/\brobustness\b/gi, "durability"],
];

for (const [re, replacement] of phraseReplacements) {
  pkg = walkAndReplace(pkg, (text) => {
    const newText = text.replace(re, replacement);
    if (newText !== text) { totalFixes++; console.log(`  Fixed: ${re} → ${replacement}`); }
    return newText;
  });
}

// ═══════════════════════════════════════════════════════
// PHASE 1b: LEVERAGE REDUCTION (9→6, remove from 3 chapters)
// ═══════════════════════════════════════════════════════
console.log("\nPHASE 1b: Leverage reduction");

// Remove leverage from ch9, ch14, ch17 (where it's least essential)
const leverageRemovals = [
  // ch9: "paranoia demanded leverage" → "paranoia demanded control"
  { ch: 9, path: "easy.chapterBreakdown.direct", from: "paranoia demanded leverage", to: "paranoia demanded control" },
  // ch14: "most efficient leverage points" → "most efficient pressure points"
  { ch: 14, path: "hard.keyTakeaways.2.moreDetails.competitive", from: "most efficient leverage points", to: "most efficient pressure points" },
  // ch17: "highest-leverage positioning" → "highest-impact positioning"
  { ch: 17, path: "medium.keyTakeaways.2.point.direct", from: "highest-leverage positioning", to: "highest-impact positioning" },
];

for (const rem of leverageRemovals) {
  const ch = pkg.chapters.find(c => c.number === rem.ch);
  if (!ch) continue;
  const parts = rem.path.split(".");
  let obj = ch.contentVariants;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj?.[parts[i]];
  }
  const lastKey = parts[parts.length - 1];
  if (obj && typeof obj[lastKey] === "string" && obj[lastKey].includes(rem.from)) {
    obj[lastKey] = obj[lastKey].replace(rem.from, rem.to);
    totalFixes++;
    console.log(`  ch${rem.ch}: "${rem.from}" → "${rem.to}"`);
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 1c: "THINK ABOUT" REDUCTION
// ═══════════════════════════════════════════════════════
console.log("\nPHASE 1c: 'think about' reduction");

const thinkAboutAlts = [
  "consider what happens when",
  "reflect on",
  "examine",
  "look at what happens when",
  "picture",
  "recall",
  "notice",
  "take a moment with",
  "sit with the idea that",
  "ask yourself about",
  "turn your attention to",
  "focus on",
];
let taAltIdx = 0;

for (const ch of pkg.chapters) {
  let count = 0;
  // Count occurrences first
  const countInChapter = (obj) => {
    if (typeof obj === "string") return (obj.match(/\bthink about\b/gi) || []).length;
    if (Array.isArray(obj)) return obj.reduce((s, v) => s + countInChapter(v), 0);
    if (obj && typeof obj === "object") return Object.values(obj).reduce((s, v) => s + countInChapter(v), 0);
    return 0;
  };
  count = countInChapter(ch);
  if (count <= 1) continue;

  // Replace all but the first occurrence
  let seen = 0;
  const replaceThinkAbout = (obj) => {
    if (typeof obj === "string") {
      return obj.replace(/\b(T|t)hink about\b/g, (match) => {
        seen++;
        if (seen === 1) return match; // keep first
        const alt = thinkAboutAlts[taAltIdx % thinkAboutAlts.length];
        taAltIdx++;
        totalFixes++;
        // Preserve capitalization
        const capitalized = match[0] === "T" ? alt.charAt(0).toUpperCase() + alt.slice(1) : alt;
        return capitalized;
      });
    }
    if (Array.isArray(obj)) return obj.map(replaceThinkAbout);
    if (obj && typeof obj === "object") {
      const r = {};
      for (const [k, v] of Object.entries(obj)) r[k] = replaceThinkAbout(v);
      return r;
    }
    return obj;
  };

  const chIdx = pkg.chapters.indexOf(ch);
  pkg.chapters[chIdx] = replaceThinkAbout(ch);
  if (count > 1) console.log(`  ch${ch.number}: reduced "think about" from ${count} to 1`);
}

// ═══════════════════════════════════════════════════════
// PHASE 1d: DIALOGUE QUOTE FORMAT (single → double quotes)
// ═══════════════════════════════════════════════════════
console.log("\nPHASE 1d: Dialogue quote format");

const dialogueChapters = [4, 10, 11, 12, 14, 15];
for (const chNum of dialogueChapters) {
  const ch = pkg.chapters.find(c => c.number === chNum);
  if (!ch) continue;
  const dlgEx = ch.examples.find(e => e.format === "dialogue");
  if (!dlgEx) continue;

  for (const tone of ["gentle", "direct", "competitive"]) {
    const text = dlgEx.scenario?.[tone];
    if (!text) continue;
    // Convert dialogue pattern: Name: 'speech' → Name: "speech"
    // Match: opening single quote after colon+space, closing single quote before newline/period/end
    let newText = text;
    // Pattern: after "Name: " replace single-quoted speech with double-quoted
    newText = newText.replace(/(\w+:\s*)'([^']+)'/g, '$1"$2"');
    if (newText !== text) {
      dlgEx.scenario[tone] = newText;
      totalFixes++;
      console.log(`  ch${chNum}/${tone}: converted dialogue to double quotes`);
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 2a: CLOSING SENTENCE REWRITES
// Remove banned vocab from closing sentences of content fields
// ═══════════════════════════════════════════════════════
console.log("\nPHASE 2a: Closing sentence vocab cleanup");

const closingBannedWords = ["structural", "mechanism", "pattern", "dynamic", "framework", "system"];
const closingFieldNames = ["chapterBreakdown", "whyItMatters", "moreDetails", "whatToDo", "oneMinuteRecap"];

// Replacement map for banned words in closing sentences
const closingWordAlts = {
  "structural": ["foundational", "built-in", "underlying", "deep", "architectural"],
  "mechanism": ["process", "function", "operation", "pathway", "method"],
  "pattern": ["tendency", "behavior", "habit", "cycle", "sequence"],
  "dynamic": ["interaction", "relationship", "tension", "force", "exchange"],
  "framework": ["approach", "model", "lens", "method", "perspective"],
  "system": ["process", "method", "approach", "arrangement", "architecture"],
};

let closingFixCount = 0;

function fixClosingSentences(obj, path = "") {
  if (typeof obj === "string") {
    // Check if this is a content field
    const isTargetField = closingFieldNames.some(fn => path.includes(fn));
    if (!isTargetField) return obj;

    const ls = lastSentence(obj);
    const lsLower = ls.toLowerCase();
    let needsFix = false;
    for (const w of closingBannedWords) {
      if (lsLower.includes(w)) { needsFix = true; break; }
    }
    if (!needsFix) return obj;

    // Replace banned words in the last sentence
    let fixedLs = ls;
    for (const [word, alts] of Object.entries(closingWordAlts)) {
      const re = new RegExp(`\\b${word}(s|al|ic|atic)?\\b`, "gi");
      if (re.test(fixedLs)) {
        const alt = alts[closingFixCount % alts.length];
        fixedLs = fixedLs.replace(re, (match) => {
          // Handle suffixes
          const suffix = match.slice(word.length);
          let replacement = alt;
          if (suffix === "s") replacement = alt + "s";
          else if (suffix === "al") replacement = alt; // "structural" → "foundational"
          else if (suffix === "ic") replacement = alt;
          else if (suffix === "atic") replacement = alt;
          // Preserve case
          if (match[0] === match[0].toUpperCase()) replacement = replacement[0].toUpperCase() + replacement.slice(1);
          closingFixCount++;
          return replacement;
        });
      }
    }

    if (fixedLs !== ls) {
      totalFixes++;
      return obj.slice(0, obj.length - ls.length) + fixedLs;
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((v, i) => fixClosingSentences(v, path + "[" + i + "]"));
  if (obj && typeof obj === "object") {
    const r = {};
    for (const [k, v] of Object.entries(obj)) r[k] = fixClosingSentences(v, path + "." + k);
    return r;
  }
  return obj;
}

pkg = fixClosingSentences(pkg);
console.log(`  Fixed ${closingFixCount} closing sentences with banned vocabulary`);

// ═══════════════════════════════════════════════════════
// PHASE 2b: CHARACTER NAME DEDUPLICATION
// ═══════════════════════════════════════════════════════
console.log("\nPHASE 2b: Character name deduplication");

// Dex appears in ch1, 5, 6, 12, 18 — rename in ch5, 6, 18
const nameRenames = [
  { ch: 5, from: "Dex", to: "Ren" },
  { ch: 6, from: "Dex", to: "Caleb" },
  { ch: 18, from: "Dex", to: "Jude" },
  // Marcus appears in ch3, 4, 6, 15, 16 — rename in ch6, 15, 16
  { ch: 6, from: "Marcus", to: "Adrian" },
  { ch: 15, from: "Marcus", to: "Dominic" },
  { ch: 16, from: "Marcus", to: "Henrik" },
  // Noor appears in ch2, 3, 7, 12 — rename in ch7, 12
  { ch: 7, from: "Noor", to: "Priya" },
  { ch: 12, from: "Noor", to: "Amara" },
];

for (const ren of nameRenames) {
  const ch = pkg.chapters.find(c => c.number === ren.ch);
  if (!ch) continue;

  let found = false;
  const rename = (obj) => {
    if (typeof obj === "string") {
      const re = new RegExp(`\\b${ren.from}\\b`, "g");
      if (re.test(obj)) found = true;
      return obj.replace(re, ren.to);
    }
    if (Array.isArray(obj)) return obj.map(rename);
    if (obj && typeof obj === "object") {
      const r = {};
      for (const [k, v] of Object.entries(obj)) r[k] = rename(v);
      return r;
    }
    return obj;
  };

  // Only rename in examples (not in chapter content which may reference historical figures)
  ch.examples = ch.examples.map(ex => rename(ex));
  if (found) {
    totalFixes++;
    console.log(`  ch${ren.ch}: ${ren.from} → ${ren.to}`);
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 2c: DILEMMA TITLE PATTERN (reduce from 4→3)
// ═══════════════════════════════════════════════════════
console.log("\nPHASE 2c: Dilemma title reduction");

// Find all dilemma titles
let dilemmaCount = 0;
for (const ch of pkg.chapters) {
  for (const ex of ch.examples) {
    if (/Dilemma/i.test(ex.title)) {
      dilemmaCount++;
      if (dilemmaCount === 4) {
        // Rename the 4th one
        const oldTitle = ex.title;
        ex.title = ex.title.replace(/Dilemma$/i, "Crossroads");
        totalFixes++;
        console.log(`  ch${ch.number}: "${oldTitle}" → "${ex.title}"`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 2d: FIX CH15 VIGNETTE "She stood"
// ═══════════════════════════════════════════════════════
console.log("\nPHASE 2d: Fix ch15 vignette");

const ch15 = pkg.chapters.find(c => c.number === 15);
if (ch15) {
  const hkt = ch15.contentVariants.hard.keyTakeaways;
  for (const kt of hkt) {
    if (kt.moreDetails?.competitive?.includes("She stood")) {
      kt.moreDetails.competitive = kt.moreDetails.competitive.replace(
        /She stood\b/g,
        "The leader who held position"
      );
      totalFixes++;
      console.log("  Fixed 'She stood' vignette in ch15/hard/competitive");
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 2e: CH6 EASY DIRECT WORD COUNT (178→175)
// ═══════════════════════════════════════════════════════
console.log("\nPHASE 2e: Ch6 word count trim");

const ch6 = pkg.chapters.find(c => c.number === 6);
if (ch6) {
  let text = ch6.contentVariants.easy.chapterBreakdown.direct;
  // Trim 3 words — remove filler phrase
  text = text.replace("a questions before a significant decision separate", "questions before a significant decision separate");
  const wc = wordCount(text);
  ch6.contentVariants.easy.chapterBreakdown.direct = text;
  totalFixes++;
  console.log(`  Ch6 easy/direct now ${wc} words`);
}

// ═══════════════════════════════════════════════════════
// WRITE OUTPUT
// ═══════════════════════════════════════════════════════
writeJson(PACKAGE_PATH, pkg);
console.log(`\n═══════════════════════════════════════`);
console.log(`TOTAL FIXES APPLIED: ${totalFixes}`);
console.log(`═══════════════════════════════════════`);
console.log(`File written: ${PACKAGE_PATH}`);
