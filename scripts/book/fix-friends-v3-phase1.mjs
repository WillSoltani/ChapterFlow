#!/usr/bin/env node
/**
 * Phase 1 fix script for friends-and-influence.modern.json
 * Mechanical replacements: double-hyphens, banned phrases, study group cap, leverage-as-verb
 */

import { readFileSync, writeFileSync } from "fs";

const FILE = "book-packages/friends-and-influence.modern.json";
const raw = readFileSync(FILE, "utf-8");
const pkg = JSON.parse(raw);
const chapters = pkg.chapters;

const stats = { doubleHyphens: 0, bannedPhrases: 0, studyGroup: 0, leverage: 0 };

// ─── Helper: walk and transform all strings ───
function walkAndTransform(obj, path, fn) {
  if (typeof obj === "string") return fn(obj, path);
  if (Array.isArray(obj)) return obj.map((v, i) => walkAndTransform(v, `${path}[${i}]`, fn));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walkAndTransform(v, `${path}.${k}`, fn);
    return out;
  }
  return obj;
}

// ─── 1. Double-hyphen fix ───
// Pattern: " -- " or " --" or "-- " surrounded by word context → replace with appropriate punctuation
// Most are parenthetical asides (like em dashes), replace with comma or semicolon based on context
function fixDoubleHyphens(s) {
  let count = 0;
  const result = s.replace(/\s*--\s*/g, (match, offset) => {
    count++;
    const before = s.substring(Math.max(0, offset - 1), offset);
    const after = s.substring(offset + match.length, offset + match.length + 1);

    // If at start of a list item or after a period, use colon
    if (before === "." || before === ":") return ": ";

    // Default: parenthetical aside → use comma-space or, for contrast pairs, semicolon
    // Check if it's a contrast/parallel ("not X -- Y", "X -- not Y")
    const afterWord = s.substring(offset + match.length, offset + match.length + 10).toLowerCase();
    const beforeChunk = s.substring(Math.max(0, offset - 15), offset).toLowerCase();

    if (afterWord.startsWith("not ") || afterWord.startsWith("never ") ||
        beforeChunk.includes(" not ") || beforeChunk.includes(" never ")) {
      return ", ";
    }

    // For "X -- Y" where it's a dramatic pause or restatement
    return ", ";
  });
  stats.doubleHyphens += count;
  return result;
}

// ─── 2. Banned phrases ───
function fixBannedPhrases(s, path) {
  let result = s;

  // "at its core" → remove or replace contextually
  const aic = result.match(/at its core/gi);
  if (aic) {
    stats.bannedPhrases += aic.length;
    result = result.replace(/[,;]?\s*at its core[,;]?\s*/gi, (match) => {
      // If it's mid-sentence with commas, just remove it
      if (match.startsWith(",") || match.startsWith(";")) return " ";
      return " ";
    });
    // Clean up double spaces
    result = result.replace(/\s{2,}/g, " ");
  }

  // "landscape" → replace with "environment" or "terrain" or just remove
  if (/\blandscape\b/i.test(result)) {
    stats.bannedPhrases++;
    result = result.replace(/\blandscape\b/gi, "environment");
  }

  return result;
}

// ─── 3. Leverage as verb ───
function fixLeverageVerb(s, path) {
  let result = s;

  // "leveraging" → "using" or "applying"
  if (/\bleveraging\b/i.test(result)) {
    stats.leverage++;
    result = result.replace(/\bleveraging\b/gi, "using");
  }
  // "leveraged" → "used" or "applied"
  if (/\bleveraged\b/i.test(result)) {
    stats.leverage++;
    result = result.replace(/\bleveraged\b/gi, "applied");
  }
  // "to leverage" → "to use" or "to apply"
  if (/\bto leverage\b/i.test(result)) {
    stats.leverage++;
    result = result.replace(/\bto leverage\b/gi, "to use");
  }

  return result;
}

// ─── 4. Study group cap (need to reduce from 5 chapters to 3) ───
// Keep ch3 (core example), ch4 (quiz question), ch5 (core example)
// Replace in ch8 and ch36
const studyGroupReplaceChapters = new Set([8, 36]);
function fixStudyGroup(s, path, chNum) {
  if (!studyGroupReplaceChapters.has(chNum)) return s;
  if (!/study group/i.test(s)) return s;

  stats.studyGroup++;
  // ch8 is about interests → "peer workshop" fits
  // ch36 is about courtesy → "collaborative session" fits
  const replacement = chNum === 8 ? "peer workshop" : "collaborative session";
  return s.replace(/\bstudy groups?\b/gi, (match) => {
    const isPlural = match.toLowerCase().endsWith("s");
    return isPlural ? replacement + "s" : replacement;
  });
}

// ─── Apply all fixes ───
for (const ch of chapters) {
  const chNum = ch.number;
  const idx = chapters.indexOf(ch);

  chapters[idx] = walkAndTransform(ch, `ch${chNum}`, (s, path) => {
    let result = s;
    result = fixDoubleHyphens(result);
    result = fixBannedPhrases(result, path);
    result = fixLeverageVerb(result, path);
    result = fixStudyGroup(result, path, chNum);
    return result;
  });
}

// Write back
writeFileSync(FILE, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

console.log("Phase 1 fixes applied:");
console.log(`  Double-hyphens replaced: ${stats.doubleHyphens}`);
console.log(`  Banned phrases fixed:    ${stats.bannedPhrases}`);
console.log(`  Leverage-as-verb fixed:  ${stats.leverage}`);
console.log(`  Study group replaced:    ${stats.studyGroup}`);

// Quick verification: check for remaining issues
const updated = readFileSync(FILE, "utf-8");
const remaining = {
  doubleHyphens: (updated.match(/--/g) || []).length,
  atItsCore: (updated.match(/at its core/gi) || []).length,
  landscape: (updated.match(/\blandscape\b/gi) || []).length,
  leverageVerb: (updated.match(/\b(to leverage|leveraging|leveraged)\b/gi) || []).length,
};
console.log("\nRemaining after fix:");
console.log(`  Double-hyphens: ${remaining.doubleHyphens}`);
console.log(`  "at its core":  ${remaining.atItsCore}`);
console.log(`  "landscape":    ${remaining.landscape}`);
console.log(`  leverage-verb:  ${remaining.leverageVerb}`);

// Count study group chapters
const updatedPkg = JSON.parse(updated);
const sgChs = new Set();
updatedPkg.chapters.forEach(c => { if (JSON.stringify(c).toLowerCase().includes("study group")) sgChs.add(c.number); });
console.log(`  Study group chapters: ${[...sgChs].join(", ")} (${sgChs.size} total, max 3)`);
