/** The v26 chapter tool's command line. See README.md.
 *    npx tsx scripts/book/v26/cli.ts <write|check|fix|run|status|eval|render> --book <config.json>
 *      [--chapters 1,13] [--force] [--review] [--file <chapter.json> --tag <t> --out <dir>]
 *  Exit codes: 0 ok, 1 open issues or a usage error, 3 usage limit, 4 budget. */
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { BudgetError, UsageLimitError } from "./src/call";
import { loadBookConfig } from "./src/config";
import { ledgerTotal } from "./src/ledger";
import {
  checkChapter,
  evalChapter,
  fixChapter,
  guarded,
  makeCtx,
  runBook,
  statusRows,
  writeChapter,
  type ChapterStatus,
  type PipelineCtx,
  type RoundResult,
} from "./src/pipeline";
import { page, renderChapter } from "./src/render";
import type { Chapter, Issue } from "./src/types";

const VERBS = ["write", "check", "fix", "run", "status", "eval", "render"] as const;
type Verb = (typeof VERBS)[number];

const USAGE = `Usage: npx tsx scripts/book/v26/cli.ts <${VERBS.join("|")}> --book <config.json> [options]
  --chapters 1,13   chapter numbers (default: every chapter; eval takes exactly one)
  --force           write/run: start the chapter again (the old run is kept as chNN.prev-<time>)
  --review          check/fix/run: also run the editor review and send its failed items to the fix call
  --file <f>        eval: the chapter JSON to judge (default <runDir>/chNN/final.json)
  --tag <t>         eval: name for the output files (default chNN, so each chapter keeps its own)
  --out <dir>       eval: where <tag>.eval.json goes (default <runDir>/eval)
Exit codes: 0 ok, 1 open issues or a usage error, 3 usage limit, 4 budget.
`;

export interface Io {
  out(s: string): void;
  err(s: string): void;
}

class UsageError extends Error {}

/** A step stops at 2 fix rounds, as in the pipeline's run. */
const MAX_FIX_ROUNDS = 2;

// ---------------------------------------------------------------- small helpers

const money = (x: number): string => `$${x.toFixed(2)}`;
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const chName = (n: number): string => `ch${String(n).padStart(2, "0")}`;
const chDir = (ctx: PipelineCtx, n: number): string => path.join(ctx.config.runDir, chName(n));

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}

function chapterList(raw: string | undefined, ctx: PipelineCtx): number[] {
  const all = ctx.source.spans.map((s) => s.chapterNumber).sort((a, b) => a - b);
  if (raw === undefined) return all;
  const picked = raw.split(",").map((x) => {
    if (!/^\d+$/.test(x.trim())) throw new UsageError(`--chapters must be numbers separated by commas (got "${raw}")`);
    return Number(x);
  });
  for (const n of picked) if (!all.includes(n)) throw new Error(`NO_SUCH_CHAPTER: ${n} (this book has ${all[0]}-${all[all.length - 1]})`);
  return [...new Set(picked)];
}

/** The highest round that has a file called r<k>.<suffix>, or -1. */
function latestRound(dir: string, suffix: string): number {
  if (!fs.existsSync(dir)) return -1;
  const rounds = fs.readdirSync(dir).flatMap((f) => {
    const m = /^r(\d+)\.(.+)$/.exec(f);
    return m && m[2] === suffix ? [Number(m[1])] : [];
  });
  return rounds.length ? Math.max(...rounds) : -1;
}

function listIssues(io: Io, issues: Array<Issue & { leftover?: true }>): void {
  for (const i of issues) {
    const mark = i.blocking ? "!" : i.leftover ? "-" : " ";
    io.out(`  ${mark} [${i.source}] ${i.field ?? "(no field)"}: ${clip(i.text.replace(/\s+/g, " "), 200)}\n`);
  }
}

function printRound(io: Io, n: number, r: RoundResult): void {
  io.out(`${chName(n)} r${r.round}: lesson ${r.lessonRating}, ${r.blocking.length} blocking, ${r.fixable.length} to fix\n`);
  listIssues(io, [...r.blocking, ...r.fixable.filter((i) => !i.blocking)]);
}

function printStatus(io: Io, s: ChapterStatus): void {
  io.out(`${chName(s.chapter)}  ${s.stage}  round ${s.round}${s.rerun ? ", lesson rewritten once" : ""}, lesson ${s.lessonRating}, spend ${money(s.spend)}\n`);
  listIssues(io, s.open);
}

// ---------------------------------------------------------------- verbs

