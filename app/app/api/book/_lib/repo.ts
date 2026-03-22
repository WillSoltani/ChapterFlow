import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type TransactWriteCommandInput,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { BookApiError } from "./errors";
import {
  badgeAwardSk,
  approvedScenarioPk,
  approvedScenarioSk,
  bookStateSk,
  bookMetaSk,
  bookPk,
  bookUserPk,
  bookVersionSk,
  engagementSk,
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
  quizScopeKey,
  quizStateSk,
  riskEventPk,
  riskEventSk,
  profileSk,
  readingDaySk,
  savedBookSk,
  scenarioLookupPk,
  scenarioLookupSk,
  scenarioModerationPk,
  scenarioModerationSk,
  scenarioSubmissionSk,
  settingsSk,
  stripeCustomerPk,
  stripeCustomerSk,
  webhookPk,
  webhookSk,
  licenseKeyPk,
  licenseKeySk,
} from "./keys";
import type {
  BookCatalogItem,
  BookManifest,
  BookApprovedScenarioItem,
  BookScenarioLookupItem,
  BookScenarioModerationItem,
  BookUserEngagementItem,
  BookUserBadgeAwardItem,
  BookUserBookStateItem,
  BookUserChapterStateItem,
  BookUserEntitlement,
  BookRiskEventItem,
  BookUserProfileItem,
  BookUserProgress,
  BookUserQuizStateItem,
  BookUserReadingDayItem,
  BookUserSavedBookItem,
  BookUserScenarioSubmissionItem,
  BookUserSettingsItem,
  BookVersionItem,
  LicenseKeyItem,
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

  const proSource =
    item.proSource === "stripe"
      ? "stripe"
      : item.proSource === "license"
        ? "license"
        : item.proSource === "flow_points"
          ? "flow_points"
          : undefined;
  const licenseKey = readStr(item.licenseKey);
  const licenseExpiresAt = readStr(item.licenseExpiresAt);
  const currentPeriodEnd = readStr(item.currentPeriodEnd);

  // Compute effective plan for time-limited grants inline.
  const storedPlan = item.plan === "PRO" ? "PRO" : "FREE";
  const grantExpired =
    storedPlan === "PRO" &&
    ((proSource === "license" &&
      licenseExpiresAt != null &&
      new Date(licenseExpiresAt) < new Date()) ||
      (proSource === "flow_points" &&
        currentPeriodEnd != null &&
        new Date(currentPeriodEnd) < new Date()));
  const plan: "FREE" | "PRO" = grantExpired ? "FREE" : storedPlan;
  const proStatus =
    grantExpired
      ? "inactive"
      : item.proStatus === "active" ||
        item.proStatus === "past_due" ||
        item.proStatus === "canceled" ||
        item.proStatus === "inactive"
      ? item.proStatus
      : undefined;

  return {
    userId,
    plan,
    proStatus,
    proSource,
    freeBookSlots: readNum(item.freeBookSlots) ?? 2,
    unlockedBookIds: parseStringArray(item.unlockedBookIds),
    stripeCustomerId: readStr(item.stripeCustomerId),
    stripeSubscriptionId: readStr(item.stripeSubscriptionId),
    currentPeriodEnd,
    licenseKey,
    licenseExpiresAt,
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
          "SET #plan = if_not_exists(#plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :freeSlots), updatedAt = :updatedAt ADD unlockedBookIds :bookSet",
        // A user may bypass the slot limit only when they are PRO with a non-expired entitlement.
        ConditionExpression: [
          "(#plan = :proPlan AND (attribute_not_exists(proSource) OR proSource = :stripeSource OR (proSource = :licenseSource AND licenseExpiresAt >= :now) OR (proSource = :flowPointsSource AND currentPeriodEnd >= :now)))",
          "OR contains(unlockedBookIds, :bookId)",
          "OR attribute_not_exists(unlockedBookIds)",
          "OR attribute_not_exists(freeBookSlots)",
          "OR size(unlockedBookIds) < freeBookSlots",
        ].join(" "),
        ExpressionAttributeNames: {
          "#plan": "plan",
        },
        ExpressionAttributeValues: {
          ":freePlan": "FREE",
          ":proPlan": "PRO",
          ":stripeSource": "stripe",
          ":licenseSource": "license",
          ":flowPointsSource": "flow_points",
          ":now": ts,
          ":freeSlots": params.freeSlotsDefault,
          ":updatedAt": ts,
          ":bookId": params.bookId,
          ":bookSet": new Set([params.bookId]),
        },
        ReturnValues: "ALL_NEW",
      })
    );
    const item = res.Attributes ?? {};
    const proSource =
      item.proSource === "stripe"
        ? "stripe"
        : item.proSource === "license"
          ? "license"
          : item.proSource === "flow_points"
            ? "flow_points"
            : undefined;
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
      proSource,
      freeBookSlots: readNum(item.freeBookSlots) ?? params.freeSlotsDefault,
      unlockedBookIds: parseStringArray(item.unlockedBookIds),
      stripeCustomerId: readStr(item.stripeCustomerId),
      stripeSubscriptionId: readStr(item.stripeSubscriptionId),
      currentPeriodEnd: readStr(item.currentPeriodEnd),
      licenseKey: readStr(item.licenseKey),
      licenseExpiresAt: readStr(item.licenseExpiresAt),
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

