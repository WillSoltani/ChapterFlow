/**
 * CatalogRubricPanelEvaluator — the WHOLE-BOOK reader panel (R-080, R-147).
 *
 * Three independent readers each read the same whole-book document — every
 * reader-facing chapter when the book has at most six, otherwise the md5-seeded
 * four the catalog scorer has always sampled — and return the catalog rubric's
 * ten factor scores, a correctness-gate verdict with its quoted violations, and
 * a cross-chapter churn call. The instrument itself (prompt, sampling,
 * aggregation) lives in `src/review/catalogRubric.ts`; this module is the model
 * seam and nothing else.
 *
 * WHY A SECOND PANEL AT ALL. The per-chapter panel reads ONE chapter and is
 * given the chapter title and nothing else (`renderReaderDoc`), so it cannot
 * see one-house voice, sameness across chapters, or a book that clears the
 * per-chapter floor everywhere and is still not shippable (R-147). This panel
 * sees the book.
 *
 * FAIL-CLOSED, and the distinction matters. Every failure here returns an
 * ERROR-shaped `Result` error, never a manufactured verdict:
 *   - a runner outcome that is not SUCCEEDED, after the bounded retry, is
 *     `CATALOG_RUBRIC_READER_FAILED` (infrastructure);
 *   - operator cancellation is `CATALOG_RUBRIC_CANCELLED`;
 *   - output the strict assembly refuses, after the bounded retry, is
 *     `CATALOG_RUBRIC_READER_UNPARSEABLE`;
 *   - a candidate whose CHAPTER set will not parse is
 *     `CATALOG_RUBRIC_CANDIDATE_INVALID`.
 * None of these is a gate FAIL. A book that could not be scored is a book that
 * cannot be promoted AND cannot be blamed — the caller reports uncertainty.
 *
 * COST. Three reads of a whole book at the review role's xhigh tier is the most
 * expensive single call this pipeline makes, so the retry budget is THREE — one
 * blind draw, then up to two re-draws — smaller than the per-chapter seat's
 * four, and a PROVIDER BLOCK is never retried and stops the panel immediately
 * rather than walking the remaining readers into the same wall. Nothing here
 * re-scores bytes that already have a durable record: that short-circuit is the
 * caller's, and it is why this evaluator is only ever reached once per
 * candidate.
 *
 * This module makes NO model call of its own — every read goes through the
 * injected `ModelTaskRunner` with role "review", the same choke the per-chapter
 * seats and the QC judge use.
 */

import { createHash } from "node:crypto";

import type { CandidateSnapshot } from "../books/candidateTypes.js";
import type { ModelTaskContext, Result, UtcIso } from "../contracts/v4Core.js";
import {
  CATALOG_RUBRIC_INSTRUMENT_VERSION,
  CATALOG_RUBRIC_READERS,
  CatalogRubricReaderError,
  assembleCatalogRubricReader,
  buildCatalogRubricReaderTask,
  buildRegisterHint,
  parseCatalogRubricReaderJson,
  renderBookRubricDocument,
  selectRubricChapterIndexes,
  type CatalogRubricReaderResultV1,
} from "../review/catalogRubric.js";
import type { CatalogRubricRecordV1 } from "../review/catalogRubricStore.js";
import { isTransientReaderModelResult } from "../review/laneOrchestrator.js";
import { ensureTrailingNewline } from "../lib/atomicWrite.js";
import type { ModelResult } from "../runtime/modelResult.js";
import { isUnretryableProviderMessage } from "../runtime/modelErrors.js";
import type { ChapterV21 } from "../types.js";
import {
  jsonPromptRequest,
  renderUntrustedSourceBlock,
  type ModelTaskRunner,
} from "./modelTaskRunner.js";
import { parseCandidateChapterSet } from "./semanticPanelReviewEvaluator.js";

export const CATALOG_RUBRIC_CANDIDATE_INVALID = "CATALOG_RUBRIC_CANDIDATE_INVALID";
export const CATALOG_RUBRIC_READER_FAILED = "CATALOG_RUBRIC_READER_FAILED";
export const CATALOG_RUBRIC_READER_UNPARSEABLE = "CATALOG_RUBRIC_READER_UNPARSEABLE";
export const CATALOG_RUBRIC_CANCELLED = "CATALOG_RUBRIC_CANCELLED";

/** One blind draw plus up to two re-draws. Smaller than the per-chapter seat's
 *  four on purpose: one attempt here is a whole-book read.
 *
 *  A re-draw after a REFUSED BLOCK is informed — the strict assembly's own
 *  message is appended to the task, so the reader is told which field it got
 *  wrong instead of re-rolling blind against the same instruction. A re-draw
 *  after an infrastructure failure carries nothing extra: there is nothing the
 *  reader did wrong to tell it about. */
export const MAX_RUBRIC_READER_ATTEMPTS = 3;

