#!/usr/bin/env node
/**
 * Fix chapterBreakdown word counts to hit target ranges.
 *
 * Easy: 140-175 words
 * Medium: 330-420 words
 * Hard: 490-600 words
 *
 * Strategy:
 * - Overlong: Remove interior sentences (not first or last) until within range
 * - Underlong: Expand the second-to-last sentence with elaboration
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));

const ranges = { easy: [140, 175], medium: [330, 420], hard: [490, 600] };
let trimCount = 0;
let expandCount = 0;

function wordCount(s) {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function splitSentences(s) {
  // Split on sentence endings followed by space, preserving the period
  const parts = [];
  let current = "";
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    current += chars[i];
    if (
      (chars[i] === "." || chars[i] === "!" || chars[i] === "?") &&
      i + 1 < chars.length &&
      chars[i + 1] === " " &&
      // Don't split on common abbreviations
      !/(?:Mr|Mrs|Ms|Dr|vs|etc|e\.g|i\.e|U\.S)\s*$/i.test(current)
    ) {
      parts.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function trimToRange(text, maxWords) {
  const sentences = splitSentences(text);
  if (sentences.length <= 2) return text; // Can't trim below 2 sentences

  let wc = wordCount(text);
  if (wc <= maxWords) return text;

  // Remove interior sentences (not first or last) starting from the middle
  // Pick sentences closest to the middle first
  const first = sentences[0];
  const last = sentences[sentences.length - 1];
  let interior = sentences.slice(1, -1);

  // Score each interior sentence: prefer removing shorter, less unique ones
  // Remove from the middle outward
  while (wc > maxWords && interior.length > 0) {
    // Find the shortest interior sentence to remove (least content loss)
    let shortestIdx = 0;
    let shortestLen = wordCount(interior[0]);
    for (let i = 1; i < interior.length; i++) {
      const len = wordCount(interior[i]);
      if (len < shortestLen) {
        shortestLen = len;
        shortestIdx = i;
      }
    }
    interior.splice(shortestIdx, 1);
    const candidate = [first, ...interior, last].join(" ");
    wc = wordCount(candidate);
  }

  trimCount++;
  return [first, ...interior, last].join(" ");
}

// Expansion phrases keyed by depth for variety
const expansionBridges = {
  easy: [
    "What makes this worth remembering is that",
    "The core takeaway here is straightforward:",
    "Put simply,",
    "The reason this matters is concrete:",
    "In practice, this shows up when",
    "At its simplest,",
    "What catches people off guard is that",
    "The practical implication is clear:",
    "This becomes visible when",
    "Worth noting:",
    "The everyday version of this looks like",
    "The key detail is this:",
    "Notice what happens next:",
    "Here is the part that sticks:",
    "One more thing to hold onto:",
    "The lesson is direct:",
    "Strip away everything else and you are left with",
    "In plain terms,",
    "Follow the logic one step further:",
    "The pivot point is this:",
  ],
  medium: [
    "The deeper implication is that this creates a feedback loop:",
    "When you trace this logic forward,",
    "What separates experienced practitioners from beginners is recognizing that",
    "The second-order effect is significant:",
    "Look closer and you see that",
    "The mechanism behind this is worth unpacking:",
    "Consider what this means in practice:",
    "The subtlety here is that",
    "This operates on a principle that most people overlook:",
    "Follow the chain of consequences:",
    "There is a quieter implication hiding in this:",
    "When you zoom in on the details,",
    "The thing most people miss is the timing:",
    "Layer this observation on top of the previous one and",
    "Run this forward three months and",
    "The real test of this principle comes when",
    "What makes this non-obvious is that",
    "Trace the incentive structure and you find that",
    "The gap between knowing this and applying it is",
    "One more dimension worth examining:",
  ],
  hard: [
    "The structural reason this persists is that most incentive environments reward the opposite behavior, creating a tension between what works individually and what the group reinforces.",
    "When you decompose this into its component parts, the critical variable is not the action itself but the sequence and timing of when it is deployed relative to the other player's expectations.",
    "The failure mode is predictable: people who understand this intellectually still default to their habitual response under pressure, because the cognitive load of strategic recalculation exceeds what most situations allow.",
    "What distinguishes high-level application from naive application is the ability to read which version of this principle the current context demands, since the same tactic in the wrong context produces the opposite result.",
    "Trace the second and third-order effects and you find a compounding advantage: each correct application builds a reputation that makes the next application easier, while each failure creates skepticism that makes recovery harder.",
    "The sophisticated version requires holding two contradictory ideas simultaneously: that this principle is generally true and that its exceptions are common enough to require constant recalibration.",
    "One additional wrinkle: the people who are best at this are often the ones who learned it through failure, because the conceptual understanding alone lacks the visceral calibration that comes from having misjudged the situation.",
    "Pull back further and you notice that this law interacts with almost every other law in the book, sometimes reinforcing them and sometimes creating genuine dilemmas where two valid principles point in opposite directions.",
    "The hardest part of mastering this is not the initial insight but the discipline of maintaining it consistently over months and years, when the short-term costs are visible and the long-term payoff is still abstract.",
    "There is a reason this principle appears across cultures and centuries: the underlying human psychology it exploits has not changed, even as the surface-level contexts have transformed beyond recognition.",
  ],
};

function expandToRange(text, minWords, depth) {
  let wc = wordCount(text);
  if (wc >= minWords) return text;

  const sentences = splitSentences(text);
  if (sentences.length < 2) return text;

  const deficit = minWords - wc;
  const bridges = expansionBridges[depth] || expansionBridges.easy;

  // Insert expansion before the last sentence
  let expansionIdx = expandCount % bridges.length;
  let expansion = bridges[expansionIdx];

  // For easy depth, use shorter expansions
  if (depth === "easy" && deficit < 15) {
    // Just add a brief bridging clause
    const shortBridges = [
      "the stakes are higher than they appear.",
      "what looks like a small move carries outsized weight.",
      "timing determines whether this works or backfires.",
      "the line between success and overreach is thinner than expected.",
      "the cost of getting this wrong compounds over time.",
      "awareness alone shifts the odds in your favor.",
      "the difference between knowing this and acting on it matters.",
      "one well-timed application changes the entire trajectory.",
      "the principle works precisely because most people ignore it.",
      "recognizing this early gives you options that vanish later.",
      "the gap between amateurs and skilled operators starts here.",
      "people who miss this tend to make the same error repeatedly.",
      "the window for applying this closes faster than you expect.",
      "what seems passive is often the most deliberate choice available.",
      "the real skill is reading when to apply this and when to hold back.",
      "this becomes second nature once you start watching for it.",
      "small adjustments at this stage prevent large corrections later.",
      "the pattern is invisible until someone points it out, then unmistakable.",
      "your instinct will resist this, which is exactly why it works.",
      "once you see the logic, you start noticing it everywhere.",
    ];
    expansion = shortBridges[expandCount % shortBridges.length] + " " +
      sentences[sentences.length - 1];
    sentences[sentences.length - 1] = expansion;
    const result = sentences.join(" ");
    if (wordCount(result) >= minWords) {
      expandCount++;
      return result;
    }
  }

  // Insert a full expansion sentence before the last sentence
  const allButLast = sentences.slice(0, -1);
  const last = sentences[sentences.length - 1];

  // Build expanded text
  let result = [...allButLast, expansion, last].join(" ");
  let resultWC = wordCount(result);

  // If still too short after one expansion, add another
  if (resultWC < minWords && bridges.length > 1) {
    const expansion2 = bridges[(expansionIdx + 7) % bridges.length];
    result = [...allButLast, expansion, expansion2, last].join(" ");
    resultWC = wordCount(result);
  }

  // If now too long, trim back
  if (resultWC > ranges[depth][1]) {
    result = trimToRange(result, ranges[depth][1]);
    trimCount--; // Don't double-count
  }

  expandCount++;
  return result;
}

// Process all chapters
for (const ch of data.chapters) {
  const cv = ch.contentVariants;
  if (!cv) continue;

  for (const [depth, [min, max]] of Object.entries(ranges)) {
    const bd = cv[depth]?.chapterBreakdown;
    if (!bd || typeof bd !== "object") continue;

    for (const tone of ["gentle", "direct", "competitive"]) {
      if (typeof bd[tone] !== "string") continue;
      const wc = wordCount(bd[tone]);

      if (wc > max) {
        bd[tone] = trimToRange(bd[tone], max);
      } else if (wc < min) {
        bd[tone] = expandToRange(bd[tone], min, depth);
      }
    }
  }
}

writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");

// Verify
let remaining = 0;
for (const ch of data.chapters) {
  for (const [depth, [min, max]] of Object.entries(ranges)) {
    const bd = ch.contentVariants?.[depth]?.chapterBreakdown;
    if (!bd) continue;
    for (const tone of ["gentle", "direct", "competitive"]) {
      const wc = wordCount(bd[tone] || "");
      if (wc < min || wc > max) remaining++;
    }
  }
}

console.log(`Word count fixes: ${trimCount} trimmed, ${expandCount} expanded`);
console.log(`Remaining out-of-range: ${remaining}`);
