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
import { checkReadingLevel, fleschKincaid, LEGACY_TIER_TARGETS } from "./critics/readingLevel.js";
import { runShipGate, formatGateReport } from "./critics/finalGate.js";
import { validateChapterV21 } from "./runtimeSchemas.js";
import { RunPolicy, runPolicy as defaultRunPolicy, formatRunPolicy } from "./policy/runPolicy.js";
import { chooseDeterministicExampleWinner, scoreExampleCandidate } from "./optimizers/exampleScorer.js";
import { scoreProseIssues } from "./optimizers/proseRisk.js";
import { selectMemorableLinesDeterministic } from "./optimizers/memorableLines.js";
import { errorWithRepairPrompt, writeSelfHealingRepairPrompt } from "./repair/selfHealingRepair.js";
import { legacyRouteDisabled } from "./runtime/legacyRouteInventory.js";

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
  /** v22 cost/quality policy. Publish gates stay strict regardless of policy. */
  runPolicy?: RunPolicy;
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
      problems.push(...sourceGate.findings.filter((f) => f.severity === "blocker").map((f) => `source-v2: ${f.checkId} ${f.message}`));
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
  _brief: BookBrief,
  _plan: ChapterDesignDoc,
  _deepRead: string,
  _sourceAnchors: SourceAnchorForPrompt[] = [],
): Promise<KeyTakeawayOutput> {
  throw legacyRouteDisabled("generateChapter.generateKeyTakeaway");
}

export async function generateChapter(
  book: BookMeta,
  chapter: ChapterSpec,
  options: GenerateChapterOptions = {},
): Promise<ChapterV21> {
  throw legacyRouteDisabled("generateChapter.generateChapter");
}

export function readingLevels(chapter: ChapterV21): { fastRead: number; deepRead: number; fullRead: number } {
  return {
    fastRead: fleschKincaid(chapter.breakdown.fastRead),
    deepRead: fleschKincaid(chapter.breakdown.deepRead),
    fullRead: fleschKincaid(chapter.breakdown.fullRead),
  };
}
