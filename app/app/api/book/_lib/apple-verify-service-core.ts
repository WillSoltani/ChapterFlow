import { BookApiError } from "./errors";
import {
  AppleJwsVerificationError,
  parseAppleTransactionInfo,
  type AppleTransactionInfo,
} from "./apple-jws-verify-core";
import { buildAppleActivation } from "./apple-notification-core";
import {
  validateAppleAccountBinding,
  validateApplePurchasePolicy,
  APPLE_ACCOUNT_BINDING_VERSION,
  resolveAppleStorageLane,
  resolveAppleTransactionEnvironment,
  type AppleAccountBindingViolation,
  type ApplePurchasePolicy,
  type ApplePurchasePolicyViolation,
} from "./apple-purchase-policy-core";
import type { AppleEntitlementWriteParams } from "./apple-entitlement-write-core";
import type { AppleStorageLane } from "./keys";

type EntitlementView = {
  plan?: string;
  proStatus?: string;
  proSource?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
} | null;

export type AppleVerifyServiceDependencies = {
  nowMs(): number;
  verifyTransactionJws(
    jws: string,
    policy: ApplePurchasePolicy,
    authenticatedUserId: string,
  ): Promise<Record<string, unknown>>;
  getPolicy(): Promise<ApplePurchasePolicy>;
  getExistingClaim(
    originalTransactionId: string,
    storageLane: AppleStorageLane,
  ): Promise<{
    userId: string;
    accountBindingVersion?: string;
  } | null>;
  claimTransaction(
    originalTransactionId: string,
    userId: string,
    accountBindingVersion?: string,
    storageLane?: AppleStorageLane,
    storeEnvironment?: "Production" | "Sandbox",
  ): Promise<boolean>;
  updateEntitlement(
    params: NonNullable<ReturnType<typeof buildAppleActivation>> & {
      userId: string;
    },
    storageLane: AppleStorageLane,
  ): Promise<boolean>;
  getEntitlement(
    userId: string,
    storageLane: AppleStorageLane,
  ): Promise<EntitlementView>;
};

export type AppleVerificationResponse = {
  ok: true;
  processed: true;
  transactionState: "active" | "expired" | "revoked";
  entitlement: {
    plan: string;
    proStatus: string;
    proSource?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
  };
};

export function applePurchasePolicyError(
  violation: ApplePurchasePolicyViolation,
): BookApiError {
  switch (violation) {
    case "bundle_mismatch":
      return new BookApiError(
        400,
        violation,
        "This transaction is not for this application.",
      );
    case "app_apple_id_mismatch":
      return new BookApiError(
        400,
        violation,
        "This notification is not for this App Store application.",
      );
    case "transaction_environment_mismatch":
      return new BookApiError(
        400,
        violation,
        "This transaction is not from the expected App Store environment.",
      );
    case "product_not_allowed":
      return new BookApiError(
        400,
        violation,
        "This App Store product is not supported.",
      );
    case "subscription_group_mismatch":
      return new BookApiError(
        400,
        violation,
        "This subscription does not belong to the ChapterFlow subscription group.",
      );
    case "unsupported_transaction_type":
      return new BookApiError(
        400,
        violation,
        "This App Store transaction type is not supported.",
      );
    case "unsupported_ownership_type":
      return new BookApiError(
        400,
        violation,
        "This App Store transaction ownership type is not supported.",
      );
    case "family_shared_not_supported":
      return new BookApiError(
        400,
        violation,
        "Family-shared subscriptions are not supported.",
      );
  }
}

export function appleAccountBindingError(
  violation: AppleAccountBindingViolation,
): BookApiError {
  switch (violation) {
    case "account_identifier_unsupported":
      return new BookApiError(
        409,
        violation,
        "This account cannot be linked to an App Store purchase.",
      );
    case "account_token_required":
      return new BookApiError(
        400,
        violation,
        "This transaction is missing its account binding.",
      );
    case "account_token_malformed":
      return new BookApiError(
        400,
        violation,
        "This transaction has an invalid account binding.",
      );
    case "account_token_mismatch":
      return new BookApiError(
        409,
        violation,
        "This App Store purchase belongs to a different account.",
      );
  }
}

export function appleJwsBookApiError(input: {
  error: AppleJwsVerificationError;
  invalidCode: string;
  invalidMessage: string;
  identityCode?: string;
  identityMessage?: string;
  environmentCode?: string;
  environmentMessage?: string;
}): BookApiError {
  if (input.error.retryable) {
    return new BookApiError(
      503,
      "apple_verification_unavailable",
      "App Store verification is temporarily unavailable. Please retry.",
    );
  }
  if (input.error.code === "invalid_app_identifier" && input.identityCode) {
    return new BookApiError(
      400,
      input.identityCode,
      input.identityMessage ?? input.invalidMessage,
    );
  }
  if (input.error.code === "invalid_environment" && input.environmentCode) {
    return new BookApiError(
      400,
      input.environmentCode,
      input.environmentMessage ?? input.invalidMessage,
    );
  }
  return new BookApiError(400, input.invalidCode, input.invalidMessage, {
    reason: input.error.code,
  });
}

