import { readFileSync } from "fs";
import { goldChapterFiles, cleanCorpusChapterFiles } from "../tests/helpers.js";

// Classify the opening of an example scenario into a coarse archetype.
function openerArchetype(s: string): string {
  const t = (s||"").trim();
  if (!t) return "empty";
  if (/^["“]/.test(t)) return "dialogue";
  const first = t.split(/\s+/).slice(0,6).join(" ");
  if (/^(on|by|after|before|during|at)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d|the\s+(first|second|third|morning|afternoon|evening|week|day|deadline))/i.test(t)) return "time-first";
  if (/^(at|in|inside|across|beside|behind|on)\s+(the|a|an|his|her|their)\s+\w+/i.test(t)) return "place-first";
  if (/^\d|^[A-Z][a-z]+\s+(percent|%|out of|of \d)/.test(t)) return "data-first";
  if (/^The\s+[a-z]+\s+(sticks|opens|buzzes|sits|glows|marks|shows|tears|rings)/.test(t)) return "object-first";
  if (/^[A-Z][a-z]+\s+[a-z]+s\b/.test(first)) return "name-action"; // "Liam deletes", "Laura asks"
  return "other";
}
function dominance(books: {bookId:string,files:string[]}[], label: string) {
  console.log(`\n=== ${label} — per-book scene-opener archetype dominance (max-fraction) ===`);
  const ds:number[]=[];
  for (const {bookId,files} of books) {
    if (files.length<5) continue;
    const counts = new Map<string,number>();
    let total=0;
    for (const f of files) {
      const ch=JSON.parse(readFileSync(f,"utf8"));
      for (const ex of (ch.examples??[])) { const a=openerArchetype(ex.scenario); counts.set(a,(counts.get(a)??0)+1); total++; }
    }
    const max = Math.max(0,...counts.values());
    const frac = total?max/total:0; ds.push(frac);
    const dist=[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join(" ");
    console.log(`  ${bookId.slice(0,28).padEnd(28)} dominance=${(frac*100).toFixed(0)}%  [${dist}]`);
  }
  if(ds.length) console.log(`  >>> ${label} dominance: min=${(Math.min(...ds)*100).toFixed(0)}% max=${(Math.max(...ds)*100).toFixed(0)}% mean=${(ds.reduce((a,b)=>a+b,0)/ds.length*100).toFixed(0)}%`);
}
const oldWarn=console.warn; console.warn=()=>{};
const gold=[...goldChapterFiles(),...cleanCorpusChapterFiles()].filter(b=>b.files.length>0);
console.warn=oldWarn;
dominance(gold, "GOLD+CLEAN reference");

// the homogenized book: read the published package chapters
const pkg=JSON.parse(readFileSync("/Users/radinsoltani/ChapterFlow-books/book-packages/the-first-90-days.v21.json","utf8"));
const counts=new Map<string,number>(); let total=0;
console.log("\n=== the-first-90-days (published, post-repair) scene openers ===");
for (const ch of pkg.chapters??[]) {
  const o = (ch.examples??[]).map((e:any)=>openerArchetype(e.scenario));
  o.forEach((a:string)=>{counts.set(a,(counts.get(a)??0)+1);total++;});
  console.log(`  ch${ch.number}: ${o.join(", ")}  | ex1="${(ch.examples?.[0]?.scenario||"").slice(0,55)}"`);
}
const max=Math.max(0,...counts.values());
console.log(`  >>> the-first-90-days dominance=${total?(max/total*100).toFixed(0):0}%  [${[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+":"+v).join(" ")}]`);
