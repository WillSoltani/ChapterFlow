#!/usr/bin/env node
/**
 * Generate and seed cryptographically random ChapterFlow license keys.
 *
 * Usage:
 *   node scripts/book/generate-license-keys.mjs [count] [--months N] [--note "text"] [--dry-run]
 *
 * Examples:
 *   node scripts/book/generate-license-keys.mjs 10
 *   node scripts/book/generate-license-keys.mjs 5 --months 3 --note "Partner promo batch"
 *   node scripts/book/generate-license-keys.mjs 20 --dry-run
 *
 * Required environment variables (unless --dry-run):
 *   AWS_REGION           e.g. us-east-1
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   BOOK_TABLE_NAME
 *
 * Output: Prints each generated key. With --dry-run, keys are printed but not stored.
 */

import { randomBytes } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// ─── CLI argument parsing ───────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const monthsIndex = args.indexOf("--months");
const noteIndex = args.indexOf("--note");

const validMonths = monthsIndex !== -1 ? parseInt(args[monthsIndex + 1], 10) : 1;
if (!Number.isFinite(validMonths) || validMonths < 1 || validMonths > 24) {
  console.error("ERROR: --months must be between 1 and 24.");
  process.exit(1);
}

const note = noteIndex !== -1 ? args[noteIndex + 1] : null;

// Count is the first positional arg that isn't a flag or flag value
const flagIndices = new Set();
if (monthsIndex !== -1) { flagIndices.add(monthsIndex); flagIndices.add(monthsIndex + 1); }
if (noteIndex !== -1) { flagIndices.add(noteIndex); flagIndices.add(noteIndex + 1); }
if (args.indexOf("--dry-run") !== -1) flagIndices.add(args.indexOf("--dry-run"));

const positional = args.filter((_, i) => !flagIndices.has(i));
const count = positional.length > 0 ? parseInt(positional[0], 10) : 5;

if (!Number.isFinite(count) || count < 1 || count > 100) {
  console.error("ERROR: Count must be between 1 and 100.");
  process.exit(1);
}

// ─── Config ─────────────────────────────────────────────────────────────────

const TABLE_NAME = process.env.BOOK_TABLE_NAME;
const REGION = process.env.AWS_REGION || "us-east-1";

if (!dryRun && !TABLE_NAME) {
  console.error("ERROR: BOOK_TABLE_NAME is required (or use --dry-run).");
  process.exit(1);
}

// ─── Key generation ─────────────────────────────────────────────────────────

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generate a cryptographically random segment of N characters from CHARSET. */
function randomSegment(length) {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }
  return result;
}

/** Generate a single key in CF-XXXX-XXXX-XXXX format. */
function generateKey() {
  return `CF-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}

// ─── DynamoDB helpers ───────────────────────────────────────────────────────

function licenseKeyPk(code) {
  return `BOOKLICENSE#KEY#${code.toUpperCase()}`;
}
function licenseIndexPk() {
  return "BOOKLICENSE#KEYS";
}
function licenseIndexSk(code) {
  return `CODE#${code.toUpperCase()}`;
}

let ddb;
if (!dryRun) {
  ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: REGION }),
    { marshallOptions: { removeUndefinedValues: true } }
  );
}

async function seedKey(code, noteText) {
  const now = new Date().toISOString();
  await Promise.all([
    ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: licenseKeyPk(code),
          SK: "META",
          entity: "BOOK_LICENSE_KEY",
          code,
          plan: "PRO",
          validMonths,
          status: "available",
          createdAt: now,
          updatedAt: now,
          note: noteText ?? null,
        },
        // Do not overwrite an already-existing key (collision guard)
        ConditionExpression: "attribute_not_exists(PK)",
      })
    ),
    // Write index item for admin listing
    ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: licenseIndexPk(),
          SK: licenseIndexSk(code),
          entity: "BOOK_LICENSE_KEY_INDEX",
          code,
          status: "available",
          validMonths,
          createdAt: now,
          note: noteText ?? null,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    ),
  ]);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const mode = dryRun ? "DRY RUN" : `seeding to table: ${TABLE_NAME}`;
console.log(`\nGenerating ${count} license key(s) (${validMonths} month(s) each) — ${mode}\n`);

const generated = [];
let seeded = 0;

for (let i = 0; i < count; i++) {
  const code = generateKey();
  generated.push(code);

  if (dryRun) {
    console.log(`  ${String(i + 1).padStart(3, "0")}. ${code}`);
  } else {
    try {
      await seedKey(code, note);
      console.log(`  ✓ ${code}${note ? `  (${note})` : ""}`);
      seeded++;
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        // Extremely unlikely collision — regenerate
        console.log(`  ~ ${code}  [collision — regenerating]`);
        i--; // retry this index
        continue;
      }
      console.error(`  ✗ ${code}  ERROR: ${err.message}`);
    }
  }
}

console.log(`\n${dryRun ? "Generated" : "Seeded"}: ${dryRun ? generated.length : seeded} key(s)\n`);

if (generated.length > 0) {
  console.log("Keys to distribute:");
  generated.forEach((code, i) => {
    console.log(`  ${String(i + 1).padStart(3, "0")}. ${code}`);
  });
  console.log();
}
