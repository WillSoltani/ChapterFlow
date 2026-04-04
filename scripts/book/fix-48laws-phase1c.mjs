#!/usr/bin/env node
/**
 * Phase 1c: Fix remaining non-standard reviewCard schemas
 * Handles: scenario-based (ch31), quiz-prompt-based (ch40), prompt-toneObj (ch47)
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

    if (isToneObj(card.front) && isToneObj(card.back)) continue;

    const cardId = card.cardId || card.id || card.questionId || `ch${chNum}-rc${String(i + 1).padStart(2, "0")}`;
    const difficulty = card.difficulty || "easy";

    // Type 1: scenario-based (has scenario as tone obj)
    if (card.scenario && isToneObj(card.scenario)) {
      const backText = card.correctAnswer || card.explanation || card.answer || "";
      const backVal = typeof backText === "string"
        ? { gentle: backText, direct: backText, competitive: backText }
        : isToneObj(backText) ? backText : { gentle: String(backText), direct: String(backText), competitive: String(backText) };

      cards[i] = { cardId, difficulty, front: card.scenario, back: backVal };
      fixCount++;
      continue;
    }

    // Type 2: quiz-prompt-based (has prompt as string, choices array)
    if (typeof card.prompt === "string" && Array.isArray(card.choices)) {
      const question = card.prompt;
      const correctAnswer = card.choices[card.correctIndex] || card.choices[0] || "";
      const explanation = card.explanation || "";
      const backText = correctAnswer + (explanation ? " " + explanation : "");

      cards[i] = {
        cardId,
        difficulty,
        front: { gentle: question, direct: question, competitive: question },
        back: { gentle: backText, direct: backText, competitive: backText },
      };
      fixCount++;
      continue;
    }

    // Type 3: prompt is a tone object
    if (card.prompt && isToneObj(card.prompt)) {
      const backText = card.answer || card.explanation || card.correctAnswer || "";
      let backVal;
      if (isToneObj(backText)) {
        backVal = backText;
      } else if (typeof backText === "string") {
        backVal = { gentle: backText, direct: backText, competitive: backText };
      } else {
        backVal = { gentle: String(backText), direct: String(backText), competitive: String(backText) };
      }

      cards[i] = { cardId, difficulty, front: card.prompt, back: backVal };
      fixCount++;
      continue;
    }

    // Fallback: just wrap whatever we have
    console.log(`WARNING: Unhandled reviewCard schema in ch${ch.number}[${i}]:`, Object.keys(card).join(", "));
  }
}

writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`Phase 1c complete. ${fixCount} reviewCards converted.`);

// Verify
let remaining = 0;
const badChs = [];
for (const ch of data.chapters) {
  for (const rc of (ch.reviewCards || [])) {
    if (!isToneObj(rc.front) || !isToneObj(rc.back)) {
      remaining++;
      if (!badChs.includes(ch.number)) badChs.push(ch.number);
    }
  }
}
console.log(`Remaining non-tone reviewCards: ${remaining}`);
if (badChs.length > 0) console.log("Affected chapters:", badChs.join(", "));
