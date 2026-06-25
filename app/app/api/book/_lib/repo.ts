import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandInput,
  type TransactWriteCommandInput,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { BookApiError, transactionCancellationReasons } from "./errors";
import { isBookCompleted } from "./book-completion-core";
import { paginateQuery } from "./query-pagination-core";
import { buildLicenseEntitlementGrant } from "./license-grant-core";
import { buildIngestionJobUpdate } from "./ingestion-job-update-core";
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
  quizAttemptPkFromQuizStateSk,
  quizAttemptSk,
  quizScopeKey,
  quizStateSk,
  quizStateSkPrefix,
  loopSkPrefix,
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
  emailSuppressionPk,
  emailSuppressionSk,
  trialEndingEmailPk,
  trialEndingEmailSk,
  billingEventPk,
  billingEventSk,
  licenseKeyPk,
  licenseKeySk,
  licenseIndexPk,
  licenseIndexSk,
  accountStatusSk,
  accountStatusChangeSk,
  shareEventSk,
  ttlEpochSeconds,
  RETENTION_DAYS_18_MONTHS,
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
  AccountStatusItem,
  AccountStatusChangeItem,
  AccountStatus,
  BookUserShareEventItem,
} from "./types";
import {
  classifyWebhookClaim,
  leaseExpiryMs,
  leaseTtlEpochSeconds,
  type ExistingWebhookMarker,
} from "./webhook-claim-core";
import {
  buildInteractionTouchUpdate,
  buildQuizPassProgressUpdate,
  classifyQuizOutcomeCancellation,
} from "./progress-write-core";
import { buildRiskEventPointer } from "./erasure-pointers-core";
import {
  buildEntitlementUpdateFromStripe,
  buildDisputeMarkerUpdate,
} from "./stripe-entitlement-write-core";
import {
  buildBookMetaAndCatalogItems,
  planMetaCatalogRollback,
  type MetaCatalogSnapshot,
} from "./ingest-rollback-core";

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

/**
 * Run a DynamoDB Query and follow `LastEvaluatedKey` until the full result set
 * has been read, accumulating every page's `Items`. A single `QueryCommand`
 * returns at most 1MB, so any unbounded full-partition list must paginate or it
 * silently truncates as the partition grows. Mirrors the loop already used in
 * admin-metrics.ts / economy-health.ts / soft-decay.ts.
 *
 * The page-following loop itself lives in `query-pagination-core.ts` (a pure,
 * `server-only`-free seam so it can be unit-tested); this wrapper just supplies
 * `ddbDoc.send`.
 *
 * Pass the same input you would give `QueryCommand` (without
 * `ExclusiveStartKey`); a `Limit`, if supplied, is treated as a per-page hint.
 */
async function queryAllItems(
  input: Omit<QueryCommandInput, "ExclusiveStartKey">
): Promise<Record<string, unknown>[]> {
  return paginateQuery(async (exclusiveStartKey) => {
    const res = await ddbDoc.send(
      new QueryCommand({ ...input, ExclusiveStartKey: exclusiveStartKey })
    );
    return {
      items: res.Items ?? [],
      lastEvaluatedKey: res.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  });
}

export async function listPublishedCatalogItems(tableName: string): Promise<BookCatalogItem[]> {
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": catalogPk(),
      ":prefix": "BOOK#",
    },
    ScanIndexForward: true,
  });
  const out: BookCatalogItem[] = [];
  for (const item of rows) {
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
  // Route through queryAllItems (like listPublishedCatalogItems / listLicenseKeys /
  // listAllUserProgress) so every 1MB page is read. A single QueryCommand returns at
  // most 1MB; this is a full-partition list with no Limit, so without pagination a book
  // that accumulates enough VERSION# items past one page silently drops the oldest
  // versions — which would break the ingestion idempotency check (a missed packageId
  // match allocates a duplicate version and orphans its content prefix). queryAllItems
  // continues each page from LastEvaluatedKey, so ScanIndexForward:false (newest-first)
  // order is preserved across page boundaries.
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookPk(bookId),
      ":prefix": "VERSION#",
    },
    ScanIndexForward: false,
  });
  const out: BookVersionItem[] = [];
  for (const item of rows) {
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
  const { metaItem, catalogItem } = buildBookMetaAndCatalogItems(params, updatedAt);

  // META and CATALOG carry the SAME version pointer and MUST move together.
  // Two independent PutCommands let META advance while CATALOG threw (throttle /
  // transient), diverging the pair and — on an ingest rollback — stranding the
  // book on a deleted version. One TransactWrite makes the pair atomic. (B5.)
  await ddbDoc.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: tableName, Item: metaItem } },
        { Put: { TableName: tableName, Item: catalogItem } },
      ],
    })
  );
}

/**
 * Snapshot the raw META + CATALOG rows for a book before an ingest advances
 * their version pointer, so an ingest rollback can restore the previous pointer
 * (or delete a freshly-created one). A side is `null` when no such row exists.
 */
export async function getMetaCatalogSnapshot(
  tableName: string,
  bookId: string
): Promise<MetaCatalogSnapshot> {
  const [metaRes, catalogRes] = await Promise.all([
    ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: bookPk(bookId), SK: bookMetaSk() },
      })
    ),
    ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: catalogPk(), SK: catalogSk(bookId) },
      })
    ),
  ]);
  return {
    meta: (metaRes.Item as Record<string, unknown> | undefined) ?? null,
    catalog: (catalogRes.Item as Record<string, unknown> | undefined) ?? null,
  };
}

/**
 * Undo an ingest's META/CATALOG pointer advance using a pre-write snapshot.
 *
 * - `wrotePointer === false`: the upsert never ran -> nothing to revert.
 * - prior rows existed: put each prior row back exactly (a side that did NOT
 *   exist before is deleted so the pair returns to its exact prior shape).
 * - neither existed: the ingest created the very first pointer for this book, so
 *   both rows are deleted (returning the table to its pre-ingest state) rather
 *   than left pointing at the now-deleted version.
 *
 * Best-effort by design: the caller invokes this from a rollback `catch`, so a
 * transient failure here is swallowed (the original error is what propagates).
 */
export async function restoreOrDeleteMetaCatalog(
  tableName: string,
  bookId: string,
  snapshot: MetaCatalogSnapshot,
  wrotePointer: boolean
): Promise<void> {
  const plan = planMetaCatalogRollback(snapshot, wrotePointer);
  if (plan.kind === "noop") return;

  const metaKey = { PK: bookPk(bookId), SK: bookMetaSk() };
  const catalogKey = { PK: catalogPk(), SK: catalogSk(bookId) };

  if (plan.kind === "delete") {
    await Promise.all([
      ddbDoc.send(new DeleteCommand({ TableName: tableName, Key: metaKey })),
      ddbDoc.send(new DeleteCommand({ TableName: tableName, Key: catalogKey })),
    ]);
    return;
  }

  // restore: put back each prior row, delete the side that had no prior.
  await Promise.all([
    plan.meta
      ? ddbDoc.send(new PutCommand({ TableName: tableName, Item: plan.meta }))
      : ddbDoc.send(new DeleteCommand({ TableName: tableName, Key: metaKey })),
    plan.catalog
      ? ddbDoc.send(new PutCommand({ TableName: tableName, Item: plan.catalog }))
      : ddbDoc.send(new DeleteCommand({ TableName: tableName, Key: catalogKey })),
  ]);
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
  // Build the update dynamically so a partial transition (e.g. RUNNING -> FAILED,
  // which passes no bookId) does not clobber a previously stored bookId/details/
  // errorReportKey to NULL. Only fields the caller actually supplied are written.
  // Spec + truth-table: ingestion-job-update-core.ts.
  const update = buildIngestionJobUpdate({
    status: params.status,
    updatedAt: ts,
    details: params.details,
    errorReportKey: params.errorReportKey,
    bookId: params.bookId,
  });
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: ingestJobPk(jobId),
        SK: ingestJobSk(),
      },
      UpdateExpression: update.UpdateExpression,
      ExpressionAttributeNames: update.ExpressionAttributeNames,
      ExpressionAttributeValues: update.ExpressionAttributeValues,
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
          : item.proSource === "gift_code"
            ? "gift_code"
            : item.proSource === "admin"
              ? "admin"
              : undefined;
  const licenseKey = readStr(item.licenseKey);
  const licenseExpiresAt = readStr(item.licenseExpiresAt);
  const currentPeriodEnd = readStr(item.currentPeriodEnd);

  // Compute effective plan for time-limited grants inline. license expires via
  // licenseExpiresAt; flow_points and gift_code passes expire via
  // currentPeriodEnd. (stripe is driven by webhooks and never expired here.)
  const storedPlan = item.plan === "PRO" ? "PRO" : "FREE";
  const grantExpired =
    storedPlan === "PRO" &&
    ((proSource === "license" &&
      licenseExpiresAt != null &&
      new Date(licenseExpiresAt) < new Date()) ||
      ((proSource === "flow_points" || proSource === "gift_code") &&
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
    cancelAtPeriodEnd: item.cancelAtPeriodEnd === true,
    licenseKey,
    licenseExpiresAt,
    lastStripeEventAt: readNum(item.lastStripeEventAt),
    updatedAt: readStr(item.updatedAt) || "",
  };
}

function isNullSetValidationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { name?: unknown }).name === "ValidationException";
}

export async function reserveBookEntitlement(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    freeSlotsDefault: number;
  }
): Promise<BookUserEntitlement> {
  try {
    return await reserveBookEntitlementOnce(tableName, params);
  } catch (error: unknown) {
    // C1 / H12 self-heal: while convertEmptyValues:true was deployed, an
    // entitlement initialized before the user's first unlock (e.g. by
    // attachStripeCustomerIfAbsent at checkout) persisted unlockedBookIds as a
    // NULL attribute — the SDK marshalled an empty `new Set()` to {NULL:true}.
    // The `ADD unlockedBookIds` below then fails with a ValidationException (ADD
    // onto a NULL-typed attribute) instead of unlocking — the exact first-unlock
    // outage H12 targeted, still latent for the already-corrupted cohort. Heal it
    // once: drop the NULL attribute (conditionally, so a genuine set is never
    // touched) and retry. A NULL unlockedBookIds is semantically an empty set (no
    // real unlocks), so removing it loses no data.
    if (!isNullSetValidationError(error)) throw error;
    await ddbDoc
      .send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(params.userId), SK: entitlementSk() },
          UpdateExpression: "REMOVE unlockedBookIds",
          ConditionExpression: "attribute_type(unlockedBookIds, :nullType)",
          ExpressionAttributeValues: { ":nullType": "NULL" },
        })
      )
      .catch((healErr: unknown) => {
        // Not actually NULL (a concurrent writer healed it, or the error was
        // unrelated) — let the retry below surface the real failure.
        if (!isConditionalCheckFailed(healErr)) throw healErr;
      });
    return await reserveBookEntitlementOnce(tableName, params);
  }
}

async function reserveBookEntitlementOnce(
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
          "(#plan = :proPlan AND (attribute_not_exists(proSource) OR proSource = :stripeSource OR proSource = :adminSource OR (proSource = :licenseSource AND licenseExpiresAt >= :now) OR (proSource = :flowPointsSource AND currentPeriodEnd >= :now) OR (proSource = :giftSource AND currentPeriodEnd >= :now)))",
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
          ":adminSource": "admin",
          ":licenseSource": "license",
          ":flowPointsSource": "flow_points",
          ":giftSource": "gift_code",
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
            : item.proSource === "gift_code"
              ? "gift_code"
              : item.proSource === "admin"
                ? "admin"
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

/**
 * Persist an interaction "touch" of a started reader's progress (book opened /
 * chapter navigated / a reading-session heartbeat).
 *
 * This is a FIELD-SCOPED, CONDITIONAL update — NOT a full-object Put. It SETs only
 * the activity timestamps and bumps `currentChapterNumber` upward, and it NEVER writes
 * the gating fields (`unlockedThroughChapterNumber` / `completedChapters` /
 * `bestScoreByChapter`). The previous full-object Put re-wrote those stale, snapshot-read
 * values, so a touch racing a concurrent quiz-pass (every quiz submit calls
 * ensureUserBookStarted first) could roll back a freshly-completed chapter or unlock.
 *
 * The `currentChapterNumber` max-guard is enforced by the update's ConditionExpression;
 * a lost cursor race surfaces as ConditionalCheckFailed and is swallowed as a benign
 * no-op (the row is already at least as advanced), mirroring repointProgressVersion /
 * createProgressIfMissing. Pass `progress` as the already-touched row (the caller's
 * touchProgressForInteraction output); only its cursor + timestamps are read here.
 */
export async function upsertUserProgress(
  tableName: string,
  progress: BookUserProgress
): Promise<void> {
  const touchedAt = progress.updatedAt || nowIso();
  const spec = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: progress.currentChapterNumber,
    lastOpenedAt: progress.lastOpenedAt ?? touchedAt,
    lastActiveAt: progress.lastActiveAt ?? touchedAt,
    updatedAt: touchedAt,
  });
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(progress.userId),
          SK: progressSk(progress.bookId),
        },
        UpdateExpression: spec.UpdateExpression,
        ConditionExpression: spec.ConditionExpression,
        ExpressionAttributeNames: spec.ExpressionAttributeNames,
        ExpressionAttributeValues: spec.ExpressionAttributeValues,
      })
    );
  } catch (error: unknown) {
    // Lost the cursor max-guard to a concurrent (more-advanced) writer → no-op.
    if (isConditionalCheckFailed(error)) return;
    throw error;
  }
}

/**
 * Persist a quiz-pass progress mutation safely under concurrency. `nextProgress` is the
 * full recomputed row from buildProgressAfterQuizPass; `expectedRev` is the progressRev
 * read in the same snapshot. The write is a field-scoped UpdateCommand guarded by the
 * optimistic progressRev check, so a stale write can't clobber a concurrently-advanced
 * row — instead it surfaces as ConditionalCheckFailed and the caller recomputes + retries.
 *
 * Returns true when applied, false when the optimistic guard lost (stale write).
 */
async function writeQuizPassProgress(
  tableName: string,
  params: { nextProgress: BookUserProgress; expectedRev: number }
): Promise<boolean> {
  const spec = buildQuizPassProgressUpdate({
    nextProgress: params.nextProgress,
    expectedRev: params.expectedRev,
    nextRev: params.expectedRev + 1,
  });
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(params.nextProgress.userId),
          SK: progressSk(params.nextProgress.bookId),
        },
        UpdateExpression: spec.UpdateExpression,
        ConditionExpression: spec.ConditionExpression,
        ExpressionAttributeNames: spec.ExpressionAttributeNames,
        ExpressionAttributeValues: spec.ExpressionAttributeValues,
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
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

/**
 * PAR-2 — advance a started reader's pinned version fields (pinnedBookVersion,
 * contentPrefix, manifestKey) to a newer published version, leaving every other
 * progress field untouched. A field-scoped, conditional `UpdateCommand` (rather
 * than a full-item Put) guarantees this can never:
 *   - clobber a concurrent interaction write (lastOpenedAt / currentChapterNumber
 *     / a quiz outcome) — those fields are simply not in the update, and
 *   - downgrade a row another request advanced further — the
 *     `pinnedBookVersion = :expected` guard makes a stale upgrade a no-op.
 * This is sound ONLY because the caller upgrades exclusively under the
 * prefix-identity gate (see version-upgrade-core.ts), where the chapter-number
 * remap is the identity and no progress number changes. If that gate is ever
 * relaxed to renumber chapters, this must become a full-row write.
 *
 * Returns true when applied, false when the guard no longer holds (already
 * advanced / changed concurrently). Throws on unexpected DDB errors so the
 * caller's fail-safe can keep the reader on their existing content.
 */
export async function repointProgressVersion(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    expectedPinnedVersion: number;
    pinnedBookVersion: number;
    contentPrefix: string;
    manifestKey: string;
    updatedAt: string;
  }
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(params.userId),
          SK: progressSk(params.bookId),
        },
        UpdateExpression:
          "SET pinnedBookVersion = :version, contentPrefix = :prefix, manifestKey = :manifestKey, updatedAt = :updatedAt",
        ConditionExpression: "attribute_exists(PK) AND pinnedBookVersion = :expected",
        ExpressionAttributeValues: {
          ":version": params.pinnedBookVersion,
          ":prefix": params.contentPrefix,
          ":manifestKey": params.manifestKey,
          ":updatedAt": params.updatedAt,
          ":expected": params.expectedPinnedVersion,
        },
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

