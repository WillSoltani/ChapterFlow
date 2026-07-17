/**
 * assemble-audit-package — build a temporary, rubric-audit-ready package from
 * the CURRENT canonical chapter state of an UNPUBLISHED book so its chapters can
 * be scored by the D7 rubric instrument (rubric-audit-batch --package) before
 * they ever reach the production library.
 *
 * This is READ-ONLY over canonical state: it reuses the exact loader promotion
 * uses (loadCanonicalChapterFiles) and the exact reader-facing transform publish
 * ships (stripInternalFields), then re-wraps the result in the minimal
 * `{ book: { id, slug }, chapters: [...] }` shape buildRubricAuditBatch consumes.
 * It never touches the publish flow and never writes canonical state — the only
 * output is the caller-named temp package path.
 *
 * Fail-closed: a book with no discoverable chapters, or ANY chapter whose quiz
 * is missing an answer key or an explanation, is refused. The rubric audit
 * scores what a reader is graded against; a key-stripped chapter is exactly the
 * artifact the instrument exists to keep out of an audit.
 */

import { readdirSync } from "node:fs";

import type { AuditChapter } from "./migration/rubricAuditInstrument.js";
import { CHAPTERS_DIR, chapterIdFromFileName, isSiblingFile, normSlug, parseChapterId } from "../lib/chapterPaths.js";
import { formatChapterSetBlockers, loadCanonicalChapterFiles } from "../lib/chapterSet.js";
import { stripInternalFields } from "../lib/readerContent.js";
import type { ChapterSpec } from "../generateChapter.js";
import type { ChapterV21, ExampleV21, QuizV21, ReviewCardV21 } from "../types.js";

export class AuditPackageAssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditPackageAssemblyError";
  }
}

export type AssembledAuditPackage = {
  book: { id: string; slug: string; title: string };
  chapters: AuditChapter[];
};

/** Discover the canonical chapter files for a book (sibling-file convention),
 *  ordered by chapter number. Read-only directory scan — no index required, so
 *  a book still mid-authoring (before its production index exists) can be
 *  audited straight from state. */
function discoverChapterSpecs(bookId: string, chaptersDir: string): ChapterSpec[] {
  let entries: string[];
  try {
    entries = readdirSync(chaptersDir);
  } catch (error) {
    throw new AuditPackageAssemblyError(
      `cannot read the canonical chapter directory ${chaptersDir}: ${(error as Error).message}`);
  }
  const specs: ChapterSpec[] = [];
  for (const fileName of entries) {
    if (!isSiblingFile(fileName, bookId)) continue;
    const chapterId = chapterIdFromFileName(fileName);
    const parsed = parseChapterId(chapterId);
    if (parsed === null) continue;
    // chapterTitle is unused by the safe loader (it keys on id + number); the
    // real reader-facing title comes off the loaded ChapterV21 below.
    specs.push({ chapterId, chapterNumber: parsed.num, chapterTitle: "" });
  }
  specs.sort((a, b) => a.chapterNumber - b.chapterNumber);
  return specs;
}

function requireField(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AuditPackageAssemblyError(message);
  }
  return value;
}

/** Map a reader-facing ChapterV21 onto the AuditChapter subset the rubric
 *  renderer reads, failing closed on any missing quiz key or explanation (the
 *  core content-integrity gate for an audit input). */
