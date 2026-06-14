import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "fs";
import { dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

import { checkQcAttestation } from "../critics/qcAttestation.js";
import { runBookGate } from "../critics/bookGate.js";
import { runIntraBookChecks } from "../critics/intraBook.js";
import { runShipGate } from "../critics/finalGate.js";
import { checkKeyJudge } from "../critics/quizKeyGate.js";
import { deriveCategoriesAndTags } from "../agents/autoCategorize.js";
import { loadChapterIndex } from "../generateBook.js";
import { promoteBook } from "../promoteBook.js";
import { V21_SCHEMA_VERSION } from "../types.js";
import { CANONICAL_STATE, REPO_ROOT } from "../lib/chapterPaths.js";
import { checkManualKeyJudge, loadBookChapters } from "./manualKeyJudge.js";
import { unresolvedMajors } from "./majorDisposition.js";
import { qcRoundPath } from "./qcRound.js";
import { checkPlanEnforcement } from "./planEnforcement.js";
import { checkSourceV2Gate } from "./sourceV2Gate.js";
import { checkSweep } from "./sweep.js";
import { resolveBookIdentifier } from "./auto/resolveBook.js";
import { finalizeQcRound } from "./orchestrator/finalize.js";
import { effectiveLedger } from "./orchestrator/ledger.js";
import {
  evidenceMatrixPath,
  orchestratorRoundDir,
  qcSummaryPath,
  repairBriefPath,
  repairLedgerPath,
  repairPromptPath,
  roundRecordPath,
  submissionsDir,
  taskCardsDir,
} from "./orchestrator/artifacts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");

const ROLE_TOKEN_PATTERNS = [
  "cfq-sweep-",
  "cfq-keyA-",
  "cfq-keyB-",
  "cfq-bar-",
  "cfq-confirm-",
  "cfq-major-",
  "cfq-attest-",
];

export type PublishAfterQcOptions = {
  input: string;
  roundId: string;
  title?: string;
  author?: string;
  commit?: boolean;
  push?: boolean;
  cleanup?: "transient" | "none" | "audit-unsafe";
  includeState?: boolean;
  dryRun?: boolean;
};

export type PublishAfterQcResult = {
  ok: boolean;
  bookId?: string;
  roundId?: string;
  packagePath?: string;
  registeredFiles?: string[];
  cleaned?: string[];
  preserved?: string[];
  staged?: string[];
  commitHash?: string;
  pushed?: boolean;
  errors: string[];
  warnings: string[];
  next?: string[];
};

type Metadata = { title?: string; author?: string; source?: string };

type Runner = (cmd: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }) => string;

export type PublishAfterQcInternals = {
  runner?: Runner;
};

function readJson(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function rel(path: string): string {
  const r = relative(REPO_ROOT, path);
  return r && !r.startsWith("..") ? r : path;
}

function isInside(path: string, dir: string): boolean {
  const r = relative(dir, path);
  return r === "" || (!!r && !r.startsWith("..") && !r.startsWith("/"));
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const st = statSync(root);
  if (!st.isDirectory()) return [root];
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const path = resolve(root, name);
    const child = statSync(path);
    if (child.isDirectory()) out.push(...walkFiles(path));
    else out.push(path);
  }
  return out;
}

function safeRm(path: string): boolean {
  if (!existsSync(path)) return false;
  rmSync(path, { recursive: true, force: true });
  return true;
}

function ledgerHasOpenFindings(bookId: string, roundId: string): boolean {
  return effectiveLedger(bookId, roundId).some((f) =>
    f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun",
  );
}