export async function getUserProgress(
  tableName: string,
  userId: string,
  bookId: string,
  options?: { consistentRead?: boolean }
): Promise<BookUserProgress | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: progressSk(bookId),
      },
      // Default stays eventually-consistent (every existing caller). The post-create
      // re-read in ensureUserBookStarted opts into a strongly-consistent read so a
      // just-written BOOK_PROGRESS row is guaranteed visible (A10 init-500 race).
      ConsistentRead: options?.consistentRead === true ? true : undefined,
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
    progressRev: readNum(item.progressRev) ?? 0,
    updatedAt: readStr(item.updatedAt) || "",
    createdAt: readStr(item.createdAt) || "",
  };
}

export async function listAllUserProgress(
  tableName: string,
  userId: string
): Promise<BookUserProgress[]> {
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "PROGRESS#",
    },
    ScanIndexForward: false,
  });
  const out: BookUserProgress[] = [];
  for (const item of rows) {
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
      progressRev: readNum(item.progressRev) ?? 0,
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

/**
 * Mark a quiz state's loop pipeline as fully completed. Used by the quiz
 * submit route after streak/tier/achievement/spark all run cleanly. The
 * absence of this field on a `passed: true` record means the pipeline
 * either crashed mid-flight or had a partial failure and should be retried.
 */
export async function markLoopPipelineCompleted(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
  completedAt: string
): Promise<void> {
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: quizStateSk(bookId, chapterNumber),
      },
      UpdateExpression:
        "SET loopPipelineCompletedAt = :ts, updatedAt = :ts",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: {
        ":ts": completedAt,
      },
    })
  );
}

/**
 * Clear ALL per-chapter learning state for one book under a user, across THREE
 * key spaces:
 *   - `BOOK_USER_QUIZ_STATE` (`QUIZSTATE#<bookId>#…`) — user partition
 *   - `BOOK_USER_LOOP`       (`LOOP#<bookId>#…`)      — user partition
 *   - `BOOK_QUIZ_ATTEMPT`    (`QUIZATTEMPT#<userId>#<bookId>#<ch>`) — its OWN
 *     per-chapter partition, NOT under the user partition.
 *
 * The per-book progress reset (state/reset/route.ts) rewinds the canonical
 * `BOOK_PROGRESS` gating entitlement to chapter 1, but the quiz-submit route
 * reconstructs the chapter's quiz state as
 * `persistedQuizState ?? buildQuizStateFromAttempts({ attempts })` and then
 * short-circuits on `quizState?.passed` BEFORE the only code path that raises
 * `unlockedThroughChapterNumber` (`buildProgressAfterQuizPass`). So clearing
 * only the QUIZSTATE# row is NOT enough: with the row gone, the fallback rebuilds
 * `passed:true` from the SURVIVING QUIZATTEMPT# rows (an old passing attempt),
 * the short-circuit fires, and the reader stays permanently locked at chapter 1.
 * We must also delete the attempt partitions so the fallback has nothing to
 * reconstruct a stale pass from — the next submit is then a genuine fresh attempt.
 *
 * The submit route writes a quiz-state row alongside every recorded attempt, so
 * the QUIZSTATE# SKs we already query enumerate exactly the chapters that have an
 * attempt partition; we rebuild each `quizAttemptPk` from them
 * (`quizAttemptPkFromQuizStateSk`) and query+delete those partitions too.
 *
 * Idempotent: deleting an absent key is a no-op, so a retry (or a never-started
 * book) is safe. Returns the count actually deleted and the count that survived
 * all BatchWrite retries (callers should surface a non-zero `unprocessed`).
 */
export async function resetUserBookLearningState(
  tableName: string,
  userId: string,
  bookId: string
): Promise<{ deleted: number; unprocessed: number }> {
  const pk = bookUserPk(userId);
  // Two separate begins_with Queries, not one OR'd condition: a DynamoDB
  // KeyConditionExpression permits only a SINGLE sort-key condition, and the
  // QUIZSTATE# / LOOP# prefixes are disjoint ranges anyway. Each is a tight
  // range scan over the user's own partition.
  const [quizRows, loopRows] = await Promise.all([
    queryAllItems({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": quizStateSkPrefix(bookId) },
    }),
    queryAllItems({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": loopSkPrefix(bookId) },
    }),
  ]);

  const keys: { PK: string; SK: string }[] = [];
  for (const item of [...quizRows, ...loopRows]) {
    const sk = readStr(item.SK);
    if (sk) keys.push({ PK: pk, SK: sk });
  }

  // Derive the quiz-ATTEMPT partitions to clear from the quiz-state SKs (one per
  // chapter that has any attempt). Each lives in its own partition, so we Query
  // each one for its full key set and add those (PK, SK) pairs to the same
  // BatchWrite delete. Without this the reset leaves passing attempts behind and
  // the submit fallback reconstructs passed:true — A5's root cause.
  const attemptPks = new Set<string>();
  for (const item of quizRows) {
    const sk = readStr(item.SK);
    if (!sk) continue;
    const attemptPk = quizAttemptPkFromQuizStateSk(userId, sk);
    if (attemptPk) attemptPks.add(attemptPk);
  }
  if (attemptPks.size) {
    const attemptRowGroups = await Promise.all(
      [...attemptPks].map((attemptPk) =>
        queryAllItems({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": attemptPk },
        })
      )
    );
    for (const rows of attemptRowGroups) {
      for (const item of rows) {
        const itemPk = readStr(item.PK);
        const sk = readStr(item.SK);
        if (itemPk && sk) keys.push({ PK: itemPk, SK: sk });
      }
    }
  }

  let deleted = 0;
  let unprocessed = 0;
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    let requestItems: Record<string, { DeleteRequest: { Key: { PK: string; SK: string } } }[]> = {
      [tableName]: chunk.map((Key) => ({ DeleteRequest: { Key } })),
    };
    let remaining = chunk.length;
    for (let attempt = 0; attempt < 4; attempt++) {
      const pending = requestItems[tableName]?.length ?? 0;
      if (pending === 0) {
        remaining = 0;
        break;
      }
      const res = await ddbDoc.send(
        new BatchWriteCommand({ RequestItems: requestItems })
      );
      const leftover = (res.UnprocessedItems ?? {}) as typeof requestItems;
      remaining = leftover[tableName]?.length ?? 0;
      deleted += pending - remaining;
      requestItems = remaining ? leftover : { [tableName]: [] };
    }
    unprocessed += remaining;
  }

  return { deleted, unprocessed };
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

/**
 * Atomically record the outcome of a quiz attempt: the attempt row, the per-chapter
 * quiz-state (guarded by the attemptsCount optimistic check), and — on a pass — the
 * canonical PROGRESS#<bookId> mutation.
 *
 * Concurrency safety (prog-write cluster):
 *  - The progress mutation is an `Update` action guarded by an optimistic `progressRev`
 *    check (NOT a blind full-object Put), so a concurrent writer's completed-chapter /
 *    unlock can't be rolled back.
 *  - A failed TransactWrite is classified by its index-aligned CancellationReasons
 *    (classifyQuizOutcomeCancellation) rather than blanket-mapped to quiz_state_conflict:
 *      • attempt(0) / quiz-state(1) condition failed → real 409 quiz_state_conflict.
 *      • progress-rev(2) condition failed → re-read progress, recompute nextProgress
 *        via `recomputeNextProgress`, and retry (the pass is NOT dropped).
 *      • a transient cancel (TransactionConflict / throttle / capacity) → retry with
 *        backoff, then a retriable 503 — never a silent quiz_state_conflict.
 */
