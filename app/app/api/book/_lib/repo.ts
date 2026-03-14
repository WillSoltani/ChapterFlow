import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { BookApiError } from "./errors";
import {
  badgeAwardSk,
  bookStateSk,
  bookMetaSk,
  bookPk,
  bookUserPk,
  bookVersionSk,
  catalogPk,
  catalogSk,
  chapterStateSk,
  entitlementSk,
  ingestJobPk,
  ingestJobSk,
  nowIso,
  progressSk,
  quizAttemptPk,
  quizAttemptSk,
  profileSk,
  readingDaySk,
  savedBookSk,
  settingsSk,
  stripeCustomerPk,
  stripeCustomerSk,
  webhookPk,
  webhookSk,
} from "./keys";
import type {
  BookCatalogItem,
  BookManifest,
  BookUserBadgeAwardItem,
  BookUserBookStateItem,
  BookUserChapterStateItem,
  BookUserEntitlement,
  BookUserProfileItem,
  BookUserProgress,
  BookUserReadingDayItem,
  BookUserSavedBookItem,
  BookUserSettingsItem,
  BookVersionItem,
  QuizAttemptItem,
} from "./types";

function readNum(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (value instanceof Set) {
    return Array.from(value).filter((v): v is string => typeof v === "string");
  }
  return [];
}

function parseNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  }
  if (value instanceof Set) {
    return Array.from(value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  }
  return [];
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(parseRecord(value)).filter(
      ([key, entryValue]) => typeof key === "string" && typeof entryValue === "string"
    )
  ) as Record<string, string>;
}

function parseNumberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(parseRecord(value)).filter(
      ([key, entryValue]) =>
        typeof key === "string" &&
        typeof entryValue === "number" &&
        Number.isFinite(entryValue)
    )
  ) as Record<string, number>;
}

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException"
  );
}

export async function listPublishedCatalogItems(tableName: string): Promise<BookCatalogItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": catalogPk(),
        ":prefix": "BOOK#",
      },
      ScanIndexForward: true,
    })
  );
  const out: BookCatalogItem[] = [];
  for (const item of res.Items ?? []) {
    const bookId = readStr(item.bookId);
    const title = readStr(item.title);
    const author = readStr(item.author);
    const latestVersion = readNum(item.latestVersion);
    const status = readStr(item.status);
    if (!bookId || !title || !author || !latestVersion || !status) continue;
    out.push({
      bookId,
      title,
      author,
      categories: parseStringArray(item.categories),
      tags: parseStringArray(item.tags),
      cover:
        typeof item.cover === "object" && item.cover !== null
          ? {
              emoji: readStr((item.cover as Record<string, unknown>).emoji),
              color: readStr((item.cover as Record<string, unknown>).color),
            }
          : undefined,
      variantFamily: item.variantFamily === "PBC" ? "PBC" : "EMH",
      status: status === "ARCHIVED" ? "ARCHIVED" : status === "DRAFT" ? "DRAFT" : "PUBLISHED",
      latestVersion,
      currentPublishedVersion: readNum(item.currentPublishedVersion),
      updatedAt: readStr(item.updatedAt) || "",
    });
  }
  return out;
}

export async function getCatalogBook(
  tableName: string,
  bookId: string
): Promise<BookCatalogItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: catalogPk(),
        SK: catalogSk(bookId),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  const latestVersion = readNum(item.latestVersion);
  if (!latestVersion) return null;
  return {
    bookId: readStr(item.bookId) || bookId,
    title: readStr(item.title) || "",
    author: readStr(item.author) || "",
    categories: parseStringArray(item.categories),
    tags: parseStringArray(item.tags),
    cover:
      typeof item.cover === "object" && item.cover !== null
        ? {
            emoji: readStr((item.cover as Record<string, unknown>).emoji),
            color: readStr((item.cover as Record<string, unknown>).color),
          }
        : undefined,
    variantFamily: item.variantFamily === "PBC" ? "PBC" : "EMH",
    status:
      item.status === "ARCHIVED" ? "ARCHIVED" : item.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
    latestVersion,
    currentPublishedVersion: readNum(item.currentPublishedVersion),
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function getBookVersion(
  tableName: string,
  bookId: string,
  version: number
): Promise<BookVersionItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookPk(bookId),
        SK: bookVersionSk(version),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  const parsedVersion = readNum(item.version);
  if (!parsedVersion) return null;
  return {
    bookId,
    version: parsedVersion,
    packageId: readStr(item.packageId) || "",
    schemaVersion: readStr(item.schemaVersion) || "",
    state: item.state === "PUBLISHED" ? "PUBLISHED" : item.state === "ARCHIVED" ? "ARCHIVED" : "DRAFT",
    contentPrefix: readStr(item.contentPrefix) || "",
    manifestKey: readStr(item.manifestKey) || "",
    createdAt: readStr(item.createdAt) || "",
    createdBy: readStr(item.createdBy) || "",
    publishedAt: readStr(item.publishedAt),
    publishedBy: readStr(item.publishedBy),
  };
}

