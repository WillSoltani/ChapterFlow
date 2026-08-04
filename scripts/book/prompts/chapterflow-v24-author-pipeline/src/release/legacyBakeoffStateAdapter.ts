import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

import type {
  BookContentReader,
  CandidateInputFile,
  CandidateSnapshot,
  CandidateStore,
} from "../books/candidateTypes.js";
import type { PlannedArtifact, Result } from "../contracts/v4Core.js";
import { chapterFileName } from "../lib/chapterPaths.js";
import { authorChapterId } from "../orchestrator/authorRun.js";
import type { ReviewService, ScreeningResult } from "../review/reviewTypes.js";
import type { ChapterV21 } from "../types.js";
import type { BakeoffDeps } from "../bakeoff/runBakeoff.js";
import type { BakeoffRoots } from "../bakeoff/paths.js";
import { slotChaptersDir } from "../bakeoff/paths.js";
import type {
  BlindLabel,
  CandidateReviewV1,
  CandidateScorecardV1,
  CandidateSpec,
} from "../bakeoff/types.js";
import { buildScorecard, type SelectionInputs } from "../bakeoff/selection.js";
import type { ReviewCandidateOptions } from "../bakeoff/review.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";

export const BAKEOFF_SELECTION_AUTHORITY = "SCREENING_ONLY" as const;

export interface BakeoffSelectionReviewer {
  readonly root: string;
  review(input: Readonly<{
    bookId: string;
    label: BlindLabel;
    chapters: readonly ChapterV21[];
    deps: BakeoffDeps;
    options: ReviewCandidateOptions;
  }>): Promise<CandidateReviewV1>;
}

export interface LegacyBakeoffStateAdapterOptions {
  readonly roots: BakeoffRoots;
  readonly candidateStore: CandidateStore;
  readonly contentReader: BookContentReader;
  readonly reviewService: ReviewService;
  readonly selectionReviewer: BakeoffSelectionReviewer;
}

