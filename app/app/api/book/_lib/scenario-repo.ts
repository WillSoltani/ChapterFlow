// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  approvedScenarioPk,
  approvedScenarioSk,
  bookUserPk,
  scenarioLookupPk,
  scenarioLookupSk,
  scenarioModerationPk,
  scenarioModerationSk,
  scenarioSubmissionSk,
} from "./keys";
import type {
  BookApprovedScenarioItem,
  BookScenarioLookupItem,
  BookScenarioModerationItem,
  BookUserScenarioSubmissionItem,
} from "./types";
import {
  readNum,
  readStr,
} from "./repo-shared";

function parseScenarioScope(value: unknown): "work" | "school" | "personal" {
  if (value === "work" || value === "school" || value === "personal") return value;
  return "personal";
}

export async function putUserScenarioSubmission(
  tableName: string,
  item: BookUserScenarioSubmissionItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(item.userId),
        SK: scenarioSubmissionSk(item.bookId, item.chapterNumber, item.submissionId),
        entity: "BOOK_USER_SCENARIO_SUBMISSION",
        ...item,
      },
    })
  );
}

export async function getUserScenarioSubmission(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
  submissionId: string
): Promise<BookUserScenarioSubmissionItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: scenarioSubmissionSk(bookId, chapterNumber, submissionId),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    submissionId,
    bookId,
    chapterNumber,
    chapterId: readStr(item.chapterId),
    title: readStr(item.title) || "",
    scenario: readStr(item.scenario) || "",
    whatToDo: readStr(item.whatToDo) || "",
    whyItMatters: readStr(item.whyItMatters) || "",
    scope: parseScenarioScope(item.scope),
    status:
      item.status === "approved"
        ? "approved"
        : item.status === "rejected"
          ? "rejected"
          : "pending",
    pointsAwarded: Math.max(0, readNum(item.pointsAwarded) ?? 0),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
    reviewedAt: readStr(item.reviewedAt),
    reviewedBy: readStr(item.reviewedBy),
    reviewNotes: readStr(item.reviewNotes),
  };
}

export async function listUserScenarioSubmissions(
  tableName: string,
  userId: string,
  opts?: { bookId?: string; chapterNumber?: number; limit?: number }
): Promise<BookUserScenarioSubmissionItem[]> {
  const prefix =
    opts?.bookId && typeof opts.chapterNumber === "number"
      ? `SCENARIO#${opts.bookId}#${String(Math.max(0, Math.floor(opts.chapterNumber))).padStart(4, "0")}#`
      : opts?.bookId
        ? `SCENARIO#${opts.bookId}#`
        : "SCENARIO#";
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": prefix,
      },
      ScanIndexForward: false,
      ...(opts?.limit
        ? { Limit: Math.max(1, Math.min(200, Math.floor(opts.limit))) }
        : {}),
    })
  );
  const items: Array<BookUserScenarioSubmissionItem | null> = (res.Items ?? []).map((item) => {
    const bookId = readStr(item.bookId);
    const chapterNumber = readNum(item.chapterNumber);
    const submissionId = readStr(item.submissionId);
    if (!bookId || !chapterNumber || !submissionId) return null;
    return {
      userId,
      submissionId,
      bookId,
      chapterNumber,
      chapterId: readStr(item.chapterId),
      title: readStr(item.title) || "",
      scenario: readStr(item.scenario) || "",
      whatToDo: readStr(item.whatToDo) || "",
      whyItMatters: readStr(item.whyItMatters) || "",
      scope: parseScenarioScope(item.scope),
      status:
        item.status === "approved"
          ? "approved"
          : item.status === "rejected"
            ? "rejected"
            : "pending",
      pointsAwarded: Math.max(0, readNum(item.pointsAwarded) ?? 0),
      createdAt: readStr(item.createdAt) || "",
      updatedAt: readStr(item.updatedAt) || "",
      reviewedAt: readStr(item.reviewedAt),
      reviewedBy: readStr(item.reviewedBy),
      reviewNotes: readStr(item.reviewNotes),
    } satisfies BookUserScenarioSubmissionItem;
  });
  return items.filter((item): item is BookUserScenarioSubmissionItem => item !== null);
}

export async function putScenarioLookup(
  tableName: string,
  item: BookScenarioLookupItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: scenarioLookupPk(item.submissionId),
        SK: scenarioLookupSk(),
        entity: "BOOK_SCENARIO_LOOKUP",
        ...item,
      },
    })
  );
}