export async function listBookVersions(tableName: string, bookId: string): Promise<BookVersionItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookPk(bookId),
        ":prefix": "VERSION#",
      },
      ScanIndexForward: false,
    })
  );
  const out: BookVersionItem[] = [];
  for (const item of res.Items ?? []) {
    const version = readNum(item.version);
    if (!version) continue;
    out.push({
      bookId,
      version,
      packageId: readStr(item.packageId) || "",
      schemaVersion: readStr(item.schemaVersion) || "",
      state: item.state === "PUBLISHED" ? "PUBLISHED" : item.state === "ARCHIVED" ? "ARCHIVED" : "DRAFT",
      contentPrefix: readStr(item.contentPrefix) || "",
      manifestKey: readStr(item.manifestKey) || "",
      createdAt: readStr(item.createdAt) || "",
      createdBy: readStr(item.createdBy) || "",
      publishedAt: readStr(item.publishedAt),
      publishedBy: readStr(item.publishedBy),
    });
  }
  return out;
}

export async function getNextVersionNumber(tableName: string, bookId: string): Promise<number> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookPk(bookId),
        ":prefix": "VERSION#",
      },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  const latest = res.Items?.[0];
  const latestVersion = latest ? readNum(latest.version) : undefined;
  return latestVersion ? latestVersion + 1 : 1;
}

export async function createBookVersionDraft(
  tableName: string,
  params: {
    bookId: string;
    version: number;
    packageId: string;
    schemaVersion: string;
    contentPrefix: string;
    manifestKey: string;
    createdBy: string;
  }
): Promise<void> {
  const createdAt = nowIso();
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookPk(params.bookId),
          SK: bookVersionSk(params.version),
          entity: "BOOK_VERSION",
          bookId: params.bookId,
          version: params.version,
          packageId: params.packageId,
          schemaVersion: params.schemaVersion,
          state: "DRAFT",
          contentPrefix: params.contentPrefix,
          manifestKey: params.manifestKey,
          createdAt,
          createdBy: params.createdBy,
          updatedAt: createdAt,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      throw new BookApiError(409, "version_conflict", "Version already exists. Retry ingestion.");
    }
    throw error;
  }
}

export async function upsertBookMetaAndCatalog(
  tableName: string,
  params: {
    bookId: string;
    title: string;
    author: string;
    categories: string[];
    tags: string[];
    cover?: { emoji?: string; color?: string };
    variantFamily: "EMH" | "PBC";
    latestVersion: number;
    currentPublishedVersion?: number;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  }
): Promise<void> {
  const updatedAt = nowIso();

  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookPk(params.bookId),
        SK: bookMetaSk(),
        entity: "BOOK_META",
        bookId: params.bookId,
        title: params.title,
        author: params.author,
        categories: params.categories,
        tags: params.tags,
        cover: params.cover,
        variantFamily: params.variantFamily,
        latestVersion: params.latestVersion,
        currentPublishedVersion: params.currentPublishedVersion,
        status: params.status,
        updatedAt,
      },
    })
  );

  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: catalogPk(),
        SK: catalogSk(params.bookId),
        entity: "BOOK_CATALOG",
        bookId: params.bookId,
        title: params.title,
        author: params.author,
        categories: params.categories,
        tags: params.tags,
        cover: params.cover,
        variantFamily: params.variantFamily,
        latestVersion: params.latestVersion,
        currentPublishedVersion: params.currentPublishedVersion,
        status: params.status,
        updatedAt,
      },
    })
  );
}

export async function publishBookVersion(
  tableName: string,
  bookId: string,
  version: number,
  publishedBy: string
): Promise<void> {
  const ts = nowIso();
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookPk(bookId),
        SK: bookVersionSk(version),
      },
      UpdateExpression: "SET #state = :published, publishedAt = :ts, publishedBy = :by, updatedAt = :ts",
      ExpressionAttributeNames: {
        "#state": "state",
      },
      ExpressionAttributeValues: {
        ":published": "PUBLISHED",
        ":ts": ts,
        ":by": publishedBy,
      },
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    })
  );

  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookPk(bookId),
        SK: bookMetaSk(),
      },
      UpdateExpression:
        "SET currentPublishedVersion = :version, latestVersion = if_not_exists(latestVersion, :version), #status = :published, updatedAt = :ts",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":version": version,
        ":published": "PUBLISHED",
        ":ts": ts,
      },
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    })
  );

  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: catalogPk(),
        SK: catalogSk(bookId),
      },
      UpdateExpression:
        "SET currentPublishedVersion = :version, latestVersion = if_not_exists(latestVersion, :version), #status = :published, updatedAt = :ts",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":version": version,
        ":published": "PUBLISHED",
        ":ts": ts,
      },
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    })
  );
}

