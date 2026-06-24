/**
 * Core "generate one chapter" function. Extracted from the scratch
 * single-chapter runner so a multi-chapter driver can call it in a loop.
 *
 * Responsibilities:
 *   - run editor-in-chief (cached per book)
 *   - run curriculum planner (cached per chapter)
 *   - run hook + breakdown in parallel
 *   - iterative voice pass (up to 3 rounds)
 *   - over-generate 3× example candidates per slot, curator picks winner
 *   - quiz + cards + implementation plan + key takeaway in parallel
 *   - assemble v21-native chapter
 *   - ingest chapter into library state (cross-book ledger)
 *
 * The caller provides book metadata and a chapter spec. The function returns
 * the assembled ChapterV21 and persists side-effect files under state/.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { writeFileAtomic } from "./lib/atomicWrite.js";
import {
  CacheDependency,
  ProviderIdentity,
  STAGE_CACHE_CODE_VERSION,
  StaleCacheError,
  configDependencies,
  currentProviderIdentity,
  defaultCacheDependencies,
  fileDependency,
  hashJson,
  loadOrBuildCachedJson,
  promptDependencies,
  quarantineInvalidArtifact,
  stringDependency,
  validateStageCache,
  valueDependency,
  writeStageCacheManifest,
} from "./cache/stageCache.js";

import { runEditorInChief, applyAuthorVoiceProfile } from "./agents/editor-in-chief.js";
import { runCurriculumPlanner } from "./agents/curriculum-planner.js";
import { runWriterBreakdown } from "./agents/writer-breakdown.js";
import { runWriterExample, ExampleOutput } from "./agents/writer-example.js";
import { runWriterQuiz } from "./agents/writer-quiz.js";
import { runWriterCards } from "./agents/writer-cards.js";
import { runWriterImplementationPlan } from "./agents/writer-implementation-plan.js";
import { runWriterHook } from "./agents/writer-hook.js";
import { runVoicePass } from "./agents/voice-pass.js";
import { runLineEditor } from "./agents/line-editor.js";
import { runMemorableLines } from "./agents/memorable-lines.js";
import { runTryThisNow } from "./agents/try-this-now.js";
import { runExampleCurator } from "./curator/exampleSelector.js";
import {
  anchorIds,
  loadPlanningSourceEvidence,
  renderBookSourceForEditor,
  renderChapterSourceForPlanner,
  selectAnchorsForClaim,
  sourceEvidenceDependencyValue,
  type PlanningSourceEvidence,
} from "./source/sourceEvidence.js";
import {
  getForbiddenNames,
  ingestChapter as ingestIntoLibrary,
  loadLibraryState,
  withLibraryState,
  extractNamesFromText,
} from "./librarian/libraryState.js";
import { callClaude } from "./claudeClient.js";
import { renderUntrustedSourceBlock } from "./providers/types.js";
import { assembleChapterV21OrThrow, V21_SCHEMA_VERSION } from "./assembler.js";
import { sanitizeBriefForWriter } from "./lib/brief-sanitizer.js";
import { BookBrief, BookPackageV21, ChapterDesignDoc, ChapterV21, PriorChapterShapes, SourceAnchorForPrompt } from "./types.js";
import { checkChapterIdentity, CANONICAL_STATE } from "./lib/chapterPaths.js";
import { canonicalChapterIndexPath, readCanonicalChapterIndex } from "./lib/chapterSet.js";
import { checkSourceV2Gate, sourceSidecarPathFor } from "./qc/sourceV2Gate.js";
import { checkPlanEnforcement } from "./qc/planEnforcement.js";
import { currentSessionId, recordAuthorProvenance, recordCacheAcceptance, requireCurrentSessionId } from "./qc/sessionProvenance.js";
import { chapterContentHash } from "./critics/qcAttestation.js";
import {
  createGenerationRunManifest,
  generationInputHash,
  generationInputHashes,
  recordGenerationDegradation,
  recordGenerationStage,
  writeGenerationManifestSidecar,
} from "./generationDegradation.js";
import {
  checkCadenceVariance,
  checkClosingLineLandings,
  checkCrossTierPhraseUniqueness,
  checkOpeningConcreteness,
  checkParagraphStartVariety,
} from "./critics/prose.js";
import { checkReadingLevel, fleschKincaid } from "./critics/readingLevel.js";
import { runShipGate, formatGateReport } from "./critics/finalGate.js";
import { validateChapterV21 } from "./runtimeSchemas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../state");

const BRIEF_PROMPTS = ["editor-in-chief.system.md"];
const PLAN_PROMPTS = ["curriculum-planner.system.md"];
const CHAPTER_PROMPTS = [
  "writer-hook.system.md",
  "writer-breakdown.system.md",
  "voice-pass.system.md",
  "line-editor.system.md",
  "writer-example.system.md",
  "example-curator.system.md",
  "writer-quiz.system.md",
  "writer-cards.system.md",
  "writer-implementation-plan.system.md",
  "try-this-now.system.md",
  "memorable-lines.system.md",
];

export type BookMeta = {
  bookId: string;
  title: string;
  author: string;
};

export type ChapterSpec = {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
};

export type GenerateChapterOptions = {
  logger?: (msg: string) => void;
  candidatesPerSlot?: number;
  voicePassMaxIterations?: number;
  /** Bypass cache reuse. Does not bypass validation of newly generated output. */
  force?: boolean;
  /** Test/tooling hook for deterministic invalidation without editing source. */
  cacheCodeVersion?: string;
  /** Hook first-words + counter shapes of every prior chapter in this book.
   *  Used by the hook/breakdown writers to diversify away from over-used
   *  templates. Passed through by generateBook from in-memory state plus
   *  any resumed cached chapters. */
  priorChapterShapes?: PriorChapterShapes;
  /** Test/tooling roots for hermetic fixtures. Production uses canonical state and .chapterflow/runs. */
  stateRoot?: string;
  runsRoot?: string;
  /** Force source-v2 evidence even outside no-api mode. */
  sourceV2Required?: boolean;
  /** Test seam for focused lifecycle regressions. Production should not set this. */
  agents?: Partial<GenerateChapterAgents>;
};

export type GenerateChapterAgents = {
  runEditorInChief: typeof runEditorInChief;
  runCurriculumPlanner: typeof runCurriculumPlanner;
  runWriterHook: typeof runWriterHook;
  runWriterBreakdown: typeof runWriterBreakdown;
  runVoicePass: typeof runVoicePass;
  runLineEditor: typeof runLineEditor;
  runWriterExample: typeof runWriterExample;
  runExampleCurator: typeof runExampleCurator;
  runWriterQuiz: typeof runWriterQuiz;
  runWriterCards: typeof runWriterCards;
  runWriterImplementationPlan: typeof runWriterImplementationPlan;
  runTryThisNow: typeof runTryThisNow;
  runMemorableLines: typeof runMemorableLines;
  generateKeyTakeaway: typeof generateKeyTakeaway;
};

