#!/usr/bin/env node

/**
 * fix-dialogues-ch13-25.mjs
 *
 * Rewrites dialogue-format scenarios in chapters 13-25 of friends-and-influence.modern.json
 * to include at least 3 back-and-forth quoted speech exchanges using "double quotes".
 *
 * For examples that already have dialogue lines with single quotes, converts to double quotes.
 * For examples that use described/narrative speech, rewrites as proper dialogue exchanges.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(
  __dirname,
  "../../book-packages/friends-and-influence.modern.json"
);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert single-quoted dialogue lines to double-quoted.
 * Matches patterns like: Character: 'speech text here'
 * Also handles [stage directions] before/after quotes.
 */
function convertSingleToDoubleQuotes(text) {
  // Replace dialogue-style single quotes: after a colon or stage direction bracket
  // Pattern: captures `Name: '...'` and `Name: [action] '...'`
  let result = text;

  // Strategy: find all single-quoted spans that appear in dialogue context
  // We look for ': ' followed by a single-quoted string, or '] ' followed by one
  result = result.replace(
    /(?<=:\s(?:\[[^\]]*\]\s)?)'((?:[^'\\]|\\.)*)'/g,
    '"$1"'
  );

  return result;
}

/**
 * Count the number of dialogue exchanges (lines starting with Name:)
 */
function countExchanges(text) {
  const lines = text.split("\n");
  let count = 0;
  for (const line of lines) {
    if (/^[A-Z][a-z]+:/.test(line.trim())) count++;
  }
  return count;
}

/**
 * Count words in text
 */
function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Check for banned content
 */
function checkBanned(text, id, tone) {
  const issues = [];
  if (text.includes("\u2014")) issues.push("em dash");
  if (text.includes("--")) issues.push("double hyphen");
  const banned = [
    "delve",
    "crucial",
    "landscape",
    "realm",
    "furthermore",
    "moreover",
  ];
  for (const b of banned) {
    if (text.toLowerCase().includes(b)) issues.push(`banned word: ${b}`);
  }
  if (issues.length > 0) {
    console.warn(`  WARNING ${id} ${tone}: ${issues.join(", ")}`);
  }
  return issues.length === 0;
}

// ─── Targeted trims for scenarios that exceed 150 words after quote conversion ─

const overrides = {
  "ch15-ex03": {
    gentle: `At 7:45 a.m. in a busy coffee shop, Marek places a cup on the counter. His jaw is tight. The coffee smells scorched. Five people wait behind him.

Isla: "What happened?"
Marek: "Third burned dark roast this week. Four dollars a cup. Monday, Wednesday, now today. The medium was fine Saturday."
Isla: "Three times, all dark roast. What made you bring it up today instead of letting it go?"
Marek: "Three times is a pattern. I am tired of pretending it is fine."
Isla: "You are right, and I am glad you said something. Let me get you a medium blend right now, and I will check the dark roast stock today."
Marek: [voice drops] "Appreciate it. I just did not want to keep drinking burned coffee and pretending it was okay."`,
  },
  "ch17-ex03": {
    gentle: `Yael has proposed a campaign timeline twice, and Ada has turned it down both times. Yael decides to stop pitching and start asking. They sit at the break room table, the coffee machine gurgling softly behind them.

Yael: "You have pushed back twice. Help me understand what is getting in the way."
Ada: "It overlaps with the product launch prep. I am already behind on launch assets."
Yael: "So the campaign itself is not the issue. The timing collision is."
Ada: "Exactly. Two weeks later and I could do both well. Right now, one of them gets my worst work."
Yael: "What if we shift ten days and I take the first round of campaign copy off your plate?"
Ada: [quiet for a moment] "That works. I was not trying to block you. I was trying not to do both things badly."`,
  },
};

// ─── Full rewrites for narrative-style dialogues ────────────────────────────

/**
 * ch18-ex04: Etta and Ishan - environmental club, hallway conversation
 * Original uses described speech. Rewrite as proper dialogue.
 */
