import { readFileSync } from "fs";
import { checkReaderBudgets, type BudgetFinding } from "../src/critics/readerBudgets.js";
const newIds = (fs: BudgetFinding[]) => fs.filter((f) => /CHB1[0-3]/.test(f.checkId));
const exec = Array.from({ length: 9 }, (_, i) =>
  JSON.parse(readFileSync(`state/chapters/execution-ch0${i + 1}.v21-native.chapter.json`, "utf8")));
console.log("== execution (halted) ==");
for (const f of newIds(checkReaderBudgets(exec))) console.log(` [${f.severity}] ${f.checkId} ch${f.chapterNumber}: ${f.message.slice(0, 150)}`);
for (const book of ["atomic-habits", "games-people-play", "thinking-in-bets", "crucial-conversations", "difficult-conversations"]) {
  const pkg = JSON.parse(readFileSync(`../../../../book-packages/${book}.v21.json`, "utf8"));
  const fs = newIds(checkReaderBudgets(pkg.chapters));
  const blockers = fs.filter((f) => f.severity === "blocker");
  console.log(`== ${book}: ${fs.length} finding(s), ${blockers.length} BLOCKER(s)`);
  for (const f of fs) console.log(`   [${f.severity}] ${f.checkId}: ${f.message.slice(0, 130)}`);
}
