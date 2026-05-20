/**
 * One-shot verifier: run the register.checkBannedPhrases critic against every
 * text-bearing field of a chapter file and print findings.
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/verify-banned-on-chapter.ts \
 *       scripts/book/prompts/chapterflow-v21-authored/state/chapters/clear-thinking-ch07.v21-native.chapter.json
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { checkBannedPhrases } from "../critics/register.js";

const argPath = process.argv[2];
if (!argPath) {
  console.error("usage: verify-banned-on-chapter.ts <chapter.json>");
  process.exit(1);
}
const path = resolve(process.cwd(), argPath);
const ch = JSON.parse(readFileSync(path, "utf8"));

const fields: Array<[string, string]> = [
  ["hook", ch.hook ?? ""],
  ["counterintuition", ch.counterintuition ?? ""],
  ["keyTakeaway", ch.keyTakeaway ?? ""],
  ["breakdown.fastRead", ch.breakdown?.fastRead ?? ""],
  ["breakdown.deepRead", ch.breakdown?.deepRead ?? ""],
  ["breakdown.fullRead", ch.breakdown?.fullRead ?? ""],
];

let total = 0;
for (const [name, text] of fields) {
  const { findings } = checkBannedPhrases(text);
  for (const f of findings) {
    console.log(`[${name}] ${f.severity.toUpperCase()} ${f.checkId}: ${f.message.slice(0, 200)}`);
    total += 1;
  }
}
console.log(`\nTotal banned-phrase findings on ${argPath}: ${total}`);