export function transientCleanupPlan(bookId: string, roundId: string): { remove: string[]; preserve: string[] } {
  const roundDir = orchestratorRoundDir(bookId, roundId);
  const packDir = resolve(CANONICAL_STATE, "qc-packs", bookId, roundId);
  const remove = new Set<string>();
  const preserve = new Set<string>([
    evidenceMatrixPath(bookId, roundId),
    qcSummaryPath(bookId, roundId),
    repairLedgerPath(bookId, roundId),
  ]);

  const cards = taskCardsDir(bookId, roundId);
  if (existsSync(cards)) remove.add(cards);
  const workflow = resolve(roundDir, "qc-auto.workflow.js");
  if (existsSync(workflow)) remove.add(workflow);

  if (!ledgerHasOpenFindings(bookId, roundId)) {
    for (const p of [repairPromptPath(bookId, roundId), repairBriefPath(bookId, roundId)]) {
      if (existsSync(p)) remove.add(p);
    }
  } else {
    preserve.add(repairPromptPath(bookId, roundId));
    preserve.add(repairBriefPath(bookId, roundId));
  }

  for (const p of [...walkFiles(packDir), ...walkFiles(submissionsDir(bookId, roundId))]) {
    const base = p.split("/").pop() ?? "";
    if (base.endsWith(".input.json")) remove.add(p);
    if (base.toLowerCase().includes("token") && (isInside(p, packDir) || isInside(p, roundDir))) remove.add(p);
  }

  return {
    remove: [...remove].sort(),
    preserve: [...preserve].filter((p) => existsSync(p)).sort(),
  };
}

function defaultRunner(cmd: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): string {
  return execFileSync(cmd, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }) as string;
}

function git(args: string[], runner: Runner): string {
  return runner("git", args, { cwd: REPO_ROOT });
}

function cachedFiles(runner: Runner): string[] {
  return git(["diff", "--cached", "--name-only"], runner)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => resolve(REPO_ROOT, line));
}

function runPublishTests(runner: Runner): void {
  runner("npx", ["tsc", "-p", ".", "--noEmit"], { cwd: PIPELINE_DIR });
  runner("npx", ["tsx", "tests/run.ts", "qc-orchestrator", "qc-finalize", "no-api-promote", "qc-auto", "qc-submission", "publish-after-qc"], {
    cwd: PIPELINE_DIR,
    env: { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "1" },
  });
}

function roundExists(bookId: string, roundId: string): boolean {
  return existsSync(roundRecordPath(bookId, roundId)) || existsSync(qcRoundPath(bookId, roundId));
}

function packageMetadata(bookId: string): Metadata {
  const path = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);
  const pkg = readJson(path);
  return {
    title: typeof pkg?.book?.title === "string" ? pkg.book.title : undefined,
    author: typeof pkg?.book?.author === "string" ? pkg.book.author : undefined,
    source: existsSync(path) ? path : undefined,
  };
}

function briefMetadata(bookId: string): Metadata {
  const path = resolve(CANONICAL_STATE, "briefs", `${bookId}.manual-brief.json`);
  const brief = readJson(path);
  return {
    title: typeof brief?.title === "string" ? brief.title : undefined,
    author: typeof brief?.author === "string" ? brief.author : undefined,
    source: existsSync(path) ? path : undefined,
  };
}

function catalogMetadata(bookId: string): Metadata {
  const path = resolve(REPO_ROOT, "app/book/data/booksCatalog.metadata.json");
  const raw = readJson(path);
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.books) ? raw.books : Array.isArray(raw?.items) ? raw.items : [];
  const entry = rows.find((row: any) => row?.bookId === bookId || row?.id === bookId);
  return {
    title: typeof entry?.title === "string" ? entry.title : typeof entry?.book?.title === "string" ? entry.book.title : undefined,
    author: typeof entry?.author === "string" ? entry.author : typeof entry?.book?.author === "string" ? entry.book.author : undefined,
    source: entry ? path : undefined,
  };
}

function resolveMetadata(bookId: string, opts: Pick<PublishAfterQcOptions, "title" | "author">): { title?: string; author?: string; sources: string[] } {
  const sources: string[] = [];
  const candidates = [packageMetadata(bookId), briefMetadata(bookId), catalogMetadata(bookId)];
  let title = opts.title;
  let author = opts.author;
  for (const c of candidates) {
    if (c.source) sources.push(c.source);
    if (!title && c.title) title = c.title;
    if (!author && c.author) author = c.author;
  }
  return { title, author, sources };
}