export async function recordQuizAttemptOutcome(
  tableName: string,
  params: {
    previousAttemptsCount: number;
    attempt: QuizAttemptItem;
    nextQuizState: BookUserQuizStateItem;
    nextProgress?: BookUserProgress;
    // Recompute nextProgress against a freshly-read row when the optimistic
    // progressRev guard loses a race. Defaults to keeping the originally-computed row
    // (the snapshot merge already includes this chapter), which is still correct but a
    // recompute keeps a concurrent writer's other completed chapters.
    recomputeNextProgress?: (freshProgress: BookUserProgress) => BookUserProgress;
  }
): Promise<void> {
  const MAX_ATTEMPTS = 4;
  // `expectedRev` for the progress guard is the rev carried by the row the caller built
  // nextProgress from (0 for legacy rows that never had one).
  let expectedRev = params.nextProgress?.progressRev ?? 0;
  let nextProgress = params.nextProgress;

  for (let attemptNo = 0; attemptNo < MAX_ATTEMPTS; attemptNo += 1) {
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

    if (nextProgress) {
      const spec = buildQuizPassProgressUpdate({
        nextProgress,
        expectedRev,
        nextRev: expectedRev + 1,
      });
      // Index 2 in transactItems — must match QUIZ_OUTCOME_TX_INDEX.progress.
      transactItems.push({
        Update: {
          TableName: tableName,
          Key: {
            PK: bookUserPk(nextProgress.userId),
            SK: progressSk(nextProgress.bookId),
          },
          UpdateExpression: spec.UpdateExpression,
          ConditionExpression: spec.ConditionExpression,
          ExpressionAttributeNames: spec.ExpressionAttributeNames,
          ExpressionAttributeValues: spec.ExpressionAttributeValues,
        },
      });
    }

    try {
      await ddbDoc.send(new TransactWriteCommand({ TransactItems: transactItems }));
      return;
    } catch (error: unknown) {
      const klass = classifyQuizOutcomeCancellation(error);

      if (klass === "quiz_state_conflict") {
        throw new BookApiError(
          409,
          "quiz_state_conflict",
          "Quiz state changed. Refresh and try again."
        );
      }

      const isLastAttempt = attemptNo === MAX_ATTEMPTS - 1;

      if (klass === "progress_conflict") {
        // The optimistic progressRev guard lost: another writer advanced the row in
        // between. Re-read, recompute the merge against the fresh row, and retry so we
        // never drop this pass nor clobber the concurrent writer's chapters.
        if (isLastAttempt || !nextProgress) {
          throw new BookApiError(
            503,
            "progress_write_contended",
            "Saving your progress hit heavy contention. Please try again."
          );
        }
        const fresh = await getUserProgress(
          tableName,
          nextProgress.userId,
          nextProgress.bookId
        );
        if (!fresh) {
          // The row vanished (erasure?) — fall back to the originally-computed row at
          // rev 0 for one more attempt rather than dropping the pass.
          expectedRev = 0;
          continue;
        }
        expectedRev = fresh.progressRev ?? 0;
        nextProgress = params.recomputeNextProgress
          ? params.recomputeNextProgress(fresh)
          : { ...nextProgress, progressRev: expectedRev };
        continue;
      }

      if (klass === "transient") {
        if (isLastAttempt) {
          throw new BookApiError(
            503,
            "quiz_write_contended",
            "Saving your quiz result hit heavy contention. Please try again."
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 25 * (attemptNo + 1)));
        continue;
      }

      // not_a_cancellation → an unexpected error: rethrow as-is.
      throw error;
    }
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

/**
 * Outcome of a claim attempt on a Stripe-webhook event lease (#10):
 *  - "claim"     → no prior marker existed; this worker owns it and must process.
 *  - "reclaim"   → a prior PROCESSING lease had expired (crash/timeout); this
 *                  worker took over and must process.
 *  - "duplicate" → the event is DONE, or a non-expired PROCESSING lease is held
 *                  by another in-flight worker; this worker must NOT process.
 */
export type StripeWebhookClaim = "claimed" | "done" | "in_progress";

/**
 * Claim the exclusive right to process a Stripe-webhook event BEFORE running any
 * side effects (#10). Conditionally writes a PROCESSING marker that only one of
 * N parallel redeliveries can win:
 *
 *   - succeeds (claim) iff no marker exists, OR
 *   - succeeds (reclaim) iff the existing marker is PROCESSING with an EXPIRED
 *     lease (a prior attempt crashed/timed out before completing), OR
 *   - fails (duplicate) iff the marker is DONE or a live PROCESSING lease is held.
 *
 * The condition is expressed atomically so the DynamoDB write itself is the
 * race arbiter — exactly one concurrent claimer wins. On a ConditionalCheck
 * failure we re-read the marker once to distinguish DONE (true idempotent
 * duplicate) from a live PROCESSING lease (another worker) — both map to
 * "duplicate" for the caller, but the read keeps the decision auditable.
 *
 * CRASH SAFETY: on a processing failure we deliberately do NOT call
 * completeStripeWebhookEvent, so the marker stays PROCESSING with a finite TTL.
 * Once the lease expires a Stripe retry reclaims and reprocesses — a crash can
 * never permanently mark an event processed.
 *
 * LEASE >> RUNTIME INVARIANT: the default 900s lease is far longer than the
 * server Lambda's 30s timeout, so a lease can only expire AFTER its worker is
 * dead. A reclaim therefore never races a still-running original worker, and a
 * "zombie" completing another worker's lease is structurally impossible. The
 * webhook side effects are independently idempotent anyway (guarded entitlement
 * upserts, deterministic billing-event SKs), so even a pathological overlap
 * corrupts nothing.
 */
export async function claimStripeWebhookEvent(
  tableName: string,
  eventId: string,
  eventType: string,
  leaseSeconds = 900
): Promise<StripeWebhookClaim> {
  const nowMs = Date.now();
  const leaseExpiresAt = leaseExpiryMs(nowMs, leaseSeconds);
  const ttl = leaseTtlEpochSeconds(nowMs, leaseSeconds);
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
          status: "PROCESSING",
          leaseExpiresAt,
          claimedAt: nowIso(),
          ttl,
        },
        // Win the claim iff there is no marker, OR the existing one is a
        // PROCESSING lease that has already expired (strict `<`, so
        // exactly-at-expiry still belongs to the holder). A DONE marker (no
        // `leaseExpiresAt`) or a live PROCESSING lease fails the condition.
        ConditionExpression:
          "attribute_not_exists(PK) OR (#status = :processing AND leaseExpiresAt < :now)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":processing": "PROCESSING", ":now": nowMs },
      })
    );
    // The conditional Put won (a fresh claim or a reclaim of an expired lease) —
    // we own the lease and must run the side effects.
    return "claimed";
  } catch (error: unknown) {
    if (!isConditionalCheckFailed(error)) throw error;
    // The conditional Put failed: the marker is DONE or a live PROCESSING lease.
    // Re-read once and classify so we acknowledge (2xx) ONLY a genuinely-DONE
    // event. A live (or just-released) PROCESSING lease → "in_progress": the
    // route must return non-2xx so Stripe RETRIES — acking here would permanently
    // drop an event whose first delivery failed mid-processing.
    const existing = await ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: webhookPk(), SK: webhookSk(eventId) },
        ProjectionExpression: "#status, leaseExpiresAt",
        ExpressionAttributeNames: { "#status": "status" },
      })
    );
    return classifyWebhookClaim(
      existing.Item as ExistingWebhookMarker | undefined,
      Date.now(),
      leaseSeconds * 1000
    ) === "done"
      ? "done"
      : "in_progress";
  }
}

/**
 * Mark a successfully-processed webhook event DONE and REMOVE its TTL so the
 * idempotency marker is retained forever (#10). Called only after ALL side
 * effects succeed. Uses an UpdateCommand (not a Put) so the existing PROCESSING
 * item — which this worker claimed — is flipped in place.
 */
