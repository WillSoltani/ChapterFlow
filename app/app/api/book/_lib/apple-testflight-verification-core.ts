import {
  AppleJwsVerificationError,
  type AppleSignedDataPolicy,
} from "./apple-jws-verify-core";
import {
  isAppleTestFlightSandboxUserAllowed,
  type ApplePurchasePolicy,
} from "./apple-purchase-policy-core";

/**
 * Authenticate with the deployment's normal verifier first. Only an
 * authenticated INVALID_ENVIRONMENT from Production may fall back to Sandbox,
 * and only for an exact allowlisted Cognito UUID. Signature/profile/OCSP errors
 * never fall back.
 */
export async function verifyAppleTransactionWithTestFlightFallback(input: {
  jws: string;
  policy: ApplePurchasePolicy;
  authenticatedUserId: string;
  verify(
    jws: string,
    policy: AppleSignedDataPolicy,
  ): Promise<Record<string, unknown>>;
}): Promise<Record<string, unknown>> {
  try {
    return await input.verify(input.jws, input.policy);
  } catch (error) {
    if (
      error instanceof AppleJwsVerificationError &&
      error.code === "invalid_environment" &&
      isAppleTestFlightSandboxUserAllowed(
        input.policy,
        input.authenticatedUserId,
      )
    ) {
      return input.verify(input.jws, {
        ...input.policy,
        environment: "Sandbox",
      });
    }
    throw error;
  }
}