const ch18_ex04_rewrites = {
  gentle: `Etta spots Ishan by the hallway window at 3:15 p.m. Rain taps the glass behind him. He has not been to the environmental club since his cleanup proposal was voted down two weeks ago. She sits on the bench beside him.

Etta: "If I had pitched something I cared about and the group moved on, I would feel like my work did not count. Is that what happened?"
Ishan: "Nobody even said it was a good idea. They went to the next agenda item."
Etta: "It was a good idea, Ishan. The park on Birch Street needs that cleanup. I should have spoken up."
Ishan: "You really think the proposal had merit?"
Etta: "I do. And the club needs your voice back in the room."
Ishan: [quiet, fingers loosening around his backpack strap] "I will come to the next meeting."`,

  direct: `Etta finds Ishan by the hallway window at 3:15 p.m. Rain taps the glass. He stopped attending the environmental club after his cleanup proposal was voted down two weeks ago. She sits beside him on the bench.

Etta: "If I had pitched something I cared about and the group moved on without a word, I would feel like my effort was erased. Is that what happened?"
Ishan: "Nobody acknowledged it was a good idea. They jumped to the next agenda item."
Etta: "It was a good idea. The park on Birch Street needs that cleanup. I should have said so during the vote."
Ishan: "You think the proposal had real merit?"
Etta: "I do. And the club lost something when you stopped showing up."
Ishan: [fingers loosening around his backpack strap] "I will come to the next meeting."`,

  competitive: `Etta tracks down Ishan by the hallway window at 3:15 p.m. Rain taps the glass. He disappeared from the environmental club after his cleanup proposal was voted down two weeks ago. She takes the bench beside him.

Etta: "If I had pitched something I believed in and the group skipped past it without a word, I would feel like my effort was invisible. Is that what happened?"
Ishan: "Nobody even acknowledged it was a good idea. They moved straight to the next agenda item."
Etta: "It was a good idea. The park on Birch Street needs that cleanup. I should have backed it during the vote."
Ishan: "You actually think the proposal was worth fighting for?"
Etta: "I do. And the club needs your voice. Come back and help us get it right this time."
Ishan: [fingers loosening around his backpack strap] "I will be at the next meeting."`,
};

/**
 * ch24-ex04: Indira and Juno - newspaper office, buried lead
 * Original uses described speech. Rewrite as proper dialogue.
 */