export async function completeStripeWebhookEvent(
  tableName: string,
  eventId: string
): Promise<void> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: webhookPk(), SK: webhookSk(eventId) },
        // SET status=DONE + completedAt, and REMOVE ttl + leaseExpiresAt so the
        // DONE marker is permanent (no TTL sweep) and unambiguously terminal.
        UpdateExpression: "SET #status = :done, completedAt = :now REMOVE #ttl, leaseExpiresAt",
        ExpressionAttributeNames: { "#status": "status", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":done": "DONE", ":now": nowIso(), ":processing": "PROCESSING" },
        // Defense-in-depth: only flip a marker that is STILL PROCESSING, so an
        // already-DONE or swept marker is a no-op rather than a clobber. The
        // PRIMARY guarantee that this worker still holds the lease is the
        // lease(900s) >> ServerFn timeout(30s) invariant (a reclaim can't race a
        // live worker) — this condition does not arbitrate concurrent holders.
        ConditionExpression: "attribute_exists(PK) AND #status = :processing",
      })
    );
  } catch (error: unknown) {
    // Lost a benign race (already DONE or swept) — nothing to complete.
    if (!isConditionalCheckFailed(error)) throw error;
  }
}

/**
 * Best-effort: drop OUR PROCESSING marker after a webhook side-effect failure so
 * a Stripe retry can re-claim and reprocess IMMEDIATELY rather than waiting out
 * the full lease. Conditional on PROCESSING, so a DONE marker (which must persist
 * forever for idempotency) is never deleted; a benign conditional miss (already
 * DONE, swept, or never written) is swallowed.
 */
export async function releaseStripeWebhookClaim(
  tableName: string,
  eventId: string
): Promise<void> {
  try {
    await ddbDoc.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK: webhookPk(), SK: webhookSk(eventId) },
        ConditionExpression: "#status = :processing",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":processing": "PROCESSING" },
      })
    );
  } catch (error: unknown) {
    if (!isConditionalCheckFailed(error)) throw error;
  }
}

/**
 * Atomically claim the right to send the transactional "trial ends soon" email
 * for a (customer, trial_end) pair. Returns true exactly once: the first caller
 * wins via a ConditionExpression, every redelivery loses and gets false (skip
 * the send). This prevents duplicate pre-charge notices when the
 * customer.subscription.trial_will_end webhook is retried after a successful
 * send but a later step (completeStripeWebhookEvent / metrics) fails (L12).
 */
export async function markTrialEndingEmailSent(
  tableName: string,
  customerId: string,
  trialEndUnix: number
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: trialEndingEmailPk(customerId),
          SK: trialEndingEmailSk(trialEndUnix),
          entity: "BOOK_TRIAL_ENDING_EMAIL",
          customerId,
          trialEndUnix,
          createdAt: nowIso(),
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

/**
 * Release a trial-ending-email claim taken by {@link markTrialEndingEmailSent}
 * when the send did NOT succeed, so a later Stripe redelivery of
 * trial_will_end can re-attempt the (card-network-required) pre-charge notice
 * instead of being permanently suppressed by the dedup marker. Best-effort:
 * a failed release just leaves the marker (the pre-fix behavior). Mirrors
 * releaseStripeWebhookClaim's release-on-failure discipline (L12).
 */
export async function releaseTrialEndingEmailClaim(
  tableName: string,
  customerId: string,
  trialEndUnix: number
): Promise<void> {
  try {
    await ddbDoc.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          PK: trialEndingEmailPk(customerId),
          SK: trialEndingEmailSk(trialEndUnix),
        },
      })
    );
  } catch {
    // Best-effort — leaving the marker is the safe-ish pre-fix default.
  }
}

// ── Email suppression (bounce/complaint deliverability) ───────────────────────

export type EmailSuppressionRecord = {
  email: string;
  reason: "bounce" | "complaint";
  subtype?: string;
  source?: string;
  createdAt: string;
};

/** True if the address has been suppressed by a hard bounce or complaint. */
export async function isEmailSuppressed(
  tableName: string,
  email: string
): Promise<boolean> {
  if (!email) return false;
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: emailSuppressionPk(email), SK: emailSuppressionSk() },
      ProjectionExpression: "email",
    })
  );
  return !!res.Item;
}

export async function getEmailSuppression(
  tableName: string,
  email: string
): Promise<EmailSuppressionRecord | null> {
  if (!email) return null;
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: emailSuppressionPk(email), SK: emailSuppressionSk() },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    email: readStr(item.email) || email.trim().toLowerCase(),
    reason: readStr(item.reason) === "complaint" ? "complaint" : "bounce",
    subtype: readStr(item.subtype) || undefined,
    source: readStr(item.source) || undefined,
    createdAt: readStr(item.createdAt) || "",
  };
}

/** Add or refresh a suppression record (used by ops/admin tooling and tests). */
export async function putEmailSuppression(
  tableName: string,
  params: { email: string; reason: "bounce" | "complaint"; subtype?: string; source?: string }
): Promise<void> {
  const email = params.email.trim().toLowerCase();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: emailSuppressionPk(email),
        SK: emailSuppressionSk(),
        entity: "BOOK_EMAIL_SUPPRESSION",
        email,
        reason: params.reason,
        subtype: params.subtype,
        source: params.source,
        createdAt: nowIso(),
      },
    })
  );
}

export type BillingEventKind = "refund" | "dispute";

export type BillingEventRecord = {
  kind: BillingEventKind;
  /** Stripe object id (refund id or dispute id) — also the idempotency key. */
  eventId: string;
  userId: string | null;
  stripeCustomerId: string | null;
  chargeId: string | null;
  amountCents: number;
  currency: string;
  reason: string | null;
  /** Refund/dispute status (e.g. "refunded", "needs_response", "won", "lost"). */
  status: string | null;
  /** ISO timestamp from the Stripe object's `created`. */
  createdAt: string;
};

/**
 * Persist a refund or dispute (chargeback) as a durable, append-only billing
 * event for the admin finance reports. Idempotent: the SK embeds the Stripe
 * object id + its created timestamp, so webhook redelivery overwrites the same
 * item rather than duplicating. The ConditionExpression hardens this against a
 * redelivery that computes a different fallback timestamp (e.g. a dispute with a
 * missing `created`): a second Put for an already-recorded SK is a benign no-op
 * instead of a duplicate finance row. Callers should pass a deterministic
 * createdAt (the Stripe object's `created`) so the SK is stable across retries.
 */
export async function recordBillingEvent(
  tableName: string,
  e: BillingEventRecord
): Promise<void> {
  const skKind = e.kind === "refund" ? "REFUND" : "DISPUTE";
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          // no TTL — retained for legal/fraud/compliance (finance audit: refunds & disputes)
          PK: billingEventPk(),
          SK: billingEventSk(skKind, e.createdAt, e.eventId),
          entity: "BOOK_BILLING_EVENT",
          kind: e.kind,
          eventId: e.eventId,
          userId: e.userId,
          stripeCustomerId: e.stripeCustomerId,
          chargeId: e.chargeId,
          amountCents: e.amountCents,
          currency: e.currency,
          reason: e.reason,
          status: e.status,
          createdAt: e.createdAt,
        },
        // Preserve chronological-Query ordering (the SK still embeds createdAt)
        // while guaranteeing a webhook redelivery can never create a second row
        // for an already-recorded event.
        ConditionExpression: "attribute_not_exists(SK)",
      })
    );
  } catch (error: unknown) {
    // Already recorded (idempotent redelivery) — not an error.
    if (isConditionalCheckFailed(error)) return;
    throw error;
  }
}