async function loadOrBuild<T>(
  filePath: string,
  generator: () => Promise<T>,
  label: string,
  log: (m: string) => void,
  cache: {
    artifactType: "book-brief" | "chapter-plan";
    artifactId: string;
    inputs: CacheDependency[];
    provider: ProviderIdentity;
    allowGenerate: boolean;
    force?: boolean;
    codeVersion?: string;
    validateValue?: (value: T) => string[];
  },
): Promise<T> {
  return loadOrBuildCachedJson<T>({
    artifactPath: filePath,
    artifactType: cache.artifactType,
    artifactId: cache.artifactId,
    inputs: cache.inputs,
    generatorName: cache.artifactType,
    provider: cache.provider,
    codeVersion: cache.codeVersion,
    allowGenerate: cache.allowGenerate,
    force: cache.force,
    label,
    log,
    generator,
    validateValue: cache.validateValue,
  });
}

function briefPath(bookId: string, stateRoot: string = STATE): string {
  return resolve(stateRoot, "briefs", `${bookId}.brief.json`);
}

function manualBriefPath(bookId: string, stateRoot: string = STATE): string {
  return resolve(stateRoot, "briefs", `${bookId}.manual-brief.json`);
}

function planPath(chapterId: string, stateRoot: string = STATE): string {
  return resolve(stateRoot, "plans", `${chapterId}.plan.json`);
}

function manualPlanPath(chapterId: string, stateRoot: string = STATE): string {
  return resolve(stateRoot, "plans", `${chapterId}.manual-plan.json`);
}

function chapterPath(chapterId: string, stateRoot: string = STATE): string {
  return resolve(stateRoot, "chapters", `${chapterId}.v21-native.chapter.json`);
}

function stageProvider(): ProviderIdentity {
  return currentProviderIdentity("writer");
}

type CacheBuildContext = {
  stateRoot?: string;
  runsRoot?: string;
  sourceEvidence?: PlanningSourceEvidence;
};

export function buildBriefCacheInputs(
  book: BookMeta,
  provider: ProviderIdentity = stageProvider(),
  codeVersion: string = STAGE_CACHE_CODE_VERSION,
  context: CacheBuildContext = {},
): CacheDependency[] {
  return [
    ...defaultCacheDependencies({ provider, codeVersion }),
    stringDependency("v21-schema-version", V21_SCHEMA_VERSION),
    valueDependency("book-meta", book),
    valueDependency("source-evidence", sourceEvidenceDependencyValue(context.sourceEvidence)),
    fileDependency("author-voice-profile-config", resolve(CANONICAL_STATE, "../config/author-voice-profiles.json")),
    ...promptDependencies(BRIEF_PROMPTS),
    ...configDependencies(),
  ];
}

export function buildPlanCacheInputs(
  book: BookMeta,
  chapter: ChapterSpec,
  provider: ProviderIdentity = stageProvider(),
  codeVersion: string = STAGE_CACHE_CODE_VERSION,
  context: CacheBuildContext = {},
): CacheDependency[] {
  const stateRoot = context.stateRoot ?? STATE;
  return [
    ...defaultCacheDependencies({ provider, codeVersion }),
    stringDependency("v21-schema-version", V21_SCHEMA_VERSION),
    valueDependency("book-meta", book),
    valueDependency("chapter-spec", chapter),
    valueDependency("source-evidence", sourceEvidenceDependencyValue(context.sourceEvidence)),
    fileDependency("book-brief:generated", briefPath(book.bookId, stateRoot)),
    fileDependency("book-brief:manual", manualBriefPath(book.bookId, stateRoot)),
    fileDependency(`source:ch${String(chapter.chapterNumber).padStart(2, "0")}`, context.sourceEvidence?.chapterSidecarPath ?? sourceSidecarPathFor(book.bookId, chapter.chapterNumber, { runsRoot: context.runsRoot })),
    ...promptDependencies(PLAN_PROMPTS),
    ...configDependencies(),
  ];
}

export function buildChapterCacheInputs(
  book: BookMeta,
  chapter: ChapterSpec,
  provider: ProviderIdentity = stageProvider(),
  codeVersion: string = STAGE_CACHE_CODE_VERSION,
  context: CacheBuildContext = {},
): CacheDependency[] {
  const stateRoot = context.stateRoot ?? STATE;
  return [
    ...defaultCacheDependencies({ provider, codeVersion }),
    stringDependency("v21-schema-version", V21_SCHEMA_VERSION),
    valueDependency("book-meta", book),
    valueDependency("chapter-spec", chapter),
    valueDependency("source-evidence", sourceEvidenceDependencyValue(context.sourceEvidence)),
    fileDependency("canonical-index", canonicalChapterIndexPath(book.bookId, stateRoot)),
    fileDependency(`source:ch${String(chapter.chapterNumber).padStart(2, "0")}`, context.sourceEvidence?.chapterSidecarPath ?? sourceSidecarPathFor(book.bookId, chapter.chapterNumber, { runsRoot: context.runsRoot })),
    fileDependency("book-brief:generated", briefPath(book.bookId, stateRoot)),
    fileDependency("book-brief:manual", manualBriefPath(book.bookId, stateRoot)),
    fileDependency("chapter-plan:generated", planPath(chapter.chapterId, stateRoot)),
    fileDependency("chapter-plan:manual", manualPlanPath(chapter.chapterId, stateRoot)),
    fileDependency("shape-plan", resolve(stateRoot, "shape-plans", `${book.bookId}.shape-plan.json`)),
    fileDependency("exemplar-plan", resolve(stateRoot, "exemplar-plans", `${book.bookId}.exemplar-plan.json`)),
    ...promptDependencies(CHAPTER_PROMPTS),
    ...configDependencies(),
  ];
}