function chapterSpecs(bookId: string) {
  try {
    return loadChapterIndex(bookId);
  } catch {
    return loadBookChapters(bookId)
      .sort((a, b) => a.number - b.number)
      .map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title }));
  }
}

function noApiPreflightBlockers(bookId: string): string[] {
  const chapters = loadBookChapters(bookId).sort((a, b) => a.number - b.number);
  const blockers: string[] = [];
  for (const ch of chapters) {
    const ship = runShipGate(ch);
    blockers.push(...ship.blockers.map((f) => `ship ch${ch.number} ${f.catalogId}: ${f.message}`));
    const intra = runIntraBookChecks(ch, chapters.filter((other) => other.number < ch.number));
    blockers.push(...intra.filter((f) => f.severity === "blocker").map((f) => `intra ch${ch.number} ${f.checkId}: ${f.message}`));
    blockers.push(...checkQcAttestation(ch, true).map((f) => `qc-status ch${ch.number} ${f.checkId}: ${f.message}`));
    blockers.push(...checkKeyJudge(ch, true, process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE === "1").map((f) => `quiz-key ch${ch.number} ${f.checkId}: ${f.message}`));
    blockers.push(...checkManualKeyJudge(ch, true).map((f) => `manual-keyjudge ch${ch.number} ${f.checkId}: ${f.message}`));
  }
  const bookGate = runBookGate(bookId, chapters);
  blockers.push(...bookGate.findings.filter((f) => f.severity === "blocker").map((f) => `book-gate ${f.catalogId}: ${f.message}`));
  blockers.push(...checkSourceV2Gate(bookId, chapters.map((ch) => ch.number)).findings.map((f) => `source-v2 ch${f.chapterNumber} ${f.checkId}: ${f.message}`));
  blockers.push(...checkPlanEnforcement(bookId, chapters).map((f) => `plan ch${f.chapterNumber} ${f.checkId}: ${f.message}`));
  blockers.push(...checkSweep(chapters, true).map((f) => `sweep ${f.checkId}: ${f.message}`));
  blockers.push(...unresolvedMajors(bookId, chapters, true).map((f) => `major ${f.id} ${f.scope} ${f.checkId}: ${f.message}`));
  return blockers;
}

function packageLooksV21(path: string): boolean {
  const pkg = readJson(path);
  return pkg?.schemaVersion === V21_SCHEMA_VERSION && Array.isArray(pkg?.chapters) && typeof pkg?.book?.bookId === "string";
}

function registryFiles(): string[] {
  return [
    resolve(REPO_ROOT, "app/book/data/bookPackages.ts"),
    resolve(REPO_ROOT, "app/book/data/booksCatalog.metadata.json"),
  ];
}

function readFiles(paths: string[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const p of paths) out.set(p, existsSync(p) ? readFileSync(p, "utf8") : null);
  return out;
}

function changedFiles(before: Map<string, string | null>, paths: string[]): string[] {
  return paths.filter((p) => (before.get(p) ?? null) !== (existsSync(p) ? readFileSync(p, "utf8") : null));
}

function durableStateFiles(bookId: string, roundId: string): string[] {
  const out: string[] = [];
  const chaptersDir = resolve(CANONICAL_STATE, "chapters");
  if (existsSync(chaptersDir)) {
    out.push(...readdirSync(chaptersDir)
      .filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
      .map((f) => resolve(chaptersDir, f)));
  }
  const index = resolve(CANONICAL_STATE, "indexes", `${bookId}.json`);
  if (existsSync(index)) out.push(index);
  const qcDir = resolve(CANONICAL_STATE, "qc");
  if (existsSync(qcDir)) {
    out.push(...readdirSync(qcDir)
      .filter((f) => f.startsWith(`${bookId}-`) || f === `${bookId}.sweep.json`)
      .filter((f) => f.endsWith(".qc.json") || f.endsWith(".manual-keyjudge.json") || f.endsWith(".sweep.json"))
      .map((f) => resolve(qcDir, f)));
  }
  for (const p of [evidenceMatrixPath(bookId, roundId), qcSummaryPath(bookId, roundId), repairLedgerPath(bookId, roundId)]) {
    if (existsSync(p)) out.push(p);
  }
  return [...new Set(out)].sort();
}

