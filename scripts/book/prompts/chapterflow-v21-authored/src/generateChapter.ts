/**
 * Core "generate one chapter" function. Extracted from the scratch
 * single-chapter runner so a multi-chapter driver can call it in a loop.
 *
 * Responsibilities:
 *   - run editor-in-chief (cached per book)
 *   - run curriculum planner (cached per chapter)
 *   - run hook + breakdown in parallel
 *   - iterative voice pass (up to 3 rounds)
 *   - over-generate 3× example candidates per slot, curator picks winner
 *   - quiz + cards + implementation plan + key takeaway in parallel
 *   - assemble v21-native chapter
 *   - ingest chapter into library state (cross-book ledger)
 *
 * The caller provides book metadata and a chapter spec. The function returns
 * the assembled ChapterV21 and persists side-effect files under state/.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runEditorInChief, applyAuthorVoiceProfile } from "./agents/editor-in-chief.js";
import { runCurriculumPlanner } from "./agents/curriculum-planner.js";
import { runWriterBreakdown } from "./agents/writer-breakdown.js";
import { runWriterExample, ExampleOutput } from "./agents/writer-example.js";
import { runWriterQuiz } from "./agents/writer-quiz.js";
import { runWriterCards } from "./agents/writer-cards.js";
import { runWriterImplementationPlan } from "./agents/writer-implementation-plan.js";
import { runWriterHook } from "./agents/writer-hook.js";
import { runVoicePass } from "./agents/voice-pass.js";
import { runLineEditor } from "./agents/line-editor.js";
import { runMemorableLines } from "./agents/memorable-lines.js";
import { runTryThisNow } from "./agents/try-this-now.js";
import { runExampleCurator } from "./curator/exampleSelector.js";
import { loadSourceBundle } from "./source-loader.js";
import {
  getForbiddenNames,
  ingestChapter as ingestIntoLibrary,
  loadLibraryState,
  withLibraryState,
  extractNamesFromText,
} from "./librarian/libraryState.js";
import { callClaude } from "./claudeClient.js";
import { assembleChapterV21, V21_SCHEMA_VERSION } from "./assembler.js";
import { sanitizeBriefForWriter } from "./lib/brief-sanitizer.js";
import { BookBrief, BookPackageV21, ChapterDesignDoc, ChapterV21, PriorChapterShapes } from "./types.js";
import {
  checkCadenceVariance,
  checkClosingLineLandings,
  checkCrossTierPhraseUniqueness,
  checkOpeningConcreteness,
  checkParagraphStartVariety,
} from "./critics/prose.js";
import { checkReadingLevel, fleschKincaid } from "./critics/readingLevel.js";
import { runShipGate, formatGateReport } from "./critics/finalGate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../state");

export type BookMeta = {
  bookId: string;
  title: string;
  author: string;
};

export type ChapterSpec = {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
};

export type GenerateChapterOptions = {
  logger?: (msg: string) => void;
  candidatesPerSlot?: number;
  voicePassMaxIterations?: number;
  /** Hook first-words + counter shapes of every prior chapter in this book.
   *  Used by the hook/breakdown writers to diversify away from over-used
   *  templates. Passed through by generateBook from in-memory state plus
   *  any resumed cached chapters. */
  priorChapterShapes?: PriorChapterShapes;
};

