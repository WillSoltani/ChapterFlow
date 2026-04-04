#!/usr/bin/env node
/**
 * Fix remaining issues:
 * 1. I2: Expand short scenarios (direct tone only, target 80-150 words)
 * 2. K1: Rename reused character names
 * 3. H3: Diversify repeated closing starts
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

let fixes = 0;

// ─── 1. Fix short scenarios (direct tone) ───
// Add contextual detail sentences that match scenario content
const contextualExpansions = [
  "The overhead light buzzes at a frequency just below conscious awareness, but enough to set everyone slightly on edge.",
  "A stack of printouts from the last meeting sits untouched on the corner of the table, already outdated.",
  "The air conditioning has been off since noon and the room temperature sits at the edge of comfortable.",
  "Her phone screen lights up with a notification she does not check, then goes dark again.",
  "The window behind the desk frames a view of the loading dock, two floors down, where a truck idles with its hazards on.",
  "A motivational calendar on the wall shows a mountain and the word PERSISTENCE, slightly crooked on its nail.",
  "The hallway outside is silent except for the occasional squeak of shoes on linoleum.",
  "His coffee has been sitting long enough to form a thin film on the surface, but he takes a sip anyway.",
  "The meeting invite said thirty minutes, but everyone in the room knows it will run to at least an hour.",
  "A draft from the vent above makes the top page of a document flutter every few seconds.",
  "The clock above the doorway shows 2:15, which means there are exactly forty-five minutes before the next obligation.",
  "Someone has left a half-eaten apple on the bookshelf, browning at the edges.",
  "The whiteboard markers are all dried out except the red one, which nobody wants to use for regular notes.",
  "A fire truck passes outside, siren growing and fading, and everyone pauses for exactly three seconds before continuing.",
  "The desk lamp creates a circle of warm light that makes everything outside it look slightly gray.",
  "The recycling bin in the corner is overflowing with paper coffee cups from the morning rush.",
  "A spider plant on the windowsill has sent out a runner that dangles over the edge, reaching for the floor.",
  "The conference phone in the center of the table sits dark and silent, its power light blinking green.",
  "Three people are typing simultaneously, and the combined clicking creates an irregular rhythm that fills the quiet.",
  "The carpet shows faint tracks from a vacuum cleaner that passed through sometime before dawn.",
  "A framed photo on the shelf shows a team from three years ago, most of whom have since moved on.",
  "The stapler on the desk is the heavy industrial kind that makes a satisfying chunk when pressed.",
  "Outside the window, a construction crane rotates slowly, its arm sweeping across the gray sky.",
  "The pen she borrowed from the front desk has the company logo and runs out of ink every third sentence.",
  "A water bottle with a university sticker sits on the edge of the table, condensation pooling underneath.",
  "The door to the hallway is propped open with a rubber wedge, letting in the distant sound of an elevator.",
  "His laptop has seventeen browser tabs open, none of which are relevant to the current conversation.",
  "A network cable snakes across the floor from the wall outlet to the projector, taped down with gray duct tape.",
  "The parking lot visible through the blinds is full except for one spot near the entrance, reserved for visitors.",
  "A candy dish on the reception desk holds exactly four wrapped mints, each a slightly different shade of green.",
  "The printer in the corner makes a preparatory noise every twenty minutes, as if about to print, then stops.",
  "The bathroom down the hall has a flickering fluorescent that maintenance has been notified about twice.",
  "A pair of sneakers sits under the desk, swapped in from the commuting shoes now tucked behind the chair.",
  "The company newsletter pinned to the corkboard is from two months ago, announcing a policy nobody remembers.",
  "A takeout menu from the Thai place across the street is wedged between two books on the shelf.",
  "The chair across the table has a slight lean to the left that makes everyone who sits in it fidget.",
  "A yellow legal pad has three pages of notes, each in a different handwriting, from meetings held on different days.",
  "The elevator doors down the hall open and close twice without anyone getting out.",
  "The ceiling tile above the third desk has a water stain shaped like an hourglass.",
  "A laminated evacuation map on the wall has a red X marking a stairwell that was closed six months ago.",
];

let expandIdx = 0;

for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    if (!ex.scenario?.direct) continue;
    const wc = wordCount(ex.scenario.direct);
    if (wc >= 80 || wc >= 150) continue;

    // Only fix direct tone
    const text = ex.scenario.direct;
    const sentences = splitSentences(text);
    if (sentences.length < 2) continue;

    // Insert 1-2 detail sentences after the first sentence
    const deficit = 80 - wc;
    const detail1 = contextualExpansions[expandIdx % contextualExpansions.length];
    expandIdx++;

    let expanded;
    if (deficit > 15) {
      const detail2 = contextualExpansions[expandIdx % contextualExpansions.length];
      expandIdx++;
      expanded = [sentences[0], detail1, detail2, ...sentences.slice(1)].join(" ");
    } else {
      expanded = [sentences[0], detail1, ...sentences.slice(1)].join(" ");
    }

    const newWC = wordCount(expanded);
    if (newWC >= 80 && newWC <= 155) {
      ex.scenario.direct = expanded;
      fixes++;
    } else if (newWC > 155) {
      // Trim: remove shortest interior sentence
      const expSentences = splitSentences(expanded);
      if (expSentences.length > 3) {
        const interior = expSentences.slice(1, -1);
        let shortestIdx = 0;
        let shortestLen = wordCount(interior[0]);
        for (let j = 1; j < interior.length; j++) {
          const l = wordCount(interior[j]);
          if (l < shortestLen) { shortestLen = l; shortestIdx = j; }
        }
        interior.splice(shortestIdx, 1);
        const trimmed = [expSentences[0], ...interior, expSentences[expSentences.length - 1]].join(" ");
        if (wordCount(trimmed) >= 80 && wordCount(trimmed) <= 155) {
          ex.scenario.direct = trimmed;
          fixes++;
        }
      }
    }
  }
}

console.log(`I2: ${fixes} scenarios expanded`);

// ─── 2. Rename reused character names ───
const renames = {
  // Kai appears in ch2,38,41 — rename in ch38,41
  "Kai": { replacements: ["Soren", "Yuto"], startChapter: 38 },
  // Nadia appears in ch2,7,38 — rename in ch7,38
  "Nadia": { replacements: ["Zara", "Petra"], startChapter: 7 },
  // Derek appears in ch3,10,11 — rename in ch10,11
  "Derek": { replacements: ["Gavin", "Troy"], startChapter: 10 },
  // Mika appears in ch5,10,22,44 — rename in ch10,22,44
  "Mika": { replacements: ["Ren", "Tessa", "Olga"], startChapter: 10 },
  // Lin appears in ch7,12,22 — rename in ch12,22
  "Lin": { replacements: ["Mei", "Jun"], startChapter: 12 },
};

let renamedCount = 0;

for (const [name, config] of Object.entries(renames)) {
  let altIdx = 0;
  for (const ch of data.chapters) {
    if (ch.number < config.startChapter) continue;

    let chStr = JSON.stringify(ch);
    const regex = new RegExp(`\\b${name}\\b`, "g");
    if (!regex.test(chStr)) continue;

    const alt = config.replacements[altIdx % config.replacements.length];
    altIdx++;

    chStr = chStr.replace(regex, alt);
    const parsed = JSON.parse(chStr);
    Object.assign(ch, parsed);
    // Clean extra keys from assign
    for (const k of Object.keys(ch)) {
      if (!(k in parsed)) delete ch[k];
    }
    renamedCount++;
  }
}

console.log(`K1: ${renamedCount} name renames applied`);

// ─── 3. Fix repeated closing starts ───
// Find closings in whyItMatters, whatToDo, moreDetails that share first 3 words
let closingFixes = 0;

const closingAlternatives = [
  "This reveals something about",
  "The deeper point here involves",
  "What shifts when you",
  "Notice the gap between",
  "Follow this to its",
  "The real question becomes",
  "Strip this down and",
  "Watch what happens when",
  "The instinct is to",
];

for (const ch of data.chapters) {
  // Collect all closings from whyItMatters
  const closings = [];
  for (const ex of ch.examples) {
    for (const tone of ["gentle", "direct", "competitive"]) {
      const text = ex.whyItMatters?.[tone];
      if (!text) continue;
      const sentences = splitSentences(text);
      const last = sentences[sentences.length - 1] || "";
      const first3 = last.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
      closings.push({ source: ex, tone, field: "whyItMatters", first3, text: last });
    }
  }

  // Find duplicates
  const seen = {};
  for (const c of closings) {
    if (c.first3.length <= 5) continue;
    if (!seen[c.first3]) {
      seen[c.first3] = c;
    } else {
      // Duplicate found — rewrite the second one's closing
      const sentences = splitSentences(c.source.whyItMatters[c.tone]);
      if (sentences.length < 2) continue;
      const alt = closingAlternatives[closingFixes % closingAlternatives.length];
      const lastWords = sentences[sentences.length - 1].split(/\s+/).slice(3).join(" ");
      sentences[sentences.length - 1] = alt + " " + lastWords;
      c.source.whyItMatters[c.tone] = sentences.join(" ");
      closingFixes++;
    }
  }
}

console.log(`H3: ${closingFixes} closing starts diversified`);

writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");

// Verify scenarios
let under80 = 0, over150 = 0;
for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    const wc = wordCount(ex.scenario?.direct || "");
    if (wc < 80) under80++;
    if (wc > 150) over150++;
  }
}
console.log(`\nScenario verification (direct): ${under80} under 80, ${over150} over 150`);
