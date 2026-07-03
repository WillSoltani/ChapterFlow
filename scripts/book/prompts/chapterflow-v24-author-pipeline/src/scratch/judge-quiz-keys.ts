/**
 * Runner: judge the quiz answer keys of one chapter with the LIVE model.
 *
 * Usage:
 *   npx tsx src/scratch/judge-quiz-keys.ts state/chapters/<book>-chNN.v21-native.chapter.json
 *   npx tsx src/scratch/judge-quiz-keys.ts ../../../../book-packages/atomic-habits.v21.json 0
 *
 * Provider: defaults to openai-api (set CHAPTERFLOW_PROVIDER / pass a configured
 * key). Exits 1 if any question is flagged as a wrong key, 0 otherwise, 2 on a
 * provider/infra error (fail-OPEN: an infra failure must never masquerade as a
 * clean semantic pass).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { judgeQuizKeys, makeLiveAskModel, formatQuizKeyReport } from "../critics/semantic/quizKeyJudge.js";
import type { ChapterV21 } from "../types.js";
import type { ProviderName } from "../providers/types.js";

async function main() {
  const [fileArg, chapterNumArg] = process.argv.slice(2);
  if (!fileArg) {
    console.error("Usage: judge-quiz-keys <chapter.json | book-package.json> [chapterIndex]");
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(resolve(fileArg), "utf8"));
  let chapter: ChapterV21;
  if (Array.isArray(raw.chapters)) {
    const idx = chapterNumArg ? Number(chapterNumArg) : 0;
    chapter = raw.chapters[idx];
    if (!chapter) {
      console.error(`book package has no chapter at index ${idx}`);
      process.exit(2);
    }
  } else {
    chapter = raw;
  }

  const provider = (process.env.CHAPTERFLOW_PROVIDER as ProviderName) || "openai-api";
  console.log(`Judging quiz answer keys for ${chapter.chapterId} via provider=${provider}...\n`);

  try {
    const report = await judgeQuizKeys(chapter, { ask: makeLiveAskModel({ provider }) });
    console.log(formatQuizKeyReport(report));
    process.exit(report.flagged.length === 0 ? 0 : 1);
  } catch (err) {
    // Fail OPEN on infra, with a loud distinct marker so this is never mistaken
    // for a semantic PASS.
    console.error("\n⚠️  SEMANTIC JUDGE DID NOT RUN — provider/infra error (NOT a pass):");
    console.error("   " + (err as Error).message);
    console.error("   Set a funded ANTHROPIC_API_KEY or OPENAI_API_KEY (or CHAPTERFLOW_PROVIDER) and retry.");
    process.exit(2);
  }
}

main();
