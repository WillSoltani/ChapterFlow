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
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import {
  type BibliographyInput,
  type BibliographyResult,
  flattenChapters,
} from "./agents/researcher-bibliography.js";
import {
  type ChapterResearchInput,
  type ChapterResearchResult,
  renderChapterSidecar,
} from "./agents/researcher-chapter.js";
import { MODEL_CALLER_PROFILES, MODEL_TASK_RUNNER_REQUIRED } from "./app/modelTaskRunner.js";
import {
  SourceCoherenceFinding,
  SourceCoherenceReport,
  formatSourceCoherenceReport,
  runSourceCoherenceCheck,
} from "./critics/sourceCoherence.js";
import { writeFileAtomic } from "./lib/atomicWrite.js";
import { formatSourceV2GateReport, type SourceV2GateReport } from "./qc/sourceV2Gate.js";
import { evaluateSourceV2Integrity } from "./source/sourceIntegrity.js";
import { buildCanonicalToc } from "./lib/tocContract.js";
import { chapterSpanText, resolveChapterMap, type ChapterMapV1 } from "./source/chapterMap.js";
import { ingestSourceText, type IngestedSourceText, type SourceTextProvenance } from "./source/sourceText.js";
import { collectSourceQuoteProblems } from "./source/sourceQuoteGrounding.js";
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
  listResearchRunIds,
  pathWithin,
  pinnedResearchRunDir,
  readResearchRunManifest,
  researchConfigHash,
  researchInputHash,
  researchRunManifestPath,
  researchRunPinRejectionReasons,
  RESEARCH_RUN_MANIFEST_FILE,
  sourceJsonPath,
  sourceTextPath,
  withManifestUpdateLock,
  writeResearchRunManifest,
} from "./lib/researchRunManifest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Repo-root anchored like every READER (source-loader, sourceGrounding,
// runDirs callers) — a cwd-relative anchor here meant research runs written
// from the documented pipeline-dir cwd landed where no reader looks.
const CHAPTERFLOW_RUNS = resolve(__dirname, "../.chapterflow/runs");
const STATE = resolve(__dirname, "../state");
const PROMPTS_DIR = resolve(__dirname, "../prompts");
const RAW_BIBLIOGRAPHY_REL_PATH = "source-freeze/bibliography.raw.json";
/** R-046: the FROZEN copy of the operator's source text. Every stage after
 *  ingestion reads this, never the path the operator passed, so a text edited
 *  mid-run cannot silently change what the book was written from. */
export const SOURCE_TEXT_REL_PATH = "source-freeze/source-text.txt";
/** The resolved, validated chapter map (offsets into the frozen text). */
export const CHAPTER_MAP_REL_PATH = "source-freeze/chapter-map.json";

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
  /** Optional: validate a durable/cached chapter sidecar before REUSING it on a
   *  resume. Returns false to reject the cached chapter and re-research it — e.g.
   *  a durable sidecar that still parses and hash-matches its manifest entry but
   *  no longer passes the caller's source-v2 route validator. Never expected to
   *  throw; a throwing validator is treated as reject (re-research), never a
   *  crash. Default: accept every cached chapter. */
  validateReusedChapter?: (chapter: ChapterResearchResult) => boolean;
  /** Operator-supplied pin naming an EXISTING research run directory under
   *  <runsRoot>/<bookId>/. Resolve-then-adopt: the pinned run's own bibliography
   *  is loaded (hash-verified) and NO bibliography model call is made, so every
   *  chapter reuses its durable sidecar and every downstream section-pack cache
   *  key stays stable. Mutually exclusive with forceRefresh. Requires bookId.
   *  Fails closed on ANY validation failure — it NEVER falls back to scanning
   *  (findCompatibleResearchRun) or to creating a run (createResearchRun),
   *  because either fallback would silently charge a full re-research while the
   *  operator believes they pinned, and would turn the pin into a
   *  research-substitution primitive. */
  pinnedRunId?: string;
  /** Test/tooling hook: override the run root. Defaults to repo .chapterflow/runs. */
  runsRoot?: string;
  /** Test/tooling hook: override the state root. Defaults to pipeline state/. */
  stateRoot?: string;
  /** Explicit application wiring. Tests supply deterministic fakes. */
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
  /**
   * R-046 — absolute path to the book's own UTF-8 text. When present the text is
   * normalized, hashed into the run's input identity, FROZEN into the run
   * directory, mapped to chapter spans, and handed to every chapter researcher,
   * which must then quote it for every checkable item. When absent the run is
   * recorded as `model-memory` and behaves exactly as it did before.
   */
  sourceTextPath?: string;
  /**
   * R-277 — the book's fact pins. They already reach the section writers and the
   * repair port; passing them here corrects the sidecar AT BIRTH instead of one
   * layer downstream of where the fact is decided.
   */
  factPins?: readonly string[];
};

