/**
 * ChapterFlow v21 CLI — entry point.
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts <command> [args]
 *
 * Commands implemented in Phase 0–1:
 *   critic <book.json>          Run the full critic suite on one book JSON
 *   critic --all                Score every book in book-packages/
 *   critic --all --report path  Write aggregate scoreboard CSV + summaries
 *   help                        Print this help
 *
 * Planned (later phases):
 *   generate <title> <author>   Full v21 pipeline run for a new book
 *   repair   --book <id>        Regenerate only failing units of an existing book
 *   ledger   status             Show cross-book state
 */

import { existsSync as existsSyncFs, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

import { BookCriticReport, BookPackage, ChapterV21 } from "./types.js";
import { runAllCritics } from "./critics/runAllCritics.js";
import { pingClaude } from "./claudeClient.js";
import {
  getForbiddenNames,
  ingestChapter,
  loadLibraryState,
  saveLibraryState,
  getLedgerPath,
} from "./librarian/libraryState.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const DEFAULT_REPORTS_DIR = resolve(__dirname, "../reports");

function printHelp() {
  console.log(`ChapterFlow v21 CLI

Commands:
  critic <book.json>                 Run the critic suite on one book
  critic --all [--report <dir>]      Score every JSON in book-packages/
  critic --all --csv <file>          Emit a single-file CSV scoreboard
  ping                               Verify the claude CLI is installed + authenticated
  ledger status                      Show cross-book library state summary
  ledger forbidden-names [--book X]  List protagonist names off-limits for the next book
  ledger ingest <chapter.json> --book-id X --title X --author X
                                     Ingest a generated v21 chapter into the ledger
  next-task <bookId>                 INLINE-OPERATOR MODE: scans on-disk state for a book and
                                     prints the next artifact to produce (bibliography, chapter
                                     source, chapter output, finalize), with playbook path and
                                     validation command. Read the printed playbook, produce the
                                     artifact inline (no subprocess), save to the printed path,
                                     re-run next-task. Loop until "all done".
  check-source <bookId>              Run the source-coherence critic against the latest research
                                     bundle for a book. Use after producing bibliography + every
                                     chapter source via the research playbook. Exits 0 on PASS.
  derive-artifacts <bookId>          Inline-operator helper: derives the book-pattern-audit
                                     prerequisites (state/briefs/<bookId>.manual-brief.json +
                                     state/plans/<chapterId>.manual-plan.json per chapter) from
                                     the bibliography + cached chapters. Run after writing all
                                     chapters, before generate-book.
  research "<title>" "<author>" [--book-id <slug>] [--concurrency N] [--force-refresh]
                                     SUBPROCESS MODE: run the researcher via claude -p subprocess
                                     calls. Counts against your Max subscription quota.
  generate "<title>" "<author>" [--book-id <slug>] [--from N] [--to N] [--skip-research]
                                     SUBPROCESS MODE: end-to-end fresh generation.
                                     Counts against your Max subscription quota.
  generate-book <bookId> --title X --author Y [--from N] [--to N] [--no-categorizer --categories A,B --tags x,y]
                                     Lower-level: generate (or resume) every chapter of a book
                                     using an existing chapter index. Auto-promotes on success.
                                     For inline-operator mode (no subprocess calls), pre-populate
                                     state/chapters/ and use --no-categorizer with manual metadata.
  promote-book <bookId> --title X --author Y [--no-categorizer] [--categories A,B] [--tags x,y]
                                     Final gate. Re-validates every chapter + book-level checks,
                                     then writes book-packages/<id>.v21.json on success.
                                     Use --no-categorizer with manual --categories/--tags for Codex-only runs.
                                     Quarantines to state/books/_blocked/ on failure.
  gate-chapter <chapter.json>        Run the per-chapter ship gate against a single chapter JSON.
                                     Useful when an agent is producing chapters by hand (e.g.,
                                     Codex sessions writing inline) and wants to validate
                                     output before saving / before assembling a book package.
                                     Exits 0 if no blockers; non-zero otherwise.
  help                               This message

Examples:
  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts critic book-packages/atomic-habits.modern.json
  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts critic --all
  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts research "Atomic Habits" "James Clear"
  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate "Atomic Habits" "James Clear"
`);
}

function parseArgs(argv: string[]): { cmd: string; args: string[]; flags: Record<string, string | boolean> } {
  const [cmd, ...rest] = argv;
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      args.push(tok);
    }
  }
  return { cmd: cmd ?? "help", args, flags };
}

function parseCsvFlag(value: string | boolean | undefined): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const items = value.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function loadBookPackage(file: string): BookPackage {
  const text = readFileSync(file, "utf8");
  return JSON.parse(text) as BookPackage;
}

