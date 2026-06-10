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
  promote-book <bookId> --title X --author Y [--categories A,B] [--tags x,y]
                                     Final gate. Re-validates every chapter + book-level checks + the
                                     QC-attestation gate, then writes book-packages/<id>.v21.json on
                                     success. Categories/tags are auto-derived (no-API) from the book's
                                     content when not given; pass --categories/--tags to override.
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
  shape-plan <bookId> --from N --to M
                                     PRE-AUTHORING: deal each chapter a slot-pinned palette of
                                     structurally distinct scene shapes (the anti-skeleton plan;
                                     fanout runs it automatically)
  pedagogy-plan <bookId> --from N --to M
                                     PRE-AUTHORING: deal each book/chapter a hook shape,
                                     try-this-now grammar, and quiz-opener pair so catalog-level
                                     pedagogy slots vary before parallel authoring. Writes
                                     state/pedagogy-plans/<bookId>.pedagogy-plan.json.
  name-plan <bookId> --from N --to M [--per-chapter K]
                                     PRE-AUTHORING: deal each upcoming chapter a disjoint
                                     protagonist-name slice (excludes cross-book + already-authored
                                     names) and emit banned-connective guidance, so parallel STEP-2
                                     agents can't collide on book-gate F1 / BP13. Writes
                                     state/name-plans/<bookId>.name-plan.json. Default K=7.
                                     Exit 1 if the name bank ran dry for any chapter.
  qc-attest <chapter.json> --verdict PUBLISHABLE|REVISE|CORRUPTION --reviewer <id> [--notes "..."]
                                     SEMANTIC GATE (no-API): record a Claude reviewer's verdict,
                                     stamped with the chapter's content hash, to state/qc/. promote
                                     requires a fresh PUBLISHABLE attestation per chapter; editing the
                                     chapter afterward makes it stale and forces re-review.
  qc-stats [bookId]                  Revision-rate instrumentation: first-pass PUBLISHABLE rate,
                                     attempts per chapter, verdict mix, human-vs-harness reviewers
  qc-rehash <bookId>|--all           Upgrade unchanged v1-hash attestations to the v2 content hash
  qc-run <bookId> [--chapters 1,2]   Generate the harness QC workflow (blind keys + dual-lens bar reads
                                     + cross-chapter sweep + adjudication + qc-attest)
  catalog-audit [bookId] [--save]    Cross-book fingerprint metrics (hook/exercise/quiz monoculture,
                                     house tics, name collisions, distractor tell) + variety score
  quiz-blind <chapter.json>          Print the quiz with the answer key stripped (hidden-key protocol)
  quiz-verify <chapter.json> --answers "0:1,..."  Diff blind-derived answers against the real key
  qc-status <bookId>                 Per-chapter QC-attestation coverage: PASS / STALE / REVISE /
                                     CORRUPTION / MISSING. Exit 0 iff every chapter is ship-ready.
  fanout <bookId> [--from N --to M] [--all]
                                     Print a ready-to-paste authoring prompt for each chapter still to
                                     write — title, real source-notes path, allocated names, save path,
                                     pedagogy slots, and self-gate command all filled in. Paste each block into its own
                                     Codex agent to write the book in parallel. Runs name-plan, shape-plan,
                                     and pedagogy-plan for you.
                                     Skips already-written chapters unless --all.
  categorize <bookId>                Preview the no-API auto-categorizer's pick (categories + tags from
                                     the book's own content). promote-book applies it automatically when
                                     --categories/--tags aren't given; pass those to override.
  register-web <bookId> [--created-by <name>] [--skip-ingest]
                                     Make a promoted book show up in the reader. (1) Static /books browse:
                                     append-only registration into app/book/data/bookPackages.ts (no
                                     existing line touched) + catalog refresh. (2) In-app reader/library:
                                     if AWS env (BOOK_TABLE_NAME / BOOK_*_BUCKET) is set, auto-runs the
                                     DynamoDB/S3 ingest; otherwise prints the command. Idempotent.
  batch <manifest.json> [--run]      MULTI-BOOK DRIVER. manifest = [{bookId,title,author},...]. Shows each
                                     book's stage (RESEARCH/AUTHOR/GATE_FIX/QC/SHIP/DONE) + a work queue
                                     with the exact next command. With --run, auto promotes + registers
                                     every book whose QC is complete. Re-run as books progress.

  Phase-0 maintenance (see MASTER-PLAN.md):
  state-status                       Per-book: chapters on disk, untracked-in-git, chapterId mismatches, promoted.
  migrate-state [--apply]            Reconcile the repo-root shadow state/chapters into the canonical dir.
                                     [--prefer-canonical|--prefer-shadow] to resolve divergent files.
  fix-chapter-ids [<bookId>]         Normalize chapterId to match filename stem (--dry-run to preview).
  quarantine-book <bookId>           Pull a shipped-but-corrupt package; promote/register refuse until released
  unquarantine-book <bookId>         Release a quarantine tombstone (book must then re-pass the full gate)

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
  // Failed chapters are a failure even when the book gate over the PARTIAL
  // set passes — the model-gen guard's abort used to exit 0 here.
  if (result.failed.length > 0) return 1;
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
  if (result.failed.length > 0) return 1;
  return result.bookGate.passed ? 0 : 1;
}

