import type {
  BookUserProgress,
  BookUserQuizStateItem,
  ChapterQuizPayload,
  QuizAttemptItem,
} from "./types";

export type QuizSessionChoice = {
  choiceId: string;
  text: string;
  canonicalIndex: number;
};

export type QuizSessionQuestion = {
  questionId: string;
  prompt: string;
  explanation?: string;
  choices: QuizSessionChoice[];
  correctChoiceId: string;
  correctIndex: number;
};

export type QuizSessionReviewQuestion = {
  questionId: string;
  prompt: string;
  choices: Array<{
    choiceId: string;
    text: string;
  }>;
  explanation?: string;
  selectedChoiceId?: string | null;
  correctChoiceId?: string;
  correctIndex?: number;
  isCorrect?: boolean;
};

export type QuizSessionAttemptSummary = {
  attemptNumber: number;
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  submittedAt: string;
};

export type QuizClientSession = {
  chapterId: string;
  chapterNumber: number;
  title: string;
  passingScorePercent: number;
  status: "ready" | "cooldown" | "passed";
  attemptNumber: number;
  nextAttemptNumber: number | null;
  attemptsCount: number;
  failureStreak: number;
  cooldownSeconds: number;
  nextAttemptAvailableAt: string | null;
  highestScorePercent: number;
  unlockedNextChapter: boolean;
  latestAttemptAt?: string;
  questions: QuizSessionReviewQuestion[];
  result: QuizSessionAttemptSummary | null;
  history: QuizSessionAttemptSummary[];
};

const BASE_COOLDOWN_SECONDS = 60;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function shuffle<T>(values: T[], rand: () => number): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rand() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }
  return copy;
}

function rotateChoices(choices: string[], by: number): string[] {
  if (choices.length === 0) return [];
  const shift = ((by % choices.length) + choices.length) % choices.length;
  if (shift === 0) return choices;
  return choices.map((_, index) => choices[(index + shift) % choices.length]);
}

function dedupeQuestionsById(
  questions: ChapterQuizPayload["questions"]
): ChapterQuizPayload["questions"] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    if (seen.has(question.questionId)) return false;
    seen.add(question.questionId);
    return true;
  });
}

export function cooldownSecondsForFailureStreak(streak: number): number {
  if (streak <= 0) return 0;
  if (streak === 1) return BASE_COOLDOWN_SECONDS;
  if (streak === 2) return BASE_COOLDOWN_SECONDS * 2;
  return BASE_COOLDOWN_SECONDS * 3;
}

export function remainingCooldownSeconds(nextAttemptAvailableAt?: string | null): number {
  if (!nextAttemptAvailableAt) return 0;
  const deltaMs = new Date(nextAttemptAvailableAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(deltaMs / 1000));
}

export function buildRetryPool(
  quiz: ChapterQuizPayload
): ChapterQuizPayload["questions"] {
  const authored = Array.isArray(quiz.retryQuestions) ? quiz.retryQuestions : [];
  const generated = quiz.questions.map((question, index) => {
    const correctChoice = question.choices[question.correctAnswerIndex];
    const distractors = question.choices.filter(
      (_, choiceIndex) => choiceIndex !== question.correctAnswerIndex
    );
    const paddedDistractors = [...distractors];
    while (paddedDistractors.length < 3) {
      paddedDistractors.push("An unrelated claim that misses the core concept.");
    }
    const baseChoices = [correctChoice, ...paddedDistractors.slice(0, 3)];
    const rotated = rotateChoices(baseChoices, (quiz.number + index) % 4);
    const rotatedCorrectIndex = rotated.findIndex((choice) => choice === correctChoice);
    return {
      questionId: `${question.questionId}-retry-${String(index + 1).padStart(2, "0")}`,
      prompt: question.prompt,
      choices: rotated,
      correctAnswerIndex: rotatedCorrectIndex >= 0 ? rotatedCorrectIndex : 0,
      explanation: question.explanation,
    };
  });
  return dedupeQuestionsById([...authored, ...generated]).slice(
    0,
    Math.max(quiz.questions.length, 5)
  );
}

