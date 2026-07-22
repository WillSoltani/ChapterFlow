import { mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  createPrivateKey,
  X509Certificate,
  type KeyObject,
} from "node:crypto";
import { SignJWT } from "jose";
import {
  appleOnlineChecksEnabled,
  createAppleSignedDataVerifier,
  mapAppleOfficialVerificationError,
  parseAppleNotificationPayload,
  parseAppleTransactionInfo,
  verifyAppleTransactionJws,
  AppleJwsVerificationError,
  APPLE_ROOT_CA_G3_PEM,
  type AppleJwsErrorCode,
  type AppleSignedDataPolicy,
} from "./apple-jws-verify-core";
import {
  Environment,
  VerificationException,
  VerificationStatus,
} from "@apple/app-store-server-library";
import {
  ROOT_CERT_PEM,
  INTERMEDIATE_CERT_PEM,
  LEAF_CERT_PEM,
  LEAF_PRIVATE_KEY_PKCS8_DER_B64,
  WRONG_PROFILE_LEAF_CERT_PEM,
  WRONG_PROFILE_INTERMEDIATE_CERT_PEM,
  WRONG_PROFILE_INTERMEDIATE_LEAF_CERT_PEM,
  NON_CA_INTERMEDIATE_CERT_PEM,
  NON_CA_INTERMEDIATE_LEAF_CERT_PEM,
} from "./apple-jws-test-fixtures";