async function runPromoteBook(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
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

  // Auto-fill categories/tags with the NO-API deterministic categorizer when the
  // operator doesn't pass them (the default). It reads the book's own content, so
  // it works without the model API and never ships empty (which the strict
  // package validator rejects). --categories/--tags always override.
  if (!categories || !tags) {
    const { deriveCategoriesAndTags } = await import("./agents/autoCategorize.js");
    const auto = deriveCategoriesAndTags(bookId, { title, chapterTitles: chapters.map((c) => c.chapterTitle) });
    if (!categories) categories = auto.categories;
    if (!tags) tags = auto.tags;
    console.log(`Auto-categorized (no-API, source: ${auto.source}): categories=[${categories.join(", ")}]  tags=[${tags.join(", ")}]`);
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
  console.log(`  promote-book and register-web now REFUSE this book until \`unquarantine-book ${bookId}\` releases it.`);
  return 0;
}

/** `unquarantine-book <bookId>` — explicit release of a quarantine tombstone.
 *  The record is archived (not deleted) so the quarantine history survives.
 *  Releasing does NOT re-ship anything: the book still has to pass promote's
 *  full gate stack (ship + intra-book + book + QC attestations) again. */
async function runUnquarantineBook(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: unquarantine-book <bookId>");
    return 2;
  }
  const recDir = resolve(__dirname, "../state/books/_quarantined");
  const recPath = resolve(recDir, `${bookId}.json`);
  if (!existsSyncFs(recPath)) {
    console.error(`No quarantine record for "${bookId}" at ${recPath} — nothing to release.`);
    return 2;
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const archived = resolve(recDir, `${bookId}.released.${ts}.json`);
  renameSync(recPath, archived);
  console.log(`Released quarantine for ${bookId}.`);
  console.log(`  record archived: ${archived}`);
  console.log(`  Next: the book must re-pass the full gate stack — \`promote-book ${bookId} --title … --author …\`.`);
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

/** `batch <manifest.json> [--run]` — multi-book driver. The manifest is a JSON
 *  array of { bookId, title, author }. For each book it computes the pipeline
 *  stage (RESEARCH / AUTHOR / GATE_FIX / QC / SHIP / DONE), and with --run it
 *  auto-runs the terminal steps (promote-book + register-web) for every book whose
 *  QC is complete. The AI steps (research, authoring, QC) are surfaced as a work
 *  queue with the exact command to run. Re-run it as books progress. */
async function runBatch(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const guard = shadowGuard();
  if (guard) return guard;
  const manifestPath = args[0];
  if (!manifestPath) {
    console.error('Usage: batch <manifest.json> [--run]\n  manifest = [{ "bookId": "...", "title": "...", "author": "..." }, ...]');
    return 2;
  }
  let books: Array<{ bookId: string; title: string; author: string }>;
  try {
    books = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
    if (!Array.isArray(books)) throw new Error("manifest must be a JSON array");
  } catch (err) {
    console.error(`Could not read manifest ${manifestPath}: ${(err as Error).message}`);
    return 2;
  }
  const doRun = flags["run"] === true;
  const { computeNextTask } = await import("./next-task.js");
  const { runShipGate } = await import("./critics/finalGate.js");
  const { runBookGate } = await import("./critics/bookGate.js");
  const { loadAttestation, isAttestationFresh } = await import("./critics/qcAttestation.js");
  const STATE = resolve(__dirname, "../state");
  const REPO = resolve(__dirname, "../../../../..");
  const chaptersDir = resolve(STATE, "chapters");

  type Row = { bookId: string; title: string; stage: string; detail: string; action: string | null };
  const rows: Row[] = [];
  for (const b of books) {
    const bookId = parseChapterId(`${b.bookId}-ch01`)?.bookId ?? b.bookId; // normSlug
    let stage = "RESEARCH";
    let detail = "needs Step-1 research";
    let action: string | null = "research";
    let task: any;
    try { task = computeNextTask(bookId); } catch { task = { kind: "research-bibliography" }; }
    if (["research-bibliography", "research-chapter", "chapter-index"].includes(task.kind)) {
      stage = "RESEARCH"; detail = "needs Step-1 research (toc + source sidecars)"; action = "research";
    } else if (task.kind === "write-chapter") {
      stage = "AUTHOR"; detail = `chapter ${task.chapterNumber}+ still to write`; action = "author";
    } else if (existsSyncFs(resolve(REPO, "book-packages", `${bookId}.v21.json`))) {
      // Already promoted — the batch's job is to drive books TO shipped, so a
      // shipped book is DONE (re-gating it against newer/stricter gates is not the
      // batch's concern).
      stage = "DONE"; detail = "promoted"; action = null;
    } else {
      const files = existsSyncFs(chaptersDir) ? readdirSync(chaptersDir).filter((f) => isSiblingFile(f, bookId)).sort() : [];
      const chapters = files.map((f) => JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21);
      let blockers = 0;
      for (const ch of chapters) blockers += runShipGate(ch).blockers.length;
      blockers += runBookGate(bookId, chapters).findings.filter((f) => f.severity === "blocker").length;
      // Intra-book AS5-AS12, same priors-only pass promote enforces — without
      // it batch staged books as QC/SHIP that promote would then block.
      const { runIntraBookChecks } = await import("./critics/intraBook.js");
      for (const ch of chapters) {
        blockers += runIntraBookChecks(ch, chapters.filter((o) => o.number < ch.number)).filter((f) => f.severity === "blocker").length;
      }
      if (blockers > 0) {
        stage = "GATE_FIX"; detail = `${blockers} gate blocker(s)`; action = "gatefix";
      } else {
        const qcPassed = chapters.filter((ch) => {
          const a = loadAttestation(bookId, ch.number);
          // isAttestationFresh, NOT a raw hash compare — attestations carry a
          // hashVersion and a raw compare goes wrong the moment the hash evolves.
          return a && a.verdict === "PUBLISHABLE" && isAttestationFresh(a, ch);
        }).length;
        if (chapters.length === 0 || qcPassed < chapters.length) {
          stage = "QC"; detail = `${qcPassed}/${chapters.length} chapters QC-passed`; action = "qc";
        } else {
          stage = "SHIP"; detail = "QC complete — ready to promote + register"; action = "ship";
        }
      }
    }
    rows.push({ bookId, title: b.title, stage, detail, action });
  }

  // --run: auto-advance the terminal steps (promote + register) for SHIP books.
  // Exit contract: status mode (no --run) is a WORK-QUEUE REPORT and exits 0
  // unless the manifest itself is unusable; --run mode exits 1 if ANY attempted
  // promote/register failed (it previously always exited 0 and printed
  // "DONE — promoted + registered" even when register-web had failed).
  let runFailures = 0;
  if (doRun) {
    for (const r of rows.filter((x) => x.action === "ship")) {
      const b = books.find((x) => (parseChapterId(`${x.bookId}-ch01`)?.bookId ?? x.bookId) === r.bookId)!;
      try {
        const { promoteBook } = await import("./promoteBook.js");
        const { loadChapterIndex } = await import("./generateBook.js");
        const { deriveCategoriesAndTags } = await import("./agents/autoCategorize.js");
        const chapters = loadChapterIndex(r.bookId);
        const auto = deriveCategoriesAndTags(r.bookId, { title: b.title, chapterTitles: chapters.map((c) => c.chapterTitle) });
        const res = promoteBook({ bookId: r.bookId, title: b.title, author: b.author, chapters, categories: auto.categories, tags: auto.tags });
        if (!res.promoted) { r.stage = "SHIP_BLOCKED"; r.detail = (res.reason ?? "promote blocked").slice(0, 90); runFailures++; continue; }
        const regCode = await runRegisterWeb([r.bookId], {});
        if (regCode !== 0) {
          r.stage = "REGISTER_FAILED";
          r.detail = `promoted, but register-web exited ${regCode} — run \`register-web ${r.bookId}\` manually`;
          runFailures++;
          continue;
        }
        r.stage = "DONE"; r.detail = "promoted + registered";
      } catch (err) {
        r.stage = "SHIP_BLOCKED"; r.detail = (err as Error).message.slice(0, 90); runFailures++;
      }
    }
  }

  // Dashboard
  console.log(`\nBatch: ${manifestPath}  (${rows.length} book(s))${doRun ? "  [--run: promoted/registered ready books]" : ""}\n`);
  const w = Math.max(...rows.map((r) => r.bookId.length), 8);
  for (const r of rows) console.log(`  ${r.bookId.padEnd(w)}  ${r.stage.padEnd(11)}  ${r.detail}`);

  // Work queue (the human/AI steps)
  const group = (a: string) => rows.filter((r) => r.action === a).map((r) => r.bookId);
  const research = group("research"), author = group("author"), gatefix = group("gatefix"), qc = group("qc"), ship = group("ship");
  console.log(`\nWork queue:`);
  if (research.length) console.log(`  RESEARCH (${research.length}): ${research.join(", ")}\n     → one Codex agent per book, per agent-prompts/STEP-1-RESEARCH.md (give it the title+author)`);
  if (author.length) console.log(`  AUTHOR (${author.length}): ${author.join(", ")}\n     → per book: npx tsx src/cli.ts fanout <bookId>  (paste each block into a Codex agent)`);
  if (gatefix.length) console.log(`  GATE_FIX (${gatefix.length}): ${gatefix.join(", ")}\n     → per book: npx tsx src/cli.ts book-gate <bookId>  (fix the blockers it names)`);
  if (qc.length) console.log(`  QC (${qc.length}): ${qc.join(", ")}\n     → per book: a Claude QC session (agent-prompts/QC-SESSION-PROMPT.md), qc-attest each chapter`);
  if (!doRun && ship.length) console.log(`  SHIP (${ship.length}): ${ship.join(", ")}\n     → re-run with --run to auto promote + register these`);
  if (![research, author, gatefix, qc, ship].some((g) => g.length)) console.log(`  (nothing pending — all books DONE)`);
  if (runFailures > 0) {
    console.log(`\n${runFailures} --run action(s) FAILED (see SHIP_BLOCKED / REGISTER_FAILED rows above). (exit 1)`);
    return 1;
  }
  return 0;
}

/** `register-web <bookId>` — make a promoted book show up in the reader (local/dev).
 *  Append-only registration into app/book/data/bookPackages.ts (one import + a
 *  self-contained block that pushes the package and registers its tone getter —
 *  no existing line is touched; presentation auto-infers), then regenerates the
 *  catalog metadata (which imports BOOK_PACKAGES, so it also verifies the edit
 *  compiles). Idempotent. Production publish (DynamoDB/S3) is a separate step that
 *  needs AWS env — printed at the end. */
async function runRegisterWeb(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: register-web <bookId> [--created-by <name>] [--skip-ingest]");
    return 2;
  }
  const REPO = resolve(__dirname, "../../../../..");
  const tombstone = resolve(__dirname, "../state/books/_quarantined", `${bookId}.json`);
  if (existsSyncFs(tombstone)) {
    console.error(
      `QUARANTINED: ${bookId} was explicitly quarantined — refusing to register it for the web. ` +
        `Run \`unquarantine-book ${bookId}\` first (after the defect is fixed and re-QC'd).`,
    );
    return 2;
  }
  const pkgPath = resolve(REPO, "book-packages", `${bookId}.v21.json`);
  if (!existsSyncFs(pkgPath)) {
    console.error(`No package at ${pkgPath}. Run \`promote-book ${bookId} ...\` first.`);
    return 2;
  }
  const bpPath = resolve(REPO, "app/book/data/bookPackages.ts");
  if (!existsSyncFs(bpPath)) {
    console.error(`Web registry not found at ${bpPath}. (Are you on the web-app branch / is app/ present?)`);
    return 2;
  }
  let src = readFileSync(bpPath, "utf8");
  if (src.includes(`from "@/book-packages/${bookId}.v21.json"`)) {
    console.log(`${bookId} is already registered in bookPackages.ts — leaving it; just refreshing the catalog.`);
  } else {
    const ident = `auto_${bookId.replace(/[^a-zA-Z0-9]/g, "_")}_Json`;
    const lines = src.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('from "@/book-packages/') && lines[i].includes(".v21.json")) lastImport = i;
    }
    if (lastImport === -1) {
      console.error("Could not find the book-packages import block in bookPackages.ts to anchor the new import.");
      return 2;
    }
    lines.splice(lastImport + 1, 0, `import ${ident} from "@/book-packages/${bookId}.v21.json";`);
    src = lines.join("\n");
    const block =
      `\n// --- auto-registered by \`register-web\` for "${bookId}" (do not edit by hand) ---\n` +
      `{\n` +
      `  const __autoPkg = normalizeAnyPackage(${ident}, "direct");\n` +
      `  BOOK_PACKAGES.push(__autoPkg);\n` +
      `  BOOK_PACKAGE_TONE_GETTERS["${bookId}"] = (tone) => normalizeAnyPackage(${ident}, tone);\n` +
      `}\n`;
    src = src.replace(/\s*$/, "\n") + block;
    writeFileSync(bpPath, src, "utf8");
    console.log(`Registered "${bookId}" in app/book/data/bookPackages.ts (import + BOOK_PACKAGES + tone getter; presentation auto-infers).`);
  }
  // Regenerate the catalog metadata — this imports BOOK_PACKAGES, so success also
  // confirms the registration compiles and the book is picked up.
  const genScript = resolve(REPO, "scripts/book/generate-catalog-metadata.ts");
  if (existsSyncFs(genScript)) {
    try {
      execSync(`npx tsx ${JSON.stringify(genScript)}`, { cwd: REPO, stdio: "inherit" });
      console.log(`✓ Catalog regenerated — "${bookId}" will appear in the library when you run the app locally.`);
    } catch (err) {
      console.error(
        `Catalog regeneration FAILED (${(err as Error).message}). The registration may be malformed — ` +
          `review the auto-registered block at the bottom of app/book/data/bookPackages.ts, or revert it with git.`,
      );
      return 1;
    }
  } else {
    console.warn(`Catalog generator not found at ${genScript}; run it yourself to refresh the library list.`);
  }
  // Reader ingest (DynamoDB/S3) — the in-app library + reader read from the
  // published catalog, NOT the static one above. Auto-run the ingest when the
  // AWS env is present; otherwise print the command to run later.
  const publishCmd = `npx tsx scripts/book/publish-single-package.ts --file book-packages/${bookId}.v21.json --created-by you`;
  const hasAwsEnv = !!(process.env.BOOK_TABLE_NAME && process.env.BOOK_INGEST_BUCKET && process.env.BOOK_CONTENT_BUCKET);
  const publishScript = resolve(REPO, "scripts/book/publish-single-package.ts");
  if (flags["skip-ingest"] === true) {
    console.log(`\nReader ingest skipped (--skip-ingest). To do it later:\n  ${publishCmd}`);
  } else if (hasAwsEnv && existsSyncFs(publishScript)) {
    const createdBy = typeof flags["created-by"] === "string" ? (flags["created-by"] as string) : "register-web";
    console.log(`\nAWS env detected — ingesting "${bookId}" into the reader catalog (DynamoDB/S3)…`);
    try {
      execSync(
        `npx tsx ${JSON.stringify(publishScript)} --file ${JSON.stringify(`book-packages/${bookId}.v21.json`)} --created-by ${JSON.stringify(createdBy)}`,
        { cwd: REPO, stdio: "inherit" },
      );
      console.log(`✓ Ingested — "${bookId}" is now in the in-app library + reader (just refresh the page).`);
    } catch (err) {
      console.error(`Reader ingest FAILED (${(err as Error).message}). Run it manually:\n  ${publishCmd}`);
      return 1;
    }
  } else {
    console.log(`\nReader ingest skipped — AWS env not set (need BOOK_TABLE_NAME / BOOK_INGEST_BUCKET / BOOK_CONTENT_BUCKET${process.env.AWS_REGION ? "" : " / AWS_REGION"}).`);
    console.log(`This step puts the book in the actual in-app reader. When your AWS env is set, run:\n  ${publishCmd}`);
  }
  return 0;
}