export function buildQuizAttemptQuestions(params: {
  quiz: ChapterQuizPayload;
  userId: string;
  bookId: string;
  chapterNumber: number;
  attemptNumber: number;
}): QuizSessionQuestion[] {
  const { quiz, userId, bookId, chapterNumber, attemptNumber } = params;
  const baseQuestions = quiz.questions;
  const retryPool = buildRetryPool(quiz);
  const targetCount = baseQuestions.length;
  const seed = hashString(
    `${userId}:${bookId}:${chapterNumber}:${Math.max(1, attemptNumber)}`
  );
  const rand = seededRandom(seed);
  const retrySwapCount =
    attemptNumber <= 1
      ? 0
      : Math.min(retryPool.length, Math.min(targetCount - 1, attemptNumber));
  const baseKeepCount = Math.max(0, targetCount - retrySwapCount);
  const selectedBase = shuffle(baseQuestions, rand).slice(0, baseKeepCount);
  const selectedRetry = shuffle(retryPool, rand).slice(0, retrySwapCount);
  const chosen = shuffle([...selectedBase, ...selectedRetry], rand).slice(0, targetCount);

  return chosen.map((question) => {
    const orderedChoices = shuffle(
      question.choices.map((text, canonicalIndex) => ({
        text,
        canonicalIndex,
      })),
      rand
    );
    const choices = orderedChoices.map((choice) => ({
      choiceId: `${question.questionId}::choice::${choice.canonicalIndex}`,
      text: choice.text,
      canonicalIndex: choice.canonicalIndex,
    }));
    const correctIndex = choices.findIndex(
      (choice) => choice.canonicalIndex === question.correctAnswerIndex
    );
    const correctChoiceId =
      choices[correctIndex]?.choiceId ??
      `${question.questionId}::choice::${question.correctAnswerIndex}`;
    return {
      questionId: question.questionId,
      prompt: question.prompt,
      explanation: question.explanation,
      choices,
      correctChoiceId,
      correctIndex: Math.max(0, correctIndex),
    };
  });
}

export function gradeQuizAttemptQuestions(
  questions: QuizSessionQuestion[],
  responses: Array<{
    questionId: string;
    selectedChoiceId?: string | null;
    selectedIndex?: number | null;
  }>,
  passingScorePercent: number
): {
  total: number;
  correct: number;
  scorePercent: number;
  passed: boolean;
  questionResults: QuizAttemptItem["questionResults"];
} {
  const byId = new Map(questions.map((question) => [question.questionId, question]));
  const seen = new Set<string>();
  const questionResults: QuizAttemptItem["questionResults"] = [];
  let correct = 0;

  for (const [index, response] of responses.entries()) {
    const questionId = response.questionId?.trim();
    if (!questionId) {
      throw new Error(`responses[${index}].questionId is required.`);
    }
    if (seen.has(questionId)) {
      throw new Error(`responses contains duplicate questionId ${questionId}.`);
    }
    seen.add(questionId);
    const question = byId.get(questionId);
    if (!question) {
      throw new Error(`Unknown questionId ${questionId}.`);
    }
    let selectedChoiceId = response.selectedChoiceId ?? null;
    const selectedIndex =
      typeof response.selectedIndex === "number" ? Math.floor(response.selectedIndex) : null;
    if (!selectedChoiceId && typeof selectedIndex === "number") {
      selectedChoiceId = question.choices[selectedIndex]?.choiceId ?? null;
    }
    if (!selectedChoiceId) {
      throw new Error(`responses[${index}] is missing a selected answer.`);
    }
    const resolvedIndex = question.choices.findIndex(
      (choice) => choice.choiceId === selectedChoiceId
    );
    if (resolvedIndex < 0) {
      throw new Error(`responses[${index}] has an invalid answer for ${questionId}.`);
    }
    const isCorrect = question.correctChoiceId === selectedChoiceId;
    if (isCorrect) correct += 1;
    questionResults.push({
      questionId,
      selectedChoiceId,
      selectedIndex: resolvedIndex,
      correctChoiceId: question.correctChoiceId,
      correctIndex: question.correctIndex,
      isCorrect,
    });
  }

  if (questionResults.length !== questions.length) {
    throw new Error(`responses must include exactly ${questions.length} answers.`);
  }

  const total = questions.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  return {
    total,
    correct,
    scorePercent,
    passed: scorePercent >= passingScorePercent,
    questionResults,
  };
}

