/**
 * Finalize helper for the ChapterFlow v21 three-step Codex workflow.
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-finalize-book.ts <bookId> \
 *     --title "Title" --author "Author" --categories "A,B" --tags "x,y"
 *
 * Performs safe final automation only: verifies artifacts, runs gates and the
 * pattern audit, promotes with manual metadata, then runs validators and scorer.
 */

import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { ChapterV21 } from "../types.js";
import { formatGateReport, runShipGate } from "../critics/finalGate.js";
import { formatBookPatternAuditReport, runBookPatternAudit } from "../critics/bookPatternAudit.js";
import { promoteBook, formatPromotionResult } from "../promoteBook.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../../state");
const REPO_ROOT = resolve(__dirname, "../../../../../..");

function parseArgs(argv: string[]) {
  const [bookId, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (!tok.startsWith("--")) continue;
    const key = tok.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return { bookId, flags };
}

function csv(value: string | boolean | undefined): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const items = value.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function runOrFail(command: string, args: string[]) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, { cwd: REPO_ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}`);
  }
}

function main() {
  const { bookId, flags } = parseArgs(process.argv.slice(2));
  if (!bookId || typeof flags.title !== "string" || typeof flags.author !== "string") {
    console.error('Usage: codex-finalize-book.ts <bookId> --title "Title" --author "Author" --categories "A,B" --tags "x,y"');
    process.exit(2);
  }

  const title = flags.title as string;
  const author = flags.author as string;
  const categories = csv(flags.categories);
  const tags = csv(flags.tags);

  const indexPath = resolve(STATE, "indexes", `${bookId}.json`);
  const briefPath = resolve(STATE, "briefs", `${bookId}.manual-brief.json`);
  const ledgerPath = resolve(STATE, "books", `${bookId}.manual-generation-ledger.json`);
  const coreMapPath = resolve(STATE, "books", `${bookId}.chapter-core-map.json`);

  const required = [indexPath, briefPath, ledgerPath, coreMapPath];
  for (const path of required) {
    if (!existsSync(path)) throw new Error(`Missing required artifact: ${path}`);
  }

  const index = readJson<Array<{ chapterId: string; chapterNumber: number; chapterTitle: string }>>(indexPath);
  const chapters: ChapterV21[] = [];
  const missingPlans: number[] = [];
  const missingChapters: number[] = [];

  for (const spec of index) {
    const planPath = resolve(STATE, "plans", `${spec.chapterId}.manual-plan.json`);
    if (!existsSync(planPath)) missingPlans.push(spec.chapterNumber);
    const chapterPath = resolve(STATE, "chapters", `${spec.chapterId}.v21-native.chapter.json`);
    if (!existsSync(chapterPath)) {
      missingChapters.push(spec.chapterNumber);
    } else {
      chapters.push(readJson<ChapterV21>(chapterPath));
    }
  }

  if (missingPlans.length) throw new Error(`Missing manual plans for chapters: ${missingPlans.join(", ")}`);
  if (missingChapters.length) throw new Error(`Missing chapter JSON for chapters: ${missingChapters.join(", ")}`);

  console.log(`Finalizing ${bookId}: ${chapters.length}/${index.length} chapter(s)`);

  let gateFailures = 0;
  for (const ch of chapters.sort((a, b) => a.number - b.number)) {
    const gate = runShipGate(ch);
    if (!gate.passed) {
      gateFailures += 1;
      console.log(`\nChapter ${ch.number} gate failed:`);
      console.log(formatGateReport(gate));
    }
  }
  if (gateFailures > 0) throw new Error(`${gateFailures} chapter(s) failed ship gate. Fix with Step 2 before promotion.`);
  console.log("Ship gate: PASS for every chapter");

  const audit = runBookPatternAudit({ bookId, chapters });
  console.log("");
  console.log(formatBookPatternAuditReport(audit));
  if (!audit.passed) throw new Error("Book pattern audit blocked promotion. Fix with Step 2 before promotion.");

  const promotion = promoteBook({
    bookId,
    title,
    author,
    chapters: index,
    categories,
    tags,
  });
  console.log("");
  console.log(formatPromotionResult(promotion));
  if (!promotion.promoted) throw new Error(promotion.reason);

  const packagePath = `book-packages/${bookId}.v21.json`;
  runOrFail("npx", ["tsx", "scripts/book/prompts/chapterflow-v21-authored/src/scratch/validate-v21-package.ts", packagePath]);
  runOrFail("node", ["scripts/book/validate-book.mjs", packagePath]);
  runOrFail("npx", ["tsx", "scripts/book/prompts/chapterflow-v21-authored/src/scratch/score-chapters.ts", packagePath]);

  console.log("");
  console.log(`FINALIZE PASS: ${packagePath}`);
  console.log(`Categories: ${(categories ?? []).join(", ") || "none"}`);
  console.log(`Tags: ${(tags ?? []).join(", ") || "none"}`);
}

try {
  main();
} catch (err) {
  console.error("");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
