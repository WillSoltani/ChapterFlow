/**
 * Scratch script — run the curriculum planner on Thinking Fast and Slow Ch 5.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runCurriculumPlanner } from "../agents/curriculum-planner.js";
import { BookBrief } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIEF_DIR = resolve(__dirname, "../../state/briefs");
const PLAN_DIR = resolve(__dirname, "../../state/plans");

async function main() {
  mkdirSync(PLAN_DIR, { recursive: true });
  const brief: BookBrief = JSON.parse(
    readFileSync(resolve(BRIEF_DIR, "thinking-fast-and-slow.brief.json"), "utf8"),
  );

  const started = Date.now();
  const plan = await runCurriculumPlanner({
    brief,
    chapterId: "thinking-fast-and-slow-ch05",
    chapterNumber: 5,
    chapterTitle: "Cognitive Ease",
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const outPath = resolve(PLAN_DIR, "thinking-fast-and-slow-ch05.plan.json");
  writeFileSync(outPath, JSON.stringify(plan, null, 2), "utf8");
  console.log(`Wrote ${outPath} in ${elapsed}s`);
  console.log("---");
  console.log(JSON.stringify(plan, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
