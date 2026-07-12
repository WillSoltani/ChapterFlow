import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { checkScaffoldLeak } from "../src/critics/scaffoldLeak.js";
const PKG = resolve(process.cwd(), "../../../../book-packages"); // from pipeline dir up to repo root
const dir = resolve("/Users/radinsoltani/ChapterFlow-books/book-packages");
const oldWarn = console.warn; console.warn = () => {};
const byBook = new Map<string, string[]>();
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".json")) continue;
  let pkg: any;
  try { pkg = JSON.parse(readFileSync(resolve(dir, f), "utf8")); } catch { continue; }
  const chapters = pkg.chapters ?? pkg.book?.chapters ?? [];
  for (const ch of chapters) {
    for (const hit of checkScaffoldLeak(ch).filter((x: any) => x.checkId === "SL6.source_numbering_leak")) {
      const key = f.replace(".v21.json", "");
      if (!byBook.has(key)) byBook.set(key, []);
      byBook.get(key)!.push(`ch${ch.number ?? "?"} ${hit.unit}: "${hit.evidence}"`);
    }
  }
}
console.warn = oldWarn;
console.log(`SL6 fires in ${byBook.size} shipped book(s):`);
for (const [b, hits] of [...byBook.entries()].sort((a,b)=>b[1].length-a[1].length)) {
  console.log(`  ${b}: ${hits.length}  e.g. ${hits[0]}`);
}
