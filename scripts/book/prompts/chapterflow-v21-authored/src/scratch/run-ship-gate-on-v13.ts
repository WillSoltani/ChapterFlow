/**
 * Negative test: run the v21 ship gate against a v13 book chapter to confirm
 * the gate correctly detects v13's known failure modes.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/run-ship-gate-on-v13.ts <book-package.json> <chapter-number>
 */

import { readFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { runShipGate } from "../critics/finalGate.js";

const file = process.argv[2] ?? "book-packages/thinking-fast-and-slow.modern.json";
const chapterNum = parseInt(process.argv[3] ?? "5", 10);

const pkg = JSON.parse(readFileSync(resolve(file), "utf8"));
const v13ch = pkg.chapters.find((c: any) => c.number === chapterNum);
if (!v13ch) {
  console.error(`Chapter ${chapterNum} not found in ${file}`);
  process.exit(2);
}

// Project the v13 chapter into the v21 ChapterV21 shape — we just need the
// fields the gate inspects. Pull `direct` out of any toned fields.
function direct(v: any): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "direct" in v) return v.direct;
  return "";
}

const projected: ChapterV21 = {
  chapterId: v13ch.chapterId ?? `v13-ch${chapterNum}`,
  number: v13ch.number,
  title: v13ch.title,
  readingTimeMinutes: v13ch.readingTimeMinutes ?? 10,
  hook: "(none)",  // v13 has no hook field; this will trigger gate findings legitimately
  keyTakeaway: direct(v13ch.keyTakeawayCard) || "(none)",
  breakdown: {
    fastRead: direct(v13ch.contentVariants?.easy?.chapterBreakdown),
    deepRead: direct(v13ch.contentVariants?.medium?.chapterBreakdown),
    fullRead: direct(v13ch.contentVariants?.hard?.chapterBreakdown),
  },
  examples: (v13ch.examples ?? []).map((ex: any) => ({
    exampleId: ex.exampleId,
    title: ex.title,
    tags: Array.isArray(ex.contexts) ? ex.contexts.slice(0, 3) : [],
    planSpec: {
      domain: Array.isArray(ex.contexts) ? ex.contexts[0] ?? "" : "",
      audience: Array.isArray(ex.contexts) ? ex.contexts[1] ?? "" : "",
      stakes: Array.isArray(ex.contexts) ? ex.contexts[2] ?? "" : "",
      format: ex.format ?? "decision_point",
      requiredBeat: "(v13 has no requiredBeat field)",
    },
    scenario: direct(ex.scenario),
    whatToDo: direct(ex.whatToDo),
    whyItMatters: direct(ex.whyItMatters),
  })),
  quiz: {
    passingScorePercent: v13ch.quiz?.passingScorePercent ?? 70,
    questions: (v13ch.quiz?.questions ?? []).map((q: any) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices ?? [],
      correctIndex: q.correctIndex ?? q.correctAnswerIndex ?? 0,
      explanation: direct(q.explanation),
      bloomsLevel: q.bloomsLevel,
      depthLevel: q.depthLevel,
    })),
  },
  reviewCards: (v13ch.reviewCards ?? []).map((c: any) => ({
    cardId: c.cardId,
    front: direct(c.front),
    back: direct(c.back),
    difficulty: c.difficulty ?? "medium",
  })),
  implementationPlan: {
    coreSkill: direct(v13ch.implementationPlan?.coreSkill),
    ifThenPlans: (v13ch.implementationPlan?.ifThenPlans ?? []).map((it: any) => ({
      context: it.context,
      plan: direct(it.plan),
    })),
    twentyFourHourChallenge: direct(v13ch.implementationPlan?.twentyFourHourChallenge),
    weeklyPractice: direct(v13ch.implementationPlan?.weeklyPractice),
  },
};

const report = runShipGate(projected);
console.log(`Ship gate against v13 ${file} ch${chapterNum}:`);
console.log(`  passed: ${report.passed}`);
console.log(`  blockers: ${report.summary.blockersCount}`);
console.log(`  majors: ${report.summary.majorsCount}`);
console.log(`  minors: ${report.summary.minorsCount}`);
console.log("");
const byCatalog: Record<string, number> = {};
for (const f of [...report.blockers, ...report.majors, ...report.minors]) {
  byCatalog[f.catalogId] = (byCatalog[f.catalogId] ?? 0) + 1;
}
console.log("Findings by catalog ID:");
for (const [id, count] of Object.entries(byCatalog).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id}: ${count}`);
}
console.log("");
console.log("First 8 blocker findings:");
for (const f of report.blockers.slice(0, 8)) {
  console.log(`  [${f.catalogId}] ${f.unit}: ${f.message}`);
}
