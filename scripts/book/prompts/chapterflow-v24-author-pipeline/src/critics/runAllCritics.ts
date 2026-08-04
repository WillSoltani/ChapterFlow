/**
 * runAllCritics — orchestrates every deterministic critic over a BookPackage
 * and emits a BookCriticReport. Model-backed critics (e.g.
 * pedagogy.example_exercises_core_move) are stubbed here; they'll be wired in
 * Phase 2 when Claude-client integration lands.
 */

import {
  BookCriticReport,
  BookPackage,
  CriticCheckId,
  CriticFinding,
  Example,
  QuizQuestion,
  ReviewCard,
  UnitCriticResult,
  UnitLocation,
} from "../types.js";
import type { BookContentReader } from "../books/candidateTypes.js";
import {
  checkDecisionPoint,
  checkNamedProtagonist,
  checkSpecificScene,
} from "./narrative.js";
import {
  checkBannedPhrases,
  checkNoChapterNumberLiteral,
  checkNoMetaReference,
} from "./register.js";
import {
  checkCardTestsRetrieval,
  checkQuizTestsApplication,
} from "./pedagogy.js";
import {
  checkAnswerPositionBalance,
  checkEnumValidity,
  openCriticCandidateEntries,
} from "./schema.js";
import { allTones, iterateUnits, pickEvidence } from "./shared.js";

type ChecksApplied = Partial<Record<CriticCheckId, { pass: number; fail: number }>>;

function addCheck(acc: ChecksApplied, id: CriticCheckId, passed: boolean) {
  if (!acc[id]) acc[id] = { pass: 0, fail: 0 };
  if (passed) acc[id]!.pass += 1;
  else acc[id]!.fail += 1;
}

export function runAllCritics(
  pkg: BookPackage,
  bookFile: string,
): BookCriticReport {
  const unitResults: UnitCriticResult[] = [];
  const byCheck: ChecksApplied = {};

  // per-unit checks
  for (const ref of iterateUnits(pkg)) {
    const findings: CriticFinding[] = [];
    const applied = new Set<CriticCheckId>();

    const { location, primaryText, unit } = ref;

    // register checks apply to most unit types
    if (
      location.unitType === "breakdown" ||
      location.unitType === "quiz_question" ||
      location.unitType === "review_card" ||
      location.unitType === "key_takeaway" ||
      location.unitType === "example"
    ) {
      applied.add("register.no_chapter_number_literal");
      const textForChapterCheck =
        location.unitType === "example"
          ? exampleFullText(unit as Example)
          : primaryText;
      findings.push(...checkNoChapterNumberLiteral(textForChapterCheck));
    }

    if (
      location.unitType === "breakdown" ||
      location.unitType === "quiz_question" ||
      location.unitType === "review_card" ||
      location.unitType === "key_takeaway"
    ) {
      applied.add("register.no_meta_reference");
      findings.push(...checkNoMetaReference(primaryText));
    }

    // banned-phrase check on everything text-bearing
    {
      applied.add("register.no_banned_phrase");
      const text =
        location.unitType === "example"
          ? exampleFullText(unit as Example)
          : primaryText;
      const { findings: f } = checkBannedPhrases(text);
      findings.push(...f);
    }

    // narrative checks apply to examples only
    if (location.unitType === "example") {
      applied.add("narrative.named_protagonist");
      applied.add("narrative.specific_scene");
      applied.add("narrative.decision_point");
      findings.push(...checkNamedProtagonist(unit as Example));
      findings.push(...checkSpecificScene(unit as Example));
      findings.push(...checkDecisionPoint(unit as Example));
    }

    // pedagogy checks
    if (location.unitType === "quiz_question") {
      applied.add("pedagogy.quiz_tests_application");
      applied.add("schema.enum_validity");
      applied.add("schema.bloom_vocabulary");
      findings.push(...checkQuizTestsApplication(unit as QuizQuestion));
      findings.push(...checkEnumValidity(unit as QuizQuestion));
    }
    if (location.unitType === "review_card") {
      applied.add("pedagogy.card_tests_retrieval");
      findings.push(...checkCardTestsRetrieval(unit as ReviewCard));
    }

    const appliedCount = applied.size;
    const failedCheckIds = new Set(findings.map((f) => f.checkId));
    const passedCount = appliedCount - failedCheckIds.size;

    for (const id of applied) {
      addCheck(byCheck, id, !failedCheckIds.has(id));
    }

    unitResults.push({
      location,
      findings,
      passedCount,
      totalCount: appliedCount,
      passed: findings.every((f) => f.severity !== "blocker"),
    });
  }

  // chapter-level quiz distribution checks (one finding per chapter)
  for (const ch of pkg.chapters) {
    const quizFindings = checkAnswerPositionBalance(ch.quiz, ch.number);
    if (quizFindings.length > 0) {
      const loc: UnitLocation = {
        bookId: pkg.book.bookId,
        chapterNumber: ch.number,
        unitType: "quiz_question",
      };
      addCheck(byCheck, "schema.answer_position_balance", false);
      unitResults.push({
        location: loc,
        findings: quizFindings,
        passedCount: 0,
        totalCount: 1,
        passed: false,
      });
    } else if (ch.quiz?.questions && ch.quiz.questions.length >= 4) {
      addCheck(byCheck, "schema.answer_position_balance", true);
    }
  }

  const passedUnits = unitResults.filter((u) => u.passed).length;
  const failedUnits = unitResults.length - passedUnits;

  return {
    bookId: pkg.book.bookId,
    bookFile,
    generatedAt: new Date().toISOString(),
    chapterCount: pkg.chapters.length,
    unitCount: unitResults.length,
    unitResults,
    summary: {
      passedUnits,
      failedUnits,
      passRate: unitResults.length ? passedUnits / unitResults.length : 1,
      byCheck: byCheck as Record<CriticCheckId, { pass: number; fail: number }>,
    },
  };
}

export async function runAllCriticsFromCandidate(
  reader: BookContentReader,
  input: Readonly<{
    bookId: string;
    candidateId: string;
    manifestDigest: string;
    packageLogicalPath: string;
    generatedAt?: string;
  }>,
): Promise<BookCriticReport> {
  const opened = await openCriticCandidateEntries(reader, {
    ...input,
    logicalPaths: [input.packageLogicalPath],
  });
  const report = runAllCritics(opened.values[0] as BookPackage, input.packageLogicalPath);
  if (report.bookId !== input.bookId) throw new Error("CANDIDATE_MISMATCH: critic package bookId differs");
  return input.generatedAt ? { ...report, generatedAt: input.generatedAt } : report;
}

function exampleFullText(ex: Example): string {
  const parts: string[] = [];
  parts.push(...allTones(ex.scenario));
  parts.push(...allTones(ex.whatToDo));
  parts.push(...allTones(ex.whyItMatters));
  if (ex.title) parts.push(ex.title);
  if (Array.isArray(ex.contexts)) parts.push(ex.contexts.join(" "));
  return parts.filter(Boolean).join(" \n ");
}
