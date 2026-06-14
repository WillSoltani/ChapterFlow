// Diagnostic: print ALL ship-gate findings (blocker/major/minor) for given chapter files.
import { readFileSync } from "fs";
import { resolve } from "path";
import { runShipGate } from "../../src/critics/finalGate.js";

for (const f of process.argv.slice(2)) {
  const ch = JSON.parse(readFileSync(resolve(f), "utf8"));
  const r = runShipGate(ch);
  console.log(`\n==== ${ch.chapterId} : blockers=${r.summary.blockersCount} majors=${r.summary.majorsCount} minors=${r.summary.minorsCount} ====`);
  for (const g of [...r.blockers, ...r.majors, ...r.minors]) {
    console.log(`  [${g.severity.toUpperCase()} ${g.catalogId}] ${g.unit}: ${g.message}`);
  }
}
