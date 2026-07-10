/* CF-I-1 calibration probe — standalone run over the three corpora. Not a test.
 *   npx tsx src/scratch/cf-i-1-probe.ts
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";

import { checkMetaCaseProtagonist } from "../critics/metaCaseProtagonist.js";
import { checkBeatVocabularyEcho, checkBookBeatVocabularyEcho } from "../critics/beatVocabularyEcho.js";
import { checkCitationDateDoorway } from "../critics/citationDateDoorway.js";
import { checkLineageKeyQuiz } from "../critics/lineageKeyQuiz.js";
import type { ChapterV21 } from "../types.js";

const STATE = resolve(import.meta.dirname, "../../state/chapters");
const PKG_DIR = resolve(import.meta.dirname, "../../../../../../book-packages");

function loadStateBook(prefix: string): ChapterV21[] {
  if (!existsSync(STATE)) return [];
  return readdirSync(STATE)
    .filter((f) => f.startsWith(`${prefix}-ch`) && f.endsWith(".v21-native.chapter.json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(resolve(STATE, f), "utf8")) as ChapterV21);
}

function loadPackageBook(id: string): ChapterV21[] {
  const p = resolve(PKG_DIR, `${id}.v21.json`);
  if (!existsSync(p)) return [];
  const pkg = JSON.parse(readFileSync(p, "utf8"));
  return (pkg.chapters ?? []) as ChapterV21[];
}

function probe(label: string, chapters: ChapterV21[]) {
  if (chapters.length === 0) { console.log(`\n## ${label}: (absent)`); return; }
  console.log(`\n## ${label} (${chapters.length} chapters)`);
  const c32: number[] = [], c33: number[] = [], c34: number[] = [], c35: number[] = [];
  for (const ch of chapters) {
    const n = ch.number ?? 0;
    if (checkMetaCaseProtagonist(ch).length) c32.push(n);
    if (checkBeatVocabularyEcho(ch).length) c33.push(n);
    if (checkCitationDateDoorway(ch).length) c34.push(n);
    if (checkLineageKeyQuiz(ch).length) c35.push(n);
  }
  const pct = (a: number[]) => `${a.length}/${chapters.length} (${Math.round(100 * a.length / chapters.length)}%)`;
  console.log(`  C32 meta-case:      ${pct(c32)}  ch[${c32.join(",")}]`);
  console.log(`  C33 beat-vocab:     ${pct(c33)}  ch[${c33.join(",")}]`);
  console.log(`  C34 date-doorway:   ${pct(c34)}  ch[${c34.join(",")}]`);
  console.log(`  C35 lineage-key:    ${pct(c35)}  ch[${c35.join(",")}]`);
  const book = checkBookBeatVocabularyEcho(chapters);
  console.log(`  C33 book-level:     ${book.length} finding(s)`);
  for (const f of book) console.log(`     - ${f.evidence}: ch[${f.chapters.join(",")}]`);
}

probe("multipliers (fresh, target)", loadStateBook("multipliers"));
probe("start-with-why (v24 GOLD)", loadStateBook("start-with-why"));
probe("high-output-management (published)", loadPackageBook("high-output-management"));