export type ResearcherDeps = {
  runBibliography: (input: BibliographyInput) => Promise<BibliographyResult>;
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
  /** R-046 — "source-text" when this run read the book, "model-memory" when it
   *  did not. Carried to the seed candidate. */
  sourceProvenance: SourceTextProvenance;
  /** Present only on a source-text run. */
  sourceText?: { sha256: string; byteLength: number; originPath: string; frozenPath: string };
  /** Present only on a source-text run: the validated chapter map. */
  chapterMap?: ChapterMapV1;
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

  if (!options.deps?.runBibliography || !options.deps.runChapter) {
    throw new Error(MODEL_TASK_RUNNER_REQUIRED);
  }
  const deps: ResearcherDeps = {
    runBibliography: options.deps.runBibliography,
    runChapter: options.deps.runChapter,
  };
  const runsRoot = options.runsRoot ?? CHAPTERFLOW_RUNS;
  const stateRoot = options.stateRoot ?? STATE;
  const clock = options.clock ?? (() => new Date());
  const leaseTtlMs = options.leaseTtlMs ?? DEFAULT_RESEARCH_LEASE_TTL_MS;
  const ownerId = options.ownerId ?? `research-${process.pid}-${randomUUID()}`;
  const compatibility = buildCompatibilityFingerprint(options);
  // R-046 — ingest FIRST: the text's digest is part of the run's input identity,
  // so a run started with one text can never be resumed against another.
  const ingested: IngestedSourceText | null = options.sourceTextPath === undefined
    ? null
    : ingestSourceText(options.sourceTextPath);
  const sourceProvenance: SourceTextProvenance = ingested === null ? "model-memory" : "source-text";
  if (ingested === null) {
    log("Source text: NONE — this run's sidecars are model-memory, not source-grounded.");
  } else {
    log(`Source text: ${ingested.path} (${ingested.byteLength} bytes, sha256 ${ingested.sha256.slice(0, 12)}…)`);
  }
  const inputIdentity = {
    title,
    author,
    bookIdHint: options.bookId ?? null,
    hash: researchInputHash({
      title,
      author,
      bookIdHint: options.bookId,
      sourceTextSha256: ingested?.sha256 ?? null,
    }),
  };

  let bibliography: BibliographyResult | null = null;
  let manifest: ResearchRunManifest | null = null;
  let bundlePath: string | null = null;

  if (options.pinnedRunId !== undefined && options.forceRefresh === true) {
    throw new Error("RESEARCH_RUN_PIN_INVALID:pinned run cannot be combined with forceRefresh");
  }

  if (options.pinnedRunId !== undefined) {
    if (options.bookId === undefined) {
      throw new Error("RESEARCH_RUN_PIN_INVALID:bookId is required to resolve a pinned research run");
    }
    // Resolve-then-adopt. Every failure inside throws a distinct
    // RESEARCH_RUN_PIN_* code, so `deps.runBibliography` below is provably
    // unreachable on the pinned path and the second compatible-run probe (which
    // lives inside `if (!bibliography)`) is never entered. The pin REPLACES that
    // probe rather than skipping it: instead of minting a fresh chapter list and
    // comparing — the very nondeterminism F5 is about — it proves the pinned run
    // internally consistent (bibliography <-> manifest <-> expectedChaptersHash).
    const pinned = resolvePinnedResearchRun({
      runsRoot,
      bookId: options.bookId,
      pinnedRunId: options.pinnedRunId,
      inputHash: inputIdentity.hash,
      compatibility,
      ...(options.validateReusedChapter === undefined ? {} : { validateReusedChapter: options.validateReusedChapter }),
    });
    bundlePath = pinned.runDir;
    manifest = pinned.manifest;
    bibliography = pinned.bibliography;
    log(`Step 1/4: bibliography research skipped — pinned research run ${manifest.runId} adopted (0 model calls)`);
  } else if (!options.forceRefresh) {
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
      ...(ingested === null ? {} : { sourceText: ingested.text }),
    });
    log(`  bibliography: bookId=${bibliography.bookId}, ${bibliography.edition.chapterCount} chapters, confidence=${bibliography.confidence}`);
    // The low-confidence WARNING line is emitted by createResearchRun below,
    // beside the durable manifest event it belongs to (R-035). Emitting it here
    // too made one low-confidence run print the same finding twice.

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
        ...(ingested === null ? {} : { ingested }),
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

  const chapterList = flattenChapters(bibliography);

  // R-046 — the FROZEN text is the only source of truth from here on. It is
  // re-read (and re-verified against the manifest digest) on a resume too, so a
  // resumed run cannot be researched against a different text than the one the
  // run was created with.
  let frozenSourceText: string | null = null;
  let chapterMap: ChapterMapV1 | null = null;
  if (activeManifest.sourceProvenance === "source-text") {
    const record = activeManifest.sourceText;
    if (!record) {
      throw new Error("RESEARCH_SOURCE_TEXT_MISSING:manifest declares source-text provenance but carries no sourceText record");
    }
    const frozenPath = resolve(activeBundlePath, record.frozenPath);
    if (!existsSync(frozenPath)) {
      throw new Error(`RESEARCH_SOURCE_TEXT_MISSING:frozen source text ${frozenPath} is gone; the run cannot be resumed against a text it no longer has`);
    }
    frozenSourceText = readFileSync(frozenPath, "utf8");
    const actualHash = hashString(frozenSourceText);
    if (actualHash !== record.sha256) {
      throw new Error(`RESEARCH_SOURCE_TEXT_CHANGED:frozen source text ${frozenPath} hashes ${actualHash}, manifest records ${record.sha256}`);
    }
    const resolved = resolveChapterMap({
      bookId: bibliography.bookId,
      sourceText: frozenSourceText,
      sourceTextSha256: record.sha256,
      chapters: chapterList.map((chapter) => ({ number: chapter.number, title: chapter.title })),
      spans: bibliography.chapterMap ?? [],
    });
    if (!resolved.map) {
      throw new Error(`RESEARCH_CHAPTER_MAP_INVALID:${resolved.problems.join("; ")}`);
    }
    chapterMap = resolved.map;
    writeFileAtomic(resolve(activeBundlePath, CHAPTER_MAP_REL_PATH), `${JSON.stringify(chapterMap, null, 2)}\n`);
    log(`  chapter map: ${chapterMap.spans.length} span(s) covering ${(chapterMap.coverageFraction * 100).toFixed(1)}% of the source text`);
  }

  // Step 2: Chapter research (parallel with concurrency limit)
  log(`Step 2/4: chapter research (${bibliography.edition.chapterCount} chapters, concurrency=${options.chapterConcurrency ?? 3})…`);
  const chapters = await researchChaptersInParallel(
    bibliography,
    chapterList,
    {
      concurrency: options.chapterConcurrency ?? 3,
      ...(frozenSourceText === null || chapterMap === null ? {} : { sourceText: frozenSourceText, chapterMap }),
      ...(options.factPins === undefined ? {} : { factPins: options.factPins }),
      bundlePath: activeBundlePath,
      manifest: activeManifest,
      ownerId,
      clock,
      leaseTtlMs,
      // A pin is an explicit operator adoption of a fully-validated run (every
      // chapter was already proven manifest-succeeded and hash-matched at
      // resolve time), so per-chapter durable reuse is exactly what was asked
      // for. Each reused sidecar is still re-validated through
      // validateReusedChapter before acceptance.
      forceRefresh: options.pinnedRunId !== undefined ? false : (options.forceRefresh ?? false),
      validateReusedChapter: options.validateReusedChapter,
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

  const v2SidecarsPresent = chapters.some((ch) => {
    const path = sourceJsonPath(activeBundlePath, ch.chapterNumber);
    try {
      return JSON.parse(readFileSync(path, "utf8"))?.schemaVersion === "source-v2";
    } catch {
      return false;
    }
  });
  if (v2SidecarsPresent) {
    log("Step 3.5/4: source integrity gate...");
    // Evaluate exact in-memory/durable outputs from this active run. The normal
    // run-discovery reader intentionally exposes only completed runs, so using it
    // here (before this manifest is marked complete) would falsely report every
    // just-written sidecar as missing.
    const findings = chapters.flatMap((chapter) => evaluateSourceV2Integrity(chapter, {
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
      rawText: JSON.stringify(chapter),
    }).findings.map((finding) => ({
      checkId: finding.checkId,
      severity: finding.severity,
      ...(finding.chapterNumber === undefined ? {} : { chapterNumber: finding.chapterNumber }),
      message: finding.message,
    })));
    const integrity: SourceV2GateReport = {
      bookId,
      passed: !findings.some((finding) => finding.severity === "blocker"),
      chaptersChecked: chapters.length,
      findings,
    };
    log("  " + formatSourceV2GateReport(integrity).replace(/\n/g, "\n  "));
    updateManifest(activeBundlePath, runId, ownerId, clock, leaseTtlMs, (m, nowIso) => {
      appendResearchEvent(m, {
        type: integrity.passed ? "source_integrity.passed" : "source_integrity.failed",
        message: formatSourceV2GateReport(integrity),
      }, nowIso);
      if (!integrity.passed) m.overallStatus = "coherence_failed";
    });
    if (!integrity.passed && options.failOnCoherenceBlockers !== false) {
      throw new Error(`Source integrity failed with ${integrity.findings.filter((f) => f.severity === "blocker").length} blocker(s). Repair source-v2 sidecars before authoring.`);
    }
  }

  // Step 4: Write artifacts
  log("Step 4/4: writing artifacts…");
  writeFileAtomic(resolve(sourceFreezeDir, "book-source.md"), renderBookSource(bibliography, chapters));
  writeFileAtomic(resolve(sourceFreezeDir, "source-freeze-report.md"), renderProvenanceReport(bibliography, chapters, coherence, {
    provenance: sourceProvenance,
    ...(activeManifest.sourceText === undefined ? {} : { sourceText: activeManifest.sourceText }),
    ...(chapterMap === null ? {} : { chapterMap }),
  }));

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
    sourceProvenance,
    ...(activeManifest.sourceText === undefined ? {} : { sourceText: activeManifest.sourceText }),
    ...(chapterMap === null ? {} : { chapterMap }),
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
    validateReusedChapter?: (chapter: ChapterResearchResult) => boolean;
    runChapter: ResearcherDeps["runChapter"];
    log: (m: string) => void;
    /** R-046 — the frozen text; present iff chapterMap is. */
    sourceText?: string;
    chapterMap?: ChapterMapV1;
    /** R-277 — the book's fact pins. */
    factPins?: readonly string[];
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

      const cachedRaw = !opts.forceRefresh ? loadSucceededChapter(opts.bundlePath, opts.manifest, chapter.number) : null;
      const cached = cachedRaw !== null && acceptReusedChapter(opts.validateReusedChapter, cachedRaw) ? cachedRaw : null;
      if (cached) {
        opts.log(`  ch${numStr} manifest-complete — skipping`);
        results[myIndex] = cached;
        continue;
      }
      if (cachedRaw !== null && cached === null) {
        // Durable sidecar exists and hash-matches its manifest entry but failed
        // the caller's reuse validator (e.g. no longer source-v2 route-valid) —
        // do NOT reuse it; fall through to re-research this chapter.
        opts.log(`  ch${numStr} durable sidecar failed reuse validation — re-researching`);
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
        const span = opts.chapterMap?.spans.find((entry) => entry.chapterNumber === chapter.number);
        if (opts.chapterMap && !span) {
          // Unreachable while resolveChapterMap enforces one span per expected
          // chapter, but a silent model-memory fallback here would be the worst
          // possible failure: a chapter written from memory inside a run the
          // manifest calls source-grounded.
          throw new Error(`RESEARCH_CHAPTER_MAP_INVALID:no span for chapter ${chapter.number} in a source-text run`);
        }
        // R-057 — the focus lines and case labels of the LOWER-NUMBERED chapters
        // whose sidecars already exist when this chapter is dispatched (durably
        // reused, or completed earlier in this stage). Research is a model call
        // and is nondeterministic anyway, so the schedule-dependence this adds is
        // not a new kind of variance; what it buys is the one thing that stops
        // every chapter re-minting the same organizing template.
        const priorDigests = results
          .filter((prior): prior is ChapterResearchResult => Boolean(prior) && prior.chapterNumber < chapter.number)
          .sort((a, b) => a.chapterNumber - b.chapterNumber)
          .map((prior) => ({
            chapterNumber: prior.chapterNumber,
            title: prior.chapterTitle,
            focus: prior.focus,
            caseLabels: (prior.namedExamples ?? []).map((example) => example.label).filter(Boolean),
          }));
        const ch = await opts.runChapter({
          bibliography,
          chapter,
          priorChapterTitles: priorTitles,
          ...(priorDigests.length === 0 ? {} : { priorChapterDigests: priorDigests }),
          ...(opts.factPins === undefined || opts.factPins.length === 0 ? {} : { factPins: opts.factPins }),
          ...(span === undefined || opts.sourceText === undefined ? {} : {
            sourceSpan: {
              startOffset: span.startOffset,
              endOffset: span.endOffset,
              text: chapterSpanText(opts.sourceText, span),
            },
            sourceTextSha256: opts.chapterMap!.sourceTextSha256,
          }),
        });
        // R-046 — the ORCHESTRATOR owns provenance, not the injected researcher.
        // It is the only layer that knows whether this run has text, and it is
        // the layer that writes the sidecar, so a caller that supplies its own
        // runChapter cannot produce an unstamped sidecar inside a run the
        // manifest calls source-grounded. It also re-checks the grounding it
        // demanded: the retry loop inside runResearcherChapter is supposed to
        // have fixed or dropped every ungrounded item, and if one survives, the
        // run fails closed rather than writing it.
        const stamped = stampChapterProvenance(ch, span === undefined || opts.sourceText === undefined
          ? null
          : { spanText: chapterSpanText(opts.sourceText, span), sha256: opts.chapterMap!.sourceTextSha256 });
        writeChapterSidecars(opts.bundlePath, stamped);
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
        results[myIndex] = stamped;
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

/**
 * R-046 — stamp a chapter's provenance and, on a source-text run, prove its
 * quotes before the sidecar is written.
 *
 * Fails CLOSED: an item whose quote is not in the frozen span reaches here only
 * if the chapter researcher's own drop path did not run (an injected researcher,
 * a future caller), and admitting it would put an unverifiable claim inside a run
 * whose manifest says every claim was verified — the exact confusion this whole
 * package exists to remove.
 */
function stampChapterProvenance(
  chapter: ChapterResearchResult,
  source: { spanText: string; sha256: string } | null,
): ChapterResearchResult {
  if (source === null) return { ...chapter, sourceProvenance: "model-memory" };
  const problems = collectSourceQuoteProblems(chapter, source.spanText);
  if (problems.length > 0) {
    throw new Error(
      `RESEARCH_SOURCE_UNGROUNDED:chapter ${chapter.chapterNumber} returned ${problems.length} item(s) that are not quotable from its source span: ${problems.map((problem) => problem.message).join("; ")}`,
    );
  }
  return { ...chapter, sourceProvenance: "source-text", sourceTextSha256: source.sha256 };
}

function buildCompatibilityFingerprint(options: ResearchBookOptions): ResearchCompatibility {
  return {
    codeVersion: options.compatibility?.codeVersion ?? RESEARCH_RUN_CODE_VERSION,
    promptHash: options.compatibility?.promptHash ?? hashJson({
      bibliography: readFileSync(resolve(PROMPTS_DIR, "researcher-bibliography.system.md"), "utf8"),
      chapter: readFileSync(resolve(PROMPTS_DIR, "researcher-chapter.system.md"), "utf8"),
    }),
    // R-277 (review round 2): the book's fact pins are part of the run's config
    // identity, so editing a pin makes every durable run incompatible and the
    // researcher is called again with the corrected pin. A pinless book hashes
    // exactly as it did before.
    configHash: options.compatibility?.configHash ?? researchConfigHash(options.factPins),
    provider: "model-gateway-v1",
    model: `${MODEL_CALLER_PROFILES["researcher-bibliography"]}+${MODEL_CALLER_PROFILES["researcher-chapter"]}`,
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
  ingested?: IngestedSourceText;
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
  // R-046 — FREEZE the text into the run. From here on nothing reads the
  // operator's path: a text edited or replaced mid-run cannot change what this
  // book was written from, and the frozen bytes are what every quote is checked
  // against and what the manifest digest names.
  if (args.ingested) {
    writeFileAtomic(resolve(bundlePath, SOURCE_TEXT_REL_PATH), args.ingested.text);
  }
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
    ...(args.ingested === undefined ? {} : {
      sourceText: {
        sha256: args.ingested.sha256,
        byteLength: args.ingested.byteLength,
        originPath: args.ingested.path,
        frozenPath: SOURCE_TEXT_REL_PATH,
      },
    }),
  });
  // R-035: the bibliography agent's own `confidence` was written into an empty
  // `if` block and, here, printed to stdout — so nothing durable recorded that a
  // book had been researched off an uncertain table of contents (the released
  // Franklin run's list was four entries titled "Part One".."Part Four"). It is
  // recorded as a manifest event, beside the run it describes, where a later
  // reviewer or the QC surface can find it. It does NOT fail the run: low
  // confidence is the model's honest signal about its own knowledge, and
  // rejecting it would only reward a model that overstates confidence.
  if (args.bibliography.confidence === "low") {
    const notes = args.bibliography.notes ?? "(none)";
    appendResearchEvent(manifest, {
      type: "bibliography.low_confidence",
      message: `Bibliography returned confidence=low; this run's chapter list may not match the real edition. Notes: ${notes}`,
      data: { confidence: "low", notes },
    }, nowIso);
    args.log(`  WARNING: low confidence. Notes: ${notes}`);
  }
  writeResearchRunManifest(bundlePath, manifest);
  args.log(`  created research run: ${runId}`);
  return { bundlePath, manifest };
}

const PINNED_SOURCE_FREEZE_ARTIFACTS = [
  "source-freeze/toc.json",
  "source-freeze/book-source.md",
  RAW_BIBLIOGRAPHY_REL_PATH,
] as const;

/**
 * Resolve an operator-supplied `--research-run-id` pin to an adoptable research
 * bundle, or throw. Every stage fails CLOSED with a distinct code; there is no
 * fallback to `findCompatibleResearchRun` and none to `createResearchRun`.
 *
 * This is the first place an attacker-influenced value is ever interpolated into
 * a research path (`runDirs.resolveResearchRun` needs no such guard because it
 * only consumes `readdirSync` names), so confinement is checked twice: once on
 * the RESOLVED path and once on its REALPATH, because a symlinked run directory
 * passes `resolve()` containment while pointing outside the research root.
 */
function resolvePinnedResearchRun(args: {
  runsRoot: string;
  bookId: string;
  pinnedRunId: string;
  inputHash: string;
  compatibility: ResearchCompatibility;
  validateReusedChapter?: (chapter: ChapterResearchResult) => boolean;
}): { runDir: string; manifest: ResearchRunManifest; bibliography: BibliographyResult } {
  const root = resolve(args.runsRoot, args.bookId);
  const runDir = pinnedResearchRunDir(args.runsRoot, args.bookId, args.pinnedRunId);

  // Symlink containment. A missing directory is NOT an error here — it falls
  // through to the not-found message below, which is far more useful.
  let realRunDir: string | null = null;
  try {
    realRunDir = realpathSync(runDir);
  } catch {
    realRunDir = null;
  }
  if (realRunDir !== null) {
    let realRoot = root;
    try {
      realRoot = realpathSync(root);
    } catch {
      realRoot = root;
    }
    if (realRunDir === realRoot || !pathWithin(realRoot, realRunDir)) {
      throw new Error(`RESEARCH_RUN_PIN_ESCAPED:pinned research run resolves outside ${root} via symlink`);
    }
  }

  if (!existsSync(researchRunManifestPath(runDir))) {
    const available = listResearchRunIds(args.runsRoot, args.bookId);
    throw new Error(
      `RESEARCH_RUN_PIN_NOT_FOUND:${runDir} has no ${RESEARCH_RUN_MANIFEST_FILE} (available under ${root}: ${available.length > 0 ? available.join(", ") : "none"})`,
    );
  }

  const parsed = readResearchRunManifest(runDir);
  if (!parsed.ok) throw new Error(`RESEARCH_RUN_PIN_UNREADABLE:${parsed.errors.join("; ")}`);
  const manifest = parsed.manifest;

  const reasons = researchRunPinRejectionReasons(manifest, {
    bookId: args.bookId,
    pinnedRunId: args.pinnedRunId,
    inputHash: args.inputHash,
    compatibility: args.compatibility,
  });
  if (reasons.length > 0) throw new Error(`RESEARCH_RUN_PIN_INVALID:${reasons.join("; ")}`);

  const bibliography = loadRunBibliography(runDir, manifest);
  if (!bibliography) {
    // The scan path merely logs and creates a new run here. A pin must not.
    throw new Error("RESEARCH_RUN_PIN_INVALID:bibliography bytes do not match manifest hash");
  }

  // Bibliography <-> chapter-list binding. loadRunBibliography verifies bytes
  // against manifest.bibliography.hash ONLY, so an operator who rewrites BOTH
  // the raw bibliography and that hash would otherwise get a manifest whose
  // expectedChapters describe one book while the bibliography that actually
  // feeds toc.json, book-source.md and the chapter index describes another.
  const bibliographyChapters = flattenChapters(bibliography).map((ch) => ({ number: ch.number, title: ch.title }));
  if (expectedChaptersHash(bibliographyChapters) !== manifest.expectedChaptersHash) {
    throw new Error("RESEARCH_RUN_PIN_INVALID:bibliography chapter list does not match expectedChaptersHash");
  }

  if (manifest.coherence.status !== "passed") {
    throw new Error(`RESEARCH_RUN_PIN_INVALID:coherence status ${manifest.coherence.status} is not passed`);
  }

  const missingArtifacts = PINNED_SOURCE_FREEZE_ARTIFACTS.filter((rel) => !existsSync(resolve(runDir, rel)));
  if (missingArtifacts.length > 0) {
    throw new Error(`RESEARCH_RUN_PIN_INCOMPLETE:missing source-freeze artifact(s): ${missingArtifacts.join(", ")}`);
  }

  // A pin requires a FULLY reusable run. Partial reuse would re-research at
  // least one chapter, which rewrites the BOOK-level book-source.md and
  // therefore changes every chapter's packetDigest — invalidating all 4N cached
  // section packs and delivering none of the pin's promise while charging for
  // it.
  //
  // This gate MUST apply the same predicate reuse itself applies. Acceptance at
  // reuse time (see researchChaptersInParallel) is
  // `loadSucceededChapter(...) !== null && acceptReusedChapter(validateReusedChapter, ...)`,
  // and the application port injects `chapterRouteValid` — a LIVE code predicate,
  // not a durable property. Gating on `loadSucceededChapter` alone would admit a
  // run that then fails route validation per-chapter and silently re-researches
  // it: exactly the F5 failure this pin exists to prevent, with the operator
  // believing they were protected. A validator tightening — not just post-hoc
  // bundle damage — is enough to strand a run, so the pin must fail loud here.
  const notReusable = manifest.expectedChapters
    .filter((ch) => {
      const cached = loadSucceededChapter(runDir, manifest, ch.number);
      return cached === null || !acceptReusedChapter(args.validateReusedChapter, cached);
    })
    .map((ch) => ch.number);
  if (notReusable.length > 0) {
    throw new Error(
      `RESEARCH_RUN_PIN_INCOMPLETE:chapters [${notReusable.join(", ")}] are not durably reusable (missing, not succeeded, or hash-mismatched); use --resume-run-id --reconcile-unsettled for partial durable reuse`,
    );
  }

  return { runDir, manifest, bibliography };
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

/** Apply the optional reuse validator to a durable/cached chapter. Absent
 *  validator accepts unconditionally (legacy behavior). A throwing validator is
 *  treated as reject — a corrupt cached sidecar must fall back to re-research,
 *  never crash the run. */
function acceptReusedChapter(
  validate: ((chapter: ChapterResearchResult) => boolean) | undefined,
  chapter: ChapterResearchResult,
): boolean {
  if (!validate) return true;
  try {
    return validate(chapter) === true;
  } catch {
    return false;
  }
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
  return buildCanonicalToc({
    bookId: b.bookId,
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
    introduction: b.introduction,
    thesis: b.thesis,
    teachingArc: b.teachingArc,
    authorVoice: b.authorVoice,
    confidence: b.confidence,
    notes: b.notes,
    categories: (b as { categories?: unknown }).categories,
    tags: (b as { tags?: unknown }).tags,
    chapters: flattenChapters(b),
  });
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
  source: {
    provenance: SourceTextProvenance;
    sourceText?: { sha256: string; byteLength: number; originPath: string; frozenPath: string };
    chapterMap?: ChapterMapV1;
  },
): string {
  const lines: string[] = [];
  lines.push(`# Source-freeze provenance — ${b.bookId}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  // R-046: state, in the artifact an operator actually opens, whether this book
  // was researched from the book or from the model's memory of it.
  lines.push(`Source provenance: ${source.provenance}`);
  if (source.provenance === "model-memory") {
    lines.push(`  No source text was supplied. Every claim below is the research model's recall, not a reading of the book, and nothing in this run has been checked against the text.`);
  } else if (source.sourceText) {
    lines.push(`  Source text: ${source.sourceText.originPath}`);
    lines.push(`  Frozen at: ${source.sourceText.frozenPath} (${source.sourceText.byteLength} bytes)`);
    lines.push(`  sha256: ${source.sourceText.sha256}`);
    if (source.chapterMap) {
      lines.push(`  Chapter map: ${source.chapterMap.spans.length} span(s), ${(source.chapterMap.coverageFraction * 100).toFixed(1)}% of the text assigned`);
      for (const span of source.chapterMap.spans) {
        lines.push(`    - Ch${span.chapterNumber}: characters ${span.startOffset}-${span.endOffset} (${span.endOffset - span.startOffset})`);
      }
    }
  }
  lines.push(`Title: ${b.title}`);
  lines.push(`Author: ${b.author}`);
  lines.push(`Chapter count: ${b.edition.chapterCount}`);
  lines.push(`Bibliography confidence: ${b.confidence}`);
  if (b.notes) lines.push(`Bibliography notes: ${b.notes}`);
  lines.push("");
  lines.push(`## Per-chapter paraphrase lengths`);
  for (const ch of [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)) {
    lines.push(`- Ch${ch.chapterNumber}: ${ch.paraphraseNotes.length} chars, ${ch.namedExamples.length} named examples`);
    // R-052: abstention is provenance, not an error to bury.
    for (const dropped of ch.droppedItems ?? []) {
      lines.push(`  - DROPPED ${dropped.kind} ${dropped.id} after ${dropped.attempts} attempt(s): ${dropped.reason}`);
    }
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