export async function recordQuizAttemptOutcome(
  tableName: string,
  params: {
    previousAttemptsCount: number;
    attempt: QuizAttemptItem;
    nextQuizState: BookUserQuizStateItem;
    nextProgress?: BookUserProgress;
  }
): Promise<void> {
  const transactItems: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
    {
      Put: {
        TableName: tableName,
        Item: {
          PK: quizAttemptPk(
            params.attempt.userId,
            params.attempt.bookId,
            params.attempt.chapterNumber
          ),
          SK: quizAttemptSk(params.attempt.createdAt),
          entity: "BOOK_QUIZ_ATTEMPT",
          quizScope: quizScopeKey(params.attempt.bookId, params.attempt.chapterNumber),
          ...params.attempt,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      },
    },
    {
      Put: {
        TableName: tableName,
        Item: {
          PK: bookUserPk(params.nextQuizState.userId),
          SK: quizStateSk(
            params.nextQuizState.bookId,
            params.nextQuizState.chapterNumber
          ),
          entity: "BOOK_USER_QUIZ_STATE",
          ...params.nextQuizState,
        },
        ConditionExpression:
          "attribute_not_exists(PK) OR attribute_not_exists(attemptsCount) OR attemptsCount = :previousAttemptsCount",
        ExpressionAttributeValues: {
          ":previousAttemptsCount": params.previousAttemptsCount,
        },
      },
    },
  ];

  if (params.nextProgress) {
    transactItems.push({
      Put: {
        TableName: tableName,
        Item: {
          PK: bookUserPk(params.nextProgress.userId),
          SK: progressSk(params.nextProgress.bookId),
          entity: "BOOK_PROGRESS",
          ...params.nextProgress,
        },
      },
    });
  }

  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      })
    );
  } catch (error: unknown) {
    if (
      isConditionalCheckFailed(error) ||
      (error &&
        typeof error === "object" &&
        (error as Record<string, unknown>).name === "TransactionCanceledException")
    ) {
      throw new BookApiError(
        409,
        "quiz_state_conflict",
        "Quiz state changed. Refresh and try again."
      );
    }
    throw error;
  }
}

function parseScenarioScope(value: unknown): "work" | "school" | "personal" {
  if (value === "work" || value === "school" || value === "personal") return value;
  return "personal";
}

export async function getUserEngagement(
  tableName: string,
  userId: string
): Promise<BookUserEngagementItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: engagementSk(),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    points: Math.max(0, readNum(item.points) ?? 0),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function addUserEngagementPoints(
  tableName: string,
  params: { userId: string; deltaPoints: number }
): Promise<BookUserEngagementItem> {
  const safeDelta = Math.max(0, Math.floor(params.deltaPoints));
  const now = nowIso();
  const res = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(params.userId),
        SK: engagementSk(),
      },
      UpdateExpression:
        "SET entity = :entity, userId = :userId, createdAt = if_not_exists(createdAt, :createdAt), updatedAt = :updatedAt ADD points :delta",
      ExpressionAttributeValues: {
        ":entity": "BOOK_USER_ENGAGEMENT",
        ":userId": params.userId,
        ":createdAt": now,
        ":updatedAt": now,
        ":delta": safeDelta,
      },
      ReturnValues: "ALL_NEW",
    })
  );
  const item = res.Attributes ?? {};
  return {
    userId: params.userId,
    points: Math.max(0, readNum(item.points) ?? safeDelta),
    createdAt: readStr(item.createdAt) || now,
    updatedAt: readStr(item.updatedAt) || now,
  };
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

export async function recordRiskEvent(
  tableName: string,
  event: BookRiskEventItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: riskEventPk(event.scope, event.fingerprint),
        SK: riskEventSk(event.createdAt, event.eventType, event.userId),
        entity: "BOOK_RISK_EVENT",
        ...event,
      },
    })
  );
}

