/**
 * Scratch script — run the editor-in-chief on Thinking, Fast and Slow and
 * print the result. Used during development to iterate on the prompt.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/run-editor.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runEditorInChief } from "../agents/editor-in-chief.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../state/briefs");

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const started = Date.now();
  const brief = await runEditorInChief({
    bookId: "thinking-fast-and-slow",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const outPath = resolve(OUT_DIR, "thinking-fast-and-slow.brief.json");
  writeFileSync(outPath, JSON.stringify(brief, null, 2), "utf8");
  console.log(`Wrote ${outPath} in ${elapsed}s`);
  console.log("---");
  console.log(JSON.stringify(brief, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
