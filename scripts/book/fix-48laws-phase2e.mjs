#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));

const bannedFields = ["chapterBreakdown", "whyItMatters", "moreDetails", "whatToDo", "oneMinuteRecap"];
const alts = ["setup", "arrangement", "network", "apparatus", "order", "configuration", "method", "approach"];
let fixCount = 0;
let altIdx = 0;

function lastSentenceIdx(s) {
  // Find the start of the last sentence
  const matches = [...s.matchAll(/[.!?]\s+/g)];
  if (matches.length === 0) return 0;
  return matches[matches.length - 1].index + matches[matches.length - 1][0].length;
}

function fix(obj, path) {
  if (typeof obj === "string" && bannedFields.some((f) => path.includes(f))) {
    const idx = lastSentenceIdx(obj);
    const before = obj.slice(0, idx);
    let after = obj.slice(idx);

    if (/system/i.test(after)) {
      after = after.replace(/\bsystems?\b/gi, (m) => {
        const alt = alts[altIdx++ % alts.length];
        fixCount++;
        let rep = alt;
        if (m.endsWith("s") && !alt.endsWith("s")) rep = alt + "s";
        if (m[0] === m[0].toUpperCase()) rep = rep.charAt(0).toUpperCase() + rep.slice(1);
        return rep;
      });
      return before + after;
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((v, i) => fix(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = fix(obj[k], `${path}.${k}`);
    return out;
  }
  return obj;
}

const fixed = fix(data, "root");
writeFileSync(filePath, JSON.stringify(fixed, null, 2) + "\n");
console.log(`Fixed ${fixCount} remaining system instances in closings`);
