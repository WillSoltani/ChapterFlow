/**
 * Verification of Apple StoreKit / App Store Server JWS payloads.
 *
 * StoreKit 2 signed transactions (`transactionJWS`) and App Store Server
 * Notifications V2 (`signedPayload`) are JWS Compact objects whose protected
 * header carries an `x5c` certificate chain — `[signing leaf, intermediate,
 * Apple Root CA - G3]` — and whose signature is ES256 over the leaf's EC P-256
 * key. Authenticity is established WITHOUT any network call to Apple:
 *
 *   1. Parse the `x5c` chain (DER certs, base64) into X.509 certificates.
 *   2. Verify each certificate is cryptographically signed by the next
 *      (`leaf`←`intermediate`←`root`) and that issuer/subject chain correctly.
 *   3. Verify the TOP of the chain is byte-identical to a PINNED Apple root we
 *      ship (see {@link APPLE_ROOT_CA_G3_PEM}) — the trust anchor is Apple's,
 *      not an attacker-supplied self-signed root embedded in the header.
 *   4. Verify every certificate is within its validity window.
 *   5. Verify the JWS signature against the leaf certificate's public key,
 *      restricted to ES256 (no `alg` downgrade / `none`).
 *
 * This module is intentionally free of `server-only` and the AWS SDK so it is
 * unit-testable (see apple-jws-verify-core.test.ts, which signs JWSs with a
 * throwaway test chain and injects it as the trusted root). It depends only on
 * `jose` (already used by the auth verifier) and Node's built-in `crypto`.
 */
import { X509Certificate } from "node:crypto";
import { compactVerify, decodeProtectedHeader } from "jose";

/**
 * Apple Root CA - G3 (the trust anchor for StoreKit / App Store Server JWS),
 * pinned by value. Downloaded from https://www.apple.com/certificateauthority/
 * (SHA-256 fingerprint
 * 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79).
 * The signing leaf and Apple's intermediate rotate; this root is stable until
 * 2039 and is the only anchor we trust.
 */
export const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

/** A machine-readable reason a JWS failed verification (mapped to 400 by routes). */
export type AppleJwsErrorCode =
  | "malformed_jws"
  | "unsupported_alg"
  | "missing_x5c"
  | "invalid_certificate"
  | "broken_chain"
  | "certificate_expired"
  | "untrusted_root"
  | "bad_signature"
  | "malformed_payload";

export class AppleJwsVerificationError extends Error {
  constructor(
    public readonly code: AppleJwsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppleJwsVerificationError";
  }
}

export type VerifyAppleJwsOptions = {
  /**
   * Trust anchors, PEM-encoded. Production passes {@link APPLE_ROOT_CA_G3_PEM};
   * tests inject a throwaway root. The chain's top certificate must be
   * byte-identical to one of these.
   */
  trustedRootsPem?: string[];
  /** Clock for certificate-validity checks. Defaults to the current time. */
  now?: Date;
};

// Guard against an absurdly long x5c (cheap DoS). Apple sends exactly 3.
const MAX_CHAIN_LENGTH = 10;

function derFromX5cEntry(entry: unknown): Buffer {
  if (typeof entry !== "string" || entry.length === 0) {
    throw new AppleJwsVerificationError(
      "invalid_certificate",
      "x5c entry is not a non-empty string.",
    );
  }
  // x5c entries are base64 (standard, not base64url) DER per RFC 7515 §4.1.6.
  return Buffer.from(entry, "base64");
}

/**
 * Verify an Apple JWS Compact string (a signed transaction OR a notification
 * signedPayload) and return its decoded JSON payload. Throws
 * {@link AppleJwsVerificationError} on any authenticity failure.
 */
