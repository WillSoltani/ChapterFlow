/**
 * End-to-end single-chapter pipeline — Phase 2 proof.
 *
 * Runs: editor-in-chief (cached) → planner (cached) → breakdown writer
 *     → example writers (parallel, N from plan) → critic → save output.
 *
 * Target: Thinking, Fast and Slow — Ch 5 Cognitive Ease.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/run-single-chapter.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runEditorInChief } from "../agents/editor-in-chief.js";
import { runCurriculumPlanner } from "../agents/curriculum-planner.js";
import { runWriterBreakdown, BreakdownOutput } from "../agents/writer-breakdown.js";
import { runWriterExample, ExampleOutput } from "../agents/writer-example.js";
import {
  BookBrief,
  ChapterDesignDoc,
  Example,
  UnitLocation,
} from "../types.js";
import {
  checkNoChapterNumberLiteral,
  checkNoMetaReference,
  checkBannedPhrases,
} from "../critics/register.js";
import {
  checkDecisionPoint,
  checkNamedProtagonist,
  checkSpecificScene,
} from "../critics/narrative.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../../state");

const BOOK = {
  bookId: "thinking-fast-and-slow",
  title: "Thinking, Fast and Slow",
  author: "Daniel Kahneman",
};
const CHAPTER = {
  chapterId: "thinking-fast-and-slow-ch05",
  number: 5,
  title: "Cognitive Ease",
};
const BREAKDOWN_TIERS = ["fastRead", "deepRead", "fullRead"] as const;

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function extractNames(scenario: string): string[] {
  const stop = new Set([
    "The","A","An","If","When","That","But","Chapter","Monday","Tuesday","Wednesday",
    "Thursday","Friday","Saturday","Sunday","She","He","They","It","This","And","Or",
    "So","Her","His","Then","Because","Before","After","While","Once","During","Without",
    "Within","Even","Only","Often","Now","Whenever","Here","There",
  ]);
  const raw = Array.from(scenario.matchAll(/\b[A-Z][a-z]{2,}\b/g)).map((m) => m[0]);
  return raw.filter((w) => !stop.has(w));
}

async function loadOrBuildBrief(): Promise<BookBrief> {
  const path = resolve(STATE, "briefs", `${BOOK.bookId}.brief.json`);
  if (existsSync(path)) {
    log(`brief: reusing cached ${path}`);
    return JSON.parse(readFileSync(path, "utf8")) as BookBrief;
  }
  log(`brief: generating (editor-in-chief, opus)…`);
  const brief = await runEditorInChief(BOOK);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(brief, null, 2), "utf8");
  return brief;
}

async function loadOrBuildPlan(brief: BookBrief): Promise<ChapterDesignDoc> {
  const path = resolve(STATE, "plans", `${CHAPTER.chapterId}.plan.json`);
  if (existsSync(path)) {
    log(`plan: reusing cached ${path}`);
    return JSON.parse(readFileSync(path, "utf8")) as ChapterDesignDoc;
  }
  log(`plan: generating (curriculum-planner, opus)…`);
  const plan = await runCurriculumPlanner({
    brief,
    chapterId: CHAPTER.chapterId,
    chapterNumber: CHAPTER.number,
    chapterTitle: CHAPTER.title,
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(plan, null, 2), "utf8");
  return plan;
}

async function main() {
  const overall = Date.now();

  // Step 1 + 2: brief + plan (cached on disk)
  const brief = await loadOrBuildBrief();
  const plan = await loadOrBuildPlan(brief);

  // Step 3: breakdown
  log(`breakdown: generating three tiers (opus)…`);
  const breakdown = await runWriterBreakdown({ brief, plan });
  log(`breakdown: done — fastRead=${breakdown.fastRead.length}c, deepRead=${breakdown.deepRead.length}c, fullRead=${breakdown.fullRead.length}c`);

  // Step 4: examples — sequential so each call sees names already chosen.
  // Takes ~15s per example × N examples. Parallelism is not worth name collisions.
  log(`examples: generating ${plan.exampleCount} sequentially (opus)…`);
  const examplesStart = Date.now();
  const successful: ExampleOutput[] = [];
  const failed: Array<{ i: number; err: string }> = [];
  const usedNames: string[] = [];
  for (let i = 0; i < plan.exampleSpecs.length; i++) {
    const spec = plan.exampleSpecs[i];
    let attempt = 0;
    let produced: ExampleOutput | null = null;
    let lastErr: string | null = null;
    while (attempt < 2 && !produced) {
      const t0 = Date.now();
      try {
        produced = await runWriterExample({ brief, plan, spec, specIndex: i, usedNames: [...usedNames] });
        log(`  example[${i}] "${produced.title}" (${((Date.now() - t0) / 1000).toFixed(1)}s${attempt > 0 ? `, retry ${attempt}` : ""})`);
      } catch (err) {
        lastErr = (err as Error).message;
        attempt += 1;
        log(`  example[${i}] attempt ${attempt} failed: ${lastErr}`);
      }
    }
    if (produced) {
      successful.push(produced);
      for (const n of extractNames(produced.scenario)) {
        if (!usedNames.includes(n)) usedNames.push(n);
      }
    } else {
      failed.push({ i, err: lastErr ?? "unknown" });
    }
  }
  log(`examples: ${successful.length}/${plan.exampleCount} passed validation (${((Date.now() - examplesStart) / 1000).toFixed(1)}s)`);

  // Detect intra-chapter name collisions across DIFFERENT examples
  const nameToIdx: Record<string, Set<number>> = {};
  successful.forEach((ex, i) => {
    for (const n of extractNames(ex.scenario)) {
      (nameToIdx[n] ||= new Set()).add(i);
    }
  });
  const collidingNames = Object.entries(nameToIdx).filter(([_, idxs]) => idxs.size > 1);
  if (collidingNames.length > 0) {
    log(`examples: name collisions detected: ${collidingNames.map(([n, idxs]) => `${n} (examples ${Array.from(idxs).sort().join(",")})`).join("; ")}`);
  } else {
    log(`examples: no intra-chapter name collisions`);
  }

  // Step 5: critic over outputs
  log(`critic: scoring outputs…`);
  const findings: Array<{ unit: string; findings: any[] }> = [];

  // Breakdown: register + banned-phrase
  for (const tier of BREAKDOWN_TIERS) {
    const text = breakdown[tier];
    const metaF = checkNoMetaReference(text);
    const chF = checkNoChapterNumberLiteral(text);
    const { findings: bannedF } = checkBannedPhrases(text);
    if (metaF.length + chF.length + bannedF.length > 0) {
      findings.push({ unit: `breakdown[${tier}]`, findings: [...metaF, ...chF, ...bannedF] });
    }
  }

  // Examples: all critics applicable to example
  const asExamples: Example[] = successful.map((ex, i) => ({
    exampleId: ex.exampleId,
    title: ex.title,
    category: "work",
    format: plan.exampleSpecs[i].format,
    contexts: [],
    scenario: ex.scenario,
    whatToDo: ex.whatToDo,
    whyItMatters: ex.whyItMatters,
  }));
  asExamples.forEach((ex, i) => {
    const f = [
      ...checkNamedProtagonist(ex),
      ...checkSpecificScene(ex),
      ...checkDecisionPoint(ex),
      ...checkNoMetaReference(ex.scenario + " " + (ex.whatToDo as string) + " " + (ex.whyItMatters as string)),
      ...checkNoChapterNumberLiteral(ex.scenario + " " + (ex.whatToDo as string) + " " + (ex.whyItMatters as string)),
      ...checkBannedPhrases(ex.scenario + " " + (ex.whatToDo as string) + " " + (ex.whyItMatters as string)).findings,
    ];
    if (f.length > 0) findings.push({ unit: `example[${i}] ${ex.title}`, findings: f });
  });

  if (findings.length === 0) {
    log(`critic: ALL CLEAR — every unit passed every check 🎯`);
  } else {
    log(`critic: ${findings.length} units have findings:`);
    for (const u of findings) {
      log(`  ${u.unit}`);
      for (const f of u.findings) {
        log(`    [${f.severity}] ${f.checkId}: ${f.message}`);
      }
    }
  }

  // Step 6: save
  const outPath = resolve(STATE, "chapters", `${CHAPTER.chapterId}.v21.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        chapterId: CHAPTER.chapterId,
        number: CHAPTER.number,
        title: CHAPTER.title,
        breakdown,
        examples: successful,
        criticFindings: findings,
        meta: {
          generatedAt: new Date().toISOString(),
          totalWallTimeSec: ((Date.now() - overall) / 1000).toFixed(1),
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  log(`saved: ${outPath}`);
  log(`total wall time: ${((Date.now() - overall) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