export async function createOrUpdateIngestionJob(
  tableName: string,
  params: {
    jobId: string;
    createdBy: string;
    ingestBucket: string;
    ingestKey: string;
    bookId?: string;
    status: "PENDING" | "RUNNING" | "FAILED" | "SUCCEEDED";
    details?: unknown;
    errorReportKey?: string;
  }
) {
  const ts = nowIso();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: ingestJobPk(params.jobId),
        SK: ingestJobSk(),
        entity: "BOOK_INGEST_JOB",
        jobId: params.jobId,
        createdBy: params.createdBy,
        ingestBucket: params.ingestBucket,
        ingestKey: params.ingestKey,
        bookId: params.bookId,
        status: params.status,
        details: params.details,
        errorReportKey: params.errorReportKey,
        updatedAt: ts,
        createdAt: ts,
      },
    })
  );
}

export async function updateIngestionJob(
  tableName: string,
  jobId: string,
  params: {
    status: "RUNNING" | "FAILED" | "SUCCEEDED";
    details?: unknown;
    errorReportKey?: string;
    bookId?: string;
  }
) {
  const ts = nowIso();
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: ingestJobPk(jobId),
        SK: ingestJobSk(),
      },
      UpdateExpression:
        "SET #status = :status, details = :details, errorReportKey = :errorReportKey, bookId = :bookId, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": params.status,
        ":details": params.details ?? null,
        ":errorReportKey": params.errorReportKey ?? null,
        ":bookId": params.bookId ?? null,
        ":updatedAt": ts,
      },
    })
  );
}

export async function getIngestionJob(tableName: string, jobId: string): Promise<Record<string, unknown> | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: ingestJobPk(jobId),
        SK: ingestJobSk(),
      },
    })
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export async function getUserEntitlement(
  tableName: string,
  userId: string
): Promise<BookUserEntitlement | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: entitlementSk(),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    plan: item.plan === "PRO" ? "PRO" : "FREE",
    proStatus:
      item.proStatus === "active" ||
      item.proStatus === "past_due" ||
      item.proStatus === "canceled" ||
      item.proStatus === "inactive"
        ? item.proStatus
        : undefined,
    freeBookSlots: readNum(item.freeBookSlots) ?? 2,
    unlockedBookIds: parseStringArray(item.unlockedBookIds),
    stripeCustomerId: readStr(item.stripeCustomerId),
    stripeSubscriptionId: readStr(item.stripeSubscriptionId),
    currentPeriodEnd: readStr(item.currentPeriodEnd),
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function reserveBookEntitlement(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    freeSlotsDefault: number;
  }
): Promise<BookUserEntitlement> {
  const ts = nowIso();
  try {
    const res = await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(params.userId),
          SK: entitlementSk(),
        },
        UpdateExpression:
          "SET plan = if_not_exists(plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :freeSlots), updatedAt = :updatedAt ADD unlockedBookIds :bookSet",
        ConditionExpression:
          "plan = :proPlan OR contains(unlockedBookIds, :bookId) OR attribute_not_exists(unlockedBookIds) OR attribute_not_exists(freeBookSlots) OR size(unlockedBookIds) < freeBookSlots",
        ExpressionAttributeValues: {
          ":freePlan": "FREE",
          ":proPlan": "PRO",
          ":freeSlots": params.freeSlotsDefault,
          ":updatedAt": ts,
          ":bookId": params.bookId,
          ":bookSet": new Set([params.bookId]),
        },
        ReturnValues: "ALL_NEW",
      })
    );
    const item = res.Attributes ?? {};
    return {
      userId: params.userId,
      plan: item.plan === "PRO" ? "PRO" : "FREE",
      proStatus:
        item.proStatus === "active" ||
        item.proStatus === "past_due" ||
        item.proStatus === "canceled" ||
        item.proStatus === "inactive"
          ? item.proStatus
          : undefined,
      freeBookSlots: readNum(item.freeBookSlots) ?? params.freeSlotsDefault,
      unlockedBookIds: parseStringArray(item.unlockedBookIds),
      stripeCustomerId: readStr(item.stripeCustomerId),
      stripeSubscriptionId: readStr(item.stripeSubscriptionId),
      currentPeriodEnd: readStr(item.currentPeriodEnd),
      updatedAt: readStr(item.updatedAt) || ts,
    };
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      throw new BookApiError(402, "book_limit_reached", "Book limit reached. Upgrade required.");
    }
    throw error;
  }
}

