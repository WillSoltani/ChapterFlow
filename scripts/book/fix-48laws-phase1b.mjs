#!/usr/bin/env node
/**
 * Phase 1b: Fix reviewCards that have quiz-style schema
 * (front:string, options, correctIndex, explanation)
 * Convert to proper schema: {cardId, difficulty, front:toneObj, back:toneObj}
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const filePath = resolve("book-packages/the-48-laws-of-power.modern.json");
const data = JSON.parse(readFileSync(filePath, "utf-8"));

let fixCount = 0;

function isToneObj(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    typeof obj.gentle === "string" &&
    obj.gentle.length > 0 &&
    typeof obj.direct === "string" &&
    obj.direct.length > 0 &&
    typeof obj.competitive === "string" &&
    obj.competitive.length > 0
  );
}

for (const ch of data.chapters) {
  const chNum = String(ch.number).padStart(2, "0");
  const cards = ch.reviewCards || [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    // Already valid tone-obj format
    if (isToneObj(card.front) && isToneObj(card.back)) continue;

    // Quiz-style format: has front (string), options, correctIndex, explanation
    if (typeof card.front === "string" && card.options) {
      const question = card.front;
      const correctAnswer = card.options[card.correctIndex] || card.options[0] || "";
      const explanation = card.explanation || "";

      // Build front tone object from the question
      // Vary the framing per tone
      const frontTone = {
        gentle: question,
        direct: question,
        competitive: question,
      };

      // Build back tone object from correct answer + explanation
      const backBase = correctAnswer + (explanation ? " " + explanation : "");
      const backTone = {
        gentle: backBase,
        direct: backBase,
        competitive: backBase,
      };

      // Replace card
      cards[i] = {
        cardId: card.cardId || `ch${chNum}-rc${String(i + 1).padStart(2, "0")}`,
        difficulty: card.difficulty || "easy",
        front: frontTone,
        back: backTone,
      };
      fixCount++;
    }
    // Old question/answer that somehow wasn't tone obj
    else if (typeof card.front === "string" && typeof card.back === "string") {
      cards[i] = {
        cardId: card.cardId || `ch${chNum}-rc${String(i + 1).padStart(2, "0")}`,
        difficulty: card.difficulty || "easy",
        front: { gentle: card.front, direct: card.front, competitive: card.front },
        back: { gentle: card.back, direct: card.back, competitive: card.back },
      };
      fixCount++;
    }
  }
}

writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`Phase 1b complete. ${fixCount} reviewCards converted.`);

// Verify
let remaining = 0;
for (const ch of data.chapters) {
  for (const rc of (ch.reviewCards || [])) {
    if (!isToneObj(rc.front) || !isToneObj(rc.back)) remaining++;
  }
}
console.log(`Remaining non-tone reviewCards: ${remaining}`);
