/**
 * Researcher orchestrator. Given a book title and author, produces every
 * artifact the downstream v21 pipeline expects:
 *
 *   .chapterflow/runs/<bookId>/<runId>/
 *     source-freeze/
 *       toc.json                       (the bibliography record)
 *       book-source.md                 (the book-level paraphrase summary)
 *       source-freeze-report.md        (research provenance + confidence)
 *     sidecars/
 *       source/
 *         ch01.source.txt              (paraphrase notes for downstream agents)
 *         ch01.source.json             (structured form of the same content)
 *         ch02.source.txt
 *         ...
 *
 *   state/indexes/<bookId>.json        (ChapterSpec[] for loadChapterIndex)
 *
 * Steps:
 *   1. runBibliographyResearch(title, author) → BibliographyResult
 *   2. For each chapter (with concurrency limit): runChapterResearch(chapter)
 *      → ChapterResearchResult
 *   3. runSourceCoherenceCheck(bundle) → coherence report
 *   4. If coherence passes (no blockers), write all artifacts to disk
 *   5. Return refs for downstream (bookId, runId, chapterSpecs)
 *
 * Idempotent / resume-aware: if .chapterflow/runs/<bookId> exists, re-uses
 * the latest run and only researches chapters whose source files are missing.
 */

import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { BibliographyResult, flattenChapters, runResearcherBibliography } from "./agents/researcher-bibliography.js";
import {
  ChapterResearchInput,
  ChapterResearchResult,
  renderChapterSidecar,
  runResearcherChapter,
} from "./agents/researcher-chapter.js";
import {
  SourceCoherenceFinding,
  SourceCoherenceReport,
  formatSourceCoherenceReport,
  runSourceCoherenceCheck,
} from "./critics/sourceCoherence.js";
import { writeFileAtomic } from "./lib/atomicWrite.js";
import {
  DEFAULT_RESEARCH_LEASE_TTL_MS,
  RESEARCH_RUN_CODE_VERSION,
  ResearchCompatibility,
  ResearchRunManifest,
  acquireChapterClaim,
  appendResearchEvent,
  buildInitialResearchRunManifest,
  chapterKey,
  createResearchRunId,
  expectedChaptersHash,
  fileHash,
  findCompatibleResearchRun,
  hashJson,
  hashString,
  readResearchRunManifest,
  researchInputHash,
  sourceJsonPath,
  sourceTextPath,
  withManifestUpdateLock,
  writeResearchRunManifest,
} from "./lib/researchRunManifest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Repo-root anchored like every READER (source-loader, sourceGrounding,
// runDirs callers) — a cwd-relative anchor here meant research runs written
// from the documented pipeline-dir cwd landed where no reader looks.
const CHAPTERFLOW_RUNS = resolve(__dirname, "../../../../..", ".chapterflow/runs");
const STATE = resolve(__dirname, "../state");
const PROMPTS_DIR = resolve(__dirname, "../prompts");
const RESEARCH_RUN_CONFIG_VERSION = "research-config-2026-06-23.1";
const RAW_BIBLIOGRAPHY_REL_PATH = "source-freeze/bibliography.raw.json";

export type ResearchBookOptions = {
  /** Override the inferred bookId. */
  bookId?: string;
  /** Parallel chapter research concurrency. Default 3. */
  chapterConcurrency?: number;
  /** Logger. Defaults to console with timestamp. */
  logger?: (msg: string) => void;
  /** If true, abort on coherence blockers. Default true. */
  failOnCoherenceBlockers?: boolean;
  /** If true, re-research a chapter even if its source file already exists.
   *  Default false (resume-aware). */
  forceRefresh?: boolean;
  /** Test/tooling hook: override the run root. Defaults to repo .chapterflow/runs. */
  runsRoot?: string;
  /** Test/tooling hook: override the state root. Defaults to pipeline state/. */
  stateRoot?: string;
  /** Test/tooling hook: hermetic provider injection. Production uses the real providers. */
  deps?: Partial<ResearcherDeps>;
  /** Test/tooling hook: deterministic clocks for manifest/lease tests. */
  clock?: () => Date;
  /** Test/tooling hook: deterministic run-id entropy. Production uses randomUUID. */
  runIdEntropy?: () => string;
  /** Test/tooling hook: deterministic lease owner id. */
  ownerId?: string;
  /** Lease TTL for stale in-progress recovery. Default 30 minutes. */
  leaseTtlMs?: number;
  /** Test/tooling hook: override compatibility fingerprint fields. */
  compatibility?: Partial<ResearchCompatibility>;
};

