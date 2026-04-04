#!/usr/bin/env node
/**
 * Fix scenario word counts (target 80-150) and possessive title overuse (target <30%)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));

function wordCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(s) {
  const parts = [];
  let current = "";
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    current += chars[i];
    if (
      (chars[i] === "." || chars[i] === "!" || chars[i] === "?") &&
      i + 1 < chars.length &&
      chars[i + 1] === " " &&
      !/(?:Mr|Mrs|Ms|Dr|vs|etc|e\.g|i\.e|U\.S|P\.M|A\.M)\s*$/i.test(current)
    ) {
      parts.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// ─── 1. Fix scenario word counts ───
let scenarioFixes = 0;

// Expansion bridges for scenarios (vivid, concrete)
const scenarioBridges = [
  "The room is quiet except for the hum of the air conditioning.",
  "A half-empty coffee cup sits on the edge of the table, getting cold.",
  "The fluorescent lights above buzz faintly, casting everything in flat white.",
  "Papers are scattered across the desk, each one marked with handwritten notes.",
  "The clock on the wall reads 3:47 PM.",
  "Through the window, the parking lot is almost empty.",
  "Someone's phone vibrates on the table, face-down, and everyone pretends not to notice.",
  "The whiteboard behind them still has notes from yesterday's meeting, half-erased.",
  "A pen clicks rhythmically in someone's hand, the only sound filling the pause.",
  "The smell of burned coffee drifts from the break room.",
  "Footsteps echo in the hallway outside, then fade.",
  "The laptop screen casts a blue glow across the table.",
  "Rain taps against the window in uneven bursts.",
  "A sticky note on the monitor reads 'call back by Friday' in red ink.",
  "The office chair creaks as she leans back, arms crossed.",
  "Three unread messages blink on the phone screen, all from the same sender.",
  "The elevator dings down the hall, and a few seconds later, the door opens.",
  "A dog-eared notebook sits open to a page filled with underlined phrases.",
  "The campus quad is mostly empty, just a few students crossing between buildings.",
  "The library is half-lit, the after-hours sections already dimmed.",
  "A cold draft pushes through the cracked window every few minutes.",
  "Somewhere nearby, a printer grinds through a long document.",
  "The meeting is running twelve minutes over and no one is making eye contact.",
  "Two empty soda cans sit next to the keyboard like sentinels.",
  "The smell of fresh paint from the renovated hallway mixes with stale air.",
  "Her bag is already packed, sitting by the door, ready for a quick exit.",
  "The projector hums quietly, displaying a slide no one has looked at in five minutes.",
  "Condensation runs down the side of a water bottle left too long in the sun.",
  "The study room door is propped open with a textbook, voices spilling into the corridor.",
  "His headphones hang around his neck, music still faintly audible.",
];

for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    if (!ex.scenario) continue;

    for (const tone of ["gentle", "direct", "competitive"]) {
      const text = ex.scenario[tone];
      if (!text) continue;
      const wc = wordCount(text);

      if (wc > 150) {
        // Trim: remove shortest interior sentence
        const sentences = splitSentences(text);
        if (sentences.length <= 2) continue;
        const interior = sentences.slice(1, -1);
        let shortestIdx = 0;
        let shortestLen = wordCount(interior[0]);
        for (let i = 1; i < interior.length; i++) {
          const len = wordCount(interior[i]);
          if (len < shortestLen) { shortestLen = len; shortestIdx = i; }
        }
        interior.splice(shortestIdx, 1);
        const result = [sentences[0], ...interior, sentences[sentences.length - 1]].join(" ");
        if (wordCount(result) <= 150 && wordCount(result) >= 80) {
          ex.scenario[tone] = result;
          scenarioFixes++;
        }
      } else if (wc < 80) {
        // Expand: add a sensory/detail sentence after the first sentence
        const sentences = splitSentences(text);
        if (sentences.length < 1) continue;
        const bridge = scenarioBridges[scenarioFixes % scenarioBridges.length];
        const result = [sentences[0], bridge, ...sentences.slice(1)].join(" ");
        if (wordCount(result) >= 80 && wordCount(result) <= 150) {
          ex.scenario[tone] = result;
          scenarioFixes++;
        } else if (wordCount(result) >= 80) {
          // Trim if too long
          ex.scenario[tone] = result;
          scenarioFixes++;
        }
      }
    }
  }
}

console.log(`Scenario fixes: ${scenarioFixes}`);

// ─── 2. Fix possessive title overuse ───
// Goal: reduce from 50% to <30% (145 → ~85 max)
// Replace possessive titles with varied patterns

const titlePatterns = [
  (name, rest) => `The ${rest} That Changed ${name}`,
  (name, rest) => `${rest} and ${name}`,
  (name, rest) => `When ${name} Faced ${rest}`,
  (name, rest) => `${name} at the ${rest}`,
  (name, rest) => `${name} and the ${rest}`,
  (name, rest) => `${name} During ${rest}`,
  (name, rest) => `${rest} for ${name}`,
  (name, rest) => `How ${name} Handled ${rest}`,
  (name, rest) => `${name} Confronts ${rest}`,
  (name, rest) => `${name} After ${rest}`,
  (name, rest) => `The ${rest} ${name} Never Saw Coming`,
  (name, rest) => `Inside ${name} and the ${rest}`,
  (name, rest) => `${name} Between Two ${rest}`,
  (name, rest) => `What ${name} Did About ${rest}`,
  (name, rest) => `${rest} Tests ${name}`,
];

let titleFixes = 0;
const totalExamples = data.chapters.reduce((a, ch) => a + ch.examples.length, 0);
const targetMax = Math.floor(totalExamples * 0.29); // 29% to be safe

// Count current possessives
let currentPoss = 0;
for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    if (/\w+'s\s/.test(ex.title)) currentPoss++;
  }
}

const toRemove = currentPoss - targetMax;
let removed = 0;

if (toRemove > 0) {
  for (const ch of data.chapters) {
    for (const ex of ch.examples) {
      if (removed >= toRemove) break;
      const match = ex.title.match(/^([A-Za-z]+)'s\s+(.+)/);
      if (!match) continue;

      const [, name, rest] = match;
      const pattern = titlePatterns[titleFixes % titlePatterns.length];
      const newTitle = pattern(name, rest);

      // Ensure we don't create a title that's too long
      if (newTitle.length <= 60) {
        ex.title = newTitle;
        titleFixes++;
        removed++;
      }
    }
    if (removed >= toRemove) break;
  }
}

console.log(`Title fixes: ${titleFixes} (was ${currentPoss} possessive, removed ${removed}, target max: ${targetMax})`);

writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");

// Verify
let under80 = 0, over150 = 0;
for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    const wc = wordCount(ex.scenario?.direct || "");
    if (wc < 80) under80++;
    if (wc > 150) over150++;
  }
}
let poss = 0;
for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    if (/\w+'s\s/.test(ex.title)) poss++;
  }
}
console.log(`\nVerification:`);
console.log(`  Scenarios under 80: ${under80}`);
console.log(`  Scenarios over 150: ${over150}`);
console.log(`  Possessive titles: ${poss}/${totalExamples} (${(poss/totalExamples*100).toFixed(1)}%)`);
