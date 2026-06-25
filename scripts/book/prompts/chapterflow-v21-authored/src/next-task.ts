/**
 * next-task — operator helper. Given a bookId, scans the on-disk state and
 * tells the operator (the Claude session) what artifact to produce next.
 *
 * Operator workflow (inline mode, no subprocess):
 *   1. `npx tsx src/cli.ts next-task <bookId>`
 *   2. Read the printed playbook + paths.
 *   3. Produce the artifact, save to the printed path.
 *   4. (Optional) Run the printed validation command.
 *   5. Re-run next-task; loop until "all done".
 *
 * Order of artifacts:
 *   a. .chapterflow/runs/<bookId>/<runId>/source-freeze/toc.json
 *   b. .chapterflow/runs/<bookId>/<runId>/sidecars/source/chNN.source.json × N
 *   c. state/indexes/<bookId>.json
 *   d. state/chapters/<bookId>-chNN.v21-native.chapter.json × N
 *   e. (manual) generate-book --no-categorizer to assemble + book gate + promote
 */

import { existsSync, readFileSync } from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { createResearchRunId } from "./lib/researchRunManifest.js";
import { findLatestRunDir } from "./lib/runDirs.js";
import { flattenTocChapters, formatTocIssues, parseTocFile } from "./lib/tocContract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "../../../../..");
const RUNS_DIR = resolve(REPO, ".chapterflow/runs");
const STATE_DIR = resolve(__dirname, "../state");
const PROMPTS_DIR = resolve(__dirname, "../agent-prompts");

export type NextTaskRoots = {
  runsDir?: string;
  stateDir?: string;
  promptsDir?: string;
  repoRoot?: string;
};

type NextTask =
  | { kind: "research-bibliography"; bookId: string; path: string; playbook: string }
  | { kind: "research-chapter"; bookId: string; chapterNumber: number; chapterTitle: string; path: string; playbook: string }
  | { kind: "chapter-index"; bookId: string; path: string }
  | { kind: "write-chapter"; bookId: string; chapterNumber: number; chapterTitle: string; chapterId: string; sourcePath: string; outputPath: string; playbook: string }
  | { kind: "derive-artifacts"; bookId: string; missingBriefPath: string; missingPlanPaths: string[] }
  | { kind: "finalize"; bookId: string; playbook: string }
  | { kind: "all-done"; bookId: string };

export function findLatestRun(bookId: string, roots: NextTaskRoots = {}): string | null {
  const runDir = findLatestRunDir(roots.runsDir ?? RUNS_DIR, bookId);
  return runDir ? basename(runDir) : null;
}