async function cmdWrite(ctx: PipelineCtx, chapters: number[], force: boolean, io: Io): Promise<number> {
  for (const n of chapters) {
    const dir = chDir(ctx, n);
    if (fs.existsSync(path.join(dir, "r0.chapter.json"))) {
      if (!force) {
        io.out(`${chName(n)}: already has a draft, skipped (use --force to write it again)\n`);
        continue;
      }
      fs.renameSync(dir, `${dir}.prev-${Date.now()}`);
    }
    await writeChapter(ctx, n);
    io.out(`${chName(n)}: draft written to ${path.join(dir, "r0.chapter.json")}\n`);
  }
  return 0;
}

async function cmdCheck(ctx: PipelineCtx, chapters: number[], io: Io): Promise<number> {
  let code = 0;
  for (const n of chapters) {
    const round = latestRound(chDir(ctx, n), "chapter.json");
    if (round < 0) throw new Error(`NO_DRAFT: ${chName(n)} has no draft; run write first`);
    const r = await checkChapter(ctx, n, round);
    printRound(io, n, r);
    if (r.blocking.length > 0) code = 1;
  }
  return code;
}

async function cmdFix(ctx: PipelineCtx, chapters: number[], io: Io): Promise<number> {
  let code = 0;
  for (const n of chapters) {
    const dir = chDir(ctx, n);
    const round = latestRound(dir, "chapter.json");
    const result = round < 0 ? null : readJson<RoundResult>(path.join(dir, `r${round}.result.json`));
    if (!result) throw new Error(`NO_CHECK: ${chName(n)} has no check result for its latest draft; run check first`);
    if (round >= MAX_FIX_ROUNDS) {
      io.out(`${chName(n)}: already had ${MAX_FIX_ROUNDS} fix rounds; what is left stays open\n`);
      code = 1;
      continue;
    }
    // A wrong lesson cannot be mended by edits, so a lesson issue alone does not start a fix call.
    const issues = result.fixable.filter((i) => i.source !== "lesson");
    if (issues.length === 0) {
      io.out(`${chName(n)} r${round}: nothing to fix\n`);
      if (result.blocking.length > 0) code = 1;
      continue;
    }
    await fixChapter(ctx, n, round, issues);
    const next = await checkChapter(ctx, n, round + 1);
    printRound(io, n, next);
    if (next.blocking.length > 0) code = 1;
  }
  return code;
}

async function cmdRun(ctx: PipelineCtx, chapters: number[], force: boolean, io: Io): Promise<number> {
  const statuses = await runBook(ctx, chapters, { force });
  for (const s of statuses) printStatus(io, s);
  const clean = statuses.filter((s) => s.stage === "clean").length;
  io.out(`${clean} of ${statuses.length} chapters clean; ledger ${money(ledgerTotal(ctx.ledgerPath))} of ${money(ctx.config.budgetUsd)}\n`);
  return clean === statuses.length ? 0 : 1;
}

function cmdStatus(ctx: PipelineCtx, chapters: number[], io: Io): number {
  const rows = statusRows(ctx).filter((r) => chapters.includes(r.chapter));
  io.out(`${ctx.config.bookId}: ${rows.length} chapters\n`);
  io.out(`${"ch".padStart(3)}  ${"stage".padEnd(12)} ${"open".padStart(4)} ${"spend".padStart(8)}  lesson\n`);
  for (const r of rows) {
    io.out(`${String(r.chapter).padStart(3)}  ${r.stage.padEnd(12)} ${String(r.open).padStart(4)} ${money(r.spend).padStart(8)}  ${clip(r.lesson, 70)}`.trimEnd() + "\n");
  }
  io.out(`this book ${money(rows.reduce((sum, r) => sum + r.spend, 0))}; ledger ${money(ledgerTotal(ctx.ledgerPath))} of ${money(ctx.config.budgetUsd)}\n`);
  return 0;
}