/** The repair note appended to a re-draw whose predecessor would not assemble.
 *  It NAMES the defect and re-states the contract; it never supplies a value,
 *  so it cannot steer a score. */
export function rubricReaderRepairNote(refusal: string): string {
  return `\n\nYOUR PREVIOUS ANSWER WAS REJECTED and no score was recorded: ${refusal}\n`
    + "Re-read the chapters and answer again. Return ONLY the JSON object described above, with EVERY field it"
    + " names present and in range. Do not change your judgement to satisfy this note — fix the format.";
}

/** Backoff (ms) before each retry, indexed by (attempt - 1) and clamped to the
 *  last entry — the per-chapter seat's schedule, so a provider rate-limit blip
 *  clears on a short delay instead of an immediate re-spawn. */
export const RUBRIC_READER_RETRY_BACKOFF_MS: readonly number[] = Object.freeze([2000, 8000]);

const defaultSleep = (ms: number): Promise<void> => new Promise((done) => { setTimeout(done, ms); });

function failure<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function backoffForAttempt(attempt: number): number {
  const index = Math.min(Math.max(attempt - 1, 0), RUBRIC_READER_RETRY_BACKOFF_MS.length - 1);
  return RUBRIC_READER_RETRY_BACKOFF_MS[index];
}

/** Read one JSON sidecar out of the candidate. Returns undefined for absent or
 *  unreadable — a missing voice card is a fact about the run, not an error. */