/** `categorize <bookId> [--title "..."]` — preview the no-API auto-categorizer's
 *  pick (categories + tags derived from the book's own content). promote-book runs
 *  this automatically when --categories/--tags aren't passed. */
async function runCategorize(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: categorize <bookId>");
    return 2;
  }
  const { deriveCategoriesAndTags } = await import("./agents/autoCategorize.js");
  let chapterTitles: string[] = [];
  try {
    const { loadChapterIndex } = await import("./generateBook.js");
    chapterTitles = loadChapterIndex(bookId).map((c) => c.chapterTitle);
  } catch {/* index may not exist yet */}
  const auto = deriveCategoriesAndTags(bookId, { chapterTitles });
  console.log(`Auto-categorize — ${bookId}  (no-API, source: ${auto.source})`);
  console.log(`  categories: ${auto.categories.join(", ") || "(none)"}`);
  console.log(`  tags:       ${auto.tags.join(", ") || "(none)"}`);
  console.log(`\npromote-book uses these automatically. Override with --categories "A,B" --tags "x,y".`);
  return 0;
}

/** `fanout <bookId> [--from N --to M] [--all]` — print a ready-to-paste authoring
 *  prompt for each chapter still to write: title, real source-notes path (with the
 *  run timestamp resolved), the chapter's allocated names, the save path, and the
 *  self-gate command — all filled in. Paste each block into its own Codex agent to
 *  write the whole book in parallel. Skips already-written chapters unless --all. */