async function cmdEval(ctx: PipelineCtx, chapters: number[], opts: { file?: string; tag?: string; out?: string }, io: Io): Promise<number> {
  const [n] = chapters;
  if (chapters.length !== 1 || n === undefined) throw new UsageError("eval needs exactly one chapter: --chapters N");
  const file = opts.file ?? path.join(chDir(ctx, n), "final.json");
  const tag = opts.tag ?? chName(n);
  const out = opts.out ?? path.join(ctx.config.runDir, "eval");
  const r = await evalChapter(ctx, file, n, tag, out);

  const failed = r.items.filter((i) => !i.pass);
  const below = Object.entries(r.aggregates).filter(([, ok]) => !ok);
  io.out(`${chName(n)} eval (tag ${tag}): ${r.passCount}/${r.total} items pass\n`);
  io.out(`file: ${r.file}\n`);
  io.out(`lesson: ${r.lesson}\n`);
  io.out(`one lesson only: ${r.singleLesson === null ? "not answered" : r.singleLesson ? "yes" : "no"}\n`);
  io.out(`aggregates: ${Object.entries(r.aggregates).map(([k, ok]) => `${k} ${ok ? "ok" : "below the bar"} (${r.fractions[k] === null ? "n/a" : Math.round(r.fractions[k]! * 100) + "%"})`).join(", ")}\n`);
  io.out(`no-chapter solver, right per run: ${r.noChapterScores.join(", ")}\n`);
  if (r.missingIds.length > 0) io.out(`the judge did not answer: ${r.missingIds.join(", ")}\n`);
  for (const i of failed) io.out(`  fail ${i.id}: ${clip(i.evidence.replace(/\s+/g, " "), 200)}\n`);
  io.out(`details: ${path.join(out, `${tag}.eval.json`)}\n`);
  return below.length > 0 || r.missingIds.length > 0 ? 1 : 0;
}

function cmdRender(ctx: PipelineCtx, chapters: number[], io: Io): number {
  const outDir = path.join(ctx.config.runDir, "reading");
  const { title, author } = ctx.config;
  let written = 0;
  for (const n of chapters) {
    const chapter = readJson<Chapter>(path.join(chDir(ctx, n), "final.json"));
    if (!chapter) continue;
    const status = readJson<ChapterStatus>(path.join(chDir(ctx, n), "status.json"));
    const label = status && status.stage !== "clean" ? `${status.stage}: ${status.open.length} open` : "";
    const body = renderChapter({ ...chapter, number: n }, { label, bookLine: `${title} by ${author}`, uid: `v${n}` });
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${chName(n)}.html`);
    fs.writeFileSync(file, page(`${title}: chapter ${n}`, body));
    io.out(`${file}\n`);
    written++;
  }
  if (written === 0) throw new Error(`NO_FINAL_CHAPTER: no final chapter under ${ctx.config.runDir}; run the chapters first`);
  return 0;
}

// ---------------------------------------------------------------- main

export async function main(argv: string[], io: Io = { out: (s) => void process.stdout.write(s), err: (s) => void process.stderr.write(s) }): Promise<number> {
  try {
    let parsed;
    try {
      parsed = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
          book: { type: "string" },
          chapters: { type: "string" },
          force: { type: "boolean" },
          review: { type: "boolean" },
          file: { type: "string" },
          tag: { type: "string" },
          out: { type: "string" },
        },
      });
    } catch (e) {
      throw new UsageError((e as Error).message);
    }
    const { values, positionals } = parsed;
    const verb = positionals[0];
    if (positionals.length !== 1 || !(VERBS as readonly string[]).includes(verb ?? "")) {
      throw new UsageError(verb === undefined ? "no command given" : `unknown command or extra argument: ${positionals.join(" ")}`);
    }
    if (!values.book) throw new UsageError("--book <config.json> is required");

    const ctx = makeCtx(loadBookConfig(values.book), { review: values.review === true });
    const chapters = chapterList(values.chapters, ctx);
    const force = values.force === true;
    switch (verb as Verb) {
      // The step verbs run under the same stop rule as `run`: after a usage limit or the budget stop, no call that has not started is made.
      case "write":
        return await guarded(ctx, () => cmdWrite(ctx, chapters, force, io));
      case "check":
        return await guarded(ctx, () => cmdCheck(ctx, chapters, io));
      case "fix":
        return await guarded(ctx, () => cmdFix(ctx, chapters, io));
      case "run":
        return await cmdRun(ctx, chapters, force, io);
      case "status":
        return cmdStatus(ctx, chapters, io);
      case "eval":
        return await guarded(ctx, () => cmdEval(ctx, chapters, values, io));
      case "render":
        return cmdRender(ctx, chapters, io);
    }
  } catch (e) {
    if (e instanceof UsageLimitError || e instanceof BudgetError) {
      io.err(`${e.message}\nStopped. Run the same command again later: steps that finished are kept and skipped.\n`);
      return e.exitCode;
    }
    io.err(`${e instanceof UsageError ? `${e.message}\n\n${USAGE}` : `error: ${e instanceof Error ? e.message : String(e)}\n`}`);
    return 1;
  }
}

// Run only when started as a script, not when a test imports main.
if (process.argv[1] !== undefined && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