export async function upsertUserProgress(
  tableName: string,
  progress: BookUserProgress
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(progress.userId),
        SK: progressSk(progress.bookId),
        entity: "BOOK_PROGRESS",
        ...progress,
      },
    })
  );
}

export async function createProgressIfMissing(
  tableName: string,
  progress: BookUserProgress
): Promise<void> {
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(progress.userId),
          SK: progressSk(progress.bookId),
          entity: "BOOK_PROGRESS",
          ...progress,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return;
    throw error;
  }
}

export async function getUserProgress(
  tableName: string,
  userId: string,
  bookId: string
): Promise<BookUserProgress | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: progressSk(bookId),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    bookId,
    pinnedBookVersion: readNum(item.pinnedBookVersion) ?? 1,
    contentPrefix: readStr(item.contentPrefix) || "",
    manifestKey: readStr(item.manifestKey) || "",
    currentChapterNumber: readNum(item.currentChapterNumber) ?? 1,
    unlockedThroughChapterNumber: readNum(item.unlockedThroughChapterNumber) ?? 1,
    completedChapters: parseNumberArray(item.completedChapters),
    bestScoreByChapter:
      typeof item.bestScoreByChapter === "object" && item.bestScoreByChapter !== null
        ? (item.bestScoreByChapter as Record<string, number>)
        : {},
    lastOpenedAt: readStr(item.lastOpenedAt),
    lastActiveAt: readStr(item.lastActiveAt),
    streakDays: readNum(item.streakDays),
    preferredVariant: readStr(item.preferredVariant) as BookUserProgress["preferredVariant"],
    updatedAt: readStr(item.updatedAt) || "",
    createdAt: readStr(item.createdAt) || "",
  };
}

export async function listAllUserProgress(
  tableName: string,
  userId: string
): Promise<BookUserProgress[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "PROGRESS#",
      },
      ScanIndexForward: false,
    })
  );
  const out: BookUserProgress[] = [];
  for (const item of res.Items ?? []) {
    const bookId = readStr(item.bookId);
    if (!bookId) continue;
    out.push({
      userId,
      bookId,
      pinnedBookVersion: readNum(item.pinnedBookVersion) ?? 1,
      contentPrefix: readStr(item.contentPrefix) || "",
      manifestKey: readStr(item.manifestKey) || "",
      currentChapterNumber: readNum(item.currentChapterNumber) ?? 1,
      unlockedThroughChapterNumber: readNum(item.unlockedThroughChapterNumber) ?? 1,
      completedChapters: parseNumberArray(item.completedChapters),
      bestScoreByChapter:
        typeof item.bestScoreByChapter === "object" && item.bestScoreByChapter !== null
          ? (item.bestScoreByChapter as Record<string, number>)
          : {},
      lastOpenedAt: readStr(item.lastOpenedAt),
      lastActiveAt: readStr(item.lastActiveAt),
      streakDays: readNum(item.streakDays),
      preferredVariant: readStr(item.preferredVariant) as BookUserProgress["preferredVariant"],
      updatedAt: readStr(item.updatedAt) || "",
      createdAt: readStr(item.createdAt) || "",
    });
  }
  return out;
}

export async function writeQuizAttempt(tableName: string, attempt: QuizAttemptItem): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: quizAttemptPk(attempt.userId, attempt.bookId, attempt.chapterNumber),
        SK: quizAttemptSk(attempt.createdAt),
        entity: "BOOK_QUIZ_ATTEMPT",
        ...attempt,
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

export async function getManifestFromVersion(
  tableName: string,
  bookId: string,
  version: number
): Promise<{ manifestKey: string; contentPrefix: string } | null> {
  const versionItem = await getBookVersion(tableName, bookId, version);
  if (!versionItem) return null;
  return {
    manifestKey: versionItem.manifestKey,
    contentPrefix: versionItem.contentPrefix,
  };
}

export async function recordStripeWebhookEvent(
  tableName: string,
  eventId: string,
  eventType: string
): Promise<boolean> {
  const ts = nowIso();
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: webhookPk(),
          SK: webhookSk(eventId),
          entity: "BOOK_STRIPE_WEBHOOK_EVENT",
          eventId,
          eventType,
          createdAt: ts,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

export async function mapStripeCustomerToUser(
  tableName: string,
  customerId: string,
  userId: string
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: stripeCustomerPk(customerId),
        SK: stripeCustomerSk(),
        entity: "BOOK_STRIPE_CUSTOMER_MAP",
        customerId,
        userId,
        updatedAt: nowIso(),
      },
    })
  );
}

