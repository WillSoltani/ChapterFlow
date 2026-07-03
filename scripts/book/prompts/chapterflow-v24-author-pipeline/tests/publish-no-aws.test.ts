/**
 * Static guarantee (v24 WS2): the publish modules contain NO S3/AWS reference.
 * Content reaches users via the repo push + a separate app deploy — the publish
 * flow itself must never call AWS. This is a fail-closed source scan over every
 * file in src/publish/, asserting none imports/uses aws-sdk / S3Client / putObject /
 * the AWS SDK client packages.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLISH_DIR = resolve(__dirname, "../src/publish");

/** Forbidden tokens (case-insensitive where sensible). Word-boundaried so a benign
 *  substring can't false-positive, but broad enough to catch every AWS ingress. */
const FORBIDDEN: RegExp[] = [
  /aws-sdk/i,
  /@aws-sdk\//i,
  /\bS3Client\b/,
  /\bputObject\b/i,
  /\bPutObjectCommand\b/,
  /\bDynamoDB/i,
  /\bGetObjectCommand\b/,
  /\bfromNodeProviderChain\b/,
];

test("no publish module references S3 / AWS (static source scan)", () => {
  const files = readdirSync(PUBLISH_DIR).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 3, `expected the publish modules to exist, found: ${files.join(", ")}`);
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(resolve(PUBLISH_DIR, f), "utf8");
    for (const re of FORBIDDEN) {
      if (re.test(src)) offenders.push(`${f}: matches ${re}`);
    }
  }
  assert.deepEqual(offenders, [], `publish modules must contain NO S3/AWS reference:\n${offenders.join("\n")}`);
});

test("publishFinal + cleanupBookDebris are present in the scan set", () => {
  const files = readdirSync(PUBLISH_DIR).filter((f) => f.endsWith(".ts"));
  for (const expected of ["publishFinal.ts", "cleanupBookDebris.ts", "publishToLive.ts"]) {
    assert.ok(files.includes(expected), `${expected} must be under src/publish/ (in the no-AWS scan set)`);
  }
});
