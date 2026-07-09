/* CF-I-4 prose hand-edits (loud fallback — the canonical surgical lane vetoes prose).
 * Parses each chapter, replaces ONLY the named field substring (asserts the old text is
 * present), re-serializes in the pipeline's canonical format (JSON.stringify(...,2)+"\n"),
 * then re-runs C34/C33 to confirm the target cleared. sourceAnchorIds/quiz/schema untouched.
 *   npx tsx src/scratch/cf-i-4-prose.ts [--apply]
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { checkCitationDateDoorway } from "../critics/citationDateDoorway.js";
import { beatFamiliesInChapter } from "../critics/beatVocabularyEcho.js";
import type { ChapterV21 } from "../types.js";

const APPLY = process.argv.includes("--apply");
const DIR = resolve(import.meta.dirname, "../../state/chapters");
const path = (n: number) => resolve(DIR, `multipliers-ch0${n}.v21-native.chapter.json`);

type Edit = { field: "hook" | "fastRead" | "fullRead"; find: string; replace: string; why: string };
const EDITS: Record<number, Edit[]> = {
  1: [
    {
      field: "fastRead",
      find: "Harvard Business Review (a May 2010 management article venue) gives the early mark: Liz Wiseman and Greg McKeown had already made the Diminisher and Multiplier contrast public.",
      replace: "In a May 2010 Harvard Business Review article, Liz Wiseman made the Diminisher and Multiplier contrast public with Greg McKeown — the early mark.",
      why: "C34: person (Wiseman) acts before the date, not an org citation standing in for a scene.",
    },
  ],
  2: [
    {
      field: "fastRead",
      find: "What breaks first when Microsoft, the company Satya Nadella began leading as CEO in 2014, turns talent into a culture test?",
      replace: "Satya Nadella took over as Microsoft's CEO in 2014 and turned talent into a culture test.",
      why: "C34: open on Nadella acting, not a question about the company with the date buried in a clause.",
    },
  ],
  5: [
    {
      field: "fastRead",
      find: "1986 is the number product lead Janelle writes before anyone states a preference.",
      replace: "On the launch review, Janelle writes 1986 before anyone states a preference.",
      why: "C34: Janelle acts at the year, not a bare year opening the sentence.",
    },
  ],
  6: [
    {
      field: "fullRead",
      find: "the help given, the choice owned, and the return point.",
      replace: "the help given, the choice owned, and the moment you will check whether they can carry it alone.",
      why: "C33: render the return beat instead of naming the dealt label 'return point'.",
    },
    {
      field: "hook",
      find: "No one knew who would bring back proof.",
      replace: "No one had said who would return with the evidence.",
      why: "hook clone: break the ch01/ch06 verbatim 8-gram (advisory, below the >=3 aphorism threshold).",
    },
  ],
  7: [
    {
      field: "fastRead",
      find: "Set a return point.",
      replace: "Decide when you will hand the call back to them.",
      why: "C33: render the return beat instead of naming 'return point'.",
    },
  ],
};

let failures = 0;
for (const [nStr, edits] of Object.entries(EDITS)) {
  const n = parseInt(nStr, 10);
  const raw = readFileSync(path(n), "utf8");
  const ch = JSON.parse(raw) as ChapterV21 & { breakdown: any };
  for (const e of edits) {
    const container = e.field === "hook" ? ch : ch.breakdown;
    const key = e.field === "hook" ? "hook" : e.field;
    const cur = String((container as any)[key] ?? "");
    if (!cur.includes(e.find)) {
      console.log(`❌ ch0${n}.${e.field}: OLD TEXT NOT FOUND — ${JSON.stringify(e.find.slice(0, 60))}`);
      failures++;
      continue;
    }
    (container as any)[key] = cur.replace(e.find, e.replace);
    console.log(`✏️  ch0${n}.${e.field}: ${e.why}`);
  }
  // verify detectors on the mutated in-memory chapter
  const c34 = checkCitationDateDoorway(ch as ChapterV21).length;
  const fams = beatFamiliesInChapter(ch as ChapterV21);
  console.log(`   → after edit: C34=${c34} beatFamilies=[${fams.join(",")}]`);
  if (APPLY && !failures) writeFileSync(path(n), JSON.stringify(ch, null, 2) + "\n");
}
console.log(APPLY ? (failures ? `\n⚠ ${failures} edits FAILED — no partial writes trusted` : "\n✅ applied") : "\n(dry run — pass --apply to write)");
