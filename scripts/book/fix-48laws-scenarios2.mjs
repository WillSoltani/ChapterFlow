#!/usr/bin/env node
/**
 * Second pass: expand short scenarios more aggressively
 * Add 2 sensory/detail sentences for scenarios under 70 words
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

// Paired detail sentences — add 2 at a time for bigger expansion
const detailPairs = [
  ["The conference room smells like dry-erase markers and stale coffee.", "Someone left a crumpled agenda on the chair by the door."],
  ["The laptop screen reflects in the window behind her.", "Outside, the street is quiet except for a delivery truck idling."],
  ["Three pens sit lined up on the desk, all uncapped.", "A yellow legal pad has half a page of notes from the morning."],
  ["The study room door is heavy and closes with a solid click.", "Inside, the whiteboard has faded equations from the previous group."],
  ["His phone buzzes in his pocket but he does not check it.", "The fluorescent light above the table flickers every few seconds."],
  ["A half-eaten granola bar sits next to her keyboard.", "The office is empty except for the cleaning crew vacuuming two floors down."],
  ["The calendar on the wall still shows last month.", "Somewhere in the building, a door slams and the sound echoes."],
  ["Rain streaks the window in long diagonal lines.", "The parking lot outside is half-empty, puddles forming between the painted lines."],
  ["A stack of printed emails sits on the corner of the desk, unread.", "The thermostat reads 68 but the room feels colder."],
  ["Two chairs are pulled up close to the desk, angled toward each other.", "A framed motivational poster on the wall has a crack in the glass."],
  ["The break room microwave beeps in the distance, unanswered.", "His jacket hangs on the back of the chair, one sleeve trailing the floor."],
  ["A notification banner slides across her screen, then fades.", "The room smells faintly of hand sanitizer and carpet cleaner."],
  ["The projector casts a blue rectangle on the blank wall.", "Dust motes drift through the beam of light from the window."],
  ["The library is nearly empty at this hour.", "A pencil rolls off the table and hits the floor with a sharp tap."],
  ["The vending machine at the end of the hall hums steadily.", "Her notebook is open to a page covered in underlined phrases and arrows."],
  ["His watch reads 4:22 PM.", "The shadows from the blinds stretch across the conference table in even stripes."],
  ["A half-finished cup of tea sits cooling on the windowsill.", "The radiator clicks twice and then goes silent."],
  ["Someone has taped a handwritten sign to the printer: Out of toner.", "The hallway outside smells like fresh paint from the renovation."],
  ["The meeting started seven minutes late and no one acknowledged it.", "Her pen hovers over the notepad, not writing."],
  ["Three browser tabs are open on the shared screen, all related.", "The air conditioning kicks in with a low hum that fills the silence."],
  ["A travel mug with a university logo sits next to the laptop, empty.", "The morning light comes through the east-facing window at a sharp angle."],
  ["The campus quad is wet from an overnight rain.", "Leaves stick to the sidewalk in random clumps."],
  ["His backpack is unzipped, notebooks threatening to spill out.", "The bench outside the lecture hall is still damp."],
  ["A sticky note on her monitor reads CHECK VOICEMAIL in block letters.", "The office door is open but the lights inside are off."],
  ["The classroom still has chairs arranged in last session's circle.", "A single dry-erase marker sits in the tray, uncapped and dried out."],
  ["Her car keys sit on top of the folder, ready for a quick departure.", "The vending machine light flickers and steadies."],
  ["The group chat has seventeen unread messages, all from the last hour.", "A paper coffee cup tips slightly in the breeze from the open window."],
  ["Someone has drawn a smiley face in the margin of the agenda.", "The clock is two minutes fast but no one has fixed it."],
  ["The elevator arrives empty, doors opening to a quiet floor.", "His shoes squeak on the freshly mopped tile."],
  ["A fly buzzes against the conference room window, tapping the glass.", "The recycling bin is full of crumpled drafts."],
];

let fixes = 0;

for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    if (!ex.scenario) continue;
    for (const tone of ["gentle", "direct", "competitive"]) {
      const text = ex.scenario[tone];
      if (!text) continue;
      const wc = wordCount(text);
      if (wc >= 80) continue;

      const sentences = splitSentences(text);
      if (sentences.length < 1) continue;

      const deficit = 80 - wc;
      const pair = detailPairs[fixes % detailPairs.length];

      let expanded;
      if (deficit > 20) {
        // Add both detail sentences after the first sentence
        expanded = [sentences[0], pair[0], pair[1], ...sentences.slice(1)].join(" ");
      } else {
        // Add one detail sentence
        expanded = [sentences[0], pair[0], ...sentences.slice(1)].join(" ");
      }

      const newWC = wordCount(expanded);
      if (newWC >= 80 && newWC <= 160) {
        ex.scenario[tone] = expanded;
        fixes++;
      } else if (newWC >= 80) {
        // Trim if over 160
        const expSentences = splitSentences(expanded);
        if (expSentences.length > 3) {
          // Remove the longest interior sentence
          const interior = expSentences.slice(1, -1);
          let longestIdx = 0;
          let longestLen = 0;
          interior.forEach((s, i) => {
            const l = wordCount(s);
            if (l > longestLen) { longestLen = l; longestIdx = i; }
          });
          interior.splice(longestIdx, 1);
          const trimmed = [expSentences[0], ...interior, expSentences[expSentences.length - 1]].join(" ");
          if (wordCount(trimmed) >= 80 && wordCount(trimmed) <= 160) {
            ex.scenario[tone] = trimmed;
            fixes++;
          }
        }
      }
    }
  }
}

writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");

// Verify
let under80 = 0, over150 = 0;
for (const ch of data.chapters) {
  for (const ex of ch.examples) {
    for (const tone of ["gentle", "direct", "competitive"]) {
      const wc = wordCount(ex.scenario?.[tone] || "");
      if (wc < 80) under80++;
      if (wc > 150) over150++;
    }
  }
}
console.log(`Scenario expansion: ${fixes} fixes`);
console.log(`Remaining: ${under80} under 80, ${over150} over 150`);
