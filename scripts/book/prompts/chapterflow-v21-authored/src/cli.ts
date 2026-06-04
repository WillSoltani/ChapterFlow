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

import { existsSync as existsSyncFs, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, renameSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

import { BookCriticReport, BookPackage, ChapterV21 } from "./types.js";
import { runAllCritics } from "./critics/runAllCritics.js";
import { pingClaude } from "./claudeClient.js";
import { parseChapterId, isSiblingFile, checkChapterIdentity, chapterIdFromFileName, assertNoShadowStateDir } from "./lib/chapterPaths.js";

/** Refuse to run if a repo-root shadow state/chapters dir holds chapters
 *  (the dual-directory divergence hazard). Returns an exit code on failure. */
function shadowGuard(): number {
  try {
    assertNoShadowStateDir();
    return 0;
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
}
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
  author-check <chapter.json>        Phase 1: run the authoring-contract (field-JOB) checks Codex uses to
                                     converge in-session. Advisory/shadow (calibrated 0 false-positives).
                                     Exit 1 on any finding so a write loop iterates to clean.
  gate-chapter <chapter.json>        Run the per-chapter ship gate against a single chapter JSON.
                                     Useful when an agent is producing chapters by hand (e.g.,
                                     Codex sessions writing inline) and wants to validate
                                     output before saving / before assembling a book package.
                                     Exits 0 if no blockers; non-zero otherwise.
  book-gate <bookId>                 Run the full book gate against every chapter on disk for
                                     <bookId>. Auto-runs derive-artifacts first so the brief +
                                     plan checks (BP7) don't false-fire. The default standalone
                                     way to QC an assembled book without invoking generate-book.
                                     Exits 0 if no blockers; non-zero otherwise.
  name-plan <bookId> --from N --to M [--per-chapter K]
                                     PRE-AUTHORING: deal each upcoming chapter a disjoint
                                     protagonist-name slice (excludes cross-book + already-authored
                                     names) and emit banned-connective guidance, so parallel STEP-2
                                     agents can't collide on book-gate F1 / BP13. Writes
                                     state/name-plans/<bookId>.name-plan.json. Default K=7.
                                     Exit 1 if the name bank ran dry for any chapter.

  Phase-0 maintenance (see MASTER-PLAN.md):
  state-status                       Per-book: chapters on disk, untracked-in-git, chapterId mismatches, promoted.
  migrate-state [--apply]            Reconcile the repo-root shadow state/chapters into the canonical dir.
                                     [--prefer-canonical|--prefer-shadow] to resolve divergent files.
  fix-chapter-ids [<bookId>]         Normalize chapterId to match filename stem (--dry-run to preview).
  quarantine-book <bookId>           Move a shipped-but-corrupt package out of book-packages/ (reversible).

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
  // SC10 (Phase 3): source realness — v2 enforced, v1 advisory. Merge into the report.
  const { checkSourceRealness } = await import("./critics/sourceRealness.js");
  const realness = checkSourceRealness(chapters);
  report.findings.push(...realness);
  if (realness.some((f) => f.severity === "blocker")) report.passed = false;
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

/** `book-gate <bookId>` — standalone book-gate runner.
 *
 *  Loads every state/chapters/<bookId>-ch*.v21-native.chapter.json file,
 *  auto-derives brief + plan artifacts (so BP7 doesn't false-fire on the
 *  manual workflow), and runs runBookGate. Exits 0 on PASS, 1 on BLOCK.
 *
 *  Added May 2026 after the SWW post-mortem to eliminate the "forgot to
 *  run derive-artifacts" failure mode. Operators and writer agents can
 *  now QC an assembled book with one command. */
/** `author-check <chapter.json>` — Phase 1. Runs the authoring-contract checks
 *  (the field-JOB layer the structural gate lacks) and prints a JOB-grouped
 *  report Codex uses to converge in-session. Exit 1 on any finding so a write
 *  loop (`author-check && gate-chapter`) iterates to clean. SHADOW: these are
 *  advisory and do NOT affect the ship gate's blocker count yet. */
async function runAuthorCheck(args: string[]): Promise<number> {
  const chapterFile = args[0];
  if (!chapterFile) {
    console.error("Usage: author-check <path/to/chapter.json>");
    return 2;
  }
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(readFileSync(resolve(chapterFile), "utf8")) as ChapterV21;
  } catch (err) {
    console.error(`Could not read/parse ${chapterFile}: ${(err as Error).message}`);
    return 2;
  }
  const { checkAuthoringContract, formatAuthoringReport } = await import("./critics/authoringContract.js");
  const { loadChapterSidecar } = await import("./critics/sourceGrounding.js");
  const sidecar = loadChapterSidecar(chapter.chapterId);
  const findings = checkAuthoringContract(chapter, { sidecar, filePath: resolve(chapterFile) });
  console.log(formatAuthoringReport(chapter.chapterId, findings));
  return findings.length === 0 ? 0 : 1;
}

/** `quarantine-book <bookId> [--reason "..."]` — Phase 0. Moves a shipped-but-bad
 *  package out of `book-packages/` into `book-packages/_quarantined/` (reversible)
 *  and writes a quarantine record, so a known-corrupt book (e.g. range: 108/108
 *  word-salad quizzes) stops being part of the shipped set until it's redone. */
async function runQuarantineBook(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error('Usage: quarantine-book <bookId> [--reason "..."]');
    return 2;
  }
  const reason = typeof flags["reason"] === "string" ? (flags["reason"] as string) : "quarantined: shipped corrupt / diverged from current chapters";
  const pkgDir = resolve(REPO_ROOT, "book-packages");
  const pkg = resolve(pkgDir, `${bookId}.v21.json`);
  if (!existsSyncFs(pkg)) {
    console.error(`No promoted package at ${pkg} — nothing to quarantine.`);
    return 2;
  }
  const qDir = resolve(pkgDir, "_quarantined");
  mkdirSync(qDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = resolve(qDir, `${bookId}.${ts}.v21.json`);
  renameSync(pkg, dest);
  const recDir = resolve(__dirname, "../state/books/_quarantined");
  mkdirSync(recDir, { recursive: true });
  const recPath = resolve(recDir, `${bookId}.json`);
  writeFileSync(recPath, JSON.stringify({ bookId, reason, quarantinedAt: ts, movedTo: dest }, null, 2) + "\n", "utf8");
  console.log(`Quarantined ${bookId}:`);
  console.log(`  package moved: ${pkg}\n             ->  ${dest}`);
  console.log(`  reason: ${reason}`);
  console.log(`  record: ${recPath}`);
  console.log(`  (reversible — move the file back to re-ship, after the book re-passes the gate.)`);
  return 0;
}

/** `state-status` — Phase 0 operator visibility. Per book: chapters on disk,
 *  how many are UNTRACKED in git (durability risk — uncommitted Step-2 work),
 *  chapterId/filename mismatches (IDN risk), and whether it's promoted. Read-only. */
async function runStateStatus(_args: string[], _flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const chaptersDir = resolve(__dirname, "../state/chapters");
  const files = readdirSync(chaptersDir).filter((f) => f.endsWith(".chapter.json"));
  const untracked = new Set<string>();
  try {
    const out = execSync(`git status --porcelain -- "${chaptersDir}"`, { cwd: REPO_ROOT, encoding: "utf8" });
    for (const line of out.split("\n")) {
      const m = line.match(/^\?\?\s+(.*)$/);
      if (m) untracked.add(basename(m[1].trim()));
    }
  } catch {
    /* git unavailable — skip the tracked column */
  }
  const byBook: Record<string, { n: number; untracked: number; idMismatch: number }> = {};
  for (const f of files) {
    const bk = f.replace(/-ch\d+.*$/, "");
    byBook[bk] ??= { n: 0, untracked: 0, idMismatch: 0 };
    byBook[bk].n++;
    if (untracked.has(f)) byBook[bk].untracked++;
    try {
      const obj = JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21;
      if (obj.chapterId !== chapterIdFromFileName(f)) byBook[bk].idMismatch++;
    } catch {
      /* ignore parse errors here */
    }
  }
  const pkgDir = resolve(REPO_ROOT, "book-packages");
  const promoted = new Set(
    existsSyncFs(pkgDir) ? readdirSync(pkgDir).filter((f) => f.endsWith(".v21.json")).map((f) => f.replace(/\.v21\.json$/, "")) : [],
  );
  console.log(`${"book".padEnd(40)}${"ch".padStart(4)}${"untracked".padStart(11)}${"idMismatch".padStart(12)}   promoted`);
  for (const bk of Object.keys(byBook).sort()) {
    const b = byBook[bk];
    console.log(
      `${bk.padEnd(40)}${String(b.n).padStart(4)}${String(b.untracked).padStart(11)}${String(b.idMismatch).padStart(12)}   ${promoted.has(bk) ? "yes" : "-"}`,
    );
  }
  const totalUntracked = Object.values(byBook).reduce((a, b) => a + b.untracked, 0);
  const totalMismatch = Object.values(byBook).reduce((a, b) => a + b.idMismatch, 0);
  console.log("");
  if (totalUntracked > 0) console.log(`⚠️  ${totalUntracked} chapter file(s) UNTRACKED in git — commit them so Step-2 work isn't lost (manual-commit mode).`);
  if (totalMismatch > 0) console.log(`⚠️  ${totalMismatch} chapter file(s) have chapterId != filename — run \`fix-chapter-ids\` before promoting IDN1 to a blocker.`);
  if (!totalUntracked && !totalMismatch) console.log("All chapters tracked and identity-clean.");
  return 0;
}

/** `migrate-state [--apply] [--prefer-canonical|--prefer-shadow]` — Phase 0.
 *  Reconciles the accidental repo-root `state/chapters` SHADOW dir (whose files
 *  are invisible to gates/promote) against the canonical pipeline dir. Default is
 *  a dry-run. Identical shadow files are redundant (deleted on --apply); files
 *  missing from canonical are moved in; DIVERGENT files are refused unless an
 *  explicit --prefer-canonical (drop shadow) / --prefer-shadow (overwrite
 *  canonical) is given. Never silently overwrites — divergence is the hazard. */
async function runMigrateState(_args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const apply = !!flags["apply"];
  const preferCanonical = !!flags["prefer-canonical"];
  const preferShadow = !!flags["prefer-shadow"];
  const canonDir = resolve(__dirname, "../state/chapters");
  const shadowDir = resolve(REPO_ROOT, "state/chapters");
  if (!existsSyncFs(shadowDir)) {
    console.log(`No shadow dir at ${shadowDir} — nothing to migrate. State is canonical.`);
    return 0;
  }
  const shadowFiles = readdirSync(shadowDir).filter((f) => f.endsWith(".chapter.json")).sort();
  if (shadowFiles.length === 0) {
    console.log(`Shadow dir ${shadowDir} has no chapter files.`);
    return 0;
  }
  const identical: string[] = [];
  const moveIn: string[] = [];
  const divergent: string[] = [];
  for (const f of shadowFiles) {
    const s = resolve(shadowDir, f);
    const c = resolve(canonDir, f);
    if (!existsSyncFs(c)) moveIn.push(f);
    else if (readFileSync(s, "utf8") === readFileSync(c, "utf8")) identical.push(f);
    else divergent.push(f);
  }
  console.log(`Shadow: ${shadowDir}`);
  console.log(`Canonical: ${canonDir}`);
  console.log(
    `  ${identical.length} identical (redundant) · ${moveIn.length} missing-in-canonical (move in) · ${divergent.length} DIVERGENT`,
  );
  for (const f of divergent) {
    const sm = statSync(resolve(shadowDir, f)).mtimeMs;
    const cm = statSync(resolve(canonDir, f)).mtimeMs;
    console.log(`    DIVERGENT ${f} — shadow ${sm > cm ? "NEWER" : "older"}, canonical ${cm > sm ? "NEWER" : "older"}`);
  }
  if (!apply) {
    console.log(`\n[dry-run] no files changed. Re-run with --apply` + (divergent.length ? ` --prefer-canonical|--prefer-shadow (for the ${divergent.length} divergent)` : ``) + `.`);
    return 0;
  }
  if (divergent.length && !preferCanonical && !preferShadow) {
    console.error(`\nREFUSING: ${divergent.length} divergent file(s). Re-run with --prefer-canonical (drop shadow copies) or --prefer-shadow (overwrite canonical). Nothing changed.`);
    return 2;
  }
  let removed = 0, moved = 0, resolved = 0;
  for (const f of identical) { rmSync(resolve(shadowDir, f)); removed++; }
  for (const f of moveIn) { renameSync(resolve(shadowDir, f), resolve(canonDir, f)); moved++; }
  for (const f of divergent) {
    if (preferShadow) { renameSync(resolve(shadowDir, f), resolve(canonDir, f)); }
    else { rmSync(resolve(shadowDir, f)); }
    resolved++;
  }
  // Remove the shadow dir if it's now empty of chapter files.
  const leftover = readdirSync(shadowDir).filter((f) => f.endsWith(".chapter.json"));
  if (leftover.length === 0) { try { rmSync(shadowDir, { recursive: true }); } catch { /* non-empty of other files */ } }
  console.log(`\nmigrate-state: removed ${removed} redundant, moved ${moved} in, resolved ${resolved} divergent (--prefer-${preferShadow ? "shadow" : "canonical"}). Canonical is now the single source of truth.`);
  return 0;
}

/** `fix-chapter-ids [<bookId>] [--dry-run]` — Phase 0 migration. Normalizes each
 *  chapter's in-JSON `chapterId` to equal its filename stem, so the IDN1 guard
 *  can be promoted to a blocker without hard-blocking already-mismatched files
 *  (e.g. the capital-U "Unreasonable-hospitality-chNN" the slot-fill scripts
 *  wrote). With no bookId, scans every chapter. Only touches the `chapterId`
 *  field; all other content is left byte-for-byte unchanged. */
async function runFixChapterIds(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const dryRun = !!flags["dry-run"];
  const chaptersDir = resolve(__dirname, "../state/chapters");
  if (!existsSyncFs(chaptersDir)) {
    console.error(`Chapters directory not found: ${chaptersDir}`);
    return 2;
  }
  const files = readdirSync(chaptersDir)
    .filter((f) => f.endsWith(".v21-native.chapter.json") && (!bookId || isSiblingFile(f, bookId)))
    .sort();
  if (files.length === 0) {
    console.error(`No chapter files found${bookId ? ` for "${bookId}"` : ""} under ${chaptersDir}`);
    return 2;
  }
  let changed = 0;
  for (const f of files) {
    const full = resolve(chaptersDir, f);
    let raw: string;
    let obj: ChapterV21;
    try {
      raw = readFileSync(full, "utf8");
      obj = JSON.parse(raw) as ChapterV21;
    } catch (err) {
      console.error(`  skip ${f}: ${(err as Error).message}`);
      continue;
    }
    const stem = chapterIdFromFileName(f);
    if (obj.chapterId === stem) continue;
    console.log(`  ${dryRun ? "[dry-run] would fix" : "fixed"} ${f}: chapterId "${obj.chapterId}" -> "${stem}"`);
    changed++;
    if (!dryRun) {
      obj.chapterId = stem;
      // Preserve the file's exact formatting style (2-space indent, trailing NL if present).
      const out = JSON.stringify(obj, null, 2) + (raw.endsWith("\n") ? "\n" : "");
      writeFileSync(full, out, "utf8");
    }
  }
  console.log(
    `fix-chapter-ids: ${changed} chapter(s) ${dryRun ? "would be" : ""} normalized across ${files.length} file(s)${dryRun ? " (dry-run — no files written)" : ""}.`,
  );
  return 0;
}

/** `name-plan <bookId> --from N --to M [--per-chapter K]` — pre-authoring name
 *  allocator. Deals each upcoming chapter a disjoint protagonist-name slice
 *  (excluding cross-book + already-authored names) and emits the banned-
 *  connective guidance, so parallel STEP-2 agents can't collide on F1/BP13.
 *  Writes state/name-plans/<bookId>.name-plan.json and prints the allocation. */
async function runNamePlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
  if (!bookId || Number.isNaN(from) || Number.isNaN(to)) {
    console.error("Usage: name-plan <bookId> --from N --to M [--per-chapter K]   (default per-chapter 7)");
    return 2;
  }
  const perChapter = typeof flags["per-chapter"] === "string" ? parseInt(flags["per-chapter"] as string, 10) : 7;
  if (Number.isNaN(perChapter) || perChapter < 1) {
    console.error(`--per-chapter must be a positive integer (got "${String(flags["per-chapter"])}")`);
    return 2;
  }
  const { planNames, writeNamePlan, formatNamePlan } = await import("./librarian/namePlan.js");
  const plan = planNames(bookId, from, to, perChapter);
  const path = writeNamePlan(plan);
  console.log(formatNamePlan(plan));
  console.log("");
  console.log(`Written: ${path}`);
  // Non-zero so a batch driver notices an exhausted/over-broad request.
  if (plan.diagnostics.shortChapters.length > 0) {
    console.error(`\n⚠ name bank ran dry for ${plan.diagnostics.shortChapters.length} chapter(s) — add names to config/name-bank.json or lower --per-chapter.`);
    return 1;
  }
  return 0;
}

