import { test } from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, type KeyObject } from "node:crypto";
import { SignJWT } from "jose";
import {
  verifyAppleJws,
  parseAppleTransactionInfo,
  AppleJwsVerificationError,
  APPLE_ROOT_CA_G3_PEM,
} from "./apple-jws-verify-core";
import {
  ROOT_CERT_PEM,
  INTERMEDIATE_CERT_PEM,
  LEAF_CERT_PEM,
  LEAF_PRIVATE_KEY_PKCS8_DER_B64,
  EXPIRED_LEAF_CERT_PEM,
} from "./apple-jws-test-fixtures";

/** The throwaway leaf signing key, reconstructed from bare base64 PKCS#8 DER. */
function leafPrivateKey(): KeyObject {
  return createPrivateKey({
    key: Buffer.from(LEAF_PRIVATE_KEY_PKCS8_DER_B64, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

// A fixed clock inside the (long-lived) test leaf's validity window
// (2026-07-03 → 2028-10-05), so these tests are deterministic regardless of the
// real wall clock. The expired leaf's window is 2020, so it is expired at NOW.
const NOW = new Date("2027-01-01T00:00:00Z");
const TEST_ROOTS = [ROOT_CERT_PEM];

/** Strip PEM armor/whitespace → base64 DER, the x5c wire form (RFC 7515). */
function derB64(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
}

const FULL_CHAIN_X5C = [
  derB64(LEAF_CERT_PEM),
  derB64(INTERMEDIATE_CERT_PEM),
  derB64(ROOT_CERT_PEM),
];

const SAMPLE_TX = {
  bundleId: "com.chapterflow.app",
  productId: "chapterflow.pro.monthly",
  transactionId: "2000000123456789",
  originalTransactionId: "1000000987654321",
  expiresDate: NOW.getTime() + 30 * 24 * 3600 * 1000,
  signedDate: NOW.getTime(),
  type: "Auto-Renewable Subscription",
};

async function signWithLeaf(
  payload: Record<string, unknown>,
  header: { alg?: string; x5c?: string[] } = {},
): Promise<string> {
  const key = leafPrivateKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", x5c: FULL_CHAIN_X5C, ...header })
    .sign(key);
}

async function expectRejectCode(
  jws: string,
  code: string,
  opts?: Parameters<typeof verifyAppleJws>[1],
): Promise<void> {
  await assert.rejects(
    () => verifyAppleJws(jws, { trustedRootsPem: TEST_ROOTS, now: NOW, ...opts }),
    (err: unknown) => {
      assert.ok(
        err instanceof AppleJwsVerificationError,
        `expected AppleJwsVerificationError, got ${String(err)}`,
      );
      assert.equal(err.code, code);
      return true;
    },
  );
}

// ─── HAPPY PATH ──────────────────────────────────────────────────────────────

test("happy: a well-formed transaction JWS verifies and decodes", async () => {
  const jws = await signWithLeaf(SAMPLE_TX);
  const payload = await verifyAppleJws(jws, {
    trustedRootsPem: TEST_ROOTS,
    now: NOW,
  });
  const tx = parseAppleTransactionInfo(payload);
  assert.equal(tx.bundleId, "com.chapterflow.app");
  assert.equal(tx.productId, "chapterflow.pro.monthly");
  assert.equal(tx.originalTransactionId, "1000000987654321");
  assert.equal(tx.expiresDateMs, SAMPLE_TX.expiresDate);
  assert.equal(tx.signedDateMs, SAMPLE_TX.signedDate);
  assert.equal(tx.revocationDateMs, undefined);
});

// ─── TAMPERED ────────────────────────────────────────────────────────────────

test("tampered: mutating the payload segment breaks the signature", async () => {
  const jws = await signWithLeaf(SAMPLE_TX);
  const [h, , s] = jws.split(".");
  // Re-encode a DIFFERENT payload (product swapped) under the ORIGINAL signature.
  const forged = Buffer.from(
    JSON.stringify({ ...SAMPLE_TX, productId: "chapterflow.pro.HIJACKED" }),
  ).toString("base64url");
  await expectRejectCode(`${h}.${forged}.${s}`, "bad_signature");
});

test("tampered: a flipped signature segment is rejected", async () => {
  const jws = await signWithLeaf(SAMPLE_TX);
  const [h, p, s] = jws.split(".");
  const flipped = s[0] === "A" ? "B" + s.slice(1) : "A" + s.slice(1);
  await expectRejectCode(`${h}.${p}.${flipped}`, "bad_signature");
});

// ─── EXPIRED CERTIFICATE ─────────────────────────────────────────────────────

test("expired: a chain whose leaf certificate has expired is rejected", async () => {
  // x5c presents the EXPIRED leaf (valid only in 2020). The validity-window
  // check trips before signature verification, so the code is certificate_expired.
  const jws = await signWithLeaf(SAMPLE_TX, {
    x5c: [
      derB64(EXPIRED_LEAF_CERT_PEM),
      derB64(INTERMEDIATE_CERT_PEM),
      derB64(ROOT_CERT_PEM),
    ],
  });
  await expectRejectCode(jws, "certificate_expired");
});

// ─── ROOT PINNING ────────────────────────────────────────────────────────────

test("untrusted root: the test chain is rejected against the real Apple root", async () => {
  const jws = await signWithLeaf(SAMPLE_TX);
  // Verify the test chain but trust ONLY the real Apple Root CA - G3 → the
  // presented root does not match the pinned anchor.
  await expectRejectCode(jws, "untrusted_root", {
    trustedRootsPem: [APPLE_ROOT_CA_G3_PEM],
  });
});

test("default trust anchor is the pinned Apple root (rejects the test chain)", async () => {
  const jws = await signWithLeaf(SAMPLE_TX);
  // No trustedRootsPem → falls back to APPLE_ROOT_CA_G3_PEM.
  await assert.rejects(
    () => verifyAppleJws(jws, { now: NOW }),
    (err: unknown) =>
      err instanceof AppleJwsVerificationError && err.code === "untrusted_root",
  );
});

// ─── ALGORITHM PINNING / MALFORMED ───────────────────────────────────────────

test("alg pinning: an alg:none token is rejected before any chain work", async () => {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", x5c: FULL_CHAIN_X5C }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(SAMPLE_TX)).toString("base64url");
  await expectRejectCode(`${header}.${payload}.`, "unsupported_alg");
});

test("missing x5c: an ES256 JWS with no certificate chain is rejected", async () => {
  const key = leafPrivateKey();
  const jws = await new SignJWT(SAMPLE_TX)
    .setProtectedHeader({ alg: "ES256" })
    .sign(key);
  await expectRejectCode(jws, "missing_x5c");
});

test("malformed: a non-JWS string is rejected", async () => {
  await expectRejectCode("not-a-jws", "malformed_jws");
});
