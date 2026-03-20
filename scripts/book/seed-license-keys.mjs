#!/usr/bin/env node
/**
 * Seed pre-generated ChapterFlow license keys into DynamoDB.
 *
 * Usage:
 *   node scripts/book/seed-license-keys.mjs
 *
 * Required environment variables (same as the app):
 *   AWS_REGION           e.g. us-east-1
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   BOOK_TABLE_NAME
 *
 * The script is idempotent — it will not overwrite a key that has already been redeemed.
 * Running it twice on an available key is safe.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// ─── Config ──────────────────────────────────────────────────────────────────

const TABLE_NAME = process.env.BOOK_TABLE_NAME;

if (!TABLE_NAME) {
  console.error("ERROR: BOOK_TABLE_NAME is required.");
  process.exit(1);
}

const REGION = process.env.AWS_REGION || "us-east-1";

// ─── 20 pre-generated one-month Pro free-pass keys ───────────────────────────
// Format: CF-XXXX-XXXX-XXXX  (uppercase alphanumeric groups)
// Distribute these manually to users you want to give free Pro access.

const LICENSE_KEYS = [
  { code: "CF-A3K7-M9P2-BX4Q", note: "Batch 1 – key 01" },
  { code: "CF-Z8R1-V5TN-JW6Y", note: "Batch 1 – key 02" },
  { code: "CF-L2XF-E4K9-UH7C", note: "Batch 1 – key 03" },
  { code: "CF-Q5WB-D3GR-NT8V", note: "Batch 1 – key 04" },
  { code: "CF-Y7MC-S6PH-AZ9K", note: "Batch 1 – key 05" },
  { code: "CF-H4JT-R2VL-FW3X", note: "Batch 1 – key 06" },
  { code: "CF-P9DK-A8GN-QM6B", note: "Batch 1 – key 07" },
  { code: "CF-B1VX-C7HW-YE4S", note: "Batch 1 – key 08" },
  { code: "CF-T6NF-K3MQ-PD2R", note: "Batch 1 – key 09" },
  { code: "CF-W8ZY-H5JX-LB7G", note: "Batch 1 – key 10" },
  { code: "CF-S3PT-F9KC-ZN1V", note: "Batch 1 – key 11" },
  { code: "CF-X2GL-U4RB-DM8J", note: "Batch 1 – key 12" },
  { code: "CF-R7KN-V6FP-AQ3T", note: "Batch 1 – key 13" },
  { code: "CF-J4BW-T8SZ-HL9E", note: "Batch 1 – key 14" },
  { code: "CF-M5QH-N2YC-GK6X", note: "Batch 1 – key 15" },
  { code: "CF-E9TV-X7WB-PJ4N", note: "Batch 1 – key 16" },
  { code: "CF-K3GS-L1ZF-VR8D", note: "Batch 1 – key 17" },
  { code: "CF-N6YP-B4HT-MX2A", note: "Batch 1 – key 18" },
  { code: "CF-F8DM-Q9KV-ZW5L", note: "Batch 1 – key 19" },
  { code: "CF-U2AX-E7RS-CH3G", note: "Batch 1 – key 20" },
];

const VALID_MONTHS = 1; // each key grants 1 month of Pro access

// ─── DynamoDB helpers ─────────────────────────────────────────────────────────

function licenseKeyPk(code) {
  return `BOOKLICENSE#KEY#${code.toUpperCase()}`;
}

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

async function seedKey({ code, note }) {
  const normalized = code.toUpperCase().trim();
  const now = new Date().toISOString();
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: licenseKeyPk(normalized),
          SK: "META",
          entity: "BOOK_LICENSE_KEY",
          code: normalized,
          plan: "PRO",
          validMonths: VALID_MONTHS,
          status: "available",
          createdAt: now,
          updatedAt: now,
          note: note ?? null,
        },
        // Safe: only create if the item does not exist, OR if it is still available (not redeemed).
        ConditionExpression: "attribute_not_exists(PK) OR #status = :available",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":available": "available" },
      })
    );
    console.log(`  ✓ ${normalized}${note ? `  (${note})` : ""}`);
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      console.log(`  ~ ${normalized}  [already redeemed — skipped]`);
    } else {
      console.error(`  ✗ ${normalized}  ERROR: ${err.message}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\nSeeding ${LICENSE_KEYS.length} license keys into table: ${TABLE_NAME}\n`);

for (const key of LICENSE_KEYS) {
  await seedKey(key);
}

console.log(`\nDone. ${LICENSE_KEYS.length} keys processed.\n`);
console.log("Keys to distribute:");
LICENSE_KEYS.forEach(({ code }, i) => {
  console.log(`  ${String(i + 1).padStart(2, "0")}. ${code}`);
});
console.log();