/** List the most recent refund or dispute events (newest first) for admin reports. */
export async function listRecentBillingEvents(
  tableName: string,
  kind: BillingEventKind,
  limit: number
): Promise<BillingEventRecord[]> {
  const skKind = kind === "refund" ? "REFUND" : "DISPUTE";
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": billingEventPk(),
        ":prefix": `${skKind}#`,
      },
      ScanIndexForward: false, // newest first
      Limit: limit,
    })
  );
  return (res.Items ?? []).map((item) => ({
    kind,
    eventId: readStr(item.eventId) ?? "",
    userId: readStr(item.userId) ?? null,
    stripeCustomerId: readStr(item.stripeCustomerId) ?? null,
    chargeId: readStr(item.chargeId) ?? null,
    amountCents: readNum(item.amountCents) ?? 0,
    currency: readStr(item.currency) ?? "",
    reason: readStr(item.reason) ?? null,
    status: readStr(item.status) ?? null,
    createdAt: readStr(item.createdAt) ?? "",
  }));
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
    proSource?: "stripe";
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    subscriptionInterval?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    // Billing intelligence (optional)
    billingCountry?: string;
    billingCurrency?: string;
    subscriptionAmountCents?: number;
    cardBrand?: string;
    cardCountry?: string;
    lastInvoiceAmountCents?: number;
    lastInvoiceCurrency?: string;
    lastInvoicePaidAt?: string;
    failedPaymentLastReason?: string;
    // Sticky chargeback marker. Set true when charge.dispute.created revokes
    // access so a stale/redelivered PRO-activation event (invoice.paid,
    // customer.subscription.*) cannot silently re-grant Pro to a user who
    // reversed payment. Cleared (true → removed) on charge.dispute.closed with
    // status="won". A PRO-activation write is refused while it is present.
    setDisputeOpen?: boolean;
    clearDisputeOpen?: boolean;
    // Stripe webhook envelope `event.created` (epoch seconds). Stamped as the
    // entitlement's lastStripeEventAt high-water mark and used to reject
    // out-of-order (reordered/retried) Stripe events. See
    // stripe-entitlement-write-core.ts for the ordering invariant.
    stripeEventCreatedAt?: number;
  }
): Promise<void> {
  // All UpdateExpression / ConditionExpression building lives in the pure
  // stripe-entitlement-write-core module (unit-tested without the AWS SDK).
  // Notably it adds the event-ordering guard (lastStripeEventAt) that rejects
  // out-of-order/reordered Stripe events.
  const built = buildEntitlementUpdateFromStripe(params, nowIso());

  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(params.userId),
          SK: entitlementSk(),
        },
        ConditionExpression: built.conditionExpression,
        UpdateExpression: built.updateExpression,
        ExpressionAttributeNames: built.expressionAttributeNames,
        ExpressionAttributeValues: built.expressionAttributeValues,
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      // The conditional write was refused for one of three reasons, all of
      // which mean "do not overwrite, drop this event":
      //   1. the user is on a non-Stripe Pro source (license / flow_points),
      //   2. an unresolved chargeback marker (disputeOpen) blocks PRO
      //      re-activation, or
      //   3. this Stripe event is stale — an event with a newer event.created
      //      was already applied (lastStripeEventAt ordering guard).
      // Returning here (2xx to Stripe) is correct: the Stripe customer/
      // subscription IDs are still safe to attach via
      // attachStripeCustomerToEntitlement, and a retry of a genuinely stale
      // event would be refused identically, so there is nothing to retry.
      return;
    }
    throw error;
  }
}

/**
 * Stamp (open=true) or remove (open=false) the sticky `disputeOpen` chargeback
 * marker on a user's entitlement, INDEPENDENT of plan/proSource.
 *
 * `updateUserEntitlementFromStripe`'s combined dispute write carries the marker
 * under its proSource guard, so for a non-stripe-PRO account (license /
 * flow_points / gift_code / admin) the whole write — marker included — is
 * refused, and the chargeback leaves no `disputeOpen` to block a later stale
 * Stripe re-activation. The dispute webhook branches call this dedicated,
 * un-gated write so the marker is always recorded (and symmetrically cleared on
 * a won dispute) regardless of how the user obtained PRO.
 *
 * Condition is `attribute_exists(PK)` only: a missing entitlement row is a
 * no-op (that case is already covered by the branch's
 * updateUserEntitlementFromStripe upsert). Idempotent, so it is safe to call
 * alongside the combined write on the stripe-source path.
 */
export async function setEntitlementDisputeMarker(
  tableName: string,
  userId: string,
  open: boolean
): Promise<void> {
  const built = buildDisputeMarkerUpdate(open, nowIso());
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(userId),
          SK: entitlementSk(),
        },
        ConditionExpression: built.conditionExpression,
        UpdateExpression: built.updateExpression,
        ExpressionAttributeValues: built.expressionAttributeValues,
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      // No entitlement row for this user → nothing to mark. (For a chargeback the
      // row normally exists; this just guards the degenerate case.)
      return;
    }
    throw error;
  }
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
      // unlockedBookIds is created lazily by reserveBookEntitlement's ADD; do not
      // initialize it here (an empty Set can no longer be marshalled).
      UpdateExpression:
        "SET stripeCustomerId = :customerId, updatedAt = :updatedAt, #plan = if_not_exists(#plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)",
      ExpressionAttributeNames: {
        "#plan": "plan",
      },
      ExpressionAttributeValues: {
        ":customerId": customerId,
        ":updatedAt": nowIso(),
        ":freePlan": "FREE",
        ":defaultSlots": 2,
      },
    })
  );
}

/**
 * Attach a Stripe customer ID to a user entitlement, but ONLY if no customer
 * is already attached. Returns true on success, false if a different
 * customerId already exists (race winner). This is used at checkout-session
 * creation time to deduplicate concurrent customer creations.
 */
export async function attachStripeCustomerIfAbsent(
  tableName: string,
  userId: string,
  customerId: string
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(userId),
          SK: entitlementSk(),
        },
        ConditionExpression: "attribute_not_exists(stripeCustomerId)",
        // unlockedBookIds is created lazily by reserveBookEntitlement's ADD; do not
        // initialize it here (an empty Set can no longer be marshalled).
        UpdateExpression:
          "SET stripeCustomerId = :customerId, updatedAt = :updatedAt, #plan = if_not_exists(#plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)",
        ExpressionAttributeNames: { "#plan": "plan" },
        ExpressionAttributeValues: {
          ":customerId": customerId,
          ":updatedAt": nowIso(),
          ":freePlan": "FREE",
          ":defaultSlots": 2,
        },
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
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
  // A manual PRO grant is a comp, not a Stripe-billed subscription. Stamp
  // proSource="admin" so revenue/reconciliation routes (scanAllEntitlements →
  // revenue MRR filter, reconciliation prosource_mismatch) exclude it from
  // Stripe MRR while still surfacing it in the proSourceBreakdown. When an admin
  // sets the plan back to FREE, clear proSource so a previously comped row no
  // longer claims a PRO source. A pure freeBookSlots/proStatus tweak (no plan
  // change) leaves proSource untouched so we never clobber a real Stripe source.
  if (params.plan === "PRO") {
    segments.push("proSource = :proSource");
    values[":proSource"] = "admin";
  } else if (params.plan === "FREE") {
    segments.push("proSource = :proSource");
    values[":proSource"] = null;
  }
  // unlockedBookIds is created lazily by reserveBookEntitlement's ADD; do not
  // initialize it here (an empty Set can no longer be marshalled).

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

/**
 * Write a back-office admin audit record. Generalizes the segment-shaped
 * writeAuditEntry in admin-segments-repo.ts to any admin action that mutates a
 * single target user (entitlement overrides, etc.) so comped/granted state is
 * traceable for fraud investigation and accountability.
 *
 * Shape matches the existing ADMIN_AUDIT rows: PK groups every action by the
 * acting admin (BOOKAUDIT#<adminUserId>), SK orders them by time#action.
 */