function validateBookBriefShape(brief: BookBrief, book: BookMeta): string[] {
  const problems: string[] = [];
  if (!brief || typeof brief !== "object") return ["brief must be an object"];
  if (brief.bookId !== book.bookId) problems.push(`bookId ${JSON.stringify(brief.bookId)} != ${book.bookId}`);
  if (typeof brief.title !== "string" || !brief.title) problems.push("title missing");
  if (typeof brief.author !== "string" || !brief.author) problems.push("author missing");
  if (typeof brief.thesisParagraph !== "string" || brief.thesisParagraph.length < 20) problems.push("thesisParagraph too short");
  if (!Array.isArray(brief.coreIdeas)) problems.push("coreIdeas must be an array");
  if (!brief.voiceCharter || typeof brief.voiceCharter !== "object") problems.push("voiceCharter missing");
  if (!Array.isArray(brief.forbiddenMoves)) problems.push("forbiddenMoves must be an array");
  return problems;
}

function validateChapterPlanShape(plan: ChapterDesignDoc, chapter: ChapterSpec): string[] {
  const problems: string[] = [];
  if (!plan || typeof plan !== "object") return ["plan must be an object"];
  if (plan.chapterId !== chapter.chapterId) problems.push(`chapterId ${JSON.stringify(plan.chapterId)} != ${chapter.chapterId}`);
  if (plan.number !== chapter.chapterNumber) problems.push(`number ${String(plan.number)} != ${chapter.chapterNumber}`);
  if (typeof plan.title !== "string" || !plan.title) problems.push("title missing");
  if (typeof plan.coreMove !== "string" || plan.coreMove.length < 10) problems.push("coreMove too short");
  if (!Array.isArray(plan.exampleSpecs)) problems.push("exampleSpecs must be an array");
  if (!plan.quizFocus || typeof plan.quizFocus !== "object") problems.push("quizFocus missing");
  if (!plan.cardFocus || typeof plan.cardFocus !== "object") problems.push("cardFocus missing");
  return problems;
}

function validateChapterShape(chapter: ChapterV21): string[] {
  const parsed = validateChapterV21(chapter);
  return parsed.ok ? [] : parsed.findings.map((f) => `${f.path}: expected ${f.expected}; observed ${f.observed}`);
}

function validateCachedChapterForReuse(
  cached: ChapterV21,
  book: BookMeta,
  chapter: ChapterSpec,
  filePath: string,
  roots: { stateRoot?: string; runsRoot?: string } = {},
): string[] {
  const problems: string[] = [];
  problems.push(...validateChapterShape(cached).map((problem) => `runtime schema: ${problem}`));
  if (cached.chapterId !== chapter.chapterId) problems.push(`chapter identity: chapterId ${cached.chapterId} != ${chapter.chapterId}`);
  if (cached.number !== chapter.chapterNumber) problems.push(`chapter identity: number ${cached.number} != ${chapter.chapterNumber}`);
  if (cached.title !== chapter.chapterTitle) problems.push(`chapter identity: title ${JSON.stringify(cached.title)} != ${JSON.stringify(chapter.chapterTitle)}`);
  for (const f of checkChapterIdentity(cached, filePath)) {
    problems.push(`filename identity: ${f.message}`);
  }

  const index = readCanonicalChapterIndex(book.bookId, roots.stateRoot);
  if (!index.ok) {
    problems.push(...index.blockers.map((b) => `canonical index: ${b.message}`));
  } else {
    const entry = index.chapters.find((spec) => spec.chapterId === chapter.chapterId);
    if (!entry) {
      problems.push(`canonical index: ${chapter.chapterId} is not a member of ${index.path}`);
    } else {
      if (entry.chapterNumber !== chapter.chapterNumber) {
        problems.push(`canonical index: ${chapter.chapterId} is chapter ${entry.chapterNumber}, expected ${chapter.chapterNumber}`);
      }
      if (entry.chapterTitle !== chapter.chapterTitle) {
        problems.push(`canonical index: ${chapter.chapterId} title ${JSON.stringify(entry.chapterTitle)} != ${JSON.stringify(chapter.chapterTitle)}`);
      }
    }
  }

  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC === "1" || sourceSidecarPathFor(book.bookId, chapter.chapterNumber, { runsRoot: roots.runsRoot })) {
    const sourceGate = checkSourceV2Gate(book.bookId, [chapter.chapterNumber], roots);
    if (!sourceGate.passed) {
      problems.push(...sourceGate.findings.map((f) => `source-v2: ${f.checkId} ${f.message}`));
    }
  }

  const planFindings = checkPlanEnforcement(book.bookId, [cached]);
  problems.push(...planFindings.map((f) => `plan enforcement: ${f.checkId} ${f.message}`));

  const gate = runShipGate(cached);
  if (!gate.passed) {
    problems.push(...gate.blockers.map((f) => `ship gate: ${f.catalogId} ${f.unit}: ${f.message}`));
  }
  return problems;
}

export type KeyTakeawayOutput = {
  keyTakeaway: string;
  sourceAnchorIds?: string[];
};

async function generateKeyTakeaway(
  brief: BookBrief,
  plan: ChapterDesignDoc,
  deepRead: string,
  sourceAnchors: SourceAnchorForPrompt[] = [],
): Promise<KeyTakeawayOutput> {
  const sourceBlock = sourceAnchors.length > 0
    ? `\n\n${renderUntrustedSourceBlock("Allowed source anchors", JSON.stringify(sourceAnchors, null, 2), "json")}\nUse only these ids and emit sourceAnchorIds for the claim.`
    : "";
  const result = await callClaude<KeyTakeawayOutput>({
    tier: "writer",
    system: `You write one-sentence key takeaways. Output a single JSON object: { "keyTakeaway": "...", "sourceAnchorIds": ["..."] }. The takeaway is ONE sentence, 140–220 characters, teaching the chapter's core move directly. No meta-references ("the chapter", "the author", "Chapter N"), no banned phrases ("That matters because", "boundary condition", etc.). No em dashes (—) anywhere, use commas, periods, or a semicolon. Plain words.`,
    user: `# Brief voice charter\n${JSON.stringify(brief.voiceCharter, null, 2)}\n\n# Chapter coreMove\n${plan.coreMove}\n\n# Chapter title\n${plan.title}\n\n# Deep-read breakdown\n${deepRead}${sourceBlock}\n\nWrite the JSON now.`,
    jsonMode: true,
    maxTokens: 400,
    temperature: 0.6,
    timeoutMs: 60_000,
  });
  const kt = result.content.keyTakeaway;
  if (!kt || kt.length < 100 || kt.length > 300) {
    throw new Error(`keyTakeaway length invalid (${kt?.length})`);
  }
  if (sourceAnchors.length > 0) {
    const allowed = new Set(sourceAnchors.map((anchor) => anchor.id));
    const ids = result.content.sourceAnchorIds ?? [];
    if (ids.length === 0) throw new Error("keyTakeaway must cite at least one allowed source anchor");
    for (const id of ids) {
      if (!allowed.has(id)) throw new Error(`keyTakeaway cites unsupported source anchor ${JSON.stringify(id)}`);
    }
  }
  return result.content;
}