/** Compute the next missing artifact in the operator workflow for one book. */
export function computeNextTask(bookId: string, roots: NextTaskRoots = {}): NextTask {
  const runsDir = roots.runsDir ?? RUNS_DIR;
  const stateDir = roots.stateDir ?? STATE_DIR;
  const promptsDir = roots.promptsDir ?? PROMPTS_DIR;
  const repoRoot = roots.repoRoot ?? REPO;
  // a. Bibliography (toc.json) must exist first.
  const runId = findLatestRun(bookId, { runsDir });
  if (!runId) {
    // No run dir yet — operator needs to create the directory and the toc.
    const newRunId = makeRunId();
    const path = resolve(runsDir, bookId, newRunId, "source-freeze", "toc.json");
    return {
      kind: "research-bibliography",
      bookId,
      path,
      playbook: resolve(promptsDir, "STEP-1-RESEARCH.md"),
    };
  }

  const tocPath = resolve(runsDir, bookId, runId, "source-freeze", "toc.json");
  if (!existsSync(tocPath)) {
    return {
      kind: "research-bibliography",
      bookId,
      path: tocPath,
      playbook: resolve(promptsDir, "STEP-1-RESEARCH.md"),
    };
  }

  const tocParsed = parseTocFile(tocPath, { bookId });
  if (!tocParsed.ok) throw new Error(`Bibliography at ${tocPath} is invalid — ${formatTocIssues(tocParsed.issues)}`);
  const flatChapters = flattenTocChapters(JSON.parse(readFileSync(tocPath, "utf8")), { bookId, path: tocPath });

  // b. Each chapter source.
  const sourceDir = resolve(runsDir, bookId, runId, "sidecars", "source");
  for (const ch of flatChapters) {
    const numStr = String(ch.number).padStart(2, "0");
    const sourcePath = resolve(sourceDir, `ch${numStr}.source.json`);
    if (!existsSync(sourcePath)) {
      return {
        kind: "research-chapter",
        bookId,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        path: sourcePath,
        playbook: resolve(promptsDir, "STEP-1-RESEARCH.md"),
      };
    }
  }

  // c. Chapter index.
  const indexPath = resolve(stateDir, "indexes", `${bookId}.json`);
  if (!existsSync(indexPath)) {
    return { kind: "chapter-index", bookId, path: indexPath };
  }

  // d. Each chapter output (the big one). Iterate using the chapter index so
  //    the chapterIds match what generate-book will look for. Falls back to
  //    the computed format <bookId>-ch<NN> if the index has no entry.
  const chapterIndex: Array<{ chapterId: string; chapterNumber: number; chapterTitle: string }> =
    JSON.parse(readFileSync(indexPath, "utf8"));
  const indexByNumber = new Map(chapterIndex.map((c) => [c.chapterNumber, c]));

  for (const ch of flatChapters) {
    const numStr = String(ch.number).padStart(2, "0");
    const spec = indexByNumber.get(ch.number);
    const chapterId = spec?.chapterId ?? `${bookId}-ch${numStr}`;
    const outputPath = resolve(stateDir, "chapters", `${chapterId}.v21-native.chapter.json`);
    const sourcePath = resolve(sourceDir, `ch${numStr}.source.json`);
    if (!existsSync(outputPath)) {
      return {
        kind: "write-chapter",
        bookId,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        chapterId,
        sourcePath,
        outputPath,
        playbook: resolve(promptsDir, "STEP-2-WRITE-CHAPTERS.md"),
      };
    }
  }

  // e. Derived artifacts (brief + per-chapter plan stubs). The BP7 book-pattern
  //    audit requires <bookId>.manual-brief.json AND <chapterId>.manual-plan.json
  //    per chapter to exist under state/briefs and state/plans respectively;
  //    these are not produced by the inline-operator playbooks directly but can
  //    be derived from the bibliography + cached chapters via `derive-artifacts`.
  const briefPath = resolve(stateDir, "briefs", `${bookId}.manual-brief.json`);
  const briefFallbackPath = resolve(stateDir, "briefs", `${bookId}.brief.json`);
  const missingBrief = !existsSync(briefPath) && !existsSync(briefFallbackPath);
  const missingPlanPaths: string[] = [];
  for (const ch of flatChapters) {
    const numStr = String(ch.number).padStart(2, "0");
    const spec = indexByNumber.get(ch.number);
    const chapterId = spec?.chapterId ?? `${bookId}-ch${numStr}`;
    const planManual = resolve(stateDir, "plans", `${chapterId}.manual-plan.json`);
    const planFallback = resolve(stateDir, "plans", `${chapterId}.plan.json`);
    if (!existsSync(planManual) && !existsSync(planFallback)) {
      missingPlanPaths.push(planManual);
    }
  }
  if (missingBrief || missingPlanPaths.length > 0) {
    return {
      kind: "derive-artifacts",
      bookId,
      missingBriefPath: briefPath,
      missingPlanPaths,
    };
  }

  // f. Finalize.
  const packagePath = resolve(repoRoot, "book-packages", `${bookId}.v21.json`);
  if (!existsSync(packagePath)) {
    return {
      kind: "finalize",
      bookId,
      playbook: resolve(promptsDir, "STEP-3-FINALIZE.md"),
    };
  }

  return { kind: "all-done", bookId };
}