export async function writeAdminAudit(
  tableName: string,
  entry: {
    adminUserId: string;
    action: string;
    targetUserId: string;
    params?: Record<string, unknown>;
  }
): Promise<void> {
  const now = nowIso();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: `BOOKAUDIT#${entry.adminUserId}`,
        SK: `${now}#${entry.action}`,
        entity: "ADMIN_AUDIT",
        adminUserId: entry.adminUserId,
        action: entry.action,
        targetUserId: entry.targetUserId,
        params: entry.params ?? {},
        createdAt: now,
      },
    })
  );
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
  // NOTE: upsertUserProgress is now a cursor/activity-only touch and intentionally does
  // NOT persist the gating fields. This standalone quiz-pass writer therefore uses the
  // optimistic, field-scoped writeQuizPassProgress helper with a re-read/retry loop so a
  // concurrent writer's completed chapters / unlock can't be clobbered.
  const MAX_ATTEMPTS = 4;
  for (let attemptNo = 0; attemptNo < MAX_ATTEMPTS; attemptNo += 1) {
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

    const updatedAt = nowIso();
    const applied = await writeQuizPassProgress(tableName, {
      expectedRev: progress.progressRev ?? 0,
      nextProgress: {
        ...progress,
        currentChapterNumber: Math.max(
          progress.currentChapterNumber,
          params.chapterNumber + 1
        ),
        unlockedThroughChapterNumber: Math.max(
          progress.unlockedThroughChapterNumber,
          params.chapterNumber + 1
        ),
        completedChapters: Array.from(completed).sort((a, b) => a - b),
        bestScoreByChapter,
        lastActiveAt: updatedAt,
        lastOpenedAt: updatedAt,
        updatedAt,
      },
    });
    if (applied) return;
    // Lost the optimistic guard — re-read and recompute against the fresh row.
  }
  throw new BookApiError(
    503,
    "progress_write_contended",
    "Saving your progress hit heavy contention. Please try again."
  );
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
  ent: BookUserEntitlement | null,
  // Per-book total chapter count, keyed by bookId — supply each user's PINNED
  // version's chapterCount (see /me/progress route). "Completed" then means every
  // chapter is done (completedChapters.length >= chapterCount), which is exact and
  // handles out-of-order completion. When a book's count is missing (omitted, or a
  // transient manifest-read failure) it is NOT counted as completed — see
  // isBookCompleted: there is no correct count-free completion heuristic.
  chapterCounts?: Map<string, number> | Record<string, number>
): {
  booksStarted: number;
  booksCompleted: number;
  chaptersCompleted: number;
  averageBestScore: number;
  plan: "FREE" | "PRO";
  freeBookSlots: number;
  unlockedBooksCount: number;
} {
  const chapterCountFor = (bookId: string): number | undefined => {
    if (!chapterCounts) return undefined;
    const raw =
      chapterCounts instanceof Map ? chapterCounts.get(bookId) : chapterCounts[bookId];
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : undefined;
  };

  const booksStarted = entries.length;
  let booksCompleted = 0;
  let chaptersCompleted = 0;
  const scores: number[] = [];

  for (const p of entries) {
    chaptersCompleted += p.completedChapters.length;
    const totalChapters = chapterCountFor(p.bookId);
    // Completion is decided by the pure core: exact when the (pinned) chapter
    // count is known, and conservatively `false` when it isn't — the old
    // count-free heuristic could never credit a sequentially-finished book
    // because `buildProgressAfterQuizPass` always advances currentChapterNumber
    // past completedChapters.length. See book-completion-core.ts / isBookCompleted.
    if (isBookCompleted(p, totalChapters)) {
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
  // Write the externally-keyed risk event AND a reverse-pointer into the user's
  // own partition (#4a) so account-erasure — which sweeps only the user
  // partition — can later reconstruct this event's key and delete it. Forward-
  // only: pointers exist only for events written after this deploy.
  const pointer = buildRiskEventPointer({
    userId: event.userId,
    scope: event.scope,
    fingerprint: event.fingerprint,
    createdAt: event.createdAt,
    eventType: event.eventType,
  });
  // Atomic: write the risk event AND its erasure reverse-pointer together so a
  // partial failure can never leave a risk event with no pointer — which would be
  // unreachable at account-erasure (exactly the gap #4a closes). Matches the
  // referral/pair pointers, which are also written via TransactWrite.
  await ddbDoc.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: {
              // no TTL — retained for legal/fraud/compliance (abuse/fraud investigation)
              PK: riskEventPk(event.scope, event.fingerprint),
              SK: riskEventSk(event.createdAt, event.eventType, event.userId),
              entity: "BOOK_RISK_EVENT",
              ...event,
            },
          },
        },
        { Put: { TableName: tableName, Item: pointer } },
      ],
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

// ── Account Status (soft deactivation / soft deletion) ──────────────────────

export async function getAccountStatus(
  tableName: string,
  userId: string
): Promise<AccountStatusItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: accountStatusSk() },
    })
  );
  const item = res.Item;
  if (!item) return null;
  const status = item.status as string;
  if (status !== "active" && status !== "deactivated" && status !== "deleted") return null;
  return {
    userId,
    status: status as AccountStatusItem["status"],
    statusChangedAt: (item.statusChangedAt as string) ?? "",
    statusReason: item.statusReason as string | undefined,
    previousPlan: item.previousPlan as "FREE" | "PRO" | undefined,
    previousProSource: item.previousProSource as string | undefined,
  };
}

export async function setAccountStatus(
  tableName: string,
  userId: string,
  status: AccountStatusItem["status"],
  extras?: {
    statusReason?: string;
    previousPlan?: "FREE" | "PRO";
    previousProSource?: string;
    /** Who made the change: "self" (default), "admin:<adminUserId>", or "system". */
    changedBy?: string;
  }
): Promise<void> {
  const now = nowIso();

  // Capture the prior status for the audit trail (best-effort — never blocks).
  let previousStatus: AccountStatus | null = null;
  try {
    const prev = await getAccountStatus(tableName, userId);
    previousStatus = prev?.status ?? null;
  } catch {
    // ignore — the audit row just won't carry a previousStatus
  }

  const item: Record<string, unknown> = {
    PK: bookUserPk(userId),
    SK: accountStatusSk(),
    entity: "BOOK_ACCOUNT_STATUS",
    userId,
    status,
    statusChangedAt: now,
    updatedAt: now,
  };
  if (extras?.statusReason) item.statusReason = extras.statusReason;
  if (extras?.previousPlan) item.previousPlan = extras.previousPlan;
  if (extras?.previousProSource) item.previousProSource = extras.previousProSource;

  await ddbDoc.send(new PutCommand({ TableName: tableName, Item: item }));

  // Append an immutable audit record (who/when/why). Best-effort: a failed
  // audit write must not undo or block the authoritative status change above.
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          // no TTL — retained for legal/fraud/compliance (immutable account-lifecycle audit)
          PK: bookUserPk(userId),
          SK: accountStatusChangeSk(now),
          entity: "BOOK_ACCOUNT_STATUS_CHANGE",
          userId,
          status,
          previousStatus,
          changedAt: now,
          changedBy: extras?.changedBy ?? "self",
          reason: extras?.statusReason,
        },
      })
    );
  } catch (error) {
    console.error("account_status_audit_write_failed", {
      userId,
      status,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** List a user's account-status change history (newest first) for the admin UI. */
export async function listAccountStatusChanges(
  tableName: string,
  userId: string,
  limit = 50
): Promise<AccountStatusChangeItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "ACCOUNTSTATUSCHANGE#",
      },
      ScanIndexForward: false, // newest first
      Limit: Math.min(Math.max(limit, 1), 200),
    })
  );
  return (res.Items ?? []).map((item) => ({
    userId,
    status: (readStr(item.status) as AccountStatus) ?? "active",
    previousStatus: (readStr(item.previousStatus) as AccountStatus) ?? null,
    changedAt: readStr(item.changedAt) ?? "",
    changedBy: readStr(item.changedBy) ?? "self",
    reason: readStr(item.reason),
  }));
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
    /**
     * Optimistic-concurrency guard. When provided, the write only succeeds if
     * the stored `updatedAt` still equals this value (or the item is absent for
     * `""`). On mismatch a ConditionalCheckFailedException is thrown so callers
     * can re-read and retry instead of silently clobbering a concurrent write.
     */
    expectedUpdatedAt?: string;
  }
): Promise<BookUserSettingsItem> {
  const now = nowIso();
  const createdAt = params.createdAt || now;

  const put = new PutCommand({
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
  });

  if (params.expectedUpdatedAt !== undefined) {
    if (params.expectedUpdatedAt === "") {
      // First write for this user: succeed only if no settings item exists yet.
      put.input.ConditionExpression = "attribute_not_exists(PK)";
    } else {
      // Subsequent write: succeed only if nobody else has written since we read.
      put.input.ConditionExpression = "updatedAt = :expected";
      put.input.ExpressionAttributeValues = { ":expected": params.expectedUpdatedAt };
    }
  }

  await ddbDoc.send(put);
  return {
    userId: params.userId,
    settings: params.settings,
    createdAt,
    updatedAt: now,
  };
}

/**
 * Read-modify-write a user's settings under optimistic concurrency. `apply`
 * receives the latest persisted settings (`{}` when none exist) and returns the
 * next full settings object. The conditional Put is retried on a concurrent
 * write so near-simultaneous updates (e.g. an in-app settings save racing a
 * one-click email unsubscribe) cannot silently overwrite each other.
 */