async function loadOrBuild<T>(
  filePath: string,
  generator: () => Promise<T>,
  label: string,
  log: (m: string) => void,
): Promise<T> {
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
    system: `You write one-sentence key takeaways. Output a single JSON object: { "keyTakeaway": "..." }. The takeaway is ONE sentence, 140–220 characters, teaching the chapter's core move directly. No meta-references ("the chapter", "the author", "Chapter N"), no banned phrases ("That matters because", "boundary condition", etc.). No em dashes (—) anywhere, use commas, periods, or a semicolon. Plain words.`,
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

export async function generateChapter(
  book: BookMeta,
  chapter: ChapterSpec,
  options: GenerateChapterOptions = {},
): Promise<ChapterV21> {
  const log = options.logger ?? ((m: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${m}`);
  });
  const CANDIDATES_PER_SLOT = options.candidatesPerSlot ?? 3;
  const VOICE_PASS_MAX = options.voicePassMaxIterations ?? 3;
  const overall = Date.now();

  // Resume: if this chapter's output already exists AND it's ingested in the
  // library ledger, skip regeneration and return the cached chapter.
  const chapterOutPath = resolve(STATE, "chapters", `${chapter.chapterId}.v21-native.chapter.json`);
  if (existsSync(chapterOutPath)) {
    const cached = JSON.parse(readFileSync(chapterOutPath, "utf8")) as ChapterV21;
    let alreadyIngested = false;
    await withLibraryState((state) => {
      const existingBook = state.books[book.bookId];
      alreadyIngested = !!existingBook?.chaptersIngested.includes(chapter.chapterNumber);
      if (!alreadyIngested) {
        ingestIntoLibrary(state, book.bookId, book.title, book.author, cached);
      }
    });
    if (alreadyIngested) {
      log(`resume: ${chapter.chapterId} already generated AND ingested — skipping`);
    } else {
      log(`resume: ${chapter.chapterId} output exists but not ingested — ingesting and skipping regen`);
    }
    return cached;
  }

  const briefFromDisk = await loadOrBuild<BookBrief>(
    resolve(STATE, "briefs", `${book.bookId}.brief.json`),
    () => runEditorInChief(book),
    `brief[${book.bookId}]`,
    log,
  );
  // Always re-apply the author-voice profile to the loaded brief. If the
  // brief was cached before the profile was updated (or before the profile
  // existed at all), this merges any new `avoidFrames` deterministically.
  const briefRaw = applyAuthorVoiceProfile(briefFromDisk, book.bookId);

  // Sanitize before passing to writers. The on-disk brief lists forbidden
  // phrases verbatim ("the chapter", "the book", banned phrases) so the
  // editor-in-chief can name what to avoid; but echoing those phrases into
  // every writer's context reverse-primes the writer. The system prompt
  // enforces the same forbidden list, so removing them from the brief is safe.
  const brief = sanitizeBriefForWriter(briefRaw);

  const plan = await loadOrBuild<ChapterDesignDoc>(
    resolve(STATE, "plans", `${chapter.chapterId}.plan.json`),
    () => runCurriculumPlanner({
      brief,
      chapterId: chapter.chapterId,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
    }),
    `plan[${chapter.chapterId}]`,
    log,
  );
  log(`plan: ${plan.exampleCount} examples, formats: ${Array.from(new Set(plan.exampleSpecs.map((s) => s.format))).join(", ")}`);

  const source = loadSourceBundle(book.bookId, chapter.chapterNumber);
  if (source.available) {
    log(`source: ch${chapter.chapterNumber} source metadata loaded (${source.chapterSource?.length ?? 0}c)`);
  }

  log(`hook + breakdown: generating in parallel…`);
  if (options.priorChapterShapes && (options.priorChapterShapes.priorHookFirstWords.length > 0 || options.priorChapterShapes.priorCounterShapes.length > 0)) {
    const fw = options.priorChapterShapes.priorHookFirstWords;
    const cs = options.priorChapterShapes.priorCounterShapes;
    log(`prior shapes: ${fw.length} hooks, ${cs.length} counters (writer will steer away from over-used)`);
  }
  const [hook, draftBreakdown] = await Promise.all([
    runWriterHook({ brief, plan, priorChapterShapes: options.priorChapterShapes }),
    runWriterBreakdown({
      brief,
      plan,
      chapterSource: source.chapterSource ?? undefined,
      priorChapterShapes: options.priorChapterShapes,
    }),
  ]);
  log(`hook: "${hook.hook}"`);
  log(`draft breakdown: fastRead=${draftBreakdown.fastRead.length}c, deepRead=${draftBreakdown.deepRead.length}c, fullRead=${draftBreakdown.fullRead.length}c`);

  log(`voice pass: iterating (max ${VOICE_PASS_MAX})…`);
  let breakdown = await runVoicePass({ brief, plan, draft: draftBreakdown });
  log(`voice pass iter 1 done (fastRead=${breakdown.fastRead.length}c, deepRead=${breakdown.deepRead.length}c, fullRead=${breakdown.fullRead.length}c)`);
  const runProseChecksOnBreakdown = (b: typeof breakdown): string[] => {
    const issues: string[] = [];
    for (const [tierName, tierText] of [["fastRead", b.fastRead], ["deepRead", b.deepRead], ["fullRead", b.fullRead]] as const) {
      for (const f of checkClosingLineLandings(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      for (const f of checkReadingLevel(tierText, tierName as any)) issues.push(f.message);
      for (const f of checkOpeningConcreteness(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      for (const f of checkParagraphStartVariety(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      for (const f of checkCadenceVariance(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      if (tierText.includes("\u2014")) issues.push(`${tierName}: em dash present`);
    }
    const allow = [plan.title, ...plan.coreMove.split(/\s+/).filter((w) => w.length > 4).slice(0, 3)];
    for (const f of checkCrossTierPhraseUniqueness({ fastRead: b.fastRead, deepRead: b.deepRead, fullRead: b.fullRead }, allow, "breakdown")) issues.push(f.message);
    return issues;
  };
  for (let iter = 2; iter <= VOICE_PASS_MAX; iter++) {
    const issues = runProseChecksOnBreakdown(breakdown);
    if (issues.length === 0) {
      log(`voice pass: clean after iter ${iter - 1}, stopping`);
      break;
    }
    log(`voice pass iter ${iter}: ${issues.length} findings, re-running`);
    try {
      breakdown = await runVoicePass({ brief, plan, draft: breakdown, priorFindings: issues });
    } catch (err) {
      log(`voice pass iter ${iter} failed: ${(err as Error).message}`);
      break;
    }
  }

  // Final line-editor pass — surgical sentence-level polish AFTER voice has
  // been brought home. Closes the editorial-quality gap to commercial apps.
  log(`line editor: surgical polish pass…`);
  try {
    breakdown = await runLineEditor({ brief, plan, draft: breakdown });
    log(`line editor: done (fastRead=${breakdown.fastRead.length}c, deepRead=${breakdown.deepRead.length}c, fullRead=${breakdown.fullRead.length}c)`);
  } catch (err) {
    log(`line editor: failed (${(err as Error).message}), keeping voice-passed draft`);
  }

  // Library ledger: forbidden names from recent books. This is a read-only
  // snapshot; the actual ingest later uses withLibraryState so the load-modify-
  // write sequence stays atomic under concurrent generateBook runs.
  const librarySnapshot = loadLibraryState();
  const libraryForbidden = getForbiddenNames(librarySnapshot, book.bookId, 10);
  log(`librarian: ${libraryForbidden.length} forbidden names from recent books`);

  // Examples — over-generate 3× per slot, curator picks. If the first batch
  // all fails validation, try a fallback batch with a shorter usedNames list
  // (drop library-wide forbidden list, keep only within-chapter dedup).
  log(`examples: over-generating ${plan.exampleCount} × ${CANDIDATES_PER_SLOT}…`);
  const examples: ExampleOutput[] = [];
  const usedNames: string[] = [...libraryForbidden];
  const withinChapterNames: string[] = [];
  for (let i = 0; i < plan.exampleSpecs.length; i++) {
    const spec = plan.exampleSpecs[i];
    const t0 = Date.now();

    const runBatch = async (namesList: string[]) => {
      const promises = Array.from({ length: CANDIDATES_PER_SLOT }, () =>
        runWriterExample({ brief, plan, spec, specIndex: i, usedNames: [...namesList] })
          .then((ex) => ({ ok: true as const, ex }))
          .catch((err) => ({ ok: false as const, err: (err as Error).message })),
      );
      const settled = await Promise.all(promises);
      const oks = settled.filter((s): s is { ok: true; ex: ExampleOutput } => s.ok).map((s) => s.ex);
      const errs = settled.filter((s) => !s.ok).map((s) => (s as any).err as string);
      return { candidates: oks, errors: errs };
    };

    let { candidates, errors } = await runBatch(usedNames);
    if (candidates.length === 0) {
      // Diagnose why: if the failures are all pronoun/noise "reused name"
      // errors, filter those out of the list and retry with the cleaned one.
      // This preserves cross-book uniqueness while dropping false positives.
      const noiseRe = /reused name "(You|Your|We|Us|Our|My|I|Me|Him|Them|Who|What|Why|How|He|She|They|It|This|That|These|Those|Here|There|Not|Nobody|Anybody|Somebody|Everyone|Someone|Anyone|None|Yes|No|Maybe|Once|Only|Even|Also|Still|Again|Just|When|Where|While|Before|After|During|Until|Since|And|But|Or|So|If|Because|Then|Now|Today|Tomorrow|The|A|An|First|Second|Third|Fourth|Fifth|Last|Next)"/;
      const noisyFraction = errors.filter((e) => noiseRe.test(e)).length / Math.max(1, errors.length);
      if (noisyFraction >= 0.5) {
        log(`  example[${i}] batch 1 all failed on pronoun/noise names, filtering ledger and retrying…`);
        const cleaned = usedNames.filter((n) => !/^(You|Your|We|Us|Our|My|I|Me|Him|Them|Who|What|Why|How|He|She|They|It|This|That|These|Those|Here|There|Not|Nobody|Anybody|Somebody|Everyone|Someone|Anyone|None|Yes|No|Maybe|Once|Only|Even|Also|Still|Again|Just|When|Where|While|Before|After|During|Until|Since|And|But|Or|So|If|Because|Then|Now|Today|Tomorrow|The|A|An|First|Second|Third|Fourth|Fifth|Last|Next)$/.test(n));
        const retry = await runBatch(cleaned);
        candidates = retry.candidates;
        errors = retry.errors;
      } else {
        log(`  example[${i}] batch 1 all failed: ${errors.slice(0, 3).join(" | ")}`);
        log(`  example[${i}] retry with relaxed name constraints (within-chapter only, no cross-book forbidden)…`);
        const retry = await runBatch(withinChapterNames);
        candidates = retry.candidates;
        errors = retry.errors;
      }
    }
    if (candidates.length === 0) {
      log(`  example[${i}] batch 2 all failed: ${errors.slice(0, 3).join(" | ")}`);
      throw new Error(`example[${i}] all candidates failed: ${errors.slice(0, 3).join(" | ")}`);
    }

    let winner: ExampleOutput;
    if (candidates.length === 1) {
      winner = candidates[0];
    } else {
      const curated = await runExampleCurator({ brief, plan, spec, candidates });
      winner = candidates[curated.winnerIndex];
    }
    examples.push(winner);
    for (const n of extractNamesFromText(winner.scenario)) {
      if (!usedNames.includes(n)) usedNames.push(n);
      if (!withinChapterNames.includes(n)) withinChapterNames.push(n);
    }
    log(`  example[${i}] [${spec.format}] "${winner.title}" (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  log(`quiz + cards + impl-plan + takeaway + tryThisNow: in parallel…`);
  const [quiz, cards, ipPlan, keyTakeaway, tryThisNow] = await Promise.all([
    runWriterQuiz({ brief, plan, breakdown: { easy: breakdown.fastRead, medium: breakdown.deepRead, hard: breakdown.fullRead } as any }),
    runWriterCards({ brief, plan, breakdown: { easy: breakdown.fastRead, medium: breakdown.deepRead, hard: breakdown.fullRead } as any }),
    runWriterImplementationPlan({ brief, plan, breakdown: { easy: breakdown.fastRead, medium: breakdown.deepRead, hard: breakdown.fullRead } as any }),
    generateKeyTakeaway(brief, plan, breakdown.deepRead),
    runTryThisNow({ brief, plan }).catch((err) => {
      log(`tryThisNow failed: ${(err as Error).message}`);
      return undefined;
    }),
  ]);
  log(`quiz=${quiz.questions.length}q, cards=${cards.cards.length}, plan=${ipPlan.ifThenPlans.length} if-thens, tryThisNow=${tryThisNow ? "yes" : "skipped"}`);

  // Assemble draft chapter (without memorableLines yet — that runs after assembly)
  const draftAssembled = assembleChapterV21({
    plan,
    breakdown,
    examples,
    quiz,
    cards,
    implementationPlan: ipPlan,
    keyTakeaway,
    hook,
    tryThisNow: tryThisNow?.tryThisNow,
  });

  // Memorable-lines pass: read the assembled chapter, mark the 3 most quotable
  // sentences for downstream UI highlighting/share-cards.
  log(`memorable lines: marking 3 quotable lines…`);
  let memorableLines;
  try {
    const ml = await runMemorableLines(draftAssembled);
    memorableLines = ml.memorableLines;
    log(`memorable lines: ${memorableLines.length} marked`);
  } catch (err) {
    log(`memorable lines failed: ${(err as Error).message}, continuing without`);
  }

  const assembled = { ...draftAssembled, memorableLines };

  // Final ship gate. The assembled chapter is run through every critic in
  // the FAILURE-MODES catalog. Blockers fail-close: the chapter does NOT
  // get persisted to disk. Majors/minors are logged but allow the ship.
  const gate = runShipGate(assembled);
  log(formatGateReport(gate));
  if (!gate.passed) {
    // Save the failed draft to a quarantine path so it can be inspected.
    const quarantineDir = resolve(STATE, "chapters", "_blocked");
    mkdirSync(quarantineDir, { recursive: true });
    writeFileSync(
      resolve(quarantineDir, `${chapter.chapterId}.blocked.${Date.now()}.json`),
      JSON.stringify({ chapter: assembled, gate }, null, 2),
      "utf8",
    );
    throw new Error(`Ship gate BLOCKED ${chapter.chapterId}: ${gate.blockers.length} blocker(s). See quarantine.`);
  }

  // Write output
  const outDir = resolve(STATE, "chapters");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, `${chapter.chapterId}.v21-native.chapter.json`), JSON.stringify(assembled, null, 2), "utf8");

  // Ingest into library ledger atomically — re-loads under lock so concurrent
  // generateBook runs don't lose updates. (The earlier librarySnapshot was
  // a stale read used only for the forbidden-names list above.)
  const updated = await withLibraryState((state) => {
    ingestIntoLibrary(state, book.bookId, book.title, book.author, assembled);
  });
  log(`librarian: ingested. Book now has ${updated.books[book.bookId].namesUsed.length} unique names across ${updated.books[book.bookId].chaptersIngested.length} chapters.`);

  log(`chapter done: ${((Date.now() - overall) / 1000).toFixed(1)}s wall`);
  return assembled;
}

export function readingLevels(chapter: ChapterV21): { fastRead: number; deepRead: number; fullRead: number } {
  return {
    fastRead: fleschKincaid(chapter.breakdown.fastRead),
    deepRead: fleschKincaid(chapter.breakdown.deepRead),
    fullRead: fleschKincaid(chapter.breakdown.fullRead),
  };
}
