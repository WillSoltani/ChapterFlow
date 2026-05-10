import { readFileSync } from "fs";
import { resolve } from "path";
import { sanitizeBriefForWriter } from "../lib/brief-sanitizer.js";

const briefPath = resolve(
  process.cwd(),
  "scripts/book/prompts/chapterflow-v21-authored/state/briefs/tiny-habits.brief.json",
);
const brief = JSON.parse(readFileSync(briefPath, "utf8"));
const cleaned = sanitizeBriefForWriter(brief);

console.log("=== forbiddenMoves AFTER sanitization ===");
for (const m of cleaned.forbiddenMoves || []) console.log("  -", m);
console.log("\n=== voiceCharter.avoidMoves AFTER sanitization ===");
for (const m of cleaned.voiceCharter.avoidMoves || []) console.log("  -", m);
console.log("\n=== Lines in serialized brief that mention chapter/book/author ===");
const json = JSON.stringify(cleaned, null, 2);
for (const l of json.split("\n")) {
  if (/\b(chapter|the book|the author)\b/i.test(l)) console.log("HIT:", l.trim());
}