const ch24_ex04_rewrites = {
  gentle: `The newspaper office is quiet at 9:30 p.m. A single desk lamp throws warm light across two printed articles. Indira slides her own old piece across the table to Juno.

Juno: "What is this? Your article from last spring?"
Indira: "Read the first page. Tell me where the main finding is."
Juno: [scanning the paragraphs, finger pausing at paragraph three] "Here. Buried in paragraph three. Why did you put the strongest point so far down?"
Indira: "Because I had to learn that the lead matters more than any other paragraph. It took my editor circling it in red before I understood."
Juno: [pulls her own draft closer, eyes narrowing] "Mine is in paragraph four."
Indira: "You found it yourself. That is the first step."
Juno: [opens her laptop, starts restructuring the draft] "I am moving it to the top right now."`,

  direct: `The newspaper office is quiet at 9:30 p.m. A single desk lamp lights two printed articles on the table. Indira places her own old piece in front of Juno.

Juno: "Your article from last spring? Why am I looking at this?"
Indira: "Read the first page. Find the main finding."
Juno: [scanning, finger stopping at paragraph three] "Here. Paragraph three. Why did you bury the strongest point?"
Indira: "Because I had to learn the hard way that the lead matters more than every other paragraph combined."
Juno: [pulls her own draft closer] "Mine is in paragraph four."
Indira: "You identified the problem without anyone marking up your work."
Juno: [opens her laptop, begins restructuring] "I am moving it to the top."`,

  competitive: `The newspaper office is empty at 9:30 p.m. A single desk lamp lights two printed articles on the table. Indira places her own old piece in front of Juno.

Juno: "Your article from last spring? What is the play here?"
Indira: "Read the first page. Find the main finding."
Juno: [scanning, finger stopping at paragraph three] "Here. Paragraph three. You buried your strongest point."
Indira: "Exactly. I had to learn that the lead outweighs every other paragraph. My editor circled it in red before I saw it."
Juno: [pulls her own draft closer, jaw tightening] "Mine is in paragraph four."
Indira: "You spotted the pattern without a single markup on your page."
Juno: [opens her laptop, starts restructuring] "I am pulling it to the top right now."`,
};

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("Reading JSON file...");
  const raw = readFileSync(JSON_PATH, "utf8");
  const data = JSON.parse(raw);

  let modified = 0;
  let skipped = 0;

  for (let i = 0; i < data.chapters.length; i++) {
    const ch = data.chapters[i];
    const num = ch.number; // 1-indexed; chapters 13-25 have numbers 14-26

    // chapters 13-25 correspond to number 14-26
    if (num < 14 || num > 26) continue;

    const examples = ch.examples || [];
    for (let exIdx = 0; exIdx < examples.length; exIdx++) {
      const ex = examples[exIdx];
      if (ex.format !== "dialogue") continue;

      console.log(`\nProcessing ${ex.exampleId} (ch.number=${num})...`);

      for (const tone of ["gentle", "direct", "competitive"]) {
        const original = ex.scenario?.[tone];
        if (!original) {
          console.log(`  ${tone}: no scenario found, skipping`);
          skipped++;
          continue;
        }

        let rewritten;

        // Check if this is a narrative-style dialogue that needs full rewrite
        if (ex.exampleId === "ch18-ex04") {
          rewritten = ch18_ex04_rewrites[tone];
        } else if (ex.exampleId === "ch24-ex04") {
          rewritten = ch24_ex04_rewrites[tone];
        } else if (overrides[ex.exampleId]?.[tone]) {
          // Use targeted override (pre-trimmed, already double-quoted)
          rewritten = overrides[ex.exampleId][tone];
        } else {
          // Convert single quotes to double quotes in dialogue lines
          rewritten = convertSingleToDoubleQuotes(original);
        }

        // Validate
        const wc = wordCount(rewritten);
        const exchanges = countExchanges(rewritten);
        const hasDoubleQuotes = rewritten.includes('"');
        checkBanned(rewritten, ex.exampleId, tone);

        if (exchanges < 3) {
          console.warn(
            `  WARNING ${ex.exampleId} ${tone}: only ${exchanges} exchanges (need 3+)`
          );
        }
        if (!hasDoubleQuotes) {
          console.warn(
            `  WARNING ${ex.exampleId} ${tone}: no double quotes found`
          );
        }
        if (wc < 80 || wc > 150) {
          console.warn(
            `  WARNING ${ex.exampleId} ${tone}: ${wc} words (target 80-150)`
          );
        }

        console.log(
          `  ${tone}: ${wc} words, ${exchanges} exchanges, doubles=${hasDoubleQuotes}`
        );

        ex.scenario[tone] = rewritten;
        modified++;
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Modified: ${modified} scenario fields`);
  console.log(`Skipped: ${skipped}`);

  // Re-read the file to get latest version (in case parallel writes happened)
  // Then apply only our changes on top
  console.log("\nRe-reading JSON to merge safely...");
  const freshRaw = readFileSync(JSON_PATH, "utf8");
  const freshData = JSON.parse(freshRaw);

  // Apply our dialogue changes to the fresh data
  for (let i = 0; i < freshData.chapters.length; i++) {
    const ch = freshData.chapters[i];
    const num = ch.number;
    if (num < 14 || num > 26) continue;

    const examples = ch.examples || [];
    for (let exIdx = 0; exIdx < examples.length; exIdx++) {
      const ex = examples[exIdx];
      if (ex.format !== "dialogue") continue;

      // Find matching example in our modified data
      const modCh = data.chapters[i];
      const modEx = modCh.examples[exIdx];

      if (modEx && modEx.exampleId === ex.exampleId) {
        ex.scenario = modEx.scenario;
      }
    }
  }

  console.log("Writing JSON file...");
  writeFileSync(JSON_PATH, JSON.stringify(freshData, null, 2) + "\n", "utf8");
  console.log("Done.");
}

main();