function summarizeReport(rep: BookCriticReport): string {
  const lines: string[] = [];
  lines.push(`# ${rep.bookId}`);
  lines.push(`File: ${rep.bookFile}`);
  lines.push(`Generated: ${rep.generatedAt}`);
  lines.push(`Chapters: ${rep.chapterCount}`);
  lines.push(`Units scored: ${rep.unitCount}`);
  lines.push(
    `Pass rate: ${(rep.summary.passRate * 100).toFixed(1)}% (${rep.summary.passedUnits}/${rep.unitCount})`,
  );
  lines.push("");
  lines.push("## By check");
  const byCheckEntries = Object.entries(rep.summary.byCheck).sort(
    (a, b) => b[1].fail - a[1].fail,
  );
  for (const [checkId, stats] of byCheckEntries) {
    const total = stats.pass + stats.fail;
    const pct = total ? (stats.pass / total) * 100 : 0;
    lines.push(
      `  ${checkId.padEnd(42)}  pass=${stats.pass.toString().padStart(4)} fail=${stats.fail
        .toString()
        .padStart(4)}  (${pct.toFixed(1)}% pass)`,
    );
  }
  lines.push("");
  // Top 10 worst units
  const worst = [...rep.unitResults]
    .filter((u) => u.findings.length > 0)
    .sort((a, b) => b.findings.length - a.findings.length)
    .slice(0, 10);
  if (worst.length > 0) {
    lines.push("## Top 10 worst units");
    for (const u of worst) {
      lines.push(
        `  ch${u.location.chapterNumber} ${u.location.unitType}${u.location.unitId ? ` ${u.location.unitId}` : ""}${u.location.tier ? ` [${u.location.tier}]` : ""} — ${u.findings.length} finding(s)`,
      );
      for (const f of u.findings.slice(0, 3)) {
        lines.push(`    [${f.severity}] ${f.checkId}: ${f.message}`);
      }
    }
  }
  return lines.join("\n");
}

type AggregateRow = {
  bookId: string;
  file: string;
  chapters: number;
  units: number;
  passed: number;
  failed: number;
  passRate: number;
  checkStats: Record<string, { pass: number; fail: number }>;
};

function toCsvRow(r: AggregateRow, checkIds: string[]): string {
  const base = [
    r.bookId,
    r.chapters.toString(),
    r.units.toString(),
    r.passed.toString(),
    r.failed.toString(),
    (r.passRate * 100).toFixed(1),
  ];
  for (const id of checkIds) {
    const s = r.checkStats[id];
    if (s) {
      const total = s.pass + s.fail;
      const pct = total ? (s.pass / total) * 100 : 100;
      base.push(pct.toFixed(1));
    } else {
      base.push("n/a");
    }
  }
  return base.join(",");
}

async function runCritic(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  if (flags.all) {
    const files = readdirSync(BOOK_PACKAGES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => resolve(BOOK_PACKAGES_DIR, f));
    console.error(`Running critics against ${files.length} books…`);

    const rows: AggregateRow[] = [];
    const reportsDir =
      typeof flags.report === "string" ? resolve(flags.report) : DEFAULT_REPORTS_DIR;
    mkdirSync(reportsDir, { recursive: true });

    const allCheckIds = new Set<string>();
    for (const file of files) {
      try {
        const pkg = loadBookPackage(file);
        const rep = runAllCritics(pkg, file);
        writeFileSync(
          resolve(reportsDir, `${rep.bookId}.md`),
          summarizeReport(rep),
          "utf8",
        );
        writeFileSync(
          resolve(reportsDir, `${rep.bookId}.json`),
          JSON.stringify(rep, null, 2),
          "utf8",
        );

        Object.keys(rep.summary.byCheck).forEach((k) => allCheckIds.add(k));
        rows.push({
          bookId: rep.bookId,
          file: rep.bookFile,
          chapters: rep.chapterCount,
          units: rep.unitCount,
          passed: rep.summary.passedUnits,
          failed: rep.summary.failedUnits,
          passRate: rep.summary.passRate,
          checkStats: rep.summary.byCheck as any,
        });
        console.error(
          `  ${rep.bookId.padEnd(40)} pass=${(rep.summary.passRate * 100).toFixed(1)}%  (${rep.summary.passedUnits}/${rep.unitCount})`,
        );
      } catch (err) {
        console.error(`  [ERROR] ${file}: ${(err as Error).message}`);
      }
    }

    // aggregate scoreboard
    const checkIds = Array.from(allCheckIds).sort();
    const csvLines: string[] = [];
    csvLines.push(
      [
        "bookId",
        "chapters",
        "units",
        "passed",
        "failed",
        "passRate",
        ...checkIds.map((c) => `check_pct_${c}`),
      ].join(","),
    );
    for (const row of rows.sort((a, b) => a.passRate - b.passRate)) {
      csvLines.push(toCsvRow(row, checkIds));
    }
    const csvPath =
      typeof flags.csv === "string"
        ? resolve(flags.csv)
        : resolve(reportsDir, "scoreboard.csv");
    writeFileSync(csvPath, csvLines.join("\n"), "utf8");

    console.error(`\nReports written to ${reportsDir}`);
    console.error(`Scoreboard: ${csvPath}`);
    return 0;
  }

  if (args.length === 0) {
    console.error("Usage: critic <book.json> | critic --all");
    return 2;
  }
  const file = resolve(args[0]);
  const pkg = loadBookPackage(file);
  const rep = runAllCritics(pkg, file);
  console.log(summarizeReport(rep));
  return rep.summary.failedUnits > 0 ? 1 : 0;
}