async function runBookGate(args: string[]): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: book-gate <bookId>");
    return 2;
  }
  const STATE_DIR = resolve(__dirname, "../state");
  const chaptersDir = resolve(STATE_DIR, "chapters");
  if (!existsSyncFs(chaptersDir)) {
    console.error(`Chapters directory not found: ${chaptersDir}`);
    return 2;
  }
  // Case-insensitive sibling match via the shared resolver (Phase 0 casing fix).
  const chapterFiles = readdirSync(chaptersDir)
    .filter((f) => isSiblingFile(f, bookId))
    .sort();
  if (chapterFiles.length === 0) {
    console.error(`No chapters found for book "${bookId}" under ${chaptersDir}`);
    return 2;
  }

  // Auto-derive brief + plan artifacts. BP7 (book gate) fails closed
  // without these, but derive-artifacts is a deterministic side-effect-
  // free pass over what's already on disk, so it's safe to run
  // unconditionally on every book-gate invocation. Eliminates the
  // recurring "derive-artifacts forgotten" defect that turned book-gate
  // into a 2-blocker false alarm every time.
  console.log(`Auto-deriving brief + plan artifacts for ${bookId} (so BP7 doesn't false-fire)...`);
  const deriveCode = await runDeriveArtifacts([bookId]);
  if (deriveCode !== 0) {
    console.error(`derive-artifacts failed for ${bookId}; aborting book-gate.`);
    return deriveCode;
  }
  console.log("");

  const chapters: ChapterV21[] = [];
  for (const f of chapterFiles) {
    try {
      chapters.push(JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21);
    } catch (err) {
      console.error(`Could not parse ${f}: ${(err as Error).message}`);
      return 2;
    }
  }

  const { runBookGate: runBookGateCritic, formatBookGateReport } = await import("./critics/bookGate.js");
  const report = runBookGateCritic(bookId, chapters);
  console.log(formatBookGateReport(report));

  // Phase 2 (shadow/advisory): cross-chapter keyed-choice duplication — the
  // let-them-theory defect BP21 structurally cannot see (it skips the correct
  // index). Calibrated to 0 false-positives across the corpus.
  try {
    const { checkKeyedChoiceDuplication } = await import("./critics/quizCorrectness.js");
    const dup = checkKeyedChoiceDuplication(chapters);
    if (dup.length > 0) {
      console.log("");
      console.log(`Quiz-correctness findings (advisory/shadow — ${dup.length}):`);
      for (const f of dup) console.log(`  [${f.checkId}] ${f.message.slice(0, 180)}`);
    }
  } catch {
    /* non-fatal advisory layer */
  }

  // ── Forced content-read reminder ────────────────────────────────────────
  // Every gate in this pipeline is deterministic structure/templating/register
  // analysis. NONE of them verify semantic correctness: a quiz can mark the
  // wrong answer correct, a card can teach a false point, an example can be
  // incoherent word-salad — and still pass every gate (hooked shipped 21/72
  // wrong answer keys past a GREEN book-gate; the-5-am-club shipped word-salad).
  // A PASS here is necessary but NOT sufficient. Surface that on every PASS so
  // no operator or writer agent reads GREEN as "shippable" without reading the
  // actual content a reader would see.
  if (report.passed) {
    console.log("");
    console.log("⚠️  GATE PASS ≠ SEMANTICALLY VERIFIED ⚠️");
    console.log("These gates check structure, templating, and register — NOT correctness.");
    console.log("Before promote-book, a human (or the QC reviewer agent) MUST read raw");
    console.log("content from at least 2-3 chapters and confirm:");
    console.log("  • every quiz's correctIndex actually points to the right answer");
    console.log("  • review cards and examples are coherent and true to the source");
    console.log("  • prose reads as written-by-a-person, not template-filled");
    console.log("Wrong answer keys and word-salad have shipped past a GREEN gate before.");
  }

  return report.passed ? 0 : 1;
}

