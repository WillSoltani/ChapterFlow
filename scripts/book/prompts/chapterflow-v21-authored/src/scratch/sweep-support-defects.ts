import { readdirSync, readFileSync } from "fs";
import { resolve, join } from "path";
import { runSupportSectionAudit } from "../critics/supportSectionAudit.js";

const dir = resolve(process.cwd(), "book-packages");
const files = readdirSync(dir).filter((f) => f.endsWith(".v21.json")).sort();

const summary: Array<{ name: string; total: number; blocked: number; blockers: number; majors: number; codes: Record<string, number> }> = [];

for (const f of files) {
  const pkg = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const chapters = pkg.chapters || [];
  let blocked = 0, blockers = 0, majors = 0;
  const codes: Record<string, number> = {};
  chapters.forEach((ch: any) => {
    const finds = runSupportSectionAudit(ch);
    const b = finds.filter((x: any) => x.severity === "blocker").length;
    const m = finds.filter((x: any) => x.severity === "major").length;
    if (b > 0) blocked++;
    blockers += b; majors += m;
    finds.forEach((x: any) => {
      const root = x.checkId.split(".")[0];
      codes[root] = (codes[root] || 0) + 1;
    });
  });
  summary.push({ name: f.replace(".v21.json", ""), total: chapters.length, blocked, blockers, majors, codes });
}

console.log("Affected books (blockers > 0 OR majors > 0):");
summary.filter(s => s.blockers > 0 || s.majors > 0).forEach(s => {
  const codeStr = Object.entries(s.codes).map(([k, v]) => `${k}×${v}`).join(" ");
  console.log(`  ${s.name.padEnd(45)} ${s.blocked}/${s.total} blocked, ${s.blockers} blockers, ${s.majors} majors  (${codeStr})`);
});

const totalAffected = summary.filter(s => s.blockers > 0).length;
const totalChapters = summary.reduce((a, b) => a + b.total, 0);
const totalBlockers = summary.reduce((a, b) => a + b.blockers, 0);
console.log(`\nTotals: ${totalAffected}/${summary.length} books still blocking, ${totalBlockers} blockers across ${totalChapters} chapters`);
