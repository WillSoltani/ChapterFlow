#!/usr/bin/env -S npx tsx

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  CopyObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "us-east-1";

const SOURCE_BOOK_TABLE_NAME =
  process.env.SOURCE_BOOK_TABLE_NAME || "SecureDocApp";
const SOURCE_BOOK_ANALYTICS_TABLE_NAME =
  process.env.SOURCE_BOOK_ANALYTICS_TABLE_NAME || "ChapterFlowAnalytics";
const SOURCE_BOOK_INGEST_BUCKET =
  process.env.SOURCE_BOOK_INGEST_BUCKET || process.env.SOURCE_RAW_BUCKET;
const SOURCE_BOOK_CONTENT_BUCKET =
  process.env.SOURCE_BOOK_CONTENT_BUCKET || process.env.SOURCE_OUTPUT_BUCKET;

function requireEnv(name: string, ...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  console.error(`ERROR: ${name} is required.`);
  process.exit(1);
}

const TARGET_BOOK_TABLE_NAME = requireEnv(
  "BOOK_TABLE_NAME or TARGET_BOOK_TABLE_NAME",
  process.env.BOOK_TABLE_NAME,
  process.env.TARGET_BOOK_TABLE_NAME
);

const TARGET_BOOK_ANALYTICS_TABLE_NAME = requireEnv(
  "BOOK_ANALYTICS_TABLE_NAME or TARGET_BOOK_ANALYTICS_TABLE_NAME",
  process.env.BOOK_ANALYTICS_TABLE_NAME,
  process.env.TARGET_BOOK_ANALYTICS_TABLE_NAME
);

const TARGET_BOOK_INGEST_BUCKET = requireEnv(
  "BOOK_INGEST_BUCKET or TARGET_BOOK_INGEST_BUCKET",
  process.env.BOOK_INGEST_BUCKET,
  process.env.TARGET_BOOK_INGEST_BUCKET
);

const TARGET_BOOK_CONTENT_BUCKET = requireEnv(
  "BOOK_CONTENT_BUCKET or TARGET_BOOK_CONTENT_BUCKET",
  process.env.BOOK_CONTENT_BUCKET,
  process.env.TARGET_BOOK_CONTENT_BUCKET
);

const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true, convertEmptyValues: true },
});

const s3 = new S3Client({ region: REGION });

const BOOK_PK_PREFIXES = [
  "BOOK#",
  "BOOKCATALOG",
  "BOOKUSER#",
  "BOOKINGEST#",
  "BOOKSCENARIO#",
  "BOOKRISK#",
  "QUIZATTEMPT#",
  "BOOKBILLING#",
  "BOOKLICENSE#",
];

function isChapterFlowOperationalItem(item: Record<string, unknown>): boolean {
  const entity = typeof item.entity === "string" ? item.entity : "";
  if (entity.startsWith("BOOK_")) return true;

  const pk = typeof item.PK === "string" ? item.PK : "";
  return BOOK_PK_PREFIXES.some((prefix) => pk.startsWith(prefix));
}

async function scanAll(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const res = await ddbDoc.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
      })
    );
    for (const item of res.Items ?? []) {
      items.push(item as Record<string, unknown>);
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return items;
}

async function batchWriteAll(
  tableName: string,
  items: Record<string, unknown>[]
): Promise<void> {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await ddbDoc.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((Item) => ({
            PutRequest: { Item },
          })),
        },
      })
    );
  }
}

async function migrateOperationalTable() {
  if (SOURCE_BOOK_TABLE_NAME === TARGET_BOOK_TABLE_NAME) {
    console.log(`Skipping operational table migration; source and target are both ${TARGET_BOOK_TABLE_NAME}.`);
    return;
  }

  console.log(`Scanning source operational table: ${SOURCE_BOOK_TABLE_NAME}`);
  const sourceItems = await scanAll(SOURCE_BOOK_TABLE_NAME);
  const chapterFlowItems = sourceItems.filter(isChapterFlowOperationalItem);
  console.log(
    `Found ${chapterFlowItems.length} ChapterFlow items out of ${sourceItems.length} total source rows.`
  );

  await batchWriteAll(TARGET_BOOK_TABLE_NAME, chapterFlowItems);
  console.log(`Copied ${chapterFlowItems.length} ChapterFlow operational rows to ${TARGET_BOOK_TABLE_NAME}.`);
}