async function runGateChapter(args: string[]): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
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
  let extraMajors = 0;
  if (intraFindings.length > 0) {
    console.log("");
    console.log("Intra-book quiz similarity findings (compared against prior chapters of same book):");
    for (const f of intraFindings) {
      console.log(`  [${f.checkId} ${f.severity}] ${f.message}`);
      if (f.severity === "blocker") extraBlockers++;
    }
  }

  // ── Identity guard (IDN, Phase 0) — chapterId must equal its filename stem ──
  // The intra-book critics above match siblings on chapterId; a mismatch can
  // silently skip them (the verified casing bug). Surface it here. Ships as
  // `major` (shadow) so the casing fix doesn't simultaneously hard-block the
  // already-mismatched chapters; promotes to blocker after `fix-chapter-ids`.
  const identityFindings = checkChapterIdentity(chapter, chapterFile);
  if (identityFindings.length > 0) {
    console.log("");
    console.log("Identity findings (chapterId vs filename):");
    for (const f of identityFindings) {
      console.log(`  [${f.checkId} ${f.severity}] ${f.message}`);
      if (f.severity === "blocker") extraBlockers++;
      else if (f.severity === "major") extraMajors++;
    }
  }

  // ── Authoring-contract findings (Phase 1, advisory/shadow) ──────────────
  // The field-JOB layer the structural gate lacks (concept-as-actor, templated
  // loops, echo-template explanations, bare-label card fronts, scaffold leaks,
  // proposition-whatToDo). Calibrated to ZERO fires on the clean corpus. SHADOW:
  // surfaced for the writer to fix in-session via `author-check`, but does NOT
  // affect the ship-gate blocker count until promoted out of shadow.
  try {
    const { checkAuthoringContract } = await import("./critics/authoringContract.js");
    const { loadChapterSidecar } = await import("./critics/sourceGrounding.js");
    const acFindings = checkAuthoringContract(chapter, { sidecar: loadChapterSidecar(chapter.chapterId), filePath: resolve(chapterFile) });
    if (acFindings.length > 0) {
      console.log("");
      console.log(`Authoring-contract findings (advisory/shadow — ${acFindings.length}; run \`author-check\` for the full JOB report):`);
      for (const f of acFindings) console.log(`  [${f.checkId}] ${f.unit}: ${f.message.slice(0, 140)}`);
    }
  } catch {
    /* non-fatal — advisory layer */
  }

  // ── Authoritative combined verdict ──────────────────────────────────────
  // formatGateReport prints "Ship gate: PASS/BLOCK" for the CHAPTER-ONLY ship
  // gate. The intra-book blockers above are computed separately and are NOT in
  // that count, so a chapter with 0 chapter-blockers but an AS5/AS6 intra-book
  // blocker used to print "Ship gate: PASS" up top while exiting non-zero —
  // the headline disagreed with the exit code (a trust hazard: a human or a
  // writer agent reads "PASS" and ships a templated chapter). Print a single
  // final line that combines both sources and matches the exit code exactly.
  const combinedBlockers = report.blockers.length + extraBlockers;
  console.log("");
  if (combinedBlockers > 0) {
    console.log(
      `Gate verdict: BLOCK — ${report.blockers.length} chapter blocker(s) + ${extraBlockers} intra-book blocker(s) = ${combinedBlockers} total. (exit 1)`,
    );
  } else {
    console.log(
      `Gate verdict: PASS — 0 blockers (${report.majors.length + extraMajors} major(s), ${report.minors.length} minor(s) above are non-blocking). (exit 0)`,
    );
  }

  // Gate-attempt tracking — added after the May 2026 Covey incident. We persist

  // Gate-attempt tracking — added after the May 2026 Covey incident. We persist
  // a per-chapter counter of (attempt, blocker_signature) so an agent that
  // re-runs the gate against the same chapter many times with the same blocker
  // pattern gets a SCREAMING warning that it's probably trying to game the
  // critic. Most legitimate fixes converge in 1-3 attempts; 4+ on the same
  // blocker is a structural issue requiring upstream resolution, not retry.
  // Record the COMBINED failure (chapter + intra-book blockers) so the breakers
  // engage for intra-book-only failures too (the common case — a chapter can pass
  // the chapter-only gate while failing AS5–AS12 against its siblings).
  const intraBlockerSig = intraFindings.filter((f) => f.severity === "blocker").map((f) => ({ catalogId: f.checkId }));
  const combinedReport = {
    blockers: [...report.blockers, ...intraBlockerSig],
    passed: report.blockers.length === 0 && extraBlockers === 0,
  };
  const attempts = recordGateAttempt(chapterFile, combinedReport);
  // Two circuit-breakers: STUCK (same blocker repeats) and FORM-SHIFTING (the
  // blocker relocates each attempt — the writer editing surface to dodge the
  // critic, the let-them-theory failure mode). Either trips a halt (exit 3).
  let breakerTripped = false;
  if (attempts.sameBlockerStreak >= 3) {
    breakerTripped = true;
    console.log("");
    console.log("⚠️  STUCK-BLOCKER — CIRCUIT BREAKER TRIPPED ⚠️");
    console.log(`This chapter has been gate-checked ${attempts.total} times; the SAME blocker signature fired ${attempts.sameBlockerStreak} times in a row:`);
    console.log(`  ${attempts.lastSignature}`);
    console.log("");
    console.log("STOP. A blocker that survives 3+ attempts is structural, not a surface edit.");
    console.log("Re-author the field from the source notes, or surface a one-paragraph status to");
    console.log("the user (the source notes may not differentiate this chapter — a Step-1 issue).");
  } else if (attempts.distinctSigStreak >= 3 && attempts.nonPassTotal >= 3) {
    breakerTripped = true;
    console.log("");
    console.log("⚠️  FORM-SHIFTING REPAIR — CIRCUIT BREAKER TRIPPED ⚠️");
    console.log(`This chapter has failed ${attempts.nonPassTotal} times and the blocker MOVED each attempt:`);
    console.log(`  ${attempts.recentSigs.join("  →  ")}`);
    console.log("");
    console.log("A defect that relocates instead of resolving means you are editing SURFACE FORM");
    console.log("to evade the critic, not fixing the field — the underlying template just hides in");
    console.log("whichever field isn't yet covered. STOP patching surfaces. Re-author the failing");
    console.log("field from the source notes (the Bind Block), or escalate to the user / a different");
    console.log("author. Do NOT run gate-chapter again on another surface edit — it will just relocate.");
  }
  if (breakerTripped) console.log("\n(gate-chapter exit code 3 — halt the repair loop.)");

  // Combined block: ship-gate blockers OR intra-book similarity blockers. Exit 3
  // when a circuit-breaker tripped (so an orchestrating loop halts, not spins).
  if (breakerTripped) return 3;
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
  // Phase 0 casing fix: parse the book id case-insensitively and match siblings
  // via the shared resolver. The old code built a CASE-SENSITIVE regex from the
  // raw chapterId, so a capital chapterId (e.g. "Unreasonable-hospitality-ch01")
  // matched 0 lowercase files → AS5–AS12 silently skipped.
  const parsed = parseChapterId(chapter.chapterId);
  if (!parsed) return [];
  const bookId = parsed.bookId;
  const dir = dirname(resolve(chapterFile));
  let siblings: ChapterV21[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (!isSiblingFile(entry, bookId)) continue;
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
  if (siblings.length === 0) {
    // Loud fail-open: for chapter 2+ there SHOULD be prior siblings. Zero means
    // either a genuine first chapter, or (the bug class) a slug/casing mismatch
    // that excluded them — which would silently skip AS5–AS12. Warn so it's
    // never mistaken for "intra-book critics passed".
    if (parsed.num > 1) {
      console.log(
        `  WARN: intra-book critics DID NOT RUN — 0 sibling chapters found for "${bookId}" in ${dir} ` +
          `(expected priors for ch${parsed.num}). This is NOT a pass; check chapterId/filename slug.`,
      );
    }
    return [];
  }
  const { checkIntraBookQuizSimilarity } = await import("./critics/intraBookQuizSimilarity.js");
  const {
    checkIntraBookCardSimilarity,
    checkIntraBookPlanSimilarity,
    checkIntraBookExampleSimilarity,
    checkIntraBookLiteralNgrams,
    checkIntraBookBreakdownParagraphVerbatim,
    checkIntraBookQuizPositionMatch,
  } = await import("./critics/intraBookFieldSimilarity.js");
  // AS5/AS6 (quiz prompt+distractor) + AS7 (cards) + AS8 (plan)
  // + AS9 (example word-multiset) + AS10 (literal 5-gram in examples
  // + breakdown) + AS11 (breakdown paragraph verbatim) + AS12 (quiz
  // correctIndex sequence) — all chapter-time intra-book detectors.
  // Built incrementally as the writer-agent gaming pattern moved across
  // fields in successive incidents:
  //   round 1: salting (AS1-AS4)
  //   round 2: quiz template (AS5-AS6)
  //   round 3: card/plan template (AS7-AS8)
  //   round 4: example scenario template (AS9)
  //   round 5: stock-phrase n-grams in whatToDo/whyItMatters under AS9's
  //            70% multiset floor; whole-paragraph reuse in breakdown;
  //            fixed correctIndex rotation (AS10-AS12)
  // Together they cover the literal-verbatim, paragraph-verbatim, and
  // structural-position gaps that AS5-AS9's multiset-similarity floor
  // can't reach.
  return [
    ...checkIntraBookQuizSimilarity(chapter, siblings),
    ...checkIntraBookCardSimilarity(chapter, siblings),
    ...checkIntraBookPlanSimilarity(chapter, siblings),
    ...checkIntraBookExampleSimilarity(chapter, siblings),
    ...checkIntraBookLiteralNgrams(chapter, siblings),
    ...checkIntraBookBreakdownParagraphVerbatim(chapter, siblings),
    ...checkIntraBookQuizPositionMatch(chapter, siblings),
  ] as any;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Persists gate-attempt history per chapter file to track stuck-blocker
 *  patterns. Returns the running totals so the caller can warn the operator. */
type GateAttemptEntry = {
  total: number;
  lastSignature: string;
  sameBlockerStreak: number;
  /** ++ each attempt where the non-PASS signature CHANGED from the prior one. */
  distinctSigStreak: number;
  /** count of consecutive non-PASS attempts (resets on PASS). */
  nonPassTotal: number;
  /** last few non-PASS signatures, for the form-shift message. */
  recentSigs: string[];
};

function recordGateAttempt(
  chapterFile: string,
  report: { blockers: Array<{ catalogId: string }>; passed: boolean },
): { total: number; sameBlockerStreak: number; lastSignature: string; distinctSigStreak: number; nonPassTotal: number; recentSigs: string[] } {
  const STATE_FILE = resolve(__dirname, "../state/gate-attempts.json");
  let state: Record<string, GateAttemptEntry> = {};
  try {
    if (existsSyncFs(STATE_FILE)) state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  // Signature: sorted unique blocker catalogIds (e.g., "AS4,BP20"). Used to
  // detect "same blocker repeating" (stuck) vs "blocker changing each attempt"
  // (form-shifting — the writer relocating the defect to dodge the critic).
  const sig = report.passed
    ? "PASS"
    : [...new Set(report.blockers.map((b) => b.catalogId))].sort().join(",");
  const prev: GateAttemptEntry = state[chapterFile] ?? { total: 0, lastSignature: "", sameBlockerStreak: 0, distinctSigStreak: 0, nonPassTotal: 0, recentSigs: [] };
  const isPass = sig === "PASS";
  const sameBlockerStreak = !isPass && sig === prev.lastSignature ? prev.sameBlockerStreak + 1 : isPass ? 0 : 1;
  const shifted = !isPass && prev.lastSignature && prev.lastSignature !== "PASS" && sig !== prev.lastSignature;
  const distinctSigStreak = isPass ? 0 : shifted ? prev.distinctSigStreak + 1 : prev.distinctSigStreak;
  const nonPassTotal = isPass ? 0 : prev.nonPassTotal + 1;
  const recentSigs = isPass ? [] : [...(prev.recentSigs ?? []), sig].slice(-4);
  state[chapterFile] = { total: prev.total + 1, lastSignature: sig, sameBlockerStreak, distinctSigStreak, nonPassTotal, recentSigs };
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Non-fatal — tracking is informational.
  }
  return { total: state[chapterFile].total, sameBlockerStreak, lastSignature: sig, distinctSigStreak, nonPassTotal, recentSigs };
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
    case "book-gate":
      return runBookGate(args);
    case "name-plan":
      return runNamePlan(args, flags);
    case "author-check":
      return runAuthorCheck(args);
    case "fix-chapter-ids":
      return runFixChapterIds(args, flags);
    case "migrate-state":
      return runMigrateState(args, flags);
    case "state-status":
      return runStateStatus(args, flags);
    case "quarantine-book":
      return runQuarantineBook(args, flags);
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
