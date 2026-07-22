import { test } from "node:test";
import assert from "node:assert/strict";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Live proof that a presigned S3 GET URL — exactly what ?mode=plan hands the
// client — natively serves HTTP Range (Accept-Ranges: bytes → 206), which is
// what lets the native player seek per-segment (docs/ios/AUDIO-CONTRACT.md §5,
// §8). This is the one part of the contract that can't be unit-tested: it is a
// property of S3, not of our code. It is OPT-IN so `npm test` / `npm run verify`
// stay green without AWS: only `npm run test:integration` picks up *.itest.ts,
// and even then it self-skips unless a scratch bucket + AWS creds are provided.
//
//   AUDIO_PLAN_ITEST_BUCKET=<a bucket you can PUT/GET/DELETE in> \
//   AWS_REGION=<region> npm run test:integration

const BUCKET = process.env.AUDIO_PLAN_ITEST_BUCKET;
const skip = BUCKET ? false : "set AUDIO_PLAN_ITEST_BUCKET (+ AWS creds/region) to run";

test("presigned S3 URL serves Range → 206 with Content-Range", { skip }, async () => {
  const bucket = BUCKET as string;
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const key = `book-content/_itest/range-probe-${Date.now()}.bin`;
  // 100 deterministic bytes so we can assert exact Range slicing.
  const body = Buffer.from(Array.from({ length: 100 }, (_, i) => i % 256));

  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "audio/mpeg" }),
  );
  try {
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: 6 * 60 * 60,
    });

    // Full GET: 200 + Accept-Ranges: bytes (S3 advertises native Range support).
    const full = await fetch(url);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    assert.equal((await full.arrayBuffer()).byteLength, 100);

    // Ranged GET: 206 + Content-Range, and exactly the requested slice.
    const ranged = await fetch(url, { headers: { Range: "bytes=0-9" } });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get("content-range"), "bytes 0-9/100");
    const slice = Buffer.from(await ranged.arrayBuffer());
    assert.equal(slice.length, 10);
    assert.deepEqual([...slice], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    // A second, non-zero range — proves arbitrary seeking, not just prefix reads.
    const mid = await fetch(url, { headers: { Range: "bytes=50-59" } });
    assert.equal(mid.status, 206);
    assert.equal(mid.headers.get("content-range"), "bytes 50-59/100");
    assert.deepEqual([...Buffer.from(await mid.arrayBuffer())], [50, 51, 52, 53, 54, 55, 56, 57, 58, 59]);
  } finally {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
  }
});
