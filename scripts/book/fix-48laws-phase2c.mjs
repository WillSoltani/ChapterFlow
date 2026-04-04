#!/usr/bin/env node
/**
 * Phase 2c: Fix gentle opener repetition + remaining phrase overuse
 *
 * 1. Diversify repeated gentle openers (first 6 words matching >2 chapters)
 * 2. Reduce remaining "think about" and "ask yourself" overuse
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));

let fixCount = 0;

// ─── 1. Fix repeated gentle openers ───
// Map of overused opener → array of alternatives
const openerReplacements = {
  "What is the strongest argument against": [
    "Where does this idea break down when you",
    "If you had to argue the opposite of",
    "Name the weakest point in the reasoning",
    "What would a sharp critic say about",
    "How would someone who disagrees challenge",
    "Identify the most vulnerable assumption in",
    "Push back on this: where does the",
    "Steelman the opposing view on this by",
    "Find the gap in the logic of",
    "Which part of this claim would survive",
    "Where exactly does this reasoning lose its",
    "If you flipped this argument around completely",
    "Pinpoint the assumption most likely to fail",
    "Think of someone who would reject this",
    "Which real-world counterexample would undermine this",
    "Where has this type of thinking led",
    "Challenge the premise: what if the opposite",
    "Test this idea against your own experience",
    "What would change your mind about this",
    "Find one situation where this backfires completely",
    "Argue against this using your own evidence",
    "Which part of this would not survive",
    "Take the opposing side and explain why",
    "Name a scenario where following this advice",
    "What blind spot does this perspective create",
  ],
  "After reading, ask yourself: why does": [
    "Once you finish, consider: what makes this",
    "Reflect on this: why would someone who",
    "Pause and ask: what specific part of",
    "Before moving on, examine: how does this",
    "Circle back to the key question: what",
    "Sit with this for a moment: why",
  ],
  "Without looking back, try to recall": [
    "From memory, describe the main idea behind",
    "Close the page and summarize what you",
    "Test yourself: what were the key points",
    "See if you can reconstruct the core",
    "Without peeking, what stayed with you from",
    "From memory alone, what was the central",
  ],
  "Before reading, write down the name": [
    "Before you start, jot down a situation",
    "Grab a pen first and note the",
    "Quick preparation: write down one person who",
    "Start by recording your initial thoughts about",
    "First, capture in writing a moment when",
  ],
  "Without looking back, explain the difference": [
    "From memory, articulate what separates this idea",
    "Close the page and distinguish between the",
    "Test your recall: how would you contrast",
    "See how clearly you can differentiate the",
    "Without rereading, describe the gap between the",
  ],
  "After reading, can you explain why": [
    "Once done, test yourself: what is the",
    "Reflect afterward: how would you explain the",
    "When finished, see if you can articulate",
    "After the chapter, try putting into words",
    "Pause at the end and answer: what",
    "Check your understanding: can you restate why",
  ],
  "Before reading, write down the last": [
    "Before diving in, note a recent time",
    "Quick pre-read: record the most recent example",
    "First, write about a moment this week",
    "Start with a note about the last",
    "Capture in writing one recent instance when",
    "Begin by recalling the most recent time",
    "Quick prep: jot down when you last",
  ],
  "Before reading, think of a time": [
    "Before you begin, recall a moment when",
    "Start by remembering a situation where you",
    "Call to mind an experience where this",
    "Before diving in, bring to mind a",
  ],
  "There is a particular kind of": [
    "A specific type of situation reveals how",
    "One recurring theme in these situations is",
  ],
  "Once a week, pick one person": [
    "Each week, choose someone in your circle",
    "Weekly, select a different person and observe",
    "On a regular basis, focus on one",
  ],
  "If you step back and look": [
    "When you zoom out and observe the",
    "Stepping back reveals something interesting about",
    "Pull back and notice how this chapter",
  ],
  "There is a real danger in": [
    "A genuine risk emerges when you start",
    "The trap here is subtle: when you",
  ],
};

// Walk all gentle fields and replace overused openers
function walkAndFixOpeners(obj, path) {
  if (typeof obj === "string" && path.endsWith(".gentle")) {
    const first6 = obj.trim().split(/\s+/).slice(0, 6).join(" ");
    for (const [opener, alts] of Object.entries(openerReplacements)) {
      if (first6 === opener) {
        // Track usage to rotate through alternatives
        if (!openerReplacements._counts) openerReplacements._counts = {};
        const count = openerReplacements._counts[opener] || 0;
        openerReplacements._counts[opener] = count + 1;

        // Keep first 2 as-is, replace the rest
        if (count < 2) return obj;

        const alt = alts[(count - 2) % alts.length];
        // Replace the first 6 words with the alternative
        const words = obj.trim().split(/\s+/);
        const rest = words.slice(6).join(" ");
        fixCount++;
        return alt + " " + rest;
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((v, i) => walkAndFixOpeners(v, `${path}[${i}]`));
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = walkAndFixOpeners(obj[k], `${path}.${k}`);
    }
    return out;
  }
  return obj;
}

const fixed = walkAndFixOpeners(data, "root");

// ─── 2. Fix remaining "think about" (ch11, ch36) and "ask yourself" (ch24) ───
for (const ch of fixed.chapters) {
  if (![11, 36].includes(ch.number)) continue;
  let chStr = JSON.stringify(ch);
  const thinkAboutAlts = ["consider", "reflect on", "examine", "weigh", "look at"];
  let count = 0;
  chStr = chStr.replace(/\bthink about\b/gi, (match) => {
    count++;
    if (count <= 1) return match;
    fixCount++;
    const alt = thinkAboutAlts[(count - 2) % thinkAboutAlts.length];
    if (match[0] === match[0].toUpperCase()) return alt.charAt(0).toUpperCase() + alt.slice(1);
    return alt;
  });
  Object.assign(ch, JSON.parse(chStr));
}

// Fix "ask yourself" in ch24
{
  const ch24 = fixed.chapters.find((c) => c.number === 24);
  if (ch24) {
    let chStr = JSON.stringify(ch24);
    const askAlts = ["consider", "question whether", "examine", "probe"];
    let count = 0;
    chStr = chStr.replace(/\bask yourself\b/gi, (match) => {
      count++;
      if (count <= 1) return match;
      fixCount++;
      const alt = askAlts[(count - 2) % askAlts.length];
      if (match[0] === match[0].toUpperCase()) return alt.charAt(0).toUpperCase() + alt.slice(1);
      return alt;
    });
    Object.assign(ch24, JSON.parse(chStr));
  }
}

writeFileSync(filePath, JSON.stringify(fixed, null, 2) + "\n", "utf-8");
console.log(`Phase 2c complete. ${fixCount} fixes applied.`);