export async function listRecentRiskEvents(
  tableName: string,
  params: {
    scope: BookRiskEventItem["scope"];
    fingerprint: string;
    limit?: number;
  }
): Promise<BookRiskEventItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": riskEventPk(params.scope, params.fingerprint),
        ":prefix": "EVENT#",
      },
      ScanIndexForward: false,
      Limit: Math.max(1, Math.min(100, Math.floor(params.limit ?? 40))),
    })
  );

  const items: Array<BookRiskEventItem | null> = (res.Items ?? []).map((item) => {
      const scope =
        item.scope === "device"
          ? "device"
          : item.scope === "network"
            ? "network"
            : item.scope === "network_ua"
              ? "network_ua"
              : null;
      const eventType =
        item.eventType === "onboarding_completed"
          ? "onboarding_completed"
          : item.eventType === "free_unlock_granted"
            ? "free_unlock_granted"
            : null;
      const fingerprint = readStr(item.fingerprint);
      const userId = readStr(item.userId);
      const createdAt = readStr(item.createdAt);
      if (!scope || !eventType || !fingerprint || !userId || !createdAt) return null;
      return {
        scope,
        eventType,
        fingerprint,
        userId,
        createdAt,
        emailVerified: typeof item.emailVerified === "boolean" ? item.emailVerified : undefined,
        deviceId: readStr(item.deviceId),
        metadata: parseRecord(item.metadata),
      } satisfies BookRiskEventItem;
    });
  return items.filter((item): item is BookRiskEventItem => item !== null);
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
): Promise<boolean> {
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
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
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

// ─── License key operations ───────────────────────────────────────────────────

function parseLicenseKeyItem(item: Record<string, unknown>, code: string): LicenseKeyItem | null {
  const status = item.status;
  if (status !== "available" && status !== "redeemed" && status !== "revoked") return null;
  return {
    code: readStr(item.code) || code,
    plan: "PRO",
    validMonths: readNum(item.validMonths) ?? 1,
    status,
    redeemedBy: readStr(item.redeemedBy),
    redeemedAt: readStr(item.redeemedAt),
    createdAt: readStr(item.createdAt) || "",
    note: readStr(item.note),
  };
}

export async function getLicenseKey(
  tableName: string,
  code: string
): Promise<LicenseKeyItem | null> {
  const normalized = code.toUpperCase().trim();
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: licenseKeyPk(normalized),
        SK: licenseKeySk(),
      },
    })
  );
  if (!res.Item) return null;
  return parseLicenseKeyItem(res.Item, normalized);
}

/**
 * Atomically claims a license key for a user and upgrades their entitlement to PRO.
 * Uses a DynamoDB transaction so two concurrent requests cannot both redeem the same key.
 */
export async function redeemLicenseKey(
  tableName: string,
  params: { userId: string; code: string; validMonths: number }
): Promise<void> {
  const now = nowIso();
  const expiresAt = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + params.validMonths);
    return d.toISOString();
  })();
  const normalized = params.code.toUpperCase().trim();

  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            // Mark the key as redeemed — fails if already redeemed or revoked
            Update: {
              TableName: tableName,
              Key: {
                PK: licenseKeyPk(normalized),
                SK: licenseKeySk(),
              },
              UpdateExpression:
                "SET #status = :redeemed, redeemedBy = :userId, redeemedAt = :now, updatedAt = :now",
              ConditionExpression: "#status = :available",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":redeemed": "redeemed",
                ":available": "available",
                ":userId": params.userId,
                ":now": now,
              },
            },
          },
          {
            // Upgrade the user's entitlement to PRO (license-based)
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(params.userId),
                SK: entitlementSk(),
              },
              UpdateExpression: [
                "SET #plan = :pro,",
                "proStatus = :active,",
                "proSource = :licenseSource,",
                "licenseKey = :code,",
                "licenseExpiresAt = :expiresAt,",
                "updatedAt = :now,",
                "freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots),",
                "unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)",
              ].join(" "),
              ExpressionAttributeNames: { "#plan": "plan" },
              ExpressionAttributeValues: {
                ":pro": "PRO",
                ":active": "active",
                ":licenseSource": "license",
                ":code": normalized,
                ":expiresAt": expiresAt,
                ":now": now,
                ":defaultSlots": 2,
                ":emptySet": new Set<string>(),
              },
            },
          },
        ],
      })
    );
  } catch (error: unknown) {
    // If the transaction was cancelled it means the ConditionExpression on the key failed —
    // the key was already redeemed or revoked between our read and this write.
    if (
      error &&
      typeof error === "object" &&
      ((error as Record<string, unknown>).name === "TransactionCanceledException" ||
        (error as Record<string, unknown>).__type === "TransactionCanceledException")
    ) {
      throw new BookApiError(409, "code_already_redeemed", "This license key has already been claimed.");
    }
    throw error;
  }
}

/** Insert a license key record (used by the seed script / admin tooling). */
export async function seedLicenseKey(
  tableName: string,
  key: Omit<LicenseKeyItem, "status"> & { status?: LicenseKeyItem["status"] }
): Promise<void> {
  const normalized = key.code.toUpperCase().trim();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: licenseKeyPk(normalized),
        SK: licenseKeySk(),
        entity: "BOOK_LICENSE_KEY",
        code: normalized,
        plan: "PRO",
        validMonths: key.validMonths,
        status: key.status ?? "available",
        createdAt: key.createdAt,
        note: key.note ?? null,
        updatedAt: key.createdAt,
      },
      // Do not overwrite an already-redeemed key if re-seeding
      ConditionExpression: "attribute_not_exists(PK) OR #status = :available",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":available": "available" },
    })
  );
}
