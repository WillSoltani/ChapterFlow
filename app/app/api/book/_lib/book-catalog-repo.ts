// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { BookApiError } from "./errors";
import {
  bookMetaSk,
  bookPk,
  bookVersionSk,
  catalogPk,
  catalogSk,
  nowIso,
} from "./keys";
import type {
  BookCatalogItem,
  BookManifest,
  BookVersionItem,
} from "./types";
import {
  type MetaCatalogSnapshot,
  buildBookMetaAndCatalogItems,
  planMetaCatalogRollback,
} from "./ingest-rollback-core";
import {
  isConditionalCheckFailed,
  parseStringArray,
  queryAllItems,
  readNum,
  readStr,
} from "./repo-shared";

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
    cover?: { emoji?: string | undefined; color?: string | undefined } | undefined;
    variantFamily: "EMH" | "PBC";
    latestVersion: number;
    currentPublishedVersion?: number | undefined;
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
