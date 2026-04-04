#!/usr/bin/env node
/**
 * Phase 2 scripted fixes for friends-and-influence.modern.json
 * 1. Gentle opener diversification (activationPrompt, ifThenPlans, weeklyPractice, 24hChallenge, oneMinuteRecap)
 * 2. Reflexive phrase capping ("think about" etc.)
 * 3. Closing sentence vocabulary removal (system, dynamic, framework, pattern, mechanism, structural)
 */

import { readFileSync, writeFileSync } from "fs";

const FILE = "book-packages/friends-and-influence.modern.json";
const raw = readFileSync(FILE, "utf-8");
const pkg = JSON.parse(raw);
const chapters = pkg.chapters;

const stats = { openers: 0, reflexive: 0, closingVocab: 0 };

// ═══════════════════════════════════════
// 1. ACTIVATION PROMPT OPENER DIVERSIFICATION
// ═══════════════════════════════════════
// "Before reading, consider: what would you do differently if" → diverse pool
// Rotate so no two consecutive chapters share the same opener
const activationOpeners = [
  "Pause and imagine: how would your approach change if",
  "Before you continue, ask yourself: what shifts when",
  "Consider this scenario: what would happen if",
  "Think back to a recent conversation: what changes if",
  "Picture yourself in a situation where",
  "Stop and reflect: how would you handle things differently if",
  "Here is the key question: what would you do if",
  "Imagine walking into a room knowing that",
  "Ask yourself honestly: what would shift if",
  "Put yourself in this position: what happens when",
  "Before turning the page, sit with this: what changes if",
  "Reflect on your own experience: how would things differ if",
  "Try this thought experiment: what if you knew that",
  "Challenge your assumptions: what would change if",
  "Hold this question for a moment: what happens when",
  "Ground this in your own life: what would shift if",
  "Before diving in, consider: what looks different if",
  "One question to carry forward: what happens when",
  "Notice your first reaction: what would you do if",
  "Let this settle before reading: what changes when",
  "Sit with this for a moment: what would happen if",
  "Bring to mind a real situation: what shifts if",
  "Here is what to watch for: what changes when",
  "Ask yourself before reading: what would be different if",
  "Consider what you would do if you discovered that",
  "Take a moment to imagine: what shifts when",
  "Reflect on this before continuing: what would change if",
  "Carry this question with you: what happens when",
  "Start by asking: what would look different if",
  "Hold this thought: what would you do differently if",
  "Test your instinct: what changes when",
  "Before the next section, consider: what shifts if",
  "Picture a recent interaction: what would change if",
  "Let this question sit: what happens when",
  "Anchor this to your experience: what would shift if",
  "Ask yourself one thing: what looks different when",
  "Pause here and consider: what would change if",
];

let openerIdx = 0;
for (const ch of chapters) {
  for (const depth of ["medium", "hard"]) {
    const variant = ch.contentVariants?.[depth];
    if (!variant?.activationPrompt) continue;
    for (const tone of ["gentle", "direct", "competitive"]) {
      const val = variant.activationPrompt[tone];
      if (!val) continue;
      const oldPrefix = "Before reading, consider: what would you do differently if";
      if (val.startsWith(oldPrefix)) {
        const rest = val.substring(oldPrefix.length);
        const newPrefix = activationOpeners[openerIdx % activationOpeners.length];
        variant.activationPrompt[tone] = newPrefix + rest;
        stats.openers++;
      }
    }
    // Advance index per chapter-depth combo so each gets a different opener
    openerIdx++;
  }
}

// ═══════════════════════════════════════
// ifThenPlans[2].plan.gentle: "If a friend or family member" (7 chapters)
// This is a valid if-then plan prefix, but overused. Diversify for chapters > 2 occurrences.
// Keep first 2, rewrite rest.
// ═══════════════════════════════════════
const ifThenPrefix = "If a friend or family member";
const ifThenReplacements = [
  "If someone close to you",
  "If a person you care about",
  "If someone in your life",
  "If a loved one",
  "If someone you value",
];
let ifThenCount = 0;
let ifThenReplaced = 0;
for (const ch of chapters) {
  const plans = ch.implementationPlan?.ifThenPlans;
  if (!plans) continue;
  for (const plan of plans) {
    if (!plan.plan?.gentle) continue;
    if (plan.plan.gentle.startsWith(ifThenPrefix)) {
      ifThenCount++;
      if (ifThenCount > 2) {
        const rest = plan.plan.gentle.substring(ifThenPrefix.length);
        const replacement = ifThenReplacements[ifThenReplaced % ifThenReplacements.length];
        plan.plan.gentle = replacement + rest;
        ifThenReplaced++;
        stats.openers++;
      }
    }
  }
}