export async function getUserIdByStripeCustomer(
  tableName: string,
  customerId: string
): Promise<string | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: stripeCustomerPk(customerId),
        SK: stripeCustomerSk(),
      },
    })
  );
  const userId = readStr(res.Item?.userId);
  return userId || null;
}

export async function updateUserEntitlementFromStripe(
  tableName: string,
  params: {
    userId: string;
    plan: "FREE" | "PRO";
    proStatus: "inactive" | "active" | "past_due" | "canceled";
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: string;
  }
): Promise<void> {
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(params.userId),
        SK: entitlementSk(),
      },
      UpdateExpression:
        "SET #plan = :plan, proStatus = :proStatus, stripeCustomerId = :stripeCustomerId, stripeSubscriptionId = :stripeSubscriptionId, currentPeriodEnd = :periodEnd, updatedAt = :updatedAt, freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots), unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)",
      ExpressionAttributeNames: {
        "#plan": "plan",
      },
      ExpressionAttributeValues: {
        ":plan": params.plan,
        ":proStatus": params.proStatus,
        ":stripeCustomerId": params.stripeCustomerId ?? null,
        ":stripeSubscriptionId": params.stripeSubscriptionId ?? null,
        ":periodEnd": params.currentPeriodEnd ?? null,
        ":updatedAt": nowIso(),
        ":defaultSlots": 2,
        ":emptySet": new Set<string>(),
      },
    })
  );
}

export async function attachStripeCustomerToEntitlement(
  tableName: string,
  userId: string,
  customerId: string
): Promise<void> {
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: entitlementSk(),
      },
      UpdateExpression:
        "SET stripeCustomerId = :customerId, updatedAt = :updatedAt, #plan = if_not_exists(#plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots), unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)",
      ExpressionAttributeNames: {
        "#plan": "plan",
      },
      ExpressionAttributeValues: {
        ":customerId": customerId,
        ":updatedAt": nowIso(),
        ":freePlan": "FREE",
        ":defaultSlots": 2,
        ":emptySet": new Set<string>(),
      },
    })
  );
}

export async function adminUpdateUserEntitlement(
  tableName: string,
  params: {
    userId: string;
    freeBookSlots?: number;
    plan?: "FREE" | "PRO";
    proStatus?: "inactive" | "active" | "past_due" | "canceled";
  }
): Promise<BookUserEntitlement> {
  const updatedAt = nowIso();
  const segments: string[] = ["updatedAt = :updatedAt"];
  const values: Record<string, unknown> = {
    ":updatedAt": updatedAt,
    ":emptySet": new Set<string>(),
    ":defaultSlots": 2,
    ":defaultPlan": "FREE",
  };
  if (typeof params.freeBookSlots === "number") {
    segments.push("freeBookSlots = :freeBookSlots");
    values[":freeBookSlots"] = Math.max(0, Math.floor(params.freeBookSlots));
  } else {
    segments.push("freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)");
  }
  if (params.plan) {
    segments.push("#plan = :plan");
    values[":plan"] = params.plan;
  } else {
    segments.push("#plan = if_not_exists(#plan, :defaultPlan)");
  }
  if (params.proStatus) {
    segments.push("proStatus = :proStatus");
    values[":proStatus"] = params.proStatus;
  }
  segments.push("unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)");

  const res = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(params.userId),
        SK: entitlementSk(),
      },
      UpdateExpression: `SET ${segments.join(", ")}`,
      ExpressionAttributeNames: {
        "#plan": "plan",
      },
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );
  const item = res.Attributes ?? {};
  return {
    userId: params.userId,
    plan: item.plan === "PRO" ? "PRO" : "FREE",
    proStatus:
      item.proStatus === "active" ||
      item.proStatus === "past_due" ||
      item.proStatus === "canceled" ||
      item.proStatus === "inactive"
        ? item.proStatus
        : undefined,
    freeBookSlots: readNum(item.freeBookSlots) ?? 2,
    unlockedBookIds: parseStringArray(item.unlockedBookIds),
    stripeCustomerId: readStr(item.stripeCustomerId),
    stripeSubscriptionId: readStr(item.stripeSubscriptionId),
    currentPeriodEnd: readStr(item.currentPeriodEnd),
    updatedAt: readStr(item.updatedAt) || updatedAt,
  };
}

export async function deleteBookVersion(
  tableName: string,
  bookId: string,
  version: number
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: bookPk(bookId),
        SK: bookVersionSk(version),
      },
    })
  );
}