async function runFanout(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: fanout <bookId> [--from N --to M] [--all]");
    return 2;
  }
  const { planNames, writeNamePlan } = await import("./librarian/namePlan.js");
  const { planShapes, writeShapePlan, loadSceneShapes } = await import("./librarian/shapePlan.js");
  const { planPedagogy, writePedagogyPlan, loadPedagogyPalettes } = await import("./librarian/pedagogyPlan.js");
  const { findRunArtifact } = await import("./lib/runDirs.js");
  const { formatVoiceBible } = await import("./lib/voiceBible.js");
  const REPO = resolve(__dirname, "../../../../..");
  const PIPE = resolve(__dirname, "..");
  const RUNS = resolve(REPO, ".chapterflow/runs");
  // Artifact-aware: the toc comes from the newest run that HAS one (a rework
  // run dir without a toc must not hide the original — the zz- burial class).
  const tocPath = findRunArtifact(RUNS, bookId, "source-freeze/toc.json");
  if (!tocPath) {
    console.error(`No research run with a toc.json for "${bookId}". Do Step 1 (research) first:  npx tsx src/cli.ts next-task ${bookId}`);
    return 2;
  }
  const toc = JSON.parse(readFileSync(tocPath, "utf8"));
  const title = toc.title ?? toc.book?.title ?? bookId;
  const flat: Array<{ number: number; title: string }> = (
    toc.flatChapters && toc.flatChapters.length > 0 ? toc.flatChapters : (toc.sections ?? []).flatMap((s: any) => s.chapters ?? [])
  )
    .slice()
    .sort((a: any, b: any) => a.number - b.number);
  if (flat.length === 0) {
    console.error(`Chapter list at ${tocPath} is empty.`);
    return 2;
  }
  const indexPath = resolve(PIPE, "state/indexes", `${bookId}.json`);
  const idx: Array<{ chapterId: string; chapterNumber: number }> = existsSyncFs(indexPath)
    ? JSON.parse(readFileSync(indexPath, "utf8"))
    : [];
  const idById = new Map(idx.map((c) => [c.chapterNumber, c.chapterId]));
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : flat[0].number;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : flat[flat.length - 1].number;
  const includeAll = flags["all"] === true;
  const plan = planNames(bookId, from, to);
  writeNamePlan(plan);
  // REDO path (--all): deal FRESH shapes — carrying a templated chapter's own
  // uniform formats would re-pin the very skeleton the redo exists to break.
  const shapePlan = planShapes(bookId, from, to, 6, { forceFresh: includeAll });
  writeShapePlan(shapePlan);
  const shapeDefs = new Map(loadSceneShapes().map((s) => [s.id, s.definition]));
  const pedagogyPlan = planPedagogy(bookId, from, to, { forceFresh: includeAll });
  writePedagogyPlan(pedagogyPlan);
  const pedagogyPalettes = loadPedagogyPalettes();
  const hookDefs = new Map(pedagogyPalettes.hookShapes.map((s) => [s.id, s.definition]));
  const tryDefs = new Map(pedagogyPalettes.tryThisNowGrammars.map((g) => [g.id, g]));
  const quizDefs = new Map(pedagogyPalettes.quizOpeners.map((q) => [q.id, q]));
  // Carried name allocations for authored chapters include every capitalized
  // token the extractor saw ("University", "All", "Tonight" — junk from
  // scenario text). Pasting those as an exclusive allowlist breaks redo
  // prompts; keep only entries that are actually in the name bank.
  const { loadNameBank } = await import("./librarian/namePlan.js");
  const bankSet = new Set(loadNameBank());
  const chaptersDir = resolve(PIPE, "state/chapters");
  const blocks: string[] = [];
  let pending = 0;
  let done = 0;
  for (const ch of flat) {
    if (ch.number < from || ch.number > to) continue;
    const numStr = String(ch.number).padStart(2, "0");
    const chapterId = idById.get(ch.number) ?? `${bookId}-ch${numStr}`;
    const written = existsSyncFs(resolve(chaptersDir, `${chapterId}.v21-native.chapter.json`));
    if (written && !includeAll) {
      done++;
      continue;
    }
    pending++;
    const allocated = plan.allocation[ch.number] ?? [];
    const bankNames = allocated.filter((n) => bankSet.has(n));
    // Prefer real bank names; an authored chapter whose carried tokens are all
    // junk falls back to the raw allocation rather than an empty list.
    const names = (bankNames.length >= 3 ? bankNames : allocated).join(", ");

    // Shape palette: slot-pinned structural variety (the anti-skeleton plan).
    const shapeIds = shapePlan.allocation[ch.number] ?? [];
    const shapeLines = shapeIds
      .map((id, i) => `    ${i + 1}. ${id} — ${shapeDefs.get(id) ?? "use the format the planSpec names"}`)
      .join("\n");
    const pedagogy = pedagogyPlan.allocation[ch.number];
    const tryGrammar = pedagogy ? tryDefs.get(pedagogy.tryThisNowGrammar) : undefined;
    const quizA = pedagogy ? quizDefs.get(pedagogy.quizOpeners[0]) : undefined;
    const quizB = pedagogy ? quizDefs.get(pedagogy.quizOpeners[1]) : undefined;
    const pedagogyLines = pedagogy
      ? `• HOOK SHAPE: ${pedagogy.hookShape} — ${hookDefs.get(pedagogy.hookShape) ?? "follow the dealt hook shape."}\n` +
        `• TRY-THIS-NOW GRAMMAR: ${pedagogy.tryThisNowGrammar} — ${tryGrammar?.definition ?? "follow the dealt exercise grammar."} (example: ${tryGrammar?.example ?? "keep it concrete."})\n` +
        `• QUIZ OPENERS: rotate between ${pedagogy.quizOpeners[0]} (${quizA?.example ?? "use the dealt opener."}) and ${pedagogy.quizOpeners[1]} (${quizB?.example ?? "use the dealt opener."}); keyed answer must NOT be reliably the longest choice (BP25 — target ≤45% of questions).\n`
      : "";

    // Source specifics: the sidecar's real anchors, pasted so the writer
    // grounds scenes in them instead of inventing interchangeable ones (SC9's
    // root cause). Artifact-aware lookup per chapter. A THIN sidecar gets a
    // loud warning instead of silence — weak source reliably predicts
    // templated/ungrounded chapters, and the writer must flag, not invent.
    const sidecarPath = findRunArtifact(RUNS, bookId, `sidecars/source/ch${numStr}.source.json`);
    let specificsLine = "";
    if (sidecarPath) {
      try {
        const sc = JSON.parse(readFileSync(sidecarPath, "utf8"));
        const specs: string[] = [];
        let hardCount = 0;
        for (const ex of (sc?.namedExamples ?? []).slice(0, 5)) {
          const label = typeof ex === "string" ? ex : ex?.label;
          const hard = Array.isArray(ex?.hardSpecifics) ? ex.hardSpecifics[0] : undefined;
          if (hard) hardCount++;
          if (label) specs.push(hard ? `${label} (${String(hard).slice(0, 60)})` : String(label));
        }
        if (specs.length >= 2) {
          specificsLine = `• Ground the scenes in the source's REAL cases — use at least 2 of these meaningfully: ${specs.join("; ")}\n`;
        } else {
          specificsLine =
            `• ⚠️ THIN SOURCE: this chapter's sidecar has ${specs.length} named example(s) and ${hardCount} hard specific(s). ` +
            `Do NOT invent cases to compensate — write what the source supports and tell the operator the sidecar needs a Step-1 re-research pass.\n`;
        }
      } catch { /* unreadable sidecar → omit the line; STEP-2 still requires grounding */ }
    }

    // Voice bible: the book's charter from the editor-in-chief brief, pinned
    // BEFORE authoring so parallel agents share one register.
    const voice = formatVoiceBible(bookId);
    const voiceLine = voice ? `• VOICE (the book's charter — every field obeys it):\n    ${voice}\n` : "";

    const recallLine = ch.number > 1
      ? `• Spaced recall: make 1–2 review cards explicitly resurface a concept from an EARLIER chapter of this book (name the concept on the card front).\n`
      : "";

    blocks.push(
      `─── Chapter ${ch.number} — "${ch.title}"${written ? "  (already written — re-do)" : ""} ───\n` +
        `Write chapter ${ch.number} of "${title}" for ChapterFlow. Work in this folder:\n` +
        `  ${PIPE}\n` +
        `• Read its source notes: ${sidecarPath ?? "(no sidecar found — STOP and run Step-1 research for this chapter first)"}\n` +
        `• Use ONLY these character names: ${names}\n` +
        `• SCENE SHAPES — example[i] MUST use shape i below. This is the anti-skeleton plan (R6): structurally different scenes cannot share the "[Name] does X at [time] in [place]" frame. A binary "must decide whether A or B" tension may appear at most ONCE (only in a 'dilemma' slot).\n` +
        `${shapeLines}\n` +
        pedagogyLines +
        specificsLine +
        voiceLine +
        `• Quiz distractors: each distractor is a NAMED plausible misconception (what a hasty reader of THIS chapter would actually believe) — never a junk-prefix mutation or rephrasing of the correct choice.\n` +
        recallLine +
        `• One name = one person across breakdown→examples→quiz.\n` +
        `• Follow agent-prompts/STEP-2-WRITE-CHAPTERS.md (the authoring law).\n` +
        `• Save to state/chapters/${chapterId}.v21-native.chapter.json\n` +
        `• TWO-PASS: after drafting, self-critique against agent-prompts/FIELD-PURPOSE-CONTRACTS.md (concept-as-actor, templated loops, echo-template explanations, bare-label card fronts, proposition-not-action whatToDo) and FIX what you find before gating.\n` +
        `• Then run: npx tsx src/cli.ts gate-chapter state/chapters/${chapterId}.v21-native.chapter.json\n` +
        `  Fix every blocker it reports and re-run until it prints "Gate verdict: PASS — 0 blockers". Only stop when it is clean.`,
    );
  }
  console.log(
    `fanout — ${bookId} (ch${from}-${to}): ${pending} prompt(s) to paste` +
      (includeAll ? "" : `  [${done} already written, skipped — use --all to include]`) +
      `\n`,
  );
  console.log(blocks.join("\n\n"));
  console.log(`\nPaste each block above into its own Codex agent (run them in parallel). When they finish, check the batch:\n  npx tsx src/cli.ts book-gate ${bookId}`);
  return 0;
}

