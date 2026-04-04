#!/usr/bin/env node
/**
 * Phase 2d: Second pass on closing sentence vocabulary
 * Uses replacements that don't contain any other banned words
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));

let fixCount = 0;

// None of these alternatives contain any banned word
const safeReplacements = {
  structural: ["built-in", "deep-rooted", "embedded", "ingrained", "wired-in", "baked-in", "inherent", "hardwired"],
  mechanism: ["process", "method", "engine", "lever", "trigger", "tool", "device", "operation"],
  pattern: ["tendency", "habit", "behavior", "rhythm", "cycle", "routine", "shape", "sequence"],
  dynamic: ["tension", "relationship", "force", "current", "interplay", "exchange", "pressure", "flow"],
  framework: ["model", "approach", "lens", "method", "blueprint", "scaffold", "guide", "map"],
  system: ["setup", "arrangement", "network", "process", "apparatus", "machine", "order", "configuration"],
};

const bannedFields = ["chapterBreakdown", "whyItMatters", "moreDetails", "whatToDo", "oneMinuteRecap"];
const counters = {};
for (const w of Object.keys(safeReplacements)) counters[w] = 0;

function isInBannedField(path) {
  return bannedFields.some((f) => path.includes(f));
}

function fixLastSentence(text) {
  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length === 0) return text;

  let lastPart = parts[parts.length - 1];
  let changed = false;

  // Match word stems (structural/structurally, system/systems, etc.)
  const stemPatterns = {
    structural: /\bstructural(?:ly)?\b/gi,
    mechanism: /\bmechanisms?\b/gi,
    pattern: /\bpatterns?\b/gi,
    dynamic: /\bdynamics?\b/gi,
    framework: /\bframeworks?\b/gi,
    system: /\bsystems?\b/gi,
  };

  for (const [word, regex] of Object.entries(stemPatterns)) {
    regex.lastIndex = 0;
    if (regex.test(lastPart)) {
      const alt = safeReplacements[word][counters[word] % safeReplacements[word].length];
      counters[word]++;
      regex.lastIndex = 0;
      lastPart = lastPart.replace(regex, (match) => {
        changed = true;
        // Handle plural: if match ends in 's', add 's' to replacement
        let rep = alt;
        if (match.endsWith("s") && !alt.endsWith("s")) rep = alt + "s";
        if (match.endsWith("ly")) rep = alt; // adverb form, just use base
        if (match[0] === match[0].toUpperCase()) {
          return rep.charAt(0).toUpperCase() + rep.slice(1);
        }
        return rep;
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

function walk(obj, path) {
  if (typeof obj === "string") {
    if (isInBannedField(path)) return fixLastSentence(obj);
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((v, i) => walk(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = walk(obj[k], `${path}.${k}`);
    return out;
  }
  return obj;
}

const fixed = walk(data, "root");
writeFileSync(filePath, JSON.stringify(fixed, null, 2) + "\n", "utf-8");
console.log(`Phase 2d complete. ${fixCount} closing sentences fixed.`);
