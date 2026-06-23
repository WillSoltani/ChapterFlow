/**
 * Full single-chapter pipeline (v21-native).
 *
 * Pipeline:
 *   editor-in-chief (cached) → planner (cached) → hook + breakdown in parallel
 *      → examples (sequential for name dedup) → quiz + cards + plan + takeaway
 *      → critics → assemble v21-native JSON → save.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/run-full-chapter.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runEditorInChief } from "../agents/editor-in-chief.js";
import { runCurriculumPlanner } from "../agents/curriculum-planner.js";
import { runWriterBreakdown } from "../agents/writer-breakdown.js";
import { runWriterExample, ExampleOutput } from "../agents/writer-example.js";
import { runWriterQuiz } from "../agents/writer-quiz.js";
import { runWriterCards } from "../agents/writer-cards.js";
import { runWriterImplementationPlan } from "../agents/writer-implementation-plan.js";
import { runWriterHook } from "../agents/writer-hook.js";
import { runVoicePass } from "../agents/voice-pass.js";
import { runExampleCurator } from "../curator/exampleSelector.js";
import { loadSourceBundle } from "../source-loader.js";
import {
  getForbiddenNames,
  ingestChapter,
  loadLibraryState,
  saveLibraryState,
} from "../librarian/libraryState.js";
import { callClaude } from "../claudeClient.js";
import { assembleChapterV21, V21_SCHEMA_VERSION } from "../assembler.js";
import {
  BookBrief,
  ChapterDesignDoc,
} from "../types.js";
import {
  checkCadenceVariance,
  checkClosingLineLandings,
  checkCrossTierPhraseUniqueness,
  checkOpeningConcreteness,
  checkParagraphStartVariety,
  checkTiersProgressive,
} from "../critics/prose.js";
import { checkNoMetaReference, checkNoChapterNumberLiteral, checkBannedPhrases, checkNoEmDash } from "../critics/register.js";
import { checkReadingLevel, fleschKincaid } from "../critics/readingLevel.js";

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

async function loadOrBuild<T>(filePath: string, generator: () => Promise<T>, label: string): Promise<T> {
  if (existsSync(filePath)) {
    log(`${label}: reusing cached`);
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  }
  log(`${label}: generating…`);
  const val = await generator();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(val, null, 2), "utf8");
  return val;
}

async function generateKeyTakeaway(brief: BookBrief, plan: ChapterDesignDoc, deepRead: string): Promise<string> {
  const result = await callClaude<{ keyTakeaway: string }>({
    tier: "writer",
    system: `You write one-sentence key takeaways. Output a single JSON object: { "keyTakeaway": "..." }. The takeaway is ONE sentence, 140–220 characters, teaching the chapter's core move directly. No meta-references ("the chapter", "the author", "Chapter N"), no banned phrases ("That matters because", "boundary condition", etc.). No em dashes (—) anywhere — use commas, periods, or a semicolon. Plain words.`,
    user: `# Brief voice charter\n${JSON.stringify(brief.voiceCharter, null, 2)}\n\n# Chapter coreMove\n${plan.coreMove}\n\n# Chapter title\n${plan.title}\n\n# Deep-read breakdown\n${deepRead}\n\nWrite the JSON now.`,
    jsonMode: true,
    maxTokens: 400,
    temperature: 0.6,
    timeoutMs: 60_000,
  });
  const kt = result.content.keyTakeaway;
  if (!kt || kt.length < 100 || kt.length > 300) {
    throw new Error(`keyTakeaway length invalid (${kt?.length})`);
  }
  return kt;
}

async function main() {
  const overall = Date.now();

  const brief = await loadOrBuild<BookBrief>(
    resolve(STATE, "briefs", `${BOOK.bookId}.brief.json`),
    () => runEditorInChief(BOOK),
    "brief",
  );

  // The planner prompt changed (wider format palette); invalidate the cached plan.
  const planPath = resolve(STATE, "plans", `${CHAPTER.chapterId}.plan.json`);
  if (existsSync(planPath)) {
    const cached = JSON.parse(readFileSync(planPath, "utf8")) as ChapterDesignDoc;
    const allFormats = new Set(cached.exampleSpecs.map((s) => s.format));
    if (allFormats.size < 3) {
      log(`plan: cached plan uses only ${allFormats.size} format(s) — regenerating for variety`);
      const { unlinkSync } = await import("fs");
      unlinkSync(planPath);
    }
  }
  const plan = await loadOrBuild<ChapterDesignDoc>(
    planPath,
    () => runCurriculumPlanner({
      brief,
      chapterId: CHAPTER.chapterId,
      chapterNumber: CHAPTER.number,
      chapterTitle: CHAPTER.title,
    }),
    "plan",
  );
  log(`plan: ${plan.exampleCount} examples, formats: ${Array.from(new Set(plan.exampleSpecs.map((s) => s.format))).join(", ")}`);

  // Source freeze, if available — a small grounding nudge for the writer.
  const source = loadSourceBundle(BOOK.bookId, CHAPTER.number);
  if (source.available) {
    log(`source: ch${CHAPTER.number} source metadata loaded (${source.chapterSource?.length ?? 0}c)`);
  } else {
    log(`source: no source-freeze bundle available for this book; writer uses world knowledge only`);
  }

  // Hook + breakdown in parallel
  log(`hook + breakdown: generating in parallel…`);
  const [hook, draftBreakdown] = await Promise.all([
    runWriterHook({ brief, plan }),
    runWriterBreakdown({ brief, plan, chapterSource: source.chapterSource ?? undefined }),
  ]);
  log(`hook: "${hook.hook}"`);
  log(`draft breakdown: fastRead=${draftBreakdown.fastRead.length}c, deepRead=${draftBreakdown.deepRead.length}c, fullRead=${draftBreakdown.fullRead.length}c`);

  // Voice pass — iterative, up to 3 passes. After each pass, re-run prose
  // critics. If there are findings, feed them back as targeted guidance.
  log(`voice pass: iterating toward voice specimens (max 3 iterations)…`);
  let breakdown = await runVoicePass({ brief, plan, draft: draftBreakdown });
  log(`voice pass iter 1: fastRead=${breakdown.fastRead.length}c, deepRead=${breakdown.deepRead.length}c, fullRead=${breakdown.fullRead.length}c`);

  const runProseChecksOnBreakdown = (b: typeof breakdown): string[] => {
    const issues: string[] = [];
    for (const [tierName, tierText] of [["fastRead", b.fastRead], ["deepRead", b.deepRead], ["fullRead", b.fullRead]] as const) {
      for (const f of checkClosingLineLandings(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      for (const f of checkReadingLevel(tierText, tierName as any)) issues.push(f.message);
      for (const f of checkOpeningConcreteness(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      for (const f of checkParagraphStartVariety(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      for (const f of checkCadenceVariance(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
    }
    const allow = [plan.title, ...plan.coreMove.split(/\s+/).filter((w) => w.length > 4).slice(0, 3)];
    for (const f of checkCrossTierPhraseUniqueness({ fastRead: b.fastRead, deepRead: b.deepRead, fullRead: b.fullRead }, allow, "breakdown")) issues.push(f.message);
    // Em dash catch (belt-and-braces)
    for (const [tierName, tierText] of [["fastRead", b.fastRead], ["deepRead", b.deepRead], ["fullRead", b.fullRead]] as const) {
      if (tierText.includes("\u2014")) issues.push(`${tierName}: contains em dash — rewrite without it`);
    }
    return issues;
  };

  for (let iter = 2; iter <= 3; iter++) {
    const issues = runProseChecksOnBreakdown(breakdown);
    if (issues.length === 0) {
      log(`voice pass: clean after iter ${iter - 1}, stopping`);
      break;
    }
    log(`voice pass iter ${iter}: ${issues.length} findings to address, re-running…`);
    for (const msg of issues.slice(0, 5)) log(`    ${msg}`);
    try {
      breakdown = await runVoicePass({ brief, plan, draft: breakdown, priorFindings: issues });
    } catch (err) {
      log(`voice pass iter ${iter} failed: ${(err as Error).message} — keeping previous output`);
      break;
    }
  }

  // Load the library state and compute forbidden names across recent books.
  // Writers receive both: the in-chapter usedNames (dedup within this chapter)
  // and the library-wide forbidden list (no Ingrid in every book).
  const libraryState = loadLibraryState();
  const libraryForbidden = getForbiddenNames(libraryState, BOOK.bookId, 10);
  log(`librarian: library state has ${Object.keys(libraryState.books).length} books; ${libraryForbidden.length} protagonist names from recent books are off-limits`);

  // Examples — over-generate 3 candidates per spec in parallel, curator picks
  // the winner. Sequential across slots so names can be deduped per chapter.
  const CANDIDATES_PER_SLOT = 3;
  log(`examples: over-generating ${plan.exampleCount} × ${CANDIDATES_PER_SLOT} candidates with curator…`);
  const examples: ExampleOutput[] = [];
  const usedNames: string[] = [...libraryForbidden];
  for (let i = 0; i < plan.exampleSpecs.length; i++) {
    const spec = plan.exampleSpecs[i];

    // Fire CANDIDATES_PER_SLOT candidates in parallel. Each one may fail
    // validation; survivors go to the curator. Fall back to regen if <2 survive.
    const t0 = Date.now();
    const candidatePromises = Array.from({ length: CANDIDATES_PER_SLOT }, (_, k) =>
      runWriterExample({ brief, plan, spec, specIndex: i, usedNames: [...usedNames] })
        .then((ex) => ({ ok: true as const, ex, k }))
        .catch((err) => ({ ok: false as const, err: (err as Error).message, k })),
    );
    const settled = await Promise.all(candidatePromises);
    const candidates = settled.filter((s): s is { ok: true; ex: ExampleOutput; k: number } => s.ok).map((s) => s.ex);
    if (candidates.length === 0) {
      throw new Error(`example[${i}] all ${CANDIDATES_PER_SLOT} candidates failed validation`);
    }

    let winner: ExampleOutput;
    let curateNote = "";
    if (candidates.length === 1) {
      winner = candidates[0];
      curateNote = "only 1 candidate survived validation, no curation needed";
    } else {
      const curated = await runExampleCurator({ brief, plan, spec, candidates });
      winner = candidates[curated.winnerIndex];
      curateNote = `picked [${curated.winnerIndex}/${candidates.length}]: ${curated.reason}`;
    }
    examples.push(winner);
    for (const n of extractNames(winner.scenario)) if (!usedNames.includes(n)) usedNames.push(n);
    log(`  example[${i}] [${spec.format}] "${winner.title}" — ${curateNote} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  // Quiz + cards + implementation plan + key takeaway in parallel
  log(`quiz + cards + impl-plan + takeaway: generating in parallel…`);
  const [quiz, cards, ipPlan, keyTakeaway] = await Promise.all([
    runWriterQuiz({ brief, plan, breakdown: { easy: breakdown.fastRead, medium: breakdown.deepRead, hard: breakdown.fullRead } as any }),
    runWriterCards({ brief, plan, breakdown: { easy: breakdown.fastRead, medium: breakdown.deepRead, hard: breakdown.fullRead } as any }),
    runWriterImplementationPlan({ brief, plan, breakdown: { easy: breakdown.fastRead, medium: breakdown.deepRead, hard: breakdown.fullRead } as any }),
    generateKeyTakeaway(brief, plan, breakdown.deepRead),
  ]);
  log(`quiz: ${quiz.questions.length} questions`);
  log(`cards: ${cards.cards.length} cards`);
  log(`implementation plan: ${ipPlan.ifThenPlans.length} if-thens`);
  log(`key takeaway: ${keyTakeaway.length}c`);

  // Assemble v21-native chapter
  const chapter = assembleChapterV21({ plan, breakdown, examples, quiz, cards, implementationPlan: ipPlan, keyTakeaway, hook });

  // Prose-quality critics (advisory)
  log(`prose critics: scoring…`);
  const proseFindings: string[] = [];
  for (const [tierName, tierText] of [["fastRead", breakdown.fastRead], ["deepRead", breakdown.deepRead], ["fullRead", breakdown.fullRead]] as const) {
    const grade = fleschKincaid(tierText);
    log(`  ${tierName}: FK grade ${grade}`);
    for (const f of checkOpeningConcreteness(tierText, `breakdown[${tierName}]`)) proseFindings.push(`${f.severity}: ${f.message}`);
    for (const f of checkParagraphStartVariety(tierText, `breakdown[${tierName}]`)) proseFindings.push(`${f.severity}: ${f.message}`);
    for (const f of checkCadenceVariance(tierText, `breakdown[${tierName}]`)) proseFindings.push(`${f.severity}: ${f.message}`);
    for (const f of checkReadingLevel(tierText, tierName)) proseFindings.push(`${f.severity}: ${f.message}`);
    for (const f of checkClosingLineLandings(tierText, `breakdown[${tierName}]`)) proseFindings.push(`${f.severity}: ${f.message}`);
  }
  // Cross-tier phrase uniqueness (ignore the chapter concept name)
  const conceptAllowlist = [plan.title, ...plan.coreMove.split(/\s+/).filter((w) => w.length > 4).slice(0, 3)];
  for (const f of checkCrossTierPhraseUniqueness(
    { fastRead: breakdown.fastRead, deepRead: breakdown.deepRead, fullRead: breakdown.fullRead },
    conceptAllowlist,
    "breakdown",
  )) proseFindings.push(`${f.severity}: ${f.message}`);
  for (const f of checkTiersProgressive({ fastRead: breakdown.fastRead, deepRead: breakdown.deepRead, fullRead: breakdown.fullRead }, "breakdown")) {
    proseFindings.push(`${f.severity}: ${f.message}`);
  }
  // Register critics on the whole breakdown
  for (const [tierName, tierText] of [["fastRead", breakdown.fastRead], ["deepRead", breakdown.deepRead], ["fullRead", breakdown.fullRead]] as const) {
    for (const f of checkNoMetaReference(tierText)) proseFindings.push(`[breakdown ${tierName}] ${f.severity}: ${f.message}`);
    for (const f of checkNoChapterNumberLiteral(tierText)) proseFindings.push(`[breakdown ${tierName}] ${f.severity}: ${f.message}`);
    for (const f of checkBannedPhrases(tierText).findings) proseFindings.push(`[breakdown ${tierName}] ${f.severity}: ${f.message}`);
    for (const f of checkNoEmDash(tierText)) proseFindings.push(`[breakdown ${tierName}] ${f.severity}: ${f.message}`);
  }
  // Em-dash check across all other generated text
  const allText = [
    hook.hook, hook.counterintuition ?? "", keyTakeaway,
    ...examples.flatMap((e) => [e.scenario, e.whatToDo, e.whyItMatters]),
    ...quiz.questions.flatMap((q) => [q.prompt, q.explanation, ...q.choices]),
    ...cards.cards.flatMap((c) => [c.front, c.back]),
    ipPlan.coreSkill, ipPlan.twentyFourHourChallenge, ipPlan.weeklyPractice,
    ...ipPlan.ifThenPlans.map((p) => p.plan),
  ];
  let emDashHits = 0;
  for (const t of allText) if (t && t.includes("\u2014")) emDashHits += 1;
  if (emDashHits > 0) {
    proseFindings.push(`[em-dash audit] ${emDashHits} fields contain em dashes`);
  }
  if (proseFindings.length === 0) {
    log(`prose critics: CLEAN`);
  } else {
    log(`prose critics: ${proseFindings.length} findings`);
    for (const f of proseFindings) log(`  ${f}`);
  }

  // Wrap as a v21 BookPackage
  const pkg = {
    schemaVersion: V21_SCHEMA_VERSION,
    packageId: `${BOOK.bookId}-v21-preview`,
    createdAt: new Date().toISOString(),
    contentOwner: "chapterflow",
    book: { bookId: BOOK.bookId, title: BOOK.title, author: BOOK.author },
    chapters: [chapter],
  };

  const outDir = resolve(STATE, "chapters");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, `${CHAPTER.chapterId}.v21-native.chapter.json`), JSON.stringify(chapter, null, 2), "utf8");
  writeFileSync(resolve(outDir, `${CHAPTER.chapterId}.v21-native.package.json`), JSON.stringify(pkg, null, 2), "utf8");
  log(`wrote ${CHAPTER.chapterId}.v21-native.chapter.json`);

  // Librarian: ingest this chapter into the library state so future books see it.
  const updatedState = ingestChapter(libraryState, BOOK.bookId, BOOK.title, BOOK.author, chapter);
  await saveLibraryState(updatedState);
  const book = updatedState.books[BOOK.bookId];
  log(`librarian: ingested ch${chapter.number} — book has ${book.namesUsed.length} unique names, ${book.chaptersIngested.length} chapters ingested`);

  log(`total wall time: ${((Date.now() - overall) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