/** `shape-plan <bookId> --from N --to M` — pre-authoring scene-shape allocator
 *  (name-plan's pattern applied to example STRUCTURE). Deals each chapter a
 *  slot-pinned palette of structurally distinct scene shapes so parallel
 *  authoring agents can't converge on one frame — the skeleton class that has
 *  no viable deterministic gate. fanout runs this automatically; the command
 *  exists to preview/regenerate. */
async function runShapePlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
  if (!bookId || Number.isNaN(from) || Number.isNaN(to)) {
    console.error("Usage: shape-plan <bookId> --from N --to M");
    return 2;
  }
  const { planShapes, writeShapePlan, formatShapePlan } = await import("./librarian/shapePlan.js");
  const plan = planShapes(bookId, from, to);
  const path = writeShapePlan(plan);
  console.log(formatShapePlan(plan));
  console.log(`\nWritten: ${path}`);
  return 0;
}

/** `pedagogy-plan <bookId> --from N --to M` — pre-authoring allocator for
 *  catalog-level slot variety. Deals a hook-shape, try-this-now grammar, and
 *  alternating quiz-opener pair per chapter so parallel STEP-2 agents don't all
 *  reuse the same pedagogical surface. fanout runs this automatically; the
 *  command exists to preview/regenerate. */
async function runPedagogyPlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
  if (!bookId || Number.isNaN(from) || Number.isNaN(to)) {
    console.error("Usage: pedagogy-plan <bookId> --from N --to M");
    return 2;
  }
  const { planPedagogy, writePedagogyPlan, formatPedagogyPlan } = await import("./librarian/pedagogyPlan.js");
  const plan = planPedagogy(bookId, from, to);
  const path = writePedagogyPlan(plan);
  console.log(formatPedagogyPlan(plan));
  console.log(`\nWritten: ${path}`);
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

/** `qc-attest <chapter.json> --verdict PUBLISHABLE|REVISE|CORRUPTION --reviewer <id>
 *  [--notes "..."] [--dimensions key=true,key=false]` — record a Claude reviewer's
 *  semantic verdict for a chapter, stamped with the chapter's current content hash.
 *  promote requires a fresh PUBLISHABLE attestation per chapter (the no-API
 *  semantic gate); editing the chapter afterward makes it stale. */