async function migrateAnalyticsTable() {
  if (SOURCE_BOOK_ANALYTICS_TABLE_NAME === TARGET_BOOK_ANALYTICS_TABLE_NAME) {
    console.log(
      `Skipping analytics migration; source and target are both ${TARGET_BOOK_ANALYTICS_TABLE_NAME}.`
    );
    return;
  }

  console.log(`Scanning source analytics table: ${SOURCE_BOOK_ANALYTICS_TABLE_NAME}`);
  const analyticsItems = await scanAll(SOURCE_BOOK_ANALYTICS_TABLE_NAME);
  console.log(`Found ${analyticsItems.length} analytics rows.`);
  await batchWriteAll(TARGET_BOOK_ANALYTICS_TABLE_NAME, analyticsItems);
  console.log(
    `Copied ${analyticsItems.length} analytics rows to ${TARGET_BOOK_ANALYTICS_TABLE_NAME}.`
  );
}

function encodeCopySource(bucket: string, key: string): string {
  return `${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}

async function copyPrefix(params: {
  sourceBucket: string;
  targetBucket: string;
  prefix: string;
}): Promise<number> {
  let copied = 0;
  let ContinuationToken: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: params.sourceBucket,
        Prefix: params.prefix,
        ContinuationToken,
      })
    );

    for (const object of res.Contents ?? []) {
      if (!object.Key) continue;
      await s3.send(
        new CopyObjectCommand({
          Bucket: params.targetBucket,
          Key: object.Key,
          CopySource: encodeCopySource(params.sourceBucket, object.Key),
        })
      );
      copied += 1;
    }

    ContinuationToken = res.NextContinuationToken;
  } while (ContinuationToken);

  return copied;
}

async function migrateBuckets() {
  const copyPlans = [
    {
      sourceBucket: SOURCE_BOOK_INGEST_BUCKET,
      targetBucket: TARGET_BOOK_INGEST_BUCKET,
      prefix: "book-ingest/",
    },
    {
      sourceBucket: SOURCE_BOOK_CONTENT_BUCKET,
      targetBucket: TARGET_BOOK_CONTENT_BUCKET,
      prefix: "book-content/",
    },
    {
      sourceBucket: SOURCE_BOOK_CONTENT_BUCKET,
      targetBucket: TARGET_BOOK_CONTENT_BUCKET,
      prefix: "book-ingest-errors/",
    },
  ].filter(
    (plan): plan is { sourceBucket: string; targetBucket: string; prefix: string } =>
      Boolean(plan.sourceBucket && plan.targetBucket)
  );

  for (const plan of copyPlans) {
    if (plan.sourceBucket === plan.targetBucket) {
      console.log(
        `Skipping S3 prefix ${plan.prefix}; source and target are both ${plan.targetBucket}.`
      );
      continue;
    }
    const copied = await copyPrefix(plan);
    console.log(
      `Copied ${copied} object(s) for prefix ${plan.prefix} from ${plan.sourceBucket} to ${plan.targetBucket}.`
    );
  }
}

async function main() {
  console.log("Starting ChapterFlow backend migration", {
    region: REGION,
    sourceOperationalTable: SOURCE_BOOK_TABLE_NAME,
    targetOperationalTable: TARGET_BOOK_TABLE_NAME,
    sourceAnalyticsTable: SOURCE_BOOK_ANALYTICS_TABLE_NAME,
    targetAnalyticsTable: TARGET_BOOK_ANALYTICS_TABLE_NAME,
    sourceIngestBucket: SOURCE_BOOK_INGEST_BUCKET || null,
    targetIngestBucket: TARGET_BOOK_INGEST_BUCKET,
    sourceContentBucket: SOURCE_BOOK_CONTENT_BUCKET || null,
    targetContentBucket: TARGET_BOOK_CONTENT_BUCKET,
  });

  await migrateOperationalTable();
  await migrateAnalyticsTable();
  await migrateBuckets();

  console.log("ChapterFlow backend migration complete.");
}

main().catch((error) => {
  console.error("Migration failed.", error);
  process.exit(1);
});