// ═══════════════════════════════════════
// 24hChallenge: "Within the next 24 hours, choose" (5 chapters)
// Diversify beyond 2
// ═══════════════════════════════════════
const challengePrefix = "Within the next 24 hours, choose";
const challengeReplacements = [
  "In the next day, pick",
  "Today or tomorrow, select",
  "Before this time tomorrow, find",
];
let challengeCount = 0;
let challengeReplaced = 0;
for (const ch of chapters) {
  const challenge = ch.implementationPlan?.twentyFourHourChallenge;
  if (!challenge?.gentle) continue;
  if (challenge.gentle.startsWith(challengePrefix)) {
    challengeCount++;
    if (challengeCount > 2) {
      const rest = challenge.gentle.substring(challengePrefix.length);
      challenge.gentle = challengeReplacements[challengeReplaced % challengeReplacements.length] + rest;
      challengeReplaced++;
      stats.openers++;
    }
  }
}

// ═══════════════════════════════════════
// weeklyPractice: "Once a week, review a conversation/request" (7 chapters)
// Diversify beyond 2
// ═══════════════════════════════════════
const weeklyPrefixes = [
  { match: "Once a week, review a conversation", replace: [
    "Each week, look back at an exchange",
    "Weekly, revisit a discussion",
    "Pick one conversation each week to examine",
    "Every seven days, reflect on a dialogue",
    "Set aside time weekly to audit an interaction",
  ]},
  { match: "Once a week, review a request", replace: [
    "Each week, revisit a request",
    "Weekly, examine an ask",
    "Pick one request each week to evaluate",
  ]},
];
for (const wp of weeklyPrefixes) {
  let count = 0;
  let replaced = 0;
  for (const ch of chapters) {
    const practice = ch.implementationPlan?.weeklyPractice;
    if (!practice?.gentle) continue;
    if (practice.gentle.startsWith(wp.match)) {
      count++;
      if (count > 2) {
        const rest = practice.gentle.substring(wp.match.length);
        practice.gentle = wp.replace[replaced % wp.replace.length] + rest;
        replaced++;
        stats.openers++;
      }
    }
  }
}

// ═══════════════════════════════════════
// oneMinuteRecap.connect.gentle: "State Carnegie's principle" (13 chapters)
// Diversify these heavily
// ═══════════════════════════════════════
const statePrefixRe = /^State Carnegie's (principle|cooperation principle|safety valve principle)(?: from this chapter)?/;
const stateReplacements = [
  "Recall Carnegie's core idea from this chapter",
  "Name the principle Carnegie introduced here",
  "Summarize what Carnegie argued in this chapter",
  "Identify the central lesson Carnegie taught",
  "Put Carnegie's principle from this chapter into your own words",
  "Restate the key insight Carnegie offered",
  "Articulate Carnegie's main argument from this chapter",
  "Explain Carnegie's central point",
  "Describe the principle Carnegie built this chapter around",
  "In your own words, capture what Carnegie's principle asks you to do",
  "Formulate Carnegie's lesson from this chapter",
];
let stateCount = 0;
let stateReplaced = 0;
for (const ch of chapters) {
  for (const depth of ["medium", "hard"]) {
    const recap = ch.contentVariants?.[depth]?.oneMinuteRecap;
    if (!recap?.connect?.gentle) continue;
    const val = recap.connect.gentle;
    if (statePrefixRe.test(val)) {
      stateCount++;
      if (stateCount > 2) {
        const rest = val.replace(statePrefixRe, "");
        recap.connect.gentle = stateReplacements[stateReplaced % stateReplacements.length] + rest;
        stateReplaced++;
        stats.openers++;
      }
    }
  }
}