async function runQcAttest(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const file = args[0];
  const verdict = typeof flags["verdict"] === "string" ? (flags["verdict"] as string).toUpperCase() : "";
  const reviewer = typeof flags["reviewer"] === "string" ? (flags["reviewer"] as string) : "";
  if (!file || !["PUBLISHABLE", "REVISE", "CORRUPTION"].includes(verdict) || !reviewer) {
    console.error(`Usage: qc-attest <chapter.json> --verdict PUBLISHABLE|REVISE|CORRUPTION --reviewer <id> [--notes "..."] [--dimensions k=true,k2=false] [--supersede "<reason>"]`);
    return 2;
  }
  const chapter = JSON.parse(readFileSync(resolve(file), "utf8")) as ChapterV21;
  const parsed = chapter.chapterId ? parseChapterId(chapter.chapterId) : null;
  if (!parsed) {
    console.error(`Could not parse chapterId "${chapter.chapterId}" — cannot attest.`);
    return 2;
  }
  const { chapterContentHash, writeAttestation, loadAttestation, isAttestationFresh } =
    await import("./critics/qcAttestation.js");
  const dimensions: Record<string, boolean> = {};
  for (const kv of parseCsvFlag(flags["dimensions"]) ?? []) {
    const [k, v] = kv.split("=");
    if (k) dimensions[k.trim()] = (v ?? "").trim().toLowerCase() === "true";
  }
  const notes = typeof flags["notes"] === "string" ? (flags["notes"] as string) : undefined;
  const findings = parseCsvFlag(flags["findings"]) ?? undefined;
  const supersede = typeof flags["supersede"] === "string" ? (flags["supersede"] as string) : null;

  // Self-attest replay guard. The verified failure mode (rich-dad redo loop):
  // a reviewer records REVISE, the AUTHORING agent re-runs qc-attest with
  // verdict PUBLISHABLE on the UNCHANGED chapter, silently overwriting the
  // human verdict. A PUBLISHABLE flip over a non-PUBLISHABLE attestation is
  // only legitimate when the content actually changed since that review
  // (hash differs → the redo loop worked). Same content → refuse, unless
  // --supersede "<reason>" records an explicit, auditable override.
  const existing = loadAttestation(parsed.bookId, chapter.number);
  if (
    existing &&
    existing.verdict !== "PUBLISHABLE" &&
    verdict === "PUBLISHABLE" &&
    isAttestationFresh(existing, chapter) &&
    !supersede
  ) {
    console.error(
      `REFUSED: ${parsed.bookId}-ch${chapter.number} carries a ${existing.verdict} verdict ` +
        `(reviewer=${existing.reviewer}, ${existing.reviewedAt.slice(0, 10)}) and the chapter is UNCHANGED ` +
        `since that review. Flipping to PUBLISHABLE without changing the content is the self-attest ` +
        `replay this gate exists to stop. Fix the chapter (the hash will change), or — if the ` +
        `${existing.verdict} was itself wrong — re-run with --supersede "<why the prior verdict was wrong>".`,
    );
    return 1;
  }
  if (existing) {
    console.log(
      `Overwriting prior attestation (verdict=${existing.verdict}, reviewer=${existing.reviewer}, ` +
        `${existing.reviewedAt.slice(0, 10)}) — it is preserved in the attestation's history.`,
    );
  }
  const { history: _prevHistory, ...existingSansHistory } = existing ?? {};
  const path = writeAttestation({
    schemaVersion: "qc-attest-v1",
    bookId: parsed.bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId!,
    verdict: verdict as "PUBLISHABLE" | "REVISE" | "CORRUPTION",
    contentHash: chapterContentHash(chapter),
    hashVersion: "v2",
    reviewer,
    reviewedAt: new Date().toISOString(),
    dimensions: Object.keys(dimensions).length ? dimensions : undefined,
    findings,
    notes,
    history: existing
      ? [...(existing.history ?? []), existingSansHistory as any].slice(-10)
      : undefined,
    supersededReason: supersede ?? undefined,
  });
  console.log(`QC attestation written: ${path}\n  ${parsed.bookId}-ch${chapter.number}  verdict=${verdict}  hash=${chapterContentHash(chapter)} (v2)  reviewer=${reviewer}`);
  return 0;
}

/** `qc-rehash [--all | <bookId>]` — one-time migration: upgrade v1-hash
 *  attestations to v2 WHERE THE CONTENT IS UNCHANGED since review (v1 hash
 *  still matches the chapter on disk). A v1 attestation that no longer
 *  matches is already stale and is left alone — it needs re-review, not a
 *  re-pin. The prior record is preserved in the attestation's history. */
async function runQcRehash(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookFilter = args[0];
  if (!bookFilter && flags["all"] !== true) {
    console.error("Usage: qc-rehash <bookId> | qc-rehash --all");
    return 2;
  }
  const { QC_DIR, chapterContentHash, chapterContentHashV1, chapterContentHashV0, writeAttestation } =
    await import("./critics/qcAttestation.js");
  const chaptersDir = resolve(__dirname, "../state/chapters");
  let upgraded = 0, alreadyV2 = 0, stale = 0, missing = 0;
  const files = readdirSync(QC_DIR).filter((f) => f.endsWith(".qc.json")).sort();
  for (const f of files) {
    const att = JSON.parse(readFileSync(resolve(QC_DIR, f), "utf8"));
    if (bookFilter && att.bookId !== bookFilter) continue;
    if (att.hashVersion === "v2") { alreadyV2++; continue; }
    const chapterFile = resolve(
      chaptersDir,
      `${att.bookId}-ch${String(att.chapterNumber).padStart(2, "0")}.v21-native.chapter.json`,
    );
    if (!existsSyncFs(chapterFile)) {
      console.log(`  SKIP (no chapter on disk): ${f}`);
      missing++;
      continue;
    }
    const chapter = JSON.parse(readFileSync(chapterFile, "utf8")) as ChapterV21;
    // Legacy attestations may carry either pre-v2 algorithm: v1 (2026-06-05+)
    // or v0 (the original 2026-06-04 projection, no title/tryThisNow).
    if (chapterContentHashV1(chapter) !== att.contentHash && chapterContentHashV0(chapter) !== att.contentHash) {
      console.log(`  STALE under v1/v0 — left for re-review: ${f}`);
      stale++;
      continue;
    }
    const { history: _h, ...prior } = att;
    writeAttestation({
      ...att,
      contentHash: chapterContentHash(chapter),
      hashVersion: "v2",
      history: [...(att.history ?? []), prior].slice(-10),
    });
    upgraded++;
  }
  console.log(
    `qc-rehash: ${upgraded} upgraded to v2, ${alreadyV2} already v2, ${stale} stale (need re-review), ${missing} missing chapters.`,
  );
  return 0;
}

/** `catalog-audit [bookId] [--save]` — measure the cross-book fingerprints no
 *  per-book gate sees (hook-shape monoculture, tryThisNow grammar, quiz-opener
 *  family, house tics, the scenario deadline tic, cross-book name collisions,
 *  the distractor length tell). --save writes state/catalog-audit/latest.json
 *  so the remediation campaign has a committed before/after. */
