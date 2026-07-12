import { readFileSync } from "fs";
for (const n of ["01","05","09"]) {
  const p = `state/chapters/the-first-90-days-ch${n}.v21-native.chapter.json`;
  let ch:any; try { ch = JSON.parse(readFileSync(p,"utf8")); } catch(e){ console.log(`ch${n}: MISSING`); continue; }
  console.log(`\n===== ch${n}: ${ch.title} =====`);
  console.log(`HOOK: ${(ch.hook||"").slice(0,140)}`);
  console.log(`EX1 scenario: ${(ch.examples?.[0]?.scenario||"").slice(0,200)}`);
  console.log(`EX1 whatToDo: ${(ch.examples?.[0]?.whatToDo||"").slice(0,140)}`);
  const q = ch.quiz?.questions?.[0];
  if (q){ console.log(`Q1 prompt: ${q.prompt}`); console.log(`  choices: ${JSON.stringify(q.choices)}`); console.log(`  correctIndex: ${q.correctIndex}  → "${q.choices?.[q.correctIndex]}"`); console.log(`  explanation: ${q.explanation}`); }
}