export function buildProgressAfterQuizPass(
  progress: BookUserProgress,
  params: { chapterNumber: number; scorePercent: number }
): BookUserProgress {
  const completed = new Set(progress.completedChapters);
  completed.add(params.chapterNumber);
  const bestScoreByChapter = {
    ...progress.bestScoreByChapter,
    [String(params.chapterNumber)]: Math.max(
      params.scorePercent,
      progress.bestScoreByChapter[String(params.chapterNumber)] || 0
    ),
  };
  const updatedAt = new Date().toISOString();
  return {
    ...progress,
    currentChapterNumber: Math.max(
      progress.currentChapterNumber,
      params.chapterNumber + 1
    ),
    unlockedThroughChapterNumber: Math.max(
      progress.unlockedThroughChapterNumber,
      params.chapterNumber + 1
    ),
    completedChapters: Array.from(completed).sort((left, right) => left - right),
    bestScoreByChapter,
    lastActiveAt: updatedAt,
    lastOpenedAt: updatedAt,
    updatedAt,
  };
}

export function buildQuizStateFromAttempts(params: {
  userId: string;
  bookId: string;
  chapterNumber: number;
  chapterId?: string;
  attempts: QuizAttemptItem[];
}): BookUserQuizStateItem | null {
  const attemptsAsc = [...params.attempts].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
  if (attemptsAsc.length === 0) return null;
  const latest = attemptsAsc[attemptsAsc.length - 1];
  const passedAttempt = [...attemptsAsc].reverse().find((attempt) => attempt.passed);
  let failureStreak = 0;
  for (let index = attemptsAsc.length - 1; index >= 0; index -= 1) {
    if (attemptsAsc[index].passed) break;
    failureStreak += 1;
  }
  return {
    userId: params.userId,
    bookId: params.bookId,
    chapterNumber: params.chapterNumber,
    chapterId: params.chapterId ?? latest.chapterId,
    quizId: latest.quizId || `${params.bookId}:${params.chapterNumber}`,
    attemptsCount: attemptsAsc.length,
    failureStreak: latest.passed ? 0 : failureStreak,
    passed: Boolean(passedAttempt),
    highestScorePercent: Math.max(
      0,
      ...attemptsAsc.map((attempt) => attempt.scorePercent)
    ),
    lastScorePercent: latest.scorePercent,
    lastCorrectCount: latest.correctCount,
    lastTotalQuestions: latest.totalQuestions,
    lastAttemptAt: latest.createdAt,
    lastAttemptNumber: latest.attemptNumber || attemptsAsc.length,
    nextEligibleAttemptAt: latest.passed
      ? null
      : latest.nextEligibleAttemptAt ??
        new Date(
          new Date(latest.createdAt).getTime() +
            cooldownSecondsForFailureStreak(failureStreak) * 1000
        ).toISOString(),
    passedAt: passedAttempt?.createdAt,
    unlockedNextChapter: Boolean(passedAttempt?.unlockedNextChapter),
    createdAt: attemptsAsc[0].createdAt,
    updatedAt: latest.updatedAt || latest.createdAt,
  };
}