export async function generateChapter(
  book: BookMeta,
  chapter: ChapterSpec,
  options: GenerateChapterOptions = {},
): Promise<ChapterV21> {
  const log = options.logger ?? ((m: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${m}`);
  });
  const CANDIDATES_PER_SLOT = options.candidatesPerSlot ?? 3;
  const VOICE_PASS_MAX = options.voicePassMaxIterations ?? 3;
  const provider = stageProvider();
  const codeVersion = options.cacheCodeVersion ?? STAGE_CACHE_CODE_VERSION;
  const allowModelGeneration = process.env.CHAPTERFLOW_ALLOW_MODEL_GEN === "1";
  const stateRoot = options.stateRoot ?? STATE;
  const runsRoot = options.runsRoot;
  const agents: GenerateChapterAgents = {
    runEditorInChief,
    runCurriculumPlanner,
    runWriterHook,
    runWriterBreakdown,
    runVoicePass,
    runLineEditor,
    runWriterExample,
    runExampleCurator,
    runWriterQuiz,
    runWriterCards,
    runWriterImplementationPlan,
    runTryThisNow,
    runMemorableLines,
    generateKeyTakeaway,
    ...(options.agents ?? {}),
  };
  const overall = Date.now();
  const sourceEvidence = loadPlanningSourceEvidence(book.bookId, chapter.chapterNumber, {
    runsRoot,
    requireSourceV2: options.sourceV2Required,
    chapterTitle: chapter.chapterTitle,
  });
  if (sourceEvidence.available) {
    log(`source: planning evidence loaded before editorial planning (sourceV2=${sourceEvidence.sourceV2 ? "yes" : "no"}, anchors=${sourceEvidence.anchors.length})`);
  }
  const cacheContext: CacheBuildContext = { stateRoot, runsRoot, sourceEvidence };

  const chapterOutPath = chapterPath(chapter.chapterId, stateRoot);
  const chapterInputs = buildChapterCacheInputs(book, chapter, provider, codeVersion, cacheContext);
  if (existsSync(chapterOutPath) && !options.force) {
    const cache = validateStageCache({
      artifactPath: chapterOutPath,
      artifactType: "chapter",
      artifactId: chapter.chapterId,
      inputs: chapterInputs,
      generatorName: "generateChapter",
      provider,
      codeVersion,
    });
    if (cache.ok) {
      let cached: ChapterV21 | null = null;
      let reuseProblems: string[] = [];
      try {
        cached = JSON.parse(readFileSync(chapterOutPath, "utf8")) as ChapterV21;
        reuseProblems = validateCachedChapterForReuse(cached, book, chapter, chapterOutPath, { stateRoot, runsRoot });
      } catch (err) {
        reuseProblems = [`cached chapter unreadable: ${(err as Error).message}`];
      }
      if (cached && reuseProblems.length === 0) {
        // A session that only ACCEPTS a cached chapter is NOT its author. Author
        // provenance written at the original authoring time must survive untouched;
        // recording the accepter here would let a cache accepter masquerade as the
        // author and defeat author≠reviewer independence. Record the acceptance as a
        // separate, append-only audit event instead (never read as author evidence).
        const accepterSessionId = currentSessionId();
        if (accepterSessionId) {
          recordCacheAcceptance({
            chapterId: chapter.chapterId,
            sessionId: accepterSessionId,
            contentHash: chapterContentHash(cached),
            cacheManifestHash: hashJson(cache.manifest),
          });
        }
        let alreadyIngested = false;
        const updated = await withLibraryState((state) => {
          const existingBook = state.books[book.bookId];
          alreadyIngested = !!existingBook?.chaptersIngested.includes(chapter.chapterNumber);
          if (!alreadyIngested) {
            ingestIntoLibrary(state, book.bookId, book.title, book.author, cached);
          }
        });
        if (alreadyIngested) {
          log(`resume: ${chapter.chapterId} cache validated AND already ingested — skipping`);
        } else {
          log(`resume: ${chapter.chapterId} cache validated; ingested after validation (${updated.books[book.bookId].chaptersIngested.length} chapter(s))`);
        }
        return cached;
      }
      if (!allowModelGeneration) {
        throw new StaleCacheError(chapter.chapterId, reuseProblems, ["current-gates"]);
      }
      quarantineInvalidArtifact(chapterOutPath, reuseProblems);
      log(`resume: ${chapter.chapterId} cache failed current gates (${reuseProblems.slice(0, 3).join("; ")}) — regenerating`);
    } else {
      if (!allowModelGeneration) {
        throw new StaleCacheError(chapter.chapterId, cache.reasons, cache.changedDependencies);
      }
      quarantineInvalidArtifact(chapterOutPath, cache.reasons);
      log(`resume: ${chapter.chapterId} cache invalid (${cache.changedDependencies.join(", ")}) — regenerating`);
    }
  } else if (existsSync(chapterOutPath) && options.force) {
    if (!allowModelGeneration) {
      throw new StaleCacheError(chapter.chapterId, ["--force bypasses cache reuse but model generation is disabled"], ["force"]);
    }
    quarantineInvalidArtifact(chapterOutPath, ["--force bypassed chapter cache reuse"]);
    log(`resume: ${chapter.chapterId} --force bypassed cache reuse — regenerating`);
  }

  // No authored chapter on disk → the only way forward from here is the
  // legacy model-subprocess pipeline (editor-in-chief, writers, voice passes
  // — every step a paid model call). Under the no-API operating model that is
  // never what the operator meant: generate-book is the ASSEMBLER for
  // chapters Codex already authored, and silently falling through here was a
  // verified surprise-API-spend bug. Hard-error unless explicitly enabled.
  if (!allowModelGeneration) {
    throw new Error(
      `${chapter.chapterId}: no authored chapter at ${chapterOutPath} and model generation is disabled ` +
        `(no-API operating model). Author the missing chapter via \`fanout ${book.bookId}\` + Codex, or set ` +
        `CHAPTERFLOW_ALLOW_MODEL_GEN=1 to deliberately invoke the legacy model pipeline.`,
    );
  }

  const briefFromDisk = await loadOrBuild<BookBrief>(
    briefPath(book.bookId, stateRoot),
    () => agents.runEditorInChief({ ...book, sourceExcerpt: renderBookSourceForEditor(sourceEvidence) }),
    `brief[${book.bookId}]`,
    log,
    {
      artifactType: "book-brief",
      artifactId: book.bookId,
      inputs: buildBriefCacheInputs(book, provider, codeVersion, cacheContext),
      provider,
      allowGenerate: allowModelGeneration,
      force: options.force,
      codeVersion,
      validateValue: (value) => validateBookBriefShape(value, book),
    },
  );
  // Always re-apply the author-voice profile to the loaded brief. If the
  // brief was cached before the profile was updated (or before the profile
  // existed at all), this merges any new `avoidFrames` deterministically.
  const briefRaw = applyAuthorVoiceProfile(briefFromDisk, book.bookId);

  // Sanitize before passing to writers. The on-disk brief lists forbidden
  // phrases verbatim ("the chapter", "the book", banned phrases) so the
  // editor-in-chief can name what to avoid; but echoing those phrases into
  // every writer's context reverse-primes the writer. The system prompt
  // enforces the same forbidden list, so removing them from the brief is safe.
  const brief = sanitizeBriefForWriter(briefRaw);

  const plan = await loadOrBuild<ChapterDesignDoc>(
    planPath(chapter.chapterId, stateRoot),
    () => agents.runCurriculumPlanner({
      brief,
      chapterId: chapter.chapterId,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
      chapterSource: renderChapterSourceForPlanner(sourceEvidence),
      sourceAnchors: sourceEvidence.anchors,
    }),
    `plan[${chapter.chapterId}]`,
    log,
    {
      artifactType: "chapter-plan",
      artifactId: chapter.chapterId,
      inputs: buildPlanCacheInputs(book, chapter, provider, codeVersion, cacheContext),
      provider,
      allowGenerate: allowModelGeneration,
      force: options.force,
      codeVersion,
      validateValue: (value) => validateChapterPlanShape(value, chapter),
    },
  );
  const generationManifest = createGenerationRunManifest({
    runId: process.env.CHAPTERFLOW_RUN_ID ?? `${chapter.chapterId}.${Date.now()}`,
    chapterId: chapter.chapterId,
    authorSessionId: currentSessionId() ?? "legacy-unknown",
    provider,
    codeVersion,
    sourceHash: sourceEvidence.available ? sourceEvidence.sourceHash : null,
    sourceAnchorCatalogHash: sourceEvidence.available ? sourceEvidence.anchorCatalogHash : null,
    planHash: generationInputHash(plan),
  });
  recordGenerationStage(generationManifest, {
    stage: "editor-in-chief",
    input: { book, sourceHash: sourceEvidence.available ? sourceEvidence.sourceHash : null },
    output: briefRaw,
  });
  recordGenerationStage(generationManifest, {
    stage: "curriculum-planner",
    input: { book, chapter, sourceHash: sourceEvidence.available ? sourceEvidence.sourceHash : null },
    output: plan,
  });
  log(`plan: ${plan.exampleCount} examples, formats: ${Array.from(new Set(plan.exampleSpecs.map((s) => s.format))).join(", ")}`);

  log(`hook + breakdown: generating in parallel…`);
  if (options.priorChapterShapes && (options.priorChapterShapes.priorHookFirstWords.length > 0 || options.priorChapterShapes.priorCounterShapes.length > 0)) {
    const fw = options.priorChapterShapes.priorHookFirstWords;
    const cs = options.priorChapterShapes.priorCounterShapes;
    log(`prior shapes: ${fw.length} hooks, ${cs.length} counters (writer will steer away from over-used)`);
  }
  const [hook, draftBreakdown] = await Promise.all([
    agents.runWriterHook({
      brief,
      plan,
      priorChapterShapes: options.priorChapterShapes,
      sourceAnchors: selectAnchorsForClaim(sourceEvidence, ["hook", "core_move", "breakdown_claim"], plan.coreMoveSourceAnchorIds),
    }),
    agents.runWriterBreakdown({
      brief,
      plan,
      chapterSource: renderChapterSourceForPlanner(sourceEvidence),
      priorChapterShapes: options.priorChapterShapes,
      sourceAnchors: selectAnchorsForClaim(sourceEvidence, ["breakdown_claim", "core_move"], plan.coreMoveSourceAnchorIds),
    }),
  ]);
  recordGenerationStage(generationManifest, {
    stage: "writer-hook",
    input: { brief, plan, priorChapterShapes: options.priorChapterShapes },
    output: hook,
  });
  recordGenerationStage(generationManifest, {
    stage: "writer-breakdown",
    input: { brief, plan, priorChapterShapes: options.priorChapterShapes },
    output: draftBreakdown,
  });
  log(`hook: "${hook.hook}"`);
  log(`draft breakdown: fastRead=${draftBreakdown.fastRead.length}c, deepRead=${draftBreakdown.deepRead.length}c, fullRead=${draftBreakdown.fullRead.length}c`);

  log(`voice pass: iterating (max ${VOICE_PASS_MAX})…`);
  let breakdown = await agents.runVoicePass({ brief, plan, draft: draftBreakdown });
  recordGenerationStage(generationManifest, {
    stage: "voice-pass",
    input: { brief, plan, draft: draftBreakdown },
    output: breakdown,
    attemptCount: 1,
  });
  log(`voice pass iter 1 done (fastRead=${breakdown.fastRead.length}c, deepRead=${breakdown.deepRead.length}c, fullRead=${breakdown.fullRead.length}c)`);
  const runProseChecksOnBreakdown = (b: typeof breakdown): string[] => {
    const issues: string[] = [];
    for (const [tierName, tierText] of [["fastRead", b.fastRead], ["deepRead", b.deepRead], ["fullRead", b.fullRead]] as const) {
      for (const f of checkClosingLineLandings(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      for (const f of checkReadingLevel(tierText, tierName as any)) issues.push(f.message);
      for (const f of checkOpeningConcreteness(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      for (const f of checkParagraphStartVariety(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      for (const f of checkCadenceVariance(tierText, `breakdown[${tierName}]`)) issues.push(f.message);
      if (tierText.includes("\u2014")) issues.push(`${tierName}: em dash present`);
    }
    const allow = [plan.title, ...plan.coreMove.split(/\s+/).filter((w) => w.length > 4).slice(0, 3)];
    for (const f of checkCrossTierPhraseUniqueness({ fastRead: b.fastRead, deepRead: b.deepRead, fullRead: b.fullRead }, allow, "breakdown")) issues.push(f.message);
    return issues;
  };
  for (let iter = 2; iter <= VOICE_PASS_MAX; iter++) {
    const issues = runProseChecksOnBreakdown(breakdown);
    if (issues.length === 0) {
      log(`voice pass: clean after iter ${iter - 1}, stopping`);
      break;
    }
    log(`voice pass iter ${iter}: ${issues.length} findings, re-running`);
    try {
      breakdown = await agents.runVoicePass({ brief, plan, draft: breakdown, priorFindings: issues });
      recordGenerationStage(generationManifest, {
        stage: "voice-pass",
        input: { brief, plan, priorFindings: issues },
        output: breakdown,
        attemptCount: iter,
      });
    } catch (err) {
      const event = recordGenerationDegradation(generationManifest, {
        stage: "voice-pass",
        inputHashes: generationInputHashes({ brief, plan, priorFindings: issues, draft: breakdown }),
        error: err,
        attemptCount: iter,
        fallbackUsed: {
          kind: "previous-clean-voice-pass-output",
          policy: "availability",
          reason: "Retained the last successful voice-pass output after a later iteration failed.",
        },
        fallbackOutput: breakdown,
        severity: "serious",
        requiredDisposition: "resolve_before_production",
      });
      log(`voice pass iter ${iter} failed: ${(err as Error).message}; recorded degradation ${event.eventId}`);
      break;
    }
  }

  // Final line-editor pass — surgical sentence-level polish AFTER voice has
  // been brought home. Closes the editorial-quality gap to commercial apps.
  log(`line editor: surgical polish pass…`);
  try {
    const beforeLineEditor = breakdown;
    breakdown = await agents.runLineEditor({ brief, plan, draft: breakdown });
    recordGenerationStage(generationManifest, {
      stage: "line-editor",
      input: { brief, plan, draft: beforeLineEditor },
      output: breakdown,
    });
    log(`line editor: done (fastRead=${breakdown.fastRead.length}c, deepRead=${breakdown.deepRead.length}c, fullRead=${breakdown.fullRead.length}c)`);
  } catch (err) {
    const event = recordGenerationDegradation(generationManifest, {
      stage: "line-editor",
      inputHashes: generationInputHashes({ brief, plan, draft: breakdown }),
      error: err,
      attemptCount: 1,
      fallbackUsed: {
        kind: "voice-passed-draft",
        policy: "availability",
        reason: "Line editor failed after voice pass; retained the voice-passed draft.",
      },
      fallbackOutput: breakdown,
      severity: "serious",
      requiredDisposition: "resolve_before_production",
    });
    log(`line editor: failed (${(err as Error).message}), keeping voice-passed draft; recorded degradation ${event.eventId}`);
  }

  // Library ledger: forbidden names from recent books. This is a read-only
  // snapshot; the actual ingest later uses withLibraryState so the load-modify-
  // write sequence stays atomic under concurrent generateBook runs.
  const librarySnapshot = loadLibraryState();
  const libraryForbidden = getForbiddenNames(librarySnapshot, book.bookId, 10);
  log(`librarian: ${libraryForbidden.length} forbidden names from recent books`);

  // Examples — over-generate 3× per slot, curator picks. If the first batch
  // all fails validation, try a fallback batch with a shorter usedNames list
  // (drop library-wide forbidden list, keep only within-chapter dedup).
  log(`examples: over-generating ${plan.exampleCount} × ${CANDIDATES_PER_SLOT}…`);
  const examples: ExampleOutput[] = [];
  const usedNames: string[] = [...libraryForbidden];
  const withinChapterNames: string[] = [];
  for (let i = 0; i < plan.exampleSpecs.length; i++) {
    const spec = plan.exampleSpecs[i];
    const t0 = Date.now();

    const runBatch = async (namesList: string[]) => {
      const promises = Array.from({ length: CANDIDATES_PER_SLOT }, () =>
        agents.runWriterExample({
          brief,
          plan,
          spec,
          specIndex: i,
          usedNames: [...namesList],
          sourceAnchors: selectAnchorsForClaim(sourceEvidence, ["example"], spec.sourceAnchorIds, 4),
        })
          .then((ex) => ({ ok: true as const, ex }))
          .catch((err) => ({ ok: false as const, err: (err as Error).message })),
      );
      const settled = await Promise.all(promises);
      const oks = settled.filter((s): s is { ok: true; ex: ExampleOutput } => s.ok).map((s) => s.ex);
      const errs = settled.filter((s) => !s.ok).map((s) => (s as any).err as string);
      return { candidates: oks, errors: errs };
    };

    let { candidates, errors } = await runBatch(usedNames);
    if (candidates.length === 0) {
      // Diagnose why: if the failures are all pronoun/noise "reused name"
      // errors, filter those out of the list and retry with the cleaned one.
      // This preserves cross-book uniqueness while dropping false positives.
      const noiseRe = /reused name "(You|Your|We|Us|Our|My|I|Me|Him|Them|Who|What|Why|How|He|She|They|It|This|That|These|Those|Here|There|Not|Nobody|Anybody|Somebody|Everyone|Someone|Anyone|None|Yes|No|Maybe|Once|Only|Even|Also|Still|Again|Just|When|Where|While|Before|After|During|Until|Since|And|But|Or|So|If|Because|Then|Now|Today|Tomorrow|The|A|An|First|Second|Third|Fourth|Fifth|Last|Next)"/;
      const noisyFraction = errors.filter((e) => noiseRe.test(e)).length / Math.max(1, errors.length);
      if (noisyFraction >= 0.5) {
        log(`  example[${i}] batch 1 all failed on pronoun/noise names, filtering ledger and retrying…`);
        const cleaned = usedNames.filter((n) => !/^(You|Your|We|Us|Our|My|I|Me|Him|Them|Who|What|Why|How|He|She|They|It|This|That|These|Those|Here|There|Not|Nobody|Anybody|Somebody|Everyone|Someone|Anyone|None|Yes|No|Maybe|Once|Only|Even|Also|Still|Again|Just|When|Where|While|Before|After|During|Until|Since|And|But|Or|So|If|Because|Then|Now|Today|Tomorrow|The|A|An|First|Second|Third|Fourth|Fifth|Last|Next)$/.test(n));
        const retry = await runBatch(cleaned);
        const event = recordGenerationDegradation(generationManifest, {
          stage: "writer-example",
          inputHashes: generationInputHashes({ spec, specIndex: i, usedNames, initialErrors: errors }),
          error: new Error(`example[${i}] initial candidate batch failed on pronoun/noise name constraints`),
          attemptCount: 2,
          fallbackUsed: {
            kind: "filtered-ledger-name-list",
            policy: "availability",
            reason: "Filtered pronoun/noise tokens from the forbidden-name ledger and retried the same example slot.",
          },
          fallbackOutput: { candidateCount: retry.candidates.length, errors: retry.errors },
          severity: "serious",
          requiredDisposition: "resolve_before_production",
        });
        log(`  example[${i}] fallback recorded ${event.eventId}`);
        candidates = retry.candidates;
        errors = retry.errors;
      } else {
        log(`  example[${i}] batch 1 all failed: ${errors.slice(0, 3).join(" | ")}`);
        log(`  example[${i}] retry with relaxed name constraints (within-chapter only, no cross-book forbidden)…`);
        const retry = await runBatch(withinChapterNames);
        const event = recordGenerationDegradation(generationManifest, {
          stage: "writer-example",
          inputHashes: generationInputHashes({ spec, specIndex: i, usedNames, initialErrors: errors }),
          error: new Error(`example[${i}] initial candidate batch failed`),
          attemptCount: 2,
          fallbackUsed: {
            kind: "within-chapter-name-list",
            policy: "availability",
            reason: "Dropped cross-book forbidden names for this retry; within-chapter dedupe remained active.",
          },
          fallbackOutput: { candidateCount: retry.candidates.length, errors: retry.errors },
          severity: "serious",
          requiredDisposition: "resolve_before_production",
        });
        log(`  example[${i}] fallback recorded ${event.eventId}`);
        candidates = retry.candidates;
        errors = retry.errors;
      }
    }
    if (candidates.length === 0) {
      log(`  example[${i}] batch 2 all failed: ${errors.slice(0, 3).join(" | ")}`);
      throw new Error(`example[${i}] all candidates failed: ${errors.slice(0, 3).join(" | ")}`);
    }

    let winner: ExampleOutput;
    if (candidates.length === 1) {
      winner = candidates[0];
    } else {
      const curated = await agents.runExampleCurator({ brief, plan, spec, candidates });
      winner = candidates[curated.winnerIndex];
    }
    examples.push(winner);
    recordGenerationStage(generationManifest, {
      stage: "writer-example",
      input: { spec, specIndex: i },
      output: winner,
      attemptCount: candidates.length,
    });
    for (const n of extractNamesFromText(winner.scenario)) {
      if (!usedNames.includes(n)) usedNames.push(n);
      if (!withinChapterNames.includes(n)) withinChapterNames.push(n);
    }
    log(`  example[${i}] [${spec.format}] "${winner.title}" (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  log(`quiz + cards + impl-plan + takeaway + tryThisNow: in parallel…`);
  const quizAnchors = selectAnchorsForClaim(sourceEvidence, ["quiz_prompt", "quiz_explanation", "quiz_key_evidence"], plan.quizFocus.sourceAnchorIds, 12);
  const cardAnchors = selectAnchorsForClaim(sourceEvidence, ["review_card"], plan.cardFocus.sourceAnchorIds, 8);
  const implementationAnchors = selectAnchorsForClaim(sourceEvidence, ["implementation_guidance", "takeaway"], plan.coreMoveSourceAnchorIds, 8);
  const tryThisNowPromise = agents.runTryThisNow({ brief, plan })
    .then((output) => {
      recordGenerationStage(generationManifest, {
        stage: "try-this-now",
        input: { brief, plan },
        output,
      });
      return output;
    })
    .catch((err) => {
      const event = recordGenerationDegradation(generationManifest, {
        stage: "try-this-now",
        inputHashes: generationInputHashes({ brief, plan }),
        error: err,
        attemptCount: 1,
        fallbackUsed: {
          kind: "omitted-optional-callout",
          policy: "availability",
          reason: "tryThisNow support stage failed; omitted the optional callout rather than inventing one.",
        },
        fallbackOutput: null,
        severity: "serious",
        requiredDisposition: "resolve_before_production",
      });
      log(`tryThisNow failed: ${(err as Error).message}; recorded degradation ${event.eventId}`);
      return undefined;
    });
  const [quiz, cards, ipPlan, keyTakeaway, tryThisNow] = await Promise.all([
    agents.runWriterQuiz({ brief, plan, breakdown: { easy: breakdown.fastRead, medium: breakdown.deepRead, hard: breakdown.fullRead } as any, sourceAnchors: quizAnchors }),
    agents.runWriterCards({ brief, plan, breakdown: { easy: breakdown.fastRead, medium: breakdown.deepRead, hard: breakdown.fullRead } as any, sourceAnchors: cardAnchors }),
    agents.runWriterImplementationPlan({ brief, plan, breakdown: { easy: breakdown.fastRead, medium: breakdown.deepRead, hard: breakdown.fullRead } as any, sourceAnchors: implementationAnchors }),
    agents.generateKeyTakeaway(brief, plan, breakdown.deepRead, selectAnchorsForClaim(sourceEvidence, ["takeaway", "core_move"], plan.coreMoveSourceAnchorIds, 6)),
    tryThisNowPromise,
  ]);
  recordGenerationStage(generationManifest, {
    stage: "writer-quiz",
    input: { brief, plan, breakdownHash: generationInputHash(breakdown), anchorIds: anchorIds(quizAnchors) },
    output: quiz,
  });
  recordGenerationStage(generationManifest, {
    stage: "writer-cards",
    input: { brief, plan, breakdownHash: generationInputHash(breakdown), anchorIds: anchorIds(cardAnchors) },
    output: cards,
  });
  recordGenerationStage(generationManifest, {
    stage: "writer-implementation-plan",
    input: { brief, plan, breakdownHash: generationInputHash(breakdown), anchorIds: anchorIds(implementationAnchors) },
    output: ipPlan,
  });
  recordGenerationStage(generationManifest, {
    stage: "key-takeaway",
    input: { brief, plan, deepReadHash: generationInputHash(breakdown.deepRead) },
    output: keyTakeaway,
  });
  log(`quiz=${quiz.questions.length}q, cards=${cards.cards.length}, plan=${ipPlan.ifThenPlans.length} if-thens, tryThisNow=${tryThisNow ? "yes" : "skipped"}`);

  // Assemble draft chapter (without memorableLines yet — that runs after assembly)
  const draftAssembled = assembleChapterV21OrThrow({
    plan,
    breakdown,
    examples,
    quiz,
    cards,
    implementationPlan: ipPlan,
    keyTakeaway: keyTakeaway.keyTakeaway,
    keyTakeawaySourceAnchorIds: keyTakeaway.sourceAnchorIds ?? anchorIds(selectAnchorsForClaim(sourceEvidence, ["takeaway", "core_move"], plan.coreMoveSourceAnchorIds, 1)),
    hook,
    tryThisNow: tryThisNow?.tryThisNow,
    tryThisNowSourceAnchorIds: anchorIds(implementationAnchors.slice(0, 1)),
    sourceEvidence,
    generation: generationManifest,
  });

  // Memorable-lines pass: read the assembled chapter, mark the 3 most quotable
  // sentences for downstream UI highlighting/share-cards.
  log(`memorable lines: marking 3 quotable lines…`);
  let memorableLines;
  try {
    const ml = await agents.runMemorableLines(draftAssembled);
    memorableLines = ml.memorableLines;
    recordGenerationStage(generationManifest, {
      stage: "memorable-lines",
      input: { chapterHash: generationInputHash(draftAssembled) },
      output: ml,
    });
    log(`memorable lines: ${memorableLines.length} marked`);
  } catch (err) {
    const event = recordGenerationDegradation(generationManifest, {
      stage: "memorable-lines",
      inputHashes: generationInputHashes({ draftAssembled }),
      error: err,
      attemptCount: 1,
      fallbackUsed: {
        kind: "omitted-quotable-lines",
        policy: "availability",
        reason: "Memorable-lines support stage failed; preserved the assembled chapter without optional highlights.",
      },
      fallbackOutput: null,
      severity: "serious",
      requiredDisposition: "resolve_before_production",
    });
    log(`memorable lines failed: ${(err as Error).message}, continuing without; recorded degradation ${event.eventId}`);
  }

  const assembled = assembleChapterV21OrThrow({
    plan,
    breakdown,
    examples,
    quiz,
    cards,
    implementationPlan: ipPlan,
    keyTakeaway: keyTakeaway.keyTakeaway,
    keyTakeawaySourceAnchorIds: keyTakeaway.sourceAnchorIds ?? anchorIds(selectAnchorsForClaim(sourceEvidence, ["takeaway", "core_move"], plan.coreMoveSourceAnchorIds, 1)),
    hook,
    tryThisNow: tryThisNow?.tryThisNow,
    tryThisNowSourceAnchorIds: anchorIds(implementationAnchors.slice(0, 1)),
    memorableLines,
    sourceEvidence,
    generation: generationManifest,
  });
  recordGenerationStage(generationManifest, {
    stage: "assembly",
    input: { planHash: generationInputHash(plan), supportHash: generationInputHash({ examples, quiz, cards, ipPlan, keyTakeaway, tryThisNow, memorableLines }) },
    output: assembled,
  });

  // Final ship gate. The assembled chapter is run through every critic in
  // the FAILURE-MODES catalog. Blockers fail-close: the chapter does NOT
  // get persisted to disk. Majors/minors are logged but allow the ship.
  const gate = runShipGate(assembled);
  recordGenerationStage(generationManifest, {
    stage: "ship-gate",
    input: { chapterHash: generationInputHash(assembled) },
    output: { passed: gate.passed, blockers: gate.blockers.length, majors: gate.majors.length, minors: gate.minors.length },
  });
  log(formatGateReport(gate));
  if (!gate.passed) {
    // Save the failed draft to a quarantine path so it can be inspected.
    const quarantineDir = resolve(stateRoot, "chapters", "_blocked");
    mkdirSync(quarantineDir, { recursive: true });
    writeFileSync(
      resolve(quarantineDir, `${chapter.chapterId}.blocked.${Date.now()}.json`),
      JSON.stringify({ chapter: assembled, gate }, null, 2),
      "utf8",
    );
    throw new Error(`Ship gate BLOCKED ${chapter.chapterId}: ${gate.blockers.length} blocker(s). See quarantine.`);
  }
  const boundaryProblems = validateCachedChapterForReuse(assembled, book, chapter, chapterOutPath, { stateRoot, runsRoot });
  if (boundaryProblems.length > 0) {
    const quarantineDir = resolve(stateRoot, "chapters", "_blocked");
    mkdirSync(quarantineDir, { recursive: true });
    writeFileAtomic(
      resolve(quarantineDir, `${chapter.chapterId}.boundary.${Date.now()}.json`),
      JSON.stringify({ chapter: assembled, boundaryProblems }, null, 2),
    );
    throw new Error(`Boundary validation BLOCKED ${chapter.chapterId}: ${boundaryProblems.slice(0, 5).join("; ")}. See quarantine.`);
  }

  // Write output ATOMICALLY (tmp+rename): a SIGKILL/crash mid-write must never leave a
  // truncated chapter JSON — that torn file crashes loadBookChapters on resume and wedges
  // the walk-away conductor permanently. rename(2) leaves either the old file or the complete
  // new one.
  const authorSessionId = requireCurrentSessionId(`generateChapter ${chapter.chapterId}`);
  generationManifest.authorSessionId = authorSessionId;
  const finalChapter: ChapterV21 = {
    ...assembled,
    authoring: {
      schemaVersion: "chapter-authoring-v1",
      ...(assembled.authoring ?? {}),
      generation: generationManifest,
    },
  };
  // Bind author provenance to the authored content hash (create-once per content).
  recordAuthorProvenance(finalChapter.chapterId, authorSessionId, chapterContentHash(finalChapter));
  const outDir = resolve(stateRoot, "chapters");
  const finalChapterPath = resolve(outDir, `${chapter.chapterId}.v21-native.chapter.json`);
  writeFileAtomic(finalChapterPath, JSON.stringify(finalChapter, null, 2));
  writeGenerationManifestSidecar(generationManifest, stateRoot);
  writeStageCacheManifest({
    artifactPath: finalChapterPath,
    artifactType: "chapter",
    artifactId: chapter.chapterId,
    inputs: buildChapterCacheInputs(book, chapter, provider, codeVersion, cacheContext),
    generatorName: "generateChapter",
    provider,
    codeVersion,
  });

  // Ingest into library ledger atomically — re-loads under lock so concurrent
  // generateBook runs don't lose updates. (The earlier librarySnapshot was
  // a stale read used only for the forbidden-names list above.)
  const updated = await withLibraryState((state) => {
    ingestIntoLibrary(state, book.bookId, book.title, book.author, finalChapter);
  });
  log(`librarian: ingested. Book now has ${updated.books[book.bookId].namesUsed.length} unique names across ${updated.books[book.bookId].chaptersIngested.length} chapters.`);

  log(`chapter done: ${((Date.now() - overall) / 1000).toFixed(1)}s wall`);
  return finalChapter;
}

export function readingLevels(chapter: ChapterV21): { fastRead: number; deepRead: number; fullRead: number } {
  return {
    fastRead: fleschKincaid(chapter.breakdown.fastRead),
    deepRead: fleschKincaid(chapter.breakdown.deepRead),
    fullRead: fleschKincaid(chapter.breakdown.fullRead),
  };
}
