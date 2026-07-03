/**
 * CHB7 (the ENFORCED W3 blocker) true-positive audit across the full repo-root
 * book-packages corpus:  npx tsx scratch/chb7-corpus.ts
 *
 * Reports every book on which CHB7 blocks and the offending scaffold family /
 * phrase. The top-5 owner-scored books (games-people-play, crucial-conversations,
 * atomic-habits, thinking-in-bets, difficult-conversations) are CLEAN; the books
 * that fire carry genuine scaffold-stem monocultures (e.g. deep-work's identical
 * 24h challenge 9/9), the same defect class CHB5 already prices.
 */
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { checkReaderBudgets } from "../src/critics/readerBudgets.js";

const PKG_DIR = resolve(__dirname, "../../../../../book-packages");
const files = readdirSync(PKG_DIR).filter((f) => f.endsWith(".v21.json"));
let fired = 0;
for (const f of files) {
  const id = f.replace(".v21.json", "");
  let pkg;
  try { pkg = JSON.parse(readFileSync(resolve(PKG_DIR, f), "utf8")); } catch { continue; }
  const blk = checkReaderBudgets(pkg.chapters ?? []).filter((x) => x.severity === "blocker" && x.checkId.startsWith("CHB7"));
  if (blk.length) {
    fired++;
    const ids = [...new Set(blk.map((b) => b.checkId))];
    console.log(`${id} [${(pkg.chapters || []).length}ch]: ${ids.join(",")}  -> ${blk[0].message.slice(0, 110)}`);
  }
}
console.log(`\nCHB7 BLOCKER fired on ${fired}/${files.length} books`);
