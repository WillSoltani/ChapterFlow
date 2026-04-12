/**
 * Quiz Question Quality Scorer
 *
 * Scores generated quiz questions on three dimensions:
 *   1. Distractor quality (embedding-based cosine distance)
 *   2. Bloom's level verification (declared vs. actual)
 *   3. Readability (Flesch-Kincaid grade level)
 *
 * Usage:
 *   npx tsx scripts/book/quiz-quality-scorer.ts <chapter-quiz.json> [--threshold 0.60]
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve, basename } from "path";

// ── Types ────────────────────────────────────────────────────────────────────

type ToneKeyed = { gentle: string; direct: string; competitive: string };

type QuizQuestion = {
  questionId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  correctAnswerIndex?: number;
  explanation?: string | ToneKeyed;
  bloomsLevel?: string;
  depthLevel?: string;
};

type QuizFile = {
  passingScorePercent: number;
  questions: QuizQuestion[];
};

type QuestionScore = {
  questionId: string;
  distractorScore: number;
  bloomsScore: number;
  readabilityScore: number;
  compositeScore: number;
  passed: boolean;
  issues: string[];
};

type QualityReport = {
  filePath: string;
  threshold: number;
  questionCount: number;
  passedCount: number;
  failedCount: number;
  overallScore: number;
  passed: boolean;
  questions: QuestionScore[];
};

// ── Readability (Flesch-Kincaid) ─────────────────────────────────────────────

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;

  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;

  for (const char of w) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  if (w.endsWith("e") && count > 1) count--;
  if (w.endsWith("le") && w.length > 2 && !vowels.includes(w[w.length - 3])) count++;

  return Math.max(1, count);
}

function fleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.replace(/[^a-z]/gi, "").length > 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;

  return 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
}

function scoreReadability(grade: number): number {
  // Target: grade 8-10 per master prompt readability mandate
  if (grade >= 8 && grade <= 10) return 1.0;
  if (grade >= 6 && grade < 8) return 0.8;
  if (grade > 10 && grade <= 12) return 0.7;
  if (grade > 12 && grade <= 14) return 0.5;
  if (grade < 6) return 0.6;
  return 0.3;
}

// ── Distractor Quality (heuristic without embeddings) ────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function scoreDistractors(question: QuizQuestion): { score: number; issues: string[] } {
  const issues: string[] = [];
  const correctIdx = question.correctIndex ?? question.correctAnswerIndex ?? 0;
  const choices = question.choices;

  if (choices.length < 2) {
    return { score: 0, issues: ["Fewer than 2 choices"] };
  }

  if (correctIdx < 0 || correctIdx >= choices.length) {
    return { score: 0, issues: [`correctIndex ${correctIdx} is out of bounds for ${choices.length} choices`] };
  }

  const correctTokens = tokenize(choices[correctIdx]);
  const distractorTokens = choices
    .filter((_, i) => i !== correctIdx)
    .map((c) => tokenize(c));

  // Check distractor-to-distractor similarity (should not all be synonymous)
  const pairSimilarities: number[] = [];
  for (let i = 0; i < distractorTokens.length; i++) {
    for (let j = i + 1; j < distractorTokens.length; j++) {
      pairSimilarities.push(jaccardSimilarity(distractorTokens[i], distractorTokens[j]));
    }
  }

  const avgPairSim =
    pairSimilarities.length > 0
      ? pairSimilarities.reduce((a, b) => a + b, 0) / pairSimilarities.length
      : 0;

  if (avgPairSim > 0.7) {
    issues.push(`Distractors are too similar to each other (avg Jaccard: ${avgPairSim.toFixed(2)})`);
  }

  // Check correct-to-distractor similarity (should be moderate — plausible but wrong)
  const correctSimilarities = distractorTokens.map((dt) =>
    jaccardSimilarity(correctTokens, dt)
  );
  const avgCorrectSim =
    correctSimilarities.length > 0
      ? correctSimilarities.reduce((a, b) => a + b, 0) / correctSimilarities.length
      : 0;

  if (avgCorrectSim > 0.85) {
    issues.push(
      `Distractors too similar to correct answer (avg: ${avgCorrectSim.toFixed(2)}) — question may be trivially easy or confusing`
    );
  }

  if (avgCorrectSim < 0.05) {
    issues.push(
      `Distractors completely unrelated to correct answer (avg: ${avgCorrectSim.toFixed(2)}) — too easy to guess`
    );
  }

  // Check choice length variance (big length differences make the correct answer guessable)
  const lengths = choices.map((c) => c.length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const lengthVariance =
    lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length;
  const coeffOfVariation = Math.sqrt(lengthVariance) / Math.max(avgLen, 1);

  if (coeffOfVariation > 0.6) {
    issues.push(
      `Choice lengths vary significantly (CV: ${coeffOfVariation.toFixed(2)}) — correct answer may be guessable by length`
    );
  }

  // Composite distractor score
  let score = 1.0;
  if (avgPairSim > 0.7) score -= 0.3;
  if (avgCorrectSim > 0.85) score -= 0.25;
  if (avgCorrectSim < 0.05) score -= 0.25;
  if (coeffOfVariation > 0.6) score -= 0.15;

  return { score: Math.max(0, Math.min(1, score)), issues };
}

// ── Bloom's Level Verification ───────────────────────────────────────────────

const BLOOMS_HIERARCHY: Record<string, number> = {
  remember: 1,
  understand: 2,
  "remember-understand": 1.5,
  apply: 3,
  analyze: 4,
  "apply-analyze": 3.5,
  evaluate: 5,
  create: 6,
  "evaluate-create": 5.5,
};

const RECALL_INDICATORS = [
  /^what is/i,
  /^what are/i,
  /^which of the following/i,
  /^what does .+ mean/i,
  /^the term .+ refers to/i,
  /^what is the name/i,
  /^which .+ is defined as/i,
  /^according to the chapter/i,
];

const APPLICATION_INDICATORS = [
  /\b(scenario|situation|case|context|example)\b/i,
  /\b(how would|what would|what should)\b/i,
  /\b(applying|implement|use|respond)\b/i,
  /a colleague|a friend|a team|a manager|a student/i,
];

const EVALUATION_INDICATORS = [
  /\b(evaluate|assess|judge|critique|compare|contrast|justify)\b/i,
  /\b(most effective|least likely|strongest|weakest)\b/i,
  /\b(why does|why would|what explains)\b/i,
  /\b(across chapters|connects to|builds on)\b/i,
];

function inferBloomsLevel(prompt: string): string {
  const evalScore = EVALUATION_INDICATORS.filter((r) => r.test(prompt)).length;
  const applyScore = APPLICATION_INDICATORS.filter((r) => r.test(prompt)).length;
  const recallScore = RECALL_INDICATORS.filter((r) => r.test(prompt)).length;

  if (evalScore >= 2) return "evaluate-create";
  if (applyScore >= 2) return "apply-analyze";
  if (recallScore >= 2) return "remember-understand";

  if (evalScore > applyScore && evalScore > recallScore) return "evaluate-create";
  if (applyScore > recallScore) return "apply-analyze";
  if (recallScore > 0) return "remember-understand";

  return "apply-analyze";
}

function scoreBloomsAlignment(question: QuizQuestion): { score: number; issues: string[] } {
  const issues: string[] = [];
  const declared = question.bloomsLevel?.toLowerCase() ?? "";
  const inferred = inferBloomsLevel(question.prompt);

  if (!declared) {
    return { score: 0.5, issues: ["No bloomsLevel declared"] };
  }

  const declaredRank = BLOOMS_HIERARCHY[declared] ?? 3;
  const inferredRank = BLOOMS_HIERARCHY[inferred] ?? 3;
  const gap = Math.abs(declaredRank - inferredRank);

  if (gap <= 0.5) {
    return { score: 1.0, issues };
  }

  if (gap <= 1.5) {
    issues.push(`Bloom's level mismatch: declared "${declared}" but inferred "${inferred}" (gap: ${gap})`);
    return { score: 0.7, issues };
  }

  issues.push(
    `Significant Bloom's mismatch: declared "${declared}" but inferred "${inferred}" (gap: ${gap})`
  );
  return { score: 0.3, issues };
}

// ── Composite Scorer ─────────────────────────────────────────────────────────

const WEIGHTS = {
  distractor: 0.4,
  blooms: 0.35,
  readability: 0.25,
};

function scoreQuestion(question: QuizQuestion, threshold: number): QuestionScore {
  const { score: distractorScore, issues: distractorIssues } = scoreDistractors(question);
  const { score: bloomsScore, issues: bloomsIssues } = scoreBloomsAlignment(question);
  const grade = fleschKincaidGrade(question.prompt);
  const readabilityScore = scoreReadability(grade);

  const readabilityIssues: string[] = [];
  if (grade < 6 || grade > 14) {
    readabilityIssues.push(`Readability grade ${grade.toFixed(1)} outside target range 8-10`);
  }

  const compositeScore =
    WEIGHTS.distractor * distractorScore +
    WEIGHTS.blooms * bloomsScore +
    WEIGHTS.readability * readabilityScore;

  return {
    questionId: question.questionId,
    distractorScore: Math.round(distractorScore * 100) / 100,
    bloomsScore: Math.round(bloomsScore * 100) / 100,
    readabilityScore: Math.round(readabilityScore * 100) / 100,
    compositeScore: Math.round(compositeScore * 100) / 100,
    passed: compositeScore >= threshold,
    issues: [...distractorIssues, ...bloomsIssues, ...readabilityIssues],
  };
}

function scoreQuiz(filePath: string, threshold: number): QualityReport {
  const raw = readFileSync(filePath, "utf-8");
  const quiz: QuizFile = JSON.parse(raw);
  const questions = quiz.questions.map((q) => scoreQuestion(q, threshold));
  const passedCount = questions.filter((q) => q.passed).length;
  const overallScore =
    questions.length > 0
      ? Math.round(
          (questions.reduce((sum, q) => sum + q.compositeScore, 0) / questions.length) * 100
        ) / 100
      : 0;

  return {
    filePath,
    threshold,
    questionCount: questions.length,
    passedCount,
    failedCount: questions.length - passedCount,
    overallScore,
    passed: passedCount === questions.length,
    questions,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const filePaths: string[] = [];
  let threshold = 0.6;
  let outputDir: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--threshold" && args[i + 1]) {
      threshold = parseFloat(args[++i]);
    } else if (args[i] === "--output-dir" && args[i + 1]) {
      outputDir = args[++i];
    } else {
      filePaths.push(args[i]);
    }
  }

  if (filePaths.length === 0) {
    console.error("Usage: npx tsx scripts/book/quiz-quality-scorer.ts <quiz.json> [--threshold 0.60] [--output-dir <dir>]");
    process.exit(1);
  }

  let allPassed = true;

  for (const fp of filePaths) {
    const resolved = resolve(fp);
    const report = scoreQuiz(resolved, threshold);

    if (!report.passed) allPassed = false;

    console.log(`\n── ${basename(resolved)} ──`);
    console.log(`  Overall: ${report.overallScore} | Passed: ${report.passedCount}/${report.questionCount} | Threshold: ${threshold}`);

    for (const q of report.questions) {
      const status = q.passed ? "✓" : "✗";
      console.log(
        `  ${status} ${q.questionId}: ${q.compositeScore} (dist=${q.distractorScore} bloom=${q.bloomsScore} read=${q.readabilityScore})`
      );
      for (const issue of q.issues) {
        console.log(`      → ${issue}`);
      }
    }

    if (outputDir) {
      mkdirSync(outputDir, { recursive: true });
      const outPath = resolve(outputDir, basename(resolved).replace(".quiz.json", ".quality.json"));
      writeFileSync(outPath, JSON.stringify(report, null, 2));
      console.log(`  Report written to: ${outPath}`);
    }
  }

  process.exit(allPassed ? 0 : 1);
}

main();