export type ResearcherDeps = {
  runBibliography: typeof runResearcherBibliography;
  runChapter: (input: ChapterResearchInput) => Promise<ChapterResearchResult>;
};

export type ResearchBookResult = {
  bookId: string;
  runId: string;
  bibliography: BibliographyResult;
  chapters: ChapterResearchResult[];
  coherence: SourceCoherenceReport;
  bundlePath: string;                  // .chapterflow/runs/<bookId>/<runId>/
  chapterIndexPath: string;            // state/indexes/<bookId>.json
};

export type ChapterSpec = {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
};

export async function researchBook(
  title: string,
  author: string,
  options: ResearchBookOptions = {},
): Promise<ResearchBookResult> {
  const log = options.logger ?? ((m: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${m}`);
  });

  log(`=== researchBook: "${title}" by ${author} ===`);

  const deps: ResearcherDeps = {
    runBibliography: options.deps?.runBibliography ?? runResearcherBibliography,
    runChapter: options.deps?.runChapter ?? runResearcherChapter,
  };
  const runsRoot = options.runsRoot ?? CHAPTERFLOW_RUNS;
  const stateRoot = options.stateRoot ?? STATE;
  const clock = options.clock ?? (() => new Date());
  const leaseTtlMs = options.leaseTtlMs ?? DEFAULT_RESEARCH_LEASE_TTL_MS;
  const ownerId = options.ownerId ?? `research-${process.pid}-${randomUUID()}`;
  const compatibility = buildCompatibilityFingerprint(options);
  const inputIdentity = {
    title,
    author,
    bookIdHint: options.bookId ?? null,
    hash: researchInputHash({ title, author, bookIdHint: options.bookId }),
  };

  let bibliography: BibliographyResult | null = null;
  let manifest: ResearchRunManifest | null = null;
  let bundlePath: string | null = null;

  if (!options.forceRefresh) {
    const resume = findCompatibleResearchRun({
      runsRoot,
      bookIdHint: options.bookId,
      inputHash: inputIdentity.hash,
      compatibility,
    });
    if (resume.ok) {
      const loaded = loadRunBibliography(resume.runDir, resume.manifest);
      if (loaded) {
        bundlePath = resume.runDir;
        manifest = resume.manifest;
        bibliography = loaded;
        log(`Step 1/4: bibliography research skipped — resuming compatible run ${manifest.runId}`);
      } else {
        log(`Step 1/4: compatible run ${resume.manifest.runId} missing raw bibliography — creating a new run`);
      }
    } else if (resume.rejected.length > 0) {
      log(`Step 1/4: no compatible resumable run (${resume.rejected[0].reason})`);
    }
  }

  if (!bibliography) {
    // Step 1: Bibliography
    log("Step 1/4: bibliography research…");
    bibliography = await deps.runBibliography({
      title,
      author,
      bookIdHint: options.bookId,
    });
    log(`  bibliography: bookId=${bibliography.bookId}, ${bibliography.edition.chapterCount} chapters, confidence=${bibliography.confidence}`);
    if (bibliography.confidence === "low") {
      log(`  WARNING: low confidence. Notes: ${bibliography.notes ?? "(none)"}`);
    }

    const chapterList = flattenChapters(bibliography);
    const exactChapterHash = expectedChaptersHash(chapterList.map((ch) => ({ number: ch.number, title: ch.title })));
    if (!options.forceRefresh) {
      const resumeAfterBibliography = findCompatibleResearchRun({
        runsRoot,
        bookIdHint: bibliography.bookId,
        inputHash: inputIdentity.hash,
        compatibility,
        expectedChaptersHash: exactChapterHash,
      });
      if (resumeAfterBibliography.ok) {
        const loaded = loadRunBibliography(resumeAfterBibliography.runDir, resumeAfterBibliography.manifest);
        if (loaded) {
          bundlePath = resumeAfterBibliography.runDir;
          manifest = resumeAfterBibliography.manifest;
          bibliography = loaded;
          log(`  compatible run found after bibliography: ${manifest.runId}`);
        }
      }
    }

    if (!manifest) {
      const created = createResearchRun({
        runsRoot,
        bibliography,
        input: inputIdentity,
        compatibility,
        clock,
        runIdEntropy: options.runIdEntropy,
        log,
      });
      manifest = created.manifest;
      bundlePath = created.bundlePath;
    }
  }

  if (!manifest || !bundlePath) {
    throw new Error("research run initialization failed before chapter research");
  }
  let activeManifest = manifest;
  const activeBundlePath = bundlePath;

  const bookId = bibliography.bookId;
  const runId = activeManifest.runId;
  const sourceFreezeDir = resolve(activeBundlePath, "source-freeze");
  const sidecarsDir = resolve(activeBundlePath, "sidecars", "source");
  mkdirSync(sourceFreezeDir, { recursive: true });
  mkdirSync(sidecarsDir, { recursive: true });
  activeManifest = reconcileManifestBeforeResearch({
    manifest: activeManifest,
    bundlePath: activeBundlePath,
    ownerId,
    now: clock(),
    leaseTtlMs,
  });

  // Step 2: Chapter research (parallel with concurrency limit)
  log(`Step 2/4: chapter research (${bibliography.edition.chapterCount} chapters, concurrency=${options.chapterConcurrency ?? 3})…`);
  const chapterList = flattenChapters(bibliography);
  const chapters = await researchChaptersInParallel(
    bibliography,
    chapterList,
    {
      concurrency: options.chapterConcurrency ?? 3,
      bundlePath: activeBundlePath,
      manifest: activeManifest,
      ownerId,
      clock,
      leaseTtlMs,
      forceRefresh: options.forceRefresh ?? false,
      runChapter: deps.runChapter,
      log,
    },
  );
  log(`  chapter research complete: ${chapters.length}/${chapterList.length} produced`);

  // Step 3: Coherence check
  log("Step 3/4: source coherence check…");
  const coherence = runSourceCoherenceCheck({ bibliography, chapters });
  log("  " + formatSourceCoherenceReport(coherence).replace(/\n/g, "\n  "));
  updateManifest(activeBundlePath, runId, ownerId, clock, leaseTtlMs, (m, nowIso) => {
    m.coherence = {
      status: coherence.passed ? "passed" : "failed",
      checkedAt: nowIso,
      reportHash: hashString(formatSourceCoherenceReport(coherence)),
      blockerCount: coherence.findings.filter((f) => f.severity === "blocker").length,
    };
    m.overallStatus = coherence.passed ? "running" : "coherence_failed";
    appendResearchEvent(m, {
      type: coherence.passed ? "coherence.passed" : "coherence.failed",
      message: formatSourceCoherenceReport(coherence),
    }, nowIso);
  });

  if (!coherence.passed && options.failOnCoherenceBlockers !== false) {
    throw new Error(`Source coherence failed with ${coherence.findings.filter((f) => f.severity === "blocker").length} blocker(s). Inspect findings and re-run failing chapters with forceRefresh=true.`);
  }

  // Step 4: Write artifacts
  log("Step 4/4: writing artifacts…");
  writeFileAtomic(resolve(sourceFreezeDir, "book-source.md"), renderBookSource(bibliography, chapters));
  writeFileAtomic(resolve(sourceFreezeDir, "source-freeze-report.md"), renderProvenanceReport(bibliography, chapters, coherence));

  // Chapter index for loadChapterIndex
  const chapterIndexPath = resolve(stateRoot, "indexes", `${bookId}.json`);
  mkdirSync(dirname(chapterIndexPath), { recursive: true });
  const chapterSpecs: ChapterSpec[] = chapters.map((ch) => ({
    chapterId: `${bookId}-ch${String(ch.chapterNumber).padStart(2, "0")}`,
    chapterNumber: ch.chapterNumber,
    chapterTitle: ch.chapterTitle,
  }));
  writeFileAtomic(chapterIndexPath, `${JSON.stringify(chapterSpecs, null, 2)}\n`);
  updateManifest(activeBundlePath, runId, ownerId, clock, leaseTtlMs, (m, nowIso) => {
    m.overallStatus = "complete";
    appendResearchEvent(m, {
      type: "run.complete",
      message: "Research run completed and final source-freeze artifacts were written.",
    }, nowIso);
  });

  log(`=== researchBook done: ${activeBundlePath} ===`);

  return {
    bookId,
    runId,
    bibliography,
    chapters,
    coherence,
    bundlePath: activeBundlePath,
    chapterIndexPath,
  };
}

async function researchChaptersInParallel(
  bibliography: BibliographyResult,
  chapterList: Array<{ number: number; title: string }>,
  opts: {
    concurrency: number;
    bundlePath: string;
    manifest: ResearchRunManifest;
    ownerId: string;
    clock: () => Date;
    leaseTtlMs: number;
    forceRefresh: boolean;
    runChapter: ResearcherDeps["runChapter"];
    log: (m: string) => void;
  },
): Promise<ChapterResearchResult[]> {
  const results: ChapterResearchResult[] = new Array(chapterList.length);
  let cursor = 0;
  let firstError: Error | null = null;

  async function worker(workerId: number) {
    while (true) {
      if (firstError) return;
      const myIndex = cursor++;
      if (myIndex >= chapterList.length) return;
      const chapter = chapterList[myIndex];
      const numStr = chapterKey(chapter.number);

      const cached = !opts.forceRefresh ? loadSucceededChapter(opts.bundlePath, opts.manifest, chapter.number) : null;
      if (cached) {
        opts.log(`  ch${numStr} manifest-complete — skipping`);
        results[myIndex] = cached;
        continue;
      }

      const claim = acquireChapterClaim({
        runDir: opts.bundlePath,
        runId: opts.manifest.runId,
        chapterNumber: chapter.number,
        ownerId: opts.ownerId,
        now: opts.clock(),
        ttlMs: opts.leaseTtlMs,
      });
      if (!claim.ok) {
        const err = new Error(`ch${numStr} is already claimed (${claim.reason})`);
        opts.log(`  ch${numStr} SKIPPED: ${err.message}`);
        firstError = firstError ?? err;
        return;
      }

      opts.log(`  ch${numStr} (worker ${workerId}): "${chapter.title}"…`);
      const startedAt = Date.now();
      try {
        opts.manifest = updateManifest(opts.bundlePath, opts.manifest.runId, opts.ownerId, opts.clock, opts.leaseTtlMs, (m, nowIso) => {
          const entry = m.chapters[numStr];
          entry.status = "in_progress";
          entry.attempts += 1;
          entry.lease = claim.lease;
          entry.updatedAt = nowIso;
          m.overallStatus = "running";
          appendResearchEvent(m, {
            type: "chapter.claimed",
            chapterNumber: chapter.number,
            message: `Chapter ${chapter.number} claimed by ${opts.ownerId}.`,
          }, nowIso);
        });

        const priorTitles = chapterList.filter((c) => c.number < chapter.number).map((c) => c.title);
        const ch = await opts.runChapter({
          bibliography,
          chapter,
          priorChapterTitles: priorTitles,
        });
        writeChapterSidecars(opts.bundlePath, ch);
        opts.manifest = updateManifest(opts.bundlePath, opts.manifest.runId, opts.ownerId, opts.clock, opts.leaseTtlMs, (m, nowIso) => {
          const entry = m.chapters[numStr];
          entry.status = "succeeded";
          delete entry.lease;
          entry.outputJsonHash = fileHash(sourceJsonPath(opts.bundlePath, chapter.number));
          entry.outputTextHash = fileHash(sourceTextPath(opts.bundlePath, chapter.number));
          entry.completedAt = nowIso;
          entry.updatedAt = nowIso;
          appendResearchEvent(m, {
            type: "chapter.succeeded",
            chapterNumber: chapter.number,
            message: `Chapter ${chapter.number} sidecars were written and manifest status was committed.`,
          }, nowIso);
        });
        const durationMs = Date.now() - startedAt;
        opts.log(`  ch${numStr} done in ${(durationMs / 1000).toFixed(1)}s (${ch.paraphraseNotes.length}c paraphrase)`);
        results[myIndex] = ch;
      } catch (err) {
        opts.log(`  ch${numStr} FAILED: ${(err as Error).message}`);
        opts.manifest = updateManifest(opts.bundlePath, opts.manifest.runId, opts.ownerId, opts.clock, opts.leaseTtlMs, (m, nowIso) => {
          const entry = m.chapters[numStr];
          entry.status = "failed";
          delete entry.lease;
          entry.errors.push({
            at: nowIso,
            attempt: entry.attempts,
            message: (err as Error).message,
          });
          entry.updatedAt = nowIso;
          m.overallStatus = "failed";
          appendResearchEvent(m, {
            type: "chapter.failed",
            chapterNumber: chapter.number,
            message: (err as Error).message,
          }, nowIso);
        });
        firstError = firstError ?? (err as Error);
      } finally {
        claim.release();
      }
    }
  }

  await Promise.allSettled(
    Array.from({ length: Math.min(opts.concurrency, chapterList.length) }, (_, i) => worker(i + 1)),
  );
  if (firstError) throw firstError;

  return results;
}

function buildCompatibilityFingerprint(options: ResearchBookOptions): ResearchCompatibility {
  return {
    codeVersion: options.compatibility?.codeVersion ?? RESEARCH_RUN_CODE_VERSION,
    promptHash: options.compatibility?.promptHash ?? hashJson({
      bibliography: readFileSync(resolve(PROMPTS_DIR, "researcher-bibliography.system.md"), "utf8"),
      chapter: readFileSync(resolve(PROMPTS_DIR, "researcher-chapter.system.md"), "utf8"),
    }),
    configHash: options.compatibility?.configHash ?? hashJson({ version: RESEARCH_RUN_CONFIG_VERSION }),
    provider: options.compatibility?.provider ?? process.env.CHAPTERFLOW_PROVIDER ?? "anthropic-cli",
    model: options.compatibility?.model ?? process.env.CHAPTERFLOW_RESEARCHER_MODEL ?? "provider-default",
  };
}

function createResearchRun(args: {
  runsRoot: string;
  bibliography: BibliographyResult;
  input: { title: string; author: string; bookIdHint: string | null; hash: string };
  compatibility: ResearchCompatibility;
  clock: () => Date;
  runIdEntropy?: () => string;
  log: (m: string) => void;
}): { bundlePath: string; manifest: ResearchRunManifest } {
  const chapterList = flattenChapters(args.bibliography).map((ch) => ({ number: ch.number, title: ch.title }));
  let bundlePath = "";
  let runId = "";
  mkdirSync(resolve(args.runsRoot, args.bibliography.bookId), { recursive: true });
  for (let attempt = 0; attempt < 10; attempt++) {
    runId = createResearchRunId(args.clock(), args.runIdEntropy);
    bundlePath = resolve(args.runsRoot, args.bibliography.bookId, runId);
    try {
      mkdirSync(bundlePath, { recursive: false });
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST" || attempt === 9) throw err;
    }
  }
  const sourceFreezeDir = resolve(bundlePath, "source-freeze");
  mkdirSync(resolve(bundlePath, "sidecars", "source"), { recursive: true });
  mkdirSync(sourceFreezeDir, { recursive: true });

  writeFileAtomic(resolve(bundlePath, RAW_BIBLIOGRAPHY_REL_PATH), `${JSON.stringify(args.bibliography, null, 2)}\n`);
  writeFileAtomic(resolve(sourceFreezeDir, "toc.json"), `${JSON.stringify(bibliographyToTocJson(args.bibliography), null, 2)}\n`);

  const nowIso = args.clock().toISOString();
  const manifest = buildInitialResearchRunManifest({
    runId,
    bookId: args.bibliography.bookId,
    createdAt: nowIso,
    input: args.input,
    bibliographyHash: hashJson(args.bibliography),
    bibliographyPath: RAW_BIBLIOGRAPHY_REL_PATH,
    expectedChapters: chapterList,
    compatibility: args.compatibility,
  });
  writeResearchRunManifest(bundlePath, manifest);
  args.log(`  created research run: ${runId}`);
  return { bundlePath, manifest };
}

function loadRunBibliography(runDir: string, manifest: ResearchRunManifest): BibliographyResult | null {
  try {
    const path = resolve(runDir, manifest.bibliography.path);
    const bibliography = JSON.parse(readFileSync(path, "utf8")) as BibliographyResult;
    if (hashJson(bibliography) !== manifest.bibliography.hash) return null;
    return bibliography;
  } catch {
    return null;
  }
}

function reconcileManifestBeforeResearch(args: {
  manifest: ResearchRunManifest;
  bundlePath: string;
  ownerId: string;
  now: Date;
  leaseTtlMs: number;
}): ResearchRunManifest {
  return updateManifest(args.bundlePath, args.manifest.runId, args.ownerId, () => args.now, args.leaseTtlMs, (m, nowIso) => {
    for (const ch of m.expectedChapters) {
      const key = chapterKey(ch.number);
      const entry = m.chapters[key];
      const disk = readChapterSidecar(args.bundlePath, ch.number);

      if (disk && entry.status !== "succeeded") {
        entry.status = "succeeded";
        delete entry.lease;
        entry.outputJsonHash = disk.jsonHash;
        entry.outputTextHash = disk.textHash;
        entry.completedAt = entry.completedAt ?? nowIso;
        entry.updatedAt = nowIso;
        appendResearchEvent(m, {
          type: "chapter.recovered_sidecar",
          chapterNumber: ch.number,
          message: `Recovered chapter ${ch.number} from durable sidecars during resume.`,
        }, nowIso);
        continue;
      }

      if (entry.status === "succeeded" && (!disk || disk.jsonHash !== entry.outputJsonHash || disk.textHash !== entry.outputTextHash)) {
        entry.status = "failed";
        entry.errors.push({
          at: nowIso,
          attempt: entry.attempts,
          message: "Previously succeeded chapter sidecars are missing or hash-mismatched.",
        });
        delete entry.lease;
        delete entry.outputJsonHash;
        delete entry.outputTextHash;
        delete entry.completedAt;
        entry.updatedAt = nowIso;
        m.overallStatus = "failed";
        appendResearchEvent(m, {
          type: "chapter.output_missing",
          chapterNumber: ch.number,
          message: `Chapter ${ch.number} was marked succeeded but its sidecars are missing or changed.`,
        }, nowIso);
        continue;
      }

      if (entry.status === "in_progress" && leaseExpired(entry.lease, args.now)) {
        entry.status = "failed";
        entry.errors.push({
          at: nowIso,
          attempt: entry.attempts,
          message: "Stale in-progress chapter lease reclaimed for retry.",
        });
        delete entry.lease;
        entry.updatedAt = nowIso;
        m.overallStatus = "failed";
        appendResearchEvent(m, {
          type: "chapter.stale_reclaimed",
          chapterNumber: ch.number,
          message: `Chapter ${ch.number} had a stale in-progress lease and will be retried.`,
        }, nowIso);
      }
    }
  });
}

function updateManifest(
  bundlePath: string,
  runId: string,
  ownerId: string,
  clock: () => Date,
  leaseTtlMs: number,
  mutate: (manifest: ResearchRunManifest, nowIso: string) => void,
): ResearchRunManifest {
  return withManifestUpdateLock({
    runDir: bundlePath,
    runId,
    ownerId,
    now: clock(),
    ttlMs: leaseTtlMs,
    update: (manifest) => {
      const nowIso = clock().toISOString();
      mutate(manifest, nowIso);
      manifest.updatedAt = nowIso;
      return manifest;
    },
  });
}

function loadSucceededChapter(runDir: string, manifest: ResearchRunManifest, chapterNumber: number): ChapterResearchResult | null {
  const entry = manifest.chapters[chapterKey(chapterNumber)];
  if (!entry || entry.status !== "succeeded") return null;
  const disk = readChapterSidecar(runDir, chapterNumber);
  if (!disk) return null;
  if (disk.jsonHash !== entry.outputJsonHash || disk.textHash !== entry.outputTextHash) return null;
  return disk.chapter;
}

function readChapterSidecar(runDir: string, chapterNumber: number): { chapter: ChapterResearchResult; jsonHash: string; textHash: string } | null {
  const jsonPath = sourceJsonPath(runDir, chapterNumber);
  const textPath = sourceTextPath(runDir, chapterNumber);
  if (!existsSync(jsonPath) || !existsSync(textPath)) return null;
  try {
    const chapter = JSON.parse(readFileSync(jsonPath, "utf8")) as ChapterResearchResult;
    if (chapter.chapterNumber !== chapterNumber) return null;
    return {
      chapter,
      jsonHash: fileHash(jsonPath),
      textHash: fileHash(textPath),
    };
  } catch {
    return null;
  }
}

function writeChapterSidecars(runDir: string, chapter: ChapterResearchResult): void {
  writeFileAtomic(sourceTextPath(runDir, chapter.chapterNumber), renderChapterSidecar(chapter));
  writeFileAtomic(sourceJsonPath(runDir, chapter.chapterNumber), `${JSON.stringify(chapter, null, 2)}\n`);
}

function leaseExpired(lease: { expiresAt?: string } | undefined, now: Date): boolean {
  if (!lease) return true;
  const expiresAtMs = Date.parse(lease.expiresAt ?? "");
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime();
}

/** Convert a BibliographyResult to the toc.json shape expected by
 *  source-loader.loadTableOfContents and the upload-book-package pipeline. */
function bibliographyToTocJson(b: BibliographyResult): object {
  const toc: any = {
    title: b.title,
    author: b.author,
    edition: {
      name: b.edition.name,
      publisher: b.edition.publisher,
      publishedYear: b.edition.publishedYear,
      isbn13: b.edition.isbn13,
      language: b.edition.language ?? "English",
      chapterCount: b.edition.chapterCount,
      sectionCount: b.edition.sectionCount,
    },
  };
  if (b.introduction) toc.introduction = b.introduction;
  if (b.sections && b.sections.length > 0) {
    toc.sections = b.sections;
  } else {
    toc.chapters = b.flatChapters ?? [];
  }
  return toc;
}

/** Render the book-source.md companion file. Contains the bibliography's
 *  thesis + teachingArc, plus a per-chapter index of central concepts.
 *  Downstream editor-in-chief reads this for book-level grounding. */
function renderBookSource(b: BibliographyResult, chapters: ChapterResearchResult[]): string {
  const lines: string[] = [];
  lines.push(`# ${b.title}`);
  lines.push(`by ${b.author}`);
  lines.push("");
  if (b.edition.publishedYear) lines.push(`Published ${b.edition.publishedYear}.`);
  if (b.edition.publisher) lines.push(`Publisher: ${b.edition.publisher}.`);
  lines.push("");
  lines.push(`## Thesis`);
  lines.push(b.thesis);
  lines.push("");
  lines.push(`## Teaching arc`);
  lines.push(b.teachingArc);
  lines.push("");
  lines.push(`## Author voice`);
  lines.push(`Register: ${b.authorVoice.register}.`);
  lines.push(`Signature moves:`);
  for (const m of b.authorVoice.signatureMoves) lines.push(`- ${m}`);
  lines.push(`Avoid moves:`);
  for (const m of b.authorVoice.avoidMoves) lines.push(`- ${m}`);
  lines.push("");
  lines.push(`## Chapter index of central concepts`);
  const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  for (const ch of sorted) {
    lines.push(`### Ch${ch.chapterNumber}. ${ch.chapterTitle}`);
    lines.push(`Central concept: ${ch.centralConcept.name}.`);
    lines.push(`Core claim: ${ch.coreClaim}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderProvenanceReport(
  b: BibliographyResult,
  chapters: ChapterResearchResult[],
  coherence: SourceCoherenceReport,
): string {
  const lines: string[] = [];
  lines.push(`# Source-freeze provenance — ${b.bookId}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Title: ${b.title}`);
  lines.push(`Author: ${b.author}`);
  lines.push(`Chapter count: ${b.edition.chapterCount}`);
  lines.push(`Bibliography confidence: ${b.confidence}`);
  if (b.notes) lines.push(`Bibliography notes: ${b.notes}`);
  lines.push("");
  lines.push(`## Per-chapter paraphrase lengths`);
  for (const ch of [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)) {
    lines.push(`- Ch${ch.chapterNumber}: ${ch.paraphraseNotes.length} chars, ${ch.namedExamples.length} named examples`);
  }
  lines.push("");
  lines.push(`## Source coherence`);
  lines.push(formatSourceCoherenceReport(coherence));
  return lines.join("\n");
}

/** Find the most recent runId for an existing bookId. Returns null if no
 *  research has been run for this book. */
export function findLatestResearchRun(bookId: string): string | null {
  const bookDir = resolve(CHAPTERFLOW_RUNS, bookId);
  if (!existsSync(bookDir)) return null;
  const runs = readdirSync(bookDir)
    .filter((runId) => statSync(resolve(bookDir, runId)).isDirectory())
    .map((runId) => {
      const parsed = readResearchRunManifest(resolve(bookDir, runId));
      return {
        runId,
        createdAtMs: parsed.ok ? Date.parse(parsed.manifest.createdAt) : null,
      };
    })
    .sort((a, b) => {
      if (a.createdAtMs !== null || b.createdAtMs !== null) {
        const at = a.createdAtMs ?? -1;
        const bt = b.createdAtMs ?? -1;
        if (at !== bt) return at - bt;
      }
      return a.runId.localeCompare(b.runId);
    });
  return runs.length > 0 ? runs[runs.length - 1].runId : null;
}

/** Best-effort: check whether a chapter index already exists for a book.
 *  Used by the CLI to decide whether to run the researcher or skip straight
 *  to generation. */
export function hasChapterIndex(bookId: string): boolean {
  return existsSync(resolve(STATE, "indexes", `${bookId}.json`));
}

/** Convert a book title to a slug. The researcher self-reports a slug too,
 *  but the CLI uses this for quick "is there already a run?" checks before
 *  any model call. */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .join("-");
}