export function stagingPlan(bookId: string, roundId: string, opts: { includeState?: boolean; registeredFiles?: string[] } = {}): string[] {
  const out = [
    resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`),
    ...(opts.registeredFiles ?? registryFiles()).filter((p) => existsSync(p)),
  ];
  if (opts.includeState) out.push(...durableStateFiles(bookId, roundId));
  return [...new Set(out)].filter((p) => existsSync(p)).sort();
}

export function unsafePublishFiles(files: string[], opts: { allGreen?: boolean } = {}): string[] {
  const unsafe: string[] = [];
  for (const p of files) {
    const normalized = p.replace(/\\/g, "/");
    const base = normalized.split("/").pop() ?? "";
    if (normalized.includes("/task-cards/")) unsafe.push(p);
    if (base === "qc-auto.workflow.js") unsafe.push(p);
    if (opts.allGreen && base === "repair-prompt.md") unsafe.push(p);
    if (existsSync(p)) {
      const text = readFileSync(p, "utf8");
      if (ROLE_TOKEN_PATTERNS.some((pattern) => text.includes(pattern))) unsafe.push(p);
    }
  }
  return [...new Set(unsafe)].sort();
}

function stageAndMaybeCommit(args: {
  bookId: string;
  roundId: string;
  cleanup: string;
  registeredFiles: string[];
  includeState?: boolean;
  commit: boolean;
  push: boolean;
  runner: Runner;
  warnings: string[];
}): { staged: string[]; commitHash?: string; pushed?: boolean; errors: string[] } {
  const staged = stagingPlan(args.bookId, args.roundId, { includeState: args.includeState, registeredFiles: args.registeredFiles });
  const allowed = new Set(staged.map((p) => resolve(p)));
  const unsafe = unsafePublishFiles(staged, { allGreen: true });
  if (unsafe.length) {
    for (const p of unsafe) {
      try { git(["restore", "--staged", "--", p], args.runner); } catch {}
    }
    return { staged, errors: unsafe.map((p) => `Refusing to stage unsafe publish artifact: ${rel(p)}`) };
  }
  if (!args.commit) return { staged, errors: [] };

  if (staged.length === 0) return { staged, errors: ["No production files were available to stage."] };
  const preExistingStaged = cachedFiles(args.runner);
  const unsafePreExisting = unsafePublishFiles(preExistingStaged, { allGreen: true });
  if (unsafePreExisting.length) {
    for (const p of unsafePreExisting) {
      try { git(["restore", "--staged", "--", p], args.runner); } catch {}
    }
    return { staged, errors: unsafePreExisting.map((p) => `Refusing to commit unsafe pre-staged artifact: ${rel(p)}`) };
  }
  const unexpectedPreExisting = preExistingStaged.filter((p) => !allowed.has(resolve(p)));
  if (unexpectedPreExisting.length) {
    return {
      staged,
      errors: unexpectedPreExisting.map((p) => `Refusing to commit with pre-existing staged file outside publish plan: ${rel(p)}`),
    };
  }
  git(["add", "--", ...staged], args.runner);
  const cached = cachedFiles(args.runner);
  const unsafeCached = unsafePublishFiles(cached, { allGreen: true });
  if (unsafeCached.length) {
    for (const p of unsafeCached) {
      try { git(["restore", "--staged", "--", p], args.runner); } catch {}
    }
    return { staged, errors: unsafeCached.map((p) => `Refusing to commit unsafe staged artifact: ${rel(p)}`) };
  }
  const unexpectedCached = cached.filter((p) => !allowed.has(resolve(p)));
  if (unexpectedCached.length) {
    return {
      staged,
      errors: unexpectedCached.map((p) => `Refusing to commit staged file outside publish plan: ${rel(p)}`),
    };
  }
  git(["diff", "--check"], args.runner);
  git(["diff", "--cached", "--check"], args.runner);
  runPublishTests(args.runner);
  const msg = [
    `Publish ${args.bookId} v21 package`,
    "",
    `QC round: ${args.roundId}`,
    `Package: book-packages/${args.bookId}.v21.json`,
    `Cleanup: ${args.cleanup}`,
  ].join("\n");
  git(["commit", "-m", msg], args.runner);
  const commitHash = git(["rev-parse", "HEAD"], args.runner).trim();
  let pushed = false;
  if (args.push) {
    git(["push"], args.runner);
    pushed = true;
  }
  return { staged, commitHash, pushed, errors: [] };
}

function applyCleanup(bookId: string, roundId: string, cleanup: PublishAfterQcOptions["cleanup"], dryRun: boolean): { cleaned: string[]; preserved: string[]; warnings: string[] } {
  if (cleanup === "none") {
    const plan = transientCleanupPlan(bookId, roundId);
    return { cleaned: [], preserved: plan.preserve, warnings: [] };
  }
  const warnings = cleanup === "audit-unsafe" ? ["cleanup=audit-unsafe requested; durable final package, attestations, and registered app files are still preserved."] : [];
  const plan = transientCleanupPlan(bookId, roundId);
  const cleaned: string[] = [];
  for (const p of plan.remove) {
    if (dryRun || existsSync(p)) cleaned.push(p);
    if (!dryRun) safeRm(p);
  }
  return { cleaned, preserved: plan.preserve, warnings };
}

export function publishAfterQc(options: PublishAfterQcOptions, internals: PublishAfterQcInternals = {}): PublishAfterQcResult {
  const runner = internals.runner ?? defaultRunner;
  const cleanup = options.cleanup ?? "transient";
  const errors: string[] = [];
  const warnings: string[] = [];
  const next: string[] = [];
  const roundId = options.roundId;

  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC !== "1") {
    return {
      ok: false,
      roundId,
      errors: [
        "publish-after-qc requires CHAPTERFLOW_NO_API_CODEX_QC=1.",
        `Run: CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts publish-after-qc ${JSON.stringify(options.input)} --round ${roundId || "<roundId>"} --dry-run`,
      ],
      warnings,
      next,
    };
  }
  if (!options.input.trim() || !roundId) {
    return { ok: false, roundId, errors: ["Usage: publish-after-qc \"<book name or id>\" --round <roundId>"], warnings, next };
  }
  if (options.push === true && options.commit !== true && options.dryRun !== true) {
    return { ok: false, roundId, errors: ["--push requires --commit."], warnings, next };
  }

  const resolved = resolveBookIdentifier(options.input);
  if (resolved.ok === false) {
    const details = resolved.reason === "ambiguous" && resolved.candidates?.length
      ? ` Candidates: ${resolved.candidates.map((c) => `${c.bookId}${c.title ? ` (${c.title})` : ""}`).join(", ")}`
      : "";
    return { ok: false, roundId, errors: [`${resolved.message}${details}`], warnings, next };
  }
  const bookId = resolved.bookId;
  const repairPrompt = repairPromptPath(bookId, roundId);

  if (!roundExists(bookId, roundId)) {
    return {
      ok: false,
      bookId,
      roundId,
      errors: [`Missing QC round for ${bookId}/${roundId}. Expected ${roundRecordPath(bookId, roundId)} or ${qcRoundPath(bookId, roundId)}.`],
      warnings,
      next: [`CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass --round ${roundId}`],
    };
  }

  let finalized;
  try {
    finalized = finalizeQcRound(bookId, roundId, { attest: true });
  } catch (err) {
    return { ok: false, bookId, roundId, errors: [`QC finalization failed: ${(err as Error).message}`], warnings, next: [repairPrompt] };
  }
  if (finalized.errors.length) errors.push(...finalized.errors.map((e) => `finalize: ${e}`));
  if (!finalized.allPublishable || finalized.incomplete || finalized.repairRequired) {
    errors.push(`QC is not all-green: allPublishable=${finalized.allPublishable} incomplete=${finalized.incomplete} repairRequired=${finalized.repairRequired}.`);
    for (const d of finalized.chapters.filter((ch) => ch.finalVerdict !== "PUBLISHABLE").slice(0, 8)) {
      errors.push(`ch${String(d.chapterNumber).padStart(2, "0")} ${d.finalVerdict}: ${d.reason}`);
    }
  }
  const blockers = noApiPreflightBlockers(bookId);
  if (blockers.length) errors.push(...blockers.slice(0, 20));
  if (errors.length) {
    return {
      ok: false,
      bookId,
      roundId,
      errors,
      warnings,
      next: [
        `repair prompt: ${repairPrompt}`,
        `resume: CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass --round ${roundId}`,
      ],
    };
  }

  const meta = resolveMetadata(bookId, options);
  if (!meta.title || !meta.author) {
    return {
      ok: false,
      bookId,
      roundId,
      errors: [
        `Title/author could not be resolved for ${bookId}. Pass ${!meta.title ? "--title" : ""}${!meta.title && !meta.author ? " and " : ""}${!meta.author ? "--author" : ""}.`,
      ],
      warnings,
      next: [`CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts publish-after-qc ${JSON.stringify(bookId)} --round ${roundId} --title "..." --author "..." --dry-run`],
    };
  }

  const packagePath = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);
  let registeredFiles: string[] = [];
  let cleaned: string[] = [];
  let preserved: string[] = [];
  let staged: string[] = [];
  let commitHash: string | undefined;
  let pushed = false;

  if (options.dryRun) {
    const plan = applyCleanup(bookId, roundId, cleanup, true);
    warnings.push(...plan.warnings);
    cleaned = plan.cleaned;
    preserved = plan.preserved;
    staged = stagingPlan(bookId, roundId, { includeState: options.includeState });
    next.push(`would promote/register ${bookId} with title ${JSON.stringify(meta.title)} and author ${JSON.stringify(meta.author)}`);
    next.push(`would cleanup ${cleaned.length} transient artifact(s) using cleanup=${cleanup}`);
    next.push(`would stage ${staged.length} safe production artifact(s)${options.includeState ? " plus durable state" : ""}`);
    next.push(`would commit: ${options.commit === true ? "yes" : "no"}`);
    next.push(`would push: ${options.push === true ? "yes, after commit" : "no"}`);
    next.push(`publish: CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts publish-after-qc ${JSON.stringify(bookId)} --round ${roundId} --title ${JSON.stringify(meta.title)} --author ${JSON.stringify(meta.author)}`);
    if (options.commit || options.push) next.push("add --commit --push after reviewing the dry run");
    return { ok: true, bookId, roundId, packagePath, registeredFiles, cleaned, preserved, staged, pushed: false, errors, warnings, next };
  }

  try {
    const cats = deriveCategoriesAndTags(bookId, { title: meta.title, chapterTitles: chapterSpecs(bookId).map((c) => c.chapterTitle) });
    const promotion = promoteBook({
      bookId,
      title: meta.title,
      author: meta.author,
      chapters: chapterSpecs(bookId),
      categories: cats.categories,
      tags: cats.tags,
    });
    if (!promotion.promoted || !promotion.packagePath) {
      return { ok: false, bookId, roundId, errors: [`Promotion failed: ${promotion.reason}`], warnings, next: [`repair prompt: ${repairPrompt}`] };
    }
  } catch (err) {
    return { ok: false, bookId, roundId, errors: [`Promotion failed: ${(err as Error).message}`], warnings, next: [`repair prompt: ${repairPrompt}`] };
  }
  if (!existsSync(packagePath) || !packageLooksV21(packagePath)) {
    return { ok: false, bookId, roundId, packagePath, errors: [`Promoted package missing or not ${V21_SCHEMA_VERSION}: ${packagePath}`], warnings, next };
  }

  const registry = registryFiles();
  const beforeRegistry = readFiles(registry);
  try {
    runner("npx", ["tsx", "src/cli.ts", "register-web", bookId, "--skip-ingest"], {
      cwd: PIPELINE_DIR,
      env: { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "1" },
    });
    registeredFiles = changedFiles(beforeRegistry, registry);
  } catch (err) {
    return { ok: false, bookId, roundId, packagePath, errors: [`register-web failed: ${(err as Error).message}`], warnings, next };
  }

  const cleanupResult = applyCleanup(bookId, roundId, cleanup, false);
  warnings.push(...cleanupResult.warnings);
  cleaned = cleanupResult.cleaned;
  preserved = cleanupResult.preserved;

  try {
    const gitResult = stageAndMaybeCommit({
      bookId,
      roundId,
      cleanup,
      registeredFiles,
      includeState: options.includeState,
      commit: options.commit === true,
      push: options.push === true,
      runner,
      warnings,
    });
    staged = gitResult.staged;
    commitHash = gitResult.commitHash;
    pushed = gitResult.pushed ?? false;
    if (gitResult.errors.length) return { ok: false, bookId, roundId, packagePath, registeredFiles, cleaned, preserved, staged, errors: gitResult.errors, warnings, next };
  } catch (err) {
    return { ok: false, bookId, roundId, packagePath, registeredFiles, cleaned, preserved, staged, commitHash, pushed, errors: [`git/validation failed: ${(err as Error).message}`], warnings, next };
  }

  next.push("verify production route / app catalog");
  return { ok: true, bookId, roundId, packagePath, registeredFiles, cleaned, preserved, staged, commitHash, pushed, errors, warnings, next };
}

export function formatPublishAfterQcResult(result: PublishAfterQcResult): string {
  const book = result.bookId ?? "<unresolved>";
  const lines: string[] = [];
  lines.push(result.ok ? `PUBLISH AFTER QC PASS - ${book}` : `PUBLISH AFTER QC BLOCKED - ${book}`);
  if (result.roundId) lines.push(`round: ${result.roundId}`);
  if (result.packagePath) lines.push(`package: ${result.packagePath}`);
  if (result.registeredFiles?.length) {
    lines.push("registered:");
    for (const p of result.registeredFiles) lines.push(`  ${rel(p)}`);
  } else if (result.ok) {
    lines.push("registered: none changed");
  }
  if (result.cleaned) lines.push(`cleaned transient artifacts: ${result.cleaned.length}`);
  if (result.preserved) lines.push(`preserved audit artifacts: ${result.preserved.length}`);
  if (result.staged) {
    lines.push("staged plan:");
    for (const p of result.staged) lines.push(`  ${rel(p)}`);
  }
  lines.push(`commit: ${result.commitHash ?? "skipped"}`);
  lines.push(`push: ${result.pushed ? "success" : "skipped"}`);
  for (const w of result.warnings) lines.push(`warning: ${w}`);
  if (!result.ok && result.errors.length) {
    lines.push(`reason: ${result.errors[0]}`);
    if (result.next?.some((n) => n.startsWith("repair prompt:"))) lines.push(result.next.find((n) => n.startsWith("repair prompt:"))!);
    lines.push("no publish/commit/push performed");
  }
  if (result.next?.length) {
    lines.push("next:");
    for (const n of result.next) lines.push(`  ${n}`);
  }
  return lines.join("\n");
}
