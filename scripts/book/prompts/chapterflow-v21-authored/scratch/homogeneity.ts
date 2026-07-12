import { readFileSync } from "fs";
console.log("=== the-first-90-days: 10 hooks + first-example scene OPENERS (homogenization evidence) ===");
for (let i=1;i<=10;i++){
  const n=String(i).padStart(2,"0");
  let ch:any; try{ch=JSON.parse(readFileSync(`state/chapters/the-first-90-days-ch${n}.v21-native.chapter.json`,"utf8"));}catch{continue;}
  const sc=(ch.examples?.[0]?.scenario||"");
  console.log(`ch${n} HOOK: ${(ch.hook||"").slice(0,70)}`);
  console.log(`     EX1: ${sc.slice(0,90)}`);
}