export async function getScenarioLookup(
  tableName: string,
  submissionId: string
): Promise<BookScenarioLookupItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: scenarioLookupPk(submissionId),
        SK: scenarioLookupSk(),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  const userId = readStr(item.userId);
  const bookId = readStr(item.bookId);
  const chapterNumber = readNum(item.chapterNumber);
  if (!userId || !bookId || !chapterNumber) return null;
  return {
    submissionId,
    userId,
    bookId,
    chapterNumber,
    createdAt: readStr(item.createdAt) || "",
    status:
      item.status === "approved"
        ? "approved"
        : item.status === "rejected"
          ? "rejected"
          : "pending",
    pointsAwarded: Math.max(0, readNum(item.pointsAwarded) ?? 0),
    queuedAt: readStr(item.queuedAt),
    approvedAt: readStr(item.approvedAt),
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function putScenarioModerationItem(
  tableName: string,
  item: BookScenarioModerationItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: scenarioModerationPk("PENDING"),
        SK: scenarioModerationSk(item.queuedAt, item.submissionId),
        entity: "BOOK_SCENARIO_MODERATION_QUEUE",
        ...item,
      },
    })
  );
}

export async function deleteScenarioModerationItem(
  tableName: string,
  submissionId: string,
  queuedAt: string
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: scenarioModerationPk("PENDING"),
        SK: scenarioModerationSk(queuedAt, submissionId),
      },
    })
  );
}

export async function listPendingScenarioModerationItems(
  tableName: string,
  limit = 200
): Promise<BookScenarioModerationItem[]> {
  const capped = Math.max(1, Math.min(500, Math.floor(limit)));
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": scenarioModerationPk("PENDING"),
      },
      ScanIndexForward: true,
      Limit: capped,
    })
  );
  const items: Array<BookScenarioModerationItem | null> = (res.Items ?? []).map((item) => {
    const userId = readStr(item.userId);
    const submissionId = readStr(item.submissionId);
    const bookId = readStr(item.bookId);
    const chapterNumber = readNum(item.chapterNumber);
    const queuedAt = readStr(item.queuedAt);
    if (!userId || !submissionId || !bookId || !chapterNumber || !queuedAt) return null;
    return {
      userId,
      submissionId,
      bookId,
      chapterNumber,
      chapterId: readStr(item.chapterId),
      title: readStr(item.title) || "",
      scenario: readStr(item.scenario) || "",
      whatToDo: readStr(item.whatToDo) || "",
      whyItMatters: readStr(item.whyItMatters) || "",
      scope: parseScenarioScope(item.scope),
      status: "pending",
      pointsAwarded: Math.max(0, readNum(item.pointsAwarded) ?? 0),
      createdAt: readStr(item.createdAt) || "",
      updatedAt: readStr(item.updatedAt) || "",
      reviewedAt: readStr(item.reviewedAt),
      reviewedBy: readStr(item.reviewedBy),
      reviewNotes: readStr(item.reviewNotes),
      queuedAt,
    } satisfies BookScenarioModerationItem;
  });
  return items.filter((item): item is BookScenarioModerationItem => item !== null);
}

export async function putApprovedScenario(
  tableName: string,
  item: BookApprovedScenarioItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: approvedScenarioPk(item.bookId, item.chapterNumber),
        SK: approvedScenarioSk(item.approvedAt, item.submissionId),
        entity: "BOOK_SCENARIO_APPROVED",
        ...item,
      },
    })
  );
}

export async function deleteApprovedScenario(
  tableName: string,
  bookId: string,
  chapterNumber: number,
  approvedAt: string,
  submissionId: string
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: approvedScenarioPk(bookId, chapterNumber),
        SK: approvedScenarioSk(approvedAt, submissionId),
      },
    })
  );
}

export async function listApprovedScenariosForChapter(
  tableName: string,
  bookId: string,
  chapterNumber: number,
  limit = 200
): Promise<BookApprovedScenarioItem[]> {
  const capped = Math.max(1, Math.min(500, Math.floor(limit)));
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": approvedScenarioPk(bookId, chapterNumber),
      },
      ScanIndexForward: true,
      Limit: capped,
    })
  );
  const items: Array<BookApprovedScenarioItem | null> = (res.Items ?? []).map((item) => {
    const submissionId = readStr(item.submissionId);
    const userId = readStr(item.userId);
    if (!submissionId || !userId) return null;
    return {
      submissionId,
      userId,
      bookId,
      chapterNumber,
      chapterId: readStr(item.chapterId),
      title: readStr(item.title) || "",
      scenario: readStr(item.scenario) || "",
      whatToDo: readStr(item.whatToDo) || "",
      whyItMatters: readStr(item.whyItMatters) || "",
      scope: parseScenarioScope(item.scope),
      approvedAt: readStr(item.approvedAt) || "",
      createdAt: readStr(item.createdAt) || "",
      updatedAt: readStr(item.updatedAt) || "",
    } satisfies BookApprovedScenarioItem;
  });
  return items.filter((item): item is BookApprovedScenarioItem => item !== null);
}