export async function getBookMeta(
  tableName: string,
  bookId: string
): Promise<Record<string, unknown> | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookPk(bookId),
        SK: bookMetaSk(),
      },
    })
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export async function updateProgressAfterQuizPass(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    chapterNumber: number;
    scorePercent: number;
  }
): Promise<void> {
  const progress = await getUserProgress(tableName, params.userId, params.bookId);
  if (!progress) {
    throw new BookApiError(404, "progress_not_found", "Progress record not found.");
  }

  const completed = new Set(progress.completedChapters);
  completed.add(params.chapterNumber);

  const bestScoreByChapter = {
    ...progress.bestScoreByChapter,
    [String(params.chapterNumber)]: Math.max(
      params.scorePercent,
      progress.bestScoreByChapter[String(params.chapterNumber)] || 0
    ),
  };

  const nextUnlocked = Math.max(progress.unlockedThroughChapterNumber, params.chapterNumber + 1);
  const updatedAt = nowIso();
  await upsertUserProgress(tableName, {
    ...progress,
    currentChapterNumber: Math.max(progress.currentChapterNumber, params.chapterNumber + 1),
    unlockedThroughChapterNumber: nextUnlocked,
    completedChapters: Array.from(completed).sort((a, b) => a - b),
    bestScoreByChapter,
    lastActiveAt: updatedAt,
    lastOpenedAt: updatedAt,
    updatedAt,
  });
}

export async function readManifest(
  tableName: string,
  bookId: string
): Promise<{ version: number; manifestKey: string; contentPrefix: string } | null> {
  const catalog = await getCatalogBook(tableName, bookId);
  if (!catalog?.currentPublishedVersion) return null;
  const version = await getBookVersion(tableName, bookId, catalog.currentPublishedVersion);
  if (!version) return null;
  return {
    version: version.version,
    manifestKey: version.manifestKey,
    contentPrefix: version.contentPrefix,
  };
}

export function summarizeProgress(
  entries: BookUserProgress[],
  ent: BookUserEntitlement | null
): {
  booksStarted: number;
  booksCompleted: number;
  chaptersCompleted: number;
  averageBestScore: number;
  plan: "FREE" | "PRO";
  freeBookSlots: number;
  unlockedBooksCount: number;
} {
  const booksStarted = entries.length;
  let booksCompleted = 0;
  let chaptersCompleted = 0;
  const scores: number[] = [];

  for (const p of entries) {
    chaptersCompleted += p.completedChapters.length;
    if (p.completedChapters.length > 0 && p.currentChapterNumber <= p.completedChapters.length) {
      booksCompleted += 1;
    }
    for (const value of Object.values(p.bestScoreByChapter)) {
      if (typeof value === "number" && Number.isFinite(value)) scores.push(value);
    }
  }

  const averageBestScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return {
    booksStarted,
    booksCompleted,
    chaptersCompleted,
    averageBestScore,
    plan: ent?.plan ?? "FREE",
    freeBookSlots: ent?.freeBookSlots ?? 2,
    unlockedBooksCount: ent?.unlockedBookIds.length ?? 0,
  };
}

export async function getUserProfileItem(
  tableName: string,
  userId: string
): Promise<BookUserProfileItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: profileSk(),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    profile: parseRecord(item.profile),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function putUserProfileItem(
  tableName: string,
  params: {
    userId: string;
    profile: Record<string, unknown>;
    createdAt?: string;
  }
): Promise<BookUserProfileItem> {
  const now = nowIso();
  const createdAt = params.createdAt || now;
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(params.userId),
        SK: profileSk(),
        entity: "BOOK_USER_PROFILE",
        userId: params.userId,
        profile: params.profile,
        createdAt,
        updatedAt: now,
      },
    })
  );
  return {
    userId: params.userId,
    profile: params.profile,
    createdAt,
    updatedAt: now,
  };
}

export async function getUserSettingsItem(
  tableName: string,
  userId: string
): Promise<BookUserSettingsItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: settingsSk(),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    settings: parseRecord(item.settings),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function putUserSettingsItem(
  tableName: string,
  params: {
    userId: string;
    settings: Record<string, unknown>;
    createdAt?: string;
  }
): Promise<BookUserSettingsItem> {
  const now = nowIso();
  const createdAt = params.createdAt || now;
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(params.userId),
        SK: settingsSk(),
        entity: "BOOK_USER_SETTINGS",
        userId: params.userId,
        settings: params.settings,
        createdAt,
        updatedAt: now,
      },
    })
  );
  return {
    userId: params.userId,
    settings: params.settings,
    createdAt,
    updatedAt: now,
  };
}

