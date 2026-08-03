import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPLE_TESTFLIGHT_SUBJECT_HASH_PATTERN,
  deriveAppleTestFlightSubjectHashes,
  hashAppleTestFlightSubject,
} from "./apple-testflight-subject-hash-core";

const USER = "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f";
const OTHER_USER = "2c1743a3-9130-4fbf-b67d-f8e4f069f9f9";

test("canonical Cognito UUID hashes to the stable one-way deployment value", () => {
  assert.equal(
    hashAppleTestFlightSubject(USER),
    "f6f3b8eca8f49a1352f4bd948fb2c0d634b0fb81ccbf2b786c48cfa3ff7c3155",
  );
});

test("CI derivation emits only lowercase SHA-256 hashes", () => {
  const result = deriveAppleTestFlightSubjectHashes(`${USER},${OTHER_USER}`);
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.hashes.length, 2);
  assert.ok(result.hashes.every((value) => APPLE_TESTFLIGHT_SUBJECT_HASH_PATTERN.test(value)));
  assert.equal(JSON.stringify(result).includes(USER), false);
  assert.equal(JSON.stringify(result).includes(OTHER_USER), false);
});

for (const [name, raw] of [
  ["missing input", undefined],
  ["blank input", ""],
  ["uppercase UUID", USER.toUpperCase()],
  ["malformed UUID", "not-a-cognito-sub"],
  ["duplicate UUID", `${USER},${USER}`],
  ["empty member", `${USER},`],
] as const) {
  test(`CI derivation rejects ${name} without returning input`, () => {
    assert.deepEqual(deriveAppleTestFlightSubjectHashes(raw), {
      valid: false,
      issue: "invalid_testflight_qa_allowlist",
    });
  });
}