function leafPrivateKey(): KeyObject {
  return createPrivateKey({
    key: Buffer.from(LEAF_PRIVATE_KEY_PKCS8_DER_B64, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

const NOW = new Date("2027-01-01T00:00:00Z");
const TEST_POLICY: AppleSignedDataPolicy = {
  bundleId: "com.chapterflow.app",
  appAppleId: 1234567890,
  environment: "Production",
};
const TEST_OPTIONS = {
  trustedRootsDer: [new X509Certificate(ROOT_CERT_PEM).raw],
  enableOnlineChecks: false,
};

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
  bundleId: TEST_POLICY.bundleId,
  productId: "chapterflow.pro.monthly",
  transactionId: "2000000123456789",
  originalTransactionId: "1000000987654321",
  environment: "Production",
  subscriptionGroupIdentifier: "12345678",
  appAccountToken: "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
  inAppOwnershipType: "PURCHASED",
  expiresDate: NOW.getTime() + 30 * 24 * 3600 * 1000,
  signedDate: NOW.getTime(),
  type: "Auto-Renewable Subscription",
};

async function signWithLeaf(
  payload: Record<string, unknown>,
  header: { alg?: string; x5c?: string[] } = {},
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", x5c: FULL_CHAIN_X5C, ...header })
    .sign(leafPrivateKey());
}

async function expectReject(
  jws: string,
  expectedCode?: AppleJwsErrorCode,
  policy = TEST_POLICY,
): Promise<void> {
  await assert.rejects(
    () => verifyAppleTransactionJws(jws, policy, TEST_OPTIONS),
    (error: unknown) => {
      assert.ok(error instanceof AppleJwsVerificationError);
      if (expectedCode) assert.equal(error.code, expectedCode);
      return true;
    },
  );
}

test("official verifier authenticates and decodes a StoreKit transaction", async () => {
  const payload = await verifyAppleTransactionJws(
    await signWithLeaf(SAMPLE_TX),
    TEST_POLICY,
    TEST_OPTIONS,
  );
  const transaction = parseAppleTransactionInfo(payload);
  assert.equal(transaction.bundleId, TEST_POLICY.bundleId);
  assert.equal(transaction.productId, "chapterflow.pro.monthly");
  assert.equal(transaction.originalTransactionId, "1000000987654321");
  assert.equal(transaction.environment, "Production");
  assert.equal(transaction.subscriptionGroupIdentifier, "12345678");
  assert.equal(
    transaction.appAccountToken,
    "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
  );
  assert.equal(transaction.inAppOwnershipType, "PURCHASED");
  assert.equal(transaction.expiresDateMs, SAMPLE_TX.expiresDate);
});

test("notification parser preserves bundle, appAppleId, and environment", () => {
  const notification = parseAppleNotificationPayload({
    notificationType: "DID_RENEW",
    data: {
      bundleId: "com.chapterflow.ios",
      appAppleId: 1234567890,
      environment: "Production",
      signedTransactionInfo: "header.payload.signature",
    },
  });
  assert.equal(notification.data?.bundleId, "com.chapterflow.ios");
  assert.equal(notification.data?.appAppleId, 1234567890);
  assert.equal(notification.data?.environment, "Production");
});

test("tampered payload and signature are rejected", async () => {
  const jws = await signWithLeaf(SAMPLE_TX);
  const [header, , signature] = jws.split(".");
  assert.ok(header !== undefined && signature !== undefined);
  const forgedPayload = Buffer.from(
    JSON.stringify({ ...SAMPLE_TX, productId: "chapterflow.pro.HIJACKED" }),
  ).toString("base64url");
  await expectReject(`${header}.${forgedPayload}.${signature}`, "bad_signature");

  const flipped =
    signature[0] === "A"
      ? `B${signature.slice(1)}`
      : `A${signature.slice(1)}`;
  await expectReject(`${header}.${jws.split(".")[1]}.${flipped}`, "bad_signature");
});

test("offline verification uses signedDate after the certificate expires now", async () => {
  mock.timers.enable({
    apis: ["Date"],
    now: new Date("2040-01-01T00:00:00Z"),
  });
  try {
    const payload = await verifyAppleTransactionJws(
      await signWithLeaf(SAMPLE_TX),
      TEST_POLICY,
      TEST_OPTIONS,
    );
    assert.equal(payload.signedDate, SAMPLE_TX.signedDate);
  } finally {
    mock.timers.reset();
  }
});

test("certificate invalid at signedDate is rejected offline", async () => {
  await expectReject(
    await signWithLeaf({
      ...SAMPLE_TX,
      signedDate: Date.parse("2040-01-01T00:00:00Z"),
    }),
    "invalid_certificate",
  );
});

for (const fixture of [
  {
    name: "wrong-profile leaf",
    chain: [
      WRONG_PROFILE_LEAF_CERT_PEM,
      INTERMEDIATE_CERT_PEM,
      ROOT_CERT_PEM,
    ],
  },
  {
    name: "wrong-profile intermediate",
    chain: [
      WRONG_PROFILE_INTERMEDIATE_LEAF_CERT_PEM,
      WRONG_PROFILE_INTERMEDIATE_CERT_PEM,
      ROOT_CERT_PEM,
    ],
  },
  {
    name: "non-CA intermediate",
    chain: [
      NON_CA_INTERMEDIATE_LEAF_CERT_PEM,
      NON_CA_INTERMEDIATE_CERT_PEM,
      ROOT_CERT_PEM,
    ],
  },
]) {
  test(`official verifier rejects Apple-rooted ${fixture.name}`, async () => {
    await expectReject(
      await signWithLeaf(SAMPLE_TX, { x5c: fixture.chain.map(derB64) }),
    );
  });
}

test("official verifier requires exactly three x5c certificates", async () => {
  await expectReject(
    await signWithLeaf(SAMPLE_TX, {
      x5c: [derB64(LEAF_CERT_PEM), derB64(INTERMEDIATE_CERT_PEM)],
    }),
    "invalid_certificate",
  );
});

test("test chain is rejected against the pinned Apple production root", async () => {
  const jws = await signWithLeaf(SAMPLE_TX);
  await assert.rejects(
    () =>
      verifyAppleTransactionJws(jws, TEST_POLICY, {
        trustedRootsDer: [new X509Certificate(APPLE_ROOT_CA_G3_PEM).raw],
        enableOnlineChecks: false,
      }),
    AppleJwsVerificationError,
  );
});

test("Production notification appAppleId mismatch is rejected", async () => {
  const signedNotification = await signWithLeaf({
    notificationType: "DID_RENEW",
    notificationUUID: "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
    version: "2.0",
    signedDate: NOW.getTime(),
    data: {
      bundleId: TEST_POLICY.bundleId,
      appAppleId: TEST_POLICY.appAppleId + 1,
      environment: "Production",
    },
  });
  const verifier = createAppleSignedDataVerifier(TEST_POLICY, TEST_OPTIONS);
  await assert.rejects(
    () => verifier.notification(signedNotification),
    (error: unknown) =>
      error instanceof AppleJwsVerificationError &&
      error.code === "invalid_app_identifier",
  );
});

test("Production enables official online OCSP checks; Sandbox stays offline", () => {
  assert.equal(appleOnlineChecksEnabled(TEST_POLICY), true);
  assert.equal(
    appleOnlineChecksEnabled({ ...TEST_POLICY, environment: "Sandbox" }),
    false,
  );

  let capturedOnlineChecks: boolean | undefined;
  const verifier = createAppleSignedDataVerifier(TEST_POLICY, {
    verifierFactory: (input) => {
      capturedOnlineChecks = input.enableOnlineChecks;
      assert.equal(input.environment, Environment.PRODUCTION);
      assert.equal(input.appAppleId, TEST_POLICY.appAppleId);
      return {
        verifyAndDecodeTransaction: async () => SAMPLE_TX,
        verifyAndDecodeRenewalInfo: async () => ({}),
        verifyAndDecodeNotification: async () => ({}),
      };
    },
  });
  assert.equal(capturedOnlineChecks, true);
  void verifier;
});

test("OCSP transport failure maps to a retryable verification error", () => {
  const error = mapAppleOfficialVerificationError(
    new VerificationException(
      VerificationStatus.RETRYABLE_VERIFICATION_FAILURE,
    ),
  );
  assert.equal(error.code, "verification_unavailable");
  assert.equal(error.retryable, true);
});

test("malformed or certificate-less signed data is rejected", async () => {
  await expectReject("not-a-jws");
  const certificateLess = await new SignJWT(SAMPLE_TX)
    .setProtectedHeader({ alg: "ES256" })
    .sign(leafPrivateKey());
  await expectReject(certificateLess, "invalid_certificate");
});