export async function listSavedBooks(
  tableName: string,
  userId: string
): Promise<BookUserSavedBookItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "SAVED#",
      },
      ScanIndexForward: true,
    })
  );
  const items: Array<BookUserSavedBookItem | null> = (res.Items ?? [])
    .map((item) => {
      const bookId = readStr(item.bookId);
      if (!bookId) return null;
      return {
        userId,
        bookId,
        savedAt: readStr(item.savedAt) || "",
        updatedAt: readStr(item.updatedAt) || "",
        source: readStr(item.source),
        priority: readNum(item.priority),
        pinned: item.pinned === true,
      } satisfies BookUserSavedBookItem;
    });
  return items.filter((item): item is BookUserSavedBookItem => item !== null);
}

export async function putSavedBook(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    source?: string;
    priority?: number;
    pinned?: boolean;
  }
): Promise<BookUserSavedBookItem> {
  const existing = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(params.userId),
        SK: savedBookSk(params.bookId),
      },
    })
  );
  const now = nowIso();
  const savedAt = readStr(existing.Item?.savedAt) || now;
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(params.userId),
        SK: savedBookSk(params.bookId),
        entity: "BOOK_SAVED_BOOK",
        userId: params.userId,
        bookId: params.bookId,
        savedAt,
        updatedAt: now,
        source: params.source,
        priority: params.priority,
        pinned: params.pinned === true,
      },
    })
  );
  return {
    userId: params.userId,
    bookId: params.bookId,
    savedAt,
    updatedAt: now,
    source: params.source,
    priority: params.priority,
    pinned: params.pinned === true,
  };
}

export async function deleteSavedBook(
  tableName: string,
  userId: string,
  bookId: string
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: savedBookSk(bookId),
      },
    })
  );
}

export async function getUserBookState(
  tableName: string,
  userId: string,
  bookId: string
): Promise<BookUserBookStateItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: bookStateSk(bookId),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    bookId,
    currentChapterId: readStr(item.currentChapterId) || "",
    completedChapterIds: parseStringArray(item.completedChapterIds),
    unlockedChapterIds: parseStringArray(item.unlockedChapterIds),
    chapterScores: parseNumberRecord(item.chapterScores),
    chapterCompletedAt: parseStringRecord(item.chapterCompletedAt),
    lastReadChapterId: readStr(item.lastReadChapterId) || "",
    lastOpenedAt: readStr(item.lastOpenedAt) || "",
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function putUserBookState(
  tableName: string,
  state: BookUserBookStateItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(state.userId),
        SK: bookStateSk(state.bookId),
        entity: "BOOK_USER_BOOK_STATE",
        ...state,
      },
    })
  );
}

export async function listAllUserBookStates(
  tableName: string,
  userId: string
): Promise<BookUserBookStateItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "BOOKSTATE#",
      },
      ScanIndexForward: true,
    })
  );
  const items: Array<BookUserBookStateItem | null> = (res.Items ?? [])
    .map((item) => {
      const bookId = readStr(item.bookId);
      if (!bookId) return null;
      return {
        userId,
        bookId,
        currentChapterId: readStr(item.currentChapterId) || "",
        completedChapterIds: parseStringArray(item.completedChapterIds),
        unlockedChapterIds: parseStringArray(item.unlockedChapterIds),
        chapterScores: parseNumberRecord(item.chapterScores),
        chapterCompletedAt: parseStringRecord(item.chapterCompletedAt),
        lastReadChapterId: readStr(item.lastReadChapterId) || "",
        lastOpenedAt: readStr(item.lastOpenedAt) || "",
        createdAt: readStr(item.createdAt) || "",
        updatedAt: readStr(item.updatedAt) || "",
      } satisfies BookUserBookStateItem;
    });
  return items.filter((item): item is BookUserBookStateItem => item !== null);
}

export async function getUserChapterState(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number
): Promise<BookUserChapterStateItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: chapterStateSk(bookId, chapterNumber),
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
    state: parseRecord(item.state),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function putUserChapterState(
  tableName: string,
  item: BookUserChapterStateItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(item.userId),
        SK: chapterStateSk(item.bookId, item.chapterNumber),
        entity: "BOOK_USER_CHAPTER_STATE",
        ...item,
      },
    })
  );
}

export async function listUserChapterStates(
  tableName: string,
  userId: string
): Promise<BookUserChapterStateItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "CHAPTERSTATE#",
      },
      ScanIndexForward: true,
    })
  );
  const items: Array<BookUserChapterStateItem | null> = (res.Items ?? [])
    .map((item) => {
      const bookId = readStr(item.bookId);
      const chapterNumber = readNum(item.chapterNumber);
      if (!bookId || !chapterNumber) return null;
      return {
        userId,
        bookId,
        chapterNumber,
        chapterId: readStr(item.chapterId),
        state: parseRecord(item.state),
        createdAt: readStr(item.createdAt) || "",
        updatedAt: readStr(item.updatedAt) || "",
      } satisfies BookUserChapterStateItem;
    });
  return items.filter((item): item is BookUserChapterStateItem => item !== null);
}

