/**
 * Model bake-off — CLI verb (`model-bakeoff`). Thin flag parsing over
 * runBakeoff(); all behavior lives in the conductor so tests drive it directly.
 */

import { existsSync, mkdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { createBookContentReader } from "../books/bookContentReader.js";
import { createBookWriteLock } from "../books/bookLease.js";
import { createCandidateStore } from "../books/candidateStore.js";
import { createCurrentPointerStore } from "../books/currentPointer.js";
import { normSlug } from "../lib/chapterPaths.js";
import { createReviewServiceFactory } from "../review/reviewService.js";
import { LegacyBakeoffStateAdapter } from "../release/legacyBakeoffStateAdapter.js";
import type { ReasoningEffort } from "./types.js";
import { bakeoffRoots, sha256File } from "./paths.js";
import { resolveBookIdForDraft } from "./intake.js";
import { reviewCandidate } from "./review.js";
import {
  DEFAULT_BAKEOFF_EFFORT,
  DEFAULT_BAKEOFF_MODELS,
  DEFAULT_JUDGE_EFFORT,
  DEFAULT_JUDGE_MODEL,
  runBakeoff,
} from "./runBakeoff.js";

const USAGE =
  `Usage: model-bakeoff [<bookId>] --draft <path.md|.txt|.pdf|.docx>\n` +
  `         [--models ${DEFAULT_BAKEOFF_MODELS.join(",")}] [--effort ${DEFAULT_BAKEOFF_EFFORT}]\n` +
  `         [--judge-model ${DEFAULT_JUDGE_MODEL}] [--judge-effort ${DEFAULT_JUDGE_EFFORT}]\n` +
  `         [--title "..."] [--author "..."] [--book-id id] [--run-id id]\n` +
  `         [--chapters 1,2,3] [--max-parallel 3] [--chapter-parallel 2]\n` +
  `         [--publish|--no-publish] [--plan] [--force] [--status] [--json]\n` +
  `       --chapters <subset> runs COMPARE-ONLY: selection + report, no promotion/QC/publish.`;

const EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);

function effortFlag(flags: Record<string, string | boolean>, name: string, fallback: ReasoningEffort): ReasoningEffort | null {
  const v = flags[name];
  if (v === undefined) return fallback;
  if (typeof v !== "string" || !EFFORTS.has(v)) return null;
  return v as ReasoningEffort;
}

function composeV4Bakeoff(bookId: string, runId: string): LegacyBakeoffStateAdapter {
  const roots = bakeoffRoots(bookId, runId);
  mkdirSync(roots.v4BooksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot: roots.v4BooksRoot, timeoutMs: 1_000, pollMs: 5 });
  const currentPointerStore = createCurrentPointerStore({ booksRoot: roots.v4BooksRoot, writeLock });
  const candidateStore = createCandidateStore({ booksRoot: roots.v4BooksRoot, writeLock, currentPointerStore });
  const contentReader = createBookContentReader({ booksRoot: roots.v4BooksRoot, currentPointerStore });
  const reviewService = createReviewServiceFactory({ booksRoot: roots.v4BooksRoot, contentReader }).create({
    async evaluate() {
      return { ok: false, error: { code: "SCREENING_ONLY", message: "bakeoff cannot run canonical review" } };
    },
  });
  return new LegacyBakeoffStateAdapter({
    roots,
    candidateStore,
    contentReader,
    reviewService,
    selectionReviewer: {
      root: roots.reviewsDir,
      review: ({ bookId: candidateBookId, label, chapters, deps, options }) =>
        reviewCandidate(candidateBookId, label, [...chapters], deps, roots, options),
    },
  });
}