export function buildQuizClientSession(params: {
  quiz: ChapterQuizPayload;
  userId: string;
  bookId: string;
  chapterNumber: number;
  quizState: BookUserQuizStateItem | null;
  latestAttempt: QuizAttemptItem | null;
  history: QuizAttemptItem[];
  passingScorePercent?: number;
}): QuizClientSession {
  const passingScorePercent = Math.max(
    80,
    params.passingScorePercent ?? params.quiz.passingScorePercent ?? 80
  );
  const attemptsCount = Math.max(0, params.quizState?.attemptsCount ?? 0);
  const failureStreak = Math.max(0, params.quizState?.failureStreak ?? 0);
  const cooldownSeconds = remainingCooldownSeconds(
    params.quizState?.nextEligibleAttemptAt ?? null
  );
  const latestAttempt = params.latestAttempt;
  const passed = params.quizState?.passed === true;
  const nextAttemptNumber = passed ? null : attemptsCount + 1;
  const status: QuizClientSession["status"] = passed
    ? "passed"
    : cooldownSeconds > 0 && latestAttempt
      ? "cooldown"
      : "ready";
  const viewAttemptNumber =
    status === "ready"
      ? Math.max(1, nextAttemptNumber ?? 1)
      : latestAttempt?.attemptNumber || Math.max(1, attemptsCount);
  const baseQuestions = buildQuizAttemptQuestions({
    quiz: {
      ...params.quiz,
      passingScorePercent,
    },
    userId: params.userId,
    bookId: params.bookId,
    chapterNumber: params.chapterNumber,
    attemptNumber: viewAttemptNumber,
  });
  const resultsByQuestionId = new Map(
    (latestAttempt?.questionResults ?? []).map((result) => [result.questionId, result])
  );

  return {
    chapterId: params.quiz.chapterId,
    chapterNumber: params.quiz.number,
    title: params.quiz.title,
    passingScorePercent,
    status,
    attemptNumber: viewAttemptNumber,
    nextAttemptNumber,
    attemptsCount,
    failureStreak,
    cooldownSeconds,
    nextAttemptAvailableAt: params.quizState?.nextEligibleAttemptAt ?? null,
    highestScorePercent: Math.max(0, params.quizState?.highestScorePercent ?? 0),
    unlockedNextChapter: params.quizState?.unlockedNextChapter === true,
    latestAttemptAt: params.quizState?.lastAttemptAt,
    questions: baseQuestions.map((question) => {
      const result = resultsByQuestionId.get(question.questionId);
      return {
        questionId: question.questionId,
        prompt: question.prompt,
        choices: question.choices.map((choice) => ({
          choiceId: choice.choiceId,
          text: choice.text,
        })),
        explanation:
          status === "ready"
            ? undefined
            : question.explanation || "This option best reflects the chapter's main point.",
        selectedChoiceId: status === "ready" ? null : result?.selectedChoiceId ?? null,
        correctChoiceId: status === "ready" ? undefined : question.correctChoiceId,
        correctIndex: status === "ready" ? undefined : question.correctIndex,
        isCorrect: status === "ready" ? undefined : result?.isCorrect === true,
      };
    }),
    result:
      latestAttempt && status !== "ready"
        ? {
            attemptNumber: latestAttempt.attemptNumber || attemptsCount,
            scorePercent: latestAttempt.scorePercent,
            correctAnswers: latestAttempt.correctCount,
            totalQuestions: latestAttempt.totalQuestions,
            passed: latestAttempt.passed,
            submittedAt: latestAttempt.createdAt,
          }
        : null,
    history: params.history.map((attempt, index) => ({
      attemptNumber: attempt.attemptNumber || params.history.length - index,
      scorePercent: attempt.scorePercent,
      correctAnswers: attempt.correctCount,
      totalQuestions: attempt.totalQuestions,
      passed: attempt.passed,
      submittedAt: attempt.createdAt,
    })),
  };
}
