#!/usr/bin/env node
/**
 * Apply hand-written distractors to the-art-of-thinking-clearly.v21.json.
 *
 * Input: a JS object literal in this file mapping chapter index (0-based)
 * to per-question distractor pairs. Each pair is [d0_replacement, d1_replacement]
 * meaning the two non-correct slots, in order of their position in choices[].
 *
 * Runs the per-chapter gate (banned phrases, absolutes, 5-gram dedup, C18, lowercase open)
 * before writing. Aborts on any gate failure.
 */
import fs from "node:fs";

const BOOK_PATH = "book-packages/the-art-of-thinking-clearly.v21.json";

// CHAPTER_PATCHES is loaded from a sibling .data.json file so we can change the
// distractor content without re-reading this script.
const DATA_PATH = process.argv[2] || "scripts/atc-distractors-data.json";

const BANNED_REGEX =
  /(looks strong enough to guide|gives a practical reason for|fits the immediate pressure around|supports a narrower read of|points toward a quicker call|let [a-z ]+ stand until [a-z ]+ contradicts it|can wait unless [a-z ]+ changes the stakes|makes [a-z ]+ look credible|may matter under the right conditions|may be the most visible signal here|may be impractical to measure quickly|may be risky in this case|may deserve less weight here|without comparing it with the relevant alternative|while the same weak assumption|before checking the current decision evidence|while leaving the key comparison unchecked|without testing the evidence in this scene)/i;
const ABSOLUTE_REGEX =
  /\b(always|never|automatically|impossible|guaranteed|entirely|ever|forever|completely|wholly|absolutely)\b/i;
const ABSOLUTE_OK = /^(whatever|however|whenever|whichever)$/i;

function tokens(s) {
  return s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
}
function ngrams(s, n) {
  const t = tokens(s);
  const out = [];
  for (let i = 0; i <= t.length - n; i++) out.push(t.slice(i, i + n).join(" "));
  return out;
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
const book = JSON.parse(fs.readFileSync(BOOK_PATH, "utf-8"));

const failures = [];

for (const [chKey, qPatches] of Object.entries(data)) {
  const chIndex = parseInt(chKey, 10) - 1; // 1-indexed in data file
  const ch = book.chapters[chIndex];
  if (!ch) {
    failures.push(`Ch${chKey}: chapter not found`);
    continue;
  }

  // build candidate choices for each question without writing yet
  const stagedQuestions = [];
  for (const [qKey, pair] of Object.entries(qPatches)) {
    const qIndex = parseInt(qKey, 10) - 1;
    const q = ch.quiz.questions[qIndex];
    if (!q) {
      failures.push(`Ch${chKey} Q${qKey}: question not found`);
      continue;
    }
    if (!Array.isArray(pair) || pair.length !== 2) {
      failures.push(`Ch${chKey} Q${qKey}: pair must be [d0,d1] (two distractors)`);
      continue;
    }
    const ci = q.correctIndex;
    const newChoices = [null, null, null];
    newChoices[ci] = q.choices[ci];
    const slots = [0, 1, 2].filter((s) => s !== ci);
    newChoices[slots[0]] = pair[0];
    newChoices[slots[1]] = pair[1];
    stagedQuestions.push({ qIndex, q, newChoices, correct: q.choices[ci] });
  }

  // per-question validation
  for (const { qIndex, newChoices, correct } of stagedQuestions) {
    newChoices.forEach((c, di) => {
      if (c === correct) return;
      if (!c || typeof c !== "string") {
        failures.push(`Ch${chKey} Q${qIndex + 1} d[${di}]: empty`);
        return;
      }
      if (BANNED_REGEX.test(c))
        failures.push(`Ch${chKey} Q${qIndex + 1} d[${di}]: banned phrase`);
      const m = c.match(ABSOLUTE_REGEX);
      if (m && !ABSOLUTE_OK.test(m[1]))
        failures.push(`Ch${chKey} Q${qIndex + 1} d[${di}]: absolute word "${m[1]}"`);
      if (!/^[A-Z"']/.test(c.trim()))
        failures.push(`Ch${chKey} Q${qIndex + 1} d[${di}]: lowercase open`);
    });
    // C18 ratio (correct/avgD)
    const dists = newChoices.filter((c) => c !== correct);
    const avgD = dists.reduce((s, x) => s + x.length, 0) / dists.length;
    if (avgD && correct.length / avgD > 1.5)
      failures.push(
        `Ch${chKey} Q${qIndex + 1}: C18 ratio ${(correct.length / avgD).toFixed(2)} (too long)`,
      );
  }

  // chapter-level 5-gram dedup: only among the distractors we are writing
  const fivegramCount = new Map();
  for (const { newChoices, correct } of stagedQuestions) {
    for (const c of newChoices) {
      if (c === correct) continue;
      for (const g of ngrams(c, 5)) fivegramCount.set(g, (fivegramCount.get(g) || 0) + 1);
    }
  }
  const dups = [...fivegramCount.entries()].filter(([, n]) => n >= 2);
  if (dups.length) {
    failures.push(
      `Ch${chKey}: ${dups.length} 5-gram dup(s); first: "${dups[0][0]}" x${dups[0][1]}`,
    );
  }

  // if any failure for this chapter, do not commit
  if (failures.some((f) => f.startsWith(`Ch${chKey}`))) continue;

  // commit
  for (const { q, newChoices } of stagedQuestions) {
    q.choices = newChoices;
  }
  console.log(`Ch${chKey}: applied ${stagedQuestions.length} questions`);
}

if (failures.length) {
  console.error("FAILURES:");
  failures.forEach((f) => console.error("  " + f));
  process.exit(1);
}

fs.writeFileSync(BOOK_PATH, JSON.stringify(book, null, 2) + "\n");
console.log("saved book");