async function runLedger(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const sub = args[0];
  if (!sub) {
    console.error("Usage: ledger <status|forbidden-names|ingest>");
    return 2;
  }
  const state = loadLibraryState();
  if (sub === "status") {
    console.log(`Ledger at: ${getLedgerPath()}`);
    console.log(`Last updated: ${state.lastUpdatedAt}`);
    console.log(`Books tracked: ${Object.keys(state.books).length}`);
    console.log(`Total distinct protagonist names: ${Object.keys(state.globalNameUsage).length}`);
    console.log(`Library answer position totals: idx0=${state.globalAnswerPositionCounts[0]}, idx1=${state.globalAnswerPositionCounts[1]}, idx2=${state.globalAnswerPositionCounts[2]}`);
    const totalPositions = state.globalAnswerPositionCounts.reduce((a, b) => a + b, 0);
    if (totalPositions > 0) {
      const pcts = state.globalAnswerPositionCounts.map((c) => `${((c / totalPositions) * 100).toFixed(1)}%`);
      console.log(`  distribution: ${pcts.join(" / ")}`);
    }
    console.log("");
    console.log("Books:");
    for (const book of Object.values(state.books).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))) {
      console.log(`  ${book.bookId}  chapters:${book.chaptersIngested.length}  names:${book.namesUsed.length}  (${book.generatedAt.slice(0, 10)})`);
    }
    if (Object.keys(state.globalNameUsage).length > 0) {
      console.log("");
      console.log("Top 15 reused names across library:");
      const sorted = Object.entries(state.globalNameUsage)
        .sort((a, b) => b[1].books.length - a[1].books.length)
        .slice(0, 15);
      for (const [name, usage] of sorted) {
        console.log(`  ${name.padEnd(16)} ${usage.books.length} book(s), ${usage.total} occurrences`);
      }
    }
    return 0;
  }
  if (sub === "forbidden-names") {
    const bookId = typeof flags["book"] === "string" ? (flags["book"] as string) : "__new__";
    const lookback = typeof flags["lookback"] === "string" ? parseInt(flags["lookback"] as string, 10) : 10;
    const forbidden = getForbiddenNames(state, bookId, lookback);
    console.log(`Forbidden names (last ${lookback} books, excluding "${bookId}"): ${forbidden.length}`);
    console.log(forbidden.join(", "));
    return 0;
  }
  if (sub === "ingest") {
    const chapterFile = args[1];
    if (!chapterFile || !flags["book-id"] || !flags["title"] || !flags["author"]) {
      console.error(`Usage: ledger ingest <chapter.json> --book-id X --title "Y" --author "Z"`);
      return 2;
    }
    const chapter = JSON.parse(readFileSync(resolve(chapterFile), "utf8")) as ChapterV21;
    const updated = ingestChapter(state, flags["book-id"] as string, flags["title"] as string, flags["author"] as string, chapter);
    await saveLibraryState(updated);
    const book = updated.books[flags["book-id"] as string];
    console.log(`Ingested ${chapterFile} into ${flags["book-id"]}`);
    console.log(`  book now has ${book.chaptersIngested.length} chapter(s), ${book.namesUsed.length} unique protagonist name(s)`);
    return 0;
  }
  console.error(`Unknown ledger sub: ${sub}`);
  return 2;
}

