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

/**
 * Strip line and block comments, keeping everything else — including string
 * literals, where an S3 URL or a client name IS a real reference worth failing.
 *
 * The invariant this file pins is about CODE: "none imports/uses aws-sdk /
 * S3Client / putObject". A comment cannot import or call anything, and the
 * publish modules legitimately DOCUMENT the surfaces they deliberately do not
 * touch — publishFinal.ts explains that the API catalogue the native iOS app
 * reads is a separate DynamoDB-backed surface precisely so nobody wires publish
 * into it. Scanning raw bytes made that documentation fail the guard, which
 * pressures the next author to delete the explanation rather than keep the
 * invariant. Deliberately conservative: anything not unambiguously a comment is
 * KEPT, so the scan can only ever over-report, never hide a real reference.
 */
function stripComments(src: string): string {
  let out = "";
  let state: "code" | "line" | "block" | "'" | '"' | "`" = "code";
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") { state = "line"; i += 1; continue; }
      if (ch === "/" && next === "*") { state = "block"; i += 1; continue; }
      if (ch === "'" || ch === '"' || ch === "`") state = ch;
      out += ch;
      continue;
    }
    if (state === "line") {
      if (ch === "\n") { state = "code"; out += ch; }
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") { state = "code"; i += 1; }
      continue;
    }
    // Inside a string literal: keep it, honour escapes, close on the same quote.
    out += ch;
    if (ch === "\\") { if (next !== undefined) { out += next; i += 1; } continue; }
    if (ch === state) state = "code";
  }
  return out;
}

test("no publish module references S3 / AWS (static source scan)", () => {
  const files = readdirSync(PUBLISH_DIR).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 3, `expected the publish modules to exist, found: ${files.join(", ")}`);
  const offenders: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(resolve(PUBLISH_DIR, f), "utf8"));
    for (const re of FORBIDDEN) {
      if (re.test(src)) offenders.push(`${f}: matches ${re}`);
    }
  }
  assert.deepEqual(offenders, [], `publish modules must contain NO S3/AWS reference:\n${offenders.join("\n")}`);
});

test("the scan ignores comments but never string literals or code", () => {
  // Prose about a surface publish deliberately does not touch must pass...
  assert.equal(/\bDynamoDB/i.test(stripComments("// rows live in DynamoDB\nconst a = 1;")), false);
  assert.equal(/\bDynamoDB/i.test(stripComments("/* DynamoDB rows */\nconst a = 1;")), false);
  // ...while every executable form still fails.
  assert.equal(/\bDynamoDB/i.test(stripComments('import { DynamoDBClient } from "x";')), true);
  assert.equal(/\bputObject\b/i.test(stripComments("client.putObject(cmd);")), true);
  assert.equal(/aws-sdk/i.test(stripComments('const p = "@aws-sdk/client-s3";')), true);
  // A URL's // must not be mistaken for a comment and swallow the rest of the line.
  assert.equal(/\bS3Client\b/.test(stripComments('const u = "https://x"; new S3Client();')), true);
});

test("publishFinal + cleanupBookDebris are present in the scan set", () => {
  const files = readdirSync(PUBLISH_DIR).filter((f) => f.endsWith(".ts"));
  for (const expected of ["publishFinal.ts", "cleanupBookDebris.ts", "publishToLive.ts"]) {
    assert.ok(files.includes(expected), `${expected} must be under src/publish/ (in the no-AWS scan set)`);
  }
});
