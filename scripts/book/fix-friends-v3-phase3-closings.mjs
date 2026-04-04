#!/usr/bin/env node
/**
 * Phase 3: Fix H3 repeated closing starts + H2 global closing vocab
 */

import { readFileSync, writeFileSync } from "fs";

const FILE = "book-packages/friends-and-influence.modern.json";
const pkg = JSON.parse(readFileSync(FILE, "utf-8").trim());
const chapters = pkg.chapters;

function isToneObj(obj) {
  return obj && typeof obj === "object" && !Array.isArray(obj) &&
    typeof obj.gentle === "string" && typeof obj.direct === "string" && typeof obj.competitive === "string";
}

function getLastSentence(s) {
  if (!s) return "";
  const sentences = s.trim().split(/(?<=[.!?])\s+/);
  return (sentences[sentences.length - 1] || "").trim();
}

let h3fixes = 0;
let h2fixes = 0;

// ═══════════════════════════════════════
// H3: Fix repeated closing starts within chapter sections
// ═══════════════════════════════════════
const replacementPrefixes = {
  "ultimately, the": ["Over time, the", "In the end, the", "The compounding result is the", "What accumulates is the", "The net outcome favors the"],
  "in practice, the": ["When applied, the", "On the ground, the", "In execution, the", "Once deployed, the", "The real-world test confirms the"],
  "ultimately, when": ["Over time, when", "The compounding effect appears when", "In the long run, when"],
  "the person who": ["The individual who", "Whoever", "Anyone who", "The one who", "Those who"],
};

for (const ch of chapters) {
  const sections = { whyItMatters: [], whatToDo: [], moreDetails: [] };

  // Collect entries with references to their parent objects
  if (ch.examples) {
    for (const ex of ch.examples) {
      for (const section of ["whyItMatters", "whatToDo"]) {
        if (ex[section] && isToneObj(ex[section])) {
          for (const tone of ["gentle", "direct", "competitive"]) {
            const fullText = ex[section][tone];
            const ls = getLastSentence(fullText);
            if (ls) sections[section].push({ ls, fullText, obj: ex[section], tone });
          }
        }
      }
    }
  }

  const cv = ch.contentVariants || {};
  for (const depth of ["medium", "hard"]) {
    if (cv[depth]?.keyTakeaways) {
      cv[depth].keyTakeaways.forEach((kt) => {
        if (kt.moreDetails && isToneObj(kt.moreDetails)) {
          for (const tone of ["gentle", "direct", "competitive"]) {
            const fullText = kt.moreDetails[tone];
            const ls = getLastSentence(fullText);
            if (ls) sections.moreDetails.push({ ls, fullText, obj: kt.moreDetails, tone });
          }
        }
      });
    }
  }

  for (const [section, entries] of Object.entries(sections)) {
    const seenFirst3 = {};

    for (const entry of entries) {
      const words = entry.ls.split(/\s+/);
      const f3 = words.slice(0, 3).join(" ").toLowerCase();
      if (f3.length <= 5) continue;

      if (seenFirst3[f3] !== undefined) {
        seenFirst3[f3]++;

        // Find the best replacement
        let replaced = false;
        for (const [prefix, alts] of Object.entries(replacementPrefixes)) {
          if (f3.startsWith(prefix)) {
            const prefixWords = prefix.split(/\s+/).length;
            const originalPrefix = words.slice(0, prefixWords).join(" ");
            const rest = entry.ls.substring(originalPrefix.length);
            const altIdx = (seenFirst3[f3] - 1) % alts.length;
            const newLs = alts[altIdx] + rest;

            // Replace in full text
            const lastIdx = entry.fullText.lastIndexOf(entry.ls);
            if (lastIdx >= 0) {
              entry.obj[entry.tone] = entry.fullText.substring(0, lastIdx) + newLs;
              h3fixes++;
              replaced = true;
            }
            break;
          }
        }

        if (!replaced) {
          // Generic fix: prepend a different transition word
          const genericAlts = ["What compounds here:", "The lasting effect:", "The result that sticks:", "The takeaway:", "What stays:"];
          const altIdx = (seenFirst3[f3] - 1) % genericAlts.length;
          const newLs = genericAlts[altIdx] + " " + entry.ls[0].toLowerCase() + entry.ls.substring(1);
          const lastIdx = entry.fullText.lastIndexOf(entry.ls);
          if (lastIdx >= 0) {
            entry.obj[entry.tone] = entry.fullText.substring(0, lastIdx) + newLs;
            h3fixes++;
          }
        }
      } else {
        seenFirst3[f3] = 0;
      }
    }
  }
}

// ═══════════════════════════════════════
// H2: Fix closing vocab in ALL string fields (not just banned-field subset)
// Global caps: structural/mechanism/pattern max 3 closing sentences each across entire book
// ═══════════════════════════════════════
const globalClosingCaps = {
  "structural": { max: 3, count: 0, alts: ["foundational", "underlying", "built-in"] },
  "mechanism": { max: 3, count: 0, alts: ["process", "engine", "operation"] },
  "pattern": { max: 3, count: 0, alts: ["tendency", "habit", "cycle"] },
};

function walkFixGlobalClosing(obj, path) {
  if (typeof obj === "string") {
    const ls = getLastSentence(obj);
    let newLs = ls;
    let changed = false;

    for (const [word, config] of Object.entries(globalClosingCaps)) {
      const re = new RegExp(`\\b${word}(s)?\\b`, "gi");
      if (re.test(newLs)) {
        config.count++;
        if (config.count > config.max) {
          re.lastIndex = 0;
          newLs = newLs.replace(re, (match) => {
            changed = true;
            h2fixes++;
            const alt = config.alts[(config.count - config.max - 1) % config.alts.length];
            const isPlural = match.endsWith("s") || match.endsWith("S");
            const result = isPlural ? alt + "s" : alt;
            return match[0] === match[0].toUpperCase() ? result[0].toUpperCase() + result.slice(1) : result;
          });
        }
      }
    }

    if (changed) {
      const lastIdx = obj.lastIndexOf(ls);
      if (lastIdx >= 0) return obj.substring(0, lastIdx) + newLs;
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((v, i) => walkFixGlobalClosing(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walkFixGlobalClosing(v, `${path}.${k}`);
    return out;
  }
  return obj;
}

for (let i = 0; i < chapters.length; i++) {
  chapters[i] = walkFixGlobalClosing(chapters[i], `ch${chapters[i].number}`);
}

writeFileSync(FILE, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

console.log(`Phase 3 fixes:`);
console.log(`  H3 repeated closings: ${h3fixes}`);
console.log(`  H2 global closing vocab: ${h2fixes}`);
