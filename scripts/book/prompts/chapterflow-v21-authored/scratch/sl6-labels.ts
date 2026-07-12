import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { goldChapterFiles, cleanCorpusChapterFiles } from "../tests/helpers.js";
const dir = "/Users/radinsoltani/ChapterFlow-books/book-packages";
// Pattern A candidate: case-sensitive capitalized internal label + number (no verb).
const CAP = /\b(Fact|Anchor|Citation|Evidence|Reference|Source)\s+#?\d+\b/g;
const labelHist = new Map<string, number>();
function scanText(t: string) { for (const m of t.matchAll(CAP)) labelHist.set(m[1], (labelHist.get(m[1])??0)+1); }
function readerText(ch: any): string {
  const parts: string[] = [];
  for (const q of ch.quiz?.questions ?? []) { parts.push(q.prompt??"", q.explanation??""); for (const c of q.choices??[]) parts.push(c); }
  for (const c of ch.reviewCards ?? []) parts.push(c.front??"", c.back??"");
  for (const e of ch.examples ?? []) parts.push(e.scenario??"", e.whatToDo??"", e.whyItMatters??"", e.title??"");
  parts.push(ch.hook??"", ch.counterintuition??"", ch.keyTakeaway??"", ch.tryThisNow??"");
  parts.push(ch.breakdown?.fastRead??"", ch.breakdown?.deepRead??"", ch.breakdown?.fullRead??"");
  return parts.join("\n");
}
// shipped packages
for (const f of readdirSync(dir)) { if(!f.endsWith(".json"))continue; let p:any; try{p=JSON.parse(readFileSync(resolve(dir,f),"utf8"));}catch{continue;} for(const ch of p.chapters??[]) scanText(readerText(ch)); }
console.log("CASE-SENSITIVE 'Label N' across SHIPPED packages (label histogram):");
for (const [l,c] of [...labelHist.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${l}: ${c}`);
// reference corpus FP check
const oldWarn=console.warn; console.warn=()=>{};
const ref = [...goldChapterFiles(), ...cleanCorpusChapterFiles()].filter(b=>b.files.length>0);
console.warn=oldWarn;
let refHits=0; const refEx:string[]=[];
for (const {files} of ref) for (const f of files) { const ch=JSON.parse(readFileSync(f,"utf8")); const t=readerText(ch); for(const m of t.matchAll(CAP)){refHits++; if(refEx.length<5)refEx.push(m[0]);} }
console.log(`\nREFERENCE CORPUS case-sensitive 'Label N' hits (must be ~0): ${refHits} ${refEx.length?"e.g. "+refEx.join(", "):""}`);