export async function runModelBakeoffCli(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const json = flags["json"] === true;
  const draft = typeof flags["draft"] === "string" ? flags["draft"] : "";
  const bookIdFlag = typeof flags["book-id"] === "string" ? flags["book-id"] : undefined;
  const positionalBookId = args[0] && !args[0].startsWith("--") ? args[0] : undefined;
  const bookIdOpt = bookIdFlag ?? positionalBookId;

  if (!draft) {
    console.error(USAGE);
    console.error("model-bakeoff: --draft is required (the workflow is draft-intake-first).");
    return 2;
  }
  if (!existsSync(resolve(draft))) {
    console.error(`model-bakeoff: draft not found: ${resolve(draft)}`);
    return 2;
  }

  const effort = effortFlag(flags, "effort", DEFAULT_BAKEOFF_EFFORT);
  const judgeEffort = effortFlag(flags, "judge-effort", DEFAULT_JUDGE_EFFORT);
  if (!effort || !judgeEffort) {
    console.error(`model-bakeoff: --effort/--judge-effort must be one of ${[...EFFORTS].join("|")}`);
    return 2;
  }
  if (flags["publish"] === true) {
    console.error("model-bakeoff: --publish is unavailable; bakeoff selection authority is SCREENING_ONLY.");
    return 2;
  }
  const models = typeof flags["models"] === "string"
    ? flags["models"].split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  if (models && models.length < 2) {
    console.error("model-bakeoff: --models needs at least 2 comma-separated model ids for a comparison.");
    return 2;
  }
  const overrides = {
    title: typeof flags["title"] === "string" ? flags["title"] : undefined,
    author: typeof flags["author"] === "string" ? flags["author"] : undefined,
    bookId: bookIdOpt,
  };
  let chapters: number[] | undefined;
  if (typeof flags["chapters"] === "string") {
    chapters = flags["chapters"].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
    if (chapters.length === 0) {
      console.error("model-bakeoff: --chapters expects a comma-separated list of chapter numbers (e.g. 1,2,3)");
      return 2;
    }
  }

  // --status: print the run manifest (machine-readable state) and exit.
  if (flags["status"] === true) {
    const bookId = bookIdOpt ?? resolveBookIdForDraft(draft, overrides);
    const runId = typeof flags["run-id"] === "string" ? flags["run-id"] : `bo-${sha256File(resolve(draft)).slice(0, 10)}`;
    const roots = bakeoffRoots(bookId, runId);
    if (!existsSync(roots.manifestPath)) {
      console.error(`model-bakeoff: no run manifest at ${roots.manifestPath}`);
      return 1;
    }
    console.log(readFileSync(roots.manifestPath, "utf8").trim());
    return 0;
  }

  const resolvedBookId = normSlug(bookIdOpt ?? resolveBookIdForDraft(draft, overrides));
  const resolvedRunId = typeof flags["run-id"] === "string"
    ? flags["run-id"]
    : `bo-${sha256File(resolve(draft)).slice(0, 10)}`;

  const outcome = await runBakeoff({
    draftPath: draft,
    bookId: bookIdOpt,
    runId: typeof flags["run-id"] === "string" ? flags["run-id"] : undefined,
    models,
    effort,
    judgeModel: typeof flags["judge-model"] === "string" ? flags["judge-model"] : undefined,
    judgeEffort,
    maxParallel: typeof flags["max-parallel"] === "string" ? parseInt(flags["max-parallel"], 10) || undefined : undefined,
    chapterParallel: typeof flags["chapter-parallel"] === "string" ? parseInt(flags["chapter-parallel"], 10) || undefined : undefined,
    chapters,
    publish: false,
    plan: flags["plan"] === true,
    force: flags["force"] === true,
    overrides,
    v4: composeV4Bakeoff(resolvedBookId, resolvedRunId),
  });

  if (json) {
    console.log(JSON.stringify(outcome, null, 2));
  } else {
    console.log(`model-bakeoff: ${outcome.status}${outcome.winner ? ` — winner ${outcome.winner}` : ""}`);
    if (outcome.reason) console.log(outcome.reason);
    if (outcome.publicationQuestion) console.log(`QUESTION: ${outcome.publicationQuestion}`);
    if (outcome.reportMdPath) console.log(`report: ${outcome.reportMdPath}\n        ${outcome.reportJsonPath}`);
  }
  return outcome.status === "halt" ? 1 : 0;
}