function readJsonSidecar(candidate: CandidateSnapshot, logicalPath: string): Record<string, unknown> | undefined {
  const file = candidate.files.find((entry) => entry.logicalPath === logicalPath);
  if (file === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(Buffer.from(file.bytes).toString("utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    return value as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * The register hint's inputs, read from the candidate the run is judging: the
 * voice card the section writers were actually given, then the bibliography's
 * frozen `authorVoice.register`. Both are already inside the digest-verified
 * candidate, so the hint is reproducible from the same bytes the panel read.
 */
export function registerHintForCandidate(candidate: CandidateSnapshot, author: string): string {
  const taskContext = readJsonSidecar(candidate, "inputs/compiler-section-task-context.json");
  const voiceCard = typeof taskContext?.voiceCard === "string" ? taskContext.voiceCard : null;
  const bibliography = readJsonSidecar(candidate, "inputs/research/bibliography.raw.json");
  const authorVoice = bibliography?.authorVoice;
  const register = authorVoice !== null && typeof authorVoice === "object" && !Array.isArray(authorVoice)
    && typeof (authorVoice as Record<string, unknown>).register === "string"
    ? (authorVoice as Record<string, unknown>).register as string
    : null;
  return buildRegisterHint({ author, voiceCard, register });
}

export type CatalogRubricPanelRequest = Readonly<{
  bookId: string;
  title: string;
  author: string;
  candidate: CandidateSnapshot;
  completedAt: UtcIso;
  taskContext: ModelTaskContext;
}>;

export interface CatalogRubricPanel {
  score(request: CatalogRubricPanelRequest): Promise<Result<CatalogRubricRecordV1>>;
}

export interface CatalogRubricPanelDependencies {
  readonly runner: ModelTaskRunner;
  /** Gateway route profile for reader tasks; defaults to the attempt-scoped
   *  read-json profile every other reader lane uses. */
  readonly profileId?: string;
  /** Injectable backoff so the retry path is exercised without a wall-clock
   *  wait. Production uses setTimeout. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export class CatalogRubricPanelEvaluator implements CatalogRubricPanel {
  readonly #runner: ModelTaskRunner;
  readonly #profileId: string;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(dependencies: CatalogRubricPanelDependencies) {
    this.#runner = dependencies.runner;
    this.#profileId = dependencies.profileId ?? "attempt-read-json-v1";
    this.#sleep = dependencies.sleep ?? defaultSleep;
  }

  async score(request: CatalogRubricPanelRequest): Promise<Result<CatalogRubricRecordV1>> {
    let chapters: { chapter: ChapterV21; number: number }[];
    try {
      chapters = parseCandidateChapterSet(request.candidate);
    } catch (error) {
      return failure(CATALOG_RUBRIC_CANDIDATE_INVALID, (error as Error).message);
    }
    const indexes = selectRubricChapterIndexes(request.bookId, chapters.length);
    const sampled = indexes.map((index) => chapters[index]);
    const document = ensureTrailingNewline(renderBookRubricDocument({
      title: request.title,
      author: request.author,
      chapters: sampled,
      totalChapters: chapters.length,
    }));
    const documentSha256 = createHash("sha256").update(document, "utf8").digest("hex");
    const documentBlock = renderUntrustedSourceBlock("book-document", document, "markdown");
    const registerHint = registerHintForCandidate(request.candidate, request.author);
    const chapterNumbers = sampled.map(({ number }) => number);

    const readers: CatalogRubricReaderResultV1[] = [];
    for (let readerNumber = 1; readerNumber <= CATALOG_RUBRIC_READERS; readerNumber += 1) {
      const task = buildCatalogRubricReaderTask({
        readerNumber,
        title: request.title,
        author: request.author,
        registerHint,
        chapterNumbers,
        totalChapters: chapters.length,
      });
      const scored = await this.#runReader({
        task,
        documentBlock,
        readerNumber,
        taskContext: request.taskContext,
      });
      if (!scored.ok) return scored;
      readers.push(scored.value);
    }

    return {
      ok: true,
      value: {
        schemaVersion: "1",
        instrumentVersion: CATALOG_RUBRIC_INSTRUMENT_VERSION,
        bookId: request.bookId,
        candidate: {
          candidateId: request.candidate.manifest.candidateId,
          manifestDigest: request.candidate.manifest.manifestDigest,
        },
        title: request.title,
        author: request.author,
        totalChapters: chapters.length,
        sampledChapterNumbers: chapterNumbers,
        documentSha256,
        readers,
        completedAt: request.completedAt,
      },
    };
  }

  /** One reader, with the bounded retry. Every exit that is not a strictly
   *  assembled reader block is an ERROR — never a substituted score. */
  async #runReader(input: Readonly<{
    task: string;
    documentBlock: string;
    readerNumber: number;
    taskContext: ModelTaskContext;
  }>): Promise<Result<CatalogRubricReaderResultV1>> {
    const attemptBase = `${input.taskContext.attemptId}-rubric-r${input.readerNumber}`;
    const operationId = `catalog-rubric-reader-${input.readerNumber}`;
    let lastDetail = "no attempt was made";
    // Set only when a draw was REFUSED by the strict assembly, so the next draw
    // is told what was wrong with the last one — and CLEARED as soon as that
    // draw has carried it. A note that survived its own draw followed the reader
    // into an infrastructure re-draw and told it its (never-delivered) last
    // answer had been rejected: an instruction to fix a fault it did not commit.
    let repairNote = "";
    for (let attempt = 1; attempt <= MAX_RUBRIC_READER_ATTEMPTS; attempt += 1) {
      const context: ModelTaskContext = {
        ...input.taskContext,
        attemptId: attempt === 1 ? attemptBase : `${attemptBase}-a${attempt}`,
        operationId,
      };
      const carriedNote = repairNote;
      // Consumed here: the note belongs to the draw IMMEDIATELY following the
      // refusal that produced it, and to no later draw.
      repairNote = "";
      const result: ModelResult = await this.#runner.run({
        profileId: this.#profileId,
        role: "review",
        prompt: jsonPromptRequest(`${input.task}${carriedNote}`, input.documentBlock),
        context,
      });
      if (result.outcome !== "SUCCEEDED") {
        const detail = result.error ? `${result.error.code}:${result.error.message}` : result.outcome;
        lastDetail = detail;
        if (result.outcome === "CANCELLED") {
          return failure(CATALOG_RUBRIC_CANCELLED, `catalog-rubric reader ${input.readerNumber} cancelled: ${detail}`);
        }
        // A provider block (exhausted window, dead credential) is a wall, not
        // variance: retrying it spends another whole-book call against the same
        // wall. Stop here and report it.
        if (isUnretryableProviderMessage(detail)) {
          return failure(
            CATALOG_RUBRIC_READER_FAILED,
            `catalog-rubric reader ${input.readerNumber} blocked by the provider: ${detail}`,
          );
        }
        if (attempt < MAX_RUBRIC_READER_ATTEMPTS && isTransientReaderModelResult(result)) {
          await this.#sleep(backoffForAttempt(attempt));
          continue;
        }
        return failure(
          CATALOG_RUBRIC_READER_FAILED,
          `catalog-rubric reader ${input.readerNumber} did not complete after ${attempt} attempt(s): ${detail}`,
        );
      }
      const stdout = typeof result.output === "string" ? result.output : JSON.stringify(result.output ?? null);
      try {
        const parsed = parseCatalogRubricReaderJson(stdout);
        if (parsed === null) {
          throw new CatalogRubricReaderError(
            `catalog-rubric reader ${input.readerNumber}: no parseable JSON object in the reader output`,
          );
        }
        return { ok: true, value: assembleCatalogRubricReader(parsed, input.readerNumber) };
      } catch (error) {
        if (!(error instanceof CatalogRubricReaderError)) throw error;
        lastDetail = error.message;
        if (attempt < MAX_RUBRIC_READER_ATTEMPTS) {
          repairNote = rubricReaderRepairNote(error.message);
          await this.#sleep(backoffForAttempt(attempt));
          continue;
        }
        return failure(CATALOG_RUBRIC_READER_UNPARSEABLE, error.message);
      }
    }
    // Unreachable: the loop returns on every terminal path.
    return failure(
      CATALOG_RUBRIC_READER_FAILED,
      `catalog-rubric reader ${input.readerNumber} retry loop ended without a result: ${lastDetail}`,
    );
  }
}
