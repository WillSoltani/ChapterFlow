/**
 * App Store signed-data verification through Apple's official Node library.
 *
 * The library owns the security-critical x5c profile: exact chain length,
 * Apple-root trust, StoreKit leaf/intermediate private OIDs, intermediate CA
 * Basic Constraints, signature/date checks, and (when enabled) OCSP. Production
 * always enables online checks; Sandbox uses Apple's offline signedDate mode so
 * local/sandbox verification is deterministic and does not depend on OCSP.
 */
import { X509Certificate } from "node:crypto";
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
} from "@apple/app-store-server-library";

/** Apple Root CA - G3, pinned by value from Apple's certificate authority. */
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

export type AppleJwsErrorCode =
  | "malformed_jws"
  | "missing_x5c"
  | "invalid_certificate"
  | "invalid_app_identifier"
  | "invalid_environment"
  | "bad_signature"
  | "verification_unavailable";

export class AppleJwsVerificationError extends Error {
  constructor(
    public readonly code: AppleJwsErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AppleJwsVerificationError";
  }
}

export type AppleSignedDataPolicy = {
  bundleId: string;
  appAppleId: number;
  environment: "Production" | "Sandbox";
};

type AppleVerifierLike = Pick<
  SignedDataVerifier,
  | "verifyAndDecodeTransaction"
  | "verifyAndDecodeRenewalInfo"
  | "verifyAndDecodeNotification"
>;

export type AppleVerifierOptions = {
  /** DER roots are injectable only for deterministic certificate fixtures. */
  trustedRootsDer?: Buffer[];
  /** Tests may force offline/online; production callers use the policy default. */
  enableOnlineChecks?: boolean;
  verifierFactory?: (input: {
    roots: Buffer[];
    enableOnlineChecks: boolean;
    environment: Environment;
    bundleId: string;
    appAppleId?: number;
  }) => AppleVerifierLike;
};

export type AppleSignedDataVerifier = {
  transaction(jws: string): Promise<Record<string, unknown>>;
  renewal(jws: string): Promise<Record<string, unknown>>;
  notification(jws: string): Promise<Record<string, unknown>>;
};

export function appleOnlineChecksEnabled(
  policy: AppleSignedDataPolicy,
): boolean {
  return policy.environment === "Production";
}

export function mapAppleOfficialVerificationError(
  error: unknown,
): AppleJwsVerificationError {
  if (error instanceof AppleJwsVerificationError) return error;
  if (error instanceof VerificationException) {
    switch (error.status) {
      case VerificationStatus.RETRYABLE_VERIFICATION_FAILURE:
        return new AppleJwsVerificationError(
          "verification_unavailable",
          "Apple certificate revocation status is temporarily unavailable.",
          true,
        );
      case VerificationStatus.INVALID_APP_IDENTIFIER:
        return new AppleJwsVerificationError(
          "invalid_app_identifier",
          "The signed data belongs to a different App Store application.",
        );
      case VerificationStatus.INVALID_ENVIRONMENT:
        return new AppleJwsVerificationError(
          "invalid_environment",
          "The signed data belongs to a different App Store environment.",
        );
      case VerificationStatus.INVALID_CHAIN_LENGTH:
        return new AppleJwsVerificationError(
          "missing_x5c",
          "The signed data does not carry Apple's exact certificate chain.",
        );
      case VerificationStatus.INVALID_CERTIFICATE:
        return new AppleJwsVerificationError(
          "invalid_certificate",
          "The App Store signing certificate is invalid.",
        );
      case VerificationStatus.VERIFICATION_FAILURE:
      case VerificationStatus.FAILURE:
      case VerificationStatus.OK:
      default:
        return new AppleJwsVerificationError(
          "bad_signature",
          "The App Store signed data could not be authenticated.",
        );
    }
  }
  return new AppleJwsVerificationError(
    "malformed_jws",
    "The App Store signed data is malformed.",
  );
}

export function createAppleSignedDataVerifier(
  policy: AppleSignedDataPolicy,
  options: AppleVerifierOptions = {},
): AppleSignedDataVerifier {
  const roots =
    options.trustedRootsDer ?? [new X509Certificate(APPLE_ROOT_CA_G3_PEM).raw];
  const enableOnlineChecks =
    options.enableOnlineChecks ?? appleOnlineChecksEnabled(policy);
  const environment =
    policy.environment === "Production"
      ? Environment.PRODUCTION
      : Environment.SANDBOX;
  const appAppleId =
    policy.environment === "Production" ? policy.appAppleId : undefined;
  const verifier = options.verifierFactory
    ? options.verifierFactory({
        roots,
        enableOnlineChecks,
        environment,
        bundleId: policy.bundleId,
        ...(appAppleId !== undefined ? { appAppleId } : {}),
      })
    : new SignedDataVerifier(
        roots,
        enableOnlineChecks,
        environment,
        policy.bundleId,
        appAppleId,
      );

  async function authenticated(
    operation: () => Promise<unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      return (await operation()) as Record<string, unknown>;
    } catch (error) {
      throw mapAppleOfficialVerificationError(error);
    }
  }

  return {
    transaction: (jws) =>
      authenticated(() => verifier.verifyAndDecodeTransaction(jws)),
    renewal: (jws) =>
      authenticated(() => verifier.verifyAndDecodeRenewalInfo(jws)),
    notification: (jws) =>
      authenticated(() => verifier.verifyAndDecodeNotification(jws)),
  };
}

export async function verifyAppleTransactionJws(
  jws: string,
  policy: AppleSignedDataPolicy,
  options?: AppleVerifierOptions,
): Promise<Record<string, unknown>> {
  return createAppleSignedDataVerifier(policy, options).transaction(jws);
}

// ─── Typed views over the decoded payloads ───────────────────────────────────

export type AppleTransactionInfo = {
  bundleId?: string | undefined;
  productId?: string | undefined;
  transactionId?: string | undefined;
  originalTransactionId?: string | undefined;
  environment?: string | undefined;
  subscriptionGroupIdentifier?: string | undefined;
  appAccountToken?: string | undefined;
  inAppOwnershipType?: string | undefined;
  expiresDateMs?: number | undefined;
  revocationDateMs?: number | undefined;
  signedDateMs?: number | undefined;
  type?: string | undefined;
};

export type AppleRenewalInfo = {
  autoRenewStatus?: number | undefined;
  autoRenewProductId?: string | undefined;
  productId?: string | undefined;
  gracePeriodExpiresDateMs?: number | undefined;
};

export type AppleNotificationPayload = {
  notificationType?: string | undefined;
  subtype?: string | undefined;
  notificationUUID?: string | undefined;
  signedDateMs?: number | undefined;
  data?: {
    bundleId?: string | undefined;
    appAppleId?: number | undefined;
    environment?: string | undefined;
    signedTransactionInfo?: string | undefined;
    signedRenewalInfo?: string | undefined;
  } | undefined;
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
    environment: readString(payload.environment),
    subscriptionGroupIdentifier: readString(
      payload.subscriptionGroupIdentifier,
    ),
    appAccountToken: readString(payload.appAccountToken),
    inAppOwnershipType: readString(payload.inAppOwnershipType),
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
          appAppleId: readNumber(data.appAppleId),
          environment: readString(data.environment),
          signedTransactionInfo: readString(data.signedTransactionInfo),
          signedRenewalInfo: readString(data.signedRenewalInfo),
        }
      : undefined,
  };
}
