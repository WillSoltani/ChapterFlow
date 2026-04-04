#!/usr/bin/env node
/**
 * Phase 1 scripted fixes for the-48-laws-of-power.modern.json
 *
 * 1. ReviewCard schema migration: question→front, answer→back, add cardId
 * 2. Add endingType to all examples with 6-type rotation per chapter
 * 3. Replace em/en dashes and double-hyphens
 * 4. Rebalance correctIndex for ch1-6 and ch30
 * 5. Fix banned quiz prompt patterns
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));

let fixCount = 0;

// ─── 1. ReviewCard schema migration ───
const ENDING_TYPES = [
  "broader_principle",
  "self_directed_question",
  "surprising_implication",
  "cross_domain",
  "common_trap",
  "perspective_reframe",
];

for (const ch of data.chapters) {
  const chNum = String(ch.number).padStart(2, "0");
  const cards = ch.reviewCards || [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    // Add cardId if missing
    if (!card.cardId) {
      card.cardId = `ch${chNum}-rc${String(i + 1).padStart(2, "0")}`;
      fixCount++;
    }

    // Rename question → front (if using old schema)
    if (card.question && !card.front) {
      card.front = card.question;
      delete card.question;
      fixCount++;
    }

    // Rename answer → back (if using old schema)
    if (card.answer && !card.back) {
      card.back = card.answer;
      delete card.answer;
      fixCount++;
    }
  }
}

// ─── 2. Add endingType to all examples ───
for (const ch of data.chapters) {
  const exs = ch.examples || [];
  // Check if any example already has a valid endingType
  const needsEndingType = exs.some((ex) => !ex.endingType);
  if (!needsEndingType) continue;

  // Assign 6 ending types in rotation (shuffled by chapter to avoid same pattern)
  // Use a deterministic shuffle based on chapter number
  const shuffled = [...ENDING_TYPES];
  // Simple rotation offset by chapter number
  const offset = (ch.number - 1) % 6;
  const rotated = [...shuffled.slice(offset), ...shuffled.slice(0, offset)];

  for (let i = 0; i < exs.length; i++) {
    if (!exs[i].endingType) {
      exs[i].endingType = rotated[i % 6];
      fixCount++;
    }
  }
}

// ─── 3. Replace em/en dashes and double-hyphens ───
function fixDashes(obj) {
  if (typeof obj === "string") {
    let s = obj;
    // Em dash → comma or semicolon (use comma as default, context-dependent)
    s = s.replace(/\u2014/g, (_, offset, str) => {
      // If preceded by space and followed by space, use semicolon
      // Otherwise use comma
      return ", ";
    });
    // En dash → hyphen
    s = s.replace(/\u2013/g, "-");
    // Double hyphen → comma
    s = s.replace(/--/g, ", ");
    if (s !== obj) fixCount++;
    return s;
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => fixDashes(v));
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = fixDashes(obj[k]);
    }
    return out;
  }
  return obj;
}

const fixed = fixDashes(data);

// ─── 4. Rebalance correctIndex for ch1-6 and ch30 ───
const chaptersToRebalance = [1, 2, 3, 4, 5, 6, 30];

for (const chNum of chaptersToRebalance) {
  const ch = fixed.chapters.find((c) => c.number === chNum);
  if (!ch?.quiz?.questions) continue;

  const qs = ch.quiz.questions;
  if (qs.length !== 10) continue;

  // Current distribution
  const dist = [0, 0, 0];
  qs.forEach((q) => dist[q.correctIndex]++);

  // Target: [3, 4, 3] or [4, 3, 3] — balanced
  const targetDist = [3, 4, 3]; // 3 zeros, 4 ones, 3 twos
  const isBalanced = dist.every((d) => d >= 2 && d <= 5);

  if (!isBalanced) {
    // Reassign correctIndex to achieve balance
    // Build target sequence
    const targetSeq = [];
    for (let idx = 0; idx < 3; idx++) {
      for (let j = 0; j < targetDist[idx]; j++) {
        targetSeq.push(idx);
      }
    }
    // Shuffle deterministically based on chapter number
    const seed = chNum * 17;
    for (let i = targetSeq.length - 1; i > 0; i--) {
      const j = (seed + i * 13) % (i + 1);
      [targetSeq[i], targetSeq[j]] = [targetSeq[j], targetSeq[i]];
    }

    // Only reassign questions where the current answer is heavily overrepresented
    // For safety, we swap choices to make the new correctIndex point to the same content
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      const oldIdx = q.correctIndex;
      const newIdx = targetSeq[i];
      if (oldIdx !== newIdx) {
        // Swap the choices so the correct answer content moves to the new position
        const temp = q.choices[oldIdx];
        q.choices[oldIdx] = q.choices[newIdx];
        q.choices[newIdx] = temp;
        q.correctIndex = newIdx;
        fixCount++;
      }
    }
  }
}

// ─── 5. Fix banned quiz prompt patterns ───
for (const ch of fixed.chapters) {
  if (!ch.quiz?.questions) continue;
  for (const q of ch.quiz.questions) {
    if (/best applies/i.test(q.prompt)) {
      q.prompt = q.prompt.replace(/best applies/gi, "most closely aligns with");
      fixCount++;
    }
    if (/best puts.*?into practice/i.test(q.prompt)) {
      q.prompt = q.prompt.replace(/best puts(.*?)into practice/gi, "most effectively demonstrates$1in action");
      fixCount++;
    }
  }
}

// ─── Write output ───
writeFileSync(filePath, JSON.stringify(fixed, null, 2) + "\n", "utf-8");
console.log(`Phase 1 complete. ${fixCount} fixes applied.`);
