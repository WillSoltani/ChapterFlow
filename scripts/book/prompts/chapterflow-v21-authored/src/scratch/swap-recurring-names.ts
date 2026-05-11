/**
 * One-shot fix for cross-chapter protagonist name duplication caught by the
 * sharpened bookGate F1 check. Runs find/replace on a specific (chapter,
 * exampleId, oldName, newName) tuple set, in both the book package and the
 * corresponding state/chapters/<chapterId>.v21-native.chapter.json sidecars.
 *
 * Targeted at the HWF v21 package's known recurrences (Bram, Hollis, Ingrid).
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/swap-recurring-names.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../../..");
const STATE_CHAPTERS = resolve(__dirname, "../../state/chapters");

type Swap = {
  bookId: string;
  chapterNumber: number;
  exampleIdPrefix: string;       // matches the chN-exNN- prefix; the rest of the id may change as we rename
  oldName: string;
  newName: string;
};

const SWAPS: Swap[] = [
  { bookId: "how-to-win-friends-and-influence-people", chapterNumber: 11, exampleIdPrefix: "ch11-ex06", oldName: "Bram",   newName: "Soren"  },
  { bookId: "how-to-win-friends-and-influence-people", chapterNumber: 9,  exampleIdPrefix: "ch09-ex02", oldName: "Hollis", newName: "Tomek"  },
  { bookId: "how-to-win-friends-and-influence-people", chapterNumber: 20, exampleIdPrefix: "ch20-ex02", oldName: "Ingrid", newName: "Yannis" },
  // atomic-habits: Soren appears in ch12 and ch18 — rename in ch18
  { bookId: "atomic-habits", chapterNumber: 18, exampleIdPrefix: "ch18-ex03", oldName: "Soren", newName: "Bastian" },
];

function swapInString(s: string, oldName: string, newName: string): string {
  return s.replace(new RegExp(`\\b${oldName}\\b`, "g"), newName);
}

/**
 * Walk the example object and replace oldName → newName in every string
 * leaf. exampleId gets a slug-level rewrite if the lowercased oldName is in it.
 */
function swapInExample(ex: any, oldName: string, newName: string): any {
  const out: any = {};
  for (const key of Object.keys(ex)) {
    const v = ex[key];
    if (typeof v === "string") {
      out[key] = swapInString(v, oldName, newName);
    } else if (Array.isArray(v)) {
      out[key] = v.map((item) =>
        typeof item === "string"
          ? swapInString(item, oldName, newName)
          : typeof item === "object" && item !== null
            ? swapInExample(item, oldName, newName)
            : item,
      );
    } else if (typeof v === "object" && v !== null) {
      out[key] = swapInExample(v, oldName, newName);
    } else {
      out[key] = v;
    }
  }
  // Slug-level rewrite on exampleId if it contains the old lowercased name
  if (typeof out.exampleId === "string") {
    const oldSlug = oldName.toLowerCase();
    const newSlug = newName.toLowerCase();
    out.exampleId = out.exampleId.replace(new RegExp(`-${oldSlug}-`, "g"), `-${newSlug}-`);
  }
  return out;
}

function swapInChapter(chapter: any, swap: Swap): { chapter: any; touched: boolean } {
  let touched = false;
  const newExamples = chapter.examples.map((ex: any) => {
    if (typeof ex.exampleId !== "string" || !ex.exampleId.startsWith(swap.exampleIdPrefix)) return ex;
    const reBefore = new RegExp(`\\b${swap.oldName}\\b`);
    const exStr = JSON.stringify(ex);
    if (!reBefore.test(exStr)) return ex;
    touched = true;
    return swapInExample(ex, swap.oldName, swap.newName);
  });
  return { chapter: { ...chapter, examples: newExamples }, touched };
}

function main() {
  const byBook = new Map<string, Swap[]>();
  for (const s of SWAPS) {
    if (!byBook.has(s.bookId)) byBook.set(s.bookId, []);
    byBook.get(s.bookId)!.push(s);
  }

  for (const [bookId, swaps] of byBook) {
    const pkgPath = resolve(REPO_ROOT, "book-packages", `${bookId}.v21.json`);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

    for (const swap of swaps) {
      const idx = pkg.chapters.findIndex((c: any) => c.number === swap.chapterNumber);
      if (idx < 0) {
        console.error(`No chapter ${swap.chapterNumber} in ${bookId}`);
        continue;
      }
      const { chapter, touched } = swapInChapter(pkg.chapters[idx], swap);
      if (!touched) {
        console.warn(`No example matched ${swap.exampleIdPrefix}* in ${bookId} ch${swap.chapterNumber}`);
        continue;
      }
      pkg.chapters[idx] = chapter;

      const sidecarPath = resolve(STATE_CHAPTERS, `${bookId}-ch${String(swap.chapterNumber).padStart(2, "0")}.v21-native.chapter.json`);
      try {
        const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8"));
        const { chapter: sidecarChapter } = swapInChapter(sidecar, swap);
        writeFileSync(sidecarPath, JSON.stringify(sidecarChapter, null, 2), "utf8");
      } catch (err) {
        console.warn(`Could not patch sidecar for ch${swap.chapterNumber}: ${(err as Error).message}`);
      }

      console.log(`  ${bookId} ch${swap.chapterNumber}: ${swap.oldName} → ${swap.newName} (in ${swap.exampleIdPrefix})`);
    }

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
    console.log(`wrote ${pkgPath}`);
  }
}

main();
