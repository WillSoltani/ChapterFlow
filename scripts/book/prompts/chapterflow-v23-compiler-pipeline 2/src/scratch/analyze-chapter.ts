/**
 * Analyze a generated chapter JSON and produce a reader-oriented rating:
 * reading level per tier, stock-phrase scan, metaphor density, closing-line
 * specificity, example format diversity, and answer-position balance.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/analyze-chapter.ts <path/to/chapter.json>
 */

import { readFileSync } from "fs";
import { resolve } from "path";

import { fleschKincaid } from "../critics/readingLevel.js";

const FILE = process.argv[2] ?? resolve("scripts/book/prompts/chapterflow-v21-authored/state/chapters/thinking-fast-and-slow-ch05.v21-native.chapter.json");

const ch = JSON.parse(readFileSync(FILE, "utf8"));

console.log(`\n${"=".repeat(70)}`);
console.log(`Chapter analysis: ${ch.title}`);
console.log(`File: ${FILE}`);
console.log(`${"=".repeat(70)}\n`);

// Hook + counterintuition
console.log(`hook (${ch.hook.length}c): "${ch.hook}"`);
if (ch.counterintuition) console.log(`counterintuition (${ch.counterintuition.length}c)`);
console.log(`keyTakeaway (${ch.keyTakeaway.length}c): "${ch.keyTakeaway}"\n`);

// Breakdown: FK + length + closing line
for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
  const text = ch.breakdown[tier] as string;
  const fk = fleschKincaid(text);
  const lastSentenceMatch = text.match(/[^.!?]+[.!?]\s*$/);
  const closing = lastSentenceMatch ? lastSentenceMatch[0].trim() : "(none)";
  console.log(`${tier.padEnd(9)} | FK ${fk.toFixed(1).padStart(4)} | ${text.length.toString().padStart(4)}c | closing: "${closing.slice(-90)}"`);
}

// Example formats + names
console.log("\nexamples:");
const usedNames = new Set<string>();
const nameRe = /\b[A-Z][a-z]{2,}\b/g;
const stop = new Set(["The","A","An","If","When","Chapter","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","She","He","They","It","This","Before","After"]);
for (let i = 0; i < ch.examples.length; i++) {
  const ex = ch.examples[i];
  const names = Array.from(ex.scenario.matchAll(nameRe))
    .map((m: any) => m[0])
    .filter((n: string) => !stop.has(n));
  for (const n of names) usedNames.add(n);
  console.log(`  [${String(i).padStart(2)}] [${(ex.planSpec?.format ?? "?").padEnd(16)}] ${ex.title}`);
}
console.log(`  distinct names in scenarios: ${Array.from(usedNames).join(", ")}`);
const formats = new Set(ch.examples.map((e: any) => e.planSpec?.format));
console.log(`  distinct formats: ${formats.size}/6`);

// Quiz: answer position distribution, bloomsMix
const posCounts = [0, 0, 0];
for (const q of ch.quiz.questions) posCounts[q.correctIndex]++;
console.log(`\nquiz answer positions: 0=${posCounts[0]}, 1=${posCounts[1]}, 2=${posCounts[2]} (of ${ch.quiz.questions.length})`);
const bloom: Record<string, number> = {};
for (const q of ch.quiz.questions) bloom[q.bloomsLevel] = (bloom[q.bloomsLevel] ?? 0) + 1;
console.log(`bloomsMix: ${Object.entries(bloom).sort().map(([k, v]) => `${k}=${v}`).join(", ")}`);

// Cross-tier verbatim sharing
function slidingNGrams(text: string, n: number): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}
const aGrams = slidingNGrams(ch.breakdown.fastRead, 4);
const bGrams = slidingNGrams(ch.breakdown.deepRead, 4);
const cGrams = slidingNGrams(ch.breakdown.fullRead, 4);
const crossAB = Array.from(aGrams).filter((g) => bGrams.has(g) && g.length > 15);
const crossBC = Array.from(bGrams).filter((g) => cGrams.has(g) && g.length > 15);
const crossAC = Array.from(aGrams).filter((g) => cGrams.has(g) && g.length > 15);
console.log(`\ncross-tier shared 4-grams:`);
console.log(`  fastRead ∩ deepRead: ${crossAB.length ? crossAB.join(" | ").slice(0, 120) : "(none)"}`);
console.log(`  deepRead ∩ fullRead: ${crossBC.length ? crossBC.join(" | ").slice(0, 120) : "(none)"}`);
console.log(`  fastRead ∩ fullRead: ${crossAC.length ? crossAC.join(" | ").slice(0, 120) : "(none)"}`);

// Em-dash scan (belt-and-braces)
const wholeText = JSON.stringify(ch);
console.log(`\nem dashes anywhere in chapter: ${(wholeText.match(/—/g) ?? []).length}`);

// Metaphor density (crude: count known metaphor-carrier words)
const metaphorWords = ["leak", "leakage", "drag", "engine", "vote", "votes", "voting", "grease", "glow", "warmth", "scaffold", "scaffolding", "machinery", "pollute"];
const joinedBreakdown = `${ch.breakdown.fastRead} ${ch.breakdown.deepRead} ${ch.breakdown.fullRead}`;
const metaphorCount = metaphorWords.reduce((acc, w) => {
  const re = new RegExp(`\\b${w}\\b`, "gi");
  return acc + (joinedBreakdown.match(re) ?? []).length;
}, 0);
console.log(`metaphor-carrier words across breakdown: ${metaphorCount}`);