async function decodeTransaction(
  transactionJws: string,
  policy: ApplePurchasePolicy,
  authenticatedUserId: string,
  dependencies: AppleVerifyServiceDependencies,
): Promise<AppleTransactionInfo> {
  try {
    return parseAppleTransactionInfo(
      await dependencies.verifyTransactionJws(
        transactionJws,
        policy,
        authenticatedUserId,
      ),
    );
  } catch (error) {
    if (error instanceof AppleJwsVerificationError) {
      throw appleJwsBookApiError({
        error,
        invalidCode: "invalid_transaction",
        invalidMessage: "The App Store transaction could not be verified.",
        identityCode: "bundle_mismatch",
        identityMessage: "This transaction is not for this application.",
        environmentCode: "transaction_environment_mismatch",
        environmentMessage:
          "This transaction is not from the expected App Store environment.",
      });
    }
    throw error;
  }
}

/**
 * Authenticated Apple verification use case. All signed claim and account
 * checks happen before the first reverse-map claim or entitlement write.
 */
export async function verifyAppleTransactionForUser(input: {
  userId: string;
  transactionJws: string;
  dependencies: AppleVerifyServiceDependencies;
}): Promise<AppleVerificationResponse> {
  const { userId, transactionJws, dependencies } = input;
  const policy = await dependencies.getPolicy();
  const transaction = await decodeTransaction(
    transactionJws,
    policy,
    userId,
    dependencies,
  );

  const policyViolation = validateApplePurchasePolicy(transaction, policy, {
    authenticatedUserId: userId,
  });
  if (policyViolation) throw applePurchasePolicyError(policyViolation);
  const transactionEnvironment = resolveAppleTransactionEnvironment({
    signedEnvironment: transaction.environment,
    policy,
    authenticatedUserId: userId,
  });
  if (!transactionEnvironment) {
    throw applePurchasePolicyError("transaction_environment_mismatch");
  }
  const storageLane = resolveAppleStorageLane({
    signedEnvironment: transaction.environment,
    policy,
    authenticatedUserId: userId,
  });
  if (!storageLane) {
    throw applePurchasePolicyError("transaction_environment_mismatch");
  }

  if (
    !transaction.originalTransactionId ||
    !transaction.transactionId ||
    transaction.signedDateMs === undefined
  ) {
    throw new BookApiError(
      400,
      "unsupported_transaction",
      "The transaction is missing required subscription fields.",
    );
  }
  if (transaction.expiresDateMs === undefined) {
    throw new BookApiError(
      400,
      "unsupported_transaction",
      "The transaction is missing required subscription fields.",
    );
  }

  const existingClaim = await dependencies.getExistingClaim(
    transaction.originalTransactionId,
    storageLane,
  );
  if (existingClaim && existingClaim.userId !== userId) {
    throw new BookApiError(
      409,
      "transaction_already_claimed",
      "This App Store purchase is already linked to a different account.",
    );
  }

  const bindingViolation = validateAppleAccountBinding({
    authenticatedUserId: userId,
    appAccountToken: transaction.appAccountToken,
    existingOwnerId: existingClaim?.userId ?? null,
    existingBindingVersion: existingClaim?.accountBindingVersion,
  });
  if (bindingViolation) throw appleAccountBindingError(bindingViolation);

  const claimed = await dependencies.claimTransaction(
    transaction.originalTransactionId,
    userId,
    transaction.appAccountToken
      ? APPLE_ACCOUNT_BINDING_VERSION
      : undefined,
    storageLane,
    transactionEnvironment,
  );
  if (!claimed) {
    throw new BookApiError(
      409,
      "transaction_already_claimed",
      "This App Store purchase is already linked to a different account.",
    );
  }

  const transactionState =
    transaction.revocationDateMs !== undefined
      ? "revoked"
      : transaction.expiresDateMs <= dependencies.nowMs()
        ? "expired"
        : "active";

  let mutation: AppleEntitlementWriteParams;
  if (transactionState === "active") {
    const activation = buildAppleActivation(
      transaction,
      transaction.signedDateMs,
    );
    if (!activation) {
      throw new BookApiError(
        400,
        "unsupported_transaction",
        "The transaction is missing required subscription fields.",
      );
    }
    mutation = activation;
  } else {
    mutation = {
      plan: "FREE",
      proStatus: transactionState === "revoked" ? "canceled" : "inactive",
      originalTransactionId: transaction.originalTransactionId,
      productId: transaction.productId,
      currentPeriodEnd: new Date(transaction.expiresDateMs).toISOString(),
      cancelAtPeriodEnd: true,
      appleSignedDateMs: transaction.signedDateMs,
      // A terminal Apple transaction may only close an Apple entitlement. It
      // cannot revoke Stripe, promotional, gift, or administrative access.
      guard: "apple_only",
    };
  }

  await dependencies.updateEntitlement(
    { ...mutation, userId },
    storageLane,
  );
  const entitlement = await dependencies.getEntitlement(
    userId,
    storageLane,
  );
  if (transactionState === "active" && !entitlement) {
    throw new BookApiError(
      503,
      "entitlement_confirmation_unavailable",
      "The App Store purchase could not yet be confirmed. Please retry.",
    );
  }
  const fallbackPlan = transactionState === "active" ? "PRO" : "FREE";
  const fallbackStatus =
    transactionState === "active"
      ? "active"
      : transactionState === "revoked"
        ? "canceled"
        : "inactive";
  return {
    ok: true,
    processed: true,
    transactionState,
    entitlement: {
      plan: entitlement?.plan ?? fallbackPlan,
      proStatus: entitlement?.proStatus ?? fallbackStatus,
      proSource:
        entitlement?.proSource ??
        (transactionState === "active" ? "apple" : undefined),
      currentPeriodEnd: entitlement?.currentPeriodEnd,
      cancelAtPeriodEnd: entitlement?.cancelAtPeriodEnd ?? false,
    },
  };
}