async function runGenerateBook(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: generate-book <bookId> --title X --author Y [--from N] [--to N] [--no-categorizer --categories A,B --tags x,y]");
    return 2;
  }
  const title = typeof flags["title"] === "string" ? flags["title"] : null;
  const author = typeof flags["author"] === "string" ? flags["author"] : null;
  if (!title || !author) {
    console.error("Both --title and --author are required.");
    return 2;
  }
  const fromChapter = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : undefined;
  const toChapter = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : undefined;
  const noCategorizer = flags["no-categorizer"] === true;
  const manualCategories = parseCsvFlag(flags["categories"]);
  const manualTags = parseCsvFlag(flags["tags"]);

  const { generateBook, loadChapterIndex } = await import("./generateBook.js");
  const chapters = loadChapterIndex(bookId);
  const result = await generateBook(
    { bookId, title, author },
    chapters,
    {
      fromChapter,
      toChapter,
      continueOnError: false,
      noCategorizer,
      manualCategories,
      manualTags,
    },
  );
  return result.bookGate.passed ? 0 : 1;
}

/** `derive-artifacts <bookId>` — for inline-operator mode. Reads the bibliography
 *  (latest run's toc.json) + every cached chapter, and writes the minimal manual
 *  artifacts the book-pattern audit (BP7) requires:
 *    - state/briefs/<bookId>.manual-brief.json
 *    - state/plans/<chapterId>.manual-plan.json per chapter
 *  Without these, generate-book's book gate fails closed on BP7. The inline
 *  playbooks instruct the operator to run this between writing every chapter
 *  and running finalization. */
async function runDeriveArtifacts(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: derive-artifacts <bookId>");
    return 2;
  }
  const { findLatestRun } = await import("./next-task.js");
  const runId = findLatestRun(bookId);
  if (!runId) {
    console.error(`No research run for "${bookId}". Run the research playbook first.`);
    return 2;
  }
  const REPO = resolve(__dirname, "../../../../..");
  const RUNS_DIR = resolve(REPO, ".chapterflow/runs");
  const STATE_DIR = resolve(__dirname, "../state");
  const tocPath = resolve(RUNS_DIR, bookId, runId, "source-freeze", "toc.json");
  const indexPath = resolve(STATE_DIR, "indexes", `${bookId}.json`);

  if (!existsSyncFs(tocPath)) {
    console.error(`Bibliography missing: ${tocPath}`);
    return 2;
  }
  if (!existsSyncFs(indexPath)) {
    console.error(`Chapter index missing: ${indexPath}`);
    return 2;
  }
  const toc = JSON.parse(readFileSync(tocPath, "utf8"));
  const index: Array<{ chapterId: string; chapterNumber: number; chapterTitle: string }> =
    JSON.parse(readFileSync(indexPath, "utf8"));

  // ── Brief stub ──────────────────────────────────────────────────────────
  const briefDir = resolve(STATE_DIR, "briefs");
  mkdirSync(briefDir, { recursive: true });
  const briefPath = resolve(briefDir, `${bookId}.manual-brief.json`);
  const brief = {
    bookId,
    title: toc.title,
    author: toc.author,
    thesisParagraph: toc.thesis ?? "",
    coreIdeas: [],
    targetReader: "",
    voiceCharter: {
      register: toc.authorVoice?.register ?? "plainspoken",
      person: "third",
      cadence: "medium",
      signatureMoves: toc.authorVoice?.signatureMoves ?? [],
      avoidMoves: toc.authorVoice?.avoidMoves ?? [],
    },
    teachingArc: toc.teachingArc ?? "",
    forbiddenMoves: [],
    derivedFromInlineMode: true,
    derivedAt: new Date().toISOString(),
  };
  writeFileSync(briefPath, JSON.stringify(brief, null, 2), "utf8");
  console.log(`Wrote ${briefPath}`);

  // ── Per-chapter plan stubs ──────────────────────────────────────────────
  const plansDir = resolve(STATE_DIR, "plans");
  mkdirSync(plansDir, { recursive: true });
  let chaptersFound = 0;
  let chaptersMissing = 0;
  for (const spec of index) {
    const chapterPath = resolve(STATE_DIR, "chapters", `${spec.chapterId}.v21-native.chapter.json`);
    if (!existsSyncFs(chapterPath)) {
      console.log(`  skipping ${spec.chapterId} (chapter JSON not yet produced)`);
      chaptersMissing++;
      continue;
    }
    const chapter = JSON.parse(readFileSync(chapterPath, "utf8"));
    // Derive coreMove from the chapter itself — pick the keyTakeaway as the
    // most concise single-sentence statement of the chapter's mental move.
    const coreMove: string =
      typeof chapter.keyTakeaway === "string"
        ? chapter.keyTakeaway
        : `Chapter ${chapter.number} teaches the move named in its title.`;
    // Derive Bloom's mix from the chapter's actual quiz distribution.
    const bloomsMix: Record<string, number> = {};
    for (const q of chapter.quiz?.questions ?? []) {
      const lvl = q.bloomsLevel ?? "apply";
      bloomsMix[lvl] = (bloomsMix[lvl] ?? 0) + 1;
    }
    const exampleSpecs = (chapter.examples ?? []).map((ex: any) => ({
      domain: ex.planSpec?.domain ?? ex.title ?? "",
      audience: ex.planSpec?.audience ?? "",
      stakes: ex.planSpec?.stakes ?? "",
      format: ex.planSpec?.format ?? "decision_point",
      requiredBeat: ex.planSpec?.requiredBeat ?? "",
    }));
    const plan = {
      chapterId: spec.chapterId,
      number: spec.chapterNumber,
      title: spec.chapterTitle,
      coreMove,
      exampleCount: chapter.examples?.length ?? 0,
      exampleSpecs,
      quizFocus: {
        count: chapter.quiz?.questions?.length ?? 0,
        bloomsMix,
        transferEmphasis: 1.0,
      },
      cardFocus: {
        count: chapter.reviewCards?.length ?? 0,
        retrievalPractice: true,
      },
      readingTimeMinutes: chapter.readingTimeMinutes ?? 10,
      derivedFromInlineMode: true,
      derivedAt: new Date().toISOString(),
    };
    const planPath = resolve(plansDir, `${spec.chapterId}.manual-plan.json`);
    writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf8");
    console.log(`Wrote ${planPath}`);
    chaptersFound++;
  }
  console.log(`\nDerived ${chaptersFound} plan(s); ${chaptersMissing} chapter(s) still pending.`);
  return 0;
}