async function runCatalogAudit(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const { loadCatalog, auditCatalog, formatCatalogAudit } = await import("./critics/catalogAudit.js");
  const byBook = loadCatalog(args[0]);
  if (byBook.size === 0) {
    console.error(args[0] ? `No chapters found for "${args[0]}".` : "No chapters in state/chapters/.");
    return 2;
  }
  const report = auditCatalog(byBook);
  console.log(formatCatalogAudit(report));
  if (flags["save"] === true) {
    const outDir = resolve(__dirname, "../state/catalog-audit");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, "latest.json");
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nSaved: ${outPath}`);
  }
  return 0;
}

/** `quiz-blind <chapter.json>` — print the chapter's quiz with the answer key
 *  STRIPPED (no correctIndex / explanation / sourceAnchorId). The tooled half
 *  of the hidden-key protocol: a reviewer derives answers from THIS output
 *  only, then `quiz-verify` diffs the derivation against the real key — the
 *  honor-system "cover correctIndex with your hand" becomes mechanical. */
async function runQuizBlind(args: string[]): Promise<number> {
  const file = args[0];
  if (!file) {
    console.error("Usage: quiz-blind <chapter.json>");
    return 2;
  }
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(readFileSync(resolve(file), "utf8")) as ChapterV21;
  } catch (err) {
    console.error(`Could not read/parse ${file}: ${(err as Error).message}`);
    return 2;
  }
  const questions = (chapter.quiz?.questions ?? []).map((q, i) => ({
    questionIndex: i,
    prompt: q.prompt,
    choices: q.choices,
  }));
  console.log(JSON.stringify({ chapterId: chapter.chapterId, questionCount: questions.length, questions }, null, 2));
  return 0;
}

/** `quiz-verify <chapter.json> --answers "0:1,1:2,..."` — diff blind-derived
 *  answers (qIndex:choiceIndex pairs) against the chapter's real key. Requires
 *  FULL coverage (every question answered) so a reviewer can't pass by only
 *  answering the easy ones. Exit 0 = all match; 1 = mismatch/missing; 2 usage.
 *  Mismatch output includes the keyed explanation so an adjudicator can judge
 *  whether the KEY or the DERIVATION is wrong. */
async function runQuizVerify(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const file = args[0];
  const answersRaw = typeof flags["answers"] === "string" ? (flags["answers"] as string) : "";
  if (!file || !answersRaw) {
    console.error('Usage: quiz-verify <chapter.json> --answers "<qIndex>:<choiceIndex>,..."');
    return 2;
  }
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(readFileSync(resolve(file), "utf8")) as ChapterV21;
  } catch (err) {
    console.error(`Could not read/parse ${file}: ${(err as Error).message}`);
    return 2;
  }
  const questions = chapter.quiz?.questions ?? [];
  const derived = new Map<number, number>();
  for (const pair of answersRaw.split(",")) {
    const m = pair.trim().match(/^(\d+)\s*[:=]\s*(\d+)$/);
    if (!m) {
      console.error(`Bad --answers entry "${pair.trim()}" — expected <qIndex>:<choiceIndex>.`);
      return 2;
    }
    const qi = Number(m[1]);
    // Out-of-range and duplicate entries are usage errors, not noise to skip:
    // silently ignoring them let "0:0,...,8:0,99:5" read as full clean coverage.
    if (qi >= questions.length) {
      console.error(`--answers entry "${pair.trim()}": question index ${qi} does not exist (quiz has ${questions.length} questions, 0-${questions.length - 1}).`);
      return 2;
    }
    if (derived.has(qi)) {
      console.error(`--answers entry "${pair.trim()}": duplicate answer for question ${qi}.`);
      return 2;
    }
    derived.set(qi, Number(m[2]));
  }
  let mismatches = 0;
  let missing = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    // Legacy quizzes key the answer as correctAnswerIndex; everything else in
    // the pipeline (schema, quizQuality, the v1 hash) honors the alias.
    const keyed = (q.correctIndex ?? (q as any).correctAnswerIndex) as number;
    const d = derived.get(i);
    if (d === undefined) {
      missing++;
      console.log(`q${i}: MISSING — no derived answer supplied (full coverage is required)`);
      continue;
    }
    if (d === keyed) {
      console.log(`q${i}: MATCH (choice ${d})`);
    } else {
      mismatches++;
      console.log(`q${i}: MISMATCH — derived ${d} ("${(q.choices[d] ?? "<no such choice>").slice(0, 70)}") vs keyed ${keyed} ("${(q.choices[keyed] ?? "").slice(0, 70)}")`);
      console.log(`    keyed explanation: ${(typeof q.explanation === "string" ? q.explanation : JSON.stringify(q.explanation) ?? "<none>").slice(0, 160)}`);
    }
  }
  console.log(
    `quiz-verify: ${questions.length - mismatches - missing}/${questions.length} match, ${mismatches} mismatch(es), ${missing} missing.` +
      (mismatches > 0 ? " A mismatch is a CLAIM (key OR derivation may be wrong) — adjudicate before calling it corruption." : ""),
  );
  return mismatches === 0 && missing === 0 ? 0 : 1;
}

/** `qc-run <bookId> [--chapters 1,2,3]` — generate the harness QC workflow for
 *  a book: tooled blind-key verification, dual-lens publishable-bar reads, a
 *  cross-chapter sweep, adversarial adjudication of every corruption claim,
 *  and qc-attest with reviewer=harness:<id>. The generated script embeds the
 *  LIVE rubric/weights/floors from publishableBar.ts (no prompt drift) and is
 *  launched from a Claude Code session via the Workflow tool. */
async function runQcRun(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: qc-run <bookId> [--chapters 1,2,3]");
    return 2;
  }
  const chaptersDir = resolve(__dirname, "../state/chapters");
  const files = readdirSync(chaptersDir).filter((f) => isSiblingFile(f, bookId)).sort();
  if (files.length === 0) {
    console.error(`No chapters found for "${bookId}" in state/chapters/.`);
    return 2;
  }
  const only = (parseCsvFlag(flags["chapters"]) ?? []).map((s) => Number(s)).filter((n) => Number.isFinite(n));
  const { findRunArtifact } = await import("./lib/runDirs.js");
  const { AXIS_RUBRIC, AXIS_WEIGHTS, CORRUPTION_AXES, PUBLISHABLE_FLOOR, AXIS_FLOOR } =
    await import("./critics/semantic/publishableBar.js");
  const RUNS = resolve(__dirname, "../../../../..", ".chapterflow/runs");

  const quizCounts: Record<number, number> = {};
  const chapters = files
    .map((f) => {
      const ch = JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21;
      quizCounts[ch.number] = ch.quiz?.questions?.length ?? 0;
      return {
        n: ch.number,
        file: resolve(chaptersDir, f),
        sidecar: findRunArtifact(RUNS, bookId, `sidecars/source/ch${String(ch.number).padStart(2, "0")}.source.json`),
      };
    })
    .filter((c) => only.length === 0 || only.includes(c.n))
    .sort((a, b) => a.n - b.n);

  // Gold anchor: judges skim one reference-quality chapter so "85+" is
  // calibrated against the corpus every blocker is calibrated against.
  const goldCandidate = resolve(chaptersDir, "daring-greatly-ch01.v21-native.chapter.json");
  const config = {
    bookId,
    pipelineDir: resolve(__dirname, ".."),
    reviewer: `harness:qc-run-${bookId}-${new Date().toISOString().slice(0, 10)}`,
    chapters,
    quizCounts,
    goldFile: existsSyncFs(goldCandidate) && !bookId.startsWith("daring-greatly") ? goldCandidate : null,
    rubric: AXIS_RUBRIC,
    weights: AXIS_WEIGHTS,
    corruptionAxes: [...CORRUPTION_AXES],
    publishableFloor: PUBLISHABLE_FLOOR,
    axisFloor: AXIS_FLOOR,
  };

  const template = readFileSync(resolve(__dirname, "../templates/qc-run.workflow.template.js"), "utf8");
  const script = template.replace("__CONFIG__", JSON.stringify(config, null, 2));
  const outDir = resolve(__dirname, "../state/qc-runs");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${bookId}.workflow.js`);
  writeFileSync(outPath, script, "utf8");

  console.log(`QC workflow generated: ${outPath}`);
  console.log(`  book: ${bookId} — ${chapters.length} chapter(s); sidecars resolved for ${chapters.filter((c) => c.sidecar).length}/${chapters.length}`);
  console.log(`  reviewer id: ${config.reviewer}`);
  console.log(`  agents: ~${chapters.length * 3 + 2}+ (blind-keys + 2 lenses per chapter, sweep, adjudication, attest)`);
  console.log("");
  console.log("Launch from a Claude Code session (the harness is the no-API semantic judge):");
  console.log(`  Workflow({ scriptPath: "${outPath}" })`);
  console.log("Then review the returned verdicts; REVISE/CORRUPTION chapters go back to authoring.");
  if (chapters.length > 10) {
    console.log(
      `NOTE: ${chapters.length} chapters ≈ ${chapters.length * 3 + 2}+ agents in one run — a session rate limit mid-fleet ` +
        `leaves chapters incomplete (they fail safe to REVISE, but must be re-run). Consider batches: --chapters 1,2,...,8 then the rest.`,
    );
  }
  return 0;
}