export async function updateUserSettingsItem(
  tableName: string,
  userId: string,
  apply: (current: Record<string, unknown>) => Record<string, unknown>,
  maxAttempts = 4
): Promise<BookUserSettingsItem> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const existing = await getUserSettingsItem(tableName, userId);
    const nextSettings = apply(existing?.settings ?? {});
    try {
      return await putUserSettingsItem(tableName, {
        userId,
        settings: nextSettings,
        createdAt: existing?.createdAt,
        expectedUpdatedAt: existing?.updatedAt ?? "",
      });
    } catch (error: unknown) {
      if (!isConditionalCheckFailed(error)) throw error;
      // A concurrent writer won the race; loop to re-read and re-apply.
    }
  }
  throw new BookApiError(
    409,
    "settings_write_conflict",
    "Settings were updated concurrently. Please retry."
  );
}

export async function listSavedBooks(
  tableName: string,
  userId: string
): Promise<BookUserSavedBookItem[]> {
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "SAVED#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserSavedBookItem | null> = rows
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
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "BOOKSTATE#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserBookStateItem | null> = rows
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
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "CHAPTERSTATE#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserChapterStateItem | null> = rows
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
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "READINGDAY#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserReadingDayItem | null> = rows
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
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "BADGE#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserBadgeAwardItem | null> = rows
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
    const day = d.getDate();
    d.setMonth(d.getMonth() + params.validMonths);
    // setMonth rolls an overflowing day-of-month into the following month (e.g.
    // Jan 31 + 1mo -> Mar 3, since Feb has no 31st), silently granting extra
    // days. Clamp back to the last day of the intended month when that happens.
    if (d.getDate() !== day) {
      d.setDate(0);
    }
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
            // Upgrade the user's entitlement to PRO (license-based). The grant is
            // applied via the SHARED pro-grant guard (license-grant-core): apply
            // only when it does not shorten/destroy a longer or open-ended grant
            // (active Stripe sub, admin comp, or a license/flow_points/gift window
            // that outlasts this license). The route also pre-checks Stripe
            // (license/route.ts), but that read is not atomic with this write — the
            // condition closes that race and the broader stomp cases. On refusal the
            // whole transaction rolls back, so the key is NOT consumed.
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(params.userId),
                SK: entitlementSk(),
              },
              ...buildLicenseEntitlementGrant({
                code: normalized,
                expiresAt,
                now,
                defaultSlots: 2,
              }),
            },
          },
          {
            // Update the index item so admin listing reflects redeemed status
            Update: {
              TableName: tableName,
              Key: {
                PK: licenseIndexPk(),
                SK: licenseIndexSk(normalized),
              },
              UpdateExpression:
                "SET #status = :redeemed, redeemedBy = :userId, redeemedAt = :now",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":redeemed": "redeemed",
                ":userId": params.userId,
                ":now": now,
              },
            },
          },
        ],
      })
    );
  } catch (error: unknown) {
    const reasons = transactionCancellationReasons(error);
    if (reasons) {
      // Index 1 = entitlement guard (the shared pro-grant guard): the redemption
      // would clobber/shorten a longer-lived or open-ended Pro grant — an active
      // paid Stripe sub, an admin comp, or a license/flow_points/gift window that
      // outlasts this license — OR an unresolved chargeback marker (disputeOpen)
      // blocks the (re)grant entirely (C3). We refuse so the longer grant / hold
      // survives; the transaction rolled back, so the key was NOT consumed.
      if (reasons[1]?.Code === "ConditionalCheckFailed") {
        // Re-read to report the accurate reason. The dispute hold takes priority:
        // a charged-back user must not be told their key is "still valid for later"
        // as if they merely had longer access.
        const entRes = await ddbDoc.send(
          new GetCommand({
            TableName: tableName,
            Key: { PK: bookUserPk(params.userId), SK: entitlementSk() },
          })
        );
        if (entRes.Item?.disputeOpen) {
          throw new BookApiError(
            409,
            "dispute_hold",
            "Your account is on hold pending resolution of a payment dispute, so the license key was not applied. The key remains valid once the dispute is resolved."
          );
        }
        throw new BookApiError(
          409,
          "pro_grant_active",
          "You already have Pro access that lasts at least as long as this license, so the key was not applied. It remains valid for later use."
        );
      }
      // Index 0 (or unspecified) = the key was redeemed or revoked between our
      // read and this write.
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
  const status = key.status ?? "available";
  const now = key.createdAt;
  await Promise.all([
    ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: licenseKeyPk(normalized),
          SK: licenseKeySk(),
          entity: "BOOK_LICENSE_KEY",
          code: normalized,
          plan: "PRO",
          validMonths: key.validMonths,
          status,
          createdAt: now,
          note: key.note ?? null,
          updatedAt: now,
        },
        // Do not overwrite an already-redeemed key if re-seeding
        ConditionExpression: "attribute_not_exists(PK) OR #status = :available",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":available": "available" },
      })
    ),
    // Write an index item so admin can list all keys via Query
    ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: licenseIndexPk(),
          SK: licenseIndexSk(normalized),
          entity: "BOOK_LICENSE_KEY_INDEX",
          code: normalized,
          status,
          validMonths: key.validMonths,
          createdAt: now,
          note: key.note ?? null,
        },
        ConditionExpression: "attribute_not_exists(PK) OR #status = :available",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":available": "available" },
      })
    ),
  ]);
}

/** List all license keys by querying the shared index partition. */
export async function listLicenseKeys(
  tableName: string,
  statusFilter?: "available" | "redeemed" | "revoked"
): Promise<LicenseKeyItem[]> {
  // All license-key index items live under one constant partition, so a single
  // page (1MB) silently truncates once the program scales. Read every page
  // first, then apply the status filter client-side: a server-side
  // FilterExpression is evaluated per 1MB page before truncation, so it would
  // under-count whenever the partition exceeds one page.
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": licenseIndexPk(),
      ":prefix": "CODE#",
    },
  });
  return rows
    .map((item) => ({
      code: item.code as string,
      plan: "PRO" as const,
      validMonths: (item.validMonths as number) ?? 1,
      status: item.status as "available" | "redeemed" | "revoked",
      redeemedBy: item.redeemedBy as string | undefined,
      redeemedAt: item.redeemedAt as string | undefined,
      createdAt: item.createdAt as string,
      note: item.note as string | undefined,
    }))
    .filter((key) => !statusFilter || key.status === statusFilter);
}

/** Revoke a license key. Updates both the main record and the index item. */
export async function revokeLicenseKey(
  tableName: string,
  code: string
): Promise<void> {
  const normalized = code.toUpperCase().trim();
  const now = nowIso();
  await ddbDoc.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: tableName,
            Key: { PK: licenseKeyPk(normalized), SK: licenseKeySk() },
            UpdateExpression: "SET #status = :revoked, updatedAt = :now",
            ConditionExpression: "#status = :available",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":revoked": "revoked", ":available": "available", ":now": now },
          },
        },
        {
          Update: {
            TableName: tableName,
            Key: { PK: licenseIndexPk(), SK: licenseIndexSk(normalized) },
            UpdateExpression: "SET #status = :revoked",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":revoked": "revoked" },
          },
        },
      ],
    })
  );
}

// ── Share Events ─────────────────────────────────────────────────────────────

export async function putShareEvent(
  tableName: string,
  userId: string,
  event: BookUserShareEventItem,
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(userId),
        SK: shareEventSk(event.createdAt, event.shareId),
        entity: "BOOK_USER_SHARE_EVENT",
        ...event,
        // Data retention (#16): share events are high-volume engagement telemetry
        // with no compliance value — stamp a DynamoDB TTL (epoch SECONDS) so they
        // age out after ~18 months. Written to the main app table (its `ttl`
        // attribute is enabled). Placed AFTER the spread so a future `event` field
        // can never clobber it. See retentionPolicyFor + docs/DATA-RETENTION.md.
        ttl: ttlEpochSeconds(RETENTION_DAYS_18_MONTHS),
      },
    }),
  );
}