/** `check-source <bookId>` — run the source-coherence critic over the latest
 *  research bundle for a book. Used by the inline-operator research playbook
 *  to validate the bibliography + chapter sources before any chapter writing.
 *  Exits 0 on PASS, 1 on BLOCK. */
async function runCheckSource(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: check-source <bookId>");
    return 2;
  }
  const { findLatestRun } = await import("./next-task.js");
  const runId = findLatestRun(bookId);
  if (!runId) {
    console.error(`No research run for "${bookId}". Run the research playbook first.`);
    return 2;
  }
  const REPO = resolve(__dirname, "../../../../..");
  const RUNS_DIR = resolve(REPO, ".chapterflow/runs");
  const runDir = resolve(RUNS_DIR, bookId, runId);
  const tocPath = resolve(runDir, "source-freeze", "toc.json");
  if (!existsSyncFs(tocPath)) {
    console.error(`Bibliography missing: ${tocPath}`);
    return 2;
  }
  const toc = JSON.parse(readFileSync(tocPath, "utf8"));
  const flat: Array<{ number: number; title: string }> =
    (toc.flatChapters && toc.flatChapters.length > 0
      ? toc.flatChapters
      : (toc.sections ?? []).flatMap((s: any) => s.chapters ?? []))
      .slice()
      .sort((a: any, b: any) => a.number - b.number);
  const sourceDir = resolve(runDir, "sidecars", "source");
  const chapters: any[] = [];
  for (const ch of flat) {
    const numStr = String(ch.number).padStart(2, "0");
    const p = resolve(sourceDir, `ch${numStr}.source.json`);
    if (!existsSyncFs(p)) {
      console.error(`Chapter source missing: ${p}`);
      return 2;
    }
    chapters.push(JSON.parse(readFileSync(p, "utf8")));
  }
  const bibliography = {
    bookId: toc.bookId ?? bookId,
    title: toc.title,
    author: toc.author,
    edition: toc.edition,
    introduction: toc.introduction,
    sections: toc.sections,
    flatChapters: toc.flatChapters,
    thesis: toc.thesis,
    teachingArc: toc.teachingArc,
    authorVoice: toc.authorVoice,
    confidence: toc.confidence,
    notes: toc.notes,
  };
  const { runSourceCoherenceCheck, formatSourceCoherenceReport } = await import("./critics/sourceCoherence.js");
  const report = runSourceCoherenceCheck({ bibliography, chapters });
  console.log(formatSourceCoherenceReport(report));
  return report.passed ? 0 : 1;
}

/** `next-task <bookId>` — operator helper for inline-session generation.
 *  Scans on-disk state and prints the next artifact the operator (Claude
 *  in this session) should produce, with the path and playbook reference. */
async function runNextTask(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: next-task <bookId>");
    return 2;
  }
  const { computeNextTask, formatNextTask } = await import("./next-task.js");
  try {
    const task = computeNextTask(bookId);
    console.log(formatNextTask(task));
    return task.kind === "all-done" ? 0 : 0; // 0 either way — exit code reflects whether the helper itself succeeded
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
}

