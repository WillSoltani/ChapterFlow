/**
 * Scope scan: for each book package given, run register.checkBannedPhrases
 * over every text-bearing field of every chapter and report which chapters
 * now contain a hard-banned phrase (with focus on the 3 newly added entries).
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/scope-new-bans.ts \
 *       book-packages/clear-thinking.v21.json [...more]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { checkBannedPhrases } from "../critics/register.js";

const NEW_PHRASES = [
  "On a note beside the work, write the reminders plainly",
  "Most readers assume",
  "Most readers think",
].map((s) => s.toLowerCase());

function chapterText(ch: any): string {
  return [
    ch.hook ?? "",
    ch.counterintuition ?? "",
    ch.keyTakeaway ?? "",
    ch.breakdown?.fastRead ?? "",
    ch.breakdown?.deepRead ?? "",
    ch.breakdown?.fullRead ?? "",
  ].join("\n\n");
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: scope-new-bans.ts <book-package.json> [...]");
  process.exit(1);
}

let grandTotal = 0;
const globalChaptersNeedingRegen: Array<{ book: string; chapter: number; title: string; reasons: string[] }> = [];

for (const arg of args) {
  const path = resolve(process.cwd(), arg);
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const bookTitle: string = pkg.book?.title ?? pkg.book?.bookId ?? arg;
  const chapters: any[] = pkg.chapters ?? [];

  // Per-phrase per-chapter counts
  const perPhraseChapters = new Map<string, Set<number>>();
  for (const p of NEW_PHRASES) perPhraseChapters.set(p, new Set<number>());

  const failingChapters: Array<{ n: number; title: string; reasons: string[] }> = [];

  for (const ch of chapters) {
    const text = chapterText(ch).toLowerCase();
    const reasons: string[] = [];
    for (const p of NEW_PHRASES) {
      if (text.includes(p)) {
        reasons.push(p);
        perPhraseChapters.get(p)!.add(ch.number);
      }
    }
    // Belt-and-suspenders: also run the register critic to verify ALL hard-banned hits.
    const findingsAll = checkBannedPhrases(text).findings;
    const otherHits = findingsAll.filter((f) => !NEW_PHRASES.some((p) => f.message.toLowerCase().includes(p)));
    // We only report regen scope for NEW phrases (the existing entries were already part of any prior scope).
    if (reasons.length > 0) {
      failingChapters.push({ n: ch.number, title: ch.title ?? "", reasons });
      globalChaptersNeedingRegen.push({ book: bookTitle, chapter: ch.number, title: ch.title ?? "", reasons });
    }
    void otherHits;
  }

  console.log(`\n## ${bookTitle}`);
  console.log(`  total chapters: ${chapters.length}`);
  console.log(`  chapters with a NEW hard-banned phrase: ${failingChapters.length}`);
  for (const p of NEW_PHRASES) {
    const hits = perPhraseChapters.get(p)!;
    console.log(`    "${p}": ${hits.size} chapter(s) — [${[...hits].sort((a, b) => a - b).join(", ")}]`);
  }
  if (failingChapters.length > 0) {
    console.log(`  failing chapters (regen list):`);
    for (const f of failingChapters.sort((a, b) => a.n - b.n)) {
      console.log(`    Ch${f.n.toString().padStart(2, " ")}: ${f.title}  [hits: ${f.reasons.join(" | ")}]`);
    }
  }
  grandTotal += failingChapters.length;
}

console.log(`\n=== GRAND TOTAL: ${grandTotal} chapter(s) need regeneration across ${args.length} book(s) ===`);
