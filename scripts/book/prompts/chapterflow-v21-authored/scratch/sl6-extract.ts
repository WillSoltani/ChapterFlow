import { readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";
const dir = "/Users/radinsoltani/ChapterFlow-books/book-packages";
const RE = /\b(Fact|Source|Reference|Anchor|Citation|Evidence)\s+#?\d+(?:'s)?\s+(\w+)/i;
const verbHist = new Map<string, number>();
const all: Array<{book:string;ch:number;q:number;expl:string}> = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".json")) continue;
  let pkg: any; try { pkg = JSON.parse(readFileSync(resolve(dir,f),"utf8")); } catch { continue; }
  for (const ch of pkg.chapters ?? []) {
    (ch.quiz?.questions ?? []).forEach((q: any, qi: number) => {
      const m = (q.explanation ?? "").match(RE);
      if (m) { verbHist.set(m[2].toLowerCase(), (verbHist.get(m[2].toLowerCase())??0)+1); all.push({book:f.replace(".v21.json",""),ch:ch.number,q:qi,expl:q.explanation}); }
    });
  }
}
console.log("VERB after 'Label N' (histogram):");
for (const [v,c] of [...verbHist.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${v}: ${c}`);
console.log(`\nTOTAL leak instances: ${all.length}`);
console.log("\nSAMPLE (first 12):");
for (const x of all.slice(0,12)) console.log(`  [${x.book} ch${x.ch} q${x.q}] ${x.expl.slice(0,160)}`);
writeFileSync("scratch/sl6-instances.json", JSON.stringify(all,null,2));