/** `research "<title>" "<author>" [--book-id <slug>] [--concurrency N] [--force-refresh]`
 *
 *  Runs the researcher orchestrator. Produces the source-freeze bundle and
 *  chapter index that the existing generation pipeline reads. Does NOT call
 *  the writer agents — use `generate` to run the full pipeline end-to-end. */
async function runResearch(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const title = args[0];
  const author = args[1];
  if (!title || !author) {
    console.error('Usage: research "<title>" "<author>" [--book-id <slug>] [--concurrency N] [--force-refresh]');
    return 2;
  }
  const { researchBook } = await import("./researcher.js");
  const bookIdFlag = typeof flags["book-id"] === "string" ? (flags["book-id"] as string) : undefined;
  const concurrency = typeof flags["concurrency"] === "string" ? parseInt(flags["concurrency"] as string, 10) : 3;
  const forceRefresh = flags["force-refresh"] === true;

  const result = await researchBook(title, author, {
    bookId: bookIdFlag,
    chapterConcurrency: concurrency,
    forceRefresh,
    failOnCoherenceBlockers: true,
  });
  console.log(`\nResearch complete:`);
  console.log(`  bookId:   ${result.bookId}`);
  console.log(`  runId:    ${result.runId}`);
  console.log(`  bundle:   ${result.bundlePath}`);
  console.log(`  index:    ${result.chapterIndexPath}`);
  console.log(`\nNext step: npx tsx src/cli.ts generate "${title}" "${author}" --book-id ${result.bookId}`);
  return result.coherence.passed ? 0 : 1;
}

/** `generate "<title>" "<author>" [--book-id <slug>] [--from N] [--to N] [--skip-research]`
 *
 *  End-to-end fresh generation. If no source bundle exists for the bookId,
 *  runs the researcher first; otherwise resumes from the existing bundle.
 *  --skip-research forces use of an existing bundle and errors if missing. */
async function runGenerate(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const title = args[0];
  const author = args[1];
  if (!title || !author) {
    console.error('Usage: generate "<title>" "<author>" [--book-id <slug>] [--from N] [--to N] [--skip-research]');
    return 2;
  }
  const bookIdFlag = typeof flags["book-id"] === "string" ? (flags["book-id"] as string) : undefined;
  const skipResearch = flags["skip-research"] === true;
  const fromChapter = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : undefined;
  const toChapter = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : undefined;

  // Resolve bookId. Prefer the flag, else slugify the title for a quick
  // is-research-already-done check before the model call.
  const { hasChapterIndex, titleToSlug, researchBook } = await import("./researcher.js");
  let resolvedBookId = bookIdFlag ?? titleToSlug(title);

  let researchedResult: Awaited<ReturnType<typeof researchBook>> | null = null;
  if (!hasChapterIndex(resolvedBookId)) {
    if (skipResearch) {
      console.error(`No chapter index found for "${resolvedBookId}" and --skip-research was set. Run: research "${title}" "${author}" first.`);
      return 2;
    }
    console.log(`No chapter index for "${resolvedBookId}" — running researcher first…`);
    researchedResult = await researchBook(title, author, {
      bookId: bookIdFlag,
      chapterConcurrency: 3,
      failOnCoherenceBlockers: true,
    });
    resolvedBookId = researchedResult.bookId;
  }

  // Proceed to generation.
  const { generateBook, loadChapterIndex } = await import("./generateBook.js");
  const chapters = loadChapterIndex(resolvedBookId);
  console.log(`\nGenerating ${chapters.length} chapter(s) for "${resolvedBookId}"…`);
  const result = await generateBook(
    { bookId: resolvedBookId, title, author },
    chapters,
    { fromChapter, toChapter, continueOnError: false },
  );
  return result.bookGate.passed ? 0 : 1;
}

