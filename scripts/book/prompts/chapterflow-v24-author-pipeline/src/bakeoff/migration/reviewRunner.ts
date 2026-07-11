/**
 * IMP-11 — blinded per-sample review (prompt inst. 10-11; §16 controls 7-9).
 *
 * The PRODUCTION phase-1 chapter instrument (reviewOneChapter — key-free doc,
 * physically isolated reviewer workspace via IMP-08, byte-verified quotes,
 * phase-2 quiz adjudication on persisting reads) scores each committed sample
 * under its opaque blind id:
 *
 *  - only Stage-Q-QUALIFIED judges may score (assertJudgeQualified — a failed
 *    or missing qualification refuses the spawn, inst. 4);
 *  - every reviewer-visible byte (doc text, doc filename, task) is screened
 *    against the experiment's forbidden identity tokens (models, stacks, cell
 *    ids, stage vocabulary) — a leak is fail-closed, never a warning;
 *  - review outputs are IMMUTABLE: a sample with a persisted review is skipped
 *    on re-entry (an inconvenient judge is never re-rolled, §16 control 9);
 *  - the prespecified agreement subsample (sampleIndex 1, panel > 1) gets ONE
 *    second read by the next panel judge — the judge-agreement metric's input.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { writeFileAtomic, ensureTrailingNewline } from "../../lib/atomicWrite.js";
import type { AutopilotDeps } from "../../orchestrator/autopilot.js";
import { resolveAuthorReviewIo, reviewOneChapter } from "../../orchestrator/authorReview.js";
import { AUTHOR_CHAPTER_BAR } from "../../review/readerReview.js";
import type { ChapterV21 } from "../../types.js";
import { PIPELINE_DIR } from "../paths.js";
import { assertNoIdentityLeak, judgeDeps, type JudgeSpec } from "../review.js";
import type { EffortLevelV1 } from "../../contracts/executionProfile.js";
import {
  type ExperimentSpecV1,
  type MigrationReviewSummaryV1,
  type MigrationSampleRecordV1,
} from "./experimentTypes.js";
import { migrationForbiddenTokens, MigrationGuardError, rootedPath, rootedWrite, type MigrationRoots } from "./guards.js";
import { assertJudgeQualified } from "./qualification.js";
import { sampleRecordPath } from "./sampleRunner.js";

export type ReviewSampleOptions = {
  record: MigrationSampleRecordV1;
  spec: ExperimentSpecV1;
  roots: MigrationRoots;
  deps: AutopilotDeps;
  allowSyntheticQualification: boolean;
  log: (m: string) => void;
  /** Test seam (default: the real phase-1 instrument). */
  reviewFn?: typeof reviewOneChapter;
};

function loadSampleChapter(record: MigrationSampleRecordV1): ChapterV21 {
  if (!record.artifact.chapterRelPath) {
    throw new MigrationGuardError(`sample ${record.blindSampleId} has no committed chapter to review`);
  }
  const abs = resolve(PIPELINE_DIR, record.artifact.chapterRelPath);
  if (!existsSync(abs)) throw new MigrationGuardError(`sample ${record.blindSampleId}: committed chapter missing at ${abs}`);
  return JSON.parse(readFileSync(abs, "utf8")) as ChapterV21;
}

/** Deterministic panel assignment: primary judge rotates by execution order;
 *  the agreement read (sampleIndex 1, panel > 1) uses the NEXT panel judge. */
export function panelAssignment(spec: ExperimentSpecV1, record: MigrationSampleRecordV1): { primary: JudgeSpec; agreement: JudgeSpec | null } {
  const panel = spec.judgePanel;
  const primary = panel[record.executionOrder % panel.length];
  const agreement = panel.length > 1 && record.sampleIndex === 1
    ? panel[(record.executionOrder + 1) % panel.length]
    : null;
  return { primary, agreement };
}

async function runOneRead(
  opts: ReviewSampleOptions,
  chapter: ChapterV21,
  judge: JudgeSpec,
  tag: string,
  forbidden: string[],
): Promise<MigrationReviewSummaryV1> {
  const jdeps = judgeDeps(opts.deps, judge);
  const io = resolveAuthorReviewIo({
    writeReviewDoc: (_bookId, fileName, text) => {
      const absPath = rootedPath(opts.roots, "samples", opts.record.blindSampleId, "review" + tag, fileName);
      const finalText = ensureTrailingNewline(text);
      assertNoIdentityLeak(fileName, forbidden, `review doc filename (sample ${opts.record.blindSampleId})`);
      assertNoIdentityLeak(finalText, forbidden, `review doc ${fileName} (sample ${opts.record.blindSampleId})`);
      writeFileAtomic(absPath, finalText);
      return { absPath, relPath: absPath };
    },
    persistReview: (_bookId, review) => {
      const p = rootedPath(opts.roots, "samples", opts.record.blindSampleId, "review" + tag, `ch${String(review.chapterNumber).padStart(2, "0")}.review.json`);
      writeFileAtomic(p, JSON.stringify(review, null, 2) + "\n");
      return p;
    },
    authorSessionOf: () => undefined,
    loadChapters: () => [chapter],
  });
  const review = await (opts.reviewFn ?? reviewOneChapter)(opts.record.bookId, chapter, jdeps, io, AUTHOR_CHAPTER_BAR, `-mig-${opts.record.blindSampleId}${tag}`);
  return {
    composite: review.composite,
    ship: review.ship84 === true,
    keysClean: review.keyCheck.matches === review.keyCheck.of,
    valid: review.valid,
    pass: review.pass,
    quizAdjudicationStatus: review.quizAdjudication?.status ?? "absent",
    complaintsMustFix: review.complaints.filter((c) => c.mustFix).length,
    reviewerSessionId: review.reviewerSessionId ?? "",
    judgeModel: judge.model,
    judgeEffort: judge.effort as EffortLevelV1,
  };
}

/** Review one committed sample (resume-safe, immutable): updates and rewrites
 *  the sample record with the primary (and prespecified agreement) read. */
export async function reviewOneSample(opts: ReviewSampleOptions): Promise<MigrationSampleRecordV1> {
  const { record, spec, roots } = opts;
  if (record.review !== null) return record; // immutable — never re-run a judge
  const { primary, agreement } = panelAssignment(spec, record);
  assertJudgeQualified(roots, primary, opts.allowSyntheticQualification);
  if (agreement) assertJudgeQualified(roots, agreement, opts.allowSyntheticQualification);

  const forbidden = migrationForbiddenTokens(spec);
  const chapter = loadSampleChapter(record);
  const primaryRead = await runOneRead(opts, chapter, primary, "", forbidden);
  let agreementRead: MigrationReviewSummaryV1 | null = null;
  if (agreement) {
    agreementRead = await runOneRead(opts, chapter, agreement, "-agree", forbidden);
  }

  const updated: MigrationSampleRecordV1 = {
    ...record,
    review: primaryRead,
    ...(agreementRead ? { agreementReview: agreementRead } : {}),
  };
  rootedWrite(roots, sampleRecordPath(roots, record.blindSampleId), JSON.stringify(updated, null, 2));
  opts.log(`[migration] review ${record.blindSampleId}: ${primaryRead.valid ? (primaryRead.pass ? "PASS" : "FAIL") : "INVALID"} (composite ${primaryRead.composite})${agreementRead ? ` + agreement read ${agreementRead.valid ? (agreementRead.pass ? "PASS" : "FAIL") : "INVALID"}` : ""}`);
  return updated;
}