// ═══════════════════════════════════════
// "There is a meaningful difference between" (4 chapters, various fields)
// Reduce to max 2
// ═══════════════════════════════════════
const meaningfulPrefix = "There is a meaningful difference between";
const meaningfulReplacements = [
  "A real gap exists between",
  "The distinction matters between",
];
let meaningfulCount = 0;
let meaningfulReplaced = 0;
function fixMeaningfulDifference(s) {
  if (typeof s !== "string" || !s.startsWith(meaningfulPrefix)) return s;
  meaningfulCount++;
  if (meaningfulCount > 2) {
    const rest = s.substring(meaningfulPrefix.length);
    meaningfulReplaced++;
    stats.openers++;
    return meaningfulReplacements[(meaningfulReplaced - 1) % meaningfulReplacements.length] + rest;
  }
  return s;
}
// Walk all gentle fields
function walkAndFixGentle(obj, path) {
  if (typeof obj === "string") {
    if (path.includes("gentle")) return fixMeaningfulDifference(obj);
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((v, i) => walkAndFixGentle(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walkAndFixGentle(v, `${path}.${k}`);
    return out;
  }
  return obj;
}
for (let i = 0; i < chapters.length; i++) {
  chapters[i] = walkAndFixGentle(chapters[i], `ch${chapters[i].number}`);
}

// ═══════════════════════════════════════
// 2. REFLEXIVE PHRASE CAPPING
// ═══════════════════════════════════════
// "think about" max 1 per chapter — replace excess with alternatives
const thinkAboutAlts = ["consider", "reflect on", "examine", "look at", "sit with", "weigh"];

for (const ch of chapters) {
  let thinkCount = 0;
  let altIdx = 0;
  const chIdx = chapters.indexOf(ch);

  function walkFixReflexive(obj, path) {
    if (typeof obj === "string") {
      // Fix "think about" overcounting
      return obj.replace(/\bthink about\b/gi, (match) => {
        thinkCount++;
        if (thinkCount > 1) {
          stats.reflexive++;
          const alt = thinkAboutAlts[altIdx % thinkAboutAlts.length];
          altIdx++;
          // Preserve case
          if (match[0] === "T") return alt[0].toUpperCase() + alt.slice(1);
          return alt;
        }
        return match;
      });
    }
    if (Array.isArray(obj)) return obj.map((v, i) => walkFixReflexive(v, `${path}[${i}]`));
    if (obj && typeof obj === "object") {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = walkFixReflexive(v, `${path}.${k}`);
      return out;
    }
    return obj;
  }

  chapters[chIdx] = walkFixReflexive(ch, `ch${ch.number}`);
}

// Fix "pay attention to" for ch2 (has 2, max 1)
for (const ch of chapters) {
  if (ch.number !== 2) continue;
  let patCount = 0;
  const chIdx = chapters.indexOf(ch);
  function walkFixPAT(obj) {
    if (typeof obj === "string") {
      return obj.replace(/\bpay attention to\b/gi, (match) => {
        patCount++;
        if (patCount > 1) {
          stats.reflexive++;
          return match[0] === "P" ? "Watch for" : "watch for";
        }
        return match;
      });
    }
    if (Array.isArray(obj)) return obj.map(v => walkFixPAT(v));
    if (obj && typeof obj === "object") {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = walkFixPAT(v);
      return out;
    }
    return obj;
  }
  chapters[chIdx] = walkFixPAT(ch);
}

// ═══════════════════════════════════════
// 3. CLOSING SENTENCE VOCABULARY REMOVAL
// ═══════════════════════════════════════
// Banned words in closing sentences of these fields:
// chapterBreakdown, whyItMatters, moreDetails, whatToDo, oneMinuteRecap
// Words: structural, mechanism, pattern, dynamic, framework, system
// Strategy: rewrite the last sentence to remove the word

const closingBannedWords = ["structural", "mechanism", "pattern", "dynamic", "framework", "system"];
const bannedFieldPaths = ["chapterbreakdown", "whyitmatters", "moredetails", "whattodo", "oneMinuterecap"];

// Replacement map for common closing sentence patterns
const closingReplacements = {
  "structural": ["foundational", "underlying", "architectural", "built-in", "embedded"],
  "mechanism": ["process", "method", "engine", "lever", "operation"],
  "pattern": ["habit", "tendency", "cycle", "routine", "behavior"],
  "dynamic": ["interaction", "relationship", "exchange", "interplay", "tension"],
  "framework": ["approach", "model", "method", "blueprint", "structure"],
  "system": ["process", "arrangement", "method", "setup", "approach"],
};

function isInBannedField(path) {
  const lp = path.toLowerCase();
  return bannedFieldPaths.some(f => lp.includes(f));
}

function getLastSentence(s) {
  const trimmed = s.trim();
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  return sentences[sentences.length - 1] || "";
}

function fixClosingVocab(s, path) {
  if (typeof s !== "string" || !isInBannedField(path)) return s;

  const lastSent = getLastSentence(s);
  let newLastSent = lastSent;
  let changed = false;

  for (const word of closingBannedWords) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    if (re.test(newLastSent)) {
      const alts = closingReplacements[word];
      // Pick replacement that isn't already in the sentence
      let replacement = alts[0];
      for (const alt of alts) {
        if (!newLastSent.toLowerCase().includes(alt)) { replacement = alt; break; }
      }
      newLastSent = newLastSent.replace(re, (match) => {
        changed = true;
        stats.closingVocab++;
        // Preserve case
        if (match[0] === match[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
        return replacement;
      });
    }
  }

  if (changed) {
    // Replace only the last sentence
    const trimmed = s.trim();
    const lastIdx = trimmed.lastIndexOf(lastSent);
    if (lastIdx >= 0) {
      return trimmed.substring(0, lastIdx) + newLastSent;
    }
  }
  return s;
}

function walkAndFixClosing(obj, path) {
  if (typeof obj === "string") return fixClosingVocab(obj, path);
  if (Array.isArray(obj)) return obj.map((v, i) => walkAndFixClosing(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walkAndFixClosing(v, `${path}.${k}`);
    return out;
  }
  return obj;
}

for (let i = 0; i < chapters.length; i++) {
  chapters[i] = walkAndFixClosing(chapters[i], `ch${chapters[i].number}`);
}

// ═══════════════════════════════════════
// WRITE & VERIFY
// ═══════════════════════════════════════
writeFileSync(FILE, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

console.log("Phase 2 scripted fixes applied:");
console.log(`  Opener diversification:    ${stats.openers}`);
console.log(`  Reflexive phrase caps:     ${stats.reflexive}`);
console.log(`  Closing vocab replacements: ${stats.closingVocab}`);

// Quick verification
const updated = readFileSync(FILE, "utf-8");
const updatedPkg = JSON.parse(updated);

// Check remaining "Before reading, consider" in gentle fields
let remainingBRC = 0;
function countBRC(obj, path) {
  if (typeof obj === "string") {
    if (path.includes("gentle") && obj.startsWith("Before reading, consider")) remainingBRC++;
    return;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => countBRC(v, `${path}[${i}]`)); return; }
  if (obj && typeof obj === "object") { for (const [k, v] of Object.entries(obj)) countBRC(v, `${path}.${k}`); }
}
updatedPkg.chapters.forEach((ch, i) => countBRC(ch, `ch${ch.number}`));
console.log(`\nRemaining "Before reading, consider" in gentle: ${remainingBRC}`);

// Count closing vocab in banned fields
let remainingClosing = {};
closingBannedWords.forEach(w => { remainingClosing[w] = 0; });
function countClosing(obj, path) {
  if (typeof obj === "string") {
    if (!isInBannedField(path)) return;
    const ls = getLastSentence(obj).toLowerCase();
    for (const w of closingBannedWords) {
      if (ls.includes(w)) remainingClosing[w]++;
    }
    return;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => countClosing(v, `${path}[${i}]`)); return; }
  if (obj && typeof obj === "object") { for (const [k, v] of Object.entries(obj)) countClosing(v, `${path}.${k}`); }
}
updatedPkg.chapters.forEach((ch, i) => countClosing(ch, `ch${ch.number}`));
console.log("Remaining closing vocab in banned fields:");
for (const [w, c] of Object.entries(remainingClosing)) console.log(`  ${w}: ${c}`);

// Check think about per chapter
console.log("\n'think about' per chapter (should be max 1):");
let taIssues = 0;
for (const ch of updatedPkg.chapters) {
  const chStr = JSON.stringify(ch).toLowerCase();
  const matches = chStr.match(/\bthink about\b/g) || [];
  if (matches.length > 1) { console.log(`  ch${ch.number}: ${matches.length}`); taIssues++; }
}
if (taIssues === 0) console.log("  All chapters within cap.");