async function runPromoteBook(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: promote-book <bookId> --title X --author Y");
    return 2;
  }
  const title = typeof flags["title"] === "string" ? flags["title"] : null;
  const author = typeof flags["author"] === "string" ? flags["author"] : null;
  if (!title || !author) {
    console.error("Both --title and --author are required.");
    return 2;
  }
  const { promoteBook, formatPromotionResult } = await import("./promoteBook.js");
  const { loadChapterIndex } = await import("./generateBook.js");
  const chapters = loadChapterIndex(bookId);

  let categories = parseCsvFlag(flags["categories"]);
  let tags = parseCsvFlag(flags["tags"]);

  // Codex-only/manual runs should not call the model-backed categorizer.
  // The operator can provide deterministic metadata via --categories and --tags.
  const noCategorizer = flags["no-categorizer"] === true;
  if (noCategorizer) {
    if (!categories) console.warn("--no-categorizer set without --categories; promoting without categories");
    if (!tags) console.warn("--no-categorizer set without --tags; promoting without tags");
  } else if (!categories || !tags) {
    try {
      const { runCategorizer } = await import("./agents/categorizer.js");
      const categorized = await runCategorizer({
        bookId,
        title,
        author,
        chapterTitles: chapters.map((c) => c.chapterTitle),
      });
      categories = categories ?? categorized.categories;
      tags = tags ?? categorized.tags;
    } catch (err) {
      console.warn(`categorizer failed (${(err as Error).message}); promoting without categories/tags. For Codex-only, rerun with --no-categorizer --categories ... --tags ...`);
    }
  }

  const result = promoteBook({ bookId, title, author, chapters, categories, tags });
  console.log(formatPromotionResult(result));
  return result.promoted ? 0 : 1;
}

async function runGateChapter(args: string[]): Promise<number> {
  const chapterFile = args[0];
  if (!chapterFile) {
    console.error("Usage: gate-chapter <path/to/chapter.json>");
    return 2;
  }
  const { runShipGate, formatGateReport } = await import("./critics/finalGate.js");
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(readFileSync(resolve(chapterFile), "utf8")) as ChapterV21;
  } catch (err) {
    console.error(`Could not read/parse ${chapterFile}: ${(err as Error).message}`);
    return 2;
  }
  const report = runShipGate(chapter);
  console.log(formatGateReport(report));

  // Intra-book quiz similarity check — runs AFTER the chapter-only ship gate.
  // Loads sibling chapters of the same book from state/chapters/ and checks
  // for templated quiz content (AS5 prompt similarity + AS6 distractor reuse).
  // This is the early-detection version of AS4 / BP20 which only fire at
  // book-gate time. Catches the May 2026 "7 Habits Step 2" defect class:
  // writer agents producing one quiz and reusing it across chapters with
  // name substitution. Without this, the writer wastes 10+ chapters of work
  // before book-gate surfaces the structural issue.
  const intraFindings = await runIntraBookCheck(chapter, chapterFile);
  let extraBlockers = 0;
  if (intraFindings.length > 0) {
    console.log("");
    console.log("Intra-book quiz similarity findings (compared against prior chapters of same book):");
    for (const f of intraFindings) {
      console.log(`  [${f.checkId} ${f.severity}] ${f.message}`);
      if (f.severity === "blocker") extraBlockers++;
    }
  }

  // Gate-attempt tracking — added after the May 2026 Covey incident. We persist

  // Gate-attempt tracking — added after the May 2026 Covey incident. We persist
  // a per-chapter counter of (attempt, blocker_signature) so an agent that
  // re-runs the gate against the same chapter many times with the same blocker
  // pattern gets a SCREAMING warning that it's probably trying to game the
  // critic. Most legitimate fixes converge in 1-3 attempts; 4+ on the same
  // blocker is a structural issue requiring upstream resolution, not retry.
  const attempts = recordGateAttempt(chapterFile, report);
  if (attempts.sameBlockerStreak >= 3) {
    console.log("");
    console.log("⚠️  STUCK-BLOCKER WARNING ⚠️");
    console.log(`This chapter has been gate-checked ${attempts.total} times in total.`);
    console.log(`The same blocker signature has fired ${attempts.sameBlockerStreak} times in a row:`);
    console.log(`  ${attempts.lastSignature}`);
    console.log("");
    console.log("If you are a writer agent reading this: STOP. Do NOT keep iterating on");
    console.log("the same field with surface edits. A blocker that survives 3+ attempts");
    console.log("is a structural issue — either the chapter source notes don't differentiate");
    console.log("this chapter from others, or the chapter design is template-bound. Surface");
    console.log("the problem to the user with a one-paragraph status.");
    console.log("");
    console.log("Forbidden gaming patterns the pipeline now detects:");
    console.log("  AS1 — identifier tokens (q7, ex1, p2) in prose");
    console.log("  AS2 — jammed proper nouns (MaplefieldBridgeton)");
    console.log("  AS3 — doubled periods (10:20 p.m.. The room)");
    console.log("  AS4 — same prompt skeleton across chapters with one noun swapped");
  }

  // Combined block: ship-gate blockers OR intra-book similarity blockers.
  return report.blockers.length === 0 && extraBlockers === 0 ? 0 : 1;
}

/** Load every sibling chapter of the same book from state/chapters/ and run
 *  the intra-book quiz similarity critic against them. The book ID is derived
 *  from the chapter file's chapterId (which is `<bookId>-ch<NN>`). Returns
 *  an empty array if there are no siblings (first chapter of a book) or if
 *  any I/O fails (non-fatal — the ship gate still ran). */
