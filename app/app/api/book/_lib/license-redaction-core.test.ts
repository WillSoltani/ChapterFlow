import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { redactLicenseCode } from "./license-redaction-core";

const VALID_CODE = "CF-AB12-CD34-EF56"; // 17 chars total

test("redaction never returns the raw code anywhere in its output", () => {
  const out = redactLicenseCode(VALID_CODE);
  const serialized = JSON.stringify(out);
  // The full credential must not survive into the audit payload.
  assert.ok(!serialized.includes(VALID_CODE), "raw code leaked into output");
  // The high-entropy middle groups (the secret part) must be absent.
  assert.ok(!serialized.includes("AB12"), "first entropy group leaked");
  assert.ok(!serialized.includes("CD34"), "middle entropy group leaked");
  // The fingerprint must not equal the code.
  assert.notEqual(out.codeFingerprint, VALID_CODE);
});

test("codeFingerprint is the non-reversible SHA-256 base64url of the raw code", () => {
  const out = redactLicenseCode(VALID_CODE);
  assert.equal(
    out.codeFingerprint,
    createHash("sha256").update(VALID_CODE).digest("base64url"),
  );
});

test("fingerprint is deterministic so repeat attempts of the same code correlate", () => {
  assert.equal(
    redactLicenseCode(VALID_CODE).codeFingerprint,
    redactLicenseCode(VALID_CODE).codeFingerprint,
  );
  // ...and distinct codes produce distinct fingerprints.
  assert.notEqual(
    redactLicenseCode(VALID_CODE).codeFingerprint,
    redactLicenseCode("CF-ZZ99-YY88-XX77").codeFingerprint,
  );
});

test("codeSuffix exposes only the trailing 4 chars of a valid key", () => {
  const out = redactLicenseCode(VALID_CODE);
  assert.equal(out.codeSuffix, "EF56");
  // Four trailing chars of a 12-entropy-char key are not enough to reconstruct it.
  assert.ok((out.codeSuffix?.length ?? 0) <= 4);
});

test("short / empty / sentinel probe strings are not echoed back in full", () => {
  for (const probe of ["", "(empty)", "CF", "ABCD"]) {
    const out = redactLicenseCode(probe);
    // No suffix when the input is too short to hide anything.
    if (probe.length <= 4) {
      assert.equal(out.codeSuffix, null, `probe ${JSON.stringify(probe)} exposed a suffix`);
    }
    // A fingerprint is always produced and is never the raw probe.
    assert.ok(out.codeFingerprint.length > 0);
    assert.notEqual(out.codeFingerprint, probe);
  }
});

test("attacker-supplied long probe strings are fingerprinted, not stored raw", () => {
  const probe = "'; DROP TABLE entitlements; --";
  const out = redactLicenseCode(probe);
  assert.ok(!JSON.stringify(out).includes("DROP TABLE"), "attacker probe stored raw");
  assert.equal(out.codeFingerprint, createHash("sha256").update(probe).digest("base64url"));
});
