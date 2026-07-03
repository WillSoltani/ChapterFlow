#!/usr/bin/env node

/**
 * Run the v21 book-level pattern audit.
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/audit-book-patterns.ts \
 *     book-packages/indistractable.v21.json
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/audit-book-patterns.ts \
 *     indistractable --from-state
 *
 * Flags:
 *   --from-state             Treat first arg as bookId and load state/chapters from state/indexes/<bookId>.json
 *   --state-dir <path>       Override state directory
 *   --json                   Print raw JSON report
 *   --allow-missing-plans    Do not block on missing brief/plan sidecars
 *   --no-source              Skip source-sidecar alignment warnings
 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { ChapterV21 } from "../types.js";
import { runBookPatternAudit, formatBookPatternAuditReport } from "../critics/bookPatternAudit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_DIR = resolve(__dirname, "../../state");

type ParsedArgs = { args: string[]; flags: Record<string, string | boolean> };

function parseArgs(argv: string[]): ParsedArgs {
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = argv[i + 1];
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
  return { args, flags };
}

function usage(): never {
  console.error(`Usage:\n  audit-book-patterns.ts <book-package.json> [--json]\n  audit-book-patterns.ts <bookId> --from-state [--json]`);
  process.exit(2);
}

function loadFromPackage(pathArg: string): { bookId: string; chapters: ChapterV21[] } {
  const path = resolve(process.cwd(), pathArg);
  if (!existsSync(path)) throw new Error(`Package not found: ${path}`);
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const bookId = pkg.book?.bookId;
  if (!bookId) throw new Error(`Package missing book.bookId: ${path}`);
  if (!Array.isArray(pkg.chapters)) throw new Error(`Package missing chapters array: ${path}`);
  return { bookId, chapters: pkg.chapters as ChapterV21[] };
}

function loadFromState(bookId: string, stateDir: string): { bookId: string; chapters: ChapterV21[] } {
  const indexPath = resolve(stateDir, "indexes", `${bookId}.json`);
  if (!existsSync(indexPath)) throw new Error(`Chapter index not found: ${indexPath}`);
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as Array<{ chapterId: string; chapterNumber: number }>;
  const chapters: ChapterV21[] = [];
  const missing: string[] = [];
  for (const spec of index) {
    const chapterPath = resolve(stateDir, "chapters", `${spec.chapterId}.v21-native.chapter.json`);
    if (!existsSync(chapterPath)) {
      missing.push(`ch${String(spec.chapterNumber).padStart(2, "0")}`);
      continue;
    }
    chapters.push(JSON.parse(readFileSync(chapterPath, "utf8")) as ChapterV21);
  }
  if (missing.length) {
    console.error(`Note: ${missing.length} chapter(s) not generated yet: ${missing.join(", ")}`);
  }
  return { bookId, chapters };
}

async function main(): Promise<number> {
  const { args, flags } = parseArgs(process.argv.slice(2));
  if (args.length < 1) usage();

  const stateDir = typeof flags["state-dir"] === "string"
    ? resolve(process.cwd(), flags["state-dir"] as string)
    : DEFAULT_STATE_DIR;

  const loaded = flags["from-state"]
    ? loadFromState(args[0], stateDir)
    : loadFromPackage(args[0]);

  const report = runBookPatternAudit({
    bookId: loaded.bookId,
    chapters: loaded.chapters,
    stateDir,
    requirePlanArtifacts: flags["allow-missing-plans"] !== true,
    checkSourceAlignment: flags["no-source"] !== true,
  });

  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatBookPatternAuditReport(report));

  return report.passed ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  },
);