async function runIntraBookCheck(
  chapter: ChapterV21,
  chapterFile: string,
): Promise<Array<{ checkId: string; severity: string; message: string; evidence?: string }>> {
  const id = chapter.chapterId;
  // chapterId shape: "<bookId>-ch<NN>" — strip the -chNN tail to get the book.
  const m = id.match(/^(.+)-ch\d{1,3}$/);
  if (!m) return [];
  const bookId = m[1];
  const dir = dirname(resolve(chapterFile));
  let siblings: ChapterV21[] = [];
  try {
    const entries = readdirSync(dir);
    const pattern = new RegExp(`^${escapeRegex(bookId)}-ch\\d{1,3}\\.v21-native\\.chapter\\.json$`);
    for (const entry of entries) {
      if (!pattern.test(entry)) continue;
      const full = resolve(dir, entry);
      if (full === resolve(chapterFile)) continue; // skip the chapter being gated
      try {
        siblings.push(JSON.parse(readFileSync(full, "utf8")) as ChapterV21);
      } catch {
        // skip unreadable siblings
      }
    }
  } catch {
    return [];
  }
  if (siblings.length === 0) return [];
  const { checkIntraBookQuizSimilarity } = await import("./critics/intraBookQuizSimilarity.js");
  const { checkIntraBookCardSimilarity, checkIntraBookPlanSimilarity, checkIntraBookExampleSimilarity } = await import("./critics/intraBookFieldSimilarity.js");
  // AS5/AS6 (quiz) + AS7 (cards) + AS8 (plan) + AS9 (examples) — all
  // chapter-time intra-book similarity detectors. Built incrementally as
  // the writer-agent gaming pattern moved across fields in successive
  // incidents (quiz → cards/plan → breakdown verbatim → examples).
  // Together they cover every reader-facing field that is positional or
  // pairwise-comparable across chapters.
  return [
    ...checkIntraBookQuizSimilarity(chapter, siblings),
    ...checkIntraBookCardSimilarity(chapter, siblings),
    ...checkIntraBookPlanSimilarity(chapter, siblings),
    ...checkIntraBookExampleSimilarity(chapter, siblings),
  ] as any;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Persists gate-attempt history per chapter file to track stuck-blocker
 *  patterns. Returns the running totals so the caller can warn the operator. */
function recordGateAttempt(
  chapterFile: string,
  report: { blockers: Array<{ catalogId: string }>; passed: boolean },
): { total: number; sameBlockerStreak: number; lastSignature: string } {
  const STATE_FILE = resolve(__dirname, "../state/gate-attempts.json");
  let state: Record<string, { total: number; lastSignature: string; sameBlockerStreak: number }> = {};
  try {
    if (existsSyncFs(STATE_FILE)) state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  // Signature: sorted unique blocker catalogIds (e.g., "AS4,BP20"). Used to
  // detect "same blocker repeating" vs "blocker changing each attempt".
  const sig = report.passed
    ? "PASS"
    : [...new Set(report.blockers.map((b) => b.catalogId))].sort().join(",");
  const prev = state[chapterFile] ?? { total: 0, lastSignature: "", sameBlockerStreak: 0 };
  const sameBlockerStreak = sig !== "PASS" && sig === prev.lastSignature ? prev.sameBlockerStreak + 1 : sig === "PASS" ? 0 : 1;
  state[chapterFile] = {
    total: prev.total + 1,
    lastSignature: sig,
    sameBlockerStreak,
  };
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Non-fatal — tracking is informational.
  }
  return { total: state[chapterFile].total, sameBlockerStreak, lastSignature: sig };
}

async function main() {
  const { cmd, args, flags } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case "critic":
      return runCritic(args, flags);
    case "ping": {
      const r = await pingClaude();
      console.log(JSON.stringify(r, null, 2));
      return r.ok ? 0 : 1;
    }
    case "ledger":
      return runLedger(args, flags);
    case "generate-book":
      return runGenerateBook(args, flags);
    case "next-task":
      return runNextTask(args);
    case "check-source":
      return runCheckSource(args);
    case "derive-artifacts":
      return runDeriveArtifacts(args);
    case "research":
      return runResearch(args, flags);
    case "generate":
      return runGenerate(args, flags);
    case "promote-book":
      return runPromoteBook(args, flags);
    case "gate-chapter":
      return runGateChapter(args);
    case "help":
    case undefined:
    case "--help":
    case "-h":
      printHelp();
      return 0;
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      return 2;
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