export function formatNextTask(task: NextTask): string {
  const lines: string[] = [];
  switch (task.kind) {
    case "research-bibliography":
      lines.push("=== NEXT TASK: research-bibliography ===");
      lines.push(`Book: ${task.bookId}`);
      lines.push("");
      lines.push(`Read playbook: ${task.playbook}`);
      lines.push("");
      lines.push(`Produce: a BibliographyResult JSON object (see researcher-bibliography.system.md schema).`);
      lines.push(`Save to: ${task.path}`);
      lines.push("");
      lines.push("After saving, re-run `next-task` to see what's next.");
      break;

    case "research-chapter":
      lines.push("=== NEXT TASK: research-chapter ===");
      lines.push(`Book: ${task.bookId}`);
      lines.push(`Chapter: ${task.chapterNumber} — "${task.chapterTitle}"`);
      lines.push("");
      lines.push(`Read playbook: ${task.playbook}`);
      lines.push(`Read schema:   scripts/book/prompts/chapterflow-v21-authored/prompts/researcher-chapter.system.md`);
      lines.push("");
      lines.push(`Produce: a ChapterResearchResult JSON object for chapter ${task.chapterNumber}.`);
      lines.push(`Save to: ${task.path}`);
      lines.push(`Also write the .txt sidecar via renderChapterSidecar (see playbook).`);
      lines.push("");
      lines.push("After saving, re-run `next-task` to see what's next.");
      break;

    case "chapter-index":
      lines.push("=== NEXT TASK: write chapter-index ===");
      lines.push(`Book: ${task.bookId}`);
      lines.push("");
      lines.push(`Produce: ChapterSpec[] JSON array, one entry per chapter from the bibliography.`);
      lines.push(`Shape:`);
      lines.push(`  [{ "chapterId": "${task.bookId}-ch01", "chapterNumber": 1, "chapterTitle": "..." }, ...]`);
      lines.push(`Save to: ${task.path}`);
      lines.push("");
      lines.push("This file is read by generate-book and the next-task helper to know what chapters exist.");
      break;

    case "write-chapter":
      lines.push("=== NEXT TASK: write-chapter ===");
      lines.push(`Book: ${task.bookId}`);
      lines.push(`Chapter ${task.chapterNumber}: "${task.chapterTitle}"`);
      lines.push(`chapterId: ${task.chapterId}`);
      lines.push("");
      lines.push(`Read playbook: ${task.playbook}`);
      lines.push(`Read source:   ${task.sourcePath}`);
      lines.push("");
      lines.push(`Produce: a complete ChapterV21 JSON object (see src/types.ts:364).`);
      lines.push(`Save to: ${task.outputPath}`);
      lines.push("");
      lines.push(`Validate with:`);
      lines.push(`  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter ${task.outputPath}`);
      lines.push("");
      lines.push("If the ship gate blocks, fix the offending fields in the JSON and re-run the gate. When PASS, re-run next-task.");
      break;

    case "derive-artifacts":
      lines.push("=== NEXT TASK: derive-artifacts ===");
      lines.push(`Book: ${task.bookId}`);
      lines.push("");
      lines.push(`Every chapter has been produced. The book-pattern audit (BP7) requires manual brief + plan stubs.`);
      lines.push(`Derive them by running:`);
      lines.push(`  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts derive-artifacts ${task.bookId}`);
      lines.push("");
      lines.push(`This writes:`);
      lines.push(`  ${task.missingBriefPath}`);
      for (const p of task.missingPlanPaths.slice(0, 5)) lines.push(`  ${p}`);
      if (task.missingPlanPaths.length > 5) {
        lines.push(`  ... and ${task.missingPlanPaths.length - 5} more`);
      }
      lines.push("");
      lines.push("After running, re-run next-task.");
      break;

    case "finalize":
      lines.push("=== NEXT TASK: finalize ===");
      lines.push(`Book: ${task.bookId}`);
      lines.push("");
      lines.push(`Read playbook: ${task.playbook}`);
      lines.push("");
      // Honesty: this ladder is file-EXISTENCE based — it has not run any gate.
      // Promotion re-runs the full stack (ship + intra-book + book + QC
      // attestations) and may block; don't promise "ship-gated" here.
      lines.push(`Every chapter file exists on disk (NOT gate-verified — promotion re-runs the full gate stack). Finalize via:`);
      lines.push(`  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate-book ${task.bookId} \\`);
      lines.push(`    --title "<title>" --author "<author>" \\`);
      lines.push(`    --no-categorizer \\`);
      lines.push(`    --categories "<2-4 comma-separated>" \\`);
      lines.push(`    --tags "<4-8 comma-separated>"`);
      lines.push("");
      lines.push("If the book gate blocks, the report names which chapter / which check. Fix and re-run.");
      break;

    case "all-done":
      lines.push("=== ALL DONE ===");
      lines.push(`Book ${task.bookId} is shipped to book-packages/.`);
      break;
  }
  return lines.join("\n");
}

function makeRunId(): string {
  return createResearchRunId();
}