export async function addReadingDayActivity(
  tableName: string,
  params: {
    userId: string;
    dayKey: string;
    deltaMs: number;
    occurredAt?: string;
  }
): Promise<BookUserReadingDayItem> {
  const safeDelta = Math.max(0, Math.round(params.deltaMs));
  const now = params.occurredAt || nowIso();
  const res = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(params.userId),
        SK: readingDaySk(params.dayKey),
      },
      UpdateExpression:
        "SET entity = :entity, userId = :userId, dayKey = :dayKey, updatedAt = :updatedAt, lastActivityAt = :lastActivityAt ADD totalActiveMs :delta",
      ExpressionAttributeValues: {
        ":entity": "BOOK_USER_READING_DAY",
        ":userId": params.userId,
        ":dayKey": params.dayKey,
        ":updatedAt": now,
        ":lastActivityAt": now,
        ":delta": safeDelta,
      },
      ReturnValues: "ALL_NEW",
    })
  );
  const item = res.Attributes ?? {};
  return {
    userId: params.userId,
    dayKey: params.dayKey,
    totalActiveMs: readNum(item.totalActiveMs) ?? safeDelta,
    updatedAt: readStr(item.updatedAt) || now,
    lastActivityAt: readStr(item.lastActivityAt) || now,
  };
}

export async function listReadingDays(
  tableName: string,
  userId: string
): Promise<BookUserReadingDayItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "READINGDAY#",
      },
      ScanIndexForward: true,
    })
  );
  const items: Array<BookUserReadingDayItem | null> = (res.Items ?? [])
    .map((item) => {
      const dayKey = readStr(item.dayKey);
      if (!dayKey) return null;
      return {
        userId,
        dayKey,
        totalActiveMs: readNum(item.totalActiveMs) ?? 0,
        updatedAt: readStr(item.updatedAt) || "",
        lastActivityAt: readStr(item.lastActivityAt),
      } satisfies BookUserReadingDayItem;
    });
  return items.filter((item): item is BookUserReadingDayItem => item !== null);
}

export async function listBadgeAwards(
  tableName: string,
  userId: string
): Promise<BookUserBadgeAwardItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "BADGE#",
      },
      ScanIndexForward: true,
    })
  );
  const items: Array<BookUserBadgeAwardItem | null> = (res.Items ?? [])
    .map((item) => {
      const badgeId = readStr(item.badgeId);
      if (!badgeId) return null;
      return {
        userId,
        badgeId,
        earnedAt: readStr(item.earnedAt) || "",
        updatedAt: readStr(item.updatedAt) || "",
        tier: readStr(item.tier),
      } satisfies BookUserBadgeAwardItem;
    });
  return items.filter((item): item is BookUserBadgeAwardItem => item !== null);
}

export async function putBadgeAward(
  tableName: string,
  params: {
    userId: string;
    badgeId: string;
    earnedAt: string;
    tier?: string;
  }
): Promise<void> {
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(params.userId),
          SK: badgeAwardSk(params.badgeId),
          entity: "BOOK_USER_BADGE_AWARD",
          userId: params.userId,
          badgeId: params.badgeId,
          earnedAt: params.earnedAt,
          updatedAt: nowIso(),
          tier: params.tier,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return;
    throw error;
  }
}

export async function putBookManifest(
  tableName: string,
  params: {
    bookId: string;
    version: number;
    manifest: BookManifest;
    createdBy: string;
    packageId: string;
    schemaVersion: string;
    contentPrefix: string;
    manifestKey: string;
    publishNow: boolean;
  }
): Promise<void> {
  await createBookVersionDraft(tableName, {
    bookId: params.bookId,
    version: params.version,
    packageId: params.packageId,
    schemaVersion: params.schemaVersion,
    contentPrefix: params.contentPrefix,
    manifestKey: params.manifestKey,
    createdBy: params.createdBy,
  });

  await upsertBookMetaAndCatalog(tableName, {
    bookId: params.bookId,
    title: params.manifest.title,
    author: params.manifest.author,
    categories: params.manifest.categories,
    tags: params.manifest.tags,
    variantFamily: params.manifest.variantFamily,
    latestVersion: params.version,
    currentPublishedVersion: params.publishNow ? params.version : undefined,
    status: params.publishNow ? "PUBLISHED" : "DRAFT",
  });

  if (params.publishNow) {
    await publishBookVersion(tableName, params.bookId, params.version, params.createdBy);
  }
}
