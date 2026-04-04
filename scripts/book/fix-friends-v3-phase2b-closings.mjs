#!/usr/bin/env node
/**
 * Phase 2b: targeted closing vocabulary fix for remaining violations.
 * Handles compound words (structurally, systematically, dynamics) and compound nouns.
 */

import { readFileSync, writeFileSync } from "fs";

const FILE = "book-packages/friends-and-influence.modern.json";
const pkg = JSON.parse(readFileSync(FILE, "utf-8"));
const chapters = pkg.chapters;

const bannedFieldPaths = ["chapterbreakdown", "whyitmatters", "moredetails", "whattodo", "oneminuterecap"];
function isInBannedField(path) { return bannedFieldPaths.some(f => path.toLowerCase().includes(f)); }
function getLastSentence(s) { return s.trim().split(/(?<=[.!?])\s+/).pop() || ""; }

// Extended patterns: catch word variants too
const extendedBanned = [
  { pattern: /\bstructural(ly)?\b/gi, replace: (m) => m.endsWith("ly") ? "fundamentally" : "foundational" },
  { pattern: /\bmechanism(s)?\b/gi, replace: (m) => m.endsWith("s") ? "processes" : "process" },
  { pattern: /\bsystem(s|atic|atically)?\b/gi, replace: (m) => {
    if (/atically$/i.test(m)) return "methodically";
    if (/atic$/i.test(m)) return "methodical";
    if (/s$/i.test(m)) return "processes";
    return "process";
  }},
  { pattern: /\bdynamic(s)?\b/gi, replace: (m) => m.endsWith("s") ? "interactions" : "interplay" },
  { pattern: /\bpattern(s)?\b/gi, replace: (m) => m.endsWith("s") ? "tendencies" : "tendency" },
  { pattern: /\bframework(s)?\b/gi, replace: (m) => m.endsWith("s") ? "approaches" : "approach" },
];

let fixes = 0;

function fixClosing(s, path) {
  if (typeof s !== "string" || !isInBannedField(path)) return s;
  const lastSent = getLastSentence(s);
  let newLastSent = lastSent;
  let changed = false;

  for (const { pattern, replace } of extendedBanned) {
    pattern.lastIndex = 0;
    if (pattern.test(newLastSent)) {
      pattern.lastIndex = 0;
      newLastSent = newLastSent.replace(pattern, (match) => {
        changed = true;
        const r = replace(match);
        // Preserve leading case
        if (match[0] === match[0].toUpperCase()) return r[0].toUpperCase() + r.slice(1);
        return r;
      });
    }
  }

  if (changed) {
    fixes++;
    const trimmed = s.trim();
    const lastIdx = trimmed.lastIndexOf(lastSent);
    if (lastIdx >= 0) return trimmed.substring(0, lastIdx) + newLastSent;
  }
  return s;
}

function walk(obj, path) {
  if (typeof obj === "string") return fixClosing(obj, path);
  if (Array.isArray(obj)) return obj.map((v, i) => walk(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walk(v, `${path}.${k}`);
    return out;
  }
  return obj;
}

for (let i = 0; i < chapters.length; i++) {
  chapters[i] = walk(chapters[i], `ch${chapters[i].number}`);
}

writeFileSync(FILE, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
console.log(`Phase 2b: ${fixes} additional closing vocab fixes applied.`);

// Verify
const updated = JSON.parse(readFileSync(FILE, "utf-8"));
let remaining = 0;
function verify(obj, path) {
  if (typeof obj === "string") {
    if (!isInBannedField(path)) return;
    const ls = getLastSentence(obj).toLowerCase();
    for (const w of ["structural", "mechanism", "system", "dynamic", "pattern", "framework"]) {
      if (new RegExp(`\\b${w}`).test(ls)) {
        remaining++;
        console.log("  REMAINING:", path.substring(0, 70), "→", ls.substring(0, 80));
      }
    }
    return;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => verify(v, `${path}[${i}]`)); return; }
  if (obj && typeof obj === "object") { for (const [k, v] of Object.entries(obj)) verify(v, `${path}.${k}`); }
}
updated.chapters.forEach(ch => verify(ch, "ch" + ch.number));
console.log(`Remaining closing vocab violations: ${remaining}`);
