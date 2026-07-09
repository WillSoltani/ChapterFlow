/* CF-I-4 evidence dump — actual flagged text per detector over multipliers only.
 *   npx tsx src/scratch/cf-i-4-dump.ts
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";

import { checkExampleRegister, findEvaluatorOpeners } from "../critics/exampleRegister.js";
import { checkMetaCaseProtagonist, findArtifactSubjects } from "../critics/metaCaseProtagonist.js";
import { checkBeatVocabularyEcho, beatFamiliesInChapter, checkBookBeatVocabularyEcho } from "../critics/beatVocabularyEcho.js";
import { checkCitationDateDoorway } from "../critics/citationDateDoorway.js";
import { checkLineageKeyQuiz, findLineageKeyQuestions } from "../critics/lineageKeyQuiz.js";
import { checkBookAphorismRepetition } from "../critics/bookRepetition.js";
import { MACHINERY_BEAT_SURFACES } from "../critics/machineryPhrases.js";
import type { ChapterV21 } from "../types.js";

const STATE = resolve(import.meta.dirname, "../../state/chapters");
function loadBook(prefix: string): ChapterV21[] {
  return readdirSync(STATE)
    .filter((f) => f.startsWith(`${prefix}-ch`) && f.endsWith(".v21-native.chapter.json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(resolve(STATE, f), "utf8")) as ChapterV21);
}

const chapters = loadBook("multipliers");
const lede = (ch: ChapterV21) => (ch.breakdown?.fastRead ?? "").split(/(?<=[.!?])\s+/)[0] ?? "";

for (const ch of chapters) {
  const n = String(ch.number).padStart(2, "0");
  const c31 = checkExampleRegister(ch);
  const c32 = checkMetaCaseProtagonist(ch);
  const c33 = checkBeatVocabularyEcho(ch);
  const c34 = checkCitationDateDoorway(ch);
  const c35 = checkLineageKeyQuiz(ch);
  if (!c31.length && !c32.length && !c33.length && !c34.length && !c35.length) continue;
  console.log(`\n════════ ch${n} — ${ch.title ?? ""}`);
  if (c31.length) {
    const openers = findEvaluatorOpeners(ch);
    console.log(`  C31 evaluator-openers (${openers.length}):`);
    for (const o of openers.slice(0, 12)) console.log(`     · [${(o as any).exampleId ?? "?"}.${(o as any).field ?? "?"}] "${((o as any).opener ?? (o as any).text ?? "").slice(0, 90)}"`);
  }
  if (c32.length) {
    console.log(`  C32 meta-case: ${c32[0].message.slice(0, 100)}`);
    for (const h of findArtifactSubjects(ch)) {
      const ex: any = (ch.examples ?? []).find((e: any) => (e.exampleId ?? "") === h.exampleId);
      const txt = String(ex?.[h.field] ?? "");
      console.log(`     · [${h.exampleId}.${h.field}] "${txt.slice(0, 140)}"`);
    }
  }
  if (c33.length) {
    console.log(`  C33 beat-vocab families in-chapter: ${beatFamiliesInChapter(ch).join(", ")}`);
    // find which surfaces appear where
    const fields: Record<string, string> = {
      hook: ch.hook ?? "", counterintuition: (ch as any).counterintuition ?? "",
      keyTakeaway: ch.keyTakeaway ?? "", fastRead: ch.breakdown?.fastRead ?? "",
      deepRead: ch.breakdown?.deepRead ?? "", fullRead: ch.breakdown?.fullRead ?? "",
    };
    (ch.examples ?? []).forEach((e: any, i) => { fields[`ex${i}.scenario`] = e.scenario ?? ""; fields[`ex${i}.whatToDo`] = e.whatToDo ?? ""; fields[`ex${i}.whyItMatters`] = e.whyItMatters ?? ""; });
    for (const surf of MACHINERY_BEAT_SURFACES) {
      const re = new RegExp(`[^.!?]*\\b${surf}\\b[^.!?]*`, "gi");
      for (const [fname, ftext] of Object.entries(fields)) {
        const m = ftext.match(re);
        if (m) for (const s of m) console.log(`     · "${surf}" in ${fname}: "…${s.trim().slice(0, 110)}…"`);
      }
    }
  }
  if (c34.length) {
    console.log(`  C34 date-doorway lede: "${lede(ch).slice(0, 160)}"`);
  }
  if (c35.length) {
    console.log(`  C35 lineage-key quiz:`);
    for (const i of findLineageKeyQuestions(ch)) {
      const q: any = ch.quiz?.questions?.[i];
      console.log(`     · ${q?.questionId ?? `q${i+1}`} KEY="${(q?.choices?.[q?.correctIndex] ?? "").slice(0, 120)}"`);
      console.log(`        EXPL="${(q?.explanation ?? "").slice(0, 120)}"`);
    }
  }
}

console.log(`\n════════ BOOK-LEVEL`);
const book33 = checkBookBeatVocabularyEcho(chapters);
for (const f of book33) console.log(`  C33 "${f.evidence}": ch[${f.chapters.join(",")}]`);
const aph = checkBookAphorismRepetition(chapters);
for (const f of aph) console.log(`  BP34 aphorism: ${f.message.slice(0, 130)} :: ch[${(f as any).chapters?.join(",")}]`);

// ch04/ch07 verbatim 8-gram check
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function grams(text: string, n: number): Set<string> {
  const w = norm(text).split(" "); const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}
const allText = (ch: ChapterV21) => [ch.hook, ch.keyTakeaway, ch.breakdown?.fastRead, ch.breakdown?.deepRead, ch.breakdown?.fullRead, ...(ch.examples ?? []).flatMap((e: any) => [e.scenario, e.whatToDo, e.whyItMatters])].filter(Boolean).join(" \n ");
console.log(`\n  Cross-chapter shared 8-grams (any pair):`);
for (let a = 0; a < chapters.length; a++) for (let b = a + 1; b < chapters.length; b++) {
  const ga = grams(allText(chapters[a]), 8), gb = grams(allText(chapters[b]), 8);
  const shared = [...ga].filter((g) => gb.has(g) && g.split(" ").length === 8);
  if (shared.length) console.log(`     ch${chapters[a].number}↔ch${chapters[b].number}: ${shared.slice(0, 3).map((s) => `"${s}"`).join(" | ")}`);
}