export async function verifyAppleJws(
  jws: string,
  opts: VerifyAppleJwsOptions = {},
): Promise<Record<string, unknown>> {
  if (typeof jws !== "string" || jws.split(".").length !== 3) {
    throw new AppleJwsVerificationError(
      "malformed_jws",
      "Value is not a compact JWS (expected three dot-separated segments).",
    );
  }

  const trustedRootsPem =
    opts.trustedRootsPem && opts.trustedRootsPem.length > 0
      ? opts.trustedRootsPem
      : [APPLE_ROOT_CA_G3_PEM];
  const now = opts.now ?? new Date();

  let header: { alg?: unknown; x5c?: unknown };
  try {
    header = decodeProtectedHeader(jws);
  } catch {
    throw new AppleJwsVerificationError(
      "malformed_jws",
      "JWS protected header could not be decoded.",
    );
  }

  // Pin the algorithm: only ES256 (Apple's signing algorithm). This blocks an
  // `alg: none` / algorithm-confusion downgrade at the header level, and is
  // re-enforced in compactVerify's `algorithms` allowlist below.
  if (header.alg !== "ES256") {
    throw new AppleJwsVerificationError(
      "unsupported_alg",
      `Unexpected JWS alg "${String(header.alg)}"; only ES256 is accepted.`,
    );
  }

  if (
    !Array.isArray(header.x5c) ||
    header.x5c.length < 2 ||
    header.x5c.length > MAX_CHAIN_LENGTH
  ) {
    throw new AppleJwsVerificationError(
      "missing_x5c",
      "JWS header is missing a well-formed x5c certificate chain.",
    );
  }

  let chain: X509Certificate[];
  try {
    chain = header.x5c.map((entry) => new X509Certificate(derFromX5cEntry(entry)));
  } catch (err) {
    if (err instanceof AppleJwsVerificationError) throw err;
    throw new AppleJwsVerificationError(
      "invalid_certificate",
      "An x5c certificate could not be parsed as X.509 DER.",
    );
  }

  // Validity windows for every certificate in the chain.
  for (const cert of chain) {
    const notBefore = new Date(cert.validFrom);
    const notAfter = new Date(cert.validTo);
    if (
      Number.isNaN(notBefore.getTime()) ||
      Number.isNaN(notAfter.getTime()) ||
      now < notBefore ||
      now > notAfter
    ) {
      throw new AppleJwsVerificationError(
        "certificate_expired",
        `Certificate "${cert.subject.split("\n")[0]}" is outside its validity window.`,
      );
    }
  }

  // Cryptographic chain: each certificate must be signed by the next one's key
  // (and correctly name it as issuer). This is the real trust link — an attacker
  // cannot forge an intermediate signed by Apple's root private key.
  for (let i = 0; i < chain.length - 1; i++) {
    const subject = chain[i];
    const issuer = chain[i + 1];
    if (!subject.checkIssued(issuer) || !subject.verify(issuer.publicKey)) {
      throw new AppleJwsVerificationError(
        "broken_chain",
        `Certificate at position ${i} is not validly issued by the next in the chain.`,
      );
    }
  }

  // Trust anchor: the top of the presented chain must be byte-identical to a
  // pinned root we ship. (Its self-signature is not re-checked — identity is the
  // anchor.) Prevents trusting an attacker-supplied self-signed root in x5c.
  const presentedRoot = chain[chain.length - 1];
  const trustedRoots = trustedRootsPem.map((pem) => new X509Certificate(pem));
  const rootIsTrusted = trustedRoots.some((root) =>
    root.raw.equals(presentedRoot.raw),
  );
  if (!rootIsTrusted) {
    throw new AppleJwsVerificationError(
      "untrusted_root",
      "The x5c chain does not terminate at a trusted Apple root certificate.",
    );
  }

  // Signature: verify against the LEAF's public key, ES256 only.
  let payloadBytes: Uint8Array;
  try {
    ({ payload: payloadBytes } = await compactVerify(jws, chain[0].publicKey, {
      algorithms: ["ES256"],
    }));
  } catch {
    throw new AppleJwsVerificationError(
      "bad_signature",
      "JWS signature verification failed against the leaf certificate.",
    );
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload is not a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new AppleJwsVerificationError(
      "malformed_payload",
      "JWS payload is not a JSON object.",
    );
  }
}

// ─── Typed views over the decoded payloads ───────────────────────────────────
//
// Apple's JSON uses camelCase keys; we read the subset the entitlement path
// needs. Dates are epoch MILLISECONDS in Apple's schema.

/** Decoded `JWSTransactionDecodedPayload` subset. */
export type AppleTransactionInfo = {
  bundleId?: string;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  /** Subscription expiry, epoch ms. Absent for non-renewing purchases. */
  expiresDateMs?: number;
  /** Set when the transaction was refunded/revoked, epoch ms. */
  revocationDateMs?: number;
  /** When Apple signed this transaction, epoch ms — used as an ordering stamp. */
  signedDateMs?: number;
  /** e.g. "Auto-Renewable Subscription". */
  type?: string;
};

/** Decoded `JWSRenewalInfoDecodedPayload` subset. */
export type AppleRenewalInfo = {
  /** 1 = will auto-renew, 0 = auto-renew turned off. */
  autoRenewStatus?: number;
  autoRenewProductId?: string;
  productId?: string;
  /** e.g. "GRACE_PERIOD" | "BILLING_RETRY". */
  gracePeriodExpiresDateMs?: number;
};

/** Decoded App Store Server Notification V2 `responseBodyV2DecodedPayload` subset. */
export type AppleNotificationPayload = {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  /** When Apple signed the notification, epoch ms — the ordering high-water mark. */
  signedDateMs?: number;
  data?: {
    bundleId?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
};

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parseAppleTransactionInfo(
  payload: Record<string, unknown>,
): AppleTransactionInfo {
  return {
    bundleId: readString(payload.bundleId),
    productId: readString(payload.productId),
    transactionId: readString(payload.transactionId),
    originalTransactionId: readString(payload.originalTransactionId),
    expiresDateMs: readNumber(payload.expiresDate),
    revocationDateMs: readNumber(payload.revocationDate),
    signedDateMs: readNumber(payload.signedDate),
    type: readString(payload.type),
  };
}

export function parseAppleRenewalInfo(
  payload: Record<string, unknown>,
): AppleRenewalInfo {
  return {
    autoRenewStatus: readNumber(payload.autoRenewStatus),
    autoRenewProductId: readString(payload.autoRenewProductId),
    productId: readString(payload.productId),
    gracePeriodExpiresDateMs: readNumber(payload.gracePeriodExpiresDate),
  };
}

export function parseAppleNotificationPayload(
  payload: Record<string, unknown>,
): AppleNotificationPayload {
  const data =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : undefined;
  return {
    notificationType: readString(payload.notificationType),
    subtype: readString(payload.subtype),
    notificationUUID: readString(payload.notificationUUID),
    signedDateMs: readNumber(payload.signedDate),
    data: data
      ? {
          bundleId: readString(data.bundleId),
          signedTransactionInfo: readString(data.signedTransactionInfo),
          signedRenewalInfo: readString(data.signedRenewalInfo),
        }
      : undefined,
  };
}