export function normalizeV4BakeoffScorecard(
  input: SelectionInputs[number],
  screening: ScreeningResult,
): CandidateScorecardV1 {
  const scorecard = buildScorecard(input);
  if (screening.outcome === "SHORTLIST" && screening.candidate.candidateId === input.spec.slug) {
    return scorecard;
  }
  return {
    ...scorecard,
    eligible: false,
    disqualifications: [
      ...scorecard.disqualifications,
      `V4 screening authority rejected candidate ${input.label}`,
    ],
  };
}

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function isWithin(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function sameSnapshotFiles(snapshot: CandidateSnapshot, files: readonly CandidateInputFile[]): boolean {
  if (snapshot.files.length !== files.length) return false;
  return snapshot.files.every((stored, index) => {
    const expected = files[index];
    return stored.kind === expected.kind
      && stored.logicalPath === expected.logicalPath
      && stored.mediaType === expected.mediaType
      && Buffer.from(stored.bytes).equals(Buffer.from(expected.bytes));
  });
}

function chaptersFromSnapshot(snapshot: CandidateSnapshot): Result<readonly ChapterV21[]> {
  const chapters: ChapterV21[] = [];
  for (const file of snapshot.files) {
    if (file.kind !== "CHAPTER" || file.mediaType !== "application/json") {
      return failed("CANDIDATE_MISMATCH", `unexpected candidate entry: ${file.logicalPath}`);
    }
    try {
      chapters.push(JSON.parse(Buffer.from(file.bytes).toString("utf8")) as ChapterV21);
    } catch (cause) {
      return failed("CANDIDATE_MISMATCH", `candidate chapter is invalid JSON at ${file.logicalPath}: ${(cause as Error).message}`);
    }
  }
  return { ok: true, value: chapters.sort((left, right) => left.number - right.number) };
}

/**
 * Compatibility edge for one disposable bakeoff run. Candidate bytes cross
 * into V4 once, then all validation/review reads reopen immutable snapshots.
 * Selection remains screening evidence and cannot create canonical review,
 * QC, promotion, current-pointer, package, or publication state.
 */
export class LegacyBakeoffStateAdapter {
  readonly #roots: BakeoffRoots;
  readonly #candidateStore: CandidateStore;
  readonly #contentReader: BookContentReader;
  readonly #reviewService: ReviewService;
  readonly #selectionReviewer: BakeoffSelectionReviewer;

  constructor(options: LegacyBakeoffStateAdapterOptions) {
    if (!isWithin(options.roots.runRoot, options.selectionReviewer.root)) {
      throw new Error("bakeoff selection reviewer root must stay below run root");
    }
    this.#roots = options.roots;
    this.#candidateStore = options.candidateStore;
    this.#contentReader = options.contentReader;
    this.#reviewService = options.reviewService;
    this.#selectionReviewer = options.selectionReviewer;
  }

  async stageCandidate(input: Readonly<{
    bookId: string;
    runId: string;
    spec: CandidateSpec;
    chapterNumbers: readonly number[];
    createdAt: string;
  }>): Promise<Result<CandidateSnapshot>> {
    const expectedNames = input.chapterNumbers.map((chapterNumber) => chapterFileName(authorChapterId(input.bookId, chapterNumber)));
    if (new Set(expectedNames).size !== expectedNames.length) {
      return failed("CANDIDATE_INVENTORY", "candidate chapter inventory contains duplicates");
    }
    const sourceDir = slotChaptersDir(this.#roots, input.spec.slot);
    let actualNames: string[];
    try {
      actualNames = readdirSync(sourceDir, { withFileTypes: true })
        .map((entry) => entry.isFile() ? entry.name : `${entry.name}/`)
        .sort();
    } catch (cause) {
      return failed("CANDIDATE_INVENTORY", `candidate chapter inventory is unreadable: ${(cause as Error).message}`);
    }
    const expectedSorted = [...expectedNames].sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedSorted)) {
      return failed(
        "CANDIDATE_INVENTORY",
        `candidate chapter inventory mismatch: expected [${expectedSorted.join(", ")}], found [${actualNames.join(", ")}]`,
      );
    }

    const inventory: PlannedArtifact[] = expectedNames.map((name) => ({
      kind: "CHAPTER",
      logicalPath: `chapters/${name}`,
      mediaType: "application/json",
    }));
    let files: CandidateInputFile[];
    try {
      files = inventory.map((entry, index) => ({
        ...entry,
        bytes: readFileSync(resolve(sourceDir, expectedNames[index])),
      }));
    } catch (cause) {
      return failed("CANDIDATE_INVENTORY", `candidate chapter bytes changed during staging: ${(cause as Error).message}`);
    }
    const staged = await this.#candidateStore.stage({
      bookId: input.bookId,
      candidateId: input.spec.slug,
      createdByRunId: input.runId,
      expectedInventory: inventory,
      files,
      createdAt: input.createdAt,
    });
    if (!staged.ok && staged.error.code !== "CANDIDATE_EXISTS") return staged;

    const opened = await this.openCandidate(input.bookId, input.spec);
    if (!opened.ok) return opened;
    if (!sameSnapshotFiles(opened.value, files)) {
      return failed("CANDIDATE_MISMATCH", `immutable candidate differs from generated slot: ${input.spec.slug}`);
    }
    return opened;
  }

  openCandidate(bookId: string, spec: CandidateSpec): Promise<Result<CandidateSnapshot>> {
    return this.#contentReader.open({
      bookId,
      selector: { kind: "CANDIDATE", candidateId: spec.slug },
    });
  }

  candidateChapters(snapshot: CandidateSnapshot): Result<readonly ChapterV21[]> {
    return chaptersFromSnapshot(snapshot);
  }

  async reviewForSelection(input: Readonly<{
    bookId: string;
    spec: CandidateSpec;
    label: BlindLabel;
    deps: BakeoffDeps;
    options: ReviewCandidateOptions;
  }>): Promise<Result<CandidateReviewV1>> {
    const opened = await this.openCandidate(input.bookId, input.spec);
    if (!opened.ok) return opened;
    const screening = await this.screening(input.bookId, input.spec, input.label);
    if (!screening.ok) return screening;
    if (screening.value.outcome !== "SHORTLIST") {
      return failed("SCREENING_REJECTED", `candidate ${input.label} was not shortlisted`);
    }
    const chapters = chaptersFromSnapshot(opened.value);
    if (!chapters.ok) return chapters;
    let review: CandidateReviewV1;
    try {
      review = await this.#selectionReviewer.review({
        bookId: input.bookId,
        label: input.label,
        chapters: chapters.value,
        deps: input.deps,
        options: input.options,
      });
    } catch (cause) {
      return failed("SCREENING_REVIEW_ERROR", `selection reviewer failed: ${(cause as Error).message}`);
    }
    return { ok: true, value: review };
  }

  async screening(bookId: string, spec: CandidateSpec, label: BlindLabel): Promise<Result<ScreeningResult>> {
    const opened = await this.openCandidate(bookId, spec);
    if (!opened.ok) return opened;
    const screening = await this.#reviewService.screen(opened.value);
    if (!screening.ok) return screening;
    const evidenceDir = resolve(this.#roots.reviewsDir, label);
    mkdirSync(evidenceDir, { recursive: true });
    writeFileAtomic(resolve(evidenceDir, "screening.json"), `${JSON.stringify({
      schemaVersion: "1",
      authority: BAKEOFF_SELECTION_AUTHORITY,
      screening: screening.value,
    }, null, 2)}\n`);
    return screening;
  }
}