function toAuditChapter(chapter: ChapterV21, bookId: string): AuditChapter {
  const where = `${bookId} chapter ${String((chapter as { number?: unknown }).number ?? "?")}`;
  if (typeof chapter.number !== "number" || !Number.isFinite(chapter.number)) {
    throw new AuditPackageAssemblyError(`${where}: chapter.number is missing or not a number`);
  }
  requireField(chapter.title, `${where}: chapter.title is missing`);
  requireField(chapter.hook, `${where}: chapter.hook is missing`);
  requireField(chapter.keyTakeaway, `${where}: chapter.keyTakeaway is missing`);
  const breakdown = chapter.breakdown ?? ({} as ChapterV21["breakdown"]);
  requireField(breakdown.fastRead, `${where}: breakdown.fastRead is missing`);
  requireField(breakdown.deepRead, `${where}: breakdown.deepRead is missing`);
  requireField(breakdown.fullRead, `${where}: breakdown.fullRead is missing`);

  const examples = Array.isArray(chapter.examples) ? chapter.examples : [];
  const quizQuestions = Array.isArray(chapter.quiz?.questions) ? chapter.quiz.questions : [];
  if (quizQuestions.length === 0) {
    throw new AuditPackageAssemblyError(`${where}: quiz has no questions`);
  }
  quizQuestions.forEach((question: QuizV21["questions"][number], index: number) => {
    const choices = Array.isArray(question.choices) ? question.choices : [];
    if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= choices.length) {
      throw new AuditPackageAssemblyError(
        `${where}: quiz question ${index + 1} is missing a valid answer key (correctIndex)`);
    }
    if (typeof question.explanation !== "string" || question.explanation.trim().length === 0) {
      throw new AuditPackageAssemblyError(
        `${where}: quiz question ${index + 1} is missing its answer explanation`);
    }
  });

  const plan = chapter.implementationPlan ?? ({} as ChapterV21["implementationPlan"]);
  const ifThenPlans = Array.isArray(plan.ifThenPlans) ? plan.ifThenPlans : [];
  const memorableLines = Array.isArray(chapter.memorableLines) ? chapter.memorableLines : [];

  return {
    number: chapter.number,
    title: chapter.title,
    hook: chapter.hook,
    counterintuition: chapter.counterintuition ?? "",
    tryThisNow: chapter.tryThisNow ?? "",
    keyTakeaway: chapter.keyTakeaway,
    breakdown: { fastRead: breakdown.fastRead, deepRead: breakdown.deepRead, fullRead: breakdown.fullRead },
    examples: examples.map((example: ExampleV21) => ({
      title: example.title,
      scenario: example.scenario,
      whatToDo: example.whatToDo,
      whyItMatters: example.whyItMatters,
    })),
    quiz: {
      questions: quizQuestions.map((question: QuizV21["questions"][number]) => ({
        prompt: question.prompt,
        choices: question.choices,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        ...(Array.isArray(question.choiceRationales) ? { choiceRationales: question.choiceRationales } : {}),
        ...(question.revisit ? { revisit: question.revisit } : {}),
        ...(typeof question.confidencePrompt === "string" ? { confidencePrompt: question.confidencePrompt } : {}),
      })),
    },
    reviewCards: (Array.isArray(chapter.reviewCards) ? chapter.reviewCards : []).map((card: ReviewCardV21) => ({
      front: card.front,
      back: card.back,
    })),
    implementationPlan: {
      coreSkill: requireField(plan.coreSkill, `${where}: implementationPlan.coreSkill is missing`),
      ifThenPlans: ifThenPlans.map((entry) => ({ context: entry.context, plan: entry.plan })),
      twentyFourHourChallenge: requireField(
        plan.twentyFourHourChallenge, `${where}: implementationPlan.twentyFourHourChallenge is missing`),
      weeklyPractice: requireField(plan.weeklyPractice, `${where}: implementationPlan.weeklyPractice is missing`),
    },
    memorableLines: memorableLines.map((line) => ({ text: line.text })),
  };
}

/** Build the temporary audit package for `bookId` from canonical chapter state.
 *  Pure + read-only; throws AuditPackageAssemblyError fail-closed. */
export function assembleAuditPackage(args: {
  bookId: string;
  chaptersDir?: string;
}): AssembledAuditPackage {
  const bookId = normSlug(args.bookId);
  const chaptersDir = args.chaptersDir ?? CHAPTERS_DIR;
  const specs = discoverChapterSpecs(bookId, chaptersDir);
  if (specs.length === 0) {
    throw new AuditPackageAssemblyError(
      `no canonical chapters found for '${bookId}' in ${chaptersDir} — nothing to audit`);
  }
  const loaded = loadCanonicalChapterFiles(specs, chaptersDir);
  if (!loaded.ok) {
    throw new AuditPackageAssemblyError(
      `canonical chapter set is not loadable: ${formatChapterSetBlockers(loaded.blockers)}`);
  }
  const chapters = loaded.chapters
    .map((chapter) => stripInternalFields(chapter))
    .map((chapter) => toAuditChapter(chapter, bookId));
  return {
    book: { id: bookId, slug: bookId, title: bookId },
    chapters,
  };
}

/** assembleAuditPackage-EQUIVALENT over an IN-MEMORY chapter set (WP-702). The
 *  model bake-off holds each candidate's authored chapters in memory (loaded from
 *  its isolated generation slot, never canonical state), so the D7 judge assembles
 *  the app-faithful audit package straight from those objects — through the EXACT
 *  same reader-facing transform (stripInternalFields) and the EXACT same
 *  fail-closed integrity gate (toAuditChapter: refuse any chapter missing a quiz
 *  answer key or an explanation). A candidate whose chapters cannot assemble is
 *  INELIGIBLE by the caller — keys are never synthesized and the read is never
 *  downgraded to a codex model score. */
export function assembleAuditPackageFromChapters(args: {
  bookId: string;
  chapters: ChapterV21[];
}): AssembledAuditPackage {
  const bookId = normSlug(args.bookId);
  if (!Array.isArray(args.chapters) || args.chapters.length === 0) {
    throw new AuditPackageAssemblyError(
      `no chapters supplied for '${bookId}' — nothing to audit`);
  }
  const chapters = [...args.chapters]
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    .map((chapter) => stripInternalFields(chapter))
    .map((chapter) => toAuditChapter(chapter, bookId));
  return {
    book: { id: bookId, slug: bookId, title: bookId },
    chapters,
  };
}
