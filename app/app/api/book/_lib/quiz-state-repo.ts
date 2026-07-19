// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  bookUserPk,
  quizAttemptPk,
  quizAttemptSk,
  quizScopeKey,
  quizStateSk,
} from "./keys";
import type {
  BookUserQuizStateItem,
  QuizAttemptItem,
} from "./types";
import {
  readNum,
  readStr,
} from "./repo-shared";

function parseQuizResponses(
  value: unknown
): QuizAttemptItem["responses"] {
  if (!Array.isArray(value)) return [];
  return value.reduce<QuizAttemptItem["responses"]>((entries, entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entries;
    const rec = entry as Record<string, unknown>;
    const questionId = readStr(rec.questionId);
    if (!questionId) return entries;
    const selectedChoiceId = readStr(rec.selectedChoiceId) ?? null;
    const selectedIndexRaw = readNum(rec.selectedIndex);
    entries.push({
      questionId,
      selectedChoiceId,
      selectedIndex:
        typeof selectedIndexRaw === "number" ? Math.floor(selectedIndexRaw) : null,
    });
    return entries;
  }, []);
}

function parseQuizQuestionResults(
  value: unknown
): QuizAttemptItem["questionResults"] {
  if (!Array.isArray(value)) return [];
  return value.reduce<QuizAttemptItem["questionResults"]>((entries, entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entries;
    const rec = entry as Record<string, unknown>;
    const questionId = readStr(rec.questionId);
    const correctChoiceId = readStr(rec.correctChoiceId);
    const correctIndex = readNum(rec.correctIndex);
    if (!questionId || !correctChoiceId || typeof correctIndex !== "number") return entries;
    const selectedIndexRaw = readNum(rec.selectedIndex);
    entries.push({
      questionId,
      selectedChoiceId: readStr(rec.selectedChoiceId) ?? null,
      selectedIndex:
        typeof selectedIndexRaw === "number" ? Math.floor(selectedIndexRaw) : null,
      correctChoiceId,
      correctIndex: Math.floor(correctIndex),
      isCorrect: rec.isCorrect === true,
    });
    return entries;
  }, []);
}

export async function writeQuizAttempt(tableName: string, attempt: QuizAttemptItem): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: quizAttemptPk(attempt.userId, attempt.bookId, attempt.chapterNumber),
        SK: quizAttemptSk(attempt.createdAt),
        entity: "BOOK_QUIZ_ATTEMPT",
        quizScope: quizScopeKey(attempt.bookId, attempt.chapterNumber),
        ...attempt,
      },
    })
  );
}

export async function getUserQuizState(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number
): Promise<BookUserQuizStateItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: quizStateSk(bookId, chapterNumber),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    bookId,
    chapterNumber,
    chapterId: readStr(item.chapterId),
    quizId: readStr(item.quizId) || `${bookId}:${chapterNumber}`,
    attemptsCount: Math.max(0, readNum(item.attemptsCount) ?? 0),
    failureStreak: Math.max(0, readNum(item.failureStreak) ?? 0),
    passed: item.passed === true,
    highestScorePercent: Math.max(0, readNum(item.highestScorePercent) ?? 0),
    lastScorePercent: Math.max(0, readNum(item.lastScorePercent) ?? 0),
    lastCorrectCount: Math.max(0, readNum(item.lastCorrectCount) ?? 0),
    lastTotalQuestions: Math.max(0, readNum(item.lastTotalQuestions) ?? 0),
    lastAttemptAt: readStr(item.lastAttemptAt),
    lastAttemptNumber: readNum(item.lastAttemptNumber),
    nextEligibleAttemptAt: readStr(item.nextEligibleAttemptAt) ?? null,
    passedAt: readStr(item.passedAt),
    unlockedNextChapter: item.unlockedNextChapter === true,
    loopPipelineCompletedAt: readStr(item.loopPipelineCompletedAt),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function putUserQuizState(
  tableName: string,
  state: BookUserQuizStateItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(state.userId),
        SK: quizStateSk(state.bookId, state.chapterNumber),
        entity: "BOOK_USER_QUIZ_STATE",
        ...state,
      },
    })
  );
}

export async function countRecentQuizAttempts(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
  sinceIso: string
): Promise<number> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK >= :since",
      ExpressionAttributeValues: {
        ":pk": quizAttemptPk(userId, bookId, chapterNumber),
        ":since": sinceIso,
      },
      Select: "COUNT",
    })
  );
  return res.Count ?? 0;
}

export async function listRecentQuizAttempts(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
  limit = 20
): Promise<QuizAttemptItem[]> {
  const cappedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": quizAttemptPk(userId, bookId, chapterNumber),
      },
      ScanIndexForward: false,
      Limit: cappedLimit,
    })
  );
  const attempts: QuizAttemptItem[] = [];
  for (const item of res.Items ?? []) {
    attempts.push({
      userId,
      bookId,
      chapterNumber,
      chapterId: readStr(item.chapterId),
      quizId: readStr(item.quizId) || `${bookId}:${chapterNumber}`,
      attemptNumber: Math.max(0, readNum(item.attemptNumber) ?? 0),
      passingScorePercent: Math.max(0, readNum(item.passingScorePercent) ?? 80),
      scorePercent: readNum(item.scorePercent) ?? 0,
      correctCount: Math.max(0, readNum(item.correctCount) ?? 0),
      totalQuestions: Math.max(0, readNum(item.totalQuestions) ?? 0),
      passed: item.passed === true,
      cooldownSeconds: Math.max(0, readNum(item.cooldownSeconds) ?? 0),
      nextEligibleAttemptAt: readStr(item.nextEligibleAttemptAt) ?? null,
      unlockedNextChapter: item.unlockedNextChapter === true,
      responses: parseQuizResponses(item.responses),
      questionResults: parseQuizQuestionResults(item.questionResults),
      timeSpentSeconds: readNum(item.timeSpentSeconds),
      createdAt: readStr(item.createdAt) || "",
      updatedAt: readStr(item.updatedAt) || readStr(item.createdAt) || "",
    });
  }
  return attempts;
}
