import { planSceneMechanisms } from "../src/librarian/sceneMechanismPlan.js";
import { planSceneModes } from "../src/librarian/sceneModePlan.js";
const mech = planSceneMechanisms("zz-variety-check", 1, 10);
const mode = planSceneModes("zz-variety-check", 1, 10);
const rows = [];
for (let n=1;n<=10;n++){
  rows.push({n, move: mech.allocation[n]?.mechanismId ?? "—", stance: (mode.allocation[n] as any)?.stance ?? "—"});
}
console.log("BOOK-WIDE VARIETY MAP (rendered for ch5):");
for (const r of rows) console.log(`    ch${r.n}${r.n===5?"  ← YOURS":""}: move=${r.move} · stance=${r.stance}`);
const moves = rows.map(r=>r.move);
console.log(`\ndistinct moves: ${new Set(moves).size}/10 ; distinct stances: ${new Set(rows.map(r=>r.stance)).size}`);