/** `qc-stats [bookId]` — revision-rate instrumentation from the attestation
 *  record. The plan's throughput ceiling is the ~18% reviewer-revision rate;
 *  this measures it instead of assuming it: first-pass PUBLISHABLE rate
 *  (initial verdict in each attestation's history), attempts per chapter,
 *  final verdict mix, and human-vs-harness reviewer split. History only
 *  accumulates from Phase 1b onward, so early numbers under-count redos. */
async function runQcStats(args: string[]): Promise<number> {
  const bookFilter = args[0] ?? null;
  const { QC_DIR } = await import("./critics/qcAttestation.js");
  let files: string[] = [];
  try {
    files = readdirSync(QC_DIR).filter((f) => f.endsWith(".qc.json")).sort();
  } catch {
    console.error(`No attestation dir at ${QC_DIR}.`);
    return 2;
  }
  type Row = { chapters: number; firstPass: number; attempts: number; finals: Record<string, number>; reviewers: Record<string, number> };
  const byBook = new Map<string, Row>();
  for (const f of files) {
    let att: any;
    try {
      att = JSON.parse(readFileSync(resolve(QC_DIR, f), "utf8"));
    } catch {
      continue;
    }
    if (bookFilter && att.bookId !== bookFilter) continue;
    if (!byBook.has(att.bookId)) byBook.set(att.bookId, { chapters: 0, firstPass: 0, attempts: 0, finals: {}, reviewers: {} });
    const row = byBook.get(att.bookId)!;
    // A qc-rehash hash migration appends a history entry with the SAME
    // reviewedAt (only contentHash/hashVersion changed) — that's bookkeeping,
    // not a review attempt; counting it would fake a 2.0 attempts floor.
    const history: any[] = (Array.isArray(att.history) ? att.history : []).filter(
      (h: any) => h?.reviewedAt !== att.reviewedAt,
    );
    const firstVerdict = history.length > 0 ? history[0]?.verdict : att.verdict;
    row.chapters++;
    if (firstVerdict === "PUBLISHABLE") row.firstPass++;
    row.attempts += 1 + history.length;
    row.finals[att.verdict] = (row.finals[att.verdict] ?? 0) + 1;
    const kind = typeof att.reviewer === "string" && att.reviewer.includes(":") ? att.reviewer.split(":")[0] : "other";
    row.reviewers[kind] = (row.reviewers[kind] ?? 0) + 1;
  }
  if (byBook.size === 0) {
    console.error(bookFilter ? `No attestations for "${bookFilter}".` : "No attestations on disk.");
    return 2;
  }
  const fmtFinals = (r: Row) =>
    Object.entries(r.finals).sort().map(([v, c]) => `${v[0]}${v === "PUBLISHABLE" ? "" : ""}:${c}`).join(" ");
  let chapters = 0, firstPass = 0, attempts = 0;
  console.log(`QC stats${bookFilter ? ` — ${bookFilter}` : ""} (first-pass = initial verdict was PUBLISHABLE; attempts = 1 + history length)`);
  const w = Math.max(...[...byBook.keys()].map((b) => b.length), 8);
  for (const [book, r] of [...byBook.entries()].sort()) {
    chapters += r.chapters; firstPass += r.firstPass; attempts += r.attempts;
    console.log(
      `  ${book.padEnd(w)}  ch:${String(r.chapters).padStart(3)}  first-pass:${String(Math.round((r.firstPass / r.chapters) * 100)).padStart(3)}%` +
        `  avg-attempts:${(r.attempts / r.chapters).toFixed(2)}  finals[${fmtFinals(r)}]  reviewers[${Object.entries(r.reviewers).map(([k, c]) => `${k}:${c}`).join(" ")}]`,
    );
  }
  console.log(
    `\n  OVERALL: ${chapters} attested chapter(s), first-pass PUBLISHABLE ${Math.round((firstPass / chapters) * 100)}% ` +
      `(revision rate ${Math.round(((chapters - firstPass) / chapters) * 100)}%), avg attempts ${(attempts / chapters).toFixed(2)}.`,
  );
  console.log("  Phase 3's prevention layer (shape plan, grounding anchors, two-pass) should push first-pass UP over time — re-run after each book ships.");
  return 0;
}

/** `qc-status <bookId>` — show per-chapter QC-attestation coverage (the semantic
 *  gate's readiness for promote): PASS (fresh PUBLISHABLE), STALE, REVISE/
 *  CORRUPTION, or MISSING. */
async function runQcStatus(args: string[]): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: qc-status <bookId>");
    return 2;
  }
  const chaptersDir = resolve(__dirname, "../state/chapters");
  const files = readdirSync(chaptersDir).filter((f) => isSiblingFile(f, bookId)).sort();
  if (files.length === 0) {
    console.error(`No chapters found for "${bookId}".`);
    return 2;
  }
  const { isAttestationFresh, loadAttestation } = await import("./critics/qcAttestation.js");
  let ready = 0;
  const lines: string[] = [];
  for (const f of files) {
    const ch = JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21;
    const att = loadAttestation(bookId, ch.number);
    let status: string;
    if (!att) status = "MISSING";
    else if (att.verdict !== "PUBLISHABLE") status = att.verdict;
    else if (!isAttestationFresh(att, ch)) status = "STALE";
    else { status = "PASS"; ready++; }
    lines.push(`  ch${String(ch.number).padStart(2, "0")}: ${status}${att ? `  (reviewer=${att.reviewer}, ${att.reviewedAt.slice(0, 10)})` : ""}`);
  }
  console.log(`QC attestation status — ${bookId}: ${ready}/${files.length} chapters ship-ready (PASS)`);
  console.log(lines.join("\n"));
  return ready === files.length ? 0 : 1;
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
  const { runIntraBookChecks, loadSiblingChapters } = await import("./critics/intraBook.js");
  const siblingLoad = loadSiblingChapters(chapter, chapterFile);
  if (siblingLoad.warning) console.log(`  WARN: ${siblingLoad.warning}`);
  const intraFindings = runIntraBookChecks(chapter, siblingLoad.siblings);
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
    case "shape-plan":
      return runShapePlan(args, flags);
    case "pedagogy-plan":
      return runPedagogyPlan(args, flags);
    case "qc-attest":
      return runQcAttest(args, flags);
    case "qc-status":
      return runQcStatus(args);
    case "qc-stats":
      return runQcStats(args);
    case "qc-rehash":
      return runQcRehash(args, flags);
    case "qc-run":
      return runQcRun(args, flags);
    case "quiz-blind":
      return runQuizBlind(args);
    case "catalog-audit":
      return runCatalogAudit(args, flags);
    case "quiz-verify":
      return runQuizVerify(args, flags);
    case "fanout":
      return runFanout(args, flags);
    case "categorize":
      return runCategorize(args);
    case "register-web":
      return runRegisterWeb(args, flags);
    case "batch":
      return runBatch(args, flags);
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
    case "unquarantine-book":
      return runUnquarantineBook(args);
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
